use std::{
    fs::{self, OpenOptions},
    io::{self, Read, Write},
    path::Path,
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
    fs::remove_file(recovery_root.join(OUTCOME_FILE_NAME))?;
    sync_directory(recovery_root)?;
    Ok(())
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
    let file = options.open(path)?;
    let metadata = file.metadata()?;
    if !metadata.file_type().is_file() || metadata.len() == 0 || metadata.len() > MAX_OUTCOME_BYTES
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
}
