use crate::{ReconciliationDecision, RevisionOrder, TrainingSession};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingLapKind {
    Manual,
    Automatic,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingLap {
    pub kind: TrainingLapKind,
    pub ordinal: usize,
    pub split_time_milliseconds: i64,
    pub duration_milliseconds: i64,
    pub distance_meters: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingPause {
    pub ordinal: usize,
    pub started_at_local: String,
    pub ended_at_local: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingExercise {
    pub exercise_id: String,
    pub ordinal: usize,
    pub started_at_local: String,
    pub stopped_at_local: String,
    pub utc_offset_minutes: Option<i32>,
    pub duration_milliseconds: i64,
    pub distance_meters: Option<f64>,
    pub energy_kilocalories: Option<i64>,
    pub sport_ref: Option<String>,
    pub manual_laps: Option<Vec<TrainingLap>>,
    pub automatic_laps: Option<Vec<TrainingLap>>,
    pub pauses: Option<Vec<TrainingPause>>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSessionStructure {
    pub exercises: Option<Vec<TrainingExercise>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingRouteKind {
    Primary,
    Transition,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingRoutePoint {
    pub ordinal: usize,
    pub latitude_degrees: f64,
    pub longitude_degrees: f64,
    pub altitude_meters: Option<f64>,
    pub elapsed_milliseconds: Option<i64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingRoute {
    pub kind: TrainingRouteKind,
    pub started_at_local: String,
    pub points: Vec<TrainingRoutePoint>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingRoutes {
    pub primary: Option<TrainingRoute>,
    pub transition: Option<TrainingRoute>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingExerciseRouteAssessment {
    pub exercise_id: String,
    pub ordinal: usize,
    pub routes: Option<TrainingRoutes>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSessionRouteAssessment {
    pub exercises: Option<Vec<TrainingExerciseRouteAssessment>>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSessionRecord {
    pub summary: TrainingSession,
    pub structure: Option<TrainingSessionStructure>,
    pub routes: Option<TrainingSessionRouteAssessment>,
}

pub fn decide_training_session_record_reconciliation(
    existing: Option<&TrainingSessionRecord>,
    incoming: &TrainingSessionRecord,
    revision_order: RevisionOrder,
) -> ReconciliationDecision {
    let Some(existing) = existing else {
        return ReconciliationDecision::Create;
    };
    if existing == incoming {
        return ReconciliationDecision::Equivalent;
    }
    let structure_compatible = existing.structure == incoming.structure
        || (existing.structure.is_none() && incoming.structure.is_some());
    let routes_compatible = existing.routes == incoming.routes
        || (existing.routes.is_none() && incoming.routes.is_some());
    if existing.summary == incoming.summary
        && structure_compatible
        && routes_compatible
        && (existing.structure != incoming.structure || existing.routes != incoming.routes)
    {
        return ReconciliationDecision::Enrich;
    }
    match revision_order {
        RevisionOrder::Newer => ReconciliationDecision::Amend,
        RevisionOrder::Older => ReconciliationDecision::Preserve,
        RevisionOrder::Equal | RevisionOrder::Unorderable => ReconciliationDecision::Conflict,
    }
}
