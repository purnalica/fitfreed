use std::collections::{BTreeMap, BTreeSet, HashSet};

use chrono::{Days, NaiveDate};
use fitfreed_domain::{DailyActivity, NightlyRecovery, SleepPeriod, TrainingSession};

use crate::{
    query_activity_comparison as query_domain_activity_comparison,
    query_activity_overview as query_domain_activity_overview,
    query_recovery_comparison as query_domain_recovery_comparison,
    query_recovery_overview as query_domain_recovery_overview,
    query_sleep_comparison as query_domain_sleep_comparison,
    query_sleep_overview as query_domain_sleep_overview,
    query_training_comparison as query_domain_training_comparison,
    query_training_overview as query_domain_training_overview, ActivityDateRange,
    ActivityDayAvailability, ActivityLibraryPort, ActivitySeriesComparison, ActivitySeriesOverview,
    ActivitySeriesSummary, ApplicationError, RecoveryDateRange, RecoveryDayAvailability,
    RecoveryLibraryNight, RecoveryLibraryPort, RecoverySeriesComparison, RecoverySeriesOverview,
    RecoverySeriesSummary, SleepDateRange, SleepDayAvailability, SleepLibraryPeriod,
    SleepLibraryPort, SleepSeriesComparison, SleepSeriesOverview, SleepSeriesSummary,
    TrainingDateRange, TrainingLibraryPort, TrainingSeriesComparison, TrainingSeriesOverview,
    TrainingSeriesSummary,
};

const DEFAULT_LONGITUDINAL_WINDOW_DAYS: u64 = 30;
const MAX_LONGITUDINAL_RANGE_DAYS: i64 = 366;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LongitudinalDateRange {
    pub from: String,
    pub through: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LongitudinalActivityDay {
    pub availability: ActivityDayAvailability,
    pub step_count: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LongitudinalTrainingDay {
    pub session_count: usize,
    pub total_duration_milliseconds: i128,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LongitudinalSleepDay {
    pub availability: SleepDayAvailability,
    pub asleep_milliseconds: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LongitudinalRecoveryDay {
    pub availability: RecoveryDayAvailability,
    pub beat_to_beat_interval_milliseconds: Option<i64>,
    pub heart_rate_variability_rmssd_milliseconds: Option<i64>,
    pub breathing_interval_milliseconds: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LongitudinalDayInsight {
    pub local_date: String,
    pub activity: LongitudinalActivityDay,
    pub training: LongitudinalTrainingDay,
    pub sleep: LongitudinalSleepDay,
    pub recovery: LongitudinalRecoveryDay,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LongitudinalSeriesOverview {
    pub series_ref: String,
    pub activity: ActivitySeriesSummary,
    pub training: TrainingSeriesSummary,
    pub sleep: SleepSeriesSummary,
    pub recovery: RecoverySeriesSummary,
    pub days: Vec<LongitudinalDayInsight>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LongitudinalOverview {
    pub available_range: Option<LongitudinalDateRange>,
    pub selected_range: Option<LongitudinalDateRange>,
    pub series: Vec<LongitudinalSeriesOverview>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LongitudinalActivityComparison {
    pub baseline: ActivitySeriesSummary,
    pub comparison: ActivitySeriesSummary,
    pub total_step_change: Option<i128>,
    pub average_step_change: Option<i128>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LongitudinalTrainingComparison {
    pub baseline: TrainingSeriesSummary,
    pub comparison: TrainingSeriesSummary,
    pub session_count_change: i128,
    pub training_day_change: i128,
    pub duration_milliseconds_change: i128,
    pub distance_meters_change: Option<f64>,
    pub energy_kilocalories_change: Option<i128>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LongitudinalSleepComparison {
    pub baseline: SleepSeriesSummary,
    pub comparison: SleepSeriesSummary,
    pub observed_night_change: i128,
    pub missing_night_change: i128,
    pub average_asleep_milliseconds_change: Option<i128>,
    pub average_interruption_milliseconds_change: Option<i128>,
    pub average_efficiency_percentage_point_change: Option<f64>,
    pub average_overall_score_change: Option<f64>,
    pub goal_met_percentage_point_change: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LongitudinalRecoveryComparison {
    pub baseline: RecoverySeriesSummary,
    pub comparison: RecoverySeriesSummary,
    pub observed_night_change: i128,
    pub missing_night_change: i128,
    pub average_beat_to_beat_interval_milliseconds_change: Option<i128>,
    pub average_heart_rate_variability_rmssd_milliseconds_change: Option<i128>,
    pub average_breathing_interval_milliseconds_change: Option<i128>,
    pub assessment_night_change: i128,
    pub baseline_night_change: i128,
    pub guidance_night_change: i128,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LongitudinalSeriesComparison {
    pub series_ref: String,
    pub activity: LongitudinalActivityComparison,
    pub training: LongitudinalTrainingComparison,
    pub sleep: LongitudinalSleepComparison,
    pub recovery: LongitudinalRecoveryComparison,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LongitudinalComparison {
    pub available_range: Option<LongitudinalDateRange>,
    pub baseline_range: Option<LongitudinalDateRange>,
    pub comparison_range: Option<LongitudinalDateRange>,
    pub series: Vec<LongitudinalSeriesComparison>,
}

pub trait LongitudinalLibraryPort:
    ActivityLibraryPort + TrainingLibraryPort + SleepLibraryPort + RecoveryLibraryPort
{
}

impl<T> LongitudinalLibraryPort for T where
    T: ActivityLibraryPort + TrainingLibraryPort + SleepLibraryPort + RecoveryLibraryPort
{
}

pub fn query_longitudinal_overview(
    port: &dyn LongitudinalLibraryPort,
    requested_range: Option<LongitudinalDateRange>,
) -> Result<LongitudinalOverview, ApplicationError> {
    let bounds = load_bounds(port)?;
    let Some(available_range) = global_range(&bounds)? else {
        return Ok(LongitudinalOverview {
            available_range: None,
            selected_range: None,
            series: Vec::new(),
        });
    };
    let selected_range = select_range(&available_range, requested_range)?;
    let origins = load_origins(port, &bounds)?;
    let adapters = SharedContextAdapters::new(port, &available_range, &origins);

    let activity =
        query_domain_activity_overview(&adapters.activity, Some(activity_range(&selected_range)))?;
    let training =
        query_domain_training_overview(&adapters.training, Some(training_range(&selected_range)))?;
    let sleep = query_domain_sleep_overview(&adapters.sleep, Some(sleep_range(&selected_range)))?;
    let recovery =
        query_domain_recovery_overview(&adapters.recovery, Some(recovery_range(&selected_range)))?;
    let series = combine_overviews(
        activity.series,
        training.series,
        sleep.series,
        recovery.series,
    )?;

    Ok(LongitudinalOverview {
        available_range: Some(available_range),
        selected_range: Some(selected_range),
        series,
    })
}

pub fn query_longitudinal_comparison(
    port: &dyn LongitudinalLibraryPort,
    baseline_range: LongitudinalDateRange,
    comparison_range: LongitudinalDateRange,
) -> Result<LongitudinalComparison, ApplicationError> {
    let bounds = load_bounds(port)?;
    let Some(available_range) = global_range(&bounds)? else {
        return Ok(LongitudinalComparison {
            available_range: None,
            baseline_range: None,
            comparison_range: None,
            series: Vec::new(),
        });
    };
    let baseline_range = select_range(&available_range, Some(baseline_range))?;
    let comparison_range = select_range(&available_range, Some(comparison_range))?;
    let origins = load_origins(port, &bounds)?;
    let adapters = SharedContextAdapters::new(port, &available_range, &origins);

    let activity = query_domain_activity_comparison(
        &adapters.activity,
        activity_range(&baseline_range),
        activity_range(&comparison_range),
    )?;
    let training = query_domain_training_comparison(
        &adapters.training,
        training_range(&baseline_range),
        training_range(&comparison_range),
    )?;
    let sleep = query_domain_sleep_comparison(
        &adapters.sleep,
        sleep_range(&baseline_range),
        sleep_range(&comparison_range),
    )?;
    let recovery = query_domain_recovery_comparison(
        &adapters.recovery,
        recovery_range(&baseline_range),
        recovery_range(&comparison_range),
    )?;
    let series = combine_comparisons(
        activity.series,
        training.series,
        sleep.series,
        recovery.series,
    )?;

    Ok(LongitudinalComparison {
        available_range: Some(available_range),
        baseline_range: Some(baseline_range),
        comparison_range: Some(comparison_range),
        series,
    })
}

#[derive(Clone)]
struct DomainBounds {
    activity: Option<LongitudinalDateRange>,
    training: Option<LongitudinalDateRange>,
    sleep: Option<LongitudinalDateRange>,
    recovery: Option<LongitudinalDateRange>,
}

fn load_bounds(port: &dyn LongitudinalLibraryPort) -> Result<DomainBounds, ApplicationError> {
    Ok(DomainBounds {
        activity: ActivityLibraryPort::activity_bounds(port)
            .map_err(ApplicationError::Query)?
            .map(|range| validated_bound(range.from, range.through, "activity"))
            .transpose()?,
        training: TrainingLibraryPort::training_bounds(port)
            .map_err(ApplicationError::Query)?
            .map(|range| validated_bound(range.from, range.through, "training"))
            .transpose()?,
        sleep: SleepLibraryPort::sleep_bounds(port)
            .map_err(ApplicationError::Query)?
            .map(|range| validated_bound(range.from, range.through, "sleep"))
            .transpose()?,
        recovery: RecoveryLibraryPort::recovery_bounds(port)
            .map_err(ApplicationError::Query)?
            .map(|range| validated_bound(range.from, range.through, "recovery"))
            .transpose()?,
    })
}

fn validated_bound(
    from: String,
    through: String,
    domain: &str,
) -> Result<LongitudinalDateRange, ApplicationError> {
    let parsed_from = parse_date(&from)
        .map_err(|reason| ApplicationError::Query(format!("{domain} bounds contain {reason}")))?;
    let parsed_through = parse_date(&through)
        .map_err(|reason| ApplicationError::Query(format!("{domain} bounds contain {reason}")))?;
    if parsed_from > parsed_through {
        return Err(ApplicationError::Query(format!(
            "{domain} bounds are not ordered"
        )));
    }
    Ok(LongitudinalDateRange { from, through })
}

fn global_range(bounds: &DomainBounds) -> Result<Option<LongitudinalDateRange>, ApplicationError> {
    let ranges = [
        bounds.activity.as_ref(),
        bounds.training.as_ref(),
        bounds.sleep.as_ref(),
        bounds.recovery.as_ref(),
    ];
    let mut from = None::<NaiveDate>;
    let mut through = None::<NaiveDate>;
    for range in ranges.into_iter().flatten() {
        let candidate_from =
            parse_date(&range.from).map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
        let candidate_through = parse_date(&range.through)
            .map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
        from = Some(from.map_or(candidate_from, |current| current.min(candidate_from)));
        through = Some(through.map_or(candidate_through, |current| current.max(candidate_through)));
    }
    match (from, through) {
        (None, None) => Ok(None),
        (Some(from), Some(through)) => Ok(Some(LongitudinalDateRange {
            from: format_date(from),
            through: format_date(through),
        })),
        _ => Err(ApplicationError::Query(
            "longitudinal bounds are incomplete".to_owned(),
        )),
    }
}

fn select_range(
    available: &LongitudinalDateRange,
    requested: Option<LongitudinalDateRange>,
) -> Result<LongitudinalDateRange, ApplicationError> {
    let earliest =
        parse_date(&available.from).map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
    let latest = parse_date(&available.through)
        .map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
    let selected = requested.unwrap_or_else(|| {
        let candidate = latest
            .checked_sub_days(Days::new(DEFAULT_LONGITUDINAL_WINDOW_DAYS - 1))
            .unwrap_or(earliest);
        LongitudinalDateRange {
            from: format_date(candidate.max(earliest)),
            through: format_date(latest),
        }
    });
    let from = parse_date(&selected.from).map_err(ApplicationError::InvalidLongitudinalRange)?;
    let through =
        parse_date(&selected.through).map_err(ApplicationError::InvalidLongitudinalRange)?;
    if from > through {
        return Err(ApplicationError::InvalidLongitudinalRange(
            "range dates are not ordered",
        ));
    }
    if from < earliest || through > latest {
        return Err(ApplicationError::InvalidLongitudinalRange(
            "range is outside available longitudinal history",
        ));
    }
    if through.signed_duration_since(from).num_days() + 1 > MAX_LONGITUDINAL_RANGE_DAYS {
        return Err(ApplicationError::InvalidLongitudinalRange(
            "range exceeds 366 inclusive calendar days",
        ));
    }
    Ok(selected)
}

fn parse_date(value: &str) -> Result<NaiveDate, &'static str> {
    let parsed = NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|_| "an invalid date")?;
    if format_date(parsed) != value {
        return Err("a non-canonical date");
    }
    Ok(parsed)
}

fn format_date(value: NaiveDate) -> String {
    value.format("%Y-%m-%d").to_string()
}

fn load_origins(
    port: &dyn LongitudinalLibraryPort,
    bounds: &DomainBounds,
) -> Result<Vec<String>, ApplicationError> {
    let catalogs = [
        (
            "activity",
            bounds.activity.is_some(),
            ActivityLibraryPort::activity_origins(port).map_err(ApplicationError::Query)?,
        ),
        (
            "training",
            bounds.training.is_some(),
            TrainingLibraryPort::training_origins(port).map_err(ApplicationError::Query)?,
        ),
        (
            "sleep",
            bounds.sleep.is_some(),
            SleepLibraryPort::sleep_origins(port).map_err(ApplicationError::Query)?,
        ),
        (
            "recovery",
            bounds.recovery.is_some(),
            RecoveryLibraryPort::recovery_origins(port).map_err(ApplicationError::Query)?,
        ),
    ];
    let mut union = BTreeSet::new();
    for (domain, has_bounds, origins) in catalogs {
        if has_bounds != !origins.is_empty() {
            return Err(ApplicationError::Query(format!(
                "{domain} bounds and origin catalog disagree"
            )));
        }
        let mut domain_origins = HashSet::new();
        for origin in origins {
            if origin.trim().is_empty() {
                return Err(ApplicationError::Query(format!(
                    "{domain} origin catalog contains a blank identity"
                )));
            }
            if !domain_origins.insert(origin.clone()) {
                return Err(ApplicationError::Query(format!(
                    "{domain} origin catalog contains a duplicate identity"
                )));
            }
            union.insert(origin);
        }
    }
    if union.is_empty() {
        return Err(ApplicationError::Query(
            "longitudinal bounds exist without an origin".to_owned(),
        ));
    }
    Ok(union.into_iter().collect())
}

struct SharedContextAdapters<'a> {
    activity: SharedActivityPort<'a>,
    training: SharedTrainingPort<'a>,
    sleep: SharedSleepPort<'a>,
    recovery: SharedRecoveryPort<'a>,
}

impl<'a> SharedContextAdapters<'a> {
    fn new(
        port: &'a dyn LongitudinalLibraryPort,
        available: &LongitudinalDateRange,
        origins: &[String],
    ) -> Self {
        Self {
            activity: SharedActivityPort {
                port,
                available: activity_range(available),
                origins: origins.to_vec(),
            },
            training: SharedTrainingPort {
                port,
                available: training_range(available),
                origins: origins.to_vec(),
            },
            sleep: SharedSleepPort {
                port,
                available: sleep_range(available),
                origins: origins.to_vec(),
            },
            recovery: SharedRecoveryPort {
                port,
                available: recovery_range(available),
                origins: origins.to_vec(),
            },
        }
    }
}

struct SharedActivityPort<'a> {
    port: &'a dyn LongitudinalLibraryPort,
    available: ActivityDateRange,
    origins: Vec<String>,
}

impl ActivityLibraryPort for SharedActivityPort<'_> {
    fn activity_bounds(&self) -> Result<Option<ActivityDateRange>, String> {
        Ok(Some(self.available.clone()))
    }

    fn activity_origins(&self) -> Result<Vec<String>, String> {
        Ok(self.origins.clone())
    }

    fn query_activity(&self, range: &ActivityDateRange) -> Result<Vec<DailyActivity>, String> {
        ActivityLibraryPort::query_activity(self.port, range)
    }
}

struct SharedTrainingPort<'a> {
    port: &'a dyn LongitudinalLibraryPort,
    available: TrainingDateRange,
    origins: Vec<String>,
}

impl TrainingLibraryPort for SharedTrainingPort<'_> {
    fn training_bounds(&self) -> Result<Option<TrainingDateRange>, String> {
        Ok(Some(self.available.clone()))
    }

    fn training_origins(&self) -> Result<Vec<String>, String> {
        Ok(self.origins.clone())
    }

    fn query_training(&self, range: &TrainingDateRange) -> Result<Vec<TrainingSession>, String> {
        TrainingLibraryPort::query_training(self.port, range)
    }
}

struct SharedSleepPort<'a> {
    port: &'a dyn LongitudinalLibraryPort,
    available: SleepDateRange,
    origins: Vec<String>,
}

impl SleepLibraryPort for SharedSleepPort<'_> {
    fn sleep_bounds(&self) -> Result<Option<SleepDateRange>, String> {
        Ok(Some(self.available.clone()))
    }

    fn sleep_origins(&self) -> Result<Vec<String>, String> {
        Ok(self.origins.clone())
    }

    fn query_sleep(&self, range: &SleepDateRange) -> Result<Vec<SleepLibraryPeriod>, String> {
        SleepLibraryPort::query_sleep(self.port, range)
    }

    fn query_sleep_period(
        &self,
        series_ref: &str,
        sleep_date: &str,
    ) -> Result<Option<SleepPeriod>, String> {
        SleepLibraryPort::query_sleep_period(self.port, series_ref, sleep_date)
    }
}

struct SharedRecoveryPort<'a> {
    port: &'a dyn LongitudinalLibraryPort,
    available: RecoveryDateRange,
    origins: Vec<String>,
}

impl RecoveryLibraryPort for SharedRecoveryPort<'_> {
    fn recovery_bounds(&self) -> Result<Option<RecoveryDateRange>, String> {
        Ok(Some(self.available.clone()))
    }

    fn recovery_origins(&self) -> Result<Vec<String>, String> {
        Ok(self.origins.clone())
    }

    fn query_recovery(
        &self,
        range: &RecoveryDateRange,
    ) -> Result<Vec<RecoveryLibraryNight>, String> {
        RecoveryLibraryPort::query_recovery(self.port, range)
    }

    fn query_recovery_night(
        &self,
        series_ref: &str,
        recovery_date: &str,
    ) -> Result<Option<NightlyRecovery>, String> {
        RecoveryLibraryPort::query_recovery_night(self.port, series_ref, recovery_date)
    }
}

fn activity_range(range: &LongitudinalDateRange) -> ActivityDateRange {
    ActivityDateRange {
        from: range.from.clone(),
        through: range.through.clone(),
    }
}

fn training_range(range: &LongitudinalDateRange) -> TrainingDateRange {
    TrainingDateRange {
        from: range.from.clone(),
        through: range.through.clone(),
    }
}

fn sleep_range(range: &LongitudinalDateRange) -> SleepDateRange {
    SleepDateRange {
        from: range.from.clone(),
        through: range.through.clone(),
    }
}

fn recovery_range(range: &LongitudinalDateRange) -> RecoveryDateRange {
    RecoveryDateRange {
        from: range.from.clone(),
        through: range.through.clone(),
    }
}

fn combine_overviews(
    activity: Vec<ActivitySeriesOverview>,
    training: Vec<TrainingSeriesOverview>,
    sleep: Vec<SleepSeriesOverview>,
    recovery: Vec<RecoverySeriesOverview>,
) -> Result<Vec<LongitudinalSeriesOverview>, ApplicationError> {
    let mut training = keyed(training, |series| &series.series_ref, "training overview")?;
    let mut sleep = keyed(sleep, |series| &series.series_ref, "sleep overview")?;
    let mut recovery = keyed(recovery, |series| &series.series_ref, "recovery overview")?;
    let mut result = Vec::with_capacity(activity.len());
    for activity in activity {
        let series_ref = activity.series_ref.clone();
        let training = remove_series(&mut training, &series_ref, "training overview")?;
        let sleep = remove_series(&mut sleep, &series_ref, "sleep overview")?;
        let recovery = remove_series(&mut recovery, &series_ref, "recovery overview")?;
        let days = combine_days(&activity, &training, &sleep, &recovery)?;
        result.push(LongitudinalSeriesOverview {
            series_ref,
            activity: activity.summary,
            training: training.summary,
            sleep: sleep.summary,
            recovery: recovery.summary,
            days,
        });
    }
    ensure_consumed(&training, "training overview")?;
    ensure_consumed(&sleep, "sleep overview")?;
    ensure_consumed(&recovery, "recovery overview")?;
    Ok(result)
}

fn combine_days(
    activity: &ActivitySeriesOverview,
    training: &TrainingSeriesOverview,
    sleep: &SleepSeriesOverview,
    recovery: &RecoverySeriesOverview,
) -> Result<Vec<LongitudinalDayInsight>, ApplicationError> {
    if activity.days.len() != sleep.days.len() || activity.days.len() != recovery.days.len() {
        return Err(ApplicationError::Query(
            "longitudinal domain day counts disagree".to_owned(),
        ));
    }
    let mut training_days = BTreeMap::<String, LongitudinalTrainingDay>::new();
    for session in &training.sessions {
        let local_date = session.started_at_local.get(..10).ok_or_else(|| {
            ApplicationError::Query("training insight has no local date".to_owned())
        })?;
        let day = training_days
            .entry(local_date.to_owned())
            .or_insert(LongitudinalTrainingDay {
                session_count: 0,
                total_duration_milliseconds: 0,
            });
        day.session_count = day.session_count.checked_add(1).ok_or_else(|| {
            ApplicationError::Query("longitudinal training count overflowed".to_owned())
        })?;
        day.total_duration_milliseconds = day
            .total_duration_milliseconds
            .checked_add(i128::from(session.duration_milliseconds))
            .ok_or_else(|| {
                ApplicationError::Query("longitudinal training duration overflowed".to_owned())
            })?;
    }
    let mut days = Vec::with_capacity(activity.days.len());
    for ((activity, sleep), recovery) in activity.days.iter().zip(&sleep.days).zip(&recovery.days) {
        if activity.local_date != sleep.sleep_date || activity.local_date != recovery.recovery_date
        {
            return Err(ApplicationError::Query(
                "longitudinal domain dates disagree".to_owned(),
            ));
        }
        let training =
            training_days
                .remove(&activity.local_date)
                .unwrap_or(LongitudinalTrainingDay {
                    session_count: 0,
                    total_duration_milliseconds: 0,
                });
        days.push(LongitudinalDayInsight {
            local_date: activity.local_date.clone(),
            activity: LongitudinalActivityDay {
                availability: activity.availability,
                step_count: activity.step_count,
            },
            training,
            sleep: LongitudinalSleepDay {
                availability: sleep.availability,
                asleep_milliseconds: sleep
                    .period
                    .as_ref()
                    .map(|period| period.asleep_milliseconds),
            },
            recovery: LongitudinalRecoveryDay {
                availability: recovery.availability,
                beat_to_beat_interval_milliseconds: recovery
                    .recovery
                    .as_ref()
                    .map(|night| night.beat_to_beat_interval_milliseconds),
                heart_rate_variability_rmssd_milliseconds: recovery
                    .recovery
                    .as_ref()
                    .and_then(|night| night.heart_rate_variability_rmssd_milliseconds),
                breathing_interval_milliseconds: recovery
                    .recovery
                    .as_ref()
                    .map(|night| night.breathing_interval_milliseconds),
            },
        });
    }
    if !training_days.is_empty() {
        return Err(ApplicationError::Query(
            "training insights contain a date outside the shared range".to_owned(),
        ));
    }
    Ok(days)
}

fn combine_comparisons(
    activity: Vec<ActivitySeriesComparison>,
    training: Vec<TrainingSeriesComparison>,
    sleep: Vec<SleepSeriesComparison>,
    recovery: Vec<RecoverySeriesComparison>,
) -> Result<Vec<LongitudinalSeriesComparison>, ApplicationError> {
    let mut training = keyed(training, |series| &series.series_ref, "training comparison")?;
    let mut sleep = keyed(sleep, |series| &series.series_ref, "sleep comparison")?;
    let mut recovery = keyed(recovery, |series| &series.series_ref, "recovery comparison")?;
    let mut result = Vec::with_capacity(activity.len());
    for activity in activity {
        let series_ref = activity.series_ref.clone();
        let training = remove_series(&mut training, &series_ref, "training comparison")?;
        let sleep = remove_series(&mut sleep, &series_ref, "sleep comparison")?;
        let recovery = remove_series(&mut recovery, &series_ref, "recovery comparison")?;
        result.push(LongitudinalSeriesComparison {
            series_ref,
            activity: LongitudinalActivityComparison {
                baseline: activity.baseline,
                comparison: activity.comparison,
                total_step_change: activity.total_step_change,
                average_step_change: activity.average_step_change,
            },
            training: LongitudinalTrainingComparison {
                baseline: training.baseline,
                comparison: training.comparison,
                session_count_change: training.session_count_change,
                training_day_change: training.training_day_change,
                duration_milliseconds_change: training.duration_milliseconds_change,
                distance_meters_change: training.distance_meters_change,
                energy_kilocalories_change: training.energy_kilocalories_change,
            },
            sleep: LongitudinalSleepComparison {
                baseline: sleep.baseline,
                comparison: sleep.comparison,
                observed_night_change: sleep.observed_night_change,
                missing_night_change: sleep.missing_night_change,
                average_asleep_milliseconds_change: sleep.average_asleep_milliseconds_change,
                average_interruption_milliseconds_change: sleep
                    .average_interruption_milliseconds_change,
                average_efficiency_percentage_point_change: sleep
                    .average_efficiency_percentage_point_change,
                average_overall_score_change: sleep.average_overall_score_change,
                goal_met_percentage_point_change: sleep.goal_met_percentage_point_change,
            },
            recovery: LongitudinalRecoveryComparison {
                baseline: recovery.baseline,
                comparison: recovery.comparison,
                observed_night_change: recovery.observed_night_change,
                missing_night_change: recovery.missing_night_change,
                average_beat_to_beat_interval_milliseconds_change: recovery
                    .average_beat_to_beat_interval_milliseconds_change,
                average_heart_rate_variability_rmssd_milliseconds_change: recovery
                    .average_heart_rate_variability_rmssd_milliseconds_change,
                average_breathing_interval_milliseconds_change: recovery
                    .average_breathing_interval_milliseconds_change,
                assessment_night_change: recovery.assessment_night_change,
                baseline_night_change: recovery.baseline_night_change,
                guidance_night_change: recovery.guidance_night_change,
            },
        });
    }
    ensure_consumed(&training, "training comparison")?;
    ensure_consumed(&sleep, "sleep comparison")?;
    ensure_consumed(&recovery, "recovery comparison")?;
    Ok(result)
}

fn keyed<T>(
    values: Vec<T>,
    key: impl Fn(&T) -> &String,
    label: &str,
) -> Result<BTreeMap<String, T>, ApplicationError> {
    let mut result = BTreeMap::new();
    for value in values {
        let identity = key(&value).clone();
        if result.insert(identity, value).is_some() {
            return Err(ApplicationError::Query(format!(
                "{label} contains a duplicate series"
            )));
        }
    }
    Ok(result)
}

fn remove_series<T>(
    values: &mut BTreeMap<String, T>,
    identity: &str,
    label: &str,
) -> Result<T, ApplicationError> {
    values
        .remove(identity)
        .ok_or_else(|| ApplicationError::Query(format!("{label} is missing a shared series")))
}

fn ensure_consumed<T>(values: &BTreeMap<String, T>, label: &str) -> Result<(), ApplicationError> {
    if values.is_empty() {
        Ok(())
    } else {
        Err(ApplicationError::Query(format!(
            "{label} contains an unexpected series"
        )))
    }
}
