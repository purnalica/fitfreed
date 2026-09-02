use std::{
    ffi::OsString,
    io::{self, Write},
    path::Path,
    process::{Child, Command, Stdio},
    sync::mpsc,
    thread,
    time::Instant,
};

use chrono::{DateTime, Duration as ChronoDuration, SecondsFormat, Utc};
use fitfreed_application::{
    decide_packaged_update_recovery_startup_action,
    decide_packaged_update_recovery_watchdog_action, PackagedUpdateRecoveryPhase,
    PackagedUpdateRecoveryStartupAction, PackagedUpdateRecoveryWatchdogAction,
    UpdateRecoveryOutcomeKind, UpdateRecoveryWatchdogEvent,
};
use libc::{kill, ESRCH, SIGKILL, SIGTERM};

use super::update_recovery_linux::observe_linux_recovery_process_at;
use super::update_watchdog::{
    original_parent_process_id, persisted_deadline, stop_child, stop_original_parent,
    UpdateRecoveryWatchdogError, UpdateRecoveryWatchdogOutcome, INSTALLATION_TIMEOUT,
    POLL_INTERVAL, PROCESS_STOP_TIMEOUT, REPLACEMENT_CONFIRMATION_TIMEOUT,
    TERMINAL_CLEANUP_TIMEOUT,
};
use super::update_watchdog_protocol::{
    generate_launch_nonce, read_watchdog_readiness, write_candidate_go, write_watchdog_readiness,
    UPDATE_RECOVERY_CANDIDATE_ARGUMENT, UPDATE_RECOVERY_WATCHDOG_ARGUMENT,
    UPDATE_RECOVERY_WATCHDOG_RESUME_ARGUMENT, WATCHDOG_READY_TIMEOUT,
};
use super::{
    acquire_linux_update_recovery_watchdog_lease, active_linux_update_recovery_phase,
    discard_prepared_linux_update_recovery, maintain_linux_update_recovery_with_watchdog_lease,
    observe_linux_recovery_process, record_active_linux_update_recovery_replacement_launch,
    resolve_active_linux_update_recovery_watchdog_context,
    resolve_linux_update_recovery_watchdog_context, restore_active_linux_update_recovery,
    transition_active_linux_update_recovery, LinuxRecoveryProcessIdentity, LinuxRecoveryStateError,
    LinuxUpdateRecoveryReplacementLaunch, LinuxUpdateRecoveryReplacementProcess,
    LinuxUpdateRecoveryRestoration, LinuxUpdateRecoveryRestorationOutcome,
    LinuxUpdateRecoveryWatchdogContext, LinuxUpdateRecoveryWatchdogLease,
    PreparedLinuxUpdateRecovery, UpdateRecoveryMaintenance,
};

const PROCESS_OBSERVATION_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(5);

pub struct StartedLinuxUpdateRecoveryWatchdog {
    child: Child,
}

impl StartedLinuxUpdateRecoveryWatchdog {
    pub fn process_id(&self) -> u32 {
        self.child.id()
    }

    pub fn stop(mut self) -> Result<(), UpdateRecoveryWatchdogError> {
        stop_child(&mut self.child).map_err(Into::into)
    }
}

pub fn start_linux_update_recovery_watchdog(
    prepared: &PreparedLinuxUpdateRecovery,
    installed_executable_path: &Path,
) -> Result<StartedLinuxUpdateRecoveryWatchdog, UpdateRecoveryWatchdogError> {
    let executable = prepared
        .attempt_directory()
        .join("previous/runnable/usr/bin/fitfreed");
    spawn_linux_update_recovery_watchdog(
        &executable,
        installed_executable_path,
        UPDATE_RECOVERY_WATCHDOG_ARGUMENT,
    )
}

pub fn reattach_linux_update_recovery_watchdog(
    recovery_root: &Path,
    installed_executable_path: &Path,
) -> Result<Option<StartedLinuxUpdateRecoveryWatchdog>, UpdateRecoveryWatchdogError> {
    let Some((context, phase)) = resolve_active_linux_update_recovery_watchdog_context(
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
    match acquire_linux_update_recovery_watchdog_lease(&context) {
        Ok(lease) => drop(lease),
        Err(LinuxRecoveryStateError::ActiveAttemptExists) => return Ok(None),
        Err(error) => return Err(error.into()),
    }
    match spawn_linux_update_recovery_watchdog(
        context.runnable_predecessor_executable_path(),
        installed_executable_path,
        UPDATE_RECOVERY_WATCHDOG_RESUME_ARGUMENT,
    ) {
        Ok(watchdog) => Ok(Some(watchdog)),
        Err(start_error) => match acquire_linux_update_recovery_watchdog_lease(&context) {
            Err(LinuxRecoveryStateError::ActiveAttemptExists) => Ok(None),
            Ok(lease) => {
                drop(lease);
                Err(start_error)
            }
            Err(error) => Err(error.into()),
        },
    }
}

fn spawn_linux_update_recovery_watchdog(
    executable: &Path,
    installed_executable_path: &Path,
    private_argument: &str,
) -> Result<StartedLinuxUpdateRecoveryWatchdog, UpdateRecoveryWatchdogError> {
    let mut child = Command::new(executable)
        .arg(private_argument)
        .arg(installed_executable_path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
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
        Ok(Ok(true)) => Ok(StartedLinuxUpdateRecoveryWatchdog { child }),
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

pub fn run_linux_update_recovery_watchdog(
    watchdog_executable: &Path,
    installed_executable_path: &Path,
    resumed_after_interruption: bool,
    readiness: &mut impl Write,
) -> Result<UpdateRecoveryWatchdogOutcome, UpdateRecoveryWatchdogError> {
    let context = resolve_linux_update_recovery_watchdog_context(
        watchdog_executable,
        installed_executable_path,
    )?;
    let mut watchdog_lease = Some(acquire_linux_update_recovery_watchdog_lease(&context)?);
    active_phase(&context)?;
    write_watchdog_readiness(readiness)?;

    let original_parent = original_parent_process_id();
    let installation_deadline = persisted_deadline(context.prepared_at(), INSTALLATION_TIMEOUT)?;
    let mut replacement = context
        .replacement_process()
        .cloned()
        .map(MonitoredLinuxReplacement::Inherited);

    loop {
        let phase = active_phase(&context)?;
        let event = watchdog_event(
            phase,
            replacement.as_mut(),
            installation_deadline,
            resumed_after_interruption,
        )?;
        match decide_packaged_update_recovery_watchdog_action(phase, event) {
            PackagedUpdateRecoveryWatchdogAction::Wait => thread::sleep(POLL_INTERVAL),
            PackagedUpdateRecoveryWatchdogAction::LaunchReplacement => {
                stop_original_parent(original_parent)?;
                match launch_replacement(&context) {
                    Ok(process) => replacement = Some(process),
                    Err(_) => transition_active_linux_update_recovery(
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
                    stop_original_parent(original_parent)?;
                }
                match transition_active_linux_update_recovery(
                    context.recovery_root(),
                    context.recovery_id(),
                    PackagedUpdateRecoveryPhase::Recovering,
                ) {
                    Ok(()) => {
                        if let Some(mut process) = replacement.take() {
                            process.stop()?;
                        }
                    }
                    Err(LinuxRecoveryStateError::InvalidTransition) => continue,
                    Err(error) => return Err(error.into()),
                }
            }
            PackagedUpdateRecoveryWatchdogAction::RestorePrevious => {
                stop_original_parent(original_parent)?;
                if let Some(mut process) = replacement.take() {
                    process.stop()?;
                }
                match restore_active_linux_update_recovery(
                    watchdog_lease
                        .as_ref()
                        .ok_or(UpdateRecoveryWatchdogError::TerminalCleanup)?,
                    LinuxUpdateRecoveryRestoration {
                        recovery_root: context.recovery_root(),
                        recovery_id: context.recovery_id(),
                        expected_library_path: context.library_path(),
                    },
                )? {
                    LinuxUpdateRecoveryRestorationOutcome::Recovered
                    | LinuxUpdateRecoveryRestorationOutcome::NativeRecoveryUnavailable { .. } => {}
                    LinuxUpdateRecoveryRestorationOutcome::RecoveryFailed { .. } => {
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
                discard_prepared_linux_update_recovery(
                    context.recovery_root(),
                    context.recovery_id(),
                )?;
                return Ok(UpdateRecoveryWatchdogOutcome::StoppedBeforeReplacement);
            }
            PackagedUpdateRecoveryWatchdogAction::FinishConfirmed => {
                retain_terminal_outcome(
                    &context,
                    watchdog_lease
                        .as_ref()
                        .ok_or(UpdateRecoveryWatchdogError::TerminalCleanup)?,
                    UpdateRecoveryOutcomeKind::Updated,
                )?;
                return Ok(UpdateRecoveryWatchdogOutcome::Confirmed);
            }
            PackagedUpdateRecoveryWatchdogAction::FinishRecovered => {
                retain_terminal_outcome(
                    &context,
                    watchdog_lease
                        .as_ref()
                        .ok_or(UpdateRecoveryWatchdogError::TerminalCleanup)?,
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

fn retain_terminal_outcome(
    context: &LinuxUpdateRecoveryWatchdogContext,
    watchdog_lease: &LinuxUpdateRecoveryWatchdogLease,
    expected_kind: UpdateRecoveryOutcomeKind,
) -> Result<(), UpdateRecoveryWatchdogError> {
    let deadline = Instant::now() + TERMINAL_CLEANUP_TIMEOUT;
    loop {
        match maintain_linux_update_recovery_with_watchdog_lease(context, watchdog_lease)? {
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
            | UpdateRecoveryMaintenance::OutcomeRetained(_) => {
                return Err(UpdateRecoveryWatchdogError::TerminalCleanup)
            }
        }
    }
}

fn active_phase(
    context: &LinuxUpdateRecoveryWatchdogContext,
) -> Result<PackagedUpdateRecoveryPhase, UpdateRecoveryWatchdogError> {
    let Some((recovery_id, phase)) = active_linux_update_recovery_phase(context.recovery_root())?
    else {
        return Err(LinuxRecoveryStateError::InvalidState.into());
    };
    if recovery_id != context.recovery_id() {
        return Err(LinuxRecoveryStateError::InvalidState.into());
    }
    Ok(phase)
}

fn watchdog_event(
    phase: PackagedUpdateRecoveryPhase,
    replacement: Option<&mut MonitoredLinuxReplacement>,
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
        if !replacement.is_running()? {
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

enum MonitoredLinuxReplacement {
    Owned {
        child: Child,
        process: LinuxUpdateRecoveryReplacementProcess,
    },
    Inherited(LinuxUpdateRecoveryReplacementProcess),
}

impl MonitoredLinuxReplacement {
    fn process(&self) -> &LinuxUpdateRecoveryReplacementProcess {
        match self {
            Self::Owned { process, .. } | Self::Inherited(process) => process,
        }
    }

    fn confirmation_deadline(&self) -> Result<DateTime<Utc>, UpdateRecoveryWatchdogError> {
        DateTime::parse_from_rfc3339(self.process().confirmation_deadline())
            .map(|deadline| deadline.with_timezone(&Utc))
            .map_err(|_| LinuxRecoveryStateError::InvalidState.into())
    }

    fn is_running(&mut self) -> Result<bool, UpdateRecoveryWatchdogError> {
        if let Self::Owned { child, .. } = self {
            if child.try_wait()?.is_some() {
                return Ok(false);
            }
        }
        Ok(observe_linux_recovery_process(self.process().process_id())
            .is_ok_and(|actual| replacement_process_matches(&actual, self.process())))
    }

    fn stop(&mut self) -> Result<(), UpdateRecoveryWatchdogError> {
        match self {
            Self::Owned { child, .. } => stop_child(child).map_err(Into::into),
            Self::Inherited(process) => stop_inherited_replacement(process),
        }
    }
}

fn replacement_process_matches(
    actual: &LinuxRecoveryProcessIdentity,
    expected: &LinuxUpdateRecoveryReplacementProcess,
) -> bool {
    actual.process_id() == expected.process_id()
        && actual.boot_id() == expected.boot_id()
        && actual.start_time_clock_ticks() == expected.start_time_clock_ticks()
        && actual.executable_path() == Path::new("/usr/bin/fitfreed")
}

fn launch_replacement(
    context: &LinuxUpdateRecoveryWatchdogContext,
) -> Result<MonitoredLinuxReplacement, UpdateRecoveryWatchdogError> {
    let launch_nonce = generate_launch_nonce()?;
    let arguments = candidate_arguments(context.recovery_id(), &launch_nonce);
    let mut child = launch_application(context.installed_executable_path(), &arguments, true)?;
    let process_identity =
        match observe_started_linux_process(&mut child, Path::new("/usr/bin/fitfreed")) {
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
    let process = match record_active_linux_update_recovery_replacement_launch(
        context.recovery_root(),
        context.recovery_id(),
        LinuxUpdateRecoveryReplacementLaunch {
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
    Ok(MonitoredLinuxReplacement::Owned { child, process })
}

fn launch_runnable_predecessor(
    context: &LinuxUpdateRecoveryWatchdogContext,
) -> Result<(), UpdateRecoveryWatchdogError> {
    let executable = context.runnable_predecessor_executable_path();
    let mut child = launch_application(executable, &[], false)?;
    match observe_started_linux_process(&mut child, executable) {
        Ok(_) => Ok(()),
        Err(error) => {
            let _ = stop_child(&mut child);
            Err(error)
        }
    }
}

fn observe_started_linux_process(
    child: &mut Child,
    expected_executable_path: &Path,
) -> Result<LinuxRecoveryProcessIdentity, UpdateRecoveryWatchdogError> {
    let deadline = Instant::now() + PROCESS_OBSERVATION_TIMEOUT;
    loop {
        if child.try_wait()?.is_some() {
            return Err(UpdateRecoveryWatchdogError::UnownedReplacement);
        }
        if let Ok(identity) =
            observe_linux_recovery_process_at(child.id(), expected_executable_path)
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

fn stop_inherited_replacement(
    process: &LinuxUpdateRecoveryReplacementProcess,
) -> Result<(), UpdateRecoveryWatchdogError> {
    if !replacement_is_running(process) {
        return Ok(());
    }
    signal_inherited_replacement(process, SIGTERM)?;
    let deadline = Instant::now() + PROCESS_STOP_TIMEOUT;
    while replacement_is_running(process) && Instant::now() < deadline {
        thread::sleep(POLL_INTERVAL);
    }
    if replacement_is_running(process) {
        signal_inherited_replacement(process, SIGKILL)?;
        let deadline = Instant::now() + PROCESS_STOP_TIMEOUT;
        while replacement_is_running(process) && Instant::now() < deadline {
            thread::sleep(POLL_INTERVAL);
        }
    }
    if replacement_is_running(process) {
        return Err(io::Error::new(
            io::ErrorKind::TimedOut,
            "the inherited Linux update candidate did not stop",
        )
        .into());
    }
    Ok(())
}

fn replacement_is_running(process: &LinuxUpdateRecoveryReplacementProcess) -> bool {
    observe_linux_recovery_process(process.process_id())
        .is_ok_and(|actual| replacement_process_matches(&actual, process))
}

fn signal_inherited_replacement(
    process: &LinuxUpdateRecoveryReplacementProcess,
    signal: i32,
) -> Result<(), UpdateRecoveryWatchdogError> {
    if !replacement_is_running(process) {
        return Ok(());
    }
    let process_id = i32::try_from(process.process_id())
        .map_err(|_| UpdateRecoveryWatchdogError::UnownedReplacement)?;
    if unsafe { kill(process_id, signal) } != 0 {
        let error = io::Error::last_os_error();
        if error.raw_os_error() != Some(ESRCH) {
            return Err(error.into());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::*;

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
                Utc::now() + ChronoDuration::minutes(15),
                false,
            ),
            Err(UpdateRecoveryWatchdogError::UnownedReplacement)
        ));
    }

    #[test]
    fn derives_the_linux_installation_deadline_from_persisted_state() {
        assert_eq!(
            persisted_deadline("2026-09-02T08:00:00Z", INSTALLATION_TIMEOUT)
                .expect("persisted deadline")
                .to_rfc3339_opts(SecondsFormat::Secs, true),
            "2026-09-02T08:15:00Z"
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
                watchdog_event(phase, None, future_deadline, true).expect("restart event"),
                UpdateRecoveryWatchdogEvent::DeadlineExpired
            );
        }
        assert_eq!(
            watchdog_event(
                PackagedUpdateRecoveryPhase::ReplacementStarted,
                None,
                future_deadline,
                false,
            )
            .expect("ordinary installation event"),
            UpdateRecoveryWatchdogEvent::Observe
        );
    }

    #[test]
    fn keeps_the_native_and_fallback_executable_roles_distinct() {
        let native = PathBuf::from("/usr/bin/fitfreed");
        let fallback = PathBuf::from(
            "/var/lib/fitfreed/update-recovery/attempts/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/previous/runnable/usr/bin/fitfreed",
        );

        assert_ne!(native, fallback);
        assert!(candidate_arguments(&"a".repeat(64), &"b".repeat(64))
            .first()
            .is_some_and(|argument| argument == UPDATE_RECOVERY_CANDIDATE_ARGUMENT));
    }
}
