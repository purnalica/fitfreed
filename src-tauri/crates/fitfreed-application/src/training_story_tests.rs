use std::cell::RefCell;

use super::*;

const SNAPSHOT: &str =
    "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SESSION: &str = "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const EXERCISE: &str = "exercise-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const ROUTE: &str = "route-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
const SPORT: &str = "sport-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

#[derive(Clone)]
struct StoryEvidence {
    selection: PersistedTrainingSessionSelection,
    structure: PersistedTrainingSessionStructure,
    routes: PersistedTrainingSessionRoutes,
    signals: PersistedTrainingSessionSignals,
    zones: PersistedTrainingSessionZones,
    provenance: PersistedTrainingSessionProvenance,
}

struct ControlledStoryPort {
    evidence: StoryEvidence,
    accepted_snapshots: RefCell<Vec<String>>,
}

impl TrainingSessionDiscoveryPort for ControlledStoryPort {
    fn query_training_sessions(
        &self,
        _request: &TrainingSessionSearchRequest,
    ) -> Result<PersistedTrainingSessionSearchPage, TrainingSessionDiscoveryPortError> {
        unreachable!("a session story resolves one authoritative selection")
    }

    fn query_training_calendar(
        &self,
        _request: &TrainingSessionCalendarRequest,
    ) -> Result<PersistedTrainingSessionCalendar, TrainingSessionDiscoveryPortError> {
        unreachable!("a session story does not query the calendar")
    }

    fn query_training_session_selection(
        &self,
        _request: &TrainingSessionSelectionRequest,
    ) -> Result<PersistedTrainingSessionSelection, TrainingSessionDiscoveryPortError> {
        Ok(self.evidence.selection.clone())
    }
}

impl TrainingSessionStructurePort for ControlledStoryPort {
    fn query_training_session_structure(
        &self,
        query: &TrainingSessionStructureQuery,
    ) -> Result<PersistedTrainingSessionStructure, TrainingSessionStructurePortError> {
        self.record_snapshot(query.snapshot_ref.as_deref());
        Ok(self.evidence.structure.clone())
    }
}

impl TrainingSessionRoutePort for ControlledStoryPort {
    fn query_training_session_routes(
        &self,
        query: &TrainingSessionRouteQuery,
    ) -> Result<PersistedTrainingSessionRoutes, TrainingSessionRoutePortError> {
        self.record_snapshot(query.snapshot_ref.as_deref());
        Ok(self.evidence.routes.clone())
    }

    fn query_training_route_points(
        &self,
        _query: &TrainingRoutePointsQuery,
    ) -> Result<PersistedTrainingRoutePoints, TrainingSessionRoutePortError> {
        unreachable!("the bounded story returns an exact-route capability")
    }
}

impl TrainingSessionSignalPort for ControlledStoryPort {
    fn query_training_session_signals(
        &self,
        query: &TrainingSessionSignalsQuery,
    ) -> Result<PersistedTrainingSessionSignals, TrainingSessionSignalPortError> {
        self.record_snapshot(query.snapshot_ref.as_deref());
        Ok(self.evidence.signals.clone())
    }

    fn query_training_signal_samples(
        &self,
        _query: &TrainingSignalSamplesQuery,
    ) -> Result<PersistedTrainingSignalSamples, TrainingSessionSignalPortError> {
        unreachable!("the bounded story returns exact-signal capabilities")
    }
}

impl TrainingSessionZonePort for ControlledStoryPort {
    fn query_training_session_zones(
        &self,
        query: &TrainingSessionZonesQuery,
    ) -> Result<PersistedTrainingSessionZones, TrainingSessionZonePortError> {
        self.record_snapshot(query.snapshot_ref.as_deref());
        Ok(self.evidence.zones.clone())
    }
}

impl TrainingSessionProvenancePort for ControlledStoryPort {
    fn query_training_session_provenance(
        &self,
        query: &TrainingSessionProvenanceQuery,
    ) -> Result<PersistedTrainingSessionProvenance, TrainingSessionProvenancePortError> {
        self.record_snapshot(query.snapshot_ref.as_deref());
        Ok(self.evidence.provenance.clone())
    }
}

impl ControlledStoryPort {
    fn record_snapshot(&self, snapshot_ref: Option<&str>) {
        self.accepted_snapshots
            .borrow_mut()
            .push(snapshot_ref.unwrap_or_default().to_owned());
    }
}

fn classified_sport(family: &str) -> TrainingSessionSport {
    TrainingSessionSport {
        sport_ref: Some(SPORT.to_owned()),
        state: TrainingSportState::Classified,
        classification: Some(TrainingSportClassification {
            canonical_family: Some(family.to_owned()),
            display_label: Some("User sport".to_owned()),
            authorship: Some("user".to_owned()),
            revision: 1,
        }),
    }
}

fn selected_session(family: &str) -> TrainingSessionSearchItem {
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
        sport: classified_sport(family),
    }
}

fn exercise(family: &str) -> TrainingExerciseStructure {
    TrainingExerciseStructure {
        exercise_ref: EXERCISE.to_owned(),
        ordinal: 0,
        started_at_local: "2026-08-16T07:30:00.000".to_owned(),
        stopped_at_local: "2026-08-16T08:30:00.000".to_owned(),
        utc_offset_minutes: Some(120),
        duration_milliseconds: 3_600_000,
        distance_meters: Some(10_000.0),
        energy_kilocalories: Some(650),
        sport: classified_sport(family),
        manual_laps: None,
        automatic_laps: None,
        pauses: None,
    }
}

fn point(
    ordinal: usize,
    longitude_degrees: f64,
    elapsed_milliseconds: Option<i64>,
) -> TrainingRoutePointView {
    TrainingRoutePointView {
        ordinal,
        latitude_degrees: 40.0 + ordinal as f64 / 100.0,
        longitude_degrees,
        altitude_meters: Some(650.0 + ordinal as f64),
        elapsed_milliseconds,
    }
}

fn route(kind: TrainingRouteKindView, route_ref: &str) -> TrainingRouteOverview {
    TrainingRouteOverview {
        route_ref: route_ref.to_owned(),
        kind,
        started_at_local: "2026-08-16T07:30:00.000".to_owned(),
        point_count: 3,
        altitude_point_count: 3,
        elapsed_point_count: 2,
        visual_points: vec![
            point(0, 179.8, Some(0)),
            point(1, -179.9, Some(1_000)),
            point(2, -179.7, None),
        ],
    }
}

fn signal(
    ordinal: usize,
    role: TrainingSignalRoleView,
    kind: TrainingSignalKindView,
    signal_ref_value: char,
) -> TrainingSignalSeriesOverview {
    let unit = match kind {
        TrainingSignalKindView::HeartRate => TrainingSignalUnitView::BeatsPerMinute,
        TrainingSignalKindView::Speed => TrainingSignalUnitView::KilometersPerHour,
        TrainingSignalKindView::Distance | TrainingSignalKindView::Altitude => {
            TrainingSignalUnitView::Meters
        }
        TrainingSignalKindView::Cadence => TrainingSignalUnitView::RotationsPerMinute,
        TrainingSignalKindView::Temperature => TrainingSignalUnitView::DegreesCelsius,
        TrainingSignalKindView::LeftCrankPower => TrainingSignalUnitView::Watts,
    };
    TrainingSignalSeriesOverview {
        signal_ref: format!("signal-{}", signal_ref_value.to_string().repeat(64)),
        ordinal,
        role,
        kind,
        unit,
        interval_milliseconds: 1_000,
        sample_count: 3,
        available_sample_count: 2,
        visual_samples: vec![
            TrainingSignalVisualSampleView {
                ordinal: 0,
                elapsed_milliseconds: 0,
                value: Some(10.0),
                gap_before: false,
            },
            TrainingSignalVisualSampleView {
                ordinal: 1,
                elapsed_milliseconds: 1_000,
                value: None,
                gap_before: true,
            },
            TrainingSignalVisualSampleView {
                ordinal: 2,
                elapsed_milliseconds: 2_000,
                value: Some(20.0),
                gap_before: false,
            },
        ],
    }
}

fn evidence(family: &str) -> StoryEvidence {
    let session = selected_session(family);
    let structure = exercise(family);
    StoryEvidence {
        selection: PersistedTrainingSessionSelection {
            snapshot_ref: SNAPSHOT.to_owned(),
            sessions: vec![session],
        },
        structure: PersistedTrainingSessionStructure {
            snapshot_ref: SNAPSHOT.to_owned(),
            session_ref: SESSION.to_owned(),
            structure: Some(TrainingStructure {
                exercises: Some(vec![structure]),
            }),
        },
        routes: PersistedTrainingSessionRoutes {
            snapshot_ref: SNAPSHOT.to_owned(),
            session_ref: SESSION.to_owned(),
            routes: Some(TrainingSessionRoutesView {
                exercises: Some(vec![TrainingExerciseRoutesView {
                    exercise_ref: EXERCISE.to_owned(),
                    ordinal: 0,
                    routes: Some(TrainingRouteCollectionView {
                        primary: Some(route(TrainingRouteKindView::Primary, ROUTE)),
                        transition: None,
                    }),
                }]),
            }),
        },
        signals: PersistedTrainingSessionSignals {
            snapshot_ref: SNAPSHOT.to_owned(),
            session_ref: SESSION.to_owned(),
            signals: Some(TrainingSessionSignalsView {
                exercises: Some(vec![TrainingExerciseSignalsView {
                    exercise_ref: EXERCISE.to_owned(),
                    ordinal: 0,
                    signals: Some(TrainingSignalCollectionView {
                        primary: Some(vec![
                            signal(
                                0,
                                TrainingSignalRoleView::Primary,
                                TrainingSignalKindView::HeartRate,
                                'f',
                            ),
                            signal(
                                1,
                                TrainingSignalRoleView::Primary,
                                TrainingSignalKindView::Speed,
                                'a',
                            ),
                        ]),
                        transition: None,
                        unsupported_primary_series_count: 1,
                        unsupported_transition_series_count: 0,
                    }),
                }]),
            }),
        },
        zones: PersistedTrainingSessionZones {
            snapshot_ref: SNAPSHOT.to_owned(),
            session_ref: SESSION.to_owned(),
            zones: Some(TrainingSessionZonesView {
                exercises: Some(vec![TrainingExerciseZonesView {
                    exercise_ref: EXERCISE.to_owned(),
                    ordinal: 0,
                    zones: None,
                }]),
            }),
        },
        provenance: PersistedTrainingSessionProvenance {
            snapshot_ref: SNAPSHOT.to_owned(),
            session_ref: SESSION.to_owned(),
            total_event_count: 1,
            current: TrainingProvenanceCurrentView {
                provider: TrainingSourceProviderView::restore("synthetic-source".to_owned())
                    .unwrap(),
                source_modified_at_utc: "2026-08-16T08:00:00Z".to_owned(),
                source_adapter_version: "synthetic-adapter@1".to_owned(),
                mapping_version: "training-session@1".to_owned(),
                contributing_event_count: 1,
                non_contributing_event_count: 0,
            },
            events: vec![TrainingProvenanceEventView {
                ordinal: 0,
                observed_at_utc: "2026-08-16T09:00:00Z".to_owned(),
                source_modified_at_utc: "2026-08-16T08:00:00Z".to_owned(),
                provider: TrainingSourceProviderView::restore("synthetic-source".to_owned())
                    .unwrap(),
                source_adapter_version: "synthetic-adapter@1".to_owned(),
                mapping_version: "training-session@1".to_owned(),
                decision: TrainingProvenanceDecisionView::Create,
                contributes_to_visible_state: true,
            }],
        },
    }
}

fn port(family: &str) -> ControlledStoryPort {
    ControlledStoryPort {
        evidence: evidence(family),
        accepted_snapshots: RefCell::new(Vec::new()),
    }
}

fn query() -> SessionStoryQuery {
    SessionStoryQuery {
        session_ref: SESSION.to_owned(),
        snapshot_ref: None,
        max_visual_points: 3,
        max_visual_samples: 3,
    }
}

fn ports(port: &ControlledStoryPort) -> SessionStoryPorts<'_> {
    SessionStoryPorts {
        discovery: port,
        structure: port,
        routes: port,
        signals: port,
        zones: port,
        provenance: port,
    }
}

#[test]
fn composes_a_running_story_at_one_authoritative_snapshot() {
    let port = port("running");
    let story = query_session_story(ports(&port), query()).unwrap();

    assert_eq!(story.schema_version, TRAINING_SESSION_STORY_SCHEMA_VERSION);
    assert_eq!(TRAINING_SESSION_STORY_SCHEMA_VERSION, 2);
    assert_eq!(story.snapshot_ref, SNAPSHOT);
    assert_eq!(story.session.session_ref, SESSION);
    assert_eq!(port.accepted_snapshots.borrow().as_slice(), [SNAPSHOT; 5]);
    assert_eq!(story.exercises.len(), 1);
    assert_eq!(
        story.composition,
        SessionStoryCompositionView {
            structure_state: SessionStoryAssessmentStateView::SourcePresent,
            route_state: SessionStoryAssessmentStateView::SourcePresent,
            signal_state: SessionStoryAssessmentStateView::SourcePresent,
            zone_state: SessionStoryAssessmentStateView::SourcePresent,
            exercise_count: 1,
        }
    );

    let exercise = &story.exercises[0];
    assert_eq!(
        exercise.evidence,
        SessionStoryExerciseEvidenceView {
            has_structure: true,
            manual_lap_count: 0,
            automatic_lap_count: 0,
            pause_count: 0,
            zone_group_count: 0,
            zone_count: 0,
            timed_zone_count: 0,
            unsupported_zone_group_count: 0,
        }
    );
    let primary = &exercise.primary;
    assert_eq!(
        primary.evidence,
        SessionStoryRoleEvidenceView {
            route_point_count: 3,
            signal_series_count: 2,
            signal_series_with_values_count: 2,
            partial_signal_series_count: 2,
            unavailable_signal_series_count: 0,
            empty_signal_series_count: 0,
            unsupported_signal_series_count: 1,
            signal_sample_count: 6,
            available_signal_sample_count: 4,
            unavailable_signal_sample_count: 2,
        }
    );
    assert_eq!(
        primary.route.as_ref().unwrap().visual_points[1].longitude_degrees,
        -179.9
    );
    assert_eq!(primary.exact_route.as_ref().unwrap().point_count, 3);
    assert_eq!(primary.exact_signals.len(), 2);
    assert_eq!(primary.primary_metric, Some(SessionStoryMetricView::Pace));
    assert_eq!(
        primary
            .eligible_overlays
            .iter()
            .map(|overlay| (overlay.metric, overlay.value_transform))
            .collect::<Vec<_>>(),
        vec![
            (
                SessionStoryMetricView::Pace,
                SessionStoryValueTransform::KilometersPerHourToMinutesPerKilometer,
            ),
            (
                SessionStoryMetricView::HeartRate,
                SessionStoryValueTransform::Identity,
            ),
        ]
    );
    assert_eq!(
        primary.eligible_overlays[0]
            .aligned_samples
            .iter()
            .map(|sample| (
                sample.route_point_ordinal,
                sample.signal_sample_ordinal,
                sample.elapsed_milliseconds,
                sample.value,
                sample.gap_before,
            ))
            .collect::<Vec<_>>(),
        vec![(0, 0, 0, Some(10.0), false), (1, 1, 1_000, None, true)]
    );
    assert_eq!(story.provenance.total_event_count, 1);
}

#[test]
fn rejects_mixed_evidence_revisions() {
    let mut port = port("running");
    port.evidence.signals.snapshot_ref =
        "training-snapshot-ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
            .to_owned();

    assert!(matches!(
        query_session_story(ports(&port), query()),
        Err(ApplicationError::TrainingSessionDetailChanged)
    ));
}

#[test]
fn keeps_primary_and_transition_evidence_separate() {
    let mut port = port("cycling");
    let transition_route_ref =
        "route-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    let route_collection = port
        .evidence
        .routes
        .routes
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .routes
        .as_mut()
        .unwrap();
    route_collection.transition = Some(route(
        TrainingRouteKindView::Transition,
        transition_route_ref,
    ));
    let signal_collection = port
        .evidence
        .signals
        .signals
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .signals
        .as_mut()
        .unwrap();
    signal_collection.transition = Some(vec![signal(
        0,
        TrainingSignalRoleView::Transition,
        TrainingSignalKindView::Temperature,
        'c',
    )]);

    let story = query_session_story(ports(&port), query()).unwrap();
    let exercise = &story.exercises[0];

    assert_eq!(exercise.primary.route.as_ref().unwrap().route_ref, ROUTE);
    assert_eq!(exercise.primary.signals.len(), 2);
    assert_eq!(
        exercise.transition.route.as_ref().unwrap().route_ref,
        transition_route_ref
    );
    assert_eq!(exercise.transition.signals.len(), 1);
    assert_eq!(
        exercise.transition.eligible_overlays[0].metric,
        SessionStoryMetricView::Temperature
    );
}

#[test]
fn chooses_sport_specific_metric_priority_without_presentation_color() {
    for (family, expected) in [
        ("running", SessionStoryMetricView::Pace),
        ("cycling", SessionStoryMetricView::Speed),
        ("water-sport", SessionStoryMetricView::Speed),
    ] {
        let port = port(family);
        let story = query_session_story(ports(&port), query()).unwrap();
        let primary = &story.exercises[0].primary;

        assert_eq!(primary.primary_metric, Some(expected));
        assert!(primary
            .eligible_overlays
            .iter()
            .all(|overlay| overlay.metric != SessionStoryMetricView::StrokeRate));
    }
}

#[test]
fn keeps_water_sport_cadence_semantics_until_stroke_evidence_exists() {
    let mut port = port("water-sport");
    port.evidence
        .signals
        .signals
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .signals
        .as_mut()
        .unwrap()
        .primary
        .as_mut()
        .unwrap()
        .push(signal(
            2,
            TrainingSignalRoleView::Primary,
            TrainingSignalKindView::Cadence,
            'c',
        ));

    let story = query_session_story(ports(&port), query()).unwrap();
    let metrics = story.exercises[0]
        .primary
        .eligible_overlays
        .iter()
        .map(|overlay| overlay.metric)
        .collect::<Vec<_>>();

    assert!(metrics.contains(&SessionStoryMetricView::Cadence));
    assert!(!metrics.contains(&SessionStoryMetricView::StrokeRate));
}

#[test]
fn preserves_source_assessment_states_while_composing_no_workbench_evidence() {
    let mut port = port("running");
    port.evidence.structure.structure = None;
    port.evidence.routes.routes = None;
    port.evidence.signals.signals = None;
    port.evidence.zones.zones = None;

    let story = query_session_story(ports(&port), query()).unwrap();

    assert_eq!(story.structure, None);
    assert_eq!(story.routes, None);
    assert_eq!(story.signals, None);
    assert_eq!(story.zones, None);
    assert!(story.exercises.is_empty());
    assert_eq!(
        story.composition,
        SessionStoryCompositionView {
            structure_state: SessionStoryAssessmentStateView::NotEvaluated,
            route_state: SessionStoryAssessmentStateView::NotEvaluated,
            signal_state: SessionStoryAssessmentStateView::NotEvaluated,
            zone_state: SessionStoryAssessmentStateView::NotEvaluated,
            exercise_count: 0,
        }
    );
}

#[test]
fn describes_partial_signal_evidence_without_requiring_structure_or_a_route() {
    let mut port = port("running");
    port.evidence.structure.structure = None;
    port.evidence.routes.routes = Some(TrainingSessionRoutesView { exercises: None });
    port.evidence.zones.zones = Some(TrainingSessionZonesView {
        exercises: Some(Vec::new()),
    });

    let story = query_session_story(ports(&port), query()).unwrap();

    assert_eq!(story.exercises.len(), 1);
    assert_eq!(
        story.composition,
        SessionStoryCompositionView {
            structure_state: SessionStoryAssessmentStateView::NotEvaluated,
            route_state: SessionStoryAssessmentStateView::SourceAbsent,
            signal_state: SessionStoryAssessmentStateView::SourcePresent,
            zone_state: SessionStoryAssessmentStateView::SourceEmpty,
            exercise_count: 1,
        }
    );
    let exercise = &story.exercises[0];
    assert!(!exercise.evidence.has_structure);
    assert_eq!(exercise.primary.evidence.route_point_count, 0);
    assert_eq!(exercise.primary.evidence.signal_series_count, 2);
    assert_eq!(
        exercise.primary.primary_metric,
        Some(SessionStoryMetricView::Pace)
    );
    assert!(exercise
        .primary
        .eligible_overlays
        .iter()
        .all(|overlay| overlay.aligned_samples.is_empty()));
}

#[test]
fn distinguishes_empty_unavailable_partial_and_unsupported_signal_evidence() {
    let mut port = port("cycling");
    let collection = port
        .evidence
        .signals
        .signals
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .signals
        .as_mut()
        .unwrap();
    let primary = collection.primary.as_mut().unwrap();
    primary[0].sample_count = 0;
    primary[0].available_sample_count = 0;
    primary[0].visual_samples.clear();
    primary[1].available_sample_count = 0;
    for (ordinal, sample) in primary[1].visual_samples.iter_mut().enumerate() {
        sample.value = None;
        sample.gap_before = ordinal > 0;
    }
    collection.unsupported_primary_series_count = 3;

    let story = query_session_story(ports(&port), query()).unwrap();
    let evidence = &story.exercises[0].primary.evidence;

    assert_eq!(evidence.signal_series_count, 2);
    assert_eq!(evidence.signal_series_with_values_count, 0);
    assert_eq!(evidence.partial_signal_series_count, 0);
    assert_eq!(evidence.unavailable_signal_series_count, 1);
    assert_eq!(evidence.empty_signal_series_count, 1);
    assert_eq!(evidence.unsupported_signal_series_count, 3);
    assert_eq!(evidence.signal_sample_count, 3);
    assert_eq!(evidence.available_signal_sample_count, 0);
    assert_eq!(evidence.unavailable_signal_sample_count, 3);
    assert_eq!(story.exercises[0].primary.primary_metric, None);
}

#[test]
fn describes_recorded_zone_bands_without_inventing_time_for_untimed_bands() {
    let mut port = port("cycling");
    port.evidence
        .zones
        .zones
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .zones = Some(TrainingZoneCollectionView {
        groups: vec![TrainingZoneGroupView {
            zone_group_ref:
                "zone-group-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                    .to_owned(),
            ordinal: 0,
            kind: TrainingZoneKindView::HeartRate,
            unit: TrainingZoneUnitView::BeatsPerMinute,
            zones: Some(vec![
                TrainingZoneView {
                    zone_ref:
                        "zone-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
                            .to_owned(),
                    ordinal: 0,
                    lower_limit: 120.0,
                    higher_limit: 139.0,
                    time_in_zone_milliseconds: Some(900_000),
                    distance_meters: None,
                    muscle_load: None,
                },
                TrainingZoneView {
                    zone_ref:
                        "zone-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
                            .to_owned(),
                    ordinal: 1,
                    lower_limit: 140.0,
                    higher_limit: 159.0,
                    time_in_zone_milliseconds: None,
                    distance_meters: None,
                    muscle_load: None,
                },
            ]),
        }],
        unsupported_group_count: 2,
    });

    let story = query_session_story(ports(&port), query()).unwrap();
    let evidence = &story.exercises[0].evidence;

    assert_eq!(evidence.zone_group_count, 1);
    assert_eq!(evidence.zone_count, 2);
    assert_eq!(evidence.timed_zone_count, 1);
    assert_eq!(evidence.unsupported_zone_group_count, 2);
}

#[test]
fn does_not_reuse_a_single_exercise_sport_across_conflicting_partial_compositions() {
    let mut port = port("running");
    port.evidence.structure.structure = None;
    let second_exercise_ref =
        "exercise-ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    port.evidence
        .zones
        .zones
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()
        .push(TrainingExerciseZonesView {
            exercise_ref: second_exercise_ref.to_owned(),
            ordinal: 1,
            zones: None,
        });

    let story = query_session_story(ports(&port), query()).unwrap();

    assert_eq!(story.exercises.len(), 2);
    assert!(story
        .exercises
        .iter()
        .all(|exercise| exercise.sport.is_none()));
}

#[test]
fn rejects_cross_source_exercise_identity_conflicts() {
    let mut port = port("running");
    port.evidence
        .routes
        .routes
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .exercise_ref =
        "exercise-ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff".to_owned();

    assert!(matches!(
        query_session_story(ports(&port), query()),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));
}
