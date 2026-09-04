use std::path::{Path, PathBuf};

#[cfg(all(target_os = "linux", feature = "e2e"))]
use std::{
    env, fs, io, thread,
    time::{Duration, Instant},
};

#[cfg(target_os = "macos")]
use fitfreed_application::{UpdateInstallationAuthorization, UpdateRecoveryPhase};
use thiserror::Error;

#[cfg(target_os = "linux")]
use super::{
    discard_prepared_linux_update_recovery, install_linux_candidate_package,
    prepare_linux_update_recovery, start_linux_update_recovery_watchdog,
    transition_active_linux_update_recovery, LinuxRecoveryStateError, LinuxUpdateRecoveryError,
    LinuxUpdateRecoveryPreparation, PreparedLinuxUpdateRecovery,
    StartedLinuxUpdateRecoveryWatchdog,
};
#[cfg(target_os = "macos")]
use super::{
    discard_prepared_update_recovery, prepare_update_recovery, start_update_recovery_watchdog,
    transition_active_update_recovery, ApplicationCopyPort, PlatformApplicationCopier,
    PreparedUpdateRecovery, StartedUpdateRecoveryWatchdog, UpdateRecoveryPreparation,
};
#[cfg(target_os = "windows")]
use super::{
    discard_prepared_windows_update_recovery, prepare_windows_update_recovery,
    start_windows_update_recovery_watchdog, transition_active_windows_update_recovery,
    WindowsUpdateRecoveryPreparation,
};
#[cfg(any(test, target_os = "windows"))]
use super::{
    PreparedWindowsUpdateRecovery, StartedWindowsUpdateRecoveryWatchdog, WindowsRecoveryStateError,
};
use super::{
    UpdatePackageError, UpdateRecoveryError, UpdateRecoveryWatchdogError,
    VerifiedPredecessorPackage, VerifiedUpdatePackage,
};
#[cfg(any(test, target_os = "linux", target_os = "windows"))]
use fitfreed_application::PackagedUpdateRecoveryPhase;

#[derive(Debug, Error)]
pub enum UpdateInstallationError {
    #[error("update recovery preparation or transition failed: {0}")]
    Recovery(#[from] UpdateRecoveryError),
    #[error("the update recovery watchdog failed: {0}")]
    Watchdog(#[from] UpdateRecoveryWatchdogError),
    #[error("the verified update package could not be installed: {0}")]
    Package(#[from] UpdatePackageError),
    #[cfg(target_os = "linux")]
    #[error("the Linux update recovery transition failed: {0}")]
    LinuxRecovery(#[from] LinuxRecoveryStateError),
    #[cfg(target_os = "linux")]
    #[error("the Linux native package operation failed: {0}")]
    LinuxNative(#[from] LinuxUpdateRecoveryError),
    #[cfg(any(test, target_os = "windows"))]
    #[error("the Windows update recovery transition failed: {0}")]
    WindowsRecovery(#[from] WindowsRecoveryStateError),
}

pub struct UpdateInstallationRequest {
    pub recovery_root: PathBuf,
    pub current_application_path: PathBuf,
    pub library_path: PathBuf,
    pub installed_version: String,
    pub prepared_at: String,
}

pub fn install_verified_update(
    package: &VerifiedUpdatePackage,
    predecessor: Option<&VerifiedPredecessorPackage>,
    request: UpdateInstallationRequest,
) -> Result<(), UpdateInstallationError> {
    #[cfg(target_os = "linux")]
    {
        coordinate_linux_update_installation(
            &LinuxPlatformInstallationPort,
            package,
            predecessor.ok_or(UpdatePackageError::InvalidAuthorization)?,
            request,
        )
    }

    #[cfg(target_os = "windows")]
    {
        coordinate_windows_update_installation(
            &WindowsPlatformInstallationPort,
            package,
            predecessor.ok_or(UpdatePackageError::InvalidAuthorization)?,
            request,
        )
    }

    #[cfg(target_os = "macos")]
    {
        let _ = predecessor;
        coordinate_update_installation(
            &PlatformApplicationCopier,
            &PlatformWatchdogLauncher,
            package,
            request,
        )
    }
}

#[cfg(target_os = "linux")]
trait LinuxWatchdogHandle {
    fn stop(self) -> Result<(), UpdateRecoveryWatchdogError>;
}

#[cfg(target_os = "linux")]
impl LinuxWatchdogHandle for StartedLinuxUpdateRecoveryWatchdog {
    fn stop(self) -> Result<(), UpdateRecoveryWatchdogError> {
        StartedLinuxUpdateRecoveryWatchdog::stop(self)
    }
}

#[cfg(target_os = "linux")]
trait LinuxInstallationPort {
    type Handle: LinuxWatchdogHandle;

    fn start_watchdog(
        &self,
        prepared: &PreparedLinuxUpdateRecovery,
        installed_executable_path: &Path,
    ) -> Result<Self::Handle, UpdateRecoveryWatchdogError>;

    fn transition(
        &self,
        recovery_root: &Path,
        recovery_id: &str,
        phase: PackagedUpdateRecoveryPhase,
    ) -> Result<(), LinuxRecoveryStateError>;

    fn discard(
        &self,
        recovery_root: &Path,
        recovery_id: &str,
    ) -> Result<(), LinuxRecoveryStateError>;

    fn install_candidate(
        &self,
        attempt_directory: &Path,
        expected_version: &str,
    ) -> Result<(), LinuxUpdateRecoveryError>;
}

#[cfg(target_os = "linux")]
struct LinuxPlatformInstallationPort;

#[cfg(target_os = "linux")]
impl LinuxInstallationPort for LinuxPlatformInstallationPort {
    type Handle = StartedLinuxUpdateRecoveryWatchdog;

    fn start_watchdog(
        &self,
        prepared: &PreparedLinuxUpdateRecovery,
        installed_executable_path: &Path,
    ) -> Result<Self::Handle, UpdateRecoveryWatchdogError> {
        start_linux_update_recovery_watchdog(prepared, installed_executable_path)
    }

    fn transition(
        &self,
        recovery_root: &Path,
        recovery_id: &str,
        phase: PackagedUpdateRecoveryPhase,
    ) -> Result<(), LinuxRecoveryStateError> {
        transition_active_linux_update_recovery(recovery_root, recovery_id, phase)
    }

    fn discard(
        &self,
        recovery_root: &Path,
        recovery_id: &str,
    ) -> Result<(), LinuxRecoveryStateError> {
        discard_prepared_linux_update_recovery(recovery_root, recovery_id)
    }

    fn install_candidate(
        &self,
        attempt_directory: &Path,
        expected_version: &str,
    ) -> Result<(), LinuxUpdateRecoveryError> {
        install_linux_candidate_package(attempt_directory, expected_version).map(|_| ())
    }
}

#[cfg(target_os = "linux")]
fn coordinate_linux_update_installation(
    installation: &impl LinuxInstallationPort,
    package: &VerifiedUpdatePackage,
    predecessor: &VerifiedPredecessorPackage,
    request: UpdateInstallationRequest,
) -> Result<(), UpdateInstallationError> {
    let prepared = prepare_linux_update_recovery(LinuxUpdateRecoveryPreparation {
        recovery_root: &request.recovery_root,
        library_path: &request.library_path,
        installed_version: &request.installed_version,
        prepared_at: &request.prepared_at,
        authorization: package.authorization(),
        predecessor_package_path: predecessor.path(),
        candidate_package_bytes: package.bytes(),
    })?;
    coordinate_prepared_linux_update_installation(
        installation,
        &prepared,
        package.version(),
        &request.recovery_root,
        &request.current_application_path,
    )
}

#[cfg(target_os = "linux")]
fn coordinate_prepared_linux_update_installation(
    installation: &impl LinuxInstallationPort,
    prepared: &PreparedLinuxUpdateRecovery,
    candidate_version: &str,
    recovery_root: &Path,
    current_application_path: &Path,
) -> Result<(), UpdateInstallationError> {
    let watchdog = match installation.start_watchdog(prepared, current_application_path) {
        Ok(watchdog) => watchdog,
        Err(error) => {
            installation.discard(recovery_root, prepared.recovery_id())?;
            return Err(error.into());
        }
    };
    if let Err(error) = installation.transition(
        recovery_root,
        prepared.recovery_id(),
        PackagedUpdateRecoveryPhase::ReplacementStarted,
    ) {
        watchdog.stop()?;
        installation.discard(recovery_root, prepared.recovery_id())?;
        return Err(error.into());
    }
    #[cfg(feature = "e2e")]
    if let Err(error) = wait_for_linux_update_e2e_interruption() {
        installation.transition(
            recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::Recovering,
        )?;
        return Err(error.into());
    }
    if let Err(error) =
        installation.install_candidate(prepared.attempt_directory(), candidate_version)
    {
        installation.transition(
            recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::Recovering,
        )?;
        return Err(error.into());
    }
    if let Err(error) = installation.transition(
        recovery_root,
        prepared.recovery_id(),
        PackagedUpdateRecoveryPhase::ReplacementInstalled,
    ) {
        installation.transition(
            recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::Recovering,
        )?;
        return Err(error.into());
    }
    Ok(())
}

#[cfg(all(target_os = "linux", feature = "e2e"))]
fn wait_for_linux_update_e2e_interruption() -> Result<(), LinuxUpdateRecoveryError> {
    const READY: &str = "FITFREED_E2E_LINUX_UPDATE_INTERRUPTION_READY";
    const CONTINUE: &str = "FITFREED_E2E_LINUX_UPDATE_INTERRUPTION_CONTINUE";
    const TIMEOUT: Duration = Duration::from_secs(120);

    let ready = env::var_os(READY).map(PathBuf::from);
    let continue_ = env::var_os(CONTINUE).map(PathBuf::from);
    let (Some(ready), Some(continue_)) = (ready, continue_) else {
        if env::var_os(READY).is_some() || env::var_os(CONTINUE).is_some() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "Linux update E2E interruption markers are incomplete",
            )
            .into());
        }
        return Ok(());
    };
    if !ready.is_absolute() || !continue_.is_absolute() || ready == continue_ {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Linux update E2E interruption markers are invalid",
        )
        .into());
    }
    fs::write(&ready, b"ready\n")?;
    let deadline = Instant::now() + TIMEOUT;
    while !continue_.is_file() {
        if Instant::now() >= deadline {
            return Err(io::Error::new(
                io::ErrorKind::TimedOut,
                "Linux update E2E interruption was not released",
            )
            .into());
        }
        thread::sleep(Duration::from_millis(25));
    }
    Ok(())
}

#[cfg(all(test, target_os = "linux"))]
mod linux_tests {
    use std::{cell::RefCell, rc::Rc};

    use tempfile::TempDir;

    use super::*;

    #[derive(Clone, Copy)]
    enum Failure {
        None,
        Watchdog,
        ReplacementStarted,
        CandidateInstallation,
        ReplacementInstalled,
    }

    struct SyntheticWatchdog {
        events: Rc<RefCell<Vec<String>>>,
    }

    impl LinuxWatchdogHandle for SyntheticWatchdog {
        fn stop(self) -> Result<(), UpdateRecoveryWatchdogError> {
            self.events.borrow_mut().push("stop-watchdog".to_owned());
            Ok(())
        }
    }

    struct SyntheticLinuxInstallation {
        failure: Failure,
        events: Rc<RefCell<Vec<String>>>,
    }

    impl SyntheticLinuxInstallation {
        fn new(failure: Failure) -> Self {
            Self {
                failure,
                events: Rc::new(RefCell::new(Vec::new())),
            }
        }

        fn events(&self) -> Vec<String> {
            self.events.borrow().clone()
        }
    }

    impl LinuxInstallationPort for SyntheticLinuxInstallation {
        type Handle = SyntheticWatchdog;

        fn start_watchdog(
            &self,
            _prepared: &PreparedLinuxUpdateRecovery,
            _installed_executable_path: &Path,
        ) -> Result<Self::Handle, UpdateRecoveryWatchdogError> {
            self.events.borrow_mut().push("start-watchdog".to_owned());
            if matches!(self.failure, Failure::Watchdog) {
                return Err(UpdateRecoveryWatchdogError::Readiness);
            }
            Ok(SyntheticWatchdog {
                events: Rc::clone(&self.events),
            })
        }

        fn transition(
            &self,
            _recovery_root: &Path,
            _recovery_id: &str,
            phase: PackagedUpdateRecoveryPhase,
        ) -> Result<(), LinuxRecoveryStateError> {
            self.events
                .borrow_mut()
                .push(format!("transition-{phase:?}"));
            if matches!(
                (self.failure, phase),
                (
                    Failure::ReplacementStarted,
                    PackagedUpdateRecoveryPhase::ReplacementStarted
                ) | (
                    Failure::ReplacementInstalled,
                    PackagedUpdateRecoveryPhase::ReplacementInstalled
                )
            ) {
                return Err(LinuxRecoveryStateError::InvalidTransition);
            }
            Ok(())
        }

        fn discard(
            &self,
            _recovery_root: &Path,
            _recovery_id: &str,
        ) -> Result<(), LinuxRecoveryStateError> {
            self.events.borrow_mut().push("discard".to_owned());
            Ok(())
        }

        fn install_candidate(
            &self,
            _attempt_directory: &Path,
            _expected_version: &str,
        ) -> Result<(), LinuxUpdateRecoveryError> {
            self.events
                .borrow_mut()
                .push("install-candidate".to_owned());
            if matches!(self.failure, Failure::CandidateInstallation) {
                return Err(LinuxUpdateRecoveryError::NativeInstallationFailed);
            }
            Ok(())
        }
    }

    fn prepared(directory: &TempDir) -> PreparedLinuxUpdateRecovery {
        PreparedLinuxUpdateRecovery::for_test("a".repeat(64), directory.path().join("attempt"))
    }

    fn coordinate(
        installation: &SyntheticLinuxInstallation,
        prepared: &PreparedLinuxUpdateRecovery,
    ) -> Result<(), UpdateInstallationError> {
        coordinate_prepared_linux_update_installation(
            installation,
            prepared,
            "0.2.0",
            Path::new("/recovery"),
            Path::new("/usr/bin/fitfreed"),
        )
    }

    #[test]
    fn orders_watchdog_transition_native_installation_and_handoff() {
        let directory = TempDir::new().expect("temporary directory");
        let installation = SyntheticLinuxInstallation::new(Failure::None);

        coordinate(&installation, &prepared(&directory)).expect("coordinated installation");

        assert_eq!(
            installation.events(),
            [
                "start-watchdog",
                "transition-ReplacementStarted",
                "install-candidate",
                "transition-ReplacementInstalled",
            ]
        );
    }

    #[test]
    fn discards_only_before_replacement_and_stops_a_started_watchdog() {
        let directory = TempDir::new().expect("temporary directory");
        let watchdog_failure = SyntheticLinuxInstallation::new(Failure::Watchdog);
        assert!(matches!(
            coordinate(&watchdog_failure, &prepared(&directory)),
            Err(UpdateInstallationError::Watchdog(_))
        ));
        assert_eq!(watchdog_failure.events(), ["start-watchdog", "discard"]);

        let transition_failure = SyntheticLinuxInstallation::new(Failure::ReplacementStarted);
        assert!(matches!(
            coordinate(&transition_failure, &prepared(&directory)),
            Err(UpdateInstallationError::LinuxRecovery(_))
        ));
        assert_eq!(
            transition_failure.events(),
            [
                "start-watchdog",
                "transition-ReplacementStarted",
                "stop-watchdog",
                "discard",
            ]
        );
    }

    #[test]
    fn hands_every_post_replacement_failure_to_the_recovery_lifecycle() {
        let directory = TempDir::new().expect("temporary directory");
        let native_failure = SyntheticLinuxInstallation::new(Failure::CandidateInstallation);
        assert!(matches!(
            coordinate(&native_failure, &prepared(&directory)),
            Err(UpdateInstallationError::LinuxNative(_))
        ));
        assert_eq!(
            native_failure.events(),
            [
                "start-watchdog",
                "transition-ReplacementStarted",
                "install-candidate",
                "transition-Recovering",
            ]
        );

        let handoff_failure = SyntheticLinuxInstallation::new(Failure::ReplacementInstalled);
        assert!(matches!(
            coordinate(&handoff_failure, &prepared(&directory)),
            Err(UpdateInstallationError::LinuxRecovery(_))
        ));
        assert_eq!(
            handoff_failure.events(),
            [
                "start-watchdog",
                "transition-ReplacementStarted",
                "install-candidate",
                "transition-ReplacementInstalled",
                "transition-Recovering",
            ]
        );
    }
}

#[cfg(any(test, target_os = "windows"))]
trait WindowsWatchdogHandle {
    fn stop(self) -> Result<(), UpdateRecoveryWatchdogError>;
}

#[cfg(any(test, target_os = "windows"))]
impl WindowsWatchdogHandle for StartedWindowsUpdateRecoveryWatchdog {
    fn stop(self) -> Result<(), UpdateRecoveryWatchdogError> {
        StartedWindowsUpdateRecoveryWatchdog::stop(self)
    }
}

#[cfg(any(test, target_os = "windows"))]
trait WindowsInstallationPort {
    type Handle: WindowsWatchdogHandle;

    fn start_watchdog(
        &self,
        prepared: &PreparedWindowsUpdateRecovery,
        installed_executable_path: &Path,
    ) -> Result<Self::Handle, UpdateRecoveryWatchdogError>;

    fn transition(
        &self,
        recovery_root: &Path,
        recovery_id: &str,
        phase: PackagedUpdateRecoveryPhase,
    ) -> Result<(), WindowsRecoveryStateError>;

    fn discard(
        &self,
        recovery_root: &Path,
        recovery_id: &str,
    ) -> Result<(), WindowsRecoveryStateError>;
}

#[cfg(target_os = "windows")]
struct WindowsPlatformInstallationPort;

#[cfg(target_os = "windows")]
impl WindowsInstallationPort for WindowsPlatformInstallationPort {
    type Handle = StartedWindowsUpdateRecoveryWatchdog;

    fn start_watchdog(
        &self,
        prepared: &PreparedWindowsUpdateRecovery,
        installed_executable_path: &Path,
    ) -> Result<Self::Handle, UpdateRecoveryWatchdogError> {
        start_windows_update_recovery_watchdog(prepared, installed_executable_path)
    }

    fn transition(
        &self,
        recovery_root: &Path,
        recovery_id: &str,
        phase: PackagedUpdateRecoveryPhase,
    ) -> Result<(), WindowsRecoveryStateError> {
        transition_active_windows_update_recovery(recovery_root, recovery_id, phase)
    }

    fn discard(
        &self,
        recovery_root: &Path,
        recovery_id: &str,
    ) -> Result<(), WindowsRecoveryStateError> {
        discard_prepared_windows_update_recovery(recovery_root, recovery_id)
    }
}

#[cfg(target_os = "windows")]
fn coordinate_windows_update_installation(
    installation: &impl WindowsInstallationPort,
    package: &VerifiedUpdatePackage,
    predecessor: &VerifiedPredecessorPackage,
    request: UpdateInstallationRequest,
) -> Result<(), UpdateInstallationError> {
    let prepared = prepare_windows_update_recovery(WindowsUpdateRecoveryPreparation {
        recovery_root: &request.recovery_root,
        library_path: &request.library_path,
        installed_version: &request.installed_version,
        prepared_at: &request.prepared_at,
        authorization: package.authorization(),
        predecessor_package_path: predecessor.path(),
        candidate_package_bytes: package.bytes(),
    })?;
    coordinate_prepared_windows_update_installation(
        installation,
        &prepared,
        &request.recovery_root,
        &request.current_application_path,
    )
}

#[cfg(any(test, target_os = "windows"))]
fn coordinate_prepared_windows_update_installation(
    installation: &impl WindowsInstallationPort,
    prepared: &PreparedWindowsUpdateRecovery,
    recovery_root: &Path,
    current_application_path: &Path,
) -> Result<(), UpdateInstallationError> {
    let watchdog = match installation.start_watchdog(prepared, current_application_path) {
        Ok(watchdog) => watchdog,
        Err(error) => {
            installation.discard(recovery_root, prepared.recovery_id())?;
            return Err(error.into());
        }
    };
    if let Err(error) = installation.transition(
        recovery_root,
        prepared.recovery_id(),
        PackagedUpdateRecoveryPhase::ReplacementStarted,
    ) {
        watchdog.stop()?;
        installation.discard(recovery_root, prepared.recovery_id())?;
        return Err(error.into());
    }
    Ok(())
}

#[cfg(test)]
mod windows_tests {
    use std::{cell::RefCell, rc::Rc};

    use tempfile::TempDir;

    use super::*;

    #[derive(Clone, Copy)]
    enum Failure {
        None,
        Watchdog,
        ReplacementStarted,
    }

    struct SyntheticWindowsWatchdog {
        events: Rc<RefCell<Vec<String>>>,
    }

    impl WindowsWatchdogHandle for SyntheticWindowsWatchdog {
        fn stop(self) -> Result<(), UpdateRecoveryWatchdogError> {
            self.events.borrow_mut().push("stop-watchdog".to_owned());
            Ok(())
        }
    }

    struct SyntheticWindowsInstallation {
        failure: Failure,
        events: Rc<RefCell<Vec<String>>>,
    }

    impl SyntheticWindowsInstallation {
        fn new(failure: Failure) -> Self {
            Self {
                failure,
                events: Rc::new(RefCell::new(Vec::new())),
            }
        }

        fn events(&self) -> Vec<String> {
            self.events.borrow().clone()
        }
    }

    impl WindowsInstallationPort for SyntheticWindowsInstallation {
        type Handle = SyntheticWindowsWatchdog;

        fn start_watchdog(
            &self,
            _prepared: &PreparedWindowsUpdateRecovery,
            _installed_executable_path: &Path,
        ) -> Result<Self::Handle, UpdateRecoveryWatchdogError> {
            self.events.borrow_mut().push("start-watchdog".to_owned());
            if matches!(self.failure, Failure::Watchdog) {
                return Err(UpdateRecoveryWatchdogError::Readiness);
            }
            Ok(SyntheticWindowsWatchdog {
                events: Rc::clone(&self.events),
            })
        }

        fn transition(
            &self,
            _recovery_root: &Path,
            _recovery_id: &str,
            phase: PackagedUpdateRecoveryPhase,
        ) -> Result<(), WindowsRecoveryStateError> {
            self.events
                .borrow_mut()
                .push(format!("transition-{phase:?}"));
            if matches!(self.failure, Failure::ReplacementStarted) {
                return Err(WindowsRecoveryStateError::InvalidTransition);
            }
            Ok(())
        }

        fn discard(
            &self,
            _recovery_root: &Path,
            _recovery_id: &str,
        ) -> Result<(), WindowsRecoveryStateError> {
            self.events.borrow_mut().push("discard".to_owned());
            Ok(())
        }
    }

    fn prepared(directory: &TempDir) -> PreparedWindowsUpdateRecovery {
        PreparedWindowsUpdateRecovery::for_test("a".repeat(64), directory.path().join("attempt"))
    }

    fn coordinate(
        installation: &SyntheticWindowsInstallation,
        prepared: &PreparedWindowsUpdateRecovery,
    ) -> Result<(), UpdateInstallationError> {
        coordinate_prepared_windows_update_installation(
            installation,
            prepared,
            Path::new("C:\\Users\\person\\AppData\\Roaming\\org.fitfreed.desktop\\update-recovery"),
            Path::new("C:\\Users\\person\\AppData\\Local\\FitFreed\\fitfreed.exe"),
        )
    }

    #[test]
    fn hands_windows_installation_to_a_ready_watchdog() {
        let directory = TempDir::new().expect("temporary directory");
        let installation = SyntheticWindowsInstallation::new(Failure::None);

        coordinate(&installation, &prepared(&directory)).expect("coordinated installation");

        assert_eq!(
            installation.events(),
            ["start-watchdog", "transition-ReplacementStarted"]
        );
    }

    #[test]
    fn discards_windows_recovery_when_the_watchdog_never_becomes_ready() {
        let directory = TempDir::new().expect("temporary directory");
        let installation = SyntheticWindowsInstallation::new(Failure::Watchdog);

        assert!(matches!(
            coordinate(&installation, &prepared(&directory)),
            Err(UpdateInstallationError::Watchdog(_))
        ));
        assert_eq!(installation.events(), ["start-watchdog", "discard"]);
    }

    #[test]
    fn stops_the_windows_watchdog_before_discarding_a_failed_handoff() {
        let directory = TempDir::new().expect("temporary directory");
        let installation = SyntheticWindowsInstallation::new(Failure::ReplacementStarted);

        assert!(matches!(
            coordinate(&installation, &prepared(&directory)),
            Err(UpdateInstallationError::WindowsRecovery(_))
        ));
        assert_eq!(
            installation.events(),
            [
                "start-watchdog",
                "transition-ReplacementStarted",
                "stop-watchdog",
                "discard",
            ]
        );
    }
}

#[cfg(target_os = "macos")]
trait NativeUpdatePackage {
    fn authorization(&self) -> &UpdateInstallationAuthorization;
    fn install(&self) -> Result<(), UpdatePackageError>;
}

#[cfg(target_os = "macos")]
impl NativeUpdatePackage for VerifiedUpdatePackage {
    fn authorization(&self) -> &UpdateInstallationAuthorization {
        VerifiedUpdatePackage::authorization(self)
    }

    fn install(&self) -> Result<(), UpdatePackageError> {
        VerifiedUpdatePackage::install(self)
    }
}

#[cfg(target_os = "macos")]
trait WatchdogHandle {
    fn stop(self) -> Result<(), UpdateRecoveryWatchdogError>;
}

#[cfg(target_os = "macos")]
impl WatchdogHandle for StartedUpdateRecoveryWatchdog {
    fn stop(self) -> Result<(), UpdateRecoveryWatchdogError> {
        StartedUpdateRecoveryWatchdog::stop(self)
    }
}

#[cfg(target_os = "macos")]
trait WatchdogLauncher {
    type Handle: WatchdogHandle;

    fn start(
        &self,
        prepared: &PreparedUpdateRecovery,
        installed_application_path: &Path,
    ) -> Result<Self::Handle, UpdateRecoveryWatchdogError>;
}

#[cfg(target_os = "macos")]
struct PlatformWatchdogLauncher;

#[cfg(target_os = "macos")]
impl WatchdogLauncher for PlatformWatchdogLauncher {
    type Handle = StartedUpdateRecoveryWatchdog;

    fn start(
        &self,
        prepared: &PreparedUpdateRecovery,
        installed_application_path: &Path,
    ) -> Result<Self::Handle, UpdateRecoveryWatchdogError> {
        start_update_recovery_watchdog(prepared, installed_application_path)
    }
}

#[cfg(target_os = "macos")]
fn coordinate_update_installation<C, W, P>(
    copier: &C,
    watchdog_launcher: &W,
    package: &P,
    request: UpdateInstallationRequest,
) -> Result<(), UpdateInstallationError>
where
    C: ApplicationCopyPort,
    W: WatchdogLauncher,
    P: NativeUpdatePackage,
{
    let prepared = prepare_update_recovery(
        copier,
        UpdateRecoveryPreparation {
            recovery_root: &request.recovery_root,
            current_application_path: &request.current_application_path,
            library_path: &request.library_path,
            installed_version: &request.installed_version,
            prepared_at: &request.prepared_at,
            authorization: package.authorization(),
        },
    )?;
    let watchdog = match watchdog_launcher.start(&prepared, &request.current_application_path) {
        Ok(watchdog) => watchdog,
        Err(error) => {
            discard_prepared_update_recovery(&request.recovery_root, prepared.recovery_id())?;
            return Err(error.into());
        }
    };
    if let Err(error) = transition_active_update_recovery(
        &request.recovery_root,
        prepared.recovery_id(),
        UpdateRecoveryPhase::ReplacementStarted,
    ) {
        watchdog.stop()?;
        discard_prepared_update_recovery(&request.recovery_root, prepared.recovery_id())?;
        return Err(error.into());
    }
    if let Err(error) = package.install() {
        transition_active_update_recovery(
            &request.recovery_root,
            prepared.recovery_id(),
            UpdateRecoveryPhase::Recovering,
        )?;
        return Err(error.into());
    }
    if let Err(error) = transition_active_update_recovery(
        &request.recovery_root,
        prepared.recovery_id(),
        UpdateRecoveryPhase::ReplacementInstalled,
    ) {
        transition_active_update_recovery(
            &request.recovery_root,
            prepared.recovery_id(),
            UpdateRecoveryPhase::Recovering,
        )?;
        return Err(error.into());
    }
    Ok(())
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use std::{
        cell::{Cell, RefCell},
        fs, io,
        os::unix::fs::PermissionsExt,
        rc::Rc,
    };

    use fitfreed_application::{UpdateArtifact, UpdateInstallationAuthorization};
    use plist::{Dictionary, Value};
    use rusqlite::Connection;
    use tempfile::TempDir;

    use super::*;

    struct Harness {
        _directory: TempDir,
        application_path: PathBuf,
        library_path: PathBuf,
        recovery_root: PathBuf,
    }

    impl Harness {
        fn new() -> Self {
            let directory = tempfile::tempdir().expect("temporary directory");
            let application_path = directory.path().join("installed/FitFreed.app");
            let library_path = directory.path().join("app-data/fitfreed.sqlite");
            let recovery_root = directory.path().join("app-data/update-recovery");
            create_synthetic_application(&application_path, "0.1.0");
            fs::create_dir_all(library_path.parent().expect("library parent"))
                .expect("library parent directory");
            let connection = Connection::open(&library_path).expect("library");
            super::super::ensure_schema(&connection).expect("current library schema");
            drop(connection);
            Self {
                _directory: directory,
                application_path,
                library_path,
                recovery_root,
            }
        }

        fn request(&self) -> UpdateInstallationRequest {
            UpdateInstallationRequest {
                recovery_root: self.recovery_root.clone(),
                current_application_path: self.application_path.clone(),
                library_path: self.library_path.clone(),
                installed_version: "0.1.0".to_owned(),
                prepared_at: "2026-08-17T08:00:00Z".to_owned(),
            }
        }
    }

    struct SyntheticCopier {
        events: Rc<RefCell<Vec<&'static str>>>,
    }

    impl ApplicationCopyPort for SyntheticCopier {
        fn copy_application(&self, source: &Path, destination: &Path) -> Result<(), String> {
            self.events.borrow_mut().push("preserve");
            copy_test_tree(source, destination).map_err(|error| error.to_string())
        }
    }

    struct ControlledPackage {
        authorization: UpdateInstallationAuthorization,
        events: Rc<RefCell<Vec<&'static str>>>,
        fail: bool,
    }

    impl ControlledPackage {
        fn new(events: Rc<RefCell<Vec<&'static str>>>, fail: bool) -> Self {
            Self {
                authorization: UpdateInstallationAuthorization {
                    version: "0.2.0".to_owned(),
                    trusted_sequence: 17,
                    trusted_payload_sha256: "1".repeat(64),
                    signing_key_id: "synthetic-test-key".to_owned(),
                    target_library_schema_version: u32::try_from(super::super::SCHEMA_VERSION)
                        .expect("schema version"),
                    artifact: UpdateArtifact {
                        target: "darwin-aarch64".to_owned(),
                        package_url: "https://updates.invalid/fitfreed.app.tar.gz".to_owned(),
                        expected_size_bytes: 1024,
                        expected_sha256: "2".repeat(64),
                        package_signature: "synthetic-signature".to_owned(),
                    },
                    predecessor_artifact: None,
                },
                events,
                fail,
            }
        }
    }

    impl NativeUpdatePackage for ControlledPackage {
        fn authorization(&self) -> &UpdateInstallationAuthorization {
            &self.authorization
        }

        fn install(&self) -> Result<(), UpdatePackageError> {
            self.events.borrow_mut().push("install");
            if self.fail {
                Err(UpdatePackageError::NativeUpdater)
            } else {
                Ok(())
            }
        }
    }

    struct ControlledWatchdogLauncher {
        events: Rc<RefCell<Vec<&'static str>>>,
        stopped: Rc<Cell<bool>>,
        fail: bool,
    }

    struct ControlledWatchdogHandle {
        stopped: Rc<Cell<bool>>,
    }

    impl WatchdogHandle for ControlledWatchdogHandle {
        fn stop(self) -> Result<(), UpdateRecoveryWatchdogError> {
            self.stopped.set(true);
            Ok(())
        }
    }

    impl WatchdogLauncher for ControlledWatchdogLauncher {
        type Handle = ControlledWatchdogHandle;

        fn start(
            &self,
            _prepared: &PreparedUpdateRecovery,
            _installed_application_path: &Path,
        ) -> Result<Self::Handle, UpdateRecoveryWatchdogError> {
            self.events.borrow_mut().push("watchdog");
            if self.fail {
                Err(UpdateRecoveryWatchdogError::Readiness)
            } else {
                Ok(ControlledWatchdogHandle {
                    stopped: Rc::clone(&self.stopped),
                })
            }
        }
    }

    #[test]
    fn prepares_recovery_before_starting_the_watchdog_and_native_replacement() {
        let harness = Harness::new();
        let events = Rc::new(RefCell::new(Vec::new()));
        let stopped = Rc::new(Cell::new(false));
        let package = ControlledPackage::new(Rc::clone(&events), false);

        coordinate_update_installation(
            &SyntheticCopier {
                events: Rc::clone(&events),
            },
            &ControlledWatchdogLauncher {
                events: Rc::clone(&events),
                stopped: Rc::clone(&stopped),
                fail: false,
            },
            &package,
            harness.request(),
        )
        .expect("coordinated installation");

        assert_eq!(*events.borrow(), ["preserve", "watchdog", "install"]);
        assert!(!stopped.get());
        assert!(matches!(
            super::super::active_update_recovery_phase(&harness.recovery_root)
                .expect("active recovery"),
            Some((_, UpdateRecoveryPhase::ReplacementInstalled))
        ));
    }

    #[test]
    fn discards_recovery_when_the_watchdog_never_becomes_ready() {
        let harness = Harness::new();
        let events = Rc::new(RefCell::new(Vec::new()));
        let package = ControlledPackage::new(Rc::clone(&events), false);

        assert!(matches!(
            coordinate_update_installation(
                &SyntheticCopier {
                    events: Rc::clone(&events),
                },
                &ControlledWatchdogLauncher {
                    events: Rc::clone(&events),
                    stopped: Rc::new(Cell::new(false)),
                    fail: true,
                },
                &package,
                harness.request(),
            ),
            Err(UpdateInstallationError::Watchdog(_))
        ));
        assert_eq!(*events.borrow(), ["preserve", "watchdog"]);
        assert_eq!(
            super::super::active_update_recovery_phase(&harness.recovery_root)
                .expect("discarded recovery"),
            None
        );
    }

    #[test]
    fn hands_native_installation_failure_to_external_recovery() {
        let harness = Harness::new();
        let events = Rc::new(RefCell::new(Vec::new()));
        let package = ControlledPackage::new(Rc::clone(&events), true);

        assert!(matches!(
            coordinate_update_installation(
                &SyntheticCopier {
                    events: Rc::clone(&events),
                },
                &ControlledWatchdogLauncher {
                    events: Rc::clone(&events),
                    stopped: Rc::new(Cell::new(false)),
                    fail: false,
                },
                &package,
                harness.request(),
            ),
            Err(UpdateInstallationError::Package(_))
        ));
        assert_eq!(*events.borrow(), ["preserve", "watchdog", "install"]);
        assert!(matches!(
            super::super::active_update_recovery_phase(&harness.recovery_root)
                .expect("recovering update"),
            Some((_, UpdateRecoveryPhase::Recovering))
        ));
    }

    fn create_synthetic_application(path: &Path, version: &str) {
        fs::create_dir_all(path.join("Contents/MacOS")).expect("application executable directory");
        fs::create_dir_all(path.join("Contents/Resources"))
            .expect("application resource directory");
        let mut dictionary = Dictionary::new();
        dictionary.insert(
            "CFBundleIdentifier".to_owned(),
            Value::String("org.fitfreed.desktop".to_owned()),
        );
        dictionary.insert(
            "CFBundleShortVersionString".to_owned(),
            Value::String(version.to_owned()),
        );
        dictionary.insert(
            "CFBundleExecutable".to_owned(),
            Value::String("fitfreed".to_owned()),
        );
        Value::Dictionary(dictionary)
            .to_file_xml(path.join("Contents/Info.plist"))
            .expect("application property list");
        let executable = path.join("Contents/MacOS/fitfreed");
        fs::write(&executable, "synthetic executable").expect("application executable");
        fs::set_permissions(&executable, fs::Permissions::from_mode(0o755))
            .expect("executable permissions");
        fs::write(
            path.join("Contents/Resources/preserved.txt"),
            "preserved application",
        )
        .expect("application resource");
    }

    fn copy_test_tree(source: &Path, destination: &Path) -> io::Result<()> {
        fs::create_dir(destination)?;
        fs::set_permissions(destination, fs::symlink_metadata(source)?.permissions())?;
        for entry in fs::read_dir(source)? {
            let source_path = entry?.path();
            let destination_path = destination.join(
                source_path
                    .file_name()
                    .expect("synthetic source entry name"),
            );
            let metadata = fs::symlink_metadata(&source_path)?;
            if metadata.is_dir() {
                copy_test_tree(&source_path, &destination_path)?;
            } else {
                fs::copy(&source_path, &destination_path)?;
                fs::set_permissions(&destination_path, metadata.permissions())?;
            }
        }
        Ok(())
    }
}
