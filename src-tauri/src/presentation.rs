use std::{collections::BTreeMap, path::PathBuf};

use serde::{Deserialize, Serialize};

use fitfreed_application::{
    ActivityComparison, ActivityDateRange, ActivityDayAvailability, ActivityDayInsight,
    ActivityOverview, ActivitySeriesComparison, ActivitySeriesOverview, ActivitySeriesSummary,
    AdjustTrainingSessionRangeRequest, AppearancePreference, ApplicationError,
    ApplicationPreferences, ApplicationPreferencesLoad, AppliedTrainingSegmentCriterion,
    CreateComposedSessionReportRequest, CreateReportRequest, CreateSessionReportRequest,
    CreateTrainingSegmentCriterionRequest, CreateTrainingSessionRangeRequest,
    ExpectedSourceArchive, ExplorationWorkspace, ExploreDestination, HistoricalTrainingHighlight,
    HistoricalTrainingReason, ImportPhase, ImportProgress, InvalidApplicationPreferences,
    LibraryDomain, LibraryDomainCoverage, LibraryHistoryHighlight, LibraryHome,
    LibraryHomeDateRange, LibraryHomeHighlight, LibraryHomePrimaryRange, LibraryHomeRangeScope,
    LibraryHomeRecentSession, LibraryHomeRequest, LibraryHomeSportSummary, LibraryHomeTraining,
    LibraryHomeTrainingComparison, LibraryHomeTrainingPeriod, LibraryMeasurement,
    LibraryMeasurementCoverage, LibraryQuestion, LibraryQuestionKind, LocalePreference,
    LongitudinalActivityComparison, LongitudinalActivityDay, LongitudinalComparison,
    LongitudinalDateRange, LongitudinalDayInsight, LongitudinalOverview,
    LongitudinalRecoveryComparison, LongitudinalRecoveryDay, LongitudinalSeriesComparison,
    LongitudinalSeriesOverview, LongitudinalSleepComparison, LongitudinalSleepDay,
    LongitudinalTrainingComparison, LongitudinalTrainingDay, ManualUpdateReason,
    MoveTrainingSegmentCriterionRequest, OfficialSourceLink, OfficialSourceLinkOpenError,
    OfficialSourceLinkPurpose, OpenOfficialSourceLinkOutcome, OpenOfficialSourceLinkRequest,
    PersistedTrainingRangeSummaryExercise, PersistedTrainingRoutePoints,
    PersistedTrainingSignalSamples, PostImportReveal, PreferencesLoadStatus, PreparedReportStart,
    RecoveryComparison, RecoveryDateRange, RecoveryDayAvailability, RecoveryDayInsight,
    RecoveryNightDetail, RecoveryNightInsight, RecoveryOverview, RecoverySeriesComparison,
    RecoverySeriesOverview, RecoverySeriesSummary, RefreshReportRequest, RemoveReportRequest,
    RemoveTrainingSessionRangeRequest, RemovedReport, RenameTrainingSessionRangeRequest,
    ReportEvidenceProvenance, ReportExportReceipt, ReportExportRequest,
    ReportLibraryComparisonSeries, ReportLibraryEvidenceState, ReportLibraryItem,
    ReportLibraryMetricValue, ReportLibraryPage, ReportLibraryPeriod, ReportLibraryRequest,
    ReportLibraryResult, ReportLibrarySensitivity, ReportLibrarySubject, ReportLimitation,
    ReportResolutionStatus, ReportRouteEvidence, ReportRouteExportChoice, ReportSensitiveContent,
    ReportSensitiveContentKind, ReportSessionEvidence, ReportStart, ReportSummary, ResolvedReport,
    ResolvedSessionReport, SaveSportClassificationRequest, SavedTrainingSportClassification,
    SegmentApplicabilityView, SegmentMeasurementView, SessionReportBlockDraft,
    SessionReportBlockDraftContent, SessionStory, SessionStoryAlignedSampleView,
    SessionStoryAlignmentStateView, SessionStoryAssessmentStateView, SessionStoryCompositionView,
    SessionStoryExactRoute, SessionStoryExactSignal, SessionStoryExercise,
    SessionStoryExerciseEvidenceView, SessionStoryMetricView, SessionStoryOverlayView,
    SessionStoryProvenance, SessionStoryQuery, SessionStoryRole, SessionStoryRoleEvidenceView,
    SessionStoryValueTransform, SleepComparison, SleepDateRange, SleepDayAvailability,
    SleepDayInsight, SleepOverview, SleepPeriodDetail, SleepPeriodInsight, SleepPhaseTotals,
    SleepSeriesComparison, SleepSeriesOverview, SleepSeriesSummary, SourceAcquisitionGuide,
    SportClassificationSaveOutcome, TrainingComparison, TrainingDateRange, TrainingDerivedSegment,
    TrainingDiscoveryView, TrainingDiscoveryWorkspace, TrainingExerciseRoutesView,
    TrainingExerciseSegmentation, TrainingExerciseSignalsView, TrainingExerciseStructure,
    TrainingExerciseZonesView, TrainingLapStructure, TrainingMeasurementFilter,
    TrainingPauseStructure, TrainingProvenanceCurrentView, TrainingProvenanceDecisionView,
    TrainingProvenanceEventView, TrainingRangeBoundaryEvidence, TrainingRangeBoundaryEvidenceState,
    TrainingRangeBoundaryPair, TrainingRangeCardinalDirection, TrainingRangeCoordinateEvidence,
    TrainingRangeDirectionSummary, TrainingRangeDistanceSummary, TrainingRangeEvidenceCoverage,
    TrainingRangeEvidenceLocation, TrainingRangeExactEvidenceKind,
    TrainingRangeIndependentEvidence, TrainingRangeMeasurementSummary, TrainingRangeMetricCoverage,
    TrainingRangeMissingInterval, TrainingRangeSourceOverlap, TrainingRangeSourceOverlapRelation,
    TrainingRangeSourceRangeKind, TrainingRangeSummaryCoverageState,
    TrainingRangeSummaryLimitation, TrainingRouteCollectionView, TrainingRouteKindView,
    TrainingRouteOverview, TrainingRoutePointView, TrainingRoutePointsQuery,
    TrainingSegmentCriterionDirection, TrainingSegmentCriterionMutationRequest,
    TrainingSeriesComparison, TrainingSeriesSummary, TrainingSessionCalendar,
    TrainingSessionCalendarDay, TrainingSessionCalendarRequest, TrainingSessionProvenanceQuery,
    TrainingSessionProvenanceResult, TrainingSessionRangeCoordinateContext,
    TrainingSessionRangeExerciseContext, TrainingSessionRangeSummary,
    TrainingSessionRangeSummaryQuery, TrainingSessionRangesQuery, TrainingSessionRangesResult,
    TrainingSessionRouteQuery, TrainingSessionRoutesResult, TrainingSessionRoutesView,
    TrainingSessionSearchItem, TrainingSessionSearchPage, TrainingSessionSearchRequest,
    TrainingSessionSearchSummary, TrainingSessionSegmentationQuery,
    TrainingSessionSegmentationResult, TrainingSessionSelection, TrainingSessionSelectionRequest,
    TrainingSessionSignalsQuery, TrainingSessionSignalsResult, TrainingSessionSignalsView,
    TrainingSessionSort, TrainingSessionSport, TrainingSessionStructureQuery,
    TrainingSessionStructureResult, TrainingSessionZonesQuery, TrainingSessionZonesResult,
    TrainingSessionZonesView, TrainingSignalCollectionView, TrainingSignalKindView,
    TrainingSignalRoleView, TrainingSignalSampleView, TrainingSignalSamplesQuery,
    TrainingSignalSeriesOverview, TrainingSignalUnitView, TrainingSignalVisualSampleView,
    TrainingSourceProviderView, TrainingSport, TrainingSportClassification, TrainingSportCoverage,
    TrainingSportRecognition, TrainingSportState, TrainingSportsOverview, TrainingStructure,
    TrainingZoneCollectionView, TrainingZoneGroupView, TrainingZoneKindView, TrainingZoneUnitView,
    TrainingZoneView, UpdateCheckOutcome, UpdateCheckStatus, UpdateComposedSessionReportRequest,
    UpdateError, UpdateRecoveryOutcome, UpdateRecoveryOutcomeKind, UpdateReleaseSummary,
    UpdateReportRequest, UpdateSessionReportRequest, UpdateTrainingSegmentCriterionRequest,
    UpdateTrustFailure, UpdateWithdrawalReason, UpdateWithdrawalSummary,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ApplicationPreferencesInputDto {
    locale: String,
    appearance: String,
    content_zoom_percent: u16,
}

impl TryFrom<ApplicationPreferencesInputDto> for ApplicationPreferences {
    type Error = InvalidApplicationPreferences;

    fn try_from(input: ApplicationPreferencesInputDto) -> Result<Self, Self::Error> {
        let locale = fitfreed_application::LocalePreference::from_code(&input.locale)
            .ok_or(InvalidApplicationPreferences::Locale)?;
        let appearance = AppearancePreference::from_code(&input.appearance)
            .ok_or(InvalidApplicationPreferences::Appearance)?;
        Self::new(locale, appearance, input.content_zoom_percent)
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationPreferencesDto {
    version: u32,
    locale: &'static str,
    appearance: &'static str,
    content_zoom_percent: u16,
}

impl From<ApplicationPreferences> for ApplicationPreferencesDto {
    fn from(preferences: ApplicationPreferences) -> Self {
        Self {
            version: preferences.version,
            locale: preferences.locale.code(),
            appearance: preferences.appearance.code(),
            content_zoom_percent: preferences.content_zoom_percent,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationPreferencesLoadDto {
    preferences: ApplicationPreferencesDto,
    status: &'static str,
}

impl From<ApplicationPreferencesLoad> for ApplicationPreferencesLoadDto {
    fn from(load: ApplicationPreferencesLoad) -> Self {
        Self {
            preferences: load.preferences.into(),
            status: match load.status {
                PreferencesLoadStatus::Current => "current",
                PreferencesLoadStatus::Initialized => "initialized",
                PreferencesLoadStatus::Recovered => "recovered",
            },
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSourceLinkDto {
    purpose: &'static str,
    locale: Option<&'static str>,
    url: String,
}

impl From<OfficialSourceLink> for OfficialSourceLinkDto {
    fn from(link: OfficialSourceLink) -> Self {
        Self {
            purpose: match link.purpose {
                OfficialSourceLinkPurpose::Account => "account",
                OfficialSourceLinkPurpose::Instructions => "instructions",
            },
            locale: link.locale.map(|locale| locale.code()),
            url: link.url,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceAcquisitionGuideDto {
    schema_version: u32,
    source_id: String,
    guide_version: String,
    verified_on: String,
    expected_archive: &'static str,
    instruction_keys: Vec<String>,
    constraint_keys: Vec<String>,
    troubleshooting_keys: Vec<String>,
    official_links: Vec<OfficialSourceLinkDto>,
}

impl From<SourceAcquisitionGuide> for SourceAcquisitionGuideDto {
    fn from(guide: SourceAcquisitionGuide) -> Self {
        Self {
            schema_version: guide.schema_version,
            source_id: guide.source_id,
            guide_version: guide.guide_version,
            verified_on: guide.verified_on,
            expected_archive: match guide.expected_archive {
                ExpectedSourceArchive::Zip => "zip",
            },
            instruction_keys: guide.instruction_keys,
            constraint_keys: guide.constraint_keys,
            troubleshooting_keys: guide.troubleshooting_keys,
            official_links: guide.official_links.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OpenOfficialSourceLinkRequestDto {
    source_id: String,
    purpose: String,
    locale: String,
}

impl TryFrom<OpenOfficialSourceLinkRequestDto> for OpenOfficialSourceLinkRequest {
    type Error = CommandErrorDto;

    fn try_from(request: OpenOfficialSourceLinkRequestDto) -> Result<Self, Self::Error> {
        let purpose = match request.purpose.as_str() {
            "account" => OfficialSourceLinkPurpose::Account,
            "instructions" => OfficialSourceLinkPurpose::Instructions,
            _ => return Err(CommandErrorDto::new("invalid-official-source-link-request")),
        };
        let locale = LocalePreference::from_code(&request.locale)
            .ok_or_else(|| CommandErrorDto::new("invalid-official-source-link-request"))?;
        if !is_lower_kebab_identifier(&request.source_id) {
            return Err(CommandErrorDto::new("invalid-official-source-link-request"));
        }
        Ok(Self {
            source_id: request.source_id,
            purpose,
            locale,
        })
    }
}

fn is_lower_kebab_identifier(value: &str) -> bool {
    value.len() <= 64
        && value.split('-').all(|segment| {
            !segment.is_empty()
                && segment
                    .chars()
                    .all(|character| character.is_ascii_lowercase() || character.is_ascii_digit())
        })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenOfficialSourceLinkOutcomeDto {
    source_id: String,
    purpose: &'static str,
    url: String,
}

impl From<OpenOfficialSourceLinkOutcome> for OpenOfficialSourceLinkOutcomeDto {
    fn from(outcome: OpenOfficialSourceLinkOutcome) -> Self {
        Self {
            source_id: outcome.source_id,
            purpose: match outcome.purpose {
                OfficialSourceLinkPurpose::Account => "account",
                OfficialSourceLinkPurpose::Instructions => "instructions",
            },
            url: outcome.url,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LibraryHomeRequestDto {
    after_import_operation_ref: Option<String>,
}

impl From<LibraryHomeRequestDto> for LibraryHomeRequest {
    fn from(request: LibraryHomeRequestDto) -> Self {
        Self {
            after_import_operation_ref: request.after_import_operation_ref,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryHomeDateRangeDto {
    from: String,
    through: String,
}

impl From<LibraryHomeDateRange> for LibraryHomeDateRangeDto {
    fn from(range: LibraryHomeDateRange) -> Self {
        Self {
            from: range.from,
            through: range.through,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryMeasurementCoverageDto {
    measurement: &'static str,
    available_records: usize,
    observed_records: usize,
}

impl From<LibraryMeasurementCoverage> for LibraryMeasurementCoverageDto {
    fn from(coverage: LibraryMeasurementCoverage) -> Self {
        Self {
            measurement: library_measurement(coverage.measurement),
            available_records: coverage.available_records,
            observed_records: coverage.observed_records,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryDomainCoverageDto {
    domain: &'static str,
    recorded_range: Option<LibraryHomeDateRangeDto>,
    usable_range: Option<LibraryHomeDateRangeDto>,
    selected_range: Option<LibraryHomeDateRangeDto>,
    origin_count: usize,
    observed_record_count: usize,
    measurements: Vec<LibraryMeasurementCoverageDto>,
}

impl From<LibraryDomainCoverage> for LibraryDomainCoverageDto {
    fn from(coverage: LibraryDomainCoverage) -> Self {
        Self {
            domain: library_domain(coverage.domain),
            recorded_range: coverage.recorded_range.map(Into::into),
            usable_range: coverage.usable_range.map(Into::into),
            selected_range: coverage.selected_range.map(Into::into),
            origin_count: coverage.origin_count,
            observed_record_count: coverage.observed_record_count,
            measurements: coverage.measurements.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryHomePrimaryRangeDto {
    scope: &'static str,
    range: LibraryHomeDateRangeDto,
}

impl From<LibraryHomePrimaryRange> for LibraryHomePrimaryRangeDto {
    fn from(primary: LibraryHomePrimaryRange) -> Self {
        Self {
            scope: library_home_range_scope(primary.scope),
            range: primary.range.into(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryQuestionDto {
    kind: &'static str,
    destination: &'static str,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExploreDestinationInputDto {
    Activity,
    Training,
    Sleep,
    Recovery,
    Longitudinal,
}

impl From<ExploreDestinationInputDto> for ExploreDestination {
    fn from(destination: ExploreDestinationInputDto) -> Self {
        match destination {
            ExploreDestinationInputDto::Activity => Self::Activity,
            ExploreDestinationInputDto::Training => Self::Training,
            ExploreDestinationInputDto::Sleep => Self::Sleep,
            ExploreDestinationInputDto::Recovery => Self::Recovery,
            ExploreDestinationInputDto::Longitudinal => Self::Longitudinal,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplorationWorkspaceDto {
    version: u32,
    destination: &'static str,
}

impl From<ExplorationWorkspace> for ExplorationWorkspaceDto {
    fn from(workspace: ExplorationWorkspace) -> Self {
        Self {
            version: workspace.version,
            destination: explore_destination(workspace.destination),
        }
    }
}

impl From<LibraryQuestion> for LibraryQuestionDto {
    fn from(question: LibraryQuestion) -> Self {
        Self {
            kind: library_question(question.kind),
            destination: explore_destination(question.destination),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostImportRevealDto {
    exact_repeat: bool,
    canonical_history_changed: bool,
    new_observations: usize,
    enriched_observations: usize,
    amended_observations: usize,
    unchanged_observations: usize,
    source_review_recommended: bool,
}

impl From<PostImportReveal> for PostImportRevealDto {
    fn from(reveal: PostImportReveal) -> Self {
        Self {
            exact_repeat: reveal.exact_repeat,
            canonical_history_changed: reveal.canonical_history_changed,
            new_observations: reveal.new_observations,
            enriched_observations: reveal.enriched_observations,
            amended_observations: reveal.amended_observations,
            unchanged_observations: reveal.unchanged_observations,
            source_review_recommended: reveal.source_review_recommended,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryHomeSportSummaryDto {
    sport_ref: Option<String>,
    state: &'static str,
    canonical_family: Option<String>,
    display_label: Option<String>,
    localized_names: BTreeMap<String, String>,
    recognition_candidate_count: usize,
    profile_count: usize,
    session_count: usize,
}

impl From<LibraryHomeSportSummary> for LibraryHomeSportSummaryDto {
    fn from(sport: LibraryHomeSportSummary) -> Self {
        Self {
            sport_ref: sport.sport_ref,
            state: training_sport_state_code(sport.state),
            canonical_family: sport.canonical_family,
            display_label: sport.display_label,
            localized_names: sport.localized_names,
            recognition_candidate_count: sport.recognition_candidate_count,
            profile_count: sport.profile_count,
            session_count: sport.session_count,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryHomeRecentSessionDto {
    session_ref: String,
    sport_ref: Option<String>,
    started_at_local: String,
    duration_milliseconds: String,
    distance_meters: Option<f64>,
    sport_state: &'static str,
    canonical_family: Option<String>,
    display_label: Option<String>,
    localized_names: BTreeMap<String, String>,
    recognition_candidate_count: usize,
}

impl From<LibraryHomeRecentSession> for LibraryHomeRecentSessionDto {
    fn from(session: LibraryHomeRecentSession) -> Self {
        Self {
            session_ref: session.session_ref,
            sport_ref: session.sport_ref,
            started_at_local: session.started_at_local,
            duration_milliseconds: session.duration_milliseconds.to_string(),
            distance_meters: session.distance_meters,
            sport_state: training_sport_state_code(session.sport_state),
            canonical_family: session.canonical_family,
            display_label: session.display_label,
            localized_names: session.localized_names,
            recognition_candidate_count: session.recognition_candidate_count,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryHomeTrainingDto {
    training_snapshot_ref: String,
    session_count: usize,
    sport_profile_count: usize,
    omitted_sport_profile_count: usize,
    sports: Vec<LibraryHomeSportSummaryDto>,
    recent_sessions: Vec<LibraryHomeRecentSessionDto>,
}

impl From<LibraryHomeTraining> for LibraryHomeTrainingDto {
    fn from(training: LibraryHomeTraining) -> Self {
        Self {
            training_snapshot_ref: training.training_snapshot_ref,
            session_count: training.session_count,
            sport_profile_count: training.sport_profile_count,
            omitted_sport_profile_count: training.omitted_sport_profile_count,
            sports: training.sports.into_iter().map(Into::into).collect(),
            recent_sessions: training
                .recent_sessions
                .into_iter()
                .map(Into::into)
                .collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryHomeTrainingPeriodDto {
    range: LibraryHomeDateRangeDto,
    session_count: usize,
    total_duration_milliseconds: String,
}

impl From<LibraryHomeTrainingPeriod> for LibraryHomeTrainingPeriodDto {
    fn from(period: LibraryHomeTrainingPeriod) -> Self {
        Self {
            range: period.range.into(),
            session_count: period.session_count,
            total_duration_milliseconds: period.total_duration_milliseconds.to_string(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryHomeTrainingComparisonDto {
    kind: &'static str,
    reference_date: String,
    baseline: LibraryHomeTrainingPeriodDto,
    comparison: LibraryHomeTrainingPeriodDto,
    session_count_change: String,
    duration_change_milliseconds: String,
}

impl From<LibraryHomeTrainingComparison> for LibraryHomeTrainingComparisonDto {
    fn from(comparison: LibraryHomeTrainingComparison) -> Self {
        Self {
            kind: "recent-training-comparison",
            reference_date: comparison.reference_date,
            baseline: comparison.baseline.into(),
            comparison: comparison.comparison.into(),
            session_count_change: comparison.session_count_change.to_string(),
            duration_change_milliseconds: comparison.duration_change_milliseconds.to_string(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalTrainingHighlightDto {
    kind: &'static str,
    reference_date: String,
    current_range: LibraryHomeDateRangeDto,
    latest_session_date: String,
    reason: &'static str,
}

impl From<HistoricalTrainingHighlight> for HistoricalTrainingHighlightDto {
    fn from(highlight: HistoricalTrainingHighlight) -> Self {
        Self {
            kind: "historical-training",
            reference_date: highlight.reference_date,
            current_range: highlight.current_range.into(),
            latest_session_date: highlight.latest_session_date,
            reason: match highlight.reason {
                HistoricalTrainingReason::NoCurrentTraining => "no-current-training",
                HistoricalTrainingReason::HistoryAfterReferenceDate => {
                    "history-after-reference-date"
                }
            },
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryHistoryHighlightDto {
    kind: &'static str,
    latest_evidence_date: String,
}

impl From<LibraryHistoryHighlight> for LibraryHistoryHighlightDto {
    fn from(highlight: LibraryHistoryHighlight) -> Self {
        Self {
            kind: "library-history",
            latest_evidence_date: highlight.latest_evidence_date,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum LibraryHomeHighlightDto {
    RecentTrainingComparison(LibraryHomeTrainingComparisonDto),
    HistoricalTraining(HistoricalTrainingHighlightDto),
    LibraryHistory(LibraryHistoryHighlightDto),
}

impl From<LibraryHomeHighlight> for LibraryHomeHighlightDto {
    fn from(highlight: LibraryHomeHighlight) -> Self {
        match highlight {
            LibraryHomeHighlight::RecentTrainingComparison(comparison) => {
                Self::RecentTrainingComparison(comparison.into())
            }
            LibraryHomeHighlight::HistoricalTraining(historical) => {
                Self::HistoricalTraining(historical.into())
            }
            LibraryHomeHighlight::LibraryHistory(history) => Self::LibraryHistory(history.into()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryHomeDto {
    version: u32,
    library_revision_ref: String,
    recorded_range: Option<LibraryHomeDateRangeDto>,
    usable_range: Option<LibraryHomeDateRangeDto>,
    primary_range: Option<LibraryHomePrimaryRangeDto>,
    domains: Vec<LibraryDomainCoverageDto>,
    questions: Vec<LibraryQuestionDto>,
    training: Option<LibraryHomeTrainingDto>,
    highlight: Option<LibraryHomeHighlightDto>,
    post_import: Option<PostImportRevealDto>,
    resumable_exploration: Option<ExplorationWorkspaceDto>,
}

impl From<LibraryHome> for LibraryHomeDto {
    fn from(home: LibraryHome) -> Self {
        Self {
            version: home.version,
            library_revision_ref: home.library_revision_ref,
            recorded_range: home.recorded_range.map(Into::into),
            usable_range: home.usable_range.map(Into::into),
            primary_range: home.primary_range.map(Into::into),
            domains: home.domains.into_iter().map(Into::into).collect(),
            questions: home.questions.into_iter().map(Into::into).collect(),
            training: home.training.map(Into::into),
            highlight: home.highlight.map(Into::into),
            post_import: home.post_import.map(Into::into),
            resumable_exploration: home.resumable_exploration.map(Into::into),
        }
    }
}

fn library_domain(domain: LibraryDomain) -> &'static str {
    match domain {
        LibraryDomain::Training => "training",
        LibraryDomain::Activity => "activity",
        LibraryDomain::Sleep => "sleep",
        LibraryDomain::Recovery => "recovery",
    }
}

fn library_home_range_scope(scope: LibraryHomeRangeScope) -> &'static str {
    match scope {
        LibraryHomeRangeScope::Training => "training",
        LibraryHomeRangeScope::Activity => "activity",
        LibraryHomeRangeScope::Sleep => "sleep",
        LibraryHomeRangeScope::Recovery => "recovery",
        LibraryHomeRangeScope::Combined => "combined",
    }
}

fn library_measurement(measurement: LibraryMeasurement) -> &'static str {
    match measurement {
        LibraryMeasurement::TrainingDuration => "training-duration",
        LibraryMeasurement::TrainingDistance => "training-distance",
        LibraryMeasurement::TrainingEnergy => "training-energy",
        LibraryMeasurement::TrainingHeartRate => "training-heart-rate",
        LibraryMeasurement::ActivitySteps => "activity-steps",
        LibraryMeasurement::SleepDuration => "sleep-duration",
        LibraryMeasurement::SleepInterruptions => "sleep-interruptions",
        LibraryMeasurement::SleepEfficiency => "sleep-efficiency",
        LibraryMeasurement::SleepPhases => "sleep-phases",
        LibraryMeasurement::SleepStages => "sleep-stages",
        LibraryMeasurement::SleepScore => "sleep-score",
        LibraryMeasurement::SleepGoal => "sleep-goal",
        LibraryMeasurement::SleepPowerStatus => "sleep-power-status",
        LibraryMeasurement::RecoveryBeatToBeatInterval => "recovery-beat-to-beat-interval",
        LibraryMeasurement::RecoveryHeartRateVariability => "recovery-heart-rate-variability",
        LibraryMeasurement::RecoveryBreathingInterval => "recovery-breathing-interval",
        LibraryMeasurement::RecoveryAssessment => "recovery-assessment",
        LibraryMeasurement::RecoveryBaseline => "recovery-baseline",
        LibraryMeasurement::RecoveryGuidance => "recovery-guidance",
    }
}

fn library_question(question: LibraryQuestionKind) -> &'static str {
    match question {
        LibraryQuestionKind::ExploreTrainingSessions => "explore-training-sessions",
        LibraryQuestionKind::AlignHistory => "align-history",
        LibraryQuestionKind::ReviewActivitySteps => "review-activity-steps",
        LibraryQuestionKind::ReviewSleepPatterns => "review-sleep-patterns",
        LibraryQuestionKind::ReviewRecoveryPatterns => "review-recovery-patterns",
    }
}

fn explore_destination(destination: ExploreDestination) -> &'static str {
    match destination {
        ExploreDestination::Activity => "activity",
        ExploreDestination::Training => "training",
        ExploreDestination::Sleep => "sleep",
        ExploreDestination::Recovery => "recovery",
        ExploreDestination::Longitudinal => "longitudinal",
    }
}

use fitfreed_domain::{
    ArtifactCoverageSummary, ArtifactFamilyCoverage, ImportOutcome, ImportReport, ReportAuthorship,
    ReportBlockContent, ReportDateRange, ReportDefinition, ReportLocale, ReportOrigin,
    ReportProvenancePolicy, ReportQuestion, ReportTrainingComparisonQuery, ReportTrainingMetric,
    SegmentCriterion, SegmentCriterionAuthorship, SegmentCriterionDefinition, SleepPhaseSummary,
    SleepScore, SleepStage, SleepStageTransition, SourceSpecificRecoveryAssessment,
    SourceSpecificRecoveryBaseline, SourceSpecificRecoveryGuidance, TrainingSessionRange,
    TrainingSessionRangeAuthorship, TrainingSessionRangeCoordinate,
    TrainingSessionRangeCoordinateScope, TrainingSessionRangeState,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandErrorDto {
    code: &'static str,
}

impl CommandErrorDto {
    pub const fn new(code: &'static str) -> Self {
        Self { code }
    }
}

impl From<ApplicationError> for CommandErrorDto {
    fn from(error: ApplicationError) -> Self {
        let code = match error {
            ApplicationError::ImportAlreadyActive => "import-already-active",
            ApplicationError::ExclusiveOperationAlreadyActive => "desktop-operation-active",
            ApplicationError::Coordination(_) => "import-coordination-failed",
            ApplicationError::Import(_) => "import-failed",
            ApplicationError::Query(_) => "library-query-failed",
            ApplicationError::InvalidActivityRange(_) => "invalid-activity-range",
            ApplicationError::InvalidTrainingRange(_) => "invalid-training-range",
            ApplicationError::InvalidTrainingSessionSearch(_) => "invalid-training-session-search",
            ApplicationError::TrainingSessionSearchChanged => "training-session-search-changed",
            ApplicationError::TrainingSessionSearch(_) => "training-session-search-failed",
            ApplicationError::InvalidTrainingSessionDetail(_) => "invalid-training-session-detail",
            ApplicationError::TrainingSessionDetailChanged => "training-session-detail-changed",
            ApplicationError::TrainingSessionDetail(_) => "training-session-detail-failed",
            ApplicationError::InvalidTrainingSegmentCriterion(_) => {
                "invalid-training-segment-criterion"
            }
            ApplicationError::TrainingSegmentCriterionConflict => {
                "training-segment-criterion-conflict"
            }
            ApplicationError::TrainingSegmentationChanged => "training-segmentation-changed",
            ApplicationError::TrainingSegmentationQuery(_)
            | ApplicationError::TrainingSegmentationUpdate(_) => "training-segmentation-failed",
            ApplicationError::InvalidTrainingSessionRange(_) => "invalid-training-session-range",
            ApplicationError::TrainingSessionRangeNotFound => "training-session-range-not-found",
            ApplicationError::TrainingSessionRangeConflict => "training-session-range-conflict",
            ApplicationError::TrainingSessionRangesChanged => "training-session-ranges-changed",
            ApplicationError::TrainingSessionRangeQuery(_)
            | ApplicationError::TrainingSessionRangeUpdate(_) => "training-session-range-failed",
            ApplicationError::InvalidTrainingSessionRangeSummary(_) => {
                "invalid-training-session-range-summary"
            }
            ApplicationError::TrainingSessionRangeSummaryChanged => {
                "training-session-range-summary-changed"
            }
            ApplicationError::TrainingSessionRangeSummaryQuery(_) => {
                "training-session-range-summary-failed"
            }
            ApplicationError::InvalidReportDefinition(_) => "invalid-report-definition",
            ApplicationError::ReportNotFound => "report-not-found",
            ApplicationError::ReportDefinitionConflict => "report-definition-conflict",
            ApplicationError::ReportSourceChanged => "report-source-changed",
            ApplicationError::ReportEvidenceUnavailable => "report-evidence-unavailable",
            ApplicationError::ReportDefinitionQuery(_) => "report-definition-query-failed",
            ApplicationError::ReportDefinitionUpdate(_) => "report-definition-update-failed",
            ApplicationError::ReportExportCancelled => "report-export-cancelled",
            ApplicationError::ReportExport(_) => "report-export-failed",
            ApplicationError::InvalidTrainingDiscoveryWorkspace(_) => {
                "invalid-training-discovery-workspace"
            }
            ApplicationError::TrainingDiscoveryWorkspaceQuery(_) => {
                "training-discovery-workspace-query-failed"
            }
            ApplicationError::TrainingDiscoveryWorkspaceUpdate(_) => {
                "training-discovery-workspace-update-failed"
            }
            ApplicationError::InvalidSportClassification(_) => "invalid-sport-classification",
            ApplicationError::SportClassificationConflict => "sport-classification-conflict",
            ApplicationError::SportClassificationQuery(_)
            | ApplicationError::SportClassificationUpdate(_) => "sport-classification-failed",
            ApplicationError::InvalidSleepRange(_) => "invalid-sleep-range",
            ApplicationError::InvalidSleepReference(_) => "invalid-sleep-reference",
            ApplicationError::InvalidRecoveryRange(_) => "invalid-recovery-range",
            ApplicationError::InvalidRecoveryReference(_) => "invalid-recovery-reference",
            ApplicationError::InvalidLongitudinalRange(_) => "invalid-longitudinal-range",
            ApplicationError::InvalidLibraryHomeRequest(_) => "invalid-library-home-request",
            ApplicationError::InvalidExplorationWorkspace(_) => "invalid-exploration-workspace",
            ApplicationError::WorkspaceQuery(_) => "exploration-workspace-query-failed",
            ApplicationError::WorkspaceUpdate(_) => "exploration-workspace-update-failed",
            ApplicationError::OutcomeQuery(_) => "outcome-query-failed",
            ApplicationError::SourceAcquisitionGuideQuery(_) => "source-guide-query-failed",
            ApplicationError::OfficialSourceLinkUnavailable => "official-source-link-unavailable",
            ApplicationError::OfficialSourceLinkOpen(error) => match error {
                OfficialSourceLinkOpenError::UnsupportedPlatform => {
                    "official-source-link-unsupported"
                }
                OfficialSourceLinkOpenError::PermissionDenied => {
                    "official-source-link-permission-denied"
                }
                OfficialSourceLinkOpenError::LauncherUnavailable => {
                    "official-source-link-launcher-unavailable"
                }
                OfficialSourceLinkOpenError::OperatingSystem => "official-source-link-os-failed",
                OfficialSourceLinkOpenError::Delegation => "official-source-link-delegation-failed",
            },
            ApplicationError::PreferenceQuery(_) => "preference-query-failed",
            ApplicationError::PreferenceUpdate(_) => "preference-update-failed",
        };
        Self::new(code)
    }
}

impl From<UpdateError> for CommandErrorDto {
    fn from(error: UpdateError) -> Self {
        let code = match error {
            UpdateError::Channel => "update-channel-failed",
            UpdateError::State => "update-state-unavailable",
            UpdateError::CandidateChanged => "update-candidate-changed",
            UpdateError::InvalidPreference => "invalid-update-preference",
            UpdateError::InstallationNotAllowed => "update-installation-not-allowed",
        };
        Self::new(code)
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateReleaseSummaryDto {
    version: String,
    published_at: String,
    release_notes: String,
    minimum_supported_version: String,
    target_library_schema_version: u32,
}

impl From<UpdateReleaseSummary> for UpdateReleaseSummaryDto {
    fn from(release: UpdateReleaseSummary) -> Self {
        Self {
            version: release.version,
            published_at: release.published_at,
            release_notes: release.release_notes,
            minimum_supported_version: release.minimum_supported_version,
            target_library_schema_version: release.target_library_schema_version,
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWithdrawalSummaryDto {
    version: String,
    reason: &'static str,
    guidance: String,
    replacement_version: Option<String>,
}

impl From<UpdateWithdrawalSummary> for UpdateWithdrawalSummaryDto {
    fn from(withdrawal: UpdateWithdrawalSummary) -> Self {
        Self {
            version: withdrawal.version,
            reason: update_withdrawal_reason(withdrawal.reason),
            guidance: withdrawal.guidance,
            replacement_version: withdrawal.replacement_version,
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckOutcomeDto {
    installed_version: String,
    checked_at: String,
    status: &'static str,
    release: Option<UpdateReleaseSummaryDto>,
    installed_withdrawal: Option<UpdateWithdrawalSummaryDto>,
    update_action_available: bool,
    postponed_until: Option<String>,
    manual_recovery_reason: Option<&'static str>,
    trust_failure: Option<&'static str>,
}

impl From<UpdateCheckOutcome> for UpdateCheckOutcomeDto {
    fn from(outcome: UpdateCheckOutcome) -> Self {
        Self {
            installed_version: outcome.installed_version,
            checked_at: outcome.checked_at,
            status: update_check_status(outcome.status),
            release: outcome.release.map(Into::into),
            installed_withdrawal: outcome.installed_withdrawal.map(Into::into),
            update_action_available: outcome.update_action_available,
            postponed_until: outcome.postponed_until,
            manual_recovery_reason: outcome.manual_recovery_reason.map(manual_update_reason),
            trust_failure: outcome.trust_failure.map(update_trust_failure),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRecoveryOutcomeDto {
    outcome: &'static str,
    source_version: String,
    target_version: String,
}

impl From<UpdateRecoveryOutcome> for UpdateRecoveryOutcomeDto {
    fn from(outcome: UpdateRecoveryOutcome) -> Self {
        Self {
            outcome: match outcome.kind {
                UpdateRecoveryOutcomeKind::Updated => "updated",
                UpdateRecoveryOutcomeKind::Recovered => "recovered",
            },
            source_version: outcome.source_version,
            target_version: outcome.target_version,
        }
    }
}

fn update_check_status(status: UpdateCheckStatus) -> &'static str {
    match status {
        UpdateCheckStatus::Unconfigured => "unconfigured",
        UpdateCheckStatus::Offline => "offline",
        UpdateCheckStatus::UpToDate => "up-to-date",
        UpdateCheckStatus::Available => "available",
        UpdateCheckStatus::Dismissed => "dismissed",
        UpdateCheckStatus::Postponed => "postponed",
        UpdateCheckStatus::WithdrawnInstalled => "withdrawn-installed",
        UpdateCheckStatus::ManualRecoveryRequired => "manual-recovery-required",
        UpdateCheckStatus::Untrusted => "untrusted",
    }
}

fn manual_update_reason(reason: ManualUpdateReason) -> &'static str {
    match reason {
        ManualUpdateReason::InstalledVersionUnsupported => "installed-version-unsupported",
        ManualUpdateReason::LibrarySchemaUnsupported => "library-schema-unsupported",
        ManualUpdateReason::NoSafeReplacement => "no-safe-replacement",
    }
}

fn update_trust_failure(failure: UpdateTrustFailure) -> &'static str {
    match failure {
        UpdateTrustFailure::ResponseTooLarge => "response-too-large",
        UpdateTrustFailure::InvalidEnvelope => "invalid-envelope",
        UpdateTrustFailure::UnknownKey => "unknown-key",
        UpdateTrustFailure::InvalidSignature => "invalid-signature",
        UpdateTrustFailure::InvalidPayload => "invalid-payload",
        UpdateTrustFailure::MirrorMismatch => "mirror-mismatch",
        UpdateTrustFailure::MissingTarget => "missing-target",
        UpdateTrustFailure::UnsupportedChannel => "unsupported-channel",
        UpdateTrustFailure::InvalidValidityWindow => "invalid-validity-window",
        UpdateTrustFailure::Expired => "expired",
        UpdateTrustFailure::Replay => "replay",
        UpdateTrustFailure::Equivocation => "equivocation",
        UpdateTrustFailure::Downgrade => "downgrade",
    }
}

fn update_withdrawal_reason(reason: UpdateWithdrawalReason) -> &'static str {
    match reason {
        UpdateWithdrawalReason::Security => "security",
        UpdateWithdrawalReason::DataIntegrity => "data-integrity",
        UpdateWithdrawalReason::Stability => "stability",
        UpdateWithdrawalReason::Compatibility => "compatibility",
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityDateRangeDto {
    from: String,
    through: String,
}

impl From<ActivityDateRangeDto> for ActivityDateRange {
    fn from(range: ActivityDateRangeDto) -> Self {
        Self {
            from: range.from,
            through: range.through,
        }
    }
}

impl From<ActivityDateRange> for ActivityDateRangeDto {
    fn from(range: ActivityDateRange) -> Self {
        Self {
            from: range.from,
            through: range.through,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityDayInsightDto {
    local_date: String,
    step_count: Option<String>,
    availability: &'static str,
}

impl From<ActivityDayInsight> for ActivityDayInsightDto {
    fn from(day: ActivityDayInsight) -> Self {
        Self {
            local_date: day.local_date,
            step_count: day.step_count.map(|value| value.to_string()),
            availability: match day.availability {
                ActivityDayAvailability::Available => "available",
                ActivityDayAvailability::Unavailable => "unavailable",
                ActivityDayAvailability::Missing => "missing",
            },
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivitySeriesSummaryDto {
    calendar_days: usize,
    observed_days: usize,
    available_step_days: usize,
    unavailable_step_days: usize,
    missing_days: usize,
    total_step_count: Option<String>,
    average_step_count: Option<String>,
}

impl From<ActivitySeriesSummary> for ActivitySeriesSummaryDto {
    fn from(summary: ActivitySeriesSummary) -> Self {
        Self {
            calendar_days: summary.calendar_days,
            observed_days: summary.observed_days,
            available_step_days: summary.available_step_days,
            unavailable_step_days: summary.unavailable_step_days,
            missing_days: summary.missing_days,
            total_step_count: summary.total_step_count.map(|value| value.to_string()),
            average_step_count: summary.average_step_count.map(|value| value.to_string()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivitySeriesOverviewDto {
    series_ref: String,
    summary: ActivitySeriesSummaryDto,
    days: Vec<ActivityDayInsightDto>,
}

impl From<ActivitySeriesOverview> for ActivitySeriesOverviewDto {
    fn from(series: ActivitySeriesOverview) -> Self {
        Self {
            series_ref: series.series_ref,
            summary: series.summary.into(),
            days: series
                .days
                .into_iter()
                .map(ActivityDayInsightDto::from)
                .collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityOverviewDto {
    available_range: Option<ActivityDateRangeDto>,
    selected_range: Option<ActivityDateRangeDto>,
    series: Vec<ActivitySeriesOverviewDto>,
}

impl From<ActivityOverview> for ActivityOverviewDto {
    fn from(overview: ActivityOverview) -> Self {
        Self {
            available_range: overview.available_range.map(ActivityDateRangeDto::from),
            selected_range: overview.selected_range.map(ActivityDateRangeDto::from),
            series: overview
                .series
                .into_iter()
                .map(ActivitySeriesOverviewDto::from)
                .collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivitySeriesComparisonDto {
    series_ref: String,
    baseline: ActivitySeriesSummaryDto,
    comparison: ActivitySeriesSummaryDto,
    total_step_change: Option<String>,
    average_step_change: Option<String>,
}

impl From<ActivitySeriesComparison> for ActivitySeriesComparisonDto {
    fn from(series: ActivitySeriesComparison) -> Self {
        Self {
            series_ref: series.series_ref,
            baseline: series.baseline.into(),
            comparison: series.comparison.into(),
            total_step_change: series.total_step_change.map(|value| value.to_string()),
            average_step_change: series.average_step_change.map(|value| value.to_string()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityComparisonDto {
    available_range: Option<ActivityDateRangeDto>,
    baseline_range: Option<ActivityDateRangeDto>,
    comparison_range: Option<ActivityDateRangeDto>,
    series: Vec<ActivitySeriesComparisonDto>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingDateRangeDto {
    from: String,
    through: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TrainingSessionSearchRequestDto {
    from: Option<String>,
    through: Option<String>,
    sport_refs: Vec<String>,
    required_measurements: Vec<String>,
    text: Option<String>,
    sort: String,
    offset: usize,
    limit: usize,
    snapshot_ref: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TrainingSessionCalendarRequestDto {
    month: String,
    from: Option<String>,
    through: Option<String>,
    sport_refs: Vec<String>,
    required_measurements: Vec<String>,
    text: Option<String>,
    snapshot_ref: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TrainingSessionSelectionRequestDto {
    session_refs: Vec<String>,
    snapshot_ref: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TrainingSessionStructureQueryDto {
    session_ref: String,
    snapshot_ref: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SessionStoryQueryDto {
    session_ref: String,
    snapshot_ref: Option<String>,
    max_visual_points: usize,
    max_visual_samples: usize,
}

impl From<SessionStoryQueryDto> for SessionStoryQuery {
    fn from(query: SessionStoryQueryDto) -> Self {
        Self {
            session_ref: query.session_ref,
            snapshot_ref: query.snapshot_ref,
            max_visual_points: query.max_visual_points,
            max_visual_samples: query.max_visual_samples,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TrainingSessionRouteQueryDto {
    session_ref: String,
    snapshot_ref: Option<String>,
    max_visual_points: usize,
}

impl From<TrainingSessionRouteQueryDto> for TrainingSessionRouteQuery {
    fn from(query: TrainingSessionRouteQueryDto) -> Self {
        Self {
            session_ref: query.session_ref,
            snapshot_ref: query.snapshot_ref,
            max_visual_points: query.max_visual_points,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TrainingRoutePointsQueryDto {
    session_ref: String,
    route_ref: String,
    snapshot_ref: Option<String>,
    offset: usize,
    limit: usize,
}

impl From<TrainingRoutePointsQueryDto> for TrainingRoutePointsQuery {
    fn from(query: TrainingRoutePointsQueryDto) -> Self {
        Self {
            session_ref: query.session_ref,
            route_ref: query.route_ref,
            snapshot_ref: query.snapshot_ref,
            offset: query.offset,
            limit: query.limit,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TrainingSessionSignalsQueryDto {
    session_ref: String,
    snapshot_ref: Option<String>,
    max_visual_samples: usize,
}

impl From<TrainingSessionSignalsQueryDto> for TrainingSessionSignalsQuery {
    fn from(query: TrainingSessionSignalsQueryDto) -> Self {
        Self {
            session_ref: query.session_ref,
            snapshot_ref: query.snapshot_ref,
            max_visual_samples: query.max_visual_samples,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TrainingSignalSamplesQueryDto {
    session_ref: String,
    signal_ref: String,
    snapshot_ref: Option<String>,
    offset: usize,
    limit: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TrainingSessionZonesQueryDto {
    session_ref: String,
    snapshot_ref: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TrainingSessionProvenanceQueryDto {
    session_ref: String,
    snapshot_ref: Option<String>,
    offset: usize,
    limit: usize,
}

impl From<TrainingSessionProvenanceQueryDto> for TrainingSessionProvenanceQuery {
    fn from(query: TrainingSessionProvenanceQueryDto) -> Self {
        Self {
            session_ref: query.session_ref,
            snapshot_ref: query.snapshot_ref,
            offset: query.offset,
            limit: query.limit,
        }
    }
}

impl From<TrainingSessionZonesQueryDto> for TrainingSessionZonesQuery {
    fn from(query: TrainingSessionZonesQueryDto) -> Self {
        Self {
            session_ref: query.session_ref,
            snapshot_ref: query.snapshot_ref,
        }
    }
}

impl From<TrainingSignalSamplesQueryDto> for TrainingSignalSamplesQuery {
    fn from(query: TrainingSignalSamplesQueryDto) -> Self {
        Self {
            session_ref: query.session_ref,
            signal_ref: query.signal_ref,
            snapshot_ref: query.snapshot_ref,
            offset: query.offset,
            limit: query.limit,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TrainingSessionSegmentationQueryDto {
    session_ref: String,
    snapshot_ref: Option<String>,
}

impl From<TrainingSessionSegmentationQueryDto> for TrainingSessionSegmentationQuery {
    fn from(query: TrainingSessionSegmentationQueryDto) -> Self {
        Self {
            session_ref: query.session_ref,
            snapshot_ref: query.snapshot_ref,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TrainingSessionRangesQueryDto {
    session_ref: String,
    snapshot_ref: Option<String>,
}

impl From<TrainingSessionRangesQueryDto> for TrainingSessionRangesQuery {
    fn from(query: TrainingSessionRangesQueryDto) -> Self {
        Self {
            session_ref: query.session_ref,
            snapshot_ref: query.snapshot_ref,
        }
    }
}

fn parse_training_session_range_i64(value: &str) -> Result<i64, CommandErrorDto> {
    let parsed = value
        .parse::<i64>()
        .map_err(|_| CommandErrorDto::new("invalid-training-session-range"))?;
    if parsed.to_string() != value {
        return Err(CommandErrorDto::new("invalid-training-session-range"));
    }
    Ok(parsed)
}

#[derive(Debug, Deserialize)]
#[serde(
    tag = "scope",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum TrainingSessionRangeCoordinateInputDto {
    #[serde(rename = "exercise-elapsed")]
    Exercise {},
    #[serde(rename = "route-elapsed")]
    Route { route_ref: String },
    #[serde(rename = "signal-elapsed")]
    Signal { signal_ref: String },
}

impl TryFrom<TrainingSessionRangeCoordinateInputDto> for TrainingSessionRangeCoordinate {
    type Error = CommandErrorDto;

    fn try_from(coordinate: TrainingSessionRangeCoordinateInputDto) -> Result<Self, Self::Error> {
        match coordinate {
            TrainingSessionRangeCoordinateInputDto::Exercise {} => Ok(Self::exercise_elapsed()),
            TrainingSessionRangeCoordinateInputDto::Route { route_ref } => {
                Self::route_elapsed(route_ref)
                    .map_err(|_| CommandErrorDto::new("invalid-training-session-range"))
            }
            TrainingSessionRangeCoordinateInputDto::Signal { signal_ref } => {
                Self::signal_elapsed(signal_ref)
                    .map_err(|_| CommandErrorDto::new("invalid-training-session-range"))
            }
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateTrainingSessionRangeRequestDto {
    session_ref: String,
    snapshot_ref: String,
    exercise_ref: String,
    coordinate: TrainingSessionRangeCoordinateInputDto,
    title: String,
    started_at_elapsed_milliseconds: String,
    ended_at_elapsed_milliseconds: String,
}

impl TryFrom<CreateTrainingSessionRangeRequestDto> for CreateTrainingSessionRangeRequest {
    type Error = CommandErrorDto;

    fn try_from(request: CreateTrainingSessionRangeRequestDto) -> Result<Self, Self::Error> {
        Ok(Self {
            session_ref: request.session_ref,
            snapshot_ref: request.snapshot_ref,
            exercise_ref: request.exercise_ref,
            coordinate: request.coordinate.try_into()?,
            title: request.title,
            started_at_elapsed_milliseconds: parse_training_session_range_i64(
                &request.started_at_elapsed_milliseconds,
            )?,
            ended_at_elapsed_milliseconds: parse_training_session_range_i64(
                &request.ended_at_elapsed_milliseconds,
            )?,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RenameTrainingSessionRangeRequestDto {
    session_ref: String,
    snapshot_ref: String,
    range_ref: String,
    expected_revision: u64,
    title: String,
}

impl From<RenameTrainingSessionRangeRequestDto> for RenameTrainingSessionRangeRequest {
    fn from(request: RenameTrainingSessionRangeRequestDto) -> Self {
        Self {
            session_ref: request.session_ref,
            snapshot_ref: request.snapshot_ref,
            range_ref: request.range_ref,
            expected_revision: request.expected_revision,
            title: request.title,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AdjustTrainingSessionRangeRequestDto {
    session_ref: String,
    snapshot_ref: String,
    range_ref: String,
    expected_revision: u64,
    exercise_ref: String,
    coordinate: TrainingSessionRangeCoordinateInputDto,
    started_at_elapsed_milliseconds: String,
    ended_at_elapsed_milliseconds: String,
}

impl TryFrom<AdjustTrainingSessionRangeRequestDto> for AdjustTrainingSessionRangeRequest {
    type Error = CommandErrorDto;

    fn try_from(request: AdjustTrainingSessionRangeRequestDto) -> Result<Self, Self::Error> {
        Ok(Self {
            session_ref: request.session_ref,
            snapshot_ref: request.snapshot_ref,
            range_ref: request.range_ref,
            expected_revision: request.expected_revision,
            exercise_ref: request.exercise_ref,
            coordinate: request.coordinate.try_into()?,
            started_at_elapsed_milliseconds: parse_training_session_range_i64(
                &request.started_at_elapsed_milliseconds,
            )?,
            ended_at_elapsed_milliseconds: parse_training_session_range_i64(
                &request.ended_at_elapsed_milliseconds,
            )?,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RemoveTrainingSessionRangeRequestDto {
    session_ref: String,
    snapshot_ref: String,
    range_ref: String,
    expected_revision: u64,
}

impl From<RemoveTrainingSessionRangeRequestDto> for RemoveTrainingSessionRangeRequest {
    fn from(request: RemoveTrainingSessionRangeRequestDto) -> Self {
        Self {
            session_ref: request.session_ref,
            snapshot_ref: request.snapshot_ref,
            range_ref: request.range_ref,
            expected_revision: request.expected_revision,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum SegmentCriterionDefinitionInputDto {
    EqualElapsedTime {
        span_milliseconds: String,
    },
    EqualDistance {
        span_meters: f64,
    },
    HeartRateZone {
        minimum_beats_per_minute: u16,
        maximum_beats_per_minute: u16,
    },
    ManualBoundaries {
        elapsed_milliseconds: Vec<String>,
    },
}

impl TryFrom<SegmentCriterionDefinitionInputDto> for SegmentCriterionDefinition {
    type Error = CommandErrorDto;

    fn try_from(input: SegmentCriterionDefinitionInputDto) -> Result<Self, Self::Error> {
        match input {
            SegmentCriterionDefinitionInputDto::EqualElapsedTime { span_milliseconds } => {
                Ok(Self::EqualElapsedTime {
                    span_milliseconds: parse_canonical_i64(&span_milliseconds)?,
                })
            }
            SegmentCriterionDefinitionInputDto::EqualDistance { span_meters } => {
                Ok(Self::EqualDistance { span_meters })
            }
            SegmentCriterionDefinitionInputDto::HeartRateZone {
                minimum_beats_per_minute,
                maximum_beats_per_minute,
            } => Ok(Self::HeartRateZone {
                minimum_beats_per_minute,
                maximum_beats_per_minute,
            }),
            SegmentCriterionDefinitionInputDto::ManualBoundaries {
                elapsed_milliseconds,
            } => Ok(Self::ManualBoundaries {
                elapsed_milliseconds: elapsed_milliseconds
                    .iter()
                    .map(|value| parse_canonical_i64(value))
                    .collect::<Result<Vec<_>, _>>()?,
            }),
        }
    }
}

fn parse_canonical_i64(value: &str) -> Result<i64, CommandErrorDto> {
    let parsed = value
        .parse::<i64>()
        .map_err(|_| CommandErrorDto::new("invalid-training-segment-criterion"))?;
    if parsed.to_string() != value {
        return Err(CommandErrorDto::new("invalid-training-segment-criterion"));
    }
    Ok(parsed)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateTrainingSegmentCriterionRequestDto {
    session_ref: String,
    snapshot_ref: String,
    exercise_ref: String,
    title: String,
    definition: SegmentCriterionDefinitionInputDto,
}

impl TryFrom<CreateTrainingSegmentCriterionRequestDto> for CreateTrainingSegmentCriterionRequest {
    type Error = CommandErrorDto;

    fn try_from(request: CreateTrainingSegmentCriterionRequestDto) -> Result<Self, Self::Error> {
        Ok(Self {
            session_ref: request.session_ref,
            snapshot_ref: request.snapshot_ref,
            exercise_ref: request.exercise_ref,
            title: request.title,
            definition: request.definition.try_into()?,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateTrainingSegmentCriterionRequestDto {
    session_ref: String,
    snapshot_ref: String,
    criterion_ref: String,
    expected_revision: u64,
    title: String,
    definition: SegmentCriterionDefinitionInputDto,
}

impl TryFrom<UpdateTrainingSegmentCriterionRequestDto> for UpdateTrainingSegmentCriterionRequest {
    type Error = CommandErrorDto;

    fn try_from(request: UpdateTrainingSegmentCriterionRequestDto) -> Result<Self, Self::Error> {
        Ok(Self {
            session_ref: request.session_ref,
            snapshot_ref: request.snapshot_ref,
            criterion_ref: request.criterion_ref,
            expected_revision: request.expected_revision,
            title: request.title,
            definition: request.definition.try_into()?,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TrainingSegmentCriterionMutationRequestDto {
    session_ref: String,
    snapshot_ref: String,
    exercise_ref: String,
    criterion_ref: String,
}

impl From<TrainingSegmentCriterionMutationRequestDto> for TrainingSegmentCriterionMutationRequest {
    fn from(request: TrainingSegmentCriterionMutationRequestDto) -> Self {
        Self {
            session_ref: request.session_ref,
            snapshot_ref: request.snapshot_ref,
            exercise_ref: request.exercise_ref,
            criterion_ref: request.criterion_ref,
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TrainingSegmentCriterionDirectionDto {
    Earlier,
    Later,
}

impl From<TrainingSegmentCriterionDirectionDto> for TrainingSegmentCriterionDirection {
    fn from(direction: TrainingSegmentCriterionDirectionDto) -> Self {
        match direction {
            TrainingSegmentCriterionDirectionDto::Earlier => Self::Earlier,
            TrainingSegmentCriterionDirectionDto::Later => Self::Later,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MoveTrainingSegmentCriterionRequestDto {
    session_ref: String,
    snapshot_ref: String,
    exercise_ref: String,
    criterion_ref: String,
    direction: TrainingSegmentCriterionDirectionDto,
}

impl From<MoveTrainingSegmentCriterionRequestDto> for MoveTrainingSegmentCriterionRequest {
    fn from(request: MoveTrainingSegmentCriterionRequestDto) -> Self {
        Self {
            mutation: TrainingSegmentCriterionMutationRequest {
                session_ref: request.session_ref,
                snapshot_ref: request.snapshot_ref,
                exercise_ref: request.exercise_ref,
                criterion_ref: request.criterion_ref,
            },
            direction: request.direction.into(),
        }
    }
}

impl From<TrainingSessionStructureQueryDto> for TrainingSessionStructureQuery {
    fn from(query: TrainingSessionStructureQueryDto) -> Self {
        Self {
            session_ref: query.session_ref,
            snapshot_ref: query.snapshot_ref,
        }
    }
}

impl From<TrainingSessionSelectionRequestDto> for TrainingSessionSelectionRequest {
    fn from(request: TrainingSessionSelectionRequestDto) -> Self {
        Self {
            session_refs: request.session_refs,
            snapshot_ref: request.snapshot_ref,
        }
    }
}

fn training_measurements(
    measurements: Vec<String>,
) -> Result<Vec<TrainingMeasurementFilter>, ApplicationError> {
    measurements
        .into_iter()
        .map(|measurement| match measurement.as_str() {
            "distance" => Ok(TrainingMeasurementFilter::Distance),
            "energy" => Ok(TrainingMeasurementFilter::Energy),
            "heart-rate" => Ok(TrainingMeasurementFilter::HeartRate),
            _ => Err(ApplicationError::InvalidTrainingSessionSearch(
                "measurement filter is invalid",
            )),
        })
        .collect()
}

fn training_sort(sort: &str) -> Result<TrainingSessionSort, ApplicationError> {
    match sort {
        "started-desc" => Ok(TrainingSessionSort::StartedDescending),
        "started-asc" => Ok(TrainingSessionSort::StartedAscending),
        "duration-desc" => Ok(TrainingSessionSort::DurationDescending),
        "distance-desc" => Ok(TrainingSessionSort::DistanceDescending),
        _ => Err(ApplicationError::InvalidTrainingSessionSearch(
            "sort is invalid",
        )),
    }
}

impl TryFrom<TrainingSessionSearchRequestDto> for TrainingSessionSearchRequest {
    type Error = ApplicationError;

    fn try_from(request: TrainingSessionSearchRequestDto) -> Result<Self, Self::Error> {
        let required_measurements = training_measurements(request.required_measurements)?;
        let sort = training_sort(&request.sort)?;
        Ok(Self {
            from: request.from,
            through: request.through,
            sport_refs: request.sport_refs,
            required_measurements,
            text: request.text,
            sort,
            offset: request.offset,
            limit: request.limit,
            snapshot_ref: request.snapshot_ref,
        })
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TrainingDiscoveryWorkspaceDto {
    version: u32,
    snapshot_ref: String,
    from: Option<String>,
    through: Option<String>,
    sport_refs: Vec<String>,
    required_measurements: Vec<String>,
    text: Option<String>,
    sort: String,
    offset: usize,
    limit: usize,
    view: String,
    calendar_month: Option<String>,
    calendar_day: Option<String>,
    selected_session_refs: Vec<String>,
    open_session_ref: Option<String>,
}

impl TryFrom<TrainingDiscoveryWorkspaceDto> for TrainingDiscoveryWorkspace {
    type Error = ApplicationError;

    fn try_from(workspace: TrainingDiscoveryWorkspaceDto) -> Result<Self, Self::Error> {
        let view = match workspace.view.as_str() {
            "chronology" => TrainingDiscoveryView::Chronology,
            "calendar" => TrainingDiscoveryView::Calendar,
            _ => {
                return Err(ApplicationError::InvalidTrainingDiscoveryWorkspace(
                    "view is invalid",
                ));
            }
        };
        Ok(Self {
            version: workspace.version,
            snapshot_ref: workspace.snapshot_ref,
            from: workspace.from,
            through: workspace.through,
            sport_refs: workspace.sport_refs,
            required_measurements: training_measurements(workspace.required_measurements).map_err(
                |_| {
                    ApplicationError::InvalidTrainingDiscoveryWorkspace(
                        "measurement filter is invalid",
                    )
                },
            )?,
            text: workspace.text,
            sort: training_sort(&workspace.sort).map_err(|_| {
                ApplicationError::InvalidTrainingDiscoveryWorkspace("sort is invalid")
            })?,
            offset: workspace.offset,
            limit: workspace.limit,
            view,
            calendar_month: workspace.calendar_month,
            calendar_day: workspace.calendar_day,
            selected_session_refs: workspace.selected_session_refs,
            open_session_ref: workspace.open_session_ref,
        })
    }
}

impl From<TrainingDiscoveryWorkspace> for TrainingDiscoveryWorkspaceDto {
    fn from(workspace: TrainingDiscoveryWorkspace) -> Self {
        Self {
            version: workspace.version,
            snapshot_ref: workspace.snapshot_ref,
            from: workspace.from,
            through: workspace.through,
            sport_refs: workspace.sport_refs,
            required_measurements: workspace
                .required_measurements
                .into_iter()
                .map(|measurement| match measurement {
                    TrainingMeasurementFilter::Distance => "distance".to_owned(),
                    TrainingMeasurementFilter::Energy => "energy".to_owned(),
                    TrainingMeasurementFilter::HeartRate => "heart-rate".to_owned(),
                })
                .collect(),
            text: workspace.text,
            sort: match workspace.sort {
                TrainingSessionSort::StartedDescending => "started-desc",
                TrainingSessionSort::StartedAscending => "started-asc",
                TrainingSessionSort::DurationDescending => "duration-desc",
                TrainingSessionSort::DistanceDescending => "distance-desc",
            }
            .to_owned(),
            offset: workspace.offset,
            limit: workspace.limit,
            view: match workspace.view {
                TrainingDiscoveryView::Chronology => "chronology",
                TrainingDiscoveryView::Calendar => "calendar",
            }
            .to_owned(),
            calendar_month: workspace.calendar_month,
            calendar_day: workspace.calendar_day,
            selected_session_refs: workspace.selected_session_refs,
            open_session_ref: workspace.open_session_ref,
        }
    }
}

impl TryFrom<TrainingSessionCalendarRequestDto> for TrainingSessionCalendarRequest {
    type Error = ApplicationError;

    fn try_from(request: TrainingSessionCalendarRequestDto) -> Result<Self, Self::Error> {
        Ok(Self {
            month: request.month,
            from: request.from,
            through: request.through,
            sport_refs: request.sport_refs,
            required_measurements: training_measurements(request.required_measurements)?,
            text: request.text,
            snapshot_ref: request.snapshot_ref,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SaveSportClassificationRequestDto {
    sport_ref: String,
    expected_revision: u64,
    canonical_family: Option<String>,
    display_label: Option<String>,
}

impl From<SaveSportClassificationRequestDto> for SaveSportClassificationRequest {
    fn from(request: SaveSportClassificationRequestDto) -> Self {
        Self {
            sport_ref: request.sport_ref,
            expected_revision: request.expected_revision,
            canonical_family: request.canonical_family,
            display_label: request.display_label,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSportClassificationDto {
    canonical_family: Option<String>,
    display_label: Option<String>,
    authorship: Option<String>,
    revision: u64,
}

impl From<TrainingSportClassification> for TrainingSportClassificationDto {
    fn from(classification: TrainingSportClassification) -> Self {
        Self {
            canonical_family: classification.canonical_family,
            display_label: classification.display_label,
            authorship: classification.authorship,
            revision: classification.revision,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionSportDto {
    sport_ref: Option<String>,
    state: &'static str,
    classification: Option<TrainingSportClassificationDto>,
    recognition: Option<TrainingSportRecognitionDto>,
    recognition_candidate_count: usize,
}

impl From<TrainingSessionSport> for TrainingSessionSportDto {
    fn from(sport: TrainingSessionSport) -> Self {
        Self {
            sport_ref: sport.sport_ref,
            state: training_sport_state_code(sport.state),
            classification: sport.classification.map(Into::into),
            recognition: sport.recognition.map(Into::into),
            recognition_candidate_count: sport.recognition_candidate_count,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSportRecognitionDto {
    canonical_family: Option<String>,
    localized_names: BTreeMap<String, String>,
    catalogue_revision: String,
    retrieved_at_utc: String,
    mapping_version: String,
    evidence_ref: String,
}

impl From<TrainingSportRecognition> for TrainingSportRecognitionDto {
    fn from(recognition: TrainingSportRecognition) -> Self {
        Self {
            canonical_family: recognition.canonical_family,
            localized_names: recognition.localized_names,
            catalogue_revision: recognition.catalogue_revision,
            retrieved_at_utc: recognition.retrieved_at_utc,
            mapping_version: recognition.mapping_version,
            evidence_ref: recognition.evidence_ref,
        }
    }
}

fn training_sport_state_code(state: TrainingSportState) -> &'static str {
    match state {
        TrainingSportState::Recognized => "recognized",
        TrainingSportState::Ambiguous => "ambiguous",
        TrainingSportState::Unknown => "unknown",
        TrainingSportState::PersonallyOverridden => "personally-overridden",
        TrainingSportState::Unavailable => "unavailable",
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSportCoverageDto {
    session_count: usize,
    total_duration_milliseconds: String,
    distance_session_count: usize,
    heart_rate_session_count: usize,
}

impl From<TrainingSportCoverage> for TrainingSportCoverageDto {
    fn from(coverage: TrainingSportCoverage) -> Self {
        Self {
            session_count: coverage.session_count,
            total_duration_milliseconds: coverage.total_duration_milliseconds.to_string(),
            distance_session_count: coverage.distance_session_count,
            heart_rate_session_count: coverage.heart_rate_session_count,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSportDto {
    sport_ref: Option<String>,
    source_index: usize,
    state: &'static str,
    classification: Option<TrainingSportClassificationDto>,
    recognition: Option<TrainingSportRecognitionDto>,
    recognition_candidate_count: usize,
    first_local_date: String,
    last_local_date: String,
    coverage: TrainingSportCoverageDto,
}

impl From<TrainingSport> for TrainingSportDto {
    fn from(sport: TrainingSport) -> Self {
        Self {
            sport_ref: sport.sport_ref,
            source_index: sport.source_index,
            state: training_sport_state_code(sport.state),
            classification: sport.classification.map(Into::into),
            recognition: sport.recognition.map(Into::into),
            recognition_candidate_count: sport.recognition_candidate_count,
            first_local_date: sport.first_local_date,
            last_local_date: sport.last_local_date,
            coverage: sport.coverage.into(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSportsOverviewDto {
    origin_count: usize,
    session_count: usize,
    sports: Vec<TrainingSportDto>,
}

impl From<TrainingSportsOverview> for TrainingSportsOverviewDto {
    fn from(overview: TrainingSportsOverview) -> Self {
        Self {
            origin_count: overview.origin_count,
            session_count: overview.session_count,
            sports: overview.sports.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedTrainingSportClassificationDto {
    outcome: &'static str,
    overview: TrainingSportsOverviewDto,
}

impl From<SavedTrainingSportClassification> for SavedTrainingSportClassificationDto {
    fn from(saved: SavedTrainingSportClassification) -> Self {
        Self {
            outcome: match saved.outcome {
                SportClassificationSaveOutcome::Changed => "changed",
                SportClassificationSaveOutcome::Unchanged => "unchanged",
            },
            overview: saved.overview.into(),
        }
    }
}

impl From<TrainingDateRangeDto> for TrainingDateRange {
    fn from(range: TrainingDateRangeDto) -> Self {
        Self {
            from: range.from,
            through: range.through,
        }
    }
}

impl From<TrainingDateRange> for TrainingDateRangeDto {
    fn from(range: TrainingDateRange) -> Self {
        Self {
            from: range.from,
            through: range.through,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionSearchItemDto {
    session_ref: String,
    source_index: usize,
    started_at_local: String,
    stopped_at_local: String,
    utc_offset_minutes: Option<i32>,
    duration_milliseconds: String,
    distance_meters: Option<f64>,
    energy_kilocalories: Option<String>,
    average_heart_rate_bpm: Option<String>,
    maximum_heart_rate_bpm: Option<String>,
    exercise_count: Option<usize>,
    sport: TrainingSessionSportDto,
}

impl From<TrainingSessionSearchItem> for TrainingSessionSearchItemDto {
    fn from(session: TrainingSessionSearchItem) -> Self {
        Self {
            session_ref: session.session_ref,
            source_index: session.source_index,
            started_at_local: session.started_at_local,
            stopped_at_local: session.stopped_at_local,
            utc_offset_minutes: session.utc_offset_minutes,
            duration_milliseconds: session.duration_milliseconds.to_string(),
            distance_meters: session.distance_meters,
            energy_kilocalories: session.energy_kilocalories.map(|value| value.to_string()),
            average_heart_rate_bpm: session
                .average_heart_rate_bpm
                .map(|value| value.to_string()),
            maximum_heart_rate_bpm: session
                .maximum_heart_rate_bpm
                .map(|value| value.to_string()),
            exercise_count: session.exercise_count,
            sport: session.sport.into(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionSearchSummaryDto {
    source_index: usize,
    training_days: usize,
    session_count: usize,
    total_duration_milliseconds: String,
    distance_session_count: usize,
    total_distance_meters: Option<f64>,
    energy_session_count: usize,
    total_energy_kilocalories: Option<String>,
    heart_rate_session_count: usize,
}

impl From<TrainingSessionSearchSummary> for TrainingSessionSearchSummaryDto {
    fn from(summary: TrainingSessionSearchSummary) -> Self {
        Self {
            source_index: summary.source_index,
            training_days: summary.training_days,
            session_count: summary.session_count,
            total_duration_milliseconds: summary.total_duration_milliseconds.to_string(),
            distance_session_count: summary.distance_session_count,
            total_distance_meters: summary.total_distance_meters,
            energy_session_count: summary.energy_session_count,
            total_energy_kilocalories: summary
                .total_energy_kilocalories
                .map(|value| value.to_string()),
            heart_rate_session_count: summary.heart_rate_session_count,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionSearchPageDto {
    available_range: Option<TrainingDateRangeDto>,
    snapshot_ref: String,
    total_count: usize,
    offset: usize,
    limit: usize,
    next_offset: Option<usize>,
    summaries: Vec<TrainingSessionSearchSummaryDto>,
    sessions: Vec<TrainingSessionSearchItemDto>,
}

impl From<TrainingSessionSearchPage> for TrainingSessionSearchPageDto {
    fn from(page: TrainingSessionSearchPage) -> Self {
        Self {
            available_range: page.available_range.map(Into::into),
            snapshot_ref: page.snapshot_ref,
            total_count: page.total_count,
            offset: page.offset,
            limit: page.limit,
            next_offset: page.next_offset,
            summaries: page.summaries.into_iter().map(Into::into).collect(),
            sessions: page.sessions.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionCalendarDayDto {
    local_date: String,
    source_index: usize,
    session_count: usize,
    total_duration_milliseconds: String,
    distance_session_count: usize,
    total_distance_meters: Option<f64>,
    heart_rate_session_count: usize,
}

impl From<TrainingSessionCalendarDay> for TrainingSessionCalendarDayDto {
    fn from(day: TrainingSessionCalendarDay) -> Self {
        Self {
            local_date: day.local_date,
            source_index: day.source_index,
            session_count: day.session_count,
            total_duration_milliseconds: day.total_duration_milliseconds.to_string(),
            distance_session_count: day.distance_session_count,
            total_distance_meters: day.total_distance_meters,
            heart_rate_session_count: day.heart_rate_session_count,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionCalendarDto {
    available_range: Option<TrainingDateRangeDto>,
    snapshot_ref: String,
    month: String,
    days: Vec<TrainingSessionCalendarDayDto>,
}

impl From<TrainingSessionCalendar> for TrainingSessionCalendarDto {
    fn from(calendar: TrainingSessionCalendar) -> Self {
        Self {
            available_range: calendar.available_range.map(Into::into),
            snapshot_ref: calendar.snapshot_ref,
            month: calendar.month,
            days: calendar.days.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionSelectionDto {
    snapshot_ref: String,
    sessions: Vec<TrainingSessionSearchItemDto>,
}

impl From<TrainingSessionSelection> for TrainingSessionSelectionDto {
    fn from(selection: TrainingSessionSelection) -> Self {
        Self {
            snapshot_ref: selection.snapshot_ref,
            sessions: selection.sessions.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingLapStructureDto {
    lap_ref: String,
    ordinal: usize,
    split_time_milliseconds: String,
    duration_milliseconds: String,
    distance_meters: Option<f64>,
}

impl From<TrainingLapStructure> for TrainingLapStructureDto {
    fn from(lap: TrainingLapStructure) -> Self {
        Self {
            lap_ref: lap.lap_ref,
            ordinal: lap.ordinal,
            split_time_milliseconds: lap.split_time_milliseconds.to_string(),
            duration_milliseconds: lap.duration_milliseconds.to_string(),
            distance_meters: lap.distance_meters,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingPauseStructureDto {
    pause_ref: String,
    ordinal: usize,
    started_at_local: String,
    ended_at_local: String,
}

impl From<TrainingPauseStructure> for TrainingPauseStructureDto {
    fn from(pause: TrainingPauseStructure) -> Self {
        Self {
            pause_ref: pause.pause_ref,
            ordinal: pause.ordinal,
            started_at_local: pause.started_at_local,
            ended_at_local: pause.ended_at_local,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingExerciseStructureDto {
    exercise_ref: String,
    ordinal: usize,
    started_at_local: String,
    stopped_at_local: String,
    utc_offset_minutes: Option<i32>,
    duration_milliseconds: String,
    distance_meters: Option<f64>,
    energy_kilocalories: Option<String>,
    sport: TrainingSessionSportDto,
    manual_laps: Option<Vec<TrainingLapStructureDto>>,
    automatic_laps: Option<Vec<TrainingLapStructureDto>>,
    pauses: Option<Vec<TrainingPauseStructureDto>>,
}

impl From<TrainingExerciseStructure> for TrainingExerciseStructureDto {
    fn from(exercise: TrainingExerciseStructure) -> Self {
        Self {
            exercise_ref: exercise.exercise_ref,
            ordinal: exercise.ordinal,
            started_at_local: exercise.started_at_local,
            stopped_at_local: exercise.stopped_at_local,
            utc_offset_minutes: exercise.utc_offset_minutes,
            duration_milliseconds: exercise.duration_milliseconds.to_string(),
            distance_meters: exercise.distance_meters,
            energy_kilocalories: exercise.energy_kilocalories.map(|value| value.to_string()),
            sport: exercise.sport.into(),
            manual_laps: exercise
                .manual_laps
                .map(|laps| laps.into_iter().map(Into::into).collect()),
            automatic_laps: exercise
                .automatic_laps
                .map(|laps| laps.into_iter().map(Into::into).collect()),
            pauses: exercise
                .pauses
                .map(|pauses| pauses.into_iter().map(Into::into).collect()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingStructureDto {
    exercises: Option<Vec<TrainingExerciseStructureDto>>,
}

impl From<TrainingStructure> for TrainingStructureDto {
    fn from(structure: TrainingStructure) -> Self {
        Self {
            exercises: structure
                .exercises
                .map(|exercises| exercises.into_iter().map(Into::into).collect()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionStructureResultDto {
    snapshot_ref: String,
    session_ref: String,
    structure: Option<TrainingStructureDto>,
}

impl From<TrainingSessionStructureResult> for TrainingSessionStructureResultDto {
    fn from(result: TrainingSessionStructureResult) -> Self {
        Self {
            snapshot_ref: result.snapshot_ref,
            session_ref: result.session_ref,
            structure: result.structure.map(Into::into),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingRoutePointDto {
    ordinal: usize,
    latitude_degrees: f64,
    longitude_degrees: f64,
    altitude_meters: Option<f64>,
    elapsed_milliseconds: Option<String>,
}

impl From<TrainingRoutePointView> for TrainingRoutePointDto {
    fn from(point: TrainingRoutePointView) -> Self {
        Self {
            ordinal: point.ordinal,
            latitude_degrees: point.latitude_degrees,
            longitude_degrees: point.longitude_degrees,
            altitude_meters: point.altitude_meters,
            elapsed_milliseconds: point.elapsed_milliseconds.map(|value| value.to_string()),
        }
    }
}

fn training_route_kind(kind: TrainingRouteKindView) -> &'static str {
    match kind {
        TrainingRouteKindView::Primary => "primary",
        TrainingRouteKindView::Transition => "transition",
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingRouteOverviewDto {
    route_ref: String,
    kind: &'static str,
    started_at_local: String,
    point_count: usize,
    altitude_point_count: usize,
    elapsed_point_count: usize,
    projection: &'static str,
    visual_points: Vec<TrainingRoutePointDto>,
}

impl From<TrainingRouteOverview> for TrainingRouteOverviewDto {
    fn from(route: TrainingRouteOverview) -> Self {
        Self {
            route_ref: route.route_ref,
            kind: training_route_kind(route.kind),
            started_at_local: route.started_at_local,
            point_count: route.point_count,
            altitude_point_count: route.altitude_point_count,
            elapsed_point_count: route.elapsed_point_count,
            projection: "source-ordinal-v1",
            visual_points: route.visual_points.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingRouteCollectionDto {
    primary: Option<TrainingRouteOverviewDto>,
    transition: Option<TrainingRouteOverviewDto>,
}

impl From<TrainingRouteCollectionView> for TrainingRouteCollectionDto {
    fn from(routes: TrainingRouteCollectionView) -> Self {
        Self {
            primary: routes.primary.map(Into::into),
            transition: routes.transition.map(Into::into),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingExerciseRoutesDto {
    exercise_ref: String,
    ordinal: usize,
    routes: Option<TrainingRouteCollectionDto>,
}

impl From<TrainingExerciseRoutesView> for TrainingExerciseRoutesDto {
    fn from(exercise: TrainingExerciseRoutesView) -> Self {
        Self {
            exercise_ref: exercise.exercise_ref,
            ordinal: exercise.ordinal,
            routes: exercise.routes.map(Into::into),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionRoutesDto {
    exercises: Option<Vec<TrainingExerciseRoutesDto>>,
}

impl From<TrainingSessionRoutesView> for TrainingSessionRoutesDto {
    fn from(routes: TrainingSessionRoutesView) -> Self {
        Self {
            exercises: routes
                .exercises
                .map(|exercises| exercises.into_iter().map(Into::into).collect()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionRoutesResultDto {
    snapshot_ref: String,
    session_ref: String,
    routes: Option<TrainingSessionRoutesDto>,
}

impl From<TrainingSessionRoutesResult> for TrainingSessionRoutesResultDto {
    fn from(result: TrainingSessionRoutesResult) -> Self {
        Self {
            snapshot_ref: result.snapshot_ref,
            session_ref: result.session_ref,
            routes: result.routes.map(Into::into),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingRoutePointsResultDto {
    snapshot_ref: String,
    session_ref: String,
    route_ref: String,
    point_count: usize,
    offset: usize,
    points: Vec<TrainingRoutePointDto>,
    next_offset: Option<usize>,
}

impl From<PersistedTrainingRoutePoints> for TrainingRoutePointsResultDto {
    fn from(result: PersistedTrainingRoutePoints) -> Self {
        Self {
            snapshot_ref: result.snapshot_ref,
            session_ref: result.session_ref,
            route_ref: result.route_ref,
            point_count: result.point_count,
            offset: result.offset,
            points: result.points.into_iter().map(Into::into).collect(),
            next_offset: result.next_offset,
        }
    }
}

fn training_signal_role(role: TrainingSignalRoleView) -> &'static str {
    match role {
        TrainingSignalRoleView::Primary => "primary",
        TrainingSignalRoleView::Transition => "transition",
    }
}

fn training_signal_kind(kind: TrainingSignalKindView) -> &'static str {
    match kind {
        TrainingSignalKindView::HeartRate => "heart-rate",
        TrainingSignalKindView::Speed => "speed",
        TrainingSignalKindView::Distance => "distance",
        TrainingSignalKindView::Altitude => "altitude",
        TrainingSignalKindView::Cadence => "cadence",
        TrainingSignalKindView::Temperature => "temperature",
        TrainingSignalKindView::LeftCrankPower => "left-crank-power",
    }
}

fn training_signal_unit(unit: TrainingSignalUnitView) -> &'static str {
    match unit {
        TrainingSignalUnitView::BeatsPerMinute => "beats-per-minute",
        TrainingSignalUnitView::KilometersPerHour => "kilometers-per-hour",
        TrainingSignalUnitView::Meters => "meters",
        TrainingSignalUnitView::RotationsPerMinute => "rotations-per-minute",
        TrainingSignalUnitView::DegreesCelsius => "degrees-celsius",
        TrainingSignalUnitView::Watts => "watts",
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSignalSampleDto {
    ordinal: usize,
    elapsed_milliseconds: String,
    value: Option<f64>,
}

impl From<TrainingSignalSampleView> for TrainingSignalSampleDto {
    fn from(sample: TrainingSignalSampleView) -> Self {
        Self {
            ordinal: sample.ordinal,
            elapsed_milliseconds: sample.elapsed_milliseconds.to_string(),
            value: sample.value,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSignalVisualSampleDto {
    ordinal: usize,
    elapsed_milliseconds: String,
    value: Option<f64>,
    gap_before: bool,
}

impl From<TrainingSignalVisualSampleView> for TrainingSignalVisualSampleDto {
    fn from(sample: TrainingSignalVisualSampleView) -> Self {
        Self {
            ordinal: sample.ordinal,
            elapsed_milliseconds: sample.elapsed_milliseconds.to_string(),
            value: sample.value,
            gap_before: sample.gap_before,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSignalSeriesOverviewDto {
    signal_ref: String,
    ordinal: usize,
    role: &'static str,
    kind: &'static str,
    unit: &'static str,
    interval_milliseconds: String,
    sample_count: usize,
    available_sample_count: usize,
    projection: &'static str,
    visual_samples: Vec<TrainingSignalVisualSampleDto>,
}

impl From<TrainingSignalSeriesOverview> for TrainingSignalSeriesOverviewDto {
    fn from(signal: TrainingSignalSeriesOverview) -> Self {
        Self {
            signal_ref: signal.signal_ref,
            ordinal: signal.ordinal,
            role: training_signal_role(signal.role),
            kind: training_signal_kind(signal.kind),
            unit: training_signal_unit(signal.unit),
            interval_milliseconds: signal.interval_milliseconds.to_string(),
            sample_count: signal.sample_count,
            available_sample_count: signal.available_sample_count,
            projection: "source-ordinal-v1",
            visual_samples: signal.visual_samples.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSignalCollectionDto {
    primary: Option<Vec<TrainingSignalSeriesOverviewDto>>,
    transition: Option<Vec<TrainingSignalSeriesOverviewDto>>,
    unsupported_primary_series_count: usize,
    unsupported_transition_series_count: usize,
}

impl From<TrainingSignalCollectionView> for TrainingSignalCollectionDto {
    fn from(signals: TrainingSignalCollectionView) -> Self {
        Self {
            primary: signals
                .primary
                .map(|series| series.into_iter().map(Into::into).collect()),
            transition: signals
                .transition
                .map(|series| series.into_iter().map(Into::into).collect()),
            unsupported_primary_series_count: signals.unsupported_primary_series_count,
            unsupported_transition_series_count: signals.unsupported_transition_series_count,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingExerciseSignalsDto {
    exercise_ref: String,
    ordinal: usize,
    signals: Option<TrainingSignalCollectionDto>,
}

impl From<TrainingExerciseSignalsView> for TrainingExerciseSignalsDto {
    fn from(exercise: TrainingExerciseSignalsView) -> Self {
        Self {
            exercise_ref: exercise.exercise_ref,
            ordinal: exercise.ordinal,
            signals: exercise.signals.map(Into::into),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionSignalsDto {
    exercises: Option<Vec<TrainingExerciseSignalsDto>>,
}

impl From<TrainingSessionSignalsView> for TrainingSessionSignalsDto {
    fn from(signals: TrainingSessionSignalsView) -> Self {
        Self {
            exercises: signals
                .exercises
                .map(|exercises| exercises.into_iter().map(Into::into).collect()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionSignalsResultDto {
    snapshot_ref: String,
    session_ref: String,
    signals: Option<TrainingSessionSignalsDto>,
}

fn training_zone_kind(kind: TrainingZoneKindView) -> &'static str {
    match kind {
        TrainingZoneKindView::HeartRate => "heart-rate",
        TrainingZoneKindView::Speed => "speed",
        TrainingZoneKindView::Power => "power",
    }
}

fn training_zone_unit(unit: TrainingZoneUnitView) -> &'static str {
    match unit {
        TrainingZoneUnitView::BeatsPerMinute => "beats-per-minute",
        TrainingZoneUnitView::KilometersPerHour => "kilometers-per-hour",
        TrainingZoneUnitView::Watts => "watts",
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingZoneDto {
    zone_ref: String,
    ordinal: usize,
    lower_limit: f64,
    higher_limit: f64,
    time_in_zone_milliseconds: Option<String>,
    distance_meters: Option<f64>,
    muscle_load: Option<f64>,
}

impl From<TrainingZoneView> for TrainingZoneDto {
    fn from(zone: TrainingZoneView) -> Self {
        Self {
            zone_ref: zone.zone_ref,
            ordinal: zone.ordinal,
            lower_limit: zone.lower_limit,
            higher_limit: zone.higher_limit,
            time_in_zone_milliseconds: zone
                .time_in_zone_milliseconds
                .map(|value| value.to_string()),
            distance_meters: zone.distance_meters,
            muscle_load: zone.muscle_load,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingZoneGroupDto {
    zone_group_ref: String,
    ordinal: usize,
    kind: &'static str,
    unit: &'static str,
    zones: Option<Vec<TrainingZoneDto>>,
}

impl From<TrainingZoneGroupView> for TrainingZoneGroupDto {
    fn from(group: TrainingZoneGroupView) -> Self {
        Self {
            zone_group_ref: group.zone_group_ref,
            ordinal: group.ordinal,
            kind: training_zone_kind(group.kind),
            unit: training_zone_unit(group.unit),
            zones: group
                .zones
                .map(|zones| zones.into_iter().map(Into::into).collect()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingZoneCollectionDto {
    groups: Vec<TrainingZoneGroupDto>,
    unsupported_group_count: usize,
}

impl From<TrainingZoneCollectionView> for TrainingZoneCollectionDto {
    fn from(zones: TrainingZoneCollectionView) -> Self {
        Self {
            groups: zones.groups.into_iter().map(Into::into).collect(),
            unsupported_group_count: zones.unsupported_group_count,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingExerciseZonesDto {
    exercise_ref: String,
    ordinal: usize,
    zones: Option<TrainingZoneCollectionDto>,
}

impl From<TrainingExerciseZonesView> for TrainingExerciseZonesDto {
    fn from(exercise: TrainingExerciseZonesView) -> Self {
        Self {
            exercise_ref: exercise.exercise_ref,
            ordinal: exercise.ordinal,
            zones: exercise.zones.map(Into::into),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionZonesDto {
    exercises: Option<Vec<TrainingExerciseZonesDto>>,
}

impl From<TrainingSessionZonesView> for TrainingSessionZonesDto {
    fn from(zones: TrainingSessionZonesView) -> Self {
        Self {
            exercises: zones
                .exercises
                .map(|exercises| exercises.into_iter().map(Into::into).collect()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionZonesResultDto {
    snapshot_ref: String,
    session_ref: String,
    zones: Option<TrainingSessionZonesDto>,
}

impl From<TrainingSessionZonesResult> for TrainingSessionZonesResultDto {
    fn from(result: TrainingSessionZonesResult) -> Self {
        Self {
            snapshot_ref: result.snapshot_ref,
            session_ref: result.session_ref,
            zones: result.zones.map(Into::into),
        }
    }
}

fn training_source_provider(provider: TrainingSourceProviderView) -> String {
    provider.code().to_owned()
}

fn training_provenance_decision(decision: TrainingProvenanceDecisionView) -> &'static str {
    match decision {
        TrainingProvenanceDecisionView::Create => "create",
        TrainingProvenanceDecisionView::Equivalent => "equivalent",
        TrainingProvenanceDecisionView::Enrich => "enrich",
        TrainingProvenanceDecisionView::Amend => "amend",
        TrainingProvenanceDecisionView::Preserve => "preserve",
        TrainingProvenanceDecisionView::Conflict => "conflict",
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingProvenanceCurrentDto {
    provider: String,
    source_modified_at_utc: String,
    source_adapter_version: String,
    mapping_version: String,
    contributing_event_count: usize,
    non_contributing_event_count: usize,
}

impl From<TrainingProvenanceCurrentView> for TrainingProvenanceCurrentDto {
    fn from(current: TrainingProvenanceCurrentView) -> Self {
        Self {
            provider: training_source_provider(current.provider),
            source_modified_at_utc: current.source_modified_at_utc,
            source_adapter_version: current.source_adapter_version,
            mapping_version: current.mapping_version,
            contributing_event_count: current.contributing_event_count,
            non_contributing_event_count: current.non_contributing_event_count,
        }
    }
}

fn session_story_metric(metric: SessionStoryMetricView) -> &'static str {
    match metric {
        SessionStoryMetricView::Pace => "pace",
        SessionStoryMetricView::Speed => "speed",
        SessionStoryMetricView::HeartRate => "heart-rate",
        SessionStoryMetricView::Elevation => "elevation",
        SessionStoryMetricView::Cadence => "cadence",
        SessionStoryMetricView::StrokeRate => "stroke-rate",
        SessionStoryMetricView::Temperature => "temperature",
        SessionStoryMetricView::Power => "power",
    }
}

fn session_story_value_transform(transform: SessionStoryValueTransform) -> &'static str {
    match transform {
        SessionStoryValueTransform::Identity => "identity",
        SessionStoryValueTransform::KilometersPerHourToMinutesPerKilometer => {
            "kilometers-per-hour-to-minutes-per-kilometer"
        }
    }
}

fn session_story_assessment_state(state: SessionStoryAssessmentStateView) -> &'static str {
    match state {
        SessionStoryAssessmentStateView::NotEvaluated => "not-evaluated",
        SessionStoryAssessmentStateView::SourceAbsent => "source-absent",
        SessionStoryAssessmentStateView::SourceEmpty => "source-empty",
        SessionStoryAssessmentStateView::SourcePresent => "source-present",
    }
}

fn session_story_alignment_state(state: SessionStoryAlignmentStateView) -> &'static str {
    match state {
        SessionStoryAlignmentStateView::ExactRecorded => "exact-recorded",
        SessionStoryAlignmentStateView::Unavailable => "unavailable",
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStoryAlignedSampleDto {
    route_point_ordinal: usize,
    signal_sample_ordinal: usize,
    elapsed_milliseconds: String,
    value: Option<f64>,
    gap_before: bool,
}

impl From<SessionStoryAlignedSampleView> for SessionStoryAlignedSampleDto {
    fn from(sample: SessionStoryAlignedSampleView) -> Self {
        Self {
            route_point_ordinal: sample.route_point_ordinal,
            signal_sample_ordinal: sample.signal_sample_ordinal,
            elapsed_milliseconds: sample.elapsed_milliseconds.to_string(),
            value: sample.value,
            gap_before: sample.gap_before,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStoryOverlayDto {
    signal_ref: String,
    metric: &'static str,
    source_kind: &'static str,
    source_unit: &'static str,
    value_transform: &'static str,
    alignment_state: &'static str,
    aligned_samples: Vec<SessionStoryAlignedSampleDto>,
}

impl From<SessionStoryOverlayView> for SessionStoryOverlayDto {
    fn from(overlay: SessionStoryOverlayView) -> Self {
        Self {
            signal_ref: overlay.signal_ref,
            metric: session_story_metric(overlay.metric),
            source_kind: training_signal_kind(overlay.source_kind),
            source_unit: training_signal_unit(overlay.source_unit),
            value_transform: session_story_value_transform(overlay.value_transform),
            alignment_state: session_story_alignment_state(overlay.alignment_state),
            aligned_samples: overlay
                .aligned_samples
                .into_iter()
                .map(Into::into)
                .collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStoryExactRouteDto {
    route_ref: String,
    point_count: usize,
}

impl From<SessionStoryExactRoute> for SessionStoryExactRouteDto {
    fn from(route: SessionStoryExactRoute) -> Self {
        Self {
            route_ref: route.route_ref,
            point_count: route.point_count,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStoryExactSignalDto {
    signal_ref: String,
    kind: &'static str,
    unit: &'static str,
    sample_count: usize,
}

impl From<SessionStoryExactSignal> for SessionStoryExactSignalDto {
    fn from(signal: SessionStoryExactSignal) -> Self {
        Self {
            signal_ref: signal.signal_ref,
            kind: training_signal_kind(signal.kind),
            unit: training_signal_unit(signal.unit),
            sample_count: signal.sample_count,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStoryRoleDto {
    route: Option<TrainingRouteOverviewDto>,
    signals: Vec<TrainingSignalSeriesOverviewDto>,
    evidence: SessionStoryRoleEvidenceDto,
    primary_metric: Option<&'static str>,
    eligible_overlays: Vec<SessionStoryOverlayDto>,
    exact_route: Option<SessionStoryExactRouteDto>,
    exact_signals: Vec<SessionStoryExactSignalDto>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStoryRoleEvidenceDto {
    route_point_count: usize,
    signal_series_count: usize,
    signal_series_with_values_count: usize,
    partial_signal_series_count: usize,
    unavailable_signal_series_count: usize,
    empty_signal_series_count: usize,
    unsupported_signal_series_count: usize,
    signal_sample_count: usize,
    available_signal_sample_count: usize,
    unavailable_signal_sample_count: usize,
}

impl From<SessionStoryRoleEvidenceView> for SessionStoryRoleEvidenceDto {
    fn from(evidence: SessionStoryRoleEvidenceView) -> Self {
        Self {
            route_point_count: evidence.route_point_count,
            signal_series_count: evidence.signal_series_count,
            signal_series_with_values_count: evidence.signal_series_with_values_count,
            partial_signal_series_count: evidence.partial_signal_series_count,
            unavailable_signal_series_count: evidence.unavailable_signal_series_count,
            empty_signal_series_count: evidence.empty_signal_series_count,
            unsupported_signal_series_count: evidence.unsupported_signal_series_count,
            signal_sample_count: evidence.signal_sample_count,
            available_signal_sample_count: evidence.available_signal_sample_count,
            unavailable_signal_sample_count: evidence.unavailable_signal_sample_count,
        }
    }
}

impl From<SessionStoryRole> for SessionStoryRoleDto {
    fn from(role: SessionStoryRole) -> Self {
        Self {
            route: role.route.map(Into::into),
            signals: role.signals.into_iter().map(Into::into).collect(),
            evidence: role.evidence.into(),
            primary_metric: role.primary_metric.map(session_story_metric),
            eligible_overlays: role.eligible_overlays.into_iter().map(Into::into).collect(),
            exact_route: role.exact_route.map(Into::into),
            exact_signals: role.exact_signals.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStoryExerciseDto {
    exercise_ref: String,
    ordinal: usize,
    sport: Option<TrainingSessionSportDto>,
    structure: Option<TrainingExerciseStructureDto>,
    zones: Option<TrainingZoneCollectionDto>,
    evidence: SessionStoryExerciseEvidenceDto,
    primary: SessionStoryRoleDto,
    transition: SessionStoryRoleDto,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStoryExerciseEvidenceDto {
    has_structure: bool,
    manual_lap_count: usize,
    automatic_lap_count: usize,
    pause_count: usize,
    zone_group_count: usize,
    zone_count: usize,
    timed_zone_count: usize,
    unsupported_zone_group_count: usize,
}

impl From<SessionStoryExerciseEvidenceView> for SessionStoryExerciseEvidenceDto {
    fn from(evidence: SessionStoryExerciseEvidenceView) -> Self {
        Self {
            has_structure: evidence.has_structure,
            manual_lap_count: evidence.manual_lap_count,
            automatic_lap_count: evidence.automatic_lap_count,
            pause_count: evidence.pause_count,
            zone_group_count: evidence.zone_group_count,
            zone_count: evidence.zone_count,
            timed_zone_count: evidence.timed_zone_count,
            unsupported_zone_group_count: evidence.unsupported_zone_group_count,
        }
    }
}

impl From<SessionStoryExercise> for SessionStoryExerciseDto {
    fn from(exercise: SessionStoryExercise) -> Self {
        Self {
            exercise_ref: exercise.exercise_ref,
            ordinal: exercise.ordinal,
            sport: exercise.sport.map(Into::into),
            structure: exercise.structure.map(Into::into),
            zones: exercise.zones.map(Into::into),
            evidence: exercise.evidence.into(),
            primary: exercise.primary.into(),
            transition: exercise.transition.into(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStoryProvenanceDto {
    total_event_count: usize,
    current: TrainingProvenanceCurrentDto,
}

impl From<SessionStoryProvenance> for SessionStoryProvenanceDto {
    fn from(provenance: SessionStoryProvenance) -> Self {
        Self {
            total_event_count: provenance.total_event_count,
            current: provenance.current.into(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStoryDto {
    schema_version: u32,
    snapshot_ref: String,
    session: TrainingSessionSearchItemDto,
    structure: Option<TrainingStructureDto>,
    routes: Option<TrainingSessionRoutesDto>,
    signals: Option<TrainingSessionSignalsDto>,
    zones: Option<TrainingSessionZonesDto>,
    provenance: SessionStoryProvenanceDto,
    composition: SessionStoryCompositionDto,
    exercises: Vec<SessionStoryExerciseDto>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStoryCompositionDto {
    structure_state: &'static str,
    route_state: &'static str,
    signal_state: &'static str,
    zone_state: &'static str,
    exercise_count: usize,
}

impl From<SessionStoryCompositionView> for SessionStoryCompositionDto {
    fn from(composition: SessionStoryCompositionView) -> Self {
        Self {
            structure_state: session_story_assessment_state(composition.structure_state),
            route_state: session_story_assessment_state(composition.route_state),
            signal_state: session_story_assessment_state(composition.signal_state),
            zone_state: session_story_assessment_state(composition.zone_state),
            exercise_count: composition.exercise_count,
        }
    }
}

impl From<SessionStory> for SessionStoryDto {
    fn from(story: SessionStory) -> Self {
        Self {
            schema_version: story.schema_version,
            snapshot_ref: story.snapshot_ref,
            session: story.session.into(),
            structure: story.structure.map(Into::into),
            routes: story.routes.map(Into::into),
            signals: story.signals.map(Into::into),
            zones: story.zones.map(Into::into),
            provenance: story.provenance.into(),
            composition: story.composition.into(),
            exercises: story.exercises.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingProvenanceEventDto {
    ordinal: usize,
    observed_at_utc: String,
    source_modified_at_utc: String,
    provider: String,
    source_adapter_version: String,
    mapping_version: String,
    decision: &'static str,
    contributes_to_visible_state: bool,
}

impl From<TrainingProvenanceEventView> for TrainingProvenanceEventDto {
    fn from(event: TrainingProvenanceEventView) -> Self {
        Self {
            ordinal: event.ordinal,
            observed_at_utc: event.observed_at_utc,
            source_modified_at_utc: event.source_modified_at_utc,
            provider: training_source_provider(event.provider),
            source_adapter_version: event.source_adapter_version,
            mapping_version: event.mapping_version,
            decision: training_provenance_decision(event.decision),
            contributes_to_visible_state: event.contributes_to_visible_state,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionProvenanceResultDto {
    snapshot_ref: String,
    session_ref: String,
    total_event_count: usize,
    offset: usize,
    limit: usize,
    next_offset: Option<usize>,
    current: TrainingProvenanceCurrentDto,
    events: Vec<TrainingProvenanceEventDto>,
}

#[derive(Debug, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase"
)]
pub enum ReportBlockDto {
    SessionEvidence {
        block_ref: String,
        session_ref: String,
        include_physiological_context: bool,
    },
    Route {
        block_ref: String,
        session_ref: String,
        route_ref: String,
        endpoint_redaction_meters: u32,
    },
    Narrative {
        block_ref: String,
        body: String,
    },
    TrainingFinding {
        block_ref: String,
        query: ReportTrainingComparisonQueryDto,
        metric: &'static str,
    },
    TrainingComparison {
        block_ref: String,
        query: ReportTrainingComparisonQueryDto,
    },
    TrainingChart {
        block_ref: String,
        query: ReportTrainingComparisonQueryDto,
        metric: &'static str,
    },
    TrainingExactTable {
        block_ref: String,
        query: ReportTrainingComparisonQueryDto,
    },
    TrainingCoverage {
        block_ref: String,
        query: ReportTrainingComparisonQueryDto,
    },
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReportDateRangeDto {
    from: String,
    through: String,
}

impl TryFrom<ReportDateRangeDto> for ReportDateRange {
    type Error = CommandErrorDto;

    fn try_from(range: ReportDateRangeDto) -> Result<Self, Self::Error> {
        ReportDateRange::new(&range.from, &range.through)
            .map_err(|_| CommandErrorDto::new("invalid-report-definition"))
    }
}

impl From<&ReportDateRange> for ReportDateRangeDto {
    fn from(range: &ReportDateRange) -> Self {
        Self {
            from: range.from().to_owned(),
            through: range.through().to_owned(),
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReportTrainingComparisonQueryDto {
    question: String,
    question_version: u32,
    baseline_range: ReportDateRangeDto,
    comparison_range: ReportDateRangeDto,
}

impl TryFrom<ReportTrainingComparisonQueryDto> for ReportTrainingComparisonQuery {
    type Error = CommandErrorDto;

    fn try_from(query: ReportTrainingComparisonQueryDto) -> Result<Self, Self::Error> {
        ReportTrainingComparisonQuery::restore(
            &query.question,
            query.question_version,
            query.baseline_range.try_into()?,
            query.comparison_range.try_into()?,
        )
        .map_err(|_| CommandErrorDto::new("invalid-report-definition"))
    }
}

impl From<&ReportTrainingComparisonQuery> for ReportTrainingComparisonQueryDto {
    fn from(query: &ReportTrainingComparisonQuery) -> Self {
        Self {
            question: query.question().code().to_owned(),
            question_version: query.question().version(),
            baseline_range: query.baseline_range().into(),
            comparison_range: query.comparison_range().into(),
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum ReportOriginDto {
    Session {
        session_ref: String,
    },
    Question {
        question: String,
        question_version: u32,
    },
    Exploration {
        query: ReportTrainingComparisonQueryDto,
    },
    Blank {},
}

impl TryFrom<ReportOriginDto> for ReportOrigin {
    type Error = CommandErrorDto;

    fn try_from(origin: ReportOriginDto) -> Result<Self, Self::Error> {
        match origin {
            ReportOriginDto::Session { session_ref } => Ok(Self::Session { session_ref }),
            ReportOriginDto::Question {
                question,
                question_version,
            } => ReportQuestion::from_code_and_version(&question, question_version)
                .map(|question| Self::Question { question })
                .ok_or_else(|| CommandErrorDto::new("invalid-report-definition")),
            ReportOriginDto::Exploration { query } => Ok(Self::Exploration {
                query: query.try_into()?,
            }),
            ReportOriginDto::Blank {} => Ok(Self::Blank),
        }
    }
}

impl From<&ReportOrigin> for ReportOriginDto {
    fn from(origin: &ReportOrigin) -> Self {
        match origin {
            ReportOrigin::Session { session_ref } => Self::Session {
                session_ref: session_ref.clone(),
            },
            ReportOrigin::Question { question } => Self::Question {
                question: question.code().to_owned(),
                question_version: question.version(),
            },
            ReportOrigin::Exploration { query } => Self::Exploration {
                query: query.into(),
            },
            ReportOrigin::Blank => Self::Blank {},
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportDefinitionDto {
    report_ref: String,
    title: String,
    locale: &'static str,
    source_snapshot_ref: String,
    origin: ReportOriginDto,
    provenance_policy: &'static str,
    authorship: &'static str,
    definition_version: u32,
    revision: String,
    blocks: Vec<ReportBlockDto>,
}

impl From<ReportDefinition> for ReportDefinitionDto {
    fn from(definition: ReportDefinition) -> Self {
        let origin = definition.origin().into();
        let blocks = definition
            .blocks()
            .iter()
            .map(|block| match block.content() {
                ReportBlockContent::SessionEvidence {
                    session_ref,
                    include_physiological_context,
                } => ReportBlockDto::SessionEvidence {
                    block_ref: block.block_ref().to_owned(),
                    session_ref: session_ref.clone(),
                    include_physiological_context: *include_physiological_context,
                },
                ReportBlockContent::Route {
                    session_ref,
                    route_ref,
                    endpoint_redaction_meters,
                } => ReportBlockDto::Route {
                    block_ref: block.block_ref().to_owned(),
                    session_ref: session_ref.clone(),
                    route_ref: route_ref.clone(),
                    endpoint_redaction_meters: *endpoint_redaction_meters,
                },
                ReportBlockContent::Narrative { body } => ReportBlockDto::Narrative {
                    block_ref: block.block_ref().to_owned(),
                    body: body.clone(),
                },
                ReportBlockContent::TrainingFinding { query, metric } => {
                    ReportBlockDto::TrainingFinding {
                        block_ref: block.block_ref().to_owned(),
                        query: query.into(),
                        metric: metric.code(),
                    }
                }
                ReportBlockContent::TrainingComparison { query } => {
                    ReportBlockDto::TrainingComparison {
                        block_ref: block.block_ref().to_owned(),
                        query: query.into(),
                    }
                }
                ReportBlockContent::TrainingChart { query, metric } => {
                    ReportBlockDto::TrainingChart {
                        block_ref: block.block_ref().to_owned(),
                        query: query.into(),
                        metric: metric.code(),
                    }
                }
                ReportBlockContent::TrainingExactTable { query } => {
                    ReportBlockDto::TrainingExactTable {
                        block_ref: block.block_ref().to_owned(),
                        query: query.into(),
                    }
                }
                ReportBlockContent::TrainingCoverage { query } => {
                    ReportBlockDto::TrainingCoverage {
                        block_ref: block.block_ref().to_owned(),
                        query: query.into(),
                    }
                }
            })
            .collect();
        let provenance_policy = match definition.provenance_policy() {
            ReportProvenancePolicy::CurrentAttribution => "current-attribution",
        };
        let authorship = match definition.authorship() {
            ReportAuthorship::User => "user",
        };
        Self {
            report_ref: definition.report_ref().to_owned(),
            title: definition.title().to_owned(),
            locale: definition.locale().code(),
            source_snapshot_ref: definition.source_snapshot_ref().to_owned(),
            origin,
            provenance_policy,
            authorship,
            definition_version: definition.definition_version(),
            revision: definition.revision().to_string(),
            blocks,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum ReportStartDto {
    Question {
        question: String,
        question_version: u32,
    },
    Exploration {
        query: ReportTrainingComparisonQueryDto,
    },
    Blank {},
}

impl TryFrom<ReportStartDto> for ReportStart {
    type Error = CommandErrorDto;

    fn try_from(start: ReportStartDto) -> Result<Self, Self::Error> {
        match start {
            ReportStartDto::Question {
                question,
                question_version,
            } => ReportQuestion::from_code_and_version(&question, question_version)
                .map(|question| Self::Question { question })
                .ok_or_else(|| CommandErrorDto::new("invalid-report-definition")),
            ReportStartDto::Exploration { query } => Ok(Self::Exploration {
                query: query.try_into()?,
            }),
            ReportStartDto::Blank {} => Ok(Self::Blank),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparedReportStartDto {
    source_snapshot_ref: String,
    origin: ReportOriginDto,
    suggested_query: Option<ReportTrainingComparisonQueryDto>,
}

impl From<PreparedReportStart> for PreparedReportStartDto {
    fn from(prepared: PreparedReportStart) -> Self {
        Self {
            source_snapshot_ref: prepared.source_snapshot_ref,
            origin: (&prepared.origin).into(),
            suggested_query: prepared.suggested_query.as_ref().map(Into::into),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateReportRequestDto {
    title: String,
    locale: String,
    source_snapshot_ref: String,
    origin: ReportOriginDto,
    blocks: Vec<SessionReportBlockDraftDto>,
}

impl TryFrom<CreateReportRequestDto> for CreateReportRequest {
    type Error = CommandErrorDto;

    fn try_from(request: CreateReportRequestDto) -> Result<Self, Self::Error> {
        Ok(Self {
            title: request.title,
            locale: report_locale(&request.locale)?,
            source_snapshot_ref: request.source_snapshot_ref,
            origin: request.origin.try_into()?,
            blocks: request
                .blocks
                .into_iter()
                .map(TryInto::try_into)
                .collect::<Result<_, _>>()?,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateReportRequestDto {
    report_ref: String,
    expected_revision: String,
    title: String,
    locale: String,
    blocks: Vec<SessionReportBlockDraftDto>,
}

impl TryFrom<UpdateReportRequestDto> for UpdateReportRequest {
    type Error = CommandErrorDto;

    fn try_from(request: UpdateReportRequestDto) -> Result<Self, Self::Error> {
        Ok(Self {
            report_ref: request.report_ref,
            expected_revision: parse_canonical_u64(
                &request.expected_revision,
                "invalid-report-definition",
            )?,
            title: request.title,
            locale: report_locale(&request.locale)?,
            blocks: request
                .blocks
                .into_iter()
                .map(TryInto::try_into)
                .collect::<Result<_, _>>()?,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RefreshReportRequestDto {
    report_ref: String,
    expected_revision: String,
    expected_source_snapshot_ref: String,
    expected_resolved_snapshot_ref: String,
}

impl TryFrom<RefreshReportRequestDto> for RefreshReportRequest {
    type Error = CommandErrorDto;

    fn try_from(request: RefreshReportRequestDto) -> Result<Self, Self::Error> {
        Ok(Self {
            report_ref: request.report_ref,
            expected_revision: parse_canonical_u64(
                &request.expected_revision,
                "invalid-report-definition",
            )?,
            expected_source_snapshot_ref: request.expected_source_snapshot_ref,
            expected_resolved_snapshot_ref: request.expected_resolved_snapshot_ref,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RemoveReportRequestDto {
    report_ref: String,
    expected_revision: String,
}

impl TryFrom<RemoveReportRequestDto> for RemoveReportRequest {
    type Error = CommandErrorDto;

    fn try_from(request: RemoveReportRequestDto) -> Result<Self, Self::Error> {
        Ok(Self {
            report_ref: request.report_ref,
            expected_revision: parse_canonical_u64(
                &request.expected_revision,
                "invalid-report-definition",
            )?,
        })
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemovedReportDto {
    report_ref: String,
    title: String,
    revision: String,
}

impl From<RemovedReport> for RemovedReportDto {
    fn from(report: RemovedReport) -> Self {
        Self {
            report_ref: report.report_ref,
            title: report.title,
            revision: report.revision.to_string(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateSessionReportRequestDto {
    title: String,
    locale: String,
    session_ref: String,
    source_snapshot_ref: String,
    include_physiological_context: bool,
    narrative: String,
}

impl TryFrom<CreateSessionReportRequestDto> for CreateSessionReportRequest {
    type Error = CommandErrorDto;

    fn try_from(request: CreateSessionReportRequestDto) -> Result<Self, Self::Error> {
        Ok(Self {
            title: request.title,
            locale: report_locale(&request.locale)?,
            session_ref: request.session_ref,
            source_snapshot_ref: request.source_snapshot_ref,
            include_physiological_context: request.include_physiological_context,
            narrative: request.narrative,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateSessionReportRequestDto {
    report_ref: String,
    expected_revision: String,
    title: String,
    locale: String,
    include_physiological_context: bool,
    narrative: String,
}

impl TryFrom<UpdateSessionReportRequestDto> for UpdateSessionReportRequest {
    type Error = CommandErrorDto;

    fn try_from(request: UpdateSessionReportRequestDto) -> Result<Self, Self::Error> {
        Ok(Self {
            report_ref: request.report_ref,
            expected_revision: parse_canonical_u64(
                &request.expected_revision,
                "invalid-report-definition",
            )?,
            title: request.title,
            locale: report_locale(&request.locale)?,
            include_physiological_context: request.include_physiological_context,
            narrative: request.narrative,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum SessionReportBlockDraftDto {
    SessionEvidence {
        block_ref: Option<String>,
        include_physiological_context: bool,
    },
    Route {
        block_ref: Option<String>,
        route_ref: String,
        endpoint_redaction_meters: u32,
    },
    Narrative {
        block_ref: Option<String>,
        body: String,
    },
    TrainingFinding {
        block_ref: Option<String>,
        query: ReportTrainingComparisonQueryDto,
        metric: String,
    },
    TrainingComparison {
        block_ref: Option<String>,
        query: ReportTrainingComparisonQueryDto,
    },
    TrainingChart {
        block_ref: Option<String>,
        query: ReportTrainingComparisonQueryDto,
        metric: String,
    },
    TrainingExactTable {
        block_ref: Option<String>,
        query: ReportTrainingComparisonQueryDto,
    },
    TrainingCoverage {
        block_ref: Option<String>,
        query: ReportTrainingComparisonQueryDto,
    },
}

impl TryFrom<SessionReportBlockDraftDto> for SessionReportBlockDraft {
    type Error = CommandErrorDto;

    fn try_from(block: SessionReportBlockDraftDto) -> Result<Self, Self::Error> {
        Ok(match block {
            SessionReportBlockDraftDto::SessionEvidence {
                block_ref,
                include_physiological_context,
            } => Self {
                block_ref,
                content: SessionReportBlockDraftContent::SessionEvidence {
                    include_physiological_context,
                },
            },
            SessionReportBlockDraftDto::Route {
                block_ref,
                route_ref,
                endpoint_redaction_meters,
            } => Self {
                block_ref,
                content: SessionReportBlockDraftContent::Route {
                    route_ref,
                    endpoint_redaction_meters,
                },
            },
            SessionReportBlockDraftDto::Narrative { block_ref, body } => Self {
                block_ref,
                content: SessionReportBlockDraftContent::Narrative { body },
            },
            SessionReportBlockDraftDto::TrainingFinding {
                block_ref,
                query,
                metric,
            } => Self {
                block_ref,
                content: SessionReportBlockDraftContent::TrainingFinding {
                    query: query.try_into()?,
                    metric: report_training_metric(&metric)?,
                },
            },
            SessionReportBlockDraftDto::TrainingComparison { block_ref, query } => Self {
                block_ref,
                content: SessionReportBlockDraftContent::TrainingComparison {
                    query: query.try_into()?,
                },
            },
            SessionReportBlockDraftDto::TrainingChart {
                block_ref,
                query,
                metric,
            } => Self {
                block_ref,
                content: SessionReportBlockDraftContent::TrainingChart {
                    query: query.try_into()?,
                    metric: report_training_metric(&metric)?,
                },
            },
            SessionReportBlockDraftDto::TrainingExactTable { block_ref, query } => Self {
                block_ref,
                content: SessionReportBlockDraftContent::TrainingExactTable {
                    query: query.try_into()?,
                },
            },
            SessionReportBlockDraftDto::TrainingCoverage { block_ref, query } => Self {
                block_ref,
                content: SessionReportBlockDraftContent::TrainingCoverage {
                    query: query.try_into()?,
                },
            },
        })
    }
}

fn report_training_metric(value: &str) -> Result<ReportTrainingMetric, CommandErrorDto> {
    ReportTrainingMetric::from_code(value)
        .ok_or_else(|| CommandErrorDto::new("invalid-report-definition"))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateComposedSessionReportRequestDto {
    title: String,
    locale: String,
    session_ref: String,
    source_snapshot_ref: String,
    blocks: Vec<SessionReportBlockDraftDto>,
}

impl TryFrom<CreateComposedSessionReportRequestDto> for CreateComposedSessionReportRequest {
    type Error = CommandErrorDto;

    fn try_from(request: CreateComposedSessionReportRequestDto) -> Result<Self, Self::Error> {
        Ok(Self {
            title: request.title,
            locale: report_locale(&request.locale)?,
            session_ref: request.session_ref,
            source_snapshot_ref: request.source_snapshot_ref,
            blocks: request
                .blocks
                .into_iter()
                .map(TryInto::try_into)
                .collect::<Result<_, _>>()?,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateComposedSessionReportRequestDto {
    report_ref: String,
    expected_revision: String,
    title: String,
    locale: String,
    blocks: Vec<SessionReportBlockDraftDto>,
}

impl TryFrom<UpdateComposedSessionReportRequestDto> for UpdateComposedSessionReportRequest {
    type Error = CommandErrorDto;

    fn try_from(request: UpdateComposedSessionReportRequestDto) -> Result<Self, Self::Error> {
        Ok(Self {
            report_ref: request.report_ref,
            expected_revision: parse_canonical_u64(
                &request.expected_revision,
                "invalid-report-definition",
            )?,
            title: request.title,
            locale: report_locale(&request.locale)?,
            blocks: request
                .blocks
                .into_iter()
                .map(TryInto::try_into)
                .collect::<Result<_, _>>()?,
        })
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportSummaryDto {
    report_ref: String,
    title: String,
    locale: &'static str,
    source_snapshot_ref: String,
    revision: String,
}

impl From<ReportSummary> for ReportSummaryDto {
    fn from(report: ReportSummary) -> Self {
        Self {
            report_ref: report.report_ref,
            title: report.title,
            locale: report.locale.code(),
            source_snapshot_ref: report.source_snapshot_ref,
            revision: report.revision.to_string(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportListDto {
    reports: Vec<ReportSummaryDto>,
}

impl From<Vec<ReportSummary>> for ReportListDto {
    fn from(reports: Vec<ReportSummary>) -> Self {
        Self {
            reports: reports.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReportLibraryRequestDto {
    offset: usize,
    limit: usize,
}

impl From<ReportLibraryRequestDto> for ReportLibraryRequest {
    fn from(request: ReportLibraryRequestDto) -> Self {
        Self {
            offset: request.offset,
            limit: request.limit,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
enum ReportLibrarySubjectDto {
    Session { sport: Box<TrainingSessionSportDto> },
    TrainingComparison,
    AuthoredNote,
}

impl From<ReportLibrarySubject> for ReportLibrarySubjectDto {
    fn from(subject: ReportLibrarySubject) -> Self {
        match subject {
            ReportLibrarySubject::Session { sport } => Self::Session {
                sport: Box::new((*sport).into()),
            },
            ReportLibrarySubject::TrainingComparison => Self::TrainingComparison,
            ReportLibrarySubject::AuthoredNote => Self::AuthoredNote,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase"
)]
enum ReportLibraryPeriodDto {
    Session {
        started_at_local: String,
    },
    TrainingComparison {
        baseline_range: ReportDateRangeDto,
        comparison_range: ReportDateRangeDto,
    },
}

impl From<ReportLibraryPeriod> for ReportLibraryPeriodDto {
    fn from(period: ReportLibraryPeriod) -> Self {
        match period {
            ReportLibraryPeriod::Session { started_at_local } => Self::Session { started_at_local },
            ReportLibraryPeriod::TrainingComparison {
                baseline_range,
                comparison_range,
            } => Self::TrainingComparison {
                baseline_range: (&baseline_range).into(),
                comparison_range: (&comparison_range).into(),
            },
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
enum ReportLibraryMetricValueDto {
    Integer { value: String },
    Decimal { value: f64 },
}

impl From<ReportLibraryMetricValue> for ReportLibraryMetricValueDto {
    fn from(value: ReportLibraryMetricValue) -> Self {
        match value {
            ReportLibraryMetricValue::Integer(value) => Self::Integer {
                value: value.to_string(),
            },
            ReportLibraryMetricValue::Decimal(value) => Self::Decimal { value },
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReportLibraryComparisonSeriesDto {
    source_index: usize,
    baseline_value: Option<ReportLibraryMetricValueDto>,
    comparison_value: Option<ReportLibraryMetricValueDto>,
    change: Option<ReportLibraryMetricValueDto>,
}

impl From<ReportLibraryComparisonSeries> for ReportLibraryComparisonSeriesDto {
    fn from(series: ReportLibraryComparisonSeries) -> Self {
        Self {
            source_index: series.source_index,
            baseline_value: series.baseline_value.map(Into::into),
            comparison_value: series.comparison_value.map(Into::into),
            change: series.change.map(Into::into),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase"
)]
enum ReportLibraryResultDto {
    Session {
        metric: &'static str,
        value: ReportLibraryMetricValueDto,
    },
    TrainingComparison {
        metric: &'static str,
        series: Vec<ReportLibraryComparisonSeriesDto>,
        omitted_source_count: usize,
    },
}

impl From<ReportLibraryResult> for ReportLibraryResultDto {
    fn from(result: ReportLibraryResult) -> Self {
        match result {
            ReportLibraryResult::Session { metric, value } => Self::Session {
                metric: metric.code(),
                value: value.into(),
            },
            ReportLibraryResult::TrainingComparison {
                metric,
                series,
                omitted_source_count,
            } => Self::TrainingComparison {
                metric: metric.code(),
                series: series.into_iter().map(Into::into).collect(),
                omitted_source_count,
            },
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReportLibrarySensitivityDto {
    includes_physiological_context: bool,
    precise_location_block_count: usize,
    minimum_endpoint_redaction_meters: Option<u32>,
}

impl From<ReportLibrarySensitivity> for ReportLibrarySensitivityDto {
    fn from(sensitivity: ReportLibrarySensitivity) -> Self {
        Self {
            includes_physiological_context: sensitivity.includes_physiological_context,
            precise_location_block_count: sensitivity.precise_location_block_count,
            minimum_endpoint_redaction_meters: sensitivity.minimum_endpoint_redaction_meters,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReportLibraryItemDto {
    report_ref: String,
    title: String,
    locale: &'static str,
    source_snapshot_ref: String,
    revision: String,
    evidence_state: &'static str,
    subject: ReportLibrarySubjectDto,
    period: Option<ReportLibraryPeriodDto>,
    result: Option<ReportLibraryResultDto>,
    sensitivity: ReportLibrarySensitivityDto,
}

impl From<ReportLibraryItem> for ReportLibraryItemDto {
    fn from(item: ReportLibraryItem) -> Self {
        Self {
            report_ref: item.report_ref,
            title: item.title,
            locale: item.locale.code(),
            source_snapshot_ref: item.source_snapshot_ref,
            revision: item.revision.to_string(),
            evidence_state: report_library_evidence_state_code(item.evidence_state),
            subject: item.subject.into(),
            period: item.period.map(Into::into),
            result: item.result.map(Into::into),
            sensitivity: item.sensitivity.into(),
        }
    }
}

fn report_library_evidence_state_code(state: ReportLibraryEvidenceState) -> &'static str {
    match state {
        ReportLibraryEvidenceState::Current => "current",
        ReportLibraryEvidenceState::Stale => "stale",
        ReportLibraryEvidenceState::Unavailable => "unavailable",
        ReportLibraryEvidenceState::AuthoredOnly => "authored-only",
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportLibraryPageDto {
    items: Vec<ReportLibraryItemDto>,
    total_count: usize,
    offset: usize,
    limit: usize,
    next_offset: Option<usize>,
}

impl From<ReportLibraryPage> for ReportLibraryPageDto {
    fn from(page: ReportLibraryPage) -> Self {
        Self {
            items: page.items.into_iter().map(Into::into).collect(),
            total_count: page.total_count,
            offset: page.offset,
            limit: page.limit,
            next_offset: page.next_offset,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportSessionEvidenceDto {
    session_ref: String,
    source_index: usize,
    started_at_local: String,
    stopped_at_local: String,
    utc_offset_minutes: Option<i32>,
    duration_milliseconds: String,
    distance_meters: Option<f64>,
    energy_kilocalories: Option<String>,
    average_heart_rate_bpm: Option<String>,
    maximum_heart_rate_bpm: Option<String>,
    exercise_count: Option<usize>,
    sport: TrainingSessionSportDto,
}

impl From<ReportSessionEvidence> for ReportSessionEvidenceDto {
    fn from(session: ReportSessionEvidence) -> Self {
        Self {
            session_ref: session.session_ref,
            source_index: session.source_index,
            started_at_local: session.started_at_local,
            stopped_at_local: session.stopped_at_local,
            utc_offset_minutes: session.utc_offset_minutes,
            duration_milliseconds: session.duration_milliseconds.to_string(),
            distance_meters: session.distance_meters,
            energy_kilocalories: session.energy_kilocalories.map(|value| value.to_string()),
            average_heart_rate_bpm: session
                .average_heart_rate_bpm
                .map(|value| value.to_string()),
            maximum_heart_rate_bpm: session
                .maximum_heart_rate_bpm
                .map(|value| value.to_string()),
            exercise_count: session.exercise_count,
            sport: session.sport.into(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportRouteEvidenceDto {
    block_ref: String,
    route_ref: String,
    kind: &'static str,
    started_at_local: String,
    source_point_count: usize,
    visual_points: Vec<TrainingRoutePointDto>,
    endpoint_redaction_meters: u32,
    included: bool,
}

impl From<ReportRouteEvidence> for ReportRouteEvidenceDto {
    fn from(route: ReportRouteEvidence) -> Self {
        Self {
            block_ref: route.block_ref,
            route_ref: route.route_ref,
            kind: training_route_kind(route.kind),
            started_at_local: route.started_at_local,
            source_point_count: route.source_point_count,
            visual_points: route.visual_points.into_iter().map(Into::into).collect(),
            endpoint_redaction_meters: route.endpoint_redaction_meters,
            included: route.included,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportSensitiveContentDto {
    kind: &'static str,
    block_ref: Option<String>,
    included: bool,
    endpoint_redaction_meters: Option<u32>,
}

impl From<ReportSensitiveContent> for ReportSensitiveContentDto {
    fn from(content: ReportSensitiveContent) -> Self {
        Self {
            kind: match content.kind {
                ReportSensitiveContentKind::HeartRate => "heart-rate",
                ReportSensitiveContentKind::PreciseLocation => "precise-location",
            },
            block_ref: content.block_ref,
            included: content.included,
            endpoint_redaction_meters: content.endpoint_redaction_meters,
        }
    }
}

fn report_limitation(limitation: ReportLimitation) -> &'static str {
    match limitation {
        ReportLimitation::DistanceUnavailable => "distance-unavailable",
        ReportLimitation::EnergyUnavailable => "energy-unavailable",
        ReportLimitation::HeartRateUnavailable => "heart-rate-unavailable",
        ReportLimitation::SportUnclassified => "sport-unclassified",
        ReportLimitation::SportUnavailable => "sport-unavailable",
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedSessionReportDto {
    definition: ReportDefinitionDto,
    resolved_snapshot_ref: String,
    status: &'static str,
    session: ReportSessionEvidenceDto,
    routes: Vec<ReportRouteEvidenceDto>,
    training_comparison: Option<TrainingComparisonDto>,
    provenance: TrainingProvenanceCurrentDto,
    sensitive_contents: Vec<ReportSensitiveContentDto>,
    limitations: Vec<&'static str>,
}

impl From<ResolvedSessionReport> for ResolvedSessionReportDto {
    fn from(report: ResolvedSessionReport) -> Self {
        Self {
            definition: report.definition.into(),
            resolved_snapshot_ref: report.resolved_snapshot_ref,
            status: match report.status {
                ReportResolutionStatus::Current => "current",
                ReportResolutionStatus::Stale => "stale",
            },
            session: report.session.into(),
            routes: report.routes.into_iter().map(Into::into).collect(),
            training_comparison: report.training_comparison.map(Into::into),
            provenance: report.provenance.into(),
            sensitive_contents: report
                .sensitive_contents
                .into_iter()
                .map(Into::into)
                .collect(),
            limitations: report
                .limitations
                .into_iter()
                .map(report_limitation)
                .collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase"
)]
pub enum ReportEvidenceProvenanceDto {
    Session {
        current: TrainingProvenanceCurrentDto,
    },
    LibrarySnapshot,
    AuthoredOnly,
}

impl From<ReportEvidenceProvenance> for ReportEvidenceProvenanceDto {
    fn from(provenance: ReportEvidenceProvenance) -> Self {
        match provenance {
            ReportEvidenceProvenance::Session(current) => Self::Session {
                current: current.into(),
            },
            ReportEvidenceProvenance::LibrarySnapshot => Self::LibrarySnapshot,
            ReportEvidenceProvenance::AuthoredOnly => Self::AuthoredOnly,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedReportDto {
    definition: ReportDefinitionDto,
    resolved_snapshot_ref: String,
    status: &'static str,
    session: Option<ReportSessionEvidenceDto>,
    routes: Vec<ReportRouteEvidenceDto>,
    training_comparison: Option<TrainingComparisonDto>,
    provenance: ReportEvidenceProvenanceDto,
    sensitive_contents: Vec<ReportSensitiveContentDto>,
    limitations: Vec<&'static str>,
}

impl From<ResolvedReport> for ResolvedReportDto {
    fn from(report: ResolvedReport) -> Self {
        Self {
            definition: report.definition.into(),
            resolved_snapshot_ref: report.resolved_snapshot_ref,
            status: match report.status {
                ReportResolutionStatus::Current => "current",
                ReportResolutionStatus::Stale => "stale",
            },
            session: report.session.map(Into::into),
            routes: report.routes.into_iter().map(Into::into).collect(),
            training_comparison: report.training_comparison.map(Into::into),
            provenance: report.provenance.into(),
            sensitive_contents: report
                .sensitive_contents
                .into_iter()
                .map(Into::into)
                .collect(),
            limitations: report
                .limitations
                .into_iter()
                .map(report_limitation)
                .collect(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SessionReportExportRequestDto {
    report_ref: String,
    expected_revision: String,
    expected_source_snapshot_ref: String,
    include_physiological_context: bool,
    #[serde(default)]
    route_choices: Vec<ReportRouteExportChoiceDto>,
    destination_path: String,
}

pub type ReportExportRequestDto = SessionReportExportRequestDto;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReportRouteExportChoiceDto {
    block_ref: String,
    include_geometry: bool,
    endpoint_redaction_meters: u32,
}

impl From<ReportRouteExportChoiceDto> for ReportRouteExportChoice {
    fn from(choice: ReportRouteExportChoiceDto) -> Self {
        Self {
            block_ref: choice.block_ref,
            include_geometry: choice.include_geometry,
            endpoint_redaction_meters: choice.endpoint_redaction_meters,
        }
    }
}

impl TryFrom<SessionReportExportRequestDto> for ReportExportRequest {
    type Error = CommandErrorDto;

    fn try_from(request: SessionReportExportRequestDto) -> Result<Self, Self::Error> {
        if request.destination_path.is_empty() || request.destination_path.len() > 32_768 {
            return Err(CommandErrorDto::new("invalid-report-definition"));
        }
        let destination = PathBuf::from(request.destination_path);
        if !destination.is_absolute() || destination.file_name().is_none() {
            return Err(CommandErrorDto::new("invalid-report-definition"));
        }
        Ok(Self {
            report_ref: request.report_ref,
            expected_revision: parse_canonical_u64(
                &request.expected_revision,
                "invalid-report-definition",
            )?,
            expected_source_snapshot_ref: request.expected_source_snapshot_ref,
            include_physiological_context: request.include_physiological_context,
            route_choices: request.route_choices.into_iter().map(Into::into).collect(),
            destination,
        })
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportExportReceiptDto {
    byte_count: String,
}

impl From<ReportExportReceipt> for ReportExportReceiptDto {
    fn from(receipt: ReportExportReceipt) -> Self {
        Self {
            byte_count: receipt.byte_count.to_string(),
        }
    }
}

fn report_locale(code: &str) -> Result<ReportLocale, CommandErrorDto> {
    ReportLocale::from_code(code).ok_or_else(|| CommandErrorDto::new("invalid-report-definition"))
}

fn parse_canonical_u64(value: &str, error_code: &'static str) -> Result<u64, CommandErrorDto> {
    let parsed = value
        .parse::<u64>()
        .map_err(|_| CommandErrorDto::new(error_code))?;
    if parsed == 0 || parsed.to_string() != value {
        return Err(CommandErrorDto::new(error_code));
    }
    Ok(parsed)
}

impl From<TrainingSessionProvenanceResult> for TrainingSessionProvenanceResultDto {
    fn from(result: TrainingSessionProvenanceResult) -> Self {
        Self {
            snapshot_ref: result.snapshot_ref,
            session_ref: result.session_ref,
            total_event_count: result.total_event_count,
            offset: result.offset,
            limit: result.limit,
            next_offset: result.next_offset,
            current: result.current.into(),
            events: result.events.into_iter().map(Into::into).collect(),
        }
    }
}

impl From<TrainingSessionSignalsResult> for TrainingSessionSignalsResultDto {
    fn from(result: TrainingSessionSignalsResult) -> Self {
        Self {
            snapshot_ref: result.snapshot_ref,
            session_ref: result.session_ref,
            signals: result.signals.map(Into::into),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSignalSamplesResultDto {
    snapshot_ref: String,
    session_ref: String,
    signal_ref: String,
    exercise_ref: String,
    ordinal: usize,
    role: &'static str,
    kind: &'static str,
    unit: &'static str,
    interval_milliseconds: String,
    sample_count: usize,
    offset: usize,
    samples: Vec<TrainingSignalSampleDto>,
    next_offset: Option<usize>,
}

impl From<PersistedTrainingSignalSamples> for TrainingSignalSamplesResultDto {
    fn from(result: PersistedTrainingSignalSamples) -> Self {
        Self {
            snapshot_ref: result.snapshot_ref,
            session_ref: result.session_ref,
            signal_ref: result.signal_ref,
            exercise_ref: result.exercise_ref,
            ordinal: result.ordinal,
            role: training_signal_role(result.role),
            kind: training_signal_kind(result.kind),
            unit: training_signal_unit(result.unit),
            interval_milliseconds: result.interval_milliseconds.to_string(),
            sample_count: result.sample_count,
            offset: result.offset,
            samples: result.samples.into_iter().map(Into::into).collect(),
            next_offset: result.next_offset,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase"
)]
pub enum SegmentCriterionDefinitionDto {
    EqualElapsedTime {
        span_milliseconds: String,
    },
    EqualDistance {
        span_meters: f64,
    },
    HeartRateZone {
        minimum_beats_per_minute: u16,
        maximum_beats_per_minute: u16,
    },
    ManualBoundaries {
        elapsed_milliseconds: Vec<String>,
    },
}

impl From<&SegmentCriterionDefinition> for SegmentCriterionDefinitionDto {
    fn from(definition: &SegmentCriterionDefinition) -> Self {
        match definition {
            SegmentCriterionDefinition::EqualElapsedTime { span_milliseconds } => {
                Self::EqualElapsedTime {
                    span_milliseconds: span_milliseconds.to_string(),
                }
            }
            SegmentCriterionDefinition::EqualDistance { span_meters } => Self::EqualDistance {
                span_meters: *span_meters,
            },
            SegmentCriterionDefinition::HeartRateZone {
                minimum_beats_per_minute,
                maximum_beats_per_minute,
            } => Self::HeartRateZone {
                minimum_beats_per_minute: *minimum_beats_per_minute,
                maximum_beats_per_minute: *maximum_beats_per_minute,
            },
            SegmentCriterionDefinition::ManualBoundaries {
                elapsed_milliseconds,
            } => Self::ManualBoundaries {
                elapsed_milliseconds: elapsed_milliseconds
                    .iter()
                    .map(ToString::to_string)
                    .collect(),
            },
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SegmentCriterionDto {
    criterion_ref: String,
    title: String,
    definition: SegmentCriterionDefinitionDto,
    authorship: &'static str,
    evaluation_version: u32,
    revision: u64,
}

impl From<SegmentCriterion> for SegmentCriterionDto {
    fn from(criterion: SegmentCriterion) -> Self {
        let authorship = match criterion.authorship() {
            SegmentCriterionAuthorship::User => "user",
        };
        Self {
            criterion_ref: criterion.criterion_id().to_owned(),
            title: criterion.title().to_owned(),
            definition: criterion.definition().into(),
            authorship,
            evaluation_version: criterion.evaluation_version(),
            revision: criterion.revision(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingDerivedSegmentDto {
    ordinal: usize,
    started_at_elapsed_milliseconds: String,
    ended_at_elapsed_milliseconds: String,
    attribution: &'static str,
}

impl From<TrainingDerivedSegment> for TrainingDerivedSegmentDto {
    fn from(segment: TrainingDerivedSegment) -> Self {
        Self {
            ordinal: segment.ordinal,
            started_at_elapsed_milliseconds: segment.started_at_elapsed_milliseconds.to_string(),
            ended_at_elapsed_milliseconds: segment.ended_at_elapsed_milliseconds.to_string(),
            attribution: "fitfreed-derived",
        }
    }
}

fn segment_applicability(value: SegmentApplicabilityView) -> &'static str {
    match value {
        SegmentApplicabilityView::Applicable => "applicable",
        SegmentApplicabilityView::MissingPrerequisite => "missing-prerequisite",
        SegmentApplicabilityView::AmbiguousPrerequisite => "ambiguous-prerequisite",
        SegmentApplicabilityView::IncompleteEvidence => "incomplete-evidence",
        SegmentApplicabilityView::OutsideSession => "outside-session",
        SegmentApplicabilityView::TooManySegments => "too-many-segments",
    }
}

fn segment_measurement(value: SegmentMeasurementView) -> &'static str {
    match value {
        SegmentMeasurementView::Distance => "distance",
        SegmentMeasurementView::HeartRate => "heart-rate",
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppliedTrainingSegmentCriterionDto {
    criterion: SegmentCriterionDto,
    ordinal: usize,
    applicability: &'static str,
    required_measurement: Option<&'static str>,
    has_evidence_gaps: bool,
    segments: Vec<TrainingDerivedSegmentDto>,
}

impl From<AppliedTrainingSegmentCriterion> for AppliedTrainingSegmentCriterionDto {
    fn from(applied: AppliedTrainingSegmentCriterion) -> Self {
        Self {
            criterion: applied.criterion.into(),
            ordinal: applied.ordinal,
            applicability: segment_applicability(applied.applicability),
            required_measurement: applied.required_measurement.map(segment_measurement),
            has_evidence_gaps: applied.has_evidence_gaps,
            segments: applied.segments.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingExerciseSegmentationDto {
    exercise_ref: String,
    ordinal: usize,
    duration_milliseconds: String,
    applied_criteria: Vec<AppliedTrainingSegmentCriterionDto>,
}

impl From<TrainingExerciseSegmentation> for TrainingExerciseSegmentationDto {
    fn from(exercise: TrainingExerciseSegmentation) -> Self {
        Self {
            exercise_ref: exercise.exercise_ref,
            ordinal: exercise.ordinal,
            duration_milliseconds: exercise.duration_milliseconds.to_string(),
            applied_criteria: exercise
                .applied_criteria
                .into_iter()
                .map(Into::into)
                .collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionSegmentationResultDto {
    snapshot_ref: String,
    session_ref: String,
    available_criteria: Vec<SegmentCriterionDto>,
    exercises: Option<Vec<TrainingExerciseSegmentationDto>>,
}

impl From<TrainingSessionSegmentationResult> for TrainingSessionSegmentationResultDto {
    fn from(result: TrainingSessionSegmentationResult) -> Self {
        Self {
            snapshot_ref: result.snapshot_ref,
            session_ref: result.session_ref,
            available_criteria: result
                .available_criteria
                .into_iter()
                .map(Into::into)
                .collect(),
            exercises: result
                .exercises
                .map(|exercises| exercises.into_iter().map(Into::into).collect()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(
    tag = "scope",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase"
)]
pub enum TrainingSessionRangeCoordinateDto {
    #[serde(rename = "exercise-elapsed")]
    Exercise,
    #[serde(rename = "route-elapsed")]
    Route { route_ref: String },
    #[serde(rename = "signal-elapsed")]
    Signal { signal_ref: String },
    #[serde(rename = "legacy-session-elapsed")]
    LegacySession,
}

impl From<&TrainingSessionRangeCoordinate> for TrainingSessionRangeCoordinateDto {
    fn from(coordinate: &TrainingSessionRangeCoordinate) -> Self {
        match coordinate.scope() {
            TrainingSessionRangeCoordinateScope::ExerciseElapsed => Self::Exercise,
            TrainingSessionRangeCoordinateScope::RouteElapsed => Self::Route {
                route_ref: coordinate
                    .reference()
                    .expect("validated route coordinate has a reference")
                    .to_owned(),
            },
            TrainingSessionRangeCoordinateScope::SignalElapsed => Self::Signal {
                signal_ref: coordinate
                    .reference()
                    .expect("validated signal coordinate has a reference")
                    .to_owned(),
            },
            TrainingSessionRangeCoordinateScope::LegacySessionElapsed => Self::LegacySession,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionRangeDto {
    range_ref: String,
    exercise_ref: Option<String>,
    coordinate: TrainingSessionRangeCoordinateDto,
    title: String,
    started_at_elapsed_milliseconds: String,
    ended_at_elapsed_milliseconds: String,
    evidence_revision: String,
    authorship: &'static str,
    state: &'static str,
    revision: u64,
}

impl From<TrainingSessionRange> for TrainingSessionRangeDto {
    fn from(range: TrainingSessionRange) -> Self {
        let authorship = match range.authorship() {
            TrainingSessionRangeAuthorship::User => "user",
        };
        let state = match range.state() {
            TrainingSessionRangeState::Current => "current",
            TrainingSessionRangeState::ReviewRequired => "review-required",
        };
        Self {
            range_ref: range.range_id().to_owned(),
            exercise_ref: range.exercise_ref().map(str::to_owned),
            coordinate: range.coordinate().into(),
            title: range.title().to_owned(),
            started_at_elapsed_milliseconds: range.started_at_elapsed_milliseconds().to_string(),
            ended_at_elapsed_milliseconds: range.ended_at_elapsed_milliseconds().to_string(),
            evidence_revision: range.evidence_revision().to_owned(),
            authorship,
            state,
            revision: range.revision(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionRangeCoordinateContextDto {
    coordinate: TrainingSessionRangeCoordinateDto,
    maximum_elapsed_milliseconds: String,
}

impl From<TrainingSessionRangeCoordinateContext> for TrainingSessionRangeCoordinateContextDto {
    fn from(context: TrainingSessionRangeCoordinateContext) -> Self {
        Self {
            coordinate: (&context.coordinate).into(),
            maximum_elapsed_milliseconds: context.maximum_elapsed_milliseconds.to_string(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionRangeExerciseContextDto {
    exercise_ref: String,
    ordinal: usize,
    coordinates: Vec<TrainingSessionRangeCoordinateContextDto>,
}

impl From<TrainingSessionRangeExerciseContext> for TrainingSessionRangeExerciseContextDto {
    fn from(exercise: TrainingSessionRangeExerciseContext) -> Self {
        Self {
            exercise_ref: exercise.exercise_ref,
            ordinal: exercise.ordinal,
            coordinates: exercise.coordinates.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionRangesResultDto {
    snapshot_ref: String,
    session_ref: String,
    session_duration_milliseconds: String,
    evidence_revision: String,
    exercises: Vec<TrainingSessionRangeExerciseContextDto>,
    ranges: Vec<TrainingSessionRangeDto>,
}

impl From<TrainingSessionRangesResult> for TrainingSessionRangesResultDto {
    fn from(result: TrainingSessionRangesResult) -> Self {
        Self {
            snapshot_ref: result.snapshot_ref,
            session_ref: result.session_ref,
            session_duration_milliseconds: result.session_duration_milliseconds.to_string(),
            evidence_revision: result.evidence_revision,
            exercises: result.exercises.into_iter().map(Into::into).collect(),
            ranges: result.ranges.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TrainingSessionRangeSummaryQueryDto {
    session_ref: String,
    snapshot_ref: String,
    range_ref: String,
    expected_range_revision: u64,
}

impl From<TrainingSessionRangeSummaryQueryDto> for TrainingSessionRangeSummaryQuery {
    fn from(query: TrainingSessionRangeSummaryQueryDto) -> Self {
        Self {
            session_ref: query.session_ref,
            snapshot_ref: query.snapshot_ref,
            range_ref: query.range_ref,
            expected_range_revision: query.expected_range_revision,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingRangeSummaryExerciseDto {
    exercise_ref: String,
    ordinal: usize,
    duration_milliseconds: String,
    distance_meters: Option<f64>,
    sport: TrainingSessionSportDto,
}

impl From<PersistedTrainingRangeSummaryExercise> for TrainingRangeSummaryExerciseDto {
    fn from(exercise: PersistedTrainingRangeSummaryExercise) -> Self {
        Self {
            exercise_ref: exercise.exercise_ref,
            ordinal: exercise.ordinal,
            duration_milliseconds: exercise.duration_milliseconds.to_string(),
            distance_meters: exercise.distance_meters,
            sport: exercise.sport.into(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(tag = "scope", rename_all_fields = "camelCase")]
pub enum TrainingRangeCoordinateEvidenceDto {
    #[serde(rename = "exercise-elapsed")]
    Exercise {
        maximum_elapsed_milliseconds: String,
    },
    #[serde(rename = "route-elapsed")]
    Route {
        route_ref: String,
        kind: &'static str,
    },
    #[serde(rename = "signal-elapsed")]
    Signal {
        signal_ref: String,
        ordinal: usize,
        role: &'static str,
        kind: &'static str,
        unit: &'static str,
        interval_milliseconds: String,
    },
    #[serde(rename = "unavailable")]
    Unavailable,
}

impl From<TrainingRangeCoordinateEvidence> for TrainingRangeCoordinateEvidenceDto {
    fn from(evidence: TrainingRangeCoordinateEvidence) -> Self {
        match evidence {
            TrainingRangeCoordinateEvidence::Exercise {
                maximum_elapsed_milliseconds,
            } => Self::Exercise {
                maximum_elapsed_milliseconds: maximum_elapsed_milliseconds.to_string(),
            },
            TrainingRangeCoordinateEvidence::Route { route_ref, kind } => Self::Route {
                route_ref,
                kind: training_route_kind(kind),
            },
            TrainingRangeCoordinateEvidence::Signal {
                signal_ref,
                ordinal,
                role,
                kind,
                unit,
                interval_milliseconds,
            } => Self::Signal {
                signal_ref,
                ordinal,
                role: training_signal_role(role),
                kind: training_signal_kind(kind),
                unit: training_signal_unit(unit),
                interval_milliseconds: interval_milliseconds.to_string(),
            },
            TrainingRangeCoordinateEvidence::Unavailable => Self::Unavailable,
        }
    }
}

fn training_range_boundary_state(state: TrainingRangeBoundaryEvidenceState) -> &'static str {
    match state {
        TrainingRangeBoundaryEvidenceState::Exact => "exact",
        TrainingRangeBoundaryEvidenceState::BetweenEvidence => "between-evidence",
        TrainingRangeBoundaryEvidenceState::OutsideRecordedEvidence => "outside-recorded-evidence",
        TrainingRangeBoundaryEvidenceState::NoEvidence => "no-evidence",
    }
}

fn training_range_exact_kind(kind: TrainingRangeExactEvidenceKind) -> &'static str {
    match kind {
        TrainingRangeExactEvidenceKind::Exercise => "exercise",
        TrainingRangeExactEvidenceKind::ManualLap => "manual-lap",
        TrainingRangeExactEvidenceKind::AutomaticLap => "automatic-lap",
        TrainingRangeExactEvidenceKind::RoutePoint => "route-point",
        TrainingRangeExactEvidenceKind::SignalSample => "signal-sample",
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingRangeEvidenceLocationDto {
    kind: &'static str,
    evidence_ref: String,
    ordinal: Option<usize>,
    elapsed_milliseconds: String,
}

impl From<TrainingRangeEvidenceLocation> for TrainingRangeEvidenceLocationDto {
    fn from(location: TrainingRangeEvidenceLocation) -> Self {
        Self {
            kind: training_range_exact_kind(location.kind),
            evidence_ref: location.evidence_ref,
            ordinal: location.ordinal,
            elapsed_milliseconds: location.elapsed_milliseconds.to_string(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingRangeBoundaryEvidenceDto {
    elapsed_milliseconds: String,
    state: &'static str,
    exact_match_count: usize,
    exact_matches: Vec<TrainingRangeEvidenceLocationDto>,
    preceding: Option<TrainingRangeEvidenceLocationDto>,
    following: Option<TrainingRangeEvidenceLocationDto>,
}

impl From<TrainingRangeBoundaryEvidence> for TrainingRangeBoundaryEvidenceDto {
    fn from(boundary: TrainingRangeBoundaryEvidence) -> Self {
        Self {
            elapsed_milliseconds: boundary.elapsed_milliseconds.to_string(),
            state: training_range_boundary_state(boundary.state),
            exact_match_count: boundary.exact_match_count,
            exact_matches: boundary.exact_matches.into_iter().map(Into::into).collect(),
            preceding: boundary.preceding.map(Into::into),
            following: boundary.following.map(Into::into),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingRangeBoundaryPairDto {
    start: TrainingRangeBoundaryEvidenceDto,
    end: TrainingRangeBoundaryEvidenceDto,
}

impl From<TrainingRangeBoundaryPair> for TrainingRangeBoundaryPairDto {
    fn from(boundaries: TrainingRangeBoundaryPair) -> Self {
        Self {
            start: boundaries.start.into(),
            end: boundaries.end.into(),
        }
    }
}

fn training_range_coverage_state(state: TrainingRangeSummaryCoverageState) -> &'static str {
    match state {
        TrainingRangeSummaryCoverageState::Complete => "complete",
        TrainingRangeSummaryCoverageState::Partial => "partial",
        TrainingRangeSummaryCoverageState::Empty => "empty",
        TrainingRangeSummaryCoverageState::Unavailable => "unavailable",
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingRangeMissingIntervalDto {
    started_at_elapsed_milliseconds: String,
    ended_at_elapsed_milliseconds: String,
}

impl From<TrainingRangeMissingInterval> for TrainingRangeMissingIntervalDto {
    fn from(interval: TrainingRangeMissingInterval) -> Self {
        Self {
            started_at_elapsed_milliseconds: interval.started_at_elapsed_milliseconds.to_string(),
            ended_at_elapsed_milliseconds: interval.ended_at_elapsed_milliseconds.to_string(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingRangeEvidenceCoverageDto {
    state: &'static str,
    recorded_evidence_count: usize,
    selected_evidence_count: usize,
    available_evidence_count: usize,
    missing_evidence_count: usize,
    missing_elapsed_evidence_count: usize,
    missing_intervals: Vec<TrainingRangeMissingIntervalDto>,
    omitted_missing_interval_count: usize,
}

impl From<TrainingRangeEvidenceCoverage> for TrainingRangeEvidenceCoverageDto {
    fn from(coverage: TrainingRangeEvidenceCoverage) -> Self {
        Self {
            state: training_range_coverage_state(coverage.state),
            recorded_evidence_count: coverage.recorded_evidence_count,
            selected_evidence_count: coverage.selected_evidence_count,
            available_evidence_count: coverage.available_evidence_count,
            missing_evidence_count: coverage.missing_evidence_count,
            missing_elapsed_evidence_count: coverage.missing_elapsed_evidence_count,
            missing_intervals: coverage
                .missing_intervals
                .into_iter()
                .map(Into::into)
                .collect(),
            omitted_missing_interval_count: coverage.omitted_missing_interval_count,
        }
    }
}

fn training_range_metric_coverage(coverage: TrainingRangeMetricCoverage) -> &'static str {
    match coverage {
        TrainingRangeMetricCoverage::Complete => "complete",
        TrainingRangeMetricCoverage::Partial => "partial",
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingRangeDistanceSummaryDto {
    meters: f64,
    coverage: &'static str,
}

impl From<TrainingRangeDistanceSummary> for TrainingRangeDistanceSummaryDto {
    fn from(distance: TrainingRangeDistanceSummary) -> Self {
        Self {
            meters: distance.meters,
            coverage: training_range_metric_coverage(distance.coverage),
        }
    }
}

fn training_range_cardinal_direction(direction: TrainingRangeCardinalDirection) -> &'static str {
    match direction {
        TrainingRangeCardinalDirection::North => "north",
        TrainingRangeCardinalDirection::NorthEast => "north-east",
        TrainingRangeCardinalDirection::East => "east",
        TrainingRangeCardinalDirection::SouthEast => "south-east",
        TrainingRangeCardinalDirection::South => "south",
        TrainingRangeCardinalDirection::SouthWest => "south-west",
        TrainingRangeCardinalDirection::West => "west",
        TrainingRangeCardinalDirection::NorthWest => "north-west",
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingRangeDirectionSummaryDto {
    initial_bearing_degrees: f64,
    cardinal: &'static str,
}

impl From<TrainingRangeDirectionSummary> for TrainingRangeDirectionSummaryDto {
    fn from(direction: TrainingRangeDirectionSummary) -> Self {
        Self {
            initial_bearing_degrees: direction.initial_bearing_degrees,
            cardinal: training_range_cardinal_direction(direction.cardinal),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingRangeMeasurementSummaryDto {
    kind: &'static str,
    unit: &'static str,
    minimum: f64,
    maximum: f64,
    average: f64,
    available_evidence_count: usize,
    missing_evidence_count: usize,
    start_boundary_value: Option<f64>,
    end_boundary_value: Option<f64>,
}

impl From<TrainingRangeMeasurementSummary> for TrainingRangeMeasurementSummaryDto {
    fn from(measurement: TrainingRangeMeasurementSummary) -> Self {
        Self {
            kind: training_signal_kind(measurement.kind),
            unit: training_signal_unit(measurement.unit),
            minimum: measurement.minimum,
            maximum: measurement.maximum,
            average: measurement.average,
            available_evidence_count: measurement.available_evidence_count,
            missing_evidence_count: measurement.missing_evidence_count,
            start_boundary_value: measurement.start_boundary_value,
            end_boundary_value: measurement.end_boundary_value,
        }
    }
}

fn training_range_source_kind(kind: TrainingRangeSourceRangeKind) -> &'static str {
    match kind {
        TrainingRangeSourceRangeKind::ManualLap => "manual-lap",
        TrainingRangeSourceRangeKind::AutomaticLap => "automatic-lap",
    }
}

fn training_range_overlap_relation(relation: TrainingRangeSourceOverlapRelation) -> &'static str {
    match relation {
        TrainingRangeSourceOverlapRelation::Exact => "exact",
        TrainingRangeSourceOverlapRelation::SourceContainsRange => "source-contains-range",
        TrainingRangeSourceOverlapRelation::RangeContainsSource => "range-contains-source",
        TrainingRangeSourceOverlapRelation::Overlap => "overlap",
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingRangeSourceOverlapDto {
    source_range_ref: String,
    kind: &'static str,
    ordinal: usize,
    started_at_elapsed_milliseconds: String,
    ended_at_elapsed_milliseconds: String,
    distance_meters: Option<f64>,
    relation: &'static str,
}

impl From<TrainingRangeSourceOverlap> for TrainingRangeSourceOverlapDto {
    fn from(source: TrainingRangeSourceOverlap) -> Self {
        Self {
            source_range_ref: source.source_range_ref,
            kind: training_range_source_kind(source.kind),
            ordinal: source.ordinal,
            started_at_elapsed_milliseconds: source.started_at_elapsed_milliseconds.to_string(),
            ended_at_elapsed_milliseconds: source.ended_at_elapsed_milliseconds.to_string(),
            distance_meters: source.distance_meters,
            relation: training_range_overlap_relation(source.relation),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingRangeIndependentEvidenceDto {
    source_range_count: usize,
    route_coordinate_count: usize,
    signal_coordinate_count: usize,
}

impl From<TrainingRangeIndependentEvidence> for TrainingRangeIndependentEvidenceDto {
    fn from(evidence: TrainingRangeIndependentEvidence) -> Self {
        Self {
            source_range_count: evidence.source_range_count,
            route_coordinate_count: evidence.route_coordinate_count,
            signal_coordinate_count: evidence.signal_coordinate_count,
        }
    }
}

fn training_range_limitation(limitation: TrainingRangeSummaryLimitation) -> &'static str {
    match limitation {
        TrainingRangeSummaryLimitation::CoordinateUnavailable => "coordinate-unavailable",
        TrainingRangeSummaryLimitation::BoundaryNotExact => "boundary-not-exact",
        TrainingRangeSummaryLimitation::MissingElapsedRouteEvidence => {
            "missing-elapsed-route-evidence"
        }
        TrainingRangeSummaryLimitation::MissingSignalEvidence => "missing-signal-evidence",
        TrainingRangeSummaryLimitation::InsufficientRouteGeometry => "insufficient-route-geometry",
        TrainingRangeSummaryLimitation::AmbiguousSourceDistance => "ambiguous-source-distance",
        TrainingRangeSummaryLimitation::DistanceUnavailable => "distance-unavailable",
        TrainingRangeSummaryLimitation::MovingTimeUnavailable => "moving-time-unavailable",
        TrainingRangeSummaryLimitation::PausedTimeUnavailable => "paused-time-unavailable",
        TrainingRangeSummaryLimitation::UnalignedSourceRangeEvidence => {
            "unaligned-source-range-evidence"
        }
        TrainingRangeSummaryLimitation::UnalignedRouteEvidence => "unaligned-route-evidence",
        TrainingRangeSummaryLimitation::UnalignedSignalEvidence => "unaligned-signal-evidence",
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSessionRangeSummaryDto {
    snapshot_ref: String,
    session_ref: String,
    evidence_revision: String,
    source_provider: String,
    range: TrainingSessionRangeDto,
    exercise: Option<TrainingRangeSummaryExerciseDto>,
    coordinate_evidence: TrainingRangeCoordinateEvidenceDto,
    elapsed_duration_milliseconds: String,
    moving_duration_milliseconds: Option<String>,
    paused_duration_milliseconds: Option<String>,
    distance: Option<TrainingRangeDistanceSummaryDto>,
    direction: Option<TrainingRangeDirectionSummaryDto>,
    measurements: Vec<TrainingRangeMeasurementSummaryDto>,
    boundaries: TrainingRangeBoundaryPairDto,
    coverage: TrainingRangeEvidenceCoverageDto,
    source_ranges: Vec<TrainingRangeSourceOverlapDto>,
    independent_evidence: TrainingRangeIndependentEvidenceDto,
    limitations: Vec<&'static str>,
}

impl From<TrainingSessionRangeSummary> for TrainingSessionRangeSummaryDto {
    fn from(summary: TrainingSessionRangeSummary) -> Self {
        Self {
            snapshot_ref: summary.snapshot_ref,
            session_ref: summary.session_ref,
            evidence_revision: summary.evidence_revision,
            source_provider: summary.source_provider.code().to_owned(),
            range: summary.range.into(),
            exercise: summary.exercise.map(Into::into),
            coordinate_evidence: summary.coordinate_evidence.into(),
            elapsed_duration_milliseconds: summary.elapsed_duration_milliseconds.to_string(),
            moving_duration_milliseconds: summary
                .moving_duration_milliseconds
                .map(|value| value.to_string()),
            paused_duration_milliseconds: summary
                .paused_duration_milliseconds
                .map(|value| value.to_string()),
            distance: summary.distance.map(Into::into),
            direction: summary.direction.map(Into::into),
            measurements: summary.measurements.into_iter().map(Into::into).collect(),
            boundaries: summary.boundaries.into(),
            coverage: summary.coverage.into(),
            source_ranges: summary.source_ranges.into_iter().map(Into::into).collect(),
            independent_evidence: summary.independent_evidence.into(),
            limitations: summary
                .limitations
                .into_iter()
                .map(training_range_limitation)
                .collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSeriesSummaryDto {
    calendar_days: usize,
    training_days: usize,
    session_count: usize,
    total_duration_milliseconds: String,
    distance_session_count: usize,
    total_distance_meters: Option<f64>,
    energy_session_count: usize,
    total_energy_kilocalories: Option<String>,
    heart_rate_session_count: usize,
}

impl From<TrainingSeriesSummary> for TrainingSeriesSummaryDto {
    fn from(summary: TrainingSeriesSummary) -> Self {
        Self {
            calendar_days: summary.calendar_days,
            training_days: summary.training_days,
            session_count: summary.session_count,
            total_duration_milliseconds: summary.total_duration_milliseconds.to_string(),
            distance_session_count: summary.distance_session_count,
            total_distance_meters: summary.total_distance_meters,
            energy_session_count: summary.energy_session_count,
            total_energy_kilocalories: summary
                .total_energy_kilocalories
                .map(|value| value.to_string()),
            heart_rate_session_count: summary.heart_rate_session_count,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingSeriesComparisonDto {
    series_ref: String,
    baseline: TrainingSeriesSummaryDto,
    comparison: TrainingSeriesSummaryDto,
    session_count_change: String,
    training_day_change: String,
    duration_milliseconds_change: String,
    distance_meters_change: Option<f64>,
    energy_kilocalories_change: Option<String>,
}

impl From<TrainingSeriesComparison> for TrainingSeriesComparisonDto {
    fn from(series: TrainingSeriesComparison) -> Self {
        Self {
            series_ref: series.series_ref,
            baseline: series.baseline.into(),
            comparison: series.comparison.into(),
            session_count_change: series.session_count_change.to_string(),
            training_day_change: series.training_day_change.to_string(),
            duration_milliseconds_change: series.duration_milliseconds_change.to_string(),
            distance_meters_change: series.distance_meters_change,
            energy_kilocalories_change: series
                .energy_kilocalories_change
                .map(|value| value.to_string()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingComparisonDto {
    available_range: Option<TrainingDateRangeDto>,
    baseline_range: Option<TrainingDateRangeDto>,
    comparison_range: Option<TrainingDateRangeDto>,
    series: Vec<TrainingSeriesComparisonDto>,
}

impl From<TrainingComparison> for TrainingComparisonDto {
    fn from(comparison: TrainingComparison) -> Self {
        Self {
            available_range: comparison.available_range.map(Into::into),
            baseline_range: comparison.baseline_range.map(Into::into),
            comparison_range: comparison.comparison_range.map(Into::into),
            series: comparison.series.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepDateRangeDto {
    from: String,
    through: String,
}

impl From<SleepDateRangeDto> for SleepDateRange {
    fn from(range: SleepDateRangeDto) -> Self {
        Self {
            from: range.from,
            through: range.through,
        }
    }
}

impl From<SleepDateRange> for SleepDateRangeDto {
    fn from(range: SleepDateRange) -> Self {
        Self {
            from: range.from,
            through: range.through,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepPhaseSummaryDto {
    wake_milliseconds: String,
    rem_milliseconds: String,
    light_milliseconds: String,
    deep_milliseconds: String,
    unrecognized_milliseconds: String,
}

impl From<SleepPhaseSummary> for SleepPhaseSummaryDto {
    fn from(summary: SleepPhaseSummary) -> Self {
        Self {
            wake_milliseconds: summary.wake_milliseconds.to_string(),
            rem_milliseconds: summary.rem_milliseconds.to_string(),
            light_milliseconds: summary.light_milliseconds.to_string(),
            deep_milliseconds: summary.deep_milliseconds.to_string(),
            unrecognized_milliseconds: summary.unrecognized_milliseconds.to_string(),
        }
    }
}

impl From<SleepPhaseTotals> for SleepPhaseSummaryDto {
    fn from(summary: SleepPhaseTotals) -> Self {
        Self {
            wake_milliseconds: summary.wake_milliseconds.to_string(),
            rem_milliseconds: summary.rem_milliseconds.to_string(),
            light_milliseconds: summary.light_milliseconds.to_string(),
            deep_milliseconds: summary.deep_milliseconds.to_string(),
            unrecognized_milliseconds: summary.unrecognized_milliseconds.to_string(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepPeriodInsightDto {
    started_at: String,
    ended_at: String,
    span_milliseconds: String,
    asleep_milliseconds: String,
    interruption_milliseconds: String,
    long_interruption_milliseconds: String,
    short_interruption_milliseconds: String,
    interruption_count: String,
    long_interruption_count: String,
    short_interruption_count: String,
    efficiency_percent: f64,
    continuity_index: f64,
    continuity_class: i64,
    sleep_goal_milliseconds: Option<String>,
    self_reported_rating: Option<i64>,
    cycle_count: Option<String>,
    recording_ended_by_power_loss: Option<bool>,
    phase_summary: Option<SleepPhaseSummaryDto>,
    stage_timeline_available: bool,
    score_overall: Option<f64>,
    score_relative_rating: Option<i64>,
}

impl From<SleepPeriodInsight> for SleepPeriodInsightDto {
    fn from(period: SleepPeriodInsight) -> Self {
        Self {
            started_at: period.started_at,
            ended_at: period.ended_at,
            span_milliseconds: period.span_milliseconds.to_string(),
            asleep_milliseconds: period.asleep_milliseconds.to_string(),
            interruption_milliseconds: period.interruption_milliseconds.to_string(),
            long_interruption_milliseconds: period.long_interruption_milliseconds.to_string(),
            short_interruption_milliseconds: period.short_interruption_milliseconds.to_string(),
            interruption_count: period.interruption_count.to_string(),
            long_interruption_count: period.long_interruption_count.to_string(),
            short_interruption_count: period.short_interruption_count.to_string(),
            efficiency_percent: period.efficiency_percent,
            continuity_index: period.continuity_index,
            continuity_class: period.continuity_class,
            sleep_goal_milliseconds: period
                .sleep_goal_milliseconds
                .map(|value| value.to_string()),
            self_reported_rating: period.self_reported_rating,
            cycle_count: period.cycle_count.map(|value| value.to_string()),
            recording_ended_by_power_loss: period.recording_ended_by_power_loss,
            phase_summary: period.phase_summary.map(Into::into),
            stage_timeline_available: period.stage_timeline_available,
            score_overall: period.score_overall,
            score_relative_rating: period.score_relative_rating,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepDayInsightDto {
    sleep_date: String,
    availability: &'static str,
    period: Option<SleepPeriodInsightDto>,
}

impl From<SleepDayInsight> for SleepDayInsightDto {
    fn from(day: SleepDayInsight) -> Self {
        Self {
            sleep_date: day.sleep_date,
            availability: match day.availability {
                SleepDayAvailability::Available => "available",
                SleepDayAvailability::Missing => "missing",
            },
            period: day.period.map(Into::into),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepSeriesSummaryDto {
    calendar_days: usize,
    observed_nights: usize,
    missing_nights: usize,
    total_asleep_milliseconds: Option<String>,
    average_asleep_milliseconds: Option<String>,
    total_interruption_milliseconds: Option<String>,
    average_interruption_milliseconds: Option<String>,
    average_efficiency_percent: Option<f64>,
    phase_night_count: usize,
    phase_totals: Option<SleepPhaseSummaryDto>,
    stage_timeline_night_count: usize,
    score_night_count: usize,
    average_overall_score: Option<f64>,
    goal_night_count: usize,
    goal_met_night_count: usize,
    power_status_night_count: usize,
    power_loss_night_count: usize,
}

impl From<SleepSeriesSummary> for SleepSeriesSummaryDto {
    fn from(summary: SleepSeriesSummary) -> Self {
        Self {
            calendar_days: summary.calendar_days,
            observed_nights: summary.observed_nights,
            missing_nights: summary.missing_nights,
            total_asleep_milliseconds: summary
                .total_asleep_milliseconds
                .map(|value| value.to_string()),
            average_asleep_milliseconds: summary
                .average_asleep_milliseconds
                .map(|value| value.to_string()),
            total_interruption_milliseconds: summary
                .total_interruption_milliseconds
                .map(|value| value.to_string()),
            average_interruption_milliseconds: summary
                .average_interruption_milliseconds
                .map(|value| value.to_string()),
            average_efficiency_percent: summary.average_efficiency_percent,
            phase_night_count: summary.phase_night_count,
            phase_totals: summary.phase_totals.map(Into::into),
            stage_timeline_night_count: summary.stage_timeline_night_count,
            score_night_count: summary.score_night_count,
            average_overall_score: summary.average_overall_score,
            goal_night_count: summary.goal_night_count,
            goal_met_night_count: summary.goal_met_night_count,
            power_status_night_count: summary.power_status_night_count,
            power_loss_night_count: summary.power_loss_night_count,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepSeriesOverviewDto {
    series_ref: String,
    summary: SleepSeriesSummaryDto,
    days: Vec<SleepDayInsightDto>,
}

impl From<SleepSeriesOverview> for SleepSeriesOverviewDto {
    fn from(series: SleepSeriesOverview) -> Self {
        Self {
            series_ref: series.series_ref,
            summary: series.summary.into(),
            days: series.days.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepOverviewDto {
    available_range: Option<SleepDateRangeDto>,
    selected_range: Option<SleepDateRangeDto>,
    series: Vec<SleepSeriesOverviewDto>,
}

impl From<SleepOverview> for SleepOverviewDto {
    fn from(overview: SleepOverview) -> Self {
        Self {
            available_range: overview.available_range.map(Into::into),
            selected_range: overview.selected_range.map(Into::into),
            series: overview.series.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepSeriesComparisonDto {
    series_ref: String,
    baseline: SleepSeriesSummaryDto,
    comparison: SleepSeriesSummaryDto,
    observed_night_change: String,
    missing_night_change: String,
    average_asleep_milliseconds_change: Option<String>,
    average_interruption_milliseconds_change: Option<String>,
    average_efficiency_percentage_point_change: Option<f64>,
    average_overall_score_change: Option<f64>,
    goal_met_percentage_point_change: Option<f64>,
}

impl From<SleepSeriesComparison> for SleepSeriesComparisonDto {
    fn from(series: SleepSeriesComparison) -> Self {
        Self {
            series_ref: series.series_ref,
            baseline: series.baseline.into(),
            comparison: series.comparison.into(),
            observed_night_change: series.observed_night_change.to_string(),
            missing_night_change: series.missing_night_change.to_string(),
            average_asleep_milliseconds_change: series
                .average_asleep_milliseconds_change
                .map(|value| value.to_string()),
            average_interruption_milliseconds_change: series
                .average_interruption_milliseconds_change
                .map(|value| value.to_string()),
            average_efficiency_percentage_point_change: series
                .average_efficiency_percentage_point_change,
            average_overall_score_change: series.average_overall_score_change,
            goal_met_percentage_point_change: series.goal_met_percentage_point_change,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepComparisonDto {
    available_range: Option<SleepDateRangeDto>,
    baseline_range: Option<SleepDateRangeDto>,
    comparison_range: Option<SleepDateRangeDto>,
    series: Vec<SleepSeriesComparisonDto>,
}

impl From<SleepComparison> for SleepComparisonDto {
    fn from(comparison: SleepComparison) -> Self {
        Self {
            available_range: comparison.available_range.map(Into::into),
            baseline_range: comparison.baseline_range.map(Into::into),
            comparison_range: comparison.comparison_range.map(Into::into),
            series: comparison.series.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepStageTransitionDto {
    offset_milliseconds: String,
    stage: &'static str,
}

impl From<SleepStageTransition> for SleepStageTransitionDto {
    fn from(transition: SleepStageTransition) -> Self {
        Self {
            offset_milliseconds: transition.offset_milliseconds.to_string(),
            stage: match transition.stage {
                SleepStage::Wake => "wake",
                SleepStage::Rem => "rem",
                SleepStage::Light => "light",
                SleepStage::Deep => "deep",
                SleepStage::Unrecognized => "unrecognized",
            },
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepScoreDto {
    overall: f64,
    own_target_duration: f64,
    recommended_duration: f64,
    continuity: f64,
    efficiency: f64,
    rem: f64,
    deep: f64,
    long_interruptions: f64,
    duration: f64,
    solidity: f64,
    regeneration: f64,
    relative_rating: Option<i64>,
}

impl From<SleepScore> for SleepScoreDto {
    fn from(score: SleepScore) -> Self {
        Self {
            overall: score.overall,
            own_target_duration: score.own_target_duration,
            recommended_duration: score.recommended_duration,
            continuity: score.continuity,
            efficiency: score.efficiency,
            rem: score.rem,
            deep: score.deep,
            long_interruptions: score.long_interruptions,
            duration: score.duration,
            solidity: score.solidity,
            regeneration: score.regeneration,
            relative_rating: score.relative_rating,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepPeriodDetailDto {
    sleep_date: String,
    started_at: String,
    ended_at: String,
    span_milliseconds: String,
    asleep_milliseconds: String,
    interruption_milliseconds: String,
    long_interruption_milliseconds: String,
    short_interruption_milliseconds: String,
    interruption_count: String,
    long_interruption_count: String,
    short_interruption_count: String,
    efficiency_percent: f64,
    continuity_index: f64,
    continuity_class: i64,
    sleep_goal_milliseconds: Option<String>,
    self_reported_rating: Option<i64>,
    cycle_count: Option<String>,
    recording_ended_by_power_loss: Option<bool>,
    phase_summary: Option<SleepPhaseSummaryDto>,
    stage_transitions: Option<Vec<SleepStageTransitionDto>>,
    score: Option<SleepScoreDto>,
}

impl From<SleepPeriodDetail> for SleepPeriodDetailDto {
    fn from(period: SleepPeriodDetail) -> Self {
        Self {
            sleep_date: period.sleep_date,
            started_at: period.started_at,
            ended_at: period.ended_at,
            span_milliseconds: period.span_milliseconds.to_string(),
            asleep_milliseconds: period.asleep_milliseconds.to_string(),
            interruption_milliseconds: period.interruption_milliseconds.to_string(),
            long_interruption_milliseconds: period.long_interruption_milliseconds.to_string(),
            short_interruption_milliseconds: period.short_interruption_milliseconds.to_string(),
            interruption_count: period.interruption_count.to_string(),
            long_interruption_count: period.long_interruption_count.to_string(),
            short_interruption_count: period.short_interruption_count.to_string(),
            efficiency_percent: period.efficiency_percent,
            continuity_index: period.continuity_index,
            continuity_class: period.continuity_class,
            sleep_goal_milliseconds: period
                .sleep_goal_milliseconds
                .map(|value| value.to_string()),
            self_reported_rating: period.self_reported_rating,
            cycle_count: period.cycle_count.map(|value| value.to_string()),
            recording_ended_by_power_loss: period.recording_ended_by_power_loss,
            phase_summary: period.phase_summary.map(Into::into),
            stage_transitions: period
                .stage_transitions
                .map(|transitions| transitions.into_iter().map(Into::into).collect()),
            score: period.score.map(Into::into),
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryDateRangeDto {
    from: String,
    through: String,
}

impl From<RecoveryDateRangeDto> for RecoveryDateRange {
    fn from(range: RecoveryDateRangeDto) -> Self {
        Self {
            from: range.from,
            through: range.through,
        }
    }
}

impl From<RecoveryDateRange> for RecoveryDateRangeDto {
    fn from(range: RecoveryDateRange) -> Self {
        Self {
            from: range.from,
            through: range.through,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceSpecificRecoveryAssessmentDto {
    scheme: String,
    autonomic_charge: f64,
    autonomic_status: i64,
    overall_status: i64,
    overall_sublevel: String,
}

impl From<SourceSpecificRecoveryAssessment> for SourceSpecificRecoveryAssessmentDto {
    fn from(assessment: SourceSpecificRecoveryAssessment) -> Self {
        Self {
            scheme: assessment.scheme,
            autonomic_charge: assessment.autonomic_charge,
            autonomic_status: assessment.autonomic_status,
            overall_status: assessment.overall_status,
            overall_sublevel: assessment.overall_sublevel.to_string(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceSpecificRecoveryBaselineDto {
    scheme: String,
    mean_beat_to_beat_interval_milliseconds: String,
    standard_deviation_beat_to_beat_interval_milliseconds: String,
    mean_heart_rate_variability_rmssd_milliseconds: Option<String>,
    standard_deviation_heart_rate_variability_rmssd_milliseconds: Option<String>,
    mean_breathing_interval_milliseconds: String,
    standard_deviation_breathing_interval_milliseconds: String,
}

impl From<SourceSpecificRecoveryBaseline> for SourceSpecificRecoveryBaselineDto {
    fn from(baseline: SourceSpecificRecoveryBaseline) -> Self {
        Self {
            scheme: baseline.scheme,
            mean_beat_to_beat_interval_milliseconds: baseline
                .mean_beat_to_beat_interval_milliseconds
                .to_string(),
            standard_deviation_beat_to_beat_interval_milliseconds: baseline
                .standard_deviation_beat_to_beat_interval_milliseconds
                .to_string(),
            mean_heart_rate_variability_rmssd_milliseconds: baseline
                .mean_heart_rate_variability_rmssd_milliseconds
                .map(|value| value.to_string()),
            standard_deviation_heart_rate_variability_rmssd_milliseconds: baseline
                .standard_deviation_heart_rate_variability_rmssd_milliseconds
                .map(|value| value.to_string()),
            mean_breathing_interval_milliseconds: baseline
                .mean_breathing_interval_milliseconds
                .to_string(),
            standard_deviation_breathing_interval_milliseconds: baseline
                .standard_deviation_breathing_interval_milliseconds
                .to_string(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceSpecificRecoveryGuidanceDto {
    scheme: String,
    exercise: String,
    sleep: String,
    vitality: String,
}

impl From<SourceSpecificRecoveryGuidance> for SourceSpecificRecoveryGuidanceDto {
    fn from(guidance: SourceSpecificRecoveryGuidance) -> Self {
        Self {
            scheme: guidance.scheme,
            exercise: guidance.exercise,
            sleep: guidance.sleep,
            vitality: guidance.vitality,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryNightInsightDto {
    beat_to_beat_interval_milliseconds: String,
    heart_rate_variability_rmssd_milliseconds: Option<String>,
    breathing_interval_milliseconds: String,
    source_assessment: Option<SourceSpecificRecoveryAssessmentDto>,
    source_baseline_available: bool,
    source_guidance_available: bool,
}

impl From<RecoveryNightInsight> for RecoveryNightInsightDto {
    fn from(recovery: RecoveryNightInsight) -> Self {
        Self {
            beat_to_beat_interval_milliseconds: recovery
                .beat_to_beat_interval_milliseconds
                .to_string(),
            heart_rate_variability_rmssd_milliseconds: recovery
                .heart_rate_variability_rmssd_milliseconds
                .map(|value| value.to_string()),
            breathing_interval_milliseconds: recovery.breathing_interval_milliseconds.to_string(),
            source_assessment: recovery.source_assessment.map(Into::into),
            source_baseline_available: recovery.source_baseline_available,
            source_guidance_available: recovery.source_guidance_available,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryDayInsightDto {
    recovery_date: String,
    availability: &'static str,
    recovery: Option<RecoveryNightInsightDto>,
}

impl From<RecoveryDayInsight> for RecoveryDayInsightDto {
    fn from(day: RecoveryDayInsight) -> Self {
        Self {
            recovery_date: day.recovery_date,
            availability: match day.availability {
                RecoveryDayAvailability::Available => "available",
                RecoveryDayAvailability::Missing => "missing",
            },
            recovery: day.recovery.map(Into::into),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoverySeriesSummaryDto {
    calendar_days: usize,
    observed_nights: usize,
    missing_nights: usize,
    average_beat_to_beat_interval_milliseconds: Option<String>,
    rmssd_night_count: usize,
    average_heart_rate_variability_rmssd_milliseconds: Option<String>,
    average_breathing_interval_milliseconds: Option<String>,
    assessment_night_count: usize,
    baseline_night_count: usize,
    guidance_night_count: usize,
}

impl From<RecoverySeriesSummary> for RecoverySeriesSummaryDto {
    fn from(summary: RecoverySeriesSummary) -> Self {
        Self {
            calendar_days: summary.calendar_days,
            observed_nights: summary.observed_nights,
            missing_nights: summary.missing_nights,
            average_beat_to_beat_interval_milliseconds: summary
                .average_beat_to_beat_interval_milliseconds
                .map(|value| value.to_string()),
            rmssd_night_count: summary.rmssd_night_count,
            average_heart_rate_variability_rmssd_milliseconds: summary
                .average_heart_rate_variability_rmssd_milliseconds
                .map(|value| value.to_string()),
            average_breathing_interval_milliseconds: summary
                .average_breathing_interval_milliseconds
                .map(|value| value.to_string()),
            assessment_night_count: summary.assessment_night_count,
            baseline_night_count: summary.baseline_night_count,
            guidance_night_count: summary.guidance_night_count,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoverySeriesOverviewDto {
    series_ref: String,
    summary: RecoverySeriesSummaryDto,
    days: Vec<RecoveryDayInsightDto>,
}

impl From<RecoverySeriesOverview> for RecoverySeriesOverviewDto {
    fn from(series: RecoverySeriesOverview) -> Self {
        Self {
            series_ref: series.series_ref,
            summary: series.summary.into(),
            days: series.days.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryOverviewDto {
    available_range: Option<RecoveryDateRangeDto>,
    selected_range: Option<RecoveryDateRangeDto>,
    series: Vec<RecoverySeriesOverviewDto>,
}

impl From<RecoveryOverview> for RecoveryOverviewDto {
    fn from(overview: RecoveryOverview) -> Self {
        Self {
            available_range: overview.available_range.map(Into::into),
            selected_range: overview.selected_range.map(Into::into),
            series: overview.series.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoverySeriesComparisonDto {
    series_ref: String,
    baseline: RecoverySeriesSummaryDto,
    comparison: RecoverySeriesSummaryDto,
    observed_night_change: String,
    missing_night_change: String,
    average_beat_to_beat_interval_milliseconds_change: Option<String>,
    average_heart_rate_variability_rmssd_milliseconds_change: Option<String>,
    average_breathing_interval_milliseconds_change: Option<String>,
    assessment_night_change: String,
    baseline_night_change: String,
    guidance_night_change: String,
}

impl From<RecoverySeriesComparison> for RecoverySeriesComparisonDto {
    fn from(series: RecoverySeriesComparison) -> Self {
        Self {
            series_ref: series.series_ref,
            baseline: series.baseline.into(),
            comparison: series.comparison.into(),
            observed_night_change: series.observed_night_change.to_string(),
            missing_night_change: series.missing_night_change.to_string(),
            average_beat_to_beat_interval_milliseconds_change: series
                .average_beat_to_beat_interval_milliseconds_change
                .map(|value| value.to_string()),
            average_heart_rate_variability_rmssd_milliseconds_change: series
                .average_heart_rate_variability_rmssd_milliseconds_change
                .map(|value| value.to_string()),
            average_breathing_interval_milliseconds_change: series
                .average_breathing_interval_milliseconds_change
                .map(|value| value.to_string()),
            assessment_night_change: series.assessment_night_change.to_string(),
            baseline_night_change: series.baseline_night_change.to_string(),
            guidance_night_change: series.guidance_night_change.to_string(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryComparisonDto {
    available_range: Option<RecoveryDateRangeDto>,
    baseline_range: Option<RecoveryDateRangeDto>,
    comparison_range: Option<RecoveryDateRangeDto>,
    series: Vec<RecoverySeriesComparisonDto>,
}

impl From<RecoveryComparison> for RecoveryComparisonDto {
    fn from(comparison: RecoveryComparison) -> Self {
        Self {
            available_range: comparison.available_range.map(Into::into),
            baseline_range: comparison.baseline_range.map(Into::into),
            comparison_range: comparison.comparison_range.map(Into::into),
            series: comparison.series.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryNightDetailDto {
    recovery_date: String,
    beat_to_beat_interval_milliseconds: String,
    heart_rate_variability_rmssd_milliseconds: Option<String>,
    breathing_interval_milliseconds: String,
    source_assessment: Option<SourceSpecificRecoveryAssessmentDto>,
    source_baseline: Option<SourceSpecificRecoveryBaselineDto>,
    source_guidance: Option<SourceSpecificRecoveryGuidanceDto>,
}

impl From<RecoveryNightDetail> for RecoveryNightDetailDto {
    fn from(recovery: RecoveryNightDetail) -> Self {
        Self {
            recovery_date: recovery.recovery_date,
            beat_to_beat_interval_milliseconds: recovery
                .beat_to_beat_interval_milliseconds
                .to_string(),
            heart_rate_variability_rmssd_milliseconds: recovery
                .heart_rate_variability_rmssd_milliseconds
                .map(|value| value.to_string()),
            breathing_interval_milliseconds: recovery.breathing_interval_milliseconds.to_string(),
            source_assessment: recovery.source_assessment.map(Into::into),
            source_baseline: recovery.source_baseline.map(Into::into),
            source_guidance: recovery.source_guidance.map(Into::into),
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LongitudinalDateRangeDto {
    from: String,
    through: String,
}

impl From<LongitudinalDateRangeDto> for LongitudinalDateRange {
    fn from(range: LongitudinalDateRangeDto) -> Self {
        Self {
            from: range.from,
            through: range.through,
        }
    }
}

impl From<LongitudinalDateRange> for LongitudinalDateRangeDto {
    fn from(range: LongitudinalDateRange) -> Self {
        Self {
            from: range.from,
            through: range.through,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LongitudinalActivityDayDto {
    availability: &'static str,
    step_count: Option<String>,
}

impl From<LongitudinalActivityDay> for LongitudinalActivityDayDto {
    fn from(day: LongitudinalActivityDay) -> Self {
        Self {
            availability: match day.availability {
                ActivityDayAvailability::Available => "available",
                ActivityDayAvailability::Unavailable => "unavailable",
                ActivityDayAvailability::Missing => "missing",
            },
            step_count: day.step_count.map(|value| value.to_string()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LongitudinalTrainingDayDto {
    session_count: usize,
    total_duration_milliseconds: String,
}

impl From<LongitudinalTrainingDay> for LongitudinalTrainingDayDto {
    fn from(day: LongitudinalTrainingDay) -> Self {
        Self {
            session_count: day.session_count,
            total_duration_milliseconds: day.total_duration_milliseconds.to_string(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LongitudinalSleepDayDto {
    availability: &'static str,
    asleep_milliseconds: Option<String>,
}

impl From<LongitudinalSleepDay> for LongitudinalSleepDayDto {
    fn from(day: LongitudinalSleepDay) -> Self {
        Self {
            availability: match day.availability {
                SleepDayAvailability::Available => "available",
                SleepDayAvailability::Missing => "missing",
            },
            asleep_milliseconds: day.asleep_milliseconds.map(|value| value.to_string()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LongitudinalRecoveryDayDto {
    availability: &'static str,
    beat_to_beat_interval_milliseconds: Option<String>,
    heart_rate_variability_rmssd_milliseconds: Option<String>,
    breathing_interval_milliseconds: Option<String>,
}

impl From<LongitudinalRecoveryDay> for LongitudinalRecoveryDayDto {
    fn from(day: LongitudinalRecoveryDay) -> Self {
        Self {
            availability: match day.availability {
                RecoveryDayAvailability::Available => "available",
                RecoveryDayAvailability::Missing => "missing",
            },
            beat_to_beat_interval_milliseconds: day
                .beat_to_beat_interval_milliseconds
                .map(|value| value.to_string()),
            heart_rate_variability_rmssd_milliseconds: day
                .heart_rate_variability_rmssd_milliseconds
                .map(|value| value.to_string()),
            breathing_interval_milliseconds: day
                .breathing_interval_milliseconds
                .map(|value| value.to_string()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LongitudinalDayInsightDto {
    local_date: String,
    activity: LongitudinalActivityDayDto,
    training: LongitudinalTrainingDayDto,
    sleep: LongitudinalSleepDayDto,
    recovery: LongitudinalRecoveryDayDto,
}

impl From<LongitudinalDayInsight> for LongitudinalDayInsightDto {
    fn from(day: LongitudinalDayInsight) -> Self {
        Self {
            local_date: day.local_date,
            activity: day.activity.into(),
            training: day.training.into(),
            sleep: day.sleep.into(),
            recovery: day.recovery.into(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LongitudinalSeriesOverviewDto {
    series_ref: String,
    activity: ActivitySeriesSummaryDto,
    training: TrainingSeriesSummaryDto,
    sleep: SleepSeriesSummaryDto,
    recovery: RecoverySeriesSummaryDto,
    days: Vec<LongitudinalDayInsightDto>,
}

impl From<LongitudinalSeriesOverview> for LongitudinalSeriesOverviewDto {
    fn from(series: LongitudinalSeriesOverview) -> Self {
        Self {
            series_ref: series.series_ref,
            activity: series.activity.into(),
            training: series.training.into(),
            sleep: series.sleep.into(),
            recovery: series.recovery.into(),
            days: series.days.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LongitudinalOverviewDto {
    available_range: Option<LongitudinalDateRangeDto>,
    selected_range: Option<LongitudinalDateRangeDto>,
    series: Vec<LongitudinalSeriesOverviewDto>,
}

impl From<LongitudinalOverview> for LongitudinalOverviewDto {
    fn from(overview: LongitudinalOverview) -> Self {
        Self {
            available_range: overview.available_range.map(Into::into),
            selected_range: overview.selected_range.map(Into::into),
            series: overview.series.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LongitudinalActivityComparisonDto {
    baseline: ActivitySeriesSummaryDto,
    comparison: ActivitySeriesSummaryDto,
    total_step_change: Option<String>,
    average_step_change: Option<String>,
}

impl From<LongitudinalActivityComparison> for LongitudinalActivityComparisonDto {
    fn from(comparison: LongitudinalActivityComparison) -> Self {
        Self {
            baseline: comparison.baseline.into(),
            comparison: comparison.comparison.into(),
            total_step_change: comparison.total_step_change.map(|value| value.to_string()),
            average_step_change: comparison
                .average_step_change
                .map(|value| value.to_string()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LongitudinalTrainingComparisonDto {
    baseline: TrainingSeriesSummaryDto,
    comparison: TrainingSeriesSummaryDto,
    session_count_change: String,
    training_day_change: String,
    duration_milliseconds_change: String,
    distance_meters_change: Option<f64>,
    energy_kilocalories_change: Option<String>,
}

impl From<LongitudinalTrainingComparison> for LongitudinalTrainingComparisonDto {
    fn from(comparison: LongitudinalTrainingComparison) -> Self {
        Self {
            baseline: comparison.baseline.into(),
            comparison: comparison.comparison.into(),
            session_count_change: comparison.session_count_change.to_string(),
            training_day_change: comparison.training_day_change.to_string(),
            duration_milliseconds_change: comparison.duration_milliseconds_change.to_string(),
            distance_meters_change: comparison.distance_meters_change,
            energy_kilocalories_change: comparison
                .energy_kilocalories_change
                .map(|value| value.to_string()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LongitudinalSleepComparisonDto {
    baseline: SleepSeriesSummaryDto,
    comparison: SleepSeriesSummaryDto,
    observed_night_change: String,
    missing_night_change: String,
    average_asleep_milliseconds_change: Option<String>,
    average_interruption_milliseconds_change: Option<String>,
    average_efficiency_percentage_point_change: Option<f64>,
    average_overall_score_change: Option<f64>,
    goal_met_percentage_point_change: Option<f64>,
}

impl From<LongitudinalSleepComparison> for LongitudinalSleepComparisonDto {
    fn from(comparison: LongitudinalSleepComparison) -> Self {
        Self {
            baseline: comparison.baseline.into(),
            comparison: comparison.comparison.into(),
            observed_night_change: comparison.observed_night_change.to_string(),
            missing_night_change: comparison.missing_night_change.to_string(),
            average_asleep_milliseconds_change: comparison
                .average_asleep_milliseconds_change
                .map(|value| value.to_string()),
            average_interruption_milliseconds_change: comparison
                .average_interruption_milliseconds_change
                .map(|value| value.to_string()),
            average_efficiency_percentage_point_change: comparison
                .average_efficiency_percentage_point_change,
            average_overall_score_change: comparison.average_overall_score_change,
            goal_met_percentage_point_change: comparison.goal_met_percentage_point_change,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LongitudinalRecoveryComparisonDto {
    baseline: RecoverySeriesSummaryDto,
    comparison: RecoverySeriesSummaryDto,
    observed_night_change: String,
    missing_night_change: String,
    average_beat_to_beat_interval_milliseconds_change: Option<String>,
    average_heart_rate_variability_rmssd_milliseconds_change: Option<String>,
    average_breathing_interval_milliseconds_change: Option<String>,
    assessment_night_change: String,
    baseline_night_change: String,
    guidance_night_change: String,
}

impl From<LongitudinalRecoveryComparison> for LongitudinalRecoveryComparisonDto {
    fn from(comparison: LongitudinalRecoveryComparison) -> Self {
        Self {
            baseline: comparison.baseline.into(),
            comparison: comparison.comparison.into(),
            observed_night_change: comparison.observed_night_change.to_string(),
            missing_night_change: comparison.missing_night_change.to_string(),
            average_beat_to_beat_interval_milliseconds_change: comparison
                .average_beat_to_beat_interval_milliseconds_change
                .map(|value| value.to_string()),
            average_heart_rate_variability_rmssd_milliseconds_change: comparison
                .average_heart_rate_variability_rmssd_milliseconds_change
                .map(|value| value.to_string()),
            average_breathing_interval_milliseconds_change: comparison
                .average_breathing_interval_milliseconds_change
                .map(|value| value.to_string()),
            assessment_night_change: comparison.assessment_night_change.to_string(),
            baseline_night_change: comparison.baseline_night_change.to_string(),
            guidance_night_change: comparison.guidance_night_change.to_string(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LongitudinalSeriesComparisonDto {
    series_ref: String,
    activity: LongitudinalActivityComparisonDto,
    training: LongitudinalTrainingComparisonDto,
    sleep: LongitudinalSleepComparisonDto,
    recovery: LongitudinalRecoveryComparisonDto,
}

impl From<LongitudinalSeriesComparison> for LongitudinalSeriesComparisonDto {
    fn from(series: LongitudinalSeriesComparison) -> Self {
        Self {
            series_ref: series.series_ref,
            activity: series.activity.into(),
            training: series.training.into(),
            sleep: series.sleep.into(),
            recovery: series.recovery.into(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LongitudinalComparisonDto {
    available_range: Option<LongitudinalDateRangeDto>,
    baseline_range: Option<LongitudinalDateRangeDto>,
    comparison_range: Option<LongitudinalDateRangeDto>,
    series: Vec<LongitudinalSeriesComparisonDto>,
}

impl From<LongitudinalComparison> for LongitudinalComparisonDto {
    fn from(comparison: LongitudinalComparison) -> Self {
        Self {
            available_range: comparison.available_range.map(Into::into),
            baseline_range: comparison.baseline_range.map(Into::into),
            comparison_range: comparison.comparison_range.map(Into::into),
            series: comparison.series.into_iter().map(Into::into).collect(),
        }
    }
}

impl From<ActivityComparison> for ActivityComparisonDto {
    fn from(comparison: ActivityComparison) -> Self {
        Self {
            available_range: comparison.available_range.map(Into::into),
            baseline_range: comparison.baseline_range.map(Into::into),
            comparison_range: comparison.comparison_range.map(Into::into),
            series: comparison.series.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportReportDto {
    exact_repeat: bool,
    recognized_artifacts: usize,
    new_observations: usize,
    equivalent_observations: usize,
    enriched_observations: usize,
    amended_observations: usize,
    preserved_observations: usize,
    conflicts: usize,
}

impl From<ImportReport> for ImportReportDto {
    fn from(report: ImportReport) -> Self {
        Self {
            exact_repeat: report.exact_repeat,
            recognized_artifacts: report.recognized_artifacts,
            new_observations: report.new_observations,
            equivalent_observations: report.equivalent_observations,
            enriched_observations: report.enriched_observations,
            amended_observations: report.amended_observations,
            preserved_observations: report.preserved_observations,
            conflicts: report.conflicts,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactCoverageSummaryDto {
    total: usize,
    supported: usize,
    unsupported: usize,
    deliberately_ignored: usize,
    unrecognized: usize,
    invalid: usize,
}

impl From<ArtifactCoverageSummary> for ArtifactCoverageSummaryDto {
    fn from(coverage: ArtifactCoverageSummary) -> Self {
        Self {
            total: coverage.total,
            supported: coverage.supported,
            unsupported: coverage.unsupported,
            deliberately_ignored: coverage.deliberately_ignored,
            unrecognized: coverage.unrecognized,
            invalid: coverage.invalid,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactFamilyCoverageDto {
    family_code: Option<String>,
    classification: String,
    reason_code: String,
    artifact_count: usize,
}

impl From<ArtifactFamilyCoverage> for ArtifactFamilyCoverageDto {
    fn from(coverage: ArtifactFamilyCoverage) -> Self {
        Self {
            family_code: coverage.family_code,
            classification: coverage.classification.code().to_owned(),
            reason_code: coverage.reason_code,
            artifact_count: coverage.artifact_count,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportOutcomeDto {
    operation_ref: String,
    state: String,
    source_provider: String,
    source_adapter_version: String,
    mapping_version: String,
    exact_repeat: bool,
    coverage_complete: bool,
    coverage: ArtifactCoverageSummaryDto,
    artifact_families: Vec<ArtifactFamilyCoverageDto>,
    report: ImportReportDto,
    canonical_history_changed: bool,
    terminal_code: Option<String>,
    recovery_note: Option<String>,
}

impl From<ImportOutcome> for ImportOutcomeDto {
    fn from(outcome: ImportOutcome) -> Self {
        Self {
            operation_ref: outcome.operation_ref,
            state: outcome.state.code().to_owned(),
            source_provider: outcome.source_provider,
            source_adapter_version: outcome.source_adapter_version,
            mapping_version: outcome.mapping_version,
            exact_repeat: outcome.exact_repeat,
            coverage_complete: outcome.coverage_complete,
            coverage: outcome.coverage.into(),
            artifact_families: outcome
                .artifact_families
                .into_iter()
                .map(ArtifactFamilyCoverageDto::from)
                .collect(),
            report: outcome.report.into(),
            canonical_history_changed: outcome.canonical_history_changed,
            terminal_code: outcome.terminal_code,
            recovery_note: outcome.recovery_note,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProgressDto {
    phase: ImportPhaseDto,
    completed_artifacts: usize,
    total_artifacts: Option<usize>,
    completed_bytes: u64,
    total_bytes: Option<u64>,
    cancellable: bool,
}

impl From<ImportProgress> for ImportProgressDto {
    fn from(progress: ImportProgress) -> Self {
        Self {
            phase: progress.phase.into(),
            completed_artifacts: progress.completed_artifacts,
            total_artifacts: progress.total_artifacts,
            completed_bytes: progress.completed_bytes,
            total_bytes: progress.total_bytes,
            cancellable: progress.cancellable,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
enum ImportPhaseDto {
    Fingerprinting,
    Validating,
    Importing,
    Committing,
    Completed,
    Cancelled,
}

impl From<ImportPhase> for ImportPhaseDto {
    fn from(phase: ImportPhase) -> Self {
        match phase {
            ImportPhase::Fingerprinting => Self::Fingerprinting,
            ImportPhase::Validating => Self::Validating,
            ImportPhase::Importing => Self::Importing,
            ImportPhase::Committing => Self::Committing,
            ImportPhase::Completed => Self::Completed,
            ImportPhase::Cancelled => Self::Cancelled,
        }
    }
}

#[cfg(test)]
mod tests {
    use fitfreed_application::{
        ExpectedSourceArchive, LocalePreference, OfficialSourceLink, OfficialSourceLinkPurpose,
        SourceAcquisitionGuide, UpdateArtifact, UpdateInstallationAuthorization,
        UpdateRecoveryOutcome, UpdateRecoveryOutcomeKind,
    };
    use fitfreed_domain::{
        ArtifactClassification, ArtifactFamilyCoverage, ImportOperationState, ReportBlock,
    };
    use serde_json::{from_value, json, to_value};

    use super::*;

    #[test]
    fn validates_and_serializes_the_application_preferences_transport_contract() {
        let input: ApplicationPreferencesInputDto = serde_json::from_value(serde_json::json!({
            "locale": "es-ES",
            "appearance": "dark",
            "contentZoomPercent": 175
        }))
        .expect("preference input");
        let preferences = ApplicationPreferences::try_from(input).expect("valid preferences");
        let load = ApplicationPreferencesLoadDto::from(ApplicationPreferencesLoad {
            preferences,
            status: PreferencesLoadStatus::Recovered,
        });

        assert_eq!(
            serde_json::to_value(load).expect("preference output"),
            serde_json::json!({
                "preferences": {
                    "version": 1,
                    "locale": "es-ES",
                    "appearance": "dark",
                    "contentZoomPercent": 175
                },
                "status": "recovered"
            })
        );
    }

    #[test]
    fn serializes_the_source_acquisition_guide_contract_without_rendered_copy() {
        let guide = SourceAcquisitionGuide {
            schema_version: 1,
            source_id: "synthetic-source".to_owned(),
            guide_version: "synthetic-source-acquisition@1".to_owned(),
            verified_on: "2026-01-15".to_owned(),
            expected_archive: ExpectedSourceArchive::Zip,
            instruction_keys: vec!["request-export".to_owned()],
            constraint_keys: vec!["delivery-time-varies".to_owned()],
            troubleshooting_keys: vec!["email-not-received".to_owned()],
            official_links: vec![
                OfficialSourceLink {
                    purpose: OfficialSourceLinkPurpose::Account,
                    locale: None,
                    url: "https://account.example.test/".to_owned(),
                },
                OfficialSourceLink {
                    purpose: OfficialSourceLinkPurpose::Instructions,
                    locale: Some(LocalePreference::EsEs),
                    url: "https://support.example.test/es/export".to_owned(),
                },
            ],
        };

        assert_eq!(
            serde_json::to_value(SourceAcquisitionGuideDto::from(guide))
                .expect("source acquisition guide output"),
            serde_json::json!({
                "schemaVersion": 1,
                "sourceId": "synthetic-source",
                "guideVersion": "synthetic-source-acquisition@1",
                "verifiedOn": "2026-01-15",
                "expectedArchive": "zip",
                "instructionKeys": ["request-export"],
                "constraintKeys": ["delivery-time-varies"],
                "troubleshootingKeys": ["email-not-received"],
                "officialLinks": [
                    {
                        "purpose": "account",
                        "locale": null,
                        "url": "https://account.example.test/"
                    },
                    {
                        "purpose": "instructions",
                        "locale": "es-ES",
                        "url": "https://support.example.test/es/export"
                    }
                ]
            })
        );
    }

    #[test]
    fn validates_and_serializes_the_owned_official_destination_contract() {
        let request: OpenOfficialSourceLinkRequestDto = serde_json::from_value(serde_json::json!({
            "sourceId": "synthetic-source",
            "purpose": "instructions",
            "locale": "es-ES"
        }))
        .expect("official destination request");
        let request = OpenOfficialSourceLinkRequest::try_from(request)
            .expect("valid official destination request");
        assert_eq!(request.source_id, "synthetic-source");
        assert_eq!(request.purpose, OfficialSourceLinkPurpose::Instructions);
        assert_eq!(request.locale, LocalePreference::EsEs);

        assert_eq!(
            serde_json::to_value(OpenOfficialSourceLinkOutcomeDto::from(
                OpenOfficialSourceLinkOutcome {
                    source_id: request.source_id,
                    purpose: request.purpose,
                    url: "https://support.example.test/es/export".to_owned(),
                }
            ))
            .expect("official destination outcome"),
            serde_json::json!({
                "sourceId": "synthetic-source",
                "purpose": "instructions",
                "url": "https://support.example.test/es/export"
            })
        );

        for invalid in [
            serde_json::json!({
                "sourceId": "synthetic-source",
                "purpose": "unknown",
                "locale": "en-US"
            }),
            serde_json::json!({
                "sourceId": "synthetic-source",
                "purpose": "account",
                "locale": "fr-FR"
            }),
            serde_json::json!({
                "sourceId": "",
                "purpose": "account",
                "locale": "en-US"
            }),
            serde_json::json!({
                "sourceId": "Synthetic Source",
                "purpose": "account",
                "locale": "en-US"
            }),
        ] {
            let request: OpenOfficialSourceLinkRequestDto =
                serde_json::from_value(invalid).expect("syntactically valid request");
            let error = OpenOfficialSourceLinkRequest::try_from(request)
                .expect_err("invalid official destination request");
            assert_eq!(
                serde_json::to_value(error).expect("command error"),
                serde_json::json!({ "code": "invalid-official-source-link-request" })
            );
        }
    }

    #[test]
    fn maps_each_official_destination_failure_to_a_stable_public_code() {
        for (error, code) in [
            (
                ApplicationError::OfficialSourceLinkUnavailable,
                "official-source-link-unavailable",
            ),
            (
                ApplicationError::OfficialSourceLinkOpen(
                    OfficialSourceLinkOpenError::UnsupportedPlatform,
                ),
                "official-source-link-unsupported",
            ),
            (
                ApplicationError::OfficialSourceLinkOpen(
                    OfficialSourceLinkOpenError::PermissionDenied,
                ),
                "official-source-link-permission-denied",
            ),
            (
                ApplicationError::OfficialSourceLinkOpen(
                    OfficialSourceLinkOpenError::LauncherUnavailable,
                ),
                "official-source-link-launcher-unavailable",
            ),
            (
                ApplicationError::OfficialSourceLinkOpen(
                    OfficialSourceLinkOpenError::OperatingSystem,
                ),
                "official-source-link-os-failed",
            ),
            (
                ApplicationError::OfficialSourceLinkOpen(OfficialSourceLinkOpenError::Delegation),
                "official-source-link-delegation-failed",
            ),
        ] {
            assert_eq!(
                serde_json::to_value(CommandErrorDto::from(error)).expect("command error"),
                serde_json::json!({ "code": code })
            );
        }
    }

    #[test]
    fn rejects_unsupported_application_preferences_at_the_transport_boundary() {
        for input in [
            serde_json::json!({
                "locale": "fr-FR",
                "appearance": "system",
                "contentZoomPercent": 100
            }),
            serde_json::json!({
                "locale": "en-US",
                "appearance": "sepia",
                "contentZoomPercent": 100
            }),
            serde_json::json!({
                "locale": "en-US",
                "appearance": "light",
                "contentZoomPercent": 99
            }),
        ] {
            let input: ApplicationPreferencesInputDto =
                serde_json::from_value(input).expect("preference input shape");
            assert!(ApplicationPreferences::try_from(input).is_err());
        }
    }

    #[test]
    fn serializes_update_outcomes_and_errors_as_stable_codes() {
        let outcome = UpdateCheckOutcome {
            installed_version: "0.1.0".to_owned(),
            checked_at: "2026-08-16T12:00:00Z".to_owned(),
            status: UpdateCheckStatus::WithdrawnInstalled,
            release: Some(UpdateReleaseSummary {
                version: "0.2.0".to_owned(),
                published_at: "2026-08-16T10:00:00Z".to_owned(),
                release_notes: "A safer release.".to_owned(),
                minimum_supported_version: "0.1.0".to_owned(),
                target_library_schema_version: 9,
            }),
            installed_withdrawal: Some(UpdateWithdrawalSummary {
                version: "0.1.0".to_owned(),
                reason: UpdateWithdrawalReason::DataIntegrity,
                guidance: "Install the replacement before importing.".to_owned(),
                replacement_version: Some("0.2.0".to_owned()),
            }),
            update_action_available: true,
            postponed_until: None,
            manual_recovery_reason: None,
            trust_failure: Some(UpdateTrustFailure::MirrorMismatch),
            installation_authorization: Some(UpdateInstallationAuthorization {
                version: "0.2.0".to_owned(),
                trusted_sequence: 17,
                trusted_payload_sha256:
                    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".to_owned(),
                signing_key_id: "synthetic-test-key".to_owned(),
                target_library_schema_version: 9,
                artifact: UpdateArtifact {
                    target: "darwin-aarch64".to_owned(),
                    package_url: "https://updates.invalid/fitfreed-0.2.0-aarch64.app.tar.gz"
                        .to_owned(),
                    expected_size_bytes: 26,
                    expected_sha256:
                        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
                            .to_owned(),
                    package_signature: "synthetic-package-signature".to_owned(),
                },
            }),
        };

        let json = serde_json::to_value(UpdateCheckOutcomeDto::from(outcome))
            .expect("update outcome JSON");

        assert_eq!(json["status"], "withdrawn-installed");
        assert_eq!(json["release"]["version"], "0.2.0");
        assert_eq!(json["installedWithdrawal"]["reason"], "data-integrity");
        assert_eq!(json["trustFailure"], "mirror-mismatch");
        assert!(json.get("installationAuthorization").is_none());
        let serialized = serde_json::to_string(&json).expect("serialized update outcome JSON");
        assert!(!serialized.contains("synthetic-test-key"));
        assert!(!serialized.contains("updates.invalid"));
        assert!(!serialized.contains("synthetic-package-signature"));
        for (error, expected) in [
            (UpdateError::Channel, "update-channel-failed"),
            (UpdateError::State, "update-state-unavailable"),
            (UpdateError::CandidateChanged, "update-candidate-changed"),
            (UpdateError::InvalidPreference, "invalid-update-preference"),
            (
                UpdateError::InstallationNotAllowed,
                "update-installation-not-allowed",
            ),
        ] {
            let error_json =
                serde_json::to_value(CommandErrorDto::from(error)).expect("update error JSON");
            assert_eq!(error_json["code"], expected);
        }

        let recovery = UpdateRecoveryOutcome {
            recovery_id: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
                .to_owned(),
            kind: UpdateRecoveryOutcomeKind::Recovered,
            source_version: "0.1.0".to_owned(),
            target_version: "0.2.0".to_owned(),
        };
        let recovery_json = serde_json::to_value(UpdateRecoveryOutcomeDto::from(recovery))
            .expect("update recovery outcome JSON");
        assert_eq!(
            recovery_json,
            serde_json::json!({
                "outcome": "recovered",
                "sourceVersion": "0.1.0",
                "targetVersion": "0.2.0"
            })
        );
        assert!(!recovery_json.to_string().contains("0123456789abcdef"));
    }

    fn recovery_summary(value: i128) -> RecoverySeriesSummary {
        RecoverySeriesSummary {
            calendar_days: 2,
            observed_nights: 1,
            missing_nights: 1,
            average_beat_to_beat_interval_milliseconds: Some(value),
            rmssd_night_count: 1,
            average_heart_rate_variability_rmssd_milliseconds: Some(value),
            average_breathing_interval_milliseconds: Some(value),
            assessment_night_count: 1,
            baseline_night_count: 1,
            guidance_night_count: 1,
        }
    }

    fn activity_summary(value: i128) -> ActivitySeriesSummary {
        ActivitySeriesSummary {
            calendar_days: 2,
            observed_days: 1,
            available_step_days: 1,
            unavailable_step_days: 0,
            missing_days: 1,
            total_step_count: Some(value),
            average_step_count: Some(value),
        }
    }

    fn training_summary(value: i128) -> TrainingSeriesSummary {
        TrainingSeriesSummary {
            calendar_days: 2,
            training_days: 1,
            session_count: 1,
            total_duration_milliseconds: value,
            distance_session_count: 1,
            total_distance_meters: Some(1_000.5),
            energy_session_count: 1,
            total_energy_kilocalories: Some(value),
            heart_rate_session_count: 1,
        }
    }

    fn sleep_summary(value: i128) -> SleepSeriesSummary {
        SleepSeriesSummary {
            calendar_days: 2,
            observed_nights: 1,
            missing_nights: 1,
            total_asleep_milliseconds: Some(value),
            average_asleep_milliseconds: Some(value),
            total_interruption_milliseconds: Some(value),
            average_interruption_milliseconds: Some(value),
            average_efficiency_percent: Some(90.0),
            phase_night_count: 0,
            phase_totals: None,
            stage_timeline_night_count: 0,
            score_night_count: 0,
            average_overall_score: None,
            goal_night_count: 0,
            goal_met_night_count: 0,
            power_status_night_count: 0,
            power_loss_night_count: 0,
        }
    }

    #[test]
    fn serializes_longitudinal_days_and_changes_without_losing_exact_values() {
        let large = 9_223_372_036_854_775_808_i128;
        let range = Some(LongitudinalDateRange {
            from: "2026-01-01".to_owned(),
            through: "2026-01-02".to_owned(),
        });
        let overview = LongitudinalOverview {
            available_range: range.clone(),
            selected_range: range.clone(),
            series: vec![LongitudinalSeriesOverview {
                series_ref: "synthetic-origin".to_owned(),
                activity: activity_summary(large),
                training: training_summary(large),
                sleep: sleep_summary(large),
                recovery: recovery_summary(large),
                days: vec![LongitudinalDayInsight {
                    local_date: "2026-01-01".to_owned(),
                    activity: LongitudinalActivityDay {
                        availability: ActivityDayAvailability::Available,
                        step_count: Some(i64::MAX),
                    },
                    training: LongitudinalTrainingDay {
                        session_count: 2,
                        total_duration_milliseconds: large,
                    },
                    sleep: LongitudinalSleepDay {
                        availability: SleepDayAvailability::Available,
                        asleep_milliseconds: Some(i64::MAX),
                    },
                    recovery: LongitudinalRecoveryDay {
                        availability: RecoveryDayAvailability::Available,
                        beat_to_beat_interval_milliseconds: Some(i64::MAX),
                        heart_rate_variability_rmssd_milliseconds: None,
                        breathing_interval_milliseconds: Some(4_000),
                    },
                }],
            }],
        };
        let comparison = LongitudinalComparison {
            available_range: range.clone(),
            baseline_range: range.clone(),
            comparison_range: range,
            series: vec![LongitudinalSeriesComparison {
                series_ref: "synthetic-origin".to_owned(),
                activity: LongitudinalActivityComparison {
                    baseline: activity_summary(large),
                    comparison: activity_summary(large),
                    total_step_change: Some(-large),
                    average_step_change: None,
                },
                training: LongitudinalTrainingComparison {
                    baseline: training_summary(large),
                    comparison: training_summary(large),
                    session_count_change: large,
                    training_day_change: -large,
                    duration_milliseconds_change: large,
                    distance_meters_change: Some(5.5),
                    energy_kilocalories_change: None,
                },
                sleep: LongitudinalSleepComparison {
                    baseline: sleep_summary(large),
                    comparison: sleep_summary(large),
                    observed_night_change: large,
                    missing_night_change: -large,
                    average_asleep_milliseconds_change: Some(large),
                    average_interruption_milliseconds_change: None,
                    average_efficiency_percentage_point_change: Some(2.5),
                    average_overall_score_change: None,
                    goal_met_percentage_point_change: None,
                },
                recovery: LongitudinalRecoveryComparison {
                    baseline: recovery_summary(large),
                    comparison: recovery_summary(large),
                    observed_night_change: large,
                    missing_night_change: -large,
                    average_beat_to_beat_interval_milliseconds_change: Some(large),
                    average_heart_rate_variability_rmssd_milliseconds_change: None,
                    average_breathing_interval_milliseconds_change: Some(-large),
                    assessment_night_change: 1,
                    baseline_night_change: 0,
                    guidance_night_change: -1,
                },
            }],
        };

        let overview_json = serde_json::to_value(LongitudinalOverviewDto::from(overview))
            .expect("longitudinal overview JSON");
        let comparison_json = serde_json::to_value(LongitudinalComparisonDto::from(comparison))
            .expect("longitudinal comparison JSON");

        assert_eq!(
            overview_json["series"][0]["activity"]["totalStepCount"],
            "9223372036854775808"
        );
        assert_eq!(
            overview_json["series"][0]["days"][0]["training"]["totalDurationMilliseconds"],
            "9223372036854775808"
        );
        assert_eq!(
            overview_json["series"][0]["days"][0]["recovery"]
                ["heartRateVariabilityRmssdMilliseconds"],
            serde_json::Value::Null
        );
        assert_eq!(
            comparison_json["series"][0]["activity"]["totalStepChange"],
            "-9223372036854775808"
        );
        assert_eq!(
            comparison_json["series"][0]["sleep"]["observedNightChange"],
            "9223372036854775808"
        );
        assert_eq!(
            serde_json::to_value(CommandErrorDto::from(
                ApplicationError::InvalidLongitudinalRange("synthetic")
            ))
            .expect("longitudinal range error")["code"],
            "invalid-longitudinal-range"
        );
    }

    #[test]
    fn serializes_recovery_changes_and_measurements_as_exact_decimal_text() {
        let comparison = RecoveryComparison {
            available_range: Some(RecoveryDateRange {
                from: "2026-01-01".to_owned(),
                through: "2026-01-04".to_owned(),
            }),
            baseline_range: Some(RecoveryDateRange {
                from: "2026-01-01".to_owned(),
                through: "2026-01-02".to_owned(),
            }),
            comparison_range: Some(RecoveryDateRange {
                from: "2026-01-03".to_owned(),
                through: "2026-01-04".to_owned(),
            }),
            series: vec![RecoverySeriesComparison {
                series_ref: "synthetic-origin".to_owned(),
                baseline: recovery_summary(9_223_372_036_854_775_807),
                comparison: recovery_summary(9_223_372_036_854_775_808),
                observed_night_change: 9_223_372_036_854_775_808,
                missing_night_change: -9_223_372_036_854_775_808,
                average_beat_to_beat_interval_milliseconds_change: Some(9_223_372_036_854_775_808),
                average_heart_rate_variability_rmssd_milliseconds_change: None,
                average_breathing_interval_milliseconds_change: Some(-9_223_372_036_854_775_808),
                assessment_night_change: 1,
                baseline_night_change: -1,
                guidance_night_change: 0,
            }],
        };

        let json = serde_json::to_value(RecoveryComparisonDto::from(comparison))
            .expect("recovery comparison JSON");

        assert_eq!(
            json["series"][0]["comparison"]["averageBeatToBeatIntervalMilliseconds"],
            "9223372036854775808"
        );
        assert_eq!(
            json["series"][0]["observedNightChange"],
            "9223372036854775808"
        );
        assert_eq!(
            json["series"][0]["missingNightChange"],
            "-9223372036854775808"
        );
        assert_eq!(
            json["series"][0]["averageHeartRateVariabilityRmssdMillisecondsChange"],
            serde_json::Value::Null
        );
    }

    #[test]
    fn serializes_complete_recovery_detail_without_reinterpreting_source_values() {
        let detail = RecoveryNightDetail {
            recovery_date: "2026-01-02".to_owned(),
            beat_to_beat_interval_milliseconds: i64::MAX,
            heart_rate_variability_rmssd_milliseconds: Some(42),
            breathing_interval_milliseconds: 4_100,
            source_assessment: Some(SourceSpecificRecoveryAssessment {
                scheme: "synthetic-assessment@1".to_owned(),
                autonomic_charge: 1.5,
                autonomic_status: 4,
                overall_status: 5,
                overall_sublevel: i64::MAX,
            }),
            source_baseline: Some(SourceSpecificRecoveryBaseline {
                scheme: "synthetic-baseline@1".to_owned(),
                mean_beat_to_beat_interval_milliseconds: 910,
                standard_deviation_beat_to_beat_interval_milliseconds: 30,
                mean_heart_rate_variability_rmssd_milliseconds: Some(40),
                standard_deviation_heart_rate_variability_rmssd_milliseconds: Some(8),
                mean_breathing_interval_milliseconds: 4_200,
                standard_deviation_breathing_interval_milliseconds: 120,
            }),
            source_guidance: Some(SourceSpecificRecoveryGuidance {
                scheme: "synthetic-guidance@1".to_owned(),
                exercise: "Synthetic exercise guidance.".to_owned(),
                sleep: "Synthetic sleep guidance.".to_owned(),
                vitality: "Synthetic vitality guidance.".to_owned(),
            }),
        };

        let json = serde_json::to_value(RecoveryNightDetailDto::from(detail))
            .expect("recovery detail JSON");

        assert_eq!(
            json["beatToBeatIntervalMilliseconds"],
            "9223372036854775807"
        );
        assert_eq!(
            json["sourceAssessment"]["overallSublevel"],
            "9223372036854775807"
        );
        assert_eq!(
            json["sourceBaseline"]["meanHeartRateVariabilityRmssdMilliseconds"],
            "40"
        );
        assert_eq!(
            json["sourceGuidance"]["exercise"],
            "Synthetic exercise guidance."
        );
    }

    #[test]
    fn deserializes_an_activity_range_without_interpreting_local_dates_in_transport() {
        let dto: ActivityDateRangeDto = serde_json::from_value(serde_json::json!({
            "from": "2025-12-30",
            "through": "2026-01-02"
        }))
        .expect("activity range DTO");

        assert_eq!(
            ActivityDateRange::from(dto),
            ActivityDateRange {
                from: "2025-12-30".to_owned(),
                through: "2026-01-02".to_owned(),
            }
        );
    }

    #[test]
    fn serializes_activity_comparison_changes_as_exact_signed_decimal_text() {
        let summary = ActivitySeriesSummary {
            calendar_days: 2,
            observed_days: 2,
            available_step_days: 2,
            unavailable_step_days: 0,
            missing_days: 0,
            total_step_count: Some(18_446_744_073_709_551_614),
            average_step_count: Some(9_223_372_036_854_775_807),
        };
        let comparison = ActivityComparison {
            available_range: Some(ActivityDateRange {
                from: "2026-01-01".to_owned(),
                through: "2026-01-05".to_owned(),
            }),
            baseline_range: Some(ActivityDateRange {
                from: "2026-01-01".to_owned(),
                through: "2026-01-02".to_owned(),
            }),
            comparison_range: Some(ActivityDateRange {
                from: "2026-01-04".to_owned(),
                through: "2026-01-05".to_owned(),
            }),
            series: vec![ActivitySeriesComparison {
                series_ref: "synthetic-origin".to_owned(),
                baseline: summary.clone(),
                comparison: summary,
                total_step_change: Some(9_223_372_036_854_775_808),
                average_step_change: Some(-9_223_372_036_854_775_808),
            }],
        };

        let json = serde_json::to_value(ActivityComparisonDto::from(comparison))
            .expect("activity comparison JSON");

        assert_eq!(json["series"][0]["totalStepChange"], "9223372036854775808");
        assert_eq!(
            json["series"][0]["averageStepChange"],
            "-9223372036854775808"
        );
    }

    #[test]
    fn serializes_activity_insights_with_exact_decimal_counts_and_stable_availability() {
        let overview = ActivityOverview {
            available_range: Some(ActivityDateRange {
                from: "2026-01-01".to_owned(),
                through: "2026-01-03".to_owned(),
            }),
            selected_range: Some(ActivityDateRange {
                from: "2026-01-01".to_owned(),
                through: "2026-01-03".to_owned(),
            }),
            series: vec![ActivitySeriesOverview {
                series_ref: "synthetic-origin".to_owned(),
                summary: ActivitySeriesSummary {
                    calendar_days: 3,
                    observed_days: 2,
                    available_step_days: 1,
                    unavailable_step_days: 1,
                    missing_days: 1,
                    total_step_count: Some(9_223_372_036_854_775_807),
                    average_step_count: Some(9_223_372_036_854_775_807),
                },
                days: vec![
                    ActivityDayInsight {
                        local_date: "2026-01-01".to_owned(),
                        step_count: Some(i64::MAX),
                        availability: ActivityDayAvailability::Available,
                    },
                    ActivityDayInsight {
                        local_date: "2026-01-02".to_owned(),
                        step_count: None,
                        availability: ActivityDayAvailability::Unavailable,
                    },
                    ActivityDayInsight {
                        local_date: "2026-01-03".to_owned(),
                        step_count: None,
                        availability: ActivityDayAvailability::Missing,
                    },
                ],
            }],
        };

        let json = serde_json::to_value(ActivityOverviewDto::from(overview))
            .expect("activity overview JSON");

        assert_eq!(
            json["series"][0]["summary"]["totalStepCount"],
            "9223372036854775807"
        );
        assert_eq!(
            json["series"][0]["days"][0]["stepCount"],
            "9223372036854775807"
        );
        assert_eq!(json["series"][0]["days"][0]["availability"], "available");
        assert_eq!(json["series"][0]["days"][1]["availability"], "unavailable");
        assert_eq!(json["series"][0]["days"][2]["availability"], "missing");
    }

    #[test]
    fn serializes_training_comparison_without_losing_exact_integer_measurements() {
        let summary = TrainingSeriesSummary {
            calendar_days: 2,
            training_days: 1,
            session_count: 1,
            total_duration_milliseconds: 18_446_744_073_709_551_614,
            distance_session_count: 1,
            total_distance_meters: Some(10_000.5),
            energy_session_count: 1,
            total_energy_kilocalories: Some(9_223_372_036_854_775_808),
            heart_rate_session_count: 1,
        };
        let range = TrainingDateRange {
            from: "2026-01-01".to_owned(),
            through: "2026-01-02".to_owned(),
        };
        let comparison = TrainingComparison {
            available_range: Some(range.clone()),
            baseline_range: Some(range.clone()),
            comparison_range: Some(range),
            series: vec![TrainingSeriesComparison {
                series_ref: "synthetic-origin".to_owned(),
                baseline: summary.clone(),
                comparison: summary,
                session_count_change: -9_223_372_036_854_775_808,
                training_day_change: 9_223_372_036_854_775_808,
                duration_milliseconds_change: -18_446_744_073_709_551_614,
                distance_meters_change: Some(500.25),
                energy_kilocalories_change: Some(9_223_372_036_854_775_808),
            }],
        };

        let comparison_json = serde_json::to_value(TrainingComparisonDto::from(comparison))
            .expect("training comparison JSON");

        assert_eq!(
            comparison_json["series"][0]["baseline"]["totalDurationMilliseconds"],
            "18446744073709551614"
        );
        assert_eq!(
            comparison_json["series"][0]["durationMillisecondsChange"],
            "-18446744073709551614"
        );
        assert_eq!(
            comparison_json["series"][0]["energyKilocaloriesChange"],
            "9223372036854775808"
        );
    }

    #[test]
    fn validates_and_serializes_the_training_sport_transport_contract() {
        let request: SaveSportClassificationRequestDto =
            serde_json::from_value(serde_json::json!({
                "sportRef": "sport-synthetic",
                "expectedRevision": 4,
                "canonicalFamily": "cycling",
                "displayLabel": "Gravel cycling"
            }))
            .expect("sport classification request");
        assert_eq!(
            SaveSportClassificationRequest::from(request),
            SaveSportClassificationRequest {
                sport_ref: "sport-synthetic".to_owned(),
                expected_revision: 4,
                canonical_family: Some("cycling".to_owned()),
                display_label: Some("Gravel cycling".to_owned()),
            }
        );
        assert!(
            serde_json::from_value::<SaveSportClassificationRequestDto>(serde_json::json!({
                "sportRef": "sport-synthetic",
                "expectedRevision": 4,
                "canonicalFamily": null,
                "displayLabel": null,
                "sourceSportRef": "must-not-cross-the-boundary"
            }))
            .is_err()
        );

        let recognized_json = serde_json::to_value(TrainingSportDto::from(TrainingSport {
            sport_ref: Some(format!("sport-{}", "c".repeat(64))),
            source_index: 1,
            state: TrainingSportState::Recognized,
            classification: Some(TrainingSportClassification {
                canonical_family: None,
                display_label: None,
                authorship: None,
                revision: 0,
            }),
            recognition: Some(TrainingSportRecognition {
                canonical_family: Some("running".to_owned()),
                localized_names: BTreeMap::from([
                    ("en".to_owned(), "Road running".to_owned()),
                    ("es".to_owned(), "Carrera en asfalto".to_owned()),
                ]),
                catalogue_revision: "catalogue-2026-08-25".to_owned(),
                retrieved_at_utc: "2026-08-25T10:00:00Z".to_owned(),
                mapping_version: "sport-mapping@1".to_owned(),
                evidence_ref: format!("sport-evidence-{}", "a".repeat(64)),
            }),
            recognition_candidate_count: 1,
            first_local_date: "2025-01-02".to_owned(),
            last_local_date: "2026-08-17".to_owned(),
            coverage: TrainingSportCoverage {
                session_count: 7,
                total_duration_milliseconds: 25_200_000,
                distance_session_count: 6,
                heart_rate_session_count: 5,
            },
        }))
        .expect("recognized training sport JSON");
        assert_eq!(recognized_json["state"], "recognized");
        assert_eq!(
            recognized_json["recognition"]["localizedNames"]["es"],
            "Carrera en asfalto"
        );
        assert_eq!(recognized_json["recognitionCandidateCount"], 1);
        assert!(recognized_json.get("sourceIdentifier").is_none());
        assert!(recognized_json["recognition"]
            .get("sourceProvider")
            .is_none());

        let classified = TrainingSport {
            sport_ref: Some("sport-synthetic".to_owned()),
            source_index: 2,
            state: TrainingSportState::PersonallyOverridden,
            classification: Some(TrainingSportClassification {
                canonical_family: Some("cycling".to_owned()),
                display_label: Some("Gravel cycling".to_owned()),
                authorship: Some("user".to_owned()),
                revision: 5,
            }),
            recognition: None,
            recognition_candidate_count: 0,
            first_local_date: "2025-01-02".to_owned(),
            last_local_date: "2026-08-17".to_owned(),
            coverage: TrainingSportCoverage {
                session_count: 7,
                total_duration_milliseconds: 25_200_000,
                distance_session_count: 6,
                heart_rate_session_count: 5,
            },
        };
        let overview = TrainingSportsOverview {
            origin_count: 2,
            session_count: 8,
            sports: vec![
                classified.clone(),
                TrainingSport {
                    sport_ref: None,
                    source_index: 1,
                    state: TrainingSportState::Unavailable,
                    classification: None,
                    recognition: None,
                    recognition_candidate_count: 0,
                    first_local_date: "2026-03-04".to_owned(),
                    last_local_date: "2026-03-04".to_owned(),
                    coverage: TrainingSportCoverage {
                        session_count: 1,
                        total_duration_milliseconds: 1_800_000,
                        distance_session_count: 0,
                        heart_rate_session_count: 0,
                    },
                },
            ],
        };
        assert_eq!(
            serde_json::to_value(TrainingSportsOverviewDto::from(overview.clone()))
                .expect("training sports overview JSON"),
            serde_json::json!({
                "originCount": 2,
                "sessionCount": 8,
                "sports": [{
                    "sportRef": "sport-synthetic",
                    "sourceIndex": 2,
                    "state": "personally-overridden",
                    "classification": {
                        "canonicalFamily": "cycling",
                        "displayLabel": "Gravel cycling",
                        "authorship": "user",
                        "revision": 5
                    },
                    "recognition": null,
                    "recognitionCandidateCount": 0,
                    "firstLocalDate": "2025-01-02",
                    "lastLocalDate": "2026-08-17",
                    "coverage": {
                        "sessionCount": 7,
                        "totalDurationMilliseconds": "25200000",
                        "distanceSessionCount": 6,
                        "heartRateSessionCount": 5
                    }
                }, {
                    "sportRef": null,
                    "sourceIndex": 1,
                    "state": "unavailable",
                    "classification": null,
                    "recognition": null,
                    "recognitionCandidateCount": 0,
                    "firstLocalDate": "2026-03-04",
                    "lastLocalDate": "2026-03-04",
                    "coverage": {
                        "sessionCount": 1,
                        "totalDurationMilliseconds": "1800000",
                        "distanceSessionCount": 0,
                        "heartRateSessionCount": 0
                    }
                }]
            })
        );
        assert_eq!(
            serde_json::to_value(SavedTrainingSportClassificationDto::from(
                SavedTrainingSportClassification {
                    outcome: SportClassificationSaveOutcome::Changed,
                    overview,
                },
            ))
            .expect("saved sport classification JSON")["outcome"],
            "changed"
        );
        for (error, code) in [
            (
                ApplicationError::InvalidSportClassification("invalid"),
                "invalid-sport-classification",
            ),
            (
                ApplicationError::SportClassificationConflict,
                "sport-classification-conflict",
            ),
            (
                ApplicationError::SportClassificationQuery("failed".to_owned()),
                "sport-classification-failed",
            ),
        ] {
            assert_eq!(
                serde_json::to_value(CommandErrorDto::from(error)).expect("sport error JSON"),
                serde_json::json!({ "code": code })
            );
        }
    }

    #[test]
    fn validates_and_serializes_the_training_session_search_transport_contract() {
        let input: TrainingSessionSearchRequestDto =
            serde_json::from_value(serde_json::json!({
                "from": "2025-01-01",
                "through": null,
                "sportRefs": ["sport-synthetic"],
                "requiredMeasurements": ["distance", "heart-rate"],
                "text": "Trail",
                "sort": "distance-desc",
                "offset": 25,
                "limit": 25,
                "snapshotRef": "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            }))
            .expect("training-session search request");
        let request = TrainingSessionSearchRequest::try_from(input)
            .expect("valid training-session search transport");
        assert_eq!(request.from.as_deref(), Some("2025-01-01"));
        assert_eq!(
            request.required_measurements,
            vec![
                TrainingMeasurementFilter::Distance,
                TrainingMeasurementFilter::HeartRate,
            ]
        );
        assert_eq!(request.sort, TrainingSessionSort::DistanceDescending);
        assert!(
            serde_json::from_value::<TrainingSessionSearchRequestDto>(serde_json::json!({
                "from": null,
                "through": null,
                "sportRefs": [],
                "requiredMeasurements": [],
                "text": null,
                "sort": "started-desc",
                "offset": 0,
                "limit": 25,
                "snapshotRef": null,
                "sourceSessionId": "must-not-cross-the-boundary"
            }))
            .is_err()
        );

        let calendar_input: TrainingSessionCalendarRequestDto =
            serde_json::from_value(serde_json::json!({
                "month": "2026-08",
                "from": "2026-01-01",
                "through": "2026-12-31",
                "sportRefs": ["sport-synthetic"],
                "requiredMeasurements": ["distance"],
                "text": "Trail",
                "snapshotRef": null
            }))
            .expect("training calendar request");
        let calendar_request = TrainingSessionCalendarRequest::try_from(calendar_input)
            .expect("valid training calendar transport");
        assert_eq!(calendar_request.month, "2026-08");
        assert_eq!(calendar_request.from.as_deref(), Some("2026-01-01"));
        assert_eq!(
            calendar_request.required_measurements,
            vec![TrainingMeasurementFilter::Distance]
        );
        assert!(
            serde_json::from_value::<TrainingSessionCalendarRequestDto>(serde_json::json!({
                "month": "2026-08",
                "from": null,
                "through": null,
                "sportRefs": [],
                "requiredMeasurements": [],
                "text": null,
                "snapshotRef": null,
                "originId": "must-not-cross-the-boundary"
            }))
            .is_err()
        );

        let page = TrainingSessionSearchPage {
            available_range: Some(TrainingDateRange {
                from: "2024-01-01".to_owned(),
                through: "2026-08-18".to_owned(),
            }),
            snapshot_ref:
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                    .to_owned(),
            total_count: 26,
            offset: 25,
            limit: 25,
            next_offset: None,
            summaries: vec![TrainingSessionSearchSummary {
                source_index: 2,
                training_days: 25,
                session_count: 26,
                total_duration_milliseconds: 18_446_744_073_709_551_614,
                distance_session_count: 25,
                total_distance_meters: Some(250_000.5),
                energy_session_count: 24,
                total_energy_kilocalories: Some(9_223_372_036_854_775_808),
                heart_rate_session_count: 23,
            }],
            sessions: vec![TrainingSessionSearchItem {
                session_ref:
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
                        .to_owned(),
                source_index: 2,
                started_at_local: "2026-08-18T07:30:00".to_owned(),
                stopped_at_local: "2026-08-18T08:30:00".to_owned(),
                utc_offset_minutes: Some(120),
                duration_milliseconds: i64::MAX,
                distance_meters: Some(10_000.5),
                energy_kilocalories: Some(i64::MAX),
                average_heart_rate_bpm: Some(145),
                maximum_heart_rate_bpm: Some(175),
                exercise_count: Some(1),
                sport: TrainingSessionSport {
                    sport_ref: Some("sport-synthetic".to_owned()),
                    state: TrainingSportState::PersonallyOverridden,
                    classification: Some(TrainingSportClassification {
                        canonical_family: Some("running".to_owned()),
                        display_label: Some("Trail running".to_owned()),
                        authorship: Some("user".to_owned()),
                        revision: 1,
                    }),
                    recognition: None,
                    recognition_candidate_count: 0,
                },
            }],
        };
        let json = serde_json::to_value(TrainingSessionSearchPageDto::from(page))
            .expect("training-session search JSON");
        assert_eq!(json["totalCount"], 26);
        assert_eq!(json["summaries"][0]["sessionCount"], 26);
        assert_eq!(
            json["summaries"][0]["totalDurationMilliseconds"],
            "18446744073709551614"
        );
        assert_eq!(
            json["summaries"][0]["totalEnergyKilocalories"],
            "9223372036854775808"
        );
        assert_eq!(
            json["sessions"][0]["durationMilliseconds"],
            i64::MAX.to_string()
        );
        assert_eq!(
            json["sessions"][0]["energyKilocalories"],
            i64::MAX.to_string()
        );
        assert_eq!(
            json["sessions"][0]["sport"]["state"],
            "personally-overridden"
        );
        assert_eq!(
            json["sessions"][0]["sport"]["classification"]["displayLabel"],
            "Trail running"
        );
        assert!(json["sessions"][0]
            .to_string()
            .find("sourceSessionId")
            .is_none());

        let calendar_json = serde_json::to_value(TrainingSessionCalendarDto::from(
            TrainingSessionCalendar {
                available_range: Some(TrainingDateRange {
                    from: "2024-01-01".to_owned(),
                    through: "2026-08-18".to_owned(),
                }),
                snapshot_ref:
                    "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                        .to_owned(),
                month: "2026-08".to_owned(),
                days: vec![TrainingSessionCalendarDay {
                    local_date: "2026-08-18".to_owned(),
                    source_index: 2,
                    session_count: 2,
                    total_duration_milliseconds: 18_446_744_073_709_551_614,
                    distance_session_count: 1,
                    total_distance_meters: Some(10_000.5),
                    heart_rate_session_count: 2,
                }],
            },
        ))
        .expect("training calendar JSON");
        assert_eq!(calendar_json["month"], "2026-08");
        assert_eq!(
            calendar_json["days"][0]["totalDurationMilliseconds"],
            "18446744073709551614"
        );
        assert_eq!(calendar_json["days"][0]["sourceIndex"], 2);

        let selection_input: TrainingSessionSelectionRequestDto =
            serde_json::from_value(serde_json::json!({
                "sessionRefs": [
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    "session-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
                ],
                "snapshotRef": "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            }))
            .expect("training selection request");
        let selection_request = TrainingSessionSelectionRequest::from(selection_input);
        assert_eq!(selection_request.session_refs.len(), 2);
        assert_eq!(
            selection_request.snapshot_ref.as_deref(),
            Some(
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            )
        );
        let selection_json = serde_json::to_value(TrainingSessionSelectionDto::from(
            TrainingSessionSelection {
                snapshot_ref: selection_request.snapshot_ref.unwrap(),
                sessions: Vec::new(),
            },
        ))
        .expect("training selection JSON");
        assert_eq!(selection_json["sessions"], serde_json::json!([]));
        assert!(
            serde_json::from_value::<TrainingSessionSelectionRequestDto>(serde_json::json!({
                "sessionRefs": [],
                "snapshotRef": null,
                "sourceSessionId": "must-not-cross-the-boundary"
            }))
            .is_err()
        );

        let workspace_value = serde_json::json!({
            "version": 1,
            "snapshotRef": "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "from": "2026-01-01",
            "through": "2026-08-18",
            "sportRefs": [
                "sport-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            ],
            "requiredMeasurements": ["distance", "heart-rate"],
            "text": "Trail",
            "sort": "distance-desc",
            "offset": 25,
            "limit": 25,
            "view": "calendar",
            "calendarMonth": "2026-08",
            "calendarDay": "2026-08-18",
            "selectedSessionRefs": [
                "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            ],
            "openSessionRef":
                "session-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
        });
        let workspace_input: TrainingDiscoveryWorkspaceDto =
            serde_json::from_value(workspace_value.clone()).expect("training workspace request");
        let workspace = TrainingDiscoveryWorkspace::try_from(workspace_input)
            .expect("valid training workspace transport");
        assert_eq!(workspace.view, TrainingDiscoveryView::Calendar);
        assert_eq!(workspace.calendar_day.as_deref(), Some("2026-08-18"));
        assert_eq!(
            serde_json::to_value(TrainingDiscoveryWorkspaceDto::from(workspace))
                .expect("training workspace JSON"),
            workspace_value
        );
        let mut unknown_workspace = workspace_value;
        unknown_workspace["originId"] = serde_json::json!("must-not-cross-the-boundary");
        assert!(
            serde_json::from_value::<TrainingDiscoveryWorkspaceDto>(unknown_workspace).is_err()
        );

        for (error, code) in [
            (
                ApplicationError::InvalidTrainingSessionSearch("invalid"),
                "invalid-training-session-search",
            ),
            (
                ApplicationError::TrainingSessionSearchChanged,
                "training-session-search-changed",
            ),
            (
                ApplicationError::TrainingSessionSearch("failed".to_owned()),
                "training-session-search-failed",
            ),
            (
                ApplicationError::InvalidTrainingDiscoveryWorkspace("invalid"),
                "invalid-training-discovery-workspace",
            ),
            (
                ApplicationError::TrainingDiscoveryWorkspaceQuery("failed".to_owned()),
                "training-discovery-workspace-query-failed",
            ),
            (
                ApplicationError::TrainingDiscoveryWorkspaceUpdate("failed".to_owned()),
                "training-discovery-workspace-update-failed",
            ),
        ] {
            assert_eq!(
                serde_json::to_value(CommandErrorDto::from(error))
                    .expect("training-session search error JSON"),
                serde_json::json!({ "code": code })
            );
        }
    }

    #[test]
    fn validates_and_serializes_the_training_session_structure_transport_contract() {
        let input: TrainingSessionStructureQueryDto = serde_json::from_value(serde_json::json!({
            "sessionRef":
                "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "snapshotRef":
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        }))
        .expect("training-session structure request");
        let query = TrainingSessionStructureQuery::from(input);
        assert_eq!(
            query.session_ref,
            "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        );
        assert_eq!(
            query.snapshot_ref.as_deref(),
            Some(
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            )
        );
        assert!(
            serde_json::from_value::<TrainingSessionStructureQueryDto>(serde_json::json!({
                "sessionRef":
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "snapshotRef": null,
                "sourceSessionId": "must-not-cross-the-boundary"
            }))
            .is_err()
        );

        let result = TrainingSessionStructureResult {
            snapshot_ref:
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                    .to_owned(),
            session_ref: "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
                .to_owned(),
            structure: Some(TrainingStructure {
                exercises: Some(vec![TrainingExerciseStructure {
                    exercise_ref:
                        "exercise-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
                            .to_owned(),
                    ordinal: 0,
                    started_at_local: "2026-08-18T07:30:00".to_owned(),
                    stopped_at_local: "2026-08-18T08:30:00".to_owned(),
                    utc_offset_minutes: Some(120),
                    duration_milliseconds: i64::MAX,
                    distance_meters: Some(10_000.5),
                    energy_kilocalories: Some(i64::MAX),
                    sport: TrainingSessionSport {
                        sport_ref: Some(
                            "sport-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
                                .to_owned(),
                        ),
                        state: TrainingSportState::PersonallyOverridden,
                        classification: Some(TrainingSportClassification {
                            canonical_family: Some("running".to_owned()),
                            display_label: Some("Trail running".to_owned()),
                            authorship: Some("user".to_owned()),
                            revision: 1,
                        }),
                        recognition: None,
                        recognition_candidate_count: 0,
                    },
                    manual_laps: Some(vec![TrainingLapStructure {
                        lap_ref:
                            "lap-ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
                                .to_owned(),
                        ordinal: 0,
                        split_time_milliseconds: i64::MAX - 1,
                        duration_milliseconds: i64::MAX,
                        distance_meters: Some(5_000.25),
                    }]),
                    automatic_laps: Some(Vec::new()),
                    pauses: Some(vec![TrainingPauseStructure {
                        pause_ref:
                            "pause-1111111111111111111111111111111111111111111111111111111111111111"
                                .to_owned(),
                        ordinal: 0,
                        started_at_local: "2026-08-18T08:00:00".to_owned(),
                        ended_at_local: "2026-08-18T08:01:00".to_owned(),
                    }]),
                }]),
            }),
        };
        let json = serde_json::to_value(TrainingSessionStructureResultDto::from(result))
            .expect("training-session structure JSON");
        assert_eq!(
            json["structure"]["exercises"][0]["durationMilliseconds"],
            i64::MAX.to_string()
        );
        assert_eq!(
            json["structure"]["exercises"][0]["manualLaps"][0]["splitTimeMilliseconds"],
            (i64::MAX - 1).to_string()
        );
        assert_eq!(
            json["structure"]["exercises"][0]["automaticLaps"],
            serde_json::json!([])
        );
        assert!(json.to_string().find("sourceSessionId").is_none());
        assert!(json.to_string().find("sourceExerciseId").is_none());

        for (error, code) in [
            (
                ApplicationError::InvalidTrainingSessionDetail("invalid"),
                "invalid-training-session-detail",
            ),
            (
                ApplicationError::TrainingSessionDetailChanged,
                "training-session-detail-changed",
            ),
            (
                ApplicationError::TrainingSessionDetail("failed".to_owned()),
                "training-session-detail-failed",
            ),
        ] {
            assert_eq!(
                serde_json::to_value(CommandErrorDto::from(error))
                    .expect("training-session detail error JSON"),
                serde_json::json!({ "code": code })
            );
        }
    }

    #[test]
    fn validates_and_serializes_bounded_and_exact_route_transport_contracts() {
        let input: TrainingSessionRouteQueryDto = serde_json::from_value(serde_json::json!({
            "sessionRef":
                "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "snapshotRef":
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "maxVisualPoints": 200
        }))
        .expect("training-session route request");
        let query = TrainingSessionRouteQuery::from(input);
        assert_eq!(query.max_visual_points, 200);
        assert!(
            serde_json::from_value::<TrainingSessionRouteQueryDto>(serde_json::json!({
                "sessionRef":
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "snapshotRef": null,
                "maxVisualPoints": 200,
                "sourceExerciseId": "must-not-cross-the-boundary"
            }))
            .is_err()
        );

        let result = TrainingSessionRoutesResult {
            snapshot_ref:
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                    .to_owned(),
            session_ref: "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
                .to_owned(),
            routes: Some(TrainingSessionRoutesView {
                exercises: Some(vec![TrainingExerciseRoutesView {
                    exercise_ref:
                        "exercise-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
                            .to_owned(),
                    ordinal: 0,
                    routes: Some(TrainingRouteCollectionView {
                        primary: Some(TrainingRouteOverview {
                            route_ref:
                                "route-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
                                    .to_owned(),
                            kind: TrainingRouteKindView::Primary,
                            started_at_local: "2026-08-18T07:30:00".to_owned(),
                            point_count: 1,
                            altitude_point_count: 1,
                            elapsed_point_count: 1,
                            visual_points: vec![TrainingRoutePointView {
                                ordinal: 0,
                                latitude_degrees: 40.0,
                                longitude_degrees: -3.0,
                                altitude_meters: Some(650.0),
                                elapsed_milliseconds: Some(i64::MAX),
                            }],
                        }),
                        transition: None,
                    }),
                }]),
            }),
        };
        let json = serde_json::to_value(TrainingSessionRoutesResultDto::from(result))
            .expect("training-session routes JSON");
        assert_eq!(
            json["routes"]["exercises"][0]["routes"]["primary"]["projection"],
            "source-ordinal-v1"
        );
        assert_eq!(
            json["routes"]["exercises"][0]["routes"]["primary"]["visualPoints"][0]
                ["elapsedMilliseconds"],
            i64::MAX.to_string()
        );
        assert!(json.to_string().find("sourceExerciseId").is_none());

        let exact_input: TrainingRoutePointsQueryDto = serde_json::from_value(serde_json::json!({
            "sessionRef":
                "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "routeRef":
                "route-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
            "snapshotRef": null,
            "offset": 0,
            "limit": 250
        }))
        .expect("exact route points request");
        let exact_query = TrainingRoutePointsQuery::from(exact_input);
        assert_eq!(exact_query.limit, 250);
        assert_eq!(exact_query.offset, 0);

        let exact = PersistedTrainingRoutePoints {
            snapshot_ref:
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                    .to_owned(),
            session_ref: "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
                .to_owned(),
            route_ref: "route-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
                .to_owned(),
            point_count: 1,
            offset: 0,
            points: vec![TrainingRoutePointView {
                ordinal: 0,
                latitude_degrees: 40.0,
                longitude_degrees: -3.0,
                altitude_meters: None,
                elapsed_milliseconds: Some(i64::MAX),
            }],
            next_offset: None,
        };
        let exact_json = serde_json::to_value(TrainingRoutePointsResultDto::from(exact))
            .expect("exact route points JSON");
        assert_eq!(
            exact_json["points"][0]["elapsedMilliseconds"],
            i64::MAX.to_string()
        );
    }

    #[test]
    fn validates_and_serializes_bounded_and_exact_signal_transport_contracts() {
        let input: TrainingSessionSignalsQueryDto =
            serde_json::from_value(serde_json::json!({
                "sessionRef":
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "snapshotRef":
                    "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "maxVisualSamples": 200
            }))
            .expect("training-session signal request");
        let query = TrainingSessionSignalsQuery::from(input);
        assert_eq!(query.max_visual_samples, 200);
        assert!(
            serde_json::from_value::<TrainingSessionSignalsQueryDto>(serde_json::json!({
                "sessionRef":
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "snapshotRef": null,
                "maxVisualSamples": 200,
                "sourceSignalType": "HEART_RATE"
            }))
            .is_err()
        );

        let result = TrainingSessionSignalsResult {
            snapshot_ref:
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                    .to_owned(),
            session_ref: "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
                .to_owned(),
            signals: Some(TrainingSessionSignalsView {
                exercises: Some(vec![TrainingExerciseSignalsView {
                    exercise_ref:
                        "exercise-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
                            .to_owned(),
                    ordinal: 0,
                    signals: Some(TrainingSignalCollectionView {
                        primary: Some(vec![TrainingSignalSeriesOverview {
                            signal_ref:
                                "signal-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
                                    .to_owned(),
                            ordinal: 0,
                            role: TrainingSignalRoleView::Primary,
                            kind: TrainingSignalKindView::HeartRate,
                            unit: TrainingSignalUnitView::BeatsPerMinute,
                            interval_milliseconds: i64::MAX,
                            sample_count: 1,
                            available_sample_count: 0,
                            visual_samples: vec![TrainingSignalVisualSampleView {
                                ordinal: 0,
                                elapsed_milliseconds: 0,
                                value: None,
                                gap_before: false,
                            }],
                        }]),
                        transition: None,
                        unsupported_primary_series_count: 2,
                        unsupported_transition_series_count: 0,
                    }),
                }]),
            }),
        };
        let json = serde_json::to_value(TrainingSessionSignalsResultDto::from(result))
            .expect("training-session signals JSON");
        let primary = &json["signals"]["exercises"][0]["signals"]["primary"][0];
        assert_eq!(primary["projection"], "source-ordinal-v1");
        assert_eq!(primary["kind"], "heart-rate");
        assert_eq!(primary["unit"], "beats-per-minute");
        assert_eq!(primary["intervalMilliseconds"], i64::MAX.to_string());
        assert!(primary["visualSamples"][0]["value"].is_null());
        assert_eq!(primary["visualSamples"][0]["gapBefore"], false);
        assert!(json.to_string().find("sourceSignalType").is_none());

        let exact_input: TrainingSignalSamplesQueryDto =
            serde_json::from_value(serde_json::json!({
                "sessionRef":
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "signalRef":
                    "signal-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
                "snapshotRef": null,
                "offset": 0,
                "limit": 250
            }))
            .expect("exact signal samples request");
        let exact_query = TrainingSignalSamplesQuery::from(exact_input);
        assert_eq!(exact_query.limit, 250);

        let exact = PersistedTrainingSignalSamples {
            snapshot_ref:
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                    .to_owned(),
            session_ref: "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
                .to_owned(),
            signal_ref: "signal-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
                .to_owned(),
            exercise_ref:
                "exercise-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
                    .to_owned(),
            ordinal: 0,
            role: TrainingSignalRoleView::Primary,
            kind: TrainingSignalKindView::Temperature,
            unit: TrainingSignalUnitView::DegreesCelsius,
            interval_milliseconds: 1_000,
            sample_count: 1,
            offset: 0,
            samples: vec![TrainingSignalSampleView {
                ordinal: 0,
                elapsed_milliseconds: 0,
                value: Some(-5.5),
            }],
            next_offset: None,
        };
        let exact_json = serde_json::to_value(TrainingSignalSamplesResultDto::from(exact))
            .expect("exact signal samples JSON");
        assert_eq!(exact_json["kind"], "temperature");
        assert_eq!(exact_json["samples"][0]["value"], -5.5);
        assert_eq!(exact_json["samples"][0]["elapsedMilliseconds"], "0");
    }

    #[test]
    fn validates_and_serializes_the_composed_session_story_transport_contract() {
        let input: SessionStoryQueryDto = serde_json::from_value(serde_json::json!({
            "sessionRef":
                "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "snapshotRef":
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "maxVisualPoints": 300,
            "maxVisualSamples": 400
        }))
        .expect("session story request");
        let query = SessionStoryQuery::from(input);
        assert_eq!(query.max_visual_points, 300);
        assert_eq!(query.max_visual_samples, 400);
        assert!(
            serde_json::from_value::<SessionStoryQueryDto>(serde_json::json!({
                "sessionRef":
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "snapshotRef": null,
                "maxVisualPoints": 300,
                "maxVisualSamples": 400,
                "sourceSessionId": "must-not-cross-the-boundary"
            }))
            .is_err()
        );

        let session = TrainingSessionSearchItem {
            session_ref: "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
                .to_owned(),
            source_index: 1,
            started_at_local: "2026-08-18T07:30:00".to_owned(),
            stopped_at_local: "2026-08-18T08:30:00".to_owned(),
            utc_offset_minutes: Some(120),
            duration_milliseconds: i64::MAX,
            distance_meters: Some(10_000.5),
            energy_kilocalories: Some(i64::MAX),
            average_heart_rate_bpm: Some(145),
            maximum_heart_rate_bpm: Some(175),
            exercise_count: Some(1),
            sport: TrainingSessionSport {
                sport_ref: Some(
                    "sport-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
                        .to_owned(),
                ),
                state: TrainingSportState::PersonallyOverridden,
                classification: Some(TrainingSportClassification {
                    canonical_family: Some("running".to_owned()),
                    display_label: Some("Trail running".to_owned()),
                    authorship: Some("user".to_owned()),
                    revision: 1,
                }),
                recognition: None,
                recognition_candidate_count: 0,
            },
        };
        let story = SessionStory {
            schema_version: 4,
            snapshot_ref:
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                    .to_owned(),
            session,
            structure: None,
            routes: None,
            signals: None,
            zones: None,
            provenance: SessionStoryProvenance {
                total_event_count: 2,
                current: TrainingProvenanceCurrentView {
                    provider: TrainingSourceProviderView::restore("polar-flow".to_owned()).unwrap(),
                    source_modified_at_utc: "2026-08-18T08:30:00Z".to_owned(),
                    source_adapter_version: "polar-flow@1".to_owned(),
                    mapping_version: "training-session@1".to_owned(),
                    contributing_event_count: 1,
                    non_contributing_event_count: 1,
                },
            },
            composition: SessionStoryCompositionView {
                structure_state: SessionStoryAssessmentStateView::NotEvaluated,
                route_state: SessionStoryAssessmentStateView::NotEvaluated,
                signal_state: SessionStoryAssessmentStateView::NotEvaluated,
                zone_state: SessionStoryAssessmentStateView::NotEvaluated,
                exercise_count: 1,
            },
            exercises: vec![SessionStoryExercise {
                exercise_ref:
                    "exercise-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
                        .to_owned(),
                ordinal: 0,
                sport: None,
                structure: None,
                zones: None,
                evidence: SessionStoryExerciseEvidenceView {
                    has_structure: false,
                    manual_lap_count: 0,
                    automatic_lap_count: 0,
                    pause_count: 0,
                    zone_group_count: 0,
                    zone_count: 0,
                    timed_zone_count: 0,
                    unsupported_zone_group_count: 0,
                },
                primary: SessionStoryRole {
                    route: None,
                    signals: Vec::new(),
                    evidence: SessionStoryRoleEvidenceView {
                        route_point_count: 501,
                        signal_series_count: 1,
                        signal_series_with_values_count: 1,
                        partial_signal_series_count: 0,
                        unavailable_signal_series_count: 0,
                        empty_signal_series_count: 0,
                        unsupported_signal_series_count: 2,
                        signal_sample_count: 601,
                        available_signal_sample_count: 601,
                        unavailable_signal_sample_count: 0,
                    },
                    primary_metric: Some(SessionStoryMetricView::Pace),
                    eligible_overlays: vec![SessionStoryOverlayView {
                        signal_ref:
                            "signal-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
                                .to_owned(),
                        metric: SessionStoryMetricView::Pace,
                        source_kind: TrainingSignalKindView::Speed,
                        source_unit: TrainingSignalUnitView::KilometersPerHour,
                        value_transform:
                            SessionStoryValueTransform::KilometersPerHourToMinutesPerKilometer,
                        alignment_state: SessionStoryAlignmentStateView::Unavailable,
                        aligned_samples: Vec::new(),
                    }],
                    exact_route: Some(SessionStoryExactRoute {
                        route_ref:
                            "route-ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
                                .to_owned(),
                        point_count: 501,
                    }),
                    exact_signals: vec![SessionStoryExactSignal {
                        signal_ref:
                            "signal-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
                                .to_owned(),
                        kind: TrainingSignalKindView::Speed,
                        unit: TrainingSignalUnitView::KilometersPerHour,
                        sample_count: 601,
                    }],
                },
                transition: SessionStoryRole {
                    route: None,
                    signals: Vec::new(),
                    evidence: SessionStoryRoleEvidenceView {
                        route_point_count: 0,
                        signal_series_count: 0,
                        signal_series_with_values_count: 0,
                        partial_signal_series_count: 0,
                        unavailable_signal_series_count: 0,
                        empty_signal_series_count: 0,
                        unsupported_signal_series_count: 0,
                        signal_sample_count: 0,
                        available_signal_sample_count: 0,
                        unavailable_signal_sample_count: 0,
                    },
                    primary_metric: None,
                    eligible_overlays: Vec::new(),
                    exact_route: None,
                    exact_signals: Vec::new(),
                },
            }],
        };

        let json =
            serde_json::to_value(SessionStoryDto::from(story)).expect("session story response");
        assert_eq!(json["schemaVersion"], 4);
        assert_eq!(
            json["session"]["durationMilliseconds"],
            i64::MAX.to_string()
        );
        assert!(json["structure"].is_null());
        assert_eq!(json["composition"]["signalState"], "not-evaluated");
        assert_eq!(
            json["exercises"][0]["primary"]["evidence"]["unsupportedSignalSeriesCount"],
            2
        );
        assert_eq!(json["exercises"][0]["primary"]["primaryMetric"], "pace");
        assert_eq!(
            json["exercises"][0]["primary"]["eligibleOverlays"][0]["valueTransform"],
            "kilometers-per-hour-to-minutes-per-kilometer"
        );
        assert_eq!(
            json["exercises"][0]["primary"]["eligibleOverlays"][0]["alignmentState"],
            "unavailable"
        );
        assert!(
            json["exercises"][0]["primary"]["eligibleOverlays"][0]["alignedSamples"]
                .as_array()
                .is_some_and(Vec::is_empty)
        );
        assert_eq!(
            json["exercises"][0]["primary"]["exactRoute"]["pointCount"],
            501
        );
        assert!(json.to_string().find("color").is_none());
        assert!(json.to_string().find("sourceSessionId").is_none());
    }

    #[test]
    fn validates_and_serializes_exact_recorded_zone_transport_contracts() {
        let input: TrainingSessionZonesQueryDto = serde_json::from_value(serde_json::json!({
            "sessionRef":
                "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "snapshotRef":
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        }))
        .expect("training-session zone request");
        let query = TrainingSessionZonesQuery::from(input);
        assert!(query.snapshot_ref.is_some());
        assert!(
            serde_json::from_value::<TrainingSessionZonesQueryDto>(serde_json::json!({
                "sessionRef":
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "snapshotRef": null,
                "sourceZoneType": "ZONE_TYPE_HEART_RATE"
            }))
            .is_err()
        );

        let result = TrainingSessionZonesResult {
            snapshot_ref:
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                    .to_owned(),
            session_ref: "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
                .to_owned(),
            zones: Some(TrainingSessionZonesView {
                exercises: Some(vec![TrainingExerciseZonesView {
                    exercise_ref:
                        "exercise-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
                            .to_owned(),
                    ordinal: 0,
                    zones: Some(TrainingZoneCollectionView {
                        groups: vec![TrainingZoneGroupView {
                            zone_group_ref:
                                "zone-group-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
                                    .to_owned(),
                            ordinal: 0,
                            kind: TrainingZoneKindView::HeartRate,
                            unit: TrainingZoneUnitView::BeatsPerMinute,
                            zones: Some(vec![TrainingZoneView {
                                zone_ref:
                                    "zone-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
                                        .to_owned(),
                                ordinal: 0,
                                lower_limit: 140.0,
                                higher_limit: 159.0,
                                time_in_zone_milliseconds: Some(i64::MAX),
                                distance_meters: None,
                                muscle_load: None,
                            }]),
                        }],
                        unsupported_group_count: 1,
                    }),
                }]),
            }),
        };
        let json = serde_json::to_value(TrainingSessionZonesResultDto::from(result))
            .expect("training-session zones JSON");
        let group = &json["zones"]["exercises"][0]["zones"]["groups"][0];
        assert_eq!(group["kind"], "heart-rate");
        assert_eq!(group["unit"], "beats-per-minute");
        assert_eq!(
            group["zones"][0]["timeInZoneMilliseconds"],
            i64::MAX.to_string()
        );
        assert!(group["zones"][0]["distanceMeters"].is_null());
        assert_eq!(
            json["zones"]["exercises"][0]["zones"]["unsupportedGroupCount"],
            1
        );
        assert!(json.to_string().find("sourceZoneType").is_none());
    }

    #[test]
    fn validates_and_serializes_privacy_bounded_training_provenance_contracts() {
        let input: TrainingSessionProvenanceQueryDto =
            serde_json::from_value(serde_json::json!({
                "sessionRef":
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "snapshotRef":
                    "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "offset": 0,
                "limit": 10
            }))
            .expect("training-session provenance request");
        let query = TrainingSessionProvenanceQuery::from(input);
        assert_eq!(query.offset, 0);
        assert_eq!(query.limit, 10);
        assert!(
            serde_json::from_value::<TrainingSessionProvenanceQueryDto>(serde_json::json!({
                "sessionRef":
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "snapshotRef": null,
                "offset": 0,
                "limit": 10,
                "artifactLocator": "private.zip"
            }))
            .is_err()
        );

        let result = TrainingSessionProvenanceResult {
            snapshot_ref:
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                    .to_owned(),
            session_ref: "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
                .to_owned(),
            total_event_count: 2,
            offset: 0,
            limit: 10,
            next_offset: None,
            current: TrainingProvenanceCurrentView {
                provider: TrainingSourceProviderView::restore("polar-flow".to_owned())
                    .expect("supported provider code"),
                source_modified_at_utc: "2026-08-17T18:30:00Z".to_owned(),
                source_adapter_version: "polar-flow-archive@11".to_owned(),
                mapping_version: "polar-flow-training-session@6".to_owned(),
                contributing_event_count: 1,
                non_contributing_event_count: 1,
            },
            events: vec![
                TrainingProvenanceEventView {
                    ordinal: 0,
                    observed_at_utc: "2026-08-17T18:31:00Z".to_owned(),
                    source_modified_at_utc: "2026-08-17T18:30:00Z".to_owned(),
                    provider: TrainingSourceProviderView::restore("polar-flow".to_owned())
                        .expect("supported provider code"),
                    source_adapter_version: "polar-flow-archive@11".to_owned(),
                    mapping_version: "polar-flow-training-session@6".to_owned(),
                    decision: TrainingProvenanceDecisionView::Create,
                    contributes_to_visible_state: true,
                },
                TrainingProvenanceEventView {
                    ordinal: 1,
                    observed_at_utc: "2026-08-18T08:00:00Z".to_owned(),
                    source_modified_at_utc: "2026-08-16T10:00:00Z".to_owned(),
                    provider: TrainingSourceProviderView::restore("polar-flow".to_owned())
                        .expect("supported provider code"),
                    source_adapter_version: "polar-flow-archive@11".to_owned(),
                    mapping_version: "polar-flow-training-session@6".to_owned(),
                    decision: TrainingProvenanceDecisionView::Preserve,
                    contributes_to_visible_state: false,
                },
            ],
        };
        let json = serde_json::to_value(TrainingSessionProvenanceResultDto::from(result))
            .expect("training-session provenance JSON");
        assert_eq!(json["current"]["provider"], "polar-flow");
        assert_eq!(json["events"][0]["decision"], "create");
        assert_eq!(json["events"][1]["decision"], "preserve");
        assert_eq!(json["events"][1]["contributesToVisibleState"], false);
        let encoded = json.to_string();
        for private_field in [
            "artifactLocator",
            "sourceRecordLocator",
            "sourceArtifactSha256",
            "originId",
            "providerRecordId",
            "importOperationId",
            "localPath",
        ] {
            assert!(!encoded.contains(private_field));
        }
    }

    #[test]
    fn validates_and_serializes_user_authored_segmentation_transport_contracts() {
        let query_input: TrainingSessionSegmentationQueryDto =
            serde_json::from_value(serde_json::json!({
                "sessionRef":
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "snapshotRef":
                    "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            }))
            .expect("segmentation query");
        let query = TrainingSessionSegmentationQuery::from(query_input);
        assert!(query.snapshot_ref.is_some());

        let create_input: CreateTrainingSegmentCriterionRequestDto =
            serde_json::from_value(serde_json::json!({
                "sessionRef":
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "snapshotRef":
                    "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "exerciseRef":
                    "exercise-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                "title": "Manual plan",
                "definition": {
                    "kind": "manual-boundaries",
                    "elapsedMilliseconds": ["60000", "120000"]
                }
            }))
            .expect("create criterion transport");
        let create = CreateTrainingSegmentCriterionRequest::try_from(create_input)
            .expect("create criterion request");
        assert_eq!(
            create.definition,
            SegmentCriterionDefinition::ManualBoundaries {
                elapsed_milliseconds: vec![60_000, 120_000]
            }
        );
        assert!(
            serde_json::from_value::<CreateTrainingSegmentCriterionRequestDto>(
                serde_json::json!({
                    "sessionRef":
                        "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    "snapshotRef":
                        "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    "exerciseRef":
                        "exercise-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                    "title": "Leaky provider value",
                    "definition": { "kind": "equal-elapsed-time", "spanMilliseconds": "60000" },
                    "sourceExerciseId": "must-not-cross-the-boundary"
                })
            )
            .is_err()
        );

        let criterion = SegmentCriterion::create(
            "criterion-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
            "Tempo range",
            SegmentCriterionDefinition::HeartRateZone {
                minimum_beats_per_minute: 140,
                maximum_beats_per_minute: 159,
            },
        )
        .expect("transport criterion");
        let result = TrainingSessionSegmentationResult {
            snapshot_ref:
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                    .to_owned(),
            session_ref: "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
                .to_owned(),
            available_criteria: vec![criterion.clone()],
            exercises: Some(vec![TrainingExerciseSegmentation {
                exercise_ref:
                    "exercise-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
                        .to_owned(),
                ordinal: 0,
                duration_milliseconds: i64::MAX,
                applied_criteria: vec![AppliedTrainingSegmentCriterion {
                    criterion,
                    ordinal: 0,
                    applicability: SegmentApplicabilityView::Applicable,
                    required_measurement: Some(SegmentMeasurementView::HeartRate),
                    has_evidence_gaps: true,
                    segments: vec![TrainingDerivedSegment {
                        ordinal: 0,
                        started_at_elapsed_milliseconds: i64::MAX - 2,
                        ended_at_elapsed_milliseconds: i64::MAX,
                    }],
                }],
            }]),
        };
        let json = serde_json::to_value(TrainingSessionSegmentationResultDto::from(result))
            .expect("segmentation result JSON");
        assert_eq!(
            json["availableCriteria"][0]["definition"],
            serde_json::json!({
                "kind": "heart-rate-zone",
                "minimumBeatsPerMinute": 140,
                "maximumBeatsPerMinute": 159
            })
        );
        let applied = &json["exercises"][0]["appliedCriteria"][0];
        assert_eq!(applied["criterion"]["authorship"], "user");
        assert_eq!(applied["applicability"], "applicable");
        assert_eq!(applied["requiredMeasurement"], "heart-rate");
        assert_eq!(applied["hasEvidenceGaps"], true);
        assert_eq!(
            applied["segments"][0]["startedAtElapsedMilliseconds"],
            (i64::MAX - 2).to_string()
        );
        assert_eq!(applied["segments"][0]["attribution"], "fitfreed-derived");
        assert!(json.to_string().find("sourceExerciseId").is_none());

        for (error, code) in [
            (
                ApplicationError::InvalidTrainingSegmentCriterion("invalid"),
                "invalid-training-segment-criterion",
            ),
            (
                ApplicationError::TrainingSegmentCriterionConflict,
                "training-segment-criterion-conflict",
            ),
            (
                ApplicationError::TrainingSegmentationChanged,
                "training-segmentation-changed",
            ),
            (
                ApplicationError::TrainingSegmentationQuery("failed".to_owned()),
                "training-segmentation-failed",
            ),
            (
                ApplicationError::InvalidTrainingSessionRange("invalid"),
                "invalid-training-session-range",
            ),
            (
                ApplicationError::TrainingSessionRangeNotFound,
                "training-session-range-not-found",
            ),
            (
                ApplicationError::TrainingSessionRangeConflict,
                "training-session-range-conflict",
            ),
            (
                ApplicationError::TrainingSessionRangesChanged,
                "training-session-ranges-changed",
            ),
            (
                ApplicationError::TrainingSessionRangeQuery("failed".to_owned()),
                "training-session-range-failed",
            ),
            (
                ApplicationError::TrainingSessionRangeUpdate("failed".to_owned()),
                "training-session-range-failed",
            ),
            (
                ApplicationError::InvalidTrainingSessionRangeSummary("invalid"),
                "invalid-training-session-range-summary",
            ),
            (
                ApplicationError::TrainingSessionRangeSummaryChanged,
                "training-session-range-summary-changed",
            ),
            (
                ApplicationError::TrainingSessionRangeSummaryQuery("failed".to_owned()),
                "training-session-range-summary-failed",
            ),
        ] {
            assert_eq!(
                serde_json::to_value(CommandErrorDto::from(error))
                    .expect("segmentation error JSON"),
                serde_json::json!({ "code": code })
            );
        }
    }

    #[test]
    fn validates_and_serializes_personal_range_transport_contracts() {
        let query_input: TrainingSessionRangesQueryDto =
            serde_json::from_value(serde_json::json!({
                "sessionRef":
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "snapshotRef": null
            }))
            .expect("personal range query transport");
        let query = TrainingSessionRangesQuery::from(query_input);
        assert_eq!(
            query.session_ref,
            "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        );
        assert_eq!(query.snapshot_ref, None);

        let create_input: CreateTrainingSessionRangeRequestDto =
            serde_json::from_value(serde_json::json!({
                "sessionRef":
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "snapshotRef":
                    "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "exerciseRef":
                    "exercise-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                "coordinate": {
                    "scope": "route-elapsed",
                    "routeRef":
                        "route-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                },
                "title": "Bridge to bend",
                "startedAtElapsedMilliseconds": "0",
                "endedAtElapsedMilliseconds": "9223372036854775807"
            }))
            .expect("personal range create transport");
        let create = CreateTrainingSessionRangeRequest::try_from(create_input)
            .expect("personal range create request");
        assert_eq!(create.started_at_elapsed_milliseconds, 0);
        assert_eq!(create.ended_at_elapsed_milliseconds, i64::MAX);
        assert_eq!(
            create.coordinate,
            TrainingSessionRangeCoordinate::route_elapsed(
                "route-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            )
            .expect("route coordinate")
        );
        assert_eq!(
            create.exercise_ref,
            "exercise-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
        );

        let rename_input: RenameTrainingSessionRangeRequestDto =
            serde_json::from_value(serde_json::json!({
                "sessionRef":
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "snapshotRef":
                    "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "rangeRef":
                    "range-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                "expectedRevision": 2,
                "title": "Strong finish"
            }))
            .expect("personal range rename transport");
        let rename = RenameTrainingSessionRangeRequest::from(rename_input);
        assert_eq!(rename.expected_revision, 2);
        assert_eq!(rename.title, "Strong finish");

        let adjust_input: AdjustTrainingSessionRangeRequestDto =
            serde_json::from_value(serde_json::json!({
                "sessionRef":
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "snapshotRef":
                    "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "rangeRef":
                    "range-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                "expectedRevision": 3,
                "exerciseRef":
                    "exercise-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                "coordinate": {
                    "scope": "signal-elapsed",
                    "signalRef":
                        "signal-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
                },
                "startedAtElapsedMilliseconds": "10",
                "endedAtElapsedMilliseconds": "20"
            }))
            .expect("personal range adjustment transport");
        let adjust = AdjustTrainingSessionRangeRequest::try_from(adjust_input)
            .expect("personal range adjustment request");
        assert_eq!(adjust.expected_revision, 3);
        assert_eq!(adjust.started_at_elapsed_milliseconds, 10);
        assert_eq!(adjust.ended_at_elapsed_milliseconds, 20);
        assert_eq!(
            adjust.coordinate,
            TrainingSessionRangeCoordinate::signal_elapsed(
                "signal-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            )
            .expect("signal coordinate")
        );

        let remove_input: RemoveTrainingSessionRangeRequestDto =
            serde_json::from_value(serde_json::json!({
                "sessionRef":
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "snapshotRef":
                    "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "rangeRef":
                    "range-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                "expectedRevision": 4
            }))
            .expect("personal range removal transport");
        let remove = RemoveTrainingSessionRangeRequest::from(remove_input);
        assert_eq!(remove.expected_revision, 4);

        assert!(
            CreateTrainingSessionRangeRequest::try_from(
                serde_json::from_value::<CreateTrainingSessionRangeRequestDto>(
                    serde_json::json!({
                        "sessionRef":
                            "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                        "snapshotRef":
                            "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                        "exerciseRef":
                            "exercise-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                        "coordinate": { "scope": "exercise-elapsed" },
                        "title": "Invalid boundary",
                        "startedAtElapsedMilliseconds": "00",
                        "endedAtElapsedMilliseconds": "1"
                    })
                )
                .expect("structurally valid range request")
            )
            .is_err()
        );
        assert!(
            serde_json::from_value::<AdjustTrainingSessionRangeRequestDto>(serde_json::json!({
                "sessionRef":
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "snapshotRef":
                    "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "rangeRef":
                    "range-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                "expectedRevision": 2,
                "exerciseRef":
                    "exercise-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                "coordinate": { "scope": "exercise-elapsed" },
                "startedAtElapsedMilliseconds": "10",
                "endedAtElapsedMilliseconds": "20",
                "sourceLapId": "must-not-cross-the-boundary"
            }))
            .is_err()
        );
        for invalid_coordinate in [
            serde_json::json!({
                "scope": "route-elapsed",
                "signalRef":
                    "signal-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            }),
            serde_json::json!({
                "scope": "exercise-elapsed",
                "routeRef":
                    "route-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            }),
            serde_json::json!({ "scope": "legacy-session-elapsed" }),
        ] {
            assert!(
                serde_json::from_value::<TrainingSessionRangeCoordinateInputDto>(
                    invalid_coordinate
                )
                .is_err()
            );
        }

        let range = TrainingSessionRange::restore(
            "range-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            Some(
                "exercise-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
                    .to_owned(),
            ),
            TrainingSessionRangeCoordinate::route_elapsed(
                "route-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            )
            .expect("transport route coordinate"),
            "Bridge to bend",
            i64::MAX - 2,
            i64::MAX,
            "range-evidence-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
            TrainingSessionRangeAuthorship::User,
            TrainingSessionRangeState::ReviewRequired,
            7,
        )
        .expect("transport range");
        let legacy_range = TrainingSessionRange::restore(
            "range-ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            None,
            TrainingSessionRangeCoordinate::legacy_session_elapsed(),
            "Preserved selection",
            1,
            2,
            "range-evidence-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
            TrainingSessionRangeAuthorship::User,
            TrainingSessionRangeState::ReviewRequired,
            4,
        )
        .expect("transport legacy range");
        let result = TrainingSessionRangesResult {
            snapshot_ref:
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                    .to_owned(),
            session_ref: "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
                .to_owned(),
            session_duration_milliseconds: i64::MAX,
            evidence_revision:
                "range-evidence-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
                    .to_owned(),
            exercises: vec![TrainingSessionRangeExerciseContext {
                exercise_ref:
                    "exercise-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
                        .to_owned(),
                ordinal: 0,
                coordinates: vec![
                    TrainingSessionRangeCoordinateContext {
                        coordinate: TrainingSessionRangeCoordinate::exercise_elapsed(),
                        maximum_elapsed_milliseconds: i64::MAX,
                    },
                    TrainingSessionRangeCoordinateContext {
                        coordinate: TrainingSessionRangeCoordinate::route_elapsed(
                            "route-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                        )
                        .expect("transport route context"),
                        maximum_elapsed_milliseconds: i64::MAX - 1,
                    },
                    TrainingSessionRangeCoordinateContext {
                        coordinate: TrainingSessionRangeCoordinate::signal_elapsed(
                            "signal-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                        )
                        .expect("transport signal context"),
                        maximum_elapsed_milliseconds: i64::MAX - 2,
                    },
                ],
            }],
            ranges: vec![range, legacy_range],
        };
        let json = serde_json::to_value(TrainingSessionRangesResultDto::from(result))
            .expect("personal range result JSON");
        assert_eq!(json["sessionDurationMilliseconds"], i64::MAX.to_string());
        assert_eq!(
            json["exercises"][0]["coordinates"][0]["maximumElapsedMilliseconds"],
            i64::MAX.to_string()
        );
        assert_eq!(
            json["exercises"][0]["coordinates"][0]["coordinate"],
            serde_json::json!({ "scope": "exercise-elapsed" })
        );
        assert_eq!(
            json["exercises"][0]["coordinates"][1]["coordinate"],
            serde_json::json!({
                "scope": "route-elapsed",
                "routeRef":
                    "route-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            })
        );
        assert_eq!(
            json["exercises"][0]["coordinates"][2]["coordinate"],
            serde_json::json!({
                "scope": "signal-elapsed",
                "signalRef":
                    "signal-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            })
        );
        assert_eq!(
            json["ranges"][0]["exerciseRef"],
            "exercise-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
        );
        assert_eq!(
            json["ranges"][0]["startedAtElapsedMilliseconds"],
            (i64::MAX - 2).to_string()
        );
        assert_eq!(json["ranges"][0]["authorship"], "user");
        assert_eq!(json["ranges"][0]["state"], "review-required");
        assert_eq!(json["ranges"][0]["revision"], 7);
        assert_eq!(
            json["ranges"][0]["coordinate"],
            serde_json::json!({
                "scope": "route-elapsed",
                "routeRef":
                    "route-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            })
        );
        assert_eq!(json["ranges"][1]["exerciseRef"], serde_json::Value::Null);
        assert_eq!(
            json["ranges"][1]["coordinate"],
            serde_json::json!({ "scope": "legacy-session-elapsed" })
        );
        assert!(json.to_string().find("sourceSessionId").is_none());
    }

    #[test]
    fn validates_and_serializes_the_range_summary_transport_contract() {
        let query: TrainingSessionRangeSummaryQuery = serde_json::from_value::<
            TrainingSessionRangeSummaryQueryDto,
        >(serde_json::json!({
            "sessionRef":
                "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "snapshotRef":
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "rangeRef":
                "range-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            "expectedRangeRevision": 7
        }))
        .expect("range summary query transport")
        .into();
        assert_eq!(query.expected_range_revision, 7);
        assert!(serde_json::from_value::<TrainingSessionRangeSummaryQueryDto>(
            serde_json::json!({
                "sessionRef":
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "snapshotRef":
                    "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "rangeRef":
                    "range-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                "expectedRangeRevision": 7,
                "sourceSessionId": "must-not-cross-the-boundary"
            })
        )
        .is_err());

        let route_ref = "route-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
        let range = TrainingSessionRange::restore(
            &query.range_ref,
            &query.session_ref,
            Some(
                "exercise-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
                    .to_owned(),
            ),
            TrainingSessionRangeCoordinate::route_elapsed(route_ref)
                .expect("summary route coordinate"),
            "Bridge to bend",
            i64::MAX - 2,
            i64::MAX,
            "range-evidence-ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            TrainingSessionRangeAuthorship::User,
            TrainingSessionRangeState::Current,
            7,
        )
        .expect("summary range");
        let location = |ordinal, elapsed| TrainingRangeEvidenceLocation {
            kind: TrainingRangeExactEvidenceKind::RoutePoint,
            evidence_ref: route_ref.to_owned(),
            ordinal: Some(ordinal),
            elapsed_milliseconds: elapsed,
        };
        let summary = TrainingSessionRangeSummary {
            snapshot_ref: query.snapshot_ref,
            session_ref: query.session_ref,
            evidence_revision:
                "range-evidence-ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
                    .to_owned(),
            source_provider: TrainingSourceProviderView::restore("synthetic-provider".to_owned())
                .expect("summary provider"),
            range,
            exercise: Some(PersistedTrainingRangeSummaryExercise {
                exercise_ref:
                    "exercise-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
                        .to_owned(),
                ordinal: 0,
                duration_milliseconds: i64::MAX,
                distance_meters: Some(10_000.0),
                sport: TrainingSessionSport {
                    sport_ref: None,
                    state: TrainingSportState::Unavailable,
                    classification: None,
                    recognition: None,
                    recognition_candidate_count: 0,
                },
                source_ranges: Vec::new(),
                route_coordinate_count: 1,
                signal_coordinate_count: 2,
            }),
            coordinate_evidence: TrainingRangeCoordinateEvidence::Route {
                route_ref: route_ref.to_owned(),
                kind: TrainingRouteKindView::Primary,
            },
            elapsed_duration_milliseconds: 2,
            moving_duration_milliseconds: None,
            paused_duration_milliseconds: None,
            distance: Some(TrainingRangeDistanceSummary {
                meters: 123.5,
                coverage: TrainingRangeMetricCoverage::Complete,
            }),
            direction: Some(TrainingRangeDirectionSummary {
                initial_bearing_degrees: 90.0,
                cardinal: TrainingRangeCardinalDirection::East,
            }),
            measurements: vec![TrainingRangeMeasurementSummary {
                kind: TrainingSignalKindView::Altitude,
                unit: TrainingSignalUnitView::Meters,
                minimum: 10.0,
                maximum: 12.0,
                average: 11.0,
                available_evidence_count: 2,
                missing_evidence_count: 0,
                start_boundary_value: Some(10.0),
                end_boundary_value: Some(12.0),
            }],
            boundaries: TrainingRangeBoundaryPair {
                start: TrainingRangeBoundaryEvidence {
                    elapsed_milliseconds: i64::MAX - 2,
                    state: TrainingRangeBoundaryEvidenceState::Exact,
                    exact_match_count: 1,
                    exact_matches: vec![location(0, i64::MAX - 2)],
                    preceding: None,
                    following: None,
                },
                end: TrainingRangeBoundaryEvidence {
                    elapsed_milliseconds: i64::MAX,
                    state: TrainingRangeBoundaryEvidenceState::Exact,
                    exact_match_count: 1,
                    exact_matches: vec![location(1, i64::MAX)],
                    preceding: None,
                    following: None,
                },
            },
            coverage: TrainingRangeEvidenceCoverage {
                state: TrainingRangeSummaryCoverageState::Complete,
                recorded_evidence_count: 2,
                selected_evidence_count: 2,
                available_evidence_count: 2,
                missing_evidence_count: 0,
                missing_elapsed_evidence_count: 0,
                missing_intervals: Vec::new(),
                omitted_missing_interval_count: 0,
            },
            source_ranges: Vec::new(),
            independent_evidence: TrainingRangeIndependentEvidence {
                source_range_count: 0,
                route_coordinate_count: 1,
                signal_coordinate_count: 2,
            },
            limitations: vec![
                TrainingRangeSummaryLimitation::MovingTimeUnavailable,
                TrainingRangeSummaryLimitation::PausedTimeUnavailable,
                TrainingRangeSummaryLimitation::UnalignedSignalEvidence,
            ],
        };
        let json = serde_json::to_value(TrainingSessionRangeSummaryDto::from(summary))
            .expect("range summary JSON");

        assert_eq!(json["sourceProvider"], "synthetic-provider");
        assert_eq!(json["elapsedDurationMilliseconds"], "2");
        assert_eq!(json["movingDurationMilliseconds"], serde_json::Value::Null);
        assert_eq!(
            json["coordinateEvidence"],
            serde_json::json!({
                "scope": "route-elapsed",
                "routeRef": route_ref,
                "kind": "primary"
            })
        );
        assert_eq!(
            json["boundaries"]["start"]["elapsedMilliseconds"],
            (i64::MAX - 2).to_string()
        );
        assert_eq!(json["boundaries"]["end"]["state"], "exact");
        assert_eq!(json["distance"]["coverage"], "complete");
        assert_eq!(json["direction"]["cardinal"], "east");
        assert_eq!(json["measurements"][0]["kind"], "altitude");
        assert_eq!(json["independentEvidence"]["signalCoordinateCount"], 2);
        assert_eq!(
            json["limitations"],
            serde_json::json!([
                "moving-time-unavailable",
                "paused-time-unavailable",
                "unaligned-signal-evidence"
            ])
        );
        assert!(json.to_string().find("originId").is_none());
        assert!(json.to_string().find("seriesId").is_none());
    }

    #[test]
    fn serializes_sleep_overview_comparison_and_detail_without_losing_exact_values() {
        let summary = SleepSeriesSummary {
            calendar_days: 2,
            observed_nights: 1,
            missing_nights: 1,
            total_asleep_milliseconds: Some(9_223_372_036_854_775_808),
            average_asleep_milliseconds: Some(9_223_372_036_854_775_808),
            total_interruption_milliseconds: Some(1_800_000),
            average_interruption_milliseconds: Some(1_800_000),
            average_efficiency_percent: Some(92.5),
            phase_night_count: 1,
            phase_totals: Some(SleepPhaseTotals {
                wake_milliseconds: 1_800_000,
                rem_milliseconds: 5_400_000,
                light_milliseconds: 12_600_000,
                deep_milliseconds: 5_400_000,
                unrecognized_milliseconds: 0,
            }),
            stage_timeline_night_count: 1,
            score_night_count: 1,
            average_overall_score: Some(82.0),
            goal_night_count: 1,
            goal_met_night_count: 0,
            power_status_night_count: 1,
            power_loss_night_count: 0,
        };
        let period = SleepPeriodInsight {
            started_at: "2026-01-01T22:30:00+01:00".to_owned(),
            ended_at: "2026-01-02T05:30:00+01:00".to_owned(),
            span_milliseconds: i64::MAX,
            asleep_milliseconds: i64::MAX - 1,
            interruption_milliseconds: 1,
            long_interruption_milliseconds: 1,
            short_interruption_milliseconds: 0,
            interruption_count: 1,
            long_interruption_count: 1,
            short_interruption_count: 0,
            efficiency_percent: 92.5,
            continuity_index: 4.2,
            continuity_class: 4,
            sleep_goal_milliseconds: Some(i64::MAX),
            self_reported_rating: Some(4),
            cycle_count: Some(4),
            recording_ended_by_power_loss: Some(false),
            phase_summary: None,
            stage_timeline_available: true,
            score_overall: Some(82.0),
            score_relative_rating: Some(4),
        };
        let range = Some(SleepDateRange {
            from: "2026-01-01".to_owned(),
            through: "2026-01-02".to_owned(),
        });
        let overview = SleepOverview {
            available_range: range.clone(),
            selected_range: range.clone(),
            series: vec![SleepSeriesOverview {
                series_ref: "synthetic-origin".to_owned(),
                summary: summary.clone(),
                days: vec![
                    SleepDayInsight {
                        sleep_date: "2026-01-01".to_owned(),
                        availability: SleepDayAvailability::Available,
                        period: Some(period),
                    },
                    SleepDayInsight {
                        sleep_date: "2026-01-02".to_owned(),
                        availability: SleepDayAvailability::Missing,
                        period: None,
                    },
                ],
            }],
        };
        let comparison = SleepComparison {
            available_range: range.clone(),
            baseline_range: range.clone(),
            comparison_range: range,
            series: vec![SleepSeriesComparison {
                series_ref: "synthetic-origin".to_owned(),
                baseline: summary.clone(),
                comparison: summary,
                observed_night_change: -9_223_372_036_854_775_808,
                missing_night_change: 9_223_372_036_854_775_808,
                average_asleep_milliseconds_change: Some(-9_223_372_036_854_775_808),
                average_interruption_milliseconds_change: Some(9_223_372_036_854_775_808),
                average_efficiency_percentage_point_change: Some(2.5),
                average_overall_score_change: None,
                goal_met_percentage_point_change: Some(-50.0),
            }],
        };
        let detail = SleepPeriodDetail {
            sleep_date: "2026-01-01".to_owned(),
            started_at: "2026-01-01T22:30:00+01:00".to_owned(),
            ended_at: "2026-01-02T05:30:00+01:00".to_owned(),
            span_milliseconds: i64::MAX,
            asleep_milliseconds: i64::MAX - 1,
            interruption_milliseconds: 1,
            long_interruption_milliseconds: 1,
            short_interruption_milliseconds: 0,
            interruption_count: 1,
            long_interruption_count: 1,
            short_interruption_count: 0,
            efficiency_percent: 92.5,
            continuity_index: 4.2,
            continuity_class: 4,
            sleep_goal_milliseconds: Some(i64::MAX),
            self_reported_rating: Some(4),
            cycle_count: Some(4),
            recording_ended_by_power_loss: Some(false),
            phase_summary: None,
            stage_transitions: Some(vec![SleepStageTransition {
                offset_milliseconds: i64::MAX,
                stage: SleepStage::Deep,
            }]),
            score: Some(SleepScore {
                overall: 82.0,
                own_target_duration: 75.0,
                recommended_duration: 80.0,
                continuity: 84.0,
                efficiency: 90.0,
                rem: 81.0,
                deep: 78.0,
                long_interruptions: 88.0,
                duration: 79.0,
                solidity: 87.0,
                regeneration: 83.0,
                relative_rating: Some(4),
            }),
        };

        let overview_json =
            serde_json::to_value(SleepOverviewDto::from(overview)).expect("sleep JSON");
        let comparison_json = serde_json::to_value(SleepComparisonDto::from(comparison))
            .expect("sleep comparison JSON");
        let detail_json =
            serde_json::to_value(SleepPeriodDetailDto::from(detail)).expect("sleep detail JSON");

        assert_eq!(
            overview_json["series"][0]["summary"]["totalAsleepMilliseconds"],
            "9223372036854775808"
        );
        assert_eq!(
            overview_json["series"][0]["days"][0]["period"]["spanMilliseconds"],
            "9223372036854775807"
        );
        assert_eq!(
            overview_json["series"][0]["days"][0]["period"]["cycleCount"],
            "4"
        );
        assert_eq!(
            overview_json["series"][0]["days"][1],
            serde_json::json!({
                "sleepDate": "2026-01-02",
                "availability": "missing",
                "period": null
            })
        );
        assert_eq!(
            comparison_json["series"][0]["averageAsleepMillisecondsChange"],
            "-9223372036854775808"
        );
        assert_eq!(
            comparison_json["series"][0]["averageInterruptionMillisecondsChange"],
            "9223372036854775808"
        );
        assert_eq!(
            detail_json["stageTransitions"][0],
            serde_json::json!({
                "offsetMilliseconds": "9223372036854775807",
                "stage": "deep"
            })
        );
        assert_eq!(detail_json["score"]["overall"], 82.0);
        assert_eq!(detail_json["cycleCount"], "4");
        assert_eq!(
            serde_json::to_value(CommandErrorDto::from(ApplicationError::InvalidSleepRange(
                "synthetic"
            )))
            .expect("sleep range error")["code"],
            "invalid-sleep-range"
        );
        assert_eq!(
            serde_json::to_value(CommandErrorDto::from(
                ApplicationError::InvalidSleepReference("synthetic")
            ))
            .expect("sleep reference error")["code"],
            "invalid-sleep-reference"
        );
    }

    #[test]
    fn serializes_family_coverage_as_stable_privacy_safe_codes() {
        let outcome = ImportOutcome {
            operation_ref: "synthetic-operation".to_owned(),
            state: ImportOperationState::Completed,
            source_provider: "polar-flow".to_owned(),
            source_adapter_version: "polar-flow-archive@3".to_owned(),
            mapping_version: "polar-flow-daily-activity@1".to_owned(),
            exact_repeat: false,
            coverage_complete: true,
            coverage: ArtifactCoverageSummary {
                total: 2,
                supported: 1,
                unsupported: 0,
                deliberately_ignored: 0,
                unrecognized: 1,
                invalid: 0,
            },
            artifact_families: vec![
                ArtifactFamilyCoverage {
                    family_code: None,
                    classification: ArtifactClassification::Unrecognized,
                    reason_code: "unrecognized-artifact-family".to_owned(),
                    artifact_count: 1,
                },
                ArtifactFamilyCoverage {
                    family_code: Some("polar-flow-daily-activity".to_owned()),
                    classification: ArtifactClassification::Supported,
                    reason_code: "mapped".to_owned(),
                    artifact_count: 1,
                },
            ],
            report: ImportReport::assessed(),
            canonical_history_changed: true,
            terminal_code: None,
            recovery_note: None,
        };

        let json = serde_json::to_value(ImportOutcomeDto::from(outcome)).expect("outcome JSON");

        assert_eq!(
            json["artifactFamilies"],
            serde_json::json!([
                {
                    "familyCode": null,
                    "classification": "unrecognized",
                    "reasonCode": "unrecognized-artifact-family",
                    "artifactCount": 1
                },
                {
                    "familyCode": "polar-flow-daily-activity",
                    "classification": "supported",
                    "reasonCode": "mapped",
                    "artifactCount": 1
                }
            ])
        );
    }

    #[test]
    fn serializes_the_library_home_as_stable_provider_neutral_codes() {
        let home = LibraryHome {
            version: 5,
            library_revision_ref: "library-home-revision-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".to_owned(),
            recorded_range: Some(LibraryHomeDateRange {
                from: "2025-12-31".to_owned(),
                through: "2026-01-06".to_owned(),
            }),
            usable_range: Some(LibraryHomeDateRange {
                from: "2025-12-31".to_owned(),
                through: "2026-01-06".to_owned(),
            }),
            primary_range: Some(LibraryHomePrimaryRange {
                scope: LibraryHomeRangeScope::Training,
                range: LibraryHomeDateRange {
                    from: "2026-01-04".to_owned(),
                    through: "2026-01-05".to_owned(),
                },
            }),
            domains: vec![LibraryDomainCoverage {
                domain: LibraryDomain::Training,
                recorded_range: Some(LibraryHomeDateRange {
                    from: "2026-01-04".to_owned(),
                    through: "2026-01-05".to_owned(),
                }),
                usable_range: Some(LibraryHomeDateRange {
                    from: "2026-01-04".to_owned(),
                    through: "2026-01-05".to_owned(),
                }),
                selected_range: Some(LibraryHomeDateRange {
                    from: "2026-01-04".to_owned(),
                    through: "2026-01-05".to_owned(),
                }),
                origin_count: 1,
                observed_record_count: 2,
                measurements: vec![LibraryMeasurementCoverage::new(
                    LibraryMeasurement::TrainingDistance,
                    1,
                    2,
                )],
            }],
            questions: vec![LibraryQuestion::new(
                LibraryQuestionKind::ExploreTrainingSessions,
                ExploreDestination::Training,
            )],
            training: Some(LibraryHomeTraining {
                training_snapshot_ref: "training-snapshot-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb".to_owned(),
                session_count: 2,
                sport_profile_count: 1,
                omitted_sport_profile_count: 0,
                sports: vec![LibraryHomeSportSummary {
                    sport_ref: Some("sport-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd".to_owned()),
                    state: TrainingSportState::PersonallyOverridden,
                    canonical_family: Some("running".to_owned()),
                    display_label: Some("Trail running".to_owned()),
                    localized_names: BTreeMap::new(),
                    recognition_candidate_count: 0,
                    profile_count: 1,
                    session_count: 2,
                }],
                recent_sessions: vec![LibraryHomeRecentSession {
                    session_ref: "session-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc".to_owned(),
                    sport_ref: Some("sport-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd".to_owned()),
                    started_at_local: "2026-01-05T08:00:00".to_owned(),
                    duration_milliseconds: 3_600_000,
                    distance_meters: Some(10_000.5),
                    sport_state: TrainingSportState::PersonallyOverridden,
                    canonical_family: Some("running".to_owned()),
                    display_label: Some("Trail running".to_owned()),
                    localized_names: BTreeMap::new(),
                    recognition_candidate_count: 0,
                }],
            }),
            highlight: Some(LibraryHomeHighlight::RecentTrainingComparison(
                LibraryHomeTrainingComparison {
                    reference_date: "2026-01-06".to_owned(),
                    baseline: LibraryHomeTrainingPeriod {
                        range: LibraryHomeDateRange {
                            from: "2025-12-24".to_owned(),
                            through: "2025-12-30".to_owned(),
                        },
                        session_count: 1,
                        total_duration_milliseconds: 3_000_000,
                    },
                    comparison: LibraryHomeTrainingPeriod {
                        range: LibraryHomeDateRange {
                            from: "2025-12-31".to_owned(),
                            through: "2026-01-06".to_owned(),
                        },
                        session_count: 2,
                        total_duration_milliseconds: 7_200_000,
                    },
                    session_count_change: 1,
                    duration_change_milliseconds: 4_200_000,
                },
            )),
            post_import: Some(PostImportReveal {
                exact_repeat: false,
                canonical_history_changed: true,
                new_observations: 2,
                enriched_observations: 0,
                amended_observations: 0,
                unchanged_observations: 3,
                source_review_recommended: true,
            }),
            resumable_exploration: Some(ExplorationWorkspace {
                version: 1,
                destination: ExploreDestination::Training,
            }),
        };

        let json = serde_json::to_value(LibraryHomeDto::from(home)).expect("library home JSON");

        assert_eq!(
            json,
            serde_json::json!({
                "version": 5,
                "libraryRevisionRef": "library-home-revision-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "recordedRange": { "from": "2025-12-31", "through": "2026-01-06" },
                "usableRange": { "from": "2025-12-31", "through": "2026-01-06" },
                "primaryRange": {
                    "scope": "training",
                    "range": { "from": "2026-01-04", "through": "2026-01-05" }
                },
                "domains": [{
                    "domain": "training",
                    "recordedRange": { "from": "2026-01-04", "through": "2026-01-05" },
                    "usableRange": { "from": "2026-01-04", "through": "2026-01-05" },
                    "selectedRange": { "from": "2026-01-04", "through": "2026-01-05" },
                    "originCount": 1,
                    "observedRecordCount": 2,
                    "measurements": [{
                        "measurement": "training-distance",
                        "availableRecords": 1,
                        "observedRecords": 2
                    }]
                }],
                "questions": [{
                    "kind": "explore-training-sessions",
                    "destination": "training"
                }],
                "training": {
                    "trainingSnapshotRef": "training-snapshot-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    "sessionCount": 2,
                    "sportProfileCount": 1,
                    "omittedSportProfileCount": 0,
                    "sports": [{
                        "sportRef": "sport-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
                        "state": "personally-overridden",
                        "canonicalFamily": "running",
                        "displayLabel": "Trail running",
                        "localizedNames": {},
                        "recognitionCandidateCount": 0,
                        "profileCount": 1,
                        "sessionCount": 2
                    }],
                    "recentSessions": [{
                        "sessionRef": "session-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                        "sportRef": "sport-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
                        "startedAtLocal": "2026-01-05T08:00:00",
                        "durationMilliseconds": "3600000",
                        "distanceMeters": 10000.5,
                        "sportState": "personally-overridden",
                        "canonicalFamily": "running",
                        "displayLabel": "Trail running",
                        "localizedNames": {},
                        "recognitionCandidateCount": 0
                    }]
                },
                "highlight": {
                    "kind": "recent-training-comparison",
                    "referenceDate": "2026-01-06",
                    "baseline": {
                        "range": { "from": "2025-12-24", "through": "2025-12-30" },
                        "sessionCount": 1,
                        "totalDurationMilliseconds": "3000000"
                    },
                    "comparison": {
                        "range": { "from": "2025-12-31", "through": "2026-01-06" },
                        "sessionCount": 2,
                        "totalDurationMilliseconds": "7200000"
                    },
                    "sessionCountChange": "1",
                    "durationChangeMilliseconds": "4200000"
                },
                "postImport": {
                    "exactRepeat": false,
                    "canonicalHistoryChanged": true,
                    "newObservations": 2,
                    "enrichedObservations": 0,
                    "amendedObservations": 0,
                    "unchangedObservations": 3,
                    "sourceReviewRecommended": true
                },
                "resumableExploration": {
                    "version": 1,
                    "destination": "training"
                }
            })
        );

        let request: LibraryHomeRequestDto = serde_json::from_value(serde_json::json!({
            "afterImportOperationRef": "synthetic-operation"
        }))
        .expect("library home request");
        assert_eq!(
            LibraryHomeRequest::from(request),
            LibraryHomeRequest {
                after_import_operation_ref: Some("synthetic-operation".to_owned()),
            }
        );
        assert!(
            serde_json::from_value::<LibraryHomeRequestDto>(serde_json::json!({
                "afterImportOperationRef": null,
                "provider": "must-not-cross-the-boundary"
            }))
            .is_err()
        );
        assert!(matches!(
            serde_json::from_value::<ExploreDestinationInputDto>(serde_json::json!("recovery"))
                .expect("exploration destination"),
            ExploreDestinationInputDto::Recovery
        ));
        assert!(
            serde_json::from_value::<ExploreDestinationInputDto>(serde_json::json!(
                "provider-route"
            ))
            .is_err()
        );
    }

    #[test]
    fn serializes_the_result_first_report_library_without_precision_loss() {
        let request: ReportLibraryRequestDto = from_value(json!({
            "offset": 0,
            "limit": 12
        }))
        .expect("report library request");
        let request = ReportLibraryRequest::from(request);
        assert_eq!(request.offset, 0);
        assert_eq!(request.limit, 12);
        assert!(from_value::<ReportLibraryRequestDto>(json!({
            "offset": 0,
            "limit": 12,
            "provider": "must-not-cross-the-boundary"
        }))
        .is_err());

        let page = ReportLibraryPage {
            items: vec![ReportLibraryItem {
                report_ref:
                    "report-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
                        .to_owned(),
                title: "Morning evidence".to_owned(),
                locale: ReportLocale::EnUs,
                source_snapshot_ref:
                    "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                        .to_owned(),
                revision: 2,
                evidence_state: ReportLibraryEvidenceState::Current,
                subject: ReportLibrarySubject::Session {
                    sport: Box::new(TrainingSessionSport {
                        sport_ref: None,
                        state: TrainingSportState::Unavailable,
                        classification: None,
                        recognition: None,
                        recognition_candidate_count: 0,
                    }),
                },
                period: Some(ReportLibraryPeriod::Session {
                    started_at_local: "2026-08-18T07:30:00.000".to_owned(),
                }),
                result: Some(ReportLibraryResult::Session {
                    metric: ReportTrainingMetric::Duration,
                    value: ReportLibraryMetricValue::Integer(i128::MAX),
                }),
                sensitivity: ReportLibrarySensitivity {
                    includes_physiological_context: true,
                    precise_location_block_count: 1,
                    minimum_endpoint_redaction_meters: Some(200),
                },
            }],
            total_count: 1,
            offset: 0,
            limit: 12,
            next_offset: None,
        };
        let value = to_value(ReportLibraryPageDto::from(page)).expect("report library response");
        assert_eq!(value["items"][0]["evidenceState"], "current");
        assert_eq!(value["items"][0]["subject"]["kind"], "session");
        assert_eq!(
            value["items"][0]["period"]["startedAtLocal"],
            "2026-08-18T07:30:00.000"
        );
        assert!(value["items"][0]["period"]
            .get("started_at_local")
            .is_none());
        assert_eq!(value["items"][0]["result"]["metric"], "duration");
        assert_eq!(
            value["items"][0]["result"]["value"]["value"],
            i128::MAX.to_string()
        );
        assert_eq!(
            value["items"][0]["sensitivity"]["preciseLocationBlockCount"],
            1
        );
        assert_eq!(value["nextOffset"], json!(null));

        let comparison = to_value(ReportLibraryResultDto::from(
            ReportLibraryResult::TrainingComparison {
                metric: ReportTrainingMetric::Distance,
                series: Vec::new(),
                omitted_source_count: 2,
            },
        ))
        .expect("comparison report library result");
        assert_eq!(comparison["omittedSourceCount"], 2);
        assert!(comparison.get("omitted_source_count").is_none());
    }

    #[test]
    fn validates_report_mutation_and_export_transport_boundaries() {
        let create: CreateSessionReportRequestDto =
            from_value(json!({
                "title": "Morning progression",
                "locale": "en-US",
                "sessionRef":
                    "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "sourceSnapshotRef":
                    "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "includePhysiologicalContext": true,
                "narrative": "The final section felt controlled."
            }))
            .expect("report creation request");
        let create = CreateSessionReportRequest::try_from(create).expect("valid creation");
        assert_eq!(create.locale, ReportLocale::EnUs);
        assert!(create.include_physiological_context);
        assert!(from_value::<CreateSessionReportRequestDto>(json!({
            "title": "Morning progression",
            "locale": "en-GB",
            "sessionRef": "session-reference",
            "sourceSnapshotRef": "snapshot-reference",
            "includePhysiologicalContext": true,
            "narrative": "Interpretation",
            "providerIdentity": "must-not-cross-the-boundary"
        }))
        .is_err());

        let update: UpdateSessionReportRequestDto = from_value(json!({
            "reportRef":
                "report-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            "expectedRevision": "2",
            "title": "Morning progression review",
            "locale": "es-ES",
            "includePhysiologicalContext": false,
            "narrative": "El tramo final se mantuvo controlado."
        }))
        .expect("report update request");
        assert_eq!(
            UpdateSessionReportRequest::try_from(update)
                .expect("valid report update")
                .expected_revision,
            2
        );
        for revision in ["0", "02", "+2", "18446744073709551616"] {
            let invalid: UpdateSessionReportRequestDto = from_value(json!({
                "reportRef":
                    "report-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                "expectedRevision": revision,
                "title": "Morning progression review",
                "locale": "es-ES",
                "includePhysiologicalContext": false,
                "narrative": "El tramo final se mantuvo controlado."
            }))
            .expect("structurally valid update request");
            assert!(UpdateSessionReportRequest::try_from(invalid).is_err());
        }

        let refresh: RefreshReportRequestDto = from_value(json!({
            "reportRef":
                "report-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            "expectedRevision": "2",
            "expectedSourceSnapshotRef":
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "expectedResolvedSnapshotRef":
                "training-snapshot-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
        }))
        .expect("report refresh request");
        let refresh = RefreshReportRequest::try_from(refresh).expect("valid report refresh");
        assert_eq!(refresh.expected_revision, 2);
        assert_eq!(
            refresh.expected_resolved_snapshot_ref,
            "training-snapshot-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
        );
        assert!(from_value::<RefreshReportRequestDto>(json!({
            "reportRef":
                "report-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            "expectedRevision": "2",
            "expectedSourceSnapshotRef":
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "expectedResolvedSnapshotRef":
                "training-snapshot-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
            "provider": "must-not-cross-the-boundary"
        }))
        .is_err());

        let removal: RemoveReportRequestDto = from_value(json!({
            "reportRef":
                "report-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            "expectedRevision": "2"
        }))
        .expect("report removal request");
        let removal = RemoveReportRequest::try_from(removal).expect("valid report removal");
        assert_eq!(removal.expected_revision, 2);
        assert!(from_value::<RemoveReportRequestDto>(json!({
            "reportRef":
                "report-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            "expectedRevision": "2",
            "provider": "must-not-cross-the-boundary"
        }))
        .is_err());
        assert_eq!(
            to_value(RemovedReportDto::from(RemovedReport {
                report_ref:
                    "report-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
                        .to_owned(),
                title: "Morning evidence".to_owned(),
                revision: 2,
            }))
            .expect("removed report response"),
            json!({
                "reportRef":
                    "report-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                "title": "Morning evidence",
                "revision": "2"
            })
        );

        let export: SessionReportExportRequestDto =
            from_value(json!({
                "reportRef":
                    "report-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                "expectedRevision": "2",
                "expectedSourceSnapshotRef":
                    "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "includePhysiologicalContext": false,
                "destinationPath": "/private/synthetic/report.html"
            }))
            .expect("report export request");
        assert_eq!(
            ReportExportRequest::try_from(export)
                .expect("valid export")
                .destination,
            PathBuf::from("/private/synthetic/report.html")
        );
        for destination_path in ["", "relative/report.html", "/"] {
            let invalid: SessionReportExportRequestDto =
                from_value(json!({
                    "reportRef":
                        "report-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                    "expectedRevision": "2",
                    "expectedSourceSnapshotRef":
                        "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    "includePhysiologicalContext": false,
                    "destinationPath": destination_path
                }))
                .expect("structurally valid export request");
            assert!(ReportExportRequest::try_from(invalid).is_err());
        }
    }

    #[test]
    fn validates_and_serializes_every_report_start_origin_without_provider_identity() {
        let query = json!({
            "question": "training-period-comparison",
            "questionVersion": 1,
            "baselineRange": { "from": "2026-01-01", "through": "2026-01-31" },
            "comparisonRange": { "from": "2026-02-01", "through": "2026-02-28" }
        });
        let question: ReportStartDto = from_value(json!({
            "kind": "question",
            "question": "training-period-comparison",
            "questionVersion": 1
        }))
        .expect("question start");
        assert!(matches!(
            ReportStart::try_from(question).expect("valid question start"),
            ReportStart::Question {
                question: ReportQuestion::TrainingPeriodComparisonV1
            }
        ));
        let exploration: ReportStartDto = from_value(json!({
            "kind": "exploration",
            "query": query
        }))
        .expect("exploration start");
        assert!(matches!(
            ReportStart::try_from(exploration).expect("valid exploration start"),
            ReportStart::Exploration { query }
                if query.comparison_range().through() == "2026-02-28"
        ));
        let blank: ReportStartDto = from_value(json!({ "kind": "blank" })).expect("blank start");
        assert_eq!(
            ReportStart::try_from(blank).expect("valid blank start"),
            ReportStart::Blank
        );

        let create: CreateReportRequestDto = from_value(json!({
            "title": "Reusable notes",
            "locale": "en-US",
            "sourceSnapshotRef":
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "origin": { "kind": "blank" },
            "blocks": [{
                "kind": "narrative",
                "blockRef": null,
                "body": "My own interpretation."
            }]
        }))
        .expect("blank report request");
        let create = CreateReportRequest::try_from(create).expect("valid blank report request");
        assert_eq!(create.origin, ReportOrigin::Blank);
        assert!(from_value::<ReportStartDto>(json!({
            "kind": "question",
            "question": "training-period-comparison",
            "questionVersion": 2
        }))
        .is_ok_and(|start| ReportStart::try_from(start).is_err()));
        assert!(from_value::<CreateReportRequestDto>(json!({
            "title": "Reusable notes",
            "locale": "en-US",
            "sourceSnapshotRef": "training-snapshot-reference",
            "origin": { "kind": "blank", "provider": "must-not-cross-the-boundary" },
            "blocks": []
        }))
        .is_err());
    }

    #[test]
    fn validates_and_serializes_training_comparison_report_blocks_without_losing_the_query() {
        let query = json!({
            "question": "training-period-comparison",
            "questionVersion": 1,
            "baselineRange": { "from": "2026-01-01", "through": "2026-01-31" },
            "comparisonRange": { "from": "2026-02-01", "through": "2026-02-28" }
        });
        let request: CreateComposedSessionReportRequestDto = from_value(json!({
            "title": "Winter training comparison",
            "locale": "en-US",
            "sessionRef":
                "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "sourceSnapshotRef":
                "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "blocks": [
                {
                    "kind": "session-evidence",
                    "blockRef": null,
                    "includePhysiologicalContext": false
                },
                {
                    "kind": "narrative",
                    "blockRef": null,
                    "body": "A comparison grounded in the selected periods."
                },
                {
                    "kind": "training-finding",
                    "blockRef": null,
                    "query": query,
                    "metric": "session-count"
                },
                {
                    "kind": "training-comparison",
                    "blockRef": null,
                    "query": query
                },
                {
                    "kind": "training-chart",
                    "blockRef": null,
                    "query": query,
                    "metric": "duration"
                },
                {
                    "kind": "training-exact-table",
                    "blockRef": null,
                    "query": query
                },
                {
                    "kind": "training-coverage",
                    "blockRef": null,
                    "query": query
                }
            ]
        }))
        .expect("training comparison report request");

        let request = CreateComposedSessionReportRequest::try_from(request)
            .expect("valid training comparison report request");
        assert_eq!(request.blocks.len(), 7);
        assert!(matches!(
            &request.blocks[2].content,
            SessionReportBlockDraftContent::TrainingFinding {
                query,
                metric: ReportTrainingMetric::SessionCount
            } if query.baseline_range().from() == "2026-01-01"
                && query.comparison_range().through() == "2026-02-28"
        ));

        let report_query = ReportTrainingComparisonQuery::restore(
            "training-period-comparison",
            1,
            ReportDateRange::new("2026-01-01", "2026-01-31").expect("baseline range"),
            ReportDateRange::new("2026-02-01", "2026-02-28").expect("comparison range"),
        )
        .expect("training comparison query");
        let session_ref =
            "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
        let definition = ReportDefinition::compose_session_report(
            "report-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            "Winter training comparison",
            ReportLocale::EnUs,
            "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            session_ref,
            vec![
                ReportBlock::session_evidence(
                    "report-block-1111111111111111111111111111111111111111111111111111111111111111",
                    session_ref,
                    false,
                )
                .expect("session block"),
                ReportBlock::narrative(
                    "report-block-2222222222222222222222222222222222222222222222222222222222222222",
                    "A comparison grounded in the selected periods.",
                )
                .expect("narrative block"),
                ReportBlock::training_finding(
                    "report-block-3333333333333333333333333333333333333333333333333333333333333333",
                    report_query.clone(),
                    ReportTrainingMetric::SessionCount,
                )
                .expect("finding block"),
                ReportBlock::training_comparison(
                    "report-block-4444444444444444444444444444444444444444444444444444444444444444",
                    report_query.clone(),
                )
                .expect("comparison block"),
                ReportBlock::training_chart(
                    "report-block-5555555555555555555555555555555555555555555555555555555555555555",
                    report_query.clone(),
                    ReportTrainingMetric::Duration,
                )
                .expect("chart block"),
                ReportBlock::training_exact_table(
                    "report-block-6666666666666666666666666666666666666666666666666666666666666666",
                    report_query.clone(),
                )
                .expect("table block"),
                ReportBlock::training_coverage(
                    "report-block-7777777777777777777777777777777777777777777777777777777777777777",
                    report_query,
                )
                .expect("coverage block"),
            ],
        )
        .expect("analytical report definition");
        let definition_json =
            serde_json::to_value(ReportDefinitionDto::from(definition)).expect("definition JSON");
        assert_eq!(definition_json["definitionVersion"], 4);
        assert_eq!(
            definition_json["blocks"][2],
            json!({
                "kind": "training-finding",
                "blockRef":
                    "report-block-3333333333333333333333333333333333333333333333333333333333333333",
                "query": query,
                "metric": "session-count"
            })
        );
        assert_eq!(
            definition_json["blocks"][6]["query"]["question"],
            "training-period-comparison"
        );
    }

    #[test]
    fn rejects_noncanonical_training_comparison_report_queries_at_the_transport_boundary() {
        let valid_query = json!({
            "question": "training-period-comparison",
            "questionVersion": 1,
            "baselineRange": { "from": "2026-01-01", "through": "2026-01-31" },
            "comparisonRange": { "from": "2026-02-01", "through": "2026-02-28" }
        });
        let block = |query: serde_json::Value, metric: serde_json::Value| {
            json!({
                "kind": "training-finding",
                "blockRef": null,
                "query": query,
                "metric": metric
            })
        };

        let mut unsupported_question = valid_query.clone();
        unsupported_question["question"] = json!("provider-workout-comparison");
        let mut unsupported_version = valid_query.clone();
        unsupported_version["questionVersion"] = json!(2);
        let mut invalid_date = valid_query.clone();
        invalid_date["baselineRange"]["from"] = json!("2026-02-30");
        let mut reversed_range = valid_query.clone();
        reversed_range["comparisonRange"]["from"] = json!("2026-03-01");
        let mut unknown_query_field = valid_query.clone();
        unknown_query_field["provider"] = json!("must-not-cross-the-boundary");

        for invalid_block in [
            block(unsupported_question, json!("session-count")),
            block(unsupported_version, json!("session-count")),
            block(invalid_date, json!("session-count")),
            block(reversed_range, json!("session-count")),
            block(valid_query.clone(), json!("pace")),
        ] {
            let dto: SessionReportBlockDraftDto =
                from_value(invalid_block).expect("structurally valid report block");
            assert!(SessionReportBlockDraft::try_from(dto).is_err());
        }
        assert!(from_value::<SessionReportBlockDraftDto>(block(
            unknown_query_field,
            json!("session-count")
        ))
        .is_err());
    }
}
