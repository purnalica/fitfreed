use fitfreed_domain::{
    TrainingSessionRange, TrainingSessionRangeAuthorship, TrainingSessionRangeCoordinate,
    TrainingSessionRangeState,
};

use super::{
    query_training_session_range_summary, ApplicationError,
    PersistedTrainingRangeCoordinateEvidence, PersistedTrainingRangeSummaryExercise,
    PersistedTrainingRangeSummarySourceRange, PersistedTrainingSessionRangeSummary,
    TrainingRangeBoundaryEvidenceState, TrainingRangeCardinalDirection,
    TrainingRangeCoordinateEvidence, TrainingRangeEvidenceStreamItem,
    TrainingRangeExactEvidenceKind, TrainingRangeMetricCoverage,
    TrainingRangeSourceOverlapRelation, TrainingRangeSourceRangeKind,
    TrainingRangeSummaryCoverageState, TrainingRangeSummaryLimitation, TrainingRouteKindView,
    TrainingRoutePointView, TrainingSessionRangeSummaryPort, TrainingSessionRangeSummaryPortError,
    TrainingSessionRangeSummaryQuery, TrainingSessionSport, TrainingSignalKindView,
    TrainingSignalRoleView, TrainingSignalSampleView, TrainingSignalUnitView,
    TrainingSourceProviderView, TrainingSportState,
};

const SNAPSHOT_REF: &str = concat!(
    "training-snapshot-",
    "1111111111111111111111111111111111111111111111111111111111111111"
);
const SESSION_REF: &str =
    "session-2222222222222222222222222222222222222222222222222222222222222222";
const EXERCISE_REF: &str = concat!(
    "exercise-",
    "3333333333333333333333333333333333333333333333333333333333333333"
);
const RANGE_REF: &str = "range-4444444444444444444444444444444444444444444444444444444444444444";
const ROUTE_REF: &str = "route-5555555555555555555555555555555555555555555555555555555555555555";
const SIGNAL_REF: &str = "signal-6666666666666666666666666666666666666666666666666666666666666666";
const MANUAL_LAP_REF: &str = "lap-7777777777777777777777777777777777777777777777777777777777777777";
const AUTOMATIC_LAP_REF: &str =
    "lap-8888888888888888888888888888888888888888888888888888888888888888";
const EVIDENCE_REVISION: &str = concat!(
    "range-evidence-",
    "9999999999999999999999999999999999999999999999999999999999999999"
);

#[derive(Clone)]
struct ControlledSummaryPort {
    persisted: Result<PersistedTrainingSessionRangeSummary, TrainingSessionRangeSummaryPortError>,
    evidence: Vec<TrainingRangeEvidenceStreamItem>,
}

impl TrainingSessionRangeSummaryPort for ControlledSummaryPort {
    fn query_training_session_range_summary_context(
        &self,
        _query: &TrainingSessionRangeSummaryQuery,
    ) -> Result<PersistedTrainingSessionRangeSummary, TrainingSessionRangeSummaryPortError> {
        self.persisted.clone()
    }

    fn visit_training_session_range_summary_evidence(
        &self,
        _query: &TrainingSessionRangeSummaryQuery,
        visitor: &mut dyn FnMut(TrainingRangeEvidenceStreamItem) -> Result<(), &'static str>,
    ) -> Result<(), TrainingSessionRangeSummaryPortError> {
        for item in self.evidence.iter().cloned() {
            visitor(item).map_err(TrainingSessionRangeSummaryPortError::InvalidEvidence)?;
        }
        Ok(())
    }
}

struct DenseSignalSummaryPort {
    persisted: PersistedTrainingSessionRangeSummary,
    sample_count: usize,
}

impl TrainingSessionRangeSummaryPort for DenseSignalSummaryPort {
    fn query_training_session_range_summary_context(
        &self,
        _query: &TrainingSessionRangeSummaryQuery,
    ) -> Result<PersistedTrainingSessionRangeSummary, TrainingSessionRangeSummaryPortError> {
        Ok(self.persisted.clone())
    }

    fn visit_training_session_range_summary_evidence(
        &self,
        _query: &TrainingSessionRangeSummaryQuery,
        visitor: &mut dyn FnMut(TrainingRangeEvidenceStreamItem) -> Result<(), &'static str>,
    ) -> Result<(), TrainingSessionRangeSummaryPortError> {
        for ordinal in 0..self.sample_count {
            visitor(signal_sample(
                ordinal,
                ordinal.is_multiple_of(2).then_some(1.0),
            ))
            .map_err(TrainingSessionRangeSummaryPortError::InvalidEvidence)?;
        }
        Ok(())
    }
}

fn query() -> TrainingSessionRangeSummaryQuery {
    TrainingSessionRangeSummaryQuery {
        session_ref: SESSION_REF.to_owned(),
        snapshot_ref: SNAPSHOT_REF.to_owned(),
        range_ref: RANGE_REF.to_owned(),
        expected_range_revision: 3,
    }
}

fn sport() -> TrainingSessionSport {
    TrainingSessionSport {
        sport_ref: None,
        state: TrainingSportState::Unavailable,
        classification: None,
        recognition: None,
        recognition_candidate_count: 0,
    }
}

fn source_range(
    source_range_ref: &str,
    kind: TrainingRangeSourceRangeKind,
    ordinal: usize,
    started: i64,
    ended: i64,
    distance_meters: Option<f64>,
) -> PersistedTrainingRangeSummarySourceRange {
    PersistedTrainingRangeSummarySourceRange {
        source_range_ref: source_range_ref.to_owned(),
        kind,
        ordinal,
        started_at_elapsed_milliseconds: started,
        ended_at_elapsed_milliseconds: ended,
        distance_meters,
    }
}

fn exercise() -> PersistedTrainingRangeSummaryExercise {
    PersistedTrainingRangeSummaryExercise {
        exercise_ref: EXERCISE_REF.to_owned(),
        ordinal: 0,
        duration_milliseconds: 600_000,
        distance_meters: Some(5_000.0),
        sport: sport(),
        source_ranges: vec![
            source_range(
                MANUAL_LAP_REF,
                TrainingRangeSourceRangeKind::ManualLap,
                0,
                60_000,
                180_000,
                Some(1_000.0),
            ),
            source_range(
                AUTOMATIC_LAP_REF,
                TrainingRangeSourceRangeKind::AutomaticLap,
                0,
                0,
                300_000,
                Some(2_500.0),
            ),
        ],
        route_coordinate_count: 1,
        signal_coordinate_count: 2,
    }
}

fn range(
    coordinate: TrainingSessionRangeCoordinate,
    started: i64,
    ended: i64,
) -> TrainingSessionRange {
    TrainingSessionRange::restore(
        RANGE_REF,
        SESSION_REF,
        Some(EXERCISE_REF.to_owned()),
        coordinate,
        "Bridge effort",
        started,
        ended,
        EVIDENCE_REVISION,
        TrainingSessionRangeAuthorship::User,
        TrainingSessionRangeState::Current,
        3,
    )
    .expect("current range")
}

fn persisted(
    range: TrainingSessionRange,
    coordinate_evidence: PersistedTrainingRangeCoordinateEvidence,
) -> PersistedTrainingSessionRangeSummary {
    PersistedTrainingSessionRangeSummary {
        snapshot_ref: SNAPSHOT_REF.to_owned(),
        session_ref: SESSION_REF.to_owned(),
        evidence_revision: EVIDENCE_REVISION.to_owned(),
        source_provider: TrainingSourceProviderView::restore("synthetic-provider".to_owned())
            .expect("provider"),
        range,
        exercise: Some(exercise()),
        coordinate_evidence,
    }
}

fn route_point(
    ordinal: usize,
    longitude_degrees: f64,
    altitude_meters: f64,
    elapsed_milliseconds: Option<i64>,
) -> TrainingRangeEvidenceStreamItem {
    route_point_with_altitude(
        ordinal,
        longitude_degrees,
        Some(altitude_meters),
        elapsed_milliseconds,
    )
}

fn route_point_with_altitude(
    ordinal: usize,
    longitude_degrees: f64,
    altitude_meters: Option<f64>,
    elapsed_milliseconds: Option<i64>,
) -> TrainingRangeEvidenceStreamItem {
    TrainingRangeEvidenceStreamItem::RoutePoint {
        route_ref: ROUTE_REF.to_owned(),
        point: TrainingRoutePointView {
            ordinal,
            latitude_degrees: 0.0,
            longitude_degrees,
            altitude_meters,
            elapsed_milliseconds,
        },
    }
}

fn signal_sample(ordinal: usize, value: Option<f64>) -> TrainingRangeEvidenceStreamItem {
    TrainingRangeEvidenceStreamItem::SignalSample {
        signal_ref: SIGNAL_REF.to_owned(),
        sample: TrainingSignalSampleView {
            ordinal,
            elapsed_milliseconds: i64::try_from(ordinal).expect("ordinal") * 1_000,
            value,
        },
    }
}

#[test]
fn summarizes_exact_route_geometry_without_claiming_unproven_signal_alignment() {
    let port = ControlledSummaryPort {
        persisted: Ok(persisted(
            range(
                TrainingSessionRangeCoordinate::route_elapsed(ROUTE_REF).expect("route coordinate"),
                0,
                120_000,
            ),
            PersistedTrainingRangeCoordinateEvidence::Route {
                route_ref: ROUTE_REF.to_owned(),
                kind: TrainingRouteKindView::Primary,
                point_count: 4,
                elapsed_point_count: 3,
                maximum_elapsed_milliseconds: 120_000,
            },
        )),
        evidence: vec![
            route_point(0, 0.0, 10.0, Some(0)),
            route_point(1, 0.001, 12.0, Some(60_000)),
            route_point(2, 0.0015, 13.0, None),
            route_point(3, 0.002, 15.0, Some(120_000)),
        ],
    };

    let summary = query_training_session_range_summary(&port, query()).expect("route summary");

    assert_eq!(summary.elapsed_duration_milliseconds, 120_000);
    let distance = summary.distance.expect("recorded route distance");
    assert!((distance.meters - 222.39).abs() < 0.5);
    assert_eq!(distance.coverage, TrainingRangeMetricCoverage::Complete);
    let direction = summary.direction.expect("recorded direction");
    assert!((direction.initial_bearing_degrees - 90.0).abs() < 0.1);
    assert_eq!(direction.cardinal, TrainingRangeCardinalDirection::East);
    assert_eq!(
        summary.coverage.state,
        TrainingRangeSummaryCoverageState::Partial
    );
    assert_eq!(summary.coverage.recorded_evidence_count, 4);
    assert_eq!(summary.coverage.selected_evidence_count, 4);
    assert_eq!(summary.coverage.available_evidence_count, 4);
    assert_eq!(summary.coverage.missing_elapsed_evidence_count, 1);
    assert_eq!(
        summary.boundaries.start.state,
        TrainingRangeBoundaryEvidenceState::Exact
    );
    assert_eq!(
        summary.boundaries.end.state,
        TrainingRangeBoundaryEvidenceState::Exact
    );
    assert_eq!(summary.boundaries.start.exact_match_count, 1);
    assert_eq!(
        summary.boundaries.start.exact_matches[0].kind,
        TrainingRangeExactEvidenceKind::RoutePoint
    );
    assert_eq!(summary.measurements.len(), 1);
    assert_eq!(
        summary.measurements[0].kind,
        TrainingSignalKindView::Altitude
    );
    assert_eq!(summary.measurements[0].minimum, 10.0);
    assert_eq!(summary.measurements[0].maximum, 15.0);
    assert_eq!(summary.measurements[0].average, 12.5);
    assert_eq!(summary.measurements[0].available_evidence_count, 4);
    assert_eq!(summary.measurements[0].missing_evidence_count, 0);
    assert_eq!(summary.independent_evidence.signal_coordinate_count, 2);
    assert!(summary
        .limitations
        .contains(&TrainingRangeSummaryLimitation::UnalignedSignalEvidence));
    assert!(summary
        .limitations
        .contains(&TrainingRangeSummaryLimitation::UnalignedSourceRangeEvidence));
    assert!(summary
        .limitations
        .contains(&TrainingRangeSummaryLimitation::MissingElapsedRouteEvidence));
    assert!(summary.moving_duration_milliseconds.is_none());
    assert!(summary.paused_duration_milliseconds.is_none());
}

#[test]
fn counts_missing_altitude_independently_from_elapsed_evidence() {
    let port = ControlledSummaryPort {
        persisted: Ok(persisted(
            range(
                TrainingSessionRangeCoordinate::route_elapsed(ROUTE_REF).expect("route coordinate"),
                0,
                120_000,
            ),
            PersistedTrainingRangeCoordinateEvidence::Route {
                route_ref: ROUTE_REF.to_owned(),
                kind: TrainingRouteKindView::Primary,
                point_count: 3,
                elapsed_point_count: 3,
                maximum_elapsed_milliseconds: 120_000,
            },
        )),
        evidence: vec![
            route_point_with_altitude(0, 0.0, Some(10.0), Some(0)),
            route_point_with_altitude(1, 0.001, None, Some(60_000)),
            route_point_with_altitude(2, 0.002, Some(14.0), Some(120_000)),
        ],
    };

    let summary = query_training_session_range_summary(&port, query()).expect("route summary");

    assert_eq!(summary.measurements[0].available_evidence_count, 2);
    assert_eq!(summary.measurements[0].missing_evidence_count, 1);
    assert_eq!(summary.measurements[0].average, 12.0);
    assert_eq!(summary.coverage.missing_elapsed_evidence_count, 0);
}

#[test]
fn stops_exact_route_geometry_at_the_recorded_end_boundary() {
    let port = ControlledSummaryPort {
        persisted: Ok(persisted(
            range(
                TrainingSessionRangeCoordinate::route_elapsed(ROUTE_REF).expect("route coordinate"),
                0,
                60_000,
            ),
            PersistedTrainingRangeCoordinateEvidence::Route {
                route_ref: ROUTE_REF.to_owned(),
                kind: TrainingRouteKindView::Primary,
                point_count: 4,
                elapsed_point_count: 3,
                maximum_elapsed_milliseconds: 120_000,
            },
        )),
        evidence: vec![
            route_point(0, 0.0, 10.0, Some(0)),
            route_point(1, 0.001, 12.0, Some(60_000)),
            route_point(2, 0.01, 100.0, None),
            route_point(3, 0.02, 200.0, Some(120_000)),
        ],
    };

    let summary = query_training_session_range_summary(&port, query()).expect("route summary");

    assert_eq!(summary.coverage.selected_evidence_count, 2);
    assert_eq!(summary.coverage.missing_elapsed_evidence_count, 0);
    assert_eq!(
        summary.coverage.state,
        TrainingRangeSummaryCoverageState::Complete
    );
    assert!((summary.distance.expect("route distance").meters - 111.2).abs() < 0.5);
    assert_eq!(summary.measurements[0].maximum, 12.0);
}

#[test]
fn summarizes_one_regular_signal_and_keeps_missing_intervals_visible() {
    let port = ControlledSummaryPort {
        persisted: Ok(persisted(
            range(
                TrainingSessionRangeCoordinate::signal_elapsed(SIGNAL_REF)
                    .expect("signal coordinate"),
                0,
                3_000,
            ),
            PersistedTrainingRangeCoordinateEvidence::Signal {
                signal_ref: SIGNAL_REF.to_owned(),
                ordinal: 0,
                role: TrainingSignalRoleView::Primary,
                kind: TrainingSignalKindView::HeartRate,
                unit: TrainingSignalUnitView::BeatsPerMinute,
                interval_milliseconds: 1_000,
                sample_count: 4,
                available_sample_count: 3,
            },
        )),
        evidence: vec![
            signal_sample(0, Some(100.0)),
            signal_sample(1, None),
            signal_sample(2, Some(120.0)),
            signal_sample(3, Some(130.0)),
        ],
    };

    let summary = query_training_session_range_summary(&port, query()).expect("signal summary");

    assert_eq!(
        summary.coverage.state,
        TrainingRangeSummaryCoverageState::Partial
    );
    assert_eq!(summary.coverage.selected_evidence_count, 3);
    assert_eq!(summary.coverage.available_evidence_count, 2);
    assert_eq!(summary.coverage.missing_evidence_count, 1);
    assert_eq!(summary.coverage.missing_intervals.len(), 1);
    assert_eq!(
        summary.coverage.missing_intervals[0].started_at_elapsed_milliseconds,
        1_000
    );
    assert_eq!(
        summary.coverage.missing_intervals[0].ended_at_elapsed_milliseconds,
        2_000
    );
    assert_eq!(
        summary.boundaries.start.state,
        TrainingRangeBoundaryEvidenceState::Exact
    );
    assert_eq!(
        summary.boundaries.end.state,
        TrainingRangeBoundaryEvidenceState::Exact
    );
    let measurement = &summary.measurements[0];
    assert_eq!(measurement.kind, TrainingSignalKindView::HeartRate);
    assert_eq!(measurement.unit, TrainingSignalUnitView::BeatsPerMinute);
    assert_eq!(measurement.minimum, 100.0);
    assert_eq!(measurement.maximum, 120.0);
    assert_eq!(measurement.average, 110.0);
    assert_eq!(measurement.start_boundary_value, Some(100.0));
    assert_eq!(measurement.end_boundary_value, Some(130.0));
    assert_eq!(summary.independent_evidence.route_coordinate_count, 1);
    assert!(summary
        .limitations
        .contains(&TrainingRangeSummaryLimitation::MissingSignalEvidence));
    assert!(summary
        .limitations
        .contains(&TrainingRangeSummaryLimitation::UnalignedRouteEvidence));
}

#[test]
fn closes_a_trailing_multi_sample_gap_at_the_exclusive_range_boundary() {
    let port = ControlledSummaryPort {
        persisted: Ok(persisted(
            range(
                TrainingSessionRangeCoordinate::signal_elapsed(SIGNAL_REF)
                    .expect("signal coordinate"),
                0,
                3_000,
            ),
            PersistedTrainingRangeCoordinateEvidence::Signal {
                signal_ref: SIGNAL_REF.to_owned(),
                ordinal: 0,
                role: TrainingSignalRoleView::Primary,
                kind: TrainingSignalKindView::HeartRate,
                unit: TrainingSignalUnitView::BeatsPerMinute,
                interval_milliseconds: 1_000,
                sample_count: 4,
                available_sample_count: 2,
            },
        )),
        evidence: vec![
            signal_sample(0, Some(100.0)),
            signal_sample(1, None),
            signal_sample(2, None),
            signal_sample(3, Some(130.0)),
        ],
    };

    let summary = query_training_session_range_summary(&port, query()).expect("signal summary");

    assert_eq!(summary.coverage.missing_intervals.len(), 1);
    assert_eq!(
        summary.coverage.missing_intervals[0].started_at_elapsed_milliseconds,
        1_000
    );
    assert_eq!(
        summary.coverage.missing_intervals[0].ended_at_elapsed_milliseconds,
        3_000
    );
    assert_eq!(summary.coverage.missing_evidence_count, 2);
}

#[test]
fn streams_a_dense_signal_and_bounds_returned_gap_detail() {
    const SAMPLE_COUNT: usize = 100_001;
    let port = DenseSignalSummaryPort {
        persisted: persisted(
            range(
                TrainingSessionRangeCoordinate::signal_elapsed(SIGNAL_REF)
                    .expect("signal coordinate"),
                0,
                100_000_000,
            ),
            PersistedTrainingRangeCoordinateEvidence::Signal {
                signal_ref: SIGNAL_REF.to_owned(),
                ordinal: 0,
                role: TrainingSignalRoleView::Primary,
                kind: TrainingSignalKindView::HeartRate,
                unit: TrainingSignalUnitView::BeatsPerMinute,
                interval_milliseconds: 1_000,
                sample_count: SAMPLE_COUNT,
                available_sample_count: 50_001,
            },
        ),
        sample_count: SAMPLE_COUNT,
    };

    let summary = query_training_session_range_summary(&port, query()).expect("dense summary");

    assert_eq!(summary.coverage.recorded_evidence_count, SAMPLE_COUNT);
    assert_eq!(summary.coverage.selected_evidence_count, 100_000);
    assert_eq!(summary.coverage.available_evidence_count, 50_000);
    assert_eq!(summary.coverage.missing_evidence_count, 50_000);
    assert_eq!(summary.coverage.missing_intervals.len(), 1_000);
    assert_eq!(summary.coverage.omitted_missing_interval_count, 49_000);
    assert_eq!(summary.measurements[0].average, 1.0);
    assert_eq!(summary.boundaries.start.exact_match_count, 1);
    assert_eq!(summary.boundaries.end.exact_match_count, 1);
}

#[test]
fn derives_distance_only_from_exact_boundary_values_of_a_distance_series() {
    let port = ControlledSummaryPort {
        persisted: Ok(persisted(
            range(
                TrainingSessionRangeCoordinate::signal_elapsed(SIGNAL_REF)
                    .expect("signal coordinate"),
                0,
                3_000,
            ),
            PersistedTrainingRangeCoordinateEvidence::Signal {
                signal_ref: SIGNAL_REF.to_owned(),
                ordinal: 0,
                role: TrainingSignalRoleView::Primary,
                kind: TrainingSignalKindView::Distance,
                unit: TrainingSignalUnitView::Meters,
                interval_milliseconds: 1_000,
                sample_count: 4,
                available_sample_count: 4,
            },
        )),
        evidence: vec![
            signal_sample(0, Some(500.0)),
            signal_sample(1, Some(700.0)),
            signal_sample(2, Some(900.0)),
            signal_sample(3, Some(1_100.0)),
        ],
    };

    let summary = query_training_session_range_summary(&port, query()).expect("distance summary");

    assert_eq!(summary.distance.expect("distance delta").meters, 600.0);
    assert_eq!(summary.measurements[0].minimum, 500.0);
    assert_eq!(summary.measurements[0].maximum, 900.0);
    assert_eq!(summary.measurements[0].average, 700.0);
    assert_eq!(summary.measurements[0].end_boundary_value, Some(1_100.0));
}

#[test]
fn reports_non_exact_route_boundaries_without_interpolation() {
    let port = ControlledSummaryPort {
        persisted: Ok(persisted(
            range(
                TrainingSessionRangeCoordinate::route_elapsed(ROUTE_REF).expect("route coordinate"),
                30_000,
                90_000,
            ),
            PersistedTrainingRangeCoordinateEvidence::Route {
                route_ref: ROUTE_REF.to_owned(),
                kind: TrainingRouteKindView::Primary,
                point_count: 3,
                elapsed_point_count: 3,
                maximum_elapsed_milliseconds: 120_000,
            },
        )),
        evidence: vec![
            route_point(0, 0.0, 10.0, Some(0)),
            route_point(1, 0.001, 12.0, Some(60_000)),
            route_point(2, 0.002, 15.0, Some(120_000)),
        ],
    };

    let summary = query_training_session_range_summary(&port, query()).expect("partial route");

    assert_eq!(
        summary.boundaries.start.state,
        TrainingRangeBoundaryEvidenceState::BetweenEvidence
    );
    assert_eq!(
        summary
            .boundaries
            .start
            .preceding
            .as_ref()
            .map(|value| value.elapsed_milliseconds),
        Some(0)
    );
    assert_eq!(
        summary
            .boundaries
            .start
            .following
            .as_ref()
            .map(|value| value.elapsed_milliseconds),
        Some(60_000)
    );
    assert_eq!(
        summary.boundaries.end.state,
        TrainingRangeBoundaryEvidenceState::BetweenEvidence
    );
    assert_eq!(
        summary.coverage.state,
        TrainingRangeSummaryCoverageState::Partial
    );
    assert!(summary.distance.is_none());
    assert!(summary
        .limitations
        .contains(&TrainingRangeSummaryLimitation::BoundaryNotExact));
    assert!(summary
        .limitations
        .contains(&TrainingRangeSummaryLimitation::InsufficientRouteGeometry));
}

#[test]
fn rejects_a_current_signal_range_outside_the_exact_series_extent() {
    let port = ControlledSummaryPort {
        persisted: Ok(persisted(
            range(
                TrainingSessionRangeCoordinate::signal_elapsed(SIGNAL_REF)
                    .expect("signal coordinate"),
                0,
                3_000,
            ),
            PersistedTrainingRangeCoordinateEvidence::Signal {
                signal_ref: SIGNAL_REF.to_owned(),
                ordinal: 0,
                role: TrainingSignalRoleView::Primary,
                kind: TrainingSignalKindView::HeartRate,
                unit: TrainingSignalUnitView::BeatsPerMinute,
                interval_milliseconds: 1_000,
                sample_count: 3,
                available_sample_count: 3,
            },
        )),
        evidence: vec![
            signal_sample(0, Some(100.0)),
            signal_sample(1, Some(110.0)),
            signal_sample(2, Some(120.0)),
        ],
    };

    assert!(matches!(
        query_training_session_range_summary(&port, query()),
        Err(ApplicationError::InvalidTrainingSessionRangeSummary(_))
    ));
}

#[test]
fn rejects_an_exercise_coordinate_extent_that_differs_from_the_owned_exercise() {
    let port = ControlledSummaryPort {
        persisted: Ok(persisted(
            range(
                TrainingSessionRangeCoordinate::exercise_elapsed(),
                0,
                60_000,
            ),
            PersistedTrainingRangeCoordinateEvidence::Exercise {
                maximum_elapsed_milliseconds: 700_000,
            },
        )),
        evidence: Vec::new(),
    };

    assert!(matches!(
        query_training_session_range_summary(&port, query()),
        Err(ApplicationError::InvalidTrainingSessionRangeSummary(_))
    ));
}

#[test]
fn rejects_a_malformed_current_evidence_revision_for_reviewed_authored_evidence() {
    let reviewed_range = TrainingSessionRange::restore(
        RANGE_REF,
        SESSION_REF,
        Some(EXERCISE_REF.to_owned()),
        TrainingSessionRangeCoordinate::exercise_elapsed(),
        "Bridge effort",
        0,
        60_000,
        EVIDENCE_REVISION,
        TrainingSessionRangeAuthorship::User,
        TrainingSessionRangeState::ReviewRequired,
        3,
    )
    .expect("reviewed range");
    let mut context = persisted(
        reviewed_range,
        PersistedTrainingRangeCoordinateEvidence::Exercise {
            maximum_elapsed_milliseconds: 600_000,
        },
    );
    context.evidence_revision = "not-a-range-evidence-capability".to_owned();
    let port = ControlledSummaryPort {
        persisted: Ok(context),
        evidence: Vec::new(),
    };

    assert!(matches!(
        query_training_session_range_summary(&port, query()),
        Err(ApplicationError::InvalidTrainingSessionRangeSummary(_))
    ));
}

#[test]
fn uses_an_exact_source_range_without_turning_it_into_the_persons_range() {
    let port = ControlledSummaryPort {
        persisted: Ok(persisted(
            range(
                TrainingSessionRangeCoordinate::exercise_elapsed(),
                60_000,
                180_000,
            ),
            PersistedTrainingRangeCoordinateEvidence::Exercise {
                maximum_elapsed_milliseconds: 600_000,
            },
        )),
        evidence: Vec::new(),
    };

    let summary = query_training_session_range_summary(&port, query()).expect("structure summary");

    assert_eq!(summary.source_ranges.len(), 2);
    assert_eq!(summary.source_ranges[0].source_range_ref, MANUAL_LAP_REF);
    assert_eq!(
        summary.source_ranges[0].relation,
        TrainingRangeSourceOverlapRelation::Exact
    );
    assert_eq!(summary.source_ranges[1].source_range_ref, AUTOMATIC_LAP_REF);
    assert_eq!(
        summary.source_ranges[1].relation,
        TrainingRangeSourceOverlapRelation::SourceContainsRange
    );
    assert_eq!(summary.distance.expect("source distance").meters, 1_000.0);
    assert_eq!(
        summary.boundaries.start.state,
        TrainingRangeBoundaryEvidenceState::Exact
    );
    assert_eq!(
        summary.boundaries.end.state,
        TrainingRangeBoundaryEvidenceState::Exact
    );
    assert_eq!(
        summary.boundaries.start.exact_matches[0].kind,
        TrainingRangeExactEvidenceKind::ManualLap
    );
    assert_eq!(
        summary.coverage.state,
        TrainingRangeSummaryCoverageState::Complete
    );
    assert_eq!(summary.independent_evidence.route_coordinate_count, 1);
    assert_eq!(summary.independent_evidence.signal_coordinate_count, 2);
    assert!(summary
        .limitations
        .contains(&TrainingRangeSummaryLimitation::UnalignedRouteEvidence));
    assert!(summary
        .limitations
        .contains(&TrainingRangeSummaryLimitation::UnalignedSignalEvidence));
    assert_eq!(summary.range.range_id(), RANGE_REF);
    assert_eq!(
        summary.range.authorship(),
        TrainingSessionRangeAuthorship::User
    );
}

#[test]
fn explains_when_an_exact_source_range_has_no_recorded_distance() {
    let mut context = persisted(
        range(
            TrainingSessionRangeCoordinate::exercise_elapsed(),
            60_000,
            180_000,
        ),
        PersistedTrainingRangeCoordinateEvidence::Exercise {
            maximum_elapsed_milliseconds: 600_000,
        },
    );
    context.exercise.as_mut().expect("exercise").source_ranges[0].distance_meters = None;
    let port = ControlledSummaryPort {
        persisted: Ok(context),
        evidence: Vec::new(),
    };

    let summary = query_training_session_range_summary(&port, query()).expect("structure summary");

    assert!(summary.distance.is_none());
    assert!(summary
        .limitations
        .contains(&TrainingRangeSummaryLimitation::DistanceUnavailable));
}

#[test]
fn explains_when_the_complete_exercise_has_no_recorded_distance() {
    let mut context = persisted(
        range(
            TrainingSessionRangeCoordinate::exercise_elapsed(),
            0,
            600_000,
        ),
        PersistedTrainingRangeCoordinateEvidence::Exercise {
            maximum_elapsed_milliseconds: 600_000,
        },
    );
    context.exercise.as_mut().expect("exercise").distance_meters = None;
    let port = ControlledSummaryPort {
        persisted: Ok(context),
        evidence: Vec::new(),
    };

    let summary = query_training_session_range_summary(&port, query()).expect("structure summary");

    assert!(summary.distance.is_none());
    assert!(summary
        .limitations
        .contains(&TrainingRangeSummaryLimitation::DistanceUnavailable));
}

#[test]
fn refuses_to_choose_between_multiple_exact_source_distances() {
    let mut context = persisted(
        range(
            TrainingSessionRangeCoordinate::exercise_elapsed(),
            60_000,
            180_000,
        ),
        PersistedTrainingRangeCoordinateEvidence::Exercise {
            maximum_elapsed_milliseconds: 600_000,
        },
    );
    let automatic = &mut context.exercise.as_mut().expect("exercise").source_ranges[1];
    automatic.started_at_elapsed_milliseconds = 60_000;
    automatic.ended_at_elapsed_milliseconds = 180_000;
    let port = ControlledSummaryPort {
        persisted: Ok(context),
        evidence: Vec::new(),
    };

    let summary = query_training_session_range_summary(&port, query()).expect("structure summary");

    assert!(summary.distance.is_none());
    assert!(summary
        .limitations
        .contains(&TrainingRangeSummaryLimitation::AmbiguousSourceDistance));
}

#[test]
fn counts_exercise_coverage_in_recorded_boundary_observations() {
    let port = ControlledSummaryPort {
        persisted: Ok(persisted(
            range(
                TrainingSessionRangeCoordinate::exercise_elapsed(),
                10_000,
                20_000,
            ),
            PersistedTrainingRangeCoordinateEvidence::Exercise {
                maximum_elapsed_milliseconds: 600_000,
            },
        )),
        evidence: Vec::new(),
    };

    let summary = query_training_session_range_summary(&port, query()).expect("exercise summary");

    assert_eq!(summary.source_ranges.len(), 1);
    assert_eq!(summary.coverage.recorded_evidence_count, 6);
    assert_eq!(summary.coverage.selected_evidence_count, 0);
    assert_eq!(summary.coverage.available_evidence_count, 0);
}

#[test]
fn preserves_a_review_range_when_its_exact_coordinate_is_no_longer_available() {
    let review_range = TrainingSessionRange::restore(
        RANGE_REF,
        SESSION_REF,
        Some(EXERCISE_REF.to_owned()),
        TrainingSessionRangeCoordinate::route_elapsed(ROUTE_REF).expect("route coordinate"),
        "Bridge effort",
        0,
        120_000,
        "range-evidence-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        TrainingSessionRangeAuthorship::User,
        TrainingSessionRangeState::ReviewRequired,
        3,
    )
    .expect("review range");
    let port = ControlledSummaryPort {
        persisted: Ok(PersistedTrainingSessionRangeSummary {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
            session_ref: SESSION_REF.to_owned(),
            evidence_revision: EVIDENCE_REVISION.to_owned(),
            source_provider: TrainingSourceProviderView::restore("synthetic-provider".to_owned())
                .expect("provider"),
            range: review_range,
            exercise: Some(exercise()),
            coordinate_evidence: PersistedTrainingRangeCoordinateEvidence::Unavailable,
        }),
        evidence: Vec::new(),
    };

    let summary = query_training_session_range_summary(&port, query()).expect("review summary");

    assert_eq!(
        summary.range.state(),
        TrainingSessionRangeState::ReviewRequired
    );
    assert_eq!(
        summary.coverage.state,
        TrainingRangeSummaryCoverageState::Unavailable
    );
    assert_eq!(
        summary.boundaries.start.state,
        TrainingRangeBoundaryEvidenceState::NoEvidence
    );
    assert_eq!(
        summary.boundaries.end.state,
        TrainingRangeBoundaryEvidenceState::NoEvidence
    );
    assert!(summary.distance.is_none());
    assert!(summary.measurements.is_empty());
    assert!(summary
        .limitations
        .contains(&TrainingRangeSummaryLimitation::CoordinateUnavailable));
}

#[test]
fn preserves_a_review_range_when_its_owned_exercise_is_no_longer_available() {
    let review_range = TrainingSessionRange::restore(
        RANGE_REF,
        SESSION_REF,
        Some(EXERCISE_REF.to_owned()),
        TrainingSessionRangeCoordinate::route_elapsed(ROUTE_REF).expect("route coordinate"),
        "Bridge effort",
        0,
        120_000,
        "range-evidence-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        TrainingSessionRangeAuthorship::User,
        TrainingSessionRangeState::ReviewRequired,
        3,
    )
    .expect("review range");
    let port = ControlledSummaryPort {
        persisted: Ok(PersistedTrainingSessionRangeSummary {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
            session_ref: SESSION_REF.to_owned(),
            evidence_revision: EVIDENCE_REVISION.to_owned(),
            source_provider: TrainingSourceProviderView::restore("synthetic-provider".to_owned())
                .expect("provider"),
            range: review_range,
            exercise: None,
            coordinate_evidence: PersistedTrainingRangeCoordinateEvidence::Unavailable,
        }),
        evidence: Vec::new(),
    };

    let summary = query_training_session_range_summary(&port, query()).expect("review summary");

    assert!(summary.exercise.is_none());
    assert!(matches!(
        summary.coordinate_evidence,
        TrainingRangeCoordinateEvidence::Unavailable
    ));
    assert_eq!(
        summary.coverage.state,
        TrainingRangeSummaryCoverageState::Unavailable
    );
}

#[test]
fn preserves_an_unanchored_legacy_range_without_guessing_an_exercise() {
    let legacy_range = TrainingSessionRange::restore(
        RANGE_REF,
        SESSION_REF,
        None,
        TrainingSessionRangeCoordinate::legacy_session_elapsed(),
        "Previously named effort",
        30_000,
        90_000,
        "range-evidence-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        TrainingSessionRangeAuthorship::User,
        TrainingSessionRangeState::ReviewRequired,
        3,
    )
    .expect("legacy range");
    let port = ControlledSummaryPort {
        persisted: Ok(PersistedTrainingSessionRangeSummary {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
            session_ref: SESSION_REF.to_owned(),
            evidence_revision: EVIDENCE_REVISION.to_owned(),
            source_provider: TrainingSourceProviderView::restore("synthetic-provider".to_owned())
                .expect("provider"),
            range: legacy_range,
            exercise: None,
            coordinate_evidence: PersistedTrainingRangeCoordinateEvidence::Unavailable,
        }),
        evidence: Vec::new(),
    };

    let summary = query_training_session_range_summary(&port, query()).expect("legacy summary");

    assert!(summary.exercise.is_none());
    assert!(matches!(
        summary.coordinate_evidence,
        TrainingRangeCoordinateEvidence::Unavailable
    ));
    assert_eq!(
        summary.coverage.state,
        TrainingRangeSummaryCoverageState::Unavailable
    );
    assert_eq!(summary.elapsed_duration_milliseconds, 60_000);
}

#[test]
fn rejects_stale_identity_revision_and_malformed_streams() {
    let mut wrong_identity = persisted(
        range(
            TrainingSessionRangeCoordinate::exercise_elapsed(),
            0,
            60_000,
        ),
        PersistedTrainingRangeCoordinateEvidence::Exercise {
            maximum_elapsed_milliseconds: 600_000,
        },
    );
    wrong_identity.snapshot_ref = concat!(
        "training-snapshot-",
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    )
    .to_owned();
    let port = ControlledSummaryPort {
        persisted: Ok(wrong_identity),
        evidence: Vec::new(),
    };
    assert!(matches!(
        query_training_session_range_summary(&port, query()),
        Err(ApplicationError::TrainingSessionRangeSummaryChanged)
    ));

    let mut wrong_revision = persisted(
        range(
            TrainingSessionRangeCoordinate::exercise_elapsed(),
            0,
            60_000,
        ),
        PersistedTrainingRangeCoordinateEvidence::Exercise {
            maximum_elapsed_milliseconds: 600_000,
        },
    );
    wrong_revision.range = TrainingSessionRange::restore(
        RANGE_REF,
        SESSION_REF,
        Some(EXERCISE_REF.to_owned()),
        TrainingSessionRangeCoordinate::exercise_elapsed(),
        "Bridge effort",
        0,
        60_000,
        EVIDENCE_REVISION,
        TrainingSessionRangeAuthorship::User,
        TrainingSessionRangeState::Current,
        4,
    )
    .expect("different revision");
    let port = ControlledSummaryPort {
        persisted: Ok(wrong_revision),
        evidence: Vec::new(),
    };
    assert!(matches!(
        query_training_session_range_summary(&port, query()),
        Err(ApplicationError::TrainingSessionRangeSummaryChanged)
    ));

    let port = ControlledSummaryPort {
        persisted: Ok(persisted(
            range(
                TrainingSessionRangeCoordinate::route_elapsed(ROUTE_REF).expect("route coordinate"),
                0,
                60_000,
            ),
            PersistedTrainingRangeCoordinateEvidence::Route {
                route_ref: ROUTE_REF.to_owned(),
                kind: TrainingRouteKindView::Primary,
                point_count: 2,
                elapsed_point_count: 2,
                maximum_elapsed_milliseconds: 60_000,
            },
        )),
        evidence: vec![
            route_point(1, 0.001, 12.0, Some(60_000)),
            route_point(0, 0.0, 10.0, Some(0)),
        ],
    };
    assert!(matches!(
        query_training_session_range_summary(&port, query()),
        Err(ApplicationError::InvalidTrainingSessionRangeSummary(_))
    ));
}
