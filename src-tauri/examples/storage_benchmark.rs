use std::{
    env,
    path::Path,
    time::{Duration, Instant},
};

use chrono::{Duration as ChronoDuration, NaiveDate};
use rusqlite::{params, Connection};
use serde_json::json;

const SESSION_COUNT: i64 = 1_000;
const SAMPLES_PER_SESSION: i64 = 5_000;
const QUERY_RUNS: usize = 15;

fn main() {
    let arguments = env::args().collect::<Vec<_>>();
    let operation = arguments.get(1).expect("prepare or query operation");
    let database = arguments.get(2).expect("database path argument");

    match operation.as_str() {
        "prepare" => prepare(Path::new(database)),
        "query" => query(Path::new(database)),
        _ => panic!("unsupported operation: {operation}"),
    }
}

fn prepare(database_path: &Path) {
    if database_path.exists() {
        std::fs::remove_file(database_path).expect("remove previous benchmark database");
    }
    let started = Instant::now();
    let mut connection = Connection::open(database_path).expect("open database");
    connection
        .execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA foreign_keys = ON;
             CREATE TABLE training_session (
                 id INTEGER PRIMARY KEY,
                 local_date TEXT NOT NULL,
                 sport_code TEXT NOT NULL,
                 started_at_ms INTEGER NOT NULL,
                 duration_seconds INTEGER NOT NULL,
                 average_heart_rate_bpm INTEGER NOT NULL,
                 maximum_heart_rate_bpm INTEGER NOT NULL
             );
             CREATE INDEX training_session_date_sport
                 ON training_session(local_date, sport_code);
             CREATE TABLE training_sample (
                 session_id INTEGER NOT NULL,
                 offset_seconds INTEGER NOT NULL,
                 heart_rate_bpm INTEGER NOT NULL,
                 speed_mm_per_s INTEGER NOT NULL,
                 PRIMARY KEY (session_id, offset_seconds),
                 FOREIGN KEY (session_id) REFERENCES training_session(id)
             ) WITHOUT ROWID;",
        )
        .expect("create schema");

    let transaction = connection.transaction().expect("begin data transaction");
    {
        let mut insert_session = transaction
            .prepare_cached(
                "INSERT INTO training_session (
                     id, local_date, sport_code, started_at_ms, duration_seconds,
                     average_heart_rate_bpm, maximum_heart_rate_bpm
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            )
            .expect("prepare session insertion");
        let mut insert_sample = transaction
            .prepare_cached(
                "INSERT INTO training_sample (
                     session_id, offset_seconds, heart_rate_bpm, speed_mm_per_s
                 ) VALUES (?1, ?2, ?3, ?4)",
            )
            .expect("prepare sample insertion");
        let first_date = NaiveDate::from_ymd_opt(2016, 1, 1).expect("first synthetic date");

        for session_id in 1..=SESSION_COUNT {
            let day_offset = (session_id - 1) * 3_652 / (SESSION_COUNT - 1);
            let local_date = first_date + ChronoDuration::days(day_offset);
            let sport_code = match session_id % 4 {
                0 => "cycling",
                1 => "running",
                2 => "strength",
                _ => "walking",
            };
            insert_session
                .execute(params![
                    session_id,
                    local_date.format("%Y-%m-%d").to_string(),
                    sport_code,
                    1_451_606_400_000_i64 + day_offset * 86_400_000,
                    SAMPLES_PER_SESSION,
                    136 + session_id % 12,
                    174 + session_id % 17,
                ])
                .expect("insert session");

            for offset_seconds in 0..SAMPLES_PER_SESSION {
                let heart_rate = 90 + (session_id * 17 + offset_seconds * 13) % 95;
                let speed = 2_000 + (session_id * 31 + offset_seconds * 29) % 4_500;
                insert_sample
                    .execute(params![session_id, offset_seconds, heart_rate, speed])
                    .expect("insert sample");
            }
        }
    }
    transaction.commit().expect("commit generated history");
    connection
        .execute_batch("PRAGMA wal_checkpoint(TRUNCATE); PRAGMA optimize;")
        .expect("checkpoint generated history");

    let page_count = connection
        .query_row("PRAGMA page_count", [], |row| row.get::<_, i64>(0))
        .expect("page count");
    let page_size = connection
        .query_row("PRAGMA page_size", [], |row| row.get::<_, i64>(0))
        .expect("page size");
    println!(
        "{}",
        json!({
            "runtime": "sqlite",
            "operation": "prepare",
            "sessions": SESSION_COUNT,
            "samples": SESSION_COUNT * SAMPLES_PER_SESSION,
            "milliseconds": milliseconds(started.elapsed()),
            "databaseMiB": page_count as f64 * page_size as f64 / 1024.0 / 1024.0,
            "peakResidentMiB": peak_resident_mib(),
        })
    );
}

fn query(database_path: &Path) {
    let connection = Connection::open(database_path).expect("open generated database");
    connection
        .execute_batch("PRAGMA query_only = ON; PRAGMA foreign_keys = ON;")
        .expect("configure query connection");

    let dashboard = measure(&connection, DASHBOARD_QUERY, &[]);
    let annual_zones = measure(
        &connection,
        ANNUAL_ZONES_QUERY,
        &["2022-01-01", "2022-12-31"],
    );
    let session_detail = measure(&connection, SESSION_DETAIL_QUERY, &["500"]);
    let decade_trend = measure(&connection, DECADE_TREND_QUERY, &[]);
    let period_comparison = measure(&connection, PERIOD_COMPARISON_QUERY, &[]);

    println!(
        "{}",
        json!({
            "runtime": "sqlite",
            "operation": "query",
            "runsPerQuery": QUERY_RUNS,
            "dashboard": dashboard,
            "annualHeartRateZones": annual_zones,
            "sessionTenSecondDownsample": session_detail,
            "decadeMonthlyTrend": decade_trend,
            "twoPeriodSportComparison": period_comparison,
            "peakResidentMiB": peak_resident_mib(),
        })
    );
}

fn measure(connection: &Connection, sql: &str, parameters: &[&str]) -> serde_json::Value {
    let mut timings = Vec::with_capacity(QUERY_RUNS);
    let mut rows = 0;
    for _ in 0..QUERY_RUNS {
        let started = Instant::now();
        let mut statement = connection
            .prepare_cached(sql)
            .expect("prepare analytical query");
        let mut result = statement
            .query(rusqlite::params_from_iter(parameters.iter()))
            .expect("run analytical query");
        rows = 0;
        while result.next().expect("read analytical result").is_some() {
            rows += 1;
        }
        timings.push(started.elapsed());
    }
    timings.sort_unstable();
    json!({
        "rows": rows,
        "medianMilliseconds": milliseconds(percentile(&timings, 0.50)),
        "p95Milliseconds": milliseconds(percentile(&timings, 0.95)),
    })
}

fn percentile(values: &[Duration], requested: f64) -> Duration {
    values[((values.len() - 1) as f64 * requested).ceil() as usize]
}

fn milliseconds(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1_000.0
}

const DASHBOARD_QUERY: &str = "SELECT substr(local_date, 1, 7) AS month,
            sport_code,
            COUNT(*) AS sessions,
            SUM(duration_seconds) AS active_seconds,
            AVG(average_heart_rate_bpm) AS average_heart_rate
     FROM training_session
     GROUP BY month, sport_code
     ORDER BY month, sport_code";

const ANNUAL_ZONES_QUERY: &str = "SELECT s.sport_code,
            SUM(CASE WHEN p.heart_rate_bpm < 120 THEN 1 ELSE 0 END) AS zone_1,
            SUM(CASE WHEN p.heart_rate_bpm BETWEEN 120 AND 139 THEN 1 ELSE 0 END) AS zone_2,
            SUM(CASE WHEN p.heart_rate_bpm BETWEEN 140 AND 159 THEN 1 ELSE 0 END) AS zone_3,
            SUM(CASE WHEN p.heart_rate_bpm BETWEEN 160 AND 174 THEN 1 ELSE 0 END) AS zone_4,
            SUM(CASE WHEN p.heart_rate_bpm >= 175 THEN 1 ELSE 0 END) AS zone_5
     FROM training_session s
     JOIN training_sample p ON p.session_id = s.id
     WHERE s.local_date BETWEEN ?1 AND ?2
     GROUP BY s.sport_code
     ORDER BY s.sport_code";

const SESSION_DETAIL_QUERY: &str = "SELECT offset_seconds / 10 AS bucket,
            MIN(heart_rate_bpm),
            MAX(heart_rate_bpm),
            AVG(heart_rate_bpm),
            AVG(speed_mm_per_s)
     FROM training_sample
     WHERE session_id = CAST(?1 AS INTEGER)
     GROUP BY bucket
     ORDER BY bucket";

const DECADE_TREND_QUERY: &str = "SELECT substr(s.local_date, 1, 7) AS month,
            AVG(p.heart_rate_bpm),
            MAX(p.heart_rate_bpm),
            AVG(p.speed_mm_per_s),
            COUNT(*)
     FROM training_session s
     JOIN training_sample p ON p.session_id = s.id
     GROUP BY month
     ORDER BY month";

const PERIOD_COMPARISON_QUERY: &str = "SELECT CASE
                WHEN s.local_date BETWEEN '2018-01-01' AND '2019-12-31' THEN 'earlier'
                WHEN s.local_date BETWEEN '2024-01-01' AND '2025-12-31' THEN 'later'
            END AS period,
            s.sport_code,
            COUNT(DISTINCT s.id) AS sessions,
            AVG(p.heart_rate_bpm) AS average_heart_rate,
            AVG(p.speed_mm_per_s) AS average_speed
     FROM training_session s
     JOIN training_sample p ON p.session_id = s.id
     WHERE s.local_date BETWEEN '2018-01-01' AND '2019-12-31'
        OR s.local_date BETWEEN '2024-01-01' AND '2025-12-31'
     GROUP BY period, s.sport_code
     ORDER BY period, s.sport_code";

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
