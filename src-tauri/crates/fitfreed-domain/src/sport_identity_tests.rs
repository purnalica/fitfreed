use super::{
    author_sport_classification, resolve_sport_identity, ProviderNeutralSportSuggestion,
    SportClassification, SportClassificationKey, SportFamily, SportIdentityState,
    SportLocalizedName, SportRecognitionProvenance, SportSuggestionError,
};

fn unresolved() -> SportClassification {
    SportClassification::unresolved(
        SportClassificationKey::new("origin-a", "opaque-source-sport")
            .expect("controlled sport key"),
    )
}

fn suggestion(label: &str, family: Option<SportFamily>) -> ProviderNeutralSportSuggestion {
    ProviderNeutralSportSuggestion::new(
        family,
        vec![
            SportLocalizedName::new("en", label).expect("English sport name"),
            SportLocalizedName::new("es", "Nombre localizado").expect("Spanish sport name"),
        ],
        SportRecognitionProvenance::new(
            "catalogue-2026-08-25",
            "2026-08-25T10:00:00Z",
            "provider-sport-suggestion@1",
            "sport-evidence-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        )
        .expect("catalogue provenance"),
    )
    .expect("provider-neutral suggestion")
}

#[test]
fn resolves_exact_recognized_ambiguous_and_unknown_states_without_provider_identifiers() {
    let classification = unresolved();
    let recognized = resolve_sport_identity(
        &classification,
        vec![suggestion("Running", Some(SportFamily::Running))],
    );
    assert_eq!(recognized.state(), SportIdentityState::Recognized);
    assert_eq!(recognized.candidate_count(), 1);
    assert_eq!(
        recognized
            .recognized_suggestion()
            .and_then(|candidate| candidate.localized_name("en-US")),
        Some("Running")
    );

    let ambiguous = resolve_sport_identity(
        &classification,
        vec![
            suggestion("Running", Some(SportFamily::Running)),
            suggestion("Trail running", Some(SportFamily::Running)),
        ],
    );
    assert_eq!(ambiguous.state(), SportIdentityState::Ambiguous);
    assert_eq!(ambiguous.candidate_count(), 2);
    assert_eq!(ambiguous.recognized_suggestion(), None);

    let unknown = resolve_sport_identity(&classification, Vec::new());
    assert_eq!(unknown.state(), SportIdentityState::Unknown);
    assert_eq!(unknown.candidate_count(), 0);
    assert_eq!(unknown.recognized_suggestion(), None);
}

#[test]
fn personal_meaning_and_explicit_unknown_win_without_erasing_recognition_evidence() {
    let recognition = suggestion("Running", Some(SportFamily::Running));
    let named = author_sport_classification(
        &unresolved(),
        Some(SportFamily::Running),
        Some("My intervals"),
    )
    .expect("personal sport meaning");
    let named_resolution = resolve_sport_identity(&named, vec![recognition.clone()]);
    assert_eq!(
        named_resolution.state(),
        SportIdentityState::PersonallyOverridden
    );
    assert_eq!(named_resolution.candidate_count(), 1);
    assert_eq!(
        named_resolution
            .recognized_suggestion()
            .and_then(|candidate| candidate.localized_name("en")),
        Some("Running")
    );

    let explicit_unknown =
        author_sport_classification(&unresolved(), None, None).expect("personal explicit unknown");
    let unknown_resolution = resolve_sport_identity(&explicit_unknown, vec![recognition]);
    assert_eq!(
        unknown_resolution.state(),
        SportIdentityState::PersonallyOverridden
    );
    assert_eq!(unknown_resolution.candidate_count(), 1);
    assert_eq!(explicit_unknown.display_label(), None);
}

#[test]
fn rejects_noncanonical_names_and_incomplete_provenance() {
    assert_eq!(
        SportLocalizedName::new("en_US", "Running"),
        Err(SportSuggestionError::InvalidLanguageTag)
    );
    assert_eq!(
        SportLocalizedName::new("en", " Running"),
        Err(SportSuggestionError::NonCanonicalLocalizedName)
    );
    assert_eq!(
        SportRecognitionProvenance::new(
            "",
            "2026-08-25T10:00:00Z",
            "provider-sport-suggestion@1",
            "sport-evidence-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ),
        Err(SportSuggestionError::EmptyCatalogueRevision)
    );
    assert_eq!(
        SportRecognitionProvenance::new(
            "catalogue-2026-08-25",
            "notTvalidZ",
            "provider-sport-suggestion@1",
            "sport-evidence-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ),
        Err(SportSuggestionError::InvalidRetrievalInstant)
    );
    assert_eq!(
        SportRecognitionProvenance::new(
            "catalogue-2026-08-25",
            "2026-02-30T10:00:00Z",
            "provider-sport-suggestion@1",
            "sport-evidence-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ),
        Err(SportSuggestionError::InvalidRetrievalInstant)
    );
    assert_eq!(
        ProviderNeutralSportSuggestion::new(
            Some(SportFamily::Running),
            Vec::new(),
            SportRecognitionProvenance::new(
                "catalogue-2026-08-25",
                "2026-08-25T10:00:00Z",
                "provider-sport-suggestion@1",
                "sport-evidence-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            )
            .expect("catalogue provenance"),
        ),
        Err(SportSuggestionError::MissingLocalizedNames)
    );
}

#[test]
fn locale_lookup_prefers_exact_language_then_base_language_then_english() {
    let suggestion = suggestion("Running", Some(SportFamily::Running));
    assert_eq!(
        suggestion.localized_name("es-ES"),
        Some("Nombre localizado")
    );
    assert_eq!(suggestion.localized_name("fr-FR"), Some("Running"));
}
