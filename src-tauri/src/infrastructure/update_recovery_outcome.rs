use std::{
    fs::{self, OpenOptions},
    io::{self, Read, Write},
    path::Path,
};

#[cfg(windows)]
use std::{
    thread,
    time::{Duration, Instant},
};

use fitfreed_application::{UpdateRecoveryOutcome, UpdateRecoveryOutcomeKind};
use semver::Version;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use super::local_file::{sync_directory, PrivateStagingFile};

const RECOVERY_OUTCOME_FORMAT: &str = "org.fitfreed.update-recovery-outcome";
const RECOVERY_OUTCOME_SCHEMA_VERSION: u32 = 1;
pub(super) const OUTCOME_FILE_NAME: &str = "last-outcome.json";
const MAX_OUTCOME_BYTES: u64 = 4 * 1024;
#[cfg(windows)]
const WINDOWS_OUTCOME_REMOVAL_TIMEOUT: Duration = Duration::from_secs(5);
#[cfg(windows)]
const WINDOWS_OUTCOME_REMOVAL_POLL_INTERVAL: Duration = Duration::from_millis(25);

#[derive(Debug, Error)]
pub(super) enum UpdateRecoveryOutcomeStoreError {
    #[error("the update recovery outcome is invalid")]
    InvalidState,
    #[error("update recovery outcome input/output failure: {0}")]
    Io(#[from] io::Error),
    #[error("update recovery outcome manifest failure: {0}")]
    Manifest(#[from] serde_json::Error),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UpdateRecoveryMaintenance {
    NoTerminalOutcome,
    Deferred,
    CleanupPending(UpdateRecoveryOutcome),
    OutcomeRetained(UpdateRecoveryOutcome),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct UpdateRecoveryOutcomeWire {
    format: String,
    schema_version: u32,
    recovery_id: String,
    outcome: RecoveryOutcomeWire,
    source_version: String,
    target_version: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
enum RecoveryOutcomeWire {
    Updated,
    Recovered,
}

impl From<RecoveryOutcomeWire> for UpdateRecoveryOutcomeKind {
    fn from(value: RecoveryOutcomeWire) -> Self {
        match value {
            RecoveryOutcomeWire::Updated => Self::Updated,
            RecoveryOutcomeWire::Recovered => Self::Recovered,
        }
    }
}

impl From<UpdateRecoveryOutcomeKind> for RecoveryOutcomeWire {
    fn from(value: UpdateRecoveryOutcomeKind) -> Self {
        match value {
            UpdateRecoveryOutcomeKind::Updated => Self::Updated,
            UpdateRecoveryOutcomeKind::Recovered => Self::Recovered,
        }
    }
}

impl From<UpdateRecoveryOutcomeWire> for UpdateRecoveryOutcome {
    fn from(value: UpdateRecoveryOutcomeWire) -> Self {
        Self {
            recovery_id: value.recovery_id,
            kind: value.outcome.into(),
            source_version: value.source_version,
            target_version: value.target_version,
        }
    }
}

impl From<&UpdateRecoveryOutcome> for UpdateRecoveryOutcomeWire {
    fn from(value: &UpdateRecoveryOutcome) -> Self {
        Self {
            format: RECOVERY_OUTCOME_FORMAT.to_owned(),
            schema_version: RECOVERY_OUTCOME_SCHEMA_VERSION,
            recovery_id: value.recovery_id.clone(),
            outcome: value.kind.into(),
            source_version: value.source_version.clone(),
            target_version: value.target_version.clone(),
        }
    }
}

pub(super) fn read_update_recovery_outcome(
    recovery_root: &Path,
) -> Result<Option<UpdateRecoveryOutcome>, UpdateRecoveryOutcomeStoreError> {
    let path = recovery_root.join(OUTCOME_FILE_NAME);
    if !path_entry_exists(&path)? {
        return Ok(None);
    }
    let bytes = read_bounded_file(&path)?;
    let outcome: UpdateRecoveryOutcomeWire = serde_json::from_slice(&bytes)?;
    validate_recovery_outcome(&outcome)?;
    Ok(Some(outcome.into()))
}

pub(super) fn write_update_recovery_outcome(
    recovery_root: &Path,
    outcome: &UpdateRecoveryOutcome,
) -> Result<(), UpdateRecoveryOutcomeStoreError> {
    let wire = UpdateRecoveryOutcomeWire::from(outcome);
    validate_recovery_outcome(&wire)?;
    let bytes = serde_json::to_vec_pretty(&wire)?;
    if bytes.len() as u64 > MAX_OUTCOME_BYTES {
        return Err(UpdateRecoveryOutcomeStoreError::InvalidState);
    }
    let mut staging = PrivateStagingFile::new(recovery_root, "fitfreed-recovery-outcome", ".tmp")?;
    staging.file_mut()?.write_all(&bytes)?;
    staging.sync_and_close()?;
    staging.persist_replace(&recovery_root.join(OUTCOME_FILE_NAME))?;
    Ok(())
}

pub(super) fn remove_update_recovery_outcome(
    recovery_root: &Path,
) -> Result<(), UpdateRecoveryOutcomeStoreError> {
    remove_outcome_file(&recovery_root.join(OUTCOME_FILE_NAME))?;
    sync_directory(recovery_root)?;
    Ok(())
}

#[cfg(not(windows))]
fn remove_outcome_file(path: &Path) -> io::Result<()> {
    fs::remove_file(path)
}

#[cfg(windows)]
fn remove_outcome_file(path: &Path) -> io::Result<()> {
    let deadline = Instant::now() + WINDOWS_OUTCOME_REMOVAL_TIMEOUT;
    loop {
        match fs::remove_file(path) {
            Ok(()) => return Ok(()),
            Err(error) if transient_windows_removal_error(&error) && Instant::now() < deadline => {
                thread::sleep(WINDOWS_OUTCOME_REMOVAL_POLL_INTERVAL);
            }
            Err(error) => return Err(error),
        }
    }
}

#[cfg(windows)]
fn transient_windows_removal_error(error: &io::Error) -> bool {
    use windows_sys::Win32::Foundation::{ERROR_ACCESS_DENIED, ERROR_SHARING_VIOLATION};

    matches!(
        error.raw_os_error(),
        Some(code)
            if code == ERROR_ACCESS_DENIED as i32 || code == ERROR_SHARING_VIOLATION as i32
    )
}

fn validate_recovery_outcome(
    outcome: &UpdateRecoveryOutcomeWire,
) -> Result<(), UpdateRecoveryOutcomeStoreError> {
    let source_version = Version::parse(&outcome.source_version)
        .map_err(|_| UpdateRecoveryOutcomeStoreError::InvalidState)?;
    let target_version = Version::parse(&outcome.target_version)
        .map_err(|_| UpdateRecoveryOutcomeStoreError::InvalidState)?;
    if outcome.format != RECOVERY_OUTCOME_FORMAT
        || outcome.schema_version != RECOVERY_OUTCOME_SCHEMA_VERSION
        || !valid_sha256(&outcome.recovery_id)
        || target_version <= source_version
    {
        return Err(UpdateRecoveryOutcomeStoreError::InvalidState);
    }
    Ok(())
}

fn read_bounded_file(path: &Path) -> Result<Vec<u8>, UpdateRecoveryOutcomeStoreError> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;

        options.custom_flags(libc::O_NOFOLLOW);
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;

        use windows_sys::Win32::Storage::FileSystem::FILE_FLAG_OPEN_REPARSE_POINT;

        options.custom_flags(FILE_FLAG_OPEN_REPARSE_POINT);
    }
    let file = options.open(path)?;
    let metadata = file.metadata()?;
    if !metadata.file_type().is_file()
        || is_reparse_point(&metadata)
        || metadata.len() == 0
        || metadata.len() > MAX_OUTCOME_BYTES
    {
        return Err(UpdateRecoveryOutcomeStoreError::InvalidState);
    }
    let mut bytes = Vec::with_capacity(
        usize::try_from(metadata.len())
            .map_err(|_| UpdateRecoveryOutcomeStoreError::InvalidState)?,
    );
    file.take(MAX_OUTCOME_BYTES + 1).read_to_end(&mut bytes)?;
    if bytes.len() as u64 != metadata.len() {
        return Err(UpdateRecoveryOutcomeStoreError::InvalidState);
    }
    Ok(bytes)
}

#[cfg(windows)]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    use windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT;

    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

fn path_entry_exists(path: &Path) -> Result<bool, UpdateRecoveryOutcomeStoreError> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.into()),
    }
}

fn valid_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

#[cfg(test)]
mod tests {
    use tempfile::TempDir;

    use super::*;

    fn outcome(kind: UpdateRecoveryOutcomeKind) -> UpdateRecoveryOutcome {
        UpdateRecoveryOutcome {
            recovery_id: "a".repeat(64),
            kind,
            source_version: "0.1.0".to_owned(),
            target_version: "0.2.0".to_owned(),
        }
    }

    #[test]
    fn atomically_replaces_and_reopens_the_platform_neutral_outcome() {
        let directory = TempDir::new().expect("temporary directory");

        write_update_recovery_outcome(
            directory.path(),
            &outcome(UpdateRecoveryOutcomeKind::Updated),
        )
        .expect("updated outcome");
        write_update_recovery_outcome(
            directory.path(),
            &outcome(UpdateRecoveryOutcomeKind::Recovered),
        )
        .expect("recovered outcome");

        assert_eq!(
            read_update_recovery_outcome(directory.path()).expect("stored outcome"),
            Some(outcome(UpdateRecoveryOutcomeKind::Recovered))
        );
        remove_update_recovery_outcome(directory.path()).expect("removed outcome");
        assert_eq!(
            read_update_recovery_outcome(directory.path()).expect("absent outcome"),
            None
        );
    }

    #[test]
    fn rejects_invalid_or_extended_outcome_contracts() {
        let directory = TempDir::new().expect("temporary directory");
        let path = directory.path().join(OUTCOME_FILE_NAME);
        fs::write(
            &path,
            format!(
                "{{\"format\":\"{RECOVERY_OUTCOME_FORMAT}\",\"schemaVersion\":1,\"recoveryId\":\"{}\",\"outcome\":\"updated\",\"sourceVersion\":\"0.2.0\",\"targetVersion\":\"0.1.0\"}}",
                "a".repeat(64)
            ),
        )
        .expect("reversed outcome");
        assert!(matches!(
            read_update_recovery_outcome(directory.path()),
            Err(UpdateRecoveryOutcomeStoreError::InvalidState)
        ));

        fs::write(
            path,
            format!(
                "{{\"format\":\"{RECOVERY_OUTCOME_FORMAT}\",\"schemaVersion\":1,\"recoveryId\":\"{}\",\"outcome\":\"updated\",\"sourceVersion\":\"0.1.0\",\"targetVersion\":\"0.2.0\",\"extra\":true}}",
                "a".repeat(64)
            ),
        )
        .expect("extended outcome");
        assert!(matches!(
            read_update_recovery_outcome(directory.path()),
            Err(UpdateRecoveryOutcomeStoreError::Manifest(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn rejects_a_redirected_outcome_file() {
        use std::os::unix::fs::symlink;

        let directory = TempDir::new().expect("temporary directory");
        let outside = TempDir::new().expect("outside directory");
        let outside_outcome = outside.path().join("outcome.json");
        fs::write(&outside_outcome, "redirected").expect("outside outcome");
        symlink(outside_outcome, directory.path().join(OUTCOME_FILE_NAME))
            .expect("redirected outcome");

        assert!(read_update_recovery_outcome(directory.path()).is_err());
    }

    #[cfg(windows)]
    #[test]
    fn waits_for_transient_windows_sharing_before_removing_outcome() {
        use std::os::windows::fs::OpenOptionsExt;

        use windows_sys::Win32::Foundation::{
            ERROR_ACCESS_DENIED, ERROR_FILE_NOT_FOUND, ERROR_SHARING_VIOLATION,
        };
        use windows_sys::Win32::Storage::FileSystem::FILE_SHARE_READ;

        assert!(transient_windows_removal_error(
            &io::Error::from_raw_os_error(ERROR_ACCESS_DENIED as i32,)
        ));
        assert!(transient_windows_removal_error(
            &io::Error::from_raw_os_error(ERROR_SHARING_VIOLATION as i32,)
        ));
        assert!(!transient_windows_removal_error(
            &io::Error::from_raw_os_error(ERROR_FILE_NOT_FOUND as i32,)
        ));

        let directory = TempDir::new().expect("temporary directory");
        write_update_recovery_outcome(
            directory.path(),
            &outcome(UpdateRecoveryOutcomeKind::Updated),
        )
        .expect("updated outcome");
        let outcome_path = directory.path().join(OUTCOME_FILE_NAME);
        let mut options = OpenOptions::new();
        options.read(true).share_mode(FILE_SHARE_READ);
        let held_outcome = options.open(&outcome_path).expect("held outcome");
        let first_error = fs::remove_file(&outcome_path).expect_err("sharing denial");
        assert!(transient_windows_removal_error(&first_error));

        let release = thread::spawn(move || {
            thread::sleep(Duration::from_millis(100));
            drop(held_outcome);
        });
        remove_update_recovery_outcome(directory.path()).expect("removed outcome after release");
        release.join().expect("outcome release");

        assert!(!outcome_path.exists());
    }
}
