use std::{
    cmp::Ordering as CmpOrdering,
    collections::{BTreeMap, BTreeSet, HashMap, HashSet},
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

use chrono::{DateTime, Local, Months, NaiveDate, NaiveDateTime, SecondsFormat, Timelike};
use regex::Regex;
use rusqlite::{
    params, params_from_iter,
    types::{Type, Value},
    Connection, Error as SqliteError, OptionalExtension, Row, Transaction, TransactionBehavior,
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
    adjust_training_session_range, apply_training_segment_criterion, clear_exploration_workspace,
    create_training_segment_criterion, create_training_session_range,
    move_training_segment_criterion, query_default_recovery_overview, query_default_sleep_overview,
    query_default_training_overview, query_library_home, query_longitudinal_overview,
    query_recovery_detail, query_training_route_points, query_training_session_provenance,
    query_training_session_ranges, query_training_session_routes,
    query_training_session_segmentation, query_training_session_signals,
    query_training_session_structure, query_training_session_zones, query_training_signal_samples,
    query_training_sports, remove_training_segment_criterion, remove_training_session_range,
    rename_training_session_range, save_exploration_workspace, save_training_sport_classification,
    update_training_segment_criterion, AdjustTrainingSessionRangeRequest, AppearancePreference,
    ApplicationError, CreateTrainingSegmentCriterionRequest, CreateTrainingSessionRangeRequest,
    LibraryDomain, LibraryHomeDateRange, LibraryHomeHighlight, LibraryHomeRequest, LibraryQuestion,
    LibraryQuestionKind, LocalePreference, MoveTrainingSegmentCriterionRequest,
    RemoveTrainingSessionRangeRequest, RenameTrainingSessionRangeRequest,
    SaveSportClassificationRequest, SegmentApplicabilityView, SportClassificationSaveOutcome,
    TrainingSegmentCriterionMutationRequest, UpdateTrainingSegmentCriterionRequest,
};
use fitfreed_application::{
    ActivityDateRange, ActivityLibraryPort, ApplicationPreferences, ApplicationPreferencesPort,
    ArchiveImportPort, DetectedTrainingSport, ExplorationWorkspace, ExplorationWorkspacePort,
    ExploreDestination, ImportOutcomeLibraryPort, ImportPhase, ImportPhaseTimings, ImportProgress,
    LibraryHomeClockPort, LibraryHomeRevisionPort, PersistedTrainingExerciseSegmentation,
    PersistedTrainingRoutePoints, PersistedTrainingSessionCalendar,
    PersistedTrainingSessionProvenance, PersistedTrainingSessionRanges,
    PersistedTrainingSessionRoutes, PersistedTrainingSessionSearchPage,
    PersistedTrainingSessionSegmentation, PersistedTrainingSessionSelection,
    PersistedTrainingSessionSignals, PersistedTrainingSessionStructure,
    PersistedTrainingSessionZones, PersistedTrainingSignalSamples, ProfiledImport,
    RecoveryDateRange, RecoveryLibraryNight, RecoveryLibraryPort, ReportDefinitionPort,
    ReportDefinitionPortError, SegmentSignalEvidence, SegmentSignalKind, SegmentSignalSample,
    SleepDateRange, SleepLibraryPeriod, SleepLibraryPort, StoredApplicationPreferences,
    StoredExplorationWorkspace, TrainingDateRange, TrainingDiscoveryView,
    TrainingDiscoveryWorkspace, TrainingDiscoveryWorkspacePort, TrainingExerciseRoutesView,
    TrainingExerciseSignalsView, TrainingExerciseStructure, TrainingExerciseZonesView,
    TrainingLapStructure, TrainingLibraryPort, TrainingMeasurementFilter, TrainingPauseStructure,
    TrainingProvenanceCurrentView, TrainingProvenanceDecisionView, TrainingProvenanceEventView,
    TrainingRouteCollectionView, TrainingRouteKindView, TrainingRouteOverview,
    TrainingRoutePointView, TrainingRoutePointsQuery, TrainingSegmentCriterionDirection,
    TrainingSegmentationPort, TrainingSegmentationPortError, TrainingSessionCalendarDay,
    TrainingSessionCalendarRequest, TrainingSessionDiscoveryPort,
    TrainingSessionDiscoveryPortError, TrainingSessionProvenancePort,
    TrainingSessionProvenancePortError, TrainingSessionProvenanceQuery,
    TrainingSessionRangeExerciseContext, TrainingSessionRangePort, TrainingSessionRangePortError,
    TrainingSessionRangesQuery, TrainingSessionRoutePort, TrainingSessionRoutePortError,
    TrainingSessionRouteQuery, TrainingSessionRoutesView, TrainingSessionSearchItem,
    TrainingSessionSearchRequest, TrainingSessionSearchSummary, TrainingSessionSegmentationQuery,
    TrainingSessionSelectionRequest, TrainingSessionSignalPort, TrainingSessionSignalPortError,
    TrainingSessionSignalsQuery, TrainingSessionSignalsView, TrainingSessionSort,
    TrainingSessionSport, TrainingSessionStructurePort, TrainingSessionStructurePortError,
    TrainingSessionStructureQuery, TrainingSessionZonePort, TrainingSessionZonePortError,
    TrainingSessionZonesQuery, TrainingSessionZonesView, TrainingSignalCollectionView,
    TrainingSignalKindView, TrainingSignalRoleView, TrainingSignalSampleView,
    TrainingSignalSamplesQuery, TrainingSignalSeriesOverview, TrainingSignalUnitView,
    TrainingSignalVisualSampleView, TrainingSourceProviderView, TrainingSportClassification,
    TrainingSportState, TrainingSportsPort, TrainingStructure, TrainingZoneCollectionView,
    TrainingZoneGroupView, TrainingZoneKindView, TrainingZoneUnitView, TrainingZoneView,
};
use fitfreed_domain::{
    decide_nightly_recovery_reconciliation, decide_reconciliation,
    decide_sleep_period_reconciliation, decide_training_session_record_reconciliation,
    reconcile_training_session_range, ArtifactClassification, ArtifactCoverageSummary,
    ArtifactFamilyCoverage, DailyActivity, ExistingObservation, ImportOperationState,
    ImportOutcome, ImportReport, NightlyRecovery, ReconciliationDecision,
    RemovedTrainingSessionRange, ReportAuthorship, ReportBlock, ReportBlockContent,
    ReportDateRange, ReportDefinition, ReportLocale, ReportOrigin, ReportProvenancePolicy,
    ReportQuestion, ReportTrainingComparisonQuery, ReportTrainingMetric, RevisionOrder,
    SegmentCriterion, SegmentCriterionAuthorship, SegmentCriterionDefinition, SleepPeriod,
    SleepPhaseSummary, SleepScore, SleepStage, SleepStageTransition,
    SourceSpecificRecoveryAssessment, SourceSpecificRecoveryBaseline,
    SourceSpecificRecoveryGuidance, SportClassification, SportClassificationAuthorship,
    SportClassificationKey, SportClassificationState, SportFamily, TrainingExercise,
    TrainingExerciseRouteAssessment, TrainingExerciseSignalAssessment,
    TrainingExerciseZoneAssessment, TrainingLap, TrainingLapKind, TrainingPause, TrainingRoute,
    TrainingRouteKind, TrainingRoutePoint, TrainingRoutes, TrainingSession, TrainingSessionRange,
    TrainingSessionRangeAuthorship, TrainingSessionRangeEvidenceCompatibility,
    TrainingSessionRangeState, TrainingSessionRecord, TrainingSessionRouteAssessment,
    TrainingSessionSignalAssessment, TrainingSessionStructure, TrainingSessionZoneAssessment,
    TrainingSignalKind, TrainingSignalSample, TrainingSignalSeries, TrainingSignalUnit,
    TrainingSignals, TrainingZone, TrainingZoneGroup, TrainingZoneKind, TrainingZoneUnit,
    TrainingZones,
};

mod local_file;
mod polar_flow;
mod report_html;
mod source_acquisition;
mod source_subject;
pub mod update;
mod update_channel;
mod update_installation;
mod update_package;
mod update_recovery;
mod update_state;
mod update_watchdog;

pub use report_html::SelfContainedHtmlReportExporter;
pub use source_acquisition::PolarFlowSourceAcquisitionGuides;
pub use update_channel::{current_update_target, HttpsUpdateChannel};
pub use update_installation::{
    install_verified_update, UpdateInstallationError, UpdateInstallationRequest,
};
pub use update_package::{download_verified_update, UpdatePackageError, VerifiedUpdatePackage};
pub use update_recovery::{
    acknowledge_update_recovery_outcome, acquire_update_recovery_candidate_lease,
    acquire_update_recovery_watchdog_lease, active_update_recovery_phase,
    confirm_active_update_recovery, discard_prepared_update_recovery, load_update_recovery_outcome,
    maintain_update_recovery, maintain_update_recovery_with_watchdog_lease,
    observe_update_recovery_process, prepare_update_recovery,
    record_active_update_recovery_replacement_launch, resolve_update_application_path,
    resolve_update_recovery_watchdog_context, restore_active_update_recovery,
    transition_active_update_recovery, update_recovery_process_is_running,
    verify_prepared_update_recovery, ApplicationCopyPort, PlatformApplicationCopier,
    PreparedUpdateRecovery, UpdateRecoveryCandidateLease, UpdateRecoveryError,
    UpdateRecoveryMaintenance, UpdateRecoveryPreparation, UpdateRecoveryProcessIdentity,
    UpdateRecoveryReplacementLaunch, UpdateRecoveryReplacementProcess, UpdateRecoveryRestoration,
    UpdateRecoveryWatchdogContext, UpdateRecoveryWatchdogLease,
};
pub use update_state::SqliteUpdateState;
pub use update_watchdog::{
    await_update_recovery_candidate_go, run_update_recovery_watchdog,
    start_update_recovery_watchdog, StartedUpdateRecoveryWatchdog, UpdateRecoveryWatchdogError,
    UpdateRecoveryWatchdogOutcome, UPDATE_RECOVERY_CANDIDATE_ARGUMENT,
    UPDATE_RECOVERY_WATCHDOG_ARGUMENT,
};

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
const SCHEMA_VERSION: i64 = 26;
const SCHEMA_V1: &str = include_str!("../migrations/0001_initial.sql");
const SCHEMA_V2: &str = include_str!("../migrations/0002_import_ledger.sql");
const SCHEMA_V3: &str = include_str!("../migrations/0003_locale_preference.sql");
const SCHEMA_V4: &str = include_str!("../migrations/0004_source_subject.sql");
const SCHEMA_V5: &str = include_str!("../migrations/0005_activity_query_index.sql");
const SCHEMA_V6: &str = include_str!("../migrations/0006_training_session_summary.sql");
const SCHEMA_V7: &str = include_str!("../migrations/0007_sleep_period.sql");
const SCHEMA_V8: &str = include_str!("../migrations/0008_nightly_recovery.sql");
const SCHEMA_V9: &str = include_str!("../migrations/0009_update_state.sql");
const SCHEMA_V10: &str = include_str!("../migrations/0010_application_preferences.sql");
const SCHEMA_V11: &str = include_str!("../migrations/0011_exploration_workspace.sql");
const SCHEMA_V12: &str = include_str!("../migrations/0012_sport_classification.sql");
const SCHEMA_V13: &str = include_str!("../migrations/0013_training_session_discovery.sql");
const SCHEMA_V14: &str = include_str!("../migrations/0014_training_discovery_workspace.sql");
const SCHEMA_V15: &str = include_str!("../migrations/0015_training_session_structure.sql");
const SCHEMA_V16: &str = include_str!("../migrations/0016_training_session_routes.sql");
const SCHEMA_V17: &str = include_str!("../migrations/0017_training_session_signals.sql");
const SCHEMA_V18: &str = include_str!("../migrations/0018_training_segment_criteria.sql");
const SCHEMA_V19: &str = include_str!("../migrations/0019_training_session_zones.sql");
const SCHEMA_V20: &str = include_str!("../migrations/0020_report_definitions.sql");
const SCHEMA_V21: &str = include_str!("../migrations/0021_composable_route_reports.sql");
const SCHEMA_V22: &str = include_str!("../migrations/0022_training_comparison_reports.sql");
const SCHEMA_V23: &str = include_str!("../migrations/0023_report_start_origins.sql");
const SCHEMA_V24: &str = include_str!("../migrations/0024_compact_training_signal_samples.sql");
const SCHEMA_V25: &str = include_str!("../migrations/0025_training_session_ranges.sql");
const SCHEMA_V26: &str = include_str!("../migrations/0026_training_session_range_exercises.sql");
const SOURCE_PROVIDER: &str = "polar-flow";
const SOURCE_ADAPTER_VERSION: &str = "polar-flow-archive@11";
const MAPPING_SET_VERSION: &str = "polar-flow-mapping-set@6";
const DAILY_ACTIVITY_MAPPING_VERSION: &str = "polar-flow-daily-activity@1";
const TRAINING_SESSION_MAPPING_VERSION: &str = "polar-flow-training-session@6";
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
    exercises: SourceOptional<Vec<PolarTrainingExercise>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarTrainingExercise {
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
    sport: SourceOptional<PolarReference>,
    #[serde(default)]
    laps: SourceOptional<PolarTrainingLaps>,
    #[serde(default)]
    pause_times: SourceOptional<Vec<PolarTrainingPause>>,
    #[serde(default)]
    routes: SourceOptional<PolarTrainingRoutes>,
    #[serde(default)]
    samples: SourceOptional<PolarTrainingSamples>,
    #[serde(default)]
    zones: SourceOptional<Vec<PolarTrainingZoneGroup>>,
}

#[derive(Debug, Deserialize)]
struct PolarTrainingZoneGroup {
    r#type: String,
    #[serde(default)]
    zones: SourceOptional<Vec<PolarTrainingZone>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarTrainingZone {
    #[serde(default)]
    lower_limit: SourceOptional<f64>,
    #[serde(default)]
    higher_limit: SourceOptional<f64>,
    #[serde(default)]
    in_zone: SourceOptional<i64>,
    #[serde(default)]
    distance_meters: SourceOptional<f64>,
    #[serde(default)]
    muscle_load: SourceOptional<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarTrainingSamples {
    #[serde(default)]
    samples: SourceOptional<Vec<PolarTrainingSignalSeries>>,
    #[serde(default)]
    transition_samples: SourceOptional<Vec<PolarTrainingSignalSeries>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarTrainingSignalSeries {
    r#type: String,
    interval_millis: i64,
    values: Vec<PolarTrainingSignalValue>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum PolarTrainingSignalValue {
    Number(f64),
    Text(String),
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarTrainingLaps {
    #[serde(default)]
    laps: SourceOptional<Vec<PolarTrainingLap>>,
    #[serde(default)]
    auto_laps: SourceOptional<Vec<PolarTrainingLap>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarTrainingLap {
    split_time_millis: i64,
    duration_millis: i64,
    #[serde(default)]
    distance_meters: SourceOptional<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarTrainingPause {
    start_time: String,
    end_time: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarTrainingRoutes {
    #[serde(default)]
    route: SourceOptional<PolarTrainingRoute>,
    #[serde(default)]
    transition_route: SourceOptional<PolarTrainingRoute>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarTrainingRoute {
    start_time: String,
    way_points: Vec<PolarTrainingRoutePoint>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarTrainingRoutePoint {
    latitude: f64,
    longitude: f64,
    #[serde(default)]
    altitude: SourceOptional<f64>,
    #[serde(default)]
    elapsed_millis: SourceOptional<i64>,
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
    observation: TrainingSessionRecord,
}

#[derive(Debug)]
struct ValidatedTrainingArtifact {
    locator: String,
    sha256: String,
    origin_id: String,
    session_id: String,
}

impl From<MappedTrainingArtifact> for ValidatedTrainingArtifact {
    fn from(artifact: MappedTrainingArtifact) -> Self {
        Self {
            locator: artifact.locator,
            sha256: artifact.sha256,
            origin_id: artifact.observation.summary.origin_id,
            session_id: artifact.observation.summary.session_id,
        }
    }
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
    let mut validated_training_artifacts = Vec::new();
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
                        validated_training_artifacts.push(mapped.into());
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
        validated_training_artifacts.as_slice(),
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
        || !validated_training_artifacts.is_empty()
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
    for (training_index, validated) in validated_training_artifacts.iter().enumerate() {
        ensure_not_cancelled(cancellation)?;
        let decode_started = Instant::now();
        let mut member = archive.by_name(&validated.locator)?;
        let bytes = read_bytes(&mut member, &validated.locator, cancellation)?;
        let artifact_sha256 = sha256_bytes(&bytes);
        if artifact_sha256 != validated.sha256 {
            return Err(ImportError::InvalidContainer(
                "training artifact changed between validation and reconciliation".to_owned(),
            ));
        }
        let artifact =
            decode_training_session(origin_id, &validated.locator, &artifact_sha256, bytes)?;
        if artifact.observation.summary.origin_id != validated.origin_id
            || artifact.observation.summary.session_id != validated.session_id
        {
            return Err(ImportError::InvalidContainer(
                "training identity changed between validation and reconciliation".to_owned(),
            ));
        }
        timings.read_decode_map_milliseconds += milliseconds(decode_started.elapsed());
        let reconciliation_started = Instant::now();
        reconcile_training_session(&transaction, operation_id, &artifact, &mut report)?;
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
            == Some(mapped_artifacts.len() + validated_training_artifacts.len() + sleep_index + 1)
        {
            return Err(ImportError::InjectedInterruption(
                mapped_artifacts.len() + validated_training_artifacts.len() + sleep_index + 1,
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
                    + validated_training_artifacts.len()
                    + mapped_sleep_periods.len()
                    + recovery_index
                    + 1,
            )
        {
            return Err(ImportError::InjectedInterruption(
                mapped_artifacts.len()
                    + validated_training_artifacts.len()
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

struct TrainingDiscoverySportEntry {
    origin_id: String,
    source_sport_ref: Option<String>,
    public_sport: TrainingSessionSport,
}

fn training_discovery_filter(
    sport_entries: &[TrainingDiscoverySportEntry],
    request: &TrainingSessionSearchRequest,
) -> std::result::Result<(String, Vec<Value>), TrainingSessionDiscoveryPortError> {
    let selected_entries = select_training_discovery_sports(sport_entries, request)?;
    let mut values = vec![
        request.from.clone().map_or(Value::Null, Value::Text),
        request.through.clone().map_or(Value::Null, Value::Text),
    ];
    let mut predicates = vec![
        "(?1 IS NULL OR session.started_at_local >= ?1 || 'T')".to_owned(),
        "(?2 IS NULL OR session.started_at_local <= ?2 || 'T23:59:59.999999999')".to_owned(),
    ];
    for measurement in &request.required_measurements {
        predicates.push(match measurement {
            TrainingMeasurementFilter::Distance => "session.distance_meters IS NOT NULL",
            TrainingMeasurementFilter::Energy => "session.energy_kilocalories IS NOT NULL",
            TrainingMeasurementFilter::HeartRate => {
                "(session.average_heart_rate_bpm IS NOT NULL OR session.maximum_heart_rate_bpm IS NOT NULL)"
            }
        }
        .to_owned());
    }
    if let Some(selected_entries) = selected_entries {
        if selected_entries.is_empty() {
            predicates.push("0".to_owned());
        } else {
            let mut sport_predicates = Vec::with_capacity(selected_entries.len());
            for entry in selected_entries {
                let origin_parameter = values.len() + 1;
                values.push(Value::Text(entry.origin_id.clone()));
                let sport_parameter = values.len() + 1;
                values.push(
                    entry
                        .source_sport_ref
                        .clone()
                        .map_or(Value::Null, Value::Text),
                );
                sport_predicates.push(format!(
                    "(session.origin_id = ?{origin_parameter} AND session.sport_ref IS ?{sport_parameter})"
                ));
            }
            predicates.push(format!("({})", sport_predicates.join(" OR ")));
        }
    }
    Ok((predicates.join(" AND "), values))
}

fn query_training_session_discovery(
    database_path: &Path,
    request: &TrainingSessionSearchRequest,
) -> std::result::Result<PersistedTrainingSessionSearchPage, TrainingSessionDiscoveryPortError> {
    let mut connection = Connection::open(database_path).map_err(discovery_failure)?;
    ensure_schema(&connection).map_err(discovery_failure)?;
    let transaction = connection.transaction().map_err(discovery_failure)?;
    let revision = transaction
        .query_row(
            "SELECT revision FROM training_discovery_revision WHERE id = 1",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(discovery_failure)?;
    if revision < 1 {
        return Err(TrainingSessionDiscoveryPortError::Failure(
            "training discovery revision is invalid".to_owned(),
        ));
    }
    let snapshot_ref = training_snapshot_ref(revision);
    if request
        .snapshot_ref
        .as_ref()
        .is_some_and(|expected| expected != &snapshot_ref)
    {
        return Err(TrainingSessionDiscoveryPortError::SnapshotChanged);
    }

    let available_range = query_training_bounds_on(&transaction).map_err(discovery_failure)?;
    let sport_entries = query_training_discovery_sports(&transaction).map_err(discovery_failure)?;
    let source_indices = sport_entries
        .iter()
        .map(|entry| entry.origin_id.clone())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .enumerate()
        .map(|(index, origin)| (origin, index + 1))
        .collect::<BTreeMap<_, _>>();
    let sport_by_identity = sport_entries
        .iter()
        .map(|entry| {
            (
                (entry.origin_id.clone(), entry.source_sport_ref.clone()),
                entry.public_sport.clone(),
            )
        })
        .collect::<HashMap<_, _>>();

    let (where_clause, mut values) = training_discovery_filter(&sport_entries, request)?;
    let total_count = transaction
        .query_row(
            &format!("SELECT COUNT(*) FROM training_session AS session WHERE {where_clause}"),
            params_from_iter(values.iter()),
            |row| row.get::<_, i64>(0),
        )
        .map_err(discovery_failure)
        .and_then(|count| {
            usize::try_from(count).map_err(|_| {
                TrainingSessionDiscoveryPortError::Failure(
                    "training-session result count is invalid".to_owned(),
                )
            })
        })?;

    let summary_query = format!(
        "SELECT session.origin_id,
                COUNT(DISTINCT substr(session.started_at_local, 1, 10)),
                COUNT(*), SUM(session.duration_milliseconds),
                COUNT(session.distance_meters), SUM(session.distance_meters),
                COUNT(session.energy_kilocalories), SUM(session.energy_kilocalories),
                SUM(CASE WHEN session.average_heart_rate_bpm IS NOT NULL
                              OR session.maximum_heart_rate_bpm IS NOT NULL
                         THEN 1 ELSE 0 END)
         FROM training_session AS session
         WHERE {where_clause}
         GROUP BY session.origin_id
         ORDER BY session.origin_id"
    );
    let mut summary_statement = transaction
        .prepare(&summary_query)
        .map_err(discovery_failure)?;
    let summary_rows = summary_statement
        .query_map(params_from_iter(values.iter()), |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, Option<f64>>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, Option<i64>>(7)?,
                row.get::<_, i64>(8)?,
            ))
        })
        .map_err(discovery_failure)?;
    let mut summaries = Vec::new();
    for row in summary_rows {
        let (
            origin_id,
            training_days,
            session_count,
            total_duration_milliseconds,
            distance_session_count,
            total_distance_meters,
            energy_session_count,
            total_energy_kilocalories,
            heart_rate_session_count,
        ) = row.map_err(discovery_failure)?;
        let source_index = source_indices.get(&origin_id).copied().ok_or_else(|| {
            TrainingSessionDiscoveryPortError::Failure(
                "training-session summary origin has no source index".to_owned(),
            )
        })?;
        summaries.push(TrainingSessionSearchSummary {
            source_index,
            training_days: persisted_count(training_days, "training_days")
                .map_err(discovery_failure)?,
            session_count: persisted_count(session_count, "session_count")
                .map_err(discovery_failure)?,
            total_duration_milliseconds: i128::from(total_duration_milliseconds),
            distance_session_count: persisted_count(
                distance_session_count,
                "distance_session_count",
            )
            .map_err(discovery_failure)?,
            total_distance_meters,
            energy_session_count: persisted_count(energy_session_count, "energy_session_count")
                .map_err(discovery_failure)?,
            total_energy_kilocalories: total_energy_kilocalories.map(i128::from),
            heart_rate_session_count: persisted_count(
                heart_rate_session_count,
                "heart_rate_session_count",
            )
            .map_err(discovery_failure)?,
        });
    }
    drop(summary_statement);

    let order_clause = match request.sort {
        TrainingSessionSort::StartedDescending => {
            "session.started_at_local DESC, session.origin_id, session.session_id"
        }
        TrainingSessionSort::StartedAscending => {
            "session.started_at_local, session.origin_id, session.session_id"
        }
        TrainingSessionSort::DurationDescending => {
            "session.duration_milliseconds DESC, session.started_at_local DESC, session.origin_id, session.session_id"
        }
        TrainingSessionSort::DistanceDescending => {
            "session.distance_meters DESC, session.started_at_local DESC, session.origin_id, session.session_id"
        }
    };
    let limit_parameter = values.len() + 1;
    values.push(Value::Integer(i64::try_from(request.limit).map_err(
        |_| {
            TrainingSessionDiscoveryPortError::Failure(
                "training-session page size is too large".to_owned(),
            )
        },
    )?));
    let offset_parameter = values.len() + 1;
    values.push(Value::Integer(i64::try_from(request.offset).map_err(
        |_| {
            TrainingSessionDiscoveryPortError::Failure(
                "training-session page offset is too large".to_owned(),
            )
        },
    )?));
    let query = format!(
        "SELECT session.origin_id, session.session_id, session.started_at_local,
                session.stopped_at_local, session.utc_offset_minutes,
                session.duration_milliseconds, session.distance_meters,
                session.energy_kilocalories, session.average_heart_rate_bpm,
                session.maximum_heart_rate_bpm, session.sport_ref, session.exercise_count
         FROM training_session AS session
         WHERE {where_clause}
         ORDER BY {order_clause}
         LIMIT ?{limit_parameter} OFFSET ?{offset_parameter}"
    );
    let mut statement = transaction.prepare(&query).map_err(discovery_failure)?;
    let rows = statement
        .query_map(params_from_iter(values.iter()), |row| {
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
        })
        .map_err(discovery_failure)?;
    let mut sessions = Vec::new();
    for row in rows {
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
            source_sport_ref,
            exercise_count,
        ) = row.map_err(discovery_failure)?;
        let source_index = source_indices.get(&origin_id).copied().ok_or_else(|| {
            TrainingSessionDiscoveryPortError::Failure(
                "training-session origin has no source index".to_owned(),
            )
        })?;
        let sport = sport_by_identity
            .get(&(origin_id.clone(), source_sport_ref.clone()))
            .cloned()
            .ok_or_else(|| {
                TrainingSessionDiscoveryPortError::Failure(
                    "training-session sport context is unavailable".to_owned(),
                )
            })?;
        sessions.push(TrainingSessionSearchItem {
            session_ref: training_session_ref(&origin_id, &session_id),
            source_index,
            started_at_local,
            stopped_at_local,
            utc_offset_minutes,
            duration_milliseconds,
            distance_meters,
            energy_kilocalories,
            average_heart_rate_bpm,
            maximum_heart_rate_bpm,
            exercise_count: exercise_count
                .map(|count| persisted_count(count, "exercise_count"))
                .transpose()
                .map_err(discovery_failure)?,
            sport,
        });
    }
    drop(statement);
    transaction.commit().map_err(discovery_failure)?;
    Ok(PersistedTrainingSessionSearchPage {
        available_range,
        snapshot_ref,
        total_count,
        summaries,
        sessions,
    })
}

fn query_training_calendar_discovery(
    database_path: &Path,
    request: &TrainingSessionCalendarRequest,
) -> std::result::Result<PersistedTrainingSessionCalendar, TrainingSessionDiscoveryPortError> {
    let first = NaiveDate::parse_from_str(&format!("{}-01", request.month), "%Y-%m-%d")
        .map_err(discovery_failure)?;
    let month_through = first
        .checked_add_months(Months::new(1))
        .and_then(|date| date.pred_opt())
        .ok_or_else(|| {
            TrainingSessionDiscoveryPortError::Failure(
                "training calendar month is outside the supported date range".to_owned(),
            )
        })?;
    let month_from = first.format("%Y-%m-%d").to_string();
    let month_through = month_through.format("%Y-%m-%d").to_string();
    let effective_from = request
        .from
        .as_ref()
        .map_or_else(|| month_from.clone(), |from| from.max(&month_from).clone());
    let effective_through = request.through.as_ref().map_or_else(
        || month_through.clone(),
        |through| through.min(&month_through).clone(),
    );
    let search_request = TrainingSessionSearchRequest {
        from: Some(effective_from),
        through: Some(effective_through),
        sport_refs: request.sport_refs.clone(),
        required_measurements: request.required_measurements.clone(),
        text: request.text.clone(),
        sort: TrainingSessionSort::StartedAscending,
        offset: 0,
        limit: 1,
        snapshot_ref: request.snapshot_ref.clone(),
    };

    let mut connection = Connection::open(database_path).map_err(discovery_failure)?;
    ensure_schema(&connection).map_err(discovery_failure)?;
    let transaction = connection.transaction().map_err(discovery_failure)?;
    let revision = transaction
        .query_row(
            "SELECT revision FROM training_discovery_revision WHERE id = 1",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(discovery_failure)?;
    if revision < 1 {
        return Err(TrainingSessionDiscoveryPortError::Failure(
            "training discovery revision is invalid".to_owned(),
        ));
    }
    let snapshot_ref = training_snapshot_ref(revision);
    if request
        .snapshot_ref
        .as_ref()
        .is_some_and(|expected| expected != &snapshot_ref)
    {
        return Err(TrainingSessionDiscoveryPortError::SnapshotChanged);
    }
    let available_range = query_training_bounds_on(&transaction).map_err(discovery_failure)?;
    let sport_entries = query_training_discovery_sports(&transaction).map_err(discovery_failure)?;
    let source_indices = sport_entries
        .iter()
        .map(|entry| entry.origin_id.clone())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .enumerate()
        .map(|(index, origin)| (origin, index + 1))
        .collect::<BTreeMap<_, _>>();
    let (where_clause, values) = training_discovery_filter(&sport_entries, &search_request)?;
    let query = format!(
        "SELECT substr(session.started_at_local, 1, 10), session.origin_id,
                COUNT(*), SUM(session.duration_milliseconds),
                COUNT(session.distance_meters), SUM(session.distance_meters),
                SUM(CASE WHEN session.average_heart_rate_bpm IS NOT NULL
                              OR session.maximum_heart_rate_bpm IS NOT NULL
                         THEN 1 ELSE 0 END)
         FROM training_session AS session
         WHERE {where_clause}
         GROUP BY substr(session.started_at_local, 1, 10), session.origin_id
         ORDER BY substr(session.started_at_local, 1, 10), session.origin_id"
    );
    let mut statement = transaction.prepare(&query).map_err(discovery_failure)?;
    let rows = statement
        .query_map(params_from_iter(values.iter()), |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, Option<f64>>(5)?,
                row.get::<_, i64>(6)?,
            ))
        })
        .map_err(discovery_failure)?;
    let mut days = Vec::new();
    for row in rows {
        let (
            local_date,
            origin_id,
            session_count,
            total_duration_milliseconds,
            distance_session_count,
            total_distance_meters,
            heart_rate_session_count,
        ) = row.map_err(discovery_failure)?;
        let source_index = source_indices.get(&origin_id).copied().ok_or_else(|| {
            TrainingSessionDiscoveryPortError::Failure(
                "training calendar origin has no source index".to_owned(),
            )
        })?;
        days.push(TrainingSessionCalendarDay {
            local_date,
            source_index,
            session_count: persisted_count(session_count, "calendar_session_count")
                .map_err(discovery_failure)?,
            total_duration_milliseconds: i128::from(total_duration_milliseconds),
            distance_session_count: persisted_count(
                distance_session_count,
                "calendar_distance_session_count",
            )
            .map_err(discovery_failure)?,
            total_distance_meters,
            heart_rate_session_count: persisted_count(
                heart_rate_session_count,
                "calendar_heart_rate_session_count",
            )
            .map_err(discovery_failure)?,
        });
    }
    drop(statement);
    transaction.commit().map_err(discovery_failure)?;
    Ok(PersistedTrainingSessionCalendar {
        available_range,
        snapshot_ref,
        days,
    })
}

fn query_training_session_selection_discovery(
    database_path: &Path,
    request: &TrainingSessionSelectionRequest,
) -> std::result::Result<PersistedTrainingSessionSelection, TrainingSessionDiscoveryPortError> {
    let mut connection = Connection::open(database_path).map_err(discovery_failure)?;
    ensure_schema(&connection).map_err(discovery_failure)?;
    let transaction = connection.transaction().map_err(discovery_failure)?;
    let revision = transaction
        .query_row(
            "SELECT revision FROM training_discovery_revision WHERE id = 1",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(discovery_failure)?;
    if revision < 1 {
        return Err(TrainingSessionDiscoveryPortError::Failure(
            "training discovery revision is invalid".to_owned(),
        ));
    }
    let snapshot_ref = training_snapshot_ref(revision);
    if request
        .snapshot_ref
        .as_ref()
        .is_some_and(|expected| expected != &snapshot_ref)
    {
        return Err(TrainingSessionDiscoveryPortError::SnapshotChanged);
    }
    let sport_entries = query_training_discovery_sports(&transaction).map_err(discovery_failure)?;
    let source_indices = sport_entries
        .iter()
        .map(|entry| entry.origin_id.clone())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .enumerate()
        .map(|(index, origin)| (origin, index + 1))
        .collect::<BTreeMap<_, _>>();
    let sport_by_identity = sport_entries
        .into_iter()
        .map(|entry| {
            (
                (entry.origin_id, entry.source_sport_ref),
                entry.public_sport,
            )
        })
        .collect::<HashMap<_, _>>();
    let requested = request
        .session_refs
        .iter()
        .map(String::as_str)
        .collect::<HashSet<_>>();
    let mut statement = transaction
        .prepare(
            "SELECT origin_id, session_id, started_at_local, stopped_at_local,
                    utc_offset_minutes, duration_milliseconds, distance_meters,
                    energy_kilocalories, average_heart_rate_bpm, maximum_heart_rate_bpm,
                    sport_ref, exercise_count
             FROM training_session
             ORDER BY origin_id, session_id",
        )
        .map_err(discovery_failure)?;
    let rows = statement
        .query_map([], |row| {
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
        })
        .map_err(discovery_failure)?;
    let mut selected_by_ref = HashMap::new();
    for row in rows {
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
            source_sport_ref,
            exercise_count,
        ) = row.map_err(discovery_failure)?;
        let session_ref = training_session_ref(&origin_id, &session_id);
        if !requested.contains(session_ref.as_str()) {
            continue;
        }
        let source_index = source_indices.get(&origin_id).copied().ok_or_else(|| {
            TrainingSessionDiscoveryPortError::Failure(
                "selected training session origin has no source index".to_owned(),
            )
        })?;
        let sport = sport_by_identity
            .get(&(origin_id, source_sport_ref))
            .cloned()
            .ok_or_else(|| {
                TrainingSessionDiscoveryPortError::Failure(
                    "selected training session sport context is unavailable".to_owned(),
                )
            })?;
        selected_by_ref.insert(
            session_ref.clone(),
            TrainingSessionSearchItem {
                session_ref: session_ref.clone(),
                source_index,
                started_at_local,
                stopped_at_local,
                utc_offset_minutes,
                duration_milliseconds,
                distance_meters,
                energy_kilocalories,
                average_heart_rate_bpm,
                maximum_heart_rate_bpm,
                exercise_count: exercise_count
                    .map(|count| persisted_count(count, "exercise_count"))
                    .transpose()
                    .map_err(discovery_failure)?,
                sport,
            },
        );
    }
    drop(statement);
    let sessions = request
        .session_refs
        .iter()
        .filter_map(|session_ref| selected_by_ref.remove(session_ref))
        .collect();
    transaction.commit().map_err(discovery_failure)?;
    Ok(PersistedTrainingSessionSelection {
        snapshot_ref,
        sessions,
    })
}

fn query_training_session_structure_discovery(
    database_path: &Path,
    query: &TrainingSessionStructureQuery,
) -> std::result::Result<PersistedTrainingSessionStructure, TrainingSessionStructurePortError> {
    let mut connection = Connection::open(database_path).map_err(training_detail_failure)?;
    ensure_schema(&connection).map_err(training_detail_failure)?;
    let transaction = connection.transaction().map_err(training_detail_failure)?;
    let revision = transaction
        .query_row(
            "SELECT revision FROM training_discovery_revision WHERE id = 1",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(training_detail_failure)?;
    if revision < 1 {
        return Err(TrainingSessionStructurePortError::Failure(
            "training discovery revision is invalid".to_owned(),
        ));
    }
    let snapshot_ref = training_snapshot_ref(revision);
    if query
        .snapshot_ref
        .as_ref()
        .is_some_and(|expected| expected != &snapshot_ref)
    {
        return Err(TrainingSessionStructurePortError::SnapshotChanged);
    }
    let identity = {
        let mut statement = transaction
            .prepare(
                "SELECT origin_id, session_id FROM training_session ORDER BY origin_id, session_id",
            )
            .map_err(training_detail_failure)?;
        let rows = statement
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(training_detail_failure)?;
        let mut identity = None;
        for row in rows {
            let (origin_id, session_id) = row.map_err(training_detail_failure)?;
            if training_session_ref(&origin_id, &session_id) == query.session_ref {
                identity = Some((origin_id, session_id));
                break;
            }
        }
        identity
    }
    .ok_or(TrainingSessionStructurePortError::NotFound)?;
    let structure = query_training_session_structure_on(&transaction, &identity.0, &identity.1)
        .map_err(training_detail_failure)?;
    let sport_entries = query_training_discovery_sports(&transaction)
        .map_err(training_detail_failure)?
        .into_iter()
        .map(|entry| {
            (
                (entry.origin_id, entry.source_sport_ref),
                entry.public_sport,
            )
        })
        .collect::<HashMap<_, _>>();
    let structure = structure
        .map(
            |structure| -> std::result::Result<_, TrainingSessionStructurePortError> {
                Ok(TrainingStructure {
                    exercises: structure
                        .exercises
                        .map(|exercises| {
                            exercises
                                .into_iter()
                                .map(|exercise| {
                                    let sport = sport_entries
                                        .get(&(identity.0.clone(), exercise.sport_ref.clone()))
                                        .cloned()
                                        .ok_or_else(|| {
                                            TrainingSessionStructurePortError::Failure(
                                                "training exercise sport context is unavailable"
                                                    .to_owned(),
                                            )
                                        })?;
                                    let map_laps = |laps: Option<Vec<TrainingLap>>| {
                                        laps.map(|laps| {
                                            laps.into_iter()
                                                .map(|lap| TrainingLapStructure {
                                                    lap_ref: training_lap_ref(
                                                        &identity.0,
                                                        &identity.1,
                                                        &exercise.exercise_id,
                                                        lap.kind,
                                                        lap.ordinal,
                                                    ),
                                                    ordinal: lap.ordinal,
                                                    split_time_milliseconds: lap
                                                        .split_time_milliseconds,
                                                    duration_milliseconds: lap
                                                        .duration_milliseconds,
                                                    distance_meters: lap.distance_meters,
                                                })
                                                .collect()
                                        })
                                    };
                                    let pauses = exercise.pauses.map(|pauses| {
                                        pauses
                                            .into_iter()
                                            .map(|pause| TrainingPauseStructure {
                                                pause_ref: training_pause_ref(
                                                    &identity.0,
                                                    &identity.1,
                                                    &exercise.exercise_id,
                                                    pause.ordinal,
                                                ),
                                                ordinal: pause.ordinal,
                                                started_at_local: pause.started_at_local,
                                                ended_at_local: pause.ended_at_local,
                                            })
                                            .collect()
                                    });
                                    Ok(TrainingExerciseStructure {
                                        exercise_ref: training_exercise_ref(
                                            &identity.0,
                                            &identity.1,
                                            &exercise.exercise_id,
                                        ),
                                        ordinal: exercise.ordinal,
                                        started_at_local: exercise.started_at_local,
                                        stopped_at_local: exercise.stopped_at_local,
                                        utc_offset_minutes: exercise.utc_offset_minutes,
                                        duration_milliseconds: exercise.duration_milliseconds,
                                        distance_meters: exercise.distance_meters,
                                        energy_kilocalories: exercise.energy_kilocalories,
                                        sport,
                                        manual_laps: map_laps(exercise.manual_laps),
                                        automatic_laps: map_laps(exercise.automatic_laps),
                                        pauses,
                                    })
                                })
                                .collect::<std::result::Result<Vec<_>, _>>()
                        })
                        .transpose()?,
                })
            },
        )
        .transpose()?;
    transaction.commit().map_err(training_detail_failure)?;
    Ok(PersistedTrainingSessionStructure {
        snapshot_ref,
        session_ref: query.session_ref.clone(),
        structure,
    })
}

fn route_snapshot_and_identity(
    transaction: &Transaction<'_>,
    session_ref: &str,
    expected_snapshot_ref: Option<&str>,
) -> std::result::Result<(String, String, String), TrainingSessionRoutePortError> {
    let revision = transaction
        .query_row(
            "SELECT revision FROM training_discovery_revision WHERE id = 1",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(training_route_failure)?;
    if revision < 1 {
        return Err(TrainingSessionRoutePortError::Failure(
            "training discovery revision is invalid".to_owned(),
        ));
    }
    let snapshot_ref = training_snapshot_ref(revision);
    if expected_snapshot_ref.is_some_and(|expected| expected != snapshot_ref) {
        return Err(TrainingSessionRoutePortError::SnapshotChanged);
    }
    let mut statement = transaction
        .prepare(
            "SELECT origin_id, session_id FROM training_session ORDER BY origin_id, session_id",
        )
        .map_err(training_route_failure)?;
    let rows = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(training_route_failure)?;
    for row in rows {
        let (origin_id, session_id) = row.map_err(training_route_failure)?;
        if training_session_ref(&origin_id, &session_id) == session_ref {
            return Ok((snapshot_ref, origin_id, session_id));
        }
    }
    Err(TrainingSessionRoutePortError::NotFound)
}

fn training_route_kind_view(kind: TrainingRouteKind) -> TrainingRouteKindView {
    match kind {
        TrainingRouteKind::Primary => TrainingRouteKindView::Primary,
        TrainingRouteKind::Transition => TrainingRouteKindView::Transition,
    }
}

fn query_training_route_overview_on(
    transaction: &Transaction<'_>,
    origin_id: &str,
    session_id: &str,
    exercise_id: &str,
    kind: TrainingRouteKind,
    max_visual_points: usize,
) -> std::result::Result<Option<TrainingRouteOverview>, TrainingSessionRoutePortError> {
    let kind_code = training_route_kind_code(kind);
    let persisted = transaction
        .query_row(
            "SELECT started_at_local, point_count, altitude_point_count,
                    elapsed_point_count
             FROM training_route
             WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3 AND kind = ?4",
            params![origin_id, session_id, exercise_id, kind_code],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, i64>(3)?,
                ))
            },
        )
        .optional()
        .map_err(training_route_failure)?;
    let Some((started_at_local, point_count, altitude_point_count, elapsed_point_count)) =
        persisted
    else {
        return Ok(None);
    };
    let point_count = persisted_count(point_count, "training_route.point_count")
        .map_err(training_route_failure)?;
    let altitude_point_count =
        persisted_count(altitude_point_count, "training_route.altitude_point_count")
            .map_err(training_route_failure)?;
    let elapsed_point_count =
        persisted_count(elapsed_point_count, "training_route.elapsed_point_count")
            .map_err(training_route_failure)?;
    let selected_count = point_count.min(max_visual_points);
    let selected_ordinals = (0..selected_count)
        .map(|index| {
            if selected_count <= 1 {
                0
            } else {
                ((index as u128 * (point_count - 1) as u128) / (selected_count - 1) as u128)
                    as usize
            }
        })
        .collect::<Vec<_>>();
    let visual_points = if selected_ordinals.is_empty() {
        Vec::new()
    } else {
        let placeholders = (0..selected_ordinals.len())
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(", ");
        let sql = format!(
            "SELECT ordinal, latitude_degrees, longitude_degrees, altitude_meters,
                    elapsed_milliseconds
             FROM training_route_point
             WHERE origin_id = ? AND session_id = ? AND exercise_id = ? AND kind = ?
               AND ordinal IN ({placeholders})
             ORDER BY ordinal"
        );
        let mut values = vec![
            Value::Text(origin_id.to_owned()),
            Value::Text(session_id.to_owned()),
            Value::Text(exercise_id.to_owned()),
            Value::Text(kind_code.to_owned()),
        ];
        for ordinal in selected_ordinals {
            values.push(Value::Integer(i64::try_from(ordinal).map_err(|_| {
                TrainingSessionRoutePortError::Failure(
                    "route point ordinal is too large".to_owned(),
                )
            })?));
        }
        let mut statement = transaction.prepare(&sql).map_err(training_route_failure)?;
        let rows = statement
            .query_map(params_from_iter(values), |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, f64>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, Option<f64>>(3)?,
                    row.get::<_, Option<i64>>(4)?,
                ))
            })
            .map_err(training_route_failure)?;
        rows.map(|row| {
            let (
                ordinal,
                latitude_degrees,
                longitude_degrees,
                altitude_meters,
                elapsed_milliseconds,
            ) = row.map_err(training_route_failure)?;
            Ok(TrainingRoutePointView {
                ordinal: persisted_count(ordinal, "training_route_point.ordinal")
                    .map_err(training_route_failure)?,
                latitude_degrees,
                longitude_degrees,
                altitude_meters,
                elapsed_milliseconds,
            })
        })
        .collect::<std::result::Result<Vec<_>, TrainingSessionRoutePortError>>()?
    };
    Ok(Some(TrainingRouteOverview {
        route_ref: training_route_ref(origin_id, session_id, exercise_id, kind),
        kind: training_route_kind_view(kind),
        started_at_local,
        point_count,
        altitude_point_count,
        elapsed_point_count,
        visual_points,
    }))
}

fn query_training_session_routes_discovery(
    database_path: &Path,
    query: &TrainingSessionRouteQuery,
) -> std::result::Result<PersistedTrainingSessionRoutes, TrainingSessionRoutePortError> {
    let mut connection = Connection::open(database_path).map_err(training_route_failure)?;
    ensure_schema(&connection).map_err(training_route_failure)?;
    let transaction = connection.transaction().map_err(training_route_failure)?;
    let (snapshot_ref, origin_id, session_id) = route_snapshot_and_identity(
        &transaction,
        &query.session_ref,
        query.snapshot_ref.as_deref(),
    )?;
    let exercises_present = transaction
        .query_row(
            "SELECT exercises_present FROM training_session_route_assessment
             WHERE origin_id = ?1 AND session_id = ?2",
            params![origin_id, session_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(training_route_failure)?;
    let routes = match exercises_present {
        None => None,
        Some(value)
            if !persisted_training_flag(value, "route exercises_present")
                .map_err(training_route_failure)? =>
        {
            Some(TrainingSessionRoutesView { exercises: None })
        }
        Some(_) => {
            let mut statement = transaction
                .prepare(
                    "SELECT exercise_id, ordinal, routes_present
                     FROM training_exercise_route_assessment
                     WHERE origin_id = ?1 AND session_id = ?2
                     ORDER BY ordinal",
                )
                .map_err(training_route_failure)?;
            let rows = statement
                .query_map(params![origin_id, session_id], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, i64>(2)?,
                    ))
                })
                .map_err(training_route_failure)?;
            let mut exercises = Vec::new();
            for row in rows {
                let (exercise_id, ordinal, routes_present) = row.map_err(training_route_failure)?;
                let routes = if persisted_training_flag(routes_present, "routes_present")
                    .map_err(training_route_failure)?
                {
                    Some(TrainingRouteCollectionView {
                        primary: query_training_route_overview_on(
                            &transaction,
                            &origin_id,
                            &session_id,
                            &exercise_id,
                            TrainingRouteKind::Primary,
                            query.max_visual_points,
                        )?,
                        transition: query_training_route_overview_on(
                            &transaction,
                            &origin_id,
                            &session_id,
                            &exercise_id,
                            TrainingRouteKind::Transition,
                            query.max_visual_points,
                        )?,
                    })
                } else {
                    None
                };
                exercises.push(TrainingExerciseRoutesView {
                    exercise_ref: training_exercise_ref(&origin_id, &session_id, &exercise_id),
                    ordinal: persisted_count(ordinal, "training exercise route ordinal")
                        .map_err(training_route_failure)?,
                    routes,
                });
            }
            drop(statement);
            Some(TrainingSessionRoutesView {
                exercises: Some(exercises),
            })
        }
    };
    transaction.commit().map_err(training_route_failure)?;
    Ok(PersistedTrainingSessionRoutes {
        snapshot_ref,
        session_ref: query.session_ref.clone(),
        routes,
    })
}

fn query_training_route_points_discovery(
    database_path: &Path,
    query: &TrainingRoutePointsQuery,
) -> std::result::Result<PersistedTrainingRoutePoints, TrainingSessionRoutePortError> {
    let mut connection = Connection::open(database_path).map_err(training_route_failure)?;
    ensure_schema(&connection).map_err(training_route_failure)?;
    let transaction = connection.transaction().map_err(training_route_failure)?;
    let (snapshot_ref, origin_id, session_id) = route_snapshot_and_identity(
        &transaction,
        &query.session_ref,
        query.snapshot_ref.as_deref(),
    )?;
    let mut route_statement = transaction
        .prepare(
            "SELECT exercise_id, kind, point_count
             FROM training_route
             WHERE origin_id = ?1 AND session_id = ?2
             ORDER BY exercise_id, kind",
        )
        .map_err(training_route_failure)?;
    let route_rows = route_statement
        .query_map(params![origin_id, session_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })
        .map_err(training_route_failure)?;
    let mut identity = None;
    for row in route_rows {
        let (exercise_id, kind, point_count) = row.map_err(training_route_failure)?;
        let kind = match kind.as_str() {
            "primary" => TrainingRouteKind::Primary,
            "transition" => TrainingRouteKind::Transition,
            _ => {
                return Err(TrainingSessionRoutePortError::Failure(
                    "stored route kind is invalid".to_owned(),
                ))
            }
        };
        if training_route_ref(&origin_id, &session_id, &exercise_id, kind) == query.route_ref {
            identity = Some((
                exercise_id,
                kind,
                persisted_count(point_count, "training_route.point_count")
                    .map_err(training_route_failure)?,
            ));
            break;
        }
    }
    drop(route_statement);
    let (exercise_id, kind, point_count) =
        identity.ok_or(TrainingSessionRoutePortError::NotFound)?;
    let offset = i64::try_from(query.offset).map_err(|_| {
        TrainingSessionRoutePortError::Failure("route point offset is too large".to_owned())
    })?;
    let limit = i64::try_from(query.limit).map_err(|_| {
        TrainingSessionRoutePortError::Failure("route point limit is too large".to_owned())
    })?;
    let mut statement = transaction
        .prepare(
            "SELECT ordinal, latitude_degrees, longitude_degrees, altitude_meters,
                    elapsed_milliseconds
             FROM training_route_point
             WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3 AND kind = ?4
             ORDER BY ordinal
             LIMIT ?5 OFFSET ?6",
        )
        .map_err(training_route_failure)?;
    let rows = statement
        .query_map(
            params![
                origin_id,
                session_id,
                exercise_id,
                training_route_kind_code(kind),
                limit,
                offset
            ],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, f64>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, Option<f64>>(3)?,
                    row.get::<_, Option<i64>>(4)?,
                ))
            },
        )
        .map_err(training_route_failure)?;
    let points = rows
        .map(|row| {
            let (
                ordinal,
                latitude_degrees,
                longitude_degrees,
                altitude_meters,
                elapsed_milliseconds,
            ) = row.map_err(training_route_failure)?;
            Ok(TrainingRoutePointView {
                ordinal: persisted_count(ordinal, "training_route_point.ordinal")
                    .map_err(training_route_failure)?,
                latitude_degrees,
                longitude_degrees,
                altitude_meters,
                elapsed_milliseconds,
            })
        })
        .collect::<std::result::Result<Vec<_>, TrainingSessionRoutePortError>>()?;
    drop(statement);
    let next_offset =
        (query.offset + points.len() < point_count).then_some(query.offset + points.len());
    transaction.commit().map_err(training_route_failure)?;
    Ok(PersistedTrainingRoutePoints {
        snapshot_ref,
        session_ref: query.session_ref.clone(),
        route_ref: query.route_ref.clone(),
        point_count,
        offset: query.offset,
        points,
        next_offset,
    })
}

fn signal_snapshot_and_identity(
    transaction: &Transaction<'_>,
    session_ref: &str,
    expected_snapshot_ref: Option<&str>,
) -> std::result::Result<(String, String, String), TrainingSessionSignalPortError> {
    let revision = transaction
        .query_row(
            "SELECT revision FROM training_discovery_revision WHERE id = 1",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(training_signal_failure)?;
    if revision < 1 {
        return Err(TrainingSessionSignalPortError::Failure(
            "training discovery revision is invalid".to_owned(),
        ));
    }
    let snapshot_ref = training_snapshot_ref(revision);
    if expected_snapshot_ref.is_some_and(|expected| expected != snapshot_ref) {
        return Err(TrainingSessionSignalPortError::SnapshotChanged);
    }
    let mut statement = transaction
        .prepare(
            "SELECT origin_id, session_id FROM training_session ORDER BY origin_id, session_id",
        )
        .map_err(training_signal_failure)?;
    let rows = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(training_signal_failure)?;
    for row in rows {
        let (origin_id, session_id) = row.map_err(training_signal_failure)?;
        if training_session_ref(&origin_id, &session_id) == session_ref {
            return Ok((snapshot_ref, origin_id, session_id));
        }
    }
    Err(TrainingSessionSignalPortError::NotFound)
}

fn training_signal_kind_view(kind: TrainingSignalKind) -> TrainingSignalKindView {
    match kind {
        TrainingSignalKind::HeartRate => TrainingSignalKindView::HeartRate,
        TrainingSignalKind::Speed => TrainingSignalKindView::Speed,
        TrainingSignalKind::Distance => TrainingSignalKindView::Distance,
        TrainingSignalKind::Altitude => TrainingSignalKindView::Altitude,
        TrainingSignalKind::Cadence => TrainingSignalKindView::Cadence,
        TrainingSignalKind::Temperature => TrainingSignalKindView::Temperature,
        TrainingSignalKind::LeftCrankPower => TrainingSignalKindView::LeftCrankPower,
    }
}

fn training_signal_unit_view(unit: TrainingSignalUnit) -> TrainingSignalUnitView {
    match unit {
        TrainingSignalUnit::BeatsPerMinute => TrainingSignalUnitView::BeatsPerMinute,
        TrainingSignalUnit::KilometersPerHour => TrainingSignalUnitView::KilometersPerHour,
        TrainingSignalUnit::Meters => TrainingSignalUnitView::Meters,
        TrainingSignalUnit::RotationsPerMinute => TrainingSignalUnitView::RotationsPerMinute,
        TrainingSignalUnit::DegreesCelsius => TrainingSignalUnitView::DegreesCelsius,
        TrainingSignalUnit::Watts => TrainingSignalUnitView::Watts,
    }
}

fn query_training_signal_overviews_on(
    transaction: &Transaction<'_>,
    origin_id: &str,
    session_id: &str,
    exercise_id: &str,
    role: TrainingSignalRoleView,
    max_visual_samples: usize,
) -> std::result::Result<Vec<TrainingSignalSeriesOverview>, TrainingSessionSignalPortError> {
    let role_code = training_signal_role_code(role);
    let mut statement = transaction
        .prepare(
            "SELECT series_id, ordinal, kind, unit, interval_milliseconds, sample_count,
                    available_sample_count
             FROM training_signal_series
             WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3 AND role = ?4
             ORDER BY ordinal",
        )
        .map_err(training_signal_failure)?;
    let rows = statement
        .query_map(
            params![origin_id, session_id, exercise_id, role_code],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, i64>(5)?,
                    row.get::<_, i64>(6)?,
                ))
            },
        )
        .map_err(training_signal_failure)?;
    let mut overviews = Vec::new();
    for row in rows {
        let (
            series_id,
            ordinal,
            kind,
            unit,
            interval_milliseconds,
            sample_count,
            available_sample_count,
        ) = row.map_err(training_signal_failure)?;
        let ordinal = persisted_count(ordinal, "training_signal_series.ordinal")
            .map_err(training_signal_failure)?;
        let sample_count = persisted_count(sample_count, "training_signal_series.sample_count")
            .map_err(training_signal_failure)?;
        let available_sample_count = persisted_count(
            available_sample_count,
            "training_signal_series.available_sample_count",
        )
        .map_err(training_signal_failure)?;
        if ordinal != overviews.len()
            || interval_milliseconds <= 0
            || available_sample_count > sample_count
        {
            return Err(TrainingSessionSignalPortError::Failure(
                "stored signal metadata is inconsistent".to_owned(),
            ));
        }
        let (kind, unit) =
            training_signal_kind_and_unit(&kind, &unit).map_err(training_signal_failure)?;
        let selected_count = sample_count.min(max_visual_samples);
        let selected_ordinals = (0..selected_count)
            .map(|index| {
                if selected_count <= 1 {
                    0
                } else {
                    ((index as u128 * (sample_count - 1) as u128) / (selected_count - 1) as u128)
                        as usize
                }
            })
            .collect::<Vec<_>>();
        let visual_samples = if selected_ordinals.is_empty() {
            Vec::new()
        } else {
            let selected_rows = selected_ordinals
                .iter()
                .enumerate()
                .map(|(index, _)| {
                    index.checked_sub(1).map_or_else(
                        || "(?, NULL)".to_owned(),
                        |previous| format!("(?, {})", selected_ordinals[previous]),
                    )
                })
                .collect::<Vec<_>>()
                .join(", ");
            let sql = format!(
                "WITH selected(ordinal, previous_ordinal) AS (VALUES {selected_rows})
                 SELECT sample.ordinal, sample.value,
                        CASE WHEN selected.previous_ordinal IS NULL THEN 0 ELSE EXISTS (
                            SELECT 1 FROM training_signal_sample AS gap
                            WHERE gap.series_id = sample.series_id
                              AND gap.ordinal > selected.previous_ordinal
                              AND gap.ordinal <= selected.ordinal
                              AND gap.value IS NULL
                        ) END
                 FROM selected
                 CROSS JOIN training_signal_sample AS sample
                   ON sample.series_id = ? AND sample.ordinal = selected.ordinal
                 ORDER BY sample.ordinal"
            );
            let mut values = Vec::with_capacity(selected_ordinals.len() + 1);
            for selected_ordinal in selected_ordinals {
                values.push(Value::Integer(i64::try_from(selected_ordinal).map_err(
                    |_| {
                        TrainingSessionSignalPortError::Failure(
                            "signal sample ordinal is too large".to_owned(),
                        )
                    },
                )?));
            }
            values.push(Value::Integer(series_id));
            let mut sample_statement =
                transaction.prepare(&sql).map_err(training_signal_failure)?;
            let sample_rows = sample_statement
                .query_map(params_from_iter(values), |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, Option<f64>>(1)?,
                        row.get::<_, bool>(2)?,
                    ))
                })
                .map_err(training_signal_failure)?;
            sample_rows
                .map(|row| {
                    let (sample_ordinal, value, gap_before) =
                        row.map_err(training_signal_failure)?;
                    let sample_ordinal =
                        persisted_count(sample_ordinal, "training_signal_sample.ordinal")
                            .map_err(training_signal_failure)?;
                    let elapsed_milliseconds = i64::try_from(sample_ordinal)
                        .ok()
                        .and_then(|value| value.checked_mul(interval_milliseconds))
                        .ok_or_else(|| {
                            TrainingSessionSignalPortError::Failure(
                                "signal elapsed time is too large".to_owned(),
                            )
                        })?;
                    Ok(TrainingSignalVisualSampleView {
                        ordinal: sample_ordinal,
                        elapsed_milliseconds,
                        value,
                        gap_before,
                    })
                })
                .collect::<std::result::Result<Vec<_>, TrainingSessionSignalPortError>>()?
        };
        overviews.push(TrainingSignalSeriesOverview {
            signal_ref: training_signal_ref(origin_id, session_id, exercise_id, role, ordinal),
            ordinal,
            role,
            kind: training_signal_kind_view(kind),
            unit: training_signal_unit_view(unit),
            interval_milliseconds,
            sample_count,
            available_sample_count,
            visual_samples,
        });
    }
    Ok(overviews)
}

fn query_training_session_signals_discovery(
    database_path: &Path,
    query: &TrainingSessionSignalsQuery,
) -> std::result::Result<PersistedTrainingSessionSignals, TrainingSessionSignalPortError> {
    let mut connection = Connection::open(database_path).map_err(training_signal_failure)?;
    ensure_schema(&connection).map_err(training_signal_failure)?;
    let transaction = connection.transaction().map_err(training_signal_failure)?;
    let (snapshot_ref, origin_id, session_id) = signal_snapshot_and_identity(
        &transaction,
        &query.session_ref,
        query.snapshot_ref.as_deref(),
    )?;
    let exercises_present = transaction
        .query_row(
            "SELECT exercises_present FROM training_session_signal_assessment
             WHERE origin_id = ?1 AND session_id = ?2",
            params![origin_id, session_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(training_signal_failure)?;
    let signals = match exercises_present {
        None => None,
        Some(value)
            if !persisted_training_flag(value, "signal exercises_present")
                .map_err(training_signal_failure)? =>
        {
            Some(TrainingSessionSignalsView { exercises: None })
        }
        Some(_) => {
            let mut statement = transaction
                .prepare(
                    "SELECT exercise_id, ordinal, signals_present, primary_present,
                            transition_present, unsupported_primary_series_count,
                            unsupported_transition_series_count
                     FROM training_exercise_signal_assessment
                     WHERE origin_id = ?1 AND session_id = ?2
                     ORDER BY ordinal",
                )
                .map_err(training_signal_failure)?;
            let rows = statement
                .query_map(params![origin_id, session_id], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, i64>(3)?,
                        row.get::<_, i64>(4)?,
                        row.get::<_, i64>(5)?,
                        row.get::<_, i64>(6)?,
                    ))
                })
                .map_err(training_signal_failure)?;
            let mut exercises = Vec::new();
            for row in rows {
                let (
                    exercise_id,
                    ordinal,
                    signals_present,
                    primary_present,
                    transition_present,
                    unsupported_primary_series_count,
                    unsupported_transition_series_count,
                ) = row.map_err(training_signal_failure)?;
                let signals = if persisted_training_flag(signals_present, "signals_present")
                    .map_err(training_signal_failure)?
                {
                    Some(TrainingSignalCollectionView {
                        primary: persisted_training_flag(primary_present, "primary_present")
                            .map_err(training_signal_failure)?
                            .then(|| {
                                query_training_signal_overviews_on(
                                    &transaction,
                                    &origin_id,
                                    &session_id,
                                    &exercise_id,
                                    TrainingSignalRoleView::Primary,
                                    query.max_visual_samples,
                                )
                            })
                            .transpose()?,
                        transition: persisted_training_flag(
                            transition_present,
                            "transition_present",
                        )
                        .map_err(training_signal_failure)?
                        .then(|| {
                            query_training_signal_overviews_on(
                                &transaction,
                                &origin_id,
                                &session_id,
                                &exercise_id,
                                TrainingSignalRoleView::Transition,
                                query.max_visual_samples,
                            )
                        })
                        .transpose()?,
                        unsupported_primary_series_count: persisted_count(
                            unsupported_primary_series_count,
                            "unsupported_primary_series_count",
                        )
                        .map_err(training_signal_failure)?,
                        unsupported_transition_series_count: persisted_count(
                            unsupported_transition_series_count,
                            "unsupported_transition_series_count",
                        )
                        .map_err(training_signal_failure)?,
                    })
                } else {
                    None
                };
                exercises.push(TrainingExerciseSignalsView {
                    exercise_ref: training_exercise_ref(&origin_id, &session_id, &exercise_id),
                    ordinal: persisted_count(ordinal, "training exercise signal ordinal")
                        .map_err(training_signal_failure)?,
                    signals,
                });
            }
            drop(statement);
            Some(TrainingSessionSignalsView {
                exercises: Some(exercises),
            })
        }
    };
    transaction.commit().map_err(training_signal_failure)?;
    Ok(PersistedTrainingSessionSignals {
        snapshot_ref,
        session_ref: query.session_ref.clone(),
        signals,
    })
}

fn query_training_signal_samples_discovery(
    database_path: &Path,
    query: &TrainingSignalSamplesQuery,
) -> std::result::Result<PersistedTrainingSignalSamples, TrainingSessionSignalPortError> {
    let mut connection = Connection::open(database_path).map_err(training_signal_failure)?;
    ensure_schema(&connection).map_err(training_signal_failure)?;
    let transaction = connection.transaction().map_err(training_signal_failure)?;
    let (snapshot_ref, origin_id, session_id) = signal_snapshot_and_identity(
        &transaction,
        &query.session_ref,
        query.snapshot_ref.as_deref(),
    )?;
    let mut series_statement = transaction
        .prepare(
            "SELECT series_id, exercise_id, role, ordinal, kind, unit,
                    interval_milliseconds, sample_count
             FROM training_signal_series
             WHERE origin_id = ?1 AND session_id = ?2
             ORDER BY exercise_id, role, ordinal",
        )
        .map_err(training_signal_failure)?;
    let rows = series_statement
        .query_map(params![origin_id, session_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, i64>(7)?,
            ))
        })
        .map_err(training_signal_failure)?;
    let mut identity = None;
    for row in rows {
        let (
            series_id,
            exercise_id,
            role,
            ordinal,
            kind,
            unit,
            interval_milliseconds,
            sample_count,
        ) = row.map_err(training_signal_failure)?;
        let role = match role.as_str() {
            "primary" => TrainingSignalRoleView::Primary,
            "transition" => TrainingSignalRoleView::Transition,
            _ => {
                return Err(TrainingSessionSignalPortError::Failure(
                    "stored signal role is invalid".to_owned(),
                ))
            }
        };
        let ordinal = persisted_count(ordinal, "training_signal_series.ordinal")
            .map_err(training_signal_failure)?;
        if training_signal_ref(&origin_id, &session_id, &exercise_id, role, ordinal)
            == query.signal_ref
        {
            let (kind, unit) =
                training_signal_kind_and_unit(&kind, &unit).map_err(training_signal_failure)?;
            identity = Some((
                series_id,
                exercise_id,
                role,
                ordinal,
                kind,
                unit,
                interval_milliseconds,
                persisted_count(sample_count, "training_signal_series.sample_count")
                    .map_err(training_signal_failure)?,
            ));
            break;
        }
    }
    drop(series_statement);
    let (series_id, exercise_id, role, ordinal, kind, unit, interval_milliseconds, sample_count) =
        identity.ok_or(TrainingSessionSignalPortError::NotFound)?;
    let offset = i64::try_from(query.offset).map_err(|_| {
        TrainingSessionSignalPortError::Failure("signal sample offset is too large".to_owned())
    })?;
    let limit = i64::try_from(query.limit).map_err(|_| {
        TrainingSessionSignalPortError::Failure("signal sample limit is too large".to_owned())
    })?;
    let mut statement = transaction
        .prepare(
            "SELECT ordinal, value FROM training_signal_sample
             WHERE series_id = ?1
             ORDER BY ordinal LIMIT ?2 OFFSET ?3",
        )
        .map_err(training_signal_failure)?;
    let sample_rows = statement
        .query_map(params![series_id, limit, offset], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, Option<f64>>(1)?))
        })
        .map_err(training_signal_failure)?;
    let samples = sample_rows
        .map(|row| {
            let (sample_ordinal, value) = row.map_err(training_signal_failure)?;
            let sample_ordinal = persisted_count(sample_ordinal, "training_signal_sample.ordinal")
                .map_err(training_signal_failure)?;
            let elapsed_milliseconds = i64::try_from(sample_ordinal)
                .ok()
                .and_then(|value| value.checked_mul(interval_milliseconds))
                .ok_or_else(|| {
                    TrainingSessionSignalPortError::Failure(
                        "signal elapsed time is too large".to_owned(),
                    )
                })?;
            Ok(TrainingSignalSampleView {
                ordinal: sample_ordinal,
                elapsed_milliseconds,
                value,
            })
        })
        .collect::<std::result::Result<Vec<_>, TrainingSessionSignalPortError>>()?;
    drop(statement);
    let end = query.offset.checked_add(samples.len()).ok_or_else(|| {
        TrainingSessionSignalPortError::Failure(
            "signal sample continuation is too large".to_owned(),
        )
    })?;
    let next_offset = (end < sample_count).then_some(end);
    transaction.commit().map_err(training_signal_failure)?;
    Ok(PersistedTrainingSignalSamples {
        snapshot_ref,
        session_ref: query.session_ref.clone(),
        signal_ref: query.signal_ref.clone(),
        exercise_ref: training_exercise_ref(&origin_id, &session_id, &exercise_id),
        ordinal,
        role,
        kind: training_signal_kind_view(kind),
        unit: training_signal_unit_view(unit),
        interval_milliseconds,
        sample_count,
        offset: query.offset,
        samples,
        next_offset,
    })
}

fn segmentation_failure(error: impl std::fmt::Display) -> TrainingSegmentationPortError {
    TrainingSegmentationPortError::Failure(error.to_string())
}

fn segmentation_snapshot_and_identity(
    transaction: &Transaction<'_>,
    session_ref: &str,
    expected_snapshot_ref: Option<&str>,
) -> std::result::Result<(String, String, String), TrainingSegmentationPortError> {
    signal_snapshot_and_identity(transaction, session_ref, expected_snapshot_ref).map_err(|error| {
        match error {
            TrainingSessionSignalPortError::SnapshotChanged => {
                TrainingSegmentationPortError::SnapshotChanged
            }
            TrainingSessionSignalPortError::NotFound => TrainingSegmentationPortError::NotFound,
            TrainingSessionSignalPortError::Failure(reason) => {
                TrainingSegmentationPortError::Failure(reason)
            }
        }
    })
}

fn segmentation_exercise_identity(
    transaction: &Transaction<'_>,
    origin_id: &str,
    session_id: &str,
    exercise_ref: &str,
) -> std::result::Result<String, TrainingSegmentationPortError> {
    let mut statement = transaction
        .prepare(
            "SELECT exercise_id FROM training_exercise
             WHERE origin_id = ?1 AND session_id = ?2
             ORDER BY ordinal",
        )
        .map_err(segmentation_failure)?;
    let rows = statement
        .query_map(params![origin_id, session_id], |row| {
            row.get::<_, String>(0)
        })
        .map_err(segmentation_failure)?;
    for row in rows {
        let exercise_id = row.map_err(segmentation_failure)?;
        if training_exercise_ref(origin_id, session_id, &exercise_id) == exercise_ref {
            return Ok(exercise_id);
        }
    }
    Err(TrainingSegmentationPortError::NotFound)
}

fn load_segment_criteria(
    transaction: &Transaction<'_>,
) -> std::result::Result<Vec<SegmentCriterion>, TrainingSegmentationPortError> {
    let mut statement = transaction
        .prepare(
            "SELECT criterion_id, title, criterion_kind, span_milliseconds, span_meters,
                    minimum_beats_per_minute, maximum_beats_per_minute, authorship,
                    evaluation_version, revision
             FROM segment_criterion
             ORDER BY lower(title), criterion_id",
        )
        .map_err(segmentation_failure)?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<i64>>(3)?,
                row.get::<_, Option<f64>>(4)?,
                row.get::<_, Option<i64>>(5)?,
                row.get::<_, Option<i64>>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, i64>(8)?,
                row.get::<_, i64>(9)?,
            ))
        })
        .map_err(segmentation_failure)?;
    let mut stored = Vec::new();
    for row in rows {
        stored.push(row.map_err(segmentation_failure)?);
    }
    drop(statement);

    stored
        .into_iter()
        .map(
            |(
                criterion_id,
                title,
                kind,
                span_milliseconds,
                span_meters,
                minimum_beats_per_minute,
                maximum_beats_per_minute,
                authorship,
                evaluation_version,
                revision,
            )| {
                let definition = match kind.as_str() {
                    "equal-elapsed-time" => SegmentCriterionDefinition::EqualElapsedTime {
                        span_milliseconds: span_milliseconds.ok_or_else(|| {
                            segmentation_failure("equal-time criterion has no span")
                        })?,
                    },
                    "equal-distance" => SegmentCriterionDefinition::EqualDistance {
                        span_meters: span_meters.ok_or_else(|| {
                            segmentation_failure("equal-distance criterion has no span")
                        })?,
                    },
                    "heart-rate-zone" => SegmentCriterionDefinition::HeartRateZone {
                        minimum_beats_per_minute: minimum_beats_per_minute
                            .and_then(|value| u16::try_from(value).ok())
                            .ok_or_else(|| {
                                segmentation_failure("heart-rate criterion minimum is invalid")
                            })?,
                        maximum_beats_per_minute: maximum_beats_per_minute
                            .and_then(|value| u16::try_from(value).ok())
                            .ok_or_else(|| {
                                segmentation_failure("heart-rate criterion maximum is invalid")
                            })?,
                    },
                    "manual-boundaries" => {
                        let mut boundary_statement = transaction
                            .prepare(
                                "SELECT elapsed_milliseconds
                                 FROM segment_criterion_manual_boundary
                                 WHERE criterion_id = ?1
                                 ORDER BY ordinal",
                            )
                            .map_err(segmentation_failure)?;
                        let boundaries = boundary_statement
                            .query_map(params![criterion_id], |row| row.get::<_, i64>(0))
                            .map_err(segmentation_failure)?
                            .collect::<rusqlite::Result<Vec<_>>>()
                            .map_err(segmentation_failure)?;
                        SegmentCriterionDefinition::ManualBoundaries {
                            elapsed_milliseconds: boundaries,
                        }
                    }
                    _ => {
                        return Err(segmentation_failure(
                            "stored segment criterion kind is invalid",
                        ))
                    }
                };
                if authorship != "user" {
                    return Err(segmentation_failure(
                        "stored segment criterion authorship is invalid",
                    ));
                }
                SegmentCriterion::restore(
                    criterion_id,
                    title,
                    definition,
                    SegmentCriterionAuthorship::User,
                    u32::try_from(evaluation_version).map_err(segmentation_failure)?,
                    u64::try_from(revision).map_err(segmentation_failure)?,
                )
                .map_err(segmentation_failure)
            },
        )
        .collect()
}

fn zone_snapshot_and_identity(
    transaction: &Transaction<'_>,
    session_ref: &str,
    expected_snapshot_ref: Option<&str>,
) -> std::result::Result<(String, String, String), TrainingSessionZonePortError> {
    let revision = transaction
        .query_row(
            "SELECT revision FROM training_discovery_revision WHERE id = 1",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(training_zone_failure)?;
    if revision < 1 {
        return Err(TrainingSessionZonePortError::Failure(
            "training discovery revision is invalid".to_owned(),
        ));
    }
    let snapshot_ref = training_snapshot_ref(revision);
    if expected_snapshot_ref.is_some_and(|expected| expected != snapshot_ref) {
        return Err(TrainingSessionZonePortError::SnapshotChanged);
    }
    let mut statement = transaction
        .prepare(
            "SELECT origin_id, session_id FROM training_session ORDER BY origin_id, session_id",
        )
        .map_err(training_zone_failure)?;
    let rows = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(training_zone_failure)?;
    for row in rows {
        let (origin_id, session_id) = row.map_err(training_zone_failure)?;
        if training_session_ref(&origin_id, &session_id) == session_ref {
            return Ok((snapshot_ref, origin_id, session_id));
        }
    }
    Err(TrainingSessionZonePortError::NotFound)
}

fn training_zone_kind_view(kind: TrainingZoneKind) -> TrainingZoneKindView {
    match kind {
        TrainingZoneKind::HeartRate => TrainingZoneKindView::HeartRate,
        TrainingZoneKind::Speed => TrainingZoneKindView::Speed,
        TrainingZoneKind::Power => TrainingZoneKindView::Power,
    }
}

fn training_zone_unit_view(unit: TrainingZoneUnit) -> TrainingZoneUnitView {
    match unit {
        TrainingZoneUnit::BeatsPerMinute => TrainingZoneUnitView::BeatsPerMinute,
        TrainingZoneUnit::KilometersPerHour => TrainingZoneUnitView::KilometersPerHour,
        TrainingZoneUnit::Watts => TrainingZoneUnitView::Watts,
    }
}

fn query_training_session_zones_discovery(
    database_path: &Path,
    query: &TrainingSessionZonesQuery,
) -> std::result::Result<PersistedTrainingSessionZones, TrainingSessionZonePortError> {
    let mut connection = Connection::open(database_path).map_err(training_zone_failure)?;
    ensure_schema(&connection).map_err(training_zone_failure)?;
    let transaction = connection.transaction().map_err(training_zone_failure)?;
    let (snapshot_ref, origin_id, session_id) = zone_snapshot_and_identity(
        &transaction,
        &query.session_ref,
        query.snapshot_ref.as_deref(),
    )?;
    let zones = query_training_session_zones_on(&transaction, &origin_id, &session_id)
        .map_err(training_zone_failure)?
        .map(|assessment| TrainingSessionZonesView {
            exercises: assessment.exercises.map(|exercises| {
                exercises
                    .into_iter()
                    .map(|exercise| TrainingExerciseZonesView {
                        exercise_ref: training_exercise_ref(
                            &origin_id,
                            &session_id,
                            &exercise.exercise_id,
                        ),
                        ordinal: exercise.ordinal,
                        zones: exercise.zones.map(|zones| TrainingZoneCollectionView {
                            groups: zones
                                .groups
                                .into_iter()
                                .map(|group| TrainingZoneGroupView {
                                    zone_group_ref: training_zone_group_ref(
                                        &origin_id,
                                        &session_id,
                                        &exercise.exercise_id,
                                        group.ordinal,
                                    ),
                                    ordinal: group.ordinal,
                                    kind: training_zone_kind_view(group.kind),
                                    unit: training_zone_unit_view(group.unit),
                                    zones: group.zones.map(|zone_values| {
                                        zone_values
                                            .into_iter()
                                            .map(|zone| TrainingZoneView {
                                                zone_ref: training_zone_ref(
                                                    &origin_id,
                                                    &session_id,
                                                    &exercise.exercise_id,
                                                    group.ordinal,
                                                    zone.ordinal,
                                                ),
                                                ordinal: zone.ordinal,
                                                lower_limit: zone.lower_limit,
                                                higher_limit: zone.higher_limit,
                                                time_in_zone_milliseconds: zone
                                                    .time_in_zone_milliseconds,
                                                distance_meters: zone.distance_meters,
                                                muscle_load: zone.muscle_load,
                                            })
                                            .collect()
                                    }),
                                })
                                .collect(),
                            unsupported_group_count: zones.unsupported_group_count,
                        }),
                    })
                    .collect()
            }),
        });
    transaction.commit().map_err(training_zone_failure)?;
    Ok(PersistedTrainingSessionZones {
        snapshot_ref,
        session_ref: query.session_ref.clone(),
        zones,
    })
}

fn provenance_snapshot_and_identity(
    transaction: &Transaction<'_>,
    session_ref: &str,
    expected_snapshot_ref: Option<&str>,
) -> std::result::Result<(String, String, String), TrainingSessionProvenancePortError> {
    let revision = transaction
        .query_row(
            "SELECT revision FROM training_discovery_revision WHERE id = 1",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(training_provenance_failure)?;
    if revision < 1 {
        return Err(TrainingSessionProvenancePortError::Failure(
            "training discovery revision is invalid".to_owned(),
        ));
    }
    let snapshot_ref = training_snapshot_ref(revision);
    if expected_snapshot_ref.is_some_and(|expected| expected != snapshot_ref) {
        return Err(TrainingSessionProvenancePortError::SnapshotChanged);
    }
    let mut statement = transaction
        .prepare(
            "SELECT origin_id, session_id FROM training_session ORDER BY origin_id, session_id",
        )
        .map_err(training_provenance_failure)?;
    let rows = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(training_provenance_failure)?;
    for row in rows {
        let (origin_id, session_id) = row.map_err(training_provenance_failure)?;
        if training_session_ref(&origin_id, &session_id) == session_ref {
            return Ok((snapshot_ref, origin_id, session_id));
        }
    }
    Err(TrainingSessionProvenancePortError::NotFound)
}

fn training_source_provider_view(
    value: &str,
) -> std::result::Result<TrainingSourceProviderView, TrainingSessionProvenancePortError> {
    match value {
        SOURCE_PROVIDER => TrainingSourceProviderView::restore(value.to_owned()).ok_or_else(|| {
            training_provenance_failure("stored training provenance provider is invalid")
        }),
        _ => Err(training_provenance_failure(
            "stored training provenance provider is invalid",
        )),
    }
}

fn training_provenance_decision_view(
    value: &str,
) -> std::result::Result<TrainingProvenanceDecisionView, TrainingSessionProvenancePortError> {
    match value {
        "create" => Ok(TrainingProvenanceDecisionView::Create),
        "equivalent" => Ok(TrainingProvenanceDecisionView::Equivalent),
        "enrich" => Ok(TrainingProvenanceDecisionView::Enrich),
        "amend" => Ok(TrainingProvenanceDecisionView::Amend),
        "preserve" => Ok(TrainingProvenanceDecisionView::Preserve),
        "conflict" => Ok(TrainingProvenanceDecisionView::Conflict),
        _ => Err(training_provenance_failure(
            "stored training provenance decision is invalid",
        )),
    }
}

fn training_provenance_utc(
    value: &str,
    field: &str,
) -> std::result::Result<String, TrainingSessionProvenancePortError> {
    if let Ok(parsed) = DateTime::parse_from_rfc3339(value) {
        if parsed.offset().local_minus_utc() != 0 {
            return Err(training_provenance_failure(format!(
                "stored {field} is not UTC"
            )));
        }
        return Ok(parsed.to_rfc3339_opts(SecondsFormat::AutoSi, true));
    }
    let parsed = NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S%.f").map_err(|_| {
        training_provenance_failure(format!("stored {field} is not a supported timestamp"))
    })?;
    Ok(parsed
        .and_utc()
        .to_rfc3339_opts(SecondsFormat::AutoSi, true))
}

fn query_training_session_provenance_discovery(
    database_path: &Path,
    query: &TrainingSessionProvenanceQuery,
) -> std::result::Result<PersistedTrainingSessionProvenance, TrainingSessionProvenancePortError> {
    let mut connection = Connection::open(database_path).map_err(training_provenance_failure)?;
    ensure_schema(&connection).map_err(training_provenance_failure)?;
    let transaction = connection
        .transaction()
        .map_err(training_provenance_failure)?;
    let (snapshot_ref, origin_id, session_id) = provenance_snapshot_and_identity(
        &transaction,
        &query.session_ref,
        query.snapshot_ref.as_deref(),
    )?;
    let (total_event_count, contributing_event_count, non_contributing_event_count) = transaction
        .query_row(
            "SELECT COUNT(*),
                    COALESCE(SUM(contributes_to_visible_state), 0),
                    COALESCE(SUM(1 - contributes_to_visible_state), 0)
             FROM training_session_provenance
             WHERE origin_id = ?1 AND session_id = ?2",
            params![origin_id, session_id],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            },
        )
        .map_err(training_provenance_failure)?;
    let total_event_count = persisted_count(total_event_count, "training provenance event count")
        .map_err(training_provenance_failure)?;
    if total_event_count == 0 {
        return Err(TrainingSessionProvenancePortError::NotFound);
    }
    let contributing_event_count = persisted_count(
        contributing_event_count,
        "contributing training provenance event count",
    )
    .map_err(training_provenance_failure)?;
    let non_contributing_event_count = persisted_count(
        non_contributing_event_count,
        "non-contributing training provenance event count",
    )
    .map_err(training_provenance_failure)?;

    let current = transaction
        .query_row(
            "SELECT source_provider, source_modified_at_utc,
                    source_adapter_version, mapping_version
             FROM training_session_provenance
             WHERE origin_id = ?1 AND session_id = ?2
               AND contributes_to_visible_state = 1
             ORDER BY id DESC
             LIMIT 1",
            params![origin_id, session_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            },
        )
        .optional()
        .map_err(training_provenance_failure)?
        .ok_or_else(|| {
            training_provenance_failure("training provenance has no contributing evidence")
        })?;
    let current = TrainingProvenanceCurrentView {
        provider: training_source_provider_view(&current.0)?,
        source_modified_at_utc: training_provenance_utc(
            &current.1,
            "training provenance source modification time",
        )?,
        source_adapter_version: current.2,
        mapping_version: current.3,
        contributing_event_count,
        non_contributing_event_count,
    };

    let limit = i64::try_from(query.limit)
        .map_err(|_| training_provenance_failure("training provenance limit is too large"))?;
    let offset = i64::try_from(query.offset)
        .map_err(|_| training_provenance_failure("training provenance offset is too large"))?;
    let mut statement = transaction
        .prepare(
            "SELECT provenance.source_provider,
                    provenance.source_adapter_version,
                    provenance.mapping_version,
                    provenance.source_modified_at_utc,
                    provenance.reconciliation_decision,
                    provenance.contributes_to_visible_state,
                    operation.completed_at_utc
             FROM training_session_provenance AS provenance
             JOIN import_operation AS operation
               ON operation.id = provenance.import_operation_id
             WHERE provenance.origin_id = ?1 AND provenance.session_id = ?2
             ORDER BY provenance.id
             LIMIT ?3 OFFSET ?4",
        )
        .map_err(training_provenance_failure)?;
    let rows = statement
        .query_map(params![origin_id, session_id, limit, offset], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, Option<String>>(6)?,
            ))
        })
        .map_err(training_provenance_failure)?;
    let mut events = Vec::new();
    for (index, row) in rows.enumerate() {
        let (
            provider,
            source_adapter_version,
            mapping_version,
            source_modified_at_utc,
            decision,
            contributes_to_visible_state,
            observed_at_utc,
        ) = row.map_err(training_provenance_failure)?;
        let observed_at_utc = observed_at_utc.ok_or_else(|| {
            training_provenance_failure("training provenance import is not complete")
        })?;
        let ordinal = query.offset.checked_add(index).ok_or_else(|| {
            training_provenance_failure("training provenance ordinal is too large")
        })?;
        events.push(TrainingProvenanceEventView {
            ordinal,
            observed_at_utc: training_provenance_utc(
                &observed_at_utc,
                "training provenance observation time",
            )?,
            source_modified_at_utc: training_provenance_utc(
                &source_modified_at_utc,
                "training provenance source modification time",
            )?,
            provider: training_source_provider_view(&provider)?,
            source_adapter_version,
            mapping_version,
            decision: training_provenance_decision_view(&decision)?,
            contributes_to_visible_state: persisted_training_flag(
                contributes_to_visible_state,
                "training provenance contribution",
            )
            .map_err(training_provenance_failure)?,
        });
    }
    drop(statement);
    transaction.commit().map_err(training_provenance_failure)?;
    Ok(PersistedTrainingSessionProvenance {
        snapshot_ref,
        session_ref: query.session_ref.clone(),
        total_event_count,
        current,
        events,
    })
}

fn query_training_session_segmentation_discovery(
    database_path: &Path,
    query: &TrainingSessionSegmentationQuery,
) -> std::result::Result<PersistedTrainingSessionSegmentation, TrainingSegmentationPortError> {
    let mut connection = Connection::open(database_path).map_err(segmentation_failure)?;
    ensure_schema(&connection).map_err(segmentation_failure)?;
    let transaction = connection.transaction().map_err(segmentation_failure)?;
    let (snapshot_ref, origin_id, session_id) = segmentation_snapshot_and_identity(
        &transaction,
        &query.session_ref,
        query.snapshot_ref.as_deref(),
    )?;
    let criteria = load_segment_criteria(&transaction)?;
    let exercises_present = transaction
        .query_row(
            "SELECT exercises_present FROM training_session_structure
             WHERE origin_id = ?1 AND session_id = ?2",
            params![origin_id, session_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(segmentation_failure)?;
    let exercises = match exercises_present {
        None => None,
        Some(0) => Some(Vec::new()),
        Some(1) => {
            let mut exercise_statement = transaction
                .prepare(
                    "SELECT exercise_id, ordinal, duration_milliseconds
                     FROM training_exercise
                     WHERE origin_id = ?1 AND session_id = ?2
                     ORDER BY ordinal",
                )
                .map_err(segmentation_failure)?;
            let rows = exercise_statement
                .query_map(params![origin_id, session_id], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, i64>(2)?,
                    ))
                })
                .map_err(segmentation_failure)?;
            let mut exercises = Vec::new();
            for row in rows {
                let (exercise_id, ordinal, duration_milliseconds) =
                    row.map_err(segmentation_failure)?;
                let mut signal_statement = transaction
                    .prepare(
                        "SELECT ordinal, kind, interval_milliseconds, sample_count
                         FROM training_signal_series
                         WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3
                           AND role = 'primary' AND kind IN ('distance', 'heart-rate')
                         ORDER BY ordinal",
                    )
                    .map_err(segmentation_failure)?;
                let signals = signal_statement
                    .query_map(params![origin_id, session_id, exercise_id], |row| {
                        Ok((
                            row.get::<_, i64>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, i64>(2)?,
                            row.get::<_, i64>(3)?,
                        ))
                    })
                    .map_err(segmentation_failure)?
                    .map(|row| {
                        let (series_ordinal, kind, interval_milliseconds, sample_count) =
                            row.map_err(segmentation_failure)?;
                        let series_ordinal =
                            persisted_count(series_ordinal, "segment signal series ordinal")
                                .map_err(segmentation_failure)?;
                        let kind = match kind.as_str() {
                            "distance" => SegmentSignalKind::Distance,
                            "heart-rate" => SegmentSignalKind::HeartRate,
                            _ => {
                                return Err(segmentation_failure("segment signal kind is invalid"))
                            }
                        };
                        Ok(SegmentSignalEvidence {
                            signal_ref: training_signal_ref(
                                &origin_id,
                                &session_id,
                                &exercise_id,
                                TrainingSignalRoleView::Primary,
                                series_ordinal,
                            ),
                            kind,
                            interval_milliseconds,
                            sample_count: persisted_count(
                                sample_count,
                                "segment signal sample count",
                            )
                            .map_err(segmentation_failure)?,
                        })
                    })
                    .collect::<std::result::Result<Vec<_>, TrainingSegmentationPortError>>()?;
                drop(signal_statement);
                let mut application_statement = transaction
                    .prepare(
                        "SELECT criterion_id
                         FROM training_exercise_segment_criterion
                         WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3
                         ORDER BY ordinal",
                    )
                    .map_err(segmentation_failure)?;
                let applied_criterion_refs = application_statement
                    .query_map(params![origin_id, session_id, exercise_id], |row| {
                        row.get::<_, String>(0)
                    })
                    .map_err(segmentation_failure)?
                    .collect::<rusqlite::Result<Vec<_>>>()
                    .map_err(segmentation_failure)?;
                exercises.push(PersistedTrainingExerciseSegmentation {
                    exercise_ref: training_exercise_ref(&origin_id, &session_id, &exercise_id),
                    ordinal: persisted_count(ordinal, "segment exercise ordinal")
                        .map_err(segmentation_failure)?,
                    duration_milliseconds,
                    signals,
                    applied_criterion_refs,
                });
            }
            drop(exercise_statement);
            Some(exercises)
        }
        Some(_) => {
            return Err(segmentation_failure(
                "stored segment exercise assessment is invalid",
            ))
        }
    };
    transaction.commit().map_err(segmentation_failure)?;
    Ok(PersistedTrainingSessionSegmentation {
        snapshot_ref,
        session_ref: query.session_ref.clone(),
        criteria,
        exercises,
    })
}

fn visit_training_segment_signal_samples(
    database_path: &Path,
    snapshot_ref: &str,
    session_ref: &str,
    signal_ref: &str,
    visitor: &mut dyn FnMut(SegmentSignalSample) -> std::result::Result<(), String>,
) -> std::result::Result<(), TrainingSegmentationPortError> {
    let mut connection = Connection::open(database_path).map_err(segmentation_failure)?;
    ensure_schema(&connection).map_err(segmentation_failure)?;
    let transaction = connection.transaction().map_err(segmentation_failure)?;
    let (_, origin_id, session_id) =
        segmentation_snapshot_and_identity(&transaction, session_ref, Some(snapshot_ref))?;
    let mut series_statement = transaction
        .prepare(
            "SELECT series_id, exercise_id, ordinal, kind
             FROM training_signal_series
             WHERE origin_id = ?1 AND session_id = ?2 AND role = 'primary'
               AND kind IN ('distance', 'heart-rate')
             ORDER BY exercise_id, ordinal",
        )
        .map_err(segmentation_failure)?;
    let rows = series_statement
        .query_map(params![origin_id, session_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, String>(3)?,
            ))
        })
        .map_err(segmentation_failure)?;
    let mut identity = None;
    for row in rows {
        let (series_id, exercise_id, ordinal, kind) = row.map_err(segmentation_failure)?;
        let ordinal = persisted_count(ordinal, "segment signal series ordinal")
            .map_err(segmentation_failure)?;
        if training_signal_ref(
            &origin_id,
            &session_id,
            &exercise_id,
            TrainingSignalRoleView::Primary,
            ordinal,
        ) == signal_ref
        {
            identity = Some((series_id, kind));
            break;
        }
    }
    drop(series_statement);
    let (series_id, kind) = identity.ok_or(TrainingSegmentationPortError::NotFound)?;
    let scale = match kind.as_str() {
        "distance" | "heart-rate" => 1_000.0,
        _ => return Err(segmentation_failure("segment signal kind is invalid")),
    };
    let mut sample_statement = transaction
        .prepare(
            "SELECT ordinal, value
             FROM training_signal_sample
             WHERE series_id = ?1
             ORDER BY ordinal",
        )
        .map_err(segmentation_failure)?;
    let samples = sample_statement
        .query_map(params![series_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, Option<f64>>(1)?))
        })
        .map_err(segmentation_failure)?;
    for sample in samples {
        let (ordinal, value) = sample.map_err(segmentation_failure)?;
        let value_milliunits = value
            .map(|value| {
                let scaled = value * scale;
                if !scaled.is_finite() || scaled < i64::MIN as f64 || scaled > i64::MAX as f64 {
                    return Err(segmentation_failure(
                        "segment signal value cannot be represented exactly enough",
                    ));
                }
                Ok(scaled.round() as i64)
            })
            .transpose()?;
        visitor(SegmentSignalSample {
            ordinal: persisted_count(ordinal, "segment signal sample ordinal")
                .map_err(segmentation_failure)?,
            value_milliunits,
        })
        .map_err(TrainingSegmentationPortError::Failure)?;
    }
    drop(sample_statement);
    transaction.commit().map_err(segmentation_failure)?;
    Ok(())
}

struct SegmentCriterionColumns<'a> {
    kind: &'static str,
    span_milliseconds: Option<i64>,
    span_meters: Option<f64>,
    minimum_beats_per_minute: Option<i64>,
    maximum_beats_per_minute: Option<i64>,
    manual_boundaries: &'a [i64],
}

fn segment_criterion_columns(criterion: &SegmentCriterion) -> SegmentCriterionColumns<'_> {
    match criterion.definition() {
        SegmentCriterionDefinition::EqualElapsedTime { span_milliseconds } => {
            SegmentCriterionColumns {
                kind: "equal-elapsed-time",
                span_milliseconds: Some(*span_milliseconds),
                span_meters: None,
                minimum_beats_per_minute: None,
                maximum_beats_per_minute: None,
                manual_boundaries: &[],
            }
        }
        SegmentCriterionDefinition::EqualDistance { span_meters } => SegmentCriterionColumns {
            kind: "equal-distance",
            span_milliseconds: None,
            span_meters: Some(*span_meters),
            minimum_beats_per_minute: None,
            maximum_beats_per_minute: None,
            manual_boundaries: &[],
        },
        SegmentCriterionDefinition::HeartRateZone {
            minimum_beats_per_minute,
            maximum_beats_per_minute,
        } => SegmentCriterionColumns {
            kind: "heart-rate-zone",
            span_milliseconds: None,
            span_meters: None,
            minimum_beats_per_minute: Some(i64::from(*minimum_beats_per_minute)),
            maximum_beats_per_minute: Some(i64::from(*maximum_beats_per_minute)),
            manual_boundaries: &[],
        },
        SegmentCriterionDefinition::ManualBoundaries {
            elapsed_milliseconds,
        } => SegmentCriterionColumns {
            kind: "manual-boundaries",
            span_milliseconds: None,
            span_meters: None,
            minimum_beats_per_minute: None,
            maximum_beats_per_minute: None,
            manual_boundaries: elapsed_milliseconds,
        },
    }
}

fn persist_segment_criterion_boundaries(
    transaction: &Transaction<'_>,
    criterion_id: &str,
    boundaries: &[i64],
) -> std::result::Result<(), TrainingSegmentationPortError> {
    for (ordinal, elapsed_milliseconds) in boundaries.iter().enumerate() {
        transaction
            .execute(
                "INSERT INTO segment_criterion_manual_boundary (
                     criterion_id, ordinal, elapsed_milliseconds
                 ) VALUES (?1, ?2, ?3)",
                params![criterion_id, ordinal, elapsed_milliseconds],
            )
            .map_err(segmentation_failure)?;
    }
    Ok(())
}

fn new_segment_criterion_id(
    database_path: &Path,
) -> std::result::Result<String, TrainingSegmentationPortError> {
    let connection = Connection::open(database_path).map_err(segmentation_failure)?;
    ensure_schema(&connection).map_err(segmentation_failure)?;
    for _ in 0..4 {
        let suffix = connection
            .query_row("SELECT lower(hex(randomblob(32)))", [], |row| {
                row.get::<_, String>(0)
            })
            .map_err(segmentation_failure)?;
        let criterion_id = format!("criterion-{suffix}");
        let exists = connection
            .query_row(
                "SELECT EXISTS (
                     SELECT 1 FROM segment_criterion WHERE criterion_id = ?1
                 )",
                params![criterion_id],
                |row| row.get::<_, bool>(0),
            )
            .map_err(segmentation_failure)?;
        if !exists {
            return Ok(criterion_id);
        }
    }
    Err(segmentation_failure(
        "could not allocate a unique segment criterion identity",
    ))
}

fn create_and_apply_segment_criterion(
    database_path: &Path,
    snapshot_ref: &str,
    session_ref: &str,
    exercise_ref: &str,
    criterion: &SegmentCriterion,
) -> std::result::Result<(), TrainingSegmentationPortError> {
    let mut connection = Connection::open(database_path).map_err(segmentation_failure)?;
    ensure_schema(&connection).map_err(segmentation_failure)?;
    let transaction = connection.transaction().map_err(segmentation_failure)?;
    let (_, origin_id, session_id) =
        segmentation_snapshot_and_identity(&transaction, session_ref, Some(snapshot_ref))?;
    let exercise_id =
        segmentation_exercise_identity(&transaction, &origin_id, &session_id, exercise_ref)?;
    let columns = segment_criterion_columns(criterion);
    let revision = i64::try_from(criterion.revision()).map_err(segmentation_failure)?;
    let evaluation_version = i64::from(criterion.evaluation_version());
    transaction
        .execute(
            "INSERT INTO segment_criterion (
                 criterion_id, title, criterion_kind, span_milliseconds, span_meters,
                 minimum_beats_per_minute, maximum_beats_per_minute, authorship,
                 evaluation_version, revision, created_at_utc, updated_at_utc
             ) VALUES (
                 ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'user', ?8, ?9,
                 strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                 strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             )",
            params![
                criterion.criterion_id(),
                criterion.title(),
                columns.kind,
                columns.span_milliseconds,
                columns.span_meters,
                columns.minimum_beats_per_minute,
                columns.maximum_beats_per_minute,
                evaluation_version,
                revision,
            ],
        )
        .map_err(segmentation_failure)?;
    persist_segment_criterion_boundaries(
        &transaction,
        criterion.criterion_id(),
        columns.manual_boundaries,
    )?;
    let ordinal = transaction
        .query_row(
            "SELECT COALESCE(MAX(ordinal) + 1, 0)
             FROM training_exercise_segment_criterion
             WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3",
            params![origin_id, session_id, exercise_id],
            |row| row.get::<_, i64>(0),
        )
        .map_err(segmentation_failure)?;
    transaction
        .execute(
            "INSERT INTO training_exercise_segment_criterion (
                 origin_id, session_id, exercise_id, criterion_id, ordinal, applied_at_utc
             ) VALUES (
                 ?1, ?2, ?3, ?4, ?5, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             )",
            params![
                origin_id,
                session_id,
                exercise_id,
                criterion.criterion_id(),
                ordinal
            ],
        )
        .map_err(segmentation_failure)?;
    transaction.commit().map_err(segmentation_failure)?;
    Ok(())
}

fn compare_and_save_segment_criterion(
    database_path: &Path,
    expected_revision: u64,
    criterion: &SegmentCriterion,
) -> std::result::Result<bool, TrainingSegmentationPortError> {
    let mut connection = Connection::open(database_path).map_err(segmentation_failure)?;
    ensure_schema(&connection).map_err(segmentation_failure)?;
    let transaction = connection.transaction().map_err(segmentation_failure)?;
    let expected_revision = i64::try_from(expected_revision).map_err(segmentation_failure)?;
    let revision = i64::try_from(criterion.revision()).map_err(segmentation_failure)?;
    if revision != expected_revision.saturating_add(1) {
        return Err(segmentation_failure(
            "segment criterion revision does not advance exactly once",
        ));
    }
    let columns = segment_criterion_columns(criterion);
    let changed = transaction
        .execute(
            "UPDATE segment_criterion
             SET title = ?2, criterion_kind = ?3, span_milliseconds = ?4,
                 span_meters = ?5, minimum_beats_per_minute = ?6,
                 maximum_beats_per_minute = ?7, authorship = 'user',
                 evaluation_version = ?8, revision = ?9,
                 updated_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE criterion_id = ?1 AND revision = ?10",
            params![
                criterion.criterion_id(),
                criterion.title(),
                columns.kind,
                columns.span_milliseconds,
                columns.span_meters,
                columns.minimum_beats_per_minute,
                columns.maximum_beats_per_minute,
                i64::from(criterion.evaluation_version()),
                revision,
                expected_revision,
            ],
        )
        .map_err(segmentation_failure)?;
    if changed == 0 {
        transaction.commit().map_err(segmentation_failure)?;
        return Ok(false);
    }
    transaction
        .execute(
            "DELETE FROM segment_criterion_manual_boundary WHERE criterion_id = ?1",
            params![criterion.criterion_id()],
        )
        .map_err(segmentation_failure)?;
    persist_segment_criterion_boundaries(
        &transaction,
        criterion.criterion_id(),
        columns.manual_boundaries,
    )?;
    transaction.commit().map_err(segmentation_failure)?;
    Ok(true)
}

fn apply_segment_criterion(
    database_path: &Path,
    snapshot_ref: &str,
    session_ref: &str,
    exercise_ref: &str,
    criterion_ref: &str,
) -> std::result::Result<(), TrainingSegmentationPortError> {
    let mut connection = Connection::open(database_path).map_err(segmentation_failure)?;
    ensure_schema(&connection).map_err(segmentation_failure)?;
    let transaction = connection.transaction().map_err(segmentation_failure)?;
    let (_, origin_id, session_id) =
        segmentation_snapshot_and_identity(&transaction, session_ref, Some(snapshot_ref))?;
    let exercise_id =
        segmentation_exercise_identity(&transaction, &origin_id, &session_id, exercise_ref)?;
    let criterion_exists = transaction
        .query_row(
            "SELECT EXISTS (
                 SELECT 1 FROM segment_criterion WHERE criterion_id = ?1
             )",
            params![criterion_ref],
            |row| row.get::<_, bool>(0),
        )
        .map_err(segmentation_failure)?;
    if !criterion_exists {
        return Err(TrainingSegmentationPortError::NotFound);
    }
    let already_applied = transaction
        .query_row(
            "SELECT EXISTS (
                 SELECT 1 FROM training_exercise_segment_criterion
                 WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3
                   AND criterion_id = ?4
             )",
            params![origin_id, session_id, exercise_id, criterion_ref],
            |row| row.get::<_, bool>(0),
        )
        .map_err(segmentation_failure)?;
    if already_applied {
        return Err(TrainingSegmentationPortError::AlreadyApplied);
    }
    let ordinal = transaction
        .query_row(
            "SELECT COALESCE(MAX(ordinal) + 1, 0)
             FROM training_exercise_segment_criterion
             WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3",
            params![origin_id, session_id, exercise_id],
            |row| row.get::<_, i64>(0),
        )
        .map_err(segmentation_failure)?;
    transaction
        .execute(
            "INSERT INTO training_exercise_segment_criterion (
                 origin_id, session_id, exercise_id, criterion_id, ordinal, applied_at_utc
             ) VALUES (
                 ?1, ?2, ?3, ?4, ?5, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             )",
            params![origin_id, session_id, exercise_id, criterion_ref, ordinal],
        )
        .map_err(segmentation_failure)?;
    transaction.commit().map_err(segmentation_failure)?;
    Ok(())
}

fn remove_segment_criterion(
    database_path: &Path,
    snapshot_ref: &str,
    session_ref: &str,
    exercise_ref: &str,
    criterion_ref: &str,
) -> std::result::Result<(), TrainingSegmentationPortError> {
    let mut connection = Connection::open(database_path).map_err(segmentation_failure)?;
    ensure_schema(&connection).map_err(segmentation_failure)?;
    let transaction = connection.transaction().map_err(segmentation_failure)?;
    let (_, origin_id, session_id) =
        segmentation_snapshot_and_identity(&transaction, session_ref, Some(snapshot_ref))?;
    let exercise_id =
        segmentation_exercise_identity(&transaction, &origin_id, &session_id, exercise_ref)?;
    let ordinal = transaction
        .query_row(
            "SELECT ordinal FROM training_exercise_segment_criterion
             WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3
               AND criterion_id = ?4",
            params![origin_id, session_id, exercise_id, criterion_ref],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(segmentation_failure)?
        .ok_or(TrainingSegmentationPortError::NotApplied)?;
    transaction
        .execute(
            "DELETE FROM training_exercise_segment_criterion
             WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3
               AND criterion_id = ?4",
            params![origin_id, session_id, exercise_id, criterion_ref],
        )
        .map_err(segmentation_failure)?;
    transaction
        .execute(
            "UPDATE training_exercise_segment_criterion
             SET ordinal = ordinal - 1
             WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3
               AND ordinal > ?4",
            params![origin_id, session_id, exercise_id, ordinal],
        )
        .map_err(segmentation_failure)?;
    transaction.commit().map_err(segmentation_failure)?;
    Ok(())
}

fn move_segment_criterion(
    database_path: &Path,
    snapshot_ref: &str,
    session_ref: &str,
    exercise_ref: &str,
    criterion_ref: &str,
    direction: TrainingSegmentCriterionDirection,
) -> std::result::Result<(), TrainingSegmentationPortError> {
    let mut connection = Connection::open(database_path).map_err(segmentation_failure)?;
    ensure_schema(&connection).map_err(segmentation_failure)?;
    let transaction = connection.transaction().map_err(segmentation_failure)?;
    let (_, origin_id, session_id) =
        segmentation_snapshot_and_identity(&transaction, session_ref, Some(snapshot_ref))?;
    let exercise_id =
        segmentation_exercise_identity(&transaction, &origin_id, &session_id, exercise_ref)?;
    let ordinal = transaction
        .query_row(
            "SELECT ordinal FROM training_exercise_segment_criterion
             WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3
               AND criterion_id = ?4",
            params![origin_id, session_id, exercise_id, criterion_ref],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(segmentation_failure)?
        .ok_or(TrainingSegmentationPortError::NotApplied)?;
    let target = match direction {
        TrainingSegmentCriterionDirection::Earlier => ordinal.checked_sub(1),
        TrainingSegmentCriterionDirection::Later => ordinal.checked_add(1),
    };
    let Some(target) = target else {
        transaction.commit().map_err(segmentation_failure)?;
        return Ok(());
    };
    let target_criterion = transaction
        .query_row(
            "SELECT criterion_id FROM training_exercise_segment_criterion
             WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3
               AND ordinal = ?4",
            params![origin_id, session_id, exercise_id, target],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(segmentation_failure)?;
    let Some(target_criterion) = target_criterion else {
        transaction.commit().map_err(segmentation_failure)?;
        return Ok(());
    };
    let temporary = transaction
        .query_row(
            "SELECT COALESCE(MAX(ordinal) + 1, 0)
             FROM training_exercise_segment_criterion
             WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3",
            params![origin_id, session_id, exercise_id],
            |row| row.get::<_, i64>(0),
        )
        .map_err(segmentation_failure)?;
    for (criterion, next_ordinal) in [
        (criterion_ref, temporary),
        (target_criterion.as_str(), ordinal),
        (criterion_ref, target),
    ] {
        transaction
            .execute(
                "UPDATE training_exercise_segment_criterion
                 SET ordinal = ?5
                 WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3
                   AND criterion_id = ?4",
                params![origin_id, session_id, exercise_id, criterion, next_ordinal],
            )
            .map_err(segmentation_failure)?;
    }
    transaction.commit().map_err(segmentation_failure)?;
    Ok(())
}

fn training_range_failure(error: impl std::fmt::Display) -> TrainingSessionRangePortError {
    TrainingSessionRangePortError::Failure(error.to_string())
}

fn training_range_snapshot_and_identity(
    transaction: &Transaction<'_>,
    session_ref: &str,
    expected_snapshot_ref: Option<&str>,
) -> StandardResult<(String, String, String), TrainingSessionRangePortError> {
    signal_snapshot_and_identity(transaction, session_ref, expected_snapshot_ref).map_err(|error| {
        match error {
            TrainingSessionSignalPortError::SnapshotChanged => {
                TrainingSessionRangePortError::SnapshotChanged
            }
            TrainingSessionSignalPortError::NotFound => TrainingSessionRangePortError::NotFound,
            TrainingSessionSignalPortError::Failure(reason) => {
                TrainingSessionRangePortError::Failure(reason)
            }
        }
    })
}

fn update_digest_text(digest: &mut Sha256, value: &str) {
    digest.update(value.len().to_be_bytes());
    digest.update(value.as_bytes());
}

fn training_range_evidence_revision_on(
    transaction: &Transaction<'_>,
    origin_id: &str,
    session_id: &str,
) -> StandardResult<(i64, String), TrainingSessionRangePortError> {
    let evidence = transaction
        .query_row(
            "SELECT session.started_at_local, session.stopped_at_local,
                    session.duration_milliseconds, provenance.source_artifact_sha256,
                    provenance.mapping_version, provenance.source_modified_at_utc
             FROM training_session AS session
             JOIN training_session_provenance AS provenance
               ON provenance.origin_id = session.origin_id
              AND provenance.session_id = session.session_id
             WHERE session.origin_id = ?1 AND session.session_id = ?2
               AND provenance.contributes_to_visible_state = 1
               AND provenance.reconciliation_decision IN ('create', 'enrich', 'amend')
             ORDER BY provenance.id DESC LIMIT 1",
            params![origin_id, session_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                ))
            },
        )
        .optional()
        .map_err(training_range_failure)?
        .ok_or(TrainingSessionRangePortError::NotFound)?;
    let (
        started_at_local,
        stopped_at_local,
        duration_milliseconds,
        artifact_sha256,
        mapping_version,
        source_modified_at_utc,
    ) = evidence;
    if duration_milliseconds < 0 {
        return Err(training_range_failure(
            "training-session range owner has a negative duration",
        ));
    }
    let mut digest = Sha256::new();
    digest.update(b"fitfreed:training-range-evidence:v1\0");
    for value in [
        origin_id,
        session_id,
        &started_at_local,
        &stopped_at_local,
        &artifact_sha256,
        &mapping_version,
        &source_modified_at_utc,
    ] {
        update_digest_text(&mut digest, value);
    }
    digest.update(duration_milliseconds.to_be_bytes());
    Ok((
        duration_milliseconds,
        format!("range-evidence-{:x}", digest.finalize()),
    ))
}

fn load_training_session_ranges_on(
    transaction: &Transaction<'_>,
    origin_id: &str,
    session_id: &str,
) -> StandardResult<Vec<TrainingSessionRange>, TrainingSessionRangePortError> {
    let mut statement = transaction
        .prepare(
            "SELECT range_id, exercise_id, coordinate_scope, title,
                    started_at_elapsed_milliseconds, ended_at_elapsed_milliseconds,
                    evidence_revision, authorship, state, revision
             FROM training_session_range
             WHERE origin_id = ?1 AND session_id = ?2
             ORDER BY started_at_elapsed_milliseconds, ended_at_elapsed_milliseconds,
                      title, range_id
             LIMIT 1001",
        )
        .map_err(training_range_failure)?;
    let rows = statement
        .query_map(params![origin_id, session_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, String>(8)?,
                row.get::<_, i64>(9)?,
            ))
        })
        .map_err(training_range_failure)?;
    let session_ref = training_session_ref(origin_id, session_id);
    let mut ranges = Vec::new();
    for row in rows {
        let (
            range_id,
            exercise_id,
            coordinate_scope,
            title,
            started,
            ended,
            evidence_revision,
            authorship,
            state,
            revision,
        ) = row.map_err(training_range_failure)?;
        let authorship = TrainingSessionRangeAuthorship::from_code(&authorship)
            .ok_or_else(|| training_range_failure("stored range authorship is invalid"))?;
        let state = TrainingSessionRangeState::from_code(&state)
            .ok_or_else(|| training_range_failure("stored range state is invalid"))?;
        let revision = u64::try_from(revision)
            .map_err(|_| training_range_failure("stored range revision is invalid"))?;
        let exercise_ref = match (coordinate_scope.as_str(), exercise_id) {
            ("exercise-elapsed", Some(exercise_id)) => {
                Some(training_exercise_ref(origin_id, session_id, &exercise_id))
            }
            ("legacy-session-elapsed", None)
                if state == TrainingSessionRangeState::ReviewRequired =>
            {
                None
            }
            _ => {
                return Err(training_range_failure(
                    "stored range exercise coordinate is invalid",
                ))
            }
        };
        ranges.push(
            TrainingSessionRange::restore(
                range_id,
                &session_ref,
                exercise_ref,
                title,
                started,
                ended,
                evidence_revision,
                authorship,
                state,
                revision,
            )
            .map_err(training_range_failure)?,
        );
    }
    Ok(ranges)
}

fn training_range_exercises_on(
    transaction: &Transaction<'_>,
    origin_id: &str,
    session_id: &str,
) -> StandardResult<Vec<TrainingSessionRangeExerciseContext>, TrainingSessionRangePortError> {
    let mut statement = transaction
        .prepare(
            "SELECT exercise_id, ordinal, duration_milliseconds
             FROM training_exercise
             WHERE origin_id = ?1 AND session_id = ?2
             ORDER BY ordinal
             LIMIT 1001",
        )
        .map_err(training_range_failure)?;
    let rows = statement
        .query_map(params![origin_id, session_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })
        .map_err(training_range_failure)?;
    rows.map(|row| {
        let (exercise_id, ordinal, duration_milliseconds) = row.map_err(training_range_failure)?;
        Ok(TrainingSessionRangeExerciseContext {
            exercise_ref: training_exercise_ref(origin_id, session_id, &exercise_id),
            ordinal: persisted_count(ordinal, "training-session range exercise ordinal")
                .map_err(training_range_failure)?,
            duration_milliseconds,
        })
    })
    .collect()
}

fn resolve_training_range_exercise_on(
    transaction: &Transaction<'_>,
    origin_id: &str,
    session_id: &str,
    exercise_ref: &str,
) -> StandardResult<(String, i64), TrainingSessionRangePortError> {
    let mut statement = transaction
        .prepare(
            "SELECT exercise_id, duration_milliseconds
             FROM training_exercise
             WHERE origin_id = ?1 AND session_id = ?2
             ORDER BY ordinal",
        )
        .map_err(training_range_failure)?;
    let rows = statement
        .query_map(params![origin_id, session_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .map_err(training_range_failure)?;
    for row in rows {
        let (exercise_id, duration_milliseconds) = row.map_err(training_range_failure)?;
        if training_exercise_ref(origin_id, session_id, &exercise_id) == exercise_ref {
            return Ok((exercise_id, duration_milliseconds));
        }
    }
    Err(TrainingSessionRangePortError::NotFound)
}

fn training_session_ranges_context_on(
    transaction: &Transaction<'_>,
    session_ref: &str,
    expected_snapshot_ref: Option<&str>,
) -> StandardResult<PersistedTrainingSessionRanges, TrainingSessionRangePortError> {
    let (snapshot_ref, origin_id, session_id) =
        training_range_snapshot_and_identity(transaction, session_ref, expected_snapshot_ref)?;
    let (session_duration_milliseconds, evidence_revision) =
        training_range_evidence_revision_on(transaction, &origin_id, &session_id)?;
    let exercises = training_range_exercises_on(transaction, &origin_id, &session_id)?;
    let ranges = load_training_session_ranges_on(transaction, &origin_id, &session_id)?;
    Ok(PersistedTrainingSessionRanges {
        snapshot_ref,
        session_ref: session_ref.to_owned(),
        session_duration_milliseconds,
        evidence_revision,
        exercises,
        ranges,
    })
}

fn query_training_session_ranges_persistence(
    database_path: &Path,
    query: &TrainingSessionRangesQuery,
) -> StandardResult<PersistedTrainingSessionRanges, TrainingSessionRangePortError> {
    let mut connection = Connection::open(database_path).map_err(training_range_failure)?;
    ensure_schema(&connection).map_err(training_range_failure)?;
    let transaction = connection.transaction().map_err(training_range_failure)?;
    let persisted = training_session_ranges_context_on(
        &transaction,
        &query.session_ref,
        query.snapshot_ref.as_deref(),
    )?;
    transaction.commit().map_err(training_range_failure)?;
    Ok(persisted)
}

fn new_training_session_range_id(
    database_path: &Path,
) -> StandardResult<String, TrainingSessionRangePortError> {
    let connection = Connection::open(database_path).map_err(training_range_failure)?;
    ensure_schema(&connection).map_err(training_range_failure)?;
    for _ in 0..4 {
        let suffix = connection
            .query_row("SELECT lower(hex(randomblob(32)))", [], |row| {
                row.get::<_, String>(0)
            })
            .map_err(training_range_failure)?;
        let range_id = format!("range-{suffix}");
        let exists = connection
            .query_row(
                "SELECT EXISTS (
                     SELECT 1 FROM training_session_range WHERE range_id = ?1
                 )",
                params![range_id],
                |row| row.get::<_, bool>(0),
            )
            .map_err(training_range_failure)?;
        if !exists {
            return Ok(range_id);
        }
    }
    Err(training_range_failure(
        "could not allocate a unique training-session range identity",
    ))
}

fn create_training_session_range_persistence(
    database_path: &Path,
    snapshot_ref: &str,
    range: &TrainingSessionRange,
) -> StandardResult<PersistedTrainingSessionRanges, TrainingSessionRangePortError> {
    let mut connection = Connection::open(database_path).map_err(training_range_failure)?;
    ensure_schema(&connection).map_err(training_range_failure)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(training_range_failure)?;
    let (_, origin_id, session_id) = training_range_snapshot_and_identity(
        &transaction,
        range.session_ref(),
        Some(snapshot_ref),
    )?;
    let (_, evidence_revision) =
        training_range_evidence_revision_on(&transaction, &origin_id, &session_id)?;
    let exercise_ref = range.exercise_ref().ok_or_else(|| {
        training_range_failure("new training-session range has no exercise owner")
    })?;
    let (exercise_id, exercise_duration) =
        resolve_training_range_exercise_on(&transaction, &origin_id, &session_id, exercise_ref)?;
    if range.revision() != 1
        || range.authorship() != TrainingSessionRangeAuthorship::User
        || range.state() != TrainingSessionRangeState::Current
        || range.evidence_revision() != evidence_revision
        || range.ended_at_elapsed_milliseconds() > exercise_duration
    {
        return Err(training_range_failure(
            "new training-session range does not match current evidence",
        ));
    }
    let exists = transaction
        .query_row(
            "SELECT EXISTS (
                 SELECT 1 FROM training_session_range WHERE range_id = ?1
             )",
            params![range.range_id()],
            |row| row.get::<_, bool>(0),
        )
        .map_err(training_range_failure)?;
    if exists {
        return Err(TrainingSessionRangePortError::AlreadyExists);
    }
    transaction
        .execute(
            "INSERT INTO training_session_range (
                 range_id, origin_id, session_id, exercise_id, coordinate_scope, title,
                 started_at_elapsed_milliseconds, ended_at_elapsed_milliseconds,
                 evidence_revision, authorship, state, revision,
                 created_at_utc, updated_at_utc
             ) VALUES (
                 ?1, ?2, ?3, ?4, 'exercise-elapsed', ?5, ?6, ?7, ?8, ?9, ?10, ?11,
                 strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                 strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             )",
            params![
                range.range_id(),
                origin_id,
                session_id,
                exercise_id,
                range.title(),
                range.started_at_elapsed_milliseconds(),
                range.ended_at_elapsed_milliseconds(),
                range.evidence_revision(),
                range.authorship().code(),
                range.state().code(),
                i64::try_from(range.revision()).map_err(training_range_failure)?,
            ],
        )
        .map_err(training_range_failure)?;
    let persisted =
        training_session_ranges_context_on(&transaction, range.session_ref(), Some(snapshot_ref))?;
    transaction.commit().map_err(training_range_failure)?;
    Ok(persisted)
}

fn compare_and_save_training_session_range_persistence(
    database_path: &Path,
    snapshot_ref: &str,
    expected_revision: u64,
    range: &TrainingSessionRange,
) -> StandardResult<Option<PersistedTrainingSessionRanges>, TrainingSessionRangePortError> {
    let mut connection = Connection::open(database_path).map_err(training_range_failure)?;
    ensure_schema(&connection).map_err(training_range_failure)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(training_range_failure)?;
    let (_, origin_id, session_id) = training_range_snapshot_and_identity(
        &transaction,
        range.session_ref(),
        Some(snapshot_ref),
    )?;
    let (_, evidence_revision) =
        training_range_evidence_revision_on(&transaction, &origin_id, &session_id)?;
    let target_exercise = range
        .exercise_ref()
        .map(|exercise_ref| {
            resolve_training_range_exercise_on(&transaction, &origin_id, &session_id, exercise_ref)
        })
        .transpose()?;
    let stored_owner = transaction
        .query_row(
            "SELECT exercise_id, coordinate_scope
             FROM training_session_range
             WHERE range_id = ?1 AND origin_id = ?2 AND session_id = ?3",
            params![range.range_id(), origin_id, session_id],
            |row| Ok((row.get::<_, Option<String>>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()
        .map_err(training_range_failure)?
        .ok_or(TrainingSessionRangePortError::NotFound)?;
    let owner_is_valid = match (&stored_owner.0, stored_owner.1.as_str(), &target_exercise) {
        (Some(stored), "exercise-elapsed", Some((target, _))) => stored == target,
        (None, "legacy-session-elapsed", None | Some(_)) => true,
        _ => false,
    };
    let expected_revision = i64::try_from(expected_revision).map_err(training_range_failure)?;
    let revision = i64::try_from(range.revision()).map_err(training_range_failure)?;
    if revision != expected_revision.saturating_add(1)
        || range.authorship() != TrainingSessionRangeAuthorship::User
        || range.evidence_revision() != evidence_revision
        || !owner_is_valid
        || (range.state() == TrainingSessionRangeState::Current
            && !target_exercise
                .as_ref()
                .is_some_and(|(_, duration)| range.ended_at_elapsed_milliseconds() <= *duration))
        || (range.exercise_ref().is_none()
            && range.state() != TrainingSessionRangeState::ReviewRequired)
    {
        return Err(training_range_failure(
            "revised training-session range does not match current evidence",
        ));
    }
    let (exercise_id, coordinate_scope) = target_exercise
        .map(|(exercise_id, _)| (Some(exercise_id), "exercise-elapsed"))
        .unwrap_or((None, "legacy-session-elapsed"));
    let changed = transaction
        .execute(
            "UPDATE training_session_range
             SET exercise_id = ?4, coordinate_scope = ?5, title = ?6,
                 started_at_elapsed_milliseconds = ?7,
                 ended_at_elapsed_milliseconds = ?8, evidence_revision = ?9,
                 authorship = ?10, state = ?11, revision = ?12,
                 updated_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE range_id = ?1 AND origin_id = ?2 AND session_id = ?3
               AND revision = ?13",
            params![
                range.range_id(),
                origin_id,
                session_id,
                exercise_id,
                coordinate_scope,
                range.title(),
                range.started_at_elapsed_milliseconds(),
                range.ended_at_elapsed_milliseconds(),
                range.evidence_revision(),
                range.authorship().code(),
                range.state().code(),
                revision,
                expected_revision,
            ],
        )
        .map_err(training_range_failure)?;
    if changed == 0 {
        transaction.commit().map_err(training_range_failure)?;
        return Ok(None);
    }
    let persisted =
        training_session_ranges_context_on(&transaction, range.session_ref(), Some(snapshot_ref))?;
    transaction.commit().map_err(training_range_failure)?;
    Ok(Some(persisted))
}

fn compare_and_remove_training_session_range_persistence(
    database_path: &Path,
    snapshot_ref: &str,
    removal: &RemovedTrainingSessionRange,
) -> StandardResult<Option<PersistedTrainingSessionRanges>, TrainingSessionRangePortError> {
    let mut connection = Connection::open(database_path).map_err(training_range_failure)?;
    ensure_schema(&connection).map_err(training_range_failure)?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(training_range_failure)?;
    let (_, origin_id, session_id) = training_range_snapshot_and_identity(
        &transaction,
        removal.session_ref(),
        Some(snapshot_ref),
    )?;
    let stored_owner = transaction
        .query_row(
            "SELECT exercise_id, coordinate_scope
             FROM training_session_range
             WHERE range_id = ?1 AND origin_id = ?2 AND session_id = ?3",
            params![removal.range_id(), origin_id, session_id],
            |row| Ok((row.get::<_, Option<String>>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()
        .map_err(training_range_failure)?
        .ok_or(TrainingSessionRangePortError::NotFound)?;
    let owner_matches = match (
        removal.exercise_ref(),
        stored_owner.0.as_deref(),
        stored_owner.1.as_str(),
    ) {
        (Some(expected), Some(stored), "exercise-elapsed") => {
            training_exercise_ref(&origin_id, &session_id, stored) == expected
        }
        (None, None, "legacy-session-elapsed") => true,
        _ => false,
    };
    if !owner_matches {
        return Err(TrainingSessionRangePortError::NotFound);
    }
    let removed = transaction
        .execute(
            "DELETE FROM training_session_range
             WHERE range_id = ?1 AND origin_id = ?2 AND session_id = ?3 AND revision = ?4",
            params![
                removal.range_id(),
                origin_id,
                session_id,
                i64::try_from(removal.expected_revision()).map_err(training_range_failure)?,
            ],
        )
        .map_err(training_range_failure)?;
    if removed == 0 {
        transaction.commit().map_err(training_range_failure)?;
        return Ok(None);
    }
    let persisted = training_session_ranges_context_on(
        &transaction,
        removal.session_ref(),
        Some(snapshot_ref),
    )?;
    transaction.commit().map_err(training_range_failure)?;
    Ok(Some(persisted))
}

fn reconcile_persisted_training_session_ranges(
    transaction: &Transaction<'_>,
    origin_id: &str,
    session_id: &str,
    compatibility: TrainingSessionRangeEvidenceCompatibility,
) -> Result<()> {
    let (_, evidence_revision) =
        training_range_evidence_revision_on(transaction, origin_id, session_id)
            .map_err(|error| ImportError::InvalidTrainingLibrary(error.to_string()))?;
    let ranges = load_training_session_ranges_on(transaction, origin_id, session_id)
        .map_err(|error| ImportError::InvalidTrainingLibrary(error.to_string()))?;
    for range in ranges {
        let exercise_duration = range
            .exercise_ref()
            .map(|exercise_ref| {
                resolve_training_range_exercise_on(transaction, origin_id, session_id, exercise_ref)
                    .map(|(_, duration)| duration)
            })
            .transpose()
            .or_else(|error| match error {
                TrainingSessionRangePortError::NotFound => Ok(None),
                other => Err(other),
            })
            .map_err(|error| ImportError::InvalidTrainingLibrary(error.to_string()))?;
        let reconciled = reconcile_training_session_range(
            &range,
            exercise_duration,
            &evidence_revision,
            compatibility,
        )
        .map_err(|error| ImportError::InvalidTrainingLibrary(error.to_string()))?;
        if reconciled == range {
            continue;
        }
        let changed = transaction.execute(
            "UPDATE training_session_range
             SET evidence_revision = ?2, state = ?3, revision = ?4,
                 updated_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE range_id = ?1 AND revision = ?5",
            params![
                reconciled.range_id(),
                reconciled.evidence_revision(),
                reconciled.state().code(),
                i64::try_from(reconciled.revision()).map_err(|_| {
                    ImportError::InvalidTrainingLibrary(
                        "training-session range revision is too large".to_owned(),
                    )
                })?,
                i64::try_from(range.revision()).map_err(|_| {
                    ImportError::InvalidTrainingLibrary(
                        "training-session range revision is too large".to_owned(),
                    )
                })?,
            ],
        )?;
        if changed != 1 {
            return Err(ImportError::InvalidTrainingLibrary(
                "training-session range reconciliation lost its exact revision".to_owned(),
            ));
        }
    }
    Ok(())
}

fn query_training_bounds_on(connection: &Connection) -> Result<Option<TrainingDateRange>> {
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

fn query_training_discovery_sports(
    connection: &Connection,
) -> Result<Vec<TrainingDiscoverySportEntry>> {
    let mut statement = connection.prepare(
        "WITH source_sport AS (
             SELECT origin_id, sport_ref FROM training_session
             UNION
             SELECT origin_id, sport_ref FROM training_exercise
         )
         SELECT source_sport.origin_id, source_sport.sport_ref,
                classification.classification_state,
                classification.canonical_family,
                classification.display_label,
                classification.authorship,
                classification.revision
         FROM source_sport
         LEFT JOIN sport_classification AS classification
           ON classification.origin_id = source_sport.origin_id
          AND classification.source_sport_ref = source_sport.sport_ref
         ORDER BY source_sport.origin_id, source_sport.sport_ref",
    )?;
    let rows = statement.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, Option<String>>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, Option<String>>(4)?,
            row.get::<_, Option<String>>(5)?,
            row.get::<_, Option<i64>>(6)?,
        ))
    })?;
    rows.map(|row| {
        let (origin_id, source_sport_ref, state, family, label, authorship, revision) = row?;
        let public_sport = match source_sport_ref.as_deref() {
            None => {
                if state.is_some()
                    || family.is_some()
                    || label.is_some()
                    || authorship.is_some()
                    || revision.is_some()
                {
                    return Err(ImportError::InvalidTrainingLibrary(
                        "unavailable sport contains a classification".to_owned(),
                    ));
                }
                TrainingSessionSport {
                    sport_ref: None,
                    state: TrainingSportState::Unavailable,
                    classification: None,
                }
            }
            Some(source_sport_ref) => {
                let key =
                    SportClassificationKey::new(origin_id.clone(), source_sport_ref.to_owned())
                        .map_err(|error| ImportError::InvalidTrainingLibrary(error.to_string()))?;
                let classification =
                    restore_sport_classification(key, state, family, label, authorship, revision)?;
                let public_classification = TrainingSportClassification {
                    canonical_family: classification
                        .canonical_family()
                        .map(|value| value.as_code().to_owned()),
                    display_label: classification.display_label().map(str::to_owned),
                    authorship: classification.authorship().map(|value| match value {
                        SportClassificationAuthorship::User => "user".to_owned(),
                    }),
                    revision: classification.revision(),
                };
                let public_state = match classification.state() {
                    SportClassificationState::Unknown => TrainingSportState::Unknown,
                    SportClassificationState::Classified => TrainingSportState::Classified,
                };
                TrainingSessionSport {
                    sport_ref: Some(detected_sport_ref(classification.key())),
                    state: public_state,
                    classification: Some(public_classification),
                }
            }
        };
        Ok(TrainingDiscoverySportEntry {
            origin_id,
            source_sport_ref,
            public_sport,
        })
    })
    .collect()
}

fn restore_sport_classification(
    key: SportClassificationKey,
    state: Option<String>,
    canonical_family: Option<String>,
    display_label: Option<String>,
    authorship: Option<String>,
    revision: Option<i64>,
) -> Result<SportClassification> {
    match (state, authorship, revision) {
        (None, None, None) if canonical_family.is_none() && display_label.is_none() => {
            Ok(SportClassification::unresolved(key))
        }
        (Some(state), Some(authorship), Some(revision)) => {
            let state = match state.as_str() {
                "unknown" => SportClassificationState::Unknown,
                "classified" => SportClassificationState::Classified,
                _ => {
                    return Err(ImportError::InvalidTrainingLibrary(
                        "stored sport classification state is invalid".to_owned(),
                    ));
                }
            };
            let authorship = match authorship.as_str() {
                "user" => SportClassificationAuthorship::User,
                _ => {
                    return Err(ImportError::InvalidTrainingLibrary(
                        "stored sport classification authorship is invalid".to_owned(),
                    ));
                }
            };
            let canonical_family = canonical_family
                .as_deref()
                .map(SportFamily::from_code)
                .transpose()
                .map_err(|error| ImportError::InvalidTrainingLibrary(error.to_string()))?;
            let revision = u64::try_from(revision).map_err(|_| {
                ImportError::InvalidTrainingLibrary(
                    "stored sport classification revision is invalid".to_owned(),
                )
            })?;
            SportClassification::restore(
                key,
                state,
                canonical_family,
                display_label,
                Some(authorship),
                revision,
            )
            .map_err(|error| ImportError::InvalidTrainingLibrary(error.to_string()))
        }
        _ => Err(ImportError::InvalidTrainingLibrary(
            "stored sport classification is incomplete".to_owned(),
        )),
    }
}

fn select_training_discovery_sports<'a>(
    entries: &'a [TrainingDiscoverySportEntry],
    request: &TrainingSessionSearchRequest,
) -> std::result::Result<
    Option<Vec<&'a TrainingDiscoverySportEntry>>,
    TrainingSessionDiscoveryPortError,
> {
    if request.sport_refs.is_empty() && request.text.is_none() {
        return Ok(None);
    }
    for sport_ref in &request.sport_refs {
        if !entries
            .iter()
            .any(|entry| entry.public_sport.sport_ref.as_deref() == Some(sport_ref.as_str()))
        {
            return Err(TrainingSessionDiscoveryPortError::UnknownSportReference);
        }
    }
    let normalized_text = request.text.as_ref().map(|text| text.to_lowercase());
    Ok(Some(
        entries
            .iter()
            .filter(|entry| {
                request.sport_refs.is_empty()
                    || entry
                        .public_sport
                        .sport_ref
                        .as_ref()
                        .is_some_and(|sport_ref| request.sport_refs.contains(sport_ref))
            })
            .filter(|entry| {
                normalized_text.as_ref().is_none_or(|text| {
                    entry
                        .public_sport
                        .classification
                        .as_ref()
                        .and_then(|classification| classification.display_label.as_ref())
                        .is_some_and(|label| label.to_lowercase().contains(text))
                })
            })
            .collect(),
    ))
}

fn training_snapshot_ref(revision: i64) -> String {
    let mut digest = Sha256::new();
    digest.update(b"fitfreed:training-discovery-snapshot:v1\0");
    digest.update(revision.to_be_bytes());
    format!("training-snapshot-{:x}", digest.finalize())
}

fn training_session_ref(origin_id: &str, session_id: &str) -> String {
    let mut digest = Sha256::new();
    digest.update(b"fitfreed:training-session:v1\0");
    digest.update(origin_id.as_bytes());
    digest.update(b"\0");
    digest.update(session_id.as_bytes());
    format!("session-{:x}", digest.finalize())
}

fn training_exercise_ref(origin_id: &str, session_id: &str, exercise_id: &str) -> String {
    let mut digest = Sha256::new();
    digest.update(b"fitfreed:training-exercise:v1\0");
    digest.update(origin_id.as_bytes());
    digest.update(b"\0");
    digest.update(session_id.as_bytes());
    digest.update(b"\0");
    digest.update(exercise_id.as_bytes());
    format!("exercise-{:x}", digest.finalize())
}

fn training_lap_ref(
    origin_id: &str,
    session_id: &str,
    exercise_id: &str,
    kind: TrainingLapKind,
    ordinal: usize,
) -> String {
    let mut digest = Sha256::new();
    digest.update(b"fitfreed:training-lap:v1\0");
    digest.update(origin_id.as_bytes());
    digest.update(b"\0");
    digest.update(session_id.as_bytes());
    digest.update(b"\0");
    digest.update(exercise_id.as_bytes());
    digest.update(b"\0");
    digest.update(match kind {
        TrainingLapKind::Manual => b"manual".as_slice(),
        TrainingLapKind::Automatic => b"automatic".as_slice(),
    });
    digest.update(b"\0");
    digest.update(ordinal.to_be_bytes());
    format!("lap-{:x}", digest.finalize())
}

fn training_pause_ref(
    origin_id: &str,
    session_id: &str,
    exercise_id: &str,
    ordinal: usize,
) -> String {
    let mut digest = Sha256::new();
    digest.update(b"fitfreed:training-pause:v1\0");
    digest.update(origin_id.as_bytes());
    digest.update(b"\0");
    digest.update(session_id.as_bytes());
    digest.update(b"\0");
    digest.update(exercise_id.as_bytes());
    digest.update(b"\0");
    digest.update(ordinal.to_be_bytes());
    format!("pause-{:x}", digest.finalize())
}

fn training_route_ref(
    origin_id: &str,
    session_id: &str,
    exercise_id: &str,
    kind: TrainingRouteKind,
) -> String {
    let mut digest = Sha256::new();
    digest.update(b"fitfreed:training-route:v1\0");
    digest.update(origin_id.as_bytes());
    digest.update(b"\0");
    digest.update(session_id.as_bytes());
    digest.update(b"\0");
    digest.update(exercise_id.as_bytes());
    digest.update(b"\0");
    digest.update(training_route_kind_code(kind).as_bytes());
    format!("route-{:x}", digest.finalize())
}

fn training_signal_ref(
    origin_id: &str,
    session_id: &str,
    exercise_id: &str,
    role: TrainingSignalRoleView,
    ordinal: usize,
) -> String {
    let mut digest = Sha256::new();
    digest.update(b"fitfreed:training-signal:v1\0");
    digest.update(origin_id.as_bytes());
    digest.update(b"\0");
    digest.update(session_id.as_bytes());
    digest.update(b"\0");
    digest.update(exercise_id.as_bytes());
    digest.update(b"\0");
    digest.update(training_signal_role_code(role).as_bytes());
    digest.update(b"\0");
    digest.update(ordinal.to_be_bytes());
    format!("signal-{:x}", digest.finalize())
}

fn training_zone_group_ref(
    origin_id: &str,
    session_id: &str,
    exercise_id: &str,
    ordinal: usize,
) -> String {
    let mut digest = Sha256::new();
    digest.update(b"fitfreed:training-zone-group:v1\0");
    digest.update(origin_id.as_bytes());
    digest.update(b"\0");
    digest.update(session_id.as_bytes());
    digest.update(b"\0");
    digest.update(exercise_id.as_bytes());
    digest.update(b"\0");
    digest.update(ordinal.to_be_bytes());
    format!("zone-group-{:x}", digest.finalize())
}

fn training_zone_ref(
    origin_id: &str,
    session_id: &str,
    exercise_id: &str,
    group_ordinal: usize,
    ordinal: usize,
) -> String {
    let mut digest = Sha256::new();
    digest.update(b"fitfreed:training-zone:v1\0");
    digest.update(origin_id.as_bytes());
    digest.update(b"\0");
    digest.update(session_id.as_bytes());
    digest.update(b"\0");
    digest.update(exercise_id.as_bytes());
    digest.update(b"\0");
    digest.update(group_ordinal.to_be_bytes());
    digest.update(b"\0");
    digest.update(ordinal.to_be_bytes());
    format!("zone-{:x}", digest.finalize())
}

fn discovery_failure(error: impl std::fmt::Display) -> TrainingSessionDiscoveryPortError {
    TrainingSessionDiscoveryPortError::Failure(error.to_string())
}

fn training_detail_failure(error: impl std::fmt::Display) -> TrainingSessionStructurePortError {
    TrainingSessionStructurePortError::Failure(error.to_string())
}

fn training_route_failure(error: impl std::fmt::Display) -> TrainingSessionRoutePortError {
    TrainingSessionRoutePortError::Failure(error.to_string())
}

fn training_signal_failure(error: impl std::fmt::Display) -> TrainingSessionSignalPortError {
    TrainingSessionSignalPortError::Failure(error.to_string())
}

fn training_zone_failure(error: impl std::fmt::Display) -> TrainingSessionZonePortError {
    TrainingSessionZonePortError::Failure(error.to_string())
}

fn training_provenance_failure(
    error: impl std::fmt::Display,
) -> TrainingSessionProvenancePortError {
    TrainingSessionProvenancePortError::Failure(error.to_string())
}

pub fn query_detected_training_sports(database_path: &Path) -> Result<Vec<DetectedTrainingSport>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let mut statement = connection.prepare(
        "SELECT session.origin_id, session.sport_ref,
                substr(MIN(session.started_at_local), 1, 10),
                substr(MAX(session.started_at_local), 1, 10),
                COUNT(*), SUM(session.duration_milliseconds),
                SUM(session.distance_meters IS NOT NULL),
                SUM(session.average_heart_rate_bpm IS NOT NULL
                    OR session.maximum_heart_rate_bpm IS NOT NULL),
                classification.classification_state,
                classification.canonical_family,
                classification.display_label,
                classification.authorship,
                classification.revision
         FROM training_session AS session
         LEFT JOIN sport_classification AS classification
           ON classification.origin_id = session.origin_id
          AND classification.source_sport_ref = session.sport_ref
         GROUP BY session.origin_id, session.sport_ref
         ORDER BY session.origin_id, session.sport_ref",
    )?;
    let rows = statement.query_map([], |row| {
        Ok(PersistedTrainingSport {
            origin_id: row.get(0)?,
            source_sport_ref: row.get(1)?,
            first_local_date: row.get(2)?,
            last_local_date: row.get(3)?,
            session_count: row.get(4)?,
            total_duration_milliseconds: row.get(5)?,
            distance_session_count: row.get(6)?,
            heart_rate_session_count: row.get(7)?,
            state: row.get(8)?,
            canonical_family: row.get(9)?,
            display_label: row.get(10)?,
            authorship: row.get(11)?,
            revision: row.get(12)?,
        })
    })?;
    rows.map(|row| decode_detected_training_sport(row?))
        .collect()
}

struct PersistedTrainingSport {
    origin_id: String,
    source_sport_ref: Option<String>,
    first_local_date: String,
    last_local_date: String,
    session_count: i64,
    total_duration_milliseconds: i64,
    distance_session_count: i64,
    heart_rate_session_count: i64,
    state: Option<String>,
    canonical_family: Option<String>,
    display_label: Option<String>,
    authorship: Option<String>,
    revision: Option<i64>,
}

fn decode_detected_training_sport(
    persisted: PersistedTrainingSport,
) -> Result<DetectedTrainingSport> {
    let PersistedTrainingSport {
        origin_id,
        source_sport_ref,
        first_local_date,
        last_local_date,
        session_count,
        total_duration_milliseconds,
        distance_session_count,
        heart_rate_session_count,
        state,
        canonical_family,
        display_label,
        authorship,
        revision,
    } = persisted;
    let session_count = persisted_count(session_count, "sport_session_count")?;
    let distance_session_count =
        persisted_count(distance_session_count, "sport_distance_session_count")?;
    let heart_rate_session_count =
        persisted_count(heart_rate_session_count, "sport_heart_rate_session_count")?;
    let Some(source_sport_ref) = source_sport_ref else {
        if state.is_some()
            || canonical_family.is_some()
            || display_label.is_some()
            || authorship.is_some()
            || revision.is_some()
        {
            return Err(ImportError::InvalidTrainingLibrary(
                "unavailable sport contains a classification".to_owned(),
            ));
        }
        return Ok(DetectedTrainingSport {
            sport_ref: None,
            origin_id,
            classification: None,
            first_local_date,
            last_local_date,
            session_count,
            total_duration_milliseconds: i128::from(total_duration_milliseconds),
            distance_session_count,
            heart_rate_session_count,
        });
    };
    let key = SportClassificationKey::new(origin_id.clone(), source_sport_ref)
        .map_err(|error| ImportError::InvalidTrainingLibrary(error.to_string()))?;
    let classification = restore_sport_classification(
        key.clone(),
        state,
        canonical_family,
        display_label,
        authorship,
        revision,
    )?;
    Ok(DetectedTrainingSport {
        sport_ref: Some(detected_sport_ref(&key)),
        origin_id,
        classification: Some(classification),
        first_local_date,
        last_local_date,
        session_count,
        total_duration_milliseconds: i128::from(total_duration_milliseconds),
        distance_session_count,
        heart_rate_session_count,
    })
}

fn detected_sport_ref(key: &SportClassificationKey) -> String {
    let mut digest = Sha256::new();
    digest.update(b"fitfreed:training-sport:v1\0");
    digest.update(key.origin_id().as_bytes());
    digest.update(b"\0");
    digest.update(key.source_sport_ref().as_bytes());
    format!("sport-{:x}", digest.finalize())
}

fn compare_and_save_sport_classification(
    database_path: &Path,
    expected_revision: u64,
    classification: &SportClassification,
) -> Result<bool> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let expected_revision = i64::try_from(expected_revision).map_err(|_| {
        ImportError::InvalidTrainingLibrary(
            "sport classification expected revision is too large".to_owned(),
        )
    })?;
    let revision = i64::try_from(classification.revision()).map_err(|_| {
        ImportError::InvalidTrainingLibrary("sport classification revision is too large".to_owned())
    })?;
    if revision
        != expected_revision.checked_add(1).ok_or_else(|| {
            ImportError::InvalidTrainingLibrary(
                "sport classification revision does not advance once".to_owned(),
            )
        })?
    {
        return Err(ImportError::InvalidTrainingLibrary(
            "sport classification revision does not follow the expected revision".to_owned(),
        ));
    }
    let key = classification.key();
    let source_exists = connection.query_row(
        "SELECT EXISTS (
             SELECT 1 FROM training_session
             WHERE origin_id = ?1 AND sport_ref = ?2
         )",
        params![key.origin_id(), key.source_sport_ref()],
        |row| row.get::<_, bool>(0),
    )?;
    if !source_exists {
        return Err(ImportError::InvalidTrainingLibrary(
            "sport classification source evidence is unavailable".to_owned(),
        ));
    }
    let state = match classification.state() {
        SportClassificationState::Unknown => "unknown",
        SportClassificationState::Classified => "classified",
    };
    let canonical_family = classification.canonical_family().map(SportFamily::as_code);
    let authorship = match classification.authorship() {
        Some(SportClassificationAuthorship::User) => "user",
        None => {
            return Err(ImportError::InvalidTrainingLibrary(
                "unresolved sport classification cannot be persisted".to_owned(),
            ));
        }
    };
    let changed = if expected_revision == 0 {
        connection.execute(
            "INSERT INTO sport_classification (
                 origin_id, source_sport_ref, classification_state, canonical_family,
                 display_label, authorship, revision, updated_at_utc
             ) VALUES (
                 ?1, ?2, ?3, ?4, ?5, ?6, ?7,
                 strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             )
             ON CONFLICT (origin_id, source_sport_ref) DO NOTHING",
            params![
                key.origin_id(),
                key.source_sport_ref(),
                state,
                canonical_family,
                classification.display_label(),
                authorship,
                revision,
            ],
        )?
    } else {
        connection.execute(
            "UPDATE sport_classification
             SET classification_state = ?3,
                 canonical_family = ?4,
                 display_label = ?5,
                 authorship = ?6,
                 revision = ?7,
                 updated_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE origin_id = ?1
               AND source_sport_ref = ?2
               AND revision = ?8",
            params![
                key.origin_id(),
                key.source_sport_ref(),
                state,
                canonical_family,
                classification.display_label(),
                authorship,
                revision,
                expected_revision,
            ],
        )?
    };
    Ok(changed == 1)
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

fn query_library_home_revision_ref(database_path: &Path) -> Result<String> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let training_revision = connection.query_row(
        "SELECT revision FROM training_discovery_revision WHERE id = 1",
        [],
        |row| row.get::<_, i64>(0),
    )?;
    if training_revision < 1 {
        return Err(ImportError::InvalidTrainingLibrary(
            "training discovery revision is invalid".to_owned(),
        ));
    }
    let latest_terminal_operation_ref = connection
        .query_row(
            "SELECT operation_ref
             FROM import_operation
             WHERE state IN ('completed', 'rejected', 'cancelled', 'failed')
             ORDER BY id DESC LIMIT 1",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()?;
    let mut digest = Sha256::new();
    digest.update(b"fitfreed:library-home-revision:v2\0");
    digest.update(training_revision.to_be_bytes());
    digest.update(b"\0");
    if let Some(operation_ref) = latest_terminal_operation_ref {
        digest.update(operation_ref.as_bytes());
    }
    Ok(format!("library-home-revision-{:x}", digest.finalize()))
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

pub fn load_application_preferences_record(
    database_path: &Path,
) -> Result<Option<StoredApplicationPreferences>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    connection
        .query_row(
            "SELECT preference_version, locale, appearance, content_zoom_percent
             FROM application_preference
             WHERE id = 1",
            [],
            |row| {
                Ok(StoredApplicationPreferences {
                    version: row.get(0)?,
                    locale: row.get(1)?,
                    appearance: row.get(2)?,
                    content_zoom_percent: row.get(3)?,
                })
            },
        )
        .optional()
        .map_err(Into::into)
}

pub fn save_application_preferences(
    database_path: &Path,
    preferences: &ApplicationPreferences,
) -> Result<()> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    connection.execute(
        "INSERT INTO application_preference (
             id, locale, updated_at_utc, preference_version, appearance, content_zoom_percent
         ) VALUES (
             1, ?1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?2, ?3, ?4
         )
         ON CONFLICT(id) DO UPDATE SET
             locale = excluded.locale,
             updated_at_utc = excluded.updated_at_utc,
             preference_version = excluded.preference_version,
             appearance = excluded.appearance,
             content_zoom_percent = excluded.content_zoom_percent",
        params![
            preferences.locale.code(),
            preferences.version,
            preferences.appearance.code(),
            preferences.content_zoom_percent,
        ],
    )?;
    Ok(())
}

pub fn load_exploration_workspace_record(
    database_path: &Path,
) -> Result<Option<StoredExplorationWorkspace>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    connection
        .query_row(
            "SELECT workspace_version, destination
             FROM exploration_workspace
             WHERE id = 1",
            [],
            |row| {
                Ok(StoredExplorationWorkspace {
                    version: row.get(0)?,
                    destination: row.get(1)?,
                })
            },
        )
        .optional()
        .map_err(Into::into)
}

pub fn save_exploration_workspace_record(
    database_path: &Path,
    workspace: &ExplorationWorkspace,
) -> Result<()> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    connection.execute(
        "INSERT INTO exploration_workspace (
             id, workspace_version, destination, updated_at_utc
         ) VALUES (
             1, ?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         )
         ON CONFLICT(id) DO UPDATE SET
             workspace_version = excluded.workspace_version,
             destination = excluded.destination,
             updated_at_utc = excluded.updated_at_utc",
        params![
            workspace.version,
            exploration_destination_code(workspace.destination),
        ],
    )?;
    Ok(())
}

pub fn clear_exploration_workspace_record(database_path: &Path) -> Result<()> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    connection.execute("DELETE FROM exploration_workspace WHERE id = 1", [])?;
    Ok(())
}

pub fn load_training_discovery_workspace_record(
    database_path: &Path,
) -> Result<Option<TrainingDiscoveryWorkspace>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let stored = connection
        .query_row(
            "SELECT workspace_version, snapshot_ref, from_date, through_date,
                    sport_refs_json, required_measurements_json, text_filter, sort_code,
                    page_offset, page_limit, view_code, calendar_month, calendar_day,
                    selected_session_refs_json, open_session_ref
             FROM training_discovery_workspace
             WHERE id = 1",
            [],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, Option<String>>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, i64>(8)?,
                    row.get::<_, i64>(9)?,
                    row.get::<_, String>(10)?,
                    row.get::<_, Option<String>>(11)?,
                    row.get::<_, Option<String>>(12)?,
                    row.get::<_, String>(13)?,
                    row.get::<_, Option<String>>(14)?,
                ))
            },
        )
        .optional()?;
    let Some((
        version,
        snapshot_ref,
        from,
        through,
        sport_refs_json,
        measurements_json,
        text,
        sort_code,
        offset,
        limit,
        view_code,
        calendar_month,
        calendar_day,
        selected_session_refs_json,
        open_session_ref,
    )) = stored
    else {
        return Ok(None);
    };
    let invalid = |reason: &str| ImportError::InvalidTrainingLibrary(reason.to_owned());
    let sport_refs = serde_json::from_str::<Vec<String>>(&sport_refs_json)
        .map_err(|_| invalid("stored training workspace sport filters are invalid"))?;
    let measurement_codes = serde_json::from_str::<Vec<String>>(&measurements_json)
        .map_err(|_| invalid("stored training workspace measurement filters are invalid"))?;
    let required_measurements = measurement_codes
        .into_iter()
        .map(|code| match code.as_str() {
            "distance" => Ok(TrainingMeasurementFilter::Distance),
            "energy" => Ok(TrainingMeasurementFilter::Energy),
            "heart-rate" => Ok(TrainingMeasurementFilter::HeartRate),
            _ => Err(invalid(
                "stored training workspace measurement filter is unknown",
            )),
        })
        .collect::<Result<Vec<_>>>()?;
    let selected_session_refs = serde_json::from_str::<Vec<String>>(&selected_session_refs_json)
        .map_err(|_| invalid("stored training workspace selection is invalid"))?;
    let sort = match sort_code.as_str() {
        "started-desc" => TrainingSessionSort::StartedDescending,
        "started-asc" => TrainingSessionSort::StartedAscending,
        "duration-desc" => TrainingSessionSort::DurationDescending,
        "distance-desc" => TrainingSessionSort::DistanceDescending,
        _ => return Err(invalid("stored training workspace sort is unknown")),
    };
    let view = match view_code.as_str() {
        "chronology" => TrainingDiscoveryView::Chronology,
        "calendar" => TrainingDiscoveryView::Calendar,
        _ => return Err(invalid("stored training workspace view is unknown")),
    };
    Ok(Some(TrainingDiscoveryWorkspace {
        version: u32::try_from(version)
            .map_err(|_| invalid("stored training workspace version is invalid"))?,
        snapshot_ref,
        from,
        through,
        sport_refs,
        required_measurements,
        text,
        sort,
        offset: usize::try_from(offset)
            .map_err(|_| invalid("stored training workspace offset is invalid"))?,
        limit: usize::try_from(limit)
            .map_err(|_| invalid("stored training workspace limit is invalid"))?,
        view,
        calendar_month,
        calendar_day,
        selected_session_refs,
        open_session_ref,
    }))
}

pub fn save_training_discovery_workspace_record(
    database_path: &Path,
    workspace: &TrainingDiscoveryWorkspace,
) -> Result<()> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let measurement_codes = workspace
        .required_measurements
        .iter()
        .map(|measurement| match measurement {
            TrainingMeasurementFilter::Distance => "distance",
            TrainingMeasurementFilter::Energy => "energy",
            TrainingMeasurementFilter::HeartRate => "heart-rate",
        })
        .collect::<Vec<_>>();
    let sport_refs_json = serde_json::to_string(&workspace.sport_refs)
        .map_err(|error| ImportError::InvalidTrainingLibrary(error.to_string()))?;
    let measurements_json = serde_json::to_string(&measurement_codes)
        .map_err(|error| ImportError::InvalidTrainingLibrary(error.to_string()))?;
    let selected_session_refs_json = serde_json::to_string(&workspace.selected_session_refs)
        .map_err(|error| ImportError::InvalidTrainingLibrary(error.to_string()))?;
    let sort_code = match workspace.sort {
        TrainingSessionSort::StartedDescending => "started-desc",
        TrainingSessionSort::StartedAscending => "started-asc",
        TrainingSessionSort::DurationDescending => "duration-desc",
        TrainingSessionSort::DistanceDescending => "distance-desc",
    };
    let view_code = match workspace.view {
        TrainingDiscoveryView::Chronology => "chronology",
        TrainingDiscoveryView::Calendar => "calendar",
    };
    connection.execute(
        "INSERT INTO training_discovery_workspace (
             id, workspace_version, snapshot_ref, from_date, through_date,
             sport_refs_json, required_measurements_json, text_filter, sort_code,
             page_offset, page_limit, view_code, calendar_month, calendar_day,
             selected_session_refs_json, open_session_ref, updated_at_utc
         ) VALUES (
             1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15,
             strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         )
         ON CONFLICT (id) DO UPDATE SET
             workspace_version = excluded.workspace_version,
             snapshot_ref = excluded.snapshot_ref,
             from_date = excluded.from_date,
             through_date = excluded.through_date,
             sport_refs_json = excluded.sport_refs_json,
             required_measurements_json = excluded.required_measurements_json,
             text_filter = excluded.text_filter,
             sort_code = excluded.sort_code,
             page_offset = excluded.page_offset,
             page_limit = excluded.page_limit,
             view_code = excluded.view_code,
             calendar_month = excluded.calendar_month,
             calendar_day = excluded.calendar_day,
             selected_session_refs_json = excluded.selected_session_refs_json,
             open_session_ref = excluded.open_session_ref,
             updated_at_utc = excluded.updated_at_utc",
        params![
            workspace.version,
            workspace.snapshot_ref,
            workspace.from,
            workspace.through,
            sport_refs_json,
            measurements_json,
            workspace.text,
            sort_code,
            workspace.offset,
            workspace.limit,
            view_code,
            workspace.calendar_month,
            workspace.calendar_day,
            selected_session_refs_json,
            workspace.open_session_ref,
        ],
    )?;
    Ok(())
}

pub fn clear_training_discovery_workspace_record(database_path: &Path) -> Result<()> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    connection.execute("DELETE FROM training_discovery_workspace WHERE id = 1", [])?;
    Ok(())
}

fn exploration_destination_code(destination: ExploreDestination) -> &'static str {
    match destination {
        ExploreDestination::Activity => "activity",
        ExploreDestination::Training => "training",
        ExploreDestination::Sleep => "sleep",
        ExploreDestination::Recovery => "recovery",
        ExploreDestination::Longitudinal => "longitudinal",
    }
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
        return complete_schema_maintenance(connection);
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
        if version < 9 {
            connection.execute_batch(SCHEMA_V9)?;
        }
        if version < 10 {
            connection.execute_batch(SCHEMA_V10)?;
        }
        if version < 11 {
            connection.execute_batch(SCHEMA_V11)?;
        }
        if version < 12 {
            connection.execute_batch(SCHEMA_V12)?;
        }
        if version < 13 {
            connection.execute_batch(SCHEMA_V13)?;
        }
        if version < 14 {
            connection.execute_batch(SCHEMA_V14)?;
        }
        if version < 15 {
            connection.execute_batch(SCHEMA_V15)?;
        }
        if version < 16 {
            connection.execute_batch(SCHEMA_V16)?;
        }
        if version < 17 {
            connection.execute_batch(SCHEMA_V17)?;
        }
        if version < 18 {
            connection.execute_batch(SCHEMA_V18)?;
        }
        if version < 19 {
            connection.execute_batch(SCHEMA_V19)?;
        }
        if version < 20 {
            connection.execute_batch(SCHEMA_V20)?;
        }
        if version < 21 {
            connection.execute_batch(SCHEMA_V21)?;
        }
        if version < 22 {
            connection.execute_batch(SCHEMA_V22)?;
        }
        if version < 23 {
            connection.execute_batch(SCHEMA_V23)?;
        }
        if version < 24 {
            connection.execute_batch(SCHEMA_V24)?;
        }
        if version < 25 {
            connection.execute_batch(SCHEMA_V25)?;
        }
        if version < 26 {
            connection.execute_batch(SCHEMA_V26)?;
        }
        if interrupt_before_commit {
            return Err(ImportError::InjectedMigrationInterruption);
        }
        connection.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        connection.execute_batch("COMMIT;")?;
        complete_schema_maintenance(connection)
    })();
    if migration.is_err() {
        let _ = connection.execute_batch("ROLLBACK;");
    }
    migration
}

fn complete_schema_maintenance(connection: &Connection) -> Result<()> {
    let pending = connection.query_row(
        "SELECT EXISTS (
             SELECT 1 FROM library_maintenance WHERE task = 'compact-signal-storage'
         )",
        [],
        |row| row.get::<_, bool>(0),
    )?;
    if pending {
        connection.execute_batch("VACUUM;")?;
        connection.execute(
            "DELETE FROM library_maintenance WHERE task = 'compact-signal-storage'",
            [],
        )?;
    }
    Ok(())
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
    artifacts: &[ValidatedTrainingArtifact],
) -> Result<Option<ImportError>> {
    let mut locators_by_identity: HashMap<(&str, &str), Vec<&str>> = HashMap::new();
    for artifact in artifacts {
        locators_by_identity
            .entry((artifact.origin_id.as_str(), artifact.session_id.as_str()))
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
        | ImportError::InvalidPersistedCount { .. } => "invalid-persisted-import-outcome",
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
    let normalized = normalize_source_datetime(parsed);
    Ok((parsed, normalized))
}

fn parse_source_pause_datetime(
    value: &str,
    field: &'static str,
    artifact: &str,
) -> Result<(NaiveDateTime, String)> {
    let parsed = NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S%.f")
        .or_else(|_| NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M"))
        .map_err(|error| ImportError::InvalidArtifact {
            artifact: artifact.to_owned(),
            reason: format!("invalid {field}: {error}"),
            reason_code: "invalid-supported-artifact",
        })?;
    Ok((parsed, normalize_source_datetime(parsed)))
}

fn normalize_source_datetime(parsed: NaiveDateTime) -> String {
    if parsed.nanosecond() == 0 {
        parsed.format("%Y-%m-%dT%H:%M:%S").to_string()
    } else {
        parsed.format("%Y-%m-%dT%H:%M:%S%.f").to_string()
    }
}

fn invalid_training_artifact(artifact: &str, reason: impl Into<String>) -> ImportError {
    ImportError::InvalidArtifact {
        artifact: artifact.to_owned(),
        reason: reason.into(),
        reason_code: "invalid-supported-artifact",
    }
}

fn map_training_laps(
    source: SourceOptional<Vec<PolarTrainingLap>>,
    kind: TrainingLapKind,
    artifact: &str,
) -> Result<Option<Vec<TrainingLap>>> {
    source
        .into_option()
        .map(|laps| {
            laps.into_iter()
                .enumerate()
                .map(|(ordinal, lap)| {
                    if !(0..=359_999_999).contains(&lap.split_time_millis)
                        || !(0..=359_999_999).contains(&lap.duration_millis)
                    {
                        return Err(invalid_training_artifact(
                            artifact,
                            "lap timing is outside the documented range",
                        ));
                    }
                    let distance_meters = lap.distance_meters.into_option();
                    if distance_meters.is_some_and(|value| {
                        !value.is_finite() || !(0.0..=9_999_000.0).contains(&value)
                    }) {
                        return Err(invalid_training_artifact(
                            artifact,
                            "lap distanceMeters is outside the documented range",
                        ));
                    }
                    Ok(TrainingLap {
                        kind,
                        ordinal,
                        split_time_milliseconds: lap.split_time_millis,
                        duration_milliseconds: lap.duration_millis,
                        distance_meters,
                    })
                })
                .collect()
        })
        .transpose()
}

struct MappedTrainingExercises {
    structure: Option<Vec<TrainingExercise>>,
    routes: Option<Vec<TrainingExerciseRouteAssessment>>,
    signals: Option<Vec<TrainingExerciseSignalAssessment>>,
    zones: Option<Vec<TrainingExerciseZoneAssessment>>,
}

fn map_training_exercises(
    source: SourceOptional<Vec<PolarTrainingExercise>>,
    artifact: &str,
) -> Result<MappedTrainingExercises> {
    match source.into_option() {
        None => Ok(MappedTrainingExercises {
            structure: None,
            routes: None,
            signals: None,
            zones: None,
        }),
        Some(exercises) => {
            let mut exercise_ids = BTreeSet::new();
            let mapped = exercises
                .into_iter()
                .enumerate()
                .map(|(ordinal, exercise)| {
                    let PolarTrainingExercise {
                        identifier,
                        created,
                        modified,
                        start_time,
                        stop_time,
                        timezone_offset_minutes,
                        duration_millis,
                        distance_meters,
                        calories,
                        sport,
                        laps,
                        pause_times,
                        routes,
                        samples,
                        zones,
                    } = exercise;
                    if identifier.id.trim().is_empty()
                        || !exercise_ids.insert(identifier.id.clone())
                    {
                        return Err(invalid_training_artifact(
                            artifact,
                            "exercise identifier.id is blank or duplicated",
                        ));
                    }
                    let _ = parse_source_datetime(&created, "exercise.created", artifact)?;
                    let _ = parse_source_datetime(&modified, "exercise.modified", artifact)?;
                    let (started, started_at_local) =
                        parse_source_datetime(&start_time, "exercise.startTime", artifact)?;
                    let (stopped, stopped_at_local) =
                        parse_source_datetime(&stop_time, "exercise.stopTime", artifact)?;
                    if started > stopped {
                        return Err(invalid_training_artifact(
                            artifact,
                            "exercise stopTime precedes startTime",
                        ));
                    }
                    if !(0..=359_999_999).contains(&duration_millis) {
                        return Err(invalid_training_artifact(
                            artifact,
                            "exercise durationMillis is outside the documented range",
                        ));
                    }
                    let distance_meters = distance_meters.into_option();
                    if distance_meters.is_some_and(|value| {
                        !value.is_finite() || !(0.0..=9_999_000.0).contains(&value)
                    }) {
                        return Err(invalid_training_artifact(
                            artifact,
                            "exercise distanceMeters is outside the documented range",
                        ));
                    }
                    let energy_kilocalories = calories.into_option();
                    if energy_kilocalories.is_some_and(|value| value < 0) {
                        return Err(invalid_training_artifact(
                            artifact,
                            "exercise calories cannot be negative",
                        ));
                    }
                    let sport_ref = sport.into_option().map(|reference| reference.id);
                    if sport_ref
                        .as_ref()
                        .is_some_and(|reference| reference.trim().is_empty())
                    {
                        return Err(invalid_training_artifact(
                            artifact,
                            "exercise sport.id cannot be blank",
                        ));
                    }
                    let (manual_laps, automatic_laps) = laps
                        .into_option()
                        .map(|source_laps| -> Result<_> {
                            Ok((
                                map_training_laps(
                                    source_laps.laps,
                                    TrainingLapKind::Manual,
                                    artifact,
                                )?,
                                map_training_laps(
                                    source_laps.auto_laps,
                                    TrainingLapKind::Automatic,
                                    artifact,
                                )?,
                            ))
                        })
                        .transpose()?
                        .unwrap_or((None, None));
                    let pauses = pause_times
                        .into_option()
                        .map(|pauses| {
                            pauses
                                .into_iter()
                                .enumerate()
                                .map(|(ordinal, pause)| {
                                    let (started, started_at_local) = parse_source_pause_datetime(
                                        &pause.start_time,
                                        "pauseTimes[].startTime",
                                        artifact,
                                    )?;
                                    let (ended, ended_at_local) = parse_source_pause_datetime(
                                        &pause.end_time,
                                        "pauseTimes[].endTime",
                                        artifact,
                                    )?;
                                    if started > ended {
                                        return Err(invalid_training_artifact(
                                            artifact,
                                            "pause endTime precedes startTime",
                                        ));
                                    }
                                    Ok(TrainingPause {
                                        ordinal,
                                        started_at_local,
                                        ended_at_local,
                                    })
                                })
                                .collect()
                        })
                        .transpose()?;
                    let route_assessment = TrainingExerciseRouteAssessment {
                        exercise_id: identifier.id.clone(),
                        ordinal,
                        routes: map_training_routes(routes, artifact)?,
                    };
                    let signal_assessment = TrainingExerciseSignalAssessment {
                        exercise_id: identifier.id.clone(),
                        ordinal,
                        signals: map_training_signals(samples, artifact)?,
                    };
                    let zone_assessment = TrainingExerciseZoneAssessment {
                        exercise_id: identifier.id.clone(),
                        ordinal,
                        zones: map_training_zones(zones, artifact)?,
                    };
                    Ok((
                        TrainingExercise {
                            exercise_id: identifier.id,
                            ordinal,
                            started_at_local,
                            stopped_at_local,
                            utc_offset_minutes: timezone_offset_minutes.into_option(),
                            duration_milliseconds: duration_millis,
                            distance_meters,
                            energy_kilocalories,
                            sport_ref,
                            manual_laps,
                            automatic_laps,
                            pauses,
                        },
                        route_assessment,
                        signal_assessment,
                        zone_assessment,
                    ))
                })
                .collect::<Result<Vec<_>>>()?;
            let mut exercises = Vec::with_capacity(mapped.len());
            let mut routes = Vec::with_capacity(mapped.len());
            let mut signals = Vec::with_capacity(mapped.len());
            let mut zones = Vec::with_capacity(mapped.len());
            for (exercise, route, signal, zone) in mapped {
                exercises.push(exercise);
                routes.push(route);
                signals.push(signal);
                zones.push(zone);
            }
            Ok(MappedTrainingExercises {
                structure: Some(exercises),
                routes: Some(routes),
                signals: Some(signals),
                zones: Some(zones),
            })
        }
    }
}

fn map_training_zones(
    source: SourceOptional<Vec<PolarTrainingZoneGroup>>,
    artifact: &str,
) -> Result<Option<TrainingZones>> {
    const MAX_ZONE_GROUPS: usize = 64;
    const MAX_ZONES_PER_GROUP: usize = 256;

    source
        .into_option()
        .map(|source_groups| {
            if source_groups.len() > MAX_ZONE_GROUPS {
                return Err(invalid_training_artifact(
                    artifact,
                    "zone group count exceeds the documented compatibility bound",
                ));
            }
            let mut groups = Vec::new();
            let mut unsupported_group_count = 0_usize;
            for source_group in source_groups {
                let (kind, unit) = match source_group.r#type.as_str() {
                    "ZONE_TYPE_HEART_RATE" => (
                        TrainingZoneKind::HeartRate,
                        TrainingZoneUnit::BeatsPerMinute,
                    ),
                    "ZONE_TYPE_SPEED" => {
                        (TrainingZoneKind::Speed, TrainingZoneUnit::KilometersPerHour)
                    }
                    "ZONE_TYPE_POWER" => (TrainingZoneKind::Power, TrainingZoneUnit::Watts),
                    _ => {
                        unsupported_group_count =
                            unsupported_group_count.checked_add(1).ok_or_else(|| {
                                invalid_training_artifact(
                                    artifact,
                                    "unsupported zone group count overflows",
                                )
                            })?;
                        continue;
                    }
                };
                let zones = source_group
                    .zones
                    .into_option()
                    .map(|source_zones| {
                        if source_zones.len() > MAX_ZONES_PER_GROUP {
                            return Err(invalid_training_artifact(
                                artifact,
                                "zone count exceeds the documented compatibility bound",
                            ));
                        }
                        source_zones
                            .into_iter()
                            .enumerate()
                            .map(|(ordinal, source_zone)| {
                                map_training_zone(source_zone, kind, ordinal, artifact)
                            })
                            .collect()
                    })
                    .transpose()?;
                groups.push(TrainingZoneGroup {
                    ordinal: groups.len(),
                    kind,
                    unit,
                    zones,
                });
            }
            Ok(TrainingZones {
                groups,
                unsupported_group_count,
            })
        })
        .transpose()
}

fn map_training_zone(
    source: PolarTrainingZone,
    kind: TrainingZoneKind,
    ordinal: usize,
    artifact: &str,
) -> Result<TrainingZone> {
    let lower_limit = source.lower_limit.into_option().ok_or_else(|| {
        invalid_training_artifact(artifact, "supported zone lowerLimit is missing")
    })?;
    let higher_limit = source.higher_limit.into_option().ok_or_else(|| {
        invalid_training_artifact(artifact, "supported zone higherLimit is missing")
    })?;
    let time_in_zone_milliseconds = source.in_zone.into_option();
    let distance_meters = source.distance_meters.into_option();
    let muscle_load = source.muscle_load.into_option();
    if !lower_limit.is_finite()
        || lower_limit < 0.0
        || !higher_limit.is_finite()
        || higher_limit < lower_limit
        || time_in_zone_milliseconds.is_some_and(|value| value < 0)
        || distance_meters.is_some_and(|value| !value.is_finite() || value < 0.0)
        || muscle_load.is_some_and(|value| !value.is_finite() || value < 0.0)
    {
        return Err(invalid_training_artifact(
            artifact,
            "zone values are outside the documented range",
        ));
    }
    let aggregates_match_kind = match kind {
        TrainingZoneKind::HeartRate => distance_meters.is_none() && muscle_load.is_none(),
        TrainingZoneKind::Speed => muscle_load.is_none(),
        TrainingZoneKind::Power => distance_meters.is_none(),
    };
    if !aggregates_match_kind {
        return Err(invalid_training_artifact(
            artifact,
            "zone aggregate is incompatible with its documented type",
        ));
    }
    Ok(TrainingZone {
        ordinal,
        lower_limit,
        higher_limit,
        time_in_zone_milliseconds,
        distance_meters,
        muscle_load,
    })
}

fn map_training_signals(
    source: SourceOptional<PolarTrainingSamples>,
    artifact: &str,
) -> Result<Option<TrainingSignals>> {
    source
        .into_option()
        .map(|signals| {
            let (primary, unsupported_primary_series_count) =
                map_training_signal_collection(signals.samples, artifact)?;
            let (transition, unsupported_transition_series_count) =
                map_training_signal_collection(signals.transition_samples, artifact)?;
            Ok(TrainingSignals {
                primary,
                transition,
                unsupported_primary_series_count,
                unsupported_transition_series_count,
            })
        })
        .transpose()
}

fn map_training_signal_collection(
    source: SourceOptional<Vec<PolarTrainingSignalSeries>>,
    artifact: &str,
) -> Result<(Option<Vec<TrainingSignalSeries>>, usize)> {
    let Some(series) = source.into_option() else {
        return Ok((None, 0));
    };
    let mut mapped = Vec::new();
    let mut unsupported = 0usize;
    for source_series in series {
        let Some((kind, unit)) = training_signal_meaning(&source_series.r#type) else {
            unsupported = unsupported.checked_add(1).ok_or_else(|| {
                invalid_training_artifact(artifact, "unsupported signal count is too large")
            })?;
            continue;
        };
        if !(1..=359_999_999).contains(&source_series.interval_millis) {
            return Err(invalid_training_artifact(
                artifact,
                "signal intervalMillis is outside the documented range",
            ));
        }
        let ordinal = mapped.len();
        let mut samples = Vec::with_capacity(source_series.values.len());
        for (sample_ordinal, value) in source_series.values.into_iter().enumerate() {
            let value = match value {
                PolarTrainingSignalValue::Number(value) if value.is_finite() => Some(value),
                PolarTrainingSignalValue::Text(value) if value == "NaN" => None,
                PolarTrainingSignalValue::Number(_) | PolarTrainingSignalValue::Text(_) => {
                    return Err(invalid_training_artifact(
                        artifact,
                        "signal value is neither finite nor the documented NaN marker",
                    ));
                }
            };
            if value.is_some_and(|value| {
                !matches!(
                    kind,
                    TrainingSignalKind::Altitude | TrainingSignalKind::Temperature
                ) && value < 0.0
            }) {
                return Err(invalid_training_artifact(
                    artifact,
                    "signal value is negative for its canonical meaning",
                ));
            }
            let sample_ordinal_i64 = i64::try_from(sample_ordinal).map_err(|_| {
                invalid_training_artifact(artifact, "signal sample ordinal is too large")
            })?;
            sample_ordinal_i64
                .checked_mul(source_series.interval_millis)
                .ok_or_else(|| {
                    invalid_training_artifact(artifact, "signal elapsed time is too large")
                })?;
            samples.push(TrainingSignalSample {
                ordinal: sample_ordinal,
                value,
            });
        }
        mapped.push(TrainingSignalSeries {
            ordinal,
            kind,
            unit,
            interval_milliseconds: source_series.interval_millis,
            samples,
        });
    }
    Ok((Some(mapped), unsupported))
}

fn training_signal_meaning(source_type: &str) -> Option<(TrainingSignalKind, TrainingSignalUnit)> {
    match source_type {
        "HEART_RATE" => Some((
            TrainingSignalKind::HeartRate,
            TrainingSignalUnit::BeatsPerMinute,
        )),
        "SPEED" => Some((
            TrainingSignalKind::Speed,
            TrainingSignalUnit::KilometersPerHour,
        )),
        "DISTANCE" => Some((TrainingSignalKind::Distance, TrainingSignalUnit::Meters)),
        "ALTITUDE" => Some((TrainingSignalKind::Altitude, TrainingSignalUnit::Meters)),
        "CADENCE" => Some((
            TrainingSignalKind::Cadence,
            TrainingSignalUnit::RotationsPerMinute,
        )),
        "TEMPERATURE" => Some((
            TrainingSignalKind::Temperature,
            TrainingSignalUnit::DegreesCelsius,
        )),
        "LEFT_CRANK_CURRENT_POWER" => Some((
            TrainingSignalKind::LeftCrankPower,
            TrainingSignalUnit::Watts,
        )),
        _ => None,
    }
}

fn map_training_routes(
    source: SourceOptional<PolarTrainingRoutes>,
    artifact: &str,
) -> Result<Option<TrainingRoutes>> {
    source
        .into_option()
        .map(|routes| {
            Ok(TrainingRoutes {
                primary: routes
                    .route
                    .into_option()
                    .map(|route| map_training_route(route, TrainingRouteKind::Primary, artifact))
                    .transpose()?,
                transition: routes
                    .transition_route
                    .into_option()
                    .map(|route| map_training_route(route, TrainingRouteKind::Transition, artifact))
                    .transpose()?,
            })
        })
        .transpose()
}

fn map_training_route(
    source: PolarTrainingRoute,
    kind: TrainingRouteKind,
    artifact: &str,
) -> Result<TrainingRoute> {
    let (_, started_at_local) =
        parse_source_datetime(&source.start_time, "routes route.startTime", artifact)?;
    let mut previous_elapsed = None;
    let points = source
        .way_points
        .into_iter()
        .enumerate()
        .map(|(ordinal, point)| {
            if !point.latitude.is_finite()
                || !(-90.0..=90.0).contains(&point.latitude)
                || !point.longitude.is_finite()
                || !(-180.0..=180.0).contains(&point.longitude)
            {
                return Err(invalid_training_artifact(
                    artifact,
                    "route coordinates are outside the documented range",
                ));
            }
            let altitude_meters = point.altitude.into_option();
            if altitude_meters.is_some_and(|value| !value.is_finite()) {
                return Err(invalid_training_artifact(
                    artifact,
                    "route altitude is not finite",
                ));
            }
            let elapsed_milliseconds = point.elapsed_millis.into_option();
            if elapsed_milliseconds.is_some_and(|value| {
                value < 0 || previous_elapsed.is_some_and(|previous| value < previous)
            }) {
                return Err(invalid_training_artifact(
                    artifact,
                    "route elapsed offsets are negative or unordered",
                ));
            }
            if let Some(elapsed) = elapsed_milliseconds {
                previous_elapsed = Some(elapsed);
            }
            Ok(TrainingRoutePoint {
                ordinal,
                latitude_degrees: point.latitude,
                longitude_degrees: point.longitude,
                altitude_meters,
                elapsed_milliseconds,
            })
        })
        .collect::<Result<_>>()?;
    Ok(TrainingRoute {
        kind,
        started_at_local,
        points,
    })
}

fn map_training_session(
    origin_id: &str,
    source: PolarTrainingSession,
    artifact: &str,
) -> Result<(TrainingSessionRecord, String)> {
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

    let MappedTrainingExercises {
        structure: exercises,
        routes: route_exercises,
        signals: signal_exercises,
        zones: zone_exercises,
    } = map_training_exercises(exercises, artifact)?;
    let exercise_count = exercises.as_ref().map(Vec::len);
    Ok((
        TrainingSessionRecord {
            summary: TrainingSession {
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
                exercise_count,
            },
            structure: Some(TrainingSessionStructure { exercises }),
            routes: Some(TrainingSessionRouteAssessment {
                exercises: route_exercises,
            }),
            signals: Some(TrainingSessionSignalAssessment {
                exercises: signal_exercises,
            }),
            zones: Some(TrainingSessionZoneAssessment {
                exercises: zone_exercises,
            }),
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

fn persisted_training_flag(value: i64, field: &str) -> Result<bool> {
    match value {
        0 => Ok(false),
        1 => Ok(true),
        _ => Err(ImportError::InvalidTrainingLibrary(format!(
            "{field} is not a boolean flag"
        ))),
    }
}

fn query_training_session_structure_on(
    connection: &Connection,
    origin_id: &str,
    session_id: &str,
) -> Result<Option<TrainingSessionStructure>> {
    let exercises_present = connection
        .query_row(
            "SELECT exercises_present FROM training_session_structure
             WHERE origin_id = ?1 AND session_id = ?2",
            params![origin_id, session_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()?;
    let Some(exercises_present) = exercises_present else {
        return Ok(None);
    };
    if !persisted_training_flag(exercises_present, "exercises_present")? {
        return Ok(Some(TrainingSessionStructure { exercises: None }));
    }

    let mut statement = connection.prepare(
        "SELECT exercise_id, ordinal, started_at_local, stopped_at_local,
                utc_offset_minutes, duration_milliseconds, distance_meters,
                energy_kilocalories, sport_ref, manual_laps_present,
                automatic_laps_present, pauses_present
         FROM training_exercise
         WHERE origin_id = ?1 AND session_id = ?2
         ORDER BY ordinal",
    )?;
    let rows = statement.query_map(params![origin_id, session_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, Option<i32>>(4)?,
            row.get::<_, i64>(5)?,
            row.get::<_, Option<f64>>(6)?,
            row.get::<_, Option<i64>>(7)?,
            row.get::<_, Option<String>>(8)?,
            row.get::<_, i64>(9)?,
            row.get::<_, i64>(10)?,
            row.get::<_, i64>(11)?,
        ))
    })?;
    let mut exercises = Vec::new();
    for row in rows {
        let (
            exercise_id,
            ordinal,
            started_at_local,
            stopped_at_local,
            utc_offset_minutes,
            duration_milliseconds,
            distance_meters,
            energy_kilocalories,
            sport_ref,
            manual_laps_present,
            automatic_laps_present,
            pauses_present,
        ) = row?;
        let ordinal = persisted_count(ordinal, "training_exercise.ordinal")?;
        let query_laps = |kind: TrainingLapKind| -> Result<Vec<TrainingLap>> {
            let kind_code = match kind {
                TrainingLapKind::Manual => "manual",
                TrainingLapKind::Automatic => "automatic",
            };
            let mut statement = connection.prepare(
                "SELECT ordinal, split_time_milliseconds, duration_milliseconds,
                        distance_meters
                 FROM training_lap
                 WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3
                   AND kind = ?4
                 ORDER BY ordinal",
            )?;
            let rows = statement.query_map(
                params![origin_id, session_id, exercise_id, kind_code],
                |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, Option<f64>>(3)?,
                    ))
                },
            )?;
            rows.map(|row| {
                let (ordinal, split_time_milliseconds, duration_milliseconds, distance_meters) =
                    row?;
                Ok(TrainingLap {
                    kind,
                    ordinal: persisted_count(ordinal, "training_lap.ordinal")?,
                    split_time_milliseconds,
                    duration_milliseconds,
                    distance_meters,
                })
            })
            .collect()
        };
        let manual_laps = persisted_training_flag(manual_laps_present, "manual_laps_present")?
            .then(|| query_laps(TrainingLapKind::Manual))
            .transpose()?;
        let automatic_laps =
            persisted_training_flag(automatic_laps_present, "automatic_laps_present")?
                .then(|| query_laps(TrainingLapKind::Automatic))
                .transpose()?;
        let pauses = if persisted_training_flag(pauses_present, "pauses_present")? {
            let mut pause_statement = connection.prepare(
                "SELECT ordinal, started_at_local, ended_at_local
                 FROM training_pause
                 WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3
                 ORDER BY ordinal",
            )?;
            let pause_rows =
                pause_statement.query_map(params![origin_id, session_id, exercise_id], |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                })?;
            Some(
                pause_rows
                    .map(|row| {
                        let (ordinal, started_at_local, ended_at_local) = row?;
                        Ok(TrainingPause {
                            ordinal: persisted_count(ordinal, "training_pause.ordinal")?,
                            started_at_local,
                            ended_at_local,
                        })
                    })
                    .collect::<Result<Vec<_>>>()?,
            )
        } else {
            None
        };
        exercises.push(TrainingExercise {
            exercise_id,
            ordinal,
            started_at_local,
            stopped_at_local,
            utc_offset_minutes,
            duration_milliseconds,
            distance_meters,
            energy_kilocalories,
            sport_ref,
            manual_laps,
            automatic_laps,
            pauses,
        });
    }
    drop(statement);
    Ok(Some(TrainingSessionStructure {
        exercises: Some(exercises),
    }))
}

fn training_route_kind_code(kind: TrainingRouteKind) -> &'static str {
    match kind {
        TrainingRouteKind::Primary => "primary",
        TrainingRouteKind::Transition => "transition",
    }
}

fn query_training_route_on(
    connection: &Connection,
    origin_id: &str,
    session_id: &str,
    exercise_id: &str,
    kind: TrainingRouteKind,
) -> Result<Option<TrainingRoute>> {
    let kind_code = training_route_kind_code(kind);
    let route = connection
        .query_row(
            "SELECT started_at_local, point_count, altitude_point_count,
                    elapsed_point_count
             FROM training_route
             WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3 AND kind = ?4",
            params![origin_id, session_id, exercise_id, kind_code],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, i64>(3)?,
                ))
            },
        )
        .optional()?;
    let Some((started_at_local, point_count, altitude_point_count, elapsed_point_count)) = route
    else {
        return Ok(None);
    };
    let point_count = persisted_count(point_count, "training_route.point_count")?;
    let altitude_point_count =
        persisted_count(altitude_point_count, "training_route.altitude_point_count")?;
    let elapsed_point_count =
        persisted_count(elapsed_point_count, "training_route.elapsed_point_count")?;
    let mut statement = connection.prepare(
        "SELECT ordinal, latitude_degrees, longitude_degrees, altitude_meters,
                elapsed_milliseconds
         FROM training_route_point
         WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3 AND kind = ?4
         ORDER BY ordinal",
    )?;
    let rows = statement.query_map(
        params![origin_id, session_id, exercise_id, kind_code],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, f64>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, Option<f64>>(3)?,
                row.get::<_, Option<i64>>(4)?,
            ))
        },
    )?;
    let mut points = Vec::new();
    let mut previous_elapsed_milliseconds = None;
    for row in rows {
        let (ordinal, latitude_degrees, longitude_degrees, altitude_meters, elapsed_milliseconds) =
            row?;
        let ordinal = persisted_count(ordinal, "training_route_point.ordinal")?;
        if ordinal != points.len() {
            return Err(ImportError::InvalidTrainingLibrary(
                "training route point ordinals are not contiguous".to_owned(),
            ));
        }
        if !latitude_degrees.is_finite()
            || !(-90.0..=90.0).contains(&latitude_degrees)
            || !longitude_degrees.is_finite()
            || !(-180.0..=180.0).contains(&longitude_degrees)
            || altitude_meters.is_some_and(|value| !value.is_finite())
            || elapsed_milliseconds.is_some_and(|value| value < 0)
            || previous_elapsed_milliseconds
                .zip(elapsed_milliseconds)
                .is_some_and(|(previous, current)| current < previous)
        {
            return Err(ImportError::InvalidTrainingLibrary(
                "training route point evidence is invalid".to_owned(),
            ));
        }
        if elapsed_milliseconds.is_some() {
            previous_elapsed_milliseconds = elapsed_milliseconds;
        }
        points.push(TrainingRoutePoint {
            ordinal,
            latitude_degrees,
            longitude_degrees,
            altitude_meters,
            elapsed_milliseconds,
        });
    }
    if points.len() != point_count
        || points
            .iter()
            .filter(|point| point.altitude_meters.is_some())
            .count()
            != altitude_point_count
        || points
            .iter()
            .filter(|point| point.elapsed_milliseconds.is_some())
            .count()
            != elapsed_point_count
    {
        return Err(ImportError::InvalidTrainingLibrary(
            "training route point counts are inconsistent".to_owned(),
        ));
    }
    Ok(Some(TrainingRoute {
        kind,
        started_at_local,
        points,
    }))
}

fn query_training_session_routes_on(
    connection: &Connection,
    origin_id: &str,
    session_id: &str,
) -> Result<Option<TrainingSessionRouteAssessment>> {
    let exercises_present = connection
        .query_row(
            "SELECT exercises_present FROM training_session_route_assessment
             WHERE origin_id = ?1 AND session_id = ?2",
            params![origin_id, session_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()?;
    let Some(exercises_present) = exercises_present else {
        return Ok(None);
    };
    if !persisted_training_flag(exercises_present, "route exercises_present")? {
        return Ok(Some(TrainingSessionRouteAssessment { exercises: None }));
    }
    let mut statement = connection.prepare(
        "SELECT exercise_id, ordinal, routes_present
         FROM training_exercise_route_assessment
         WHERE origin_id = ?1 AND session_id = ?2
         ORDER BY ordinal",
    )?;
    let rows = statement.query_map(params![origin_id, session_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, i64>(2)?,
        ))
    })?;
    let mut exercises = Vec::new();
    for row in rows {
        let (exercise_id, ordinal, routes_present) = row?;
        let ordinal = persisted_count(ordinal, "training exercise route ordinal")?;
        if ordinal != exercises.len() {
            return Err(ImportError::InvalidTrainingLibrary(
                "training exercise route ordinals are not contiguous".to_owned(),
            ));
        }
        let routes = persisted_training_flag(routes_present, "routes_present")?
            .then(|| -> Result<_> {
                Ok(TrainingRoutes {
                    primary: query_training_route_on(
                        connection,
                        origin_id,
                        session_id,
                        &exercise_id,
                        TrainingRouteKind::Primary,
                    )?,
                    transition: query_training_route_on(
                        connection,
                        origin_id,
                        session_id,
                        &exercise_id,
                        TrainingRouteKind::Transition,
                    )?,
                })
            })
            .transpose()?;
        exercises.push(TrainingExerciseRouteAssessment {
            exercise_id,
            ordinal,
            routes,
        });
    }
    Ok(Some(TrainingSessionRouteAssessment {
        exercises: Some(exercises),
    }))
}

fn training_signal_role_code(role: TrainingSignalRoleView) -> &'static str {
    match role {
        TrainingSignalRoleView::Primary => "primary",
        TrainingSignalRoleView::Transition => "transition",
    }
}

fn training_signal_kind_code(kind: TrainingSignalKind) -> &'static str {
    match kind {
        TrainingSignalKind::HeartRate => "heart-rate",
        TrainingSignalKind::Speed => "speed",
        TrainingSignalKind::Distance => "distance",
        TrainingSignalKind::Altitude => "altitude",
        TrainingSignalKind::Cadence => "cadence",
        TrainingSignalKind::Temperature => "temperature",
        TrainingSignalKind::LeftCrankPower => "left-crank-power",
    }
}

fn training_signal_unit_code(unit: TrainingSignalUnit) -> &'static str {
    match unit {
        TrainingSignalUnit::BeatsPerMinute => "beats-per-minute",
        TrainingSignalUnit::KilometersPerHour => "kilometers-per-hour",
        TrainingSignalUnit::Meters => "meters",
        TrainingSignalUnit::RotationsPerMinute => "rotations-per-minute",
        TrainingSignalUnit::DegreesCelsius => "degrees-celsius",
        TrainingSignalUnit::Watts => "watts",
    }
}

fn training_signal_kind_and_unit(
    kind: &str,
    unit: &str,
) -> Result<(TrainingSignalKind, TrainingSignalUnit)> {
    match (kind, unit) {
        ("heart-rate", "beats-per-minute") => Ok((
            TrainingSignalKind::HeartRate,
            TrainingSignalUnit::BeatsPerMinute,
        )),
        ("speed", "kilometers-per-hour") => Ok((
            TrainingSignalKind::Speed,
            TrainingSignalUnit::KilometersPerHour,
        )),
        ("distance", "meters") => Ok((TrainingSignalKind::Distance, TrainingSignalUnit::Meters)),
        ("altitude", "meters") => Ok((TrainingSignalKind::Altitude, TrainingSignalUnit::Meters)),
        ("cadence", "rotations-per-minute") => Ok((
            TrainingSignalKind::Cadence,
            TrainingSignalUnit::RotationsPerMinute,
        )),
        ("temperature", "degrees-celsius") => Ok((
            TrainingSignalKind::Temperature,
            TrainingSignalUnit::DegreesCelsius,
        )),
        ("left-crank-power", "watts") => Ok((
            TrainingSignalKind::LeftCrankPower,
            TrainingSignalUnit::Watts,
        )),
        _ => Err(ImportError::InvalidTrainingLibrary(
            "training signal kind and unit are inconsistent".to_owned(),
        )),
    }
}

fn query_training_signal_collection_on(
    connection: &Connection,
    origin_id: &str,
    session_id: &str,
    exercise_id: &str,
    role: TrainingSignalRoleView,
) -> Result<Vec<TrainingSignalSeries>> {
    let role_code = training_signal_role_code(role);
    let mut statement = connection.prepare(
        "SELECT series_id, ordinal, kind, unit, interval_milliseconds, sample_count,
                available_sample_count
         FROM training_signal_series
         WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3 AND role = ?4
         ORDER BY ordinal",
    )?;
    let rows = statement.query_map(
        params![origin_id, session_id, exercise_id, role_code],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
            ))
        },
    )?;
    let mut series = Vec::new();
    for row in rows {
        let (
            series_id,
            ordinal,
            kind,
            unit,
            interval_milliseconds,
            sample_count,
            available_sample_count,
        ) = row?;
        let ordinal = persisted_count(ordinal, "training_signal_series.ordinal")?;
        let sample_count = persisted_count(sample_count, "training_signal_series.sample_count")?;
        let available_sample_count = persisted_count(
            available_sample_count,
            "training_signal_series.available_sample_count",
        )?;
        if ordinal != series.len()
            || interval_milliseconds <= 0
            || available_sample_count > sample_count
        {
            return Err(ImportError::InvalidTrainingLibrary(
                "training signal series metadata is inconsistent".to_owned(),
            ));
        }
        let (kind, unit) = training_signal_kind_and_unit(&kind, &unit)?;
        let mut sample_statement = connection.prepare(
            "SELECT ordinal, value
             FROM training_signal_sample
             WHERE series_id = ?1
             ORDER BY ordinal",
        )?;
        let sample_rows = sample_statement.query_map(params![series_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, Option<f64>>(1)?))
        })?;
        let mut samples = Vec::new();
        for sample_row in sample_rows {
            let (sample_ordinal, value) = sample_row?;
            let sample_ordinal = persisted_count(sample_ordinal, "training_signal_sample.ordinal")?;
            if sample_ordinal != samples.len()
                || value.is_some_and(|value| {
                    !value.is_finite()
                        || (!matches!(
                            kind,
                            TrainingSignalKind::Altitude | TrainingSignalKind::Temperature
                        ) && value < 0.0)
                })
                || i64::try_from(sample_ordinal)
                    .ok()
                    .and_then(|value| value.checked_mul(interval_milliseconds))
                    .is_none()
            {
                return Err(ImportError::InvalidTrainingLibrary(
                    "training signal samples are invalid".to_owned(),
                ));
            }
            samples.push(TrainingSignalSample {
                ordinal: sample_ordinal,
                value,
            });
        }
        if samples.len() != sample_count
            || samples
                .iter()
                .filter(|sample| sample.value.is_some())
                .count()
                != available_sample_count
        {
            return Err(ImportError::InvalidTrainingLibrary(
                "training signal sample counts are inconsistent".to_owned(),
            ));
        }
        series.push(TrainingSignalSeries {
            ordinal,
            kind,
            unit,
            interval_milliseconds,
            samples,
        });
    }
    Ok(series)
}

fn query_training_session_signals_on(
    connection: &Connection,
    origin_id: &str,
    session_id: &str,
) -> Result<Option<TrainingSessionSignalAssessment>> {
    let exercises_present = connection
        .query_row(
            "SELECT exercises_present FROM training_session_signal_assessment
             WHERE origin_id = ?1 AND session_id = ?2",
            params![origin_id, session_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()?;
    let Some(exercises_present) = exercises_present else {
        return Ok(None);
    };
    if !persisted_training_flag(exercises_present, "signal exercises_present")? {
        return Ok(Some(TrainingSessionSignalAssessment { exercises: None }));
    }
    let mut statement = connection.prepare(
        "SELECT exercise_id, ordinal, signals_present, primary_present,
                transition_present, unsupported_primary_series_count,
                unsupported_transition_series_count
         FROM training_exercise_signal_assessment
         WHERE origin_id = ?1 AND session_id = ?2
         ORDER BY ordinal",
    )?;
    let rows = statement.query_map(params![origin_id, session_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, i64>(3)?,
            row.get::<_, i64>(4)?,
            row.get::<_, i64>(5)?,
            row.get::<_, i64>(6)?,
        ))
    })?;
    let mut exercises = Vec::new();
    for row in rows {
        let (
            exercise_id,
            ordinal,
            signals_present,
            primary_present,
            transition_present,
            unsupported_primary_series_count,
            unsupported_transition_series_count,
        ) = row?;
        let ordinal = persisted_count(ordinal, "training exercise signal ordinal")?;
        if ordinal != exercises.len() {
            return Err(ImportError::InvalidTrainingLibrary(
                "training exercise signal ordinals are not contiguous".to_owned(),
            ));
        }
        let signals = if persisted_training_flag(signals_present, "signals_present")? {
            let primary_present = persisted_training_flag(primary_present, "primary_present")?;
            let transition_present =
                persisted_training_flag(transition_present, "transition_present")?;
            Some(TrainingSignals {
                primary: primary_present
                    .then(|| {
                        query_training_signal_collection_on(
                            connection,
                            origin_id,
                            session_id,
                            &exercise_id,
                            TrainingSignalRoleView::Primary,
                        )
                    })
                    .transpose()?,
                transition: transition_present
                    .then(|| {
                        query_training_signal_collection_on(
                            connection,
                            origin_id,
                            session_id,
                            &exercise_id,
                            TrainingSignalRoleView::Transition,
                        )
                    })
                    .transpose()?,
                unsupported_primary_series_count: persisted_count(
                    unsupported_primary_series_count,
                    "unsupported_primary_series_count",
                )?,
                unsupported_transition_series_count: persisted_count(
                    unsupported_transition_series_count,
                    "unsupported_transition_series_count",
                )?,
            })
        } else {
            if persisted_training_flag(primary_present, "primary_present")?
                || persisted_training_flag(transition_present, "transition_present")?
                || unsupported_primary_series_count != 0
                || unsupported_transition_series_count != 0
            {
                return Err(ImportError::InvalidTrainingLibrary(
                    "absent signal container has child evidence".to_owned(),
                ));
            }
            None
        };
        exercises.push(TrainingExerciseSignalAssessment {
            exercise_id,
            ordinal,
            signals,
        });
    }
    Ok(Some(TrainingSessionSignalAssessment {
        exercises: Some(exercises),
    }))
}

fn training_zone_kind_code(kind: TrainingZoneKind) -> &'static str {
    match kind {
        TrainingZoneKind::HeartRate => "heart-rate",
        TrainingZoneKind::Speed => "speed",
        TrainingZoneKind::Power => "power",
    }
}

fn training_zone_unit_code(unit: TrainingZoneUnit) -> &'static str {
    match unit {
        TrainingZoneUnit::BeatsPerMinute => "beats-per-minute",
        TrainingZoneUnit::KilometersPerHour => "kilometers-per-hour",
        TrainingZoneUnit::Watts => "watts",
    }
}

fn training_zone_kind_and_unit(
    kind: &str,
    unit: &str,
) -> Result<(TrainingZoneKind, TrainingZoneUnit)> {
    match (kind, unit) {
        ("heart-rate", "beats-per-minute") => Ok((
            TrainingZoneKind::HeartRate,
            TrainingZoneUnit::BeatsPerMinute,
        )),
        ("speed", "kilometers-per-hour") => {
            Ok((TrainingZoneKind::Speed, TrainingZoneUnit::KilometersPerHour))
        }
        ("power", "watts") => Ok((TrainingZoneKind::Power, TrainingZoneUnit::Watts)),
        _ => Err(ImportError::InvalidTrainingLibrary(
            "training zone kind and unit are inconsistent".to_owned(),
        )),
    }
}

fn training_zone_is_valid(zone: &TrainingZone, kind: TrainingZoneKind) -> bool {
    if !zone.lower_limit.is_finite()
        || zone.lower_limit < 0.0
        || !zone.higher_limit.is_finite()
        || zone.higher_limit < zone.lower_limit
        || zone
            .time_in_zone_milliseconds
            .is_some_and(|value| value < 0)
        || zone
            .distance_meters
            .is_some_and(|value| !value.is_finite() || value < 0.0)
        || zone
            .muscle_load
            .is_some_and(|value| !value.is_finite() || value < 0.0)
    {
        return false;
    }
    match kind {
        TrainingZoneKind::HeartRate => zone.distance_meters.is_none() && zone.muscle_load.is_none(),
        TrainingZoneKind::Speed => zone.muscle_load.is_none(),
        TrainingZoneKind::Power => zone.distance_meters.is_none(),
    }
}

fn query_training_zone_group_zones_on(
    connection: &Connection,
    origin_id: &str,
    session_id: &str,
    exercise_id: &str,
    group_ordinal: usize,
    kind: TrainingZoneKind,
) -> Result<Vec<TrainingZone>> {
    let mut statement = connection.prepare(
        "SELECT ordinal, lower_limit, higher_limit, time_in_zone_milliseconds,
                distance_meters, muscle_load
         FROM training_zone
         WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3
           AND group_ordinal = ?4
         ORDER BY ordinal",
    )?;
    let rows = statement.query_map(
        params![origin_id, session_id, exercise_id, group_ordinal],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, f64>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, Option<i64>>(3)?,
                row.get::<_, Option<f64>>(4)?,
                row.get::<_, Option<f64>>(5)?,
            ))
        },
    )?;
    let mut zones = Vec::new();
    for row in rows {
        let (
            ordinal,
            lower_limit,
            higher_limit,
            time_in_zone_milliseconds,
            distance_meters,
            muscle_load,
        ) = row?;
        let zone = TrainingZone {
            ordinal: persisted_count(ordinal, "training zone ordinal")?,
            lower_limit,
            higher_limit,
            time_in_zone_milliseconds,
            distance_meters,
            muscle_load,
        };
        if zone.ordinal != zones.len() || !training_zone_is_valid(&zone, kind) {
            return Err(ImportError::InvalidTrainingLibrary(
                "training zones are invalid".to_owned(),
            ));
        }
        zones.push(zone);
    }
    if zones.len() > 256 {
        return Err(ImportError::InvalidTrainingLibrary(
            "training zone count exceeds the supported bound".to_owned(),
        ));
    }
    Ok(zones)
}

fn query_training_zone_groups_on(
    connection: &Connection,
    origin_id: &str,
    session_id: &str,
    exercise_id: &str,
) -> Result<Vec<TrainingZoneGroup>> {
    let mut statement = connection.prepare(
        "SELECT ordinal, kind, unit, zones_present
         FROM training_zone_group
         WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3
         ORDER BY ordinal",
    )?;
    let rows = statement.query_map(params![origin_id, session_id, exercise_id], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, i64>(3)?,
        ))
    })?;
    let mut groups = Vec::new();
    for row in rows {
        let (ordinal, kind, unit, zones_present) = row?;
        let ordinal = persisted_count(ordinal, "training zone group ordinal")?;
        if ordinal != groups.len() {
            return Err(ImportError::InvalidTrainingLibrary(
                "training zone group ordinals are not contiguous".to_owned(),
            ));
        }
        let (kind, unit) = training_zone_kind_and_unit(&kind, &unit)?;
        let persisted_zones = query_training_zone_group_zones_on(
            connection,
            origin_id,
            session_id,
            exercise_id,
            ordinal,
            kind,
        )?;
        let zones = if persisted_training_flag(zones_present, "zones_present")? {
            Some(persisted_zones)
        } else if persisted_zones.is_empty() {
            None
        } else {
            return Err(ImportError::InvalidTrainingLibrary(
                "absent zone band collection has child evidence".to_owned(),
            ));
        };
        groups.push(TrainingZoneGroup {
            ordinal,
            kind,
            unit,
            zones,
        });
    }
    if groups.len() > 64 {
        return Err(ImportError::InvalidTrainingLibrary(
            "training zone group count exceeds the supported bound".to_owned(),
        ));
    }
    Ok(groups)
}

fn query_training_session_zones_on(
    connection: &Connection,
    origin_id: &str,
    session_id: &str,
) -> Result<Option<TrainingSessionZoneAssessment>> {
    let exercises_present = connection
        .query_row(
            "SELECT exercises_present FROM training_session_zone_assessment
             WHERE origin_id = ?1 AND session_id = ?2",
            params![origin_id, session_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()?;
    let Some(exercises_present) = exercises_present else {
        return Ok(None);
    };
    if !persisted_training_flag(exercises_present, "zone exercises_present")? {
        return Ok(Some(TrainingSessionZoneAssessment { exercises: None }));
    }
    let mut statement = connection.prepare(
        "SELECT exercise_id, ordinal, zones_present, unsupported_group_count
         FROM training_exercise_zone_assessment
         WHERE origin_id = ?1 AND session_id = ?2
         ORDER BY ordinal",
    )?;
    let rows = statement.query_map(params![origin_id, session_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, i64>(3)?,
        ))
    })?;
    let mut exercises = Vec::new();
    for row in rows {
        let (exercise_id, ordinal, zones_present, unsupported_group_count) = row?;
        let ordinal = persisted_count(ordinal, "training exercise zone ordinal")?;
        if ordinal != exercises.len() {
            return Err(ImportError::InvalidTrainingLibrary(
                "training exercise zone ordinals are not contiguous".to_owned(),
            ));
        }
        let groups =
            query_training_zone_groups_on(connection, origin_id, session_id, &exercise_id)?;
        let zones = if persisted_training_flag(zones_present, "zones_present")? {
            Some(TrainingZones {
                groups,
                unsupported_group_count: persisted_count(
                    unsupported_group_count,
                    "unsupported_group_count",
                )?,
            })
        } else if groups.is_empty() && unsupported_group_count == 0 {
            None
        } else {
            return Err(ImportError::InvalidTrainingLibrary(
                "absent zone collection has child evidence".to_owned(),
            ));
        };
        exercises.push(TrainingExerciseZoneAssessment {
            exercise_id,
            ordinal,
            zones,
        });
    }
    Ok(Some(TrainingSessionZoneAssessment {
        exercises: Some(exercises),
    }))
}

fn replace_training_session_structure(
    transaction: &Transaction<'_>,
    record: &TrainingSessionRecord,
) -> Result<()> {
    let summary = &record.summary;
    transaction.execute(
        "DELETE FROM training_pause WHERE origin_id = ?1 AND session_id = ?2",
        params![summary.origin_id, summary.session_id],
    )?;
    transaction.execute(
        "DELETE FROM training_lap WHERE origin_id = ?1 AND session_id = ?2",
        params![summary.origin_id, summary.session_id],
    )?;
    transaction.execute(
        "DELETE FROM training_exercise WHERE origin_id = ?1 AND session_id = ?2",
        params![summary.origin_id, summary.session_id],
    )?;
    transaction.execute(
        "DELETE FROM training_session_structure WHERE origin_id = ?1 AND session_id = ?2",
        params![summary.origin_id, summary.session_id],
    )?;
    let Some(structure) = &record.structure else {
        return Ok(());
    };
    transaction.execute(
        "INSERT INTO training_session_structure (
             origin_id, session_id, exercises_present, mapping_version
         ) VALUES (?1, ?2, ?3, ?4)",
        params![
            summary.origin_id,
            summary.session_id,
            structure.exercises.is_some(),
            TRAINING_SESSION_MAPPING_VERSION,
        ],
    )?;
    let Some(exercises) = &structure.exercises else {
        return Ok(());
    };
    for exercise in exercises {
        transaction.execute(
            "INSERT INTO training_exercise (
                 origin_id, session_id, exercise_id, ordinal, started_at_local,
                 stopped_at_local, utc_offset_minutes, duration_milliseconds,
                 distance_meters, energy_kilocalories, sport_ref,
                 manual_laps_present, automatic_laps_present, pauses_present
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                summary.origin_id,
                summary.session_id,
                exercise.exercise_id,
                exercise.ordinal,
                exercise.started_at_local,
                exercise.stopped_at_local,
                exercise.utc_offset_minutes,
                exercise.duration_milliseconds,
                exercise.distance_meters,
                exercise.energy_kilocalories,
                exercise.sport_ref,
                exercise.manual_laps.is_some(),
                exercise.automatic_laps.is_some(),
                exercise.pauses.is_some(),
            ],
        )?;
        for laps in [&exercise.manual_laps, &exercise.automatic_laps]
            .into_iter()
            .flatten()
        {
            for lap in laps {
                let kind = match lap.kind {
                    TrainingLapKind::Manual => "manual",
                    TrainingLapKind::Automatic => "automatic",
                };
                transaction.execute(
                    "INSERT INTO training_lap (
                         origin_id, session_id, exercise_id, kind, ordinal,
                         split_time_milliseconds, duration_milliseconds, distance_meters
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        summary.origin_id,
                        summary.session_id,
                        exercise.exercise_id,
                        kind,
                        lap.ordinal,
                        lap.split_time_milliseconds,
                        lap.duration_milliseconds,
                        lap.distance_meters,
                    ],
                )?;
            }
        }
        if let Some(pauses) = &exercise.pauses {
            for pause in pauses {
                transaction.execute(
                    "INSERT INTO training_pause (
                         origin_id, session_id, exercise_id, ordinal,
                         started_at_local, ended_at_local
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        summary.origin_id,
                        summary.session_id,
                        exercise.exercise_id,
                        pause.ordinal,
                        pause.started_at_local,
                        pause.ended_at_local,
                    ],
                )?;
            }
        }
    }
    Ok(())
}

fn delete_training_session_routes(
    transaction: &Transaction<'_>,
    summary: &TrainingSession,
) -> Result<()> {
    transaction.execute(
        "DELETE FROM training_route_point WHERE origin_id = ?1 AND session_id = ?2",
        params![summary.origin_id, summary.session_id],
    )?;
    transaction.execute(
        "DELETE FROM training_route WHERE origin_id = ?1 AND session_id = ?2",
        params![summary.origin_id, summary.session_id],
    )?;
    transaction.execute(
        "DELETE FROM training_exercise_route_assessment
         WHERE origin_id = ?1 AND session_id = ?2",
        params![summary.origin_id, summary.session_id],
    )?;
    transaction.execute(
        "DELETE FROM training_session_route_assessment
         WHERE origin_id = ?1 AND session_id = ?2",
        params![summary.origin_id, summary.session_id],
    )?;
    Ok(())
}

fn insert_training_session_routes(
    transaction: &Transaction<'_>,
    record: &TrainingSessionRecord,
) -> Result<()> {
    let summary = &record.summary;
    let Some(assessment) = &record.routes else {
        return Ok(());
    };
    transaction.execute(
        "INSERT INTO training_session_route_assessment (
             origin_id, session_id, exercises_present, mapping_version
         ) VALUES (?1, ?2, ?3, ?4)",
        params![
            summary.origin_id,
            summary.session_id,
            assessment.exercises.is_some(),
            TRAINING_SESSION_MAPPING_VERSION,
        ],
    )?;
    let Some(exercises) = &assessment.exercises else {
        return Ok(());
    };
    for exercise in exercises {
        transaction.execute(
            "INSERT INTO training_exercise_route_assessment (
                 origin_id, session_id, exercise_id, ordinal, routes_present
             ) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                summary.origin_id,
                summary.session_id,
                exercise.exercise_id,
                exercise.ordinal,
                exercise.routes.is_some(),
            ],
        )?;
        let Some(routes) = &exercise.routes else {
            continue;
        };
        for route in [&routes.primary, &routes.transition].into_iter().flatten() {
            let kind = training_route_kind_code(route.kind);
            let point_count = i64::try_from(route.points.len()).map_err(|_| {
                invalid_training_artifact("canonical route", "route point count is too large")
            })?;
            let altitude_point_count = i64::try_from(
                route
                    .points
                    .iter()
                    .filter(|point| point.altitude_meters.is_some())
                    .count(),
            )
            .map_err(|_| {
                invalid_training_artifact("canonical route", "route altitude count is too large")
            })?;
            let elapsed_point_count = i64::try_from(
                route
                    .points
                    .iter()
                    .filter(|point| point.elapsed_milliseconds.is_some())
                    .count(),
            )
            .map_err(|_| {
                invalid_training_artifact("canonical route", "route elapsed count is too large")
            })?;
            transaction.execute(
                "INSERT INTO training_route (
                     origin_id, session_id, exercise_id, kind, started_at_local,
                     point_count, altitude_point_count, elapsed_point_count
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    summary.origin_id,
                    summary.session_id,
                    exercise.exercise_id,
                    kind,
                    route.started_at_local,
                    point_count,
                    altitude_point_count,
                    elapsed_point_count,
                ],
            )?;
            for point in &route.points {
                transaction.execute(
                    "INSERT INTO training_route_point (
                         origin_id, session_id, exercise_id, kind, ordinal,
                         latitude_degrees, longitude_degrees, altitude_meters,
                         elapsed_milliseconds
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        summary.origin_id,
                        summary.session_id,
                        exercise.exercise_id,
                        kind,
                        point.ordinal,
                        point.latitude_degrees,
                        point.longitude_degrees,
                        point.altitude_meters,
                        point.elapsed_milliseconds,
                    ],
                )?;
            }
        }
    }
    Ok(())
}

fn delete_training_session_signals(
    transaction: &Transaction<'_>,
    summary: &TrainingSession,
) -> Result<()> {
    transaction.execute(
        "DELETE FROM training_signal_series WHERE origin_id = ?1 AND session_id = ?2",
        params![summary.origin_id, summary.session_id],
    )?;
    transaction.execute(
        "DELETE FROM training_exercise_signal_assessment
         WHERE origin_id = ?1 AND session_id = ?2",
        params![summary.origin_id, summary.session_id],
    )?;
    transaction.execute(
        "DELETE FROM training_session_signal_assessment
         WHERE origin_id = ?1 AND session_id = ?2",
        params![summary.origin_id, summary.session_id],
    )?;
    Ok(())
}

fn training_signal_unit_matches(kind: TrainingSignalKind, unit: TrainingSignalUnit) -> bool {
    matches!(
        (kind, unit),
        (
            TrainingSignalKind::HeartRate,
            TrainingSignalUnit::BeatsPerMinute
        ) | (
            TrainingSignalKind::Speed,
            TrainingSignalUnit::KilometersPerHour
        ) | (
            TrainingSignalKind::Distance | TrainingSignalKind::Altitude,
            TrainingSignalUnit::Meters
        ) | (
            TrainingSignalKind::Cadence,
            TrainingSignalUnit::RotationsPerMinute
        ) | (
            TrainingSignalKind::Temperature,
            TrainingSignalUnit::DegreesCelsius
        ) | (
            TrainingSignalKind::LeftCrankPower,
            TrainingSignalUnit::Watts
        )
    )
}

fn insert_training_signal_collection(
    transaction: &Transaction<'_>,
    summary: &TrainingSession,
    exercise_id: &str,
    role: &'static str,
    series: &[TrainingSignalSeries],
) -> Result<()> {
    for (ordinal, signal) in series.iter().enumerate() {
        if signal.ordinal != ordinal
            || !training_signal_unit_matches(signal.kind, signal.unit)
            || signal.interval_milliseconds <= 0
        {
            return Err(ImportError::InvalidTrainingLibrary(
                "canonical training signal metadata is invalid".to_owned(),
            ));
        }
        let sample_count = i64::try_from(signal.samples.len()).map_err(|_| {
            invalid_training_artifact("canonical signal", "signal sample count is too large")
        })?;
        let available_sample_count = i64::try_from(
            signal
                .samples
                .iter()
                .filter(|sample| sample.value.is_some())
                .count(),
        )
        .map_err(|_| {
            invalid_training_artifact("canonical signal", "available signal count is too large")
        })?;
        transaction.execute(
            "INSERT INTO training_signal_series (
                 origin_id, session_id, exercise_id, role, ordinal, kind, unit,
                 interval_milliseconds, sample_count, available_sample_count
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                summary.origin_id,
                summary.session_id,
                exercise_id,
                role,
                signal.ordinal,
                training_signal_kind_code(signal.kind),
                training_signal_unit_code(signal.unit),
                signal.interval_milliseconds,
                sample_count,
                available_sample_count,
            ],
        )?;
        let series_id = transaction.last_insert_rowid();
        for (sample_ordinal, sample) in signal.samples.iter().enumerate() {
            if sample.ordinal != sample_ordinal
                || sample.value.is_some_and(|value| {
                    !value.is_finite()
                        || (!matches!(
                            signal.kind,
                            TrainingSignalKind::Altitude | TrainingSignalKind::Temperature
                        ) && value < 0.0)
                })
                || i64::try_from(sample_ordinal)
                    .ok()
                    .and_then(|value| value.checked_mul(signal.interval_milliseconds))
                    .is_none()
            {
                return Err(ImportError::InvalidTrainingLibrary(
                    "canonical training signal sample is invalid".to_owned(),
                ));
            }
            transaction.execute(
                "INSERT INTO training_signal_sample (
                     series_id, ordinal, value
                 ) VALUES (?1, ?2, ?3)",
                params![series_id, sample.ordinal, sample.value],
            )?;
        }
    }
    Ok(())
}

fn insert_training_session_signals(
    transaction: &Transaction<'_>,
    record: &TrainingSessionRecord,
) -> Result<()> {
    let summary = &record.summary;
    let Some(assessment) = &record.signals else {
        return Ok(());
    };
    transaction.execute(
        "INSERT INTO training_session_signal_assessment (
             origin_id, session_id, exercises_present, mapping_version
         ) VALUES (?1, ?2, ?3, ?4)",
        params![
            summary.origin_id,
            summary.session_id,
            assessment.exercises.is_some(),
            TRAINING_SESSION_MAPPING_VERSION,
        ],
    )?;
    let Some(exercises) = &assessment.exercises else {
        return Ok(());
    };
    if record
        .structure
        .as_ref()
        .and_then(|value| value.exercises.as_ref())
        .is_none_or(|structure| {
            structure.len() != exercises.len()
                || structure.iter().zip(exercises).any(|(left, right)| {
                    left.exercise_id != right.exercise_id || left.ordinal != right.ordinal
                })
        })
    {
        return Err(ImportError::InvalidTrainingLibrary(
            "signal and structural exercise identities differ".to_owned(),
        ));
    }
    for exercise in exercises {
        let (primary_present, transition_present, unsupported_primary, unsupported_transition) =
            exercise
                .signals
                .as_ref()
                .map_or((false, false, 0, 0), |signals| {
                    (
                        signals.primary.is_some(),
                        signals.transition.is_some(),
                        signals.unsupported_primary_series_count,
                        signals.unsupported_transition_series_count,
                    )
                });
        transaction.execute(
            "INSERT INTO training_exercise_signal_assessment (
                 origin_id, session_id, exercise_id, ordinal, signals_present,
                 primary_present, transition_present,
                 unsupported_primary_series_count, unsupported_transition_series_count
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                summary.origin_id,
                summary.session_id,
                exercise.exercise_id,
                exercise.ordinal,
                exercise.signals.is_some(),
                primary_present,
                transition_present,
                i64::try_from(unsupported_primary).map_err(|_| invalid_training_artifact(
                    "canonical signal",
                    "unsupported primary signal count is too large",
                ))?,
                i64::try_from(unsupported_transition).map_err(|_| invalid_training_artifact(
                    "canonical signal",
                    "unsupported transition signal count is too large",
                ))?,
            ],
        )?;
        let Some(signals) = &exercise.signals else {
            continue;
        };
        if let Some(primary) = &signals.primary {
            insert_training_signal_collection(
                transaction,
                summary,
                &exercise.exercise_id,
                "primary",
                primary,
            )?;
        }
        if let Some(transition) = &signals.transition {
            insert_training_signal_collection(
                transaction,
                summary,
                &exercise.exercise_id,
                "transition",
                transition,
            )?;
        }
    }
    Ok(())
}

fn delete_training_session_zones(
    transaction: &Transaction<'_>,
    summary: &TrainingSession,
) -> Result<()> {
    transaction.execute(
        "DELETE FROM training_zone WHERE origin_id = ?1 AND session_id = ?2",
        params![summary.origin_id, summary.session_id],
    )?;
    transaction.execute(
        "DELETE FROM training_zone_group WHERE origin_id = ?1 AND session_id = ?2",
        params![summary.origin_id, summary.session_id],
    )?;
    transaction.execute(
        "DELETE FROM training_exercise_zone_assessment
         WHERE origin_id = ?1 AND session_id = ?2",
        params![summary.origin_id, summary.session_id],
    )?;
    transaction.execute(
        "DELETE FROM training_session_zone_assessment
         WHERE origin_id = ?1 AND session_id = ?2",
        params![summary.origin_id, summary.session_id],
    )?;
    Ok(())
}

fn insert_training_session_zones(
    transaction: &Transaction<'_>,
    record: &TrainingSessionRecord,
) -> Result<()> {
    let summary = &record.summary;
    let Some(assessment) = &record.zones else {
        return Ok(());
    };
    transaction.execute(
        "INSERT INTO training_session_zone_assessment (
             origin_id, session_id, exercises_present, mapping_version
         ) VALUES (?1, ?2, ?3, ?4)",
        params![
            summary.origin_id,
            summary.session_id,
            assessment.exercises.is_some(),
            TRAINING_SESSION_MAPPING_VERSION,
        ],
    )?;
    let Some(exercises) = &assessment.exercises else {
        return Ok(());
    };
    if record
        .structure
        .as_ref()
        .and_then(|value| value.exercises.as_ref())
        .is_none_or(|structure| {
            structure.len() != exercises.len()
                || structure.iter().zip(exercises).any(|(left, right)| {
                    left.exercise_id != right.exercise_id || left.ordinal != right.ordinal
                })
        })
    {
        return Err(ImportError::InvalidTrainingLibrary(
            "zone and structural exercise identities differ".to_owned(),
        ));
    }
    for exercise in exercises {
        let unsupported_group_count = exercise
            .zones
            .as_ref()
            .map_or(0, |zones| zones.unsupported_group_count);
        transaction.execute(
            "INSERT INTO training_exercise_zone_assessment (
                 origin_id, session_id, exercise_id, ordinal, zones_present,
                 unsupported_group_count
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                summary.origin_id,
                summary.session_id,
                exercise.exercise_id,
                exercise.ordinal,
                exercise.zones.is_some(),
                i64::try_from(unsupported_group_count).map_err(|_| invalid_training_artifact(
                    "canonical zone",
                    "unsupported zone group count is too large",
                ))?,
            ],
        )?;
        let Some(zones) = &exercise.zones else {
            continue;
        };
        if zones.groups.len() > 64 {
            return Err(ImportError::InvalidTrainingLibrary(
                "canonical zone group count exceeds the supported bound".to_owned(),
            ));
        }
        for (group_ordinal, group) in zones.groups.iter().enumerate() {
            let valid_kind_unit = matches!(
                (group.kind, group.unit),
                (
                    TrainingZoneKind::HeartRate,
                    TrainingZoneUnit::BeatsPerMinute
                ) | (TrainingZoneKind::Speed, TrainingZoneUnit::KilometersPerHour)
                    | (TrainingZoneKind::Power, TrainingZoneUnit::Watts)
            );
            if group.ordinal != group_ordinal || !valid_kind_unit {
                return Err(ImportError::InvalidTrainingLibrary(
                    "canonical zone group is invalid".to_owned(),
                ));
            }
            transaction.execute(
                "INSERT INTO training_zone_group (
                     origin_id, session_id, exercise_id, ordinal, kind, unit,
                     zones_present
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    summary.origin_id,
                    summary.session_id,
                    exercise.exercise_id,
                    group.ordinal,
                    training_zone_kind_code(group.kind),
                    training_zone_unit_code(group.unit),
                    group.zones.is_some(),
                ],
            )?;
            let Some(zone_values) = &group.zones else {
                continue;
            };
            if zone_values.len() > 256 {
                return Err(ImportError::InvalidTrainingLibrary(
                    "canonical zone count exceeds the supported bound".to_owned(),
                ));
            }
            for (zone_ordinal, zone) in zone_values.iter().enumerate() {
                if zone.ordinal != zone_ordinal || !training_zone_is_valid(zone, group.kind) {
                    return Err(ImportError::InvalidTrainingLibrary(
                        "canonical zone is invalid".to_owned(),
                    ));
                }
                transaction.execute(
                    "INSERT INTO training_zone (
                         origin_id, session_id, exercise_id, group_ordinal, ordinal,
                         lower_limit, higher_limit, time_in_zone_milliseconds,
                         distance_meters, muscle_load
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    params![
                        summary.origin_id,
                        summary.session_id,
                        exercise.exercise_id,
                        group.ordinal,
                        zone.ordinal,
                        zone.lower_limit,
                        zone.higher_limit,
                        zone.time_in_zone_milliseconds,
                        zone.distance_meters,
                        zone.muscle_load,
                    ],
                )?;
            }
        }
    }
    Ok(())
}

fn replace_training_session_evidence(
    transaction: &Transaction<'_>,
    record: &TrainingSessionRecord,
) -> Result<()> {
    delete_training_session_zones(transaction, &record.summary)?;
    delete_training_session_signals(transaction, &record.summary)?;
    delete_training_session_routes(transaction, &record.summary)?;
    replace_training_session_structure(transaction, record)?;
    insert_training_session_routes(transaction, record)?;
    insert_training_session_signals(transaction, record)?;
    insert_training_session_zones(transaction, record)
}

fn reconcile_training_session(
    transaction: &Transaction<'_>,
    operation_id: i64,
    artifact: &MappedTrainingArtifact,
    report: &mut ImportReport,
) -> Result<()> {
    let incoming = &artifact.observation;
    let incoming_summary = &incoming.summary;
    let existing = transaction
        .query_row(
            "SELECT source_modified_at_utc, started_at_local, stopped_at_local,
                    utc_offset_minutes, duration_milliseconds, distance_meters,
                    energy_kilocalories, average_heart_rate_bpm, maximum_heart_rate_bpm,
                    sport_ref, exercise_count
             FROM training_session
             WHERE origin_id = ?1 AND session_id = ?2",
            params![incoming_summary.origin_id, incoming_summary.session_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    TrainingSession {
                        origin_id: incoming_summary.origin_id.clone(),
                        session_id: incoming_summary.session_id.clone(),
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
    let existing = existing
        .map(|(source_modified_at_utc, summary)| -> Result<_> {
            Ok((
                source_modified_at_utc,
                TrainingSessionRecord {
                    structure: query_training_session_structure_on(
                        transaction,
                        &summary.origin_id,
                        &summary.session_id,
                    )?,
                    routes: query_training_session_routes_on(
                        transaction,
                        &summary.origin_id,
                        &summary.session_id,
                    )?,
                    signals: query_training_session_signals_on(
                        transaction,
                        &summary.origin_id,
                        &summary.session_id,
                    )?,
                    zones: query_training_session_zones_on(
                        transaction,
                        &summary.origin_id,
                        &summary.session_id,
                    )?,
                    summary,
                },
            ))
        })
        .transpose()?;
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
    let decision = decide_training_session_record_reconciliation(
        existing.as_ref().map(|value| &value.1),
        incoming,
        revision_order,
    );
    let exercise_count = incoming_summary
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
                    incoming_summary.origin_id,
                    incoming_summary.session_id,
                    artifact.source_modified_at_utc,
                    incoming_summary.started_at_local,
                    incoming_summary.stopped_at_local,
                    incoming_summary.utc_offset_minutes,
                    incoming_summary.duration_milliseconds,
                    incoming_summary.distance_meters,
                    incoming_summary.energy_kilocalories,
                    incoming_summary.average_heart_rate_bpm,
                    incoming_summary.maximum_heart_rate_bpm,
                    incoming_summary.sport_ref,
                    exercise_count,
                ],
            )?;
            replace_training_session_evidence(transaction, incoming)?;
        }
        ReconciliationDecision::Equivalent | ReconciliationDecision::Preserve => {}
        ReconciliationDecision::Enrich => {
            replace_training_session_evidence(transaction, incoming)?;
        }
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
                    incoming_summary.origin_id,
                    incoming_summary.session_id,
                    artifact.source_modified_at_utc,
                    incoming_summary.started_at_local,
                    incoming_summary.stopped_at_local,
                    incoming_summary.utc_offset_minutes,
                    incoming_summary.duration_milliseconds,
                    incoming_summary.distance_meters,
                    incoming_summary.energy_kilocalories,
                    incoming_summary.average_heart_rate_bpm,
                    incoming_summary.maximum_heart_rate_bpm,
                    incoming_summary.sport_ref,
                    exercise_count,
                ],
            )?;
            replace_training_session_evidence(transaction, incoming)?;
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
                    incoming_summary.origin_id,
                    incoming_summary.session_id,
                    existing_source_modified_at_utc,
                    artifact.source_modified_at_utc,
                    artifact.locator,
                    TRAINING_SESSION_MAPPING_VERSION,
                ],
            )?;
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
            incoming_summary.origin_id,
            incoming_summary.session_id,
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
                    | ReconciliationDecision::Enrich
                    | ReconciliationDecision::Amend
            ),
        ],
    )?;
    match decision {
        ReconciliationDecision::Enrich => reconcile_persisted_training_session_ranges(
            transaction,
            &incoming_summary.origin_id,
            &incoming_summary.session_id,
            TrainingSessionRangeEvidenceCompatibility::Compatible,
        )?,
        ReconciliationDecision::Create | ReconciliationDecision::Amend => {
            reconcile_persisted_training_session_ranges(
                transaction,
                &incoming_summary.origin_id,
                &incoming_summary.session_id,
                TrainingSessionRangeEvidenceCompatibility::Incompatible,
            )?
        }
        ReconciliationDecision::Equivalent
        | ReconciliationDecision::Preserve
        | ReconciliationDecision::Conflict => {}
    }
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

pub struct SqliteReportLibrary {
    database_path: PathBuf,
}

impl SqliteReportLibrary {
    pub fn new(database_path: PathBuf) -> Self {
        Self { database_path }
    }
}

impl ReportDefinitionPort for SqliteReportLibrary {
    fn new_report_ref(&self) -> StandardResult<String, ReportDefinitionPortError> {
        new_report_opaque_ref(&self.database_path, "report-")
    }

    fn new_report_block_ref(&self) -> StandardResult<String, ReportDefinitionPortError> {
        new_report_opaque_ref(&self.database_path, "report-block-")
    }

    fn create_report_definition(
        &self,
        definition: &ReportDefinition,
    ) -> StandardResult<(), ReportDefinitionPortError> {
        let mut connection = open_report_connection(&self.database_path)?;
        let transaction = connection.transaction().map_err(report_database_error)?;
        insert_report_definition(&transaction, definition)?;
        transaction.commit().map_err(report_database_error)
    }

    fn load_report_definition(
        &self,
        report_ref: &str,
    ) -> StandardResult<Option<ReportDefinition>, ReportDefinitionPortError> {
        let connection = open_report_connection(&self.database_path)?;
        load_report_definition_record(&connection, report_ref)
    }

    fn list_report_definitions(
        &self,
    ) -> StandardResult<Vec<ReportDefinition>, ReportDefinitionPortError> {
        let connection = open_report_connection(&self.database_path)?;
        let mut statement = connection
            .prepare(
                "SELECT report_ref
                 FROM report_definition
                 ORDER BY updated_at_utc DESC, report_ref ASC
                 LIMIT 1001",
            )
            .map_err(report_database_error)?;
        let report_refs = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(report_database_error)?
            .collect::<StandardResult<Vec<_>, _>>()
            .map_err(report_database_error)?;
        drop(statement);
        report_refs
            .into_iter()
            .map(|report_ref| {
                load_report_definition_record(&connection, &report_ref)?.ok_or_else(|| {
                    ReportDefinitionPortError::Failure(
                        "listed report definition disappeared".to_owned(),
                    )
                })
            })
            .collect()
    }

    fn compare_and_save_report_definition(
        &self,
        expected_revision: u64,
        definition: &ReportDefinition,
    ) -> StandardResult<bool, ReportDefinitionPortError> {
        let expected_next_revision = expected_revision.checked_add(1).ok_or_else(|| {
            ReportDefinitionPortError::Failure("report revision overflowed".to_owned())
        })?;
        if definition.revision() != expected_next_revision {
            return Err(ReportDefinitionPortError::Failure(
                "saved report revision is not the expected successor".to_owned(),
            ));
        }
        let expected_revision = i64::try_from(expected_revision).map_err(|_| {
            ReportDefinitionPortError::Failure("expected report revision exceeds SQLite".to_owned())
        })?;
        let revision = i64::try_from(definition.revision()).map_err(|_| {
            ReportDefinitionPortError::Failure("report revision exceeds SQLite".to_owned())
        })?;
        let mut connection = open_report_connection(&self.database_path)?;
        let transaction = connection.transaction().map_err(report_database_error)?;
        let origin = report_origin_columns(definition);
        let changed = transaction
            .execute(
                "UPDATE report_definition
                 SET title = ?2,
                     locale = ?3,
                     source_snapshot_ref = ?4,
                     origin_kind = ?5,
                     origin_session_ref = ?6,
                     origin_question_kind = ?7,
                     origin_question_version = ?8,
                     origin_baseline_from = ?9,
                     origin_baseline_through = ?10,
                     origin_comparison_from = ?11,
                     origin_comparison_through = ?12,
                     provenance_policy = ?13,
                     authorship = 'user',
                     definition_version = ?14,
                     revision = ?15,
                     updated_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE report_ref = ?1 AND revision = ?16",
                params![
                    definition.report_ref(),
                    definition.title(),
                    definition.locale().code(),
                    definition.source_snapshot_ref(),
                    origin.kind,
                    origin.session_ref,
                    origin.question_kind,
                    origin.question_version,
                    origin.baseline_from,
                    origin.baseline_through,
                    origin.comparison_from,
                    origin.comparison_through,
                    definition.provenance_policy().code(),
                    i64::from(definition.definition_version()),
                    revision,
                    expected_revision,
                ],
            )
            .map_err(report_database_error)?;
        if changed == 0 {
            transaction.rollback().map_err(report_database_error)?;
            return Ok(false);
        }
        transaction
            .execute(
                "DELETE FROM report_block WHERE report_ref = ?1",
                [definition.report_ref()],
            )
            .map_err(report_database_error)?;
        insert_report_blocks(&transaction, definition)?;
        transaction.commit().map_err(report_database_error)?;
        Ok(true)
    }
}

fn open_report_connection(
    database_path: &Path,
) -> StandardResult<Connection, ReportDefinitionPortError> {
    let connection = Connection::open(database_path).map_err(report_database_error)?;
    ensure_schema(&connection)
        .map_err(|error| ReportDefinitionPortError::Failure(error.to_string()))?;
    Ok(connection)
}

fn new_report_opaque_ref(
    database_path: &Path,
    prefix: &str,
) -> StandardResult<String, ReportDefinitionPortError> {
    let connection = open_report_connection(database_path)?;
    connection
        .query_row("SELECT ?1 || lower(hex(randomblob(32)))", [prefix], |row| {
            row.get(0)
        })
        .map_err(report_database_error)
}

fn insert_report_definition(
    transaction: &Transaction<'_>,
    definition: &ReportDefinition,
) -> StandardResult<(), ReportDefinitionPortError> {
    let revision = i64::try_from(definition.revision()).map_err(|_| {
        ReportDefinitionPortError::Failure("report revision exceeds SQLite".to_owned())
    })?;
    let origin = report_origin_columns(definition);
    transaction
        .execute(
            "INSERT INTO report_definition (
                 report_ref, title, locale, source_snapshot_ref, origin_kind,
                 origin_session_ref, origin_question_kind, origin_question_version,
                 origin_baseline_from, origin_baseline_through, origin_comparison_from,
                 origin_comparison_through, provenance_policy, authorship, definition_version,
                 revision, created_at_utc, updated_at_utc
             ) VALUES (
                 ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
                 ?13, 'user', ?14, ?15,
                 strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                 strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             )",
            params![
                definition.report_ref(),
                definition.title(),
                definition.locale().code(),
                definition.source_snapshot_ref(),
                origin.kind,
                origin.session_ref,
                origin.question_kind,
                origin.question_version,
                origin.baseline_from,
                origin.baseline_through,
                origin.comparison_from,
                origin.comparison_through,
                definition.provenance_policy().code(),
                i64::from(definition.definition_version()),
                revision,
            ],
        )
        .map_err(report_database_error)?;
    insert_report_blocks(transaction, definition)
}

fn insert_report_blocks(
    transaction: &Transaction<'_>,
    definition: &ReportDefinition,
) -> StandardResult<(), ReportDefinitionPortError> {
    for (ordinal, block) in definition.blocks().iter().enumerate() {
        let ordinal = i64::try_from(ordinal).map_err(|_| {
            ReportDefinitionPortError::Failure("report block ordinal exceeds SQLite".to_owned())
        })?;
        match block.content() {
            ReportBlockContent::SessionEvidence {
                session_ref,
                include_physiological_context,
            } => {
                transaction
                    .execute(
                        "INSERT INTO report_block (
                             report_ref, block_ref, ordinal, kind, session_ref,
                             include_physiological_context, narrative_body
                         ) VALUES (?1, ?2, ?3, 'session-evidence', ?4, ?5, NULL)",
                        params![
                            definition.report_ref(),
                            block.block_ref(),
                            ordinal,
                            session_ref,
                            i64::from(*include_physiological_context),
                        ],
                    )
                    .map_err(report_database_error)?;
            }
            ReportBlockContent::Route {
                session_ref,
                route_ref,
                endpoint_redaction_meters,
            } => {
                transaction
                    .execute(
                        "INSERT INTO report_block (
                             report_ref, block_ref, ordinal, kind, session_ref,
                             route_ref, endpoint_redaction_meters
                         ) VALUES (?1, ?2, ?3, 'route', ?4, ?5, ?6)",
                        params![
                            definition.report_ref(),
                            block.block_ref(),
                            ordinal,
                            session_ref,
                            route_ref,
                            i64::from(*endpoint_redaction_meters),
                        ],
                    )
                    .map_err(report_database_error)?;
            }
            ReportBlockContent::Narrative { body } => {
                transaction
                    .execute(
                        "INSERT INTO report_block (
                             report_ref, block_ref, ordinal, kind, session_ref,
                             include_physiological_context, narrative_body
                         ) VALUES (?1, ?2, ?3, 'narrative', NULL, NULL, ?4)",
                        params![definition.report_ref(), block.block_ref(), ordinal, body,],
                    )
                    .map_err(report_database_error)?;
            }
            ReportBlockContent::TrainingFinding { query, metric } => {
                insert_training_comparison_report_block(
                    transaction,
                    definition.report_ref(),
                    block.block_ref(),
                    ordinal,
                    "training-finding",
                    query,
                    Some(*metric),
                )?;
            }
            ReportBlockContent::TrainingComparison { query } => {
                insert_training_comparison_report_block(
                    transaction,
                    definition.report_ref(),
                    block.block_ref(),
                    ordinal,
                    "training-comparison",
                    query,
                    None,
                )?;
            }
            ReportBlockContent::TrainingChart { query, metric } => {
                insert_training_comparison_report_block(
                    transaction,
                    definition.report_ref(),
                    block.block_ref(),
                    ordinal,
                    "training-chart",
                    query,
                    Some(*metric),
                )?;
            }
            ReportBlockContent::TrainingExactTable { query } => {
                insert_training_comparison_report_block(
                    transaction,
                    definition.report_ref(),
                    block.block_ref(),
                    ordinal,
                    "training-exact-table",
                    query,
                    None,
                )?;
            }
            ReportBlockContent::TrainingCoverage { query } => {
                insert_training_comparison_report_block(
                    transaction,
                    definition.report_ref(),
                    block.block_ref(),
                    ordinal,
                    "training-coverage",
                    query,
                    None,
                )?;
            }
        }
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn insert_training_comparison_report_block(
    transaction: &Transaction<'_>,
    report_ref: &str,
    block_ref: &str,
    ordinal: i64,
    kind: &str,
    query: &ReportTrainingComparisonQuery,
    metric: Option<ReportTrainingMetric>,
) -> StandardResult<(), ReportDefinitionPortError> {
    transaction
        .execute(
            "INSERT INTO report_block (
                 report_ref, block_ref, ordinal, kind, question_kind, question_version,
                 baseline_from, baseline_through, comparison_from, comparison_through, metric
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                report_ref,
                block_ref,
                ordinal,
                kind,
                query.question().code(),
                i64::from(query.question().version()),
                query.baseline_range().from(),
                query.baseline_range().through(),
                query.comparison_range().from(),
                query.comparison_range().through(),
                metric.map(ReportTrainingMetric::code),
            ],
        )
        .map_err(report_database_error)?;
    Ok(())
}

struct PersistedReportBlock {
    block_ref: String,
    kind: String,
    session_ref: Option<String>,
    include_physiological_context: Option<i64>,
    route_ref: Option<String>,
    endpoint_redaction_meters: Option<i64>,
    narrative_body: Option<String>,
    question_kind: Option<String>,
    question_version: Option<i64>,
    baseline_from: Option<String>,
    baseline_through: Option<String>,
    comparison_from: Option<String>,
    comparison_through: Option<String>,
    metric: Option<String>,
}

fn load_report_definition_record(
    connection: &Connection,
    report_ref: &str,
) -> StandardResult<Option<ReportDefinition>, ReportDefinitionPortError> {
    let header = connection
        .query_row(
            "SELECT title, locale, source_snapshot_ref, origin_kind, origin_session_ref,
                    origin_question_kind, origin_question_version, origin_baseline_from,
                    origin_baseline_through, origin_comparison_from, origin_comparison_through,
                    provenance_policy, authorship, definition_version, revision
             FROM report_definition
             WHERE report_ref = ?1",
            [report_ref],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, Option<i64>>(6)?,
                    row.get::<_, Option<String>>(7)?,
                    row.get::<_, Option<String>>(8)?,
                    row.get::<_, Option<String>>(9)?,
                    row.get::<_, Option<String>>(10)?,
                    row.get::<_, String>(11)?,
                    row.get::<_, String>(12)?,
                    row.get::<_, i64>(13)?,
                    row.get::<_, i64>(14)?,
                ))
            },
        )
        .optional()
        .map_err(report_database_error)?;
    let Some((
        title,
        locale,
        source_snapshot_ref,
        origin_kind,
        origin_session_ref,
        origin_question_kind,
        origin_question_version,
        origin_baseline_from,
        origin_baseline_through,
        origin_comparison_from,
        origin_comparison_through,
        provenance_policy,
        authorship,
        definition_version,
        revision,
    )) = header
    else {
        return Ok(None);
    };
    if authorship != "user" {
        return Err(invalid_report_record("report header codes are invalid"));
    }
    let origin = restore_report_origin(
        &origin_kind,
        origin_session_ref,
        origin_question_kind,
        origin_question_version,
        origin_baseline_from,
        origin_baseline_through,
        origin_comparison_from,
        origin_comparison_through,
    )?;
    let locale = ReportLocale::from_code(&locale)
        .ok_or_else(|| invalid_report_record("report locale is invalid"))?;
    let provenance_policy = ReportProvenancePolicy::from_code(&provenance_policy)
        .ok_or_else(|| invalid_report_record("report provenance policy is invalid"))?;
    let definition_version = u32::try_from(definition_version)
        .map_err(|_| invalid_report_record("report definition version is invalid"))?;
    let revision =
        u64::try_from(revision).map_err(|_| invalid_report_record("report revision is invalid"))?;
    let mut statement = connection
        .prepare(
            "SELECT block_ref, kind, session_ref, include_physiological_context,
                    route_ref, endpoint_redaction_meters, narrative_body,
                    question_kind, question_version, baseline_from, baseline_through,
                    comparison_from, comparison_through, metric
             FROM report_block
             WHERE report_ref = ?1
             ORDER BY ordinal ASC",
        )
        .map_err(report_database_error)?;
    let persisted_blocks = statement
        .query_map([report_ref], |row| {
            Ok(PersistedReportBlock {
                block_ref: row.get(0)?,
                kind: row.get(1)?,
                session_ref: row.get(2)?,
                include_physiological_context: row.get(3)?,
                route_ref: row.get(4)?,
                endpoint_redaction_meters: row.get(5)?,
                narrative_body: row.get(6)?,
                question_kind: row.get(7)?,
                question_version: row.get(8)?,
                baseline_from: row.get(9)?,
                baseline_through: row.get(10)?,
                comparison_from: row.get(11)?,
                comparison_through: row.get(12)?,
                metric: row.get(13)?,
            })
        })
        .map_err(report_database_error)?
        .collect::<StandardResult<Vec<_>, _>>()
        .map_err(report_database_error)?;
    let blocks = persisted_blocks
        .into_iter()
        .map(|block| {
            let content = match block.kind.as_str() {
                "session-evidence" => ReportBlockContent::SessionEvidence {
                    session_ref: block.session_ref.ok_or_else(|| {
                        invalid_report_record("session report block has no session")
                    })?,
                    include_physiological_context: match block.include_physiological_context {
                        Some(0) => false,
                        Some(1) => true,
                        _ => {
                            return Err(invalid_report_record(
                                "session report block has invalid sensitivity",
                            ));
                        }
                    },
                },
                "route" => ReportBlockContent::Route {
                    session_ref: block.session_ref.ok_or_else(|| {
                        invalid_report_record("route report block has no session")
                    })?,
                    route_ref: block
                        .route_ref
                        .ok_or_else(|| invalid_report_record("route report block has no route"))?,
                    endpoint_redaction_meters: block
                        .endpoint_redaction_meters
                        .and_then(|value| u32::try_from(value).ok())
                        .ok_or_else(|| {
                            invalid_report_record(
                                "route report block has invalid endpoint redaction",
                            )
                        })?,
                },
                "narrative" => ReportBlockContent::Narrative {
                    body: block.narrative_body.ok_or_else(|| {
                        invalid_report_record("narrative report block has no body")
                    })?,
                },
                "training-finding" => ReportBlockContent::TrainingFinding {
                    query: restore_training_comparison_query(&block)?,
                    metric: restore_training_report_metric(&block)?,
                },
                "training-comparison" => ReportBlockContent::TrainingComparison {
                    query: restore_training_comparison_query(&block)?,
                },
                "training-chart" => ReportBlockContent::TrainingChart {
                    query: restore_training_comparison_query(&block)?,
                    metric: restore_training_report_metric(&block)?,
                },
                "training-exact-table" => ReportBlockContent::TrainingExactTable {
                    query: restore_training_comparison_query(&block)?,
                },
                "training-coverage" => ReportBlockContent::TrainingCoverage {
                    query: restore_training_comparison_query(&block)?,
                },
                _ => return Err(invalid_report_record("report block kind is invalid")),
            };
            ReportBlock::restore(block.block_ref, content)
                .map_err(|error| invalid_report_record(&error.to_string()))
        })
        .collect::<StandardResult<Vec<_>, _>>()?;
    ReportDefinition::restore(
        report_ref,
        title,
        locale,
        source_snapshot_ref,
        origin,
        provenance_policy,
        ReportAuthorship::User,
        definition_version,
        revision,
        blocks,
    )
    .map(Some)
    .map_err(|error| invalid_report_record(&error.to_string()))
}

fn restore_training_comparison_query(
    block: &PersistedReportBlock,
) -> StandardResult<ReportTrainingComparisonQuery, ReportDefinitionPortError> {
    let question_kind = block
        .question_kind
        .as_deref()
        .ok_or_else(|| invalid_report_record("training report block has no question"))?;
    let question_version = block
        .question_version
        .and_then(|value| u32::try_from(value).ok())
        .ok_or_else(|| invalid_report_record("training report question version is invalid"))?;
    let range = |from: &Option<String>, through: &Option<String>| {
        ReportDateRange::new(
            from.as_deref()
                .ok_or_else(|| invalid_report_record("training report range has no start"))?,
            through
                .as_deref()
                .ok_or_else(|| invalid_report_record("training report range has no end"))?,
        )
        .map_err(|error| invalid_report_record(&error.to_string()))
    };
    ReportTrainingComparisonQuery::restore(
        question_kind,
        question_version,
        range(&block.baseline_from, &block.baseline_through)?,
        range(&block.comparison_from, &block.comparison_through)?,
    )
    .map_err(|error| invalid_report_record(&error.to_string()))
}

fn restore_training_report_metric(
    block: &PersistedReportBlock,
) -> StandardResult<ReportTrainingMetric, ReportDefinitionPortError> {
    block
        .metric
        .as_deref()
        .and_then(ReportTrainingMetric::from_code)
        .ok_or_else(|| invalid_report_record("training report metric is invalid"))
}

struct ReportOriginColumns<'a> {
    kind: &'static str,
    session_ref: Option<&'a str>,
    question_kind: Option<&'static str>,
    question_version: Option<i64>,
    baseline_from: Option<&'a str>,
    baseline_through: Option<&'a str>,
    comparison_from: Option<&'a str>,
    comparison_through: Option<&'a str>,
}

fn report_origin_columns(definition: &ReportDefinition) -> ReportOriginColumns<'_> {
    match definition.origin() {
        ReportOrigin::Session { session_ref } => ReportOriginColumns {
            kind: "session",
            session_ref: Some(session_ref),
            question_kind: None,
            question_version: None,
            baseline_from: None,
            baseline_through: None,
            comparison_from: None,
            comparison_through: None,
        },
        ReportOrigin::Question { question } => ReportOriginColumns {
            kind: "question",
            session_ref: None,
            question_kind: Some(question.code()),
            question_version: Some(i64::from(question.version())),
            baseline_from: None,
            baseline_through: None,
            comparison_from: None,
            comparison_through: None,
        },
        ReportOrigin::Exploration { query } => ReportOriginColumns {
            kind: "exploration",
            session_ref: None,
            question_kind: Some(query.question().code()),
            question_version: Some(i64::from(query.question().version())),
            baseline_from: Some(query.baseline_range().from()),
            baseline_through: Some(query.baseline_range().through()),
            comparison_from: Some(query.comparison_range().from()),
            comparison_through: Some(query.comparison_range().through()),
        },
        ReportOrigin::Blank => ReportOriginColumns {
            kind: "blank",
            session_ref: None,
            question_kind: None,
            question_version: None,
            baseline_from: None,
            baseline_through: None,
            comparison_from: None,
            comparison_through: None,
        },
    }
}

#[allow(clippy::too_many_arguments)]
fn restore_report_origin(
    kind: &str,
    session_ref: Option<String>,
    question_kind: Option<String>,
    question_version: Option<i64>,
    baseline_from: Option<String>,
    baseline_through: Option<String>,
    comparison_from: Option<String>,
    comparison_through: Option<String>,
) -> StandardResult<ReportOrigin, ReportDefinitionPortError> {
    let no_question = || {
        question_kind.is_none()
            && question_version.is_none()
            && baseline_from.is_none()
            && baseline_through.is_none()
            && comparison_from.is_none()
            && comparison_through.is_none()
    };
    match kind {
        "session" if session_ref.is_some() && no_question() => Ok(ReportOrigin::Session {
            session_ref: session_ref.expect("checked session origin"),
        }),
        "question"
            if session_ref.is_none()
                && baseline_from.is_none()
                && baseline_through.is_none()
                && comparison_from.is_none()
                && comparison_through.is_none() =>
        {
            let version = question_version
                .and_then(|value| u32::try_from(value).ok())
                .ok_or_else(|| invalid_report_record("report origin question is invalid"))?;
            let question = question_kind
                .as_deref()
                .and_then(|code| ReportQuestion::from_code_and_version(code, version))
                .ok_or_else(|| invalid_report_record("report origin question is invalid"))?;
            Ok(ReportOrigin::Question { question })
        }
        "exploration" if session_ref.is_none() => {
            let version = question_version
                .and_then(|value| u32::try_from(value).ok())
                .ok_or_else(|| invalid_report_record("report exploration question is invalid"))?;
            let question_kind = question_kind
                .as_deref()
                .ok_or_else(|| invalid_report_record("report exploration question is invalid"))?;
            let range = |from: Option<String>, through: Option<String>| {
                ReportDateRange::new(
                    from.as_deref().ok_or_else(|| {
                        invalid_report_record("report exploration range has no start")
                    })?,
                    through.as_deref().ok_or_else(|| {
                        invalid_report_record("report exploration range has no end")
                    })?,
                )
                .map_err(|error| invalid_report_record(&error.to_string()))
            };
            let query = ReportTrainingComparisonQuery::restore(
                question_kind,
                version,
                range(baseline_from, baseline_through)?,
                range(comparison_from, comparison_through)?,
            )
            .map_err(|error| invalid_report_record(&error.to_string()))?;
            Ok(ReportOrigin::Exploration { query })
        }
        "blank" if session_ref.is_none() && no_question() => Ok(ReportOrigin::Blank),
        _ => Err(invalid_report_record("report origin is invalid")),
    }
}

fn report_database_error(error: SqliteError) -> ReportDefinitionPortError {
    ReportDefinitionPortError::Failure(error.to_string())
}

fn invalid_report_record(message: &str) -> ReportDefinitionPortError {
    ReportDefinitionPortError::Failure(format!("invalid persisted report definition: {message}"))
}

impl TrainingLibraryPort for SqliteTrainingLibrary {
    fn training_snapshot_ref(&self) -> std::result::Result<Option<String>, String> {
        let connection =
            Connection::open(&self.database_path).map_err(|error| error.to_string())?;
        ensure_schema(&connection).map_err(|error| error.to_string())?;
        let revision = connection
            .query_row(
                "SELECT revision FROM training_discovery_revision WHERE id = 1",
                [],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| error.to_string())?;
        if revision < 1 {
            return Err("training discovery revision is invalid".to_owned());
        }
        Ok(Some(training_snapshot_ref(revision)))
    }

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

impl TrainingSessionDiscoveryPort for SqliteTrainingLibrary {
    fn query_training_sessions(
        &self,
        request: &TrainingSessionSearchRequest,
    ) -> std::result::Result<PersistedTrainingSessionSearchPage, TrainingSessionDiscoveryPortError>
    {
        query_training_session_discovery(&self.database_path, request)
    }

    fn query_training_calendar(
        &self,
        request: &TrainingSessionCalendarRequest,
    ) -> std::result::Result<PersistedTrainingSessionCalendar, TrainingSessionDiscoveryPortError>
    {
        query_training_calendar_discovery(&self.database_path, request)
    }

    fn query_training_session_selection(
        &self,
        request: &TrainingSessionSelectionRequest,
    ) -> std::result::Result<PersistedTrainingSessionSelection, TrainingSessionDiscoveryPortError>
    {
        query_training_session_selection_discovery(&self.database_path, request)
    }
}

impl TrainingSessionStructurePort for SqliteTrainingLibrary {
    fn query_training_session_structure(
        &self,
        query: &TrainingSessionStructureQuery,
    ) -> std::result::Result<PersistedTrainingSessionStructure, TrainingSessionStructurePortError>
    {
        query_training_session_structure_discovery(&self.database_path, query)
    }
}

impl TrainingSessionRoutePort for SqliteTrainingLibrary {
    fn query_training_session_routes(
        &self,
        query: &TrainingSessionRouteQuery,
    ) -> std::result::Result<PersistedTrainingSessionRoutes, TrainingSessionRoutePortError> {
        query_training_session_routes_discovery(&self.database_path, query)
    }

    fn query_training_route_points(
        &self,
        query: &TrainingRoutePointsQuery,
    ) -> std::result::Result<PersistedTrainingRoutePoints, TrainingSessionRoutePortError> {
        query_training_route_points_discovery(&self.database_path, query)
    }
}

impl TrainingSessionSignalPort for SqliteTrainingLibrary {
    fn query_training_session_signals(
        &self,
        query: &TrainingSessionSignalsQuery,
    ) -> std::result::Result<PersistedTrainingSessionSignals, TrainingSessionSignalPortError> {
        query_training_session_signals_discovery(&self.database_path, query)
    }

    fn query_training_signal_samples(
        &self,
        query: &TrainingSignalSamplesQuery,
    ) -> std::result::Result<PersistedTrainingSignalSamples, TrainingSessionSignalPortError> {
        query_training_signal_samples_discovery(&self.database_path, query)
    }
}

impl TrainingSessionZonePort for SqliteTrainingLibrary {
    fn query_training_session_zones(
        &self,
        query: &TrainingSessionZonesQuery,
    ) -> std::result::Result<PersistedTrainingSessionZones, TrainingSessionZonePortError> {
        query_training_session_zones_discovery(&self.database_path, query)
    }
}

impl TrainingSessionProvenancePort for SqliteTrainingLibrary {
    fn query_training_session_provenance(
        &self,
        query: &TrainingSessionProvenanceQuery,
    ) -> std::result::Result<PersistedTrainingSessionProvenance, TrainingSessionProvenancePortError>
    {
        query_training_session_provenance_discovery(&self.database_path, query)
    }
}

impl TrainingSegmentationPort for SqliteTrainingLibrary {
    fn query_training_session_segmentation(
        &self,
        query: &TrainingSessionSegmentationQuery,
    ) -> std::result::Result<PersistedTrainingSessionSegmentation, TrainingSegmentationPortError>
    {
        query_training_session_segmentation_discovery(&self.database_path, query)
    }

    fn visit_segment_signal_samples(
        &self,
        snapshot_ref: &str,
        session_ref: &str,
        signal_ref: &str,
        visitor: &mut dyn FnMut(SegmentSignalSample) -> std::result::Result<(), String>,
    ) -> std::result::Result<(), TrainingSegmentationPortError> {
        visit_training_segment_signal_samples(
            &self.database_path,
            snapshot_ref,
            session_ref,
            signal_ref,
            visitor,
        )
    }

    fn new_segment_criterion_id(
        &self,
    ) -> std::result::Result<String, TrainingSegmentationPortError> {
        new_segment_criterion_id(&self.database_path)
    }

    fn create_and_apply_segment_criterion(
        &self,
        snapshot_ref: &str,
        session_ref: &str,
        exercise_ref: &str,
        criterion: &SegmentCriterion,
    ) -> std::result::Result<(), TrainingSegmentationPortError> {
        create_and_apply_segment_criterion(
            &self.database_path,
            snapshot_ref,
            session_ref,
            exercise_ref,
            criterion,
        )
    }

    fn compare_and_save_segment_criterion(
        &self,
        expected_revision: u64,
        criterion: &SegmentCriterion,
    ) -> std::result::Result<bool, TrainingSegmentationPortError> {
        compare_and_save_segment_criterion(&self.database_path, expected_revision, criterion)
    }

    fn apply_segment_criterion(
        &self,
        snapshot_ref: &str,
        session_ref: &str,
        exercise_ref: &str,
        criterion_ref: &str,
    ) -> std::result::Result<(), TrainingSegmentationPortError> {
        apply_segment_criterion(
            &self.database_path,
            snapshot_ref,
            session_ref,
            exercise_ref,
            criterion_ref,
        )
    }

    fn remove_segment_criterion(
        &self,
        snapshot_ref: &str,
        session_ref: &str,
        exercise_ref: &str,
        criterion_ref: &str,
    ) -> std::result::Result<(), TrainingSegmentationPortError> {
        remove_segment_criterion(
            &self.database_path,
            snapshot_ref,
            session_ref,
            exercise_ref,
            criterion_ref,
        )
    }

    fn move_segment_criterion(
        &self,
        snapshot_ref: &str,
        session_ref: &str,
        exercise_ref: &str,
        criterion_ref: &str,
        direction: TrainingSegmentCriterionDirection,
    ) -> std::result::Result<(), TrainingSegmentationPortError> {
        move_segment_criterion(
            &self.database_path,
            snapshot_ref,
            session_ref,
            exercise_ref,
            criterion_ref,
            direction,
        )
    }
}

impl TrainingSessionRangePort for SqliteTrainingLibrary {
    fn query_training_session_ranges(
        &self,
        query: &TrainingSessionRangesQuery,
    ) -> StandardResult<PersistedTrainingSessionRanges, TrainingSessionRangePortError> {
        query_training_session_ranges_persistence(&self.database_path, query)
    }

    fn new_training_session_range_id(
        &self,
    ) -> StandardResult<String, TrainingSessionRangePortError> {
        new_training_session_range_id(&self.database_path)
    }

    fn create_training_session_range(
        &self,
        snapshot_ref: &str,
        range: &TrainingSessionRange,
    ) -> StandardResult<PersistedTrainingSessionRanges, TrainingSessionRangePortError> {
        create_training_session_range_persistence(&self.database_path, snapshot_ref, range)
    }

    fn compare_and_save_training_session_range(
        &self,
        snapshot_ref: &str,
        expected_revision: u64,
        range: &TrainingSessionRange,
    ) -> StandardResult<Option<PersistedTrainingSessionRanges>, TrainingSessionRangePortError> {
        compare_and_save_training_session_range_persistence(
            &self.database_path,
            snapshot_ref,
            expected_revision,
            range,
        )
    }

    fn compare_and_remove_training_session_range(
        &self,
        snapshot_ref: &str,
        removal: &RemovedTrainingSessionRange,
    ) -> StandardResult<Option<PersistedTrainingSessionRanges>, TrainingSessionRangePortError> {
        compare_and_remove_training_session_range_persistence(
            &self.database_path,
            snapshot_ref,
            removal,
        )
    }
}

impl TrainingDiscoveryWorkspacePort for SqliteTrainingLibrary {
    fn load_training_discovery_workspace(
        &self,
    ) -> std::result::Result<Option<TrainingDiscoveryWorkspace>, String> {
        load_training_discovery_workspace_record(&self.database_path)
            .map_err(|error| error.to_string())
    }

    fn save_training_discovery_workspace(
        &self,
        workspace: &TrainingDiscoveryWorkspace,
    ) -> std::result::Result<(), String> {
        save_training_discovery_workspace_record(&self.database_path, workspace)
            .map_err(|error| error.to_string())
    }

    fn clear_training_discovery_workspace(&self) -> std::result::Result<(), String> {
        clear_training_discovery_workspace_record(&self.database_path)
            .map_err(|error| error.to_string())
    }
}

pub struct SqliteTrainingSports {
    database_path: PathBuf,
}

impl SqliteTrainingSports {
    pub fn new(database_path: PathBuf) -> Self {
        Self { database_path }
    }
}

impl TrainingSportsPort for SqliteTrainingSports {
    fn query_detected_training_sports(
        &self,
    ) -> std::result::Result<Vec<DetectedTrainingSport>, String> {
        query_detected_training_sports(&self.database_path).map_err(|error| error.to_string())
    }

    fn find_detected_training_sport(
        &self,
        sport_ref: &str,
    ) -> std::result::Result<Option<DetectedTrainingSport>, String> {
        query_detected_training_sports(&self.database_path)
            .map(|sports| {
                sports
                    .into_iter()
                    .find(|sport| sport.sport_ref.as_deref() == Some(sport_ref))
            })
            .map_err(|error| error.to_string())
    }

    fn compare_and_save_sport_classification(
        &self,
        expected_revision: u64,
        classification: &SportClassification,
    ) -> std::result::Result<bool, String> {
        compare_and_save_sport_classification(
            &self.database_path,
            expected_revision,
            classification,
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

pub struct SqliteLibraryHome {
    database_path: PathBuf,
}

impl SqliteLibraryHome {
    pub fn new(database_path: PathBuf) -> Self {
        Self { database_path }
    }
}

impl ActivityLibraryPort for SqliteLibraryHome {
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

impl TrainingLibraryPort for SqliteLibraryHome {
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

impl TrainingSessionDiscoveryPort for SqliteLibraryHome {
    fn query_training_sessions(
        &self,
        request: &TrainingSessionSearchRequest,
    ) -> StandardResult<PersistedTrainingSessionSearchPage, TrainingSessionDiscoveryPortError> {
        SqliteTrainingLibrary::new(self.database_path.clone()).query_training_sessions(request)
    }

    fn query_training_calendar(
        &self,
        request: &TrainingSessionCalendarRequest,
    ) -> StandardResult<PersistedTrainingSessionCalendar, TrainingSessionDiscoveryPortError> {
        SqliteTrainingLibrary::new(self.database_path.clone()).query_training_calendar(request)
    }

    fn query_training_session_selection(
        &self,
        request: &TrainingSessionSelectionRequest,
    ) -> StandardResult<PersistedTrainingSessionSelection, TrainingSessionDiscoveryPortError> {
        SqliteTrainingLibrary::new(self.database_path.clone())
            .query_training_session_selection(request)
    }
}

impl TrainingSportsPort for SqliteLibraryHome {
    fn query_detected_training_sports(&self) -> StandardResult<Vec<DetectedTrainingSport>, String> {
        SqliteTrainingSports::new(self.database_path.clone()).query_detected_training_sports()
    }

    fn find_detected_training_sport(
        &self,
        sport_ref: &str,
    ) -> StandardResult<Option<DetectedTrainingSport>, String> {
        SqliteTrainingSports::new(self.database_path.clone())
            .find_detected_training_sport(sport_ref)
    }

    fn compare_and_save_sport_classification(
        &self,
        expected_revision: u64,
        classification: &SportClassification,
    ) -> StandardResult<bool, String> {
        SqliteTrainingSports::new(self.database_path.clone())
            .compare_and_save_sport_classification(expected_revision, classification)
    }
}

impl SleepLibraryPort for SqliteLibraryHome {
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

impl RecoveryLibraryPort for SqliteLibraryHome {
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

impl ImportOutcomeLibraryPort for SqliteLibraryHome {
    fn latest_import_outcome(&self) -> StandardResult<Option<ImportOutcome>, String> {
        SqliteImportOutcomeLibrary::new(self.database_path.clone()).latest_import_outcome()
    }
}

impl ExplorationWorkspacePort for SqliteLibraryHome {
    fn load_exploration_workspace(
        &self,
    ) -> StandardResult<Option<StoredExplorationWorkspace>, String> {
        load_exploration_workspace_record(&self.database_path).map_err(|error| error.to_string())
    }

    fn save_exploration_workspace(
        &self,
        workspace: &ExplorationWorkspace,
    ) -> StandardResult<(), String> {
        save_exploration_workspace_record(&self.database_path, workspace)
            .map_err(|error| error.to_string())
    }

    fn clear_exploration_workspace(&self) -> StandardResult<(), String> {
        clear_exploration_workspace_record(&self.database_path).map_err(|error| error.to_string())
    }
}

impl LibraryHomeRevisionPort for SqliteLibraryHome {
    fn library_home_revision_ref(&self) -> StandardResult<String, String> {
        query_library_home_revision_ref(&self.database_path).map_err(|error| error.to_string())
    }
}

impl LibraryHomeClockPort for SqliteLibraryHome {
    fn current_local_date(&self) -> StandardResult<String, String> {
        Ok(Local::now().date_naive().format("%Y-%m-%d").to_string())
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

pub struct SqliteApplicationPreferences {
    database_path: PathBuf,
}

impl SqliteApplicationPreferences {
    pub fn new(database_path: PathBuf) -> Self {
        Self { database_path }
    }
}

impl ApplicationPreferencesPort for SqliteApplicationPreferences {
    fn load_preferences(&self) -> StandardResult<Option<StoredApplicationPreferences>, String> {
        load_application_preferences_record(&self.database_path).map_err(|error| error.to_string())
    }

    fn save_preferences(&self, preferences: &ApplicationPreferences) -> StandardResult<(), String> {
        save_application_preferences(&self.database_path, preferences)
            .map_err(|error| error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use fitfreed_domain::{
        author_session_report, refresh_report_definition, revise_report, revise_session_report,
        ReportQuestion,
    };
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

    fn persisted_report_definition() -> ReportDefinition {
        persisted_report_definition_with_seed('1', "Morning progression")
    }

    fn persisted_report_definition_with_seed(seed: char, title: &str) -> ReportDefinition {
        let digest = seed.to_string().repeat(64);
        let narrative_digest = format!(
            "{}{}",
            seed.to_string().repeat(63),
            if seed == '0' { '1' } else { '0' }
        );
        let session_ref = format!("session-{digest}");
        ReportDefinition::create_session_report(
            format!("report-{digest}"),
            title,
            ReportLocale::EnUs,
            format!("training-snapshot-{digest}"),
            ReportBlock::session_evidence(format!("report-block-{digest}"), &session_ref, true)
                .expect("session report block"),
            ReportBlock::narrative(
                format!("report-block-{narrative_digest}"),
                "The final section felt controlled.",
            )
            .expect("narrative report block"),
        )
        .expect("report definition")
    }

    fn persisted_route_report_definition() -> ReportDefinition {
        let session_ref = format!("session-{}", "3".repeat(64));
        ReportDefinition::compose_session_report(
            format!("report-{}", "3".repeat(64)),
            "Routed progression",
            ReportLocale::EnUs,
            format!("training-snapshot-{}", "3".repeat(64)),
            &session_ref,
            vec![
                ReportBlock::narrative(
                    format!("report-block-{}", "4".repeat(64)),
                    "The middle section felt controlled.",
                )
                .expect("narrative block"),
                ReportBlock::route(
                    format!("report-block-{}", "5".repeat(64)),
                    &session_ref,
                    format!("route-{}", "6".repeat(64)),
                    200,
                )
                .expect("route block"),
                ReportBlock::session_evidence(
                    format!("report-block-{}", "7".repeat(64)),
                    &session_ref,
                    false,
                )
                .expect("session block"),
            ],
        )
        .expect("route report definition")
    }

    fn persisted_training_comparison_report_definition() -> ReportDefinition {
        let session_ref = format!("session-{}", "8".repeat(64));
        let query = ReportTrainingComparisonQuery::new(
            ReportDateRange::new("2026-01-01", "2026-01-31").expect("baseline range"),
            ReportDateRange::new("2026-02-01", "2026-02-28").expect("comparison range"),
        );
        ReportDefinition::compose_session_report(
            format!("report-{}", "8".repeat(64)),
            "Winter training comparison",
            ReportLocale::EnUs,
            format!("training-snapshot-{}", "8".repeat(64)),
            &session_ref,
            vec![
                ReportBlock::training_finding(
                    format!("report-block-{}", "9".repeat(64)),
                    query.clone(),
                    ReportTrainingMetric::SessionCount,
                )
                .expect("finding block"),
                ReportBlock::session_evidence(
                    format!("report-block-{}", "a".repeat(64)),
                    &session_ref,
                    false,
                )
                .expect("session block"),
                ReportBlock::training_comparison(
                    format!("report-block-{}", "b".repeat(64)),
                    query.clone(),
                )
                .expect("comparison block"),
                ReportBlock::training_chart(
                    format!("report-block-{}", "c".repeat(64)),
                    query.clone(),
                    ReportTrainingMetric::Duration,
                )
                .expect("chart block"),
                ReportBlock::training_exact_table(
                    format!("report-block-{}", "d".repeat(64)),
                    query.clone(),
                )
                .expect("exact-table block"),
                ReportBlock::training_coverage(format!("report-block-{}", "e".repeat(64)), query)
                    .expect("coverage block"),
                ReportBlock::narrative(
                    format!("report-block-{}", "f".repeat(64)),
                    "The comparison is descriptive, not causal.",
                )
                .expect("narrative block"),
            ],
        )
        .expect("training comparison report definition")
    }

    fn persisted_question_report_definition() -> ReportDefinition {
        let query = ReportTrainingComparisonQuery::new(
            ReportDateRange::new("2026-01-01", "2026-01-31").expect("baseline range"),
            ReportDateRange::new("2026-02-01", "2026-02-28").expect("comparison range"),
        );
        ReportDefinition::compose_report(
            format!("report-{}", "2".repeat(64)),
            "What changed in my training?",
            ReportLocale::EnUs,
            format!("training-snapshot-{}", "2".repeat(64)),
            ReportOrigin::Question {
                question: ReportQuestion::TrainingPeriodComparisonV1,
            },
            vec![
                ReportBlock::training_comparison(format!("report-block-{}", "3".repeat(64)), query)
                    .expect("comparison block"),
                ReportBlock::narrative(
                    format!("report-block-{}", "4".repeat(64)),
                    "The comparison remains descriptive.",
                )
                .expect("narrative block"),
            ],
        )
        .expect("question report definition")
    }

    fn persisted_blank_report_definition() -> ReportDefinition {
        ReportDefinition::compose_report(
            format!("report-{}", "5".repeat(64)),
            "Reusable notes",
            ReportLocale::EsEs,
            format!("training-snapshot-{}", "5".repeat(64)),
            ReportOrigin::Blank,
            vec![ReportBlock::narrative(
                format!("report-block-{}", "6".repeat(64)),
                "Una interpretación propia.",
            )
            .expect("narrative block")],
        )
        .expect("blank report definition")
    }

    fn persisted_exploration_report_definition() -> ReportDefinition {
        let query = ReportTrainingComparisonQuery::new(
            ReportDateRange::new("2026-03-01", "2026-03-31").expect("baseline range"),
            ReportDateRange::new("2026-04-01", "2026-04-30").expect("comparison range"),
        );
        ReportDefinition::compose_report(
            format!("report-{}", "7".repeat(64)),
            "Spring comparison",
            ReportLocale::EnUs,
            format!("training-snapshot-{}", "7".repeat(64)),
            ReportOrigin::Exploration {
                query: query.clone(),
            },
            vec![
                ReportBlock::training_comparison(format!("report-block-{}", "8".repeat(64)), query)
                    .expect("comparison block"),
                ReportBlock::narrative(
                    format!("report-block-{}", "9".repeat(64)),
                    "Saved from the original exploration.",
                )
                .expect("narrative block"),
            ],
        )
        .expect("exploration report definition")
    }

    #[test]
    fn persists_lists_edits_and_retains_report_definitions_across_restart_and_import() {
        let harness = Harness::new();
        let library = SqliteReportLibrary::new(harness.database());
        let report = persisted_report_definition();

        library
            .create_report_definition(&report)
            .expect("persist report definition");
        assert_eq!(
            library
                .load_report_definition(report.report_ref())
                .expect("load report definition"),
            Some(report.clone())
        );
        assert_eq!(
            library
                .list_report_definitions()
                .expect("list report definitions"),
            vec![report.clone()]
        );

        let edited = author_session_report(
            &report,
            "Morning progression reviewed",
            ReportLocale::EsEs,
            false,
            "A conservative interpretation.",
        )
        .expect("edited report definition");
        assert!(library
            .compare_and_save_report_definition(1, &edited)
            .expect("save exact report revision"));
        assert!(!library
            .compare_and_save_report_definition(1, &edited)
            .expect("reject stale report revision"));

        let archive = harness.archive(
            "later-history.zip",
            &[(
                "activity-2026-08-18-11111111-2222-4333-8444-555555555555.json",
                r#"{"date":"2026-08-18","summary":{"stepCount":4200}}"#,
            )],
        );
        import_archive(&harness.database(), &archive, "polar:synthetic").expect("later import");

        let reopened = SqliteReportLibrary::new(harness.database());
        assert_eq!(
            reopened
                .load_report_definition(report.report_ref())
                .expect("reopen report definition"),
            Some(edited)
        );
    }

    #[test]
    fn persists_an_explicit_report_refresh_across_restart() {
        let harness = Harness::new();
        let library = SqliteReportLibrary::new(harness.database());
        let report = persisted_report_definition();
        library
            .create_report_definition(&report)
            .expect("persist report definition");
        let refreshed =
            refresh_report_definition(&report, format!("training-snapshot-{}", "a".repeat(64)))
                .expect("refresh report definition");

        assert!(library
            .compare_and_save_report_definition(report.revision(), &refreshed)
            .expect("persist refreshed definition"));
        drop(library);

        assert_eq!(
            SqliteReportLibrary::new(harness.database())
                .load_report_definition(report.report_ref())
                .expect("reopen refreshed report"),
            Some(refreshed)
        );
    }

    #[test]
    fn persists_reorders_and_reopens_route_report_blocks_without_rewriting_version_one_rows() {
        let harness = Harness::new();
        let library = SqliteReportLibrary::new(harness.database());
        let report = persisted_route_report_definition();
        library
            .create_report_definition(&report)
            .expect("persist route report");

        assert_eq!(
            library
                .load_report_definition(report.report_ref())
                .expect("load route report"),
            Some(report.clone())
        );
        let revised = revise_session_report(
            &report,
            report.title(),
            report.locale(),
            vec![
                report.blocks()[2].clone(),
                ReportBlock::route(
                    report.blocks()[1].block_ref(),
                    report_origin_columns(&report)
                        .session_ref
                        .expect("session report origin"),
                    format!("route-{}", "6".repeat(64)),
                    500,
                )
                .expect("more private route"),
                report.blocks()[0].clone(),
            ],
        )
        .expect("reordered route report");
        assert!(library
            .compare_and_save_report_definition(1, &revised)
            .expect("save reordered route report"));
        assert_eq!(
            SqliteReportLibrary::new(harness.database())
                .load_report_definition(report.report_ref())
                .expect("reopen route report"),
            Some(revised)
        );
    }

    #[test]
    fn persists_and_reopens_every_training_comparison_block_without_copied_results() {
        let harness = Harness::new();
        let library = SqliteReportLibrary::new(harness.database());
        let report = persisted_training_comparison_report_definition();

        library
            .create_report_definition(&report)
            .expect("persist analytical report");
        assert_eq!(
            SqliteReportLibrary::new(harness.database())
                .load_report_definition(report.report_ref())
                .expect("reopen analytical report"),
            Some(report)
        );
        let connection = Connection::open(harness.database()).expect("report database");
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM report_block
                     WHERE question_kind = 'training-period-comparison' AND question_version = 1",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("stored question references"),
            5
        );
        for forbidden_column in [
            "baseline_value",
            "comparison_value",
            "chart_points",
            "finding_text",
        ] {
            assert_eq!(
                connection
                    .query_row(
                        "SELECT COUNT(*) FROM pragma_table_info('report_block') WHERE name = ?1",
                        [forbidden_column],
                        |row| row.get::<_, i64>(0),
                    )
                    .expect("absence of copied result column"),
                0
            );
        }
        assert!(connection
            .execute(
                "UPDATE report_block SET baseline_from = '2026-02-30'
                 WHERE kind = 'training-finding'",
                [],
            )
            .is_err());
        assert!(connection
            .execute(
                "UPDATE report_block
                 SET baseline_from = '2025-01-01', baseline_through = '2026-01-02'
                 WHERE kind = 'training-finding'",
                [],
            )
            .is_err());
    }

    #[test]
    fn persists_reopens_and_revises_question_exploration_and_blank_report_origins() {
        let harness = Harness::new();
        let library = SqliteReportLibrary::new(harness.database());
        let question = persisted_question_report_definition();
        let exploration = persisted_exploration_report_definition();
        let blank = persisted_blank_report_definition();

        library
            .create_report_definition(&question)
            .expect("persist question report");
        library
            .create_report_definition(&exploration)
            .expect("persist exploration report");
        library
            .create_report_definition(&blank)
            .expect("persist blank report");
        assert_eq!(
            library
                .load_report_definition(exploration.report_ref())
                .expect("reopen exploration report"),
            Some(exploration)
        );
        assert_eq!(
            library
                .load_report_definition(question.report_ref())
                .expect("reopen question report"),
            Some(question)
        );
        assert_eq!(
            library
                .load_report_definition(blank.report_ref())
                .expect("reopen blank report"),
            Some(blank.clone())
        );

        let revised = revise_report(
            &blank,
            "Notas reutilizables",
            ReportLocale::EsEs,
            blank.blocks().to_vec(),
        )
        .expect("revise blank report");
        assert!(library
            .compare_and_save_report_definition(1, &revised)
            .expect("save revised blank report"));
        assert_eq!(
            SqliteReportLibrary::new(harness.database())
                .load_report_definition(blank.report_ref())
                .expect("reopen revised blank report"),
            Some(revised)
        );
    }

    #[test]
    fn lists_multiple_reports_by_effective_save_and_rejects_incompatible_rows_non_destructively() {
        let harness = Harness::new();
        let library = SqliteReportLibrary::new(harness.database());
        let older = persisted_report_definition_with_seed('a', "Older report");
        let newer = persisted_report_definition_with_seed('b', "Newer report");
        library
            .create_report_definition(&older)
            .expect("persist older report");
        library
            .create_report_definition(&newer)
            .expect("persist newer report");

        let connection = Connection::open(harness.database()).expect("report database");
        connection
            .execute(
                "UPDATE report_definition
                 SET updated_at_utc = CASE report_ref
                     WHEN ?1 THEN '2026-08-18T08:00:00.000Z'
                     ELSE '2026-08-18T09:00:00.000Z'
                 END",
                [older.report_ref()],
            )
            .expect("stable report ordering evidence");
        assert_eq!(
            library
                .list_report_definitions()
                .expect("ordered report list"),
            vec![newer.clone(), older]
        );

        connection
            .pragma_update(None, "ignore_check_constraints", true)
            .expect("enable incompatible-row fixture");
        connection
            .execute(
                "UPDATE report_definition SET definition_version = 5 WHERE report_ref = ?1",
                [newer.report_ref()],
            )
            .expect("persist incompatible definition fixture");
        connection
            .pragma_update(None, "ignore_check_constraints", false)
            .expect("restore check constraints");

        assert!(matches!(
            library.load_report_definition(newer.report_ref()),
            Err(ReportDefinitionPortError::Failure(message))
                if message.contains("report definition version is unsupported")
        ));
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM report_definition WHERE report_ref = ?1",
                    [newer.report_ref()],
                    |row| row.get::<_, i64>(0),
                )
                .expect("incompatible report remains recoverable"),
            1
        );
    }

    #[test]
    fn upgrades_version_nineteen_with_report_storage_atomically() {
        let harness = Harness::new();
        let connection = Connection::open(harness.database()).expect("database");
        create_schema_baseline(&connection, 19);

        let error = migrate_schema(&connection, true).expect_err("interrupted version twenty");
        assert!(matches!(error, ImportError::InjectedMigrationInterruption));
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_schema
                     WHERE type = 'table' AND name IN ('report_definition', 'report_block')",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("rolled-back report tables"),
            0
        );

        migrate_schema(&connection, false).expect("version twenty migration");
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_schema
                     WHERE type = 'table' AND name IN ('report_definition', 'report_block')",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("report tables"),
            2
        );
        assert_integrity(&connection);
    }

    #[test]
    fn upgrades_version_twenty_reports_losslessly_and_rolls_back_as_one_unit() {
        let harness = Harness::new();
        let database_path = harness.database();
        let connection = Connection::open(&database_path).expect("database");
        create_schema_baseline(&connection, 20);
        let report_ref = format!("report-{}", "1".repeat(64));
        let session_ref = format!("session-{}", "2".repeat(64));
        let snapshot_ref = format!("training-snapshot-{}", "3".repeat(64));
        let session_block_ref = format!("report-block-{}", "4".repeat(64));
        let narrative_block_ref = format!("report-block-{}", "5".repeat(64));
        connection
            .execute(
                "INSERT INTO report_definition (
                     report_ref, title, locale, source_snapshot_ref, origin_kind,
                     origin_session_ref, provenance_policy, authorship, definition_version,
                     revision, created_at_utc, updated_at_utc
                 ) VALUES (?1, 'Version twenty report', 'en-US', ?2, 'session', ?3,
                           'current-attribution', 'user', 1, 1,
                           '2026-08-18T08:00:00.000Z', '2026-08-18T08:00:00.000Z')",
                params![report_ref, snapshot_ref, session_ref],
            )
            .expect("version twenty report header");
        connection
            .execute(
                "INSERT INTO report_block (
                     report_ref, block_ref, ordinal, kind, session_ref,
                     include_physiological_context, narrative_body
                 ) VALUES (?1, ?2, 0, 'session-evidence', ?3, 1, NULL)",
                params![report_ref, session_block_ref, session_ref],
            )
            .expect("version twenty session block");
        connection
            .execute(
                "INSERT INTO report_block (
                     report_ref, block_ref, ordinal, kind, session_ref,
                     include_physiological_context, narrative_body
                 ) VALUES (?1, ?2, 1, 'narrative', NULL, NULL, ?3)",
                params![
                    report_ref,
                    narrative_block_ref,
                    "The final section felt controlled."
                ],
            )
            .expect("version twenty narrative block");

        let error = migrate_schema(&connection, true).expect_err("interrupted version twenty-one");
        assert!(matches!(error, ImportError::InjectedMigrationInterruption));
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("rolled-back schema marker"),
            20
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM pragma_table_info('report_block')
                     WHERE name IN ('route_ref', 'endpoint_redaction_meters')",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("rolled-back route columns"),
            0
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM report_block WHERE report_ref = ?1",
                    [&report_ref],
                    |row| row.get::<_, i64>(0),
                )
                .expect("retained version twenty blocks"),
            2
        );

        migrate_schema(&connection, false).expect("version twenty-one migration");
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("upgraded schema marker"),
            SCHEMA_VERSION
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM pragma_table_info('report_block')
                     WHERE name IN ('route_ref', 'endpoint_redaction_meters')",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("route columns"),
            2
        );
        let reopened = SqliteReportLibrary::new(database_path)
            .load_report_definition(&report_ref)
            .expect("reopen migrated report")
            .expect("migrated report");
        assert_eq!(reopened.definition_version(), 1);
        assert_eq!(reopened.blocks().len(), 2);
        assert_eq!(reopened.title(), "Version twenty report");
        assert_integrity(&connection);
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
    fn builds_the_library_home_from_committed_provider_neutral_history() {
        let harness = Harness::new();
        let sleep_json = basic_sleep_result_json("2026-01-03");
        let recovery_json = complete_nightly_recovery_json("2026-01-04");
        let archive = harness.archive(
            "library-home.zip",
            &[
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"username":"fixture-library-home-claim"}"#,
                ),
                (
                    "activity-2026-01-01-11111111-2222-4333-8444-555555555555.json",
                    r#"{"date":"2026-01-01","summary":{"stepCount":3100}}"#,
                ),
                (
                    "training-session_2026-01-02T10-30-00_42-11111111-2222-4333-8444-555555555555.json",
                    r#"{
                        "identifier":{"id":"synthetic-home-session"},
                        "created":"2026-01-02T12:00:00.000",
                        "modified":"2026-01-02T12:05:00.000",
                        "startTime":"2026-01-02T10:30:00",
                        "stopTime":"2026-01-02T11:30:00",
                        "durationMillis":3600000,
                        "distanceMeters":10000.5,
                        "calories":650,
                        "hrAvg":145,
                        "hrMax":178,
                        "sport":{"id":"synthetic-home-sport"}
                    }"#,
                ),
                (
                    "sleep_result_42-11111111-2222-4333-8444-555555555555.json",
                    &sleep_json,
                ),
                (
                    "nightly_recovery_42-11111111-2222-4333-8444-555555555555.json",
                    &recovery_json,
                ),
            ],
        );

        let report = import_polar_archive(&harness.database(), &archive)
            .expect("representative history import");
        assert_eq!(report.new_observations, 4);
        let outcome = query_latest_import_outcome(&harness.database())
            .expect("import outcome query")
            .expect("committed import outcome");
        let library = SqliteLibraryHome::new(harness.database());

        let home = query_library_home(
            &library,
            LibraryHomeRequest {
                after_import_operation_ref: Some(outcome.operation_ref),
            },
        )
        .expect("library home");

        assert_eq!(
            home.available_range,
            Some(LibraryHomeDateRange {
                from: "2026-01-01".to_owned(),
                through: "2026-01-04".to_owned(),
            })
        );
        assert_eq!(
            home.domains
                .iter()
                .map(|domain| domain.domain)
                .collect::<Vec<_>>(),
            vec![
                LibraryDomain::Training,
                LibraryDomain::Activity,
                LibraryDomain::Sleep,
                LibraryDomain::Recovery,
            ]
        );
        assert_eq!(home.version, 3);
        assert!(home
            .library_revision_ref
            .starts_with("library-home-revision-"));
        let initial_revision = home.library_revision_ref.clone();
        let training = home.training.as_ref().expect("complete training identity");
        assert_eq!(training.session_count, 1);
        assert_eq!(training.sport_profile_count, 1);
        assert_eq!(training.omitted_sport_profile_count, 0);
        assert_eq!(training.sports.len(), 1);
        assert_eq!(training.sports[0].state, TrainingSportState::Unknown);
        let home_sport_ref = training.sports[0]
            .sport_ref
            .clone()
            .expect("safe Home sport reference");
        assert_eq!(training.recent_sessions.len(), 1);
        assert_eq!(
            training.recent_sessions[0].sport_state,
            TrainingSportState::Unknown
        );
        assert_eq!(
            training.recent_sessions[0].sport_ref.as_deref(),
            Some(home_sport_ref.as_str())
        );
        assert!(matches!(
            home.highlight,
            Some(LibraryHomeHighlight::HistoricalTraining(_))
        ));
        assert!(home
            .domains
            .iter()
            .all(|domain| domain.origin_count == 1 && domain.observed_record_count == 1));
        assert_eq!(
            home.questions,
            vec![
                LibraryQuestion::new(
                    LibraryQuestionKind::ExploreTrainingSessions,
                    ExploreDestination::Training,
                ),
                LibraryQuestion::new(
                    LibraryQuestionKind::AlignHistory,
                    ExploreDestination::Longitudinal,
                ),
                LibraryQuestion::new(
                    LibraryQuestionKind::ReviewActivitySteps,
                    ExploreDestination::Activity,
                ),
                LibraryQuestion::new(
                    LibraryQuestionKind::ReviewSleepPatterns,
                    ExploreDestination::Sleep,
                ),
                LibraryQuestion::new(
                    LibraryQuestionKind::ReviewRecoveryPatterns,
                    ExploreDestination::Recovery,
                ),
            ]
        );
        let reveal = home.post_import.expect("matching post-import reveal");
        assert!(!reveal.exact_repeat);
        assert!(reveal.canonical_history_changed);
        assert_eq!(reveal.new_observations, 4);
        assert_eq!(reveal.unchanged_observations, 0);
        assert!(!reveal.source_review_recommended);

        let sports = SqliteTrainingSports::new(harness.database());
        let sport = query_training_sports(&sports)
            .expect("sport discovery")
            .sports
            .into_iter()
            .next()
            .expect("detected sport");
        assert_eq!(sport.sport_ref.as_deref(), Some(home_sport_ref.as_str()));
        save_training_sport_classification(
            &sports,
            SaveSportClassificationRequest {
                sport_ref: sport.sport_ref.expect("editable sport reference"),
                expected_revision: sport
                    .classification
                    .expect("unresolved classification")
                    .revision,
                canonical_family: Some("running".to_owned()),
                display_label: Some("Trail running".to_owned()),
            },
        )
        .expect("authored sport meaning");
        let classified_home = query_library_home(&library, LibraryHomeRequest::default())
            .expect("Home after sport classification");
        assert_ne!(classified_home.library_revision_ref, initial_revision);
        let classified_training = classified_home
            .training
            .expect("classified training identity");
        assert_eq!(
            classified_training.sports[0].canonical_family.as_deref(),
            Some("running")
        );
        assert_eq!(
            classified_training.recent_sessions[0]
                .display_label
                .as_deref(),
            Some("Trail running")
        );
        let classified_revision = classified_home.library_revision_ref;

        save_exploration_workspace(&library, ExploreDestination::Training)
            .expect("persist training workspace");
        let reopened = SqliteLibraryHome::new(harness.database());
        assert_eq!(
            query_library_home(&reopened, LibraryHomeRequest::default())
                .expect("reopened coherent Home")
                .library_revision_ref,
            classified_revision
        );
        assert_eq!(
            query_library_home(&reopened, LibraryHomeRequest::default())
                .expect("reopened library home")
                .resumable_exploration
                .expect("persisted workspace")
                .destination,
            ExploreDestination::Training
        );
        clear_exploration_workspace(&reopened).expect("clear persisted workspace");
        assert_eq!(
            query_library_home(&reopened, LibraryHomeRequest::default())
                .expect("home after cleared workspace")
                .resumable_exploration,
            None
        );
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
    fn imports_structure_routes_and_supported_signals_without_persisting_unknown_series() {
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
                        "created":"2026-01-02T12:00:00.000",
                        "modified":"2026-01-02T12:05:00.000",
                        "startTime":"2026-01-02T10:30:00",
                        "stopTime":"2026-01-02T11:30:00",
                        "timezoneOffsetMinutes":60,
                        "durationMillis":3600000,
                        "distanceMeters":10000.5,
                        "calories":650,
                        "sport":{"id":"synthetic-exercise-sport"},
                        "laps":{
                            "laps":[{"splitTimeMillis":0,"durationMillis":1800000}],
                            "autoLaps":[
                                {"splitTimeMillis":0,"durationMillis":900000,"distanceMeters":2500}
                            ]
                        },
                        "pauseTimes":[{
                            "startTime":"2026-01-02T10:50:00",
                            "endTime":"2026-01-02T10:51:00"
                        }],
                        "routes":{
                            "route":{
                                "startTime":"2026-01-02T10:30:00",
                                "wayPoints":[
                                    {"latitude":40.00,"longitude":-3.00,"altitude":650.0,"elapsedMillis":0},
                                    {"latitude":40.01,"longitude":-3.01,"elapsedMillis":1000},
                                    {"latitude":40.02,"longitude":-3.02,"altitude":652.0,"elapsedMillis":2000},
                                    {"latitude":40.03,"longitude":-3.03,"altitude":653.0},
                                    {"latitude":40.04,"longitude":-3.04,"altitude":654.0,"elapsedMillis":4000}
                                ]
                            },
                            "transitionRoute":{
                                "startTime":"2026-01-02T11:25:00",
                                "wayPoints":[
                                    {"latitude":41.00,"longitude":-4.00,"elapsedMillis":0},
                                    {"latitude":41.01,"longitude":-4.01,"elapsedMillis":500}
                                ]
                            }
                        },
                        "samples":{
                            "samples":[
                                {"type":"HEART_RATE","intervalMillis":1000,"values":[120,"NaN",140,145,150]},
                                {"type":"PEDALING_MECHANICS","intervalMillis":1000,"values":[1,2]}
                            ],
                            "transitionSamples":[
                                {"type":"TEMPERATURE","intervalMillis":500,"values":[18.5,18.6]}
                            ],
                            "rrSamples":[800,810]
                        },
                        "zones":[
                            {
                                "type":"ZONE_TYPE_HEART_RATE",
                                "zones":[
                                    {"lowerLimit":120,"higherLimit":139,"inZone":900000},
                                    {"lowerLimit":140,"higherLimit":159}
                                ]
                            },
                            {
                                "type":"ZONE_TYPE_SPEED",
                                "zones":[{
                                    "lowerLimit":8.0,
                                    "higherLimit":10.0,
                                    "inZone":600000,
                                    "distanceMeters":2500.5
                                }]
                            },
                            {
                                "type":"ZONE_TYPE_POWER",
                                "zones":[{
                                    "lowerLimit":180,
                                    "higherLimit":219,
                                    "inZone":300000,
                                    "muscleLoad":42.5
                                }]
                            },
                            {
                                "type":"ZONE_TYPE_FIT_FAT",
                                "zones":[{"higherLimit":1.0}]
                            }
                        ]
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
        let session_ref = training_session_ref(&history[0].origin_id, "synthetic-session");
        let structure_result = query_training_session_structure(
            &library,
            TrainingSessionStructureQuery {
                session_ref: session_ref.clone(),
                snapshot_ref: None,
            },
        )
        .expect("training structure read model");
        let snapshot_ref = structure_result.snapshot_ref.clone();
        let structure = structure_result
            .structure
            .expect("evaluated structure")
            .exercises
            .expect("source exercise collection");
        assert_eq!(structure.len(), 1);
        let exercise = &structure[0];
        assert_eq!(exercise.ordinal, 0);
        assert!(!exercise.exercise_ref.contains("synthetic-exercise"));
        assert_eq!(exercise.sport.state, TrainingSportState::Unknown);
        assert!(exercise
            .sport
            .sport_ref
            .as_deref()
            .is_some_and(|sport_ref| !sport_ref.contains("synthetic-exercise-sport")));
        assert_eq!(exercise.manual_laps.as_ref().unwrap().len(), 1);
        assert_eq!(exercise.automatic_laps.as_ref().unwrap().len(), 1);
        assert_eq!(exercise.pauses.as_ref().unwrap().len(), 1);

        let routes = query_training_session_routes(
            &library,
            TrainingSessionRouteQuery {
                session_ref: session_ref.clone(),
                snapshot_ref: Some(snapshot_ref.clone()),
                max_visual_points: 3,
            },
        )
        .expect("training route overview")
        .routes
        .expect("evaluated routes")
        .exercises
        .expect("route exercise collection");
        assert_eq!(routes.len(), 1);
        assert_eq!(routes[0].exercise_ref, exercise.exercise_ref);
        let route_collection = routes[0].routes.as_ref().expect("route container");
        let primary = route_collection.primary.as_ref().expect("primary route");
        assert_eq!(primary.point_count, 5);
        assert_eq!(primary.altitude_point_count, 4);
        assert_eq!(primary.elapsed_point_count, 4);
        assert_eq!(
            primary
                .visual_points
                .iter()
                .map(|point| point.ordinal)
                .collect::<Vec<_>>(),
            vec![0, 2, 4]
        );
        assert_eq!(
            route_collection
                .transition
                .as_ref()
                .expect("transition route")
                .point_count,
            2
        );
        let exact = query_training_route_points(
            &library,
            TrainingRoutePointsQuery {
                session_ref: session_ref.clone(),
                route_ref: primary.route_ref.clone(),
                snapshot_ref: Some(snapshot_ref.clone()),
                offset: 1,
                limit: 2,
            },
        )
        .expect("exact route page");
        assert_eq!(
            exact
                .points
                .iter()
                .map(|point| point.ordinal)
                .collect::<Vec<_>>(),
            vec![1, 2]
        );
        assert_eq!(exact.next_offset, Some(3));
        assert_eq!(exact.points[0].latitude_degrees, 40.01);

        let signals = query_training_session_signals(
            &library,
            TrainingSessionSignalsQuery {
                session_ref: session_ref.clone(),
                snapshot_ref: Some(snapshot_ref.clone()),
                max_visual_samples: 3,
            },
        )
        .expect("training signal overview")
        .signals
        .expect("evaluated signals")
        .exercises
        .expect("signal exercise collection");
        assert_eq!(signals.len(), 1);
        assert_eq!(signals[0].exercise_ref, exercise.exercise_ref);
        let signal_collection = signals[0].signals.as_ref().expect("signal container");
        assert_eq!(signal_collection.unsupported_primary_series_count, 1);
        assert_eq!(signal_collection.unsupported_transition_series_count, 0);
        let heart_rate = &signal_collection.primary.as_ref().expect("primary signals")[0];
        assert_eq!(heart_rate.sample_count, 5);
        assert_eq!(heart_rate.available_sample_count, 4);
        assert_eq!(
            heart_rate
                .visual_samples
                .iter()
                .map(|sample| (sample.ordinal, sample.value, sample.gap_before))
                .collect::<Vec<_>>(),
            vec![
                (0, Some(120.0), false),
                (2, Some(140.0), true),
                (4, Some(150.0), false)
            ]
        );
        assert_eq!(
            signal_collection
                .transition
                .as_ref()
                .expect("transition signals")[0]
                .sample_count,
            2
        );
        let exact_samples = query_training_signal_samples(
            &library,
            TrainingSignalSamplesQuery {
                session_ref: session_ref.clone(),
                signal_ref: heart_rate.signal_ref.clone(),
                snapshot_ref: Some(snapshot_ref.clone()),
                offset: 1,
                limit: 2,
            },
        )
        .expect("exact signal page");
        assert_eq!(
            exact_samples
                .samples
                .iter()
                .map(|sample| (sample.ordinal, sample.elapsed_milliseconds, sample.value))
                .collect::<Vec<_>>(),
            vec![(1, 1_000, None), (2, 2_000, Some(140.0))]
        );
        assert_eq!(exact_samples.next_offset, Some(3));

        let zones = query_training_session_zones(
            &library,
            TrainingSessionZonesQuery {
                session_ref: session_ref.clone(),
                snapshot_ref: Some(snapshot_ref.clone()),
            },
        )
        .expect("training zone evidence")
        .zones
        .expect("evaluated zones")
        .exercises
        .expect("zone exercise collection");
        assert_eq!(zones.len(), 1);
        assert_eq!(zones[0].exercise_ref, exercise.exercise_ref);
        let zone_collection = zones[0].zones.as_ref().expect("zone collection");
        assert_eq!(zone_collection.unsupported_group_count, 1);
        assert_eq!(zone_collection.groups.len(), 3);
        assert_eq!(
            zone_collection.groups[0].kind,
            TrainingZoneKindView::HeartRate
        );
        let heart_rate_zones = zone_collection.groups[0]
            .zones
            .as_ref()
            .expect("heart-rate zones");
        assert_eq!(heart_rate_zones.len(), 2);
        assert_eq!(heart_rate_zones[1].time_in_zone_milliseconds, None);
        assert_eq!(
            zone_collection.groups[1].zones.as_ref().unwrap()[0].distance_meters,
            Some(2500.5)
        );
        assert_eq!(
            zone_collection.groups[2].zones.as_ref().unwrap()[0].muscle_load,
            Some(42.5)
        );

        let equal_time = create_training_segment_criterion(
            &library,
            CreateTrainingSegmentCriterionRequest {
                session_ref: session_ref.clone(),
                snapshot_ref: snapshot_ref.clone(),
                exercise_ref: exercise.exercise_ref.clone(),
                title: "Thirty-minute halves".to_owned(),
                definition: SegmentCriterionDefinition::EqualElapsedTime {
                    span_milliseconds: 1_800_000,
                },
            },
        )
        .expect("persist equal-time criterion");
        let equal_time_ref = equal_time.available_criteria[0].criterion_id().to_owned();
        assert_eq!(
            equal_time.exercises.as_ref().expect("segment exercises")[0].applied_criteria[0]
                .segments
                .len(),
            2
        );

        let heart_rate = create_training_segment_criterion(
            &library,
            CreateTrainingSegmentCriterionRequest {
                session_ref: session_ref.clone(),
                snapshot_ref: snapshot_ref.clone(),
                exercise_ref: exercise.exercise_ref.clone(),
                title: "Recorded tempo range".to_owned(),
                definition: SegmentCriterionDefinition::HeartRateZone {
                    minimum_beats_per_minute: 140,
                    maximum_beats_per_minute: 150,
                },
            },
        )
        .expect("persist heart-rate criterion");
        let heart_rate_ref = heart_rate
            .available_criteria
            .iter()
            .find(|criterion| criterion.title() == "Recorded tempo range")
            .expect("heart-rate criterion")
            .criterion_id()
            .to_owned();
        let applied =
            &heart_rate.exercises.as_ref().expect("segment exercises")[0].applied_criteria;
        assert_eq!(applied.len(), 2);
        assert_eq!(
            applied[1].applicability,
            SegmentApplicabilityView::Applicable
        );
        assert!(applied[1].has_evidence_gaps);
        assert_eq!(applied[1].segments.len(), 1);
        assert_eq!(
            applied[1].segments[0].started_at_elapsed_milliseconds,
            2_000
        );
        assert_eq!(applied[1].segments[0].ended_at_elapsed_milliseconds, 5_000);

        let moved = move_training_segment_criterion(
            &library,
            MoveTrainingSegmentCriterionRequest {
                mutation: TrainingSegmentCriterionMutationRequest {
                    session_ref: session_ref.clone(),
                    snapshot_ref: snapshot_ref.clone(),
                    exercise_ref: exercise.exercise_ref.clone(),
                    criterion_ref: heart_rate_ref.clone(),
                },
                direction: TrainingSegmentCriterionDirection::Earlier,
            },
        )
        .expect("reorder criteria");
        assert_eq!(
            moved.exercises.as_ref().expect("segment exercises")[0].applied_criteria[0]
                .criterion
                .criterion_id(),
            heart_rate_ref
        );

        let removed = remove_training_segment_criterion(
            &library,
            TrainingSegmentCriterionMutationRequest {
                session_ref: session_ref.clone(),
                snapshot_ref: snapshot_ref.clone(),
                exercise_ref: exercise.exercise_ref.clone(),
                criterion_ref: equal_time_ref.clone(),
            },
        )
        .expect("remove criterion application");
        assert_eq!(
            removed.exercises.as_ref().expect("segment exercises")[0]
                .applied_criteria
                .len(),
            1
        );
        assert_eq!(removed.available_criteria.len(), 2);

        let reapplied = apply_training_segment_criterion(
            &library,
            TrainingSegmentCriterionMutationRequest {
                session_ref: session_ref.clone(),
                snapshot_ref: snapshot_ref.clone(),
                exercise_ref: exercise.exercise_ref.clone(),
                criterion_ref: equal_time_ref.clone(),
            },
        )
        .expect("reuse criterion");
        assert_eq!(
            reapplied.exercises.as_ref().expect("segment exercises")[0]
                .applied_criteria
                .len(),
            2
        );

        let revised = update_training_segment_criterion(
            &library,
            UpdateTrainingSegmentCriterionRequest {
                session_ref: session_ref.clone(),
                snapshot_ref: snapshot_ref.clone(),
                criterion_ref: equal_time_ref,
                expected_revision: 1,
                title: "Twenty-minute thirds".to_owned(),
                definition: SegmentCriterionDefinition::EqualElapsedTime {
                    span_milliseconds: 1_200_000,
                },
            },
        )
        .expect("revise reusable criterion");
        let revised_criterion = revised
            .available_criteria
            .iter()
            .find(|criterion| criterion.title() == "Twenty-minute thirds")
            .expect("revised criterion");
        assert_eq!(revised_criterion.revision(), 2);
        assert_eq!(
            revised.exercises.as_ref().expect("segment exercises")[0]
                .applied_criteria
                .iter()
                .find(|applied| {
                    applied.criterion.criterion_id() == revised_criterion.criterion_id()
                })
                .expect("revised application")
                .segments
                .len(),
            3
        );

        let reopened = SqliteTrainingLibrary::new(harness.database());
        let restarted = query_training_session_segmentation(
            &reopened,
            TrainingSessionSegmentationQuery {
                session_ref: session_ref.clone(),
                snapshot_ref: Some(snapshot_ref.clone()),
            },
        )
        .expect("criteria after restart");
        assert_eq!(restarted.available_criteria.len(), 2);
        assert_eq!(
            restarted.exercises.as_ref().expect("segment exercises")[0]
                .applied_criteria
                .len(),
            2
        );

        let repeated = import_polar_archive(&harness.database(), &archive)
            .expect("exact repeat after authored criteria");
        assert!(repeated.exact_repeat);
        let after_repeat = query_training_session_segmentation(
            &reopened,
            TrainingSessionSegmentationQuery {
                session_ref: session_ref.clone(),
                snapshot_ref: Some(snapshot_ref.clone()),
            },
        )
        .expect("criteria survive exact repeat");
        assert_eq!(after_repeat.available_criteria.len(), 2);
        assert_eq!(
            after_repeat.exercises.as_ref().expect("segment exercises")[0]
                .applied_criteria
                .len(),
            2
        );

        let connection = Connection::open(harness.database()).expect("database");
        let table_names = connection
            .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name")
            .expect("table query")
            .query_map([], |row| row.get::<_, String>(0))
            .expect("table rows")
            .collect::<std::result::Result<Vec<_>, _>>()
            .expect("table names");
        assert!(table_names.iter().any(|name| name == "training_route"));
        assert!(table_names
            .iter()
            .any(|name| name == "training_route_point"));
        assert!(table_names
            .iter()
            .any(|name| name == "training_signal_sample"));
        assert!(table_names.iter().any(|name| name == "segment_criterion"));
        assert!(table_names
            .iter()
            .any(|name| name == "training_exercise_segment_criterion"));
        assert!(table_names
            .iter()
            .any(|name| name == "training_session_zone_assessment"));
        assert!(table_names.iter().any(|name| name == "training_zone_group"));
        assert!(table_names.iter().any(|name| name == "training_zone"));
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM training_signal_series", [], |row| {
                    row.get::<_, i64>(0)
                })
                .expect("mapped signal series count"),
            2
        );
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM training_signal_sample", [], |row| {
                    row.get::<_, i64>(0)
                })
                .expect("mapped signal sample count"),
            7
        );
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM training_zone_group", [], |row| {
                    row.get::<_, i64>(0)
                })
                .expect("mapped zone group count"),
            3
        );
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM training_zone", [], |row| {
                    row.get::<_, i64>(0)
                })
                .expect("mapped zone count"),
            4
        );

        connection
            .execute(
                "UPDATE training_route_point
                 SET elapsed_milliseconds = 3000
                 WHERE origin_id = ?1 AND session_id = ?2 AND exercise_id = ?3
                   AND kind = 'primary' AND ordinal = 1",
                params![
                    &history[0].origin_id,
                    "synthetic-session",
                    "synthetic-exercise"
                ],
            )
            .expect("corrupt elapsed ordering");
        assert!(matches!(
            query_training_session_routes_on(
                &connection,
                &history[0].origin_id,
                "synthetic-session",
            ),
            Err(ImportError::InvalidTrainingLibrary(_))
        ));
    }

    #[test]
    fn persists_personal_ranges_across_restart_repeat_conflict_removal_and_amendment() {
        let harness = Harness::new();
        let initial = harness.archive(
            "training-range-initial.zip",
            &[
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"username":"fixture-training-range-claim"}"#,
                ),
                (
                    "training-session_2026-01-02T10-00-00_42-11111111-2222-4333-8444-555555555555.json",
                    r#"{
                        "identifier":{"id":"range-session"},
                        "created":"2026-01-02T12:00:00.000",
                        "modified":"2026-01-02T12:05:00.000",
                        "startTime":"2026-01-02T10:00:00",
                        "stopTime":"2026-01-02T10:10:00",
                        "durationMillis":600000,
                        "exercises":[{
                            "identifier":{"id":"range-exercise"},
                            "created":"2026-01-02T12:00:00.000",
                            "modified":"2026-01-02T12:05:00.000",
                            "startTime":"2026-01-02T10:00:00",
                            "stopTime":"2026-01-02T10:10:00",
                            "durationMillis":600000
                        }]
                    }"#,
                ),
            ],
        );
        import_polar_archive(&harness.database(), &initial).expect("initial range session import");
        let session = query_training_sessions(&harness.database())
            .expect("training history")
            .remove(0);
        let session_ref = training_session_ref(&session.origin_id, &session.session_id);
        let library = SqliteTrainingLibrary::new(harness.database());
        let empty = query_training_session_ranges(
            &library,
            TrainingSessionRangesQuery {
                session_ref: session_ref.clone(),
                snapshot_ref: None,
            },
        )
        .expect("empty personal ranges");
        assert!(empty.ranges.is_empty());
        let exercise_ref = empty.exercises[0].exercise_ref.clone();

        let first = create_training_session_range(
            &library,
            CreateTrainingSessionRangeRequest {
                session_ref: session_ref.clone(),
                snapshot_ref: empty.snapshot_ref.clone(),
                exercise_ref: exercise_ref.clone(),
                title: "River section".to_owned(),
                started_at_elapsed_milliseconds: 100_000,
                ended_at_elapsed_milliseconds: 400_000,
            },
        )
        .expect("first personal range");
        let first_ref = first.ranges[0].range_id().to_owned();
        let initial_evidence_revision = first.evidence_revision.clone();
        let second = create_training_session_range(
            &library,
            CreateTrainingSessionRangeRequest {
                session_ref: session_ref.clone(),
                snapshot_ref: first.snapshot_ref.clone(),
                exercise_ref: exercise_ref.clone(),
                title: "River section".to_owned(),
                started_at_elapsed_milliseconds: 300_000,
                ended_at_elapsed_milliseconds: 500_000,
            },
        )
        .expect("overlapping duplicate-title range");
        assert_eq!(second.ranges.len(), 2);
        let second_ref = second
            .ranges
            .iter()
            .find(|range| range.range_id() != first_ref)
            .expect("second range")
            .range_id()
            .to_owned();

        let renamed = rename_training_session_range(
            &library,
            RenameTrainingSessionRangeRequest {
                session_ref: session_ref.clone(),
                snapshot_ref: second.snapshot_ref.clone(),
                range_ref: first_ref.clone(),
                expected_revision: 1,
                title: "Bridge to bend".to_owned(),
            },
        )
        .expect("renamed range");
        assert!(matches!(
            rename_training_session_range(
                &library,
                RenameTrainingSessionRangeRequest {
                    session_ref: session_ref.clone(),
                    snapshot_ref: renamed.snapshot_ref.clone(),
                    range_ref: first_ref.clone(),
                    expected_revision: 1,
                    title: "Stale overwrite".to_owned(),
                },
            ),
            Err(ApplicationError::TrainingSessionRangeConflict)
        ));
        let adjusted = adjust_training_session_range(
            &library,
            AdjustTrainingSessionRangeRequest {
                session_ref: session_ref.clone(),
                snapshot_ref: renamed.snapshot_ref.clone(),
                range_ref: first_ref.clone(),
                expected_revision: 2,
                exercise_ref: exercise_ref.clone(),
                started_at_elapsed_milliseconds: 150_000,
                ended_at_elapsed_milliseconds: 450_000,
            },
        )
        .expect("adjusted range");
        assert_eq!(
            adjusted
                .ranges
                .iter()
                .find(|range| range.range_id() == first_ref)
                .expect("adjusted first range")
                .revision(),
            3
        );
        let removed = remove_training_session_range(
            &library,
            RemoveTrainingSessionRangeRequest {
                session_ref: session_ref.clone(),
                snapshot_ref: adjusted.snapshot_ref.clone(),
                range_ref: second_ref,
                expected_revision: 1,
            },
        )
        .expect("removed second range");
        assert_eq!(removed.ranges.len(), 1);

        let reopened = SqliteTrainingLibrary::new(harness.database());
        let restarted = query_training_session_ranges(
            &reopened,
            TrainingSessionRangesQuery {
                session_ref: session_ref.clone(),
                snapshot_ref: None,
            },
        )
        .expect("range after restart");
        assert_eq!(restarted.ranges[0].title(), "Bridge to bend");
        assert_eq!(restarted.ranges[0].revision(), 3);

        let repeated = import_polar_archive(&harness.database(), &initial).expect("exact reimport");
        assert!(repeated.exact_repeat);
        let after_repeat = query_training_session_ranges(
            &reopened,
            TrainingSessionRangesQuery {
                session_ref: session_ref.clone(),
                snapshot_ref: None,
            },
        )
        .expect("range after exact repeat");
        assert_eq!(after_repeat.ranges[0].revision(), 3);
        assert_eq!(after_repeat.evidence_revision, initial_evidence_revision);

        let equivalent_archive = harness.archive(
            "training-range-equivalent.zip",
            &[
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"username":"fixture-training-range-claim"}"#,
                ),
                (
                    "training-session_2026-01-02T10-00-00_42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"exercises":[{"durationMillis":600000,"stopTime":"2026-01-02T10:10:00","startTime":"2026-01-02T10:00:00","modified":"2026-01-02T12:05:00.000","created":"2026-01-02T12:00:00.000","identifier":{"id":"range-exercise"}}],"durationMillis":600000,"stopTime":"2026-01-02T10:10:00","startTime":"2026-01-02T10:00:00","modified":"2026-01-02T12:05:00.000","created":"2026-01-02T12:00:00.000","identifier":{"id":"range-session"}}"#,
                ),
            ],
        );
        let equivalent = import_polar_archive(&harness.database(), &equivalent_archive)
            .expect("semantically equivalent range session import");
        assert!(!equivalent.exact_repeat);
        assert_eq!(equivalent.equivalent_observations, 1);
        let after_equivalent = query_training_session_ranges(
            &reopened,
            TrainingSessionRangesQuery {
                session_ref: session_ref.clone(),
                snapshot_ref: None,
            },
        )
        .expect("range after semantically equivalent reimport");
        assert_eq!(after_equivalent.ranges[0].revision(), 3);
        assert_eq!(
            after_equivalent.evidence_revision,
            initial_evidence_revision
        );

        let amended_archive = harness.archive(
            "training-range-amended.zip",
            &[
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"username":"fixture-training-range-claim"}"#,
                ),
                (
                    "training-session_2026-01-02T10-00-00_42-11111111-2222-4333-8444-555555555555.json",
                    r#"{
                        "identifier":{"id":"range-session"},
                        "created":"2026-01-02T12:00:00.000",
                        "modified":"2026-01-02T12:10:00.000",
                        "startTime":"2026-01-02T10:00:00",
                        "stopTime":"2026-01-02T10:05:00",
                        "durationMillis":300000,
                        "exercises":[{
                            "identifier":{"id":"range-exercise"},
                            "created":"2026-01-02T12:00:00.000",
                            "modified":"2026-01-02T12:10:00.000",
                            "startTime":"2026-01-02T10:00:00",
                            "stopTime":"2026-01-02T10:05:00",
                            "durationMillis":300000
                        }]
                    }"#,
                ),
            ],
        );
        let amendment = import_polar_archive(&harness.database(), &amended_archive)
            .expect("amended range session import");
        assert_eq!(amendment.amended_observations, 1);
        let review_required = query_training_session_ranges(
            &reopened,
            TrainingSessionRangesQuery {
                session_ref: session_ref.clone(),
                snapshot_ref: None,
            },
        )
        .expect("range after amendment");
        assert_ne!(review_required.evidence_revision, initial_evidence_revision);
        assert_eq!(review_required.ranges[0].revision(), 4);
        assert_eq!(
            review_required.ranges[0].state(),
            TrainingSessionRangeState::ReviewRequired
        );
        assert_eq!(
            review_required.ranges[0].ended_at_elapsed_milliseconds(),
            450_000
        );

        let reviewed = adjust_training_session_range(
            &reopened,
            AdjustTrainingSessionRangeRequest {
                session_ref,
                snapshot_ref: review_required.snapshot_ref,
                range_ref: first_ref,
                expected_revision: 4,
                exercise_ref,
                started_at_elapsed_milliseconds: 100_000,
                ended_at_elapsed_milliseconds: 250_000,
            },
        )
        .expect("reviewed amended range");
        assert_eq!(
            reviewed.ranges[0].state(),
            TrainingSessionRangeState::Current
        );
        assert_eq!(reviewed.ranges[0].revision(), 5);
    }

    #[test]
    fn reimports_identical_bytes_after_a_mapping_upgrade_and_enriches_without_duplicates() {
        let harness = Harness::new();
        let archive = harness.archive(
            "training-mapping-upgrade.zip",
            &[
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"username":"fixture-training-upgrade-claim"}"#,
                ),
                (
                    "training-session_2026-01-02T10-30-00_42-11111111-2222-4333-8444-555555555555.json",
                    r#"{
                        "identifier":{"id":"synthetic-upgrade-session"},
                        "created":"2026-01-02T12:00:00.000",
                        "modified":"2026-01-02T12:05:00.000",
                        "startTime":"2026-01-02T10:30:00",
                        "stopTime":"2026-01-02T11:30:00",
                        "durationMillis":3600000,
                        "exercises":[{
                            "identifier":{"id":"synthetic-upgrade-exercise"},
                            "created":"2026-01-02T12:00:00.000",
                            "modified":"2026-01-02T12:05:00.000",
                            "startTime":"2026-01-02T10:30:00",
                            "stopTime":"2026-01-02T11:30:00",
                            "durationMillis":3600000,
                            "laps":{"laps":[{
                                "splitTimeMillis":0,
                                "durationMillis":1800000
                            }]},
                            "routes":{"route":{
                                "startTime":"2026-01-02T10:30:00",
                                "wayPoints":[
                                    {"latitude":35.0,"longitude":-5.0,"elapsedMillis":0},
                                    {"latitude":35.1,"longitude":-5.1,"elapsedMillis":1000}
                                ]
                            }},
                            "samples":{"samples":[{
                                "type":"HEART_RATE",
                                "intervalMillis":1000,
                                "values":[130,"NaN",140]
                            }]},
                            "zones":[{
                                "type":"ZONE_TYPE_HEART_RATE",
                                "zones":[{
                                    "lowerLimit":130,
                                    "higherLimit":149,
                                    "inZone":1200000
                                }]
                            }]
                        }]
                    }"#,
                ),
            ],
        );
        import_polar_archive(&harness.database(), &archive).expect("initial mapped import");

        let connection = Connection::open(harness.database()).expect("database");
        connection
            .execute_batch(
                "PRAGMA foreign_keys = ON;
                 DELETE FROM training_zone;
                 DELETE FROM training_zone_group;
                 DELETE FROM training_exercise_zone_assessment;
                 DELETE FROM training_session_zone_assessment;
                 UPDATE import_operation
                 SET source_adapter_version = 'polar-flow-archive@9',
                     mapping_version = 'polar-flow-mapping-set@4';
                 UPDATE training_session_provenance
                 SET source_adapter_version = 'polar-flow-archive@9',
                     mapping_version = 'polar-flow-training-session@4';",
            )
            .expect("simulate version-four persisted library");
        drop(connection);

        let pre_upgrade_session = query_training_sessions(&harness.database())
            .expect("pre-upgrade training history")
            .remove(0);
        let pre_upgrade_session_ref = training_session_ref(
            &pre_upgrade_session.origin_id,
            &pre_upgrade_session.session_id,
        );
        let pre_upgrade_library = SqliteTrainingLibrary::new(harness.database());
        let pre_upgrade_ranges = query_training_session_ranges(
            &pre_upgrade_library,
            TrainingSessionRangesQuery {
                session_ref: pre_upgrade_session_ref.clone(),
                snapshot_ref: None,
            },
        )
        .expect("pre-upgrade range context");
        let pre_upgrade_exercise_ref = pre_upgrade_ranges.exercises[0].exercise_ref.clone();
        let authored_before_enrichment = create_training_session_range(
            &pre_upgrade_library,
            CreateTrainingSessionRangeRequest {
                session_ref: pre_upgrade_session_ref.clone(),
                snapshot_ref: pre_upgrade_ranges.snapshot_ref,
                exercise_ref: pre_upgrade_exercise_ref.clone(),
                title: "First recorded seconds".to_owned(),
                started_at_elapsed_milliseconds: 0,
                ended_at_elapsed_milliseconds: 2_000,
            },
        )
        .expect("range before compatible enrichment");
        let review_required_range_ref = authored_before_enrichment.ranges[0].range_id().to_owned();
        let pre_upgrade_evidence_revision = authored_before_enrichment.evidence_revision.clone();
        let mut review_connection =
            Connection::open(harness.database()).expect("range review database");
        let review_transaction = review_connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .expect("range review transaction");
        reconcile_persisted_training_session_ranges(
            &review_transaction,
            &pre_upgrade_session.origin_id,
            &pre_upgrade_session.session_id,
            TrainingSessionRangeEvidenceCompatibility::Incompatible,
        )
        .expect("mark range for review before compatible enrichment");
        review_transaction.commit().expect("commit range review");
        let review_context = query_training_session_ranges(
            &pre_upgrade_library,
            TrainingSessionRangesQuery {
                session_ref: pre_upgrade_session_ref.clone(),
                snapshot_ref: None,
            },
        )
        .expect("review-required pre-upgrade range context");
        assert_eq!(review_context.ranges[0].revision(), 2);
        assert_eq!(
            review_context.ranges[0].state(),
            TrainingSessionRangeState::ReviewRequired
        );
        let with_current_range = create_training_session_range(
            &pre_upgrade_library,
            CreateTrainingSessionRangeRequest {
                session_ref: pre_upgrade_session_ref.clone(),
                snapshot_ref: review_context.snapshot_ref,
                exercise_ref: pre_upgrade_exercise_ref,
                title: "Next recorded seconds".to_owned(),
                started_at_elapsed_milliseconds: 3_000,
                ended_at_elapsed_milliseconds: 4_000,
            },
        )
        .expect("current range beside a review-required range");
        let current_range_ref = with_current_range
            .ranges
            .iter()
            .find(|range| range.range_id() != review_required_range_ref)
            .expect("second pre-upgrade range")
            .range_id()
            .to_owned();

        let enriched =
            import_polar_archive(&harness.database(), &archive).expect("mapping upgrade import");
        assert!(!enriched.exact_repeat);
        assert_eq!(enriched.enriched_observations, 1);
        assert_eq!(
            query_training_sessions(&harness.database()).unwrap().len(),
            1
        );
        let structure = query_training_session_structure_on(
            &Connection::open(harness.database()).unwrap(),
            &query_training_sessions(&harness.database()).unwrap()[0].origin_id,
            "synthetic-upgrade-session",
        )
        .unwrap()
        .unwrap();
        let exercises = structure.exercises.unwrap();
        assert_eq!(exercises.len(), 1);
        assert_eq!(exercises[0].manual_laps.as_ref().unwrap().len(), 1);
        let routes = query_training_session_routes_on(
            &Connection::open(harness.database()).unwrap(),
            &query_training_sessions(&harness.database()).unwrap()[0].origin_id,
            "synthetic-upgrade-session",
        )
        .unwrap()
        .unwrap()
        .exercises
        .unwrap();
        assert_eq!(routes.len(), 1);
        assert_eq!(
            routes[0]
                .routes
                .as_ref()
                .unwrap()
                .primary
                .as_ref()
                .unwrap()
                .points
                .len(),
            2
        );
        let signals = query_training_session_signals_on(
            &Connection::open(harness.database()).unwrap(),
            &query_training_sessions(&harness.database()).unwrap()[0].origin_id,
            "synthetic-upgrade-session",
        )
        .unwrap()
        .unwrap()
        .exercises
        .unwrap();
        assert_eq!(signals.len(), 1);
        let heart_rate = &signals[0]
            .signals
            .as_ref()
            .unwrap()
            .primary
            .as_ref()
            .unwrap()[0];
        assert_eq!(heart_rate.samples.len(), 3);
        assert_eq!(heart_rate.samples[1].value, None);
        let zones = query_training_session_zones_on(
            &Connection::open(harness.database()).unwrap(),
            &query_training_sessions(&harness.database()).unwrap()[0].origin_id,
            "synthetic-upgrade-session",
        )
        .unwrap()
        .unwrap()
        .exercises
        .unwrap();
        assert_eq!(zones.len(), 1);
        let groups = &zones[0].zones.as_ref().unwrap().groups;
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].zones.as_ref().unwrap().len(), 1);

        let range_after_enrichment = query_training_session_ranges(
            &pre_upgrade_library,
            TrainingSessionRangesQuery {
                session_ref: pre_upgrade_session_ref,
                snapshot_ref: None,
            },
        )
        .expect("range after compatible enrichment");
        assert_ne!(
            range_after_enrichment.evidence_revision,
            pre_upgrade_evidence_revision
        );
        assert_eq!(range_after_enrichment.ranges.len(), 2);
        let review_required_range = range_after_enrichment
            .ranges
            .iter()
            .find(|range| range.range_id() == review_required_range_ref)
            .expect("review-required range after compatible enrichment");
        assert_eq!(review_required_range.revision(), 3);
        assert_eq!(
            review_required_range.state(),
            TrainingSessionRangeState::ReviewRequired
        );
        let current_range = range_after_enrichment
            .ranges
            .iter()
            .find(|range| range.range_id() == current_range_ref)
            .expect("current range after compatible enrichment");
        assert_eq!(current_range.revision(), 2);
        assert_eq!(current_range.state(), TrainingSessionRangeState::Current);
        assert_eq!(review_required_range.ended_at_elapsed_milliseconds(), 2_000);

        let session = query_training_sessions(&harness.database())
            .expect("training history for provenance")
            .into_iter()
            .next()
            .expect("training session for provenance");
        let session_ref = training_session_ref(&session.origin_id, &session.session_id);
        let library = SqliteTrainingLibrary::new(harness.database());
        let first_page = query_training_session_provenance(
            &library,
            TrainingSessionProvenanceQuery {
                session_ref: session_ref.clone(),
                snapshot_ref: None,
                offset: 0,
                limit: 1,
            },
        )
        .expect("first provenance page");
        assert_eq!(first_page.total_event_count, 2);
        assert_eq!(first_page.next_offset, Some(1));
        assert_eq!(first_page.current.contributing_event_count, 2);
        assert_eq!(first_page.current.non_contributing_event_count, 0);
        assert_eq!(
            first_page.current.mapping_version,
            TRAINING_SESSION_MAPPING_VERSION
        );
        assert_eq!(
            first_page.events[0].decision,
            TrainingProvenanceDecisionView::Create
        );
        assert_eq!(
            first_page.events[0].mapping_version,
            "polar-flow-training-session@4"
        );

        let last_page = query_training_session_provenance(
            &library,
            TrainingSessionProvenanceQuery {
                session_ref,
                snapshot_ref: Some(first_page.snapshot_ref),
                offset: 1,
                limit: 1,
            },
        )
        .expect("last provenance page");
        assert_eq!(last_page.next_offset, None);
        assert_eq!(
            last_page.events[0].decision,
            TrainingProvenanceDecisionView::Enrich
        );
        assert_eq!(
            last_page.events[0].mapping_version,
            TRAINING_SESSION_MAPPING_VERSION
        );
    }

    #[test]
    fn discovers_classifies_reopens_and_reimports_sports_without_exposing_source_references() {
        let harness = Harness::new();
        let archive = harness.archive(
            "training-sports.zip",
            &[
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"username":"fixture-sport-claim"}"#,
                ),
                (
                    "training-session_2026-01-02T10-30-00_42-11111111-2222-4333-8444-555555555555.json",
                    r#"{
                    "identifier":{"id":"session-a"},
                    "created":"2026-01-02T12:00:00.000",
                    "modified":"2026-01-02T12:05:00.000",
                    "startTime":"2026-01-02T10:30:00",
                    "stopTime":"2026-01-02T11:30:00",
                    "durationMillis":3600000,
                    "distanceMeters":10000,
                    "hrAvg":145,
                    "hrMax":178,
                    "sport":{"id":"opaque-source-a"}
                    }"#,
                ),
                (
                    "training-session_2026-02-03T07-00-00_42-11111111-2222-4333-8444-555555555555.json",
                    r#"{
                    "identifier":{"id":"session-b"},
                    "created":"2026-02-03T08:00:00.000",
                    "modified":"2026-02-03T08:05:00.000",
                    "startTime":"2026-02-03T07:00:00",
                    "stopTime":"2026-02-03T07:45:00",
                    "durationMillis":2700000,
                    "sport":{"id":"opaque-source-b"}
                    }"#,
                ),
                (
                    "training-session_2026-03-04T18-00-00_42-11111111-2222-4333-8444-555555555555.json",
                    r#"{
                    "identifier":{"id":"session-c"},
                    "created":"2026-03-04T19:00:00.000",
                    "modified":"2026-03-04T19:05:00.000",
                    "startTime":"2026-03-04T18:00:00",
                    "stopTime":"2026-03-04T18:30:00",
                    "durationMillis":1800000
                    }"#,
                ),
            ],
        );
        import_polar_archive(&harness.database(), &archive).expect("training sport import");
        let library = SqliteTrainingSports::new(harness.database());
        let initial = query_training_sports(&library).expect("initial sport discovery");
        assert_eq!(initial.origin_count, 1);
        assert_eq!(initial.session_count, 3);
        assert_eq!(initial.sports.len(), 3);
        assert_eq!(
            initial
                .sports
                .iter()
                .filter(|sport| sport.state == TrainingSportState::Unknown)
                .count(),
            2
        );
        assert_eq!(
            initial
                .sports
                .iter()
                .filter(|sport| sport.state == TrainingSportState::Unavailable)
                .count(),
            1
        );
        let sport_ref = initial
            .sports
            .iter()
            .find_map(|sport| sport.sport_ref.clone())
            .expect("classifiable sport reference");
        assert!(!sport_ref.contains("opaque-source"));
        assert!(!sport_ref.contains("fixture-sport"));

        let saved = save_training_sport_classification(
            &library,
            SaveSportClassificationRequest {
                sport_ref: sport_ref.clone(),
                expected_revision: 0,
                canonical_family: Some("running".to_owned()),
                display_label: Some("Forest running".to_owned()),
            },
        )
        .expect("saved sport classification");
        assert_eq!(saved.outcome, SportClassificationSaveOutcome::Changed);
        assert_eq!(
            saved
                .overview
                .sports
                .iter()
                .find(|sport| sport.sport_ref.as_deref() == Some(sport_ref.as_str()))
                .expect("saved sport remains discoverable")
                .classification
                .as_ref()
                .expect("saved classification")
                .revision,
            1
        );

        let reopened = SqliteTrainingSports::new(harness.database());
        let restored = query_training_sports(&reopened).expect("restored sport discovery");
        let restored_classification = restored
            .sports
            .iter()
            .find(|sport| sport.sport_ref.as_deref() == Some(sport_ref.as_str()))
            .and_then(|sport| sport.classification.as_ref())
            .expect("restored classification");
        assert_eq!(
            restored_classification.display_label.as_deref(),
            Some("Forest running")
        );
        assert_eq!(restored_classification.revision, 1);

        let repeat = import_polar_archive(&harness.database(), &archive).expect("exact reimport");
        assert!(repeat.exact_repeat);
        let after_repeat = query_training_sports(&reopened).expect("classification after repeat");
        assert_eq!(
            after_repeat
                .sports
                .iter()
                .find(|sport| sport.sport_ref.as_deref() == Some(sport_ref.as_str()))
                .and_then(|sport| sport.classification.as_ref())
                .and_then(|classification| classification.display_label.as_deref()),
            Some("Forest running")
        );

        let connection = Connection::open(harness.database()).expect("database");
        let query_plan = connection
            .query_row(
                "EXPLAIN QUERY PLAN
                 SELECT origin_id, sport_ref, MIN(started_at_local), MAX(started_at_local)
                 FROM training_session
                 GROUP BY origin_id, sport_ref",
                [],
                |row| row.get::<_, String>(3),
            )
            .expect("sport discovery query plan");
        assert!(query_plan.contains("training_session_origin_sport_start"));
    }

    #[test]
    fn searches_the_complete_training_history_with_stable_pages_and_combinable_filters() {
        let harness = Harness::new();
        let archive = harness.archive(
            "training-discovery.zip",
            &[
                (
                    "account-data-42-11111111-2222-4333-8444-555555555555.json",
                    r#"{"username":"fixture-training-discovery-claim"}"#,
                ),
                (
                    "training-session_2024-01-02T10-30-00_42-11111111-2222-4333-8444-555555555555.json",
                    r#"{
                    "identifier":{"id":"discovery-session-a"},
                    "created":"2024-01-02T12:00:00.000",
                    "modified":"2024-01-02T12:05:00.000",
                    "startTime":"2024-01-02T10:30:00",
                    "stopTime":"2024-01-02T11:30:00",
                    "durationMillis":3600000,
                    "distanceMeters":10000,
                    "calories":650,
                    "hrAvg":145,
                    "hrMax":178,
                    "sport":{"id":"source-sport-a"}
                    }"#,
                ),
                (
                    "training-session_2025-02-03T07-00-00_42-11111111-2222-4333-8444-555555555555.json",
                    r#"{
                    "identifier":{"id":"discovery-session-b"},
                    "created":"2025-02-03T08:00:00.000",
                    "modified":"2025-02-03T08:05:00.000",
                    "startTime":"2025-02-03T07:00:00",
                    "stopTime":"2025-02-03T07:45:00",
                    "durationMillis":2700000,
                    "distanceMeters":18000,
                    "sport":{"id":"source-sport-b"}
                    }"#,
                ),
                (
                    "training-session_2026-03-04T18-00-00_42-11111111-2222-4333-8444-555555555555.json",
                    r#"{
                    "identifier":{"id":"discovery-session-c"},
                    "created":"2026-03-04T19:00:00.000",
                    "modified":"2026-03-04T19:05:00.000",
                    "startTime":"2026-03-04T18:00:00",
                    "stopTime":"2026-03-04T18:30:00",
                    "durationMillis":1800000
                    }"#,
                ),
            ],
        );
        import_polar_archive(&harness.database(), &archive).expect("training discovery import");
        let sports_library = SqliteTrainingSports::new(harness.database());
        let sports = query_training_sports(&sports_library).expect("sport discovery");
        let first_sport = sports
            .sports
            .iter()
            .find(|sport| sport.first_local_date == "2024-01-02")
            .and_then(|sport| sport.sport_ref.clone())
            .expect("first opaque sport reference");
        let second_sport = sports
            .sports
            .iter()
            .find(|sport| sport.first_local_date == "2025-02-03")
            .and_then(|sport| sport.sport_ref.clone())
            .expect("second opaque sport reference");
        save_training_sport_classification(
            &sports_library,
            SaveSportClassificationRequest {
                sport_ref: first_sport.clone(),
                expected_revision: 0,
                canonical_family: Some("running".to_owned()),
                display_label: Some("Trail running".to_owned()),
            },
        )
        .expect("searchable sport classification");
        let library = SqliteTrainingLibrary::new(harness.database());
        let base_request = TrainingSessionSearchRequest {
            from: None,
            through: None,
            sport_refs: Vec::new(),
            required_measurements: Vec::new(),
            text: None,
            sort: TrainingSessionSort::StartedDescending,
            offset: 0,
            limit: 2,
            snapshot_ref: None,
        };

        let first_page =
            fitfreed_application::query_training_sessions(&library, base_request.clone())
                .expect("first training page");
        assert_eq!(
            first_page.available_range.as_ref().unwrap().from,
            "2024-01-02"
        );
        assert_eq!(
            first_page.available_range.as_ref().unwrap().through,
            "2026-03-04"
        );
        assert_eq!(first_page.total_count, 3);
        assert_eq!(first_page.summaries.len(), 1);
        assert_eq!(first_page.summaries[0].training_days, 3);
        assert_eq!(first_page.summaries[0].session_count, 3);
        assert_eq!(
            first_page.summaries[0].total_duration_milliseconds,
            8_100_000
        );
        assert_eq!(first_page.summaries[0].distance_session_count, 2);
        assert_eq!(
            first_page.summaries[0].total_distance_meters,
            Some(28_000.0)
        );
        assert_eq!(first_page.summaries[0].energy_session_count, 1);
        assert_eq!(first_page.summaries[0].total_energy_kilocalories, Some(650));
        assert_eq!(first_page.summaries[0].heart_rate_session_count, 1);
        assert_eq!(first_page.sessions.len(), 2);
        assert_eq!(
            first_page.sessions[0].started_at_local,
            "2026-03-04T18:00:00"
        );
        assert_eq!(first_page.next_offset, Some(2));
        assert!(first_page
            .sessions
            .iter()
            .all(|session| !session.session_ref.contains("discovery-session")));

        let second_page = fitfreed_application::query_training_sessions(
            &library,
            TrainingSessionSearchRequest {
                offset: 2,
                snapshot_ref: Some(first_page.snapshot_ref.clone()),
                ..base_request.clone()
            },
        )
        .expect("second training page");
        assert_eq!(second_page.sessions.len(), 1);
        assert_eq!(
            second_page.sessions[0].started_at_local,
            "2024-01-02T10:30:00"
        );
        assert_eq!(second_page.next_offset, None);

        let filtered = fitfreed_application::query_training_sessions(
            &library,
            TrainingSessionSearchRequest {
                from: Some("2024-01-01".to_owned()),
                through: Some("2024-12-31".to_owned()),
                sport_refs: vec![first_sport.clone()],
                required_measurements: vec![
                    TrainingMeasurementFilter::Distance,
                    TrainingMeasurementFilter::HeartRate,
                ],
                text: Some("TRAIL".to_owned()),
                sort: TrainingSessionSort::DistanceDescending,
                offset: 0,
                limit: 25,
                snapshot_ref: None,
            },
        )
        .expect("filtered training page");
        assert_eq!(filtered.total_count, 1);
        assert_eq!(filtered.summaries[0].training_days, 1);
        assert_eq!(filtered.summaries[0].session_count, 1);
        assert_eq!(filtered.summaries[0].distance_session_count, 1);
        assert_eq!(filtered.summaries[0].heart_rate_session_count, 1);
        assert_eq!(
            filtered.sessions[0]
                .sport
                .classification
                .as_ref()
                .and_then(|classification| classification.display_label.as_deref()),
            Some("Trail running")
        );

        let calendar = fitfreed_application::query_training_session_calendar(
            &library,
            TrainingSessionCalendarRequest {
                month: "2024-01".to_owned(),
                from: Some("2024-01-01".to_owned()),
                through: Some("2024-12-31".to_owned()),
                sport_refs: vec![first_sport],
                required_measurements: vec![
                    TrainingMeasurementFilter::Distance,
                    TrainingMeasurementFilter::HeartRate,
                ],
                text: Some("trail".to_owned()),
                snapshot_ref: Some(filtered.snapshot_ref.clone()),
            },
        )
        .expect("filtered training calendar");
        assert_eq!(calendar.days.len(), 1);
        assert_eq!(calendar.days[0].local_date, "2024-01-02");
        assert_eq!(calendar.days[0].source_index, 1);
        assert_eq!(calendar.days[0].session_count, 1);
        assert_eq!(calendar.days[0].total_duration_milliseconds, 3_600_000);
        assert_eq!(calendar.days[0].distance_session_count, 1);
        assert_eq!(calendar.days[0].total_distance_meters, Some(10_000.0));
        assert_eq!(calendar.days[0].heart_rate_session_count, 1);

        let selected_refs = first_page
            .sessions
            .iter()
            .rev()
            .map(|session| session.session_ref.clone())
            .collect::<Vec<_>>();
        let selection = fitfreed_application::query_training_session_selection(
            &library,
            TrainingSessionSelectionRequest {
                session_refs: selected_refs.clone(),
                snapshot_ref: Some(filtered.snapshot_ref.clone()),
            },
        )
        .expect("ordered training selection");
        assert_eq!(
            selection
                .sessions
                .iter()
                .map(|session| session.session_ref.clone())
                .collect::<Vec<_>>(),
            selected_refs
        );
        assert!(selection.sessions.iter().all(|session| {
            !session.session_ref.contains("discovery-session")
                && session
                    .sport
                    .sport_ref
                    .as_deref()
                    .is_none_or(|sport_ref| !sport_ref.contains("source-sport"))
        }));

        save_training_sport_classification(
            &sports_library,
            SaveSportClassificationRequest {
                sport_ref: second_sport,
                expected_revision: 0,
                canonical_family: Some("cycling".to_owned()),
                display_label: None,
            },
        )
        .expect("snapshot-changing classification");
        let stale = fitfreed_application::query_training_sessions(
            &library,
            TrainingSessionSearchRequest {
                offset: 2,
                snapshot_ref: Some(first_page.snapshot_ref),
                ..base_request
            },
        );
        assert!(matches!(
            stale,
            Err(ApplicationError::TrainingSessionSearchChanged)
        ));
    }

    #[test]
    fn persists_reopens_clears_and_rejects_corrupt_training_discovery_workspaces() {
        let harness = Harness::new();
        let database_path = harness.database();
        let library = SqliteTrainingLibrary::new(database_path.clone());
        let workspace = TrainingDiscoveryWorkspace {
            version: 1,
            snapshot_ref: format!("training-snapshot-{}", "a".repeat(64)),
            from: Some("2026-01-01".to_owned()),
            through: Some("2026-08-18".to_owned()),
            sport_refs: vec![format!("sport-{}", "b".repeat(64))],
            required_measurements: vec![
                TrainingMeasurementFilter::Distance,
                TrainingMeasurementFilter::HeartRate,
            ],
            text: Some("Trail".to_owned()),
            sort: TrainingSessionSort::DistanceDescending,
            offset: 25,
            limit: 25,
            view: TrainingDiscoveryView::Calendar,
            calendar_month: Some("2026-08".to_owned()),
            calendar_day: Some("2026-08-18".to_owned()),
            selected_session_refs: vec![format!("session-{}", "c".repeat(64))],
            open_session_ref: Some(format!("session-{}", "d".repeat(64))),
        };

        assert_eq!(
            fitfreed_application::save_training_discovery_workspace(&library, workspace.clone(),)
                .expect("saved training workspace"),
            workspace
        );
        let reopened = SqliteTrainingLibrary::new(database_path.clone());
        assert_eq!(
            fitfreed_application::load_training_discovery_workspace(&reopened)
                .expect("reopened training workspace"),
            Some(workspace.clone())
        );
        fitfreed_application::clear_training_discovery_workspace(&reopened)
            .expect("cleared training workspace");
        assert_eq!(
            fitfreed_application::load_training_discovery_workspace(&reopened)
                .expect("empty training workspace"),
            None
        );

        fitfreed_application::save_training_discovery_workspace(&reopened, workspace)
            .expect("workspace before corruption");
        assert!(Connection::open(&database_path)
            .expect("database")
            .execute(
                "UPDATE training_discovery_workspace SET page_offset = 20 WHERE id = 1",
                [],
            )
            .is_err());
        Connection::open(&database_path)
            .expect("database")
            .execute(
                "UPDATE training_discovery_workspace SET sport_refs_json = '{' WHERE id = 1",
                [],
            )
            .expect("corrupt stored workspace");
        assert!(matches!(
            fitfreed_application::load_training_discovery_workspace(&reopened),
            Err(ApplicationError::TrainingDiscoveryWorkspaceQuery(_))
        ));
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
        let training_json = |modified: &str, duration: i64, lap_distance: i64| {
            format!(
                r#"{{
                    "identifier":{{"id":"synthetic-session"}},
                    "created":"2026-01-02T12:00:00.000",
                    "modified":"{modified}",
                    "startTime":"2026-01-02T10:30:00",
                    "stopTime":"2026-01-02T11:30:00",
                    "durationMillis":{duration},
                    "exercises":[{{
                        "identifier":{{"id":"synthetic-exercise"}},
                        "created":"2026-01-02T12:00:00.000",
                        "modified":"{modified}",
                        "startTime":"2026-01-02T10:30:00",
                        "stopTime":"2026-01-02T11:30:00",
                        "durationMillis":{duration},
                        "laps":{{"laps":[{{
                            "splitTimeMillis":0,
                            "durationMillis":{duration},
                            "distanceMeters":{lap_distance}
                        }}]}}
                    }}]
                }}"#
            )
        };
        let first_json = training_json("2026-01-02T12:05:00.000", 3_600_000, 100);
        let equivalent_json = first_json.clone();
        let amended_json = training_json("2026-01-03T09:00:00.000", 3_700_000, 200);
        let older_json = training_json("2026-01-02T13:00:00.000", 3_500_000, 300);
        let conflict_json = training_json("2026-01-03T09:00:00.000", 3_800_000, 400);
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
        let library = SqliteTrainingLibrary::new(harness.database());
        let initial_session = query_training_sessions(&harness.database())
            .expect("initial training history")
            .into_iter()
            .next()
            .expect("initial training session");
        let session_ref =
            training_session_ref(&initial_session.origin_id, &initial_session.session_id);
        let initial_structure = query_training_session_structure(
            &library,
            TrainingSessionStructureQuery {
                session_ref: session_ref.clone(),
                snapshot_ref: None,
            },
        )
        .expect("initial structure before authored segmentation");
        let initial_exercise_ref = initial_structure
            .structure
            .expect("initial structure assessment")
            .exercises
            .expect("initial exercises")
            .into_iter()
            .next()
            .expect("initial exercise")
            .exercise_ref;
        let authored = create_training_segment_criterion(
            &library,
            CreateTrainingSegmentCriterionRequest {
                session_ref: session_ref.clone(),
                snapshot_ref: initial_structure.snapshot_ref,
                exercise_ref: initial_exercise_ref,
                title: "Reusable revision witness".to_owned(),
                definition: SegmentCriterionDefinition::EqualElapsedTime {
                    span_milliseconds: 1_200_000,
                },
            },
        )
        .expect("author segmentation before reimport revisions");
        let authored_ref = authored.available_criteria[0].criterion_id().to_owned();
        assert_eq!(
            authored.exercises.expect("initial segment exercises")[0].applied_criteria[0]
                .segments
                .len(),
            3
        );
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
        let after_revisions = query_training_session_segmentation(
            &library,
            TrainingSessionSegmentationQuery {
                session_ref,
                snapshot_ref: None,
            },
        )
        .expect("authored segmentation after source revisions");
        assert_eq!(after_revisions.available_criteria.len(), 1);
        assert_eq!(
            after_revisions.available_criteria[0].criterion_id(),
            authored_ref
        );
        let applied_after_revisions = &after_revisions
            .exercises
            .expect("amended segment exercises")[0]
            .applied_criteria;
        assert_eq!(applied_after_revisions.len(), 1);
        assert_eq!(applied_after_revisions[0].segments.len(), 4);

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
                    "SELECT COUNT(*), MIN(distance_meters), MAX(distance_meters)
                     FROM training_lap",
                    [],
                    |row| Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, f64>(1)?,
                        row.get::<_, f64>(2)?,
                    )),
                )
                .expect("visible amended lap"),
            (1, 200.0, 200.0)
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
    fn accepts_observed_minute_precision_for_training_pauses() {
        let locator =
            "training-session_2026-01-02T10-30-00_42-11111111-2222-4333-8444-555555555555.json";
        let mapped = decode_training_session(
            "synthetic-origin",
            locator,
            &"0".repeat(64),
            br#"{
                "identifier":{"id":"synthetic-minute-pauses"},
                "created":"2026-01-02T12:00:00.000",
                "modified":"2026-01-02T12:05:00.000",
                "startTime":"2026-01-02T10:30:00",
                "stopTime":"2026-01-02T11:30:00",
                "durationMillis":3600000,
                "exercises":[{
                    "identifier":{"id":"synthetic-exercise"},
                    "created":"2026-01-02T12:00:00.000",
                    "modified":"2026-01-02T12:05:00.000",
                    "startTime":"2026-01-02T10:30:00",
                    "stopTime":"2026-01-02T11:30:00",
                    "durationMillis":3600000,
                    "pauseTimes":[
                        {
                            "startTime":"2026-01-02T10:40",
                            "endTime":"2026-01-02T10:41:00.000"
                        },
                        {
                            "startTime":"2026-01-02T10:50:00",
                            "endTime":"2026-01-02T10:51"
                        }
                    ]
                }]
            }"#
            .to_vec(),
        )
        .expect("observed minute-precision pauses");

        let pauses = mapped
            .observation
            .structure
            .expect("evaluated structure")
            .exercises
            .expect("source exercise collection")
            .remove(0)
            .pauses
            .expect("source pause collection");
        assert_eq!(pauses.len(), 2);
        assert_eq!(pauses[0].started_at_local, "2026-01-02T10:40:00");
        assert_eq!(pauses[0].ended_at_local, "2026-01-02T10:41:00");
        assert_eq!(pauses[1].started_at_local, "2026-01-02T10:50:00");
        assert_eq!(pauses[1].ended_at_local, "2026-01-02T10:51:00");
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
        assert_eq!(minimal.observation.summary.utc_offset_minutes, None);
        assert_eq!(minimal.observation.summary.distance_meters, None);
        assert_eq!(minimal.observation.summary.energy_kilocalories, None);
        assert_eq!(minimal.observation.summary.average_heart_rate_bpm, None);
        assert_eq!(minimal.observation.summary.maximum_heart_rate_bpm, None);
        assert_eq!(minimal.observation.summary.sport_ref, None);
        assert_eq!(minimal.observation.summary.exercise_count, None);
        assert_eq!(
            minimal.observation.structure,
            Some(TrainingSessionStructure { exercises: None })
        );
        assert_eq!(
            minimal.observation.routes,
            Some(TrainingSessionRouteAssessment { exercises: None })
        );
        assert_eq!(
            minimal.observation.signals,
            Some(TrainingSessionSignalAssessment { exercises: None })
        );
        assert_eq!(
            minimal.observation.zones,
            Some(TrainingSessionZoneAssessment { exercises: None })
        );

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
                "exercises":[
                    {
                        "identifier":{"id":"exercise-one"},
                        "created":"2026-01-02T12:00:00.123",
                        "modified":"2026-01-02T12:05:00.123",
                        "startTime":"2026-01-02T10:30:00.123",
                        "stopTime":"2026-01-02T11:00:00.123",
                        "durationMillis":1800000,
                        "sport":{"id":"one"}
                    },
                    {
                        "identifier":{"id":"exercise-two"},
                        "created":"2026-01-02T12:00:00.123",
                        "modified":"2026-01-02T12:05:00.123",
                        "startTime":"2026-01-02T11:00:00.123",
                        "stopTime":"2026-01-02T11:40:00.123",
                        "durationMillis":2400000,
                        "sport":{"id":"two"}
                    }
                ]
            }"#
            .to_vec(),
        )
        .expect("multiple-exercise training summary");
        assert_eq!(multiple.observation.summary.exercise_count, Some(2));
        assert_eq!(
            multiple.observation.summary.started_at_local,
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
                locator,
                r#"{"identifier":{"id":"synthetic"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"exercises":[{"identifier":{"id":"duplicate"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:00:00","durationMillis":1800000},{"identifier":{"id":"duplicate"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T11:00:00","stopTime":"2026-01-02T11:30:00","durationMillis":1800000}]}"#,
                "invalid-supported-artifact",
            ),
            (
                locator,
                r#"{"identifier":{"id":"synthetic"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"exercises":[{"identifier":{"id":"exercise"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T11:30:00","stopTime":"2026-01-02T10:30:00","durationMillis":3600000}]}"#,
                "invalid-supported-artifact",
            ),
            (
                locator,
                r#"{"identifier":{"id":"synthetic"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"exercises":[{"identifier":{"id":"exercise"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"laps":{"laps":[{"splitTimeMillis":-1,"durationMillis":1800000}]}}]}"#,
                "invalid-supported-artifact",
            ),
            (
                locator,
                r#"{"identifier":{"id":"synthetic"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"exercises":[{"identifier":{"id":"exercise"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"pauseTimes":[{"startTime":"2026-01-02T10:50:00","endTime":"2026-01-02T10:49:00"}]}]}"#,
                "invalid-supported-artifact",
            ),
            (
                locator,
                r#"{"identifier":{"id":"synthetic"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"exercises":[{"identifier":{"id":"exercise"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"routes":{"route":{"startTime":"2026-01-02T10:30:00","wayPoints":[{"latitude":91,"longitude":0}]}}}]}"#,
                "invalid-supported-artifact",
            ),
            (
                locator,
                r#"{"identifier":{"id":"synthetic"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"exercises":[{"identifier":{"id":"exercise"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"routes":{"route":{"startTime":"2026-01-02T10:30:00","wayPoints":[{"latitude":40,"longitude":-3,"elapsedMillis":2000},{"latitude":40.1,"longitude":-3.1,"elapsedMillis":1000}]}}}]}"#,
                "invalid-supported-artifact",
            ),
            (
                locator,
                r#"{"identifier":{"id":"synthetic"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"exercises":[{"identifier":{"id":"exercise"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"samples":{"samples":[{"type":"HEART_RATE","intervalMillis":0,"values":[120]}]}}]}"#,
                "invalid-supported-artifact",
            ),
            (
                locator,
                r#"{"identifier":{"id":"synthetic"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"exercises":[{"identifier":{"id":"exercise"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"samples":{"samples":[{"type":"HEART_RATE","intervalMillis":1000,"values":["Infinity"]}]}}]}"#,
                "invalid-supported-artifact",
            ),
            (
                locator,
                r#"{"identifier":{"id":"synthetic"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"exercises":[{"identifier":{"id":"exercise"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"samples":{"samples":[{"type":"SPEED","intervalMillis":1000,"values":[-1]}]}}]}"#,
                "invalid-supported-artifact",
            ),
            (
                locator,
                r#"{"identifier":{"id":"synthetic"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"exercises":[{"identifier":{"id":"exercise"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"zones":[{"type":"ZONE_TYPE_HEART_RATE","zones":[{"higherLimit":140,"inZone":1000}]}]}]}"#,
                "invalid-supported-artifact",
            ),
            (
                locator,
                r#"{"identifier":{"id":"synthetic"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"exercises":[{"identifier":{"id":"exercise"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"zones":[{"type":"ZONE_TYPE_SPEED","zones":[{"lowerLimit":10,"higherLimit":9,"inZone":1000}]}]}]}"#,
                "invalid-supported-artifact",
            ),
            (
                locator,
                r#"{"identifier":{"id":"synthetic"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"exercises":[{"identifier":{"id":"exercise"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"zones":[{"type":"ZONE_TYPE_HEART_RATE","zones":[{"lowerLimit":120,"higherLimit":140,"inZone":-1}]}]}]}"#,
                "invalid-supported-artifact",
            ),
            (
                locator,
                r#"{"identifier":{"id":"synthetic"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"exercises":[{"identifier":{"id":"exercise"},"created":"2026-01-02T12:00:00.000","modified":"2026-01-02T12:05:00.000","startTime":"2026-01-02T10:30:00","stopTime":"2026-01-02T11:30:00","durationMillis":3600000,"zones":[{"type":"ZONE_TYPE_HEART_RATE","zones":[{"lowerLimit":120,"higherLimit":140,"distanceMeters":10}]}]}]}"#,
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

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct UpgradeMatrixEvidence {
        release: UpgradeMatrixRelease,
        supported_library_schema_versions: Vec<i64>,
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct UpgradeMatrixRelease {
        library_schema_version: i64,
    }

    fn create_schema_baseline(connection: &Connection, version: i64) {
        let migrations = [
            SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V5, SCHEMA_V6, SCHEMA_V7, SCHEMA_V8,
            SCHEMA_V9, SCHEMA_V10, SCHEMA_V11, SCHEMA_V12, SCHEMA_V13, SCHEMA_V14, SCHEMA_V15,
            SCHEMA_V16, SCHEMA_V17, SCHEMA_V18, SCHEMA_V19, SCHEMA_V20, SCHEMA_V21, SCHEMA_V22,
            SCHEMA_V23, SCHEMA_V24, SCHEMA_V25, SCHEMA_V26,
        ];
        for migration in migrations
            .iter()
            .take(usize::try_from(version).expect("positive schema version"))
        {
            connection
                .execute_batch(migration)
                .expect("declared baseline migration");
        }
        connection
            .pragma_update(None, "user_version", version)
            .expect("declared baseline marker");
    }

    #[test]
    fn migrates_signal_samples_to_compact_series_identity_without_changing_evidence() {
        let harness = Harness::new();
        let connection = Connection::open(harness.database()).expect("database");
        create_schema_baseline(&connection, 23);
        connection
            .execute(
                "INSERT INTO observation_origin (
                     id, source_provider, correlation_state, created_at_utc
                 ) VALUES ('synthetic-origin', 'polar-flow', 'verified',
                     '2026-01-01T00:00:00Z')",
                [],
            )
            .expect("signal migration origin");
        connection
            .execute(
                "INSERT INTO training_session (
                     origin_id, session_id, source_modified_at_utc,
                     started_at_local, stopped_at_local, duration_milliseconds,
                     exercise_count
                 ) VALUES (
                     'synthetic-origin', 'synthetic-session', '2026-01-01T23:00:00Z',
                     '2026-01-01T06:00:00', '2026-01-01T07:00:00', 3600000, 1
                 )",
                [],
            )
            .expect("signal migration session");
        connection
            .execute(
                "INSERT INTO training_session_structure (
                     origin_id, session_id, exercises_present, mapping_version
                 ) VALUES (
                     'synthetic-origin', 'synthetic-session', 1, 'synthetic-structure@1'
                 )",
                [],
            )
            .expect("signal migration structure");
        connection
            .execute(
                "INSERT INTO training_exercise (
                     origin_id, session_id, exercise_id, ordinal,
                     started_at_local, stopped_at_local, duration_milliseconds,
                     manual_laps_present, automatic_laps_present, pauses_present
                 ) VALUES (
                     'synthetic-origin', 'synthetic-session', 'synthetic-exercise', 0,
                     '2026-01-01T06:00:00', '2026-01-01T07:00:00', 3600000,
                     0, 0, 0
                 )",
                [],
            )
            .expect("signal migration exercise");
        connection
            .execute(
                "INSERT INTO training_session_signal_assessment (
                     origin_id, session_id, exercises_present, mapping_version
                 ) VALUES (
                     'synthetic-origin', 'synthetic-session', 1, 'synthetic-signals@1'
                 )",
                [],
            )
            .expect("signal migration session assessment");
        connection
            .execute(
                "INSERT INTO training_exercise_signal_assessment (
                     origin_id, session_id, exercise_id, ordinal, signals_present,
                     primary_present, transition_present,
                     unsupported_primary_series_count,
                     unsupported_transition_series_count
                 ) VALUES (
                     'synthetic-origin', 'synthetic-session', 'synthetic-exercise', 0,
                     1, 1, 1, 0, 0
                 )",
                [],
            )
            .expect("signal migration exercise assessment");
        connection
            .execute(
                "INSERT INTO training_signal_series (
                     origin_id, session_id, exercise_id, role, ordinal, kind, unit,
                     interval_milliseconds, sample_count, available_sample_count
                 ) VALUES (
                     'synthetic-origin', 'synthetic-session', 'synthetic-exercise',
                     'primary', 0, 'heart-rate', 'beats-per-minute', 1000, 3, 2
                 )",
                [],
            )
            .expect("signal migration series");
        connection
            .execute_batch(
                "INSERT INTO training_signal_sample (
                     origin_id, session_id, exercise_id, role, series_ordinal,
                     ordinal, value
                 ) VALUES
                     ('synthetic-origin', 'synthetic-session', 'synthetic-exercise',
                      'primary', 0, 0, 120),
                     ('synthetic-origin', 'synthetic-session', 'synthetic-exercise',
                      'primary', 0, 1, NULL),
                     ('synthetic-origin', 'synthetic-session', 'synthetic-exercise',
                      'primary', 0, 2, 140);",
            )
            .expect("signal migration samples");

        migrate_schema(&connection, false).expect("compact signal migration");

        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("compact schema marker"),
            SCHEMA_VERSION
        );
        let logical_samples = connection
            .prepare(
                "SELECT series.origin_id, series.session_id, series.exercise_id,
                        series.role, series.ordinal, sample.ordinal, sample.value
                 FROM training_signal_series AS series
                 JOIN training_signal_sample AS sample
                   ON sample.series_id = series.series_id
                 ORDER BY sample.ordinal",
            )
            .expect("compact signal evidence query")
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, i64>(5)?,
                    row.get::<_, Option<f64>>(6)?,
                ))
            })
            .expect("compact signal evidence rows")
            .collect::<rusqlite::Result<Vec<_>>>()
            .expect("compact signal evidence");
        assert_eq!(
            logical_samples,
            vec![
                (
                    "synthetic-origin".to_owned(),
                    "synthetic-session".to_owned(),
                    "synthetic-exercise".to_owned(),
                    "primary".to_owned(),
                    0,
                    0,
                    Some(120.0),
                ),
                (
                    "synthetic-origin".to_owned(),
                    "synthetic-session".to_owned(),
                    "synthetic-exercise".to_owned(),
                    "primary".to_owned(),
                    0,
                    1,
                    None,
                ),
                (
                    "synthetic-origin".to_owned(),
                    "synthetic-session".to_owned(),
                    "synthetic-exercise".to_owned(),
                    "primary".to_owned(),
                    0,
                    2,
                    Some(140.0),
                ),
            ]
        );
        assert_eq!(
            connection
                .prepare("PRAGMA foreign_key_check")
                .expect("foreign-key check")
                .query_map([], |_| Ok(()))
                .expect("foreign-key rows")
                .count(),
            0
        );
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM library_maintenance", [], |row| {
                    row.get::<_, i64>(0)
                })
                .expect("completed signal-storage maintenance"),
            0
        );
    }

    #[test]
    fn retains_and_retries_signal_storage_maintenance_after_vacuum_failure() {
        let harness = Harness::new();
        let connection = Connection::open(harness.database()).expect("database");
        create_schema_baseline(&connection, 24);
        connection
            .execute_batch("BEGIN;")
            .expect("maintenance failure transaction");

        migrate_schema(&connection, false).expect_err("VACUUM inside a transaction must fail");

        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM library_maintenance", [], |row| {
                    row.get::<_, i64>(0)
                })
                .expect("retained signal-storage maintenance"),
            1
        );
        connection
            .execute_batch("ROLLBACK;")
            .expect("finish maintenance failure transaction");

        migrate_schema(&connection, false).expect("retry signal-storage maintenance");

        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM library_maintenance", [], |row| {
                    row.get::<_, i64>(0)
                })
                .expect("completed signal-storage maintenance retry"),
            0
        );
        assert_integrity(&connection);
    }

    #[test]
    fn upgrades_version_twenty_four_with_atomic_exercise_owned_range_storage() {
        let harness = Harness::new();
        let connection = Connection::open(harness.database()).expect("database");
        create_schema_baseline(&connection, 24);

        let error = migrate_schema(&connection, true).expect_err("interrupted range migrations");
        assert!(matches!(error, ImportError::InjectedMigrationInterruption));
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("retained schema version"),
            24
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_schema
                     WHERE type = 'table' AND name = 'training_session_range'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("rolled-back personal range table"),
            0
        );

        migrate_schema(&connection, false).expect("current range migrations");
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("current schema version"),
            SCHEMA_VERSION
        );
        let range_ref = format!("range-{}", "a".repeat(64));
        let evidence_revision = format!("range-evidence-{}", "b".repeat(64));
        connection
            .execute(
                "INSERT INTO training_session_range (
                     range_id, origin_id, session_id, exercise_id, coordinate_scope, title,
                     started_at_elapsed_milliseconds, ended_at_elapsed_milliseconds,
                     evidence_revision, authorship, state, revision,
                     created_at_utc, updated_at_utc
                 ) VALUES (
                     ?1, 'preserved-origin', 'preserved-session', 'preserved-exercise',
                     'exercise-elapsed', 'Bridge to bend',
                     1000, 2000, ?2, 'user', 'review-required', 3,
                     '2026-08-22T12:00:00.000Z', '2026-08-22T12:00:00.000Z'
                 )",
                params![range_ref, evidence_revision],
            )
            .expect("valid preserved personal range");
        assert!(connection
            .execute(
                "UPDATE training_session_range
                 SET ended_at_elapsed_milliseconds = started_at_elapsed_milliseconds",
                [],
            )
            .is_err());
        assert_integrity(&connection);
    }

    #[test]
    fn preserves_version_twenty_five_ranges_as_unassigned_review_evidence() {
        let harness = Harness::new();
        let connection = Connection::open(harness.database()).expect("database");
        create_schema_baseline(&connection, 25);
        let range_ref = format!("range-{}", "a".repeat(64));
        let evidence_revision = format!("range-evidence-{}", "b".repeat(64));
        connection
            .execute(
                "INSERT INTO training_session_range (
                     range_id, origin_id, session_id, title,
                     started_at_elapsed_milliseconds, ended_at_elapsed_milliseconds,
                     evidence_revision, authorship, state, revision,
                     created_at_utc, updated_at_utc
                 ) VALUES (
                     ?1, 'legacy-origin', 'legacy-session', 'Preserved selection',
                     1000, 2000, ?2, 'user', 'current', 3,
                     '2026-08-22T12:00:00.000Z', '2026-08-22T12:00:00.000Z'
                 )",
                params![range_ref, evidence_revision],
            )
            .expect("version twenty-five range");

        let error = migrate_schema(&connection, true).expect_err("interrupted exercise migration");
        assert!(matches!(error, ImportError::InjectedMigrationInterruption));
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("retained version twenty-five marker"),
            25
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT state FROM training_session_range WHERE range_id = ?1",
                    params![range_ref],
                    |row| row.get::<_, String>(0),
                )
                .expect("retained pre-migration range state"),
            "current"
        );

        migrate_schema(&connection, false).expect("exercise-owned range migration");
        let preserved = connection
            .query_row(
                "SELECT exercise_id, coordinate_scope, state, revision,
                        started_at_elapsed_milliseconds, ended_at_elapsed_milliseconds, title,
                        evidence_revision, authorship, created_at_utc, updated_at_utc
                 FROM training_session_range WHERE range_id = ?1",
                params![range_ref],
                |row| {
                    Ok((
                        row.get::<_, Option<String>>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, i64>(3)?,
                        row.get::<_, i64>(4)?,
                        row.get::<_, i64>(5)?,
                        row.get::<_, String>(6)?,
                        row.get::<_, String>(7)?,
                        row.get::<_, String>(8)?,
                        row.get::<_, String>(9)?,
                        row.get::<_, String>(10)?,
                    ))
                },
            )
            .expect("preserved legacy range");
        assert_eq!(
            preserved,
            (
                None,
                "legacy-session-elapsed".to_owned(),
                "review-required".to_owned(),
                3,
                1_000,
                2_000,
                "Preserved selection".to_owned(),
                evidence_revision,
                "user".to_owned(),
                "2026-08-22T12:00:00.000Z".to_owned(),
                "2026-08-22T12:00:00.000Z".to_owned(),
            )
        );
        assert_integrity(&connection);
    }

    fn assert_integrity(connection: &Connection) {
        assert_eq!(
            connection
                .query_row("PRAGMA integrity_check", [], |row| row.get::<_, String>(0))
                .expect("SQLite integrity result"),
            "ok"
        );
    }

    #[test]
    fn migrates_every_declared_library_schema_baseline_atomically() {
        let matrix: UpgradeMatrixEvidence =
            serde_json::from_str(include_str!("../../release/upgrade-matrix.json"))
                .expect("upgrade matrix");
        assert_eq!(matrix.release.library_schema_version, SCHEMA_VERSION);

        for baseline in matrix.supported_library_schema_versions {
            let harness = Harness::new();
            let connection = Connection::open(harness.database()).expect("baseline database");
            create_schema_baseline(&connection, baseline);
            assert_integrity(&connection);

            if baseline < SCHEMA_VERSION {
                let error = migrate_schema(&connection, true).expect_err("interrupted migration");
                assert!(matches!(error, ImportError::InjectedMigrationInterruption));
                assert_eq!(
                    connection
                        .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                        .expect("rolled-back schema marker"),
                    baseline
                );
                assert_integrity(&connection);
            }

            migrate_schema(&connection, false).expect("declared baseline migration");
            assert_eq!(
                connection
                    .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                    .expect("target schema marker"),
                SCHEMA_VERSION
            );
            assert_eq!(
                connection
                    .query_row("SELECT COUNT(*) FROM library_maintenance", [], |row| {
                        row.get::<_, i64>(0)
                    })
                    .expect("completed schema maintenance"),
                0
            );
            assert_integrity(&connection);
        }
    }

    #[test]
    fn upgrades_version_twenty_one_reports_losslessly_and_atomically() {
        let harness = Harness::new();
        let connection = Connection::open(harness.database()).expect("database");
        create_schema_baseline(&connection, 21);
        let report_ref = format!("report-{}", "a".repeat(64));
        let session_ref = format!("session-{}", "b".repeat(64));
        let snapshot_ref = format!("training-snapshot-{}", "c".repeat(64));
        let session_block_ref = format!("report-block-{}", "d".repeat(64));
        let route_block_ref = format!("report-block-{}", "e".repeat(64));
        let narrative_block_ref = format!("report-block-{}", "f".repeat(64));
        let route_ref = format!("route-{}", "1".repeat(64));
        connection
            .execute(
                "INSERT INTO report_definition (
                    report_ref, title, locale, source_snapshot_ref, origin_kind,
                    origin_session_ref, provenance_policy, authorship, definition_version,
                    revision, created_at_utc, updated_at_utc
                 ) VALUES (?1, 'Lossless route report', 'es-ES', ?2, 'session', ?3,
                    'current-attribution', 'user', 2, 7,
                    '2026-08-18T10:00:00.000Z', '2026-08-18T11:00:00.000Z')",
                params![report_ref, snapshot_ref, session_ref],
            )
            .expect("version twenty-one report");
        connection
            .execute(
                "INSERT INTO report_block (
                    report_ref, block_ref, ordinal, kind, session_ref,
                    include_physiological_context, route_ref, endpoint_redaction_meters,
                    narrative_body
                 ) VALUES
                    (?1, ?2, 0, 'session-evidence', ?3, 1, NULL, NULL, NULL),
                    (?1, ?4, 1, 'route', ?3, NULL, ?5, 250, NULL),
                    (?1, ?6, 2, 'narrative', NULL, NULL, NULL, NULL,
                     'The route remains user-authored evidence.')",
                params![
                    report_ref,
                    session_block_ref,
                    session_ref,
                    route_block_ref,
                    route_ref,
                    narrative_block_ref
                ],
            )
            .expect("version twenty-one report blocks");

        let error = migrate_schema(&connection, true).expect_err("interrupted report migration");
        assert!(matches!(error, ImportError::InjectedMigrationInterruption));
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("rolled-back version"),
            21
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM pragma_table_info('report_block')
                     WHERE name = 'question_kind'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("rolled-back analytical column count"),
            0
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM report_block WHERE report_ref = ?1",
                    params![report_ref],
                    |row| row.get::<_, i64>(0),
                )
                .expect("rolled-back report block count"),
            3
        );

        migrate_schema(&connection, false).expect("recovered report migration");
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("upgraded version"),
            SCHEMA_VERSION
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT title || '|' || locale || '|' || definition_version || '|' || revision
                     FROM report_definition WHERE report_ref = ?1",
                    params![report_ref],
                    |row| row.get::<_, String>(0),
                )
                .expect("preserved report definition"),
            "Lossless route report|es-ES|2|7"
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT kind || '|' || route_ref || '|' || endpoint_redaction_meters
                     FROM report_block WHERE report_ref = ?1 AND ordinal = 1",
                    params![report_ref],
                    |row| row.get::<_, String>(0),
                )
                .expect("preserved route block"),
            format!("route|{route_ref}|250")
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM report_block
                     WHERE report_ref = ?1 AND question_kind IS NULL",
                    params![report_ref],
                    |row| row.get::<_, i64>(0),
                )
                .expect("preserved non-analytical shape"),
            3
        );
        assert_integrity(&connection);
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
                     WHERE type = 'table' AND name IN (
                         'training_session',
                         'training_session_provenance',
                         'training_session_conflict',
                         'training_session_structure',
                         'training_exercise',
                         'training_lap',
                         'training_pause'
                     )",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("training tables"),
            7
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
    fn persists_the_versioned_application_preference_set_across_library_reopens() {
        let harness = Harness::new();

        assert_eq!(
            load_application_preferences_record(&harness.database())
                .expect("empty application preferences"),
            None
        );
        let preferences =
            ApplicationPreferences::new(LocalePreference::EsEs, AppearancePreference::Dark, 170)
                .expect("valid application preferences");
        save_application_preferences(&harness.database(), &preferences)
            .expect("saved application preferences");
        assert_eq!(
            load_application_preferences_record(&harness.database())
                .expect("reopened application preferences"),
            Some(StoredApplicationPreferences {
                version: 1,
                locale: "es-ES".to_owned(),
                appearance: "dark".to_owned(),
                content_zoom_percent: 170,
            })
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
                    "SELECT locale FROM application_preference WHERE id = 1",
                    [],
                    |row| row.get::<_, String>(0),
                )
                .expect("preserved preference"),
            "es-ES"
        );
    }

    #[test]
    fn upgrades_version_nine_preferences_atomically_and_preserves_the_locale() {
        let harness = Harness::new();
        let connection = Connection::open(harness.database()).expect("database");
        connection
            .execute_batch("PRAGMA foreign_keys = ON;")
            .expect("foreign keys");
        create_schema_baseline(&connection, 9);
        connection
            .execute(
                "INSERT INTO locale_preference (id, locale, updated_at_utc)
                 VALUES (1, 'es-ES', '2026-08-18T12:00:00Z')",
                [],
            )
            .expect("version nine locale");

        let error = migrate_schema(&connection, true).expect_err("interrupted version ten");
        assert!(matches!(error, ImportError::InjectedMigrationInterruption));
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("retained schema version"),
            9
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_schema
                     WHERE type = 'table' AND name = 'locale_preference'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("rolled-back locale table"),
            1
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_schema
                     WHERE type = 'table' AND name = 'application_preference'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("rolled-back application table"),
            0
        );

        migrate_schema(&connection, false).expect("version ten migration");
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("current schema version"),
            SCHEMA_VERSION
        );
        assert_eq!(
            load_application_preferences_record(&harness.database()).expect("migrated preferences"),
            Some(StoredApplicationPreferences {
                version: 1,
                locale: "es-ES".to_owned(),
                appearance: "system".to_owned(),
                content_zoom_percent: 100,
            })
        );
    }

    #[test]
    fn upgrades_version_ten_with_an_atomic_constrained_exploration_workspace() {
        let harness = Harness::new();
        let connection = Connection::open(harness.database()).expect("database");
        connection
            .execute_batch("PRAGMA foreign_keys = ON;")
            .expect("foreign keys");
        create_schema_baseline(&connection, 10);

        let error = migrate_schema(&connection, true).expect_err("interrupted version eleven");
        assert!(matches!(error, ImportError::InjectedMigrationInterruption));
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("retained schema version"),
            10
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_schema
                     WHERE type = 'table' AND name = 'exploration_workspace'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("rolled-back workspace table"),
            0
        );

        migrate_schema(&connection, false).expect("version eleven migration");
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("current schema version"),
            SCHEMA_VERSION
        );
        connection
            .execute(
                "INSERT INTO exploration_workspace (
                     id, workspace_version, destination, updated_at_utc
                 ) VALUES (1, 1, 'training', '2026-08-18T15:00:00Z')",
                [],
            )
            .expect("valid workspace");
        assert!(connection
            .execute(
                "UPDATE exploration_workspace SET destination = 'provider-route' WHERE id = 1",
                [],
            )
            .is_err());
        assert!(connection
            .execute(
                "UPDATE exploration_workspace SET workspace_version = 2 WHERE id = 1",
                [],
            )
            .is_err());
    }

    #[test]
    fn upgrades_version_eleven_with_atomic_constrained_sport_classification() {
        let harness = Harness::new();
        let connection = Connection::open(harness.database()).expect("database");
        connection
            .execute_batch("PRAGMA foreign_keys = ON;")
            .expect("foreign keys");
        create_schema_baseline(&connection, 11);

        let error = migrate_schema(&connection, true).expect_err("interrupted version twelve");
        assert!(matches!(error, ImportError::InjectedMigrationInterruption));
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("retained schema version"),
            11
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_schema
                     WHERE type = 'table' AND name = 'sport_classification'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("rolled-back sport classification table"),
            0
        );

        migrate_schema(&connection, false).expect("version twelve migration");
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
                     WHERE type = 'index' AND name = 'training_session_origin_sport_start'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("sport discovery index"),
            1
        );
        connection
            .execute(
                "INSERT INTO observation_origin (
                     id, source_provider, correlation_state, created_at_utc
                 ) VALUES (
                     'synthetic-origin', 'synthetic-provider', 'verified',
                     '2026-08-18T17:00:00Z'
                 )",
                [],
            )
            .expect("synthetic origin");
        connection
            .execute(
                "INSERT INTO sport_classification (
                     origin_id, source_sport_ref, classification_state, canonical_family,
                     display_label, authorship, revision, updated_at_utc
                 ) VALUES (
                     'synthetic-origin', 'opaque-sport', 'classified', 'cycling',
                     'Gravel cycling', 'user', 1, '2026-08-18T17:01:00Z'
                 )",
                [],
            )
            .expect("valid sport classification");
        assert!(connection
            .execute(
                "INSERT INTO sport_classification (
                     origin_id, source_sport_ref, classification_state, canonical_family,
                     display_label, authorship, revision, updated_at_utc
                 ) VALUES (
                     'synthetic-origin', 'invalid-unknown', 'unknown', 'running',
                     NULL, 'user', 1, '2026-08-18T17:02:00Z'
                 )",
                [],
            )
            .is_err());
        assert!(connection
            .execute(
                "INSERT INTO sport_classification (
                     origin_id, source_sport_ref, classification_state, canonical_family,
                     display_label, authorship, revision, updated_at_utc
                 ) VALUES (
                     'synthetic-origin', 'invalid-family', 'classified', 'provider-running',
                     NULL, 'user', 1, '2026-08-18T17:03:00Z'
                 )",
                [],
            )
            .is_err());
    }

    #[test]
    fn upgrades_version_twelve_with_atomic_training_discovery_evidence() {
        let harness = Harness::new();
        let connection = Connection::open(harness.database()).expect("database");
        connection
            .execute_batch("PRAGMA foreign_keys = ON;")
            .expect("foreign keys");
        create_schema_baseline(&connection, 12);

        let error = migrate_schema(&connection, true).expect_err("interrupted version thirteen");
        assert!(matches!(error, ImportError::InjectedMigrationInterruption));
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("retained schema version"),
            12
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_schema
                     WHERE type = 'table' AND name = 'training_discovery_revision'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("rolled-back discovery revision"),
            0
        );

        migrate_schema(&connection, false).expect("version thirteen migration");
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("current schema version"),
            SCHEMA_VERSION
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT revision FROM training_discovery_revision WHERE id = 1",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("initial discovery revision"),
            1
        );
        for index in [
            "training_session_duration_start_identity",
            "training_session_distance_start_identity",
        ] {
            assert_eq!(
                connection
                    .query_row(
                        "SELECT COUNT(*) FROM sqlite_schema WHERE type = 'index' AND name = ?1",
                        [index],
                        |row| row.get::<_, i64>(0),
                    )
                    .expect("training discovery index"),
                1
            );
        }

        connection
            .execute(
                "INSERT INTO observation_origin (
                     id, source_provider, correlation_state, created_at_utc
                 ) VALUES (
                     'discovery-origin', 'synthetic-provider', 'verified',
                     '2026-08-18T18:00:00Z'
                 )",
                [],
            )
            .expect("synthetic origin");
        connection
            .execute(
                "INSERT INTO training_session (
                     origin_id, session_id, source_modified_at_utc, started_at_local,
                     stopped_at_local, utc_offset_minutes, duration_milliseconds,
                     distance_meters, energy_kilocalories, average_heart_rate_bpm,
                     maximum_heart_rate_bpm, sport_ref, exercise_count
                 ) VALUES (
                     'discovery-origin', 'session-1', '2026-08-18T18:00:00Z',
                     '2026-08-18T18:00:00', '2026-08-18T19:00:00', 120, 3600000,
                     10000, 600, 145, 175, 'running', 1
                 )",
                [],
            )
            .expect("training mutation");
        connection
            .execute(
                "INSERT INTO sport_classification (
                     origin_id, source_sport_ref, classification_state, canonical_family,
                     display_label, authorship, revision, updated_at_utc
                 ) VALUES (
                     'discovery-origin', 'running', 'classified', 'running',
                     'Trail running', 'user', 1, '2026-08-18T18:01:00Z'
                 )",
                [],
            )
            .expect("classification mutation");
        assert_eq!(
            connection
                .query_row(
                    "SELECT revision FROM training_discovery_revision WHERE id = 1",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("advanced discovery revision"),
            3
        );
    }

    #[test]
    fn upgrades_version_thirteen_with_an_atomic_training_discovery_workspace() {
        let harness = Harness::new();
        let connection = Connection::open(harness.database()).expect("database");
        connection
            .execute_batch("PRAGMA foreign_keys = ON;")
            .expect("foreign keys");
        create_schema_baseline(&connection, 13);

        let error = migrate_schema(&connection, true).expect_err("interrupted version fourteen");
        assert!(matches!(error, ImportError::InjectedMigrationInterruption));
        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("retained schema version"),
            13
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_schema
                     WHERE type = 'table' AND name = 'training_discovery_workspace'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("rolled-back workspace table"),
            0
        );

        migrate_schema(&connection, false).expect("version fourteen migration");
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
                     WHERE type = 'table' AND name = 'training_discovery_workspace'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .expect("workspace table"),
            1
        );
        assert_integrity(&connection);
    }
}
