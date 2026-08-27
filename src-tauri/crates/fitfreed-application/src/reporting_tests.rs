use std::{path::Path, sync::Mutex};

use fitfreed_domain::{
    author_session_report, PlannedTrainingCompletion, PlannedTrainingEditability,
    PlannedTrainingExercise, PlannedTrainingExerciseKind, PlannedTrainingIntensity,
    PlannedTrainingIntensityMetric, PlannedTrainingMappingCoverage, PlannedTrainingPhase,
    PlannedTrainingPhaseChange, PlannedTrainingPhaseGoal, PlannedTrainingSport,
    PlannedTrainingTarget, PlannedTrainingTargetKind, PlannedTrainingTransition, ReportBlock,
    ReportBlockContent, ReportDateRange, ReportDefinition, ReportLocale, ReportOrigin,
    ReportQuestion, ReportTrainingComparisonQuery, ReportTrainingMetric, TrainingSession,
    REPORT_DEFINITION_VERSION, REPORT_DEFINITION_VERSION_V1,
};

use super::*;

const REPORT_REF: &str = "report-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const DUPLICATE_REPORT_REF: &str =
    "report-8888888888888888888888888888888888888888888888888888888888888888";
const SESSION_BLOCK_REF: &str =
    "report-block-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const NARRATIVE_BLOCK_REF: &str =
    "report-block-abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
const ROUTE_BLOCK_REF: &str =
    "report-block-1111111111111111111111111111111111111111111111111111111111111111";
const SESSION_REF: &str =
    "session-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const SNAPSHOT_REF: &str =
    "training-snapshot-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const CHANGED_SNAPSHOT_REF: &str =
    "training-snapshot-abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
const LATER_SNAPSHOT_REF: &str =
    "training-snapshot-2222222222222222222222222222222222222222222222222222222222222222";
const ROUTE_REF: &str = "route-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const EXERCISE_REF: &str =
    "exercise-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const PLANNED_TARGET_REF: &str =
    "planned-target-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const PLANNED_EVIDENCE_REF: &str =
    "planned-evidence-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const PLANNED_SNAPSHOT_REF: &str =
    "planned-snapshot-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const CHANGED_PLANNED_SNAPSHOT_REF: &str =
    "planned-snapshot-abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

#[derive(Default)]
struct MemoryReportPort {
    reports: Mutex<Vec<ReportDefinition>>,
    next_report: Mutex<usize>,
    next_block: Mutex<usize>,
    reject_saves: bool,
}

impl ReportDefinitionPort for MemoryReportPort {
    fn new_report_ref(&self) -> Result<String, ReportDefinitionPortError> {
        let mut next = self.next_report.lock().expect("report sequence");
        let report_ref = [REPORT_REF, DUPLICATE_REPORT_REF]
            .get(*next)
            .map(|value| (*value).to_owned())
            .unwrap_or_else(|| {
                let digit = char::from_digit(u32::try_from(*next + 7).expect("report digit"), 16)
                    .expect("hexadecimal report digit");
                format!("report-{}", digit.to_string().repeat(64))
            });
        *next += 1;
        Ok(report_ref)
    }

    fn new_report_block_ref(&self) -> Result<String, ReportDefinitionPortError> {
        let mut next = self.next_block.lock().expect("block sequence");
        let block_ref = [SESSION_BLOCK_REF, ROUTE_BLOCK_REF, NARRATIVE_BLOCK_REF]
            .get(*next)
            .map(|value| (*value).to_owned())
            .unwrap_or_else(|| {
                let digit = char::from_digit(u32::try_from(*next - 1).expect("block digit"), 16)
                    .expect("hexadecimal block digit");
                format!("report-block-{}", digit.to_string().repeat(64))
            });
        *next += 1;
        Ok(block_ref)
    }

    fn create_report_definition(
        &self,
        definition: &ReportDefinition,
    ) -> Result<(), ReportDefinitionPortError> {
        self.reports
            .lock()
            .expect("reports")
            .push(definition.clone());
        Ok(())
    }

    fn load_report_definition(
        &self,
        report_ref: &str,
    ) -> Result<Option<ReportDefinition>, ReportDefinitionPortError> {
        Ok(self
            .reports
            .lock()
            .expect("reports")
            .iter()
            .find(|report| report.report_ref() == report_ref)
            .cloned())
    }

    fn list_report_definitions(&self) -> Result<Vec<ReportDefinition>, ReportDefinitionPortError> {
        Ok(self.reports.lock().expect("reports").clone())
    }

    fn compare_and_save_report_definition(
        &self,
        expected_revision: u64,
        definition: &ReportDefinition,
    ) -> Result<bool, ReportDefinitionPortError> {
        if self.reject_saves {
            return Ok(false);
        }
        let mut reports = self.reports.lock().expect("reports");
        let Some(existing) = reports
            .iter_mut()
            .find(|report| report.report_ref() == definition.report_ref())
        else {
            return Err(ReportDefinitionPortError::NotFound);
        };
        if existing.revision() != expected_revision {
            return Ok(false);
        }
        *existing = definition.clone();
        Ok(true)
    }

    fn compare_and_remove_report_definition(
        &self,
        report_ref: &str,
        expected_revision: u64,
    ) -> Result<bool, ReportDefinitionPortError> {
        let mut reports = self.reports.lock().expect("reports");
        let Some(index) = reports
            .iter()
            .position(|report| report.report_ref() == report_ref)
        else {
            return Err(ReportDefinitionPortError::NotFound);
        };
        if reports[index].revision() != expected_revision {
            return Ok(false);
        }
        reports.remove(index);
        Ok(true)
    }
}

struct StubTrainingPort {
    snapshot_ref: String,
}

struct MissingTrainingPort;

struct NoComparisonPort;

struct NoPlannedTrainingPort;

#[derive(Clone)]
struct StubPlannedTrainingPort {
    snapshot_ref: String,
    target: Option<PersistedPlannedTrainingTarget>,
}

impl PlannedTrainingQueryPort for StubPlannedTrainingPort {
    fn planned_training_snapshot_ref(
        &self,
    ) -> Result<Option<String>, PlannedTrainingQueryPortError> {
        Ok(Some(self.snapshot_ref.clone()))
    }

    fn query_planned_training_chronology(
        &self,
        _query: &PlannedTrainingChronologyQuery,
    ) -> Result<PersistedPlannedTrainingChronologyPage, PlannedTrainingQueryPortError> {
        unreachable!("planned reports resolve one exact target")
    }

    fn query_planned_training_target(
        &self,
        query: &PlannedTrainingTargetQuery,
    ) -> Result<PersistedPlannedTrainingTargetDetail, PlannedTrainingQueryPortError> {
        if query
            .snapshot_ref
            .as_ref()
            .is_some_and(|expected| expected != &self.snapshot_ref)
        {
            return Err(PlannedTrainingQueryPortError::SnapshotChanged);
        }
        let target = self
            .target
            .clone()
            .ok_or(PlannedTrainingQueryPortError::NotFound)?;
        if target.target.target_id() != query.target_ref {
            return Err(PlannedTrainingQueryPortError::NotFound);
        }
        Ok(PersistedPlannedTrainingTargetDetail {
            snapshot_ref: self.snapshot_ref.clone(),
            target,
        })
    }

    fn query_session_planned_training_candidates(
        &self,
        _query: &PlannedTrainingSessionRelationQuery,
    ) -> Result<PersistedSessionPlannedTrainingCandidates, PlannedTrainingQueryPortError> {
        unreachable!("planned reports do not infer recorded-session relationships")
    }
}

impl PlannedTrainingQueryPort for NoPlannedTrainingPort {
    fn planned_training_snapshot_ref(
        &self,
    ) -> Result<Option<String>, PlannedTrainingQueryPortError> {
        Ok(None)
    }

    fn query_planned_training_chronology(
        &self,
        _query: &PlannedTrainingChronologyQuery,
    ) -> Result<PersistedPlannedTrainingChronologyPage, PlannedTrainingQueryPortError> {
        unreachable!("reports without planned-training evidence do not query its chronology")
    }

    fn query_planned_training_target(
        &self,
        _query: &PlannedTrainingTargetQuery,
    ) -> Result<PersistedPlannedTrainingTargetDetail, PlannedTrainingQueryPortError> {
        unreachable!("reports without planned-training evidence do not query its targets")
    }

    fn query_session_planned_training_candidates(
        &self,
        _query: &PlannedTrainingSessionRelationQuery,
    ) -> Result<PersistedSessionPlannedTrainingCandidates, PlannedTrainingQueryPortError> {
        unreachable!("reports without planned-training evidence do not query its relationships")
    }
}

impl TrainingLibraryPort for NoComparisonPort {
    fn training_bounds(&self) -> Result<Option<TrainingDateRange>, String> {
        unreachable!("reports without analytical blocks do not query comparison bounds")
    }

    fn training_origins(&self) -> Result<Vec<String>, String> {
        unreachable!("reports without analytical blocks do not query comparison origins")
    }

    fn query_training(&self, _range: &TrainingDateRange) -> Result<Vec<TrainingSession>, String> {
        unreachable!("reports without analytical blocks do not query comparison sessions")
    }
}

struct AnalyticalTrainingPort {
    snapshot_ref: String,
    queries: Mutex<Vec<TrainingDateRange>>,
}

struct SequencedSnapshotPort {
    snapshots: Mutex<Vec<String>>,
}

impl TrainingLibraryPort for SequencedSnapshotPort {
    fn training_snapshot_ref(&self) -> Result<Option<String>, String> {
        let mut snapshots = self.snapshots.lock().expect("snapshot sequence");
        if snapshots.is_empty() {
            return Ok(None);
        }
        Ok(Some(snapshots.remove(0)))
    }

    fn training_bounds(&self) -> Result<Option<TrainingDateRange>, String> {
        unreachable!("authored-only reports do not query training bounds")
    }

    fn training_origins(&self) -> Result<Vec<String>, String> {
        unreachable!("authored-only reports do not query training origins")
    }

    fn query_training(&self, _range: &TrainingDateRange) -> Result<Vec<TrainingSession>, String> {
        unreachable!("authored-only reports do not query training sessions")
    }
}

impl AnalyticalTrainingPort {
    fn current() -> Self {
        Self {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
            queries: Mutex::new(Vec::new()),
        }
    }
}

impl TrainingLibraryPort for AnalyticalTrainingPort {
    fn training_snapshot_ref(&self) -> Result<Option<String>, String> {
        Ok(Some(self.snapshot_ref.clone()))
    }

    fn training_bounds(&self) -> Result<Option<TrainingDateRange>, String> {
        Ok(Some(TrainingDateRange {
            from: "2026-01-01".to_owned(),
            through: "2026-03-01".to_owned(),
        }))
    }

    fn training_origins(&self) -> Result<Vec<String>, String> {
        Ok(vec!["origin-one".to_owned()])
    }

    fn query_training(&self, range: &TrainingDateRange) -> Result<Vec<TrainingSession>, String> {
        self.queries
            .lock()
            .expect("comparison queries")
            .push(range.clone());
        let starts = if range.from == "2026-01-01" {
            vec!["2026-01-10T08:00:00.000"]
        } else {
            vec!["2026-02-10T08:00:00.000", "2026-02-11T08:00:00.000"]
        };
        Ok(starts
            .into_iter()
            .enumerate()
            .map(|(index, started_at_local)| TrainingSession {
                origin_id: "origin-one".to_owned(),
                session_id: format!("comparison-session-{index}-{started_at_local}"),
                started_at_local: started_at_local.to_owned(),
                stopped_at_local: started_at_local.replace("08:00", "09:00"),
                utc_offset_minutes: Some(60),
                duration_milliseconds: 3_600_000,
                distance_meters: Some(10_000.0),
                energy_kilocalories: Some(500),
                average_heart_rate_bpm: Some(140),
                maximum_heart_rate_bpm: Some(170),
                sport_ref: None,
                exercise_count: Some(1),
            })
            .collect())
    }
}

impl TrainingSessionDiscoveryPort for StubTrainingPort {
    fn query_training_sessions(
        &self,
        _request: &TrainingSessionSearchRequest,
    ) -> Result<PersistedTrainingSessionSearchPage, TrainingSessionDiscoveryPortError> {
        unreachable!("reports resolve exact sessions")
    }

    fn query_training_calendar(
        &self,
        _request: &TrainingSessionCalendarRequest,
    ) -> Result<PersistedTrainingSessionCalendar, TrainingSessionDiscoveryPortError> {
        unreachable!("reports resolve exact sessions")
    }

    fn query_training_session_selection(
        &self,
        request: &TrainingSessionSelectionRequest,
    ) -> Result<PersistedTrainingSessionSelection, TrainingSessionDiscoveryPortError> {
        if request
            .snapshot_ref
            .as_ref()
            .is_some_and(|expected| expected != &self.snapshot_ref)
        {
            return Err(TrainingSessionDiscoveryPortError::SnapshotChanged);
        }
        Ok(PersistedTrainingSessionSelection {
            snapshot_ref: self.snapshot_ref.clone(),
            sessions: vec![session()],
        })
    }
}

impl TrainingSessionDiscoveryPort for MissingTrainingPort {
    fn query_training_sessions(
        &self,
        _request: &TrainingSessionSearchRequest,
    ) -> Result<PersistedTrainingSessionSearchPage, TrainingSessionDiscoveryPortError> {
        unreachable!("report library resolves exact sessions")
    }

    fn query_training_calendar(
        &self,
        _request: &TrainingSessionCalendarRequest,
    ) -> Result<PersistedTrainingSessionCalendar, TrainingSessionDiscoveryPortError> {
        unreachable!("report library resolves exact sessions")
    }

    fn query_training_session_selection(
        &self,
        _request: &TrainingSessionSelectionRequest,
    ) -> Result<PersistedTrainingSessionSelection, TrainingSessionDiscoveryPortError> {
        Err(TrainingSessionDiscoveryPortError::Failure(
            "session is unavailable".to_owned(),
        ))
    }
}

struct StubProvenancePort;

impl TrainingSessionProvenancePort for StubProvenancePort {
    fn query_training_session_provenance(
        &self,
        query: &TrainingSessionProvenanceQuery,
    ) -> Result<PersistedTrainingSessionProvenance, TrainingSessionProvenancePortError> {
        Ok(PersistedTrainingSessionProvenance {
            snapshot_ref: query
                .snapshot_ref
                .clone()
                .unwrap_or_else(|| SNAPSHOT_REF.to_owned()),
            session_ref: query.session_ref.clone(),
            total_event_count: 1,
            current: TrainingProvenanceCurrentView {
                provider: TrainingSourceProviderView::restore("source-provider".to_owned())
                    .expect("provider"),
                source_modified_at_utc: "2026-08-18T08:00:00Z".to_owned(),
                source_adapter_version: "source-adapter@10".to_owned(),
                mapping_version: "training-mapping@5".to_owned(),
                contributing_event_count: 1,
                non_contributing_event_count: 0,
            },
            events: vec![TrainingProvenanceEventView {
                ordinal: 0,
                observed_at_utc: "2026-08-18T09:00:00Z".to_owned(),
                source_modified_at_utc: "2026-08-18T08:00:00Z".to_owned(),
                provider: TrainingSourceProviderView::restore("source-provider".to_owned())
                    .expect("provider"),
                source_adapter_version: "source-adapter@10".to_owned(),
                mapping_version: "training-mapping@5".to_owned(),
                decision: TrainingProvenanceDecisionView::Create,
                contributes_to_visible_state: true,
            }],
        })
    }
}

struct StubRoutePort;

impl TrainingSessionRoutePort for StubRoutePort {
    fn query_training_session_routes(
        &self,
        query: &TrainingSessionRouteQuery,
    ) -> Result<PersistedTrainingSessionRoutes, TrainingSessionRoutePortError> {
        Ok(PersistedTrainingSessionRoutes {
            snapshot_ref: query
                .snapshot_ref
                .clone()
                .unwrap_or_else(|| SNAPSHOT_REF.to_owned()),
            session_ref: query.session_ref.clone(),
            routes: Some(TrainingSessionRoutesView {
                exercises: Some(vec![TrainingExerciseRoutesView {
                    exercise_ref: EXERCISE_REF.to_owned(),
                    ordinal: 0,
                    routes: Some(TrainingRouteCollectionView {
                        primary: Some(route_overview()),
                        transition: None,
                    }),
                }]),
            }),
        })
    }

    fn query_training_route_points(
        &self,
        query: &TrainingRoutePointsQuery,
    ) -> Result<PersistedTrainingRoutePoints, TrainingSessionRoutePortError> {
        let all = route_points();
        let through = (query.offset + query.limit).min(all.len());
        let points = all.get(query.offset..through).unwrap_or(&[]).to_vec();
        Ok(PersistedTrainingRoutePoints {
            snapshot_ref: query
                .snapshot_ref
                .clone()
                .unwrap_or_else(|| SNAPSHOT_REF.to_owned()),
            session_ref: query.session_ref.clone(),
            route_ref: query.route_ref.clone(),
            point_count: all.len(),
            offset: query.offset,
            next_offset: (through < all.len()).then_some(through),
            points,
        })
    }
}

struct CancellingRoutePort<'a> {
    cancellation: &'a ReportExportCancellation,
}

impl TrainingSessionRoutePort for CancellingRoutePort<'_> {
    fn query_training_session_routes(
        &self,
        query: &TrainingSessionRouteQuery,
    ) -> Result<PersistedTrainingSessionRoutes, TrainingSessionRoutePortError> {
        StubRoutePort.query_training_session_routes(query)
    }

    fn query_training_route_points(
        &self,
        query: &TrainingRoutePointsQuery,
    ) -> Result<PersistedTrainingRoutePoints, TrainingSessionRoutePortError> {
        self.cancellation.cancel();
        StubRoutePort.query_training_route_points(query)
    }
}

fn route_points() -> Vec<TrainingRoutePointView> {
    (0..=10)
        .map(|ordinal| TrainingRoutePointView {
            ordinal,
            latitude_degrees: 40.0,
            longitude_degrees: -3.0 + ordinal as f64 * 0.001,
            altitude_meters: None,
            elapsed_milliseconds: Some(ordinal as i64 * 60_000),
        })
        .collect()
}

fn route_overview() -> TrainingRouteOverview {
    let points = route_points();
    TrainingRouteOverview {
        route_ref: ROUTE_REF.to_owned(),
        kind: TrainingRouteKindView::Primary,
        started_at_local: "2026-08-18T07:30:00.000".to_owned(),
        point_count: points.len(),
        altitude_point_count: 0,
        elapsed_point_count: points.len(),
        visual_points: points,
    }
}

#[derive(Default)]
struct RecordingExportPort {
    exports: Mutex<Vec<AuthorizedSessionReportExport>>,
}

impl ReportExportPort for RecordingExportPort {
    fn export_report(
        &self,
        report: &AuthorizedSessionReportExport,
        _destination: &Path,
        cancellation: &ReportExportCancellation,
    ) -> Result<ReportExportReceipt, ReportExportPortError> {
        if cancellation.is_cancelled() {
            return Err(ReportExportPortError::Cancelled);
        }
        self.exports.lock().expect("exports").push(report.clone());
        Ok(ReportExportReceipt { byte_count: 512 })
    }
}

fn session() -> TrainingSessionSearchItem {
    TrainingSessionSearchItem {
        session_ref: SESSION_REF.to_owned(),
        sport_filter_ref: "sport-ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
            .to_owned(),
        source_index: 1,
        started_at_local: "2026-08-18T07:30:00.000".to_owned(),
        stopped_at_local: "2026-08-18T08:30:00.000".to_owned(),
        utc_offset_minutes: Some(120),
        duration_milliseconds: 3_600_000,
        distance_meters: Some(10_000.0),
        energy_kilocalories: None,
        average_heart_rate_bpm: Some(148),
        maximum_heart_rate_bpm: Some(172),
        exercise_count: Some(1),
        sport: TrainingSessionSport {
            sport_ref: None,
            state: TrainingSportState::Unavailable,
            classification: None,
            recognition: None,
            recognition_candidate_count: 0,
        },
    }
}

fn planned_target() -> PersistedPlannedTrainingTarget {
    PersistedPlannedTrainingTarget {
        source_index: 1,
        reconciliation_state: PlannedTrainingReconciliationState::Current,
        target: PlannedTrainingTarget::restore(
            "origin-one",
            PLANNED_TARGET_REF,
            PLANNED_EVIDENCE_REF,
            PlannedTrainingTargetKind::Scheduled {
                scheduled_at_local: "2026-08-30T08:00:00".to_owned(),
                completion: PlannedTrainingCompletion::Pending,
            },
            "Progressive intervals",
            Some("Four controlled efforts with recovery.".to_owned()),
            PlannedTrainingEditability::Editable,
            Some(vec![PlannedTrainingExercise {
                exercise_id: format!("planned-exercise-{}", "1".repeat(64)),
                ordinal: 0,
                kind: PlannedTrainingExerciseKind::Phased,
                duration_goal_milliseconds: Some(1_800_000),
                distance_goal_meters: None,
                sport: PlannedTrainingSport::Unavailable,
                phases: Some(vec![PlannedTrainingPhase {
                    phase_id: format!("planned-phase-{}", "2".repeat(64)),
                    ordinal: 0,
                    name: "Controlled effort".to_owned(),
                    goal: PlannedTrainingPhaseGoal::DurationMilliseconds(300_000),
                    intensity: PlannedTrainingIntensity::ZoneRange {
                        metric: PlannedTrainingIntensityMetric::HeartRate,
                        lower_zone: 2,
                        upper_zone: 4,
                    },
                    transition: PlannedTrainingTransition {
                        transition_id: format!("planned-transition-{}", "3".repeat(64)),
                        change: PlannedTrainingPhaseChange::Automatic,
                        repeat: None,
                    },
                }]),
            }]),
            PlannedTrainingMappingCoverage::complete(),
        )
        .expect("planned target"),
        candidate_session_refs: Vec::new(),
    }
}

fn planned_port(snapshot_ref: &str) -> StubPlannedTrainingPort {
    StubPlannedTrainingPort {
        snapshot_ref: snapshot_ref.to_owned(),
        target: Some(planned_target()),
    }
}

fn creation() -> CreateSessionReportRequest {
    CreateSessionReportRequest {
        title: "Morning progression".to_owned(),
        locale: ReportLocale::EnUs,
        session_ref: SESSION_REF.to_owned(),
        source_snapshot_ref: SNAPSHOT_REF.to_owned(),
        include_physiological_context: true,
        narrative: "Felt controlled.".to_owned(),
    }
}

fn created_report(port: &MemoryReportPort) -> ReportDefinition {
    create_session_report(
        port,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        creation(),
    )
    .expect("created report")
}

fn composition() -> CreateComposedSessionReportRequest {
    CreateComposedSessionReportRequest {
        title: "Routed progression".to_owned(),
        locale: ReportLocale::EnUs,
        session_ref: SESSION_REF.to_owned(),
        source_snapshot_ref: SNAPSHOT_REF.to_owned(),
        blocks: vec![
            SessionReportBlockDraft {
                block_ref: None,
                content: SessionReportBlockDraftContent::SessionEvidence {
                    include_physiological_context: false,
                },
            },
            SessionReportBlockDraft {
                block_ref: None,
                content: SessionReportBlockDraftContent::Route {
                    route_ref: ROUTE_REF.to_owned(),
                    endpoint_redaction_meters: 200,
                },
            },
            SessionReportBlockDraft {
                block_ref: None,
                content: SessionReportBlockDraftContent::Narrative {
                    body: "The middle section felt controlled.".to_owned(),
                },
            },
        ],
    }
}

fn analytical_composition() -> CreateComposedSessionReportRequest {
    let query = ReportTrainingComparisonQuery::new(
        ReportDateRange::new("2026-01-01", "2026-01-31").expect("baseline range"),
        ReportDateRange::new("2026-02-01", "2026-02-28").expect("comparison range"),
    );
    CreateComposedSessionReportRequest {
        title: "Winter training comparison".to_owned(),
        locale: ReportLocale::EnUs,
        session_ref: SESSION_REF.to_owned(),
        source_snapshot_ref: SNAPSHOT_REF.to_owned(),
        blocks: vec![
            SessionReportBlockDraft {
                block_ref: None,
                content: SessionReportBlockDraftContent::SessionEvidence {
                    include_physiological_context: false,
                },
            },
            SessionReportBlockDraft {
                block_ref: None,
                content: SessionReportBlockDraftContent::TrainingFinding {
                    query: query.clone(),
                    metric: ReportTrainingMetric::SessionCount,
                },
            },
            SessionReportBlockDraft {
                block_ref: None,
                content: SessionReportBlockDraftContent::TrainingComparison {
                    query: query.clone(),
                },
            },
            SessionReportBlockDraft {
                block_ref: None,
                content: SessionReportBlockDraftContent::TrainingChart {
                    query: query.clone(),
                    metric: ReportTrainingMetric::Duration,
                },
            },
            SessionReportBlockDraft {
                block_ref: None,
                content: SessionReportBlockDraftContent::TrainingExactTable {
                    query: query.clone(),
                },
            },
            SessionReportBlockDraft {
                block_ref: None,
                content: SessionReportBlockDraftContent::TrainingCoverage { query },
            },
            SessionReportBlockDraft {
                block_ref: None,
                content: SessionReportBlockDraftContent::Narrative {
                    body: "The comparison is descriptive, not causal.".to_owned(),
                },
            },
        ],
    }
}

fn analytical_drafts(query: &ReportTrainingComparisonQuery) -> Vec<ReportBlockDraft> {
    vec![
        ReportBlockDraft {
            block_ref: None,
            content: ReportBlockDraftContent::TrainingFinding {
                query: query.clone(),
                metric: ReportTrainingMetric::SessionCount,
            },
        },
        ReportBlockDraft {
            block_ref: None,
            content: ReportBlockDraftContent::TrainingComparison {
                query: query.clone(),
            },
        },
        ReportBlockDraft {
            block_ref: None,
            content: ReportBlockDraftContent::TrainingChart {
                query: query.clone(),
                metric: ReportTrainingMetric::Duration,
            },
        },
        ReportBlockDraft {
            block_ref: None,
            content: ReportBlockDraftContent::TrainingExactTable {
                query: query.clone(),
            },
        },
        ReportBlockDraft {
            block_ref: None,
            content: ReportBlockDraftContent::TrainingCoverage {
                query: query.clone(),
            },
        },
        ReportBlockDraft {
            block_ref: None,
            content: ReportBlockDraftContent::Narrative {
                body: "A descriptive interpretation.".to_owned(),
            },
        },
    ]
}

#[test]
fn prepares_question_exploration_and_blank_starts_from_one_current_snapshot() {
    let training = AnalyticalTrainingPort::current();
    let question = prepare_report_start(
        &training,
        ReportStart::Question {
            question: ReportQuestion::TrainingPeriodComparisonV1,
        },
    )
    .expect("question start");

    assert_eq!(question.source_snapshot_ref, SNAPSHOT_REF);
    assert_eq!(
        question.origin,
        ReportOrigin::Question {
            question: ReportQuestion::TrainingPeriodComparisonV1,
        }
    );
    let suggested = question.suggested_query.expect("suggested query");
    assert_eq!(suggested.baseline_range().from(), "2026-01-01");
    assert_eq!(suggested.baseline_range().through(), "2026-01-30");
    assert_eq!(suggested.comparison_range().from(), "2026-01-31");
    assert_eq!(suggested.comparison_range().through(), "2026-03-01");

    let exploration_query = ReportTrainingComparisonQuery::new(
        ReportDateRange::new("2026-01-01", "2026-01-31").expect("baseline"),
        ReportDateRange::new("2026-02-01", "2026-02-28").expect("comparison"),
    );
    let exploration = prepare_report_start(
        &training,
        ReportStart::Exploration {
            query: exploration_query.clone(),
        },
    )
    .expect("exploration start");
    assert_eq!(
        exploration.origin,
        ReportOrigin::Exploration {
            query: exploration_query.clone(),
        }
    );
    assert_eq!(exploration.suggested_query, Some(exploration_query));

    let blank = prepare_report_start(&training, ReportStart::Blank).expect("blank start");
    assert_eq!(blank.origin, ReportOrigin::Blank);
    assert!(blank.suggested_query.is_some());
    assert!(training.queries.lock().expect("queries").is_empty());
}

#[test]
fn creates_and_resolves_question_and_blank_reports_without_session_evidence() {
    let reports = MemoryReportPort::default();
    let training = AnalyticalTrainingPort::current();
    let prepared = prepare_report_start(
        &training,
        ReportStart::Question {
            question: ReportQuestion::TrainingPeriodComparisonV1,
        },
    )
    .expect("question start");
    let query = prepared.suggested_query.expect("suggested query");
    let created = create_report(
        &reports,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &training,
        &NoPlannedTrainingPort,
        CreateReportRequest {
            title: "How did my training change?".to_owned(),
            locale: ReportLocale::EnUs,
            source_snapshot_ref: prepared.source_snapshot_ref,
            origin: prepared.origin,
            blocks: analytical_drafts(&query),
        },
    )
    .expect("question report");
    assert!(matches!(created.origin(), ReportOrigin::Question { .. }));

    let resolved = resolve_report(
        &reports,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &StubProvenancePort,
        &training,
        &NoPlannedTrainingPort,
        REPORT_REF,
    )
    .expect("resolved question report");
    assert!(resolved.session.is_none());
    assert!(resolved.routes.is_empty());
    assert!(matches!(
        resolved.provenance,
        ReportEvidenceProvenance::LibrarySnapshot
    ));
    assert!(resolved.training_comparison.is_some());

    let blank_reports = MemoryReportPort::default();
    let blank = prepare_report_start(&training, ReportStart::Blank).expect("blank start");
    create_report(
        &blank_reports,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &training,
        &NoPlannedTrainingPort,
        CreateReportRequest {
            title: "Reusable notes".to_owned(),
            locale: ReportLocale::EnUs,
            source_snapshot_ref: blank.source_snapshot_ref,
            origin: blank.origin,
            blocks: vec![ReportBlockDraft {
                block_ref: None,
                content: ReportBlockDraftContent::Narrative {
                    body: "Start with my own interpretation.".to_owned(),
                },
            }],
        },
    )
    .expect("blank report");
    let resolved_blank = resolve_report(
        &blank_reports,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &StubProvenancePort,
        &training,
        &NoPlannedTrainingPort,
        REPORT_REF,
    )
    .expect("resolved blank report");
    assert!(resolved_blank.session.is_none());
    assert!(matches!(
        resolved_blank.provenance,
        ReportEvidenceProvenance::AuthoredOnly
    ));
    assert!(resolved_blank.training_comparison.is_none());
}

#[test]
fn creates_resolves_refreshes_lists_and_exports_one_exact_planned_target() {
    let reports = MemoryReportPort::default();
    let initial_plans = planned_port(PLANNED_SNAPSHOT_REF);
    let created = create_report(
        &reports,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &NoComparisonPort,
        &initial_plans,
        CreateReportRequest {
            title: "Progressive intervals".to_owned(),
            locale: ReportLocale::EnUs,
            source_snapshot_ref: PLANNED_SNAPSHOT_REF.to_owned(),
            origin: ReportOrigin::PlannedTraining {
                target_ref: PLANNED_TARGET_REF.to_owned(),
            },
            blocks: vec![ReportBlockDraft {
                block_ref: None,
                content: ReportBlockDraftContent::PlannedTraining {
                    target_ref: PLANNED_TARGET_REF.to_owned(),
                },
            }],
        },
    )
    .expect("planned report");
    assert_eq!(created.source_snapshot_ref(), PLANNED_SNAPSHOT_REF);
    let planned_block_ref = created.blocks()[0].block_ref().to_owned();
    let updated = update_report(
        &reports,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &NoComparisonPort,
        &initial_plans,
        UpdateReportRequest {
            report_ref: REPORT_REF.to_owned(),
            expected_revision: 1,
            title: "Progressive intervals — reviewed".to_owned(),
            locale: ReportLocale::EnUs,
            blocks: vec![
                ReportBlockDraft {
                    block_ref: Some(planned_block_ref),
                    content: ReportBlockDraftContent::PlannedTraining {
                        target_ref: PLANNED_TARGET_REF.to_owned(),
                    },
                },
                ReportBlockDraft {
                    block_ref: None,
                    content: ReportBlockDraftContent::Narrative {
                        body: "Keep the authored interpretation distinct from planned intent."
                            .to_owned(),
                    },
                },
            ],
        },
    )
    .expect("updated planned report");
    assert_eq!(updated.revision(), 2);
    assert_eq!(updated.blocks().len(), 2);

    let resolved = resolve_report(
        &reports,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &StubProvenancePort,
        &NoComparisonPort,
        &initial_plans,
        REPORT_REF,
    )
    .expect("resolved planned report");
    assert_eq!(resolved.status, ReportResolutionStatus::Current);
    assert!(resolved.session.is_none());
    assert!(resolved.training_comparison.is_none());
    assert!(matches!(
        resolved.provenance,
        ReportEvidenceProvenance::PlannedTrainingSnapshot
    ));
    let evidence = resolved.planned_training.expect("planned evidence");
    assert_eq!(
        evidence.target.target.target.target_id(),
        PLANNED_TARGET_REF
    );
    assert_eq!(evidence.target.target.shape.phase_count, Some(1));

    let changed_plans = planned_port(CHANGED_PLANNED_SNAPSHOT_REF);
    let stale = resolve_report(
        &reports,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &StubProvenancePort,
        &NoComparisonPort,
        &changed_plans,
        REPORT_REF,
    )
    .expect("stale planned report candidate");
    assert_eq!(stale.status, ReportResolutionStatus::Stale);
    assert_eq!(stale.resolved_snapshot_ref, CHANGED_PLANNED_SNAPSHOT_REF);

    let refreshed = refresh_report(
        &reports,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &StubProvenancePort,
        &NoComparisonPort,
        &changed_plans,
        RefreshReportRequest {
            report_ref: REPORT_REF.to_owned(),
            expected_revision: 2,
            expected_source_snapshot_ref: PLANNED_SNAPSHOT_REF.to_owned(),
            expected_resolved_snapshot_ref: CHANGED_PLANNED_SNAPSHOT_REF.to_owned(),
        },
    )
    .expect("refreshed planned report");
    assert_eq!(refreshed.revision(), 3);
    assert_eq!(
        refreshed.source_snapshot_ref(),
        CHANGED_PLANNED_SNAPSHOT_REF
    );

    let library = list_report_library(
        &reports,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &NoComparisonPort,
        &changed_plans,
        ReportLibraryRequest {
            offset: 0,
            limit: 24,
        },
    )
    .expect("planned report library");
    assert_eq!(
        library.items[0].evidence_state,
        ReportLibraryEvidenceState::Current
    );
    assert_eq!(
        library.items[0].subject,
        ReportLibrarySubject::PlannedTraining {
            name: Some("Progressive intervals".to_owned()),
        }
    );
    assert!(matches!(
        library.items[0].result,
        Some(ReportLibraryResult::PlannedTraining {
            phase_count: Some(1),
            ..
        })
    ));

    let exports = RecordingExportPort::default();
    export_report(
        &reports,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &StubProvenancePort,
        &NoComparisonPort,
        &changed_plans,
        &exports,
        ReportExportRequest {
            report_ref: REPORT_REF.to_owned(),
            expected_revision: 3,
            expected_source_snapshot_ref: CHANGED_PLANNED_SNAPSHOT_REF.to_owned(),
            include_physiological_context: false,
            route_choices: Vec::new(),
            destination: "/tmp/planned-training-report.html".into(),
        },
        &ReportExportCancellation::new(),
    )
    .expect("exported planned report");
    let exported = exports.exports.lock().expect("exports");
    assert_eq!(exported.len(), 1);
    assert_eq!(
        exported[0]
            .planned_training
            .as_ref()
            .expect("authorized planned evidence")
            .target
            .target
            .target
            .target_id(),
        PLANNED_TARGET_REF
    );
}

#[test]
fn expands_a_blank_report_without_replacing_its_origin_or_concurrent_revision() {
    let reports = MemoryReportPort::default();
    let training = AnalyticalTrainingPort::current();
    let blank = prepare_report_start(&training, ReportStart::Blank).expect("blank start");
    let suggested = blank.suggested_query.expect("suggested query");
    create_report(
        &reports,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &training,
        &NoPlannedTrainingPort,
        CreateReportRequest {
            title: "Reusable notes".to_owned(),
            locale: ReportLocale::EnUs,
            source_snapshot_ref: blank.source_snapshot_ref,
            origin: blank.origin,
            blocks: vec![ReportBlockDraft {
                block_ref: None,
                content: ReportBlockDraftContent::Narrative {
                    body: "Start with my own interpretation.".to_owned(),
                },
            }],
        },
    )
    .expect("blank report");
    let narrative_ref = reports.reports.lock().expect("reports")[0].blocks()[0]
        .block_ref()
        .to_owned();
    let mut expanded = analytical_drafts(&suggested);
    expanded.last_mut().expect("narrative").block_ref = Some(narrative_ref);

    let revised = update_report(
        &reports,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &training,
        &NoPlannedTrainingPort,
        UpdateReportRequest {
            report_ref: REPORT_REF.to_owned(),
            expected_revision: 1,
            title: "Reusable comparison".to_owned(),
            locale: ReportLocale::EnUs,
            blocks: expanded,
        },
    )
    .expect("expanded report");
    assert_eq!(revised.origin(), &ReportOrigin::Blank);
    assert_eq!(revised.revision(), 2);
    assert!(revised.blocks().iter().any(|block| matches!(
        block.content(),
        ReportBlockContent::TrainingComparison { .. }
    )));

    assert!(matches!(
        update_report(
            &reports,
            &StubTrainingPort {
                snapshot_ref: SNAPSHOT_REF.to_owned(),
            },
            &StubRoutePort,
            &training,
            &NoPlannedTrainingPort,
            UpdateReportRequest {
                report_ref: REPORT_REF.to_owned(),
                expected_revision: 1,
                title: "Stale edit".to_owned(),
                locale: ReportLocale::EnUs,
                blocks: vec![],
            },
        ),
        Err(ApplicationError::ReportDefinitionConflict)
    ));
}

#[test]
fn exports_a_blank_report_without_inventing_session_or_provider_evidence() {
    let reports = MemoryReportPort::default();
    let training = AnalyticalTrainingPort::current();
    let blank = prepare_report_start(&training, ReportStart::Blank).expect("blank start");
    create_report(
        &reports,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &training,
        &NoPlannedTrainingPort,
        CreateReportRequest {
            title: "Reusable notes".to_owned(),
            locale: ReportLocale::EnUs,
            source_snapshot_ref: blank.source_snapshot_ref,
            origin: blank.origin,
            blocks: vec![ReportBlockDraft {
                block_ref: None,
                content: ReportBlockDraftContent::Narrative {
                    body: "My interpretation remains explicitly authored.".to_owned(),
                },
            }],
        },
    )
    .expect("blank report");
    let output = RecordingExportPort::default();

    export_report(
        &reports,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &StubProvenancePort,
        &training,
        &NoPlannedTrainingPort,
        &output,
        ReportExportRequest {
            report_ref: REPORT_REF.to_owned(),
            expected_revision: 1,
            expected_source_snapshot_ref: SNAPSHOT_REF.to_owned(),
            include_physiological_context: false,
            route_choices: vec![],
            destination: "/tmp/fitfreed-blank-report.html".into(),
        },
        &ReportExportCancellation::new(),
    )
    .expect("blank report export");

    let exports = output.exports.lock().expect("exports");
    assert!(exports[0].session.is_none());
    assert!(matches!(
        exports[0].provenance,
        ReportEvidenceProvenance::AuthoredOnly
    ));
}

#[test]
fn resolves_the_comparison_block_family_once_through_authoritative_queries() {
    let port = MemoryReportPort::default();
    let comparison_port = AnalyticalTrainingPort::current();
    let created = create_composed_session_report(
        &port,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &comparison_port,
        analytical_composition(),
    )
    .expect("analytical report");

    assert_eq!(created.definition_version(), REPORT_DEFINITION_VERSION);
    assert_eq!(created.blocks().len(), 7);
    let resolved = resolve_session_report(
        &port,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &StubProvenancePort,
        &comparison_port,
        REPORT_REF,
    )
    .expect("resolved analytical report");
    let comparison = resolved
        .training_comparison
        .expect("training comparison evidence");
    assert_eq!(comparison.series.len(), 1);
    assert_eq!(comparison.series[0].baseline.session_count, 1);
    assert_eq!(comparison.series[0].comparison.session_count, 2);
    assert_eq!(comparison.series[0].session_count_change, 1);
    assert_eq!(
        comparison_port
            .queries
            .lock()
            .expect("comparison queries")
            .len(),
        4,
        "creation and resolution each execute one two-period authoritative query"
    );
}

#[test]
fn refuses_to_persist_an_analytical_definition_against_another_snapshot() {
    let port = MemoryReportPort::default();
    let comparison_port = AnalyticalTrainingPort {
        snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
        queries: Mutex::new(Vec::new()),
    };

    assert!(matches!(
        create_composed_session_report(
            &port,
            &StubTrainingPort {
                snapshot_ref: SNAPSHOT_REF.to_owned(),
            },
            &StubRoutePort,
            &comparison_port,
            analytical_composition(),
        ),
        Err(ApplicationError::ReportSourceChanged)
    ));
    assert!(port.reports.lock().expect("reports").is_empty());
}

#[test]
fn composes_reorders_and_resolves_a_redacted_route_from_authoritative_evidence() {
    let port = MemoryReportPort::default();
    let created = create_composed_session_report(
        &port,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &NoComparisonPort,
        composition(),
    )
    .expect("routed report");

    assert_eq!(created.definition_version(), REPORT_DEFINITION_VERSION);
    assert!(matches!(
        created.blocks()[1].content(),
        ReportBlockContent::Route {
            endpoint_redaction_meters: 200,
            ..
        }
    ));
    let resolved = resolve_session_report(
        &port,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &StubProvenancePort,
        &NoComparisonPort,
        REPORT_REF,
    )
    .expect("resolved routed report");
    assert_eq!(resolved.routes.len(), 1);
    assert_eq!(resolved.routes[0].block_ref, ROUTE_BLOCK_REF);
    assert_eq!(resolved.routes[0].endpoint_redaction_meters, 200);
    assert!(
        resolved.routes[0]
            .visual_points
            .first()
            .expect("redacted start")
            .ordinal
            > 0
    );
    assert!(
        resolved.routes[0]
            .visual_points
            .last()
            .expect("redacted end")
            .ordinal
            < 10
    );
    assert!(resolved
        .sensitive_contents
        .contains(&ReportSensitiveContent {
            kind: ReportSensitiveContentKind::PreciseLocation,
            block_ref: Some(ROUTE_BLOCK_REF.to_owned()),
            included: true,
            endpoint_redaction_meters: Some(200),
        }));

    let revised = update_composed_session_report(
        &port,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &NoComparisonPort,
        UpdateComposedSessionReportRequest {
            report_ref: REPORT_REF.to_owned(),
            expected_revision: 1,
            title: "Routed progression".to_owned(),
            locale: ReportLocale::EnUs,
            blocks: vec![
                SessionReportBlockDraft {
                    block_ref: Some(NARRATIVE_BLOCK_REF.to_owned()),
                    content: SessionReportBlockDraftContent::Narrative {
                        body: "The middle section felt controlled.".to_owned(),
                    },
                },
                SessionReportBlockDraft {
                    block_ref: Some(SESSION_BLOCK_REF.to_owned()),
                    content: SessionReportBlockDraftContent::SessionEvidence {
                        include_physiological_context: false,
                    },
                },
            ],
        },
    )
    .expect("route removed and blocks reordered");
    assert_eq!(revised.revision(), 2);
    assert!(matches!(
        revised.blocks()[0].content(),
        ReportBlockContent::Narrative { .. }
    ));
    assert_eq!(revised.blocks().len(), 2);
}

#[test]
fn export_review_can_omit_or_increase_route_redaction_but_never_expose_more() {
    let port = MemoryReportPort::default();
    create_composed_session_report(
        &port,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &NoComparisonPort,
        composition(),
    )
    .expect("routed report");
    let output = RecordingExportPort::default();

    for (include_geometry, endpoint_redaction_meters) in [(false, 500), (true, 300)] {
        export_session_report(
            &port,
            &StubTrainingPort {
                snapshot_ref: SNAPSHOT_REF.to_owned(),
            },
            &StubRoutePort,
            &StubProvenancePort,
            &NoComparisonPort,
            &output,
            SessionReportExportRequest {
                report_ref: REPORT_REF.to_owned(),
                expected_revision: 1,
                expected_source_snapshot_ref: SNAPSHOT_REF.to_owned(),
                include_physiological_context: false,
                route_choices: vec![ReportRouteExportChoice {
                    block_ref: ROUTE_BLOCK_REF.to_owned(),
                    include_geometry,
                    endpoint_redaction_meters,
                }],
                destination: "/tmp/fitfreed-route-report.html".into(),
            },
            &ReportExportCancellation::new(),
        )
        .expect("reviewed route export");
    }
    let exports = output.exports.lock().expect("exports");
    assert!(!exports[0].routes[0].included);
    assert!(exports[0].routes[0].visual_points.is_empty());
    assert!(exports[1].routes[0].included);
    assert_eq!(exports[1].routes[0].endpoint_redaction_meters, 300);
    drop(exports);

    assert!(matches!(
        export_session_report(
            &port,
            &StubTrainingPort {
                snapshot_ref: SNAPSHOT_REF.to_owned(),
            },
            &StubRoutePort,
            &StubProvenancePort,
            &NoComparisonPort,
            &output,
            SessionReportExportRequest {
                report_ref: REPORT_REF.to_owned(),
                expected_revision: 1,
                expected_source_snapshot_ref: SNAPSHOT_REF.to_owned(),
                include_physiological_context: false,
                route_choices: vec![ReportRouteExportChoice {
                    block_ref: ROUTE_BLOCK_REF.to_owned(),
                    include_geometry: true,
                    endpoint_redaction_meters: 100,
                }],
                destination: "/tmp/fitfreed-route-report.html".into(),
            },
            &ReportExportCancellation::new(),
        ),
        Err(ApplicationError::InvalidReportDefinition(_))
    ));
    assert_eq!(output.exports.lock().expect("exports").len(), 2);
}

#[test]
fn creates_lists_and_loads_a_session_report_after_exact_evidence_resolution() {
    let port = MemoryReportPort::default();
    let created = created_report(&port);

    assert_eq!(created.report_ref(), REPORT_REF);
    assert_eq!(created.definition_version(), REPORT_DEFINITION_VERSION_V1);
    assert_eq!(created.revision(), 1);
    assert_eq!(
        list_reports(&port).expect("report list")[0].title,
        "Morning progression"
    );
    assert_eq!(
        load_report_definition(&port, REPORT_REF)
            .expect("loaded report")
            .report_ref(),
        REPORT_REF
    );
}

#[test]
fn duplicates_one_exact_report_revision_as_an_independent_revision_one_aggregate() {
    let port = MemoryReportPort::default();
    let source = created_report(&port);
    let source_before = source.clone();

    let duplicate = duplicate_report(
        &port,
        DuplicateReportRequest {
            source_report_ref: REPORT_REF.to_owned(),
            expected_source_revision: source.revision(),
            title: "  Morning progression copy  ".to_owned(),
        },
    )
    .expect("independent duplicate");

    assert_eq!(duplicate.report_ref(), DUPLICATE_REPORT_REF);
    assert_eq!(duplicate.title(), "Morning progression copy");
    assert_eq!(duplicate.definition_version(), REPORT_DEFINITION_VERSION);
    assert_eq!(duplicate.revision(), 1);
    assert_eq!(duplicate.locale(), source.locale());
    assert_eq!(duplicate.origin(), source.origin());
    assert_eq!(
        duplicate.source_snapshot_ref(),
        source.source_snapshot_ref()
    );
    assert_eq!(duplicate.provenance_policy(), source.provenance_policy());
    assert_eq!(duplicate.authorship(), source.authorship());
    assert_eq!(
        duplicate
            .blocks()
            .iter()
            .map(ReportBlock::content)
            .collect::<Vec<_>>(),
        source
            .blocks()
            .iter()
            .map(ReportBlock::content)
            .collect::<Vec<_>>()
    );
    assert!(duplicate.blocks().iter().all(|duplicate_block| {
        source
            .blocks()
            .iter()
            .all(|source_block| source_block.block_ref() != duplicate_block.block_ref())
    }));
    assert_eq!(
        load_report_definition(&port, REPORT_REF).expect("unchanged source"),
        source_before
    );
    assert_eq!(
        load_report_definition(&port, DUPLICATE_REPORT_REF).expect("persisted duplicate"),
        duplicate
    );
}

#[test]
fn refreshes_and_exports_a_duplicate_without_mutating_its_source() {
    let reports = MemoryReportPort::default();
    let source = created_report(&reports);
    let duplicate = duplicate_report(
        &reports,
        DuplicateReportRequest {
            source_report_ref: REPORT_REF.to_owned(),
            expected_source_revision: source.revision(),
            title: "Morning progression copy".to_owned(),
        },
    )
    .expect("independent duplicate");
    let current_training = StubTrainingPort {
        snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
    };

    let refreshed = refresh_report(
        &reports,
        &current_training,
        &StubRoutePort,
        &StubProvenancePort,
        &NoComparisonPort,
        &NoPlannedTrainingPort,
        RefreshReportRequest {
            report_ref: duplicate.report_ref().to_owned(),
            expected_revision: duplicate.revision(),
            expected_source_snapshot_ref: SNAPSHOT_REF.to_owned(),
            expected_resolved_snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
        },
    )
    .expect("refreshed duplicate");

    assert_eq!(refreshed.revision(), 2);
    assert_eq!(refreshed.source_snapshot_ref(), CHANGED_SNAPSHOT_REF);
    assert_eq!(refreshed.blocks(), duplicate.blocks());
    assert_eq!(
        load_report_definition(&reports, REPORT_REF).expect("unchanged source"),
        source
    );

    let output = RecordingExportPort::default();
    export_session_report(
        &reports,
        &current_training,
        &StubRoutePort,
        &StubProvenancePort,
        &NoComparisonPort,
        &output,
        SessionReportExportRequest {
            report_ref: refreshed.report_ref().to_owned(),
            expected_revision: refreshed.revision(),
            expected_source_snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
            include_physiological_context: false,
            route_choices: vec![],
            destination: "/tmp/fitfreed-duplicate-report.html".into(),
        },
        &ReportExportCancellation::new(),
    )
    .expect("export refreshed duplicate");
    assert_eq!(output.exports.lock().expect("exports").len(), 1);
}

#[test]
fn rejects_stale_or_invalid_duplicate_requests_without_persisting_a_copy() {
    let stale_port = MemoryReportPort::default();
    let source = created_report(&stale_port);
    let next_report_before = *stale_port.next_report.lock().expect("report sequence");
    let next_block_before = *stale_port.next_block.lock().expect("block sequence");

    assert!(matches!(
        duplicate_report(
            &stale_port,
            DuplicateReportRequest {
                source_report_ref: REPORT_REF.to_owned(),
                expected_source_revision: source.revision() + 1,
                title: "Stale copy".to_owned(),
            },
        ),
        Err(ApplicationError::ReportDefinitionConflict)
    ));
    assert_eq!(
        *stale_port.next_report.lock().expect("report sequence"),
        next_report_before
    );
    assert_eq!(
        *stale_port.next_block.lock().expect("block sequence"),
        next_block_before
    );
    assert_eq!(stale_port.reports.lock().expect("reports").len(), 1);

    assert!(matches!(
        duplicate_report(
            &stale_port,
            DuplicateReportRequest {
                source_report_ref: REPORT_REF.to_owned(),
                expected_source_revision: source.revision(),
                title: "  ".to_owned(),
            },
        ),
        Err(ApplicationError::InvalidReportDefinition(_))
    ));
    assert_eq!(stale_port.reports.lock().expect("reports").len(), 1);
    assert_eq!(
        load_report_definition(&stale_port, REPORT_REF).expect("unchanged source"),
        source
    );
}

#[test]
fn projects_one_bounded_session_result_without_resolving_routes_or_provenance() {
    let reports = MemoryReportPort::default();
    let mut request = composition();
    request.blocks[0].content = SessionReportBlockDraftContent::SessionEvidence {
        include_physiological_context: true,
    };
    create_composed_session_report(
        &reports,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &NoComparisonPort,
        request,
    )
    .expect("session report");

    let library = list_report_library(
        &reports,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &AnalyticalTrainingPort::current(),
        &NoPlannedTrainingPort,
        ReportLibraryRequest {
            offset: 0,
            limit: 12,
        },
    )
    .expect("report library");

    assert_eq!(library.total_count, 1);
    assert_eq!(library.next_offset, None);
    assert_eq!(
        library.items[0].evidence_state,
        ReportLibraryEvidenceState::Current
    );
    assert!(matches!(
        library.items[0].subject,
        ReportLibrarySubject::Session { .. }
    ));
    assert_eq!(
        library.items[0].period,
        Some(ReportLibraryPeriod::Session {
            started_at_local: "2026-08-18T07:30:00.000".to_owned(),
        })
    );
    assert_eq!(
        library.items[0].result,
        Some(ReportLibraryResult::Session {
            metric: ReportTrainingMetric::Distance,
            value: ReportLibraryMetricValue::Decimal(10_000.0),
        })
    );
    assert_eq!(
        library.items[0].sensitivity,
        ReportLibrarySensitivity {
            includes_physiological_context: true,
            precise_location_block_count: 1,
            minimum_endpoint_redaction_meters: Some(200),
        }
    );
}

#[test]
fn projects_one_authored_comparison_metric_per_source_and_reuses_its_query() {
    let reports = MemoryReportPort::default();
    let training = AnalyticalTrainingPort::current();
    let query = ReportTrainingComparisonQuery::new(
        ReportDateRange::new("2026-01-01", "2026-01-31").expect("baseline range"),
        ReportDateRange::new("2026-02-01", "2026-02-28").expect("comparison range"),
    );
    let created = create_report(
        &reports,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &training,
        &NoPlannedTrainingPort,
        CreateReportRequest {
            title: "Winter training comparison".to_owned(),
            locale: ReportLocale::EnUs,
            source_snapshot_ref: SNAPSHOT_REF.to_owned(),
            origin: ReportOrigin::Exploration {
                query: query.clone(),
            },
            blocks: analytical_drafts(&query),
        },
    )
    .expect("comparison report");
    let second = ReportDefinition::compose_report(
        "report-1111111111111111111111111111111111111111111111111111111111111111",
        "Winter training comparison — saved view",
        ReportLocale::EnUs,
        SNAPSHOT_REF,
        ReportOrigin::Exploration {
            query: query.clone(),
        },
        created.blocks().to_vec(),
    )
    .expect("second comparison report");
    reports
        .create_report_definition(&second)
        .expect("stored second report");
    training.queries.lock().expect("creation queries").clear();

    let library = list_report_library(
        &reports,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &training,
        &NoPlannedTrainingPort,
        ReportLibraryRequest {
            offset: 0,
            limit: 12,
        },
    )
    .expect("comparison library");

    assert_eq!(library.items.len(), 2);
    assert_eq!(
        library.items[0].evidence_state,
        ReportLibraryEvidenceState::Current
    );
    assert_eq!(
        library.items[0].subject,
        ReportLibrarySubject::TrainingComparison
    );
    assert_eq!(
        library.items[0].period,
        Some(ReportLibraryPeriod::TrainingComparison {
            baseline_range: query.baseline_range().clone(),
            comparison_range: query.comparison_range().clone(),
        })
    );
    assert_eq!(
        library.items[0].result,
        Some(ReportLibraryResult::TrainingComparison {
            metric: ReportTrainingMetric::SessionCount,
            series: vec![ReportLibraryComparisonSeries {
                source_index: 1,
                baseline_value: Some(ReportLibraryMetricValue::Integer(1)),
                comparison_value: Some(ReportLibraryMetricValue::Integer(2)),
                change: Some(ReportLibraryMetricValue::Integer(1)),
            }],
            omitted_source_count: 0,
        })
    );
    assert_eq!(
        training.queries.lock().expect("library queries").len(),
        2,
        "one library result resolves one baseline and one comparison range"
    );
}

#[test]
fn distinguishes_stale_and_unavailable_session_library_evidence() {
    let reports = MemoryReportPort::default();
    created_report(&reports);

    let stale = list_report_library(
        &reports,
        &StubTrainingPort {
            snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
        },
        &AnalyticalTrainingPort {
            snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
            queries: Mutex::new(Vec::new()),
        },
        &NoPlannedTrainingPort,
        ReportLibraryRequest {
            offset: 0,
            limit: 12,
        },
    )
    .expect("stale report library");
    assert_eq!(
        stale.items[0].evidence_state,
        ReportLibraryEvidenceState::Stale
    );
    assert!(stale.items[0].result.is_some());

    let unavailable = list_report_library(
        &reports,
        &MissingTrainingPort,
        &AnalyticalTrainingPort::current(),
        &NoPlannedTrainingPort,
        ReportLibraryRequest {
            offset: 0,
            limit: 12,
        },
    )
    .expect("unavailable report library");
    assert_eq!(
        unavailable.items[0].evidence_state,
        ReportLibraryEvidenceState::Unavailable
    );
    assert_eq!(unavailable.items[0].result, None);
}

#[test]
fn retries_one_library_snapshot_change_without_returning_mixed_report_results() {
    let reports = MemoryReportPort::default();
    created_report(&reports);
    let snapshots = SequencedSnapshotPort {
        snapshots: Mutex::new(vec![
            SNAPSHOT_REF.to_owned(),
            CHANGED_SNAPSHOT_REF.to_owned(),
            CHANGED_SNAPSHOT_REF.to_owned(),
        ]),
    };

    let library = list_report_library(
        &reports,
        &StubTrainingPort {
            snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
        },
        &snapshots,
        &NoPlannedTrainingPort,
        ReportLibraryRequest {
            offset: 0,
            limit: 12,
        },
    )
    .expect("retried report library");

    assert_eq!(
        library.items[0].evidence_state,
        ReportLibraryEvidenceState::Stale
    );
    assert!(snapshots
        .snapshots
        .lock()
        .expect("snapshot sequence")
        .is_empty());
}

#[test]
fn keeps_legacy_authored_only_reports_recognizable_without_inventing_evidence() {
    let reports = MemoryReportPort::default();
    let definition = ReportDefinition::compose_report(
        REPORT_REF,
        "Reusable notes",
        ReportLocale::EnUs,
        SNAPSHOT_REF,
        ReportOrigin::Blank,
        vec![
            ReportBlock::narrative(NARRATIVE_BLOCK_REF, "My own interpretation.")
                .expect("narrative"),
        ],
    )
    .expect("authored-only report");
    reports
        .create_report_definition(&definition)
        .expect("stored report");

    let library = list_report_library(
        &reports,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &NoComparisonPort,
        &NoPlannedTrainingPort,
        ReportLibraryRequest {
            offset: 0,
            limit: 12,
        },
    )
    .expect("authored-only library");

    assert_eq!(
        library.items[0].evidence_state,
        ReportLibraryEvidenceState::AuthoredOnly
    );
    assert_eq!(library.items[0].subject, ReportLibrarySubject::AuthoredNote);
    assert_eq!(library.items[0].period, None);
    assert_eq!(library.items[0].result, None);
}

#[test]
fn removes_only_the_exact_revision_bound_report_and_returns_its_identity() {
    let port = MemoryReportPort::default();
    created_report(&port);

    assert!(matches!(
        remove_report(
            &port,
            RemoveReportRequest {
                report_ref: REPORT_REF.to_owned(),
                expected_revision: 2,
            },
        ),
        Err(ApplicationError::ReportDefinitionConflict)
    ));
    assert_eq!(list_reports(&port).expect("retained report").len(), 1);

    let removed = remove_report(
        &port,
        RemoveReportRequest {
            report_ref: REPORT_REF.to_owned(),
            expected_revision: 1,
        },
    )
    .expect("removed report");

    assert_eq!(removed.report_ref, REPORT_REF);
    assert_eq!(removed.title, "Morning progression");
    assert_eq!(removed.revision, 1);
    assert!(list_reports(&port).expect("empty report list").is_empty());
}

#[test]
fn refuses_to_save_a_report_when_the_source_snapshot_has_changed() {
    let port = MemoryReportPort::default();

    assert!(matches!(
        create_session_report(
            &port,
            &StubTrainingPort {
                snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
            },
            creation(),
        ),
        Err(ApplicationError::ReportSourceChanged)
    ));
    assert!(list_reports(&port).expect("empty report list").is_empty());
}

#[test]
fn updates_authored_content_without_overwriting_a_concurrent_revision() {
    let port = MemoryReportPort::default();
    created_report(&port);

    let changed = update_session_report(
        &port,
        UpdateSessionReportRequest {
            report_ref: REPORT_REF.to_owned(),
            expected_revision: 1,
            title: "Morning progression reviewed".to_owned(),
            locale: ReportLocale::EsEs,
            include_physiological_context: false,
            narrative: "A conservative interpretation.".to_owned(),
        },
    )
    .expect("updated report");
    assert_eq!(changed.revision(), 2);

    assert!(matches!(
        update_session_report(
            &port,
            UpdateSessionReportRequest {
                report_ref: REPORT_REF.to_owned(),
                expected_revision: 1,
                title: "Stale edit".to_owned(),
                locale: ReportLocale::EnUs,
                include_physiological_context: true,
                narrative: "Must not replace revision two.".to_owned(),
            },
        ),
        Err(ApplicationError::ReportDefinitionConflict)
    ));
}

#[test]
fn resolves_current_evidence_provenance_sensitivity_and_limitations() {
    let port = MemoryReportPort::default();
    created_report(&port);

    let resolved = resolve_session_report(
        &port,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &StubProvenancePort,
        &NoComparisonPort,
        REPORT_REF,
    )
    .expect("resolved report");

    assert_eq!(resolved.status, ReportResolutionStatus::Current);
    assert_eq!(resolved.session.average_heart_rate_bpm, Some(148));
    assert_eq!(resolved.provenance.mapping_version, "training-mapping@5");
    assert_eq!(
        resolved.sensitive_contents,
        vec![ReportSensitiveContent {
            kind: ReportSensitiveContentKind::HeartRate,
            block_ref: None,
            included: true,
            endpoint_redaction_meters: None,
        }]
    );
    assert_eq!(
        resolved.limitations,
        vec![
            ReportLimitation::EnergyUnavailable,
            ReportLimitation::SportUnavailable
        ]
    );
}

#[test]
fn reports_current_candidate_evidence_as_stale_after_a_library_change() {
    let port = MemoryReportPort::default();
    created_report(&port);

    let resolved = resolve_session_report(
        &port,
        &StubTrainingPort {
            snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &StubProvenancePort,
        &NoComparisonPort,
        REPORT_REF,
    )
    .expect("stale report candidate");

    assert_eq!(resolved.status, ReportResolutionStatus::Stale);
    assert_eq!(resolved.resolved_snapshot_ref, CHANGED_SNAPSHOT_REF);
    assert_eq!(resolved.definition.source_snapshot_ref(), SNAPSHOT_REF);
}

#[test]
fn deliberately_refreshes_only_the_reviewed_stale_evidence_revision() {
    let port = MemoryReportPort::default();
    let original = created_report(&port);

    let refreshed = refresh_report(
        &port,
        &StubTrainingPort {
            snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &StubProvenancePort,
        &NoComparisonPort,
        &NoPlannedTrainingPort,
        RefreshReportRequest {
            report_ref: REPORT_REF.to_owned(),
            expected_revision: original.revision(),
            expected_source_snapshot_ref: SNAPSHOT_REF.to_owned(),
            expected_resolved_snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
        },
    )
    .expect("deliberately refreshed report");

    assert_eq!(refreshed.source_snapshot_ref(), CHANGED_SNAPSHOT_REF);
    assert_eq!(refreshed.revision(), original.revision() + 1);
    assert_eq!(refreshed.title(), original.title());
    assert_eq!(refreshed.locale(), original.locale());
    assert_eq!(refreshed.origin(), original.origin());
    assert_eq!(refreshed.blocks(), original.blocks());
    assert_eq!(
        port.load_report_definition(REPORT_REF)
            .expect("load refreshed report"),
        Some(refreshed.clone())
    );

    let resolved = resolve_report(
        &port,
        &StubTrainingPort {
            snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &StubProvenancePort,
        &NoComparisonPort,
        &NoPlannedTrainingPort,
        REPORT_REF,
    )
    .expect("current refreshed report");
    assert_eq!(resolved.status, ReportResolutionStatus::Current);
    assert_eq!(resolved.definition, refreshed);
}

#[test]
fn rejects_unreviewed_or_concurrent_refreshes_without_mutating_the_saved_report() {
    let stale_revision = MemoryReportPort::default();
    let original = created_report(&stale_revision);
    let request = RefreshReportRequest {
        report_ref: REPORT_REF.to_owned(),
        expected_revision: original.revision() + 1,
        expected_source_snapshot_ref: SNAPSHOT_REF.to_owned(),
        expected_resolved_snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
    };
    assert!(matches!(
        refresh_report(
            &stale_revision,
            &StubTrainingPort {
                snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
            },
            &StubRoutePort,
            &StubProvenancePort,
            &NoComparisonPort,
            &NoPlannedTrainingPort,
            request,
        ),
        Err(ApplicationError::ReportDefinitionConflict)
    ));
    assert_eq!(
        stale_revision
            .load_report_definition(REPORT_REF)
            .expect("load prior report"),
        Some(original)
    );

    for (saved_snapshot, reviewed_snapshot, current_snapshot) in [
        (
            CHANGED_SNAPSHOT_REF,
            CHANGED_SNAPSHOT_REF,
            CHANGED_SNAPSHOT_REF,
        ),
        (SNAPSHOT_REF, LATER_SNAPSHOT_REF, CHANGED_SNAPSHOT_REF),
        (SNAPSHOT_REF, CHANGED_SNAPSHOT_REF, SNAPSHOT_REF),
    ] {
        let reports = MemoryReportPort::default();
        let original = created_report(&reports);
        let result = refresh_report(
            &reports,
            &StubTrainingPort {
                snapshot_ref: current_snapshot.to_owned(),
            },
            &StubRoutePort,
            &StubProvenancePort,
            &NoComparisonPort,
            &NoPlannedTrainingPort,
            RefreshReportRequest {
                report_ref: REPORT_REF.to_owned(),
                expected_revision: original.revision(),
                expected_source_snapshot_ref: saved_snapshot.to_owned(),
                expected_resolved_snapshot_ref: reviewed_snapshot.to_owned(),
            },
        );
        assert!(matches!(result, Err(ApplicationError::ReportSourceChanged)));
        assert_eq!(
            reports
                .load_report_definition(REPORT_REF)
                .expect("load unchanged report"),
            Some(original)
        );
    }

    let concurrent = MemoryReportPort {
        reject_saves: true,
        ..MemoryReportPort::default()
    };
    let original = created_report(&concurrent);
    assert!(matches!(
        refresh_report(
            &concurrent,
            &StubTrainingPort {
                snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
            },
            &StubRoutePort,
            &StubProvenancePort,
            &NoComparisonPort,
            &NoPlannedTrainingPort,
            RefreshReportRequest {
                report_ref: REPORT_REF.to_owned(),
                expected_revision: original.revision(),
                expected_source_snapshot_ref: SNAPSHOT_REF.to_owned(),
                expected_resolved_snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
            },
        ),
        Err(ApplicationError::ReportDefinitionConflict)
    ));
    assert_eq!(
        concurrent
            .load_report_definition(REPORT_REF)
            .expect("load concurrently preserved report"),
        Some(original)
    );
}

#[test]
fn rejects_a_refresh_when_the_candidate_changes_during_confirmation() {
    let reports = MemoryReportPort::default();
    let original = ReportDefinition::compose_report(
        REPORT_REF,
        "Reusable notes",
        ReportLocale::EnUs,
        SNAPSHOT_REF,
        ReportOrigin::Blank,
        vec![
            ReportBlock::narrative(NARRATIVE_BLOCK_REF, "Keep the authored interpretation.")
                .expect("narrative block"),
        ],
    )
    .expect("blank report");
    reports
        .create_report_definition(&original)
        .expect("save blank report");
    let changing_library = SequencedSnapshotPort {
        snapshots: Mutex::new(vec![
            CHANGED_SNAPSHOT_REF.to_owned(),
            LATER_SNAPSHOT_REF.to_owned(),
        ]),
    };

    assert!(matches!(
        refresh_report(
            &reports,
            &StubTrainingPort {
                snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
            },
            &StubRoutePort,
            &StubProvenancePort,
            &changing_library,
            &NoPlannedTrainingPort,
            RefreshReportRequest {
                report_ref: REPORT_REF.to_owned(),
                expected_revision: original.revision(),
                expected_source_snapshot_ref: SNAPSHOT_REF.to_owned(),
                expected_resolved_snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
            },
        ),
        Err(ApplicationError::ReportSourceChanged)
    ));
    assert_eq!(
        reports
            .load_report_definition(REPORT_REF)
            .expect("load preserved report"),
        Some(original)
    );
}

#[test]
fn refreshes_question_exploration_and_blank_origins_without_reauthoring_them() {
    let query = ReportTrainingComparisonQuery::new(
        ReportDateRange::new("2026-01-01", "2026-01-31").expect("baseline range"),
        ReportDateRange::new("2026-02-01", "2026-02-28").expect("comparison range"),
    );
    for origin in [
        ReportOrigin::Question {
            question: ReportQuestion::TrainingPeriodComparisonV1,
        },
        ReportOrigin::Exploration {
            query: query.clone(),
        },
        ReportOrigin::Blank,
    ] {
        let reports = MemoryReportPort::default();
        let blocks = if matches!(origin, ReportOrigin::Blank) {
            vec![
                ReportBlock::narrative(NARRATIVE_BLOCK_REF, "Keep the authored interpretation.")
                    .expect("narrative block"),
            ]
        } else {
            vec![
                ReportBlock::training_comparison(SESSION_BLOCK_REF, query.clone())
                    .expect("comparison block"),
                ReportBlock::narrative(NARRATIVE_BLOCK_REF, "Keep the authored interpretation.")
                    .expect("narrative block"),
            ]
        };
        let original = ReportDefinition::compose_report(
            REPORT_REF,
            "Origin-aware report",
            ReportLocale::EsEs,
            SNAPSHOT_REF,
            origin,
            blocks,
        )
        .expect("origin-aware report");
        reports
            .create_report_definition(&original)
            .expect("save origin-aware report");
        let current_library = AnalyticalTrainingPort {
            snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
            queries: Mutex::new(Vec::new()),
        };

        let refreshed = refresh_report(
            &reports,
            &StubTrainingPort {
                snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
            },
            &StubRoutePort,
            &StubProvenancePort,
            &current_library,
            &NoPlannedTrainingPort,
            RefreshReportRequest {
                report_ref: REPORT_REF.to_owned(),
                expected_revision: original.revision(),
                expected_source_snapshot_ref: SNAPSHOT_REF.to_owned(),
                expected_resolved_snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
            },
        )
        .expect("refresh origin-aware report");

        assert_eq!(refreshed.origin(), original.origin());
        assert_eq!(refreshed.blocks(), original.blocks());
        assert_eq!(refreshed.title(), original.title());
        assert_eq!(refreshed.locale(), original.locale());
    }
}

#[test]
fn resolves_current_analytical_candidate_evidence_when_a_report_becomes_stale() {
    let port = MemoryReportPort::default();
    let original_comparison_port = AnalyticalTrainingPort::current();
    create_composed_session_report(
        &port,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &original_comparison_port,
        analytical_composition(),
    )
    .expect("analytical report");
    let current_comparison_port = AnalyticalTrainingPort {
        snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
        queries: Mutex::new(Vec::new()),
    };

    let resolved = resolve_session_report(
        &port,
        &StubTrainingPort {
            snapshot_ref: CHANGED_SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &StubProvenancePort,
        &current_comparison_port,
        REPORT_REF,
    )
    .expect("stale analytical candidate");

    assert_eq!(resolved.status, ReportResolutionStatus::Stale);
    assert_eq!(resolved.resolved_snapshot_ref, CHANGED_SNAPSHOT_REF);
    assert_eq!(resolved.definition.source_snapshot_ref(), SNAPSHOT_REF);
    assert_eq!(
        resolved
            .training_comparison
            .expect("current comparison candidate")
            .series[0]
            .comparison
            .session_count,
        2
    );
    assert_eq!(
        current_comparison_port
            .queries
            .lock()
            .expect("comparison queries")
            .len(),
        2
    );
}

#[test]
fn exports_only_current_explicitly_reviewed_content() {
    let port = MemoryReportPort::default();
    created_report(&port);
    let output = RecordingExportPort::default();
    let cancellation = ReportExportCancellation::new();

    let receipt = export_session_report(
        &port,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &StubProvenancePort,
        &NoComparisonPort,
        &output,
        SessionReportExportRequest {
            report_ref: REPORT_REF.to_owned(),
            expected_revision: 1,
            expected_source_snapshot_ref: SNAPSHOT_REF.to_owned(),
            include_physiological_context: false,
            route_choices: vec![],
            destination: "/tmp/fitfreed-report.html".into(),
        },
        &cancellation,
    )
    .expect("exported report");

    assert_eq!(receipt.byte_count, 512);
    let exports = output.exports.lock().expect("exports");
    assert_eq!(exports.len(), 1);
    let session = exports[0].session.as_ref().expect("session evidence");
    assert_eq!(session.average_heart_rate_bpm, None);
    assert_eq!(session.maximum_heart_rate_bpm, None);
    assert!(!exports[0].include_physiological_context);
}

#[test]
fn refuses_stale_revision_snapshot_and_sensitivity_escalation_before_writing() {
    let port = MemoryReportPort::default();
    let created = created_report(&port);
    let changed = author_session_report(
        &created,
        created.title(),
        created.locale(),
        false,
        "Felt controlled.",
    )
    .expect("physiology-disabled report");
    *port.reports.lock().expect("reports") = vec![changed];
    let output = RecordingExportPort::default();

    for (revision, snapshot, include, expected) in [
        (1, SNAPSHOT_REF, false, "conflict"),
        (2, CHANGED_SNAPSHOT_REF, false, "source"),
        (2, SNAPSHOT_REF, true, "sensitivity"),
    ] {
        let result = export_session_report(
            &port,
            &StubTrainingPort {
                snapshot_ref: SNAPSHOT_REF.to_owned(),
            },
            &StubRoutePort,
            &StubProvenancePort,
            &NoComparisonPort,
            &output,
            SessionReportExportRequest {
                report_ref: REPORT_REF.to_owned(),
                expected_revision: revision,
                expected_source_snapshot_ref: snapshot.to_owned(),
                include_physiological_context: include,
                route_choices: vec![],
                destination: "/tmp/fitfreed-report.html".into(),
            },
            &ReportExportCancellation::new(),
        );
        assert!(matches!(
            (expected, result),
            ("conflict", Err(ApplicationError::ReportDefinitionConflict))
                | ("source", Err(ApplicationError::ReportSourceChanged))
                | (
                    "sensitivity",
                    Err(ApplicationError::InvalidReportDefinition(_))
                )
        ));
    }
    assert!(output.exports.lock().expect("exports").is_empty());
}

#[test]
fn cancellation_prevents_output_creation() {
    let port = MemoryReportPort::default();
    created_report(&port);
    let output = RecordingExportPort::default();
    let cancellation = ReportExportCancellation::new();
    cancellation.cancel();

    assert!(matches!(
        export_session_report(
            &port,
            &StubTrainingPort {
                snapshot_ref: SNAPSHOT_REF.to_owned(),
            },
            &StubRoutePort,
            &StubProvenancePort,
            &NoComparisonPort,
            &output,
            SessionReportExportRequest {
                report_ref: REPORT_REF.to_owned(),
                expected_revision: 1,
                expected_source_snapshot_ref: SNAPSHOT_REF.to_owned(),
                include_physiological_context: true,
                route_choices: vec![],
                destination: "/tmp/fitfreed-report.html".into(),
            },
            &cancellation,
        ),
        Err(ApplicationError::ReportExportCancelled)
    ));
    assert!(output.exports.lock().expect("exports").is_empty());
}

#[test]
fn cancellation_stops_paginated_route_resolution_before_output_creation() {
    let port = MemoryReportPort::default();
    create_composed_session_report(
        &port,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
        &NoComparisonPort,
        composition(),
    )
    .expect("routed report");
    let output = RecordingExportPort::default();
    let cancellation = ReportExportCancellation::new();

    assert!(matches!(
        export_session_report(
            &port,
            &StubTrainingPort {
                snapshot_ref: SNAPSHOT_REF.to_owned(),
            },
            &CancellingRoutePort {
                cancellation: &cancellation,
            },
            &StubProvenancePort,
            &NoComparisonPort,
            &output,
            SessionReportExportRequest {
                report_ref: REPORT_REF.to_owned(),
                expected_revision: 1,
                expected_source_snapshot_ref: SNAPSHOT_REF.to_owned(),
                include_physiological_context: false,
                route_choices: vec![ReportRouteExportChoice {
                    block_ref: ROUTE_BLOCK_REF.to_owned(),
                    include_geometry: true,
                    endpoint_redaction_meters: 200,
                }],
                destination: "/tmp/fitfreed-route-report.html".into(),
            },
            &cancellation,
        ),
        Err(ApplicationError::ReportExportCancelled)
    ));
    assert!(cancellation.is_cancelled());
    assert!(output.exports.lock().expect("exports").is_empty());
}
