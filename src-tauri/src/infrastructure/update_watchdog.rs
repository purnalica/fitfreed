use std::{
    io::{self, Read, Write},
    path::Path,
    process::{Child, Command, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, Instant},
};

use chrono::{DateTime, Duration as ChronoDuration, SecondsFormat, Utc};
use fitfreed_application::{
    decide_update_recovery_watchdog_action, UpdateRecoveryOutcomeKind, UpdateRecoveryPhase,
    UpdateRecoveryWatchdogAction, UpdateRecoveryWatchdogEvent,
};
#[cfg(unix)]
use libc::{getppid, kill, ESRCH, SIGKILL, SIGTERM};
use thiserror::Error;

use super::update_watchdog_protocol::{
    await_candidate_go, generate_launch_nonce, read_watchdog_readiness, write_candidate_go,
    write_watchdog_readiness, CandidateGoError, UPDATE_RECOVERY_CANDIDATE_ARGUMENT,
    UPDATE_RECOVERY_WATCHDOG_ARGUMENT, WATCHDOG_READY_TIMEOUT,
};
use super::{
    acquire_update_recovery_watchdog_lease, active_update_recovery_phase,
    discard_prepared_update_recovery, maintain_update_recovery_with_watchdog_lease,
    observe_update_recovery_process, record_active_update_recovery_replacement_launch,
    resolve_update_recovery_watchdog_context, restore_active_update_recovery,
    transition_active_update_recovery, update_recovery_process_is_running,
    PlatformApplicationCopier, PreparedUpdateRecovery, UpdateRecoveryError,
    UpdateRecoveryMaintenance, UpdateRecoveryReplacementLaunch, UpdateRecoveryReplacementProcess,
    UpdateRecoveryRestoration, UpdateRecoveryWatchdogContext, UpdateRecoveryWatchdogLease,
};

pub(super) const INSTALLATION_TIMEOUT: Duration = Duration::from_secs(15 * 60);
pub(super) const REPLACEMENT_CONFIRMATION_TIMEOUT: Duration = Duration::from_secs(60);
pub(super) const PROCESS_STOP_TIMEOUT: Duration = Duration::from_secs(5);
pub(super) const POLL_INTERVAL: Duration = Duration::from_millis(100);
const RESTORATION_RETRY_INTERVAL: Duration = Duration::from_millis(250);
pub(super) const TERMINAL_CLEANUP_TIMEOUT: Duration = Duration::from_secs(10);
const MAX_RESTORATION_ATTEMPTS: u8 = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UpdateRecoveryWatchdogOutcome {
    Confirmed,
    Recovered,
    RunnablePredecessorStarted,
    StoppedBeforeReplacement,
}

#[derive(Debug, Error)]
pub enum UpdateRecoveryWatchdogError {
    #[error("update recovery watchdog input/output failure: {0}")]
    Io(#[from] io::Error),
    #[error("update recovery watchdog state failure: {0}")]
    Recovery(#[from] UpdateRecoveryError),
    #[cfg(any(test, target_os = "linux"))]
    #[error("Linux update recovery watchdog state failure: {0}")]
    LinuxRecovery(#[from] super::LinuxRecoveryStateError),
    #[error("update recovery watchdog readiness failed")]
    Readiness,
    #[error("update recovery watchdog lost ownership of the replacement process")]
    UnownedReplacement,
    #[error("update recovery watchdog could not launch an application")]
    ApplicationLaunch,
    #[error("update recovery watchdog exhausted restoration attempts")]
    RestorationFailed,
    #[error("update recovery watchdog entered a terminal failure")]
    TerminalFailure,
    #[error("update recovery watchdog could not complete terminal cleanup")]
    TerminalCleanup,
}

pub struct StartedUpdateRecoveryWatchdog {
    child: Child,
}

impl StartedUpdateRecoveryWatchdog {
    pub fn process_id(&self) -> u32 {
        self.child.id()
    }

    pub fn stop(mut self) -> Result<(), UpdateRecoveryWatchdogError> {
        stop_child(&mut self.child).map_err(Into::into)
    }
}

pub fn start_update_recovery_watchdog(
    prepared: &PreparedUpdateRecovery,
    installed_application_path: &Path,
) -> Result<StartedUpdateRecoveryWatchdog, UpdateRecoveryWatchdogError> {
    let executable = prepared
        .attempt_directory()
        .join("previous/FitFreed.app/Contents/MacOS/fitfreed");
    let mut child = Command::new(executable)
        .arg(UPDATE_RECOVERY_WATCHDOG_ARGUMENT)
        .arg(installed_application_path)
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
        Ok(Ok(true)) => {}
        Ok(Ok(false)) => {
            let _ = stop_child(&mut child);
            return Err(UpdateRecoveryWatchdogError::Readiness);
        }
        Ok(Err(error)) => {
            let _ = stop_child(&mut child);
            return Err(UpdateRecoveryWatchdogError::Io(error));
        }
        Err(_) => {
            let _ = stop_child(&mut child);
            return Err(UpdateRecoveryWatchdogError::Readiness);
        }
    }
    Ok(StartedUpdateRecoveryWatchdog { child })
}

pub fn run_update_recovery_watchdog(
    watchdog_executable: &Path,
    installed_application_path: &Path,
    readiness: &mut impl Write,
) -> Result<UpdateRecoveryWatchdogOutcome, UpdateRecoveryWatchdogError> {
    let context =
        resolve_update_recovery_watchdog_context(watchdog_executable, installed_application_path)?;
    let mut watchdog_lease = Some(acquire_update_recovery_watchdog_lease(&context)?);
    active_phase(&context)?;
    write_watchdog_readiness(readiness)?;

    let original_parent = original_parent_process_id();
    let installation_deadline = persisted_deadline(context.prepared_at(), INSTALLATION_TIMEOUT)?;
    let mut replacement = context
        .replacement_process()
        .cloned()
        .map(MonitoredReplacement::Inherited);
    let mut restoration_attempts = 0_u8;

    loop {
        let phase = active_phase(&context)?;
        let event = watchdog_event(phase, replacement.as_mut(), installation_deadline, &context)?;
        match decide_update_recovery_watchdog_action(phase, event) {
            UpdateRecoveryWatchdogAction::Wait => thread::sleep(POLL_INTERVAL),
            UpdateRecoveryWatchdogAction::LaunchReplacement => {
                stop_original_parent(original_parent)?;
                match launch_replacement(&context) {
                    Ok(process) => {
                        replacement = Some(process);
                    }
                    Err(_) => {
                        transition_active_update_recovery(
                            context.recovery_root(),
                            context.recovery_id(),
                            UpdateRecoveryPhase::Recovering,
                        )?;
                    }
                }
            }
            UpdateRecoveryWatchdogAction::BeginRecovery => {
                if matches!(
                    phase,
                    UpdateRecoveryPhase::ReplacementStarted
                        | UpdateRecoveryPhase::ReplacementInstalled
                ) && event == UpdateRecoveryWatchdogEvent::DeadlineExpired
                {
                    stop_original_parent(original_parent)?;
                }
                match transition_active_update_recovery(
                    context.recovery_root(),
                    context.recovery_id(),
                    UpdateRecoveryPhase::Recovering,
                ) {
                    Ok(()) => {
                        if let Some(mut process) = replacement.take() {
                            process.stop(&context)?;
                        }
                    }
                    Err(UpdateRecoveryError::InvalidTransition) => continue,
                    Err(error) => return Err(error.into()),
                }
            }
            UpdateRecoveryWatchdogAction::RestorePrevious => {
                stop_original_parent(original_parent)?;
                if let Some(mut process) = replacement.take() {
                    process.stop(&context)?;
                }
                let restoration = UpdateRecoveryRestoration {
                    recovery_root: context.recovery_root(),
                    recovery_id: context.recovery_id(),
                    expected_application_path: context.installed_application_path(),
                    expected_library_path: context.library_path(),
                };
                match restore_active_update_recovery(&PlatformApplicationCopier, restoration) {
                    Ok(()) => restoration_attempts = 0,
                    Err(_) if restoration_attempts + 1 < MAX_RESTORATION_ATTEMPTS => {
                        restoration_attempts += 1;
                        thread::sleep(RESTORATION_RETRY_INTERVAL);
                    }
                    Err(_) => {
                        transition_active_update_recovery(
                            context.recovery_root(),
                            context.recovery_id(),
                            UpdateRecoveryPhase::RecoveryFailed,
                        )?;
                        return Err(UpdateRecoveryWatchdogError::RestorationFailed);
                    }
                }
            }
            UpdateRecoveryWatchdogAction::StopBeforeReplacement => {
                drop(watchdog_lease.take());
                discard_prepared_update_recovery(context.recovery_root(), context.recovery_id())?;
                return Ok(UpdateRecoveryWatchdogOutcome::StoppedBeforeReplacement);
            }
            UpdateRecoveryWatchdogAction::FinishConfirmed => {
                retain_terminal_outcome(
                    &context,
                    watchdog_lease
                        .as_ref()
                        .ok_or(UpdateRecoveryWatchdogError::TerminalCleanup)?,
                    UpdateRecoveryOutcomeKind::Updated,
                )?;
                return Ok(UpdateRecoveryWatchdogOutcome::Confirmed);
            }
            UpdateRecoveryWatchdogAction::FinishRecovered => {
                let cleanup = retain_terminal_outcome(
                    &context,
                    watchdog_lease
                        .as_ref()
                        .ok_or(UpdateRecoveryWatchdogError::TerminalCleanup)?,
                    UpdateRecoveryOutcomeKind::Recovered,
                );
                let launch = launch_application(context.installed_application_path(), None);
                launch?;
                cleanup?;
                return Ok(UpdateRecoveryWatchdogOutcome::Recovered);
            }
            UpdateRecoveryWatchdogAction::FinishFailed => {
                return Err(UpdateRecoveryWatchdogError::TerminalFailure);
            }
        }
    }
}

fn retain_terminal_outcome(
    context: &UpdateRecoveryWatchdogContext,
    watchdog_lease: &UpdateRecoveryWatchdogLease,
    expected_kind: UpdateRecoveryOutcomeKind,
) -> Result<(), UpdateRecoveryWatchdogError> {
    let deadline = Instant::now() + TERMINAL_CLEANUP_TIMEOUT;
    loop {
        match maintain_update_recovery_with_watchdog_lease(context, watchdog_lease)? {
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
    context: &UpdateRecoveryWatchdogContext,
) -> Result<UpdateRecoveryPhase, UpdateRecoveryWatchdogError> {
    let Some((recovery_id, phase)) = active_update_recovery_phase(context.recovery_root())? else {
        return Err(UpdateRecoveryError::InvalidState.into());
    };
    if recovery_id != context.recovery_id() {
        return Err(UpdateRecoveryError::InvalidState.into());
    }
    Ok(phase)
}

fn watchdog_event(
    phase: UpdateRecoveryPhase,
    replacement: Option<&mut MonitoredReplacement>,
    installation_deadline: DateTime<Utc>,
    context: &UpdateRecoveryWatchdogContext,
) -> Result<UpdateRecoveryWatchdogEvent, UpdateRecoveryWatchdogError> {
    if phase == UpdateRecoveryPhase::Launching {
        let replacement = require_monitored_replacement(replacement)?;
        if !replacement.is_running(context)? {
            return Ok(UpdateRecoveryWatchdogEvent::ReplacementExited);
        }
        if Utc::now() >= replacement.confirmation_deadline()? {
            return Ok(UpdateRecoveryWatchdogEvent::DeadlineExpired);
        }
    }
    if matches!(
        phase,
        UpdateRecoveryPhase::Prepared
            | UpdateRecoveryPhase::ReplacementStarted
            | UpdateRecoveryPhase::ReplacementInstalled
    ) && Utc::now() >= installation_deadline
    {
        return Ok(UpdateRecoveryWatchdogEvent::DeadlineExpired);
    }
    Ok(UpdateRecoveryWatchdogEvent::Observe)
}

fn require_monitored_replacement(
    replacement: Option<&mut MonitoredReplacement>,
) -> Result<&mut MonitoredReplacement, UpdateRecoveryWatchdogError> {
    replacement.ok_or(UpdateRecoveryWatchdogError::UnownedReplacement)
}

pub(super) fn persisted_deadline(
    started_at: &str,
    duration: Duration,
) -> Result<DateTime<Utc>, UpdateRecoveryWatchdogError> {
    let started_at = DateTime::parse_from_rfc3339(started_at)
        .map_err(|_| UpdateRecoveryError::InvalidState)?
        .with_timezone(&Utc);
    let duration =
        i64::try_from(duration.as_secs()).map_err(|_| UpdateRecoveryError::InvalidState)?;
    started_at
        .checked_add_signed(ChronoDuration::seconds(duration))
        .ok_or(UpdateRecoveryError::InvalidState.into())
}

enum MonitoredReplacement {
    Owned {
        child: Child,
        process: UpdateRecoveryReplacementProcess,
    },
    Inherited(UpdateRecoveryReplacementProcess),
}

impl MonitoredReplacement {
    fn process(&self) -> &UpdateRecoveryReplacementProcess {
        match self {
            Self::Owned { process, .. } | Self::Inherited(process) => process,
        }
    }

    fn confirmation_deadline(&self) -> Result<DateTime<Utc>, UpdateRecoveryWatchdogError> {
        DateTime::parse_from_rfc3339(self.process().confirmation_deadline())
            .map(|deadline| deadline.with_timezone(&Utc))
            .map_err(|_| UpdateRecoveryError::InvalidState.into())
    }

    fn is_running(
        &mut self,
        context: &UpdateRecoveryWatchdogContext,
    ) -> Result<bool, UpdateRecoveryWatchdogError> {
        if let Self::Owned { child, .. } = self {
            if child.try_wait()?.is_some() {
                return Ok(false);
            }
        }
        let executable = context
            .installed_application_path()
            .join("Contents/MacOS/fitfreed");
        update_recovery_process_is_running(self.process(), &executable).map_err(Into::into)
    }

    fn stop(
        &mut self,
        context: &UpdateRecoveryWatchdogContext,
    ) -> Result<(), UpdateRecoveryWatchdogError> {
        match self {
            Self::Owned { child, .. } => stop_child(child).map_err(Into::into),
            Self::Inherited(process) => {
                let executable = context
                    .installed_application_path()
                    .join("Contents/MacOS/fitfreed");
                stop_inherited_replacement(process, &executable)
            }
        }
    }
}

fn launch_application(
    application_path: &Path,
    recovery: Option<(&str, &str)>,
) -> Result<Child, UpdateRecoveryWatchdogError> {
    let executable = application_path.join("Contents/MacOS/fitfreed");
    let mut command = Command::new(executable);
    if let Some((recovery_id, launch_nonce)) = recovery {
        command
            .arg(UPDATE_RECOVERY_CANDIDATE_ARGUMENT)
            .arg(recovery_id)
            .arg(launch_nonce)
            .stdin(Stdio::piped());
    } else {
        command.stdin(Stdio::null());
    }
    command
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| UpdateRecoveryWatchdogError::ApplicationLaunch)
}

fn launch_replacement(
    context: &UpdateRecoveryWatchdogContext,
) -> Result<MonitoredReplacement, UpdateRecoveryWatchdogError> {
    let launch_nonce = generate_launch_nonce()?;
    let mut child = launch_application(
        context.installed_application_path(),
        Some((context.recovery_id(), &launch_nonce)),
    )?;
    let executable = context
        .installed_application_path()
        .join("Contents/MacOS/fitfreed");
    let process_identity = match observe_update_recovery_process(child.id(), &executable) {
        Ok(identity) => identity,
        Err(error) => {
            let _ = stop_child(&mut child);
            return Err(error.into());
        }
    };
    let confirmation_deadline = (Utc::now()
        + ChronoDuration::seconds(
            i64::try_from(REPLACEMENT_CONFIRMATION_TIMEOUT.as_secs())
                .map_err(|_| UpdateRecoveryWatchdogError::ApplicationLaunch)?,
        ))
    .to_rfc3339_opts(SecondsFormat::Secs, true);
    let process = match record_active_update_recovery_replacement_launch(
        context.recovery_root(),
        context.recovery_id(),
        UpdateRecoveryReplacementLaunch {
            process_id: child.id(),
            started_at_unix_seconds: process_identity.started_at_unix_seconds(),
            started_at_microseconds: process_identity.started_at_microseconds(),
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
    Ok(MonitoredReplacement::Owned { child, process })
}

pub fn await_update_recovery_candidate_go(
    recovery_id: &str,
    launch_nonce: &str,
    reader: impl Read + Send + 'static,
) -> Result<(), UpdateRecoveryWatchdogError> {
    match await_candidate_go(recovery_id, launch_nonce, reader) {
        Ok(()) => Ok(()),
        Err(CandidateGoError::Io(error)) => Err(error.into()),
        Err(CandidateGoError::InvalidRecord | CandidateGoError::Timeout) => {
            Err(UpdateRecoveryWatchdogError::Readiness)
        }
    }
}

pub(super) fn stop_child(child: &mut Child) -> io::Result<()> {
    if child.try_wait()?.is_none() {
        child.kill()?;
    }
    child.wait()?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn stop_inherited_replacement(
    process: &UpdateRecoveryReplacementProcess,
    executable: &Path,
) -> Result<(), UpdateRecoveryWatchdogError> {
    if !update_recovery_process_is_running(process, executable)? {
        return Ok(());
    }
    signal_inherited_replacement(process, executable, SIGTERM)?;
    let deadline = Instant::now() + PROCESS_STOP_TIMEOUT;
    while update_recovery_process_is_running(process, executable)? && Instant::now() < deadline {
        thread::sleep(POLL_INTERVAL);
    }
    if update_recovery_process_is_running(process, executable)? {
        signal_inherited_replacement(process, executable, SIGKILL)?;
        let deadline = Instant::now() + PROCESS_STOP_TIMEOUT;
        while update_recovery_process_is_running(process, executable)? && Instant::now() < deadline
        {
            thread::sleep(POLL_INTERVAL);
        }
    }
    if update_recovery_process_is_running(process, executable)? {
        return Err(io::Error::new(
            io::ErrorKind::TimedOut,
            "the inherited update candidate did not stop",
        )
        .into());
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn signal_inherited_replacement(
    process: &UpdateRecoveryReplacementProcess,
    executable: &Path,
    signal: i32,
) -> Result<(), UpdateRecoveryWatchdogError> {
    if !update_recovery_process_is_running(process, executable)? {
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

#[cfg(not(target_os = "macos"))]
fn stop_inherited_replacement(
    _process: &UpdateRecoveryReplacementProcess,
    _executable: &Path,
) -> Result<(), UpdateRecoveryWatchdogError> {
    Err(UpdateRecoveryError::UnsupportedPlatform.into())
}

#[cfg(unix)]
pub(super) fn original_parent_process_id() -> u32 {
    unsafe { getppid() as u32 }
}

#[cfg(not(unix))]
pub(super) fn original_parent_process_id() -> u32 {
    0
}

#[cfg(unix)]
pub(super) fn stop_original_parent(process_id: u32) -> Result<(), UpdateRecoveryWatchdogError> {
    stop_original_parent_with(
        process_id,
        original_parent_process_id,
        |process_id, signal| {
            if unsafe { kill(process_id, signal) } != 0 {
                let error = io::Error::last_os_error();
                if error.raw_os_error() != Some(ESRCH) {
                    return Err(error);
                }
            }
            Ok(())
        },
    )
}

#[cfg(unix)]
fn stop_original_parent_with(
    process_id: u32,
    observed_parent: impl Fn() -> u32,
    mut send_signal: impl FnMut(i32, i32) -> io::Result<()>,
) -> Result<(), UpdateRecoveryWatchdogError> {
    let process_id =
        i32::try_from(process_id).map_err(|_| UpdateRecoveryWatchdogError::Readiness)?;
    if process_id <= 1 {
        return Err(UpdateRecoveryWatchdogError::Readiness);
    }
    let still_parent = || observed_parent() == process_id as u32;
    if !still_parent() {
        return Ok(());
    }
    send_signal(process_id, SIGTERM)?;
    let deadline = Instant::now() + PROCESS_STOP_TIMEOUT;
    while still_parent() && Instant::now() < deadline {
        thread::sleep(POLL_INTERVAL);
    }
    if still_parent() {
        send_signal(process_id, SIGKILL)?;
        let deadline = Instant::now() + PROCESS_STOP_TIMEOUT;
        while still_parent() && Instant::now() < deadline {
            thread::sleep(POLL_INTERVAL);
        }
    }
    if still_parent() {
        return Err(io::Error::new(
            io::ErrorKind::TimedOut,
            "the original update process did not stop",
        )
        .into());
    }
    Ok(())
}

#[cfg(not(unix))]
pub(super) fn stop_original_parent(_process_id: u32) -> Result<(), UpdateRecoveryWatchdogError> {
    Err(UpdateRecoveryError::UnsupportedPlatform.into())
}

#[cfg(test)]
mod tests {
    use std::cell::Cell;

    use super::*;

    #[test]
    fn treats_a_launching_phase_without_an_owned_child_as_unsafe() {
        assert!(matches!(
            require_monitored_replacement(None),
            Err(UpdateRecoveryWatchdogError::UnownedReplacement)
        ));
    }

    #[test]
    fn derives_the_installation_deadline_from_persisted_preparation_time() {
        assert_eq!(
            persisted_deadline("2026-08-17T08:00:00Z", Duration::from_secs(900))
                .expect("persisted deadline")
                .to_rfc3339_opts(SecondsFormat::Secs, true),
            "2026-08-17T08:15:00Z"
        );
        assert!(persisted_deadline("not-an-instant", Duration::from_secs(900)).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn treats_reparenting_as_original_application_termination() {
        let observed_parent = Cell::new(42_u32);
        let signal_count = Cell::new(0_u8);

        stop_original_parent_with(
            42,
            || observed_parent.get(),
            |process_id, signal| {
                assert_eq!(process_id, 42);
                assert_eq!(signal, SIGTERM);
                signal_count.set(signal_count.get() + 1);
                observed_parent.set(1);
                Ok(())
            },
        )
        .expect("reparented watchdog");

        assert_eq!(signal_count.get(), 1);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn binds_process_start_identity_to_the_exact_executable() {
        let current_executable = std::env::current_exe().expect("current test executable");

        let identity = observe_update_recovery_process(std::process::id(), &current_executable)
            .expect("current process identity");

        assert!(identity.started_at_unix_seconds() > 0);
        assert!(identity.started_at_microseconds() <= 999_999);
        assert!(observe_update_recovery_process(std::process::id(), Path::new("/bin/sh")).is_err());
    }
}
