use std::collections::BTreeMap;

use fitfreed_domain::{
    decide_planned_training_reconciliation,
    order_planned_training_revisions_without_source_revision, ImportReport,
    PlannedTrainingCompletion, PlannedTrainingEditability, PlannedTrainingExercise,
    PlannedTrainingExerciseKind, PlannedTrainingIntensity, PlannedTrainingIntensityMetric,
    PlannedTrainingMappingCoverage, PlannedTrainingMappingState, PlannedTrainingPhase,
    PlannedTrainingPhaseChange, PlannedTrainingPhaseGoal, PlannedTrainingRepeat,
    PlannedTrainingSport, PlannedTrainingTarget, PlannedTrainingTargetKind,
    PlannedTrainingTransition, ProviderNeutralSportSuggestion, ReconciliationDecision,
    RevisionOrder, SportFamily, SportLocalizedName, SportRecognitionProvenance,
};
use rusqlite::{params, OptionalExtension, Transaction};

use super::{
    polar_flow::{PlannedTrainingSourceBatch, PlannedTrainingSourceRecord},
    reconciliation_decision_code, ImportError, Result,
};

pub(super) fn reconcile_planned_training_record(
    transaction: &Transaction<'_>,
    operation_id: i64,
    source_provider: &str,
    source_adapter_version: &str,
    mapping_version: &str,
    record: &PlannedTrainingSourceRecord,
    report: &mut ImportReport,
) -> Result<()> {
    let incoming = &record.target;
    let existing = load_current_planned_training_target(
        transaction,
        incoming.origin_id(),
        incoming.target_id(),
    )?;
    let revision_order = existing
        .as_ref()
        .map_or(RevisionOrder::Unorderable, |target| {
            order_planned_training_revisions_without_source_revision(target, incoming)
        });
    let decision =
        decide_planned_training_reconciliation(existing.as_ref(), incoming, revision_order);

    if let Some(stored) = load_planned_training_target_revision(
        transaction,
        incoming.origin_id(),
        incoming.target_id(),
        incoming.evidence_revision(),
        mapping_version,
    )? {
        if stored != *incoming
            || !stored_source_revision_contract_matches(transaction, record, mapping_version)?
        {
            return Err(invalid_library(
                "one evidence and mapping revision resolves to different planned-training states",
            ));
        }
    } else {
        if decision == ReconciliationDecision::Create {
            insert_target_head(
                transaction,
                operation_id,
                source_provider,
                record,
                mapping_version,
            )?;
        }
        insert_target_revision(transaction, record, source_provider, mapping_version)?;
    }

    if decision != ReconciliationDecision::Create {
        transaction.execute(
            "UPDATE planned_training_target
             SET last_seen_import_operation_id = ?3
             WHERE origin_id = ?1 AND target_id = ?2",
            params![incoming.origin_id(), incoming.target_id(), operation_id],
        )?;
    }
    match decision {
        ReconciliationDecision::Create | ReconciliationDecision::Preserve => {}
        ReconciliationDecision::Equivalent
        | ReconciliationDecision::Enrich
        | ReconciliationDecision::Amend => {
            transaction.execute(
                "UPDATE planned_training_target
                 SET current_evidence_revision = ?3,
                     current_mapping_version = ?4
                 WHERE origin_id = ?1 AND target_id = ?2
                   AND (current_evidence_revision <> ?3 OR current_mapping_version <> ?4)",
                params![
                    incoming.origin_id(),
                    incoming.target_id(),
                    incoming.evidence_revision(),
                    mapping_version,
                ],
            )?;
        }
        ReconciliationDecision::Conflict => {
            let existing = existing
                .as_ref()
                .expect("a planned-training conflict has an existing target");
            let existing_mapping_version = transaction.query_row(
                "SELECT current_mapping_version
                 FROM planned_training_target
                 WHERE origin_id = ?1 AND target_id = ?2",
                params![incoming.origin_id(), incoming.target_id()],
                |row| row.get::<_, String>(0),
            )?;
            transaction.execute(
                "UPDATE planned_training_target
                 SET reconciliation_state = 'conflicted'
                 WHERE origin_id = ?1 AND target_id = ?2",
                params![incoming.origin_id(), incoming.target_id()],
            )?;
            transaction.execute(
                "INSERT INTO planned_training_conflict (
                     import_operation_id, origin_id, target_id,
                     existing_evidence_revision, existing_mapping_version,
                     incoming_evidence_revision, incoming_mapping_version,
                     source_artifact_locator
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    operation_id,
                    incoming.origin_id(),
                    incoming.target_id(),
                    existing.evidence_revision(),
                    existing_mapping_version,
                    incoming.evidence_revision(),
                    mapping_version,
                    record.artifact_locator,
                ],
            )?;
        }
    }

    transaction.execute(
        "INSERT INTO planned_training_target_provenance (
             origin_id, target_id, evidence_revision, mapping_version,
             import_operation_id, source_provider, source_adapter_version,
             source_identity, source_artifact_locator, source_artifact_sha256,
             source_record_locator, source_export_version,
             reconciliation_decision, contributes_to_visible_state
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            incoming.origin_id(),
            incoming.target_id(),
            incoming.evidence_revision(),
            mapping_version,
            operation_id,
            source_provider,
            source_adapter_version,
            record.source_identity,
            record.artifact_locator,
            record.artifact_sha256,
            record.source_record_locator,
            record.export_version,
            reconciliation_decision_code(decision),
            matches!(
                decision,
                ReconciliationDecision::Create
                    | ReconciliationDecision::Equivalent
                    | ReconciliationDecision::Enrich
                    | ReconciliationDecision::Amend
            ),
        ],
    )?;
    report.record(decision);
    Ok(())
}

fn stored_source_revision_contract_matches(
    transaction: &Transaction<'_>,
    record: &PlannedTrainingSourceRecord,
    mapping_version: &str,
) -> Result<bool> {
    let target = &record.target;
    let mut unmapped_statement = transaction.prepare(
        "SELECT source_field_locator
         FROM planned_training_unmapped_field
         WHERE origin_id = ?1 AND target_id = ?2
           AND evidence_revision = ?3 AND mapping_version = ?4
         ORDER BY ordinal",
    )?;
    let stored_unmapped = unmapped_statement
        .query_map(
            params![
                target.origin_id(),
                target.target_id(),
                target.evidence_revision(),
                mapping_version,
            ],
            |row| row.get::<_, String>(0),
        )?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    if stored_unmapped != record.unmapped_field_locators {
        return Ok(false);
    }

    let mut sport_statement = transaction.prepare(
        "SELECT exercise.ordinal, evidence.source_record_locator, evidence.source_sport_code
         FROM planned_training_source_sport_evidence evidence
         JOIN planned_training_exercise exercise
           ON exercise.origin_id = evidence.origin_id
          AND exercise.target_id = evidence.target_id
          AND exercise.evidence_revision = evidence.evidence_revision
          AND exercise.mapping_version = evidence.mapping_version
          AND exercise.exercise_id = evidence.exercise_id
         WHERE evidence.origin_id = ?1 AND evidence.target_id = ?2
           AND evidence.evidence_revision = ?3 AND evidence.mapping_version = ?4
         ORDER BY exercise.ordinal",
    )?;
    let stored_sports = sport_statement
        .query_map(
            params![
                target.origin_id(),
                target.target_id(),
                target.evidence_revision(),
                mapping_version,
            ],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    let incoming_sports = record
        .source_sport_evidence
        .iter()
        .map(|evidence| {
            Ok((
                i64::try_from(evidence.exercise_ordinal)
                    .map_err(|_| invalid_library("source sport ordinal overflow"))?,
                evidence.source_record_locator.clone(),
                evidence.source_sport_code.clone(),
            ))
        })
        .collect::<Result<Vec<_>>>()?;
    Ok(stored_sports == incoming_sports)
}

pub(super) fn persist_favorite_snapshot(
    transaction: &Transaction<'_>,
    operation_id: i64,
    source_provider: &str,
    source_adapter_version: &str,
    mapping_version: &str,
    batch: &PlannedTrainingSourceBatch,
) -> Result<()> {
    let Some(snapshot_ref) = batch.favorite_snapshot_ref.as_deref() else {
        return Ok(());
    };
    let origin_id = batch.origin_id.as_str();
    transaction.execute(
        "INSERT INTO planned_training_favorite_snapshot (
             origin_id, snapshot_ref, source_provider, source_adapter_version,
             mapping_version, source_artifact_locator, source_artifact_sha256,
             import_operation_id
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT (origin_id, snapshot_ref) DO UPDATE SET
             source_adapter_version = excluded.source_adapter_version,
             mapping_version = excluded.mapping_version,
             source_artifact_locator = excluded.source_artifact_locator,
             source_artifact_sha256 = excluded.source_artifact_sha256,
             import_operation_id = excluded.import_operation_id",
        params![
            origin_id,
            snapshot_ref,
            source_provider,
            source_adapter_version,
            mapping_version,
            batch.artifact_locator,
            batch.artifact_sha256,
            operation_id,
        ],
    )?;
    transaction.execute(
        "DELETE FROM planned_training_favorite_snapshot_membership
         WHERE origin_id = ?1 AND snapshot_ref = ?2",
        params![origin_id, snapshot_ref],
    )?;
    for (ordinal, record) in batch.records.iter().enumerate() {
        transaction.execute(
            "INSERT INTO planned_training_favorite_snapshot_membership (
                 origin_id, snapshot_ref, ordinal, target_id, evidence_revision, mapping_version
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                origin_id,
                snapshot_ref,
                i64::try_from(ordinal).map_err(|_| invalid_library("favorite ordinal overflow"))?,
                record.target.target_id(),
                record.target.evidence_revision(),
                mapping_version,
            ],
        )?;
    }
    Ok(())
}

fn insert_target_head(
    transaction: &Transaction<'_>,
    operation_id: i64,
    source_provider: &str,
    record: &PlannedTrainingSourceRecord,
    mapping_version: &str,
) -> Result<()> {
    let target = &record.target;
    transaction.execute(
        "INSERT INTO planned_training_target (
             origin_id, target_id, source_provider, source_kind, source_identity,
             current_evidence_revision, current_mapping_version, reconciliation_state,
             first_seen_import_operation_id, last_seen_import_operation_id
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'current', ?8, ?8)",
        params![
            target.origin_id(),
            target.target_id(),
            source_provider,
            target_kind_code(target.kind()),
            record.source_identity,
            target.evidence_revision(),
            mapping_version,
            operation_id,
        ],
    )?;
    Ok(())
}

fn insert_target_revision(
    transaction: &Transaction<'_>,
    record: &PlannedTrainingSourceRecord,
    source_provider: &str,
    mapping_version: &str,
) -> Result<()> {
    let target = &record.target;
    let (scheduled_at_local, completion_state) = match target.kind() {
        PlannedTrainingTargetKind::Scheduled {
            scheduled_at_local,
            completion,
        } => (
            Some(scheduled_at_local.as_str()),
            Some(completion_code(*completion)),
        ),
        PlannedTrainingTargetKind::FavoriteTemplate => (None, None),
    };
    transaction.execute(
        "INSERT INTO planned_training_target_revision (
             origin_id, target_id, evidence_revision, mapping_version,
             target_kind, scheduled_at_local, completion_state, name, description,
             editability, exercises_present, mapping_state, unmapped_field_count,
             source_export_version
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            target.origin_id(),
            target.target_id(),
            target.evidence_revision(),
            mapping_version,
            target_kind_code(target.kind()),
            scheduled_at_local,
            completion_state,
            target.name(),
            target.description(),
            editability_code(target.editability()),
            target.exercises().is_some(),
            mapping_state_code(target.mapping_coverage().state()),
            i64::from(target.mapping_coverage().unmapped_field_count()),
            record.export_version,
        ],
    )?;

    if let Some(exercises) = target.exercises() {
        for exercise in exercises {
            insert_exercise(transaction, target, exercise, mapping_version)?;
        }
    }
    for (ordinal, locator) in record.unmapped_field_locators.iter().enumerate() {
        transaction.execute(
            "INSERT INTO planned_training_unmapped_field (
                 origin_id, target_id, evidence_revision, mapping_version,
                 ordinal, source_field_locator
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                target.origin_id(),
                target.target_id(),
                target.evidence_revision(),
                mapping_version,
                i64::try_from(ordinal).map_err(|_| invalid_library("unmapped field overflow"))?,
                locator,
            ],
        )?;
    }
    for evidence in &record.source_sport_evidence {
        let exercise = target
            .exercises()
            .and_then(|exercises| exercises.get(evidence.exercise_ordinal))
            .ok_or_else(|| invalid_library("source sport evidence has no canonical exercise"))?;
        transaction.execute(
            "INSERT INTO planned_training_source_sport_evidence (
                 origin_id, target_id, evidence_revision, mapping_version,
                 exercise_id, source_provider, source_sport_code, source_record_locator
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                target.origin_id(),
                target.target_id(),
                target.evidence_revision(),
                mapping_version,
                exercise.exercise_id,
                source_provider,
                evidence.source_sport_code,
                evidence.source_record_locator,
            ],
        )?;
    }
    Ok(())
}

fn insert_exercise(
    transaction: &Transaction<'_>,
    target: &PlannedTrainingTarget,
    exercise: &PlannedTrainingExercise,
    mapping_version: &str,
) -> Result<()> {
    let sport = persisted_sport(&exercise.sport)?;
    transaction.execute(
        "INSERT INTO planned_training_exercise (
             origin_id, target_id, evidence_revision, mapping_version,
             exercise_id, ordinal, exercise_kind, duration_goal_milliseconds,
             distance_goal_meters, sport_state, canonical_family_suggestion,
             localized_names_json, catalogue_revision, catalogue_retrieved_at_utc,
             sport_mapping_version, sport_evidence_ref, phases_present
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        params![
            target.origin_id(),
            target.target_id(),
            target.evidence_revision(),
            mapping_version,
            exercise.exercise_id,
            i64::try_from(exercise.ordinal)
                .map_err(|_| invalid_library("planned exercise ordinal overflow"))?,
            exercise_kind_code(exercise.kind),
            exercise.duration_goal_milliseconds,
            exercise.distance_goal_meters,
            sport.state,
            sport.canonical_family,
            sport.localized_names_json,
            sport.catalogue_revision,
            sport.catalogue_retrieved_at_utc,
            sport.mapping_version,
            sport.evidence_ref,
            exercise.phases.is_some(),
        ],
    )?;
    if let Some(phases) = exercise.phases.as_deref() {
        for phase in phases {
            insert_phase(transaction, target, exercise, phase, mapping_version)?;
        }
    }
    Ok(())
}

fn insert_phase(
    transaction: &Transaction<'_>,
    target: &PlannedTrainingTarget,
    exercise: &PlannedTrainingExercise,
    phase: &PlannedTrainingPhase,
    mapping_version: &str,
) -> Result<()> {
    let (goal_kind, duration_goal, distance_goal) = match phase.goal {
        PlannedTrainingPhaseGoal::DurationMilliseconds(value) => ("duration", Some(value), None),
        PlannedTrainingPhaseGoal::DistanceMeters(value) => ("distance", None, Some(value)),
        PlannedTrainingPhaseGoal::Unmapped => ("unmapped", None, None),
    };
    let (intensity_kind, intensity_metric, lower_zone, upper_zone) = match phase.intensity {
        PlannedTrainingIntensity::None => ("none", None, None, None),
        PlannedTrainingIntensity::ZoneRange {
            metric,
            lower_zone,
            upper_zone,
        } => (
            "zone-range",
            Some(intensity_metric_code(metric)),
            Some(i64::from(lower_zone)),
            Some(i64::from(upper_zone)),
        ),
        PlannedTrainingIntensity::Unmapped => ("unmapped", None, None, None),
    };
    let (repeat_id, return_ordinal, total_iterations) =
        phase
            .transition
            .repeat
            .as_ref()
            .map_or((None, None, None), |repeat| {
                (
                    Some(repeat.repeat_id.as_str()),
                    i64::try_from(repeat.return_to_phase_ordinal).ok(),
                    Some(i64::from(repeat.total_iterations)),
                )
            });
    if phase.transition.repeat.is_some() && return_ordinal.is_none() {
        return Err(invalid_library("planned repeat ordinal overflow"));
    }
    transaction.execute(
        "INSERT INTO planned_training_phase (
             origin_id, target_id, evidence_revision, mapping_version, exercise_id,
             phase_id, ordinal, name, goal_kind, duration_goal_milliseconds,
             distance_goal_meters, intensity_kind, intensity_metric, lower_zone, upper_zone,
             transition_id, change_kind, repeat_id, return_to_phase_ordinal, total_iterations
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)",
        params![
            target.origin_id(),
            target.target_id(),
            target.evidence_revision(),
            mapping_version,
            exercise.exercise_id,
            phase.phase_id,
            i64::try_from(phase.ordinal)
                .map_err(|_| invalid_library("planned phase ordinal overflow"))?,
            phase.name,
            goal_kind,
            duration_goal,
            distance_goal,
            intensity_kind,
            intensity_metric,
            lower_zone,
            upper_zone,
            phase.transition.transition_id,
            phase_change_code(phase.transition.change),
            repeat_id,
            return_ordinal,
            total_iterations,
        ],
    )?;
    Ok(())
}

pub(super) fn load_current_planned_training_target(
    transaction: &Transaction<'_>,
    origin_id: &str,
    target_id: &str,
) -> Result<Option<PlannedTrainingTarget>> {
    let current = transaction
        .query_row(
            "SELECT current_evidence_revision, current_mapping_version
             FROM planned_training_target
             WHERE origin_id = ?1 AND target_id = ?2",
            params![origin_id, target_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()?;
    current
        .map(|(evidence_revision, mapping_version)| {
            load_planned_training_target_revision(
                transaction,
                origin_id,
                target_id,
                &evidence_revision,
                &mapping_version,
            )?
            .ok_or_else(|| invalid_library("planned-training head has no current revision"))
        })
        .transpose()
}

pub(super) fn load_planned_training_target_revision(
    transaction: &Transaction<'_>,
    origin_id: &str,
    target_id: &str,
    evidence_revision: &str,
    mapping_version: &str,
) -> Result<Option<PlannedTrainingTarget>> {
    type Header = (
        String,
        Option<String>,
        Option<String>,
        String,
        Option<String>,
        String,
        bool,
        String,
        i64,
    );
    let header = transaction
        .query_row(
            "SELECT target_kind, scheduled_at_local, completion_state, name, description,
                    editability, exercises_present, mapping_state, unmapped_field_count
             FROM planned_training_target_revision
             WHERE origin_id = ?1 AND target_id = ?2
               AND evidence_revision = ?3 AND mapping_version = ?4",
            params![origin_id, target_id, evidence_revision, mapping_version],
            |row| {
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
            },
        )
        .optional()?;
    let Some(header): Option<Header> = header else {
        return Ok(None);
    };
    let kind = restore_target_kind(&header.0, header.1, header.2)?;
    let exercises = if header.6 {
        Some(load_exercises(
            transaction,
            origin_id,
            target_id,
            evidence_revision,
            mapping_version,
        )?)
    } else {
        None
    };
    let coverage = PlannedTrainingMappingCoverage::restore(
        restore_mapping_state(&header.7)?,
        u32::try_from(header.8)
            .map_err(|_| invalid_library("planned-training unmapped count is invalid"))?,
    )
    .map_err(|error| invalid_library(error.to_string()))?;
    PlannedTrainingTarget::restore(
        origin_id,
        target_id,
        evidence_revision,
        kind,
        header.3,
        header.4,
        restore_editability(&header.5)?,
        exercises,
        coverage,
    )
    .map(Some)
    .map_err(|error| invalid_library(error.to_string()))
}

fn load_exercises(
    transaction: &Transaction<'_>,
    origin_id: &str,
    target_id: &str,
    evidence_revision: &str,
    mapping_version: &str,
) -> Result<Vec<PlannedTrainingExercise>> {
    let mut statement = transaction.prepare(
        "SELECT exercise_id, ordinal, exercise_kind, duration_goal_milliseconds,
                distance_goal_meters, sport_state, canonical_family_suggestion,
                localized_names_json, catalogue_revision, catalogue_retrieved_at_utc,
                sport_mapping_version, sport_evidence_ref, phases_present
         FROM planned_training_exercise
         WHERE origin_id = ?1 AND target_id = ?2
           AND evidence_revision = ?3 AND mapping_version = ?4
         ORDER BY ordinal",
    )?;
    let mut rows = statement.query(params![
        origin_id,
        target_id,
        evidence_revision,
        mapping_version
    ])?;
    let mut exercises = Vec::new();
    while let Some(row) = rows.next()? {
        let exercise_id = row.get::<_, String>(0)?;
        let ordinal = usize::try_from(row.get::<_, i64>(1)?)
            .map_err(|_| invalid_library("planned exercise ordinal is invalid"))?;
        let phases_present = row.get::<_, bool>(12)?;
        exercises.push(PlannedTrainingExercise {
            exercise_id: exercise_id.clone(),
            ordinal,
            kind: restore_exercise_kind(&row.get::<_, String>(2)?)?,
            duration_goal_milliseconds: row.get(3)?,
            distance_goal_meters: row.get(4)?,
            sport: restore_sport(
                &row.get::<_, String>(5)?,
                row.get(6)?,
                row.get(7)?,
                row.get(8)?,
                row.get(9)?,
                row.get(10)?,
                row.get(11)?,
            )?,
            phases: if phases_present {
                Some(load_phases(
                    transaction,
                    origin_id,
                    target_id,
                    evidence_revision,
                    mapping_version,
                    &exercise_id,
                )?)
            } else {
                None
            },
        });
    }
    Ok(exercises)
}

fn load_phases(
    transaction: &Transaction<'_>,
    origin_id: &str,
    target_id: &str,
    evidence_revision: &str,
    mapping_version: &str,
    exercise_id: &str,
) -> Result<Vec<PlannedTrainingPhase>> {
    let mut statement = transaction.prepare(
        "SELECT phase_id, ordinal, name, goal_kind, duration_goal_milliseconds,
                distance_goal_meters, intensity_kind, intensity_metric, lower_zone, upper_zone,
                transition_id, change_kind, repeat_id, return_to_phase_ordinal, total_iterations
         FROM planned_training_phase
         WHERE origin_id = ?1 AND target_id = ?2 AND evidence_revision = ?3
           AND mapping_version = ?4 AND exercise_id = ?5
         ORDER BY ordinal",
    )?;
    let mut rows = statement.query(params![
        origin_id,
        target_id,
        evidence_revision,
        mapping_version,
        exercise_id
    ])?;
    let mut phases = Vec::new();
    while let Some(row) = rows.next()? {
        let repeat_id = row.get::<_, Option<String>>(12)?;
        let repeat = repeat_id
            .map(|repeat_id| -> Result<_> {
                Ok(PlannedTrainingRepeat {
                    repeat_id,
                    return_to_phase_ordinal: usize::try_from(row.get::<_, i64>(13)?)
                        .map_err(|_| invalid_library("planned repeat ordinal is invalid"))?,
                    total_iterations: u16::try_from(row.get::<_, i64>(14)?)
                        .map_err(|_| invalid_library("planned repeat count is invalid"))?,
                })
            })
            .transpose()?;
        phases.push(PlannedTrainingPhase {
            phase_id: row.get(0)?,
            ordinal: usize::try_from(row.get::<_, i64>(1)?)
                .map_err(|_| invalid_library("planned phase ordinal is invalid"))?,
            name: row.get(2)?,
            goal: restore_goal(&row.get::<_, String>(3)?, row.get(4)?, row.get(5)?)?,
            intensity: restore_intensity(
                &row.get::<_, String>(6)?,
                row.get(7)?,
                row.get(8)?,
                row.get(9)?,
            )?,
            transition: PlannedTrainingTransition {
                transition_id: row.get(10)?,
                change: restore_phase_change(&row.get::<_, String>(11)?)?,
                repeat,
            },
        });
    }
    Ok(phases)
}

struct PersistedSport {
    state: &'static str,
    canonical_family: Option<&'static str>,
    localized_names_json: Option<String>,
    catalogue_revision: Option<String>,
    catalogue_retrieved_at_utc: Option<String>,
    mapping_version: Option<String>,
    evidence_ref: Option<String>,
}

fn persisted_sport(sport: &PlannedTrainingSport) -> Result<PersistedSport> {
    match sport {
        PlannedTrainingSport::Unavailable => Ok(empty_persisted_sport("unavailable")),
        PlannedTrainingSport::Unmapped => Ok(empty_persisted_sport("unmapped")),
        PlannedTrainingSport::Recognized(suggestion) => {
            let names = suggestion
                .localized_names()
                .iter()
                .map(|name| (name.language_tag().to_owned(), name.value().to_owned()))
                .collect::<BTreeMap<_, _>>();
            let localized_names_json = serde_json::to_string(&names).map_err(|error| {
                invalid_library(format!("planned sport names cannot be serialized: {error}"))
            })?;
            Ok(PersistedSport {
                state: "recognized",
                canonical_family: suggestion.canonical_family().map(SportFamily::as_code),
                localized_names_json: Some(localized_names_json),
                catalogue_revision: Some(suggestion.provenance().catalogue_revision().to_owned()),
                catalogue_retrieved_at_utc: Some(
                    suggestion.provenance().retrieved_at_utc().to_owned(),
                ),
                mapping_version: Some(suggestion.provenance().mapping_version().to_owned()),
                evidence_ref: Some(suggestion.provenance().evidence_ref().to_owned()),
            })
        }
    }
}

fn empty_persisted_sport(state: &'static str) -> PersistedSport {
    PersistedSport {
        state,
        canonical_family: None,
        localized_names_json: None,
        catalogue_revision: None,
        catalogue_retrieved_at_utc: None,
        mapping_version: None,
        evidence_ref: None,
    }
}

#[allow(clippy::too_many_arguments)]
fn restore_sport(
    state: &str,
    canonical_family: Option<String>,
    localized_names_json: Option<String>,
    catalogue_revision: Option<String>,
    retrieved_at_utc: Option<String>,
    mapping_version: Option<String>,
    evidence_ref: Option<String>,
) -> Result<PlannedTrainingSport> {
    match state {
        "unavailable" => Ok(PlannedTrainingSport::Unavailable),
        "unmapped" => Ok(PlannedTrainingSport::Unmapped),
        "recognized" => {
            let names = serde_json::from_str::<BTreeMap<String, String>>(
                localized_names_json
                    .as_deref()
                    .ok_or_else(|| invalid_library("recognized planned sport has no names"))?,
            )
            .map_err(|error| invalid_library(format!("invalid planned sport names: {error}")))?
            .into_iter()
            .map(|(language, value)| {
                SportLocalizedName::new(language, value)
                    .map_err(|error| invalid_library(error.to_string()))
            })
            .collect::<Result<Vec<_>>>()?;
            let family = canonical_family
                .map(|code| {
                    SportFamily::from_code(&code)
                        .map_err(|error| invalid_library(error.to_string()))
                })
                .transpose()?;
            let provenance = SportRecognitionProvenance::new(
                catalogue_revision
                    .ok_or_else(|| invalid_library("recognized planned sport has no catalogue"))?,
                retrieved_at_utc.ok_or_else(|| {
                    invalid_library("recognized planned sport has no retrieval instant")
                })?,
                mapping_version.ok_or_else(|| {
                    invalid_library("recognized planned sport has no mapping version")
                })?,
                evidence_ref.ok_or_else(|| {
                    invalid_library("recognized planned sport has no evidence reference")
                })?,
            )
            .map_err(|error| invalid_library(error.to_string()))?;
            ProviderNeutralSportSuggestion::new(family, names, provenance)
                .map(PlannedTrainingSport::Recognized)
                .map_err(|error| invalid_library(error.to_string()))
        }
        _ => Err(invalid_library("planned sport state is invalid")),
    }
}

fn restore_target_kind(
    code: &str,
    scheduled_at_local: Option<String>,
    completion: Option<String>,
) -> Result<PlannedTrainingTargetKind> {
    match code {
        "scheduled" => Ok(PlannedTrainingTargetKind::Scheduled {
            scheduled_at_local: scheduled_at_local
                .ok_or_else(|| invalid_library("scheduled target has no instant"))?,
            completion: restore_completion(
                completion
                    .as_deref()
                    .ok_or_else(|| invalid_library("scheduled target has no completion state"))?,
            )?,
        }),
        "favorite-template" => Ok(PlannedTrainingTargetKind::FavoriteTemplate),
        _ => Err(invalid_library("planned target kind is invalid")),
    }
}

fn restore_goal(
    code: &str,
    duration: Option<i64>,
    distance: Option<f64>,
) -> Result<PlannedTrainingPhaseGoal> {
    match code {
        "duration" => duration
            .map(PlannedTrainingPhaseGoal::DurationMilliseconds)
            .ok_or_else(|| invalid_library("planned duration goal is missing")),
        "distance" => distance
            .map(PlannedTrainingPhaseGoal::DistanceMeters)
            .ok_or_else(|| invalid_library("planned distance goal is missing")),
        "unmapped" => Ok(PlannedTrainingPhaseGoal::Unmapped),
        _ => Err(invalid_library("planned goal kind is invalid")),
    }
}

fn restore_intensity(
    code: &str,
    metric: Option<String>,
    lower_zone: Option<i64>,
    upper_zone: Option<i64>,
) -> Result<PlannedTrainingIntensity> {
    match code {
        "none" => Ok(PlannedTrainingIntensity::None),
        "unmapped" => Ok(PlannedTrainingIntensity::Unmapped),
        "zone-range" => Ok(PlannedTrainingIntensity::ZoneRange {
            metric: restore_intensity_metric(
                metric
                    .as_deref()
                    .ok_or_else(|| invalid_library("planned intensity metric is missing"))?,
            )?,
            lower_zone: u8::try_from(
                lower_zone.ok_or_else(|| invalid_library("planned lower zone is missing"))?,
            )
            .map_err(|_| invalid_library("planned lower zone is invalid"))?,
            upper_zone: u8::try_from(
                upper_zone.ok_or_else(|| invalid_library("planned upper zone is missing"))?,
            )
            .map_err(|_| invalid_library("planned upper zone is invalid"))?,
        }),
        _ => Err(invalid_library("planned intensity kind is invalid")),
    }
}

fn target_kind_code(kind: &PlannedTrainingTargetKind) -> &'static str {
    match kind {
        PlannedTrainingTargetKind::Scheduled { .. } => "scheduled",
        PlannedTrainingTargetKind::FavoriteTemplate => "favorite-template",
    }
}

fn completion_code(completion: PlannedTrainingCompletion) -> &'static str {
    match completion {
        PlannedTrainingCompletion::Pending => "pending",
        PlannedTrainingCompletion::Completed => "completed",
    }
}

fn restore_completion(code: &str) -> Result<PlannedTrainingCompletion> {
    match code {
        "pending" => Ok(PlannedTrainingCompletion::Pending),
        "completed" => Ok(PlannedTrainingCompletion::Completed),
        _ => Err(invalid_library("planned completion state is invalid")),
    }
}

fn editability_code(value: PlannedTrainingEditability) -> &'static str {
    match value {
        PlannedTrainingEditability::Editable => "editable",
        PlannedTrainingEditability::NonEditable => "non-editable",
        PlannedTrainingEditability::Unspecified => "unspecified",
    }
}

fn restore_editability(code: &str) -> Result<PlannedTrainingEditability> {
    match code {
        "editable" => Ok(PlannedTrainingEditability::Editable),
        "non-editable" => Ok(PlannedTrainingEditability::NonEditable),
        "unspecified" => Ok(PlannedTrainingEditability::Unspecified),
        _ => Err(invalid_library("planned editability is invalid")),
    }
}

fn mapping_state_code(state: PlannedTrainingMappingState) -> &'static str {
    match state {
        PlannedTrainingMappingState::Complete => "complete",
        PlannedTrainingMappingState::Partial => "partial",
    }
}

fn restore_mapping_state(code: &str) -> Result<PlannedTrainingMappingState> {
    match code {
        "complete" => Ok(PlannedTrainingMappingState::Complete),
        "partial" => Ok(PlannedTrainingMappingState::Partial),
        _ => Err(invalid_library("planned mapping state is invalid")),
    }
}

fn exercise_kind_code(kind: PlannedTrainingExerciseKind) -> &'static str {
    match kind {
        PlannedTrainingExerciseKind::Open => "open",
        PlannedTrainingExerciseKind::Phased => "phased",
        PlannedTrainingExerciseKind::Volume => "volume",
        PlannedTrainingExerciseKind::Strength => "strength",
        PlannedTrainingExerciseKind::Unmapped => "unmapped",
    }
}

fn restore_exercise_kind(code: &str) -> Result<PlannedTrainingExerciseKind> {
    match code {
        "open" => Ok(PlannedTrainingExerciseKind::Open),
        "phased" => Ok(PlannedTrainingExerciseKind::Phased),
        "volume" => Ok(PlannedTrainingExerciseKind::Volume),
        "strength" => Ok(PlannedTrainingExerciseKind::Strength),
        "unmapped" => Ok(PlannedTrainingExerciseKind::Unmapped),
        _ => Err(invalid_library("planned exercise kind is invalid")),
    }
}

fn intensity_metric_code(metric: PlannedTrainingIntensityMetric) -> &'static str {
    match metric {
        PlannedTrainingIntensityMetric::HeartRate => "heart-rate",
        PlannedTrainingIntensityMetric::Speed => "speed",
        PlannedTrainingIntensityMetric::Power => "power",
    }
}

fn restore_intensity_metric(code: &str) -> Result<PlannedTrainingIntensityMetric> {
    match code {
        "heart-rate" => Ok(PlannedTrainingIntensityMetric::HeartRate),
        "speed" => Ok(PlannedTrainingIntensityMetric::Speed),
        "power" => Ok(PlannedTrainingIntensityMetric::Power),
        _ => Err(invalid_library("planned intensity metric is invalid")),
    }
}

fn phase_change_code(change: PlannedTrainingPhaseChange) -> &'static str {
    match change {
        PlannedTrainingPhaseChange::Manual => "manual",
        PlannedTrainingPhaseChange::Automatic => "automatic",
        PlannedTrainingPhaseChange::Unmapped => "unmapped",
    }
}

fn restore_phase_change(code: &str) -> Result<PlannedTrainingPhaseChange> {
    match code {
        "manual" => Ok(PlannedTrainingPhaseChange::Manual),
        "automatic" => Ok(PlannedTrainingPhaseChange::Automatic),
        "unmapped" => Ok(PlannedTrainingPhaseChange::Unmapped),
        _ => Err(invalid_library("planned phase change is invalid")),
    }
}

fn invalid_library(reason: impl Into<String>) -> ImportError {
    ImportError::InvalidTrainingLibrary(reason.into())
}
