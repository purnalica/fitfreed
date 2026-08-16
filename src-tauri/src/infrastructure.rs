use std::{
    collections::{HashMap, HashSet},
    fs::File,
    io::{self, Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};

use chrono::NaiveDate;
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use thiserror::Error;
use zip::ZipArchive;

use fitfreed_application::{
    ActivityLibraryPort, ArchiveImportPort, ImportOutcomeLibraryPort, ImportPhase,
    ImportPhaseTimings, ImportProgress, LocalePreference, LocalePreferencePort, ProfiledImport,
};
use fitfreed_domain::{
    decide_reconciliation, ArtifactClassification, ArtifactCoverageSummary, ArtifactFamilyCoverage,
    DailyActivity, ExistingObservation, ImportOperationState, ImportOutcome, ImportReport,
    ReconciliationDecision,
};

mod polar_flow;
mod source_subject;

use polar_flow::{assess_artifact, daily_activity_filename_date, SupportedArtifact};
use source_subject::{
    persist_source_subject, resolve_source_subject, SourceSubjectClaim, SourceSubjectResolution,
};

const MAX_ARCHIVE_ENTRIES: usize = 10_000;
const MAX_ENTRY_BYTES: u64 = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES: u64 = 8 * 1024 * 1024 * 1024;
const MAX_COMPRESSION_RATIO: u64 = 1_000;
const SCHEMA_VERSION: i64 = 4;
const SCHEMA_V1: &str = include_str!("../migrations/0001_initial.sql");
const SCHEMA_V2: &str = include_str!("../migrations/0002_import_ledger.sql");
const SCHEMA_V3: &str = include_str!("../migrations/0003_locale_preference.sql");
const SCHEMA_V4: &str = include_str!("../migrations/0004_source_subject.sql");
const SOURCE_PROVIDER: &str = "polar-flow";
const SOURCE_ADAPTER_VERSION: &str = "polar-flow-archive@3";
const DAILY_ACTIVITY_MAPPING_VERSION: &str = "polar-flow-daily-activity@1";

#[derive(Debug, Error)]
pub enum ImportError {
    #[error("archive input/output failure: {0}")]
    Io(#[from] io::Error),
    #[error("invalid ZIP archive: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("invalid ZIP container: {0}")]
    InvalidContainer(String),
    #[error("database failure: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("invalid supported artifact {artifact}: {reason}")]
    InvalidArtifact {
        artifact: String,
        reason: String,
        reason_code: &'static str,
    },
    #[error("unsafe archive member: {0}")]
    UnsafeMember(String),
    #[error("duplicate archive member: {0}")]
    DuplicateMember(String),
    #[error("archive resource limit exceeded: {0}")]
    ResourceLimit(String),
    #[error("injected interruption after {0} mapped artifact(s)")]
    InjectedInterruption(usize),
    #[error("injected interruption before schema migration commit")]
    InjectedMigrationInterruption,
    #[error("import cancelled")]
    Cancelled,
    #[error("library schema version {0} is newer than this application supports")]
    UnsupportedSchemaVersion(i64),
    #[error("invalid import-operation transition from {from} to {to}")]
    InvalidOperationTransition { from: String, to: String },
    #[error("could not persist import outcome after {import_error}: {persistence_error}")]
    OutcomePersistence {
        import_error: String,
        persistence_error: String,
    },
    #[error("invalid persisted import-operation state: {0}")]
    InvalidPersistedOperationState(String),
    #[error("invalid persisted artifact classification: {0}")]
    InvalidPersistedArtifactClassification(String),
    #[error("invalid persisted non-negative count in {column}: {value}")]
    InvalidPersistedCount { column: &'static str, value: i64 },
    #[error("invalid persisted locale preference: {0}")]
    InvalidPersistedLocale(String),
    #[error("invalid library correlation-key length: {0}")]
    InvalidCorrelationKeyLength(usize),
    #[error("source-subject evidence is missing or invalid")]
    InvalidSourceSubjectClaim,
    #[error("source-subject evidence does not match the verified provider origin")]
    SourceSubjectConflict,
}

pub type Result<T> = std::result::Result<T, ImportError>;

#[derive(Debug, Deserialize)]
struct PolarActivity {
    date: String,
    summary: Option<PolarSummary>,
}

#[derive(Deserialize)]
struct PolarAccountData {
    username: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarSummary {
    step_count: Option<i64>,
}

#[derive(Debug)]
struct MappedArtifact {
    locator: String,
    sha256: String,
    observation: DailyActivity,
}

struct ResolvedSourceSubject {
    artifact_locator: String,
    resolution: SourceSubjectResolution,
}

struct PersistedImportOutcome {
    operation_id: i64,
    operation_ref: String,
    state: String,
    source_provider: String,
    source_adapter_version: String,
    mapping_version: String,
    exact_repeat: bool,
    coverage_complete: bool,
    total_artifacts: i64,
    supported_artifacts: i64,
    unsupported_artifacts: i64,
    ignored_artifacts: i64,
    unrecognized_artifacts: i64,
    invalid_artifacts: i64,
    recognized_artifacts: i64,
    new_observations: i64,
    equivalent_observations: i64,
    enriched_observations: i64,
    preserved_observations: i64,
    conflicts: i64,
    canonical_history_changed: bool,
    terminal_code: Option<String>,
    recovery_note: Option<String>,
}

#[cfg(test)]
fn import_archive(
    database_path: &Path,
    archive_path: &Path,
    origin_id: &str,
) -> Result<ImportReport> {
    Ok(profile_import_archive(database_path, archive_path, origin_id)?.report)
}

pub fn import_polar_archive(database_path: &Path, archive_path: &Path) -> Result<ImportReport> {
    Ok(profile_polar_import_archive(database_path, archive_path)?.report)
}

pub fn profile_polar_import_archive(
    database_path: &Path,
    archive_path: &Path,
) -> Result<ProfiledImport> {
    let cancellation = AtomicBool::new(false);
    let mut ignore_progress = |_| {};
    profile_import_archive_with_controls(
        database_path,
        archive_path,
        None,
        None,
        &cancellation,
        &mut ignore_progress,
    )
}

#[cfg(test)]
fn import_archive_with_progress<F>(
    database_path: &Path,
    archive_path: &Path,
    origin_id: &str,
    cancellation: &AtomicBool,
    mut on_progress: F,
) -> Result<ImportReport>
where
    F: FnMut(ImportProgress),
{
    let result = profile_import_archive_with_controls(
        database_path,
        archive_path,
        Some(origin_id),
        None,
        cancellation,
        &mut on_progress,
    );

    match result {
        Ok(profiled) => {
            on_progress(ImportProgress::artifacts(
                ImportPhase::Completed,
                profiled.report.recognized_artifacts,
                profiled.report.recognized_artifacts,
            ));
            Ok(profiled.report)
        }
        Err(ImportError::Cancelled) => {
            on_progress(ImportProgress::phase(ImportPhase::Cancelled));
            Err(ImportError::Cancelled)
        }
        Err(error) => Err(error),
    }
}

pub fn import_polar_archive_with_progress<F>(
    database_path: &Path,
    archive_path: &Path,
    cancellation: &AtomicBool,
    mut on_progress: F,
) -> Result<ImportReport>
where
    F: FnMut(ImportProgress),
{
    let result = profile_import_archive_with_controls(
        database_path,
        archive_path,
        None,
        None,
        cancellation,
        &mut on_progress,
    );

    match result {
        Ok(profiled) => {
            on_progress(ImportProgress::artifacts(
                ImportPhase::Completed,
                profiled.report.recognized_artifacts,
                profiled.report.recognized_artifacts,
            ));
            Ok(profiled.report)
        }
        Err(ImportError::Cancelled) => {
            on_progress(ImportProgress::phase(ImportPhase::Cancelled));
            Err(ImportError::Cancelled)
        }
        Err(error) => Err(error),
    }
}

#[cfg(test)]
fn profile_import_archive(
    database_path: &Path,
    archive_path: &Path,
    origin_id: &str,
) -> Result<ProfiledImport> {
    let cancellation = AtomicBool::new(false);
    let mut ignore_progress = |_| {};
    profile_import_archive_with_controls(
        database_path,
        archive_path,
        Some(origin_id),
        None,
        &cancellation,
        &mut ignore_progress,
    )
}

#[cfg(test)]
fn import_archive_with_interruption(
    database_path: &Path,
    archive_path: &Path,
    origin_id: &str,
    interrupt_after: Option<usize>,
) -> Result<ImportReport> {
    let cancellation = AtomicBool::new(false);
    let mut ignore_progress = |_| {};
    Ok(profile_import_archive_with_controls(
        database_path,
        archive_path,
        Some(origin_id),
        interrupt_after,
        &cancellation,
        &mut ignore_progress,
    )?
    .report)
}

fn profile_import_archive_with_controls(
    database_path: &Path,
    archive_path: &Path,
    fixed_origin_id: Option<&str>,
    interrupt_after: Option<usize>,
    cancellation: &AtomicBool,
    on_progress: &mut dyn FnMut(ImportProgress),
) -> Result<ProfiledImport> {
    let total_started = Instant::now();
    let mut timings = ImportPhaseTimings::default();
    let database_started = Instant::now();
    let mut connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let operation_id = begin_operation(&connection)?;
    timings.database_setup_milliseconds = milliseconds(database_started.elapsed());

    let import_result = execute_import(
        &mut connection,
        operation_id,
        archive_path,
        fixed_origin_id,
        interrupt_after,
        cancellation,
        on_progress,
        &mut timings,
    );

    match import_result {
        Ok(report) => {
            timings.total_milliseconds = milliseconds(total_started.elapsed());
            Ok(ProfiledImport { report, timings })
        }
        Err(error @ ImportError::InjectedInterruption(_)) => Err(error),
        Err(error) => {
            if let Err(persistence_error) =
                persist_terminal_error(&mut connection, operation_id, &error)
            {
                return Err(ImportError::OutcomePersistence {
                    import_error: error.to_string(),
                    persistence_error: persistence_error.to_string(),
                });
            }
            Err(error)
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn execute_import(
    connection: &mut Connection,
    operation_id: i64,
    archive_path: &Path,
    fixed_origin_id: Option<&str>,
    interrupt_after: Option<usize>,
    cancellation: &AtomicBool,
    on_progress: &mut dyn FnMut(ImportProgress),
    timings: &mut ImportPhaseTimings,
) -> Result<ImportReport> {
    let fingerprint_started = Instant::now();
    let package_sha256 = sha256_file(archive_path, cancellation, on_progress)?;
    timings.fingerprint_milliseconds = milliseconds(fingerprint_started.elapsed());
    attach_package_fingerprint(connection, operation_id, &package_sha256)?;

    let lookup_started = Instant::now();
    let completed_operation =
        completed_package_operation(connection, &package_sha256, fixed_origin_id.is_none())?;
    timings.repeat_lookup_milliseconds = milliseconds(lookup_started.elapsed());
    if let Some(repeated_operation_id) = completed_operation {
        ensure_not_cancelled(cancellation)?;
        transition_operation(
            connection,
            operation_id,
            ImportOperationState::Assessing,
            ImportOperationState::Planned,
        )?;
        transition_operation(
            connection,
            operation_id,
            ImportOperationState::Planned,
            ImportOperationState::Committing,
        )?;
        on_progress(ImportProgress::phase(ImportPhase::Committing));
        let transaction_started = Instant::now();
        complete_exact_repeat(connection, operation_id, repeated_operation_id)?;
        timings.transaction_control_milliseconds = milliseconds(transaction_started.elapsed());
        return Ok(ImportReport::exact_repeat());
    }

    let validation_started = Instant::now();
    let file = File::open(archive_path)?;
    validate_central_directory_names(archive_path)?;
    let mut archive = ZipArchive::new(file)?;
    let archive_entries = archive.len();
    on_progress(ImportProgress::artifacts(
        ImportPhase::Validating,
        0,
        archive_entries,
    ));
    let processable_artifacts = validate_archive(&mut archive, cancellation, on_progress)?;
    timings.archive_validation_milliseconds = milliseconds(validation_started.elapsed());
    set_total_artifacts(connection, operation_id, archive_entries)?;
    let subject_resolution_started = Instant::now();
    let resolved_subject = if fixed_origin_id.is_none() {
        Some(resolve_polar_package_subject(
            connection,
            operation_id,
            &mut archive,
            cancellation,
        )?)
    } else {
        None
    };
    timings.read_decode_map_milliseconds += milliseconds(subject_resolution_started.elapsed());
    let origin_id = fixed_origin_id.unwrap_or_else(|| {
        resolved_subject
            .as_ref()
            .expect("automatic imports resolve a source subject")
            .resolution
            .origin_id()
    });
    transition_operation(
        connection,
        operation_id,
        ImportOperationState::Assessing,
        ImportOperationState::Planned,
    )?;

    ensure_not_cancelled(cancellation)?;
    transition_operation(
        connection,
        operation_id,
        ImportOperationState::Planned,
        ImportOperationState::Staging,
    )?;
    on_progress(ImportProgress::artifacts(
        ImportPhase::Importing,
        0,
        processable_artifacts,
    ));

    let mut mapped_artifacts = Vec::with_capacity(processable_artifacts);
    let mut first_invalid = None;
    let mut processed_artifacts = 0;
    for index in 0..archive.len() {
        ensure_not_cancelled(cancellation)?;
        let mut member = archive.by_index(index)?;
        let locator = member.name().to_owned();
        let assessment = assess_artifact(&locator);
        if assessment.classification != ArtifactClassification::Supported {
            record_artifact_coverage(
                connection,
                operation_id,
                &locator,
                assessment.family,
                assessment.classification,
                None,
                assessment.reason_code,
            )?;
            continue;
        }

        match assessment
            .supported_artifact
            .expect("supported registry entries have an executable kind")
        {
            SupportedArtifact::AccountData => {
                let was_resolved = resolved_subject
                    .as_ref()
                    .is_some_and(|subject| subject.artifact_locator == locator);
                if !was_resolved {
                    let bytes = read_bytes(&mut member, &locator, cancellation)?;
                    let artifact_sha256 = sha256_bytes(&bytes);
                    match decode_account_data(&locator, &bytes) {
                        Ok(_) => record_artifact_coverage(
                            connection,
                            operation_id,
                            &locator,
                            assessment.family,
                            assessment.classification,
                            Some(&artifact_sha256),
                            assessment.reason_code,
                        )?,
                        Err(error) => {
                            record_artifact_coverage(
                                connection,
                                operation_id,
                                &locator,
                                assessment.family,
                                ArtifactClassification::Invalid,
                                Some(&artifact_sha256),
                                "invalid-source-subject-evidence",
                            )?;
                            if first_invalid.is_none() {
                                first_invalid = Some(error);
                            }
                        }
                    }
                }
            }
            SupportedArtifact::DailyActivity => {
                let decode_started = Instant::now();
                let bytes = read_bytes(&mut member, &locator, cancellation)?;
                let artifact_sha256 = sha256_bytes(&bytes);
                let mapped = decode_activity(origin_id, &locator, &artifact_sha256, bytes);
                timings.read_decode_map_milliseconds += milliseconds(decode_started.elapsed());
                match mapped {
                    Ok(mapped) => {
                        record_artifact_coverage(
                            connection,
                            operation_id,
                            &locator,
                            assessment.family,
                            assessment.classification,
                            Some(&artifact_sha256),
                            assessment.reason_code,
                        )?;
                        mapped_artifacts.push(mapped);
                    }
                    Err(error) => {
                        let reason_code = match &error {
                            ImportError::InvalidArtifact { reason_code, .. } => *reason_code,
                            _ => "invalid-supported-artifact",
                        };
                        record_artifact_coverage(
                            connection,
                            operation_id,
                            &locator,
                            assessment.family,
                            ArtifactClassification::Invalid,
                            Some(&artifact_sha256),
                            reason_code,
                        )?;
                        if first_invalid.is_none() {
                            first_invalid = Some(error);
                        }
                    }
                }
            }
        }
        processed_artifacts += 1;
        on_progress(ImportProgress::artifacts(
            ImportPhase::Importing,
            processed_artifacts,
            processable_artifacts,
        ));
    }
    if let Some(error) =
        invalidate_duplicate_daily_activity(connection, operation_id, mapped_artifacts.as_slice())?
    {
        if first_invalid.is_none() {
            first_invalid = Some(error);
        }
    }
    refresh_operation_coverage(connection, operation_id)?;
    if let Some(error) = first_invalid {
        return Err(error);
    }

    ensure_not_cancelled(cancellation)?;
    transition_operation(
        connection,
        operation_id,
        ImportOperationState::Staging,
        ImportOperationState::Reconciling,
    )?;
    ensure_not_cancelled(cancellation)?;
    transition_operation(
        connection,
        operation_id,
        ImportOperationState::Reconciling,
        ImportOperationState::Committing,
    )?;
    on_progress(ImportProgress::artifacts(
        ImportPhase::Committing,
        mapped_artifacts.len(),
        processable_artifacts,
    ));

    let transaction_started = Instant::now();
    let transaction = connection.transaction()?;
    timings.transaction_control_milliseconds += milliseconds(transaction_started.elapsed());
    let mut report = ImportReport::assessed();
    report.recognized_artifacts = processable_artifacts;
    if !mapped_artifacts.is_empty() {
        if let Some(subject) = resolved_subject.as_ref() {
            persist_source_subject(&transaction, operation_id, &subject.resolution)?;
        }
    }
    for (index, artifact) in mapped_artifacts.iter().enumerate() {
        let reconciliation_started = Instant::now();
        reconcile(&transaction, operation_id, artifact, &mut report)?;
        timings.reconciliation_milliseconds += milliseconds(reconciliation_started.elapsed());
        if interrupt_after == Some(index + 1) {
            return Err(ImportError::InjectedInterruption(index + 1));
        }
    }

    let finalization_started = Instant::now();
    complete_operation(&transaction, operation_id, &report)?;
    transaction.commit()?;
    timings.transaction_control_milliseconds += milliseconds(finalization_started.elapsed());
    Ok(report)
}

fn resolve_polar_package_subject(
    connection: &Connection,
    operation_id: i64,
    archive: &mut ZipArchive<File>,
    cancellation: &AtomicBool,
) -> Result<ResolvedSourceSubject> {
    let mut account_indices = Vec::new();
    for index in 0..archive.len() {
        let member = archive.by_index(index)?;
        if assess_artifact(member.name()).supported_artifact == Some(SupportedArtifact::AccountData)
        {
            account_indices.push(index);
        }
    }
    if account_indices.len() != 1 {
        return Err(ImportError::InvalidSourceSubjectClaim);
    }

    let mut member = archive.by_index(account_indices[0])?;
    let artifact_locator = member.name().to_owned();
    let assessment = assess_artifact(&artifact_locator);
    let bytes = read_bytes(&mut member, &artifact_locator, cancellation)?;
    let artifact_sha256 = sha256_bytes(&bytes);
    let account = match decode_account_data(&artifact_locator, &bytes) {
        Ok(account) => account,
        Err(_) => {
            record_artifact_coverage(
                connection,
                operation_id,
                &artifact_locator,
                assessment.family,
                ArtifactClassification::Invalid,
                Some(&artifact_sha256),
                "invalid-source-subject-evidence",
            )?;
            return Err(ImportError::InvalidSourceSubjectClaim);
        }
    };
    record_artifact_coverage(
        connection,
        operation_id,
        &artifact_locator,
        assessment.family,
        assessment.classification,
        Some(&artifact_sha256),
        assessment.reason_code,
    )?;
    let claim = SourceSubjectClaim::new(
        SOURCE_PROVIDER,
        "account-username",
        "exact-v1",
        account.username.as_bytes(),
    );
    let resolution = resolve_source_subject(connection, &claim)?;
    Ok(ResolvedSourceSubject {
        artifact_locator,
        resolution,
    })
}

fn decode_account_data(artifact_locator: &str, bytes: &[u8]) -> Result<PolarAccountData> {
    let account: PolarAccountData =
        serde_json::from_slice(bytes).map_err(|_| ImportError::InvalidArtifact {
            artifact: artifact_locator.to_owned(),
            reason: "account-data root or username is invalid".to_owned(),
            reason_code: "invalid-source-subject-evidence",
        })?;
    if account.username.is_empty() {
        return Err(ImportError::InvalidArtifact {
            artifact: artifact_locator.to_owned(),
            reason: "account-data username is empty".to_owned(),
            reason_code: "invalid-source-subject-evidence",
        });
    }
    Ok(account)
}

fn milliseconds(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1_000.0
}

pub fn query_activity(database_path: &Path) -> Result<Vec<DailyActivity>> {
    query_activity_between(database_path, None, None)
}

pub fn query_activity_between(
    database_path: &Path,
    from: Option<&str>,
    through: Option<&str>,
) -> Result<Vec<DailyActivity>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let mut statement = connection.prepare(
        "SELECT origin_id, local_date, step_count
         FROM daily_activity
         WHERE (?1 IS NULL OR local_date >= ?1)
           AND (?2 IS NULL OR local_date <= ?2)
         ORDER BY local_date, origin_id",
    )?;
    let rows = statement.query_map(params![from, through], |row| {
        Ok(DailyActivity {
            origin_id: row.get(0)?,
            local_date: row.get(1)?,
            step_count: row.get(2)?,
        })
    })?;

    rows.collect::<std::result::Result<Vec<_>, _>>()
        .map_err(ImportError::from)
}

pub fn query_latest_import_outcome(database_path: &Path) -> Result<Option<ImportOutcome>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let persisted = connection
        .query_row(
            "SELECT id, operation_ref, state, source_provider, source_adapter_version,
                    mapping_version, exact_repeat, coverage_complete, total_artifacts,
                    supported_artifacts, unsupported_artifacts, ignored_artifacts,
                    unrecognized_artifacts, invalid_artifacts, recognized_artifacts,
                    new_observations, equivalent_observations, enriched_observations,
                    preserved_observations, conflicts, canonical_history_changed,
                    terminal_code, recovery_note
             FROM import_operation
             WHERE state IN ('completed', 'rejected', 'cancelled', 'failed')
             ORDER BY id DESC LIMIT 1",
            [],
            |row| {
                Ok(PersistedImportOutcome {
                    operation_id: row.get(0)?,
                    operation_ref: row.get(1)?,
                    state: row.get(2)?,
                    source_provider: row.get(3)?,
                    source_adapter_version: row.get(4)?,
                    mapping_version: row.get(5)?,
                    exact_repeat: row.get(6)?,
                    coverage_complete: row.get(7)?,
                    total_artifacts: row.get(8)?,
                    supported_artifacts: row.get(9)?,
                    unsupported_artifacts: row.get(10)?,
                    ignored_artifacts: row.get(11)?,
                    unrecognized_artifacts: row.get(12)?,
                    invalid_artifacts: row.get(13)?,
                    recognized_artifacts: row.get(14)?,
                    new_observations: row.get(15)?,
                    equivalent_observations: row.get(16)?,
                    enriched_observations: row.get(17)?,
                    preserved_observations: row.get(18)?,
                    conflicts: row.get(19)?,
                    canonical_history_changed: row.get(20)?,
                    terminal_code: row.get(21)?,
                    recovery_note: row.get(22)?,
                })
            },
        )
        .optional()?;

    persisted
        .map(|persisted| {
            let artifact_families =
                query_artifact_family_coverage(&connection, persisted.operation_id)?;
            import_outcome_from_persistence(persisted, artifact_families)
        })
        .transpose()
}

fn query_artifact_family_coverage(
    connection: &Connection,
    operation_id: i64,
) -> Result<Vec<ArtifactFamilyCoverage>> {
    let mut statement = connection.prepare(
        "SELECT artifact_family, classification, reason_code, COUNT(*)
         FROM import_artifact_coverage
         WHERE import_operation_id = ?1
         GROUP BY artifact_family, classification, reason_code
         ORDER BY CASE classification
                    WHEN 'invalid' THEN 0
                    WHEN 'unrecognized' THEN 1
                    WHEN 'unsupported' THEN 2
                    WHEN 'deliberately-ignored' THEN 3
                    WHEN 'supported' THEN 4
                    ELSE 5
                  END,
                  artifact_family IS NULL,
                  artifact_family,
                  reason_code",
    )?;
    let rows = statement.query_map([operation_id], |row| {
        Ok((
            row.get::<_, Option<String>>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, i64>(3)?,
        ))
    })?;

    rows.map(|row| {
        let (family_code, classification, reason_code, artifact_count) = row?;
        let classification = ArtifactClassification::from_code(&classification)
            .ok_or_else(|| ImportError::InvalidPersistedArtifactClassification(classification))?;
        Ok(ArtifactFamilyCoverage {
            family_code,
            classification,
            reason_code,
            artifact_count: persisted_count(artifact_count, "family_artifact_count")?,
        })
    })
    .collect()
}

fn import_outcome_from_persistence(
    persisted: PersistedImportOutcome,
    artifact_families: Vec<ArtifactFamilyCoverage>,
) -> Result<ImportOutcome> {
    let state = ImportOperationState::from_code(&persisted.state)
        .ok_or_else(|| ImportError::InvalidPersistedOperationState(persisted.state.clone()))?;
    Ok(ImportOutcome {
        operation_ref: persisted.operation_ref,
        state,
        source_provider: persisted.source_provider,
        source_adapter_version: persisted.source_adapter_version,
        mapping_version: persisted.mapping_version,
        exact_repeat: persisted.exact_repeat,
        coverage_complete: persisted.coverage_complete,
        coverage: ArtifactCoverageSummary {
            total: persisted_count(persisted.total_artifacts, "total_artifacts")?,
            supported: persisted_count(persisted.supported_artifacts, "supported_artifacts")?,
            unsupported: persisted_count(persisted.unsupported_artifacts, "unsupported_artifacts")?,
            deliberately_ignored: persisted_count(
                persisted.ignored_artifacts,
                "ignored_artifacts",
            )?,
            unrecognized: persisted_count(
                persisted.unrecognized_artifacts,
                "unrecognized_artifacts",
            )?,
            invalid: persisted_count(persisted.invalid_artifacts, "invalid_artifacts")?,
        },
        artifact_families,
        report: ImportReport {
            exact_repeat: persisted.exact_repeat,
            recognized_artifacts: persisted_count(
                persisted.recognized_artifacts,
                "recognized_artifacts",
            )?,
            new_observations: persisted_count(persisted.new_observations, "new_observations")?,
            equivalent_observations: persisted_count(
                persisted.equivalent_observations,
                "equivalent_observations",
            )?,
            enriched_observations: persisted_count(
                persisted.enriched_observations,
                "enriched_observations",
            )?,
            preserved_observations: persisted_count(
                persisted.preserved_observations,
                "preserved_observations",
            )?,
            conflicts: persisted_count(persisted.conflicts, "conflicts")?,
        },
        canonical_history_changed: persisted.canonical_history_changed,
        terminal_code: persisted.terminal_code,
        recovery_note: persisted.recovery_note,
    })
}

fn persisted_count(value: i64, column: &'static str) -> Result<usize> {
    usize::try_from(value).map_err(|_| ImportError::InvalidPersistedCount { column, value })
}

pub fn load_locale_preference(database_path: &Path) -> Result<Option<LocalePreference>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let locale = connection
        .query_row(
            "SELECT locale FROM locale_preference WHERE id = 1",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()?;
    locale
        .map(|code| {
            LocalePreference::from_code(&code).ok_or(ImportError::InvalidPersistedLocale(code))
        })
        .transpose()
}

pub fn save_locale_preference(database_path: &Path, locale: LocalePreference) -> Result<()> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    connection.execute(
        "INSERT INTO locale_preference (id, locale, updated_at_utc)
         VALUES (1, ?1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(id) DO UPDATE SET
             locale = excluded.locale,
             updated_at_utc = excluded.updated_at_utc",
        [locale.code()],
    )?;
    Ok(())
}

pub fn backup_database(source_path: &Path, backup_path: &Path) -> Result<()> {
    let source = Connection::open(source_path)?;
    ensure_schema(&source)?;
    let mut destination = Connection::open(backup_path)?;
    let backup = rusqlite::backup::Backup::new(&source, &mut destination)?;
    backup.run_to_completion(64, Duration::from_millis(5), None)?;
    Ok(())
}

pub fn recover_interrupted_imports(database_path: &Path) -> Result<usize> {
    let mut connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;

    let recovering_transaction = connection.transaction()?;
    recovering_transaction.execute(
        "UPDATE import_operation
         SET state = 'recovering',
             updated_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE state IN ('assessing', 'planned', 'staging', 'reconciling', 'committing')",
        [],
    )?;
    recovering_transaction.commit()?;

    let recovered_transaction = connection.transaction()?;
    let recovered = recovered_transaction.execute(
        "UPDATE import_operation
         SET state = 'failed',
             updated_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
             completed_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
             canonical_history_changed = 0,
             temporary_state_removed = 1,
             terminal_code = 'interrupted',
             recovery_note = 'canonical-transaction-rolled-back'
         WHERE state = 'recovering'",
        [],
    )?;
    recovered_transaction.commit()?;
    Ok(recovered)
}

fn ensure_schema(connection: &Connection) -> Result<()> {
    migrate_schema(connection, false)
}

fn migrate_schema(connection: &Connection, interrupt_before_commit: bool) -> Result<()> {
    connection.execute_batch("PRAGMA foreign_keys = ON;")?;
    let version = connection.query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))?;
    if version == SCHEMA_VERSION {
        return Ok(());
    }
    if !(0..SCHEMA_VERSION).contains(&version) {
        return Err(ImportError::UnsupportedSchemaVersion(version));
    }

    connection.execute_batch("BEGIN IMMEDIATE;")?;
    let migration = (|| {
        if version == 0 {
            connection.execute_batch(SCHEMA_V1)?;
        }
        if version < 2 {
            connection.execute_batch(SCHEMA_V2)?;
        }
        if version < 3 {
            connection.execute_batch(SCHEMA_V3)?;
        }
        connection.execute_batch(SCHEMA_V4)?;
        if interrupt_before_commit {
            return Err(ImportError::InjectedMigrationInterruption);
        }
        connection.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        connection.execute_batch("COMMIT;")?;
        Ok(())
    })();
    if migration.is_err() {
        let _ = connection.execute_batch("ROLLBACK;");
    }
    migration
}

fn begin_operation(connection: &Connection) -> Result<i64> {
    connection.execute(
        "INSERT INTO import_operation (
             operation_ref, package_sha256, state, source_provider,
             source_adapter_version, mapping_version, started_at_utc, updated_at_utc,
             completed_at_utc, exact_repeat, repeated_operation_id, coverage_complete,
             total_artifacts, supported_artifacts, unsupported_artifacts, ignored_artifacts,
             unrecognized_artifacts, invalid_artifacts, recognized_artifacts,
             new_observations, equivalent_observations, enriched_observations,
             preserved_observations, conflicts, canonical_history_changed,
             temporary_state_removed, terminal_code, recovery_note
         ) VALUES (
             lower(hex(randomblob(16))), NULL, 'assessing', ?1, ?2, ?3,
             strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
             strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL,
             0, NULL, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, NULL, NULL
         )",
        params![
            SOURCE_PROVIDER,
            SOURCE_ADAPTER_VERSION,
            DAILY_ACTIVITY_MAPPING_VERSION
        ],
    )?;
    Ok(connection.last_insert_rowid())
}

fn attach_package_fingerprint(
    connection: &Connection,
    operation_id: i64,
    package_sha256: &str,
) -> Result<()> {
    connection.execute(
        "UPDATE import_operation
         SET package_sha256 = ?2,
             updated_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?1 AND state = 'assessing'",
        params![operation_id, package_sha256],
    )?;
    Ok(())
}

fn completed_package_operation(
    connection: &Connection,
    package_sha256: &str,
    require_verified_origin: bool,
) -> Result<Option<i64>> {
    connection
        .query_row(
            "SELECT operation.id
             FROM import_operation operation
             LEFT JOIN observation_origin origin
               ON origin.id = operation.observation_origin_id
             WHERE operation.package_sha256 = ?1
               AND operation.state = 'completed'
               AND operation.coverage_complete = 1
               AND (?2 = 0 OR origin.correlation_state = 'verified')
               AND operation.source_provider = ?3
               AND operation.source_adapter_version = ?4
               AND operation.mapping_version = ?5
             ORDER BY operation.id LIMIT 1",
            params![
                package_sha256,
                require_verified_origin,
                SOURCE_PROVIDER,
                SOURCE_ADAPTER_VERSION,
                DAILY_ACTIVITY_MAPPING_VERSION
            ],
            |row| row.get(0),
        )
        .optional()
        .map_err(ImportError::from)
}

fn set_total_artifacts(
    connection: &Connection,
    operation_id: i64,
    total_artifacts: usize,
) -> Result<()> {
    connection.execute(
        "UPDATE import_operation
         SET total_artifacts = ?2,
             updated_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?1",
        params![operation_id, total_artifacts],
    )?;
    Ok(())
}

fn transition_operation(
    connection: &Connection,
    operation_id: i64,
    from: ImportOperationState,
    to: ImportOperationState,
) -> Result<()> {
    if !from.can_transition_to(to) {
        return Err(ImportError::InvalidOperationTransition {
            from: from.code().to_owned(),
            to: to.code().to_owned(),
        });
    }
    let updated = connection.execute(
        "UPDATE import_operation
         SET state = ?3,
             updated_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?1 AND state = ?2",
        params![operation_id, from.code(), to.code()],
    )?;
    if updated == 1 {
        Ok(())
    } else {
        Err(ImportError::InvalidOperationTransition {
            from: from.code().to_owned(),
            to: to.code().to_owned(),
        })
    }
}

#[allow(clippy::too_many_arguments)]
fn record_artifact_coverage(
    connection: &Connection,
    operation_id: i64,
    artifact_locator: &str,
    artifact_family: Option<&str>,
    classification: ArtifactClassification,
    source_artifact_sha256: Option<&str>,
    reason_code: &str,
) -> Result<()> {
    connection.execute(
        "INSERT INTO import_artifact_coverage (
             import_operation_id, artifact_locator, artifact_family, classification,
             source_artifact_sha256, reason_code
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            operation_id,
            artifact_locator,
            artifact_family,
            classification.code(),
            source_artifact_sha256,
            reason_code
        ],
    )?;
    Ok(())
}

fn invalidate_duplicate_daily_activity(
    connection: &Connection,
    operation_id: i64,
    mapped_artifacts: &[MappedArtifact],
) -> Result<Option<ImportError>> {
    let mut locators_by_date: HashMap<&str, Vec<&str>> = HashMap::new();
    for artifact in mapped_artifacts {
        locators_by_date
            .entry(artifact.observation.local_date.as_str())
            .or_default()
            .push(artifact.locator.as_str());
    }

    let mut duplicate_found = false;
    for locators in locators_by_date
        .values()
        .filter(|locators| locators.len() > 1)
    {
        duplicate_found = true;
        for locator in locators {
            connection.execute(
                "UPDATE import_artifact_coverage
                 SET classification = 'invalid',
                     reason_code = 'duplicate-daily-activity-date'
                 WHERE import_operation_id = ?1 AND artifact_locator = ?2",
                params![operation_id, locator],
            )?;
        }
    }

    Ok(duplicate_found.then(|| ImportError::InvalidArtifact {
        artifact: "polar-flow-daily-activity".to_owned(),
        reason: "package contains duplicate daily-activity identities".to_owned(),
        reason_code: "duplicate-daily-activity-date",
    }))
}

fn refresh_operation_coverage(connection: &Connection, operation_id: i64) -> Result<()> {
    connection.execute(
        "UPDATE import_operation
         SET supported_artifacts = (
                 SELECT COUNT(*) FROM import_artifact_coverage
                 WHERE import_operation_id = ?1 AND classification = 'supported'
             ),
             unsupported_artifacts = (
                 SELECT COUNT(*) FROM import_artifact_coverage
                 WHERE import_operation_id = ?1 AND classification = 'unsupported'
             ),
             ignored_artifacts = (
                 SELECT COUNT(*) FROM import_artifact_coverage
                 WHERE import_operation_id = ?1 AND classification = 'deliberately-ignored'
             ),
             unrecognized_artifacts = (
                 SELECT COUNT(*) FROM import_artifact_coverage
                 WHERE import_operation_id = ?1 AND classification = 'unrecognized'
             ),
             invalid_artifacts = (
                 SELECT COUNT(*) FROM import_artifact_coverage
                 WHERE import_operation_id = ?1 AND classification = 'invalid'
             ),
             recognized_artifacts = (
                 SELECT COUNT(*) FROM import_artifact_coverage
                 WHERE import_operation_id = ?1
                   AND classification IN ('supported', 'invalid')
             ),
             coverage_complete = CASE
                 WHEN state <> 'assessing' AND total_artifacts = (
                     SELECT COUNT(*) FROM import_artifact_coverage
                     WHERE import_operation_id = ?1
                 ) THEN 1
                 ELSE 0
             END,
             updated_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?1",
        [operation_id],
    )?;
    Ok(())
}

fn complete_exact_repeat(
    connection: &mut Connection,
    operation_id: i64,
    repeated_operation_id: i64,
) -> Result<()> {
    let transaction = connection.transaction()?;
    transaction.execute(
        "INSERT INTO import_artifact_coverage (
             import_operation_id, artifact_locator, artifact_family, classification,
             source_artifact_sha256, reason_code
         )
         SELECT ?1, artifact_locator, artifact_family, classification,
                source_artifact_sha256, reason_code
         FROM import_artifact_coverage
         WHERE import_operation_id = ?2",
        params![operation_id, repeated_operation_id],
    )?;
    let updated = transaction.execute(
        "UPDATE import_operation
         SET state = 'completed',
             updated_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
             completed_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
             exact_repeat = 1,
             repeated_operation_id = ?2,
             coverage_complete = 1,
             total_artifacts = source.total_artifacts,
             supported_artifacts = source.supported_artifacts,
             unsupported_artifacts = source.unsupported_artifacts,
             ignored_artifacts = source.ignored_artifacts,
             unrecognized_artifacts = source.unrecognized_artifacts,
             invalid_artifacts = source.invalid_artifacts,
             recognized_artifacts = source.recognized_artifacts,
             observation_origin_id = source.observation_origin_id,
             canonical_history_changed = 0,
             temporary_state_removed = 1
         FROM import_operation source
         WHERE import_operation.id = ?1
           AND import_operation.state = 'committing'
           AND source.id = ?2",
        params![operation_id, repeated_operation_id],
    )?;
    if updated != 1 {
        return Err(ImportError::InvalidOperationTransition {
            from: "committing".to_owned(),
            to: "completed".to_owned(),
        });
    }
    transaction.commit()?;
    Ok(())
}

fn persist_terminal_error(
    connection: &mut Connection,
    operation_id: i64,
    error: &ImportError,
) -> Result<()> {
    refresh_operation_coverage(connection, operation_id)?;
    let target = match error {
        ImportError::Cancelled => ImportOperationState::Cancelled,
        ImportError::InvalidContainer(_)
        | ImportError::Zip(_)
        | ImportError::InvalidArtifact { .. }
        | ImportError::UnsafeMember(_)
        | ImportError::DuplicateMember(_)
        | ImportError::ResourceLimit(_)
        | ImportError::InvalidSourceSubjectClaim
        | ImportError::SourceSubjectConflict => ImportOperationState::Rejected,
        _ => ImportOperationState::Failed,
    };
    let transaction = connection.transaction()?;
    let current_code = transaction.query_row(
        "SELECT state FROM import_operation WHERE id = ?1",
        [operation_id],
        |row| row.get::<_, String>(0),
    )?;
    let current = ImportOperationState::from_code(&current_code).ok_or_else(|| {
        ImportError::InvalidOperationTransition {
            from: current_code.clone(),
            to: target.code().to_owned(),
        }
    })?;
    if !current.can_transition_to(target) {
        return Err(ImportError::InvalidOperationTransition {
            from: current.code().to_owned(),
            to: target.code().to_owned(),
        });
    }
    let updated = transaction.execute(
        "UPDATE import_operation
         SET state = ?2,
             updated_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
             completed_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
             canonical_history_changed = 0,
             temporary_state_removed = 1,
             terminal_code = ?3
         WHERE id = ?1 AND state = ?4",
        params![
            operation_id,
            target.code(),
            terminal_code(error),
            current.code()
        ],
    )?;
    if updated != 1 {
        return Err(ImportError::InvalidOperationTransition {
            from: current.code().to_owned(),
            to: target.code().to_owned(),
        });
    }
    transaction.commit()?;
    Ok(())
}

fn terminal_code(error: &ImportError) -> &'static str {
    match error {
        ImportError::Io(_) => "archive-io-failure",
        ImportError::Zip(_) | ImportError::InvalidContainer(_) => "invalid-zip-container",
        ImportError::Database(_) => "database-failure",
        ImportError::InvalidArtifact { .. } => "invalid-supported-artifact",
        ImportError::UnsafeMember(_) => "unsafe-archive-member",
        ImportError::DuplicateMember(_) => "duplicate-archive-member",
        ImportError::ResourceLimit(_) => "archive-resource-limit",
        ImportError::Cancelled => "user-cancelled",
        ImportError::UnsupportedSchemaVersion(_) => "unsupported-schema-version",
        ImportError::InvalidOperationTransition { .. } => "invalid-operation-transition",
        ImportError::InjectedInterruption(_) => "interrupted",
        ImportError::InjectedMigrationInterruption => "migration-interrupted",
        ImportError::OutcomePersistence { .. } => "outcome-persistence-failure",
        ImportError::InvalidPersistedOperationState(_)
        | ImportError::InvalidPersistedArtifactClassification(_)
        | ImportError::InvalidPersistedCount { .. }
        | ImportError::InvalidPersistedLocale(_) => "invalid-persisted-import-outcome",
        ImportError::InvalidCorrelationKeyLength(_) => "invalid-library-correlation-state",
        ImportError::InvalidSourceSubjectClaim => "invalid-source-subject-evidence",
        ImportError::SourceSubjectConflict => "source-subject-confirmation-required",
    }
}

fn validate_archive(
    archive: &mut ZipArchive<File>,
    cancellation: &AtomicBool,
    on_progress: &mut dyn FnMut(ImportProgress),
) -> Result<usize> {
    if archive.len() > MAX_ARCHIVE_ENTRIES {
        return Err(ImportError::ResourceLimit(format!(
            "{} entries exceeds {MAX_ARCHIVE_ENTRIES}",
            archive.len()
        )));
    }

    let mut names = HashSet::new();
    let mut total_size = 0_u64;
    let total_entries = archive.len();
    let mut processable_artifacts = 0;
    for index in 0..archive.len() {
        ensure_not_cancelled(cancellation)?;
        let member = archive.by_index(index)?;
        let name = member.name().to_owned();
        let path = Path::new(&name);
        if member.is_dir()
            || member.is_symlink()
            || member.encrypted()
            || path.is_absolute()
            || path.components().count() != 1
            || member.enclosed_name().is_none()
        {
            return Err(ImportError::UnsafeMember(name));
        }
        if !names.insert(name.clone()) {
            return Err(ImportError::DuplicateMember(name));
        }
        if member.size() > MAX_ENTRY_BYTES {
            return Err(ImportError::ResourceLimit(format!(
                "member {name} exceeds {MAX_ENTRY_BYTES} expanded bytes"
            )));
        }
        if member.size() > 0
            && (member.compressed_size() == 0
                || member.size() / member.compressed_size() > MAX_COMPRESSION_RATIO)
        {
            return Err(ImportError::ResourceLimit(format!(
                "member {name} exceeds compression-ratio limit"
            )));
        }
        total_size = total_size.saturating_add(member.size());
        if total_size > MAX_TOTAL_BYTES {
            return Err(ImportError::ResourceLimit(format!(
                "expanded archive exceeds {MAX_TOTAL_BYTES} bytes"
            )));
        }
        if assess_artifact(&name).classification == ArtifactClassification::Supported {
            processable_artifacts += 1;
        }
        let completed = index + 1;
        if completed % 100 == 0 || completed == total_entries {
            on_progress(ImportProgress::artifacts(
                ImportPhase::Validating,
                completed,
                total_entries,
            ));
        }
    }
    Ok(processable_artifacts)
}

fn validate_central_directory_names(path: &Path) -> Result<()> {
    const EOCD_SIGNATURE: &[u8; 4] = b"PK\x05\x06";
    const ZIP64_EOCD_SIGNATURE: &[u8; 4] = b"PK\x06\x06";
    const ZIP64_LOCATOR_SIGNATURE: &[u8; 4] = b"PK\x06\x07";
    const CENTRAL_ENTRY_SIGNATURE: &[u8; 4] = b"PK\x01\x02";
    const MAX_EOCD_SEARCH: u64 = 65_557;

    let mut file = File::open(path)?;
    let file_length = file.metadata()?.len();
    let tail_length = file_length.min(MAX_EOCD_SEARCH);
    file.seek(SeekFrom::End(-(tail_length as i64)))?;
    let mut tail = vec![0_u8; tail_length as usize];
    file.read_exact(&mut tail)?;
    let eocd_index = tail
        .windows(EOCD_SIGNATURE.len())
        .rposition(|candidate| candidate == EOCD_SIGNATURE)
        .ok_or_else(|| {
            ImportError::InvalidContainer("end-of-central-directory record is missing".to_owned())
        })?;
    if tail.len() - eocd_index < 22 {
        return Err(ImportError::InvalidContainer(
            "end-of-central-directory record is truncated".to_owned(),
        ));
    }
    let eocd = &tail[eocd_index..];
    let disk_number = little_u16(eocd, 4)?;
    let central_disk = little_u16(eocd, 6)?;
    if disk_number != 0 || central_disk != 0 {
        return Err(ImportError::InvalidContainer(
            "multi-disk ZIP archives are not supported".to_owned(),
        ));
    }

    let standard_entries = little_u16(eocd, 10)? as u64;
    let standard_size = little_u32(eocd, 12)? as u64;
    let standard_offset = little_u32(eocd, 16)? as u64;
    let eocd_absolute = file_length - tail_length + eocd_index as u64;
    let (entry_count, central_size, central_offset) = if standard_entries == u16::MAX as u64
        || standard_size == u32::MAX as u64
        || standard_offset == u32::MAX as u64
    {
        if eocd_absolute < 20 {
            return Err(ImportError::InvalidContainer(
                "ZIP64 locator is missing".to_owned(),
            ));
        }
        file.seek(SeekFrom::Start(eocd_absolute - 20))?;
        let mut locator = [0_u8; 20];
        file.read_exact(&mut locator)?;
        if &locator[0..4] != ZIP64_LOCATOR_SIGNATURE {
            return Err(ImportError::InvalidContainer(
                "ZIP64 locator signature is invalid".to_owned(),
            ));
        }
        if little_u32(&locator, 4)? != 0 || little_u32(&locator, 16)? != 1 {
            return Err(ImportError::InvalidContainer(
                "multi-disk ZIP64 archives are not supported".to_owned(),
            ));
        }
        let zip64_offset = little_u64(&locator, 8)?;
        file.seek(SeekFrom::Start(zip64_offset))?;
        let mut zip64 = [0_u8; 56];
        file.read_exact(&mut zip64)?;
        if &zip64[0..4] != ZIP64_EOCD_SIGNATURE {
            return Err(ImportError::InvalidContainer(
                "ZIP64 end-of-central-directory signature is invalid".to_owned(),
            ));
        }
        if little_u32(&zip64, 16)? != 0 || little_u32(&zip64, 20)? != 0 {
            return Err(ImportError::InvalidContainer(
                "multi-disk ZIP64 archives are not supported".to_owned(),
            ));
        }
        (
            little_u64(&zip64, 32)?,
            little_u64(&zip64, 40)?,
            little_u64(&zip64, 48)?,
        )
    } else {
        (standard_entries, standard_size, standard_offset)
    };

    if entry_count > MAX_ARCHIVE_ENTRIES as u64 {
        return Err(ImportError::ResourceLimit(format!(
            "{entry_count} entries exceeds {MAX_ARCHIVE_ENTRIES}"
        )));
    }
    let central_end = central_offset.checked_add(central_size).ok_or_else(|| {
        ImportError::InvalidContainer("central-directory size overflows".to_owned())
    })?;
    if central_end > file_length {
        return Err(ImportError::InvalidContainer(
            "central directory extends beyond the archive".to_owned(),
        ));
    }

    file.seek(SeekFrom::Start(central_offset))?;
    let mut names = HashSet::new();
    for _ in 0..entry_count {
        let mut header = [0_u8; 46];
        file.read_exact(&mut header)?;
        if &header[0..4] != CENTRAL_ENTRY_SIGNATURE {
            return Err(ImportError::InvalidContainer(
                "central-directory entry signature is invalid".to_owned(),
            ));
        }
        let name_length = little_u16(&header, 28)? as usize;
        let extra_length = little_u16(&header, 30)? as u64;
        let comment_length = little_u16(&header, 32)? as u64;
        let mut name = vec![0_u8; name_length];
        file.read_exact(&mut name)?;
        if !names.insert(name.clone()) {
            return Err(ImportError::DuplicateMember(
                String::from_utf8_lossy(&name).into_owned(),
            ));
        }
        file.seek(SeekFrom::Current((extra_length + comment_length) as i64))?;
    }
    Ok(())
}

fn little_u16(bytes: &[u8], offset: usize) -> Result<u16> {
    let value = bytes
        .get(offset..offset + 2)
        .ok_or_else(|| ImportError::InvalidContainer("truncated integer field".to_owned()))?;
    Ok(u16::from_le_bytes([value[0], value[1]]))
}

fn little_u32(bytes: &[u8], offset: usize) -> Result<u32> {
    let value = bytes
        .get(offset..offset + 4)
        .ok_or_else(|| ImportError::InvalidContainer("truncated integer field".to_owned()))?;
    Ok(u32::from_le_bytes([value[0], value[1], value[2], value[3]]))
}

fn little_u64(bytes: &[u8], offset: usize) -> Result<u64> {
    let value = bytes
        .get(offset..offset + 8)
        .ok_or_else(|| ImportError::InvalidContainer("truncated integer field".to_owned()))?;
    Ok(u64::from_le_bytes([
        value[0], value[1], value[2], value[3], value[4], value[5], value[6], value[7],
    ]))
}

fn map_activity(origin_id: &str, source: PolarActivity, artifact: &str) -> Result<DailyActivity> {
    NaiveDate::parse_from_str(&source.date, "%Y-%m-%d").map_err(|error| {
        ImportError::InvalidArtifact {
            artifact: artifact.to_owned(),
            reason: format!("invalid local date: {error}"),
            reason_code: "invalid-supported-artifact",
        }
    })?;
    if daily_activity_filename_date(artifact) != Some(source.date.as_str()) {
        return Err(ImportError::InvalidArtifact {
            artifact: artifact.to_owned(),
            reason: "filename and content dates differ".to_owned(),
            reason_code: "filename-content-date-mismatch",
        });
    }
    let step_count = source.summary.and_then(|summary| summary.step_count);
    if step_count.is_some_and(|value| value < 0) {
        return Err(ImportError::InvalidArtifact {
            artifact: artifact.to_owned(),
            reason: "stepCount cannot be negative".to_owned(),
            reason_code: "invalid-supported-artifact",
        });
    }
    Ok(DailyActivity {
        origin_id: origin_id.to_owned(),
        local_date: source.date,
        step_count,
    })
}

fn decode_activity(
    origin_id: &str,
    artifact_locator: &str,
    artifact_sha256: &str,
    bytes: Vec<u8>,
) -> Result<MappedArtifact> {
    let json = String::from_utf8(bytes).map_err(|error| ImportError::InvalidArtifact {
        artifact: artifact_locator.to_owned(),
        reason: error.to_string(),
        reason_code: "invalid-supported-artifact",
    })?;
    let source: PolarActivity =
        serde_json::from_str(&json).map_err(|error| ImportError::InvalidArtifact {
            artifact: artifact_locator.to_owned(),
            reason: error.to_string(),
            reason_code: "invalid-supported-artifact",
        })?;
    let observation = map_activity(origin_id, source, artifact_locator)?;
    Ok(MappedArtifact {
        locator: artifact_locator.to_owned(),
        sha256: artifact_sha256.to_owned(),
        observation,
    })
}

fn reconcile(
    transaction: &Transaction<'_>,
    operation_id: i64,
    artifact: &MappedArtifact,
    report: &mut ImportReport,
) -> Result<()> {
    let observation = &artifact.observation;
    let existing = transaction
        .query_row(
            "SELECT step_count FROM daily_activity
             WHERE origin_id = ?1 AND local_date = ?2",
            params![observation.origin_id, observation.local_date],
            |row| row.get::<_, Option<i64>>(0),
        )
        .optional()?;

    let existing_observation =
        existing.map_or(ExistingObservation::Absent, ExistingObservation::Present);
    let decision = decide_reconciliation(existing_observation, observation.step_count);

    match decision {
        ReconciliationDecision::Create => {
            transaction.execute(
                "INSERT INTO daily_activity (origin_id, local_date, step_count)
                 VALUES (?1, ?2, ?3)",
                params![
                    observation.origin_id,
                    observation.local_date,
                    observation.step_count
                ],
            )?;
        }
        ReconciliationDecision::Equivalent | ReconciliationDecision::Preserve => {}
        ReconciliationDecision::Enrich => {
            transaction.execute(
                "UPDATE daily_activity
                 SET step_count = ?3
                 WHERE origin_id = ?1 AND local_date = ?2",
                params![
                    observation.origin_id,
                    observation.local_date,
                    observation.step_count
                ],
            )?;
        }
        ReconciliationDecision::Conflict => {
            transaction.execute(
                "INSERT INTO activity_conflict (
                     import_operation_id, origin_id, local_date, existing_step_count,
                     incoming_step_count, artifact_locator, source_record_locator,
                     mapping_version
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'json-root', ?7)",
                params![
                    operation_id,
                    observation.origin_id,
                    observation.local_date,
                    existing.flatten(),
                    observation.step_count,
                    artifact.locator,
                    DAILY_ACTIVITY_MAPPING_VERSION
                ],
            )?;
        }
    }

    transaction.execute(
        "INSERT INTO daily_activity_provenance (
             origin_id, local_date, import_operation_id, artifact_locator,
             source_record_locator, source_artifact_sha256, source_provider,
             source_adapter_version, mapping_version, reconciliation_decision,
             contributes_to_visible_state
         ) VALUES (?1, ?2, ?3, ?4, 'json-root', ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            observation.origin_id,
            observation.local_date,
            operation_id,
            artifact.locator,
            artifact.sha256,
            SOURCE_PROVIDER,
            SOURCE_ADAPTER_VERSION,
            DAILY_ACTIVITY_MAPPING_VERSION,
            reconciliation_decision_code(decision),
            matches!(
                decision,
                ReconciliationDecision::Create
                    | ReconciliationDecision::Equivalent
                    | ReconciliationDecision::Enrich
            )
        ],
    )?;
    report.record(decision);
    Ok(())
}

fn reconciliation_decision_code(decision: ReconciliationDecision) -> &'static str {
    match decision {
        ReconciliationDecision::Create => "create",
        ReconciliationDecision::Equivalent => "equivalent",
        ReconciliationDecision::Enrich => "enrich",
        ReconciliationDecision::Preserve => "preserve",
        ReconciliationDecision::Conflict => "conflict",
    }
}

fn complete_operation(
    transaction: &Transaction<'_>,
    operation_id: i64,
    report: &ImportReport,
) -> Result<()> {
    let updated = transaction.execute(
        "UPDATE import_operation
         SET state = 'completed',
             updated_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
             completed_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
             exact_repeat = ?2,
             recognized_artifacts = ?3,
             new_observations = ?4,
             equivalent_observations = ?5,
             enriched_observations = ?6,
             preserved_observations = ?7,
             conflicts = ?8,
             canonical_history_changed = CASE WHEN ?4 + ?6 > 0 THEN 1 ELSE 0 END,
             temporary_state_removed = 1
         WHERE id = ?1 AND state = 'committing' AND coverage_complete = 1",
        params![
            operation_id,
            report.exact_repeat,
            report.recognized_artifacts,
            report.new_observations,
            report.equivalent_observations,
            report.enriched_observations,
            report.preserved_observations,
            report.conflicts
        ],
    )?;
    if updated == 1 {
        Ok(())
    } else {
        Err(ImportError::InvalidOperationTransition {
            from: "committing".to_owned(),
            to: "completed".to_owned(),
        })
    }
}

fn sha256_file(
    path: &Path,
    cancellation: &AtomicBool,
    on_progress: &mut dyn FnMut(ImportProgress),
) -> Result<String> {
    let mut input = File::open(path)?;
    let total_bytes = input.metadata()?.len();
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    let mut completed_bytes = 0_u64;
    let mut last_reported_megabyte = 0_u64;
    on_progress(ImportProgress::fingerprinting(0, total_bytes));
    loop {
        ensure_not_cancelled(cancellation)?;
        let read = input.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
        completed_bytes += read as u64;
        let completed_megabyte = completed_bytes / (1024 * 1024);
        if completed_megabyte > last_reported_megabyte || completed_bytes == total_bytes {
            on_progress(ImportProgress::fingerprinting(completed_bytes, total_bytes));
            last_reported_megabyte = completed_megabyte;
        }
    }
    Ok(format!("{:x}", digest.finalize()))
}

fn read_bytes<R: Read>(
    input: &mut R,
    artifact: &str,
    cancellation: &AtomicBool,
) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        ensure_not_cancelled(cancellation)?;
        let read = input
            .read(&mut buffer)
            .map_err(|error| ImportError::InvalidArtifact {
                artifact: artifact.to_owned(),
                reason: error.to_string(),
                reason_code: "invalid-supported-artifact",
            })?;
        if read == 0 {
            break;
        }
        bytes.extend_from_slice(&buffer[..read]);
    }
    Ok(bytes)
}

fn sha256_bytes(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn ensure_not_cancelled(cancellation: &AtomicBool) -> Result<()> {
    if cancellation.load(Ordering::Relaxed) {
        Err(ImportError::Cancelled)
    } else {
        Ok(())
    }
}

pub struct SqlitePolarFlowArchiveImporter {
    database_path: PathBuf,
}

impl SqlitePolarFlowArchiveImporter {
    pub fn new(database_path: PathBuf) -> Self {
        Self { database_path }
    }
}

impl ArchiveImportPort for SqlitePolarFlowArchiveImporter {
    fn import_archive(
        &self,
        archive_path: &Path,
        cancellation: &AtomicBool,
        on_progress: &mut dyn FnMut(ImportProgress),
    ) -> std::result::Result<ImportReport, String> {
        import_polar_archive_with_progress(
            &self.database_path,
            archive_path,
            cancellation,
            on_progress,
        )
        .map_err(|error| error.to_string())
    }
}

pub struct SqliteActivityLibrary {
    database_path: PathBuf,
}

impl SqliteActivityLibrary {
    pub fn new(database_path: PathBuf) -> Self {
        Self { database_path }
    }
}

impl ActivityLibraryPort for SqliteActivityLibrary {
    fn query_activity(&self) -> std::result::Result<Vec<DailyActivity>, String> {
        query_activity(&self.database_path).map_err(|error| error.to_string())
    }
}

pub struct SqliteImportOutcomeLibrary {
    database_path: PathBuf,
}

impl SqliteImportOutcomeLibrary {
    pub fn new(database_path: PathBuf) -> Self {
        Self { database_path }
    }
}

impl ImportOutcomeLibraryPort for SqliteImportOutcomeLibrary {
    fn latest_import_outcome(&self) -> std::result::Result<Option<ImportOutcome>, String> {
        query_latest_import_outcome(&self.database_path).map_err(|error| error.to_string())
    }
}

pub struct SqliteLocalePreferences {
    database_path: PathBuf,
}

impl SqliteLocalePreferences {
    pub fn new(database_path: PathBuf) -> Self {
        Self { database_path }
    }
}

impl LocalePreferencePort for SqliteLocalePreferences {
    fn load_locale(&self) -> std::result::Result<Option<LocalePreference>, String> {
        load_locale_preference(&self.database_path).map_err(|error| error.to_string())
    }

    fn save_locale(&self, locale: LocalePreference) -> std::result::Result<(), String> {
        save_locale_preference(&self.database_path, locale).map_err(|error| error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use tempfile::TempDir;
    use zip::{write::SimpleFileOptions, ZipWriter};

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

        fn archive(&self, name: &str, entries: &[(&str, &str)]) -> PathBuf {
            let path = self.directory.path().join(name);
            let file = File::create(&path).expect("archive file");
            let mut writer = ZipWriter::new(file);
            for (entry_name, json) in entries {
                writer
                    .start_file(*entry_name, SimpleFileOptions::default())
                    .expect("ZIP entry");
                writer.write_all(json.as_bytes()).expect("entry data");
            }
            writer.finish().expect("complete ZIP");
            path
        }
    }

    #[test]
    fn imports_queries_and_repeats_without_duplicates() {
        let harness = Harness::new();
        let archive = harness.archive(
            "initial.zip",
            &[
                (
                    "activity-2026-01-02-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-02","summary":{"stepCount":4200}}"#,
                ),
                (
                    "activity-2026-01-01-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-01","summary":{"stepCount":3100}}"#,
                ),
            ],
        );

        let first = import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect("initial import");
        assert_eq!(first.new_observations, 2);
        assert_eq!(first.recognized_artifacts, 2);

        let repeated = import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect("repeat import");
        assert!(repeated.exact_repeat);
        let repeat_outcome = query_latest_import_outcome(&harness.database())
            .expect("repeat outcome query")
            .expect("repeat outcome");
        assert!(repeat_outcome.exact_repeat);
        assert_eq!(
            repeat_outcome.artifact_families,
            vec![ArtifactFamilyCoverage {
                family_code: Some("polar-flow-daily-activity".to_owned()),
                classification: ArtifactClassification::Supported,
                reason_code: "mapped".to_owned(),
                artifact_count: 2,
            }]
        );
        assert_eq!(
            query_activity(&harness.database()).expect("history"),
            vec![
                DailyActivity {
                    origin_id: "polar:synthetic".to_owned(),
                    local_date: "2026-01-01".to_owned(),
                    step_count: Some(3100),
                },
                DailyActivity {
                    origin_id: "polar:synthetic".to_owned(),
                    local_date: "2026-01-02".to_owned(),
                    step_count: Some(4200),
                },
            ]
        );
    }

    #[test]
    fn persists_complete_artifact_coverage_and_source_provenance() {
        let harness = Harness::new();
        let archive = harness.archive(
            "coverage.zip",
            &[
                (
                    "activity-2026-01-01-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-01","summary":{"stepCount":3100}}"#,
                ),
                (
                    "activity-2026-01-02-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-02","summary":{"stepCount":4200}}"#,
                ),
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"exportVersion":"synthetic","username":"fixture-primary-claim"}"#,
                ),
                (
                    "sleep_result_42-11111111-2222-4333-8444-555555555555.json",
                    r#"[]"#,
                ),
            ],
        );

        import_archive(&harness.database(), &archive, "polar:synthetic").expect("covered import");

        let connection = Connection::open(harness.database()).expect("database");
        let operation = connection
            .query_row(
                "SELECT state, source_provider, source_adapter_version, mapping_version,
                        coverage_complete, total_artifacts, supported_artifacts,
                        unsupported_artifacts, ignored_artifacts, unrecognized_artifacts,
                        invalid_artifacts
                 FROM import_operation ORDER BY id DESC LIMIT 1",
                [],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, bool>(4)?,
                        row.get::<_, i64>(5)?,
                        row.get::<_, i64>(6)?,
                        row.get::<_, i64>(7)?,
                        row.get::<_, i64>(8)?,
                        row.get::<_, i64>(9)?,
                        row.get::<_, i64>(10)?,
                    ))
                },
            )
            .expect("operation outcome");
        assert_eq!(
            operation,
            (
                "completed".to_owned(),
                SOURCE_PROVIDER.to_owned(),
                SOURCE_ADAPTER_VERSION.to_owned(),
                DAILY_ACTIVITY_MAPPING_VERSION.to_owned(),
                true,
                4,
                3,
                1,
                0,
                0,
                0,
            )
        );

        let mut coverage_statement = connection
            .prepare(
                "SELECT artifact_locator, artifact_family, classification,
                        source_artifact_sha256, reason_code
                 FROM import_artifact_coverage ORDER BY artifact_locator",
            )
            .expect("coverage query");
        let coverage = coverage_statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })
            .expect("coverage rows")
            .collect::<std::result::Result<Vec<_>, _>>()
            .expect("coverage collection");
        assert_eq!(coverage.len(), 4);
        assert_eq!(coverage[0].1, Some("polar-flow-account-data".to_owned()));
        assert_eq!(coverage[0].2, "supported");
        assert_eq!(coverage[0].4, "source-subject-claim");
        assert!(coverage[0].3.as_ref().is_some_and(|hash| hash.len() == 64));
        assert_eq!(coverage[1].2, "supported");
        assert_eq!(coverage[2].2, "supported");
        assert_eq!(coverage[3].1, Some("polar-flow-sleep-result".to_owned()));
        assert_eq!(coverage[3].2, "unsupported");
        assert_eq!(coverage[3].4, "known-family-not-yet-supported");
        assert!(coverage[1].3.as_ref().is_some_and(|hash| hash.len() == 64));

        let provenance = connection
            .query_row(
                "SELECT COUNT(*), COUNT(DISTINCT artifact_locator),
                        COUNT(DISTINCT source_artifact_sha256),
                        MIN(source_provider), MIN(source_adapter_version),
                        MIN(mapping_version), MIN(reconciliation_decision)
                 FROM daily_activity_provenance",
                [],
                |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, String>(5)?,
                        row.get::<_, String>(6)?,
                    ))
                },
            )
            .expect("provenance outcome");
        assert_eq!(
            provenance,
            (
                2,
                2,
                2,
                SOURCE_PROVIDER.to_owned(),
                SOURCE_ADAPTER_VERSION.to_owned(),
                DAILY_ACTIVITY_MAPPING_VERSION.to_owned(),
                "create".to_owned(),
            )
        );

        let outcome = query_latest_import_outcome(&harness.database())
            .expect("outcome query")
            .expect("latest outcome");
        assert_eq!(outcome.state, ImportOperationState::Completed);
        assert_eq!(outcome.source_provider, SOURCE_PROVIDER);
        assert!(outcome.coverage_complete);
        assert_eq!(outcome.coverage.total, 4);
        assert_eq!(outcome.coverage.supported, 3);
        assert_eq!(outcome.coverage.unsupported, 1);
        assert_eq!(outcome.coverage.unrecognized, 0);
        assert_eq!(
            outcome.artifact_families,
            vec![
                ArtifactFamilyCoverage {
                    family_code: Some("polar-flow-sleep-result".to_owned()),
                    classification: ArtifactClassification::Unsupported,
                    reason_code: "known-family-not-yet-supported".to_owned(),
                    artifact_count: 1,
                },
                ArtifactFamilyCoverage {
                    family_code: Some("polar-flow-account-data".to_owned()),
                    classification: ArtifactClassification::Supported,
                    reason_code: "source-subject-claim".to_owned(),
                    artifact_count: 1,
                },
                ArtifactFamilyCoverage {
                    family_code: Some("polar-flow-daily-activity".to_owned()),
                    classification: ArtifactClassification::Supported,
                    reason_code: "mapped".to_owned(),
                    artifact_count: 2,
                },
            ]
        );
        assert_eq!(outcome.report.new_observations, 2);
        assert!(outcome.canonical_history_changed);
    }

    #[test]
    fn exposes_sanitized_family_coverage_for_every_classification() {
        let harness = Harness::new();
        let archive = harness.archive(
            "every-coverage-class.zip",
            &[
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"username":"fixture-primary-claim"}"#,
                ),
                (
                    "activity-2026-01-01-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-01","summary":{"stepCount":3100}}"#,
                ),
                (
                    "activity-2026-01-02-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-02","summary":{"stepCount":-1}}"#,
                ),
                (
                    "sleep_result_42-11111111-2222-4333-8444-555555555555.json",
                    r#"[]"#,
                ),
                (
                    "profile-picture-42-LARGE-11111111-2222-4333-8444-555555555555.data",
                    "synthetic image",
                ),
                (
                    "future-family-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{}"#,
                ),
            ],
        );

        import_polar_archive(&harness.database(), &archive)
            .expect_err("invalid daily activity rejects import");

        let outcome = query_latest_import_outcome(&harness.database())
            .expect("outcome query")
            .expect("rejected outcome");
        assert_eq!(outcome.state, ImportOperationState::Rejected);
        assert!(outcome.coverage_complete);
        assert_eq!(
            outcome.artifact_families,
            vec![
                ArtifactFamilyCoverage {
                    family_code: Some("polar-flow-daily-activity".to_owned()),
                    classification: ArtifactClassification::Invalid,
                    reason_code: "invalid-supported-artifact".to_owned(),
                    artifact_count: 1,
                },
                ArtifactFamilyCoverage {
                    family_code: None,
                    classification: ArtifactClassification::Unrecognized,
                    reason_code: "unrecognized-artifact-family".to_owned(),
                    artifact_count: 1,
                },
                ArtifactFamilyCoverage {
                    family_code: Some("polar-flow-sleep-result".to_owned()),
                    classification: ArtifactClassification::Unsupported,
                    reason_code: "known-family-not-yet-supported".to_owned(),
                    artifact_count: 1,
                },
                ArtifactFamilyCoverage {
                    family_code: Some("polar-flow-profile-picture".to_owned()),
                    classification: ArtifactClassification::DeliberatelyIgnored,
                    reason_code: "mvp-excludes-profile-picture".to_owned(),
                    artifact_count: 1,
                },
                ArtifactFamilyCoverage {
                    family_code: Some("polar-flow-account-data".to_owned()),
                    classification: ArtifactClassification::Supported,
                    reason_code: "source-subject-claim".to_owned(),
                    artifact_count: 1,
                },
                ArtifactFamilyCoverage {
                    family_code: Some("polar-flow-daily-activity".to_owned()),
                    classification: ArtifactClassification::Supported,
                    reason_code: "mapped".to_owned(),
                    artifact_count: 1,
                },
            ]
        );
    }

    #[test]
    fn resolves_one_opaque_subject_across_different_overlapping_packages() {
        let harness = Harness::new();
        let first_package = harness.archive(
            "subject-first.zip",
            &[
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"exportVersion":"synthetic","username":"fixture-primary-claim"}"#,
                ),
                (
                    "activity-2026-01-01-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-01","summary":{"stepCount":3100}}"#,
                ),
            ],
        );
        let overlapping_package = harness.archive(
            "subject-overlap.zip",
            &[
                (
                    "account-data-77-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json",
                    r#"{"exportVersion":"synthetic-later","username":"fixture-primary-claim"}"#,
                ),
                (
                    "activity-2026-01-01-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json",
                    r#"{"date":"2026-01-01","summary":{"stepCount":3100}}"#,
                ),
                (
                    "activity-2026-01-02-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json",
                    r#"{"date":"2026-01-02","summary":{"stepCount":4200}}"#,
                ),
            ],
        );

        let first = import_polar_archive(&harness.database(), &first_package)
            .expect("first subject import");
        let repeated = import_polar_archive(&harness.database(), &first_package)
            .expect("exact subject repeat");
        let overlap = import_polar_archive(&harness.database(), &overlapping_package)
            .expect("overlapping subject import");
        let history = query_activity(&harness.database()).expect("history");

        assert_eq!(first.recognized_artifacts, 2);
        assert_eq!(first.new_observations, 1);
        assert!(repeated.exact_repeat);
        assert_eq!(overlap.recognized_artifacts, 3);
        assert_eq!(overlap.equivalent_observations, 1);
        assert_eq!(overlap.new_observations, 1);
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].origin_id, history[1].origin_id);
        assert_eq!(history[0].origin_id.len(), 32);
        assert!(!history[0].origin_id.contains("polar"));

        let connection = Connection::open(harness.database()).expect("database");
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
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(DISTINCT observation_origin_id)
                     FROM import_operation WHERE state = 'completed'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("operation-origin count"),
            1
        );
    }

    #[test]
    fn rejects_a_different_subject_claim_without_changing_existing_history() {
        let harness = Harness::new();
        let first_package = harness.archive(
            "subject-first.zip",
            &[
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"username":"fixture-primary-claim"}"#,
                ),
                (
                    "activity-2026-01-01-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-01","summary":{"stepCount":3100}}"#,
                ),
            ],
        );
        let conflicting_package = harness.archive(
            "subject-conflict.zip",
            &[
                (
                    "account-data-77-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json",
                    r#"{"username":"fixture-other-claim"}"#,
                ),
                (
                    "activity-2026-01-02-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json",
                    r#"{"date":"2026-01-02","summary":{"stepCount":4200}}"#,
                ),
            ],
        );
        import_polar_archive(&harness.database(), &first_package).expect("first subject import");

        let error = import_polar_archive(&harness.database(), &conflicting_package)
            .expect_err("different source subject");

        assert!(matches!(error, ImportError::SourceSubjectConflict));
        let preserved_history = query_activity(&harness.database()).expect("preserved history");
        assert_eq!(preserved_history.len(), 1);
        assert_eq!(preserved_history[0].local_date, "2026-01-01");
        assert_eq!(preserved_history[0].step_count, Some(3100));
        let outcome = query_latest_import_outcome(&harness.database())
            .expect("outcome")
            .expect("latest outcome");
        assert_eq!(outcome.state, ImportOperationState::Rejected);
        assert_eq!(
            outcome.terminal_code,
            Some("source-subject-confirmation-required".to_owned())
        );
        assert!(!outcome.canonical_history_changed);
    }

    #[test]
    fn does_not_use_a_legacy_package_fingerprint_as_source_subject_evidence() {
        let harness = Harness::new();
        let archive = harness.archive(
            "legacy-package.zip",
            &[(
                "activity-2026-01-01-11111111-2222-4333-8444-555555555555.json",
                r#"{"date":"2026-01-01","summary":{"stepCount":3100}}"#,
            )],
        );
        import_archive(&harness.database(), &archive, "polar:legacy-development")
            .expect("legacy development import");

        let error = import_polar_archive(&harness.database(), &archive)
            .expect_err("automatic import without source-subject evidence");

        assert!(matches!(error, ImportError::InvalidSourceSubjectClaim));
        let outcome = query_latest_import_outcome(&harness.database())
            .expect("outcome")
            .expect("latest outcome");
        assert_eq!(outcome.state, ImportOperationState::Rejected);
        assert!(!outcome.exact_repeat);
        assert_eq!(
            outcome.terminal_code,
            Some("invalid-source-subject-evidence".to_owned())
        );
        assert_eq!(
            query_activity(&harness.database())
                .expect("preserved legacy history")
                .len(),
            1
        );
    }

    #[test]
    fn rejects_multiple_or_malformed_account_claims_without_creating_subject_state() {
        let cases = [
            (
                "multiple-accounts.zip",
                vec![
                    (
                        "account-data-42-11111111-2222-4333-8444-555555555555.json",
                        r#"{"username":"fixture-primary-claim"}"#,
                    ),
                    (
                        "account-data-77-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json",
                        r#"{"username":"fixture-other-claim"}"#,
                    ),
                    (
                        "activity-2026-01-01-11111111-2222-4333-8444-555555555555.json",
                        r#"{"date":"2026-01-01"}"#,
                    ),
                ],
            ),
            (
                "malformed-account.zip",
                vec![
                    (
                        "account-data-42-11111111-2222-4333-8444-555555555555.json",
                        r#"{"username":42}"#,
                    ),
                    (
                        "activity-2026-01-01-11111111-2222-4333-8444-555555555555.json",
                        r#"{"date":"2026-01-01"}"#,
                    ),
                ],
            ),
        ];

        for (archive_name, entries) in cases {
            let harness = Harness::new();
            let archive = harness.archive(archive_name, &entries);

            let error = import_polar_archive(&harness.database(), &archive)
                .expect_err("invalid account claim");

            assert!(matches!(error, ImportError::InvalidSourceSubjectClaim));
            assert!(query_activity(&harness.database())
                .expect("empty history")
                .is_empty());
            let connection = Connection::open(harness.database()).expect("database");
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
            let outcome = query_latest_import_outcome(&harness.database())
                .expect("outcome")
                .expect("latest outcome");
            assert_eq!(outcome.state, ImportOperationState::Rejected);
            assert_eq!(
                outcome.terminal_code,
                Some("invalid-source-subject-evidence".to_owned())
            );
        }
    }

    #[test]
    fn exact_repeat_links_to_and_reuses_complete_prior_evidence() {
        let harness = Harness::new();
        let archive = harness.archive(
            "repeat-evidence.zip",
            &[
                (
                    "activity-2026-01-08-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-08"}"#,
                ),
                ("unknown.json", r#"{"value":1}"#),
            ],
        );

        import_archive(&harness.database(), &archive, "polar:synthetic").expect("first import");
        import_archive(&harness.database(), &archive, "polar:synthetic").expect("exact repeat");

        let connection = Connection::open(harness.database()).expect("database");
        let repeated = connection
            .query_row(
                "SELECT repeated.id, repeated.repeated_operation_id, original.id,
                        repeated.state, repeated.exact_repeat, repeated.coverage_complete,
                        repeated.total_artifacts, repeated.supported_artifacts,
                        repeated.unrecognized_artifacts,
                        (SELECT COUNT(*) FROM import_artifact_coverage coverage
                         WHERE coverage.import_operation_id = repeated.id)
                 FROM import_operation repeated
                 JOIN import_operation original ON original.id = repeated.repeated_operation_id
                 WHERE repeated.exact_repeat = 1",
                [],
                |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, bool>(4)?,
                        row.get::<_, bool>(5)?,
                        row.get::<_, i64>(6)?,
                        row.get::<_, i64>(7)?,
                        row.get::<_, i64>(8)?,
                        row.get::<_, i64>(9)?,
                    ))
                },
            )
            .expect("repeat evidence");
        assert_eq!(repeated.1, repeated.2);
        assert_eq!(repeated.3, "completed");
        assert!(repeated.4);
        assert!(repeated.5);
        assert_eq!(
            (repeated.6, repeated.7, repeated.8, repeated.9),
            (2, 1, 1, 2)
        );
    }

    #[test]
    fn reassesses_identical_bytes_after_an_adapter_contract_change() {
        let harness = Harness::new();
        let archive = harness.archive(
            "adapter-upgrade.zip",
            &[(
                "activity-2026-01-09-11111111-2222-4333-8444-555555555555.json",
                r#"{"date":"2026-01-09","summary":{"stepCount":3100}}"#,
            )],
        );
        import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect("original adapter import");
        let connection = Connection::open(harness.database()).expect("database");
        connection
            .execute(
                "UPDATE import_operation
                 SET source_adapter_version = 'polar-flow-archive@previous'
                 WHERE state = 'completed'",
                [],
            )
            .expect("simulate earlier adapter contract");

        let reassessed = import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect("current adapter reassessment");

        assert!(!reassessed.exact_repeat);
        assert_eq!(reassessed.equivalent_observations, 1);
        let outcome = query_latest_import_outcome(&harness.database())
            .expect("outcome query")
            .expect("reassessed outcome");
        assert_eq!(outcome.source_adapter_version, SOURCE_ADAPTER_VERSION);
        assert!(!outcome.exact_repeat);
    }

    #[test]
    fn rejects_a_filename_and_content_date_mismatch_without_selecting_either_date() {
        let harness = Harness::new();
        let archive = harness.archive(
            "date-mismatch.zip",
            &[(
                "activity-2026-01-10-11111111-2222-4333-8444-555555555555.json",
                r#"{"date":"2026-01-11","summary":{"stepCount":3100}}"#,
            )],
        );

        import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect_err("contradictory source dates");

        assert!(query_activity(&harness.database())
            .expect("empty history")
            .is_empty());
        let outcome = query_latest_import_outcome(&harness.database())
            .expect("outcome query")
            .expect("rejected outcome");
        assert_eq!(
            outcome.artifact_families,
            vec![ArtifactFamilyCoverage {
                family_code: Some("polar-flow-daily-activity".to_owned()),
                classification: ArtifactClassification::Invalid,
                reason_code: "filename-content-date-mismatch".to_owned(),
                artifact_count: 1,
            }]
        );
    }

    #[test]
    fn rejects_duplicate_daily_identity_independently_of_archive_order() {
        let orders = [
            [
                (
                    "activity-2026-01-12-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-12","summary":{"stepCount":3100}}"#,
                ),
                (
                    "activity-2026-01-12-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json",
                    r#"{"date":"2026-01-12","summary":{"stepCount":4200}}"#,
                ),
            ],
            [
                (
                    "activity-2026-01-12-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json",
                    r#"{"date":"2026-01-12","summary":{"stepCount":4200}}"#,
                ),
                (
                    "activity-2026-01-12-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-12","summary":{"stepCount":3100}}"#,
                ),
            ],
        ];

        for (index, entries) in orders.iter().enumerate() {
            let harness = Harness::new();
            let archive = harness.archive(&format!("duplicate-{index}.zip"), entries);

            import_archive(&harness.database(), &archive, "polar:synthetic")
                .expect_err("duplicate logical daily identity");

            assert!(query_activity(&harness.database())
                .expect("empty history")
                .is_empty());
            let outcome = query_latest_import_outcome(&harness.database())
                .expect("outcome query")
                .expect("rejected outcome");
            assert_eq!(outcome.coverage.invalid, 2);
            assert_eq!(
                outcome.artifact_families,
                vec![ArtifactFamilyCoverage {
                    family_code: Some("polar-flow-daily-activity".to_owned()),
                    classification: ArtifactClassification::Invalid,
                    reason_code: "duplicate-daily-activity-date".to_owned(),
                    artifact_count: 2,
                }]
            );
        }
    }

    #[test]
    fn accepts_the_documented_daily_activity_shape_compatibility_matrix() {
        let harness = Harness::new();
        let archive = harness.archive(
            "compatible-shapes.zip",
            &[
                (
                    "activity-2026-01-13-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-13"}"#,
                ),
                (
                    "activity-2026-01-14-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-14","summary":null}"#,
                ),
                (
                    "activity-2026-01-15-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-15","exportVersion":{"future":"shape"},"futureRoot":true,"summary":{"stepCount":null,"futureSummary":[]}}"#,
                ),
                (
                    "activity-2026-01-16-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-16","summary":{"stepCount":0}}"#,
                ),
            ],
        );

        let report = import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect("compatible structural variants");

        assert_eq!(report.new_observations, 4);
        assert_eq!(
            query_activity(&harness.database()).expect("compatible history"),
            vec![
                DailyActivity {
                    origin_id: "polar:synthetic".to_owned(),
                    local_date: "2026-01-13".to_owned(),
                    step_count: None,
                },
                DailyActivity {
                    origin_id: "polar:synthetic".to_owned(),
                    local_date: "2026-01-14".to_owned(),
                    step_count: None,
                },
                DailyActivity {
                    origin_id: "polar:synthetic".to_owned(),
                    local_date: "2026-01-15".to_owned(),
                    step_count: None,
                },
                DailyActivity {
                    origin_id: "polar:synthetic".to_owned(),
                    local_date: "2026-01-16".to_owned(),
                    step_count: Some(0),
                },
            ]
        );
    }

    #[test]
    fn rejects_incompatible_mapped_shapes_atomically() {
        let harness = Harness::new();
        let archive = harness.archive(
            "incompatible-shapes.zip",
            &[
                (
                    "activity-2026-01-17-11111111-2222-4333-8444-555555555555.json",
                    r#"[{"date":"2026-01-17"}]"#,
                ),
                (
                    "activity-2026-01-18-11111111-2222-4333-8444-555555555555.json",
                    r#"{"summary":{"stepCount":100}}"#,
                ),
                (
                    "activity-2026-01-19-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-19","summary":"unsupported"}"#,
                ),
                (
                    "activity-2026-01-20-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-20","summary":{"stepCount":1.5}}"#,
                ),
                (
                    "activity-2026-01-21-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-21","summary":{"stepCount":"100"}}"#,
                ),
            ],
        );

        import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect_err("incompatible structural variants");

        assert!(query_activity(&harness.database())
            .expect("empty history")
            .is_empty());
        let outcome = query_latest_import_outcome(&harness.database())
            .expect("outcome query")
            .expect("rejected outcome");
        assert_eq!(outcome.coverage.invalid, 5);
        assert_eq!(
            outcome.artifact_families,
            vec![ArtifactFamilyCoverage {
                family_code: Some("polar-flow-daily-activity".to_owned()),
                classification: ArtifactClassification::Invalid,
                reason_code: "invalid-supported-artifact".to_owned(),
                artifact_count: 5,
            }]
        );
    }

    #[test]
    fn profiles_first_import_and_exact_repeat_phases() {
        let harness = Harness::new();
        let archive = harness.archive(
            "profiled.zip",
            &[(
                "activity-2026-01-03-11111111-2222-4333-8444-555555555555.json",
                r#"{"date":"2026-01-03","summary":{"stepCount":5100}}"#,
            )],
        );

        let first = profile_import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect("profiled import");
        assert_eq!(first.report.new_observations, 1);
        assert!(first.timings.total_milliseconds > 0.0);
        assert!(first.timings.total_milliseconds >= first.timings.archive_validation_milliseconds);
        assert!(first.timings.read_decode_map_milliseconds > 0.0);

        let repeated = profile_import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect("profiled exact repeat");
        assert!(repeated.report.exact_repeat);
        assert_eq!(repeated.timings.archive_validation_milliseconds, 0.0);
        assert_eq!(repeated.timings.read_decode_map_milliseconds, 0.0);
        assert!(repeated.timings.fingerprint_milliseconds > 0.0);
    }

    #[test]
    fn reports_ordered_phase_progress_and_atomic_completion() {
        let harness = Harness::new();
        let archive = harness.archive(
            "progress.zip",
            &[
                (
                    "activity-2026-01-04-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-04","summary":{"stepCount":6100}}"#,
                ),
                (
                    "activity-2026-01-05-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-05","summary":{"stepCount":7200}}"#,
                ),
            ],
        );
        let cancellation = AtomicBool::new(false);
        let mut progress = Vec::new();

        let report = import_archive_with_progress(
            &harness.database(),
            &archive,
            "polar:synthetic",
            &cancellation,
            |event| progress.push(event),
        )
        .expect("observed import");

        assert_eq!(report.recognized_artifacts, 2);
        assert_eq!(
            progress.first().expect("first progress").phase,
            ImportPhase::Fingerprinting
        );
        assert!(progress
            .iter()
            .any(|event| event.phase == ImportPhase::Validating));
        assert!(progress.iter().any(|event| {
            event.phase == ImportPhase::Importing
                && event.completed_artifacts == 2
                && event.total_artifacts == Some(2)
        }));
        let committing = progress
            .iter()
            .find(|event| event.phase == ImportPhase::Committing)
            .expect("committing progress");
        assert!(!committing.cancellable);
        let completed = progress.last().expect("terminal progress");
        assert_eq!(completed.phase, ImportPhase::Completed);
        assert!(!completed.cancellable);
        assert_eq!(
            query_activity(&harness.database()).expect("history").len(),
            2
        );
    }

    #[test]
    fn cancellation_rolls_back_visible_changes_and_reports_terminal_progress() {
        let harness = Harness::new();
        let archive = harness.archive(
            "cancel.zip",
            &[
                (
                    "activity-2026-01-06-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-06","summary":{"stepCount":8300}}"#,
                ),
                (
                    "activity-2026-01-07-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-07","summary":{"stepCount":9400}}"#,
                ),
            ],
        );
        let cancellation = AtomicBool::new(false);
        let mut progress = Vec::new();

        let error = import_archive_with_progress(
            &harness.database(),
            &archive,
            "polar:synthetic",
            &cancellation,
            |event| {
                if event.phase == ImportPhase::Importing && event.completed_artifacts == 1 {
                    cancellation.store(true, Ordering::Relaxed);
                }
                progress.push(event);
            },
        )
        .expect_err("cancelled import");

        assert!(matches!(error, ImportError::Cancelled));
        assert_eq!(
            progress.last().expect("terminal progress").phase,
            ImportPhase::Cancelled
        );
        assert!(query_activity(&harness.database())
            .expect("history")
            .is_empty());

        let connection = Connection::open(harness.database()).expect("database");
        let outcome = connection
            .query_row(
                "SELECT state, coverage_complete, total_artifacts, supported_artifacts,
                        canonical_history_changed, terminal_code
                 FROM import_operation ORDER BY id DESC LIMIT 1",
                [],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, bool>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, i64>(3)?,
                        row.get::<_, bool>(4)?,
                        row.get::<_, String>(5)?,
                    ))
                },
            )
            .expect("cancelled outcome");
        assert_eq!(
            outcome,
            (
                "cancelled".to_owned(),
                false,
                2,
                1,
                false,
                "user-cancelled".to_owned()
            )
        );
    }

    #[test]
    fn reconciles_equivalent_enrichment_preservation_and_conflict() {
        let harness = Harness::new();
        let baseline = harness.archive(
            "baseline.zip",
            &[
                (
                    "activity-2026-02-01-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-02-01"}"#,
                ),
                (
                    "activity-2026-02-02-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-02-02","summary":{"stepCount":1000}}"#,
                ),
            ],
        );
        import_archive(&harness.database(), &baseline, "polar:synthetic").expect("baseline import");

        let overlap = harness.archive(
            "overlap.zip",
            &[
                (
                    "activity-2026-02-01-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json",
                    r#"{"date":"2026-02-01","summary":{"stepCount":900}}"#,
                ),
                (
                    "activity-2026-02-02-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json",
                    r#"{"date":"2026-02-02","summary":{"stepCount":1000}}"#,
                ),
                (
                    "activity-2026-02-03-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json",
                    r#"{"date":"2026-02-03","summary":{"stepCount":1500}}"#,
                ),
            ],
        );
        let overlap_report = import_archive(&harness.database(), &overlap, "polar:synthetic")
            .expect("overlap import");
        assert_eq!(overlap_report.enriched_observations, 1);
        assert_eq!(overlap_report.equivalent_observations, 1);
        assert_eq!(overlap_report.new_observations, 1);

        let competing = harness.archive(
            "competing.zip",
            &[(
                "activity-2026-02-02-12345678-90ab-4cde-8f01-234567890abc.json",
                r#"{"date":"2026-02-02","summary":{"stepCount":2000}}"#,
            )],
        );
        let conflict_report = import_archive(&harness.database(), &competing, "polar:synthetic")
            .expect("conflict import");
        assert_eq!(conflict_report.conflicts, 1);

        let less_complete = harness.archive(
            "less-complete.zip",
            &[(
                "activity-2026-02-02-fedcba98-7654-4321-8fed-cba987654321.json",
                r#"{"date":"2026-02-02"}"#,
            )],
        );
        let preserved_report =
            import_archive(&harness.database(), &less_complete, "polar:synthetic")
                .expect("less-complete import");
        assert_eq!(preserved_report.preserved_observations, 1);

        let history = query_activity(&harness.database()).expect("history");
        assert_eq!(history[0].step_count, Some(900));
        assert_eq!(history[1].step_count, Some(1000));

        let connection = Connection::open(harness.database()).expect("database");
        let mut decisions = connection
            .prepare(
                "SELECT reconciliation_decision, contributes_to_visible_state
                 FROM daily_activity_provenance ORDER BY id",
            )
            .expect("provenance decisions query")
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, bool>(1)?))
            })
            .expect("provenance decisions")
            .collect::<std::result::Result<Vec<_>, _>>()
            .expect("provenance decision collection");
        decisions.sort();
        assert_eq!(
            decisions,
            vec![
                ("conflict".to_owned(), false),
                ("create".to_owned(), true),
                ("create".to_owned(), true),
                ("create".to_owned(), true),
                ("enrich".to_owned(), true),
                ("equivalent".to_owned(), true),
                ("preserve".to_owned(), false),
            ]
        );
    }

    #[test]
    fn rolls_back_every_visible_change_after_interruption() {
        let harness = Harness::new();
        let archive = harness.archive(
            "interrupted.zip",
            &[
                (
                    "activity-2026-03-01-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-03-01","summary":{"stepCount":100}}"#,
                ),
                (
                    "activity-2026-03-02-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-03-02","summary":{"stepCount":200}}"#,
                ),
            ],
        );

        let error = import_archive_with_interruption(
            &harness.database(),
            &archive,
            "polar:synthetic",
            Some(1),
        )
        .expect_err("injected interruption");
        assert!(matches!(error, ImportError::InjectedInterruption(1)));
        assert!(query_activity(&harness.database())
            .expect("history")
            .is_empty());

        let connection = Connection::open(harness.database()).expect("database");
        let interrupted_state = connection
            .query_row(
                "SELECT state FROM import_operation ORDER BY id DESC LIMIT 1",
                [],
                |row| row.get::<_, String>(0),
            )
            .expect("interrupted state");
        assert_eq!(interrupted_state, "committing");

        assert_eq!(
            recover_interrupted_imports(&harness.database()).expect("startup recovery"),
            1
        );
        let recovery = connection
            .query_row(
                "SELECT state, terminal_code, recovery_note, canonical_history_changed
                 FROM import_operation ORDER BY id DESC LIMIT 1",
                [],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, bool>(3)?,
                    ))
                },
            )
            .expect("recovery outcome");
        assert_eq!(
            recovery,
            (
                "failed".to_owned(),
                "interrupted".to_owned(),
                "canonical-transaction-rolled-back".to_owned(),
                false,
            )
        );
        assert_eq!(
            recover_interrupted_imports(&harness.database()).expect("idempotent recovery"),
            0
        );
    }

    #[test]
    fn rejects_invalid_content_without_partial_history() {
        let harness = Harness::new();
        let archive = harness.archive(
            "invalid.zip",
            &[
                (
                    "activity-2026-04-01-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-04-01","summary":{"stepCount":100}}"#,
                ),
                (
                    "activity-2026-04-02-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"not-a-date","summary":{"stepCount":200}}"#,
                ),
            ],
        );

        import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect_err("invalid package");
        assert!(query_activity(&harness.database())
            .expect("history")
            .is_empty());

        let connection = Connection::open(harness.database()).expect("database");
        let rejected = connection
            .query_row(
                "SELECT state, coverage_complete, total_artifacts, supported_artifacts,
                        invalid_artifacts, terminal_code
                 FROM import_operation ORDER BY id DESC LIMIT 1",
                [],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, bool>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, i64>(3)?,
                        row.get::<_, i64>(4)?,
                        row.get::<_, String>(5)?,
                    ))
                },
            )
            .expect("rejected outcome");
        assert_eq!(
            rejected,
            (
                "rejected".to_owned(),
                true,
                2,
                1,
                1,
                "invalid-supported-artifact".to_owned(),
            )
        );
    }

    #[test]
    fn rejects_unsafe_archive_members() {
        let harness = Harness::new();
        let archive = harness.archive(
            "unsafe.zip",
            &[(
                "../activity-2026-05-01-11111111-2222-4333-8444-555555555555.json",
                r#"{"date":"2026-05-01","summary":{"stepCount":100}}"#,
            )],
        );

        let error = import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect_err("unsafe package");
        assert!(matches!(error, ImportError::UnsafeMember(_)));
        let connection = Connection::open(harness.database()).expect("database");
        let outcome = connection
            .query_row(
                "SELECT state, coverage_complete, terminal_code
                 FROM import_operation ORDER BY id DESC LIMIT 1",
                [],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, bool>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                },
            )
            .expect("unsafe archive outcome");
        assert_eq!(
            outcome,
            (
                "rejected".to_owned(),
                false,
                "unsafe-archive-member".to_owned(),
            )
        );
    }

    #[test]
    fn persists_archive_io_failures_without_claiming_coverage() {
        let harness = Harness::new();
        let missing_archive = harness.directory.path().join("missing.zip");

        let error = import_archive(&harness.database(), &missing_archive, "polar:synthetic")
            .expect_err("missing archive");
        assert!(matches!(error, ImportError::Io(_)));

        let connection = Connection::open(harness.database()).expect("database");
        let outcome = connection
            .query_row(
                "SELECT state, package_sha256, coverage_complete, terminal_code
                 FROM import_operation",
                [],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, bool>(2)?,
                        row.get::<_, String>(3)?,
                    ))
                },
            )
            .expect("failed outcome");
        assert_eq!(
            outcome,
            (
                "failed".to_owned(),
                None,
                false,
                "archive-io-failure".to_owned(),
            )
        );
    }

    #[test]
    fn rejects_duplicate_archive_members() {
        let harness = Harness::new();
        let archive = harness.archive(
            "duplicate.zip",
            &[
                (
                    "activity-2026-05-02-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-05-02"}"#,
                ),
                (
                    "activity-2026-05-02-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json",
                    r#"{"date":"2026-05-02"}"#,
                ),
            ],
        );
        let original = b"activity-2026-05-02-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json";
        let replacement = b"activity-2026-05-02-11111111-2222-4333-8444-555555555555.json";
        let mut bytes = std::fs::read(&archive).expect("ZIP bytes");
        for offset in 0..=bytes.len() - original.len() {
            if &bytes[offset..offset + original.len()] == original {
                bytes[offset..offset + replacement.len()].copy_from_slice(replacement);
            }
        }
        std::fs::write(&archive, bytes).expect("duplicate-name ZIP bytes");

        let error = import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect_err("duplicate package member");
        assert!(matches!(error, ImportError::DuplicateMember(_)));
    }

    #[test]
    fn rejects_extreme_compression_ratios() {
        let harness = Harness::new();
        let padding = "x".repeat(5 * 1024 * 1024);
        let content = format!(r#"{{"date":"2026-05-03","padding":"{padding}"}}"#);
        let archive = harness.archive(
            "compression-ratio.zip",
            &[(
                "activity-2026-05-03-11111111-2222-4333-8444-555555555555.json",
                &content,
            )],
        );

        let error = import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect_err("compression-ratio limit");
        assert!(matches!(error, ImportError::ResourceLimit(_)));
    }

    #[test]
    fn rejects_symbolic_link_archive_members() {
        let harness = Harness::new();
        let archive = harness.archive(
            "symlink.zip",
            &[(
                "activity-2026-05-04-11111111-2222-4333-8444-555555555555.json",
                r#"{"date":"2026-05-04"}"#,
            )],
        );
        let mut bytes = std::fs::read(&archive).expect("ZIP bytes");
        let central_offset = bytes
            .windows(4)
            .position(|candidate| candidate == b"PK\x01\x02")
            .expect("central-directory entry");
        bytes[central_offset + 5] = 3;
        let external_attributes = (0o120777_u32 << 16).to_le_bytes();
        bytes[central_offset + 38..central_offset + 42].copy_from_slice(&external_attributes);
        std::fs::write(&archive, bytes).expect("symbolic-link ZIP bytes");

        let error = import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect_err("symbolic-link package member");
        assert!(matches!(error, ImportError::UnsafeMember(_)));
    }

    #[test]
    fn filters_history_by_inclusive_local_date_range() {
        let harness = Harness::new();
        let archive = harness.archive(
            "range.zip",
            &[
                (
                    "activity-2026-06-01-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-06-01"}"#,
                ),
                (
                    "activity-2026-06-02-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json",
                    r#"{"date":"2026-06-02"}"#,
                ),
                (
                    "activity-2026-06-03-12345678-90ab-4cde-8f01-234567890abc.json",
                    r#"{"date":"2026-06-03"}"#,
                ),
            ],
        );
        import_archive(&harness.database(), &archive, "polar:synthetic").expect("range import");

        let filtered =
            query_activity_between(&harness.database(), Some("2026-06-02"), Some("2026-06-03"))
                .expect("filtered history");
        assert_eq!(
            filtered
                .iter()
                .map(|item| item.local_date.as_str())
                .collect::<Vec<_>>(),
            vec!["2026-06-02", "2026-06-03"]
        );
    }

    #[test]
    fn rolls_back_an_interrupted_schema_migration_and_recovers() {
        let harness = Harness::new();
        let database_path = harness.database();
        let connection = Connection::open(&database_path).expect("database");

        let error = migrate_schema(&connection, true).expect_err("interrupted migration");
        assert!(matches!(error, ImportError::InjectedMigrationInterruption));
        let version = connection
            .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
            .expect("schema version");
        assert_eq!(version, 0);
        let visible_tables = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master
                 WHERE type = 'table' AND name = 'daily_activity'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .expect("visible table count");
        assert_eq!(visible_tables, 0);

        migrate_schema(&connection, false).expect("recovered migration");
        let recovered_version = connection
            .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
            .expect("recovered schema version");
        assert_eq!(recovered_version, SCHEMA_VERSION);
    }

    #[test]
    fn creates_library_scoped_source_subject_state_without_inventing_an_origin() {
        let harness = Harness::new();
        let connection = Connection::open(harness.database()).expect("database");

        ensure_schema(&connection).expect("current schema");

        assert_eq!(
            connection
                .query_row(
                    "SELECT length(correlation_key) FROM library_identity WHERE id = 1",
                    [],
                    |row| { row.get::<_, i64>(0) }
                )
                .expect("library correlation key length"),
            32
        );
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM observation_origin", [], |row| {
                    row.get::<_, i64>(0)
                })
                .expect("observation-origin count"),
            0
        );
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM source_subject_evidence", [], |row| {
                    row.get::<_, i64>(0)
                })
                .expect("source-subject evidence count"),
            0
        );
    }

    #[test]
    fn migrates_version_three_history_as_unverified_and_rolls_back_interruption() {
        let harness = Harness::new();
        let database_path = harness.database();
        let connection = Connection::open(&database_path).expect("database");
        connection
            .execute_batch("PRAGMA foreign_keys = ON;")
            .expect("foreign keys");
        connection
            .execute_batch(SCHEMA_V1)
            .expect("version one schema");
        connection
            .execute_batch(SCHEMA_V2)
            .expect("version two schema");
        connection
            .execute_batch(SCHEMA_V3)
            .expect("version three schema");
        connection
            .pragma_update(None, "user_version", 3)
            .expect("version three marker");
        let operation_id = begin_operation(&connection).expect("legacy operation");
        connection
            .execute(
                "INSERT INTO daily_activity (origin_id, local_date, step_count)
                 VALUES ('polar:legacy-v3', '2025-12-29', 1234)",
                [],
            )
            .expect("legacy activity");
        connection
            .execute(
                "INSERT INTO daily_activity_provenance (
                     origin_id, local_date, import_operation_id, artifact_locator,
                     source_record_locator, source_artifact_sha256, source_provider,
                     source_adapter_version, mapping_version, reconciliation_decision,
                     contributes_to_visible_state
                 ) VALUES (
                     'polar:legacy-v3', '2025-12-29', ?1, 'legacy-v3', 'json-root',
                     NULL, 'polar-flow', 'legacy-v3', 'legacy-v3',
                     'unavailable-for-migrated-v1', 1
                 )",
                [operation_id],
            )
            .expect("legacy provenance");

        let error = migrate_schema(&connection, true).expect_err("interrupted upgrade");
        assert!(matches!(error, ImportError::InjectedMigrationInterruption));
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("retained schema version"),
            3
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master
                     WHERE type = 'table' AND name = 'library_identity'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("rolled-back table count"),
            0
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM pragma_table_info('import_operation')
                     WHERE name = 'observation_origin_id'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("rolled-back column count"),
            0
        );

        migrate_schema(&connection, false).expect("recovered upgrade");

        assert_eq!(
            connection
                .query_row(
                    "SELECT source_provider, correlation_state
                     FROM observation_origin WHERE id = 'polar:legacy-v3'",
                    [],
                    |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
                )
                .expect("legacy observation origin"),
            ("polar-flow".to_owned(), "legacy-unverified".to_owned())
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT observation_origin_id FROM import_operation WHERE id = ?1",
                    [operation_id],
                    |row| row.get::<_, String>(0),
                )
                .expect("backfilled operation origin"),
            "polar:legacy-v3"
        );
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM source_subject_evidence", [], |row| {
                    row.get::<_, i64>(0)
                })
                .expect("invented evidence count"),
            0
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT step_count FROM daily_activity
                     WHERE origin_id = 'polar:legacy-v3' AND local_date = '2025-12-29'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("preserved activity"),
            1234
        );
    }

    #[test]
    fn rejects_unversioned_database_with_incompatible_schema_objects() {
        let harness = Harness::new();
        let database_path = harness.database();
        let connection = Connection::open(&database_path).expect("database");
        connection
            .execute_batch("CREATE TABLE daily_activity (unexpected TEXT NOT NULL);")
            .expect("incompatible table");

        migrate_schema(&connection, false).expect_err("incompatible unversioned database");

        let version = connection
            .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
            .expect("schema version");
        assert_eq!(version, 0);
        let migration_tables = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master
                 WHERE type = 'table'
                   AND name IN ('activity_conflict', 'import_operation')",
                [],
                |row| row.get::<_, i64>(0),
            )
            .expect("migration table count");
        assert_eq!(migration_tables, 0);
    }

    #[test]
    fn rolls_back_an_interrupted_version_one_upgrade_and_recovers() {
        let harness = Harness::new();
        let database_path = harness.database();
        let connection = Connection::open(&database_path).expect("database");
        connection
            .execute_batch(SCHEMA_V1)
            .expect("version one schema");
        connection
            .pragma_update(None, "user_version", 1)
            .expect("version one marker");

        let error = migrate_schema(&connection, true).expect_err("interrupted upgrade");
        assert!(matches!(error, ImportError::InjectedMigrationInterruption));
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("retained schema version"),
            1
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master
                     WHERE type = 'table' AND name = 'import_artifact_coverage'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("version two table count"),
            0
        );
        connection
            .prepare("SELECT completed FROM import_operation")
            .expect("version one operation shape");

        migrate_schema(&connection, false).expect("recovered upgrade");
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("upgraded schema version"),
            SCHEMA_VERSION
        );
    }

    #[test]
    fn migrates_precontract_version_one_library_without_the_later_index() {
        let harness = Harness::new();
        let database_path = harness.database();
        let connection = Connection::open(&database_path).expect("database");
        connection
            .execute_batch(
                "CREATE TABLE daily_activity (
                     origin_id TEXT NOT NULL,
                     local_date TEXT NOT NULL,
                     step_count INTEGER,
                     provenance_sha256 TEXT NOT NULL,
                     PRIMARY KEY (origin_id, local_date)
                 );
                 CREATE TABLE activity_conflict (
                     id INTEGER PRIMARY KEY,
                     origin_id TEXT NOT NULL,
                     local_date TEXT NOT NULL,
                     existing_step_count INTEGER,
                     incoming_step_count INTEGER,
                     package_sha256 TEXT NOT NULL
                 );
                 CREATE TABLE import_operation (
                     id INTEGER PRIMARY KEY,
                     package_sha256 TEXT NOT NULL,
                     completed INTEGER NOT NULL,
                     exact_repeat INTEGER NOT NULL,
                     recognized_artifacts INTEGER NOT NULL,
                     new_observations INTEGER NOT NULL,
                     equivalent_observations INTEGER NOT NULL,
                     enriched_observations INTEGER NOT NULL,
                     preserved_observations INTEGER NOT NULL,
                     conflicts INTEGER NOT NULL
                 );
                 INSERT INTO import_operation (
                     package_sha256, completed, exact_repeat, recognized_artifacts,
                     new_observations, equivalent_observations, enriched_observations,
                     preserved_observations, conflicts
                 ) VALUES (
                     printf('%064d', 1), 1, 0, 1, 1, 0, 0, 0, 0
                 );
                 INSERT INTO daily_activity (
                     origin_id, local_date, step_count, provenance_sha256
                 ) VALUES (
                     'polar:precontract', '2025-12-30', 3210, printf('%064d', 1)
                 );
                 PRAGMA user_version = 1;",
            )
            .expect("precontract version one library");

        migrate_schema(&connection, false).expect("compatible migration");

        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("schema version"),
            SCHEMA_VERSION
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT step_count FROM daily_activity
                     WHERE origin_id = 'polar:precontract' AND local_date = '2025-12-30'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("preserved daily activity"),
            3210
        );
    }

    #[test]
    fn rolls_back_an_interrupted_version_two_upgrade_and_recovers() {
        let harness = Harness::new();
        let database_path = harness.database();
        let connection = Connection::open(&database_path).expect("database");
        connection
            .execute_batch("PRAGMA foreign_keys = ON;")
            .expect("foreign keys");
        connection
            .execute_batch(SCHEMA_V1)
            .expect("version one schema");
        connection
            .execute_batch(SCHEMA_V2)
            .expect("version two schema");
        connection
            .pragma_update(None, "user_version", 2)
            .expect("version two marker");

        let error = migrate_schema(&connection, true).expect_err("interrupted upgrade");
        assert!(matches!(error, ImportError::InjectedMigrationInterruption));
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("retained schema version"),
            2
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master
                     WHERE type = 'table' AND name = 'locale_preference'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("version three table count"),
            0
        );

        migrate_schema(&connection, false).expect("recovered upgrade");
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("upgraded schema version"),
            SCHEMA_VERSION
        );
    }

    #[test]
    fn migrates_version_one_history_without_inventing_missing_evidence() {
        let harness = Harness::new();
        let database_path = harness.database();
        let connection = Connection::open(&database_path).expect("database");
        connection
            .execute_batch("BEGIN IMMEDIATE;")
            .expect("migration transaction");
        connection
            .execute_batch(SCHEMA_V1)
            .expect("version one schema");
        connection
            .execute(
                "INSERT INTO import_operation (
                     package_sha256, completed, exact_repeat, recognized_artifacts,
                     new_observations, equivalent_observations, enriched_observations,
                     preserved_observations, conflicts
                 ) VALUES (?1, 1, 0, 1, 1, 0, 0, 0, 0)",
                params!["a".repeat(64)],
            )
            .expect("version one operation");
        connection
            .execute(
                "INSERT INTO daily_activity (
                     origin_id, local_date, step_count, provenance_sha256
                 ) VALUES ('polar:legacy', '2025-12-31', 1234, ?1)",
                params!["a".repeat(64)],
            )
            .expect("version one activity");
        connection
            .execute(
                "INSERT INTO activity_conflict (
                     origin_id, local_date, existing_step_count,
                     incoming_step_count, package_sha256
                 ) VALUES ('polar:legacy', '2025-12-31', 1234, 4321, ?1)",
                params!["a".repeat(64)],
            )
            .expect("version one conflict");
        connection
            .pragma_update(None, "user_version", 1)
            .expect("version one marker");
        connection
            .execute_batch("COMMIT;")
            .expect("version one commit");

        ensure_schema(&connection).expect("version two migration");

        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("schema version"),
            SCHEMA_VERSION
        );
        let legacy_operation = connection
            .query_row(
                "SELECT state, coverage_complete, total_artifacts, supported_artifacts,
                        source_adapter_version, mapping_version
                 FROM import_operation",
                [],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, bool>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, i64>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, String>(5)?,
                    ))
                },
            )
            .expect("migrated operation");
        assert_eq!(
            legacy_operation,
            (
                "completed".to_owned(),
                false,
                1,
                1,
                "legacy-v1-unknown".to_owned(),
                "legacy-v1-unknown".to_owned(),
            )
        );
        let migrated_provenance = connection
            .query_row(
                "SELECT reconciliation_decision, source_artifact_sha256,
                        contributes_to_visible_state
                 FROM daily_activity_provenance",
                [],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, bool>(2)?,
                    ))
                },
            )
            .expect("migrated provenance");
        assert_eq!(
            migrated_provenance,
            ("unavailable-for-migrated-v1".to_owned(), None, true)
        );
        let migrated_conflict = connection
            .query_row(
                "SELECT existing_step_count, incoming_step_count, artifact_locator,
                        source_record_locator, mapping_version
                 FROM activity_conflict",
                [],
                |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                    ))
                },
            )
            .expect("migrated conflict");
        assert_eq!(
            migrated_conflict,
            (
                1234,
                4321,
                "legacy-v1-unavailable".to_owned(),
                "legacy-v1-unavailable".to_owned(),
                "legacy-v1-unknown".to_owned(),
            )
        );
        assert_eq!(
            query_activity(&database_path).expect("migrated history"),
            vec![DailyActivity {
                origin_id: "polar:legacy".to_owned(),
                local_date: "2025-12-31".to_owned(),
                step_count: Some(1234),
            }]
        );
    }

    #[test]
    fn rejects_future_schema_without_downgrading_it() {
        let harness = Harness::new();
        let database_path = harness.database();
        let connection = Connection::open(&database_path).expect("database");
        let future_version = SCHEMA_VERSION + 1;
        connection
            .pragma_update(None, "user_version", future_version)
            .expect("future schema version");

        let error = query_activity(&database_path).expect_err("unsupported future schema");

        assert!(matches!(
            error,
            ImportError::UnsupportedSchemaVersion(version) if version == future_version
        ));
        let retained_version = connection
            .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
            .expect("retained schema version");
        assert_eq!(retained_version, future_version);
    }

    #[test]
    fn creates_a_queryable_consistent_backup() {
        let harness = Harness::new();
        let archive = harness.archive(
            "backup-source.zip",
            &[
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"username":"fixture-backup-claim"}"#,
                ),
                (
                    "activity-2026-07-01-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-07-01","summary":{"stepCount":3210}}"#,
                ),
            ],
        );
        import_polar_archive(&harness.database(), &archive).expect("source import");
        let backup_path = harness.directory.path().join("fitfreed-backup.sqlite");

        backup_database(&harness.database(), &backup_path).expect("database backup");

        assert_eq!(
            query_activity(&backup_path).expect("backup history"),
            query_activity(&harness.database()).expect("source history")
        );

        let overlap = harness.archive(
            "backup-overlap.zip",
            &[
                (
                    "account-data-77-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json",
                    r#"{"username":"fixture-backup-claim"}"#,
                ),
                (
                    "activity-2026-07-02-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json",
                    r#"{"date":"2026-07-02","summary":{"stepCount":4321}}"#,
                ),
            ],
        );
        import_polar_archive(&backup_path, &overlap).expect("backup overlap import");
        let backup_history = query_activity(&backup_path).expect("expanded backup history");
        assert_eq!(backup_history.len(), 2);
        assert_eq!(backup_history[0].origin_id, backup_history[1].origin_id);
    }

    #[test]
    fn persists_the_locale_preference_across_library_reopens() {
        let harness = Harness::new();

        assert_eq!(
            load_locale_preference(&harness.database()).expect("empty preference"),
            None
        );
        save_locale_preference(&harness.database(), LocalePreference::EsEs)
            .expect("saved preference");
        assert_eq!(
            load_locale_preference(&harness.database()).expect("reopened preference"),
            Some(LocalePreference::EsEs)
        );
        save_locale_preference(&harness.database(), LocalePreference::EnUs)
            .expect("updated preference");
        assert_eq!(
            load_locale_preference(&harness.database()).expect("updated preference query"),
            Some(LocalePreference::EnUs)
        );
    }
}
