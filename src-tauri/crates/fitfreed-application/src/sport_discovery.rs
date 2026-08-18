use std::collections::{BTreeMap, BTreeSet};

use chrono::NaiveDate;
use fitfreed_domain::{
    author_sport_classification, SportClassification, SportClassificationAuthorship,
    SportClassificationError, SportClassificationState, SportFamily,
};

use crate::ApplicationError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DetectedTrainingSport {
    pub sport_ref: Option<String>,
    pub origin_id: String,
    pub classification: Option<SportClassification>,
    pub first_local_date: String,
    pub last_local_date: String,
    pub session_count: usize,
    pub total_duration_milliseconds: i128,
    pub distance_session_count: usize,
    pub heart_rate_session_count: usize,
}

pub trait TrainingSportsPort {
    fn query_detected_training_sports(&self) -> Result<Vec<DetectedTrainingSport>, String>;

    fn find_detected_training_sport(
        &self,
        sport_ref: &str,
    ) -> Result<Option<DetectedTrainingSport>, String>;

    fn compare_and_save_sport_classification(
        &self,
        expected_revision: u64,
        classification: &SportClassification,
    ) -> Result<bool, String>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrainingSportState {
    Unknown,
    Classified,
    Unavailable,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSportClassification {
    pub canonical_family: Option<String>,
    pub display_label: Option<String>,
    pub authorship: Option<String>,
    pub revision: u64,
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
    pub sport_ref: Option<String>,
    pub source_index: usize,
    pub state: TrainingSportState,
    pub classification: Option<TrainingSportClassification>,
    pub first_local_date: String,
    pub last_local_date: String,
    pub coverage: TrainingSportCoverage,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingSportsOverview {
    pub origin_count: usize,
    pub session_count: usize,
    pub sports: Vec<TrainingSport>,
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

pub fn query_training_sports(
    port: &dyn TrainingSportsPort,
) -> Result<TrainingSportsOverview, ApplicationError> {
    let records = port
        .query_detected_training_sports()
        .map_err(ApplicationError::SportClassificationQuery)?;
    build_training_sports_overview(records)
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
    let record = port
        .find_detected_training_sport(&request.sport_ref)
        .map_err(ApplicationError::SportClassificationQuery)?
        .ok_or(ApplicationError::InvalidSportClassification(
            "sport reference is not available",
        ))?;
    if record.sport_ref.as_deref() != Some(request.sport_ref.as_str()) {
        return Err(ApplicationError::SportClassificationQuery(
            "sport query returned a different reference".to_owned(),
        ));
    }
    validate_detected_sport(
        &record,
        &mut BTreeSet::new(),
        &mut BTreeSet::new(),
        &mut BTreeSet::new(),
    )?;
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
    let saved_sport_remains_discoverable = overview
        .sports
        .iter()
        .any(|sport| sport.sport_ref.as_deref() == Some(request.sport_ref.as_str()));
    if !saved_sport_remains_discoverable {
        return Err(ApplicationError::SportClassificationQuery(
            "saved sport disappeared from discovery".to_owned(),
        ));
    }
    Ok(SavedTrainingSportClassification { outcome, overview })
}

fn build_training_sports_overview(
    records: Vec<DetectedTrainingSport>,
) -> Result<TrainingSportsOverview, ApplicationError> {
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
    let mut seen_sport_refs = BTreeSet::new();
    let mut seen_classification_keys = BTreeSet::new();
    let mut seen_unavailable_origins = BTreeSet::new();
    let mut session_count = 0_usize;
    let mut sports = Vec::with_capacity(records.len());
    for record in records {
        validate_detected_sport(
            &record,
            &mut seen_sport_refs,
            &mut seen_classification_keys,
            &mut seen_unavailable_origins,
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
    sports.sort_by_key(sport_sort_key);
    Ok(TrainingSportsOverview {
        origin_count: origins.len(),
        session_count,
        sports,
    })
}

fn validate_detected_sport(
    record: &DetectedTrainingSport,
    seen_sport_refs: &mut BTreeSet<String>,
    seen_classification_keys: &mut BTreeSet<(String, String)>,
    seen_unavailable_origins: &mut BTreeSet<String>,
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
    match (&record.sport_ref, &record.classification) {
        (Some(sport_ref), Some(classification)) => {
            if sport_ref.is_empty() || !seen_sport_refs.insert(sport_ref.clone()) {
                return Err(ApplicationError::SportClassificationQuery(
                    "detected sport reference is empty or duplicated".to_owned(),
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
            if !seen_classification_keys.insert(key) {
                return Err(ApplicationError::SportClassificationQuery(
                    "detected sport classification is duplicated".to_owned(),
                ));
            }
        }
        (None, None) => {
            if !seen_unavailable_origins.insert(record.origin_id.clone()) {
                return Err(ApplicationError::SportClassificationQuery(
                    "unavailable sport group is duplicated for its origin".to_owned(),
                ));
            }
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
    let (state, classification) =
        record
            .classification
            .map_or((TrainingSportState::Unavailable, None), |classification| {
                let state = match classification.state() {
                    SportClassificationState::Unknown => TrainingSportState::Unknown,
                    SportClassificationState::Classified => TrainingSportState::Classified,
                };
                let classification = TrainingSportClassification {
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
                };
                (state, Some(classification))
            });
    TrainingSport {
        sport_ref: record.sport_ref,
        source_index,
        state,
        classification,
        first_local_date: record.first_local_date,
        last_local_date: record.last_local_date,
        coverage: TrainingSportCoverage {
            session_count: record.session_count,
            total_duration_milliseconds: record.total_duration_milliseconds,
            distance_session_count: record.distance_session_count,
            heart_rate_session_count: record.heart_rate_session_count,
        },
    }
}

fn sport_sort_key(sport: &TrainingSport) -> (u8, String, String, usize, String) {
    let state = match sport.state {
        TrainingSportState::Classified => 0,
        TrainingSportState::Unknown => 1,
        TrainingSportState::Unavailable => 2,
    };
    let family = sport
        .classification
        .as_ref()
        .and_then(|classification| classification.canonical_family.clone())
        .unwrap_or_default();
    let label = sport
        .classification
        .as_ref()
        .and_then(|classification| classification.display_label.clone())
        .unwrap_or_default();
    (
        state,
        family,
        label,
        sport.source_index,
        sport.sport_ref.clone().unwrap_or_default(),
    )
}

fn invalid_classification(_error: SportClassificationError) -> ApplicationError {
    ApplicationError::InvalidSportClassification("classification values are invalid")
}
