use std::collections::BTreeSet;

use crate::{
    planned_training::valid_opaque_ref,
    training_discovery::{
        build_training_session_search_page, validate_training_session_search_request,
    },
    ApplicationError, PersistedTrainingSessionSearchPage, PlannedTrainingCompletionFilter,
    PlannedTrainingQueryPortError, TrainingSessionDiscoveryPortError, TrainingSessionSearchItem,
    TrainingSessionSearchRequest, TrainingSessionSort,
};

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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReportExampleTrainingSessionEligibility {
    AnySession,
    RouteEvidence,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReportExampleTrainingSessionSubjectQuery {
    pub example_id: ReportExampleId,
    pub example_version: u32,
    pub offset: usize,
    pub limit: usize,
    pub snapshot_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReportExampleTrainingSessionSubjectPersistenceQuery {
    pub search: TrainingSessionSearchRequest,
    pub eligibility: ReportExampleTrainingSessionEligibility,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedReportExampleTrainingSessionSubjectPage {
    pub page: PersistedTrainingSessionSearchPage,
    pub route_evidence_session_refs: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ReportExampleTrainingSessionSubject {
    pub session: TrainingSessionSearchItem,
    pub has_route_evidence: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ReportExampleTrainingSessionSubjectPage {
    pub example_id: ReportExampleId,
    pub example_version: u32,
    pub snapshot_ref: String,
    pub total_count: usize,
    pub offset: usize,
    pub limit: usize,
    pub next_offset: Option<usize>,
    pub subjects: Vec<ReportExampleTrainingSessionSubject>,
}

pub trait ReportExampleSubjectPort {
    fn query_training_session_subjects(
        &self,
        request: &ReportExampleTrainingSessionSubjectPersistenceQuery,
    ) -> Result<PersistedReportExampleTrainingSessionSubjectPage, TrainingSessionDiscoveryPortError>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReportExamplePlannedTrainingSubjectQuery {
    pub example_id: ReportExampleId,
    pub example_version: u32,
    pub offset: usize,
    pub limit: usize,
    pub snapshot_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReportExamplePlannedTrainingSubjectPersistenceQuery {
    pub offset: usize,
    pub limit: usize,
    pub snapshot_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReportExamplePlannedTrainingSubjectKind {
    Scheduled {
        scheduled_at_local: String,
        completion: PlannedTrainingCompletionFilter,
    },
    FavoriteTemplate,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReportExamplePlannedTrainingSubject {
    pub target_ref: String,
    pub kind: ReportExamplePlannedTrainingSubjectKind,
    pub name: String,
    pub exercise_count: usize,
    pub phase_count: usize,
    pub repeat_block_count: usize,
    pub contains_intensity_evidence: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PersistedReportExamplePlannedTrainingSubjectPage {
    pub snapshot_ref: String,
    pub total_count: usize,
    pub subjects: Vec<ReportExamplePlannedTrainingSubject>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReportExamplePlannedTrainingSubjectPage {
    pub example_id: ReportExampleId,
    pub example_version: u32,
    pub snapshot_ref: String,
    pub total_count: usize,
    pub offset: usize,
    pub limit: usize,
    pub next_offset: Option<usize>,
    pub subjects: Vec<ReportExamplePlannedTrainingSubject>,
}

pub trait ReportExamplePlannedTrainingSubjectPort {
    fn query_planned_training_subjects(
        &self,
        request: &ReportExamplePlannedTrainingSubjectPersistenceQuery,
    ) -> Result<PersistedReportExamplePlannedTrainingSubjectPage, PlannedTrainingQueryPortError>;
}

pub fn query_report_example_training_session_subjects(
    port: &dyn ReportExampleSubjectPort,
    query: ReportExampleTrainingSessionSubjectQuery,
) -> Result<ReportExampleTrainingSessionSubjectPage, ApplicationError> {
    if query.example_version != REPORT_EXAMPLE_DESCRIPTOR_VERSION {
        return Err(ApplicationError::InvalidReportDefinition(
            "report example version is not supported".to_owned(),
        ));
    }
    let eligibility = match query.example_id {
        ReportExampleId::SessionVisualStory => ReportExampleTrainingSessionEligibility::AnySession,
        ReportExampleId::OutdoorRoute => ReportExampleTrainingSessionEligibility::RouteEvidence,
        ReportExampleId::AdjacentPeriodVolume | ReportExampleId::StructuredTrainingPlan => {
            return Err(ApplicationError::InvalidReportDefinition(
                "report example does not accept a training-session subject".to_owned(),
            ));
        }
    };
    let search = TrainingSessionSearchRequest {
        from: None,
        through: None,
        sport_refs: Vec::new(),
        required_measurements: Vec::new(),
        text: None,
        sort: TrainingSessionSort::StartedDescending,
        offset: query.offset,
        limit: query.limit,
        snapshot_ref: query.snapshot_ref,
    };
    validate_training_session_search_request(&search).map_err(|_| {
        ApplicationError::InvalidReportDefinition(
            "report example subject page is invalid".to_owned(),
        )
    })?;
    let persisted = port
        .query_training_session_subjects(&ReportExampleTrainingSessionSubjectPersistenceQuery {
            search: search.clone(),
            eligibility,
        })
        .map_err(map_subject_port_error)?;
    let route_refs = persisted
        .route_evidence_session_refs
        .iter()
        .collect::<BTreeSet<_>>();
    if route_refs.len() != persisted.route_evidence_session_refs.len()
        || route_refs.iter().any(|route_ref| {
            !persisted
                .page
                .sessions
                .iter()
                .any(|session| &session.session_ref == *route_ref)
        })
    {
        return Err(ApplicationError::ReportDefinitionQuery(
            "report example route evidence is inconsistent".to_owned(),
        ));
    }
    if eligibility == ReportExampleTrainingSessionEligibility::RouteEvidence
        && persisted
            .page
            .sessions
            .iter()
            .any(|session| !route_refs.contains(&session.session_ref))
    {
        return Err(ApplicationError::ReportDefinitionQuery(
            "report example candidate lacks required route evidence".to_owned(),
        ));
    }
    let page = build_training_session_search_page(search, persisted.page)?;
    let subjects = page
        .sessions
        .into_iter()
        .map(|session| ReportExampleTrainingSessionSubject {
            has_route_evidence: route_refs.contains(&session.session_ref),
            session,
        })
        .collect();
    Ok(ReportExampleTrainingSessionSubjectPage {
        example_id: query.example_id,
        example_version: query.example_version,
        snapshot_ref: page.snapshot_ref,
        total_count: page.total_count,
        offset: page.offset,
        limit: page.limit,
        next_offset: page.next_offset,
        subjects,
    })
}

pub fn query_report_example_planned_training_subjects(
    port: &dyn ReportExamplePlannedTrainingSubjectPort,
    query: ReportExamplePlannedTrainingSubjectQuery,
) -> Result<ReportExamplePlannedTrainingSubjectPage, ApplicationError> {
    if query.example_id != ReportExampleId::StructuredTrainingPlan
        || query.example_version != REPORT_EXAMPLE_DESCRIPTOR_VERSION
        || query.limit == 0
        || query.limit > 100
        || query
            .snapshot_ref
            .as_deref()
            .is_some_and(|snapshot| !valid_opaque_ref(snapshot, "planned-snapshot-"))
    {
        return Err(ApplicationError::InvalidReportDefinition(
            "planned report example subject query is invalid".to_owned(),
        ));
    }
    let persisted = port
        .query_planned_training_subjects(&ReportExamplePlannedTrainingSubjectPersistenceQuery {
            offset: query.offset,
            limit: query.limit,
            snapshot_ref: query.snapshot_ref.clone(),
        })
        .map_err(map_planned_subject_port_error)?;
    if !valid_opaque_ref(&persisted.snapshot_ref, "planned-snapshot-") {
        return Err(ApplicationError::ReportDefinitionQuery(
            "planned report example snapshot is invalid".to_owned(),
        ));
    }
    if query
        .snapshot_ref
        .as_ref()
        .is_some_and(|expected| expected != &persisted.snapshot_ref)
    {
        return Err(ApplicationError::ReportSourceChanged);
    }
    if persisted.subjects.len() > query.limit
        || query.offset > persisted.total_count
        || (!persisted.subjects.is_empty() && query.offset >= persisted.total_count)
    {
        return Err(ApplicationError::ReportDefinitionQuery(
            "planned report example page count is inconsistent".to_owned(),
        ));
    }
    let consumed = query
        .offset
        .checked_add(persisted.subjects.len())
        .ok_or_else(|| {
            ApplicationError::ReportDefinitionQuery(
                "planned report example page offset overflowed".to_owned(),
            )
        })?;
    if consumed > persisted.total_count {
        return Err(ApplicationError::ReportDefinitionQuery(
            "planned report example page exceeds its total count".to_owned(),
        ));
    }
    let mut target_refs = BTreeSet::new();
    for subject in &persisted.subjects {
        if !target_refs.insert(&subject.target_ref)
            || !valid_opaque_ref(&subject.target_ref, "planned-target-")
            || subject.name.trim() != subject.name
            || subject.name.is_empty()
            || subject.name.chars().count() > 160
        {
            return Err(ApplicationError::ReportDefinitionQuery(
                "planned report example subject identity is invalid".to_owned(),
            ));
        }
        if subject.exercise_count == 0 {
            return Err(ApplicationError::ReportDefinitionQuery(
                "planned report example subject lacks a structured exercise".to_owned(),
            ));
        }
        if subject.repeat_block_count > subject.phase_count {
            return Err(ApplicationError::ReportDefinitionQuery(
                "planned report example subject shape is inconsistent".to_owned(),
            ));
        }
        if let ReportExamplePlannedTrainingSubjectKind::Scheduled {
            scheduled_at_local, ..
        } = &subject.kind
        {
            if scheduled_at_local.trim().is_empty() {
                return Err(ApplicationError::ReportDefinitionQuery(
                    "planned report example schedule is invalid".to_owned(),
                ));
            }
        }
    }
    Ok(ReportExamplePlannedTrainingSubjectPage {
        example_id: query.example_id,
        example_version: query.example_version,
        snapshot_ref: persisted.snapshot_ref,
        total_count: persisted.total_count,
        offset: query.offset,
        limit: query.limit,
        next_offset: (consumed < persisted.total_count).then_some(consumed),
        subjects: persisted.subjects,
    })
}

fn map_planned_subject_port_error(error: PlannedTrainingQueryPortError) -> ApplicationError {
    match error {
        PlannedTrainingQueryPortError::SnapshotChanged
        | PlannedTrainingQueryPortError::TrainingSnapshotChanged => {
            ApplicationError::ReportSourceChanged
        }
        PlannedTrainingQueryPortError::NotFound => ApplicationError::ReportDefinitionQuery(
            "planned report example subject was not found".to_owned(),
        ),
        PlannedTrainingQueryPortError::Failure(reason) => {
            ApplicationError::ReportDefinitionQuery(reason)
        }
    }
}

fn map_subject_port_error(error: TrainingSessionDiscoveryPortError) -> ApplicationError {
    match error {
        TrainingSessionDiscoveryPortError::SnapshotChanged => ApplicationError::ReportSourceChanged,
        TrainingSessionDiscoveryPortError::UnknownSportReference => {
            ApplicationError::ReportDefinitionQuery(
                "report example subject query rejected an internal sport reference".to_owned(),
            )
        }
        TrainingSessionDiscoveryPortError::Failure(reason) => {
            ApplicationError::ReportDefinitionQuery(reason)
        }
    }
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
