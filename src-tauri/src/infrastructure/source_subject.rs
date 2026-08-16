use hmac::{Hmac, Mac};
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use sha2::Sha256;

use super::{ImportError, Result};

const DIGEST_DOMAIN: &[u8] = b"fitfreed:source-subject:v1";

pub(super) struct SourceSubjectClaim<'a> {
    source_provider: &'a str,
    evidence_kind: &'a str,
    evidence_version: &'a str,
    private_value: &'a [u8],
}

impl<'a> SourceSubjectClaim<'a> {
    pub(super) const fn new(
        source_provider: &'a str,
        evidence_kind: &'a str,
        evidence_version: &'a str,
        private_value: &'a [u8],
    ) -> Self {
        Self {
            source_provider,
            evidence_kind,
            evidence_version,
            private_value,
        }
    }
}

pub(super) enum SourceSubjectResolution {
    Existing {
        origin_id: String,
    },
    New {
        origin_id: String,
        source_provider: String,
        evidence_kind: String,
        evidence_version: String,
        scoped_digest: Vec<u8>,
    },
}

impl SourceSubjectResolution {
    pub(super) fn origin_id(&self) -> &str {
        match self {
            Self::Existing { origin_id } | Self::New { origin_id, .. } => origin_id,
        }
    }

    #[cfg(test)]
    pub(super) const fn is_new(&self) -> bool {
        matches!(self, Self::New { .. })
    }
}

pub(super) fn resolve_source_subject(
    connection: &Connection,
    claim: &SourceSubjectClaim<'_>,
) -> Result<SourceSubjectResolution> {
    if claim.source_provider.is_empty()
        || claim.evidence_kind.is_empty()
        || claim.evidence_version.is_empty()
        || claim.private_value.is_empty()
    {
        return Err(ImportError::InvalidSourceSubjectClaim);
    }

    let correlation_key = connection.query_row(
        "SELECT correlation_key FROM library_identity WHERE id = 1",
        [],
        |row| row.get::<_, Vec<u8>>(0),
    )?;
    if correlation_key.len() != 32 {
        return Err(ImportError::InvalidCorrelationKeyLength(
            correlation_key.len(),
        ));
    }
    let scoped_digest = scoped_digest(&correlation_key, claim);

    let existing_origin = connection
        .query_row(
            "SELECT origin.id
             FROM source_subject_evidence evidence
             JOIN observation_origin origin
               ON origin.id = evidence.observation_origin_id
             WHERE evidence.source_provider = ?1
               AND evidence.evidence_kind = ?2
               AND evidence.evidence_version = ?3
               AND evidence.scoped_digest = ?4
               AND origin.correlation_state = 'verified'",
            params![
                claim.source_provider,
                claim.evidence_kind,
                claim.evidence_version,
                scoped_digest.as_slice()
            ],
            |row| row.get::<_, String>(0),
        )
        .optional()?;
    if let Some(origin_id) = existing_origin {
        return Ok(SourceSubjectResolution::Existing { origin_id });
    }

    let verified_origins = connection.query_row(
        "SELECT COUNT(*) FROM observation_origin
         WHERE source_provider = ?1 AND correlation_state = 'verified'",
        [claim.source_provider],
        |row| row.get::<_, i64>(0),
    )?;
    if verified_origins > 0 {
        return Err(ImportError::SourceSubjectConflict);
    }

    let origin_id = connection.query_row("SELECT lower(hex(randomblob(16)))", [], |row| {
        row.get::<_, String>(0)
    })?;
    Ok(SourceSubjectResolution::New {
        origin_id,
        source_provider: claim.source_provider.to_owned(),
        evidence_kind: claim.evidence_kind.to_owned(),
        evidence_version: claim.evidence_version.to_owned(),
        scoped_digest,
    })
}

pub(super) fn persist_source_subject(
    transaction: &Transaction<'_>,
    operation_id: i64,
    resolution: &SourceSubjectResolution,
) -> Result<()> {
    if let SourceSubjectResolution::New {
        origin_id,
        source_provider,
        evidence_kind,
        evidence_version,
        scoped_digest,
    } = resolution
    {
        transaction.execute(
            "INSERT INTO observation_origin (
                 id, source_provider, correlation_state, created_at_utc
             ) VALUES (
                 ?1, ?2, 'verified', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             )",
            params![origin_id, source_provider],
        )?;
        transaction.execute(
            "INSERT INTO source_subject_evidence (
                 observation_origin_id, source_provider, evidence_kind,
                 evidence_version, scoped_digest, first_seen_import_operation_id,
                 created_at_utc
             ) VALUES (
                 ?1, ?2, ?3, ?4, ?5, ?6,
                 strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             )",
            params![
                origin_id,
                source_provider,
                evidence_kind,
                evidence_version,
                scoped_digest.as_slice(),
                operation_id
            ],
        )?;
    }

    let updated = transaction.execute(
        "UPDATE import_operation SET observation_origin_id = ?2 WHERE id = ?1",
        params![operation_id, resolution.origin_id()],
    )?;
    if updated != 1 {
        return Err(rusqlite::Error::QueryReturnedNoRows.into());
    }
    Ok(())
}

fn scoped_digest(correlation_key: &[u8], claim: &SourceSubjectClaim<'_>) -> Vec<u8> {
    let mut digest =
        Hmac::<Sha256>::new_from_slice(correlation_key).expect("HMAC accepts any key length");
    update_component(&mut digest, DIGEST_DOMAIN);
    update_component(&mut digest, claim.source_provider.as_bytes());
    update_component(&mut digest, claim.evidence_kind.as_bytes());
    update_component(&mut digest, claim.evidence_version.as_bytes());
    update_component(&mut digest, claim.private_value);
    digest.finalize().into_bytes().to_vec()
}

fn update_component(digest: &mut Hmac<Sha256>, value: &[u8]) {
    digest.update(&(value.len() as u64).to_be_bytes());
    digest.update(value);
}

#[cfg(test)]
mod tests {
    use std::fs;

    use rusqlite::Connection;
    use tempfile::tempdir;

    use super::*;
    use crate::infrastructure::{begin_operation, ensure_schema};

    #[test]
    fn persists_the_first_claim_and_resolves_the_same_claim_to_its_opaque_origin() {
        let directory = tempdir().expect("temporary directory");
        let database_path = directory.path().join("library.sqlite");
        let mut connection = Connection::open(&database_path).expect("database");
        ensure_schema(&connection).expect("schema");
        let operation_id = begin_operation(&connection).expect("operation");
        let claim = SourceSubjectClaim::new(
            "polar-flow",
            "account-username",
            "exact-v1",
            b"fixture-private-claim",
        );

        let first = resolve_source_subject(&connection, &claim).expect("first resolution");
        assert!(first.is_new());
        assert_eq!(first.origin_id().len(), 32);
        assert!(!first.origin_id().contains("polar"));

        let transaction = connection.transaction().expect("transaction");
        persist_source_subject(&transaction, operation_id, &first).expect("subject persistence");
        transaction.commit().expect("commit");

        let repeated = resolve_source_subject(&connection, &claim).expect("repeat resolution");
        assert!(!repeated.is_new());
        assert_eq!(repeated.origin_id(), first.origin_id());
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM observation_origin", [], |row| {
                    row.get::<_, i64>(0)
                })
                .expect("origin count"),
            1
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT length(scoped_digest) FROM source_subject_evidence",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("digest length"),
            32
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT observation_origin_id FROM import_operation WHERE id = ?1",
                    [operation_id],
                    |row| row.get::<_, String>(0),
                )
                .expect("operation origin"),
            first.origin_id()
        );

        drop(connection);
        let database_bytes = fs::read(database_path).expect("database bytes");
        assert!(!database_bytes
            .windows(b"fixture-private-claim".len())
            .any(|window| window == b"fixture-private-claim"));
    }

    #[test]
    fn scopes_equal_claims_to_each_library_correlation_key() {
        let first_directory = tempdir().expect("first temporary directory");
        let second_directory = tempdir().expect("second temporary directory");
        let first_path = first_directory.path().join("library.sqlite");
        let second_path = second_directory.path().join("library.sqlite");
        let mut first_connection = Connection::open(first_path).expect("first database");
        let mut second_connection = Connection::open(second_path).expect("second database");
        ensure_schema(&first_connection).expect("first schema");
        ensure_schema(&second_connection).expect("second schema");
        let first_operation = begin_operation(&first_connection).expect("first operation");
        let second_operation = begin_operation(&second_connection).expect("second operation");
        let claim = SourceSubjectClaim::new(
            "polar-flow",
            "account-username",
            "exact-v1",
            b"fixture-shared-claim",
        );

        let first_resolution =
            resolve_source_subject(&first_connection, &claim).expect("first resolution");
        let first_transaction = first_connection.transaction().expect("first transaction");
        persist_source_subject(&first_transaction, first_operation, &first_resolution)
            .expect("first subject persistence");
        first_transaction.commit().expect("first commit");

        let second_resolution =
            resolve_source_subject(&second_connection, &claim).expect("second resolution");
        let second_transaction = second_connection.transaction().expect("second transaction");
        persist_source_subject(&second_transaction, second_operation, &second_resolution)
            .expect("second subject persistence");
        second_transaction.commit().expect("second commit");

        let first_digest = first_connection
            .query_row(
                "SELECT scoped_digest FROM source_subject_evidence",
                [],
                |row| row.get::<_, Vec<u8>>(0),
            )
            .expect("first digest");
        let second_digest = second_connection
            .query_row(
                "SELECT scoped_digest FROM source_subject_evidence",
                [],
                |row| row.get::<_, Vec<u8>>(0),
            )
            .expect("second digest");
        assert_ne!(first_digest, second_digest);
        assert_ne!(first_resolution.origin_id(), second_resolution.origin_id());
    }

    #[test]
    fn rejects_a_changed_claim_when_the_provider_already_has_a_verified_origin() {
        let directory = tempdir().expect("temporary directory");
        let database_path = directory.path().join("library.sqlite");
        let mut connection = Connection::open(database_path).expect("database");
        ensure_schema(&connection).expect("schema");
        let operation_id = begin_operation(&connection).expect("operation");
        let first_claim = SourceSubjectClaim::new(
            "polar-flow",
            "account-username",
            "exact-v1",
            b"fixture-first-claim",
        );
        let first = resolve_source_subject(&connection, &first_claim).expect("first resolution");
        let transaction = connection.transaction().expect("transaction");
        persist_source_subject(&transaction, operation_id, &first).expect("subject persistence");
        transaction.commit().expect("commit");
        let changed_claim = SourceSubjectClaim::new(
            "polar-flow",
            "account-username",
            "exact-v1",
            b"fixture-changed-claim",
        );

        let error = match resolve_source_subject(&connection, &changed_claim) {
            Ok(_) => panic!("changed provider claim must not resolve"),
            Err(error) => error,
        };

        assert!(matches!(error, ImportError::SourceSubjectConflict));
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM observation_origin", [], |row| {
                    row.get::<_, i64>(0)
                })
                .expect("origin count"),
            1
        );
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM source_subject_evidence", [], |row| {
                    row.get::<_, i64>(0)
                })
                .expect("evidence count"),
            1
        );
    }

    #[test]
    fn rolls_back_new_origin_evidence_and_operation_link_with_the_visibility_transaction() {
        let directory = tempdir().expect("temporary directory");
        let database_path = directory.path().join("library.sqlite");
        let mut connection = Connection::open(database_path).expect("database");
        ensure_schema(&connection).expect("schema");
        let operation_id = begin_operation(&connection).expect("operation");
        let claim = SourceSubjectClaim::new(
            "polar-flow",
            "account-username",
            "exact-v1",
            b"fixture-private-claim",
        );
        let resolution = resolve_source_subject(&connection, &claim).expect("subject resolution");

        let transaction = connection.transaction().expect("transaction");
        persist_source_subject(&transaction, operation_id, &resolution)
            .expect("subject persistence");
        drop(transaction);

        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM observation_origin", [], |row| {
                    row.get::<_, i64>(0)
                })
                .expect("origin count"),
            0
        );
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM source_subject_evidence", [], |row| {
                    row.get::<_, i64>(0)
                })
                .expect("evidence count"),
            0
        );
        assert!(connection
            .query_row(
                "SELECT observation_origin_id IS NULL
                     FROM import_operation WHERE id = ?1",
                [operation_id],
                |row| row.get::<_, bool>(0),
            )
            .expect("operation origin state"));
    }

    #[test]
    fn rejects_empty_private_evidence_without_creating_state() {
        let directory = tempdir().expect("temporary directory");
        let database_path = directory.path().join("library.sqlite");
        let connection = Connection::open(database_path).expect("database");
        ensure_schema(&connection).expect("schema");
        let claim = SourceSubjectClaim::new("polar-flow", "account-username", "exact-v1", b"");

        let error = match resolve_source_subject(&connection, &claim) {
            Ok(_) => panic!("empty evidence must not resolve"),
            Err(error) => error,
        };

        assert!(matches!(error, ImportError::InvalidSourceSubjectClaim));
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM observation_origin", [], |row| {
                    row.get::<_, i64>(0)
                })
                .expect("origin count"),
            0
        );
    }
}
