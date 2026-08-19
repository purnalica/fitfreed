use super::*;

#[derive(Clone)]
struct StubPort {
    result: Result<PersistedTrainingSessionZones, TrainingSessionZonePortError>,
}

impl TrainingSessionZonePort for StubPort {
    fn query_training_session_zones(
        &self,
        _query: &TrainingSessionZonesQuery,
    ) -> Result<PersistedTrainingSessionZones, TrainingSessionZonePortError> {
        self.result.clone()
    }
}

fn opaque(prefix: &str, value: char) -> String {
    format!("{prefix}{}", value.to_string().repeat(64))
}

fn indexed_opaque(prefix: &str, value: usize) -> String {
    format!("{prefix}{value:064x}")
}

fn query() -> TrainingSessionZonesQuery {
    TrainingSessionZonesQuery {
        session_ref: opaque("session-", 'a'),
        snapshot_ref: Some(opaque("training-snapshot-", 'b')),
    }
}

fn zone(ordinal: usize) -> TrainingZoneView {
    TrainingZoneView {
        zone_ref: opaque("zone-", char::from(b'd' + ordinal as u8)),
        ordinal,
        lower_limit: 120.0 + ordinal as f64 * 20.0,
        higher_limit: 139.0 + ordinal as f64 * 20.0,
        time_in_zone_milliseconds: Some(900_000 - ordinal as i64 * 100_000),
        distance_meters: None,
        muscle_load: None,
    }
}

fn persisted() -> PersistedTrainingSessionZones {
    PersistedTrainingSessionZones {
        snapshot_ref: opaque("training-snapshot-", 'b'),
        session_ref: opaque("session-", 'a'),
        zones: Some(TrainingSessionZonesView {
            exercises: Some(vec![TrainingExerciseZonesView {
                exercise_ref: opaque("exercise-", 'c'),
                ordinal: 0,
                zones: Some(TrainingZoneCollectionView {
                    groups: vec![TrainingZoneGroupView {
                        zone_group_ref: opaque("zone-group-", 'f'),
                        ordinal: 0,
                        kind: TrainingZoneKindView::HeartRate,
                        unit: TrainingZoneUnitView::BeatsPerMinute,
                        zones: Some(vec![zone(0), zone(1)]),
                    }],
                    unsupported_group_count: 1,
                }),
            }]),
        }),
    }
}

#[test]
fn returns_exact_recorded_zone_evidence() {
    let expected = persisted();
    let result = query_training_session_zones(
        &StubPort {
            result: Ok(expected.clone()),
        },
        query(),
    )
    .unwrap();

    assert_eq!(result, expected);
    let exercises = result.zones.unwrap().exercises.unwrap();
    let group = &exercises[0].zones.as_ref().unwrap().groups[0];
    assert_eq!(group.kind, TrainingZoneKindView::HeartRate);
    assert_eq!(
        group.zones.as_ref().unwrap()[0].time_in_zone_milliseconds,
        Some(900_000)
    );
}

#[test]
fn preserves_every_assessment_and_collection_state() {
    for zones in [
        None,
        Some(TrainingSessionZonesView { exercises: None }),
        Some(TrainingSessionZonesView {
            exercises: Some(Vec::new()),
        }),
        Some(TrainingSessionZonesView {
            exercises: Some(vec![TrainingExerciseZonesView {
                exercise_ref: opaque("exercise-", 'c'),
                ordinal: 0,
                zones: None,
            }]),
        }),
        Some(TrainingSessionZonesView {
            exercises: Some(vec![TrainingExerciseZonesView {
                exercise_ref: opaque("exercise-", 'c'),
                ordinal: 0,
                zones: Some(TrainingZoneCollectionView {
                    groups: vec![TrainingZoneGroupView {
                        zone_group_ref: opaque("zone-group-", 'f'),
                        ordinal: 0,
                        kind: TrainingZoneKindView::Speed,
                        unit: TrainingZoneUnitView::KilometersPerHour,
                        zones: None,
                    }],
                    unsupported_group_count: 0,
                }),
            }]),
        }),
    ] {
        let mut result = persisted();
        result.zones = zones.clone();
        assert_eq!(
            query_training_session_zones(&StubPort { result: Ok(result) }, query(),)
                .unwrap()
                .zones,
            zones
        );
    }
}

#[test]
fn rejects_wrong_units_bounds_and_kind_specific_aggregates() {
    let mut wrong_unit = persisted();
    wrong_unit
        .zones
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .zones
        .as_mut()
        .unwrap()
        .groups[0]
        .unit = TrainingZoneUnitView::Watts;
    assert_invalid(wrong_unit);

    let mut reversed = persisted();
    reversed.zones.as_mut().unwrap().exercises.as_mut().unwrap()[0]
        .zones
        .as_mut()
        .unwrap()
        .groups[0]
        .zones
        .as_mut()
        .unwrap()[0]
        .higher_limit = 119.0;
    assert_invalid(reversed);

    let mut irrelevant_distance = persisted();
    irrelevant_distance
        .zones
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .zones
        .as_mut()
        .unwrap()
        .groups[0]
        .zones
        .as_mut()
        .unwrap()[0]
        .distance_meters = Some(1_000.0);
    assert_invalid(irrelevant_distance);
}

#[test]
fn rejects_non_contiguous_or_reused_capabilities_and_excessive_collections() {
    let mut ordinal = persisted();
    ordinal.zones.as_mut().unwrap().exercises.as_mut().unwrap()[0]
        .zones
        .as_mut()
        .unwrap()
        .groups[0]
        .zones
        .as_mut()
        .unwrap()[1]
        .ordinal = 3;
    assert_invalid(ordinal);

    let mut reused = persisted();
    let zones = reused.zones.as_mut().unwrap().exercises.as_mut().unwrap()[0]
        .zones
        .as_mut()
        .unwrap()
        .groups[0]
        .zones
        .as_mut()
        .unwrap();
    zones[1].zone_ref = zones[0].zone_ref.clone();
    assert_invalid(reused);

    let mut excessive = persisted();
    let group = excessive
        .zones
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .zones
        .as_mut()
        .unwrap()
        .groups[0]
        .clone();
    excessive
        .zones
        .as_mut()
        .unwrap()
        .exercises
        .as_mut()
        .unwrap()[0]
        .zones
        .as_mut()
        .unwrap()
        .groups = (0..65)
        .map(|ordinal| TrainingZoneGroupView {
            zone_group_ref: indexed_opaque("zone-group-", ordinal),
            ordinal,
            ..group.clone()
        })
        .collect();
    assert_invalid(excessive);
}

#[test]
fn rejects_stale_snapshots_and_inconsistent_result_identity() {
    assert!(matches!(
        query_training_session_zones(
            &StubPort {
                result: Err(TrainingSessionZonePortError::SnapshotChanged),
            },
            query(),
        ),
        Err(ApplicationError::TrainingSessionDetailChanged)
    ));

    let mut inconsistent = persisted();
    inconsistent.session_ref = opaque("session-", '9');
    assert!(matches!(
        query_training_session_zones(
            &StubPort {
                result: Ok(inconsistent),
            },
            query(),
        ),
        Err(ApplicationError::TrainingSessionDetailChanged)
    ));
}

fn assert_invalid(result: PersistedTrainingSessionZones) {
    assert!(matches!(
        query_training_session_zones(&StubPort { result: Ok(result) }, query()),
        Err(ApplicationError::InvalidTrainingSessionDetail(_))
    ));
}
