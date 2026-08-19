use std::collections::BTreeSet;

use crate::{training_detail::valid_ref, ApplicationError};

const SNAPSHOT_PREFIX: &str = "training-snapshot-";
const SESSION_PREFIX: &str = "session-";
const EXERCISE_PREFIX: &str = "exercise-";
const ZONE_GROUP_PREFIX: &str = "zone-group-";
const ZONE_PREFIX: &str = "zone-";
const MAX_ZONE_GROUPS: usize = 64;
const MAX_ZONES_PER_GROUP: usize = 256;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSessionZonesQuery {
    pub session_ref: String,
    pub snapshot_ref: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingZoneKindView {
    HeartRate,
    Speed,
    Power,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingZoneUnitView {
    BeatsPerMinute,
    KilometersPerHour,
    Watts,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingZoneView {
    pub zone_ref: String,
    pub ordinal: usize,
    pub lower_limit: f64,
    pub higher_limit: f64,
    pub time_in_zone_milliseconds: Option<i64>,
    pub distance_meters: Option<f64>,
    pub muscle_load: Option<f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingZoneGroupView {
    pub zone_group_ref: String,
    pub ordinal: usize,
    pub kind: TrainingZoneKindView,
    pub unit: TrainingZoneUnitView,
    pub zones: Option<Vec<TrainingZoneView>>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingZoneCollectionView {
    pub groups: Vec<TrainingZoneGroupView>,
    pub unsupported_group_count: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingExerciseZonesView {
    pub exercise_ref: String,
    pub ordinal: usize,
    pub zones: Option<TrainingZoneCollectionView>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSessionZonesView {
    pub exercises: Option<Vec<TrainingExerciseZonesView>>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedTrainingSessionZones {
    pub snapshot_ref: String,
    pub session_ref: String,
    pub zones: Option<TrainingSessionZonesView>,
}

pub type TrainingSessionZonesResult = PersistedTrainingSessionZones;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrainingSessionZonePortError {
    SnapshotChanged,
    NotFound,
    Failure(String),
}

pub trait TrainingSessionZonePort {
    fn query_training_session_zones(
        &self,
        query: &TrainingSessionZonesQuery,
    ) -> Result<PersistedTrainingSessionZones, TrainingSessionZonePortError>;
}

pub fn query_training_session_zones(
    port: &dyn TrainingSessionZonePort,
    query: TrainingSessionZonesQuery,
) -> Result<TrainingSessionZonesResult, ApplicationError> {
    if !valid_ref(&query.session_ref, SESSION_PREFIX)
        || query
            .snapshot_ref
            .as_deref()
            .is_some_and(|value| !valid_ref(value, SNAPSHOT_PREFIX))
    {
        return invalid("session or snapshot reference is invalid");
    }
    let persisted = port
        .query_training_session_zones(&query)
        .map_err(map_port_error)?;
    if persisted.session_ref != query.session_ref
        || !valid_ref(&persisted.snapshot_ref, SNAPSHOT_PREFIX)
        || query
            .snapshot_ref
            .as_ref()
            .is_some_and(|expected| expected != &persisted.snapshot_ref)
    {
        return Err(ApplicationError::TrainingSessionDetailChanged);
    }
    if let Some(zones) = &persisted.zones {
        validate_zones(zones)?;
    }
    Ok(persisted)
}

fn validate_zones(assessment: &TrainingSessionZonesView) -> Result<(), ApplicationError> {
    let Some(exercises) = &assessment.exercises else {
        return Ok(());
    };
    let mut capabilities = BTreeSet::new();
    for (ordinal, exercise) in exercises.iter().enumerate() {
        if exercise.ordinal != ordinal
            || !valid_ref(&exercise.exercise_ref, EXERCISE_PREFIX)
            || !capabilities.insert(exercise.exercise_ref.as_str())
        {
            return invalid("zone exercise context is invalid");
        }
        let Some(zones) = &exercise.zones else {
            continue;
        };
        if zones.groups.len() > MAX_ZONE_GROUPS {
            return invalid("zone group count exceeds the supported bound");
        }
        for (group_ordinal, group) in zones.groups.iter().enumerate() {
            if group.ordinal != group_ordinal
                || !valid_ref(&group.zone_group_ref, ZONE_GROUP_PREFIX)
                || !capabilities.insert(group.zone_group_ref.as_str())
                || !valid_kind_unit(group.kind, group.unit)
            {
                return invalid("zone group is invalid");
            }
            let Some(zone_values) = &group.zones else {
                continue;
            };
            if zone_values.len() > MAX_ZONES_PER_GROUP {
                return invalid("zone count exceeds the supported bound");
            }
            for (zone_ordinal, zone) in zone_values.iter().enumerate() {
                if zone.ordinal != zone_ordinal
                    || !valid_ref(&zone.zone_ref, ZONE_PREFIX)
                    || !capabilities.insert(zone.zone_ref.as_str())
                    || !valid_zone(zone, group.kind)
                {
                    return invalid("zone is invalid");
                }
            }
        }
    }
    Ok(())
}

fn valid_kind_unit(kind: TrainingZoneKindView, unit: TrainingZoneUnitView) -> bool {
    matches!(
        (kind, unit),
        (
            TrainingZoneKindView::HeartRate,
            TrainingZoneUnitView::BeatsPerMinute
        ) | (
            TrainingZoneKindView::Speed,
            TrainingZoneUnitView::KilometersPerHour
        ) | (TrainingZoneKindView::Power, TrainingZoneUnitView::Watts)
    )
}

fn valid_zone(zone: &TrainingZoneView, kind: TrainingZoneKindView) -> bool {
    if !zone.lower_limit.is_finite()
        || zone.lower_limit < 0.0
        || !zone.higher_limit.is_finite()
        || zone.higher_limit < zone.lower_limit
        || zone
            .time_in_zone_milliseconds
            .is_some_and(|value| value < 0)
        || zone
            .distance_meters
            .is_some_and(|value| !value.is_finite() || value < 0.0)
        || zone
            .muscle_load
            .is_some_and(|value| !value.is_finite() || value < 0.0)
    {
        return false;
    }
    match kind {
        TrainingZoneKindView::HeartRate => {
            zone.distance_meters.is_none() && zone.muscle_load.is_none()
        }
        TrainingZoneKindView::Speed => zone.muscle_load.is_none(),
        TrainingZoneKindView::Power => zone.distance_meters.is_none(),
    }
}

fn map_port_error(error: TrainingSessionZonePortError) -> ApplicationError {
    match error {
        TrainingSessionZonePortError::SnapshotChanged => {
            ApplicationError::TrainingSessionDetailChanged
        }
        TrainingSessionZonePortError::NotFound => {
            ApplicationError::TrainingSessionDetail("zone evidence was not found".to_owned())
        }
        TrainingSessionZonePortError::Failure(message) => {
            ApplicationError::TrainingSessionDetail(message)
        }
    }
}

fn invalid<T>(message: &'static str) -> Result<T, ApplicationError> {
    Err(ApplicationError::InvalidTrainingSessionDetail(message))
}
