use std::{
    collections::BTreeMap,
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};

use chrono::{Days, NaiveDate};
use thiserror::Error;

use fitfreed_domain::{DailyActivity, ImportOutcome, ImportReport};

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
    fn query_activity(&self, range: &ActivityDateRange) -> Result<Vec<DailyActivity>, String>;
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
    let Some(available_range) = port.activity_bounds().map_err(ApplicationError::Query)? else {
        return Ok(ActivityOverview {
            available_range: None,
            selected_range: None,
            series: Vec::new(),
        });
    };

    let earliest = parse_activity_date(&available_range.from)?;
    let latest = parse_activity_date(&available_range.through)?;
    if earliest > latest {
        return Err(ApplicationError::Query(
            "activity bounds are not ordered".to_owned(),
        ));
    }
    let window_start = latest
        .checked_sub_days(Days::new(DEFAULT_ACTIVITY_WINDOW_DAYS - 1))
        .unwrap_or(earliest)
        .max(earliest);
    let selected_range = ActivityDateRange {
        from: window_start.format("%Y-%m-%d").to_string(),
        through: latest.format("%Y-%m-%d").to_string(),
    };
    let activities = port
        .query_activity(&selected_range)
        .map_err(ApplicationError::Query)?;
    let series = build_activity_series(window_start, latest, activities)?;

    Ok(ActivityOverview {
        available_range: Some(available_range),
        selected_range: Some(selected_range),
        series,
    })
}

fn parse_activity_date(value: &str) -> Result<NaiveDate, ApplicationError> {
    let parsed = NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| ApplicationError::Query("activity date is invalid".to_owned()))?;
    if parsed.format("%Y-%m-%d").to_string() != value {
        return Err(ApplicationError::Query(
            "activity date is not canonical".to_owned(),
        ));
    }
    Ok(parsed)
}

fn build_activity_series(
    from: NaiveDate,
    through: NaiveDate,
    activities: Vec<DailyActivity>,
) -> Result<Vec<ActivitySeriesOverview>, ApplicationError> {
    let mut observations = BTreeMap::<String, BTreeMap<NaiveDate, Option<i64>>>::new();
    for activity in activities {
        let local_date = parse_activity_date(&activity.local_date)?;
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
        let replaced = observations
            .entry(activity.origin_id)
            .or_default()
            .insert(local_date, activity.step_count);
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
    fn returns_an_empty_activity_overview_without_querying_a_range() {
        struct EmptyActivityPort;

        impl ActivityLibraryPort for EmptyActivityPort {
            fn activity_bounds(&self) -> Result<Option<ActivityDateRange>, String> {
                Ok(None)
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
    }

    #[test]
    fn rejects_invalid_or_reversed_activity_bounds_without_querying_facts() {
        struct InvalidBoundsPort(ActivityDateRange);

        impl ActivityLibraryPort for InvalidBoundsPort {
            fn activity_bounds(&self) -> Result<Option<ActivityDateRange>, String> {
                Ok(Some(self.0.clone()))
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
}
