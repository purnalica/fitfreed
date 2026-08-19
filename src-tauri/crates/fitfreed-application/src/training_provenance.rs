use chrono::DateTime;

use crate::{training_detail::valid_ref, ApplicationError};

const SNAPSHOT_PREFIX: &str = "training-snapshot-";
const SESSION_PREFIX: &str = "session-";
const MAX_OFFSET: usize = 999_999;
const MAX_PAGE_SIZE: usize = 25;
const MAX_EVENT_COUNT: usize = 1_000_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSessionProvenanceQuery {
    pub session_ref: String,
    pub snapshot_ref: Option<String>,
    pub offset: usize,
    pub limit: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSourceProviderView(String);

impl TrainingSourceProviderView {
    pub fn restore(code: String) -> Option<Self> {
        valid_provider_code(&code).then_some(Self(code))
    }

    pub fn code(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingProvenanceDecisionView {
    Create,
    Equivalent,
    Enrich,
    Amend,
    Preserve,
    Conflict,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingProvenanceCurrentView {
    pub provider: TrainingSourceProviderView,
    pub source_modified_at_utc: String,
    pub source_adapter_version: String,
    pub mapping_version: String,
    pub contributing_event_count: usize,
    pub non_contributing_event_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingProvenanceEventView {
    pub ordinal: usize,
    pub observed_at_utc: String,
    pub source_modified_at_utc: String,
    pub provider: TrainingSourceProviderView,
    pub source_adapter_version: String,
    pub mapping_version: String,
    pub decision: TrainingProvenanceDecisionView,
    pub contributes_to_visible_state: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PersistedTrainingSessionProvenance {
    pub snapshot_ref: String,
    pub session_ref: String,
    pub total_event_count: usize,
    pub current: TrainingProvenanceCurrentView,
    pub events: Vec<TrainingProvenanceEventView>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSessionProvenanceResult {
    pub snapshot_ref: String,
    pub session_ref: String,
    pub total_event_count: usize,
    pub offset: usize,
    pub limit: usize,
    pub next_offset: Option<usize>,
    pub current: TrainingProvenanceCurrentView,
    pub events: Vec<TrainingProvenanceEventView>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrainingSessionProvenancePortError {
    SnapshotChanged,
    NotFound,
    Failure(String),
}

pub trait TrainingSessionProvenancePort {
    fn query_training_session_provenance(
        &self,
        query: &TrainingSessionProvenanceQuery,
    ) -> Result<PersistedTrainingSessionProvenance, TrainingSessionProvenancePortError>;
}

pub fn query_training_session_provenance(
    port: &dyn TrainingSessionProvenancePort,
    query: TrainingSessionProvenanceQuery,
) -> Result<TrainingSessionProvenanceResult, ApplicationError> {
    validate_query(&query)?;
    let persisted = port
        .query_training_session_provenance(&query)
        .map_err(map_port_error)?;
    validate_persisted(&persisted, &query)?;
    let returned_through = query
        .offset
        .checked_add(persisted.events.len())
        .ok_or_else(|| invalid_error("provenance page overflows"))?;
    let next_offset = (returned_through < persisted.total_event_count).then_some(returned_through);
    Ok(TrainingSessionProvenanceResult {
        snapshot_ref: persisted.snapshot_ref,
        session_ref: persisted.session_ref,
        total_event_count: persisted.total_event_count,
        offset: query.offset,
        limit: query.limit,
        next_offset,
        current: persisted.current,
        events: persisted.events,
    })
}

fn validate_query(query: &TrainingSessionProvenanceQuery) -> Result<(), ApplicationError> {
    if !valid_ref(&query.session_ref, SESSION_PREFIX)
        || query
            .snapshot_ref
            .as_deref()
            .is_some_and(|value| !valid_ref(value, SNAPSHOT_PREFIX))
        || query.offset > MAX_OFFSET
        || !(1..=MAX_PAGE_SIZE).contains(&query.limit)
    {
        return invalid("provenance request is invalid");
    }
    Ok(())
}

fn validate_persisted(
    persisted: &PersistedTrainingSessionProvenance,
    query: &TrainingSessionProvenanceQuery,
) -> Result<(), ApplicationError> {
    if persisted.session_ref != query.session_ref
        || !valid_ref(&persisted.snapshot_ref, SNAPSHOT_PREFIX)
        || query
            .snapshot_ref
            .as_ref()
            .is_some_and(|expected| expected != &persisted.snapshot_ref)
    {
        return Err(ApplicationError::TrainingSessionDetailChanged);
    }
    if persisted.total_event_count == 0
        || persisted.total_event_count > MAX_EVENT_COUNT
        || query.offset > persisted.total_event_count
        || persisted
            .current
            .contributing_event_count
            .checked_add(persisted.current.non_contributing_event_count)
            != Some(persisted.total_event_count)
        || persisted.current.contributing_event_count == 0
        || !valid_current(&persisted.current)
    {
        return invalid("provenance summary is invalid");
    }
    let remaining = persisted.total_event_count - query.offset;
    if persisted.events.len() != remaining.min(query.limit) {
        return invalid("provenance page size is inconsistent");
    }
    for (index, event) in persisted.events.iter().enumerate() {
        if event.ordinal != query.offset + index
            || event.provider != persisted.current.provider
            || !valid_event(event)
        {
            return invalid("provenance event is invalid");
        }
    }
    let contributing_events = persisted
        .events
        .iter()
        .filter(|event| event.contributes_to_visible_state)
        .collect::<Vec<_>>();
    if contributing_events.len() == persisted.current.contributing_event_count {
        let latest = contributing_events
            .last()
            .ok_or_else(|| invalid_error("current provenance evidence is missing"))?;
        if latest.provider != persisted.current.provider
            || latest.source_modified_at_utc != persisted.current.source_modified_at_utc
            || latest.source_adapter_version != persisted.current.source_adapter_version
            || latest.mapping_version != persisted.current.mapping_version
        {
            return invalid("current provenance evidence is inconsistent");
        }
    }
    Ok(())
}

fn valid_current(current: &TrainingProvenanceCurrentView) -> bool {
    valid_utc(&current.source_modified_at_utc)
        && valid_version(&current.source_adapter_version)
        && valid_version(&current.mapping_version)
}

fn valid_provider_code(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value.is_ascii()
        && value.bytes().enumerate().all(|(index, byte)| {
            byte.is_ascii_lowercase()
                || byte.is_ascii_digit()
                || (index > 0 && matches!(byte, b'-' | b'.'))
        })
}

fn valid_event(event: &TrainingProvenanceEventView) -> bool {
    let expected_contribution = !matches!(
        event.decision,
        TrainingProvenanceDecisionView::Preserve | TrainingProvenanceDecisionView::Conflict
    );
    event.contributes_to_visible_state == expected_contribution
        && valid_utc(&event.observed_at_utc)
        && valid_utc(&event.source_modified_at_utc)
        && valid_version(&event.source_adapter_version)
        && valid_version(&event.mapping_version)
}

fn valid_utc(value: &str) -> bool {
    DateTime::parse_from_rfc3339(value).is_ok_and(|parsed| parsed.offset().local_minus_utc() == 0)
}

fn valid_version(value: &str) -> bool {
    if value.len() > 128 || !value.is_ascii() {
        return false;
    }
    let Some((name, version)) = value.split_once('@') else {
        return false;
    };
    !name.is_empty()
        && name.bytes().enumerate().all(|(index, byte)| {
            byte.is_ascii_lowercase()
                || byte.is_ascii_digit()
                || (index > 0 && matches!(byte, b'-' | b'.'))
        })
        && !version.is_empty()
        && version.bytes().all(|byte| byte.is_ascii_digit())
        && !version.starts_with('0')
}

fn map_port_error(error: TrainingSessionProvenancePortError) -> ApplicationError {
    match error {
        TrainingSessionProvenancePortError::SnapshotChanged => {
            ApplicationError::TrainingSessionDetailChanged
        }
        TrainingSessionProvenancePortError::NotFound => {
            ApplicationError::TrainingSessionDetail("provenance evidence was not found".to_owned())
        }
        TrainingSessionProvenancePortError::Failure(message) => {
            ApplicationError::TrainingSessionDetail(message)
        }
    }
}

fn invalid<T>(message: &'static str) -> Result<T, ApplicationError> {
    Err(invalid_error(message))
}

fn invalid_error(message: &'static str) -> ApplicationError {
    ApplicationError::InvalidTrainingSessionDetail(message)
}
