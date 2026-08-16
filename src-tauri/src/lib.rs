pub mod infrastructure;
mod presentation;

use std::path::{Path, PathBuf};

use fitfreed_application::{ImportCoordinator, ImportProgress};
use infrastructure::{
    recover_interrupted_imports, SqliteActivityLibrary, SqliteImportOutcomeLibrary,
    SqlitePolarFlowArchiveImporter,
};
use presentation::{
    CommandErrorDto, DailyActivityDto, ImportOutcomeDto, ImportProgressDto, ImportReportDto,
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
        let importer =
            SqlitePolarFlowArchiveImporter::new(database_path, "polar:synthetic".to_owned());
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
fn query_activity(app: AppHandle) -> Result<Vec<DailyActivityDto>, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let library = SqliteActivityLibrary::new(path);
    fitfreed_application::query_activity(&library)
        .map(|activities| activities.into_iter().map(DailyActivityDto::from).collect())
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
            query_activity,
            query_latest_import_outcome
        ])
        .run(tauri::generate_context!())
        .expect("failed to run FitFreed");
}
