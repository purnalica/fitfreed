use std::collections::BTreeSet;

use chrono::{DateTime, NaiveDate, NaiveDateTime};

use crate::{
    ApplicationError, TrainingDateRange, TrainingSportClassification, TrainingSportRecognition,
    TrainingSportState,
};

const MAX_PAGE_SIZE: usize = 100;
const MAX_SPORT_FILTERS: usize = 64;
const MAX_TEXT_SCALARS: usize = 80;
const MAX_SELECTION_SIZE: usize = 4;
const MAX_RESOLVED_SESSIONS: usize = MAX_SELECTION_SIZE + 1;
const SNAPSHOT_PREFIX: &str = "training-snapshot-";
const SESSION_PREFIX: &str = "session-";
const SPORT_PREFIX: &str = "sport-";
const TRAINING_WORKSPACE_PAGE_SIZE: usize = 25;
const TRAINING_WORKSPACE_VERSION: u32 = 2;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum TrainingMeasurementFilter {
    Distance,
    Energy,
    HeartRate,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingSessionSort {
    StartedDescending,
    StartedAscending,
    DurationDescending,
    DistanceDescending,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingDiscoveryView {
    Chronology,
    Calendar,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingDiscoveryWorkspace {
    pub version: u32,
    pub snapshot_ref: String,
    pub from: Option<String>,
    pub through: Option<String>,
    pub sport_refs: Vec<String>,
    pub required_measurements: Vec<TrainingMeasurementFilter>,
    pub text: Option<String>,
    pub sort: TrainingSessionSort,
    pub offset: usize,
    pub limit: usize,
    pub view: TrainingDiscoveryView,
    pub calendar_month: Option<String>,
    pub calendar_day: Option<String>,
    pub selected_session_refs: Vec<String>,
    pub open_session_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSessionSearchRequest {
    pub from: Option<String>,
    pub through: Option<String>,
    pub sport_refs: Vec<String>,
    pub required_measurements: Vec<TrainingMeasurementFilter>,
    pub text: Option<String>,
    pub sort: TrainingSessionSort,
    pub offset: usize,
    pub limit: usize,
    pub snapshot_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSessionCalendarRequest {
    pub month: String,
    pub from: Option<String>,
    pub through: Option<String>,
    pub sport_refs: Vec<String>,
    pub required_measurements: Vec<TrainingMeasurementFilter>,
    pub text: Option<String>,
    pub snapshot_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSessionSelectionRequest {
    pub session_refs: Vec<String>,
    pub snapshot_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSessionSport {
    pub sport_ref: Option<String>,
    pub state: TrainingSportState,
    pub classification: Option<TrainingSportClassification>,
    pub recognition: Option<TrainingSportRecognition>,
    pub recognition_candidate_count: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSessionSearchItem {
    pub session_ref: String,
    pub sport_filter_ref: String,
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
pub struct TrainingSessionSearchSummary {
    pub source_index: usize,
    pub training_days: usize,
    pub session_count: usize,
    pub total_duration_milliseconds: i128,
    pub distance_session_count: usize,
    pub total_distance_meters: Option<f64>,
    pub energy_session_count: usize,
    pub total_energy_kilocalories: Option<i128>,
    pub heart_rate_session_count: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedTrainingSessionSearchPage {
    pub available_range: Option<TrainingDateRange>,
    pub snapshot_ref: String,
    pub total_count: usize,
    pub summaries: Vec<TrainingSessionSearchSummary>,
    pub sessions: Vec<TrainingSessionSearchItem>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSessionSearchPage {
    pub available_range: Option<TrainingDateRange>,
    pub snapshot_ref: String,
    pub total_count: usize,
    pub offset: usize,
    pub limit: usize,
    pub next_offset: Option<usize>,
    pub summaries: Vec<TrainingSessionSearchSummary>,
    pub sessions: Vec<TrainingSessionSearchItem>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSessionCalendarDay {
    pub local_date: String,
    pub source_index: usize,
    pub session_count: usize,
    pub total_duration_milliseconds: i128,
    pub distance_session_count: usize,
    pub total_distance_meters: Option<f64>,
    pub heart_rate_session_count: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedTrainingSessionCalendar {
    pub available_range: Option<TrainingDateRange>,
    pub snapshot_ref: String,
    pub days: Vec<TrainingSessionCalendarDay>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSessionCalendar {
    pub available_range: Option<TrainingDateRange>,
    pub snapshot_ref: String,
    pub month: String,
    pub days: Vec<TrainingSessionCalendarDay>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PersistedTrainingSessionSelection {
    pub snapshot_ref: String,
    pub sessions: Vec<TrainingSessionSearchItem>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSessionSelection {
    pub snapshot_ref: String,
    pub sessions: Vec<TrainingSessionSearchItem>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrainingSessionDiscoveryPortError {
    SnapshotChanged,
    UnknownSportReference,
    Failure(String),
}

pub trait TrainingSessionDiscoveryPort {
    fn query_training_sessions(
        &self,
        request: &TrainingSessionSearchRequest,
    ) -> Result<PersistedTrainingSessionSearchPage, TrainingSessionDiscoveryPortError>;

    fn query_training_calendar(
        &self,
        request: &TrainingSessionCalendarRequest,
    ) -> Result<PersistedTrainingSessionCalendar, TrainingSessionDiscoveryPortError>;

    fn query_training_session_selection(
        &self,
        request: &TrainingSessionSelectionRequest,
    ) -> Result<PersistedTrainingSessionSelection, TrainingSessionDiscoveryPortError>;
}

pub trait TrainingDiscoveryWorkspacePort {
    fn load_training_discovery_workspace(
        &self,
    ) -> Result<Option<TrainingDiscoveryWorkspace>, String>;
    fn save_training_discovery_workspace(
        &self,
        workspace: &TrainingDiscoveryWorkspace,
    ) -> Result<(), String>;
    fn clear_training_discovery_workspace(&self) -> Result<(), String>;
}

pub fn load_training_discovery_workspace(
    port: &dyn TrainingDiscoveryWorkspacePort,
) -> Result<Option<TrainingDiscoveryWorkspace>, ApplicationError> {
    let workspace = port
        .load_training_discovery_workspace()
        .map_err(ApplicationError::TrainingDiscoveryWorkspaceQuery)?;
    workspace.map(validate_workspace).transpose()
}

pub fn save_training_discovery_workspace(
    port: &dyn TrainingDiscoveryWorkspacePort,
    workspace: TrainingDiscoveryWorkspace,
) -> Result<TrainingDiscoveryWorkspace, ApplicationError> {
    let workspace = validate_workspace(workspace)?;
    port.save_training_discovery_workspace(&workspace)
        .map_err(ApplicationError::TrainingDiscoveryWorkspaceUpdate)?;
    Ok(workspace)
}

pub fn clear_training_discovery_workspace(
    port: &dyn TrainingDiscoveryWorkspacePort,
) -> Result<(), ApplicationError> {
    port.clear_training_discovery_workspace()
        .map_err(ApplicationError::TrainingDiscoveryWorkspaceUpdate)
}

pub fn query_training_sessions(
    port: &dyn TrainingSessionDiscoveryPort,
    request: TrainingSessionSearchRequest,
) -> Result<TrainingSessionSearchPage, ApplicationError> {
    validate_request(&request)?;
    let persisted = port
        .query_training_sessions(&request)
        .map_err(map_port_error)?;
    validate_page(&request, &persisted)?;
    let consumed = request.offset.checked_add(persisted.sessions.len()).ok_or(
        ApplicationError::TrainingSessionSearch(
            "training-session page offset overflowed".to_owned(),
        ),
    )?;
    let next_offset = (consumed < persisted.total_count).then_some(consumed);
    Ok(TrainingSessionSearchPage {
        available_range: persisted.available_range,
        snapshot_ref: persisted.snapshot_ref,
        total_count: persisted.total_count,
        offset: request.offset,
        limit: request.limit,
        next_offset,
        summaries: persisted.summaries,
        sessions: persisted.sessions,
    })
}

pub fn query_training_session_calendar(
    port: &dyn TrainingSessionDiscoveryPort,
    request: TrainingSessionCalendarRequest,
) -> Result<TrainingSessionCalendar, ApplicationError> {
    validate_month(&request.month)?;
    validate_date_bounds(request.from.as_deref(), request.through.as_deref())?;
    validate_filters(
        &request.sport_refs,
        &request.required_measurements,
        request.text.as_deref(),
        request.snapshot_ref.as_deref(),
    )?;
    let persisted = port
        .query_training_calendar(&request)
        .map_err(map_port_error)?;
    validate_calendar(&request, &persisted)?;
    Ok(TrainingSessionCalendar {
        available_range: persisted.available_range,
        snapshot_ref: persisted.snapshot_ref,
        month: request.month,
        days: persisted.days,
    })
}

pub fn query_training_session_selection(
    port: &dyn TrainingSessionDiscoveryPort,
    request: TrainingSessionSelectionRequest,
) -> Result<TrainingSessionSelection, ApplicationError> {
    if request.session_refs.is_empty() || request.session_refs.len() > MAX_RESOLVED_SESSIONS {
        return invalid("session resolution must contain between one and five sessions");
    }
    let mut requested_refs = BTreeSet::new();
    if request.session_refs.iter().any(|session_ref| {
        !valid_opaque_ref(session_ref, SESSION_PREFIX)
            || !requested_refs.insert(session_ref.as_str())
    }) {
        return invalid("session selection references are invalid or duplicated");
    }
    if request
        .snapshot_ref
        .as_deref()
        .is_some_and(|snapshot| !valid_opaque_ref(snapshot, SNAPSHOT_PREFIX))
    {
        return invalid("snapshot reference is invalid");
    }
    let persisted = port
        .query_training_session_selection(&request)
        .map_err(map_port_error)?;
    if !valid_opaque_ref(&persisted.snapshot_ref, SNAPSHOT_PREFIX) {
        return query_failure("training selection snapshot reference is invalid");
    }
    if request
        .snapshot_ref
        .as_ref()
        .is_some_and(|expected| expected != &persisted.snapshot_ref)
    {
        return Err(ApplicationError::TrainingSessionSearchChanged);
    }
    if persisted.sessions.len() != request.session_refs.len()
        || persisted
            .sessions
            .iter()
            .zip(&request.session_refs)
            .any(|(session, expected)| &session.session_ref != expected)
    {
        return query_failure("training selection is incomplete or reordered");
    }
    let summary_sources = persisted
        .sessions
        .iter()
        .map(|session| session.source_index)
        .collect::<BTreeSet<_>>();
    let mut session_refs = BTreeSet::new();
    let validation_request = TrainingSessionSearchRequest {
        from: None,
        through: None,
        sport_refs: Vec::new(),
        required_measurements: Vec::new(),
        text: None,
        sort: TrainingSessionSort::StartedDescending,
        offset: 0,
        limit: MAX_RESOLVED_SESSIONS,
        snapshot_ref: Some(persisted.snapshot_ref.clone()),
    };
    for session in &persisted.sessions {
        validate_session(
            &validation_request,
            session,
            &summary_sources,
            &mut session_refs,
        )?;
    }
    Ok(TrainingSessionSelection {
        snapshot_ref: persisted.snapshot_ref,
        sessions: persisted.sessions,
    })
}

fn validate_request(request: &TrainingSessionSearchRequest) -> Result<(), ApplicationError> {
    if request.limit == 0 || request.limit > MAX_PAGE_SIZE {
        return invalid("page size must be between 1 and 100");
    }
    validate_date_bounds(request.from.as_deref(), request.through.as_deref())?;
    validate_filters(
        &request.sport_refs,
        &request.required_measurements,
        request.text.as_deref(),
        request.snapshot_ref.as_deref(),
    )
}

fn validate_workspace(
    workspace: TrainingDiscoveryWorkspace,
) -> Result<TrainingDiscoveryWorkspace, ApplicationError> {
    if workspace.version != TRAINING_WORKSPACE_VERSION {
        return Err(ApplicationError::InvalidTrainingDiscoveryWorkspace(
            "workspace version is not supported",
        ));
    }
    validate_date_bounds(workspace.from.as_deref(), workspace.through.as_deref()).map_err(
        |_| {
            ApplicationError::InvalidTrainingDiscoveryWorkspace("workspace date bounds are invalid")
        },
    )?;
    validate_filters(
        &workspace.sport_refs,
        &workspace.required_measurements,
        workspace.text.as_deref(),
        Some(&workspace.snapshot_ref),
    )
    .map_err(|_| {
        ApplicationError::InvalidTrainingDiscoveryWorkspace(
            "workspace filters or snapshot are invalid",
        )
    })?;
    if workspace.limit != TRAINING_WORKSPACE_PAGE_SIZE
        || !workspace
            .offset
            .is_multiple_of(TRAINING_WORKSPACE_PAGE_SIZE)
    {
        return Err(ApplicationError::InvalidTrainingDiscoveryWorkspace(
            "workspace page is invalid",
        ));
    }
    match (
        workspace.view,
        workspace.calendar_month.as_deref(),
        workspace.calendar_day.as_deref(),
    ) {
        (TrainingDiscoveryView::Chronology, None, None) => {}
        (TrainingDiscoveryView::Calendar, Some(month), day) => {
            validate_month(month).map_err(|_| {
                ApplicationError::InvalidTrainingDiscoveryWorkspace(
                    "workspace calendar month is invalid",
                )
            })?;
            if let Some(day) = day {
                let parsed = parse_date(day).map_err(|_| {
                    ApplicationError::InvalidTrainingDiscoveryWorkspace(
                        "workspace calendar day is invalid",
                    )
                })?;
                if parsed.format("%Y-%m").to_string() != month
                    || workspace.from.as_deref().is_some_and(|from| day < from)
                    || workspace
                        .through
                        .as_deref()
                        .is_some_and(|through| day > through)
                {
                    return Err(ApplicationError::InvalidTrainingDiscoveryWorkspace(
                        "workspace calendar day is outside its filters",
                    ));
                }
            }
        }
        _ => {
            return Err(ApplicationError::InvalidTrainingDiscoveryWorkspace(
                "workspace view and calendar month are inconsistent",
            ));
        }
    }
    let mut selected_refs = BTreeSet::new();
    if workspace.selected_session_refs.len() > MAX_SELECTION_SIZE
        || workspace.selected_session_refs.iter().any(|session_ref| {
            !valid_opaque_ref(session_ref, SESSION_PREFIX)
                || !selected_refs.insert(session_ref.as_str())
        })
        || workspace
            .open_session_ref
            .as_deref()
            .is_some_and(|session_ref| !valid_opaque_ref(session_ref, SESSION_PREFIX))
    {
        return Err(ApplicationError::InvalidTrainingDiscoveryWorkspace(
            "workspace session references are invalid or duplicated",
        ));
    }
    Ok(workspace)
}

fn validate_date_bounds(from: Option<&str>, through: Option<&str>) -> Result<(), ApplicationError> {
    let from = from.map(parse_date).transpose()?;
    let through = through.map(parse_date).transpose()?;
    if from
        .zip(through)
        .is_some_and(|(from, through)| from > through)
    {
        return invalid("date bounds are not ordered");
    }
    Ok(())
}

fn validate_filters(
    sport_refs: &[String],
    required_measurements: &[TrainingMeasurementFilter],
    text: Option<&str>,
    snapshot_ref: Option<&str>,
) -> Result<(), ApplicationError> {
    if sport_refs.len() > MAX_SPORT_FILTERS {
        return invalid("too many sport filters");
    }
    let mut seen_sports = BTreeSet::new();
    if sport_refs.iter().any(|sport_ref| {
        !valid_opaque_ref(sport_ref, SPORT_PREFIX) || !seen_sports.insert(sport_ref)
    }) {
        return invalid("sport references are empty or duplicated");
    }
    let mut measurements = BTreeSet::new();
    if required_measurements
        .iter()
        .any(|measurement| !measurements.insert(*measurement))
    {
        return invalid("measurement filters are duplicated");
    }
    if let Some(text) = text {
        if text.trim() != text
            || text.is_empty()
            || text.chars().count() > MAX_TEXT_SCALARS
            || text.chars().any(char::is_control)
        {
            return invalid("text filter is not canonical");
        }
    }
    if snapshot_ref.is_some_and(|snapshot| !valid_opaque_ref(snapshot, SNAPSHOT_PREFIX)) {
        return invalid("snapshot reference is invalid");
    }
    Ok(())
}

fn validate_month(month: &str) -> Result<(), ApplicationError> {
    let first = NaiveDate::parse_from_str(&format!("{month}-01"), "%Y-%m-%d")
        .map_err(|_| ApplicationError::InvalidTrainingSessionSearch("calendar month is invalid"))?;
    if first.format("%Y-%m").to_string() != month {
        return invalid("calendar month is not canonical");
    }
    Ok(())
}

fn validate_calendar(
    request: &TrainingSessionCalendarRequest,
    calendar: &PersistedTrainingSessionCalendar,
) -> Result<(), ApplicationError> {
    if !valid_opaque_ref(&calendar.snapshot_ref, SNAPSHOT_PREFIX) {
        return query_failure("training calendar snapshot reference is invalid");
    }
    if request
        .snapshot_ref
        .as_ref()
        .is_some_and(|expected| expected != &calendar.snapshot_ref)
    {
        return Err(ApplicationError::TrainingSessionSearchChanged);
    }
    if let Some(range) = &calendar.available_range {
        if parse_page_date(&range.from)? > parse_page_date(&range.through)? {
            return query_failure("training calendar bounds are not ordered");
        }
    } else if !calendar.days.is_empty() {
        return query_failure("training calendar facts exist without bounds");
    }
    let mut previous: Option<(&str, usize)> = None;
    for day in &calendar.days {
        let parsed = parse_page_date(&day.local_date)?;
        if parsed.format("%Y-%m").to_string() != request.month
            || request
                .from
                .as_deref()
                .is_some_and(|from| day.local_date.as_str() < from)
            || request
                .through
                .as_deref()
                .is_some_and(|through| day.local_date.as_str() > through)
            || day.source_index == 0
            || day.session_count == 0
            || day.total_duration_milliseconds < 0
            || day.distance_session_count > day.session_count
            || day.heart_rate_session_count > day.session_count
            || day.total_distance_meters.is_some() != (day.distance_session_count > 0)
            || day
                .total_distance_meters
                .is_some_and(|value| !value.is_finite() || value < 0.0)
            || (request
                .required_measurements
                .contains(&TrainingMeasurementFilter::Distance)
                && day.distance_session_count != day.session_count)
            || (request
                .required_measurements
                .contains(&TrainingMeasurementFilter::HeartRate)
                && day.heart_rate_session_count != day.session_count)
        {
            return query_failure("training calendar day is inconsistent");
        }
        if previous.is_some_and(|(date, source)| {
            date > day.local_date.as_str()
                || (date == day.local_date.as_str() && source >= day.source_index)
        }) {
            return query_failure("training calendar days are not ordered or unique");
        }
        previous = Some((&day.local_date, day.source_index));
    }
    Ok(())
}

fn map_port_error(error: TrainingSessionDiscoveryPortError) -> ApplicationError {
    match error {
        TrainingSessionDiscoveryPortError::SnapshotChanged => {
            ApplicationError::TrainingSessionSearchChanged
        }
        TrainingSessionDiscoveryPortError::UnknownSportReference => {
            ApplicationError::InvalidTrainingSessionSearch("sport reference is not available")
        }
        TrainingSessionDiscoveryPortError::Failure(reason) => {
            ApplicationError::TrainingSessionSearch(reason)
        }
    }
}

fn validate_page(
    request: &TrainingSessionSearchRequest,
    page: &PersistedTrainingSessionSearchPage,
) -> Result<(), ApplicationError> {
    if !valid_opaque_ref(&page.snapshot_ref, SNAPSHOT_PREFIX) {
        return query_failure("training-session snapshot reference is invalid");
    }
    if request
        .snapshot_ref
        .as_ref()
        .is_some_and(|expected| expected != &page.snapshot_ref)
    {
        return Err(ApplicationError::TrainingSessionSearchChanged);
    }
    match &page.available_range {
        Some(range) => {
            let from = parse_page_date(&range.from)?;
            let through = parse_page_date(&range.through)?;
            if from > through {
                return query_failure("training-session bounds are not ordered");
            }
        }
        None if page.total_count != 0
            || !page.summaries.is_empty()
            || !page.sessions.is_empty() =>
        {
            return query_failure("training-session facts exist without bounds");
        }
        None => {}
    }
    if page.sessions.len() > request.limit {
        return query_failure("training-session page exceeds its requested size");
    }
    if request.offset > page.total_count
        || page.total_count < page.sessions.len()
        || (!page.sessions.is_empty() && request.offset >= page.total_count)
    {
        return query_failure("training-session page count is inconsistent");
    }
    let consumed = request.offset.checked_add(page.sessions.len()).ok_or(
        ApplicationError::TrainingSessionSearch(
            "training-session page offset overflowed".to_owned(),
        ),
    )?;
    if consumed < page.total_count && page.sessions.len() != request.limit {
        return query_failure("training-session page ended before its requested size");
    }
    validate_summaries(page)?;
    let summary_sources = page
        .summaries
        .iter()
        .map(|summary| summary.source_index)
        .collect::<BTreeSet<_>>();
    let mut session_refs = BTreeSet::new();
    for session in &page.sessions {
        validate_session(request, session, &summary_sources, &mut session_refs)?;
    }
    if page
        .sessions
        .windows(2)
        .any(|pair| !sessions_are_ordered(&pair[0], &pair[1], request.sort))
    {
        return query_failure("training-session page is not ordered");
    }
    Ok(())
}

fn validate_summaries(page: &PersistedTrainingSessionSearchPage) -> Result<(), ApplicationError> {
    let mut previous_source = 0;
    let mut summarized_sessions = 0usize;
    for summary in &page.summaries {
        if summary.source_index <= previous_source
            || summary.session_count == 0
            || summary.training_days == 0
            || summary.training_days > summary.session_count
            || summary.total_duration_milliseconds < 0
            || summary.distance_session_count > summary.session_count
            || summary.energy_session_count > summary.session_count
            || summary.heart_rate_session_count > summary.session_count
            || summary.total_distance_meters.is_some() != (summary.distance_session_count > 0)
            || summary
                .total_distance_meters
                .is_some_and(|value| !value.is_finite() || value < 0.0)
            || summary.total_energy_kilocalories.is_some() != (summary.energy_session_count > 0)
            || summary
                .total_energy_kilocalories
                .is_some_and(|value| value < 0)
        {
            return query_failure("training-session summary is inconsistent");
        }
        summarized_sessions = summarized_sessions
            .checked_add(summary.session_count)
            .ok_or_else(|| {
                ApplicationError::TrainingSessionSearch(
                    "training-session summary count overflowed".to_owned(),
                )
            })?;
        previous_source = summary.source_index;
    }
    if summarized_sessions != page.total_count {
        return query_failure("training-session summaries do not cover the result");
    }
    Ok(())
}

fn validate_session(
    request: &TrainingSessionSearchRequest,
    session: &TrainingSessionSearchItem,
    summary_sources: &BTreeSet<usize>,
    session_refs: &mut BTreeSet<String>,
) -> Result<(), ApplicationError> {
    if !valid_opaque_ref(&session.session_ref, SESSION_PREFIX)
        || !session_refs.insert(session.session_ref.clone())
        || session.source_index == 0
        || !summary_sources.contains(&session.source_index)
    {
        return query_failure("training-session identity is invalid or duplicated");
    }
    let started = parse_datetime(&session.started_at_local)?;
    let stopped = parse_datetime(&session.stopped_at_local)?;
    if stopped < started || session.duration_milliseconds < 0 {
        return query_failure("training-session time is invalid");
    }
    if request
        .from
        .as_deref()
        .is_some_and(|from| session.started_at_local.as_str() < from)
        || request.through.as_deref().is_some_and(|through| {
            session
                .started_at_local
                .get(..10)
                .is_none_or(|date| date > through)
        })
    {
        return query_failure("training-session page violates its date filters");
    }
    if session
        .distance_meters
        .is_some_and(|value| !value.is_finite() || value < 0.0)
        || session.energy_kilocalories.is_some_and(|value| value < 0)
        || session
            .average_heart_rate_bpm
            .is_some_and(|value| value < 0)
        || session
            .maximum_heart_rate_bpm
            .is_some_and(|value| value < 0)
        || session
            .average_heart_rate_bpm
            .zip(session.maximum_heart_rate_bpm)
            .is_some_and(|(average, maximum)| average > maximum)
    {
        return query_failure("training-session measurements are invalid");
    }
    if request
        .required_measurements
        .iter()
        .any(|measurement| !has_measurement(session, *measurement))
    {
        return query_failure("training-session page violates its measurement filters");
    }
    if !valid_opaque_ref(&session.sport_filter_ref, SPORT_PREFIX) {
        return query_failure("training-session sport filter identity is invalid");
    }
    if !request.sport_refs.is_empty() && !request.sport_refs.contains(&session.sport_filter_ref) {
        return query_failure("training-session page violates its sport filters");
    }
    validate_sport(&session.sport)?;
    if let Some(text) = request.text.as_deref() {
        let normalized = text.to_lowercase();
        let classification_matches = session
            .sport
            .classification
            .as_ref()
            .and_then(|classification| classification.display_label.as_deref())
            .is_some_and(|label| label.to_lowercase().contains(&normalized));
        let recognition_matches = session
            .sport
            .recognition
            .as_ref()
            .is_some_and(|recognition| {
                recognition
                    .localized_names
                    .values()
                    .any(|name| name.to_lowercase().contains(&normalized))
                    || recognition
                        .canonical_family
                        .as_ref()
                        .is_some_and(|family| family.contains(&normalized))
            });
        if !classification_matches && !recognition_matches {
            return query_failure("training-session page violates its text filter");
        }
    }
    Ok(())
}

fn validate_sport(sport: &TrainingSessionSport) -> Result<(), ApplicationError> {
    if training_session_sport_is_valid(sport) {
        Ok(())
    } else {
        query_failure("training-session sport context is inconsistent")
    }
}

pub(crate) fn training_session_sport_is_valid(sport: &TrainingSessionSport) -> bool {
    match (
        sport.state,
        &sport.sport_ref,
        &sport.classification,
        &sport.recognition,
        sport.recognition_candidate_count,
    ) {
        (TrainingSportState::Unavailable, None, None, None, 0) => true,
        (TrainingSportState::Recognized, None, None, Some(recognition), 1)
            if valid_recognition(recognition) =>
        {
            true
        }
        (TrainingSportState::Ambiguous, None, None, None, candidate_count)
            if candidate_count > 1 =>
        {
            true
        }
        (TrainingSportState::Unknown, Some(sport_ref), Some(classification), None, 0)
            if valid_opaque_ref(sport_ref, SPORT_PREFIX)
                && classification.canonical_family.is_none()
                && classification.display_label.is_none()
                && classification.authorship.is_none()
                && classification.revision == 0 =>
        {
            true
        }
        (
            TrainingSportState::Recognized,
            Some(sport_ref),
            Some(classification),
            Some(recognition),
            1,
        ) if valid_opaque_ref(sport_ref, SPORT_PREFIX)
            && unresolved_classification(classification)
            && valid_recognition(recognition) =>
        {
            true
        }
        (
            TrainingSportState::Ambiguous,
            Some(sport_ref),
            Some(classification),
            None,
            candidate_count,
        ) if candidate_count > 1
            && valid_opaque_ref(sport_ref, SPORT_PREFIX)
            && unresolved_classification(classification) =>
        {
            true
        }
        (
            TrainingSportState::PersonallyOverridden,
            Some(sport_ref),
            Some(classification),
            recognition,
            candidate_count,
        ) if valid_opaque_ref(sport_ref, SPORT_PREFIX)
            && classification.authorship.as_deref() == Some("user")
            && classification.revision > 0
            && classification
                .canonical_family
                .as_deref()
                .is_none_or(valid_family)
            && classification
                .display_label
                .as_deref()
                .is_none_or(valid_display_label)
            && recognition_count_is_consistent(recognition, candidate_count)
            && recognition.as_ref().is_none_or(valid_recognition) =>
        {
            true
        }
        _ => false,
    }
}

fn unresolved_classification(classification: &TrainingSportClassification) -> bool {
    classification.canonical_family.is_none()
        && classification.display_label.is_none()
        && classification.authorship.is_none()
        && classification.revision == 0
}

fn recognition_count_is_consistent(
    recognition: &Option<TrainingSportRecognition>,
    candidate_count: usize,
) -> bool {
    matches!(
        (recognition, candidate_count),
        (Some(_), 1) | (None, 0 | 2..)
    )
}

fn valid_recognition(recognition: &TrainingSportRecognition) -> bool {
    let mut language_tags = BTreeSet::new();
    recognition
        .canonical_family
        .as_deref()
        .is_none_or(valid_family)
        && !recognition.localized_names.is_empty()
        && recognition.localized_names.iter().all(|(locale, name)| {
            valid_language_tag(locale)
                && language_tags.insert(locale.to_ascii_lowercase())
                && valid_recognition_name(name)
        })
        && canonical_recognition_text(&recognition.catalogue_revision, 256)
        && recognition.retrieved_at_utc.ends_with('Z')
        && recognition.retrieved_at_utc.len() <= 64
        && DateTime::parse_from_rfc3339(&recognition.retrieved_at_utc).is_ok()
        && canonical_recognition_text(&recognition.mapping_version, 256)
        && valid_opaque_ref(&recognition.evidence_ref, "sport-evidence-")
}

fn valid_language_tag(value: &str) -> bool {
    if value.is_empty() || value.len() > 35 || value.trim() != value || value.contains('_') {
        return false;
    }
    let mut subtags = value.split('-');
    let Some(language) = subtags.next() else {
        return false;
    };
    (2..=8).contains(&language.len())
        && language.bytes().all(|byte| byte.is_ascii_alphabetic())
        && subtags.all(|subtag| {
            (1..=8).contains(&subtag.len())
                && subtag.bytes().all(|byte| byte.is_ascii_alphanumeric())
        })
}

fn valid_recognition_name(value: &str) -> bool {
    canonical_recognition_text(value, 120)
}

fn canonical_recognition_text(value: &str, maximum_characters: usize) -> bool {
    !value.is_empty()
        && value.trim() == value
        && value.chars().count() <= maximum_characters
        && !value.chars().any(char::is_control)
}

fn sessions_are_ordered(
    left: &TrainingSessionSearchItem,
    right: &TrainingSessionSearchItem,
    sort: TrainingSessionSort,
) -> bool {
    match sort {
        TrainingSessionSort::StartedDescending => left.started_at_local >= right.started_at_local,
        TrainingSessionSort::StartedAscending => left.started_at_local <= right.started_at_local,
        TrainingSessionSort::DurationDescending => {
            left.duration_milliseconds > right.duration_milliseconds
                || (left.duration_milliseconds == right.duration_milliseconds
                    && left.started_at_local >= right.started_at_local)
        }
        TrainingSessionSort::DistanceDescending => {
            match (left.distance_meters, right.distance_meters) {
                (Some(left), Some(right)) => left >= right,
                (Some(_), None) | (None, None) => true,
                (None, Some(_)) => false,
            }
        }
    }
}

fn valid_family(value: &str) -> bool {
    matches!(
        value,
        "running"
            | "cycling"
            | "swimming"
            | "walking"
            | "hiking"
            | "strength"
            | "mobility"
            | "racket-sport"
            | "team-sport"
            | "winter-sport"
            | "water-sport"
            | "other"
    )
}

fn valid_display_label(value: &str) -> bool {
    value.trim() == value
        && !value.is_empty()
        && value.chars().count() <= MAX_TEXT_SCALARS
        && !value.chars().any(char::is_control)
}

fn has_measurement(
    session: &TrainingSessionSearchItem,
    measurement: TrainingMeasurementFilter,
) -> bool {
    match measurement {
        TrainingMeasurementFilter::Distance => session.distance_meters.is_some(),
        TrainingMeasurementFilter::Energy => session.energy_kilocalories.is_some(),
        TrainingMeasurementFilter::HeartRate => {
            session.average_heart_rate_bpm.is_some() || session.maximum_heart_rate_bpm.is_some()
        }
    }
}

fn parse_date(value: &str) -> Result<NaiveDate, ApplicationError> {
    crate::parse_training_date(value).map_err(ApplicationError::InvalidTrainingSessionSearch)
}

fn parse_page_date(value: &str) -> Result<NaiveDate, ApplicationError> {
    crate::parse_training_date(value)
        .map_err(|reason| ApplicationError::TrainingSessionSearch(reason.to_owned()))
}

fn parse_datetime(value: &str) -> Result<NaiveDateTime, ApplicationError> {
    crate::parse_training_local_datetime(value)
        .map_err(|reason| ApplicationError::TrainingSessionSearch(reason.to_owned()))
}

fn valid_opaque_ref(value: &str, prefix: &str) -> bool {
    value.strip_prefix(prefix).is_some_and(|digest| {
        digest.len() == 64
            && digest
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    })
}

fn invalid<T>(reason: &'static str) -> Result<T, ApplicationError> {
    Err(ApplicationError::InvalidTrainingSessionSearch(reason))
}

fn query_failure<T>(reason: &'static str) -> Result<T, ApplicationError> {
    Err(ApplicationError::TrainingSessionSearch(reason.to_owned()))
}
