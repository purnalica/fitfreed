use std::path::{Path, PathBuf};

use fitfreed_application::{UpdateInstallationAuthorization, UpdateRecoveryPhase};
use thiserror::Error;

use super::{
    discard_prepared_update_recovery, prepare_update_recovery, start_update_recovery_watchdog,
    transition_active_update_recovery, ApplicationCopyPort, PlatformApplicationCopier,
    PreparedUpdateRecovery, StartedUpdateRecoveryWatchdog, UpdatePackageError, UpdateRecoveryError,
    UpdateRecoveryPreparation, UpdateRecoveryWatchdogError, VerifiedUpdatePackage,
};

#[derive(Debug, Error)]
pub enum UpdateInstallationError {
    #[error("update recovery preparation or transition failed: {0}")]
    Recovery(#[from] UpdateRecoveryError),
    #[error("the update recovery watchdog failed: {0}")]
    Watchdog(#[from] UpdateRecoveryWatchdogError),
    #[error("the verified update package could not be installed: {0}")]
    Package(#[from] UpdatePackageError),
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
    request: UpdateInstallationRequest,
) -> Result<(), UpdateInstallationError> {
    coordinate_update_installation(
        &PlatformApplicationCopier,
        &PlatformWatchdogLauncher,
        package,
        request,
    )
}

trait NativeUpdatePackage {
    fn authorization(&self) -> &UpdateInstallationAuthorization;
    fn install(&self) -> Result<(), UpdatePackageError>;
}

impl NativeUpdatePackage for VerifiedUpdatePackage {
    fn authorization(&self) -> &UpdateInstallationAuthorization {
        VerifiedUpdatePackage::authorization(self)
    }

    fn install(&self) -> Result<(), UpdatePackageError> {
        VerifiedUpdatePackage::install(self)
    }
}

trait WatchdogHandle {
    fn stop(self) -> Result<(), UpdateRecoveryWatchdogError>;
}

impl WatchdogHandle for StartedUpdateRecoveryWatchdog {
    fn stop(self) -> Result<(), UpdateRecoveryWatchdogError> {
        StartedUpdateRecoveryWatchdog::stop(self)
    }
}

trait WatchdogLauncher {
    type Handle: WatchdogHandle;

    fn start(
        &self,
        prepared: &PreparedUpdateRecovery,
        installed_application_path: &Path,
    ) -> Result<Self::Handle, UpdateRecoveryWatchdogError>;
}

struct PlatformWatchdogLauncher;

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
