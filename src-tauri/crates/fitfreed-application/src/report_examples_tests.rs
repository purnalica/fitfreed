use std::collections::BTreeMap;

use super::*;

const SNAPSHOT: &str =
    "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SESSION: &str = "session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SPORT: &str = "sport-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

struct EvidencePort(Result<ReportExampleEvidence, String>);

impl ReportExampleEvidencePort for EvidencePort {
    fn report_example_evidence(&self) -> Result<ReportExampleEvidence, String> {
        self.0.clone()
    }
}

fn evidence(
    training_session_count: usize,
    routed_session_count: usize,
    structured_training_target_count: usize,
) -> EvidencePort {
    EvidencePort(Ok(ReportExampleEvidence {
        training_session_count,
        routed_session_count,
        structured_training_target_count,
    }))
}

struct SubjectPort {
    result:
        Result<PersistedReportExampleTrainingSessionSubjectPage, TrainingSessionDiscoveryPortError>,
}

impl ReportExampleSubjectPort for SubjectPort {
    fn query_training_session_subjects(
        &self,
        _request: &ReportExampleTrainingSessionSubjectPersistenceQuery,
    ) -> Result<PersistedReportExampleTrainingSessionSubjectPage, TrainingSessionDiscoveryPortError>
    {
        self.result.clone()
    }
}

fn subject_query(example_id: ReportExampleId) -> ReportExampleTrainingSessionSubjectQuery {
    ReportExampleTrainingSessionSubjectQuery {
        example_id,
        example_version: REPORT_EXAMPLE_DESCRIPTOR_VERSION,
        offset: 0,
        limit: 12,
        snapshot_ref: None,
    }
}

fn subject_session() -> TrainingSessionSearchItem {
    TrainingSessionSearchItem {
        session_ref: SESSION.to_owned(),
        sport_filter_ref: SPORT.to_owned(),
        source_index: 1,
        started_at_local: "2026-08-16T07:30:00.000".to_owned(),
        stopped_at_local: "2026-08-16T08:30:00.000".to_owned(),
        utc_offset_minutes: Some(120),
        duration_milliseconds: 3_600_000,
        distance_meters: Some(10_000.0),
        energy_kilocalories: Some(650),
        average_heart_rate_bpm: Some(145),
        maximum_heart_rate_bpm: Some(175),
        exercise_count: Some(1),
        sport: TrainingSessionSport {
            sport_ref: Some(SPORT.to_owned()),
            state: TrainingSportState::Recognized,
            classification: Some(TrainingSportClassification {
                scope: TrainingSportClassificationScope::UnresolvedSourceProfile,
                canonical_family: None,
                display_label: None,
                authorship: None,
                revision: 0,
            }),
            recognition: Some(TrainingSportRecognition {
                canonical_family: Some("running".to_owned()),
                localized_names: BTreeMap::from([(
                    "en".to_owned(),
                    "Road running".to_owned(),
                )]),
                catalogue_revision: "catalogue-2026-08-25".to_owned(),
                retrieved_at_utc: "2026-08-25T10:00:00Z".to_owned(),
                mapping_version: "sport-mapping@1".to_owned(),
                evidence_ref:
                    "sport-evidence-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
                        .to_owned(),
            }),
            recognition_candidate_count: 1,
        },
    }
}

fn subject_page(has_route_evidence: bool) -> PersistedReportExampleTrainingSessionSubjectPage {
    PersistedReportExampleTrainingSessionSubjectPage {
        page: PersistedTrainingSessionSearchPage {
            available_range: Some(TrainingDateRange {
                from: "2026-08-16".to_owned(),
                through: "2026-08-16".to_owned(),
            }),
            snapshot_ref: SNAPSHOT.to_owned(),
            total_count: 1,
            summaries: vec![TrainingSessionSearchSummary {
                source_index: 1,
                training_days: 1,
                session_count: 1,
                total_duration_milliseconds: 3_600_000,
                distance_session_count: 1,
                total_distance_meters: Some(10_000.0),
                energy_session_count: 1,
                total_energy_kilocalories: Some(650),
                heart_rate_session_count: 1,
            }],
            sessions: vec![subject_session()],
        },
        route_evidence_session_refs: has_route_evidence
            .then(|| SESSION.to_owned())
            .into_iter()
            .collect(),
    }
}

#[test]
fn returns_versioned_session_subjects_without_losing_the_initiating_example() {
    let result = query_report_example_training_session_subjects(
        &SubjectPort {
            result: Ok(subject_page(false)),
        },
        subject_query(ReportExampleId::SessionVisualStory),
    )
    .expect("report subjects");

    assert_eq!(result.example_id, ReportExampleId::SessionVisualStory);
    assert_eq!(result.example_version, REPORT_EXAMPLE_DESCRIPTOR_VERSION);
    assert_eq!(result.snapshot_ref, SNAPSHOT);
    assert_eq!(result.total_count, 1);
    assert_eq!(result.next_offset, None);
    assert_eq!(result.subjects.len(), 1);
    assert_eq!(result.subjects[0].session.session_ref, SESSION);
    assert!(!result.subjects[0].has_route_evidence);
}

#[test]
fn requires_exact_route_evidence_for_every_outdoor_route_candidate() {
    let accepted = query_report_example_training_session_subjects(
        &SubjectPort {
            result: Ok(subject_page(true)),
        },
        subject_query(ReportExampleId::OutdoorRoute),
    )
    .expect("routed report subjects");
    assert!(accepted.subjects[0].has_route_evidence);

    assert!(matches!(
        query_report_example_training_session_subjects(
            &SubjectPort {
                result: Ok(subject_page(false)),
            },
            subject_query(ReportExampleId::OutdoorRoute),
        ),
        Err(ApplicationError::ReportDefinitionQuery(message))
            if message.contains("route evidence")
    ));
}

#[test]
fn rejects_non_session_examples_unsupported_versions_and_invalid_pages() {
    for invalid in [
        ReportExampleTrainingSessionSubjectQuery {
            example_id: ReportExampleId::AdjacentPeriodVolume,
            ..subject_query(ReportExampleId::SessionVisualStory)
        },
        ReportExampleTrainingSessionSubjectQuery {
            example_version: REPORT_EXAMPLE_DESCRIPTOR_VERSION + 1,
            ..subject_query(ReportExampleId::SessionVisualStory)
        },
        ReportExampleTrainingSessionSubjectQuery {
            limit: 0,
            ..subject_query(ReportExampleId::SessionVisualStory)
        },
    ] {
        assert!(matches!(
            query_report_example_training_session_subjects(
                &SubjectPort {
                    result: Ok(subject_page(false)),
                },
                invalid,
            ),
            Err(ApplicationError::InvalidReportDefinition(_))
        ));
    }
}

#[test]
fn maps_subject_snapshot_changes_and_storage_failures_to_report_semantics() {
    let changed = query_report_example_training_session_subjects(
        &SubjectPort {
            result: Err(TrainingSessionDiscoveryPortError::SnapshotChanged),
        },
        subject_query(ReportExampleId::SessionVisualStory),
    );
    assert!(matches!(
        changed,
        Err(ApplicationError::ReportSourceChanged)
    ));

    let failed = query_report_example_training_session_subjects(
        &SubjectPort {
            result: Err(TrainingSessionDiscoveryPortError::Failure(
                "library unavailable".to_owned(),
            )),
        },
        subject_query(ReportExampleId::SessionVisualStory),
    );
    assert!(matches!(
        failed,
        Err(ApplicationError::ReportDefinitionQuery(message))
            if message == "library unavailable"
    ));
}

#[test]
fn publishes_four_versioned_provider_neutral_recipes_in_stable_order() {
    let catalog = list_report_examples(&evidence(12, 4, 3)).expect("example catalog");

    assert_eq!(catalog.examples.len(), 4);
    assert_eq!(
        catalog
            .examples
            .iter()
            .map(|example| example.id)
            .collect::<Vec<_>>(),
        [
            ReportExampleId::AdjacentPeriodVolume,
            ReportExampleId::SessionVisualStory,
            ReportExampleId::OutdoorRoute,
            ReportExampleId::StructuredTrainingPlan,
        ]
    );
    assert!(catalog
        .examples
        .iter()
        .all(|example| example.version == REPORT_EXAMPLE_DESCRIPTOR_VERSION));
    assert_eq!(
        catalog.examples[0].block_recipe,
        [
            ReportExampleBlockRecipe::TrainingFindingSessionCount,
            ReportExampleBlockRecipe::TrainingChartDuration,
            ReportExampleBlockRecipe::TrainingCoverage,
        ]
    );
    assert_eq!(
        catalog.examples[2].block_recipe,
        [
            ReportExampleBlockRecipe::SessionEvidence,
            ReportExampleBlockRecipe::Route,
        ]
    );
    assert_eq!(
        catalog.examples[3].purpose,
        ReportExamplePurpose::ReviewStructuredTraining
    );
    assert_eq!(
        catalog.examples[3].question,
        ReportExampleQuestion::HowWasThisTrainingStructured
    );
}

#[test]
fn marks_only_parameter_free_evidence_ready_and_never_chooses_a_session_or_plan() {
    for port in [evidence(1, 1, 1), evidence(400, 80, 25)] {
        let examples = list_report_examples(&port)
            .expect("available examples")
            .examples;
        assert_eq!(examples[0].availability, ReportExampleAvailability::Ready);
        assert_eq!(
            examples[1].availability,
            ReportExampleAvailability::SelectionRequired {
                destination: ReportExampleDestination::TrainingSessions,
            }
        );
        assert_eq!(
            examples[2].availability,
            ReportExampleAvailability::SelectionRequired {
                destination: ReportExampleDestination::TrainingSessions,
            }
        );
        assert_eq!(
            examples[3].availability,
            ReportExampleAvailability::SelectionRequired {
                destination: ReportExampleDestination::PlannedTraining,
            }
        );
    }
}

#[test]
fn explains_exact_missing_capabilities_for_empty_and_partial_libraries() {
    let empty = list_report_examples(&evidence(0, 0, 0))
        .expect("empty catalog")
        .examples;
    assert_eq!(
        empty[0].availability,
        ReportExampleAvailability::Unavailable {
            missing_capabilities: vec![ReportExampleCapability::TrainingHistory],
        }
    );
    assert_eq!(
        empty[1].availability,
        ReportExampleAvailability::Unavailable {
            missing_capabilities: vec![ReportExampleCapability::TrainingSession],
        }
    );
    assert_eq!(
        empty[2].availability,
        ReportExampleAvailability::Unavailable {
            missing_capabilities: vec![
                ReportExampleCapability::TrainingSession,
                ReportExampleCapability::RouteEvidence,
            ],
        }
    );
    assert_eq!(
        empty[3].availability,
        ReportExampleAvailability::Unavailable {
            missing_capabilities: vec![ReportExampleCapability::StructuredTraining],
        }
    );

    let no_routes = list_report_examples(&evidence(7, 0, 2))
        .expect("partial catalog")
        .examples;
    assert_eq!(
        no_routes[2].availability,
        ReportExampleAvailability::Unavailable {
            missing_capabilities: vec![ReportExampleCapability::RouteEvidence],
        }
    );
}

#[test]
fn rejects_inconsistent_or_failed_evidence_without_publishing_a_catalog() {
    assert!(matches!(
        list_report_examples(&evidence(1, 2, 0)),
        Err(ApplicationError::ReportDefinitionQuery(message))
            if message.contains("route evidence exceeds")
    ));
    assert!(matches!(
        list_report_examples(&EvidencePort(Err("library unavailable".to_owned()))),
        Err(ApplicationError::ReportDefinitionQuery(message))
            if message == "library unavailable"
    ));
}
