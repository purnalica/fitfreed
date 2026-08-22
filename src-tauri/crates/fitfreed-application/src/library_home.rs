use std::collections::BTreeMap;

use chrono::{Days, NaiveDate};
use fitfreed_domain::ImportOperationState;

use super::{
    query_activity_overview, query_recovery_overview, query_sleep_overview,
    query_training_overview, query_training_sessions, query_training_sports, ActivityLibraryPort,
    ActivityOverview, ApplicationError, ImportOutcomeLibraryPort, RecoveryLibraryPort,
    RecoveryOverview, SleepLibraryPort, SleepOverview, TrainingLibraryPort, TrainingOverview,
    TrainingSessionDiscoveryPort, TrainingSessionSearchItem, TrainingSessionSearchPage,
    TrainingSessionSearchRequest, TrainingSessionSort, TrainingSportState, TrainingSportsOverview,
    TrainingSportsPort,
};

const LIBRARY_HOME_VERSION: u32 = 2;
const RECENT_SESSION_LIMIT: usize = 4;
const SPORT_SUMMARY_LIMIT: usize = 6;
const COMPARISON_PERIOD_DAYS: u64 = 7;
const LIBRARY_REVISION_PREFIX: &str = "library-home-revision-";

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
    pub unchanged_observations: usize,
    pub source_review_recommended: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LibraryHomeSportSummary {
    pub state: TrainingSportState,
    pub canonical_family: Option<String>,
    pub display_label: Option<String>,
    pub profile_count: usize,
    pub session_count: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LibraryHomeRecentSession {
    pub session_ref: String,
    pub started_at_local: String,
    pub duration_milliseconds: i64,
    pub distance_meters: Option<f64>,
    pub sport_state: TrainingSportState,
    pub canonical_family: Option<String>,
    pub display_label: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LibraryHomeTraining {
    pub training_snapshot_ref: String,
    pub session_count: usize,
    pub sport_profile_count: usize,
    pub omitted_sport_profile_count: usize,
    pub sports: Vec<LibraryHomeSportSummary>,
    pub recent_sessions: Vec<LibraryHomeRecentSession>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LibraryHomeTrainingPeriod {
    pub range: LibraryHomeDateRange,
    pub session_count: usize,
    pub total_duration_milliseconds: i128,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LibraryHomeTrainingComparison {
    pub reference_date: String,
    pub baseline: LibraryHomeTrainingPeriod,
    pub comparison: LibraryHomeTrainingPeriod,
    pub session_count_change: i128,
    pub duration_change_milliseconds: i128,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HistoricalTrainingReason {
    NoCurrentTraining,
    HistoryAfterReferenceDate,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HistoricalTrainingHighlight {
    pub reference_date: String,
    pub current_range: LibraryHomeDateRange,
    pub latest_session_date: String,
    pub reason: HistoricalTrainingReason,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LibraryHistoryHighlight {
    pub latest_evidence_date: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LibraryHomeHighlight {
    RecentTrainingComparison(LibraryHomeTrainingComparison),
    HistoricalTraining(HistoricalTrainingHighlight),
    LibraryHistory(LibraryHistoryHighlight),
}

#[derive(Debug, Clone, PartialEq)]
pub struct LibraryHome {
    pub version: u32,
    pub library_revision_ref: String,
    pub available_range: Option<LibraryHomeDateRange>,
    pub domains: Vec<LibraryDomainCoverage>,
    pub questions: Vec<LibraryQuestion>,
    pub training: Option<LibraryHomeTraining>,
    pub highlight: Option<LibraryHomeHighlight>,
    pub post_import: Option<PostImportReveal>,
    pub resumable_exploration: Option<ExplorationWorkspace>,
}

pub trait ExplorationWorkspacePort {
    fn load_exploration_workspace(&self) -> Result<Option<StoredExplorationWorkspace>, String>;
    fn save_exploration_workspace(&self, workspace: &ExplorationWorkspace) -> Result<(), String>;
    fn clear_exploration_workspace(&self) -> Result<(), String>;
}

pub trait LibraryHomeRevisionPort {
    fn library_home_revision_ref(&self) -> Result<String, String>;
}

pub trait LibraryHomeClockPort {
    fn current_local_date(&self) -> Result<String, String>;
}

pub trait LibraryHomePort:
    ActivityLibraryPort
    + TrainingLibraryPort
    + SleepLibraryPort
    + RecoveryLibraryPort
    + TrainingSessionDiscoveryPort
    + TrainingSportsPort
    + ImportOutcomeLibraryPort
    + ExplorationWorkspacePort
    + LibraryHomeRevisionPort
    + LibraryHomeClockPort
{
}

impl<T> LibraryHomePort for T where
    T: ActivityLibraryPort
        + TrainingLibraryPort
        + SleepLibraryPort
        + RecoveryLibraryPort
        + TrainingSessionDiscoveryPort
        + TrainingSportsPort
        + ImportOutcomeLibraryPort
        + ExplorationWorkspacePort
        + LibraryHomeRevisionPort
        + LibraryHomeClockPort
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
    for attempt in 0..2 {
        let revision_before = library_revision(port)?;
        let composed = compose_library_home(port, &request, revision_before.clone());
        match composed {
            Ok(home) => {
                let revision_after = library_revision(port)?;
                if revision_before == revision_after {
                    return Ok(home);
                }
            }
            Err(error) => {
                let revision_after = library_revision(port)?;
                if attempt == 0
                    && (revision_before != revision_after
                        || matches!(error, ApplicationError::TrainingSessionSearchChanged))
                {
                    continue;
                }
                return Err(error);
            }
        }
    }
    Err(ApplicationError::Query(
        "the library changed while Home was composed".to_owned(),
    ))
}

fn compose_library_home<P>(
    port: &P,
    request: &LibraryHomeRequest,
    library_revision_ref: String,
) -> Result<LibraryHome, ApplicationError>
where
    P: LibraryHomePort,
{
    let training = query_training_overview(port, None)?;
    let activity = query_activity_overview(port, None)?;
    let sleep = query_sleep_overview(port, None)?;
    let recovery = query_recovery_overview(port, None)?;

    let available_range = combined_range(&training, &activity, &sleep, &recovery);
    let training_bounds = training.available_range.clone();
    let domains = vec![
        training_coverage(training)?,
        activity_coverage(activity)?,
        sleep_coverage(sleep)?,
        recovery_coverage(recovery)?,
    ];
    let questions = available_questions(&domains);
    let current_local_date = current_local_date(port)?;
    let (training, highlight) = training_identity_and_highlight(
        port,
        training_bounds.as_ref(),
        available_range.as_ref(),
        current_local_date,
    )?;
    let post_import = requested_import_reveal(port, request.after_import_operation_ref.as_deref())?;
    let resumable_exploration = resumable_exploration(port, &questions)?;

    Ok(LibraryHome {
        version: LIBRARY_HOME_VERSION,
        library_revision_ref,
        available_range,
        domains,
        questions,
        training,
        highlight,
        post_import,
        resumable_exploration,
    })
}

fn library_revision(port: &dyn LibraryHomeRevisionPort) -> Result<String, ApplicationError> {
    let revision = port
        .library_home_revision_ref()
        .map_err(ApplicationError::Query)?;
    let valid = revision
        .strip_prefix(LIBRARY_REVISION_PREFIX)
        .is_some_and(|digest| {
            digest.len() == 64
                && digest
                    .bytes()
                    .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        });
    if !valid {
        return Err(ApplicationError::Query(
            "the library revision reference is invalid".to_owned(),
        ));
    }
    Ok(revision)
}

fn current_local_date(port: &dyn LibraryHomeClockPort) -> Result<NaiveDate, ApplicationError> {
    let value = port.current_local_date().map_err(ApplicationError::Query)?;
    let date = NaiveDate::parse_from_str(&value, "%Y-%m-%d")
        .map_err(|_| ApplicationError::Query("the local calendar date is invalid".to_owned()))?;
    if date.format("%Y-%m-%d").to_string() != value {
        return Err(ApplicationError::Query(
            "the local calendar date is not canonical".to_owned(),
        ));
    }
    Ok(date)
}

fn training_identity_and_highlight<P>(
    port: &P,
    training_bounds: Option<&super::TrainingDateRange>,
    available_range: Option<&LibraryHomeDateRange>,
    reference_date: NaiveDate,
) -> Result<(Option<LibraryHomeTraining>, Option<LibraryHomeHighlight>), ApplicationError>
where
    P: TrainingSessionDiscoveryPort + TrainingSportsPort,
{
    let sports = query_training_sports(port)?;
    let recent = query_training_sessions(
        port,
        training_search_request(None, None, RECENT_SESSION_LIMIT, None),
    )?;
    validate_complete_training_identity(training_bounds, &sports, &recent)?;
    if recent.total_count == 0 {
        let highlight = available_range.map(|range| {
            LibraryHomeHighlight::LibraryHistory(LibraryHistoryHighlight {
                latest_evidence_date: range.through.clone(),
            })
        });
        return Ok((None, highlight));
    }

    let snapshot_ref = recent.snapshot_ref.clone();
    let latest_session_date = recent
        .sessions
        .first()
        .and_then(|session| session.started_at_local.get(..10))
        .ok_or_else(|| {
            ApplicationError::Query("the newest training session is unavailable".to_owned())
        })?;
    let latest_session_date = parse_training_home_date(latest_session_date)?;
    let training = LibraryHomeTraining {
        training_snapshot_ref: snapshot_ref.clone(),
        session_count: recent.total_count,
        sport_profile_count: sports.sports.len(),
        omitted_sport_profile_count: 0,
        sports: summarized_sports(&sports)?,
        recent_sessions: recent.sessions.into_iter().map(recent_session).collect(),
    };
    let represented_profiles = training.sports.iter().try_fold(0_usize, |total, sport| {
        total.checked_add(sport.profile_count).ok_or_else(|| {
            ApplicationError::Query("Home sport profile count overflowed".to_owned())
        })
    })?;
    let mut training = training;
    training.omitted_sport_profile_count = training
        .sport_profile_count
        .checked_sub(represented_profiles)
        .ok_or_else(|| {
            ApplicationError::Query("Home sport profile coverage is invalid".to_owned())
        })?;
    let highlight = training_highlight(port, &snapshot_ref, latest_session_date, reference_date)?;
    Ok((Some(training), Some(highlight)))
}

fn training_search_request(
    from: Option<NaiveDate>,
    through: Option<NaiveDate>,
    limit: usize,
    snapshot_ref: Option<String>,
) -> TrainingSessionSearchRequest {
    TrainingSessionSearchRequest {
        from: from.map(|date| date.format("%Y-%m-%d").to_string()),
        through: through.map(|date| date.format("%Y-%m-%d").to_string()),
        sport_refs: Vec::new(),
        required_measurements: Vec::new(),
        text: None,
        sort: TrainingSessionSort::StartedDescending,
        offset: 0,
        limit,
        snapshot_ref,
    }
}

fn validate_complete_training_identity(
    training_bounds: Option<&super::TrainingDateRange>,
    sports: &TrainingSportsOverview,
    sessions: &TrainingSessionSearchPage,
) -> Result<(), ApplicationError> {
    if sports.session_count != sessions.total_count {
        return Err(ApplicationError::Query(
            "complete training and sport counts disagree".to_owned(),
        ));
    }
    let bounds_match = match (training_bounds, sessions.available_range.as_ref()) {
        (None, None) => true,
        (Some(expected), Some(actual)) => expected == actual,
        _ => false,
    };
    if !bounds_match || training_bounds.is_some() != (sessions.total_count > 0) {
        return Err(ApplicationError::Query(
            "complete training bounds and sessions disagree".to_owned(),
        ));
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
struct SportSummaryKey {
    state_rank: u8,
    canonical_family: Option<String>,
    display_label: Option<String>,
}

fn summarized_sports(
    overview: &TrainingSportsOverview,
) -> Result<Vec<LibraryHomeSportSummary>, ApplicationError> {
    let mut groups = BTreeMap::<SportSummaryKey, LibraryHomeSportSummary>::new();
    for sport in &overview.sports {
        let classification = sport.classification.as_ref();
        let key = SportSummaryKey {
            state_rank: sport_state_rank(sport.state),
            canonical_family: classification
                .and_then(|classification| classification.canonical_family.clone()),
            display_label: classification
                .and_then(|classification| classification.display_label.clone()),
        };
        let summary = groups.entry(key).or_insert(LibraryHomeSportSummary {
            state: sport.state,
            canonical_family: classification
                .and_then(|classification| classification.canonical_family.clone()),
            display_label: classification
                .and_then(|classification| classification.display_label.clone()),
            profile_count: 0,
            session_count: 0,
        });
        summary.profile_count = summary.profile_count.checked_add(1).ok_or_else(|| {
            ApplicationError::Query("Home sport profile count overflowed".to_owned())
        })?;
        summary.session_count = summary
            .session_count
            .checked_add(sport.coverage.session_count)
            .ok_or_else(|| {
                ApplicationError::Query("Home sport session count overflowed".to_owned())
            })?;
    }
    let mut summaries = groups.into_values().collect::<Vec<_>>();
    summaries.sort_by(|left, right| {
        right
            .session_count
            .cmp(&left.session_count)
            .then_with(|| sport_state_rank(left.state).cmp(&sport_state_rank(right.state)))
            .then_with(|| left.canonical_family.cmp(&right.canonical_family))
            .then_with(|| left.display_label.cmp(&right.display_label))
    });
    summaries.truncate(SPORT_SUMMARY_LIMIT);
    Ok(summaries)
}

const fn sport_state_rank(state: TrainingSportState) -> u8 {
    match state {
        TrainingSportState::Classified => 0,
        TrainingSportState::Unknown => 1,
        TrainingSportState::Unavailable => 2,
    }
}

fn recent_session(session: TrainingSessionSearchItem) -> LibraryHomeRecentSession {
    let classification = session.sport.classification;
    LibraryHomeRecentSession {
        session_ref: session.session_ref,
        started_at_local: session.started_at_local,
        duration_milliseconds: session.duration_milliseconds,
        distance_meters: session.distance_meters,
        sport_state: session.sport.state,
        canonical_family: classification
            .as_ref()
            .and_then(|classification| classification.canonical_family.clone()),
        display_label: classification.and_then(|classification| classification.display_label),
    }
}

fn training_highlight(
    port: &dyn TrainingSessionDiscoveryPort,
    snapshot_ref: &str,
    latest_session_date: NaiveDate,
    reference_date: NaiveDate,
) -> Result<LibraryHomeHighlight, ApplicationError> {
    let comparison_from = subtract_days(reference_date, COMPARISON_PERIOD_DAYS - 1)?;
    let current_range = home_range(comparison_from, reference_date);
    if latest_session_date > reference_date {
        return Ok(LibraryHomeHighlight::HistoricalTraining(
            HistoricalTrainingHighlight {
                reference_date: format_date(reference_date),
                current_range,
                latest_session_date: format_date(latest_session_date),
                reason: HistoricalTrainingReason::HistoryAfterReferenceDate,
            },
        ));
    }
    let comparison = query_training_sessions(
        port,
        training_search_request(
            Some(comparison_from),
            Some(reference_date),
            1,
            Some(snapshot_ref.to_owned()),
        ),
    )?;
    if comparison.total_count == 0 {
        return Ok(LibraryHomeHighlight::HistoricalTraining(
            HistoricalTrainingHighlight {
                reference_date: format_date(reference_date),
                current_range,
                latest_session_date: format_date(latest_session_date),
                reason: HistoricalTrainingReason::NoCurrentTraining,
            },
        ));
    }
    let baseline_through = subtract_days(comparison_from, 1)?;
    let baseline_from = subtract_days(baseline_through, COMPARISON_PERIOD_DAYS - 1)?;
    let baseline = query_training_sessions(
        port,
        training_search_request(
            Some(baseline_from),
            Some(baseline_through),
            1,
            Some(snapshot_ref.to_owned()),
        ),
    )?;
    let baseline = training_period(baseline_from, baseline_through, baseline)?;
    let comparison = training_period(comparison_from, reference_date, comparison)?;
    let session_count_change = i128::try_from(comparison.session_count)
        .and_then(|comparison| {
            i128::try_from(baseline.session_count).map(|baseline| comparison - baseline)
        })
        .map_err(|_| ApplicationError::Query("Home session count exceeds i128".to_owned()))?;
    let duration_change_milliseconds = comparison
        .total_duration_milliseconds
        .checked_sub(baseline.total_duration_milliseconds)
        .ok_or_else(|| ApplicationError::Query("Home duration change overflowed".to_owned()))?;
    Ok(LibraryHomeHighlight::RecentTrainingComparison(
        LibraryHomeTrainingComparison {
            reference_date: format_date(reference_date),
            baseline,
            comparison,
            session_count_change,
            duration_change_milliseconds,
        },
    ))
}

fn training_period(
    from: NaiveDate,
    through: NaiveDate,
    page: TrainingSessionSearchPage,
) -> Result<LibraryHomeTrainingPeriod, ApplicationError> {
    let total_duration_milliseconds =
        page.summaries
            .into_iter()
            .try_fold(0_i128, |total, summary| {
                total
                    .checked_add(summary.total_duration_milliseconds)
                    .ok_or_else(|| ApplicationError::Query("Home duration overflowed".to_owned()))
            })?;
    Ok(LibraryHomeTrainingPeriod {
        range: home_range(from, through),
        session_count: page.total_count,
        total_duration_milliseconds,
    })
}

fn parse_training_home_date(value: &str) -> Result<NaiveDate, ApplicationError> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| ApplicationError::Query("the latest training date is invalid".to_owned()))
}

fn subtract_days(date: NaiveDate, days: u64) -> Result<NaiveDate, ApplicationError> {
    date.checked_sub_days(Days::new(days))
        .ok_or_else(|| ApplicationError::Query("Home comparison date underflowed".to_owned()))
}

fn home_range(from: NaiveDate, through: NaiveDate) -> LibraryHomeDateRange {
    LibraryHomeDateRange {
        from: format_date(from),
        through: format_date(through),
    }
}

fn format_date(date: NaiveDate) -> String {
    date.format("%Y-%m-%d").to_string()
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
    let unchanged_observations = outcome
        .report
        .equivalent_observations
        .checked_add(outcome.report.preserved_observations)
        .ok_or_else(|| {
            ApplicationError::Query("post-import unchanged observation count overflowed".to_owned())
        })?;
    Ok(Some(PostImportReveal {
        exact_repeat: outcome.exact_repeat,
        canonical_history_changed: outcome.canonical_history_changed,
        new_observations: outcome.report.new_observations,
        enriched_observations: outcome.report.enriched_observations,
        amended_observations: outcome.report.amended_observations,
        unchanged_observations,
        source_review_recommended,
    }))
}
