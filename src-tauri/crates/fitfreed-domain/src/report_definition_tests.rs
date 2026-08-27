use super::*;

const REPORT_REF: &str = "report-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const SESSION_BLOCK_REF: &str =
    "report-block-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const NARRATIVE_BLOCK_REF: &str =
    "report-block-abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
const ROUTE_BLOCK_REF: &str =
    "report-block-1111111111111111111111111111111111111111111111111111111111111111";
const FINDING_BLOCK_REF: &str =
    "report-block-2222222222222222222222222222222222222222222222222222222222222222";
const COMPARISON_BLOCK_REF: &str =
    "report-block-3333333333333333333333333333333333333333333333333333333333333333";
const CHART_BLOCK_REF: &str =
    "report-block-4444444444444444444444444444444444444444444444444444444444444444";
const TABLE_BLOCK_REF: &str =
    "report-block-5555555555555555555555555555555555555555555555555555555555555555";
const COVERAGE_BLOCK_REF: &str =
    "report-block-6666666666666666666666666666666666666666666666666666666666666666";
const PLANNED_TRAINING_BLOCK_REF: &str =
    "report-block-7777777777777777777777777777777777777777777777777777777777777777";
const SESSION_REF: &str =
    "session-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const ROUTE_REF: &str = "route-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const PLANNED_TARGET_REF: &str =
    "planned-target-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const OTHER_PLANNED_TARGET_REF: &str =
    "planned-target-abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
const SNAPSHOT_REF: &str =
    "training-snapshot-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const CHANGED_SNAPSHOT_REF: &str =
    "training-snapshot-abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
const PLANNED_SNAPSHOT_REF: &str =
    "planned-snapshot-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const CHANGED_PLANNED_SNAPSHOT_REF: &str =
    "planned-snapshot-abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

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

fn route_block(endpoint_redaction_meters: u32) -> ReportBlock {
    ReportBlock::route(
        ROUTE_BLOCK_REF,
        SESSION_REF,
        ROUTE_REF,
        endpoint_redaction_meters,
    )
    .expect("route block")
}

fn planned_training_block(target_ref: &str) -> ReportBlock {
    ReportBlock::planned_training(PLANNED_TRAINING_BLOCK_REF, target_ref)
        .expect("planned-training block")
}

fn comparison_query() -> ReportTrainingComparisonQuery {
    ReportTrainingComparisonQuery::new(
        ReportDateRange::new("2026-01-01", "2026-03-31").expect("baseline range"),
        ReportDateRange::new("2026-04-01", "2026-06-29").expect("comparison range"),
    )
}

fn analytical_blocks(query: &ReportTrainingComparisonQuery) -> Vec<ReportBlock> {
    vec![
        ReportBlock::training_finding(
            FINDING_BLOCK_REF,
            query.clone(),
            ReportTrainingMetric::SessionCount,
        )
        .expect("finding"),
        ReportBlock::training_comparison(COMPARISON_BLOCK_REF, query.clone()).expect("comparison"),
        ReportBlock::training_chart(
            CHART_BLOCK_REF,
            query.clone(),
            ReportTrainingMetric::Duration,
        )
        .expect("chart"),
        ReportBlock::training_exact_table(TABLE_BLOCK_REF, query.clone()).expect("exact table"),
        ReportBlock::training_coverage(COVERAGE_BLOCK_REF, query.clone()).expect("coverage"),
    ]
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
    assert_eq!(report.definition_version(), REPORT_DEFINITION_VERSION_V1);
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
fn composes_and_reorders_a_route_report_without_losing_authorship() {
    let report = ReportDefinition::compose_session_report(
        REPORT_REF,
        "Routed progression",
        ReportLocale::EnUs,
        SNAPSHOT_REF,
        SESSION_REF,
        vec![
            narrative_block("The exposed section felt controlled."),
            route_block(200),
            session_block(false),
        ],
    )
    .expect("composable report");

    assert_eq!(report.definition_version(), REPORT_DEFINITION_VERSION);
    assert_eq!(report.blocks().len(), 3);
    assert_eq!(
        report.blocks()[1].content(),
        &ReportBlockContent::Route {
            session_ref: SESSION_REF.to_owned(),
            route_ref: ROUTE_REF.to_owned(),
            endpoint_redaction_meters: 200,
        }
    );

    let revised = revise_session_report(
        &report,
        "Routed progression",
        ReportLocale::EnUs,
        vec![
            route_block(500),
            session_block(false),
            narrative_block("The exposed section felt controlled."),
        ],
    )
    .expect("reordered report");

    assert_eq!(revised.revision(), 2);
    assert!(matches!(
        revised.blocks()[0].content(),
        ReportBlockContent::Route {
            endpoint_redaction_meters: 500,
            ..
        }
    ));
}

#[test]
fn composes_one_versioned_training_comparison_as_five_independent_views() {
    let query = comparison_query();
    let report = ReportDefinition::compose_session_report(
        REPORT_REF,
        "Training comparison",
        ReportLocale::EnUs,
        SNAPSHOT_REF,
        SESSION_REF,
        vec![
            ReportBlock::training_finding(
                FINDING_BLOCK_REF,
                query.clone(),
                ReportTrainingMetric::SessionCount,
            )
            .expect("finding"),
            ReportBlock::training_comparison(COMPARISON_BLOCK_REF, query.clone())
                .expect("comparison"),
            session_block(false),
            ReportBlock::training_chart(
                CHART_BLOCK_REF,
                query.clone(),
                ReportTrainingMetric::Duration,
            )
            .expect("chart"),
            ReportBlock::training_exact_table(TABLE_BLOCK_REF, query.clone()).expect("exact table"),
            ReportBlock::training_coverage(COVERAGE_BLOCK_REF, query.clone()).expect("coverage"),
            narrative_block("The comparison is descriptive, not causal."),
        ],
    )
    .expect("analytical report");

    assert_eq!(report.definition_version(), REPORT_DEFINITION_VERSION);
    assert_eq!(report.blocks().len(), 7);
    assert_eq!(
        report.blocks()[0].content(),
        &ReportBlockContent::TrainingFinding {
            query: query.clone(),
            metric: ReportTrainingMetric::SessionCount,
        }
    );
    assert_eq!(query.question().code(), "training-period-comparison");
    assert_eq!(query.question().version(), 1);
}

#[test]
fn composes_factual_version_four_reports_without_authored_narrative() {
    let session = ReportDefinition::compose_session_report(
        REPORT_REF,
        "Morning evidence",
        ReportLocale::EnUs,
        SNAPSHOT_REF,
        SESSION_REF,
        vec![session_block(false)],
    )
    .expect("factual session report");
    assert_eq!(session.blocks(), [session_block(false)]);

    let query = comparison_query();
    let comparison = ReportDefinition::compose_report(
        REPORT_REF,
        "Training comparison",
        ReportLocale::EnUs,
        SNAPSHOT_REF,
        ReportOrigin::Question {
            question: ReportQuestion::TrainingPeriodComparisonV1,
        },
        analytical_blocks(&query),
    )
    .expect("factual analytical report");
    assert!(comparison
        .blocks()
        .iter()
        .all(|block| !matches!(block.content(), ReportBlockContent::Narrative { .. })));
}

#[test]
fn composes_one_planned_target_as_single_source_intent_evidence() {
    let report = ReportDefinition::compose_report(
        REPORT_REF,
        "Planned progression",
        ReportLocale::EnUs,
        PLANNED_SNAPSHOT_REF,
        ReportOrigin::PlannedTraining {
            target_ref: PLANNED_TARGET_REF.to_owned(),
        },
        vec![
            planned_training_block(PLANNED_TARGET_REF),
            narrative_block("My notes remain distinct from the imported plan."),
        ],
    )
    .expect("planned-training report");

    assert_eq!(report.definition_version(), REPORT_DEFINITION_VERSION);
    assert_eq!(report.source_snapshot_ref(), PLANNED_SNAPSHOT_REF);
    assert_eq!(
        report.origin(),
        &ReportOrigin::PlannedTraining {
            target_ref: PLANNED_TARGET_REF.to_owned(),
        }
    );
    assert_eq!(
        report.blocks()[0].content(),
        &ReportBlockContent::PlannedTraining {
            target_ref: PLANNED_TARGET_REF.to_owned(),
        }
    );

    let factual = ReportDefinition::compose_report(
        REPORT_REF,
        "Imported workout plan",
        ReportLocale::EsEs,
        PLANNED_SNAPSHOT_REF,
        ReportOrigin::PlannedTraining {
            target_ref: PLANNED_TARGET_REF.to_owned(),
        },
        vec![planned_training_block(PLANNED_TARGET_REF)],
    )
    .expect("factual planned-training report");
    assert_eq!(factual.blocks().len(), 1);
}

#[test]
fn rejects_cross_library_or_mixed_planned_training_compositions() {
    let planned_origin = ReportOrigin::PlannedTraining {
        target_ref: PLANNED_TARGET_REF.to_owned(),
    };
    assert_eq!(
        ReportDefinition::compose_report(
            REPORT_REF,
            "Wrong source library",
            ReportLocale::EnUs,
            SNAPSHOT_REF,
            planned_origin.clone(),
            vec![planned_training_block(PLANNED_TARGET_REF)],
        )
        .expect_err("planned origin must use a planned snapshot"),
        ReportDefinitionError::InvalidSnapshotIdentifier
    );
    assert_eq!(
        ReportDefinition::compose_report(
            REPORT_REF,
            "Recorded report with planned snapshot",
            ReportLocale::EnUs,
            PLANNED_SNAPSHOT_REF,
            ReportOrigin::Blank,
            vec![narrative_block("Authored evidence")],
        )
        .expect_err("recorded origin must use a training snapshot"),
        ReportDefinitionError::InvalidSnapshotIdentifier
    );
    assert_eq!(
        ReportDefinition::compose_report(
            REPORT_REF,
            "Mismatched target",
            ReportLocale::EnUs,
            PLANNED_SNAPSHOT_REF,
            planned_origin.clone(),
            vec![planned_training_block(OTHER_PLANNED_TARGET_REF)],
        )
        .expect_err("block must match the origin target"),
        ReportDefinitionError::PlannedTrainingOriginMismatch
    );
    assert_eq!(
        ReportDefinition::compose_report(
            REPORT_REF,
            "Mixed libraries",
            ReportLocale::EnUs,
            PLANNED_SNAPSHOT_REF,
            planned_origin,
            vec![
                planned_training_block(PLANNED_TARGET_REF),
                ReportBlock::training_comparison(COMPARISON_BLOCK_REF, comparison_query())
                    .expect("training comparison"),
            ],
        )
        .expect_err("one report cannot mix evidence libraries"),
        ReportDefinitionError::InvalidVersionFiveComposition
    );
    assert_eq!(
        ReportDefinition::compose_report(
            REPORT_REF,
            "Blank report with planned authority",
            ReportLocale::EnUs,
            SNAPSHOT_REF,
            ReportOrigin::Blank,
            vec![planned_training_block(PLANNED_TARGET_REF)],
        )
        .expect_err("blank origin cannot invent planned authority"),
        ReportDefinitionError::InvalidVersionFiveComposition
    );
}

#[test]
fn refreshes_a_planned_report_without_rewriting_target_or_authorship() {
    let report = ReportDefinition::compose_report(
        REPORT_REF,
        "Planned progression",
        ReportLocale::EnUs,
        PLANNED_SNAPSHOT_REF,
        ReportOrigin::PlannedTraining {
            target_ref: PLANNED_TARGET_REF.to_owned(),
        },
        vec![
            narrative_block("Preserve this interpretation."),
            planned_training_block(PLANNED_TARGET_REF),
        ],
    )
    .expect("planned report");

    let refreshed = refresh_report_definition(&report, CHANGED_PLANNED_SNAPSHOT_REF)
        .expect("refreshed planned report");

    assert_eq!(
        refreshed.source_snapshot_ref(),
        CHANGED_PLANNED_SNAPSHOT_REF
    );
    assert_eq!(refreshed.revision(), 2);
    assert_eq!(refreshed.origin(), report.origin());
    assert_eq!(refreshed.blocks(), report.blocks());
    assert_eq!(refreshed.title(), report.title());
    assert_eq!(refreshed.locale(), report.locale());
    assert_eq!(
        refresh_report_definition(&refreshed, CHANGED_SNAPSHOT_REF)
            .expect_err("planned report cannot refresh from recorded training"),
        ReportDefinitionError::InvalidSnapshotIdentifier
    );
}

#[test]
fn authorizes_only_revision_bound_removal_and_names_the_removed_report() {
    let report = ReportDefinition::compose_session_report(
        REPORT_REF,
        "Morning evidence",
        ReportLocale::EnUs,
        SNAPSHOT_REF,
        SESSION_REF,
        vec![session_block(false)],
    )
    .expect("report");

    let removed = authorize_report_removal(&report, 1).expect("removal decision");
    assert_eq!(removed.report_ref(), REPORT_REF);
    assert_eq!(removed.title(), "Morning evidence");
    assert_eq!(removed.revision(), 1);
    assert_eq!(
        authorize_report_removal(&report, 2).expect_err("stale revision"),
        ReportDefinitionError::RevisionConflict
    );
}

#[test]
fn composes_question_exploration_and_blank_origins_without_session_authority() {
    let query = comparison_query();
    let mut question_blocks = analytical_blocks(&query);
    question_blocks.push(narrative_block("A question-led interpretation."));
    let question = ReportDefinition::compose_report(
        REPORT_REF,
        "How did my training change?",
        ReportLocale::EnUs,
        SNAPSHOT_REF,
        ReportOrigin::Question {
            question: ReportQuestion::TrainingPeriodComparisonV1,
        },
        question_blocks,
    )
    .expect("question report");

    assert_eq!(question.definition_version(), REPORT_DEFINITION_VERSION);
    assert_eq!(
        question.origin(),
        &ReportOrigin::Question {
            question: ReportQuestion::TrainingPeriodComparisonV1,
        }
    );
    assert!(question.blocks().iter().all(|block| !matches!(
        block.content(),
        ReportBlockContent::SessionEvidence { .. } | ReportBlockContent::Route { .. }
    )));

    let mut exploration_blocks = analytical_blocks(&query);
    exploration_blocks.push(narrative_block("An exploration-led interpretation."));
    let exploration = ReportDefinition::compose_report(
        REPORT_REF,
        "Selected comparison",
        ReportLocale::EnUs,
        SNAPSHOT_REF,
        ReportOrigin::Exploration {
            query: query.clone(),
        },
        exploration_blocks,
    )
    .expect("exploration report");
    assert_eq!(
        exploration.origin(),
        &ReportOrigin::Exploration {
            query: query.clone(),
        }
    );

    let blank = ReportDefinition::compose_report(
        REPORT_REF,
        "Reusable notes",
        ReportLocale::EnUs,
        SNAPSHOT_REF,
        ReportOrigin::Blank,
        vec![narrative_block("Start with an authored interpretation.")],
    )
    .expect("blank report");
    assert_eq!(blank.origin(), &ReportOrigin::Blank);
    assert_eq!(blank.blocks().len(), 1);

    let mut expanded_blocks = analytical_blocks(&query);
    expanded_blocks.push(narrative_block("Start with an authored interpretation."));
    let expanded = revise_report(
        &blank,
        "Reusable comparison",
        ReportLocale::EnUs,
        expanded_blocks,
    )
    .expect("expanded blank report");
    assert_eq!(expanded.origin(), &ReportOrigin::Blank);
    assert_eq!(expanded.revision(), 2);
    assert_eq!(expanded.blocks().len(), 6);
}

#[test]
fn refreshes_only_the_evidence_snapshot_after_an_explicit_review() {
    let query = comparison_query();
    let mut blocks = analytical_blocks(&query);
    blocks.push(narrative_block("The interpretation remains mine."));
    let report = ReportDefinition::compose_report(
        REPORT_REF,
        "Reviewed comparison",
        ReportLocale::EsEs,
        SNAPSHOT_REF,
        ReportOrigin::Exploration { query },
        blocks,
    )
    .expect("original report");

    let refreshed = refresh_report_definition(&report, CHANGED_SNAPSHOT_REF)
        .expect("refreshed report definition");

    assert_eq!(refreshed.report_ref(), report.report_ref());
    assert_eq!(refreshed.title(), report.title());
    assert_eq!(refreshed.locale(), report.locale());
    assert_eq!(refreshed.origin(), report.origin());
    assert_eq!(refreshed.provenance_policy(), report.provenance_policy());
    assert_eq!(refreshed.authorship(), report.authorship());
    assert_eq!(refreshed.definition_version(), report.definition_version());
    assert_eq!(refreshed.blocks(), report.blocks());
    assert_eq!(refreshed.source_snapshot_ref(), CHANGED_SNAPSHOT_REF);
    assert_eq!(refreshed.revision(), report.revision() + 1);
    assert_eq!(
        refresh_report_definition(&refreshed, CHANGED_SNAPSHOT_REF).expect("idempotent refresh"),
        refreshed
    );
    assert_eq!(
        refresh_report_definition(&refreshed, "training-snapshot-invalid")
            .expect_err("invalid candidate snapshot"),
        ReportDefinitionError::InvalidSnapshotIdentifier
    );
}

#[test]
fn rejects_evidence_that_exceeds_the_report_origin_authority() {
    let query = comparison_query();
    let question_origin = ReportOrigin::Question {
        question: ReportQuestion::TrainingPeriodComparisonV1,
    };
    assert_eq!(
        ReportDefinition::compose_report(
            REPORT_REF,
            "Question with session",
            ReportLocale::EnUs,
            SNAPSHOT_REF,
            question_origin.clone(),
            vec![
                session_block(false),
                ReportBlock::training_comparison(COMPARISON_BLOCK_REF, query.clone())
                    .expect("comparison"),
                narrative_block("Evidence"),
            ],
        )
        .expect_err("session authority cannot be invented"),
        ReportDefinitionError::InvalidVersionFiveComposition
    );
    assert_eq!(
        ReportDefinition::compose_report(
            REPORT_REF,
            "Question without answer",
            ReportLocale::EnUs,
            SNAPSHOT_REF,
            question_origin,
            vec![narrative_block("Evidence")],
        )
        .expect_err("question needs an answer"),
        ReportDefinitionError::InvalidVersionFiveComposition
    );
    assert_eq!(
        ReportDefinition::compose_report(
            REPORT_REF,
            "Blank route",
            ReportLocale::EnUs,
            SNAPSHOT_REF,
            ReportOrigin::Blank,
            vec![route_block(200), narrative_block("Evidence")],
        )
        .expect_err("blank origin cannot authorize a route"),
        ReportDefinitionError::InvalidVersionFiveComposition
    );

    let other_query = ReportTrainingComparisonQuery::new(
        ReportDateRange::new("2025-01-01", "2025-01-30").expect("baseline"),
        ReportDateRange::new("2025-02-01", "2025-03-02").expect("comparison"),
    );
    let exploration = ReportDefinition::compose_report(
        REPORT_REF,
        "Exploration with a revised answer",
        ReportLocale::EnUs,
        SNAPSHOT_REF,
        ReportOrigin::Exploration {
            query: query.clone(),
        },
        vec![
            ReportBlock::training_comparison(COMPARISON_BLOCK_REF, other_query)
                .expect("comparison"),
            narrative_block("Evidence"),
        ],
    )
    .expect("the original exploration remains distinct from the authored answer");
    assert_eq!(exploration.origin(), &ReportOrigin::Exploration { query });
}

#[test]
fn rejects_mixed_comparison_questions_duplicate_views_and_invalid_ranges() {
    let query = comparison_query();
    let other_query = ReportTrainingComparisonQuery::new(
        ReportDateRange::new("2025-01-01", "2025-03-31").expect("other baseline"),
        ReportDateRange::new("2025-04-01", "2025-06-29").expect("other comparison"),
    );
    let blocks = |second_query: ReportTrainingComparisonQuery| {
        vec![
            session_block(false),
            ReportBlock::training_finding(
                FINDING_BLOCK_REF,
                query.clone(),
                ReportTrainingMetric::TrainingDays,
            )
            .expect("finding"),
            ReportBlock::training_comparison(COMPARISON_BLOCK_REF, second_query)
                .expect("comparison"),
            narrative_block("Evidence"),
        ]
    };
    assert_eq!(
        ReportDefinition::compose_session_report(
            REPORT_REF,
            "Mixed questions",
            ReportLocale::EnUs,
            SNAPSHOT_REF,
            SESSION_REF,
            blocks(other_query),
        )
        .expect_err("mixed comparison parameters"),
        ReportDefinitionError::MixedTrainingComparisonQueries
    );

    let duplicate = ReportBlock::training_finding(
        "report-block-7777777777777777777777777777777777777777777777777777777777777777",
        query.clone(),
        ReportTrainingMetric::Duration,
    )
    .expect("duplicate finding kind");
    let mut duplicate_blocks = blocks(query.clone());
    duplicate_blocks.insert(2, duplicate);
    assert_eq!(
        ReportDefinition::compose_session_report(
            REPORT_REF,
            "Duplicate view",
            ReportLocale::EnUs,
            SNAPSHOT_REF,
            SESSION_REF,
            duplicate_blocks,
        )
        .expect_err("duplicate analytical kind"),
        ReportDefinitionError::DuplicateTrainingComparisonBlockKind
    );

    assert_eq!(
        ReportDateRange::new("2026-02-30", "2026-03-01").expect_err("invalid date"),
        ReportDefinitionError::InvalidReportDate
    );
    assert_eq!(
        ReportDateRange::new("2025-01-01", "2026-01-02").expect_err("long range"),
        ReportDefinitionError::ReportDateRangeTooLong
    );
}

#[test]
fn restores_immutable_version_one_and_two_shapes_alongside_current_authorship() {
    let restored = ReportDefinition::restore(
        REPORT_REF,
        "Version one",
        ReportLocale::EnUs,
        SNAPSHOT_REF,
        ReportOrigin::Session {
            session_ref: SESSION_REF.to_owned(),
        },
        ReportProvenancePolicy::CurrentAttribution,
        ReportAuthorship::User,
        REPORT_DEFINITION_VERSION_V1,
        3,
        vec![session_block(true), narrative_block("Preserved intent")],
    )
    .expect("version-one report");

    assert_eq!(restored.definition_version(), REPORT_DEFINITION_VERSION_V1);
    let authored = ReportDefinition::create_session_report(
        REPORT_REF,
        "Version one authored",
        ReportLocale::EnUs,
        SNAPSHOT_REF,
        session_block(true),
        narrative_block("Preserved contract"),
    )
    .expect("authored version-one report");
    assert_eq!(authored.definition_version(), REPORT_DEFINITION_VERSION_V1);

    let version_two = ReportDefinition::restore(
        REPORT_REF,
        "Version two",
        ReportLocale::EnUs,
        SNAPSHOT_REF,
        ReportOrigin::Session {
            session_ref: SESSION_REF.to_owned(),
        },
        ReportProvenancePolicy::CurrentAttribution,
        ReportAuthorship::User,
        REPORT_DEFINITION_VERSION_V2,
        4,
        vec![
            route_block(200),
            narrative_block("Preserved route"),
            session_block(false),
        ],
    )
    .expect("version-two report");
    assert_eq!(
        version_two.definition_version(),
        REPORT_DEFINITION_VERSION_V2
    );
    assert!(matches!(
        version_two.blocks()[0].content(),
        ReportBlockContent::Route { .. }
    ));

    let composed = ReportDefinition::compose_session_report(
        REPORT_REF,
        "Current version authored",
        ReportLocale::EnUs,
        SNAPSHOT_REF,
        SESSION_REF,
        vec![session_block(true), narrative_block("Current intent")],
    )
    .expect("authored current-version report");
    assert_eq!(composed.definition_version(), REPORT_DEFINITION_VERSION);
    assert_eq!(
        author_session_report(
            &composed,
            "Legacy edit",
            ReportLocale::EnUs,
            true,
            "Must use the composed-report command.",
        )
        .expect_err("version-one edit of a current definition"),
        ReportDefinitionError::InvalidVersionOneBlockOrder
    );
}

#[test]
fn validates_gregorian_report_ranges_and_the_exact_inclusive_limit() {
    assert!(ReportDateRange::new("2024-02-29", "2024-02-29").is_ok());
    assert_eq!(
        ReportDateRange::new("2023-02-29", "2023-03-01").expect_err("non-leap date"),
        ReportDefinitionError::InvalidReportDate
    );
    assert_eq!(
        ReportDateRange::new("0000-01-01", "0000-01-01").expect_err("zero year"),
        ReportDefinitionError::InvalidReportDate
    );
    assert!(ReportDateRange::new("2024-01-01", "2024-12-31").is_ok());
    assert_eq!(
        ReportDateRange::new("2024-01-01", "2025-01-01").expect_err("367 inclusive days"),
        ReportDefinitionError::ReportDateRangeTooLong
    );
}

#[test]
fn rejects_invalid_route_authority_and_incomplete_compositions() {
    assert_eq!(
        ReportBlock::route(ROUTE_BLOCK_REF, SESSION_REF, ROUTE_REF, 5_001)
            .expect_err("excessive endpoint redaction"),
        ReportDefinitionError::InvalidRouteEndpointRedaction
    );
    assert_eq!(
        ReportBlock::route(ROUTE_BLOCK_REF, SESSION_REF, "route-invalid", 200)
            .expect_err("invalid route reference"),
        ReportDefinitionError::InvalidRouteIdentifier
    );

    let other_route_ref = "route-abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    let duplicate_route = ReportBlock::route(
        "report-block-2222222222222222222222222222222222222222222222222222222222222222",
        SESSION_REF,
        ROUTE_REF,
        500,
    )
    .expect("duplicate route selection");
    assert_eq!(
        ReportDefinition::compose_session_report(
            REPORT_REF,
            "Duplicate route",
            ReportLocale::EnUs,
            SNAPSHOT_REF,
            SESSION_REF,
            vec![
                session_block(false),
                route_block(200),
                duplicate_route,
                narrative_block("Evidence"),
            ],
        )
        .expect_err("duplicate route"),
        ReportDefinitionError::DuplicateRouteIdentifier
    );
    let foreign_route = ReportBlock::route(
        ROUTE_BLOCK_REF,
        "session-abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
        other_route_ref,
        200,
    )
    .expect("foreign route block");
    assert_eq!(
        ReportDefinition::compose_session_report(
            REPORT_REF,
            "Foreign route",
            ReportLocale::EnUs,
            SNAPSHOT_REF,
            SESSION_REF,
            vec![
                session_block(false),
                foreign_route,
                narrative_block("Evidence")
            ],
        )
        .expect_err("foreign route"),
        ReportDefinitionError::SessionOriginMismatch
    );
    assert_eq!(
        ReportDefinition::compose_session_report(
            REPORT_REF,
            "Missing session evidence",
            ReportLocale::EnUs,
            SNAPSHOT_REF,
            SESSION_REF,
            vec![route_block(200)],
        )
        .expect_err("missing session evidence"),
        ReportDefinitionError::InvalidVersionFiveComposition
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
            REPORT_DEFINITION_VERSION_V1,
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
            REPORT_DEFINITION_VERSION_V1,
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
            REPORT_DEFINITION_VERSION_V1,
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
        (6, 1, ReportDefinitionError::UnsupportedDefinitionVersion),
        (
            REPORT_DEFINITION_VERSION_V1,
            0,
            ReportDefinitionError::ZeroRevision,
        ),
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
