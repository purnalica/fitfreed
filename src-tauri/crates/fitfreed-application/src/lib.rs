use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};

use chrono::{DateTime, Days, FixedOffset, NaiveDate, NaiveDateTime, SecondsFormat};
use thiserror::Error;

#[cfg(test)]
use fitfreed_domain::SleepStage;
use fitfreed_domain::{
    DailyActivity, ImportOutcome, ImportReport, NightlyRecovery, SleepPeriod, SleepPhaseSummary,
    SleepScore, SleepStageTransition, SourceSpecificRecoveryAssessment,
    SourceSpecificRecoveryBaseline, SourceSpecificRecoveryGuidance, TrainingSession,
};

mod sport_discovery;
pub use sport_discovery::{
    query_training_sports, save_training_sport_classification, DetectedTrainingSport,
    SaveSportClassificationRequest, SavedTrainingSportClassification,
    SportClassificationSaveOutcome, TrainingSport, TrainingSportClassification,
    TrainingSportCoverage, TrainingSportState, TrainingSportsOverview, TrainingSportsPort,
};

mod training_discovery;
pub use training_discovery::{
    query_training_sessions, PersistedTrainingSessionSearchPage, TrainingMeasurementFilter,
    TrainingSessionDiscoveryPort, TrainingSessionDiscoveryPortError, TrainingSessionSearchItem,
    TrainingSessionSearchPage, TrainingSessionSearchRequest, TrainingSessionSearchSummary,
    TrainingSessionSort, TrainingSessionSport,
};

#[cfg(test)]
mod training_discovery_tests;

#[cfg(test)]
mod sport_discovery_tests;

mod longitudinal;
pub use longitudinal::{
    query_longitudinal_comparison, query_longitudinal_overview, LongitudinalActivityComparison,
    LongitudinalActivityDay, LongitudinalComparison, LongitudinalDateRange, LongitudinalDayInsight,
    LongitudinalLibraryPort, LongitudinalOverview, LongitudinalRecoveryComparison,
    LongitudinalRecoveryDay, LongitudinalSeriesComparison, LongitudinalSeriesOverview,
    LongitudinalSleepComparison, LongitudinalSleepDay, LongitudinalTrainingComparison,
    LongitudinalTrainingDay,
};
mod library_home;
pub use library_home::{
    clear_exploration_workspace, query_library_home, save_exploration_workspace,
    ExplorationWorkspace, ExplorationWorkspacePort, ExploreDestination, LibraryDomain,
    LibraryDomainCoverage, LibraryHome, LibraryHomeDateRange, LibraryHomePort, LibraryHomeRequest,
    LibraryMeasurement, LibraryMeasurementCoverage, LibraryQuestion, LibraryQuestionKind,
    PostImportReveal, StoredExplorationWorkspace,
};
mod update;
pub use update::{
    authorize_update_installation, check_for_updates, dismiss_update, postpone_update,
    AuthenticatedUpdateSnapshot, LocalizedUpdateText, ManualUpdateReason, PersistedUpdateState,
    PostponedUpdate, TrustedSnapshotRecord, UpdateArtifact, UpdateChannelPort, UpdateChannelRead,
    UpdateCheckContext, UpdateCheckOutcome, UpdateCheckStatus, UpdateCheckTrigger, UpdateError,
    UpdateInstallationAuthorization, UpdateRelease, UpdateReleaseSummary, UpdateStatePort,
    UpdateTrustFailure, UpdateWithdrawal, UpdateWithdrawalReason, UpdateWithdrawalSummary,
};
mod update_recovery;
pub use update_recovery::{
    decide_update_recovery_watchdog_action, validate_update_recovery_transition,
    InvalidUpdateRecoveryTransition, UpdateRecoveryOutcome, UpdateRecoveryOutcomeKind,
    UpdateRecoveryPhase, UpdateRecoveryWatchdogAction, UpdateRecoveryWatchdogEvent,
};
mod source_acquisition;
pub use source_acquisition::{
    query_source_acquisition_guides, ExpectedSourceArchive, OfficialSourceLink,
    OfficialSourceLinkPurpose, SourceAcquisitionGuide, SourceAcquisitionGuidePort,
    SOURCE_ACQUISITION_GUIDE_SCHEMA_VERSION,
};

#[cfg(test)]
mod longitudinal_tests;

#[cfg(test)]
mod library_home_tests;

#[cfg(test)]
mod update_tests;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LocalePreference {
    EnUs,
    EsEs,
}

#[cfg(test)]
mod recovery_tests {
    use super::*;

    fn nightly_recovery(origin_id: &str, recovery_date: &str) -> NightlyRecovery {
        NightlyRecovery {
            origin_id: origin_id.to_owned(),
            recovery_date: recovery_date.to_owned(),
            beat_to_beat_interval_milliseconds: 1_000,
            heart_rate_variability_rmssd_milliseconds: Some(40),
            breathing_interval_milliseconds: 4_000,
            source_assessment: Some(SourceSpecificRecoveryAssessment {
                scheme: "synthetic-assessment@1".to_owned(),
                autonomic_charge: 2.5,
                autonomic_status: 4,
                overall_status: 5,
                overall_sublevel: 2,
            }),
            source_baseline: Some(SourceSpecificRecoveryBaseline {
                scheme: "synthetic-baseline@1".to_owned(),
                mean_beat_to_beat_interval_milliseconds: 980,
                standard_deviation_beat_to_beat_interval_milliseconds: 20,
                mean_heart_rate_variability_rmssd_milliseconds: Some(38),
                standard_deviation_heart_rate_variability_rmssd_milliseconds: Some(4),
                mean_breathing_interval_milliseconds: 3_950,
                standard_deviation_breathing_interval_milliseconds: 75,
            }),
            source_guidance: Some(SourceSpecificRecoveryGuidance {
                scheme: "synthetic-guidance@1".to_owned(),
                exercise: "Keep the next session light.".to_owned(),
                sleep: "Protect a consistent bedtime.".to_owned(),
                vitality: "Make room for recovery.".to_owned(),
            }),
        }
    }

    fn library_night(recovery: &NightlyRecovery) -> RecoveryLibraryNight {
        RecoveryLibraryNight {
            origin_id: recovery.origin_id.clone(),
            recovery_date: recovery.recovery_date.clone(),
            beat_to_beat_interval_milliseconds: recovery.beat_to_beat_interval_milliseconds,
            heart_rate_variability_rmssd_milliseconds: recovery
                .heart_rate_variability_rmssd_milliseconds,
            breathing_interval_milliseconds: recovery.breathing_interval_milliseconds,
            source_assessment: recovery.source_assessment.clone(),
            source_baseline_available: recovery.source_baseline.is_some(),
            source_guidance_available: recovery.source_guidance.is_some(),
        }
    }

    struct ControlledRecoveryPort {
        bounds: Option<RecoveryDateRange>,
        origins: Vec<String>,
        nights: Vec<NightlyRecovery>,
        detail: Option<NightlyRecovery>,
    }

    impl RecoveryLibraryPort for ControlledRecoveryPort {
        fn recovery_bounds(&self) -> Result<Option<RecoveryDateRange>, String> {
            Ok(self.bounds.clone())
        }

        fn recovery_origins(&self) -> Result<Vec<String>, String> {
            Ok(self.origins.clone())
        }

        fn query_recovery(
            &self,
            range: &RecoveryDateRange,
        ) -> Result<Vec<RecoveryLibraryNight>, String> {
            Ok(self
                .nights
                .iter()
                .filter(|night| {
                    night.recovery_date >= range.from && night.recovery_date <= range.through
                })
                .map(library_night)
                .collect())
        }

        fn query_recovery_night(
            &self,
            _series_ref: &str,
            _recovery_date: &str,
        ) -> Result<Option<NightlyRecovery>, String> {
            Ok(self.detail.clone())
        }
    }

    #[test]
    fn builds_a_gap_aware_default_overview_with_source_coverage() {
        let mut partial = nightly_recovery("origin-a", "2026-01-18");
        partial.beat_to_beat_interval_milliseconds = 1_001;
        partial.heart_rate_variability_rmssd_milliseconds = None;
        partial.breathing_interval_milliseconds = 4_002;
        partial.source_assessment = None;
        partial.source_baseline = None;
        partial.source_guidance = None;
        let overview = query_default_recovery_overview(&ControlledRecoveryPort {
            bounds: Some(RecoveryDateRange {
                from: "2026-01-01".to_owned(),
                through: "2026-02-15".to_owned(),
            }),
            origins: vec!["origin-b".to_owned(), "origin-a".to_owned()],
            nights: vec![
                partial,
                nightly_recovery("origin-a", "2026-01-17"),
                nightly_recovery("origin-b", "2026-01-19"),
            ],
            detail: None,
        })
        .expect("recovery overview");

        assert_eq!(
            overview.selected_range,
            Some(RecoveryDateRange {
                from: "2026-01-17".to_owned(),
                through: "2026-02-15".to_owned(),
            })
        );
        assert_eq!(overview.series.len(), 2);
        let origin_a = &overview.series[0];
        assert_eq!(origin_a.series_ref, "origin-a");
        assert_eq!(origin_a.summary.calendar_days, 30);
        assert_eq!(origin_a.summary.observed_nights, 2);
        assert_eq!(origin_a.summary.missing_nights, 28);
        assert_eq!(
            origin_a.summary.average_beat_to_beat_interval_milliseconds,
            Some(1_001)
        );
        assert_eq!(origin_a.summary.rmssd_night_count, 1);
        assert_eq!(
            origin_a
                .summary
                .average_heart_rate_variability_rmssd_milliseconds,
            Some(40)
        );
        assert_eq!(
            origin_a.summary.average_breathing_interval_milliseconds,
            Some(4_001)
        );
        assert_eq!(origin_a.summary.assessment_night_count, 1);
        assert_eq!(origin_a.summary.baseline_night_count, 1);
        assert_eq!(origin_a.summary.guidance_night_count, 1);
        assert_eq!(origin_a.days.len(), 30);
        assert_eq!(
            origin_a.days[0].availability,
            RecoveryDayAvailability::Available
        );
        assert_eq!(
            origin_a.days[2].availability,
            RecoveryDayAvailability::Missing
        );
        let first_night = origin_a.days[0].recovery.as_ref().expect("first night");
        assert_eq!(
            first_night
                .source_assessment
                .as_ref()
                .expect("source assessment")
                .overall_status,
            5
        );
        assert!(first_night.source_baseline_available);
        assert!(first_night.source_guidance_available);
        assert_eq!(overview.series[1].series_ref, "origin-b");
        assert_eq!(overview.series[1].summary.observed_nights, 1);
    }

    #[test]
    fn compares_unequal_periods_without_inventing_optional_trends() {
        let baseline = nightly_recovery("origin-a", "2026-01-01");
        let mut comparison_first = nightly_recovery("origin-a", "2026-01-04");
        comparison_first.beat_to_beat_interval_milliseconds = 1_100;
        comparison_first.breathing_interval_milliseconds = 4_100;
        comparison_first.heart_rate_variability_rmssd_milliseconds = None;
        comparison_first.source_assessment = None;
        comparison_first.source_baseline = None;
        comparison_first.source_guidance = None;
        let mut comparison_second = comparison_first.clone();
        comparison_second.recovery_date = "2026-01-05".to_owned();
        comparison_second.beat_to_beat_interval_milliseconds = 1_101;
        comparison_second.breathing_interval_milliseconds = 4_101;

        let comparison = query_recovery_comparison(
            &ControlledRecoveryPort {
                bounds: Some(RecoveryDateRange {
                    from: "2026-01-01".to_owned(),
                    through: "2026-01-10".to_owned(),
                }),
                origins: vec!["origin-b".to_owned(), "origin-a".to_owned()],
                nights: vec![baseline, comparison_first, comparison_second],
                detail: None,
            },
            RecoveryDateRange {
                from: "2026-01-01".to_owned(),
                through: "2026-01-02".to_owned(),
            },
            RecoveryDateRange {
                from: "2026-01-04".to_owned(),
                through: "2026-01-06".to_owned(),
            },
        )
        .expect("recovery comparison");

        let origin_a = &comparison.series[0];
        assert_eq!(origin_a.series_ref, "origin-a");
        assert_eq!(origin_a.baseline.calendar_days, 2);
        assert_eq!(origin_a.comparison.calendar_days, 3);
        assert_eq!(origin_a.observed_night_change, 1);
        assert_eq!(origin_a.missing_night_change, 0);
        assert_eq!(
            origin_a.average_beat_to_beat_interval_milliseconds_change,
            Some(101)
        );
        assert_eq!(
            origin_a.average_heart_rate_variability_rmssd_milliseconds_change,
            None
        );
        assert_eq!(
            origin_a.average_breathing_interval_milliseconds_change,
            Some(101)
        );
        assert_eq!(origin_a.assessment_night_change, -1);
        assert_eq!(origin_a.baseline_night_change, -1);
        assert_eq!(origin_a.guidance_night_change, -1);
        let origin_b = &comparison.series[1];
        assert_eq!(origin_b.baseline.missing_nights, 2);
        assert_eq!(origin_b.comparison.missing_nights, 3);
        assert_eq!(
            origin_b.average_beat_to_beat_interval_milliseconds_change,
            None
        );
    }

    #[test]
    fn returns_complete_detail_and_rejects_an_inconsistent_identity() {
        let recovery = nightly_recovery("origin-a", "2026-01-18");
        let detail = query_recovery_detail(
            &ControlledRecoveryPort {
                bounds: None,
                origins: Vec::new(),
                nights: Vec::new(),
                detail: Some(recovery.clone()),
            },
            "origin-a",
            "2026-01-18",
        )
        .expect("recovery detail")
        .expect("stored recovery night");

        assert_eq!(detail.recovery_date, "2026-01-18");
        assert_eq!(detail.heart_rate_variability_rmssd_milliseconds, Some(40));
        assert_eq!(detail.source_assessment, recovery.source_assessment);
        assert_eq!(detail.source_baseline, recovery.source_baseline);
        assert_eq!(detail.source_guidance, recovery.source_guidance);

        let inconsistent = nightly_recovery("origin-b", "2026-01-18");
        assert!(matches!(
            query_recovery_detail(
                &ControlledRecoveryPort {
                    bounds: None,
                    origins: Vec::new(),
                    nights: Vec::new(),
                    detail: Some(inconsistent),
                },
                "origin-a",
                "2026-01-18",
            ),
            Err(ApplicationError::Query(_))
        ));
    }

    #[test]
    fn rejects_invalid_ranges_before_querying_origins_or_facts() {
        struct RangeValidationRecoveryPort;

        impl RecoveryLibraryPort for RangeValidationRecoveryPort {
            fn recovery_bounds(&self) -> Result<Option<RecoveryDateRange>, String> {
                Ok(Some(RecoveryDateRange {
                    from: "2024-01-01".to_owned(),
                    through: "2026-12-31".to_owned(),
                }))
            }

            fn recovery_origins(&self) -> Result<Vec<String>, String> {
                panic!("invalid recovery ranges must stop before origin retrieval")
            }

            fn query_recovery(
                &self,
                _range: &RecoveryDateRange,
            ) -> Result<Vec<RecoveryLibraryNight>, String> {
                panic!("invalid recovery ranges must stop before fact retrieval")
            }

            fn query_recovery_night(
                &self,
                _series_ref: &str,
                _recovery_date: &str,
            ) -> Result<Option<NightlyRecovery>, String> {
                panic!("range validation does not query detail")
            }
        }

        for range in [
            RecoveryDateRange {
                from: "2026-02-30".to_owned(),
                through: "2026-03-01".to_owned(),
            },
            RecoveryDateRange {
                from: "2026-03-02".to_owned(),
                through: "2026-03-01".to_owned(),
            },
            RecoveryDateRange {
                from: "2023-12-31".to_owned(),
                through: "2024-01-01".to_owned(),
            },
            RecoveryDateRange {
                from: "2025-01-01".to_owned(),
                through: "2026-01-02".to_owned(),
            },
        ] {
            assert!(matches!(
                query_recovery_overview(&RangeValidationRecoveryPort, Some(range.clone())),
                Err(ApplicationError::InvalidRecoveryRange(_))
            ));
            assert!(matches!(
                query_recovery_comparison(
                    &RangeValidationRecoveryPort,
                    range,
                    RecoveryDateRange {
                        from: "2026-01-01".to_owned(),
                        through: "2026-01-02".to_owned(),
                    },
                ),
                Err(ApplicationError::InvalidRecoveryRange(_))
            ));
        }
    }

    #[test]
    fn rejects_invalid_facts_source_groups_and_origin_catalogs() {
        for origins in [
            Vec::new(),
            vec![String::new()],
            vec![" ".to_owned()],
            vec!["origin-a".to_owned(), "origin-a".to_owned()],
        ] {
            assert!(matches!(
                query_recovery_overview(
                    &ControlledRecoveryPort {
                        bounds: Some(RecoveryDateRange {
                            from: "2026-01-01".to_owned(),
                            through: "2026-01-01".to_owned(),
                        }),
                        origins,
                        nights: Vec::new(),
                        detail: None,
                    },
                    None,
                ),
                Err(ApplicationError::Query(_))
            ));
        }

        let mut invalid_measurement = nightly_recovery("origin-a", "2026-01-01");
        invalid_measurement.beat_to_beat_interval_milliseconds = 0;
        let mut invalid_assessment = nightly_recovery("origin-a", "2026-01-01");
        invalid_assessment
            .source_assessment
            .as_mut()
            .expect("assessment")
            .autonomic_status = 6;
        for recovery in [invalid_measurement, invalid_assessment] {
            assert!(matches!(
                query_recovery_overview(
                    &ControlledRecoveryPort {
                        bounds: Some(RecoveryDateRange {
                            from: "2026-01-01".to_owned(),
                            through: "2026-01-01".to_owned(),
                        }),
                        origins: vec!["origin-a".to_owned()],
                        nights: vec![recovery],
                        detail: None,
                    },
                    None,
                ),
                Err(ApplicationError::Query(_))
            ));
        }

        let mut invalid_baseline = nightly_recovery("origin-a", "2026-01-01");
        invalid_baseline
            .source_baseline
            .as_mut()
            .expect("baseline")
            .standard_deviation_heart_rate_variability_rmssd_milliseconds = None;
        let mut invalid_guidance = nightly_recovery("origin-a", "2026-01-01");
        invalid_guidance
            .source_guidance
            .as_mut()
            .expect("guidance")
            .sleep = " ".to_owned();
        for recovery in [invalid_baseline, invalid_guidance] {
            assert!(matches!(
                query_recovery_detail(
                    &ControlledRecoveryPort {
                        bounds: None,
                        origins: Vec::new(),
                        nights: Vec::new(),
                        detail: Some(recovery),
                    },
                    "origin-a",
                    "2026-01-01",
                ),
                Err(ApplicationError::Query(_))
            ));
        }

        assert!(matches!(
            query_recovery_detail(
                &ControlledRecoveryPort {
                    bounds: None,
                    origins: Vec::new(),
                    nights: Vec::new(),
                    detail: None,
                },
                "",
                "2026-01-01",
            ),
            Err(ApplicationError::InvalidRecoveryReference(_))
        ));
        assert!(matches!(
            query_recovery_detail(
                &ControlledRecoveryPort {
                    bounds: None,
                    origins: Vec::new(),
                    nights: Vec::new(),
                    detail: None,
                },
                " ",
                "2026-01-01",
            ),
            Err(ApplicationError::InvalidRecoveryReference(_))
        ));
    }

    #[test]
    fn returns_empty_read_models_without_querying_facts() {
        struct EmptyRecoveryPort;

        impl RecoveryLibraryPort for EmptyRecoveryPort {
            fn recovery_bounds(&self) -> Result<Option<RecoveryDateRange>, String> {
                Ok(None)
            }

            fn recovery_origins(&self) -> Result<Vec<String>, String> {
                panic!("an empty recovery library has no origins")
            }

            fn query_recovery(
                &self,
                _range: &RecoveryDateRange,
            ) -> Result<Vec<RecoveryLibraryNight>, String> {
                panic!("an empty recovery library has no range")
            }

            fn query_recovery_night(
                &self,
                _series_ref: &str,
                _recovery_date: &str,
            ) -> Result<Option<NightlyRecovery>, String> {
                Ok(None)
            }
        }

        assert_eq!(
            query_default_recovery_overview(&EmptyRecoveryPort).expect("empty recovery overview"),
            RecoveryOverview {
                available_range: None,
                selected_range: None,
                series: Vec::new(),
            }
        );
        assert_eq!(
            query_recovery_comparison(
                &EmptyRecoveryPort,
                RecoveryDateRange {
                    from: "2026-01-01".to_owned(),
                    through: "2026-01-02".to_owned(),
                },
                RecoveryDateRange {
                    from: "2026-01-03".to_owned(),
                    through: "2026-01-04".to_owned(),
                },
            )
            .expect("empty recovery comparison"),
            RecoveryComparison {
                available_range: None,
                baseline_range: None,
                comparison_range: None,
                series: Vec::new(),
            }
        );
        assert_eq!(
            query_recovery_detail(&EmptyRecoveryPort, "origin", "2026-01-01")
                .expect("empty recovery detail"),
            None
        );
    }
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

pub const APPLICATION_PREFERENCES_VERSION: u32 = 1;
pub const MINIMUM_CONTENT_ZOOM_PERCENT: u16 = 100;
pub const MAXIMUM_CONTENT_ZOOM_PERCENT: u16 = 200;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppearancePreference {
    System,
    Light,
    Dark,
}

impl AppearancePreference {
    pub const fn from_code(code: &str) -> Option<Self> {
        match code.as_bytes() {
            b"system" => Some(Self::System),
            b"light" => Some(Self::Light),
            b"dark" => Some(Self::Dark),
            _ => None,
        }
    }

    pub const fn code(self) -> &'static str {
        match self {
            Self::System => "system",
            Self::Light => "light",
            Self::Dark => "dark",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApplicationPreferences {
    pub version: u32,
    pub locale: LocalePreference,
    pub appearance: AppearancePreference,
    pub content_zoom_percent: u16,
}

impl ApplicationPreferences {
    pub fn new(
        locale: LocalePreference,
        appearance: AppearancePreference,
        content_zoom_percent: u16,
    ) -> Result<Self, InvalidApplicationPreferences> {
        if !(MINIMUM_CONTENT_ZOOM_PERCENT..=MAXIMUM_CONTENT_ZOOM_PERCENT)
            .contains(&content_zoom_percent)
        {
            return Err(InvalidApplicationPreferences::ContentZoom);
        }
        Ok(Self {
            version: APPLICATION_PREFERENCES_VERSION,
            locale,
            appearance,
            content_zoom_percent,
        })
    }

    pub fn defaults(locale: LocalePreference) -> Self {
        Self::new(
            locale,
            AppearancePreference::System,
            MINIMUM_CONTENT_ZOOM_PERCENT,
        )
        .expect("application preference defaults are valid")
    }
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum InvalidApplicationPreferences {
    #[error("application preference version is unsupported")]
    Version,
    #[error("application preference locale is unsupported")]
    Locale,
    #[error("application appearance is unsupported")]
    Appearance,
    #[error("content zoom must be from 100 through 200 percent")]
    ContentZoom,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredApplicationPreferences {
    pub version: i64,
    pub locale: String,
    pub appearance: String,
    pub content_zoom_percent: i64,
}

impl TryFrom<StoredApplicationPreferences> for ApplicationPreferences {
    type Error = InvalidApplicationPreferences;

    fn try_from(stored: StoredApplicationPreferences) -> Result<Self, Self::Error> {
        if stored.version != i64::from(APPLICATION_PREFERENCES_VERSION) {
            return Err(InvalidApplicationPreferences::Version);
        }
        let locale = LocalePreference::from_code(&stored.locale)
            .ok_or(InvalidApplicationPreferences::Locale)?;
        let appearance = AppearancePreference::from_code(&stored.appearance)
            .ok_or(InvalidApplicationPreferences::Appearance)?;
        let content_zoom_percent = u16::try_from(stored.content_zoom_percent)
            .map_err(|_| InvalidApplicationPreferences::ContentZoom)?;
        Self::new(locale, appearance, content_zoom_percent)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PreferencesLoadStatus {
    Current,
    Initialized,
    Recovered,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApplicationPreferencesLoad {
    pub preferences: ApplicationPreferences,
    pub status: PreferencesLoadStatus,
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
const DEFAULT_SLEEP_WINDOW_DAYS: u64 = 30;
const MAX_SLEEP_RANGE_DAYS: i64 = 366;
const DEFAULT_RECOVERY_WINDOW_DAYS: u64 = 30;
const MAX_RECOVERY_RANGE_DAYS: i64 = 366;

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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SleepDateRange {
    pub from: String,
    pub through: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SleepDayAvailability {
    Available,
    Missing,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SleepPhaseTotals {
    pub wake_milliseconds: i128,
    pub rem_milliseconds: i128,
    pub light_milliseconds: i128,
    pub deep_milliseconds: i128,
    pub unrecognized_milliseconds: i128,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SleepPeriodInsight {
    pub started_at: String,
    pub ended_at: String,
    pub span_milliseconds: i64,
    pub asleep_milliseconds: i64,
    pub interruption_milliseconds: i64,
    pub long_interruption_milliseconds: i64,
    pub short_interruption_milliseconds: i64,
    pub interruption_count: i64,
    pub long_interruption_count: i64,
    pub short_interruption_count: i64,
    pub efficiency_percent: f64,
    pub continuity_index: f64,
    pub continuity_class: i64,
    pub sleep_goal_milliseconds: Option<i64>,
    pub self_reported_rating: Option<i64>,
    pub cycle_count: Option<usize>,
    pub recording_ended_by_power_loss: Option<bool>,
    pub phase_summary: Option<SleepPhaseSummary>,
    pub stage_timeline_available: bool,
    pub score_overall: Option<f64>,
    pub score_relative_rating: Option<i64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SleepLibraryPeriod {
    pub origin_id: String,
    pub sleep_date: String,
    pub started_at: String,
    pub ended_at: String,
    pub span_milliseconds: i64,
    pub asleep_milliseconds: i64,
    pub interruption_milliseconds: i64,
    pub long_interruption_milliseconds: i64,
    pub short_interruption_milliseconds: i64,
    pub interruption_count: i64,
    pub long_interruption_count: i64,
    pub short_interruption_count: i64,
    pub efficiency_percent: f64,
    pub continuity_index: f64,
    pub continuity_class: i64,
    pub sleep_goal_milliseconds: Option<i64>,
    pub self_reported_rating: Option<i64>,
    pub cycle_count: Option<usize>,
    pub recording_ended_by_power_loss: Option<bool>,
    pub phase_summary: Option<SleepPhaseSummary>,
    pub stage_timeline_available: bool,
    pub score: Option<SleepScore>,
}

impl From<&SleepPeriod> for SleepLibraryPeriod {
    fn from(period: &SleepPeriod) -> Self {
        Self {
            origin_id: period.origin_id.clone(),
            sleep_date: period.sleep_date.clone(),
            started_at: period.started_at.clone(),
            ended_at: period.ended_at.clone(),
            span_milliseconds: period.span_milliseconds,
            asleep_milliseconds: period.asleep_milliseconds,
            interruption_milliseconds: period.interruption_milliseconds,
            long_interruption_milliseconds: period.long_interruption_milliseconds,
            short_interruption_milliseconds: period.short_interruption_milliseconds,
            interruption_count: period.interruption_count,
            long_interruption_count: period.long_interruption_count,
            short_interruption_count: period.short_interruption_count,
            efficiency_percent: period.efficiency_percent,
            continuity_index: period.continuity_index,
            continuity_class: period.continuity_class,
            sleep_goal_milliseconds: period.sleep_goal_milliseconds,
            self_reported_rating: period.self_reported_rating,
            cycle_count: period.cycle_count,
            recording_ended_by_power_loss: period.recording_ended_by_power_loss,
            phase_summary: period.phase_summary.clone(),
            stage_timeline_available: period.stage_transitions.is_some(),
            score: period.score.clone(),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct SleepDayInsight {
    pub sleep_date: String,
    pub availability: SleepDayAvailability,
    pub period: Option<SleepPeriodInsight>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SleepSeriesSummary {
    pub calendar_days: usize,
    pub observed_nights: usize,
    pub missing_nights: usize,
    pub total_asleep_milliseconds: Option<i128>,
    pub average_asleep_milliseconds: Option<i128>,
    pub total_interruption_milliseconds: Option<i128>,
    pub average_interruption_milliseconds: Option<i128>,
    pub average_efficiency_percent: Option<f64>,
    pub phase_night_count: usize,
    pub phase_totals: Option<SleepPhaseTotals>,
    pub stage_timeline_night_count: usize,
    pub score_night_count: usize,
    pub average_overall_score: Option<f64>,
    pub goal_night_count: usize,
    pub goal_met_night_count: usize,
    pub power_status_night_count: usize,
    pub power_loss_night_count: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SleepSeriesOverview {
    pub series_ref: String,
    pub summary: SleepSeriesSummary,
    pub days: Vec<SleepDayInsight>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SleepOverview {
    pub available_range: Option<SleepDateRange>,
    pub selected_range: Option<SleepDateRange>,
    pub series: Vec<SleepSeriesOverview>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SleepSeriesComparison {
    pub series_ref: String,
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

#[derive(Debug, Clone, PartialEq)]
pub struct SleepComparison {
    pub available_range: Option<SleepDateRange>,
    pub baseline_range: Option<SleepDateRange>,
    pub comparison_range: Option<SleepDateRange>,
    pub series: Vec<SleepSeriesComparison>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SleepPeriodDetail {
    pub sleep_date: String,
    pub started_at: String,
    pub ended_at: String,
    pub span_milliseconds: i64,
    pub asleep_milliseconds: i64,
    pub interruption_milliseconds: i64,
    pub long_interruption_milliseconds: i64,
    pub short_interruption_milliseconds: i64,
    pub interruption_count: i64,
    pub long_interruption_count: i64,
    pub short_interruption_count: i64,
    pub efficiency_percent: f64,
    pub continuity_index: f64,
    pub continuity_class: i64,
    pub sleep_goal_milliseconds: Option<i64>,
    pub self_reported_rating: Option<i64>,
    pub cycle_count: Option<usize>,
    pub recording_ended_by_power_loss: Option<bool>,
    pub phase_summary: Option<SleepPhaseSummary>,
    pub stage_transitions: Option<Vec<SleepStageTransition>>,
    pub score: Option<SleepScore>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecoveryDateRange {
    pub from: String,
    pub through: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecoveryDayAvailability {
    Available,
    Missing,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RecoveryNightInsight {
    pub beat_to_beat_interval_milliseconds: i64,
    pub heart_rate_variability_rmssd_milliseconds: Option<i64>,
    pub breathing_interval_milliseconds: i64,
    pub source_assessment: Option<SourceSpecificRecoveryAssessment>,
    pub source_baseline_available: bool,
    pub source_guidance_available: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RecoveryLibraryNight {
    pub origin_id: String,
    pub recovery_date: String,
    pub beat_to_beat_interval_milliseconds: i64,
    pub heart_rate_variability_rmssd_milliseconds: Option<i64>,
    pub breathing_interval_milliseconds: i64,
    pub source_assessment: Option<SourceSpecificRecoveryAssessment>,
    pub source_baseline_available: bool,
    pub source_guidance_available: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RecoveryDayInsight {
    pub recovery_date: String,
    pub availability: RecoveryDayAvailability,
    pub recovery: Option<RecoveryNightInsight>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecoverySeriesSummary {
    pub calendar_days: usize,
    pub observed_nights: usize,
    pub missing_nights: usize,
    pub average_beat_to_beat_interval_milliseconds: Option<i128>,
    pub rmssd_night_count: usize,
    pub average_heart_rate_variability_rmssd_milliseconds: Option<i128>,
    pub average_breathing_interval_milliseconds: Option<i128>,
    pub assessment_night_count: usize,
    pub baseline_night_count: usize,
    pub guidance_night_count: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RecoverySeriesOverview {
    pub series_ref: String,
    pub summary: RecoverySeriesSummary,
    pub days: Vec<RecoveryDayInsight>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RecoveryOverview {
    pub available_range: Option<RecoveryDateRange>,
    pub selected_range: Option<RecoveryDateRange>,
    pub series: Vec<RecoverySeriesOverview>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecoverySeriesComparison {
    pub series_ref: String,
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
pub struct RecoveryComparison {
    pub available_range: Option<RecoveryDateRange>,
    pub baseline_range: Option<RecoveryDateRange>,
    pub comparison_range: Option<RecoveryDateRange>,
    pub series: Vec<RecoverySeriesComparison>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RecoveryNightDetail {
    pub recovery_date: String,
    pub beat_to_beat_interval_milliseconds: i64,
    pub heart_rate_variability_rmssd_milliseconds: Option<i64>,
    pub breathing_interval_milliseconds: i64,
    pub source_assessment: Option<SourceSpecificRecoveryAssessment>,
    pub source_baseline: Option<SourceSpecificRecoveryBaseline>,
    pub source_guidance: Option<SourceSpecificRecoveryGuidance>,
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

pub trait SleepLibraryPort {
    fn sleep_bounds(&self) -> Result<Option<SleepDateRange>, String>;
    fn sleep_origins(&self) -> Result<Vec<String>, String>;
    fn query_sleep(&self, range: &SleepDateRange) -> Result<Vec<SleepLibraryPeriod>, String>;
    fn query_sleep_period(
        &self,
        series_ref: &str,
        sleep_date: &str,
    ) -> Result<Option<SleepPeriod>, String>;
}

pub trait RecoveryLibraryPort {
    fn recovery_bounds(&self) -> Result<Option<RecoveryDateRange>, String>;
    fn recovery_origins(&self) -> Result<Vec<String>, String>;
    fn query_recovery(
        &self,
        range: &RecoveryDateRange,
    ) -> Result<Vec<RecoveryLibraryNight>, String>;
    fn query_recovery_night(
        &self,
        series_ref: &str,
        recovery_date: &str,
    ) -> Result<Option<NightlyRecovery>, String>;
}

pub trait ImportOutcomeLibraryPort {
    fn latest_import_outcome(&self) -> Result<Option<ImportOutcome>, String>;
}

pub trait ApplicationPreferencesPort {
    fn load_preferences(&self) -> Result<Option<StoredApplicationPreferences>, String>;
    fn save_preferences(&self, preferences: &ApplicationPreferences) -> Result<(), String>;
}

#[derive(Debug, Error)]
pub enum ApplicationError {
    #[error("another import is already active")]
    ImportAlreadyActive,
    #[error("another exclusive desktop operation is already active")]
    ExclusiveOperationAlreadyActive,
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
    #[error("invalid training-session search: {0}")]
    InvalidTrainingSessionSearch(&'static str),
    #[error("training-session search changed while it was being paged")]
    TrainingSessionSearchChanged,
    #[error("training-session search failed: {0}")]
    TrainingSessionSearch(String),
    #[error("invalid sport classification: {0}")]
    InvalidSportClassification(&'static str),
    #[error("sport classification changed while it was being edited")]
    SportClassificationConflict,
    #[error("sport classification query failed: {0}")]
    SportClassificationQuery(String),
    #[error("sport classification update failed: {0}")]
    SportClassificationUpdate(String),
    #[error("invalid sleep range: {0}")]
    InvalidSleepRange(&'static str),
    #[error("invalid sleep reference: {0}")]
    InvalidSleepReference(&'static str),
    #[error("invalid recovery range: {0}")]
    InvalidRecoveryRange(&'static str),
    #[error("invalid recovery reference: {0}")]
    InvalidRecoveryReference(&'static str),
    #[error("invalid longitudinal range: {0}")]
    InvalidLongitudinalRange(&'static str),
    #[error("invalid library home request: {0}")]
    InvalidLibraryHomeRequest(&'static str),
    #[error("invalid exploration workspace: {0}")]
    InvalidExplorationWorkspace(&'static str),
    #[error("exploration workspace query failed: {0}")]
    WorkspaceQuery(String),
    #[error("exploration workspace update failed: {0}")]
    WorkspaceUpdate(String),
    #[error("import outcome query failed: {0}")]
    OutcomeQuery(String),
    #[error("source acquisition guide query failed: {0}")]
    SourceAcquisitionGuideQuery(String),
    #[error("application preference query failed: {0}")]
    PreferenceQuery(String),
    #[error("application preference update failed: {0}")]
    PreferenceUpdate(String),
}

#[derive(Clone, Default)]
pub struct ImportCoordinator {
    active_operation: Arc<Mutex<Option<ActiveDesktopOperation>>>,
}

enum ActiveDesktopOperation {
    Import(Arc<AtomicBool>),
    Exclusive(Arc<()>),
}

pub struct ExclusiveDesktopOperation {
    active_operation: Arc<Mutex<Option<ActiveDesktopOperation>>>,
    token: Arc<()>,
}

impl ImportCoordinator {
    fn begin(&self) -> Result<Arc<AtomicBool>, ApplicationError> {
        let mut active = self
            .active_operation
            .lock()
            .map_err(|error| ApplicationError::Coordination(error.to_string()))?;
        if active.is_some() {
            return Err(ApplicationError::ImportAlreadyActive);
        }
        let cancellation = Arc::new(AtomicBool::new(false));
        *active = Some(ActiveDesktopOperation::Import(Arc::clone(&cancellation)));
        Ok(cancellation)
    }

    pub fn reserve_exclusive_operation(
        &self,
    ) -> Result<ExclusiveDesktopOperation, ApplicationError> {
        let mut active = self
            .active_operation
            .lock()
            .map_err(|error| ApplicationError::Coordination(error.to_string()))?;
        if active.is_some() {
            return Err(ApplicationError::ExclusiveOperationAlreadyActive);
        }
        let token = Arc::new(());
        *active = Some(ActiveDesktopOperation::Exclusive(Arc::clone(&token)));
        Ok(ExclusiveDesktopOperation {
            active_operation: Arc::clone(&self.active_operation),
            token,
        })
    }

    pub fn cancel(&self) -> Result<bool, ApplicationError> {
        let active = self
            .active_operation
            .lock()
            .map_err(|error| ApplicationError::Coordination(error.to_string()))?;
        if let Some(ActiveDesktopOperation::Import(cancellation)) = active.as_ref() {
            cancellation.store(true, Ordering::Relaxed);
            Ok(true)
        } else {
            Ok(false)
        }
    }

    fn finish(&self, cancellation: &Arc<AtomicBool>) -> Result<(), ApplicationError> {
        let mut active = self
            .active_operation
            .lock()
            .map_err(|error| ApplicationError::Coordination(error.to_string()))?;
        if matches!(
            active.as_ref(),
            Some(ActiveDesktopOperation::Import(current)) if Arc::ptr_eq(current, cancellation)
        ) {
            *active = None;
        }
        Ok(())
    }
}

impl Drop for ExclusiveDesktopOperation {
    fn drop(&mut self) {
        if let Ok(mut active) = self.active_operation.lock() {
            if matches!(
                active.as_ref(),
                Some(ActiveDesktopOperation::Exclusive(current))
                    if Arc::ptr_eq(current, &self.token)
            ) {
                *active = None;
            }
        }
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

pub fn query_default_sleep_overview(
    port: &dyn SleepLibraryPort,
) -> Result<SleepOverview, ApplicationError> {
    query_sleep_overview(port, None)
}

pub fn query_sleep_overview(
    port: &dyn SleepLibraryPort,
    requested_range: Option<SleepDateRange>,
) -> Result<SleepOverview, ApplicationError> {
    let Some(available_range) = port.sleep_bounds().map_err(ApplicationError::Query)? else {
        return Ok(SleepOverview {
            available_range: None,
            selected_range: None,
            series: Vec::new(),
        });
    };
    let (earliest, latest) = parse_sleep_bounds(&available_range)?;
    let (from, through, selected_range) = match requested_range {
        Some(range) => {
            let (from, through) = validate_sleep_range(&range, earliest, latest)?;
            (from, through, range)
        }
        None => {
            let from = latest
                .checked_sub_days(Days::new(DEFAULT_SLEEP_WINDOW_DAYS - 1))
                .unwrap_or(earliest)
                .max(earliest);
            let range = SleepDateRange {
                from: from.format("%Y-%m-%d").to_string(),
                through: latest.format("%Y-%m-%d").to_string(),
            };
            (from, latest, range)
        }
    };
    let origins = port.sleep_origins().map_err(ApplicationError::Query)?;
    let periods = port
        .query_sleep(&selected_range)
        .map_err(ApplicationError::Query)?;
    let series = build_sleep_series(from, through, origins, periods)?;

    Ok(SleepOverview {
        available_range: Some(available_range),
        selected_range: Some(selected_range),
        series,
    })
}

pub fn query_sleep_comparison(
    port: &dyn SleepLibraryPort,
    baseline_range: SleepDateRange,
    comparison_range: SleepDateRange,
) -> Result<SleepComparison, ApplicationError> {
    let Some(available_range) = port.sleep_bounds().map_err(ApplicationError::Query)? else {
        return Ok(SleepComparison {
            available_range: None,
            baseline_range: None,
            comparison_range: None,
            series: Vec::new(),
        });
    };
    let (earliest, latest) = parse_sleep_bounds(&available_range)?;
    let (baseline_from, baseline_through) =
        validate_sleep_range(&baseline_range, earliest, latest)?;
    let (comparison_from, comparison_through) =
        validate_sleep_range(&comparison_range, earliest, latest)?;
    let origins = port.sleep_origins().map_err(ApplicationError::Query)?;
    let baseline_periods = port
        .query_sleep(&baseline_range)
        .map_err(ApplicationError::Query)?;
    let comparison_periods = port
        .query_sleep(&comparison_range)
        .map_err(ApplicationError::Query)?;
    let baseline_series = build_sleep_series(
        baseline_from,
        baseline_through,
        origins.clone(),
        baseline_periods,
    )?;
    let comparison_series = build_sleep_series(
        comparison_from,
        comparison_through,
        origins,
        comparison_periods,
    )?;
    let series = baseline_series
        .into_iter()
        .zip(comparison_series)
        .map(|(baseline, comparison)| {
            if baseline.series_ref != comparison.series_ref {
                return Err(ApplicationError::Query(
                    "sleep comparison origins are not aligned".to_owned(),
                ));
            }
            Ok(SleepSeriesComparison {
                series_ref: baseline.series_ref,
                observed_night_change: sleep_count_change(
                    baseline.summary.observed_nights,
                    comparison.summary.observed_nights,
                )?,
                missing_night_change: sleep_count_change(
                    baseline.summary.missing_nights,
                    comparison.summary.missing_nights,
                )?,
                average_asleep_milliseconds_change: optional_change(
                    baseline.summary.average_asleep_milliseconds,
                    comparison.summary.average_asleep_milliseconds,
                ),
                average_interruption_milliseconds_change: optional_change(
                    baseline.summary.average_interruption_milliseconds,
                    comparison.summary.average_interruption_milliseconds,
                ),
                average_efficiency_percentage_point_change: optional_float_change(
                    baseline.summary.average_efficiency_percent,
                    comparison.summary.average_efficiency_percent,
                ),
                average_overall_score_change: optional_float_change(
                    baseline.summary.average_overall_score,
                    comparison.summary.average_overall_score,
                ),
                goal_met_percentage_point_change: optional_float_change(
                    goal_met_percent(&baseline.summary),
                    goal_met_percent(&comparison.summary),
                ),
                baseline: baseline.summary,
                comparison: comparison.summary,
            })
        })
        .collect::<Result<Vec<_>, _>>()?;

    Ok(SleepComparison {
        available_range: Some(available_range),
        baseline_range: Some(baseline_range),
        comparison_range: Some(comparison_range),
        series,
    })
}

pub fn query_sleep_detail(
    port: &dyn SleepLibraryPort,
    series_ref: &str,
    sleep_date: &str,
) -> Result<Option<SleepPeriodDetail>, ApplicationError> {
    if series_ref.is_empty() {
        return Err(ApplicationError::InvalidSleepReference(
            "series reference is empty",
        ));
    }
    parse_sleep_date(sleep_date).map_err(ApplicationError::InvalidSleepReference)?;
    let period = port
        .query_sleep_period(series_ref, sleep_date)
        .map_err(ApplicationError::Query)?;
    period
        .map(|period| {
            validate_sleep_detail_period(&period)?;
            if period.origin_id != series_ref || period.sleep_date != sleep_date {
                return Err(ApplicationError::Query(
                    "sleep detail identity does not match its query".to_owned(),
                ));
            }
            Ok(sleep_period_detail(period))
        })
        .transpose()
}

fn parse_sleep_bounds(
    available_range: &SleepDateRange,
) -> Result<(NaiveDate, NaiveDate), ApplicationError> {
    let earliest = parse_sleep_date(&available_range.from)
        .map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
    let latest = parse_sleep_date(&available_range.through)
        .map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
    if earliest > latest {
        return Err(ApplicationError::Query(
            "sleep bounds are not ordered".to_owned(),
        ));
    }
    Ok((earliest, latest))
}

fn validate_sleep_range(
    range: &SleepDateRange,
    earliest: NaiveDate,
    latest: NaiveDate,
) -> Result<(NaiveDate, NaiveDate), ApplicationError> {
    let from = parse_sleep_date(&range.from).map_err(ApplicationError::InvalidSleepRange)?;
    let through = parse_sleep_date(&range.through).map_err(ApplicationError::InvalidSleepRange)?;
    if from > through {
        return Err(ApplicationError::InvalidSleepRange(
            "range dates are not ordered",
        ));
    }
    if from < earliest || through > latest {
        return Err(ApplicationError::InvalidSleepRange(
            "range is outside available sleep history",
        ));
    }
    if through.signed_duration_since(from).num_days() + 1 > MAX_SLEEP_RANGE_DAYS {
        return Err(ApplicationError::InvalidSleepRange(
            "range exceeds 366 inclusive calendar days",
        ));
    }
    Ok((from, through))
}

fn parse_sleep_date(value: &str) -> Result<NaiveDate, &'static str> {
    let parsed =
        NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|_| "sleep date is invalid")?;
    if parsed.format("%Y-%m-%d").to_string() != value {
        return Err("sleep date is not canonical");
    }
    Ok(parsed)
}

fn parse_sleep_offset_datetime(value: &str) -> Result<DateTime<FixedOffset>, &'static str> {
    let bytes = value.as_bytes();
    if bytes.len() < 25
        || !matches!(bytes.get(bytes.len() - 6), Some(b'+') | Some(b'-'))
        || bytes.get(bytes.len() - 3) != Some(&b':')
    {
        return Err("sleep boundary must retain a numeric UTC offset");
    }
    let parsed = DateTime::parse_from_rfc3339(value).map_err(|_| "sleep boundary is invalid")?;
    if parsed.to_rfc3339_opts(SecondsFormat::AutoSi, false) != value {
        return Err("sleep boundary is not canonical");
    }
    Ok(parsed)
}

fn build_sleep_series(
    from: NaiveDate,
    through: NaiveDate,
    origins: Vec<String>,
    periods: Vec<SleepLibraryPeriod>,
) -> Result<Vec<SleepSeriesOverview>, ApplicationError> {
    let mut observations = BTreeMap::<String, BTreeMap<NaiveDate, SleepLibraryPeriod>>::new();
    for origin in origins {
        if origin.is_empty() {
            return Err(ApplicationError::Query(
                "sleep query returned an empty origin".to_owned(),
            ));
        }
        if observations.insert(origin, BTreeMap::new()).is_some() {
            return Err(ApplicationError::Query(
                "sleep query returned a duplicate origin".to_owned(),
            ));
        }
    }
    if observations.is_empty() {
        return Err(ApplicationError::Query(
            "sleep bounds exist without an origin".to_owned(),
        ));
    }

    for period in periods {
        validate_sleep_period(&period)?;
        let date = parse_sleep_date(&period.sleep_date)
            .map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
        if date < from || date > through {
            return Err(ApplicationError::Query(
                "sleep query returned a period outside its range".to_owned(),
            ));
        }
        let origin = observations.get_mut(&period.origin_id).ok_or_else(|| {
            ApplicationError::Query("sleep query returned an unknown origin".to_owned())
        })?;
        if origin.insert(date, period).is_some() {
            return Err(ApplicationError::Query(
                "sleep query returned a duplicate logical period".to_owned(),
            ));
        }
    }

    observations
        .into_iter()
        .map(|(series_ref, periods)| {
            build_sleep_series_overview(series_ref, from, through, periods)
        })
        .collect()
}

fn validate_sleep_period(period: &SleepLibraryPeriod) -> Result<(), ApplicationError> {
    if period.origin_id.is_empty() {
        return Err(ApplicationError::Query(
            "sleep query returned an empty identity".to_owned(),
        ));
    }
    parse_sleep_date(&period.sleep_date)
        .map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
    let started_at = parse_sleep_offset_datetime(&period.started_at)
        .map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
    let ended_at = parse_sleep_offset_datetime(&period.ended_at)
        .map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
    if ended_at <= started_at {
        return Err(ApplicationError::Query(
            "sleep query returned unordered boundaries".to_owned(),
        ));
    }
    let non_negative = [
        period.span_milliseconds,
        period.asleep_milliseconds,
        period.interruption_milliseconds,
        period.long_interruption_milliseconds,
        period.short_interruption_milliseconds,
        period.interruption_count,
        period.long_interruption_count,
        period.short_interruption_count,
    ];
    if non_negative.iter().any(|value| *value < 0)
        || period
            .sleep_goal_milliseconds
            .is_some_and(|value| value < 0)
    {
        return Err(ApplicationError::Query(
            "sleep query returned a negative measurement".to_owned(),
        ));
    }
    if checked_sleep_total(&[period.asleep_milliseconds, period.interruption_milliseconds])?
        != period.span_milliseconds
        || checked_sleep_total(&[
            period.long_interruption_milliseconds,
            period.short_interruption_milliseconds,
        ])? != period.interruption_milliseconds
        || checked_sleep_total(&[
            period.long_interruption_count,
            period.short_interruption_count,
        ])? != period.interruption_count
    {
        return Err(ApplicationError::Query(
            "sleep query returned inconsistent duration or count arithmetic".to_owned(),
        ));
    }
    if !period.efficiency_percent.is_finite()
        || !(0.0..=100.0).contains(&period.efficiency_percent)
        || !period.continuity_index.is_finite()
        || !(0.0..=5.0).contains(&period.continuity_index)
        || !(0..=5).contains(&period.continuity_class)
    {
        return Err(ApplicationError::Query(
            "sleep query returned a measurement outside its canonical range".to_owned(),
        ));
    }
    if period
        .self_reported_rating
        .is_some_and(|value| !(1..=5).contains(&value))
    {
        return Err(ApplicationError::Query(
            "sleep query returned an invalid self-reported rating".to_owned(),
        ));
    }
    if let Some(phases) = &period.phase_summary {
        let phase_values = [
            phases.wake_milliseconds,
            phases.rem_milliseconds,
            phases.light_milliseconds,
            phases.deep_milliseconds,
            phases.unrecognized_milliseconds,
        ];
        if phase_values.iter().any(|value| *value < 0) {
            return Err(ApplicationError::Query(
                "sleep query returned a negative phase duration".to_owned(),
            ));
        }
        let phase_span = checked_sleep_total(&phase_values)?;
        let phase_asleep = checked_sleep_total(&[
            phases.rem_milliseconds,
            phases.light_milliseconds,
            phases.deep_milliseconds,
            phases.unrecognized_milliseconds,
        ])?;
        if phase_span != period.span_milliseconds || phase_asleep != period.asleep_milliseconds {
            return Err(ApplicationError::Query(
                "sleep query returned inconsistent phase arithmetic".to_owned(),
            ));
        }
    }
    if let Some(score) = &period.score {
        validate_sleep_score(score)?;
    }
    Ok(())
}

fn validate_sleep_detail_period(period: &SleepPeriod) -> Result<(), ApplicationError> {
    validate_sleep_period(&SleepLibraryPeriod::from(period))?;
    if let Some(transitions) = &period.stage_transitions {
        if transitions
            .first()
            .is_some_and(|transition| transition.offset_milliseconds != 0)
        {
            return Err(ApplicationError::Query(
                "sleep query returned a timeline that does not start at zero".to_owned(),
            ));
        }
        let mut previous = None;
        for transition in transitions {
            if transition.offset_milliseconds < 0
                || transition.offset_milliseconds > period.span_milliseconds
                || previous.is_some_and(|value| transition.offset_milliseconds < value)
            {
                return Err(ApplicationError::Query(
                    "sleep query returned an invalid stage timeline".to_owned(),
                ));
            }
            previous = Some(transition.offset_milliseconds);
        }
    }
    Ok(())
}

fn validate_sleep_score(score: &SleepScore) -> Result<(), ApplicationError> {
    let values = [
        score.overall,
        score.own_target_duration,
        score.recommended_duration,
        score.continuity,
        score.efficiency,
        score.rem,
        score.deep,
        score.long_interruptions,
        score.duration,
        score.solidity,
        score.regeneration,
    ];
    if values
        .iter()
        .any(|value| !value.is_finite() || !(1.0..=100.0).contains(value))
        || score
            .relative_rating
            .is_some_and(|value| !(1..=5).contains(&value))
    {
        return Err(ApplicationError::Query(
            "sleep query returned an invalid score".to_owned(),
        ));
    }
    Ok(())
}

fn checked_sleep_total(values: &[i64]) -> Result<i64, ApplicationError> {
    values.iter().try_fold(0_i64, |total, value| {
        total
            .checked_add(*value)
            .ok_or_else(|| ApplicationError::Query("sleep arithmetic overflowed".to_owned()))
    })
}

fn build_sleep_series_overview(
    series_ref: String,
    from: NaiveDate,
    through: NaiveDate,
    periods: BTreeMap<NaiveDate, SleepLibraryPeriod>,
) -> Result<SleepSeriesOverview, ApplicationError> {
    let calendar_days = usize::try_from(through.signed_duration_since(from).num_days() + 1)
        .map_err(|_| ApplicationError::Query("sleep range is too large".to_owned()))?;
    let summary = summarize_sleep_periods(calendar_days, periods.values())?;
    let mut days = Vec::with_capacity(calendar_days);
    let mut date = from;
    loop {
        let period = periods.get(&date).map(sleep_period_insight);
        days.push(SleepDayInsight {
            sleep_date: date.format("%Y-%m-%d").to_string(),
            availability: if period.is_some() {
                SleepDayAvailability::Available
            } else {
                SleepDayAvailability::Missing
            },
            period,
        });
        if date == through {
            break;
        }
        date = date.succ_opt().ok_or_else(|| {
            ApplicationError::Query("sleep range exceeds supported dates".to_owned())
        })?;
    }

    Ok(SleepSeriesOverview {
        series_ref,
        summary,
        days,
    })
}

fn summarize_sleep_periods<'a>(
    calendar_days: usize,
    periods: impl Iterator<Item = &'a SleepLibraryPeriod>,
) -> Result<SleepSeriesSummary, ApplicationError> {
    let periods = periods.collect::<Vec<_>>();
    let observed_nights = periods.len();
    let missing_nights = calendar_days.checked_sub(observed_nights).ok_or_else(|| {
        ApplicationError::Query("sleep observations exceed the selected range".to_owned())
    })?;
    let mut total_asleep_milliseconds = 0_i128;
    let mut total_interruption_milliseconds = 0_i128;
    let mut efficiency_total = 0.0_f64;
    let mut phase_night_count = 0_usize;
    let mut phase_totals = SleepPhaseTotals {
        wake_milliseconds: 0,
        rem_milliseconds: 0,
        light_milliseconds: 0,
        deep_milliseconds: 0,
        unrecognized_milliseconds: 0,
    };
    let mut stage_timeline_night_count = 0_usize;
    let mut score_night_count = 0_usize;
    let mut overall_score_total = 0.0_f64;
    let mut goal_night_count = 0_usize;
    let mut goal_met_night_count = 0_usize;
    let mut power_status_night_count = 0_usize;
    let mut power_loss_night_count = 0_usize;

    for period in periods {
        total_asleep_milliseconds = total_asleep_milliseconds
            .checked_add(i128::from(period.asleep_milliseconds))
            .ok_or_else(|| ApplicationError::Query("sleep duration total overflowed".to_owned()))?;
        total_interruption_milliseconds = total_interruption_milliseconds
            .checked_add(i128::from(period.interruption_milliseconds))
            .ok_or_else(|| {
                ApplicationError::Query("sleep interruption total overflowed".to_owned())
            })?;
        efficiency_total += period.efficiency_percent;
        if !efficiency_total.is_finite() {
            return Err(ApplicationError::Query(
                "sleep efficiency total overflowed".to_owned(),
            ));
        }
        if let Some(phases) = &period.phase_summary {
            phase_night_count = checked_sleep_coverage(phase_night_count)?;
            phase_totals.wake_milliseconds = phase_totals
                .wake_milliseconds
                .checked_add(i128::from(phases.wake_milliseconds))
                .ok_or_else(|| {
                    ApplicationError::Query("sleep phase total overflowed".to_owned())
                })?;
            phase_totals.rem_milliseconds = phase_totals
                .rem_milliseconds
                .checked_add(i128::from(phases.rem_milliseconds))
                .ok_or_else(|| {
                    ApplicationError::Query("sleep phase total overflowed".to_owned())
                })?;
            phase_totals.light_milliseconds = phase_totals
                .light_milliseconds
                .checked_add(i128::from(phases.light_milliseconds))
                .ok_or_else(|| {
                    ApplicationError::Query("sleep phase total overflowed".to_owned())
                })?;
            phase_totals.deep_milliseconds = phase_totals
                .deep_milliseconds
                .checked_add(i128::from(phases.deep_milliseconds))
                .ok_or_else(|| {
                    ApplicationError::Query("sleep phase total overflowed".to_owned())
                })?;
            phase_totals.unrecognized_milliseconds = phase_totals
                .unrecognized_milliseconds
                .checked_add(i128::from(phases.unrecognized_milliseconds))
                .ok_or_else(|| {
                    ApplicationError::Query("sleep phase total overflowed".to_owned())
                })?;
        }
        if period.stage_timeline_available {
            stage_timeline_night_count = checked_sleep_coverage(stage_timeline_night_count)?;
        }
        if let Some(score) = &period.score {
            score_night_count = checked_sleep_coverage(score_night_count)?;
            overall_score_total += score.overall;
            if !overall_score_total.is_finite() {
                return Err(ApplicationError::Query(
                    "sleep score total overflowed".to_owned(),
                ));
            }
        }
        if let Some(goal) = period.sleep_goal_milliseconds {
            goal_night_count = checked_sleep_coverage(goal_night_count)?;
            if period.asleep_milliseconds >= goal {
                goal_met_night_count = checked_sleep_coverage(goal_met_night_count)?;
            }
        }
        if let Some(power_loss) = period.recording_ended_by_power_loss {
            power_status_night_count = checked_sleep_coverage(power_status_night_count)?;
            if power_loss {
                power_loss_night_count = checked_sleep_coverage(power_loss_night_count)?;
            }
        }
    }

    Ok(SleepSeriesSummary {
        calendar_days,
        observed_nights,
        missing_nights,
        total_asleep_milliseconds: (observed_nights > 0).then_some(total_asleep_milliseconds),
        average_asleep_milliseconds: rounded_sleep_average(
            total_asleep_milliseconds,
            observed_nights,
        )?,
        total_interruption_milliseconds: (observed_nights > 0)
            .then_some(total_interruption_milliseconds),
        average_interruption_milliseconds: rounded_sleep_average(
            total_interruption_milliseconds,
            observed_nights,
        )?,
        average_efficiency_percent: (observed_nights > 0)
            .then_some(efficiency_total / observed_nights as f64),
        phase_night_count,
        phase_totals: (phase_night_count > 0).then_some(phase_totals),
        stage_timeline_night_count,
        score_night_count,
        average_overall_score: (score_night_count > 0)
            .then_some(overall_score_total / score_night_count as f64),
        goal_night_count,
        goal_met_night_count,
        power_status_night_count,
        power_loss_night_count,
    })
}

fn checked_sleep_coverage(current: usize) -> Result<usize, ApplicationError> {
    current
        .checked_add(1)
        .ok_or_else(|| ApplicationError::Query("sleep coverage overflowed".to_owned()))
}

fn rounded_sleep_average(total: i128, count: usize) -> Result<Option<i128>, ApplicationError> {
    if count == 0 {
        return Ok(None);
    }
    let count = i128::try_from(count)
        .map_err(|_| ApplicationError::Query("sleep count is too large".to_owned()))?;
    let quotient = total / count;
    let remainder = total % count;
    Ok(Some(quotient + i128::from(remainder * 2 >= count)))
}

fn sleep_period_insight(period: &SleepLibraryPeriod) -> SleepPeriodInsight {
    SleepPeriodInsight {
        started_at: period.started_at.clone(),
        ended_at: period.ended_at.clone(),
        span_milliseconds: period.span_milliseconds,
        asleep_milliseconds: period.asleep_milliseconds,
        interruption_milliseconds: period.interruption_milliseconds,
        long_interruption_milliseconds: period.long_interruption_milliseconds,
        short_interruption_milliseconds: period.short_interruption_milliseconds,
        interruption_count: period.interruption_count,
        long_interruption_count: period.long_interruption_count,
        short_interruption_count: period.short_interruption_count,
        efficiency_percent: period.efficiency_percent,
        continuity_index: period.continuity_index,
        continuity_class: period.continuity_class,
        sleep_goal_milliseconds: period.sleep_goal_milliseconds,
        self_reported_rating: period.self_reported_rating,
        cycle_count: period.cycle_count,
        recording_ended_by_power_loss: period.recording_ended_by_power_loss,
        phase_summary: period.phase_summary.clone(),
        stage_timeline_available: period.stage_timeline_available,
        score_overall: period.score.as_ref().map(|score| score.overall),
        score_relative_rating: period
            .score
            .as_ref()
            .and_then(|score| score.relative_rating),
    }
}

fn sleep_period_detail(period: SleepPeriod) -> SleepPeriodDetail {
    SleepPeriodDetail {
        sleep_date: period.sleep_date,
        started_at: period.started_at,
        ended_at: period.ended_at,
        span_milliseconds: period.span_milliseconds,
        asleep_milliseconds: period.asleep_milliseconds,
        interruption_milliseconds: period.interruption_milliseconds,
        long_interruption_milliseconds: period.long_interruption_milliseconds,
        short_interruption_milliseconds: period.short_interruption_milliseconds,
        interruption_count: period.interruption_count,
        long_interruption_count: period.long_interruption_count,
        short_interruption_count: period.short_interruption_count,
        efficiency_percent: period.efficiency_percent,
        continuity_index: period.continuity_index,
        continuity_class: period.continuity_class,
        sleep_goal_milliseconds: period.sleep_goal_milliseconds,
        self_reported_rating: period.self_reported_rating,
        cycle_count: period.cycle_count,
        recording_ended_by_power_loss: period.recording_ended_by_power_loss,
        phase_summary: period.phase_summary,
        stage_transitions: period.stage_transitions,
        score: period.score,
    }
}

fn sleep_count_change(baseline: usize, comparison: usize) -> Result<i128, ApplicationError> {
    let baseline = i128::try_from(baseline)
        .map_err(|_| ApplicationError::Query("sleep count is too large".to_owned()))?;
    let comparison = i128::try_from(comparison)
        .map_err(|_| ApplicationError::Query("sleep count is too large".to_owned()))?;
    Ok(comparison - baseline)
}

fn goal_met_percent(summary: &SleepSeriesSummary) -> Option<f64> {
    (summary.goal_night_count > 0)
        .then_some(summary.goal_met_night_count as f64 * 100.0 / summary.goal_night_count as f64)
}

pub fn query_default_recovery_overview(
    port: &dyn RecoveryLibraryPort,
) -> Result<RecoveryOverview, ApplicationError> {
    query_recovery_overview(port, None)
}

pub fn query_recovery_overview(
    port: &dyn RecoveryLibraryPort,
    requested_range: Option<RecoveryDateRange>,
) -> Result<RecoveryOverview, ApplicationError> {
    let Some(available_range) = port.recovery_bounds().map_err(ApplicationError::Query)? else {
        return Ok(RecoveryOverview {
            available_range: None,
            selected_range: None,
            series: Vec::new(),
        });
    };
    let (earliest, latest) = parse_recovery_bounds(&available_range)?;
    let (from, through, selected_range) = match requested_range {
        Some(range) => {
            let (from, through) = validate_recovery_range(&range, earliest, latest)?;
            (from, through, range)
        }
        None => {
            let from = latest
                .checked_sub_days(Days::new(DEFAULT_RECOVERY_WINDOW_DAYS - 1))
                .unwrap_or(earliest)
                .max(earliest);
            let range = RecoveryDateRange {
                from: from.format("%Y-%m-%d").to_string(),
                through: latest.format("%Y-%m-%d").to_string(),
            };
            (from, latest, range)
        }
    };
    let origins = port.recovery_origins().map_err(ApplicationError::Query)?;
    let nights = port
        .query_recovery(&selected_range)
        .map_err(ApplicationError::Query)?;
    let series = build_recovery_series(from, through, origins, nights)?;

    Ok(RecoveryOverview {
        available_range: Some(available_range),
        selected_range: Some(selected_range),
        series,
    })
}

pub fn query_recovery_comparison(
    port: &dyn RecoveryLibraryPort,
    baseline_range: RecoveryDateRange,
    comparison_range: RecoveryDateRange,
) -> Result<RecoveryComparison, ApplicationError> {
    let Some(available_range) = port.recovery_bounds().map_err(ApplicationError::Query)? else {
        return Ok(RecoveryComparison {
            available_range: None,
            baseline_range: None,
            comparison_range: None,
            series: Vec::new(),
        });
    };
    let (earliest, latest) = parse_recovery_bounds(&available_range)?;
    let (baseline_from, baseline_through) =
        validate_recovery_range(&baseline_range, earliest, latest)?;
    let (comparison_from, comparison_through) =
        validate_recovery_range(&comparison_range, earliest, latest)?;
    let origins = port.recovery_origins().map_err(ApplicationError::Query)?;
    let baseline_nights = port
        .query_recovery(&baseline_range)
        .map_err(ApplicationError::Query)?;
    let comparison_nights = port
        .query_recovery(&comparison_range)
        .map_err(ApplicationError::Query)?;
    let baseline_series = build_recovery_series(
        baseline_from,
        baseline_through,
        origins.clone(),
        baseline_nights,
    )?;
    let comparison_series = build_recovery_series(
        comparison_from,
        comparison_through,
        origins,
        comparison_nights,
    )?;
    let series = baseline_series
        .into_iter()
        .zip(comparison_series)
        .map(|(baseline, comparison)| {
            if baseline.series_ref != comparison.series_ref {
                return Err(ApplicationError::Query(
                    "recovery comparison origins are not aligned".to_owned(),
                ));
            }
            Ok(RecoverySeriesComparison {
                series_ref: baseline.series_ref,
                observed_night_change: recovery_count_change(
                    baseline.summary.observed_nights,
                    comparison.summary.observed_nights,
                )?,
                missing_night_change: recovery_count_change(
                    baseline.summary.missing_nights,
                    comparison.summary.missing_nights,
                )?,
                average_beat_to_beat_interval_milliseconds_change: optional_change(
                    baseline.summary.average_beat_to_beat_interval_milliseconds,
                    comparison
                        .summary
                        .average_beat_to_beat_interval_milliseconds,
                ),
                average_heart_rate_variability_rmssd_milliseconds_change: optional_change(
                    baseline
                        .summary
                        .average_heart_rate_variability_rmssd_milliseconds,
                    comparison
                        .summary
                        .average_heart_rate_variability_rmssd_milliseconds,
                ),
                average_breathing_interval_milliseconds_change: optional_change(
                    baseline.summary.average_breathing_interval_milliseconds,
                    comparison.summary.average_breathing_interval_milliseconds,
                ),
                assessment_night_change: recovery_count_change(
                    baseline.summary.assessment_night_count,
                    comparison.summary.assessment_night_count,
                )?,
                baseline_night_change: recovery_count_change(
                    baseline.summary.baseline_night_count,
                    comparison.summary.baseline_night_count,
                )?,
                guidance_night_change: recovery_count_change(
                    baseline.summary.guidance_night_count,
                    comparison.summary.guidance_night_count,
                )?,
                baseline: baseline.summary,
                comparison: comparison.summary,
            })
        })
        .collect::<Result<Vec<_>, _>>()?;

    Ok(RecoveryComparison {
        available_range: Some(available_range),
        baseline_range: Some(baseline_range),
        comparison_range: Some(comparison_range),
        series,
    })
}

pub fn query_recovery_detail(
    port: &dyn RecoveryLibraryPort,
    series_ref: &str,
    recovery_date: &str,
) -> Result<Option<RecoveryNightDetail>, ApplicationError> {
    if series_ref.trim().is_empty() {
        return Err(ApplicationError::InvalidRecoveryReference(
            "series reference is blank",
        ));
    }
    parse_recovery_date(recovery_date).map_err(ApplicationError::InvalidRecoveryReference)?;
    let recovery = port
        .query_recovery_night(series_ref, recovery_date)
        .map_err(ApplicationError::Query)?;
    recovery
        .map(|recovery| {
            validate_recovery_detail_night(&recovery)?;
            if recovery.origin_id != series_ref || recovery.recovery_date != recovery_date {
                return Err(ApplicationError::Query(
                    "recovery detail identity does not match its query".to_owned(),
                ));
            }
            Ok(RecoveryNightDetail {
                recovery_date: recovery.recovery_date,
                beat_to_beat_interval_milliseconds: recovery.beat_to_beat_interval_milliseconds,
                heart_rate_variability_rmssd_milliseconds: recovery
                    .heart_rate_variability_rmssd_milliseconds,
                breathing_interval_milliseconds: recovery.breathing_interval_milliseconds,
                source_assessment: recovery.source_assessment,
                source_baseline: recovery.source_baseline,
                source_guidance: recovery.source_guidance,
            })
        })
        .transpose()
}

fn parse_recovery_bounds(
    available_range: &RecoveryDateRange,
) -> Result<(NaiveDate, NaiveDate), ApplicationError> {
    let earliest = parse_recovery_date(&available_range.from)
        .map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
    let latest = parse_recovery_date(&available_range.through)
        .map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
    if earliest > latest {
        return Err(ApplicationError::Query(
            "recovery bounds are not ordered".to_owned(),
        ));
    }
    Ok((earliest, latest))
}

fn validate_recovery_range(
    range: &RecoveryDateRange,
    earliest: NaiveDate,
    latest: NaiveDate,
) -> Result<(NaiveDate, NaiveDate), ApplicationError> {
    let from = parse_recovery_date(&range.from).map_err(ApplicationError::InvalidRecoveryRange)?;
    let through =
        parse_recovery_date(&range.through).map_err(ApplicationError::InvalidRecoveryRange)?;
    if from > through {
        return Err(ApplicationError::InvalidRecoveryRange(
            "range dates are not ordered",
        ));
    }
    if from < earliest || through > latest {
        return Err(ApplicationError::InvalidRecoveryRange(
            "range is outside available recovery history",
        ));
    }
    if through.signed_duration_since(from).num_days() + 1 > MAX_RECOVERY_RANGE_DAYS {
        return Err(ApplicationError::InvalidRecoveryRange(
            "range exceeds 366 inclusive calendar days",
        ));
    }
    Ok((from, through))
}

fn parse_recovery_date(value: &str) -> Result<NaiveDate, &'static str> {
    let parsed =
        NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|_| "recovery date is invalid")?;
    if parsed.format("%Y-%m-%d").to_string() != value {
        return Err("recovery date is not canonical");
    }
    Ok(parsed)
}

fn build_recovery_series(
    from: NaiveDate,
    through: NaiveDate,
    origins: Vec<String>,
    nights: Vec<RecoveryLibraryNight>,
) -> Result<Vec<RecoverySeriesOverview>, ApplicationError> {
    let mut observations = BTreeMap::<String, BTreeMap<NaiveDate, RecoveryLibraryNight>>::new();
    for origin in origins {
        if origin.trim().is_empty() {
            return Err(ApplicationError::Query(
                "recovery query returned a blank origin".to_owned(),
            ));
        }
        if observations.insert(origin, BTreeMap::new()).is_some() {
            return Err(ApplicationError::Query(
                "recovery query returned a duplicate origin".to_owned(),
            ));
        }
    }
    if observations.is_empty() {
        return Err(ApplicationError::Query(
            "recovery bounds exist without an origin".to_owned(),
        ));
    }

    for night in nights {
        validate_recovery_library_night(&night)?;
        let date = parse_recovery_date(&night.recovery_date)
            .map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
        if date < from || date > through {
            return Err(ApplicationError::Query(
                "recovery query returned a night outside its range".to_owned(),
            ));
        }
        let origin = observations.get_mut(&night.origin_id).ok_or_else(|| {
            ApplicationError::Query("recovery query returned an unknown origin".to_owned())
        })?;
        if origin.insert(date, night).is_some() {
            return Err(ApplicationError::Query(
                "recovery query returned a duplicate logical night".to_owned(),
            ));
        }
    }

    observations
        .into_iter()
        .map(|(series_ref, nights)| {
            build_recovery_series_overview(series_ref, from, through, nights)
        })
        .collect()
}

fn validate_recovery_library_night(night: &RecoveryLibraryNight) -> Result<(), ApplicationError> {
    if night.origin_id.trim().is_empty() {
        return Err(ApplicationError::Query(
            "recovery query returned a blank identity".to_owned(),
        ));
    }
    parse_recovery_date(&night.recovery_date)
        .map_err(|reason| ApplicationError::Query(reason.to_owned()))?;
    if night.beat_to_beat_interval_milliseconds <= 0
        || night.breathing_interval_milliseconds <= 0
        || night
            .heart_rate_variability_rmssd_milliseconds
            .is_some_and(|value| value < 0)
    {
        return Err(ApplicationError::Query(
            "recovery query returned an invalid measurement".to_owned(),
        ));
    }
    if let Some(assessment) = &night.source_assessment {
        validate_recovery_assessment(assessment)?;
    }
    Ok(())
}

fn validate_recovery_detail_night(recovery: &NightlyRecovery) -> Result<(), ApplicationError> {
    validate_recovery_library_night(&RecoveryLibraryNight {
        origin_id: recovery.origin_id.clone(),
        recovery_date: recovery.recovery_date.clone(),
        beat_to_beat_interval_milliseconds: recovery.beat_to_beat_interval_milliseconds,
        heart_rate_variability_rmssd_milliseconds: recovery
            .heart_rate_variability_rmssd_milliseconds,
        breathing_interval_milliseconds: recovery.breathing_interval_milliseconds,
        source_assessment: recovery.source_assessment.clone(),
        source_baseline_available: recovery.source_baseline.is_some(),
        source_guidance_available: recovery.source_guidance.is_some(),
    })?;
    if let Some(baseline) = &recovery.source_baseline {
        if baseline.scheme.trim().is_empty()
            || baseline.mean_beat_to_beat_interval_milliseconds <= 0
            || baseline.standard_deviation_beat_to_beat_interval_milliseconds < 0
            || baseline.mean_breathing_interval_milliseconds <= 0
            || baseline.standard_deviation_breathing_interval_milliseconds < 0
            || baseline
                .mean_heart_rate_variability_rmssd_milliseconds
                .is_some_and(|value| value < 0)
            || baseline
                .standard_deviation_heart_rate_variability_rmssd_milliseconds
                .is_some_and(|value| value < 0)
            || baseline
                .mean_heart_rate_variability_rmssd_milliseconds
                .is_some()
                != baseline
                    .standard_deviation_heart_rate_variability_rmssd_milliseconds
                    .is_some()
        {
            return Err(ApplicationError::Query(
                "recovery query returned an invalid source baseline".to_owned(),
            ));
        }
    }
    if let Some(guidance) = &recovery.source_guidance {
        if guidance.scheme.trim().is_empty()
            || [&guidance.exercise, &guidance.sleep, &guidance.vitality]
                .into_iter()
                .any(|value| value.trim().is_empty() || value.chars().count() > 4_096)
        {
            return Err(ApplicationError::Query(
                "recovery query returned invalid source guidance".to_owned(),
            ));
        }
    }
    Ok(())
}

fn validate_recovery_assessment(
    assessment: &SourceSpecificRecoveryAssessment,
) -> Result<(), ApplicationError> {
    if assessment.scheme.trim().is_empty()
        || !assessment.autonomic_charge.is_finite()
        || !(-10.0..=10.0).contains(&assessment.autonomic_charge)
        || !(1..=5).contains(&assessment.autonomic_status)
        || !(1..=6).contains(&assessment.overall_status)
    {
        return Err(ApplicationError::Query(
            "recovery query returned an invalid source assessment".to_owned(),
        ));
    }
    Ok(())
}

fn build_recovery_series_overview(
    series_ref: String,
    from: NaiveDate,
    through: NaiveDate,
    nights: BTreeMap<NaiveDate, RecoveryLibraryNight>,
) -> Result<RecoverySeriesOverview, ApplicationError> {
    let calendar_days = usize::try_from(through.signed_duration_since(from).num_days() + 1)
        .map_err(|_| ApplicationError::Query("recovery range is too large".to_owned()))?;
    let summary = summarize_recovery_nights(calendar_days, nights.values())?;
    let mut days = Vec::with_capacity(calendar_days);
    let mut date = from;
    loop {
        let recovery = nights.get(&date).map(recovery_night_insight);
        days.push(RecoveryDayInsight {
            recovery_date: date.format("%Y-%m-%d").to_string(),
            availability: if recovery.is_some() {
                RecoveryDayAvailability::Available
            } else {
                RecoveryDayAvailability::Missing
            },
            recovery,
        });
        if date == through {
            break;
        }
        date = date.succ_opt().ok_or_else(|| {
            ApplicationError::Query("recovery range exceeds supported dates".to_owned())
        })?;
    }

    Ok(RecoverySeriesOverview {
        series_ref,
        summary,
        days,
    })
}

fn summarize_recovery_nights<'a>(
    calendar_days: usize,
    nights: impl Iterator<Item = &'a RecoveryLibraryNight>,
) -> Result<RecoverySeriesSummary, ApplicationError> {
    let mut observed_nights = 0_usize;
    let mut beat_to_beat_total = 0_i128;
    let mut rmssd_night_count = 0_usize;
    let mut rmssd_total = 0_i128;
    let mut breathing_total = 0_i128;
    let mut assessment_night_count = 0_usize;
    let mut baseline_night_count = 0_usize;
    let mut guidance_night_count = 0_usize;
    for night in nights {
        observed_nights = checked_recovery_coverage(observed_nights)?;
        beat_to_beat_total = beat_to_beat_total
            .checked_add(i128::from(night.beat_to_beat_interval_milliseconds))
            .ok_or_else(|| {
                ApplicationError::Query("recovery beat-to-beat total overflowed".to_owned())
            })?;
        breathing_total = breathing_total
            .checked_add(i128::from(night.breathing_interval_milliseconds))
            .ok_or_else(|| {
                ApplicationError::Query("recovery breathing total overflowed".to_owned())
            })?;
        if let Some(rmssd) = night.heart_rate_variability_rmssd_milliseconds {
            rmssd_night_count = checked_recovery_coverage(rmssd_night_count)?;
            rmssd_total = rmssd_total.checked_add(i128::from(rmssd)).ok_or_else(|| {
                ApplicationError::Query("recovery RMSSD total overflowed".to_owned())
            })?;
        }
        if night.source_assessment.is_some() {
            assessment_night_count = checked_recovery_coverage(assessment_night_count)?;
        }
        if night.source_baseline_available {
            baseline_night_count = checked_recovery_coverage(baseline_night_count)?;
        }
        if night.source_guidance_available {
            guidance_night_count = checked_recovery_coverage(guidance_night_count)?;
        }
    }
    let missing_nights = calendar_days.checked_sub(observed_nights).ok_or_else(|| {
        ApplicationError::Query("recovery observations exceed the selected range".to_owned())
    })?;
    Ok(RecoverySeriesSummary {
        calendar_days,
        observed_nights,
        missing_nights,
        average_beat_to_beat_interval_milliseconds: rounded_recovery_average(
            beat_to_beat_total,
            observed_nights,
        )?,
        rmssd_night_count,
        average_heart_rate_variability_rmssd_milliseconds: rounded_recovery_average(
            rmssd_total,
            rmssd_night_count,
        )?,
        average_breathing_interval_milliseconds: rounded_recovery_average(
            breathing_total,
            observed_nights,
        )?,
        assessment_night_count,
        baseline_night_count,
        guidance_night_count,
    })
}

fn recovery_night_insight(night: &RecoveryLibraryNight) -> RecoveryNightInsight {
    RecoveryNightInsight {
        beat_to_beat_interval_milliseconds: night.beat_to_beat_interval_milliseconds,
        heart_rate_variability_rmssd_milliseconds: night.heart_rate_variability_rmssd_milliseconds,
        breathing_interval_milliseconds: night.breathing_interval_milliseconds,
        source_assessment: night.source_assessment.clone(),
        source_baseline_available: night.source_baseline_available,
        source_guidance_available: night.source_guidance_available,
    }
}

fn checked_recovery_coverage(current: usize) -> Result<usize, ApplicationError> {
    current
        .checked_add(1)
        .ok_or_else(|| ApplicationError::Query("recovery coverage overflowed".to_owned()))
}

fn rounded_recovery_average(total: i128, count: usize) -> Result<Option<i128>, ApplicationError> {
    if count == 0 {
        return Ok(None);
    }
    let count = i128::try_from(count)
        .map_err(|_| ApplicationError::Query("recovery count is too large".to_owned()))?;
    let quotient = total / count;
    let remainder = total % count;
    Ok(Some(quotient + i128::from(remainder * 2 >= count)))
}

fn recovery_count_change(baseline: usize, comparison: usize) -> Result<i128, ApplicationError> {
    let baseline = i128::try_from(baseline)
        .map_err(|_| ApplicationError::Query("recovery count is too large".to_owned()))?;
    let comparison = i128::try_from(comparison)
        .map_err(|_| ApplicationError::Query("recovery count is too large".to_owned()))?;
    Ok(comparison - baseline)
}

pub fn query_latest_import_outcome(
    port: &dyn ImportOutcomeLibraryPort,
) -> Result<Option<ImportOutcome>, ApplicationError> {
    port.latest_import_outcome()
        .map_err(ApplicationError::OutcomeQuery)
}

pub fn load_application_preferences(
    port: &dyn ApplicationPreferencesPort,
    default_locale: LocalePreference,
) -> Result<ApplicationPreferencesLoad, ApplicationError> {
    let stored = port
        .load_preferences()
        .map_err(ApplicationError::PreferenceQuery)?;
    match stored {
        Some(stored) => match ApplicationPreferences::try_from(stored) {
            Ok(preferences) => Ok(ApplicationPreferencesLoad {
                preferences,
                status: PreferencesLoadStatus::Current,
            }),
            Err(_) => initialize_application_preferences(
                port,
                default_locale,
                PreferencesLoadStatus::Recovered,
            ),
        },
        None => initialize_application_preferences(
            port,
            default_locale,
            PreferencesLoadStatus::Initialized,
        ),
    }
}

fn initialize_application_preferences(
    port: &dyn ApplicationPreferencesPort,
    default_locale: LocalePreference,
    status: PreferencesLoadStatus,
) -> Result<ApplicationPreferencesLoad, ApplicationError> {
    let preferences = ApplicationPreferences::defaults(default_locale);
    port.save_preferences(&preferences)
        .map_err(ApplicationError::PreferenceUpdate)?;
    Ok(ApplicationPreferencesLoad {
        preferences,
        status,
    })
}

pub fn save_application_preferences(
    port: &dyn ApplicationPreferencesPort,
    preferences: &ApplicationPreferences,
) -> Result<(), ApplicationError> {
    port.save_preferences(preferences)
        .map_err(ApplicationError::PreferenceUpdate)
}

pub fn reset_application_preferences(
    port: &dyn ApplicationPreferencesPort,
    default_locale: LocalePreference,
) -> Result<ApplicationPreferencesLoad, ApplicationError> {
    let preferences = ApplicationPreferences::defaults(default_locale);
    save_application_preferences(port, &preferences)?;
    Ok(ApplicationPreferencesLoad {
        preferences,
        status: PreferencesLoadStatus::Current,
    })
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

    struct ControlledApplicationPreferencesPort {
        stored: Mutex<Option<StoredApplicationPreferences>>,
        saved: Mutex<Vec<ApplicationPreferences>>,
    }

    impl ControlledApplicationPreferencesPort {
        fn with(stored: Option<StoredApplicationPreferences>) -> Self {
            Self {
                stored: Mutex::new(stored),
                saved: Mutex::new(Vec::new()),
            }
        }
    }

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

    impl ApplicationPreferencesPort for ControlledApplicationPreferencesPort {
        fn load_preferences(&self) -> Result<Option<StoredApplicationPreferences>, String> {
            Ok(self.stored.lock().expect("stored preference lock").clone())
        }

        fn save_preferences(&self, preferences: &ApplicationPreferences) -> Result<(), String> {
            self.saved
                .lock()
                .expect("saved preference lock")
                .push(preferences.clone());
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
    fn serializes_imports_with_an_exclusive_desktop_operation() {
        let coordinator = ImportCoordinator::default();
        let cancellation = coordinator.begin().expect("active import");

        assert!(matches!(
            coordinator.reserve_exclusive_operation(),
            Err(ApplicationError::ExclusiveOperationAlreadyActive)
        ));
        coordinator
            .finish(&cancellation)
            .expect("finished active import");

        let exclusive = coordinator
            .reserve_exclusive_operation()
            .expect("exclusive operation");
        assert!(matches!(
            coordinator.begin(),
            Err(ApplicationError::ImportAlreadyActive)
        ));
        assert!(!coordinator.cancel().expect("no cancellable import"));

        drop(exclusive);
        let cancellation = coordinator
            .begin()
            .expect("import after exclusive operation");
        coordinator
            .finish(&cancellation)
            .expect("finished subsequent import");
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
    fn validates_supported_locale_codes() {
        assert_eq!(
            LocalePreference::from_code("es-ES"),
            Some(LocalePreference::EsEs)
        );
        assert_eq!(LocalePreference::from_code("es"), None);
    }

    #[test]
    fn validates_the_versioned_application_preference_set() {
        let preferences =
            ApplicationPreferences::new(LocalePreference::EsEs, AppearancePreference::Dark, 150)
                .expect("valid preferences");

        assert_eq!(preferences.version, APPLICATION_PREFERENCES_VERSION);
        assert_eq!(preferences.locale, LocalePreference::EsEs);
        assert_eq!(preferences.appearance, AppearancePreference::Dark);
        assert_eq!(preferences.content_zoom_percent, 150);
        assert!(matches!(
            ApplicationPreferences::new(LocalePreference::EnUs, AppearancePreference::System, 99,),
            Err(InvalidApplicationPreferences::ContentZoom)
        ));
        assert!(matches!(
            ApplicationPreferences::new(LocalePreference::EnUs, AppearancePreference::Light, 201,),
            Err(InvalidApplicationPreferences::ContentZoom)
        ));
    }

    #[test]
    fn initializes_and_recovers_the_application_preference_set_through_one_port() {
        let empty_port = ControlledApplicationPreferencesPort::with(None);
        let initialized = load_application_preferences(&empty_port, LocalePreference::EsEs)
            .expect("initialized preferences");
        assert_eq!(initialized.status, PreferencesLoadStatus::Initialized);
        assert_eq!(
            initialized.preferences,
            ApplicationPreferences::defaults(LocalePreference::EsEs)
        );
        assert_eq!(
            *empty_port.saved.lock().expect("initialized save"),
            vec![ApplicationPreferences::defaults(LocalePreference::EsEs)]
        );

        let invalid_port =
            ControlledApplicationPreferencesPort::with(Some(StoredApplicationPreferences {
                version: 99,
                locale: "es-ES".to_owned(),
                appearance: "dark".to_owned(),
                content_zoom_percent: 150,
            }));
        let recovered = load_application_preferences(&invalid_port, LocalePreference::EnUs)
            .expect("recovered preferences");
        assert_eq!(recovered.status, PreferencesLoadStatus::Recovered);
        assert_eq!(
            recovered.preferences,
            ApplicationPreferences::defaults(LocalePreference::EnUs)
        );
        assert_eq!(
            *invalid_port.saved.lock().expect("recovery save"),
            vec![ApplicationPreferences::defaults(LocalePreference::EnUs)]
        );
    }

    #[test]
    fn resets_the_complete_application_preference_set_atomically() {
        let port = ControlledApplicationPreferencesPort::with(Some(StoredApplicationPreferences {
            version: i64::from(APPLICATION_PREFERENCES_VERSION),
            locale: "es-ES".to_owned(),
            appearance: "dark".to_owned(),
            content_zoom_percent: 175,
        }));

        let reset = reset_application_preferences(&port, LocalePreference::EnUs)
            .expect("reset preferences");

        assert_eq!(reset.status, PreferencesLoadStatus::Current);
        assert_eq!(
            reset.preferences,
            ApplicationPreferences::defaults(LocalePreference::EnUs)
        );
        assert_eq!(
            *port.saved.lock().expect("reset save"),
            vec![ApplicationPreferences::defaults(LocalePreference::EnUs)]
        );
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

    fn sleep_period(origin_id: &str, sleep_date: &str) -> SleepPeriod {
        SleepPeriod {
            origin_id: origin_id.to_owned(),
            sleep_date: sleep_date.to_owned(),
            started_at: format!("{sleep_date}T00:00:00+01:00"),
            ended_at: format!("{sleep_date}T07:00:00+01:00"),
            span_milliseconds: 25_200_000,
            asleep_milliseconds: 23_400_000,
            interruption_milliseconds: 1_800_000,
            long_interruption_milliseconds: 1_200_000,
            short_interruption_milliseconds: 600_000,
            interruption_count: 3,
            long_interruption_count: 1,
            short_interruption_count: 2,
            efficiency_percent: 92.857,
            continuity_index: 4.2,
            continuity_class: 4,
            sleep_goal_milliseconds: Some(28_800_000),
            self_reported_rating: Some(4),
            cycle_count: Some(4),
            recording_ended_by_power_loss: Some(false),
            phase_summary: Some(SleepPhaseSummary {
                wake_milliseconds: 1_800_000,
                rem_milliseconds: 5_400_000,
                light_milliseconds: 12_600_000,
                deep_milliseconds: 5_400_000,
                unrecognized_milliseconds: 0,
            }),
            stage_transitions: Some(vec![
                SleepStageTransition {
                    offset_milliseconds: 0,
                    stage: SleepStage::Light,
                },
                SleepStageTransition {
                    offset_milliseconds: 5_400_000,
                    stage: SleepStage::Deep,
                },
            ]),
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
        }
    }

    struct ControlledSleepPort {
        bounds: Option<SleepDateRange>,
        expected_range: SleepDateRange,
        origins: Vec<String>,
        periods: Vec<SleepPeriod>,
        detail: Option<SleepPeriod>,
    }

    impl SleepLibraryPort for ControlledSleepPort {
        fn sleep_bounds(&self) -> Result<Option<SleepDateRange>, String> {
            Ok(self.bounds.clone())
        }

        fn sleep_origins(&self) -> Result<Vec<String>, String> {
            Ok(self.origins.clone())
        }

        fn query_sleep(&self, range: &SleepDateRange) -> Result<Vec<SleepLibraryPeriod>, String> {
            assert_eq!(range, &self.expected_range);
            Ok(self.periods.iter().map(Into::into).collect())
        }

        fn query_sleep_period(
            &self,
            series_ref: &str,
            sleep_date: &str,
        ) -> Result<Option<SleepPeriod>, String> {
            assert_eq!(series_ref, "origin-a");
            assert_eq!(sleep_date, "2026-01-18");
            Ok(self.detail.clone())
        }
    }

    #[test]
    fn builds_a_gap_aware_default_sleep_overview_with_metric_coverage() {
        let mut without_optional_groups = sleep_period("origin-a", "2026-01-20");
        without_optional_groups.sleep_goal_milliseconds = None;
        without_optional_groups.recording_ended_by_power_loss = None;
        without_optional_groups.phase_summary = None;
        without_optional_groups.stage_transitions = None;
        without_optional_groups.score = None;
        let overview = query_default_sleep_overview(&ControlledSleepPort {
            bounds: Some(SleepDateRange {
                from: "2026-01-01".to_owned(),
                through: "2026-02-15".to_owned(),
            }),
            expected_range: SleepDateRange {
                from: "2026-01-17".to_owned(),
                through: "2026-02-15".to_owned(),
            },
            origins: vec!["origin-b".to_owned(), "origin-a".to_owned()],
            periods: vec![
                sleep_period("origin-a", "2026-01-18"),
                without_optional_groups,
                sleep_period("origin-b", "2026-01-19"),
            ],
            detail: None,
        })
        .expect("sleep overview");

        assert_eq!(
            overview.selected_range,
            Some(SleepDateRange {
                from: "2026-01-17".to_owned(),
                through: "2026-02-15".to_owned(),
            })
        );
        assert_eq!(overview.series.len(), 2);
        let origin_a = &overview.series[0];
        assert_eq!(origin_a.series_ref, "origin-a");
        assert_eq!(origin_a.summary.calendar_days, 30);
        assert_eq!(origin_a.summary.observed_nights, 2);
        assert_eq!(origin_a.summary.missing_nights, 28);
        assert_eq!(origin_a.summary.total_asleep_milliseconds, Some(46_800_000));
        assert_eq!(
            origin_a.summary.average_asleep_milliseconds,
            Some(23_400_000)
        );
        assert_eq!(origin_a.summary.phase_night_count, 1);
        assert_eq!(origin_a.summary.stage_timeline_night_count, 1);
        assert_eq!(origin_a.summary.score_night_count, 1);
        assert_eq!(origin_a.summary.average_overall_score, Some(82.0));
        assert_eq!(origin_a.summary.goal_night_count, 1);
        assert_eq!(origin_a.summary.goal_met_night_count, 0);
        assert_eq!(origin_a.summary.power_status_night_count, 1);
        assert_eq!(origin_a.summary.power_loss_night_count, 0);
        assert_eq!(origin_a.days.len(), 30);
        assert_eq!(origin_a.days[0].sleep_date, "2026-01-17");
        assert_eq!(origin_a.days[0].availability, SleepDayAvailability::Missing);
        assert!(origin_a.days[0].period.is_none());
        assert_eq!(
            origin_a.days[1].availability,
            SleepDayAvailability::Available
        );
        assert_eq!(
            origin_a.days[1]
                .period
                .as_ref()
                .and_then(|period| period.score_overall),
            Some(82.0)
        );

        let origin_b = &overview.series[1];
        assert_eq!(origin_b.summary.observed_nights, 1);
        assert_eq!(origin_b.summary.missing_nights, 29);
    }

    #[test]
    fn compares_sleep_averages_per_origin_without_imputing_missing_coverage() {
        struct ComparisonSleepPort;

        impl SleepLibraryPort for ComparisonSleepPort {
            fn sleep_bounds(&self) -> Result<Option<SleepDateRange>, String> {
                Ok(Some(SleepDateRange {
                    from: "2026-01-01".to_owned(),
                    through: "2026-01-06".to_owned(),
                }))
            }

            fn sleep_origins(&self) -> Result<Vec<String>, String> {
                Ok(vec!["origin-b".to_owned(), "origin-a".to_owned()])
            }

            fn query_sleep(
                &self,
                range: &SleepDateRange,
            ) -> Result<Vec<SleepLibraryPeriod>, String> {
                let periods = match (range.from.as_str(), range.through.as_str()) {
                    ("2026-01-01", "2026-01-02") => {
                        vec![sleep_period("origin-a", "2026-01-01")]
                    }
                    ("2026-01-04", "2026-01-06") => {
                        let mut first = sleep_period("origin-a", "2026-01-04");
                        first.asleep_milliseconds = 24_000_000;
                        first.interruption_milliseconds = 1_200_000;
                        first.long_interruption_milliseconds = 600_000;
                        first.efficiency_percent = 95.0;
                        first.phase_summary = None;
                        first.score = None;
                        first.sleep_goal_milliseconds = None;
                        let mut second = first.clone();
                        second.sleep_date = "2026-01-05".to_owned();
                        second.started_at = "2026-01-05T00:00:00+01:00".to_owned();
                        second.ended_at = "2026-01-05T07:00:00+01:00".to_owned();
                        vec![first, second]
                    }
                    _ => panic!("unexpected sleep comparison range"),
                };
                Ok(periods.iter().map(Into::into).collect())
            }

            fn query_sleep_period(
                &self,
                _series_ref: &str,
                _sleep_date: &str,
            ) -> Result<Option<SleepPeriod>, String> {
                panic!("comparison does not query detail")
            }
        }

        let comparison = query_sleep_comparison(
            &ComparisonSleepPort,
            SleepDateRange {
                from: "2026-01-01".to_owned(),
                through: "2026-01-02".to_owned(),
            },
            SleepDateRange {
                from: "2026-01-04".to_owned(),
                through: "2026-01-06".to_owned(),
            },
        )
        .expect("sleep comparison");

        let origin_a = &comparison.series[0];
        assert_eq!(origin_a.observed_night_change, 1);
        assert_eq!(origin_a.missing_night_change, 0);
        assert_eq!(origin_a.average_asleep_milliseconds_change, Some(600_000));
        assert_eq!(
            origin_a.average_interruption_milliseconds_change,
            Some(-600_000)
        );
        assert!(
            (origin_a.average_efficiency_percentage_point_change.unwrap() - 2.143).abs() < 0.001
        );
        assert_eq!(origin_a.average_overall_score_change, None);
        assert_eq!(origin_a.goal_met_percentage_point_change, None);
        assert_eq!(origin_a.baseline.score_night_count, 1);
        assert_eq!(origin_a.comparison.score_night_count, 0);

        let origin_b = &comparison.series[1];
        assert_eq!(origin_b.observed_night_change, 0);
        assert_eq!(origin_b.missing_night_change, 1);
        assert_eq!(origin_b.average_asleep_milliseconds_change, None);
    }

    #[test]
    fn returns_complete_sleep_detail_only_for_an_exact_identity() {
        let period = sleep_period("origin-a", "2026-01-18");
        let detail = query_sleep_detail(
            &ControlledSleepPort {
                bounds: None,
                expected_range: SleepDateRange {
                    from: "unused".to_owned(),
                    through: "unused".to_owned(),
                },
                origins: Vec::new(),
                periods: Vec::new(),
                detail: Some(period),
            },
            "origin-a",
            "2026-01-18",
        )
        .expect("sleep detail")
        .expect("present detail");

        assert_eq!(detail.sleep_date, "2026-01-18");
        assert_eq!(detail.stage_transitions.as_ref().map(Vec::len), Some(2));
        assert_eq!(detail.score.as_ref().map(|score| score.overall), Some(82.0));

        assert!(matches!(
            query_sleep_detail(
                &ControlledSleepPort {
                    bounds: None,
                    expected_range: SleepDateRange {
                        from: "unused".to_owned(),
                        through: "unused".to_owned(),
                    },
                    origins: Vec::new(),
                    periods: Vec::new(),
                    detail: None,
                },
                "",
                "2026-01-18",
            ),
            Err(ApplicationError::InvalidSleepReference(_))
        ));

        let mut invalid_timeline = sleep_period("origin-a", "2026-01-18");
        invalid_timeline
            .stage_transitions
            .as_mut()
            .expect("stage timeline")[0]
            .offset_milliseconds = 1;
        assert!(matches!(
            query_sleep_detail(
                &ControlledSleepPort {
                    bounds: None,
                    expected_range: SleepDateRange {
                        from: "unused".to_owned(),
                        through: "unused".to_owned(),
                    },
                    origins: Vec::new(),
                    periods: Vec::new(),
                    detail: Some(invalid_timeline),
                },
                "origin-a",
                "2026-01-18",
            ),
            Err(ApplicationError::Query(_))
        ));
    }

    #[test]
    fn rejects_invalid_sleep_facts_and_inconsistent_origin_catalogs() {
        let valid = sleep_period("origin", "2026-01-02");
        let mut invalid_cases = Vec::new();

        let mut missing_offset = valid.clone();
        missing_offset.started_at = "2026-01-02T00:00:00Z".to_owned();
        invalid_cases.push(missing_offset);

        let mut invalid_arithmetic = valid.clone();
        invalid_arithmetic.asleep_milliseconds += 1;
        invalid_cases.push(invalid_arithmetic);

        let mut invalid_phase = valid.clone();
        invalid_phase
            .phase_summary
            .as_mut()
            .expect("phase summary")
            .deep_milliseconds += 1;
        invalid_cases.push(invalid_phase);

        let mut invalid_score = valid.clone();
        invalid_score.score.as_mut().expect("score").overall = 101.0;
        invalid_cases.push(invalid_score);

        for period in invalid_cases {
            assert!(matches!(
                query_sleep_overview(
                    &ControlledSleepPort {
                        bounds: Some(SleepDateRange {
                            from: "2026-01-01".to_owned(),
                            through: "2026-01-03".to_owned(),
                        }),
                        expected_range: SleepDateRange {
                            from: "2026-01-01".to_owned(),
                            through: "2026-01-03".to_owned(),
                        },
                        origins: vec!["origin".to_owned()],
                        periods: vec![period],
                        detail: None,
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
                query_sleep_overview(
                    &ControlledSleepPort {
                        bounds: Some(SleepDateRange {
                            from: "2026-01-01".to_owned(),
                            through: "2026-01-03".to_owned(),
                        }),
                        expected_range: SleepDateRange {
                            from: "2026-01-01".to_owned(),
                            through: "2026-01-03".to_owned(),
                        },
                        origins,
                        periods: Vec::new(),
                        detail: None,
                    },
                    None,
                ),
                Err(ApplicationError::Query(_))
            ));
        }
    }

    #[test]
    fn rejects_invalid_sleep_ranges_before_querying_origins_or_facts() {
        struct RangeValidationSleepPort;

        impl SleepLibraryPort for RangeValidationSleepPort {
            fn sleep_bounds(&self) -> Result<Option<SleepDateRange>, String> {
                Ok(Some(SleepDateRange {
                    from: "2024-01-01".to_owned(),
                    through: "2026-12-31".to_owned(),
                }))
            }

            fn sleep_origins(&self) -> Result<Vec<String>, String> {
                panic!("invalid sleep ranges must stop before origin retrieval")
            }

            fn query_sleep(
                &self,
                _range: &SleepDateRange,
            ) -> Result<Vec<SleepLibraryPeriod>, String> {
                panic!("invalid sleep ranges must stop before fact retrieval")
            }

            fn query_sleep_period(
                &self,
                _series_ref: &str,
                _sleep_date: &str,
            ) -> Result<Option<SleepPeriod>, String> {
                panic!("range validation does not query detail")
            }
        }

        for range in [
            SleepDateRange {
                from: "2026-02-30".to_owned(),
                through: "2026-03-01".to_owned(),
            },
            SleepDateRange {
                from: "2026-03-02".to_owned(),
                through: "2026-03-01".to_owned(),
            },
            SleepDateRange {
                from: "2023-12-31".to_owned(),
                through: "2024-01-01".to_owned(),
            },
            SleepDateRange {
                from: "2025-01-01".to_owned(),
                through: "2026-01-02".to_owned(),
            },
        ] {
            assert!(matches!(
                query_sleep_overview(&RangeValidationSleepPort, Some(range.clone())),
                Err(ApplicationError::InvalidSleepRange(_))
            ));
            assert!(matches!(
                query_sleep_comparison(
                    &RangeValidationSleepPort,
                    range,
                    SleepDateRange {
                        from: "2026-01-01".to_owned(),
                        through: "2026-01-02".to_owned(),
                    },
                ),
                Err(ApplicationError::InvalidSleepRange(_))
            ));
        }
    }

    #[test]
    fn returns_empty_sleep_read_models_without_querying_facts() {
        struct EmptySleepPort;

        impl SleepLibraryPort for EmptySleepPort {
            fn sleep_bounds(&self) -> Result<Option<SleepDateRange>, String> {
                Ok(None)
            }

            fn sleep_origins(&self) -> Result<Vec<String>, String> {
                panic!("an empty sleep library has no origins")
            }

            fn query_sleep(
                &self,
                _range: &SleepDateRange,
            ) -> Result<Vec<SleepLibraryPeriod>, String> {
                panic!("an empty sleep library has no range")
            }

            fn query_sleep_period(
                &self,
                _series_ref: &str,
                _sleep_date: &str,
            ) -> Result<Option<SleepPeriod>, String> {
                Ok(None)
            }
        }

        assert_eq!(
            query_default_sleep_overview(&EmptySleepPort).expect("empty sleep overview"),
            SleepOverview {
                available_range: None,
                selected_range: None,
                series: Vec::new(),
            }
        );
        assert_eq!(
            query_sleep_comparison(
                &EmptySleepPort,
                SleepDateRange {
                    from: "2026-01-01".to_owned(),
                    through: "2026-01-02".to_owned(),
                },
                SleepDateRange {
                    from: "2026-01-03".to_owned(),
                    through: "2026-01-04".to_owned(),
                },
            )
            .expect("empty sleep comparison"),
            SleepComparison {
                available_range: None,
                baseline_range: None,
                comparison_range: None,
                series: Vec::new(),
            }
        );
        assert_eq!(
            query_sleep_detail(&EmptySleepPort, "origin", "2026-01-01")
                .expect("empty sleep detail"),
            None
        );
    }
}
