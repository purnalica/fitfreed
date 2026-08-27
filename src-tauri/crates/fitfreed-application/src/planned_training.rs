use std::collections::BTreeSet;

use chrono::NaiveDate;
use fitfreed_domain::{
    resolve_planned_training_session_relation, PlannedTrainingCompletion, PlannedTrainingIntensity,
    PlannedTrainingSessionRelation, PlannedTrainingTarget, PlannedTrainingTargetKind,
};

use crate::ApplicationError;

const MAX_PAGE_SIZE: usize = 100;
const SNAPSHOT_PREFIX: &str = "planned-snapshot-";
const TARGET_PREFIX: &str = "planned-target-";
const SESSION_PREFIX: &str = "session-";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlannedTrainingCollection {
    Scheduled,
    FavoriteTemplates,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlannedTrainingCompletionFilter {
    Pending,
    Completed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlannedTrainingReconciliationState {
    Current,
    Conflicted,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlannedTrainingChronologyQuery {
    pub collection: PlannedTrainingCollection,
    pub completion: Option<PlannedTrainingCompletionFilter>,
    pub from: Option<String>,
    pub through: Option<String>,
    pub offset: usize,
    pub limit: usize,
    pub snapshot_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlannedTrainingTargetQuery {
    pub target_ref: String,
    pub snapshot_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlannedTrainingSessionRelationQuery {
    pub session_ref: String,
    pub training_snapshot_ref: Option<String>,
    pub snapshot_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlannedTrainingPlanShape {
    pub exercise_count: Option<usize>,
    pub phase_count: Option<usize>,
    pub expanded_phase_count: Option<usize>,
    pub repeat_block_count: Option<usize>,
    pub contains_intensity_evidence: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedPlannedTrainingTarget {
    pub source_index: usize,
    pub reconciliation_state: PlannedTrainingReconciliationState,
    pub target: PlannedTrainingTarget,
    pub candidate_session_refs: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedPlannedTrainingChronologyPage {
    pub snapshot_ref: String,
    pub total_count: usize,
    pub targets: Vec<PersistedPlannedTrainingTarget>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedPlannedTrainingTargetDetail {
    pub snapshot_ref: String,
    pub target: PersistedPlannedTrainingTarget,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedSessionPlannedTrainingCandidates {
    pub snapshot_ref: String,
    pub training_snapshot_ref: String,
    pub session_ref: String,
    pub targets: Vec<PersistedPlannedTrainingTarget>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PlannedTrainingTargetSummary {
    pub source_index: usize,
    pub reconciliation_state: PlannedTrainingReconciliationState,
    pub target: PlannedTrainingTarget,
    pub relation: PlannedTrainingSessionRelation,
    pub shape: PlannedTrainingPlanShape,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PlannedTrainingChronologyPage {
    pub snapshot_ref: String,
    pub total_count: usize,
    pub offset: usize,
    pub limit: usize,
    pub next_offset: Option<usize>,
    pub targets: Vec<PlannedTrainingTargetSummary>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PlannedTrainingTargetDetail {
    pub snapshot_ref: String,
    pub target: PlannedTrainingTargetSummary,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CompletedSessionPlannedTrainingRelation {
    Absent,
    Exact {
        target_ref: String,
    },
    Ambiguous {
        candidate_target_count: usize,
        candidate_session_count: usize,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct PlannedTrainingSessionRelationResult {
    pub snapshot_ref: String,
    pub training_snapshot_ref: String,
    pub session_ref: String,
    pub relation: CompletedSessionPlannedTrainingRelation,
    pub candidates: Vec<PlannedTrainingTargetSummary>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PlannedTrainingQueryPortError {
    SnapshotChanged,
    TrainingSnapshotChanged,
    NotFound,
    Failure(String),
}

pub trait PlannedTrainingQueryPort {
    fn planned_training_snapshot_ref(
        &self,
    ) -> Result<Option<String>, PlannedTrainingQueryPortError>;

    fn query_planned_training_chronology(
        &self,
        query: &PlannedTrainingChronologyQuery,
    ) -> Result<PersistedPlannedTrainingChronologyPage, PlannedTrainingQueryPortError>;

    fn query_planned_training_target(
        &self,
        query: &PlannedTrainingTargetQuery,
    ) -> Result<PersistedPlannedTrainingTargetDetail, PlannedTrainingQueryPortError>;

    fn query_session_planned_training_candidates(
        &self,
        query: &PlannedTrainingSessionRelationQuery,
    ) -> Result<PersistedSessionPlannedTrainingCandidates, PlannedTrainingQueryPortError>;
}

pub fn query_planned_training_chronology(
    port: &dyn PlannedTrainingQueryPort,
    query: PlannedTrainingChronologyQuery,
) -> Result<PlannedTrainingChronologyPage, ApplicationError> {
    validate_chronology_query(&query)?;
    let persisted = port
        .query_planned_training_chronology(&query)
        .map_err(map_port_error)?;
    validate_snapshot(&persisted.snapshot_ref, query.snapshot_ref.as_deref())?;
    if persisted.targets.len() > query.limit
        || query.offset > persisted.total_count
        || persisted.targets.len() > persisted.total_count
        || (!persisted.targets.is_empty() && query.offset >= persisted.total_count)
    {
        return query_failure("planned-training page count is inconsistent");
    }
    let consumed = query.offset.checked_add(persisted.targets.len()).ok_or(
        ApplicationError::PlannedTrainingQuery(
            "planned-training page offset overflowed".to_owned(),
        ),
    )?;
    if consumed > persisted.total_count {
        return query_failure("planned-training page exceeds its total count");
    }
    let mut target_refs = BTreeSet::new();
    let mut targets = Vec::with_capacity(persisted.targets.len());
    for target in persisted.targets {
        if !target_refs.insert(target.target.target_id().to_owned()) {
            return query_failure("planned-training page contains a duplicate target");
        }
        validate_collection_member(&query, &target.target)?;
        targets.push(summarize_target(target)?);
    }
    validate_chronology_order(query.collection, &targets)?;
    Ok(PlannedTrainingChronologyPage {
        snapshot_ref: persisted.snapshot_ref,
        total_count: persisted.total_count,
        offset: query.offset,
        limit: query.limit,
        next_offset: (consumed < persisted.total_count).then_some(consumed),
        targets,
    })
}

pub fn query_planned_training_target(
    port: &dyn PlannedTrainingQueryPort,
    query: PlannedTrainingTargetQuery,
) -> Result<PlannedTrainingTargetDetail, ApplicationError> {
    if !valid_opaque_ref(&query.target_ref, TARGET_PREFIX)
        || query
            .snapshot_ref
            .as_deref()
            .is_some_and(|snapshot| !valid_opaque_ref(snapshot, SNAPSHOT_PREFIX))
    {
        return invalid("target or snapshot reference is invalid");
    }
    let persisted = port
        .query_planned_training_target(&query)
        .map_err(map_port_error)?;
    validate_snapshot(&persisted.snapshot_ref, query.snapshot_ref.as_deref())?;
    if persisted.target.target.target_id() != query.target_ref {
        return query_failure("planned-training detail target does not match the request");
    }
    Ok(PlannedTrainingTargetDetail {
        snapshot_ref: persisted.snapshot_ref,
        target: summarize_target(persisted.target)?,
    })
}

pub fn query_session_planned_training_relation(
    port: &dyn PlannedTrainingQueryPort,
    query: PlannedTrainingSessionRelationQuery,
) -> Result<PlannedTrainingSessionRelationResult, ApplicationError> {
    if !valid_opaque_ref(&query.session_ref, SESSION_PREFIX)
        || query
            .training_snapshot_ref
            .as_deref()
            .is_some_and(|snapshot| !valid_opaque_ref(snapshot, "training-snapshot-"))
        || query
            .snapshot_ref
            .as_deref()
            .is_some_and(|snapshot| !valid_opaque_ref(snapshot, SNAPSHOT_PREFIX))
    {
        return invalid("session or snapshot reference is invalid");
    }
    let persisted = port
        .query_session_planned_training_candidates(&query)
        .map_err(map_port_error)?;
    validate_snapshot(&persisted.snapshot_ref, query.snapshot_ref.as_deref())?;
    if !valid_opaque_ref(&persisted.training_snapshot_ref, "training-snapshot-")
        || query
            .training_snapshot_ref
            .as_ref()
            .is_some_and(|expected| expected != &persisted.training_snapshot_ref)
    {
        return Err(ApplicationError::PlannedTrainingChanged);
    }
    if persisted.session_ref != query.session_ref {
        return query_failure("planned-training session result does not match the request");
    }

    let mut target_refs = BTreeSet::new();
    let mut session_refs = BTreeSet::new();
    let mut candidates = Vec::with_capacity(persisted.targets.len());
    for target in persisted.targets {
        if !matches!(
            target.target.kind(),
            PlannedTrainingTargetKind::Scheduled {
                completion: PlannedTrainingCompletion::Completed,
                ..
            }
        ) || !target_refs.insert(target.target.target_id().to_owned())
            || !target
                .candidate_session_refs
                .iter()
                .any(|session_ref| session_ref == &query.session_ref)
        {
            return query_failure("planned-training session candidates are inconsistent");
        }
        session_refs.extend(target.candidate_session_refs.iter().cloned());
        candidates.push(summarize_target(target)?);
    }
    candidates.sort_by(|left, right| left.target.target_id().cmp(right.target.target_id()));
    let relation = match candidates.as_slice() {
        [] => CompletedSessionPlannedTrainingRelation::Absent,
        [candidate]
            if matches!(
                &candidate.relation,
                PlannedTrainingSessionRelation::Exact { session_ref }
                    if session_ref == &query.session_ref
            ) =>
        {
            CompletedSessionPlannedTrainingRelation::Exact {
                target_ref: candidate.target.target_id().to_owned(),
            }
        }
        _ => CompletedSessionPlannedTrainingRelation::Ambiguous {
            candidate_target_count: candidates.len(),
            candidate_session_count: session_refs.len(),
        },
    };
    Ok(PlannedTrainingSessionRelationResult {
        snapshot_ref: persisted.snapshot_ref,
        training_snapshot_ref: persisted.training_snapshot_ref,
        session_ref: persisted.session_ref,
        relation,
        candidates,
    })
}

fn validate_chronology_query(
    query: &PlannedTrainingChronologyQuery,
) -> Result<(), ApplicationError> {
    if !(1..=MAX_PAGE_SIZE).contains(&query.limit)
        || query.offset.checked_add(query.limit).is_none()
        || query
            .snapshot_ref
            .as_deref()
            .is_some_and(|snapshot| !valid_opaque_ref(snapshot, SNAPSHOT_PREFIX))
    {
        return invalid("page or snapshot is invalid");
    }
    if query.collection == PlannedTrainingCollection::FavoriteTemplates
        && (query.completion.is_some() || query.from.is_some() || query.through.is_some())
    {
        return invalid("favorite templates cannot use schedule filters");
    }
    let from = query.from.as_deref().map(parse_date).transpose()?;
    let through = query.through.as_deref().map(parse_date).transpose()?;
    if from
        .zip(through)
        .is_some_and(|(from, through)| from > through)
    {
        return invalid("date bounds are not ordered");
    }
    Ok(())
}

fn validate_snapshot(actual: &str, expected: Option<&str>) -> Result<(), ApplicationError> {
    if !valid_opaque_ref(actual, SNAPSHOT_PREFIX) {
        return query_failure("planned-training snapshot reference is invalid");
    }
    if expected.is_some_and(|expected| expected != actual) {
        return Err(ApplicationError::PlannedTrainingChanged);
    }
    Ok(())
}

fn validate_collection_member(
    query: &PlannedTrainingChronologyQuery,
    target: &PlannedTrainingTarget,
) -> Result<(), ApplicationError> {
    match (query.collection, target.kind()) {
        (
            PlannedTrainingCollection::Scheduled,
            PlannedTrainingTargetKind::Scheduled {
                scheduled_at_local,
                completion,
            },
        ) => {
            let local_date = scheduled_at_local.get(..10).ok_or_else(|| {
                ApplicationError::PlannedTrainingQuery(
                    "scheduled target has no canonical local date".to_owned(),
                )
            })?;
            if query.from.as_deref().is_some_and(|from| local_date < from)
                || query
                    .through
                    .as_deref()
                    .is_some_and(|through| local_date > through)
                || query.completion.is_some_and(|filter| {
                    !matches!(
                        (filter, completion),
                        (
                            PlannedTrainingCompletionFilter::Pending,
                            PlannedTrainingCompletion::Pending
                        ) | (
                            PlannedTrainingCompletionFilter::Completed,
                            PlannedTrainingCompletion::Completed
                        )
                    )
                })
            {
                return query_failure(
                    "planned-training target does not match the requested filters",
                );
            }
        }
        (
            PlannedTrainingCollection::FavoriteTemplates,
            PlannedTrainingTargetKind::FavoriteTemplate,
        ) => {}
        _ => return query_failure("planned-training collection contains the wrong target kind"),
    }
    Ok(())
}

fn summarize_target(
    persisted: PersistedPlannedTrainingTarget,
) -> Result<PlannedTrainingTargetSummary, ApplicationError> {
    if persisted.source_index == 0 || !valid_opaque_ref(persisted.target.target_id(), TARGET_PREFIX)
    {
        return query_failure("planned-training target identity is invalid");
    }
    if !matches!(
        persisted.target.kind(),
        PlannedTrainingTargetKind::Scheduled {
            completion: PlannedTrainingCompletion::Completed,
            ..
        }
    ) && !persisted.candidate_session_refs.is_empty()
    {
        return query_failure("a non-completed target contains session candidates");
    }
    let relation = resolve_planned_training_session_relation(
        &persisted.target,
        &persisted.candidate_session_refs,
    )
    .map_err(|error| ApplicationError::PlannedTrainingQuery(error.to_string()))?;
    let shape = plan_shape(&persisted.target);
    Ok(PlannedTrainingTargetSummary {
        source_index: persisted.source_index,
        reconciliation_state: persisted.reconciliation_state,
        target: persisted.target,
        relation,
        shape,
    })
}

fn plan_shape(target: &PlannedTrainingTarget) -> PlannedTrainingPlanShape {
    let Some(exercises) = target.exercises() else {
        return PlannedTrainingPlanShape {
            exercise_count: None,
            phase_count: None,
            expanded_phase_count: None,
            repeat_block_count: None,
            contains_intensity_evidence: false,
        };
    };
    let contains_intensity_evidence = exercises.iter().any(|exercise| {
        exercise.phases.as_deref().is_some_and(|phases| {
            phases
                .iter()
                .any(|phase| !matches!(phase.intensity, PlannedTrainingIntensity::None))
        })
    });
    if exercises.iter().any(|exercise| exercise.phases.is_none()) {
        return PlannedTrainingPlanShape {
            exercise_count: Some(exercises.len()),
            phase_count: None,
            expanded_phase_count: None,
            repeat_block_count: None,
            contains_intensity_evidence,
        };
    }
    let mut phase_count = 0;
    let mut expanded_phase_count = 0;
    let mut repeat_block_count = 0;
    for exercise in exercises {
        let phases = exercise.phases.as_deref().unwrap_or_default();
        phase_count += phases.len();
        let repeats = phases
            .iter()
            .filter_map(|phase| {
                phase.transition.repeat.as_ref().map(|repeat| {
                    (
                        repeat.return_to_phase_ordinal,
                        phase.ordinal,
                        usize::from(repeat.total_iterations),
                    )
                })
            })
            .collect::<Vec<_>>();
        repeat_block_count += repeats.len();
        expanded_phase_count += phases
            .iter()
            .map(|phase| {
                repeats
                    .iter()
                    .filter(|(from, through, _)| {
                        *from <= phase.ordinal && phase.ordinal <= *through
                    })
                    .map(|(_, _, iterations)| *iterations)
                    .product::<usize>()
            })
            .sum::<usize>();
    }
    PlannedTrainingPlanShape {
        exercise_count: Some(exercises.len()),
        phase_count: Some(phase_count),
        expanded_phase_count: Some(expanded_phase_count),
        repeat_block_count: Some(repeat_block_count),
        contains_intensity_evidence,
    }
}

fn validate_chronology_order(
    collection: PlannedTrainingCollection,
    targets: &[PlannedTrainingTargetSummary],
) -> Result<(), ApplicationError> {
    for pair in targets.windows(2) {
        let [left, right] = pair else {
            continue;
        };
        let ordered = match collection {
            PlannedTrainingCollection::Scheduled => {
                let PlannedTrainingTargetKind::Scheduled {
                    scheduled_at_local: left_time,
                    ..
                } = left.target.kind()
                else {
                    return query_failure("scheduled chronology contains a template");
                };
                let PlannedTrainingTargetKind::Scheduled {
                    scheduled_at_local: right_time,
                    ..
                } = right.target.kind()
                else {
                    return query_failure("scheduled chronology contains a template");
                };
                left_time > right_time
                    || (left_time == right_time
                        && left.target.target_id() < right.target.target_id())
            }
            PlannedTrainingCollection::FavoriteTemplates => {
                left.target.name() < right.target.name()
                    || (left.target.name() == right.target.name()
                        && left.target.target_id() < right.target.target_id())
            }
        };
        if !ordered {
            return query_failure("planned-training chronology is not ordered");
        }
    }
    Ok(())
}

fn map_port_error(error: PlannedTrainingQueryPortError) -> ApplicationError {
    match error {
        PlannedTrainingQueryPortError::SnapshotChanged
        | PlannedTrainingQueryPortError::TrainingSnapshotChanged => {
            ApplicationError::PlannedTrainingChanged
        }
        PlannedTrainingQueryPortError::NotFound => ApplicationError::PlannedTrainingNotFound,
        PlannedTrainingQueryPortError::Failure(message) => {
            ApplicationError::PlannedTrainingQuery(message)
        }
    }
}

fn parse_date(value: &str) -> Result<NaiveDate, ApplicationError> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .ok()
        .filter(|parsed| parsed.format("%Y-%m-%d").to_string() == value)
        .ok_or(ApplicationError::InvalidPlannedTrainingQuery(
            "date is invalid",
        ))
}

fn invalid<T>(message: &'static str) -> Result<T, ApplicationError> {
    Err(ApplicationError::InvalidPlannedTrainingQuery(message))
}

fn query_failure<T>(message: impl Into<String>) -> Result<T, ApplicationError> {
    Err(ApplicationError::PlannedTrainingQuery(message.into()))
}

fn valid_opaque_ref(value: &str, prefix: &str) -> bool {
    let Some(suffix) = value.strip_prefix(prefix) else {
        return false;
    };
    suffix.len() == 64
        && suffix
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}
