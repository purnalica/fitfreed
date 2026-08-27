use std::{collections::BTreeSet, error::Error, fmt};

use crate::{ProviderNeutralSportSuggestion, ReconciliationDecision, RevisionOrder};

const TARGET_ID_PREFIX: &str = "planned-target-";
const EVIDENCE_ID_PREFIX: &str = "planned-evidence-";
const EXERCISE_ID_PREFIX: &str = "planned-exercise-";
const PHASE_ID_PREFIX: &str = "planned-phase-";
const TRANSITION_ID_PREFIX: &str = "planned-transition-";
const REPEAT_ID_PREFIX: &str = "planned-repeat-";
const SESSION_ID_PREFIX: &str = "session-";
const ID_HEX_CHARACTERS: usize = 64;
const MAX_TARGET_NAME_CHARACTERS: usize = 160;
const MAX_TARGET_DESCRIPTION_CHARACTERS: usize = 2_000;
const MAX_PHASE_NAME_CHARACTERS: usize = 120;
const MAX_EXERCISES: usize = 256;
const MAX_UNIQUE_PHASES: usize = 20;
const MAX_EXPANDED_PHASES: usize = 200;
const MAX_REPEAT_NESTING_DEPTH: usize = 2;
const MAX_REPEAT_ITERATIONS: u16 = 100;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlannedTrainingCompletion {
    Pending,
    Completed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PlannedTrainingTargetKind {
    Scheduled {
        scheduled_at_local: String,
        completion: PlannedTrainingCompletion,
    },
    FavoriteTemplate,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlannedTrainingEditability {
    Editable,
    NonEditable,
    Unspecified,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlannedTrainingMappingState {
    Complete,
    Partial,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PlannedTrainingMappingCoverage {
    state: PlannedTrainingMappingState,
    unmapped_field_count: u32,
}

impl PlannedTrainingMappingCoverage {
    pub const fn complete() -> Self {
        Self {
            state: PlannedTrainingMappingState::Complete,
            unmapped_field_count: 0,
        }
    }

    pub fn partial(unmapped_field_count: u32) -> Result<Self, PlannedTrainingTargetError> {
        if unmapped_field_count == 0 {
            return Err(PlannedTrainingTargetError::InvalidMappingCoverage);
        }
        Ok(Self {
            state: PlannedTrainingMappingState::Partial,
            unmapped_field_count,
        })
    }

    pub const fn restore(
        state: PlannedTrainingMappingState,
        unmapped_field_count: u32,
    ) -> Result<Self, PlannedTrainingTargetError> {
        match (state, unmapped_field_count) {
            (PlannedTrainingMappingState::Complete, 0)
            | (PlannedTrainingMappingState::Partial, 1..=u32::MAX) => Ok(Self {
                state,
                unmapped_field_count,
            }),
            _ => Err(PlannedTrainingTargetError::InvalidMappingCoverage),
        }
    }

    pub const fn state(self) -> PlannedTrainingMappingState {
        self.state
    }

    pub const fn unmapped_field_count(self) -> u32 {
        self.unmapped_field_count
    }

    const fn is_more_complete_than(self, other: Self) -> bool {
        self.unmapped_field_count < other.unmapped_field_count
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlannedTrainingExerciseKind {
    Open,
    Phased,
    Volume,
    Strength,
    Unmapped,
}

#[derive(Debug, Clone, PartialEq)]
pub enum PlannedTrainingSport {
    Unavailable,
    Unmapped,
    Recognized(ProviderNeutralSportSuggestion),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlannedTrainingIntensityMetric {
    HeartRate,
    Speed,
    Power,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PlannedTrainingIntensity {
    None,
    ZoneRange {
        metric: PlannedTrainingIntensityMetric,
        lower_zone: u8,
        upper_zone: u8,
    },
    Unmapped,
}

#[derive(Debug, Clone, PartialEq)]
pub enum PlannedTrainingPhaseGoal {
    DurationMilliseconds(i64),
    DistanceMeters(f64),
    Unmapped,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlannedTrainingPhaseChange {
    Manual,
    Automatic,
    Unmapped,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlannedTrainingRepeat {
    pub repeat_id: String,
    pub return_to_phase_ordinal: usize,
    pub total_iterations: u16,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlannedTrainingTransition {
    pub transition_id: String,
    pub change: PlannedTrainingPhaseChange,
    pub repeat: Option<PlannedTrainingRepeat>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PlannedTrainingPhase {
    pub phase_id: String,
    pub ordinal: usize,
    pub name: String,
    pub goal: PlannedTrainingPhaseGoal,
    pub intensity: PlannedTrainingIntensity,
    pub transition: PlannedTrainingTransition,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PlannedTrainingExercise {
    pub exercise_id: String,
    pub ordinal: usize,
    pub kind: PlannedTrainingExerciseKind,
    pub duration_goal_milliseconds: Option<i64>,
    pub distance_goal_meters: Option<f64>,
    pub sport: PlannedTrainingSport,
    pub phases: Option<Vec<PlannedTrainingPhase>>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PlannedTrainingTarget {
    origin_id: String,
    target_id: String,
    evidence_revision: String,
    kind: PlannedTrainingTargetKind,
    name: String,
    description: Option<String>,
    editability: PlannedTrainingEditability,
    exercises: Option<Vec<PlannedTrainingExercise>>,
    mapping_coverage: PlannedTrainingMappingCoverage,
}

impl PlannedTrainingTarget {
    #[allow(clippy::too_many_arguments)]
    pub fn restore(
        origin_id: impl Into<String>,
        target_id: impl Into<String>,
        evidence_revision: impl Into<String>,
        kind: PlannedTrainingTargetKind,
        name: impl Into<String>,
        description: Option<String>,
        editability: PlannedTrainingEditability,
        exercises: Option<Vec<PlannedTrainingExercise>>,
        mapping_coverage: PlannedTrainingMappingCoverage,
    ) -> Result<Self, PlannedTrainingTargetError> {
        let origin_id = origin_id.into();
        let target_id = target_id.into();
        let evidence_revision = evidence_revision.into();
        let name = name.into();
        validate_canonical_text(&origin_id, usize::MAX, false)?;
        validate_digest_identifier(&target_id, TARGET_ID_PREFIX)?;
        validate_digest_identifier(&evidence_revision, EVIDENCE_ID_PREFIX)?;
        validate_target_kind(&kind)?;
        validate_canonical_text(&name, MAX_TARGET_NAME_CHARACTERS, false)?;
        if let Some(description) = description.as_deref() {
            validate_canonical_text(description, MAX_TARGET_DESCRIPTION_CHARACTERS, true)?;
        }
        validate_exercises(exercises.as_deref())?;
        PlannedTrainingMappingCoverage::restore(
            mapping_coverage.state,
            mapping_coverage.unmapped_field_count,
        )?;
        Ok(Self {
            origin_id,
            target_id,
            evidence_revision,
            kind,
            name,
            description,
            editability,
            exercises,
            mapping_coverage,
        })
    }

    pub fn origin_id(&self) -> &str {
        &self.origin_id
    }

    pub fn target_id(&self) -> &str {
        &self.target_id
    }

    pub fn evidence_revision(&self) -> &str {
        &self.evidence_revision
    }

    pub const fn kind(&self) -> &PlannedTrainingTargetKind {
        &self.kind
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn description(&self) -> Option<&str> {
        self.description.as_deref()
    }

    pub const fn editability(&self) -> PlannedTrainingEditability {
        self.editability
    }

    pub fn exercises(&self) -> Option<&[PlannedTrainingExercise]> {
        self.exercises.as_deref()
    }

    pub const fn mapping_coverage(&self) -> PlannedTrainingMappingCoverage {
        self.mapping_coverage
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PlannedTrainingSessionRelation {
    NotApplicable,
    Absent,
    Exact { session_ref: String },
    Ambiguous { candidate_count: usize },
}

pub fn resolve_planned_training_session_relation(
    target: &PlannedTrainingTarget,
    candidate_session_refs: &[String],
) -> Result<PlannedTrainingSessionRelation, PlannedTrainingTargetError> {
    match target.kind() {
        PlannedTrainingTargetKind::FavoriteTemplate => {
            return Ok(PlannedTrainingSessionRelation::NotApplicable)
        }
        PlannedTrainingTargetKind::Scheduled {
            completion: PlannedTrainingCompletion::Pending,
            ..
        } => return Ok(PlannedTrainingSessionRelation::Absent),
        PlannedTrainingTargetKind::Scheduled {
            completion: PlannedTrainingCompletion::Completed,
            ..
        } => {}
    }
    let mut unique = BTreeSet::new();
    for session_ref in candidate_session_refs {
        validate_digest_identifier(session_ref, SESSION_ID_PREFIX)?;
        if !unique.insert(session_ref) {
            return Err(PlannedTrainingTargetError::DuplicateSessionReference);
        }
    }
    Ok(match candidate_session_refs {
        [] => PlannedTrainingSessionRelation::Absent,
        [session_ref] => PlannedTrainingSessionRelation::Exact {
            session_ref: session_ref.clone(),
        },
        multiple => PlannedTrainingSessionRelation::Ambiguous {
            candidate_count: multiple.len(),
        },
    })
}

pub fn decide_planned_training_reconciliation(
    existing: Option<&PlannedTrainingTarget>,
    incoming: &PlannedTrainingTarget,
    revision_order: RevisionOrder,
) -> ReconciliationDecision {
    let Some(existing) = existing else {
        return ReconciliationDecision::Create;
    };
    if existing == incoming {
        return ReconciliationDecision::Equivalent;
    }
    if existing.origin_id == incoming.origin_id
        && existing.target_id == incoming.target_id
        && existing.evidence_revision == incoming.evidence_revision
    {
        if incoming
            .mapping_coverage
            .is_more_complete_than(existing.mapping_coverage)
        {
            return ReconciliationDecision::Enrich;
        }
        if existing
            .mapping_coverage
            .is_more_complete_than(incoming.mapping_coverage)
        {
            return ReconciliationDecision::Preserve;
        }
        return ReconciliationDecision::Conflict;
    }
    match revision_order {
        RevisionOrder::Newer => ReconciliationDecision::Amend,
        RevisionOrder::Older => ReconciliationDecision::Preserve,
        RevisionOrder::Equal | RevisionOrder::Unorderable => ReconciliationDecision::Conflict,
    }
}

pub fn order_planned_training_revisions_without_source_revision(
    existing: &PlannedTrainingTarget,
    incoming: &PlannedTrainingTarget,
) -> RevisionOrder {
    if existing.origin_id != incoming.origin_id || existing.target_id != incoming.target_id {
        return RevisionOrder::Unorderable;
    }
    if existing.evidence_revision == incoming.evidence_revision {
        return RevisionOrder::Equal;
    }
    let (
        PlannedTrainingTargetKind::Scheduled {
            scheduled_at_local: existing_scheduled_at,
            completion: existing_completion,
        },
        PlannedTrainingTargetKind::Scheduled {
            scheduled_at_local: incoming_scheduled_at,
            completion: incoming_completion,
        },
    ) = (&existing.kind, &incoming.kind)
    else {
        return RevisionOrder::Unorderable;
    };
    let same_definition = existing_scheduled_at == incoming_scheduled_at
        && existing.name == incoming.name
        && existing.description == incoming.description
        && existing.editability == incoming.editability
        && existing.exercises == incoming.exercises
        && existing.mapping_coverage == incoming.mapping_coverage;
    if !same_definition {
        return RevisionOrder::Unorderable;
    }
    match (existing_completion, incoming_completion) {
        (PlannedTrainingCompletion::Pending, PlannedTrainingCompletion::Completed) => {
            RevisionOrder::Newer
        }
        (PlannedTrainingCompletion::Completed, PlannedTrainingCompletion::Pending) => {
            RevisionOrder::Older
        }
        _ => RevisionOrder::Unorderable,
    }
}

fn validate_target_kind(
    kind: &PlannedTrainingTargetKind,
) -> Result<(), PlannedTrainingTargetError> {
    match kind {
        PlannedTrainingTargetKind::Scheduled {
            scheduled_at_local, ..
        } if !canonical_local_datetime(scheduled_at_local) => {
            Err(PlannedTrainingTargetError::InvalidScheduledInstant)
        }
        _ => Ok(()),
    }
}

fn validate_exercises(
    exercises: Option<&[PlannedTrainingExercise]>,
) -> Result<(), PlannedTrainingTargetError> {
    let Some(exercises) = exercises else {
        return Ok(());
    };
    if exercises.len() > MAX_EXERCISES {
        return Err(PlannedTrainingTargetError::ExerciseLimitExceeded);
    }
    let mut exercise_ids = BTreeSet::new();
    let mut phase_ids = BTreeSet::new();
    let mut transition_ids = BTreeSet::new();
    let mut repeat_ids = BTreeSet::new();
    for (ordinal, exercise) in exercises.iter().enumerate() {
        if exercise.ordinal != ordinal {
            return Err(PlannedTrainingTargetError::NonContiguousExerciseOrder);
        }
        validate_digest_identifier(&exercise.exercise_id, EXERCISE_ID_PREFIX)?;
        if !exercise_ids.insert(exercise.exercise_id.as_str()) {
            return Err(PlannedTrainingTargetError::DuplicateIdentifier);
        }
        if exercise
            .duration_goal_milliseconds
            .is_some_and(|value| value <= 0)
            || exercise
                .distance_goal_meters
                .is_some_and(|value| !value.is_finite() || value <= 0.0)
        {
            return Err(PlannedTrainingTargetError::InvalidExerciseGoal);
        }
        validate_phases(
            exercise.phases.as_deref(),
            &mut phase_ids,
            &mut transition_ids,
            &mut repeat_ids,
        )?;
    }
    Ok(())
}

fn validate_phases<'a>(
    phases: Option<&'a [PlannedTrainingPhase]>,
    phase_ids: &mut BTreeSet<&'a str>,
    transition_ids: &mut BTreeSet<&'a str>,
    repeat_ids: &mut BTreeSet<&'a str>,
) -> Result<(), PlannedTrainingTargetError> {
    let Some(phases) = phases else {
        return Ok(());
    };
    if phases.len() > MAX_UNIQUE_PHASES {
        return Err(PlannedTrainingTargetError::UniquePhaseLimitExceeded);
    }
    let mut repeat_ranges = Vec::new();
    for (ordinal, phase) in phases.iter().enumerate() {
        if phase.ordinal != ordinal {
            return Err(PlannedTrainingTargetError::NonContiguousPhaseOrder);
        }
        validate_digest_identifier(&phase.phase_id, PHASE_ID_PREFIX)?;
        validate_digest_identifier(&phase.transition.transition_id, TRANSITION_ID_PREFIX)?;
        if !phase_ids.insert(phase.phase_id.as_str())
            || !transition_ids.insert(phase.transition.transition_id.as_str())
        {
            return Err(PlannedTrainingTargetError::DuplicateIdentifier);
        }
        validate_canonical_text(&phase.name, MAX_PHASE_NAME_CHARACTERS, false)?;
        validate_phase_goal(&phase.goal)?;
        validate_intensity(&phase.intensity)?;
        if let Some(repeat) = phase.transition.repeat.as_ref() {
            validate_digest_identifier(&repeat.repeat_id, REPEAT_ID_PREFIX)?;
            if !repeat_ids.insert(repeat.repeat_id.as_str()) {
                return Err(PlannedTrainingTargetError::DuplicateIdentifier);
            }
            if repeat.return_to_phase_ordinal > ordinal
                || !(2..=MAX_REPEAT_ITERATIONS).contains(&repeat.total_iterations)
            {
                return Err(PlannedTrainingTargetError::InvalidRepeatRange);
            }
            repeat_ranges.push((
                repeat.return_to_phase_ordinal,
                ordinal,
                usize::from(repeat.total_iterations),
            ));
        }
    }
    validate_repeat_graph(phases.len(), &repeat_ranges)
}

fn validate_phase_goal(goal: &PlannedTrainingPhaseGoal) -> Result<(), PlannedTrainingTargetError> {
    match goal {
        PlannedTrainingPhaseGoal::DurationMilliseconds(value) if *value <= 0 => {
            Err(PlannedTrainingTargetError::InvalidPhaseGoal)
        }
        PlannedTrainingPhaseGoal::DistanceMeters(value) if !value.is_finite() || *value <= 0.0 => {
            Err(PlannedTrainingTargetError::InvalidPhaseGoal)
        }
        _ => Ok(()),
    }
}

fn validate_intensity(
    intensity: &PlannedTrainingIntensity,
) -> Result<(), PlannedTrainingTargetError> {
    match intensity {
        PlannedTrainingIntensity::ZoneRange {
            lower_zone,
            upper_zone,
            ..
        } if !(1..=5).contains(lower_zone)
            || !(1..=5).contains(upper_zone)
            || lower_zone > upper_zone =>
        {
            Err(PlannedTrainingTargetError::InvalidIntensityBounds)
        }
        _ => Ok(()),
    }
}

fn validate_repeat_graph(
    phase_count: usize,
    ranges: &[(usize, usize, usize)],
) -> Result<(), PlannedTrainingTargetError> {
    for (index, (left_start, left_end, _)) in ranges.iter().enumerate() {
        for (right_start, right_end, _) in &ranges[index + 1..] {
            let crossing = (left_start < right_start
                && right_start <= left_end
                && left_end < right_end)
                || (right_start < left_start && left_start <= right_end && right_end < left_end);
            if crossing {
                return Err(PlannedTrainingTargetError::CrossingRepeatRanges);
            }
        }
    }
    for phase_ordinal in 0..phase_count {
        let depth = ranges
            .iter()
            .filter(|(start, end, _)| *start <= phase_ordinal && phase_ordinal <= *end)
            .count();
        if depth > MAX_REPEAT_NESTING_DEPTH {
            return Err(PlannedTrainingTargetError::RepeatNestingTooDeep);
        }
    }
    let mut expanded_phase_count = 0_usize;
    for phase_ordinal in 0..phase_count {
        let occurrences = ranges
            .iter()
            .filter(|(start, end, _)| *start <= phase_ordinal && phase_ordinal <= *end)
            .try_fold(1_usize, |count, (_, _, iterations)| {
                count.checked_mul(*iterations)
            })
            .ok_or(PlannedTrainingTargetError::ExpandedPhaseLimitExceeded)?;
        expanded_phase_count = expanded_phase_count
            .checked_add(occurrences)
            .ok_or(PlannedTrainingTargetError::ExpandedPhaseLimitExceeded)?;
        if expanded_phase_count > MAX_EXPANDED_PHASES {
            return Err(PlannedTrainingTargetError::ExpandedPhaseLimitExceeded);
        }
    }
    Ok(())
}

fn validate_digest_identifier(value: &str, prefix: &str) -> Result<(), PlannedTrainingTargetError> {
    let Some(suffix) = value.strip_prefix(prefix) else {
        return Err(PlannedTrainingTargetError::InvalidIdentifier);
    };
    if suffix.len() != ID_HEX_CHARACTERS
        || !suffix
            .bytes()
            .all(|character| character.is_ascii_digit() || (b'a'..=b'f').contains(&character))
    {
        return Err(PlannedTrainingTargetError::InvalidIdentifier);
    }
    Ok(())
}

fn validate_canonical_text(
    value: &str,
    maximum_characters: usize,
    allow_empty: bool,
) -> Result<(), PlannedTrainingTargetError> {
    if (!allow_empty && value.trim().is_empty()) || value.chars().count() > maximum_characters {
        return Err(PlannedTrainingTargetError::InvalidText);
    }
    if value
        .chars()
        .any(|character| character.is_control() && !matches!(character, '\n' | '\r' | '\t'))
    {
        return Err(PlannedTrainingTargetError::InvalidText);
    }
    Ok(())
}

fn canonical_local_datetime(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() < 19
        || bytes[4] != b'-'
        || bytes[7] != b'-'
        || bytes[10] != b'T'
        || bytes[13] != b':'
        || bytes[16] != b':'
        || !bytes[..19]
            .iter()
            .enumerate()
            .all(|(index, byte)| matches!(index, 4 | 7 | 10 | 13 | 16) || byte.is_ascii_digit())
    {
        return false;
    }
    let Some(year) = parse_ascii_digits(bytes, 0, 4) else {
        return false;
    };
    let Some(month) = parse_ascii_digits(bytes, 5, 7) else {
        return false;
    };
    let Some(day) = parse_ascii_digits(bytes, 8, 10) else {
        return false;
    };
    let Some(hour) = parse_ascii_digits(bytes, 11, 13) else {
        return false;
    };
    let Some(minute) = parse_ascii_digits(bytes, 14, 16) else {
        return false;
    };
    let Some(second) = parse_ascii_digits(bytes, 17, 19) else {
        return false;
    };
    if year == 0
        || !(1..=12).contains(&month)
        || !(1..=days_in_month(year, month)).contains(&day)
        || hour > 23
        || minute > 59
        || second > 59
    {
        return false;
    }
    bytes.len() == 19
        || (bytes.get(19) == Some(&b'.')
            && bytes.len() <= 29
            && bytes.len() > 20
            && bytes[20..].iter().all(u8::is_ascii_digit)
            && bytes.last() != Some(&b'0'))
}

fn parse_ascii_digits(bytes: &[u8], start: usize, end: usize) -> Option<u32> {
    bytes
        .get(start..end)?
        .iter()
        .try_fold(0_u32, |value, byte| {
            byte.is_ascii_digit()
                .then(|| value * 10 + u32::from(byte - b'0'))
        })
}

const fn days_in_month(year: u32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if is_leap_year(year) => 29,
        2 => 28,
        _ => 0,
    }
}

const fn is_leap_year(year: u32) -> bool {
    year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlannedTrainingTargetError {
    InvalidIdentifier,
    DuplicateIdentifier,
    DuplicateSessionReference,
    InvalidScheduledInstant,
    InvalidText,
    InvalidMappingCoverage,
    ExerciseLimitExceeded,
    NonContiguousExerciseOrder,
    InvalidExerciseGoal,
    UniquePhaseLimitExceeded,
    NonContiguousPhaseOrder,
    InvalidPhaseGoal,
    InvalidIntensityBounds,
    InvalidRepeatRange,
    CrossingRepeatRanges,
    RepeatNestingTooDeep,
    ExpandedPhaseLimitExceeded,
}

impl fmt::Display for PlannedTrainingTargetError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidIdentifier => "planned-training identifier is invalid",
            Self::DuplicateIdentifier => "planned-training identifier is duplicated",
            Self::DuplicateSessionReference => "session relationship contains a duplicate",
            Self::InvalidScheduledInstant => "scheduled local instant is invalid",
            Self::InvalidText => "planned-training text is invalid",
            Self::InvalidMappingCoverage => "planned-training mapping coverage is invalid",
            Self::ExerciseLimitExceeded => "planned-training exercise limit is exceeded",
            Self::NonContiguousExerciseOrder => "planned-training exercise order is not contiguous",
            Self::InvalidExerciseGoal => "planned-training exercise goal is invalid",
            Self::UniquePhaseLimitExceeded => "planned-training phase limit is exceeded",
            Self::NonContiguousPhaseOrder => "planned-training phase order is not contiguous",
            Self::InvalidPhaseGoal => "planned-training phase goal is invalid",
            Self::InvalidIntensityBounds => "planned-training intensity bounds are invalid",
            Self::InvalidRepeatRange => "planned-training repeat range is invalid",
            Self::CrossingRepeatRanges => "planned-training repeat ranges cross",
            Self::RepeatNestingTooDeep => "planned-training repeat nesting is too deep",
            Self::ExpandedPhaseLimitExceeded => "planned-training expanded phase limit is exceeded",
        })
    }
}

impl Error for PlannedTrainingTargetError {}
