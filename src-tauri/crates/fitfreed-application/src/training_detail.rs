use std::collections::BTreeSet;

use chrono::NaiveDateTime;

use crate::{
    training_discovery::training_session_sport_is_valid, ApplicationError, TrainingSessionSport,
};

const SNAPSHOT_PREFIX: &str = "training-snapshot-";
const SESSION_PREFIX: &str = "session-";
const EXERCISE_PREFIX: &str = "exercise-";
const LAP_PREFIX: &str = "lap-";
const PAUSE_PREFIX: &str = "pause-";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSessionStructureQuery {
    pub session_ref: String,
    pub snapshot_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingLapStructure {
    pub lap_ref: String,
    pub ordinal: usize,
    pub split_time_milliseconds: i64,
    pub duration_milliseconds: i64,
    pub distance_meters: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingPauseStructure {
    pub pause_ref: String,
    pub ordinal: usize,
    pub started_at_local: String,
    pub ended_at_local: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingExerciseStructure {
    pub exercise_ref: String,
    pub ordinal: usize,
    pub started_at_local: String,
    pub stopped_at_local: String,
    pub utc_offset_minutes: Option<i32>,
    pub duration_milliseconds: i64,
    pub distance_meters: Option<f64>,
    pub energy_kilocalories: Option<i64>,
    pub sport: TrainingSessionSport,
    pub manual_laps: Option<Vec<TrainingLapStructure>>,
    pub automatic_laps: Option<Vec<TrainingLapStructure>>,
    pub pauses: Option<Vec<TrainingPauseStructure>>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingStructure {
    pub exercises: Option<Vec<TrainingExerciseStructure>>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedTrainingSessionStructure {
    pub snapshot_ref: String,
    pub session_ref: String,
    pub structure: Option<TrainingStructure>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSessionStructureResult {
    pub snapshot_ref: String,
    pub session_ref: String,
    pub structure: Option<TrainingStructure>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrainingSessionStructurePortError {
    SnapshotChanged,
    NotFound,
    Failure(String),
}

pub trait TrainingSessionStructurePort {
    fn query_training_session_structure(
        &self,
        query: &TrainingSessionStructureQuery,
    ) -> Result<PersistedTrainingSessionStructure, TrainingSessionStructurePortError>;
}

pub fn query_training_session_structure(
    port: &dyn TrainingSessionStructurePort,
    query: TrainingSessionStructureQuery,
) -> Result<TrainingSessionStructureResult, ApplicationError> {
    if !valid_ref(&query.session_ref, SESSION_PREFIX)
        || query
            .snapshot_ref
            .as_deref()
            .is_some_and(|value| !valid_ref(value, SNAPSHOT_PREFIX))
    {
        return invalid("session or snapshot reference is invalid");
    }
    let persisted = port
        .query_training_session_structure(&query)
        .map_err(|error| match error {
            TrainingSessionStructurePortError::SnapshotChanged => {
                ApplicationError::TrainingSessionDetailChanged
            }
            TrainingSessionStructurePortError::NotFound => {
                ApplicationError::TrainingSessionDetail("session was not found".to_owned())
            }
            TrainingSessionStructurePortError::Failure(message) => {
                ApplicationError::TrainingSessionDetail(message)
            }
        })?;
    if persisted.session_ref != query.session_ref
        || !valid_ref(&persisted.snapshot_ref, SNAPSHOT_PREFIX)
        || query
            .snapshot_ref
            .as_ref()
            .is_some_and(|expected| expected != &persisted.snapshot_ref)
    {
        return Err(ApplicationError::TrainingSessionDetailChanged);
    }
    if let Some(structure) = &persisted.structure {
        validate_structure(structure)?;
    }
    Ok(TrainingSessionStructureResult {
        snapshot_ref: persisted.snapshot_ref,
        session_ref: persisted.session_ref,
        structure: persisted.structure,
    })
}

fn validate_structure(structure: &TrainingStructure) -> Result<(), ApplicationError> {
    let Some(exercises) = &structure.exercises else {
        return Ok(());
    };
    let mut exercise_refs = BTreeSet::new();
    let mut lap_refs = BTreeSet::new();
    let mut pause_refs = BTreeSet::new();
    for (ordinal, exercise) in exercises.iter().enumerate() {
        let started = parse_local_datetime(&exercise.started_at_local);
        let stopped = parse_local_datetime(&exercise.stopped_at_local);
        if exercise.ordinal != ordinal
            || !valid_ref(&exercise.exercise_ref, EXERCISE_PREFIX)
            || !exercise_refs.insert(exercise.exercise_ref.as_str())
            || !matches!((started, stopped), (Some(started), Some(stopped)) if started <= stopped)
            || exercise.duration_milliseconds < 0
            || exercise
                .distance_meters
                .is_some_and(|value| !value.is_finite() || value < 0.0)
            || exercise.energy_kilocalories.is_some_and(|value| value < 0)
            || !training_session_sport_is_valid(&exercise.sport)
        {
            return invalid("exercise structure is invalid");
        }
        validate_laps(exercise.manual_laps.as_deref(), &mut lap_refs)?;
        validate_laps(exercise.automatic_laps.as_deref(), &mut lap_refs)?;
        validate_pauses(exercise.pauses.as_deref(), &mut pause_refs)?;
    }
    Ok(())
}

fn validate_laps<'a>(
    laps: Option<&'a [TrainingLapStructure]>,
    refs: &mut BTreeSet<&'a str>,
) -> Result<(), ApplicationError> {
    let Some(laps) = laps else {
        return Ok(());
    };
    for (ordinal, lap) in laps.iter().enumerate() {
        if lap.ordinal != ordinal
            || !valid_ref(&lap.lap_ref, LAP_PREFIX)
            || !refs.insert(lap.lap_ref.as_str())
            || lap.split_time_milliseconds < 0
            || lap.duration_milliseconds < 0
            || lap
                .distance_meters
                .is_some_and(|value| !value.is_finite() || value < 0.0)
        {
            return invalid("lap structure is invalid");
        }
    }
    Ok(())
}

fn validate_pauses<'a>(
    pauses: Option<&'a [TrainingPauseStructure]>,
    refs: &mut BTreeSet<&'a str>,
) -> Result<(), ApplicationError> {
    let Some(pauses) = pauses else {
        return Ok(());
    };
    for (ordinal, pause) in pauses.iter().enumerate() {
        let started = parse_local_datetime(&pause.started_at_local);
        let ended = parse_local_datetime(&pause.ended_at_local);
        if pause.ordinal != ordinal
            || !valid_ref(&pause.pause_ref, PAUSE_PREFIX)
            || !refs.insert(pause.pause_ref.as_str())
            || !matches!((started, ended), (Some(started), Some(ended)) if started <= ended)
        {
            return invalid("pause structure is invalid");
        }
    }
    Ok(())
}

fn parse_local_datetime(value: &str) -> Option<NaiveDateTime> {
    NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S%.f").ok()
}

fn valid_ref(value: &str, prefix: &str) -> bool {
    value.len() == prefix.len() + 64
        && value.starts_with(prefix)
        && value[prefix.len()..]
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
}

fn invalid<T>(message: &'static str) -> Result<T, ApplicationError> {
    Err(ApplicationError::InvalidTrainingSessionDetail(message))
}
