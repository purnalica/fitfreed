use std::cell::Cell;

use fitfreed_domain::{
    PlannedTrainingCompletion, PlannedTrainingEditability, PlannedTrainingExercise,
    PlannedTrainingExerciseKind, PlannedTrainingIntensity, PlannedTrainingIntensityMetric,
    PlannedTrainingMappingCoverage, PlannedTrainingPhase, PlannedTrainingPhaseChange,
    PlannedTrainingPhaseGoal, PlannedTrainingRepeat, PlannedTrainingSessionRelation,
    PlannedTrainingSport, PlannedTrainingTarget, PlannedTrainingTargetKind,
    PlannedTrainingTransition,
};

use super::*;

#[derive(Clone)]
struct StubPort {
    chronology: Result<PersistedPlannedTrainingChronologyPage, PlannedTrainingQueryPortError>,
    detail: Result<PersistedPlannedTrainingTargetDetail, PlannedTrainingQueryPortError>,
    session: Result<PersistedSessionPlannedTrainingCandidates, PlannedTrainingQueryPortError>,
    calls: Cell<usize>,
}

impl PlannedTrainingQueryPort for StubPort {
    fn planned_training_snapshot_ref(
        &self,
    ) -> Result<Option<String>, PlannedTrainingQueryPortError> {
        self.detail
            .as_ref()
            .map(|detail| Some(detail.snapshot_ref.clone()))
            .or_else(|_| {
                self.chronology
                    .as_ref()
                    .map(|chronology| Some(chronology.snapshot_ref.clone()))
            })
            .or_else(|_| {
                self.session
                    .as_ref()
                    .map(|session| Some(session.snapshot_ref.clone()))
            })
            .map_err(Clone::clone)
    }

    fn query_planned_training_chronology(
        &self,
        _query: &PlannedTrainingChronologyQuery,
    ) -> Result<PersistedPlannedTrainingChronologyPage, PlannedTrainingQueryPortError> {
        self.calls.set(self.calls.get() + 1);
        self.chronology.clone()
    }

    fn query_planned_training_target(
        &self,
        _query: &PlannedTrainingTargetQuery,
    ) -> Result<PersistedPlannedTrainingTargetDetail, PlannedTrainingQueryPortError> {
        self.calls.set(self.calls.get() + 1);
        self.detail.clone()
    }

    fn query_session_planned_training_candidates(
        &self,
        _query: &PlannedTrainingSessionRelationQuery,
    ) -> Result<PersistedSessionPlannedTrainingCandidates, PlannedTrainingQueryPortError> {
        self.calls.set(self.calls.get() + 1);
        self.session.clone()
    }
}

fn opaque(prefix: &str, value: char) -> String {
    let seed = format!("{:x}", u32::from(value));
    let suffix = seed.repeat(64).chars().take(64).collect::<String>();
    format!("{prefix}{suffix}")
}

fn snapshot() -> String {
    opaque("planned-snapshot-", 'a')
}

fn training_snapshot() -> String {
    opaque("training-snapshot-", 'b')
}

fn session(value: char) -> String {
    opaque("session-", value)
}

fn scheduled_target(
    value: char,
    scheduled_at_local: &str,
    completion: PlannedTrainingCompletion,
) -> PlannedTrainingTarget {
    PlannedTrainingTarget::restore(
        "origin-a",
        opaque("planned-target-", value),
        opaque("planned-evidence-", value),
        PlannedTrainingTargetKind::Scheduled {
            scheduled_at_local: scheduled_at_local.to_owned(),
            completion,
        },
        format!("Workout {value}"),
        Some("Source-authored purpose".to_owned()),
        PlannedTrainingEditability::Editable,
        Some(vec![PlannedTrainingExercise {
            exercise_id: opaque("planned-exercise-", value),
            ordinal: 0,
            kind: PlannedTrainingExerciseKind::Phased,
            duration_goal_milliseconds: None,
            distance_goal_meters: None,
            sport: PlannedTrainingSport::Unmapped,
            phases: Some(vec![
                PlannedTrainingPhase {
                    phase_id: opaque("planned-phase-", value),
                    ordinal: 0,
                    name: "Work".to_owned(),
                    goal: PlannedTrainingPhaseGoal::DurationMilliseconds(60_000),
                    intensity: PlannedTrainingIntensity::ZoneRange {
                        metric: PlannedTrainingIntensityMetric::HeartRate,
                        lower_zone: 3,
                        upper_zone: 4,
                    },
                    transition: PlannedTrainingTransition {
                        transition_id: opaque("planned-transition-", value),
                        change: PlannedTrainingPhaseChange::Automatic,
                        repeat: None,
                    },
                },
                PlannedTrainingPhase {
                    phase_id: opaque("planned-phase-", next_char(value)),
                    ordinal: 1,
                    name: "Recovery".to_owned(),
                    goal: PlannedTrainingPhaseGoal::DurationMilliseconds(30_000),
                    intensity: PlannedTrainingIntensity::None,
                    transition: PlannedTrainingTransition {
                        transition_id: opaque("planned-transition-", next_char(value)),
                        change: PlannedTrainingPhaseChange::Automatic,
                        repeat: Some(PlannedTrainingRepeat {
                            repeat_id: opaque("planned-repeat-", value),
                            return_to_phase_ordinal: 0,
                            total_iterations: 3,
                        }),
                    },
                },
            ]),
        }]),
        PlannedTrainingMappingCoverage::complete(),
    )
    .unwrap()
}

fn favorite_target(value: char) -> PlannedTrainingTarget {
    PlannedTrainingTarget::restore(
        "origin-a",
        opaque("planned-target-", value),
        opaque("planned-evidence-", value),
        PlannedTrainingTargetKind::FavoriteTemplate,
        format!("Template {value}"),
        None,
        PlannedTrainingEditability::Unspecified,
        None,
        PlannedTrainingMappingCoverage::complete(),
    )
    .unwrap()
}

fn next_char(value: char) -> char {
    char::from_u32(u32::from(value) + 1).unwrap()
}

fn persisted(
    target: PlannedTrainingTarget,
    candidates: Vec<String>,
) -> PersistedPlannedTrainingTarget {
    PersistedPlannedTrainingTarget {
        source_index: 1,
        reconciliation_state: PlannedTrainingReconciliationState::Current,
        target,
        candidate_session_refs: candidates,
    }
}

fn chronology_query() -> PlannedTrainingChronologyQuery {
    PlannedTrainingChronologyQuery {
        collection: PlannedTrainingCollection::Scheduled,
        completion: None,
        from: None,
        through: None,
        offset: 0,
        limit: 25,
        snapshot_ref: None,
    }
}

fn stub(
    chronology: Result<PersistedPlannedTrainingChronologyPage, PlannedTrainingQueryPortError>,
) -> StubPort {
    let fallback_target = persisted(
        scheduled_target(
            'c',
            "2026-08-20T08:00:00",
            PlannedTrainingCompletion::Completed,
        ),
        vec![session('c')],
    );
    StubPort {
        chronology,
        detail: Ok(PersistedPlannedTrainingTargetDetail {
            snapshot_ref: snapshot(),
            target: fallback_target.clone(),
        }),
        session: Ok(PersistedSessionPlannedTrainingCandidates {
            snapshot_ref: snapshot(),
            training_snapshot_ref: training_snapshot(),
            session_ref: session('c'),
            targets: vec![fallback_target],
        }),
        calls: Cell::new(0),
    }
}

#[test]
fn returns_a_bounded_chronology_with_exact_relationship_and_plan_shape() {
    let target = scheduled_target(
        'c',
        "2026-08-20T08:00:00",
        PlannedTrainingCompletion::Completed,
    );
    let port = stub(Ok(PersistedPlannedTrainingChronologyPage {
        snapshot_ref: snapshot(),
        total_count: 1,
        targets: vec![persisted(target.clone(), vec![session('c')])],
    }));

    let page = query_planned_training_chronology(&port, chronology_query()).unwrap();

    assert_eq!(page.total_count, 1);
    assert_eq!(page.next_offset, None);
    assert_eq!(page.targets[0].target, target);
    assert_eq!(
        page.targets[0].relation,
        PlannedTrainingSessionRelation::Exact {
            session_ref: session('c')
        }
    );
    assert_eq!(
        page.targets[0].shape,
        PlannedTrainingPlanShape {
            exercise_count: Some(1),
            phase_count: Some(2),
            expanded_phase_count: Some(6),
            repeat_block_count: Some(1),
            contains_intensity_evidence: true,
        }
    );
}

#[test]
fn preserves_favorite_template_optional_structure_without_session_candidates() {
    let target = favorite_target('d');
    let port = stub(Ok(PersistedPlannedTrainingChronologyPage {
        snapshot_ref: snapshot(),
        total_count: 1,
        targets: vec![persisted(target.clone(), Vec::new())],
    }));
    let mut query = chronology_query();
    query.collection = PlannedTrainingCollection::FavoriteTemplates;

    let page = query_planned_training_chronology(&port, query).unwrap();

    assert_eq!(page.targets[0].target, target);
    assert_eq!(
        page.targets[0].relation,
        PlannedTrainingSessionRelation::NotApplicable
    );
    assert_eq!(
        page.targets[0].shape,
        PlannedTrainingPlanShape {
            exercise_count: None,
            phase_count: None,
            expanded_phase_count: None,
            repeat_block_count: None,
            contains_intensity_evidence: false,
        }
    );
}

#[test]
fn rejects_invalid_chronology_input_before_calling_the_port() {
    let port = stub(Err(PlannedTrainingQueryPortError::Failure(
        "must not be called".to_owned(),
    )));
    let mut query = chronology_query();
    query.limit = 0;
    query.from = Some("2026-08-20".to_owned());
    query.through = Some("2026-08-19".to_owned());

    assert!(matches!(
        query_planned_training_chronology(&port, query),
        Err(ApplicationError::InvalidPlannedTrainingQuery(_))
    ));
    assert_eq!(port.calls.get(), 0);
}

#[test]
fn rejects_candidates_for_pending_targets_and_wrong_collection_members() {
    let pending = scheduled_target(
        'e',
        "2026-08-20T08:00:00",
        PlannedTrainingCompletion::Pending,
    );
    let port = stub(Ok(PersistedPlannedTrainingChronologyPage {
        snapshot_ref: snapshot(),
        total_count: 1,
        targets: vec![persisted(pending, vec![session('e')])],
    }));
    assert!(matches!(
        query_planned_training_chronology(&port, chronology_query()),
        Err(ApplicationError::PlannedTrainingQuery(_))
    ));

    let favorite = favorite_target('f');
    let port = stub(Ok(PersistedPlannedTrainingChronologyPage {
        snapshot_ref: snapshot(),
        total_count: 1,
        targets: vec![persisted(favorite, Vec::new())],
    }));
    assert!(matches!(
        query_planned_training_chronology(&port, chronology_query()),
        Err(ApplicationError::PlannedTrainingQuery(_))
    ));
}

#[test]
fn returns_complete_target_detail_and_maps_not_found_and_stale_results() {
    let target = scheduled_target(
        'g',
        "2026-08-20T08:00:00",
        PlannedTrainingCompletion::Completed,
    );
    let mut port = stub(Err(PlannedTrainingQueryPortError::Failure(
        "unused".to_owned(),
    )));
    port.detail = Ok(PersistedPlannedTrainingTargetDetail {
        snapshot_ref: snapshot(),
        target: persisted(target.clone(), vec![session('g')]),
    });
    let result = query_planned_training_target(
        &port,
        PlannedTrainingTargetQuery {
            target_ref: target.target_id().to_owned(),
            snapshot_ref: Some(snapshot()),
        },
    )
    .unwrap();
    assert_eq!(result.target.target, target);
    assert!(matches!(
        result.target.relation,
        PlannedTrainingSessionRelation::Exact { .. }
    ));

    port.detail = Err(PlannedTrainingQueryPortError::NotFound);
    assert!(matches!(
        query_planned_training_target(
            &port,
            PlannedTrainingTargetQuery {
                target_ref: opaque("planned-target-", 'g'),
                snapshot_ref: None,
            }
        ),
        Err(ApplicationError::PlannedTrainingNotFound)
    ));

    port.detail = Err(PlannedTrainingQueryPortError::SnapshotChanged);
    assert!(matches!(
        query_planned_training_target(
            &port,
            PlannedTrainingTargetQuery {
                target_ref: opaque("planned-target-", 'g'),
                snapshot_ref: Some(snapshot()),
            }
        ),
        Err(ApplicationError::PlannedTrainingChanged)
    ));
}

#[test]
fn resolves_one_exact_target_for_a_completed_session() {
    let target = scheduled_target(
        'h',
        "2026-08-20T08:00:00",
        PlannedTrainingCompletion::Completed,
    );
    let expected_target_ref = target.target_id().to_owned();
    let mut port = stub(Err(PlannedTrainingQueryPortError::Failure(
        "unused".to_owned(),
    )));
    port.session = Ok(PersistedSessionPlannedTrainingCandidates {
        snapshot_ref: snapshot(),
        training_snapshot_ref: training_snapshot(),
        session_ref: session('h'),
        targets: vec![persisted(target, vec![session('h')])],
    });

    let result = query_session_planned_training_relation(
        &port,
        PlannedTrainingSessionRelationQuery {
            session_ref: session('h'),
            training_snapshot_ref: Some(training_snapshot()),
            snapshot_ref: None,
        },
    )
    .unwrap();

    assert_eq!(
        result.relation,
        CompletedSessionPlannedTrainingRelation::Exact {
            target_ref: expected_target_ref
        }
    );
    assert_eq!(result.candidates.len(), 1);
}

#[test]
fn keeps_multiple_session_or_target_candidates_ambiguous() {
    let target = scheduled_target(
        'i',
        "2026-08-20T08:00:00",
        PlannedTrainingCompletion::Completed,
    );
    let mut port = stub(Err(PlannedTrainingQueryPortError::Failure(
        "unused".to_owned(),
    )));
    port.session = Ok(PersistedSessionPlannedTrainingCandidates {
        snapshot_ref: snapshot(),
        training_snapshot_ref: training_snapshot(),
        session_ref: session('i'),
        targets: vec![persisted(target, vec![session('i'), session('j')])],
    });
    let result = query_session_planned_training_relation(
        &port,
        PlannedTrainingSessionRelationQuery {
            session_ref: session('i'),
            training_snapshot_ref: None,
            snapshot_ref: None,
        },
    )
    .unwrap();
    assert_eq!(
        result.relation,
        CompletedSessionPlannedTrainingRelation::Ambiguous {
            candidate_target_count: 1,
            candidate_session_count: 2,
        }
    );

    let first = scheduled_target(
        'j',
        "2026-08-20T08:00:00",
        PlannedTrainingCompletion::Completed,
    );
    let second = scheduled_target(
        'k',
        "2026-08-20T08:00:00",
        PlannedTrainingCompletion::Completed,
    );
    port.session = Ok(PersistedSessionPlannedTrainingCandidates {
        snapshot_ref: snapshot(),
        training_snapshot_ref: training_snapshot(),
        session_ref: session('i'),
        targets: vec![
            persisted(first, vec![session('i')]),
            persisted(second, vec![session('i')]),
        ],
    });
    let result = query_session_planned_training_relation(
        &port,
        PlannedTrainingSessionRelationQuery {
            session_ref: session('i'),
            training_snapshot_ref: None,
            snapshot_ref: None,
        },
    )
    .unwrap();
    assert_eq!(
        result.relation,
        CompletedSessionPlannedTrainingRelation::Ambiguous {
            candidate_target_count: 2,
            candidate_session_count: 1,
        }
    );
}

#[test]
fn rejects_a_session_candidate_set_that_does_not_contain_the_requested_session() {
    let target = scheduled_target(
        'l',
        "2026-08-20T08:00:00",
        PlannedTrainingCompletion::Completed,
    );
    let mut port = stub(Err(PlannedTrainingQueryPortError::Failure(
        "unused".to_owned(),
    )));
    port.session = Ok(PersistedSessionPlannedTrainingCandidates {
        snapshot_ref: snapshot(),
        training_snapshot_ref: training_snapshot(),
        session_ref: session('l'),
        targets: vec![persisted(target, vec![session('m')])],
    });

    assert!(matches!(
        query_session_planned_training_relation(
            &port,
            PlannedTrainingSessionRelationQuery {
                session_ref: session('l'),
                training_snapshot_ref: None,
                snapshot_ref: None,
            }
        ),
        Err(ApplicationError::PlannedTrainingQuery(_))
    ));
}
