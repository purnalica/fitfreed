use std::sync::Mutex;

use fitfreed_domain::{
    author_sport_classification, author_unified_sport_relationship, ProviderNeutralSportSuggestion,
    SportClassification, SportClassificationAuthorship, SportClassificationKey,
    SportClassificationState, SportFamily, SportLocalizedName, SportRecognitionProvenance,
    UnifiedSportRelationship,
};

use super::{
    query_training_sports, remove_unified_sport_relationship, save_training_sport_classification,
    save_unified_sport_relationship, ApplicationError, DetectedTrainingSport,
    PersistedTrainingSportsState, RemoveUnifiedSportRelationshipRequest,
    SaveSportClassificationRequest, SaveUnifiedSportRelationshipRequest,
    SportClassificationSaveOutcome, TrainingSportClassificationScope,
    TrainingSportCollectionExpectation, TrainingSportState, TrainingSportUnificationReviewReason,
    TrainingSportsPort, UnifiedSportRelationshipSaveOutcome,
};

fn detected_sport(
    sport_ref: &str,
    origin_id: &str,
    source_sport_ref: &str,
    session_count: usize,
) -> DetectedTrainingSport {
    DetectedTrainingSport {
        session_filter_ref: format!("filter-{sport_ref}"),
        provider_normalization_ref: None,
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
        provider_normalization_ref: None,
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
    relationships: Mutex<Vec<UnifiedSportRelationship>>,
    saves: Mutex<Vec<(u64, SportClassification)>>,
    snapshot_ref: Mutex<String>,
    reject_save: bool,
}

impl ControlledTrainingSportsPort {
    fn with(detected: Vec<DetectedTrainingSport>) -> Self {
        Self {
            detected: Mutex::new(detected),
            snapshot_ref: Mutex::new(format!("training-snapshot-{}", "1".repeat(64))),
            ..Self::default()
        }
    }
}

impl TrainingSportsPort for ControlledTrainingSportsPort {
    fn query_training_sports_state(&self) -> Result<PersistedTrainingSportsState, String> {
        Ok(PersistedTrainingSportsState {
            snapshot_ref: self
                .snapshot_ref
                .lock()
                .expect("snapshot reference")
                .clone(),
            detected_sports: self.detected.lock().expect("detected sports").clone(),
            unified_relationships: self
                .relationships
                .lock()
                .expect("unified relationships")
                .clone(),
        })
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
        *self.snapshot_ref.lock().expect("snapshot reference") =
            format!("training-snapshot-{}", "2".repeat(64));
        Ok(true)
    }

    fn compare_and_save_unified_sport_relationship(
        &self,
        expected_snapshot_ref: &str,
        expected_revision: u64,
        relationship: &UnifiedSportRelationship,
        _members: &[TrainingSportCollectionExpectation],
    ) -> Result<bool, String> {
        if self
            .snapshot_ref
            .lock()
            .expect("snapshot reference")
            .as_str()
            != expected_snapshot_ref
        {
            return Ok(false);
        }
        let mut relationships = self.relationships.lock().expect("unified relationships");
        if expected_revision == 0 {
            relationships.push(relationship.clone());
        } else if let Some(existing) = relationships.iter_mut().find(|existing| {
            existing.relationship_ref() == relationship.relationship_ref()
                && existing.revision() == expected_revision
        }) {
            *existing = relationship.clone();
        } else {
            return Ok(false);
        }
        let snapshot_digit = relationship.revision().saturating_add(2).min(9);
        *self.snapshot_ref.lock().expect("snapshot reference") = format!(
            "training-snapshot-{}",
            snapshot_digit.to_string().repeat(64)
        );
        Ok(true)
    }

    fn compare_and_remove_unified_sport_relationship(
        &self,
        expected_snapshot_ref: &str,
        relationship_ref: &str,
        expected_revision: u64,
    ) -> Result<bool, String> {
        if self
            .snapshot_ref
            .lock()
            .expect("snapshot reference")
            .as_str()
            != expected_snapshot_ref
        {
            return Ok(false);
        }
        let mut relationships = self.relationships.lock().expect("unified relationships");
        let before = relationships.len();
        relationships.retain(|relationship| {
            relationship.relationship_ref() != relationship_ref
                || relationship.revision() != expected_revision
        });
        if relationships.len() == before {
            return Ok(false);
        }
        *self.snapshot_ref.lock().expect("snapshot reference") =
            format!("training-snapshot-{}", "9".repeat(64));
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
    kayaking.sport_ref = None;
    kayaking.classification = None;
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
    assert!(overview.sports[0].sport_ref.is_none());
    assert!(overview.sports[0].classification.is_none());
    assert_eq!(overview.sports[1].state, TrainingSportState::Unknown);
    assert_eq!(overview.sports[1].session_filter_ref, "filter-unresolved");
    assert!(overview.sports[1].sport_ref.is_some());
    assert_eq!(
        overview.sports[1]
            .classification
            .as_ref()
            .expect("unresolved fallback classification")
            .scope,
        TrainingSportClassificationScope::UnresolvedSourceProfile
    );
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
        reject_save: true,
        ..ControlledTrainingSportsPort::default()
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
    let invalid_normalization = DetectedTrainingSport {
        provider_normalization_ref: Some(String::new()),
        ..detected_sport("sport-normalized", "origin-a", "opaque-4", 2)
    };

    for detected in [
        duplicate_unavailable,
        vec![invalid_coverage],
        vec![reversed_dates],
        vec![mismatched_origin],
        vec![mismatched_availability],
        vec![invalid_normalization],
    ] {
        assert!(matches!(
            query_training_sports(&ControlledTrainingSportsPort::with(detected)),
            Err(ApplicationError::SportClassificationQuery(_))
        ));
    }
}

#[test]
fn projects_an_explicit_relationship_as_one_sport_without_losing_member_coverage() {
    let mut recognized = detected_sport("recognized", "origin-a", "opaque-1", 4);
    recognized.session_filter_ref = "filter-recognized".to_owned();
    recognized.sport_ref = None;
    recognized.classification = None;
    recognized.recognition_candidates = vec![recognized_suggestion(
        "Kayaking",
        Some(SportFamily::WaterSport),
    )];
    let mut unresolved = detected_sport("unresolved", "origin-a", "opaque-2", 3);
    unresolved.session_filter_ref = "filter-unresolved".to_owned();
    let mut export_missing = unavailable_sport("origin-a");
    export_missing.session_filter_ref = "filter-export-missing".to_owned();
    let relationship = author_unified_sport_relationship(
        "filter-recognized",
        vec![
            "filter-export-missing".to_owned(),
            "filter-recognized".to_owned(),
            "filter-unresolved".to_owned(),
        ],
    )
    .expect("explicit relationship");
    let port = ControlledTrainingSportsPort::with(vec![unresolved, export_missing, recognized]);
    port.relationships
        .lock()
        .expect("relationships")
        .push(relationship.clone());

    let overview = query_training_sports(&port).expect("unified sport overview");

    assert_eq!(overview.session_count, 8);
    assert_eq!(overview.sports.len(), 1);
    assert_eq!(overview.sport_collections.len(), 3);
    assert_eq!(
        overview
            .sport_collections
            .iter()
            .map(|sport| sport.coverage.session_count)
            .sum::<usize>(),
        overview.session_count
    );
    let unified = &overview.sports[0];
    assert_eq!(unified.session_filter_ref, relationship.relationship_ref());
    assert_eq!(
        unified.member_session_filter_refs,
        relationship.member_session_filter_refs()
    );
    assert_eq!(unified.state, TrainingSportState::Recognized);
    assert_eq!(unified.coverage.session_count, 8);
    assert_eq!(
        unified
            .unification
            .as_ref()
            .expect("visible unification")
            .primary_session_filter_ref,
        "filter-recognized"
    );
    assert!(overview.unification_reviews.is_empty());
}

#[test]
fn normalizes_equal_documented_provider_identity_across_opaque_source_identifiers() {
    let normalization_ref = format!("sport-{}", "9".repeat(64));
    let mut first = detected_sport("normalized-first", "origin-a", "opaque-a", 4);
    first.session_filter_ref = format!("sport-{}", "1".repeat(64));
    first.provider_normalization_ref = Some(normalization_ref.clone());
    first.sport_ref = None;
    first.classification = None;
    first.recognition_candidates = vec![recognized_suggestion(
        "Kayaking",
        Some(SportFamily::WaterSport),
    )];
    let mut second = detected_sport("normalized-second", "origin-a", "opaque-b", 3);
    second.session_filter_ref = format!("sport-{}", "2".repeat(64));
    second.provider_normalization_ref = Some(normalization_ref.clone());
    second.sport_ref = None;
    second.classification = None;
    second.recognition_candidates = vec![recognized_suggestion(
        "Kayaking",
        Some(SportFamily::WaterSport),
    )];
    let port = ControlledTrainingSportsPort::with(vec![second, first]);

    let overview = query_training_sports(&port).expect("provider-normalized sport overview");

    assert_eq!(overview.session_count, 7);
    assert_eq!(overview.sport_collections.len(), 2);
    assert_eq!(overview.sports.len(), 1);
    let normalized = &overview.sports[0];
    assert_eq!(normalized.session_filter_ref, normalization_ref);
    assert_eq!(
        normalized.member_session_filter_refs,
        [
            format!("sport-{}", "1".repeat(64)),
            format!("sport-{}", "2".repeat(64)),
        ]
    );
    assert_eq!(normalized.coverage.session_count, 7);
    assert_eq!(normalized.state, TrainingSportState::Recognized);
    assert!(normalized.unification.is_none());
    assert!(overview.unification_reviews.is_empty());
}

#[test]
fn rejects_provider_normalization_that_exceeds_the_visible_member_limit() {
    let normalization_ref = format!("sport-{}", "9".repeat(64));
    let detected = (0..65)
        .map(|index| {
            let exact_ref = format!("sport-{index:064x}");
            let mut sport = detected_sport(
                &format!("normalized-{index}"),
                "origin-a",
                &format!("opaque-{index}"),
                1,
            );
            sport.session_filter_ref = exact_ref;
            sport.provider_normalization_ref = Some(normalization_ref.clone());
            sport.sport_ref = None;
            sport.classification = None;
            sport.recognition_candidates = vec![recognized_suggestion(
                "Kayaking",
                Some(SportFamily::WaterSport),
            )];
            sport
        })
        .collect();

    assert!(matches!(
        query_training_sports(&ControlledTrainingSportsPort::with(detected)),
        Err(ApplicationError::SportClassificationQuery(message))
            if message == "provider-normalized sport exceeds the supported member limit"
    ));
}

#[test]
fn keeps_members_separate_and_requests_review_when_a_relationship_cannot_be_applied() {
    let unknown = detected_sport("unknown", "origin-a", "opaque-1", 2);
    let available_ref = unknown.session_filter_ref.clone();
    let missing_ref = "filter-no-longer-represented".to_owned();
    let relationship = author_unified_sport_relationship(
        &available_ref,
        vec![available_ref.clone(), missing_ref.clone()],
    )
    .expect("stored relationship");
    let port = ControlledTrainingSportsPort::with(vec![unknown]);
    port.relationships
        .lock()
        .expect("relationships")
        .push(relationship);

    let overview = query_training_sports(&port).expect("review-required overview");

    assert_eq!(overview.sports.len(), 1);
    assert_eq!(overview.sport_collections.len(), 1);
    assert_eq!(overview.sports[0].session_filter_ref, available_ref);
    assert_eq!(overview.unification_reviews.len(), 1);
    assert_eq!(
        overview.unification_reviews[0].reason,
        TrainingSportUnificationReviewReason::MissingMember
    );
    assert_eq!(
        overview.unification_reviews[0].missing_member_session_filter_refs,
        [missing_ref]
    );
}

#[test]
fn creates_revises_and_removes_a_relationship_against_exact_current_coverage() {
    let mut recognized = detected_sport("recognized", "origin-a", "opaque-1", 4);
    recognized.session_filter_ref = "filter-recognized".to_owned();
    recognized.sport_ref = None;
    recognized.classification = None;
    recognized.recognition_candidates =
        vec![recognized_suggestion("Running", Some(SportFamily::Running))];
    let mut unknown = detected_sport("unknown", "origin-a", "opaque-2", 3);
    unknown.session_filter_ref = "filter-unknown".to_owned();
    let mut export_missing = unavailable_sport("origin-a");
    export_missing.session_filter_ref = "filter-export-missing".to_owned();
    let port = ControlledTrainingSportsPort::with(vec![recognized, unknown, export_missing]);
    let initial = query_training_sports(&port).expect("initial sport overview");

    let created = save_unified_sport_relationship(
        &port,
        SaveUnifiedSportRelationshipRequest {
            expected_snapshot_ref: initial.snapshot_ref,
            expected_revision: 0,
            relationship_ref: None,
            primary_session_filter_ref: "filter-recognized".to_owned(),
            members: vec![
                TrainingSportCollectionExpectation {
                    session_filter_ref: "filter-recognized".to_owned(),
                    session_count: 4,
                },
                TrainingSportCollectionExpectation {
                    session_filter_ref: "filter-unknown".to_owned(),
                    session_count: 3,
                },
            ],
        },
    )
    .expect("created relationship");
    assert_eq!(
        created.outcome,
        UnifiedSportRelationshipSaveOutcome::Changed
    );
    assert_eq!(created.overview.sports.len(), 2);
    let relationship = created.overview.sports[0]
        .unification
        .as_ref()
        .expect("created relationship")
        .clone();

    let revised = save_unified_sport_relationship(
        &port,
        SaveUnifiedSportRelationshipRequest {
            expected_snapshot_ref: created.overview.snapshot_ref,
            expected_revision: relationship.revision,
            relationship_ref: Some(relationship.relationship_ref.clone()),
            primary_session_filter_ref: relationship.primary_session_filter_ref,
            members: vec![
                TrainingSportCollectionExpectation {
                    session_filter_ref: "filter-recognized".to_owned(),
                    session_count: 4,
                },
                TrainingSportCollectionExpectation {
                    session_filter_ref: "filter-unknown".to_owned(),
                    session_count: 3,
                },
                TrainingSportCollectionExpectation {
                    session_filter_ref: "filter-export-missing".to_owned(),
                    session_count: 1,
                },
            ],
        },
    )
    .expect("revised relationship");
    assert_eq!(revised.overview.sports.len(), 1);
    assert_eq!(
        revised.overview.sports[0]
            .unification
            .as_ref()
            .expect("revised relationship")
            .revision,
        2
    );

    let removed = remove_unified_sport_relationship(
        &port,
        RemoveUnifiedSportRelationshipRequest {
            expected_snapshot_ref: revised.overview.snapshot_ref,
            relationship_ref: relationship.relationship_ref,
            expected_revision: 2,
        },
    )
    .expect("removed relationship");
    assert_eq!(
        removed.outcome,
        UnifiedSportRelationshipSaveOutcome::Removed
    );
    assert_eq!(removed.overview.sports.len(), 3);
}

#[test]
fn rejects_stale_coverage_unusable_precedence_and_overlapping_members() {
    let mut recognized = detected_sport("recognized", "origin-a", "opaque-1", 4);
    recognized.session_filter_ref = "filter-recognized".to_owned();
    recognized.sport_ref = None;
    recognized.classification = None;
    recognized.recognition_candidates =
        vec![recognized_suggestion("Cycling", Some(SportFamily::Cycling))];
    let mut unknown = detected_sport("unknown", "origin-a", "opaque-2", 3);
    unknown.session_filter_ref = "filter-unknown".to_owned();
    let mut other = detected_sport("other", "origin-a", "opaque-3", 2);
    other.session_filter_ref = "filter-other".to_owned();
    other.sport_ref = None;
    other.classification = None;
    other.recognition_candidates =
        vec![recognized_suggestion("Running", Some(SportFamily::Running))];
    let port = ControlledTrainingSportsPort::with(vec![recognized, unknown, other]);
    let snapshot_ref = query_training_sports(&port)
        .expect("initial overview")
        .snapshot_ref;

    let invalid_primary = save_unified_sport_relationship(
        &port,
        SaveUnifiedSportRelationshipRequest {
            expected_snapshot_ref: snapshot_ref.clone(),
            expected_revision: 0,
            relationship_ref: None,
            primary_session_filter_ref: "filter-unknown".to_owned(),
            members: vec![
                TrainingSportCollectionExpectation {
                    session_filter_ref: "filter-recognized".to_owned(),
                    session_count: 4,
                },
                TrainingSportCollectionExpectation {
                    session_filter_ref: "filter-unknown".to_owned(),
                    session_count: 3,
                },
            ],
        },
    );
    assert!(matches!(
        invalid_primary,
        Err(ApplicationError::InvalidSportUnification(_))
    ));

    let changed_coverage = save_unified_sport_relationship(
        &port,
        SaveUnifiedSportRelationshipRequest {
            expected_snapshot_ref: snapshot_ref.clone(),
            expected_revision: 0,
            relationship_ref: None,
            primary_session_filter_ref: "filter-recognized".to_owned(),
            members: vec![
                TrainingSportCollectionExpectation {
                    session_filter_ref: "filter-recognized".to_owned(),
                    session_count: 5,
                },
                TrainingSportCollectionExpectation {
                    session_filter_ref: "filter-unknown".to_owned(),
                    session_count: 3,
                },
            ],
        },
    );
    assert!(matches!(
        changed_coverage,
        Err(ApplicationError::SportUnificationConflict)
    ));

    save_unified_sport_relationship(
        &port,
        SaveUnifiedSportRelationshipRequest {
            expected_snapshot_ref: snapshot_ref,
            expected_revision: 0,
            relationship_ref: None,
            primary_session_filter_ref: "filter-recognized".to_owned(),
            members: vec![
                TrainingSportCollectionExpectation {
                    session_filter_ref: "filter-recognized".to_owned(),
                    session_count: 4,
                },
                TrainingSportCollectionExpectation {
                    session_filter_ref: "filter-unknown".to_owned(),
                    session_count: 3,
                },
            ],
        },
    )
    .expect("first relationship");
    let current_snapshot = query_training_sports(&port)
        .expect("overview after first relationship")
        .snapshot_ref;
    let overlapping = save_unified_sport_relationship(
        &port,
        SaveUnifiedSportRelationshipRequest {
            expected_snapshot_ref: current_snapshot,
            expected_revision: 0,
            relationship_ref: None,
            primary_session_filter_ref: "filter-other".to_owned(),
            members: vec![
                TrainingSportCollectionExpectation {
                    session_filter_ref: "filter-other".to_owned(),
                    session_count: 2,
                },
                TrainingSportCollectionExpectation {
                    session_filter_ref: "filter-unknown".to_owned(),
                    session_count: 3,
                },
            ],
        },
    );
    assert!(matches!(
        overlapping,
        Err(ApplicationError::InvalidSportUnification(_))
    ));
}
