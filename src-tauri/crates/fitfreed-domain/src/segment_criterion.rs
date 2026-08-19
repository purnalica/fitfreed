use std::{error::Error, fmt};

const CRITERION_ID_PREFIX: &str = "criterion-";
const CRITERION_ID_HEX_CHARACTERS: usize = 64;
const MAX_TITLE_CHARACTERS: usize = 80;
const MAX_MANUAL_BOUNDARIES: usize = 99;
const MINIMUM_HEART_RATE_BPM: u16 = 20;
const MAXIMUM_HEART_RATE_BPM: u16 = 300;
pub const SEGMENT_EVALUATION_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq)]
pub enum SegmentCriterionDefinition {
    EqualElapsedTime {
        span_milliseconds: i64,
    },
    EqualDistance {
        span_meters: f64,
    },
    HeartRateZone {
        minimum_beats_per_minute: u16,
        maximum_beats_per_minute: u16,
    },
    ManualBoundaries {
        elapsed_milliseconds: Vec<i64>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SegmentCriterionAuthorship {
    User,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SegmentCriterion {
    criterion_id: String,
    title: String,
    definition: SegmentCriterionDefinition,
    authorship: SegmentCriterionAuthorship,
    evaluation_version: u32,
    revision: u64,
}

impl SegmentCriterion {
    pub fn create(
        criterion_id: impl Into<String>,
        title: &str,
        definition: SegmentCriterionDefinition,
    ) -> Result<Self, SegmentCriterionError> {
        Self::restore(
            criterion_id,
            normalize_title(title)?,
            definition,
            SegmentCriterionAuthorship::User,
            SEGMENT_EVALUATION_VERSION,
            1,
        )
    }

    pub fn restore(
        criterion_id: impl Into<String>,
        title: impl Into<String>,
        definition: SegmentCriterionDefinition,
        authorship: SegmentCriterionAuthorship,
        evaluation_version: u32,
        revision: u64,
    ) -> Result<Self, SegmentCriterionError> {
        let criterion_id = criterion_id.into();
        let title = title.into();
        validate_criterion_id(&criterion_id)?;
        validate_title(&title)?;
        if title.trim() != title {
            return Err(SegmentCriterionError::NonCanonicalTitle);
        }
        validate_definition(&definition)?;
        if evaluation_version != SEGMENT_EVALUATION_VERSION {
            return Err(SegmentCriterionError::UnsupportedEvaluationVersion);
        }
        if revision == 0 {
            return Err(SegmentCriterionError::ZeroRevision);
        }
        Ok(Self {
            criterion_id,
            title,
            definition,
            authorship,
            evaluation_version,
            revision,
        })
    }

    pub fn criterion_id(&self) -> &str {
        &self.criterion_id
    }

    pub fn title(&self) -> &str {
        &self.title
    }

    pub fn definition(&self) -> &SegmentCriterionDefinition {
        &self.definition
    }

    pub const fn authorship(&self) -> SegmentCriterionAuthorship {
        self.authorship
    }

    pub const fn evaluation_version(&self) -> u32 {
        self.evaluation_version
    }

    pub const fn revision(&self) -> u64 {
        self.revision
    }
}

pub fn author_segment_criterion(
    existing: &SegmentCriterion,
    title: &str,
    definition: SegmentCriterionDefinition,
) -> Result<SegmentCriterion, SegmentCriterionError> {
    let title = normalize_title(title)?;
    validate_definition(&definition)?;
    if existing.title == title && existing.definition == definition {
        return Ok(existing.clone());
    }
    let revision = existing
        .revision
        .checked_add(1)
        .ok_or(SegmentCriterionError::RevisionOverflow)?;
    SegmentCriterion::restore(
        existing.criterion_id.clone(),
        title,
        definition,
        SegmentCriterionAuthorship::User,
        SEGMENT_EVALUATION_VERSION,
        revision,
    )
}

fn validate_criterion_id(value: &str) -> Result<(), SegmentCriterionError> {
    let Some(suffix) = value.strip_prefix(CRITERION_ID_PREFIX) else {
        return Err(SegmentCriterionError::InvalidIdentifier);
    };
    if suffix.len() != CRITERION_ID_HEX_CHARACTERS
        || !suffix
            .bytes()
            .all(|character| character.is_ascii_digit() || (b'a'..=b'f').contains(&character))
    {
        return Err(SegmentCriterionError::InvalidIdentifier);
    }
    Ok(())
}

fn normalize_title(value: &str) -> Result<String, SegmentCriterionError> {
    let title = value.trim();
    validate_title(title)?;
    Ok(title.to_owned())
}

fn validate_title(value: &str) -> Result<(), SegmentCriterionError> {
    if value.is_empty() {
        return Err(SegmentCriterionError::EmptyTitle);
    }
    if value.chars().count() > MAX_TITLE_CHARACTERS {
        return Err(SegmentCriterionError::TitleTooLong);
    }
    if value.chars().any(char::is_control) {
        return Err(SegmentCriterionError::ControlCharacterInTitle);
    }
    Ok(())
}

fn validate_definition(
    definition: &SegmentCriterionDefinition,
) -> Result<(), SegmentCriterionError> {
    match definition {
        SegmentCriterionDefinition::EqualElapsedTime { span_milliseconds }
            if *span_milliseconds <= 0 =>
        {
            Err(SegmentCriterionError::InvalidElapsedSpan)
        }
        SegmentCriterionDefinition::EqualDistance { span_meters }
            if !span_meters.is_finite()
                || *span_meters < 0.001
                || *span_meters >= i64::MAX as f64 / 1_000.0 =>
        {
            Err(SegmentCriterionError::InvalidDistanceSpan)
        }
        SegmentCriterionDefinition::HeartRateZone {
            minimum_beats_per_minute,
            maximum_beats_per_minute,
        } if *minimum_beats_per_minute < MINIMUM_HEART_RATE_BPM
            || *maximum_beats_per_minute > MAXIMUM_HEART_RATE_BPM
            || minimum_beats_per_minute > maximum_beats_per_minute =>
        {
            Err(SegmentCriterionError::InvalidHeartRateZone)
        }
        SegmentCriterionDefinition::ManualBoundaries {
            elapsed_milliseconds,
        } => {
            if elapsed_milliseconds.is_empty()
                || elapsed_milliseconds.len() > MAX_MANUAL_BOUNDARIES
                || elapsed_milliseconds.iter().any(|boundary| *boundary <= 0)
                || elapsed_milliseconds
                    .windows(2)
                    .any(|pair| pair[0] >= pair[1])
            {
                return Err(SegmentCriterionError::InvalidManualBoundaries);
            }
            Ok(())
        }
        _ => Ok(()),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SegmentCriterionError {
    InvalidIdentifier,
    EmptyTitle,
    TitleTooLong,
    ControlCharacterInTitle,
    NonCanonicalTitle,
    InvalidElapsedSpan,
    InvalidDistanceSpan,
    InvalidHeartRateZone,
    InvalidManualBoundaries,
    UnsupportedEvaluationVersion,
    ZeroRevision,
    RevisionOverflow,
}

impl fmt::Display for SegmentCriterionError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::InvalidIdentifier => "segment criterion identifier is invalid",
            Self::EmptyTitle => "segment criterion title is empty",
            Self::TitleTooLong => "segment criterion title exceeds 80 characters",
            Self::ControlCharacterInTitle => "segment criterion title contains a control character",
            Self::NonCanonicalTitle => "segment criterion title has outer whitespace",
            Self::InvalidElapsedSpan => "equal-time span is not positive",
            Self::InvalidDistanceSpan => {
                "equal-distance span is outside the supported millimetre range"
            }
            Self::InvalidHeartRateZone => "heart-rate zone is outside 20 through 300 bpm",
            Self::InvalidManualBoundaries => {
                "manual boundaries are empty, unordered, duplicated, or exceed 99 entries"
            }
            Self::UnsupportedEvaluationVersion => "segment evaluation version is unsupported",
            Self::ZeroRevision => "segment criterion revision is zero",
            Self::RevisionOverflow => "segment criterion revision overflowed",
        };
        formatter.write_str(message)
    }
}

impl Error for SegmentCriterionError {}
