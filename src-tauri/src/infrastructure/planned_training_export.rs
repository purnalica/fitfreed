use std::{
    collections::BTreeMap,
    fs::{self, File},
    io::{BufReader, Read},
    path::{Path, PathBuf},
};

use fitfreed_application::{
    NormalizedDataExportCancellation, NormalizedDataExportPort, NormalizedDataExportPortError,
    NormalizedDataExportReceipt, PLANNED_TRAINING_EXPORT_SCHEMA_VERSION,
};
use fitfreed_domain::{
    PlannedTrainingCompletion, PlannedTrainingEditability, PlannedTrainingExercise,
    PlannedTrainingExerciseKind, PlannedTrainingIntensity, PlannedTrainingIntensityMetric,
    PlannedTrainingMappingState, PlannedTrainingPhase, PlannedTrainingPhaseChange,
    PlannedTrainingPhaseGoal, PlannedTrainingSport, PlannedTrainingTarget,
    PlannedTrainingTargetKind,
};
use rusqlite::{params, Connection, OpenFlags, Transaction};
use serde::Serialize;
use sha2::{Digest, Sha256};

use super::{
    local_file::PrivateStagingFile, planned_training_store::load_planned_training_target_revision,
    verify_connection_integrity, SCHEMA_VERSION,
};

const EXPORT_FORMAT: &str = "org.fitfreed.normalized-planned-training";

pub struct SqlitePlannedTrainingExporter {
    database_path: PathBuf,
}

impl SqlitePlannedTrainingExporter {
    pub fn new(database_path: impl Into<PathBuf>) -> Self {
        Self {
            database_path: database_path.into(),
        }
    }
}

impl NormalizedDataExportPort for SqlitePlannedTrainingExporter {
    fn export_planned_training(
        &self,
        destination: &Path,
        cancellation: &NormalizedDataExportCancellation,
    ) -> Result<NormalizedDataExportReceipt, NormalizedDataExportPortError> {
        ensure_active(cancellation)?;
        validate_destination(&self.database_path, destination)?;
        let parent = destination
            .parent()
            .ok_or_else(|| failure("normalized export destination has no parent directory"))?;
        let mut connection = Connection::open_with_flags(
            &self.database_path,
            OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )
        .map_err(database_failure)?;
        verify_connection_integrity(&connection, SCHEMA_VERSION)
            .map_err(|_| failure("normalized export source library is invalid"))?;
        let transaction = connection.transaction().map_err(database_failure)?;
        let document = load_document(&transaction, cancellation)?;
        transaction.commit().map_err(database_failure)?;
        ensure_active(cancellation)?;

        let receipt_counts = (
            document.library_revision,
            u64::try_from(document.targets.len())
                .map_err(|_| failure("normalized export target count is too large"))?,
            document.target_revision_count()?,
            u64::try_from(document.favorite_snapshots.len())
                .map_err(|_| failure("normalized export snapshot count is too large"))?,
        );
        let mut staging =
            PrivateStagingFile::new(parent, "fitfreed-planned-training-export", ".json.part")
                .map_err(file_failure)?;
        serde_json::to_writer(staging.file_mut().map_err(file_failure)?, &document)
            .map_err(serialization_failure)?;
        staging.sync_and_close().map_err(file_failure)?;
        ensure_active(cancellation)?;
        let byte_count = fs::metadata(staging.path()).map_err(file_failure)?.len();
        let sha256 = file_sha256(staging.path())?;
        staging.persist_replace(destination).map_err(file_failure)?;
        Ok(NormalizedDataExportReceipt {
            byte_count,
            sha256,
            library_revision: receipt_counts.0,
            target_count: receipt_counts.1,
            target_revision_count: receipt_counts.2,
            favorite_snapshot_count: receipt_counts.3,
        })
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PlannedTrainingExportDocument {
    format: &'static str,
    schema_version: u32,
    library_revision: u64,
    targets: Vec<ExportTarget>,
    favorite_snapshots: Vec<ExportFavoriteSnapshot>,
}

impl PlannedTrainingExportDocument {
    fn target_revision_count(&self) -> Result<u64, NormalizedDataExportPortError> {
        self.targets.iter().try_fold(0_u64, |total, target| {
            let count = u64::try_from(target.revisions.len())
                .map_err(|_| failure("normalized export revision count is too large"))?;
            total
                .checked_add(count)
                .ok_or_else(|| failure("normalized export revision count overflow"))
        })
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportTarget {
    origin_ref: String,
    target_ref: String,
    source: ExportTargetSource,
    current_revision: ExportRevisionReference,
    reconciliation_state: String,
    revisions: Vec<ExportRevision>,
    provenance: Vec<ExportProvenance>,
    conflicts: Vec<ExportConflict>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportTargetSource {
    provider: String,
    kind: String,
    identity: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportRevisionReference {
    evidence_revision: String,
    mapping_version: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportRevision {
    evidence_revision: String,
    mapping_version: String,
    target_kind: String,
    scheduled_at_local: Option<String>,
    completion: Option<String>,
    name: String,
    description: Option<String>,
    editability: String,
    exercises: Option<Vec<ExportExercise>>,
    mapping_coverage: ExportMappingCoverage,
    source_export_version: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportMappingCoverage {
    state: String,
    unmapped_field_count: u32,
    unmapped_field_locators: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportExercise {
    exercise_ref: String,
    ordinal: u64,
    kind: String,
    duration_goal_milliseconds: Option<i64>,
    distance_goal_meters: Option<f64>,
    sport: ExportSport,
    phases: Option<Vec<ExportPhase>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportSport {
    state: String,
    suggestion: Option<ExportSportSuggestion>,
    source_evidence: Vec<ExportSourceSportEvidence>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportSportSuggestion {
    canonical_family: Option<String>,
    localized_names: BTreeMap<String, String>,
    provenance: ExportSportRecognitionProvenance,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportSportRecognitionProvenance {
    catalogue_revision: String,
    retrieved_at_utc: String,
    mapping_version: String,
    evidence_ref: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportSourceSportEvidence {
    provider: String,
    source_code: String,
    source_record_locator: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportPhase {
    phase_ref: String,
    ordinal: u64,
    name: Option<String>,
    goal: ExportPhaseGoal,
    intensity: ExportIntensity,
    transition: ExportTransition,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportPhaseGoal {
    kind: String,
    duration_milliseconds: Option<i64>,
    distance_meters: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportIntensity {
    kind: String,
    metric: Option<String>,
    lower_zone: Option<u8>,
    upper_zone: Option<u8>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportTransition {
    transition_ref: String,
    change: String,
    repeat: Option<ExportRepeat>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportRepeat {
    repeat_ref: String,
    return_to_phase_ordinal: u64,
    total_iterations: u16,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportProvenance {
    operation_ref: String,
    source_provider: String,
    source_adapter_version: String,
    mapping_version: String,
    source_identity: String,
    source_artifact_locator: String,
    source_artifact_sha256: String,
    source_record_locator: String,
    source_export_version: String,
    reconciliation_decision: String,
    contributes_to_visible_state: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportConflict {
    operation_ref: String,
    existing_revision: ExportRevisionReference,
    incoming_revision: ExportRevisionReference,
    source_artifact_locator: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportFavoriteSnapshot {
    origin_ref: String,
    snapshot_ref: String,
    source_provider: String,
    source_adapter_version: String,
    mapping_version: String,
    source_artifact_locator: String,
    source_artifact_sha256: String,
    operation_ref: String,
    current: bool,
    members: Vec<ExportFavoriteMember>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportFavoriteMember {
    ordinal: u64,
    target_ref: String,
    evidence_revision: String,
    mapping_version: String,
}

fn load_document(
    transaction: &Transaction<'_>,
    cancellation: &NormalizedDataExportCancellation,
) -> Result<PlannedTrainingExportDocument, NormalizedDataExportPortError> {
    let library_revision = transaction
        .query_row(
            "SELECT revision FROM planned_training_revision WHERE id = 1",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(database_failure)
        .and_then(|value| non_negative(value, "planned-training library revision"))?;
    Ok(PlannedTrainingExportDocument {
        format: EXPORT_FORMAT,
        schema_version: PLANNED_TRAINING_EXPORT_SCHEMA_VERSION,
        library_revision,
        targets: load_targets(transaction, cancellation)?,
        favorite_snapshots: load_favorite_snapshots(transaction, cancellation)?,
    })
}

fn load_targets(
    transaction: &Transaction<'_>,
    cancellation: &NormalizedDataExportCancellation,
) -> Result<Vec<ExportTarget>, NormalizedDataExportPortError> {
    type Header = (
        String,
        String,
        String,
        String,
        String,
        String,
        String,
        String,
    );
    let mut statement = transaction
        .prepare(
            "SELECT origin_id, target_id, source_provider, source_kind, source_identity,
                    current_evidence_revision, current_mapping_version, reconciliation_state
             FROM planned_training_target
             ORDER BY origin_id, target_id",
        )
        .map_err(database_failure)?;
    let headers = statement
        .query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
            ))
        })
        .map_err(database_failure)?
        .collect::<Result<Vec<Header>, _>>()
        .map_err(database_failure)?;
    headers
        .into_iter()
        .map(|header| {
            ensure_active(cancellation)?;
            Ok(ExportTarget {
                origin_ref: header.0.clone(),
                target_ref: header.1.clone(),
                source: ExportTargetSource {
                    provider: header.2,
                    kind: header.3,
                    identity: header.4,
                },
                current_revision: ExportRevisionReference {
                    evidence_revision: header.5,
                    mapping_version: header.6,
                },
                reconciliation_state: header.7,
                revisions: load_revisions(transaction, &header.0, &header.1)?,
                provenance: load_provenance(transaction, &header.0, &header.1)?,
                conflicts: load_conflicts(transaction, &header.0, &header.1)?,
            })
        })
        .collect()
}

fn load_revisions(
    transaction: &Transaction<'_>,
    origin_ref: &str,
    target_ref: &str,
) -> Result<Vec<ExportRevision>, NormalizedDataExportPortError> {
    let mut statement = transaction
        .prepare(
            "SELECT evidence_revision, mapping_version, source_export_version
             FROM planned_training_target_revision
             WHERE origin_id = ?1 AND target_id = ?2
             ORDER BY evidence_revision, mapping_version",
        )
        .map_err(database_failure)?;
    let keys = statement
        .query_map(params![origin_ref, target_ref], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(database_failure)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(database_failure)?;
    keys.into_iter()
        .map(
            |(evidence_revision, mapping_version, source_export_version)| {
                let target = load_planned_training_target_revision(
                    transaction,
                    origin_ref,
                    target_ref,
                    &evidence_revision,
                    &mapping_version,
                )
                .map_err(|_| failure("normalized export found invalid planned-training state"))?
                .ok_or_else(|| failure("normalized export revision disappeared"))?;
                map_revision(transaction, target, mapping_version, source_export_version)
            },
        )
        .collect()
}

fn map_revision(
    transaction: &Transaction<'_>,
    target: PlannedTrainingTarget,
    mapping_version: String,
    source_export_version: String,
) -> Result<ExportRevision, NormalizedDataExportPortError> {
    let (target_kind, scheduled_at_local, completion) = match target.kind() {
        PlannedTrainingTargetKind::Scheduled {
            scheduled_at_local,
            completion,
        } => (
            "scheduled".to_owned(),
            Some(scheduled_at_local.clone()),
            Some(completion_code(*completion).to_owned()),
        ),
        PlannedTrainingTargetKind::FavoriteTemplate => ("favorite-template".to_owned(), None, None),
    };
    let source_sports = load_source_sports(
        transaction,
        target.origin_id(),
        target.target_id(),
        target.evidence_revision(),
        &mapping_version,
    )?;
    let exercises = target
        .exercises()
        .map(|exercises| {
            exercises
                .iter()
                .map(|exercise| map_exercise(exercise, &source_sports))
                .collect::<Result<Vec<_>, _>>()
        })
        .transpose()?;
    let coverage = target.mapping_coverage();
    let unmapped_field_locators = load_unmapped_fields(
        transaction,
        target.origin_id(),
        target.target_id(),
        target.evidence_revision(),
        &mapping_version,
    )?;
    if usize::try_from(coverage.unmapped_field_count()).ok() != Some(unmapped_field_locators.len())
    {
        return Err(failure(
            "normalized export found inconsistent planned-training mapping coverage",
        ));
    }
    Ok(ExportRevision {
        evidence_revision: target.evidence_revision().to_owned(),
        mapping_version,
        target_kind,
        scheduled_at_local,
        completion,
        name: target.name().to_owned(),
        description: target.description().map(str::to_owned),
        editability: editability_code(target.editability()).to_owned(),
        exercises,
        mapping_coverage: ExportMappingCoverage {
            state: mapping_state_code(coverage.state()).to_owned(),
            unmapped_field_count: coverage.unmapped_field_count(),
            unmapped_field_locators,
        },
        source_export_version,
    })
}

fn map_exercise(
    exercise: &PlannedTrainingExercise,
    source_sports: &BTreeMap<String, Vec<ExportSourceSportEvidence>>,
) -> Result<ExportExercise, NormalizedDataExportPortError> {
    Ok(ExportExercise {
        exercise_ref: exercise.exercise_id.clone(),
        ordinal: u64::try_from(exercise.ordinal)
            .map_err(|_| failure("normalized export exercise ordinal is too large"))?,
        kind: exercise_kind_code(exercise.kind).to_owned(),
        duration_goal_milliseconds: exercise.duration_goal_milliseconds,
        distance_goal_meters: exercise.distance_goal_meters,
        sport: map_sport(
            &exercise.sport,
            source_sports
                .get(&exercise.exercise_id)
                .cloned()
                .unwrap_or_default(),
        ),
        phases: exercise
            .phases
            .as_deref()
            .map(|phases| phases.iter().map(map_phase).collect())
            .transpose()?,
    })
}

fn map_sport(
    sport: &PlannedTrainingSport,
    source_evidence: Vec<ExportSourceSportEvidence>,
) -> ExportSport {
    match sport {
        PlannedTrainingSport::Unavailable => ExportSport {
            state: "unavailable".to_owned(),
            suggestion: None,
            source_evidence,
        },
        PlannedTrainingSport::Unmapped => ExportSport {
            state: "unmapped".to_owned(),
            suggestion: None,
            source_evidence,
        },
        PlannedTrainingSport::Recognized(suggestion) => ExportSport {
            state: "recognized".to_owned(),
            suggestion: Some(ExportSportSuggestion {
                canonical_family: suggestion
                    .canonical_family()
                    .map(|family| family.as_code().to_owned()),
                localized_names: suggestion
                    .localized_names()
                    .iter()
                    .map(|name| (name.language_tag().to_owned(), name.value().to_owned()))
                    .collect(),
                provenance: ExportSportRecognitionProvenance {
                    catalogue_revision: suggestion.provenance().catalogue_revision().to_owned(),
                    retrieved_at_utc: suggestion.provenance().retrieved_at_utc().to_owned(),
                    mapping_version: suggestion.provenance().mapping_version().to_owned(),
                    evidence_ref: suggestion.provenance().evidence_ref().to_owned(),
                },
            }),
            source_evidence,
        },
    }
}

fn map_phase(phase: &PlannedTrainingPhase) -> Result<ExportPhase, NormalizedDataExportPortError> {
    let goal = match phase.goal {
        PlannedTrainingPhaseGoal::DurationMilliseconds(value) => ExportPhaseGoal {
            kind: "duration".to_owned(),
            duration_milliseconds: Some(value),
            distance_meters: None,
        },
        PlannedTrainingPhaseGoal::DistanceMeters(value) => ExportPhaseGoal {
            kind: "distance".to_owned(),
            duration_milliseconds: None,
            distance_meters: Some(value),
        },
        PlannedTrainingPhaseGoal::Unmapped => ExportPhaseGoal {
            kind: "unmapped".to_owned(),
            duration_milliseconds: None,
            distance_meters: None,
        },
    };
    let intensity = match phase.intensity {
        PlannedTrainingIntensity::None => ExportIntensity {
            kind: "none".to_owned(),
            metric: None,
            lower_zone: None,
            upper_zone: None,
        },
        PlannedTrainingIntensity::ZoneRange {
            metric,
            lower_zone,
            upper_zone,
        } => ExportIntensity {
            kind: "zone-range".to_owned(),
            metric: Some(intensity_metric_code(metric).to_owned()),
            lower_zone: Some(lower_zone),
            upper_zone: Some(upper_zone),
        },
        PlannedTrainingIntensity::Unmapped => ExportIntensity {
            kind: "unmapped".to_owned(),
            metric: None,
            lower_zone: None,
            upper_zone: None,
        },
    };
    Ok(ExportPhase {
        phase_ref: phase.phase_id.clone(),
        ordinal: u64::try_from(phase.ordinal)
            .map_err(|_| failure("normalized export phase ordinal is too large"))?,
        name: phase.name.clone(),
        goal,
        intensity,
        transition: ExportTransition {
            transition_ref: phase.transition.transition_id.clone(),
            change: phase_change_code(phase.transition.change).to_owned(),
            repeat: phase
                .transition
                .repeat
                .as_ref()
                .map(|repeat| {
                    Ok(ExportRepeat {
                        repeat_ref: repeat.repeat_id.clone(),
                        return_to_phase_ordinal: u64::try_from(repeat.return_to_phase_ordinal)
                            .map_err(|_| {
                                failure("normalized export repeat ordinal is too large")
                            })?,
                        total_iterations: repeat.total_iterations,
                    })
                })
                .transpose()?,
        },
    })
}

fn load_unmapped_fields(
    transaction: &Transaction<'_>,
    origin_ref: &str,
    target_ref: &str,
    evidence_revision: &str,
    mapping_version: &str,
) -> Result<Vec<String>, NormalizedDataExportPortError> {
    let mut statement = transaction
        .prepare(
            "SELECT source_field_locator
             FROM planned_training_unmapped_field
             WHERE origin_id = ?1 AND target_id = ?2
               AND evidence_revision = ?3 AND mapping_version = ?4
             ORDER BY ordinal",
        )
        .map_err(database_failure)?;
    let fields = statement
        .query_map(
            params![origin_ref, target_ref, evidence_revision, mapping_version],
            |row| row.get::<_, String>(0),
        )
        .map_err(database_failure)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(database_failure)?;
    Ok(fields)
}

fn load_source_sports(
    transaction: &Transaction<'_>,
    origin_ref: &str,
    target_ref: &str,
    evidence_revision: &str,
    mapping_version: &str,
) -> Result<BTreeMap<String, Vec<ExportSourceSportEvidence>>, NormalizedDataExportPortError> {
    let mut statement = transaction
        .prepare(
            "SELECT exercise_id, source_provider, source_sport_code, source_record_locator
             FROM planned_training_source_sport_evidence
             WHERE origin_id = ?1 AND target_id = ?2
               AND evidence_revision = ?3 AND mapping_version = ?4
             ORDER BY exercise_id, source_provider",
        )
        .map_err(database_failure)?;
    let rows = statement
        .query_map(
            params![origin_ref, target_ref, evidence_revision, mapping_version],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    ExportSourceSportEvidence {
                        provider: row.get(1)?,
                        source_code: row.get(2)?,
                        source_record_locator: row.get(3)?,
                    },
                ))
            },
        )
        .map_err(database_failure)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(database_failure)?;
    let mut evidence = BTreeMap::<String, Vec<ExportSourceSportEvidence>>::new();
    for (exercise_ref, item) in rows {
        evidence.entry(exercise_ref).or_default().push(item);
    }
    Ok(evidence)
}

fn load_provenance(
    transaction: &Transaction<'_>,
    origin_ref: &str,
    target_ref: &str,
) -> Result<Vec<ExportProvenance>, NormalizedDataExportPortError> {
    let mut statement = transaction
        .prepare(
            "SELECT operation.operation_ref, provenance.source_provider,
                    provenance.source_adapter_version, provenance.mapping_version,
                    provenance.source_identity, provenance.source_artifact_locator,
                    provenance.source_artifact_sha256, provenance.source_record_locator,
                    provenance.source_export_version, provenance.reconciliation_decision,
                    provenance.contributes_to_visible_state
             FROM planned_training_target_provenance provenance
             JOIN import_operation operation ON operation.id = provenance.import_operation_id
             WHERE provenance.origin_id = ?1 AND provenance.target_id = ?2
             ORDER BY provenance.import_operation_id, provenance.id",
        )
        .map_err(database_failure)?;
    let provenance = statement
        .query_map(params![origin_ref, target_ref], |row| {
            Ok(ExportProvenance {
                operation_ref: row.get(0)?,
                source_provider: row.get(1)?,
                source_adapter_version: row.get(2)?,
                mapping_version: row.get(3)?,
                source_identity: row.get(4)?,
                source_artifact_locator: row.get(5)?,
                source_artifact_sha256: row.get(6)?,
                source_record_locator: row.get(7)?,
                source_export_version: row.get(8)?,
                reconciliation_decision: row.get(9)?,
                contributes_to_visible_state: row.get(10)?,
            })
        })
        .map_err(database_failure)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(database_failure)?;
    Ok(provenance)
}

fn load_conflicts(
    transaction: &Transaction<'_>,
    origin_ref: &str,
    target_ref: &str,
) -> Result<Vec<ExportConflict>, NormalizedDataExportPortError> {
    let mut statement = transaction
        .prepare(
            "SELECT operation.operation_ref, conflict.existing_evidence_revision,
                    conflict.existing_mapping_version, conflict.incoming_evidence_revision,
                    conflict.incoming_mapping_version, conflict.source_artifact_locator
             FROM planned_training_conflict conflict
             JOIN import_operation operation ON operation.id = conflict.import_operation_id
             WHERE conflict.origin_id = ?1 AND conflict.target_id = ?2
             ORDER BY conflict.import_operation_id, conflict.id",
        )
        .map_err(database_failure)?;
    let conflicts = statement
        .query_map(params![origin_ref, target_ref], |row| {
            Ok(ExportConflict {
                operation_ref: row.get(0)?,
                existing_revision: ExportRevisionReference {
                    evidence_revision: row.get(1)?,
                    mapping_version: row.get(2)?,
                },
                incoming_revision: ExportRevisionReference {
                    evidence_revision: row.get(3)?,
                    mapping_version: row.get(4)?,
                },
                source_artifact_locator: row.get(5)?,
            })
        })
        .map_err(database_failure)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(database_failure)?;
    Ok(conflicts)
}

fn load_favorite_snapshots(
    transaction: &Transaction<'_>,
    cancellation: &NormalizedDataExportCancellation,
) -> Result<Vec<ExportFavoriteSnapshot>, NormalizedDataExportPortError> {
    type Header = (
        String,
        String,
        String,
        String,
        String,
        String,
        String,
        String,
        bool,
    );
    let mut statement = transaction
        .prepare(
            "SELECT snapshot.origin_id, snapshot.snapshot_ref, snapshot.source_provider,
                    snapshot.source_adapter_version, snapshot.mapping_version,
                    snapshot.source_artifact_locator, snapshot.source_artifact_sha256,
                    operation.operation_ref,
                    snapshot.import_operation_id = (
                        SELECT MAX(recent.import_operation_id)
                        FROM planned_training_favorite_snapshot recent
                        WHERE recent.origin_id = snapshot.origin_id
                    )
             FROM planned_training_favorite_snapshot snapshot
             JOIN import_operation operation ON operation.id = snapshot.import_operation_id
             ORDER BY snapshot.origin_id, snapshot.import_operation_id, snapshot.snapshot_ref",
        )
        .map_err(database_failure)?;
    let headers = statement
        .query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
                row.get(8)?,
            ))
        })
        .map_err(database_failure)?
        .collect::<Result<Vec<Header>, _>>()
        .map_err(database_failure)?;
    headers
        .into_iter()
        .map(|header| {
            ensure_active(cancellation)?;
            Ok(ExportFavoriteSnapshot {
                origin_ref: header.0.clone(),
                snapshot_ref: header.1.clone(),
                source_provider: header.2,
                source_adapter_version: header.3,
                mapping_version: header.4,
                source_artifact_locator: header.5,
                source_artifact_sha256: header.6,
                operation_ref: header.7,
                current: header.8,
                members: load_favorite_members(transaction, &header.0, &header.1)?,
            })
        })
        .collect()
}

fn load_favorite_members(
    transaction: &Transaction<'_>,
    origin_ref: &str,
    snapshot_ref: &str,
) -> Result<Vec<ExportFavoriteMember>, NormalizedDataExportPortError> {
    let mut statement = transaction
        .prepare(
            "SELECT ordinal, target_id, evidence_revision, mapping_version
             FROM planned_training_favorite_snapshot_membership
             WHERE origin_id = ?1 AND snapshot_ref = ?2
             ORDER BY ordinal",
        )
        .map_err(database_failure)?;
    let members = statement
        .query_map(params![origin_ref, snapshot_ref], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })
        .map_err(database_failure)?
        .map(|row| {
            let (ordinal, target_ref, evidence_revision, mapping_version) =
                row.map_err(database_failure)?;
            Ok(ExportFavoriteMember {
                ordinal: non_negative(ordinal, "favorite membership ordinal")?,
                target_ref,
                evidence_revision,
                mapping_version,
            })
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(members)
}

fn validate_destination(
    database_path: &Path,
    destination: &Path,
) -> Result<(), NormalizedDataExportPortError> {
    if database_path == destination {
        return Err(failure(
            "normalized export destination must differ from the source library",
        ));
    }
    let parent = destination
        .parent()
        .ok_or_else(|| failure("normalized export destination has no parent directory"))?;
    if !parent.is_dir() {
        return Err(failure(
            "normalized export destination parent is not a directory",
        ));
    }
    if let Ok(metadata) = fs::symlink_metadata(destination) {
        if !metadata.file_type().is_file() {
            return Err(failure(
                "normalized export destination is not a regular file",
            ));
        }
    }
    Ok(())
}

fn file_sha256(path: &Path) -> Result<String, NormalizedDataExportPortError> {
    let mut reader = BufReader::new(File::open(path).map_err(file_failure)?);
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = reader.read(&mut buffer).map_err(file_failure)?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }
    Ok(format!("{:x}", digest.finalize()))
}

fn non_negative(value: i64, field: &'static str) -> Result<u64, NormalizedDataExportPortError> {
    u64::try_from(value).map_err(|_| failure(format!("{field} is invalid")))
}

fn completion_code(value: PlannedTrainingCompletion) -> &'static str {
    match value {
        PlannedTrainingCompletion::Pending => "pending",
        PlannedTrainingCompletion::Completed => "completed",
    }
}

fn editability_code(value: PlannedTrainingEditability) -> &'static str {
    match value {
        PlannedTrainingEditability::Editable => "editable",
        PlannedTrainingEditability::NonEditable => "non-editable",
        PlannedTrainingEditability::Unspecified => "unspecified",
    }
}

fn mapping_state_code(value: PlannedTrainingMappingState) -> &'static str {
    match value {
        PlannedTrainingMappingState::Complete => "complete",
        PlannedTrainingMappingState::Partial => "partial",
    }
}

fn exercise_kind_code(value: PlannedTrainingExerciseKind) -> &'static str {
    match value {
        PlannedTrainingExerciseKind::Open => "open",
        PlannedTrainingExerciseKind::Phased => "phased",
        PlannedTrainingExerciseKind::Volume => "volume",
        PlannedTrainingExerciseKind::Strength => "strength",
        PlannedTrainingExerciseKind::Unmapped => "unmapped",
    }
}

fn intensity_metric_code(value: PlannedTrainingIntensityMetric) -> &'static str {
    match value {
        PlannedTrainingIntensityMetric::HeartRate => "heart-rate",
        PlannedTrainingIntensityMetric::Speed => "speed",
        PlannedTrainingIntensityMetric::Power => "power",
    }
}

fn phase_change_code(value: PlannedTrainingPhaseChange) -> &'static str {
    match value {
        PlannedTrainingPhaseChange::Manual => "manual",
        PlannedTrainingPhaseChange::Automatic => "automatic",
        PlannedTrainingPhaseChange::Unmapped => "unmapped",
    }
}

fn ensure_active(
    cancellation: &NormalizedDataExportCancellation,
) -> Result<(), NormalizedDataExportPortError> {
    if cancellation.is_cancelled() {
        Err(NormalizedDataExportPortError::Cancelled)
    } else {
        Ok(())
    }
}

fn database_failure(error: rusqlite::Error) -> NormalizedDataExportPortError {
    failure(format!("planned-training export database failure: {error}"))
}

fn serialization_failure(error: serde_json::Error) -> NormalizedDataExportPortError {
    failure(format!(
        "planned-training export serialization failure: {error}"
    ))
}

fn file_failure(error: std::io::Error) -> NormalizedDataExportPortError {
    failure(format!("planned-training export file failure: {error}"))
}

fn failure(message: impl Into<String>) -> NormalizedDataExportPortError {
    NormalizedDataExportPortError::Failure(message.into())
}
