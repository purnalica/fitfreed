use super::*;

fn summary(duration_milliseconds: i64) -> TrainingSession {
    TrainingSession {
        origin_id: "synthetic-origin".to_owned(),
        session_id: "synthetic-session".to_owned(),
        started_at_local: "2026-01-02T10:30:00".to_owned(),
        stopped_at_local: "2026-01-02T11:30:00".to_owned(),
        utc_offset_minutes: Some(60),
        duration_milliseconds,
        distance_meters: Some(10_000.0),
        energy_kilocalories: Some(600),
        average_heart_rate_bpm: Some(145),
        maximum_heart_rate_bpm: Some(178),
        sport_ref: Some("synthetic-sport".to_owned()),
        exercise_count: Some(1),
    }
}

fn structure() -> TrainingSessionStructure {
    TrainingSessionStructure {
        exercises: Some(vec![TrainingExercise {
            exercise_id: "synthetic-exercise".to_owned(),
            ordinal: 0,
            started_at_local: "2026-01-02T10:30:00".to_owned(),
            stopped_at_local: "2026-01-02T11:30:00".to_owned(),
            utc_offset_minutes: Some(60),
            duration_milliseconds: 3_600_000,
            distance_meters: Some(10_000.0),
            energy_kilocalories: Some(600),
            sport_ref: Some("synthetic-sport".to_owned()),
            manual_laps: Some(vec![TrainingLap {
                kind: TrainingLapKind::Manual,
                ordinal: 0,
                split_time_milliseconds: 0,
                duration_milliseconds: 1_800_000,
                distance_meters: Some(5_000.0),
            }]),
            automatic_laps: None,
            pauses: Some(vec![TrainingPause {
                ordinal: 0,
                started_at_local: "2026-01-02T10:50:00".to_owned(),
                ended_at_local: "2026-01-02T10:51:00".to_owned(),
            }]),
        }]),
    }
}

fn routes() -> TrainingSessionRouteAssessment {
    TrainingSessionRouteAssessment {
        exercises: Some(vec![TrainingExerciseRouteAssessment {
            exercise_id: "synthetic-exercise".to_owned(),
            ordinal: 0,
            routes: Some(TrainingRoutes {
                primary: Some(TrainingRoute {
                    kind: TrainingRouteKind::Primary,
                    started_at_local: "2026-01-02T10:30:00".to_owned(),
                    points: vec![TrainingRoutePoint {
                        ordinal: 0,
                        latitude_degrees: 40.0,
                        longitude_degrees: -3.0,
                        altitude_meters: Some(650.0),
                        elapsed_milliseconds: Some(0),
                    }],
                }),
                transition: None,
            }),
        }]),
    }
}

fn signals() -> TrainingSessionSignalAssessment {
    TrainingSessionSignalAssessment {
        exercises: Some(vec![TrainingExerciseSignalAssessment {
            exercise_id: "synthetic-exercise".to_owned(),
            ordinal: 0,
            signals: Some(TrainingSignals {
                primary: Some(vec![TrainingSignalSeries {
                    ordinal: 0,
                    kind: TrainingSignalKind::HeartRate,
                    unit: TrainingSignalUnit::BeatsPerMinute,
                    interval_milliseconds: 1_000,
                    samples: vec![
                        TrainingSignalSample {
                            ordinal: 0,
                            value: Some(120.0),
                        },
                        TrainingSignalSample {
                            ordinal: 1,
                            value: None,
                        },
                    ],
                }]),
                transition: None,
                unsupported_primary_series_count: 0,
                unsupported_transition_series_count: 0,
            }),
        }]),
    }
}

fn zones() -> TrainingSessionZoneAssessment {
    TrainingSessionZoneAssessment {
        exercises: Some(vec![TrainingExerciseZoneAssessment {
            exercise_id: "synthetic-exercise".to_owned(),
            ordinal: 0,
            zones: Some(TrainingZones {
                groups: vec![TrainingZoneGroup {
                    ordinal: 0,
                    kind: TrainingZoneKind::HeartRate,
                    unit: TrainingZoneUnit::BeatsPerMinute,
                    zones: Some(vec![TrainingZone {
                        ordinal: 0,
                        lower_limit: 120.0,
                        higher_limit: 139.0,
                        time_in_zone_milliseconds: Some(900_000),
                        distance_meters: None,
                        muscle_load: None,
                    }]),
                }],
                unsupported_group_count: 1,
            }),
        }]),
    }
}

#[test]
fn creates_and_recognizes_equivalent_complete_session_records() {
    let incoming = TrainingSessionRecord {
        summary: summary(3_600_000),
        structure: Some(structure()),
        routes: Some(routes()),
        signals: Some(signals()),
        zones: Some(zones()),
    };

    assert_eq!(
        decide_training_session_record_reconciliation(None, &incoming, RevisionOrder::Unorderable),
        ReconciliationDecision::Create
    );
    assert_eq!(
        decide_training_session_record_reconciliation(
            Some(&incoming),
            &incoming,
            RevisionOrder::Equal
        ),
        ReconciliationDecision::Equivalent
    );
}

#[test]
fn enriches_a_summary_imported_before_structure_mapping() {
    let existing = TrainingSessionRecord {
        summary: summary(3_600_000),
        structure: None,
        routes: None,
        signals: None,
        zones: None,
    };
    let incoming = TrainingSessionRecord {
        summary: existing.summary.clone(),
        structure: Some(structure()),
        routes: Some(routes()),
        signals: Some(signals()),
        zones: Some(zones()),
    };

    assert_eq!(
        decide_training_session_record_reconciliation(
            Some(&existing),
            &incoming,
            RevisionOrder::Equal
        ),
        ReconciliationDecision::Enrich
    );
}

#[test]
fn enriches_structure_and_routes_without_regressing_evaluated_evidence() {
    let summary_only = TrainingSessionRecord {
        summary: summary(3_600_000),
        structure: None,
        routes: None,
        signals: None,
        zones: None,
    };
    let structure_only = TrainingSessionRecord {
        summary: summary_only.summary.clone(),
        structure: Some(structure()),
        routes: None,
        signals: None,
        zones: None,
    };
    let complete = TrainingSessionRecord {
        summary: summary_only.summary.clone(),
        structure: Some(structure()),
        routes: Some(routes()),
        signals: Some(signals()),
        zones: Some(zones()),
    };

    assert_eq!(
        decide_training_session_record_reconciliation(
            Some(&summary_only),
            &complete,
            RevisionOrder::Equal
        ),
        ReconciliationDecision::Enrich
    );
    assert_eq!(
        decide_training_session_record_reconciliation(
            Some(&structure_only),
            &complete,
            RevisionOrder::Equal
        ),
        ReconciliationDecision::Enrich
    );

    let regressed = TrainingSessionRecord {
        summary: complete.summary.clone(),
        structure: None,
        routes: complete.routes.clone(),
        signals: complete.signals.clone(),
        zones: complete.zones.clone(),
    };
    assert_eq!(
        decide_training_session_record_reconciliation(
            Some(&complete),
            &regressed,
            RevisionOrder::Equal
        ),
        ReconciliationDecision::Conflict
    );
}

#[test]
fn applies_revision_order_to_changed_summary_or_structure() {
    let existing = TrainingSessionRecord {
        summary: summary(3_600_000),
        structure: Some(structure()),
        routes: Some(routes()),
        signals: Some(signals()),
        zones: Some(zones()),
    };
    let mut changed_structure = structure();
    changed_structure.exercises.as_mut().unwrap()[0].manual_laps = Some(Vec::new());
    let changed = TrainingSessionRecord {
        summary: summary(3_700_000),
        structure: Some(changed_structure),
        routes: Some(routes()),
        signals: Some(signals()),
        zones: Some(zones()),
    };

    for (order, expected) in [
        (RevisionOrder::Newer, ReconciliationDecision::Amend),
        (RevisionOrder::Older, ReconciliationDecision::Preserve),
        (RevisionOrder::Equal, ReconciliationDecision::Conflict),
        (RevisionOrder::Unorderable, ReconciliationDecision::Conflict),
    ] {
        assert_eq!(
            decide_training_session_record_reconciliation(Some(&existing), &changed, order),
            expected
        );
    }
}

#[test]
fn enriches_signals_without_permitting_an_evaluated_regression() {
    let existing = TrainingSessionRecord {
        summary: summary(3_600_000),
        structure: Some(structure()),
        routes: Some(routes()),
        signals: None,
        zones: None,
    };
    let complete = TrainingSessionRecord {
        signals: Some(signals()),
        ..existing.clone()
    };

    assert_eq!(
        decide_training_session_record_reconciliation(
            Some(&existing),
            &complete,
            RevisionOrder::Equal
        ),
        ReconciliationDecision::Enrich
    );
    assert_eq!(
        decide_training_session_record_reconciliation(
            Some(&complete),
            &existing,
            RevisionOrder::Equal
        ),
        ReconciliationDecision::Conflict
    );
}

#[test]
fn enriches_zones_without_permitting_an_evaluated_regression() {
    let existing = TrainingSessionRecord {
        summary: summary(3_600_000),
        structure: Some(structure()),
        routes: Some(routes()),
        signals: Some(signals()),
        zones: None,
    };
    let complete = TrainingSessionRecord {
        zones: Some(zones()),
        ..existing.clone()
    };

    assert_eq!(
        decide_training_session_record_reconciliation(
            Some(&existing),
            &complete,
            RevisionOrder::Equal
        ),
        ReconciliationDecision::Enrich
    );
    assert_eq!(
        decide_training_session_record_reconciliation(
            Some(&complete),
            &existing,
            RevisionOrder::Equal
        ),
        ReconciliationDecision::Conflict
    );
}
