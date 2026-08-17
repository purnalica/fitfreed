use serde::{Deserialize, Serialize};

use fitfreed_application::{
    ActivityComparison, ActivityDateRange, ActivityDayAvailability, ActivityDayInsight,
    ActivityOverview, ActivitySeriesComparison, ActivitySeriesOverview, ActivitySeriesSummary,
    ApplicationError, ImportPhase, ImportProgress, LongitudinalActivityComparison,
    LongitudinalActivityDay, LongitudinalComparison, LongitudinalDateRange, LongitudinalDayInsight,
    LongitudinalOverview, LongitudinalRecoveryComparison, LongitudinalRecoveryDay,
    LongitudinalSeriesComparison, LongitudinalSeriesOverview, LongitudinalSleepComparison,
    LongitudinalSleepDay, LongitudinalTrainingComparison, LongitudinalTrainingDay,
    ManualUpdateReason, RecoveryComparison, RecoveryDateRange, RecoveryDayAvailability,
    RecoveryDayInsight, RecoveryNightDetail, RecoveryNightInsight, RecoveryOverview,
    RecoverySeriesComparison, RecoverySeriesOverview, RecoverySeriesSummary, SleepComparison,
    SleepDateRange, SleepDayAvailability, SleepDayInsight, SleepOverview, SleepPeriodDetail,
    SleepPeriodInsight, SleepPhaseTotals, SleepSeriesComparison, SleepSeriesOverview,
    SleepSeriesSummary, TrainingComparison, TrainingDateRange, TrainingOverview,
    TrainingSeriesComparison, TrainingSeriesOverview, TrainingSeriesSummary,
    TrainingSessionInsight, UpdateCheckOutcome, UpdateCheckStatus, UpdateError,
    UpdateReleaseSummary, UpdateTrustFailure, UpdateWithdrawalReason, UpdateWithdrawalSummary,
};
use fitfreed_domain::{
    ArtifactCoverageSummary, ArtifactFamilyCoverage, ImportOutcome, ImportReport,
    SleepPhaseSummary, SleepScore, SleepStage, SleepStageTransition,
    SourceSpecificRecoveryAssessment, SourceSpecificRecoveryBaseline,
    SourceSpecificRecoveryGuidance,
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
            ApplicationError::Coordination(_) => "import-coordination-failed",
            ApplicationError::Import(_) => "import-failed",
            ApplicationError::Query(_) => "library-query-failed",
            ApplicationError::InvalidActivityRange(_) => "invalid-activity-range",
            ApplicationError::InvalidTrainingRange(_) => "invalid-training-range",
            ApplicationError::InvalidSleepRange(_) => "invalid-sleep-range",
            ApplicationError::InvalidSleepReference(_) => "invalid-sleep-reference",
            ApplicationError::InvalidRecoveryRange(_) => "invalid-recovery-range",
            ApplicationError::InvalidRecoveryReference(_) => "invalid-recovery-reference",
            ApplicationError::InvalidLongitudinalRange(_) => "invalid-longitudinal-range",
            ApplicationError::OutcomeQuery(_) => "outcome-query-failed",
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

#[derive(Debug, Serialize)]
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

#[derive(Debug, Serialize)]
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

#[derive(Debug, Serialize)]
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
pub struct TrainingSessionInsightDto {
    session_ref: String,
    started_at_local: String,
    stopped_at_local: String,
    utc_offset_minutes: Option<i32>,
    duration_milliseconds: String,
    distance_meters: Option<f64>,
    energy_kilocalories: Option<String>,
    average_heart_rate_bpm: Option<String>,
    maximum_heart_rate_bpm: Option<String>,
    sport_ref: Option<String>,
    exercise_count: Option<usize>,
}

impl From<TrainingSessionInsight> for TrainingSessionInsightDto {
    fn from(session: TrainingSessionInsight) -> Self {
        Self {
            session_ref: session.session_ref,
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
            sport_ref: session.sport_ref,
            exercise_count: session.exercise_count,
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
pub struct TrainingSeriesOverviewDto {
    series_ref: String,
    summary: TrainingSeriesSummaryDto,
    sessions: Vec<TrainingSessionInsightDto>,
}

impl From<TrainingSeriesOverview> for TrainingSeriesOverviewDto {
    fn from(series: TrainingSeriesOverview) -> Self {
        Self {
            series_ref: series.series_ref,
            summary: series.summary.into(),
            sessions: series.sessions.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingOverviewDto {
    available_range: Option<TrainingDateRangeDto>,
    selected_range: Option<TrainingDateRangeDto>,
    series: Vec<TrainingSeriesOverviewDto>,
}

impl From<TrainingOverview> for TrainingOverviewDto {
    fn from(overview: TrainingOverview) -> Self {
        Self {
            available_range: overview.available_range.map(Into::into),
            selected_range: overview.selected_range.map(Into::into),
            series: overview.series.into_iter().map(Into::into).collect(),
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
    use fitfreed_application::{UpdateArtifact, UpdateInstallationAuthorization};
    use fitfreed_domain::{ArtifactClassification, ArtifactFamilyCoverage, ImportOperationState};

    use super::*;

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
    fn serializes_training_insights_without_losing_exact_integer_measurements() {
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
        let overview = TrainingOverview {
            available_range: Some(TrainingDateRange {
                from: "2026-01-01".to_owned(),
                through: "2026-01-02".to_owned(),
            }),
            selected_range: Some(TrainingDateRange {
                from: "2026-01-01".to_owned(),
                through: "2026-01-02".to_owned(),
            }),
            series: vec![TrainingSeriesOverview {
                series_ref: "synthetic-origin".to_owned(),
                summary: summary.clone(),
                sessions: vec![TrainingSessionInsight {
                    session_ref: "synthetic-session".to_owned(),
                    started_at_local: "2026-01-01T10:00:00".to_owned(),
                    stopped_at_local: "2026-01-01T11:00:00".to_owned(),
                    utc_offset_minutes: Some(60),
                    duration_milliseconds: i64::MAX,
                    distance_meters: Some(10_000.5),
                    energy_kilocalories: Some(i64::MAX),
                    average_heart_rate_bpm: Some(145),
                    maximum_heart_rate_bpm: Some(178),
                    sport_ref: Some("synthetic-sport".to_owned()),
                    exercise_count: Some(1),
                }],
            }],
        };
        let comparison = TrainingComparison {
            available_range: overview.available_range.clone(),
            baseline_range: overview.selected_range.clone(),
            comparison_range: overview.selected_range.clone(),
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

        let overview_json =
            serde_json::to_value(TrainingOverviewDto::from(overview)).expect("training JSON");
        let comparison_json = serde_json::to_value(TrainingComparisonDto::from(comparison))
            .expect("training comparison JSON");

        assert_eq!(
            overview_json["series"][0]["summary"]["totalDurationMilliseconds"],
            "18446744073709551614"
        );
        assert_eq!(
            overview_json["series"][0]["sessions"][0]["durationMilliseconds"],
            "9223372036854775807"
        );
        assert_eq!(
            overview_json["series"][0]["sessions"][0]["energyKilocalories"],
            "9223372036854775807"
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
}
