use fitfreed_domain::{DailyActivity, NightlyRecovery, SleepPeriod, TrainingSession};

use super::*;

#[derive(Default)]
struct ControlledLongitudinalPort {
    activity_bounds: Option<ActivityDateRange>,
    activity_origins: Vec<String>,
    activities: Vec<DailyActivity>,
    training_bounds: Option<TrainingDateRange>,
    training_origins: Vec<String>,
    sessions: Vec<TrainingSession>,
    sleep_bounds: Option<SleepDateRange>,
    sleep_origins: Vec<String>,
    periods: Vec<SleepLibraryPeriod>,
    recovery_bounds: Option<RecoveryDateRange>,
    recovery_origins: Vec<String>,
    recoveries: Vec<RecoveryLibraryNight>,
}

impl ActivityLibraryPort for ControlledLongitudinalPort {
    fn activity_bounds(&self) -> Result<Option<ActivityDateRange>, String> {
        Ok(self.activity_bounds.clone())
    }

    fn activity_origins(&self) -> Result<Vec<String>, String> {
        Ok(self.activity_origins.clone())
    }

    fn query_activity(&self, range: &ActivityDateRange) -> Result<Vec<DailyActivity>, String> {
        Ok(self
            .activities
            .iter()
            .filter(|activity| in_range(&activity.local_date, &range.from, &range.through))
            .cloned()
            .collect())
    }
}

impl TrainingLibraryPort for ControlledLongitudinalPort {
    fn training_bounds(&self) -> Result<Option<TrainingDateRange>, String> {
        Ok(self.training_bounds.clone())
    }

    fn training_origins(&self) -> Result<Vec<String>, String> {
        Ok(self.training_origins.clone())
    }

    fn query_training(&self, range: &TrainingDateRange) -> Result<Vec<TrainingSession>, String> {
        Ok(self
            .sessions
            .iter()
            .filter(|session| {
                in_range(&session.started_at_local[..10], &range.from, &range.through)
            })
            .cloned()
            .collect())
    }
}

impl SleepLibraryPort for ControlledLongitudinalPort {
    fn sleep_bounds(&self) -> Result<Option<SleepDateRange>, String> {
        Ok(self.sleep_bounds.clone())
    }

    fn sleep_origins(&self) -> Result<Vec<String>, String> {
        Ok(self.sleep_origins.clone())
    }

    fn query_sleep(&self, range: &SleepDateRange) -> Result<Vec<SleepLibraryPeriod>, String> {
        Ok(self
            .periods
            .iter()
            .filter(|period| in_range(&period.sleep_date, &range.from, &range.through))
            .cloned()
            .collect())
    }

    fn query_sleep_period(
        &self,
        _series_ref: &str,
        _sleep_date: &str,
    ) -> Result<Option<SleepPeriod>, String> {
        panic!("longitudinal projections never query full sleep detail")
    }
}

impl RecoveryLibraryPort for ControlledLongitudinalPort {
    fn recovery_bounds(&self) -> Result<Option<RecoveryDateRange>, String> {
        Ok(self.recovery_bounds.clone())
    }

    fn recovery_origins(&self) -> Result<Vec<String>, String> {
        Ok(self.recovery_origins.clone())
    }

    fn query_recovery(
        &self,
        range: &RecoveryDateRange,
    ) -> Result<Vec<RecoveryLibraryNight>, String> {
        Ok(self
            .recoveries
            .iter()
            .filter(|recovery| in_range(&recovery.recovery_date, &range.from, &range.through))
            .cloned()
            .collect())
    }

    fn query_recovery_night(
        &self,
        _series_ref: &str,
        _recovery_date: &str,
    ) -> Result<Option<NightlyRecovery>, String> {
        panic!("longitudinal projections never query full recovery detail")
    }
}

fn in_range(value: &str, from: &str, through: &str) -> bool {
    value >= from && value <= through
}

fn range(from: &str, through: &str) -> LongitudinalDateRange {
    LongitudinalDateRange {
        from: from.to_owned(),
        through: through.to_owned(),
    }
}

fn activity_range(from: &str, through: &str) -> ActivityDateRange {
    ActivityDateRange {
        from: from.to_owned(),
        through: through.to_owned(),
    }
}

fn training_range(from: &str, through: &str) -> TrainingDateRange {
    TrainingDateRange {
        from: from.to_owned(),
        through: through.to_owned(),
    }
}

fn sleep_range(from: &str, through: &str) -> SleepDateRange {
    SleepDateRange {
        from: from.to_owned(),
        through: through.to_owned(),
    }
}

fn recovery_range(from: &str, through: &str) -> RecoveryDateRange {
    RecoveryDateRange {
        from: from.to_owned(),
        through: through.to_owned(),
    }
}

fn session(id: &str, date: &str, duration_milliseconds: i64) -> TrainingSession {
    TrainingSession {
        origin_id: "origin-a".to_owned(),
        session_id: id.to_owned(),
        started_at_local: format!("{date}T08:00:00"),
        stopped_at_local: format!("{date}T09:00:00"),
        utc_offset_minutes: Some(60),
        duration_milliseconds,
        distance_meters: None,
        energy_kilocalories: None,
        average_heart_rate_bpm: None,
        maximum_heart_rate_bpm: None,
        sport_ref: None,
        exercise_count: None,
    }
}

fn sleep_period(date: &str, asleep_milliseconds: i64) -> SleepLibraryPeriod {
    SleepLibraryPeriod {
        origin_id: "origin-a".to_owned(),
        sleep_date: date.to_owned(),
        started_at: format!("{date}T00:00:00+01:00"),
        ended_at: format!("{date}T08:00:00+01:00"),
        span_milliseconds: asleep_milliseconds + 20,
        asleep_milliseconds,
        interruption_milliseconds: 20,
        long_interruption_milliseconds: 10,
        short_interruption_milliseconds: 10,
        interruption_count: 2,
        long_interruption_count: 1,
        short_interruption_count: 1,
        efficiency_percent: 80.0,
        continuity_index: 4.0,
        continuity_class: 4,
        sleep_goal_milliseconds: None,
        self_reported_rating: None,
        cycle_count: None,
        recording_ended_by_power_loss: None,
        phase_summary: None,
        stage_timeline_available: false,
        score: None,
    }
}

fn recovery(origin_id: &str, date: &str, beat_to_beat: i64) -> RecoveryLibraryNight {
    RecoveryLibraryNight {
        origin_id: origin_id.to_owned(),
        recovery_date: date.to_owned(),
        beat_to_beat_interval_milliseconds: beat_to_beat,
        heart_rate_variability_rmssd_milliseconds: Some(40),
        breathing_interval_milliseconds: 4_000,
        source_assessment: None,
        source_baseline_available: false,
        source_guidance_available: false,
    }
}

fn representative_port() -> ControlledLongitudinalPort {
    ControlledLongitudinalPort {
        activity_bounds: Some(activity_range("2026-01-01", "2026-01-03")),
        activity_origins: vec!["origin-a".to_owned()],
        activities: vec![
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
        ],
        training_bounds: Some(training_range("2026-01-02", "2026-01-02")),
        training_origins: vec!["origin-a".to_owned()],
        sessions: vec![
            session("one", "2026-01-02", 1_000),
            session("two", "2026-01-02", 2_000),
        ],
        sleep_bounds: Some(sleep_range("2026-01-01", "2026-01-04")),
        sleep_origins: vec!["origin-a".to_owned()],
        periods: vec![
            sleep_period("2026-01-01", 80),
            sleep_period("2026-01-04", 90),
        ],
        recovery_bounds: Some(recovery_range("2026-01-02", "2026-01-05")),
        recovery_origins: vec!["origin-b".to_owned(), "origin-a".to_owned()],
        recoveries: vec![
            recovery("origin-a", "2026-01-02", 1_000),
            recovery("origin-a", "2026-01-05", 1_100),
            recovery("origin-b", "2026-01-05", 900),
        ],
    }
}

#[test]
fn aligns_disjoint_domain_ranges_and_origins_without_merging_them() {
    let overview =
        query_longitudinal_overview(&representative_port(), None).expect("longitudinal overview");

    assert_eq!(
        overview.available_range,
        Some(range("2026-01-01", "2026-01-05"))
    );
    assert_eq!(overview.selected_range, overview.available_range);
    assert_eq!(overview.series.len(), 2);
    let origin_a = &overview.series[0];
    assert_eq!(origin_a.series_ref, "origin-a");
    assert_eq!(origin_a.days.len(), 5);
    assert_eq!(origin_a.activity.observed_days, 2);
    assert_eq!(origin_a.activity.available_step_days, 1);
    assert_eq!(origin_a.training.session_count, 2);
    assert_eq!(origin_a.sleep.observed_nights, 2);
    assert_eq!(origin_a.recovery.observed_nights, 2);
    assert_eq!(origin_a.days[0].activity.step_count, Some(100));
    assert_eq!(origin_a.days[0].sleep.asleep_milliseconds, Some(80));
    assert_eq!(
        origin_a.days[1].activity.availability,
        ActivityDayAvailability::Unavailable
    );
    assert_eq!(origin_a.days[1].training.session_count, 2);
    assert_eq!(origin_a.days[1].training.total_duration_milliseconds, 3_000);
    assert_eq!(
        origin_a.days[1].recovery.beat_to_beat_interval_milliseconds,
        Some(1_000)
    );
    assert_eq!(
        origin_a.days[2].activity.availability,
        ActivityDayAvailability::Missing
    );
    assert_eq!(origin_a.days[2].training.session_count, 0);
    assert_eq!(
        origin_a.days[2].sleep.availability,
        SleepDayAvailability::Missing
    );
    assert_eq!(
        origin_a.days[2].recovery.availability,
        RecoveryDayAvailability::Missing
    );

    let origin_b = &overview.series[1];
    assert_eq!(origin_b.series_ref, "origin-b");
    assert_eq!(origin_b.activity.observed_days, 0);
    assert_eq!(origin_b.training.session_count, 0);
    assert_eq!(origin_b.sleep.observed_nights, 0);
    assert_eq!(origin_b.recovery.observed_nights, 1);
    assert_eq!(
        origin_b.days[4].recovery.beat_to_beat_interval_milliseconds,
        Some(900)
    );
}

#[test]
fn compares_unequal_periods_through_existing_domain_rules() {
    let comparison = query_longitudinal_comparison(
        &representative_port(),
        range("2026-01-01", "2026-01-02"),
        range("2026-01-03", "2026-01-05"),
    )
    .expect("longitudinal comparison");

    assert_eq!(comparison.series.len(), 2);
    let origin_a = &comparison.series[0];
    assert_eq!(origin_a.activity.baseline.observed_days, 2);
    assert_eq!(origin_a.activity.comparison.observed_days, 0);
    assert_eq!(origin_a.activity.total_step_change, None);
    assert_eq!(origin_a.training.session_count_change, -2);
    assert_eq!(origin_a.training.duration_milliseconds_change, -3_000);
    assert_eq!(origin_a.sleep.average_asleep_milliseconds_change, Some(10));
    assert_eq!(
        origin_a
            .recovery
            .average_beat_to_beat_interval_milliseconds_change,
        Some(100)
    );
    assert_eq!(origin_a.recovery.observed_night_change, 0);
    assert_eq!(
        comparison.baseline_range,
        Some(range("2026-01-01", "2026-01-02"))
    );
    assert_eq!(
        comparison.comparison_range,
        Some(range("2026-01-03", "2026-01-05"))
    );
}

struct BoundsOnlyPort {
    bounds: Option<ActivityDateRange>,
}

impl ActivityLibraryPort for BoundsOnlyPort {
    fn activity_bounds(&self) -> Result<Option<ActivityDateRange>, String> {
        Ok(self.bounds.clone())
    }

    fn activity_origins(&self) -> Result<Vec<String>, String> {
        panic!("origins must not be queried")
    }

    fn query_activity(&self, _range: &ActivityDateRange) -> Result<Vec<DailyActivity>, String> {
        panic!("facts must not be queried")
    }
}

impl TrainingLibraryPort for BoundsOnlyPort {
    fn training_bounds(&self) -> Result<Option<TrainingDateRange>, String> {
        Ok(None)
    }

    fn training_origins(&self) -> Result<Vec<String>, String> {
        panic!("origins must not be queried")
    }

    fn query_training(&self, _range: &TrainingDateRange) -> Result<Vec<TrainingSession>, String> {
        panic!("facts must not be queried")
    }
}

impl SleepLibraryPort for BoundsOnlyPort {
    fn sleep_bounds(&self) -> Result<Option<SleepDateRange>, String> {
        Ok(None)
    }

    fn sleep_origins(&self) -> Result<Vec<String>, String> {
        panic!("origins must not be queried")
    }

    fn query_sleep(&self, _range: &SleepDateRange) -> Result<Vec<SleepLibraryPeriod>, String> {
        panic!("facts must not be queried")
    }

    fn query_sleep_period(
        &self,
        _series_ref: &str,
        _sleep_date: &str,
    ) -> Result<Option<SleepPeriod>, String> {
        panic!("detail must not be queried")
    }
}

impl RecoveryLibraryPort for BoundsOnlyPort {
    fn recovery_bounds(&self) -> Result<Option<RecoveryDateRange>, String> {
        Ok(None)
    }

    fn recovery_origins(&self) -> Result<Vec<String>, String> {
        panic!("origins must not be queried")
    }

    fn query_recovery(
        &self,
        _range: &RecoveryDateRange,
    ) -> Result<Vec<RecoveryLibraryNight>, String> {
        panic!("facts must not be queried")
    }

    fn query_recovery_night(
        &self,
        _series_ref: &str,
        _recovery_date: &str,
    ) -> Result<Option<NightlyRecovery>, String> {
        panic!("detail must not be queried")
    }
}

#[test]
fn returns_an_empty_projection_without_querying_catalogs_or_facts() {
    assert_eq!(
        query_longitudinal_overview(&BoundsOnlyPort { bounds: None }, None)
            .expect("empty overview"),
        LongitudinalOverview {
            available_range: None,
            selected_range: None,
            series: Vec::new(),
        }
    );
    assert_eq!(
        query_longitudinal_comparison(
            &BoundsOnlyPort { bounds: None },
            range("2026-01-01", "2026-01-02"),
            range("2026-01-03", "2026-01-04"),
        )
        .expect("empty comparison"),
        LongitudinalComparison {
            available_range: None,
            baseline_range: None,
            comparison_range: None,
            series: Vec::new(),
        }
    );
}

#[test]
fn rejects_invalid_ranges_before_querying_catalogs_or_facts() {
    let port = BoundsOnlyPort {
        bounds: Some(activity_range("2024-01-01", "2026-12-31")),
    };
    for invalid in [
        range("2026-02-30", "2026-03-01"),
        range("2026-03-02", "2026-03-01"),
        range("2023-12-31", "2024-01-01"),
        range("2025-01-01", "2026-01-02"),
    ] {
        assert!(matches!(
            query_longitudinal_overview(&port, Some(invalid)),
            Err(ApplicationError::InvalidLongitudinalRange(_))
        ));
    }
}

#[test]
fn rejects_inconsistent_domain_bounds_and_origin_catalogs() {
    let port = ControlledLongitudinalPort {
        activity_bounds: Some(activity_range("2026-01-01", "2026-01-01")),
        ..ControlledLongitudinalPort::default()
    };
    assert!(matches!(
        query_longitudinal_overview(&port, None),
        Err(ApplicationError::Query(_))
    ));

    let port = ControlledLongitudinalPort {
        activity_bounds: Some(activity_range("2026-01-01", "2026-01-01")),
        activity_origins: vec!["origin-a".to_owned(), "origin-a".to_owned()],
        ..ControlledLongitudinalPort::default()
    };
    assert!(matches!(
        query_longitudinal_overview(&port, None),
        Err(ApplicationError::Query(_))
    ));
}
