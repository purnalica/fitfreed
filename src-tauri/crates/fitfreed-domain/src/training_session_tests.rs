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

#[test]
fn creates_and_recognizes_equivalent_complete_session_records() {
    let incoming = TrainingSessionRecord {
        summary: summary(3_600_000),
        structure: Some(structure()),
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
    };
    let incoming = TrainingSessionRecord {
        summary: existing.summary.clone(),
        structure: Some(structure()),
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
fn applies_revision_order_to_changed_summary_or_structure() {
    let existing = TrainingSessionRecord {
        summary: summary(3_600_000),
        structure: Some(structure()),
    };
    let mut changed_structure = structure();
    changed_structure.exercises.as_mut().unwrap()[0].manual_laps = Some(Vec::new());
    let changed = TrainingSessionRecord {
        summary: summary(3_700_000),
        structure: Some(changed_structure),
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
