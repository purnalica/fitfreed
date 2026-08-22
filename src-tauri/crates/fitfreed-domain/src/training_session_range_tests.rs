use super::{
    adjust_training_session_range, reconcile_training_session_range, remove_training_session_range,
    rename_training_session_range, TrainingSessionRange, TrainingSessionRangeAuthorship,
    TrainingSessionRangeCoordinate, TrainingSessionRangeCoordinateScope, TrainingSessionRangeError,
    TrainingSessionRangeEvidenceCompatibility, TrainingSessionRangeState,
};

const RANGE_ID: &str = "range-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const SESSION_REF: &str =
    "session-1111111111111111111111111111111111111111111111111111111111111111";
const EXERCISE_REF: &str =
    "exercise-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_EXERCISE_REF: &str =
    "exercise-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const ROUTE_REF: &str = "route-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const SIGNAL_REF: &str = "signal-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
const EVIDENCE_REVISION: &str = concat!(
    "range-evidence-",
    "2222222222222222222222222222222222222222222222222222222222222222"
);
const NEXT_EVIDENCE_REVISION: &str = concat!(
    "range-evidence-",
    "3333333333333333333333333333333333333333333333333333333333333333"
);

fn range() -> TrainingSessionRange {
    TrainingSessionRange::create(
        RANGE_ID,
        SESSION_REF,
        EXERCISE_REF,
        TrainingSessionRangeCoordinate::exercise_elapsed(),
        "  Riverside effort  ",
        60_000,
        180_000,
        300_000,
        EVIDENCE_REVISION,
    )
    .expect("valid personal range")
}

#[test]
fn creates_an_exercise_owned_user_range() {
    let range = range();

    assert_eq!(range.range_id(), RANGE_ID);
    assert_eq!(range.session_ref(), SESSION_REF);
    assert_eq!(range.exercise_ref(), Some(EXERCISE_REF));
    assert_eq!(
        range.coordinate().scope(),
        TrainingSessionRangeCoordinateScope::ExerciseElapsed
    );
    assert_eq!(range.coordinate().reference(), None);
    assert_eq!(range.title(), "Riverside effort");
    assert_eq!(range.started_at_elapsed_milliseconds(), 60_000);
    assert_eq!(range.ended_at_elapsed_milliseconds(), 180_000);
    assert_eq!(range.evidence_revision(), EVIDENCE_REVISION);
    assert_eq!(range.authorship(), TrainingSessionRangeAuthorship::User);
    assert_eq!(range.state(), TrainingSessionRangeState::Current);
    assert_eq!(range.revision(), 1);
}

#[test]
fn creates_ranges_against_one_explicit_coordinate_authority() {
    let route_coordinate =
        TrainingSessionRangeCoordinate::route_elapsed(ROUTE_REF).expect("route coordinate");
    let route_range = TrainingSessionRange::create(
        RANGE_ID,
        SESSION_REF,
        EXERCISE_REF,
        route_coordinate.clone(),
        "Recorded bend",
        10_000,
        120_000,
        120_000,
        EVIDENCE_REVISION,
    )
    .expect("route-relative range");
    assert_eq!(
        route_range.coordinate().scope(),
        TrainingSessionRangeCoordinateScope::RouteElapsed
    );
    assert_eq!(route_range.coordinate().reference(), Some(ROUTE_REF));

    let signal_coordinate =
        TrainingSessionRangeCoordinate::signal_elapsed(SIGNAL_REF).expect("signal coordinate");
    let signal_range = TrainingSessionRange::create(
        RANGE_ID,
        SESSION_REF,
        EXERCISE_REF,
        signal_coordinate,
        "Heart-rate rise",
        10_000,
        90_000,
        100_000,
        EVIDENCE_REVISION,
    )
    .expect("signal-relative range");
    assert_eq!(
        signal_range.coordinate().scope(),
        TrainingSessionRangeCoordinateScope::SignalElapsed
    );
    assert_eq!(signal_range.coordinate().reference(), Some(SIGNAL_REF));

    assert_eq!(
        TrainingSessionRange::create(
            RANGE_ID,
            SESSION_REF,
            EXERCISE_REF,
            route_coordinate,
            "Outside route",
            10_000,
            120_001,
            120_000,
            EVIDENCE_REVISION,
        ),
        Err(TrainingSessionRangeError::OutsideCoordinate)
    );
    assert_eq!(
        TrainingSessionRangeCoordinate::route_elapsed("route-invalid"),
        Err(TrainingSessionRangeError::InvalidCoordinateReference)
    );
}

#[test]
fn established_coordinate_authority_cannot_be_reinterpreted() {
    assert_eq!(
        adjust_training_session_range(
            &range(),
            EXERCISE_REF,
            TrainingSessionRangeCoordinate::route_elapsed(ROUTE_REF).expect("route coordinate"),
            60_000,
            180_000,
            300_000,
            EVIDENCE_REVISION,
        ),
        Err(TrainingSessionRangeError::CoordinateChanged)
    );
}

#[test]
fn renames_and_adjusts_with_one_revision_per_effective_authored_change() {
    let original = range();
    let unchanged =
        rename_training_session_range(&original, "Riverside effort").expect("unchanged rename");
    assert_eq!(unchanged, original);

    let renamed = rename_training_session_range(&original, "Strong finish").expect("renamed range");
    assert_eq!(renamed.title(), "Strong finish");
    assert_eq!(renamed.revision(), 2);

    let adjusted = adjust_training_session_range(
        &renamed,
        EXERCISE_REF,
        TrainingSessionRangeCoordinate::exercise_elapsed(),
        90_000,
        240_000,
        300_000,
        EVIDENCE_REVISION,
    )
    .expect("adjusted range");
    assert_eq!(adjusted.started_at_elapsed_milliseconds(), 90_000);
    assert_eq!(adjusted.ended_at_elapsed_milliseconds(), 240_000);
    assert_eq!(adjusted.state(), TrainingSessionRangeState::Current);
    assert_eq!(adjusted.revision(), 3);

    let unchanged = adjust_training_session_range(
        &adjusted,
        EXERCISE_REF,
        TrainingSessionRangeCoordinate::exercise_elapsed(),
        90_000,
        240_000,
        300_000,
        EVIDENCE_REVISION,
    )
    .expect("unchanged adjustment");
    assert_eq!(unchanged, adjusted);
}

#[test]
fn compatible_reimport_rebases_exact_boundaries_without_losing_authorship() {
    let rebased = reconcile_training_session_range(
        &range(),
        Some(300_000),
        NEXT_EVIDENCE_REVISION,
        TrainingSessionRangeEvidenceCompatibility::Compatible,
    )
    .expect("compatible reimport");

    assert_eq!(rebased.started_at_elapsed_milliseconds(), 60_000);
    assert_eq!(rebased.ended_at_elapsed_milliseconds(), 180_000);
    assert_eq!(rebased.evidence_revision(), NEXT_EVIDENCE_REVISION);
    assert_eq!(rebased.state(), TrainingSessionRangeState::Current);
    assert_eq!(rebased.revision(), 2);
}

#[test]
fn incompatible_or_missing_evidence_requires_review_without_redirecting_boundaries() {
    for (duration, compatibility) in [
        (
            Some(300_000),
            TrainingSessionRangeEvidenceCompatibility::Incompatible,
        ),
        (None, TrainingSessionRangeEvidenceCompatibility::Compatible),
        (
            Some(120_000),
            TrainingSessionRangeEvidenceCompatibility::Compatible,
        ),
    ] {
        let reviewed = reconcile_training_session_range(
            &range(),
            duration,
            NEXT_EVIDENCE_REVISION,
            compatibility,
        )
        .expect("preserved review-required range");

        assert_eq!(reviewed.started_at_elapsed_milliseconds(), 60_000);
        assert_eq!(reviewed.ended_at_elapsed_milliseconds(), 180_000);
        assert_eq!(reviewed.evidence_revision(), NEXT_EVIDENCE_REVISION);
        assert_eq!(reviewed.state(), TrainingSessionRangeState::ReviewRequired);
        assert_eq!(reviewed.revision(), 2);
    }
}

#[test]
fn compatible_enrichment_does_not_clear_an_unreviewed_incompatible_change() {
    let review_required = reconcile_training_session_range(
        &range(),
        Some(300_000),
        NEXT_EVIDENCE_REVISION,
        TrainingSessionRangeEvidenceCompatibility::Incompatible,
    )
    .expect("review-required range");
    let enriched_evidence_revision = concat!(
        "range-evidence-",
        "4444444444444444444444444444444444444444444444444444444444444444"
    );

    let enriched = reconcile_training_session_range(
        &review_required,
        Some(300_000),
        enriched_evidence_revision,
        TrainingSessionRangeEvidenceCompatibility::Compatible,
    )
    .expect("compatible enrichment after an unreviewed amendment");

    assert_eq!(enriched.started_at_elapsed_milliseconds(), 60_000);
    assert_eq!(enriched.ended_at_elapsed_milliseconds(), 180_000);
    assert_eq!(enriched.evidence_revision(), enriched_evidence_revision);
    assert_eq!(enriched.state(), TrainingSessionRangeState::ReviewRequired);
    assert_eq!(enriched.revision(), 3);
}

#[test]
fn adjustment_against_current_evidence_completes_review() {
    let review_required = reconcile_training_session_range(
        &range(),
        Some(300_000),
        NEXT_EVIDENCE_REVISION,
        TrainingSessionRangeEvidenceCompatibility::Incompatible,
    )
    .expect("review-required range");

    let reviewed = adjust_training_session_range(
        &review_required,
        EXERCISE_REF,
        TrainingSessionRangeCoordinate::exercise_elapsed(),
        30_000,
        120_000,
        300_000,
        NEXT_EVIDENCE_REVISION,
    )
    .expect("reviewed adjustment");

    assert_eq!(reviewed.state(), TrainingSessionRangeState::Current);
    assert_eq!(reviewed.revision(), 3);
}

#[test]
fn removal_is_an_explicit_revision_bound_domain_decision() {
    let removed = remove_training_session_range(&range()).expect("removal decision");

    assert_eq!(removed.range_id(), RANGE_ID);
    assert_eq!(removed.session_ref(), SESSION_REF);
    assert_eq!(removed.exercise_ref(), Some(EXERCISE_REF));
    assert_eq!(
        removed.coordinate(),
        &TrainingSessionRangeCoordinate::exercise_elapsed()
    );
    assert_eq!(removed.expected_revision(), 1);
}

#[test]
fn rejects_invalid_identity_title_boundaries_and_restore_state() {
    let cases = [
        TrainingSessionRange::create(
            "range-not-a-capability",
            SESSION_REF,
            EXERCISE_REF,
            TrainingSessionRangeCoordinate::exercise_elapsed(),
            "Warm-up",
            0,
            1,
            10,
            EVIDENCE_REVISION,
        ),
        TrainingSessionRange::create(
            RANGE_ID,
            "session-not-a-capability",
            EXERCISE_REF,
            TrainingSessionRangeCoordinate::exercise_elapsed(),
            "Warm-up",
            0,
            1,
            10,
            EVIDENCE_REVISION,
        ),
        TrainingSessionRange::create(
            RANGE_ID,
            SESSION_REF,
            EXERCISE_REF,
            TrainingSessionRangeCoordinate::exercise_elapsed(),
            "   ",
            0,
            1,
            10,
            EVIDENCE_REVISION,
        ),
        TrainingSessionRange::create(
            RANGE_ID,
            SESSION_REF,
            EXERCISE_REF,
            TrainingSessionRangeCoordinate::exercise_elapsed(),
            "Warm-up",
            10,
            10,
            10,
            EVIDENCE_REVISION,
        ),
        TrainingSessionRange::create(
            RANGE_ID,
            SESSION_REF,
            EXERCISE_REF,
            TrainingSessionRangeCoordinate::exercise_elapsed(),
            "Warm-up",
            -1,
            1,
            10,
            EVIDENCE_REVISION,
        ),
        TrainingSessionRange::create(
            RANGE_ID,
            SESSION_REF,
            EXERCISE_REF,
            TrainingSessionRangeCoordinate::exercise_elapsed(),
            "Warm-up",
            0,
            11,
            10,
            EVIDENCE_REVISION,
        ),
        TrainingSessionRange::create(
            RANGE_ID,
            SESSION_REF,
            EXERCISE_REF,
            TrainingSessionRangeCoordinate::exercise_elapsed(),
            "Warm-up",
            0,
            1,
            10,
            "range-evidence-invalid",
        ),
        TrainingSessionRange::create(
            RANGE_ID,
            SESSION_REF,
            "exercise-not-a-capability",
            TrainingSessionRangeCoordinate::exercise_elapsed(),
            "Warm-up",
            0,
            1,
            10,
            EVIDENCE_REVISION,
        ),
    ];
    assert!(cases.into_iter().all(|result| result.is_err()));

    assert_eq!(
        TrainingSessionRange::restore(
            RANGE_ID,
            SESSION_REF,
            Some(EXERCISE_REF.to_owned()),
            TrainingSessionRangeCoordinate::exercise_elapsed(),
            " Warm-up ",
            0,
            1,
            EVIDENCE_REVISION,
            TrainingSessionRangeAuthorship::User,
            TrainingSessionRangeState::Current,
            1,
        ),
        Err(TrainingSessionRangeError::NonCanonicalTitle)
    );
    assert_eq!(
        TrainingSessionRange::restore(
            RANGE_ID,
            SESSION_REF,
            Some(EXERCISE_REF.to_owned()),
            TrainingSessionRangeCoordinate::exercise_elapsed(),
            "Warm-up",
            0,
            1,
            EVIDENCE_REVISION,
            TrainingSessionRangeAuthorship::User,
            TrainingSessionRangeState::Current,
            0,
        ),
        Err(TrainingSessionRangeError::ZeroRevision)
    );
}

#[test]
fn rejects_invalid_adjustments_without_changing_the_range() {
    let original = range();

    for result in [
        adjust_training_session_range(
            &original,
            EXERCISE_REF,
            TrainingSessionRangeCoordinate::exercise_elapsed(),
            180_000,
            60_000,
            300_000,
            EVIDENCE_REVISION,
        ),
        adjust_training_session_range(
            &original,
            EXERCISE_REF,
            TrainingSessionRangeCoordinate::exercise_elapsed(),
            0,
            310_000,
            300_000,
            EVIDENCE_REVISION,
        ),
        adjust_training_session_range(
            &original,
            EXERCISE_REF,
            TrainingSessionRangeCoordinate::exercise_elapsed(),
            0,
            10_000,
            300_000,
            "range-evidence-invalid",
        ),
        adjust_training_session_range(
            &original,
            OTHER_EXERCISE_REF,
            TrainingSessionRangeCoordinate::exercise_elapsed(),
            0,
            10_000,
            300_000,
            EVIDENCE_REVISION,
        ),
    ] {
        assert!(result.is_err());
    }
    assert_eq!(original, range());
}

#[test]
fn preserves_a_legacy_session_coordinate_until_explicit_exercise_review() {
    let legacy = TrainingSessionRange::restore(
        RANGE_ID,
        SESSION_REF,
        None,
        TrainingSessionRangeCoordinate::legacy_session_elapsed(),
        "Legacy selection",
        60_000,
        180_000,
        EVIDENCE_REVISION,
        TrainingSessionRangeAuthorship::User,
        TrainingSessionRangeState::ReviewRequired,
        2,
    )
    .expect("preserved legacy range");

    assert_eq!(legacy.exercise_ref(), None);
    let reviewed = adjust_training_session_range(
        &legacy,
        EXERCISE_REF,
        TrainingSessionRangeCoordinate::route_elapsed(ROUTE_REF).expect("route coordinate"),
        30_000,
        120_000,
        300_000,
        NEXT_EVIDENCE_REVISION,
    )
    .expect("explicitly anchored range");

    assert_eq!(reviewed.exercise_ref(), Some(EXERCISE_REF));
    assert_eq!(reviewed.coordinate().reference(), Some(ROUTE_REF));
    assert_eq!(reviewed.started_at_elapsed_milliseconds(), 30_000);
    assert_eq!(reviewed.state(), TrainingSessionRangeState::Current);
    assert_eq!(reviewed.revision(), 3);
}

#[test]
fn rejects_a_current_range_without_an_exercise_owner() {
    assert_eq!(
        TrainingSessionRange::restore(
            RANGE_ID,
            SESSION_REF,
            None,
            TrainingSessionRangeCoordinate::legacy_session_elapsed(),
            "Unanchored",
            0,
            1,
            EVIDENCE_REVISION,
            TrainingSessionRangeAuthorship::User,
            TrainingSessionRangeState::Current,
            1,
        ),
        Err(TrainingSessionRangeError::UnanchoredCurrentRange)
    );
}
