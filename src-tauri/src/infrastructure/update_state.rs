use std::{
    path::{Path, PathBuf},
    result::Result as StandardResult,
};

use chrono::DateTime;
use fitfreed_application::{
    PersistedUpdateState, PostponedUpdate, TrustedSnapshotRecord, UpdateStatePort,
};
use rusqlite::{params, Connection, OptionalExtension};
use semver::Version;

use super::{ensure_schema, ImportError, Result};

const MAX_UPDATE_SEQUENCE: u64 = 9_007_199_254_740_991;

pub struct SqliteUpdateState {
    database_path: PathBuf,
}

impl SqliteUpdateState {
    pub fn new(database_path: PathBuf) -> Self {
        Self { database_path }
    }
}

impl UpdateStatePort for SqliteUpdateState {
    fn load_update_state(&self) -> StandardResult<PersistedUpdateState, String> {
        load_update_state(&self.database_path).map_err(|error| error.to_string())
    }

    fn save_update_state(&self, state: &PersistedUpdateState) -> StandardResult<(), String> {
        save_update_state(&self.database_path, state).map_err(|error| error.to_string())
    }
}

fn load_update_state(database_path: &Path) -> Result<PersistedUpdateState> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let persisted = connection
        .query_row(
            "SELECT trusted_sequence, trusted_payload_sha256, trusted_release_version,
                    dismissed_version, postponed_version, postponed_until
             FROM update_state
             WHERE id = 1",
            [],
            |row| {
                Ok((
                    row.get::<_, Option<i64>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                ))
            },
        )
        .optional()?;
    let Some((sequence, payload_sha256, release_version, dismissed_version, postponed, until)) =
        persisted
    else {
        return Ok(PersistedUpdateState::default());
    };

    let trusted_snapshot = match (sequence, payload_sha256, release_version) {
        (None, None, None) => None,
        (Some(sequence), Some(payload_sha256), Some(release_version)) => {
            Some(TrustedSnapshotRecord {
                sequence: u64::try_from(sequence).map_err(|_| {
                    invalid_update_state("trusted sequence is outside the supported range")
                })?,
                payload_sha256,
                release_version,
            })
        }
        _ => return Err(invalid_update_state("trusted snapshot is incomplete")),
    };
    let postponed_update = match (postponed, until) {
        (None, None) => None,
        (Some(version), Some(until)) => Some(PostponedUpdate { version, until }),
        _ => return Err(invalid_update_state("postponement is incomplete")),
    };
    let state = PersistedUpdateState {
        trusted_snapshot,
        dismissed_version,
        postponed_update,
    };
    validate_update_state(&state)?;
    Ok(state)
}

fn save_update_state(database_path: &Path, state: &PersistedUpdateState) -> Result<()> {
    validate_update_state(state)?;
    let trusted_sequence = state
        .trusted_snapshot
        .as_ref()
        .map(|trusted| {
            i64::try_from(trusted.sequence)
                .map_err(|_| invalid_update_state("trusted sequence is outside the SQLite range"))
        })
        .transpose()?;
    let trusted_payload_sha256 = state
        .trusted_snapshot
        .as_ref()
        .map(|trusted| trusted.payload_sha256.as_str());
    let trusted_release_version = state
        .trusted_snapshot
        .as_ref()
        .map(|trusted| trusted.release_version.as_str());
    let postponed_version = state
        .postponed_update
        .as_ref()
        .map(|postponed| postponed.version.as_str());
    let postponed_until = state
        .postponed_update
        .as_ref()
        .map(|postponed| postponed.until.as_str());

    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    connection.execute(
        "INSERT INTO update_state (
             id, trusted_sequence, trusted_payload_sha256, trusted_release_version,
             dismissed_version, postponed_version, postponed_until, updated_at_utc
         ) VALUES (
             1, ?1, ?2, ?3, ?4, ?5, ?6, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         )
         ON CONFLICT(id) DO UPDATE SET
             trusted_sequence = excluded.trusted_sequence,
             trusted_payload_sha256 = excluded.trusted_payload_sha256,
             trusted_release_version = excluded.trusted_release_version,
             dismissed_version = excluded.dismissed_version,
             postponed_version = excluded.postponed_version,
             postponed_until = excluded.postponed_until,
             updated_at_utc = excluded.updated_at_utc",
        params![
            trusted_sequence,
            trusted_payload_sha256,
            trusted_release_version,
            state.dismissed_version.as_deref(),
            postponed_version,
            postponed_until,
        ],
    )?;
    Ok(())
}

fn validate_update_state(state: &PersistedUpdateState) -> Result<()> {
    let Some(trusted) = state.trusted_snapshot.as_ref() else {
        if state.dismissed_version.is_some() || state.postponed_update.is_some() {
            return Err(invalid_update_state(
                "an update preference exists without a trusted snapshot",
            ));
        }
        return Ok(());
    };
    if trusted.sequence == 0 || trusted.sequence > MAX_UPDATE_SEQUENCE {
        return Err(invalid_update_state(
            "trusted sequence is outside the supported range",
        ));
    }
    if trusted.payload_sha256.len() != 64
        || !trusted
            .payload_sha256
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return Err(invalid_update_state(
            "trusted payload digest is not lowercase SHA-256",
        ));
    }
    validate_update_version(&trusted.release_version, "trusted release version")?;
    if state.dismissed_version.is_some() && state.postponed_update.is_some() {
        return Err(invalid_update_state(
            "dismissal and postponement are mutually exclusive",
        ));
    }
    if let Some(dismissed) = state.dismissed_version.as_deref() {
        validate_update_version(dismissed, "dismissed version")?;
        if dismissed != trusted.release_version {
            return Err(invalid_update_state(
                "dismissed version does not match the trusted release",
            ));
        }
    }
    if let Some(postponed) = state.postponed_update.as_ref() {
        validate_update_version(&postponed.version, "postponed version")?;
        if postponed.version != trusted.release_version {
            return Err(invalid_update_state(
                "postponed version does not match the trusted release",
            ));
        }
        if postponed.until.len() > 64 || DateTime::parse_from_rfc3339(&postponed.until).is_err() {
            return Err(invalid_update_state(
                "postponement expiry is not a bounded RFC 3339 instant",
            ));
        }
    }
    Ok(())
}

fn validate_update_version(value: &str, label: &str) -> Result<()> {
    if value.len() > 255 || Version::parse(value).is_err() {
        return Err(invalid_update_state(format!(
            "{label} is not a bounded semantic version"
        )));
    }
    Ok(())
}

fn invalid_update_state(reason: impl Into<String>) -> ImportError {
    ImportError::InvalidPersistedUpdateState(reason.into())
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use fitfreed_application::{
        check_for_updates, dismiss_update, postpone_update, AuthenticatedUpdateSnapshot,
        LocalePreference, LocalizedUpdateText, UpdateArtifact, UpdateChannelPort,
        UpdateChannelRead, UpdateCheckContext, UpdateCheckStatus, UpdateCheckTrigger,
        UpdateRelease, UpdateTrustFailure,
    };
    use tempfile::TempDir;

    use super::*;

    struct Harness {
        directory: TempDir,
    }

    impl Harness {
        fn new() -> Self {
            Self {
                directory: tempfile::tempdir().expect("temporary directory"),
            }
        }

        fn database(&self) -> PathBuf {
            self.directory.path().join("fitfreed.sqlite")
        }
    }

    #[test]
    fn persists_update_trust_and_preferences_across_reopens_and_backup() {
        let harness = Harness::new();
        let state_port = SqliteUpdateState::new(harness.database());

        assert_eq!(
            state_port.load_update_state().expect("empty update state"),
            PersistedUpdateState::default()
        );

        let trusted = PersistedUpdateState {
            trusted_snapshot: Some(TrustedSnapshotRecord {
                sequence: 41,
                payload_sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
                    .to_owned(),
                release_version: "0.2.0-alpha.4".to_owned(),
            }),
            dismissed_version: None,
            postponed_update: Some(PostponedUpdate {
                version: "0.2.0-alpha.4".to_owned(),
                until: "2026-08-18T12:00:00+02:00".to_owned(),
            }),
        };
        state_port
            .save_update_state(&trusted)
            .expect("saved update state");

        let reopened = SqliteUpdateState::new(harness.database());
        assert_eq!(
            reopened.load_update_state().expect("reopened update state"),
            trusted
        );

        let backup_path = harness.directory.path().join("fitfreed-backup.sqlite");
        super::super::backup_database(&harness.database(), &backup_path)
            .expect("complete library backup");
        assert_eq!(
            SqliteUpdateState::new(backup_path)
                .load_update_state()
                .expect("backed-up update state"),
            trusted
        );
    }

    #[test]
    fn concrete_update_preferences_survive_restart_and_remain_mutually_exclusive() {
        let harness = Harness::new();
        let state_port = SqliteUpdateState::new(harness.database());
        state_port
            .save_update_state(&PersistedUpdateState {
                trusted_snapshot: Some(TrustedSnapshotRecord {
                    sequence: 42,
                    payload_sha256:
                        "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
                            .to_owned(),
                    release_version: "0.2.0".to_owned(),
                }),
                dismissed_version: None,
                postponed_update: None,
            })
            .expect("trusted candidate");

        let until = postpone_update(&state_port, "0.2.0", "2026-08-17T12:00:00Z")
            .expect("postponed update");
        assert_eq!(until, "2026-08-18T12:00:00+00:00");
        let reopened = SqliteUpdateState::new(harness.database());
        assert_eq!(
            reopened
                .load_update_state()
                .expect("persisted postponement")
                .postponed_update,
            Some(PostponedUpdate {
                version: "0.2.0".to_owned(),
                until,
            })
        );

        dismiss_update(&reopened, "0.2.0").expect("dismissed update");
        let dismissed = SqliteUpdateState::new(harness.database())
            .load_update_state()
            .expect("persisted dismissal");
        assert_eq!(dismissed.dismissed_version.as_deref(), Some("0.2.0"));
        assert_eq!(dismissed.postponed_update, None);
    }

    struct FixedUpdateChannel(UpdateChannelRead);

    impl UpdateChannelPort for FixedUpdateChannel {
        fn fetch_update_snapshot(&self) -> StandardResult<UpdateChannelRead, String> {
            Ok(self.0.clone())
        }
    }

    fn authenticated_update(sequence: u64, payload_sha256: &str) -> UpdateChannelRead {
        UpdateChannelRead::Authenticated(Box::new(AuthenticatedUpdateSnapshot {
            sequence,
            payload_sha256: payload_sha256.to_owned(),
            issued_at: "2026-08-17T00:00:00Z".to_owned(),
            expires_at: "2026-08-24T00:00:00Z".to_owned(),
            release: UpdateRelease {
                version: "0.2.0".to_owned(),
                published_at: "2026-08-17T00:00:00Z".to_owned(),
                minimum_supported_version: "0.1.0".to_owned(),
                minimum_readable_library_schema_version: 1,
                maximum_readable_library_schema_version: 9,
                target_library_schema_version: 9,
                release_notes: LocalizedUpdateText {
                    values: BTreeMap::from([
                        ("en-US".to_owned(), "Synthetic release.".to_owned()),
                        ("es-ES".to_owned(), "Versión sintética.".to_owned()),
                    ]),
                },
                artifact: UpdateArtifact {
                    target: "darwin-aarch64".to_owned(),
                    package_url: "https://updates.invalid/fitfreed-0.2.0.app.tar.gz".to_owned(),
                    expected_size_bytes: 26,
                    expected_sha256:
                        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
                            .to_owned(),
                    package_signature: "synthetic-package-signature".to_owned(),
                },
            },
            withdrawn_versions: Vec::new(),
        }))
    }

    fn scheduled_update_context() -> UpdateCheckContext {
        UpdateCheckContext {
            installed_version: "0.1.0".to_owned(),
            library_schema_version: 9,
            locale: LocalePreference::EnUs,
            checked_at: "2026-08-17T12:00:00Z".to_owned(),
            trigger: UpdateCheckTrigger::Scheduled,
        }
    }

    #[test]
    fn preserves_replay_highwater_and_dismissal_through_application_checks_and_restart() {
        let harness = Harness::new();
        let first_port = SqliteUpdateState::new(harness.database());
        let accepted = check_for_updates(
            &FixedUpdateChannel(authenticated_update(
                17,
                "1111111111111111111111111111111111111111111111111111111111111111",
            )),
            &first_port,
            scheduled_update_context(),
        )
        .expect("accepted update check");
        assert_eq!(accepted.status, UpdateCheckStatus::Available);
        dismiss_update(&first_port, "0.2.0").expect("dismissed candidate");

        let reopened = SqliteUpdateState::new(harness.database());
        let repeated = check_for_updates(
            &FixedUpdateChannel(authenticated_update(
                17,
                "1111111111111111111111111111111111111111111111111111111111111111",
            )),
            &reopened,
            scheduled_update_context(),
        )
        .expect("repeated update check");
        assert_eq!(repeated.status, UpdateCheckStatus::Dismissed);

        let replay = check_for_updates(
            &FixedUpdateChannel(authenticated_update(
                16,
                "2222222222222222222222222222222222222222222222222222222222222222",
            )),
            &reopened,
            scheduled_update_context(),
        )
        .expect("replay outcome");
        assert_eq!(replay.status, UpdateCheckStatus::Untrusted);
        assert_eq!(replay.trust_failure, Some(UpdateTrustFailure::Replay));
        assert_eq!(
            reopened.load_update_state().expect("preserved highwater"),
            PersistedUpdateState {
                trusted_snapshot: Some(TrustedSnapshotRecord {
                    sequence: 17,
                    payload_sha256:
                        "1111111111111111111111111111111111111111111111111111111111111111"
                            .to_owned(),
                    release_version: "0.2.0".to_owned(),
                }),
                dismissed_version: Some("0.2.0".to_owned()),
                postponed_update: None,
            }
        );
    }

    #[test]
    fn rejects_invalid_update_state_at_the_storage_boundary() {
        let harness = Harness::new();
        let state_port = SqliteUpdateState::new(harness.database());
        let invalid = PersistedUpdateState {
            trusted_snapshot: Some(TrustedSnapshotRecord {
                sequence: 1,
                payload_sha256: "not-a-digest".to_owned(),
                release_version: "0.2.0".to_owned(),
            }),
            dismissed_version: None,
            postponed_update: None,
        };
        let error = state_port
            .save_update_state(&invalid)
            .expect_err("invalid update state");
        assert!(error.contains("invalid persisted update state"));

        let connection = Connection::open(harness.database()).expect("database");
        ensure_schema(&connection).expect("current schema");
        connection
            .execute(
                "INSERT INTO update_state (
                     id, trusted_sequence, trusted_payload_sha256, trusted_release_version,
                     dismissed_version, postponed_version, postponed_until, updated_at_utc
                 ) VALUES (
                     1, 2,
                     '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
                     'not-semver', NULL, NULL, NULL, '2026-08-17T12:00:00Z'
                 )",
                [],
            )
            .expect("syntactically valid persisted row");
        let error = state_port
            .load_update_state()
            .expect_err("semantically invalid persisted row");
        assert!(error.contains("invalid persisted update state"));
    }
}
