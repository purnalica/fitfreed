use super::{
    author_segment_criterion, SegmentCriterion, SegmentCriterionAuthorship,
    SegmentCriterionDefinition, SegmentCriterionError,
};

const CRITERION_ID: &str =
    "criterion-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

fn equal_time() -> SegmentCriterionDefinition {
    SegmentCriterionDefinition::EqualElapsedTime {
        span_milliseconds: 300_000,
    }
}

#[test]
fn creates_and_revises_user_authored_criteria() {
    let criterion = SegmentCriterion::create(CRITERION_ID, "  Five-minute splits  ", equal_time())
        .expect("valid criterion");
    assert_eq!(criterion.criterion_id(), CRITERION_ID);
    assert_eq!(criterion.title(), "Five-minute splits");
    assert_eq!(criterion.authorship(), SegmentCriterionAuthorship::User);
    assert_eq!(criterion.evaluation_version(), 1);
    assert_eq!(criterion.revision(), 1);

    let unchanged = author_segment_criterion(&criterion, "Five-minute splits", equal_time())
        .expect("idempotent authoring");
    assert_eq!(unchanged, criterion);

    let revised = author_segment_criterion(
        &criterion,
        "One-kilometre splits",
        SegmentCriterionDefinition::EqualDistance {
            span_meters: 1_000.0,
        },
    )
    .expect("revised criterion");
    assert_eq!(revised.revision(), 2);
    assert_eq!(revised.title(), "One-kilometre splits");
}

#[test]
fn accepts_each_provider_neutral_definition() {
    for definition in [
        equal_time(),
        SegmentCriterionDefinition::EqualDistance {
            span_meters: 1_000.0,
        },
        SegmentCriterionDefinition::HeartRateZone {
            minimum_beats_per_minute: 140,
            maximum_beats_per_minute: 159,
        },
        SegmentCriterionDefinition::ManualBoundaries {
            elapsed_milliseconds: vec![300_000, 900_000],
        },
    ] {
        SegmentCriterion::create(CRITERION_ID, "Intervals", definition)
            .expect("supported definition");
    }
}

#[test]
fn rejects_invalid_identity_title_and_definition_values() {
    for criterion_id in [
        "",
        "criterion-0123",
        "criterion-0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF",
        "segment-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    ] {
        assert!(matches!(
            SegmentCriterion::create(criterion_id, "Intervals", equal_time()),
            Err(SegmentCriterionError::InvalidIdentifier)
        ));
    }
    assert!(matches!(
        SegmentCriterion::create(CRITERION_ID, "\n", equal_time()),
        Err(SegmentCriterionError::EmptyTitle)
    ));
    assert!(matches!(
        SegmentCriterion::create(CRITERION_ID, &"x".repeat(81), equal_time()),
        Err(SegmentCriterionError::TitleTooLong)
    ));
    assert!(matches!(
        SegmentCriterion::create(CRITERION_ID, "Bad\u{0007}title", equal_time()),
        Err(SegmentCriterionError::ControlCharacterInTitle)
    ));
    assert!(matches!(
        SegmentCriterion::create(
            CRITERION_ID,
            "Time",
            SegmentCriterionDefinition::EqualElapsedTime {
                span_milliseconds: 0,
            },
        ),
        Err(SegmentCriterionError::InvalidElapsedSpan)
    ));
    assert!(matches!(
        SegmentCriterion::create(
            CRITERION_ID,
            "Distance",
            SegmentCriterionDefinition::EqualDistance {
                span_meters: f64::NAN,
            },
        ),
        Err(SegmentCriterionError::InvalidDistanceSpan)
    ));
    for span_meters in [0.000_1, i64::MAX as f64 / 1_000.0] {
        assert!(matches!(
            SegmentCriterion::create(
                CRITERION_ID,
                "Distance",
                SegmentCriterionDefinition::EqualDistance { span_meters },
            ),
            Err(SegmentCriterionError::InvalidDistanceSpan)
        ));
    }
    assert!(matches!(
        SegmentCriterion::create(
            CRITERION_ID,
            "Zone",
            SegmentCriterionDefinition::HeartRateZone {
                minimum_beats_per_minute: 160,
                maximum_beats_per_minute: 140,
            },
        ),
        Err(SegmentCriterionError::InvalidHeartRateZone)
    ));
    for boundaries in [vec![], vec![0], vec![60_000, 60_000], vec![120_000, 60_000]] {
        assert!(matches!(
            SegmentCriterion::create(
                CRITERION_ID,
                "Manual",
                SegmentCriterionDefinition::ManualBoundaries {
                    elapsed_milliseconds: boundaries,
                },
            ),
            Err(SegmentCriterionError::InvalidManualBoundaries)
        ));
    }
}

#[test]
fn rejects_noncanonical_or_incompatible_restored_state() {
    assert!(matches!(
        SegmentCriterion::restore(
            CRITERION_ID,
            " Intervals ",
            equal_time(),
            SegmentCriterionAuthorship::User,
            1,
            1,
        ),
        Err(SegmentCriterionError::NonCanonicalTitle)
    ));
    assert!(matches!(
        SegmentCriterion::restore(
            CRITERION_ID,
            "Intervals",
            equal_time(),
            SegmentCriterionAuthorship::User,
            2,
            1,
        ),
        Err(SegmentCriterionError::UnsupportedEvaluationVersion)
    ));
    assert!(matches!(
        SegmentCriterion::restore(
            CRITERION_ID,
            "Intervals",
            equal_time(),
            SegmentCriterionAuthorship::User,
            1,
            0,
        ),
        Err(SegmentCriterionError::ZeroRevision)
    ));
}
