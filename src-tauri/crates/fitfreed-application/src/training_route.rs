use std::collections::BTreeSet;

use crate::{
    training_detail::{parse_local_datetime, valid_ref},
    ApplicationError,
};

const SNAPSHOT_PREFIX: &str = "training-snapshot-";
const SESSION_PREFIX: &str = "session-";
const EXERCISE_PREFIX: &str = "exercise-";
const ROUTE_PREFIX: &str = "route-";
const MIN_VISUAL_POINTS: usize = 2;
const MAX_VISUAL_POINTS: usize = 500;
const MAX_EXACT_POINTS: usize = 250;
pub(crate) const MAX_PROCESSING_EXACT_POINTS: usize = 10_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSessionRouteQuery {
    pub session_ref: String,
    pub snapshot_ref: Option<String>,
    pub max_visual_points: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingRouteKindView {
    Primary,
    Transition,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingRoutePointView {
    pub ordinal: usize,
    pub latitude_degrees: f64,
    pub longitude_degrees: f64,
    pub altitude_meters: Option<f64>,
    pub elapsed_milliseconds: Option<i64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingRouteOverview {
    pub route_ref: String,
    pub kind: TrainingRouteKindView,
    pub started_at_local: String,
    pub point_count: usize,
    pub altitude_point_count: usize,
    pub elapsed_point_count: usize,
    pub visual_points: Vec<TrainingRoutePointView>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingRouteCollectionView {
    pub primary: Option<TrainingRouteOverview>,
    pub transition: Option<TrainingRouteOverview>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingExerciseRoutesView {
    pub exercise_ref: String,
    pub ordinal: usize,
    pub routes: Option<TrainingRouteCollectionView>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSessionRoutesView {
    pub exercises: Option<Vec<TrainingExerciseRoutesView>>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedTrainingSessionRoutes {
    pub snapshot_ref: String,
    pub session_ref: String,
    pub routes: Option<TrainingSessionRoutesView>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSessionRoutesResult {
    pub snapshot_ref: String,
    pub session_ref: String,
    pub routes: Option<TrainingSessionRoutesView>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingRoutePointsQuery {
    pub session_ref: String,
    pub route_ref: String,
    pub snapshot_ref: Option<String>,
    pub offset: usize,
    pub limit: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedTrainingRoutePoints {
    pub snapshot_ref: String,
    pub session_ref: String,
    pub route_ref: String,
    pub point_count: usize,
    pub offset: usize,
    pub points: Vec<TrainingRoutePointView>,
    pub next_offset: Option<usize>,
}

pub type TrainingRoutePointsResult = PersistedTrainingRoutePoints;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrainingSessionRoutePortError {
    SnapshotChanged,
    NotFound,
    Failure(String),
}

pub trait TrainingSessionRoutePort {
    fn query_training_session_routes(
        &self,
        query: &TrainingSessionRouteQuery,
    ) -> Result<PersistedTrainingSessionRoutes, TrainingSessionRoutePortError>;

    fn query_training_route_points(
        &self,
        query: &TrainingRoutePointsQuery,
    ) -> Result<PersistedTrainingRoutePoints, TrainingSessionRoutePortError>;
}

pub fn query_training_session_routes(
    port: &dyn TrainingSessionRoutePort,
    query: TrainingSessionRouteQuery,
) -> Result<TrainingSessionRoutesResult, ApplicationError> {
    validate_common_query(&query.session_ref, query.snapshot_ref.as_deref())?;
    if !(MIN_VISUAL_POINTS..=MAX_VISUAL_POINTS).contains(&query.max_visual_points) {
        return invalid("route visual point bound is invalid");
    }
    let persisted = port
        .query_training_session_routes(&query)
        .map_err(map_port_error)?;
    validate_result_identity(
        &query.session_ref,
        query.snapshot_ref.as_deref(),
        &persisted.session_ref,
        &persisted.snapshot_ref,
    )?;
    if let Some(routes) = &persisted.routes {
        validate_routes(routes, query.max_visual_points)?;
    }
    Ok(TrainingSessionRoutesResult {
        snapshot_ref: persisted.snapshot_ref,
        session_ref: persisted.session_ref,
        routes: persisted.routes,
    })
}

pub fn query_training_route_points(
    port: &dyn TrainingSessionRoutePort,
    query: TrainingRoutePointsQuery,
) -> Result<TrainingRoutePointsResult, ApplicationError> {
    query_training_route_points_with_limit(port, query, MAX_EXACT_POINTS)
}

pub(crate) fn query_training_route_points_for_processing(
    port: &dyn TrainingSessionRoutePort,
    query: TrainingRoutePointsQuery,
) -> Result<TrainingRoutePointsResult, ApplicationError> {
    query_training_route_points_with_limit(port, query, MAX_PROCESSING_EXACT_POINTS)
}

fn query_training_route_points_with_limit(
    port: &dyn TrainingSessionRoutePort,
    query: TrainingRoutePointsQuery,
    maximum_limit: usize,
) -> Result<TrainingRoutePointsResult, ApplicationError> {
    validate_common_query(&query.session_ref, query.snapshot_ref.as_deref())?;
    if !valid_ref(&query.route_ref, ROUTE_PREFIX) || query.limit == 0 || query.limit > maximum_limit
    {
        return invalid("exact route point query is invalid");
    }
    let persisted = port
        .query_training_route_points(&query)
        .map_err(map_port_error)?;
    validate_result_identity(
        &query.session_ref,
        query.snapshot_ref.as_deref(),
        &persisted.session_ref,
        &persisted.snapshot_ref,
    )?;
    if persisted.route_ref != query.route_ref || persisted.offset != query.offset {
        return invalid("exact route point identity is inconsistent");
    }
    let expected_count = query
        .limit
        .min(persisted.point_count.saturating_sub(query.offset));
    if persisted.points.len() != expected_count {
        return invalid("exact route point page size is inconsistent");
    }
    for (index, point) in persisted.points.iter().enumerate() {
        if point.ordinal != query.offset + index || !valid_point(point) {
            return invalid("exact route point page is invalid");
        }
    }
    validate_elapsed_order(&persisted.points)?;
    let expected_next = (query.offset + persisted.points.len() < persisted.point_count)
        .then_some(query.offset + persisted.points.len());
    if persisted.next_offset != expected_next {
        return invalid("exact route point continuation is inconsistent");
    }
    Ok(persisted)
}

fn validate_common_query(
    session_ref: &str,
    snapshot_ref: Option<&str>,
) -> Result<(), ApplicationError> {
    if !valid_ref(session_ref, SESSION_PREFIX)
        || snapshot_ref.is_some_and(|value| !valid_ref(value, SNAPSHOT_PREFIX))
    {
        return invalid("session or snapshot reference is invalid");
    }
    Ok(())
}

fn validate_result_identity(
    requested_session_ref: &str,
    requested_snapshot_ref: Option<&str>,
    session_ref: &str,
    snapshot_ref: &str,
) -> Result<(), ApplicationError> {
    if session_ref != requested_session_ref
        || !valid_ref(snapshot_ref, SNAPSHOT_PREFIX)
        || requested_snapshot_ref.is_some_and(|expected| expected != snapshot_ref)
    {
        return Err(ApplicationError::TrainingSessionDetailChanged);
    }
    Ok(())
}

fn validate_routes(
    assessment: &TrainingSessionRoutesView,
    max_visual_points: usize,
) -> Result<(), ApplicationError> {
    let Some(exercises) = &assessment.exercises else {
        return Ok(());
    };
    let mut exercise_refs = BTreeSet::new();
    let mut route_refs = BTreeSet::new();
    for (ordinal, exercise) in exercises.iter().enumerate() {
        if exercise.ordinal != ordinal
            || !valid_ref(&exercise.exercise_ref, EXERCISE_PREFIX)
            || !exercise_refs.insert(exercise.exercise_ref.as_str())
        {
            return invalid("route exercise context is invalid");
        }
        let Some(routes) = &exercise.routes else {
            continue;
        };
        validate_route(
            routes.primary.as_ref(),
            TrainingRouteKindView::Primary,
            max_visual_points,
            &mut route_refs,
        )?;
        validate_route(
            routes.transition.as_ref(),
            TrainingRouteKindView::Transition,
            max_visual_points,
            &mut route_refs,
        )?;
    }
    Ok(())
}

fn validate_route<'a>(
    route: Option<&'a TrainingRouteOverview>,
    expected_kind: TrainingRouteKindView,
    max_visual_points: usize,
    route_refs: &mut BTreeSet<&'a str>,
) -> Result<(), ApplicationError> {
    let Some(route) = route else {
        return Ok(());
    };
    let expected_visual_count = route.point_count.min(max_visual_points);
    if route.kind != expected_kind
        || !valid_ref(&route.route_ref, ROUTE_PREFIX)
        || !route_refs.insert(route.route_ref.as_str())
        || parse_local_datetime(&route.started_at_local).is_none()
        || route.altitude_point_count > route.point_count
        || route.elapsed_point_count > route.point_count
        || route.visual_points.len() != expected_visual_count
    {
        return invalid("route overview is invalid");
    }
    for (index, point) in route.visual_points.iter().enumerate() {
        let expected_ordinal = selected_ordinal(route.point_count, expected_visual_count, index);
        if point.ordinal != expected_ordinal || !valid_point(point) {
            return invalid("route visual projection is invalid");
        }
    }
    validate_elapsed_order(&route.visual_points)
}

fn selected_ordinal(point_count: usize, selected_count: usize, index: usize) -> usize {
    if selected_count <= 1 {
        0
    } else {
        ((index as u128 * (point_count - 1) as u128) / (selected_count - 1) as u128) as usize
    }
}

fn valid_point(point: &TrainingRoutePointView) -> bool {
    point.latitude_degrees.is_finite()
        && (-90.0..=90.0).contains(&point.latitude_degrees)
        && point.longitude_degrees.is_finite()
        && (-180.0..=180.0).contains(&point.longitude_degrees)
        && point.altitude_meters.is_none_or(f64::is_finite)
        && point.elapsed_milliseconds.is_none_or(|value| value >= 0)
}

fn validate_elapsed_order(points: &[TrainingRoutePointView]) -> Result<(), ApplicationError> {
    let mut previous = None;
    for elapsed in points.iter().filter_map(|point| point.elapsed_milliseconds) {
        if previous.is_some_and(|value| elapsed < value) {
            return invalid("route elapsed offsets are not ordered");
        }
        previous = Some(elapsed);
    }
    Ok(())
}

fn map_port_error(error: TrainingSessionRoutePortError) -> ApplicationError {
    match error {
        TrainingSessionRoutePortError::SnapshotChanged => {
            ApplicationError::TrainingSessionDetailChanged
        }
        TrainingSessionRoutePortError::NotFound => {
            ApplicationError::TrainingSessionDetail("route evidence was not found".to_owned())
        }
        TrainingSessionRoutePortError::Failure(message) => {
            ApplicationError::TrainingSessionDetail(message)
        }
    }
}

fn invalid<T>(message: &'static str) -> Result<T, ApplicationError> {
    Err(ApplicationError::InvalidTrainingSessionDetail(message))
}
