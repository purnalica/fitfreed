use std::{error::Error, fmt};

use crate::{SportClassification, SportFamily};

const MAX_LOCALIZED_NAME_CHARACTERS: usize = 120;
const SPORT_EVIDENCE_PREFIX: &str = "sport-evidence-";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SportIdentityState {
    Recognized,
    Ambiguous,
    Unknown,
    PersonallyOverridden,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SportLocalizedName {
    language_tag: String,
    value: String,
}

impl SportLocalizedName {
    pub fn new(
        language_tag: impl Into<String>,
        value: impl Into<String>,
    ) -> Result<Self, SportSuggestionError> {
        let language_tag = language_tag.into();
        let value = value.into();
        if !valid_language_tag(&language_tag) {
            return Err(SportSuggestionError::InvalidLanguageTag);
        }
        if value.trim() != value {
            return Err(SportSuggestionError::NonCanonicalLocalizedName);
        }
        if value.is_empty() {
            return Err(SportSuggestionError::EmptyLocalizedName);
        }
        if value.chars().count() > MAX_LOCALIZED_NAME_CHARACTERS {
            return Err(SportSuggestionError::LocalizedNameTooLong);
        }
        if value.chars().any(char::is_control) {
            return Err(SportSuggestionError::ControlCharacterInLocalizedName);
        }
        Ok(Self {
            language_tag,
            value,
        })
    }

    pub fn language_tag(&self) -> &str {
        &self.language_tag
    }

    pub fn value(&self) -> &str {
        &self.value
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SportRecognitionProvenance {
    catalogue_revision: String,
    retrieved_at_utc: String,
    mapping_version: String,
    evidence_ref: String,
}

impl SportRecognitionProvenance {
    pub fn new(
        catalogue_revision: impl Into<String>,
        retrieved_at_utc: impl Into<String>,
        mapping_version: impl Into<String>,
        evidence_ref: impl Into<String>,
    ) -> Result<Self, SportSuggestionError> {
        let catalogue_revision = catalogue_revision.into();
        let retrieved_at_utc = retrieved_at_utc.into();
        let mapping_version = mapping_version.into();
        let evidence_ref = evidence_ref.into();
        if !nonempty_canonical(&catalogue_revision) {
            return Err(SportSuggestionError::EmptyCatalogueRevision);
        }
        if !canonical_utc_instant(&retrieved_at_utc) {
            return Err(SportSuggestionError::InvalidRetrievalInstant);
        }
        if !nonempty_canonical(&mapping_version) {
            return Err(SportSuggestionError::EmptyMappingVersion);
        }
        if !valid_evidence_ref(&evidence_ref) {
            return Err(SportSuggestionError::InvalidEvidenceReference);
        }
        Ok(Self {
            catalogue_revision,
            retrieved_at_utc,
            mapping_version,
            evidence_ref,
        })
    }

    pub fn catalogue_revision(&self) -> &str {
        &self.catalogue_revision
    }

    pub fn retrieved_at_utc(&self) -> &str {
        &self.retrieved_at_utc
    }

    pub fn mapping_version(&self) -> &str {
        &self.mapping_version
    }

    pub fn evidence_ref(&self) -> &str {
        &self.evidence_ref
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderNeutralSportSuggestion {
    canonical_family: Option<SportFamily>,
    localized_names: Vec<SportLocalizedName>,
    provenance: SportRecognitionProvenance,
}

impl ProviderNeutralSportSuggestion {
    pub fn new(
        canonical_family: Option<SportFamily>,
        mut localized_names: Vec<SportLocalizedName>,
        provenance: SportRecognitionProvenance,
    ) -> Result<Self, SportSuggestionError> {
        if localized_names.is_empty() {
            return Err(SportSuggestionError::MissingLocalizedNames);
        }
        localized_names.sort_by(|left, right| {
            left.language_tag
                .to_ascii_lowercase()
                .cmp(&right.language_tag.to_ascii_lowercase())
        });
        if localized_names.windows(2).any(|pair| {
            pair[0]
                .language_tag
                .eq_ignore_ascii_case(&pair[1].language_tag)
        }) {
            return Err(SportSuggestionError::DuplicateLanguageTag);
        }
        Ok(Self {
            canonical_family,
            localized_names,
            provenance,
        })
    }

    pub const fn canonical_family(&self) -> Option<SportFamily> {
        self.canonical_family
    }

    pub fn localized_names(&self) -> &[SportLocalizedName] {
        &self.localized_names
    }

    pub fn localized_name(&self, requested_locale: &str) -> Option<&str> {
        self.localized_names
            .iter()
            .find(|name| name.language_tag.eq_ignore_ascii_case(requested_locale))
            .or_else(|| {
                requested_locale.split_once('-').and_then(|(language, _)| {
                    self.localized_names
                        .iter()
                        .find(|name| name.language_tag.eq_ignore_ascii_case(language))
                })
            })
            .or_else(|| {
                self.localized_names
                    .iter()
                    .find(|name| name.language_tag.eq_ignore_ascii_case("en"))
            })
            .or_else(|| self.localized_names.first())
            .map(SportLocalizedName::value)
    }

    pub const fn provenance(&self) -> &SportRecognitionProvenance {
        &self.provenance
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SportIdentityResolution {
    state: SportIdentityState,
    recognition_candidates: Vec<ProviderNeutralSportSuggestion>,
}

impl SportIdentityResolution {
    pub const fn state(&self) -> SportIdentityState {
        self.state
    }

    pub fn candidate_count(&self) -> usize {
        self.recognition_candidates.len()
    }

    pub fn recognition_candidates(&self) -> &[ProviderNeutralSportSuggestion] {
        &self.recognition_candidates
    }

    pub fn recognized_suggestion(&self) -> Option<&ProviderNeutralSportSuggestion> {
        (self.recognition_candidates.len() == 1).then(|| &self.recognition_candidates[0])
    }
}

pub fn resolve_sport_identity(
    personal_classification: &SportClassification,
    recognition_candidates: Vec<ProviderNeutralSportSuggestion>,
) -> SportIdentityResolution {
    let state = if personal_classification.authorship().is_some() {
        SportIdentityState::PersonallyOverridden
    } else {
        match recognition_candidates.len() {
            0 => SportIdentityState::Unknown,
            1 => SportIdentityState::Recognized,
            _ => SportIdentityState::Ambiguous,
        }
    };
    SportIdentityResolution {
        state,
        recognition_candidates,
    }
}

fn valid_language_tag(value: &str) -> bool {
    if value.is_empty() || value.len() > 35 || value.trim() != value || value.contains('_') {
        return false;
    }
    let mut subtags = value.split('-');
    let Some(language) = subtags.next() else {
        return false;
    };
    if !(2..=8).contains(&language.len())
        || !language.bytes().all(|byte| byte.is_ascii_alphabetic())
    {
        return false;
    }
    subtags.all(|subtag| {
        (1..=8).contains(&subtag.len()) && subtag.bytes().all(|byte| byte.is_ascii_alphanumeric())
    })
}

fn nonempty_canonical(value: &str) -> bool {
    !value.is_empty() && value.trim() == value && !value.chars().any(char::is_control)
}

fn canonical_utc_instant(value: &str) -> bool {
    let bytes = value.as_bytes();
    if !(20..=64).contains(&bytes.len())
        || !bytes.is_ascii()
        || bytes[4] != b'-'
        || bytes[7] != b'-'
        || bytes[10] != b'T'
        || bytes[13] != b':'
        || bytes[16] != b':'
        || bytes.last() != Some(&b'Z')
    {
        return false;
    }
    let Some(year) = parse_ascii_digits(bytes, 0, 4) else {
        return false;
    };
    let Some(month) = parse_ascii_digits(bytes, 5, 7) else {
        return false;
    };
    let Some(day) = parse_ascii_digits(bytes, 8, 10) else {
        return false;
    };
    let Some(hour) = parse_ascii_digits(bytes, 11, 13) else {
        return false;
    };
    let Some(minute) = parse_ascii_digits(bytes, 14, 16) else {
        return false;
    };
    let Some(second) = parse_ascii_digits(bytes, 17, 19) else {
        return false;
    };
    let maximum_day = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap_year(year) => 29,
        2 => 28,
        _ => return false,
    };
    if !(1..=maximum_day).contains(&day) || hour > 23 || minute > 59 || second > 60 {
        return false;
    }
    match bytes.get(19) {
        Some(b'Z') => bytes.len() == 20,
        Some(b'.') => bytes.len() > 21 && bytes[20..bytes.len() - 1].iter().all(u8::is_ascii_digit),
        _ => false,
    }
}

fn parse_ascii_digits(bytes: &[u8], start: usize, end: usize) -> Option<u32> {
    bytes
        .get(start..end)?
        .iter()
        .try_fold(0_u32, |value, byte| {
            byte.is_ascii_digit()
                .then(|| value * 10 + u32::from(byte - b'0'))
        })
}

const fn leap_year(year: u32) -> bool {
    year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400))
}

fn valid_evidence_ref(value: &str) -> bool {
    value
        .strip_prefix(SPORT_EVIDENCE_PREFIX)
        .is_some_and(|digest| {
            digest.len() == 64
                && digest
                    .bytes()
                    .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
        })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SportSuggestionError {
    InvalidLanguageTag,
    EmptyLocalizedName,
    NonCanonicalLocalizedName,
    LocalizedNameTooLong,
    ControlCharacterInLocalizedName,
    DuplicateLanguageTag,
    MissingLocalizedNames,
    EmptyCatalogueRevision,
    InvalidRetrievalInstant,
    EmptyMappingVersion,
    InvalidEvidenceReference,
}

impl fmt::Display for SportSuggestionError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidLanguageTag => "sport suggestion language tag is invalid",
            Self::EmptyLocalizedName => "sport suggestion localized name is empty",
            Self::NonCanonicalLocalizedName => {
                "sport suggestion localized name has outer whitespace"
            }
            Self::LocalizedNameTooLong => "sport suggestion localized name exceeds 120 characters",
            Self::ControlCharacterInLocalizedName => {
                "sport suggestion localized name contains a control character"
            }
            Self::DuplicateLanguageTag => "sport suggestion language tag is duplicated",
            Self::MissingLocalizedNames => "sport suggestion has no localized name",
            Self::EmptyCatalogueRevision => "sport suggestion catalogue revision is empty",
            Self::InvalidRetrievalInstant => "sport suggestion retrieval instant is invalid",
            Self::EmptyMappingVersion => "sport suggestion mapping version is empty",
            Self::InvalidEvidenceReference => "sport suggestion evidence reference is invalid",
        })
    }
}

impl Error for SportSuggestionError {}
