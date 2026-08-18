use fitfreed_domain::ImportOperationState;

use super::{
    query_activity_overview, query_recovery_overview, query_sleep_overview,
    query_training_overview, ActivityLibraryPort, ActivityOverview, ApplicationError,
    ImportOutcomeLibraryPort, RecoveryLibraryPort, RecoveryOverview, SleepLibraryPort,
    SleepOverview, TrainingLibraryPort, TrainingOverview,
};

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct LibraryHomeRequest {
    pub after_import_operation_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LibraryHomeDateRange {
    pub from: String,
    pub through: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LibraryDomain {
    Training,
    Activity,
    Sleep,
    Recovery,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LibraryMeasurement {
    TrainingDuration,
    TrainingDistance,
    TrainingEnergy,
    TrainingHeartRate,
    ActivitySteps,
    SleepDuration,
    SleepInterruptions,
    SleepEfficiency,
    SleepPhases,
    SleepStages,
    SleepScore,
    SleepGoal,
    SleepPowerStatus,
    RecoveryBeatToBeatInterval,
    RecoveryHeartRateVariability,
    RecoveryBreathingInterval,
    RecoveryAssessment,
    RecoveryBaseline,
    RecoveryGuidance,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LibraryMeasurementCoverage {
    pub measurement: LibraryMeasurement,
    pub available_records: usize,
    pub observed_records: usize,
}

impl LibraryMeasurementCoverage {
    pub const fn new(
        measurement: LibraryMeasurement,
        available_records: usize,
        observed_records: usize,
    ) -> Self {
        Self {
            measurement,
            available_records,
            observed_records,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LibraryDomainCoverage {
    pub domain: LibraryDomain,
    pub available_range: Option<LibraryHomeDateRange>,
    pub selected_range: Option<LibraryHomeDateRange>,
    pub origin_count: usize,
    pub observed_record_count: usize,
    pub measurements: Vec<LibraryMeasurementCoverage>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LibraryQuestionKind {
    ExploreTrainingSessions,
    AlignHistory,
    ReviewActivitySteps,
    ReviewSleepPatterns,
    ReviewRecoveryPatterns,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExploreDestination {
    Activity,
    Training,
    Sleep,
    Recovery,
    Longitudinal,
}

const EXPLORATION_WORKSPACE_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExplorationWorkspace {
    pub version: u32,
    pub destination: ExploreDestination,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredExplorationWorkspace {
    pub version: i64,
    pub destination: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LibraryQuestion {
    pub kind: LibraryQuestionKind,
    pub destination: ExploreDestination,
}

impl LibraryQuestion {
    pub const fn new(kind: LibraryQuestionKind, destination: ExploreDestination) -> Self {
        Self { kind, destination }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PostImportReveal {
    pub exact_repeat: bool,
    pub canonical_history_changed: bool,
    pub new_observations: usize,
    pub enriched_observations: usize,
    pub amended_observations: usize,
    pub source_review_recommended: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LibraryHome {
    pub available_range: Option<LibraryHomeDateRange>,
    pub domains: Vec<LibraryDomainCoverage>,
    pub questions: Vec<LibraryQuestion>,
    pub post_import: Option<PostImportReveal>,
    pub resumable_exploration: Option<ExplorationWorkspace>,
}

pub trait ExplorationWorkspacePort {
    fn load_exploration_workspace(&self) -> Result<Option<StoredExplorationWorkspace>, String>;
    fn save_exploration_workspace(&self, workspace: &ExplorationWorkspace) -> Result<(), String>;
    fn clear_exploration_workspace(&self) -> Result<(), String>;
}

pub trait LibraryHomePort:
    ActivityLibraryPort
    + TrainingLibraryPort
    + SleepLibraryPort
    + RecoveryLibraryPort
    + ImportOutcomeLibraryPort
    + ExplorationWorkspacePort
{
}

impl<T> LibraryHomePort for T where
    T: ActivityLibraryPort
        + TrainingLibraryPort
        + SleepLibraryPort
        + RecoveryLibraryPort
        + ImportOutcomeLibraryPort
        + ExplorationWorkspacePort
{
}

pub fn query_library_home<P>(
    port: &P,
    request: LibraryHomeRequest,
) -> Result<LibraryHome, ApplicationError>
where
    P: LibraryHomePort,
{
    validate_request(&request)?;
    let training = query_training_overview(port, None)?;
    let activity = query_activity_overview(port, None)?;
    let sleep = query_sleep_overview(port, None)?;
    let recovery = query_recovery_overview(port, None)?;

    let available_range = combined_range(&training, &activity, &sleep, &recovery);
    let domains = vec![
        training_coverage(training)?,
        activity_coverage(activity)?,
        sleep_coverage(sleep)?,
        recovery_coverage(recovery)?,
    ];
    let questions = available_questions(&domains);
    let post_import = requested_import_reveal(port, request.after_import_operation_ref.as_deref())?;
    let resumable_exploration = resumable_exploration(port, &questions)?;

    Ok(LibraryHome {
        available_range,
        domains,
        questions,
        post_import,
        resumable_exploration,
    })
}

pub fn save_exploration_workspace<P>(
    port: &P,
    destination: ExploreDestination,
) -> Result<ExplorationWorkspace, ApplicationError>
where
    P: LibraryHomePort,
{
    let home = query_library_home(port, LibraryHomeRequest::default())?;
    if !home
        .questions
        .iter()
        .any(|question| question.destination == destination)
    {
        return Err(ApplicationError::InvalidExplorationWorkspace(
            "the destination is not answerable by the current library",
        ));
    }
    let workspace = ExplorationWorkspace {
        version: EXPLORATION_WORKSPACE_VERSION,
        destination,
    };
    port.save_exploration_workspace(&workspace)
        .map_err(ApplicationError::WorkspaceUpdate)?;
    Ok(workspace)
}

pub fn clear_exploration_workspace(
    port: &dyn ExplorationWorkspacePort,
) -> Result<(), ApplicationError> {
    port.clear_exploration_workspace()
        .map_err(ApplicationError::WorkspaceUpdate)
}

fn validate_request(request: &LibraryHomeRequest) -> Result<(), ApplicationError> {
    if request
        .after_import_operation_ref
        .as_ref()
        .is_some_and(|operation_ref| operation_ref.trim().is_empty())
    {
        return Err(ApplicationError::InvalidLibraryHomeRequest(
            "the import operation reference is blank",
        ));
    }
    Ok(())
}

fn combined_range(
    training: &TrainingOverview,
    activity: &ActivityOverview,
    sleep: &SleepOverview,
    recovery: &RecoveryOverview,
) -> Option<LibraryHomeDateRange> {
    let ranges = [
        training
            .available_range
            .as_ref()
            .map(|range| (&range.from, &range.through)),
        activity
            .available_range
            .as_ref()
            .map(|range| (&range.from, &range.through)),
        sleep
            .available_range
            .as_ref()
            .map(|range| (&range.from, &range.through)),
        recovery
            .available_range
            .as_ref()
            .map(|range| (&range.from, &range.through)),
    ];
    let mut present = ranges.into_iter().flatten();
    let (first_from, first_through) = present.next()?;
    let (from, through) = present.fold(
        (first_from.as_str(), first_through.as_str()),
        |(earliest, latest), (from, through)| {
            (earliest.min(from.as_str()), latest.max(through.as_str()))
        },
    );
    Some(LibraryHomeDateRange {
        from: from.to_owned(),
        through: through.to_owned(),
    })
}

fn training_coverage(
    overview: TrainingOverview,
) -> Result<LibraryDomainCoverage, ApplicationError> {
    let observed = sum_counts(
        overview
            .series
            .iter()
            .map(|series| series.summary.session_count),
        "training session coverage",
    )?;
    let distance = sum_counts(
        overview
            .series
            .iter()
            .map(|series| series.summary.distance_session_count),
        "training distance coverage",
    )?;
    let energy = sum_counts(
        overview
            .series
            .iter()
            .map(|series| series.summary.energy_session_count),
        "training energy coverage",
    )?;
    let heart_rate = sum_counts(
        overview
            .series
            .iter()
            .map(|series| series.summary.heart_rate_session_count),
        "training heart-rate coverage",
    )?;
    coverage_is_bounded([distance, energy, heart_rate], observed, "training")?;
    Ok(LibraryDomainCoverage {
        domain: LibraryDomain::Training,
        available_range: overview.available_range.map(|range| LibraryHomeDateRange {
            from: range.from,
            through: range.through,
        }),
        selected_range: overview.selected_range.map(|range| LibraryHomeDateRange {
            from: range.from,
            through: range.through,
        }),
        origin_count: overview.series.len(),
        observed_record_count: observed,
        measurements: if observed > 0 {
            vec![
                LibraryMeasurementCoverage::new(
                    LibraryMeasurement::TrainingDuration,
                    observed,
                    observed,
                ),
                LibraryMeasurementCoverage::new(
                    LibraryMeasurement::TrainingDistance,
                    distance,
                    observed,
                ),
                LibraryMeasurementCoverage::new(
                    LibraryMeasurement::TrainingEnergy,
                    energy,
                    observed,
                ),
                LibraryMeasurementCoverage::new(
                    LibraryMeasurement::TrainingHeartRate,
                    heart_rate,
                    observed,
                ),
            ]
        } else {
            Vec::new()
        },
    })
}

fn activity_coverage(
    overview: ActivityOverview,
) -> Result<LibraryDomainCoverage, ApplicationError> {
    let observed = sum_counts(
        overview
            .series
            .iter()
            .map(|series| series.summary.observed_days),
        "activity observation coverage",
    )?;
    let available = sum_counts(
        overview
            .series
            .iter()
            .map(|series| series.summary.available_step_days),
        "activity step coverage",
    )?;
    coverage_is_bounded([available], observed, "activity")?;
    Ok(LibraryDomainCoverage {
        domain: LibraryDomain::Activity,
        available_range: overview.available_range.map(|range| LibraryHomeDateRange {
            from: range.from,
            through: range.through,
        }),
        selected_range: overview.selected_range.map(|range| LibraryHomeDateRange {
            from: range.from,
            through: range.through,
        }),
        origin_count: overview.series.len(),
        observed_record_count: observed,
        measurements: if observed > 0 {
            vec![LibraryMeasurementCoverage::new(
                LibraryMeasurement::ActivitySteps,
                available,
                observed,
            )]
        } else {
            Vec::new()
        },
    })
}

fn sleep_coverage(overview: SleepOverview) -> Result<LibraryDomainCoverage, ApplicationError> {
    let observed = sleep_count(
        &overview,
        |summary| summary.observed_nights,
        "sleep observation",
    )?;
    let phases = sleep_count(
        &overview,
        |summary| summary.phase_night_count,
        "sleep phase",
    )?;
    let stages = sleep_count(
        &overview,
        |summary| summary.stage_timeline_night_count,
        "sleep stage",
    )?;
    let scores = sleep_count(
        &overview,
        |summary| summary.score_night_count,
        "sleep score",
    )?;
    let goals = sleep_count(&overview, |summary| summary.goal_night_count, "sleep goal")?;
    let power = sleep_count(
        &overview,
        |summary| summary.power_status_night_count,
        "sleep power-status",
    )?;
    coverage_is_bounded([phases, stages, scores, goals, power], observed, "sleep")?;
    Ok(LibraryDomainCoverage {
        domain: LibraryDomain::Sleep,
        available_range: overview.available_range.map(|range| LibraryHomeDateRange {
            from: range.from,
            through: range.through,
        }),
        selected_range: overview.selected_range.map(|range| LibraryHomeDateRange {
            from: range.from,
            through: range.through,
        }),
        origin_count: overview.series.len(),
        observed_record_count: observed,
        measurements: if observed > 0 {
            vec![
                LibraryMeasurementCoverage::new(
                    LibraryMeasurement::SleepDuration,
                    observed,
                    observed,
                ),
                LibraryMeasurementCoverage::new(
                    LibraryMeasurement::SleepInterruptions,
                    observed,
                    observed,
                ),
                LibraryMeasurementCoverage::new(
                    LibraryMeasurement::SleepEfficiency,
                    observed,
                    observed,
                ),
                LibraryMeasurementCoverage::new(LibraryMeasurement::SleepPhases, phases, observed),
                LibraryMeasurementCoverage::new(LibraryMeasurement::SleepStages, stages, observed),
                LibraryMeasurementCoverage::new(LibraryMeasurement::SleepScore, scores, observed),
                LibraryMeasurementCoverage::new(LibraryMeasurement::SleepGoal, goals, observed),
                LibraryMeasurementCoverage::new(
                    LibraryMeasurement::SleepPowerStatus,
                    power,
                    observed,
                ),
            ]
        } else {
            Vec::new()
        },
    })
}

fn sleep_count(
    overview: &SleepOverview,
    select: impl Fn(&super::SleepSeriesSummary) -> usize,
    label: &str,
) -> Result<usize, ApplicationError> {
    sum_counts(
        overview.series.iter().map(|series| select(&series.summary)),
        label,
    )
}

fn recovery_coverage(
    overview: RecoveryOverview,
) -> Result<LibraryDomainCoverage, ApplicationError> {
    let observed = recovery_count(
        &overview,
        |summary| summary.observed_nights,
        "recovery observation",
    )?;
    let heart_rate_variability = recovery_count(
        &overview,
        |summary| summary.rmssd_night_count,
        "recovery heart-rate-variability",
    )?;
    let assessments = recovery_count(
        &overview,
        |summary| summary.assessment_night_count,
        "recovery assessment",
    )?;
    let baselines = recovery_count(
        &overview,
        |summary| summary.baseline_night_count,
        "recovery baseline",
    )?;
    let guidance = recovery_count(
        &overview,
        |summary| summary.guidance_night_count,
        "recovery guidance",
    )?;
    coverage_is_bounded(
        [heart_rate_variability, assessments, baselines, guidance],
        observed,
        "recovery",
    )?;
    Ok(LibraryDomainCoverage {
        domain: LibraryDomain::Recovery,
        available_range: overview.available_range.map(|range| LibraryHomeDateRange {
            from: range.from,
            through: range.through,
        }),
        selected_range: overview.selected_range.map(|range| LibraryHomeDateRange {
            from: range.from,
            through: range.through,
        }),
        origin_count: overview.series.len(),
        observed_record_count: observed,
        measurements: if observed > 0 {
            vec![
                LibraryMeasurementCoverage::new(
                    LibraryMeasurement::RecoveryBeatToBeatInterval,
                    observed,
                    observed,
                ),
                LibraryMeasurementCoverage::new(
                    LibraryMeasurement::RecoveryHeartRateVariability,
                    heart_rate_variability,
                    observed,
                ),
                LibraryMeasurementCoverage::new(
                    LibraryMeasurement::RecoveryBreathingInterval,
                    observed,
                    observed,
                ),
                LibraryMeasurementCoverage::new(
                    LibraryMeasurement::RecoveryAssessment,
                    assessments,
                    observed,
                ),
                LibraryMeasurementCoverage::new(
                    LibraryMeasurement::RecoveryBaseline,
                    baselines,
                    observed,
                ),
                LibraryMeasurementCoverage::new(
                    LibraryMeasurement::RecoveryGuidance,
                    guidance,
                    observed,
                ),
            ]
        } else {
            Vec::new()
        },
    })
}

fn recovery_count(
    overview: &RecoveryOverview,
    select: impl Fn(&super::RecoverySeriesSummary) -> usize,
    label: &str,
) -> Result<usize, ApplicationError> {
    sum_counts(
        overview.series.iter().map(|series| select(&series.summary)),
        label,
    )
}

fn sum_counts(
    mut counts: impl Iterator<Item = usize>,
    label: &str,
) -> Result<usize, ApplicationError> {
    counts.try_fold(0_usize, |total, count| {
        total
            .checked_add(count)
            .ok_or_else(|| ApplicationError::Query(format!("{label} count overflowed")))
    })
}

fn coverage_is_bounded<const N: usize>(
    available: [usize; N],
    observed: usize,
    domain: &str,
) -> Result<(), ApplicationError> {
    if available.into_iter().any(|count| count > observed) {
        return Err(ApplicationError::Query(format!(
            "{domain} measurement coverage exceeds its observation count"
        )));
    }
    Ok(())
}

fn available_questions(domains: &[LibraryDomainCoverage]) -> Vec<LibraryQuestion> {
    let training = measurement_is_available(domains, LibraryMeasurement::TrainingDuration);
    let activity = measurement_is_available(domains, LibraryMeasurement::ActivitySteps);
    let sleep = measurement_is_available(domains, LibraryMeasurement::SleepDuration);
    let recovery =
        measurement_is_available(domains, LibraryMeasurement::RecoveryBeatToBeatInterval);
    let answerable_domain_count = [training, activity, sleep, recovery]
        .into_iter()
        .filter(|available| *available)
        .count();
    let mut questions = Vec::new();
    if training {
        questions.push(LibraryQuestion::new(
            LibraryQuestionKind::ExploreTrainingSessions,
            ExploreDestination::Training,
        ));
    }
    if answerable_domain_count >= 2 {
        questions.push(LibraryQuestion::new(
            LibraryQuestionKind::AlignHistory,
            ExploreDestination::Longitudinal,
        ));
    }
    if activity {
        questions.push(LibraryQuestion::new(
            LibraryQuestionKind::ReviewActivitySteps,
            ExploreDestination::Activity,
        ));
    }
    if sleep {
        questions.push(LibraryQuestion::new(
            LibraryQuestionKind::ReviewSleepPatterns,
            ExploreDestination::Sleep,
        ));
    }
    if recovery {
        questions.push(LibraryQuestion::new(
            LibraryQuestionKind::ReviewRecoveryPatterns,
            ExploreDestination::Recovery,
        ));
    }
    questions
}

fn measurement_is_available(
    domains: &[LibraryDomainCoverage],
    measurement: LibraryMeasurement,
) -> bool {
    domains.iter().any(|domain| {
        domain
            .measurements
            .iter()
            .any(|coverage| coverage.measurement == measurement && coverage.available_records > 0)
    })
}

fn resumable_exploration<P>(
    port: &P,
    questions: &[LibraryQuestion],
) -> Result<Option<ExplorationWorkspace>, ApplicationError>
where
    P: ExplorationWorkspacePort,
{
    let stored = port
        .load_exploration_workspace()
        .map_err(ApplicationError::WorkspaceQuery)?;
    let Some(stored) = stored else {
        return Ok(None);
    };
    if stored.version != i64::from(EXPLORATION_WORKSPACE_VERSION) {
        return Ok(None);
    }
    let Some(destination) = stored_destination(&stored.destination) else {
        return Ok(None);
    };
    if !questions
        .iter()
        .any(|question| question.destination == destination)
    {
        return Ok(None);
    }
    Ok(Some(ExplorationWorkspace {
        version: EXPLORATION_WORKSPACE_VERSION,
        destination,
    }))
}

fn stored_destination(destination: &str) -> Option<ExploreDestination> {
    match destination {
        "activity" => Some(ExploreDestination::Activity),
        "training" => Some(ExploreDestination::Training),
        "sleep" => Some(ExploreDestination::Sleep),
        "recovery" => Some(ExploreDestination::Recovery),
        "longitudinal" => Some(ExploreDestination::Longitudinal),
        _ => None,
    }
}

fn requested_import_reveal<P>(
    port: &P,
    requested_operation_ref: Option<&str>,
) -> Result<Option<PostImportReveal>, ApplicationError>
where
    P: ImportOutcomeLibraryPort,
{
    let Some(requested_operation_ref) = requested_operation_ref else {
        return Ok(None);
    };
    let outcome = port
        .latest_import_outcome()
        .map_err(ApplicationError::OutcomeQuery)?;
    let Some(outcome) = outcome.filter(|outcome| {
        outcome.operation_ref == requested_operation_ref
            && outcome.state == ImportOperationState::Completed
    }) else {
        return Ok(None);
    };
    let source_review_recommended = !outcome.coverage_complete
        || outcome.coverage.unsupported > 0
        || outcome.coverage.deliberately_ignored > 0
        || outcome.coverage.unrecognized > 0
        || outcome.coverage.invalid > 0
        || outcome.report.conflicts > 0;
    Ok(Some(PostImportReveal {
        exact_repeat: outcome.exact_repeat,
        canonical_history_changed: outcome.canonical_history_changed,
        new_observations: outcome.report.new_observations,
        enriched_observations: outcome.report.enriched_observations,
        amended_observations: outcome.report.amended_observations,
        source_review_recommended,
    }))
}
