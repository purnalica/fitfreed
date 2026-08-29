use super::{
    author_unified_sport_relationship, authorize_unified_sport_relationship_removal,
    revise_unified_sport_relationship, UnifiedSportRelationship,
    UnifiedSportRelationshipAuthorship, UnifiedSportRelationshipError,
};

fn member(index: usize) -> String {
    format!("sport-{index:064x}")
}

#[test]
fn authors_one_explicit_precedence_over_a_canonical_member_set() {
    let primary = member(2);
    let relationship =
        author_unified_sport_relationship(&primary, vec![member(3), primary.clone(), member(1)])
            .expect("authored unified sport relationship");

    assert_eq!(
        relationship.relationship_ref(),
        format!("unified:{primary}")
    );
    assert_eq!(relationship.primary_session_filter_ref(), primary);
    assert_eq!(
        relationship.member_session_filter_refs(),
        [member(1), member(2), member(3)]
    );
    assert_eq!(
        relationship.authorship(),
        UnifiedSportRelationshipAuthorship::User
    );
    assert_eq!(relationship.revision(), 1);
}

#[test]
fn revises_precedence_and_members_without_changing_relationship_identity() {
    let initial = author_unified_sport_relationship(&member(1), vec![member(1), member(2)])
        .expect("initial relationship");

    let unchanged =
        revise_unified_sport_relationship(&initial, &member(1), vec![member(2), member(1)])
            .expect("idempotent revision");
    assert_eq!(unchanged, initial);

    let revised = revise_unified_sport_relationship(
        &initial,
        &member(2),
        vec![member(3), member(2), member(1)],
    )
    .expect("revised relationship");
    assert_eq!(revised.relationship_ref(), initial.relationship_ref());
    assert_eq!(revised.primary_session_filter_ref(), member(2));
    assert_eq!(
        revised.member_session_filter_refs(),
        [member(1), member(2), member(3)]
    );
    assert_eq!(revised.revision(), 2);
}

#[test]
fn rejects_implicit_or_ambiguous_relationships() {
    assert!(matches!(
        author_unified_sport_relationship(&member(1), vec![member(1)]),
        Err(UnifiedSportRelationshipError::TooFewMembers)
    ));
    assert!(matches!(
        author_unified_sport_relationship(&member(1), vec![member(1), member(1), member(2)],),
        Err(UnifiedSportRelationshipError::DuplicateMember)
    ));
    assert!(matches!(
        author_unified_sport_relationship(&member(3), vec![member(1), member(2)]),
        Err(UnifiedSportRelationshipError::PrimaryNotMember)
    ));
    assert!(matches!(
        author_unified_sport_relationship(" sport-ref ", vec![member(1), member(2)]),
        Err(UnifiedSportRelationshipError::NonCanonicalReference)
    ));
}

#[test]
fn restores_and_removes_only_a_complete_current_revision() {
    let relationship = UnifiedSportRelationship::restore(
        format!("unified:{}", member(1)),
        member(2),
        vec![member(1), member(2)],
        UnifiedSportRelationshipAuthorship::User,
        4,
    )
    .expect("restored relationship");

    assert!(matches!(
        authorize_unified_sport_relationship_removal(&relationship, 3),
        Err(UnifiedSportRelationshipError::RevisionConflict)
    ));
    let removed =
        authorize_unified_sport_relationship_removal(&relationship, 4).expect("authorized removal");
    assert_eq!(removed.relationship_ref(), relationship.relationship_ref());
    assert_eq!(removed.removed_revision(), 4);
}
