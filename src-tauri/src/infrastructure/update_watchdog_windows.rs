use std::{
    ffi::OsString,
    io::Write,
    path::Path,
    process::{Child, Command, Stdio},
    sync::mpsc,
    thread,
    time::Instant,
};

#[cfg(any(test, all(target_os = "windows", feature = "e2e")))]
use std::path::PathBuf;

use chrono::{DateTime, Duration as ChronoDuration, SecondsFormat, Utc};
use fitfreed_application::{
    decide_packaged_update_recovery_startup_action,
    decide_packaged_update_recovery_watchdog_action, PackagedUpdateRecoveryPhase,
    PackagedUpdateRecoveryStartupAction, PackagedUpdateRecoveryWatchdogAction,
    UpdateRecoveryOutcomeKind, UpdateRecoveryWatchdogEvent,
};

use super::update_recovery_windows::RECOVERY_EXECUTABLE_NAME;
use super::update_watchdog::{
    persisted_deadline, stop_child, UpdateRecoveryWatchdogError, UpdateRecoveryWatchdogOutcome,
    INSTALLATION_TIMEOUT, POLL_INTERVAL, REPLACEMENT_CONFIRMATION_TIMEOUT,
    TERMINAL_CLEANUP_TIMEOUT,
};
use super::update_watchdog_protocol::{
    generate_launch_nonce, read_watchdog_readiness, write_candidate_go, write_watchdog_readiness,
    UPDATE_RECOVERY_CANDIDATE_ARGUMENT, UPDATE_RECOVERY_WATCHDOG_ARGUMENT,
    UPDATE_RECOVERY_WATCHDOG_RESUME_ARGUMENT, WATCHDOG_READY_TIMEOUT,
};
use super::{
    acquire_windows_update_recovery_watchdog_lease,
    active_windows_update_recovery_phase_with_watchdog_lease, begin_windows_update_recovery_retry,
    cancel_windows_update_recovery_retry, discard_prepared_windows_update_recovery,
    install_windows_candidate_package, maintain_windows_update_recovery_with_watchdog_lease,
    observe_windows_parent_process, observe_windows_recovery_process,
    record_active_windows_update_recovery_replacement_launch,
    resolve_active_windows_update_recovery_watchdog_context,
    resolve_windows_update_recovery_watchdog_context, restore_active_windows_update_recovery,
    terminate_windows_recovery_process, transition_active_windows_update_recovery,
    windows_recovery_process_is_running, PreparedWindowsUpdateRecovery, UpdateRecoveryMaintenance,
    WindowsRecoveryProcessIdentity, WindowsRecoveryStateError,
    WindowsUpdateRecoveryReplacementLaunch, WindowsUpdateRecoveryReplacementProcess,
    WindowsUpdateRecoveryRestoration, WindowsUpdateRecoveryRestorationOutcome,
    WindowsUpdateRecoveryWatchdogContext, WindowsUpdateRecoveryWatchdogLease,
};

const PROCESS_OBSERVATION_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(5);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WindowsWatchdogStartupStage {
    ContextResolution,
    WatchdogLease,
    ActivePhase,
    ParentProcess,
    ReadinessWrite,
}

#[cfg(any(test, all(target_os = "windows", feature = "e2e")))]
impl WindowsWatchdogStartupStage {
    const fn diagnostic_name(self) -> &'static str {
        match self {
            Self::ContextResolution => "context-resolution",
            Self::WatchdogLease => "watchdog-lease",
            Self::ActivePhase => "active-phase",
            Self::ParentProcess => "parent-process",
            Self::ReadinessWrite => "readiness-write",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WindowsWatchdogStartupErrorCategory {
    RecoveryState,
    NativeProcess,
    InputOutput,
}

#[cfg(any(test, all(target_os = "windows", feature = "e2e")))]
impl WindowsWatchdogStartupErrorCategory {
    const fn diagnostic_name(self) -> &'static str {
        match self {
            Self::RecoveryState => "recovery-state",
            Self::NativeProcess => "native-process",
            Self::InputOutput => "input-output",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WindowsWatchdogDiagnosticTransport {
    Discard,
    Inherit,
}

const fn windows_watchdog_diagnostic_transport(
    target_is_windows: bool,
    e2e_enabled: bool,
) -> WindowsWatchdogDiagnosticTransport {
    if target_is_windows && e2e_enabled {
        WindowsWatchdogDiagnosticTransport::Inherit
    } else {
        WindowsWatchdogDiagnosticTransport::Discard
    }
}

fn windows_watchdog_child_stderr() -> Stdio {
    match windows_watchdog_diagnostic_transport(cfg!(target_os = "windows"), cfg!(feature = "e2e"))
    {
        WindowsWatchdogDiagnosticTransport::Discard => Stdio::null(),
        WindowsWatchdogDiagnosticTransport::Inherit => Stdio::inherit(),
    }
}

#[cfg(any(test, all(target_os = "windows", feature = "e2e")))]
fn observe_windows_watchdog_startup_with<T, E>(
    stage: WindowsWatchdogStartupStage,
    category: WindowsWatchdogStartupErrorCategory,
    result: Result<T, E>,
    diagnostics: &mut impl Write,
) -> Result<T, E> {
    if result.is_err() {
        let _ = writeln!(
            diagnostics,
            "FitFreed Windows update watchdog startup failed at {}: {}",
            stage.diagnostic_name(),
            category.diagnostic_name()
        );
    }
    result
}

fn observe_windows_watchdog_startup<T, E>(
    stage: WindowsWatchdogStartupStage,
    category: WindowsWatchdogStartupErrorCategory,
    result: Result<T, E>,
) -> Result<T, E> {
    #[cfg(all(target_os = "windows", feature = "e2e"))]
    {
        return observe_windows_watchdog_startup_with(
            stage,
            category,
            result,
            &mut std::io::stderr().lock(),
        );
    }
    #[cfg(not(all(target_os = "windows", feature = "e2e")))]
    {
        let _ = (stage, category);
        result
    }
}

pub struct StartedWindowsUpdateRecoveryWatchdog {
    child: Child,
}

impl StartedWindowsUpdateRecoveryWatchdog {
    pub fn process_id(&self) -> u32 {
        self.child.id()
    }

    pub fn stop(mut self) -> Result<(), UpdateRecoveryWatchdogError> {
        stop_child(&mut self.child).map_err(Into::into)
    }
}

pub fn start_windows_update_recovery_watchdog(
    prepared: &PreparedWindowsUpdateRecovery,
    installed_executable_path: &Path,
) -> Result<StartedWindowsUpdateRecoveryWatchdog, UpdateRecoveryWatchdogError> {
    let executable = prepared
        .attempt_directory()
        .join("previous/runnable")
        .join(RECOVERY_EXECUTABLE_NAME);
    spawn_windows_update_recovery_watchdog(
        &executable,
        installed_executable_path,
        UPDATE_RECOVERY_WATCHDOG_ARGUMENT,
    )
}

pub fn reattach_windows_update_recovery_watchdog(
    recovery_root: &Path,
    installed_executable_path: &Path,
) -> Result<Option<StartedWindowsUpdateRecoveryWatchdog>, UpdateRecoveryWatchdogError> {
    let Some((context, phase)) = resolve_active_windows_update_recovery_watchdog_context(
        recovery_root,
        installed_executable_path,
    )?
    else {
        return Ok(None);
    };
    if decide_packaged_update_recovery_startup_action(phase)
        != PackagedUpdateRecoveryStartupAction::ResumeWatchdog
    {
        return Ok(None);
    }
    match acquire_windows_update_recovery_watchdog_lease(&context) {
        Ok(lease) => drop(lease),
        Err(WindowsRecoveryStateError::ActiveAttemptExists) => return Ok(None),
        Err(error) => return Err(error.into()),
    }
    match spawn_windows_update_recovery_watchdog(
        context.runnable_predecessor_executable_path(),
        installed_executable_path,
        UPDATE_RECOVERY_WATCHDOG_RESUME_ARGUMENT,
    ) {
        Ok(watchdog) => Ok(Some(watchdog)),
        Err(start_error) => match acquire_windows_update_recovery_watchdog_lease(&context) {
            Err(WindowsRecoveryStateError::ActiveAttemptExists) => Ok(None),
            Ok(lease) => {
                drop(lease);
                Err(start_error)
            }
            Err(error) => Err(error.into()),
        },
    }
}

pub fn retry_windows_update_recovery(
    recovery_root: &Path,
    installed_executable_path: &Path,
) -> Result<Option<StartedWindowsUpdateRecoveryWatchdog>, UpdateRecoveryWatchdogError> {
    let context = begin_windows_update_recovery_retry(recovery_root, installed_executable_path)?;
    match spawn_windows_update_recovery_watchdog(
        context.runnable_predecessor_executable_path(),
        installed_executable_path,
        UPDATE_RECOVERY_WATCHDOG_RESUME_ARGUMENT,
    ) {
        Ok(watchdog) => Ok(Some(watchdog)),
        Err(start_error) => match acquire_windows_update_recovery_watchdog_lease(&context) {
            Err(WindowsRecoveryStateError::ActiveAttemptExists) => Ok(None),
            Ok(lease) => {
                cancel_windows_update_recovery_retry(&context, &lease)?;
                Err(start_error)
            }
            Err(error) => Err(error.into()),
        },
    }
}

fn spawn_windows_update_recovery_watchdog(
    executable: &Path,
    installed_executable_path: &Path,
    private_argument: &str,
) -> Result<StartedWindowsUpdateRecoveryWatchdog, UpdateRecoveryWatchdogError> {
    let mut child = Command::new(executable)
        .arg(private_argument)
        .arg(installed_executable_path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(windows_watchdog_child_stderr())
        .spawn()?;
    let process_id = child.id();
    let stdout = child
        .stdout
        .take()
        .ok_or(UpdateRecoveryWatchdogError::Readiness)?;
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
        let result = read_watchdog_readiness(stdout, process_id);
        let _ = sender.send(result);
    });
    match receiver.recv_timeout(WATCHDOG_READY_TIMEOUT) {
        Ok(Ok(true)) => Ok(StartedWindowsUpdateRecoveryWatchdog { child }),
        Ok(Ok(false)) | Err(_) => {
            let _ = stop_child(&mut child);
            Err(UpdateRecoveryWatchdogError::Readiness)
        }
        Ok(Err(error)) => {
            let _ = stop_child(&mut child);
            Err(error.into())
        }
    }
}

pub fn run_windows_update_recovery_watchdog(
    watchdog_executable: &Path,
    installed_executable_path: &Path,
    resumed_after_interruption: bool,
    readiness: &mut impl Write,
) -> Result<UpdateRecoveryWatchdogOutcome, UpdateRecoveryWatchdogError> {
    let context = observe_windows_watchdog_startup(
        WindowsWatchdogStartupStage::ContextResolution,
        WindowsWatchdogStartupErrorCategory::RecoveryState,
        resolve_windows_update_recovery_watchdog_context(
            watchdog_executable,
            installed_executable_path,
        ),
    )?;
    let watchdog_lease = observe_windows_watchdog_startup(
        WindowsWatchdogStartupStage::WatchdogLease,
        WindowsWatchdogStartupErrorCategory::RecoveryState,
        acquire_windows_update_recovery_watchdog_lease(&context),
    )?;
    observe_windows_watchdog_startup(
        WindowsWatchdogStartupStage::ActivePhase,
        WindowsWatchdogStartupErrorCategory::RecoveryState,
        active_phase(&context, &watchdog_lease),
    )?;
    let original_parent = observe_windows_watchdog_startup(
        WindowsWatchdogStartupStage::ParentProcess,
        WindowsWatchdogStartupErrorCategory::NativeProcess,
        observe_windows_parent_process(context.installed_executable_path()),
    )?;
    observe_windows_watchdog_startup(
        WindowsWatchdogStartupStage::ReadinessWrite,
        WindowsWatchdogStartupErrorCategory::InputOutput,
        write_watchdog_readiness(readiness),
    )?;

    let mut watchdog_lease = Some(watchdog_lease);
    let installation_deadline = persisted_deadline(context.prepared_at(), INSTALLATION_TIMEOUT)?;
    let mut replacement = context
        .replacement_process()
        .cloned()
        .map(MonitoredWindowsReplacement::Inherited);

    loop {
        let phase = active_phase(
            &context,
            watchdog_lease
                .as_ref()
                .ok_or(UpdateRecoveryWatchdogError::TerminalCleanup)?,
        )?;
        if should_install_candidate(phase, resumed_after_interruption) {
            stop_original_parent(&original_parent)?;
            let installation = install_windows_candidate_package(
                &context.attempt_directory(),
                context.target_version(),
            );
            let next = if installation.is_ok() {
                PackagedUpdateRecoveryPhase::ReplacementInstalled
            } else {
                PackagedUpdateRecoveryPhase::Recovering
            };
            transition_active_windows_update_recovery(
                context.recovery_root(),
                context.recovery_id(),
                next,
            )?;
            #[cfg(all(target_os = "windows", feature = "e2e"))]
            if installation.is_ok() && !resumed_after_interruption {
                wait_for_windows_update_e2e_interruption()?;
            }
            continue;
        }
        let event = watchdog_event(
            phase,
            replacement.as_mut(),
            context.installed_executable_path(),
            installation_deadline,
            resumed_after_interruption,
        )?;
        match decide_packaged_update_recovery_watchdog_action(phase, event) {
            PackagedUpdateRecoveryWatchdogAction::Wait => thread::sleep(POLL_INTERVAL),
            PackagedUpdateRecoveryWatchdogAction::LaunchReplacement => {
                stop_original_parent(&original_parent)?;
                match launch_replacement(&context) {
                    Ok(process) => replacement = Some(process),
                    Err(_) => transition_active_windows_update_recovery(
                        context.recovery_root(),
                        context.recovery_id(),
                        PackagedUpdateRecoveryPhase::Recovering,
                    )?,
                }
            }
            PackagedUpdateRecoveryWatchdogAction::BeginRecovery => {
                if matches!(
                    phase,
                    PackagedUpdateRecoveryPhase::ReplacementStarted
                        | PackagedUpdateRecoveryPhase::ReplacementInstalled
                ) && event == UpdateRecoveryWatchdogEvent::DeadlineExpired
                {
                    stop_original_parent(&original_parent)?;
                }
                match transition_active_windows_update_recovery(
                    context.recovery_root(),
                    context.recovery_id(),
                    PackagedUpdateRecoveryPhase::Recovering,
                ) {
                    Ok(()) => {
                        if let Some(mut process) = replacement.take() {
                            process.stop(context.installed_executable_path())?;
                        }
                    }
                    Err(WindowsRecoveryStateError::InvalidTransition) => continue,
                    Err(error) => return Err(error.into()),
                }
            }
            PackagedUpdateRecoveryWatchdogAction::RestorePrevious => {
                stop_original_parent(&original_parent)?;
                if let Some(mut process) = replacement.take() {
                    process.stop(context.installed_executable_path())?;
                }
                match restore_active_windows_update_recovery(
                    watchdog_lease
                        .as_ref()
                        .ok_or(UpdateRecoveryWatchdogError::TerminalCleanup)?,
                    WindowsUpdateRecoveryRestoration {
                        recovery_root: context.recovery_root(),
                        recovery_id: context.recovery_id(),
                        expected_library_path: context.library_path(),
                    },
                )? {
                    WindowsUpdateRecoveryRestorationOutcome::Recovered
                    | WindowsUpdateRecoveryRestorationOutcome::NativeRecoveryUnavailable {
                        ..
                    } => {}
                    WindowsUpdateRecoveryRestorationOutcome::RecoveryFailed { .. } => {
                        return Err(UpdateRecoveryWatchdogError::RestorationFailed)
                    }
                }
            }
            PackagedUpdateRecoveryWatchdogAction::LaunchRunnablePredecessor => {
                launch_runnable_predecessor(&context)?;
                return Ok(UpdateRecoveryWatchdogOutcome::RunnablePredecessorStarted);
            }
            PackagedUpdateRecoveryWatchdogAction::StopBeforeReplacement => {
                drop(watchdog_lease.take());
                discard_prepared_windows_update_recovery(
                    context.recovery_root(),
                    context.recovery_id(),
                )?;
                return Ok(UpdateRecoveryWatchdogOutcome::StoppedBeforeReplacement);
            }
            PackagedUpdateRecoveryWatchdogAction::FinishConfirmed => {
                retain_terminal_outcome(
                    &context,
                    &mut watchdog_lease,
                    UpdateRecoveryOutcomeKind::Updated,
                )?;
                return Ok(UpdateRecoveryWatchdogOutcome::Confirmed);
            }
            PackagedUpdateRecoveryWatchdogAction::FinishRecovered => {
                retain_terminal_outcome(
                    &context,
                    &mut watchdog_lease,
                    UpdateRecoveryOutcomeKind::Recovered,
                )?;
                launch_application(context.installed_executable_path(), &[], false)?;
                return Ok(UpdateRecoveryWatchdogOutcome::Recovered);
            }
            PackagedUpdateRecoveryWatchdogAction::FinishFailed => {
                return Err(UpdateRecoveryWatchdogError::TerminalFailure)
            }
        }
    }
}

#[cfg(any(test, all(target_os = "windows", feature = "e2e")))]
fn windows_update_e2e_interruption_paths(
    ready: Option<OsString>,
    continue_: Option<OsString>,
) -> Result<Option<(PathBuf, PathBuf)>, std::io::Error> {
    let (ready, continue_) = match (ready, continue_) {
        (None, None) => return Ok(None),
        (Some(ready), Some(continue_)) => (PathBuf::from(ready), PathBuf::from(continue_)),
        _ => {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Windows update E2E interruption markers are incomplete",
            ))
        }
    };
    if !ready.is_absolute() || !continue_.is_absolute() || ready == continue_ {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Windows update E2E interruption markers are invalid",
        ));
    }
    Ok(Some((ready, continue_)))
}

#[cfg(all(target_os = "windows", feature = "e2e"))]
fn wait_for_windows_update_e2e_interruption() -> Result<(), UpdateRecoveryWatchdogError> {
    const READY: &str = "FITFREED_E2E_WINDOWS_UPDATE_INTERRUPTION_READY";
    const CONTINUE: &str = "FITFREED_E2E_WINDOWS_UPDATE_INTERRUPTION_CONTINUE";
    let Some((ready, continue_)) =
        windows_update_e2e_interruption_paths(std::env::var_os(READY), std::env::var_os(CONTINUE))?
    else {
        return Ok(());
    };
    let mut ready_marker = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(ready)?;
    ready_marker.write_all(b"ready\n")?;
    ready_marker.sync_all()?;
    let deadline = Instant::now() + std::time::Duration::from_secs(120);
    while !continue_.is_file() {
        if Instant::now() >= deadline {
            return Err(std::io::Error::new(
                std::io::ErrorKind::TimedOut,
                "Windows update E2E interruption was not released",
            )
            .into());
        }
        thread::sleep(POLL_INTERVAL);
    }
    Ok(())
}

fn should_install_candidate(
    phase: PackagedUpdateRecoveryPhase,
    resumed_after_interruption: bool,
) -> bool {
    phase == PackagedUpdateRecoveryPhase::ReplacementStarted && !resumed_after_interruption
}

fn retain_terminal_outcome(
    context: &WindowsUpdateRecoveryWatchdogContext,
    watchdog_lease: &mut Option<WindowsUpdateRecoveryWatchdogLease>,
    expected_kind: UpdateRecoveryOutcomeKind,
) -> Result<(), UpdateRecoveryWatchdogError> {
    let deadline = Instant::now() + TERMINAL_CLEANUP_TIMEOUT;
    loop {
        match maintain_windows_update_recovery_with_watchdog_lease(context, watchdog_lease)? {
            UpdateRecoveryMaintenance::CleanupPending(outcome) if outcome.kind == expected_kind => {
                return Ok(())
            }
            UpdateRecoveryMaintenance::OutcomeRetained(outcome)
                if outcome.kind == expected_kind =>
            {
                return Ok(())
            }
            UpdateRecoveryMaintenance::Deferred if Instant::now() < deadline => {
                thread::sleep(POLL_INTERVAL);
            }
            UpdateRecoveryMaintenance::Deferred
            | UpdateRecoveryMaintenance::NoTerminalOutcome
            | UpdateRecoveryMaintenance::CleanupPending(_)
            | UpdateRecoveryMaintenance::OutcomeRetained(_) => {
                return Err(UpdateRecoveryWatchdogError::TerminalCleanup)
            }
        }
    }
}

fn active_phase(
    context: &WindowsUpdateRecoveryWatchdogContext,
    watchdog_lease: &WindowsUpdateRecoveryWatchdogLease,
) -> Result<PackagedUpdateRecoveryPhase, UpdateRecoveryWatchdogError> {
    active_windows_update_recovery_phase_with_watchdog_lease(context, watchdog_lease)
        .map_err(Into::into)
}

fn watchdog_event(
    phase: PackagedUpdateRecoveryPhase,
    replacement: Option<&mut MonitoredWindowsReplacement>,
    installed_executable_path: &Path,
    installation_deadline: DateTime<Utc>,
    resumed_after_interruption: bool,
) -> Result<UpdateRecoveryWatchdogEvent, UpdateRecoveryWatchdogError> {
    if resumed_after_interruption
        && matches!(
            phase,
            PackagedUpdateRecoveryPhase::Prepared | PackagedUpdateRecoveryPhase::ReplacementStarted
        )
    {
        return Ok(UpdateRecoveryWatchdogEvent::DeadlineExpired);
    }
    if phase == PackagedUpdateRecoveryPhase::Launching {
        let replacement = replacement.ok_or(UpdateRecoveryWatchdogError::UnownedReplacement)?;
        if !replacement.is_running(installed_executable_path)? {
            return Ok(UpdateRecoveryWatchdogEvent::ReplacementExited);
        }
        if Utc::now() >= replacement.confirmation_deadline()? {
            return Ok(UpdateRecoveryWatchdogEvent::DeadlineExpired);
        }
    }
    if matches!(
        phase,
        PackagedUpdateRecoveryPhase::Prepared
            | PackagedUpdateRecoveryPhase::ReplacementStarted
            | PackagedUpdateRecoveryPhase::ReplacementInstalled
    ) && Utc::now() >= installation_deadline
    {
        return Ok(UpdateRecoveryWatchdogEvent::DeadlineExpired);
    }
    Ok(UpdateRecoveryWatchdogEvent::Observe)
}

enum MonitoredWindowsReplacement {
    Owned {
        child: Child,
        process: WindowsUpdateRecoveryReplacementProcess,
    },
    Inherited(WindowsUpdateRecoveryReplacementProcess),
}

impl MonitoredWindowsReplacement {
    fn process(&self) -> &WindowsUpdateRecoveryReplacementProcess {
        match self {
            Self::Owned { process, .. } | Self::Inherited(process) => process,
        }
    }

    fn confirmation_deadline(&self) -> Result<DateTime<Utc>, UpdateRecoveryWatchdogError> {
        DateTime::parse_from_rfc3339(self.process().confirmation_deadline())
            .map(|deadline| deadline.with_timezone(&Utc))
            .map_err(|_| WindowsRecoveryStateError::InvalidState.into())
    }

    fn is_running(
        &mut self,
        installed_executable_path: &Path,
    ) -> Result<bool, UpdateRecoveryWatchdogError> {
        if let Self::Owned { child, .. } = self {
            if child.try_wait()?.is_some() {
                return Ok(false);
            }
        }
        Ok(
            observe_windows_recovery_process(
                self.process().process_id(),
                installed_executable_path,
            )
            .is_ok_and(|actual| replacement_process_matches(&actual, self.process())),
        )
    }

    fn stop(
        &mut self,
        installed_executable_path: &Path,
    ) -> Result<(), UpdateRecoveryWatchdogError> {
        match self {
            Self::Owned { child, .. } => stop_child(child).map_err(Into::into),
            Self::Inherited(process) => {
                stop_inherited_replacement(process, installed_executable_path)
            }
        }
    }
}

fn replacement_process_matches(
    actual: &WindowsRecoveryProcessIdentity,
    expected: &WindowsUpdateRecoveryReplacementProcess,
) -> bool {
    actual.process_id() == expected.process_id()
        && actual.creation_time_filetime() == expected.creation_time_filetime()
}

fn launch_replacement(
    context: &WindowsUpdateRecoveryWatchdogContext,
) -> Result<MonitoredWindowsReplacement, UpdateRecoveryWatchdogError> {
    let launch_nonce = generate_launch_nonce()?;
    let arguments = candidate_arguments(context.recovery_id(), &launch_nonce);
    let mut child = launch_application(context.installed_executable_path(), &arguments, true)?;
    let process_identity =
        match observe_started_windows_process(&mut child, context.installed_executable_path()) {
            Ok(identity) => identity,
            Err(_) => {
                let _ = stop_child(&mut child);
                return Err(UpdateRecoveryWatchdogError::UnownedReplacement);
            }
        };
    let confirmation_deadline = (Utc::now()
        + ChronoDuration::seconds(
            i64::try_from(REPLACEMENT_CONFIRMATION_TIMEOUT.as_secs())
                .map_err(|_| UpdateRecoveryWatchdogError::ApplicationLaunch)?,
        ))
    .to_rfc3339_opts(SecondsFormat::Secs, true);
    let process = match record_active_windows_update_recovery_replacement_launch(
        context.recovery_root(),
        context.recovery_id(),
        WindowsUpdateRecoveryReplacementLaunch {
            process: &process_identity,
            launch_nonce: &launch_nonce,
            confirmation_deadline: &confirmation_deadline,
        },
    ) {
        Ok(process) => process,
        Err(error) => {
            let _ = stop_child(&mut child);
            return Err(error.into());
        }
    };
    let signal_result = child
        .stdin
        .take()
        .ok_or(UpdateRecoveryWatchdogError::ApplicationLaunch)
        .and_then(|mut stdin| {
            write_candidate_go(&mut stdin, context.recovery_id(), &launch_nonce)
                .map_err(UpdateRecoveryWatchdogError::Io)
        });
    if let Err(error) = signal_result {
        let _ = stop_child(&mut child);
        return Err(error);
    }
    Ok(MonitoredWindowsReplacement::Owned { child, process })
}

fn launch_runnable_predecessor(
    context: &WindowsUpdateRecoveryWatchdogContext,
) -> Result<(), UpdateRecoveryWatchdogError> {
    let executable = context.runnable_predecessor_executable_path();
    let mut child = launch_application(executable, &[], false)?;
    match observe_started_windows_process(&mut child, executable) {
        Ok(_) => Ok(()),
        Err(error) => {
            let _ = stop_child(&mut child);
            Err(error)
        }
    }
}

fn observe_started_windows_process(
    child: &mut Child,
    expected_executable_path: &Path,
) -> Result<WindowsRecoveryProcessIdentity, UpdateRecoveryWatchdogError> {
    let deadline = Instant::now() + PROCESS_OBSERVATION_TIMEOUT;
    loop {
        if child.try_wait()?.is_some() {
            return Err(UpdateRecoveryWatchdogError::UnownedReplacement);
        }
        if let Ok(identity) = observe_windows_recovery_process(child.id(), expected_executable_path)
        {
            return Ok(identity);
        }
        if Instant::now() >= deadline {
            return Err(UpdateRecoveryWatchdogError::UnownedReplacement);
        }
        thread::sleep(POLL_INTERVAL);
    }
}

fn launch_application(
    executable: &Path,
    arguments: &[OsString],
    pipe_stdin: bool,
) -> Result<Child, UpdateRecoveryWatchdogError> {
    let stdin = if pipe_stdin {
        Stdio::piped()
    } else {
        Stdio::null()
    };
    Command::new(executable)
        .args(arguments)
        .stdin(stdin)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| UpdateRecoveryWatchdogError::ApplicationLaunch)
}

fn candidate_arguments(recovery_id: &str, launch_nonce: &str) -> [OsString; 3] {
    [
        OsString::from(UPDATE_RECOVERY_CANDIDATE_ARGUMENT),
        OsString::from(recovery_id),
        OsString::from(launch_nonce),
    ]
}

fn stop_original_parent(
    process: &WindowsRecoveryProcessIdentity,
) -> Result<(), UpdateRecoveryWatchdogError> {
    stop_exact_process(process)
}

fn stop_inherited_replacement(
    process: &WindowsUpdateRecoveryReplacementProcess,
    installed_executable_path: &Path,
) -> Result<(), UpdateRecoveryWatchdogError> {
    let Ok(identity) =
        observe_windows_recovery_process(process.process_id(), installed_executable_path)
    else {
        return Ok(());
    };
    if !replacement_process_matches(&identity, process) {
        return Ok(());
    }
    stop_exact_process(&identity)
}

fn stop_exact_process(
    process: &WindowsRecoveryProcessIdentity,
) -> Result<(), UpdateRecoveryWatchdogError> {
    if !windows_recovery_process_is_running(process) {
        return Ok(());
    }
    match terminate_windows_recovery_process(process) {
        Ok(()) => Ok(()),
        Err(_) if !windows_recovery_process_is_running(process) => Ok(()),
        Err(error) => Err(error.into()),
    }
}

#[cfg(test)]
mod tests {
    use std::{ffi::OsString, path::PathBuf};

    use super::*;

    #[test]
    fn accepts_only_complete_absolute_windows_update_interruption_markers() {
        let root = std::env::current_dir().expect("current directory");
        let ready = root.join("e2e-ready").into_os_string();
        let continue_ = root.join("e2e-continue").into_os_string();
        let same = root.join("e2e-same").into_os_string();
        assert_eq!(
            windows_update_e2e_interruption_paths(None, None).expect("disabled markers"),
            None
        );
        assert!(windows_update_e2e_interruption_paths(
            Some(ready.clone()),
            Some(continue_.clone()),
        )
        .is_ok());
        assert!(windows_update_e2e_interruption_paths(
            Some(OsString::from("relative-ready")),
            Some(continue_),
        )
        .is_err());
        assert!(windows_update_e2e_interruption_paths(Some(same.clone()), Some(same),).is_err());
        assert!(windows_update_e2e_interruption_paths(Some(ready), None,).is_err());
    }

    #[test]
    fn builds_only_the_exact_private_candidate_arguments() {
        let recovery_id = "a".repeat(64);
        let launch_nonce = "b".repeat(64);

        assert_eq!(
            candidate_arguments(&recovery_id, &launch_nonce),
            [
                OsString::from(UPDATE_RECOVERY_CANDIDATE_ARGUMENT),
                OsString::from(recovery_id),
                OsString::from(launch_nonce),
            ]
        );
    }

    #[test]
    fn rejects_a_launching_phase_without_exact_process_ownership() {
        assert!(matches!(
            watchdog_event(
                PackagedUpdateRecoveryPhase::Launching,
                None,
                Path::new("C:\\Users\\person\\AppData\\Local\\FitFreed\\fitfreed.exe"),
                Utc::now() + ChronoDuration::minutes(15),
                false,
            ),
            Err(UpdateRecoveryWatchdogError::UnownedReplacement)
        ));
    }

    #[test]
    fn derives_the_windows_installation_deadline_from_persisted_state() {
        assert_eq!(
            persisted_deadline("2026-09-04T08:00:00Z", INSTALLATION_TIMEOUT)
                .expect("persisted deadline")
                .to_rfc3339_opts(SecondsFormat::Secs, true),
            "2026-09-04T08:15:00Z"
        );
    }

    #[test]
    fn treats_preinstallation_coordinator_loss_as_an_immediate_interruption() {
        let future_deadline = Utc::now() + ChronoDuration::minutes(15);

        for phase in [
            PackagedUpdateRecoveryPhase::Prepared,
            PackagedUpdateRecoveryPhase::ReplacementStarted,
        ] {
            assert_eq!(
                watchdog_event(
                    phase,
                    None,
                    Path::new("C:\\Users\\person\\AppData\\Local\\FitFreed\\fitfreed.exe"),
                    future_deadline,
                    true,
                )
                .expect("restart event"),
                UpdateRecoveryWatchdogEvent::DeadlineExpired
            );
        }
        assert_eq!(
            watchdog_event(
                PackagedUpdateRecoveryPhase::ReplacementStarted,
                None,
                Path::new("C:\\Users\\person\\AppData\\Local\\FitFreed\\fitfreed.exe"),
                future_deadline,
                false,
            )
            .expect("ordinary installation event"),
            UpdateRecoveryWatchdogEvent::Observe
        );
    }

    #[test]
    fn lets_only_the_fresh_watchdog_install_a_handed_off_candidate() {
        assert!(should_install_candidate(
            PackagedUpdateRecoveryPhase::ReplacementStarted,
            false
        ));
        assert!(!should_install_candidate(
            PackagedUpdateRecoveryPhase::ReplacementStarted,
            true
        ));
        assert!(!should_install_candidate(
            PackagedUpdateRecoveryPhase::Prepared,
            false
        ));
    }

    #[test]
    fn compares_every_persisted_process_identity_component() {
        let executable = Path::new("C:\\Users\\person\\AppData\\Local\\FitFreed\\fitfreed.exe");
        let actual =
            WindowsRecoveryProcessIdentity::for_test(42, 132_537_600_000_000_000, executable);
        let expected = WindowsUpdateRecoveryReplacementProcess::for_test(
            42,
            132_537_600_000_000_000,
            "a".repeat(64),
            "2026-09-04T08:01:00Z".to_owned(),
        );

        assert!(replacement_process_matches(&actual, &expected));
        let changed_time =
            WindowsRecoveryProcessIdentity::for_test(42, 132_537_600_000_000_001, executable);
        assert!(!replacement_process_matches(&changed_time, &expected));
    }

    #[test]
    fn keeps_the_native_and_fallback_executable_roles_distinct() {
        let native = PathBuf::from("C:\\Users\\person\\AppData\\Local\\FitFreed\\fitfreed.exe");
        let fallback = PathBuf::from(
            "C:\\Users\\person\\AppData\\Roaming\\org.fitfreed.desktop\\update-recovery\\attempts\\aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\\previous\\runnable\\fitfreed-update-recovery.exe",
        );

        assert_ne!(native, fallback);
        assert_ne!(native.file_name(), fallback.file_name());
        assert!(candidate_arguments(&"a".repeat(64), &"b".repeat(64))
            .first()
            .is_some_and(|argument| argument == UPDATE_RECOVERY_CANDIDATE_ARGUMENT));
    }

    #[test]
    fn reports_only_fixed_stage_and_category_for_watchdog_startup_failures() {
        let cases = [
            (
                WindowsWatchdogStartupStage::ContextResolution,
                WindowsWatchdogStartupErrorCategory::RecoveryState,
                "FitFreed Windows update watchdog startup failed at context-resolution: recovery-state\n",
            ),
            (
                WindowsWatchdogStartupStage::WatchdogLease,
                WindowsWatchdogStartupErrorCategory::RecoveryState,
                "FitFreed Windows update watchdog startup failed at watchdog-lease: recovery-state\n",
            ),
            (
                WindowsWatchdogStartupStage::ActivePhase,
                WindowsWatchdogStartupErrorCategory::RecoveryState,
                "FitFreed Windows update watchdog startup failed at active-phase: recovery-state\n",
            ),
            (
                WindowsWatchdogStartupStage::ParentProcess,
                WindowsWatchdogStartupErrorCategory::NativeProcess,
                "FitFreed Windows update watchdog startup failed at parent-process: native-process\n",
            ),
            (
                WindowsWatchdogStartupStage::ReadinessWrite,
                WindowsWatchdogStartupErrorCategory::InputOutput,
                "FitFreed Windows update watchdog startup failed at readiness-write: input-output\n",
            ),
        ];

        for (stage, category, expected) in cases {
            let mut diagnostics = Vec::new();
            let error = observe_windows_watchdog_startup_with(
                stage,
                category,
                Err::<(), _>("private local path"),
                &mut diagnostics,
            )
            .expect_err("failed startup operation");

            assert_eq!(error, "private local path");
            assert_eq!(
                String::from_utf8(diagnostics).expect("UTF-8 diagnostic"),
                expected
            );
        }
    }

    #[test]
    fn emits_no_watchdog_startup_diagnostic_for_success() {
        let mut diagnostics = Vec::new();

        let value = observe_windows_watchdog_startup_with(
            WindowsWatchdogStartupStage::ContextResolution,
            WindowsWatchdogStartupErrorCategory::RecoveryState,
            Ok::<_, &str>(42),
            &mut diagnostics,
        )
        .expect("successful startup operation");

        assert_eq!(value, 42);
        assert!(diagnostics.is_empty());
    }

    #[test]
    fn inherits_watchdog_diagnostics_only_for_windows_e2e_builds() {
        assert_eq!(
            windows_watchdog_diagnostic_transport(true, true),
            WindowsWatchdogDiagnosticTransport::Inherit
        );
        assert_eq!(
            windows_watchdog_diagnostic_transport(true, false),
            WindowsWatchdogDiagnosticTransport::Discard
        );
        assert_eq!(
            windows_watchdog_diagnostic_transport(false, true),
            WindowsWatchdogDiagnosticTransport::Discard
        );
        assert_eq!(
            windows_watchdog_diagnostic_transport(false, false),
            WindowsWatchdogDiagnosticTransport::Discard
        );
    }
}
