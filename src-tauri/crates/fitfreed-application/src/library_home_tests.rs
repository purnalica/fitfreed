use fitfreed_domain::{
    ArtifactCoverageSummary, DailyActivity, ImportOperationState, ImportOutcome, ImportReport,
    NightlyRecovery, SleepPeriod, SleepPhaseSummary, SleepScore, TrainingSession,
};
use std::sync::Mutex;

use super::*;

#[derive(Default)]
struct ControlledLibraryHomePort {
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
    outcome: Option<ImportOutcome>,
    workspace: Mutex<Option<StoredExplorationWorkspace>>,
}

impl ActivityLibraryPort for ControlledLibraryHomePort {
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

impl TrainingLibraryPort for ControlledLibraryHomePort {
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

impl SleepLibraryPort for ControlledLibraryHomePort {
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
        panic!("the library home never queries full sleep detail")
    }
}

impl RecoveryLibraryPort for ControlledLibraryHomePort {
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
        panic!("the library home never queries full recovery detail")
    }
}

impl ImportOutcomeLibraryPort for ControlledLibraryHomePort {
    fn latest_import_outcome(&self) -> Result<Option<ImportOutcome>, String> {
        Ok(self.outcome.clone())
    }
}

impl ExplorationWorkspacePort for ControlledLibraryHomePort {
    fn load_exploration_workspace(&self) -> Result<Option<StoredExplorationWorkspace>, String> {
        Ok(self.workspace.lock().expect("workspace lock").clone())
    }

    fn save_exploration_workspace(&self, workspace: &ExplorationWorkspace) -> Result<(), String> {
        *self.workspace.lock().expect("workspace lock") = Some(StoredExplorationWorkspace {
            version: i64::from(workspace.version),
            destination: match workspace.destination {
                ExploreDestination::Activity => "activity",
                ExploreDestination::Training => "training",
                ExploreDestination::Sleep => "sleep",
                ExploreDestination::Recovery => "recovery",
                ExploreDestination::Longitudinal => "longitudinal",
            }
            .to_owned(),
        });
        Ok(())
    }

    fn clear_exploration_workspace(&self) -> Result<(), String> {
        *self.workspace.lock().expect("workspace lock") = None;
        Ok(())
    }
}

fn in_range(value: &str, from: &str, through: &str) -> bool {
    value >= from && value <= through
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

fn training_session(
    session_id: &str,
    date: &str,
    with_optional_measurements: bool,
) -> TrainingSession {
    TrainingSession {
        origin_id: "origin-a".to_owned(),
        session_id: session_id.to_owned(),
        started_at_local: format!("{date}T08:00:00"),
        stopped_at_local: format!("{date}T09:00:00"),
        utc_offset_minutes: Some(60),
        duration_milliseconds: 3_600_000,
        distance_meters: with_optional_measurements.then_some(10_000.0),
        energy_kilocalories: with_optional_measurements.then_some(600),
        average_heart_rate_bpm: with_optional_measurements.then_some(142),
        maximum_heart_rate_bpm: with_optional_measurements.then_some(171),
        sport_ref: Some("opaque-sport".to_owned()),
        exercise_count: Some(1),
    }
}

fn sleep_period(date: &str) -> SleepLibraryPeriod {
    SleepLibraryPeriod {
        origin_id: "origin-a".to_owned(),
        sleep_date: date.to_owned(),
        started_at: format!("{date}T00:00:00+01:00"),
        ended_at: format!("{date}T08:00:00+01:00"),
        span_milliseconds: 28_800_000,
        asleep_milliseconds: 27_000_000,
        interruption_milliseconds: 1_800_000,
        long_interruption_milliseconds: 1_200_000,
        short_interruption_milliseconds: 600_000,
        interruption_count: 3,
        long_interruption_count: 1,
        short_interruption_count: 2,
        efficiency_percent: 93.75,
        continuity_index: 4.2,
        continuity_class: 4,
        sleep_goal_milliseconds: Some(28_800_000),
        self_reported_rating: Some(4),
        cycle_count: Some(4),
        recording_ended_by_power_loss: Some(false),
        phase_summary: Some(SleepPhaseSummary {
            wake_milliseconds: 1_800_000,
            rem_milliseconds: 5_400_000,
            light_milliseconds: 16_200_000,
            deep_milliseconds: 5_400_000,
            unrecognized_milliseconds: 0,
        }),
        stage_timeline_available: true,
        score: Some(SleepScore {
            overall: 82.0,
            own_target_duration: 80.0,
            recommended_duration: 78.0,
            continuity: 84.0,
            efficiency: 86.0,
            rem: 76.0,
            deep: 81.0,
            long_interruptions: 79.0,
            duration: 79.0,
            solidity: 83.0,
            regeneration: 78.5,
            relative_rating: Some(4),
        }),
    }
}

fn recovery(date: &str) -> RecoveryLibraryNight {
    RecoveryLibraryNight {
        origin_id: "origin-b".to_owned(),
        recovery_date: date.to_owned(),
        beat_to_beat_interval_milliseconds: 900,
        heart_rate_variability_rmssd_milliseconds: Some(42),
        breathing_interval_milliseconds: 4_100,
        source_assessment: Some(SourceSpecificRecoveryAssessment {
            scheme: "synthetic-assessment@1".to_owned(),
            autonomic_charge: 1.5,
            autonomic_status: 4,
            overall_status: 5,
            overall_sublevel: 2,
        }),
        source_baseline_available: true,
        source_guidance_available: true,
    }
}

fn completed_outcome(operation_ref: &str) -> ImportOutcome {
    ImportOutcome {
        operation_ref: operation_ref.to_owned(),
        state: ImportOperationState::Completed,
        source_provider: "synthetic-provider".to_owned(),
        source_adapter_version: "1".to_owned(),
        mapping_version: "1".to_owned(),
        exact_repeat: false,
        coverage_complete: true,
        coverage: ArtifactCoverageSummary {
            total: 8,
            supported: 7,
            unsupported: 1,
            deliberately_ignored: 0,
            unrecognized: 0,
            invalid: 0,
        },
        artifact_families: Vec::new(),
        report: ImportReport {
            exact_repeat: false,
            recognized_artifacts: 7,
            new_observations: 4,
            equivalent_observations: 1,
            enriched_observations: 1,
            amended_observations: 1,
            preserved_observations: 0,
            conflicts: 0,
        },
        canonical_history_changed: true,
        terminal_code: None,
        recovery_note: None,
    }
}

fn representative_port() -> ControlledLibraryHomePort {
    ControlledLibraryHomePort {
        activity_bounds: Some(activity_range("2026-01-01", "2026-01-03")),
        activity_origins: vec!["origin-a".to_owned(), "origin-b".to_owned()],
        activities: vec![
            DailyActivity {
                origin_id: "origin-a".to_owned(),
                local_date: "2026-01-01".to_owned(),
                step_count: Some(3_100),
            },
            DailyActivity {
                origin_id: "origin-b".to_owned(),
                local_date: "2026-01-03".to_owned(),
                step_count: None,
            },
        ],
        training_bounds: Some(training_range("2026-01-04", "2026-01-05")),
        training_origins: vec!["origin-a".to_owned()],
        sessions: vec![
            training_session("session-a", "2026-01-04", true),
            training_session("session-b", "2026-01-05", false),
        ],
        sleep_bounds: Some(sleep_range("2026-01-06", "2026-01-06")),
        sleep_origins: vec!["origin-a".to_owned()],
        periods: vec![sleep_period("2026-01-06")],
        recovery_bounds: Some(recovery_range("2026-01-06", "2026-01-06")),
        recovery_origins: vec!["origin-b".to_owned()],
        recoveries: vec![recovery("2026-01-06")],
        outcome: Some(completed_outcome("operation-accepted")),
        workspace: Mutex::new(Some(StoredExplorationWorkspace {
            version: 1,
            destination: "training".to_owned(),
        })),
    }
}

#[test]
fn composes_coverage_and_conservative_questions_from_authoritative_read_models() {
    let home = query_library_home(
        &representative_port(),
        LibraryHomeRequest {
            after_import_operation_ref: Some("operation-accepted".to_owned()),
        },
    )
    .expect("library home");

    assert_eq!(
        home.available_range,
        Some(LibraryHomeDateRange {
            from: "2026-01-01".to_owned(),
            through: "2026-01-06".to_owned(),
        })
    );
    assert_eq!(
        home.domains
            .iter()
            .map(|coverage| coverage.domain)
            .collect::<Vec<_>>(),
        vec![
            LibraryDomain::Training,
            LibraryDomain::Activity,
            LibraryDomain::Sleep,
            LibraryDomain::Recovery,
        ]
    );

    let training = &home.domains[0];
    assert_eq!(training.origin_count, 1);
    assert_eq!(training.observed_record_count, 2);
    assert_eq!(
        training.measurements,
        vec![
            LibraryMeasurementCoverage::new(LibraryMeasurement::TrainingDuration, 2, 2),
            LibraryMeasurementCoverage::new(LibraryMeasurement::TrainingDistance, 1, 2),
            LibraryMeasurementCoverage::new(LibraryMeasurement::TrainingEnergy, 1, 2),
            LibraryMeasurementCoverage::new(LibraryMeasurement::TrainingHeartRate, 1, 2),
        ]
    );

    let activity = &home.domains[1];
    assert_eq!(activity.origin_count, 2);
    assert_eq!(activity.observed_record_count, 2);
    assert_eq!(
        activity.measurements,
        vec![LibraryMeasurementCoverage::new(
            LibraryMeasurement::ActivitySteps,
            1,
            2,
        )]
    );

    assert_eq!(home.domains[2].observed_record_count, 1);
    assert_eq!(home.domains[3].observed_record_count, 1);
    assert_eq!(
        home.questions,
        vec![
            LibraryQuestion::new(
                LibraryQuestionKind::ExploreTrainingSessions,
                ExploreDestination::Training,
            ),
            LibraryQuestion::new(
                LibraryQuestionKind::AlignHistory,
                ExploreDestination::Longitudinal,
            ),
            LibraryQuestion::new(
                LibraryQuestionKind::ReviewActivitySteps,
                ExploreDestination::Activity,
            ),
            LibraryQuestion::new(
                LibraryQuestionKind::ReviewSleepPatterns,
                ExploreDestination::Sleep,
            ),
            LibraryQuestion::new(
                LibraryQuestionKind::ReviewRecoveryPatterns,
                ExploreDestination::Recovery,
            ),
        ]
    );
    assert_eq!(
        home.resumable_exploration,
        Some(ExplorationWorkspace {
            version: 1,
            destination: ExploreDestination::Training,
        })
    );
    assert_eq!(
        home.post_import,
        Some(PostImportReveal {
            exact_repeat: false,
            canonical_history_changed: true,
            new_observations: 4,
            enriched_observations: 1,
            amended_observations: 1,
            source_review_recommended: true,
        })
    );
}

#[test]
fn returns_an_empty_home_without_querying_unavailable_facts_or_an_unrequested_outcome() {
    struct EmptyPort;

    impl ActivityLibraryPort for EmptyPort {
        fn activity_bounds(&self) -> Result<Option<ActivityDateRange>, String> {
            Ok(None)
        }

        fn activity_origins(&self) -> Result<Vec<String>, String> {
            panic!("empty activity must stop at bounds")
        }

        fn query_activity(&self, _range: &ActivityDateRange) -> Result<Vec<DailyActivity>, String> {
            panic!("empty activity must not query facts")
        }
    }

    impl TrainingLibraryPort for EmptyPort {
        fn training_bounds(&self) -> Result<Option<TrainingDateRange>, String> {
            Ok(None)
        }

        fn training_origins(&self) -> Result<Vec<String>, String> {
            panic!("empty training must stop at bounds")
        }

        fn query_training(
            &self,
            _range: &TrainingDateRange,
        ) -> Result<Vec<TrainingSession>, String> {
            panic!("empty training must not query facts")
        }
    }

    impl SleepLibraryPort for EmptyPort {
        fn sleep_bounds(&self) -> Result<Option<SleepDateRange>, String> {
            Ok(None)
        }

        fn sleep_origins(&self) -> Result<Vec<String>, String> {
            panic!("empty sleep must stop at bounds")
        }

        fn query_sleep(&self, _range: &SleepDateRange) -> Result<Vec<SleepLibraryPeriod>, String> {
            panic!("empty sleep must not query facts")
        }

        fn query_sleep_period(
            &self,
            _series_ref: &str,
            _sleep_date: &str,
        ) -> Result<Option<SleepPeriod>, String> {
            panic!("empty sleep must not query detail")
        }
    }

    impl RecoveryLibraryPort for EmptyPort {
        fn recovery_bounds(&self) -> Result<Option<RecoveryDateRange>, String> {
            Ok(None)
        }

        fn recovery_origins(&self) -> Result<Vec<String>, String> {
            panic!("empty recovery must stop at bounds")
        }

        fn query_recovery(
            &self,
            _range: &RecoveryDateRange,
        ) -> Result<Vec<RecoveryLibraryNight>, String> {
            panic!("empty recovery must not query facts")
        }

        fn query_recovery_night(
            &self,
            _series_ref: &str,
            _recovery_date: &str,
        ) -> Result<Option<NightlyRecovery>, String> {
            panic!("empty recovery must not query detail")
        }
    }

    impl ImportOutcomeLibraryPort for EmptyPort {
        fn latest_import_outcome(&self) -> Result<Option<ImportOutcome>, String> {
            panic!("an ordinary home load must not query import diagnostics")
        }
    }

    impl ExplorationWorkspacePort for EmptyPort {
        fn load_exploration_workspace(&self) -> Result<Option<StoredExplorationWorkspace>, String> {
            Ok(None)
        }

        fn save_exploration_workspace(
            &self,
            _workspace: &ExplorationWorkspace,
        ) -> Result<(), String> {
            panic!("an empty home must not save a workspace")
        }

        fn clear_exploration_workspace(&self) -> Result<(), String> {
            panic!("an empty home must not clear a workspace")
        }
    }

    let home = query_library_home(&EmptyPort, LibraryHomeRequest::default()).expect("empty home");

    assert_eq!(home.available_range, None);
    assert_eq!(home.domains.len(), 4);
    assert!(home.domains.iter().all(|domain| {
        domain.available_range.is_none()
            && domain.selected_range.is_none()
            && domain.origin_count == 0
            && domain.observed_record_count == 0
            && domain.measurements.is_empty()
    }));
    assert!(home.questions.is_empty());
    assert_eq!(home.post_import, None);
    assert_eq!(home.resumable_exploration, None);
}

#[test]
fn withholds_questions_that_the_current_canonical_measurements_cannot_answer() {
    let port = ControlledLibraryHomePort {
        activity_bounds: Some(activity_range("2026-01-01", "2026-01-01")),
        activity_origins: vec!["origin-a".to_owned()],
        activities: vec![DailyActivity {
            origin_id: "origin-a".to_owned(),
            local_date: "2026-01-01".to_owned(),
            step_count: None,
        }],
        ..ControlledLibraryHomePort::default()
    };

    let home = query_library_home(&port, LibraryHomeRequest::default()).expect("partial home");

    assert_eq!(home.domains[1].observed_record_count, 1);
    assert_eq!(
        home.domains[1].measurements,
        vec![LibraryMeasurementCoverage::new(
            LibraryMeasurement::ActivitySteps,
            0,
            1,
        )]
    );
    assert!(home.questions.is_empty());
}

#[test]
fn reveals_only_the_matching_completed_import_and_rejects_blank_references() {
    let mut port = representative_port();

    let home = query_library_home(
        &port,
        LibraryHomeRequest {
            after_import_operation_ref: Some("another-operation".to_owned()),
        },
    )
    .expect("home after superseded import");
    assert_eq!(home.post_import, None);

    let outcome = port.outcome.as_mut().expect("controlled outcome");
    outcome.exact_repeat = true;
    outcome.canonical_history_changed = false;
    outcome.coverage.total = 7;
    outcome.coverage.unsupported = 0;
    outcome.report.new_observations = 0;
    outcome.report.enriched_observations = 0;
    outcome.report.amended_observations = 0;
    let home = query_library_home(
        &port,
        LibraryHomeRequest {
            after_import_operation_ref: Some("operation-accepted".to_owned()),
        },
    )
    .expect("home after exact repeat");
    assert_eq!(
        home.post_import,
        Some(PostImportReveal {
            exact_repeat: true,
            canonical_history_changed: false,
            new_observations: 0,
            enriched_observations: 0,
            amended_observations: 0,
            source_review_recommended: false,
        })
    );

    port.outcome.as_mut().expect("controlled outcome").state = ImportOperationState::Failed;
    let home = query_library_home(
        &port,
        LibraryHomeRequest {
            after_import_operation_ref: Some("operation-accepted".to_owned()),
        },
    )
    .expect("home after failed import");
    assert_eq!(home.post_import, None);

    assert!(matches!(
        query_library_home(
            &port,
            LibraryHomeRequest {
                after_import_operation_ref: Some(" ".to_owned()),
            },
        ),
        Err(ApplicationError::InvalidLibraryHomeRequest(_))
    ));
}

#[test]
fn persists_only_answerable_exploration_destinations_and_clears_them_explicitly() {
    let port = representative_port();

    let saved = save_exploration_workspace(&port, ExploreDestination::Recovery)
        .expect("answerable workspace");
    assert_eq!(
        saved,
        ExplorationWorkspace {
            version: 1,
            destination: ExploreDestination::Recovery,
        }
    );
    assert_eq!(
        query_library_home(&port, LibraryHomeRequest::default())
            .expect("home with recovery workspace")
            .resumable_exploration,
        Some(saved)
    );

    clear_exploration_workspace(&port).expect("clear workspace");
    assert_eq!(
        query_library_home(&port, LibraryHomeRequest::default())
            .expect("home without workspace")
            .resumable_exploration,
        None
    );

    let partial = ControlledLibraryHomePort {
        activity_bounds: Some(activity_range("2026-01-01", "2026-01-01")),
        activity_origins: vec!["origin-a".to_owned()],
        activities: vec![DailyActivity {
            origin_id: "origin-a".to_owned(),
            local_date: "2026-01-01".to_owned(),
            step_count: None,
        }],
        ..ControlledLibraryHomePort::default()
    };
    assert!(matches!(
        save_exploration_workspace(&partial, ExploreDestination::Activity),
        Err(ApplicationError::InvalidExplorationWorkspace(_))
    ));
}

#[test]
fn ignores_obsolete_or_stale_workspace_state_without_hiding_home() {
    let mut port = representative_port();
    *port.workspace.lock().expect("workspace lock") = Some(StoredExplorationWorkspace {
        version: 2,
        destination: "training".to_owned(),
    });
    assert_eq!(
        query_library_home(&port, LibraryHomeRequest::default())
            .expect("home with obsolete workspace")
            .resumable_exploration,
        None
    );

    *port.workspace.lock().expect("workspace lock") = Some(StoredExplorationWorkspace {
        version: 1,
        destination: "unknown".to_owned(),
    });
    assert_eq!(
        query_library_home(&port, LibraryHomeRequest::default())
            .expect("home with unknown workspace")
            .resumable_exploration,
        None
    );

    *port.workspace.lock().expect("workspace lock") = Some(StoredExplorationWorkspace {
        version: 1,
        destination: "activity".to_owned(),
    });
    port.activities[0].step_count = None;
    assert_eq!(
        query_library_home(&port, LibraryHomeRequest::default())
            .expect("home with stale workspace")
            .resumable_exploration,
        None
    );
}
