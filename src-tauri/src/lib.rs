pub mod infrastructure;
mod presentation;

use std::{
    env,
    ffi::OsString,
    io,
    path::{Path, PathBuf},
    process,
    sync::Arc,
};

use chrono::{SecondsFormat, Utc};
use fitfreed_application::{
    check_for_updates as evaluate_updates, dismiss_update as persist_update_dismissal,
    postpone_update as persist_update_postponement,
    query_longitudinal_comparison as build_longitudinal_comparison,
    query_longitudinal_overview as build_longitudinal_overview, ImportCoordinator, ImportProgress,
    LocalePreference, UpdateChannelPort, UpdateCheckContext, UpdateCheckTrigger,
};
use infrastructure::{
    library_schema_version, recover_interrupted_imports, run_update_recovery_watchdog,
    HttpsUpdateChannel, SqliteActivityLibrary, SqliteImportOutcomeLibrary, SqliteLocalePreferences,
    SqliteLongitudinalLibrary, SqlitePolarFlowArchiveImporter, SqliteRecoveryLibrary,
    SqliteSleepLibrary, SqliteTrainingLibrary, SqliteUpdateState,
    UPDATE_RECOVERY_WATCHDOG_ARGUMENT,
};
use presentation::{
    ActivityComparisonDto, ActivityDateRangeDto, ActivityOverviewDto, CommandErrorDto,
    ImportOutcomeDto, ImportProgressDto, ImportReportDto, LongitudinalComparisonDto,
    LongitudinalDateRangeDto, LongitudinalOverviewDto, RecoveryComparisonDto, RecoveryDateRangeDto,
    RecoveryNightDetailDto, RecoveryOverviewDto, SleepComparisonDto, SleepDateRangeDto,
    SleepOverviewDto, SleepPeriodDetailDto, TrainingComparisonDto, TrainingDateRangeDto,
    TrainingOverviewDto, UpdateCheckOutcomeDto,
};
use tauri::{ipc::Channel, AppHandle, Manager, State};

#[tauri::command]
async fn import_archive(
    app: AppHandle,
    coordinator: State<'_, ImportCoordinator>,
    archive_path: String,
    on_progress: Channel<ImportProgressDto>,
) -> Result<ImportReportDto, CommandErrorDto> {
    let database_path =
        database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let coordinator = coordinator.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let importer = SqlitePolarFlowArchiveImporter::new(database_path);
        let mut report_progress = |progress: ImportProgress| {
            let _ = on_progress.send(progress.into());
        };
        fitfreed_application::import_archive(
            &importer,
            &coordinator,
            Path::new(&archive_path),
            &mut report_progress,
        )
        .map(ImportReportDto::from)
        .map_err(CommandErrorDto::from)
    })
    .await
    .map_err(|_| CommandErrorDto::new("desktop-task-failed"))?
}

#[tauri::command]
fn cancel_import(coordinator: State<'_, ImportCoordinator>) -> Result<bool, CommandErrorDto> {
    coordinator.cancel().map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_activity_overview(
    app: AppHandle,
    requested_range: Option<ActivityDateRangeDto>,
) -> Result<ActivityOverviewDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let library = SqliteActivityLibrary::new(path);
    fitfreed_application::query_activity_overview(&library, requested_range.map(Into::into))
        .map(ActivityOverviewDto::from)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_activity_comparison(
    app: AppHandle,
    baseline_range: ActivityDateRangeDto,
    comparison_range: ActivityDateRangeDto,
) -> Result<ActivityComparisonDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let library = SqliteActivityLibrary::new(path);
    fitfreed_application::query_activity_comparison(
        &library,
        baseline_range.into(),
        comparison_range.into(),
    )
    .map(ActivityComparisonDto::from)
    .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_training_overview(
    app: AppHandle,
    requested_range: Option<TrainingDateRangeDto>,
) -> Result<TrainingOverviewDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let library = SqliteTrainingLibrary::new(path);
    fitfreed_application::query_training_overview(&library, requested_range.map(Into::into))
        .map(TrainingOverviewDto::from)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_training_comparison(
    app: AppHandle,
    baseline_range: TrainingDateRangeDto,
    comparison_range: TrainingDateRangeDto,
) -> Result<TrainingComparisonDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let library = SqliteTrainingLibrary::new(path);
    fitfreed_application::query_training_comparison(
        &library,
        baseline_range.into(),
        comparison_range.into(),
    )
    .map(TrainingComparisonDto::from)
    .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_sleep_overview(
    app: AppHandle,
    requested_range: Option<SleepDateRangeDto>,
) -> Result<SleepOverviewDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let library = SqliteSleepLibrary::new(path);
    fitfreed_application::query_sleep_overview(&library, requested_range.map(Into::into))
        .map(SleepOverviewDto::from)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_sleep_comparison(
    app: AppHandle,
    baseline_range: SleepDateRangeDto,
    comparison_range: SleepDateRangeDto,
) -> Result<SleepComparisonDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let library = SqliteSleepLibrary::new(path);
    fitfreed_application::query_sleep_comparison(
        &library,
        baseline_range.into(),
        comparison_range.into(),
    )
    .map(SleepComparisonDto::from)
    .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_sleep_detail(
    app: AppHandle,
    series_ref: String,
    sleep_date: String,
) -> Result<Option<SleepPeriodDetailDto>, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let library = SqliteSleepLibrary::new(path);
    fitfreed_application::query_sleep_detail(&library, &series_ref, &sleep_date)
        .map(|detail| detail.map(SleepPeriodDetailDto::from))
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_recovery_overview(
    app: AppHandle,
    requested_range: Option<RecoveryDateRangeDto>,
) -> Result<RecoveryOverviewDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let library = SqliteRecoveryLibrary::new(path);
    fitfreed_application::query_recovery_overview(&library, requested_range.map(Into::into))
        .map(RecoveryOverviewDto::from)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_recovery_comparison(
    app: AppHandle,
    baseline_range: RecoveryDateRangeDto,
    comparison_range: RecoveryDateRangeDto,
) -> Result<RecoveryComparisonDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let library = SqliteRecoveryLibrary::new(path);
    fitfreed_application::query_recovery_comparison(
        &library,
        baseline_range.into(),
        comparison_range.into(),
    )
    .map(RecoveryComparisonDto::from)
    .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_recovery_detail(
    app: AppHandle,
    series_ref: String,
    recovery_date: String,
) -> Result<Option<RecoveryNightDetailDto>, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let library = SqliteRecoveryLibrary::new(path);
    fitfreed_application::query_recovery_detail(&library, &series_ref, &recovery_date)
        .map(|detail| detail.map(RecoveryNightDetailDto::from))
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_longitudinal_overview(
    app: AppHandle,
    requested_range: Option<LongitudinalDateRangeDto>,
) -> Result<LongitudinalOverviewDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let library = SqliteLongitudinalLibrary::new(path);
    build_longitudinal_overview(&library, requested_range.map(Into::into))
        .map(LongitudinalOverviewDto::from)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_longitudinal_comparison(
    app: AppHandle,
    baseline_range: LongitudinalDateRangeDto,
    comparison_range: LongitudinalDateRangeDto,
) -> Result<LongitudinalComparisonDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let library = SqliteLongitudinalLibrary::new(path);
    build_longitudinal_comparison(&library, baseline_range.into(), comparison_range.into())
        .map(LongitudinalComparisonDto::from)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_latest_import_outcome(
    app: AppHandle,
) -> Result<Option<ImportOutcomeDto>, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let library = SqliteImportOutcomeLibrary::new(path);
    fitfreed_application::query_latest_import_outcome(&library)
        .map(|outcome| outcome.map(ImportOutcomeDto::from))
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn load_locale(app: AppHandle) -> Result<Option<String>, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let preferences = SqliteLocalePreferences::new(path);
    fitfreed_application::load_locale_preference(&preferences)
        .map(|locale| locale.map(|value| value.code().to_owned()))
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn save_locale(app: AppHandle, locale: String) -> Result<(), CommandErrorDto> {
    let locale = LocalePreference::from_code(&locale)
        .ok_or_else(|| CommandErrorDto::new("invalid-locale"))?;
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let preferences = SqliteLocalePreferences::new(path);
    fitfreed_application::save_locale_preference(&preferences, locale)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
async fn check_for_updates_on_launch(
    app: AppHandle,
    channel: State<'_, Arc<HttpsUpdateChannel>>,
) -> Result<UpdateCheckOutcomeDto, CommandErrorDto> {
    check_updates(app, channel, UpdateCheckTrigger::Scheduled).await
}

#[tauri::command]
async fn check_for_updates(
    app: AppHandle,
    channel: State<'_, Arc<HttpsUpdateChannel>>,
) -> Result<UpdateCheckOutcomeDto, CommandErrorDto> {
    check_updates(app, channel, UpdateCheckTrigger::Manual).await
}

async fn check_updates(
    app: AppHandle,
    channel: State<'_, Arc<HttpsUpdateChannel>>,
    trigger: UpdateCheckTrigger,
) -> Result<UpdateCheckOutcomeDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let channel = Arc::clone(channel.inner());
    let checked_at = current_utc_datetime();
    tauri::async_runtime::spawn_blocking(move || {
        perform_update_check(channel.as_ref(), path, checked_at, trigger)
    })
    .await
    .map_err(|_| CommandErrorDto::new("desktop-task-failed"))?
}

fn perform_update_check(
    channel: &impl UpdateChannelPort,
    database_path: PathBuf,
    checked_at: String,
    trigger: UpdateCheckTrigger,
) -> Result<UpdateCheckOutcomeDto, CommandErrorDto> {
    let locale = fitfreed_application::load_locale_preference(&SqliteLocalePreferences::new(
        database_path.clone(),
    ))
    .map_err(|_| CommandErrorDto::new("update-state-unavailable"))?
    .unwrap_or(LocalePreference::EnUs);
    let state = SqliteUpdateState::new(database_path);
    evaluate_updates(
        channel,
        &state,
        UpdateCheckContext {
            installed_version: env!("CARGO_PKG_VERSION").to_owned(),
            library_schema_version: library_schema_version(),
            locale,
            checked_at,
            trigger,
        },
    )
    .map(UpdateCheckOutcomeDto::from)
    .map_err(CommandErrorDto::from)
}

#[tauri::command]
async fn dismiss_available_update(
    app: AppHandle,
    candidate_version: String,
) -> Result<(), CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    tauri::async_runtime::spawn_blocking(move || {
        persist_update_dismissal(&SqliteUpdateState::new(path), &candidate_version)
            .map_err(CommandErrorDto::from)
    })
    .await
    .map_err(|_| CommandErrorDto::new("desktop-task-failed"))?
}

#[tauri::command]
async fn postpone_available_update(
    app: AppHandle,
    candidate_version: String,
) -> Result<String, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let requested_at = current_utc_datetime();
    tauri::async_runtime::spawn_blocking(move || {
        persist_update_postponement(
            &SqliteUpdateState::new(path),
            &candidate_version,
            &requested_at,
        )
        .map_err(CommandErrorDto::from)
    })
    .await
    .map_err(|_| CommandErrorDto::new("desktop-task-failed"))?
}

fn current_utc_datetime() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(feature = "e2e")]
    if let Some(path) = std::env::var_os("FITFREED_E2E_DATABASE_PATH") {
        return Ok(PathBuf::from(path));
    }

    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join("fitfreed.sqlite"))
}

enum StartupMode {
    Desktop,
    UpdateRecoveryWatchdog { installed_application: PathBuf },
    InvalidPrivateMode,
}

fn startup_mode(arguments: &[OsString]) -> StartupMode {
    if arguments.get(1).and_then(|argument| argument.to_str())
        != Some(UPDATE_RECOVERY_WATCHDOG_ARGUMENT)
    {
        return StartupMode::Desktop;
    }
    match arguments {
        [_, _, installed_application] if Path::new(installed_application).is_absolute() => {
            StartupMode::UpdateRecoveryWatchdog {
                installed_application: PathBuf::from(installed_application),
            }
        }
        _ => StartupMode::InvalidPrivateMode,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    match startup_mode(&env::args_os().collect::<Vec<_>>()) {
        StartupMode::Desktop => {}
        StartupMode::UpdateRecoveryWatchdog {
            installed_application,
        } => {
            let succeeded = env::current_exe().is_ok_and(|executable| {
                run_update_recovery_watchdog(
                    &executable,
                    &installed_application,
                    &mut io::stdout().lock(),
                )
                .is_ok()
            });
            process::exit(if succeeded { 0 } else { 1 });
        }
        StartupMode::InvalidPrivateMode => process::exit(1),
    }
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build());
    #[cfg(feature = "e2e")]
    let builder = builder
        .plugin(tauri_plugin_wdio_webdriver::init())
        .plugin(tauri_plugin_wdio::init());
    builder
        .setup(|app| {
            let library_path = database_path(app.handle()).map_err(std::io::Error::other)?;
            recover_interrupted_imports(&library_path)?;
            Ok(())
        })
        .manage(ImportCoordinator::default())
        .manage(Arc::new(HttpsUpdateChannel::unconfigured()))
        .invoke_handler(tauri::generate_handler![
            import_archive,
            cancel_import,
            query_activity_overview,
            query_activity_comparison,
            query_training_overview,
            query_training_comparison,
            query_sleep_overview,
            query_sleep_comparison,
            query_sleep_detail,
            query_recovery_overview,
            query_recovery_comparison,
            query_recovery_detail,
            query_longitudinal_overview,
            query_longitudinal_comparison,
            query_latest_import_outcome,
            load_locale,
            save_locale,
            check_for_updates_on_launch,
            check_for_updates,
            dismiss_available_update,
            postpone_available_update
        ])
        .run(tauri::generate_context!())
        .expect("failed to run FitFreed");
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use fitfreed_application::{
        save_locale_preference, AuthenticatedUpdateSnapshot, LocalizedUpdateText, UpdateArtifact,
        UpdateChannelRead, UpdateRelease,
    };
    use tempfile::TempDir;

    use super::*;

    struct FixedUpdateChannel(UpdateChannelRead);

    impl UpdateChannelPort for FixedUpdateChannel {
        fn fetch_update_snapshot(&self) -> Result<UpdateChannelRead, String> {
            Ok(self.0.clone())
        }
    }

    #[test]
    fn host_update_check_uses_the_installed_build_schema_and_persisted_locale() {
        let directory = TempDir::new().expect("temporary directory");
        let database_path = directory.path().join("library.sqlite");
        save_locale_preference(
            &SqliteLocalePreferences::new(database_path.clone()),
            LocalePreference::EsEs,
        )
        .expect("Spanish preference");
        let channel = FixedUpdateChannel(UpdateChannelRead::Authenticated(Box::new(
            authenticated_update_snapshot(),
        )));

        let outcome = perform_update_check(
            &channel,
            database_path,
            "2026-08-16T12:00:00Z".to_owned(),
            UpdateCheckTrigger::Manual,
        )
        .expect("update outcome");
        let json = serde_json::to_value(outcome).expect("update outcome JSON");

        assert_eq!(json["installedVersion"], env!("CARGO_PKG_VERSION"));
        assert_eq!(json["status"], "available");
        assert_eq!(json["release"]["targetLibrarySchemaVersion"], 9);
        assert_eq!(json["release"]["releaseNotes"], "Notas en español.");
    }

    #[test]
    fn host_update_check_defaults_to_english_without_a_saved_preference() {
        let directory = TempDir::new().expect("temporary directory");
        let channel = FixedUpdateChannel(UpdateChannelRead::Authenticated(Box::new(
            authenticated_update_snapshot(),
        )));

        let outcome = perform_update_check(
            &channel,
            directory.path().join("library.sqlite"),
            "2026-08-16T12:00:00Z".to_owned(),
            UpdateCheckTrigger::Scheduled,
        )
        .expect("update outcome");
        let json = serde_json::to_value(outcome).expect("update outcome JSON");

        assert_eq!(json["release"]["releaseNotes"], "English notes.");
        assert_eq!(json["checkedAt"], "2026-08-16T12:00:00Z");
    }

    #[test]
    fn host_clock_produces_a_utc_rfc3339_instant() {
        let timestamp = current_utc_datetime();

        assert!(timestamp.ends_with('Z'));
        assert!(chrono::DateTime::parse_from_rfc3339(&timestamp).is_ok());
    }

    #[test]
    fn routes_only_the_exact_private_watchdog_invocation_away_from_desktop_startup() {
        let executable = OsString::from("fitfreed");
        let argument = OsString::from(UPDATE_RECOVERY_WATCHDOG_ARGUMENT);
        let installed = OsString::from("/Applications/FitFreed.app");

        assert!(matches!(
            startup_mode(std::slice::from_ref(&executable)),
            StartupMode::Desktop
        ));
        assert!(matches!(
            startup_mode(&[executable.clone(), argument.clone(), installed]),
            StartupMode::UpdateRecoveryWatchdog { .. }
        ));
        assert!(matches!(
            startup_mode(&[executable.clone(), argument.clone()]),
            StartupMode::InvalidPrivateMode
        ));
        assert!(matches!(
            startup_mode(&[
                executable,
                argument,
                OsString::from("relative/FitFreed.app")
            ]),
            StartupMode::InvalidPrivateMode
        ));
    }

    fn authenticated_update_snapshot() -> AuthenticatedUpdateSnapshot {
        AuthenticatedUpdateSnapshot {
            sequence: 1,
            payload_sha256: "a".repeat(64),
            signing_key_id: "synthetic-test-key".to_owned(),
            issued_at: "2026-08-16T11:00:00Z".to_owned(),
            expires_at: "2026-08-17T11:00:00Z".to_owned(),
            release: UpdateRelease {
                version: "0.2.0".to_owned(),
                published_at: "2026-08-16T10:00:00Z".to_owned(),
                minimum_supported_version: "0.1.0".to_owned(),
                minimum_readable_library_schema_version: library_schema_version(),
                maximum_readable_library_schema_version: library_schema_version(),
                target_library_schema_version: library_schema_version(),
                release_notes: LocalizedUpdateText {
                    values: BTreeMap::from([
                        ("en-US".to_owned(), "English notes.".to_owned()),
                        ("es-ES".to_owned(), "Notas en español.".to_owned()),
                    ]),
                },
                artifact: UpdateArtifact {
                    target: "darwin-aarch64".to_owned(),
                    package_url: "https://updates.invalid/fitfreed-0.2.0.app.tar.gz".to_owned(),
                    expected_size_bytes: 26,
                    expected_sha256:
                        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
                            .to_owned(),
                    package_signature: "synthetic-package-signature".to_owned(),
                },
            },
            withdrawn_versions: Vec::new(),
        }
    }
}
