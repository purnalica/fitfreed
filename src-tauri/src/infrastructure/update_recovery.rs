use std::{
    fs::{self, File, OpenOptions},
    io::{self, Read, Write},
    path::{Component, Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

#[cfg(target_os = "macos")]
use std::process::Command;

use chrono::{DateTime, Duration as ChronoDuration, SecondsFormat, Utc};
use fitfreed_application::{
    validate_update_recovery_transition, UpdateInstallationAuthorization, UpdateRecoveryOutcome,
    UpdateRecoveryOutcomeKind, UpdateRecoveryPhase,
};
use semver::Version;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

use super::{
    backup_database,
    local_file::{sync_directory, PrivateStagingFile},
    update_recovery_outcome::{
        read_update_recovery_outcome, remove_update_recovery_outcome,
        write_update_recovery_outcome, UpdateRecoveryOutcomeStoreError,
    },
    verify_library_file, ImportError, UpdateRecoveryMaintenance, SCHEMA_VERSION,
};

const RECOVERY_FORMAT: &str = "org.fitfreed.update-recovery";
const RECOVERY_SCHEMA_VERSION: u32 = 1;
const ACTIVE_FILE_NAME: &str = "active";
const OUTCOME_LOCK_FILE_NAME: &str = "outcome.lock";
const ATTEMPTS_DIRECTORY_NAME: &str = "attempts";
const MANIFEST_FILE_NAME: &str = "manifest.json";
const STATE_LOCK_FILE_NAME: &str = "state.lock";
const CANDIDATE_LOCK_FILE_NAME: &str = "candidate.lock";
const WATCHDOG_LOCK_FILE_NAME: &str = "watchdog.lock";
const APPLICATION_BACKUP_RELATIVE_PATH: &str = "previous/FitFreed.app";
const LIBRARY_BACKUP_RELATIVE_PATH: &str = "previous/fitfreed.sqlite";
const EXPECTED_BUNDLE_IDENTIFIER: &str = "org.fitfreed.desktop";
const EXPECTED_BUNDLE_EXECUTABLE: &str = "fitfreed";
const MAX_MANIFEST_BYTES: u64 = 64 * 1024;
const MAX_LIBRARY_BACKUP_BYTES: u64 = 1024 * 1024 * 1024 * 1024;
const MAX_LOCAL_PATH_BYTES: usize = 4096;

#[derive(Debug, Error)]
pub enum UpdateRecoveryError {
    #[error("update recovery input is invalid")]
    InvalidInput,
    #[error("an update recovery attempt is already active")]
    ActiveAttemptExists,
    #[error("the update recovery state is invalid")]
    InvalidState,
    #[error("the application recovery copy failed")]
    ApplicationCopy,
    #[error("the application recovery copy is invalid")]
    InvalidApplicationCopy,
    #[error("the library recovery copy is invalid")]
    InvalidLibraryCopy,
    #[error("the update recovery transition is invalid")]
    InvalidTransition,
    #[error("the platform cannot preserve the application")]
    UnsupportedPlatform,
    #[error("update recovery input/output failure: {0}")]
    Io(#[from] io::Error),
    #[error("update recovery manifest failure: {0}")]
    Manifest(#[from] serde_json::Error),
    #[error("update recovery library failure: {0}")]
    Library(#[from] ImportError),
}

impl From<UpdateRecoveryOutcomeStoreError> for UpdateRecoveryError {
    fn from(value: UpdateRecoveryOutcomeStoreError) -> Self {
        match value {
            UpdateRecoveryOutcomeStoreError::InvalidState => Self::InvalidState,
            UpdateRecoveryOutcomeStoreError::Io(error) => Self::Io(error),
            UpdateRecoveryOutcomeStoreError::Manifest(error) => Self::Manifest(error),
        }
    }
}

pub trait ApplicationCopyPort {
    fn copy_application(&self, source: &Path, destination: &Path) -> Result<(), String>;
}

pub struct PlatformApplicationCopier;

impl ApplicationCopyPort for PlatformApplicationCopier {
    fn copy_application(&self, source: &Path, destination: &Path) -> Result<(), String> {
        copy_platform_application(source, destination)
    }
}

#[cfg(target_os = "macos")]
fn copy_platform_application(source: &Path, destination: &Path) -> Result<(), String> {
    let status = Command::new("/usr/bin/ditto")
        .arg("--rsrc")
        .arg("--extattr")
        .arg(source)
        .arg(destination)
        .status()
        .map_err(|error| error.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err("the macOS application copy command failed".to_owned())
    }
}

#[cfg(not(target_os = "macos"))]
fn copy_platform_application(_source: &Path, _destination: &Path) -> Result<(), String> {
    Err("application preservation is not implemented for this platform".to_owned())
}

pub struct UpdateRecoveryPreparation<'a> {
    pub recovery_root: &'a Path,
    pub current_application_path: &'a Path,
    pub library_path: &'a Path,
    pub installed_version: &'a str,
    pub prepared_at: &'a str,
    pub authorization: &'a UpdateInstallationAuthorization,
}

#[derive(Clone, Copy)]
pub struct UpdateRecoveryRestoration<'a> {
    pub recovery_root: &'a Path,
    pub recovery_id: &'a str,
    pub expected_application_path: &'a Path,
    pub expected_library_path: &'a Path,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateRecoveryWatchdogContext {
    recovery_root: PathBuf,
    recovery_id: String,
    installed_application_path: PathBuf,
    library_path: PathBuf,
    target_version: String,
    target_library_schema_version: u32,
    prepared_at: String,
    replacement_process: Option<UpdateRecoveryReplacementProcess>,
}

impl UpdateRecoveryWatchdogContext {
    pub fn recovery_root(&self) -> &Path {
        &self.recovery_root
    }

    pub fn recovery_id(&self) -> &str {
        &self.recovery_id
    }

    pub fn installed_application_path(&self) -> &Path {
        &self.installed_application_path
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

    pub fn replacement_process(&self) -> Option<&UpdateRecoveryReplacementProcess> {
        self.replacement_process.as_ref()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateRecoveryReplacementProcess {
    process_id: u32,
    started_at_unix_seconds: u64,
    started_at_microseconds: u64,
    launch_nonce: String,
    confirmation_deadline: String,
}

impl UpdateRecoveryReplacementProcess {
    pub fn process_id(&self) -> u32 {
        self.process_id
    }

    pub fn started_at_unix_seconds(&self) -> u64 {
        self.started_at_unix_seconds
    }

    pub fn started_at_microseconds(&self) -> u64 {
        self.started_at_microseconds
    }

    pub fn launch_nonce(&self) -> &str {
        &self.launch_nonce
    }

    pub fn confirmation_deadline(&self) -> &str {
        &self.confirmation_deadline
    }
}

pub struct UpdateRecoveryReplacementLaunch<'a> {
    pub process_id: u32,
    pub started_at_unix_seconds: u64,
    pub started_at_microseconds: u64,
    pub launch_nonce: &'a str,
    pub confirmation_deadline: &'a str,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct UpdateRecoveryProcessIdentity {
    process_id: u32,
    started_at_unix_seconds: u64,
    started_at_microseconds: u64,
}

impl UpdateRecoveryProcessIdentity {
    pub fn process_id(&self) -> u32 {
        self.process_id
    }

    pub fn started_at_unix_seconds(&self) -> u64 {
        self.started_at_unix_seconds
    }

    pub fn started_at_microseconds(&self) -> u64 {
        self.started_at_microseconds
    }
}

pub struct UpdateRecoveryCandidateLease {
    file: File,
    recovery_id: String,
    launch_nonce: String,
}

pub struct UpdateRecoveryWatchdogLease {
    file: File,
    recovery_id: String,
}

impl UpdateRecoveryCandidateLease {
    pub fn recovery_id(&self) -> &str {
        &self.recovery_id
    }

    pub fn launch_nonce(&self) -> &str {
        &self.launch_nonce
    }

    #[cfg(test)]
    pub(crate) fn for_test(file: File, recovery_id: String, launch_nonce: String) -> Self {
        Self {
            file,
            recovery_id,
            launch_nonce,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreparedUpdateRecovery {
    recovery_id: String,
    attempt_directory: PathBuf,
    source_library_schema_version: u32,
}

impl PreparedUpdateRecovery {
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct UpdateRecoveryManifest {
    format: String,
    schema_version: u32,
    recovery_id: String,
    phase: RecoveryPhaseWire,
    prepared_at: String,
    replacement_process: Option<ReplacementProcess>,
    source: RecoverySource,
    target: RecoveryTarget,
    application_backup: ApplicationBackup,
    library_backup: LibraryBackup,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ReplacementProcess {
    process_id: u32,
    started_at_unix_seconds: u64,
    started_at_microseconds: u64,
    launch_nonce: String,
    confirmation_deadline: String,
}

impl From<ReplacementProcess> for UpdateRecoveryReplacementProcess {
    fn from(value: ReplacementProcess) -> Self {
        Self {
            process_id: value.process_id,
            started_at_unix_seconds: value.started_at_unix_seconds,
            started_at_microseconds: value.started_at_microseconds,
            launch_nonce: value.launch_nonce,
            confirmation_deadline: value.confirmation_deadline,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RecoverySource {
    version: String,
    library_schema_version: u32,
    application_path: String,
    library_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RecoveryTarget {
    version: String,
    library_schema_version: u32,
    trusted_sequence: u64,
    trusted_payload_sha256: String,
    package_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ApplicationBackup {
    relative_path: String,
    tree_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LibraryBackup {
    relative_path: String,
    size_bytes: u64,
    sha256: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
enum RecoveryPhaseWire {
    Prepared,
    ReplacementStarted,
    ReplacementInstalled,
    Launching,
    Confirmed,
    Recovering,
    Recovered,
    RecoveryFailed,
}

impl From<RecoveryPhaseWire> for UpdateRecoveryPhase {
    fn from(value: RecoveryPhaseWire) -> Self {
        match value {
            RecoveryPhaseWire::Prepared => Self::Prepared,
            RecoveryPhaseWire::ReplacementStarted => Self::ReplacementStarted,
            RecoveryPhaseWire::ReplacementInstalled => Self::ReplacementInstalled,
            RecoveryPhaseWire::Launching => Self::Launching,
            RecoveryPhaseWire::Confirmed => Self::Confirmed,
            RecoveryPhaseWire::Recovering => Self::Recovering,
            RecoveryPhaseWire::Recovered => Self::Recovered,
            RecoveryPhaseWire::RecoveryFailed => Self::RecoveryFailed,
        }
    }
}

impl From<UpdateRecoveryPhase> for RecoveryPhaseWire {
    fn from(value: UpdateRecoveryPhase) -> Self {
        match value {
            UpdateRecoveryPhase::Prepared => Self::Prepared,
            UpdateRecoveryPhase::ReplacementStarted => Self::ReplacementStarted,
            UpdateRecoveryPhase::ReplacementInstalled => Self::ReplacementInstalled,
            UpdateRecoveryPhase::Launching => Self::Launching,
            UpdateRecoveryPhase::Confirmed => Self::Confirmed,
            UpdateRecoveryPhase::Recovering => Self::Recovering,
            UpdateRecoveryPhase::Recovered => Self::Recovered,
            UpdateRecoveryPhase::RecoveryFailed => Self::RecoveryFailed,
        }
    }
}

pub fn prepare_update_recovery(
    copier: &impl ApplicationCopyPort,
    preparation: UpdateRecoveryPreparation<'_>,
) -> Result<PreparedUpdateRecovery, UpdateRecoveryError> {
    validate_preparation(&preparation)?;
    fs::create_dir_all(preparation.recovery_root)?;
    set_private_directory_permissions(preparation.recovery_root)?;
    let recovery_root = preparation.recovery_root.canonicalize()?;
    let outcome_lock = open_private_lock_file(&recovery_root, OUTCOME_LOCK_FILE_NAME, true)?;
    let _outcome_lock = RecoveryFileLock::acquire(outcome_lock)?;
    let active_path = recovery_root.join(ACTIVE_FILE_NAME);
    if active_path.exists() {
        return Err(UpdateRecoveryError::ActiveAttemptExists);
    }
    if let Some(outcome) = read_update_recovery_outcome(&recovery_root)? {
        let receipt_bound_attempt = recovery_root
            .join(ATTEMPTS_DIRECTORY_NAME)
            .join(outcome.recovery_id);
        if path_entry_exists(&receipt_bound_attempt)? {
            return Err(UpdateRecoveryError::ActiveAttemptExists);
        }
    }

    let application_path = preparation.current_application_path.canonicalize()?;
    let library_path = preparation.library_path.canonicalize()?;
    if application_path.file_name().and_then(|name| name.to_str()) != Some("FitFreed.app")
        || library_path.file_name().and_then(|name| name.to_str()) != Some("fitfreed.sqlite")
    {
        return Err(UpdateRecoveryError::InvalidInput);
    }
    validate_application_bundle(&application_path, preparation.installed_version)?;

    let attempts_directory = recovery_root.join(ATTEMPTS_DIRECTORY_NAME);
    fs::create_dir_all(&attempts_directory)?;
    set_private_directory_permissions(&attempts_directory)?;
    let recovery_id = generate_recovery_id(&preparation)?;
    let staging_directory = attempts_directory.join(format!(".staging-{recovery_id}"));
    let attempt_directory = attempts_directory.join(&recovery_id);
    if staging_directory.exists() || attempt_directory.exists() {
        return Err(UpdateRecoveryError::InvalidState);
    }
    fs::create_dir(&staging_directory)?;
    set_private_directory_permissions(&staging_directory)?;
    let mut staging = StagingDirectory::new(staging_directory.clone());
    drop(RecoveryStateLock::acquire(&staging_directory)?);
    drop(open_private_lock_file(
        &staging_directory,
        CANDIDATE_LOCK_FILE_NAME,
        true,
    )?);
    drop(open_private_lock_file(
        &staging_directory,
        WATCHDOG_LOCK_FILE_NAME,
        true,
    )?);

    let application_backup_path = staging_directory.join(APPLICATION_BACKUP_RELATIVE_PATH);
    let library_backup_path = staging_directory.join(LIBRARY_BACKUP_RELATIVE_PATH);
    fs::create_dir_all(
        application_backup_path
            .parent()
            .ok_or(UpdateRecoveryError::InvalidState)?,
    )?;
    set_private_directory_permissions(
        application_backup_path
            .parent()
            .ok_or(UpdateRecoveryError::InvalidState)?,
    )?;
    copier
        .copy_application(&application_path, &application_backup_path)
        .map_err(|_| UpdateRecoveryError::ApplicationCopy)?;
    let source_application_digest = application_tree_sha256(&application_path)?;
    let backup_application_digest = application_tree_sha256(&application_backup_path)?;
    if source_application_digest != backup_application_digest {
        return Err(UpdateRecoveryError::InvalidApplicationCopy);
    }
    validate_application_bundle(&application_backup_path, preparation.installed_version)?;

    backup_database(&library_path, &library_backup_path)?;
    let source_library_schema_version =
        u32::try_from(SCHEMA_VERSION).map_err(|_| UpdateRecoveryError::InvalidLibraryCopy)?;
    verify_library_file(&library_backup_path, SCHEMA_VERSION)?;
    let library_metadata = fs::metadata(&library_backup_path)?;
    if library_metadata.len() == 0 || library_metadata.len() > MAX_LIBRARY_BACKUP_BYTES {
        return Err(UpdateRecoveryError::InvalidLibraryCopy);
    }
    let library_sha256 = file_sha256(&library_backup_path)?;

    let manifest = UpdateRecoveryManifest {
        format: RECOVERY_FORMAT.to_owned(),
        schema_version: RECOVERY_SCHEMA_VERSION,
        recovery_id: recovery_id.clone(),
        phase: RecoveryPhaseWire::Prepared,
        prepared_at: canonical_utc(preparation.prepared_at)
            .ok_or(UpdateRecoveryError::InvalidInput)?,
        replacement_process: None,
        source: RecoverySource {
            version: preparation.installed_version.to_owned(),
            library_schema_version: source_library_schema_version,
            application_path: path_text(&application_path)?,
            library_path: path_text(&library_path)?,
        },
        target: RecoveryTarget {
            version: preparation.authorization.version.clone(),
            library_schema_version: preparation.authorization.target_library_schema_version,
            trusted_sequence: preparation.authorization.trusted_sequence,
            trusted_payload_sha256: preparation.authorization.trusted_payload_sha256.clone(),
            package_sha256: preparation.authorization.artifact.expected_sha256.clone(),
        },
        application_backup: ApplicationBackup {
            relative_path: APPLICATION_BACKUP_RELATIVE_PATH.to_owned(),
            tree_sha256: backup_application_digest,
        },
        library_backup: LibraryBackup {
            relative_path: LIBRARY_BACKUP_RELATIVE_PATH.to_owned(),
            size_bytes: library_metadata.len(),
            sha256: library_sha256,
        },
    };
    validate_manifest(&manifest)?;
    write_manifest(&staging_directory.join(MANIFEST_FILE_NAME), &manifest)?;
    sync_tree(&staging_directory)?;
    fs::rename(&staging_directory, &attempt_directory)?;
    staging.disarm();
    let mut attempt = StagingDirectory::new(attempt_directory.clone());
    sync_directory(&attempts_directory)?;
    verify_attempt_directory(&attempt_directory, &recovery_id)?;
    if let Err(error) = write_active_recovery_id(&active_path, &recovery_id) {
        if matches!(
            read_active_recovery_id(&active_path),
            Ok(active_recovery_id) if active_recovery_id == recovery_id
        ) {
            attempt.disarm();
        }
        return Err(error);
    }
    attempt.disarm();

    let prepared = PreparedUpdateRecovery {
        recovery_id,
        attempt_directory,
        source_library_schema_version,
    };
    Ok(prepared)
}

pub fn active_update_recovery_phase(
    recovery_root: &Path,
) -> Result<Option<(String, UpdateRecoveryPhase)>, UpdateRecoveryError> {
    if !recovery_root.exists() {
        return Ok(None);
    }
    let recovery_root = recovery_root.canonicalize()?;
    let active_path = recovery_root.join(ACTIVE_FILE_NAME);
    if !active_path.exists() {
        return Ok(None);
    }
    let recovery_id = read_active_recovery_id(&active_path)?;
    let manifest = read_active_manifest(&recovery_root, &recovery_id)?;
    Ok(Some((recovery_id, manifest.phase.into())))
}

pub fn maintain_update_recovery(
    recovery_root: &Path,
    expected_application_path: &Path,
    expected_library_path: &Path,
) -> Result<UpdateRecoveryMaintenance, UpdateRecoveryError> {
    maintain_update_recovery_inner(
        recovery_root,
        expected_application_path,
        expected_library_path,
        None,
    )
}

pub fn maintain_update_recovery_with_watchdog_lease(
    context: &UpdateRecoveryWatchdogContext,
    watchdog_lease: &UpdateRecoveryWatchdogLease,
) -> Result<UpdateRecoveryMaintenance, UpdateRecoveryError> {
    maintain_update_recovery_inner(
        context.recovery_root(),
        context.installed_application_path(),
        context.library_path(),
        Some(watchdog_lease),
    )
}

pub fn load_update_recovery_outcome(
    recovery_root: &Path,
) -> Result<Option<UpdateRecoveryOutcome>, UpdateRecoveryError> {
    if !recovery_root.exists() {
        return Ok(None);
    }
    let recovery_root = recovery_root.canonicalize()?;
    let outcome_lock = open_private_lock_file(&recovery_root, OUTCOME_LOCK_FILE_NAME, true)?;
    let _outcome_lock = RecoveryFileLock::acquire(outcome_lock)?;
    read_update_recovery_outcome(&recovery_root).map_err(Into::into)
}

pub fn acknowledge_update_recovery_outcome(
    recovery_root: &Path,
) -> Result<bool, UpdateRecoveryError> {
    if !recovery_root.exists() {
        return Ok(false);
    }
    let recovery_root = recovery_root.canonicalize()?;
    let outcome_lock = open_private_lock_file(&recovery_root, OUTCOME_LOCK_FILE_NAME, true)?;
    let _outcome_lock = RecoveryFileLock::acquire(outcome_lock)?;
    let Some(outcome) = read_update_recovery_outcome(&recovery_root)? else {
        return Ok(false);
    };
    let receipt_bound_attempt = recovery_root
        .join(ATTEMPTS_DIRECTORY_NAME)
        .join(&outcome.recovery_id);
    if path_entry_exists(&receipt_bound_attempt)? {
        return Err(UpdateRecoveryError::InvalidState);
    }
    remove_update_recovery_outcome(&recovery_root)?;
    Ok(true)
}

fn maintain_update_recovery_inner(
    recovery_root: &Path,
    expected_application_path: &Path,
    expected_library_path: &Path,
    watchdog_lease: Option<&UpdateRecoveryWatchdogLease>,
) -> Result<UpdateRecoveryMaintenance, UpdateRecoveryError> {
    if !recovery_root.exists() {
        return Ok(UpdateRecoveryMaintenance::NoTerminalOutcome);
    }
    let recovery_root = recovery_root.canonicalize()?;
    let outcome_lock = open_private_lock_file(&recovery_root, OUTCOME_LOCK_FILE_NAME, true)?;
    let _outcome_lock = RecoveryFileLock::acquire(outcome_lock)?;
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

    finalize_terminal_attempt(
        &recovery_root,
        &recovery_id,
        active_expected,
        retained_outcome.as_ref(),
        expected_application_path,
        expected_library_path,
        watchdog_lease,
    )
}

#[allow(clippy::too_many_arguments)]
fn finalize_terminal_attempt(
    recovery_root: &Path,
    recovery_id: &str,
    active_expected: bool,
    retained_outcome: Option<&UpdateRecoveryOutcome>,
    expected_application_path: &Path,
    expected_library_path: &Path,
    watchdog_lease: Option<&UpdateRecoveryWatchdogLease>,
) -> Result<UpdateRecoveryMaintenance, UpdateRecoveryError> {
    let (attempts_directory, attempt_directory) =
        canonical_recovery_attempt(recovery_root, recovery_id)?;
    let _watchdog_lock = if let Some(lease) = watchdog_lease {
        if lease.recovery_id != recovery_id {
            return Err(UpdateRecoveryError::InvalidState);
        }
        None
    } else {
        let file = open_private_lock_file(&attempt_directory, WATCHDOG_LOCK_FILE_NAME, false)?;
        if !try_acquire_process_lock(&file)? {
            return Ok(UpdateRecoveryMaintenance::Deferred);
        }
        Some(file)
    };
    let candidate_lock =
        open_private_lock_file(&attempt_directory, CANDIDATE_LOCK_FILE_NAME, false)?;
    if !try_acquire_process_lock(&candidate_lock)? {
        return Ok(UpdateRecoveryMaintenance::Deferred);
    }
    let _state_lock = RecoveryStateLock::acquire_existing(&attempt_directory)?;

    let active_path = recovery_root.join(ACTIVE_FILE_NAME);
    if active_expected {
        if read_active_recovery_id(&active_path)? != recovery_id {
            return Err(UpdateRecoveryError::InvalidState);
        }
    } else if path_entry_exists(&active_path)? {
        return Err(UpdateRecoveryError::InvalidState);
    }

    let manifest = read_manifest(&attempt_directory.join(MANIFEST_FILE_NAME))?;
    validate_manifest(&manifest)?;
    if manifest.recovery_id != recovery_id {
        return Err(UpdateRecoveryError::InvalidState);
    }
    let kind = match manifest.phase {
        RecoveryPhaseWire::Confirmed => UpdateRecoveryOutcomeKind::Updated,
        RecoveryPhaseWire::Recovered => UpdateRecoveryOutcomeKind::Recovered,
        RecoveryPhaseWire::RecoveryFailed
        | RecoveryPhaseWire::Prepared
        | RecoveryPhaseWire::ReplacementStarted
        | RecoveryPhaseWire::ReplacementInstalled
        | RecoveryPhaseWire::Launching
        | RecoveryPhaseWire::Recovering => {
            if active_expected {
                return Ok(UpdateRecoveryMaintenance::NoTerminalOutcome);
            }
            return Err(UpdateRecoveryError::InvalidState);
        }
    };
    let outcome = UpdateRecoveryOutcome {
        recovery_id: recovery_id.to_owned(),
        kind,
        source_version: manifest.source.version.clone(),
        target_version: manifest.target.version.clone(),
    };
    if !active_expected && retained_outcome != Some(&outcome) {
        return Err(UpdateRecoveryError::InvalidState);
    }

    verify_attempt_directory(&attempt_directory, recovery_id)?;
    let restoration = UpdateRecoveryRestoration {
        recovery_root,
        recovery_id,
        expected_application_path,
        expected_library_path,
    };
    validate_restoration_destinations(recovery_root, &manifest, restoration)?;
    match kind {
        UpdateRecoveryOutcomeKind::Updated => {
            validate_application_bundle(expected_application_path, &manifest.target.version)?;
            verify_library_file(
                expected_library_path,
                i64::from(manifest.target.library_schema_version),
            )
            .map_err(|_| UpdateRecoveryError::InvalidLibraryCopy)?;
        }
        UpdateRecoveryOutcomeKind::Recovered => {
            verify_restored_pair(expected_application_path, expected_library_path, &manifest)?;
        }
    }

    if retained_outcome != Some(&outcome) {
        write_update_recovery_outcome(recovery_root, &outcome)?;
    }
    if active_expected {
        fs::remove_file(&active_path)?;
        sync_directory(recovery_root)?;
    }
    if kind == UpdateRecoveryOutcomeKind::Recovered {
        remove_failed_candidate_application(&manifest, recovery_id)?;
    }
    fs::remove_dir_all(&attempt_directory)?;
    sync_directory(&attempts_directory)?;
    Ok(UpdateRecoveryMaintenance::OutcomeRetained(outcome))
}

pub fn transition_active_update_recovery(
    recovery_root: &Path,
    recovery_id: &str,
    next: UpdateRecoveryPhase,
) -> Result<(), UpdateRecoveryError> {
    if !valid_sha256(recovery_id) {
        return Err(UpdateRecoveryError::InvalidInput);
    }
    let recovery_root = recovery_root.canonicalize()?;
    let attempt_directory = recovery_root
        .join(ATTEMPTS_DIRECTORY_NAME)
        .join(recovery_id);
    let _state_lock = RecoveryStateLock::acquire(&attempt_directory)?;
    if read_active_recovery_id(&recovery_root.join(ACTIVE_FILE_NAME))? != recovery_id {
        return Err(UpdateRecoveryError::InvalidState);
    }
    let manifest_path = attempt_directory.join(MANIFEST_FILE_NAME);
    let mut manifest = read_manifest(&manifest_path)?;
    validate_manifest(&manifest)?;
    if next == UpdateRecoveryPhase::Launching {
        return Err(UpdateRecoveryError::InvalidTransition);
    }
    validate_update_recovery_transition(manifest.phase.into(), next)
        .map_err(|_| UpdateRecoveryError::InvalidTransition)?;
    manifest.phase = next.into();
    validate_manifest(&manifest)?;
    write_manifest(&manifest_path, &manifest)
}

pub fn record_active_update_recovery_replacement_launch(
    recovery_root: &Path,
    recovery_id: &str,
    launch: UpdateRecoveryReplacementLaunch<'_>,
) -> Result<UpdateRecoveryReplacementProcess, UpdateRecoveryError> {
    if !valid_sha256(recovery_id) {
        return Err(UpdateRecoveryError::InvalidInput);
    }
    let recovery_root = recovery_root.canonicalize()?;
    let attempt_directory = recovery_root
        .join(ATTEMPTS_DIRECTORY_NAME)
        .join(recovery_id);
    let _state_lock = RecoveryStateLock::acquire(&attempt_directory)?;
    if read_active_recovery_id(&recovery_root.join(ACTIVE_FILE_NAME))? != recovery_id {
        return Err(UpdateRecoveryError::InvalidState);
    }
    let manifest_path = attempt_directory.join(MANIFEST_FILE_NAME);
    let mut manifest = read_manifest(&manifest_path)?;
    validate_manifest(&manifest)?;
    validate_update_recovery_transition(manifest.phase.into(), UpdateRecoveryPhase::Launching)
        .map_err(|_| UpdateRecoveryError::InvalidTransition)?;
    let replacement_process = ReplacementProcess {
        process_id: launch.process_id,
        started_at_unix_seconds: launch.started_at_unix_seconds,
        started_at_microseconds: launch.started_at_microseconds,
        launch_nonce: launch.launch_nonce.to_owned(),
        confirmation_deadline: launch.confirmation_deadline.to_owned(),
    };
    validate_replacement_process(&replacement_process)?;
    manifest.phase = RecoveryPhaseWire::Launching;
    manifest.replacement_process = Some(replacement_process.clone());
    validate_manifest(&manifest)?;
    write_manifest(&manifest_path, &manifest)?;
    Ok(replacement_process.into())
}

pub fn verify_prepared_update_recovery(
    recovery_root: &Path,
    recovery_id: &str,
) -> Result<(), UpdateRecoveryError> {
    if !valid_sha256(recovery_id) {
        return Err(UpdateRecoveryError::InvalidInput);
    }
    let recovery_root = recovery_root.canonicalize()?;
    if read_active_recovery_id(&recovery_root.join(ACTIVE_FILE_NAME))? != recovery_id {
        return Err(UpdateRecoveryError::InvalidState);
    }
    let attempt_directory = recovery_root
        .join(ATTEMPTS_DIRECTORY_NAME)
        .join(recovery_id);
    verify_attempt_directory(&attempt_directory, recovery_id)
}

pub fn discard_prepared_update_recovery(
    recovery_root: &Path,
    recovery_id: &str,
) -> Result<(), UpdateRecoveryError> {
    if !valid_sha256(recovery_id) {
        return Err(UpdateRecoveryError::InvalidInput);
    }
    let recovery_root = recovery_root.canonicalize()?;
    let attempts_directory = recovery_root.join(ATTEMPTS_DIRECTORY_NAME);
    let attempt_directory = attempts_directory.join(recovery_id);
    let watchdog_lock = open_private_lock_file(&attempt_directory, WATCHDOG_LOCK_FILE_NAME, false)?;
    acquire_process_lock(&watchdog_lock)?;
    let candidate_lock =
        open_private_lock_file(&attempt_directory, CANDIDATE_LOCK_FILE_NAME, false)?;
    acquire_candidate_process_lock(&candidate_lock)?;
    let _state_lock = RecoveryStateLock::acquire(&attempt_directory)?;
    let active_path = recovery_root.join(ACTIVE_FILE_NAME);
    if read_active_recovery_id(&active_path)? != recovery_id {
        return Err(UpdateRecoveryError::InvalidState);
    }
    let manifest = read_manifest(&attempt_directory.join(MANIFEST_FILE_NAME))?;
    validate_manifest(&manifest)?;
    if manifest.phase != RecoveryPhaseWire::Prepared || manifest.recovery_id != recovery_id {
        return Err(UpdateRecoveryError::InvalidTransition);
    }
    verify_attempt_directory(&attempt_directory, recovery_id)?;

    fs::remove_file(active_path)?;
    sync_directory(&recovery_root)?;
    fs::remove_dir_all(&attempt_directory)?;
    sync_directory(&attempts_directory)?;
    Ok(())
}

pub fn restore_active_update_recovery(
    copier: &impl ApplicationCopyPort,
    restoration: UpdateRecoveryRestoration<'_>,
) -> Result<(), UpdateRecoveryError> {
    if !valid_sha256(restoration.recovery_id) {
        return Err(UpdateRecoveryError::InvalidInput);
    }
    let recovery_root = restoration.recovery_root.canonicalize()?;
    if read_active_recovery_id(&recovery_root.join(ACTIVE_FILE_NAME))? != restoration.recovery_id {
        return Err(UpdateRecoveryError::InvalidState);
    }
    let attempt_directory = recovery_root
        .join(ATTEMPTS_DIRECTORY_NAME)
        .join(restoration.recovery_id);
    let candidate_lock =
        open_private_lock_file(&attempt_directory, CANDIDATE_LOCK_FILE_NAME, false)?;
    acquire_candidate_process_lock(&candidate_lock)?;
    let manifest = read_manifest(&attempt_directory.join(MANIFEST_FILE_NAME))?;
    validate_manifest(&manifest)?;
    validate_restoration_destinations(&recovery_root, &manifest, restoration)?;
    verify_attempt_directory(&attempt_directory, restoration.recovery_id)?;
    let application_path = PathBuf::from(&manifest.source.application_path);
    let library_path = PathBuf::from(&manifest.source.library_path);

    match manifest.phase {
        RecoveryPhaseWire::Recovering => {}
        RecoveryPhaseWire::Recovered => {
            return verify_restored_pair(&application_path, &library_path, &manifest);
        }
        _ => return Err(UpdateRecoveryError::InvalidTransition),
    }

    restore_application(
        copier,
        &attempt_directory.join(&manifest.application_backup.relative_path),
        &application_path,
        restoration.recovery_id,
        &manifest,
    )?;
    restore_library(
        &attempt_directory.join(&manifest.library_backup.relative_path),
        &library_path,
        &manifest,
    )?;
    verify_restored_pair(&application_path, &library_path, &manifest)?;
    transition_active_update_recovery(
        &recovery_root,
        restoration.recovery_id,
        UpdateRecoveryPhase::Recovered,
    )
}

pub fn resolve_update_recovery_watchdog_context(
    watchdog_executable: &Path,
    expected_installed_application_path: &Path,
) -> Result<UpdateRecoveryWatchdogContext, UpdateRecoveryError> {
    let watchdog_bundle = application_bundle_from_executable(watchdog_executable)?;
    let previous_directory = watchdog_bundle
        .parent()
        .filter(|path| path.file_name().and_then(|name| name.to_str()) == Some("previous"))
        .ok_or(UpdateRecoveryError::InvalidInput)?;
    let attempt_directory = previous_directory
        .parent()
        .ok_or(UpdateRecoveryError::InvalidInput)?;
    let recovery_id = attempt_directory
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|value| valid_sha256(value))
        .ok_or(UpdateRecoveryError::InvalidInput)?;
    let attempts_directory = attempt_directory
        .parent()
        .filter(|path| {
            path.file_name().and_then(|name| name.to_str()) == Some(ATTEMPTS_DIRECTORY_NAME)
        })
        .ok_or(UpdateRecoveryError::InvalidInput)?;
    let recovery_root = attempts_directory
        .parent()
        .ok_or(UpdateRecoveryError::InvalidInput)?
        .to_owned();
    if read_active_recovery_id(&recovery_root.join(ACTIVE_FILE_NAME))? != recovery_id {
        return Err(UpdateRecoveryError::InvalidState);
    }
    let manifest = read_manifest(&attempt_directory.join(MANIFEST_FILE_NAME))?;
    validate_manifest(&manifest)?;
    let library_path = recovery_root
        .parent()
        .ok_or(UpdateRecoveryError::InvalidState)?
        .join("fitfreed.sqlite");
    let restoration = UpdateRecoveryRestoration {
        recovery_root: &recovery_root,
        recovery_id,
        expected_application_path: expected_installed_application_path,
        expected_library_path: &library_path,
    };
    validate_restoration_destinations(&recovery_root, &manifest, restoration)?;
    verify_attempt_directory(attempt_directory, recovery_id)?;
    if watchdog_bundle
        != attempt_directory
            .join(&manifest.application_backup.relative_path)
            .canonicalize()?
    {
        return Err(UpdateRecoveryError::InvalidInput);
    }
    Ok(UpdateRecoveryWatchdogContext {
        recovery_root,
        recovery_id: recovery_id.to_owned(),
        installed_application_path: PathBuf::from(&manifest.source.application_path),
        library_path: PathBuf::from(&manifest.source.library_path),
        target_version: manifest.target.version,
        target_library_schema_version: manifest.target.library_schema_version,
        prepared_at: manifest.prepared_at,
        replacement_process: manifest.replacement_process.map(Into::into),
    })
}

pub fn acquire_update_recovery_watchdog_lease(
    context: &UpdateRecoveryWatchdogContext,
) -> Result<UpdateRecoveryWatchdogLease, UpdateRecoveryError> {
    let attempt_directory = recovery_attempt_directory(context);
    let file = open_private_lock_file(&attempt_directory, WATCHDOG_LOCK_FILE_NAME, false)?;
    acquire_process_lock(&file)?;
    Ok(UpdateRecoveryWatchdogLease {
        file,
        recovery_id: context.recovery_id().to_owned(),
    })
}

fn recovery_attempt_directory(context: &UpdateRecoveryWatchdogContext) -> PathBuf {
    context
        .recovery_root()
        .join(ATTEMPTS_DIRECTORY_NAME)
        .join(context.recovery_id())
}

pub fn acquire_update_recovery_candidate_lease(
    recovery_root: &Path,
    recovery_id: &str,
    launch_nonce: &str,
    running_executable: &Path,
) -> Result<UpdateRecoveryCandidateLease, UpdateRecoveryError> {
    if !valid_sha256(recovery_id) || !valid_sha256(launch_nonce) {
        return Err(UpdateRecoveryError::InvalidInput);
    }
    let recovery_root = recovery_root.canonicalize()?;
    let attempt_directory = recovery_root
        .join(ATTEMPTS_DIRECTORY_NAME)
        .join(recovery_id);
    let file = open_private_lock_file(&attempt_directory, CANDIDATE_LOCK_FILE_NAME, false)?;
    acquire_candidate_process_lock(&file)?;
    let lease = UpdateRecoveryCandidateLease {
        file,
        recovery_id: recovery_id.to_owned(),
        launch_nonce: launch_nonce.to_owned(),
    };
    let _state_lock = RecoveryStateLock::acquire(&attempt_directory)?;
    if read_active_recovery_id(&recovery_root.join(ACTIVE_FILE_NAME))? != recovery_id {
        return Err(UpdateRecoveryError::InvalidState);
    }
    let manifest = read_manifest(&attempt_directory.join(MANIFEST_FILE_NAME))?;
    validate_manifest(&manifest)?;
    let replacement_process = manifest
        .replacement_process
        .as_ref()
        .ok_or(UpdateRecoveryError::InvalidState)?;
    let running_application = application_bundle_from_executable(running_executable)?;
    let identity = observe_update_recovery_process(std::process::id(), running_executable)?;
    if manifest.phase != RecoveryPhaseWire::Launching
        || manifest.recovery_id != recovery_id
        || replacement_process.launch_nonce != launch_nonce
        || replacement_process.process_id != identity.process_id
        || replacement_process.started_at_unix_seconds != identity.started_at_unix_seconds
        || replacement_process.started_at_microseconds != identity.started_at_microseconds
        || running_application != Path::new(&manifest.source.application_path)
    {
        return Err(UpdateRecoveryError::InvalidState);
    }
    validate_application_bundle(&running_application, &manifest.target.version)?;
    Ok(lease)
}

#[cfg(target_os = "macos")]
pub fn observe_update_recovery_process(
    process_id: u32,
    expected_executable: &Path,
) -> Result<UpdateRecoveryProcessIdentity, UpdateRecoveryError> {
    use std::{
        ffi::OsString,
        mem::{size_of, MaybeUninit},
        os::unix::ffi::OsStringExt,
    };

    let process_id = i32::try_from(process_id).map_err(|_| UpdateRecoveryError::InvalidInput)?;
    let mut path_buffer = vec![0_u8; libc::PROC_PIDPATHINFO_MAXSIZE as usize];
    let path_length = unsafe {
        libc::proc_pidpath(
            process_id,
            path_buffer.as_mut_ptr().cast(),
            u32::try_from(path_buffer.len()).map_err(|_| UpdateRecoveryError::InvalidState)?,
        )
    };
    if path_length <= 0 {
        return Err(io::Error::last_os_error().into());
    }
    path_buffer
        .truncate(usize::try_from(path_length).map_err(|_| UpdateRecoveryError::InvalidState)?);
    let observed_path = PathBuf::from(OsString::from_vec(path_buffer)).canonicalize()?;
    if observed_path != expected_executable.canonicalize()? {
        return Err(UpdateRecoveryError::InvalidState);
    }

    let mut information = MaybeUninit::<libc::proc_bsdinfo>::zeroed();
    let information_size = size_of::<libc::proc_bsdinfo>();
    let expected_size =
        i32::try_from(information_size).map_err(|_| UpdateRecoveryError::InvalidState)?;
    let read_size = unsafe {
        libc::proc_pidinfo(
            process_id,
            libc::PROC_PIDTBSDINFO,
            0,
            information.as_mut_ptr().cast(),
            expected_size,
        )
    };
    if read_size != expected_size {
        return Err(io::Error::last_os_error().into());
    }
    let information = unsafe { information.assume_init() };
    Ok(UpdateRecoveryProcessIdentity {
        process_id: u32::try_from(process_id).map_err(|_| UpdateRecoveryError::InvalidState)?,
        started_at_unix_seconds: information.pbi_start_tvsec,
        started_at_microseconds: information.pbi_start_tvusec,
    })
}

#[cfg(target_os = "macos")]
pub fn update_recovery_process_is_running(
    replacement_process: &UpdateRecoveryReplacementProcess,
    expected_executable: &Path,
) -> Result<bool, UpdateRecoveryError> {
    let process_id = i32::try_from(replacement_process.process_id)
        .map_err(|_| UpdateRecoveryError::InvalidState)?;
    if unsafe { libc::kill(process_id, 0) } != 0 {
        let error = io::Error::last_os_error();
        return if error.raw_os_error() == Some(libc::ESRCH) {
            Ok(false)
        } else {
            Err(error.into())
        };
    }
    match observe_update_recovery_process(replacement_process.process_id, expected_executable) {
        Ok(identity) => Ok(identity.process_id == replacement_process.process_id
            && identity.started_at_unix_seconds == replacement_process.started_at_unix_seconds
            && identity.started_at_microseconds == replacement_process.started_at_microseconds),
        Err(UpdateRecoveryError::InvalidState) => Ok(false),
        Err(UpdateRecoveryError::Io(error)) if error.raw_os_error() == Some(libc::ESRCH) => {
            Ok(false)
        }
        Err(error) => Err(error),
    }
}

#[cfg(not(target_os = "macos"))]
pub fn update_recovery_process_is_running(
    _replacement_process: &UpdateRecoveryReplacementProcess,
    _expected_executable: &Path,
) -> Result<bool, UpdateRecoveryError> {
    Err(UpdateRecoveryError::UnsupportedPlatform)
}

#[cfg(not(target_os = "macos"))]
pub fn observe_update_recovery_process(
    _process_id: u32,
    _expected_executable: &Path,
) -> Result<UpdateRecoveryProcessIdentity, UpdateRecoveryError> {
    Err(UpdateRecoveryError::UnsupportedPlatform)
}

pub fn confirm_active_update_recovery(
    recovery_root: &Path,
    recovery_id: &str,
    running_executable: &Path,
    running_version: &str,
    library_path: &Path,
    running_library_schema_version: u32,
    launch_nonce: &str,
) -> Result<(), UpdateRecoveryError> {
    if !valid_sha256(recovery_id) {
        return Err(UpdateRecoveryError::InvalidInput);
    }
    let recovery_root = recovery_root.canonicalize()?;
    if read_active_recovery_id(&recovery_root.join(ACTIVE_FILE_NAME))? != recovery_id {
        return Err(UpdateRecoveryError::InvalidState);
    }
    let attempt_directory = recovery_root
        .join(ATTEMPTS_DIRECTORY_NAME)
        .join(recovery_id);
    let manifest = read_manifest(&attempt_directory.join(MANIFEST_FILE_NAME))?;
    validate_manifest(&manifest)?;
    let replacement_process = manifest
        .replacement_process
        .as_ref()
        .ok_or(UpdateRecoveryError::InvalidState)?;
    verify_attempt_directory(&attempt_directory, recovery_id)?;
    let running_application = application_bundle_from_executable(running_executable)?;
    let library_parent = library_path
        .parent()
        .ok_or(UpdateRecoveryError::InvalidInput)?
        .canonicalize()?;
    let canonical_library_path = library_parent.join("fitfreed.sqlite");
    if !library_path.is_absolute()
        || library_path.file_name().and_then(|name| name.to_str()) != Some("fitfreed.sqlite")
        || running_application != Path::new(&manifest.source.application_path)
        || canonical_library_path != Path::new(&manifest.source.library_path)
        || library_parent
            != recovery_root
                .parent()
                .ok_or(UpdateRecoveryError::InvalidState)?
                .canonicalize()?
        || running_version != manifest.target.version
        || running_library_schema_version != manifest.target.library_schema_version
        || launch_nonce != replacement_process.launch_nonce
    {
        return Err(UpdateRecoveryError::InvalidInput);
    }
    validate_application_bundle(&running_application, &manifest.target.version)?;
    verify_library_file(
        &canonical_library_path,
        i64::from(manifest.target.library_schema_version),
    )
    .map_err(|_| UpdateRecoveryError::InvalidLibraryCopy)?;
    transition_active_update_recovery(&recovery_root, recovery_id, UpdateRecoveryPhase::Confirmed)
}

fn application_bundle_from_executable(executable: &Path) -> Result<PathBuf, UpdateRecoveryError> {
    if executable.file_name().and_then(|name| name.to_str()) != Some(EXPECTED_BUNDLE_EXECUTABLE)
        || !fs::symlink_metadata(executable).is_ok_and(|metadata| metadata.file_type().is_file())
    {
        return Err(UpdateRecoveryError::InvalidInput);
    }
    let executable = executable.canonicalize()?;
    let macos_directory = executable
        .parent()
        .filter(|path| path.file_name().and_then(|name| name.to_str()) == Some("MacOS"))
        .ok_or(UpdateRecoveryError::InvalidInput)?;
    let contents_directory = macos_directory
        .parent()
        .filter(|path| path.file_name().and_then(|name| name.to_str()) == Some("Contents"))
        .ok_or(UpdateRecoveryError::InvalidInput)?;
    let application_path = contents_directory
        .parent()
        .filter(|path| path.file_name().and_then(|name| name.to_str()) == Some("FitFreed.app"))
        .ok_or(UpdateRecoveryError::InvalidInput)?;
    Ok(application_path.to_owned())
}

pub fn resolve_update_application_path(executable: &Path) -> Result<PathBuf, UpdateRecoveryError> {
    application_bundle_from_executable(executable)
}

fn validate_restoration_destinations(
    recovery_root: &Path,
    manifest: &UpdateRecoveryManifest,
    restoration: UpdateRecoveryRestoration<'_>,
) -> Result<(), UpdateRecoveryError> {
    let application_parent = restoration
        .expected_application_path
        .parent()
        .ok_or(UpdateRecoveryError::InvalidInput)?
        .canonicalize()?;
    let library_parent = restoration
        .expected_library_path
        .parent()
        .ok_or(UpdateRecoveryError::InvalidInput)?
        .canonicalize()?;
    let recovery_parent = recovery_root
        .parent()
        .ok_or(UpdateRecoveryError::InvalidState)?
        .canonicalize()?;
    let expected_application_path = application_parent.join("FitFreed.app");
    let expected_library_path = library_parent.join("fitfreed.sqlite");
    if !restoration.expected_application_path.is_absolute()
        || restoration
            .expected_application_path
            .file_name()
            .and_then(|name| name.to_str())
            != Some("FitFreed.app")
        || !restoration.expected_library_path.is_absolute()
        || restoration
            .expected_library_path
            .file_name()
            .and_then(|name| name.to_str())
            != Some("fitfreed.sqlite")
        || library_parent != recovery_parent
        || Path::new(&manifest.source.application_path) != expected_application_path
        || Path::new(&manifest.source.library_path) != expected_library_path
    {
        return Err(UpdateRecoveryError::InvalidInput);
    }
    reject_symbolic_link_destination(&expected_application_path)?;
    reject_symbolic_link_destination(&expected_library_path)?;
    Ok(())
}

fn reject_symbolic_link_destination(path: &Path) -> Result<(), UpdateRecoveryError> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => Err(UpdateRecoveryError::InvalidState),
        Ok(_) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

fn restore_application(
    copier: &impl ApplicationCopyPort,
    backup_path: &Path,
    destination_path: &Path,
    recovery_id: &str,
    manifest: &UpdateRecoveryManifest,
) -> Result<(), UpdateRecoveryError> {
    if verify_restored_application(destination_path, manifest).is_ok() {
        return Ok(());
    }
    let parent = destination_path
        .parent()
        .ok_or(UpdateRecoveryError::InvalidState)?;
    let staging_path = parent.join(format!(
        ".FitFreed.app.fitfreed-recovery-{recovery_id}.staging"
    ));
    let failed_path = parent.join(format!(
        ".FitFreed.app.fitfreed-recovery-{recovery_id}.failed"
    ));
    remove_owned_application_staging(&staging_path)?;
    if let Err(_error) = copier.copy_application(backup_path, &staging_path) {
        let _ = remove_owned_application_staging(&staging_path);
        return Err(UpdateRecoveryError::ApplicationCopy);
    }
    if application_tree_sha256(&staging_path)? != manifest.application_backup.tree_sha256 {
        return Err(UpdateRecoveryError::InvalidApplicationCopy);
    }
    validate_application_bundle(&staging_path, &manifest.source.version)?;
    sync_tree(&staging_path)?;

    if destination_path.exists() {
        if failed_path.exists() {
            return Err(UpdateRecoveryError::InvalidState);
        }
        fs::rename(destination_path, &failed_path)?;
        sync_directory(parent)?;
    }
    fs::rename(&staging_path, destination_path)?;
    sync_directory(parent)?;
    verify_restored_application(destination_path, manifest)
}

fn remove_owned_application_staging(path: &Path) -> Result<(), UpdateRecoveryError> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_dir() => {
            fs::remove_dir_all(path)?;
            Ok(())
        }
        Ok(_) => Err(UpdateRecoveryError::InvalidState),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

fn restore_library(
    backup_path: &Path,
    destination_path: &Path,
    manifest: &UpdateRecoveryManifest,
) -> Result<(), UpdateRecoveryError> {
    let parent = destination_path
        .parent()
        .ok_or(UpdateRecoveryError::InvalidState)?;
    let mut temporary = PrivateStagingFile::new(parent, "fitfreed-library-restoration", ".sqlite")?;
    let copied_bytes = {
        let source = File::open(backup_path)?;
        io::copy(
            &mut source.take(manifest.library_backup.size_bytes + 1),
            temporary.file_mut()?,
        )?
    };
    if copied_bytes != manifest.library_backup.size_bytes {
        return Err(UpdateRecoveryError::InvalidLibraryCopy);
    }
    temporary.sync_and_close()?;
    verify_restored_library(temporary.path(), manifest)?;

    remove_library_sidecar(destination_path, "sqlite-wal")?;
    remove_library_sidecar(destination_path, "sqlite-shm")?;
    temporary.persist_replace(destination_path)?;
    verify_restored_library(destination_path, manifest)
}

fn remove_library_sidecar(library_path: &Path, extension: &str) -> Result<(), UpdateRecoveryError> {
    let sidecar = library_path.with_extension(extension);
    match fs::symlink_metadata(&sidecar) {
        Ok(metadata) if metadata.file_type().is_file() || metadata.file_type().is_symlink() => {
            fs::remove_file(sidecar)?;
            Ok(())
        }
        Ok(_) => Err(UpdateRecoveryError::InvalidState),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

fn verify_restored_pair(
    application_path: &Path,
    library_path: &Path,
    manifest: &UpdateRecoveryManifest,
) -> Result<(), UpdateRecoveryError> {
    verify_restored_application(application_path, manifest)?;
    verify_restored_library(library_path, manifest)
}

fn verify_restored_application(
    path: &Path,
    manifest: &UpdateRecoveryManifest,
) -> Result<(), UpdateRecoveryError> {
    if application_tree_sha256(path)? != manifest.application_backup.tree_sha256 {
        return Err(UpdateRecoveryError::InvalidApplicationCopy);
    }
    validate_application_bundle(path, &manifest.source.version)
}

fn verify_restored_library(
    path: &Path,
    manifest: &UpdateRecoveryManifest,
) -> Result<(), UpdateRecoveryError> {
    let metadata = fs::symlink_metadata(path)?;
    if !metadata.file_type().is_file()
        || metadata.len() != manifest.library_backup.size_bytes
        || file_sha256(path)? != manifest.library_backup.sha256
    {
        return Err(UpdateRecoveryError::InvalidLibraryCopy);
    }
    verify_library_file(path, i64::from(manifest.source.library_schema_version))
        .map_err(|_| UpdateRecoveryError::InvalidLibraryCopy)
}

fn verify_attempt_directory(
    attempt_directory: &Path,
    recovery_id: &str,
) -> Result<(), UpdateRecoveryError> {
    let manifest = read_manifest(&attempt_directory.join(MANIFEST_FILE_NAME))?;
    validate_manifest(&manifest)?;
    if manifest.recovery_id != recovery_id {
        return Err(UpdateRecoveryError::InvalidState);
    }
    if !fs::symlink_metadata(attempt_directory.join(STATE_LOCK_FILE_NAME))
        .is_ok_and(|metadata| metadata.file_type().is_file())
    {
        return Err(UpdateRecoveryError::InvalidState);
    }
    drop(open_private_lock_file(
        attempt_directory,
        CANDIDATE_LOCK_FILE_NAME,
        false,
    )?);
    drop(open_private_lock_file(
        attempt_directory,
        WATCHDOG_LOCK_FILE_NAME,
        false,
    )?);
    let application_path = attempt_directory.join(&manifest.application_backup.relative_path);
    let library_path = attempt_directory.join(&manifest.library_backup.relative_path);
    if application_tree_sha256(&application_path)? != manifest.application_backup.tree_sha256 {
        return Err(UpdateRecoveryError::InvalidApplicationCopy);
    }
    validate_application_bundle(&application_path, &manifest.source.version)?;
    let library_metadata = fs::metadata(&library_path)?;
    if library_metadata.len() != manifest.library_backup.size_bytes
        || file_sha256(&library_path)? != manifest.library_backup.sha256
    {
        return Err(UpdateRecoveryError::InvalidLibraryCopy);
    }
    verify_library_file(
        &library_path,
        i64::from(manifest.source.library_schema_version),
    )
    .map_err(|_| UpdateRecoveryError::InvalidLibraryCopy)
}

fn canonical_recovery_attempt(
    recovery_root: &Path,
    recovery_id: &str,
) -> Result<(PathBuf, PathBuf), UpdateRecoveryError> {
    if !valid_sha256(recovery_id) {
        return Err(UpdateRecoveryError::InvalidInput);
    }
    let attempts_directory = recovery_root.join(ATTEMPTS_DIRECTORY_NAME);
    if !fs::symlink_metadata(&attempts_directory)
        .is_ok_and(|metadata| metadata.file_type().is_dir())
        || attempts_directory.canonicalize()? != attempts_directory
    {
        return Err(UpdateRecoveryError::InvalidState);
    }
    let attempt_directory = attempts_directory.join(recovery_id);
    if !fs::symlink_metadata(&attempt_directory).is_ok_and(|metadata| metadata.file_type().is_dir())
        || attempt_directory.canonicalize()? != attempt_directory
    {
        return Err(UpdateRecoveryError::InvalidState);
    }
    Ok((attempts_directory, attempt_directory))
}

fn remove_failed_candidate_application(
    manifest: &UpdateRecoveryManifest,
    recovery_id: &str,
) -> Result<(), UpdateRecoveryError> {
    let installed_application = Path::new(&manifest.source.application_path);
    let parent = installed_application
        .parent()
        .ok_or(UpdateRecoveryError::InvalidState)?;
    let failed_application = parent.join(format!(
        ".FitFreed.app.fitfreed-recovery-{recovery_id}.failed"
    ));
    match fs::symlink_metadata(&failed_application) {
        Ok(metadata) if metadata.file_type().is_dir() => {
            validate_application_bundle(&failed_application, &manifest.target.version)?;
            fs::remove_dir_all(&failed_application)?;
            sync_directory(parent)?;
            Ok(())
        }
        Ok(_) => Err(UpdateRecoveryError::InvalidState),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

fn path_entry_exists(path: &Path) -> Result<bool, UpdateRecoveryError> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.into()),
    }
}

fn validate_preparation(
    preparation: &UpdateRecoveryPreparation<'_>,
) -> Result<(), UpdateRecoveryError> {
    let installed = Version::parse(preparation.installed_version)
        .map_err(|_| UpdateRecoveryError::InvalidInput)?;
    let target = Version::parse(&preparation.authorization.version)
        .map_err(|_| UpdateRecoveryError::InvalidInput)?;
    if target <= installed
        || preparation.authorization.trusted_sequence == 0
        || !valid_sha256(&preparation.authorization.trusted_payload_sha256)
        || !valid_sha256(&preparation.authorization.artifact.expected_sha256)
        || preparation.authorization.target_library_schema_version
            < u32::try_from(SCHEMA_VERSION).map_err(|_| UpdateRecoveryError::InvalidInput)?
        || canonical_utc(preparation.prepared_at).is_none()
        || !preparation.recovery_root.is_absolute()
        || !preparation.current_application_path.is_absolute()
        || !preparation.library_path.is_absolute()
    {
        return Err(UpdateRecoveryError::InvalidInput);
    }
    Ok(())
}

fn validate_manifest(manifest: &UpdateRecoveryManifest) -> Result<(), UpdateRecoveryError> {
    let source_version =
        Version::parse(&manifest.source.version).map_err(|_| UpdateRecoveryError::InvalidState)?;
    let target_version =
        Version::parse(&manifest.target.version).map_err(|_| UpdateRecoveryError::InvalidState)?;
    let prepared_at = DateTime::parse_from_rfc3339(&manifest.prepared_at)
        .map_err(|_| UpdateRecoveryError::InvalidState)?
        .with_timezone(&Utc);
    if manifest.format != RECOVERY_FORMAT
        || manifest.schema_version != RECOVERY_SCHEMA_VERSION
        || !valid_sha256(&manifest.recovery_id)
        || canonical_utc(&manifest.prepared_at).as_deref() != Some(manifest.prepared_at.as_str())
        || target_version <= source_version
        || manifest.source.library_schema_version == 0
        || manifest.target.library_schema_version < manifest.source.library_schema_version
        || manifest.target.trusted_sequence == 0
        || !valid_sha256(&manifest.target.trusted_payload_sha256)
        || !valid_sha256(&manifest.target.package_sha256)
        || manifest.application_backup.relative_path != APPLICATION_BACKUP_RELATIVE_PATH
        || !valid_sha256(&manifest.application_backup.tree_sha256)
        || manifest.library_backup.relative_path != LIBRARY_BACKUP_RELATIVE_PATH
        || manifest.library_backup.size_bytes == 0
        || manifest.library_backup.size_bytes > MAX_LIBRARY_BACKUP_BYTES
        || !valid_sha256(&manifest.library_backup.sha256)
        || !valid_installed_path(&manifest.source.application_path, "FitFreed.app")
        || !valid_installed_path(&manifest.source.library_path, "fitfreed.sqlite")
    {
        return Err(UpdateRecoveryError::InvalidState);
    }
    if let Some(replacement_process) = &manifest.replacement_process {
        validate_replacement_process(replacement_process)?;
        let confirmation_deadline =
            DateTime::parse_from_rfc3339(&replacement_process.confirmation_deadline)
                .map_err(|_| UpdateRecoveryError::InvalidState)?
                .with_timezone(&Utc);
        if confirmation_deadline <= prepared_at
            || confirmation_deadline > prepared_at + ChronoDuration::minutes(16)
        {
            return Err(UpdateRecoveryError::InvalidState);
        }
    }
    let phase = UpdateRecoveryPhase::from(manifest.phase);
    if matches!(
        phase,
        UpdateRecoveryPhase::Prepared
            | UpdateRecoveryPhase::ReplacementStarted
            | UpdateRecoveryPhase::ReplacementInstalled
    ) && manifest.replacement_process.is_some()
        || matches!(
            phase,
            UpdateRecoveryPhase::Launching | UpdateRecoveryPhase::Confirmed
        ) && manifest.replacement_process.is_none()
    {
        return Err(UpdateRecoveryError::InvalidState);
    }
    Ok(())
}

fn validate_replacement_process(
    replacement_process: &ReplacementProcess,
) -> Result<(), UpdateRecoveryError> {
    if replacement_process.process_id <= 1
        || replacement_process.process_id > i32::MAX as u32
        || replacement_process.started_at_unix_seconds == 0
        || replacement_process.started_at_unix_seconds > 9_007_199_254_740_991
        || replacement_process.started_at_microseconds > 999_999
        || !valid_sha256(&replacement_process.launch_nonce)
        || canonical_utc(&replacement_process.confirmation_deadline).as_deref()
            != Some(replacement_process.confirmation_deadline.as_str())
    {
        return Err(UpdateRecoveryError::InvalidState);
    }
    Ok(())
}

fn valid_installed_path(value: &str, expected_name: &str) -> bool {
    value.len() <= MAX_LOCAL_PATH_BYTES
        && Path::new(value).is_absolute()
        && Path::new(value).file_name().and_then(|name| name.to_str()) == Some(expected_name)
        && Path::new(value)
            .components()
            .all(|component| !matches!(component, Component::ParentDir))
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

fn generate_recovery_id(
    preparation: &UpdateRecoveryPreparation<'_>,
) -> Result<String, UpdateRecoveryError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| UpdateRecoveryError::InvalidState)?;
    let mut digest = Sha256::new();
    digest.update(RECOVERY_FORMAT.as_bytes());
    digest.update(preparation.installed_version.as_bytes());
    digest.update(preparation.authorization.version.as_bytes());
    digest.update(preparation.authorization.trusted_sequence.to_be_bytes());
    digest.update(preparation.authorization.trusted_payload_sha256.as_bytes());
    digest.update(preparation.prepared_at.as_bytes());
    digest.update(std::process::id().to_be_bytes());
    digest.update(now.as_nanos().to_be_bytes());
    Ok(lower_hex(&digest.finalize()))
}

fn validate_application_bundle(
    application_path: &Path,
    expected_version: &str,
) -> Result<(), UpdateRecoveryError> {
    if !fs::symlink_metadata(application_path).is_ok_and(|metadata| metadata.file_type().is_dir()) {
        return Err(UpdateRecoveryError::InvalidApplicationCopy);
    }
    let value = plist::Value::from_file(application_path.join("Contents/Info.plist"))
        .map_err(|_| UpdateRecoveryError::InvalidApplicationCopy)?;
    let dictionary = value
        .as_dictionary()
        .ok_or(UpdateRecoveryError::InvalidApplicationCopy)?;
    let string = |key: &str| dictionary.get(key).and_then(plist::Value::as_string);
    if string("CFBundleIdentifier") != Some(EXPECTED_BUNDLE_IDENTIFIER)
        || string("CFBundleShortVersionString") != Some(expected_version)
        || string("CFBundleExecutable") != Some(EXPECTED_BUNDLE_EXECUTABLE)
    {
        return Err(UpdateRecoveryError::InvalidApplicationCopy);
    }
    let executable = application_path
        .join("Contents/MacOS")
        .join(EXPECTED_BUNDLE_EXECUTABLE);
    let metadata = fs::metadata(executable)?;
    if !metadata.is_file() || !is_executable(&metadata) {
        return Err(UpdateRecoveryError::InvalidApplicationCopy);
    }
    Ok(())
}

#[cfg(unix)]
fn is_executable(metadata: &fs::Metadata) -> bool {
    use std::os::unix::fs::PermissionsExt;

    metadata.permissions().mode() & 0o111 != 0
}

#[cfg(not(unix))]
fn is_executable(_metadata: &fs::Metadata) -> bool {
    true
}

fn application_tree_sha256(root: &Path) -> Result<String, UpdateRecoveryError> {
    let entries = collect_tree_entries(root)?;
    let mut digest = Sha256::new();
    for entry in entries {
        let metadata = fs::symlink_metadata(&entry.absolute_path)?;
        digest.update([entry.kind]);
        digest.update(
            u64::try_from(entry.relative_path.len())
                .map_err(|_| UpdateRecoveryError::InvalidApplicationCopy)?
                .to_be_bytes(),
        );
        digest.update(entry.relative_path.as_bytes());
        digest.update(entry_mode(&metadata, entry.kind).to_be_bytes());
        match entry.kind {
            b'F' => {
                digest.update(metadata.len().to_be_bytes());
                digest.update(file_digest_bytes(&entry.absolute_path, metadata.len())?);
            }
            b'L' => {
                let target = fs::read_link(&entry.absolute_path)?;
                validate_symlink_target(root, &entry.absolute_path, &target)?;
                let target = target
                    .to_str()
                    .ok_or(UpdateRecoveryError::InvalidApplicationCopy)?;
                digest.update(
                    u64::try_from(target.len())
                        .map_err(|_| UpdateRecoveryError::InvalidApplicationCopy)?
                        .to_be_bytes(),
                );
                digest.update(target.as_bytes());
            }
            b'D' => {}
            _ => return Err(UpdateRecoveryError::InvalidApplicationCopy),
        }
    }
    Ok(lower_hex(&digest.finalize()))
}

fn validate_symlink_target(
    root: &Path,
    link_path: &Path,
    target: &Path,
) -> Result<(), UpdateRecoveryError> {
    if target.is_absolute() {
        return Err(UpdateRecoveryError::InvalidApplicationCopy);
    }
    let parent = link_path
        .parent()
        .ok_or(UpdateRecoveryError::InvalidApplicationCopy)?
        .strip_prefix(root)
        .map_err(|_| UpdateRecoveryError::InvalidApplicationCopy)?;
    let mut depth = parent
        .components()
        .filter(|component| matches!(component, Component::Normal(_)))
        .count();
    for component in target.components() {
        match component {
            Component::Normal(_) => depth += 1,
            Component::CurDir => {}
            Component::ParentDir if depth > 0 => depth -= 1,
            _ => return Err(UpdateRecoveryError::InvalidApplicationCopy),
        }
    }
    Ok(())
}

struct TreeEntry {
    relative_path: String,
    absolute_path: PathBuf,
    kind: u8,
}

fn collect_tree_entries(root: &Path) -> Result<Vec<TreeEntry>, UpdateRecoveryError> {
    if !fs::symlink_metadata(root).is_ok_and(|metadata| metadata.file_type().is_dir()) {
        return Err(UpdateRecoveryError::InvalidApplicationCopy);
    }
    let mut entries = Vec::new();
    collect_tree_entries_inner(root, root, &mut entries)?;
    entries.sort_by(|left, right| {
        left.relative_path
            .as_bytes()
            .cmp(right.relative_path.as_bytes())
    });
    Ok(entries)
}

fn collect_tree_entries_inner(
    root: &Path,
    directory: &Path,
    entries: &mut Vec<TreeEntry>,
) -> Result<(), UpdateRecoveryError> {
    for entry in fs::read_dir(directory)? {
        let path = entry?.path();
        let metadata = fs::symlink_metadata(&path)?;
        let file_type = metadata.file_type();
        let kind = if file_type.is_dir() {
            b'D'
        } else if file_type.is_file() {
            b'F'
        } else if file_type.is_symlink() {
            b'L'
        } else {
            return Err(UpdateRecoveryError::InvalidApplicationCopy);
        };
        let relative_path = normalized_relative_path(root, &path)?;
        entries.push(TreeEntry {
            relative_path,
            absolute_path: path.clone(),
            kind,
        });
        if kind == b'D' {
            collect_tree_entries_inner(root, &path, entries)?;
        }
    }
    Ok(())
}

fn normalized_relative_path(root: &Path, path: &Path) -> Result<String, UpdateRecoveryError> {
    let relative = path
        .strip_prefix(root)
        .map_err(|_| UpdateRecoveryError::InvalidApplicationCopy)?;
    let mut parts = Vec::new();
    for component in relative.components() {
        let Component::Normal(part) = component else {
            return Err(UpdateRecoveryError::InvalidApplicationCopy);
        };
        parts.push(
            part.to_str()
                .ok_or(UpdateRecoveryError::InvalidApplicationCopy)?,
        );
    }
    if parts.is_empty() {
        return Err(UpdateRecoveryError::InvalidApplicationCopy);
    }
    Ok(parts.join("/"))
}

#[cfg(unix)]
fn entry_mode(metadata: &fs::Metadata, kind: u8) -> u32 {
    use std::os::unix::fs::PermissionsExt;

    if kind == b'L' {
        0
    } else {
        metadata.permissions().mode() & 0o777
    }
}

#[cfg(not(unix))]
fn entry_mode(_metadata: &fs::Metadata, _kind: u8) -> u32 {
    0
}

fn file_digest_bytes(path: &Path, expected_size: u64) -> Result<[u8; 32], UpdateRecoveryError> {
    let mut file = File::open(path)?;
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    let mut total = 0_u64;
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        total = total
            .checked_add(u64::try_from(read).map_err(|_| UpdateRecoveryError::InvalidState)?)
            .ok_or(UpdateRecoveryError::InvalidState)?;
        digest.update(&buffer[..read]);
    }
    if total != expected_size {
        return Err(UpdateRecoveryError::InvalidApplicationCopy);
    }
    Ok(digest.finalize().into())
}

fn file_sha256(path: &Path) -> Result<String, UpdateRecoveryError> {
    let expected_size = fs::metadata(path)?.len();
    Ok(lower_hex(&file_digest_bytes(path, expected_size)?))
}

fn lower_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn valid_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn path_text(path: &Path) -> Result<String, UpdateRecoveryError> {
    let value = path.to_str().ok_or(UpdateRecoveryError::InvalidInput)?;
    if value.len() > MAX_LOCAL_PATH_BYTES {
        return Err(UpdateRecoveryError::InvalidInput);
    }
    Ok(value.to_owned())
}

fn write_manifest(
    manifest_path: &Path,
    manifest: &UpdateRecoveryManifest,
) -> Result<(), UpdateRecoveryError> {
    let bytes = serde_json::to_vec_pretty(manifest)?;
    if bytes.len() as u64 > MAX_MANIFEST_BYTES {
        return Err(UpdateRecoveryError::InvalidState);
    }
    write_atomic_file(manifest_path, &bytes)
}

fn read_manifest(path: &Path) -> Result<UpdateRecoveryManifest, UpdateRecoveryError> {
    let bytes = read_bounded_file(path, MAX_MANIFEST_BYTES)?;
    Ok(serde_json::from_slice(&bytes)?)
}

fn read_active_manifest(
    recovery_root: &Path,
    recovery_id: &str,
) -> Result<UpdateRecoveryManifest, UpdateRecoveryError> {
    let manifest = read_manifest(
        &recovery_root
            .join(ATTEMPTS_DIRECTORY_NAME)
            .join(recovery_id)
            .join(MANIFEST_FILE_NAME),
    )?;
    validate_manifest(&manifest)?;
    if manifest.recovery_id != recovery_id {
        return Err(UpdateRecoveryError::InvalidState);
    }
    Ok(manifest)
}

fn write_active_recovery_id(path: &Path, recovery_id: &str) -> Result<(), UpdateRecoveryError> {
    if !valid_sha256(recovery_id) {
        return Err(UpdateRecoveryError::InvalidInput);
    }
    let parent = path.parent().ok_or(UpdateRecoveryError::InvalidState)?;
    let mut temporary = PrivateStagingFile::new(parent, "fitfreed-recovery-active", ".tmp")?;
    temporary
        .file_mut()?
        .write_all(format!("{recovery_id}\n").as_bytes())?;
    temporary.sync_and_close()?;
    temporary.persist_noclobber(path).map_err(|error| {
        if error.kind() == io::ErrorKind::AlreadyExists {
            UpdateRecoveryError::ActiveAttemptExists
        } else {
            UpdateRecoveryError::Io(error)
        }
    })
}

fn read_active_recovery_id(path: &Path) -> Result<String, UpdateRecoveryError> {
    let bytes = read_bounded_file(path, 65)?;
    let value = std::str::from_utf8(&bytes).map_err(|_| UpdateRecoveryError::InvalidState)?;
    let Some(recovery_id) = value.strip_suffix('\n') else {
        return Err(UpdateRecoveryError::InvalidState);
    };
    if bytes.len() != 65 || !valid_sha256(recovery_id) {
        return Err(UpdateRecoveryError::InvalidState);
    }
    Ok(recovery_id.to_owned())
}

fn read_bounded_file(path: &Path, maximum_bytes: u64) -> Result<Vec<u8>, UpdateRecoveryError> {
    let metadata = fs::symlink_metadata(path)?;
    if !metadata.file_type().is_file() || metadata.len() == 0 || metadata.len() > maximum_bytes {
        return Err(UpdateRecoveryError::InvalidState);
    }
    let mut bytes = Vec::with_capacity(
        usize::try_from(metadata.len()).map_err(|_| UpdateRecoveryError::InvalidState)?,
    );
    File::open(path)?
        .take(maximum_bytes + 1)
        .read_to_end(&mut bytes)?;
    if bytes.len() as u64 != metadata.len() {
        return Err(UpdateRecoveryError::InvalidState);
    }
    Ok(bytes)
}

fn write_atomic_file(path: &Path, bytes: &[u8]) -> Result<(), UpdateRecoveryError> {
    let parent = path.parent().ok_or(UpdateRecoveryError::InvalidState)?;
    let mut temporary = PrivateStagingFile::new(parent, "fitfreed-recovery-state", ".tmp")?;
    temporary.file_mut()?.write_all(bytes)?;
    temporary.sync_and_close()?;
    temporary.persist_replace(path)?;
    Ok(())
}

fn sync_tree(root: &Path) -> Result<(), UpdateRecoveryError> {
    let entries = collect_tree_entries(root)?;
    for entry in &entries {
        if entry.kind == b'F' {
            File::open(&entry.absolute_path)?.sync_all()?;
        }
    }
    let mut directories = entries
        .iter()
        .filter(|entry| entry.kind == b'D')
        .map(|entry| entry.absolute_path.clone())
        .collect::<Vec<_>>();
    directories.sort_by_key(|path| std::cmp::Reverse(path.components().count()));
    for directory in directories {
        sync_directory(&directory)?;
    }
    sync_directory(root)?;
    Ok(())
}

#[cfg(unix)]
fn set_private_directory_permissions(path: &Path) -> Result<(), UpdateRecoveryError> {
    use std::os::unix::fs::PermissionsExt;

    fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
    Ok(())
}

#[cfg(not(unix))]
fn set_private_directory_permissions(_path: &Path) -> Result<(), UpdateRecoveryError> {
    Ok(())
}

struct StagingDirectory {
    path: PathBuf,
    armed: bool,
}

struct RecoveryStateLock {
    file: File,
}

struct RecoveryFileLock {
    file: File,
}

#[cfg(unix)]
fn open_private_lock_file(
    attempt_directory: &Path,
    file_name: &str,
    create: bool,
) -> Result<File, UpdateRecoveryError> {
    use std::os::unix::fs::{MetadataExt, OpenOptionsExt, PermissionsExt};

    let file = OpenOptions::new()
        .read(true)
        .write(true)
        .create(create)
        .mode(0o600)
        .custom_flags(libc::O_NOFOLLOW)
        .open(attempt_directory.join(file_name))?;
    let metadata = file.metadata()?;
    if !metadata.file_type().is_file()
        || metadata.len() != 0
        || metadata.nlink() != 1
        || metadata.uid() != unsafe { libc::geteuid() }
        || metadata.permissions().mode() & 0o077 != 0
    {
        return Err(UpdateRecoveryError::InvalidState);
    }
    Ok(file)
}

#[cfg(not(unix))]
fn open_private_lock_file(
    _attempt_directory: &Path,
    _file_name: &str,
    _create: bool,
) -> Result<File, UpdateRecoveryError> {
    Err(UpdateRecoveryError::UnsupportedPlatform)
}

#[cfg(unix)]
fn acquire_candidate_process_lock(file: &File) -> Result<(), UpdateRecoveryError> {
    if !try_acquire_process_lock(file)? {
        return Err(UpdateRecoveryError::InvalidState);
    }
    Ok(())
}

#[cfg(unix)]
fn acquire_process_lock(file: &File) -> Result<(), UpdateRecoveryError> {
    if !try_acquire_process_lock(file)? {
        return Err(UpdateRecoveryError::ActiveAttemptExists);
    }
    Ok(())
}

#[cfg(unix)]
fn try_acquire_process_lock(file: &File) -> Result<bool, UpdateRecoveryError> {
    use std::os::fd::AsRawFd;

    if unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } == 0 {
        return Ok(true);
    }
    let error = io::Error::last_os_error();
    if error.kind() == io::ErrorKind::WouldBlock {
        Ok(false)
    } else {
        Err(error.into())
    }
}

#[cfg(unix)]
fn acquire_blocking_process_lock(file: &File) -> Result<(), UpdateRecoveryError> {
    use std::os::fd::AsRawFd;

    loop {
        if unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX) } == 0 {
            return Ok(());
        }
        let error = io::Error::last_os_error();
        if error.kind() != io::ErrorKind::Interrupted {
            return Err(error.into());
        }
    }
}

#[cfg(not(unix))]
fn acquire_candidate_process_lock(_file: &File) -> Result<(), UpdateRecoveryError> {
    Err(UpdateRecoveryError::UnsupportedPlatform)
}

#[cfg(not(unix))]
fn acquire_process_lock(_file: &File) -> Result<(), UpdateRecoveryError> {
    Err(UpdateRecoveryError::UnsupportedPlatform)
}

#[cfg(not(unix))]
fn try_acquire_process_lock(_file: &File) -> Result<bool, UpdateRecoveryError> {
    Err(UpdateRecoveryError::UnsupportedPlatform)
}

#[cfg(not(unix))]
fn acquire_blocking_process_lock(_file: &File) -> Result<(), UpdateRecoveryError> {
    Err(UpdateRecoveryError::UnsupportedPlatform)
}

impl RecoveryStateLock {
    #[cfg(unix)]
    fn acquire(attempt_directory: &Path) -> Result<Self, UpdateRecoveryError> {
        use std::os::unix::fs::OpenOptionsExt;

        let file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .mode(0o600)
            .custom_flags(libc::O_NOFOLLOW)
            .open(attempt_directory.join(STATE_LOCK_FILE_NAME))?;
        if !file.metadata()?.file_type().is_file() {
            return Err(UpdateRecoveryError::InvalidState);
        }
        acquire_blocking_process_lock(&file)?;
        Ok(Self { file })
    }

    #[cfg(unix)]
    fn acquire_existing(attempt_directory: &Path) -> Result<Self, UpdateRecoveryError> {
        let file = open_private_lock_file(attempt_directory, STATE_LOCK_FILE_NAME, false)?;
        acquire_blocking_process_lock(&file)?;
        Ok(Self { file })
    }

    #[cfg(not(unix))]
    fn acquire(_attempt_directory: &Path) -> Result<Self, UpdateRecoveryError> {
        Err(UpdateRecoveryError::UnsupportedPlatform)
    }

    #[cfg(not(unix))]
    fn acquire_existing(_attempt_directory: &Path) -> Result<Self, UpdateRecoveryError> {
        Err(UpdateRecoveryError::UnsupportedPlatform)
    }
}

impl RecoveryFileLock {
    fn acquire(file: File) -> Result<Self, UpdateRecoveryError> {
        acquire_blocking_process_lock(&file)?;
        Ok(Self { file })
    }
}

#[cfg(unix)]
impl Drop for RecoveryStateLock {
    fn drop(&mut self) {
        use std::os::fd::AsRawFd;

        unsafe {
            libc::flock(self.file.as_raw_fd(), libc::LOCK_UN);
        }
    }
}

#[cfg(unix)]
impl Drop for RecoveryFileLock {
    fn drop(&mut self) {
        use std::os::fd::AsRawFd;

        unsafe {
            libc::flock(self.file.as_raw_fd(), libc::LOCK_UN);
        }
    }
}

#[cfg(unix)]
impl Drop for UpdateRecoveryCandidateLease {
    fn drop(&mut self) {
        use std::os::fd::AsRawFd;

        unsafe {
            libc::flock(self.file.as_raw_fd(), libc::LOCK_UN);
        }
    }
}

#[cfg(unix)]
impl Drop for UpdateRecoveryWatchdogLease {
    fn drop(&mut self) {
        use std::os::fd::AsRawFd;

        unsafe {
            libc::flock(self.file.as_raw_fd(), libc::LOCK_UN);
        }
    }
}

#[cfg(not(unix))]
impl Drop for UpdateRecoveryCandidateLease {
    fn drop(&mut self) {}
}

#[cfg(not(unix))]
impl Drop for UpdateRecoveryWatchdogLease {
    fn drop(&mut self) {}
}

#[cfg(not(unix))]
impl Drop for RecoveryStateLock {
    fn drop(&mut self) {}
}

#[cfg(not(unix))]
impl Drop for RecoveryFileLock {
    fn drop(&mut self) {}
}

impl StagingDirectory {
    fn new(path: PathBuf) -> Self {
        Self { path, armed: true }
    }

    fn disarm(&mut self) {
        self.armed = false;
    }
}

impl Drop for StagingDirectory {
    fn drop(&mut self) {
        if self.armed {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}

#[cfg(test)]
mod tests {
    use fitfreed_application::UpdateArtifact;
    use plist::{Dictionary, Value};
    use rusqlite::Connection;
    use tempfile::TempDir;

    use super::*;
    use crate::infrastructure::update_recovery_outcome::OUTCOME_FILE_NAME;

    struct SyntheticApplicationCopier;

    impl ApplicationCopyPort for SyntheticApplicationCopier {
        fn copy_application(&self, source: &Path, destination: &Path) -> Result<(), String> {
            copy_test_tree(source, destination).map_err(|error| error.to_string())
        }
    }

    struct FailingApplicationCopier;

    impl ApplicationCopyPort for FailingApplicationCopier {
        fn copy_application(&self, _source: &Path, _destination: &Path) -> Result<(), String> {
            Err("synthetic copy interruption".to_owned())
        }
    }

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
            connection
                .execute(
                    "INSERT INTO application_preference (id, locale, updated_at_utc)
                     VALUES (1, 'es-ES', '2026-08-17T08:00:00Z')",
                    [],
                )
                .expect("synthetic persisted locale");
            drop(connection);
            Self {
                _directory: directory,
                application_path,
                library_path,
                recovery_root,
            }
        }

        fn authorization(&self) -> UpdateInstallationAuthorization {
            UpdateInstallationAuthorization {
                version: "0.2.0".to_owned(),
                trusted_sequence: 17,
                trusted_payload_sha256:
                    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".to_owned(),
                signing_key_id: "synthetic-test-key".to_owned(),
                target_library_schema_version: u32::try_from(SCHEMA_VERSION)
                    .expect("schema version"),
                artifact: UpdateArtifact {
                    target: "darwin-aarch64".to_owned(),
                    package_url: "https://updates.invalid/fitfreed-0.2.0.app.tar.gz".to_owned(),
                    expected_size_bytes: 1024,
                    expected_sha256:
                        "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
                            .to_owned(),
                    package_signature: "synthetic-package-signature".to_owned(),
                },
                predecessor_artifact: None,
            }
        }

        fn preparation<'a>(
            &'a self,
            authorization: &'a UpdateInstallationAuthorization,
        ) -> UpdateRecoveryPreparation<'a> {
            UpdateRecoveryPreparation {
                recovery_root: &self.recovery_root,
                current_application_path: &self.application_path,
                library_path: &self.library_path,
                installed_version: "0.1.0",
                prepared_at: "2026-08-17T08:00:00Z",
                authorization,
            }
        }
    }

    fn synthetic_replacement_launch() -> UpdateRecoveryReplacementLaunch<'static> {
        UpdateRecoveryReplacementLaunch {
            process_id: 42,
            started_at_unix_seconds: 1_787_000_000,
            started_at_microseconds: 123_456,
            launch_nonce: "456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123",
            confirmation_deadline: "2026-08-17T08:01:00Z",
        }
    }

    #[test]
    fn prepares_and_reopens_an_exact_application_and_library_pair() {
        let harness = Harness::new();
        let authorization = harness.authorization();

        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");

        assert!(valid_sha256(prepared.recovery_id()));
        assert_eq!(
            prepared.source_library_schema_version(),
            u32::try_from(SCHEMA_VERSION).expect("schema version")
        );
        assert!(prepared.attempt_directory().is_dir());
        drop(
            open_private_lock_file(
                prepared.attempt_directory(),
                CANDIDATE_LOCK_FILE_NAME,
                false,
            )
            .expect("private candidate lock"),
        );
        drop(
            open_private_lock_file(prepared.attempt_directory(), WATCHDOG_LOCK_FILE_NAME, false)
                .expect("private watchdog lock"),
        );
        assert_eq!(
            active_update_recovery_phase(&harness.recovery_root).expect("active recovery"),
            Some((
                prepared.recovery_id().to_owned(),
                UpdateRecoveryPhase::Prepared
            ))
        );
        verify_prepared_update_recovery(&harness.recovery_root, prepared.recovery_id())
            .expect("verified recovery assets");

        let backup_library = prepared
            .attempt_directory()
            .join(LIBRARY_BACKUP_RELATIVE_PATH);
        let locale = Connection::open(backup_library)
            .expect("backup library")
            .query_row(
                "SELECT locale FROM application_preference WHERE id = 1",
                [],
                |row| row.get::<_, String>(0),
            )
            .expect("preserved locale");
        assert_eq!(locale, "es-ES");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn prepares_the_pair_with_the_real_macos_application_copier() {
        let harness = Harness::new();
        let authorization = harness.authorization();

        let prepared = prepare_update_recovery(
            &PlatformApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared macOS update recovery");

        verify_prepared_update_recovery(&harness.recovery_root, prepared.recovery_id())
            .expect("verified macOS recovery assets");
    }

    #[test]
    fn persists_only_legal_recovery_transitions() {
        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");

        assert!(matches!(
            transition_active_update_recovery(
                &harness.recovery_root,
                prepared.recovery_id(),
                UpdateRecoveryPhase::Confirmed,
            ),
            Err(UpdateRecoveryError::InvalidTransition)
        ));
        assert_eq!(
            active_update_recovery_phase(&harness.recovery_root).expect("unchanged recovery"),
            Some((
                prepared.recovery_id().to_owned(),
                UpdateRecoveryPhase::Prepared
            ))
        );

        for phase in [
            UpdateRecoveryPhase::ReplacementStarted,
            UpdateRecoveryPhase::ReplacementInstalled,
        ] {
            transition_active_update_recovery(
                &harness.recovery_root,
                prepared.recovery_id(),
                phase,
            )
            .expect("valid recovery transition");
        }
        assert!(matches!(
            transition_active_update_recovery(
                &harness.recovery_root,
                prepared.recovery_id(),
                UpdateRecoveryPhase::Launching,
            ),
            Err(UpdateRecoveryError::InvalidTransition)
        ));
        record_active_update_recovery_replacement_launch(
            &harness.recovery_root,
            prepared.recovery_id(),
            synthetic_replacement_launch(),
        )
        .expect("recorded replacement launch");
        transition_active_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            UpdateRecoveryPhase::Confirmed,
        )
        .expect("confirmed recovery transition");
        assert_eq!(
            active_update_recovery_phase(&harness.recovery_root).expect("confirmed recovery"),
            Some((
                prepared.recovery_id().to_owned(),
                UpdateRecoveryPhase::Confirmed
            ))
        );
    }

    #[test]
    fn discards_only_a_quiescent_prepared_attempt() {
        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");
        let attempt_directory = prepared.attempt_directory().to_owned();

        discard_prepared_update_recovery(&harness.recovery_root, prepared.recovery_id())
            .expect("discarded prepared recovery");

        assert!(!attempt_directory.exists());
        assert_eq!(
            active_update_recovery_phase(&harness.recovery_root).expect("no active recovery"),
            None
        );
        prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("subsequent recovery preparation");
    }

    #[test]
    fn refuses_to_discard_after_replacement_has_started() {
        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");
        transition_active_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            UpdateRecoveryPhase::ReplacementStarted,
        )
        .expect("replacement started");

        assert!(matches!(
            discard_prepared_update_recovery(&harness.recovery_root, prepared.recovery_id()),
            Err(UpdateRecoveryError::InvalidTransition)
        ));
        assert!(prepared.attempt_directory().exists());
        assert_eq!(
            active_update_recovery_phase(&harness.recovery_root).expect("active recovery"),
            Some((
                prepared.recovery_id().to_owned(),
                UpdateRecoveryPhase::ReplacementStarted
            ))
        );
    }

    #[cfg(unix)]
    #[test]
    fn serializes_recovery_state_writers_with_a_private_attempt_lock() {
        use std::{sync::mpsc, thread, time::Duration};

        let directory = tempfile::tempdir().expect("temporary directory");
        let first = RecoveryStateLock::acquire(directory.path()).expect("first state lock");
        let attempt_directory = directory.path().to_owned();
        let (sender, receiver) = mpsc::channel();
        let contender = thread::spawn(move || {
            let second = RecoveryStateLock::acquire(&attempt_directory);
            sender.send(second.is_ok()).expect("lock result");
        });

        assert!(receiver.recv_timeout(Duration::from_millis(50)).is_err());
        drop(first);
        assert!(receiver
            .recv_timeout(Duration::from_secs(1))
            .expect("serialized lock result"));
        contender.join().expect("lock contender");
    }

    #[cfg(unix)]
    #[test]
    fn refuses_restoration_while_the_candidate_process_lease_is_held() {
        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");
        enter_recovering(&harness, prepared.recovery_id());
        let candidate_lock = open_private_lock_file(
            prepared.attempt_directory(),
            CANDIDATE_LOCK_FILE_NAME,
            false,
        )
        .expect("candidate lock");
        acquire_candidate_process_lock(&candidate_lock).expect("candidate process lease");

        assert!(matches!(
            restore_active_update_recovery(
                &SyntheticApplicationCopier,
                UpdateRecoveryRestoration {
                    recovery_root: &harness.recovery_root,
                    recovery_id: prepared.recovery_id(),
                    expected_application_path: &harness.application_path,
                    expected_library_path: &harness.library_path,
                },
            ),
            Err(UpdateRecoveryError::InvalidState)
        ));
        validate_application_bundle(&harness.application_path, "0.1.0")
            .expect("untouched installed application");
        assert_eq!(
            active_update_recovery_phase(&harness.recovery_root).expect("retriable recovery"),
            Some((
                prepared.recovery_id().to_owned(),
                UpdateRecoveryPhase::Recovering
            ))
        );
    }

    #[cfg(unix)]
    #[test]
    fn permits_only_one_watchdog_and_reports_the_candidate_lease() {
        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");
        let watchdog_executable = prepared
            .attempt_directory()
            .join("previous/FitFreed.app/Contents/MacOS/fitfreed");
        let context = resolve_update_recovery_watchdog_context(
            &watchdog_executable,
            &harness.application_path,
        )
        .expect("watchdog context");
        let watchdog_lease =
            acquire_update_recovery_watchdog_lease(&context).expect("watchdog lease");

        assert!(matches!(
            acquire_update_recovery_watchdog_lease(&context),
            Err(UpdateRecoveryError::ActiveAttemptExists)
        ));
        let candidate_lock = open_private_lock_file(
            prepared.attempt_directory(),
            CANDIDATE_LOCK_FILE_NAME,
            false,
        )
        .expect("candidate lock");
        acquire_candidate_process_lock(&candidate_lock).expect("candidate lease");
        let contender = open_private_lock_file(
            prepared.attempt_directory(),
            CANDIDATE_LOCK_FILE_NAME,
            false,
        )
        .expect("candidate lock contender");
        assert!(!try_acquire_process_lock(&contender).expect("candidate lease held"));

        drop(candidate_lock);
        drop(watchdog_lease);
        acquire_update_recovery_watchdog_lease(&context).expect("released watchdog lease");
    }

    #[cfg(unix)]
    #[test]
    fn rejects_a_symbolic_link_as_the_recovery_state_lock() {
        use std::os::unix::fs::symlink;

        let directory = tempfile::tempdir().expect("temporary directory");
        let outside = directory.path().join("outside");
        fs::write(&outside, "outside state").expect("outside state");
        symlink(&outside, directory.path().join(STATE_LOCK_FILE_NAME))
            .expect("symbolic state lock");

        assert!(matches!(
            RecoveryStateLock::acquire(directory.path()),
            Err(UpdateRecoveryError::Io(_))
        ));
        assert_eq!(
            fs::read_to_string(outside).expect("unchanged outside state"),
            "outside state"
        );
    }

    #[test]
    fn restores_the_previous_pair_idempotently_after_candidate_failure() {
        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");
        enter_recovering(&harness, prepared.recovery_id());

        fs::remove_dir_all(&harness.application_path).expect("removed previous application");
        create_synthetic_application(&harness.application_path, "0.2.0");
        let candidate_library = Connection::open(&harness.library_path).expect("candidate library");
        candidate_library
            .execute(
                "UPDATE application_preference SET locale = 'en-US' WHERE id = 1",
                [],
            )
            .expect("candidate locale");
        drop(candidate_library);
        fs::write(
            harness.library_path.with_extension("sqlite-wal"),
            "stale wal",
        )
        .expect("candidate WAL");
        fs::write(
            harness.library_path.with_extension("sqlite-shm"),
            "stale shm",
        )
        .expect("candidate SHM");

        let restoration = UpdateRecoveryRestoration {
            recovery_root: &harness.recovery_root,
            recovery_id: prepared.recovery_id(),
            expected_application_path: &harness.application_path,
            expected_library_path: &harness.library_path,
        };
        restore_active_update_recovery(&SyntheticApplicationCopier, restoration)
            .expect("restored previous pair");
        restore_active_update_recovery(&SyntheticApplicationCopier, restoration)
            .expect("idempotent restored pair");

        validate_application_bundle(&harness.application_path, "0.1.0")
            .expect("restored application");
        assert_eq!(
            Connection::open(&harness.library_path)
                .expect("restored library")
                .query_row(
                    "SELECT locale FROM application_preference WHERE id = 1",
                    [],
                    |row| row.get::<_, String>(0),
                )
                .expect("restored locale"),
            "es-ES"
        );
        assert!(!harness.library_path.with_extension("sqlite-wal").exists());
        assert!(!harness.library_path.with_extension("sqlite-shm").exists());
        assert_eq!(
            active_update_recovery_phase(&harness.recovery_root).expect("recovery outcome"),
            Some((
                prepared.recovery_id().to_owned(),
                UpdateRecoveryPhase::Recovered
            ))
        );
    }

    #[test]
    fn rejects_tampered_recovery_assets_before_mutating_candidate_destinations() {
        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");
        enter_recovering(&harness, prepared.recovery_id());
        fs::write(
            prepared
                .attempt_directory()
                .join("previous/FitFreed.app/Contents/Resources/preserved.txt"),
            "tampered recovery application",
        )
        .expect("tampered application backup");
        fs::remove_dir_all(&harness.application_path).expect("removed previous application");
        create_synthetic_application(&harness.application_path, "0.2.0");

        assert!(matches!(
            restore_active_update_recovery(
                &SyntheticApplicationCopier,
                UpdateRecoveryRestoration {
                    recovery_root: &harness.recovery_root,
                    recovery_id: prepared.recovery_id(),
                    expected_application_path: &harness.application_path,
                    expected_library_path: &harness.library_path,
                },
            ),
            Err(UpdateRecoveryError::InvalidApplicationCopy)
        ));

        validate_application_bundle(&harness.application_path, "0.2.0")
            .expect("untouched candidate application");
        assert_eq!(
            active_update_recovery_phase(&harness.recovery_root).expect("retriable recovery"),
            Some((
                prepared.recovery_id().to_owned(),
                UpdateRecoveryPhase::Recovering
            ))
        );
    }

    #[test]
    fn resumes_restoration_after_the_candidate_application_was_quarantined() {
        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");
        enter_recovering(&harness, prepared.recovery_id());
        let manifest = read_manifest(&prepared.attempt_directory().join(MANIFEST_FILE_NAME))
            .expect("recovery manifest");
        let installed_application = PathBuf::from(&manifest.source.application_path);
        let application_parent = installed_application.parent().expect("application parent");
        let failed_application = application_parent.join(format!(
            ".FitFreed.app.fitfreed-recovery-{}.failed",
            prepared.recovery_id()
        ));
        fs::remove_dir_all(&installed_application).expect("removed previous application");
        create_synthetic_application(&installed_application, "0.2.0");
        fs::rename(&installed_application, &failed_application)
            .expect("interrupted candidate quarantine");

        restore_active_update_recovery(
            &SyntheticApplicationCopier,
            UpdateRecoveryRestoration {
                recovery_root: &harness.recovery_root,
                recovery_id: prepared.recovery_id(),
                expected_application_path: &harness.application_path,
                expected_library_path: &harness.library_path,
            },
        )
        .expect("resumed restoration");

        validate_application_bundle(&installed_application, "0.1.0").expect("restored application");
        validate_application_bundle(&failed_application, "0.2.0")
            .expect("retained failed candidate");
        assert_eq!(
            active_update_recovery_phase(&harness.recovery_root).expect("recovery outcome"),
            Some((
                prepared.recovery_id().to_owned(),
                UpdateRecoveryPhase::Recovered
            ))
        );
    }

    #[test]
    fn retains_a_confirmed_outcome_before_removing_only_its_recovery_assets() {
        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");
        let recovery_id = prepared.recovery_id().to_owned();
        let attempt_directory = prepared.attempt_directory().to_owned();
        enter_launching(&harness, &recovery_id);
        fs::remove_dir_all(&harness.application_path).expect("removed source application");
        create_synthetic_application(&harness.application_path, "0.2.0");
        transition_active_update_recovery(
            &harness.recovery_root,
            &recovery_id,
            UpdateRecoveryPhase::Confirmed,
        )
        .expect("confirmed update");
        let unrelated_orphan = harness
            .recovery_root
            .join(ATTEMPTS_DIRECTORY_NAME)
            .join("f".repeat(64));
        fs::create_dir(&unrelated_orphan).expect("unrelated orphan");

        let maintenance = maintain_update_recovery(
            &harness.recovery_root,
            &harness.application_path,
            &harness.library_path,
        )
        .expect("terminal maintenance");

        let expected = UpdateRecoveryOutcome {
            recovery_id,
            kind: UpdateRecoveryOutcomeKind::Updated,
            source_version: "0.1.0".to_owned(),
            target_version: "0.2.0".to_owned(),
        };
        assert_eq!(
            maintenance,
            UpdateRecoveryMaintenance::OutcomeRetained(expected.clone())
        );
        assert_eq!(
            load_update_recovery_outcome(&harness.recovery_root).expect("retained outcome"),
            Some(expected)
        );
        assert!(!harness.recovery_root.join(ACTIVE_FILE_NAME).exists());
        assert!(!attempt_directory.exists());
        assert!(unrelated_orphan.exists());
        validate_application_bundle(&harness.application_path, "0.2.0")
            .expect("retained updated application");
        verify_library_file(&harness.library_path, SCHEMA_VERSION)
            .expect("retained updated library");
    }

    #[test]
    fn removes_the_verified_failed_candidate_after_retaining_a_recovered_outcome() {
        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");
        let recovery_id = prepared.recovery_id().to_owned();
        let attempt_directory = prepared.attempt_directory().to_owned();
        enter_recovering(&harness, &recovery_id);
        fs::remove_dir_all(&harness.application_path).expect("removed source application");
        create_synthetic_application(&harness.application_path, "0.2.0");
        restore_active_update_recovery(
            &SyntheticApplicationCopier,
            UpdateRecoveryRestoration {
                recovery_root: &harness.recovery_root,
                recovery_id: &recovery_id,
                expected_application_path: &harness.application_path,
                expected_library_path: &harness.library_path,
            },
        )
        .expect("recovered source pair");
        let failed_application = harness
            .application_path
            .parent()
            .expect("application parent")
            .join(format!(
                ".FitFreed.app.fitfreed-recovery-{recovery_id}.failed"
            ));
        assert!(failed_application.exists());

        let maintenance = maintain_update_recovery(
            &harness.recovery_root,
            &harness.application_path,
            &harness.library_path,
        )
        .expect("terminal maintenance");

        assert_eq!(
            maintenance,
            UpdateRecoveryMaintenance::OutcomeRetained(UpdateRecoveryOutcome {
                recovery_id,
                kind: UpdateRecoveryOutcomeKind::Recovered,
                source_version: "0.1.0".to_owned(),
                target_version: "0.2.0".to_owned(),
            })
        );
        assert!(!failed_application.exists());
        assert!(!attempt_directory.exists());
        validate_application_bundle(&harness.application_path, "0.1.0")
            .expect("retained recovered application");
    }

    #[cfg(unix)]
    #[test]
    fn defers_terminal_cleanup_while_a_candidate_lease_is_held() {
        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");
        enter_launching(&harness, prepared.recovery_id());
        fs::remove_dir_all(&harness.application_path).expect("removed source application");
        create_synthetic_application(&harness.application_path, "0.2.0");
        transition_active_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            UpdateRecoveryPhase::Confirmed,
        )
        .expect("confirmed update");
        let candidate_lock = open_private_lock_file(
            prepared.attempt_directory(),
            CANDIDATE_LOCK_FILE_NAME,
            false,
        )
        .expect("candidate lock");
        acquire_candidate_process_lock(&candidate_lock).expect("candidate lease");

        assert_eq!(
            maintain_update_recovery(
                &harness.recovery_root,
                &harness.application_path,
                &harness.library_path,
            )
            .expect("deferred maintenance"),
            UpdateRecoveryMaintenance::Deferred
        );
        assert!(prepared.attempt_directory().exists());
        assert!(harness.recovery_root.join(ACTIVE_FILE_NAME).exists());
        assert_eq!(
            load_update_recovery_outcome(&harness.recovery_root).expect("no premature outcome"),
            None
        );
    }

    #[test]
    fn resumes_receipt_bound_cleanup_after_the_active_pointer_was_removed() {
        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");
        let recovery_id = prepared.recovery_id().to_owned();
        let attempt_directory = prepared.attempt_directory().to_owned();
        enter_launching(&harness, &recovery_id);
        fs::remove_dir_all(&harness.application_path).expect("removed source application");
        create_synthetic_application(&harness.application_path, "0.2.0");
        transition_active_update_recovery(
            &harness.recovery_root,
            &recovery_id,
            UpdateRecoveryPhase::Confirmed,
        )
        .expect("confirmed update");
        let expected = UpdateRecoveryOutcome {
            recovery_id,
            kind: UpdateRecoveryOutcomeKind::Updated,
            source_version: "0.1.0".to_owned(),
            target_version: "0.2.0".to_owned(),
        };
        write_update_recovery_outcome(&harness.recovery_root, &expected)
            .expect("durable terminal receipt");
        fs::remove_file(harness.recovery_root.join(ACTIVE_FILE_NAME))
            .expect("interrupted active removal");
        sync_directory(&harness.recovery_root).expect("synchronized active removal");

        assert!(matches!(
            prepare_update_recovery(
                &SyntheticApplicationCopier,
                harness.preparation(&authorization),
            ),
            Err(UpdateRecoveryError::ActiveAttemptExists)
        ));
        assert_eq!(
            maintain_update_recovery(
                &harness.recovery_root,
                &harness.application_path,
                &harness.library_path,
            )
            .expect("resumed terminal cleanup"),
            UpdateRecoveryMaintenance::OutcomeRetained(expected.clone())
        );
        assert!(!attempt_directory.exists());
        assert_eq!(
            load_update_recovery_outcome(&harness.recovery_root).expect("retained receipt"),
            Some(expected)
        );
    }

    #[test]
    fn retains_failed_and_invalid_terminal_state_without_deleting_recovery_assets() {
        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");
        enter_recovering(&harness, prepared.recovery_id());
        transition_active_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            UpdateRecoveryPhase::RecoveryFailed,
        )
        .expect("terminal recovery failure");

        assert_eq!(
            maintain_update_recovery(
                &harness.recovery_root,
                &harness.application_path,
                &harness.library_path,
            )
            .expect("retained recovery failure"),
            UpdateRecoveryMaintenance::NoTerminalOutcome
        );
        assert!(prepared.attempt_directory().exists());
        assert!(harness.recovery_root.join(ACTIVE_FILE_NAME).exists());

        fs::write(
            harness.recovery_root.join(OUTCOME_FILE_NAME),
            br#"{"format":"unexpected"}"#,
        )
        .expect("invalid outcome");
        assert!(maintain_update_recovery(
            &harness.recovery_root,
            &harness.application_path,
            &harness.library_path,
        )
        .is_err());
        assert!(prepared.attempt_directory().exists());
        assert!(harness.recovery_root.join(ACTIVE_FILE_NAME).exists());
    }

    #[test]
    fn acknowledges_only_an_outcome_whose_recovery_assets_are_gone() {
        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");
        let recovery_id = prepared.recovery_id().to_owned();
        enter_launching(&harness, &recovery_id);
        fs::remove_dir_all(&harness.application_path).expect("removed source application");
        create_synthetic_application(&harness.application_path, "0.2.0");
        transition_active_update_recovery(
            &harness.recovery_root,
            &recovery_id,
            UpdateRecoveryPhase::Confirmed,
        )
        .expect("confirmed update");
        let outcome = UpdateRecoveryOutcome {
            recovery_id,
            kind: UpdateRecoveryOutcomeKind::Updated,
            source_version: "0.1.0".to_owned(),
            target_version: "0.2.0".to_owned(),
        };
        write_update_recovery_outcome(&harness.recovery_root, &outcome).expect("terminal receipt");
        assert!(acknowledge_update_recovery_outcome(&harness.recovery_root).is_err());

        maintain_update_recovery(
            &harness.recovery_root,
            &harness.application_path,
            &harness.library_path,
        )
        .expect("terminal cleanup");
        assert!(acknowledge_update_recovery_outcome(&harness.recovery_root)
            .expect("acknowledged outcome"));
        assert_eq!(
            load_update_recovery_outcome(&harness.recovery_root).expect("removed outcome"),
            None
        );
        assert!(!acknowledge_update_recovery_outcome(&harness.recovery_root)
            .expect("idempotent acknowledgement"));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn restores_the_pair_with_the_real_macos_application_copier() {
        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &PlatformApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared macOS update recovery");
        enter_recovering(&harness, prepared.recovery_id());
        fs::remove_dir_all(&harness.application_path).expect("removed previous application");
        create_synthetic_application(&harness.application_path, "0.2.0");

        restore_active_update_recovery(
            &PlatformApplicationCopier,
            UpdateRecoveryRestoration {
                recovery_root: &harness.recovery_root,
                recovery_id: prepared.recovery_id(),
                expected_application_path: &harness.application_path,
                expected_library_path: &harness.library_path,
            },
        )
        .expect("restored macOS update recovery");

        validate_application_bundle(&harness.application_path, "0.1.0")
            .expect("restored macOS application");
    }

    #[test]
    fn resolves_watchdog_authority_only_from_the_preserved_executable_layout() {
        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");
        let watchdog_executable = prepared
            .attempt_directory()
            .join("previous/FitFreed.app/Contents/MacOS/fitfreed");

        let context = resolve_update_recovery_watchdog_context(
            &watchdog_executable,
            &harness.application_path,
        )
        .expect("watchdog context");

        assert_eq!(context.recovery_id(), prepared.recovery_id());
        assert_eq!(context.target_version(), "0.2.0");
        assert_eq!(
            context.target_library_schema_version(),
            u32::try_from(SCHEMA_VERSION).expect("schema version")
        );
        assert_eq!(
            context.installed_application_path(),
            harness
                .application_path
                .canonicalize()
                .expect("application path")
        );
        assert_eq!(
            context.library_path(),
            harness.library_path.canonicalize().expect("library path")
        );
        assert_eq!(context.replacement_process(), None);
        assert!(resolve_update_recovery_watchdog_context(
            &harness.application_path.join("Contents/MacOS/fitfreed"),
            &harness.application_path,
        )
        .is_err());
    }

    #[test]
    fn records_a_closed_replacement_process_identity_with_the_launch_transition() {
        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");
        for phase in [
            UpdateRecoveryPhase::ReplacementStarted,
            UpdateRecoveryPhase::ReplacementInstalled,
        ] {
            transition_active_update_recovery(
                &harness.recovery_root,
                prepared.recovery_id(),
                phase,
            )
            .expect("replacement transition");
        }
        let mut invalid_launch = synthetic_replacement_launch();
        invalid_launch.process_id = 1;
        assert!(matches!(
            record_active_update_recovery_replacement_launch(
                &harness.recovery_root,
                prepared.recovery_id(),
                invalid_launch,
            ),
            Err(UpdateRecoveryError::InvalidState)
        ));
        assert_eq!(
            active_update_recovery_phase(&harness.recovery_root).expect("unchanged recovery"),
            Some((
                prepared.recovery_id().to_owned(),
                UpdateRecoveryPhase::ReplacementInstalled
            ))
        );

        record_active_update_recovery_replacement_launch(
            &harness.recovery_root,
            prepared.recovery_id(),
            synthetic_replacement_launch(),
        )
        .expect("recorded replacement launch");
        let watchdog_executable = prepared
            .attempt_directory()
            .join("previous/FitFreed.app/Contents/MacOS/fitfreed");
        let context = resolve_update_recovery_watchdog_context(
            &watchdog_executable,
            &harness.application_path,
        )
        .expect("watchdog launch context");
        let process = context.replacement_process().expect("replacement process");

        assert_eq!(process.process_id(), 42);
        assert_eq!(process.started_at_unix_seconds(), 1_787_000_000);
        assert_eq!(process.started_at_microseconds(), 123_456);
        assert_eq!(
            process.launch_nonce(),
            synthetic_replacement_launch().launch_nonce
        );
        assert_eq!(process.confirmation_deadline(), "2026-08-17T08:01:00Z");
    }

    #[test]
    fn confirms_only_the_expected_replacement_and_opened_library() {
        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");
        for phase in [
            UpdateRecoveryPhase::ReplacementStarted,
            UpdateRecoveryPhase::ReplacementInstalled,
        ] {
            transition_active_update_recovery(
                &harness.recovery_root,
                prepared.recovery_id(),
                phase,
            )
            .expect("launch transition");
        }
        record_active_update_recovery_replacement_launch(
            &harness.recovery_root,
            prepared.recovery_id(),
            synthetic_replacement_launch(),
        )
        .expect("recorded replacement launch");
        fs::remove_dir_all(&harness.application_path).expect("removed previous application");
        create_synthetic_application(&harness.application_path, "0.2.0");
        let running_executable = harness.application_path.join("Contents/MacOS/fitfreed");

        assert!(confirm_active_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            &running_executable,
            "0.1.9",
            &harness.library_path,
            u32::try_from(SCHEMA_VERSION).expect("schema version"),
            synthetic_replacement_launch().launch_nonce,
        )
        .is_err());
        assert_eq!(
            active_update_recovery_phase(&harness.recovery_root).expect("launching recovery"),
            Some((
                prepared.recovery_id().to_owned(),
                UpdateRecoveryPhase::Launching
            ))
        );

        assert!(confirm_active_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            &running_executable,
            "0.2.0",
            &harness.library_path,
            u32::try_from(SCHEMA_VERSION).expect("schema version"),
            "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        )
        .is_err());

        confirm_active_update_recovery(
            &harness.recovery_root,
            prepared.recovery_id(),
            &running_executable,
            "0.2.0",
            &harness.library_path,
            u32::try_from(SCHEMA_VERSION).expect("schema version"),
            synthetic_replacement_launch().launch_nonce,
        )
        .expect("confirmed replacement");
        assert_eq!(
            active_update_recovery_phase(&harness.recovery_root).expect("confirmed recovery"),
            Some((
                prepared.recovery_id().to_owned(),
                UpdateRecoveryPhase::Confirmed
            ))
        );
    }

    #[test]
    fn rejects_tampered_assets_and_a_second_active_attempt() {
        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");

        assert!(matches!(
            prepare_update_recovery(
                &SyntheticApplicationCopier,
                harness.preparation(&authorization),
            ),
            Err(UpdateRecoveryError::ActiveAttemptExists)
        ));

        fs::write(
            prepared
                .attempt_directory()
                .join("previous/FitFreed.app/Contents/Resources/preserved.txt"),
            "changed application",
        )
        .expect("tampered application copy");
        assert!(matches!(
            verify_prepared_update_recovery(&harness.recovery_root, prepared.recovery_id()),
            Err(UpdateRecoveryError::InvalidApplicationCopy)
        ));
    }

    #[test]
    fn publishes_no_active_attempt_when_application_copy_is_interrupted() {
        let harness = Harness::new();
        let authorization = harness.authorization();

        assert!(matches!(
            prepare_update_recovery(
                &FailingApplicationCopier,
                harness.preparation(&authorization),
            ),
            Err(UpdateRecoveryError::ApplicationCopy)
        ));
        assert_eq!(
            active_update_recovery_phase(&harness.recovery_root).expect("no active recovery"),
            None
        );
        let attempts = harness.recovery_root.join(ATTEMPTS_DIRECTORY_NAME);
        assert!(
            fs::read_dir(attempts)
                .expect("attempt directory")
                .next()
                .is_none(),
            "interrupted preparation must remove its staging directory"
        );
    }

    #[test]
    fn rejects_a_tampered_library_and_unknown_manifest_fields() {
        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");
        let library_path = prepared
            .attempt_directory()
            .join(LIBRARY_BACKUP_RELATIVE_PATH);
        fs::write(&library_path, "not a SQLite library").expect("tampered library copy");
        assert!(matches!(
            verify_prepared_update_recovery(&harness.recovery_root, prepared.recovery_id()),
            Err(UpdateRecoveryError::InvalidLibraryCopy)
        ));

        let manifest_path = prepared.attempt_directory().join(MANIFEST_FILE_NAME);
        let mut manifest = serde_json::to_value(read_manifest(&manifest_path).expect("manifest"))
            .expect("manifest value");
        manifest
            .as_object_mut()
            .expect("manifest object")
            .insert("unexpected".to_owned(), serde_json::Value::Bool(true));
        fs::write(
            &manifest_path,
            serde_json::to_vec(&manifest).expect("invalid manifest bytes"),
        )
        .expect("invalid manifest");
        assert!(active_update_recovery_phase(&harness.recovery_root).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symbolic_links_at_recovery_file_boundaries() {
        use std::os::unix::fs::symlink;

        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");
        let active_path = harness.recovery_root.join(ACTIVE_FILE_NAME);
        let linked_path = harness.recovery_root.join("linked-active");
        fs::rename(&active_path, &linked_path).expect("moved active pointer");
        symlink(&linked_path, &active_path).expect("linked active pointer");

        assert!(active_update_recovery_phase(&harness.recovery_root).is_err());
        assert!(matches!(
            verify_prepared_update_recovery(&harness.recovery_root, prepared.recovery_id()),
            Err(UpdateRecoveryError::InvalidState) | Err(UpdateRecoveryError::Io(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn rejects_a_symbolic_link_as_the_candidate_process_lock() {
        use std::os::unix::fs::symlink;

        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");
        let candidate_lock = prepared.attempt_directory().join(CANDIDATE_LOCK_FILE_NAME);
        let outside = harness.recovery_root.join("outside-candidate-lock");
        fs::write(&outside, "outside state").expect("outside state");
        fs::remove_file(&candidate_lock).expect("removed candidate lock");
        symlink(&outside, &candidate_lock).expect("symbolic candidate lock");

        assert!(matches!(
            verify_prepared_update_recovery(&harness.recovery_root, prepared.recovery_id()),
            Err(UpdateRecoveryError::Io(_))
        ));
        assert_eq!(
            fs::read_to_string(outside).expect("unchanged outside state"),
            "outside state"
        );
    }

    #[cfg(unix)]
    #[test]
    fn rejects_a_symbolic_link_as_the_watchdog_process_lock() {
        use std::os::unix::fs::symlink;

        let harness = Harness::new();
        let authorization = harness.authorization();
        let prepared = prepare_update_recovery(
            &SyntheticApplicationCopier,
            harness.preparation(&authorization),
        )
        .expect("prepared update recovery");
        let watchdog_lock = prepared.attempt_directory().join(WATCHDOG_LOCK_FILE_NAME);
        let outside = harness.recovery_root.join("outside-watchdog-lock");
        fs::write(&outside, "outside state").expect("outside state");
        fs::remove_file(&watchdog_lock).expect("removed watchdog lock");
        symlink(&outside, &watchdog_lock).expect("symbolic watchdog lock");

        assert!(matches!(
            verify_prepared_update_recovery(&harness.recovery_root, prepared.recovery_id()),
            Err(UpdateRecoveryError::Io(_))
        ));
        assert_eq!(
            fs::read_to_string(outside).expect("unchanged outside state"),
            "outside state"
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn distinguishes_the_exact_running_process_from_exit_and_identifier_reuse() {
        let executable = std::env::current_exe().expect("current executable");
        let identity = observe_update_recovery_process(std::process::id(), &executable)
            .expect("current process identity");
        let exact = UpdateRecoveryReplacementProcess {
            process_id: identity.process_id(),
            started_at_unix_seconds: identity.started_at_unix_seconds(),
            started_at_microseconds: identity.started_at_microseconds(),
            launch_nonce: "a".repeat(64),
            confirmation_deadline: "2026-08-17T08:01:00Z".to_owned(),
        };
        let mut reused = exact.clone();
        reused.started_at_microseconds = (reused.started_at_microseconds + 1) % 1_000_000;

        assert!(
            update_recovery_process_is_running(&exact, &executable).expect("exact running process")
        );
        assert!(!update_recovery_process_is_running(&reused, &executable)
            .expect("reused process identity"));
        assert!(
            !update_recovery_process_is_running(&exact, Path::new("/bin/sh"))
                .expect("different executable")
        );
    }

    #[cfg(unix)]
    #[test]
    fn rejects_an_application_link_that_escapes_the_bundle() {
        use std::os::unix::fs::symlink;

        let harness = Harness::new();
        symlink(
            "../../../../outside",
            harness
                .application_path
                .join("Contents/Resources/external-link"),
        )
        .expect("external application link");

        assert!(matches!(
            application_tree_sha256(&harness.application_path),
            Err(UpdateRecoveryError::InvalidApplicationCopy)
        ));
    }

    fn enter_launching(harness: &Harness, recovery_id: &str) {
        for phase in [
            UpdateRecoveryPhase::ReplacementStarted,
            UpdateRecoveryPhase::ReplacementInstalled,
        ] {
            transition_active_update_recovery(&harness.recovery_root, recovery_id, phase)
                .expect("recovery transition");
        }
        record_active_update_recovery_replacement_launch(
            &harness.recovery_root,
            recovery_id,
            synthetic_replacement_launch(),
        )
        .expect("recorded replacement launch");
    }

    fn enter_recovering(harness: &Harness, recovery_id: &str) {
        enter_launching(harness, recovery_id);
        transition_active_update_recovery(
            &harness.recovery_root,
            recovery_id,
            UpdateRecoveryPhase::Recovering,
        )
        .expect("recovering transition");
    }

    fn create_synthetic_application(path: &Path, version: &str) {
        fs::create_dir_all(path.join("Contents/MacOS")).expect("application executable directory");
        fs::create_dir_all(path.join("Contents/Resources"))
            .expect("application resource directory");
        let mut dictionary = Dictionary::new();
        dictionary.insert(
            "CFBundleIdentifier".to_owned(),
            Value::String(EXPECTED_BUNDLE_IDENTIFIER.to_owned()),
        );
        dictionary.insert(
            "CFBundleShortVersionString".to_owned(),
            Value::String(version.to_owned()),
        );
        dictionary.insert(
            "CFBundleExecutable".to_owned(),
            Value::String(EXPECTED_BUNDLE_EXECUTABLE.to_owned()),
        );
        Value::Dictionary(dictionary)
            .to_file_xml(path.join("Contents/Info.plist"))
            .expect("application property list");
        let executable = path.join("Contents/MacOS/fitfreed");
        fs::write(&executable, "synthetic executable").expect("application executable");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            fs::set_permissions(&executable, fs::Permissions::from_mode(0o755))
                .expect("executable permissions");
        }
        fs::write(
            path.join("Contents/Resources/preserved.txt"),
            "preserved application",
        )
        .expect("application resource");
    }

    fn copy_test_tree(source: &Path, destination: &Path) -> io::Result<()> {
        fs::create_dir(destination)?;
        #[cfg(unix)]
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
                #[cfg(unix)]
                fs::set_permissions(&destination_path, metadata.permissions())?;
            }
        }
        Ok(())
    }
}
