use std::{
    env, fs,
    path::Path,
    sync::{atomic::AtomicBool, mpsc},
    thread,
    time::{Duration, Instant},
};

use fitfreed_application::{
    query_library_home, query_training_session_signals, query_training_sessions,
    query_training_signal_samples, ImportPhase, ImportPhaseTimings, LibraryHomeRequest,
    TrainingSessionSearchRequest, TrainingSessionSignalsQuery, TrainingSessionSort,
    TrainingSignalSamplesQuery,
};
use fitfreed_lib::infrastructure::{
    import_polar_archive_with_progress, profile_polar_import_archive, SqliteLibraryHome,
    SqliteTrainingLibrary,
};
use rusqlite::Connection;
use serde_json::{json, Value};

const EXPECTED_SESSIONS: usize = 520;
const EXPECTED_SERIES: usize = 2_080;
const EXPECTED_SAMPLES: usize = 7_490_080;
const WARM_UP_RUNS: usize = 5;
const MEASURED_RUNS: usize = 20;
const CONCURRENT_QUERY_RUNS: usize = 20;

fn main() {
    let arguments = env::args().collect::<Vec<_>>();
    let archive = Path::new(arguments.get(1).expect("archive path argument"));
    let equivalent_archive = Path::new(arguments.get(2).expect("equivalent archive path argument"));
    let database = Path::new(arguments.get(3).expect("database path argument"));
    if database.exists() {
        fs::remove_file(database).expect("remove previous benchmark database");
    }

    let first_started = Instant::now();
    let first = profile_polar_import_archive(database, archive).expect("dense-history import");
    let first_import = first_started.elapsed();

    let repeat_started = Instant::now();
    let repeat =
        profile_polar_import_archive(database, archive).expect("dense-history exact repeat");
    let exact_repeat = repeat_started.elapsed();

    let changed_database = database.to_path_buf();
    let changed_archive = equivalent_archive.to_path_buf();
    let (late_reconciliation_ready_tx, late_reconciliation_ready_rx) = mpsc::sync_channel(0);
    let (navigation_measured_tx, navigation_measured_rx) = mpsc::sync_channel(0);
    let equivalent_reimport_started = Instant::now();
    let equivalent_reimport = thread::spawn(move || {
        let cancellation = AtomicBool::new(false);
        let mut late_probe_emitted = false;
        let report = import_polar_archive_with_progress(
            &changed_database,
            &changed_archive,
            &cancellation,
            |progress| {
                let late_boundary = progress
                    .total_artifacts
                    .is_some_and(|total| progress.completed_artifacts >= total * 4 / 5);
                if progress.phase == ImportPhase::Reconciling
                    && late_boundary
                    && !late_probe_emitted
                {
                    late_probe_emitted = true;
                    late_reconciliation_ready_tx
                        .send(())
                        .expect("announce late reconciliation");
                    navigation_measured_rx
                        .recv()
                        .expect("resume late reconciliation");
                }
            },
        )
        .expect("equivalent changed-package reimport");
        assert!(
            late_probe_emitted,
            "late reconciliation probe was not reached"
        );
        report
    });
    late_reconciliation_ready_rx
        .recv()
        .expect("observe late reconciliation");

    let concurrent_home_library = SqliteLibraryHome::new(database.to_path_buf());
    let concurrent_training_library = SqliteTrainingLibrary::new(database.to_path_buf());
    let concurrent_session_query = TrainingSessionSearchRequest {
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
    let (concurrent_library_home_p95, concurrent_session_page_p95) = measure_concurrent_navigation(
        || {
            query_library_home(&concurrent_home_library, LibraryHomeRequest::default())
                .expect("query Home during late reconciliation")
                .training
                .expect("training identity during late reconciliation")
                .recent_sessions
                .len()
        },
        || {
            query_training_sessions(
                &concurrent_training_library,
                concurrent_session_query.clone(),
            )
            .expect("query History during late reconciliation")
            .sessions
            .len()
        },
    );
    navigation_measured_tx
        .send(())
        .expect("release late reconciliation");
    let equivalent_report = equivalent_reimport
        .join()
        .expect("join equivalent changed-package reimport");
    let equivalent_reimport = equivalent_reimport_started.elapsed();

    let connection = Connection::open(database).expect("open dense-history library");
    connection
        .execute_batch("PRAGMA wal_checkpoint(TRUNCATE); PRAGMA optimize;")
        .expect("checkpoint dense-history library");
    let persisted_sessions = count(&connection, "training_session");
    let persisted_series = count(&connection, "training_signal_series");
    let persisted_samples = count(&connection, "training_signal_sample");
    assert_eq!(persisted_sessions, EXPECTED_SESSIONS);
    assert_eq!(persisted_series, EXPECTED_SERIES);
    assert_eq!(persisted_samples, EXPECTED_SAMPLES);
    let page_count = pragma(&connection, "page_count");
    let page_size = pragma(&connection, "page_size");
    drop(connection);

    let home_library = SqliteLibraryHome::new(database.to_path_buf());
    let (library_home_p95, library_home_recent_sessions) = measure(|| {
        query_library_home(&home_library, LibraryHomeRequest::default())
            .expect("query dense-history Library Home")
            .training
            .expect("dense-history Home training identity")
            .recent_sessions
            .len()
    });
    assert_eq!(library_home_recent_sessions, 4);

    let library = SqliteTrainingLibrary::new(database.to_path_buf());
    let session_query = TrainingSessionSearchRequest {
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
    let page = query_training_sessions(&library, session_query.clone())
        .expect("query dense-history session page setup");
    assert_eq!(page.total_count, EXPECTED_SESSIONS);
    let session_ref = page.sessions[0].session_ref.clone();
    let snapshot_ref = page.snapshot_ref;
    let (session_page_p95, session_page_sessions) = measure(|| {
        query_training_sessions(&library, session_query.clone())
            .expect("query dense-history session page")
            .sessions
            .len()
    });
    assert_eq!(session_page_sessions, 25);
    let overview_query = TrainingSessionSignalsQuery {
        session_ref: session_ref.clone(),
        snapshot_ref: Some(snapshot_ref.clone()),
        max_visual_samples: 300,
    };
    let overview_setup = query_training_session_signals(&library, overview_query.clone())
        .expect("query dense-history signal overview setup");
    let primary_series = overview_setup
        .signals
        .as_ref()
        .and_then(|signals| signals.exercises.as_ref())
        .expect("dense-history exercises")[0]
        .signals
        .as_ref()
        .and_then(|signals| signals.primary.as_ref())
        .expect("dense-history primary signals");
    let overview_series = primary_series.len();
    let signal_ref = primary_series[0].signal_ref.clone();

    let (signal_overview_p95, overview_visual_samples) = measure(|| {
        query_training_session_signals(&library, overview_query.clone())
            .expect("query dense-history signal overview")
            .signals
            .and_then(|signals| signals.exercises)
            .expect("dense-history signal exercises")
            .into_iter()
            .filter_map(|exercise| exercise.signals)
            .flat_map(|signals| signals.primary.unwrap_or_default())
            .map(|series| series.visual_samples.len())
            .sum()
    });
    let exact_query = TrainingSignalSamplesQuery {
        session_ref,
        signal_ref,
        snapshot_ref: Some(snapshot_ref),
        offset: 1_500,
        limit: 250,
    };
    let (signal_exact_page_p95, exact_page_samples) = measure(|| {
        query_training_signal_samples(&library, exact_query.clone())
            .expect("query dense-history exact signal page")
            .samples
            .len()
    });

    println!(
        "{}",
        json!({
            "runtime": "rust",
            "firstImportMilliseconds": milliseconds(first_import),
            "exactRepeatMilliseconds": milliseconds(exact_repeat),
            "equivalentReimportMilliseconds": milliseconds(equivalent_reimport),
            "equivalentReimportExactRepeat": equivalent_report.exact_repeat,
            "equivalentReimportEquivalentObservations": equivalent_report.equivalent_observations,
            "equivalentReimportNewObservations": equivalent_report.new_observations,
            "concurrentQueryRounds": CONCURRENT_QUERY_RUNS,
            "concurrentLibraryHomeP95Milliseconds": milliseconds(concurrent_library_home_p95),
            "concurrentSessionPageP95Milliseconds": milliseconds(concurrent_session_page_p95),
            "libraryHomeP95Milliseconds": milliseconds(library_home_p95),
            "sessionPageP95Milliseconds": milliseconds(session_page_p95),
            "signalOverviewP95Milliseconds": milliseconds(signal_overview_p95),
            "signalExactPageP95Milliseconds": milliseconds(signal_exact_page_p95),
            "peakResidentMiB": peak_resident_mib(),
            "databaseBytes": page_count * page_size,
            "recognizedArtifacts": first.report.recognized_artifacts,
            "newObservations": first.report.new_observations,
            "repeatDetected": repeat.report.exact_repeat,
            "persistedSessions": persisted_sessions,
            "persistedSeries": persisted_series,
            "persistedSamples": persisted_samples,
            "libraryHomeRecentSessions": library_home_recent_sessions,
            "sessionPageSessions": session_page_sessions,
            "overviewSeries": overview_series,
            "overviewVisualSamples": overview_visual_samples,
            "exactPageSamples": exact_page_samples,
            "firstImportPhases": timings_json(&first.timings),
            "exactRepeatPhases": timings_json(&repeat.timings),
        })
    );
}

fn count(connection: &Connection, table: &str) -> usize {
    let query = format!("SELECT COUNT(*) FROM {table}");
    let value = connection
        .query_row(&query, [], |row| row.get::<_, i64>(0))
        .expect("count dense-history rows");
    usize::try_from(value).expect("non-negative dense-history row count")
}

fn pragma(connection: &Connection, name: &str) -> u64 {
    let query = format!("PRAGMA {name}");
    let value = connection
        .query_row(&query, [], |row| row.get::<_, i64>(0))
        .expect("read dense-history storage pragma");
    u64::try_from(value).expect("non-negative dense-history storage value")
}

fn measure(mut operation: impl FnMut() -> usize) -> (Duration, usize) {
    for _ in 0..WARM_UP_RUNS {
        operation();
    }
    let mut timings = Vec::with_capacity(MEASURED_RUNS);
    let mut result = 0;
    for _ in 0..MEASURED_RUNS {
        let started = Instant::now();
        result = operation();
        timings.push(started.elapsed());
    }
    timings.sort_unstable();
    (percentile(&timings, 0.95), result)
}

fn measure_concurrent_navigation(
    mut home: impl FnMut() -> usize,
    mut sessions: impl FnMut() -> usize,
) -> (Duration, Duration) {
    let mut home_timings = Vec::with_capacity(CONCURRENT_QUERY_RUNS);
    let mut session_timings = Vec::with_capacity(CONCURRENT_QUERY_RUNS);
    for _ in 0..CONCURRENT_QUERY_RUNS {
        let home_started = Instant::now();
        assert_eq!(home(), 4);
        home_timings.push(home_started.elapsed());

        let sessions_started = Instant::now();
        assert_eq!(sessions(), 25);
        session_timings.push(sessions_started.elapsed());
    }
    home_timings.sort_unstable();
    session_timings.sort_unstable();
    (
        percentile(&home_timings, 0.95),
        percentile(&session_timings, 0.95),
    )
}

fn percentile(values: &[Duration], requested: f64) -> Duration {
    values[((values.len() - 1) as f64 * requested).ceil() as usize]
}

fn milliseconds(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1_000.0
}

fn timings_json(timings: &ImportPhaseTimings) -> Value {
    json!({
        "fingerprintMilliseconds": timings.fingerprint_milliseconds,
        "databaseSetupMilliseconds": timings.database_setup_milliseconds,
        "repeatLookupMilliseconds": timings.repeat_lookup_milliseconds,
        "archiveValidationMilliseconds": timings.archive_validation_milliseconds,
        "readDecodeMapMilliseconds": timings.read_decode_map_milliseconds,
        "reconciliationMilliseconds": timings.reconciliation_milliseconds,
        "transactionControlMilliseconds": timings.transaction_control_milliseconds,
        "totalMilliseconds": timings.total_milliseconds,
    })
}

#[cfg(target_os = "macos")]
fn peak_resident_mib() -> f64 {
    let mut usage = std::mem::MaybeUninit::<libc::rusage>::uninit();
    let result = unsafe { libc::getrusage(libc::RUSAGE_SELF, usage.as_mut_ptr()) };
    assert_eq!(result, 0, "getrusage must succeed");
    let usage = unsafe { usage.assume_init() };
    usage.ru_maxrss as f64 / 1024.0 / 1024.0
}

#[cfg(not(target_os = "macos"))]
fn peak_resident_mib() -> f64 {
    0.0
}
