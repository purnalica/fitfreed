use std::{
    collections::{BTreeMap, BTreeSet},
    f64::consts::PI,
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
};

use fitfreed_domain::{
    author_session_report, revise_session_report, ReportBlock, ReportBlockContent,
    ReportDefinition, ReportLocale, ReportOrigin, MAX_ROUTE_ENDPOINT_REDACTION_METERS,
};

use crate::{
    query_training_route_points_for_processing, query_training_session_provenance,
    query_training_session_routes, query_training_session_selection, ApplicationError,
    TrainingProvenanceCurrentView, TrainingRouteKindView, TrainingRouteOverview,
    TrainingRoutePointView, TrainingRoutePointsQuery, TrainingSessionDiscoveryPort,
    TrainingSessionProvenancePort, TrainingSessionProvenanceQuery, TrainingSessionRoutePort,
    TrainingSessionRouteQuery, TrainingSessionSearchItem, TrainingSessionSelection,
    TrainingSessionSelectionRequest, TrainingSessionSport, TrainingSportState,
    MAX_PROCESSING_EXACT_POINTS,
};

const REPORT_PREFIX: &str = "report-";
const IDENTIFIER_HEX_CHARACTERS: usize = 64;
const MAX_REPORTS: usize = 1_000;
const MAX_REPORT_ROUTE_VISUAL_POINTS: usize = 500;
const EARTH_RADIUS_METERS: f64 = 6_371_008.8;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReportDefinitionPortError {
    NotFound,
    Conflict,
    Failure(String),
}

pub trait ReportDefinitionPort {
    fn new_report_ref(&self) -> Result<String, ReportDefinitionPortError>;
    fn new_report_block_ref(&self) -> Result<String, ReportDefinitionPortError>;
    fn create_report_definition(
        &self,
        definition: &ReportDefinition,
    ) -> Result<(), ReportDefinitionPortError>;
    fn load_report_definition(
        &self,
        report_ref: &str,
    ) -> Result<Option<ReportDefinition>, ReportDefinitionPortError>;
    fn list_report_definitions(&self) -> Result<Vec<ReportDefinition>, ReportDefinitionPortError>;
    fn compare_and_save_report_definition(
        &self,
        expected_revision: u64,
        definition: &ReportDefinition,
    ) -> Result<bool, ReportDefinitionPortError>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateSessionReportRequest {
    pub title: String,
    pub locale: ReportLocale,
    pub session_ref: String,
    pub source_snapshot_ref: String,
    pub include_physiological_context: bool,
    pub narrative: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateSessionReportRequest {
    pub report_ref: String,
    pub expected_revision: u64,
    pub title: String,
    pub locale: ReportLocale,
    pub include_physiological_context: bool,
    pub narrative: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SessionReportBlockDraftContent {
    SessionEvidence {
        include_physiological_context: bool,
    },
    Route {
        route_ref: String,
        endpoint_redaction_meters: u32,
    },
    Narrative {
        body: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionReportBlockDraft {
    pub block_ref: Option<String>,
    pub content: SessionReportBlockDraftContent,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateComposedSessionReportRequest {
    pub title: String,
    pub locale: ReportLocale,
    pub session_ref: String,
    pub source_snapshot_ref: String,
    pub blocks: Vec<SessionReportBlockDraft>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateComposedSessionReportRequest {
    pub report_ref: String,
    pub expected_revision: u64,
    pub title: String,
    pub locale: ReportLocale,
    pub blocks: Vec<SessionReportBlockDraft>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReportSummary {
    pub report_ref: String,
    pub title: String,
    pub locale: ReportLocale,
    pub source_snapshot_ref: String,
    pub revision: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReportResolutionStatus {
    Current,
    Stale,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReportSensitiveContentKind {
    HeartRate,
    PreciseLocation,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReportSensitiveContent {
    pub kind: ReportSensitiveContentKind,
    pub block_ref: Option<String>,
    pub included: bool,
    pub endpoint_redaction_meters: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReportLimitation {
    DistanceUnavailable,
    EnergyUnavailable,
    HeartRateUnavailable,
    SportUnclassified,
    SportUnavailable,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ReportSessionEvidence {
    pub session_ref: String,
    pub source_index: usize,
    pub started_at_local: String,
    pub stopped_at_local: String,
    pub utc_offset_minutes: Option<i32>,
    pub duration_milliseconds: i64,
    pub distance_meters: Option<f64>,
    pub energy_kilocalories: Option<i64>,
    pub average_heart_rate_bpm: Option<i64>,
    pub maximum_heart_rate_bpm: Option<i64>,
    pub exercise_count: Option<usize>,
    pub sport: TrainingSessionSport,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ReportRouteEvidence {
    pub block_ref: String,
    pub route_ref: String,
    pub kind: TrainingRouteKindView,
    pub started_at_local: String,
    pub source_point_count: usize,
    pub visual_points: Vec<TrainingRoutePointView>,
    pub endpoint_redaction_meters: u32,
    pub included: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ResolvedSessionReport {
    pub definition: ReportDefinition,
    pub resolved_snapshot_ref: String,
    pub status: ReportResolutionStatus,
    pub session: ReportSessionEvidence,
    pub routes: Vec<ReportRouteEvidence>,
    pub provenance: TrainingProvenanceCurrentView,
    pub sensitive_contents: Vec<ReportSensitiveContent>,
    pub limitations: Vec<ReportLimitation>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct AuthorizedSessionReportExport {
    pub definition: ReportDefinition,
    pub resolved_snapshot_ref: String,
    pub session: ReportSessionEvidence,
    pub routes: Vec<ReportRouteEvidence>,
    pub provenance: TrainingProvenanceCurrentView,
    pub limitations: Vec<ReportLimitation>,
    pub include_physiological_context: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionReportExportRequest {
    pub report_ref: String,
    pub expected_revision: u64,
    pub expected_source_snapshot_ref: String,
    pub include_physiological_context: bool,
    pub route_choices: Vec<ReportRouteExportChoice>,
    pub destination: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReportRouteExportChoice {
    pub block_ref: String,
    pub include_geometry: bool,
    pub endpoint_redaction_meters: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ReportExportReceipt {
    pub byte_count: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReportExportPortError {
    Cancelled,
    Failure(String),
}

pub trait ReportExportPort {
    fn export_report(
        &self,
        report: &AuthorizedSessionReportExport,
        destination: &Path,
        cancellation: &ReportExportCancellation,
    ) -> Result<ReportExportReceipt, ReportExportPortError>;
}

#[derive(Debug, Default)]
pub struct ReportExportCancellation {
    cancelled: AtomicBool,
}

impl ReportExportCancellation {
    pub const fn new() -> Self {
        Self {
            cancelled: AtomicBool::new(false),
        }
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }
}

pub fn create_session_report(
    report_port: &dyn ReportDefinitionPort,
    training_port: &dyn TrainingSessionDiscoveryPort,
    request: CreateSessionReportRequest,
) -> Result<ReportDefinition, ApplicationError> {
    resolve_exact_session(
        training_port,
        &request.session_ref,
        Some(request.source_snapshot_ref.clone()),
    )?;
    let report_ref = report_port
        .new_report_ref()
        .map_err(map_definition_query_error)?;
    let session_block_ref = report_port
        .new_report_block_ref()
        .map_err(map_definition_query_error)?;
    let narrative_block_ref = report_port
        .new_report_block_ref()
        .map_err(map_definition_query_error)?;
    let session_block = ReportBlock::session_evidence(
        session_block_ref,
        request.session_ref,
        request.include_physiological_context,
    )
    .map_err(invalid_definition)?;
    let narrative_block = ReportBlock::narrative(narrative_block_ref, &request.narrative)
        .map_err(invalid_definition)?;
    let definition = ReportDefinition::create_session_report(
        report_ref,
        &request.title,
        request.locale,
        request.source_snapshot_ref,
        session_block,
        narrative_block,
    )
    .map_err(invalid_definition)?;
    report_port
        .create_report_definition(&definition)
        .map_err(map_definition_update_error)?;
    Ok(definition)
}

pub fn create_composed_session_report(
    report_port: &dyn ReportDefinitionPort,
    training_port: &dyn TrainingSessionDiscoveryPort,
    route_port: &dyn TrainingSessionRoutePort,
    request: CreateComposedSessionReportRequest,
) -> Result<ReportDefinition, ApplicationError> {
    resolve_exact_session(
        training_port,
        &request.session_ref,
        Some(request.source_snapshot_ref.clone()),
    )?;
    if request.blocks.iter().any(|block| block.block_ref.is_some()) {
        return Err(ApplicationError::InvalidReportDefinition(
            "new report blocks cannot supply existing identities".to_owned(),
        ));
    }
    validate_route_drafts(
        route_port,
        &request.session_ref,
        &request.source_snapshot_ref,
        &request.blocks,
    )?;
    let report_ref = report_port
        .new_report_ref()
        .map_err(map_definition_query_error)?;
    let blocks = materialize_blocks(report_port, &request.session_ref, request.blocks, None)?;
    let definition = ReportDefinition::compose_session_report(
        report_ref,
        &request.title,
        request.locale,
        request.source_snapshot_ref,
        request.session_ref,
        blocks,
    )
    .map_err(invalid_definition)?;
    report_port
        .create_report_definition(&definition)
        .map_err(map_definition_update_error)?;
    Ok(definition)
}

pub fn update_session_report(
    report_port: &dyn ReportDefinitionPort,
    request: UpdateSessionReportRequest,
) -> Result<ReportDefinition, ApplicationError> {
    if request.expected_revision == 0 {
        return Err(ApplicationError::InvalidReportDefinition(
            "expected report revision is zero".to_owned(),
        ));
    }
    let existing = load_report_definition(report_port, &request.report_ref)?;
    if existing.revision() != request.expected_revision {
        return Err(ApplicationError::ReportDefinitionConflict);
    }
    let authored = author_session_report(
        &existing,
        &request.title,
        request.locale,
        request.include_physiological_context,
        &request.narrative,
    )
    .map_err(invalid_definition)?;
    if authored.revision() == existing.revision() {
        return Ok(authored);
    }
    let saved = report_port
        .compare_and_save_report_definition(request.expected_revision, &authored)
        .map_err(map_definition_update_error)?;
    if !saved {
        return Err(ApplicationError::ReportDefinitionConflict);
    }
    Ok(authored)
}

pub fn update_composed_session_report(
    report_port: &dyn ReportDefinitionPort,
    training_port: &dyn TrainingSessionDiscoveryPort,
    route_port: &dyn TrainingSessionRoutePort,
    request: UpdateComposedSessionReportRequest,
) -> Result<ReportDefinition, ApplicationError> {
    if request.expected_revision == 0 {
        return Err(ApplicationError::InvalidReportDefinition(
            "expected report revision is zero".to_owned(),
        ));
    }
    let existing = load_report_definition(report_port, &request.report_ref)?;
    if existing.revision() != request.expected_revision {
        return Err(ApplicationError::ReportDefinitionConflict);
    }
    let session_ref = report_origin_session_ref(&existing).to_owned();
    resolve_exact_session(
        training_port,
        &session_ref,
        Some(existing.source_snapshot_ref().to_owned()),
    )?;
    validate_route_drafts(
        route_port,
        &session_ref,
        existing.source_snapshot_ref(),
        &request.blocks,
    )?;
    let existing_kinds = existing
        .blocks()
        .iter()
        .map(|block| {
            (
                block.block_ref().to_owned(),
                definition_block_kind(block.content()),
            )
        })
        .collect::<BTreeMap<_, _>>();
    let blocks = materialize_blocks(
        report_port,
        &session_ref,
        request.blocks,
        Some(&existing_kinds),
    )?;
    let revised = revise_session_report(&existing, &request.title, request.locale, blocks)
        .map_err(invalid_definition)?;
    if revised.revision() == existing.revision() {
        return Ok(revised);
    }
    let saved = report_port
        .compare_and_save_report_definition(request.expected_revision, &revised)
        .map_err(map_definition_update_error)?;
    if !saved {
        return Err(ApplicationError::ReportDefinitionConflict);
    }
    Ok(revised)
}

pub fn load_report_definition(
    report_port: &dyn ReportDefinitionPort,
    report_ref: &str,
) -> Result<ReportDefinition, ApplicationError> {
    if !valid_ref(report_ref, REPORT_PREFIX) {
        return Err(ApplicationError::InvalidReportDefinition(
            "report reference is invalid".to_owned(),
        ));
    }
    report_port
        .load_report_definition(report_ref)
        .map_err(map_definition_query_error)?
        .ok_or(ApplicationError::ReportNotFound)
}

pub fn list_reports(
    report_port: &dyn ReportDefinitionPort,
) -> Result<Vec<ReportSummary>, ApplicationError> {
    let definitions = report_port
        .list_report_definitions()
        .map_err(map_definition_query_error)?;
    if definitions.len() > MAX_REPORTS {
        return Err(ApplicationError::ReportDefinitionQuery(
            "report list exceeds the supported bound".to_owned(),
        ));
    }
    Ok(definitions
        .into_iter()
        .map(|definition| ReportSummary {
            report_ref: definition.report_ref().to_owned(),
            title: definition.title().to_owned(),
            locale: definition.locale(),
            source_snapshot_ref: definition.source_snapshot_ref().to_owned(),
            revision: definition.revision(),
        })
        .collect())
}

pub fn resolve_session_report(
    report_port: &dyn ReportDefinitionPort,
    training_port: &dyn TrainingSessionDiscoveryPort,
    route_port: &dyn TrainingSessionRoutePort,
    provenance_port: &dyn TrainingSessionProvenancePort,
    report_ref: &str,
) -> Result<ResolvedSessionReport, ApplicationError> {
    let definition = load_report_definition(report_port, report_ref)?;
    resolve_definition(training_port, route_port, provenance_port, definition, None)
}

#[allow(clippy::too_many_arguments)]
pub fn export_session_report(
    report_port: &dyn ReportDefinitionPort,
    training_port: &dyn TrainingSessionDiscoveryPort,
    route_port: &dyn TrainingSessionRoutePort,
    provenance_port: &dyn TrainingSessionProvenancePort,
    export_port: &dyn ReportExportPort,
    request: SessionReportExportRequest,
    cancellation: &ReportExportCancellation,
) -> Result<ReportExportReceipt, ApplicationError> {
    if cancellation.is_cancelled() {
        return Err(ApplicationError::ReportExportCancelled);
    }
    let definition = load_report_definition(report_port, &request.report_ref)?;
    let resolved = resolve_definition(
        training_port,
        route_port,
        provenance_port,
        definition,
        Some(cancellation),
    )?;
    if resolved.definition.revision() != request.expected_revision {
        return Err(ApplicationError::ReportDefinitionConflict);
    }
    if resolved.definition.source_snapshot_ref() != request.expected_source_snapshot_ref
        || resolved.status != ReportResolutionStatus::Current
    {
        return Err(ApplicationError::ReportSourceChanged);
    }
    let definition_includes_physiology = report_includes_physiology(&resolved.definition)?;
    if request.include_physiological_context && !definition_includes_physiology {
        return Err(ApplicationError::InvalidReportDefinition(
            "export cannot add physiological context excluded by the saved report".to_owned(),
        ));
    }
    let mut session = resolved.session;
    if !request.include_physiological_context {
        session.average_heart_rate_bpm = None;
        session.maximum_heart_rate_bpm = None;
    }
    let routes = authorize_export_routes(
        route_port,
        &resolved.definition,
        &resolved.resolved_snapshot_ref,
        resolved.routes,
        &request.route_choices,
        cancellation,
    )?;
    let export = AuthorizedSessionReportExport {
        definition: resolved.definition,
        resolved_snapshot_ref: resolved.resolved_snapshot_ref,
        session,
        routes,
        provenance: resolved.provenance,
        limitations: resolved.limitations,
        include_physiological_context: request.include_physiological_context,
    };
    export_port
        .export_report(&export, &request.destination, cancellation)
        .map_err(|error| match error {
            ReportExportPortError::Cancelled => ApplicationError::ReportExportCancelled,
            ReportExportPortError::Failure(message) => ApplicationError::ReportExport(message),
        })
}

fn resolve_definition(
    training_port: &dyn TrainingSessionDiscoveryPort,
    route_port: &dyn TrainingSessionRoutePort,
    provenance_port: &dyn TrainingSessionProvenancePort,
    definition: ReportDefinition,
    cancellation: Option<&ReportExportCancellation>,
) -> Result<ResolvedSessionReport, ApplicationError> {
    ensure_resolution_active(cancellation)?;
    let session_ref = report_session_ref(&definition)?.to_owned();
    let saved_resolution = resolve_exact_session(
        training_port,
        &session_ref,
        Some(definition.source_snapshot_ref().to_owned()),
    );
    let (status, selection) = match saved_resolution {
        Ok(selection) => (ReportResolutionStatus::Current, selection),
        Err(ApplicationError::ReportSourceChanged) => (
            ReportResolutionStatus::Stale,
            resolve_exact_session(training_port, &session_ref, None)?,
        ),
        Err(error) => return Err(error),
    };
    let persisted = selection
        .sessions
        .into_iter()
        .next()
        .ok_or(ApplicationError::ReportEvidenceUnavailable)?;
    let provenance = query_training_session_provenance(
        provenance_port,
        TrainingSessionProvenanceQuery {
            session_ref,
            snapshot_ref: Some(selection.snapshot_ref.clone()),
            offset: 0,
            limit: 1,
        },
    )
    .map_err(map_provenance_error)?
    .current;
    let include_physiological_context = report_includes_physiology(&definition)?;
    let routes = resolve_report_routes(
        route_port,
        &definition,
        &selection.snapshot_ref,
        cancellation,
    )?;
    let physiological_context_available =
        persisted.average_heart_rate_bpm.is_some() || persisted.maximum_heart_rate_bpm.is_some();
    let sensitive_contents = physiological_context_available
        .then_some(ReportSensitiveContent {
            kind: ReportSensitiveContentKind::HeartRate,
            block_ref: None,
            included: include_physiological_context,
            endpoint_redaction_meters: None,
        })
        .into_iter()
        .chain(routes.iter().map(|route| ReportSensitiveContent {
            kind: ReportSensitiveContentKind::PreciseLocation,
            block_ref: Some(route.block_ref.clone()),
            included: true,
            endpoint_redaction_meters: Some(route.endpoint_redaction_meters),
        }))
        .collect();
    let limitations = report_limitations(&persisted);
    let mut session = session_evidence(persisted);
    if !include_physiological_context {
        session.average_heart_rate_bpm = None;
        session.maximum_heart_rate_bpm = None;
    }
    Ok(ResolvedSessionReport {
        definition,
        resolved_snapshot_ref: selection.snapshot_ref,
        status,
        session,
        routes,
        provenance,
        sensitive_contents,
        limitations,
    })
}

fn resolve_exact_session(
    port: &dyn TrainingSessionDiscoveryPort,
    session_ref: &str,
    snapshot_ref: Option<String>,
) -> Result<TrainingSessionSelection, ApplicationError> {
    query_training_session_selection(
        port,
        TrainingSessionSelectionRequest {
            session_refs: vec![session_ref.to_owned()],
            snapshot_ref,
        },
    )
    .map_err(|error| match error {
        ApplicationError::TrainingSessionSearchChanged => ApplicationError::ReportSourceChanged,
        ApplicationError::InvalidTrainingSessionSearch(message) => {
            ApplicationError::InvalidReportDefinition(message.to_owned())
        }
        ApplicationError::TrainingSessionSearch(_) => ApplicationError::ReportEvidenceUnavailable,
        other => ApplicationError::ReportDefinitionQuery(other.to_string()),
    })
}

fn materialize_blocks(
    report_port: &dyn ReportDefinitionPort,
    session_ref: &str,
    drafts: Vec<SessionReportBlockDraft>,
    existing_kinds: Option<&BTreeMap<String, &'static str>>,
) -> Result<Vec<ReportBlock>, ApplicationError> {
    let mut supplied_refs = BTreeSet::new();
    drafts
        .into_iter()
        .map(|draft| {
            let kind = draft_kind(&draft.content);
            let block_ref = match draft.block_ref {
                Some(block_ref) => {
                    let Some(existing_kinds) = existing_kinds else {
                        return Err(ApplicationError::InvalidReportDefinition(
                            "new report block supplied an existing identity".to_owned(),
                        ));
                    };
                    if existing_kinds.get(&block_ref).copied() != Some(kind) {
                        return Err(ApplicationError::InvalidReportDefinition(
                            "report block identity changed kind or is not owned by the report"
                                .to_owned(),
                        ));
                    }
                    if !supplied_refs.insert(block_ref.clone()) {
                        return Err(ApplicationError::InvalidReportDefinition(
                            "report block identity is duplicated".to_owned(),
                        ));
                    }
                    block_ref
                }
                None => report_port
                    .new_report_block_ref()
                    .map_err(map_definition_query_error)?,
            };
            match draft.content {
                SessionReportBlockDraftContent::SessionEvidence {
                    include_physiological_context,
                } => ReportBlock::session_evidence(
                    block_ref,
                    session_ref,
                    include_physiological_context,
                ),
                SessionReportBlockDraftContent::Route {
                    route_ref,
                    endpoint_redaction_meters,
                } => {
                    ReportBlock::route(block_ref, session_ref, route_ref, endpoint_redaction_meters)
                }
                SessionReportBlockDraftContent::Narrative { body } => {
                    ReportBlock::narrative(block_ref, &body)
                }
            }
            .map_err(invalid_definition)
        })
        .collect()
}

fn draft_kind(content: &SessionReportBlockDraftContent) -> &'static str {
    match content {
        SessionReportBlockDraftContent::SessionEvidence { .. } => "session-evidence",
        SessionReportBlockDraftContent::Route { .. } => "route",
        SessionReportBlockDraftContent::Narrative { .. } => "narrative",
    }
}

fn definition_block_kind(content: &ReportBlockContent) -> &'static str {
    match content {
        ReportBlockContent::SessionEvidence { .. } => "session-evidence",
        ReportBlockContent::Route { .. } => "route",
        ReportBlockContent::Narrative { .. } => "narrative",
    }
}

fn validate_route_drafts(
    route_port: &dyn TrainingSessionRoutePort,
    session_ref: &str,
    snapshot_ref: &str,
    drafts: &[SessionReportBlockDraft],
) -> Result<(), ApplicationError> {
    let requested = drafts
        .iter()
        .filter_map(|draft| match &draft.content {
            SessionReportBlockDraftContent::Route { route_ref, .. } => Some(route_ref.as_str()),
            SessionReportBlockDraftContent::SessionEvidence { .. }
            | SessionReportBlockDraftContent::Narrative { .. } => None,
        })
        .collect::<Vec<_>>();
    if requested.is_empty() {
        return Ok(());
    }
    let available = query_report_route_overviews(route_port, session_ref, snapshot_ref)?;
    if requested
        .iter()
        .any(|route_ref| !available.contains_key(*route_ref))
    {
        return Err(ApplicationError::ReportEvidenceUnavailable);
    }
    Ok(())
}

fn resolve_report_routes(
    route_port: &dyn TrainingSessionRoutePort,
    definition: &ReportDefinition,
    snapshot_ref: &str,
    cancellation: Option<&ReportExportCancellation>,
) -> Result<Vec<ReportRouteEvidence>, ApplicationError> {
    let route_blocks = definition
        .blocks()
        .iter()
        .filter_map(|block| match block.content() {
            ReportBlockContent::Route {
                route_ref,
                endpoint_redaction_meters,
                ..
            } => Some((
                block.block_ref(),
                route_ref.as_str(),
                *endpoint_redaction_meters,
            )),
            ReportBlockContent::SessionEvidence { .. } | ReportBlockContent::Narrative { .. } => {
                None
            }
        })
        .collect::<Vec<_>>();
    if route_blocks.is_empty() {
        return Ok(Vec::new());
    }
    let session_ref = report_origin_session_ref(definition);
    let overviews = query_report_route_overviews(route_port, session_ref, snapshot_ref)?;
    route_blocks
        .into_iter()
        .map(|(block_ref, route_ref, endpoint_redaction_meters)| {
            ensure_resolution_active(cancellation)?;
            let overview = overviews
                .get(route_ref)
                .ok_or(ApplicationError::ReportEvidenceUnavailable)?;
            resolve_report_route(
                route_port,
                session_ref,
                snapshot_ref,
                block_ref,
                overview,
                endpoint_redaction_meters,
                cancellation,
            )
        })
        .collect()
}

fn query_report_route_overviews(
    route_port: &dyn TrainingSessionRoutePort,
    session_ref: &str,
    snapshot_ref: &str,
) -> Result<BTreeMap<String, TrainingRouteOverview>, ApplicationError> {
    let result = query_training_session_routes(
        route_port,
        TrainingSessionRouteQuery {
            session_ref: session_ref.to_owned(),
            snapshot_ref: Some(snapshot_ref.to_owned()),
            max_visual_points: MAX_REPORT_ROUTE_VISUAL_POINTS,
        },
    )
    .map_err(map_route_error)?;
    let mut overviews = BTreeMap::new();
    for exercise in result
        .routes
        .and_then(|routes| routes.exercises)
        .unwrap_or_default()
    {
        let Some(routes) = exercise.routes else {
            continue;
        };
        for route in [routes.primary, routes.transition].into_iter().flatten() {
            overviews.insert(route.route_ref.clone(), route);
        }
    }
    Ok(overviews)
}

fn resolve_report_route(
    route_port: &dyn TrainingSessionRoutePort,
    session_ref: &str,
    snapshot_ref: &str,
    block_ref: &str,
    overview: &TrainingRouteOverview,
    endpoint_redaction_meters: u32,
    cancellation: Option<&ReportExportCancellation>,
) -> Result<ReportRouteEvidence, ApplicationError> {
    let visual_points = redacted_route_visual_points(
        route_port,
        session_ref,
        snapshot_ref,
        overview,
        endpoint_redaction_meters,
        cancellation,
    )?;
    Ok(ReportRouteEvidence {
        block_ref: block_ref.to_owned(),
        route_ref: overview.route_ref.clone(),
        kind: overview.kind,
        started_at_local: overview.started_at_local.clone(),
        source_point_count: overview.point_count,
        visual_points,
        endpoint_redaction_meters,
        included: true,
    })
}

fn redacted_route_visual_points(
    route_port: &dyn TrainingSessionRoutePort,
    session_ref: &str,
    snapshot_ref: &str,
    overview: &TrainingRouteOverview,
    endpoint_redaction_meters: u32,
    cancellation: Option<&ReportExportCancellation>,
) -> Result<Vec<TrainingRoutePointView>, ApplicationError> {
    ensure_resolution_active(cancellation)?;
    if endpoint_redaction_meters == 0 || overview.point_count <= 1 {
        return Ok(overview.visual_points.clone());
    }
    let mut previous = None;
    let mut total_distance = 0.0;
    for_each_exact_route_point(
        route_port,
        session_ref,
        snapshot_ref,
        &overview.route_ref,
        cancellation,
        |point| {
            if let Some(previous) = &previous {
                total_distance += route_distance_meters(previous, point);
            }
            previous = Some(point.clone());
        },
    )?;
    let start = f64::from(endpoint_redaction_meters);
    let end = total_distance - start;
    if end <= start {
        return Ok(Vec::new());
    }
    let target_count = overview.point_count.min(MAX_REPORT_ROUTE_VISUAL_POINTS);
    let mut selected = Vec::with_capacity(target_count);
    let mut previous = None;
    let mut cumulative = 0.0;
    let mut target_index = 0;
    let mut last_visible = None;
    for_each_exact_route_point(
        route_port,
        session_ref,
        snapshot_ref,
        &overview.route_ref,
        cancellation,
        |point| {
            if let Some(previous) = &previous {
                cumulative += route_distance_meters(previous, point);
            }
            previous = Some(point.clone());
            if cumulative < start || cumulative > end {
                return;
            }
            last_visible = Some(point.clone());
            while target_index < target_count
                && cumulative >= route_target(start, end, target_count, target_index)
            {
                if selected
                    .last()
                    .is_none_or(|selected: &TrainingRoutePointView| {
                        selected.ordinal != point.ordinal
                    })
                {
                    selected.push(point.clone());
                }
                target_index += 1;
            }
        },
    )?;
    if let Some(last_visible) = last_visible {
        if selected
            .last()
            .is_none_or(|selected| selected.ordinal != last_visible.ordinal)
        {
            selected.push(last_visible);
        }
    }
    Ok(selected)
}

fn for_each_exact_route_point(
    route_port: &dyn TrainingSessionRoutePort,
    session_ref: &str,
    snapshot_ref: &str,
    route_ref: &str,
    cancellation: Option<&ReportExportCancellation>,
    mut consumer: impl FnMut(&TrainingRoutePointView),
) -> Result<(), ApplicationError> {
    let mut offset = 0;
    loop {
        ensure_resolution_active(cancellation)?;
        let page = query_training_route_points_for_processing(
            route_port,
            TrainingRoutePointsQuery {
                session_ref: session_ref.to_owned(),
                route_ref: route_ref.to_owned(),
                snapshot_ref: Some(snapshot_ref.to_owned()),
                offset,
                limit: MAX_PROCESSING_EXACT_POINTS,
            },
        )
        .map_err(map_route_error)?;
        ensure_resolution_active(cancellation)?;
        for point in &page.points {
            consumer(point);
        }
        let Some(next_offset) = page.next_offset else {
            return Ok(());
        };
        offset = next_offset;
    }
}

fn route_target(start: f64, end: f64, count: usize, index: usize) -> f64 {
    if count <= 1 {
        start
    } else {
        start + (end - start) * index as f64 / (count - 1) as f64
    }
}

fn route_distance_meters(from: &TrainingRoutePointView, through: &TrainingRoutePointView) -> f64 {
    let from_latitude = from.latitude_degrees.to_radians();
    let through_latitude = through.latitude_degrees.to_radians();
    let latitude_delta = through_latitude - from_latitude;
    let mut longitude_delta = (through.longitude_degrees - from.longitude_degrees).to_radians();
    if longitude_delta > PI {
        longitude_delta -= 2.0 * PI;
    } else if longitude_delta < -PI {
        longitude_delta += 2.0 * PI;
    }
    let haversine = (latitude_delta / 2.0).sin().powi(2)
        + from_latitude.cos() * through_latitude.cos() * (longitude_delta / 2.0).sin().powi(2);
    2.0 * EARTH_RADIUS_METERS * haversine.sqrt().asin()
}

fn authorize_export_routes(
    route_port: &dyn TrainingSessionRoutePort,
    definition: &ReportDefinition,
    snapshot_ref: &str,
    resolved_routes: Vec<ReportRouteEvidence>,
    choices: &[ReportRouteExportChoice],
    cancellation: &ReportExportCancellation,
) -> Result<Vec<ReportRouteEvidence>, ApplicationError> {
    ensure_resolution_active(Some(cancellation))?;
    if resolved_routes.len() != choices.len() {
        return Err(ApplicationError::InvalidReportDefinition(
            "export review does not cover every route block".to_owned(),
        ));
    }
    let mut choices_by_block = BTreeMap::new();
    for choice in choices {
        if choice.endpoint_redaction_meters > MAX_ROUTE_ENDPOINT_REDACTION_METERS
            || choices_by_block
                .insert(choice.block_ref.as_str(), choice)
                .is_some()
        {
            return Err(ApplicationError::InvalidReportDefinition(
                "export route review is invalid".to_owned(),
            ));
        }
    }
    let session_ref = report_origin_session_ref(definition);
    let overviews = if resolved_routes.iter().any(|route| {
        choices_by_block
            .get(route.block_ref.as_str())
            .is_some_and(|choice| {
                choice.include_geometry
                    && choice.endpoint_redaction_meters != route.endpoint_redaction_meters
            })
    }) {
        query_report_route_overviews(route_port, session_ref, snapshot_ref)?
    } else {
        BTreeMap::new()
    };
    resolved_routes
        .into_iter()
        .map(|route| {
            ensure_resolution_active(Some(cancellation))?;
            let choice = choices_by_block
                .get(route.block_ref.as_str())
                .ok_or_else(|| {
                    ApplicationError::InvalidReportDefinition(
                        "export route review references the wrong block".to_owned(),
                    )
                })?;
            if choice.endpoint_redaction_meters < route.endpoint_redaction_meters {
                return Err(ApplicationError::InvalidReportDefinition(
                    "export cannot reduce saved endpoint redaction".to_owned(),
                ));
            }
            if !choice.include_geometry {
                return Ok(ReportRouteEvidence {
                    visual_points: Vec::new(),
                    endpoint_redaction_meters: choice.endpoint_redaction_meters,
                    included: false,
                    ..route
                });
            }
            if choice.endpoint_redaction_meters == route.endpoint_redaction_meters {
                return Ok(route);
            }
            let overview = overviews
                .get(&route.route_ref)
                .ok_or(ApplicationError::ReportEvidenceUnavailable)?;
            resolve_report_route(
                route_port,
                session_ref,
                snapshot_ref,
                &route.block_ref,
                overview,
                choice.endpoint_redaction_meters,
                Some(cancellation),
            )
        })
        .collect()
}

fn ensure_resolution_active(
    cancellation: Option<&ReportExportCancellation>,
) -> Result<(), ApplicationError> {
    if cancellation.is_some_and(ReportExportCancellation::is_cancelled) {
        Err(ApplicationError::ReportExportCancelled)
    } else {
        Ok(())
    }
}

fn report_session_ref(definition: &ReportDefinition) -> Result<&str, ApplicationError> {
    definition
        .blocks()
        .iter()
        .find_map(|block| match block.content() {
            ReportBlockContent::SessionEvidence { session_ref, .. } => Some(session_ref.as_str()),
            ReportBlockContent::Route { .. } | ReportBlockContent::Narrative { .. } => None,
        })
        .ok_or_else(|| {
            ApplicationError::InvalidReportDefinition("report session block is missing".to_owned())
        })
}

fn report_includes_physiology(definition: &ReportDefinition) -> Result<bool, ApplicationError> {
    definition
        .blocks()
        .iter()
        .find_map(|block| match block.content() {
            ReportBlockContent::SessionEvidence {
                include_physiological_context,
                ..
            } => Some(*include_physiological_context),
            ReportBlockContent::Route { .. } | ReportBlockContent::Narrative { .. } => None,
        })
        .ok_or_else(|| {
            ApplicationError::InvalidReportDefinition("report session block is missing".to_owned())
        })
}

fn report_origin_session_ref(definition: &ReportDefinition) -> &str {
    match definition.origin() {
        ReportOrigin::Session { session_ref } => session_ref,
    }
}

fn report_limitations(session: &TrainingSessionSearchItem) -> Vec<ReportLimitation> {
    let mut limitations = Vec::new();
    if session.distance_meters.is_none() {
        limitations.push(ReportLimitation::DistanceUnavailable);
    }
    if session.energy_kilocalories.is_none() {
        limitations.push(ReportLimitation::EnergyUnavailable);
    }
    if session.average_heart_rate_bpm.is_none() && session.maximum_heart_rate_bpm.is_none() {
        limitations.push(ReportLimitation::HeartRateUnavailable);
    }
    match session.sport.state {
        TrainingSportState::Unknown => limitations.push(ReportLimitation::SportUnclassified),
        TrainingSportState::Unavailable => limitations.push(ReportLimitation::SportUnavailable),
        TrainingSportState::Classified => {}
    }
    limitations
}

fn session_evidence(session: TrainingSessionSearchItem) -> ReportSessionEvidence {
    ReportSessionEvidence {
        session_ref: session.session_ref,
        source_index: session.source_index,
        started_at_local: session.started_at_local,
        stopped_at_local: session.stopped_at_local,
        utc_offset_minutes: session.utc_offset_minutes,
        duration_milliseconds: session.duration_milliseconds,
        distance_meters: session.distance_meters,
        energy_kilocalories: session.energy_kilocalories,
        average_heart_rate_bpm: session.average_heart_rate_bpm,
        maximum_heart_rate_bpm: session.maximum_heart_rate_bpm,
        exercise_count: session.exercise_count,
        sport: session.sport,
    }
}

fn map_provenance_error(error: ApplicationError) -> ApplicationError {
    match error {
        ApplicationError::TrainingSessionDetailChanged => ApplicationError::ReportSourceChanged,
        ApplicationError::TrainingSessionDetail(_) => ApplicationError::ReportEvidenceUnavailable,
        other => ApplicationError::ReportDefinitionQuery(other.to_string()),
    }
}

fn map_route_error(error: ApplicationError) -> ApplicationError {
    match error {
        ApplicationError::TrainingSessionDetailChanged => ApplicationError::ReportSourceChanged,
        ApplicationError::TrainingSessionDetail(_) => ApplicationError::ReportEvidenceUnavailable,
        ApplicationError::InvalidTrainingSessionDetail(message) => {
            ApplicationError::InvalidReportDefinition(message.to_owned())
        }
        other => ApplicationError::ReportDefinitionQuery(other.to_string()),
    }
}

fn map_definition_query_error(error: ReportDefinitionPortError) -> ApplicationError {
    match error {
        ReportDefinitionPortError::NotFound => ApplicationError::ReportNotFound,
        ReportDefinitionPortError::Conflict => ApplicationError::ReportDefinitionConflict,
        ReportDefinitionPortError::Failure(message) => {
            ApplicationError::ReportDefinitionQuery(message)
        }
    }
}

fn map_definition_update_error(error: ReportDefinitionPortError) -> ApplicationError {
    match error {
        ReportDefinitionPortError::NotFound => ApplicationError::ReportNotFound,
        ReportDefinitionPortError::Conflict => ApplicationError::ReportDefinitionConflict,
        ReportDefinitionPortError::Failure(message) => {
            ApplicationError::ReportDefinitionUpdate(message)
        }
    }
}

fn invalid_definition(error: impl ToString) -> ApplicationError {
    ApplicationError::InvalidReportDefinition(error.to_string())
}

fn valid_ref(value: &str, prefix: &str) -> bool {
    value.strip_prefix(prefix).is_some_and(|suffix| {
        suffix.len() == IDENTIFIER_HEX_CHARACTERS
            && suffix
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    })
}
