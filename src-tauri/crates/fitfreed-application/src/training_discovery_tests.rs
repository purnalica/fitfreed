use super::*;

const SNAPSHOT: &str =
    "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SESSION: &str = "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

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
        state: TrainingSportState::Classified,
        classification: Some(TrainingSportClassification {
            canonical_family: Some("running".to_owned()),
            display_label: Some("Trail running".to_owned()),
            authorship: Some("user".to_owned()),
            revision: 1,
        }),
    }
}

fn item() -> TrainingSessionSearchItem {
    TrainingSessionSearchItem {
        session_ref: SESSION.to_owned(),
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
