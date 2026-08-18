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

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSessionRecord {
    pub summary: TrainingSession,
    pub structure: Option<TrainingSessionStructure>,
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
    if existing.summary == incoming.summary
        && existing.structure.is_none()
        && incoming.structure.is_some()
    {
        return ReconciliationDecision::Enrich;
    }
    match revision_order {
        RevisionOrder::Newer => ReconciliationDecision::Amend,
        RevisionOrder::Older => ReconciliationDecision::Preserve,
        RevisionOrder::Equal | RevisionOrder::Unorderable => ReconciliationDecision::Conflict,
    }
}
