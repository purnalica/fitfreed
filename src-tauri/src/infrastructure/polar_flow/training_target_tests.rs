use fitfreed_domain::{
    PlannedTrainingCompletion, PlannedTrainingEditability, PlannedTrainingExerciseKind,
    PlannedTrainingIntensity, PlannedTrainingIntensityMetric, PlannedTrainingMappingState,
    PlannedTrainingPhaseChange, PlannedTrainingPhaseGoal, PlannedTrainingSport,
    PlannedTrainingTargetKind, SportFamily,
};

use super::training_target::{
    decode_favourite_training_targets, decode_scheduled_training_target,
    PlannedTrainingMappingContext, PlannedTrainingSportMapping,
};

const SCHEDULED_A: &str = "training-target-2026-01-02-42-11111111-2222-4333-8444-555555555555.json";
const SCHEDULED_B: &str = "training-target-2026-01-02-42-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json";
const FAVORITES: &str = "favourite-targets-42-11111111-2222-4333-8444-555555555555.json";

fn sport_mapping(code: &str) -> Option<PlannedTrainingSportMapping> {
    (code == "RUNNING").then_some(PlannedTrainingSportMapping {
        canonical_family: Some(SportFamily::Running),
        english_name: "Running",
        spanish_name: "Carrera",
    })
}

fn context(locator: &str, digest_seed: char) -> PlannedTrainingMappingContext {
    PlannedTrainingMappingContext {
        origin_id: "synthetic-origin".to_owned(),
        artifact_locator: locator.to_owned(),
        artifact_sha256: digest_seed.to_string().repeat(64),
        catalogue_revision: "synthetic-sport-catalogue@1".to_owned(),
        catalogue_retrieved_at_utc: "2026-08-27T00:00:00Z".to_owned(),
        sport_mapping_version: "synthetic-target-sport@1".to_owned(),
        sport_mapping,
    }
}

fn phased_target_json(name: &str) -> String {
    format!(
        r#"{{
          "exportVersion":"1.0",
          "name":"{name}",
          "description":"A synthetic interval target",
          "startTime":"2026-01-02T10:30:00.000",
          "done":true,
          "nonUserEditable":false,
          "exercises":[{{
            "type":"PHASED",
            "sport":"RUNNING",
            "phases":[
              {{
                "index":1,
                "name":"Warm up",
                "changeType":"AUTOMATIC",
                "goal":{{"type":"DURATION","duration":"PT10M"}},
                "intensity":{{"type":"HEART_RATE_ZONES","lowerZone":1,"upperZone":2}}
              }},
              {{
                "index":2,
                "name":"Work",
                "changeType":"MANUAL",
                "goal":{{"type":"DISTANCE","distance":1000.0}},
                "intensity":{{"type":"SPEED_ZONES","lowerZone":3,"upperZone":4}}
              }},
              {{
                "index":3,
                "name":"Recovery",
                "changeType":"AUTOMATIC",
                "goal":{{"type":"DURATION","duration":"PT1M"}},
                "intensity":{{"type":"NONE"}},
                "jumpIndex":2,
                "repeatCount":3
              }}
            ]
          }}]
        }}"#
    )
}

#[test]
fn maps_the_complete_flat_takeout_graph_without_losing_repeat_meaning() {
    let batch = decode_scheduled_training_target(
        context(SCHEDULED_A, 'a'),
        phased_target_json("Progressive intervals").as_bytes(),
    )
    .expect("mapped scheduled target");

    assert_eq!(batch.records.len(), 1);
    assert!(batch.favorite_snapshot_ref.is_none());
    let record = &batch.records[0];
    assert_eq!(record.source_identity, "42");
    assert_eq!(record.source_record_locator, "/");
    assert_eq!(record.export_version, "1.0");
    assert!(record.unmapped_field_locators.is_empty());
    assert_eq!(
        record.target.mapping_coverage().state(),
        PlannedTrainingMappingState::Complete
    );
    assert_eq!(record.target.name(), "Progressive intervals");
    assert_eq!(
        record.target.description(),
        Some("A synthetic interval target")
    );
    assert_eq!(
        record.target.editability(),
        PlannedTrainingEditability::Editable
    );
    assert_eq!(
        record.target.kind(),
        &PlannedTrainingTargetKind::Scheduled {
            scheduled_at_local: "2026-01-02T10:30:00".to_owned(),
            completion: PlannedTrainingCompletion::Completed,
        }
    );

    let exercise = &record.target.exercises().expect("exercises")[0];
    assert_eq!(exercise.ordinal, 0);
    assert_eq!(exercise.kind, PlannedTrainingExerciseKind::Phased);
    let PlannedTrainingSport::Recognized(sport) = &exercise.sport else {
        panic!("recognized planned sport");
    };
    assert_eq!(sport.canonical_family(), Some(SportFamily::Running));
    assert_eq!(sport.localized_name("en-US"), Some("Running"));
    assert_eq!(sport.localized_name("es-ES"), Some("Carrera"));

    let phases = exercise.phases.as_ref().expect("phases");
    assert_eq!(phases.len(), 3);
    assert_eq!(
        phases[0].goal,
        PlannedTrainingPhaseGoal::DurationMilliseconds(600_000)
    );
    assert_eq!(
        phases[0].transition.change,
        PlannedTrainingPhaseChange::Automatic
    );
    assert_eq!(
        phases[0].intensity,
        PlannedTrainingIntensity::ZoneRange {
            metric: PlannedTrainingIntensityMetric::HeartRate,
            lower_zone: 1,
            upper_zone: 2,
        }
    );
    assert_eq!(
        phases[1].goal,
        PlannedTrainingPhaseGoal::DistanceMeters(1000.0)
    );
    assert_eq!(
        phases[1].transition.change,
        PlannedTrainingPhaseChange::Manual
    );
    assert_eq!(
        phases[2]
            .transition
            .repeat
            .as_ref()
            .expect("repeat")
            .return_to_phase_ordinal,
        1
    );
    assert_eq!(
        phases[2]
            .transition
            .repeat
            .as_ref()
            .expect("repeat")
            .total_iterations,
        4,
        "takeout repeatCount is the number of additional executions"
    );
    assert_eq!(batch.completed_sport_evidence.len(), 1);
    assert_eq!(
        batch.completed_sport_evidence[0].source_record_locator,
        "exercises/0/sport"
    );
}

#[test]
fn accepts_an_unnamed_phase_without_inventing_source_text() {
    let json = phased_target_json("Unnamed phase target").replacen(
        "\"name\":\"Warm up\"",
        "\"name\":\"\"",
        1,
    );

    let batch = decode_scheduled_training_target(context(SCHEDULED_A, 'a'), json.as_bytes())
        .expect("mapped target with an unnamed phase");

    let phases = batch.records[0].target.exercises().expect("exercises")[0]
        .phases
        .as_ref()
        .expect("phases");
    assert_eq!(phases.len(), 3);
    assert_eq!(phases[0].name, None);
}

#[test]
fn keeps_the_scheduled_identity_stable_across_locator_and_evidence_revisions() {
    let first = decode_scheduled_training_target(
        context(SCHEDULED_A, 'a'),
        phased_target_json("Original name").as_bytes(),
    )
    .expect("first target");
    let revised = decode_scheduled_training_target(
        context(SCHEDULED_B, 'b'),
        phased_target_json("Revised name").as_bytes(),
    )
    .expect("revised target");

    assert_eq!(
        first.records[0].target.target_id(),
        revised.records[0].target.target_id()
    );
    assert_ne!(
        first.records[0].target.evidence_revision(),
        revised.records[0].target.evidence_revision()
    );
    assert_eq!(
        first.records[0].source_identity,
        revised.records[0].source_identity
    );
}

#[test]
fn maps_favorites_as_an_order_independent_snapshot_with_stable_item_identity() {
    let first_json = br#"[
      {"exportVersion":"1.0","name":"Short run","exercises":[{"type":"FREE","sport":"RUNNING"}]},
      {"exportVersion":"1.0","name":"Long run","description":"Steady","exercises":[{"type":"VOLUME","duration":"PT1H","sport":"RUNNING"}]}
    ]"#;
    let reordered_json = br#"[
      {"exportVersion":"1.0","name":"Long run","description":"Steady","exercises":[{"type":"VOLUME","duration":"PT1H","sport":"RUNNING"}]},
      {"exportVersion":"1.0","name":"Short run","exercises":[{"type":"FREE","sport":"RUNNING"}]}
    ]"#;

    let first = decode_favourite_training_targets(context(FAVORITES, 'a'), first_json)
        .expect("first favorite snapshot");
    let reordered = decode_favourite_training_targets(context(FAVORITES, 'b'), reordered_json)
        .expect("reordered favorite snapshot");

    assert!(first.favorite_snapshot_ref.is_some());
    assert_ne!(first.favorite_snapshot_ref, reordered.favorite_snapshot_ref);
    assert_eq!(first.records.len(), 2);
    assert!(first
        .records
        .iter()
        .all(|record| record.target.kind() == &PlannedTrainingTargetKind::FavoriteTemplate));
    let mut first_ids = first
        .records
        .iter()
        .map(|record| record.target.target_id())
        .collect::<Vec<_>>();
    let mut reordered_ids = reordered
        .records
        .iter()
        .map(|record| record.target.target_id())
        .collect::<Vec<_>>();
    first_ids.sort_unstable();
    reordered_ids.sort_unstable();
    assert_eq!(first_ids, reordered_ids);
}

#[test]
fn preserves_unknown_variants_as_explicit_partial_mapping() {
    let json = br#"{
      "exportVersion":"1.0",
      "name":"Future target",
      "startTime":"2026-01-02T10:30:00.000",
      "done":false,
      "futureTopLevel":true,
      "exercises":[{
        "type":"FUTURE_TYPE",
        "sport":"FUTURE_SPORT",
        "futureExerciseField":7,
        "phases":[{
          "index":1,
          "name":"Future phase",
          "changeType":"FUTURE_CHANGE",
          "goal":{"type":"FUTURE_GOAL","futureGoalField":1},
          "intensity":{"type":"FUTURE_INTENSITY","futureIntensityField":2},
          "futurePhaseField":3
        }]
      }]
    }"#;

    let batch = decode_scheduled_training_target(context(SCHEDULED_A, 'a'), json)
        .expect("partially mapped target");
    let record = &batch.records[0];
    assert_eq!(
        record.target.mapping_coverage().state(),
        PlannedTrainingMappingState::Partial
    );
    assert_eq!(
        record.target.mapping_coverage().unmapped_field_count(),
        record.unmapped_field_locators.len() as u32
    );
    assert_eq!(
        record.unmapped_field_locators,
        vec![
            "/futureTopLevel",
            "/exercises/0/futureExerciseField",
            "/exercises/0/type=FUTURE_TYPE",
            "/exercises/0/sport=FUTURE_SPORT",
            "/exercises/0/phases/0/futurePhaseField",
            "/exercises/0/phases/0/changeType=FUTURE_CHANGE",
            "/exercises/0/phases/0/goal/futureGoalField",
            "/exercises/0/phases/0/goal/type=FUTURE_GOAL",
            "/exercises/0/phases/0/intensity/futureIntensityField",
            "/exercises/0/phases/0/intensity/type=FUTURE_INTENSITY",
        ]
    );
    let exercise = &record.target.exercises().expect("exercise")[0];
    assert_eq!(exercise.kind, PlannedTrainingExerciseKind::Unmapped);
    assert_eq!(exercise.sport, PlannedTrainingSport::Unmapped);
    let phase = &exercise.phases.as_ref().expect("phase")[0];
    assert_eq!(phase.goal, PlannedTrainingPhaseGoal::Unmapped);
    assert_eq!(phase.intensity, PlannedTrainingIntensity::Unmapped);
    assert_eq!(
        phase.transition.change,
        PlannedTrainingPhaseChange::Unmapped
    );
}

#[test]
fn rejects_malformed_order_repeat_duration_and_intensity_instead_of_guessing() {
    let cases = [
        phased_target_json("Valid").replace("\"index\":2", "\"index\":4"),
        phased_target_json("Valid").replace(",\n                \"repeatCount\":3", ""),
        phased_target_json("Valid").replace("PT10M", "ten minutes"),
        phased_target_json("Valid").replace("PT10M", "PT0.0001S"),
        phased_target_json("Valid").replace(
            "\"lowerZone\":3,\"upperZone\":4",
            "\"lowerZone\":5,\"upperZone\":2",
        ),
    ];

    for (index, json) in cases.iter().enumerate() {
        assert!(
            decode_scheduled_training_target(context(SCHEDULED_A, 'a'), json.as_bytes()).is_err(),
            "malformed case {index}"
        );
    }
}
