use std::{
    cmp::Ordering as CmpOrdering,
    collections::{HashMap, HashSet},
    fmt::{Formatter, Result as FmtResult},
    fs::File,
    io::{self, Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    result::Result as StandardResult,
    sync::{
        atomic::{AtomicBool, Ordering},
        LazyLock,
    },
    time::{Duration, Instant},
};

use chrono::{DateTime, NaiveDate, NaiveDateTime, SecondsFormat, Timelike};
use regex::Regex;
use rusqlite::{
    params, types::Type, Connection, Error as SqliteError, OptionalExtension, Row, Transaction,
};
use serde::{
    de::{IgnoredAny, SeqAccess, Visitor},
    Deserialize, Deserializer,
};
use sha2::{Digest, Sha256};
use thiserror::Error;
use zip::ZipArchive;

#[cfg(test)]
use fitfreed_application::{
    query_default_recovery_overview, query_default_sleep_overview, query_default_training_overview,
    query_longitudinal_overview, query_recovery_detail, ApplicationError,
};
use fitfreed_application::{
    ActivityDateRange, ActivityLibraryPort, ArchiveImportPort, ImportOutcomeLibraryPort,
    ImportPhase, ImportPhaseTimings, ImportProgress, LocalePreference, LocalePreferencePort,
    ProfiledImport, RecoveryDateRange, RecoveryLibraryNight, RecoveryLibraryPort, SleepDateRange,
    SleepLibraryPeriod, SleepLibraryPort, TrainingDateRange, TrainingLibraryPort,
};
use fitfreed_domain::{
    decide_nightly_recovery_reconciliation, decide_reconciliation,
    decide_sleep_period_reconciliation, decide_training_session_reconciliation,
    ArtifactClassification, ArtifactCoverageSummary, ArtifactFamilyCoverage, DailyActivity,
    ExistingObservation, ImportOperationState, ImportOutcome, ImportReport, NightlyRecovery,
    ReconciliationDecision, RevisionOrder, SleepPeriod, SleepPhaseSummary, SleepScore, SleepStage,
    SleepStageTransition, SourceSpecificRecoveryAssessment, SourceSpecificRecoveryBaseline,
    SourceSpecificRecoveryGuidance, TrainingSession,
};

mod local_file;
mod polar_flow;
mod source_subject;
pub mod update;
mod update_channel;
mod update_package;
mod update_recovery;
mod update_state;

pub use update_channel::{current_update_target, HttpsUpdateChannel};
pub use update_package::{download_verified_update, UpdatePackageError, VerifiedUpdatePackage};
pub use update_recovery::{
    active_update_recovery_phase, confirm_active_update_recovery, prepare_update_recovery,
    resolve_update_recovery_watchdog_context, restore_active_update_recovery,
    transition_active_update_recovery, verify_prepared_update_recovery, ApplicationCopyPort,
    PlatformApplicationCopier, PreparedUpdateRecovery, UpdateRecoveryError,
    UpdateRecoveryPreparation, UpdateRecoveryRestoration, UpdateRecoveryWatchdogContext,
};
pub use update_state::SqliteUpdateState;

use local_file::PrivateStagingFile;
use polar_flow::{
    assess_artifact, daily_activity_filename_date, training_session_filename_start,
    SupportedArtifact,
};
use source_subject::{
    persist_source_subject, resolve_source_subject, SourceSubjectClaim, SourceSubjectResolution,
};

const MAX_ARCHIVE_ENTRIES: usize = 10_000;
const MAX_ENTRY_BYTES: u64 = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES: u64 = 8 * 1024 * 1024 * 1024;
const MAX_COMPRESSION_RATIO: u64 = 1_000;
const SCHEMA_VERSION: i64 = 9;
const SCHEMA_V1: &str = include_str!("../migrations/0001_initial.sql");
const SCHEMA_V2: &str = include_str!("../migrations/0002_import_ledger.sql");
const SCHEMA_V3: &str = include_str!("../migrations/0003_locale_preference.sql");
const SCHEMA_V4: &str = include_str!("../migrations/0004_source_subject.sql");
const SCHEMA_V5: &str = include_str!("../migrations/0005_activity_query_index.sql");
const SCHEMA_V6: &str = include_str!("../migrations/0006_training_session_summary.sql");
const SCHEMA_V7: &str = include_str!("../migrations/0007_sleep_period.sql");
const SCHEMA_V8: &str = include_str!("../migrations/0008_nightly_recovery.sql");
const SCHEMA_V9: &str = include_str!("../migrations/0009_update_state.sql");
const SOURCE_PROVIDER: &str = "polar-flow";
const SOURCE_ADAPTER_VERSION: &str = "polar-flow-archive@6";
const MAPPING_SET_VERSION: &str = "polar-flow-mapping-set@1";
const DAILY_ACTIVITY_MAPPING_VERSION: &str = "polar-flow-daily-activity@1";
const TRAINING_SESSION_MAPPING_VERSION: &str = "polar-flow-training-session@1";
const SLEEP_MAPPING_VERSION: &str = "polar-flow-sleep@1";
const NIGHTLY_RECOVERY_MAPPING_VERSION: &str = "polar-flow-nightly-recovery@1";
const NIGHTLY_RECOVERY_SCHEME: &str = "polar-nightly-recharge@1";

pub const fn library_schema_version() -> u32 {
    SCHEMA_VERSION as u32
}

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
    #[error("invalid library backup: {0}")]
    InvalidLibraryBackup(String),
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
    #[error("invalid activity library: {0}")]
    InvalidActivityLibrary(String),
    #[error("invalid training library: {0}")]
    InvalidTrainingLibrary(String),
    #[error("invalid sleep library: {0}")]
    InvalidSleepLibrary(String),
    #[error("invalid nightly recovery library: {0}")]
    InvalidNightlyRecoveryLibrary(String),
    #[error("invalid persisted non-negative count in {column}: {value}")]
    InvalidPersistedCount { column: &'static str, value: i64 },
    #[error("invalid persisted locale preference: {0}")]
    InvalidPersistedLocale(String),
    #[error("invalid persisted update state: {0}")]
    InvalidPersistedUpdateState(String),
    #[error("invalid library correlation-key length: {0}")]
    InvalidCorrelationKeyLength(usize),
    #[error("source-subject evidence is missing or invalid")]
    InvalidSourceSubjectClaim,
    #[error("source-subject evidence does not match the verified provider origin")]
    SourceSubjectConflict,
    #[error("invalid reconciliation decision for {0}")]
    InvalidReconciliationDecision(&'static str),
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

#[derive(Debug, Deserialize)]
struct PolarReference {
    id: String,
}

#[derive(Debug, Default)]
enum SourceOptional<T> {
    #[default]
    Missing,
    Present(T),
}

impl<T> SourceOptional<T> {
    fn into_option(self) -> Option<T> {
        match self {
            Self::Missing => None,
            Self::Present(value) => Some(value),
        }
    }
}

impl<'de, T> Deserialize<'de> for SourceOptional<T>
where
    T: Deserialize<'de>,
{
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        T::deserialize(deserializer).map(Self::Present)
    }
}

#[derive(Debug)]
struct ExerciseCollection(usize);

impl<'de> Deserialize<'de> for ExerciseCollection {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct ExerciseCountVisitor;

        impl<'de> Visitor<'de> for ExerciseCountVisitor {
            type Value = ExerciseCollection;

            fn expecting(&self, formatter: &mut Formatter<'_>) -> FmtResult {
                formatter.write_str("an array of training-session exercises")
            }

            fn visit_seq<A>(self, mut sequence: A) -> std::result::Result<Self::Value, A::Error>
            where
                A: SeqAccess<'de>,
            {
                let mut count = 0;
                while sequence.next_element::<IgnoredAny>()?.is_some() {
                    count += 1;
                }
                Ok(ExerciseCollection(count))
            }
        }

        deserializer.deserialize_seq(ExerciseCountVisitor)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarTrainingSession {
    identifier: PolarReference,
    created: String,
    modified: String,
    start_time: String,
    stop_time: String,
    #[serde(default)]
    timezone_offset_minutes: SourceOptional<i32>,
    duration_millis: i64,
    #[serde(default)]
    distance_meters: SourceOptional<f64>,
    #[serde(default)]
    calories: SourceOptional<i64>,
    #[serde(default)]
    hr_avg: SourceOptional<i64>,
    #[serde(default)]
    hr_max: SourceOptional<i64>,
    #[serde(default)]
    sport: SourceOptional<PolarReference>,
    #[serde(default)]
    exercises: SourceOptional<ExerciseCollection>,
}

#[derive(Debug, Deserialize)]
struct PolarSleepResultEntry {
    night: String,
    evaluation: PolarSleepEvaluation,
    #[serde(rename = "sleepResult")]
    sleep_result: PolarSleepResult,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarSleepEvaluation {
    sleep_type: String,
    sleep_span: String,
    asleep_duration: String,
    age: f64,
    analysis: PolarSleepAnalysis,
    interruptions: PolarSleepInterruptions,
    #[serde(default)]
    phase_durations: SourceOptional<PolarSleepPhaseDurations>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarSleepAnalysis {
    efficiency_percent: f64,
    continuity_index: f64,
    continuity_class: i64,
    #[serde(rename = "feedback")]
    _feedback: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarSleepInterruptions {
    total_duration: String,
    long_duration: String,
    short_duration: String,
    total_count: i64,
    long_count: i64,
    short_count: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarSleepPhaseDurations {
    wake: String,
    rem: String,
    light: String,
    deep: String,
    unknown: String,
    rem_percentage: f64,
    deep_percentage: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarSleepResult {
    hypnogram: PolarHypnogram,
    #[serde(default)]
    sleep_cycles: SourceOptional<PolarSleepCycles>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarHypnogram {
    sleep_start: String,
    sleep_end: String,
    rating: String,
    #[serde(default)]
    sleep_goal: SourceOptional<String>,
    #[serde(default)]
    battery_ran_out: SourceOptional<bool>,
    #[serde(default)]
    sleep_state_changes: SourceOptional<Vec<PolarSleepStateChange>>,
}

#[derive(Debug, Deserialize)]
struct PolarSleepCycles {
    cycles: PolarSleepCycleCollection,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarSleepCycleCollection {
    sleep_cycle_models: ExerciseCollection,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarSleepStateChange {
    offset_from_start: String,
    state: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarSleepScoreEntry {
    night: String,
    sleep_score_result: PolarSleepScoreResult,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarSleepScoreResult {
    sleep_score: f64,
    sleep_time_own_target_score: f64,
    sleep_time_recommendation_score: f64,
    continuity_score: f64,
    efficiency_score: f64,
    rem_score: f64,
    n3_score: f64,
    long_interruptions_score: f64,
    group_duration_score: f64,
    group_solidity_score: f64,
    group_refresh_score: f64,
    #[serde(default)]
    score_rate: SourceOptional<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarNightlyRecovery {
    night: String,
    mean_nightly_recovery_rri: i64,
    #[serde(default)]
    mean_nightly_recovery_rmssd: SourceOptional<i64>,
    mean_nightly_recovery_respiration_interval: i64,
    #[serde(default)]
    ans_rate: SourceOptional<i64>,
    #[serde(default)]
    ans_status: SourceOptional<f64>,
    #[serde(default)]
    recovery_indicator: SourceOptional<i64>,
    #[serde(default)]
    recovery_indicator_sub_level: SourceOptional<i64>,
    #[serde(default)]
    mean_baseline_respiration_interval: SourceOptional<i64>,
    #[serde(default)]
    mean_baseline_rmssd: SourceOptional<i64>,
    #[serde(default)]
    mean_baseline_rri: SourceOptional<i64>,
    #[serde(default)]
    sd_baseline_respiration_interval: SourceOptional<i64>,
    #[serde(default)]
    sd_baseline_rmssd: SourceOptional<i64>,
    #[serde(default)]
    sd_baseline_rri: SourceOptional<i64>,
    #[serde(default)]
    exercise_tip: SourceOptional<String>,
    #[serde(default)]
    sleep_tip: SourceOptional<String>,
    #[serde(default)]
    vitality_tip: SourceOptional<String>,
}

#[derive(Debug)]
struct MappedArtifact {
    locator: String,
    sha256: String,
    observation: DailyActivity,
}

#[derive(Debug)]
struct MappedTrainingArtifact {
    locator: String,
    sha256: String,
    source_modified_at_utc: String,
    observation: TrainingSession,
}

#[derive(Debug)]
struct MappedSleepResultArtifact {
    locator: String,
    sha256: String,
    periods: Vec<SleepPeriod>,
}

#[derive(Debug)]
struct MappedSleepScoreArtifact {
    locator: String,
    sha256: String,
    scores: Vec<(String, SleepScore)>,
}

#[derive(Debug)]
struct MappedSleepPeriod {
    result_locator: String,
    result_sha256: String,
    score_locator: Option<String>,
    score_sha256: Option<String>,
    observation: SleepPeriod,
}

#[derive(Debug)]
struct MappedNightlyRecovery {
    locator: String,
    sha256: String,
    source_record_locator: String,
    observation: NightlyRecovery,
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
    amended_observations: i64,
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

#[cfg(test)]
fn import_polar_archive_with_interruption(
    database_path: &Path,
    archive_path: &Path,
    interrupt_after: Option<usize>,
) -> Result<ImportReport> {
    let cancellation = AtomicBool::new(false);
    let mut ignore_progress = |_| {};
    Ok(profile_import_archive_with_controls(
        database_path,
        archive_path,
        None,
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
    let mut mapped_training_artifacts = Vec::new();
    let mut mapped_sleep_result_artifacts = Vec::new();
    let mut mapped_sleep_score_artifacts = Vec::new();
    let mut mapped_nightly_recoveries = Vec::new();
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
            SupportedArtifact::NightlyRecovery => {
                let decode_started = Instant::now();
                let bytes = read_bytes(&mut member, &locator, cancellation)?;
                let artifact_sha256 = sha256_bytes(&bytes);
                let mapped =
                    decode_nightly_recoveries(origin_id, &locator, &artifact_sha256, &bytes);
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
                        mapped_nightly_recoveries.extend(mapped);
                    }
                    Err(error) => {
                        record_artifact_coverage(
                            connection,
                            operation_id,
                            &locator,
                            assessment.family,
                            ArtifactClassification::Invalid,
                            Some(&artifact_sha256),
                            "invalid-supported-artifact",
                        )?;
                        if first_invalid.is_none() {
                            first_invalid = Some(error);
                        }
                    }
                }
            }
            SupportedArtifact::TrainingSession => {
                let decode_started = Instant::now();
                let bytes = read_bytes(&mut member, &locator, cancellation)?;
                let artifact_sha256 = sha256_bytes(&bytes);
                let mapped = decode_training_session(origin_id, &locator, &artifact_sha256, bytes);
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
                        mapped_training_artifacts.push(mapped);
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
            SupportedArtifact::SleepResult => {
                let decode_started = Instant::now();
                let bytes = read_bytes(&mut member, &locator, cancellation)?;
                let artifact_sha256 = sha256_bytes(&bytes);
                let mapped = decode_sleep_results(origin_id, &locator, &artifact_sha256, &bytes);
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
                        mapped_sleep_result_artifacts.push(mapped);
                    }
                    Err(error) => {
                        record_artifact_coverage(
                            connection,
                            operation_id,
                            &locator,
                            assessment.family,
                            ArtifactClassification::Invalid,
                            Some(&artifact_sha256),
                            "invalid-supported-artifact",
                        )?;
                        if first_invalid.is_none() {
                            first_invalid = Some(error);
                        }
                    }
                }
            }
            SupportedArtifact::SleepScore => {
                let decode_started = Instant::now();
                let bytes = read_bytes(&mut member, &locator, cancellation)?;
                let artifact_sha256 = sha256_bytes(&bytes);
                let mapped = decode_sleep_scores(&locator, &artifact_sha256, &bytes);
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
                        mapped_sleep_score_artifacts.push(mapped);
                    }
                    Err(error) => {
                        record_artifact_coverage(
                            connection,
                            operation_id,
                            &locator,
                            assessment.family,
                            ArtifactClassification::Invalid,
                            Some(&artifact_sha256),
                            "invalid-supported-artifact",
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
    if let Some(error) = invalidate_duplicate_training_sessions(
        connection,
        operation_id,
        mapped_training_artifacts.as_slice(),
    )? {
        if first_invalid.is_none() {
            first_invalid = Some(error);
        }
    }
    if let Some(error) = invalidate_duplicate_nightly_recoveries(
        connection,
        operation_id,
        mapped_nightly_recoveries.as_slice(),
    )? {
        if first_invalid.is_none() {
            first_invalid = Some(error);
        }
    }
    let mapped_sleep_periods = match assemble_sleep_periods(
        connection,
        operation_id,
        mapped_sleep_result_artifacts,
        mapped_sleep_score_artifacts,
    ) {
        Ok(periods) => periods,
        Err(error) => {
            if first_invalid.is_none() {
                first_invalid = Some(error);
            }
            Vec::new()
        }
    };
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
        processed_artifacts,
        processable_artifacts,
    ));

    let transaction_started = Instant::now();
    let transaction = connection.transaction()?;
    timings.transaction_control_milliseconds += milliseconds(transaction_started.elapsed());
    let mut report = ImportReport::assessed();
    report.recognized_artifacts = processable_artifacts;
    if !mapped_artifacts.is_empty()
        || !mapped_training_artifacts.is_empty()
        || !mapped_sleep_periods.is_empty()
        || !mapped_nightly_recoveries.is_empty()
    {
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
    for (training_index, artifact) in mapped_training_artifacts.iter().enumerate() {
        let reconciliation_started = Instant::now();
        reconcile_training_session(&transaction, operation_id, artifact, &mut report)?;
        timings.reconciliation_milliseconds += milliseconds(reconciliation_started.elapsed());
        if interrupt_after == Some(mapped_artifacts.len() + training_index + 1) {
            return Err(ImportError::InjectedInterruption(
                mapped_artifacts.len() + training_index + 1,
            ));
        }
    }
    for (sleep_index, period) in mapped_sleep_periods.iter().enumerate() {
        let reconciliation_started = Instant::now();
        reconcile_sleep_period(&transaction, operation_id, period, &mut report)?;
        timings.reconciliation_milliseconds += milliseconds(reconciliation_started.elapsed());
        if interrupt_after
            == Some(mapped_artifacts.len() + mapped_training_artifacts.len() + sleep_index + 1)
        {
            return Err(ImportError::InjectedInterruption(
                mapped_artifacts.len() + mapped_training_artifacts.len() + sleep_index + 1,
            ));
        }
    }
    for (recovery_index, recovery) in mapped_nightly_recoveries.iter().enumerate() {
        let reconciliation_started = Instant::now();
        reconcile_nightly_recovery(&transaction, operation_id, recovery, &mut report)?;
        timings.reconciliation_milliseconds += milliseconds(reconciliation_started.elapsed());
        if interrupt_after
            == Some(
                mapped_artifacts.len()
                    + mapped_training_artifacts.len()
                    + mapped_sleep_periods.len()
                    + recovery_index
                    + 1,
            )
        {
            return Err(ImportError::InjectedInterruption(
                mapped_artifacts.len()
                    + mapped_training_artifacts.len()
                    + mapped_sleep_periods.len()
                    + recovery_index
                    + 1,
            ));
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

pub fn query_training_sessions(database_path: &Path) -> Result<Vec<TrainingSession>> {
    query_training_between(database_path, None, None)
}

pub fn query_nightly_recoveries(database_path: &Path) -> Result<Vec<NightlyRecovery>> {
    query_nightly_recovery_between(database_path, None, None)
}

pub fn query_nightly_recovery_between(
    database_path: &Path,
    from: Option<&str>,
    through: Option<&str>,
) -> Result<Vec<NightlyRecovery>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let mut statement = connection.prepare(
        "SELECT origin_id, recovery_date,
                beat_to_beat_interval_milliseconds,
                heart_rate_variability_rmssd_milliseconds,
                breathing_interval_milliseconds,
                assessment_scheme, autonomic_charge, autonomic_status,
                overall_status, overall_sublevel, baseline_scheme,
                baseline_mean_beat_to_beat_interval_milliseconds,
                baseline_standard_deviation_beat_to_beat_interval_milliseconds,
                baseline_mean_heart_rate_variability_rmssd_milliseconds,
                baseline_standard_deviation_heart_rate_variability_rmssd_milliseconds,
                baseline_mean_breathing_interval_milliseconds,
                baseline_standard_deviation_breathing_interval_milliseconds,
                guidance_scheme, exercise_guidance, sleep_guidance, vitality_guidance
         FROM nightly_recovery
         WHERE (?1 IS NULL OR recovery_date >= ?1)
           AND (?2 IS NULL OR recovery_date <= ?2)
         ORDER BY recovery_date, origin_id",
    )?;
    let rows = statement.query_map(params![from, through], read_persisted_nightly_recovery)?;
    rows.map(|row| decode_nightly_recovery_library(row?))
        .collect()
}

pub fn query_nightly_recovery(
    database_path: &Path,
    origin_id: &str,
    recovery_date: &str,
) -> Result<Option<NightlyRecovery>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    load_nightly_recovery(&connection, origin_id, recovery_date)
}

pub fn query_recovery_bounds(database_path: &Path) -> Result<Option<RecoveryDateRange>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let (from, through) = connection.query_row(
        "SELECT MIN(recovery_date), MAX(recovery_date)
         FROM nightly_recovery",
        [],
        |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<String>>(1)?,
            ))
        },
    )?;
    match (from, through) {
        (None, None) => Ok(None),
        (Some(from), Some(through)) => Ok(Some(RecoveryDateRange { from, through })),
        _ => Err(ImportError::InvalidNightlyRecoveryLibrary(
            "recovery bounds are incomplete".to_owned(),
        )),
    }
}

pub fn query_recovery_origins(database_path: &Path) -> Result<Vec<String>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let mut statement = connection.prepare(
        "SELECT DISTINCT origin_id
         FROM nightly_recovery
         ORDER BY origin_id",
    )?;
    let rows = statement.query_map([], |row| row.get(0))?;
    rows.collect::<std::result::Result<Vec<_>, _>>()
        .map_err(ImportError::from)
}

pub fn query_recovery_library_between(
    database_path: &Path,
    from: Option<&str>,
    through: Option<&str>,
) -> Result<Vec<RecoveryLibraryNight>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let mut statement = connection.prepare(
        "SELECT origin_id, recovery_date,
                beat_to_beat_interval_milliseconds,
                heart_rate_variability_rmssd_milliseconds,
                breathing_interval_milliseconds,
                assessment_scheme, autonomic_charge, autonomic_status,
                overall_status, overall_sublevel,
                baseline_scheme IS NOT NULL,
                guidance_scheme IS NOT NULL
         FROM nightly_recovery
         WHERE (?1 IS NULL OR recovery_date >= ?1)
           AND (?2 IS NULL OR recovery_date <= ?2)
         ORDER BY recovery_date, origin_id",
    )?;
    let rows = statement.query_map(params![from, through], |row| {
        Ok(PersistedRecoveryLibraryNight {
            origin_id: row.get(0)?,
            recovery_date: row.get(1)?,
            beat_to_beat_interval_milliseconds: row.get(2)?,
            heart_rate_variability_rmssd_milliseconds: row.get(3)?,
            breathing_interval_milliseconds: row.get(4)?,
            assessment_scheme: row.get(5)?,
            autonomic_charge: row.get(6)?,
            autonomic_status: row.get(7)?,
            overall_status: row.get(8)?,
            overall_sublevel: row.get(9)?,
            source_baseline_available: row.get(10)?,
            source_guidance_available: row.get(11)?,
        })
    })?;
    rows.map(|row| decode_recovery_library_night(row?))
        .collect()
}

pub fn query_sleep_periods(database_path: &Path) -> Result<Vec<SleepPeriod>> {
    query_sleep_between(database_path, None, None)
}

pub fn query_sleep_bounds(database_path: &Path) -> Result<Option<SleepDateRange>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let (from, through) = connection.query_row(
        "SELECT MIN(sleep_date), MAX(sleep_date)
         FROM sleep_period",
        [],
        |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<String>>(1)?,
            ))
        },
    )?;
    match (from, through) {
        (None, None) => Ok(None),
        (Some(from), Some(through)) => Ok(Some(SleepDateRange { from, through })),
        _ => Err(ImportError::InvalidSleepLibrary(
            "sleep bounds are incomplete".to_owned(),
        )),
    }
}

pub fn query_sleep_origins(database_path: &Path) -> Result<Vec<String>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let mut statement = connection.prepare(
        "SELECT DISTINCT origin_id
         FROM sleep_period
         ORDER BY origin_id",
    )?;
    let rows = statement.query_map([], |row| row.get(0))?;
    rows.collect::<std::result::Result<Vec<_>, _>>()
        .map_err(ImportError::from)
}

pub fn query_sleep_between(
    database_path: &Path,
    from: Option<&str>,
    through: Option<&str>,
) -> Result<Vec<SleepPeriod>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let identities = {
        let mut statement = connection.prepare(
            "SELECT origin_id, sleep_date
             FROM sleep_period
             WHERE (?1 IS NULL OR sleep_date >= ?1)
               AND (?2 IS NULL OR sleep_date <= ?2)
             ORDER BY sleep_date, origin_id",
        )?;
        let rows = statement.query_map(params![from, through], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        rows.collect::<std::result::Result<Vec<_>, _>>()?
    };
    identities
        .into_iter()
        .map(|(origin_id, sleep_date)| {
            load_sleep_period(&connection, &origin_id, &sleep_date)?.ok_or_else(|| {
                ImportError::InvalidSleepLibrary(
                    "sleep identity disappeared during a local read".to_owned(),
                )
            })
        })
        .collect()
}

pub fn query_sleep_library_between(
    database_path: &Path,
    from: Option<&str>,
    through: Option<&str>,
) -> Result<Vec<SleepLibraryPeriod>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let mut statement = connection.prepare(
        "SELECT origin_id, sleep_date, started_at, ended_at,
                span_milliseconds, asleep_milliseconds,
                interruption_milliseconds, long_interruption_milliseconds,
                short_interruption_milliseconds, interruption_count,
                long_interruption_count, short_interruption_count,
                efficiency_percent, continuity_index, continuity_class,
                sleep_goal_milliseconds, self_reported_rating, cycle_count,
                recording_ended_by_power_loss, phase_wake_milliseconds,
                phase_rem_milliseconds, phase_light_milliseconds,
                phase_deep_milliseconds, phase_unrecognized_milliseconds,
                stage_timeline_available, score_overall,
                score_own_target_duration, score_recommended_duration,
                score_continuity, score_efficiency, score_rem, score_deep,
                score_long_interruptions, score_duration, score_solidity,
                score_regeneration, score_relative_rating
         FROM sleep_period
         WHERE (?1 IS NULL OR sleep_date >= ?1)
           AND (?2 IS NULL OR sleep_date <= ?2)
         ORDER BY sleep_date, origin_id",
    )?;
    let rows = statement.query_map(params![from, through], read_persisted_sleep_period)?;
    rows.map(|row| decode_sleep_library_period(row?)).collect()
}

pub fn query_sleep_period(
    database_path: &Path,
    origin_id: &str,
    sleep_date: &str,
) -> Result<Option<SleepPeriod>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    load_sleep_period(&connection, origin_id, sleep_date)
}

pub fn query_training_bounds(database_path: &Path) -> Result<Option<TrainingDateRange>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let (from, through) = connection.query_row(
        "SELECT substr(MIN(started_at_local), 1, 10),
                substr(MAX(started_at_local), 1, 10)
         FROM training_session",
        [],
        |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<String>>(1)?,
            ))
        },
    )?;
    match (from, through) {
        (None, None) => Ok(None),
        (Some(from), Some(through)) => Ok(Some(TrainingDateRange { from, through })),
        _ => Err(ImportError::InvalidTrainingLibrary(
            "training bounds are incomplete".to_owned(),
        )),
    }
}

pub fn query_training_origins(database_path: &Path) -> Result<Vec<String>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let mut statement = connection.prepare(
        "SELECT DISTINCT origin_id
         FROM training_session
         ORDER BY origin_id",
    )?;
    let rows = statement.query_map([], |row| row.get(0))?;
    rows.collect::<std::result::Result<Vec<_>, _>>()
        .map_err(ImportError::from)
}

pub fn query_training_between(
    database_path: &Path,
    from: Option<&str>,
    through: Option<&str>,
) -> Result<Vec<TrainingSession>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let mut statement = connection.prepare(
        "SELECT origin_id, session_id, started_at_local, stopped_at_local,
                utc_offset_minutes, duration_milliseconds, distance_meters,
                energy_kilocalories, average_heart_rate_bpm, maximum_heart_rate_bpm,
                sport_ref, exercise_count
         FROM training_session
         WHERE (?1 IS NULL OR started_at_local >= ?1 || 'T')
           AND (?2 IS NULL OR started_at_local <= ?2 || 'T23:59:59.999999999')
         ORDER BY started_at_local, origin_id, session_id",
    )?;
    let rows = statement.query_map(params![from, through], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, Option<i32>>(4)?,
            row.get::<_, i64>(5)?,
            row.get::<_, Option<f64>>(6)?,
            row.get::<_, Option<i64>>(7)?,
            row.get::<_, Option<i64>>(8)?,
            row.get::<_, Option<i64>>(9)?,
            row.get::<_, Option<String>>(10)?,
            row.get::<_, Option<i64>>(11)?,
        ))
    })?;

    rows.map(|row| {
        let (
            origin_id,
            session_id,
            started_at_local,
            stopped_at_local,
            utc_offset_minutes,
            duration_milliseconds,
            distance_meters,
            energy_kilocalories,
            average_heart_rate_bpm,
            maximum_heart_rate_bpm,
            sport_ref,
            exercise_count,
        ) = row?;
        let exercise_count = exercise_count
            .map(|count| persisted_count(count, "exercise_count"))
            .transpose()?;
        Ok(TrainingSession {
            origin_id,
            session_id,
            started_at_local,
            stopped_at_local,
            utc_offset_minutes,
            duration_milliseconds,
            distance_meters,
            energy_kilocalories,
            average_heart_rate_bpm,
            maximum_heart_rate_bpm,
            sport_ref,
            exercise_count,
        })
    })
    .collect()
}

pub fn query_activity_bounds(database_path: &Path) -> Result<Option<ActivityDateRange>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let (from, through) = connection.query_row(
        "SELECT MIN(local_date), MAX(local_date) FROM daily_activity",
        [],
        |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<String>>(1)?,
            ))
        },
    )?;
    match (from, through) {
        (None, None) => Ok(None),
        (Some(from), Some(through)) => Ok(Some(ActivityDateRange { from, through })),
        _ => Err(ImportError::InvalidActivityLibrary(
            "activity bounds are incomplete".to_owned(),
        )),
    }
}

pub fn query_activity_origins(database_path: &Path) -> Result<Vec<String>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let mut statement = connection.prepare(
        "SELECT DISTINCT origin_id
         FROM daily_activity
         ORDER BY origin_id",
    )?;
    let rows = statement.query_map([], |row| row.get(0))?;
    rows.collect::<std::result::Result<Vec<_>, _>>()
        .map_err(ImportError::from)
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
                    amended_observations, preserved_observations, conflicts,
                    canonical_history_changed, terminal_code, recovery_note
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
                    amended_observations: row.get(18)?,
                    preserved_observations: row.get(19)?,
                    conflicts: row.get(20)?,
                    canonical_history_changed: row.get(21)?,
                    terminal_code: row.get(22)?,
                    recovery_note: row.get(23)?,
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
            amended_observations: persisted_count(
                persisted.amended_observations,
                "amended_observations",
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
    if source_path == backup_path || !source_path.is_file() {
        return Err(ImportError::InvalidLibraryBackup(
            "source and backup must be distinct existing files".to_owned(),
        ));
    }
    let backup_parent = backup_path.parent().ok_or_else(|| {
        ImportError::InvalidLibraryBackup("backup path has no parent directory".to_owned())
    })?;
    std::fs::create_dir_all(backup_parent)?;
    let source = Connection::open(source_path)?;
    verify_connection_integrity(&source, SCHEMA_VERSION)?;

    let mut temporary =
        PrivateStagingFile::new(backup_parent, "fitfreed-library-backup", ".sqlite")?;
    let temporary_path = temporary.path().to_owned();
    temporary.sync_and_close()?;
    {
        let mut destination = Connection::open(&temporary_path)?;
        let backup = rusqlite::backup::Backup::new(&source, &mut destination)?;
        backup.run_to_completion(64, Duration::from_millis(5), None)?;
    }
    verify_library_file(&temporary_path, SCHEMA_VERSION)?;
    File::open(&temporary_path)?.sync_all()?;
    temporary.persist_replace(backup_path)?;
    Ok(())
}

pub(crate) fn verify_library_file(path: &Path, expected_schema_version: i64) -> Result<()> {
    if !std::fs::symlink_metadata(path).is_ok_and(|metadata| metadata.file_type().is_file()) {
        return Err(ImportError::InvalidLibraryBackup(
            "library backup is not a regular file".to_owned(),
        ));
    }
    let connection = Connection::open_with_flags(
        path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    verify_connection_integrity(&connection, expected_schema_version)
}

fn verify_connection_integrity(
    connection: &Connection,
    expected_schema_version: i64,
) -> Result<()> {
    let schema_version =
        connection.query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))?;
    if schema_version != expected_schema_version {
        return Err(ImportError::InvalidLibraryBackup(format!(
            "expected schema {expected_schema_version}, found {schema_version}"
        )));
    }
    let integrity = connection.query_row("PRAGMA integrity_check(1)", [], |row| {
        row.get::<_, String>(0)
    })?;
    if integrity != "ok" {
        return Err(ImportError::InvalidLibraryBackup(
            "SQLite integrity check failed".to_owned(),
        ));
    }
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
        if version < 4 {
            connection.execute_batch(SCHEMA_V4)?;
        }
        if version < 5 {
            connection.execute_batch(SCHEMA_V5)?;
        }
        if version < 6 {
            connection.execute_batch(SCHEMA_V6)?;
        }
        if version < 7 {
            connection.execute_batch(SCHEMA_V7)?;
        }
        if version < 8 {
            connection.execute_batch(SCHEMA_V8)?;
        }
        connection.execute_batch(SCHEMA_V9)?;
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
        params![SOURCE_PROVIDER, SOURCE_ADAPTER_VERSION, MAPPING_SET_VERSION],
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
                MAPPING_SET_VERSION
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

fn invalidate_duplicate_training_sessions(
    connection: &Connection,
    operation_id: i64,
    mapped_artifacts: &[MappedTrainingArtifact],
) -> Result<Option<ImportError>> {
    let mut locators_by_identity: HashMap<(&str, &str), Vec<&str>> = HashMap::new();
    for artifact in mapped_artifacts {
        locators_by_identity
            .entry((
                artifact.observation.origin_id.as_str(),
                artifact.observation.session_id.as_str(),
            ))
            .or_default()
            .push(artifact.locator.as_str());
    }

    let mut duplicate_found = false;
    for locators in locators_by_identity
        .values()
        .filter(|locators| locators.len() > 1)
    {
        duplicate_found = true;
        for locator in locators {
            connection.execute(
                "UPDATE import_artifact_coverage
                 SET classification = 'invalid',
                     reason_code = 'duplicate-training-session-id'
                 WHERE import_operation_id = ?1 AND artifact_locator = ?2",
                params![operation_id, locator],
            )?;
        }
    }

    Ok(duplicate_found.then(|| ImportError::InvalidArtifact {
        artifact: "polar-flow-training-session".to_owned(),
        reason: "package contains duplicate training-session identities".to_owned(),
        reason_code: "duplicate-training-session-id",
    }))
}

fn invalidate_duplicate_nightly_recoveries(
    connection: &Connection,
    operation_id: i64,
    mapped_recoveries: &[MappedNightlyRecovery],
) -> Result<Option<ImportError>> {
    let mut locators_by_identity: HashMap<(&str, &str), Vec<&str>> = HashMap::new();
    for recovery in mapped_recoveries {
        locators_by_identity
            .entry((
                recovery.observation.origin_id.as_str(),
                recovery.observation.recovery_date.as_str(),
            ))
            .or_default()
            .push(recovery.locator.as_str());
    }

    let mut duplicate_found = false;
    for locators in locators_by_identity
        .values()
        .filter(|locators| locators.len() > 1)
    {
        duplicate_found = true;
        for locator in locators {
            connection.execute(
                "UPDATE import_artifact_coverage
                 SET classification = 'invalid',
                     reason_code = 'duplicate-nightly-recovery-date'
                 WHERE import_operation_id = ?1 AND artifact_locator = ?2",
                params![operation_id, locator],
            )?;
        }
    }

    Ok(duplicate_found.then(|| ImportError::InvalidArtifact {
        artifact: "polar-flow-nightly-recovery".to_owned(),
        reason: "package contains duplicate nightly-recovery identities".to_owned(),
        reason_code: "duplicate-nightly-recovery-date",
    }))
}

fn assemble_sleep_periods(
    connection: &Connection,
    operation_id: i64,
    result_artifacts: Vec<MappedSleepResultArtifact>,
    score_artifacts: Vec<MappedSleepScoreArtifact>,
) -> Result<Vec<MappedSleepPeriod>> {
    let mut result_locators_by_date: HashMap<String, Vec<String>> = HashMap::new();
    for artifact in &result_artifacts {
        for period in &artifact.periods {
            result_locators_by_date
                .entry(period.sleep_date.clone())
                .or_default()
                .push(artifact.locator.clone());
        }
    }
    let duplicate_result_locators = result_locators_by_date
        .values()
        .filter(|locators| locators.len() > 1)
        .flatten()
        .cloned()
        .collect::<HashSet<_>>();
    mark_sleep_coverage_invalid(
        connection,
        operation_id,
        &duplicate_result_locators,
        "duplicate-sleep-result-date",
    )?;

    let mut score_locators_by_date: HashMap<String, Vec<String>> = HashMap::new();
    for artifact in &score_artifacts {
        for (sleep_date, _) in &artifact.scores {
            score_locators_by_date
                .entry(sleep_date.clone())
                .or_default()
                .push(artifact.locator.clone());
        }
    }
    let duplicate_score_locators = score_locators_by_date
        .values()
        .filter(|locators| locators.len() > 1)
        .flatten()
        .cloned()
        .collect::<HashSet<_>>();
    mark_sleep_coverage_invalid(
        connection,
        operation_id,
        &duplicate_score_locators,
        "duplicate-sleep-score-date",
    )?;

    let result_dates = result_locators_by_date.keys().collect::<HashSet<_>>();
    let orphan_score_locators = score_locators_by_date
        .iter()
        .filter(|(sleep_date, _)| !result_dates.contains(sleep_date))
        .flat_map(|(_, locators)| locators.iter().cloned())
        .collect::<HashSet<_>>();
    mark_sleep_coverage_invalid(
        connection,
        operation_id,
        &orphan_score_locators,
        "orphan-sleep-score-date",
    )?;

    if !duplicate_result_locators.is_empty()
        || !duplicate_score_locators.is_empty()
        || !orphan_score_locators.is_empty()
    {
        let (reason, reason_code) = if !duplicate_result_locators.is_empty() {
            (
                "package contains duplicate sleep-result identities",
                "duplicate-sleep-result-date",
            )
        } else if !duplicate_score_locators.is_empty() {
            (
                "package contains duplicate sleep-score identities",
                "duplicate-sleep-score-date",
            )
        } else {
            (
                "package contains a sleep score without a matching result",
                "orphan-sleep-score-date",
            )
        };
        return Err(ImportError::InvalidArtifact {
            artifact: "polar-flow-sleep".to_owned(),
            reason: reason.to_owned(),
            reason_code,
        });
    }

    let mut periods_by_date = HashMap::new();
    for artifact in result_artifacts {
        for period in artifact.periods {
            periods_by_date.insert(
                period.sleep_date.clone(),
                MappedSleepPeriod {
                    result_locator: artifact.locator.clone(),
                    result_sha256: artifact.sha256.clone(),
                    score_locator: None,
                    score_sha256: None,
                    observation: period,
                },
            );
        }
    }
    for artifact in score_artifacts {
        for (sleep_date, score) in artifact.scores {
            let period = periods_by_date
                .get_mut(&sleep_date)
                .expect("orphan scores were rejected before assembly");
            period.score_locator = Some(artifact.locator.clone());
            period.score_sha256 = Some(artifact.sha256.clone());
            period.observation.score = Some(score);
        }
    }
    let mut periods = periods_by_date.into_values().collect::<Vec<_>>();
    periods.sort_by(|left, right| {
        left.observation
            .sleep_date
            .cmp(&right.observation.sleep_date)
    });
    Ok(periods)
}

fn mark_sleep_coverage_invalid(
    connection: &Connection,
    operation_id: i64,
    locators: &HashSet<String>,
    reason_code: &'static str,
) -> Result<()> {
    for locator in locators {
        connection.execute(
            "UPDATE import_artifact_coverage
             SET classification = 'invalid', reason_code = ?3
             WHERE import_operation_id = ?1 AND artifact_locator = ?2",
            params![operation_id, locator, reason_code],
        )?;
    }
    Ok(())
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
        ImportError::InvalidLibraryBackup(_) => "invalid-library-backup",
        ImportError::InvalidOperationTransition { .. } => "invalid-operation-transition",
        ImportError::InjectedInterruption(_) => "interrupted",
        ImportError::InjectedMigrationInterruption => "migration-interrupted",
        ImportError::OutcomePersistence { .. } => "outcome-persistence-failure",
        ImportError::InvalidPersistedOperationState(_)
        | ImportError::InvalidPersistedArtifactClassification(_)
        | ImportError::InvalidPersistedCount { .. }
        | ImportError::InvalidPersistedLocale(_) => "invalid-persisted-import-outcome",
        ImportError::InvalidPersistedUpdateState(_) => "invalid-update-state",
        ImportError::InvalidActivityLibrary(_) => "invalid-activity-library",
        ImportError::InvalidTrainingLibrary(_) => "invalid-training-library",
        ImportError::InvalidSleepLibrary(_) => "invalid-sleep-library",
        ImportError::InvalidNightlyRecoveryLibrary(_) => "invalid-nightly-recovery-library",
        ImportError::InvalidCorrelationKeyLength(_) => "invalid-library-correlation-state",
        ImportError::InvalidSourceSubjectClaim => "invalid-source-subject-evidence",
        ImportError::SourceSubjectConflict => "source-subject-confirmation-required",
        ImportError::InvalidReconciliationDecision(_) => "invalid-reconciliation-decision",
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

fn parse_source_datetime(
    value: &str,
    field: &'static str,
    artifact: &str,
) -> Result<(NaiveDateTime, String)> {
    let parsed = NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S%.f").map_err(|error| {
        ImportError::InvalidArtifact {
            artifact: artifact.to_owned(),
            reason: format!("invalid {field}: {error}"),
            reason_code: "invalid-supported-artifact",
        }
    })?;
    let normalized = if parsed.nanosecond() == 0 {
        parsed.format("%Y-%m-%dT%H:%M:%S").to_string()
    } else {
        parsed.format("%Y-%m-%dT%H:%M:%S%.f").to_string()
    };
    Ok((parsed, normalized))
}

fn invalid_training_artifact(artifact: &str, reason: impl Into<String>) -> ImportError {
    ImportError::InvalidArtifact {
        artifact: artifact.to_owned(),
        reason: reason.into(),
        reason_code: "invalid-supported-artifact",
    }
}

fn map_training_session(
    origin_id: &str,
    source: PolarTrainingSession,
    artifact: &str,
) -> Result<(TrainingSession, String)> {
    let PolarTrainingSession {
        identifier,
        created,
        modified,
        start_time,
        stop_time,
        timezone_offset_minutes,
        duration_millis,
        distance_meters,
        calories,
        hr_avg,
        hr_max,
        sport,
        exercises,
    } = source;
    if identifier.id.trim().is_empty() {
        return Err(invalid_training_artifact(
            artifact,
            "identifier.id cannot be blank",
        ));
    }
    let _ = parse_source_datetime(&created, "created", artifact)?;
    let (_, source_modified_at_utc) = parse_source_datetime(&modified, "modified", artifact)?;
    let (started_at, started_at_local) = parse_source_datetime(&start_time, "startTime", artifact)?;
    let (_, stopped_at_local) = parse_source_datetime(&stop_time, "stopTime", artifact)?;
    let filename_start = training_session_filename_start(artifact).ok_or_else(|| {
        invalid_training_artifact(artifact, "training-session filename has no start timestamp")
    })?;
    let expected_filename_start = started_at.format("%Y-%m-%dT%H-%M-%S").to_string();
    if filename_start != expected_filename_start {
        return Err(ImportError::InvalidArtifact {
            artifact: artifact.to_owned(),
            reason: "filename and content start times differ".to_owned(),
            reason_code: "filename-content-start-mismatch",
        });
    }
    if !(0..=359_999_999).contains(&duration_millis) {
        return Err(invalid_training_artifact(
            artifact,
            "durationMillis is outside the documented range",
        ));
    }
    let distance_meters = distance_meters.into_option();
    if distance_meters
        .is_some_and(|value| !value.is_finite() || !(0.0..=9_999_000.0).contains(&value))
    {
        return Err(invalid_training_artifact(
            artifact,
            "distanceMeters is outside the documented range",
        ));
    }
    let energy_kilocalories = calories.into_option();
    if energy_kilocalories.is_some_and(|value| value < 0) {
        return Err(invalid_training_artifact(
            artifact,
            "calories cannot be negative",
        ));
    }
    let average_heart_rate_bpm = hr_avg.into_option();
    let maximum_heart_rate_bpm = hr_max.into_option();
    if average_heart_rate_bpm.is_some_and(|value| value < 0)
        || maximum_heart_rate_bpm.is_some_and(|value| value < 0)
    {
        return Err(invalid_training_artifact(
            artifact,
            "heart-rate values cannot be negative",
        ));
    }
    if matches!(
        (average_heart_rate_bpm, maximum_heart_rate_bpm),
        (Some(average), Some(maximum)) if average > maximum
    ) {
        return Err(invalid_training_artifact(
            artifact,
            "hrAvg cannot exceed hrMax",
        ));
    }
    let sport_ref = sport.into_option().map(|reference| reference.id);
    if sport_ref
        .as_ref()
        .is_some_and(|reference| reference.trim().is_empty())
    {
        return Err(invalid_training_artifact(
            artifact,
            "sport.id cannot be blank",
        ));
    }

    Ok((
        TrainingSession {
            origin_id: origin_id.to_owned(),
            session_id: identifier.id,
            started_at_local,
            stopped_at_local,
            utc_offset_minutes: timezone_offset_minutes.into_option(),
            duration_milliseconds: duration_millis,
            distance_meters,
            energy_kilocalories,
            average_heart_rate_bpm,
            maximum_heart_rate_bpm,
            sport_ref,
            exercise_count: exercises.into_option().map(|value| value.0),
        },
        source_modified_at_utc,
    ))
}

fn decode_training_session(
    origin_id: &str,
    artifact_locator: &str,
    artifact_sha256: &str,
    bytes: Vec<u8>,
) -> Result<MappedTrainingArtifact> {
    let source: PolarTrainingSession =
        serde_json::from_slice(&bytes).map_err(|error| ImportError::InvalidArtifact {
            artifact: artifact_locator.to_owned(),
            reason: error.to_string(),
            reason_code: "invalid-supported-artifact",
        })?;
    let (observation, source_modified_at_utc) =
        map_training_session(origin_id, source, artifact_locator)?;
    Ok(MappedTrainingArtifact {
        locator: artifact_locator.to_owned(),
        sha256: artifact_sha256.to_owned(),
        source_modified_at_utc,
        observation,
    })
}

static ISO_DURATION_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"^P(?:(?<days>[0-9]+)D)?(?:T(?:(?<hours>[0-9]+)H)?(?:(?<minutes>[0-9]+)M)?(?:(?<seconds>[0-9]+)(?:\.(?<fraction>[0-9]{1,9}))?S)?)?$",
    )
    .expect("valid ISO duration pattern")
});

fn invalid_sleep_artifact(artifact: &str, reason: impl Into<String>) -> ImportError {
    ImportError::InvalidArtifact {
        artifact: artifact.to_owned(),
        reason: reason.into(),
        reason_code: "invalid-supported-artifact",
    }
}

fn parse_duration_milliseconds(value: &str, field: &'static str, artifact: &str) -> Result<i64> {
    if value.ends_with('T') {
        return Err(invalid_sleep_artifact(
            artifact,
            format!("{field} has an empty time component"),
        ));
    }
    let captures = ISO_DURATION_PATTERN.captures(value).ok_or_else(|| {
        invalid_sleep_artifact(
            artifact,
            format!("{field} is not a supported ISO 8601 duration"),
        )
    })?;
    let component = |name: &str| -> Result<i64> {
        captures.name(name).map_or(Ok(0), |matched| {
            matched.as_str().parse::<i64>().map_err(|error| {
                invalid_sleep_artifact(artifact, format!("{field} is too large: {error}"))
            })
        })
    };
    if ["days", "hours", "minutes", "seconds"]
        .iter()
        .all(|name| captures.name(name).is_none())
    {
        return Err(invalid_sleep_artifact(
            artifact,
            format!("{field} has no duration component"),
        ));
    }
    let days = component("days")?;
    let hours = component("hours")?;
    let minutes = component("minutes")?;
    let seconds = component("seconds")?;
    let whole_seconds = days
        .checked_mul(86_400)
        .and_then(|value| {
            hours
                .checked_mul(3_600)
                .and_then(|part| value.checked_add(part))
        })
        .and_then(|value| {
            minutes
                .checked_mul(60)
                .and_then(|part| value.checked_add(part))
        })
        .and_then(|value| value.checked_add(seconds))
        .ok_or_else(|| invalid_sleep_artifact(artifact, format!("{field} overflows")))?;
    let fraction_milliseconds = captures.name("fraction").map_or(Ok(0_i64), |matched| {
        let fraction = matched.as_str();
        if fraction.len() > 3 && !fraction[3..].bytes().all(|digit| digit == b'0') {
            return Err(invalid_sleep_artifact(
                artifact,
                format!("{field} is not representable in whole milliseconds"),
            ));
        }
        let prefix = &fraction[..fraction.len().min(3)];
        let parsed = prefix.parse::<i64>().map_err(|error| {
            invalid_sleep_artifact(artifact, format!("invalid {field} fraction: {error}"))
        })?;
        Ok(parsed * 10_i64.pow((3 - prefix.len()) as u32))
    })?;
    whole_seconds
        .checked_mul(1_000)
        .and_then(|value| value.checked_add(fraction_milliseconds))
        .ok_or_else(|| invalid_sleep_artifact(artifact, format!("{field} overflows")))
}

fn checked_sleep_sum(artifact: &str, label: &str, values: &[i64]) -> Result<i64> {
    values.iter().try_fold(0_i64, |total, value| {
        total.checked_add(*value).ok_or_else(|| {
            invalid_sleep_artifact(artifact, format!("{label} arithmetic overflows"))
        })
    })
}

fn map_sleep_stage(state: &str, artifact: &str) -> Result<SleepStage> {
    match state {
        "WAKE" => Ok(SleepStage::Wake),
        "REM" => Ok(SleepStage::Rem),
        "NONREM1" | "NONREM2" => Ok(SleepStage::Light),
        "NONREM3" => Ok(SleepStage::Deep),
        "WS_UNKNOWN" => Ok(SleepStage::Unrecognized),
        _ => Err(invalid_sleep_artifact(
            artifact,
            "sleep stage is not supported by mapping version 1",
        )),
    }
}

fn map_sleep_rating(rating: &str, artifact: &str) -> Result<Option<i64>> {
    match rating {
        "UNKNOWN" => Ok(None),
        "SLEPT_BAD" => Ok(Some(1)),
        "SLEPT_QUITE_BAD" => Ok(Some(2)),
        "SLEPT_NEITHER_BAD_NOR_WELL" => Ok(Some(3)),
        "SLEPT_QUITE_WELL" => Ok(Some(4)),
        "SLEPT_WELL" => Ok(Some(5)),
        _ => Err(invalid_sleep_artifact(
            artifact,
            "sleep rating is not supported by mapping version 1",
        )),
    }
}

fn map_sleep_result(
    origin_id: &str,
    source: PolarSleepResultEntry,
    artifact: &str,
) -> Result<SleepPeriod> {
    let PolarSleepResultEntry {
        night,
        evaluation,
        sleep_result,
    } = source;
    NaiveDate::parse_from_str(&night, "%Y-%m-%d").map_err(|error| {
        invalid_sleep_artifact(artifact, format!("invalid sleep date: {error}"))
    })?;
    let PolarSleepEvaluation {
        sleep_type,
        sleep_span,
        asleep_duration,
        age,
        analysis,
        interruptions,
        phase_durations,
    } = evaluation;
    if sleep_type.trim().is_empty() || !age.is_finite() {
        return Err(invalid_sleep_artifact(
            artifact,
            "sleep type and evaluation age must be structurally valid",
        ));
    }
    let PolarSleepAnalysis {
        efficiency_percent,
        continuity_index,
        continuity_class,
        _feedback: _,
    } = analysis;
    if !efficiency_percent.is_finite() || !(0.0..=100.0).contains(&efficiency_percent) {
        return Err(invalid_sleep_artifact(
            artifact,
            "efficiencyPercent is outside the documented range",
        ));
    }
    if !continuity_index.is_finite() || !(0.0..=5.0).contains(&continuity_index) {
        return Err(invalid_sleep_artifact(
            artifact,
            "continuityIndex is outside the documented range",
        ));
    }
    if !(0..=5).contains(&continuity_class) {
        return Err(invalid_sleep_artifact(
            artifact,
            "continuityClass is outside the documented range",
        ));
    }

    let span_milliseconds =
        parse_duration_milliseconds(&sleep_span, "evaluation.sleepSpan", artifact)?;
    let asleep_milliseconds =
        parse_duration_milliseconds(&asleep_duration, "evaluation.asleepDuration", artifact)?;
    let interruption_milliseconds = parse_duration_milliseconds(
        &interruptions.total_duration,
        "evaluation.interruptions.totalDuration",
        artifact,
    )?;
    let long_interruption_milliseconds = parse_duration_milliseconds(
        &interruptions.long_duration,
        "evaluation.interruptions.longDuration",
        artifact,
    )?;
    let short_interruption_milliseconds = parse_duration_milliseconds(
        &interruptions.short_duration,
        "evaluation.interruptions.shortDuration",
        artifact,
    )?;
    if interruptions.total_count < 0
        || interruptions.long_count < 0
        || interruptions.short_count < 0
    {
        return Err(invalid_sleep_artifact(
            artifact,
            "interruption counts cannot be negative",
        ));
    }
    if checked_sleep_sum(
        artifact,
        "sleep span",
        &[asleep_milliseconds, interruption_milliseconds],
    )? != span_milliseconds
        || checked_sleep_sum(
            artifact,
            "interruption duration",
            &[
                long_interruption_milliseconds,
                short_interruption_milliseconds,
            ],
        )? != interruption_milliseconds
        || checked_sleep_sum(
            artifact,
            "interruption count",
            &[interruptions.long_count, interruptions.short_count],
        )? != interruptions.total_count
    {
        return Err(invalid_sleep_artifact(
            artifact,
            "declared sleep duration or interruption arithmetic is inconsistent",
        ));
    }

    let PolarSleepResult {
        hypnogram,
        sleep_cycles,
    } = sleep_result;
    let started_at = DateTime::parse_from_rfc3339(&hypnogram.sleep_start).map_err(|error| {
        invalid_sleep_artifact(artifact, format!("invalid sleepStart: {error}"))
    })?;
    let ended_at = DateTime::parse_from_rfc3339(&hypnogram.sleep_end)
        .map_err(|error| invalid_sleep_artifact(artifact, format!("invalid sleepEnd: {error}")))?;
    if ended_at <= started_at {
        return Err(invalid_sleep_artifact(
            artifact,
            "sleepEnd must be later than sleepStart",
        ));
    }
    let started_at = started_at.to_rfc3339_opts(SecondsFormat::AutoSi, false);
    let ended_at = ended_at.to_rfc3339_opts(SecondsFormat::AutoSi, false);
    let sleep_goal_milliseconds = hypnogram
        .sleep_goal
        .into_option()
        .map(|value| parse_duration_milliseconds(&value, "sleepGoal", artifact))
        .transpose()?;
    let self_reported_rating = map_sleep_rating(&hypnogram.rating, artifact)?;
    let recording_ended_by_power_loss = hypnogram.battery_ran_out.into_option();

    let phase_summary = phase_durations
        .into_option()
        .map(|phases| {
            if !phases.rem_percentage.is_finite()
                || !(0.0..=100.0).contains(&phases.rem_percentage)
                || !phases.deep_percentage.is_finite()
                || !(0.0..=100.0).contains(&phases.deep_percentage)
            {
                return Err(invalid_sleep_artifact(
                    artifact,
                    "phase percentages are outside the documented range",
                ));
            }
            let summary = SleepPhaseSummary {
                wake_milliseconds: parse_duration_milliseconds(
                    &phases.wake,
                    "phaseDurations.wake",
                    artifact,
                )?,
                rem_milliseconds: parse_duration_milliseconds(
                    &phases.rem,
                    "phaseDurations.rem",
                    artifact,
                )?,
                light_milliseconds: parse_duration_milliseconds(
                    &phases.light,
                    "phaseDurations.light",
                    artifact,
                )?,
                deep_milliseconds: parse_duration_milliseconds(
                    &phases.deep,
                    "phaseDurations.deep",
                    artifact,
                )?,
                unrecognized_milliseconds: parse_duration_milliseconds(
                    &phases.unknown,
                    "phaseDurations.unknown",
                    artifact,
                )?,
            };
            let phase_span = checked_sleep_sum(
                artifact,
                "phase duration",
                &[
                    summary.wake_milliseconds,
                    summary.rem_milliseconds,
                    summary.light_milliseconds,
                    summary.deep_milliseconds,
                    summary.unrecognized_milliseconds,
                ],
            )?;
            let phase_asleep = checked_sleep_sum(
                artifact,
                "asleep phase duration",
                &[
                    summary.rem_milliseconds,
                    summary.light_milliseconds,
                    summary.deep_milliseconds,
                    summary.unrecognized_milliseconds,
                ],
            )?;
            if phase_span != span_milliseconds || phase_asleep != asleep_milliseconds {
                return Err(invalid_sleep_artifact(
                    artifact,
                    "phase durations are inconsistent with the declared period",
                ));
            }
            Ok(summary)
        })
        .transpose()?;

    let stage_transitions = hypnogram
        .sleep_state_changes
        .into_option()
        .map(|changes| {
            let mut transitions = Vec::with_capacity(changes.len());
            let mut previous_offset = None;
            let change_count = changes.len();
            for (index, change) in changes.into_iter().enumerate() {
                let offset_milliseconds = parse_duration_milliseconds(
                    &change.offset_from_start,
                    "sleepStateChanges.offsetFromStart",
                    artifact,
                )?;
                if offset_milliseconds > span_milliseconds {
                    if index + 1 == change_count && change.state == "WAKE" {
                        continue;
                    }
                    return Err(invalid_sleep_artifact(
                        artifact,
                        "only a final wake marker may exceed the declared span",
                    ));
                }
                if previous_offset.is_some_and(|previous| offset_milliseconds < previous) {
                    return Err(invalid_sleep_artifact(
                        artifact,
                        "sleep-state offsets must be non-decreasing",
                    ));
                }
                previous_offset = Some(offset_milliseconds);
                transitions.push(SleepStageTransition {
                    offset_milliseconds,
                    stage: map_sleep_stage(&change.state, artifact)?,
                });
            }
            if transitions
                .first()
                .is_some_and(|transition| transition.offset_milliseconds != 0)
            {
                return Err(invalid_sleep_artifact(
                    artifact,
                    "a non-empty sleep-state timeline must start at zero",
                ));
            }
            Ok(transitions)
        })
        .transpose()?;

    Ok(SleepPeriod {
        origin_id: origin_id.to_owned(),
        sleep_date: night,
        started_at,
        ended_at,
        span_milliseconds,
        asleep_milliseconds,
        interruption_milliseconds,
        long_interruption_milliseconds,
        short_interruption_milliseconds,
        interruption_count: interruptions.total_count,
        long_interruption_count: interruptions.long_count,
        short_interruption_count: interruptions.short_count,
        efficiency_percent,
        continuity_index,
        continuity_class,
        sleep_goal_milliseconds,
        self_reported_rating,
        cycle_count: sleep_cycles
            .into_option()
            .map(|cycles| cycles.cycles.sleep_cycle_models.0),
        recording_ended_by_power_loss,
        phase_summary,
        stage_transitions,
        score: None,
    })
}

fn map_sleep_score(source: PolarSleepScoreEntry, artifact: &str) -> Result<(String, SleepScore)> {
    NaiveDate::parse_from_str(&source.night, "%Y-%m-%d").map_err(|error| {
        invalid_sleep_artifact(artifact, format!("invalid score date: {error}"))
    })?;
    let score = source.sleep_score_result;
    let values = [
        score.sleep_score,
        score.sleep_time_own_target_score,
        score.sleep_time_recommendation_score,
        score.continuity_score,
        score.efficiency_score,
        score.rem_score,
        score.n3_score,
        score.long_interruptions_score,
        score.group_duration_score,
        score.group_solidity_score,
        score.group_refresh_score,
    ];
    if values
        .iter()
        .any(|value| !value.is_finite() || !(1.0..=100.0).contains(value))
    {
        return Err(invalid_sleep_artifact(
            artifact,
            "sleep scores are outside the documented range",
        ));
    }
    let relative_rating = score.score_rate.into_option();
    if relative_rating.is_some_and(|value| !(1..=5).contains(&value)) {
        return Err(invalid_sleep_artifact(
            artifact,
            "scoreRate is outside the documented range",
        ));
    }
    Ok((
        source.night,
        SleepScore {
            overall: score.sleep_score,
            own_target_duration: score.sleep_time_own_target_score,
            recommended_duration: score.sleep_time_recommendation_score,
            continuity: score.continuity_score,
            efficiency: score.efficiency_score,
            rem: score.rem_score,
            deep: score.n3_score,
            long_interruptions: score.long_interruptions_score,
            duration: score.group_duration_score,
            solidity: score.group_solidity_score,
            regeneration: score.group_refresh_score,
            relative_rating,
        },
    ))
}

fn decode_sleep_results(
    origin_id: &str,
    artifact_locator: &str,
    artifact_sha256: &str,
    bytes: &[u8],
) -> Result<MappedSleepResultArtifact> {
    let source: Vec<PolarSleepResultEntry> =
        serde_json::from_slice(bytes).map_err(|error| ImportError::InvalidArtifact {
            artifact: artifact_locator.to_owned(),
            reason: error.to_string(),
            reason_code: "invalid-supported-artifact",
        })?;
    let periods = source
        .into_iter()
        .map(|entry| map_sleep_result(origin_id, entry, artifact_locator))
        .collect::<Result<Vec<_>>>()?;
    Ok(MappedSleepResultArtifact {
        locator: artifact_locator.to_owned(),
        sha256: artifact_sha256.to_owned(),
        periods,
    })
}

fn decode_sleep_scores(
    artifact_locator: &str,
    artifact_sha256: &str,
    bytes: &[u8],
) -> Result<MappedSleepScoreArtifact> {
    let source: Vec<PolarSleepScoreEntry> =
        serde_json::from_slice(bytes).map_err(|error| ImportError::InvalidArtifact {
            artifact: artifact_locator.to_owned(),
            reason: error.to_string(),
            reason_code: "invalid-supported-artifact",
        })?;
    let scores = source
        .into_iter()
        .map(|entry| map_sleep_score(entry, artifact_locator))
        .collect::<Result<Vec<_>>>()?;
    Ok(MappedSleepScoreArtifact {
        locator: artifact_locator.to_owned(),
        sha256: artifact_sha256.to_owned(),
        scores,
    })
}

fn invalid_nightly_recovery_artifact(artifact: &str, reason: impl Into<String>) -> ImportError {
    ImportError::InvalidArtifact {
        artifact: artifact.to_owned(),
        reason: reason.into(),
        reason_code: "invalid-supported-artifact",
    }
}

fn map_nightly_recovery(
    origin_id: &str,
    source: PolarNightlyRecovery,
    artifact: &str,
) -> Result<NightlyRecovery> {
    let PolarNightlyRecovery {
        night,
        mean_nightly_recovery_rri,
        mean_nightly_recovery_rmssd,
        mean_nightly_recovery_respiration_interval,
        ans_rate,
        ans_status,
        recovery_indicator,
        recovery_indicator_sub_level,
        mean_baseline_respiration_interval,
        mean_baseline_rmssd,
        mean_baseline_rri,
        sd_baseline_respiration_interval,
        sd_baseline_rmssd,
        sd_baseline_rri,
        exercise_tip,
        sleep_tip,
        vitality_tip,
    } = source;
    NaiveDate::parse_from_str(&night, "%Y-%m-%d").map_err(|error| {
        invalid_nightly_recovery_artifact(artifact, format!("invalid recovery date: {error}"))
    })?;
    if mean_nightly_recovery_rri <= 0 || mean_nightly_recovery_respiration_interval <= 0 {
        return Err(invalid_nightly_recovery_artifact(
            artifact,
            "nightly beat-to-beat and breathing intervals must be positive",
        ));
    }
    let heart_rate_variability_rmssd_milliseconds = mean_nightly_recovery_rmssd.into_option();
    if heart_rate_variability_rmssd_milliseconds.is_some_and(|value| value < 0) {
        return Err(invalid_nightly_recovery_artifact(
            artifact,
            "nightly RMSSD cannot be negative",
        ));
    }

    let source_assessment = match (
        ans_rate.into_option(),
        ans_status.into_option(),
        recovery_indicator.into_option(),
        recovery_indicator_sub_level.into_option(),
    ) {
        (None, None, None, None) => None,
        (
            Some(autonomic_status),
            Some(autonomic_charge),
            Some(overall_status),
            Some(overall_sublevel),
        ) => {
            if !autonomic_charge.is_finite() || !(-10.0..=10.0).contains(&autonomic_charge) {
                return Err(invalid_nightly_recovery_artifact(
                    artifact,
                    "ansStatus is outside the documented charge range",
                ));
            }
            if !(1..=5).contains(&autonomic_status) {
                return Err(invalid_nightly_recovery_artifact(
                    artifact,
                    "ansRate is outside the documented status range",
                ));
            }
            if !(1..=6).contains(&overall_status) {
                return Err(invalid_nightly_recovery_artifact(
                    artifact,
                    "recoveryIndicator is outside the documented status range",
                ));
            }
            Some(SourceSpecificRecoveryAssessment {
                scheme: NIGHTLY_RECOVERY_SCHEME.to_owned(),
                autonomic_charge,
                autonomic_status,
                overall_status,
                overall_sublevel,
            })
        }
        _ => {
            return Err(invalid_nightly_recovery_artifact(
                artifact,
                "nightly recovery assessment fields must be all present or all absent",
            ));
        }
    };

    let baseline_mean_breathing = mean_baseline_respiration_interval.into_option();
    let baseline_mean_rmssd = mean_baseline_rmssd.into_option();
    let baseline_mean_rri = mean_baseline_rri.into_option();
    let baseline_sd_breathing = sd_baseline_respiration_interval.into_option();
    let baseline_sd_rmssd = sd_baseline_rmssd.into_option();
    let baseline_sd_rri = sd_baseline_rri.into_option();
    let source_baseline = match (
        baseline_mean_rri,
        baseline_sd_rri,
        baseline_mean_breathing,
        baseline_sd_breathing,
    ) {
        (None, None, None, None)
            if baseline_mean_rmssd.is_none() && baseline_sd_rmssd.is_none() =>
        {
            None
        }
        (
            Some(mean_beat_to_beat_interval_milliseconds),
            Some(standard_deviation_beat_to_beat_interval_milliseconds),
            Some(mean_breathing_interval_milliseconds),
            Some(standard_deviation_breathing_interval_milliseconds),
        ) => {
            if mean_beat_to_beat_interval_milliseconds <= 0
                || mean_breathing_interval_milliseconds <= 0
                || standard_deviation_beat_to_beat_interval_milliseconds < 0
                || standard_deviation_breathing_interval_milliseconds < 0
            {
                return Err(invalid_nightly_recovery_artifact(
                    artifact,
                    "baseline means and standard deviations are outside their documented ranges",
                ));
            }
            let (
                mean_heart_rate_variability_rmssd_milliseconds,
                standard_deviation_heart_rate_variability_rmssd_milliseconds,
            ) = match (baseline_mean_rmssd, baseline_sd_rmssd) {
                (None, None) => (None, None),
                (Some(mean), Some(standard_deviation)) if mean >= 0 && standard_deviation >= 0 => {
                    (Some(mean), Some(standard_deviation))
                }
                (Some(_), Some(_)) => {
                    return Err(invalid_nightly_recovery_artifact(
                        artifact,
                        "baseline RMSSD cannot be negative",
                    ));
                }
                _ => {
                    return Err(invalid_nightly_recovery_artifact(
                        artifact,
                        "baseline RMSSD mean and standard deviation must appear together",
                    ));
                }
            };
            Some(SourceSpecificRecoveryBaseline {
                scheme: NIGHTLY_RECOVERY_SCHEME.to_owned(),
                mean_beat_to_beat_interval_milliseconds,
                standard_deviation_beat_to_beat_interval_milliseconds,
                mean_heart_rate_variability_rmssd_milliseconds,
                standard_deviation_heart_rate_variability_rmssd_milliseconds,
                mean_breathing_interval_milliseconds,
                standard_deviation_breathing_interval_milliseconds,
            })
        }
        _ => {
            return Err(invalid_nightly_recovery_artifact(
                artifact,
                "baseline core fields must be all present or all absent",
            ));
        }
    };

    let source_guidance = match (
        exercise_tip.into_option(),
        sleep_tip.into_option(),
        vitality_tip.into_option(),
    ) {
        (None, None, None) => None,
        (Some(exercise), Some(sleep), Some(vitality)) => {
            if [&exercise, &sleep, &vitality]
                .into_iter()
                .any(|value| value.trim().is_empty() || value.chars().count() > 4_096)
            {
                return Err(invalid_nightly_recovery_artifact(
                    artifact,
                    "nightly recovery guidance must be non-empty and at most 4096 characters",
                ));
            }
            Some(SourceSpecificRecoveryGuidance {
                scheme: NIGHTLY_RECOVERY_SCHEME.to_owned(),
                exercise,
                sleep,
                vitality,
            })
        }
        _ => {
            return Err(invalid_nightly_recovery_artifact(
                artifact,
                "nightly recovery guidance fields must be all present or all absent",
            ));
        }
    };

    Ok(NightlyRecovery {
        origin_id: origin_id.to_owned(),
        recovery_date: night,
        beat_to_beat_interval_milliseconds: mean_nightly_recovery_rri,
        heart_rate_variability_rmssd_milliseconds,
        breathing_interval_milliseconds: mean_nightly_recovery_respiration_interval,
        source_assessment,
        source_baseline,
        source_guidance,
    })
}

fn decode_nightly_recoveries(
    origin_id: &str,
    artifact_locator: &str,
    artifact_sha256: &str,
    bytes: &[u8],
) -> Result<Vec<MappedNightlyRecovery>> {
    let source: Vec<PolarNightlyRecovery> =
        serde_json::from_slice(bytes).map_err(|error| ImportError::InvalidArtifact {
            artifact: artifact_locator.to_owned(),
            reason: error.to_string(),
            reason_code: "invalid-supported-artifact",
        })?;
    source
        .into_iter()
        .enumerate()
        .map(|(index, entry)| {
            Ok(MappedNightlyRecovery {
                locator: artifact_locator.to_owned(),
                sha256: artifact_sha256.to_owned(),
                source_record_locator: format!("json-index:{index}"),
                observation: map_nightly_recovery(origin_id, entry, artifact_locator)?,
            })
        })
        .collect()
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
        ReconciliationDecision::Amend => {
            return Err(ImportError::InvalidReconciliationDecision("daily activity"));
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

fn reconcile_training_session(
    transaction: &Transaction<'_>,
    operation_id: i64,
    artifact: &MappedTrainingArtifact,
    report: &mut ImportReport,
) -> Result<()> {
    let incoming = &artifact.observation;
    let existing = transaction
        .query_row(
            "SELECT source_modified_at_utc, started_at_local, stopped_at_local,
                    utc_offset_minutes, duration_milliseconds, distance_meters,
                    energy_kilocalories, average_heart_rate_bpm, maximum_heart_rate_bpm,
                    sport_ref, exercise_count
             FROM training_session
             WHERE origin_id = ?1 AND session_id = ?2",
            params![incoming.origin_id, incoming.session_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    TrainingSession {
                        origin_id: incoming.origin_id.clone(),
                        session_id: incoming.session_id.clone(),
                        started_at_local: row.get(1)?,
                        stopped_at_local: row.get(2)?,
                        utc_offset_minutes: row.get(3)?,
                        duration_milliseconds: row.get(4)?,
                        distance_meters: row.get(5)?,
                        energy_kilocalories: row.get(6)?,
                        average_heart_rate_bpm: row.get(7)?,
                        maximum_heart_rate_bpm: row.get(8)?,
                        sport_ref: row.get(9)?,
                        exercise_count: row
                            .get::<_, Option<i64>>(10)?
                            .map(|value| {
                                usize::try_from(value).map_err(|error| {
                                    SqliteError::FromSqlConversionFailure(
                                        10,
                                        Type::Integer,
                                        Box::new(error),
                                    )
                                })
                            })
                            .transpose()?,
                    },
                ))
            },
        )
        .optional()?;
    let revision_order =
        existing
            .as_ref()
            .map_or(RevisionOrder::Unorderable, |value| {
                match artifact.source_modified_at_utc.cmp(&value.0) {
                    CmpOrdering::Less => RevisionOrder::Older,
                    CmpOrdering::Equal => RevisionOrder::Equal,
                    CmpOrdering::Greater => RevisionOrder::Newer,
                }
            });
    let decision = decide_training_session_reconciliation(
        existing.as_ref().map(|value| &value.1),
        incoming,
        revision_order,
    );
    let exercise_count = incoming
        .exercise_count
        .map(i64::try_from)
        .transpose()
        .map_err(|_| invalid_training_artifact(&artifact.locator, "exercise count is too large"))?;

    match decision {
        ReconciliationDecision::Create => {
            transaction.execute(
                "INSERT INTO training_session (
                     origin_id, session_id, source_modified_at_utc, started_at_local,
                     stopped_at_local, utc_offset_minutes, duration_milliseconds,
                     distance_meters, energy_kilocalories, average_heart_rate_bpm,
                     maximum_heart_rate_bpm, sport_ref, exercise_count
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                params![
                    incoming.origin_id,
                    incoming.session_id,
                    artifact.source_modified_at_utc,
                    incoming.started_at_local,
                    incoming.stopped_at_local,
                    incoming.utc_offset_minutes,
                    incoming.duration_milliseconds,
                    incoming.distance_meters,
                    incoming.energy_kilocalories,
                    incoming.average_heart_rate_bpm,
                    incoming.maximum_heart_rate_bpm,
                    incoming.sport_ref,
                    exercise_count,
                ],
            )?;
        }
        ReconciliationDecision::Equivalent | ReconciliationDecision::Preserve => {}
        ReconciliationDecision::Amend => {
            transaction.execute(
                "UPDATE training_session
                 SET source_modified_at_utc = ?3,
                     started_at_local = ?4,
                     stopped_at_local = ?5,
                     utc_offset_minutes = ?6,
                     duration_milliseconds = ?7,
                     distance_meters = ?8,
                     energy_kilocalories = ?9,
                     average_heart_rate_bpm = ?10,
                     maximum_heart_rate_bpm = ?11,
                     sport_ref = ?12,
                     exercise_count = ?13
                 WHERE origin_id = ?1 AND session_id = ?2",
                params![
                    incoming.origin_id,
                    incoming.session_id,
                    artifact.source_modified_at_utc,
                    incoming.started_at_local,
                    incoming.stopped_at_local,
                    incoming.utc_offset_minutes,
                    incoming.duration_milliseconds,
                    incoming.distance_meters,
                    incoming.energy_kilocalories,
                    incoming.average_heart_rate_bpm,
                    incoming.maximum_heart_rate_bpm,
                    incoming.sport_ref,
                    exercise_count,
                ],
            )?;
        }
        ReconciliationDecision::Conflict => {
            let existing_source_modified_at_utc = &existing
                .as_ref()
                .expect("a training conflict has an existing observation")
                .0;
            transaction.execute(
                "INSERT INTO training_session_conflict (
                     import_operation_id, origin_id, session_id,
                     existing_source_modified_at_utc, incoming_source_modified_at_utc,
                     artifact_locator, source_record_locator, mapping_version
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'json-root', ?7)",
                params![
                    operation_id,
                    incoming.origin_id,
                    incoming.session_id,
                    existing_source_modified_at_utc,
                    artifact.source_modified_at_utc,
                    artifact.locator,
                    TRAINING_SESSION_MAPPING_VERSION,
                ],
            )?;
        }
        ReconciliationDecision::Enrich => {
            return Err(ImportError::InvalidReconciliationDecision(
                "training session",
            ));
        }
    }

    transaction.execute(
        "INSERT INTO training_session_provenance (
             origin_id, session_id, import_operation_id, artifact_locator,
             source_record_locator, source_artifact_sha256, source_provider,
             source_adapter_version, mapping_version, source_modified_at_utc,
             reconciliation_decision, contributes_to_visible_state
         ) VALUES (?1, ?2, ?3, ?4, 'json-root', ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            incoming.origin_id,
            incoming.session_id,
            operation_id,
            artifact.locator,
            artifact.sha256,
            SOURCE_PROVIDER,
            SOURCE_ADAPTER_VERSION,
            TRAINING_SESSION_MAPPING_VERSION,
            artifact.source_modified_at_utc,
            reconciliation_decision_code(decision),
            matches!(
                decision,
                ReconciliationDecision::Create
                    | ReconciliationDecision::Equivalent
                    | ReconciliationDecision::Amend
            ),
        ],
    )?;
    report.record(decision);
    Ok(())
}

#[derive(Debug)]
struct PersistedSleepPeriod {
    origin_id: String,
    sleep_date: String,
    started_at: String,
    ended_at: String,
    span_milliseconds: i64,
    asleep_milliseconds: i64,
    interruption_milliseconds: i64,
    long_interruption_milliseconds: i64,
    short_interruption_milliseconds: i64,
    interruption_count: i64,
    long_interruption_count: i64,
    short_interruption_count: i64,
    efficiency_percent: f64,
    continuity_index: f64,
    continuity_class: i64,
    sleep_goal_milliseconds: Option<i64>,
    self_reported_rating: Option<i64>,
    cycle_count: Option<i64>,
    recording_ended_by_power_loss: Option<i64>,
    phase_wake_milliseconds: Option<i64>,
    phase_rem_milliseconds: Option<i64>,
    phase_light_milliseconds: Option<i64>,
    phase_deep_milliseconds: Option<i64>,
    phase_unrecognized_milliseconds: Option<i64>,
    stage_timeline_available: i64,
    score_overall: Option<f64>,
    score_own_target_duration: Option<f64>,
    score_recommended_duration: Option<f64>,
    score_continuity: Option<f64>,
    score_efficiency: Option<f64>,
    score_rem: Option<f64>,
    score_deep: Option<f64>,
    score_long_interruptions: Option<f64>,
    score_duration: Option<f64>,
    score_solidity: Option<f64>,
    score_regeneration: Option<f64>,
    score_relative_rating: Option<i64>,
}

fn read_persisted_sleep_period(row: &Row<'_>) -> rusqlite::Result<PersistedSleepPeriod> {
    Ok(PersistedSleepPeriod {
        origin_id: row.get(0)?,
        sleep_date: row.get(1)?,
        started_at: row.get(2)?,
        ended_at: row.get(3)?,
        span_milliseconds: row.get(4)?,
        asleep_milliseconds: row.get(5)?,
        interruption_milliseconds: row.get(6)?,
        long_interruption_milliseconds: row.get(7)?,
        short_interruption_milliseconds: row.get(8)?,
        interruption_count: row.get(9)?,
        long_interruption_count: row.get(10)?,
        short_interruption_count: row.get(11)?,
        efficiency_percent: row.get(12)?,
        continuity_index: row.get(13)?,
        continuity_class: row.get(14)?,
        sleep_goal_milliseconds: row.get(15)?,
        self_reported_rating: row.get(16)?,
        cycle_count: row.get(17)?,
        recording_ended_by_power_loss: row.get(18)?,
        phase_wake_milliseconds: row.get(19)?,
        phase_rem_milliseconds: row.get(20)?,
        phase_light_milliseconds: row.get(21)?,
        phase_deep_milliseconds: row.get(22)?,
        phase_unrecognized_milliseconds: row.get(23)?,
        stage_timeline_available: row.get(24)?,
        score_overall: row.get(25)?,
        score_own_target_duration: row.get(26)?,
        score_recommended_duration: row.get(27)?,
        score_continuity: row.get(28)?,
        score_efficiency: row.get(29)?,
        score_rem: row.get(30)?,
        score_deep: row.get(31)?,
        score_long_interruptions: row.get(32)?,
        score_duration: row.get(33)?,
        score_solidity: row.get(34)?,
        score_regeneration: row.get(35)?,
        score_relative_rating: row.get(36)?,
    })
}

fn required_sleep_component<T>(value: Option<T>, column: &'static str) -> Result<T> {
    value.ok_or_else(|| {
        ImportError::InvalidSleepLibrary(format!(
            "{column} is unavailable inside a present optional group"
        ))
    })
}

fn decode_sleep_library_period(persisted: PersistedSleepPeriod) -> Result<SleepLibraryPeriod> {
    let cycle_count = persisted
        .cycle_count
        .map(|value| persisted_count(value, "sleep_period.cycle_count"))
        .transpose()?;
    let recording_ended_by_power_loss = match persisted.recording_ended_by_power_loss {
        None => None,
        Some(0) => Some(false),
        Some(1) => Some(true),
        Some(value) => {
            return Err(ImportError::InvalidSleepLibrary(format!(
                "invalid recording_ended_by_power_loss value: {value}"
            )))
        }
    };
    let stage_timeline_available = match persisted.stage_timeline_available {
        0 => false,
        1 => true,
        value => {
            return Err(ImportError::InvalidSleepLibrary(format!(
                "invalid stage_timeline_available value: {value}"
            )))
        }
    };
    let phase_summary = persisted
        .phase_wake_milliseconds
        .map(|wake_milliseconds| -> Result<SleepPhaseSummary> {
            Ok(SleepPhaseSummary {
                wake_milliseconds,
                rem_milliseconds: required_sleep_component(
                    persisted.phase_rem_milliseconds,
                    "phase_rem_milliseconds",
                )?,
                light_milliseconds: required_sleep_component(
                    persisted.phase_light_milliseconds,
                    "phase_light_milliseconds",
                )?,
                deep_milliseconds: required_sleep_component(
                    persisted.phase_deep_milliseconds,
                    "phase_deep_milliseconds",
                )?,
                unrecognized_milliseconds: required_sleep_component(
                    persisted.phase_unrecognized_milliseconds,
                    "phase_unrecognized_milliseconds",
                )?,
            })
        })
        .transpose()?;
    let score = persisted
        .score_overall
        .map(|overall| -> Result<SleepScore> {
            Ok(SleepScore {
                overall,
                own_target_duration: required_sleep_component(
                    persisted.score_own_target_duration,
                    "score_own_target_duration",
                )?,
                recommended_duration: required_sleep_component(
                    persisted.score_recommended_duration,
                    "score_recommended_duration",
                )?,
                continuity: required_sleep_component(
                    persisted.score_continuity,
                    "score_continuity",
                )?,
                efficiency: required_sleep_component(
                    persisted.score_efficiency,
                    "score_efficiency",
                )?,
                rem: required_sleep_component(persisted.score_rem, "score_rem")?,
                deep: required_sleep_component(persisted.score_deep, "score_deep")?,
                long_interruptions: required_sleep_component(
                    persisted.score_long_interruptions,
                    "score_long_interruptions",
                )?,
                duration: required_sleep_component(persisted.score_duration, "score_duration")?,
                solidity: required_sleep_component(persisted.score_solidity, "score_solidity")?,
                regeneration: required_sleep_component(
                    persisted.score_regeneration,
                    "score_regeneration",
                )?,
                relative_rating: persisted.score_relative_rating,
            })
        })
        .transpose()?;

    Ok(SleepLibraryPeriod {
        origin_id: persisted.origin_id,
        sleep_date: persisted.sleep_date,
        started_at: persisted.started_at,
        ended_at: persisted.ended_at,
        span_milliseconds: persisted.span_milliseconds,
        asleep_milliseconds: persisted.asleep_milliseconds,
        interruption_milliseconds: persisted.interruption_milliseconds,
        long_interruption_milliseconds: persisted.long_interruption_milliseconds,
        short_interruption_milliseconds: persisted.short_interruption_milliseconds,
        interruption_count: persisted.interruption_count,
        long_interruption_count: persisted.long_interruption_count,
        short_interruption_count: persisted.short_interruption_count,
        efficiency_percent: persisted.efficiency_percent,
        continuity_index: persisted.continuity_index,
        continuity_class: persisted.continuity_class,
        sleep_goal_milliseconds: persisted.sleep_goal_milliseconds,
        self_reported_rating: persisted.self_reported_rating,
        cycle_count,
        recording_ended_by_power_loss,
        phase_summary,
        stage_timeline_available,
        score,
    })
}

fn load_sleep_period(
    connection: &Connection,
    origin_id: &str,
    sleep_date: &str,
) -> Result<Option<SleepPeriod>> {
    let persisted = connection
        .query_row(
            "SELECT origin_id, sleep_date, started_at, ended_at,
                    span_milliseconds, asleep_milliseconds,
                    interruption_milliseconds, long_interruption_milliseconds,
                    short_interruption_milliseconds, interruption_count,
                    long_interruption_count, short_interruption_count,
                    efficiency_percent, continuity_index, continuity_class,
                    sleep_goal_milliseconds, self_reported_rating, cycle_count,
                    recording_ended_by_power_loss, phase_wake_milliseconds,
                    phase_rem_milliseconds, phase_light_milliseconds,
                    phase_deep_milliseconds, phase_unrecognized_milliseconds,
                    stage_timeline_available, score_overall,
                    score_own_target_duration, score_recommended_duration,
                    score_continuity, score_efficiency, score_rem, score_deep,
                    score_long_interruptions, score_duration, score_solidity,
                    score_regeneration, score_relative_rating
             FROM sleep_period
             WHERE origin_id = ?1 AND sleep_date = ?2",
            params![origin_id, sleep_date],
            read_persisted_sleep_period,
        )
        .optional()?;
    let Some(persisted) = persisted else {
        return Ok(None);
    };

    let period = decode_sleep_library_period(persisted)?;
    let stage_transitions = if period.stage_timeline_available {
        let mut statement = connection.prepare(
            "SELECT offset_milliseconds, stage
             FROM sleep_stage_transition
             WHERE origin_id = ?1 AND sleep_date = ?2
             ORDER BY position",
        )?;
        let rows = statement.query_map(params![period.origin_id, period.sleep_date], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?;
        let mut transitions = Vec::new();
        for row in rows {
            let (offset_milliseconds, stage) = row?;
            let stage = match stage.as_str() {
                "wake" => SleepStage::Wake,
                "rem" => SleepStage::Rem,
                "light" => SleepStage::Light,
                "deep" => SleepStage::Deep,
                "unrecognized" => SleepStage::Unrecognized,
                _ => {
                    return Err(ImportError::InvalidSleepLibrary(format!(
                        "invalid persisted sleep stage: {stage}"
                    )))
                }
            };
            transitions.push(SleepStageTransition {
                offset_milliseconds,
                stage,
            });
        }
        Some(transitions)
    } else {
        None
    };

    Ok(Some(SleepPeriod {
        origin_id: period.origin_id,
        sleep_date: period.sleep_date,
        started_at: period.started_at,
        ended_at: period.ended_at,
        span_milliseconds: period.span_milliseconds,
        asleep_milliseconds: period.asleep_milliseconds,
        interruption_milliseconds: period.interruption_milliseconds,
        long_interruption_milliseconds: period.long_interruption_milliseconds,
        short_interruption_milliseconds: period.short_interruption_milliseconds,
        interruption_count: period.interruption_count,
        long_interruption_count: period.long_interruption_count,
        short_interruption_count: period.short_interruption_count,
        efficiency_percent: period.efficiency_percent,
        continuity_index: period.continuity_index,
        continuity_class: period.continuity_class,
        sleep_goal_milliseconds: period.sleep_goal_milliseconds,
        self_reported_rating: period.self_reported_rating,
        cycle_count: period.cycle_count,
        recording_ended_by_power_loss: period.recording_ended_by_power_loss,
        phase_summary: period.phase_summary,
        stage_transitions,
        score: period.score,
    }))
}

fn sleep_stage_code(stage: SleepStage) -> &'static str {
    match stage {
        SleepStage::Wake => "wake",
        SleepStage::Rem => "rem",
        SleepStage::Light => "light",
        SleepStage::Deep => "deep",
        SleepStage::Unrecognized => "unrecognized",
    }
}

fn persist_sleep_period(transaction: &Transaction<'_>, period: &SleepPeriod) -> Result<()> {
    let phase = period.phase_summary.as_ref();
    let score = period.score.as_ref();
    transaction.execute(
        "INSERT INTO sleep_period (
             origin_id, sleep_date, started_at, ended_at, span_milliseconds,
             asleep_milliseconds, interruption_milliseconds,
             long_interruption_milliseconds, short_interruption_milliseconds,
             interruption_count, long_interruption_count, short_interruption_count,
             efficiency_percent, continuity_index, continuity_class,
             sleep_goal_milliseconds, self_reported_rating, cycle_count,
             recording_ended_by_power_loss, phase_wake_milliseconds,
             phase_rem_milliseconds, phase_light_milliseconds,
             phase_deep_milliseconds, phase_unrecognized_milliseconds,
             stage_timeline_available, score_overall, score_own_target_duration,
             score_recommended_duration, score_continuity, score_efficiency,
             score_rem, score_deep, score_long_interruptions, score_duration,
             score_solidity, score_regeneration, score_relative_rating
         ) VALUES (
             ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
             ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25,
             ?26, ?27, ?28, ?29, ?30, ?31, ?32, ?33, ?34, ?35, ?36, ?37
         ) ON CONFLICT (origin_id, sleep_date) DO UPDATE SET
             started_at = excluded.started_at,
             ended_at = excluded.ended_at,
             span_milliseconds = excluded.span_milliseconds,
             asleep_milliseconds = excluded.asleep_milliseconds,
             interruption_milliseconds = excluded.interruption_milliseconds,
             long_interruption_milliseconds = excluded.long_interruption_milliseconds,
             short_interruption_milliseconds = excluded.short_interruption_milliseconds,
             interruption_count = excluded.interruption_count,
             long_interruption_count = excluded.long_interruption_count,
             short_interruption_count = excluded.short_interruption_count,
             efficiency_percent = excluded.efficiency_percent,
             continuity_index = excluded.continuity_index,
             continuity_class = excluded.continuity_class,
             sleep_goal_milliseconds = excluded.sleep_goal_milliseconds,
             self_reported_rating = excluded.self_reported_rating,
             cycle_count = excluded.cycle_count,
             recording_ended_by_power_loss = excluded.recording_ended_by_power_loss,
             phase_wake_milliseconds = excluded.phase_wake_milliseconds,
             phase_rem_milliseconds = excluded.phase_rem_milliseconds,
             phase_light_milliseconds = excluded.phase_light_milliseconds,
             phase_deep_milliseconds = excluded.phase_deep_milliseconds,
             phase_unrecognized_milliseconds = excluded.phase_unrecognized_milliseconds,
             stage_timeline_available = excluded.stage_timeline_available,
             score_overall = excluded.score_overall,
             score_own_target_duration = excluded.score_own_target_duration,
             score_recommended_duration = excluded.score_recommended_duration,
             score_continuity = excluded.score_continuity,
             score_efficiency = excluded.score_efficiency,
             score_rem = excluded.score_rem,
             score_deep = excluded.score_deep,
             score_long_interruptions = excluded.score_long_interruptions,
             score_duration = excluded.score_duration,
             score_solidity = excluded.score_solidity,
             score_regeneration = excluded.score_regeneration,
             score_relative_rating = excluded.score_relative_rating",
        params![
            period.origin_id,
            period.sleep_date,
            period.started_at,
            period.ended_at,
            period.span_milliseconds,
            period.asleep_milliseconds,
            period.interruption_milliseconds,
            period.long_interruption_milliseconds,
            period.short_interruption_milliseconds,
            period.interruption_count,
            period.long_interruption_count,
            period.short_interruption_count,
            period.efficiency_percent,
            period.continuity_index,
            period.continuity_class,
            period.sleep_goal_milliseconds,
            period.self_reported_rating,
            period.cycle_count.map(|value| value as i64),
            period.recording_ended_by_power_loss,
            phase.map(|value| value.wake_milliseconds),
            phase.map(|value| value.rem_milliseconds),
            phase.map(|value| value.light_milliseconds),
            phase.map(|value| value.deep_milliseconds),
            phase.map(|value| value.unrecognized_milliseconds),
            period.stage_transitions.is_some(),
            score.map(|value| value.overall),
            score.map(|value| value.own_target_duration),
            score.map(|value| value.recommended_duration),
            score.map(|value| value.continuity),
            score.map(|value| value.efficiency),
            score.map(|value| value.rem),
            score.map(|value| value.deep),
            score.map(|value| value.long_interruptions),
            score.map(|value| value.duration),
            score.map(|value| value.solidity),
            score.map(|value| value.regeneration),
            score.and_then(|value| value.relative_rating),
        ],
    )?;
    transaction.execute(
        "DELETE FROM sleep_stage_transition
         WHERE origin_id = ?1 AND sleep_date = ?2",
        params![period.origin_id, period.sleep_date],
    )?;
    if let Some(transitions) = &period.stage_transitions {
        for (position, transition) in transitions.iter().enumerate() {
            transaction.execute(
                "INSERT INTO sleep_stage_transition (
                     origin_id, sleep_date, position, offset_milliseconds, stage
                 ) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    period.origin_id,
                    period.sleep_date,
                    position as i64,
                    transition.offset_milliseconds,
                    sleep_stage_code(transition.stage),
                ],
            )?;
        }
    }
    Ok(())
}

fn reconcile_sleep_period(
    transaction: &Transaction<'_>,
    operation_id: i64,
    mapped: &MappedSleepPeriod,
    report: &mut ImportReport,
) -> Result<()> {
    let period = &mapped.observation;
    let existing = load_sleep_period(transaction, &period.origin_id, &period.sleep_date)?;
    let decision = decide_sleep_period_reconciliation(existing.as_ref(), period);
    match decision {
        ReconciliationDecision::Create | ReconciliationDecision::Enrich => {
            persist_sleep_period(transaction, period)?;
        }
        ReconciliationDecision::Equivalent | ReconciliationDecision::Preserve => {}
        ReconciliationDecision::Conflict => {
            transaction.execute(
                "INSERT INTO sleep_period_conflict (
                     import_operation_id, origin_id, sleep_date,
                     result_artifact_locator, score_artifact_locator, mapping_version
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    operation_id,
                    period.origin_id,
                    period.sleep_date,
                    mapped.result_locator,
                    mapped.score_locator,
                    SLEEP_MAPPING_VERSION,
                ],
            )?;
        }
        ReconciliationDecision::Amend => {
            return Err(ImportError::InvalidReconciliationDecision("sleep period"));
        }
    }
    transaction.execute(
        "INSERT INTO sleep_period_provenance (
             origin_id, sleep_date, import_operation_id,
             result_artifact_locator, result_artifact_sha256,
             score_artifact_locator, score_artifact_sha256, source_provider,
             source_adapter_version, mapping_version, reconciliation_decision,
             contributes_to_visible_state
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            period.origin_id,
            period.sleep_date,
            operation_id,
            mapped.result_locator,
            mapped.result_sha256,
            mapped.score_locator,
            mapped.score_sha256,
            SOURCE_PROVIDER,
            SOURCE_ADAPTER_VERSION,
            SLEEP_MAPPING_VERSION,
            reconciliation_decision_code(decision),
            matches!(
                decision,
                ReconciliationDecision::Create
                    | ReconciliationDecision::Equivalent
                    | ReconciliationDecision::Enrich
            ),
        ],
    )?;
    report.record(decision);
    Ok(())
}

#[derive(Debug)]
struct PersistedRecoveryLibraryNight {
    origin_id: String,
    recovery_date: String,
    beat_to_beat_interval_milliseconds: i64,
    heart_rate_variability_rmssd_milliseconds: Option<i64>,
    breathing_interval_milliseconds: i64,
    assessment_scheme: Option<String>,
    autonomic_charge: Option<f64>,
    autonomic_status: Option<i64>,
    overall_status: Option<i64>,
    overall_sublevel: Option<i64>,
    source_baseline_available: bool,
    source_guidance_available: bool,
}

fn decode_recovery_library_night(
    persisted: PersistedRecoveryLibraryNight,
) -> Result<RecoveryLibraryNight> {
    let source_assessment = match (
        persisted.assessment_scheme,
        persisted.autonomic_charge,
        persisted.autonomic_status,
        persisted.overall_status,
        persisted.overall_sublevel,
    ) {
        (None, None, None, None, None) => None,
        (
            Some(scheme),
            Some(autonomic_charge),
            Some(autonomic_status),
            Some(overall_status),
            Some(overall_sublevel),
        ) => Some(SourceSpecificRecoveryAssessment {
            scheme,
            autonomic_charge,
            autonomic_status,
            overall_status,
            overall_sublevel,
        }),
        _ => {
            return Err(ImportError::InvalidNightlyRecoveryLibrary(
                "source assessment is incomplete".to_owned(),
            ));
        }
    };
    Ok(RecoveryLibraryNight {
        origin_id: persisted.origin_id,
        recovery_date: persisted.recovery_date,
        beat_to_beat_interval_milliseconds: persisted.beat_to_beat_interval_milliseconds,
        heart_rate_variability_rmssd_milliseconds: persisted
            .heart_rate_variability_rmssd_milliseconds,
        breathing_interval_milliseconds: persisted.breathing_interval_milliseconds,
        source_assessment,
        source_baseline_available: persisted.source_baseline_available,
        source_guidance_available: persisted.source_guidance_available,
    })
}

#[derive(Debug)]
struct PersistedNightlyRecovery {
    origin_id: String,
    recovery_date: String,
    beat_to_beat_interval_milliseconds: i64,
    heart_rate_variability_rmssd_milliseconds: Option<i64>,
    breathing_interval_milliseconds: i64,
    assessment_scheme: Option<String>,
    autonomic_charge: Option<f64>,
    autonomic_status: Option<i64>,
    overall_status: Option<i64>,
    overall_sublevel: Option<i64>,
    baseline_scheme: Option<String>,
    baseline_mean_beat_to_beat_interval_milliseconds: Option<i64>,
    baseline_standard_deviation_beat_to_beat_interval_milliseconds: Option<i64>,
    baseline_mean_heart_rate_variability_rmssd_milliseconds: Option<i64>,
    baseline_standard_deviation_heart_rate_variability_rmssd_milliseconds: Option<i64>,
    baseline_mean_breathing_interval_milliseconds: Option<i64>,
    baseline_standard_deviation_breathing_interval_milliseconds: Option<i64>,
    guidance_scheme: Option<String>,
    exercise_guidance: Option<String>,
    sleep_guidance: Option<String>,
    vitality_guidance: Option<String>,
}

fn read_persisted_nightly_recovery(row: &Row<'_>) -> rusqlite::Result<PersistedNightlyRecovery> {
    Ok(PersistedNightlyRecovery {
        origin_id: row.get(0)?,
        recovery_date: row.get(1)?,
        beat_to_beat_interval_milliseconds: row.get(2)?,
        heart_rate_variability_rmssd_milliseconds: row.get(3)?,
        breathing_interval_milliseconds: row.get(4)?,
        assessment_scheme: row.get(5)?,
        autonomic_charge: row.get(6)?,
        autonomic_status: row.get(7)?,
        overall_status: row.get(8)?,
        overall_sublevel: row.get(9)?,
        baseline_scheme: row.get(10)?,
        baseline_mean_beat_to_beat_interval_milliseconds: row.get(11)?,
        baseline_standard_deviation_beat_to_beat_interval_milliseconds: row.get(12)?,
        baseline_mean_heart_rate_variability_rmssd_milliseconds: row.get(13)?,
        baseline_standard_deviation_heart_rate_variability_rmssd_milliseconds: row.get(14)?,
        baseline_mean_breathing_interval_milliseconds: row.get(15)?,
        baseline_standard_deviation_breathing_interval_milliseconds: row.get(16)?,
        guidance_scheme: row.get(17)?,
        exercise_guidance: row.get(18)?,
        sleep_guidance: row.get(19)?,
        vitality_guidance: row.get(20)?,
    })
}

fn required_nightly_recovery_component<T>(value: Option<T>, column: &'static str) -> Result<T> {
    value.ok_or_else(|| {
        ImportError::InvalidNightlyRecoveryLibrary(format!(
            "{column} is unavailable inside a present optional group"
        ))
    })
}

fn decode_nightly_recovery_library(persisted: PersistedNightlyRecovery) -> Result<NightlyRecovery> {
    let source_assessment = persisted
        .assessment_scheme
        .map(|scheme| -> Result<SourceSpecificRecoveryAssessment> {
            Ok(SourceSpecificRecoveryAssessment {
                scheme,
                autonomic_charge: required_nightly_recovery_component(
                    persisted.autonomic_charge,
                    "autonomic_charge",
                )?,
                autonomic_status: required_nightly_recovery_component(
                    persisted.autonomic_status,
                    "autonomic_status",
                )?,
                overall_status: required_nightly_recovery_component(
                    persisted.overall_status,
                    "overall_status",
                )?,
                overall_sublevel: required_nightly_recovery_component(
                    persisted.overall_sublevel,
                    "overall_sublevel",
                )?,
            })
        })
        .transpose()?;
    let source_baseline = persisted
        .baseline_scheme
        .map(|scheme| -> Result<SourceSpecificRecoveryBaseline> {
            Ok(SourceSpecificRecoveryBaseline {
                scheme,
                mean_beat_to_beat_interval_milliseconds: required_nightly_recovery_component(
                    persisted.baseline_mean_beat_to_beat_interval_milliseconds,
                    "baseline_mean_beat_to_beat_interval_milliseconds",
                )?,
                standard_deviation_beat_to_beat_interval_milliseconds:
                    required_nightly_recovery_component(
                        persisted.baseline_standard_deviation_beat_to_beat_interval_milliseconds,
                        "baseline_standard_deviation_beat_to_beat_interval_milliseconds",
                    )?,
                mean_heart_rate_variability_rmssd_milliseconds: persisted
                    .baseline_mean_heart_rate_variability_rmssd_milliseconds,
                standard_deviation_heart_rate_variability_rmssd_milliseconds: persisted
                    .baseline_standard_deviation_heart_rate_variability_rmssd_milliseconds,
                mean_breathing_interval_milliseconds: required_nightly_recovery_component(
                    persisted.baseline_mean_breathing_interval_milliseconds,
                    "baseline_mean_breathing_interval_milliseconds",
                )?,
                standard_deviation_breathing_interval_milliseconds:
                    required_nightly_recovery_component(
                        persisted.baseline_standard_deviation_breathing_interval_milliseconds,
                        "baseline_standard_deviation_breathing_interval_milliseconds",
                    )?,
            })
        })
        .transpose()?;
    let source_guidance = persisted
        .guidance_scheme
        .map(|scheme| -> Result<SourceSpecificRecoveryGuidance> {
            Ok(SourceSpecificRecoveryGuidance {
                scheme,
                exercise: required_nightly_recovery_component(
                    persisted.exercise_guidance,
                    "exercise_guidance",
                )?,
                sleep: required_nightly_recovery_component(
                    persisted.sleep_guidance,
                    "sleep_guidance",
                )?,
                vitality: required_nightly_recovery_component(
                    persisted.vitality_guidance,
                    "vitality_guidance",
                )?,
            })
        })
        .transpose()?;

    Ok(NightlyRecovery {
        origin_id: persisted.origin_id,
        recovery_date: persisted.recovery_date,
        beat_to_beat_interval_milliseconds: persisted.beat_to_beat_interval_milliseconds,
        heart_rate_variability_rmssd_milliseconds: persisted
            .heart_rate_variability_rmssd_milliseconds,
        breathing_interval_milliseconds: persisted.breathing_interval_milliseconds,
        source_assessment,
        source_baseline,
        source_guidance,
    })
}

fn load_nightly_recovery(
    connection: &Connection,
    origin_id: &str,
    recovery_date: &str,
) -> Result<Option<NightlyRecovery>> {
    let persisted = connection
        .query_row(
            "SELECT origin_id, recovery_date,
                    beat_to_beat_interval_milliseconds,
                    heart_rate_variability_rmssd_milliseconds,
                    breathing_interval_milliseconds,
                    assessment_scheme, autonomic_charge, autonomic_status,
                    overall_status, overall_sublevel, baseline_scheme,
                    baseline_mean_beat_to_beat_interval_milliseconds,
                    baseline_standard_deviation_beat_to_beat_interval_milliseconds,
                    baseline_mean_heart_rate_variability_rmssd_milliseconds,
                    baseline_standard_deviation_heart_rate_variability_rmssd_milliseconds,
                    baseline_mean_breathing_interval_milliseconds,
                    baseline_standard_deviation_breathing_interval_milliseconds,
                    guidance_scheme, exercise_guidance, sleep_guidance, vitality_guidance
             FROM nightly_recovery
             WHERE origin_id = ?1 AND recovery_date = ?2",
            params![origin_id, recovery_date],
            read_persisted_nightly_recovery,
        )
        .optional()?;
    persisted.map(decode_nightly_recovery_library).transpose()
}

fn persist_nightly_recovery(
    transaction: &Transaction<'_>,
    recovery: &NightlyRecovery,
) -> Result<()> {
    let assessment = recovery.source_assessment.as_ref();
    let baseline = recovery.source_baseline.as_ref();
    let guidance = recovery.source_guidance.as_ref();
    transaction.execute(
        "INSERT INTO nightly_recovery (
             origin_id, recovery_date, beat_to_beat_interval_milliseconds,
             heart_rate_variability_rmssd_milliseconds,
             breathing_interval_milliseconds, assessment_scheme,
             autonomic_charge, autonomic_status, overall_status, overall_sublevel,
             baseline_scheme, baseline_mean_beat_to_beat_interval_milliseconds,
             baseline_standard_deviation_beat_to_beat_interval_milliseconds,
             baseline_mean_heart_rate_variability_rmssd_milliseconds,
             baseline_standard_deviation_heart_rate_variability_rmssd_milliseconds,
             baseline_mean_breathing_interval_milliseconds,
             baseline_standard_deviation_breathing_interval_milliseconds,
             guidance_scheme, exercise_guidance, sleep_guidance, vitality_guidance
         ) VALUES (
             ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
             ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21
         ) ON CONFLICT (origin_id, recovery_date) DO UPDATE SET
             beat_to_beat_interval_milliseconds =
                 excluded.beat_to_beat_interval_milliseconds,
             heart_rate_variability_rmssd_milliseconds =
                 excluded.heart_rate_variability_rmssd_milliseconds,
             breathing_interval_milliseconds = excluded.breathing_interval_milliseconds,
             assessment_scheme = excluded.assessment_scheme,
             autonomic_charge = excluded.autonomic_charge,
             autonomic_status = excluded.autonomic_status,
             overall_status = excluded.overall_status,
             overall_sublevel = excluded.overall_sublevel,
             baseline_scheme = excluded.baseline_scheme,
             baseline_mean_beat_to_beat_interval_milliseconds =
                 excluded.baseline_mean_beat_to_beat_interval_milliseconds,
             baseline_standard_deviation_beat_to_beat_interval_milliseconds =
                 excluded.baseline_standard_deviation_beat_to_beat_interval_milliseconds,
             baseline_mean_heart_rate_variability_rmssd_milliseconds =
                 excluded.baseline_mean_heart_rate_variability_rmssd_milliseconds,
             baseline_standard_deviation_heart_rate_variability_rmssd_milliseconds =
                 excluded.baseline_standard_deviation_heart_rate_variability_rmssd_milliseconds,
             baseline_mean_breathing_interval_milliseconds =
                 excluded.baseline_mean_breathing_interval_milliseconds,
             baseline_standard_deviation_breathing_interval_milliseconds =
                 excluded.baseline_standard_deviation_breathing_interval_milliseconds,
             guidance_scheme = excluded.guidance_scheme,
             exercise_guidance = excluded.exercise_guidance,
             sleep_guidance = excluded.sleep_guidance,
             vitality_guidance = excluded.vitality_guidance",
        params![
            recovery.origin_id,
            recovery.recovery_date,
            recovery.beat_to_beat_interval_milliseconds,
            recovery.heart_rate_variability_rmssd_milliseconds,
            recovery.breathing_interval_milliseconds,
            assessment.map(|value| value.scheme.as_str()),
            assessment.map(|value| value.autonomic_charge),
            assessment.map(|value| value.autonomic_status),
            assessment.map(|value| value.overall_status),
            assessment.map(|value| value.overall_sublevel),
            baseline.map(|value| value.scheme.as_str()),
            baseline.map(|value| value.mean_beat_to_beat_interval_milliseconds),
            baseline.map(|value| value.standard_deviation_beat_to_beat_interval_milliseconds),
            baseline.and_then(|value| value.mean_heart_rate_variability_rmssd_milliseconds),
            baseline.and_then(|value| {
                value.standard_deviation_heart_rate_variability_rmssd_milliseconds
            }),
            baseline.map(|value| value.mean_breathing_interval_milliseconds),
            baseline.map(|value| value.standard_deviation_breathing_interval_milliseconds),
            guidance.map(|value| value.scheme.as_str()),
            guidance.map(|value| value.exercise.as_str()),
            guidance.map(|value| value.sleep.as_str()),
            guidance.map(|value| value.vitality.as_str()),
        ],
    )?;
    Ok(())
}

fn reconcile_nightly_recovery(
    transaction: &Transaction<'_>,
    operation_id: i64,
    mapped: &MappedNightlyRecovery,
    report: &mut ImportReport,
) -> Result<()> {
    let recovery = &mapped.observation;
    let existing =
        load_nightly_recovery(transaction, &recovery.origin_id, &recovery.recovery_date)?;
    let decision = decide_nightly_recovery_reconciliation(existing.as_ref(), recovery);
    match decision {
        ReconciliationDecision::Create | ReconciliationDecision::Enrich => {
            persist_nightly_recovery(transaction, recovery)?;
        }
        ReconciliationDecision::Equivalent | ReconciliationDecision::Preserve => {}
        ReconciliationDecision::Conflict => {
            transaction.execute(
                "INSERT INTO nightly_recovery_conflict (
                     import_operation_id, origin_id, recovery_date,
                     artifact_locator, source_record_locator, mapping_version
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    operation_id,
                    recovery.origin_id,
                    recovery.recovery_date,
                    mapped.locator,
                    mapped.source_record_locator,
                    NIGHTLY_RECOVERY_MAPPING_VERSION,
                ],
            )?;
        }
        ReconciliationDecision::Amend => {
            return Err(ImportError::InvalidReconciliationDecision(
                "nightly recovery",
            ));
        }
    }
    transaction.execute(
        "INSERT INTO nightly_recovery_provenance (
             origin_id, recovery_date, import_operation_id, artifact_locator,
             source_record_locator, source_artifact_sha256, source_provider,
             source_adapter_version, mapping_version, reconciliation_decision,
             contributes_to_visible_state
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            recovery.origin_id,
            recovery.recovery_date,
            operation_id,
            mapped.locator,
            mapped.source_record_locator,
            mapped.sha256,
            SOURCE_PROVIDER,
            SOURCE_ADAPTER_VERSION,
            NIGHTLY_RECOVERY_MAPPING_VERSION,
            reconciliation_decision_code(decision),
            matches!(
                decision,
                ReconciliationDecision::Create
                    | ReconciliationDecision::Equivalent
                    | ReconciliationDecision::Enrich
            ),
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
        ReconciliationDecision::Amend => "amend",
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
             amended_observations = ?7,
             preserved_observations = ?8,
             conflicts = ?9,
             canonical_history_changed = CASE WHEN ?4 + ?6 + ?7 > 0 THEN 1 ELSE 0 END,
             temporary_state_removed = 1
         WHERE id = ?1 AND state = 'committing' AND coverage_complete = 1",
        params![
            operation_id,
            report.exact_repeat,
            report.recognized_artifacts,
            report.new_observations,
            report.equivalent_observations,
            report.enriched_observations,
            report.amended_observations,
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
    fn activity_bounds(&self) -> std::result::Result<Option<ActivityDateRange>, String> {
        query_activity_bounds(&self.database_path).map_err(|error| error.to_string())
    }

    fn activity_origins(&self) -> std::result::Result<Vec<String>, String> {
        query_activity_origins(&self.database_path).map_err(|error| error.to_string())
    }

    fn query_activity(
        &self,
        range: &ActivityDateRange,
    ) -> std::result::Result<Vec<DailyActivity>, String> {
        query_activity_between(
            &self.database_path,
            Some(range.from.as_str()),
            Some(range.through.as_str()),
        )
        .map_err(|error| error.to_string())
    }
}

pub struct SqliteTrainingLibrary {
    database_path: PathBuf,
}

impl SqliteTrainingLibrary {
    pub fn new(database_path: PathBuf) -> Self {
        Self { database_path }
    }
}

impl TrainingLibraryPort for SqliteTrainingLibrary {
    fn training_bounds(&self) -> std::result::Result<Option<TrainingDateRange>, String> {
        query_training_bounds(&self.database_path).map_err(|error| error.to_string())
    }

    fn training_origins(&self) -> std::result::Result<Vec<String>, String> {
        query_training_origins(&self.database_path).map_err(|error| error.to_string())
    }

    fn query_training(
        &self,
        range: &TrainingDateRange,
    ) -> std::result::Result<Vec<TrainingSession>, String> {
        query_training_between(
            &self.database_path,
            Some(range.from.as_str()),
            Some(range.through.as_str()),
        )
        .map_err(|error| error.to_string())
    }
}

pub struct SqliteSleepLibrary {
    database_path: PathBuf,
}

impl SqliteSleepLibrary {
    pub fn new(database_path: PathBuf) -> Self {
        Self { database_path }
    }
}

impl SleepLibraryPort for SqliteSleepLibrary {
    fn sleep_bounds(&self) -> std::result::Result<Option<SleepDateRange>, String> {
        query_sleep_bounds(&self.database_path).map_err(|error| error.to_string())
    }

    fn sleep_origins(&self) -> std::result::Result<Vec<String>, String> {
        query_sleep_origins(&self.database_path).map_err(|error| error.to_string())
    }

    fn query_sleep(
        &self,
        range: &SleepDateRange,
    ) -> std::result::Result<Vec<SleepLibraryPeriod>, String> {
        query_sleep_library_between(
            &self.database_path,
            Some(range.from.as_str()),
            Some(range.through.as_str()),
        )
        .map_err(|error| error.to_string())
    }

    fn query_sleep_period(
        &self,
        series_ref: &str,
        sleep_date: &str,
    ) -> std::result::Result<Option<SleepPeriod>, String> {
        query_sleep_period(&self.database_path, series_ref, sleep_date)
            .map_err(|error| error.to_string())
    }
}

pub struct SqliteRecoveryLibrary {
    database_path: PathBuf,
}

impl SqliteRecoveryLibrary {
    pub fn new(database_path: PathBuf) -> Self {
        Self { database_path }
    }
}

impl RecoveryLibraryPort for SqliteRecoveryLibrary {
    fn recovery_bounds(&self) -> std::result::Result<Option<RecoveryDateRange>, String> {
        query_recovery_bounds(&self.database_path).map_err(|error| error.to_string())
    }

    fn recovery_origins(&self) -> std::result::Result<Vec<String>, String> {
        query_recovery_origins(&self.database_path).map_err(|error| error.to_string())
    }

    fn query_recovery(
        &self,
        range: &RecoveryDateRange,
    ) -> std::result::Result<Vec<RecoveryLibraryNight>, String> {
        query_recovery_library_between(
            &self.database_path,
            Some(range.from.as_str()),
            Some(range.through.as_str()),
        )
        .map_err(|error| error.to_string())
    }

    fn query_recovery_night(
        &self,
        series_ref: &str,
        recovery_date: &str,
    ) -> std::result::Result<Option<NightlyRecovery>, String> {
        query_nightly_recovery(&self.database_path, series_ref, recovery_date)
            .map_err(|error| error.to_string())
    }
}

pub struct SqliteLongitudinalLibrary {
    database_path: PathBuf,
}

impl SqliteLongitudinalLibrary {
    pub fn new(database_path: PathBuf) -> Self {
        Self { database_path }
    }
}

impl ActivityLibraryPort for SqliteLongitudinalLibrary {
    fn activity_bounds(&self) -> StandardResult<Option<ActivityDateRange>, String> {
        SqliteActivityLibrary::new(self.database_path.clone()).activity_bounds()
    }

    fn activity_origins(&self) -> StandardResult<Vec<String>, String> {
        SqliteActivityLibrary::new(self.database_path.clone()).activity_origins()
    }

    fn query_activity(
        &self,
        range: &ActivityDateRange,
    ) -> StandardResult<Vec<DailyActivity>, String> {
        SqliteActivityLibrary::new(self.database_path.clone()).query_activity(range)
    }
}

impl TrainingLibraryPort for SqliteLongitudinalLibrary {
    fn training_bounds(&self) -> StandardResult<Option<TrainingDateRange>, String> {
        SqliteTrainingLibrary::new(self.database_path.clone()).training_bounds()
    }

    fn training_origins(&self) -> StandardResult<Vec<String>, String> {
        SqliteTrainingLibrary::new(self.database_path.clone()).training_origins()
    }

    fn query_training(
        &self,
        range: &TrainingDateRange,
    ) -> StandardResult<Vec<TrainingSession>, String> {
        SqliteTrainingLibrary::new(self.database_path.clone()).query_training(range)
    }
}

impl SleepLibraryPort for SqliteLongitudinalLibrary {
    fn sleep_bounds(&self) -> StandardResult<Option<SleepDateRange>, String> {
        SqliteSleepLibrary::new(self.database_path.clone()).sleep_bounds()
    }

    fn sleep_origins(&self) -> StandardResult<Vec<String>, String> {
        SqliteSleepLibrary::new(self.database_path.clone()).sleep_origins()
    }

    fn query_sleep(
        &self,
        range: &SleepDateRange,
    ) -> StandardResult<Vec<SleepLibraryPeriod>, String> {
        SqliteSleepLibrary::new(self.database_path.clone()).query_sleep(range)
    }

    fn query_sleep_period(
        &self,
        series_ref: &str,
        sleep_date: &str,
    ) -> StandardResult<Option<SleepPeriod>, String> {
        SqliteSleepLibrary::new(self.database_path.clone())
            .query_sleep_period(series_ref, sleep_date)
    }
}

impl RecoveryLibraryPort for SqliteLongitudinalLibrary {
    fn recovery_bounds(&self) -> StandardResult<Option<RecoveryDateRange>, String> {
        SqliteRecoveryLibrary::new(self.database_path.clone()).recovery_bounds()
    }

    fn recovery_origins(&self) -> StandardResult<Vec<String>, String> {
        SqliteRecoveryLibrary::new(self.database_path.clone()).recovery_origins()
    }

    fn query_recovery(
        &self,
        range: &RecoveryDateRange,
    ) -> StandardResult<Vec<RecoveryLibraryNight>, String> {
        SqliteRecoveryLibrary::new(self.database_path.clone()).query_recovery(range)
    }

    fn query_recovery_night(
        &self,
        series_ref: &str,
        recovery_date: &str,
    ) -> StandardResult<Option<NightlyRecovery>, String> {
        SqliteRecoveryLibrary::new(self.database_path.clone())
            .query_recovery_night(series_ref, recovery_date)
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

    fn staged_sleep_result_json(night: &str) -> String {
        format!(
            r#"[{{
                "night":"{night}",
                "evaluation":{{
                    "sleepType":"SLEEP_PLUS_STAGES",
                    "sleepSpan":"PT8H",
                    "asleepDuration":"PT7H30M",
                    "age":40.5,
                    "analysis":{{
                        "efficiencyPercent":93.75,
                        "continuityIndex":4.2,
                        "continuityClass":4,
                        "feedback":11111
                    }},
                    "interruptions":{{
                        "totalDuration":"PT30M",
                        "longDuration":"PT20M",
                        "shortDuration":"PT10M",
                        "totalCount":3,
                        "longCount":1,
                        "shortCount":2
                    }},
                    "phaseDurations":{{
                        "wake":"PT30M",
                        "rem":"PT1H30M",
                        "light":"PT4H",
                        "deep":"PT1H30M",
                        "unknown":"PT30M",
                        "remPercentage":20.0,
                        "deepPercentage":20.0
                    }}
                }},
                "sleepResult":{{
                    "hypnogram":{{
                        "sleepStart":"2026-03-28T22:30:00+01:00",
                        "sleepEnd":"2026-03-29T07:30:00+02:00",
                        "rating":"SLEPT_QUITE_WELL",
                        "sleepGoal":"PT8H",
                        "batteryRanOut":false,
                        "alarmSnoozeTimes":[],
                        "birthday":"1985-01-01",
                        "deviceId":"synthetic-device",
                        "sleepStartOffset":0,
                        "sleepEndOffset":0,
                        "sleepStateChanges":[
                            {{"offsetFromStart":"PT0S","state":"WAKE"}},
                            {{"offsetFromStart":"PT30M","state":"NONREM2"}},
                            {{"offsetFromStart":"PT2H","state":"NONREM3"}},
                            {{"offsetFromStart":"PT3H30M","state":"REM"}},
                            {{"offsetFromStart":"PT7H30M","state":"WS_UNKNOWN"}}
                        ]
                    }},
                    "sleepCycles":{{
                        "cycles":{{
                            "sleepCycleModels":[
                                {{"secondsFromSleepStart":0,"sleepDepthStart":2}},
                                {{"secondsFromSleepStart":14400,"sleepDepthStart":3}}
                            ]
                        }}
                    }}
                }}
            }}]"#
        )
    }

    fn basic_sleep_result_json(night: &str) -> String {
        format!(
            r#"[{{
                "night":"{night}",
                "evaluation":{{
                    "sleepType":"SLEEP_PLUS",
                    "sleepSpan":"PT8H",
                    "asleepDuration":"PT7H30M",
                    "age":40,
                    "analysis":{{
                        "efficiencyPercent":93.75,
                        "continuityIndex":4,
                        "continuityClass":4,
                        "feedback":11111
                    }},
                    "interruptions":{{
                        "totalDuration":"PT30M",
                        "longDuration":"PT20M",
                        "shortDuration":"PT10M",
                        "totalCount":3,
                        "longCount":1,
                        "shortCount":2
                    }}
                }},
                "sleepResult":{{
                    "hypnogram":{{
                        "sleepStart":"2026-01-02T22:30:00-05:00",
                        "sleepEnd":"2026-01-03T06:30:00-05:00",
                        "rating":"UNKNOWN",
                        "alarmSnoozeTimes":[],
                        "birthday":"1985-01-01",
                        "deviceId":"synthetic-device",
                        "sleepStartOffset":0,
                        "sleepEndOffset":0,
                        "sleepStateChanges":[]
                    }}
                }}
            }}]"#
        )
    }

    fn sleep_score_json(night: &str, overall: f64) -> String {
        format!(
            r#"[{{
                "night":"{night}",
                "sleepScoreBaselines":{{
                    "sleepTimeAverageMinutes":450,
                    "longInterruptionsAverageTimeMinutes":20
                }},
                "sleepScoreResult":{{
                    "sleepScore":{overall},
                    "sleepTimeOwnTargetScore":80,
                    "sleepTimeRecommendationScore":78,
                    "continuityScore":84,
                    "efficiencyScore":86,
                    "remScore":76,
                    "n3Score":81,
                    "longInterruptionsScore":79,
                    "groupDurationScore":79,
                    "groupSolidityScore":83,
                    "groupRefreshScore":78.5,
                    "scoreRate":4
                }}
            }}]"#
        )
    }

    fn minimal_nightly_recovery_json(night: &str) -> String {
        format!(
            r#"[{{
                "night":"{night}",
                "meanNightlyRecoveryRri":900,
                "meanNightlyRecoveryRespirationInterval":4100
            }}]"#
        )
    }

    fn complete_nightly_recovery_json(night: &str) -> String {
        format!(
            r#"[{{
                "night":"{night}",
                "meanNightlyRecoveryRri":900,
                "meanNightlyRecoveryRmssd":42,
                "meanNightlyRecoveryRespirationInterval":4100,
                "ansRate":4,
                "ansStatus":1.5,
                "recoveryIndicator":5,
                "recoveryIndicatorSubLevel":2,
                "meanBaselineRespirationInterval":4200,
                "meanBaselineRmssd":40,
                "meanBaselineRri":910,
                "sdBaselineRespirationInterval":120,
                "sdBaselineRmssd":8,
                "sdBaselineRri":30,
                "exerciseTip":"Choose a steady synthetic session.",
                "sleepTip":"Keep a consistent synthetic schedule.",
                "vitalityTip":"Plan a synthetic restorative break."
            }}]"#
        )
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
    fn imports_a_training_summary_without_persisting_excluded_detail() {
        let harness = Harness::new();
        let archive = harness.archive(
            "training-summary.zip",
            &[
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"username":"fixture-training-claim"}"#,
                ),
                (
                    "training-session_2026-01-02T10-30-00_42-11111111-2222-4333-8444-555555555555.json",
                    r#"{
                    "identifier":{"id":"synthetic-session"},
                    "created":"2026-01-02T12:00:00.000",
                    "modified":"2026-01-02T12:05:00.000",
                    "startTime":"2026-01-02T10:30:00",
                    "stopTime":"2026-01-02T11:30:00",
                    "timezoneOffsetMinutes":60,
                    "durationMillis":3600000,
                    "distanceMeters":10000.5,
                    "calories":650,
                    "hrAvg":145,
                    "hrMax":178,
                    "sport":{"id":"synthetic-sport"},
                    "latitude":12.5,
                    "longitude":-4.5,
                    "exercises":[{
                        "identifier":{"id":"synthetic-exercise"},
                        "sport":{"id":"synthetic-sport"},
                        "route":{"wayPoints":[{"latitude":12.5,"longitude":-4.5}]},
                        "samples":{"samples":[{"type":"HEART_RATE","values":[120,121]}]}
                    }]
                    }"#,
                ),
            ],
        );

        let report =
            import_polar_archive(&harness.database(), &archive).expect("training summary import");

        assert_eq!(report.recognized_artifacts, 2);
        assert_eq!(report.new_observations, 1);
        let history = query_training_sessions(&harness.database()).expect("training history");
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].origin_id.len(), 32);
        let origin_id = history[0].origin_id.clone();
        assert_eq!(
            history,
            vec![TrainingSession {
                origin_id,
                session_id: "synthetic-session".to_owned(),
                started_at_local: "2026-01-02T10:30:00".to_owned(),
                stopped_at_local: "2026-01-02T11:30:00".to_owned(),
                utc_offset_minutes: Some(60),
                duration_milliseconds: 3_600_000,
                distance_meters: Some(10_000.5),
                energy_kilocalories: Some(650),
                average_heart_rate_bpm: Some(145),
                maximum_heart_rate_bpm: Some(178),
                sport_ref: Some("synthetic-sport".to_owned()),
                exercise_count: Some(1),
            }]
        );
        assert_eq!(
            query_training_bounds(&harness.database()).expect("training bounds"),
            Some(TrainingDateRange {
                from: "2026-01-02".to_owned(),
                through: "2026-01-02".to_owned(),
            })
        );
        assert_eq!(
            query_training_origins(&harness.database()).expect("training origins"),
            vec![history[0].origin_id.clone()]
        );
        assert_eq!(
            query_training_between(&harness.database(), Some("2026-01-02"), Some("2026-01-02"))
                .expect("training range"),
            history
        );
        assert!(query_training_between(
            &harness.database(),
            Some("2026-01-03"),
            Some("2026-01-03")
        )
        .expect("empty training range")
        .is_empty());
        let library = SqliteTrainingLibrary::new(harness.database());
        let overview = query_default_training_overview(&library).expect("training read model");
        assert_eq!(overview.series.len(), 1);
        assert_eq!(overview.series[0].summary.session_count, 1);
        assert_eq!(overview.series[0].sessions.len(), 1);

        let connection = Connection::open(harness.database()).expect("database");
        let table_names = connection
            .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name")
            .expect("table query")
            .query_map([], |row| row.get::<_, String>(0))
            .expect("table rows")
            .collect::<std::result::Result<Vec<_>, _>>()
            .expect("table names");
        assert!(!table_names.iter().any(|name| {
            name.contains("route") || name.contains("sample") || name.contains("waypoint")
        }));
    }

    #[test]
    fn imports_complete_nightly_recovery_without_persisting_unidentifiable_samples() {
        let harness = Harness::new();
        let recovery_json = complete_nightly_recovery_json("2026-04-01");
        let archive = harness.archive(
            "nightly-recovery.zip",
            &[
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"username":"fixture-recovery-claim"}"#,
                ),
                (
                    "nightly_recovery_42-11111111-2222-4333-8444-555555555555.json",
                    &recovery_json,
                ),
                (
                    "nightly_recovery_blob_42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"hrvData":{"samples":[37,41]},"breathingRateData":{"samples":[14,15]}}"#,
                ),
            ],
        );

        let report =
            import_polar_archive(&harness.database(), &archive).expect("nightly recovery import");

        assert_eq!(report.recognized_artifacts, 2);
        assert_eq!(report.new_observations, 1);
        let history = query_nightly_recoveries(&harness.database()).expect("recovery history");
        assert_eq!(history.len(), 1);
        let recovery = &history[0];
        assert_eq!(recovery.origin_id.len(), 32);
        assert_eq!(recovery.recovery_date, "2026-04-01");
        assert_eq!(recovery.beat_to_beat_interval_milliseconds, 900);
        assert_eq!(recovery.heart_rate_variability_rmssd_milliseconds, Some(42));
        assert_eq!(recovery.breathing_interval_milliseconds, 4_100);
        assert_eq!(
            recovery.source_assessment,
            Some(SourceSpecificRecoveryAssessment {
                scheme: NIGHTLY_RECOVERY_SCHEME.to_owned(),
                autonomic_charge: 1.5,
                autonomic_status: 4,
                overall_status: 5,
                overall_sublevel: 2,
            })
        );
        assert_eq!(
            recovery.source_baseline,
            Some(SourceSpecificRecoveryBaseline {
                scheme: NIGHTLY_RECOVERY_SCHEME.to_owned(),
                mean_beat_to_beat_interval_milliseconds: 910,
                standard_deviation_beat_to_beat_interval_milliseconds: 30,
                mean_heart_rate_variability_rmssd_milliseconds: Some(40),
                standard_deviation_heart_rate_variability_rmssd_milliseconds: Some(8),
                mean_breathing_interval_milliseconds: 4_200,
                standard_deviation_breathing_interval_milliseconds: 120,
            })
        );
        assert_eq!(
            recovery.source_guidance,
            Some(SourceSpecificRecoveryGuidance {
                scheme: NIGHTLY_RECOVERY_SCHEME.to_owned(),
                exercise: "Choose a steady synthetic session.".to_owned(),
                sleep: "Keep a consistent synthetic schedule.".to_owned(),
                vitality: "Plan a synthetic restorative break.".to_owned(),
            })
        );
        assert_eq!(
            query_nightly_recovery_between(
                &harness.database(),
                Some("2026-04-01"),
                Some("2026-04-01")
            )
            .expect("recovery range"),
            history
        );
        assert!(query_nightly_recovery_between(
            &harness.database(),
            Some("2026-04-02"),
            Some("2026-04-02")
        )
        .expect("empty recovery range")
        .is_empty());
        assert_eq!(
            query_nightly_recovery(&harness.database(), &recovery.origin_id, "2026-04-01")
                .expect("recovery identity"),
            Some(recovery.clone())
        );
        assert_eq!(
            query_nightly_recoveries(&harness.database()).expect("reopened recovery history"),
            history
        );
        assert_eq!(
            query_recovery_bounds(&harness.database()).expect("recovery bounds"),
            Some(RecoveryDateRange {
                from: "2026-04-01".to_owned(),
                through: "2026-04-01".to_owned(),
            })
        );
        assert_eq!(
            query_recovery_origins(&harness.database()).expect("recovery origins"),
            vec![recovery.origin_id.clone()]
        );
        let lightweight = query_recovery_library_between(
            &harness.database(),
            Some("2026-04-01"),
            Some("2026-04-01"),
        )
        .expect("lightweight recovery range");
        assert_eq!(lightweight.len(), 1);
        assert_eq!(lightweight[0].source_assessment, recovery.source_assessment);
        assert!(lightweight[0].source_baseline_available);
        assert!(lightweight[0].source_guidance_available);
        let library = SqliteRecoveryLibrary::new(harness.database());
        let overview =
            query_default_recovery_overview(&library).expect("recovery overview read model");
        assert_eq!(overview.series.len(), 1);
        assert_eq!(overview.series[0].summary.observed_nights, 1);
        assert_eq!(overview.series[0].summary.rmssd_night_count, 1);
        assert_eq!(overview.series[0].summary.assessment_night_count, 1);
        assert_eq!(overview.series[0].summary.baseline_night_count, 1);
        assert_eq!(overview.series[0].summary.guidance_night_count, 1);

        let longitudinal =
            query_longitudinal_overview(&SqliteLongitudinalLibrary::new(harness.database()), None)
                .expect("partial longitudinal overview");
        assert_eq!(longitudinal.series.len(), 1);
        assert_eq!(longitudinal.series[0].activity.observed_days, 0);
        assert_eq!(longitudinal.series[0].training.session_count, 0);
        assert_eq!(longitudinal.series[0].sleep.observed_nights, 0);
        assert_eq!(longitudinal.series[0].recovery.observed_nights, 1);
        assert_eq!(
            longitudinal.series[0].days[0]
                .recovery
                .beat_to_beat_interval_milliseconds,
            Some(900)
        );

        let outcome = query_latest_import_outcome(&harness.database())
            .expect("recovery outcome query")
            .expect("recovery outcome");
        assert!(outcome.artifact_families.iter().any(|family| {
            family.family_code.as_deref() == Some("polar-flow-nightly-recovery")
                && family.classification == ArtifactClassification::Supported
                && family.reason_code == "mapped-recovery-summaries"
        }));
        assert!(outcome.artifact_families.iter().any(|family| {
            family.family_code.as_deref() == Some("polar-flow-nightly-recovery-blob")
                && family.classification == ArtifactClassification::DeliberatelyIgnored
                && family.reason_code == "excluded-unidentifiable-recovery-samples"
        }));

        let connection = Connection::open(harness.database()).expect("database");
        let provenance = connection
            .query_row(
                "SELECT source_provider, source_adapter_version, mapping_version,
                        source_record_locator, reconciliation_decision,
                        contributes_to_visible_state, length(source_artifact_sha256)
                 FROM nightly_recovery_provenance",
                [],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, bool>(5)?,
                        row.get::<_, i64>(6)?,
                    ))
                },
            )
            .expect("recovery provenance");
        assert_eq!(
            provenance,
            (
                SOURCE_PROVIDER.to_owned(),
                SOURCE_ADAPTER_VERSION.to_owned(),
                NIGHTLY_RECOVERY_MAPPING_VERSION.to_owned(),
                "json-index:0".to_owned(),
                "create".to_owned(),
                true,
                64,
            )
        );
        let table_names = connection
            .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name")
            .expect("table query")
            .query_map([], |row| row.get::<_, String>(0))
            .expect("table rows")
            .collect::<std::result::Result<Vec<_>, _>>()
            .expect("table names");
        assert!(!table_names
            .iter()
            .any(|name| name.contains("recovery_blob") || name.contains("recovery_sample")));
        assert!(connection
            .query_row(
                "SELECT source_artifact_sha256 IS NULL
                     FROM import_artifact_coverage
                     WHERE artifact_family = 'polar-flow-nightly-recovery-blob'",
                [],
                |row| row.get::<_, bool>(0),
            )
            .expect("excluded blob evidence"));
    }

    #[test]
    fn keeps_recovery_guidance_out_of_overview_queries_and_validates_exact_detail() {
        let harness = Harness::new();
        let recovery_json = complete_nightly_recovery_json("2026-04-01");
        let archive = harness.archive(
            "recovery-read-boundary.zip",
            &[
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"username":"fixture-recovery-read-boundary"}"#,
                ),
                (
                    "nightly_recovery_42-11111111-2222-4333-8444-555555555555.json",
                    &recovery_json,
                ),
            ],
        );
        import_polar_archive(&harness.database(), &archive).expect("recovery import");
        let origin_id = query_recovery_origins(&harness.database())
            .expect("recovery origins")
            .into_iter()
            .next()
            .expect("recovery origin");

        let connection = Connection::open(harness.database()).expect("database");
        connection
            .pragma_update(None, "ignore_check_constraints", true)
            .expect("test corruption mode");
        connection
            .execute(
                "UPDATE nightly_recovery SET exercise_guidance = ?1",
                params!["x".repeat(4_097)],
            )
            .expect("corrupt guidance detail");
        drop(connection);

        let library = SqliteRecoveryLibrary::new(harness.database());
        let overview =
            query_default_recovery_overview(&library).expect("lightweight recovery overview");
        assert_eq!(overview.series[0].summary.guidance_night_count, 1);
        assert!(
            overview.series[0].days[0]
                .recovery
                .as_ref()
                .expect("recovery night")
                .source_guidance_available
        );
        assert!(matches!(
            query_recovery_detail(&library, &origin_id, "2026-04-01"),
            Err(ApplicationError::Query(_))
        ));
    }

    #[test]
    fn reconciles_nightly_recovery_without_archive_order_precedence() {
        let harness = Harness::new();
        let minimal = minimal_nightly_recovery_json("2026-04-01");
        let complete = complete_nightly_recovery_json("2026-04-01");
        let changed = complete.replacen(
            "\"meanNightlyRecoveryRri\":900",
            "\"meanNightlyRecoveryRri\":901",
            1,
        );
        let packages = [
            (
                "recovery-first.zip",
                "11111111-2222-4333-8444-555555555555",
                &minimal,
            ),
            (
                "recovery-equivalent.zip",
                "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
                &minimal,
            ),
            (
                "recovery-enriched.zip",
                "12345678-90ab-4cde-8f01-234567890abc",
                &complete,
            ),
            (
                "recovery-reduced.zip",
                "abcdefab-cdef-4abc-8def-abcdefabcdef",
                &minimal,
            ),
            (
                "recovery-conflict.zip",
                "fedcbafe-dcba-4fed-8cba-fedcbafedcba",
                &changed,
            ),
        ];
        let archives = packages
            .iter()
            .map(|(archive_name, token, json)| {
                let locator = format!("nightly_recovery_42-{token}.json");
                harness.archive(
                    archive_name,
                    &[
                        (
                            "account-data-42-11111111-2222-4333-8444-555555555555.json",
                            r#"{"username":"fixture-recovery-reimport-claim"}"#,
                        ),
                        (locator.as_str(), json.as_str()),
                    ],
                )
            })
            .collect::<Vec<_>>();

        let created =
            import_polar_archive(&harness.database(), &archives[0]).expect("create recovery");
        let equivalent =
            import_polar_archive(&harness.database(), &archives[1]).expect("equivalent recovery");
        let enriched =
            import_polar_archive(&harness.database(), &archives[2]).expect("enrich recovery");
        let preserved =
            import_polar_archive(&harness.database(), &archives[3]).expect("preserve recovery");
        let conflicted =
            import_polar_archive(&harness.database(), &archives[4]).expect("conflict recovery");

        assert_eq!(created.new_observations, 1);
        assert_eq!(equivalent.equivalent_observations, 1);
        assert_eq!(enriched.enriched_observations, 1);
        assert_eq!(preserved.preserved_observations, 1);
        assert_eq!(conflicted.conflicts, 1);
        let history = query_nightly_recoveries(&harness.database()).expect("recovery history");
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].beat_to_beat_interval_milliseconds, 900);
        assert_eq!(
            history[0].heart_rate_variability_rmssd_milliseconds,
            Some(42)
        );
        assert!(history[0].source_assessment.is_some());
        assert!(history[0].source_baseline.is_some());
        assert!(history[0].source_guidance.is_some());

        let connection = Connection::open(harness.database()).expect("database");
        let decisions = connection
            .prepare(
                "SELECT reconciliation_decision, contributes_to_visible_state
                 FROM nightly_recovery_provenance ORDER BY id",
            )
            .expect("recovery decisions query")
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, bool>(1)?))
            })
            .expect("recovery decision rows")
            .collect::<std::result::Result<Vec<_>, _>>()
            .expect("recovery decisions");
        assert_eq!(
            decisions,
            vec![
                ("create".to_owned(), true),
                ("equivalent".to_owned(), true),
                ("enrich".to_owned(), true),
                ("preserve".to_owned(), false),
                ("conflict".to_owned(), false),
            ]
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM nightly_recovery_conflict",
                    [],
                    |row| { row.get::<_, i64>(0) }
                )
                .expect("recovery conflict count"),
            1
        );
    }

    #[test]
    fn validates_nightly_recovery_shape_groups_and_ranges() {
        let locator = "nightly_recovery_42-11111111-2222-4333-8444-555555555555.json";
        let hash = "0".repeat(64);
        let minimal = minimal_nightly_recovery_json("2026-04-01");
        let mapped =
            decode_nightly_recoveries("synthetic-origin", locator, &hash, minimal.as_bytes())
                .expect("minimal recovery");
        assert_eq!(mapped.len(), 1);
        assert_eq!(mapped[0].source_record_locator, "json-index:0");
        assert_eq!(
            mapped[0]
                .observation
                .heart_rate_variability_rmssd_milliseconds,
            None
        );
        assert_eq!(mapped[0].observation.source_assessment, None);
        assert_eq!(mapped[0].observation.source_baseline, None);
        assert_eq!(mapped[0].observation.source_guidance, None);

        let complete = complete_nightly_recovery_json("2026-04-01");
        let without_baseline_rmssd = complete
            .replacen("\n                \"meanBaselineRmssd\":40,", "", 1)
            .replacen("\n                \"sdBaselineRmssd\":8,", "", 1);
        let mapped_without_baseline_rmssd = decode_nightly_recoveries(
            "synthetic-origin",
            locator,
            &hash,
            without_baseline_rmssd.as_bytes(),
        )
        .expect("recovery without baseline RMSSD pair");
        let baseline = mapped_without_baseline_rmssd[0]
            .observation
            .source_baseline
            .as_ref()
            .expect("baseline");
        assert_eq!(
            baseline.mean_heart_rate_variability_rmssd_milliseconds,
            None
        );
        assert_eq!(
            baseline.standard_deviation_heart_rate_variability_rmssd_milliseconds,
            None
        );

        for invalid in [
            minimal.replacen("2026-04-01", "2026-02-30", 1),
            minimal.replacen(
                "\"meanNightlyRecoveryRri\":900",
                "\"meanNightlyRecoveryRri\":0",
                1,
            ),
            minimal.replacen(
                "\"meanNightlyRecoveryRespirationInterval\":4100",
                "\"meanNightlyRecoveryRespirationInterval\":-1",
                1,
            ),
            complete.replacen("\"ansRate\":4,", "", 1),
            complete.replacen("\"ansStatus\":1.5", "\"ansStatus\":11", 1),
            complete.replacen("\"recoveryIndicator\":5", "\"recoveryIndicator\":7", 1),
            complete.replacen("\"meanBaselineRri\":910,", "", 1),
            complete.replacen("\"sdBaselineRmssd\":8,", "", 1),
            complete.replacen(
                "\"sleepTip\":\"Keep a consistent synthetic schedule.\",",
                "",
                1,
            ),
            complete.replacen(
                "\"exerciseTip\":\"Choose a steady synthetic session.\"",
                "\"exerciseTip\":\" \"",
                1,
            ),
        ] {
            assert!(decode_nightly_recoveries(
                "synthetic-origin",
                locator,
                &hash,
                invalid.as_bytes(),
            )
            .is_err());
        }
    }

    #[test]
    fn rejects_duplicate_nightly_recovery_identity_atomically() {
        let harness = Harness::new();
        let recovery = minimal_nightly_recovery_json("2026-04-01");
        let archive = harness.archive(
            "duplicate-recovery.zip",
            &[
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"username":"fixture-duplicate-recovery-claim"}"#,
                ),
                (
                    "nightly_recovery_42-11111111-2222-4333-8444-555555555555.json",
                    &recovery,
                ),
                (
                    "nightly_recovery_77-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json",
                    &recovery,
                ),
            ],
        );

        let error = import_polar_archive(&harness.database(), &archive)
            .expect_err("duplicate recovery identity");

        assert!(matches!(
            error,
            ImportError::InvalidArtifact {
                reason_code: "duplicate-nightly-recovery-date",
                ..
            }
        ));
        assert!(query_nightly_recoveries(&harness.database())
            .expect("empty recovery history")
            .is_empty());
        let outcome = query_latest_import_outcome(&harness.database())
            .expect("duplicate recovery outcome query")
            .expect("duplicate recovery outcome");
        assert_eq!(outcome.state, ImportOperationState::Rejected);
        assert!(outcome.artifact_families.iter().any(|family| {
            family.family_code.as_deref() == Some("polar-flow-nightly-recovery")
                && family.classification == ArtifactClassification::Invalid
                && family.reason_code == "duplicate-nightly-recovery-date"
                && family.artifact_count == 2
        }));
    }

    #[test]
    fn rolls_back_all_nightly_recovery_rows_after_interruption() {
        let harness = Harness::new();
        let first = minimal_nightly_recovery_json("2026-04-01");
        let second = complete_nightly_recovery_json("2026-04-02");
        let combined = format!(
            "[{},{}]",
            &first[1..first.len() - 1],
            &second[1..second.len() - 1]
        );
        let archive = harness.archive(
            "interrupted-recovery.zip",
            &[
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"username":"fixture-interrupted-recovery-claim"}"#,
                ),
                (
                    "nightly_recovery_42-11111111-2222-4333-8444-555555555555.json",
                    &combined,
                ),
            ],
        );

        let error = import_polar_archive_with_interruption(&harness.database(), &archive, Some(1))
            .expect_err("interrupted recovery import");

        assert!(
            matches!(error, ImportError::InjectedInterruption(1)),
            "unexpected recovery interruption error: {error:?}"
        );
        assert!(query_nightly_recoveries(&harness.database())
            .expect("rolled-back recovery history")
            .is_empty());
        assert_eq!(
            recover_interrupted_imports(&harness.database()).expect("recovery startup"),
            1
        );
        assert!(query_nightly_recoveries(&harness.database())
            .expect("empty recovered history")
            .is_empty());
    }

    #[test]
    fn imports_split_sleep_history_with_offsets_phases_scores_and_restart() {
        let harness = Harness::new();
        let result_json = staged_sleep_result_json("2026-03-29");
        let score_json = sleep_score_json("2026-03-29", 82.0);
        let archive = harness.archive(
            "sleep-history.zip",
            &[
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"username":"fixture-sleep-claim"}"#,
                ),
                (
                    "sleep_result_42-11111111-2222-4333-8444-555555555555.json",
                    &result_json,
                ),
                (
                    "sleep_score_42-11111111-2222-4333-8444-555555555555.json",
                    &score_json,
                ),
            ],
        );

        let report =
            import_polar_archive(&harness.database(), &archive).expect("sleep history import");

        assert_eq!(report.recognized_artifacts, 3);
        assert_eq!(report.new_observations, 1);
        let history = query_sleep_periods(&harness.database()).expect("sleep history");
        assert_eq!(history.len(), 1);
        let period = &history[0];
        assert_eq!(period.origin_id.len(), 32);
        assert_eq!(period.sleep_date, "2026-03-29");
        assert_eq!(period.started_at, "2026-03-28T22:30:00+01:00");
        assert_eq!(period.ended_at, "2026-03-29T07:30:00+02:00");
        assert_eq!(period.span_milliseconds, 28_800_000);
        assert_eq!(period.asleep_milliseconds, 27_000_000);
        assert_eq!(period.self_reported_rating, Some(4));
        assert_eq!(period.cycle_count, Some(2));
        assert_eq!(period.recording_ended_by_power_loss, Some(false));
        assert_eq!(
            period.phase_summary,
            Some(SleepPhaseSummary {
                wake_milliseconds: 1_800_000,
                rem_milliseconds: 5_400_000,
                light_milliseconds: 14_400_000,
                deep_milliseconds: 5_400_000,
                unrecognized_milliseconds: 1_800_000,
            })
        );
        assert_eq!(period.stage_transitions.as_ref().map(Vec::len), Some(5));
        assert_eq!(
            period
                .stage_transitions
                .as_ref()
                .and_then(|transitions| transitions.last())
                .map(|transition| (transition.offset_milliseconds, transition.stage)),
            Some((27_000_000, SleepStage::Unrecognized))
        );
        let score = period.score.as_ref().expect("sleep score");
        assert_eq!(score.overall, 82.0);
        assert_eq!(score.regeneration, 78.5);
        assert_eq!(score.relative_rating, Some(4));
        assert_eq!(
            query_sleep_bounds(&harness.database()).expect("sleep bounds"),
            Some(SleepDateRange {
                from: "2026-03-29".to_owned(),
                through: "2026-03-29".to_owned(),
            })
        );
        assert_eq!(
            query_sleep_origins(&harness.database()).expect("sleep origins"),
            vec![period.origin_id.clone()]
        );
        assert_eq!(
            query_sleep_between(&harness.database(), Some("2026-03-29"), Some("2026-03-29"))
                .expect("sleep range"),
            history
        );
        assert!(
            query_sleep_between(&harness.database(), Some("2026-03-30"), Some("2026-03-30"))
                .expect("empty sleep range")
                .is_empty()
        );
        assert_eq!(
            query_sleep_period(&harness.database(), &period.origin_id, "2026-03-29")
                .expect("sleep identity"),
            Some(period.clone())
        );
        assert_eq!(
            query_sleep_period(&harness.database(), &period.origin_id, "2026-03-30")
                .expect("missing sleep identity"),
            None
        );
        let library = SqliteSleepLibrary::new(harness.database());
        let overview = query_default_sleep_overview(&library).expect("sleep read model");
        assert_eq!(overview.series.len(), 1);
        assert_eq!(overview.series[0].summary.observed_nights, 1);
        assert_eq!(overview.series[0].summary.phase_night_count, 1);
        assert_eq!(overview.series[0].summary.score_night_count, 1);
        assert_eq!(overview.series[0].days.len(), 1);

        let reopened = query_sleep_periods(&harness.database()).expect("reopened sleep history");
        assert_eq!(reopened, history);
        let outcome = query_latest_import_outcome(&harness.database())
            .expect("sleep outcome query")
            .expect("sleep outcome");
        assert!(outcome.artifact_families.iter().any(|family| {
            family.family_code.as_deref() == Some("polar-flow-sleep-result")
                && family.classification == ArtifactClassification::Supported
                && family.reason_code == "mapped-sleep-periods"
        }));
        assert!(outcome.artifact_families.iter().any(|family| {
            family.family_code.as_deref() == Some("polar-flow-sleep-score")
                && family.classification == ArtifactClassification::Supported
                && family.reason_code == "mapped-sleep-scores"
        }));

        let connection = Connection::open(harness.database()).expect("database");
        let provenance = connection
            .query_row(
                "SELECT source_provider, source_adapter_version, mapping_version,
                        reconciliation_decision, contributes_to_visible_state,
                        length(result_artifact_sha256), length(score_artifact_sha256)
                 FROM sleep_period_provenance",
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
                    ))
                },
            )
            .expect("sleep provenance");
        assert_eq!(
            provenance,
            (
                SOURCE_PROVIDER.to_owned(),
                SOURCE_ADAPTER_VERSION.to_owned(),
                SLEEP_MAPPING_VERSION.to_owned(),
                "create".to_owned(),
                true,
                64,
                64,
            )
        );
    }

    #[test]
    fn keeps_sleep_timelines_out_of_overview_queries_and_validates_exact_detail() {
        let harness = Harness::new();
        let result_json = staged_sleep_result_json("2026-03-29");
        let archive = harness.archive(
            "sleep-read-boundary.zip",
            &[
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"username":"fixture-sleep-read-boundary"}"#,
                ),
                (
                    "sleep_result_42-11111111-2222-4333-8444-555555555555.json",
                    &result_json,
                ),
            ],
        );
        import_polar_archive(&harness.database(), &archive).expect("sleep import");
        let origin_id = query_sleep_origins(&harness.database())
            .expect("sleep origins")
            .into_iter()
            .next()
            .expect("sleep origin");

        let connection = Connection::open(harness.database()).expect("database");
        connection
            .pragma_update(None, "ignore_check_constraints", true)
            .expect("test corruption mode");
        connection
            .execute(
                "UPDATE sleep_stage_transition SET stage = 'invalid-test-stage'",
                [],
            )
            .expect("corrupt timeline detail");
        drop(connection);

        let library = SqliteSleepLibrary::new(harness.database());
        let overview = query_default_sleep_overview(&library).expect("lightweight overview");
        assert_eq!(overview.series[0].summary.stage_timeline_night_count, 1);
        assert!(matches!(
            query_sleep_period(&harness.database(), &origin_id, "2026-03-29"),
            Err(ImportError::InvalidSleepLibrary(_))
        ));
    }

    #[test]
    fn keeps_sleep_progress_bounded_by_source_artifacts() {
        let harness = Harness::new();
        let first = basic_sleep_result_json("2026-01-03");
        let second = basic_sleep_result_json("2026-01-04");
        let third = staged_sleep_result_json("2026-03-29");
        let result_json = format!(
            "[{},{},{}]",
            &first[1..first.len() - 1],
            &second[1..second.len() - 1],
            &third[1..third.len() - 1]
        );
        let archive = harness.archive(
            "sleep-progress.zip",
            &[
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"username":"fixture-sleep-progress-claim"}"#,
                ),
                (
                    "sleep_result_42-11111111-2222-4333-8444-555555555555.json",
                    &result_json,
                ),
            ],
        );
        let cancellation = AtomicBool::new(false);
        let mut progress = Vec::new();

        let report = import_polar_archive_with_progress(
            &harness.database(),
            &archive,
            &cancellation,
            |event| progress.push(event),
        )
        .expect("multi-period sleep import");

        assert_eq!(report.recognized_artifacts, 2);
        assert_eq!(report.new_observations, 3);
        let committing = progress
            .iter()
            .find(|event| event.phase == ImportPhase::Committing)
            .expect("committing progress");
        assert_eq!(committing.completed_artifacts, 2);
        assert_eq!(committing.total_artifacts, Some(2));
        assert!(progress.iter().all(|event| {
            event
                .total_artifacts
                .is_none_or(|total| event.completed_artifacts <= total)
        }));
    }

    #[test]
    fn enriches_missing_sleep_scores_and_preserves_unordered_conflicts() {
        let harness = Harness::new();
        let result_json = basic_sleep_result_json("2026-01-03");
        let score_json = sleep_score_json("2026-01-03", 82.0);
        let changed_score_json = sleep_score_json("2026-01-03", 90.0);
        let package = |name: &str, result_token: &str, score: Option<(&str, &str)>| {
            let result_locator = format!("sleep_result_42-{result_token}.json");
            let mut entries = vec![
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"username":"fixture-sleep-reimport-claim"}"#,
                ),
                (result_locator.as_str(), result_json.as_str()),
            ];
            let score_locator;
            if let Some((token, json)) = score {
                score_locator = format!("sleep_score_42-{token}.json");
                entries.push((score_locator.as_str(), json));
            }
            harness.archive(name, &entries)
        };
        let initial = package(
            "sleep-initial.zip",
            "11111111-2222-4333-8444-555555555555",
            None,
        );
        let enriched = package(
            "sleep-enriched.zip",
            "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
            Some(("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", &score_json)),
        );
        let conflicting = package(
            "sleep-conflict.zip",
            "12345678-90ab-4cde-8f01-234567890abc",
            Some(("12345678-90ab-4cde-8f01-234567890abc", &changed_score_json)),
        );
        let reduced = package(
            "sleep-reduced.zip",
            "abcdefab-cdef-4abc-8def-abcdefabcdef",
            None,
        );

        let created =
            import_polar_archive(&harness.database(), &initial).expect("create sleep period");
        let enriched =
            import_polar_archive(&harness.database(), &enriched).expect("enrich sleep period");
        let conflicted =
            import_polar_archive(&harness.database(), &conflicting).expect("retain sleep conflict");
        let preserved = import_polar_archive(&harness.database(), &reduced)
            .expect("preserve complete sleep period");

        assert_eq!(created.new_observations, 1);
        assert_eq!(enriched.enriched_observations, 1);
        assert_eq!(conflicted.conflicts, 1);
        assert_eq!(preserved.preserved_observations, 1);
        let history = query_sleep_periods(&harness.database()).expect("sleep history");
        assert_eq!(history.len(), 1);
        assert_eq!(
            history[0].score.as_ref().map(|score| score.overall),
            Some(82.0)
        );

        let connection = Connection::open(harness.database()).expect("database");
        let decisions = connection
            .prepare(
                "SELECT reconciliation_decision, contributes_to_visible_state
                 FROM sleep_period_provenance ORDER BY id",
            )
            .expect("sleep decisions query")
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, bool>(1)?))
            })
            .expect("sleep decision rows")
            .collect::<std::result::Result<Vec<_>, _>>()
            .expect("sleep decisions");
        assert_eq!(
            decisions,
            vec![
                ("create".to_owned(), true),
                ("enrich".to_owned(), true),
                ("conflict".to_owned(), false),
                ("preserve".to_owned(), false),
            ]
        );
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM sleep_period_conflict", [], |row| {
                    row.get::<_, i64>(0)
                })
                .expect("sleep conflict count"),
            1
        );
    }

    #[test]
    fn rejects_duplicate_and_orphan_sleep_records_atomically() {
        let cases = [
            (
                "duplicate-sleep.zip",
                vec![
                    (
                        "sleep_result_42-11111111-2222-4333-8444-555555555555.json".to_owned(),
                        basic_sleep_result_json("2026-01-03"),
                    ),
                    (
                        "sleep_result_42-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json".to_owned(),
                        basic_sleep_result_json("2026-01-03"),
                    ),
                ],
                "duplicate-sleep-result-date",
            ),
            (
                "orphan-sleep-score.zip",
                vec![(
                    "sleep_score_42-11111111-2222-4333-8444-555555555555.json".to_owned(),
                    sleep_score_json("2026-01-03", 82.0),
                )],
                "orphan-sleep-score-date",
            ),
        ];

        for (archive_name, records, reason_code) in cases {
            let harness = Harness::new();
            let mut entries = vec![(
                "account-data-42-11111111-2222-4333-8444-555555555555.json",
                r#"{"username":"fixture-invalid-sleep-claim"}"#,
            )];
            entries.extend(
                records
                    .iter()
                    .map(|(locator, json)| (locator.as_str(), json.as_str())),
            );
            let archive = harness.archive(archive_name, &entries);

            let error = import_polar_archive(&harness.database(), &archive)
                .expect_err("invalid split sleep history");
            assert!(matches!(
                error,
                ImportError::InvalidArtifact {
                    reason_code: actual,
                    ..
                } if actual == reason_code
            ));
            assert!(query_sleep_periods(&harness.database())
                .expect("empty sleep history")
                .is_empty());
            let outcome = query_latest_import_outcome(&harness.database())
                .expect("sleep rejection outcome query")
                .expect("sleep rejection outcome");
            assert_eq!(outcome.state, ImportOperationState::Rejected);
            assert!(outcome.artifact_families.iter().any(|family| {
                family.classification == ArtifactClassification::Invalid
                    && family.reason_code == reason_code
            }));
        }
    }

    #[test]
    fn validates_sleep_shape_arithmetic_timeline_and_score_ranges() {
        let result_locator = "sleep_result_42-11111111-2222-4333-8444-555555555555.json";
        let score_locator = "sleep_score_42-11111111-2222-4333-8444-555555555555.json";
        let hash = "0".repeat(64);
        let staged = staged_sleep_result_json("2026-03-29");
        let mapped =
            decode_sleep_results("synthetic-origin", result_locator, &hash, staged.as_bytes())
                .expect("valid staged sleep result");
        assert_eq!(mapped.periods.len(), 1);
        assert!(mapped.periods[0].phase_summary.is_some());
        assert_eq!(
            mapped.periods[0].stage_transitions.as_ref().map(Vec::len),
            Some(5)
        );

        let basic = basic_sleep_result_json("2026-01-03");
        let mapped_basic =
            decode_sleep_results("synthetic-origin", result_locator, &hash, basic.as_bytes())
                .expect("valid basic sleep result");
        assert_eq!(mapped_basic.periods[0].phase_summary, None);
        assert_eq!(mapped_basic.periods[0].sleep_goal_milliseconds, None);
        assert_eq!(mapped_basic.periods[0].stage_transitions, Some(Vec::new()));

        let terminal_wake = staged.replacen(
            r#"{"offsetFromStart":"PT7H30M","state":"WS_UNKNOWN"}"#,
            r#"{"offsetFromStart":"PT7H30M","state":"WS_UNKNOWN"},
                            {"offsetFromStart":"PT8H30M","state":"WAKE"}"#,
            1,
        );
        let mapped_terminal_wake = decode_sleep_results(
            "synthetic-origin",
            result_locator,
            &hash,
            terminal_wake.as_bytes(),
        )
        .expect("valid out-of-period terminal wake marker");
        assert_eq!(
            mapped_terminal_wake.periods[0]
                .stage_transitions
                .as_ref()
                .map(Vec::len),
            Some(5)
        );

        for invalid in [
            staged.replacen("\"sleepSpan\":\"PT8H\"", "\"sleepSpan\":\"PT7H\"", 1),
            staged.replacen("\"sleepSpan\":\"PT8H\"", "\"sleepSpan\":\"P1DT\"", 1),
            staged.replacen("\"state\":\"NONREM2\"", "\"state\":\"FUTURE\"", 1),
            staged.replacen(
                r#"{"offsetFromStart":"PT7H30M","state":"WS_UNKNOWN"}"#,
                r#"{"offsetFromStart":"PT8H30M","state":"WS_UNKNOWN"}"#,
                1,
            ),
            staged.replacen(
                "\"sleepEnd\":\"2026-03-29T07:30:00+02:00\"",
                "\"sleepEnd\":\"2026-03-28T20:00:00+01:00\"",
                1,
            ),
        ] {
            assert!(decode_sleep_results(
                "synthetic-origin",
                result_locator,
                &hash,
                invalid.as_bytes(),
            )
            .is_err());
        }
        let valid_score = sleep_score_json("2026-03-29", 82.0);
        assert_eq!(
            decode_sleep_scores(score_locator, &hash, valid_score.as_bytes())
                .expect("valid sleep score")
                .scores
                .len(),
            1
        );
        let invalid_score = sleep_score_json("2026-03-29", 101.0);
        assert!(decode_sleep_scores(score_locator, &hash, invalid_score.as_bytes()).is_err());
    }

    #[test]
    fn reconciles_training_revisions_without_archive_order_precedence() {
        let harness = Harness::new();
        let training_json = |modified: &str, duration: i64| {
            format!(
                r#"{{
                    "identifier":{{"id":"synthetic-session"}},
                    "created":"2026-01-02T12:00:00.000",
                    "modified":"{modified}",
                    "startTime":"2026-01-02T10:30:00",
                    "stopTime":"2026-01-02T11:30:00",
                    "durationMillis":{duration}
                }}"#
            )
        };
        let first_json = training_json("2026-01-02T12:05:00.000", 3_600_000);
        let equivalent_json = first_json.clone();
        let amended_json = training_json("2026-01-03T09:00:00.000", 3_700_000);
        let older_json = training_json("2026-01-02T13:00:00.000", 3_500_000);
        let conflict_json = training_json("2026-01-03T09:00:00.000", 3_800_000);
        let packages = [
            (
                "first.zip",
                "11111111-2222-4333-8444-555555555555",
                first_json,
            ),
            (
                "equivalent.zip",
                "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
                equivalent_json,
            ),
            (
                "amended.zip",
                "12345678-90ab-4cde-8f01-234567890abc",
                amended_json,
            ),
            (
                "older.zip",
                "abcdefab-cdef-4abc-8def-abcdefabcdef",
                older_json,
            ),
            (
                "conflict.zip",
                "fedcbafe-dcba-4fed-8cba-fedcbafedcba",
                conflict_json,
            ),
        ];
        let archives = packages
            .iter()
            .map(|(archive_name, token, json)| {
                let entry_name = format!("training-session_2026-01-02T10-30-00_42-{token}.json");
                harness.archive(
                    archive_name,
                    &[
                        (
                            "account-data-42-11111111-2222-4333-8444-555555555555.json",
                            r#"{"username":"fixture-training-revision-claim"}"#,
                        ),
                        (entry_name.as_str(), json.as_str()),
                    ],
                )
            })
            .collect::<Vec<_>>();

        let created =
            import_polar_archive(&harness.database(), &archives[0]).expect("create session");
        let equivalent =
            import_polar_archive(&harness.database(), &archives[1]).expect("equivalent session");
        let amended =
            import_polar_archive(&harness.database(), &archives[2]).expect("amend session");
        let preserved = import_polar_archive(&harness.database(), &archives[3])
            .expect("preserve newer session");
        let conflicted = import_polar_archive(&harness.database(), &archives[4])
            .expect("record session conflict");

        assert_eq!(created.new_observations, 1);
        assert_eq!(equivalent.equivalent_observations, 1);
        assert_eq!(amended.amended_observations, 1);
        assert_eq!(preserved.preserved_observations, 1);
        assert_eq!(conflicted.conflicts, 1);
        let history = query_training_sessions(&harness.database()).expect("training history");
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].duration_milliseconds, 3_700_000);

        let connection = Connection::open(harness.database()).expect("database");
        assert_eq!(
            connection
                .query_row(
                    "SELECT source_modified_at_utc FROM training_session",
                    [],
                    |row| row.get::<_, String>(0),
                )
                .expect("current source revision"),
            "2026-01-03T09:00:00"
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM training_session_conflict",
                    [],
                    |row| { row.get::<_, i64>(0) }
                )
                .expect("conflict count"),
            1
        );
        let provenance = connection
            .prepare(
                "SELECT source_provider, source_adapter_version, mapping_version,
                        source_modified_at_utc, reconciliation_decision,
                        contributes_to_visible_state
                 FROM training_session_provenance ORDER BY id",
            )
            .expect("training provenance query")
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, bool>(5)?,
                ))
            })
            .expect("training provenance rows")
            .collect::<std::result::Result<Vec<_>, _>>()
            .expect("training provenance collection");
        assert_eq!(provenance.len(), 5);
        assert!(provenance.iter().all(|row| {
            row.0 == SOURCE_PROVIDER
                && row.1 == SOURCE_ADAPTER_VERSION
                && row.2 == TRAINING_SESSION_MAPPING_VERSION
        }));
        assert_eq!(
            provenance
                .iter()
                .map(|row| (row.3.as_str(), row.4.as_str(), row.5))
                .collect::<Vec<_>>(),
            vec![
                ("2026-01-02T12:05:00", "create", true),
                ("2026-01-02T12:05:00", "equivalent", true),
                ("2026-01-03T09:00:00", "amend", true),
                ("2026-01-02T13:00:00", "preserve", false),
                ("2026-01-03T09:00:00", "conflict", false),
            ]
        );
    }

    #[test]
    fn validates_training_summary_shape_and_value_boundaries() {
        let locator =
            "training-session_2026-01-02T10-30-00_42-11111111-2222-4333-8444-555555555555.json";
        let artifact_sha256 = "0".repeat(64);
        let without_optionals = br#"{
            "identifier":{"id":"synthetic-minimal"},
            "created":"2026-01-02T12:00:00.000",
            "modified":"2026-01-02T12:05:00.000",
            "startTime":"2026-01-02T10:30:00",
            "stopTime":"2026-01-02T10:30:00",
            "durationMillis":0
        }"#;
        let minimal = decode_training_session(
            "synthetic-origin",
            locator,
            &artifact_sha256,
            without_optionals.to_vec(),
        )
        .expect("minimal training summary");
        assert_eq!(minimal.observation.utc_offset_minutes, None);
        assert_eq!(minimal.observation.distance_meters, None);
        assert_eq!(minimal.observation.energy_kilocalories, None);
        assert_eq!(minimal.observation.average_heart_rate_bpm, None);
        assert_eq!(minimal.observation.maximum_heart_rate_bpm, None);
        assert_eq!(minimal.observation.sport_ref, None);
        assert_eq!(minimal.observation.exercise_count, None);

        let multiple = decode_training_session(
            "synthetic-origin",
            locator,
            &artifact_sha256,
            br#"{
                "identifier":{"id":"synthetic-multi"},
                "created":"2026-01-02T12:00:00.123000000",
                "modified":"2026-01-02T12:05:00.123000000",
                "startTime":"2026-01-02T10:30:00.123000000",
                "stopTime":"2026-01-02T11:40:00.123000000",
                "durationMillis":4200000,
                "exercises":[{"sport":{"id":"one"}},{"sport":{"id":"two"}}]
            }"#
            .to_vec(),
        )
        .expect("multiple-exercise training summary");
        assert_eq!(multiple.observation.exercise_count, Some(2));
        assert_eq!(
            multiple.observation.started_at_local,
            "2026-01-02T10:30:00.123"
        );
        assert_eq!(multiple.source_modified_at_utc, "2026-01-02T12:05:00.123");

        let invalid_cases = [
            (
                locator,
                r#"{"identifier":{"id":" "},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000}"#,
                "invalid-supported-artifact",
            ),
            (
                locator,
                r#"{"identifier":{"id":"synthetic"},"created":"invalid","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000}"#,
                "invalid-supported-artifact",
            ),
            (
                locator,
                r#"{"identifier":{"id":"synthetic"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":-1}"#,
                "invalid-supported-artifact",
            ),
            (
                locator,
                r#"{"identifier":{"id":"synthetic"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":360000000}"#,
                "invalid-supported-artifact",
            ),
            (
                locator,
                r#"{"identifier":{"id":"synthetic"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"distanceMeters":null}"#,
                "invalid-supported-artifact",
            ),
            (
                locator,
                r#"{"identifier":{"id":"synthetic"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"hrAvg":180,"hrMax":170}"#,
                "invalid-supported-artifact",
            ),
            (
                locator,
                r#"{"identifier":{"id":"synthetic"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"exercises":{}}"#,
                "invalid-supported-artifact",
            ),
            (
                "training-session_2026-01-02T10-31-00_42-11111111-2222-4333-8444-555555555555.json",
                r#"{"identifier":{"id":"synthetic"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000}"#,
                "filename-content-start-mismatch",
            ),
        ];

        for (case_locator, json, expected_reason_code) in invalid_cases {
            let error = decode_training_session(
                "synthetic-origin",
                case_locator,
                &artifact_sha256,
                json.as_bytes().to_vec(),
            )
            .expect_err("invalid training summary");
            assert!(
                matches!(
                    error,
                    ImportError::InvalidArtifact { reason_code, .. }
                        if reason_code == expected_reason_code
                ),
                "{case_locator}"
            );
        }
    }

    #[test]
    fn rejects_duplicate_training_identity_atomically() {
        let harness = Harness::new();
        let session = r#"{
            "identifier":{"id":"synthetic-duplicate"},
            "created":"2026-01-02T12:00:00.000",
            "modified":"2026-01-02T12:05:00.000",
            "startTime":"2026-01-02T10:30:00",
            "stopTime":"2026-01-02T11:30:00",
            "durationMillis":3600000
        }"#;
        let archive = harness.archive(
            "duplicate-training.zip",
            &[
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"username":"fixture-duplicate-training-claim"}"#,
                ),
                (
                    "training-session_2026-01-02T10-30-00_42-11111111-2222-4333-8444-555555555555.json",
                    session,
                ),
                (
                    "training-session_2026-01-02T10-30-00_77-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json",
                    session,
                ),
            ],
        );

        let error = import_polar_archive(&harness.database(), &archive)
            .expect_err("duplicate training identity");
        assert!(matches!(
            error,
            ImportError::InvalidArtifact {
                reason_code: "duplicate-training-session-id",
                ..
            }
        ));
        assert!(query_training_sessions(&harness.database())
            .expect("empty training history")
            .is_empty());
        let outcome = query_latest_import_outcome(&harness.database())
            .expect("outcome query")
            .expect("rejected outcome");
        assert_eq!(outcome.state, ImportOperationState::Rejected);
        assert!(outcome.artifact_families.iter().any(|family| {
            family.family_code.as_deref() == Some("polar-flow-training-session")
                && family.classification == ArtifactClassification::Invalid
                && family.reason_code == "duplicate-training-session-id"
                && family.artifact_count == 2
        }));
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
                MAPPING_SET_VERSION.to_owned(),
                true,
                4,
                4,
                0,
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
        assert_eq!(coverage[3].2, "supported");
        assert_eq!(coverage[3].4, "mapped-sleep-periods");
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
        assert_eq!(outcome.coverage.supported, 4);
        assert_eq!(outcome.coverage.unsupported, 0);
        assert_eq!(outcome.coverage.unrecognized, 0);
        assert_eq!(
            outcome.artifact_families,
            vec![
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
                ArtifactFamilyCoverage {
                    family_code: Some("polar-flow-sleep-result".to_owned()),
                    classification: ArtifactClassification::Supported,
                    reason_code: "mapped-sleep-periods".to_owned(),
                    artifact_count: 1,
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
                    "orthostatic-test-result-42-7-11111111-2222-4333-8444-555555555555.json",
                    r#"{}"#,
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
                    family_code: Some("polar-flow-orthostatic-test-result".to_owned()),
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
        assert!(progress.iter().all(|event| {
            event
                .total_artifacts
                .is_none_or(|total| event.completed_artifacts <= total)
        }));
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
        assert_eq!(
            query_activity_bounds(&harness.database()).expect("empty activity bounds"),
            None
        );
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

        assert_eq!(
            query_activity_bounds(&harness.database()).expect("activity bounds"),
            Some(ActivityDateRange {
                from: "2026-06-01".to_owned(),
                through: "2026-06-03".to_owned(),
            })
        );
        let origins = query_activity_origins(&harness.database()).expect("activity origins");
        assert_eq!(origins.len(), 1);
        assert!(!origins[0].is_empty());
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

        let connection = Connection::open(harness.database()).expect("database");
        let query_plan = connection
            .query_row(
                "EXPLAIN QUERY PLAN
                 SELECT origin_id, local_date, step_count
                 FROM daily_activity
                 WHERE local_date >= '2026-06-02' AND local_date <= '2026-06-03'
                 ORDER BY local_date, origin_id",
                [],
                |row| row.get::<_, String>(3),
            )
            .expect("activity range query plan");
        assert!(query_plan.contains("daily_activity_local_date_origin"));
    }

    #[test]
    fn upgrades_version_four_with_the_activity_range_index_atomically() {
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
            .execute_batch(SCHEMA_V4)
            .expect("version four schema");
        connection
            .pragma_update(None, "user_version", 4)
            .expect("version four marker");
        connection
            .execute(
                "INSERT INTO daily_activity (origin_id, local_date, step_count)
                 VALUES ('synthetic-origin', '2026-06-01', 1234)",
                [],
            )
            .expect("version four activity");

        let error = migrate_schema(&connection, true).expect_err("interrupted upgrade");
        assert!(matches!(error, ImportError::InjectedMigrationInterruption));
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("retained schema version"),
            4
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master
                     WHERE type = 'index' AND name = 'daily_activity_local_date_origin'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("rolled-back index count"),
            0
        );

        migrate_schema(&connection, false).expect("recovered upgrade");
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("upgraded schema version"),
            SCHEMA_VERSION
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master
                     WHERE type = 'index' AND name = 'daily_activity_local_date_origin'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("activity range index count"),
            1
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT step_count FROM daily_activity
                     WHERE origin_id = 'synthetic-origin' AND local_date = '2026-06-01'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("preserved activity"),
            1234
        );
    }

    #[test]
    fn upgrades_version_five_with_training_storage_atomically() {
        let harness = Harness::new();
        let connection = Connection::open(harness.database()).expect("database");
        connection
            .execute_batch("PRAGMA foreign_keys = ON;")
            .expect("foreign keys");
        for (schema, label) in [
            (SCHEMA_V1, "version one"),
            (SCHEMA_V2, "version two"),
            (SCHEMA_V3, "version three"),
            (SCHEMA_V4, "version four"),
            (SCHEMA_V5, "version five"),
        ] {
            connection
                .execute_batch(schema)
                .unwrap_or_else(|error| panic!("{label} schema: {error}"));
        }
        connection
            .pragma_update(None, "user_version", 5)
            .expect("version five marker");
        let operation_id = begin_operation(&connection).expect("version five operation");

        let error = migrate_schema(&connection, true).expect_err("interrupted version six");
        assert!(matches!(error, ImportError::InjectedMigrationInterruption));
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("retained schema version"),
            5
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_schema
                     WHERE type = 'table' AND name LIKE 'training_session%'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("rolled-back training tables"),
            0
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM pragma_table_info('import_operation')
                     WHERE name = 'amended_observations'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("rolled-back amended column"),
            0
        );

        migrate_schema(&connection, false).expect("version six migration");
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("current schema version"),
            SCHEMA_VERSION
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_schema
                     WHERE type = 'table' AND name LIKE 'training_session%'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("training tables"),
            3
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT amended_observations FROM import_operation WHERE id = ?1",
                    [operation_id],
                    |row| row.get::<_, i64>(0),
                )
                .expect("migrated amendment count"),
            0
        );
    }

    #[test]
    fn upgrades_version_six_with_sleep_storage_atomically() {
        let harness = Harness::new();
        let connection = Connection::open(harness.database()).expect("database");
        connection
            .execute_batch("PRAGMA foreign_keys = ON;")
            .expect("foreign keys");
        for (schema, label) in [
            (SCHEMA_V1, "version one"),
            (SCHEMA_V2, "version two"),
            (SCHEMA_V3, "version three"),
            (SCHEMA_V4, "version four"),
            (SCHEMA_V5, "version five"),
            (SCHEMA_V6, "version six"),
        ] {
            connection
                .execute_batch(schema)
                .unwrap_or_else(|error| panic!("{label} schema: {error}"));
        }
        connection
            .pragma_update(None, "user_version", 6)
            .expect("version six marker");

        let error = migrate_schema(&connection, true).expect_err("interrupted version seven");
        assert!(matches!(error, ImportError::InjectedMigrationInterruption));
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("retained schema version"),
            6
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_schema
                     WHERE type = 'table' AND name LIKE 'sleep_%'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("rolled-back sleep tables"),
            0
        );

        migrate_schema(&connection, false).expect("version seven migration");
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("current schema version"),
            SCHEMA_VERSION
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_schema
                     WHERE type = 'table' AND name LIKE 'sleep_%'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("sleep tables"),
            4
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_schema
                     WHERE type = 'index' AND name LIKE 'sleep_%'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("sleep indexes"),
            3
        );
    }

    #[test]
    fn upgrades_version_seven_with_nightly_recovery_storage_atomically() {
        let harness = Harness::new();
        let connection = Connection::open(harness.database()).expect("database");
        connection
            .execute_batch("PRAGMA foreign_keys = ON;")
            .expect("foreign keys");
        for (schema, label) in [
            (SCHEMA_V1, "version one"),
            (SCHEMA_V2, "version two"),
            (SCHEMA_V3, "version three"),
            (SCHEMA_V4, "version four"),
            (SCHEMA_V5, "version five"),
            (SCHEMA_V6, "version six"),
            (SCHEMA_V7, "version seven"),
        ] {
            connection
                .execute_batch(schema)
                .unwrap_or_else(|error| panic!("{label} schema: {error}"));
        }
        connection
            .pragma_update(None, "user_version", 7)
            .expect("version seven marker");

        let error = migrate_schema(&connection, true).expect_err("interrupted version eight");
        assert!(matches!(error, ImportError::InjectedMigrationInterruption));
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("retained schema version"),
            7
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_schema
                     WHERE type = 'table' AND name LIKE 'nightly_recovery%'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("rolled-back recovery tables"),
            0
        );

        migrate_schema(&connection, false).expect("version eight migration");
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("current schema version"),
            SCHEMA_VERSION
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_schema
                     WHERE type = 'table' AND name LIKE 'nightly_recovery%'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("recovery tables"),
            3
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_schema
                     WHERE type = 'index' AND name LIKE 'nightly_recovery%'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("recovery indexes"),
            3
        );
        let query_plan = connection
            .query_row(
                "EXPLAIN QUERY PLAN
                 SELECT origin_id, recovery_date
                 FROM nightly_recovery
                 WHERE recovery_date >= '2026-04-01'
                   AND recovery_date <= '2026-04-30'
                 ORDER BY recovery_date, origin_id",
                [],
                |row| row.get::<_, String>(3),
            )
            .expect("recovery query plan");
        assert!(query_plan.contains("nightly_recovery_date_origin"));
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
    fn rejects_an_invalid_library_before_replacing_an_existing_backup() {
        let harness = Harness::new();
        let invalid_source = harness.directory.path().join("invalid-source.sqlite");
        let old_source = harness.directory.path().join("old-source.sqlite");
        let existing_backup = harness.directory.path().join("existing-backup.sqlite");
        std::fs::write(&invalid_source, "not a SQLite library").expect("invalid source");
        std::fs::write(&existing_backup, "preserved existing backup").expect("existing backup");

        assert!(backup_database(&invalid_source, &existing_backup).is_err());
        assert_eq!(
            std::fs::read_to_string(&existing_backup).expect("preserved backup"),
            "preserved existing backup"
        );

        let old_connection = Connection::open(&old_source).expect("old source");
        old_connection
            .pragma_update(None, "user_version", SCHEMA_VERSION - 1)
            .expect("old source schema");
        drop(old_connection);
        assert!(backup_database(&old_source, &existing_backup).is_err());
        let retained_schema = Connection::open(old_source)
            .expect("reopened old source")
            .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
            .expect("retained old schema");
        assert_eq!(retained_schema, SCHEMA_VERSION - 1);
        assert_eq!(
            std::fs::read_to_string(existing_backup).expect("still-preserved backup"),
            "preserved existing backup"
        );
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

    #[test]
    fn upgrades_version_eight_with_update_state_atomically() {
        let harness = Harness::new();
        let connection = Connection::open(harness.database()).expect("database");
        connection
            .execute_batch("PRAGMA foreign_keys = ON;")
            .expect("foreign keys");
        for (schema, label) in [
            (SCHEMA_V1, "version one"),
            (SCHEMA_V2, "version two"),
            (SCHEMA_V3, "version three"),
            (SCHEMA_V4, "version four"),
            (SCHEMA_V5, "version five"),
            (SCHEMA_V6, "version six"),
            (SCHEMA_V7, "version seven"),
            (SCHEMA_V8, "version eight"),
        ] {
            connection
                .execute_batch(schema)
                .unwrap_or_else(|error| panic!("{label} schema: {error}"));
        }
        connection
            .execute(
                "INSERT INTO locale_preference (id, locale, updated_at_utc)
                 VALUES (1, 'es-ES', '2026-08-17T12:00:00Z')",
                [],
            )
            .expect("version eight preference");
        connection
            .pragma_update(None, "user_version", 8)
            .expect("version eight marker");

        let error = migrate_schema(&connection, true).expect_err("interrupted version nine");
        assert!(matches!(error, ImportError::InjectedMigrationInterruption));
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("retained schema version"),
            8
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_schema
                     WHERE type = 'table' AND name = 'update_state'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("rolled-back update table"),
            0
        );

        migrate_schema(&connection, false).expect("version nine migration");
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("current schema version"),
            SCHEMA_VERSION
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT locale FROM locale_preference WHERE id = 1",
                    [],
                    |row| row.get::<_, String>(0),
                )
                .expect("preserved preference"),
            "es-ES"
        );
    }
}
