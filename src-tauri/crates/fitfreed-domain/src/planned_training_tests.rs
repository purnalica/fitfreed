use super::*;

fn digest(prefix: &str, character: char) -> String {
    format!("{prefix}{}", character.to_string().repeat(64))
}

fn phase(ordinal: usize, name: &str, repeat: Option<(usize, u16)>) -> PlannedTrainingPhase {
    PlannedTrainingPhase {
        phase_id: digest("planned-phase-", char::from(b'a' + ordinal as u8)),
        ordinal,
        name: Some(name.to_owned()),
        goal: PlannedTrainingPhaseGoal::DurationMilliseconds(60_000),
        intensity: PlannedTrainingIntensity::ZoneRange {
            metric: PlannedTrainingIntensityMetric::HeartRate,
            lower_zone: 2,
            upper_zone: 4,
        },
        transition: PlannedTrainingTransition {
            transition_id: digest("planned-transition-", char::from(b'a' + ordinal as u8)),
            change: PlannedTrainingPhaseChange::Automatic,
            repeat: repeat.map(|(return_to_phase_ordinal, total_iterations)| {
                PlannedTrainingRepeat {
                    repeat_id: digest("planned-repeat-", char::from(b'a' + ordinal as u8)),
                    return_to_phase_ordinal,
                    total_iterations,
                }
            }),
        },
    }
}

fn exercise(phases: Option<Vec<PlannedTrainingPhase>>) -> PlannedTrainingExercise {
    PlannedTrainingExercise {
        exercise_id: digest("planned-exercise-", 'a'),
        ordinal: 0,
        kind: PlannedTrainingExerciseKind::Phased,
        duration_goal_milliseconds: None,
        distance_goal_meters: None,
        sport: PlannedTrainingSport::Unmapped,
        phases,
    }
}

fn target(
    evidence_character: char,
    coverage: PlannedTrainingMappingCoverage,
    phases: Option<Vec<PlannedTrainingPhase>>,
) -> PlannedTrainingTarget {
    PlannedTrainingTarget::restore(
        "synthetic-origin",
        digest("planned-target-", 'a'),
        digest("planned-evidence-", evidence_character),
        PlannedTrainingTargetKind::Scheduled {
            scheduled_at_local: "2026-01-02T10:30:00".to_owned(),
            completion: PlannedTrainingCompletion::Completed,
        },
        "Progressive intervals",
        Some("A synthetic structured workout".to_owned()),
        PlannedTrainingEditability::Editable,
        Some(vec![exercise(phases)]),
        coverage,
    )
    .expect("valid planned target")
}

#[test]
fn restores_a_provider_neutral_repeated_phase_graph() {
    let phases = vec![
        phase(0, "Warm up", None),
        phase(1, "Work", None),
        phase(2, "Recovery", Some((1, 4))),
        phase(3, "Cool down", None),
    ];
    let target = target(
        'a',
        PlannedTrainingMappingCoverage::complete(),
        Some(phases),
    );

    assert_eq!(target.origin_id(), "synthetic-origin");
    assert_eq!(target.name(), "Progressive intervals");
    assert_eq!(target.mapping_coverage().unmapped_field_count(), 0);
    let exercises = target.exercises().expect("represented exercises");
    assert_eq!(exercises.len(), 1);
    let phases = exercises[0].phases.as_ref().expect("represented phases");
    assert_eq!(phases.len(), 4);
    assert_eq!(
        phases[2]
            .transition
            .repeat
            .as_ref()
            .expect("repeat transition")
            .total_iterations,
        4
    );
}

#[test]
fn preserves_an_unnamed_phase_as_absent_source_text() {
    let mut unnamed = phase(0, "Temporary", None);
    unnamed.name = None;

    let target = target(
        'a',
        PlannedTrainingMappingCoverage::complete(),
        Some(vec![unnamed]),
    );

    assert_eq!(
        target.exercises().expect("exercises")[0]
            .phases
            .as_ref()
            .expect("phases")[0]
            .name,
        None
    );
}

#[test]
fn preserves_absent_and_present_empty_structure_without_confusing_them() {
    let absent = target(
        'a',
        PlannedTrainingMappingCoverage::partial(1).expect("partial coverage"),
        None,
    );
    let empty = target(
        'b',
        PlannedTrainingMappingCoverage::partial(1).expect("partial coverage"),
        Some(Vec::new()),
    );

    assert!(absent.exercises().unwrap()[0].phases.is_none());
    assert_eq!(empty.exercises().unwrap()[0].phases, Some(Vec::new()));
}

#[test]
fn rejects_invalid_identity_order_bounds_and_repeat_graphs() {
    let valid_coverage = PlannedTrainingMappingCoverage::complete();
    let base_phases = vec![phase(0, "First", None), phase(1, "Second", None)];

    let mut invalid_identity = exercise(Some(base_phases.clone()));
    invalid_identity.exercise_id = "planned-exercise-not-a-digest".to_owned();
    assert!(matches!(
        PlannedTrainingTarget::restore(
            "synthetic-origin",
            digest("planned-target-", 'a'),
            digest("planned-evidence-", 'a'),
            PlannedTrainingTargetKind::FavoriteTemplate,
            "Template",
            None,
            PlannedTrainingEditability::Unspecified,
            Some(vec![invalid_identity]),
            valid_coverage,
        ),
        Err(PlannedTrainingTargetError::InvalidIdentifier)
    ));

    let mut unordered = base_phases.clone();
    unordered[1].ordinal = 2;
    assert!(matches!(
        PlannedTrainingTarget::restore(
            "synthetic-origin",
            digest("planned-target-", 'a'),
            digest("planned-evidence-", 'a'),
            PlannedTrainingTargetKind::FavoriteTemplate,
            "Template",
            None,
            PlannedTrainingEditability::Unspecified,
            Some(vec![exercise(Some(unordered))]),
            PlannedTrainingMappingCoverage::complete(),
        ),
        Err(PlannedTrainingTargetError::NonContiguousPhaseOrder)
    ));

    let invalid_zone = PlannedTrainingPhase {
        intensity: PlannedTrainingIntensity::ZoneRange {
            metric: PlannedTrainingIntensityMetric::Speed,
            lower_zone: 5,
            upper_zone: 2,
        },
        ..phase(0, "Invalid zone", None)
    };
    assert!(matches!(
        PlannedTrainingTarget::restore(
            "synthetic-origin",
            digest("planned-target-", 'a'),
            digest("planned-evidence-", 'a'),
            PlannedTrainingTargetKind::FavoriteTemplate,
            "Template",
            None,
            PlannedTrainingEditability::Unspecified,
            Some(vec![exercise(Some(vec![invalid_zone]))]),
            PlannedTrainingMappingCoverage::complete(),
        ),
        Err(PlannedTrainingTargetError::InvalidIntensityBounds)
    ));

    let forward_repeat = phase(0, "Forward", Some((1, 2)));
    assert!(matches!(
        PlannedTrainingTarget::restore(
            "synthetic-origin",
            digest("planned-target-", 'a'),
            digest("planned-evidence-", 'a'),
            PlannedTrainingTargetKind::FavoriteTemplate,
            "Template",
            None,
            PlannedTrainingEditability::Unspecified,
            Some(vec![exercise(Some(vec![forward_repeat]))]),
            PlannedTrainingMappingCoverage::complete(),
        ),
        Err(PlannedTrainingTargetError::InvalidRepeatRange)
    ));
}

#[test]
fn rejects_crossing_deep_and_overexpanded_repeat_graphs() {
    let crossing = vec![
        phase(0, "One", None),
        phase(1, "Two", None),
        phase(2, "Three", Some((0, 2))),
        phase(3, "Four", Some((1, 2))),
    ];
    assert!(matches!(
        PlannedTrainingTarget::restore(
            "synthetic-origin",
            digest("planned-target-", 'a'),
            digest("planned-evidence-", 'a'),
            PlannedTrainingTargetKind::FavoriteTemplate,
            "Template",
            None,
            PlannedTrainingEditability::Unspecified,
            Some(vec![exercise(Some(crossing))]),
            PlannedTrainingMappingCoverage::complete(),
        ),
        Err(PlannedTrainingTargetError::CrossingRepeatRanges)
    ));

    let too_deep = vec![
        phase(0, "One", None),
        phase(1, "Two", None),
        phase(2, "Three", Some((1, 2))),
        phase(3, "Four", Some((1, 2))),
        phase(4, "Five", Some((0, 2))),
    ];
    assert!(matches!(
        PlannedTrainingTarget::restore(
            "synthetic-origin",
            digest("planned-target-", 'a'),
            digest("planned-evidence-", 'a'),
            PlannedTrainingTargetKind::FavoriteTemplate,
            "Template",
            None,
            PlannedTrainingEditability::Unspecified,
            Some(vec![exercise(Some(too_deep))]),
            PlannedTrainingMappingCoverage::complete(),
        ),
        Err(PlannedTrainingTargetError::RepeatNestingTooDeep)
    ));

    let overexpanded = vec![
        phase(0, "One", None),
        phase(1, "Two", Some((0, 100))),
        phase(2, "Three", None),
    ];
    assert!(matches!(
        PlannedTrainingTarget::restore(
            "synthetic-origin",
            digest("planned-target-", 'a'),
            digest("planned-evidence-", 'a'),
            PlannedTrainingTargetKind::FavoriteTemplate,
            "Template",
            None,
            PlannedTrainingEditability::Unspecified,
            Some(vec![exercise(Some(overexpanded))]),
            PlannedTrainingMappingCoverage::complete(),
        ),
        Err(PlannedTrainingTargetError::ExpandedPhaseLimitExceeded)
    ));
}

#[test]
fn reconciles_equal_enriched_ordered_and_unordered_revisions_without_import_order() {
    let partial = target(
        'a',
        PlannedTrainingMappingCoverage::partial(2).expect("partial coverage"),
        Some(vec![phase(0, "Unmapped phase", None)]),
    );
    let enriched = target(
        'a',
        PlannedTrainingMappingCoverage::partial(1).expect("better coverage"),
        Some(vec![phase(0, "Mapped phase", None)]),
    );
    let amended = target(
        'b',
        PlannedTrainingMappingCoverage::complete(),
        Some(vec![phase(0, "Revised phase", None)]),
    );

    assert_eq!(
        decide_planned_training_reconciliation(None, &partial, RevisionOrder::Unorderable),
        ReconciliationDecision::Create
    );
    assert_eq!(
        decide_planned_training_reconciliation(
            Some(&partial),
            &partial,
            RevisionOrder::Unorderable
        ),
        ReconciliationDecision::Equivalent
    );
    assert_eq!(
        decide_planned_training_reconciliation(Some(&partial), &enriched, RevisionOrder::Equal),
        ReconciliationDecision::Enrich
    );
    assert_eq!(
        decide_planned_training_reconciliation(Some(&partial), &amended, RevisionOrder::Newer),
        ReconciliationDecision::Amend
    );
    assert_eq!(
        decide_planned_training_reconciliation(Some(&partial), &amended, RevisionOrder::Older),
        ReconciliationDecision::Preserve
    );
    assert_eq!(
        decide_planned_training_reconciliation(
            Some(&partial),
            &amended,
            RevisionOrder::Unorderable
        ),
        ReconciliationDecision::Conflict
    );

    let pending = PlannedTrainingTarget::restore(
        partial.origin_id(),
        partial.target_id(),
        digest("planned-evidence-", 'c'),
        PlannedTrainingTargetKind::Scheduled {
            scheduled_at_local: "2026-01-02T10:30:00".to_owned(),
            completion: PlannedTrainingCompletion::Pending,
        },
        partial.name(),
        partial.description().map(str::to_owned),
        partial.editability(),
        partial.exercises().map(<[_]>::to_vec),
        partial.mapping_coverage(),
    )
    .expect("pending representation of the same target");
    let completed = PlannedTrainingTarget::restore(
        pending.origin_id(),
        pending.target_id(),
        digest("planned-evidence-", 'd'),
        PlannedTrainingTargetKind::Scheduled {
            scheduled_at_local: "2026-01-02T10:30:00".to_owned(),
            completion: PlannedTrainingCompletion::Completed,
        },
        pending.name(),
        pending.description().map(str::to_owned),
        pending.editability(),
        pending.exercises().map(<[_]>::to_vec),
        pending.mapping_coverage(),
    )
    .expect("completed representation of the same target");

    assert_eq!(
        order_planned_training_revisions_without_source_revision(&pending, &completed),
        RevisionOrder::Newer
    );
    assert_eq!(
        order_planned_training_revisions_without_source_revision(&completed, &pending),
        RevisionOrder::Older
    );
    assert_eq!(
        order_planned_training_revisions_without_source_revision(&partial, &enriched),
        RevisionOrder::Equal
    );
    assert_eq!(
        order_planned_training_revisions_without_source_revision(&partial, &amended),
        RevisionOrder::Unorderable
    );
}

#[test]
fn rejects_nonexistent_or_out_of_range_scheduled_local_instants() {
    for value in [
        "0000-01-01T00:00:00",
        "2025-02-29T10:30:00",
        "2026-13-01T10:30:00",
        "2026-04-31T10:30:00",
        "2026-01-02T24:00:00",
        "2026-01-02T10:60:00",
        "2026-01-02T10:30:60",
        "2026-01-02T10:30:00.120",
    ] {
        assert!(matches!(
            PlannedTrainingTarget::restore(
                "synthetic-origin",
                digest("planned-target-", 'a'),
                digest("planned-evidence-", 'a'),
                PlannedTrainingTargetKind::Scheduled {
                    scheduled_at_local: value.to_owned(),
                    completion: PlannedTrainingCompletion::Pending,
                },
                "Invalid instant",
                None,
                PlannedTrainingEditability::Unspecified,
                None,
                PlannedTrainingMappingCoverage::complete(),
            ),
            Err(PlannedTrainingTargetError::InvalidScheduledInstant)
        ));
    }

    assert!(PlannedTrainingTarget::restore(
        "synthetic-origin",
        digest("planned-target-", 'a'),
        digest("planned-evidence-", 'a'),
        PlannedTrainingTargetKind::Scheduled {
            scheduled_at_local: "2024-02-29T23:59:59.12".to_owned(),
            completion: PlannedTrainingCompletion::Pending,
        },
        "Leap day",
        None,
        PlannedTrainingEditability::Unspecified,
        None,
        PlannedTrainingMappingCoverage::complete(),
    )
    .is_ok());
}

#[test]
fn resolves_only_unique_completed_session_relationships() {
    let completed = target(
        'a',
        PlannedTrainingMappingCoverage::complete(),
        Some(vec![phase(0, "Work", None)]),
    );
    let pending = PlannedTrainingTarget::restore(
        "synthetic-origin",
        digest("planned-target-", 'b'),
        digest("planned-evidence-", 'b'),
        PlannedTrainingTargetKind::Scheduled {
            scheduled_at_local: "2026-01-03T10:30:00".to_owned(),
            completion: PlannedTrainingCompletion::Pending,
        },
        "Future intervals",
        None,
        PlannedTrainingEditability::Editable,
        Some(vec![exercise(Some(vec![phase(0, "Work", None)]))]),
        PlannedTrainingMappingCoverage::complete(),
    )
    .expect("pending target");
    let favorite = PlannedTrainingTarget::restore(
        "synthetic-origin",
        digest("planned-target-", 'c'),
        digest("planned-evidence-", 'c'),
        PlannedTrainingTargetKind::FavoriteTemplate,
        "Favorite intervals",
        None,
        PlannedTrainingEditability::Unspecified,
        Some(vec![exercise(Some(vec![phase(0, "Work", None)]))]),
        PlannedTrainingMappingCoverage::complete(),
    )
    .expect("favorite target");

    let session_a = digest("session-", 'a');
    let session_b = digest("session-", 'b');
    assert_eq!(
        resolve_planned_training_session_relation(&completed, &[]).expect("absent relation"),
        PlannedTrainingSessionRelation::Absent
    );
    assert_eq!(
        resolve_planned_training_session_relation(&completed, std::slice::from_ref(&session_a))
            .expect("exact relation"),
        PlannedTrainingSessionRelation::Exact {
            session_ref: session_a.clone()
        }
    );
    assert_eq!(
        resolve_planned_training_session_relation(&completed, &[session_a, session_b])
            .expect("ambiguous relation"),
        PlannedTrainingSessionRelation::Ambiguous { candidate_count: 2 }
    );
    assert_eq!(
        resolve_planned_training_session_relation(&pending, &[]).expect("pending relation"),
        PlannedTrainingSessionRelation::Absent
    );
    assert_eq!(
        resolve_planned_training_session_relation(&favorite, &[]).expect("template relation"),
        PlannedTrainingSessionRelation::NotApplicable
    );
}
