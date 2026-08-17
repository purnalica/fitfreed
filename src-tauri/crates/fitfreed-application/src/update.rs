use std::collections::{BTreeMap, BTreeSet};

use chrono::{DateTime, Duration, FixedOffset};
use semver::Version;
use thiserror::Error;

use crate::LocalePreference;

const MAX_METADATA_VALIDITY_DAYS: i64 = 14;
const MAX_FUTURE_CLOCK_SKEW_MINUTES: i64 = 5;
const POSTPONEMENT_HOURS: i64 = 24;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalizedUpdateText {
    pub values: BTreeMap<String, String>,
}

impl LocalizedUpdateText {
    fn select(&self, locale: LocalePreference) -> Option<String> {
        self.values.get(locale.code()).cloned()
    }

    fn is_valid(&self) -> bool {
        [LocalePreference::EnUs, LocalePreference::EsEs]
            .into_iter()
            .all(|locale| {
                self.values
                    .get(locale.code())
                    .is_some_and(|value| !value.trim().is_empty())
            })
            && self
                .values
                .iter()
                .all(|(locale, value)| valid_locale_code(locale) && !value.trim().is_empty())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateRelease {
    pub version: String,
    pub published_at: String,
    pub minimum_supported_version: String,
    pub minimum_readable_library_schema_version: u32,
    pub maximum_readable_library_schema_version: u32,
    pub target_library_schema_version: u32,
    pub release_notes: LocalizedUpdateText,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UpdateWithdrawalReason {
    Security,
    DataIntegrity,
    Stability,
    Compatibility,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateWithdrawal {
    pub version: String,
    pub reason: UpdateWithdrawalReason,
    pub guidance: LocalizedUpdateText,
    pub replacement_version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthenticatedUpdateSnapshot {
    pub sequence: u64,
    pub payload_sha256: String,
    pub issued_at: String,
    pub expires_at: String,
    pub release: UpdateRelease,
    pub withdrawn_versions: Vec<UpdateWithdrawal>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UpdateTrustFailure {
    ResponseTooLarge,
    InvalidEnvelope,
    UnknownKey,
    InvalidSignature,
    InvalidPayload,
    MirrorMismatch,
    MissingTarget,
    UnsupportedChannel,
    InvalidValidityWindow,
    Expired,
    Replay,
    Equivocation,
    Downgrade,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UpdateChannelRead {
    Unconfigured,
    Offline,
    Untrusted(UpdateTrustFailure),
    Authenticated(Box<AuthenticatedUpdateSnapshot>),
}

pub trait UpdateChannelPort {
    fn fetch_update_snapshot(&self) -> Result<UpdateChannelRead, String>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrustedSnapshotRecord {
    pub sequence: u64,
    pub payload_sha256: String,
    pub release_version: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PostponedUpdate {
    pub version: String,
    pub until: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct PersistedUpdateState {
    pub trusted_snapshot: Option<TrustedSnapshotRecord>,
    pub dismissed_version: Option<String>,
    pub postponed_update: Option<PostponedUpdate>,
}

pub trait UpdateStatePort {
    fn load_update_state(&self) -> Result<PersistedUpdateState, String>;
    fn save_update_state(&self, state: &PersistedUpdateState) -> Result<(), String>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateCheckContext {
    pub installed_version: String,
    pub library_schema_version: u32,
    pub locale: LocalePreference,
    pub checked_at: String,
    pub trigger: UpdateCheckTrigger,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UpdateCheckTrigger {
    Scheduled,
    Manual,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UpdateCheckStatus {
    Unconfigured,
    Offline,
    UpToDate,
    Available,
    Dismissed,
    Postponed,
    WithdrawnInstalled,
    ManualRecoveryRequired,
    Untrusted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ManualUpdateReason {
    InstalledVersionUnsupported,
    LibrarySchemaUnsupported,
    NoSafeReplacement,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateReleaseSummary {
    pub version: String,
    pub published_at: String,
    pub release_notes: String,
    pub minimum_supported_version: String,
    pub target_library_schema_version: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateWithdrawalSummary {
    pub version: String,
    pub reason: UpdateWithdrawalReason,
    pub guidance: String,
    pub replacement_version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateCheckOutcome {
    pub installed_version: String,
    pub checked_at: String,
    pub status: UpdateCheckStatus,
    pub release: Option<UpdateReleaseSummary>,
    pub installed_withdrawal: Option<UpdateWithdrawalSummary>,
    pub update_action_available: bool,
    pub postponed_until: Option<String>,
    pub manual_recovery_reason: Option<ManualUpdateReason>,
    pub trust_failure: Option<UpdateTrustFailure>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum UpdateError {
    #[error("the update channel failed")]
    Channel,
    #[error("the update state is unavailable")]
    State,
    #[error("the update candidate changed")]
    CandidateChanged,
    #[error("the update preference input is invalid")]
    InvalidPreference,
}

pub fn check_for_updates(
    channel: &impl UpdateChannelPort,
    state_port: &impl UpdateStatePort,
    context: UpdateCheckContext,
) -> Result<UpdateCheckOutcome, UpdateError> {
    let installed_version =
        Version::parse(&context.installed_version).map_err(|_| UpdateError::InvalidPreference)?;
    let checked_at = parse_datetime(&context.checked_at).ok_or(UpdateError::InvalidPreference)?;
    match channel
        .fetch_update_snapshot()
        .map_err(|_| UpdateError::Channel)?
    {
        UpdateChannelRead::Unconfigured => {
            Ok(basic_outcome(&context, UpdateCheckStatus::Unconfigured))
        }
        UpdateChannelRead::Offline => Ok(basic_outcome(&context, UpdateCheckStatus::Offline)),
        UpdateChannelRead::Untrusted(failure) => Ok(untrusted_outcome(&context, failure)),
        UpdateChannelRead::Authenticated(snapshot) => {
            let mut state = state_port
                .load_update_state()
                .map_err(|_| UpdateError::State)?;
            if let Err(failure) = validate_snapshot(&snapshot, checked_at) {
                return Ok(untrusted_outcome(&context, failure));
            }
            if let Err(failure) = apply_replay_policy(&mut state, &snapshot) {
                return Ok(untrusted_outcome(&context, failure));
            }
            let release_version = Version::parse(&snapshot.release.version)
                .map_err(|_| UpdateError::InvalidPreference)?;
            if release_version < installed_version {
                return Ok(untrusted_outcome(&context, UpdateTrustFailure::Downgrade));
            }
            let state_changed = state.trusted_snapshot.as_ref().is_none_or(|accepted| {
                accepted.sequence != snapshot.sequence
                    || accepted.payload_sha256 != snapshot.payload_sha256
            });
            if state_changed {
                state.trusted_snapshot = Some(TrustedSnapshotRecord {
                    sequence: snapshot.sequence,
                    payload_sha256: snapshot.payload_sha256.clone(),
                    release_version: snapshot.release.version.clone(),
                });
                state.dismissed_version = None;
                state.postponed_update = None;
                state_port
                    .save_update_state(&state)
                    .map_err(|_| UpdateError::State)?;
            }
            evaluate_snapshot(&snapshot, &state, &context, installed_version, checked_at)
        }
    }
}

pub fn dismiss_update(
    state_port: &impl UpdateStatePort,
    candidate_version: &str,
) -> Result<(), UpdateError> {
    Version::parse(candidate_version).map_err(|_| UpdateError::InvalidPreference)?;
    let mut state = state_port
        .load_update_state()
        .map_err(|_| UpdateError::State)?;
    let trusted = state
        .trusted_snapshot
        .as_ref()
        .ok_or(UpdateError::CandidateChanged)?;
    if trusted.release_version != candidate_version {
        return Err(UpdateError::CandidateChanged);
    }
    state.dismissed_version = Some(candidate_version.to_owned());
    state.postponed_update = None;
    state_port
        .save_update_state(&state)
        .map_err(|_| UpdateError::State)
}

pub fn postpone_update(
    state_port: &impl UpdateStatePort,
    candidate_version: &str,
    requested_at: &str,
) -> Result<String, UpdateError> {
    Version::parse(candidate_version).map_err(|_| UpdateError::InvalidPreference)?;
    let requested_at = parse_datetime(requested_at).ok_or(UpdateError::InvalidPreference)?;
    let mut state = state_port
        .load_update_state()
        .map_err(|_| UpdateError::State)?;
    let trusted = state
        .trusted_snapshot
        .as_ref()
        .ok_or(UpdateError::CandidateChanged)?;
    if trusted.release_version != candidate_version {
        return Err(UpdateError::CandidateChanged);
    }
    let until = requested_at + Duration::hours(POSTPONEMENT_HOURS);
    let until = until.to_rfc3339();
    state.dismissed_version = None;
    state.postponed_update = Some(PostponedUpdate {
        version: candidate_version.to_owned(),
        until: until.clone(),
    });
    state_port
        .save_update_state(&state)
        .map_err(|_| UpdateError::State)?;
    Ok(until)
}

fn evaluate_snapshot(
    snapshot: &AuthenticatedUpdateSnapshot,
    state: &PersistedUpdateState,
    context: &UpdateCheckContext,
    installed_version: Version,
    checked_at: DateTime<FixedOffset>,
) -> Result<UpdateCheckOutcome, UpdateError> {
    let release_version =
        Version::parse(&snapshot.release.version).map_err(|_| UpdateError::InvalidPreference)?;
    let minimum_supported_version = Version::parse(&snapshot.release.minimum_supported_version)
        .map_err(|_| UpdateError::InvalidPreference)?;
    let installed_withdrawal = snapshot
        .withdrawn_versions
        .iter()
        .find(|withdrawal| withdrawal.version == context.installed_version)
        .map(|withdrawal| withdrawal_summary(withdrawal, context.locale))
        .transpose()
        .map_err(|_| UpdateError::InvalidPreference)?;
    let release_withdrawn = snapshot
        .withdrawn_versions
        .iter()
        .any(|withdrawal| withdrawal.version == snapshot.release.version);
    let release =
        release_summary(&snapshot.release, context.locale).ok_or(UpdateError::InvalidPreference)?;

    let mut outcome = UpdateCheckOutcome {
        installed_version: context.installed_version.clone(),
        checked_at: context.checked_at.clone(),
        status: UpdateCheckStatus::UpToDate,
        release: Some(release),
        installed_withdrawal,
        update_action_available: false,
        postponed_until: None,
        manual_recovery_reason: None,
        trust_failure: None,
    };

    let installed_is_withdrawn = outcome.installed_withdrawal.is_some();
    if installed_is_withdrawn {
        outcome.status = UpdateCheckStatus::WithdrawnInstalled;
    }

    if release_version == installed_version {
        if installed_is_withdrawn {
            outcome.manual_recovery_reason = Some(ManualUpdateReason::NoSafeReplacement);
        }
        return Ok(outcome);
    }

    if installed_version < minimum_supported_version {
        outcome.status = if installed_is_withdrawn {
            UpdateCheckStatus::WithdrawnInstalled
        } else {
            UpdateCheckStatus::ManualRecoveryRequired
        };
        outcome.manual_recovery_reason = Some(ManualUpdateReason::InstalledVersionUnsupported);
        return Ok(outcome);
    }

    if context.library_schema_version < snapshot.release.minimum_readable_library_schema_version
        || context.library_schema_version > snapshot.release.maximum_readable_library_schema_version
    {
        outcome.status = if installed_is_withdrawn {
            UpdateCheckStatus::WithdrawnInstalled
        } else {
            UpdateCheckStatus::ManualRecoveryRequired
        };
        outcome.manual_recovery_reason = Some(ManualUpdateReason::LibrarySchemaUnsupported);
        return Ok(outcome);
    }

    if release_withdrawn {
        outcome.status = if installed_is_withdrawn {
            UpdateCheckStatus::WithdrawnInstalled
        } else {
            UpdateCheckStatus::UpToDate
        };
        if installed_is_withdrawn {
            outcome.manual_recovery_reason = Some(ManualUpdateReason::NoSafeReplacement);
        }
        return Ok(outcome);
    }

    outcome.update_action_available = true;

    if installed_is_withdrawn {
        return Ok(outcome);
    }

    if context.trigger == UpdateCheckTrigger::Scheduled {
        if state.dismissed_version.as_deref() == Some(snapshot.release.version.as_str()) {
            outcome.status = UpdateCheckStatus::Dismissed;
            return Ok(outcome);
        }

        if let Some(postponed) = state
            .postponed_update
            .as_ref()
            .filter(|postponed| postponed.version == snapshot.release.version)
        {
            if parse_datetime(&postponed.until).is_some_and(|until| until > checked_at) {
                outcome.status = UpdateCheckStatus::Postponed;
                outcome.postponed_until = Some(postponed.until.clone());
                return Ok(outcome);
            }
        }
    }

    outcome.status = UpdateCheckStatus::Available;
    Ok(outcome)
}

fn validate_snapshot(
    snapshot: &AuthenticatedUpdateSnapshot,
    checked_at: DateTime<FixedOffset>,
) -> Result<(), UpdateTrustFailure> {
    if snapshot.sequence == 0 || !valid_sha256(&snapshot.payload_sha256) {
        return Err(UpdateTrustFailure::InvalidPayload);
    }
    let issued_at =
        parse_datetime(&snapshot.issued_at).ok_or(UpdateTrustFailure::InvalidPayload)?;
    let expires_at =
        parse_datetime(&snapshot.expires_at).ok_or(UpdateTrustFailure::InvalidPayload)?;
    if issued_at > checked_at + Duration::minutes(MAX_FUTURE_CLOCK_SKEW_MINUTES)
        || expires_at <= issued_at
        || expires_at - issued_at > Duration::days(MAX_METADATA_VALIDITY_DAYS)
    {
        return Err(UpdateTrustFailure::InvalidValidityWindow);
    }
    if expires_at <= checked_at {
        return Err(UpdateTrustFailure::Expired);
    }

    let release_version = Version::parse(&snapshot.release.version)
        .map_err(|_| UpdateTrustFailure::InvalidPayload)?;
    let minimum_supported_version = Version::parse(&snapshot.release.minimum_supported_version)
        .map_err(|_| UpdateTrustFailure::InvalidPayload)?;
    let published_at =
        parse_datetime(&snapshot.release.published_at).ok_or(UpdateTrustFailure::InvalidPayload)?;
    if minimum_supported_version > release_version
        || published_at > issued_at + Duration::minutes(MAX_FUTURE_CLOCK_SKEW_MINUTES)
        || snapshot.release.minimum_readable_library_schema_version == 0
        || snapshot.release.minimum_readable_library_schema_version
            > snapshot.release.maximum_readable_library_schema_version
        || snapshot.release.target_library_schema_version
            < snapshot.release.maximum_readable_library_schema_version
        || !snapshot.release.release_notes.is_valid()
    {
        return Err(UpdateTrustFailure::InvalidPayload);
    }

    let mut withdrawn_versions = BTreeSet::new();
    for withdrawal in &snapshot.withdrawn_versions {
        let withdrawn_version =
            Version::parse(&withdrawal.version).map_err(|_| UpdateTrustFailure::InvalidPayload)?;
        if !withdrawn_versions.insert(withdrawn_version.clone()) || !withdrawal.guidance.is_valid()
        {
            return Err(UpdateTrustFailure::InvalidPayload);
        }
        if let Some(replacement) = &withdrawal.replacement_version {
            let replacement =
                Version::parse(replacement).map_err(|_| UpdateTrustFailure::InvalidPayload)?;
            if replacement == withdrawn_version {
                return Err(UpdateTrustFailure::InvalidPayload);
            }
        }
    }
    Ok(())
}

fn apply_replay_policy(
    state: &mut PersistedUpdateState,
    snapshot: &AuthenticatedUpdateSnapshot,
) -> Result<(), UpdateTrustFailure> {
    let Some(accepted) = &state.trusted_snapshot else {
        return Ok(());
    };
    if snapshot.sequence < accepted.sequence {
        return Err(UpdateTrustFailure::Replay);
    }
    if snapshot.sequence == accepted.sequence && snapshot.payload_sha256 != accepted.payload_sha256
    {
        return Err(UpdateTrustFailure::Equivocation);
    }
    Ok(())
}

fn release_summary(
    release: &UpdateRelease,
    locale: LocalePreference,
) -> Option<UpdateReleaseSummary> {
    Some(UpdateReleaseSummary {
        version: release.version.clone(),
        published_at: release.published_at.clone(),
        release_notes: release.release_notes.select(locale)?,
        minimum_supported_version: release.minimum_supported_version.clone(),
        target_library_schema_version: release.target_library_schema_version,
    })
}

fn withdrawal_summary(
    withdrawal: &UpdateWithdrawal,
    locale: LocalePreference,
) -> Result<UpdateWithdrawalSummary, ()> {
    Ok(UpdateWithdrawalSummary {
        version: withdrawal.version.clone(),
        reason: withdrawal.reason,
        guidance: withdrawal.guidance.select(locale).ok_or(())?,
        replacement_version: withdrawal.replacement_version.clone(),
    })
}

fn basic_outcome(context: &UpdateCheckContext, status: UpdateCheckStatus) -> UpdateCheckOutcome {
    UpdateCheckOutcome {
        installed_version: context.installed_version.clone(),
        checked_at: context.checked_at.clone(),
        status,
        release: None,
        installed_withdrawal: None,
        update_action_available: false,
        postponed_until: None,
        manual_recovery_reason: None,
        trust_failure: None,
    }
}

fn untrusted_outcome(
    context: &UpdateCheckContext,
    failure: UpdateTrustFailure,
) -> UpdateCheckOutcome {
    UpdateCheckOutcome {
        trust_failure: Some(failure),
        ..basic_outcome(context, UpdateCheckStatus::Untrusted)
    }
}

fn parse_datetime(value: &str) -> Option<DateTime<FixedOffset>> {
    DateTime::parse_from_rfc3339(value).ok()
}

fn valid_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .as_bytes()
            .iter()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(byte))
}

fn valid_locale_code(value: &str) -> bool {
    let mut parts = value.split('-');
    let Some(language) = parts.next() else {
        return false;
    };
    if !(2..=3).contains(&language.len()) || !language.bytes().all(|byte| byte.is_ascii_lowercase())
    {
        return false;
    }

    let Some(next) = parts.next() else {
        return false;
    };
    let region = if next.len() == 4
        && next.bytes().enumerate().all(|(index, byte)| {
            if index == 0 {
                byte.is_ascii_uppercase()
            } else {
                byte.is_ascii_lowercase()
            }
        }) {
        let Some(region) = parts.next() else {
            return false;
        };
        region
    } else {
        next
    };

    parts.next().is_none()
        && ((region.len() == 2 && region.bytes().all(|byte| byte.is_ascii_uppercase()))
            || (region.len() == 3 && region.bytes().all(|byte| byte.is_ascii_digit())))
}
