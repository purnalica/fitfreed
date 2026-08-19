use std::collections::{BTreeMap, BTreeSet};

use fitfreed_domain::{
    author_segment_criterion, SegmentCriterion, SegmentCriterionDefinition, SegmentCriterionError,
};

use crate::{training_detail::valid_ref, ApplicationError};

const SNAPSHOT_PREFIX: &str = "training-snapshot-";
const SESSION_PREFIX: &str = "session-";
const EXERCISE_PREFIX: &str = "exercise-";
const SIGNAL_PREFIX: &str = "signal-";
const CRITERION_PREFIX: &str = "criterion-";
const MAX_DERIVED_SEGMENTS: usize = 250;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSessionSegmentationQuery {
    pub session_ref: String,
    pub snapshot_ref: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SegmentSignalKind {
    Distance,
    HeartRate,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SegmentSignalEvidence {
    pub signal_ref: String,
    pub kind: SegmentSignalKind,
    pub interval_milliseconds: i64,
    pub sample_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SegmentSignalSample {
    pub ordinal: usize,
    pub value_milliunits: Option<i64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedTrainingExerciseSegmentation {
    pub exercise_ref: String,
    pub ordinal: usize,
    pub duration_milliseconds: i64,
    pub signals: Vec<SegmentSignalEvidence>,
    pub applied_criterion_refs: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedTrainingSessionSegmentation {
    pub snapshot_ref: String,
    pub session_ref: String,
    pub criteria: Vec<SegmentCriterion>,
    pub exercises: Option<Vec<PersistedTrainingExerciseSegmentation>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrainingSegmentationPortError {
    SnapshotChanged,
    NotFound,
    CriterionConflict,
    AlreadyApplied,
    NotApplied,
    Failure(String),
}

pub trait TrainingSegmentationPort {
    fn query_training_session_segmentation(
        &self,
        query: &TrainingSessionSegmentationQuery,
    ) -> Result<PersistedTrainingSessionSegmentation, TrainingSegmentationPortError>;

    fn visit_segment_signal_samples(
        &self,
        snapshot_ref: &str,
        session_ref: &str,
        signal_ref: &str,
        visitor: &mut dyn FnMut(SegmentSignalSample) -> Result<(), String>,
    ) -> Result<(), TrainingSegmentationPortError>;

    fn new_segment_criterion_id(&self) -> Result<String, TrainingSegmentationPortError>;

    fn create_and_apply_segment_criterion(
        &self,
        snapshot_ref: &str,
        session_ref: &str,
        exercise_ref: &str,
        criterion: &SegmentCriterion,
    ) -> Result<(), TrainingSegmentationPortError>;

    fn compare_and_save_segment_criterion(
        &self,
        expected_revision: u64,
        criterion: &SegmentCriterion,
    ) -> Result<bool, TrainingSegmentationPortError>;

    fn apply_segment_criterion(
        &self,
        snapshot_ref: &str,
        session_ref: &str,
        exercise_ref: &str,
        criterion_ref: &str,
    ) -> Result<(), TrainingSegmentationPortError>;

    fn remove_segment_criterion(
        &self,
        snapshot_ref: &str,
        session_ref: &str,
        exercise_ref: &str,
        criterion_ref: &str,
    ) -> Result<(), TrainingSegmentationPortError>;

    fn move_segment_criterion(
        &self,
        snapshot_ref: &str,
        session_ref: &str,
        exercise_ref: &str,
        criterion_ref: &str,
        direction: TrainingSegmentCriterionDirection,
    ) -> Result<(), TrainingSegmentationPortError>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SegmentMeasurementView {
    Distance,
    HeartRate,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SegmentApplicabilityView {
    Applicable,
    MissingPrerequisite,
    AmbiguousPrerequisite,
    IncompleteEvidence,
    OutsideSession,
    TooManySegments,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingDerivedSegment {
    pub ordinal: usize,
    pub started_at_elapsed_milliseconds: i64,
    pub ended_at_elapsed_milliseconds: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct AppliedTrainingSegmentCriterion {
    pub criterion: SegmentCriterion,
    pub ordinal: usize,
    pub applicability: SegmentApplicabilityView,
    pub required_measurement: Option<SegmentMeasurementView>,
    pub has_evidence_gaps: bool,
    pub segments: Vec<TrainingDerivedSegment>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingExerciseSegmentation {
    pub exercise_ref: String,
    pub ordinal: usize,
    pub duration_milliseconds: i64,
    pub applied_criteria: Vec<AppliedTrainingSegmentCriterion>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSessionSegmentationResult {
    pub snapshot_ref: String,
    pub session_ref: String,
    pub available_criteria: Vec<SegmentCriterion>,
    pub exercises: Option<Vec<TrainingExerciseSegmentation>>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CreateTrainingSegmentCriterionRequest {
    pub session_ref: String,
    pub snapshot_ref: String,
    pub exercise_ref: String,
    pub title: String,
    pub definition: SegmentCriterionDefinition,
}

#[derive(Debug, Clone, PartialEq)]
pub struct UpdateTrainingSegmentCriterionRequest {
    pub session_ref: String,
    pub snapshot_ref: String,
    pub criterion_ref: String,
    pub expected_revision: u64,
    pub title: String,
    pub definition: SegmentCriterionDefinition,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSegmentCriterionMutationRequest {
    pub session_ref: String,
    pub snapshot_ref: String,
    pub exercise_ref: String,
    pub criterion_ref: String,
}

pub type RemoveTrainingSegmentCriterionRequest = TrainingSegmentCriterionMutationRequest;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingSegmentCriterionDirection {
    Earlier,
    Later,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MoveTrainingSegmentCriterionRequest {
    pub mutation: TrainingSegmentCriterionMutationRequest,
    pub direction: TrainingSegmentCriterionDirection,
}

pub fn query_training_session_segmentation(
    port: &dyn TrainingSegmentationPort,
    query: TrainingSessionSegmentationQuery,
) -> Result<TrainingSessionSegmentationResult, ApplicationError> {
    validate_query_identity(&query.session_ref, query.snapshot_ref.as_deref())?;
    let persisted = port
        .query_training_session_segmentation(&query)
        .map_err(map_port_query_error)?;
    validate_result_identity(&query, &persisted)?;
    build_result(port, persisted)
}

pub fn create_training_segment_criterion(
    port: &dyn TrainingSegmentationPort,
    request: CreateTrainingSegmentCriterionRequest,
) -> Result<TrainingSessionSegmentationResult, ApplicationError> {
    validate_mutation_identity(
        &request.session_ref,
        &request.snapshot_ref,
        &request.exercise_ref,
        None,
    )?;
    let criterion_id = port
        .new_segment_criterion_id()
        .map_err(map_port_update_error)?;
    let criterion = SegmentCriterion::create(criterion_id, &request.title, request.definition)
        .map_err(invalid_criterion)?;
    port.create_and_apply_segment_criterion(
        &request.snapshot_ref,
        &request.session_ref,
        &request.exercise_ref,
        &criterion,
    )
    .map_err(map_port_update_error)?;
    query_training_session_segmentation(
        port,
        TrainingSessionSegmentationQuery {
            session_ref: request.session_ref,
            snapshot_ref: Some(request.snapshot_ref),
        },
    )
}

pub fn update_training_segment_criterion(
    port: &dyn TrainingSegmentationPort,
    request: UpdateTrainingSegmentCriterionRequest,
) -> Result<TrainingSessionSegmentationResult, ApplicationError> {
    validate_criterion_mutation_identity(
        &request.session_ref,
        &request.snapshot_ref,
        &request.criterion_ref,
    )?;
    if request.expected_revision == 0 {
        return invalid("segment criterion expected revision is zero");
    }
    let query = TrainingSessionSegmentationQuery {
        session_ref: request.session_ref.clone(),
        snapshot_ref: Some(request.snapshot_ref.clone()),
    };
    let persisted = port
        .query_training_session_segmentation(&query)
        .map_err(map_port_query_error)?;
    validate_result_identity(&query, &persisted)?;
    let existing = persisted
        .criteria
        .iter()
        .find(|criterion| criterion.criterion_id() == request.criterion_ref)
        .ok_or(ApplicationError::InvalidTrainingSegmentCriterion(
            "segment criterion is not available",
        ))?;
    if existing.revision() != request.expected_revision {
        return Err(ApplicationError::TrainingSegmentCriterionConflict);
    }
    let revised = author_segment_criterion(existing, &request.title, request.definition)
        .map_err(invalid_criterion)?;
    if &revised != existing {
        let saved = port
            .compare_and_save_segment_criterion(request.expected_revision, &revised)
            .map_err(map_port_update_error)?;
        if !saved {
            return Err(ApplicationError::TrainingSegmentCriterionConflict);
        }
    }
    query_training_session_segmentation(
        port,
        TrainingSessionSegmentationQuery {
            session_ref: request.session_ref,
            snapshot_ref: Some(request.snapshot_ref),
        },
    )
}

pub fn apply_training_segment_criterion(
    port: &dyn TrainingSegmentationPort,
    request: TrainingSegmentCriterionMutationRequest,
) -> Result<TrainingSessionSegmentationResult, ApplicationError> {
    mutate_application(port, request, |port, request| {
        port.apply_segment_criterion(
            &request.snapshot_ref,
            &request.session_ref,
            &request.exercise_ref,
            &request.criterion_ref,
        )
    })
}

pub fn remove_training_segment_criterion(
    port: &dyn TrainingSegmentationPort,
    request: RemoveTrainingSegmentCriterionRequest,
) -> Result<TrainingSessionSegmentationResult, ApplicationError> {
    mutate_application(port, request, |port, request| {
        port.remove_segment_criterion(
            &request.snapshot_ref,
            &request.session_ref,
            &request.exercise_ref,
            &request.criterion_ref,
        )
    })
}

pub fn move_training_segment_criterion(
    port: &dyn TrainingSegmentationPort,
    request: MoveTrainingSegmentCriterionRequest,
) -> Result<TrainingSessionSegmentationResult, ApplicationError> {
    let direction = request.direction;
    mutate_application(port, request.mutation, |port, request| {
        port.move_segment_criterion(
            &request.snapshot_ref,
            &request.session_ref,
            &request.exercise_ref,
            &request.criterion_ref,
            direction,
        )
    })
}

fn mutate_application(
    port: &dyn TrainingSegmentationPort,
    request: TrainingSegmentCriterionMutationRequest,
    mutation: impl FnOnce(
        &dyn TrainingSegmentationPort,
        &TrainingSegmentCriterionMutationRequest,
    ) -> Result<(), TrainingSegmentationPortError>,
) -> Result<TrainingSessionSegmentationResult, ApplicationError> {
    validate_mutation_identity(
        &request.session_ref,
        &request.snapshot_ref,
        &request.exercise_ref,
        Some(&request.criterion_ref),
    )?;
    mutation(port, &request).map_err(map_port_update_error)?;
    query_training_session_segmentation(
        port,
        TrainingSessionSegmentationQuery {
            session_ref: request.session_ref,
            snapshot_ref: Some(request.snapshot_ref),
        },
    )
}

fn build_result(
    port: &dyn TrainingSegmentationPort,
    persisted: PersistedTrainingSessionSegmentation,
) -> Result<TrainingSessionSegmentationResult, ApplicationError> {
    let mut criteria_by_ref = BTreeMap::new();
    for criterion in &persisted.criteria {
        if criteria_by_ref
            .insert(criterion.criterion_id(), criterion)
            .is_some()
        {
            return invalid("segment criterion query returned duplicate identities");
        }
    }
    let exercises = persisted
        .exercises
        .as_ref()
        .map(|exercises| {
            let mut exercise_refs = BTreeSet::new();
            exercises
                .iter()
                .enumerate()
                .map(|(expected_ordinal, exercise)| {
                    if exercise.ordinal != expected_ordinal
                        || !valid_ref(&exercise.exercise_ref, EXERCISE_PREFIX)
                        || !exercise_refs.insert(exercise.exercise_ref.as_str())
                        || exercise.duration_milliseconds < 0
                    {
                        return invalid("segment exercise query is inconsistent");
                    }
                    validate_signal_evidence(&exercise.signals)?;
                    let mut applied_refs = BTreeSet::new();
                    let applied_criteria = exercise
                        .applied_criterion_refs
                        .iter()
                        .enumerate()
                        .map(|(ordinal, criterion_ref)| {
                            if !applied_refs.insert(criterion_ref.as_str()) {
                                return invalid("segment criterion is applied more than once");
                            }
                            let criterion = criteria_by_ref.get(criterion_ref.as_str()).ok_or(
                                ApplicationError::InvalidTrainingSegmentCriterion(
                                    "applied segment criterion is unavailable",
                                ),
                            )?;
                            evaluate_criterion(
                                port,
                                &persisted.snapshot_ref,
                                &persisted.session_ref,
                                exercise,
                                criterion,
                                ordinal,
                            )
                        })
                        .collect::<Result<Vec<_>, _>>()?;
                    Ok(TrainingExerciseSegmentation {
                        exercise_ref: exercise.exercise_ref.clone(),
                        ordinal: exercise.ordinal,
                        duration_milliseconds: exercise.duration_milliseconds,
                        applied_criteria,
                    })
                })
                .collect::<Result<Vec<_>, ApplicationError>>()
        })
        .transpose()?;
    Ok(TrainingSessionSegmentationResult {
        snapshot_ref: persisted.snapshot_ref,
        session_ref: persisted.session_ref,
        available_criteria: persisted.criteria,
        exercises,
    })
}

fn evaluate_criterion(
    port: &dyn TrainingSegmentationPort,
    snapshot_ref: &str,
    session_ref: &str,
    exercise: &PersistedTrainingExerciseSegmentation,
    criterion: &SegmentCriterion,
    ordinal: usize,
) -> Result<AppliedTrainingSegmentCriterion, ApplicationError> {
    let evaluation = match criterion.definition() {
        SegmentCriterionDefinition::EqualElapsedTime { span_milliseconds } => {
            evaluate_equal_time(exercise.duration_milliseconds, *span_milliseconds)
        }
        SegmentCriterionDefinition::ManualBoundaries {
            elapsed_milliseconds,
        } => evaluate_boundaries(exercise.duration_milliseconds, elapsed_milliseconds.clone()),
        SegmentCriterionDefinition::EqualDistance { span_meters } => evaluate_equal_distance(
            port,
            snapshot_ref,
            session_ref,
            exercise,
            (*span_meters * 1_000.0).round() as i64,
        )?,
        SegmentCriterionDefinition::HeartRateZone {
            minimum_beats_per_minute,
            maximum_beats_per_minute,
        } => evaluate_heart_rate_zone(
            port,
            snapshot_ref,
            session_ref,
            exercise,
            i64::from(*minimum_beats_per_minute) * 1_000,
            i64::from(*maximum_beats_per_minute) * 1_000,
        )?,
    };
    Ok(AppliedTrainingSegmentCriterion {
        criterion: criterion.clone(),
        ordinal,
        applicability: evaluation.applicability,
        required_measurement: evaluation.required_measurement,
        has_evidence_gaps: evaluation.has_evidence_gaps,
        segments: evaluation.segments,
    })
}

struct Evaluation {
    applicability: SegmentApplicabilityView,
    required_measurement: Option<SegmentMeasurementView>,
    has_evidence_gaps: bool,
    segments: Vec<TrainingDerivedSegment>,
}

fn evaluate_equal_time(duration_milliseconds: i64, span_milliseconds: i64) -> Evaluation {
    if duration_milliseconds == 0 {
        return unavailable(SegmentApplicabilityView::OutsideSession, None);
    }
    let count = duration_milliseconds / span_milliseconds
        + i64::from(duration_milliseconds % span_milliseconds != 0);
    if usize::try_from(count).map_or(true, |count| count > MAX_DERIVED_SEGMENTS) {
        return unavailable(SegmentApplicabilityView::TooManySegments, None);
    }
    let boundaries = (1..count).map(|index| index * span_milliseconds).collect();
    evaluate_boundaries(duration_milliseconds, boundaries)
}

fn evaluate_boundaries(duration_milliseconds: i64, boundaries: Vec<i64>) -> Evaluation {
    if duration_milliseconds == 0
        || boundaries
            .iter()
            .any(|boundary| *boundary <= 0 || *boundary >= duration_milliseconds)
        || boundaries.windows(2).any(|pair| pair[0] >= pair[1])
    {
        return unavailable(SegmentApplicabilityView::OutsideSession, None);
    }
    if boundaries.len().saturating_add(1) > MAX_DERIVED_SEGMENTS {
        return unavailable(SegmentApplicabilityView::TooManySegments, None);
    }
    let mut starts = Vec::with_capacity(boundaries.len() + 1);
    starts.push(0);
    starts.extend(boundaries.iter().copied());
    let mut ends = boundaries;
    ends.push(duration_milliseconds);
    Evaluation {
        applicability: SegmentApplicabilityView::Applicable,
        required_measurement: None,
        has_evidence_gaps: false,
        segments: starts
            .into_iter()
            .zip(ends)
            .enumerate()
            .map(
                |(ordinal, (started_at_elapsed_milliseconds, ended_at_elapsed_milliseconds))| {
                    TrainingDerivedSegment {
                        ordinal,
                        started_at_elapsed_milliseconds,
                        ended_at_elapsed_milliseconds,
                    }
                },
            )
            .collect(),
    }
}

fn evaluate_equal_distance(
    port: &dyn TrainingSegmentationPort,
    snapshot_ref: &str,
    session_ref: &str,
    exercise: &PersistedTrainingExerciseSegmentation,
    span_millimeters: i64,
) -> Result<Evaluation, ApplicationError> {
    let signal = match unique_signal(exercise, SegmentSignalKind::Distance) {
        SignalSelection::Missing => {
            return Ok(unavailable(
                SegmentApplicabilityView::MissingPrerequisite,
                Some(SegmentMeasurementView::Distance),
            ));
        }
        SignalSelection::Ambiguous => {
            return Ok(unavailable(
                SegmentApplicabilityView::AmbiguousPrerequisite,
                Some(SegmentMeasurementView::Distance),
            ));
        }
        SignalSelection::One(signal) => signal,
    };
    if signal.sample_count == 0 {
        return Ok(unavailable(
            SegmentApplicabilityView::IncompleteEvidence,
            Some(SegmentMeasurementView::Distance),
        ));
    }
    let mut expected_ordinal = 0_usize;
    let mut previous_value = None;
    let mut next_target = span_millimeters;
    let mut boundaries = Vec::new();
    let mut has_gap = false;
    let mut evidence_invalid = false;
    port.visit_segment_signal_samples(
        snapshot_ref,
        session_ref,
        &signal.signal_ref,
        &mut |sample| {
            if sample.ordinal != expected_ordinal {
                return Err("segment signal samples are not contiguous".to_owned());
            }
            expected_ordinal = expected_ordinal
                .checked_add(1)
                .ok_or_else(|| "segment signal sample ordinal overflowed".to_owned())?;
            let Some(value) = sample.value_milliunits else {
                has_gap = true;
                return Ok(());
            };
            if value < 0 || previous_value.is_some_and(|previous| value < previous) {
                evidence_invalid = true;
                return Ok(());
            }
            if value >= next_target {
                if has_gap || value >= next_target.saturating_add(span_millimeters) {
                    evidence_invalid = true;
                    return Ok(());
                }
                let elapsed = elapsed_milliseconds(sample.ordinal, signal.interval_milliseconds)?;
                if elapsed <= 0 || elapsed >= exercise.duration_milliseconds {
                    evidence_invalid = true;
                    return Ok(());
                }
                boundaries.push(elapsed);
                next_target = next_target
                    .checked_add(span_millimeters)
                    .ok_or_else(|| "distance segment target overflowed".to_owned())?;
            }
            previous_value = Some(value);
            Ok(())
        },
    )
    .map_err(map_port_query_error)?;
    if expected_ordinal != signal.sample_count {
        return invalid("segment signal sample count is inconsistent");
    }
    if evidence_invalid || has_gap {
        return Ok(unavailable(
            SegmentApplicabilityView::IncompleteEvidence,
            Some(SegmentMeasurementView::Distance),
        ));
    }
    let mut evaluation = evaluate_boundaries(exercise.duration_milliseconds, boundaries);
    evaluation.required_measurement = Some(SegmentMeasurementView::Distance);
    Ok(evaluation)
}

fn evaluate_heart_rate_zone(
    port: &dyn TrainingSegmentationPort,
    snapshot_ref: &str,
    session_ref: &str,
    exercise: &PersistedTrainingExerciseSegmentation,
    minimum_millibeats_per_minute: i64,
    maximum_millibeats_per_minute: i64,
) -> Result<Evaluation, ApplicationError> {
    let signal = match unique_signal(exercise, SegmentSignalKind::HeartRate) {
        SignalSelection::Missing => {
            return Ok(unavailable(
                SegmentApplicabilityView::MissingPrerequisite,
                Some(SegmentMeasurementView::HeartRate),
            ));
        }
        SignalSelection::Ambiguous => {
            return Ok(unavailable(
                SegmentApplicabilityView::AmbiguousPrerequisite,
                Some(SegmentMeasurementView::HeartRate),
            ));
        }
        SignalSelection::One(signal) => signal,
    };
    if signal.sample_count == 0 {
        return Ok(unavailable(
            SegmentApplicabilityView::IncompleteEvidence,
            Some(SegmentMeasurementView::HeartRate),
        ));
    }
    let mut expected_ordinal = 0_usize;
    let mut open_segment = None;
    let mut segments = Vec::new();
    let mut has_gap = false;
    port.visit_segment_signal_samples(
        snapshot_ref,
        session_ref,
        &signal.signal_ref,
        &mut |sample| {
            if sample.ordinal != expected_ordinal {
                return Err("segment signal samples are not contiguous".to_owned());
            }
            expected_ordinal = expected_ordinal
                .checked_add(1)
                .ok_or_else(|| "segment signal sample ordinal overflowed".to_owned())?;
            let started = elapsed_milliseconds(sample.ordinal, signal.interval_milliseconds)?;
            let ended = elapsed_milliseconds(
                sample
                    .ordinal
                    .checked_add(1)
                    .ok_or_else(|| "segment signal sample ordinal overflowed".to_owned())?,
                signal.interval_milliseconds,
            )?
            .min(exercise.duration_milliseconds);
            let inside = sample.value_milliunits.is_some_and(|value| {
                (minimum_millibeats_per_minute..=maximum_millibeats_per_minute).contains(&value)
            });
            if sample.value_milliunits.is_none() {
                has_gap = true;
            }
            if inside && started < exercise.duration_milliseconds {
                open_segment.get_or_insert(started);
            } else if let Some(opened) = open_segment.take() {
                push_segment(
                    &mut segments,
                    opened,
                    started.min(exercise.duration_milliseconds),
                );
            }
            if inside && ended == exercise.duration_milliseconds {
                if let Some(opened) = open_segment.take() {
                    push_segment(&mut segments, opened, ended);
                }
            }
            Ok(())
        },
    )
    .map_err(map_port_query_error)?;
    if expected_ordinal != signal.sample_count {
        return invalid("segment signal sample count is inconsistent");
    }
    if let Some(opened) = open_segment {
        let evidence_end = elapsed_milliseconds(signal.sample_count, signal.interval_milliseconds)
            .map_err(ApplicationError::TrainingSegmentationQuery)?
            .min(exercise.duration_milliseconds);
        push_segment(&mut segments, opened, evidence_end);
    }
    if segments.len() > MAX_DERIVED_SEGMENTS {
        return Ok(unavailable(
            SegmentApplicabilityView::TooManySegments,
            Some(SegmentMeasurementView::HeartRate),
        ));
    }
    Ok(Evaluation {
        applicability: SegmentApplicabilityView::Applicable,
        required_measurement: Some(SegmentMeasurementView::HeartRate),
        has_evidence_gaps: has_gap,
        segments,
    })
}

fn push_segment(segments: &mut Vec<TrainingDerivedSegment>, started: i64, ended: i64) {
    if ended > started && segments.len() <= MAX_DERIVED_SEGMENTS {
        segments.push(TrainingDerivedSegment {
            ordinal: segments.len(),
            started_at_elapsed_milliseconds: started,
            ended_at_elapsed_milliseconds: ended,
        });
    }
}

enum SignalSelection<'a> {
    Missing,
    One(&'a SegmentSignalEvidence),
    Ambiguous,
}

fn unique_signal(
    exercise: &PersistedTrainingExerciseSegmentation,
    kind: SegmentSignalKind,
) -> SignalSelection<'_> {
    let mut matching = exercise.signals.iter().filter(|signal| signal.kind == kind);
    let first = matching.next();
    if matching.next().is_some() {
        return SignalSelection::Ambiguous;
    }
    first.map_or(SignalSelection::Missing, SignalSelection::One)
}

fn elapsed_milliseconds(ordinal: usize, interval: i64) -> Result<i64, String> {
    i64::try_from(ordinal)
        .ok()
        .and_then(|ordinal| ordinal.checked_mul(interval))
        .ok_or_else(|| "segment signal elapsed time overflowed".to_owned())
}

fn unavailable(
    applicability: SegmentApplicabilityView,
    required_measurement: Option<SegmentMeasurementView>,
) -> Evaluation {
    Evaluation {
        applicability,
        required_measurement,
        has_evidence_gaps: false,
        segments: Vec::new(),
    }
}

fn validate_signal_evidence(signals: &[SegmentSignalEvidence]) -> Result<(), ApplicationError> {
    let mut refs = BTreeSet::new();
    for signal in signals {
        if !valid_ref(&signal.signal_ref, SIGNAL_PREFIX)
            || !refs.insert(signal.signal_ref.as_str())
            || signal.interval_milliseconds <= 0
        {
            return invalid("segment signal evidence is inconsistent");
        }
    }
    Ok(())
}

fn validate_query_identity(
    session_ref: &str,
    snapshot_ref: Option<&str>,
) -> Result<(), ApplicationError> {
    if !valid_ref(session_ref, SESSION_PREFIX)
        || snapshot_ref.is_some_and(|value| !valid_ref(value, SNAPSHOT_PREFIX))
    {
        return invalid("segment session or snapshot reference is invalid");
    }
    Ok(())
}

fn validate_mutation_identity(
    session_ref: &str,
    snapshot_ref: &str,
    exercise_ref: &str,
    criterion_ref: Option<&str>,
) -> Result<(), ApplicationError> {
    validate_query_identity(session_ref, Some(snapshot_ref))?;
    if !valid_ref(exercise_ref, EXERCISE_PREFIX)
        || criterion_ref.is_some_and(|criterion_ref| !valid_ref(criterion_ref, CRITERION_PREFIX))
    {
        return invalid("segment mutation reference is invalid");
    }
    Ok(())
}

fn validate_criterion_mutation_identity(
    session_ref: &str,
    snapshot_ref: &str,
    criterion_ref: &str,
) -> Result<(), ApplicationError> {
    validate_query_identity(session_ref, Some(snapshot_ref))?;
    if !valid_ref(criterion_ref, CRITERION_PREFIX) {
        return invalid("segment criterion reference is invalid");
    }
    Ok(())
}

fn validate_result_identity(
    query: &TrainingSessionSegmentationQuery,
    persisted: &PersistedTrainingSessionSegmentation,
) -> Result<(), ApplicationError> {
    if persisted.session_ref != query.session_ref
        || !valid_ref(&persisted.snapshot_ref, SNAPSHOT_PREFIX)
        || query
            .snapshot_ref
            .as_deref()
            .is_some_and(|expected| expected != persisted.snapshot_ref)
    {
        return Err(ApplicationError::TrainingSegmentationChanged);
    }
    Ok(())
}

fn map_port_query_error(error: TrainingSegmentationPortError) -> ApplicationError {
    match error {
        TrainingSegmentationPortError::SnapshotChanged => {
            ApplicationError::TrainingSegmentationChanged
        }
        TrainingSegmentationPortError::NotFound => {
            ApplicationError::InvalidTrainingSegmentCriterion(
                "segment session or criterion is unavailable",
            )
        }
        TrainingSegmentationPortError::CriterionConflict => {
            ApplicationError::TrainingSegmentCriterionConflict
        }
        TrainingSegmentationPortError::AlreadyApplied => {
            ApplicationError::InvalidTrainingSegmentCriterion(
                "segment criterion is already applied",
            )
        }
        TrainingSegmentationPortError::NotApplied => {
            ApplicationError::InvalidTrainingSegmentCriterion("segment criterion is not applied")
        }
        TrainingSegmentationPortError::Failure(reason) => {
            ApplicationError::TrainingSegmentationQuery(reason)
        }
    }
}

fn map_port_update_error(error: TrainingSegmentationPortError) -> ApplicationError {
    match error {
        TrainingSegmentationPortError::Failure(reason) => {
            ApplicationError::TrainingSegmentationUpdate(reason)
        }
        other => map_port_query_error(other),
    }
}

fn invalid_criterion(_error: SegmentCriterionError) -> ApplicationError {
    ApplicationError::InvalidTrainingSegmentCriterion("segment criterion definition is invalid")
}

fn invalid<T>(reason: &'static str) -> Result<T, ApplicationError> {
    Err(ApplicationError::InvalidTrainingSegmentCriterion(reason))
}
