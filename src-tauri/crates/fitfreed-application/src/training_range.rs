use std::collections::{BTreeMap, BTreeSet};

use fitfreed_domain::{
    adjust_training_session_range as adjust_range, remove_training_session_range as remove_range,
    rename_training_session_range as rename_range, RemovedTrainingSessionRange,
    TrainingSessionRange, TrainingSessionRangeCoordinate, TrainingSessionRangeCoordinateScope,
    TrainingSessionRangeError, TrainingSessionRangeState,
};
use thiserror::Error;

use crate::{training_detail::valid_ref, ApplicationError};

const SNAPSHOT_PREFIX: &str = "training-snapshot-";
const SESSION_PREFIX: &str = "session-";
const EXERCISE_PREFIX: &str = "exercise-";
const RANGE_PREFIX: &str = "range-";
const EVIDENCE_REVISION_PREFIX: &str = "range-evidence-";
const MAX_SESSION_RANGES: usize = 1_000;
const MAX_SESSION_RANGE_EXERCISES: usize = 1_000;
const MAX_EXERCISE_RANGE_COORDINATES: usize = 1_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSessionRangesQuery {
    pub session_ref: String,
    pub snapshot_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PersistedTrainingSessionRanges {
    pub snapshot_ref: String,
    pub session_ref: String,
    pub session_duration_milliseconds: i64,
    pub evidence_revision: String,
    pub exercises: Vec<TrainingSessionRangeExerciseContext>,
    pub ranges: Vec<TrainingSessionRange>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSessionRangeExerciseContext {
    pub exercise_ref: String,
    pub ordinal: usize,
    pub coordinates: Vec<TrainingSessionRangeCoordinateContext>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSessionRangeCoordinateContext {
    pub coordinate: TrainingSessionRangeCoordinate,
    pub maximum_elapsed_milliseconds: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSessionRangesResult {
    pub snapshot_ref: String,
    pub session_ref: String,
    pub session_duration_milliseconds: i64,
    pub evidence_revision: String,
    pub exercises: Vec<TrainingSessionRangeExerciseContext>,
    pub ranges: Vec<TrainingSessionRange>,
}

#[derive(Debug, Clone, Error, PartialEq, Eq)]
pub enum TrainingSessionRangePortError {
    #[error("training-session range snapshot changed")]
    SnapshotChanged,
    #[error("training-session range or owner was not found")]
    NotFound,
    #[error("training-session range revision conflicted")]
    Conflict,
    #[error("training-session range identity already exists")]
    AlreadyExists,
    #[error("training-session range persistence failed: {0}")]
    Failure(String),
}

pub trait TrainingSessionRangePort {
    fn query_training_session_ranges(
        &self,
        query: &TrainingSessionRangesQuery,
    ) -> Result<PersistedTrainingSessionRanges, TrainingSessionRangePortError>;

    fn new_training_session_range_id(&self) -> Result<String, TrainingSessionRangePortError>;

    fn create_training_session_range(
        &self,
        snapshot_ref: &str,
        range: &TrainingSessionRange,
    ) -> Result<PersistedTrainingSessionRanges, TrainingSessionRangePortError>;

    fn compare_and_save_training_session_range(
        &self,
        snapshot_ref: &str,
        expected_revision: u64,
        range: &TrainingSessionRange,
    ) -> Result<Option<PersistedTrainingSessionRanges>, TrainingSessionRangePortError>;

    fn compare_and_remove_training_session_range(
        &self,
        snapshot_ref: &str,
        removal: &RemovedTrainingSessionRange,
    ) -> Result<Option<PersistedTrainingSessionRanges>, TrainingSessionRangePortError>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateTrainingSessionRangeRequest {
    pub session_ref: String,
    pub snapshot_ref: String,
    pub exercise_ref: String,
    pub coordinate: TrainingSessionRangeCoordinate,
    pub title: String,
    pub started_at_elapsed_milliseconds: i64,
    pub ended_at_elapsed_milliseconds: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenameTrainingSessionRangeRequest {
    pub session_ref: String,
    pub snapshot_ref: String,
    pub range_ref: String,
    pub expected_revision: u64,
    pub title: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdjustTrainingSessionRangeRequest {
    pub session_ref: String,
    pub snapshot_ref: String,
    pub range_ref: String,
    pub expected_revision: u64,
    pub exercise_ref: String,
    pub coordinate: TrainingSessionRangeCoordinate,
    pub started_at_elapsed_milliseconds: i64,
    pub ended_at_elapsed_milliseconds: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemoveTrainingSessionRangeRequest {
    pub session_ref: String,
    pub snapshot_ref: String,
    pub range_ref: String,
    pub expected_revision: u64,
}

pub fn query_training_session_ranges(
    port: &dyn TrainingSessionRangePort,
    query: TrainingSessionRangesQuery,
) -> Result<TrainingSessionRangesResult, ApplicationError> {
    validate_query(&query)?;
    let persisted = port
        .query_training_session_ranges(&query)
        .map_err(map_query_error)?;
    build_result(&query, persisted)
}

pub fn create_training_session_range(
    port: &dyn TrainingSessionRangePort,
    request: CreateTrainingSessionRangeRequest,
) -> Result<TrainingSessionRangesResult, ApplicationError> {
    let query = mutation_query(&request.session_ref, &request.snapshot_ref, None, None)?;
    validate_exercise_ref(&request.exercise_ref)?;
    let current = load_context(port, &query)?;
    let exercise = find_exercise(&current, &request.exercise_ref)?;
    let coordinate = find_coordinate(exercise, &request.coordinate)?;
    let range_id = port
        .new_training_session_range_id()
        .map_err(map_update_error)?;
    let range = TrainingSessionRange::create(
        range_id,
        &request.session_ref,
        &request.exercise_ref,
        request.coordinate,
        &request.title,
        request.started_at_elapsed_milliseconds,
        request.ended_at_elapsed_milliseconds,
        coordinate.maximum_elapsed_milliseconds,
        &current.evidence_revision,
    )
    .map_err(invalid_range)?;
    let persisted = port
        .create_training_session_range(&request.snapshot_ref, &range)
        .map_err(map_update_error)?;
    let result = build_result(&query, persisted).map_err(as_update_error)?;
    if !result.ranges.iter().any(|saved| saved == &range) {
        return update_failed("created range is absent from the committed result");
    }
    Ok(result)
}

pub fn rename_training_session_range(
    port: &dyn TrainingSessionRangePort,
    request: RenameTrainingSessionRangeRequest,
) -> Result<TrainingSessionRangesResult, ApplicationError> {
    let query = mutation_query(
        &request.session_ref,
        &request.snapshot_ref,
        Some(&request.range_ref),
        Some(request.expected_revision),
    )?;
    let current = load_context(port, &query)?;
    let existing = find_expected_range(&current, &request.range_ref, request.expected_revision)?;
    let revised = rename_range(existing, &request.title).map_err(invalid_range)?;
    if &revised == existing {
        return build_result(&query, current);
    }
    save_revised_range(port, &query, request.expected_revision, revised)
}

pub fn adjust_training_session_range(
    port: &dyn TrainingSessionRangePort,
    request: AdjustTrainingSessionRangeRequest,
) -> Result<TrainingSessionRangesResult, ApplicationError> {
    let query = mutation_query(
        &request.session_ref,
        &request.snapshot_ref,
        Some(&request.range_ref),
        Some(request.expected_revision),
    )?;
    validate_exercise_ref(&request.exercise_ref)?;
    let current = load_context(port, &query)?;
    let existing = find_expected_range(&current, &request.range_ref, request.expected_revision)?;
    let exercise = find_exercise(&current, &request.exercise_ref)?;
    let coordinate = find_coordinate(exercise, &request.coordinate)?;
    let revised = adjust_range(
        existing,
        &request.exercise_ref,
        request.coordinate,
        request.started_at_elapsed_milliseconds,
        request.ended_at_elapsed_milliseconds,
        coordinate.maximum_elapsed_milliseconds,
        &current.evidence_revision,
    )
    .map_err(invalid_range)?;
    if &revised == existing {
        return build_result(&query, current);
    }
    save_revised_range(port, &query, request.expected_revision, revised)
}

pub fn remove_training_session_range(
    port: &dyn TrainingSessionRangePort,
    request: RemoveTrainingSessionRangeRequest,
) -> Result<TrainingSessionRangesResult, ApplicationError> {
    let query = mutation_query(
        &request.session_ref,
        &request.snapshot_ref,
        Some(&request.range_ref),
        Some(request.expected_revision),
    )?;
    let current = load_context(port, &query)?;
    let existing = find_expected_range(&current, &request.range_ref, request.expected_revision)?;
    let removal = remove_range(existing).map_err(invalid_range)?;
    let Some(persisted) = port
        .compare_and_remove_training_session_range(&request.snapshot_ref, &removal)
        .map_err(map_update_error)?
    else {
        return Err(ApplicationError::TrainingSessionRangeConflict);
    };
    let result = build_result(&query, persisted).map_err(as_update_error)?;
    if result
        .ranges
        .iter()
        .any(|range| range.range_id() == request.range_ref)
    {
        return update_failed("removed range remains in the committed result");
    }
    Ok(result)
}

fn save_revised_range(
    port: &dyn TrainingSessionRangePort,
    query: &TrainingSessionRangesQuery,
    expected_revision: u64,
    revised: TrainingSessionRange,
) -> Result<TrainingSessionRangesResult, ApplicationError> {
    let snapshot_ref =
        query
            .snapshot_ref
            .as_deref()
            .ok_or(ApplicationError::InvalidTrainingSessionRange(
                "range mutation snapshot is missing",
            ))?;
    let Some(persisted) = port
        .compare_and_save_training_session_range(snapshot_ref, expected_revision, &revised)
        .map_err(map_update_error)?
    else {
        return Err(ApplicationError::TrainingSessionRangeConflict);
    };
    let result = build_result(query, persisted).map_err(as_update_error)?;
    if !result.ranges.iter().any(|saved| saved == &revised) {
        return update_failed("revised range is absent from the committed result");
    }
    Ok(result)
}

fn load_context(
    port: &dyn TrainingSessionRangePort,
    query: &TrainingSessionRangesQuery,
) -> Result<PersistedTrainingSessionRanges, ApplicationError> {
    let persisted = port
        .query_training_session_ranges(query)
        .map_err(map_query_error)?;
    validate_persisted(query, &persisted)?;
    Ok(persisted)
}

fn find_expected_range<'a>(
    persisted: &'a PersistedTrainingSessionRanges,
    range_ref: &str,
    expected_revision: u64,
) -> Result<&'a TrainingSessionRange, ApplicationError> {
    let existing = persisted
        .ranges
        .iter()
        .find(|range| range.range_id() == range_ref)
        .ok_or(ApplicationError::TrainingSessionRangeNotFound)?;
    if existing.revision() != expected_revision {
        return Err(ApplicationError::TrainingSessionRangeConflict);
    }
    Ok(existing)
}

fn build_result(
    query: &TrainingSessionRangesQuery,
    mut persisted: PersistedTrainingSessionRanges,
) -> Result<TrainingSessionRangesResult, ApplicationError> {
    validate_persisted(query, &persisted)?;
    let exercise_ordinals = persisted
        .exercises
        .iter()
        .map(|exercise| (exercise.exercise_ref.as_str(), exercise.ordinal))
        .collect::<BTreeMap<_, _>>();
    persisted.ranges.sort_by(|left, right| {
        left.exercise_ref()
            .and_then(|exercise_ref| exercise_ordinals.get(exercise_ref).copied())
            .unwrap_or(usize::MAX)
            .cmp(
                &right
                    .exercise_ref()
                    .and_then(|exercise_ref| exercise_ordinals.get(exercise_ref).copied())
                    .unwrap_or(usize::MAX),
            )
            .then_with(|| left.coordinate().cmp(right.coordinate()))
            .then_with(|| {
                left.started_at_elapsed_milliseconds()
                    .cmp(&right.started_at_elapsed_milliseconds())
            })
            .then_with(|| {
                left.ended_at_elapsed_milliseconds()
                    .cmp(&right.ended_at_elapsed_milliseconds())
            })
            .then_with(|| left.title().cmp(right.title()))
            .then_with(|| left.range_id().cmp(right.range_id()))
    });
    Ok(TrainingSessionRangesResult {
        snapshot_ref: persisted.snapshot_ref,
        session_ref: persisted.session_ref,
        session_duration_milliseconds: persisted.session_duration_milliseconds,
        evidence_revision: persisted.evidence_revision,
        exercises: persisted.exercises,
        ranges: persisted.ranges,
    })
}

fn validate_query(query: &TrainingSessionRangesQuery) -> Result<(), ApplicationError> {
    if !valid_ref(&query.session_ref, SESSION_PREFIX)
        || query
            .snapshot_ref
            .as_deref()
            .is_some_and(|snapshot_ref| !valid_ref(snapshot_ref, SNAPSHOT_PREFIX))
    {
        return invalid("range session or snapshot reference is invalid");
    }
    Ok(())
}

fn mutation_query(
    session_ref: &str,
    snapshot_ref: &str,
    range_ref: Option<&str>,
    expected_revision: Option<u64>,
) -> Result<TrainingSessionRangesQuery, ApplicationError> {
    let query = TrainingSessionRangesQuery {
        session_ref: session_ref.to_owned(),
        snapshot_ref: Some(snapshot_ref.to_owned()),
    };
    validate_query(&query)?;
    if range_ref.is_some_and(|range_ref| !valid_ref(range_ref, RANGE_PREFIX)) {
        return invalid("range reference is invalid");
    }
    if expected_revision.is_some_and(|revision| revision == 0) {
        return invalid("range expected revision is zero");
    }
    Ok(query)
}

fn validate_exercise_ref(exercise_ref: &str) -> Result<(), ApplicationError> {
    if !valid_ref(exercise_ref, EXERCISE_PREFIX) {
        return invalid("range exercise reference is invalid");
    }
    Ok(())
}

fn find_exercise<'a>(
    persisted: &'a PersistedTrainingSessionRanges,
    exercise_ref: &str,
) -> Result<&'a TrainingSessionRangeExerciseContext, ApplicationError> {
    persisted
        .exercises
        .iter()
        .find(|exercise| exercise.exercise_ref == exercise_ref)
        .ok_or(ApplicationError::TrainingSessionRangeNotFound)
}

fn find_coordinate<'a>(
    exercise: &'a TrainingSessionRangeExerciseContext,
    coordinate: &TrainingSessionRangeCoordinate,
) -> Result<&'a TrainingSessionRangeCoordinateContext, ApplicationError> {
    exercise
        .coordinates
        .iter()
        .find(|context| &context.coordinate == coordinate)
        .ok_or(ApplicationError::TrainingSessionRangeNotFound)
}

fn validate_persisted(
    query: &TrainingSessionRangesQuery,
    persisted: &PersistedTrainingSessionRanges,
) -> Result<(), ApplicationError> {
    if persisted.session_ref != query.session_ref
        || !valid_ref(&persisted.snapshot_ref, SNAPSHOT_PREFIX)
        || query
            .snapshot_ref
            .as_deref()
            .is_some_and(|expected| expected != persisted.snapshot_ref)
    {
        return Err(ApplicationError::TrainingSessionRangesChanged);
    }
    if persisted.session_duration_milliseconds < 0
        || !valid_ref(&persisted.evidence_revision, EVIDENCE_REVISION_PREFIX)
        || persisted.exercises.len() > MAX_SESSION_RANGE_EXERCISES
        || persisted.ranges.len() > MAX_SESSION_RANGES
    {
        return query_failed("range context is invalid or exceeds its bound");
    }
    let mut exercise_refs = BTreeSet::new();
    let mut exercise_ordinals = BTreeSet::new();
    for exercise in &persisted.exercises {
        if !valid_ref(&exercise.exercise_ref, EXERCISE_PREFIX)
            || !exercise_refs.insert(exercise.exercise_ref.as_str())
            || !exercise_ordinals.insert(exercise.ordinal)
            || exercise.coordinates.is_empty()
            || exercise.coordinates.len() > MAX_EXERCISE_RANGE_COORDINATES
        {
            return query_failed("range exercise context is invalid");
        }
        let mut coordinates = BTreeSet::new();
        for coordinate in &exercise.coordinates {
            if coordinate.maximum_elapsed_milliseconds < 0
                || coordinate.coordinate.scope()
                    == TrainingSessionRangeCoordinateScope::LegacySessionElapsed
                || !coordinates.insert(&coordinate.coordinate)
            {
                return query_failed("range coordinate context is invalid");
            }
        }
        if !coordinates.contains(&TrainingSessionRangeCoordinate::exercise_elapsed()) {
            return query_failed("range exercise coordinate is missing");
        }
    }
    let mut identities = BTreeSet::new();
    for range in &persisted.ranges {
        let coordinate_maximum = range.exercise_ref().and_then(|range_exercise_ref| {
            persisted
                .exercises
                .iter()
                .find(|exercise| exercise.exercise_ref == range_exercise_ref)
                .and_then(|exercise| {
                    exercise
                        .coordinates
                        .iter()
                        .find(|context| context.coordinate == *range.coordinate())
                        .map(|context| context.maximum_elapsed_milliseconds)
                })
        });
        if range.session_ref() != persisted.session_ref
            || range.evidence_revision() != persisted.evidence_revision
            || !identities.insert(range.range_id())
            || (range.state() == TrainingSessionRangeState::Current
                && !coordinate_maximum
                    .is_some_and(|maximum| range.ended_at_elapsed_milliseconds() <= maximum))
        {
            return query_failed("range result is inconsistent with current session evidence");
        }
    }
    Ok(())
}

fn map_query_error(error: TrainingSessionRangePortError) -> ApplicationError {
    match error {
        TrainingSessionRangePortError::SnapshotChanged => {
            ApplicationError::TrainingSessionRangesChanged
        }
        TrainingSessionRangePortError::NotFound => ApplicationError::TrainingSessionRangeNotFound,
        TrainingSessionRangePortError::Conflict => ApplicationError::TrainingSessionRangeConflict,
        TrainingSessionRangePortError::AlreadyExists => {
            ApplicationError::TrainingSessionRangeQuery(
                "range query reported an identifier collision".to_owned(),
            )
        }
        TrainingSessionRangePortError::Failure(reason) => {
            ApplicationError::TrainingSessionRangeQuery(reason)
        }
    }
}

fn map_update_error(error: TrainingSessionRangePortError) -> ApplicationError {
    match error {
        TrainingSessionRangePortError::Failure(reason) => {
            ApplicationError::TrainingSessionRangeUpdate(reason)
        }
        TrainingSessionRangePortError::AlreadyExists => {
            ApplicationError::TrainingSessionRangeUpdate(
                "generated range identifier already exists".to_owned(),
            )
        }
        other => map_query_error(other),
    }
}

fn as_update_error(error: ApplicationError) -> ApplicationError {
    match error {
        ApplicationError::TrainingSessionRangeQuery(reason) => {
            ApplicationError::TrainingSessionRangeUpdate(reason)
        }
        other => other,
    }
}

fn invalid_range(_error: TrainingSessionRangeError) -> ApplicationError {
    ApplicationError::InvalidTrainingSessionRange("range definition is invalid")
}

fn invalid<T>(reason: &'static str) -> Result<T, ApplicationError> {
    Err(ApplicationError::InvalidTrainingSessionRange(reason))
}

fn query_failed<T>(reason: &'static str) -> Result<T, ApplicationError> {
    Err(ApplicationError::TrainingSessionRangeQuery(
        reason.to_owned(),
    ))
}

fn update_failed<T>(reason: &'static str) -> Result<T, ApplicationError> {
    Err(ApplicationError::TrainingSessionRangeUpdate(
        reason.to_owned(),
    ))
}
