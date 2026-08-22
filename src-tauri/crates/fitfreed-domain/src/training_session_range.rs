use std::{error::Error, fmt};

const RANGE_ID_PREFIX: &str = "range-";
const SESSION_REF_PREFIX: &str = "session-";
const EVIDENCE_REVISION_PREFIX: &str = "range-evidence-";
const ID_HEX_CHARACTERS: usize = 64;
const MAX_TITLE_CHARACTERS: usize = 80;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingSessionRangeAuthorship {
    User,
}

impl TrainingSessionRangeAuthorship {
    pub const fn code(self) -> &'static str {
        match self {
            Self::User => "user",
        }
    }

    pub const fn from_code(code: &str) -> Option<Self> {
        match code.as_bytes() {
            b"user" => Some(Self::User),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingSessionRangeState {
    Current,
    ReviewRequired,
}

impl TrainingSessionRangeState {
    pub const fn code(self) -> &'static str {
        match self {
            Self::Current => "current",
            Self::ReviewRequired => "review-required",
        }
    }

    pub const fn from_code(code: &str) -> Option<Self> {
        match code.as_bytes() {
            b"current" => Some(Self::Current),
            b"review-required" => Some(Self::ReviewRequired),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingSessionRangeEvidenceCompatibility {
    Compatible,
    Incompatible,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSessionRange {
    range_id: String,
    session_ref: String,
    title: String,
    started_at_elapsed_milliseconds: i64,
    ended_at_elapsed_milliseconds: i64,
    evidence_revision: String,
    authorship: TrainingSessionRangeAuthorship,
    state: TrainingSessionRangeState,
    revision: u64,
}

impl TrainingSessionRange {
    #[allow(clippy::too_many_arguments)]
    pub fn create(
        range_id: impl Into<String>,
        session_ref: impl Into<String>,
        title: &str,
        started_at_elapsed_milliseconds: i64,
        ended_at_elapsed_milliseconds: i64,
        session_duration_milliseconds: i64,
        evidence_revision: impl Into<String>,
    ) -> Result<Self, TrainingSessionRangeError> {
        validate_session_duration(session_duration_milliseconds)?;
        validate_boundaries(
            started_at_elapsed_milliseconds,
            ended_at_elapsed_milliseconds,
        )?;
        if ended_at_elapsed_milliseconds > session_duration_milliseconds {
            return Err(TrainingSessionRangeError::OutsideSession);
        }
        Self::restore(
            range_id,
            session_ref,
            normalize_title(title)?,
            started_at_elapsed_milliseconds,
            ended_at_elapsed_milliseconds,
            evidence_revision,
            TrainingSessionRangeAuthorship::User,
            TrainingSessionRangeState::Current,
            1,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn restore(
        range_id: impl Into<String>,
        session_ref: impl Into<String>,
        title: impl Into<String>,
        started_at_elapsed_milliseconds: i64,
        ended_at_elapsed_milliseconds: i64,
        evidence_revision: impl Into<String>,
        authorship: TrainingSessionRangeAuthorship,
        state: TrainingSessionRangeState,
        revision: u64,
    ) -> Result<Self, TrainingSessionRangeError> {
        let range_id = range_id.into();
        let session_ref = session_ref.into();
        let title = title.into();
        let evidence_revision = evidence_revision.into();
        validate_capability(&range_id, RANGE_ID_PREFIX)
            .map_err(|()| TrainingSessionRangeError::InvalidIdentifier)?;
        validate_capability(&session_ref, SESSION_REF_PREFIX)
            .map_err(|()| TrainingSessionRangeError::InvalidSessionReference)?;
        validate_title(&title)?;
        if title.trim() != title {
            return Err(TrainingSessionRangeError::NonCanonicalTitle);
        }
        validate_boundaries(
            started_at_elapsed_milliseconds,
            ended_at_elapsed_milliseconds,
        )?;
        validate_capability(&evidence_revision, EVIDENCE_REVISION_PREFIX)
            .map_err(|()| TrainingSessionRangeError::InvalidEvidenceRevision)?;
        if revision == 0 {
            return Err(TrainingSessionRangeError::ZeroRevision);
        }
        Ok(Self {
            range_id,
            session_ref,
            title,
            started_at_elapsed_milliseconds,
            ended_at_elapsed_milliseconds,
            evidence_revision,
            authorship,
            state,
            revision,
        })
    }

    pub fn range_id(&self) -> &str {
        &self.range_id
    }

    pub fn session_ref(&self) -> &str {
        &self.session_ref
    }

    pub fn title(&self) -> &str {
        &self.title
    }

    pub const fn started_at_elapsed_milliseconds(&self) -> i64 {
        self.started_at_elapsed_milliseconds
    }

    pub const fn ended_at_elapsed_milliseconds(&self) -> i64 {
        self.ended_at_elapsed_milliseconds
    }

    pub fn evidence_revision(&self) -> &str {
        &self.evidence_revision
    }

    pub const fn authorship(&self) -> TrainingSessionRangeAuthorship {
        self.authorship
    }

    pub const fn state(&self) -> TrainingSessionRangeState {
        self.state
    }

    pub const fn revision(&self) -> u64 {
        self.revision
    }
}

pub fn rename_training_session_range(
    existing: &TrainingSessionRange,
    title: &str,
) -> Result<TrainingSessionRange, TrainingSessionRangeError> {
    let title = normalize_title(title)?;
    if existing.title == title {
        return Ok(existing.clone());
    }
    revise(existing, |revised| revised.title = title)
}

pub fn adjust_training_session_range(
    existing: &TrainingSessionRange,
    started_at_elapsed_milliseconds: i64,
    ended_at_elapsed_milliseconds: i64,
    session_duration_milliseconds: i64,
    evidence_revision: &str,
) -> Result<TrainingSessionRange, TrainingSessionRangeError> {
    validate_session_duration(session_duration_milliseconds)?;
    validate_boundaries(
        started_at_elapsed_milliseconds,
        ended_at_elapsed_milliseconds,
    )?;
    if ended_at_elapsed_milliseconds > session_duration_milliseconds {
        return Err(TrainingSessionRangeError::OutsideSession);
    }
    validate_capability(evidence_revision, EVIDENCE_REVISION_PREFIX)
        .map_err(|()| TrainingSessionRangeError::InvalidEvidenceRevision)?;
    if existing.started_at_elapsed_milliseconds == started_at_elapsed_milliseconds
        && existing.ended_at_elapsed_milliseconds == ended_at_elapsed_milliseconds
        && existing.evidence_revision == evidence_revision
        && existing.state == TrainingSessionRangeState::Current
    {
        return Ok(existing.clone());
    }
    revise(existing, |revised| {
        revised.started_at_elapsed_milliseconds = started_at_elapsed_milliseconds;
        revised.ended_at_elapsed_milliseconds = ended_at_elapsed_milliseconds;
        revised.evidence_revision = evidence_revision.to_owned();
        revised.state = TrainingSessionRangeState::Current;
    })
}

pub fn reconcile_training_session_range(
    existing: &TrainingSessionRange,
    session_duration_milliseconds: Option<i64>,
    evidence_revision: &str,
    compatibility: TrainingSessionRangeEvidenceCompatibility,
) -> Result<TrainingSessionRange, TrainingSessionRangeError> {
    validate_capability(evidence_revision, EVIDENCE_REVISION_PREFIX)
        .map_err(|()| TrainingSessionRangeError::InvalidEvidenceRevision)?;
    let boundaries_remain_valid = session_duration_milliseconds
        .filter(|duration| *duration >= 0)
        .is_some_and(|duration| existing.ended_at_elapsed_milliseconds <= duration);
    let state = if compatibility == TrainingSessionRangeEvidenceCompatibility::Compatible
        && boundaries_remain_valid
    {
        TrainingSessionRangeState::Current
    } else {
        TrainingSessionRangeState::ReviewRequired
    };
    if existing.evidence_revision == evidence_revision && existing.state == state {
        return Ok(existing.clone());
    }
    revise(existing, |revised| {
        revised.evidence_revision = evidence_revision.to_owned();
        revised.state = state;
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemovedTrainingSessionRange {
    range_id: String,
    session_ref: String,
    expected_revision: u64,
}

impl RemovedTrainingSessionRange {
    pub fn range_id(&self) -> &str {
        &self.range_id
    }

    pub fn session_ref(&self) -> &str {
        &self.session_ref
    }

    pub const fn expected_revision(&self) -> u64 {
        self.expected_revision
    }
}

pub fn remove_training_session_range(
    existing: &TrainingSessionRange,
) -> Result<RemovedTrainingSessionRange, TrainingSessionRangeError> {
    if existing.revision == 0 {
        return Err(TrainingSessionRangeError::ZeroRevision);
    }
    Ok(RemovedTrainingSessionRange {
        range_id: existing.range_id.clone(),
        session_ref: existing.session_ref.clone(),
        expected_revision: existing.revision,
    })
}

fn revise(
    existing: &TrainingSessionRange,
    change: impl FnOnce(&mut TrainingSessionRange),
) -> Result<TrainingSessionRange, TrainingSessionRangeError> {
    let mut revised = existing.clone();
    revised.revision = revised
        .revision
        .checked_add(1)
        .ok_or(TrainingSessionRangeError::RevisionOverflow)?;
    change(&mut revised);
    Ok(revised)
}

fn validate_capability(value: &str, prefix: &str) -> Result<(), ()> {
    let Some(suffix) = value.strip_prefix(prefix) else {
        return Err(());
    };
    if suffix.len() != ID_HEX_CHARACTERS
        || !suffix
            .bytes()
            .all(|character| character.is_ascii_digit() || (b'a'..=b'f').contains(&character))
    {
        return Err(());
    }
    Ok(())
}

fn normalize_title(value: &str) -> Result<String, TrainingSessionRangeError> {
    let title = value.trim();
    validate_title(title)?;
    Ok(title.to_owned())
}

fn validate_title(value: &str) -> Result<(), TrainingSessionRangeError> {
    if value.is_empty() {
        return Err(TrainingSessionRangeError::EmptyTitle);
    }
    if value.chars().count() > MAX_TITLE_CHARACTERS {
        return Err(TrainingSessionRangeError::TitleTooLong);
    }
    if value.chars().any(char::is_control) {
        return Err(TrainingSessionRangeError::ControlCharacterInTitle);
    }
    Ok(())
}

fn validate_boundaries(started: i64, ended: i64) -> Result<(), TrainingSessionRangeError> {
    if started < 0 || ended <= started {
        return Err(TrainingSessionRangeError::InvalidBoundaries);
    }
    Ok(())
}

fn validate_session_duration(duration: i64) -> Result<(), TrainingSessionRangeError> {
    if duration < 0 {
        return Err(TrainingSessionRangeError::InvalidSessionDuration);
    }
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingSessionRangeError {
    InvalidIdentifier,
    InvalidSessionReference,
    EmptyTitle,
    TitleTooLong,
    ControlCharacterInTitle,
    NonCanonicalTitle,
    InvalidBoundaries,
    OutsideSession,
    InvalidSessionDuration,
    InvalidEvidenceRevision,
    ZeroRevision,
    RevisionOverflow,
}

impl fmt::Display for TrainingSessionRangeError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::InvalidIdentifier => "training-session range identifier is invalid",
            Self::InvalidSessionReference => "training-session range owner is invalid",
            Self::EmptyTitle => "training-session range title is empty",
            Self::TitleTooLong => "training-session range title exceeds 80 characters",
            Self::ControlCharacterInTitle => {
                "training-session range title contains a control character"
            }
            Self::NonCanonicalTitle => "training-session range title has outer whitespace",
            Self::InvalidBoundaries => {
                "training-session range boundaries are negative, equal, or reversed"
            }
            Self::OutsideSession => "training-session range ends outside the session",
            Self::InvalidSessionDuration => "training-session range session duration is negative",
            Self::InvalidEvidenceRevision => "training-session range evidence revision is invalid",
            Self::ZeroRevision => "training-session range revision is zero",
            Self::RevisionOverflow => "training-session range revision overflowed",
        };
        formatter.write_str(message)
    }
}

impl Error for TrainingSessionRangeError {}
