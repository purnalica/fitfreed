use std::{error::Error, fmt};

const MAX_DISPLAY_LABEL_CHARACTERS: usize = 80;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SportClassificationKey {
    origin_id: String,
    source_sport_ref: String,
}

impl SportClassificationKey {
    pub fn new(
        origin_id: impl Into<String>,
        source_sport_ref: impl Into<String>,
    ) -> Result<Self, SportClassificationError> {
        let origin_id = origin_id.into();
        let source_sport_ref = source_sport_ref.into();
        if origin_id.is_empty() {
            return Err(SportClassificationError::EmptyOrigin);
        }
        if source_sport_ref.is_empty() {
            return Err(SportClassificationError::EmptySourceSportReference);
        }
        Ok(Self {
            origin_id,
            source_sport_ref,
        })
    }

    pub fn origin_id(&self) -> &str {
        &self.origin_id
    }

    pub fn source_sport_ref(&self) -> &str {
        &self.source_sport_ref
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SportClassificationState {
    Unknown,
    Classified,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SportClassificationAuthorship {
    User,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SportClassificationScope {
    UnresolvedSourceProfile,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SportFamily {
    Running,
    Cycling,
    Swimming,
    Walking,
    Hiking,
    Strength,
    Mobility,
    RacketSport,
    TeamSport,
    WinterSport,
    WaterSport,
    Other,
}

impl SportFamily {
    pub const ALL: [Self; 12] = [
        Self::Running,
        Self::Cycling,
        Self::Swimming,
        Self::Walking,
        Self::Hiking,
        Self::Strength,
        Self::Mobility,
        Self::RacketSport,
        Self::TeamSport,
        Self::WinterSport,
        Self::WaterSport,
        Self::Other,
    ];

    pub const fn as_code(self) -> &'static str {
        match self {
            Self::Running => "running",
            Self::Cycling => "cycling",
            Self::Swimming => "swimming",
            Self::Walking => "walking",
            Self::Hiking => "hiking",
            Self::Strength => "strength",
            Self::Mobility => "mobility",
            Self::RacketSport => "racket-sport",
            Self::TeamSport => "team-sport",
            Self::WinterSport => "winter-sport",
            Self::WaterSport => "water-sport",
            Self::Other => "other",
        }
    }

    pub fn from_code(code: &str) -> Result<Self, SportClassificationError> {
        match code {
            "running" => Ok(Self::Running),
            "cycling" => Ok(Self::Cycling),
            "swimming" => Ok(Self::Swimming),
            "walking" => Ok(Self::Walking),
            "hiking" => Ok(Self::Hiking),
            "strength" => Ok(Self::Strength),
            "mobility" => Ok(Self::Mobility),
            "racket-sport" => Ok(Self::RacketSport),
            "team-sport" => Ok(Self::TeamSport),
            "winter-sport" => Ok(Self::WinterSport),
            "water-sport" => Ok(Self::WaterSport),
            "other" => Ok(Self::Other),
            _ => Err(SportClassificationError::UnknownFamilyCode),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SportClassification {
    key: SportClassificationKey,
    state: SportClassificationState,
    canonical_family: Option<SportFamily>,
    display_label: Option<String>,
    authorship: Option<SportClassificationAuthorship>,
    revision: u64,
}

impl SportClassification {
    pub fn unresolved(key: SportClassificationKey) -> Self {
        Self {
            key,
            state: SportClassificationState::Unknown,
            canonical_family: None,
            display_label: None,
            authorship: None,
            revision: 0,
        }
    }

    pub fn restore(
        key: SportClassificationKey,
        state: SportClassificationState,
        canonical_family: Option<SportFamily>,
        display_label: Option<String>,
        authorship: Option<SportClassificationAuthorship>,
        revision: u64,
    ) -> Result<Self, SportClassificationError> {
        if (revision == 0 && authorship.is_some()) || (revision > 0 && authorship.is_none()) {
            return Err(SportClassificationError::InvalidAuthorshipRevision);
        }
        let display_label = display_label
            .map(|label| validate_restored_display_label(&label).map(|()| label))
            .transpose()?;
        match state {
            SportClassificationState::Unknown
                if canonical_family.is_some() || display_label.is_some() =>
            {
                return Err(SportClassificationError::UnknownWithMeaning);
            }
            SportClassificationState::Classified
                if canonical_family.is_none() && display_label.is_none() =>
            {
                return Err(SportClassificationError::ClassifiedWithoutMeaning);
            }
            _ => {}
        }
        if revision == 0 && state != SportClassificationState::Unknown {
            return Err(SportClassificationError::InvalidAuthorshipRevision);
        }
        Ok(Self {
            key,
            state,
            canonical_family,
            display_label,
            authorship,
            revision,
        })
    }

    pub fn key(&self) -> &SportClassificationKey {
        &self.key
    }

    pub const fn state(&self) -> SportClassificationState {
        self.state
    }

    pub const fn scope(&self) -> SportClassificationScope {
        SportClassificationScope::UnresolvedSourceProfile
    }

    pub const fn canonical_family(&self) -> Option<SportFamily> {
        self.canonical_family
    }

    pub fn display_label(&self) -> Option<&str> {
        self.display_label.as_deref()
    }

    pub const fn authorship(&self) -> Option<SportClassificationAuthorship> {
        self.authorship
    }

    pub const fn revision(&self) -> u64 {
        self.revision
    }
}

pub fn author_sport_classification(
    existing: &SportClassification,
    canonical_family: Option<SportFamily>,
    display_label: Option<&str>,
) -> Result<SportClassification, SportClassificationError> {
    let display_label = display_label.map(normalize_display_label).transpose()?;
    let state = if canonical_family.is_some() || display_label.is_some() {
        SportClassificationState::Classified
    } else {
        SportClassificationState::Unknown
    };
    if existing.authorship == Some(SportClassificationAuthorship::User)
        && existing.state == state
        && existing.canonical_family == canonical_family
        && existing.display_label == display_label
    {
        return Ok(existing.clone());
    }
    let revision = existing
        .revision
        .checked_add(1)
        .ok_or(SportClassificationError::RevisionOverflow)?;
    SportClassification::restore(
        existing.key.clone(),
        state,
        canonical_family,
        display_label,
        Some(SportClassificationAuthorship::User),
        revision,
    )
}

fn normalize_display_label(value: &str) -> Result<String, SportClassificationError> {
    let label = value.trim();
    validate_display_label(label)?;
    Ok(label.to_owned())
}

fn validate_restored_display_label(value: &str) -> Result<(), SportClassificationError> {
    validate_display_label(value)?;
    if value.trim() != value {
        return Err(SportClassificationError::NonCanonicalDisplayLabel);
    }
    Ok(())
}

fn validate_display_label(value: &str) -> Result<(), SportClassificationError> {
    if value.is_empty() {
        return Err(SportClassificationError::EmptyDisplayLabel);
    }
    if value.chars().count() > MAX_DISPLAY_LABEL_CHARACTERS {
        return Err(SportClassificationError::DisplayLabelTooLong);
    }
    if value.chars().any(char::is_control) {
        return Err(SportClassificationError::ControlCharacterInDisplayLabel);
    }
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SportClassificationError {
    EmptyOrigin,
    EmptySourceSportReference,
    EmptyDisplayLabel,
    DisplayLabelTooLong,
    ControlCharacterInDisplayLabel,
    NonCanonicalDisplayLabel,
    UnknownFamilyCode,
    ClassifiedWithoutMeaning,
    UnknownWithMeaning,
    InvalidAuthorshipRevision,
    RevisionOverflow,
}

impl fmt::Display for SportClassificationError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::EmptyOrigin => "sport classification origin is empty",
            Self::EmptySourceSportReference => "source sport reference is empty",
            Self::EmptyDisplayLabel => "sport display label is empty",
            Self::DisplayLabelTooLong => "sport display label exceeds 80 characters",
            Self::ControlCharacterInDisplayLabel => {
                "sport display label contains a control character"
            }
            Self::NonCanonicalDisplayLabel => "sport display label has outer whitespace",
            Self::UnknownFamilyCode => "sport family code is unknown",
            Self::ClassifiedWithoutMeaning => "classified sport has no family or display label",
            Self::UnknownWithMeaning => "unknown sport contains classified meaning",
            Self::InvalidAuthorshipRevision => {
                "sport classification authorship and revision are inconsistent"
            }
            Self::RevisionOverflow => "sport classification revision overflowed",
        };
        formatter.write_str(message)
    }
}

impl Error for SportClassificationError {}
