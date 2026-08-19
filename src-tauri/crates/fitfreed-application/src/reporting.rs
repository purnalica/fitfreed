use std::{
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
};

use fitfreed_domain::{
    author_session_report, ReportBlock, ReportBlockContent, ReportDefinition, ReportLocale,
};

use crate::{
    query_training_session_provenance, query_training_session_selection, ApplicationError,
    TrainingProvenanceCurrentView, TrainingSessionDiscoveryPort, TrainingSessionProvenancePort,
    TrainingSessionProvenanceQuery, TrainingSessionSearchItem, TrainingSessionSelection,
    TrainingSessionSelectionRequest, TrainingSessionSport, TrainingSportState,
};

const REPORT_PREFIX: &str = "report-";
const IDENTIFIER_HEX_CHARACTERS: usize = 64;
const MAX_REPORTS: usize = 1_000;

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
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReportSensitiveContent {
    pub kind: ReportSensitiveContentKind,
    pub included: bool,
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
pub struct ResolvedSessionReport {
    pub definition: ReportDefinition,
    pub resolved_snapshot_ref: String,
    pub status: ReportResolutionStatus,
    pub session: ReportSessionEvidence,
    pub provenance: TrainingProvenanceCurrentView,
    pub sensitive_contents: Vec<ReportSensitiveContent>,
    pub limitations: Vec<ReportLimitation>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct AuthorizedSessionReportExport {
    pub definition: ReportDefinition,
    pub resolved_snapshot_ref: String,
    pub session: ReportSessionEvidence,
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
    pub destination: PathBuf,
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
    provenance_port: &dyn TrainingSessionProvenancePort,
    report_ref: &str,
) -> Result<ResolvedSessionReport, ApplicationError> {
    let definition = load_report_definition(report_port, report_ref)?;
    resolve_definition(training_port, provenance_port, definition)
}

#[allow(clippy::too_many_arguments)]
pub fn export_session_report(
    report_port: &dyn ReportDefinitionPort,
    training_port: &dyn TrainingSessionDiscoveryPort,
    provenance_port: &dyn TrainingSessionProvenancePort,
    export_port: &dyn ReportExportPort,
    request: SessionReportExportRequest,
    cancellation: &ReportExportCancellation,
) -> Result<ReportExportReceipt, ApplicationError> {
    if cancellation.is_cancelled() {
        return Err(ApplicationError::ReportExportCancelled);
    }
    let resolved = resolve_session_report(
        report_port,
        training_port,
        provenance_port,
        &request.report_ref,
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
    let export = AuthorizedSessionReportExport {
        definition: resolved.definition,
        resolved_snapshot_ref: resolved.resolved_snapshot_ref,
        session,
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
    provenance_port: &dyn TrainingSessionProvenancePort,
    definition: ReportDefinition,
) -> Result<ResolvedSessionReport, ApplicationError> {
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
    let physiological_context_available =
        persisted.average_heart_rate_bpm.is_some() || persisted.maximum_heart_rate_bpm.is_some();
    let sensitive_contents = physiological_context_available
        .then_some(ReportSensitiveContent {
            kind: ReportSensitiveContentKind::HeartRate,
            included: include_physiological_context,
        })
        .into_iter()
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

fn report_session_ref(definition: &ReportDefinition) -> Result<&str, ApplicationError> {
    match definition.blocks()[0].content() {
        ReportBlockContent::SessionEvidence { session_ref, .. } => Ok(session_ref),
        ReportBlockContent::Narrative { .. } => Err(ApplicationError::InvalidReportDefinition(
            "report session block is missing".to_owned(),
        )),
    }
}

fn report_includes_physiology(definition: &ReportDefinition) -> Result<bool, ApplicationError> {
    match definition.blocks()[0].content() {
        ReportBlockContent::SessionEvidence {
            include_physiological_context,
            ..
        } => Ok(*include_physiological_context),
        ReportBlockContent::Narrative { .. } => Err(ApplicationError::InvalidReportDefinition(
            "report session block is missing".to_owned(),
        )),
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
