use std::sync::Mutex;

use fitfreed_domain::{
    author_sport_classification, ProviderNeutralSportSuggestion, SportClassification,
    SportClassificationAuthorship, SportClassificationKey, SportClassificationState, SportFamily,
    SportLocalizedName, SportRecognitionProvenance,
};

use super::{
    query_training_sports, save_training_sport_classification, ApplicationError,
    DetectedTrainingSport, SaveSportClassificationRequest, SportClassificationSaveOutcome,
    TrainingSportState, TrainingSportsPort,
};

fn detected_sport(
    sport_ref: &str,
    origin_id: &str,
    source_sport_ref: &str,
    session_count: usize,
) -> DetectedTrainingSport {
    DetectedTrainingSport {
        session_filter_ref: format!("filter-{sport_ref}"),
        sport_ref: Some(sport_ref.to_owned()),
        origin_id: origin_id.to_owned(),
        classification: Some(SportClassification::unresolved(
            SportClassificationKey::new(origin_id, source_sport_ref).expect("classification key"),
        )),
        recognition_candidates: Vec::new(),
        first_local_date: "2025-01-02".to_owned(),
        last_local_date: "2026-08-17".to_owned(),
        session_count,
        total_duration_milliseconds: 7_200_000,
        distance_session_count: session_count.saturating_sub(1),
        heart_rate_session_count: session_count.saturating_sub(2),
    }
}

fn unavailable_sport(origin_id: &str) -> DetectedTrainingSport {
    DetectedTrainingSport {
        session_filter_ref: format!("filter-unavailable-{origin_id}"),
        sport_ref: None,
        origin_id: origin_id.to_owned(),
        classification: None,
        recognition_candidates: Vec::new(),
        first_local_date: "2026-03-01".to_owned(),
        last_local_date: "2026-03-01".to_owned(),
        session_count: 1,
        total_duration_milliseconds: 1_800_000,
        distance_session_count: 0,
        heart_rate_session_count: 0,
    }
}

fn recognized_suggestion(
    label: &str,
    family: Option<SportFamily>,
) -> ProviderNeutralSportSuggestion {
    ProviderNeutralSportSuggestion::new(
        family,
        vec![
            SportLocalizedName::new("en", label).expect("English sport name"),
            SportLocalizedName::new("es", "Nombre reconocido").expect("Spanish sport name"),
        ],
        SportRecognitionProvenance::new(
            "catalogue-2026-08-25",
            "2026-08-25T10:00:00Z",
            "provider-sport-suggestion@1",
            "sport-evidence-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        )
        .expect("recognition provenance"),
    )
    .expect("recognized suggestion")
}

#[derive(Default)]
struct ControlledTrainingSportsPort {
    detected: Mutex<Vec<DetectedTrainingSport>>,
    saves: Mutex<Vec<(u64, SportClassification)>>,
    reject_save: bool,
}

impl ControlledTrainingSportsPort {
    fn with(detected: Vec<DetectedTrainingSport>) -> Self {
        Self {
            detected: Mutex::new(detected),
            ..Self::default()
        }
    }
}

impl TrainingSportsPort for ControlledTrainingSportsPort {
    fn query_detected_training_sports(&self) -> Result<Vec<DetectedTrainingSport>, String> {
        Ok(self.detected.lock().expect("detected sports").clone())
    }

    fn find_detected_training_sport(
        &self,
        sport_ref: &str,
    ) -> Result<Option<DetectedTrainingSport>, String> {
        Ok(self
            .detected
            .lock()
            .expect("detected sports")
            .iter()
            .find(|sport| sport.sport_ref.as_deref() == Some(sport_ref))
            .cloned())
    }

    fn compare_and_save_sport_classification(
        &self,
        expected_revision: u64,
        classification: &SportClassification,
    ) -> Result<bool, String> {
        self.saves
            .lock()
            .expect("classification saves")
            .push((expected_revision, classification.clone()));
        if self.reject_save {
            return Ok(false);
        }
        let mut detected = self.detected.lock().expect("detected sports");
        let matching = detected
            .iter_mut()
            .filter(|sport| {
                sport.classification.as_ref().map(SportClassification::key)
                    == Some(classification.key())
            })
            .collect::<Vec<_>>();
        assert!(!matching.is_empty(), "saved detected sport");
        for existing in matching {
            existing.classification = Some(classification.clone());
        }
        Ok(true)
    }
}

#[test]
fn composes_classified_unknown_and_unavailable_sports_without_source_references() {
    let unresolved = detected_sport("sport-unknown", "origin-b", "opaque-93", 3);
    let mut classified = detected_sport("sport-running", "origin-a", "opaque-12", 4);
    classified.classification = Some(
        SportClassification::restore(
            classified
                .classification
                .as_ref()
                .expect("classification")
                .key()
                .clone(),
            SportClassificationState::Classified,
            Some(SportFamily::Running),
            Some("Trail running".to_owned()),
            Some(SportClassificationAuthorship::User),
            2,
        )
        .expect("restored classification"),
    );
    let unavailable = unavailable_sport("origin-a");
    let overview = query_training_sports(&ControlledTrainingSportsPort::with(vec![
        unresolved,
        unavailable,
        classified,
    ]))
    .expect("training sports overview");

    assert_eq!(overview.origin_count, 2);
    assert_eq!(overview.session_count, 8);
    assert_eq!(overview.sports.len(), 3);
    assert_eq!(
        overview.sports[0].state,
        TrainingSportState::PersonallyOverridden
    );
    assert_eq!(overview.sports[0].source_index, 1);
    assert_eq!(
        overview.sports[0].sport_ref.as_deref(),
        Some("sport-running")
    );
    assert_eq!(
        overview.sports[0].session_filter_ref,
        "filter-sport-running"
    );
    assert_eq!(
        overview.sports[0]
            .classification
            .as_ref()
            .and_then(|classification| classification.display_label.as_deref()),
        Some("Trail running")
    );
    assert_eq!(overview.sports[1].state, TrainingSportState::Unknown);
    assert_eq!(overview.sports[1].source_index, 2);
    assert_eq!(overview.sports[2].state, TrainingSportState::Unavailable);
    assert_eq!(overview.sports[2].source_index, 1);
}

#[test]
fn keeps_exact_representations_separate_from_one_classifiable_source_profile() {
    let mut kayaking = detected_sport("sport-shared", "origin-a", "opaque-1", 2);
    kayaking.session_filter_ref = "filter-kayaking".to_owned();
    kayaking.recognition_candidates = vec![recognized_suggestion(
        "Kayaking",
        Some(SportFamily::WaterSport),
    )];
    let mut unresolved = detected_sport("sport-shared", "origin-a", "opaque-1", 3);
    unresolved.session_filter_ref = "filter-unresolved".to_owned();

    let overview = query_training_sports(&ControlledTrainingSportsPort::with(vec![
        unresolved, kayaking,
    ]))
    .expect("split source profile representations");

    assert_eq!(overview.session_count, 5);
    assert_eq!(overview.sports.len(), 2);
    assert_eq!(overview.sports[0].state, TrainingSportState::Recognized);
    assert_eq!(overview.sports[0].session_filter_ref, "filter-kayaking");
    assert_eq!(overview.sports[1].state, TrainingSportState::Unknown);
    assert_eq!(overview.sports[1].session_filter_ref, "filter-unresolved");
    assert_eq!(overview.sports[0].sport_ref, overview.sports[1].sport_ref);
}

#[test]
fn recognizes_exact_evidence_without_inventing_a_classifiable_source_profile() {
    let mut recognized = unavailable_sport("origin-a");
    recognized.session_filter_ref = "filter-exact".to_owned();
    recognized.recognition_candidates = vec![recognized_suggestion(
        "Kayaking",
        Some(SportFamily::WaterSport),
    )];

    let overview = query_training_sports(&ControlledTrainingSportsPort::with(vec![recognized]))
        .expect("evidence-only sport recognition");

    assert_eq!(overview.sports[0].state, TrainingSportState::Recognized);
    assert!(overview.sports[0].sport_ref.is_none());
    assert!(overview.sports[0].classification.is_none());
    assert_eq!(overview.sports[0].recognition_candidate_count, 1);
}

#[test]
fn composes_recognized_ambiguous_unknown_and_personally_overridden_sports() {
    let mut recognized = detected_sport("sport-running", "origin-a", "opaque-1", 4);
    recognized.recognition_candidates =
        vec![recognized_suggestion("Running", Some(SportFamily::Running))];
    let mut ambiguous = detected_sport("sport-ambiguous", "origin-a", "opaque-2", 2);
    ambiguous.recognition_candidates = vec![
        recognized_suggestion("Paddling", Some(SportFamily::WaterSport)),
        recognized_suggestion("Rowing", Some(SportFamily::WaterSport)),
    ];
    let unknown = detected_sport("sport-unknown", "origin-a", "opaque-3", 1);
    let mut personal = detected_sport("sport-personal", "origin-a", "opaque-4", 3);
    personal.recognition_candidates =
        vec![recognized_suggestion("Running", Some(SportFamily::Running))];
    personal.classification = Some(
        author_sport_classification(
            personal.classification.as_ref().expect("classification"),
            Some(SportFamily::Running),
            Some("My intervals"),
        )
        .expect("personal override"),
    );

    let overview = query_training_sports(&ControlledTrainingSportsPort::with(vec![
        unknown, ambiguous, personal, recognized,
    ]))
    .expect("resolved training sports");

    assert_eq!(
        overview.sports[0].state,
        TrainingSportState::PersonallyOverridden
    );
    assert_eq!(
        overview.sports[0]
            .recognition
            .as_ref()
            .expect("retained recognition")
            .localized_names["en"],
        "Running"
    );
    assert_eq!(overview.sports[1].state, TrainingSportState::Recognized);
    assert_eq!(
        overview.sports[1]
            .recognition
            .as_ref()
            .expect("recognition")
            .canonical_family
            .as_deref(),
        Some("running")
    );
    assert_eq!(overview.sports[2].state, TrainingSportState::Ambiguous);
    assert_eq!(overview.sports[2].recognition_candidate_count, 2);
    assert_eq!(overview.sports[2].recognition, None);
    assert_eq!(overview.sports[3].state, TrainingSportState::Unknown);
}

#[test]
fn orders_recognized_sports_by_provider_neutral_family_and_localized_names() {
    let mut zulu_running = detected_sport("sport-a", "origin-a", "opaque-1", 1);
    zulu_running.recognition_candidates = vec![recognized_suggestion(
        "Zulu running",
        Some(SportFamily::Running),
    )];
    let mut cycling = detected_sport("sport-m", "origin-a", "opaque-2", 1);
    cycling.recognition_candidates = vec![recognized_suggestion(
        "Road cycling",
        Some(SportFamily::Cycling),
    )];
    let mut alpha_running = detected_sport("sport-z", "origin-a", "opaque-3", 1);
    alpha_running.recognition_candidates = vec![recognized_suggestion(
        "Alpha running",
        Some(SportFamily::Running),
    )];

    let overview = query_training_sports(&ControlledTrainingSportsPort::with(vec![
        zulu_running,
        cycling,
        alpha_running,
    ]))
    .expect("ordered recognized sports");

    let names = overview
        .sports
        .iter()
        .map(|sport| {
            sport
                .recognition
                .as_ref()
                .expect("recognized sport")
                .localized_names["en"]
                .as_str()
        })
        .collect::<Vec<_>>();
    assert_eq!(names, vec!["Road cycling", "Alpha running", "Zulu running"]);
}

#[test]
fn saves_idempotent_amended_and_explicit_unknown_classifications_with_revision_checks() {
    let port = ControlledTrainingSportsPort::with(vec![detected_sport(
        "sport-cycling",
        "origin-a",
        "opaque-7",
        6,
    )]);
    let saved = save_training_sport_classification(
        &port,
        SaveSportClassificationRequest {
            sport_ref: "sport-cycling".to_owned(),
            expected_revision: 0,
            canonical_family: Some("cycling".to_owned()),
            display_label: Some("Gravel cycling".to_owned()),
        },
    )
    .expect("saved classification");
    assert_eq!(saved.outcome, SportClassificationSaveOutcome::Changed);
    assert_eq!(
        saved.overview.sports[0].state,
        TrainingSportState::PersonallyOverridden
    );
    assert_eq!(
        saved.overview.sports[0]
            .classification
            .as_ref()
            .expect("classification")
            .revision,
        1
    );

    let unchanged = save_training_sport_classification(
        &port,
        SaveSportClassificationRequest {
            sport_ref: "sport-cycling".to_owned(),
            expected_revision: 1,
            canonical_family: Some("cycling".to_owned()),
            display_label: Some("Gravel cycling".to_owned()),
        },
    )
    .expect("idempotent classification");
    assert_eq!(unchanged.outcome, SportClassificationSaveOutcome::Unchanged);

    let reset = save_training_sport_classification(
        &port,
        SaveSportClassificationRequest {
            sport_ref: "sport-cycling".to_owned(),
            expected_revision: 1,
            canonical_family: None,
            display_label: None,
        },
    )
    .expect("authored unknown");
    assert_eq!(reset.outcome, SportClassificationSaveOutcome::Changed);
    assert_eq!(
        reset.overview.sports[0].state,
        TrainingSportState::PersonallyOverridden
    );
    assert_eq!(
        reset.overview.sports[0]
            .classification
            .as_ref()
            .expect("classification")
            .revision,
        2
    );

    assert_eq!(port.saves.lock().expect("classification saves").len(), 2);
}

#[test]
fn rejects_stale_invalid_and_unclassifiable_requests_without_writes() {
    let port = ControlledTrainingSportsPort {
        detected: Mutex::new(vec![detected_sport(
            "sport-running",
            "origin-a",
            "opaque-1",
            2,
        )]),
        saves: Mutex::new(Vec::new()),
        reject_save: true,
    };
    assert!(matches!(
        save_training_sport_classification(
            &port,
            SaveSportClassificationRequest {
                sport_ref: "sport-running".to_owned(),
                expected_revision: 0,
                canonical_family: Some("running".to_owned()),
                display_label: None,
            },
        ),
        Err(ApplicationError::SportClassificationConflict)
    ));
    assert!(matches!(
        save_training_sport_classification(
            &port,
            SaveSportClassificationRequest {
                sport_ref: "sport-running".to_owned(),
                expected_revision: 0,
                canonical_family: Some("provider-code".to_owned()),
                display_label: None,
            },
        ),
        Err(ApplicationError::InvalidSportClassification(_))
    ));
    assert!(matches!(
        save_training_sport_classification(
            &port,
            SaveSportClassificationRequest {
                sport_ref: "missing-sport".to_owned(),
                expected_revision: 0,
                canonical_family: None,
                display_label: Some("Running".to_owned()),
            },
        ),
        Err(ApplicationError::InvalidSportClassification(_))
    ));
    assert!(matches!(
        save_training_sport_classification(
            &port,
            SaveSportClassificationRequest {
                sport_ref: "sport-running".to_owned(),
                expected_revision: 0,
                canonical_family: None,
                display_label: Some(" Leading space".to_owned()),
            },
        ),
        Err(ApplicationError::InvalidSportClassification(_))
    ));
}

#[test]
fn rejects_inconsistent_detected_sport_sets_instead_of_returning_partial_discovery() {
    let duplicate_unavailable = vec![unavailable_sport("origin-a"), unavailable_sport("origin-a")];
    let mut invalid_coverage = detected_sport("sport-running", "origin-a", "opaque-1", 2);
    invalid_coverage.distance_session_count = 3;
    let mut reversed_dates = detected_sport("sport-cycling", "origin-a", "opaque-2", 2);
    reversed_dates.first_local_date = "2026-08-18".to_owned();
    reversed_dates.last_local_date = "2026-08-17".to_owned();
    let mut mismatched_origin = detected_sport("sport-swimming", "origin-a", "opaque-3", 2);
    mismatched_origin.origin_id = "origin-b".to_owned();
    let mismatched_availability = DetectedTrainingSport {
        sport_ref: Some("sport-unavailable".to_owned()),
        ..unavailable_sport("origin-a")
    };

    for detected in [
        duplicate_unavailable,
        vec![invalid_coverage],
        vec![reversed_dates],
        vec![mismatched_origin],
        vec![mismatched_availability],
    ] {
        assert!(matches!(
            query_training_sports(&ControlledTrainingSportsPort::with(detected)),
            Err(ApplicationError::SportClassificationQuery(_))
        ));
    }
}
