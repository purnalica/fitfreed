use std::{collections::BTreeSet, error::Error, fmt};

const REPORT_ID_PREFIX: &str = "report-";
const BLOCK_ID_PREFIX: &str = "report-block-";
const SESSION_ID_PREFIX: &str = "session-";
const ROUTE_ID_PREFIX: &str = "route-";
const SNAPSHOT_ID_PREFIX: &str = "training-snapshot-";
const ID_HEX_CHARACTERS: usize = 64;
const MAX_TITLE_CHARACTERS: usize = 120;
const MAX_NARRATIVE_CHARACTERS: usize = 10_000;
const MAX_REPORT_BLOCKS: usize = 32;
pub const MAX_ROUTE_ENDPOINT_REDACTION_METERS: u32 = 5_000;
pub const REPORT_DEFINITION_VERSION_V1: u32 = 1;
pub const REPORT_DEFINITION_VERSION: u32 = 2;

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
    Route {
        session_ref: String,
        route_ref: String,
        endpoint_redaction_meters: u32,
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

    pub fn route(
        block_ref: impl Into<String>,
        session_ref: impl Into<String>,
        route_ref: impl Into<String>,
        endpoint_redaction_meters: u32,
    ) -> Result<Self, ReportDefinitionError> {
        Self::restore(
            block_ref,
            ReportBlockContent::Route {
                session_ref: session_ref.into(),
                route_ref: route_ref.into(),
                endpoint_redaction_meters,
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
            ReportBlockContent::Route {
                session_ref,
                route_ref,
                endpoint_redaction_meters,
            } => {
                validate_identifier(session_ref, SESSION_ID_PREFIX)
                    .map_err(|_| ReportDefinitionError::InvalidSessionIdentifier)?;
                validate_identifier(route_ref, ROUTE_ID_PREFIX)
                    .map_err(|_| ReportDefinitionError::InvalidRouteIdentifier)?;
                if *endpoint_redaction_meters > MAX_ROUTE_ENDPOINT_REDACTION_METERS {
                    return Err(ReportDefinitionError::InvalidRouteEndpointRedaction);
                }
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
            ReportBlockContent::Route { .. } | ReportBlockContent::Narrative { .. } => {
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
            REPORT_DEFINITION_VERSION_V1,
            1,
            vec![session_block, narrative_block],
        )
    }

    pub fn compose_session_report(
        report_ref: impl Into<String>,
        title: &str,
        locale: ReportLocale,
        source_snapshot_ref: impl Into<String>,
        session_ref: impl Into<String>,
        blocks: Vec<ReportBlock>,
    ) -> Result<Self, ReportDefinitionError> {
        Self::restore(
            report_ref,
            normalize_title(title)?,
            locale,
            source_snapshot_ref,
            ReportOrigin::Session {
                session_ref: session_ref.into(),
            },
            ReportProvenancePolicy::CurrentAttribution,
            ReportAuthorship::User,
            REPORT_DEFINITION_VERSION,
            1,
            blocks,
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
        if revision == 0 {
            return Err(ReportDefinitionError::ZeroRevision);
        }
        match definition_version {
            REPORT_DEFINITION_VERSION_V1 => validate_version_one_blocks(&origin, &blocks)?,
            REPORT_DEFINITION_VERSION => validate_version_two_blocks(&origin, &blocks)?,
            _ => return Err(ReportDefinitionError::UnsupportedDefinitionVersion),
        }
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
    if existing.definition_version != REPORT_DEFINITION_VERSION_V1 {
        return Err(ReportDefinitionError::InvalidVersionOneBlockOrder);
    }
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
        REPORT_DEFINITION_VERSION_V1,
        revision,
        vec![session_block, narrative_block],
    )
}

pub fn revise_session_report(
    existing: &ReportDefinition,
    title: &str,
    locale: ReportLocale,
    blocks: Vec<ReportBlock>,
) -> Result<ReportDefinition, ReportDefinitionError> {
    let title = normalize_title(title)?;
    if existing.title == title
        && existing.locale == locale
        && existing.definition_version == REPORT_DEFINITION_VERSION
        && existing.blocks == blocks
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
        blocks,
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

fn validate_version_two_blocks(
    origin: &ReportOrigin,
    blocks: &[ReportBlock],
) -> Result<(), ReportDefinitionError> {
    if !(2..=MAX_REPORT_BLOCKS).contains(&blocks.len()) {
        return Err(ReportDefinitionError::InvalidVersionTwoComposition);
    }
    let ReportOrigin::Session {
        session_ref: origin,
    } = origin;
    validate_identifier(origin, SESSION_ID_PREFIX)
        .map_err(|_| ReportDefinitionError::InvalidSessionIdentifier)?;
    let mut block_refs = BTreeSet::new();
    let mut route_refs = BTreeSet::new();
    let mut session_count = 0;
    let mut narrative_count = 0;
    for block in blocks {
        if !block_refs.insert(block.block_ref()) {
            return Err(ReportDefinitionError::DuplicateBlockIdentifier);
        }
        match block.content() {
            ReportBlockContent::SessionEvidence { session_ref, .. } => {
                session_count += 1;
                if session_ref != origin {
                    return Err(ReportDefinitionError::SessionOriginMismatch);
                }
            }
            ReportBlockContent::Route {
                session_ref,
                route_ref,
                ..
            } => {
                if session_ref != origin {
                    return Err(ReportDefinitionError::SessionOriginMismatch);
                }
                if !route_refs.insert(route_ref) {
                    return Err(ReportDefinitionError::DuplicateRouteIdentifier);
                }
            }
            ReportBlockContent::Narrative { .. } => narrative_count += 1,
        }
    }
    if session_count != 1 || narrative_count != 1 {
        return Err(ReportDefinitionError::InvalidVersionTwoComposition);
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
    InvalidRouteIdentifier,
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
    InvalidVersionTwoComposition,
    DuplicateBlockIdentifier,
    DuplicateRouteIdentifier,
    InvalidRouteEndpointRedaction,
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
            Self::InvalidRouteIdentifier => "report route identifier is invalid",
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
            Self::InvalidVersionTwoComposition => {
                "version-two report composition requires one session and one narrative block"
            }
            Self::DuplicateBlockIdentifier => "report block identifiers are duplicated",
            Self::DuplicateRouteIdentifier => "report route identifiers are duplicated",
            Self::InvalidRouteEndpointRedaction => {
                "report route endpoint redaction exceeds 5000 metres"
            }
            Self::SessionOriginMismatch => "report session block does not match its origin",
            Self::UnsupportedDefinitionVersion => "report definition version is unsupported",
            Self::ZeroRevision => "report revision is zero",
            Self::RevisionOverflow => "report revision overflowed",
        };
        formatter.write_str(message)
    }
}

impl Error for ReportDefinitionError {}
