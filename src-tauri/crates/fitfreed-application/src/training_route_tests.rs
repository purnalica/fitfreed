use super::*;

#[derive(Clone)]
struct StubPort {
    routes: Result<PersistedTrainingSessionRoutes, TrainingSessionRoutePortError>,
    points: Result<PersistedTrainingRoutePoints, TrainingSessionRoutePortError>,
}

impl TrainingSessionRoutePort for StubPort {
    fn query_training_session_routes(
        &self,
        _query: &TrainingSessionRouteQuery,
    ) -> Result<PersistedTrainingSessionRoutes, TrainingSessionRoutePortError> {
        self.routes.clone()
    }

    fn query_training_route_points(
        &self,
        _query: &TrainingRoutePointsQuery,
    ) -> Result<PersistedTrainingRoutePoints, TrainingSessionRoutePortError> {
        self.points.clone()
    }
}

fn opaque(prefix: &str, value: char) -> String {
    format!("{prefix}{}", value.to_string().repeat(64))
}

fn point(ordinal: usize) -> TrainingRoutePointView {
    TrainingRoutePointView {
        ordinal,
        latitude_degrees: 40.0 + ordinal as f64 / 100.0,
        longitude_degrees: -3.0 - ordinal as f64 / 100.0,
        altitude_meters: Some(650.0 + ordinal as f64),
        elapsed_milliseconds: Some(ordinal as i64 * 1_000),
    }
}

fn route_query(max_visual_points: usize) -> TrainingSessionRouteQuery {
    TrainingSessionRouteQuery {
        session_ref: opaque("session-", 'a'),
        snapshot_ref: Some(opaque("training-snapshot-", 'b')),
        max_visual_points,
    }
}

fn persisted_routes() -> PersistedTrainingSessionRoutes {
    PersistedTrainingSessionRoutes {
        snapshot_ref: opaque("training-snapshot-", 'b'),
        session_ref: opaque("session-", 'a'),
        routes: Some(TrainingSessionRoutesView {
            exercises: Some(vec![TrainingExerciseRoutesView {
                exercise_ref: opaque("exercise-", 'c'),
                ordinal: 0,
                routes: Some(TrainingRouteCollectionView {
                    primary: Some(TrainingRouteOverview {
                        route_ref: opaque("route-", 'd'),
                        kind: TrainingRouteKindView::Primary,
                        started_at_local: "2026-01-02T10:30:00".to_owned(),
                        point_count: 5,
                        altitude_point_count: 5,
                        elapsed_point_count: 5,
                        visual_points: vec![point(0), point(2), point(4)],
                    }),
                    transition: None,
                }),
            }]),
        }),
    }
}

fn points_query() -> TrainingRoutePointsQuery {
    TrainingRoutePointsQuery {
        session_ref: opaque("session-", 'a'),
        route_ref: opaque("route-", 'd'),
        snapshot_ref: Some(opaque("training-snapshot-", 'b')),
        offset: 2,
        limit: 2,
    }
}

fn persisted_points() -> PersistedTrainingRoutePoints {
    PersistedTrainingRoutePoints {
        snapshot_ref: opaque("training-snapshot-", 'b'),
        session_ref: opaque("session-", 'a'),
        route_ref: opaque("route-", 'd'),
        point_count: 5,
        offset: 2,
        points: vec![point(2), point(3)],
        next_offset: Some(4),
    }
}

fn port() -> StubPort {
    StubPort {
        routes: Ok(persisted_routes()),
        points: Ok(persisted_points()),
    }
}

#[test]
fn returns_a_bounded_endpoint_preserving_route_projection() {
    let result = query_training_session_routes(&port(), route_query(3)).unwrap();
    let exercises = result.routes.unwrap().exercises.unwrap();
    let primary = exercises[0]
        .routes
        .as_ref()
        .unwrap()
        .primary
        .as_ref()
        .unwrap();

    assert_eq!(
        primary
            .visual_points
            .iter()
            .map(|point| point.ordinal)
            .collect::<Vec<_>>(),
        vec![0, 2, 4]
    );
    assert_eq!(primary.point_count, 5);
}

#[test]
fn preserves_every_route_assessment_state() {
    for routes in [
        None,
        Some(TrainingSessionRoutesView { exercises: None }),
        Some(TrainingSessionRoutesView {
            exercises: Some(Vec::new()),
        }),
        Some(TrainingSessionRoutesView {
            exercises: Some(vec![TrainingExerciseRoutesView {
                exercise_ref: opaque("exercise-", 'c'),
                ordinal: 0,
                routes: None,
            }]),
        }),
    ] {
        let mut persisted = persisted_routes();
        persisted.routes = routes.clone();
        let mut stub = port();
        stub.routes = Ok(persisted);
        assert_eq!(
            query_training_session_routes(&stub, route_query(3))
                .unwrap()
                .routes,
            routes
        );
    }
}

#[test]
fn rejects_a_projection_that_is_not_the_documented_source_ordinal_selection() {
    let mut malformed = persisted_routes();
    malformed
        .routes
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .routes
        .as_mut()
        .unwrap()
        .primary
        .as_mut()
        .unwrap()
        .visual_points[1]
        .ordinal = 1;
    let mut stub = port();
    stub.routes = Ok(malformed);

    assert!(matches!(
        query_training_session_routes(&stub, route_query(3)),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));
}

#[test]
fn returns_exact_contiguous_pages_and_rejects_visual_or_pagination_corruption() {
    let result = query_training_route_points(&port(), points_query()).unwrap();
    assert_eq!(
        result
            .points
            .iter()
            .map(|point| point.ordinal)
            .collect::<Vec<_>>(),
        vec![2, 3]
    );
    assert_eq!(result.next_offset, Some(4));

    let mut malformed = persisted_points();
    malformed.points[1].ordinal = 4;
    let mut stub = port();
    stub.points = Ok(malformed);
    assert!(matches!(
        query_training_route_points(&stub, points_query()),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));
}

#[test]
fn keeps_large_processing_pages_out_of_the_interactive_query_contract() {
    let point_count = 251;
    let query = TrainingRoutePointsQuery {
        session_ref: opaque("session-", 'a'),
        route_ref: opaque("route-", 'd'),
        snapshot_ref: Some(opaque("training-snapshot-", 'b')),
        offset: 0,
        limit: point_count,
    };
    let mut stub = port();
    stub.points = Ok(PersistedTrainingRoutePoints {
        snapshot_ref: opaque("training-snapshot-", 'b'),
        session_ref: opaque("session-", 'a'),
        route_ref: opaque("route-", 'd'),
        point_count,
        offset: 0,
        points: (0..point_count).map(point).collect(),
        next_offset: None,
    });

    assert!(matches!(
        query_training_route_points(&stub, query.clone()),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));
    assert_eq!(
        query_training_route_points_for_processing(&stub, query)
            .unwrap()
            .points
            .len(),
        point_count
    );

    let oversized = TrainingRoutePointsQuery {
        limit: MAX_PROCESSING_EXACT_POINTS + 1,
        ..points_query()
    };
    assert!(matches!(
        query_training_route_points_for_processing(&stub, oversized),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));
}

#[test]
fn rejects_invalid_bounds_coordinates_elapsed_order_and_stale_snapshots() {
    assert!(matches!(
        query_training_session_routes(&port(), route_query(1)),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));

    let mut malformed = persisted_routes();
    let points = &mut malformed
        .routes
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .routes
        .as_mut()
        .unwrap()
        .primary
        .as_mut()
        .unwrap()
        .visual_points;
    points[1].latitude_degrees = 91.0;
    let mut stub = port();
    stub.routes = Ok(malformed);
    assert!(matches!(
        query_training_session_routes(&stub, route_query(3)),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));

    let mut elapsed = persisted_routes();
    let points = &mut elapsed.routes.as_mut().unwrap().exercises.as_mut().unwrap()[0]
        .routes
        .as_mut()
        .unwrap()
        .primary
        .as_mut()
        .unwrap()
        .visual_points;
    points[1].elapsed_milliseconds = Some(5_000);
    points[2].elapsed_milliseconds = Some(4_000);
    let mut stub = port();
    stub.routes = Ok(elapsed);
    assert!(matches!(
        query_training_session_routes(&stub, route_query(3)),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));

    let mut stub = port();
    stub.routes = Err(TrainingSessionRoutePortError::SnapshotChanged);
    assert!(matches!(
        query_training_session_routes(&stub, route_query(3)),
        Err(ApplicationError::TrainingSessionDetailChanged)
    ));
}

#[test]
fn validates_bounded_selection_without_overflowing_large_persisted_counts() {
    let mut persisted = persisted_routes();
    let route = persisted
        .routes
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .routes
        .as_mut()
        .unwrap()
        .primary
        .as_mut()
        .unwrap();
    route.point_count = usize::MAX;
    route.altitude_point_count = 0;
    route.elapsed_point_count = 0;
    route.visual_points = vec![
        TrainingRoutePointView {
            ordinal: 0,
            latitude_degrees: 40.0,
            longitude_degrees: -3.0,
            altitude_meters: None,
            elapsed_milliseconds: None,
        },
        TrainingRoutePointView {
            ordinal: usize::MAX / 2,
            latitude_degrees: 40.1,
            longitude_degrees: -3.1,
            altitude_meters: None,
            elapsed_milliseconds: None,
        },
        TrainingRoutePointView {
            ordinal: usize::MAX - 1,
            latitude_degrees: 40.2,
            longitude_degrees: -3.2,
            altitude_meters: None,
            elapsed_milliseconds: None,
        },
    ];
    let mut stub = port();
    stub.routes = Ok(persisted);

    assert!(query_training_session_routes(&stub, route_query(3)).is_ok());
}
