use std::{
    env,
    path::Path,
    time::{Duration, Instant},
};

use fitfreed_application::ImportPhaseTimings;
use fitfreed_lib::infrastructure::{profile_polar_import_archive, query_activity_between};
use serde_json::{json, Value};

fn main() {
    let arguments = env::args().collect::<Vec<_>>();
    let archive = arguments.get(1).expect("archive path argument");
    let database = arguments.get(2).expect("database path argument");
    let database_path = Path::new(database);
    if database_path.exists() {
        std::fs::remove_file(database_path).expect("remove previous benchmark database");
    }

    let started = Instant::now();
    let first =
        profile_polar_import_archive(database_path, Path::new(archive)).expect("large import");
    let first_import = started.elapsed();

    let repeat_started = Instant::now();
    let repeat =
        profile_polar_import_archive(database_path, Path::new(archive)).expect("exact repeat");
    let exact_repeat = repeat_started.elapsed();

    let mut query_timings = Vec::new();
    let mut result_count = 0;
    for _ in 0..50 {
        let query_started = Instant::now();
        let result = query_activity_between(database_path, Some("2000-01-01"), Some("2000-12-31"))
            .expect("period query");
        query_timings.push(query_started.elapsed());
        result_count = result.len();
    }
    query_timings.sort_unstable();

    println!(
        "{}",
        json!({
            "runtime": "rust",
            "firstImportMilliseconds": milliseconds(first_import),
            "exactRepeatMilliseconds": milliseconds(exact_repeat),
            "queryMedianMilliseconds": milliseconds(percentile(&query_timings, 0.50)),
            "queryP95Milliseconds": milliseconds(percentile(&query_timings, 0.95)),
            "queryResultCount": result_count,
            "recognizedArtifacts": first.report.recognized_artifacts,
            "newObservations": first.report.new_observations,
            "repeatDetected": repeat.report.exact_repeat,
            "firstImportPhases": timings_json(&first.timings),
            "exactRepeatPhases": timings_json(&repeat.timings),
            "peakResidentMiB": peak_resident_mib(),
        })
    );
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

fn percentile(values: &[Duration], percentile: f64) -> Duration {
    let index = ((values.len() - 1) as f64 * percentile).ceil() as usize;
    values[index]
}

fn milliseconds(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1_000.0
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
