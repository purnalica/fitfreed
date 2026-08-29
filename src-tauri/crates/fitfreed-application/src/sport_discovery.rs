use std::collections::{BTreeMap, BTreeSet};

use chrono::NaiveDate;
use fitfreed_domain::{
    author_sport_classification, author_unified_sport_relationship,
    authorize_unified_sport_relationship_removal, resolve_sport_identity,
    revise_unified_sport_relationship, ProviderNeutralSportSuggestion, SportClassification,
    SportClassificationAuthorship, SportClassificationError, SportClassificationScope, SportFamily,
    SportIdentityState, UnifiedSportRelationship, UnifiedSportRelationshipAuthorship,
    UnifiedSportRelationshipError,
};

use crate::{ApplicationError, TrainingSessionSport};

const MAXIMUM_VISIBLE_SPORT_MEMBER_COUNT: usize = 64;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DetectedTrainingSport {
    pub session_filter_ref: String,
    pub provider_normalization_ref: Option<String>,
    pub sport_ref: Option<String>,
    pub origin_id: String,
    pub classification: Option<SportClassification>,
    pub recognition_candidates: Vec<ProviderNeutralSportSuggestion>,
    pub first_local_date: String,
    pub last_local_date: String,
    pub session_count: usize,
    pub total_duration_milliseconds: i128,
    pub distance_session_count: usize,
    pub heart_rate_session_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PersistedTrainingSportsState {
    pub snapshot_ref: String,
    pub detected_sports: Vec<DetectedTrainingSport>,
    pub unified_relationships: Vec<UnifiedSportRelationship>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSportCollectionExpectation {
    pub session_filter_ref: String,
    pub session_count: usize,
}

pub trait TrainingSportsPort {
    fn query_training_sports_state(&self) -> Result<PersistedTrainingSportsState, String>;

    fn compare_and_save_sport_classification(
        &self,
        expected_revision: u64,
        classification: &SportClassification,
    ) -> Result<bool, String>;

    fn compare_and_save_unified_sport_relationship(
        &self,
        expected_snapshot_ref: &str,
        expected_revision: u64,
        relationship: &UnifiedSportRelationship,
        members: &[TrainingSportCollectionExpectation],
    ) -> Result<bool, String>;

    fn compare_and_remove_unified_sport_relationship(
        &self,
        expected_snapshot_ref: &str,
        relationship_ref: &str,
        expected_revision: u64,
    ) -> Result<bool, String>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingSportState {
    Recognized,
    Ambiguous,
    Unknown,
    PersonallyOverridden,
    Unavailable,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrainingSportClassificationScope {
    UnresolvedSourceProfile,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSportClassification {
    pub scope: TrainingSportClassificationScope,
    pub canonical_family: Option<String>,
    pub display_label: Option<String>,
    pub authorship: Option<String>,
    pub revision: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSportRecognition {
    pub canonical_family: Option<String>,
    pub localized_names: BTreeMap<String, String>,
    pub catalogue_revision: String,
    pub retrieved_at_utc: String,
    pub mapping_version: String,
    pub evidence_ref: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSportCoverage {
    pub session_count: usize,
    pub total_duration_milliseconds: i128,
    pub distance_session_count: usize,
    pub heart_rate_session_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSport {
    pub session_filter_ref: String,
    pub member_session_filter_refs: Vec<String>,
    pub sport_ref: Option<String>,
    pub source_index: usize,
    pub state: TrainingSportState,
    pub classification: Option<TrainingSportClassification>,
    pub recognition: Option<TrainingSportRecognition>,
    pub recognition_candidate_count: usize,
    pub unification: Option<TrainingSportUnification>,
    pub first_local_date: String,
    pub last_local_date: String,
    pub coverage: TrainingSportCoverage,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSportUnification {
    pub relationship_ref: String,
    pub primary_session_filter_ref: String,
    pub member_session_filter_refs: Vec<String>,
    pub authorship: String,
    pub revision: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingSportUnificationReviewReason {
    MissingMember,
    UnusablePrimary,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSportUnificationReview {
    pub relationship: TrainingSportUnification,
    pub reason: TrainingSportUnificationReviewReason,
    pub missing_member_session_filter_refs: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSportsOverview {
    pub snapshot_ref: String,
    pub origin_count: usize,
    pub session_count: usize,
    pub sports: Vec<TrainingSport>,
    pub sport_collections: Vec<TrainingSport>,
    pub unification_reviews: Vec<TrainingSportUnificationReview>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SaveSportClassificationRequest {
    pub sport_ref: String,
    pub expected_revision: u64,
    pub canonical_family: Option<String>,
    pub display_label: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SportClassificationSaveOutcome {
    Changed,
    Unchanged,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SavedTrainingSportClassification {
    pub outcome: SportClassificationSaveOutcome,
    pub overview: TrainingSportsOverview,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SaveUnifiedSportRelationshipRequest {
    pub expected_snapshot_ref: String,
    pub expected_revision: u64,
    pub relationship_ref: Option<String>,
    pub primary_session_filter_ref: String,
    pub members: Vec<TrainingSportCollectionExpectation>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemoveUnifiedSportRelationshipRequest {
    pub expected_snapshot_ref: String,
    pub relationship_ref: String,
    pub expected_revision: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UnifiedSportRelationshipSaveOutcome {
    Changed,
    Unchanged,
    Removed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SavedUnifiedSportRelationship {
    pub outcome: UnifiedSportRelationshipSaveOutcome,
    pub overview: TrainingSportsOverview,
}

pub fn query_training_sports(
    port: &dyn TrainingSportsPort,
) -> Result<TrainingSportsOverview, ApplicationError> {
    let state = port
        .query_training_sports_state()
        .map_err(ApplicationError::SportClassificationQuery)?;
    build_training_sports_overview(state)
}

pub fn save_training_sport_classification(
    port: &dyn TrainingSportsPort,
    request: SaveSportClassificationRequest,
) -> Result<SavedTrainingSportClassification, ApplicationError> {
    if request.sport_ref.is_empty() {
        return Err(ApplicationError::InvalidSportClassification(
            "sport reference is empty",
        ));
    }
    if request
        .display_label
        .as_deref()
        .is_some_and(|label| label.trim() != label)
    {
        return Err(ApplicationError::InvalidSportClassification(
            "sport display label is not canonical",
        ));
    }
    let canonical_family = request
        .canonical_family
        .as_deref()
        .map(SportFamily::from_code)
        .transpose()
        .map_err(invalid_classification)?;
    let state = port
        .query_training_sports_state()
        .map_err(ApplicationError::SportClassificationQuery)?;
    let record = state
        .detected_sports
        .into_iter()
        .find(|sport| sport.sport_ref.as_deref() == Some(request.sport_ref.as_str()))
        .ok_or(ApplicationError::InvalidSportClassification(
            "sport reference is not available",
        ))?;
    if record.sport_ref.as_deref() != Some(request.sport_ref.as_str()) {
        return Err(ApplicationError::SportClassificationQuery(
            "sport query returned a different reference".to_owned(),
        ));
    }
    let classified_session_filter_ref = record.session_filter_ref.clone();
    validate_detected_sport(&record, &mut BTreeSet::new(), &mut BTreeMap::new())?;
    let existing =
        record
            .classification
            .as_ref()
            .ok_or(ApplicationError::InvalidSportClassification(
                "sport evidence is unavailable",
            ))?;
    if existing.revision() != request.expected_revision {
        return Err(ApplicationError::SportClassificationConflict);
    }
    let authored =
        author_sport_classification(existing, canonical_family, request.display_label.as_deref())
            .map_err(invalid_classification)?;
    let outcome = if &authored == existing {
        SportClassificationSaveOutcome::Unchanged
    } else {
        let saved = port
            .compare_and_save_sport_classification(request.expected_revision, &authored)
            .map_err(ApplicationError::SportClassificationUpdate)?;
        if !saved {
            return Err(ApplicationError::SportClassificationConflict);
        }
        SportClassificationSaveOutcome::Changed
    };
    let overview = query_training_sports(port)?;
    let saved_sport_remains_discoverable = overview.sports.iter().any(|sport| {
        sport.sport_ref.as_deref() == Some(request.sport_ref.as_str())
            || sport
                .member_session_filter_refs
                .contains(&classified_session_filter_ref)
    });
    if !saved_sport_remains_discoverable {
        return Err(ApplicationError::SportClassificationQuery(
            "saved sport disappeared from discovery".to_owned(),
        ));
    }
    Ok(SavedTrainingSportClassification { outcome, overview })
}

pub fn save_unified_sport_relationship(
    port: &dyn TrainingSportsPort,
    request: SaveUnifiedSportRelationshipRequest,
) -> Result<SavedUnifiedSportRelationship, ApplicationError> {
    validate_unification_request_shape(&request)?;
    let state = port
        .query_training_sports_state()
        .map_err(ApplicationError::SportClassificationQuery)?;
    if state.snapshot_ref != request.expected_snapshot_ref {
        return Err(ApplicationError::SportUnificationConflict);
    }
    let existing = request
        .relationship_ref
        .as_deref()
        .map(|relationship_ref| {
            state
                .unified_relationships
                .iter()
                .find(|relationship| relationship.relationship_ref() == relationship_ref)
                .ok_or(ApplicationError::InvalidSportUnification(
                    "relationship reference is not available",
                ))
        })
        .transpose()?;
    if existing
        .as_ref()
        .is_some_and(|relationship| relationship.revision() != request.expected_revision)
        || (existing.is_none() && request.expected_revision != 0)
    {
        return Err(ApplicationError::SportUnificationConflict);
    }
    let member_refs = request
        .members
        .iter()
        .map(|member| member.session_filter_ref.clone())
        .collect::<Vec<_>>();
    let relationship = match existing {
        Some(existing) => revise_unified_sport_relationship(
            existing,
            &request.primary_session_filter_ref,
            member_refs,
        ),
        None => author_unified_sport_relationship(&request.primary_session_filter_ref, member_refs),
    }
    .map_err(invalid_unification)?;
    validate_unification_against_state(&state, &relationship, &request.members)?;
    let outcome = if existing.is_some_and(|existing| existing == &relationship) {
        UnifiedSportRelationshipSaveOutcome::Unchanged
    } else {
        let saved = port
            .compare_and_save_unified_sport_relationship(
                &request.expected_snapshot_ref,
                request.expected_revision,
                &relationship,
                &request.members,
            )
            .map_err(ApplicationError::SportUnificationUpdate)?;
        if !saved {
            return Err(ApplicationError::SportUnificationConflict);
        }
        UnifiedSportRelationshipSaveOutcome::Changed
    };
    let overview = query_training_sports(port)?;
    Ok(SavedUnifiedSportRelationship { outcome, overview })
}

pub fn remove_unified_sport_relationship(
    port: &dyn TrainingSportsPort,
    request: RemoveUnifiedSportRelationshipRequest,
) -> Result<SavedUnifiedSportRelationship, ApplicationError> {
    if request.expected_snapshot_ref.is_empty() || request.relationship_ref.is_empty() {
        return Err(ApplicationError::InvalidSportUnification(
            "relationship removal reference is empty",
        ));
    }
    let state = port
        .query_training_sports_state()
        .map_err(ApplicationError::SportClassificationQuery)?;
    if state.snapshot_ref != request.expected_snapshot_ref {
        return Err(ApplicationError::SportUnificationConflict);
    }
    let relationship = state
        .unified_relationships
        .iter()
        .find(|relationship| relationship.relationship_ref() == request.relationship_ref)
        .ok_or(ApplicationError::InvalidSportUnification(
            "relationship reference is not available",
        ))?;
    let removed =
        authorize_unified_sport_relationship_removal(relationship, request.expected_revision)
            .map_err(invalid_unification)?;
    let changed = port
        .compare_and_remove_unified_sport_relationship(
            &request.expected_snapshot_ref,
            removed.relationship_ref(),
            removed.removed_revision(),
        )
        .map_err(ApplicationError::SportUnificationUpdate)?;
    if !changed {
        return Err(ApplicationError::SportUnificationConflict);
    }
    let overview = query_training_sports(port)?;
    Ok(SavedUnifiedSportRelationship {
        outcome: UnifiedSportRelationshipSaveOutcome::Removed,
        overview,
    })
}

fn validate_unification_request_shape(
    request: &SaveUnifiedSportRelationshipRequest,
) -> Result<(), ApplicationError> {
    if request.expected_snapshot_ref.is_empty()
        || request.primary_session_filter_ref.is_empty()
        || request
            .members
            .iter()
            .any(|member| member.session_filter_ref.is_empty() || member.session_count == 0)
    {
        return Err(ApplicationError::InvalidSportUnification(
            "relationship request is incomplete",
        ));
    }
    Ok(())
}

fn validate_unification_against_state(
    state: &PersistedTrainingSportsState,
    relationship: &UnifiedSportRelationship,
    expectations: &[TrainingSportCollectionExpectation],
) -> Result<(), ApplicationError> {
    let records = state
        .detected_sports
        .iter()
        .map(|record| (record.session_filter_ref.as_str(), record))
        .collect::<BTreeMap<_, _>>();
    for expectation in expectations {
        let record = records.get(expectation.session_filter_ref.as_str()).ok_or(
            ApplicationError::InvalidSportUnification("relationship member is not available"),
        )?;
        if record.session_count != expectation.session_count {
            return Err(ApplicationError::SportUnificationConflict);
        }
    }
    let primary = records
        .get(relationship.primary_session_filter_ref())
        .ok_or(ApplicationError::InvalidSportUnification(
            "primary relationship member is not available",
        ))?;
    let primary = map_detected_sport((*primary).clone(), 1);
    if !usable_unification_primary(&primary) {
        return Err(ApplicationError::InvalidSportUnification(
            "primary relationship member has no usable identity",
        ));
    }
    for current in &state.unified_relationships {
        if current.relationship_ref() == relationship.relationship_ref() {
            continue;
        }
        if current
            .member_session_filter_refs()
            .iter()
            .any(|member| relationship.member_session_filter_refs().contains(member))
        {
            return Err(ApplicationError::InvalidSportUnification(
                "relationship member already belongs to another relationship",
            ));
        }
    }
    Ok(())
}

fn build_training_sports_overview(
    state: PersistedTrainingSportsState,
) -> Result<TrainingSportsOverview, ApplicationError> {
    if state.snapshot_ref.is_empty() || state.snapshot_ref.trim() != state.snapshot_ref {
        return Err(ApplicationError::SportClassificationQuery(
            "sport query returned an invalid snapshot reference".to_owned(),
        ));
    }
    let PersistedTrainingSportsState {
        snapshot_ref,
        detected_sports: records,
        mut unified_relationships,
    } = state;
    let provider_normalization_by_ref = records
        .iter()
        .filter_map(|record| {
            record
                .provider_normalization_ref
                .as_ref()
                .map(|normalization_ref| {
                    (
                        record.session_filter_ref.clone(),
                        (record.origin_id.clone(), normalization_ref.clone()),
                    )
                })
        })
        .collect::<BTreeMap<_, _>>();
    let origins = records
        .iter()
        .map(|record| record.origin_id.clone())
        .collect::<BTreeSet<_>>();
    if origins.iter().any(String::is_empty) {
        return Err(ApplicationError::SportClassificationQuery(
            "sport query returned an empty origin".to_owned(),
        ));
    }
    let source_indices = origins
        .iter()
        .enumerate()
        .map(|(index, origin)| (origin.clone(), index + 1))
        .collect::<BTreeMap<_, _>>();
    let mut seen_session_filter_refs = BTreeSet::new();
    let mut seen_classifications = BTreeMap::new();
    let mut session_count = 0_usize;
    let mut sports = Vec::with_capacity(records.len());
    for record in records {
        validate_detected_sport(
            &record,
            &mut seen_session_filter_refs,
            &mut seen_classifications,
        )?;
        session_count = session_count
            .checked_add(record.session_count)
            .ok_or_else(|| {
                ApplicationError::SportClassificationQuery(
                    "detected sport session count overflowed".to_owned(),
                )
            })?;
        let source_index = *source_indices.get(&record.origin_id).ok_or_else(|| {
            ApplicationError::SportClassificationQuery(
                "detected sport origin has no source index".to_owned(),
            )
        })?;
        sports.push(map_detected_sport(record, source_index));
    }
    let mut sport_collections = sports.clone();
    unified_relationships
        .sort_by(|left, right| left.relationship_ref().cmp(right.relationship_ref()));
    let (sports, unification_reviews) = project_unified_sports(sports, unified_relationships)?;
    let sports = project_provider_normalized_sports(sports, &provider_normalization_by_ref)?;
    let projected_session_count = sports.iter().try_fold(0_usize, |total, sport| {
        total
            .checked_add(sport.coverage.session_count)
            .ok_or_else(|| {
                ApplicationError::SportClassificationQuery(
                    "projected sport session count overflowed".to_owned(),
                )
            })
    })?;
    if projected_session_count != session_count {
        return Err(ApplicationError::SportClassificationQuery(
            "projected sport session count changed".to_owned(),
        ));
    }
    let mut sports = sports;
    sports.sort_by_key(sport_sort_key);
    sport_collections.sort_by_key(sport_sort_key);
    Ok(TrainingSportsOverview {
        snapshot_ref,
        origin_count: origins.len(),
        session_count,
        sports,
        sport_collections,
        unification_reviews,
    })
}

fn project_provider_normalized_sports(
    sports: Vec<TrainingSport>,
    normalization_by_ref: &BTreeMap<String, (String, String)>,
) -> Result<Vec<TrainingSport>, ApplicationError> {
    let mut grouped = BTreeMap::<(String, String), Vec<TrainingSport>>::new();
    let mut projected = Vec::new();
    for sport in sports {
        let Some(normalization) = normalization_by_ref.get(&sport.session_filter_ref) else {
            projected.push(sport);
            continue;
        };
        grouped
            .entry(normalization.clone())
            .or_default()
            .push(sport);
    }
    for ((_, normalization_ref), mut members) in grouped {
        members.sort_by(|left, right| left.session_filter_ref.cmp(&right.session_filter_ref));
        if members.len() < 2
            || members
                .iter()
                .any(|member| member.state != TrainingSportState::Recognized)
        {
            projected.extend(members);
            continue;
        }
        let primary_recognition = members[0].recognition.as_ref().ok_or_else(|| {
            ApplicationError::SportClassificationQuery(
                "provider-normalized sport has no recognition".to_owned(),
            )
        })?;
        if members.iter().skip(1).any(|member| {
            member.recognition.as_ref().is_none_or(|recognition| {
                !same_training_sport_recognition(primary_recognition, recognition)
            })
        }) {
            return Err(ApplicationError::SportClassificationQuery(
                "provider-normalized sport meanings disagree".to_owned(),
            ));
        }
        let member_session_filter_refs = members
            .iter()
            .flat_map(|member| member.member_session_filter_refs.iter().cloned())
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect::<Vec<_>>();
        if member_session_filter_refs.len() > MAXIMUM_VISIBLE_SPORT_MEMBER_COUNT {
            return Err(ApplicationError::SportClassificationQuery(
                "provider-normalized sport exceeds the supported member limit".to_owned(),
            ));
        }
        let mut normalized = members[0].clone();
        normalized.session_filter_ref = normalization_ref;
        normalized.member_session_filter_refs = member_session_filter_refs;
        normalized.first_local_date = members
            .iter()
            .map(|member| member.first_local_date.clone())
            .min()
            .ok_or_else(|| {
                ApplicationError::SportClassificationQuery(
                    "provider-normalized sport has no first date".to_owned(),
                )
            })?;
        normalized.last_local_date = members
            .iter()
            .map(|member| member.last_local_date.clone())
            .max()
            .ok_or_else(|| {
                ApplicationError::SportClassificationQuery(
                    "provider-normalized sport has no last date".to_owned(),
                )
            })?;
        normalized.coverage = merge_sport_coverages(members.iter().map(|member| &member.coverage))?;
        projected.push(normalized);
    }
    Ok(projected)
}

fn same_training_sport_recognition(
    left: &TrainingSportRecognition,
    right: &TrainingSportRecognition,
) -> bool {
    left.canonical_family == right.canonical_family
        && left.localized_names == right.localized_names
        && left.catalogue_revision == right.catalogue_revision
        && left.retrieved_at_utc == right.retrieved_at_utc
        && left.mapping_version == right.mapping_version
}

fn merge_sport_coverages<'a>(
    mut coverages: impl Iterator<Item = &'a TrainingSportCoverage>,
) -> Result<TrainingSportCoverage, ApplicationError> {
    coverages.try_fold(
        TrainingSportCoverage {
            session_count: 0,
            total_duration_milliseconds: 0,
            distance_session_count: 0,
            heart_rate_session_count: 0,
        },
        |mut merged, current| {
            merged.session_count = merged
                .session_count
                .checked_add(current.session_count)
                .ok_or_else(|| unification_overflow("session"))?;
            merged.total_duration_milliseconds = merged
                .total_duration_milliseconds
                .checked_add(current.total_duration_milliseconds)
                .ok_or_else(|| unification_overflow("duration"))?;
            merged.distance_session_count = merged
                .distance_session_count
                .checked_add(current.distance_session_count)
                .ok_or_else(|| unification_overflow("distance"))?;
            merged.heart_rate_session_count = merged
                .heart_rate_session_count
                .checked_add(current.heart_rate_session_count)
                .ok_or_else(|| unification_overflow("heart-rate"))?;
            Ok(merged)
        },
    )
}

fn validate_detected_sport(
    record: &DetectedTrainingSport,
    seen_session_filter_refs: &mut BTreeSet<String>,
    seen_classifications: &mut BTreeMap<(String, String), SportClassification>,
) -> Result<(), ApplicationError> {
    let first = parse_local_date(&record.first_local_date)?;
    let last = parse_local_date(&record.last_local_date)?;
    if first > last {
        return Err(ApplicationError::SportClassificationQuery(
            "detected sport dates are not ordered".to_owned(),
        ));
    }
    if record.session_count == 0
        || record.distance_session_count > record.session_count
        || record.heart_rate_session_count > record.session_count
        || record.total_duration_milliseconds < 0
    {
        return Err(ApplicationError::SportClassificationQuery(
            "detected sport coverage is invalid".to_owned(),
        ));
    }
    if record.session_filter_ref.is_empty()
        || !seen_session_filter_refs.insert(record.session_filter_ref.clone())
    {
        return Err(ApplicationError::SportClassificationQuery(
            "detected sport session filter reference is empty or duplicated".to_owned(),
        ));
    }
    if record
        .provider_normalization_ref
        .as_ref()
        .is_some_and(String::is_empty)
    {
        return Err(ApplicationError::SportClassificationQuery(
            "provider sport normalization reference is empty".to_owned(),
        ));
    }
    match (&record.sport_ref, &record.classification) {
        (Some(sport_ref), Some(classification)) => {
            if sport_ref.is_empty() {
                return Err(ApplicationError::SportClassificationQuery(
                    "detected sport reference is empty".to_owned(),
                ));
            }
            if classification.key().origin_id() != record.origin_id {
                return Err(ApplicationError::SportClassificationQuery(
                    "sport classification origin does not match its evidence".to_owned(),
                ));
            }
            let key = (
                classification.key().origin_id().to_owned(),
                classification.key().source_sport_ref().to_owned(),
            );
            match seen_classifications.get(&key) {
                Some(previous) if previous != classification => {
                    return Err(ApplicationError::SportClassificationQuery(
                        "detected sport classification representations disagree".to_owned(),
                    ));
                }
                Some(_) => {}
                None => {
                    seen_classifications.insert(key, classification.clone());
                }
            }
        }
        (None, None) => {
            // Exact source evidence can identify a session even when its summary contains no
            // independently classifiable source sport reference.
        }
        _ => {
            return Err(ApplicationError::SportClassificationQuery(
                "sport reference and classification availability disagree".to_owned(),
            ));
        }
    }
    Ok(())
}

fn parse_local_date(value: &str) -> Result<NaiveDate, ApplicationError> {
    let parsed = NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|_| {
        ApplicationError::SportClassificationQuery("detected sport date is invalid".to_owned())
    })?;
    if parsed.format("%Y-%m-%d").to_string() != value {
        return Err(ApplicationError::SportClassificationQuery(
            "detected sport date is not canonical".to_owned(),
        ));
    }
    Ok(parsed)
}

fn map_detected_sport(record: DetectedTrainingSport, source_index: usize) -> TrainingSport {
    let DetectedTrainingSport {
        session_filter_ref,
        sport_ref,
        classification,
        recognition_candidates,
        first_local_date,
        last_local_date,
        session_count,
        total_duration_milliseconds,
        distance_session_count,
        heart_rate_session_count,
        ..
    } = record;
    let (state, classification, recognition, recognition_candidate_count) = match classification {
        Some(classification) => {
            let resolved = resolve_sport_identity(&classification, recognition_candidates);
            let state = map_identity_state(resolved.state());
            let recognition = resolved.recognized_suggestion().map(map_recognition);
            let candidate_count = resolved.candidate_count();
            (
                state,
                Some(map_classification(&classification)),
                recognition,
                candidate_count,
            )
        }
        None => {
            let candidate_count = recognition_candidates.len();
            let state = match candidate_count {
                0 => TrainingSportState::Unavailable,
                1 => TrainingSportState::Recognized,
                _ => TrainingSportState::Ambiguous,
            };
            let recognition =
                (candidate_count == 1).then(|| map_recognition(&recognition_candidates[0]));
            (state, None, recognition, candidate_count)
        }
    };
    TrainingSport {
        member_session_filter_refs: vec![session_filter_ref.clone()],
        session_filter_ref,
        sport_ref,
        source_index,
        state,
        classification,
        recognition,
        recognition_candidate_count,
        unification: None,
        first_local_date,
        last_local_date,
        coverage: TrainingSportCoverage {
            session_count,
            total_duration_milliseconds,
            distance_session_count,
            heart_rate_session_count,
        },
    }
}

fn project_unified_sports(
    sports: Vec<TrainingSport>,
    relationships: Vec<UnifiedSportRelationship>,
) -> Result<(Vec<TrainingSport>, Vec<TrainingSportUnificationReview>), ApplicationError> {
    let mut sports_by_ref = sports
        .into_iter()
        .map(|sport| (sport.session_filter_ref.clone(), sport))
        .collect::<BTreeMap<_, _>>();
    let mut claimed_members = BTreeSet::new();
    let mut projected = Vec::new();
    let mut reviews = Vec::new();
    let mut seen_relationship_refs = BTreeSet::new();

    for relationship in relationships {
        if !seen_relationship_refs.insert(relationship.relationship_ref().to_owned()) {
            return Err(ApplicationError::SportClassificationQuery(
                "unified sport relationship is duplicated".to_owned(),
            ));
        }
        for member in relationship.member_session_filter_refs() {
            if !claimed_members.insert(member.clone()) {
                return Err(ApplicationError::SportClassificationQuery(
                    "represented sport belongs to overlapping relationships".to_owned(),
                ));
            }
        }
        let unification = map_unification(&relationship);
        let missing_member_session_filter_refs = relationship
            .member_session_filter_refs()
            .iter()
            .filter(|member| !sports_by_ref.contains_key(*member))
            .cloned()
            .collect::<Vec<_>>();
        if !missing_member_session_filter_refs.is_empty() {
            reviews.push(TrainingSportUnificationReview {
                relationship: unification,
                reason: TrainingSportUnificationReviewReason::MissingMember,
                missing_member_session_filter_refs,
            });
            continue;
        }
        let primary = sports_by_ref
            .get(relationship.primary_session_filter_ref())
            .ok_or_else(|| {
                ApplicationError::SportClassificationQuery(
                    "unified sport primary collection is missing".to_owned(),
                )
            })?;
        if !usable_unification_primary(primary) {
            reviews.push(TrainingSportUnificationReview {
                relationship: unification,
                reason: TrainingSportUnificationReviewReason::UnusablePrimary,
                missing_member_session_filter_refs: Vec::new(),
            });
            continue;
        }

        let mut merged = primary.clone();
        merged.session_filter_ref = relationship.relationship_ref().to_owned();
        merged.member_session_filter_refs = relationship.member_session_filter_refs().to_vec();
        merged.unification = Some(unification);
        merged.first_local_date = relationship
            .member_session_filter_refs()
            .iter()
            .filter_map(|member| sports_by_ref.get(member))
            .map(|sport| sport.first_local_date.clone())
            .min()
            .ok_or_else(|| {
                ApplicationError::SportClassificationQuery(
                    "unified sport relationship has no represented members".to_owned(),
                )
            })?;
        merged.last_local_date = relationship
            .member_session_filter_refs()
            .iter()
            .filter_map(|member| sports_by_ref.get(member))
            .map(|sport| sport.last_local_date.clone())
            .max()
            .ok_or_else(|| {
                ApplicationError::SportClassificationQuery(
                    "unified sport relationship has no represented members".to_owned(),
                )
            })?;
        merged.coverage = merge_unified_coverage(&sports_by_ref, &relationship)?;
        for member in relationship.member_session_filter_refs() {
            sports_by_ref.remove(member);
        }
        projected.push(merged);
    }

    projected.extend(sports_by_ref.into_values());
    Ok((projected, reviews))
}

fn usable_unification_primary(sport: &TrainingSport) -> bool {
    matches!(
        sport.state,
        TrainingSportState::Recognized | TrainingSportState::PersonallyOverridden
    )
}

fn merge_unified_coverage(
    sports_by_ref: &BTreeMap<String, TrainingSport>,
    relationship: &UnifiedSportRelationship,
) -> Result<TrainingSportCoverage, ApplicationError> {
    relationship.member_session_filter_refs().iter().try_fold(
        TrainingSportCoverage {
            session_count: 0,
            total_duration_milliseconds: 0,
            distance_session_count: 0,
            heart_rate_session_count: 0,
        },
        |mut coverage, member| {
            let current = &sports_by_ref[member].coverage;
            coverage.session_count = coverage
                .session_count
                .checked_add(current.session_count)
                .ok_or_else(|| unification_overflow("session"))?;
            coverage.total_duration_milliseconds = coverage
                .total_duration_milliseconds
                .checked_add(current.total_duration_milliseconds)
                .ok_or_else(|| unification_overflow("duration"))?;
            coverage.distance_session_count = coverage
                .distance_session_count
                .checked_add(current.distance_session_count)
                .ok_or_else(|| unification_overflow("distance"))?;
            coverage.heart_rate_session_count = coverage
                .heart_rate_session_count
                .checked_add(current.heart_rate_session_count)
                .ok_or_else(|| unification_overflow("heart-rate"))?;
            Ok(coverage)
        },
    )
}

fn unification_overflow(kind: &str) -> ApplicationError {
    ApplicationError::SportClassificationQuery(format!("unified sport {kind} coverage overflowed"))
}

fn map_unification(relationship: &UnifiedSportRelationship) -> TrainingSportUnification {
    TrainingSportUnification {
        relationship_ref: relationship.relationship_ref().to_owned(),
        primary_session_filter_ref: relationship.primary_session_filter_ref().to_owned(),
        member_session_filter_refs: relationship.member_session_filter_refs().to_vec(),
        authorship: match relationship.authorship() {
            UnifiedSportRelationshipAuthorship::User => "user".to_owned(),
        },
        revision: relationship.revision(),
    }
}

pub fn resolve_training_session_sport(
    sport_ref: Option<String>,
    classification: Option<SportClassification>,
    recognition_candidates: Vec<ProviderNeutralSportSuggestion>,
) -> Result<TrainingSessionSport, ApplicationError> {
    match (sport_ref, classification) {
        (None, None) => {
            let recognition_candidate_count = recognition_candidates.len();
            let state = match recognition_candidate_count {
                0 => TrainingSportState::Unavailable,
                1 => TrainingSportState::Recognized,
                _ => TrainingSportState::Ambiguous,
            };
            let recognition = (recognition_candidate_count == 1)
                .then(|| map_recognition(&recognition_candidates[0]));
            Ok(TrainingSessionSport {
                sport_ref: None,
                state,
                classification: None,
                recognition,
                recognition_candidate_count,
            })
        }
        (Some(sport_ref), Some(classification)) => {
            let resolved = resolve_sport_identity(&classification, recognition_candidates);
            let state = map_identity_state(resolved.state());
            let recognition = resolved.recognized_suggestion().map(map_recognition);
            let recognition_candidate_count = resolved.candidate_count();
            Ok(TrainingSessionSport {
                sport_ref: Some(sport_ref),
                state,
                classification: Some(map_classification(&classification)),
                recognition,
                recognition_candidate_count,
            })
        }
        _ => Err(ApplicationError::SportClassificationQuery(
            "sport identity evidence is inconsistent".to_owned(),
        )),
    }
}

fn map_identity_state(state: SportIdentityState) -> TrainingSportState {
    match state {
        SportIdentityState::Recognized => TrainingSportState::Recognized,
        SportIdentityState::Ambiguous => TrainingSportState::Ambiguous,
        SportIdentityState::Unknown => TrainingSportState::Unknown,
        SportIdentityState::PersonallyOverridden => TrainingSportState::PersonallyOverridden,
    }
}

fn map_classification(classification: &SportClassification) -> TrainingSportClassification {
    TrainingSportClassification {
        scope: match classification.scope() {
            SportClassificationScope::UnresolvedSourceProfile => {
                TrainingSportClassificationScope::UnresolvedSourceProfile
            }
        },
        canonical_family: classification
            .canonical_family()
            .map(SportFamily::as_code)
            .map(str::to_owned),
        display_label: classification.display_label().map(str::to_owned),
        authorship: classification
            .authorship()
            .map(|authorship| match authorship {
                SportClassificationAuthorship::User => "user".to_owned(),
            }),
        revision: classification.revision(),
    }
}

fn map_recognition(suggestion: &ProviderNeutralSportSuggestion) -> TrainingSportRecognition {
    TrainingSportRecognition {
        canonical_family: suggestion
            .canonical_family()
            .map(SportFamily::as_code)
            .map(str::to_owned),
        localized_names: suggestion
            .localized_names()
            .iter()
            .map(|name| (name.language_tag().to_owned(), name.value().to_owned()))
            .collect(),
        catalogue_revision: suggestion.provenance().catalogue_revision().to_owned(),
        retrieved_at_utc: suggestion.provenance().retrieved_at_utc().to_owned(),
        mapping_version: suggestion.provenance().mapping_version().to_owned(),
        evidence_ref: suggestion.provenance().evidence_ref().to_owned(),
    }
}

fn sport_sort_key(sport: &TrainingSport) -> (u8, String, String, usize, String, String) {
    let state = match sport.state {
        TrainingSportState::PersonallyOverridden => 0,
        TrainingSportState::Recognized => 1,
        TrainingSportState::Ambiguous => 2,
        TrainingSportState::Unknown => 3,
        TrainingSportState::Unavailable => 4,
    };
    let (family, label) = match sport.state {
        TrainingSportState::PersonallyOverridden => (
            sport
                .classification
                .as_ref()
                .and_then(|classification| classification.canonical_family.clone())
                .unwrap_or_default(),
            sport
                .classification
                .as_ref()
                .and_then(|classification| classification.display_label.clone())
                .unwrap_or_default(),
        ),
        TrainingSportState::Recognized => (
            sport
                .recognition
                .as_ref()
                .and_then(|recognition| recognition.canonical_family.clone())
                .unwrap_or_default(),
            sport
                .recognition
                .as_ref()
                .map(|recognition| {
                    recognition.localized_names.iter().fold(
                        String::new(),
                        |mut key, (language_tag, name)| {
                            key.push_str(language_tag);
                            key.push('\0');
                            key.push_str(name);
                            key.push('\0');
                            key
                        },
                    )
                })
                .unwrap_or_default(),
        ),
        TrainingSportState::Ambiguous
        | TrainingSportState::Unknown
        | TrainingSportState::Unavailable => (String::new(), String::new()),
    };
    (
        state,
        family,
        label,
        sport.source_index,
        sport.sport_ref.clone().unwrap_or_default(),
        sport.session_filter_ref.clone(),
    )
}

fn invalid_classification(_error: SportClassificationError) -> ApplicationError {
    ApplicationError::InvalidSportClassification("classification values are invalid")
}

fn invalid_unification(_error: UnifiedSportRelationshipError) -> ApplicationError {
    ApplicationError::InvalidSportUnification("relationship values are invalid")
}
