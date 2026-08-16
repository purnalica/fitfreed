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
    query_activity_comparison, query_activity_overview, query_training_comparison,
    query_training_overview, ActivityDateRange, TrainingDateRange,
};
use fitfreed_lib::infrastructure::{
    query_activity_between, SqliteActivityLibrary, SqliteTrainingLibrary,
};
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use tempfile::tempdir;

const ORIGIN_COUNT: usize = 4;
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
    training: usize,
}

fn main() {
    let directory = tempdir().expect("temporary benchmark directory");
    let database_path = directory.path().join("fitfreed.sqlite");
    query_activity_between(&database_path, None, None).expect("initialize production schema");
    let generated_rows = generate_history(&database_path);
    let activity_library = SqliteActivityLibrary::new(database_path.clone());
    let training_library = SqliteTrainingLibrary::new(database_path.clone());

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
                "storedTrainingSessions": generated_rows.training,
                "databaseBytes": fs::metadata(&database_path).expect("database metadata").len(),
            },
            "method": {
                "warmUpRunsPerInteraction": WARM_UP_RUNS,
                "measuredRunsPerInteraction": MEASURED_RUNS,
                "percentile": "sorted zero-based index ceil((n - 1) * 0.95)",
                "scope": "SQLite adapter plus application read model",
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
    let mut training_rows = 0;
    {
        let mut statement = transaction
            .prepare_cached(
                "INSERT INTO observation_origin (
                    id, source_provider, correlation_state, created_at_utc
                 ) VALUES (?1, 'synthetic-provider', 'verified', '2016-01-01T00:00:00Z')",
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
                        optional_index % 3,
                    ])
                    .expect("insert generated training session");
                training_rows += 1;
            }
        }
    }
    transaction.commit().expect("commit generated history");
    connection
        .execute_batch("PRAGMA optimize;")
        .expect("optimize generated history");
    GeneratedRows {
        activity: activity_rows,
        training: training_rows,
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
