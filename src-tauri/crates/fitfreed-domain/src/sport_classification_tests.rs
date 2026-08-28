use super::{
    author_sport_classification, SportClassification, SportClassificationAuthorship,
    SportClassificationError, SportClassificationKey, SportClassificationScope,
    SportClassificationState, SportFamily,
};

fn key() -> SportClassificationKey {
    SportClassificationKey::new("synthetic-origin", "source-sport-7")
        .expect("valid classification key")
}

#[test]
fn preserves_explicit_unknown_and_user_authored_revisions() {
    let unresolved = SportClassification::unresolved(key());
    assert_eq!(
        unresolved.scope(),
        SportClassificationScope::UnresolvedSourceProfile
    );
    assert_eq!(unresolved.state(), SportClassificationState::Unknown);
    assert_eq!(unresolved.authorship(), None);
    assert_eq!(unresolved.revision(), 0);

    let classified = author_sport_classification(
        &unresolved,
        Some(SportFamily::Cycling),
        Some("  Gravel cycling  "),
    )
    .expect("first authored classification");
    assert_eq!(classified.state(), SportClassificationState::Classified);
    assert_eq!(classified.canonical_family(), Some(SportFamily::Cycling));
    assert_eq!(classified.display_label(), Some("Gravel cycling"));
    assert_eq!(
        classified.authorship(),
        Some(SportClassificationAuthorship::User)
    );
    assert_eq!(classified.revision(), 1);

    let unchanged = author_sport_classification(
        &classified,
        Some(SportFamily::Cycling),
        Some("Gravel cycling"),
    )
    .expect("idempotent classification");
    assert_eq!(unchanged, classified);

    let reset = author_sport_classification(&classified, None, None)
        .expect("user-authored unknown revision");
    assert_eq!(reset.state(), SportClassificationState::Unknown);
    assert_eq!(
        reset.authorship(),
        Some(SportClassificationAuthorship::User)
    );
    assert_eq!(reset.revision(), 2);
    assert_eq!(reset.key(), classified.key());
}

#[test]
fn rejects_invalid_keys_labels_and_restored_states() {
    assert!(matches!(
        SportClassificationKey::new("", "source-sport"),
        Err(SportClassificationError::EmptyOrigin)
    ));
    assert!(matches!(
        SportClassificationKey::new("synthetic-origin", ""),
        Err(SportClassificationError::EmptySourceSportReference)
    ));

    let unresolved = SportClassification::unresolved(key());
    assert!(matches!(
        author_sport_classification(&unresolved, None, Some("\n")),
        Err(SportClassificationError::EmptyDisplayLabel)
    ));
    assert!(matches!(
        author_sport_classification(&unresolved, None, Some("Run\u{0007}")),
        Err(SportClassificationError::ControlCharacterInDisplayLabel)
    ));
    assert!(matches!(
        author_sport_classification(&unresolved, None, Some(&"x".repeat(81))),
        Err(SportClassificationError::DisplayLabelTooLong)
    ));
    assert!(matches!(
        SportClassification::restore(
            key(),
            SportClassificationState::Classified,
            None,
            None,
            Some(SportClassificationAuthorship::User),
            1,
        ),
        Err(SportClassificationError::ClassifiedWithoutMeaning)
    ));
    assert!(matches!(
        SportClassification::restore(
            key(),
            SportClassificationState::Unknown,
            Some(SportFamily::Running),
            None,
            Some(SportClassificationAuthorship::User),
            1,
        ),
        Err(SportClassificationError::UnknownWithMeaning)
    ));
    assert!(matches!(
        SportClassification::restore(
            key(),
            SportClassificationState::Unknown,
            None,
            None,
            None,
            2,
        ),
        Err(SportClassificationError::InvalidAuthorshipRevision)
    ));
}

#[test]
fn round_trips_the_complete_provider_neutral_family_vocabulary() {
    for family in SportFamily::ALL {
        assert_eq!(
            SportFamily::from_code(family.as_code()).expect("known family code"),
            family
        );
    }
    assert!(matches!(
        SportFamily::from_code("provider-running-code"),
        Err(SportClassificationError::UnknownFamilyCode)
    ));
}
