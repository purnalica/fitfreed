pub mod infrastructure;
mod presentation;

use std::path::{Path, PathBuf};

use fitfreed_application::{ImportCoordinator, ImportProgress, LocalePreference};
use infrastructure::{
    recover_interrupted_imports, SqliteActivityLibrary, SqliteImportOutcomeLibrary,
    SqliteLocalePreferences, SqlitePolarFlowArchiveImporter, SqliteTrainingLibrary,
};
use presentation::{
    ActivityComparisonDto, ActivityDateRangeDto, ActivityOverviewDto, CommandErrorDto,
    ImportOutcomeDto, ImportProgressDto, ImportReportDto, TrainingComparisonDto,
    TrainingDateRangeDto, TrainingOverviewDto,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init());
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
        .invoke_handler(tauri::generate_handler![
            import_archive,
            cancel_import,
            query_activity_overview,
            query_activity_comparison,
            query_training_overview,
            query_training_comparison,
            query_latest_import_outcome,
            load_locale,
            save_locale
        ])
        .run(tauri::generate_context!())
        .expect("failed to run FitFreed");
}
