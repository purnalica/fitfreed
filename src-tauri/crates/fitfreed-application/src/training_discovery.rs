use std::collections::BTreeSet;

use chrono::{NaiveDate, NaiveDateTime};

use crate::{ApplicationError, TrainingDateRange, TrainingSportClassification, TrainingSportState};

const MAX_PAGE_SIZE: usize = 100;
const MAX_SPORT_FILTERS: usize = 64;
const MAX_TEXT_SCALARS: usize = 80;
const SNAPSHOT_PREFIX: &str = "training-snapshot-";
const SESSION_PREFIX: &str = "session-";
const SPORT_PREFIX: &str = "sport-";

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
pub struct TrainingSessionSport {
    pub sport_ref: Option<String>,
    pub state: TrainingSportState,
    pub classification: Option<TrainingSportClassification>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrainingSessionSearchItem {
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
}

pub fn query_training_sessions(
    port: &dyn TrainingSessionDiscoveryPort,
    request: TrainingSessionSearchRequest,
) -> Result<TrainingSessionSearchPage, ApplicationError> {
    validate_request(&request)?;
    let persisted = port
        .query_training_sessions(&request)
        .map_err(|error| match error {
            TrainingSessionDiscoveryPortError::SnapshotChanged => {
                ApplicationError::TrainingSessionSearchChanged
            }
            TrainingSessionDiscoveryPortError::UnknownSportReference => {
                ApplicationError::InvalidTrainingSessionSearch("sport reference is not available")
            }
            TrainingSessionDiscoveryPortError::Failure(reason) => {
                ApplicationError::TrainingSessionSearch(reason)
            }
        })?;
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

fn validate_request(request: &TrainingSessionSearchRequest) -> Result<(), ApplicationError> {
    if request.limit == 0 || request.limit > MAX_PAGE_SIZE {
        return invalid("page size must be between 1 and 100");
    }
    let from = request.from.as_deref().map(parse_date).transpose()?;
    let through = request.through.as_deref().map(parse_date).transpose()?;
    if from
        .zip(through)
        .is_some_and(|(from, through)| from > through)
    {
        return invalid("date bounds are not ordered");
    }
    if request.sport_refs.len() > MAX_SPORT_FILTERS {
        return invalid("too many sport filters");
    }
    let mut sport_refs = BTreeSet::new();
    if request.sport_refs.iter().any(|sport_ref| {
        !valid_opaque_ref(sport_ref, SPORT_PREFIX) || !sport_refs.insert(sport_ref)
    }) {
        return invalid("sport references are empty or duplicated");
    }
    let mut measurements = BTreeSet::new();
    if request
        .required_measurements
        .iter()
        .any(|measurement| !measurements.insert(*measurement))
    {
        return invalid("measurement filters are duplicated");
    }
    if let Some(text) = request.text.as_deref() {
        if text.trim() != text
            || text.is_empty()
            || text.chars().count() > MAX_TEXT_SCALARS
            || text.chars().any(char::is_control)
        {
            return invalid("text filter is not canonical");
        }
    }
    if request
        .snapshot_ref
        .as_deref()
        .is_some_and(|snapshot| !valid_opaque_ref(snapshot, SNAPSHOT_PREFIX))
    {
        return invalid("snapshot reference is invalid");
    }
    Ok(())
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
    if !request.sport_refs.is_empty()
        && session
            .sport
            .sport_ref
            .as_ref()
            .is_none_or(|sport_ref| !request.sport_refs.contains(sport_ref))
    {
        return query_failure("training-session page violates its sport filters");
    }
    validate_sport(&session.sport)?;
    if let Some(text) = request.text.as_deref() {
        let matches = session
            .sport
            .classification
            .as_ref()
            .and_then(|classification| classification.display_label.as_deref())
            .is_some_and(|label| label.to_lowercase().contains(&text.to_lowercase()));
        if !matches {
            return query_failure("training-session page violates its text filter");
        }
    }
    Ok(())
}

fn validate_sport(sport: &TrainingSessionSport) -> Result<(), ApplicationError> {
    match (sport.state, &sport.sport_ref, &sport.classification) {
        (TrainingSportState::Unavailable, None, None) => Ok(()),
        (TrainingSportState::Unknown, Some(sport_ref), Some(classification))
            if valid_opaque_ref(sport_ref, SPORT_PREFIX)
                && classification.canonical_family.is_none()
                && classification.display_label.is_none()
                && ((classification.authorship.is_none() && classification.revision == 0)
                    || (classification.authorship.as_deref() == Some("user")
                        && classification.revision > 0)) =>
        {
            Ok(())
        }
        (TrainingSportState::Classified, Some(sport_ref), Some(classification))
            if valid_opaque_ref(sport_ref, SPORT_PREFIX)
                && (classification.canonical_family.is_some()
                    || classification.display_label.is_some())
                && classification.authorship.as_deref() == Some("user")
                && classification.revision > 0
                && classification
                    .canonical_family
                    .as_deref()
                    .is_none_or(valid_family)
                && classification
                    .display_label
                    .as_deref()
                    .is_none_or(valid_display_label) =>
        {
            Ok(())
        }
        _ => query_failure("training-session sport context is inconsistent"),
    }
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
