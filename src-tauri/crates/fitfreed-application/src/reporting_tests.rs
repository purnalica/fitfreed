use std::{path::Path, sync::Mutex};

use fitfreed_domain::{
    author_session_report, ReportBlockContent, ReportDefinition, ReportLocale,
    REPORT_DEFINITION_VERSION, REPORT_DEFINITION_VERSION_V1,
};

use super::*;

const REPORT_REF: &str = "report-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
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
const ROUTE_REF: &str = "route-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const EXERCISE_REF: &str =
    "exercise-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

#[derive(Default)]
struct MemoryReportPort {
    reports: Mutex<Vec<ReportDefinition>>,
    next_block: Mutex<usize>,
}

impl ReportDefinitionPort for MemoryReportPort {
    fn new_report_ref(&self) -> Result<String, ReportDefinitionPortError> {
        Ok(REPORT_REF.to_owned())
    }

    fn new_report_block_ref(&self) -> Result<String, ReportDefinitionPortError> {
        let mut next = self.next_block.lock().expect("block sequence");
        let block_ref = [SESSION_BLOCK_REF, ROUTE_BLOCK_REF, NARRATIVE_BLOCK_REF]
            .get(*next)
            .copied()
            .unwrap_or(
                "report-block-2222222222222222222222222222222222222222222222222222222222222222",
            );
        *next += 1;
        Ok(block_ref.to_owned())
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
}

struct StubTrainingPort {
    snapshot_ref: String,
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
        },
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

#[test]
fn composes_reorders_and_resolves_a_redacted_route_from_authoritative_evidence() {
    let port = MemoryReportPort::default();
    let created = create_composed_session_report(
        &port,
        &StubTrainingPort {
            snapshot_ref: SNAPSHOT_REF.to_owned(),
        },
        &StubRoutePort,
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
        REPORT_REF,
    )
    .expect("stale report candidate");

    assert_eq!(resolved.status, ReportResolutionStatus::Stale);
    assert_eq!(resolved.resolved_snapshot_ref, CHANGED_SNAPSHOT_REF);
    assert_eq!(resolved.definition.source_snapshot_ref(), SNAPSHOT_REF);
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
    assert_eq!(exports[0].session.average_heart_rate_bpm, None);
    assert_eq!(exports[0].session.maximum_heart_rate_bpm, None);
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
