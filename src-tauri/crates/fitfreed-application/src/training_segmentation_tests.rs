use std::{cell::RefCell, collections::BTreeMap};

use fitfreed_domain::{SegmentCriterion, SegmentCriterionDefinition};

use super::{
    apply_training_segment_criterion, create_training_segment_criterion,
    move_training_segment_criterion, query_training_session_segmentation,
    remove_training_segment_criterion, update_training_segment_criterion, ApplicationError,
    CreateTrainingSegmentCriterionRequest, MoveTrainingSegmentCriterionRequest,
    PersistedTrainingExerciseSegmentation, PersistedTrainingSessionSegmentation,
    SegmentApplicabilityView, SegmentMeasurementView, SegmentSignalEvidence, SegmentSignalKind,
    SegmentSignalSample, TrainingSegmentCriterionDirection,
    TrainingSegmentCriterionMutationRequest, TrainingSegmentationPort,
    TrainingSegmentationPortError, TrainingSessionSegmentationQuery,
    UpdateTrainingSegmentCriterionRequest,
};

const SNAPSHOT_REF: &str = concat!(
    "training-snapshot-",
    "1111111111111111111111111111111111111111111111111111111111111111"
);
const SESSION_REF: &str = concat!(
    "session-",
    "2222222222222222222222222222222222222222222222222222222222222222"
);
const EXERCISE_REF: &str = concat!(
    "exercise-",
    "3333333333333333333333333333333333333333333333333333333333333333"
);
const DISTANCE_SIGNAL_REF: &str = concat!(
    "signal-",
    "4444444444444444444444444444444444444444444444444444444444444444"
);
const HEART_RATE_SIGNAL_REF: &str = concat!(
    "signal-",
    "5555555555555555555555555555555555555555555555555555555555555555"
);

fn criterion_id(index: usize) -> String {
    format!("criterion-{index:064x}")
}

fn criterion(
    index: usize,
    title: &str,
    definition: SegmentCriterionDefinition,
) -> SegmentCriterion {
    SegmentCriterion::create(criterion_id(index), title, definition).expect("valid criterion")
}

struct ControlledPort {
    persisted: RefCell<PersistedTrainingSessionSegmentation>,
    samples: BTreeMap<String, Vec<SegmentSignalSample>>,
    next_criterion_id: String,
}

impl ControlledPort {
    fn new(
        criteria: Vec<SegmentCriterion>,
        exercise: PersistedTrainingExerciseSegmentation,
        samples: BTreeMap<String, Vec<SegmentSignalSample>>,
    ) -> Self {
        Self {
            persisted: RefCell::new(PersistedTrainingSessionSegmentation {
                snapshot_ref: SNAPSHOT_REF.to_owned(),
                session_ref: SESSION_REF.to_owned(),
                criteria,
                exercises: Some(vec![exercise]),
            }),
            samples,
            next_criterion_id: criterion_id(99),
        }
    }
}

impl TrainingSegmentationPort for ControlledPort {
    fn query_training_session_segmentation(
        &self,
        _query: &TrainingSessionSegmentationQuery,
    ) -> Result<PersistedTrainingSessionSegmentation, TrainingSegmentationPortError> {
        Ok(self.persisted.borrow().clone())
    }

    fn visit_segment_signal_samples(
        &self,
        _snapshot_ref: &str,
        _session_ref: &str,
        signal_ref: &str,
        visitor: &mut dyn FnMut(SegmentSignalSample) -> Result<(), String>,
    ) -> Result<(), TrainingSegmentationPortError> {
        for sample in self.samples.get(signal_ref).into_iter().flatten().cloned() {
            visitor(sample).map_err(TrainingSegmentationPortError::Failure)?;
        }
        Ok(())
    }

    fn new_segment_criterion_id(&self) -> Result<String, TrainingSegmentationPortError> {
        Ok(self.next_criterion_id.clone())
    }

    fn create_and_apply_segment_criterion(
        &self,
        _snapshot_ref: &str,
        _session_ref: &str,
        exercise_ref: &str,
        criterion: &SegmentCriterion,
    ) -> Result<(), TrainingSegmentationPortError> {
        let mut persisted = self.persisted.borrow_mut();
        persisted.criteria.push(criterion.clone());
        let exercise = persisted
            .exercises
            .as_mut()
            .and_then(|exercises| {
                exercises
                    .iter_mut()
                    .find(|exercise| exercise.exercise_ref == exercise_ref)
            })
            .ok_or(TrainingSegmentationPortError::NotFound)?;
        exercise
            .applied_criterion_refs
            .push(criterion.criterion_id().to_owned());
        Ok(())
    }

    fn compare_and_save_segment_criterion(
        &self,
        expected_revision: u64,
        criterion: &SegmentCriterion,
    ) -> Result<bool, TrainingSegmentationPortError> {
        let mut persisted = self.persisted.borrow_mut();
        let existing = persisted
            .criteria
            .iter_mut()
            .find(|existing| existing.criterion_id() == criterion.criterion_id())
            .ok_or(TrainingSegmentationPortError::NotFound)?;
        if existing.revision() != expected_revision {
            return Ok(false);
        }
        *existing = criterion.clone();
        Ok(true)
    }

    fn apply_segment_criterion(
        &self,
        _snapshot_ref: &str,
        _session_ref: &str,
        exercise_ref: &str,
        criterion_ref: &str,
    ) -> Result<(), TrainingSegmentationPortError> {
        let mut persisted = self.persisted.borrow_mut();
        if !persisted
            .criteria
            .iter()
            .any(|criterion| criterion.criterion_id() == criterion_ref)
        {
            return Err(TrainingSegmentationPortError::NotFound);
        }
        let exercise = persisted
            .exercises
            .as_mut()
            .and_then(|exercises| {
                exercises
                    .iter_mut()
                    .find(|exercise| exercise.exercise_ref == exercise_ref)
            })
            .ok_or(TrainingSegmentationPortError::NotFound)?;
        if exercise
            .applied_criterion_refs
            .iter()
            .any(|applied| applied == criterion_ref)
        {
            return Err(TrainingSegmentationPortError::AlreadyApplied);
        }
        exercise
            .applied_criterion_refs
            .push(criterion_ref.to_owned());
        Ok(())
    }

    fn remove_segment_criterion(
        &self,
        _snapshot_ref: &str,
        _session_ref: &str,
        exercise_ref: &str,
        criterion_ref: &str,
    ) -> Result<(), TrainingSegmentationPortError> {
        let mut persisted = self.persisted.borrow_mut();
        let exercise = persisted
            .exercises
            .as_mut()
            .and_then(|exercises| {
                exercises
                    .iter_mut()
                    .find(|exercise| exercise.exercise_ref == exercise_ref)
            })
            .ok_or(TrainingSegmentationPortError::NotFound)?;
        let index = exercise
            .applied_criterion_refs
            .iter()
            .position(|applied| applied == criterion_ref)
            .ok_or(TrainingSegmentationPortError::NotApplied)?;
        exercise.applied_criterion_refs.remove(index);
        Ok(())
    }

    fn move_segment_criterion(
        &self,
        _snapshot_ref: &str,
        _session_ref: &str,
        exercise_ref: &str,
        criterion_ref: &str,
        direction: TrainingSegmentCriterionDirection,
    ) -> Result<(), TrainingSegmentationPortError> {
        let mut persisted = self.persisted.borrow_mut();
        let exercise = persisted
            .exercises
            .as_mut()
            .and_then(|exercises| {
                exercises
                    .iter_mut()
                    .find(|exercise| exercise.exercise_ref == exercise_ref)
            })
            .ok_or(TrainingSegmentationPortError::NotFound)?;
        let index = exercise
            .applied_criterion_refs
            .iter()
            .position(|applied| applied == criterion_ref)
            .ok_or(TrainingSegmentationPortError::NotApplied)?;
        let target = match direction {
            TrainingSegmentCriterionDirection::Earlier if index > 0 => index - 1,
            TrainingSegmentCriterionDirection::Later
                if index + 1 < exercise.applied_criterion_refs.len() =>
            {
                index + 1
            }
            _ => index,
        };
        exercise.applied_criterion_refs.swap(index, target);
        Ok(())
    }
}

fn base_exercise(applied_criterion_refs: Vec<String>) -> PersistedTrainingExerciseSegmentation {
    PersistedTrainingExerciseSegmentation {
        exercise_ref: EXERCISE_REF.to_owned(),
        ordinal: 0,
        duration_milliseconds: 300_000,
        signals: vec![
            SegmentSignalEvidence {
                signal_ref: DISTANCE_SIGNAL_REF.to_owned(),
                kind: SegmentSignalKind::Distance,
                interval_milliseconds: 60_000,
                sample_count: 5,
            },
            SegmentSignalEvidence {
                signal_ref: HEART_RATE_SIGNAL_REF.to_owned(),
                kind: SegmentSignalKind::HeartRate,
                interval_milliseconds: 60_000,
                sample_count: 5,
            },
        ],
        applied_criterion_refs,
    }
}

fn samples() -> BTreeMap<String, Vec<SegmentSignalSample>> {
    BTreeMap::from([
        (
            DISTANCE_SIGNAL_REF.to_owned(),
            [0, 500_000, 1_000_000, 1_500_000, 2_000_000]
                .into_iter()
                .enumerate()
                .map(|(ordinal, value_milliunits)| SegmentSignalSample {
                    ordinal,
                    value_milliunits: Some(value_milliunits),
                })
                .collect(),
        ),
        (
            HEART_RATE_SIGNAL_REF.to_owned(),
            [
                Some(130_000),
                Some(145_000),
                Some(150_000),
                None,
                Some(155_000),
            ]
            .into_iter()
            .enumerate()
            .map(|(ordinal, value_milliunits)| SegmentSignalSample {
                ordinal,
                value_milliunits,
            })
            .collect(),
        ),
    ])
}

#[test]
fn evaluates_all_initial_criteria_without_overwriting_source_structure() {
    let criteria = vec![
        criterion(
            1,
            "Two halves",
            SegmentCriterionDefinition::EqualElapsedTime {
                span_milliseconds: 150_000,
            },
        ),
        criterion(
            2,
            "Every kilometre",
            SegmentCriterionDefinition::EqualDistance {
                span_meters: 1_000.0,
            },
        ),
        criterion(
            3,
            "Tempo zone",
            SegmentCriterionDefinition::HeartRateZone {
                minimum_beats_per_minute: 140,
                maximum_beats_per_minute: 159,
            },
        ),
        criterion(
            4,
            "Warm-up and work",
            SegmentCriterionDefinition::ManualBoundaries {
                elapsed_milliseconds: vec![100_000, 200_000],
            },
        ),
    ];
    let refs = criteria
        .iter()
        .map(|criterion| criterion.criterion_id().to_owned())
        .collect();
    let result = query_training_session_segmentation(
        &ControlledPort::new(criteria, base_exercise(refs), samples()),
        TrainingSessionSegmentationQuery {
            session_ref: SESSION_REF.to_owned(),
            snapshot_ref: Some(SNAPSHOT_REF.to_owned()),
        },
    )
    .expect("segmentation result");

    let applied = &result.exercises.expect("evaluated exercises")[0].applied_criteria;
    assert_eq!(applied.len(), 4);
    assert_eq!(applied[0].segments.len(), 2);
    assert_eq!(
        applied[0].segments[1].started_at_elapsed_milliseconds,
        150_000
    );
    assert_eq!(
        applied[1].required_measurement,
        Some(SegmentMeasurementView::Distance)
    );
    assert_eq!(applied[1].segments.len(), 3);
    assert_eq!(
        applied[1].segments[1].started_at_elapsed_milliseconds,
        120_000
    );
    assert_eq!(
        applied[2].required_measurement,
        Some(SegmentMeasurementView::HeartRate)
    );
    assert!(applied[2].has_evidence_gaps);
    assert_eq!(applied[2].segments.len(), 2);
    assert_eq!(
        applied[2].segments[0].started_at_elapsed_milliseconds,
        60_000
    );
    assert_eq!(
        applied[2].segments[0].ended_at_elapsed_milliseconds,
        180_000
    );
    assert_eq!(applied[3].segments.len(), 3);
    assert!(applied
        .iter()
        .all(|criterion| criterion.applicability == SegmentApplicabilityView::Applicable));
}

#[test]
fn explains_missing_ambiguous_incomplete_and_out_of_session_prerequisites() {
    let criteria = vec![
        criterion(
            1,
            "Distance",
            SegmentCriterionDefinition::EqualDistance {
                span_meters: 1_000.0,
            },
        ),
        criterion(
            2,
            "Zone",
            SegmentCriterionDefinition::HeartRateZone {
                minimum_beats_per_minute: 140,
                maximum_beats_per_minute: 159,
            },
        ),
        criterion(
            3,
            "Manual",
            SegmentCriterionDefinition::ManualBoundaries {
                elapsed_milliseconds: vec![400_000],
            },
        ),
    ];
    let refs = criteria
        .iter()
        .map(|criterion| criterion.criterion_id().to_owned())
        .collect();
    let mut exercise = base_exercise(refs);
    exercise.signals.clear();
    let result = query_training_session_segmentation(
        &ControlledPort::new(criteria, exercise, BTreeMap::new()),
        TrainingSessionSegmentationQuery {
            session_ref: SESSION_REF.to_owned(),
            snapshot_ref: None,
        },
    )
    .expect("honest unavailable result");
    let applied = &result.exercises.expect("exercise")[0].applied_criteria;
    assert_eq!(
        applied[0].applicability,
        SegmentApplicabilityView::MissingPrerequisite
    );
    assert_eq!(
        applied[1].applicability,
        SegmentApplicabilityView::MissingPrerequisite
    );
    assert_eq!(
        applied[2].applicability,
        SegmentApplicabilityView::OutsideSession
    );
}

#[test]
fn bounds_pathological_heart_rate_results_without_hiding_the_limit() {
    let criterion = criterion(
        1,
        "Alternating range",
        SegmentCriterionDefinition::HeartRateZone {
            minimum_beats_per_minute: 140,
            maximum_beats_per_minute: 159,
        },
    );
    let mut exercise = base_exercise(vec![criterion.criterion_id().to_owned()]);
    exercise.duration_milliseconds = 502_000;
    exercise.signals = vec![SegmentSignalEvidence {
        signal_ref: HEART_RATE_SIGNAL_REF.to_owned(),
        kind: SegmentSignalKind::HeartRate,
        interval_milliseconds: 1_000,
        sample_count: 502,
    }];
    let samples = BTreeMap::from([(
        HEART_RATE_SIGNAL_REF.to_owned(),
        (0..502)
            .map(|ordinal| SegmentSignalSample {
                ordinal,
                value_milliunits: Some(if ordinal % 2 == 0 { 150_000 } else { 120_000 }),
            })
            .collect(),
    )]);

    let result = query_training_session_segmentation(
        &ControlledPort::new(vec![criterion], exercise, samples),
        TrainingSessionSegmentationQuery {
            session_ref: SESSION_REF.to_owned(),
            snapshot_ref: Some(SNAPSHOT_REF.to_owned()),
        },
    )
    .expect("bounded segmentation result");

    let applied = &result.exercises.expect("exercise")[0].applied_criteria[0];
    assert_eq!(
        applied.applicability,
        SegmentApplicabilityView::TooManySegments
    );
    assert!(applied.segments.is_empty());
}

#[test]
fn evaluates_extreme_elapsed_durations_without_saturating_the_segment_count() {
    let span_milliseconds = i64::MAX / 2;
    let criterion = criterion(
        1,
        "Extreme duration",
        SegmentCriterionDefinition::EqualElapsedTime { span_milliseconds },
    );
    let mut exercise = base_exercise(vec![criterion.criterion_id().to_owned()]);
    exercise.duration_milliseconds = i64::MAX;
    exercise.signals.clear();

    let result = query_training_session_segmentation(
        &ControlledPort::new(vec![criterion], exercise, BTreeMap::new()),
        TrainingSessionSegmentationQuery {
            session_ref: SESSION_REF.to_owned(),
            snapshot_ref: Some(SNAPSHOT_REF.to_owned()),
        },
    )
    .expect("extreme duration result");

    let segments = &result.exercises.expect("exercise")[0].applied_criteria[0].segments;
    assert_eq!(segments.len(), 3);
    assert_eq!(
        segments[1].started_at_elapsed_milliseconds,
        span_milliseconds
    );
    assert_eq!(
        segments[2].started_at_elapsed_milliseconds,
        span_milliseconds * 2
    );
    assert_eq!(segments[2].ended_at_elapsed_milliseconds, i64::MAX);
}

#[test]
fn creates_edits_reuses_reorders_and_removes_persisted_criteria() {
    let existing = criterion(
        1,
        "Five minutes",
        SegmentCriterionDefinition::EqualElapsedTime {
            span_milliseconds: 300_000,
        },
    );
    let port = ControlledPort::new(vec![existing.clone()], base_exercise(vec![]), samples());

    let created = create_training_segment_criterion(
        &port,
        CreateTrainingSegmentCriterionRequest {
            session_ref: SESSION_REF.to_owned(),
            snapshot_ref: SNAPSHOT_REF.to_owned(),
            exercise_ref: EXERCISE_REF.to_owned(),
            title: "Manual plan".to_owned(),
            definition: SegmentCriterionDefinition::ManualBoundaries {
                elapsed_milliseconds: vec![100_000],
            },
        },
    )
    .expect("created and applied criterion");
    assert_eq!(
        created.exercises.as_ref().expect("exercise")[0]
            .applied_criteria
            .len(),
        1
    );

    let applied = apply_training_segment_criterion(
        &port,
        TrainingSegmentCriterionMutationRequest {
            session_ref: SESSION_REF.to_owned(),
            snapshot_ref: SNAPSHOT_REF.to_owned(),
            exercise_ref: EXERCISE_REF.to_owned(),
            criterion_ref: existing.criterion_id().to_owned(),
        },
    )
    .expect("reused criterion");
    assert_eq!(
        applied.exercises.as_ref().expect("exercise")[0]
            .applied_criteria
            .len(),
        2
    );

    let moved = move_training_segment_criterion(
        &port,
        MoveTrainingSegmentCriterionRequest {
            mutation: TrainingSegmentCriterionMutationRequest {
                session_ref: SESSION_REF.to_owned(),
                snapshot_ref: SNAPSHOT_REF.to_owned(),
                exercise_ref: EXERCISE_REF.to_owned(),
                criterion_ref: existing.criterion_id().to_owned(),
            },
            direction: TrainingSegmentCriterionDirection::Earlier,
        },
    )
    .expect("moved criterion");
    assert_eq!(
        moved.exercises.as_ref().expect("exercise")[0].applied_criteria[0]
            .criterion
            .criterion_id(),
        existing.criterion_id()
    );

    let updated = update_training_segment_criterion(
        &port,
        UpdateTrainingSegmentCriterionRequest {
            session_ref: SESSION_REF.to_owned(),
            snapshot_ref: SNAPSHOT_REF.to_owned(),
            criterion_ref: existing.criterion_id().to_owned(),
            expected_revision: 1,
            title: "One minute".to_owned(),
            definition: SegmentCriterionDefinition::EqualElapsedTime {
                span_milliseconds: 60_000,
            },
        },
    )
    .expect("updated criterion");
    assert_eq!(
        updated.available_criteria[0].revision(),
        2,
        "editing preserves identity and advances revision"
    );

    let removed = remove_training_segment_criterion(
        &port,
        TrainingSegmentCriterionMutationRequest {
            session_ref: SESSION_REF.to_owned(),
            snapshot_ref: SNAPSHOT_REF.to_owned(),
            exercise_ref: EXERCISE_REF.to_owned(),
            criterion_ref: existing.criterion_id().to_owned(),
        },
    )
    .expect("removed application");
    assert_eq!(
        removed.exercises.as_ref().expect("exercise")[0]
            .applied_criteria
            .len(),
        1
    );
    assert_eq!(
        removed.available_criteria.len(),
        2,
        "removal keeps reusable definition"
    );
}

#[test]
fn rejects_stale_edits_and_invalid_public_references() {
    let existing = criterion(
        1,
        "Five minutes",
        SegmentCriterionDefinition::EqualElapsedTime {
            span_milliseconds: 300_000,
        },
    );
    let port = ControlledPort::new(vec![existing.clone()], base_exercise(vec![]), samples());
    let stale = update_training_segment_criterion(
        &port,
        UpdateTrainingSegmentCriterionRequest {
            session_ref: SESSION_REF.to_owned(),
            snapshot_ref: SNAPSHOT_REF.to_owned(),
            criterion_ref: existing.criterion_id().to_owned(),
            expected_revision: 2,
            title: "Changed".to_owned(),
            definition: existing.definition().clone(),
        },
    );
    assert!(matches!(
        stale,
        Err(ApplicationError::TrainingSegmentCriterionConflict)
    ));

    let invalid = apply_training_segment_criterion(
        &port,
        TrainingSegmentCriterionMutationRequest {
            session_ref: "session-private-database-key".to_owned(),
            snapshot_ref: SNAPSHOT_REF.to_owned(),
            exercise_ref: EXERCISE_REF.to_owned(),
            criterion_ref: existing.criterion_id().to_owned(),
        },
    );
    assert!(matches!(
        invalid,
        Err(ApplicationError::InvalidTrainingSegmentCriterion(_))
    ));
}

#[test]
fn rejects_an_inconsistent_update_query_before_mutating_the_criterion() {
    let existing = criterion(
        1,
        "Five minutes",
        SegmentCriterionDefinition::EqualElapsedTime {
            span_milliseconds: 300_000,
        },
    );
    let port = ControlledPort::new(vec![existing.clone()], base_exercise(vec![]), samples());
    port.persisted.borrow_mut().snapshot_ref = format!("training-snapshot-{}", "a".repeat(64));

    let result = update_training_segment_criterion(
        &port,
        UpdateTrainingSegmentCriterionRequest {
            session_ref: SESSION_REF.to_owned(),
            snapshot_ref: SNAPSHOT_REF.to_owned(),
            criterion_ref: existing.criterion_id().to_owned(),
            expected_revision: 1,
            title: "One minute".to_owned(),
            definition: SegmentCriterionDefinition::EqualElapsedTime {
                span_milliseconds: 60_000,
            },
        },
    );

    assert!(matches!(
        result,
        Err(ApplicationError::TrainingSegmentationChanged)
    ));
    assert_eq!(port.persisted.borrow().criteria[0], existing);
}
