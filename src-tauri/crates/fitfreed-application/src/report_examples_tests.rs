use super::*;

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
