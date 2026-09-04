use std::{
    fs::{self, File, OpenOptions},
    io::{self, Read, Write},
    path::{Component, Path, PathBuf},
    process,
    time::{SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::{DateTime, SecondsFormat, Utc};
use fitfreed_application::{
    authorize_packaged_update_recovery_retry, describe_packaged_update_recovery_intervention,
    validate_packaged_update_recovery_transition, PackagedUpdateRecoveryIntervention,
    PackagedUpdateRecoveryPhase, UpdateArtifact, UpdateInstallationAuthorization,
    UpdateRecoveryOutcome, UpdateRecoveryOutcomeKind,
};
use minisign_verify::Signature;
use semver::Version;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;
use url::Url;

use super::update_recovery_outcome::{
    read_update_recovery_outcome, write_update_recovery_outcome, UpdateRecoveryOutcomeStoreError,
};
use super::update_recovery_windows::verify_windows_native_installation_matches_runnable;
use super::{
    backup_database,
    local_file::{sync_directory, PrivateStagingFile},
    observe_windows_recovery_process, prepare_windows_recovery_packages_from_path,
    query_windows_native_package_identity, reinstall_windows_predecessor_package,
    verify_library_file, verify_windows_recovery_packages, ImportError, UpdateRecoveryMaintenance,
    WindowsNativePackageIdentity, WindowsRecoveryPackageError, WindowsRecoveryPackageExpectation,
    WindowsRecoveryProcessIdentity, WindowsUpdateRecoveryError, SCHEMA_VERSION,
};

const RECOVERY_FORMAT: &str = "org.fitfreed.update-recovery";
const RECOVERY_SCHEMA_VERSION: u32 = 3;
const UPDATE_TARGET: &str = "windows-x86_64-nsis";
const ACTIVE_FILE_NAME: &str = "active";
const ATTEMPTS_DIRECTORY_NAME: &str = "attempts";
const MANIFEST_FILE_NAME: &str = "manifest.json";
const OUTCOME_LOCK_FILE_NAME: &str = "outcome.lock";
const STATE_LOCK_FILE_NAME: &str = "state.lock";
const CANDIDATE_LOCK_FILE_NAME: &str = "candidate.lock";
const WATCHDOG_LOCK_FILE_NAME: &str = "watchdog.lock";
const PREDECESSOR_PACKAGE_RELATIVE_PATH: &str = "previous/package.exe";
const RUNNABLE_PREDECESSOR_RELATIVE_PATH: &str = "previous/runnable";
const RUNNABLE_EXECUTABLE_RELATIVE_PATH: &str = "fitfreed.exe";
const RUNNABLE_UNINSTALLER_RELATIVE_PATH: &str = "uninstall.exe";
const LIBRARY_BACKUP_RELATIVE_PATH: &str = "previous/fitfreed.sqlite";
const TARGET_PACKAGE_RELATIVE_PATH: &str = "candidate/package.exe";
const PRODUCT_NAME: &str = "FitFreed";
const PACKAGE_ARCHITECTURE: &str = "x86_64";
const LIBRARY_FILE_NAME: &str = "fitfreed.sqlite";
const MAX_MANIFEST_BYTES: u64 = 64 * 1024;
const MAX_PACKAGE_BYTES: u64 = 1_073_741_824;
const MAX_LIBRARY_BACKUP_BYTES: u64 = 1024 * 1024 * 1024 * 1024;
const MAX_LOCAL_PATH_BYTES: usize = 4096;
const MAX_URL_BYTES: usize = 2048;
const MAX_VERSION_BYTES: usize = 255;
const MAX_SAFE_JSON_INTEGER: u64 = 9_007_199_254_740_991;

#[derive(Debug, Error)]
pub enum WindowsRecoveryStateError {
    #[error("the Windows recovery preparation is invalid")]
    InvalidInput,
    #[error("a Windows recovery attempt is already active")]
    ActiveAttemptExists,
    #[error("the Windows recovery state is invalid")]
    InvalidState,
    #[error("the Windows recovery transition is invalid")]
    InvalidTransition,
    #[error("the Windows recovery package state is invalid")]
    Package(#[from] WindowsRecoveryPackageError),
    #[error("the Windows recovery library state is invalid")]
    Library(#[from] ImportError),
    #[error("Windows recovery input/output failure: {0}")]
    Io(#[from] io::Error),
    #[error("Windows recovery manifest failure: {0}")]
    Manifest(#[from] serde_json::Error),
}

impl From<UpdateRecoveryOutcomeStoreError> for WindowsRecoveryStateError {
    fn from(value: UpdateRecoveryOutcomeStoreError) -> Self {
        match value {
            UpdateRecoveryOutcomeStoreError::InvalidState => Self::InvalidState,
            UpdateRecoveryOutcomeStoreError::Io(error) => Self::Io(error),
            UpdateRecoveryOutcomeStoreError::Manifest(error) => Self::Manifest(error),
        }
    }
}

pub struct WindowsUpdateRecoveryPreparation<'a> {
    pub recovery_root: &'a Path,
    pub library_path: &'a Path,
    pub installed_version: &'a str,
    pub prepared_at: &'a str,
    pub authorization: &'a UpdateInstallationAuthorization,
    pub predecessor_package_path: &'a Path,
    pub candidate_package_bytes: &'a [u8],
}

pub struct WindowsUpdateRecoveryRestoration<'a> {
    pub recovery_root: &'a Path,
    pub recovery_id: &'a str,
    pub expected_library_path: &'a Path,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WindowsUpdateRecoveryRestorationOutcome {
    Recovered,
    NativeRecoveryUnavailable {
        attempts: u8,
        failure: WindowsNativeRecoveryFailure,
    },
    RecoveryFailed {
        attempts: u8,
        failure: WindowsNativeRecoveryFailure,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreparedWindowsUpdateRecovery {
    recovery_id: String,
    attempt_directory: PathBuf,
    source_library_schema_version: u32,
}

impl PreparedWindowsUpdateRecovery {
    pub fn recovery_id(&self) -> &str {
        &self.recovery_id
    }

    pub fn attempt_directory(&self) -> &Path {
        &self.attempt_directory
    }

    pub fn source_library_schema_version(&self) -> u32 {
        self.source_library_schema_version
    }

    #[cfg(test)]
    pub(crate) fn for_test(recovery_id: String, attempt_directory: PathBuf) -> Self {
        Self {
            recovery_id,
            attempt_directory,
            source_library_schema_version: u32::try_from(SCHEMA_VERSION)
                .expect("schema version fits u32"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WindowsUpdateRecoveryReplacementProcess {
    process_id: u32,
    creation_time_filetime: u64,
    launch_nonce: String,
    confirmation_deadline: String,
}

impl WindowsUpdateRecoveryReplacementProcess {
    pub fn process_id(&self) -> u32 {
        self.process_id
    }

    pub fn creation_time_filetime(&self) -> u64 {
        self.creation_time_filetime
    }

    pub fn launch_nonce(&self) -> &str {
        &self.launch_nonce
    }

    pub fn confirmation_deadline(&self) -> &str {
        &self.confirmation_deadline
    }

    #[cfg(test)]
    pub(crate) fn for_test(
        process_id: u32,
        creation_time_filetime: u64,
        launch_nonce: String,
        confirmation_deadline: String,
    ) -> Self {
        Self {
            process_id,
            creation_time_filetime,
            launch_nonce,
            confirmation_deadline,
        }
    }
}

pub struct WindowsUpdateRecoveryReplacementLaunch<'a> {
    pub process: &'a WindowsRecoveryProcessIdentity,
    pub launch_nonce: &'a str,
    pub confirmation_deadline: &'a str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WindowsUpdateRecoveryWatchdogContext {
    recovery_root: PathBuf,
    recovery_id: String,
    installed_executable_path: PathBuf,
    runnable_predecessor_executable_path: PathBuf,
    library_path: PathBuf,
    source_version: String,
    target_version: String,
    target_library_schema_version: u32,
    prepared_at: String,
    native_recovery_attempts: u8,
    replacement_process: Option<WindowsUpdateRecoveryReplacementProcess>,
}

impl WindowsUpdateRecoveryWatchdogContext {
    pub fn recovery_root(&self) -> &Path {
        &self.recovery_root
    }

    pub fn recovery_id(&self) -> &str {
        &self.recovery_id
    }

    pub fn attempt_directory(&self) -> PathBuf {
        self.recovery_root
            .join(ATTEMPTS_DIRECTORY_NAME)
            .join(&self.recovery_id)
    }

    pub fn installed_executable_path(&self) -> &Path {
        &self.installed_executable_path
    }

    pub fn runnable_predecessor_executable_path(&self) -> &Path {
        &self.runnable_predecessor_executable_path
    }

    pub fn library_path(&self) -> &Path {
        &self.library_path
    }

    pub fn source_version(&self) -> &str {
        &self.source_version
    }

    pub fn target_version(&self) -> &str {
        &self.target_version
    }

    pub fn target_library_schema_version(&self) -> u32 {
        self.target_library_schema_version
    }

    pub fn prepared_at(&self) -> &str {
        &self.prepared_at
    }

    pub fn native_recovery_attempts(&self) -> u8 {
        self.native_recovery_attempts
    }

    pub fn replacement_process(&self) -> Option<&WindowsUpdateRecoveryReplacementProcess> {
        self.replacement_process.as_ref()
    }
}

pub struct WindowsUpdateRecoveryCandidateLease {
    _lock: ExclusiveFileLock,
    recovery_id: String,
    launch_nonce: String,
}

impl WindowsUpdateRecoveryCandidateLease {
    pub fn recovery_id(&self) -> &str {
        &self.recovery_id
    }

    pub fn launch_nonce(&self) -> &str {
        &self.launch_nonce
    }
}

pub struct WindowsUpdateRecoveryWatchdogLease {
    _lock: ExclusiveFileLock,
    recovery_id: String,
}

impl WindowsUpdateRecoveryWatchdogLease {
    pub fn recovery_id(&self) -> &str {
        &self.recovery_id
    }
}

trait RecoveryPackagePort {
    fn prepare(
        &self,
        attempt_directory: &Path,
        predecessor_source: &Path,
        predecessor: &WindowsRecoveryPackageExpectation,
        candidate_bytes: &[u8],
        candidate: &WindowsRecoveryPackageExpectation,
    ) -> Result<String, WindowsRecoveryPackageError>;

    fn verify(
        &self,
        attempt_directory: &Path,
        predecessor: &WindowsRecoveryPackageExpectation,
        candidate: &WindowsRecoveryPackageExpectation,
        runnable_tree_sha256: &str,
    ) -> Result<(), WindowsRecoveryPackageError>;
}

struct SystemRecoveryPackages;

trait WindowsNativeRecoveryPort {
    fn reinstall_and_verify(
        &self,
        attempt_directory: &Path,
        expected_version: &str,
        expected_identity: &NativePackageIdentity,
    ) -> Result<(), WindowsUpdateRecoveryError>;
}

trait WindowsInstalledStatePort {
    fn identity(&self) -> Result<InstalledIdentity, WindowsRecoveryStateError>;

    fn verify_matches_runnable(
        &self,
        attempt_directory: &Path,
    ) -> Result<InstalledIdentity, WindowsRecoveryStateError>;
}

struct SystemWindowsNativeRecovery;
struct SystemWindowsInstalledState;

impl RecoveryPackagePort for SystemRecoveryPackages {
    fn prepare(
        &self,
        attempt_directory: &Path,
        predecessor_source: &Path,
        predecessor: &WindowsRecoveryPackageExpectation,
        candidate_bytes: &[u8],
        candidate: &WindowsRecoveryPackageExpectation,
    ) -> Result<String, WindowsRecoveryPackageError> {
        prepare_windows_recovery_packages_from_path(
            attempt_directory,
            predecessor_source,
            predecessor,
            candidate_bytes,
            candidate,
        )
        .map(|prepared| prepared.runnable_tree_sha256().to_owned())
    }

    fn verify(
        &self,
        attempt_directory: &Path,
        predecessor: &WindowsRecoveryPackageExpectation,
        candidate: &WindowsRecoveryPackageExpectation,
        runnable_tree_sha256: &str,
    ) -> Result<(), WindowsRecoveryPackageError> {
        verify_windows_recovery_packages(
            attempt_directory,
            predecessor,
            candidate,
            runnable_tree_sha256,
        )
        .map(|_| ())
    }
}

impl WindowsNativeRecoveryPort for SystemWindowsNativeRecovery {
    fn reinstall_and_verify(
        &self,
        attempt_directory: &Path,
        expected_version: &str,
        expected_identity: &NativePackageIdentity,
    ) -> Result<(), WindowsUpdateRecoveryError> {
        let native_identity =
            reinstall_windows_predecessor_package(attempt_directory, expected_version)?;
        let installed_identity = InstalledIdentity::from_native(&native_identity)
            .map_err(|_| WindowsUpdateRecoveryError::InvalidPackageIdentity)?;
        if !native_identity_matches(&installed_identity, expected_version, expected_identity) {
            return Err(WindowsUpdateRecoveryError::InvalidPackageIdentity);
        }
        verify_windows_native_installation_matches_runnable(attempt_directory, &native_identity)
    }
}

impl WindowsInstalledStatePort for SystemWindowsInstalledState {
    fn identity(&self) -> Result<InstalledIdentity, WindowsRecoveryStateError> {
        let identity = query_windows_native_package_identity()
            .map_err(|_| WindowsRecoveryStateError::InvalidState)?;
        InstalledIdentity::from_native(&identity)
    }

    fn verify_matches_runnable(
        &self,
        attempt_directory: &Path,
    ) -> Result<InstalledIdentity, WindowsRecoveryStateError> {
        let identity = query_windows_native_package_identity()
            .map_err(|_| WindowsRecoveryStateError::InvalidState)?;
        verify_windows_native_installation_matches_runnable(attempt_directory, &identity)
            .map_err(|_| WindowsRecoveryStateError::InvalidState)?;
        InstalledIdentity::from_native(&identity)
    }
}

#[derive(Debug, Clone)]
struct InstalledIdentity {
    version: String,
    install_directory: PathBuf,
    executable_path: PathBuf,
    uninstaller_path: PathBuf,
    application_data_directory: PathBuf,
}

impl InstalledIdentity {
    fn from_native(
        value: &WindowsNativePackageIdentity,
    ) -> Result<Self, WindowsRecoveryStateError> {
        Ok(Self {
            version: value.version().to_owned(),
            install_directory: canonical_directory(value.install_directory())?,
            executable_path: canonical_regular_file(value.executable_path())?,
            uninstaller_path: canonical_regular_file(value.uninstaller_path())?,
            application_data_directory: canonical_directory(value.application_data_directory())?,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WindowsRecoveryManifest {
    format: String,
    schema_version: u32,
    recovery_id: String,
    phase: WindowsRecoveryPhaseWire,
    prepared_at: String,
    replacement_process: Option<WindowsReplacementProcess>,
    platform: WindowsPlatform,
    source: WindowsRecoverySource,
    target: WindowsRecoveryTarget,
    predecessor_package: PreservedPackage,
    runnable_predecessor: RunnablePredecessor,
    library_backup: LibraryBackup,
    target_package: PreservedPackage,
    native_recovery: NativeRecovery,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
enum WindowsRecoveryPhaseWire {
    Prepared,
    ReplacementStarted,
    ReplacementInstalled,
    Launching,
    Confirmed,
    Recovering,
    NativeRecoveryUnavailable,
    Recovered,
    RecoveryFailed,
}

impl From<WindowsRecoveryPhaseWire> for PackagedUpdateRecoveryPhase {
    fn from(value: WindowsRecoveryPhaseWire) -> Self {
        match value {
            WindowsRecoveryPhaseWire::Prepared => Self::Prepared,
            WindowsRecoveryPhaseWire::ReplacementStarted => Self::ReplacementStarted,
            WindowsRecoveryPhaseWire::ReplacementInstalled => Self::ReplacementInstalled,
            WindowsRecoveryPhaseWire::Launching => Self::Launching,
            WindowsRecoveryPhaseWire::Confirmed => Self::Confirmed,
            WindowsRecoveryPhaseWire::Recovering => Self::Recovering,
            WindowsRecoveryPhaseWire::NativeRecoveryUnavailable => Self::NativeRecoveryUnavailable,
            WindowsRecoveryPhaseWire::Recovered => Self::Recovered,
            WindowsRecoveryPhaseWire::RecoveryFailed => Self::RecoveryFailed,
        }
    }
}

impl From<PackagedUpdateRecoveryPhase> for WindowsRecoveryPhaseWire {
    fn from(value: PackagedUpdateRecoveryPhase) -> Self {
        match value {
            PackagedUpdateRecoveryPhase::Prepared => Self::Prepared,
            PackagedUpdateRecoveryPhase::ReplacementStarted => Self::ReplacementStarted,
            PackagedUpdateRecoveryPhase::ReplacementInstalled => Self::ReplacementInstalled,
            PackagedUpdateRecoveryPhase::Launching => Self::Launching,
            PackagedUpdateRecoveryPhase::Confirmed => Self::Confirmed,
            PackagedUpdateRecoveryPhase::Recovering => Self::Recovering,
            PackagedUpdateRecoveryPhase::NativeRecoveryUnavailable => {
                Self::NativeRecoveryUnavailable
            }
            PackagedUpdateRecoveryPhase::Recovered => Self::Recovered,
            PackagedUpdateRecoveryPhase::RecoveryFailed => Self::RecoveryFailed,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WindowsReplacementProcess {
    process_id: u32,
    creation_time_filetime: String,
    executable_path: String,
    launch_nonce: String,
    confirmation_deadline: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WindowsPlatform {
    os: String,
    architecture: String,
    package_kind: String,
    installation_scope: String,
    update_target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WindowsRecoverySource {
    version: String,
    library_schema_version: u32,
    library_path: String,
    native_package: NativePackageIdentity,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct NativePackageIdentity {
    product_name: String,
    version: String,
    architecture: String,
    install_directory: String,
    executable_path: String,
    uninstaller_path: String,
    application_data_directory: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WindowsRecoveryTarget {
    version: String,
    library_schema_version: u32,
    trusted_sequence: u64,
    trusted_payload_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PreservedPackage {
    relative_path: String,
    version: String,
    source_url: String,
    size_bytes: u64,
    sha256: String,
    signing_key_id: String,
    updater_signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RunnablePredecessor {
    relative_path: String,
    executable_relative_path: String,
    uninstaller_relative_path: String,
    tree_sha256: String,
    source_package_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LibraryBackup {
    relative_path: String,
    size_bytes: u64,
    sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct NativeRecovery {
    attempts: u8,
    last_failure: Option<WindowsNativeRecoveryFailure>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum WindowsNativeRecoveryFailure {
    InstallerFailed,
    InstalledStateInvalid,
}

pub fn prepare_windows_update_recovery(
    preparation: WindowsUpdateRecoveryPreparation<'_>,
) -> Result<PreparedWindowsUpdateRecovery, WindowsRecoveryStateError> {
    let native_identity = query_windows_native_package_identity()
        .map_err(|_| WindowsRecoveryStateError::InvalidInput)?;
    let installed_identity = InstalledIdentity::from_native(&native_identity)?;
    prepare_windows_update_recovery_with(&SystemRecoveryPackages, &installed_identity, preparation)
}

pub fn verify_windows_update_recovery(
    recovery_root: &Path,
    recovery_id: &str,
) -> Result<(), WindowsRecoveryStateError> {
    verify_windows_update_recovery_with(&SystemRecoveryPackages, recovery_root, recovery_id)
        .map(|_| ())
}

pub fn active_windows_update_recovery_phase(
    recovery_root: &Path,
) -> Result<Option<(String, PackagedUpdateRecoveryPhase)>, WindowsRecoveryStateError> {
    active_windows_update_recovery_phase_with(&SystemRecoveryPackages, recovery_root)
}

pub fn transition_active_windows_update_recovery(
    recovery_root: &Path,
    recovery_id: &str,
    next: PackagedUpdateRecoveryPhase,
) -> Result<(), WindowsRecoveryStateError> {
    if !valid_sha256(recovery_id) {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    let recovery_root = canonical_private_directory(recovery_root)?;
    let attempt_directory = canonical_recovery_attempt(&recovery_root, recovery_id)?;
    let _state_lock = StateLock::acquire(&attempt_directory)?;
    if read_active_recovery_id(&recovery_root.join(ACTIVE_FILE_NAME))? != recovery_id {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    let manifest_path = attempt_directory.join(MANIFEST_FILE_NAME);
    let mut manifest = read_manifest(&manifest_path)?;
    validate_manifest(&manifest)?;
    if manifest.recovery_id != recovery_id
        || matches!(
            next,
            PackagedUpdateRecoveryPhase::Launching | PackagedUpdateRecoveryPhase::Confirmed
        )
    {
        return Err(WindowsRecoveryStateError::InvalidTransition);
    }
    validate_packaged_update_recovery_transition(manifest.phase.into(), next)
        .map_err(|_| WindowsRecoveryStateError::InvalidTransition)?;
    manifest.phase = next.into();
    validate_manifest(&manifest)?;
    write_manifest(&manifest_path, &manifest)
}

pub fn record_active_windows_update_recovery_replacement_launch(
    recovery_root: &Path,
    recovery_id: &str,
    launch: WindowsUpdateRecoveryReplacementLaunch<'_>,
) -> Result<WindowsUpdateRecoveryReplacementProcess, WindowsRecoveryStateError> {
    if !valid_sha256(recovery_id) {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    let recovery_root = canonical_private_directory(recovery_root)?;
    let attempt_directory = canonical_recovery_attempt(&recovery_root, recovery_id)?;
    let _state_lock = StateLock::acquire(&attempt_directory)?;
    if read_active_recovery_id(&recovery_root.join(ACTIVE_FILE_NAME))? != recovery_id {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    let manifest_path = attempt_directory.join(MANIFEST_FILE_NAME);
    let mut manifest = read_manifest(&manifest_path)?;
    validate_manifest(&manifest)?;
    if manifest.recovery_id != recovery_id {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    validate_packaged_update_recovery_transition(
        manifest.phase.into(),
        PackagedUpdateRecoveryPhase::Launching,
    )
    .map_err(|_| WindowsRecoveryStateError::InvalidTransition)?;
    let replacement_process = WindowsReplacementProcess {
        process_id: launch.process.process_id(),
        creation_time_filetime: launch.process.creation_time_filetime().to_string(),
        executable_path: path_text(launch.process.executable_path())?,
        launch_nonce: launch.launch_nonce.to_owned(),
        confirmation_deadline: launch.confirmation_deadline.to_owned(),
    };
    if !valid_replacement_process(
        &replacement_process,
        &manifest.source.native_package.executable_path,
    ) {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    manifest.phase = WindowsRecoveryPhaseWire::Launching;
    manifest.replacement_process = Some(replacement_process.clone());
    validate_manifest(&manifest)?;
    write_manifest(&manifest_path, &manifest)?;
    Ok(WindowsUpdateRecoveryReplacementProcess {
        process_id: replacement_process.process_id,
        creation_time_filetime: launch.process.creation_time_filetime(),
        launch_nonce: replacement_process.launch_nonce,
        confirmation_deadline: replacement_process.confirmation_deadline,
    })
}

pub fn resolve_windows_update_recovery_watchdog_context(
    watchdog_executable: &Path,
    expected_installed_executable: &Path,
) -> Result<WindowsUpdateRecoveryWatchdogContext, WindowsRecoveryStateError> {
    resolve_windows_update_recovery_watchdog_context_with(
        &SystemRecoveryPackages,
        watchdog_executable,
        expected_installed_executable,
    )
}

pub fn resolve_active_windows_update_recovery_watchdog_context(
    recovery_root: &Path,
    expected_installed_executable: &Path,
) -> Result<
    Option<(
        WindowsUpdateRecoveryWatchdogContext,
        PackagedUpdateRecoveryPhase,
    )>,
    WindowsRecoveryStateError,
> {
    resolve_active_windows_update_recovery_watchdog_context_with(
        &SystemRecoveryPackages,
        recovery_root,
        expected_installed_executable,
    )
}

pub fn query_windows_update_recovery_intervention(
    recovery_root: &Path,
    expected_installed_executable: &Path,
) -> Result<Option<PackagedUpdateRecoveryIntervention>, WindowsRecoveryStateError> {
    query_windows_update_recovery_intervention_with(
        &SystemRecoveryPackages,
        recovery_root,
        expected_installed_executable,
    )
}

pub fn begin_windows_update_recovery_retry(
    recovery_root: &Path,
    expected_installed_executable: &Path,
) -> Result<WindowsUpdateRecoveryWatchdogContext, WindowsRecoveryStateError> {
    begin_windows_update_recovery_retry_with(
        &SystemRecoveryPackages,
        recovery_root,
        expected_installed_executable,
    )
}

fn begin_windows_update_recovery_retry_with(
    packages: &impl RecoveryPackagePort,
    recovery_root: &Path,
    expected_installed_executable: &Path,
) -> Result<WindowsUpdateRecoveryWatchdogContext, WindowsRecoveryStateError> {
    let (context, phase) = resolve_active_windows_update_recovery_watchdog_context_with(
        packages,
        recovery_root,
        expected_installed_executable,
    )?
    .ok_or(WindowsRecoveryStateError::InvalidTransition)?;
    authorize_packaged_update_recovery_retry(phase, context.native_recovery_attempts())
        .map_err(|_| WindowsRecoveryStateError::InvalidTransition)?;
    drop(acquire_windows_update_recovery_watchdog_lease_with(
        packages, &context,
    )?);
    transition_active_windows_update_recovery(
        context.recovery_root(),
        context.recovery_id(),
        PackagedUpdateRecoveryPhase::Recovering,
    )?;
    Ok(context)
}

pub fn cancel_windows_update_recovery_retry(
    context: &WindowsUpdateRecoveryWatchdogContext,
    watchdog_lease: &WindowsUpdateRecoveryWatchdogLease,
) -> Result<(), WindowsRecoveryStateError> {
    if context.recovery_id() != watchdog_lease.recovery_id() {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    transition_active_windows_update_recovery(
        context.recovery_root(),
        context.recovery_id(),
        PackagedUpdateRecoveryPhase::NativeRecoveryUnavailable,
    )
}

fn query_windows_update_recovery_intervention_with(
    packages: &impl RecoveryPackagePort,
    recovery_root: &Path,
    expected_installed_executable: &Path,
) -> Result<Option<PackagedUpdateRecoveryIntervention>, WindowsRecoveryStateError> {
    let Some((context, phase)) = resolve_active_windows_update_recovery_watchdog_context_with(
        packages,
        recovery_root,
        expected_installed_executable,
    )?
    else {
        return Ok(None);
    };
    Ok(describe_packaged_update_recovery_intervention(
        phase,
        context.source_version(),
        context.target_version(),
        context.native_recovery_attempts(),
    ))
}

fn resolve_active_windows_update_recovery_watchdog_context_with(
    packages: &impl RecoveryPackagePort,
    recovery_root: &Path,
    expected_installed_executable: &Path,
) -> Result<
    Option<(
        WindowsUpdateRecoveryWatchdogContext,
        PackagedUpdateRecoveryPhase,
    )>,
    WindowsRecoveryStateError,
> {
    let Some((recovery_id, phase)) =
        active_windows_update_recovery_phase_with(packages, recovery_root)?
    else {
        return Ok(None);
    };
    let watchdog_executable = recovery_root
        .join(ATTEMPTS_DIRECTORY_NAME)
        .join(recovery_id)
        .join(RUNNABLE_PREDECESSOR_RELATIVE_PATH)
        .join(RUNNABLE_EXECUTABLE_RELATIVE_PATH);
    resolve_windows_update_recovery_watchdog_context_with(
        packages,
        &watchdog_executable,
        expected_installed_executable,
    )
    .map(|context| Some((context, phase)))
}

fn resolve_windows_update_recovery_watchdog_context_with(
    packages: &impl RecoveryPackagePort,
    watchdog_executable: &Path,
    expected_installed_executable: &Path,
) -> Result<WindowsUpdateRecoveryWatchdogContext, WindowsRecoveryStateError> {
    let expected_installed_executable = canonical_regular_file(expected_installed_executable)?;
    let watchdog_executable = canonical_regular_file(watchdog_executable)?;
    let attempt_directory = watchdog_executable
        .ancestors()
        .nth(3)
        .ok_or(WindowsRecoveryStateError::InvalidInput)?;
    if attempt_directory
        .join(RUNNABLE_PREDECESSOR_RELATIVE_PATH)
        .join(RUNNABLE_EXECUTABLE_RELATIVE_PATH)
        != watchdog_executable
    {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    let recovery_id = attempt_directory
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|value| valid_sha256(value))
        .ok_or(WindowsRecoveryStateError::InvalidInput)?;
    let attempts_directory = attempt_directory
        .parent()
        .filter(|path| {
            path.file_name().and_then(|name| name.to_str()) == Some(ATTEMPTS_DIRECTORY_NAME)
        })
        .ok_or(WindowsRecoveryStateError::InvalidInput)?;
    let recovery_root = attempts_directory
        .parent()
        .ok_or(WindowsRecoveryStateError::InvalidInput)?;
    canonical_private_directory(recovery_root)?;
    canonical_private_directory(attempts_directory)?;
    canonical_private_directory(attempt_directory)?;
    if read_active_recovery_id(&recovery_root.join(ACTIVE_FILE_NAME))? != recovery_id {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    let manifest = verify_windows_update_recovery_with(packages, recovery_root, recovery_id)?;
    if !paths_equal(
        &manifest.source.native_package.executable_path,
        &path_text(&expected_installed_executable)?,
    ) {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    let library_path = recovery_root
        .parent()
        .ok_or(WindowsRecoveryStateError::InvalidState)?
        .join(LIBRARY_FILE_NAME);
    if !paths_equal(&manifest.source.library_path, &path_text(&library_path)?) {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    Ok(WindowsUpdateRecoveryWatchdogContext {
        recovery_root: recovery_root.to_owned(),
        recovery_id: recovery_id.to_owned(),
        installed_executable_path: expected_installed_executable,
        runnable_predecessor_executable_path: watchdog_executable,
        library_path,
        source_version: manifest.source.version,
        target_version: manifest.target.version,
        target_library_schema_version: manifest.target.library_schema_version,
        prepared_at: manifest.prepared_at,
        native_recovery_attempts: manifest.native_recovery.attempts,
        replacement_process: manifest
            .replacement_process
            .as_ref()
            .map(replacement_process_view)
            .transpose()?,
    })
}

pub fn acquire_windows_update_recovery_watchdog_lease(
    context: &WindowsUpdateRecoveryWatchdogContext,
) -> Result<WindowsUpdateRecoveryWatchdogLease, WindowsRecoveryStateError> {
    acquire_windows_update_recovery_watchdog_lease_with(&SystemRecoveryPackages, context)
}

fn acquire_windows_update_recovery_watchdog_lease_with(
    packages: &impl RecoveryPackagePort,
    context: &WindowsUpdateRecoveryWatchdogContext,
) -> Result<WindowsUpdateRecoveryWatchdogLease, WindowsRecoveryStateError> {
    let recovery_root = canonical_private_directory(context.recovery_root())?;
    let attempt_directory = canonical_recovery_attempt(&recovery_root, context.recovery_id())?;
    let lock_file = open_private_lock_file(&attempt_directory, WATCHDOG_LOCK_FILE_NAME, false)
        .map_err(map_lock_contention)?;
    let lock = ExclusiveFileLock::acquire(lock_file)?;
    let manifest = verify_windows_update_recovery_with_held_locks(
        packages,
        &recovery_root,
        context.recovery_id(),
        &[WATCHDOG_LOCK_FILE_NAME],
    )?;
    if read_active_recovery_id(&recovery_root.join(ACTIVE_FILE_NAME))? != context.recovery_id()
        || manifest.target.version != context.target_version()
        || manifest.target.library_schema_version != context.target_library_schema_version()
        || manifest.prepared_at != context.prepared_at()
    {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    Ok(WindowsUpdateRecoveryWatchdogLease {
        _lock: lock,
        recovery_id: context.recovery_id().to_owned(),
    })
}

pub fn acquire_windows_update_recovery_candidate_lease(
    recovery_root: &Path,
    recovery_id: &str,
    launch_nonce: &str,
) -> Result<WindowsUpdateRecoveryCandidateLease, WindowsRecoveryStateError> {
    if !valid_sha256(recovery_id) || !valid_sha256(launch_nonce) {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    let native_identity = query_windows_native_package_identity()
        .map_err(|_| WindowsRecoveryStateError::InvalidState)?;
    let process =
        observe_windows_recovery_process(process::id(), native_identity.executable_path())
            .map_err(|_| WindowsRecoveryStateError::InvalidState)?;
    let native_identity = InstalledIdentity::from_native(&native_identity)?;
    acquire_windows_update_recovery_candidate_lease_with(
        &SystemRecoveryPackages,
        recovery_root,
        recovery_id,
        launch_nonce,
        &process,
        &native_identity,
    )
}

fn acquire_windows_update_recovery_candidate_lease_with(
    packages: &impl RecoveryPackagePort,
    recovery_root: &Path,
    recovery_id: &str,
    launch_nonce: &str,
    process: &WindowsRecoveryProcessIdentity,
    native_identity: &InstalledIdentity,
) -> Result<WindowsUpdateRecoveryCandidateLease, WindowsRecoveryStateError> {
    if !valid_sha256(recovery_id) || !valid_sha256(launch_nonce) {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    let recovery_root = canonical_private_directory(recovery_root)?;
    let attempt_directory = canonical_recovery_attempt(&recovery_root, recovery_id)?;
    let lock_file = open_private_lock_file(&attempt_directory, CANDIDATE_LOCK_FILE_NAME, false)
        .map_err(map_lock_contention)?;
    let lock = ExclusiveFileLock::acquire(lock_file)?;
    let _state_lock = StateLock::acquire(&attempt_directory)?;
    if read_active_recovery_id(&recovery_root.join(ACTIVE_FILE_NAME))? != recovery_id {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    let manifest = verify_windows_update_recovery_with_held_locks(
        packages,
        &recovery_root,
        recovery_id,
        &[CANDIDATE_LOCK_FILE_NAME, STATE_LOCK_FILE_NAME],
    )?;
    let replacement = manifest
        .replacement_process
        .as_ref()
        .ok_or(WindowsRecoveryStateError::InvalidState)?;
    if manifest.phase != WindowsRecoveryPhaseWire::Launching
        || manifest.recovery_id != recovery_id
        || replacement.launch_nonce != launch_nonce
        || replacement.process_id != process.process_id()
        || replacement.creation_time_filetime != process.creation_time_filetime().to_string()
        || !paths_equal(
            &replacement.executable_path,
            &path_text(process.executable_path())?,
        )
        || !native_identity_matches(
            native_identity,
            &manifest.target.version,
            &manifest.source.native_package,
        )
    {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    Ok(WindowsUpdateRecoveryCandidateLease {
        _lock: lock,
        recovery_id: recovery_id.to_owned(),
        launch_nonce: launch_nonce.to_owned(),
    })
}

pub fn confirm_active_windows_update_recovery(
    candidate_lease: &WindowsUpdateRecoveryCandidateLease,
    recovery_root: &Path,
    library_path: &Path,
    running_version: &str,
    running_library_schema_version: u32,
) -> Result<(), WindowsRecoveryStateError> {
    let native_identity = query_windows_native_package_identity()
        .map_err(|_| WindowsRecoveryStateError::InvalidState)?;
    let native_identity = InstalledIdentity::from_native(&native_identity)?;
    confirm_active_windows_update_recovery_with(
        &SystemRecoveryPackages,
        &native_identity,
        candidate_lease,
        recovery_root,
        library_path,
        running_version,
        running_library_schema_version,
    )
}

#[allow(clippy::too_many_arguments)]
fn confirm_active_windows_update_recovery_with(
    packages: &impl RecoveryPackagePort,
    native_identity: &InstalledIdentity,
    candidate_lease: &WindowsUpdateRecoveryCandidateLease,
    recovery_root: &Path,
    library_path: &Path,
    running_version: &str,
    running_library_schema_version: u32,
) -> Result<(), WindowsRecoveryStateError> {
    if valid_semver(running_version).is_none() {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    let recovery_root = canonical_private_directory(recovery_root)?;
    let library_path = canonical_windows_library_path(&recovery_root, library_path)?;
    let recovery_id = candidate_lease.recovery_id();
    let attempt_directory = canonical_recovery_attempt(&recovery_root, recovery_id)?;
    let _state_lock = StateLock::acquire(&attempt_directory)?;
    if read_active_recovery_id(&recovery_root.join(ACTIVE_FILE_NAME))? != recovery_id {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    let manifest_path = attempt_directory.join(MANIFEST_FILE_NAME);
    let mut manifest = verify_windows_update_recovery_with_held_locks(
        packages,
        &recovery_root,
        recovery_id,
        &[CANDIDATE_LOCK_FILE_NAME, STATE_LOCK_FILE_NAME],
    )?;
    let replacement_process = manifest
        .replacement_process
        .as_ref()
        .ok_or(WindowsRecoveryStateError::InvalidState)?;
    if manifest.phase != WindowsRecoveryPhaseWire::Launching
        || manifest.recovery_id != recovery_id
        || replacement_process.launch_nonce != candidate_lease.launch_nonce()
        || !native_identity_matches(
            native_identity,
            &manifest.target.version,
            &manifest.source.native_package,
        )
    {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    if !paths_equal(&manifest.source.library_path, &path_text(&library_path)?)
        || running_version != manifest.target.version
        || running_library_schema_version != manifest.target.library_schema_version
    {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    verify_library_file(
        &library_path,
        i64::from(manifest.target.library_schema_version),
    )?;
    validate_packaged_update_recovery_transition(
        manifest.phase.into(),
        PackagedUpdateRecoveryPhase::Confirmed,
    )
    .map_err(|_| WindowsRecoveryStateError::InvalidTransition)?;
    manifest.phase = WindowsRecoveryPhaseWire::Confirmed;
    validate_manifest(&manifest)?;
    write_manifest(&manifest_path, &manifest)
}

pub fn discard_prepared_windows_update_recovery(
    recovery_root: &Path,
    recovery_id: &str,
) -> Result<(), WindowsRecoveryStateError> {
    discard_prepared_windows_update_recovery_with(
        &SystemRecoveryPackages,
        recovery_root,
        recovery_id,
    )
}

fn discard_prepared_windows_update_recovery_with(
    packages: &impl RecoveryPackagePort,
    recovery_root: &Path,
    recovery_id: &str,
) -> Result<(), WindowsRecoveryStateError> {
    if !valid_sha256(recovery_id) {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    let recovery_root = canonical_private_directory(recovery_root)?;
    let outcome_file = open_private_lock_file(&recovery_root, OUTCOME_LOCK_FILE_NAME, false)
        .map_err(map_lock_contention)?;
    let _outcome_lock = ExclusiveFileLock::acquire(outcome_file)?;
    let attempts_directory =
        canonical_private_directory(&recovery_root.join(ATTEMPTS_DIRECTORY_NAME))?;
    let attempt_directory = canonical_recovery_attempt(&recovery_root, recovery_id)?;
    let watchdog_file = open_private_lock_file(&attempt_directory, WATCHDOG_LOCK_FILE_NAME, false)
        .map_err(map_lock_contention)?;
    let watchdog_lock = ExclusiveFileLock::acquire(watchdog_file)?;
    let candidate_file =
        open_private_lock_file(&attempt_directory, CANDIDATE_LOCK_FILE_NAME, false)
            .map_err(map_lock_contention)?;
    let candidate_lock = ExclusiveFileLock::acquire(candidate_file)?;
    let state_lock = StateLock::acquire(&attempt_directory)?;
    let active_path = recovery_root.join(ACTIVE_FILE_NAME);
    if read_active_recovery_id(&active_path)? != recovery_id {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    let manifest = verify_windows_update_recovery_with_held_locks(
        packages,
        &recovery_root,
        recovery_id,
        &[
            WATCHDOG_LOCK_FILE_NAME,
            CANDIDATE_LOCK_FILE_NAME,
            STATE_LOCK_FILE_NAME,
        ],
    )?;
    if manifest.phase != WindowsRecoveryPhaseWire::Prepared || manifest.recovery_id != recovery_id {
        return Err(WindowsRecoveryStateError::InvalidTransition);
    }

    fs::remove_file(active_path)?;
    sync_directory(&recovery_root)?;
    drop(state_lock);
    drop(candidate_lock);
    drop(watchdog_lock);
    fs::remove_dir_all(attempt_directory)?;
    sync_directory(&attempts_directory)?;
    Ok(())
}

pub fn maintain_windows_update_recovery(
    recovery_root: &Path,
    expected_library_path: &Path,
) -> Result<UpdateRecoveryMaintenance, WindowsRecoveryStateError> {
    let mut watchdog_lease = None;
    maintain_windows_update_recovery_with(
        &SystemRecoveryPackages,
        &SystemWindowsInstalledState,
        recovery_root,
        expected_library_path,
        &mut watchdog_lease,
    )
}

pub fn maintain_windows_update_recovery_with_watchdog_lease(
    context: &WindowsUpdateRecoveryWatchdogContext,
    watchdog_lease: &mut Option<WindowsUpdateRecoveryWatchdogLease>,
) -> Result<UpdateRecoveryMaintenance, WindowsRecoveryStateError> {
    maintain_windows_update_recovery_with(
        &SystemRecoveryPackages,
        &SystemWindowsInstalledState,
        context.recovery_root(),
        context.library_path(),
        watchdog_lease,
    )
}

fn maintain_windows_update_recovery_with(
    packages: &impl RecoveryPackagePort,
    installed_state: &impl WindowsInstalledStatePort,
    recovery_root: &Path,
    expected_library_path: &Path,
    watchdog_lease: &mut Option<WindowsUpdateRecoveryWatchdogLease>,
) -> Result<UpdateRecoveryMaintenance, WindowsRecoveryStateError> {
    if !path_entry_exists(recovery_root)? {
        return Ok(UpdateRecoveryMaintenance::NoTerminalOutcome);
    }
    let recovery_root = canonical_private_directory(recovery_root)?;
    let Some(_outcome_lock) = try_acquire_exclusive_lock(open_private_lock_file(
        &recovery_root,
        OUTCOME_LOCK_FILE_NAME,
        false,
    ))?
    else {
        return Ok(UpdateRecoveryMaintenance::Deferred);
    };
    let retained_outcome = read_update_recovery_outcome(&recovery_root)?;
    let active_path = recovery_root.join(ACTIVE_FILE_NAME);
    let active_recovery_id = if path_entry_exists(&active_path)? {
        Some(read_active_recovery_id(&active_path)?)
    } else {
        None
    };
    let (recovery_id, active_expected) = match (active_recovery_id, &retained_outcome) {
        (Some(recovery_id), _) => (recovery_id, true),
        (None, Some(outcome)) => {
            let attempt_directory = recovery_root
                .join(ATTEMPTS_DIRECTORY_NAME)
                .join(&outcome.recovery_id);
            if !path_entry_exists(&attempt_directory)? {
                return Ok(UpdateRecoveryMaintenance::OutcomeRetained(outcome.clone()));
            }
            (outcome.recovery_id.clone(), false)
        }
        (None, None) => return Ok(UpdateRecoveryMaintenance::NoTerminalOutcome),
    };

    finalize_terminal_windows_update_recovery(
        packages,
        installed_state,
        &recovery_root,
        &recovery_id,
        active_expected,
        retained_outcome.as_ref(),
        expected_library_path,
        watchdog_lease,
    )
}

#[allow(clippy::too_many_arguments)]
fn finalize_terminal_windows_update_recovery(
    packages: &impl RecoveryPackagePort,
    installed_state: &impl WindowsInstalledStatePort,
    recovery_root: &Path,
    recovery_id: &str,
    active_expected: bool,
    retained_outcome: Option<&UpdateRecoveryOutcome>,
    expected_library_path: &Path,
    watchdog_lease: &mut Option<WindowsUpdateRecoveryWatchdogLease>,
) -> Result<UpdateRecoveryMaintenance, WindowsRecoveryStateError> {
    let attempts_directory =
        canonical_private_directory(&recovery_root.join(ATTEMPTS_DIRECTORY_NAME))?;
    let attempt_directory = canonical_recovery_attempt(recovery_root, recovery_id)?;
    if watchdog_lease
        .as_ref()
        .is_some_and(|lease| lease.recovery_id() != recovery_id)
    {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    let watchdog_lock = if watchdog_lease.is_some() {
        None
    } else {
        let Some(lock) = try_acquire_exclusive_lock(open_private_lock_file(
            &attempt_directory,
            WATCHDOG_LOCK_FILE_NAME,
            false,
        ))?
        else {
            return Ok(UpdateRecoveryMaintenance::Deferred);
        };
        Some(lock)
    };
    let Some(candidate_lock) = try_acquire_exclusive_lock(open_private_lock_file(
        &attempt_directory,
        CANDIDATE_LOCK_FILE_NAME,
        false,
    ))?
    else {
        return Ok(UpdateRecoveryMaintenance::Deferred);
    };
    let state_lock = StateLock::acquire(&attempt_directory)?;
    let active_path = recovery_root.join(ACTIVE_FILE_NAME);
    if active_expected {
        if read_active_recovery_id(&active_path)? != recovery_id {
            return Err(WindowsRecoveryStateError::InvalidState);
        }
    } else if path_entry_exists(&active_path)? {
        return Err(WindowsRecoveryStateError::InvalidState);
    }

    let manifest = verify_windows_update_recovery_with_held_locks(
        packages,
        recovery_root,
        recovery_id,
        &[
            WATCHDOG_LOCK_FILE_NAME,
            CANDIDATE_LOCK_FILE_NAME,
            STATE_LOCK_FILE_NAME,
        ],
    )?;
    let kind = match manifest.phase {
        WindowsRecoveryPhaseWire::Confirmed => UpdateRecoveryOutcomeKind::Updated,
        WindowsRecoveryPhaseWire::Recovered => UpdateRecoveryOutcomeKind::Recovered,
        WindowsRecoveryPhaseWire::Prepared
        | WindowsRecoveryPhaseWire::ReplacementStarted
        | WindowsRecoveryPhaseWire::ReplacementInstalled
        | WindowsRecoveryPhaseWire::Launching
        | WindowsRecoveryPhaseWire::Recovering
        | WindowsRecoveryPhaseWire::NativeRecoveryUnavailable
        | WindowsRecoveryPhaseWire::RecoveryFailed => {
            if active_expected {
                return Ok(UpdateRecoveryMaintenance::NoTerminalOutcome);
            }
            return Err(WindowsRecoveryStateError::InvalidState);
        }
    };
    let outcome = UpdateRecoveryOutcome {
        recovery_id: recovery_id.to_owned(),
        kind,
        source_version: manifest.source.version.clone(),
        target_version: manifest.target.version.clone(),
    };
    if !active_expected && retained_outcome != Some(&outcome) {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    let expected_library_path =
        canonical_windows_library_path(recovery_root, expected_library_path)?;
    if !paths_equal(
        &manifest.source.library_path,
        &path_text(&expected_library_path)?,
    ) {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    match kind {
        UpdateRecoveryOutcomeKind::Updated => {
            let installed_identity = installed_state.identity()?;
            if !native_identity_matches(
                &installed_identity,
                &manifest.target.version,
                &manifest.source.native_package,
            ) {
                return Err(WindowsRecoveryStateError::InvalidState);
            }
            verify_library_file(
                &expected_library_path,
                i64::from(manifest.target.library_schema_version),
            )?;
        }
        UpdateRecoveryOutcomeKind::Recovered => {
            let installed_identity = installed_state.verify_matches_runnable(&attempt_directory)?;
            if !native_identity_matches(
                &installed_identity,
                &manifest.source.version,
                &manifest.source.native_package,
            ) || !windows_library_matches(
                &expected_library_path,
                &manifest.library_backup,
                manifest.source.library_schema_version,
            ) {
                return Err(WindowsRecoveryStateError::InvalidState);
            }
        }
    }

    if retained_outcome != Some(&outcome) {
        write_update_recovery_outcome(recovery_root, &outcome)?;
    }
    if active_expected {
        fs::remove_file(&active_path)?;
        sync_directory(recovery_root)?;
    }
    drop(state_lock);
    drop(candidate_lock);
    drop(watchdog_lock);
    drop(watchdog_lease.take());
    fs::remove_dir_all(&attempt_directory)?;
    sync_directory(&attempts_directory)?;
    Ok(UpdateRecoveryMaintenance::OutcomeRetained(outcome))
}

fn try_acquire_exclusive_lock(
    file: Result<File, WindowsRecoveryStateError>,
) -> Result<Option<ExclusiveFileLock>, WindowsRecoveryStateError> {
    let file = match file.map_err(map_lock_contention) {
        Ok(file) => file,
        Err(WindowsRecoveryStateError::ActiveAttemptExists) => return Ok(None),
        Err(error) => return Err(error),
    };
    match ExclusiveFileLock::acquire(file) {
        Ok(lock) => Ok(Some(lock)),
        Err(WindowsRecoveryStateError::ActiveAttemptExists) => Ok(None),
        Err(error) => Err(error),
    }
}

pub fn restore_active_windows_update_recovery(
    watchdog_lease: &WindowsUpdateRecoveryWatchdogLease,
    restoration: WindowsUpdateRecoveryRestoration<'_>,
) -> Result<WindowsUpdateRecoveryRestorationOutcome, WindowsRecoveryStateError> {
    restore_active_windows_update_recovery_with(
        &SystemRecoveryPackages,
        &SystemWindowsNativeRecovery,
        watchdog_lease,
        restoration,
    )
}

fn restore_active_windows_update_recovery_with(
    packages: &impl RecoveryPackagePort,
    native_recovery: &impl WindowsNativeRecoveryPort,
    watchdog_lease: &WindowsUpdateRecoveryWatchdogLease,
    restoration: WindowsUpdateRecoveryRestoration<'_>,
) -> Result<WindowsUpdateRecoveryRestorationOutcome, WindowsRecoveryStateError> {
    if !valid_sha256(restoration.recovery_id)
        || watchdog_lease.recovery_id() != restoration.recovery_id
        || !restoration.expected_library_path.is_absolute()
    {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    let recovery_root = canonical_private_directory(restoration.recovery_root)?;
    let library_path =
        canonical_windows_library_destination(&recovery_root, restoration.expected_library_path)?;
    let attempt_directory = canonical_recovery_attempt(&recovery_root, restoration.recovery_id)?;
    let candidate_file =
        open_private_lock_file(&attempt_directory, CANDIDATE_LOCK_FILE_NAME, false)
            .map_err(map_lock_contention)?;
    let _candidate_lock = ExclusiveFileLock::acquire(candidate_file)?;
    let _state_lock = StateLock::acquire(&attempt_directory)?;
    if read_active_recovery_id(&recovery_root.join(ACTIVE_FILE_NAME))? != restoration.recovery_id {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    let manifest_path = attempt_directory.join(MANIFEST_FILE_NAME);
    let mut manifest = verify_windows_update_recovery_with_held_locks(
        packages,
        &recovery_root,
        restoration.recovery_id,
        &[
            WATCHDOG_LOCK_FILE_NAME,
            CANDIDATE_LOCK_FILE_NAME,
            STATE_LOCK_FILE_NAME,
        ],
    )?;
    if manifest.phase != WindowsRecoveryPhaseWire::Recovering
        || manifest.recovery_id != restoration.recovery_id
        || manifest.native_recovery.attempts >= 3
        || !paths_equal(&manifest.source.library_path, &path_text(&library_path)?)
    {
        return Err(WindowsRecoveryStateError::InvalidTransition);
    }
    restore_windows_library(
        &attempt_directory.join(&manifest.library_backup.relative_path),
        &library_path,
        &manifest.library_backup,
        manifest.source.library_schema_version,
    )?;

    let native_result = native_recovery
        .reinstall_and_verify(
            &attempt_directory,
            &manifest.source.version,
            &manifest.source.native_package,
        )
        .map_err(classify_windows_native_recovery_error);
    let attempts = manifest
        .native_recovery
        .attempts
        .checked_add(1)
        .filter(|attempts| *attempts <= 3)
        .ok_or(WindowsRecoveryStateError::InvalidState)?;
    manifest.native_recovery.attempts = attempts;
    let outcome = match native_result {
        Ok(()) => {
            manifest.native_recovery.last_failure = None;
            manifest.phase = WindowsRecoveryPhaseWire::Recovered;
            WindowsUpdateRecoveryRestorationOutcome::Recovered
        }
        Err(failure) if attempts < 3 => {
            manifest.native_recovery.last_failure = Some(failure);
            manifest.phase = WindowsRecoveryPhaseWire::NativeRecoveryUnavailable;
            WindowsUpdateRecoveryRestorationOutcome::NativeRecoveryUnavailable { attempts, failure }
        }
        Err(failure) => {
            manifest.native_recovery.last_failure = Some(failure);
            manifest.phase = WindowsRecoveryPhaseWire::RecoveryFailed;
            WindowsUpdateRecoveryRestorationOutcome::RecoveryFailed { attempts, failure }
        }
    };
    validate_packaged_update_recovery_transition(
        PackagedUpdateRecoveryPhase::Recovering,
        manifest.phase.into(),
    )
    .map_err(|_| WindowsRecoveryStateError::InvalidTransition)?;
    validate_manifest(&manifest)?;
    write_manifest(&manifest_path, &manifest)?;
    Ok(outcome)
}

fn classify_windows_native_recovery_error(
    error: WindowsUpdateRecoveryError,
) -> WindowsNativeRecoveryFailure {
    match error {
        WindowsUpdateRecoveryError::NativeRollbackFailed
        | WindowsUpdateRecoveryError::NativeInstallationFailed => {
            WindowsNativeRecoveryFailure::InstallerFailed
        }
        WindowsUpdateRecoveryError::InvalidPackageIdentity
        | WindowsUpdateRecoveryError::InvalidPredecessorPackage
        | WindowsUpdateRecoveryError::InvalidCandidatePackage
        | WindowsUpdateRecoveryError::InvalidProcessIdentity
        | WindowsUpdateRecoveryError::ProcessStopFailed
        | WindowsUpdateRecoveryError::Io(_) => WindowsNativeRecoveryFailure::InstalledStateInvalid,
    }
}

fn restore_windows_library(
    backup_path: &Path,
    destination_path: &Path,
    backup: &LibraryBackup,
    schema_version: u32,
) -> Result<(), WindowsRecoveryStateError> {
    if windows_library_matches(destination_path, backup, schema_version) {
        return Ok(());
    }
    if fs::symlink_metadata(destination_path)
        .is_ok_and(|metadata| !metadata.file_type().is_file() || is_reparse_point(&metadata))
    {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    let parent = destination_path
        .parent()
        .ok_or(WindowsRecoveryStateError::InvalidInput)?;
    if parent.join(LIBRARY_FILE_NAME) != destination_path {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    let source = open_read_only_nofollow(backup_path)?;
    let metadata = source.metadata()?;
    if !metadata.file_type().is_file()
        || is_reparse_point(&metadata)
        || metadata.len() != backup.size_bytes
    {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    let mut staging =
        PrivateStagingFile::new(parent, "fitfreed-windows-library-recovery", ".sqlite")?;
    let copied = io::copy(&mut source.take(backup.size_bytes + 1), staging.file_mut()?)?;
    if copied != backup.size_bytes {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    staging.sync_and_close()?;
    if file_sha256(staging.path(), backup.size_bytes)? != backup.sha256 {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    verify_library_file(staging.path(), i64::from(schema_version))?;
    staging.persist_replace(destination_path)?;
    if !windows_library_matches(destination_path, backup, schema_version) {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    Ok(())
}

fn windows_library_matches(path: &Path, backup: &LibraryBackup, schema_version: u32) -> bool {
    fs::symlink_metadata(path).is_ok_and(|metadata| {
        metadata.file_type().is_file()
            && !is_reparse_point(&metadata)
            && metadata.len() == backup.size_bytes
            && file_sha256(path, backup.size_bytes).is_ok_and(|digest| digest == backup.sha256)
            && verify_library_file(path, i64::from(schema_version)).is_ok()
    })
}

fn active_windows_update_recovery_phase_with(
    packages: &impl RecoveryPackagePort,
    recovery_root: &Path,
) -> Result<Option<(String, PackagedUpdateRecoveryPhase)>, WindowsRecoveryStateError> {
    if !path_entry_exists(recovery_root)? {
        return Ok(None);
    }
    let recovery_root = canonical_private_directory(recovery_root)?;
    let active_path = recovery_root.join(ACTIVE_FILE_NAME);
    if !path_entry_exists(&active_path)? {
        return Ok(None);
    }
    let recovery_id = read_active_recovery_id(&active_path)?;
    let manifest = verify_windows_update_recovery_with(packages, &recovery_root, &recovery_id)?;
    Ok(Some((recovery_id, manifest.phase.into())))
}

fn prepare_windows_update_recovery_with(
    packages: &impl RecoveryPackagePort,
    native_identity: &InstalledIdentity,
    preparation: WindowsUpdateRecoveryPreparation<'_>,
) -> Result<PreparedWindowsUpdateRecovery, WindowsRecoveryStateError> {
    let validated = validate_preparation(native_identity, &preparation)?;
    let derived_recovery_root = native_identity
        .application_data_directory
        .join("update-recovery");
    let recovery_root = prepare_recovery_root(
        &derived_recovery_root,
        &native_identity.application_data_directory,
    )?;
    let outcome_file = open_private_lock_file(&recovery_root, OUTCOME_LOCK_FILE_NAME, true)
        .map_err(map_lock_contention)?;
    sync_directory(&recovery_root)?;
    let _outcome_lock = ExclusiveFileLock::acquire(outcome_file)?;
    let active_path = recovery_root.join(ACTIVE_FILE_NAME);
    if path_entry_exists(&active_path)? {
        return Err(WindowsRecoveryStateError::ActiveAttemptExists);
    }

    let attempts_directory = recovery_root.join(ATTEMPTS_DIRECTORY_NAME);
    create_or_validate_private_directory(&attempts_directory)?;
    let recovery_id = generate_recovery_id(&preparation)?;
    let staging_directory = attempts_directory.join(format!(".staging-{recovery_id}"));
    let attempt_directory = attempts_directory.join(&recovery_id);
    if path_entry_exists(&staging_directory)? || path_entry_exists(&attempt_directory)? {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    create_private_directory(&staging_directory)?;
    let mut staging = StagingAttempt::new(staging_directory.clone());
    for name in [
        STATE_LOCK_FILE_NAME,
        CANDIDATE_LOCK_FILE_NAME,
        WATCHDOG_LOCK_FILE_NAME,
    ] {
        drop(open_private_lock_file(&staging_directory, name, true)?);
    }

    let runnable_tree_sha256 = packages.prepare(
        &staging_directory,
        preparation.predecessor_package_path,
        &validated.predecessor_expectation,
        preparation.candidate_package_bytes,
        &validated.candidate_expectation,
    )?;
    let library_backup_path = staging_directory.join(LIBRARY_BACKUP_RELATIVE_PATH);
    backup_database(&validated.library_path, &library_backup_path)?;
    verify_library_file(
        &library_backup_path,
        i64::from(validated.source_library_schema_version),
    )?;
    let library_metadata = fs::symlink_metadata(&library_backup_path)?;
    if !library_metadata.file_type().is_file()
        || is_reparse_point(&library_metadata)
        || library_metadata.len() == 0
        || library_metadata.len() > MAX_LIBRARY_BACKUP_BYTES
    {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    let library_sha256 = file_sha256(&library_backup_path, library_metadata.len())?;

    let predecessor_artifact = preparation
        .authorization
        .predecessor_artifact
        .as_ref()
        .ok_or(WindowsRecoveryStateError::InvalidInput)?;
    let manifest = WindowsRecoveryManifest {
        format: RECOVERY_FORMAT.to_owned(),
        schema_version: RECOVERY_SCHEMA_VERSION,
        recovery_id: recovery_id.clone(),
        phase: WindowsRecoveryPhaseWire::Prepared,
        prepared_at: validated.prepared_at,
        replacement_process: None,
        platform: WindowsPlatform {
            os: "windows".to_owned(),
            architecture: PACKAGE_ARCHITECTURE.to_owned(),
            package_kind: "nsis".to_owned(),
            installation_scope: "current-user".to_owned(),
            update_target: UPDATE_TARGET.to_owned(),
        },
        source: WindowsRecoverySource {
            version: preparation.installed_version.to_owned(),
            library_schema_version: validated.source_library_schema_version,
            library_path: path_text(&validated.library_path)?,
            native_package: native_package_identity(native_identity)?,
        },
        target: WindowsRecoveryTarget {
            version: preparation.authorization.version.clone(),
            library_schema_version: preparation.authorization.target_library_schema_version,
            trusted_sequence: preparation.authorization.trusted_sequence,
            trusted_payload_sha256: preparation.authorization.trusted_payload_sha256.clone(),
        },
        predecessor_package: preserved_package(
            PREDECESSOR_PACKAGE_RELATIVE_PATH,
            preparation.installed_version,
            predecessor_artifact,
            &preparation.authorization.signing_key_id,
        ),
        runnable_predecessor: RunnablePredecessor {
            relative_path: RUNNABLE_PREDECESSOR_RELATIVE_PATH.to_owned(),
            executable_relative_path: RUNNABLE_EXECUTABLE_RELATIVE_PATH.to_owned(),
            uninstaller_relative_path: RUNNABLE_UNINSTALLER_RELATIVE_PATH.to_owned(),
            tree_sha256: runnable_tree_sha256,
            source_package_sha256: predecessor_artifact.expected_sha256.clone(),
        },
        library_backup: LibraryBackup {
            relative_path: LIBRARY_BACKUP_RELATIVE_PATH.to_owned(),
            size_bytes: library_metadata.len(),
            sha256: library_sha256,
        },
        target_package: preserved_package(
            TARGET_PACKAGE_RELATIVE_PATH,
            &preparation.authorization.version,
            &preparation.authorization.artifact,
            &preparation.authorization.signing_key_id,
        ),
        native_recovery: NativeRecovery {
            attempts: 0,
            last_failure: None,
        },
    };
    validate_manifest(&manifest)?;
    write_new_manifest(&staging_directory.join(MANIFEST_FILE_NAME), &manifest)?;
    sync_prepared_attempt(&staging_directory)?;
    fs::rename(&staging_directory, &attempt_directory)?;
    staging.move_to(attempt_directory.clone());
    sync_directory(&attempts_directory)?;
    verify_windows_update_recovery_with(packages, &recovery_root, &recovery_id)?;
    write_active_recovery_id(&active_path, &recovery_id)?;
    staging.disarm();
    if read_active_recovery_id(&active_path)? != recovery_id {
        return Err(WindowsRecoveryStateError::InvalidState);
    }

    Ok(PreparedWindowsUpdateRecovery {
        recovery_id,
        attempt_directory,
        source_library_schema_version: validated.source_library_schema_version,
    })
}

struct ValidatedPreparation {
    library_path: PathBuf,
    prepared_at: String,
    source_library_schema_version: u32,
    predecessor_expectation: WindowsRecoveryPackageExpectation,
    candidate_expectation: WindowsRecoveryPackageExpectation,
}

fn validate_preparation(
    native_identity: &InstalledIdentity,
    preparation: &WindowsUpdateRecoveryPreparation<'_>,
) -> Result<ValidatedPreparation, WindowsRecoveryStateError> {
    if native_identity.version != preparation.installed_version
        || !valid_installed_identity(native_identity)
        || !preparation.recovery_root.is_absolute()
        || !preparation.library_path.is_absolute()
        || contains_parent_component(preparation.recovery_root)
        || contains_parent_component(preparation.library_path)
    {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    let source_version = valid_semver(preparation.installed_version)
        .ok_or(WindowsRecoveryStateError::InvalidInput)?;
    let target_version = valid_semver(&preparation.authorization.version)
        .ok_or(WindowsRecoveryStateError::InvalidInput)?;
    let predecessor_artifact = preparation
        .authorization
        .predecessor_artifact
        .as_ref()
        .ok_or(WindowsRecoveryStateError::InvalidInput)?;
    if target_version <= source_version
        || preparation.authorization.artifact.target != UPDATE_TARGET
        || predecessor_artifact.target != UPDATE_TARGET
        || preparation.authorization.trusted_sequence == 0
        || preparation.authorization.trusted_sequence > MAX_SAFE_JSON_INTEGER
        || !valid_sha256(&preparation.authorization.trusted_payload_sha256)
        || !valid_key_id(&preparation.authorization.signing_key_id)
        || !valid_artifact(&preparation.authorization.artifact)
        || !valid_artifact(predecessor_artifact)
    {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    let prepared_at = canonical_utc(preparation.prepared_at)
        .filter(|value| value == preparation.prepared_at)
        .ok_or(WindowsRecoveryStateError::InvalidInput)?;
    let library_path = canonical_regular_file(preparation.library_path)?;
    let application_data_directory =
        canonical_directory(&native_identity.application_data_directory)?;
    if library_path.file_name().and_then(|name| name.to_str()) != Some(LIBRARY_FILE_NAME)
        || library_path.parent() != Some(application_data_directory.as_path())
        || preparation
            .recovery_root
            .file_name()
            .and_then(|name| name.to_str())
            != Some("update-recovery")
        || preparation
            .recovery_root
            .parent()
            .ok_or(WindowsRecoveryStateError::InvalidInput)?
            .canonicalize()?
            != application_data_directory
    {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    let source_library_schema_version =
        u32::try_from(SCHEMA_VERSION).map_err(|_| WindowsRecoveryStateError::InvalidInput)?;
    if preparation.authorization.target_library_schema_version < source_library_schema_version {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    let predecessor_expectation = WindowsRecoveryPackageExpectation::try_new(
        preparation.installed_version.to_owned(),
        predecessor_artifact.expected_size_bytes,
        predecessor_artifact.expected_sha256.clone(),
    )?;
    let candidate_expectation = WindowsRecoveryPackageExpectation::try_new(
        preparation.authorization.version.clone(),
        preparation.authorization.artifact.expected_size_bytes,
        preparation.authorization.artifact.expected_sha256.clone(),
    )?;
    Ok(ValidatedPreparation {
        library_path,
        prepared_at,
        source_library_schema_version,
        predecessor_expectation,
        candidate_expectation,
    })
}

fn verify_windows_update_recovery_with(
    packages: &impl RecoveryPackagePort,
    recovery_root: &Path,
    recovery_id: &str,
) -> Result<WindowsRecoveryManifest, WindowsRecoveryStateError> {
    verify_windows_update_recovery_with_held_locks(packages, recovery_root, recovery_id, &[])
}

fn verify_windows_update_recovery_with_held_locks(
    packages: &impl RecoveryPackagePort,
    recovery_root: &Path,
    recovery_id: &str,
    held_lock_names: &[&str],
) -> Result<WindowsRecoveryManifest, WindowsRecoveryStateError> {
    if !valid_sha256(recovery_id) {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    let recovery_root = canonical_private_directory(recovery_root)?;
    let attempts_directory =
        canonical_private_directory(&recovery_root.join(ATTEMPTS_DIRECTORY_NAME))?;
    let attempt_directory = canonical_private_directory(&attempts_directory.join(recovery_id))?;
    for name in [
        STATE_LOCK_FILE_NAME,
        CANDIDATE_LOCK_FILE_NAME,
        WATCHDOG_LOCK_FILE_NAME,
    ] {
        if !held_lock_names.contains(&name) {
            drop(open_private_lock_file(&attempt_directory, name, false)?);
        }
    }
    let manifest = read_manifest(&attempt_directory.join(MANIFEST_FILE_NAME))?;
    validate_manifest(&manifest)?;
    if manifest.recovery_id != recovery_id {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    let predecessor = expectation_from_package(&manifest.predecessor_package)?;
    let candidate = expectation_from_package(&manifest.target_package)?;
    packages.verify(
        &attempt_directory,
        &predecessor,
        &candidate,
        &manifest.runnable_predecessor.tree_sha256,
    )?;
    let library_path = attempt_directory.join(&manifest.library_backup.relative_path);
    let metadata = fs::symlink_metadata(&library_path)?;
    if !metadata.file_type().is_file()
        || is_reparse_point(&metadata)
        || metadata.len() != manifest.library_backup.size_bytes
        || file_sha256(&library_path, metadata.len())? != manifest.library_backup.sha256
    {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    verify_library_file(
        &library_path,
        i64::from(manifest.source.library_schema_version),
    )?;
    Ok(manifest)
}

fn validate_manifest(manifest: &WindowsRecoveryManifest) -> Result<(), WindowsRecoveryStateError> {
    let source_version =
        valid_semver(&manifest.source.version).ok_or(WindowsRecoveryStateError::InvalidState)?;
    let target_version =
        valid_semver(&manifest.target.version).ok_or(WindowsRecoveryStateError::InvalidState)?;
    if manifest.format != RECOVERY_FORMAT
        || manifest.schema_version != RECOVERY_SCHEMA_VERSION
        || !valid_sha256(&manifest.recovery_id)
        || canonical_utc(&manifest.prepared_at).as_deref() != Some(manifest.prepared_at.as_str())
        || manifest.platform
            != (WindowsPlatform {
                os: "windows".to_owned(),
                architecture: PACKAGE_ARCHITECTURE.to_owned(),
                package_kind: "nsis".to_owned(),
                installation_scope: "current-user".to_owned(),
                update_target: UPDATE_TARGET.to_owned(),
            })
        || target_version <= source_version
        || manifest.source.library_schema_version == 0
        || manifest.target.library_schema_version < manifest.source.library_schema_version
        || manifest.target.trusted_sequence == 0
        || manifest.target.trusted_sequence > MAX_SAFE_JSON_INTEGER
        || !valid_sha256(&manifest.target.trusted_payload_sha256)
        || !valid_native_identity(&manifest.source.native_package, &manifest.source.version)
        || !valid_library_path(
            &manifest.source.library_path,
            &manifest.source.native_package.application_data_directory,
        )
        || !valid_preserved_package(
            &manifest.predecessor_package,
            PREDECESSOR_PACKAGE_RELATIVE_PATH,
            &manifest.source.version,
        )
        || !valid_preserved_package(
            &manifest.target_package,
            TARGET_PACKAGE_RELATIVE_PATH,
            &manifest.target.version,
        )
        || manifest.predecessor_package.signing_key_id != manifest.target_package.signing_key_id
        || manifest.runnable_predecessor.relative_path != RUNNABLE_PREDECESSOR_RELATIVE_PATH
        || manifest.runnable_predecessor.executable_relative_path
            != RUNNABLE_EXECUTABLE_RELATIVE_PATH
        || manifest.runnable_predecessor.uninstaller_relative_path
            != RUNNABLE_UNINSTALLER_RELATIVE_PATH
        || !valid_sha256(&manifest.runnable_predecessor.tree_sha256)
        || manifest.runnable_predecessor.source_package_sha256
            != manifest.predecessor_package.sha256
        || manifest.library_backup.relative_path != LIBRARY_BACKUP_RELATIVE_PATH
        || manifest.library_backup.size_bytes == 0
        || manifest.library_backup.size_bytes > MAX_LIBRARY_BACKUP_BYTES
        || !valid_sha256(&manifest.library_backup.sha256)
        || !valid_lifecycle_evidence(manifest)
    {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    Ok(())
}

fn valid_lifecycle_evidence(manifest: &WindowsRecoveryManifest) -> bool {
    let process_required = matches!(
        manifest.phase,
        WindowsRecoveryPhaseWire::Launching | WindowsRecoveryPhaseWire::Confirmed
    );
    let process_forbidden = matches!(
        manifest.phase,
        WindowsRecoveryPhaseWire::Prepared
            | WindowsRecoveryPhaseWire::ReplacementStarted
            | WindowsRecoveryPhaseWire::ReplacementInstalled
    );
    if (process_required && manifest.replacement_process.is_none())
        || (process_forbidden && manifest.replacement_process.is_some())
        || manifest
            .replacement_process
            .as_ref()
            .is_some_and(|process| {
                !valid_replacement_process(process, &manifest.source.native_package.executable_path)
            })
    {
        return false;
    }
    match manifest.phase {
        WindowsRecoveryPhaseWire::Prepared
        | WindowsRecoveryPhaseWire::ReplacementStarted
        | WindowsRecoveryPhaseWire::ReplacementInstalled
        | WindowsRecoveryPhaseWire::Launching
        | WindowsRecoveryPhaseWire::Confirmed => {
            manifest.native_recovery.attempts == 0
                && manifest.native_recovery.last_failure.is_none()
        }
        WindowsRecoveryPhaseWire::NativeRecoveryUnavailable => {
            (1..=2).contains(&manifest.native_recovery.attempts)
                && manifest.native_recovery.last_failure.is_some()
        }
        WindowsRecoveryPhaseWire::RecoveryFailed => {
            manifest.native_recovery.attempts == 3
                && manifest.native_recovery.last_failure.is_some()
        }
        WindowsRecoveryPhaseWire::Recovered => {
            (1..=3).contains(&manifest.native_recovery.attempts)
                && manifest.native_recovery.last_failure.is_none()
        }
        WindowsRecoveryPhaseWire::Recovering => true,
    }
}

fn valid_replacement_process(process: &WindowsReplacementProcess, executable_path: &str) -> bool {
    process.process_id >= 2
        && process
            .creation_time_filetime
            .parse::<u64>()
            .is_ok_and(|value| value > 0 && value.to_string() == process.creation_time_filetime)
        && paths_equal(&process.executable_path, executable_path)
        && valid_sha256(&process.launch_nonce)
        && canonical_utc(&process.confirmation_deadline).as_deref()
            == Some(process.confirmation_deadline.as_str())
}

fn replacement_process_view(
    process: &WindowsReplacementProcess,
) -> Result<WindowsUpdateRecoveryReplacementProcess, WindowsRecoveryStateError> {
    if !valid_sha256(&process.launch_nonce)
        || canonical_utc(&process.confirmation_deadline).as_deref()
            != Some(process.confirmation_deadline.as_str())
    {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    Ok(WindowsUpdateRecoveryReplacementProcess {
        process_id: process.process_id,
        creation_time_filetime: process
            .creation_time_filetime
            .parse()
            .map_err(|_| WindowsRecoveryStateError::InvalidState)?,
        launch_nonce: process.launch_nonce.clone(),
        confirmation_deadline: process.confirmation_deadline.clone(),
    })
}

fn native_identity_matches(
    identity: &InstalledIdentity,
    expected_version: &str,
    expected_paths: &NativePackageIdentity,
) -> bool {
    identity.version == expected_version
        && valid_installed_identity(identity)
        && path_text(&identity.install_directory)
            .is_ok_and(|value| paths_equal(&value, &expected_paths.install_directory))
        && path_text(&identity.executable_path)
            .is_ok_and(|value| paths_equal(&value, &expected_paths.executable_path))
        && path_text(&identity.uninstaller_path)
            .is_ok_and(|value| paths_equal(&value, &expected_paths.uninstaller_path))
        && path_text(&identity.application_data_directory)
            .is_ok_and(|value| paths_equal(&value, &expected_paths.application_data_directory))
}

fn valid_native_identity(identity: &NativePackageIdentity, source_version: &str) -> bool {
    identity.product_name == PRODUCT_NAME
        && identity.version == source_version
        && identity.architecture == PACKAGE_ARCHITECTURE
        && valid_absolute_path(&identity.install_directory)
        && valid_absolute_path(&identity.executable_path)
        && valid_absolute_path(&identity.uninstaller_path)
        && valid_absolute_path(&identity.application_data_directory)
        && path_has_fixed_child(
            &identity.install_directory,
            &identity.executable_path,
            RUNNABLE_EXECUTABLE_RELATIVE_PATH,
        )
        && path_has_fixed_child(
            &identity.install_directory,
            &identity.uninstaller_path,
            RUNNABLE_UNINSTALLER_RELATIVE_PATH,
        )
}

fn valid_library_path(library_path: &str, application_data_directory: &str) -> bool {
    valid_absolute_path(library_path)
        && path_has_fixed_child(application_data_directory, library_path, LIBRARY_FILE_NAME)
}

fn valid_absolute_path(value: &str) -> bool {
    (1..=MAX_LOCAL_PATH_BYTES).contains(&value.len())
        && !value.chars().any(char::is_control)
        && valid_platform_path_text(value)
        && Path::new(value).is_absolute()
        && !contains_parent_component(Path::new(value))
}

#[cfg(target_os = "windows")]
fn valid_platform_path_text(value: &str) -> bool {
    let relative = if value.len() >= 3
        && value.as_bytes()[0].is_ascii_alphabetic()
        && value.as_bytes()[1] == b':'
        && value.as_bytes()[2] == b'\\'
    {
        &value[3..]
    } else if value.len() >= 7
        && value.starts_with(r"\\?\")
        && value.as_bytes()[4].is_ascii_alphabetic()
        && value.as_bytes()[5] == b':'
        && value.as_bytes()[6] == b'\\'
    {
        &value[7..]
    } else {
        return false;
    };
    !relative.is_empty()
        && relative.split('\\').all(|segment| {
            !segment.is_empty()
                && segment != "."
                && segment != ".."
                && !segment.ends_with(['.', ' '])
                && !segment
                    .bytes()
                    .any(|byte| matches!(byte, b'<' | b'>' | b':' | b'"' | b'|' | b'?' | b'*'))
        })
}

#[cfg(not(target_os = "windows"))]
fn valid_platform_path_text(_value: &str) -> bool {
    true
}

fn path_has_fixed_child(parent: &str, child: &str, name: &str) -> bool {
    let expected = Path::new(parent).join(name);
    expected
        .to_str()
        .is_some_and(|expected| paths_equal(expected, child))
}

#[cfg(target_os = "windows")]
fn paths_equal(left: &str, right: &str) -> bool {
    left.eq_ignore_ascii_case(right)
}

#[cfg(not(target_os = "windows"))]
fn paths_equal(left: &str, right: &str) -> bool {
    left == right
}

fn native_package_identity(
    identity: &InstalledIdentity,
) -> Result<NativePackageIdentity, WindowsRecoveryStateError> {
    Ok(NativePackageIdentity {
        product_name: PRODUCT_NAME.to_owned(),
        version: identity.version.clone(),
        architecture: PACKAGE_ARCHITECTURE.to_owned(),
        install_directory: path_text(&identity.install_directory)?,
        executable_path: path_text(&identity.executable_path)?,
        uninstaller_path: path_text(&identity.uninstaller_path)?,
        application_data_directory: path_text(&identity.application_data_directory)?,
    })
}

fn valid_installed_identity(identity: &InstalledIdentity) -> bool {
    valid_semver(&identity.version).is_some()
        && canonical_directory(&identity.install_directory)
            .is_ok_and(|path| path == identity.install_directory)
        && canonical_regular_file(&identity.executable_path)
            .is_ok_and(|path| path == identity.executable_path)
        && canonical_regular_file(&identity.uninstaller_path)
            .is_ok_and(|path| path == identity.uninstaller_path)
        && canonical_directory(&identity.application_data_directory)
            .is_ok_and(|path| path == identity.application_data_directory)
        && identity.executable_path
            == identity
                .install_directory
                .join(RUNNABLE_EXECUTABLE_RELATIVE_PATH)
        && identity.uninstaller_path
            == identity
                .install_directory
                .join(RUNNABLE_UNINSTALLER_RELATIVE_PATH)
}

fn valid_preserved_package(package: &PreservedPackage, relative_path: &str, version: &str) -> bool {
    package.relative_path == relative_path
        && package.version == version
        && valid_immutable_https_url(&package.source_url)
        && (1..=MAX_PACKAGE_BYTES).contains(&package.size_bytes)
        && valid_sha256(&package.sha256)
        && valid_key_id(&package.signing_key_id)
        && valid_updater_signature(&package.updater_signature)
}

fn preserved_package(
    relative_path: &str,
    version: &str,
    artifact: &UpdateArtifact,
    signing_key_id: &str,
) -> PreservedPackage {
    PreservedPackage {
        relative_path: relative_path.to_owned(),
        version: version.to_owned(),
        source_url: artifact.package_url.clone(),
        size_bytes: artifact.expected_size_bytes,
        sha256: artifact.expected_sha256.clone(),
        signing_key_id: signing_key_id.to_owned(),
        updater_signature: artifact.package_signature.clone(),
    }
}

fn expectation_from_package(
    package: &PreservedPackage,
) -> Result<WindowsRecoveryPackageExpectation, WindowsRecoveryStateError> {
    WindowsRecoveryPackageExpectation::try_new(
        package.version.clone(),
        package.size_bytes,
        package.sha256.clone(),
    )
    .map_err(Into::into)
}

fn valid_artifact(artifact: &UpdateArtifact) -> bool {
    valid_immutable_https_url(&artifact.package_url)
        && (1..=MAX_PACKAGE_BYTES).contains(&artifact.expected_size_bytes)
        && valid_sha256(&artifact.expected_sha256)
        && valid_updater_signature(&artifact.package_signature)
}

fn valid_semver(value: &str) -> Option<Version> {
    (value.len() <= MAX_VERSION_BYTES)
        .then(|| Version::parse(value).ok())
        .flatten()
}

fn valid_immutable_https_url(value: &str) -> bool {
    value.len() <= MAX_URL_BYTES
        && Url::parse(value).is_ok_and(|url| {
            url.as_str() == value
                && url.scheme() == "https"
                && url.has_host()
                && url.username().is_empty()
                && url.password().is_none()
                && url.query().is_none()
                && url.fragment().is_none()
        })
}

fn valid_updater_signature(value: &str) -> bool {
    (16..=16_384).contains(&value.len())
        && BASE64
            .decode(value)
            .ok()
            .and_then(|bytes| String::from_utf8(bytes).ok())
            .is_some_and(|text| Signature::decode(&text).is_ok())
}

fn valid_key_id(value: &str) -> bool {
    (1..=128).contains(&value.len())
        && value.bytes().enumerate().all(|(index, byte)| {
            byte.is_ascii_digit()
                || byte.is_ascii_lowercase()
                || (index > 0 && matches!(byte, b'.' | b'_' | b'-'))
        })
}

fn valid_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn canonical_utc(value: &str) -> Option<String> {
    let parsed = DateTime::parse_from_rfc3339(value).ok()?;
    if parsed.offset().local_minus_utc() != 0 {
        return None;
    }
    Some(
        parsed
            .with_timezone(&Utc)
            .to_rfc3339_opts(SecondsFormat::Secs, true),
    )
}

fn path_text(path: &Path) -> Result<String, WindowsRecoveryStateError> {
    path.to_str()
        .filter(|value| (1..=MAX_LOCAL_PATH_BYTES).contains(&value.len()))
        .map(str::to_owned)
        .ok_or(WindowsRecoveryStateError::InvalidInput)
}

fn generate_recovery_id(
    preparation: &WindowsUpdateRecoveryPreparation<'_>,
) -> Result<String, WindowsRecoveryStateError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| WindowsRecoveryStateError::InvalidState)?;
    let mut digest = Sha256::new();
    digest.update(RECOVERY_FORMAT.as_bytes());
    digest.update(RECOVERY_SCHEMA_VERSION.to_be_bytes());
    digest.update(preparation.installed_version.as_bytes());
    digest.update(preparation.authorization.version.as_bytes());
    digest.update(preparation.authorization.trusted_sequence.to_be_bytes());
    digest.update(preparation.authorization.trusted_payload_sha256.as_bytes());
    digest.update(preparation.prepared_at.as_bytes());
    digest.update(process::id().to_be_bytes());
    digest.update(now.as_nanos().to_be_bytes());
    Ok(lower_hex(&digest.finalize()))
}

fn contains_parent_component(path: &Path) -> bool {
    path.components()
        .any(|component| matches!(component, Component::ParentDir))
}

fn prepare_recovery_root(
    path: &Path,
    application_data_directory: &Path,
) -> Result<PathBuf, WindowsRecoveryStateError> {
    if !path.is_absolute()
        || contains_parent_component(path)
        || path.parent() != Some(application_data_directory)
    {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    match fs::symlink_metadata(path) {
        Ok(_) => canonical_private_directory(path),
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            create_private_directory(path)?;
            canonical_private_directory(path)
        }
        Err(error) => Err(error.into()),
    }
}

fn create_or_validate_private_directory(path: &Path) -> Result<(), WindowsRecoveryStateError> {
    match fs::create_dir(path) {
        Ok(()) => {
            if let Err(error) = set_private_directory_permissions(path) {
                let _ = fs::remove_dir(path);
                return Err(error);
            }
            sync_directory(
                path.parent()
                    .ok_or(WindowsRecoveryStateError::InvalidState)?,
            )?;
            Ok(())
        }
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
            canonical_private_directory(path).map(|_| ())
        }
        Err(error) => Err(error.into()),
    }
}

fn create_private_directory(path: &Path) -> Result<(), WindowsRecoveryStateError> {
    fs::create_dir(path)?;
    if let Err(error) = set_private_directory_permissions(path) {
        let _ = fs::remove_dir(path);
        return Err(error);
    }
    sync_directory(
        path.parent()
            .ok_or(WindowsRecoveryStateError::InvalidState)?,
    )?;
    Ok(())
}

fn canonical_private_directory(path: &Path) -> Result<PathBuf, WindowsRecoveryStateError> {
    let metadata = fs::symlink_metadata(path)?;
    if !metadata.file_type().is_dir() || is_reparse_point(&metadata) {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    let canonical = path.canonicalize()?;
    if canonical != path {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::{MetadataExt, PermissionsExt};

        if metadata.uid() != unsafe { libc::geteuid() }
            || metadata.permissions().mode() & 0o077 != 0
        {
            return Err(WindowsRecoveryStateError::InvalidState);
        }
    }
    Ok(canonical)
}

fn canonical_directory(path: &Path) -> Result<PathBuf, WindowsRecoveryStateError> {
    let metadata = fs::symlink_metadata(path)?;
    if !metadata.file_type().is_dir() || is_reparse_point(&metadata) {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    path.canonicalize().map_err(Into::into)
}

fn canonical_regular_file(path: &Path) -> Result<PathBuf, WindowsRecoveryStateError> {
    let metadata = fs::symlink_metadata(path)?;
    if !metadata.file_type().is_file() || is_reparse_point(&metadata) {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    path.canonicalize().map_err(Into::into)
}

#[cfg(unix)]
fn set_private_directory_permissions(path: &Path) -> Result<(), WindowsRecoveryStateError> {
    use std::os::unix::fs::PermissionsExt;

    fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
    Ok(())
}

#[cfg(not(unix))]
fn set_private_directory_permissions(_path: &Path) -> Result<(), WindowsRecoveryStateError> {
    Ok(())
}

#[cfg(unix)]
fn open_private_lock_file(
    directory: &Path,
    name: &str,
    create: bool,
) -> Result<File, WindowsRecoveryStateError> {
    use std::os::unix::fs::{MetadataExt, OpenOptionsExt, PermissionsExt};

    let file = OpenOptions::new()
        .read(true)
        .write(true)
        .create(create)
        .mode(0o600)
        .custom_flags(libc::O_NOFOLLOW)
        .open(directory.join(name))?;
    let metadata = file.metadata()?;
    if !metadata.file_type().is_file()
        || metadata.len() != 0
        || metadata.nlink() != 1
        || metadata.uid() != unsafe { libc::geteuid() }
        || metadata.permissions().mode() & 0o077 != 0
    {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    Ok(file)
}

#[cfg(target_os = "windows")]
fn open_private_lock_file(
    directory: &Path,
    name: &str,
    create: bool,
) -> Result<File, WindowsRecoveryStateError> {
    use std::os::windows::fs::OpenOptionsExt;

    use windows_sys::Win32::Storage::FileSystem::FILE_FLAG_OPEN_REPARSE_POINT;

    let mut options = OpenOptions::new();
    options
        .read(true)
        .write(true)
        .create(create)
        .share_mode(0)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT);
    let file = options.open(directory.join(name))?;
    let metadata = file.metadata()?;
    if !metadata.file_type().is_file() || metadata.len() != 0 || is_reparse_point(&metadata) {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    Ok(file)
}

#[cfg(not(any(unix, target_os = "windows")))]
fn open_private_lock_file(
    _directory: &Path,
    _name: &str,
    _create: bool,
) -> Result<File, WindowsRecoveryStateError> {
    Err(WindowsRecoveryStateError::InvalidState)
}

struct ExclusiveFileLock {
    file: File,
}

struct StateLock {
    file: File,
}

impl StateLock {
    #[cfg(unix)]
    fn acquire(attempt_directory: &Path) -> Result<Self, WindowsRecoveryStateError> {
        use std::os::fd::AsRawFd;

        let file = open_private_lock_file(attempt_directory, STATE_LOCK_FILE_NAME, false)?;
        if unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX) } != 0 {
            return Err(io::Error::last_os_error().into());
        }
        Ok(Self { file })
    }

    #[cfg(target_os = "windows")]
    fn acquire(attempt_directory: &Path) -> Result<Self, WindowsRecoveryStateError> {
        open_private_lock_file(attempt_directory, STATE_LOCK_FILE_NAME, false)
            .map(|file| Self { file })
    }

    #[cfg(not(any(unix, target_os = "windows")))]
    fn acquire(_attempt_directory: &Path) -> Result<Self, WindowsRecoveryStateError> {
        Err(WindowsRecoveryStateError::InvalidState)
    }
}

impl Drop for StateLock {
    fn drop(&mut self) {
        #[cfg(unix)]
        {
            use std::os::fd::AsRawFd;

            let _ = unsafe { libc::flock(self.file.as_raw_fd(), libc::LOCK_UN) };
        }
    }
}

fn map_lock_contention(error: WindowsRecoveryStateError) -> WindowsRecoveryStateError {
    match error {
        WindowsRecoveryStateError::Io(error) if lock_open_is_contended(&error) => {
            WindowsRecoveryStateError::ActiveAttemptExists
        }
        error => error,
    }
}

#[cfg(target_os = "windows")]
fn lock_open_is_contended(error: &io::Error) -> bool {
    matches!(error.raw_os_error(), Some(32 | 33))
}

#[cfg(not(target_os = "windows"))]
fn lock_open_is_contended(_error: &io::Error) -> bool {
    false
}

impl ExclusiveFileLock {
    #[cfg(unix)]
    fn acquire(file: File) -> Result<Self, WindowsRecoveryStateError> {
        use std::os::fd::AsRawFd;

        if unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
            return Err(WindowsRecoveryStateError::ActiveAttemptExists);
        }
        Ok(Self { file })
    }

    #[cfg(target_os = "windows")]
    fn acquire(file: File) -> Result<Self, WindowsRecoveryStateError> {
        Ok(Self { file })
    }

    #[cfg(not(any(unix, target_os = "windows")))]
    fn acquire(_file: File) -> Result<Self, WindowsRecoveryStateError> {
        Err(WindowsRecoveryStateError::InvalidState)
    }
}

impl Drop for ExclusiveFileLock {
    fn drop(&mut self) {
        #[cfg(unix)]
        {
            use std::os::fd::AsRawFd;

            let _ = unsafe { libc::flock(self.file.as_raw_fd(), libc::LOCK_UN) };
        }
    }
}

struct StagingAttempt {
    path: PathBuf,
    armed: bool,
}

impl StagingAttempt {
    fn new(path: PathBuf) -> Self {
        Self { path, armed: true }
    }

    fn move_to(&mut self, path: PathBuf) {
        self.path = path;
    }

    fn disarm(&mut self) {
        self.armed = false;
    }
}

impl Drop for StagingAttempt {
    fn drop(&mut self) {
        if self.armed {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}

fn write_new_manifest(
    path: &Path,
    manifest: &WindowsRecoveryManifest,
) -> Result<(), WindowsRecoveryStateError> {
    let bytes = serde_json::to_vec_pretty(manifest)?;
    if bytes.len() as u64 > MAX_MANIFEST_BYTES {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    let parent = path
        .parent()
        .ok_or(WindowsRecoveryStateError::InvalidState)?;
    let mut staging = PrivateStagingFile::new(parent, "fitfreed-recovery-manifest", ".tmp")?;
    staging.file_mut()?.write_all(&bytes)?;
    staging.sync_and_close()?;
    staging.persist_noclobber(path)?;
    Ok(())
}

fn write_manifest(
    path: &Path,
    manifest: &WindowsRecoveryManifest,
) -> Result<(), WindowsRecoveryStateError> {
    let bytes = serde_json::to_vec_pretty(manifest)?;
    if bytes.len() as u64 > MAX_MANIFEST_BYTES {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    let parent = path
        .parent()
        .ok_or(WindowsRecoveryStateError::InvalidState)?;
    let mut staging = PrivateStagingFile::new(parent, "fitfreed-recovery-manifest", ".tmp")?;
    staging.file_mut()?.write_all(&bytes)?;
    staging.sync_and_close()?;
    staging.persist_replace(path)?;
    Ok(())
}

fn read_manifest(path: &Path) -> Result<WindowsRecoveryManifest, WindowsRecoveryStateError> {
    let bytes = read_bounded_file(path, MAX_MANIFEST_BYTES)?;
    serde_json::from_slice(&bytes).map_err(Into::into)
}

fn canonical_recovery_attempt(
    recovery_root: &Path,
    recovery_id: &str,
) -> Result<PathBuf, WindowsRecoveryStateError> {
    if !valid_sha256(recovery_id) {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    let attempts_directory =
        canonical_private_directory(&recovery_root.join(ATTEMPTS_DIRECTORY_NAME))?;
    canonical_private_directory(&attempts_directory.join(recovery_id))
}

fn canonical_windows_library_path(
    recovery_root: &Path,
    library_path: &Path,
) -> Result<PathBuf, WindowsRecoveryStateError> {
    if !library_path.is_absolute()
        || library_path.file_name().and_then(|name| name.to_str()) != Some(LIBRARY_FILE_NAME)
    {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    let library_path = canonical_regular_file(library_path)?;
    let application_data_directory = recovery_root
        .parent()
        .ok_or(WindowsRecoveryStateError::InvalidState)?;
    if library_path.parent() != Some(application_data_directory) {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    Ok(library_path)
}

fn canonical_windows_library_destination(
    recovery_root: &Path,
    library_path: &Path,
) -> Result<PathBuf, WindowsRecoveryStateError> {
    if !library_path.is_absolute()
        || library_path.file_name().and_then(|name| name.to_str()) != Some(LIBRARY_FILE_NAME)
    {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    let application_data_directory = canonical_directory(
        recovery_root
            .parent()
            .ok_or(WindowsRecoveryStateError::InvalidState)?,
    )?;
    let expected_path = application_data_directory.join(LIBRARY_FILE_NAME);
    if !paths_equal(&path_text(library_path)?, &path_text(&expected_path)?) {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    match fs::symlink_metadata(&expected_path) {
        Ok(metadata) => {
            if !metadata.file_type().is_file() || is_reparse_point(&metadata) {
                return Err(WindowsRecoveryStateError::InvalidState);
            }
            let canonical = expected_path.canonicalize()?;
            if !paths_equal(&path_text(&canonical)?, &path_text(&expected_path)?) {
                return Err(WindowsRecoveryStateError::InvalidState);
            }
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => {}
        Err(error) => return Err(error.into()),
    }
    Ok(expected_path)
}

fn write_active_recovery_id(
    path: &Path,
    recovery_id: &str,
) -> Result<(), WindowsRecoveryStateError> {
    if !valid_sha256(recovery_id) {
        return Err(WindowsRecoveryStateError::InvalidInput);
    }
    let parent = path
        .parent()
        .ok_or(WindowsRecoveryStateError::InvalidState)?;
    let mut staging = PrivateStagingFile::new(parent, "fitfreed-recovery-active", ".tmp")?;
    staging
        .file_mut()?
        .write_all(format!("{recovery_id}\n").as_bytes())?;
    staging.sync_and_close()?;
    staging.persist_noclobber(path).map_err(|error| {
        if error.kind() == io::ErrorKind::AlreadyExists {
            WindowsRecoveryStateError::ActiveAttemptExists
        } else {
            WindowsRecoveryStateError::Io(error)
        }
    })
}

fn read_active_recovery_id(path: &Path) -> Result<String, WindowsRecoveryStateError> {
    let bytes = read_bounded_file(path, 65)?;
    let text = std::str::from_utf8(&bytes).map_err(|_| WindowsRecoveryStateError::InvalidState)?;
    let recovery_id = text
        .strip_suffix('\n')
        .ok_or(WindowsRecoveryStateError::InvalidState)?;
    if bytes.len() != 65 || !valid_sha256(recovery_id) {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    Ok(recovery_id.to_owned())
}

fn read_bounded_file(
    path: &Path,
    maximum_bytes: u64,
) -> Result<Vec<u8>, WindowsRecoveryStateError> {
    let file = open_read_only_nofollow(path)?;
    let metadata = file.metadata()?;
    if !metadata.file_type().is_file()
        || is_reparse_point(&metadata)
        || metadata.len() == 0
        || metadata.len() > maximum_bytes
    {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    let mut bytes = Vec::with_capacity(
        usize::try_from(metadata.len()).map_err(|_| WindowsRecoveryStateError::InvalidState)?,
    );
    file.take(maximum_bytes + 1).read_to_end(&mut bytes)?;
    if bytes.len() as u64 != metadata.len() {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    Ok(bytes)
}

fn sync_prepared_attempt(path: &Path) -> Result<(), WindowsRecoveryStateError> {
    for name in [
        STATE_LOCK_FILE_NAME,
        CANDIDATE_LOCK_FILE_NAME,
        WATCHDOG_LOCK_FILE_NAME,
        MANIFEST_FILE_NAME,
    ] {
        File::open(path.join(name))?.sync_all()?;
    }
    File::open(path.join(PREDECESSOR_PACKAGE_RELATIVE_PATH))?.sync_all()?;
    File::open(path.join(TARGET_PACKAGE_RELATIVE_PATH))?.sync_all()?;
    File::open(path.join(LIBRARY_BACKUP_RELATIVE_PATH))?.sync_all()?;
    File::open(
        path.join(RUNNABLE_PREDECESSOR_RELATIVE_PATH)
            .join(RUNNABLE_EXECUTABLE_RELATIVE_PATH),
    )?
    .sync_all()?;
    File::open(
        path.join(RUNNABLE_PREDECESSOR_RELATIVE_PATH)
            .join(RUNNABLE_UNINSTALLER_RELATIVE_PATH),
    )?
    .sync_all()?;
    sync_directory(&path.join(RUNNABLE_PREDECESSOR_RELATIVE_PATH))?;
    sync_directory(&path.join("previous"))?;
    sync_directory(&path.join("candidate"))?;
    sync_directory(path)?;
    Ok(())
}

fn file_sha256(path: &Path, expected_size: u64) -> Result<String, WindowsRecoveryStateError> {
    let mut file = open_read_only_nofollow(path)?;
    let metadata = file.metadata()?;
    if !metadata.file_type().is_file()
        || is_reparse_point(&metadata)
        || metadata.len() != expected_size
    {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    let mut total = 0_u64;
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        total = total
            .checked_add(u64::try_from(read).map_err(|_| WindowsRecoveryStateError::InvalidState)?)
            .filter(|value| *value <= expected_size)
            .ok_or(WindowsRecoveryStateError::InvalidState)?;
        digest.update(&buffer[..read]);
    }
    if total != expected_size {
        return Err(WindowsRecoveryStateError::InvalidState);
    }
    Ok(lower_hex(&digest.finalize()))
}

fn open_read_only_nofollow(path: &Path) -> Result<File, WindowsRecoveryStateError> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;

        options.custom_flags(libc::O_NOFOLLOW);
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::fs::OpenOptionsExt;

        use windows_sys::Win32::Storage::FileSystem::FILE_FLAG_OPEN_REPARSE_POINT;

        options.custom_flags(FILE_FLAG_OPEN_REPARSE_POINT);
    }
    options.open(path).map_err(Into::into)
}

#[cfg(target_os = "windows")]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    use windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT;

    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(target_os = "windows"))]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

fn lower_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn path_entry_exists(path: &Path) -> Result<bool, WindowsRecoveryStateError> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.into()),
    }
}

#[cfg(all(test, unix))]
mod tests {
    use std::{
        cell::{Cell, RefCell},
        collections::VecDeque,
        io::Cursor,
        os::unix::fs::symlink,
    };

    use minisign::{sign, KeyPair};
    use rusqlite::Connection;
    use tempfile::TempDir;

    use super::*;
    use crate::infrastructure::ensure_schema;

    const SYNTHETIC_EXECUTABLE: &[u8] = b"synthetic FitFreed executable";
    const SYNTHETIC_UNINSTALLER: &[u8] = b"synthetic FitFreed uninstaller";

    struct SyntheticPackages {
        fail_preparation: bool,
        verification_count: Cell<u32>,
    }

    impl SyntheticPackages {
        fn available() -> Self {
            Self {
                fail_preparation: false,
                verification_count: Cell::new(0),
            }
        }
    }

    impl RecoveryPackagePort for SyntheticPackages {
        fn prepare(
            &self,
            attempt_directory: &Path,
            predecessor_source: &Path,
            predecessor: &WindowsRecoveryPackageExpectation,
            candidate_bytes: &[u8],
            candidate: &WindowsRecoveryPackageExpectation,
        ) -> Result<String, WindowsRecoveryPackageError> {
            fs::create_dir_all(attempt_directory.join(RUNNABLE_PREDECESSOR_RELATIVE_PATH))?;
            fs::create_dir_all(attempt_directory.join("candidate"))?;
            if self.fail_preparation {
                return Err(WindowsRecoveryPackageError::InvalidPackage);
            }
            fs::copy(
                predecessor_source,
                attempt_directory.join(PREDECESSOR_PACKAGE_RELATIVE_PATH),
            )?;
            fs::write(
                attempt_directory.join(TARGET_PACKAGE_RELATIVE_PATH),
                candidate_bytes,
            )?;
            fs::write(
                attempt_directory
                    .join(RUNNABLE_PREDECESSOR_RELATIVE_PATH)
                    .join(RUNNABLE_EXECUTABLE_RELATIVE_PATH),
                SYNTHETIC_EXECUTABLE,
            )?;
            fs::write(
                attempt_directory
                    .join(RUNNABLE_PREDECESSOR_RELATIVE_PATH)
                    .join(RUNNABLE_UNINSTALLER_RELATIVE_PATH),
                SYNTHETIC_UNINSTALLER,
            )?;
            assert_eq!(
                fs::metadata(attempt_directory.join(PREDECESSOR_PACKAGE_RELATIVE_PATH))?.len(),
                predecessor.size_bytes()
            );
            assert_eq!(candidate_bytes.len() as u64, candidate.size_bytes());
            Ok("9".repeat(64))
        }

        fn verify(
            &self,
            attempt_directory: &Path,
            predecessor: &WindowsRecoveryPackageExpectation,
            candidate: &WindowsRecoveryPackageExpectation,
            runnable_tree_sha256: &str,
        ) -> Result<(), WindowsRecoveryPackageError> {
            self.verification_count
                .set(self.verification_count.get() + 1);
            let predecessor_bytes =
                fs::read(attempt_directory.join(PREDECESSOR_PACKAGE_RELATIVE_PATH))?;
            let candidate_bytes = fs::read(attempt_directory.join(TARGET_PACKAGE_RELATIVE_PATH))?;
            let executable = fs::read(
                attempt_directory
                    .join(RUNNABLE_PREDECESSOR_RELATIVE_PATH)
                    .join(RUNNABLE_EXECUTABLE_RELATIVE_PATH),
            )?;
            let uninstaller = fs::read(
                attempt_directory
                    .join(RUNNABLE_PREDECESSOR_RELATIVE_PATH)
                    .join(RUNNABLE_UNINSTALLER_RELATIVE_PATH),
            )?;
            if predecessor_bytes.len() as u64 != predecessor.size_bytes()
                || lower_hex(&Sha256::digest(&predecessor_bytes)) != predecessor.sha256()
                || candidate_bytes.len() as u64 != candidate.size_bytes()
                || lower_hex(&Sha256::digest(&candidate_bytes)) != candidate.sha256()
                || executable != SYNTHETIC_EXECUTABLE
                || uninstaller != SYNTHETIC_UNINSTALLER
                || runnable_tree_sha256 != "9".repeat(64)
            {
                return Err(WindowsRecoveryPackageError::InvalidPackage);
            }
            Ok(())
        }
    }

    struct SyntheticNativeRecovery {
        outcomes: RefCell<VecDeque<Result<(), WindowsUpdateRecoveryError>>>,
        observed_attempts: RefCell<Vec<(PathBuf, String)>>,
    }

    struct SyntheticInstalledState {
        identity: InstalledIdentity,
        runnable_match: bool,
    }

    impl SyntheticInstalledState {
        fn new(harness: &Harness, version: &str, runnable_match: bool) -> Self {
            let mut identity = harness.identity.clone();
            identity.version = version.to_owned();
            Self {
                identity,
                runnable_match,
            }
        }
    }

    impl WindowsInstalledStatePort for SyntheticInstalledState {
        fn identity(&self) -> Result<InstalledIdentity, WindowsRecoveryStateError> {
            Ok(self.identity.clone())
        }

        fn verify_matches_runnable(
            &self,
            _attempt_directory: &Path,
        ) -> Result<InstalledIdentity, WindowsRecoveryStateError> {
            if self.runnable_match {
                Ok(self.identity.clone())
            } else {
                Err(WindowsRecoveryStateError::InvalidState)
            }
        }
    }

    impl SyntheticNativeRecovery {
        fn new(outcomes: Vec<Result<(), WindowsUpdateRecoveryError>>) -> Self {
            Self {
                outcomes: RefCell::new(outcomes.into()),
                observed_attempts: RefCell::new(Vec::new()),
            }
        }
    }

    impl WindowsNativeRecoveryPort for SyntheticNativeRecovery {
        fn reinstall_and_verify(
            &self,
            attempt_directory: &Path,
            expected_version: &str,
            _expected_identity: &NativePackageIdentity,
        ) -> Result<(), WindowsUpdateRecoveryError> {
            self.observed_attempts
                .borrow_mut()
                .push((attempt_directory.to_owned(), expected_version.to_owned()));
            self.outcomes
                .borrow_mut()
                .pop_front()
                .expect("configured native recovery outcome")
        }
    }

    struct Harness {
        _directory: TempDir,
        recovery_root: PathBuf,
        library_path: PathBuf,
        predecessor_path: PathBuf,
        candidate_bytes: Vec<u8>,
        authorization: UpdateInstallationAuthorization,
        identity: InstalledIdentity,
    }

    impl Harness {
        fn new() -> Self {
            let directory = TempDir::new().expect("temporary directory");
            let root = directory.path().canonicalize().expect("canonical root");
            let install_directory = root.join("installed");
            let application_data_directory = root.join("application-data");
            fs::create_dir(&install_directory).expect("installation directory");
            fs::create_dir(&application_data_directory).expect("application-data directory");
            let executable_path = install_directory.join(RUNNABLE_EXECUTABLE_RELATIVE_PATH);
            let uninstaller_path = install_directory.join(RUNNABLE_UNINSTALLER_RELATIVE_PATH);
            fs::write(&executable_path, SYNTHETIC_EXECUTABLE).expect("installed executable");
            fs::write(&uninstaller_path, SYNTHETIC_UNINSTALLER).expect("installed uninstaller");
            let library_path = application_data_directory.join(LIBRARY_FILE_NAME);
            let connection = Connection::open(&library_path).expect("library");
            ensure_schema(&connection).expect("current library schema");
            drop(connection);
            let predecessor_path = root.join("predecessor.exe");
            let predecessor_bytes = b"synthetic predecessor package";
            let candidate_bytes = b"synthetic candidate package".to_vec();
            fs::write(&predecessor_path, predecessor_bytes).expect("predecessor package");
            let key_pair = KeyPair::generate_unencrypted_keypair().expect("synthetic key pair");
            let artifact = |bytes: &[u8], version: &str| UpdateArtifact {
                target: UPDATE_TARGET.to_owned(),
                package_url: format!(
                    "https://updates.invalid/{version}/FitFreed_{version}_x64-setup.exe"
                ),
                expected_size_bytes: bytes.len() as u64,
                expected_sha256: lower_hex(&Sha256::digest(bytes)),
                package_signature: BASE64.encode(
                    sign(
                        Some(&key_pair.pk),
                        &key_pair.sk,
                        Cursor::new(bytes),
                        Some("synthetic package"),
                        Some("untrusted comment: synthetic package"),
                    )
                    .expect("synthetic package signature")
                    .into_string(),
                ),
            };
            let authorization = UpdateInstallationAuthorization {
                version: "0.2.0".to_owned(),
                trusted_sequence: 17,
                trusted_payload_sha256: "8".repeat(64),
                signing_key_id: "stable.synthetic-1".to_owned(),
                target_library_schema_version: u32::try_from(SCHEMA_VERSION)
                    .expect("current schema"),
                artifact: artifact(&candidate_bytes, "0.2.0"),
                predecessor_artifact: Some(artifact(predecessor_bytes, "0.1.0")),
            };
            Self {
                _directory: directory,
                recovery_root: application_data_directory.join("update-recovery"),
                library_path,
                predecessor_path,
                candidate_bytes,
                authorization,
                identity: InstalledIdentity {
                    version: "0.1.0".to_owned(),
                    install_directory,
                    executable_path,
                    uninstaller_path,
                    application_data_directory,
                },
            }
        }

        fn preparation(&self) -> WindowsUpdateRecoveryPreparation<'_> {
            WindowsUpdateRecoveryPreparation {
                recovery_root: &self.recovery_root,
                library_path: &self.library_path,
                installed_version: "0.1.0",
                prepared_at: "2026-09-04T08:00:00Z",
                authorization: &self.authorization,
                predecessor_package_path: &self.predecessor_path,
                candidate_package_bytes: &self.candidate_bytes,
            }
        }
    }

    fn prepare_with_watchdog(
        harness: &Harness,
        packages: &SyntheticPackages,
    ) -> (
        PreparedWindowsUpdateRecovery,
        WindowsUpdateRecoveryWatchdogContext,
        WindowsUpdateRecoveryWatchdogLease,
    ) {
        let prepared = prepare_windows_update_recovery_with(
            packages,
            &harness.identity,
            harness.preparation(),
        )
        .expect("prepared recovery");
        let watchdog_executable = prepared
            .attempt_directory()
            .join(RUNNABLE_PREDECESSOR_RELATIVE_PATH)
            .join(RUNNABLE_EXECUTABLE_RELATIVE_PATH);
        let context = resolve_windows_update_recovery_watchdog_context_with(
            packages,
            &watchdog_executable,
            &harness.identity.executable_path,
        )
        .expect("watchdog context");
        let watchdog = acquire_windows_update_recovery_watchdog_lease_with(packages, &context)
            .expect("watchdog lease");
        (prepared, context, watchdog)
    }

    fn prepare_confirmed_candidate(
        harness: &Harness,
        packages: &SyntheticPackages,
    ) -> (
        PreparedWindowsUpdateRecovery,
        WindowsUpdateRecoveryCandidateLease,
    ) {
        let prepared = prepare_windows_update_recovery_with(
            packages,
            &harness.identity,
            harness.preparation(),
        )
        .expect("prepared recovery");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementStarted,
        )
        .expect("replacement started");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementInstalled,
        )
        .expect("replacement installed");
        let process = WindowsRecoveryProcessIdentity::for_test(
            42,
            133_713_371_337,
            &harness.identity.executable_path,
        );
        let launch_nonce = "7".repeat(64);
        record_active_windows_update_recovery_replacement_launch(
            &harness.recovery_root,
            prepared.recovery_id(),
            WindowsUpdateRecoveryReplacementLaunch {
                process: &process,
                launch_nonce: &launch_nonce,
                confirmation_deadline: "2026-09-04T08:05:00Z",
            },
        )
        .expect("recorded replacement launch");
        let mut candidate_identity = harness.identity.clone();
        candidate_identity.version = "0.2.0".to_owned();
        let candidate = acquire_windows_update_recovery_candidate_lease_with(
            packages,
            &harness.recovery_root,
            prepared.recovery_id(),
            &launch_nonce,
            &process,
            &candidate_identity,
        )
        .expect("candidate lease");
        confirm_active_windows_update_recovery_with(
            packages,
            &candidate_identity,
            &candidate,
            &harness.recovery_root,
            &harness.library_path,
            "0.2.0",
            u32::try_from(SCHEMA_VERSION).expect("schema version"),
        )
        .expect("confirmed candidate");
        (prepared, candidate)
    }

    #[test]
    fn prepares_publishes_and_reopens_one_complete_version_three_attempt() {
        let harness = Harness::new();
        let packages = SyntheticPackages::available();

        let prepared = prepare_windows_update_recovery_with(
            &packages,
            &harness.identity,
            harness.preparation(),
        )
        .expect("prepared Windows recovery");

        assert!(valid_sha256(prepared.recovery_id()));
        assert_eq!(
            prepared.source_library_schema_version(),
            u32::try_from(SCHEMA_VERSION).expect("current schema")
        );
        assert_eq!(
            read_active_recovery_id(&harness.recovery_root.join(ACTIVE_FILE_NAME))
                .expect("active recovery"),
            prepared.recovery_id()
        );
        let manifest = verify_windows_update_recovery_with(
            &packages,
            &harness.recovery_root,
            prepared.recovery_id(),
        )
        .expect("verified Windows recovery");
        assert_eq!(manifest.schema_version, RECOVERY_SCHEMA_VERSION);
        assert_eq!(manifest.phase, WindowsRecoveryPhaseWire::Prepared);
        assert_eq!(manifest.source.version, "0.1.0");
        assert_eq!(manifest.target.version, "0.2.0");
        assert_eq!(manifest.runnable_predecessor.tree_sha256, "9".repeat(64));
        assert_eq!(packages.verification_count.get(), 2);
    }

    #[test]
    fn rejects_changed_authority_before_creating_recovery_state() {
        for mutate in [
            |harness: &mut Harness| {
                harness.authorization.artifact.target = "darwin-aarch64".to_owned()
            },
            |harness: &mut Harness| harness.authorization.version = "0.1.0".to_owned(),
            |harness: &mut Harness| harness.authorization.signing_key_id = "Invalid Key".to_owned(),
        ] {
            let mut harness = Harness::new();
            mutate(&mut harness);
            assert!(matches!(
                prepare_windows_update_recovery_with(
                    &SyntheticPackages::available(),
                    &harness.identity,
                    harness.preparation(),
                ),
                Err(WindowsRecoveryStateError::InvalidInput)
            ));
            assert!(!harness.recovery_root.exists());
        }
    }

    #[test]
    fn removes_incomplete_preparation_and_preserves_an_active_attempt() {
        let harness = Harness::new();
        let packages = SyntheticPackages {
            fail_preparation: true,
            verification_count: Cell::new(0),
        };
        assert!(matches!(
            prepare_windows_update_recovery_with(
                &packages,
                &harness.identity,
                harness.preparation(),
            ),
            Err(WindowsRecoveryStateError::Package(_))
        ));
        assert_eq!(
            fs::read_dir(harness.recovery_root.join(ATTEMPTS_DIRECTORY_NAME))
                .expect("empty attempts")
                .count(),
            0
        );

        let packages = SyntheticPackages::available();
        let prepared = prepare_windows_update_recovery_with(
            &packages,
            &harness.identity,
            harness.preparation(),
        )
        .expect("prepared recovery");
        assert!(matches!(
            prepare_windows_update_recovery_with(
                &packages,
                &harness.identity,
                harness.preparation(),
            ),
            Err(WindowsRecoveryStateError::ActiveAttemptExists)
        ));
        assert!(prepared.attempt_directory().exists());
    }

    #[test]
    fn detects_package_runnable_library_and_manifest_mutation_after_publication() {
        for mutate in [
            |attempt: &Path| {
                fs::write(
                    attempt.join(TARGET_PACKAGE_RELATIVE_PATH),
                    "changed package",
                )
                .expect("changed package")
            },
            |attempt: &Path| {
                fs::write(
                    attempt
                        .join(RUNNABLE_PREDECESSOR_RELATIVE_PATH)
                        .join(RUNNABLE_EXECUTABLE_RELATIVE_PATH),
                    "changed executable",
                )
                .expect("changed executable")
            },
            |attempt: &Path| {
                fs::write(
                    attempt.join(LIBRARY_BACKUP_RELATIVE_PATH),
                    "changed library",
                )
                .expect("changed library")
            },
            |attempt: &Path| {
                let path = attempt.join(MANIFEST_FILE_NAME);
                let mut value: serde_json::Value =
                    serde_json::from_slice(&fs::read(&path).expect("manifest"))
                        .expect("manifest JSON");
                value["platform"]["os"] = serde_json::Value::String("linux".to_owned());
                fs::write(
                    path,
                    serde_json::to_vec_pretty(&value).expect("changed manifest"),
                )
                .expect("changed manifest")
            },
        ] {
            let harness = Harness::new();
            let packages = SyntheticPackages::available();
            let prepared = prepare_windows_update_recovery_with(
                &packages,
                &harness.identity,
                harness.preparation(),
            )
            .expect("prepared recovery");
            mutate(prepared.attempt_directory());
            assert!(verify_windows_update_recovery_with(
                &packages,
                &harness.recovery_root,
                prepared.recovery_id(),
            )
            .is_err());
        }
    }

    #[test]
    fn rejects_redirected_recovery_objects() {
        let harness = Harness::new();
        let redirected_root = harness
            .recovery_root
            .parent()
            .expect("application-data directory")
            .join("redirected-root");
        create_private_directory(&redirected_root).expect("redirected root");
        symlink(&redirected_root, &harness.recovery_root).expect("recovery-root symlink");
        assert!(matches!(
            prepare_windows_update_recovery_with(
                &SyntheticPackages::available(),
                &harness.identity,
                harness.preparation(),
            ),
            Err(WindowsRecoveryStateError::InvalidState)
        ));

        let harness = Harness::new();
        let packages = SyntheticPackages::available();
        let prepared = prepare_windows_update_recovery_with(
            &packages,
            &harness.identity,
            harness.preparation(),
        )
        .expect("prepared recovery");
        let state_lock = prepared.attempt_directory().join(STATE_LOCK_FILE_NAME);
        fs::remove_file(&state_lock).expect("removed state lock");
        symlink(
            prepared.attempt_directory().join(CANDIDATE_LOCK_FILE_NAME),
            state_lock,
        )
        .expect("redirected state lock");
        assert!(verify_windows_update_recovery_with(
            &packages,
            &harness.recovery_root,
            prepared.recovery_id(),
        )
        .is_err());
    }

    #[test]
    fn resolves_the_active_prepared_phase_from_verified_state() {
        let harness = Harness::new();
        let packages = SyntheticPackages::available();
        assert_eq!(
            active_windows_update_recovery_phase_with(&packages, &harness.recovery_root)
                .expect("absent recovery"),
            None
        );
        let prepared = prepare_windows_update_recovery_with(
            &packages,
            &harness.identity,
            harness.preparation(),
        )
        .expect("prepared recovery");

        assert_eq!(
            active_windows_update_recovery_phase_with(&packages, &harness.recovery_root)
                .expect("active recovery phase"),
            Some((
                prepared.recovery_id().to_owned(),
                PackagedUpdateRecoveryPhase::Prepared,
            ))
        );
    }

    #[test]
    fn rejects_a_second_outcome_lock_owner() {
        let harness = Harness::new();
        create_private_directory(&harness.recovery_root).expect("recovery root");
        let outcome_file =
            open_private_lock_file(&harness.recovery_root, OUTCOME_LOCK_FILE_NAME, true)
                .expect("outcome lock file");
        let _held = ExclusiveFileLock::acquire(outcome_file).expect("exclusive outcome lock");

        assert!(matches!(
            prepare_windows_update_recovery_with(
                &SyntheticPackages::available(),
                &harness.identity,
                harness.preparation(),
            ),
            Err(WindowsRecoveryStateError::ActiveAttemptExists)
        ));
        assert!(!harness.recovery_root.join(ATTEMPTS_DIRECTORY_NAME).exists());
    }

    #[test]
    fn persists_only_legal_transitions_and_exact_windows_process_evidence() {
        let harness = Harness::new();
        let packages = SyntheticPackages::available();
        let prepared = prepare_windows_update_recovery_with(
            &packages,
            &harness.identity,
            harness.preparation(),
        )
        .expect("prepared recovery");

        assert!(transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::Launching,
        )
        .is_err());
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementStarted,
        )
        .expect("replacement started");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementInstalled,
        )
        .expect("replacement installed");

        let process = WindowsRecoveryProcessIdentity::for_test(
            42,
            133_713_371_337,
            &harness.identity.executable_path,
        );
        let recorded = record_active_windows_update_recovery_replacement_launch(
            &harness.recovery_root,
            prepared.recovery_id(),
            WindowsUpdateRecoveryReplacementLaunch {
                process: &process,
                launch_nonce: &"7".repeat(64),
                confirmation_deadline: "2026-09-04T08:05:00Z",
            },
        )
        .expect("recorded replacement launch");

        assert_eq!(recorded.process_id(), 42);
        assert_eq!(recorded.creation_time_filetime(), 133_713_371_337);
        assert_eq!(recorded.launch_nonce(), "7".repeat(64));
        assert_eq!(recorded.confirmation_deadline(), "2026-09-04T08:05:00Z");
        assert_eq!(
            active_windows_update_recovery_phase_with(&packages, &harness.recovery_root)
                .expect("launching phase")
                .map(|(_, phase)| phase),
            Some(PackagedUpdateRecoveryPhase::Launching)
        );
    }

    #[test]
    fn rejects_changed_windows_process_evidence_without_mutating_the_phase() {
        let harness = Harness::new();
        let packages = SyntheticPackages::available();
        let prepared = prepare_windows_update_recovery_with(
            &packages,
            &harness.identity,
            harness.preparation(),
        )
        .expect("prepared recovery");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementStarted,
        )
        .expect("replacement started");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementInstalled,
        )
        .expect("replacement installed");
        let changed_executable = harness.identity.install_directory.join("changed.exe");
        fs::write(&changed_executable, "changed executable").expect("changed executable");
        let process =
            WindowsRecoveryProcessIdentity::for_test(42, 133_713_371_337, &changed_executable);

        assert!(record_active_windows_update_recovery_replacement_launch(
            &harness.recovery_root,
            prepared.recovery_id(),
            WindowsUpdateRecoveryReplacementLaunch {
                process: &process,
                launch_nonce: &"7".repeat(64),
                confirmation_deadline: "2026-09-04T08:05:00Z",
            },
        )
        .is_err());
        assert_eq!(
            active_windows_update_recovery_phase_with(&packages, &harness.recovery_root)
                .expect("unchanged phase")
                .map(|(_, phase)| phase),
            Some(PackagedUpdateRecoveryPhase::ReplacementInstalled)
        );
    }

    #[test]
    fn resolves_watchdog_authority_only_from_the_preserved_windows_executable() {
        let harness = Harness::new();
        let packages = SyntheticPackages::available();
        let prepared = prepare_windows_update_recovery_with(
            &packages,
            &harness.identity,
            harness.preparation(),
        )
        .expect("prepared recovery");
        let watchdog_executable = prepared
            .attempt_directory()
            .join(RUNNABLE_PREDECESSOR_RELATIVE_PATH)
            .join(RUNNABLE_EXECUTABLE_RELATIVE_PATH);

        let context = resolve_windows_update_recovery_watchdog_context_with(
            &packages,
            &watchdog_executable,
            &harness.identity.executable_path,
        )
        .expect("watchdog context");
        assert_eq!(context.recovery_id(), prepared.recovery_id());
        assert_eq!(context.library_path(), harness.library_path);
        assert_eq!(context.target_version(), "0.2.0");
        assert_eq!(context.replacement_process(), None);

        assert!(resolve_windows_update_recovery_watchdog_context_with(
            &packages,
            &watchdog_executable,
            &harness.identity.uninstaller_path,
        )
        .is_err());
        assert!(resolve_windows_update_recovery_watchdog_context_with(
            &packages,
            &prepared
                .attempt_directory()
                .join(PREDECESSOR_PACKAGE_RELATIVE_PATH),
            &harness.identity.executable_path,
        )
        .is_err());
    }

    #[test]
    fn permits_only_one_windows_watchdog_and_one_exact_candidate_process() {
        let harness = Harness::new();
        let packages = SyntheticPackages::available();
        let prepared = prepare_windows_update_recovery_with(
            &packages,
            &harness.identity,
            harness.preparation(),
        )
        .expect("prepared recovery");
        let watchdog_executable = prepared
            .attempt_directory()
            .join(RUNNABLE_PREDECESSOR_RELATIVE_PATH)
            .join(RUNNABLE_EXECUTABLE_RELATIVE_PATH);
        let context = resolve_windows_update_recovery_watchdog_context_with(
            &packages,
            &watchdog_executable,
            &harness.identity.executable_path,
        )
        .expect("watchdog context");

        let watchdog = acquire_windows_update_recovery_watchdog_lease_with(&packages, &context)
            .expect("watchdog lease");
        assert_eq!(watchdog.recovery_id(), prepared.recovery_id());
        assert!(matches!(
            acquire_windows_update_recovery_watchdog_lease_with(&packages, &context),
            Err(WindowsRecoveryStateError::ActiveAttemptExists)
        ));

        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementStarted,
        )
        .expect("replacement started");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementInstalled,
        )
        .expect("replacement installed");
        let process = WindowsRecoveryProcessIdentity::for_test(
            42,
            133_713_371_337,
            &harness.identity.executable_path,
        );
        let launch_nonce = "7".repeat(64);
        record_active_windows_update_recovery_replacement_launch(
            &harness.recovery_root,
            prepared.recovery_id(),
            WindowsUpdateRecoveryReplacementLaunch {
                process: &process,
                launch_nonce: &launch_nonce,
                confirmation_deadline: "2026-09-04T08:05:00Z",
            },
        )
        .expect("recorded replacement launch");
        let mut candidate_identity = harness.identity.clone();
        candidate_identity.version = "0.2.0".to_owned();

        let candidate = acquire_windows_update_recovery_candidate_lease_with(
            &packages,
            &harness.recovery_root,
            prepared.recovery_id(),
            &launch_nonce,
            &process,
            &candidate_identity,
        )
        .expect("candidate lease");
        assert_eq!(candidate.recovery_id(), prepared.recovery_id());
        assert_eq!(candidate.launch_nonce(), launch_nonce);
        assert!(matches!(
            acquire_windows_update_recovery_candidate_lease_with(
                &packages,
                &harness.recovery_root,
                prepared.recovery_id(),
                &launch_nonce,
                &process,
                &candidate_identity,
            ),
            Err(WindowsRecoveryStateError::ActiveAttemptExists)
        ));

        drop(candidate);
        assert!(acquire_windows_update_recovery_candidate_lease_with(
            &packages,
            &harness.recovery_root,
            prepared.recovery_id(),
            &"8".repeat(64),
            &process,
            &candidate_identity,
        )
        .is_err());
        drop(watchdog);
        acquire_windows_update_recovery_watchdog_lease_with(&packages, &context)
            .expect("released watchdog lease");
    }

    #[test]
    fn rejects_candidate_authority_when_process_or_package_identity_differs() {
        for changed_process in [
            WindowsRecoveryProcessIdentity::for_test(43, 133_713_371_337, Path::new("/unused")),
            WindowsRecoveryProcessIdentity::for_test(42, 133_713_371_338, Path::new("/unused")),
        ] {
            let harness = Harness::new();
            let packages = SyntheticPackages::available();
            let prepared = prepare_windows_update_recovery_with(
                &packages,
                &harness.identity,
                harness.preparation(),
            )
            .expect("prepared recovery");
            transition_active_windows_update_recovery(
                &harness.recovery_root,
                prepared.recovery_id(),
                PackagedUpdateRecoveryPhase::ReplacementStarted,
            )
            .expect("replacement started");
            transition_active_windows_update_recovery(
                &harness.recovery_root,
                prepared.recovery_id(),
                PackagedUpdateRecoveryPhase::ReplacementInstalled,
            )
            .expect("replacement installed");
            let recorded_process = WindowsRecoveryProcessIdentity::for_test(
                42,
                133_713_371_337,
                &harness.identity.executable_path,
            );
            let changed_process = WindowsRecoveryProcessIdentity::for_test(
                changed_process.process_id(),
                changed_process.creation_time_filetime(),
                &harness.identity.executable_path,
            );
            let launch_nonce = "7".repeat(64);
            record_active_windows_update_recovery_replacement_launch(
                &harness.recovery_root,
                prepared.recovery_id(),
                WindowsUpdateRecoveryReplacementLaunch {
                    process: &recorded_process,
                    launch_nonce: &launch_nonce,
                    confirmation_deadline: "2026-09-04T08:05:00Z",
                },
            )
            .expect("recorded replacement launch");
            let mut candidate_identity = harness.identity.clone();
            candidate_identity.version = "0.2.0".to_owned();

            assert!(acquire_windows_update_recovery_candidate_lease_with(
                &packages,
                &harness.recovery_root,
                prepared.recovery_id(),
                &launch_nonce,
                &changed_process,
                &candidate_identity,
            )
            .is_err());
        }

        let harness = Harness::new();
        let packages = SyntheticPackages::available();
        let prepared = prepare_windows_update_recovery_with(
            &packages,
            &harness.identity,
            harness.preparation(),
        )
        .expect("prepared recovery");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementStarted,
        )
        .expect("replacement started");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementInstalled,
        )
        .expect("replacement installed");
        let process = WindowsRecoveryProcessIdentity::for_test(
            42,
            133_713_371_337,
            &harness.identity.executable_path,
        );
        let launch_nonce = "7".repeat(64);
        record_active_windows_update_recovery_replacement_launch(
            &harness.recovery_root,
            prepared.recovery_id(),
            WindowsUpdateRecoveryReplacementLaunch {
                process: &process,
                launch_nonce: &launch_nonce,
                confirmation_deadline: "2026-09-04T08:05:00Z",
            },
        )
        .expect("recorded replacement launch");
        let changed_identity = harness.identity.clone();

        assert!(acquire_windows_update_recovery_candidate_lease_with(
            &packages,
            &harness.recovery_root,
            prepared.recovery_id(),
            &launch_nonce,
            &process,
            &changed_identity,
        )
        .is_err());
    }

    #[test]
    fn confirms_only_the_exact_leased_windows_candidate_and_library() {
        let harness = Harness::new();
        let packages = SyntheticPackages::available();
        let prepared = prepare_windows_update_recovery_with(
            &packages,
            &harness.identity,
            harness.preparation(),
        )
        .expect("prepared recovery");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementStarted,
        )
        .expect("replacement started");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementInstalled,
        )
        .expect("replacement installed");
        let process = WindowsRecoveryProcessIdentity::for_test(
            42,
            133_713_371_337,
            &harness.identity.executable_path,
        );
        let launch_nonce = "7".repeat(64);
        record_active_windows_update_recovery_replacement_launch(
            &harness.recovery_root,
            prepared.recovery_id(),
            WindowsUpdateRecoveryReplacementLaunch {
                process: &process,
                launch_nonce: &launch_nonce,
                confirmation_deadline: "2026-09-04T08:05:00Z",
            },
        )
        .expect("recorded replacement launch");
        assert!(transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::Confirmed,
        )
        .is_err());
        let mut candidate_identity = harness.identity.clone();
        candidate_identity.version = "0.2.0".to_owned();
        let candidate = acquire_windows_update_recovery_candidate_lease_with(
            &packages,
            &harness.recovery_root,
            prepared.recovery_id(),
            &launch_nonce,
            &process,
            &candidate_identity,
        )
        .expect("candidate lease");

        assert!(confirm_active_windows_update_recovery_with(
            &packages,
            &candidate_identity,
            &candidate,
            &harness.recovery_root,
            &harness.library_path,
            "0.2.0",
            u32::try_from(SCHEMA_VERSION).expect("schema version"),
        )
        .is_ok());
        assert_eq!(
            active_windows_update_recovery_phase_with(&packages, &harness.recovery_root)
                .expect("confirmed phase")
                .map(|(_, phase)| phase),
            Some(PackagedUpdateRecoveryPhase::Confirmed)
        );
    }

    #[test]
    fn rejected_windows_confirmation_preserves_the_launching_phase() {
        let harness = Harness::new();
        let packages = SyntheticPackages::available();
        let prepared = prepare_windows_update_recovery_with(
            &packages,
            &harness.identity,
            harness.preparation(),
        )
        .expect("prepared recovery");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementStarted,
        )
        .expect("replacement started");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementInstalled,
        )
        .expect("replacement installed");
        let process = WindowsRecoveryProcessIdentity::for_test(
            42,
            133_713_371_337,
            &harness.identity.executable_path,
        );
        let launch_nonce = "7".repeat(64);
        record_active_windows_update_recovery_replacement_launch(
            &harness.recovery_root,
            prepared.recovery_id(),
            WindowsUpdateRecoveryReplacementLaunch {
                process: &process,
                launch_nonce: &launch_nonce,
                confirmation_deadline: "2026-09-04T08:05:00Z",
            },
        )
        .expect("recorded replacement launch");
        let mut candidate_identity = harness.identity.clone();
        candidate_identity.version = "0.2.0".to_owned();
        let candidate = acquire_windows_update_recovery_candidate_lease_with(
            &packages,
            &harness.recovery_root,
            prepared.recovery_id(),
            &launch_nonce,
            &process,
            &candidate_identity,
        )
        .expect("candidate lease");

        assert!(confirm_active_windows_update_recovery_with(
            &packages,
            &candidate_identity,
            &candidate,
            &harness.recovery_root,
            &harness.library_path,
            "0.2.0",
            u32::try_from(SCHEMA_VERSION).expect("schema version") + 1,
        )
        .is_err());
        assert_eq!(
            active_windows_update_recovery_phase_with(&packages, &harness.recovery_root)
                .expect("unchanged phase")
                .map(|(_, phase)| phase),
            Some(PackagedUpdateRecoveryPhase::Launching)
        );
    }

    #[test]
    fn resolves_active_windows_restart_authority_and_discard_boundaries() {
        let harness = Harness::new();
        let packages = SyntheticPackages::available();
        let prepared = prepare_windows_update_recovery_with(
            &packages,
            &harness.identity,
            harness.preparation(),
        )
        .expect("prepared recovery");

        let (context, phase) = resolve_active_windows_update_recovery_watchdog_context_with(
            &packages,
            &harness.recovery_root,
            &harness.identity.executable_path,
        )
        .expect("active recovery lookup")
        .expect("active recovery");
        assert_eq!(context.recovery_id(), prepared.recovery_id());
        assert_eq!(phase, PackagedUpdateRecoveryPhase::Prepared);

        let watchdog = acquire_windows_update_recovery_watchdog_lease_with(&packages, &context)
            .expect("watchdog lease");
        assert!(matches!(
            discard_prepared_windows_update_recovery_with(
                &packages,
                &harness.recovery_root,
                prepared.recovery_id(),
            ),
            Err(WindowsRecoveryStateError::ActiveAttemptExists)
        ));
        assert!(prepared.attempt_directory().exists());
        drop(watchdog);

        discard_prepared_windows_update_recovery_with(
            &packages,
            &harness.recovery_root,
            prepared.recovery_id(),
        )
        .expect("discarded prepared recovery");
        assert!(!prepared.attempt_directory().exists());
        assert!(
            resolve_active_windows_update_recovery_watchdog_context_with(
                &packages,
                &harness.recovery_root,
                &harness.identity.executable_path,
            )
            .expect("inactive recovery lookup")
            .is_none()
        );

        let second = Harness::new();
        let second_packages = SyntheticPackages::available();
        let second_prepared = prepare_windows_update_recovery_with(
            &second_packages,
            &second.identity,
            second.preparation(),
        )
        .expect("second prepared recovery");
        transition_active_windows_update_recovery(
            &second.recovery_root,
            second_prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementStarted,
        )
        .expect("replacement started");
        assert!(discard_prepared_windows_update_recovery_with(
            &second_packages,
            &second.recovery_root,
            second_prepared.recovery_id(),
        )
        .is_err());
        assert!(second_prepared.attempt_directory().exists());
    }

    #[test]
    fn begins_and_cancels_only_an_available_windows_native_recovery_retry() {
        let harness = Harness::new();
        let packages = SyntheticPackages::available();
        let (prepared, _context, watchdog) = prepare_with_watchdog(&harness, &packages);
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementStarted,
        )
        .expect("replacement started");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::Recovering,
        )
        .expect("recovering");
        restore_active_windows_update_recovery_with(
            &packages,
            &SyntheticNativeRecovery::new(vec![Err(
                WindowsUpdateRecoveryError::NativeRollbackFailed,
            )]),
            &watchdog,
            WindowsUpdateRecoveryRestoration {
                recovery_root: &harness.recovery_root,
                recovery_id: prepared.recovery_id(),
                expected_library_path: &harness.library_path,
            },
        )
        .expect("failed native restoration");
        drop(watchdog);

        assert_eq!(
            query_windows_update_recovery_intervention_with(
                &packages,
                &harness.recovery_root,
                &harness.identity.executable_path,
            )
            .expect("retry intervention")
            .map(|intervention| intervention.attempts_completed),
            Some(1)
        );
        let context = begin_windows_update_recovery_retry_with(
            &packages,
            &harness.recovery_root,
            &harness.identity.executable_path,
        )
        .expect("began retry");
        assert_eq!(
            active_windows_update_recovery_phase_with(&packages, &harness.recovery_root)
                .expect("recovering phase")
                .map(|(_, phase)| phase),
            Some(PackagedUpdateRecoveryPhase::Recovering)
        );
        let watchdog = acquire_windows_update_recovery_watchdog_lease_with(&packages, &context)
            .expect("retry watchdog lease");
        cancel_windows_update_recovery_retry(&context, &watchdog).expect("cancelled retry");
        assert_eq!(
            active_windows_update_recovery_phase_with(&packages, &harness.recovery_root)
                .expect("retry available again")
                .map(|(_, phase)| phase),
            Some(PackagedUpdateRecoveryPhase::NativeRecoveryUnavailable)
        );
    }

    #[test]
    fn retains_and_resumes_one_confirmed_windows_outcome_after_processes_release_it() {
        let harness = Harness::new();
        let packages = SyntheticPackages::available();
        let (prepared, candidate) = prepare_confirmed_candidate(&harness, &packages);
        let installed = SyntheticInstalledState::new(&harness, "0.2.0", true);
        let watchdog_executable = prepared
            .attempt_directory()
            .join(RUNNABLE_PREDECESSOR_RELATIVE_PATH)
            .join(RUNNABLE_EXECUTABLE_RELATIVE_PATH);
        let context = resolve_windows_update_recovery_watchdog_context_with(
            &packages,
            &watchdog_executable,
            &harness.identity.executable_path,
        )
        .expect("watchdog context");
        let mut watchdog_lease = Some(
            acquire_windows_update_recovery_watchdog_lease_with(&packages, &context)
                .expect("watchdog lease"),
        );

        assert_eq!(
            maintain_windows_update_recovery_with(
                &packages,
                &installed,
                &harness.recovery_root,
                &harness.library_path,
                &mut watchdog_lease,
            )
            .expect("busy maintenance"),
            UpdateRecoveryMaintenance::Deferred
        );
        assert!(watchdog_lease.is_some());
        drop(candidate);

        let expected = UpdateRecoveryOutcome {
            recovery_id: prepared.recovery_id().to_owned(),
            kind: UpdateRecoveryOutcomeKind::Updated,
            source_version: "0.1.0".to_owned(),
            target_version: "0.2.0".to_owned(),
        };
        assert_eq!(
            maintain_windows_update_recovery_with(
                &packages,
                &installed,
                &harness.recovery_root,
                &harness.library_path,
                &mut watchdog_lease,
            )
            .expect("terminal maintenance"),
            UpdateRecoveryMaintenance::OutcomeRetained(expected.clone())
        );
        assert!(watchdog_lease.is_none());
        assert!(!prepared.attempt_directory().exists());
        assert!(!harness.recovery_root.join(ACTIVE_FILE_NAME).exists());
        assert_eq!(
            read_update_recovery_outcome(&harness.recovery_root).expect("durable outcome"),
            Some(expected.clone())
        );
        assert_eq!(
            maintain_windows_update_recovery_with(
                &packages,
                &installed,
                &harness.recovery_root,
                &harness.library_path,
                &mut None,
            )
            .expect("resumed maintenance"),
            UpdateRecoveryMaintenance::OutcomeRetained(expected)
        );
    }

    #[test]
    fn retains_a_recovered_windows_outcome_only_after_revalidating_the_native_pair() {
        let harness = Harness::new();
        let packages = SyntheticPackages::available();
        let (prepared, _context, watchdog) = prepare_with_watchdog(&harness, &packages);
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementStarted,
        )
        .expect("replacement started");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::Recovering,
        )
        .expect("recovering");
        restore_active_windows_update_recovery_with(
            &packages,
            &SyntheticNativeRecovery::new(vec![Ok(())]),
            &watchdog,
            WindowsUpdateRecoveryRestoration {
                recovery_root: &harness.recovery_root,
                recovery_id: prepared.recovery_id(),
                expected_library_path: &harness.library_path,
            },
        )
        .expect("recovered pair");
        let mut watchdog_lease = Some(watchdog);

        assert!(matches!(
            maintain_windows_update_recovery_with(
                &packages,
                &SyntheticInstalledState::new(&harness, "0.1.0", false),
                &harness.recovery_root,
                &harness.library_path,
                &mut watchdog_lease,
            ),
            Err(WindowsRecoveryStateError::InvalidState)
        ));
        assert!(watchdog_lease.is_some());
        assert!(prepared.attempt_directory().exists());
        assert_eq!(
            read_update_recovery_outcome(&harness.recovery_root).expect("no premature outcome"),
            None
        );

        let expected = UpdateRecoveryOutcome {
            recovery_id: prepared.recovery_id().to_owned(),
            kind: UpdateRecoveryOutcomeKind::Recovered,
            source_version: "0.1.0".to_owned(),
            target_version: "0.2.0".to_owned(),
        };
        assert_eq!(
            maintain_windows_update_recovery_with(
                &packages,
                &SyntheticInstalledState::new(&harness, "0.1.0", true),
                &harness.recovery_root,
                &harness.library_path,
                &mut watchdog_lease,
            )
            .expect("terminal maintenance"),
            UpdateRecoveryMaintenance::OutcomeRetained(expected.clone())
        );
        assert!(watchdog_lease.is_none());
        assert_eq!(
            read_update_recovery_outcome(&harness.recovery_root).expect("recovered outcome"),
            Some(expected)
        );
        assert!(!prepared.attempt_directory().exists());
    }

    #[test]
    fn resumes_windows_cleanup_only_from_the_exact_durable_receipt() {
        let harness = Harness::new();
        let packages = SyntheticPackages::available();
        let (prepared, candidate) = prepare_confirmed_candidate(&harness, &packages);
        drop(candidate);
        let expected = UpdateRecoveryOutcome {
            recovery_id: prepared.recovery_id().to_owned(),
            kind: UpdateRecoveryOutcomeKind::Updated,
            source_version: "0.1.0".to_owned(),
            target_version: "0.2.0".to_owned(),
        };
        let changed = UpdateRecoveryOutcome {
            target_version: "0.3.0".to_owned(),
            ..expected.clone()
        };
        write_update_recovery_outcome(&harness.recovery_root, &changed).expect("changed receipt");
        fs::remove_file(harness.recovery_root.join(ACTIVE_FILE_NAME))
            .expect("interrupted active removal");
        sync_directory(&harness.recovery_root).expect("synchronized recovery root");

        assert!(matches!(
            maintain_windows_update_recovery_with(
                &packages,
                &SyntheticInstalledState::new(&harness, "0.2.0", true),
                &harness.recovery_root,
                &harness.library_path,
                &mut None,
            ),
            Err(WindowsRecoveryStateError::InvalidState)
        ));
        assert!(prepared.attempt_directory().exists());

        write_update_recovery_outcome(&harness.recovery_root, &expected).expect("durable receipt");

        assert_eq!(
            maintain_windows_update_recovery_with(
                &packages,
                &SyntheticInstalledState::new(&harness, "0.2.0", true),
                &harness.recovery_root,
                &harness.library_path,
                &mut None,
            )
            .expect("resumed cleanup"),
            UpdateRecoveryMaintenance::OutcomeRetained(expected)
        );
        assert!(!prepared.attempt_directory().exists());
    }

    #[test]
    fn restores_the_windows_library_and_native_predecessor_as_one_pair() {
        let harness = Harness::new();
        let packages = SyntheticPackages::available();
        let prepared = prepare_windows_update_recovery_with(
            &packages,
            &harness.identity,
            harness.preparation(),
        )
        .expect("prepared recovery");
        let watchdog_executable = prepared
            .attempt_directory()
            .join(RUNNABLE_PREDECESSOR_RELATIVE_PATH)
            .join(RUNNABLE_EXECUTABLE_RELATIVE_PATH);
        let context = resolve_windows_update_recovery_watchdog_context_with(
            &packages,
            &watchdog_executable,
            &harness.identity.executable_path,
        )
        .expect("watchdog context");
        let watchdog = acquire_windows_update_recovery_watchdog_lease_with(&packages, &context)
            .expect("watchdog lease");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementStarted,
        )
        .expect("replacement started");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::Recovering,
        )
        .expect("recovering");
        Connection::open(&harness.library_path)
            .expect("candidate library")
            .execute_batch("CREATE TABLE candidate_only(value TEXT);")
            .expect("candidate mutation");
        let native = SyntheticNativeRecovery::new(vec![Ok(())]);

        let outcome = restore_active_windows_update_recovery_with(
            &packages,
            &native,
            &watchdog,
            WindowsUpdateRecoveryRestoration {
                recovery_root: &harness.recovery_root,
                recovery_id: prepared.recovery_id(),
                expected_library_path: &harness.library_path,
            },
        )
        .expect("restored predecessor pair");

        assert_eq!(outcome, WindowsUpdateRecoveryRestorationOutcome::Recovered);
        assert_eq!(
            active_windows_update_recovery_phase_with(&packages, &harness.recovery_root)
                .expect("recovered phase"),
            Some((
                prepared.recovery_id().to_owned(),
                PackagedUpdateRecoveryPhase::Recovered,
            ))
        );
        assert_eq!(
            fs::read(&harness.library_path).expect("restored library"),
            fs::read(
                prepared
                    .attempt_directory()
                    .join(LIBRARY_BACKUP_RELATIVE_PATH)
            )
            .expect("library backup")
        );
        assert_eq!(
            native.observed_attempts.borrow().as_slice(),
            &[(prepared.attempt_directory().to_owned(), "0.1.0".to_owned())]
        );
    }

    #[test]
    fn records_closed_windows_native_failures_and_stops_after_three_attempts() {
        let harness = Harness::new();
        let packages = SyntheticPackages::available();
        let prepared = prepare_windows_update_recovery_with(
            &packages,
            &harness.identity,
            harness.preparation(),
        )
        .expect("prepared recovery");
        let watchdog_executable = prepared
            .attempt_directory()
            .join(RUNNABLE_PREDECESSOR_RELATIVE_PATH)
            .join(RUNNABLE_EXECUTABLE_RELATIVE_PATH);
        let context = resolve_windows_update_recovery_watchdog_context_with(
            &packages,
            &watchdog_executable,
            &harness.identity.executable_path,
        )
        .expect("watchdog context");
        let watchdog = acquire_windows_update_recovery_watchdog_lease_with(&packages, &context)
            .expect("watchdog lease");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementStarted,
        )
        .expect("replacement started");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::Recovering,
        )
        .expect("recovering");
        fs::remove_file(&harness.library_path).expect("removed candidate library");
        let native = SyntheticNativeRecovery::new(vec![
            Err(WindowsUpdateRecoveryError::NativeRollbackFailed),
            Err(WindowsUpdateRecoveryError::InvalidPackageIdentity),
            Err(WindowsUpdateRecoveryError::InvalidPredecessorPackage),
        ]);
        let restoration = || WindowsUpdateRecoveryRestoration {
            recovery_root: &harness.recovery_root,
            recovery_id: prepared.recovery_id(),
            expected_library_path: &harness.library_path,
        };

        assert_eq!(
            restore_active_windows_update_recovery_with(
                &packages,
                &native,
                &watchdog,
                restoration(),
            )
            .expect("first failed attempt"),
            WindowsUpdateRecoveryRestorationOutcome::NativeRecoveryUnavailable {
                attempts: 1,
                failure: WindowsNativeRecoveryFailure::InstallerFailed,
            }
        );
        assert_eq!(
            fs::read(&harness.library_path).expect("restored missing library"),
            fs::read(
                prepared
                    .attempt_directory()
                    .join(LIBRARY_BACKUP_RELATIVE_PATH)
            )
            .expect("library backup")
        );
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::Recovering,
        )
        .expect("second recovery attempt");
        assert_eq!(
            restore_active_windows_update_recovery_with(
                &packages,
                &native,
                &watchdog,
                restoration(),
            )
            .expect("second failed attempt"),
            WindowsUpdateRecoveryRestorationOutcome::NativeRecoveryUnavailable {
                attempts: 2,
                failure: WindowsNativeRecoveryFailure::InstalledStateInvalid,
            }
        );
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::Recovering,
        )
        .expect("third recovery attempt");
        assert_eq!(
            restore_active_windows_update_recovery_with(
                &packages,
                &native,
                &watchdog,
                restoration(),
            )
            .expect("third failed attempt"),
            WindowsUpdateRecoveryRestorationOutcome::RecoveryFailed {
                attempts: 3,
                failure: WindowsNativeRecoveryFailure::InstalledStateInvalid,
            }
        );
        assert_eq!(
            active_windows_update_recovery_phase_with(&packages, &harness.recovery_root)
                .expect("terminal phase")
                .map(|(_, phase)| phase),
            Some(PackagedUpdateRecoveryPhase::RecoveryFailed)
        );
        assert!(restore_active_windows_update_recovery_with(
            &packages,
            &native,
            &watchdog,
            restoration(),
        )
        .is_err());
    }

    #[test]
    fn refuses_windows_restoration_while_the_candidate_lease_is_held() {
        let harness = Harness::new();
        let packages = SyntheticPackages::available();
        let prepared = prepare_windows_update_recovery_with(
            &packages,
            &harness.identity,
            harness.preparation(),
        )
        .expect("prepared recovery");
        let watchdog_executable = prepared
            .attempt_directory()
            .join(RUNNABLE_PREDECESSOR_RELATIVE_PATH)
            .join(RUNNABLE_EXECUTABLE_RELATIVE_PATH);
        let context = resolve_windows_update_recovery_watchdog_context_with(
            &packages,
            &watchdog_executable,
            &harness.identity.executable_path,
        )
        .expect("watchdog context");
        let watchdog = acquire_windows_update_recovery_watchdog_lease_with(&packages, &context)
            .expect("watchdog lease");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementStarted,
        )
        .expect("replacement started");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementInstalled,
        )
        .expect("replacement installed");
        let process = WindowsRecoveryProcessIdentity::for_test(
            42,
            133_713_371_337,
            &harness.identity.executable_path,
        );
        let launch_nonce = "7".repeat(64);
        record_active_windows_update_recovery_replacement_launch(
            &harness.recovery_root,
            prepared.recovery_id(),
            WindowsUpdateRecoveryReplacementLaunch {
                process: &process,
                launch_nonce: &launch_nonce,
                confirmation_deadline: "2026-09-04T08:05:00Z",
            },
        )
        .expect("recorded replacement launch");
        let mut candidate_identity = harness.identity.clone();
        candidate_identity.version = "0.2.0".to_owned();
        let candidate = acquire_windows_update_recovery_candidate_lease_with(
            &packages,
            &harness.recovery_root,
            prepared.recovery_id(),
            &launch_nonce,
            &process,
            &candidate_identity,
        )
        .expect("candidate lease");
        transition_active_windows_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::Recovering,
        )
        .expect("recovering");

        assert!(matches!(
            restore_active_windows_update_recovery_with(
                &packages,
                &SyntheticNativeRecovery::new(vec![Ok(())]),
                &watchdog,
                WindowsUpdateRecoveryRestoration {
                    recovery_root: &harness.recovery_root,
                    recovery_id: prepared.recovery_id(),
                    expected_library_path: &harness.library_path,
                },
            ),
            Err(WindowsRecoveryStateError::ActiveAttemptExists)
        ));
        drop(candidate);
    }
}
