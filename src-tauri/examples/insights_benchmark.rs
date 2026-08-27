use std::{
    env, fs,
    path::Path,
    process::{self, Command},
    time::{Duration, Instant},
};

#[cfg(unix)]
use std::{ffi::CString, mem::MaybeUninit, os::unix::ffi::OsStrExt};

use chrono::{Duration as ChronoDuration, NaiveDate};
use fitfreed_application::{
    create_composed_session_report, create_report, export_report, list_report_library,
    query_activity_comparison, query_activity_overview, query_longitudinal_comparison,
    query_longitudinal_overview, query_planned_training_chronology, query_planned_training_target,
    query_recovery_comparison, query_recovery_detail, query_recovery_overview,
    query_sleep_comparison, query_sleep_detail, query_sleep_overview, query_training_comparison,
    query_training_overview, query_training_route_points, query_training_session_calendar,
    query_training_session_provenance, query_training_session_routes,
    query_training_session_segmentation, query_training_session_selection,
    query_training_session_signals, query_training_session_structure, query_training_session_zones,
    query_training_sessions, query_training_signal_samples, resolve_report, resolve_session_report,
    ActivityDateRange, CreateComposedSessionReportRequest, CreateReportRequest,
    LongitudinalDateRange, PlannedTrainingChronologyQuery, PlannedTrainingCollection,
    PlannedTrainingTargetQuery, RecoveryDateRange, ReportExportCancellation, ReportExportRequest,
    ReportLibraryRequest, ReportRouteExportChoice, SessionReportBlockDraft,
    SessionReportBlockDraftContent, SleepDateRange, TrainingDateRange, TrainingRoutePointsQuery,
    TrainingSessionCalendarRequest, TrainingSessionProvenanceQuery, TrainingSessionRouteQuery,
    TrainingSessionSearchRequest, TrainingSessionSegmentationQuery,
    TrainingSessionSelectionRequest, TrainingSessionSignalsQuery, TrainingSessionSort,
    TrainingSessionStructureQuery, TrainingSessionZonesQuery, TrainingSignalSamplesQuery,
};
use fitfreed_domain::{
    ReportBlockContent, ReportDateRange, ReportLocale, ReportOrigin, ReportQuestion,
    ReportTrainingComparisonQuery, ReportTrainingMetric,
};
use fitfreed_lib::infrastructure::{
    query_activity_between, SelfContainedHtmlReportExporter, SqliteActivityLibrary,
    SqliteLongitudinalLibrary, SqliteRecoveryLibrary, SqliteReportLibrary, SqliteSleepLibrary,
    SqliteTrainingLibrary,
};
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use tempfile::tempdir;

const ORIGIN_COUNT: usize = 4;
const ROUTE_POINTS_PER_ORIGIN: usize = 250_000;
const SIGNAL_SAMPLES_PER_ORIGIN: usize = 100_000;
const ZONE_GROUPS_PER_ORIGIN: usize = 64;
const ZONES_PER_GROUP: usize = 256;
const PLANNED_TARGET_COUNT: usize = 520;
const PLANNED_PHASES_PER_TARGET: usize = 8;
const PLANNED_REPEAT_START_ORDINAL: usize = 2;
const PLANNED_REPEAT_END_ORDINAL: usize = 5;
const PLANNED_REPEAT_ITERATIONS: usize = 4;
const PLANNED_EXPANDED_PHASES_PER_TARGET: usize = PLANNED_PHASES_PER_TARGET
    + (PLANNED_REPEAT_END_ORDINAL - PLANNED_REPEAT_START_ORDINAL + 1)
        * (PLANNED_REPEAT_ITERATIONS - 1);
const WARM_UP_RUNS: usize = 10;
const MEASURED_RUNS: usize = 100;
const COMMON_BUDGET_MILLISECONDS: f64 = 500.0;
const COMPLEX_BUDGET_MILLISECONDS: f64 = 2_000.0;

struct Measurement {
    median: Duration,
    p95: Duration,
    maximum: Duration,
}

struct GeneratedRows {
    activity: usize,
    recovery: usize,
    planned_training_targets: usize,
    planned_training_exercises: usize,
    planned_training_phases: usize,
    planned_training_provenance_events: usize,
    training: usize,
    training_provenance_events: usize,
    training_structures: usize,
    training_exercises: usize,
    training_laps: usize,
    training_pauses: usize,
    training_routes: usize,
    training_route_points: usize,
    training_signals: usize,
    training_signal_samples: usize,
    training_zone_session_assessments: usize,
    training_zone_exercise_assessments: usize,
    training_zone_groups: usize,
    training_zones: usize,
    training_segment_criteria: usize,
    training_segment_applications: usize,
    sleep: usize,
    sleep_transitions: usize,
}

fn main() {
    let directory = tempdir().expect("temporary benchmark directory");
    let database_path = directory.path().join("fitfreed.sqlite");
    query_activity_between(&database_path, None, None).expect("initialize production schema");
    let generated_rows = generate_history(&database_path);
    let activity_library = SqliteActivityLibrary::new(database_path.clone());
    let recovery_library = SqliteRecoveryLibrary::new(database_path.clone());
    let report_library = SqliteReportLibrary::new(database_path.clone());
    let training_library = SqliteTrainingLibrary::new(database_path.clone());
    let sleep_library = SqliteSleepLibrary::new(database_path.clone());
    let longitudinal_library = SqliteLongitudinalLibrary::new(database_path.clone());

    let latest_range = range("2025-12-02", "2025-12-31");
    let maximum_range = range("2024-12-31", "2025-12-31");
    let earlier_common = range("2020-01-01", "2020-01-30");
    let later_common = range("2025-01-01", "2025-01-30");
    let earlier_maximum = range("2019-01-01", "2020-01-01");

    let default_overview = measure(ORIGIN_COUNT * 30, || {
        let overview =
            query_activity_overview(&activity_library, None).expect("default activity overview");
        overview.series.iter().map(|series| series.days.len()).sum()
    });
    let common_filter = measure(ORIGIN_COUNT * 30, || {
        let overview = query_activity_overview(&activity_library, Some(latest_range.clone()))
            .expect("common activity filter");
        overview.series.iter().map(|series| series.days.len()).sum()
    });
    let maximum_filter = measure(ORIGIN_COUNT * 366, || {
        let overview = query_activity_overview(&activity_library, Some(maximum_range.clone()))
            .expect("maximum activity filter");
        overview.series.iter().map(|series| series.days.len()).sum()
    });
    let common_comparison = measure(ORIGIN_COUNT, || {
        query_activity_comparison(
            &activity_library,
            earlier_common.clone(),
            later_common.clone(),
        )
        .expect("common activity comparison")
        .series
        .len()
    });
    let maximum_comparison = measure(ORIGIN_COUNT, || {
        query_activity_comparison(
            &activity_library,
            earlier_maximum.clone(),
            maximum_range.clone(),
        )
        .expect("maximum activity comparison")
        .series
        .len()
    });

    let training_latest_range = training_range("2025-12-02", "2025-12-31");
    let training_maximum_range = training_range("2024-12-31", "2025-12-31");
    let training_earlier_common = training_range("2020-01-01", "2020-01-30");
    let training_later_common = training_range("2025-01-01", "2025-01-30");
    let training_earlier_maximum = training_range("2019-01-01", "2020-01-01");
    let training_default_overview = measure(ORIGIN_COUNT * 30, || {
        let overview =
            query_training_overview(&training_library, None).expect("default training overview");
        overview
            .series
            .iter()
            .map(|series| series.sessions.len())
            .sum()
    });
    let training_common_filter = measure(ORIGIN_COUNT * 30, || {
        let overview =
            query_training_overview(&training_library, Some(training_latest_range.clone()))
                .expect("common training filter");
        overview
            .series
            .iter()
            .map(|series| series.sessions.len())
            .sum()
    });
    let training_maximum_filter = measure(ORIGIN_COUNT * 366, || {
        let overview =
            query_training_overview(&training_library, Some(training_maximum_range.clone()))
                .expect("maximum training filter");
        overview
            .series
            .iter()
            .map(|series| series.sessions.len())
            .sum()
    });
    let training_common_comparison = measure(ORIGIN_COUNT, || {
        query_training_comparison(
            &training_library,
            training_earlier_common.clone(),
            training_later_common.clone(),
        )
        .expect("common training comparison")
        .series
        .len()
    });
    let training_maximum_comparison = measure(ORIGIN_COUNT, || {
        query_training_comparison(
            &training_library,
            training_earlier_maximum.clone(),
            training_maximum_range.clone(),
        )
        .expect("maximum training comparison")
        .series
        .len()
    });
    let training_discovery_request = TrainingSessionSearchRequest {
        from: None,
        through: None,
        sport_refs: Vec::new(),
        required_measurements: Vec::new(),
        text: None,
        sort: TrainingSessionSort::StartedDescending,
        offset: 0,
        limit: 25,
        snapshot_ref: None,
    };
    let training_discovery_page =
        query_training_sessions(&training_library, training_discovery_request.clone())
            .expect("training discovery setup");
    let training_discovery = measure(25, || {
        query_training_sessions(&training_library, training_discovery_request.clone())
            .expect("training discovery page")
            .sessions
            .len()
    });
    let planned_training_chronology_request = PlannedTrainingChronologyQuery {
        collection: PlannedTrainingCollection::Scheduled,
        completion: None,
        from: None,
        through: None,
        offset: 0,
        limit: 50,
        snapshot_ref: None,
    };
    let planned_training_chronology_setup = query_planned_training_chronology(
        &training_library,
        planned_training_chronology_request.clone(),
    )
    .expect("planned-training chronology setup");
    assert_eq!(
        planned_training_chronology_setup.total_count,
        PLANNED_TARGET_COUNT
    );
    assert_eq!(planned_training_chronology_setup.targets.len(), 50);
    let planned_training_target_ref = planned_training_chronology_setup.targets[0]
        .target
        .target_id()
        .to_owned();
    let planned_training_snapshot_ref = planned_training_chronology_setup.snapshot_ref.clone();
    let planned_training_chronology = measure(50, || {
        query_planned_training_chronology(
            &training_library,
            planned_training_chronology_request.clone(),
        )
        .expect("planned-training chronology")
        .targets
        .len()
    });
    let planned_training_target_request = PlannedTrainingTargetQuery {
        target_ref: planned_training_target_ref.clone(),
        snapshot_ref: Some(planned_training_snapshot_ref.clone()),
    };
    let planned_training_target_setup =
        query_planned_training_target(&training_library, planned_training_target_request.clone())
            .expect("planned-training target setup");
    assert_eq!(
        planned_training_target_setup.target.shape.phase_count,
        Some(PLANNED_PHASES_PER_TARGET)
    );
    assert_eq!(
        planned_training_target_setup
            .target
            .shape
            .expanded_phase_count,
        Some(PLANNED_EXPANDED_PHASES_PER_TARGET)
    );
    let planned_training_target_detail = measure(PLANNED_PHASES_PER_TARGET, || {
        query_planned_training_target(&training_library, planned_training_target_request.clone())
            .expect("planned-training target detail")
            .target
            .target
            .exercises()
            .expect("generated planned exercises")
            .iter()
            .map(|exercise| {
                exercise
                    .phases
                    .as_ref()
                    .expect("generated planned phases")
                    .len()
            })
            .sum()
    });
    let training_calendar_request = TrainingSessionCalendarRequest {
        month: "2025-12".to_owned(),
        from: None,
        through: None,
        sport_refs: Vec::new(),
        required_measurements: Vec::new(),
        text: None,
        snapshot_ref: Some(training_discovery_page.snapshot_ref.clone()),
    };
    let training_calendar = measure(ORIGIN_COUNT * 31, || {
        query_training_session_calendar(&training_library, training_calendar_request.clone())
            .expect("training calendar month")
            .days
            .len()
    });
    let training_selection_request = TrainingSessionSelectionRequest {
        session_refs: training_discovery_page
            .sessions
            .iter()
            .take(4)
            .map(|session| session.session_ref.clone())
            .collect(),
        snapshot_ref: Some(training_discovery_page.snapshot_ref.clone()),
    };
    let training_session_selection = measure(4, || {
        query_training_session_selection(&training_library, training_selection_request.clone())
            .expect("training session selection")
            .sessions
            .len()
    });
    let training_structure_request = TrainingSessionStructureQuery {
        session_ref: training_discovery_page.sessions[0].session_ref.clone(),
        snapshot_ref: Some(training_discovery_page.snapshot_ref.clone()),
    };
    let training_session_structure = measure(1, || {
        query_training_session_structure(&training_library, training_structure_request.clone())
            .expect("training session structure")
            .structure
            .and_then(|structure| structure.exercises)
            .expect("generated training exercises")
            .len()
    });
    let training_provenance_request = TrainingSessionProvenanceQuery {
        session_ref: training_discovery_page.sessions[0].session_ref.clone(),
        snapshot_ref: Some(training_discovery_page.snapshot_ref.clone()),
        offset: 0,
        limit: 25,
    };
    let training_provenance = measure(1, || {
        query_training_session_provenance(&training_library, training_provenance_request.clone())
            .expect("training session provenance")
            .events
            .len()
    });
    let training_route_request = TrainingSessionRouteQuery {
        session_ref: training_discovery_page.sessions[0].session_ref.clone(),
        snapshot_ref: Some(training_discovery_page.snapshot_ref.clone()),
        max_visual_points: 400,
    };
    let training_route_setup =
        query_training_session_routes(&training_library, training_route_request.clone())
            .expect("training route setup");
    let training_route_ref = training_route_setup
        .routes
        .and_then(|routes| routes.exercises)
        .expect("generated route exercises")[0]
        .routes
        .as_ref()
        .and_then(|routes| routes.primary.as_ref())
        .expect("generated primary route")
        .route_ref
        .clone();
    let training_route_overview = measure(400, || {
        query_training_session_routes(&training_library, training_route_request.clone())
            .expect("training route overview")
            .routes
            .and_then(|routes| routes.exercises)
            .expect("generated route exercises")
            .into_iter()
            .filter_map(|exercise| exercise.routes)
            .filter_map(|routes| routes.primary)
            .map(|route| route.visual_points.len())
            .sum()
    });
    let training_route_points_request = TrainingRoutePointsQuery {
        session_ref: training_discovery_page.sessions[0].session_ref.clone(),
        route_ref: training_route_ref,
        snapshot_ref: Some(training_discovery_page.snapshot_ref.clone()),
        offset: ROUTE_POINTS_PER_ORIGIN / 2,
        limit: 250,
    };
    let training_route_exact_page = measure(250, || {
        query_training_route_points(&training_library, training_route_points_request.clone())
            .expect("exact training route page")
            .points
            .len()
    });
    let route_report = create_composed_session_report(
        &report_library,
        &training_library,
        &training_library,
        &training_library,
        CreateComposedSessionReportRequest {
            title: "Synthetic maximum route report".to_owned(),
            locale: ReportLocale::EnUs,
            session_ref: training_discovery_page.sessions[0].session_ref.clone(),
            source_snapshot_ref: training_discovery_page.snapshot_ref.clone(),
            blocks: vec![
                SessionReportBlockDraft {
                    block_ref: None,
                    content: SessionReportBlockDraftContent::Route {
                        route_ref: training_route_points_request.route_ref.clone(),
                        endpoint_redaction_meters: 200,
                    },
                },
                SessionReportBlockDraft {
                    block_ref: None,
                    content: SessionReportBlockDraftContent::SessionEvidence {
                        include_physiological_context: true,
                    },
                },
                SessionReportBlockDraft {
                    block_ref: None,
                    content: SessionReportBlockDraftContent::Narrative {
                        body: "Synthetic route-scale performance evidence.".to_owned(),
                    },
                },
            ],
        },
    )
    .expect("create generated route report");
    let route_report_setup = resolve_session_report(
        &report_library,
        &training_library,
        &training_library,
        &training_library,
        &training_library,
        route_report.report_ref(),
    )
    .expect("resolve generated route report");
    let expected_report_route_points = route_report_setup.routes[0].visual_points.len();
    assert!((1..=500).contains(&expected_report_route_points));
    let training_route_report = measure(expected_report_route_points, || {
        resolve_session_report(
            &report_library,
            &training_library,
            &training_library,
            &training_library,
            &training_library,
            route_report.report_ref(),
        )
        .expect("resolve maximum route report")
        .routes[0]
            .visual_points
            .len()
    });
    let comparison_query = ReportTrainingComparisonQuery::new(
        ReportDateRange::new("2019-01-01", "2019-12-31").expect("maximum baseline report range"),
        ReportDateRange::new("2025-01-01", "2025-12-31").expect("maximum comparison report range"),
    );
    let comparison_report = create_composed_session_report(
        &report_library,
        &training_library,
        &training_library,
        &training_library,
        CreateComposedSessionReportRequest {
            title: "Synthetic maximum comparison report".to_owned(),
            locale: ReportLocale::EnUs,
            session_ref: training_discovery_page.sessions[0].session_ref.clone(),
            source_snapshot_ref: training_discovery_page.snapshot_ref.clone(),
            blocks: vec![
                SessionReportBlockDraft {
                    block_ref: None,
                    content: SessionReportBlockDraftContent::SessionEvidence {
                        include_physiological_context: true,
                    },
                },
                SessionReportBlockDraft {
                    block_ref: None,
                    content: SessionReportBlockDraftContent::TrainingFinding {
                        query: comparison_query.clone(),
                        metric: ReportTrainingMetric::SessionCount,
                    },
                },
                SessionReportBlockDraft {
                    block_ref: None,
                    content: SessionReportBlockDraftContent::TrainingComparison {
                        query: comparison_query.clone(),
                    },
                },
                SessionReportBlockDraft {
                    block_ref: None,
                    content: SessionReportBlockDraftContent::TrainingChart {
                        query: comparison_query.clone(),
                        metric: ReportTrainingMetric::Duration,
                    },
                },
                SessionReportBlockDraft {
                    block_ref: None,
                    content: SessionReportBlockDraftContent::TrainingExactTable {
                        query: comparison_query.clone(),
                    },
                },
                SessionReportBlockDraft {
                    block_ref: None,
                    content: SessionReportBlockDraftContent::TrainingCoverage {
                        query: comparison_query.clone(),
                    },
                },
                SessionReportBlockDraft {
                    block_ref: None,
                    content: SessionReportBlockDraftContent::Narrative {
                        body: "Synthetic comparison-scale performance evidence.".to_owned(),
                    },
                },
            ],
        },
    )
    .expect("create generated comparison report");
    let comparison_report_setup = resolve_session_report(
        &report_library,
        &training_library,
        &training_library,
        &training_library,
        &training_library,
        comparison_report.report_ref(),
    )
    .expect("resolve generated comparison report");
    assert_eq!(
        comparison_report_setup
            .training_comparison
            .expect("comparison report evidence")
            .series
            .len(),
        ORIGIN_COUNT
    );
    let training_comparison_report = measure(ORIGIN_COUNT, || {
        resolve_session_report(
            &report_library,
            &training_library,
            &training_library,
            &training_library,
            &training_library,
            comparison_report.report_ref(),
        )
        .expect("resolve maximum comparison report")
        .training_comparison
        .expect("comparison report evidence")
        .series
        .len()
    });
    let planned_training_report = create_report(
        &report_library,
        &training_library,
        &training_library,
        &training_library,
        &training_library,
        CreateReportRequest {
            title: "Synthetic phased training plan".to_owned(),
            locale: ReportLocale::EnUs,
            source_snapshot_ref: planned_training_snapshot_ref.clone(),
            origin: ReportOrigin::PlannedTraining {
                target_ref: planned_training_target_ref.clone(),
            },
            blocks: vec![
                SessionReportBlockDraft {
                    block_ref: None,
                    content: SessionReportBlockDraftContent::PlannedTraining {
                        target_ref: planned_training_target_ref.clone(),
                    },
                },
                SessionReportBlockDraft {
                    block_ref: None,
                    content: SessionReportBlockDraftContent::Narrative {
                        body: "Synthetic long-history phased-target performance evidence."
                            .to_owned(),
                    },
                },
            ],
        },
    )
    .expect("create generated planned-training report");
    let planned_training_report_setup = resolve_report(
        &report_library,
        &training_library,
        &training_library,
        &training_library,
        &training_library,
        &training_library,
        planned_training_report.report_ref(),
    )
    .expect("resolve generated planned-training report");
    assert_eq!(
        planned_training_report_setup
            .planned_training
            .as_ref()
            .expect("planned-training report evidence")
            .target
            .target
            .shape
            .expanded_phase_count,
        Some(PLANNED_EXPANDED_PHASES_PER_TARGET)
    );
    let planned_training_report_resolution = measure(PLANNED_PHASES_PER_TARGET, || {
        resolve_report(
            &report_library,
            &training_library,
            &training_library,
            &training_library,
            &training_library,
            &training_library,
            planned_training_report.report_ref(),
        )
        .expect("resolve phased planned-training report")
        .planned_training
        .expect("planned-training report evidence")
        .target
        .target
        .target
        .exercises()
        .expect("planned-training report exercises")
        .iter()
        .map(|exercise| {
            exercise
                .phases
                .as_ref()
                .expect("planned-training report phases")
                .len()
        })
        .sum()
    });
    for index in 0..21 {
        create_report(
            &report_library,
            &training_library,
            &training_library,
            &training_library,
            &training_library,
            CreateReportRequest {
                title: format!("Synthetic library report {}", index + 1),
                locale: ReportLocale::EnUs,
                source_snapshot_ref: training_discovery_page.snapshot_ref.clone(),
                origin: ReportOrigin::Question {
                    question: ReportQuestion::TrainingPeriodComparisonV1,
                },
                blocks: vec![SessionReportBlockDraft {
                    block_ref: None,
                    content: SessionReportBlockDraftContent::TrainingFinding {
                        query: comparison_query.clone(),
                        metric: ReportTrainingMetric::Duration,
                    },
                }],
            },
        )
        .expect("create generated report-library item");
    }
    let report_library_request = ReportLibraryRequest {
        offset: 0,
        limit: 24,
    };
    let report_library_setup = list_report_library(
        &report_library,
        &training_library,
        &training_library,
        &training_library,
        report_library_request.clone(),
    )
    .expect("maximum report-library setup");
    assert_eq!(report_library_setup.total_count, 24);
    assert_eq!(report_library_setup.items.len(), 24);
    let report_library_page = measure(24, || {
        list_report_library(
            &report_library,
            &training_library,
            &training_library,
            &training_library,
            report_library_request.clone(),
        )
        .expect("maximum report-library page")
        .items
        .len()
    });
    let route_choice = route_report
        .blocks()
        .iter()
        .find_map(|block| match block.content() {
            ReportBlockContent::Route {
                endpoint_redaction_meters,
                ..
            } => Some(ReportRouteExportChoice {
                block_ref: block.block_ref().to_owned(),
                include_geometry: true,
                endpoint_redaction_meters: *endpoint_redaction_meters,
            }),
            _ => None,
        })
        .expect("generated route report choice");
    let report_export_request = ReportExportRequest {
        report_ref: route_report.report_ref().to_owned(),
        expected_revision: route_report.revision(),
        expected_source_snapshot_ref: route_report.source_snapshot_ref().to_owned(),
        include_physiological_context: true,
        route_choices: vec![route_choice],
        destination: directory.path().join("maximum-route-report.html"),
    };
    let report_export_setup = export_report(
        &report_library,
        &training_library,
        &training_library,
        &training_library,
        &training_library,
        &training_library,
        &SelfContainedHtmlReportExporter,
        report_export_request.clone(),
        &ReportExportCancellation::new(),
    )
    .expect("maximum self-contained report export setup");
    let expected_export_bytes =
        usize::try_from(report_export_setup.byte_count).expect("report byte count fits usize");
    assert!(expected_export_bytes > 0);
    let report_html_export = measure(expected_export_bytes, || {
        usize::try_from(
            export_report(
                &report_library,
                &training_library,
                &training_library,
                &training_library,
                &training_library,
                &training_library,
                &SelfContainedHtmlReportExporter,
                report_export_request.clone(),
                &ReportExportCancellation::new(),
            )
            .expect("maximum self-contained report export")
            .byte_count,
        )
        .expect("report byte count fits usize")
    });
    let planned_training_export_request = ReportExportRequest {
        report_ref: planned_training_report.report_ref().to_owned(),
        expected_revision: planned_training_report.revision(),
        expected_source_snapshot_ref: planned_training_report.source_snapshot_ref().to_owned(),
        include_physiological_context: false,
        route_choices: Vec::new(),
        destination: directory.path().join("phased-planned-training-report.html"),
    };
    let planned_training_export_setup = export_report(
        &report_library,
        &training_library,
        &training_library,
        &training_library,
        &training_library,
        &training_library,
        &SelfContainedHtmlReportExporter,
        planned_training_export_request.clone(),
        &ReportExportCancellation::new(),
    )
    .expect("planned-training report export setup");
    let expected_planned_training_export_bytes =
        usize::try_from(planned_training_export_setup.byte_count)
            .expect("planned-training report byte count fits usize");
    assert!(expected_planned_training_export_bytes > 0);
    let planned_training_html_export = measure(expected_planned_training_export_bytes, || {
        usize::try_from(
            export_report(
                &report_library,
                &training_library,
                &training_library,
                &training_library,
                &training_library,
                &training_library,
                &SelfContainedHtmlReportExporter,
                planned_training_export_request.clone(),
                &ReportExportCancellation::new(),
            )
            .expect("planned-training self-contained report export")
            .byte_count,
        )
        .expect("planned-training report byte count fits usize")
    });
    let training_signal_request = TrainingSessionSignalsQuery {
        session_ref: training_discovery_page.sessions[0].session_ref.clone(),
        snapshot_ref: Some(training_discovery_page.snapshot_ref.clone()),
        max_visual_samples: 300,
    };
    let training_signal_setup =
        query_training_session_signals(&training_library, training_signal_request.clone())
            .expect("training signal setup");
    let training_signal_ref = training_signal_setup
        .signals
        .and_then(|signals| signals.exercises)
        .expect("generated signal exercises")[0]
        .signals
        .as_ref()
        .and_then(|signals| signals.primary.as_ref())
        .expect("generated primary signals")[0]
        .signal_ref
        .clone();
    let training_signal_overview = measure(300, || {
        query_training_session_signals(&training_library, training_signal_request.clone())
            .expect("training signal overview")
            .signals
            .and_then(|signals| signals.exercises)
            .expect("generated signal exercises")
            .into_iter()
            .filter_map(|exercise| exercise.signals)
            .flat_map(|signals| signals.primary.unwrap_or_default())
            .map(|signal| signal.visual_samples.len())
            .sum()
    });
    let training_signal_samples_request = TrainingSignalSamplesQuery {
        session_ref: training_discovery_page.sessions[0].session_ref.clone(),
        signal_ref: training_signal_ref,
        snapshot_ref: Some(training_discovery_page.snapshot_ref.clone()),
        offset: SIGNAL_SAMPLES_PER_ORIGIN / 2,
        limit: 250,
    };
    let training_signal_exact_page = measure(250, || {
        query_training_signal_samples(&training_library, training_signal_samples_request.clone())
            .expect("exact training signal page")
            .samples
            .len()
    });
    let training_zones_request = TrainingSessionZonesQuery {
        session_ref: training_discovery_page.sessions[0].session_ref.clone(),
        snapshot_ref: Some(training_discovery_page.snapshot_ref.clone()),
    };
    let expected_zones = ZONE_GROUPS_PER_ORIGIN * ZONES_PER_GROUP;
    let training_zones = measure(expected_zones, || {
        query_training_session_zones(&training_library, training_zones_request.clone())
            .expect("training zone detail")
            .zones
            .and_then(|zones| zones.exercises)
            .expect("generated zone exercises")[0]
            .zones
            .as_ref()
            .expect("generated zone collection")
            .groups
            .iter()
            .map(|group| group.zones.as_ref().expect("generated zone values").len())
            .sum()
    });
    let training_segmentation_request = TrainingSessionSegmentationQuery {
        session_ref: training_discovery_page.sessions[0].session_ref.clone(),
        snapshot_ref: Some(training_discovery_page.snapshot_ref.clone()),
    };
    let segmentation_setup = query_training_session_segmentation(
        &training_library,
        training_segmentation_request.clone(),
    )
    .expect("training segmentation setup");
    let expected_segments = segmentation_setup
        .exercises
        .expect("generated segment exercises")[0]
        .applied_criteria[0]
        .segments
        .len();
    assert!(
        expected_segments > 0,
        "generated segmentation must be applicable"
    );
    let training_segmentation = measure(expected_segments, || {
        query_training_session_segmentation(
            &training_library,
            training_segmentation_request.clone(),
        )
        .expect("training segmentation")
        .exercises
        .expect("generated segment exercises")[0]
            .applied_criteria[0]
            .segments
            .len()
    });

    let sleep_latest_range = sleep_range("2025-12-02", "2025-12-31");
    let sleep_maximum_range = sleep_range("2024-12-31", "2025-12-31");
    let sleep_earlier_common = sleep_range("2020-01-01", "2020-01-30");
    let sleep_later_common = sleep_range("2025-01-01", "2025-01-30");
    let sleep_earlier_maximum = sleep_range("2019-01-01", "2020-01-01");
    let sleep_default_overview = measure(ORIGIN_COUNT * 30, || {
        let overview = query_sleep_overview(&sleep_library, None).expect("default sleep overview");
        overview.series.iter().map(|series| series.days.len()).sum()
    });
    let sleep_common_filter = measure(ORIGIN_COUNT * 30, || {
        let overview = query_sleep_overview(&sleep_library, Some(sleep_latest_range.clone()))
            .expect("common sleep filter");
        overview.series.iter().map(|series| series.days.len()).sum()
    });
    let sleep_maximum_filter = measure(ORIGIN_COUNT * 366, || {
        let overview = query_sleep_overview(&sleep_library, Some(sleep_maximum_range.clone()))
            .expect("maximum sleep filter");
        overview.series.iter().map(|series| series.days.len()).sum()
    });
    let sleep_common_comparison = measure(ORIGIN_COUNT, || {
        query_sleep_comparison(
            &sleep_library,
            sleep_earlier_common.clone(),
            sleep_later_common.clone(),
        )
        .expect("common sleep comparison")
        .series
        .len()
    });
    let sleep_maximum_comparison = measure(ORIGIN_COUNT, || {
        query_sleep_comparison(
            &sleep_library,
            sleep_earlier_maximum.clone(),
            sleep_maximum_range.clone(),
        )
        .expect("maximum sleep comparison")
        .series
        .len()
    });
    let sleep_detail = measure(4, || {
        query_sleep_detail(&sleep_library, "synthetic-origin-0", "2025-12-31")
            .expect("sleep detail query")
            .expect("generated sleep detail")
            .stage_transitions
            .expect("generated sleep timeline")
            .len()
    });

    let recovery_latest_range = recovery_range("2025-12-02", "2025-12-31");
    let recovery_maximum_range = recovery_range("2024-12-31", "2025-12-31");
    let recovery_earlier_common = recovery_range("2020-01-01", "2020-01-30");
    let recovery_later_common = recovery_range("2025-01-01", "2025-01-30");
    let recovery_earlier_maximum = recovery_range("2019-01-01", "2020-01-01");
    let recovery_default_overview = measure(ORIGIN_COUNT * 30, || {
        let overview =
            query_recovery_overview(&recovery_library, None).expect("default recovery overview");
        overview.series.iter().map(|series| series.days.len()).sum()
    });
    let recovery_common_filter = measure(ORIGIN_COUNT * 30, || {
        let overview =
            query_recovery_overview(&recovery_library, Some(recovery_latest_range.clone()))
                .expect("common recovery filter");
        overview.series.iter().map(|series| series.days.len()).sum()
    });
    let recovery_maximum_filter = measure(ORIGIN_COUNT * 366, || {
        let overview =
            query_recovery_overview(&recovery_library, Some(recovery_maximum_range.clone()))
                .expect("maximum recovery filter");
        overview.series.iter().map(|series| series.days.len()).sum()
    });
    let recovery_common_comparison = measure(ORIGIN_COUNT, || {
        query_recovery_comparison(
            &recovery_library,
            recovery_earlier_common.clone(),
            recovery_later_common.clone(),
        )
        .expect("common recovery comparison")
        .series
        .len()
    });
    let recovery_maximum_comparison = measure(ORIGIN_COUNT, || {
        query_recovery_comparison(
            &recovery_library,
            recovery_earlier_maximum.clone(),
            recovery_maximum_range.clone(),
        )
        .expect("maximum recovery comparison")
        .series
        .len()
    });
    let recovery_detail = measure(1, || {
        usize::from(
            query_recovery_detail(&recovery_library, "synthetic-origin-0", "2025-12-31")
                .expect("recovery detail query")
                .expect("generated recovery detail")
                .source_guidance
                .is_some(),
        )
    });

    let longitudinal_latest_range = longitudinal_range("2025-12-02", "2025-12-31");
    let longitudinal_maximum_range = longitudinal_range("2024-12-31", "2025-12-31");
    let longitudinal_earlier_common = longitudinal_range("2020-01-01", "2020-01-30");
    let longitudinal_later_common = longitudinal_range("2025-01-01", "2025-01-30");
    let longitudinal_earlier_maximum = longitudinal_range("2019-01-01", "2020-01-01");
    let longitudinal_default_overview = measure(ORIGIN_COUNT * 30, || {
        query_longitudinal_overview(&longitudinal_library, None)
            .expect("default longitudinal overview")
            .series
            .iter()
            .map(|series| series.days.len())
            .sum()
    });
    let longitudinal_common_filter = measure(ORIGIN_COUNT * 30, || {
        query_longitudinal_overview(
            &longitudinal_library,
            Some(longitudinal_latest_range.clone()),
        )
        .expect("common longitudinal filter")
        .series
        .iter()
        .map(|series| series.days.len())
        .sum()
    });
    let longitudinal_maximum_filter = measure(ORIGIN_COUNT * 366, || {
        query_longitudinal_overview(
            &longitudinal_library,
            Some(longitudinal_maximum_range.clone()),
        )
        .expect("maximum longitudinal filter")
        .series
        .iter()
        .map(|series| series.days.len())
        .sum()
    });
    let longitudinal_common_comparison = measure(ORIGIN_COUNT, || {
        query_longitudinal_comparison(
            &longitudinal_library,
            longitudinal_earlier_common.clone(),
            longitudinal_later_common.clone(),
        )
        .expect("common longitudinal comparison")
        .series
        .len()
    });
    let longitudinal_maximum_comparison = measure(ORIGIN_COUNT, || {
        query_longitudinal_comparison(
            &longitudinal_library,
            longitudinal_earlier_maximum.clone(),
            longitudinal_maximum_range.clone(),
        )
        .expect("maximum longitudinal comparison")
        .series
        .len()
    });

    let measurements = [
        (
            "activity.defaultOverview",
            &default_overview,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "activity.commonFilter",
            &common_filter,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "activity.maximumFilter",
            &maximum_filter,
            COMPLEX_BUDGET_MILLISECONDS,
        ),
        (
            "activity.commonComparison",
            &common_comparison,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "activity.maximumComparison",
            &maximum_comparison,
            COMPLEX_BUDGET_MILLISECONDS,
        ),
        (
            "training.defaultOverview",
            &training_default_overview,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "training.commonFilter",
            &training_common_filter,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "training.maximumFilter",
            &training_maximum_filter,
            COMPLEX_BUDGET_MILLISECONDS,
        ),
        (
            "training.commonComparison",
            &training_common_comparison,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "training.maximumComparison",
            &training_maximum_comparison,
            COMPLEX_BUDGET_MILLISECONDS,
        ),
        (
            "training.discoveryPage",
            &training_discovery,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "plannedTraining.chronologyPage",
            &planned_training_chronology,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "plannedTraining.targetDetail",
            &planned_training_target_detail,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "plannedTraining.reportResolution",
            &planned_training_report_resolution,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "plannedTraining.selfContainedHtmlExport",
            &planned_training_html_export,
            COMPLEX_BUDGET_MILLISECONDS,
        ),
        (
            "training.calendarMonth",
            &training_calendar,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "training.sessionSelection",
            &training_session_selection,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "training.sessionStructure",
            &training_session_structure,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "training.sessionProvenance",
            &training_provenance,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "training.routeOverview",
            &training_route_overview,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "training.routeExactPage",
            &training_route_exact_page,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "training.routeReportResolution",
            &training_route_report,
            COMPLEX_BUDGET_MILLISECONDS,
        ),
        (
            "training.comparisonReportResolution",
            &training_comparison_report,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "report.libraryPage",
            &report_library_page,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "report.selfContainedHtmlExport",
            &report_html_export,
            COMPLEX_BUDGET_MILLISECONDS,
        ),
        (
            "training.signalOverview",
            &training_signal_overview,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "training.signalExactPage",
            &training_signal_exact_page,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "training.recordedZones",
            &training_zones,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "training.segmentation",
            &training_segmentation,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "sleep.defaultOverview",
            &sleep_default_overview,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "sleep.commonFilter",
            &sleep_common_filter,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "sleep.maximumFilter",
            &sleep_maximum_filter,
            COMPLEX_BUDGET_MILLISECONDS,
        ),
        (
            "sleep.commonComparison",
            &sleep_common_comparison,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "sleep.maximumComparison",
            &sleep_maximum_comparison,
            COMPLEX_BUDGET_MILLISECONDS,
        ),
        ("sleep.detail", &sleep_detail, COMMON_BUDGET_MILLISECONDS),
        (
            "recovery.defaultOverview",
            &recovery_default_overview,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "recovery.commonFilter",
            &recovery_common_filter,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "recovery.maximumFilter",
            &recovery_maximum_filter,
            COMPLEX_BUDGET_MILLISECONDS,
        ),
        (
            "recovery.commonComparison",
            &recovery_common_comparison,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "recovery.maximumComparison",
            &recovery_maximum_comparison,
            COMPLEX_BUDGET_MILLISECONDS,
        ),
        (
            "recovery.detail",
            &recovery_detail,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "longitudinal.defaultOverview",
            &longitudinal_default_overview,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "longitudinal.commonFilter",
            &longitudinal_common_filter,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "longitudinal.maximumFilter",
            &longitudinal_maximum_filter,
            COMPLEX_BUDGET_MILLISECONDS,
        ),
        (
            "longitudinal.commonComparison",
            &longitudinal_common_comparison,
            COMMON_BUDGET_MILLISECONDS,
        ),
        (
            "longitudinal.maximumComparison",
            &longitudinal_maximum_comparison,
            COMPLEX_BUDGET_MILLISECONDS,
        ),
    ];
    let violations = measurements
        .iter()
        .filter(|(_, measurement, budget)| milliseconds(measurement.p95) > *budget)
        .map(|(name, measurement, budget)| {
            format!(
                "{name} p95 {:.3} ms exceeds {:.0} ms",
                milliseconds(measurement.p95),
                budget,
            )
        })
        .collect::<Vec<_>>();

    println!(
        "{}",
        json!({
            "schemaVersion": 1,
            "runtime": "fitfreed-production-insights-read-models",
            "applicationVersion": env!("CARGO_PKG_VERSION"),
            "sourceRevision": command_output("git", &["rev-parse", "HEAD"]),
            "host": host_information(directory.path()),
            "scenario": {
                "generator": "independently-authored-deterministic",
                "from": "2016-01-01",
                "through": "2025-12-31",
                "calendarDays": 3_653,
                "origins": ORIGIN_COUNT,
                "storedActivityObservations": generated_rows.activity,
                "storedPlannedTrainingTargets": generated_rows.planned_training_targets,
                "storedPlannedTrainingExercises": generated_rows.planned_training_exercises,
                "storedPlannedTrainingPhases": generated_rows.planned_training_phases,
                "storedPlannedTrainingProvenanceEvents": generated_rows.planned_training_provenance_events,
                "expandedPhasesPerPlannedTarget": PLANNED_EXPANDED_PHASES_PER_TARGET,
                "storedTrainingSessions": generated_rows.training,
                "storedTrainingProvenanceEvents": generated_rows.training_provenance_events,
                "storedTrainingStructures": generated_rows.training_structures,
                "storedTrainingExercises": generated_rows.training_exercises,
                "storedTrainingLaps": generated_rows.training_laps,
                "storedTrainingPauses": generated_rows.training_pauses,
                "storedTrainingRoutes": generated_rows.training_routes,
                "storedTrainingRoutePoints": generated_rows.training_route_points,
                "storedTrainingSignals": generated_rows.training_signals,
                "storedTrainingSignalSamples": generated_rows.training_signal_samples,
                "storedTrainingZoneSessionAssessments": generated_rows.training_zone_session_assessments,
                "storedTrainingZoneExerciseAssessments": generated_rows.training_zone_exercise_assessments,
                "storedTrainingZoneGroups": generated_rows.training_zone_groups,
                "storedTrainingZones": generated_rows.training_zones,
                "storedTrainingSegmentCriteria": generated_rows.training_segment_criteria,
                "storedTrainingSegmentApplications": generated_rows.training_segment_applications,
                "storedSleepPeriods": generated_rows.sleep,
                "storedSleepTransitions": generated_rows.sleep_transitions,
                "storedRecoveryNights": generated_rows.recovery,
                "databaseBytes": fs::metadata(&database_path).expect("database metadata").len(),
            },
            "method": {
                "warmUpRunsPerInteraction": WARM_UP_RUNS,
                "measuredRunsPerInteraction": MEASURED_RUNS,
                "percentile": "sorted zero-based index ceil((n - 1) * 0.95)",
                "scope": "SQLite adapter plus application read model; report export also includes deterministic HTML and atomic local output",
            },
            "measurements": {
                "activity": {
                    "defaultOverview": measurement_json(&default_overview, COMMON_BUDGET_MILLISECONDS),
                    "commonFilter": measurement_json(&common_filter, COMMON_BUDGET_MILLISECONDS),
                    "maximumFilter": measurement_json(&maximum_filter, COMPLEX_BUDGET_MILLISECONDS),
                    "commonComparison": measurement_json(&common_comparison, COMMON_BUDGET_MILLISECONDS),
                    "maximumComparison": measurement_json(&maximum_comparison, COMPLEX_BUDGET_MILLISECONDS),
                },
                "training": {
                    "defaultOverview": measurement_json(
                        &training_default_overview,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "commonFilter": measurement_json(
                        &training_common_filter,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "maximumFilter": measurement_json(
                        &training_maximum_filter,
                        COMPLEX_BUDGET_MILLISECONDS,
                    ),
                    "commonComparison": measurement_json(
                        &training_common_comparison,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "maximumComparison": measurement_json(
                        &training_maximum_comparison,
                        COMPLEX_BUDGET_MILLISECONDS,
                    ),
                    "discoveryPage": measurement_json(
                        &training_discovery,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "calendarMonth": measurement_json(
                        &training_calendar,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "sessionSelection": measurement_json(
                        &training_session_selection,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "sessionStructure": measurement_json(
                        &training_session_structure,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "sessionProvenance": measurement_json(
                        &training_provenance,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "routeOverview": measurement_json(
                        &training_route_overview,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "routeExactPage": measurement_json(
                        &training_route_exact_page,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "routeReportResolution": measurement_json(
                        &training_route_report,
                        COMPLEX_BUDGET_MILLISECONDS,
                    ),
                    "comparisonReportResolution": measurement_json(
                        &training_comparison_report,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "signalOverview": measurement_json(
                        &training_signal_overview,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "signalExactPage": measurement_json(
                        &training_signal_exact_page,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "recordedZones": measurement_json(
                        &training_zones,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "segmentation": measurement_json(
                        &training_segmentation,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                },
                "plannedTraining": {
                    "chronologyPage": measurement_json(
                        &planned_training_chronology,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "targetDetail": measurement_json(
                        &planned_training_target_detail,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "reportResolution": measurement_json(
                        &planned_training_report_resolution,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "selfContainedHtmlExport": measurement_json(
                        &planned_training_html_export,
                        COMPLEX_BUDGET_MILLISECONDS,
                    ),
                },
                "report": {
                    "libraryPage": measurement_json(
                        &report_library_page,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "selfContainedHtmlExport": measurement_json(
                        &report_html_export,
                        COMPLEX_BUDGET_MILLISECONDS,
                    ),
                },
                "sleep": {
                    "defaultOverview": measurement_json(
                        &sleep_default_overview,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "commonFilter": measurement_json(
                        &sleep_common_filter,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "maximumFilter": measurement_json(
                        &sleep_maximum_filter,
                        COMPLEX_BUDGET_MILLISECONDS,
                    ),
                    "commonComparison": measurement_json(
                        &sleep_common_comparison,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "maximumComparison": measurement_json(
                        &sleep_maximum_comparison,
                        COMPLEX_BUDGET_MILLISECONDS,
                    ),
                    "detail": measurement_json(&sleep_detail, COMMON_BUDGET_MILLISECONDS),
                },
                "recovery": {
                    "defaultOverview": measurement_json(
                        &recovery_default_overview,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "commonFilter": measurement_json(
                        &recovery_common_filter,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "maximumFilter": measurement_json(
                        &recovery_maximum_filter,
                        COMPLEX_BUDGET_MILLISECONDS,
                    ),
                    "commonComparison": measurement_json(
                        &recovery_common_comparison,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "maximumComparison": measurement_json(
                        &recovery_maximum_comparison,
                        COMPLEX_BUDGET_MILLISECONDS,
                    ),
                    "detail": measurement_json(
                        &recovery_detail,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                },
                "longitudinal": {
                    "defaultOverview": measurement_json(
                        &longitudinal_default_overview,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "commonFilter": measurement_json(
                        &longitudinal_common_filter,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "maximumFilter": measurement_json(
                        &longitudinal_maximum_filter,
                        COMPLEX_BUDGET_MILLISECONDS,
                    ),
                    "commonComparison": measurement_json(
                        &longitudinal_common_comparison,
                        COMMON_BUDGET_MILLISECONDS,
                    ),
                    "maximumComparison": measurement_json(
                        &longitudinal_maximum_comparison,
                        COMPLEX_BUDGET_MILLISECONDS,
                    ),
                },
            },
            "budgetsPassed": violations.is_empty(),
            "violations": violations,
            "peakResidentMiB": peak_resident_mib(),
        })
    );

    if !violations.is_empty() {
        process::exit(1);
    }
}

fn generate_history(database_path: &Path) -> GeneratedRows {
    let first_date = NaiveDate::from_ymd_opt(2016, 1, 1).expect("first synthetic date");
    let last_date = NaiveDate::from_ymd_opt(2025, 12, 31).expect("last synthetic date");
    let calendar_days = last_date.signed_duration_since(first_date).num_days() + 1;
    let mut connection = Connection::open(database_path).expect("open generated library");
    let transaction = connection.transaction().expect("begin generated history");
    let mut activity_rows = 0;
    let mut recovery_rows = 0;
    let mut planned_training_target_rows = 0;
    let mut planned_training_exercise_rows = 0;
    let mut planned_training_phase_rows = 0;
    let mut planned_training_provenance_event_rows = 0;
    let mut training_rows = 0;
    let mut training_provenance_event_rows = 0;
    let mut training_structure_rows = 0;
    let mut training_exercise_rows = 0;
    let mut training_lap_rows = 0;
    let mut training_pause_rows = 0;
    let mut training_route_rows = 0;
    let mut training_route_point_rows = 0;
    let mut training_signal_rows = 0;
    let mut training_signal_sample_rows = 0;
    let mut training_zone_session_assessment_rows = 0;
    let mut training_zone_exercise_assessment_rows = 0;
    let mut training_zone_group_rows = 0;
    let mut training_zone_rows = 0;
    let mut training_segment_criterion_rows = 0;
    let mut training_segment_application_rows = 0;
    let mut sleep_rows = 0;
    let mut sleep_transition_rows = 0;
    {
        transaction
            .execute(
                "INSERT INTO import_operation (
                    id, operation_ref, package_sha256, state, source_provider,
                    source_adapter_version, mapping_version, started_at_utc, updated_at_utc,
                    completed_at_utc, exact_repeat, repeated_operation_id, coverage_complete,
                    total_artifacts, supported_artifacts, unsupported_artifacts,
                    ignored_artifacts, unrecognized_artifacts, invalid_artifacts,
                    recognized_artifacts, new_observations, equivalent_observations,
                    enriched_observations, amended_observations, preserved_observations,
                    conflicts, canonical_history_changed, temporary_state_removed,
                    terminal_code, recovery_note
                 ) VALUES (
                    1, 'synthetic-insights-provenance', NULL, 'completed', 'polar-flow',
                    'polar-flow-archive@11', 'polar-flow-mapping-set@6',
                    '2025-12-31T23:00:00Z', '2025-12-31T23:00:00Z',
                    '2025-12-31T23:00:00Z', 0, NULL, 1,
                    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, NULL, NULL
                 )",
                [],
            )
            .expect("insert generated provenance import operation");
        let mut statement = transaction
            .prepare_cached(
                "INSERT INTO observation_origin (
                    id, source_provider, correlation_state, created_at_utc
                 ) VALUES (?1, 'polar-flow', 'verified', '2016-01-01T00:00:00Z')",
            )
            .expect("prepare generated origin insertion");
        for origin_index in 0..ORIGIN_COUNT {
            statement
                .execute([format!("synthetic-origin-{origin_index}")])
                .expect("insert generated origin");
        }
    }
    {
        let mut statement = transaction
            .prepare_cached(
                "INSERT INTO daily_activity (origin_id, local_date, step_count)
                 VALUES (?1, ?2, ?3)",
            )
            .expect("prepare generated observation insertion");
        for origin_index in 0..ORIGIN_COUNT {
            let origin = format!("synthetic-origin-{origin_index}");
            for day_offset in 0..calendar_days {
                let is_boundary = day_offset == 0 || day_offset == calendar_days - 1;
                if !is_boundary && (day_offset + origin_index as i64 * 7) % 23 == 0 {
                    continue;
                }
                let local_date = first_date + ChronoDuration::days(day_offset);
                let step_count = if (day_offset + origin_index as i64 * 11) % 19 == 0 {
                    None
                } else {
                    Some((day_offset * 7_919 + origin_index as i64 * 997) % 40_000)
                };
                statement
                    .execute(params![
                        origin,
                        local_date.format("%Y-%m-%d").to_string(),
                        step_count,
                    ])
                    .expect("insert generated observation");
                activity_rows += 1;
            }
        }
    }
    {
        let mut target_statement = transaction
            .prepare_cached(
                "INSERT INTO planned_training_target (
                    origin_id, target_id, source_provider, source_kind, source_identity,
                    current_evidence_revision, current_mapping_version, reconciliation_state,
                    first_seen_import_operation_id, last_seen_import_operation_id
                 ) VALUES (?1, ?2, 'polar-flow', 'scheduled', ?3, ?4,
                    'synthetic-planned-training@1', 'current', 1, 1)",
            )
            .expect("prepare generated planned target insertion");
        let mut revision_statement = transaction
            .prepare_cached(
                "INSERT INTO planned_training_target_revision (
                    origin_id, target_id, evidence_revision, mapping_version, target_kind,
                    scheduled_at_local, completion_state, name, description, editability,
                    exercises_present, mapping_state, unmapped_field_count, source_export_version
                 ) VALUES (?1, ?2, ?3, 'synthetic-planned-training@1', 'scheduled',
                    ?4, 'completed', ?5, 'Synthetic phased training intent', 'editable',
                    1, 'complete', 0, 'synthetic-v1')",
            )
            .expect("prepare generated planned target revision insertion");
        let mut exercise_statement = transaction
            .prepare_cached(
                "INSERT INTO planned_training_exercise (
                    origin_id, target_id, evidence_revision, mapping_version, exercise_id,
                    ordinal, exercise_kind, duration_goal_milliseconds, distance_goal_meters,
                    sport_state, canonical_family_suggestion, localized_names_json,
                    catalogue_revision, catalogue_retrieved_at_utc, sport_mapping_version,
                    sport_evidence_ref, phases_present
                 ) VALUES (?1, ?2, ?3, 'synthetic-planned-training@1', ?4,
                    0, 'phased', NULL, NULL, 'unavailable', NULL, NULL, NULL, NULL, NULL, NULL, 1)",
            )
            .expect("prepare generated planned exercise insertion");
        let mut phase_statement = transaction
            .prepare_cached(
                "INSERT INTO planned_training_phase (
                    origin_id, target_id, evidence_revision, mapping_version, exercise_id,
                    phase_id, ordinal, name, goal_kind, duration_goal_milliseconds,
                    distance_goal_meters, intensity_kind, intensity_metric, lower_zone,
                    upper_zone, transition_id, change_kind, repeat_id,
                    return_to_phase_ordinal, total_iterations
                 ) VALUES (?1, ?2, ?3, 'synthetic-planned-training@1', ?4,
                    ?5, ?6, ?7, ?8, ?9, ?10, 'zone-range', ?11, 2, 4,
                    ?12, ?13, ?14, ?15, ?16)",
            )
            .expect("prepare generated planned phase insertion");
        let mut provenance_statement = transaction
            .prepare_cached(
                "INSERT INTO planned_training_target_provenance (
                    origin_id, target_id, evidence_revision, mapping_version,
                    import_operation_id, source_provider, source_adapter_version,
                    source_identity, source_artifact_locator, source_artifact_sha256,
                    source_record_locator, source_export_version, reconciliation_decision,
                    contributes_to_visible_state
                 ) VALUES (?1, ?2, ?3, 'synthetic-planned-training@1', 1,
                    'polar-flow', 'synthetic-planned-training@1', ?4, ?5,
                    '0000000000000000000000000000000000000000000000000000000000000000',
                    'json-root', 'synthetic-v1', 'create', 1)",
            )
            .expect("prepare generated planned provenance insertion");
        let origin = "synthetic-origin-0";
        for target_index in 0..PLANNED_TARGET_COUNT {
            let target_number = target_index + 1;
            let target_id = format!("planned-target-{target_number:064x}");
            let evidence_revision = format!("planned-evidence-{target_number:064x}");
            let exercise_id = format!("planned-exercise-{target_number:064x}");
            let source_identity = format!("synthetic-planned-target-{target_number}");
            let scheduled_date = first_date
                + ChronoDuration::weeks(i64::try_from(target_index).expect("planned week"));
            let scheduled_at_local = format!("{}T06:00:00", scheduled_date.format("%Y-%m-%d"));
            target_statement
                .execute(params![
                    origin,
                    target_id,
                    source_identity,
                    evidence_revision
                ])
                .expect("insert generated planned target");
            revision_statement
                .execute(params![
                    origin,
                    target_id,
                    evidence_revision,
                    scheduled_at_local,
                    format!("Synthetic phased plan {target_number}")
                ])
                .expect("insert generated planned target revision");
            exercise_statement
                .execute(params![origin, target_id, evidence_revision, exercise_id])
                .expect("insert generated planned exercise");
            planned_training_target_rows += 1;
            planned_training_exercise_rows += 1;
            for phase_ordinal in 0..PLANNED_PHASES_PER_TARGET {
                let phase_number = target_index * PLANNED_PHASES_PER_TARGET + phase_ordinal + 1;
                let phase_id = format!("planned-phase-{phase_number:064x}");
                let transition_id = format!("planned-transition-{phase_number:064x}");
                let duration_goal = (phase_ordinal % 2 == 0)
                    .then_some(i64::try_from(phase_ordinal + 1).expect("phase duration") * 60_000);
                let distance_goal =
                    (phase_ordinal % 2 == 1).then_some((phase_ordinal + 1) as f64 * 250.0);
                let repeat_id = (phase_ordinal == PLANNED_REPEAT_END_ORDINAL)
                    .then(|| format!("planned-repeat-{target_number:064x}"));
                let return_to_phase_ordinal = (phase_ordinal == PLANNED_REPEAT_END_ORDINAL)
                    .then_some(PLANNED_REPEAT_START_ORDINAL);
                let total_iterations = (phase_ordinal == PLANNED_REPEAT_END_ORDINAL)
                    .then_some(PLANNED_REPEAT_ITERATIONS);
                phase_statement
                    .execute(params![
                        origin,
                        target_id,
                        evidence_revision,
                        exercise_id,
                        phase_id,
                        phase_ordinal,
                        format!("Phase {}", phase_ordinal + 1),
                        if duration_goal.is_some() {
                            "duration"
                        } else {
                            "distance"
                        },
                        duration_goal,
                        distance_goal,
                        match phase_ordinal % 3 {
                            0 => "heart-rate",
                            1 => "speed",
                            _ => "power",
                        },
                        transition_id,
                        if phase_ordinal % 2 == 0 {
                            "automatic"
                        } else {
                            "manual"
                        },
                        repeat_id,
                        return_to_phase_ordinal,
                        total_iterations,
                    ])
                    .expect("insert generated planned phase");
                planned_training_phase_rows += 1;
            }
            provenance_statement
                .execute(params![
                    origin,
                    target_id,
                    evidence_revision,
                    source_identity,
                    format!("synthetic/plans/{target_number}.json")
                ])
                .expect("insert generated planned provenance");
            planned_training_provenance_event_rows += 1;
        }
    }
    {
        let mut statement = transaction
            .prepare_cached(
                "INSERT INTO training_session (
                    origin_id, session_id, source_modified_at_utc,
                    started_at_local, stopped_at_local, utc_offset_minutes,
                    duration_milliseconds, distance_meters, energy_kilocalories,
                    average_heart_rate_bpm, maximum_heart_rate_bpm,
                    sport_ref, exercise_count
                 ) VALUES (
                    ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13
                 )",
            )
            .expect("prepare generated training insertion");
        let mut provenance_statement = transaction
            .prepare_cached(
                "INSERT INTO training_session_provenance (
                    origin_id, session_id, import_operation_id, artifact_locator,
                    source_record_locator, source_artifact_sha256, source_provider,
                    source_adapter_version, mapping_version, source_modified_at_utc,
                    reconciliation_decision, contributes_to_visible_state
                 ) VALUES (
                    ?1, ?2, 1, 'synthetic-training-session.json', 'json-root',
                    '0000000000000000000000000000000000000000000000000000000000000000',
                    'polar-flow', 'polar-flow-archive@11',
                    'polar-flow-training-session@6', ?3, 'create', 1
                 )",
            )
            .expect("prepare generated training provenance insertion");
        for origin_index in 0..ORIGIN_COUNT {
            let origin = format!("synthetic-origin-{origin_index}");
            for day_offset in 0..calendar_days {
                let local_date = first_date + ChronoDuration::days(day_offset);
                let started_at = local_date
                    .and_hms_opt(6 + u32::try_from(origin_index).expect("origin hour"), 0, 0)
                    .expect("generated training start");
                let duration_milliseconds = 1_800_000
                    + (day_offset + i64::try_from(origin_index).expect("origin index")) % 5
                        * 900_000;
                let stopped_at = started_at + ChronoDuration::milliseconds(duration_milliseconds);
                let optional_index =
                    day_offset + i64::try_from(origin_index).expect("origin index") * 17;
                let distance_meters =
                    (optional_index % 7 != 0).then_some(duration_milliseconds as f64 / 400.0);
                let energy_kilocalories =
                    (optional_index % 11 != 0).then_some(200 + optional_index % 700);
                let heart_rate = (optional_index % 13 != 0).then_some((130, 165));
                let date = local_date.format("%Y-%m-%d").to_string();
                statement
                    .execute(params![
                        origin,
                        format!("synthetic-session-{origin_index}-{date}"),
                        format!("{date}T23:00:00Z"),
                        started_at.format("%Y-%m-%dT%H:%M:%S").to_string(),
                        stopped_at.format("%Y-%m-%dT%H:%M:%S").to_string(),
                        60,
                        duration_milliseconds,
                        distance_meters,
                        energy_kilocalories,
                        heart_rate.map(|(average, _)| average),
                        heart_rate.map(|(_, maximum)| maximum),
                        format!("synthetic-sport-{}", optional_index % 4),
                        if local_date == last_date {
                            1
                        } else {
                            optional_index % 3
                        },
                    ])
                    .expect("insert generated training session");
                training_rows += 1;
                provenance_statement
                    .execute(params![
                        origin,
                        format!("synthetic-session-{origin_index}-{date}"),
                        format!("{date}T23:00:00")
                    ])
                    .expect("insert generated training provenance");
                training_provenance_event_rows += 1;
            }
        }
    }
    {
        let mut structure_statement = transaction
            .prepare_cached(
                "INSERT INTO training_session_structure (
                    origin_id, session_id, exercises_present, mapping_version
                 ) VALUES (?1, ?2, 1, 'synthetic-training-structure@1')",
            )
            .expect("prepare generated training structure insertion");
        let mut exercise_statement = transaction
            .prepare_cached(
                "INSERT INTO training_exercise (
                    origin_id, session_id, exercise_id, ordinal,
                    started_at_local, stopped_at_local, utc_offset_minutes,
                    duration_milliseconds, distance_meters, energy_kilocalories,
                    sport_ref, manual_laps_present, automatic_laps_present,
                    pauses_present
                 ) VALUES (
                    ?1, ?2, ?3, 0, ?4, ?5, 60, ?6, ?7, ?8, ?9, 1, 1, 1
                 )",
            )
            .expect("prepare generated training exercise insertion");
        let mut lap_statement = transaction
            .prepare_cached(
                "INSERT INTO training_lap (
                    origin_id, session_id, exercise_id, kind, ordinal,
                    split_time_milliseconds, duration_milliseconds, distance_meters
                 ) VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?7)",
            )
            .expect("prepare generated training lap insertion");
        let mut pause_statement = transaction
            .prepare_cached(
                "INSERT INTO training_pause (
                    origin_id, session_id, exercise_id, ordinal,
                    started_at_local, ended_at_local
                 ) VALUES (?1, ?2, ?3, 0, ?4, ?5)",
            )
            .expect("prepare generated training pause insertion");
        let mut route_assessment_statement = transaction
            .prepare_cached(
                "INSERT INTO training_session_route_assessment (
                    origin_id, session_id, exercises_present, mapping_version
                 ) VALUES (?1, ?2, 1, 'synthetic-training-route@1')",
            )
            .expect("prepare generated training route assessment insertion");
        let mut exercise_route_assessment_statement = transaction
            .prepare_cached(
                "INSERT INTO training_exercise_route_assessment (
                    origin_id, session_id, exercise_id, ordinal, routes_present
                 ) VALUES (?1, ?2, ?3, 0, 1)",
            )
            .expect("prepare generated exercise route assessment insertion");
        let mut route_statement = transaction
            .prepare_cached(
                "INSERT INTO training_route (
                    origin_id, session_id, exercise_id, kind, started_at_local,
                    point_count, altitude_point_count, elapsed_point_count
                 ) VALUES (?1, ?2, ?3, 'primary', ?4, ?5, ?5, ?5)",
            )
            .expect("prepare generated training route insertion");
        let mut route_point_statement = transaction
            .prepare_cached(
                "INSERT INTO training_route_point (
                    origin_id, session_id, exercise_id, kind, ordinal,
                    latitude_degrees, longitude_degrees, altitude_meters,
                    elapsed_milliseconds
                 ) VALUES (?1, ?2, ?3, 'primary', ?4, ?5, ?6, ?7, ?8)",
            )
            .expect("prepare generated training route point insertion");
        let mut signal_assessment_statement = transaction
            .prepare_cached(
                "INSERT INTO training_session_signal_assessment (
                    origin_id, session_id, exercises_present, mapping_version
                 ) VALUES (?1, ?2, 1, 'synthetic-training-signal@1')",
            )
            .expect("prepare generated training signal assessment insertion");
        let mut exercise_signal_assessment_statement = transaction
            .prepare_cached(
                "INSERT INTO training_exercise_signal_assessment (
                    origin_id, session_id, exercise_id, ordinal, signals_present,
                    primary_present, transition_present,
                    unsupported_primary_series_count,
                    unsupported_transition_series_count
                 ) VALUES (?1, ?2, ?3, 0, 1, 1, 1, 0, 0)",
            )
            .expect("prepare generated exercise signal assessment insertion");
        let mut signal_statement = transaction
            .prepare_cached(
                "INSERT INTO training_signal_series (
                    origin_id, session_id, exercise_id, role, ordinal, kind, unit,
                    interval_milliseconds, sample_count, available_sample_count
                 ) VALUES (
                    ?1, ?2, ?3, 'primary', 0, 'heart-rate', 'beats-per-minute',
                    1000, ?4, ?5
                 )",
            )
            .expect("prepare generated training signal insertion");
        let mut signal_sample_statement = transaction
            .prepare_cached(
                "INSERT INTO training_signal_sample (
                    series_id, ordinal, value
                 ) VALUES (?1, ?2, ?3)",
            )
            .expect("prepare generated training signal sample insertion");
        let mut zone_assessment_statement = transaction
            .prepare_cached(
                "INSERT INTO training_session_zone_assessment (
                    origin_id, session_id, exercises_present, mapping_version
                 ) VALUES (?1, ?2, 1, 'synthetic-training-zones@1')",
            )
            .expect("prepare generated training zone assessment insertion");
        let mut exercise_zone_assessment_statement = transaction
            .prepare_cached(
                "INSERT INTO training_exercise_zone_assessment (
                    origin_id, session_id, exercise_id, ordinal, zones_present,
                    unsupported_group_count
                 ) VALUES (?1, ?2, ?3, 0, 1, 1)",
            )
            .expect("prepare generated exercise zone assessment insertion");
        let mut zone_group_statement = transaction
            .prepare_cached(
                "INSERT INTO training_zone_group (
                    origin_id, session_id, exercise_id, ordinal, kind, unit,
                    zones_present
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)",
            )
            .expect("prepare generated training zone group insertion");
        let mut zone_statement = transaction
            .prepare_cached(
                "INSERT INTO training_zone (
                    origin_id, session_id, exercise_id, group_ordinal, ordinal,
                    lower_limit, higher_limit, time_in_zone_milliseconds,
                    distance_meters, muscle_load
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            )
            .expect("prepare generated training zone insertion");
        let mut segment_criterion_statement = transaction
            .prepare_cached(
                "INSERT INTO segment_criterion (
                    criterion_id, title, criterion_kind, span_milliseconds, span_meters,
                    minimum_beats_per_minute, maximum_beats_per_minute, authorship,
                    evaluation_version, revision, created_at_utc, updated_at_utc
                 ) VALUES (
                    ?1, ?2, 'heart-rate-zone', NULL, NULL, 115, 194, 'user',
                    1, 1, '2025-12-31T00:00:00Z', '2025-12-31T00:00:00Z'
                 )",
            )
            .expect("prepare generated segment criterion insertion");
        let mut segment_application_statement = transaction
            .prepare_cached(
                "INSERT INTO training_exercise_segment_criterion (
                    origin_id, session_id, exercise_id, criterion_id, ordinal, applied_at_utc
                 ) VALUES (?1, ?2, ?3, ?4, 0, '2025-12-31T00:00:00Z')",
            )
            .expect("prepare generated segment criterion application insertion");
        let day_offset = calendar_days - 1;
        let date = last_date.format("%Y-%m-%d").to_string();
        for origin_index in 0..ORIGIN_COUNT {
            let origin = format!("synthetic-origin-{origin_index}");
            let session_id = format!("synthetic-session-{origin_index}-{date}");
            let exercise_id = format!("synthetic-exercise-{origin_index}-{date}");
            let started_at = last_date
                .and_hms_opt(6 + u32::try_from(origin_index).expect("origin hour"), 0, 0)
                .expect("generated exercise start");
            let optional_index =
                day_offset + i64::try_from(origin_index).expect("origin index") * 17;
            let duration_milliseconds = 1_800_000 + optional_index % 5 * 900_000;
            let stopped_at = started_at + ChronoDuration::milliseconds(duration_milliseconds);
            let distance_meters =
                (optional_index % 7 != 0).then_some(duration_milliseconds as f64 / 400.0);
            let energy_kilocalories =
                (optional_index % 11 != 0).then_some(200 + optional_index % 700);
            structure_statement
                .execute(params![origin, session_id])
                .expect("insert generated training structure");
            training_structure_rows += 1;
            exercise_statement
                .execute(params![
                    origin,
                    session_id,
                    exercise_id,
                    started_at.format("%Y-%m-%dT%H:%M:%S").to_string(),
                    stopped_at.format("%Y-%m-%dT%H:%M:%S").to_string(),
                    duration_milliseconds,
                    distance_meters,
                    energy_kilocalories,
                    format!("synthetic-sport-{}", optional_index % 4),
                ])
                .expect("insert generated training exercise");
            training_exercise_rows += 1;
            for kind in ["manual", "automatic"] {
                lap_statement
                    .execute(params![
                        origin,
                        session_id,
                        exercise_id,
                        kind,
                        duration_milliseconds / 2,
                        duration_milliseconds / 2,
                        distance_meters.map(|distance| distance / 2.0),
                    ])
                    .expect("insert generated training lap");
                training_lap_rows += 1;
            }
            let pause_started = started_at + ChronoDuration::minutes(10);
            pause_statement
                .execute(params![
                    origin,
                    session_id,
                    exercise_id,
                    pause_started.format("%Y-%m-%dT%H:%M:%S").to_string(),
                    (pause_started + ChronoDuration::minutes(1))
                        .format("%Y-%m-%dT%H:%M:%S")
                        .to_string(),
                ])
                .expect("insert generated training pause");
            training_pause_rows += 1;
            route_assessment_statement
                .execute(params![origin, session_id])
                .expect("insert generated training route assessment");
            exercise_route_assessment_statement
                .execute(params![origin, session_id, exercise_id])
                .expect("insert generated exercise route assessment");
            route_statement
                .execute(params![
                    origin,
                    session_id,
                    exercise_id,
                    started_at.format("%Y-%m-%dT%H:%M:%S").to_string(),
                    i64::try_from(ROUTE_POINTS_PER_ORIGIN).expect("route point count"),
                ])
                .expect("insert generated training route");
            training_route_rows += 1;
            for point_index in 0..ROUTE_POINTS_PER_ORIGIN {
                let progress = point_index as f64 / ROUTE_POINTS_PER_ORIGIN as f64;
                let point_ordinal = i64::try_from(point_index).expect("route point index");
                let elapsed_milliseconds = point_ordinal * duration_milliseconds
                    / i64::try_from(ROUTE_POINTS_PER_ORIGIN - 1).expect("route point denominator");
                route_point_statement
                    .execute(params![
                        origin,
                        session_id,
                        exercise_id,
                        point_ordinal,
                        35.0 + progress / 4.0,
                        -5.0 + progress / 4.0,
                        600.0 + (point_index % 500) as f64 / 10.0,
                        elapsed_milliseconds,
                    ])
                    .expect("insert generated training route point");
                training_route_point_rows += 1;
            }
            signal_assessment_statement
                .execute(params![origin, session_id])
                .expect("insert generated training signal assessment");
            exercise_signal_assessment_statement
                .execute(params![origin, session_id, exercise_id])
                .expect("insert generated exercise signal assessment");
            let unavailable_signal_samples = (SIGNAL_SAMPLES_PER_ORIGIN - 1) / 997 + 1;
            signal_statement
                .execute(params![
                    origin,
                    session_id,
                    exercise_id,
                    i64::try_from(SIGNAL_SAMPLES_PER_ORIGIN).expect("signal sample count"),
                    i64::try_from(SIGNAL_SAMPLES_PER_ORIGIN - unavailable_signal_samples)
                        .expect("available signal sample count"),
                ])
                .expect("insert generated training signal");
            let signal_series_id = transaction.last_insert_rowid();
            training_signal_rows += 1;
            for sample_index in 0..SIGNAL_SAMPLES_PER_ORIGIN {
                let value = (sample_index % 997 != 0).then_some(115.0 + (sample_index % 80) as f64);
                signal_sample_statement
                    .execute(params![
                        signal_series_id,
                        i64::try_from(sample_index).expect("signal sample index"),
                        value,
                    ])
                    .expect("insert generated training signal sample");
                training_signal_sample_rows += 1;
            }
            zone_assessment_statement
                .execute(params![origin, session_id])
                .expect("insert generated training zone assessment");
            training_zone_session_assessment_rows += 1;
            exercise_zone_assessment_statement
                .execute(params![origin, session_id, exercise_id])
                .expect("insert generated exercise zone assessment");
            training_zone_exercise_assessment_rows += 1;
            for group_index in 0..ZONE_GROUPS_PER_ORIGIN {
                let (kind, unit) = match group_index % 3 {
                    0 => ("heart-rate", "beats-per-minute"),
                    1 => ("speed", "kilometers-per-hour"),
                    _ => ("power", "watts"),
                };
                zone_group_statement
                    .execute(params![
                        origin,
                        session_id,
                        exercise_id,
                        i64::try_from(group_index).expect("zone group index"),
                        kind,
                        unit,
                    ])
                    .expect("insert generated training zone group");
                training_zone_group_rows += 1;
                for zone_index in 0..ZONES_PER_GROUP {
                    let lower_limit = (zone_index * 2) as f64;
                    let zone_ordinal = i64::try_from(zone_index).expect("zone index");
                    let time_in_zone_milliseconds =
                        (zone_index % 17 != 0).then_some(zone_ordinal * 1_000);
                    let distance_meters = (kind == "speed").then_some(zone_index as f64 * 25.0);
                    let muscle_load = (kind == "power").then_some(zone_index as f64 / 4.0);
                    zone_statement
                        .execute(params![
                            origin,
                            session_id,
                            exercise_id,
                            i64::try_from(group_index).expect("zone group index"),
                            zone_ordinal,
                            lower_limit,
                            lower_limit + 1.5,
                            time_in_zone_milliseconds,
                            distance_meters,
                            muscle_load,
                        ])
                        .expect("insert generated training zone");
                    training_zone_rows += 1;
                }
            }
            let criterion_id = format!("criterion-{:064x}", origin_index + 1);
            segment_criterion_statement
                .execute(params![
                    criterion_id,
                    format!("Synthetic complete range {}", origin_index + 1),
                ])
                .expect("insert generated segment criterion");
            training_segment_criterion_rows += 1;
            segment_application_statement
                .execute(params![origin, session_id, exercise_id, criterion_id])
                .expect("apply generated segment criterion");
            training_segment_application_rows += 1;
        }
    }
    {
        let mut period_statement = transaction
            .prepare_cached(
                "INSERT INTO sleep_period (
                    origin_id, sleep_date, started_at, ended_at,
                    span_milliseconds, asleep_milliseconds, interruption_milliseconds,
                    long_interruption_milliseconds, short_interruption_milliseconds,
                    interruption_count, long_interruption_count, short_interruption_count,
                    efficiency_percent, continuity_index, continuity_class,
                    sleep_goal_milliseconds, self_reported_rating, cycle_count,
                    recording_ended_by_power_loss,
                    phase_wake_milliseconds, phase_rem_milliseconds,
                    phase_light_milliseconds, phase_deep_milliseconds,
                    phase_unrecognized_milliseconds, stage_timeline_available,
                    score_overall, score_own_target_duration, score_recommended_duration,
                    score_continuity, score_efficiency, score_rem, score_deep,
                    score_long_interruptions, score_duration, score_solidity,
                    score_regeneration, score_relative_rating
                 ) VALUES (
                    ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
                    ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20,
                    ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30,
                    ?31, ?32, ?33, ?34, ?35, ?36, ?37
                 )",
            )
            .expect("prepare generated sleep insertion");
        let mut transition_statement = transaction
            .prepare_cached(
                "INSERT INTO sleep_stage_transition (
                    origin_id, sleep_date, position, offset_milliseconds, stage
                 ) VALUES (?1, ?2, ?3, ?4, ?5)",
            )
            .expect("prepare generated sleep transition insertion");
        for origin_index in 0..ORIGIN_COUNT {
            let origin = format!("synthetic-origin-{origin_index}");
            for day_offset in 0..calendar_days {
                let sleep_date = first_date + ChronoDuration::days(day_offset);
                let previous_date = sleep_date - ChronoDuration::days(1);
                let date = sleep_date.format("%Y-%m-%d").to_string();
                period_statement
                    .execute(params![
                        origin,
                        date,
                        format!("{}T22:00:00+01:00", previous_date.format("%Y-%m-%d")),
                        format!("{date}T06:00:00+01:00"),
                        28_800_000,
                        27_000_000,
                        1_800_000,
                        1_200_000,
                        600_000,
                        3,
                        1,
                        2,
                        93.75,
                        4.2,
                        4,
                        28_800_000,
                        4,
                        2,
                        false,
                        1_800_000,
                        5_400_000,
                        14_400_000,
                        5_400_000,
                        1_800_000,
                        true,
                        82.0,
                        80.0,
                        78.0,
                        84.0,
                        86.0,
                        76.0,
                        81.0,
                        79.0,
                        79.0,
                        83.0,
                        78.5,
                        4,
                    ])
                    .expect("insert generated sleep period");
                sleep_rows += 1;
                for (position, offset_milliseconds, stage) in [
                    (0, 0, "wake"),
                    (1, 1_800_000, "light"),
                    (2, 7_200_000, "deep"),
                    (3, 12_600_000, "rem"),
                ] {
                    transition_statement
                        .execute(params![origin, date, position, offset_milliseconds, stage])
                        .expect("insert generated sleep transition");
                    sleep_transition_rows += 1;
                }
            }
        }
    }
    {
        let mut statement = transaction
            .prepare_cached(
                "INSERT INTO nightly_recovery (
                    origin_id, recovery_date,
                    beat_to_beat_interval_milliseconds,
                    heart_rate_variability_rmssd_milliseconds,
                    breathing_interval_milliseconds,
                    assessment_scheme, autonomic_charge, autonomic_status,
                    overall_status, overall_sublevel, baseline_scheme,
                    baseline_mean_beat_to_beat_interval_milliseconds,
                    baseline_standard_deviation_beat_to_beat_interval_milliseconds,
                    baseline_mean_heart_rate_variability_rmssd_milliseconds,
                    baseline_standard_deviation_heart_rate_variability_rmssd_milliseconds,
                    baseline_mean_breathing_interval_milliseconds,
                    baseline_standard_deviation_breathing_interval_milliseconds,
                    guidance_scheme, exercise_guidance, sleep_guidance, vitality_guidance
                 ) VALUES (
                    ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11,
                    ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21
                 )",
            )
            .expect("prepare generated recovery insertion");
        for origin_index in 0..ORIGIN_COUNT {
            let origin = format!("synthetic-origin-{origin_index}");
            for day_offset in 0..calendar_days {
                let recovery_date = first_date + ChronoDuration::days(day_offset);
                let date = recovery_date.format("%Y-%m-%d").to_string();
                let beat_to_beat = 850 + day_offset % 100;
                let rmssd = 35 + day_offset % 20;
                let breathing = 3_900 + day_offset % 400;
                statement
                    .execute(params![
                        origin,
                        date,
                        beat_to_beat,
                        rmssd,
                        breathing,
                        "synthetic-recovery@1",
                        1.5,
                        4,
                        5,
                        day_offset % 3,
                        "synthetic-recovery@1",
                        900,
                        30,
                        40,
                        8,
                        4_100,
                        120,
                        "synthetic-recovery@1",
                        "Choose a steady synthetic session.",
                        "Keep a consistent synthetic schedule.",
                        "Plan a synthetic restorative break.",
                    ])
                    .expect("insert generated recovery night");
                recovery_rows += 1;
            }
        }
    }
    transaction.commit().expect("commit generated history");
    connection
        .execute_batch("PRAGMA optimize;")
        .expect("optimize generated history");
    GeneratedRows {
        activity: activity_rows,
        recovery: recovery_rows,
        planned_training_targets: planned_training_target_rows,
        planned_training_exercises: planned_training_exercise_rows,
        planned_training_phases: planned_training_phase_rows,
        planned_training_provenance_events: planned_training_provenance_event_rows,
        training: training_rows,
        training_provenance_events: training_provenance_event_rows,
        training_structures: training_structure_rows,
        training_exercises: training_exercise_rows,
        training_laps: training_lap_rows,
        training_pauses: training_pause_rows,
        training_routes: training_route_rows,
        training_route_points: training_route_point_rows,
        training_signals: training_signal_rows,
        training_signal_samples: training_signal_sample_rows,
        training_zone_session_assessments: training_zone_session_assessment_rows,
        training_zone_exercise_assessments: training_zone_exercise_assessment_rows,
        training_zone_groups: training_zone_group_rows,
        training_zones: training_zone_rows,
        training_segment_criteria: training_segment_criterion_rows,
        training_segment_applications: training_segment_application_rows,
        sleep: sleep_rows,
        sleep_transitions: sleep_transition_rows,
    }
}

fn measure<F>(expected_observations: usize, mut operation: F) -> Measurement
where
    F: FnMut() -> usize,
{
    for _ in 0..WARM_UP_RUNS {
        assert_eq!(operation(), expected_observations);
    }
    let mut timings = Vec::with_capacity(MEASURED_RUNS);
    for _ in 0..MEASURED_RUNS {
        let started = Instant::now();
        assert_eq!(operation(), expected_observations);
        timings.push(started.elapsed());
    }
    timings.sort_unstable();
    Measurement {
        median: percentile(&timings, 0.50),
        p95: percentile(&timings, 0.95),
        maximum: *timings.last().expect("measured timings"),
    }
}

fn percentile(values: &[Duration], requested: f64) -> Duration {
    values[((values.len() - 1) as f64 * requested).ceil() as usize]
}

fn measurement_json(measurement: &Measurement, budget_milliseconds: f64) -> Value {
    json!({
        "medianMilliseconds": reported_milliseconds(measurement.median),
        "p95Milliseconds": reported_milliseconds(measurement.p95),
        "maximumMilliseconds": reported_milliseconds(measurement.maximum),
        "p95BudgetMilliseconds": budget_milliseconds,
        "passed": milliseconds(measurement.p95) <= budget_milliseconds,
    })
}

fn range(from: &str, through: &str) -> ActivityDateRange {
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

fn recovery_range(from: &str, through: &str) -> RecoveryDateRange {
    RecoveryDateRange {
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

fn longitudinal_range(from: &str, through: &str) -> LongitudinalDateRange {
    LongitudinalDateRange {
        from: from.to_owned(),
        through: through.to_owned(),
    }
}

fn milliseconds(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1_000.0
}

fn reported_milliseconds(duration: Duration) -> f64 {
    (milliseconds(duration) * 1_000.0).round() / 1_000.0
}

fn command_output(program: &str, arguments: &[&str]) -> Option<String> {
    let output = Command::new(program).args(arguments).output().ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

fn host_information(storage_path: &Path) -> Value {
    json!({
        "operatingSystem": env::consts::OS,
        "operatingSystemVersion": command_output("sw_vers", &["-productVersion"])
            .or_else(|| command_output("uname", &["-r"])),
        "architecture": env::consts::ARCH,
        "deviceModel": sysctl("hw.model"),
        "processor": sysctl("machdep.cpu.brand_string")
            .or_else(|| command_output("uname", &["-m"])),
        "totalMemoryBytes": sysctl("hw.memsize").and_then(|value| value.parse::<u64>().ok()),
        "freeStorageBytes": free_storage_bytes(storage_path),
    })
}

fn sysctl(name: &str) -> Option<String> {
    command_output("sysctl", &["-n", name])
}

#[cfg(unix)]
fn free_storage_bytes(path: &Path) -> Option<u64> {
    let path = CString::new(path.as_os_str().as_bytes()).ok()?;
    let mut statistics = MaybeUninit::<libc::statvfs>::uninit();
    let result = unsafe { libc::statvfs(path.as_ptr(), statistics.as_mut_ptr()) };
    if result != 0 {
        return None;
    }
    let statistics = unsafe { statistics.assume_init() };
    let available_blocks = u64::from(statistics.f_bavail);
    Some(available_blocks.saturating_mul(statistics.f_frsize))
}

#[cfg(not(unix))]
fn free_storage_bytes(_path: &Path) -> Option<u64> {
    None
}

#[cfg(target_os = "macos")]
fn peak_resident_mib() -> f64 {
    let mut usage = MaybeUninit::<libc::rusage>::uninit();
    let result = unsafe { libc::getrusage(libc::RUSAGE_SELF, usage.as_mut_ptr()) };
    assert_eq!(result, 0, "getrusage must succeed");
    let usage = unsafe { usage.assume_init() };
    usage.ru_maxrss as f64 / 1024.0 / 1024.0
}

#[cfg(not(target_os = "macos"))]
fn peak_resident_mib() -> f64 {
    0.0
}
