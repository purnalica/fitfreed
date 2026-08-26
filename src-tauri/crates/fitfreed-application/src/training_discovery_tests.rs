use std::collections::BTreeMap;

use super::*;

const SNAPSHOT: &str =
    "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SESSION: &str = "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SPORT: &str = "sport-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

struct ControlledDiscoveryPort {
    result: Result<PersistedTrainingSessionSearchPage, TrainingSessionDiscoveryPortError>,
}

impl TrainingSessionDiscoveryPort for ControlledDiscoveryPort {
    fn query_training_sessions(
        &self,
        _request: &TrainingSessionSearchRequest,
    ) -> Result<PersistedTrainingSessionSearchPage, TrainingSessionDiscoveryPortError> {
        self.result.clone()
    }

    fn query_training_calendar(
        &self,
        _request: &TrainingSessionCalendarRequest,
    ) -> Result<PersistedTrainingSessionCalendar, TrainingSessionDiscoveryPortError> {
        Ok(PersistedTrainingSessionCalendar {
            available_range: Some(TrainingDateRange {
                from: "2020-01-01".to_owned(),
                through: "2026-08-16".to_owned(),
            }),
            snapshot_ref: SNAPSHOT.to_owned(),
            days: vec![TrainingSessionCalendarDay {
                local_date: "2026-08-16".to_owned(),
                source_index: 1,
                session_count: 2,
                total_duration_milliseconds: 5_400_000,
                distance_session_count: 1,
                total_distance_meters: Some(10_000.0),
                heart_rate_session_count: 2,
            }],
        })
    }

    fn query_training_session_selection(
        &self,
        request: &TrainingSessionSelectionRequest,
    ) -> Result<PersistedTrainingSessionSelection, TrainingSessionDiscoveryPortError> {
        Ok(PersistedTrainingSessionSelection {
            snapshot_ref: SNAPSHOT.to_owned(),
            sessions: request
                .session_refs
                .iter()
                .map(|session_ref| {
                    let mut selected = item();
                    selected.session_ref.clone_from(session_ref);
                    selected
                })
                .collect(),
        })
    }
}

fn request() -> TrainingSessionSearchRequest {
    TrainingSessionSearchRequest {
        from: None,
        through: None,
        sport_refs: Vec::new(),
        required_measurements: Vec::new(),
        text: None,
        sort: TrainingSessionSort::StartedDescending,
        offset: 0,
        limit: 25,
        snapshot_ref: None,
    }
}

fn classified_sport() -> TrainingSessionSport {
    TrainingSessionSport {
        sport_ref: Some(
            "sport-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc".to_owned(),
        ),
        state: TrainingSportState::PersonallyOverridden,
        classification: Some(TrainingSportClassification {
            canonical_family: Some("running".to_owned()),
            display_label: Some("Trail running".to_owned()),
            authorship: Some("user".to_owned()),
            revision: 1,
        }),
        recognition: None,
        recognition_candidate_count: 0,
    }
}

fn recognized_sport(localized_name: String) -> TrainingSessionSport {
    TrainingSessionSport {
        sport_ref: Some(
            "sport-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc".to_owned(),
        ),
        state: TrainingSportState::Recognized,
        classification: Some(TrainingSportClassification {
            canonical_family: None,
            display_label: None,
            authorship: None,
            revision: 0,
        }),
        recognition: Some(TrainingSportRecognition {
            canonical_family: Some("running".to_owned()),
            localized_names: BTreeMap::from([("en".to_owned(), localized_name)]),
            catalogue_revision: "catalogue-2026-08-25".to_owned(),
            retrieved_at_utc: "2026-08-25T10:00:00Z".to_owned(),
            mapping_version: "sport-mapping@1".to_owned(),
            evidence_ref:
                "sport-evidence-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                    .to_owned(),
        }),
        recognition_candidate_count: 1,
    }
}

fn item() -> TrainingSessionSearchItem {
    TrainingSessionSearchItem {
        session_ref: SESSION.to_owned(),
        sport_filter_ref: SPORT.to_owned(),
        source_index: 1,
        started_at_local: "2026-08-16T07:30:00.000".to_owned(),
        stopped_at_local: "2026-08-16T08:30:00.000".to_owned(),
        utc_offset_minutes: Some(120),
        duration_milliseconds: 3_600_000,
        distance_meters: Some(10_000.0),
        energy_kilocalories: Some(650),
        average_heart_rate_bpm: Some(145),
        maximum_heart_rate_bpm: Some(175),
        exercise_count: Some(1),
        sport: classified_sport(),
    }
}

fn page(
    sessions: Vec<TrainingSessionSearchItem>,
    total_count: usize,
) -> PersistedTrainingSessionSearchPage {
    PersistedTrainingSessionSearchPage {
        available_range: Some(TrainingDateRange {
            from: "2020-01-01".to_owned(),
            through: "2026-08-16".to_owned(),
        }),
        snapshot_ref: SNAPSHOT.to_owned(),
        total_count,
        summaries: (total_count > 0)
            .then(|| TrainingSessionSearchSummary {
                source_index: 1,
                training_days: total_count,
                session_count: total_count,
                total_duration_milliseconds: 3_600_000_i128 * total_count as i128,
                distance_session_count: total_count,
                total_distance_meters: Some(10_000.0 * total_count as f64),
                energy_session_count: total_count,
                total_energy_kilocalories: Some(650_i128 * total_count as i128),
                heart_rate_session_count: total_count,
            })
            .into_iter()
            .collect(),
        sessions,
    }
}

#[test]
fn returns_an_exact_source_separated_calendar_month() {
    let port = ControlledDiscoveryPort {
        result: Ok(page(Vec::new(), 0)),
    };
    let result = query_training_session_calendar(
        &port,
        TrainingSessionCalendarRequest {
            month: "2026-08".to_owned(),
            from: Some("2026-01-01".to_owned()),
            through: Some("2026-12-31".to_owned()),
            sport_refs: vec![classified_sport().sport_ref.unwrap()],
            required_measurements: vec![TrainingMeasurementFilter::HeartRate],
            text: Some("trail".to_owned()),
            snapshot_ref: Some(SNAPSHOT.to_owned()),
        },
    )
    .unwrap();

    assert_eq!(result.month, "2026-08");
    assert_eq!(result.snapshot_ref, SNAPSHOT);
    assert_eq!(result.days.len(), 1);
    assert_eq!(result.days[0].local_date, "2026-08-16");
    assert_eq!(result.days[0].source_index, 1);
    assert_eq!(result.days[0].session_count, 2);
    assert_eq!(result.days[0].distance_session_count, 1);
    assert_eq!(result.days[0].heart_rate_session_count, 2);
}

#[test]
fn rejects_invalid_calendar_requests_and_persisted_days() {
    let port = ControlledDiscoveryPort {
        result: Ok(page(Vec::new(), 0)),
    };
    let invalid_month = query_training_session_calendar(
        &port,
        TrainingSessionCalendarRequest {
            month: "2026-8".to_owned(),
            from: None,
            through: None,
            sport_refs: Vec::new(),
            required_measurements: Vec::new(),
            text: None,
            snapshot_ref: None,
        },
    );
    assert!(matches!(
        invalid_month,
        Err(ApplicationError::InvalidTrainingSessionSearch(_))
    ));

    struct InvalidCalendarPort;
    impl TrainingSessionDiscoveryPort for InvalidCalendarPort {
        fn query_training_sessions(
            &self,
            _request: &TrainingSessionSearchRequest,
        ) -> Result<PersistedTrainingSessionSearchPage, TrainingSessionDiscoveryPortError> {
            unreachable!("calendar validation must not query session pages")
        }

        fn query_training_calendar(
            &self,
            _request: &TrainingSessionCalendarRequest,
        ) -> Result<PersistedTrainingSessionCalendar, TrainingSessionDiscoveryPortError> {
            Ok(PersistedTrainingSessionCalendar {
                available_range: Some(TrainingDateRange {
                    from: "2020-01-01".to_owned(),
                    through: "2026-08-16".to_owned(),
                }),
                snapshot_ref: SNAPSHOT.to_owned(),
                days: vec![TrainingSessionCalendarDay {
                    local_date: "2026-09-01".to_owned(),
                    source_index: 1,
                    session_count: 1,
                    total_duration_milliseconds: 3_600_000,
                    distance_session_count: 0,
                    total_distance_meters: None,
                    heart_rate_session_count: 1,
                }],
            })
        }

        fn query_training_session_selection(
            &self,
            _request: &TrainingSessionSelectionRequest,
        ) -> Result<PersistedTrainingSessionSelection, TrainingSessionDiscoveryPortError> {
            unreachable!("calendar validation must not query a selection")
        }
    }

    let invalid_day = query_training_session_calendar(
        &InvalidCalendarPort,
        TrainingSessionCalendarRequest {
            month: "2026-08".to_owned(),
            from: None,
            through: None,
            sport_refs: Vec::new(),
            required_measurements: Vec::new(),
            text: None,
            snapshot_ref: None,
        },
    );
    assert!(matches!(
        invalid_day,
        Err(ApplicationError::TrainingSessionSearch(_))
    ));
}

#[test]
fn resolves_an_ordered_comparison_selection_without_exposing_storage_identity() {
    let second_ref = format!("session-{}", "d".repeat(64));
    let result = query_training_session_selection(
        &ControlledDiscoveryPort {
            result: Ok(page(Vec::new(), 0)),
        },
        TrainingSessionSelectionRequest {
            session_refs: vec![SESSION.to_owned(), second_ref.clone()],
            snapshot_ref: Some(SNAPSHOT.to_owned()),
        },
    )
    .unwrap();

    assert_eq!(result.snapshot_ref, SNAPSHOT);
    assert_eq!(result.sessions.len(), 2);
    assert_eq!(result.sessions[0].session_ref, SESSION);
    assert_eq!(result.sessions[1].session_ref, second_ref);
}

#[test]
fn rejects_oversized_duplicate_or_incomplete_comparison_selections() {
    let duplicate = query_training_session_selection(
        &ControlledDiscoveryPort {
            result: Ok(page(Vec::new(), 0)),
        },
        TrainingSessionSelectionRequest {
            session_refs: vec![SESSION.to_owned(), SESSION.to_owned()],
            snapshot_ref: None,
        },
    );
    assert!(matches!(
        duplicate,
        Err(ApplicationError::InvalidTrainingSessionSearch(_))
    ));

    struct MissingSelectionPort;
    impl TrainingSessionDiscoveryPort for MissingSelectionPort {
        fn query_training_sessions(
            &self,
            _request: &TrainingSessionSearchRequest,
        ) -> Result<PersistedTrainingSessionSearchPage, TrainingSessionDiscoveryPortError> {
            unreachable!("selection must not query pages")
        }

        fn query_training_calendar(
            &self,
            _request: &TrainingSessionCalendarRequest,
        ) -> Result<PersistedTrainingSessionCalendar, TrainingSessionDiscoveryPortError> {
            unreachable!("selection must not query a calendar")
        }

        fn query_training_session_selection(
            &self,
            _request: &TrainingSessionSelectionRequest,
        ) -> Result<PersistedTrainingSessionSelection, TrainingSessionDiscoveryPortError> {
            Ok(PersistedTrainingSessionSelection {
                snapshot_ref: SNAPSHOT.to_owned(),
                sessions: vec![item()],
            })
        }
    }
    let missing = query_training_session_selection(
        &MissingSelectionPort,
        TrainingSessionSelectionRequest {
            session_refs: vec![SESSION.to_owned(), format!("session-{}", "d".repeat(64))],
            snapshot_ref: None,
        },
    );
    assert!(matches!(
        missing,
        Err(ApplicationError::TrainingSessionSearch(_))
    ));
}

fn workspace() -> TrainingDiscoveryWorkspace {
    TrainingDiscoveryWorkspace {
        version: 2,
        snapshot_ref: SNAPSHOT.to_owned(),
        from: Some("2024-01-01".to_owned()),
        through: Some("2026-08-31".to_owned()),
        sport_refs: vec![classified_sport().sport_ref.unwrap()],
        required_measurements: vec![TrainingMeasurementFilter::Distance],
        text: Some("Trail".to_owned()),
        sort: TrainingSessionSort::DistanceDescending,
        offset: 25,
        limit: 25,
        view: TrainingDiscoveryView::Calendar,
        calendar_month: Some("2026-08".to_owned()),
        calendar_day: Some("2026-08-18".to_owned()),
        selected_session_refs: vec![SESSION.to_owned()],
        open_session_ref: Some(SESSION.to_owned()),
    }
}

#[test]
fn saves_loads_and_clears_a_complete_training_discovery_workspace() {
    struct WorkspacePort {
        value: Mutex<Option<TrainingDiscoveryWorkspace>>,
    }
    impl TrainingDiscoveryWorkspacePort for WorkspacePort {
        fn load_training_discovery_workspace(
            &self,
        ) -> Result<Option<TrainingDiscoveryWorkspace>, String> {
            Ok(self.value.lock().unwrap().clone())
        }

        fn save_training_discovery_workspace(
            &self,
            workspace: &TrainingDiscoveryWorkspace,
        ) -> Result<(), String> {
            *self.value.lock().unwrap() = Some(workspace.clone());
            Ok(())
        }

        fn clear_training_discovery_workspace(&self) -> Result<(), String> {
            *self.value.lock().unwrap() = None;
            Ok(())
        }
    }
    let port = WorkspacePort {
        value: Mutex::new(None),
    };
    let expected = workspace();

    assert_eq!(
        save_training_discovery_workspace(&port, expected.clone()).unwrap(),
        expected
    );
    assert_eq!(
        load_training_discovery_workspace(&port).unwrap(),
        Some(expected)
    );
    clear_training_discovery_workspace(&port).unwrap();
    assert_eq!(load_training_discovery_workspace(&port).unwrap(), None);
}

#[test]
fn rejects_inconsistent_training_discovery_workspaces_before_writing() {
    struct UnreachableWorkspacePort;
    impl TrainingDiscoveryWorkspacePort for UnreachableWorkspacePort {
        fn load_training_discovery_workspace(
            &self,
        ) -> Result<Option<TrainingDiscoveryWorkspace>, String> {
            unreachable!("invalid workspace must not be loaded")
        }

        fn save_training_discovery_workspace(
            &self,
            _workspace: &TrainingDiscoveryWorkspace,
        ) -> Result<(), String> {
            unreachable!("invalid workspace must not be written")
        }

        fn clear_training_discovery_workspace(&self) -> Result<(), String> {
            unreachable!("invalid workspace must not be cleared")
        }
    }
    let cases = [
        TrainingDiscoveryWorkspace {
            version: 3,
            ..workspace()
        },
        TrainingDiscoveryWorkspace {
            view: TrainingDiscoveryView::Chronology,
            calendar_month: Some("2026-08".to_owned()),
            calendar_day: None,
            ..workspace()
        },
        TrainingDiscoveryWorkspace {
            selected_session_refs: vec![SESSION.to_owned(), SESSION.to_owned()],
            ..workspace()
        },
        TrainingDiscoveryWorkspace {
            offset: 1,
            ..workspace()
        },
        TrainingDiscoveryWorkspace {
            offset: 20,
            limit: 10,
            ..workspace()
        },
    ];
    for value in cases {
        assert!(matches!(
            save_training_discovery_workspace(&UnreachableWorkspacePort, value),
            Err(ApplicationError::InvalidTrainingDiscoveryWorkspace(_))
        ));
    }
}

#[test]
fn returns_an_exact_page_and_derives_the_next_offset() {
    let mut first_request = request();
    first_request.limit = 1;
    let port = ControlledDiscoveryPort {
        result: Ok(page(vec![item()], 26)),
    };

    let result = query_training_sessions(&port, first_request).unwrap();

    assert_eq!(result.available_range.unwrap().from, "2020-01-01");
    assert_eq!(result.snapshot_ref, SNAPSHOT);
    assert_eq!(result.total_count, 26);
    assert_eq!(result.offset, 0);
    assert_eq!(result.limit, 1);
    assert_eq!(result.next_offset, Some(1));
    assert_eq!(result.summaries[0].session_count, 26);
    assert_eq!(result.sessions[0].sport, classified_sport());
}

#[test]
fn accepts_combinable_filters_and_the_last_page() {
    let mut filtered = request();
    filtered.from = Some("2026-08-01".to_owned());
    filtered.through = Some("2026-08-31".to_owned());
    filtered.sport_refs = vec![classified_sport().sport_ref.unwrap()];
    filtered.required_measurements = vec![
        TrainingMeasurementFilter::Distance,
        TrainingMeasurementFilter::HeartRate,
    ];
    filtered.text = Some("trail".to_owned());
    filtered.sort = TrainingSessionSort::DistanceDescending;
    filtered.offset = 25;
    filtered.snapshot_ref = Some(SNAPSHOT.to_owned());
    let port = ControlledDiscoveryPort {
        result: Ok(page(vec![item()], 26)),
    };

    let result = query_training_sessions(&port, filtered).unwrap();

    assert_eq!(result.next_offset, None);
    assert_eq!(result.sessions.len(), 1);
}

#[test]
fn validates_recognition_against_the_domain_contract_without_personal_label_limits() {
    let mut recognized = item();
    recognized.sport = recognized_sport("r".repeat(120));
    let accepted = query_training_sessions(
        &ControlledDiscoveryPort {
            result: Ok(page(vec![recognized.clone()], 1)),
        },
        request(),
    )
    .expect("120-character provider name remains valid");
    assert_eq!(
        accepted.sessions[0]
            .sport
            .recognition
            .as_ref()
            .expect("recognized identity")
            .localized_names["en"]
            .chars()
            .count(),
        120
    );

    recognized
        .sport
        .recognition
        .as_mut()
        .expect("recognized identity")
        .localized_names = BTreeMap::from([("e".to_owned(), "Running".to_owned())]);
    let rejected = query_training_sessions(
        &ControlledDiscoveryPort {
            result: Ok(page(vec![recognized], 1)),
        },
        request(),
    );
    assert!(matches!(
        rejected,
        Err(ApplicationError::TrainingSessionSearch(_))
    ));
}

#[test]
fn rejects_invalid_requests_before_querying_storage() {
    let cases = [
        {
            let mut value = request();
            value.limit = 0;
            value
        },
        {
            let mut value = request();
            value.from = Some("2026-08-02".to_owned());
            value.through = Some("2026-08-01".to_owned());
            value
        },
        {
            let mut value = request();
            value.text = Some(" padded ".to_owned());
            value
        },
        {
            let mut value = request();
            value.required_measurements = vec![
                TrainingMeasurementFilter::Distance,
                TrainingMeasurementFilter::Distance,
            ];
            value
        },
        {
            let mut value = request();
            value.sport_refs = vec!["sport-visible-provider-value".to_owned()];
            value
        },
        {
            let mut value = request();
            value.snapshot_ref = Some(
                "training-snapshot-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
                    .to_owned(),
            );
            value
        },
    ];
    for invalid_request in cases {
        let result = query_training_sessions(
            &ControlledDiscoveryPort {
                result: Err(TrainingSessionDiscoveryPortError::Failure(
                    "must not be reached".to_owned(),
                )),
            },
            invalid_request,
        );
        assert!(matches!(
            result,
            Err(ApplicationError::InvalidTrainingSessionSearch(_))
        ));
    }
}

#[test]
fn reports_snapshot_changes_and_unknown_sport_references_distinctly() {
    let changed = query_training_sessions(
        &ControlledDiscoveryPort {
            result: Err(TrainingSessionDiscoveryPortError::SnapshotChanged),
        },
        request(),
    );
    assert!(matches!(
        changed,
        Err(ApplicationError::TrainingSessionSearchChanged)
    ));

    let unknown = query_training_sessions(
        &ControlledDiscoveryPort {
            result: Err(TrainingSessionDiscoveryPortError::UnknownSportReference),
        },
        request(),
    );
    assert!(matches!(
        unknown,
        Err(ApplicationError::InvalidTrainingSessionSearch(
            "sport reference is not available"
        ))
    ));
}

#[test]
fn rejects_storage_pages_that_violate_filters_or_identity_invariants() {
    let mut distance_missing = item();
    distance_missing.distance_meters = None;
    let mut filtered = request();
    filtered.required_measurements = vec![TrainingMeasurementFilter::Distance];
    let invalid_measurement = query_training_sessions(
        &ControlledDiscoveryPort {
            result: Ok(page(vec![distance_missing], 1)),
        },
        filtered,
    );
    assert!(matches!(
        invalid_measurement,
        Err(ApplicationError::TrainingSessionSearch(_))
    ));

    let invalid_identity = query_training_sessions(
        &ControlledDiscoveryPort {
            result: Ok(page(vec![item(), item()], 2)),
        },
        request(),
    );
    assert!(matches!(
        invalid_identity,
        Err(ApplicationError::TrainingSessionSearch(_))
    ));

    let mut invalid_sport_item = item();
    invalid_sport_item.sport.sport_ref = Some("sport-visible-provider-value".to_owned());
    let invalid_sport = query_training_sessions(
        &ControlledDiscoveryPort {
            result: Ok(page(vec![invalid_sport_item], 1)),
        },
        request(),
    );
    assert!(matches!(
        invalid_sport,
        Err(ApplicationError::TrainingSessionSearch(_))
    ));

    let mut beyond_end = request();
    beyond_end.offset = 2;
    let invalid_offset = query_training_sessions(
        &ControlledDiscoveryPort {
            result: Ok(page(Vec::new(), 1)),
        },
        beyond_end,
    );
    assert!(matches!(
        invalid_offset,
        Err(ApplicationError::TrainingSessionSearch(_))
    ));

    let mut noncanonical_bound = page(Vec::new(), 0);
    noncanonical_bound.available_range.as_mut().unwrap().from = "2020-1-01".to_owned();
    let invalid_bound = query_training_sessions(
        &ControlledDiscoveryPort {
            result: Ok(noncanonical_bound),
        },
        request(),
    );
    assert!(matches!(
        invalid_bound,
        Err(ApplicationError::TrainingSessionSearch(_))
    ));

    let mut noncanonical_time = item();
    noncanonical_time.started_at_local = "2026-08-16T7:30:00".to_owned();
    let invalid_time = query_training_sessions(
        &ControlledDiscoveryPort {
            result: Ok(page(vec![noncanonical_time], 1)),
        },
        request(),
    );
    assert!(matches!(
        invalid_time,
        Err(ApplicationError::TrainingSessionSearch(_))
    ));

    let mut incomplete_summary = page(vec![item()], 2);
    incomplete_summary.summaries[0].session_count = 1;
    let invalid_summary = query_training_sessions(
        &ControlledDiscoveryPort {
            result: Ok(incomplete_summary),
        },
        request(),
    );
    assert!(matches!(
        invalid_summary,
        Err(ApplicationError::TrainingSessionSearch(_))
    ));
}
