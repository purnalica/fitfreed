use std::{collections::BTreeSet, error::Error, fmt};

const MINIMUM_MEMBER_COUNT: usize = 2;
const MAXIMUM_MEMBER_COUNT: usize = 64;
const MAXIMUM_REFERENCE_CHARACTERS: usize = 200;
const RELATIONSHIP_PREFIX: &str = "unified:";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UnifiedSportRelationshipAuthorship {
    User,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnifiedSportRelationship {
    relationship_ref: String,
    primary_session_filter_ref: String,
    member_session_filter_refs: Vec<String>,
    authorship: UnifiedSportRelationshipAuthorship,
    revision: u64,
}

impl UnifiedSportRelationship {
    pub fn restore(
        relationship_ref: impl Into<String>,
        primary_session_filter_ref: impl Into<String>,
        member_session_filter_refs: Vec<String>,
        authorship: UnifiedSportRelationshipAuthorship,
        revision: u64,
    ) -> Result<Self, UnifiedSportRelationshipError> {
        let relationship_ref = relationship_ref.into();
        validate_reference(&relationship_ref)?;
        if !relationship_ref.starts_with(RELATIONSHIP_PREFIX) {
            return Err(UnifiedSportRelationshipError::InvalidRelationshipReference);
        }
        if revision == 0 {
            return Err(UnifiedSportRelationshipError::InvalidRevision);
        }
        let primary_session_filter_ref = primary_session_filter_ref.into();
        validate_reference(&primary_session_filter_ref)?;
        let member_session_filter_refs = canonical_members(member_session_filter_refs)?;
        if !member_session_filter_refs.contains(&primary_session_filter_ref) {
            return Err(UnifiedSportRelationshipError::PrimaryNotMember);
        }
        Ok(Self {
            relationship_ref,
            primary_session_filter_ref,
            member_session_filter_refs,
            authorship,
            revision,
        })
    }

    pub fn relationship_ref(&self) -> &str {
        &self.relationship_ref
    }

    pub fn primary_session_filter_ref(&self) -> &str {
        &self.primary_session_filter_ref
    }

    pub fn member_session_filter_refs(&self) -> &[String] {
        &self.member_session_filter_refs
    }

    pub const fn authorship(&self) -> UnifiedSportRelationshipAuthorship {
        self.authorship
    }

    pub const fn revision(&self) -> u64 {
        self.revision
    }
}

pub fn author_unified_sport_relationship(
    primary_session_filter_ref: &str,
    member_session_filter_refs: Vec<String>,
) -> Result<UnifiedSportRelationship, UnifiedSportRelationshipError> {
    validate_reference(primary_session_filter_ref)?;
    UnifiedSportRelationship::restore(
        format!("{RELATIONSHIP_PREFIX}{primary_session_filter_ref}"),
        primary_session_filter_ref,
        member_session_filter_refs,
        UnifiedSportRelationshipAuthorship::User,
        1,
    )
}

pub fn revise_unified_sport_relationship(
    existing: &UnifiedSportRelationship,
    primary_session_filter_ref: &str,
    member_session_filter_refs: Vec<String>,
) -> Result<UnifiedSportRelationship, UnifiedSportRelationshipError> {
    validate_reference(primary_session_filter_ref)?;
    let member_session_filter_refs = canonical_members(member_session_filter_refs)?;
    if !member_session_filter_refs.contains(&primary_session_filter_ref.to_owned()) {
        return Err(UnifiedSportRelationshipError::PrimaryNotMember);
    }
    if existing.primary_session_filter_ref == primary_session_filter_ref
        && existing.member_session_filter_refs == member_session_filter_refs
    {
        return Ok(existing.clone());
    }
    let revision = existing
        .revision
        .checked_add(1)
        .ok_or(UnifiedSportRelationshipError::RevisionOverflow)?;
    UnifiedSportRelationship::restore(
        existing.relationship_ref.clone(),
        primary_session_filter_ref,
        member_session_filter_refs,
        UnifiedSportRelationshipAuthorship::User,
        revision,
    )
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemovedUnifiedSportRelationship {
    relationship_ref: String,
    removed_revision: u64,
}

impl RemovedUnifiedSportRelationship {
    pub fn relationship_ref(&self) -> &str {
        &self.relationship_ref
    }

    pub const fn removed_revision(&self) -> u64 {
        self.removed_revision
    }
}

pub fn authorize_unified_sport_relationship_removal(
    existing: &UnifiedSportRelationship,
    expected_revision: u64,
) -> Result<RemovedUnifiedSportRelationship, UnifiedSportRelationshipError> {
    if existing.revision != expected_revision {
        return Err(UnifiedSportRelationshipError::RevisionConflict);
    }
    Ok(RemovedUnifiedSportRelationship {
        relationship_ref: existing.relationship_ref.clone(),
        removed_revision: existing.revision,
    })
}

fn canonical_members(
    member_session_filter_refs: Vec<String>,
) -> Result<Vec<String>, UnifiedSportRelationshipError> {
    if member_session_filter_refs.len() < MINIMUM_MEMBER_COUNT {
        return Err(UnifiedSportRelationshipError::TooFewMembers);
    }
    if member_session_filter_refs.len() > MAXIMUM_MEMBER_COUNT {
        return Err(UnifiedSportRelationshipError::TooManyMembers);
    }
    let mut members = BTreeSet::new();
    for member in member_session_filter_refs {
        validate_reference(&member)?;
        if !members.insert(member) {
            return Err(UnifiedSportRelationshipError::DuplicateMember);
        }
    }
    Ok(members.into_iter().collect())
}

fn validate_reference(reference: &str) -> Result<(), UnifiedSportRelationshipError> {
    if reference.is_empty() {
        return Err(UnifiedSportRelationshipError::EmptyReference);
    }
    if reference.trim() != reference {
        return Err(UnifiedSportRelationshipError::NonCanonicalReference);
    }
    if reference.chars().count() > MAXIMUM_REFERENCE_CHARACTERS {
        return Err(UnifiedSportRelationshipError::ReferenceTooLong);
    }
    if reference.chars().any(char::is_control) {
        return Err(UnifiedSportRelationshipError::ControlCharacterInReference);
    }
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UnifiedSportRelationshipError {
    EmptyReference,
    NonCanonicalReference,
    ReferenceTooLong,
    ControlCharacterInReference,
    InvalidRelationshipReference,
    TooFewMembers,
    TooManyMembers,
    DuplicateMember,
    PrimaryNotMember,
    InvalidRevision,
    RevisionConflict,
    RevisionOverflow,
}

impl fmt::Display for UnifiedSportRelationshipError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::EmptyReference => "unified sport reference is empty",
            Self::NonCanonicalReference => "unified sport reference has outer whitespace",
            Self::ReferenceTooLong => "unified sport reference is too long",
            Self::ControlCharacterInReference => {
                "unified sport reference contains a control character"
            }
            Self::InvalidRelationshipReference => "unified sport relationship reference is invalid",
            Self::TooFewMembers => "unified sport relationship requires at least two members",
            Self::TooManyMembers => "unified sport relationship contains too many members",
            Self::DuplicateMember => "unified sport relationship contains a duplicate member",
            Self::PrimaryNotMember => "unified sport primary identity is not one of its members",
            Self::InvalidRevision => "unified sport relationship revision is invalid",
            Self::RevisionConflict => "unified sport relationship revision has changed",
            Self::RevisionOverflow => "unified sport relationship revision overflowed",
        };
        formatter.write_str(message)
    }
}

impl Error for UnifiedSportRelationshipError {}
