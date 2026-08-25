use super::*;

struct StubPort {
    result: Result<PersistedTrainingSessionStructure, TrainingSessionStructurePortError>,
}

impl TrainingSessionStructurePort for StubPort {
    fn query_training_session_structure(
        &self,
        _query: &TrainingSessionStructureQuery,
    ) -> Result<PersistedTrainingSessionStructure, TrainingSessionStructurePortError> {
        self.result.clone()
    }
}

fn opaque(prefix: &str, value: char) -> String {
    format!("{prefix}{}", value.to_string().repeat(64))
}

fn query() -> TrainingSessionStructureQuery {
    TrainingSessionStructureQuery {
        session_ref: opaque("session-", 'a'),
        snapshot_ref: Some(opaque("training-snapshot-", 'b')),
    }
}

fn persisted() -> PersistedTrainingSessionStructure {
    PersistedTrainingSessionStructure {
        session_ref: query().session_ref,
        snapshot_ref: query().snapshot_ref.unwrap(),
        structure: Some(TrainingStructure {
            exercises: Some(vec![TrainingExerciseStructure {
                exercise_ref: opaque("exercise-", 'c'),
                ordinal: 0,
                started_at_local: "2026-01-02T10:30:00".to_owned(),
                stopped_at_local: "2026-01-02T11:30:00".to_owned(),
                utc_offset_minutes: Some(60),
                duration_milliseconds: 3_600_000,
                distance_meters: Some(10_000.0),
                energy_kilocalories: Some(600),
                sport: TrainingSessionSport {
                    sport_ref: Some(opaque("sport-", 'f')),
                    state: TrainingSportState::Unknown,
                    classification: Some(TrainingSportClassification {
                        canonical_family: None,
                        display_label: None,
                        authorship: None,
                        revision: 0,
                    }),
                    recognition: None,
                    recognition_candidate_count: 0,
                },
                manual_laps: Some(vec![TrainingLapStructure {
                    lap_ref: opaque("lap-", 'd'),
                    ordinal: 0,
                    split_time_milliseconds: 0,
                    duration_milliseconds: 1_800_000,
                    distance_meters: Some(5_000.0),
                }]),
                automatic_laps: None,
                pauses: Some(vec![TrainingPauseStructure {
                    pause_ref: opaque("pause-", 'e'),
                    ordinal: 0,
                    started_at_local: "2026-01-02T10:50:00".to_owned(),
                    ended_at_local: "2026-01-02T10:51:00".to_owned(),
                }]),
            }]),
        }),
    }
}

#[test]
fn returns_ordered_source_structure_without_source_identifiers() {
    let expected = persisted();
    let result = query_training_session_structure(
        &StubPort {
            result: Ok(expected.clone()),
        },
        query(),
    )
    .unwrap();

    assert_eq!(result.session_ref, expected.session_ref);
    assert_eq!(result.structure, expected.structure);
}

#[test]
fn preserves_not_evaluated_absent_and_empty_structure_states() {
    for structure in [
        None,
        Some(TrainingStructure { exercises: None }),
        Some(TrainingStructure {
            exercises: Some(Vec::new()),
        }),
    ] {
        let mut result = persisted();
        result.structure = structure.clone();
        assert_eq!(
            query_training_session_structure(&StubPort { result: Ok(result) }, query())
                .unwrap()
                .structure,
            structure
        );
    }
}

#[test]
fn rejects_stale_or_malformed_structure_results() {
    let stale = query_training_session_structure(
        &StubPort {
            result: Err(TrainingSessionStructurePortError::SnapshotChanged),
        },
        query(),
    );
    assert!(matches!(
        stale,
        Err(ApplicationError::TrainingSessionDetailChanged)
    ));

    let mut malformed = persisted();
    malformed
        .structure
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .manual_laps
        .as_mut()
        .unwrap()[0]
        .ordinal = 1;
    assert!(matches!(
        query_training_session_structure(
            &StubPort {
                result: Ok(malformed)
            },
            query()
        ),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));
}

#[test]
fn rejects_reversed_exercise_and_pause_intervals() {
    let mut reversed_exercise = persisted();
    reversed_exercise
        .structure
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .stopped_at_local = "2026-01-02T09:30:00".to_owned();
    assert!(matches!(
        query_training_session_structure(
            &StubPort {
                result: Ok(reversed_exercise)
            },
            query()
        ),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));

    let mut reversed_pause = persisted();
    reversed_pause
        .structure
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .pauses
        .as_mut()
        .unwrap()[0]
        .ended_at_local = "2026-01-02T10:49:00".to_owned();
    assert!(matches!(
        query_training_session_structure(
            &StubPort {
                result: Ok(reversed_pause)
            },
            query()
        ),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));
}

#[test]
fn rejects_an_inconsistent_exercise_sport_context() {
    let mut malformed = persisted();
    malformed
        .structure
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .sport = TrainingSessionSport {
        sport_ref: Some(opaque("sport-", 'f')),
        state: TrainingSportState::Unavailable,
        classification: None,
        recognition: None,
        recognition_candidate_count: 0,
    };

    assert!(matches!(
        query_training_session_structure(
            &StubPort {
                result: Ok(malformed)
            },
            query()
        ),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));
}

#[test]
fn rejects_a_lap_capability_reused_across_collections() {
    let mut malformed = persisted();
    let exercise = &mut malformed
        .structure
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0];
    exercise.automatic_laps = exercise.manual_laps.clone();

    assert!(matches!(
        query_training_session_structure(
            &StubPort {
                result: Ok(malformed)
            },
            query()
        ),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));
}
