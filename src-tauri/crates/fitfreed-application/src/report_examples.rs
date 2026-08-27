use crate::ApplicationError;

pub const REPORT_EXAMPLE_DESCRIPTOR_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReportExampleId {
    AdjacentPeriodVolume,
    SessionVisualStory,
    OutdoorRoute,
    StructuredTrainingPlan,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReportExamplePurpose {
    CompareTrainingVolume,
    UnderstandOneSession,
    InvestigateOutdoorRoute,
    ReviewStructuredTraining,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReportExampleQuestion {
    HowHasTrainingChanged,
    WhatHappenedInThisSession,
    WhereDidThisSessionChange,
    HowWasThisTrainingStructured,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReportExampleCapability {
    TrainingHistory,
    TrainingSession,
    RouteEvidence,
    StructuredTraining,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReportExampleParameter {
    None,
    TrainingSession,
    RoutedTrainingSession,
    PlannedTrainingTarget,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReportExampleBlockRecipe {
    TrainingFindingSessionCount,
    TrainingChartDuration,
    TrainingCoverage,
    SessionEvidence,
    Route,
    PlannedTraining,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReportExampleDestination {
    TrainingSessions,
    PlannedTraining,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReportExampleAvailability {
    Ready,
    SelectionRequired {
        destination: ReportExampleDestination,
    },
    Unavailable {
        missing_capabilities: Vec<ReportExampleCapability>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReportExampleDescriptor {
    pub id: ReportExampleId,
    pub version: u32,
    pub purpose: ReportExamplePurpose,
    pub question: ReportExampleQuestion,
    pub required_capabilities: Vec<ReportExampleCapability>,
    pub parameter: ReportExampleParameter,
    pub block_recipe: Vec<ReportExampleBlockRecipe>,
    pub availability: ReportExampleAvailability,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReportExampleCatalog {
    pub examples: Vec<ReportExampleDescriptor>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReportExampleEvidence {
    pub training_session_count: usize,
    pub routed_session_count: usize,
    pub structured_training_target_count: usize,
}

pub trait ReportExampleEvidencePort {
    fn report_example_evidence(&self) -> Result<ReportExampleEvidence, String>;
}

pub fn list_report_examples(
    evidence_port: &dyn ReportExampleEvidencePort,
) -> Result<ReportExampleCatalog, ApplicationError> {
    let evidence = evidence_port
        .report_example_evidence()
        .map_err(ApplicationError::ReportDefinitionQuery)?;
    if evidence.routed_session_count > evidence.training_session_count {
        return Err(ApplicationError::ReportDefinitionQuery(
            "report example route evidence exceeds training-session evidence".to_owned(),
        ));
    }

    let has_sessions = evidence.training_session_count > 0;
    let adjacent_availability = if has_sessions {
        ReportExampleAvailability::Ready
    } else {
        unavailable(&[ReportExampleCapability::TrainingHistory])
    };
    let session_availability = if has_sessions {
        selection(ReportExampleDestination::TrainingSessions)
    } else {
        unavailable(&[ReportExampleCapability::TrainingSession])
    };
    let route_availability = if evidence.routed_session_count > 0 {
        selection(ReportExampleDestination::TrainingSessions)
    } else if has_sessions {
        unavailable(&[ReportExampleCapability::RouteEvidence])
    } else {
        unavailable(&[
            ReportExampleCapability::TrainingSession,
            ReportExampleCapability::RouteEvidence,
        ])
    };
    let planned_availability = if evidence.structured_training_target_count > 0 {
        selection(ReportExampleDestination::PlannedTraining)
    } else {
        unavailable(&[ReportExampleCapability::StructuredTraining])
    };

    Ok(ReportExampleCatalog {
        examples: vec![
            descriptor(
                ReportExampleId::AdjacentPeriodVolume,
                ReportExamplePurpose::CompareTrainingVolume,
                ReportExampleQuestion::HowHasTrainingChanged,
                &[ReportExampleCapability::TrainingHistory],
                ReportExampleParameter::None,
                &[
                    ReportExampleBlockRecipe::TrainingFindingSessionCount,
                    ReportExampleBlockRecipe::TrainingChartDuration,
                    ReportExampleBlockRecipe::TrainingCoverage,
                ],
                adjacent_availability,
            ),
            descriptor(
                ReportExampleId::SessionVisualStory,
                ReportExamplePurpose::UnderstandOneSession,
                ReportExampleQuestion::WhatHappenedInThisSession,
                &[ReportExampleCapability::TrainingSession],
                ReportExampleParameter::TrainingSession,
                &[ReportExampleBlockRecipe::SessionEvidence],
                session_availability,
            ),
            descriptor(
                ReportExampleId::OutdoorRoute,
                ReportExamplePurpose::InvestigateOutdoorRoute,
                ReportExampleQuestion::WhereDidThisSessionChange,
                &[
                    ReportExampleCapability::TrainingSession,
                    ReportExampleCapability::RouteEvidence,
                ],
                ReportExampleParameter::RoutedTrainingSession,
                &[
                    ReportExampleBlockRecipe::SessionEvidence,
                    ReportExampleBlockRecipe::Route,
                ],
                route_availability,
            ),
            descriptor(
                ReportExampleId::StructuredTrainingPlan,
                ReportExamplePurpose::ReviewStructuredTraining,
                ReportExampleQuestion::HowWasThisTrainingStructured,
                &[ReportExampleCapability::StructuredTraining],
                ReportExampleParameter::PlannedTrainingTarget,
                &[ReportExampleBlockRecipe::PlannedTraining],
                planned_availability,
            ),
        ],
    })
}

fn descriptor(
    id: ReportExampleId,
    purpose: ReportExamplePurpose,
    question: ReportExampleQuestion,
    required_capabilities: &[ReportExampleCapability],
    parameter: ReportExampleParameter,
    block_recipe: &[ReportExampleBlockRecipe],
    availability: ReportExampleAvailability,
) -> ReportExampleDescriptor {
    ReportExampleDescriptor {
        id,
        version: REPORT_EXAMPLE_DESCRIPTOR_VERSION,
        purpose,
        question,
        required_capabilities: required_capabilities.to_vec(),
        parameter,
        block_recipe: block_recipe.to_vec(),
        availability,
    }
}

fn selection(destination: ReportExampleDestination) -> ReportExampleAvailability {
    ReportExampleAvailability::SelectionRequired { destination }
}

fn unavailable(missing_capabilities: &[ReportExampleCapability]) -> ReportExampleAvailability {
    ReportExampleAvailability::Unavailable {
        missing_capabilities: missing_capabilities.to_vec(),
    }
}
