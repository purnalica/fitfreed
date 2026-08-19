use std::{collections::BTreeSet, error::Error, fmt};

const REPORT_ID_PREFIX: &str = "report-";
const BLOCK_ID_PREFIX: &str = "report-block-";
const SESSION_ID_PREFIX: &str = "session-";
const SNAPSHOT_ID_PREFIX: &str = "training-snapshot-";
const ID_HEX_CHARACTERS: usize = 64;
const MAX_TITLE_CHARACTERS: usize = 120;
const MAX_NARRATIVE_CHARACTERS: usize = 10_000;
pub const REPORT_DEFINITION_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReportLocale {
    EnUs,
    EsEs,
}

impl ReportLocale {
    pub const fn code(self) -> &'static str {
        match self {
            Self::EnUs => "en-US",
            Self::EsEs => "es-ES",
        }
    }

    pub const fn from_code(code: &str) -> Option<Self> {
        match code.as_bytes() {
            b"en-US" => Some(Self::EnUs),
            b"es-ES" => Some(Self::EsEs),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReportAuthorship {
    User,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReportProvenancePolicy {
    CurrentAttribution,
}

impl ReportProvenancePolicy {
    pub const fn code(self) -> &'static str {
        match self {
            Self::CurrentAttribution => "current-attribution",
        }
    }

    pub const fn from_code(code: &str) -> Option<Self> {
        match code.as_bytes() {
            b"current-attribution" => Some(Self::CurrentAttribution),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReportOrigin {
    Session { session_ref: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReportBlockContent {
    SessionEvidence {
        session_ref: String,
        include_physiological_context: bool,
    },
    Narrative {
        body: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReportBlock {
    block_ref: String,
    content: ReportBlockContent,
}

impl ReportBlock {
    pub fn session_evidence(
        block_ref: impl Into<String>,
        session_ref: impl Into<String>,
        include_physiological_context: bool,
    ) -> Result<Self, ReportDefinitionError> {
        Self::restore(
            block_ref,
            ReportBlockContent::SessionEvidence {
                session_ref: session_ref.into(),
                include_physiological_context,
            },
        )
    }

    pub fn narrative(
        block_ref: impl Into<String>,
        body: &str,
    ) -> Result<Self, ReportDefinitionError> {
        Self::restore(
            block_ref,
            ReportBlockContent::Narrative {
                body: normalize_narrative(body)?,
            },
        )
    }

    pub fn restore(
        block_ref: impl Into<String>,
        content: ReportBlockContent,
    ) -> Result<Self, ReportDefinitionError> {
        let block_ref = block_ref.into();
        validate_identifier(&block_ref, BLOCK_ID_PREFIX)
            .map_err(|_| ReportDefinitionError::InvalidBlockIdentifier)?;
        match &content {
            ReportBlockContent::SessionEvidence { session_ref, .. } => {
                validate_identifier(session_ref, SESSION_ID_PREFIX)
                    .map_err(|_| ReportDefinitionError::InvalidSessionIdentifier)?;
            }
            ReportBlockContent::Narrative { body } => {
                validate_narrative(body)?;
                if normalize_narrative(body)? != *body {
                    return Err(ReportDefinitionError::NonCanonicalNarrative);
                }
            }
        }
        Ok(Self { block_ref, content })
    }

    pub fn block_ref(&self) -> &str {
        &self.block_ref
    }

    pub fn content(&self) -> &ReportBlockContent {
        &self.content
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReportDefinition {
    report_ref: String,
    title: String,
    locale: ReportLocale,
    source_snapshot_ref: String,
    origin: ReportOrigin,
    provenance_policy: ReportProvenancePolicy,
    authorship: ReportAuthorship,
    definition_version: u32,
    revision: u64,
    blocks: Vec<ReportBlock>,
}

impl ReportDefinition {
    pub fn create_session_report(
        report_ref: impl Into<String>,
        title: &str,
        locale: ReportLocale,
        source_snapshot_ref: impl Into<String>,
        session_block: ReportBlock,
        narrative_block: ReportBlock,
    ) -> Result<Self, ReportDefinitionError> {
        let origin = match session_block.content() {
            ReportBlockContent::SessionEvidence { session_ref, .. } => ReportOrigin::Session {
                session_ref: session_ref.clone(),
            },
            ReportBlockContent::Narrative { .. } => {
                return Err(ReportDefinitionError::InvalidVersionOneBlockOrder);
            }
        };
        Self::restore(
            report_ref,
            normalize_title(title)?,
            locale,
            source_snapshot_ref,
            origin,
            ReportProvenancePolicy::CurrentAttribution,
            ReportAuthorship::User,
            REPORT_DEFINITION_VERSION,
            1,
            vec![session_block, narrative_block],
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn restore(
        report_ref: impl Into<String>,
        title: impl Into<String>,
        locale: ReportLocale,
        source_snapshot_ref: impl Into<String>,
        origin: ReportOrigin,
        provenance_policy: ReportProvenancePolicy,
        authorship: ReportAuthorship,
        definition_version: u32,
        revision: u64,
        blocks: Vec<ReportBlock>,
    ) -> Result<Self, ReportDefinitionError> {
        let report_ref = report_ref.into();
        let title = title.into();
        let source_snapshot_ref = source_snapshot_ref.into();
        validate_identifier(&report_ref, REPORT_ID_PREFIX)
            .map_err(|_| ReportDefinitionError::InvalidReportIdentifier)?;
        validate_title(&title)?;
        if normalize_title(&title)? != title {
            return Err(ReportDefinitionError::NonCanonicalTitle);
        }
        validate_identifier(&source_snapshot_ref, SNAPSHOT_ID_PREFIX)
            .map_err(|_| ReportDefinitionError::InvalidSnapshotIdentifier)?;
        if definition_version != REPORT_DEFINITION_VERSION {
            return Err(ReportDefinitionError::UnsupportedDefinitionVersion);
        }
        if revision == 0 {
            return Err(ReportDefinitionError::ZeroRevision);
        }
        validate_version_one_blocks(&origin, &blocks)?;
        Ok(Self {
            report_ref,
            title,
            locale,
            source_snapshot_ref,
            origin,
            provenance_policy,
            authorship,
            definition_version,
            revision,
            blocks,
        })
    }

    pub fn report_ref(&self) -> &str {
        &self.report_ref
    }

    pub fn title(&self) -> &str {
        &self.title
    }

    pub const fn locale(&self) -> ReportLocale {
        self.locale
    }

    pub fn source_snapshot_ref(&self) -> &str {
        &self.source_snapshot_ref
    }

    pub fn origin(&self) -> &ReportOrigin {
        &self.origin
    }

    pub const fn provenance_policy(&self) -> ReportProvenancePolicy {
        self.provenance_policy
    }

    pub const fn authorship(&self) -> ReportAuthorship {
        self.authorship
    }

    pub const fn definition_version(&self) -> u32 {
        self.definition_version
    }

    pub const fn revision(&self) -> u64 {
        self.revision
    }

    pub fn blocks(&self) -> &[ReportBlock] {
        &self.blocks
    }
}

pub fn author_session_report(
    existing: &ReportDefinition,
    title: &str,
    locale: ReportLocale,
    include_physiological_context: bool,
    narrative: &str,
) -> Result<ReportDefinition, ReportDefinitionError> {
    let title = normalize_title(title)?;
    let narrative = normalize_narrative(narrative)?;
    let ReportBlockContent::SessionEvidence { session_ref, .. } = existing.blocks[0].content()
    else {
        return Err(ReportDefinitionError::InvalidVersionOneBlockOrder);
    };
    let session_block = ReportBlock::session_evidence(
        existing.blocks[0].block_ref.clone(),
        session_ref.clone(),
        include_physiological_context,
    )?;
    let narrative_block = ReportBlock::narrative(existing.blocks[1].block_ref.clone(), &narrative)?;
    if existing.title == title
        && existing.locale == locale
        && existing.blocks == [session_block.clone(), narrative_block.clone()]
    {
        return Ok(existing.clone());
    }
    let revision = existing
        .revision
        .checked_add(1)
        .ok_or(ReportDefinitionError::RevisionOverflow)?;
    ReportDefinition::restore(
        existing.report_ref.clone(),
        title,
        locale,
        existing.source_snapshot_ref.clone(),
        existing.origin.clone(),
        existing.provenance_policy,
        ReportAuthorship::User,
        REPORT_DEFINITION_VERSION,
        revision,
        vec![session_block, narrative_block],
    )
}

fn validate_version_one_blocks(
    origin: &ReportOrigin,
    blocks: &[ReportBlock],
) -> Result<(), ReportDefinitionError> {
    if blocks.len() != 2
        || !matches!(
            blocks[0].content(),
            ReportBlockContent::SessionEvidence { .. }
        )
        || !matches!(blocks[1].content(), ReportBlockContent::Narrative { .. })
    {
        return Err(ReportDefinitionError::InvalidVersionOneBlockOrder);
    }
    let mut block_refs = BTreeSet::new();
    if blocks
        .iter()
        .any(|block| !block_refs.insert(block.block_ref()))
    {
        return Err(ReportDefinitionError::DuplicateBlockIdentifier);
    }
    let ReportOrigin::Session {
        session_ref: origin,
    } = origin;
    let ReportBlockContent::SessionEvidence { session_ref, .. } = blocks[0].content() else {
        return Err(ReportDefinitionError::InvalidVersionOneBlockOrder);
    };
    validate_identifier(origin, SESSION_ID_PREFIX)
        .map_err(|_| ReportDefinitionError::InvalidSessionIdentifier)?;
    if origin != session_ref {
        return Err(ReportDefinitionError::SessionOriginMismatch);
    }
    Ok(())
}

fn validate_identifier(value: &str, prefix: &str) -> Result<(), ()> {
    let suffix = value.strip_prefix(prefix).ok_or(())?;
    if suffix.len() != ID_HEX_CHARACTERS
        || !suffix
            .bytes()
            .all(|character| character.is_ascii_digit() || (b'a'..=b'f').contains(&character))
    {
        return Err(());
    }
    Ok(())
}

fn normalize_title(value: &str) -> Result<String, ReportDefinitionError> {
    let title = value.trim();
    validate_title(title)?;
    Ok(title.to_owned())
}

fn validate_title(value: &str) -> Result<(), ReportDefinitionError> {
    if value.is_empty() {
        return Err(ReportDefinitionError::EmptyTitle);
    }
    if value.chars().count() > MAX_TITLE_CHARACTERS {
        return Err(ReportDefinitionError::TitleTooLong);
    }
    if value.chars().any(char::is_control) {
        return Err(ReportDefinitionError::ControlCharacterInTitle);
    }
    Ok(())
}

fn normalize_narrative(value: &str) -> Result<String, ReportDefinitionError> {
    let normalized = value.replace("\r\n", "\n").replace('\r', "\n");
    let narrative = normalized.trim();
    validate_narrative(narrative)?;
    Ok(narrative.to_owned())
}

fn validate_narrative(value: &str) -> Result<(), ReportDefinitionError> {
    if value.is_empty() {
        return Err(ReportDefinitionError::EmptyNarrative);
    }
    if value.chars().count() > MAX_NARRATIVE_CHARACTERS {
        return Err(ReportDefinitionError::NarrativeTooLong);
    }
    if value
        .chars()
        .any(|character| character.is_control() && character != '\n' && character != '\t')
    {
        return Err(ReportDefinitionError::ControlCharacterInNarrative);
    }
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReportDefinitionError {
    InvalidReportIdentifier,
    InvalidBlockIdentifier,
    InvalidSessionIdentifier,
    InvalidSnapshotIdentifier,
    EmptyTitle,
    TitleTooLong,
    ControlCharacterInTitle,
    NonCanonicalTitle,
    EmptyNarrative,
    NarrativeTooLong,
    ControlCharacterInNarrative,
    NonCanonicalNarrative,
    InvalidVersionOneBlockOrder,
    DuplicateBlockIdentifier,
    SessionOriginMismatch,
    UnsupportedDefinitionVersion,
    ZeroRevision,
    RevisionOverflow,
}

impl fmt::Display for ReportDefinitionError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::InvalidReportIdentifier => "report identifier is invalid",
            Self::InvalidBlockIdentifier => "report block identifier is invalid",
            Self::InvalidSessionIdentifier => "report session identifier is invalid",
            Self::InvalidSnapshotIdentifier => "report source snapshot is invalid",
            Self::EmptyTitle => "report title is empty",
            Self::TitleTooLong => "report title exceeds 120 characters",
            Self::ControlCharacterInTitle => "report title contains a control character",
            Self::NonCanonicalTitle => "report title is not canonical",
            Self::EmptyNarrative => "report narrative is empty",
            Self::NarrativeTooLong => "report narrative exceeds 10000 characters",
            Self::ControlCharacterInNarrative => {
                "report narrative contains an unsupported control character"
            }
            Self::NonCanonicalNarrative => "report narrative is not canonical",
            Self::InvalidVersionOneBlockOrder => {
                "version-one report blocks are not session evidence followed by narrative"
            }
            Self::DuplicateBlockIdentifier => "report block identifiers are duplicated",
            Self::SessionOriginMismatch => "report session block does not match its origin",
            Self::UnsupportedDefinitionVersion => "report definition version is unsupported",
            Self::ZeroRevision => "report revision is zero",
            Self::RevisionOverflow => "report revision overflowed",
        };
        formatter.write_str(message)
    }
}

impl Error for ReportDefinitionError {}
