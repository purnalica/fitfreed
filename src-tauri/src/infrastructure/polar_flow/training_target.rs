use std::collections::{BTreeMap, BTreeSet};

use chrono::{NaiveDateTime, Timelike};
use fitfreed_domain::{
    PlannedTrainingCompletion, PlannedTrainingEditability, PlannedTrainingExercise,
    PlannedTrainingExerciseKind, PlannedTrainingIntensity, PlannedTrainingIntensityMetric,
    PlannedTrainingMappingCoverage, PlannedTrainingPhase, PlannedTrainingPhaseChange,
    PlannedTrainingPhaseGoal, PlannedTrainingRepeat, PlannedTrainingSport, PlannedTrainingTarget,
    PlannedTrainingTargetKind, PlannedTrainingTransition, ProviderNeutralSportSuggestion,
    SportFamily, SportLocalizedName, SportRecognitionProvenance,
};
use serde::Deserialize;
use serde_json::Value;
use sha2::{Digest, Sha256};

use super::super::iso_duration::parse_iso_duration_milliseconds;
use super::super::SourceOptional;

const MAX_FAVORITE_TARGETS: usize = 10_000;
const MAX_SOURCE_SPORT_CODE_BYTES: usize = 128;
const MAX_SOURCE_EXPORT_VERSION_BYTES: usize = 64;
const MAX_SOURCE_REPEAT_COUNT: u16 = 99;

pub(in crate::infrastructure) struct PlannedTrainingMappingContext {
    pub origin_id: String,
    pub artifact_locator: String,
    pub artifact_sha256: String,
    pub catalogue_revision: String,
    pub catalogue_retrieved_at_utc: String,
    pub sport_mapping_version: String,
    pub sport_mapping: fn(&str) -> Option<PlannedTrainingSportMapping>,
}

#[derive(Debug, Clone, Copy)]
pub(in crate::infrastructure) struct PlannedTrainingSportMapping {
    pub canonical_family: Option<SportFamily>,
    pub english_name: &'static str,
    pub spanish_name: &'static str,
}

#[derive(Debug)]
pub(in crate::infrastructure) struct PlannedTrainingSourceBatch {
    pub origin_id: String,
    pub artifact_locator: String,
    pub artifact_sha256: String,
    pub records: Vec<PlannedTrainingSourceRecord>,
    pub favorite_snapshot_ref: Option<String>,
    pub completed_sport_evidence: Vec<CompletedTrainingTargetSportEvidence>,
}

#[derive(Debug)]
pub(in crate::infrastructure) struct PlannedTrainingSourceRecord {
    pub target: PlannedTrainingTarget,
    pub source_identity: String,
    pub source_record_locator: String,
    pub artifact_locator: String,
    pub artifact_sha256: String,
    pub export_version: String,
    pub unmapped_field_locators: Vec<String>,
    pub source_sport_evidence: Vec<PlannedTrainingSourceSportEvidence>,
}

#[derive(Debug)]
pub(in crate::infrastructure) struct PlannedTrainingSourceSportEvidence {
    pub exercise_ordinal: usize,
    pub source_record_locator: String,
    pub source_sport_code: String,
}

#[derive(Debug)]
pub(in crate::infrastructure) struct CompletedTrainingTargetSportEvidence {
    pub source_record_locator: String,
    pub started_at_local: String,
    pub source_sport_code: String,
    pub export_version: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SourceTarget {
    export_version: String,
    name: String,
    #[serde(default)]
    description: SourceOptional<String>,
    #[serde(default)]
    start_time: SourceOptional<String>,
    #[serde(default)]
    done: SourceOptional<bool>,
    #[serde(default)]
    non_user_editable: SourceOptional<bool>,
    #[serde(default)]
    exercises: SourceOptional<Vec<SourceExercise>>,
    #[serde(flatten)]
    extra: BTreeMap<String, Value>,
}

#[derive(Debug, Deserialize)]
struct SourceExercise {
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    duration: SourceOptional<String>,
    #[serde(default)]
    distance: SourceOptional<f64>,
    #[serde(default)]
    sport: SourceOptional<String>,
    #[serde(default)]
    phases: SourceOptional<Vec<SourcePhase>>,
    #[serde(flatten)]
    extra: BTreeMap<String, Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SourcePhase {
    index: usize,
    name: String,
    change_type: String,
    goal: SourcePhaseGoal,
    intensity: SourcePhaseIntensity,
    #[serde(default)]
    jump_index: SourceOptional<usize>,
    #[serde(default)]
    repeat_count: SourceOptional<u16>,
    #[serde(flatten)]
    extra: BTreeMap<String, Value>,
}

#[derive(Debug, Deserialize)]
struct SourcePhaseGoal {
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    duration: SourceOptional<String>,
    #[serde(default)]
    distance: SourceOptional<f64>,
    #[serde(flatten)]
    extra: BTreeMap<String, Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SourcePhaseIntensity {
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    lower_zone: SourceOptional<u8>,
    #[serde(default)]
    upper_zone: SourceOptional<u8>,
    #[serde(flatten)]
    extra: BTreeMap<String, Value>,
}

pub(in crate::infrastructure) fn decode_scheduled_training_target(
    context: PlannedTrainingMappingContext,
    bytes: &[u8],
) -> Result<PlannedTrainingSourceBatch, String> {
    validate_context(&context)?;
    let raw = serde_json::from_slice::<Value>(bytes)
        .map_err(|error| format!("invalid scheduled training target JSON: {error}"))?;
    if !raw.is_object() {
        return Err("scheduled training target root is not an object".to_owned());
    }
    let mut source = serde_json::from_value::<SourceTarget>(raw.clone())
        .map_err(|error| format!("invalid scheduled training target: {error}"))?;
    let source_identity = scheduled_source_identity(&context.artifact_locator)?;
    let target_id = digest_identifier(
        "planned-target-",
        &[
            "fitfreed:polar-flow:scheduled-training-target:v1",
            &context.origin_id,
            &source_identity,
        ],
    );
    let (scheduled_at_local, completion) = match (
        std::mem::take(&mut source.start_time),
        std::mem::take(&mut source.done),
    ) {
        (SourceOptional::Present(start_time), SourceOptional::Present(done)) => (
            normalize_local_datetime(&start_time)
                .map_err(|reason| format!("invalid scheduled startTime: {reason}"))?,
            if done {
                PlannedTrainingCompletion::Completed
            } else {
                PlannedTrainingCompletion::Pending
            },
        ),
        _ => return Err("scheduled training target requires startTime and done".to_owned()),
    };
    let kind = PlannedTrainingTargetKind::Scheduled {
        scheduled_at_local: scheduled_at_local.clone(),
        completion,
    };
    let mapped = map_target(
        &context,
        source,
        &raw,
        target_id,
        source_identity,
        "/".to_owned(),
        kind,
    )?;
    let completed_sport_evidence = if completion == PlannedTrainingCompletion::Completed {
        completed_sport_evidence(&mapped, &scheduled_at_local)
    } else {
        Vec::new()
    };
    Ok(PlannedTrainingSourceBatch {
        origin_id: context.origin_id,
        artifact_locator: context.artifact_locator,
        artifact_sha256: context.artifact_sha256,
        records: vec![mapped.record],
        favorite_snapshot_ref: None,
        completed_sport_evidence,
    })
}

pub(in crate::infrastructure) fn decode_favourite_training_targets(
    context: PlannedTrainingMappingContext,
    bytes: &[u8],
) -> Result<PlannedTrainingSourceBatch, String> {
    validate_context(&context)?;
    let raw_items = serde_json::from_slice::<Vec<Value>>(bytes)
        .map_err(|error| format!("invalid favorite training target JSON: {error}"))?;
    if raw_items.len() > MAX_FAVORITE_TARGETS {
        return Err("favorite training target count exceeds the supported bound".to_owned());
    }
    let favorite_snapshot_ref = Some(digest_identifier(
        "favorite-snapshot-",
        &[
            "fitfreed:polar-flow:favorite-training-target-snapshot:v1",
            &context.origin_id,
            &context.artifact_sha256,
        ],
    ));
    let mut identity_occurrences = BTreeMap::<String, usize>::new();
    let mut records = Vec::with_capacity(raw_items.len());
    for (ordinal, raw) in raw_items.into_iter().enumerate() {
        if !raw.is_object() {
            return Err(format!(
                "favorite training target /{ordinal} is not an object"
            ));
        }
        let source = serde_json::from_value::<SourceTarget>(raw.clone())
            .map_err(|error| format!("invalid favorite training target /{ordinal}: {error}"))?;
        if !matches!(&source.start_time, SourceOptional::Missing)
            || !matches!(&source.done, SourceOptional::Missing)
            || !matches!(&source.non_user_editable, SourceOptional::Missing)
        {
            return Err(format!(
                "favorite training target /{ordinal} contains scheduled-only fields"
            ));
        }
        let semantic_digest = canonical_value_digest(&raw)?;
        let occurrence = identity_occurrences
            .entry(semantic_digest.clone())
            .and_modify(|value| *value += 1)
            .or_insert(0);
        let source_identity = format!("{semantic_digest}:{occurrence}");
        let target_id = digest_identifier(
            "planned-target-",
            &[
                "fitfreed:polar-flow:favorite-training-target:v1",
                &context.origin_id,
                &source_identity,
            ],
        );
        let mapped = map_target(
            &context,
            source,
            &raw,
            target_id,
            source_identity,
            format!("/{ordinal}"),
            PlannedTrainingTargetKind::FavoriteTemplate,
        )?;
        records.push(mapped.record);
    }
    Ok(PlannedTrainingSourceBatch {
        origin_id: context.origin_id,
        artifact_locator: context.artifact_locator,
        artifact_sha256: context.artifact_sha256,
        records,
        favorite_snapshot_ref,
        completed_sport_evidence: Vec::new(),
    })
}

struct MappedTarget {
    record: PlannedTrainingSourceRecord,
    source_sports: Vec<(usize, String)>,
}

fn map_target(
    context: &PlannedTrainingMappingContext,
    source: SourceTarget,
    raw: &Value,
    target_id: String,
    source_identity: String,
    source_record_locator: String,
    kind: PlannedTrainingTargetKind,
) -> Result<MappedTarget, String> {
    validate_export_version(&source.export_version)?;
    let evidence_revision = digest_identifier(
        "planned-evidence-",
        &[
            "fitfreed:polar-flow:planned-training-source-evidence:v1",
            &canonical_value_digest(raw)?,
        ],
    );
    let mut unmapped = Vec::new();
    collect_extra(&mut unmapped, "", &source.extra);
    let description = source.description.into_option();
    let editability = match source.non_user_editable {
        SourceOptional::Present(true) => PlannedTrainingEditability::NonEditable,
        SourceOptional::Present(false) => PlannedTrainingEditability::Editable,
        SourceOptional::Missing => PlannedTrainingEditability::Unspecified,
    };
    let mut source_sports = Vec::new();
    let exercises = match source.exercises {
        SourceOptional::Missing => None,
        SourceOptional::Present(exercises) => Some(
            exercises
                .into_iter()
                .enumerate()
                .map(|(ordinal, exercise)| {
                    map_exercise(
                        context,
                        &target_id,
                        ordinal,
                        exercise,
                        &mut unmapped,
                        &mut source_sports,
                    )
                })
                .collect::<Result<Vec<_>, _>>()?,
        ),
    };
    let unmapped_count = u32::try_from(unmapped.len())
        .map_err(|_| "unmapped planned-training field count exceeds u32".to_owned())?;
    let mapping_coverage = if unmapped_count == 0 {
        PlannedTrainingMappingCoverage::complete()
    } else {
        PlannedTrainingMappingCoverage::partial(unmapped_count)
            .map_err(|error| error.to_string())?
    };
    let target = PlannedTrainingTarget::restore(
        &context.origin_id,
        target_id,
        evidence_revision,
        kind,
        source.name,
        description,
        editability,
        exercises,
        mapping_coverage,
    )
    .map_err(|error| error.to_string())?;
    Ok(MappedTarget {
        record: PlannedTrainingSourceRecord {
            target,
            source_identity,
            source_record_locator,
            artifact_locator: context.artifact_locator.clone(),
            artifact_sha256: context.artifact_sha256.clone(),
            export_version: source.export_version,
            unmapped_field_locators: unmapped,
            source_sport_evidence: source_sports
                .iter()
                .map(
                    |(exercise_ordinal, source_sport_code)| PlannedTrainingSourceSportEvidence {
                        exercise_ordinal: *exercise_ordinal,
                        source_record_locator: format!("/exercises/{exercise_ordinal}/sport"),
                        source_sport_code: source_sport_code.clone(),
                    },
                )
                .collect(),
        },
        source_sports,
    })
}

fn map_exercise(
    context: &PlannedTrainingMappingContext,
    target_id: &str,
    ordinal: usize,
    source: SourceExercise,
    unmapped: &mut Vec<String>,
    source_sports: &mut Vec<(usize, String)>,
) -> Result<PlannedTrainingExercise, String> {
    let path = format!("/exercises/{ordinal}");
    collect_extra(unmapped, &path, &source.extra);
    let kind = match source.kind.as_str() {
        "FREE" => PlannedTrainingExerciseKind::Open,
        "PHASED" => PlannedTrainingExerciseKind::Phased,
        "VOLUME" => PlannedTrainingExerciseKind::Volume,
        "STRENGTH" => PlannedTrainingExerciseKind::Strength,
        _ => {
            unmapped.push(format!("{path}/type={}", source.kind));
            PlannedTrainingExerciseKind::Unmapped
        }
    };
    let duration_goal_milliseconds = source
        .duration
        .into_option()
        .map(|value| parse_iso_duration_milliseconds(&value))
        .transpose()
        .map_err(|reason| format!("{path}/duration {reason}"))?;
    let distance_goal_meters = source.distance.into_option();
    let (sport, source_sport_code) =
        map_sport(context, target_id, ordinal, source.sport, unmapped)?;
    if let Some(source_sport_code) = source_sport_code {
        source_sports.push((ordinal, source_sport_code));
    }
    let phases = match source.phases {
        SourceOptional::Missing => None,
        SourceOptional::Present(phases) => Some(
            phases
                .into_iter()
                .enumerate()
                .map(|(phase_ordinal, phase)| {
                    map_phase(target_id, ordinal, phase_ordinal, phase, unmapped)
                })
                .collect::<Result<Vec<_>, _>>()?,
        ),
    };
    Ok(PlannedTrainingExercise {
        exercise_id: digest_identifier("planned-exercise-", &[target_id, &ordinal.to_string()]),
        ordinal,
        kind,
        duration_goal_milliseconds,
        distance_goal_meters,
        sport,
        phases,
    })
}

fn map_sport(
    context: &PlannedTrainingMappingContext,
    target_id: &str,
    exercise_ordinal: usize,
    source: SourceOptional<String>,
    unmapped: &mut Vec<String>,
) -> Result<(PlannedTrainingSport, Option<String>), String> {
    let SourceOptional::Present(source_code) = source else {
        return Ok((PlannedTrainingSport::Unavailable, None));
    };
    validate_sport_code(&source_code)?;
    let Some(mapping) = (context.sport_mapping)(&source_code) else {
        unmapped.push(format!("/exercises/{exercise_ordinal}/sport={source_code}"));
        return Ok((PlannedTrainingSport::Unmapped, Some(source_code)));
    };
    let evidence_ref = digest_identifier(
        "sport-evidence-",
        &[
            "fitfreed:polar-flow:planned-training-sport:v1",
            &context.origin_id,
            target_id,
            &exercise_ordinal.to_string(),
            &source_code,
            &context.sport_mapping_version,
        ],
    );
    let provenance = SportRecognitionProvenance::new(
        &context.catalogue_revision,
        &context.catalogue_retrieved_at_utc,
        &context.sport_mapping_version,
        evidence_ref,
    )
    .map_err(|error| error.to_string())?;
    let names = vec![
        SportLocalizedName::new("en", mapping.english_name).map_err(|error| error.to_string())?,
        SportLocalizedName::new("es", mapping.spanish_name).map_err(|error| error.to_string())?,
    ];
    let suggestion =
        ProviderNeutralSportSuggestion::new(mapping.canonical_family, names, provenance)
            .map_err(|error| error.to_string())?;
    Ok((
        PlannedTrainingSport::Recognized(suggestion),
        Some(source_code),
    ))
}

fn map_phase(
    target_id: &str,
    exercise_ordinal: usize,
    ordinal: usize,
    source: SourcePhase,
    unmapped: &mut Vec<String>,
) -> Result<PlannedTrainingPhase, String> {
    let path = format!("/exercises/{exercise_ordinal}/phases/{ordinal}");
    if source.index != ordinal + 1 {
        return Err(format!("{path}/index is not contiguous and one-based"));
    }
    collect_extra(unmapped, &path, &source.extra);
    let change = match source.change_type.as_str() {
        "MANUAL" => PlannedTrainingPhaseChange::Manual,
        "AUTOMATIC" => PlannedTrainingPhaseChange::Automatic,
        _ => {
            unmapped.push(format!("{path}/changeType={}", source.change_type));
            PlannedTrainingPhaseChange::Unmapped
        }
    };
    let goal = map_phase_goal(&path, source.goal, unmapped)?;
    let intensity = map_phase_intensity(&path, source.intensity, unmapped)?;
    let repeat = match (source.jump_index, source.repeat_count) {
        (SourceOptional::Missing, SourceOptional::Missing) => None,
        (SourceOptional::Present(jump_index), SourceOptional::Present(repeat_count)) => {
            if jump_index == 0
                || jump_index > source.index
                || !(1..=MAX_SOURCE_REPEAT_COUNT).contains(&repeat_count)
            {
                return Err(format!("{path} repeat edge is invalid"));
            }
            let total_iterations = repeat_count
                .checked_add(1)
                .ok_or_else(|| format!("{path}/repeatCount overflows"))?;
            Some(PlannedTrainingRepeat {
                repeat_id: digest_identifier(
                    "planned-repeat-",
                    &[
                        target_id,
                        &exercise_ordinal.to_string(),
                        &ordinal.to_string(),
                    ],
                ),
                return_to_phase_ordinal: jump_index - 1,
                total_iterations,
            })
        }
        _ => {
            return Err(format!(
                "{path} requires jumpIndex and repeatCount together"
            ))
        }
    };
    Ok(PlannedTrainingPhase {
        phase_id: digest_identifier(
            "planned-phase-",
            &[
                target_id,
                &exercise_ordinal.to_string(),
                &ordinal.to_string(),
            ],
        ),
        ordinal,
        name: (!source.name.trim().is_empty()).then_some(source.name),
        goal,
        intensity,
        transition: PlannedTrainingTransition {
            transition_id: digest_identifier(
                "planned-transition-",
                &[
                    target_id,
                    &exercise_ordinal.to_string(),
                    &ordinal.to_string(),
                ],
            ),
            change,
            repeat,
        },
    })
}

fn map_phase_goal(
    phase_path: &str,
    source: SourcePhaseGoal,
    unmapped: &mut Vec<String>,
) -> Result<PlannedTrainingPhaseGoal, String> {
    let path = format!("{phase_path}/goal");
    collect_extra(unmapped, &path, &source.extra);
    match source.kind.as_str() {
        "DURATION" => match (source.duration, source.distance) {
            (SourceOptional::Present(duration), SourceOptional::Missing) => {
                parse_iso_duration_milliseconds(&duration)
                    .map(PlannedTrainingPhaseGoal::DurationMilliseconds)
                    .map_err(|reason| format!("{path}/duration {reason}"))
            }
            _ => Err(format!("{path} DURATION fields are invalid")),
        },
        "DISTANCE" => match (source.duration, source.distance) {
            (SourceOptional::Missing, SourceOptional::Present(distance)) => {
                Ok(PlannedTrainingPhaseGoal::DistanceMeters(distance))
            }
            _ => Err(format!("{path} DISTANCE fields are invalid")),
        },
        _ => {
            if matches!(source.duration, SourceOptional::Present(_)) {
                unmapped.push(format!("{path}/duration"));
            }
            if matches!(source.distance, SourceOptional::Present(_)) {
                unmapped.push(format!("{path}/distance"));
            }
            unmapped.push(format!("{path}/type={}", source.kind));
            Ok(PlannedTrainingPhaseGoal::Unmapped)
        }
    }
}

fn map_phase_intensity(
    phase_path: &str,
    source: SourcePhaseIntensity,
    unmapped: &mut Vec<String>,
) -> Result<PlannedTrainingIntensity, String> {
    let path = format!("{phase_path}/intensity");
    collect_extra(unmapped, &path, &source.extra);
    let lower_zone = source.lower_zone.into_option();
    let upper_zone = source.upper_zone.into_option();
    match source.kind.as_str() {
        "NONE" => {
            match (lower_zone, upper_zone) {
                (None, None) | (Some(0), Some(0)) => {}
                _ => {
                    unmapped.push(format!("{path}/lowerZone"));
                    unmapped.push(format!("{path}/upperZone"));
                }
            }
            Ok(PlannedTrainingIntensity::None)
        }
        "HEART_RATE_ZONES" | "SPEED_ZONES" | "POWER_ZONES" => {
            let (lower_zone, upper_zone) = lower_zone
                .zip(upper_zone)
                .ok_or_else(|| format!("{path} zone bounds are missing"))?;
            let metric = match source.kind.as_str() {
                "HEART_RATE_ZONES" => PlannedTrainingIntensityMetric::HeartRate,
                "SPEED_ZONES" => PlannedTrainingIntensityMetric::Speed,
                "POWER_ZONES" => PlannedTrainingIntensityMetric::Power,
                _ => unreachable!("matched supported intensity"),
            };
            Ok(PlannedTrainingIntensity::ZoneRange {
                metric,
                lower_zone,
                upper_zone,
            })
        }
        _ => {
            if lower_zone.is_some() {
                unmapped.push(format!("{path}/lowerZone"));
            }
            if upper_zone.is_some() {
                unmapped.push(format!("{path}/upperZone"));
            }
            unmapped.push(format!("{path}/type={}", source.kind));
            Ok(PlannedTrainingIntensity::Unmapped)
        }
    }
}

fn completed_sport_evidence(
    mapped: &MappedTarget,
    started_at_local: &str,
) -> Vec<CompletedTrainingTargetSportEvidence> {
    let mut encountered = BTreeSet::new();
    mapped
        .source_sports
        .iter()
        .filter(|(_, code)| encountered.insert((*code).clone()))
        .map(|(ordinal, code)| CompletedTrainingTargetSportEvidence {
            source_record_locator: format!("exercises/{ordinal}/sport"),
            started_at_local: started_at_local.to_owned(),
            source_sport_code: code.clone(),
            export_version: mapped.record.export_version.clone(),
        })
        .collect()
}

fn validate_context(context: &PlannedTrainingMappingContext) -> Result<(), String> {
    if context.origin_id.trim().is_empty()
        || context.origin_id.trim() != context.origin_id
        || context.artifact_locator.trim().is_empty()
        || context.artifact_sha256.len() != 64
        || !context
            .artifact_sha256
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return Err("planned-training mapping context is invalid".to_owned());
    }
    Ok(())
}

fn validate_export_version(value: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > MAX_SOURCE_EXPORT_VERSION_BYTES
        || value.trim() != value
        || value.chars().any(char::is_control)
    {
        return Err("training target exportVersion is invalid".to_owned());
    }
    Ok(())
}

fn validate_sport_code(value: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > MAX_SOURCE_SPORT_CODE_BYTES
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_uppercase() || byte == b'_' || byte.is_ascii_digit())
    {
        return Err("training target sport code is invalid".to_owned());
    }
    Ok(())
}

fn scheduled_source_identity(locator: &str) -> Result<String, String> {
    let remainder = locator
        .strip_prefix("training-target-")
        .and_then(|value| value.get(11..))
        .ok_or_else(|| "scheduled training target locator is invalid".to_owned())?;
    let (identity, _) = remainder
        .split_once('-')
        .ok_or_else(|| "scheduled training target locator has no source identity".to_owned())?;
    if identity.is_empty() || !identity.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err("scheduled training target source identity is invalid".to_owned());
    }
    Ok(identity.to_owned())
}

fn normalize_local_datetime(value: &str) -> Result<String, String> {
    let parsed = NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S%.f")
        .map_err(|error| error.to_string())?;
    Ok(if parsed.nanosecond() == 0 {
        parsed.format("%Y-%m-%dT%H:%M:%S").to_string()
    } else {
        parsed.format("%Y-%m-%dT%H:%M:%S%.f").to_string()
    })
}

fn collect_extra(unmapped: &mut Vec<String>, path: &str, extra: &BTreeMap<String, Value>) {
    unmapped.extend(extra.keys().map(|key| format!("{path}/{key}")));
}

fn canonical_value_digest(value: &Value) -> Result<String, String> {
    let encoded = serde_json::to_vec(value)
        .map_err(|error| format!("training target evidence cannot be canonicalized: {error}"))?;
    Ok(format!("{:x}", Sha256::digest(encoded)))
}

fn digest_identifier(prefix: &str, components: &[&str]) -> String {
    let mut digest = Sha256::new();
    for component in components {
        digest.update(component.len().to_be_bytes());
        digest.update(component.as_bytes());
    }
    format!("{prefix}{:x}", digest.finalize())
}
