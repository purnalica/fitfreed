use fitfreed_domain::{
    ArtifactCoverageSummary, DailyActivity, ImportOperationState, ImportOutcome, ImportReport,
    NightlyRecovery, ProviderNeutralSportSuggestion, SleepPeriod, SleepPhaseSummary, SleepScore,
    SportClassification, SportClassificationAuthorship, SportClassificationKey,
    SportClassificationState, SportFamily, SportLocalizedName, SportRecognitionProvenance,
    TrainingSession,
};
use std::{
    collections::{BTreeMap, BTreeSet, VecDeque},
    hash::{DefaultHasher, Hash, Hasher},
    sync::Mutex,
};

use super::*;

#[derive(Default)]
struct ControlledLibraryHomePort {
    activity_bounds: Option<ActivityDateRange>,
    activity_step_bounds: Option<ActivityDateRange>,
    activity_origins: Vec<String>,
    activities: Vec<DailyActivity>,
    training_bounds: Option<TrainingDateRange>,
    training_origins: Vec<String>,
    sessions: Vec<TrainingSession>,
    sleep_bounds: Option<SleepDateRange>,
    sleep_origins: Vec<String>,
    periods: Vec<SleepLibraryPeriod>,
    recovery_bounds: Option<RecoveryDateRange>,
    recovery_origins: Vec<String>,
    recoveries: Vec<RecoveryLibraryNight>,
    detected_sports: Vec<DetectedTrainingSport>,
    outcome: Option<ImportOutcome>,
    workspace: Mutex<Option<StoredExplorationWorkspace>>,
    revision_reads: Mutex<VecDeque<String>>,
    training_snapshot_reads: Mutex<VecDeque<String>>,
    current_local_date_reads: Mutex<VecDeque<String>>,
    current_local_date: Option<String>,
}

const HOME_REVISION: &str =
    "library-home-revision-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TRAINING_SNAPSHOT: &str =
    "training-snapshot-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

impl ActivityLibraryPort for ControlledLibraryHomePort {
    fn activity_bounds(&self) -> Result<Option<ActivityDateRange>, String> {
        Ok(self.activity_bounds.clone())
    }

    fn activity_origins(&self) -> Result<Vec<String>, String> {
        Ok(self.activity_origins.clone())
    }

    fn query_activity(&self, range: &ActivityDateRange) -> Result<Vec<DailyActivity>, String> {
        Ok(self
            .activities
            .iter()
            .filter(|activity| in_range(&activity.local_date, &range.from, &range.through))
            .cloned()
            .collect())
    }
}

impl LibraryHomeMeasurementRangePort for ControlledLibraryHomePort {
    fn activity_step_bounds(&self) -> Result<Option<ActivityDateRange>, String> {
        Ok(self.activity_step_bounds.clone())
    }
}

impl TrainingLibraryPort for ControlledLibraryHomePort {
    fn training_bounds(&self) -> Result<Option<TrainingDateRange>, String> {
        Ok(self.training_bounds.clone())
    }

    fn training_origins(&self) -> Result<Vec<String>, String> {
        Ok(self.training_origins.clone())
    }

    fn query_training(&self, range: &TrainingDateRange) -> Result<Vec<TrainingSession>, String> {
        Ok(self
            .sessions
            .iter()
            .filter(|session| {
                in_range(&session.started_at_local[..10], &range.from, &range.through)
            })
            .cloned()
            .collect())
    }
}

impl TrainingSessionDiscoveryPort for ControlledLibraryHomePort {
    fn query_training_sessions(
        &self,
        request: &TrainingSessionSearchRequest,
    ) -> Result<PersistedTrainingSessionSearchPage, TrainingSessionDiscoveryPortError> {
        let snapshot_ref = self
            .training_snapshot_reads
            .lock()
            .expect("training snapshot reads")
            .pop_front()
            .unwrap_or_else(|| TRAINING_SNAPSHOT.to_owned());
        if request
            .snapshot_ref
            .as_deref()
            .is_some_and(|snapshot| snapshot != snapshot_ref)
        {
            return Err(TrainingSessionDiscoveryPortError::SnapshotChanged);
        }
        let origins = self
            .training_origins
            .iter()
            .enumerate()
            .map(|(index, origin)| (origin.as_str(), index + 1))
            .collect::<BTreeMap<_, _>>();
        let mut sessions = self
            .sessions
            .iter()
            .filter(|session| {
                request
                    .from
                    .as_deref()
                    .is_none_or(|from| &session.started_at_local[..10] >= from)
                    && request
                        .through
                        .as_deref()
                        .is_none_or(|through| &session.started_at_local[..10] <= through)
            })
            .cloned()
            .collect::<Vec<_>>();
        sessions.sort_by(|left, right| right.started_at_local.cmp(&left.started_at_local));
        let total_count = sessions.len();
        let mut summaries = BTreeMap::<usize, TrainingSessionSearchSummary>::new();
        for session in &sessions {
            let source_index = origins[session.origin_id.as_str()];
            let summary = summaries
                .entry(source_index)
                .or_insert(TrainingSessionSearchSummary {
                    source_index,
                    training_days: 0,
                    session_count: 0,
                    total_duration_milliseconds: 0,
                    distance_session_count: 0,
                    total_distance_meters: None,
                    energy_session_count: 0,
                    total_energy_kilocalories: None,
                    heart_rate_session_count: 0,
                });
            summary.session_count += 1;
            summary.training_days += usize::from(!sessions.iter().any(|candidate| {
                candidate.origin_id == session.origin_id
                    && candidate.started_at_local[..10] == session.started_at_local[..10]
                    && candidate.started_at_local < session.started_at_local
            }));
            summary.total_duration_milliseconds += i128::from(session.duration_milliseconds);
            if let Some(distance) = session.distance_meters {
                summary.distance_session_count += 1;
                *summary.total_distance_meters.get_or_insert(0.0) += distance;
            }
            if let Some(energy) = session.energy_kilocalories {
                summary.energy_session_count += 1;
                *summary.total_energy_kilocalories.get_or_insert(0) += i128::from(energy);
            }
            if session.average_heart_rate_bpm.is_some() || session.maximum_heart_rate_bpm.is_some()
            {
                summary.heart_rate_session_count += 1;
            }
        }
        let sessions = sessions
            .into_iter()
            .skip(request.offset)
            .take(request.limit)
            .map(|session| {
                controlled_search_item(self, &session, origins[session.origin_id.as_str()])
            })
            .collect();
        Ok(PersistedTrainingSessionSearchPage {
            available_range: self.training_bounds.clone(),
            snapshot_ref,
            total_count,
            summaries: summaries.into_values().collect(),
            sessions,
        })
    }

    fn query_training_calendar(
        &self,
        _request: &TrainingSessionCalendarRequest,
    ) -> Result<PersistedTrainingSessionCalendar, TrainingSessionDiscoveryPortError> {
        panic!("the library home never queries the training calendar")
    }

    fn query_training_session_selection(
        &self,
        _request: &TrainingSessionSelectionRequest,
    ) -> Result<PersistedTrainingSessionSelection, TrainingSessionDiscoveryPortError> {
        panic!("the library home never resolves a training selection")
    }
}

impl TrainingSportsPort for ControlledLibraryHomePort {
    fn query_detected_training_sports(&self) -> Result<Vec<DetectedTrainingSport>, String> {
        if !self.detected_sports.is_empty() {
            return Ok(self.detected_sports.clone());
        }
        let mut by_origin = BTreeMap::<String, Vec<&TrainingSession>>::new();
        for session in &self.sessions {
            by_origin
                .entry(session.origin_id.clone())
                .or_default()
                .push(session);
        }
        Ok(by_origin
            .into_iter()
            .enumerate()
            .map(|(index, (origin_id, sessions))| DetectedTrainingSport {
                session_filter_ref: format!("sport-{:064x}", index + 1),
                sport_ref: None,
                origin_id,
                classification: None,
                recognition_candidates: Vec::new(),
                first_local_date: sessions
                    .iter()
                    .map(|session| session.started_at_local[..10].to_owned())
                    .min()
                    .expect("controlled first training date"),
                last_local_date: sessions
                    .iter()
                    .map(|session| session.started_at_local[..10].to_owned())
                    .max()
                    .expect("controlled last training date"),
                session_count: sessions.len(),
                total_duration_milliseconds: sessions
                    .iter()
                    .map(|session| i128::from(session.duration_milliseconds))
                    .sum(),
                distance_session_count: sessions
                    .iter()
                    .filter(|session| session.distance_meters.is_some())
                    .count(),
                heart_rate_session_count: sessions
                    .iter()
                    .filter(|session| {
                        session.average_heart_rate_bpm.is_some()
                            || session.maximum_heart_rate_bpm.is_some()
                    })
                    .count(),
            })
            .collect())
    }

    fn find_detected_training_sport(
        &self,
        _sport_ref: &str,
    ) -> Result<Option<DetectedTrainingSport>, String> {
        panic!("the library home never resolves an editable sport")
    }

    fn compare_and_save_sport_classification(
        &self,
        _expected_revision: u64,
        _classification: &SportClassification,
    ) -> Result<bool, String> {
        panic!("the library home never saves sport meaning")
    }
}

impl LibraryHomeRevisionPort for ControlledLibraryHomePort {
    fn library_home_revision_ref(&self) -> Result<String, String> {
        Ok(self
            .revision_reads
            .lock()
            .expect("revision reads")
            .pop_front()
            .unwrap_or_else(|| HOME_REVISION.to_owned()))
    }
}

impl LibraryHomeClockPort for ControlledLibraryHomePort {
    fn current_local_date(&self) -> Result<String, String> {
        Ok(self
            .current_local_date_reads
            .lock()
            .expect("current local date reads")
            .pop_front()
            .or_else(|| self.current_local_date.clone())
            .unwrap_or_else(|| "2026-01-10".to_owned()))
    }
}

impl SleepLibraryPort for ControlledLibraryHomePort {
    fn sleep_bounds(&self) -> Result<Option<SleepDateRange>, String> {
        Ok(self.sleep_bounds.clone())
    }

    fn sleep_origins(&self) -> Result<Vec<String>, String> {
        Ok(self.sleep_origins.clone())
    }

    fn query_sleep(&self, range: &SleepDateRange) -> Result<Vec<SleepLibraryPeriod>, String> {
        Ok(self
            .periods
            .iter()
            .filter(|period| in_range(&period.sleep_date, &range.from, &range.through))
            .cloned()
            .collect())
    }

    fn query_sleep_period(
        &self,
        _series_ref: &str,
        _sleep_date: &str,
    ) -> Result<Option<SleepPeriod>, String> {
        panic!("the library home never queries full sleep detail")
    }
}

impl RecoveryLibraryPort for ControlledLibraryHomePort {
    fn recovery_bounds(&self) -> Result<Option<RecoveryDateRange>, String> {
        Ok(self.recovery_bounds.clone())
    }

    fn recovery_origins(&self) -> Result<Vec<String>, String> {
        Ok(self.recovery_origins.clone())
    }

    fn query_recovery(
        &self,
        range: &RecoveryDateRange,
    ) -> Result<Vec<RecoveryLibraryNight>, String> {
        Ok(self
            .recoveries
            .iter()
            .filter(|recovery| in_range(&recovery.recovery_date, &range.from, &range.through))
            .cloned()
            .collect())
    }

    fn query_recovery_night(
        &self,
        _series_ref: &str,
        _recovery_date: &str,
    ) -> Result<Option<NightlyRecovery>, String> {
        panic!("the library home never queries full recovery detail")
    }
}

impl ImportOutcomeLibraryPort for ControlledLibraryHomePort {
    fn latest_import_outcome(&self) -> Result<Option<ImportOutcome>, String> {
        Ok(self.outcome.clone())
    }
}

impl ExplorationWorkspacePort for ControlledLibraryHomePort {
    fn load_exploration_workspace(&self) -> Result<Option<StoredExplorationWorkspace>, String> {
        Ok(self.workspace.lock().expect("workspace lock").clone())
    }

    fn save_exploration_workspace(&self, workspace: &ExplorationWorkspace) -> Result<(), String> {
        *self.workspace.lock().expect("workspace lock") = Some(StoredExplorationWorkspace {
            version: i64::from(workspace.version),
            destination: match workspace.destination {
                ExploreDestination::Activity => "activity",
                ExploreDestination::Training => "training",
                ExploreDestination::Sleep => "sleep",
                ExploreDestination::Recovery => "recovery",
                ExploreDestination::Longitudinal => "longitudinal",
            }
            .to_owned(),
        });
        Ok(())
    }

    fn clear_exploration_workspace(&self) -> Result<(), String> {
        *self.workspace.lock().expect("workspace lock") = None;
        Ok(())
    }
}

fn in_range(value: &str, from: &str, through: &str) -> bool {
    value >= from && value <= through
}

fn controlled_search_item(
    port: &ControlledLibraryHomePort,
    session: &TrainingSession,
    source_index: usize,
) -> TrainingSessionSearchItem {
    let mut hasher = DefaultHasher::new();
    session.origin_id.hash(&mut hasher);
    session.session_id.hash(&mut hasher);
    let sport = port
        .detected_sports
        .iter()
        .find(|sport| {
            sport.origin_id == session.origin_id
                && sport.classification.as_ref().is_some_and(|classification| {
                    Some(classification.key().source_sport_ref()) == session.sport_ref.as_deref()
                })
        })
        .map(|sport| {
            let classification = sport
                .classification
                .as_ref()
                .expect("controlled sport classification");
            resolve_training_session_sport(
                sport.sport_ref.clone(),
                Some(classification.clone()),
                sport.recognition_candidates.clone(),
            )
            .expect("controlled sport identity")
        })
        .unwrap_or(TrainingSessionSport {
            sport_ref: None,
            state: TrainingSportState::Unavailable,
            classification: None,
            recognition: None,
            recognition_candidate_count: 0,
        });
    TrainingSessionSearchItem {
        session_ref: format!("session-{:064x}", hasher.finish()),
        sport_filter_ref: port
            .detected_sports
            .iter()
            .find(|detected| detected.origin_id == session.origin_id)
            .map(|detected| detected.session_filter_ref.clone())
            .unwrap_or_else(|| {
                "sport-ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff".to_owned()
            }),
        source_index,
        started_at_local: session.started_at_local.clone(),
        stopped_at_local: session.stopped_at_local.clone(),
        utc_offset_minutes: session.utc_offset_minutes,
        duration_milliseconds: session.duration_milliseconds,
        distance_meters: session.distance_meters,
        energy_kilocalories: session.energy_kilocalories,
        average_heart_rate_bpm: session.average_heart_rate_bpm,
        maximum_heart_rate_bpm: session.maximum_heart_rate_bpm,
        exercise_count: session.exercise_count,
        sport,
    }
}

fn activity_range(from: &str, through: &str) -> ActivityDateRange {
    ActivityDateRange {
        from: from.to_owned(),
        through: through.to_owned(),
    }
}

fn training_range(from: &str, through: &str) -> TrainingDateRange {
    TrainingDateRange {
        from: from.to_owned(),
        through: through.to_owned(),
    }
}

fn sleep_range(from: &str, through: &str) -> SleepDateRange {
    SleepDateRange {
        from: from.to_owned(),
        through: through.to_owned(),
    }
}

fn recovery_range(from: &str, through: &str) -> RecoveryDateRange {
    RecoveryDateRange {
        from: from.to_owned(),
        through: through.to_owned(),
    }
}

fn training_session(
    session_id: &str,
    date: &str,
    with_optional_measurements: bool,
) -> TrainingSession {
    TrainingSession {
        origin_id: "origin-a".to_owned(),
        session_id: session_id.to_owned(),
        started_at_local: format!("{date}T08:00:00"),
        stopped_at_local: format!("{date}T09:00:00"),
        utc_offset_minutes: Some(60),
        duration_milliseconds: 3_600_000,
        distance_meters: with_optional_measurements.then_some(10_000.0),
        energy_kilocalories: with_optional_measurements.then_some(600),
        average_heart_rate_bpm: with_optional_measurements.then_some(142),
        maximum_heart_rate_bpm: with_optional_measurements.then_some(171),
        sport_ref: Some("opaque-sport".to_owned()),
        exercise_count: Some(1),
    }
}

fn sleep_period(date: &str) -> SleepLibraryPeriod {
    SleepLibraryPeriod {
        origin_id: "origin-a".to_owned(),
        sleep_date: date.to_owned(),
        started_at: format!("{date}T00:00:00+01:00"),
        ended_at: format!("{date}T08:00:00+01:00"),
        span_milliseconds: 28_800_000,
        asleep_milliseconds: 27_000_000,
        interruption_milliseconds: 1_800_000,
        long_interruption_milliseconds: 1_200_000,
        short_interruption_milliseconds: 600_000,
        interruption_count: 3,
        long_interruption_count: 1,
        short_interruption_count: 2,
        efficiency_percent: 93.75,
        continuity_index: 4.2,
        continuity_class: 4,
        sleep_goal_milliseconds: Some(28_800_000),
        self_reported_rating: Some(4),
        cycle_count: Some(4),
        recording_ended_by_power_loss: Some(false),
        phase_summary: Some(SleepPhaseSummary {
            wake_milliseconds: 1_800_000,
            rem_milliseconds: 5_400_000,
            light_milliseconds: 16_200_000,
            deep_milliseconds: 5_400_000,
            unrecognized_milliseconds: 0,
        }),
        stage_timeline_available: true,
        score: Some(SleepScore {
            overall: 82.0,
            own_target_duration: 80.0,
            recommended_duration: 78.0,
            continuity: 84.0,
            efficiency: 86.0,
            rem: 76.0,
            deep: 81.0,
            long_interruptions: 79.0,
            duration: 79.0,
            solidity: 83.0,
            regeneration: 78.5,
            relative_rating: Some(4),
        }),
    }
}

fn recovery(date: &str) -> RecoveryLibraryNight {
    RecoveryLibraryNight {
        origin_id: "origin-b".to_owned(),
        recovery_date: date.to_owned(),
        beat_to_beat_interval_milliseconds: 900,
        heart_rate_variability_rmssd_milliseconds: Some(42),
        breathing_interval_milliseconds: 4_100,
        source_assessment: Some(SourceSpecificRecoveryAssessment {
            scheme: "synthetic-assessment@1".to_owned(),
            autonomic_charge: 1.5,
            autonomic_status: 4,
            overall_status: 5,
            overall_sublevel: 2,
        }),
        source_baseline_available: true,
        source_guidance_available: true,
    }
}

fn completed_outcome(operation_ref: &str) -> ImportOutcome {
    ImportOutcome {
        operation_ref: operation_ref.to_owned(),
        state: ImportOperationState::Completed,
        source_provider: "synthetic-provider".to_owned(),
        source_adapter_version: "1".to_owned(),
        mapping_version: "1".to_owned(),
        exact_repeat: false,
        coverage_complete: true,
        coverage: ArtifactCoverageSummary {
            total: 8,
            supported: 7,
            unsupported: 1,
            deliberately_ignored: 0,
            unrecognized: 0,
            invalid: 0,
        },
        artifact_families: Vec::new(),
        report: ImportReport {
            exact_repeat: false,
            recognized_artifacts: 7,
            new_observations: 4,
            equivalent_observations: 1,
            enriched_observations: 1,
            amended_observations: 1,
            preserved_observations: 0,
            conflicts: 0,
        },
        canonical_history_changed: true,
        terminal_code: None,
        recovery_note: None,
    }
}

fn classified_detected_sport(index: usize, session_count: usize) -> DetectedTrainingSport {
    classified_detected_sport_named(index, session_count, "Trail running")
}

fn classified_detected_sport_named(
    index: usize,
    session_count: usize,
    display_label: &str,
) -> DetectedTrainingSport {
    let origin_id = "origin-a";
    let source_sport_ref = format!("source-sport-{index}");
    DetectedTrainingSport {
        session_filter_ref: format!("sport-{index:064x}"),
        sport_ref: Some(format!("sport-{index:064x}")),
        origin_id: origin_id.to_owned(),
        classification: Some(
            SportClassification::restore(
                SportClassificationKey::new(origin_id, source_sport_ref)
                    .expect("controlled sport key"),
                SportClassificationState::Classified,
                Some(SportFamily::Running),
                Some(display_label.to_owned()),
                Some(SportClassificationAuthorship::User),
                1,
            )
            .expect("controlled sport classification"),
        ),
        recognition_candidates: Vec::new(),
        first_local_date: "2020-01-01".to_owned(),
        last_local_date: "2026-01-05".to_owned(),
        session_count,
        total_duration_milliseconds: 3_600_000_i128 * session_count as i128,
        distance_session_count: session_count,
        heart_rate_session_count: session_count,
    }
}

fn unknown_detected_sport(index: usize, session_count: usize) -> DetectedTrainingSport {
    let origin_id = "origin-a";
    let source_sport_ref = format!("source-sport-{index}");
    DetectedTrainingSport {
        session_filter_ref: format!("sport-{index:064x}"),
        sport_ref: Some(format!("sport-{index:064x}")),
        origin_id: origin_id.to_owned(),
        classification: Some(
            SportClassification::restore(
                SportClassificationKey::new(origin_id, source_sport_ref)
                    .expect("controlled sport key"),
                SportClassificationState::Unknown,
                None,
                None,
                None,
                0,
            )
            .expect("controlled unknown sport classification"),
        ),
        recognition_candidates: Vec::new(),
        first_local_date: "2020-01-01".to_owned(),
        last_local_date: "2026-01-05".to_owned(),
        session_count,
        total_duration_milliseconds: 3_600_000_i128 * session_count as i128,
        distance_session_count: session_count,
        heart_rate_session_count: session_count,
    }
}

fn recognition_suggestion(
    name: &str,
    family: Option<SportFamily>,
) -> ProviderNeutralSportSuggestion {
    ProviderNeutralSportSuggestion::new(
        family,
        vec![SportLocalizedName::new("en", name).expect("controlled localized sport name")],
        SportRecognitionProvenance::new(
            "catalogue-2026-08-25",
            "2026-08-25T10:00:00Z",
            "sport-mapping@1",
            format!("sport-evidence-{}", "a".repeat(64)),
        )
        .expect("controlled recognition provenance"),
    )
    .expect("controlled recognition suggestion")
}

fn recognized_detected_sport(index: usize, session_count: usize) -> DetectedTrainingSport {
    let mut sport = unknown_detected_sport(index, session_count);
    sport.recognition_candidates = vec![recognition_suggestion(
        "Road running",
        Some(SportFamily::Running),
    )];
    sport
}

fn revision_ref(digit: char) -> String {
    format!("library-home-revision-{}", digit.to_string().repeat(64))
}

fn snapshot_ref(digit: char) -> String {
    format!("training-snapshot-{}", digit.to_string().repeat(64))
}

fn representative_port() -> ControlledLibraryHomePort {
    ControlledLibraryHomePort {
        activity_bounds: Some(activity_range("2026-01-01", "2026-01-03")),
        activity_step_bounds: Some(activity_range("2026-01-01", "2026-01-01")),
        activity_origins: vec!["origin-a".to_owned(), "origin-b".to_owned()],
        activities: vec![
            DailyActivity {
                origin_id: "origin-a".to_owned(),
                local_date: "2026-01-01".to_owned(),
                step_count: Some(3_100),
            },
            DailyActivity {
                origin_id: "origin-b".to_owned(),
                local_date: "2026-01-03".to_owned(),
                step_count: None,
            },
        ],
        training_bounds: Some(training_range("2026-01-04", "2026-01-05")),
        training_origins: vec!["origin-a".to_owned()],
        sessions: vec![
            training_session("session-a", "2026-01-04", true),
            training_session("session-b", "2026-01-05", false),
        ],
        sleep_bounds: Some(sleep_range("2026-01-06", "2026-01-06")),
        sleep_origins: vec!["origin-a".to_owned()],
        periods: vec![sleep_period("2026-01-06")],
        recovery_bounds: Some(recovery_range("2026-01-06", "2026-01-06")),
        recovery_origins: vec!["origin-b".to_owned()],
        recoveries: vec![recovery("2026-01-06")],
        detected_sports: Vec::new(),
        outcome: Some(completed_outcome("operation-accepted")),
        workspace: Mutex::new(Some(StoredExplorationWorkspace {
            version: 1,
            destination: "training".to_owned(),
        })),
        revision_reads: Mutex::new(VecDeque::new()),
        training_snapshot_reads: Mutex::new(VecDeque::new()),
        current_local_date_reads: Mutex::new(VecDeque::new()),
        current_local_date: Some("2026-01-10".to_owned()),
    }
}

#[test]
fn composes_coverage_and_conservative_questions_from_authoritative_read_models() {
    let home = query_library_home(
        &representative_port(),
        LibraryHomeRequest {
            after_import_operation_ref: Some("operation-accepted".to_owned()),
        },
    )
    .expect("library home");

    assert_eq!(
        home.recorded_range,
        Some(LibraryHomeDateRange {
            from: "2026-01-01".to_owned(),
            through: "2026-01-06".to_owned(),
        })
    );
    assert_eq!(home.usable_range, home.recorded_range);
    assert_eq!(
        home.primary_range,
        Some(LibraryHomePrimaryRange {
            scope: LibraryHomeRangeScope::Training,
            range: LibraryHomeDateRange {
                from: "2026-01-04".to_owned(),
                through: "2026-01-05".to_owned(),
            },
        })
    );
    assert_eq!(
        home.domains
            .iter()
            .map(|coverage| coverage.domain)
            .collect::<Vec<_>>(),
        vec![
            LibraryDomain::Training,
            LibraryDomain::Activity,
            LibraryDomain::Sleep,
            LibraryDomain::Recovery,
        ]
    );

    let training = &home.domains[0];
    assert_eq!(training.origin_count, 1);
    assert_eq!(training.observed_record_count, 2);
    assert_eq!(
        training.measurements,
        vec![
            LibraryMeasurementCoverage::new(LibraryMeasurement::TrainingDuration, 2, 2),
            LibraryMeasurementCoverage::new(LibraryMeasurement::TrainingDistance, 1, 2),
            LibraryMeasurementCoverage::new(LibraryMeasurement::TrainingEnergy, 1, 2),
            LibraryMeasurementCoverage::new(LibraryMeasurement::TrainingHeartRate, 1, 2),
        ]
    );

    let activity = &home.domains[1];
    assert_eq!(activity.origin_count, 2);
    assert_eq!(activity.observed_record_count, 2);
    assert_eq!(
        activity.measurements,
        vec![LibraryMeasurementCoverage::new(
            LibraryMeasurement::ActivitySteps,
            1,
            2,
        )]
    );

    assert_eq!(home.domains[2].observed_record_count, 1);
    assert_eq!(home.domains[3].observed_record_count, 1);
    assert_eq!(
        home.questions,
        vec![
            LibraryQuestion::new(
                LibraryQuestionKind::ExploreTrainingSessions,
                ExploreDestination::Training,
            ),
            LibraryQuestion::new(
                LibraryQuestionKind::AlignHistory,
                ExploreDestination::Longitudinal,
            ),
            LibraryQuestion::new(
                LibraryQuestionKind::ReviewActivitySteps,
                ExploreDestination::Activity,
            ),
            LibraryQuestion::new(
                LibraryQuestionKind::ReviewSleepPatterns,
                ExploreDestination::Sleep,
            ),
            LibraryQuestion::new(
                LibraryQuestionKind::ReviewRecoveryPatterns,
                ExploreDestination::Recovery,
            ),
        ]
    );
    assert_eq!(
        home.resumable_exploration,
        Some(ExplorationWorkspace {
            version: 1,
            destination: ExploreDestination::Training,
        })
    );
    assert_eq!(
        home.post_import,
        Some(PostImportReveal {
            exact_repeat: false,
            canonical_history_changed: true,
            new_observations: 4,
            enriched_observations: 1,
            amended_observations: 1,
            unchanged_observations: 1,
            source_review_recommended: true,
        })
    );
}

#[test]
fn excludes_unavailable_activity_boundaries_from_usable_history_without_losing_source_evidence() {
    let port = ControlledLibraryHomePort {
        activity_bounds: Some(activity_range("2014-01-01", "2026-01-03")),
        activity_step_bounds: Some(activity_range("2026-01-02", "2026-01-02")),
        activity_origins: vec!["origin-a".to_owned()],
        activities: vec![DailyActivity {
            origin_id: "origin-a".to_owned(),
            local_date: "2026-01-02".to_owned(),
            step_count: Some(3_100),
        }],
        training_bounds: Some(training_range("2020-02-03", "2026-01-05")),
        training_origins: vec!["origin-a".to_owned()],
        sessions: vec![training_session("session-a", "2026-01-05", true)],
        current_local_date: Some("2026-01-10".to_owned()),
        ..ControlledLibraryHomePort::default()
    };

    let home = query_library_home(&port, LibraryHomeRequest::default())
        .expect("Home with source-only activity boundary");

    assert_eq!(
        home.recorded_range,
        Some(LibraryHomeDateRange {
            from: "2014-01-01".to_owned(),
            through: "2026-01-05".to_owned(),
        })
    );
    assert_eq!(
        home.usable_range,
        Some(LibraryHomeDateRange {
            from: "2020-02-03".to_owned(),
            through: "2026-01-05".to_owned(),
        })
    );
    assert_eq!(
        home.primary_range,
        Some(LibraryHomePrimaryRange {
            scope: LibraryHomeRangeScope::Training,
            range: LibraryHomeDateRange {
                from: "2020-02-03".to_owned(),
                through: "2026-01-05".to_owned(),
            },
        })
    );
    assert_eq!(
        home.domains[1].recorded_range,
        Some(LibraryHomeDateRange {
            from: "2014-01-01".to_owned(),
            through: "2026-01-03".to_owned(),
        })
    );
    assert_eq!(
        home.domains[1].usable_range,
        Some(LibraryHomeDateRange {
            from: "2026-01-02".to_owned(),
            through: "2026-01-02".to_owned(),
        })
    );
}

#[test]
fn keeps_recorded_but_unusable_activity_out_of_the_first_run_and_question_boundaries() {
    let port = ControlledLibraryHomePort {
        activity_bounds: Some(activity_range("2014-01-01", "2014-01-01")),
        activity_step_bounds: None,
        activity_origins: vec!["origin-a".to_owned()],
        activities: vec![DailyActivity {
            origin_id: "origin-a".to_owned(),
            local_date: "2014-01-01".to_owned(),
            step_count: None,
        }],
        current_local_date: Some("2026-01-10".to_owned()),
        ..ControlledLibraryHomePort::default()
    };

    let home = query_library_home(&port, LibraryHomeRequest::default())
        .expect("recorded but unusable Home");

    assert_eq!(
        home.recorded_range,
        Some(LibraryHomeDateRange {
            from: "2014-01-01".to_owned(),
            through: "2014-01-01".to_owned(),
        })
    );
    assert_eq!(home.usable_range, None);
    assert_eq!(home.primary_range, None);
    assert_eq!(home.domains[1].usable_range, None);
    assert!(home.questions.is_empty());
}

#[test]
fn composes_recognizable_complete_training_identity_and_one_recent_comparison() {
    let home = query_library_home(&representative_port(), LibraryHomeRequest::default())
        .expect("recognizable library home");

    assert_eq!(home.version, 6);
    assert_eq!(home.library_revision_ref, HOME_REVISION);
    let training = home.training.expect("complete training identity");
    assert_eq!(training.training_snapshot_ref, TRAINING_SNAPSHOT);
    assert_eq!(training.session_count, 2);
    assert_eq!(training.sport_collection_count, 1);
    assert_eq!(training.omitted_sport_collection_count, 0);
    assert_eq!(training.sports.len(), 1);
    assert_eq!(training.sports[0].state, TrainingSportState::Unavailable);
    assert_eq!(training.sports[0].represented_collection_count, 1);
    assert_eq!(training.sports[0].session_count, 2);
    assert_eq!(training.recent_sessions.len(), 2);
    assert_eq!(
        training.recent_sessions[0].started_at_local,
        "2026-01-05T08:00:00"
    );
    assert_eq!(
        training.recent_sessions[1].started_at_local,
        "2026-01-04T08:00:00"
    );

    let LibraryHomeHighlight::RecentTrainingComparison(comparison) =
        home.highlight.expect("recent comparison")
    else {
        panic!("current training must produce a recent comparison")
    };
    assert_eq!(comparison.reference_date, "2026-01-10");
    assert_eq!(comparison.baseline.range.from, "2025-12-28");
    assert_eq!(comparison.baseline.range.through, "2026-01-03");
    assert_eq!(comparison.baseline.session_count, 0);
    assert_eq!(comparison.comparison.range.from, "2026-01-04");
    assert_eq!(comparison.comparison.range.through, "2026-01-10");
    assert_eq!(comparison.comparison.session_count, 2);
    assert_eq!(comparison.comparison.total_duration_milliseconds, 7_200_000);
    assert_eq!(comparison.session_count_change, 2);
    assert_eq!(comparison.duration_change_milliseconds, 7_200_000);
}

#[test]
fn reports_complete_history_and_bounded_aggregated_sports_instead_of_recent_coverage() {
    let mut port = representative_port();
    port.training_bounds = Some(training_range("2020-01-01", "2026-01-05"));
    port.sessions = (0..40)
        .map(|index| {
            let mut session = training_session(
                &format!("session-{index}"),
                if index < 2 {
                    "2026-01-05"
                } else {
                    "2020-01-01"
                },
                true,
            );
            session.sport_ref = Some(format!("source-sport-{}", index % 8));
            session
        })
        .collect();
    port.detected_sports = (0..8)
        .map(|index| classified_detected_sport(index, 5))
        .collect();

    let home = query_library_home(&port, LibraryHomeRequest::default()).expect("dense home");
    let training = home.training.expect("training identity");

    assert_eq!(home.domains[0].observed_record_count, 2);
    assert_eq!(training.session_count, 40);
    assert_eq!(training.sport_collection_count, 8);
    assert_eq!(training.sports.len(), 1);
    assert_eq!(
        training.sports[0].canonical_family.as_deref(),
        Some("running")
    );
    assert_eq!(
        training.sports[0].display_label.as_deref(),
        Some("Trail running")
    );
    assert_eq!(training.sports[0].represented_collection_count, 8);
    assert_eq!(training.sports[0].session_count, 40);
    assert_eq!(training.sports[0].sport_ref, None);
    assert_eq!(training.omitted_sport_collection_count, 0);
    assert_eq!(training.recent_sessions.len(), 4);
}

#[test]
fn preserves_each_unknown_profile_as_a_distinct_safe_home_identity() {
    let mut port = representative_port();
    port.training_bounds = Some(training_range("2026-01-02", "2026-01-05"));
    port.sessions = (0..4)
        .map(|index| {
            let mut session = training_session(
                &format!("session-{index}"),
                &format!("2026-01-{:02}", index + 2),
                true,
            );
            session.sport_ref = Some(format!("source-sport-{index}"));
            session
        })
        .collect();
    port.detected_sports = (0..4)
        .map(|index| unknown_detected_sport(index, 1))
        .collect();

    let home = query_library_home(&port, LibraryHomeRequest::default())
        .expect("distinct unresolved Home sports");
    let training = home.training.expect("training identity");

    assert_eq!(home.version, 6);
    assert_eq!(training.sport_collection_count, 4);
    assert_eq!(training.sports.len(), 4);
    assert_eq!(training.omitted_sport_collection_count, 0);
    assert!(training.sports.iter().all(|sport| {
        sport.state == TrainingSportState::Unknown && sport.represented_collection_count == 1
    }));
    let expected_refs = (0..4)
        .map(|index| format!("sport-{index:064x}"))
        .collect::<Vec<_>>();
    assert_eq!(
        training
            .sports
            .iter()
            .filter_map(|sport| sport.sport_ref.as_ref())
            .collect::<Vec<_>>(),
        expected_refs.iter().collect::<Vec<_>>()
    );
    assert_eq!(
        training
            .recent_sessions
            .iter()
            .filter_map(|session| session.sport_ref.as_ref())
            .collect::<BTreeSet<_>>(),
        expected_refs.iter().collect::<BTreeSet<_>>()
    );
}

#[test]
fn projects_recognized_sport_identity_into_home_and_recent_sessions() {
    let mut port = representative_port();
    port.sessions[0].sport_ref = Some("source-sport-0".to_owned());
    port.sessions[1].sport_ref = Some("source-sport-0".to_owned());
    port.detected_sports = vec![recognized_detected_sport(0, 2)];

    let training = query_library_home(&port, LibraryHomeRequest::default())
        .expect("recognized sport Home")
        .training
        .expect("training identity");

    assert_eq!(training.sports.len(), 1);
    assert_eq!(training.sports[0].state, TrainingSportState::Recognized);
    assert_eq!(
        training.sports[0].canonical_family.as_deref(),
        Some("running")
    );
    assert_eq!(training.sports[0].localized_names["en"], "Road running");
    assert_eq!(training.sports[0].recognition_candidate_count, 1);
    assert!(training.recent_sessions.iter().all(|session| {
        session.sport_state == TrainingSportState::Recognized
            && session.localized_names["en"] == "Road running"
            && session.recognition_candidate_count == 1
    }));
}

#[test]
fn combines_personally_identical_profiles_without_using_hidden_recognition_as_identity() {
    let mut port = representative_port();
    port.sessions[0].sport_ref = Some("source-sport-0".to_owned());
    port.sessions[1].sport_ref = Some("source-sport-1".to_owned());
    let mut first = classified_detected_sport_named(0, 1, "My running");
    first.recognition_candidates = vec![recognition_suggestion(
        "Road running",
        Some(SportFamily::Running),
    )];
    let mut second = classified_detected_sport_named(1, 1, "My running");
    second.recognition_candidates = vec![recognition_suggestion(
        "Trail running",
        Some(SportFamily::Running),
    )];
    port.detected_sports = vec![first, second];

    let training = query_library_home(&port, LibraryHomeRequest::default())
        .expect("personally grouped Home")
        .training
        .expect("training identity");

    assert_eq!(training.sports.len(), 1);
    assert_eq!(training.sports[0].represented_collection_count, 2);
    assert_eq!(training.sports[0].sport_ref, None);
    assert_eq!(
        training.sports[0].display_label.as_deref(),
        Some("My running")
    );
    assert!(training.sports[0].localized_names.is_empty());
    assert_eq!(training.sports[0].recognition_candidate_count, 0);
    assert_eq!(
        training
            .recent_sessions
            .iter()
            .map(|session| session.localized_names["en"].as_str())
            .collect::<BTreeSet<_>>(),
        BTreeSet::from(["Road running", "Trail running"])
    );
}

#[test]
fn bounds_distinct_sport_summaries_and_reports_the_omitted_collection_count() {
    let mut port = representative_port();
    port.training_bounds = Some(training_range("2026-01-04", "2026-01-10"));
    port.sessions = (0..7)
        .map(|index| {
            let mut session = training_session(
                &format!("session-{index}"),
                &format!("2026-01-{:02}", index + 4),
                true,
            );
            session.sport_ref = Some(format!("source-sport-{index}"));
            session
        })
        .collect();
    port.detected_sports = (0..7)
        .map(|index| {
            classified_detected_sport_named(index, 1, &format!("Running profile {}", index + 1))
        })
        .collect();

    let training = query_library_home(&port, LibraryHomeRequest::default())
        .expect("bounded sport Home")
        .training
        .expect("training identity");

    assert_eq!(training.sport_collection_count, 7);
    assert_eq!(training.sports.len(), 6);
    assert_eq!(training.omitted_sport_collection_count, 1);
    assert_eq!(
        training
            .sports
            .iter()
            .map(|sport| sport.represented_collection_count)
            .sum::<usize>(),
        6
    );
}

#[test]
fn uses_historical_and_non_training_fallbacks_without_implying_current_performance() {
    let mut historical = representative_port();
    historical.current_local_date = Some("2026-02-01".to_owned());
    let home = query_library_home(&historical, LibraryHomeRequest::default())
        .expect("historical training home");
    let LibraryHomeHighlight::HistoricalTraining(highlight) = home.highlight.expect("fallback")
    else {
        panic!("old-only history must use the historical fallback")
    };
    assert_eq!(highlight.latest_session_date, "2026-01-05");
    assert_eq!(highlight.current_range.from, "2026-01-26");
    assert_eq!(highlight.current_range.through, "2026-02-01");
    assert_eq!(
        highlight.reason,
        HistoricalTrainingReason::NoCurrentTraining
    );

    let mut future = representative_port();
    future.current_local_date = Some("2025-12-31".to_owned());
    let home = query_library_home(&future, LibraryHomeRequest::default())
        .expect("future-dated training Home");
    let LibraryHomeHighlight::HistoricalTraining(highlight) = home.highlight.expect("fallback")
    else {
        panic!("future-dated history must use the historical fallback")
    };
    assert_eq!(
        highlight.reason,
        HistoricalTrainingReason::HistoryAfterReferenceDate
    );

    let activity_only = ControlledLibraryHomePort {
        activity_bounds: Some(activity_range("2026-01-01", "2026-01-01")),
        activity_step_bounds: Some(activity_range("2026-01-01", "2026-01-01")),
        activity_origins: vec!["origin-a".to_owned()],
        activities: vec![DailyActivity {
            origin_id: "origin-a".to_owned(),
            local_date: "2026-01-01".to_owned(),
            step_count: Some(3_100),
        }],
        ..ControlledLibraryHomePort::default()
    };
    let home = query_library_home(&activity_only, LibraryHomeRequest::default())
        .expect("non-training home");
    assert_eq!(home.training, None);
    assert_eq!(
        home.highlight,
        Some(LibraryHomeHighlight::LibraryHistory(
            LibraryHistoryHighlight {
                latest_evidence_date: "2026-01-01".to_owned(),
            }
        ))
    );
}

#[test]
fn retries_one_changed_library_revision_and_fails_closed_on_a_second_change() {
    let retrying = representative_port();
    *retrying.revision_reads.lock().expect("revision reads") = VecDeque::from([
        revision_ref('a'),
        revision_ref('b'),
        revision_ref('b'),
        revision_ref('b'),
    ]);
    assert_eq!(
        query_library_home(&retrying, LibraryHomeRequest::default())
            .expect("retried coherent home")
            .library_revision_ref,
        revision_ref('b')
    );

    let changing = representative_port();
    *changing.revision_reads.lock().expect("revision reads") = VecDeque::from([
        revision_ref('a'),
        revision_ref('b'),
        revision_ref('c'),
        revision_ref('d'),
    ]);
    assert!(matches!(
        query_library_home(&changing, LibraryHomeRequest::default()),
        Err(ApplicationError::Query(reason)) if reason.contains("changed while Home was composed")
    ));
}

#[test]
fn retries_a_transient_composition_failure_only_when_the_outer_revision_changed() {
    let retrying = representative_port();
    *retrying.revision_reads.lock().expect("revision reads") = VecDeque::from([
        revision_ref('a'),
        revision_ref('b'),
        revision_ref('b'),
        revision_ref('b'),
    ]);
    *retrying
        .current_local_date_reads
        .lock()
        .expect("current local date reads") =
        VecDeque::from(["not-a-date".to_owned(), "2026-01-10".to_owned()]);

    assert_eq!(
        query_library_home(&retrying, LibraryHomeRequest::default())
            .expect("retried coherent Home")
            .library_revision_ref,
        revision_ref('b')
    );

    let stable = representative_port();
    *stable
        .current_local_date_reads
        .lock()
        .expect("current local date reads") = VecDeque::from(["not-a-date".to_owned()]);
    assert!(matches!(
        query_library_home(&stable, LibraryHomeRequest::default()),
        Err(ApplicationError::Query(reason)) if reason.contains("local calendar date is invalid")
    ));
}

#[test]
fn retries_a_stale_training_snapshot_without_returning_mixed_training_evidence() {
    let port = representative_port();
    *port
        .training_snapshot_reads
        .lock()
        .expect("training snapshot reads") = VecDeque::from([
        snapshot_ref('a'),
        snapshot_ref('b'),
        snapshot_ref('b'),
        snapshot_ref('b'),
        snapshot_ref('b'),
    ]);

    let home =
        query_library_home(&port, LibraryHomeRequest::default()).expect("retried training Home");

    assert_eq!(
        home.training
            .expect("coherent training identity")
            .training_snapshot_ref,
        snapshot_ref('b')
    );
}

#[test]
fn returns_an_empty_home_without_querying_unavailable_facts_or_an_unrequested_outcome() {
    struct EmptyPort;

    impl ActivityLibraryPort for EmptyPort {
        fn activity_bounds(&self) -> Result<Option<ActivityDateRange>, String> {
            Ok(None)
        }

        fn activity_origins(&self) -> Result<Vec<String>, String> {
            panic!("empty activity must stop at bounds")
        }

        fn query_activity(&self, _range: &ActivityDateRange) -> Result<Vec<DailyActivity>, String> {
            panic!("empty activity must not query facts")
        }
    }

    impl LibraryHomeMeasurementRangePort for EmptyPort {
        fn activity_step_bounds(&self) -> Result<Option<ActivityDateRange>, String> {
            Ok(None)
        }
    }

    impl TrainingLibraryPort for EmptyPort {
        fn training_bounds(&self) -> Result<Option<TrainingDateRange>, String> {
            Ok(None)
        }

        fn training_origins(&self) -> Result<Vec<String>, String> {
            panic!("empty training must stop at bounds")
        }

        fn query_training(
            &self,
            _range: &TrainingDateRange,
        ) -> Result<Vec<TrainingSession>, String> {
            panic!("empty training must not query facts")
        }
    }

    impl TrainingSessionDiscoveryPort for EmptyPort {
        fn query_training_sessions(
            &self,
            _request: &TrainingSessionSearchRequest,
        ) -> Result<PersistedTrainingSessionSearchPage, TrainingSessionDiscoveryPortError> {
            Ok(PersistedTrainingSessionSearchPage {
                available_range: None,
                snapshot_ref: TRAINING_SNAPSHOT.to_owned(),
                total_count: 0,
                summaries: Vec::new(),
                sessions: Vec::new(),
            })
        }

        fn query_training_calendar(
            &self,
            _request: &TrainingSessionCalendarRequest,
        ) -> Result<PersistedTrainingSessionCalendar, TrainingSessionDiscoveryPortError> {
            panic!("the library home never queries the training calendar")
        }

        fn query_training_session_selection(
            &self,
            _request: &TrainingSessionSelectionRequest,
        ) -> Result<PersistedTrainingSessionSelection, TrainingSessionDiscoveryPortError> {
            panic!("the library home never resolves a training selection")
        }
    }

    impl TrainingSportsPort for EmptyPort {
        fn query_detected_training_sports(&self) -> Result<Vec<DetectedTrainingSport>, String> {
            Ok(Vec::new())
        }

        fn find_detected_training_sport(
            &self,
            _sport_ref: &str,
        ) -> Result<Option<DetectedTrainingSport>, String> {
            panic!("the library home never resolves an editable sport")
        }

        fn compare_and_save_sport_classification(
            &self,
            _expected_revision: u64,
            _classification: &SportClassification,
        ) -> Result<bool, String> {
            panic!("the library home never saves sport meaning")
        }
    }

    impl LibraryHomeRevisionPort for EmptyPort {
        fn library_home_revision_ref(&self) -> Result<String, String> {
            Ok(HOME_REVISION.to_owned())
        }
    }

    impl LibraryHomeClockPort for EmptyPort {
        fn current_local_date(&self) -> Result<String, String> {
            Ok("2026-01-10".to_owned())
        }
    }

    impl SleepLibraryPort for EmptyPort {
        fn sleep_bounds(&self) -> Result<Option<SleepDateRange>, String> {
            Ok(None)
        }

        fn sleep_origins(&self) -> Result<Vec<String>, String> {
            panic!("empty sleep must stop at bounds")
        }

        fn query_sleep(&self, _range: &SleepDateRange) -> Result<Vec<SleepLibraryPeriod>, String> {
            panic!("empty sleep must not query facts")
        }

        fn query_sleep_period(
            &self,
            _series_ref: &str,
            _sleep_date: &str,
        ) -> Result<Option<SleepPeriod>, String> {
            panic!("empty sleep must not query detail")
        }
    }

    impl RecoveryLibraryPort for EmptyPort {
        fn recovery_bounds(&self) -> Result<Option<RecoveryDateRange>, String> {
            Ok(None)
        }

        fn recovery_origins(&self) -> Result<Vec<String>, String> {
            panic!("empty recovery must stop at bounds")
        }

        fn query_recovery(
            &self,
            _range: &RecoveryDateRange,
        ) -> Result<Vec<RecoveryLibraryNight>, String> {
            panic!("empty recovery must not query facts")
        }

        fn query_recovery_night(
            &self,
            _series_ref: &str,
            _recovery_date: &str,
        ) -> Result<Option<NightlyRecovery>, String> {
            panic!("empty recovery must not query detail")
        }
    }

    impl ImportOutcomeLibraryPort for EmptyPort {
        fn latest_import_outcome(&self) -> Result<Option<ImportOutcome>, String> {
            panic!("an ordinary home load must not query import diagnostics")
        }
    }

    impl ExplorationWorkspacePort for EmptyPort {
        fn load_exploration_workspace(&self) -> Result<Option<StoredExplorationWorkspace>, String> {
            Ok(None)
        }

        fn save_exploration_workspace(
            &self,
            _workspace: &ExplorationWorkspace,
        ) -> Result<(), String> {
            panic!("an empty home must not save a workspace")
        }

        fn clear_exploration_workspace(&self) -> Result<(), String> {
            panic!("an empty home must not clear a workspace")
        }
    }

    let home = query_library_home(&EmptyPort, LibraryHomeRequest::default()).expect("empty home");

    assert_eq!(home.version, 6);
    assert_eq!(home.library_revision_ref, HOME_REVISION);
    assert_eq!(home.recorded_range, None);
    assert_eq!(home.usable_range, None);
    assert_eq!(home.primary_range, None);
    assert_eq!(home.domains.len(), 4);
    assert!(home.domains.iter().all(|domain| {
        domain.recorded_range.is_none()
            && domain.usable_range.is_none()
            && domain.selected_range.is_none()
            && domain.origin_count == 0
            && domain.observed_record_count == 0
            && domain.measurements.is_empty()
    }));
    assert!(home.questions.is_empty());
    assert_eq!(home.training, None);
    assert_eq!(home.highlight, None);
    assert_eq!(home.post_import, None);
    assert_eq!(home.resumable_exploration, None);
}

#[test]
fn withholds_questions_that_the_current_canonical_measurements_cannot_answer() {
    let port = ControlledLibraryHomePort {
        activity_bounds: Some(activity_range("2026-01-01", "2026-01-01")),
        activity_origins: vec!["origin-a".to_owned()],
        activities: vec![DailyActivity {
            origin_id: "origin-a".to_owned(),
            local_date: "2026-01-01".to_owned(),
            step_count: None,
        }],
        ..ControlledLibraryHomePort::default()
    };

    let home = query_library_home(&port, LibraryHomeRequest::default()).expect("partial home");

    assert_eq!(home.domains[1].observed_record_count, 1);
    assert_eq!(
        home.domains[1].measurements,
        vec![LibraryMeasurementCoverage::new(
            LibraryMeasurement::ActivitySteps,
            0,
            1,
        )]
    );
    assert!(home.questions.is_empty());
}

#[test]
fn reveals_only_the_matching_completed_import_and_rejects_blank_references() {
    let mut port = representative_port();

    let home = query_library_home(
        &port,
        LibraryHomeRequest {
            after_import_operation_ref: Some("another-operation".to_owned()),
        },
    )
    .expect("home after superseded import");
    assert_eq!(home.post_import, None);

    let outcome = port.outcome.as_mut().expect("controlled outcome");
    outcome.exact_repeat = true;
    outcome.canonical_history_changed = false;
    outcome.coverage.total = 7;
    outcome.coverage.unsupported = 0;
    outcome.report.new_observations = 0;
    outcome.report.enriched_observations = 0;
    outcome.report.amended_observations = 0;
    let home = query_library_home(
        &port,
        LibraryHomeRequest {
            after_import_operation_ref: Some("operation-accepted".to_owned()),
        },
    )
    .expect("home after exact repeat");
    assert_eq!(
        home.post_import,
        Some(PostImportReveal {
            exact_repeat: true,
            canonical_history_changed: false,
            new_observations: 0,
            enriched_observations: 0,
            amended_observations: 0,
            unchanged_observations: 1,
            source_review_recommended: false,
        })
    );

    port.outcome.as_mut().expect("controlled outcome").state = ImportOperationState::Failed;
    let home = query_library_home(
        &port,
        LibraryHomeRequest {
            after_import_operation_ref: Some("operation-accepted".to_owned()),
        },
    )
    .expect("home after failed import");
    assert_eq!(home.post_import, None);

    assert!(matches!(
        query_library_home(
            &port,
            LibraryHomeRequest {
                after_import_operation_ref: Some(" ".to_owned()),
            },
        ),
        Err(ApplicationError::InvalidLibraryHomeRequest(_))
    ));
}

#[test]
fn persists_only_answerable_exploration_destinations_and_clears_them_explicitly() {
    let port = representative_port();

    let saved = save_exploration_workspace(&port, ExploreDestination::Recovery)
        .expect("answerable workspace");
    assert_eq!(
        saved,
        ExplorationWorkspace {
            version: 1,
            destination: ExploreDestination::Recovery,
        }
    );
    assert_eq!(
        query_library_home(&port, LibraryHomeRequest::default())
            .expect("home with recovery workspace")
            .resumable_exploration,
        Some(saved)
    );

    clear_exploration_workspace(&port).expect("clear workspace");
    assert_eq!(
        query_library_home(&port, LibraryHomeRequest::default())
            .expect("home without workspace")
            .resumable_exploration,
        None
    );

    let partial = ControlledLibraryHomePort {
        activity_bounds: Some(activity_range("2026-01-01", "2026-01-01")),
        activity_origins: vec!["origin-a".to_owned()],
        activities: vec![DailyActivity {
            origin_id: "origin-a".to_owned(),
            local_date: "2026-01-01".to_owned(),
            step_count: None,
        }],
        ..ControlledLibraryHomePort::default()
    };
    assert!(matches!(
        save_exploration_workspace(&partial, ExploreDestination::Activity),
        Err(ApplicationError::InvalidExplorationWorkspace(_))
    ));
}

#[test]
fn ignores_obsolete_or_stale_workspace_state_without_hiding_home() {
    let mut port = representative_port();
    *port.workspace.lock().expect("workspace lock") = Some(StoredExplorationWorkspace {
        version: 2,
        destination: "training".to_owned(),
    });
    assert_eq!(
        query_library_home(&port, LibraryHomeRequest::default())
            .expect("home with obsolete workspace")
            .resumable_exploration,
        None
    );

    *port.workspace.lock().expect("workspace lock") = Some(StoredExplorationWorkspace {
        version: 1,
        destination: "unknown".to_owned(),
    });
    assert_eq!(
        query_library_home(&port, LibraryHomeRequest::default())
            .expect("home with unknown workspace")
            .resumable_exploration,
        None
    );

    *port.workspace.lock().expect("workspace lock") = Some(StoredExplorationWorkspace {
        version: 1,
        destination: "activity".to_owned(),
    });
    port.activities[0].step_count = None;
    assert_eq!(
        query_library_home(&port, LibraryHomeRequest::default())
            .expect("home with stale workspace")
            .resumable_exploration,
        None
    );
}
