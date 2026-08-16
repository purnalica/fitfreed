pub mod infrastructure;
mod presentation;

use std::path::{Path, PathBuf};

use fitfreed_application::{ImportCoordinator, ImportProgress};
use infrastructure::{SqliteActivityLibrary, SqlitePolarFlowArchiveImporter};
use presentation::{DailyActivityDto, ImportProgressDto, ImportReportDto};
use tauri::{ipc::Channel, AppHandle, Manager, State};

#[tauri::command]
async fn import_archive(
    app: AppHandle,
    coordinator: State<'_, ImportCoordinator>,
    archive_path: String,
    on_progress: Channel<ImportProgressDto>,
) -> Result<ImportReportDto, String> {
    let database_path = database_path(&app)?;
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
        .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
fn cancel_import(coordinator: State<'_, ImportCoordinator>) -> Result<bool, String> {
    coordinator.cancel().map_err(|error| error.to_string())
}

#[tauri::command]
fn query_activity(app: AppHandle) -> Result<Vec<DailyActivityDto>, String> {
    let library = SqliteActivityLibrary::new(database_path(&app)?);
    fitfreed_application::query_activity(&library)
        .map(|activities| activities.into_iter().map(DailyActivityDto::from).collect())
        .map_err(|error| error.to_string())
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
        .manage(ImportCoordinator::default())
        .invoke_handler(tauri::generate_handler![
            import_archive,
            cancel_import,
            query_activity
        ])
        .run(tauri::generate_context!())
        .expect("failed to run FitFreed");
}
