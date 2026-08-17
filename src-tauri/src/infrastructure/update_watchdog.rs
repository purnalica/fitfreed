use std::{
    io::{self, BufRead, BufReader, Read, Write},
    path::Path,
    process::{Child, Command, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, Instant},
};

use fitfreed_application::{
    decide_update_recovery_watchdog_action, UpdateRecoveryPhase, UpdateRecoveryWatchdogAction,
    UpdateRecoveryWatchdogEvent,
};
use thiserror::Error;

use super::{
    active_update_recovery_phase, resolve_update_recovery_watchdog_context,
    restore_active_update_recovery, transition_active_update_recovery, PlatformApplicationCopier,
    PreparedUpdateRecovery, UpdateRecoveryError, UpdateRecoveryRestoration,
    UpdateRecoveryWatchdogContext,
};

pub const UPDATE_RECOVERY_WATCHDOG_ARGUMENT: &str = "--fitfreed-update-recovery-watchdog";
pub const UPDATE_RECOVERY_CANDIDATE_ARGUMENT: &str = "--fitfreed-update-recovery-candidate";

const WATCHDOG_READY_PREFIX: &str = "FITFREED-UPDATE-WATCHDOG-READY ";
const WATCHDOG_READY_TIMEOUT: Duration = Duration::from_secs(10);
const INSTALLATION_TIMEOUT: Duration = Duration::from_secs(15 * 60);
const REPLACEMENT_CONFIRMATION_TIMEOUT: Duration = Duration::from_secs(60);
const PROCESS_STOP_TIMEOUT: Duration = Duration::from_secs(5);
const POLL_INTERVAL: Duration = Duration::from_millis(100);
const RESTORATION_RETRY_INTERVAL: Duration = Duration::from_millis(250);
const MAX_RESTORATION_ATTEMPTS: u8 = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UpdateRecoveryWatchdogOutcome {
    Confirmed,
    Recovered,
    StoppedBeforeReplacement,
}

#[derive(Debug, Error)]
pub enum UpdateRecoveryWatchdogError {
    #[error("update recovery watchdog input/output failure: {0}")]
    Io(#[from] io::Error),
    #[error("update recovery watchdog state failure: {0}")]
    Recovery(#[from] UpdateRecoveryError),
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
}

pub struct StartedUpdateRecoveryWatchdog {
    child: Child,
}

impl StartedUpdateRecoveryWatchdog {
    pub fn process_id(&self) -> u32 {
        self.child.id()
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

fn read_watchdog_readiness(reader: impl Read, expected_process_id: u32) -> io::Result<bool> {
    let mut line = String::new();
    BufReader::new(reader).take(128).read_line(&mut line)?;
    Ok(line == format!("{WATCHDOG_READY_PREFIX}{expected_process_id}\n"))
}

pub fn run_update_recovery_watchdog(
    watchdog_executable: &Path,
    installed_application_path: &Path,
    readiness: &mut impl Write,
) -> Result<UpdateRecoveryWatchdogOutcome, UpdateRecoveryWatchdogError> {
    let context =
        resolve_update_recovery_watchdog_context(watchdog_executable, installed_application_path)?;
    let initial_phase = active_phase(&context)?;
    if initial_phase != UpdateRecoveryPhase::Prepared {
        return Err(UpdateRecoveryWatchdogError::UnownedReplacement);
    }
    writeln!(readiness, "{WATCHDOG_READY_PREFIX}{}", std::process::id())?;
    readiness.flush()?;

    let original_parent = original_parent_process_id();
    let installation_deadline = Instant::now() + INSTALLATION_TIMEOUT;
    let mut confirmation_deadline = None;
    let mut replacement = None;
    let mut restoration_attempts = 0_u8;

    loop {
        let phase = active_phase(&context)?;
        let event = watchdog_event(
            phase,
            replacement.as_mut(),
            installation_deadline,
            confirmation_deadline,
        )?;
        match decide_update_recovery_watchdog_action(phase, event) {
            UpdateRecoveryWatchdogAction::Wait => thread::sleep(POLL_INTERVAL),
            UpdateRecoveryWatchdogAction::LaunchReplacement => {
                transition_active_update_recovery(
                    context.recovery_root(),
                    context.recovery_id(),
                    UpdateRecoveryPhase::Launching,
                )?;
                match launch_application(
                    context.installed_application_path(),
                    Some(context.recovery_id()),
                ) {
                    Ok(child) => {
                        replacement = Some(child);
                        confirmation_deadline =
                            Some(Instant::now() + REPLACEMENT_CONFIRMATION_TIMEOUT);
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
                        if let Some(mut child) = replacement.take() {
                            stop_child(&mut child)?;
                        }
                    }
                    Err(UpdateRecoveryError::InvalidTransition) => continue,
                    Err(error) => return Err(error.into()),
                }
            }
            UpdateRecoveryWatchdogAction::RestorePrevious => {
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
                return Ok(UpdateRecoveryWatchdogOutcome::StoppedBeforeReplacement);
            }
            UpdateRecoveryWatchdogAction::FinishConfirmed => {
                return Ok(UpdateRecoveryWatchdogOutcome::Confirmed);
            }
            UpdateRecoveryWatchdogAction::FinishRecovered => {
                launch_application(context.installed_application_path(), None)?;
                return Ok(UpdateRecoveryWatchdogOutcome::Recovered);
            }
            UpdateRecoveryWatchdogAction::FinishFailed => {
                return Err(UpdateRecoveryWatchdogError::TerminalFailure);
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
    replacement: Option<&mut Child>,
    installation_deadline: Instant,
    confirmation_deadline: Option<Instant>,
) -> Result<UpdateRecoveryWatchdogEvent, UpdateRecoveryWatchdogError> {
    if phase == UpdateRecoveryPhase::Launching {
        let Some(replacement) = replacement else {
            return Err(UpdateRecoveryWatchdogError::UnownedReplacement);
        };
        if replacement.try_wait()?.is_some() {
            return Ok(UpdateRecoveryWatchdogEvent::ReplacementExited);
        }
        if confirmation_deadline.is_some_and(|deadline| Instant::now() >= deadline) {
            return Ok(UpdateRecoveryWatchdogEvent::DeadlineExpired);
        }
    }
    if matches!(
        phase,
        UpdateRecoveryPhase::Prepared | UpdateRecoveryPhase::ReplacementStarted
    ) && Instant::now() >= installation_deadline
    {
        return Ok(UpdateRecoveryWatchdogEvent::DeadlineExpired);
    }
    Ok(UpdateRecoveryWatchdogEvent::Observe)
}

fn launch_application(
    application_path: &Path,
    recovery_id: Option<&str>,
) -> Result<Child, UpdateRecoveryWatchdogError> {
    let executable = application_path.join("Contents/MacOS/fitfreed");
    let mut command = Command::new(executable);
    if let Some(recovery_id) = recovery_id {
        command
            .arg(UPDATE_RECOVERY_CANDIDATE_ARGUMENT)
            .arg(recovery_id);
    }
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| UpdateRecoveryWatchdogError::ApplicationLaunch)
}

fn stop_child(child: &mut Child) -> io::Result<()> {
    if child.try_wait()?.is_none() {
        child.kill()?;
    }
    child.wait()?;
    Ok(())
}

#[cfg(unix)]
fn original_parent_process_id() -> u32 {
    unsafe { libc::getppid() as u32 }
}

#[cfg(not(unix))]
fn original_parent_process_id() -> u32 {
    0
}

#[cfg(unix)]
fn stop_original_parent(process_id: u32) -> Result<(), UpdateRecoveryWatchdogError> {
    let process_id =
        i32::try_from(process_id).map_err(|_| UpdateRecoveryWatchdogError::Readiness)?;
    if process_id <= 1 {
        return Err(UpdateRecoveryWatchdogError::Readiness);
    }
    if original_parent_process_id() != process_id as u32 {
        return Ok(());
    }
    if unsafe { libc::kill(process_id, libc::SIGTERM) } != 0 {
        let error = io::Error::last_os_error();
        if error.kind() != io::ErrorKind::NotFound {
            return Err(error.into());
        }
    }
    let deadline = Instant::now() + PROCESS_STOP_TIMEOUT;
    while process_is_running(process_id) && Instant::now() < deadline {
        thread::sleep(POLL_INTERVAL);
    }
    if process_is_running(process_id) {
        if unsafe { libc::kill(process_id, libc::SIGKILL) } != 0 {
            return Err(io::Error::last_os_error().into());
        }
        let deadline = Instant::now() + PROCESS_STOP_TIMEOUT;
        while process_is_running(process_id) && Instant::now() < deadline {
            thread::sleep(POLL_INTERVAL);
        }
    }
    if process_is_running(process_id) {
        return Err(io::Error::new(
            io::ErrorKind::TimedOut,
            "the original update process did not stop",
        )
        .into());
    }
    Ok(())
}

#[cfg(unix)]
fn process_is_running(process_id: i32) -> bool {
    unsafe { libc::kill(process_id, 0) == 0 }
}

#[cfg(not(unix))]
fn stop_original_parent(_process_id: u32) -> Result<(), UpdateRecoveryWatchdogError> {
    Err(UpdateRecoveryError::UnsupportedPlatform.into())
}

#[cfg(test)]
mod tests {
    use std::io::Cursor;

    use super::*;

    #[test]
    fn bounds_and_matches_the_exact_watchdog_readiness_record() {
        let process_id = 42_u32;

        assert!(read_watchdog_readiness(
            Cursor::new(format!("{WATCHDOG_READY_PREFIX}{process_id}\nignored")),
            process_id,
        )
        .expect("matching readiness"));
        assert!(!read_watchdog_readiness(
            Cursor::new(format!("{WATCHDOG_READY_PREFIX}43\n")),
            process_id,
        )
        .expect("mismatched readiness"));
        assert!(!read_watchdog_readiness(
            Cursor::new(format!(
                "{WATCHDOG_READY_PREFIX}{process_id}{}\n",
                "x".repeat(128)
            )),
            process_id,
        )
        .expect("bounded readiness"));
    }

    #[test]
    fn treats_a_launching_phase_without_an_owned_child_as_unsafe() {
        assert!(matches!(
            watchdog_event(
                UpdateRecoveryPhase::Launching,
                None,
                Instant::now() + Duration::from_secs(1),
                Some(Instant::now() + Duration::from_secs(1)),
            ),
            Err(UpdateRecoveryWatchdogError::UnownedReplacement)
        ));
    }
}
