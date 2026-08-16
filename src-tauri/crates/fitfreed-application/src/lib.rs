use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};

use chrono::{Days, NaiveDate, NaiveDateTime};
use thiserror::Error;

use fitfreed_domain::{DailyActivity, ImportOutcome, ImportReport, TrainingSession};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LocalePreference {
    EnUs,
    EsEs,
}

impl LocalePreference {
    pub const fn from_code(code: &str) -> Option<Self> {
        match code.as_bytes() {
            b"en-US" => Some(Self::EnUs),
            b"es-ES" => Some(Self::EsEs),
            _ => None,
        }
    }

    pub const fn code(self) -> &'static str {
        match self {
            Self::EnUs => "en-US",
            Self::EsEs => "es-ES",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImportPhase {
    Fingerprinting,
    Validating,
    Importing,
    Committing,
    Completed,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportProgress {
    pub phase: ImportPhase,
    pub completed_artifacts: usize,
    pub total_artifacts: Option<usize>,
    pub completed_bytes: u64,
    pub total_bytes: Option<u64>,
    pub cancellable: bool,
}

impl ImportProgress {
    pub fn phase(phase: ImportPhase) -> Self {
        Self {
            phase,
            completed_artifacts: 0,
            total_artifacts: None,
            completed_bytes: 0,
            total_bytes: None,
            cancellable: !matches!(
                phase,
                ImportPhase::Committing | ImportPhase::Completed | ImportPhase::Cancelled
            ),
        }
    }

    pub fn fingerprinting(completed_bytes: u64, total_bytes: u64) -> Self {
        Self {
            completed_bytes,
            total_bytes: Some(total_bytes),
            ..Self::phase(ImportPhase::Fingerprinting)
        }
    }

    pub fn artifacts(phase: ImportPhase, completed: usize, total: usize) -> Self {
        Self {
            completed_artifacts: completed,
            total_artifacts: Some(total),
            ..Self::phase(phase)
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct ImportPhaseTimings {
    pub fingerprint_milliseconds: f64,
    pub database_setup_milliseconds: f64,
    pub repeat_lookup_milliseconds: f64,
    pub archive_validation_milliseconds: f64,
    pub read_decode_map_milliseconds: f64,
    pub reconciliation_milliseconds: f64,
    pub transaction_control_milliseconds: f64,
    pub total_milliseconds: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ProfiledImport {
    pub report: ImportReport,
    pub timings: ImportPhaseTimings,
}

const DEFAULT_ACTIVITY_WINDOW_DAYS: u64 = 30;
const MAX_ACTIVITY_RANGE_DAYS: i64 = 366;
const DEFAULT_TRAINING_WINDOW_DAYS: u64 = 30;
const MAX_TRAINING_RANGE_DAYS: i64 = 366;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActivityDateRange {
    pub from: String,
    pub through: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActivityDayAvailability {
    Available,
    Unavailable,
    Missing,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActivityDayInsight {
    pub local_date: String,
    pub step_count: Option<i64>,
    pub availability: ActivityDayAvailability,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActivitySeriesSummary {
    pub calendar_days: usize,
    pub observed_days: usize,
    pub available_step_days: usize,
    pub unavailable_step_days: usize,
    pub missing_days: usize,
    pub total_step_count: Option<i128>,
    pub average_step_count: Option<i128>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActivitySeriesOverview {
    pub series_ref: String,
    pub summary: ActivitySeriesSummary,
    pub days: Vec<ActivityDayInsight>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActivityOverview {
    pub available_range: Option<ActivityDateRange>,
    pub selected_range: Option<ActivityDateRange>,
    pub series: Vec<ActivitySeriesOverview>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActivitySeriesComparison {
    pub series_ref: String,
    pub baseline: ActivitySeriesSummary,
    pub comparison: ActivitySeriesSummary,
    pub total_step_change: Option<i128>,
    pub average_step_change: Option<i128>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActivityComparison {
    pub available_range: Option<ActivityDateRange>,
    pub baseline_range: Option<ActivityDateRange>,
    pub comparison_range: Option<ActivityDateRange>,
    pub series: Vec<ActivitySeriesComparison>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingDateRange {
    pub from: String,
    pub through: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSessionInsight {
    pub session_ref: String,
    pub started_at_local: String,
    pub stopped_at_local: String,
    pub utc_offset_minutes: Option<i32>,
    pub duration_milliseconds: i64,
    pub distance_meters: Option<f64>,
    pub energy_kilocalories: Option<i64>,
    pub average_heart_rate_bpm: Option<i64>,
    pub maximum_heart_rate_bpm: Option<i64>,
    pub sport_ref: Option<String>,
    pub exercise_count: Option<usize>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSeriesSummary {
    pub calendar_days: usize,
    pub training_days: usize,
    pub session_count: usize,
    pub total_duration_milliseconds: i128,
    pub distance_session_count: usize,
    pub total_distance_meters: Option<f64>,
    pub energy_session_count: usize,
    pub total_energy_kilocalories: Option<i128>,
    pub heart_rate_session_count: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSeriesOverview {
    pub series_ref: String,
    pub summary: TrainingSeriesSummary,
    pub sessions: Vec<TrainingSessionInsight>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingOverview {
    pub available_range: Option<TrainingDateRange>,
    pub selected_range: Option<TrainingDateRange>,
    pub series: Vec<TrainingSeriesOverview>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSeriesComparison {
    pub series_ref: String,
    pub baseline: TrainingSeriesSummary,
    pub comparison: TrainingSeriesSummary,
    pub session_count_change: i128,
    pub training_day_change: i128,
    pub duration_milliseconds_change: i128,
    pub distance_meters_change: Option<f64>,
    pub energy_kilocalories_change: Option<i128>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingComparison {
    pub available_range: Option<TrainingDateRange>,
    pub baseline_range: Option<TrainingDateRange>,
    pub comparison_range: Option<TrainingDateRange>,
    pub series: Vec<TrainingSeriesComparison>,
}

pub trait ArchiveImportPort {
    fn import_archive(
        &self,
        archive_path: &Path,
        cancellation: &AtomicBool,
        on_progress: &mut dyn FnMut(ImportProgress),
    ) -> Result<ImportReport, String>;
}

pub trait ActivityLibraryPort {
    fn activity_bounds(&self) -> Result<Option<ActivityDateRange>, String>;
    fn activity_origins(&self) -> Result<Vec<String>, String>;
    fn query_activity(&self, range: &ActivityDateRange) -> Result<Vec<DailyActivity>, String>;
}

pub trait TrainingLibraryPort {
    fn training_bounds(&self) -> Result<Option<TrainingDateRange>, String>;
    fn training_origins(&self) -> Result<Vec<String>, String>;
    fn query_training(&self, range: &TrainingDateRange) -> Result<Vec<TrainingSession>, String>;
}

pub trait ImportOutcomeLibraryPort {
    fn latest_import_outcome(&self) -> Result<Option<ImportOutcome>, String>;
}

pub trait LocalePreferencePort {
    fn load_locale(&self) -> Result<Option<LocalePreference>, String>;
    fn save_locale(&self, locale: LocalePreference) -> Result<(), String>;
}

#[derive(Debug, Error)]
pub enum ApplicationError {
    #[error("another import is already active")]
    ImportAlreadyActive,
    #[error("import coordination failed: {0}")]
    Coordination(String),
    #[error("{0}")]
    Import(String),
    #[error("library query failed: {0}")]
    Query(String),
    #[error("invalid activity range: {0}")]
    InvalidActivityRange(&'static str),
    #[error("invalid training range: {0}")]
    InvalidTrainingRange(&'static str),
    #[error("import outcome query failed: {0}")]
    OutcomeQuery(String),
    #[error("locale preference query failed: {0}")]
    PreferenceQuery(String),
    #[error("locale preference update failed: {0}")]
    PreferenceUpdate(String),
}

#[derive(Clone, Default)]
pub struct ImportCoordinator {
    active_cancellation: Arc<Mutex<Option<Arc<AtomicBool>>>>,
}

impl ImportCoordinator {
    fn begin(&self) -> Result<Arc<AtomicBool>, ApplicationError> {
        let mut active = self
            .active_cancellation
            .lock()
            .map_err(|error| ApplicationError::Coordination(error.to_string()))?;
        if active.is_some() {
            return Err(ApplicationError::ImportAlreadyActive);
        }
        let cancellation = Arc::new(AtomicBool::new(false));
        *active = Some(Arc::clone(&cancellation));
        Ok(cancellation)
    }

    pub fn cancel(&self) -> Result<bool, ApplicationError> {
        let active = self
            .active_cancellation
            .lock()
            .map_err(|error| ApplicationError::Coordination(error.to_string()))?;
        if let Some(cancellation) = active.as_ref() {
            cancellation.store(true, Ordering::Relaxed);
            Ok(true)
        } else {
            Ok(false)
        }
    }

    fn finish(&self, cancellation: &Arc<AtomicBool>) -> Result<(), ApplicationError> {
        let mut active = self
            .active_cancellation
            .lock()
            .map_err(|error| ApplicationError::Coordination(error.to_string()))?;
        if active
            .as_ref()
            .is_some_and(|current| Arc::ptr_eq(current, cancellation))
        {
            *active = None;
        }
        Ok(())
    }
}

pub fn import_archive(
    port: &dyn ArchiveImportPort,
    coordinator: &ImportCoordinator,
    archive_path: &Path,
    on_progress: &mut dyn FnMut(ImportProgress),
) -> Result<ImportReport, ApplicationError> {
    let cancellation = coordinator.begin()?;
    let result = port
        .import_archive(archive_path, &cancellation, on_progress)
        .map_err(ApplicationError::Import);
    coordinator.finish(&cancellation)?;
    result
}

pub fn query_default_activity_overview(
    port: &dyn ActivityLibraryPort,
) -> Result<ActivityOverview, ApplicationError> {
    query_activity_overview(port, None)
}

pub fn query_activity_overview(
    port: &dyn ActivityLibraryPort,
    requested_range: Option<ActivityDateRange>,
) -> Result<ActivityOverview, ApplicationError> {
    let Some(available_range) = port.activity_bounds().map_err(ApplicationError::Query)? else {
        return Ok(ActivityOverview {
            available_range: None,
            selected_range: None,
            series: Vec::new(),
        });
    };

    let (earliest, latest) = parse_activity_bounds(&available_range)?;

    let (window_start, window_end, selected_range) = match requested_range {
        Some(range) => {
            let (from, through) = validate_activity_range(&range, earliest, latest)?;
            (from, through, range)
        }
        None => {
            let from = latest
                .checked_sub_days(Days::new(DEFAULT_ACTIVITY_WINDOW_DAYS - 1))
                .unwrap_or(earliest)
                .max(earliest);
            let range = ActivityDateRange {
                from: from.format("%Y-%m-%d").to_string(),
                through: latest.format("%Y-%m-%d").to_string(),
            };
            (from, latest, range)
        }
    };
    let origins = port.activity_origins().map_err(ApplicationError::Query)?;
    let activities = port
        .query_activity(&selected_range)
        .map_err(ApplicationError::Query)?;
    let series = build_activity_series(window_start, window_end, origins, activities)?;

    Ok(ActivityOverview {
        available_range: Some(available_range),
        selected_range: Some(selected_range),
        series,
    })
}

pub fn query_activity_comparison(
    port: &dyn ActivityLibraryPort,
    baseline_range: ActivityDateRange,
    comparison_range: ActivityDateRange,
) -> Result<ActivityComparison, ApplicationError> {
    let Some(available_range) = port.activity_bounds().map_err(ApplicationError::Query)? else {
        return Ok(ActivityComparison {
            available_range: None,
            baseline_range: None,
            comparison_range: None,
            series: Vec::new(),
        });
    };
    let (earliest, latest) = parse_activity_bounds(&available_range)?;
    let (baseline_from, baseline_through) =
        validate_activity_range(&baseline_range, earliest, latest)?;
    let (comparison_from, comparison_through) =
        validate_activity_range(&comparison_range, earliest, latest)?;
    let origins = port.activity_origins().map_err(ApplicationError::Query)?;
    let baseline_activities = port
        .query_activity(&baseline_range)
        .map_err(ApplicationError::Query)?;
    let comparison_activities = port
        .query_activity(&comparison_range)
        .map_err(ApplicationError::Query)?;
    let baseline_series = build_activity_series(
        baseline_from,
        baseline_through,
        origins.clone(),
        baseline_activities,
    )?;
    let comparison_series = build_activity_series(
        comparison_from,
        comparison_through,
        origins,
        comparison_activities,
    )?;
    let series = baseline_series
        .into_iter()
        .zip(comparison_series)
        .map(|(baseline, comparison)| {
            if baseline.series_ref != comparison.series_ref {
                return Err(ApplicationError::Query(
                    "activity comparison origins are not aligned".to_owned(),
                ));
            }
            Ok(ActivitySeriesComparison {
                series_ref: baseline.series_ref,
                total_step_change: optional_change(
                    baseline.summary.total_step_count,
                    comparison.summary.total_step_count,
                ),
                average_step_change: optional_change(
                    baseline.summary.average_step_count,
                    comparison.summary.average_step_count,
                ),
                baseline: baseline.summary,
                comparison: comparison.summary,
            })
        })
        .collect::<Result<Vec<_>, _>>()?;

    Ok(ActivityComparison {
        available_range: Some(available_range),
        baseline_range: Some(baseline_range),
        comparison_range: Some(comparison_range),
        series,
    })
}

fn optional_change(baseline: Option<i128>, comparison: Option<i128>) -> Option<i128> {
    baseline
        .zip(comparison)
        .map(|(from, through)| through - from)
}

fn parse_activity_bounds(
    available_range: &ActivityDateRange,
) -> Result<(NaiveDate, NaiveDate), ApplicationError> {
    let earliest = parse_activity_date(&available_range.from)
        .map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
    let latest = parse_activity_date(&available_range.through)
        .map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
    if earliest > latest {
        return Err(ApplicationError::Query(
            "activity bounds are not ordered".to_owned(),
        ));
    }
    Ok((earliest, latest))
}

fn validate_activity_range(
    range: &ActivityDateRange,
    earliest: NaiveDate,
    latest: NaiveDate,
) -> Result<(NaiveDate, NaiveDate), ApplicationError> {
    let from = parse_activity_date(&range.from).map_err(ApplicationError::InvalidActivityRange)?;
    let through =
        parse_activity_date(&range.through).map_err(ApplicationError::InvalidActivityRange)?;
    if from > through {
        return Err(ApplicationError::InvalidActivityRange(
            "range dates are not ordered",
        ));
    }
    if from < earliest || through > latest {
        return Err(ApplicationError::InvalidActivityRange(
            "range is outside available activity history",
        ));
    }
    if through.signed_duration_since(from).num_days() + 1 > MAX_ACTIVITY_RANGE_DAYS {
        return Err(ApplicationError::InvalidActivityRange(
            "range exceeds 366 inclusive calendar days",
        ));
    }
    Ok((from, through))
}

fn parse_activity_date(value: &str) -> Result<NaiveDate, &'static str> {
    let parsed =
        NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|_| "activity date is invalid")?;
    if parsed.format("%Y-%m-%d").to_string() != value {
        return Err("activity date is not canonical");
    }
    Ok(parsed)
}

fn build_activity_series(
    from: NaiveDate,
    through: NaiveDate,
    origins: Vec<String>,
    activities: Vec<DailyActivity>,
) -> Result<Vec<ActivitySeriesOverview>, ApplicationError> {
    let mut observations = BTreeMap::<String, BTreeMap<NaiveDate, Option<i64>>>::new();
    for origin in origins {
        if origin.is_empty() {
            return Err(ApplicationError::Query(
                "activity query returned an empty origin".to_owned(),
            ));
        }
        if observations.insert(origin, BTreeMap::new()).is_some() {
            return Err(ApplicationError::Query(
                "activity query returned a duplicate origin".to_owned(),
            ));
        }
    }
    if observations.is_empty() {
        return Err(ApplicationError::Query(
            "activity bounds exist without an origin".to_owned(),
        ));
    }
    for activity in activities {
        let local_date = parse_activity_date(&activity.local_date)
            .map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
        if local_date < from || local_date > through {
            return Err(ApplicationError::Query(
                "activity query returned a date outside its range".to_owned(),
            ));
        }
        if activity.step_count.is_some_and(|value| value < 0) {
            return Err(ApplicationError::Query(
                "activity query returned a negative step count".to_owned(),
            ));
        }
        let origin = observations.get_mut(&activity.origin_id).ok_or_else(|| {
            ApplicationError::Query("activity query returned an unknown origin".to_owned())
        })?;
        let replaced = origin.insert(local_date, activity.step_count);
        if replaced.is_some() {
            return Err(ApplicationError::Query(
                "activity query returned a duplicate logical observation".to_owned(),
            ));
        }
    }

    observations
        .into_iter()
        .map(|(series_ref, observations)| {
            build_activity_series_overview(series_ref, from, through, observations)
        })
        .collect()
}

fn build_activity_series_overview(
    series_ref: String,
    from: NaiveDate,
    through: NaiveDate,
    observations: BTreeMap<NaiveDate, Option<i64>>,
) -> Result<ActivitySeriesOverview, ApplicationError> {
    let mut days = Vec::new();
    let mut available_step_days = 0;
    let mut unavailable_step_days = 0;
    let mut missing_days = 0;
    let mut total_step_count = 0_i128;
    let mut current = from;

    loop {
        let (step_count, availability) = match observations.get(&current) {
            Some(Some(step_count)) => {
                available_step_days += 1;
                total_step_count += i128::from(*step_count);
                (Some(*step_count), ActivityDayAvailability::Available)
            }
            Some(None) => {
                unavailable_step_days += 1;
                (None, ActivityDayAvailability::Unavailable)
            }
            None => {
                missing_days += 1;
                (None, ActivityDayAvailability::Missing)
            }
        };
        days.push(ActivityDayInsight {
            local_date: current.format("%Y-%m-%d").to_string(),
            step_count,
            availability,
        });
        if current == through {
            break;
        }
        current = current.checked_add_days(Days::new(1)).ok_or_else(|| {
            ApplicationError::Query("activity range exceeds the supported calendar".to_owned())
        })?;
    }

    let total_step_count = (available_step_days > 0).then_some(total_step_count);
    let average_step_count = total_step_count.map(|total| {
        (total + i128::try_from(available_step_days).unwrap_or_default() / 2)
            / i128::try_from(available_step_days).unwrap_or(1)
    });
    Ok(ActivitySeriesOverview {
        series_ref,
        summary: ActivitySeriesSummary {
            calendar_days: days.len(),
            observed_days: available_step_days + unavailable_step_days,
            available_step_days,
            unavailable_step_days,
            missing_days,
            total_step_count,
            average_step_count,
        },
        days,
    })
}

pub fn query_default_training_overview(
    port: &dyn TrainingLibraryPort,
) -> Result<TrainingOverview, ApplicationError> {
    query_training_overview(port, None)
}

pub fn query_training_overview(
    port: &dyn TrainingLibraryPort,
    requested_range: Option<TrainingDateRange>,
) -> Result<TrainingOverview, ApplicationError> {
    let Some(available_range) = port.training_bounds().map_err(ApplicationError::Query)? else {
        return Ok(TrainingOverview {
            available_range: None,
            selected_range: None,
            series: Vec::new(),
        });
    };
    let (earliest, latest) = parse_training_bounds(&available_range)?;
    let (window_start, window_end, selected_range) = match requested_range {
        Some(range) => {
            let (from, through) = validate_training_range(&range, earliest, latest)?;
            (from, through, range)
        }
        None => {
            let from = latest
                .checked_sub_days(Days::new(DEFAULT_TRAINING_WINDOW_DAYS - 1))
                .unwrap_or(earliest)
                .max(earliest);
            let range = TrainingDateRange {
                from: from.format("%Y-%m-%d").to_string(),
                through: latest.format("%Y-%m-%d").to_string(),
            };
            (from, latest, range)
        }
    };
    let origins = port.training_origins().map_err(ApplicationError::Query)?;
    let sessions = port
        .query_training(&selected_range)
        .map_err(ApplicationError::Query)?;
    let series = build_training_series(window_start, window_end, origins, sessions)?;

    Ok(TrainingOverview {
        available_range: Some(available_range),
        selected_range: Some(selected_range),
        series,
    })
}

pub fn query_training_comparison(
    port: &dyn TrainingLibraryPort,
    baseline_range: TrainingDateRange,
    comparison_range: TrainingDateRange,
) -> Result<TrainingComparison, ApplicationError> {
    let Some(available_range) = port.training_bounds().map_err(ApplicationError::Query)? else {
        return Ok(TrainingComparison {
            available_range: None,
            baseline_range: None,
            comparison_range: None,
            series: Vec::new(),
        });
    };
    let (earliest, latest) = parse_training_bounds(&available_range)?;
    let (baseline_from, baseline_through) =
        validate_training_range(&baseline_range, earliest, latest)?;
    let (comparison_from, comparison_through) =
        validate_training_range(&comparison_range, earliest, latest)?;
    let origins = port.training_origins().map_err(ApplicationError::Query)?;
    let baseline_sessions = port
        .query_training(&baseline_range)
        .map_err(ApplicationError::Query)?;
    let comparison_sessions = port
        .query_training(&comparison_range)
        .map_err(ApplicationError::Query)?;
    let baseline_series = build_training_series(
        baseline_from,
        baseline_through,
        origins.clone(),
        baseline_sessions,
    )?;
    let comparison_series = build_training_series(
        comparison_from,
        comparison_through,
        origins,
        comparison_sessions,
    )?;
    let series = baseline_series
        .into_iter()
        .zip(comparison_series)
        .map(|(baseline, comparison)| {
            if baseline.series_ref != comparison.series_ref {
                return Err(ApplicationError::Query(
                    "training comparison origins are not aligned".to_owned(),
                ));
            }
            Ok(TrainingSeriesComparison {
                series_ref: baseline.series_ref,
                session_count_change: count_change(
                    baseline.summary.session_count,
                    comparison.summary.session_count,
                )?,
                training_day_change: count_change(
                    baseline.summary.training_days,
                    comparison.summary.training_days,
                )?,
                duration_milliseconds_change: comparison.summary.total_duration_milliseconds
                    - baseline.summary.total_duration_milliseconds,
                distance_meters_change: optional_float_change(
                    baseline.summary.total_distance_meters,
                    comparison.summary.total_distance_meters,
                ),
                energy_kilocalories_change: optional_change(
                    baseline.summary.total_energy_kilocalories,
                    comparison.summary.total_energy_kilocalories,
                ),
                baseline: baseline.summary,
                comparison: comparison.summary,
            })
        })
        .collect::<Result<Vec<_>, _>>()?;

    Ok(TrainingComparison {
        available_range: Some(available_range),
        baseline_range: Some(baseline_range),
        comparison_range: Some(comparison_range),
        series,
    })
}

fn parse_training_bounds(
    available_range: &TrainingDateRange,
) -> Result<(NaiveDate, NaiveDate), ApplicationError> {
    let earliest = parse_training_date(&available_range.from)
        .map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
    let latest = parse_training_date(&available_range.through)
        .map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
    if earliest > latest {
        return Err(ApplicationError::Query(
            "training bounds are not ordered".to_owned(),
        ));
    }
    Ok((earliest, latest))
}

fn validate_training_range(
    range: &TrainingDateRange,
    earliest: NaiveDate,
    latest: NaiveDate,
) -> Result<(NaiveDate, NaiveDate), ApplicationError> {
    let from = parse_training_date(&range.from).map_err(ApplicationError::InvalidTrainingRange)?;
    let through =
        parse_training_date(&range.through).map_err(ApplicationError::InvalidTrainingRange)?;
    if from > through {
        return Err(ApplicationError::InvalidTrainingRange(
            "range dates are not ordered",
        ));
    }
    if from < earliest || through > latest {
        return Err(ApplicationError::InvalidTrainingRange(
            "range is outside available training history",
        ));
    }
    if through.signed_duration_since(from).num_days() + 1 > MAX_TRAINING_RANGE_DAYS {
        return Err(ApplicationError::InvalidTrainingRange(
            "range exceeds 366 inclusive calendar days",
        ));
    }
    Ok((from, through))
}

fn parse_training_date(value: &str) -> Result<NaiveDate, &'static str> {
    let parsed =
        NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|_| "training date is invalid")?;
    if parsed.format("%Y-%m-%d").to_string() != value {
        return Err("training date is not canonical");
    }
    Ok(parsed)
}

fn parse_training_local_datetime(value: &str) -> Result<NaiveDateTime, &'static str> {
    let (seconds, fractional) = value
        .split_once('.')
        .map_or((value, None), |(seconds, fractional)| {
            (seconds, Some(fractional))
        });
    if seconds.len() != 19
        || fractional.is_some_and(|fractional| {
            fractional.is_empty()
                || fractional.len() > 9
                || !fractional.bytes().all(|byte| byte.is_ascii_digit())
        })
    {
        return Err("training local date-time is not canonical");
    }
    NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S%.f")
        .map_err(|_| "training local date-time is invalid")
}

fn build_training_series(
    from: NaiveDate,
    through: NaiveDate,
    origins: Vec<String>,
    sessions: Vec<TrainingSession>,
) -> Result<Vec<TrainingSeriesOverview>, ApplicationError> {
    let mut observations = BTreeMap::<String, Vec<(NaiveDateTime, TrainingSessionInsight)>>::new();
    for origin in origins {
        if origin.is_empty() {
            return Err(ApplicationError::Query(
                "training query returned an empty origin".to_owned(),
            ));
        }
        if observations.insert(origin, Vec::new()).is_some() {
            return Err(ApplicationError::Query(
                "training query returned a duplicate origin".to_owned(),
            ));
        }
    }
    if observations.is_empty() {
        return Err(ApplicationError::Query(
            "training bounds exist without an origin".to_owned(),
        ));
    }

    let mut identities = BTreeSet::new();
    for session in sessions {
        validate_training_session(&session)?;
        let started_at = parse_training_local_datetime(&session.started_at_local)
            .map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
        if started_at.date() < from || started_at.date() > through {
            return Err(ApplicationError::Query(
                "training query returned a session outside its range".to_owned(),
            ));
        }
        let identity = (session.origin_id.clone(), session.session_id.clone());
        if !identities.insert(identity) {
            return Err(ApplicationError::Query(
                "training query returned a duplicate logical session".to_owned(),
            ));
        }
        let origin = observations.get_mut(&session.origin_id).ok_or_else(|| {
            ApplicationError::Query("training query returned an unknown origin".to_owned())
        })?;
        origin.push((
            started_at,
            TrainingSessionInsight {
                session_ref: session.session_id,
                started_at_local: session.started_at_local,
                stopped_at_local: session.stopped_at_local,
                utc_offset_minutes: session.utc_offset_minutes,
                duration_milliseconds: session.duration_milliseconds,
                distance_meters: session.distance_meters,
                energy_kilocalories: session.energy_kilocalories,
                average_heart_rate_bpm: session.average_heart_rate_bpm,
                maximum_heart_rate_bpm: session.maximum_heart_rate_bpm,
                sport_ref: session.sport_ref,
                exercise_count: session.exercise_count,
            },
        ));
    }

    observations
        .into_iter()
        .map(|(series_ref, mut sessions)| {
            sessions.sort_by(|(left_time, left), (right_time, right)| {
                right_time
                    .cmp(left_time)
                    .then_with(|| left.session_ref.cmp(&right.session_ref))
            });
            build_training_series_overview(series_ref, from, through, sessions)
        })
        .collect()
}

fn validate_training_session(session: &TrainingSession) -> Result<(), ApplicationError> {
    if session.origin_id.is_empty() || session.session_id.is_empty() {
        return Err(ApplicationError::Query(
            "training query returned an empty identity".to_owned(),
        ));
    }
    parse_training_local_datetime(&session.started_at_local)
        .map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
    parse_training_local_datetime(&session.stopped_at_local)
        .map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
    if session.duration_milliseconds < 0 {
        return Err(ApplicationError::Query(
            "training query returned a negative duration".to_owned(),
        ));
    }
    if session
        .distance_meters
        .is_some_and(|value| !value.is_finite() || value < 0.0)
    {
        return Err(ApplicationError::Query(
            "training query returned an invalid distance".to_owned(),
        ));
    }
    if session.energy_kilocalories.is_some_and(|value| value < 0)
        || session
            .average_heart_rate_bpm
            .is_some_and(|value| value < 0)
        || session
            .maximum_heart_rate_bpm
            .is_some_and(|value| value < 0)
    {
        return Err(ApplicationError::Query(
            "training query returned a negative measurement".to_owned(),
        ));
    }
    if session
        .average_heart_rate_bpm
        .zip(session.maximum_heart_rate_bpm)
        .is_some_and(|(average, maximum)| average > maximum)
    {
        return Err(ApplicationError::Query(
            "training query returned inconsistent heart rates".to_owned(),
        ));
    }
    if session.sport_ref.as_ref().is_some_and(String::is_empty) {
        return Err(ApplicationError::Query(
            "training query returned an empty sport reference".to_owned(),
        ));
    }
    Ok(())
}

fn build_training_series_overview(
    series_ref: String,
    from: NaiveDate,
    through: NaiveDate,
    sessions: Vec<(NaiveDateTime, TrainingSessionInsight)>,
) -> Result<TrainingSeriesOverview, ApplicationError> {
    let calendar_days = usize::try_from(through.signed_duration_since(from).num_days() + 1)
        .map_err(|_| ApplicationError::Query("training range is too large".to_owned()))?;
    let mut training_dates = BTreeSet::new();
    let mut total_duration_milliseconds = 0_i128;
    let mut distance_session_count = 0_usize;
    let mut total_distance_meters = 0.0_f64;
    let mut energy_session_count = 0_usize;
    let mut total_energy_kilocalories = 0_i128;
    let mut heart_rate_session_count = 0_usize;

    for (started_at, session) in &sessions {
        training_dates.insert(started_at.date());
        total_duration_milliseconds = total_duration_milliseconds
            .checked_add(i128::from(session.duration_milliseconds))
            .ok_or_else(|| {
                ApplicationError::Query("training duration total overflowed".to_owned())
            })?;
        if let Some(distance) = session.distance_meters {
            distance_session_count = distance_session_count.checked_add(1).ok_or_else(|| {
                ApplicationError::Query("training distance coverage overflowed".to_owned())
            })?;
            total_distance_meters += distance;
            if !total_distance_meters.is_finite() {
                return Err(ApplicationError::Query(
                    "training distance total overflowed".to_owned(),
                ));
            }
        }
        if let Some(energy) = session.energy_kilocalories {
            energy_session_count = energy_session_count.checked_add(1).ok_or_else(|| {
                ApplicationError::Query("training energy coverage overflowed".to_owned())
            })?;
            total_energy_kilocalories = total_energy_kilocalories
                .checked_add(i128::from(energy))
                .ok_or_else(|| {
                ApplicationError::Query("training energy total overflowed".to_owned())
            })?;
        }
        if session.average_heart_rate_bpm.is_some() || session.maximum_heart_rate_bpm.is_some() {
            heart_rate_session_count =
                heart_rate_session_count.checked_add(1).ok_or_else(|| {
                    ApplicationError::Query("training heart-rate coverage overflowed".to_owned())
                })?;
        }
    }

    Ok(TrainingSeriesOverview {
        series_ref,
        summary: TrainingSeriesSummary {
            calendar_days,
            training_days: training_dates.len(),
            session_count: sessions.len(),
            total_duration_milliseconds,
            distance_session_count,
            total_distance_meters: (distance_session_count > 0).then_some(total_distance_meters),
            energy_session_count,
            total_energy_kilocalories: (energy_session_count > 0)
                .then_some(total_energy_kilocalories),
            heart_rate_session_count,
        },
        sessions: sessions.into_iter().map(|(_, session)| session).collect(),
    })
}

fn count_change(baseline: usize, comparison: usize) -> Result<i128, ApplicationError> {
    let baseline = i128::try_from(baseline)
        .map_err(|_| ApplicationError::Query("training count is too large".to_owned()))?;
    let comparison = i128::try_from(comparison)
        .map_err(|_| ApplicationError::Query("training count is too large".to_owned()))?;
    Ok(comparison - baseline)
}

fn optional_float_change(baseline: Option<f64>, comparison: Option<f64>) -> Option<f64> {
    baseline
        .zip(comparison)
        .map(|(from, through)| through - from)
}

pub fn query_latest_import_outcome(
    port: &dyn ImportOutcomeLibraryPort,
) -> Result<Option<ImportOutcome>, ApplicationError> {
    port.latest_import_outcome()
        .map_err(ApplicationError::OutcomeQuery)
}

pub fn load_locale_preference(
    port: &dyn LocalePreferencePort,
) -> Result<Option<LocalePreference>, ApplicationError> {
    port.load_locale()
        .map_err(ApplicationError::PreferenceQuery)
}

pub fn save_locale_preference(
    port: &dyn LocalePreferencePort,
    locale: LocalePreference,
) -> Result<(), ApplicationError> {
    port.save_locale(locale)
        .map_err(ApplicationError::PreferenceUpdate)
}

#[cfg(test)]
mod tests {
    use super::*;

    struct ControlledImportPort;

    struct ControlledActivityPort {
        bounds: Option<ActivityDateRange>,
        activities: Vec<DailyActivity>,
    }

    struct ControlledOutcomePort;

    struct ControlledLocalePort;

    impl ArchiveImportPort for ControlledImportPort {
        fn import_archive(
            &self,
            _archive_path: &Path,
            cancellation: &AtomicBool,
            _on_progress: &mut dyn FnMut(ImportProgress),
        ) -> Result<ImportReport, String> {
            assert!(!cancellation.load(Ordering::Relaxed));
            Ok(ImportReport::assessed())
        }
    }

    impl ActivityLibraryPort for ControlledActivityPort {
        fn activity_bounds(&self) -> Result<Option<ActivityDateRange>, String> {
            Ok(self.bounds.clone())
        }

        fn activity_origins(&self) -> Result<Vec<String>, String> {
            Ok(vec!["origin-a".to_owned(), "origin-b".to_owned()])
        }

        fn query_activity(&self, range: &ActivityDateRange) -> Result<Vec<DailyActivity>, String> {
            assert_eq!(range.from, "2026-01-17");
            assert_eq!(range.through, "2026-02-15");
            Ok(self.activities.clone())
        }
    }

    impl ImportOutcomeLibraryPort for ControlledOutcomePort {
        fn latest_import_outcome(&self) -> Result<Option<ImportOutcome>, String> {
            Ok(None)
        }
    }

    impl LocalePreferencePort for ControlledLocalePort {
        fn load_locale(&self) -> Result<Option<LocalePreference>, String> {
            Ok(Some(LocalePreference::EsEs))
        }

        fn save_locale(&self, locale: LocalePreference) -> Result<(), String> {
            assert_eq!(locale, LocalePreference::EnUs);
            Ok(())
        }
    }

    #[test]
    fn coordinates_one_import_and_releases_the_slot_after_execution() {
        let coordinator = ImportCoordinator::default();
        let mut progress = |_| {};

        import_archive(
            &ControlledImportPort,
            &coordinator,
            Path::new("synthetic.zip"),
            &mut progress,
        )
        .expect("first import");

        assert!(!coordinator.cancel().expect("no active import"));
        import_archive(
            &ControlledImportPort,
            &coordinator,
            Path::new("synthetic.zip"),
            &mut progress,
        )
        .expect("subsequent import");
    }

    #[test]
    fn queries_the_latest_outcome_through_a_dedicated_read_port() {
        assert_eq!(
            query_latest_import_outcome(&ControlledOutcomePort).expect("outcome query"),
            None
        );
    }

    #[test]
    fn builds_a_gap_aware_default_activity_overview_without_combining_origins() {
        let overview = query_default_activity_overview(&ControlledActivityPort {
            bounds: Some(ActivityDateRange {
                from: "2026-01-01".to_owned(),
                through: "2026-02-15".to_owned(),
            }),
            activities: vec![
                DailyActivity {
                    origin_id: "origin-b".to_owned(),
                    local_date: "2026-01-17".to_owned(),
                    step_count: Some(50),
                },
                DailyActivity {
                    origin_id: "origin-a".to_owned(),
                    local_date: "2026-01-17".to_owned(),
                    step_count: Some(100),
                },
                DailyActivity {
                    origin_id: "origin-a".to_owned(),
                    local_date: "2026-01-18".to_owned(),
                    step_count: None,
                },
                DailyActivity {
                    origin_id: "origin-a".to_owned(),
                    local_date: "2026-01-20".to_owned(),
                    step_count: Some(201),
                },
            ],
        })
        .expect("activity overview");

        assert_eq!(
            overview.available_range,
            Some(ActivityDateRange {
                from: "2026-01-01".to_owned(),
                through: "2026-02-15".to_owned(),
            })
        );
        assert_eq!(
            overview.selected_range,
            Some(ActivityDateRange {
                from: "2026-01-17".to_owned(),
                through: "2026-02-15".to_owned(),
            })
        );
        assert_eq!(overview.series.len(), 2);

        let origin_a = &overview.series[0];
        assert_eq!(origin_a.series_ref, "origin-a");
        assert_eq!(origin_a.summary.calendar_days, 30);
        assert_eq!(origin_a.summary.observed_days, 3);
        assert_eq!(origin_a.summary.available_step_days, 2);
        assert_eq!(origin_a.summary.unavailable_step_days, 1);
        assert_eq!(origin_a.summary.missing_days, 27);
        assert_eq!(origin_a.summary.total_step_count, Some(301));
        assert_eq!(origin_a.summary.average_step_count, Some(151));
        assert_eq!(origin_a.days.len(), 30);
        assert_eq!(
            origin_a.days[0].availability,
            ActivityDayAvailability::Available
        );
        assert_eq!(
            origin_a.days[1].availability,
            ActivityDayAvailability::Unavailable
        );
        assert_eq!(
            origin_a.days[2].availability,
            ActivityDayAvailability::Missing
        );
        assert_eq!(origin_a.days[3].step_count, Some(201));

        let origin_b = &overview.series[1];
        assert_eq!(origin_b.series_ref, "origin-b");
        assert_eq!(origin_b.summary.observed_days, 1);
        assert_eq!(origin_b.summary.missing_days, 29);
        assert_eq!(origin_b.summary.total_step_count, Some(50));
    }

    #[test]
    fn builds_an_explicit_activity_range_when_every_selected_date_is_missing() {
        struct ExplicitRangePort;

        impl ActivityLibraryPort for ExplicitRangePort {
            fn activity_bounds(&self) -> Result<Option<ActivityDateRange>, String> {
                Ok(Some(ActivityDateRange {
                    from: "2024-01-01".to_owned(),
                    through: "2026-01-31".to_owned(),
                }))
            }

            fn activity_origins(&self) -> Result<Vec<String>, String> {
                Ok(vec!["origin-a".to_owned()])
            }

            fn query_activity(
                &self,
                range: &ActivityDateRange,
            ) -> Result<Vec<DailyActivity>, String> {
                assert_eq!(range.from, "2025-12-30");
                assert_eq!(range.through, "2026-01-02");
                Ok(Vec::new())
            }
        }

        let overview = query_activity_overview(
            &ExplicitRangePort,
            Some(ActivityDateRange {
                from: "2025-12-30".to_owned(),
                through: "2026-01-02".to_owned(),
            }),
        )
        .expect("explicit activity overview");

        assert_eq!(
            overview.selected_range,
            Some(ActivityDateRange {
                from: "2025-12-30".to_owned(),
                through: "2026-01-02".to_owned(),
            })
        );
        assert_eq!(overview.series[0].summary.calendar_days, 4);
        assert_eq!(overview.series[0].summary.missing_days, 4);
        assert!(overview.series[0]
            .days
            .iter()
            .all(|day| day.availability == ActivityDayAvailability::Missing));
    }

    #[test]
    fn compares_two_activity_periods_per_origin_without_hiding_coverage() {
        struct ComparisonPort;

        impl ActivityLibraryPort for ComparisonPort {
            fn activity_bounds(&self) -> Result<Option<ActivityDateRange>, String> {
                Ok(Some(ActivityDateRange {
                    from: "2026-01-01".to_owned(),
                    through: "2026-01-10".to_owned(),
                }))
            }

            fn activity_origins(&self) -> Result<Vec<String>, String> {
                Ok(vec!["origin-b".to_owned(), "origin-a".to_owned()])
            }

            fn query_activity(
                &self,
                range: &ActivityDateRange,
            ) -> Result<Vec<DailyActivity>, String> {
                match (range.from.as_str(), range.through.as_str()) {
                    ("2026-01-01", "2026-01-02") => Ok(vec![
                        DailyActivity {
                            origin_id: "origin-a".to_owned(),
                            local_date: "2026-01-01".to_owned(),
                            step_count: Some(100),
                        },
                        DailyActivity {
                            origin_id: "origin-a".to_owned(),
                            local_date: "2026-01-02".to_owned(),
                            step_count: None,
                        },
                    ]),
                    ("2026-01-04", "2026-01-05") => Ok(vec![
                        DailyActivity {
                            origin_id: "origin-a".to_owned(),
                            local_date: "2026-01-04".to_owned(),
                            step_count: Some(150),
                        },
                        DailyActivity {
                            origin_id: "origin-a".to_owned(),
                            local_date: "2026-01-05".to_owned(),
                            step_count: Some(250),
                        },
                    ]),
                    _ => panic!("unexpected comparison range"),
                }
            }
        }

        let comparison = query_activity_comparison(
            &ComparisonPort,
            ActivityDateRange {
                from: "2026-01-01".to_owned(),
                through: "2026-01-02".to_owned(),
            },
            ActivityDateRange {
                from: "2026-01-04".to_owned(),
                through: "2026-01-05".to_owned(),
            },
        )
        .expect("activity comparison");

        assert_eq!(comparison.series.len(), 2);
        let origin_a = &comparison.series[0];
        assert_eq!(origin_a.series_ref, "origin-a");
        assert_eq!(origin_a.baseline.total_step_count, Some(100));
        assert_eq!(origin_a.baseline.unavailable_step_days, 1);
        assert_eq!(origin_a.comparison.total_step_count, Some(400));
        assert_eq!(origin_a.total_step_change, Some(300));
        assert_eq!(origin_a.average_step_change, Some(100));

        let origin_b = &comparison.series[1];
        assert_eq!(origin_b.baseline.missing_days, 2);
        assert_eq!(origin_b.comparison.missing_days, 2);
        assert_eq!(origin_b.total_step_change, None);
        assert_eq!(origin_b.average_step_change, None);
    }

    #[test]
    fn rejects_invalid_out_of_bounds_and_oversized_explicit_activity_ranges() {
        struct RangeValidationPort;

        impl ActivityLibraryPort for RangeValidationPort {
            fn activity_bounds(&self) -> Result<Option<ActivityDateRange>, String> {
                Ok(Some(ActivityDateRange {
                    from: "2024-01-01".to_owned(),
                    through: "2026-12-31".to_owned(),
                }))
            }

            fn activity_origins(&self) -> Result<Vec<String>, String> {
                panic!("invalid ranges must stop before origin retrieval")
            }

            fn query_activity(
                &self,
                _range: &ActivityDateRange,
            ) -> Result<Vec<DailyActivity>, String> {
                panic!("invalid ranges must stop before fact retrieval")
            }
        }

        for range in [
            ActivityDateRange {
                from: "2026-02-30".to_owned(),
                through: "2026-03-01".to_owned(),
            },
            ActivityDateRange {
                from: "2026-03-02".to_owned(),
                through: "2026-03-01".to_owned(),
            },
            ActivityDateRange {
                from: "2023-12-31".to_owned(),
                through: "2024-01-01".to_owned(),
            },
            ActivityDateRange {
                from: "2026-12-31".to_owned(),
                through: "2027-01-01".to_owned(),
            },
            ActivityDateRange {
                from: "2025-01-01".to_owned(),
                through: "2026-01-02".to_owned(),
            },
        ] {
            assert!(matches!(
                query_activity_overview(&RangeValidationPort, Some(range.clone())),
                Err(ApplicationError::InvalidActivityRange(_))
            ));
            assert!(matches!(
                query_activity_comparison(
                    &RangeValidationPort,
                    range,
                    ActivityDateRange {
                        from: "2026-01-01".to_owned(),
                        through: "2026-01-02".to_owned(),
                    },
                ),
                Err(ApplicationError::InvalidActivityRange(_))
            ));
        }
    }

    #[test]
    fn returns_an_empty_activity_overview_without_querying_a_range() {
        struct EmptyActivityPort;

        impl ActivityLibraryPort for EmptyActivityPort {
            fn activity_bounds(&self) -> Result<Option<ActivityDateRange>, String> {
                Ok(None)
            }

            fn activity_origins(&self) -> Result<Vec<String>, String> {
                panic!("an empty library has no origins to query")
            }

            fn query_activity(
                &self,
                _range: &ActivityDateRange,
            ) -> Result<Vec<DailyActivity>, String> {
                panic!("an empty library has no range to query")
            }
        }

        assert_eq!(
            query_default_activity_overview(&EmptyActivityPort).expect("empty overview"),
            ActivityOverview {
                available_range: None,
                selected_range: None,
                series: Vec::new(),
            }
        );
        assert_eq!(
            query_activity_comparison(
                &EmptyActivityPort,
                ActivityDateRange {
                    from: "2026-01-01".to_owned(),
                    through: "2026-01-02".to_owned(),
                },
                ActivityDateRange {
                    from: "2026-01-03".to_owned(),
                    through: "2026-01-04".to_owned(),
                },
            )
            .expect("empty comparison"),
            ActivityComparison {
                available_range: None,
                baseline_range: None,
                comparison_range: None,
                series: Vec::new(),
            }
        );
    }

    #[test]
    fn rejects_invalid_or_reversed_activity_bounds_without_querying_facts() {
        struct InvalidBoundsPort(ActivityDateRange);

        impl ActivityLibraryPort for InvalidBoundsPort {
            fn activity_bounds(&self) -> Result<Option<ActivityDateRange>, String> {
                Ok(Some(self.0.clone()))
            }

            fn activity_origins(&self) -> Result<Vec<String>, String> {
                panic!("invalid bounds must stop before origin retrieval")
            }

            fn query_activity(
                &self,
                _range: &ActivityDateRange,
            ) -> Result<Vec<DailyActivity>, String> {
                panic!("invalid bounds must stop before fact retrieval")
            }
        }

        for bounds in [
            ActivityDateRange {
                from: "2026-02-30".to_owned(),
                through: "2026-03-01".to_owned(),
            },
            ActivityDateRange {
                from: "2026-03-02".to_owned(),
                through: "2026-03-01".to_owned(),
            },
        ] {
            assert!(matches!(
                query_default_activity_overview(&InvalidBoundsPort(bounds)),
                Err(ApplicationError::Query(_))
            ));
        }
    }

    #[test]
    fn rejects_invalid_activity_facts_instead_of_building_a_partial_overview() {
        struct InvalidFactsPort(Vec<DailyActivity>);

        impl ActivityLibraryPort for InvalidFactsPort {
            fn activity_bounds(&self) -> Result<Option<ActivityDateRange>, String> {
                Ok(Some(ActivityDateRange {
                    from: "2026-01-01".to_owned(),
                    through: "2026-01-03".to_owned(),
                }))
            }

            fn activity_origins(&self) -> Result<Vec<String>, String> {
                Ok(vec!["origin".to_owned()])
            }

            fn query_activity(
                &self,
                _range: &ActivityDateRange,
            ) -> Result<Vec<DailyActivity>, String> {
                Ok(self.0.clone())
            }
        }

        let invalid_cases = [
            vec![DailyActivity {
                origin_id: "origin".to_owned(),
                local_date: "2026-02-30".to_owned(),
                step_count: Some(1),
            }],
            vec![DailyActivity {
                origin_id: "origin".to_owned(),
                local_date: "2025-12-31".to_owned(),
                step_count: Some(1),
            }],
            vec![DailyActivity {
                origin_id: "origin".to_owned(),
                local_date: "2026-01-01".to_owned(),
                step_count: Some(-1),
            }],
            vec![
                DailyActivity {
                    origin_id: "origin".to_owned(),
                    local_date: "2026-01-01".to_owned(),
                    step_count: Some(1),
                },
                DailyActivity {
                    origin_id: "origin".to_owned(),
                    local_date: "2026-01-01".to_owned(),
                    step_count: Some(1),
                },
            ],
        ];

        for activities in invalid_cases {
            assert!(matches!(
                query_default_activity_overview(&InvalidFactsPort(activities)),
                Err(ApplicationError::Query(_))
            ));
        }
    }

    #[test]
    fn rejects_inconsistent_activity_origin_catalogs() {
        struct InvalidOriginPort {
            origins: Vec<String>,
            activities: Vec<DailyActivity>,
        }

        impl ActivityLibraryPort for InvalidOriginPort {
            fn activity_bounds(&self) -> Result<Option<ActivityDateRange>, String> {
                Ok(Some(ActivityDateRange {
                    from: "2026-01-01".to_owned(),
                    through: "2026-01-01".to_owned(),
                }))
            }

            fn activity_origins(&self) -> Result<Vec<String>, String> {
                Ok(self.origins.clone())
            }

            fn query_activity(
                &self,
                _range: &ActivityDateRange,
            ) -> Result<Vec<DailyActivity>, String> {
                Ok(self.activities.clone())
            }
        }

        for port in [
            InvalidOriginPort {
                origins: Vec::new(),
                activities: Vec::new(),
            },
            InvalidOriginPort {
                origins: vec![String::new()],
                activities: Vec::new(),
            },
            InvalidOriginPort {
                origins: vec!["origin".to_owned(), "origin".to_owned()],
                activities: Vec::new(),
            },
            InvalidOriginPort {
                origins: vec!["known-origin".to_owned()],
                activities: vec![DailyActivity {
                    origin_id: "unknown-origin".to_owned(),
                    local_date: "2026-01-01".to_owned(),
                    step_count: Some(1),
                }],
            },
        ] {
            assert!(matches!(
                query_activity_overview(&port, None),
                Err(ApplicationError::Query(_))
            ));
        }
    }

    #[test]
    fn loads_and_updates_a_validated_locale_through_the_preference_port() {
        assert_eq!(
            LocalePreference::from_code("es-ES"),
            Some(LocalePreference::EsEs)
        );
        assert_eq!(LocalePreference::from_code("es"), None);
        assert_eq!(
            load_locale_preference(&ControlledLocalePort).expect("locale query"),
            Some(LocalePreference::EsEs)
        );
        save_locale_preference(&ControlledLocalePort, LocalePreference::EnUs)
            .expect("locale update");
    }

    fn training_session(
        origin_id: &str,
        session_id: &str,
        started_at_local: &str,
        duration_milliseconds: i64,
        distance_meters: Option<f64>,
        energy_kilocalories: Option<i64>,
    ) -> TrainingSession {
        TrainingSession {
            origin_id: origin_id.to_owned(),
            session_id: session_id.to_owned(),
            started_at_local: started_at_local.to_owned(),
            stopped_at_local: started_at_local.to_owned(),
            utc_offset_minutes: Some(60),
            duration_milliseconds,
            distance_meters,
            energy_kilocalories,
            average_heart_rate_bpm: Some(140),
            maximum_heart_rate_bpm: Some(170),
            sport_ref: Some("synthetic-sport".to_owned()),
            exercise_count: Some(1),
        }
    }

    struct ControlledTrainingPort {
        bounds: Option<TrainingDateRange>,
        expected_range: TrainingDateRange,
        origins: Vec<String>,
        sessions: Vec<TrainingSession>,
    }

    impl TrainingLibraryPort for ControlledTrainingPort {
        fn training_bounds(&self) -> Result<Option<TrainingDateRange>, String> {
            Ok(self.bounds.clone())
        }

        fn training_origins(&self) -> Result<Vec<String>, String> {
            Ok(self.origins.clone())
        }

        fn query_training(
            &self,
            range: &TrainingDateRange,
        ) -> Result<Vec<TrainingSession>, String> {
            assert_eq!(range, &self.expected_range);
            Ok(self.sessions.clone())
        }
    }

    #[test]
    fn builds_a_default_training_overview_with_exact_metric_coverage() {
        let overview = query_default_training_overview(&ControlledTrainingPort {
            bounds: Some(TrainingDateRange {
                from: "2026-01-01".to_owned(),
                through: "2026-02-15".to_owned(),
            }),
            expected_range: TrainingDateRange {
                from: "2026-01-17".to_owned(),
                through: "2026-02-15".to_owned(),
            },
            origins: vec!["origin-b".to_owned(), "origin-a".to_owned()],
            sessions: vec![
                training_session(
                    "origin-a",
                    "earlier",
                    "2026-01-18T08:00:00",
                    1_800_000,
                    None,
                    Some(250),
                ),
                training_session(
                    "origin-b",
                    "other-origin",
                    "2026-01-20T10:00:00.123",
                    3_600_000,
                    Some(10_000.5),
                    None,
                ),
                training_session(
                    "origin-a",
                    "later",
                    "2026-01-20T09:00:00",
                    3_600_000,
                    Some(5_000.25),
                    Some(500),
                ),
            ],
        })
        .expect("training overview");

        assert_eq!(
            overview.selected_range,
            Some(TrainingDateRange {
                from: "2026-01-17".to_owned(),
                through: "2026-02-15".to_owned(),
            })
        );
        assert_eq!(overview.series.len(), 2);
        let origin_a = &overview.series[0];
        assert_eq!(origin_a.series_ref, "origin-a");
        assert_eq!(origin_a.summary.calendar_days, 30);
        assert_eq!(origin_a.summary.training_days, 2);
        assert_eq!(origin_a.summary.session_count, 2);
        assert_eq!(origin_a.summary.total_duration_milliseconds, 5_400_000);
        assert_eq!(origin_a.summary.distance_session_count, 1);
        assert_eq!(origin_a.summary.total_distance_meters, Some(5_000.25));
        assert_eq!(origin_a.summary.energy_session_count, 2);
        assert_eq!(origin_a.summary.total_energy_kilocalories, Some(750));
        assert_eq!(origin_a.summary.heart_rate_session_count, 2);
        assert_eq!(origin_a.sessions[0].session_ref, "later");
        assert_eq!(origin_a.sessions[1].session_ref, "earlier");

        let origin_b = &overview.series[1];
        assert_eq!(origin_b.summary.training_days, 1);
        assert_eq!(origin_b.summary.session_count, 1);
        assert_eq!(origin_b.summary.energy_session_count, 0);
        assert_eq!(origin_b.summary.total_energy_kilocalories, None);
    }

    #[test]
    fn compares_training_periods_per_origin_without_hiding_metric_coverage() {
        struct ComparisonTrainingPort;

        impl TrainingLibraryPort for ComparisonTrainingPort {
            fn training_bounds(&self) -> Result<Option<TrainingDateRange>, String> {
                Ok(Some(TrainingDateRange {
                    from: "2026-01-01".to_owned(),
                    through: "2026-01-10".to_owned(),
                }))
            }

            fn training_origins(&self) -> Result<Vec<String>, String> {
                Ok(vec!["origin-b".to_owned(), "origin-a".to_owned()])
            }

            fn query_training(
                &self,
                range: &TrainingDateRange,
            ) -> Result<Vec<TrainingSession>, String> {
                match (range.from.as_str(), range.through.as_str()) {
                    ("2026-01-01", "2026-01-02") => Ok(vec![training_session(
                        "origin-a",
                        "baseline",
                        "2026-01-01T10:00:00",
                        1_800_000,
                        None,
                        Some(200),
                    )]),
                    ("2026-01-04", "2026-01-05") => Ok(vec![
                        training_session(
                            "origin-a",
                            "comparison-a",
                            "2026-01-04T10:00:00",
                            3_600_000,
                            Some(5_000.0),
                            Some(400),
                        ),
                        training_session(
                            "origin-a",
                            "comparison-b",
                            "2026-01-05T10:00:00",
                            1_800_000,
                            None,
                            None,
                        ),
                    ]),
                    _ => panic!("unexpected training comparison range"),
                }
            }
        }

        let comparison = query_training_comparison(
            &ComparisonTrainingPort,
            TrainingDateRange {
                from: "2026-01-01".to_owned(),
                through: "2026-01-02".to_owned(),
            },
            TrainingDateRange {
                from: "2026-01-04".to_owned(),
                through: "2026-01-05".to_owned(),
            },
        )
        .expect("training comparison");

        let origin_a = &comparison.series[0];
        assert_eq!(origin_a.session_count_change, 1);
        assert_eq!(origin_a.training_day_change, 1);
        assert_eq!(origin_a.duration_milliseconds_change, 3_600_000);
        assert_eq!(origin_a.distance_meters_change, None);
        assert_eq!(origin_a.energy_kilocalories_change, Some(200));
        assert_eq!(origin_a.baseline.distance_session_count, 0);
        assert_eq!(origin_a.comparison.distance_session_count, 1);

        let origin_b = &comparison.series[1];
        assert_eq!(origin_b.session_count_change, 0);
        assert_eq!(origin_b.distance_meters_change, None);
        assert_eq!(origin_b.energy_kilocalories_change, None);
    }

    #[test]
    fn rejects_invalid_training_facts_and_inconsistent_origin_catalogs() {
        let valid = training_session(
            "origin",
            "session",
            "2026-01-02T10:00:00",
            1_000,
            Some(100.0),
            Some(10),
        );
        let mut invalid_cases = Vec::new();

        let mut empty_session = valid.clone();
        empty_session.session_id.clear();
        invalid_cases.push(empty_session);

        let mut invalid_date = valid.clone();
        invalid_date.started_at_local = "2026-02-30T10:00:00".to_owned();
        invalid_cases.push(invalid_date);

        let mut outside_range = valid.clone();
        outside_range.started_at_local = "2025-12-31T10:00:00".to_owned();
        invalid_cases.push(outside_range);

        let mut negative_duration = valid.clone();
        negative_duration.duration_milliseconds = -1;
        invalid_cases.push(negative_duration);

        let mut invalid_distance = valid.clone();
        invalid_distance.distance_meters = Some(f64::NAN);
        invalid_cases.push(invalid_distance);

        let mut inverted_heart_rate = valid.clone();
        inverted_heart_rate.average_heart_rate_bpm = Some(180);
        invalid_cases.push(inverted_heart_rate);

        for session in invalid_cases {
            assert!(matches!(
                query_training_overview(
                    &ControlledTrainingPort {
                        bounds: Some(TrainingDateRange {
                            from: "2026-01-01".to_owned(),
                            through: "2026-01-30".to_owned(),
                        }),
                        expected_range: TrainingDateRange {
                            from: "2026-01-01".to_owned(),
                            through: "2026-01-30".to_owned(),
                        },
                        origins: vec!["origin".to_owned()],
                        sessions: vec![session],
                    },
                    None,
                ),
                Err(ApplicationError::Query(_))
            ));
        }

        for origins in [
            Vec::new(),
            vec![String::new()],
            vec!["origin".to_owned(), "origin".to_owned()],
        ] {
            assert!(matches!(
                query_training_overview(
                    &ControlledTrainingPort {
                        bounds: Some(TrainingDateRange {
                            from: "2026-01-01".to_owned(),
                            through: "2026-01-30".to_owned(),
                        }),
                        expected_range: TrainingDateRange {
                            from: "2026-01-01".to_owned(),
                            through: "2026-01-30".to_owned(),
                        },
                        origins,
                        sessions: Vec::new(),
                    },
                    None,
                ),
                Err(ApplicationError::Query(_))
            ));
        }
    }

    #[test]
    fn rejects_invalid_out_of_bounds_and_oversized_training_ranges_before_fact_queries() {
        struct RangeValidationTrainingPort;

        impl TrainingLibraryPort for RangeValidationTrainingPort {
            fn training_bounds(&self) -> Result<Option<TrainingDateRange>, String> {
                Ok(Some(TrainingDateRange {
                    from: "2024-01-01".to_owned(),
                    through: "2026-12-31".to_owned(),
                }))
            }

            fn training_origins(&self) -> Result<Vec<String>, String> {
                panic!("invalid training ranges must stop before origin retrieval")
            }

            fn query_training(
                &self,
                _range: &TrainingDateRange,
            ) -> Result<Vec<TrainingSession>, String> {
                panic!("invalid training ranges must stop before fact retrieval")
            }
        }

        for range in [
            TrainingDateRange {
                from: "2026-02-30".to_owned(),
                through: "2026-03-01".to_owned(),
            },
            TrainingDateRange {
                from: "2026-03-02".to_owned(),
                through: "2026-03-01".to_owned(),
            },
            TrainingDateRange {
                from: "2023-12-31".to_owned(),
                through: "2024-01-01".to_owned(),
            },
            TrainingDateRange {
                from: "2026-12-31".to_owned(),
                through: "2027-01-01".to_owned(),
            },
            TrainingDateRange {
                from: "2025-01-01".to_owned(),
                through: "2026-01-02".to_owned(),
            },
        ] {
            assert!(matches!(
                query_training_overview(&RangeValidationTrainingPort, Some(range.clone())),
                Err(ApplicationError::InvalidTrainingRange(_))
            ));
            assert!(matches!(
                query_training_comparison(
                    &RangeValidationTrainingPort,
                    range,
                    TrainingDateRange {
                        from: "2026-01-01".to_owned(),
                        through: "2026-01-02".to_owned(),
                    },
                ),
                Err(ApplicationError::InvalidTrainingRange(_))
            ));
        }
    }

    #[test]
    fn returns_empty_training_read_models_without_querying_facts() {
        struct EmptyTrainingPort;

        impl TrainingLibraryPort for EmptyTrainingPort {
            fn training_bounds(&self) -> Result<Option<TrainingDateRange>, String> {
                Ok(None)
            }

            fn training_origins(&self) -> Result<Vec<String>, String> {
                panic!("an empty training library has no origins")
            }

            fn query_training(
                &self,
                _range: &TrainingDateRange,
            ) -> Result<Vec<TrainingSession>, String> {
                panic!("an empty training library has no range")
            }
        }

        assert_eq!(
            query_default_training_overview(&EmptyTrainingPort).expect("empty training overview"),
            TrainingOverview {
                available_range: None,
                selected_range: None,
                series: Vec::new(),
            }
        );
        assert_eq!(
            query_training_comparison(
                &EmptyTrainingPort,
                TrainingDateRange {
                    from: "2026-01-01".to_owned(),
                    through: "2026-01-02".to_owned(),
                },
                TrainingDateRange {
                    from: "2026-01-03".to_owned(),
                    through: "2026-01-04".to_owned(),
                },
            )
            .expect("empty training comparison"),
            TrainingComparison {
                available_range: None,
                baseline_range: None,
                comparison_range: None,
                series: Vec::new(),
            }
        );
    }
}
