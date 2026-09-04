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
    PackagedUpdateRecoveryPhase, UpdateArtifact, UpdateInstallationAuthorization,
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
    prepare_windows_recovery_packages_from_path, query_windows_native_package_identity,
    verify_library_file, verify_windows_recovery_packages, ImportError,
    WindowsNativePackageIdentity, WindowsRecoveryPackageError, WindowsRecoveryPackageExpectation,
    SCHEMA_VERSION,
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
    #[error("the Windows recovery package state is invalid")]
    Package(#[from] WindowsRecoveryPackageError),
    #[error("the Windows recovery library state is invalid")]
    Library(#[from] ImportError),
    #[error("Windows recovery input/output failure: {0}")]
    Io(#[from] io::Error),
    #[error("Windows recovery manifest failure: {0}")]
    Manifest(#[from] serde_json::Error),
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
    last_failure: Option<NativeRecoveryFailure>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
enum NativeRecoveryFailure {
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
        .map_err(map_outcome_lock_error)?;
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
        drop(open_private_lock_file(&attempt_directory, name, false)?);
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

fn map_outcome_lock_error(error: WindowsRecoveryStateError) -> WindowsRecoveryStateError {
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

fn read_manifest(path: &Path) -> Result<WindowsRecoveryManifest, WindowsRecoveryStateError> {
    let bytes = read_bounded_file(path, MAX_MANIFEST_BYTES)?;
    serde_json::from_slice(&bytes).map_err(Into::into)
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
    use std::{cell::Cell, io::Cursor, os::unix::fs::symlink};

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
}
