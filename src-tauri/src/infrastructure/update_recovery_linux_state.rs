use std::{
    fs::{self, File, OpenOptions},
    io::{self, Read, Write},
    path::{Component, Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::{DateTime, SecondsFormat, Utc};
use fitfreed_application::{
    validate_packaged_update_recovery_transition, PackagedUpdateRecoveryPhase, UpdateArtifact,
    UpdateInstallationAuthorization,
};
use minisign_verify::Signature;
use semver::Version;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;
use url::Url;

use super::{
    backup_database,
    local_file::{sync_directory, PrivateStagingFile},
    observe_linux_recovery_process, prepare_linux_recovery_packages_from_path,
    query_linux_native_package_identity, verify_library_file, verify_linux_recovery_packages,
    ImportError, LinuxNativePackageIdentity, LinuxRecoveryPackageError,
    LinuxRecoveryPackageExpectation, LinuxRecoveryProcessIdentity, SCHEMA_VERSION,
};

const RECOVERY_FORMAT: &str = "org.fitfreed.update-recovery";
const RECOVERY_SCHEMA_VERSION: u32 = 2;
const UPDATE_TARGET: &str = "linux-x86_64-deb";
const ACTIVE_FILE_NAME: &str = "active";
const ATTEMPTS_DIRECTORY_NAME: &str = "attempts";
const MANIFEST_FILE_NAME: &str = "manifest.json";
const OUTCOME_LOCK_FILE_NAME: &str = "outcome.lock";
const STATE_LOCK_FILE_NAME: &str = "state.lock";
const CANDIDATE_LOCK_FILE_NAME: &str = "candidate.lock";
const WATCHDOG_LOCK_FILE_NAME: &str = "watchdog.lock";
const PREDECESSOR_PACKAGE_RELATIVE_PATH: &str = "previous/package.deb";
const RUNNABLE_PREDECESSOR_RELATIVE_PATH: &str = "previous/runnable";
const RUNNABLE_EXECUTABLE_RELATIVE_PATH: &str = "usr/bin/fitfreed";
const LIBRARY_BACKUP_RELATIVE_PATH: &str = "previous/fitfreed.sqlite";
const TARGET_PACKAGE_RELATIVE_PATH: &str = "candidate/package.deb";
const PACKAGE_NAME: &str = "fitfreed";
const PACKAGE_ARCHITECTURE: &str = "amd64";
const INSTALLED_EXECUTABLE_PATH: &str = "/usr/bin/fitfreed";
const INSTALLED_DESKTOP_ENTRY_PATH: &str = "/usr/share/applications/FitFreed.desktop";
const MAX_MANIFEST_BYTES: u64 = 64 * 1024;
const MAX_PACKAGE_BYTES: u64 = 1_073_741_824;
const MAX_LIBRARY_BACKUP_BYTES: u64 = 1024 * 1024 * 1024 * 1024;
const MAX_LOCAL_PATH_BYTES: usize = 4096;
const MAX_URL_BYTES: usize = 2048;
const MAX_VERSION_BYTES: usize = 255;
const MAX_SAFE_JSON_INTEGER: u64 = 9_007_199_254_740_991;

#[derive(Debug, Error)]
pub enum LinuxRecoveryStateError {
    #[error("the Linux recovery preparation is invalid")]
    InvalidInput,
    #[error("a Linux recovery attempt is already active")]
    ActiveAttemptExists,
    #[error("the Linux recovery state is invalid")]
    InvalidState,
    #[error("the Linux recovery transition is invalid")]
    InvalidTransition,
    #[error("the Linux recovery package state is invalid")]
    Package(#[from] LinuxRecoveryPackageError),
    #[error("the Linux recovery library state is invalid")]
    Library(#[from] ImportError),
    #[error("Linux recovery input/output failure: {0}")]
    Io(#[from] io::Error),
    #[error("Linux recovery manifest failure: {0}")]
    Manifest(#[from] serde_json::Error),
}

pub struct LinuxUpdateRecoveryPreparation<'a> {
    pub recovery_root: &'a Path,
    pub library_path: &'a Path,
    pub installed_version: &'a str,
    pub prepared_at: &'a str,
    pub authorization: &'a UpdateInstallationAuthorization,
    pub predecessor_package_path: &'a Path,
    pub candidate_package_bytes: &'a [u8],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreparedLinuxUpdateRecovery {
    recovery_id: String,
    attempt_directory: PathBuf,
    source_library_schema_version: u32,
}

impl PreparedLinuxUpdateRecovery {
    pub fn recovery_id(&self) -> &str {
        &self.recovery_id
    }

    pub fn attempt_directory(&self) -> &Path {
        &self.attempt_directory
    }

    pub fn source_library_schema_version(&self) -> u32 {
        self.source_library_schema_version
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LinuxUpdateRecoveryReplacementProcess {
    process_id: u32,
    boot_id: String,
    start_time_clock_ticks: u64,
    launch_nonce: String,
    confirmation_deadline: String,
}

impl LinuxUpdateRecoveryReplacementProcess {
    pub fn process_id(&self) -> u32 {
        self.process_id
    }

    pub fn boot_id(&self) -> &str {
        &self.boot_id
    }

    pub fn start_time_clock_ticks(&self) -> u64 {
        self.start_time_clock_ticks
    }

    pub fn launch_nonce(&self) -> &str {
        &self.launch_nonce
    }

    pub fn confirmation_deadline(&self) -> &str {
        &self.confirmation_deadline
    }
}

pub struct LinuxUpdateRecoveryReplacementLaunch<'a> {
    pub process: &'a LinuxRecoveryProcessIdentity,
    pub launch_nonce: &'a str,
    pub confirmation_deadline: &'a str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LinuxUpdateRecoveryWatchdogContext {
    recovery_root: PathBuf,
    recovery_id: String,
    installed_executable_path: PathBuf,
    runnable_predecessor_executable_path: PathBuf,
    library_path: PathBuf,
    target_version: String,
    target_library_schema_version: u32,
    prepared_at: String,
    replacement_process: Option<LinuxUpdateRecoveryReplacementProcess>,
}

pub struct LinuxUpdateRecoveryCandidateLease {
    _lock: FileLock,
    recovery_id: String,
    launch_nonce: String,
}

impl LinuxUpdateRecoveryCandidateLease {
    pub fn recovery_id(&self) -> &str {
        &self.recovery_id
    }

    pub fn launch_nonce(&self) -> &str {
        &self.launch_nonce
    }
}

pub struct LinuxUpdateRecoveryWatchdogLease {
    _lock: FileLock,
    recovery_id: String,
}

impl LinuxUpdateRecoveryWatchdogLease {
    pub fn recovery_id(&self) -> &str {
        &self.recovery_id
    }
}

impl LinuxUpdateRecoveryWatchdogContext {
    pub fn recovery_root(&self) -> &Path {
        &self.recovery_root
    }

    pub fn recovery_id(&self) -> &str {
        &self.recovery_id
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

    pub fn target_version(&self) -> &str {
        &self.target_version
    }

    pub fn target_library_schema_version(&self) -> u32 {
        self.target_library_schema_version
    }

    pub fn prepared_at(&self) -> &str {
        &self.prepared_at
    }

    pub fn replacement_process(&self) -> Option<&LinuxUpdateRecoveryReplacementProcess> {
        self.replacement_process.as_ref()
    }
}

trait RecoveryPackagePort {
    fn prepare(
        &self,
        attempt_directory: &Path,
        predecessor_source: &Path,
        predecessor: &LinuxRecoveryPackageExpectation,
        candidate_bytes: &[u8],
        candidate: &LinuxRecoveryPackageExpectation,
    ) -> Result<String, LinuxRecoveryPackageError>;

    fn verify(
        &self,
        attempt_directory: &Path,
        predecessor: &LinuxRecoveryPackageExpectation,
        candidate: &LinuxRecoveryPackageExpectation,
        runnable_tree_sha256: &str,
    ) -> Result<(), LinuxRecoveryPackageError>;
}

struct SystemRecoveryPackages;

impl RecoveryPackagePort for SystemRecoveryPackages {
    fn prepare(
        &self,
        attempt_directory: &Path,
        predecessor_source: &Path,
        predecessor: &LinuxRecoveryPackageExpectation,
        candidate_bytes: &[u8],
        candidate: &LinuxRecoveryPackageExpectation,
    ) -> Result<String, LinuxRecoveryPackageError> {
        prepare_linux_recovery_packages_from_path(
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
        predecessor: &LinuxRecoveryPackageExpectation,
        candidate: &LinuxRecoveryPackageExpectation,
        runnable_tree_sha256: &str,
    ) -> Result<(), LinuxRecoveryPackageError> {
        verify_linux_recovery_packages(
            attempt_directory,
            predecessor,
            candidate,
            runnable_tree_sha256,
        )
        .map(|_| ())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LinuxRecoveryManifest {
    format: String,
    schema_version: u32,
    recovery_id: String,
    phase: LinuxRecoveryPhaseWire,
    prepared_at: String,
    replacement_process: Option<LinuxReplacementProcess>,
    platform: LinuxPlatform,
    source: LinuxRecoverySource,
    target: LinuxRecoveryTarget,
    predecessor_package: PreservedPackage,
    runnable_predecessor: RunnablePredecessor,
    library_backup: LibraryBackup,
    target_package: PreservedPackage,
    native_recovery: NativeRecovery,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
enum LinuxRecoveryPhaseWire {
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

impl From<LinuxRecoveryPhaseWire> for PackagedUpdateRecoveryPhase {
    fn from(value: LinuxRecoveryPhaseWire) -> Self {
        match value {
            LinuxRecoveryPhaseWire::Prepared => Self::Prepared,
            LinuxRecoveryPhaseWire::ReplacementStarted => Self::ReplacementStarted,
            LinuxRecoveryPhaseWire::ReplacementInstalled => Self::ReplacementInstalled,
            LinuxRecoveryPhaseWire::Launching => Self::Launching,
            LinuxRecoveryPhaseWire::Confirmed => Self::Confirmed,
            LinuxRecoveryPhaseWire::Recovering => Self::Recovering,
            LinuxRecoveryPhaseWire::NativeRecoveryUnavailable => Self::NativeRecoveryUnavailable,
            LinuxRecoveryPhaseWire::Recovered => Self::Recovered,
            LinuxRecoveryPhaseWire::RecoveryFailed => Self::RecoveryFailed,
        }
    }
}

impl From<PackagedUpdateRecoveryPhase> for LinuxRecoveryPhaseWire {
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
struct LinuxReplacementProcess {
    process_id: u32,
    boot_id: String,
    start_time_clock_ticks: u64,
    executable_path: String,
    launch_nonce: String,
    confirmation_deadline: String,
}

impl From<LinuxReplacementProcess> for LinuxUpdateRecoveryReplacementProcess {
    fn from(value: LinuxReplacementProcess) -> Self {
        Self {
            process_id: value.process_id,
            boot_id: value.boot_id,
            start_time_clock_ticks: value.start_time_clock_ticks,
            launch_nonce: value.launch_nonce,
            confirmation_deadline: value.confirmation_deadline,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LinuxPlatform {
    os: String,
    architecture: String,
    package_kind: String,
    update_target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LinuxRecoverySource {
    version: String,
    library_schema_version: u32,
    library_path: String,
    native_package: NativePackageIdentity,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct NativePackageIdentity {
    name: String,
    version: String,
    architecture: String,
    executable_path: String,
    desktop_entry_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LinuxRecoveryTarget {
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
    last_failure: Option<NativeRecoveryFailure>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
enum NativeRecoveryFailure {
    AuthorizationUnavailable,
    PackageManagerFailed,
    InstalledStateInvalid,
}

pub fn prepare_linux_update_recovery(
    preparation: LinuxUpdateRecoveryPreparation<'_>,
) -> Result<PreparedLinuxUpdateRecovery, LinuxRecoveryStateError> {
    let native_identity =
        query_linux_native_package_identity().map_err(|_| LinuxRecoveryStateError::InvalidInput)?;
    prepare_linux_update_recovery_with(&SystemRecoveryPackages, &native_identity, preparation)
}

pub fn verify_linux_update_recovery(
    recovery_root: &Path,
    recovery_id: &str,
) -> Result<(), LinuxRecoveryStateError> {
    verify_linux_update_recovery_with(&SystemRecoveryPackages, recovery_root, recovery_id)
        .map(|_| ())
}

pub fn active_linux_update_recovery_phase(
    recovery_root: &Path,
) -> Result<Option<(String, PackagedUpdateRecoveryPhase)>, LinuxRecoveryStateError> {
    if !path_entry_exists(recovery_root)? {
        return Ok(None);
    }
    let recovery_root = canonical_private_directory(recovery_root)?;
    let active_path = recovery_root.join(ACTIVE_FILE_NAME);
    if !path_entry_exists(&active_path)? {
        return Ok(None);
    }
    let recovery_id = read_active_recovery_id(&active_path)?;
    let manifest = read_active_manifest(&recovery_root, &recovery_id)?;
    Ok(Some((recovery_id, manifest.phase.into())))
}

pub fn transition_active_linux_update_recovery(
    recovery_root: &Path,
    recovery_id: &str,
    next: PackagedUpdateRecoveryPhase,
) -> Result<(), LinuxRecoveryStateError> {
    if !valid_sha256(recovery_id) {
        return Err(LinuxRecoveryStateError::InvalidInput);
    }
    let recovery_root = canonical_private_directory(recovery_root)?;
    let attempt_directory = canonical_recovery_attempt(&recovery_root, recovery_id)?;
    let _state_lock = StateLock::acquire(&attempt_directory)?;
    if read_active_recovery_id(&recovery_root.join(ACTIVE_FILE_NAME))? != recovery_id {
        return Err(LinuxRecoveryStateError::InvalidState);
    }
    let manifest_path = attempt_directory.join(MANIFEST_FILE_NAME);
    let mut manifest = read_manifest(&manifest_path)?;
    validate_manifest(&manifest)?;
    if manifest.recovery_id != recovery_id || next == PackagedUpdateRecoveryPhase::Launching {
        return Err(LinuxRecoveryStateError::InvalidTransition);
    }
    validate_packaged_update_recovery_transition(manifest.phase.into(), next)
        .map_err(|_| LinuxRecoveryStateError::InvalidTransition)?;
    manifest.phase = next.into();
    validate_manifest(&manifest)?;
    write_manifest(&manifest_path, &manifest)
}

pub fn record_active_linux_update_recovery_replacement_launch(
    recovery_root: &Path,
    recovery_id: &str,
    launch: LinuxUpdateRecoveryReplacementLaunch<'_>,
) -> Result<LinuxUpdateRecoveryReplacementProcess, LinuxRecoveryStateError> {
    if !valid_sha256(recovery_id) {
        return Err(LinuxRecoveryStateError::InvalidInput);
    }
    let recovery_root = canonical_private_directory(recovery_root)?;
    let attempt_directory = canonical_recovery_attempt(&recovery_root, recovery_id)?;
    let _state_lock = StateLock::acquire(&attempt_directory)?;
    if read_active_recovery_id(&recovery_root.join(ACTIVE_FILE_NAME))? != recovery_id {
        return Err(LinuxRecoveryStateError::InvalidState);
    }
    let manifest_path = attempt_directory.join(MANIFEST_FILE_NAME);
    let mut manifest = read_manifest(&manifest_path)?;
    validate_manifest(&manifest)?;
    validate_packaged_update_recovery_transition(
        manifest.phase.into(),
        PackagedUpdateRecoveryPhase::Launching,
    )
    .map_err(|_| LinuxRecoveryStateError::InvalidTransition)?;
    let replacement_process = LinuxReplacementProcess {
        process_id: launch.process.process_id(),
        boot_id: launch.process.boot_id().to_owned(),
        start_time_clock_ticks: launch.process.start_time_clock_ticks(),
        executable_path: path_text(launch.process.executable_path())?,
        launch_nonce: launch.launch_nonce.to_owned(),
        confirmation_deadline: launch.confirmation_deadline.to_owned(),
    };
    if !valid_replacement_process(&replacement_process) {
        return Err(LinuxRecoveryStateError::InvalidInput);
    }
    manifest.phase = LinuxRecoveryPhaseWire::Launching;
    manifest.replacement_process = Some(replacement_process.clone());
    validate_manifest(&manifest)?;
    write_manifest(&manifest_path, &manifest)?;
    Ok(replacement_process.into())
}

pub fn resolve_linux_update_recovery_watchdog_context(
    watchdog_executable: &Path,
    expected_installed_executable: &Path,
) -> Result<LinuxUpdateRecoveryWatchdogContext, LinuxRecoveryStateError> {
    resolve_linux_update_recovery_watchdog_context_with(
        &SystemRecoveryPackages,
        watchdog_executable,
        expected_installed_executable,
    )
}

fn resolve_linux_update_recovery_watchdog_context_with(
    packages: &impl RecoveryPackagePort,
    watchdog_executable: &Path,
    expected_installed_executable: &Path,
) -> Result<LinuxUpdateRecoveryWatchdogContext, LinuxRecoveryStateError> {
    if expected_installed_executable != Path::new(INSTALLED_EXECUTABLE_PATH) {
        return Err(LinuxRecoveryStateError::InvalidInput);
    }
    let metadata = fs::symlink_metadata(watchdog_executable)?;
    if !metadata.file_type().is_file() {
        return Err(LinuxRecoveryStateError::InvalidInput);
    }
    let watchdog_executable = watchdog_executable.canonicalize()?;
    let attempt_directory = watchdog_executable
        .ancestors()
        .nth(5)
        .ok_or(LinuxRecoveryStateError::InvalidInput)?;
    if attempt_directory
        .join(RUNNABLE_PREDECESSOR_RELATIVE_PATH)
        .join(RUNNABLE_EXECUTABLE_RELATIVE_PATH)
        != watchdog_executable
    {
        return Err(LinuxRecoveryStateError::InvalidInput);
    }
    let recovery_id = attempt_directory
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|value| valid_sha256(value))
        .ok_or(LinuxRecoveryStateError::InvalidInput)?;
    let attempts_directory = attempt_directory
        .parent()
        .filter(|path| {
            path.file_name().and_then(|name| name.to_str()) == Some(ATTEMPTS_DIRECTORY_NAME)
        })
        .ok_or(LinuxRecoveryStateError::InvalidInput)?;
    let recovery_root = attempts_directory
        .parent()
        .ok_or(LinuxRecoveryStateError::InvalidInput)?;
    canonical_private_directory(recovery_root)?;
    canonical_private_directory(attempts_directory)?;
    canonical_private_directory(attempt_directory)?;
    if read_active_recovery_id(&recovery_root.join(ACTIVE_FILE_NAME))? != recovery_id {
        return Err(LinuxRecoveryStateError::InvalidState);
    }
    let manifest = verify_linux_update_recovery_with(packages, recovery_root, recovery_id)?;
    let library_path = recovery_root
        .parent()
        .ok_or(LinuxRecoveryStateError::InvalidState)?
        .join("fitfreed.sqlite");
    if Path::new(&manifest.source.library_path) != library_path {
        return Err(LinuxRecoveryStateError::InvalidState);
    }
    Ok(LinuxUpdateRecoveryWatchdogContext {
        recovery_root: recovery_root.to_owned(),
        recovery_id: recovery_id.to_owned(),
        installed_executable_path: expected_installed_executable.to_owned(),
        runnable_predecessor_executable_path: watchdog_executable,
        library_path,
        target_version: manifest.target.version,
        target_library_schema_version: manifest.target.library_schema_version,
        prepared_at: manifest.prepared_at,
        replacement_process: manifest.replacement_process.map(Into::into),
    })
}

pub fn acquire_linux_update_recovery_watchdog_lease(
    context: &LinuxUpdateRecoveryWatchdogContext,
) -> Result<LinuxUpdateRecoveryWatchdogLease, LinuxRecoveryStateError> {
    acquire_linux_update_recovery_watchdog_lease_with(&SystemRecoveryPackages, context)
}

fn acquire_linux_update_recovery_watchdog_lease_with(
    packages: &impl RecoveryPackagePort,
    context: &LinuxUpdateRecoveryWatchdogContext,
) -> Result<LinuxUpdateRecoveryWatchdogLease, LinuxRecoveryStateError> {
    let recovery_root = canonical_private_directory(context.recovery_root())?;
    let attempt_directory = canonical_recovery_attempt(&recovery_root, context.recovery_id())?;
    let lock = FileLock::acquire(open_private_lock_file(
        &attempt_directory,
        WATCHDOG_LOCK_FILE_NAME,
        false,
    )?)?;
    let manifest =
        verify_linux_update_recovery_with(packages, &recovery_root, context.recovery_id())?;
    if read_active_recovery_id(&recovery_root.join(ACTIVE_FILE_NAME))? != context.recovery_id()
        || manifest.target.version != context.target_version()
        || manifest.target.library_schema_version != context.target_library_schema_version()
        || manifest.prepared_at != context.prepared_at()
    {
        return Err(LinuxRecoveryStateError::InvalidState);
    }
    Ok(LinuxUpdateRecoveryWatchdogLease {
        _lock: lock,
        recovery_id: context.recovery_id().to_owned(),
    })
}

pub fn acquire_linux_update_recovery_candidate_lease(
    recovery_root: &Path,
    recovery_id: &str,
    launch_nonce: &str,
) -> Result<LinuxUpdateRecoveryCandidateLease, LinuxRecoveryStateError> {
    let process = observe_linux_recovery_process(std::process::id())
        .map_err(|_| LinuxRecoveryStateError::InvalidState)?;
    let native_identity =
        query_linux_native_package_identity().map_err(|_| LinuxRecoveryStateError::InvalidState)?;
    acquire_linux_update_recovery_candidate_lease_with(
        &SystemRecoveryPackages,
        recovery_root,
        recovery_id,
        launch_nonce,
        &process,
        &native_identity,
    )
}

fn acquire_linux_update_recovery_candidate_lease_with(
    packages: &impl RecoveryPackagePort,
    recovery_root: &Path,
    recovery_id: &str,
    launch_nonce: &str,
    process: &LinuxRecoveryProcessIdentity,
    native_identity: &LinuxNativePackageIdentity,
) -> Result<LinuxUpdateRecoveryCandidateLease, LinuxRecoveryStateError> {
    if !valid_sha256(recovery_id) || !valid_sha256(launch_nonce) {
        return Err(LinuxRecoveryStateError::InvalidInput);
    }
    let recovery_root = canonical_private_directory(recovery_root)?;
    let attempt_directory = canonical_recovery_attempt(&recovery_root, recovery_id)?;
    let lock = FileLock::acquire(open_private_lock_file(
        &attempt_directory,
        CANDIDATE_LOCK_FILE_NAME,
        false,
    )?)?;
    let _state_lock = StateLock::acquire(&attempt_directory)?;
    if read_active_recovery_id(&recovery_root.join(ACTIVE_FILE_NAME))? != recovery_id {
        return Err(LinuxRecoveryStateError::InvalidState);
    }
    let manifest = verify_linux_update_recovery_with(packages, &recovery_root, recovery_id)?;
    let replacement = manifest
        .replacement_process
        .as_ref()
        .ok_or(LinuxRecoveryStateError::InvalidState)?;
    if manifest.phase != LinuxRecoveryPhaseWire::Launching
        || manifest.recovery_id != recovery_id
        || replacement.launch_nonce != launch_nonce
        || replacement.process_id != process.process_id()
        || replacement.boot_id != process.boot_id()
        || replacement.start_time_clock_ticks != process.start_time_clock_ticks()
        || replacement.executable_path != path_text(process.executable_path())?
        || !native_identity_matches(native_identity, &manifest.target.version)
    {
        return Err(LinuxRecoveryStateError::InvalidState);
    }
    Ok(LinuxUpdateRecoveryCandidateLease {
        _lock: lock,
        recovery_id: recovery_id.to_owned(),
        launch_nonce: launch_nonce.to_owned(),
    })
}

fn prepare_linux_update_recovery_with(
    packages: &impl RecoveryPackagePort,
    native_identity: &LinuxNativePackageIdentity,
    preparation: LinuxUpdateRecoveryPreparation<'_>,
) -> Result<PreparedLinuxUpdateRecovery, LinuxRecoveryStateError> {
    let validated = validate_preparation(native_identity, &preparation)?;
    let recovery_root = prepare_recovery_root(preparation.recovery_root)?;
    let outcome_lock = open_private_lock_file(&recovery_root, OUTCOME_LOCK_FILE_NAME, true)?;
    sync_directory(&recovery_root)?;
    let _outcome_lock = FileLock::acquire(outcome_lock)?;
    let active_path = recovery_root.join(ACTIVE_FILE_NAME);
    if path_entry_exists(&active_path)? {
        return Err(LinuxRecoveryStateError::ActiveAttemptExists);
    }

    let attempts_directory = recovery_root.join(ATTEMPTS_DIRECTORY_NAME);
    create_or_validate_private_directory(&attempts_directory)?;
    let recovery_id = generate_recovery_id(&preparation)?;
    let staging_directory = attempts_directory.join(format!(".staging-{recovery_id}"));
    let attempt_directory = attempts_directory.join(&recovery_id);
    if path_entry_exists(&staging_directory)? || path_entry_exists(&attempt_directory)? {
        return Err(LinuxRecoveryStateError::InvalidState);
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
        || library_metadata.len() == 0
        || library_metadata.len() > MAX_LIBRARY_BACKUP_BYTES
    {
        return Err(LinuxRecoveryStateError::InvalidState);
    }
    let library_sha256 = file_sha256(&library_backup_path, library_metadata.len())?;

    let predecessor_artifact = preparation
        .authorization
        .predecessor_artifact
        .as_ref()
        .ok_or(LinuxRecoveryStateError::InvalidInput)?;
    let manifest = LinuxRecoveryManifest {
        format: RECOVERY_FORMAT.to_owned(),
        schema_version: RECOVERY_SCHEMA_VERSION,
        recovery_id: recovery_id.clone(),
        phase: LinuxRecoveryPhaseWire::Prepared,
        prepared_at: validated.prepared_at,
        replacement_process: None,
        platform: LinuxPlatform {
            os: "linux".to_owned(),
            architecture: "x86_64".to_owned(),
            package_kind: "deb".to_owned(),
            update_target: UPDATE_TARGET.to_owned(),
        },
        source: LinuxRecoverySource {
            version: preparation.installed_version.to_owned(),
            library_schema_version: validated.source_library_schema_version,
            library_path: path_text(&validated.library_path)?,
            native_package: NativePackageIdentity {
                name: native_identity.name().to_owned(),
                version: native_identity.version().to_owned(),
                architecture: native_identity.architecture().to_owned(),
                executable_path: path_text(native_identity.executable_path())?,
                desktop_entry_path: path_text(native_identity.desktop_entry_path())?,
            },
        },
        target: LinuxRecoveryTarget {
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
    verify_linux_update_recovery_with(packages, &recovery_root, &recovery_id)?;
    write_active_recovery_id(&active_path, &recovery_id)?;
    staging.disarm();
    if read_active_recovery_id(&active_path)? != recovery_id {
        return Err(LinuxRecoveryStateError::InvalidState);
    }

    Ok(PreparedLinuxUpdateRecovery {
        recovery_id,
        attempt_directory,
        source_library_schema_version: validated.source_library_schema_version,
    })
}

struct ValidatedPreparation {
    library_path: PathBuf,
    prepared_at: String,
    source_library_schema_version: u32,
    predecessor_expectation: LinuxRecoveryPackageExpectation,
    candidate_expectation: LinuxRecoveryPackageExpectation,
}

fn validate_preparation(
    native_identity: &LinuxNativePackageIdentity,
    preparation: &LinuxUpdateRecoveryPreparation<'_>,
) -> Result<ValidatedPreparation, LinuxRecoveryStateError> {
    if !preparation.recovery_root.is_absolute()
        || !preparation.library_path.is_absolute()
        || preparation
            .recovery_root
            .components()
            .any(|component| matches!(component, Component::ParentDir))
        || native_identity.version() != preparation.installed_version
        || native_identity.name() != PACKAGE_NAME
        || native_identity.architecture() != PACKAGE_ARCHITECTURE
        || native_identity.executable_path() != Path::new(INSTALLED_EXECUTABLE_PATH)
        || native_identity.desktop_entry_path() != Path::new(INSTALLED_DESKTOP_ENTRY_PATH)
    {
        return Err(LinuxRecoveryStateError::InvalidInput);
    }
    let source_version =
        valid_semver(preparation.installed_version).ok_or(LinuxRecoveryStateError::InvalidInput)?;
    let target_version = valid_semver(&preparation.authorization.version)
        .ok_or(LinuxRecoveryStateError::InvalidInput)?;
    let predecessor_artifact = preparation
        .authorization
        .predecessor_artifact
        .as_ref()
        .ok_or(LinuxRecoveryStateError::InvalidInput)?;
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
        return Err(LinuxRecoveryStateError::InvalidInput);
    }
    let prepared_at = canonical_utc(preparation.prepared_at)
        .filter(|value| value == preparation.prepared_at)
        .ok_or(LinuxRecoveryStateError::InvalidInput)?;
    let library_path = preparation.library_path.canonicalize()?;
    if library_path != preparation.library_path
        || library_path.file_name().and_then(|name| name.to_str()) != Some("fitfreed.sqlite")
        || preparation
            .recovery_root
            .file_name()
            .and_then(|name| name.to_str())
            != Some("update-recovery")
        || preparation
            .recovery_root
            .parent()
            .ok_or(LinuxRecoveryStateError::InvalidInput)?
            .canonicalize()?
            != library_path
                .parent()
                .ok_or(LinuxRecoveryStateError::InvalidInput)?
                .canonicalize()?
    {
        return Err(LinuxRecoveryStateError::InvalidInput);
    }
    let source_library_schema_version =
        u32::try_from(SCHEMA_VERSION).map_err(|_| LinuxRecoveryStateError::InvalidInput)?;
    if preparation.authorization.target_library_schema_version < source_library_schema_version {
        return Err(LinuxRecoveryStateError::InvalidInput);
    }
    let predecessor_expectation = LinuxRecoveryPackageExpectation::try_new(
        preparation.installed_version.to_owned(),
        predecessor_artifact.expected_size_bytes,
        predecessor_artifact.expected_sha256.clone(),
    )?;
    let candidate_expectation = LinuxRecoveryPackageExpectation::try_new(
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

fn verify_linux_update_recovery_with(
    packages: &impl RecoveryPackagePort,
    recovery_root: &Path,
    recovery_id: &str,
) -> Result<LinuxRecoveryManifest, LinuxRecoveryStateError> {
    if !valid_sha256(recovery_id) {
        return Err(LinuxRecoveryStateError::InvalidInput);
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
        drop(open_private_lock_file(&attempt_directory, name, false)?);
    }
    let manifest = read_manifest(&attempt_directory.join(MANIFEST_FILE_NAME))?;
    validate_manifest(&manifest)?;
    if manifest.recovery_id != recovery_id {
        return Err(LinuxRecoveryStateError::InvalidState);
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
        || metadata.len() != manifest.library_backup.size_bytes
        || file_sha256(&library_path, metadata.len())? != manifest.library_backup.sha256
    {
        return Err(LinuxRecoveryStateError::InvalidState);
    }
    verify_library_file(
        &library_path,
        i64::from(manifest.source.library_schema_version),
    )?;
    Ok(manifest)
}

fn validate_manifest(manifest: &LinuxRecoveryManifest) -> Result<(), LinuxRecoveryStateError> {
    let source_version =
        valid_semver(&manifest.source.version).ok_or(LinuxRecoveryStateError::InvalidState)?;
    let target_version =
        valid_semver(&manifest.target.version).ok_or(LinuxRecoveryStateError::InvalidState)?;
    if manifest.format != RECOVERY_FORMAT
        || manifest.schema_version != RECOVERY_SCHEMA_VERSION
        || !valid_sha256(&manifest.recovery_id)
        || canonical_utc(&manifest.prepared_at).as_deref() != Some(manifest.prepared_at.as_str())
        || manifest.platform
            != (LinuxPlatform {
                os: "linux".to_owned(),
                architecture: "x86_64".to_owned(),
                package_kind: "deb".to_owned(),
                update_target: UPDATE_TARGET.to_owned(),
            })
        || target_version <= source_version
        || manifest.source.library_schema_version == 0
        || manifest.target.library_schema_version < manifest.source.library_schema_version
        || manifest.target.trusted_sequence == 0
        || manifest.target.trusted_sequence > MAX_SAFE_JSON_INTEGER
        || !valid_sha256(&manifest.target.trusted_payload_sha256)
        || !valid_library_path(&manifest.source.library_path)
        || !valid_native_identity(&manifest.source.native_package, &manifest.source.version)
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
        || !valid_sha256(&manifest.runnable_predecessor.tree_sha256)
        || manifest.runnable_predecessor.source_package_sha256
            != manifest.predecessor_package.sha256
        || manifest.library_backup.relative_path != LIBRARY_BACKUP_RELATIVE_PATH
        || manifest.library_backup.size_bytes == 0
        || manifest.library_backup.size_bytes > MAX_LIBRARY_BACKUP_BYTES
        || !valid_sha256(&manifest.library_backup.sha256)
        || !valid_lifecycle_evidence(manifest)
    {
        return Err(LinuxRecoveryStateError::InvalidState);
    }
    Ok(())
}

fn valid_lifecycle_evidence(manifest: &LinuxRecoveryManifest) -> bool {
    let process_required = matches!(
        manifest.phase,
        LinuxRecoveryPhaseWire::Launching | LinuxRecoveryPhaseWire::Confirmed
    );
    let process_forbidden = matches!(
        manifest.phase,
        LinuxRecoveryPhaseWire::Prepared
            | LinuxRecoveryPhaseWire::ReplacementStarted
            | LinuxRecoveryPhaseWire::ReplacementInstalled
    );
    if (process_required && manifest.replacement_process.is_none())
        || (process_forbidden && manifest.replacement_process.is_some())
        || manifest
            .replacement_process
            .as_ref()
            .is_some_and(|process| !valid_replacement_process(process))
    {
        return false;
    }
    match manifest.phase {
        LinuxRecoveryPhaseWire::Prepared
        | LinuxRecoveryPhaseWire::ReplacementStarted
        | LinuxRecoveryPhaseWire::ReplacementInstalled
        | LinuxRecoveryPhaseWire::Launching
        | LinuxRecoveryPhaseWire::Confirmed => {
            manifest.native_recovery.attempts == 0
                && manifest.native_recovery.last_failure.is_none()
        }
        LinuxRecoveryPhaseWire::NativeRecoveryUnavailable => {
            (1..=2).contains(&manifest.native_recovery.attempts)
                && manifest.native_recovery.last_failure.is_some()
        }
        LinuxRecoveryPhaseWire::RecoveryFailed => {
            manifest.native_recovery.attempts == 3
                && manifest.native_recovery.last_failure.is_some()
        }
        LinuxRecoveryPhaseWire::Recovered => {
            (1..=3).contains(&manifest.native_recovery.attempts)
                && manifest.native_recovery.last_failure.is_none()
        }
        LinuxRecoveryPhaseWire::Recovering => true,
    }
}

fn valid_replacement_process(process: &LinuxReplacementProcess) -> bool {
    (2..=i32::MAX as u32).contains(&process.process_id)
        && valid_boot_id(&process.boot_id)
        && (1..=MAX_SAFE_JSON_INTEGER).contains(&process.start_time_clock_ticks)
        && process.executable_path == INSTALLED_EXECUTABLE_PATH
        && valid_sha256(&process.launch_nonce)
        && canonical_utc(&process.confirmation_deadline).as_deref()
            == Some(process.confirmation_deadline.as_str())
}

fn valid_native_identity(identity: &NativePackageIdentity, source_version: &str) -> bool {
    identity.name == PACKAGE_NAME
        && identity.version == source_version
        && identity.architecture == PACKAGE_ARCHITECTURE
        && identity.executable_path == INSTALLED_EXECUTABLE_PATH
        && identity.desktop_entry_path == INSTALLED_DESKTOP_ENTRY_PATH
}

fn native_identity_matches(identity: &LinuxNativePackageIdentity, version: &str) -> bool {
    identity.name() == PACKAGE_NAME
        && identity.version() == version
        && identity.architecture() == PACKAGE_ARCHITECTURE
        && identity.executable_path() == Path::new(INSTALLED_EXECUTABLE_PATH)
        && identity.desktop_entry_path() == Path::new(INSTALLED_DESKTOP_ENTRY_PATH)
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
) -> Result<LinuxRecoveryPackageExpectation, LinuxRecoveryStateError> {
    LinuxRecoveryPackageExpectation::try_new(
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

fn valid_boot_id(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(index, byte)| match index {
            8 | 13 | 18 | 23 => byte == b'-',
            14 => (b'1'..=b'5').contains(&byte),
            19 => matches!(byte, b'8' | b'9' | b'a' | b'b'),
            _ => byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte),
        })
}

fn valid_library_path(value: &str) -> bool {
    let segments = value.strip_prefix('/').map(|path| path.split('/'));
    (20..=MAX_LOCAL_PATH_BYTES).contains(&value.len())
        && !value.contains('\0')
        && segments.is_some_and(|mut segments| {
            segments
                .by_ref()
                .all(|segment| !segment.is_empty() && segment != "." && segment != "..")
        })
        && value.rsplit('/').next() == Some("fitfreed.sqlite")
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

fn path_text(path: &Path) -> Result<String, LinuxRecoveryStateError> {
    path.to_str()
        .filter(|value| value.len() <= MAX_LOCAL_PATH_BYTES)
        .map(str::to_owned)
        .ok_or(LinuxRecoveryStateError::InvalidInput)
}

fn generate_recovery_id(
    preparation: &LinuxUpdateRecoveryPreparation<'_>,
) -> Result<String, LinuxRecoveryStateError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| LinuxRecoveryStateError::InvalidState)?;
    let mut digest = Sha256::new();
    digest.update(RECOVERY_FORMAT.as_bytes());
    digest.update(RECOVERY_SCHEMA_VERSION.to_be_bytes());
    digest.update(preparation.installed_version.as_bytes());
    digest.update(preparation.authorization.version.as_bytes());
    digest.update(preparation.authorization.trusted_sequence.to_be_bytes());
    digest.update(preparation.authorization.trusted_payload_sha256.as_bytes());
    digest.update(preparation.prepared_at.as_bytes());
    digest.update(std::process::id().to_be_bytes());
    digest.update(now.as_nanos().to_be_bytes());
    Ok(lower_hex(&digest.finalize()))
}

fn prepare_recovery_root(path: &Path) -> Result<PathBuf, LinuxRecoveryStateError> {
    if !path.is_absolute()
        || path
            .components()
            .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(LinuxRecoveryStateError::InvalidInput);
    }
    match fs::symlink_metadata(path) {
        Ok(_) => return canonical_private_directory(path),
        Err(error) if error.kind() == io::ErrorKind::NotFound => {}
        Err(error) => return Err(error.into()),
    }
    create_private_directory(path)?;
    canonical_private_directory(path)
}

fn create_or_validate_private_directory(path: &Path) -> Result<(), LinuxRecoveryStateError> {
    match fs::create_dir(path) {
        Ok(()) => {
            if let Err(error) = set_private_directory_permissions(path) {
                let _ = fs::remove_dir(path);
                return Err(error);
            }
            sync_directory(path.parent().ok_or(LinuxRecoveryStateError::InvalidState)?)?;
            Ok(())
        }
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
            canonical_private_directory(path).map(|_| ())
        }
        Err(error) => Err(error.into()),
    }
}

fn create_private_directory(path: &Path) -> Result<(), LinuxRecoveryStateError> {
    fs::create_dir(path)?;
    if let Err(error) = set_private_directory_permissions(path) {
        let _ = fs::remove_dir(path);
        return Err(error);
    }
    sync_directory(path.parent().ok_or(LinuxRecoveryStateError::InvalidState)?)?;
    Ok(())
}

fn canonical_private_directory(path: &Path) -> Result<PathBuf, LinuxRecoveryStateError> {
    let metadata = fs::symlink_metadata(path)?;
    if !metadata.file_type().is_dir() {
        return Err(LinuxRecoveryStateError::InvalidState);
    }
    let canonical = path.canonicalize()?;
    if canonical != path {
        return Err(LinuxRecoveryStateError::InvalidState);
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::{MetadataExt, PermissionsExt};

        if metadata.uid() != unsafe { libc::geteuid() }
            || metadata.permissions().mode() & 0o077 != 0
        {
            return Err(LinuxRecoveryStateError::InvalidState);
        }
    }
    Ok(canonical)
}

#[cfg(unix)]
fn set_private_directory_permissions(path: &Path) -> Result<(), LinuxRecoveryStateError> {
    use std::os::unix::fs::PermissionsExt;

    fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
    Ok(())
}

#[cfg(not(unix))]
fn set_private_directory_permissions(_path: &Path) -> Result<(), LinuxRecoveryStateError> {
    Ok(())
}

#[cfg(unix)]
fn open_private_lock_file(
    directory: &Path,
    name: &str,
    create: bool,
) -> Result<File, LinuxRecoveryStateError> {
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
        return Err(LinuxRecoveryStateError::InvalidState);
    }
    Ok(file)
}

#[cfg(not(unix))]
fn open_private_lock_file(
    _directory: &Path,
    _name: &str,
    _create: bool,
) -> Result<File, LinuxRecoveryStateError> {
    Err(LinuxRecoveryStateError::InvalidState)
}

struct FileLock {
    file: File,
}

struct StateLock {
    file: File,
}

impl StateLock {
    #[cfg(unix)]
    fn acquire(attempt_directory: &Path) -> Result<Self, LinuxRecoveryStateError> {
        use std::os::fd::AsRawFd;

        let file = open_private_lock_file(attempt_directory, STATE_LOCK_FILE_NAME, false)?;
        if unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX) } != 0 {
            return Err(io::Error::last_os_error().into());
        }
        Ok(Self { file })
    }

    #[cfg(not(unix))]
    fn acquire(_attempt_directory: &Path) -> Result<Self, LinuxRecoveryStateError> {
        Err(LinuxRecoveryStateError::InvalidState)
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

impl FileLock {
    #[cfg(unix)]
    fn acquire(file: File) -> Result<Self, LinuxRecoveryStateError> {
        use std::os::fd::AsRawFd;

        if unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
            return Err(LinuxRecoveryStateError::ActiveAttemptExists);
        }
        Ok(Self { file })
    }

    #[cfg(not(unix))]
    fn acquire(_file: File) -> Result<Self, LinuxRecoveryStateError> {
        Err(LinuxRecoveryStateError::InvalidState)
    }
}

impl Drop for FileLock {
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
    manifest: &LinuxRecoveryManifest,
) -> Result<(), LinuxRecoveryStateError> {
    let bytes = serde_json::to_vec_pretty(manifest)?;
    if bytes.len() as u64 > MAX_MANIFEST_BYTES {
        return Err(LinuxRecoveryStateError::InvalidState);
    }
    let parent = path.parent().ok_or(LinuxRecoveryStateError::InvalidState)?;
    let mut staging = PrivateStagingFile::new(parent, "fitfreed-recovery-manifest", ".tmp")?;
    staging.file_mut()?.write_all(&bytes)?;
    staging.sync_and_close()?;
    staging.persist_noclobber(path)?;
    Ok(())
}

fn write_manifest(
    path: &Path,
    manifest: &LinuxRecoveryManifest,
) -> Result<(), LinuxRecoveryStateError> {
    let bytes = serde_json::to_vec_pretty(manifest)?;
    if bytes.len() as u64 > MAX_MANIFEST_BYTES {
        return Err(LinuxRecoveryStateError::InvalidState);
    }
    let parent = path.parent().ok_or(LinuxRecoveryStateError::InvalidState)?;
    let mut staging = PrivateStagingFile::new(parent, "fitfreed-recovery-manifest", ".tmp")?;
    staging.file_mut()?.write_all(&bytes)?;
    staging.sync_and_close()?;
    staging.persist_replace(path)?;
    Ok(())
}

fn read_manifest(path: &Path) -> Result<LinuxRecoveryManifest, LinuxRecoveryStateError> {
    let bytes = read_bounded_file(path, MAX_MANIFEST_BYTES)?;
    serde_json::from_slice(&bytes).map_err(Into::into)
}

fn read_active_manifest(
    recovery_root: &Path,
    recovery_id: &str,
) -> Result<LinuxRecoveryManifest, LinuxRecoveryStateError> {
    let attempt_directory = canonical_recovery_attempt(recovery_root, recovery_id)?;
    let manifest = read_manifest(&attempt_directory.join(MANIFEST_FILE_NAME))?;
    validate_manifest(&manifest)?;
    if manifest.recovery_id != recovery_id {
        return Err(LinuxRecoveryStateError::InvalidState);
    }
    Ok(manifest)
}

fn canonical_recovery_attempt(
    recovery_root: &Path,
    recovery_id: &str,
) -> Result<PathBuf, LinuxRecoveryStateError> {
    if !valid_sha256(recovery_id) {
        return Err(LinuxRecoveryStateError::InvalidInput);
    }
    let attempts_directory =
        canonical_private_directory(&recovery_root.join(ATTEMPTS_DIRECTORY_NAME))?;
    canonical_private_directory(&attempts_directory.join(recovery_id))
}

fn write_active_recovery_id(path: &Path, recovery_id: &str) -> Result<(), LinuxRecoveryStateError> {
    if !valid_sha256(recovery_id) {
        return Err(LinuxRecoveryStateError::InvalidInput);
    }
    let parent = path.parent().ok_or(LinuxRecoveryStateError::InvalidState)?;
    let mut staging = PrivateStagingFile::new(parent, "fitfreed-recovery-active", ".tmp")?;
    staging
        .file_mut()?
        .write_all(format!("{recovery_id}\n").as_bytes())?;
    staging.sync_and_close()?;
    staging.persist_noclobber(path).map_err(|error| {
        if error.kind() == io::ErrorKind::AlreadyExists {
            LinuxRecoveryStateError::ActiveAttemptExists
        } else {
            LinuxRecoveryStateError::Io(error)
        }
    })
}

fn read_active_recovery_id(path: &Path) -> Result<String, LinuxRecoveryStateError> {
    let bytes = read_bounded_file(path, 65)?;
    let text = std::str::from_utf8(&bytes).map_err(|_| LinuxRecoveryStateError::InvalidState)?;
    let recovery_id = text
        .strip_suffix('\n')
        .ok_or(LinuxRecoveryStateError::InvalidState)?;
    if bytes.len() != 65 || !valid_sha256(recovery_id) {
        return Err(LinuxRecoveryStateError::InvalidState);
    }
    Ok(recovery_id.to_owned())
}

fn read_bounded_file(path: &Path, maximum_bytes: u64) -> Result<Vec<u8>, LinuxRecoveryStateError> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;

        options.custom_flags(libc::O_NOFOLLOW);
    }
    let file = options.open(path)?;
    let metadata = file.metadata()?;
    if !metadata.file_type().is_file() || metadata.len() == 0 || metadata.len() > maximum_bytes {
        return Err(LinuxRecoveryStateError::InvalidState);
    }
    let mut bytes = Vec::with_capacity(
        usize::try_from(metadata.len()).map_err(|_| LinuxRecoveryStateError::InvalidState)?,
    );
    file.take(maximum_bytes + 1).read_to_end(&mut bytes)?;
    if bytes.len() as u64 != metadata.len() {
        return Err(LinuxRecoveryStateError::InvalidState);
    }
    Ok(bytes)
}

fn sync_prepared_attempt(path: &Path) -> Result<(), LinuxRecoveryStateError> {
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
    sync_directory(&path.join("previous"))?;
    sync_directory(&path.join("candidate"))?;
    sync_directory(path)?;
    Ok(())
}

fn file_sha256(path: &Path, expected_size: u64) -> Result<String, LinuxRecoveryStateError> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;

        options.custom_flags(libc::O_NOFOLLOW);
    }
    let mut file = options.open(path)?;
    let metadata = file.metadata()?;
    if !metadata.file_type().is_file() || metadata.len() != expected_size {
        return Err(LinuxRecoveryStateError::InvalidState);
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
            .checked_add(u64::try_from(read).map_err(|_| LinuxRecoveryStateError::InvalidState)?)
            .filter(|value| *value <= expected_size)
            .ok_or(LinuxRecoveryStateError::InvalidState)?;
        digest.update(&buffer[..read]);
    }
    if total != expected_size {
        return Err(LinuxRecoveryStateError::InvalidState);
    }
    Ok(lower_hex(&digest.finalize()))
}

fn lower_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn path_entry_exists(path: &Path) -> Result<bool, LinuxRecoveryStateError> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.into()),
    }
}

#[cfg(all(test, unix))]
mod tests {
    use std::{cell::Cell, io::Cursor};

    use minisign::{sign, KeyPair};
    use rusqlite::Connection;
    use tempfile::TempDir;

    use super::*;
    use crate::infrastructure::ensure_schema;

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
            predecessor: &LinuxRecoveryPackageExpectation,
            candidate_bytes: &[u8],
            candidate: &LinuxRecoveryPackageExpectation,
        ) -> Result<String, LinuxRecoveryPackageError> {
            if self.fail_preparation {
                return Err(LinuxRecoveryPackageError::InvalidPackage);
            }
            fs::create_dir_all(attempt_directory.join("previous/runnable/usr/bin"))?;
            fs::create_dir_all(attempt_directory.join("previous/runnable/usr/share/applications"))?;
            fs::create_dir_all(attempt_directory.join("candidate"))?;
            fs::copy(
                predecessor_source,
                attempt_directory.join(PREDECESSOR_PACKAGE_RELATIVE_PATH),
            )?;
            fs::write(
                attempt_directory.join(TARGET_PACKAGE_RELATIVE_PATH),
                candidate_bytes,
            )?;
            fs::write(
                attempt_directory.join("previous/runnable/usr/bin/fitfreed"),
                "synthetic executable",
            )?;
            fs::write(
                attempt_directory.join("previous/runnable/usr/share/applications/FitFreed.desktop"),
                "[Desktop Entry]\nName=FitFreed\n",
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
            predecessor: &LinuxRecoveryPackageExpectation,
            candidate: &LinuxRecoveryPackageExpectation,
            runnable_tree_sha256: &str,
        ) -> Result<(), LinuxRecoveryPackageError> {
            self.verification_count
                .set(self.verification_count.get() + 1);
            let predecessor_bytes =
                fs::read(attempt_directory.join(PREDECESSOR_PACKAGE_RELATIVE_PATH))?;
            let candidate_bytes = fs::read(attempt_directory.join(TARGET_PACKAGE_RELATIVE_PATH))?;
            if predecessor_bytes.len() as u64 != predecessor.size_bytes()
                || lower_hex(&Sha256::digest(&predecessor_bytes)) != predecessor.sha256()
                || candidate_bytes.len() as u64 != candidate.size_bytes()
                || lower_hex(&Sha256::digest(&candidate_bytes)) != candidate.sha256()
                || runnable_tree_sha256 != "9".repeat(64)
            {
                return Err(LinuxRecoveryPackageError::InvalidPackage);
            }
            Ok(())
        }
    }

    struct Harness {
        _directory: TempDir,
        recovery_root: PathBuf,
        library_path: PathBuf,
        predecessor_path: PathBuf,
        candidate_bytes: Vec<u8>,
        authorization: UpdateInstallationAuthorization,
        identity: LinuxNativePackageIdentity,
    }

    impl Harness {
        fn new() -> Self {
            let directory = TempDir::new().expect("temporary directory");
            let root = directory.path().canonicalize().expect("canonical root");
            let library_path = root.join("fitfreed.sqlite");
            let connection = Connection::open(&library_path).expect("library");
            ensure_schema(&connection).expect("current library schema");
            drop(connection);
            let predecessor_path = root.join("predecessor.deb");
            let predecessor_bytes = b"synthetic predecessor package";
            let candidate_bytes = b"synthetic candidate package".to_vec();
            fs::write(&predecessor_path, predecessor_bytes).expect("predecessor package");
            let key_pair = KeyPair::generate_unencrypted_keypair().expect("synthetic key pair");
            let artifact = |bytes: &[u8], version: &str| UpdateArtifact {
                target: UPDATE_TARGET.to_owned(),
                package_url: format!(
                    "https://updates.invalid/{version}/FitFreed_{version}_amd64.deb"
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
                recovery_root: root.join("update-recovery"),
                library_path,
                predecessor_path,
                candidate_bytes,
                authorization,
                identity: LinuxNativePackageIdentity::for_test("0.1.0"),
            }
        }

        fn preparation(&self) -> LinuxUpdateRecoveryPreparation<'_> {
            LinuxUpdateRecoveryPreparation {
                recovery_root: &self.recovery_root,
                library_path: &self.library_path,
                installed_version: "0.1.0",
                prepared_at: "2026-09-02T08:00:00Z",
                authorization: &self.authorization,
                predecessor_package_path: &self.predecessor_path,
                candidate_package_bytes: &self.candidate_bytes,
            }
        }
    }

    #[test]
    fn prepares_publishes_and_reopens_one_complete_version_two_attempt() {
        let harness = Harness::new();
        let packages = SyntheticPackages::available();

        let prepared =
            prepare_linux_update_recovery_with(&packages, &harness.identity, harness.preparation())
                .expect("prepared Linux recovery");

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
        let manifest = verify_linux_update_recovery_with(
            &packages,
            &harness.recovery_root,
            prepared.recovery_id(),
        )
        .expect("verified Linux recovery");
        assert_eq!(manifest.schema_version, 2);
        assert_eq!(manifest.phase, LinuxRecoveryPhaseWire::Prepared);
        assert_eq!(manifest.source.version, "0.1.0");
        assert_eq!(manifest.target.version, "0.2.0");
        assert_eq!(manifest.predecessor_package.version, "0.1.0");
        assert_eq!(manifest.target_package.version, "0.2.0");
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
                prepare_linux_update_recovery_with(
                    &SyntheticPackages::available(),
                    &harness.identity,
                    harness.preparation(),
                ),
                Err(LinuxRecoveryStateError::InvalidInput)
            ));
            assert!(!harness.recovery_root.exists());
        }
    }

    #[test]
    fn rejects_an_existing_recovery_root_with_broad_permissions_without_rewriting_it() {
        use std::os::unix::fs::PermissionsExt;

        let harness = Harness::new();
        fs::create_dir(&harness.recovery_root).expect("recovery root");
        fs::set_permissions(&harness.recovery_root, fs::Permissions::from_mode(0o755))
            .expect("broad permissions");

        assert!(matches!(
            prepare_linux_update_recovery_with(
                &SyntheticPackages::available(),
                &harness.identity,
                harness.preparation(),
            ),
            Err(LinuxRecoveryStateError::InvalidState)
        ));
        assert_eq!(
            fs::symlink_metadata(&harness.recovery_root)
                .expect("preserved root")
                .permissions()
                .mode()
                & 0o777,
            0o755
        );
        assert!(!harness.recovery_root.join(ATTEMPTS_DIRECTORY_NAME).exists());
    }

    #[test]
    fn removes_incomplete_preparation_and_preserves_an_active_attempt() {
        let harness = Harness::new();
        let packages = SyntheticPackages {
            fail_preparation: true,
            verification_count: Cell::new(0),
        };
        assert!(matches!(
            prepare_linux_update_recovery_with(&packages, &harness.identity, harness.preparation(),),
            Err(LinuxRecoveryStateError::Package(_))
        ));
        assert_eq!(
            fs::read_dir(harness.recovery_root.join(ATTEMPTS_DIRECTORY_NAME))
                .expect("empty attempts")
                .count(),
            0
        );

        let packages = SyntheticPackages::available();
        let prepared =
            prepare_linux_update_recovery_with(&packages, &harness.identity, harness.preparation())
                .expect("prepared recovery");
        assert!(matches!(
            prepare_linux_update_recovery_with(&packages, &harness.identity, harness.preparation(),),
            Err(LinuxRecoveryStateError::ActiveAttemptExists)
        ));
        assert!(prepared.attempt_directory().exists());
    }

    #[test]
    fn detects_package_library_and_manifest_mutation_after_publication() {
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
                value["platform"]["os"] = serde_json::Value::String("windows".to_owned());
                fs::write(
                    path,
                    serde_json::to_vec_pretty(&value).expect("changed manifest"),
                )
                .expect("changed manifest")
            },
        ] {
            let harness = Harness::new();
            let packages = SyntheticPackages::available();
            let prepared = prepare_linux_update_recovery_with(
                &packages,
                &harness.identity,
                harness.preparation(),
            )
            .expect("prepared recovery");
            mutate(prepared.attempt_directory());
            assert!(verify_linux_update_recovery_with(
                &packages,
                &harness.recovery_root,
                prepared.recovery_id(),
            )
            .is_err());
        }
    }

    #[test]
    fn persists_only_legal_transitions_and_records_exact_linux_process_evidence() {
        let harness = Harness::new();
        let packages = SyntheticPackages::available();
        let prepared =
            prepare_linux_update_recovery_with(&packages, &harness.identity, harness.preparation())
                .expect("prepared recovery");

        assert_eq!(
            active_linux_update_recovery_phase(&harness.recovery_root).expect("active phase"),
            Some((
                prepared.recovery_id().to_owned(),
                PackagedUpdateRecoveryPhase::Prepared,
            ))
        );
        assert!(transition_active_linux_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::Launching,
        )
        .is_err());
        transition_active_linux_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementStarted,
        )
        .expect("replacement started");
        transition_active_linux_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementInstalled,
        )
        .expect("replacement installed");

        let process = LinuxRecoveryProcessIdentity::for_test(
            42,
            "12345678-1234-4123-8123-123456789abc",
            123_456,
        );
        let recorded = record_active_linux_update_recovery_replacement_launch(
            &harness.recovery_root,
            prepared.recovery_id(),
            LinuxUpdateRecoveryReplacementLaunch {
                process: &process,
                launch_nonce: &"a".repeat(64),
                confirmation_deadline: "2026-09-02T08:01:00Z",
            },
        )
        .expect("recorded replacement");
        assert_eq!(recorded.process_id(), 42);
        assert_eq!(recorded.boot_id(), process.boot_id());
        assert_eq!(recorded.start_time_clock_ticks(), 123_456);
        assert_eq!(recorded.launch_nonce(), "a".repeat(64));
        assert_eq!(
            active_linux_update_recovery_phase(&harness.recovery_root)
                .expect("launching phase")
                .map(|(_, phase)| phase),
            Some(PackagedUpdateRecoveryPhase::Launching)
        );
    }

    #[test]
    fn resolves_watchdog_authority_only_from_the_preserved_linux_executable() {
        let harness = Harness::new();
        let packages = SyntheticPackages::available();
        let prepared =
            prepare_linux_update_recovery_with(&packages, &harness.identity, harness.preparation())
                .expect("prepared recovery");
        let watchdog_executable = prepared
            .attempt_directory()
            .join(RUNNABLE_PREDECESSOR_RELATIVE_PATH)
            .join(RUNNABLE_EXECUTABLE_RELATIVE_PATH);

        let context = resolve_linux_update_recovery_watchdog_context_with(
            &packages,
            &watchdog_executable,
            Path::new(INSTALLED_EXECUTABLE_PATH),
        )
        .expect("watchdog context");
        assert_eq!(context.recovery_id(), prepared.recovery_id());
        assert_eq!(context.library_path(), harness.library_path);
        assert_eq!(context.target_version(), "0.2.0");
        assert_eq!(context.replacement_process(), None);

        assert!(resolve_linux_update_recovery_watchdog_context_with(
            &packages,
            &watchdog_executable,
            Path::new("/usr/local/bin/fitfreed"),
        )
        .is_err());
        assert!(resolve_linux_update_recovery_watchdog_context_with(
            &packages,
            &prepared.attempt_directory().join("previous/package.deb"),
            Path::new(INSTALLED_EXECUTABLE_PATH),
        )
        .is_err());
    }

    #[test]
    fn permits_only_one_linux_watchdog_and_one_exact_candidate_process() {
        let harness = Harness::new();
        let packages = SyntheticPackages::available();
        let prepared =
            prepare_linux_update_recovery_with(&packages, &harness.identity, harness.preparation())
                .expect("prepared recovery");
        let watchdog_executable = prepared
            .attempt_directory()
            .join(RUNNABLE_PREDECESSOR_RELATIVE_PATH)
            .join(RUNNABLE_EXECUTABLE_RELATIVE_PATH);
        let context = resolve_linux_update_recovery_watchdog_context_with(
            &packages,
            &watchdog_executable,
            Path::new(INSTALLED_EXECUTABLE_PATH),
        )
        .expect("watchdog context");

        let watchdog = acquire_linux_update_recovery_watchdog_lease_with(&packages, &context)
            .expect("watchdog lease");
        assert_eq!(watchdog.recovery_id(), prepared.recovery_id());
        assert!(matches!(
            acquire_linux_update_recovery_watchdog_lease_with(&packages, &context),
            Err(LinuxRecoveryStateError::ActiveAttemptExists)
        ));

        transition_active_linux_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementStarted,
        )
        .expect("replacement started");
        transition_active_linux_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            PackagedUpdateRecoveryPhase::ReplacementInstalled,
        )
        .expect("replacement installed");
        let process = LinuxRecoveryProcessIdentity::for_test(
            42,
            "12345678-1234-4123-8123-123456789abc",
            123_456,
        );
        let launch_nonce = "a".repeat(64);
        record_active_linux_update_recovery_replacement_launch(
            &harness.recovery_root,
            prepared.recovery_id(),
            LinuxUpdateRecoveryReplacementLaunch {
                process: &process,
                launch_nonce: &launch_nonce,
                confirmation_deadline: "2026-09-02T08:01:00Z",
            },
        )
        .expect("recorded replacement");

        let candidate = acquire_linux_update_recovery_candidate_lease_with(
            &packages,
            &harness.recovery_root,
            prepared.recovery_id(),
            &launch_nonce,
            &process,
            &LinuxNativePackageIdentity::for_test("0.2.0"),
        )
        .expect("candidate lease");
        assert_eq!(candidate.recovery_id(), prepared.recovery_id());
        assert_eq!(candidate.launch_nonce(), launch_nonce);
        assert!(matches!(
            acquire_linux_update_recovery_candidate_lease_with(
                &packages,
                &harness.recovery_root,
                prepared.recovery_id(),
                &launch_nonce,
                &process,
                &LinuxNativePackageIdentity::for_test("0.2.0"),
            ),
            Err(LinuxRecoveryStateError::ActiveAttemptExists)
        ));

        drop(candidate);
        assert!(acquire_linux_update_recovery_candidate_lease_with(
            &packages,
            &harness.recovery_root,
            prepared.recovery_id(),
            &"b".repeat(64),
            &process,
            &LinuxNativePackageIdentity::for_test("0.2.0"),
        )
        .is_err());
        drop(watchdog);
        acquire_linux_update_recovery_watchdog_lease_with(&packages, &context)
            .expect("released watchdog lease");
    }

    #[test]
    fn rejects_candidate_authority_when_any_process_or_package_component_differs() {
        for (observed_process, native_identity) in [
            (
                LinuxRecoveryProcessIdentity::for_test(
                    43,
                    "12345678-1234-4123-8123-123456789abc",
                    123_456,
                ),
                LinuxNativePackageIdentity::for_test("0.2.0"),
            ),
            (
                LinuxRecoveryProcessIdentity::for_test(
                    42,
                    "12345678-1234-4123-8123-123456789abc",
                    123_457,
                ),
                LinuxNativePackageIdentity::for_test("0.2.0"),
            ),
            (
                LinuxRecoveryProcessIdentity::for_test(
                    42,
                    "12345678-1234-4123-8123-123456789abc",
                    123_456,
                ),
                LinuxNativePackageIdentity::for_test("0.2.1"),
            ),
        ] {
            let harness = Harness::new();
            let packages = SyntheticPackages::available();
            let prepared = prepare_linux_update_recovery_with(
                &packages,
                &harness.identity,
                harness.preparation(),
            )
            .expect("prepared recovery");
            transition_active_linux_update_recovery(
                &harness.recovery_root,
                prepared.recovery_id(),
                PackagedUpdateRecoveryPhase::ReplacementStarted,
            )
            .expect("replacement started");
            transition_active_linux_update_recovery(
                &harness.recovery_root,
                prepared.recovery_id(),
                PackagedUpdateRecoveryPhase::ReplacementInstalled,
            )
            .expect("replacement installed");
            let recorded_process = LinuxRecoveryProcessIdentity::for_test(
                42,
                "12345678-1234-4123-8123-123456789abc",
                123_456,
            );
            let launch_nonce = "a".repeat(64);
            record_active_linux_update_recovery_replacement_launch(
                &harness.recovery_root,
                prepared.recovery_id(),
                LinuxUpdateRecoveryReplacementLaunch {
                    process: &recorded_process,
                    launch_nonce: &launch_nonce,
                    confirmation_deadline: "2026-09-02T08:01:00Z",
                },
            )
            .expect("recorded replacement");
            assert!(acquire_linux_update_recovery_candidate_lease_with(
                &packages,
                &harness.recovery_root,
                prepared.recovery_id(),
                &launch_nonce,
                &observed_process,
                &native_identity,
            )
            .is_err());
        }
    }
}
