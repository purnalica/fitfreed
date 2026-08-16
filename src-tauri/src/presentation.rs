use serde::{Deserialize, Serialize};

use fitfreed_application::{
    ActivityComparison, ActivityDateRange, ActivityDayAvailability, ActivityDayInsight,
    ActivityOverview, ActivitySeriesComparison, ActivitySeriesOverview, ActivitySeriesSummary,
    ApplicationError, ImportPhase, ImportProgress, TrainingComparison, TrainingDateRange,
    TrainingOverview, TrainingSeriesComparison, TrainingSeriesOverview, TrainingSeriesSummary,
    TrainingSessionInsight,
};
use fitfreed_domain::{
    ArtifactCoverageSummary, ArtifactFamilyCoverage, ImportOutcome, ImportReport,
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
            ApplicationError::OutcomeQuery(_) => "outcome-query-failed",
            ApplicationError::PreferenceQuery(_) => "preference-query-failed",
            ApplicationError::PreferenceUpdate(_) => "preference-update-failed",
        };
        Self::new(code)
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
    use fitfreed_domain::{ArtifactClassification, ArtifactFamilyCoverage, ImportOperationState};

    use super::*;

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
