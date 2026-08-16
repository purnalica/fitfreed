use serde::Serialize;

use fitfreed_application::{ApplicationError, ImportPhase, ImportProgress};
use fitfreed_domain::{ArtifactCoverageSummary, DailyActivity, ImportOutcome, ImportReport};

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
            ApplicationError::OutcomeQuery(_) => "outcome-query-failed",
        };
        Self::new(code)
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyActivityDto {
    origin_id: String,
    local_date: String,
    step_count: Option<i64>,
}

impl From<DailyActivity> for DailyActivityDto {
    fn from(activity: DailyActivity) -> Self {
        Self {
            origin_id: activity.origin_id,
            local_date: activity.local_date,
            step_count: activity.step_count,
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
pub struct ImportOutcomeDto {
    operation_ref: String,
    state: String,
    source_provider: String,
    source_adapter_version: String,
    mapping_version: String,
    exact_repeat: bool,
    coverage_complete: bool,
    coverage: ArtifactCoverageSummaryDto,
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
