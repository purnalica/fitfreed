use super::*;

const REPORT_REF: &str = "report-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const SESSION_BLOCK_REF: &str =
    "report-block-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const NARRATIVE_BLOCK_REF: &str =
    "report-block-abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
const SESSION_REF: &str =
    "session-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const SNAPSHOT_REF: &str =
    "training-snapshot-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

fn session_block(include_physiological_context: bool) -> ReportBlock {
    ReportBlock::session_evidence(
        SESSION_BLOCK_REF,
        SESSION_REF,
        include_physiological_context,
    )
    .expect("session block")
}

fn narrative_block(body: &str) -> ReportBlock {
    ReportBlock::narrative(NARRATIVE_BLOCK_REF, body).expect("narrative block")
}

#[test]
fn creates_a_canonical_user_authored_session_report() {
    let report = ReportDefinition::create_session_report(
        REPORT_REF,
        "  Morning progression  ",
        ReportLocale::EnUs,
        SNAPSHOT_REF,
        session_block(true),
        narrative_block("  Felt controlled.\r\nStrong finish.  "),
    )
    .expect("report definition");

    assert_eq!(report.report_ref(), REPORT_REF);
    assert_eq!(report.title(), "Morning progression");
    assert_eq!(report.locale(), ReportLocale::EnUs);
    assert_eq!(report.source_snapshot_ref(), SNAPSHOT_REF);
    assert_eq!(
        report.origin(),
        &ReportOrigin::Session {
            session_ref: SESSION_REF.to_owned()
        }
    );
    assert_eq!(
        report.provenance_policy(),
        ReportProvenancePolicy::CurrentAttribution
    );
    assert_eq!(report.authorship(), ReportAuthorship::User);
    assert_eq!(report.definition_version(), REPORT_DEFINITION_VERSION);
    assert_eq!(report.revision(), 1);
    assert_eq!(report.blocks().len(), 2);
    assert_eq!(
        report.blocks()[1].content(),
        &ReportBlockContent::Narrative {
            body: "Felt controlled.\nStrong finish.".to_owned()
        }
    );
}

#[test]
fn rejects_invalid_identity_order_and_noncanonical_restoration() {
    assert_eq!(
        ReportDefinition::create_session_report(
            "report-invalid",
            "Progression",
            ReportLocale::EnUs,
            SNAPSHOT_REF,
            session_block(false),
            narrative_block("Evidence")
        )
        .expect_err("invalid report identity"),
        ReportDefinitionError::InvalidReportIdentifier
    );

    assert_eq!(
        ReportDefinition::restore(
            REPORT_REF,
            " Progression ",
            ReportLocale::EnUs,
            SNAPSHOT_REF,
            ReportOrigin::Session {
                session_ref: SESSION_REF.to_owned()
            },
            ReportProvenancePolicy::CurrentAttribution,
            ReportAuthorship::User,
            REPORT_DEFINITION_VERSION,
            1,
            vec![session_block(false), narrative_block("Evidence")]
        )
        .expect_err("noncanonical title"),
        ReportDefinitionError::NonCanonicalTitle
    );

    assert_eq!(
        ReportDefinition::restore(
            REPORT_REF,
            "Progression",
            ReportLocale::EnUs,
            SNAPSHOT_REF,
            ReportOrigin::Session {
                session_ref: SESSION_REF.to_owned()
            },
            ReportProvenancePolicy::CurrentAttribution,
            ReportAuthorship::User,
            REPORT_DEFINITION_VERSION,
            1,
            vec![narrative_block("Evidence"), session_block(false)]
        )
        .expect_err("reordered version-one blocks"),
        ReportDefinitionError::InvalidVersionOneBlockOrder
    );
}

#[test]
fn rejects_duplicate_blocks_foreign_origin_and_invalid_content() {
    assert_eq!(
        ReportBlock::narrative(NARRATIVE_BLOCK_REF, " \n ").expect_err("empty narrative"),
        ReportDefinitionError::EmptyNarrative
    );
    assert_eq!(
        ReportBlock::narrative(NARRATIVE_BLOCK_REF, "invalid\u{0007}text")
            .expect_err("control character"),
        ReportDefinitionError::ControlCharacterInNarrative
    );

    let other_session_ref =
        "session-abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    assert_eq!(
        ReportDefinition::restore(
            REPORT_REF,
            "Progression",
            ReportLocale::EnUs,
            SNAPSHOT_REF,
            ReportOrigin::Session {
                session_ref: other_session_ref.to_owned()
            },
            ReportProvenancePolicy::CurrentAttribution,
            ReportAuthorship::User,
            REPORT_DEFINITION_VERSION,
            1,
            vec![session_block(false), narrative_block("Evidence")]
        )
        .expect_err("foreign origin"),
        ReportDefinitionError::SessionOriginMismatch
    );

    let duplicate_narrative = ReportBlock::narrative(SESSION_BLOCK_REF, "Evidence")
        .expect("individually valid duplicate reference");
    assert_eq!(
        ReportDefinition::restore(
            REPORT_REF,
            "Progression",
            ReportLocale::EnUs,
            SNAPSHOT_REF,
            ReportOrigin::Session {
                session_ref: SESSION_REF.to_owned()
            },
            ReportProvenancePolicy::CurrentAttribution,
            ReportAuthorship::User,
            REPORT_DEFINITION_VERSION,
            1,
            vec![session_block(false), duplicate_narrative]
        )
        .expect_err("duplicate block reference"),
        ReportDefinitionError::DuplicateBlockIdentifier
    );
}

#[test]
fn edits_effective_user_content_with_optimistic_revision_semantics() {
    let original = ReportDefinition::create_session_report(
        REPORT_REF,
        "Progression",
        ReportLocale::EnUs,
        SNAPSHOT_REF,
        session_block(true),
        narrative_block("Original interpretation"),
    )
    .expect("original report");

    let unchanged = author_session_report(
        &original,
        " Progression ",
        ReportLocale::EnUs,
        true,
        " Original interpretation ",
    )
    .expect("unchanged edit");
    assert_eq!(unchanged.revision(), 1);

    let changed = author_session_report(
        &original,
        "Progression reviewed",
        ReportLocale::EsEs,
        false,
        "A conservative interpretation.",
    )
    .expect("effective edit");
    assert_eq!(changed.revision(), 2);
    assert_eq!(changed.title(), "Progression reviewed");
    assert_eq!(changed.locale(), ReportLocale::EsEs);
    assert_eq!(
        changed.blocks()[0].content(),
        &ReportBlockContent::SessionEvidence {
            session_ref: SESSION_REF.to_owned(),
            include_physiological_context: false
        }
    );
    assert_eq!(
        changed.blocks()[1].content(),
        &ReportBlockContent::Narrative {
            body: "A conservative interpretation.".to_owned()
        }
    );
    assert_eq!(changed.source_snapshot_ref(), SNAPSHOT_REF);
}

#[test]
fn rejects_unsupported_versions_zero_revisions_and_oversized_text() {
    let long_title = "x".repeat(121);
    assert_eq!(
        ReportDefinition::create_session_report(
            REPORT_REF,
            &long_title,
            ReportLocale::EnUs,
            SNAPSHOT_REF,
            session_block(false),
            narrative_block("Evidence")
        )
        .expect_err("long title"),
        ReportDefinitionError::TitleTooLong
    );
    assert_eq!(
        ReportBlock::narrative(NARRATIVE_BLOCK_REF, &"x".repeat(10_001))
            .expect_err("long narrative"),
        ReportDefinitionError::NarrativeTooLong
    );

    for (definition_version, revision, expected) in [
        (2, 1, ReportDefinitionError::UnsupportedDefinitionVersion),
        (1, 0, ReportDefinitionError::ZeroRevision),
    ] {
        assert_eq!(
            ReportDefinition::restore(
                REPORT_REF,
                "Progression",
                ReportLocale::EnUs,
                SNAPSHOT_REF,
                ReportOrigin::Session {
                    session_ref: SESSION_REF.to_owned()
                },
                ReportProvenancePolicy::CurrentAttribution,
                ReportAuthorship::User,
                definition_version,
                revision,
                vec![session_block(false), narrative_block("Evidence")]
            )
            .expect_err("invalid compatibility value"),
            expected
        );
    }
}
