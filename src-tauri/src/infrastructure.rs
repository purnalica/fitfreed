use std::{
    collections::HashSet,
    fs::File,
    io::{self, Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};

use chrono::NaiveDate;
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use thiserror::Error;
use zip::ZipArchive;

use fitfreed_application::{
    ActivityLibraryPort, ArchiveImportPort, ImportPhase, ImportPhaseTimings, ImportProgress,
    ProfiledImport,
};
use fitfreed_domain::{
    decide_reconciliation, DailyActivity, ExistingObservation, ImportReport, ReconciliationDecision,
};

const MAX_ARCHIVE_ENTRIES: usize = 10_000;
const MAX_ENTRY_BYTES: u64 = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES: u64 = 8 * 1024 * 1024 * 1024;
const MAX_COMPRESSION_RATIO: u64 = 1_000;
const SCHEMA_VERSION: i64 = 1;
const SCHEMA_V1: &str = "
    CREATE TABLE IF NOT EXISTS daily_activity (
        origin_id TEXT NOT NULL,
        local_date TEXT NOT NULL,
        step_count INTEGER,
        provenance_sha256 TEXT NOT NULL,
        PRIMARY KEY (origin_id, local_date)
    );
    CREATE TABLE IF NOT EXISTS activity_conflict (
        id INTEGER PRIMARY KEY,
        origin_id TEXT NOT NULL,
        local_date TEXT NOT NULL,
        existing_step_count INTEGER,
        incoming_step_count INTEGER,
        package_sha256 TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS import_operation (
        id INTEGER PRIMARY KEY,
        package_sha256 TEXT NOT NULL,
        completed INTEGER NOT NULL,
        exact_repeat INTEGER NOT NULL,
        recognized_artifacts INTEGER NOT NULL,
        new_observations INTEGER NOT NULL,
        equivalent_observations INTEGER NOT NULL,
        enriched_observations INTEGER NOT NULL,
        preserved_observations INTEGER NOT NULL,
        conflicts INTEGER NOT NULL
    );";

#[derive(Debug, Error)]
pub enum ImportError {
    #[error("archive input/output failure: {0}")]
    Io(#[from] io::Error),
    #[error("invalid ZIP archive: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("invalid ZIP container: {0}")]
    InvalidContainer(String),
    #[error("database failure: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("invalid activity artifact {artifact}: {reason}")]
    InvalidArtifact { artifact: String, reason: String },
    #[error("unsafe archive member: {0}")]
    UnsafeMember(String),
    #[error("duplicate archive member: {0}")]
    DuplicateMember(String),
    #[error("archive resource limit exceeded: {0}")]
    ResourceLimit(String),
    #[error("injected interruption after {0} mapped artifact(s)")]
    InjectedInterruption(usize),
    #[error("injected interruption before schema migration commit")]
    InjectedMigrationInterruption,
    #[error("import cancelled")]
    Cancelled,
    #[error("library schema version {0} is newer than this application supports")]
    UnsupportedSchemaVersion(i64),
}

pub type Result<T> = std::result::Result<T, ImportError>;

#[derive(Debug, Deserialize)]
struct PolarActivity {
    date: String,
    summary: Option<PolarSummary>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PolarSummary {
    step_count: Option<i64>,
}

pub fn import_archive(
    database_path: &Path,
    archive_path: &Path,
    origin_id: &str,
) -> Result<ImportReport> {
    Ok(profile_import_archive(database_path, archive_path, origin_id)?.report)
}

pub fn import_archive_with_progress<F>(
    database_path: &Path,
    archive_path: &Path,
    origin_id: &str,
    cancellation: &AtomicBool,
    mut on_progress: F,
) -> Result<ImportReport>
where
    F: FnMut(ImportProgress),
{
    let result = profile_import_archive_with_controls(
        database_path,
        archive_path,
        origin_id,
        None,
        cancellation,
        &mut on_progress,
    );

    match result {
        Ok(profiled) => {
            on_progress(ImportProgress::artifacts(
                ImportPhase::Completed,
                profiled.report.recognized_artifacts,
                profiled.report.recognized_artifacts,
            ));
            Ok(profiled.report)
        }
        Err(ImportError::Cancelled) => {
            on_progress(ImportProgress::phase(ImportPhase::Cancelled));
            Err(ImportError::Cancelled)
        }
        Err(error) => Err(error),
    }
}

pub fn profile_import_archive(
    database_path: &Path,
    archive_path: &Path,
    origin_id: &str,
) -> Result<ProfiledImport> {
    let cancellation = AtomicBool::new(false);
    let mut ignore_progress = |_| {};
    profile_import_archive_with_controls(
        database_path,
        archive_path,
        origin_id,
        None,
        &cancellation,
        &mut ignore_progress,
    )
}

#[cfg(test)]
fn import_archive_with_interruption(
    database_path: &Path,
    archive_path: &Path,
    origin_id: &str,
    interrupt_after: Option<usize>,
) -> Result<ImportReport> {
    let cancellation = AtomicBool::new(false);
    let mut ignore_progress = |_| {};
    Ok(profile_import_archive_with_controls(
        database_path,
        archive_path,
        origin_id,
        interrupt_after,
        &cancellation,
        &mut ignore_progress,
    )?
    .report)
}

fn profile_import_archive_with_controls(
    database_path: &Path,
    archive_path: &Path,
    origin_id: &str,
    interrupt_after: Option<usize>,
    cancellation: &AtomicBool,
    on_progress: &mut dyn FnMut(ImportProgress),
) -> Result<ProfiledImport> {
    let total_started = Instant::now();
    let mut timings = ImportPhaseTimings::default();

    let fingerprint_started = Instant::now();
    let package_sha256 = sha256_file(archive_path, cancellation, on_progress)?;
    timings.fingerprint_milliseconds = milliseconds(fingerprint_started.elapsed());

    ensure_not_cancelled(cancellation)?;
    let database_started = Instant::now();
    let mut connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    timings.database_setup_milliseconds = milliseconds(database_started.elapsed());

    let lookup_started = Instant::now();
    let completed_package = completed_package_exists(&connection, &package_sha256)?;
    timings.repeat_lookup_milliseconds = milliseconds(lookup_started.elapsed());
    if completed_package {
        ensure_not_cancelled(cancellation)?;
        on_progress(ImportProgress::phase(ImportPhase::Committing));
        let transaction_started = Instant::now();
        let transaction = connection.transaction()?;
        record_operation(&transaction, &package_sha256, &ImportReport::exact_repeat())?;
        transaction.commit()?;
        timings.transaction_control_milliseconds = milliseconds(transaction_started.elapsed());
        timings.total_milliseconds = milliseconds(total_started.elapsed());
        return Ok(ProfiledImport {
            report: ImportReport::exact_repeat(),
            timings,
        });
    }

    let validation_started = Instant::now();
    let file = File::open(archive_path)?;
    validate_central_directory_names(archive_path)?;
    let mut archive = ZipArchive::new(file)?;
    let archive_entries = archive.len();
    on_progress(ImportProgress::artifacts(
        ImportPhase::Validating,
        0,
        archive_entries,
    ));
    let recognized_artifacts = validate_archive(&mut archive, cancellation, on_progress)?;
    timings.archive_validation_milliseconds = milliseconds(validation_started.elapsed());

    ensure_not_cancelled(cancellation)?;
    on_progress(ImportProgress::artifacts(
        ImportPhase::Importing,
        0,
        recognized_artifacts,
    ));
    let transaction_started = Instant::now();
    let transaction = connection.transaction()?;
    timings.transaction_control_milliseconds += milliseconds(transaction_started.elapsed());
    let mut report = ImportReport::assessed();
    let mut mapped = 0;

    for index in 0..archive.len() {
        ensure_not_cancelled(cancellation)?;
        let mut member = archive.by_index(index)?;
        let name = member.name().to_owned();
        if !is_activity_artifact(&name) {
            continue;
        }

        let decode_started = Instant::now();
        let json = read_string(&mut member, &name, cancellation)?;
        let source: PolarActivity =
            serde_json::from_str(&json).map_err(|error| ImportError::InvalidArtifact {
                artifact: name.clone(),
                reason: error.to_string(),
            })?;
        let observation = map_activity(origin_id, source, &name)?;
        timings.read_decode_map_milliseconds += milliseconds(decode_started.elapsed());

        let reconciliation_started = Instant::now();
        reconcile(&transaction, &package_sha256, &observation, &mut report)?;
        timings.reconciliation_milliseconds += milliseconds(reconciliation_started.elapsed());
        mapped += 1;
        report.recognized_artifacts += 1;
        on_progress(ImportProgress::artifacts(
            ImportPhase::Importing,
            mapped,
            recognized_artifacts,
        ));

        if interrupt_after == Some(mapped) {
            return Err(ImportError::InjectedInterruption(mapped));
        }
    }

    ensure_not_cancelled(cancellation)?;
    on_progress(ImportProgress::artifacts(
        ImportPhase::Committing,
        mapped,
        recognized_artifacts,
    ));
    let finalization_started = Instant::now();
    record_operation(&transaction, &package_sha256, &report)?;
    transaction.commit()?;
    timings.transaction_control_milliseconds += milliseconds(finalization_started.elapsed());
    timings.total_milliseconds = milliseconds(total_started.elapsed());
    Ok(ProfiledImport { report, timings })
}

fn milliseconds(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1_000.0
}

pub fn query_activity(database_path: &Path) -> Result<Vec<DailyActivity>> {
    query_activity_between(database_path, None, None)
}

pub fn query_activity_between(
    database_path: &Path,
    from: Option<&str>,
    through: Option<&str>,
) -> Result<Vec<DailyActivity>> {
    let connection = Connection::open(database_path)?;
    ensure_schema(&connection)?;
    let mut statement = connection.prepare(
        "SELECT origin_id, local_date, step_count
         FROM daily_activity
         WHERE (?1 IS NULL OR local_date >= ?1)
           AND (?2 IS NULL OR local_date <= ?2)
         ORDER BY local_date, origin_id",
    )?;
    let rows = statement.query_map(params![from, through], |row| {
        Ok(DailyActivity {
            origin_id: row.get(0)?,
            local_date: row.get(1)?,
            step_count: row.get(2)?,
        })
    })?;

    rows.collect::<std::result::Result<Vec<_>, _>>()
        .map_err(ImportError::from)
}

pub fn backup_database(source_path: &Path, backup_path: &Path) -> Result<()> {
    let source = Connection::open(source_path)?;
    ensure_schema(&source)?;
    let mut destination = Connection::open(backup_path)?;
    let backup = rusqlite::backup::Backup::new(&source, &mut destination)?;
    backup.run_to_completion(64, Duration::from_millis(5), None)?;
    Ok(())
}

fn ensure_schema(connection: &Connection) -> Result<()> {
    migrate_schema(connection, false)
}

fn migrate_schema(connection: &Connection, interrupt_before_commit: bool) -> Result<()> {
    connection.execute_batch("PRAGMA foreign_keys = ON;")?;
    let version = connection.query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))?;
    match version {
        SCHEMA_VERSION => Ok(()),
        0 => {
            connection.execute_batch("BEGIN IMMEDIATE;")?;
            let migration = (|| {
                connection.execute_batch(SCHEMA_V1)?;
                if interrupt_before_commit {
                    return Err(ImportError::InjectedMigrationInterruption);
                }
                connection.pragma_update(None, "user_version", SCHEMA_VERSION)?;
                connection.execute_batch("COMMIT;")?;
                Ok(())
            })();
            if migration.is_err() {
                let _ = connection.execute_batch("ROLLBACK;");
            }
            migration
        }
        unsupported => Err(ImportError::UnsupportedSchemaVersion(unsupported)),
    }
}

fn completed_package_exists(connection: &Connection, package_sha256: &str) -> Result<bool> {
    connection
        .query_row(
            "SELECT EXISTS(
                 SELECT 1 FROM import_operation
                 WHERE package_sha256 = ?1 AND completed = 1
             )",
            [package_sha256],
            |row| row.get(0),
        )
        .map_err(ImportError::from)
}

fn validate_archive(
    archive: &mut ZipArchive<File>,
    cancellation: &AtomicBool,
    on_progress: &mut dyn FnMut(ImportProgress),
) -> Result<usize> {
    if archive.len() > MAX_ARCHIVE_ENTRIES {
        return Err(ImportError::ResourceLimit(format!(
            "{} entries exceeds {MAX_ARCHIVE_ENTRIES}",
            archive.len()
        )));
    }

    let mut names = HashSet::new();
    let mut total_size = 0_u64;
    let total_entries = archive.len();
    let mut recognized_artifacts = 0;
    for index in 0..archive.len() {
        ensure_not_cancelled(cancellation)?;
        let member = archive.by_index(index)?;
        let name = member.name().to_owned();
        let path = Path::new(&name);
        if member.is_dir()
            || member.is_symlink()
            || member.encrypted()
            || path.is_absolute()
            || path.components().count() != 1
            || member.enclosed_name().is_none()
        {
            return Err(ImportError::UnsafeMember(name));
        }
        if !names.insert(name.clone()) {
            return Err(ImportError::DuplicateMember(name));
        }
        if member.size() > MAX_ENTRY_BYTES {
            return Err(ImportError::ResourceLimit(format!(
                "member {name} exceeds {MAX_ENTRY_BYTES} expanded bytes"
            )));
        }
        if member.size() > 0
            && (member.compressed_size() == 0
                || member.size() / member.compressed_size() > MAX_COMPRESSION_RATIO)
        {
            return Err(ImportError::ResourceLimit(format!(
                "member {name} exceeds compression-ratio limit"
            )));
        }
        total_size = total_size.saturating_add(member.size());
        if total_size > MAX_TOTAL_BYTES {
            return Err(ImportError::ResourceLimit(format!(
                "expanded archive exceeds {MAX_TOTAL_BYTES} bytes"
            )));
        }
        if is_activity_artifact(&name) {
            recognized_artifacts += 1;
        }
        let completed = index + 1;
        if completed % 100 == 0 || completed == total_entries {
            on_progress(ImportProgress::artifacts(
                ImportPhase::Validating,
                completed,
                total_entries,
            ));
        }
    }
    Ok(recognized_artifacts)
}

fn validate_central_directory_names(path: &Path) -> Result<()> {
    const EOCD_SIGNATURE: &[u8; 4] = b"PK\x05\x06";
    const ZIP64_EOCD_SIGNATURE: &[u8; 4] = b"PK\x06\x06";
    const ZIP64_LOCATOR_SIGNATURE: &[u8; 4] = b"PK\x06\x07";
    const CENTRAL_ENTRY_SIGNATURE: &[u8; 4] = b"PK\x01\x02";
    const MAX_EOCD_SEARCH: u64 = 65_557;

    let mut file = File::open(path)?;
    let file_length = file.metadata()?.len();
    let tail_length = file_length.min(MAX_EOCD_SEARCH);
    file.seek(SeekFrom::End(-(tail_length as i64)))?;
    let mut tail = vec![0_u8; tail_length as usize];
    file.read_exact(&mut tail)?;
    let eocd_index = tail
        .windows(EOCD_SIGNATURE.len())
        .rposition(|candidate| candidate == EOCD_SIGNATURE)
        .ok_or_else(|| {
            ImportError::InvalidContainer("end-of-central-directory record is missing".to_owned())
        })?;
    if tail.len() - eocd_index < 22 {
        return Err(ImportError::InvalidContainer(
            "end-of-central-directory record is truncated".to_owned(),
        ));
    }
    let eocd = &tail[eocd_index..];
    let disk_number = little_u16(eocd, 4)?;
    let central_disk = little_u16(eocd, 6)?;
    if disk_number != 0 || central_disk != 0 {
        return Err(ImportError::InvalidContainer(
            "multi-disk ZIP archives are not supported".to_owned(),
        ));
    }

    let standard_entries = little_u16(eocd, 10)? as u64;
    let standard_size = little_u32(eocd, 12)? as u64;
    let standard_offset = little_u32(eocd, 16)? as u64;
    let eocd_absolute = file_length - tail_length + eocd_index as u64;
    let (entry_count, central_size, central_offset) = if standard_entries == u16::MAX as u64
        || standard_size == u32::MAX as u64
        || standard_offset == u32::MAX as u64
    {
        if eocd_absolute < 20 {
            return Err(ImportError::InvalidContainer(
                "ZIP64 locator is missing".to_owned(),
            ));
        }
        file.seek(SeekFrom::Start(eocd_absolute - 20))?;
        let mut locator = [0_u8; 20];
        file.read_exact(&mut locator)?;
        if &locator[0..4] != ZIP64_LOCATOR_SIGNATURE {
            return Err(ImportError::InvalidContainer(
                "ZIP64 locator signature is invalid".to_owned(),
            ));
        }
        if little_u32(&locator, 4)? != 0 || little_u32(&locator, 16)? != 1 {
            return Err(ImportError::InvalidContainer(
                "multi-disk ZIP64 archives are not supported".to_owned(),
            ));
        }
        let zip64_offset = little_u64(&locator, 8)?;
        file.seek(SeekFrom::Start(zip64_offset))?;
        let mut zip64 = [0_u8; 56];
        file.read_exact(&mut zip64)?;
        if &zip64[0..4] != ZIP64_EOCD_SIGNATURE {
            return Err(ImportError::InvalidContainer(
                "ZIP64 end-of-central-directory signature is invalid".to_owned(),
            ));
        }
        if little_u32(&zip64, 16)? != 0 || little_u32(&zip64, 20)? != 0 {
            return Err(ImportError::InvalidContainer(
                "multi-disk ZIP64 archives are not supported".to_owned(),
            ));
        }
        (
            little_u64(&zip64, 32)?,
            little_u64(&zip64, 40)?,
            little_u64(&zip64, 48)?,
        )
    } else {
        (standard_entries, standard_size, standard_offset)
    };

    if entry_count > MAX_ARCHIVE_ENTRIES as u64 {
        return Err(ImportError::ResourceLimit(format!(
            "{entry_count} entries exceeds {MAX_ARCHIVE_ENTRIES}"
        )));
    }
    let central_end = central_offset.checked_add(central_size).ok_or_else(|| {
        ImportError::InvalidContainer("central-directory size overflows".to_owned())
    })?;
    if central_end > file_length {
        return Err(ImportError::InvalidContainer(
            "central directory extends beyond the archive".to_owned(),
        ));
    }

    file.seek(SeekFrom::Start(central_offset))?;
    let mut names = HashSet::new();
    for _ in 0..entry_count {
        let mut header = [0_u8; 46];
        file.read_exact(&mut header)?;
        if &header[0..4] != CENTRAL_ENTRY_SIGNATURE {
            return Err(ImportError::InvalidContainer(
                "central-directory entry signature is invalid".to_owned(),
            ));
        }
        let name_length = little_u16(&header, 28)? as usize;
        let extra_length = little_u16(&header, 30)? as u64;
        let comment_length = little_u16(&header, 32)? as u64;
        let mut name = vec![0_u8; name_length];
        file.read_exact(&mut name)?;
        if !names.insert(name.clone()) {
            return Err(ImportError::DuplicateMember(
                String::from_utf8_lossy(&name).into_owned(),
            ));
        }
        file.seek(SeekFrom::Current((extra_length + comment_length) as i64))?;
    }
    Ok(())
}

fn little_u16(bytes: &[u8], offset: usize) -> Result<u16> {
    let value = bytes
        .get(offset..offset + 2)
        .ok_or_else(|| ImportError::InvalidContainer("truncated integer field".to_owned()))?;
    Ok(u16::from_le_bytes([value[0], value[1]]))
}

fn little_u32(bytes: &[u8], offset: usize) -> Result<u32> {
    let value = bytes
        .get(offset..offset + 4)
        .ok_or_else(|| ImportError::InvalidContainer("truncated integer field".to_owned()))?;
    Ok(u32::from_le_bytes([value[0], value[1], value[2], value[3]]))
}

fn little_u64(bytes: &[u8], offset: usize) -> Result<u64> {
    let value = bytes
        .get(offset..offset + 8)
        .ok_or_else(|| ImportError::InvalidContainer("truncated integer field".to_owned()))?;
    Ok(u64::from_le_bytes([
        value[0], value[1], value[2], value[3], value[4], value[5], value[6], value[7],
    ]))
}

fn map_activity(origin_id: &str, source: PolarActivity, artifact: &str) -> Result<DailyActivity> {
    NaiveDate::parse_from_str(&source.date, "%Y-%m-%d").map_err(|error| {
        ImportError::InvalidArtifact {
            artifact: artifact.to_owned(),
            reason: format!("invalid local date: {error}"),
        }
    })?;
    let step_count = source.summary.and_then(|summary| summary.step_count);
    if step_count.is_some_and(|value| value < 0) {
        return Err(ImportError::InvalidArtifact {
            artifact: artifact.to_owned(),
            reason: "stepCount cannot be negative".to_owned(),
        });
    }
    Ok(DailyActivity {
        origin_id: origin_id.to_owned(),
        local_date: source.date,
        step_count,
    })
}

fn reconcile(
    transaction: &Transaction<'_>,
    package_sha256: &str,
    observation: &DailyActivity,
    report: &mut ImportReport,
) -> Result<()> {
    let existing = transaction
        .query_row(
            "SELECT step_count FROM daily_activity
             WHERE origin_id = ?1 AND local_date = ?2",
            params![observation.origin_id, observation.local_date],
            |row| row.get::<_, Option<i64>>(0),
        )
        .optional()?;

    let existing_observation =
        existing.map_or(ExistingObservation::Absent, ExistingObservation::Present);
    let decision = decide_reconciliation(existing_observation, observation.step_count);

    match decision {
        ReconciliationDecision::Create => {
            transaction.execute(
                "INSERT INTO daily_activity (
                     origin_id, local_date, step_count, provenance_sha256
                 ) VALUES (?1, ?2, ?3, ?4)",
                params![
                    observation.origin_id,
                    observation.local_date,
                    observation.step_count,
                    package_sha256
                ],
            )?;
        }
        ReconciliationDecision::Equivalent | ReconciliationDecision::Preserve => {}
        ReconciliationDecision::Enrich => {
            transaction.execute(
                "UPDATE daily_activity
                 SET step_count = ?3, provenance_sha256 = ?4
                 WHERE origin_id = ?1 AND local_date = ?2",
                params![
                    observation.origin_id,
                    observation.local_date,
                    observation.step_count,
                    package_sha256
                ],
            )?;
        }
        ReconciliationDecision::Conflict => {
            transaction.execute(
                "INSERT INTO activity_conflict (
                     origin_id, local_date, existing_step_count,
                     incoming_step_count, package_sha256
                 ) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    observation.origin_id,
                    observation.local_date,
                    existing.flatten(),
                    observation.step_count,
                    package_sha256
                ],
            )?;
        }
    }
    report.record(decision);
    Ok(())
}

fn record_operation(
    transaction: &Transaction<'_>,
    package_sha256: &str,
    report: &ImportReport,
) -> Result<()> {
    transaction.execute(
        "INSERT INTO import_operation (
             package_sha256, completed, exact_repeat, recognized_artifacts,
             new_observations, equivalent_observations, enriched_observations,
             preserved_observations, conflicts
         ) VALUES (?1, 1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            package_sha256,
            report.exact_repeat,
            report.recognized_artifacts,
            report.new_observations,
            report.equivalent_observations,
            report.enriched_observations,
            report.preserved_observations,
            report.conflicts
        ],
    )?;
    Ok(())
}

fn sha256_file(
    path: &Path,
    cancellation: &AtomicBool,
    on_progress: &mut dyn FnMut(ImportProgress),
) -> Result<String> {
    let mut input = File::open(path)?;
    let total_bytes = input.metadata()?.len();
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    let mut completed_bytes = 0_u64;
    let mut last_reported_megabyte = 0_u64;
    on_progress(ImportProgress::fingerprinting(0, total_bytes));
    loop {
        ensure_not_cancelled(cancellation)?;
        let read = input.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
        completed_bytes += read as u64;
        let completed_megabyte = completed_bytes / (1024 * 1024);
        if completed_megabyte > last_reported_megabyte || completed_bytes == total_bytes {
            on_progress(ImportProgress::fingerprinting(completed_bytes, total_bytes));
            last_reported_megabyte = completed_megabyte;
        }
    }
    Ok(format!("{:x}", digest.finalize()))
}

fn read_string<R: Read>(
    input: &mut R,
    artifact: &str,
    cancellation: &AtomicBool,
) -> Result<String> {
    let mut bytes = Vec::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        ensure_not_cancelled(cancellation)?;
        let read = input
            .read(&mut buffer)
            .map_err(|error| ImportError::InvalidArtifact {
                artifact: artifact.to_owned(),
                reason: error.to_string(),
            })?;
        if read == 0 {
            break;
        }
        bytes.extend_from_slice(&buffer[..read]);
    }
    String::from_utf8(bytes).map_err(|error| ImportError::InvalidArtifact {
        artifact: artifact.to_owned(),
        reason: error.to_string(),
    })
}

fn ensure_not_cancelled(cancellation: &AtomicBool) -> Result<()> {
    if cancellation.load(Ordering::Relaxed) {
        Err(ImportError::Cancelled)
    } else {
        Ok(())
    }
}

fn is_activity_artifact(name: &str) -> bool {
    name.starts_with("activity-") && name.ends_with(".json")
}

pub struct SqlitePolarFlowArchiveImporter {
    database_path: PathBuf,
    origin_id: String,
}

impl SqlitePolarFlowArchiveImporter {
    pub fn new(database_path: PathBuf, origin_id: String) -> Self {
        Self {
            database_path,
            origin_id,
        }
    }
}

impl ArchiveImportPort for SqlitePolarFlowArchiveImporter {
    fn import_archive(
        &self,
        archive_path: &Path,
        cancellation: &AtomicBool,
        on_progress: &mut dyn FnMut(ImportProgress),
    ) -> std::result::Result<ImportReport, String> {
        import_archive_with_progress(
            &self.database_path,
            archive_path,
            &self.origin_id,
            cancellation,
            on_progress,
        )
        .map_err(|error| error.to_string())
    }
}

pub struct SqliteActivityLibrary {
    database_path: PathBuf,
}

impl SqliteActivityLibrary {
    pub fn new(database_path: PathBuf) -> Self {
        Self { database_path }
    }
}

impl ActivityLibraryPort for SqliteActivityLibrary {
    fn query_activity(&self) -> std::result::Result<Vec<DailyActivity>, String> {
        query_activity(&self.database_path).map_err(|error| error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use tempfile::TempDir;
    use zip::{write::SimpleFileOptions, ZipWriter};

    use super::*;

    struct Harness {
        directory: TempDir,
    }

    impl Harness {
        fn new() -> Self {
            Self {
                directory: tempfile::tempdir().expect("temporary directory"),
            }
        }

        fn database(&self) -> std::path::PathBuf {
            self.directory.path().join("fitfreed.sqlite")
        }

        fn archive(&self, name: &str, entries: &[(&str, &str)]) -> std::path::PathBuf {
            let path = self.directory.path().join(name);
            let file = File::create(&path).expect("archive file");
            let mut writer = ZipWriter::new(file);
            for (entry_name, json) in entries {
                writer
                    .start_file(*entry_name, SimpleFileOptions::default())
                    .expect("ZIP entry");
                writer.write_all(json.as_bytes()).expect("entry data");
            }
            writer.finish().expect("complete ZIP");
            path
        }
    }

    #[test]
    fn imports_queries_and_repeats_without_duplicates() {
        let harness = Harness::new();
        let archive = harness.archive(
            "initial.zip",
            &[
                (
                    "activity-2026-01-02-source.json",
                    r#"{"date":"2026-01-02","summary":{"stepCount":4200}}"#,
                ),
                (
                    "activity-2026-01-01-source.json",
                    r#"{"date":"2026-01-01","summary":{"stepCount":3100}}"#,
                ),
            ],
        );

        let first = import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect("initial import");
        assert_eq!(first.new_observations, 2);
        assert_eq!(first.recognized_artifacts, 2);

        let repeated = import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect("repeat import");
        assert!(repeated.exact_repeat);
        assert_eq!(
            query_activity(&harness.database()).expect("history"),
            vec![
                DailyActivity {
                    origin_id: "polar:synthetic".to_owned(),
                    local_date: "2026-01-01".to_owned(),
                    step_count: Some(3100),
                },
                DailyActivity {
                    origin_id: "polar:synthetic".to_owned(),
                    local_date: "2026-01-02".to_owned(),
                    step_count: Some(4200),
                },
            ]
        );
    }

    #[test]
    fn profiles_first_import_and_exact_repeat_phases() {
        let harness = Harness::new();
        let archive = harness.archive(
            "profiled.zip",
            &[(
                "activity-2026-01-03-source.json",
                r#"{"date":"2026-01-03","summary":{"stepCount":5100}}"#,
            )],
        );

        let first = profile_import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect("profiled import");
        assert_eq!(first.report.new_observations, 1);
        assert!(first.timings.total_milliseconds > 0.0);
        assert!(first.timings.total_milliseconds >= first.timings.archive_validation_milliseconds);
        assert!(first.timings.read_decode_map_milliseconds > 0.0);

        let repeated = profile_import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect("profiled exact repeat");
        assert!(repeated.report.exact_repeat);
        assert_eq!(repeated.timings.archive_validation_milliseconds, 0.0);
        assert_eq!(repeated.timings.read_decode_map_milliseconds, 0.0);
        assert!(repeated.timings.fingerprint_milliseconds > 0.0);
    }

    #[test]
    fn reports_ordered_phase_progress_and_atomic_completion() {
        let harness = Harness::new();
        let archive = harness.archive(
            "progress.zip",
            &[
                (
                    "activity-2026-01-04-source.json",
                    r#"{"date":"2026-01-04","summary":{"stepCount":6100}}"#,
                ),
                (
                    "activity-2026-01-05-source.json",
                    r#"{"date":"2026-01-05","summary":{"stepCount":7200}}"#,
                ),
            ],
        );
        let cancellation = AtomicBool::new(false);
        let mut progress = Vec::new();

        let report = import_archive_with_progress(
            &harness.database(),
            &archive,
            "polar:synthetic",
            &cancellation,
            |event| progress.push(event),
        )
        .expect("observed import");

        assert_eq!(report.recognized_artifacts, 2);
        assert_eq!(
            progress.first().expect("first progress").phase,
            ImportPhase::Fingerprinting
        );
        assert!(progress
            .iter()
            .any(|event| event.phase == ImportPhase::Validating));
        assert!(progress.iter().any(|event| {
            event.phase == ImportPhase::Importing
                && event.completed_artifacts == 2
                && event.total_artifacts == Some(2)
        }));
        let committing = progress
            .iter()
            .find(|event| event.phase == ImportPhase::Committing)
            .expect("committing progress");
        assert!(!committing.cancellable);
        let completed = progress.last().expect("terminal progress");
        assert_eq!(completed.phase, ImportPhase::Completed);
        assert!(!completed.cancellable);
        assert_eq!(
            query_activity(&harness.database()).expect("history").len(),
            2
        );
    }

    #[test]
    fn cancellation_rolls_back_visible_changes_and_reports_terminal_progress() {
        let harness = Harness::new();
        let archive = harness.archive(
            "cancel.zip",
            &[
                (
                    "activity-2026-01-06-source.json",
                    r#"{"date":"2026-01-06","summary":{"stepCount":8300}}"#,
                ),
                (
                    "activity-2026-01-07-source.json",
                    r#"{"date":"2026-01-07","summary":{"stepCount":9400}}"#,
                ),
            ],
        );
        let cancellation = AtomicBool::new(false);
        let mut progress = Vec::new();

        let error = import_archive_with_progress(
            &harness.database(),
            &archive,
            "polar:synthetic",
            &cancellation,
            |event| {
                if event.phase == ImportPhase::Importing && event.completed_artifacts == 1 {
                    cancellation.store(true, Ordering::Relaxed);
                }
                progress.push(event);
            },
        )
        .expect_err("cancelled import");

        assert!(matches!(error, ImportError::Cancelled));
        assert_eq!(
            progress.last().expect("terminal progress").phase,
            ImportPhase::Cancelled
        );
        assert!(query_activity(&harness.database())
            .expect("history")
            .is_empty());
    }

    #[test]
    fn reconciles_equivalent_enrichment_preservation_and_conflict() {
        let harness = Harness::new();
        let baseline = harness.archive(
            "baseline.zip",
            &[
                ("activity-2026-02-01-a.json", r#"{"date":"2026-02-01"}"#),
                (
                    "activity-2026-02-02-a.json",
                    r#"{"date":"2026-02-02","summary":{"stepCount":1000}}"#,
                ),
            ],
        );
        import_archive(&harness.database(), &baseline, "polar:synthetic").expect("baseline import");

        let overlap = harness.archive(
            "overlap.zip",
            &[
                (
                    "activity-2026-02-01-b.json",
                    r#"{"date":"2026-02-01","summary":{"stepCount":900}}"#,
                ),
                (
                    "activity-2026-02-02-b.json",
                    r#"{"date":"2026-02-02","summary":{"stepCount":1000}}"#,
                ),
                (
                    "activity-2026-02-03-b.json",
                    r#"{"date":"2026-02-03","summary":{"stepCount":1500}}"#,
                ),
            ],
        );
        let overlap_report = import_archive(&harness.database(), &overlap, "polar:synthetic")
            .expect("overlap import");
        assert_eq!(overlap_report.enriched_observations, 1);
        assert_eq!(overlap_report.equivalent_observations, 1);
        assert_eq!(overlap_report.new_observations, 1);

        let competing = harness.archive(
            "competing.zip",
            &[(
                "activity-2026-02-02-c.json",
                r#"{"date":"2026-02-02","summary":{"stepCount":2000}}"#,
            )],
        );
        let conflict_report = import_archive(&harness.database(), &competing, "polar:synthetic")
            .expect("conflict import");
        assert_eq!(conflict_report.conflicts, 1);

        let less_complete = harness.archive(
            "less-complete.zip",
            &[("activity-2026-02-02-d.json", r#"{"date":"2026-02-02"}"#)],
        );
        let preserved_report =
            import_archive(&harness.database(), &less_complete, "polar:synthetic")
                .expect("less-complete import");
        assert_eq!(preserved_report.preserved_observations, 1);

        let history = query_activity(&harness.database()).expect("history");
        assert_eq!(history[0].step_count, Some(900));
        assert_eq!(history[1].step_count, Some(1000));
    }

    #[test]
    fn rolls_back_every_visible_change_after_interruption() {
        let harness = Harness::new();
        let archive = harness.archive(
            "interrupted.zip",
            &[
                (
                    "activity-2026-03-01-a.json",
                    r#"{"date":"2026-03-01","summary":{"stepCount":100}}"#,
                ),
                (
                    "activity-2026-03-02-a.json",
                    r#"{"date":"2026-03-02","summary":{"stepCount":200}}"#,
                ),
            ],
        );

        let error = import_archive_with_interruption(
            &harness.database(),
            &archive,
            "polar:synthetic",
            Some(1),
        )
        .expect_err("injected interruption");
        assert!(matches!(error, ImportError::InjectedInterruption(1)));
        assert!(query_activity(&harness.database())
            .expect("history")
            .is_empty());
    }

    #[test]
    fn rejects_invalid_content_without_partial_history() {
        let harness = Harness::new();
        let archive = harness.archive(
            "invalid.zip",
            &[
                (
                    "activity-2026-04-01-a.json",
                    r#"{"date":"2026-04-01","summary":{"stepCount":100}}"#,
                ),
                (
                    "activity-2026-04-02-a.json",
                    r#"{"date":"not-a-date","summary":{"stepCount":200}}"#,
                ),
            ],
        );

        import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect_err("invalid package");
        assert!(query_activity(&harness.database())
            .expect("history")
            .is_empty());
    }

    #[test]
    fn rejects_unsafe_archive_members() {
        let harness = Harness::new();
        let archive = harness.archive(
            "unsafe.zip",
            &[(
                "../activity-2026-05-01-a.json",
                r#"{"date":"2026-05-01","summary":{"stepCount":100}}"#,
            )],
        );

        let error = import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect_err("unsafe package");
        assert!(matches!(error, ImportError::UnsafeMember(_)));
    }

    #[test]
    fn rejects_duplicate_archive_members() {
        let harness = Harness::new();
        let archive = harness.archive(
            "duplicate.zip",
            &[
                ("activity-2026-05-02-a.json", r#"{"date":"2026-05-02"}"#),
                ("activity-2026-05-02-b.json", r#"{"date":"2026-05-02"}"#),
            ],
        );
        let original = b"activity-2026-05-02-b.json";
        let replacement = b"activity-2026-05-02-a.json";
        let mut bytes = std::fs::read(&archive).expect("ZIP bytes");
        for offset in 0..=bytes.len() - original.len() {
            if &bytes[offset..offset + original.len()] == original {
                bytes[offset..offset + replacement.len()].copy_from_slice(replacement);
            }
        }
        std::fs::write(&archive, bytes).expect("duplicate-name ZIP bytes");

        let error = import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect_err("duplicate package member");
        assert!(matches!(error, ImportError::DuplicateMember(_)));
    }

    #[test]
    fn rejects_extreme_compression_ratios() {
        let harness = Harness::new();
        let padding = "x".repeat(5 * 1024 * 1024);
        let content = format!(r#"{{"date":"2026-05-03","padding":"{padding}"}}"#);
        let archive = harness.archive(
            "compression-ratio.zip",
            &[("activity-2026-05-03-a.json", &content)],
        );

        let error = import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect_err("compression-ratio limit");
        assert!(matches!(error, ImportError::ResourceLimit(_)));
    }

    #[test]
    fn rejects_symbolic_link_archive_members() {
        let harness = Harness::new();
        let archive = harness.archive(
            "symlink.zip",
            &[("activity-2026-05-04-a.json", r#"{"date":"2026-05-04"}"#)],
        );
        let mut bytes = std::fs::read(&archive).expect("ZIP bytes");
        let central_offset = bytes
            .windows(4)
            .position(|candidate| candidate == b"PK\x01\x02")
            .expect("central-directory entry");
        bytes[central_offset + 5] = 3;
        let external_attributes = (0o120777_u32 << 16).to_le_bytes();
        bytes[central_offset + 38..central_offset + 42].copy_from_slice(&external_attributes);
        std::fs::write(&archive, bytes).expect("symbolic-link ZIP bytes");

        let error = import_archive(&harness.database(), &archive, "polar:synthetic")
            .expect_err("symbolic-link package member");
        assert!(matches!(error, ImportError::UnsafeMember(_)));
    }

    #[test]
    fn filters_history_by_inclusive_local_date_range() {
        let harness = Harness::new();
        let archive = harness.archive(
            "range.zip",
            &[
                ("activity-2026-06-01-a.json", r#"{"date":"2026-06-01"}"#),
                ("activity-2026-06-02-b.json", r#"{"date":"2026-06-02"}"#),
                ("activity-2026-06-03-c.json", r#"{"date":"2026-06-03"}"#),
            ],
        );
        import_archive(&harness.database(), &archive, "polar:synthetic").expect("range import");

        let filtered =
            query_activity_between(&harness.database(), Some("2026-06-02"), Some("2026-06-03"))
                .expect("filtered history");
        assert_eq!(
            filtered
                .iter()
                .map(|item| item.local_date.as_str())
                .collect::<Vec<_>>(),
            vec!["2026-06-02", "2026-06-03"]
        );
    }

    #[test]
    fn rolls_back_an_interrupted_schema_migration_and_recovers() {
        let harness = Harness::new();
        let database_path = harness.database();
        let connection = Connection::open(&database_path).expect("database");

        let error = migrate_schema(&connection, true).expect_err("interrupted migration");
        assert!(matches!(error, ImportError::InjectedMigrationInterruption));
        let version = connection
            .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
            .expect("schema version");
        assert_eq!(version, 0);
        let visible_tables = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master
                 WHERE type = 'table' AND name = 'daily_activity'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .expect("visible table count");
        assert_eq!(visible_tables, 0);

        migrate_schema(&connection, false).expect("recovered migration");
        let recovered_version = connection
            .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
            .expect("recovered schema version");
        assert_eq!(recovered_version, SCHEMA_VERSION);
    }

    #[test]
    fn creates_a_queryable_consistent_backup() {
        let harness = Harness::new();
        let archive = harness.archive(
            "backup-source.zip",
            &[(
                "activity-2026-07-01-a.json",
                r#"{"date":"2026-07-01","summary":{"stepCount":3210}}"#,
            )],
        );
        import_archive(&harness.database(), &archive, "polar:synthetic").expect("source import");
        let backup_path = harness.directory.path().join("fitfreed-backup.sqlite");

        backup_database(&harness.database(), &backup_path).expect("database backup");

        assert_eq!(
            query_activity(&backup_path).expect("backup history"),
            query_activity(&harness.database()).expect("source history")
        );
    }
}
