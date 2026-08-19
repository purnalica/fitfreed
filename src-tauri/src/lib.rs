pub mod infrastructure;
mod presentation;

use std::{
    collections::BTreeMap,
    env,
    ffi::OsString,
    future::Future,
    io::{self, Write},
    path::{Path, PathBuf},
    process,
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};

#[cfg(feature = "e2e")]
use std::fs;

use chrono::{SecondsFormat, Utc};
use fitfreed_application::{
    apply_training_segment_criterion as apply_segment_criterion_through_port,
    authorize_update_installation as authorize_update, check_for_updates as evaluate_updates,
    clear_exploration_workspace as clear_workspace,
    create_session_report as create_session_report_through_port,
    create_training_segment_criterion as create_segment_criterion_through_port,
    dismiss_update as persist_update_dismissal,
    export_session_report as export_session_report_through_port,
    list_reports as list_reports_through_port,
    load_application_preferences as load_preferences_from_port,
    load_report_definition as load_report_definition_through_port,
    move_training_segment_criterion as move_segment_criterion_through_port,
    postpone_update as persist_update_postponement, query_library_home as build_library_home,
    query_longitudinal_comparison as build_longitudinal_comparison,
    query_longitudinal_overview as build_longitudinal_overview,
    query_source_acquisition_guides as build_source_acquisition_guides,
    query_training_route_points as build_training_route_points,
    query_training_session_provenance as build_training_session_provenance,
    query_training_session_routes as build_training_session_routes,
    query_training_session_segmentation as build_training_session_segmentation,
    query_training_session_signals as build_training_session_signals,
    query_training_session_structure as build_training_session_structure,
    query_training_session_zones as build_training_session_zones,
    query_training_signal_samples as build_training_signal_samples,
    query_training_sports as build_training_sports,
    remove_training_segment_criterion as remove_segment_criterion_through_port,
    reset_application_preferences as reset_preferences_through_port,
    resolve_session_report as resolve_session_report_through_port,
    save_application_preferences as save_preferences_through_port,
    save_exploration_workspace as save_workspace,
    save_training_sport_classification as persist_training_sport_classification,
    update_session_report as update_session_report_through_port,
    update_training_segment_criterion as update_segment_criterion_through_port, ApplicationError,
    ApplicationPreferences, ImportCoordinator, ImportProgress, InvalidApplicationPreferences,
    LocalePreference, ReportExportCancellation, UpdateChannelPort, UpdateCheckContext,
    UpdateCheckTrigger, UpdateInstallationAuthorization, UpdateRecoveryOutcome,
};
use infrastructure::{
    acknowledge_update_recovery_outcome as acknowledge_retained_update_recovery_outcome,
    acquire_update_recovery_candidate_lease, await_update_recovery_candidate_go,
    confirm_active_update_recovery, current_update_target, download_verified_update,
    install_verified_update, library_schema_version, maintain_update_recovery,
    recover_interrupted_imports, resolve_update_application_path, run_update_recovery_watchdog,
    HttpsUpdateChannel, PolarFlowSourceAcquisitionGuides, SelfContainedHtmlReportExporter,
    SqliteActivityLibrary, SqliteApplicationPreferences, SqliteImportOutcomeLibrary,
    SqliteLibraryHome, SqliteLongitudinalLibrary, SqlitePolarFlowArchiveImporter,
    SqliteRecoveryLibrary, SqliteReportLibrary, SqliteSleepLibrary, SqliteTrainingLibrary,
    SqliteTrainingSports, SqliteUpdateState, UpdateInstallationError, UpdateInstallationRequest,
    UpdatePackageError, UpdateRecoveryCandidateLease, UpdateRecoveryError,
    UpdateRecoveryMaintenance, UPDATE_RECOVERY_CANDIDATE_ARGUMENT,
    UPDATE_RECOVERY_WATCHDOG_ARGUMENT,
};
use presentation::{
    ActivityComparisonDto, ActivityDateRangeDto, ActivityOverviewDto, ApplicationPreferencesDto,
    ApplicationPreferencesInputDto, ApplicationPreferencesLoadDto, CommandErrorDto,
    CreateSessionReportRequestDto, CreateTrainingSegmentCriterionRequestDto,
    ExplorationWorkspaceDto, ExploreDestinationInputDto, ImportOutcomeDto, ImportProgressDto,
    ImportReportDto, LibraryHomeDto, LibraryHomeRequestDto, LongitudinalComparisonDto,
    LongitudinalDateRangeDto, LongitudinalOverviewDto, MoveTrainingSegmentCriterionRequestDto,
    RecoveryComparisonDto, RecoveryDateRangeDto, RecoveryNightDetailDto, RecoveryOverviewDto,
    ReportDefinitionDto, ReportExportReceiptDto, ReportListDto, ResolvedSessionReportDto,
    SaveSportClassificationRequestDto, SavedTrainingSportClassificationDto,
    SessionReportExportRequestDto, SleepComparisonDto, SleepDateRangeDto, SleepOverviewDto,
    SleepPeriodDetailDto, SourceAcquisitionGuideDto, TrainingComparisonDto, TrainingDateRangeDto,
    TrainingDiscoveryWorkspaceDto, TrainingOverviewDto, TrainingRoutePointsQueryDto,
    TrainingRoutePointsResultDto, TrainingSegmentCriterionMutationRequestDto,
    TrainingSessionCalendarDto, TrainingSessionCalendarRequestDto,
    TrainingSessionProvenanceQueryDto, TrainingSessionProvenanceResultDto,
    TrainingSessionRouteQueryDto, TrainingSessionRoutesResultDto, TrainingSessionSearchPageDto,
    TrainingSessionSearchRequestDto, TrainingSessionSegmentationQueryDto,
    TrainingSessionSegmentationResultDto, TrainingSessionSelectionDto,
    TrainingSessionSelectionRequestDto, TrainingSessionSignalsQueryDto,
    TrainingSessionSignalsResultDto, TrainingSessionStructureQueryDto,
    TrainingSessionStructureResultDto, TrainingSessionZonesQueryDto, TrainingSessionZonesResultDto,
    TrainingSignalSamplesQueryDto, TrainingSignalSamplesResultDto, TrainingSportsOverviewDto,
    UpdateCheckOutcomeDto, UpdateRecoveryOutcomeDto, UpdateSessionReportRequestDto,
    UpdateTrainingSegmentCriterionRequestDto,
};
use serde::{Deserialize, Serialize};
use tauri::{ipc::Channel, AppHandle, Emitter, Manager, State};
use tokio::{
    sync::{watch, Mutex as AsyncMutex, MutexGuard as AsyncMutexGuard},
    time::sleep,
};

const UPDATE_RECOVERY_STARTUP_MAINTENANCE_TIMEOUT: Duration = Duration::from_secs(12);
const UPDATE_RECOVERY_STARTUP_MAINTENANCE_POLL_INTERVAL: Duration = Duration::from_millis(100);
const PERIODIC_UPDATE_CHECK_INTERVAL: Duration = Duration::from_secs(24 * 60 * 60);
const UPDATE_CHECK_COMPLETED_EVENT: &str = "fitfreed://update-check-completed";

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
enum StartupLibraryRecoveryStatus {
    #[default]
    Pending,
    Ready,
    Failed,
}

struct StartupLibraryRecovery {
    status: watch::Sender<StartupLibraryRecoveryStatus>,
}

impl Default for StartupLibraryRecovery {
    fn default() -> Self {
        let (status, _) = watch::channel(StartupLibraryRecoveryStatus::Pending);
        Self { status }
    }
}

impl StartupLibraryRecovery {
    fn complete(&self, succeeded: bool) {
        self.status.send_replace(if succeeded {
            StartupLibraryRecoveryStatus::Ready
        } else {
            StartupLibraryRecoveryStatus::Failed
        });
    }

    async fn await_ready(&self) -> Result<(), ()> {
        let mut status = self.status.subscribe();
        loop {
            match *status.borrow_and_update() {
                StartupLibraryRecoveryStatus::Ready => return Ok(()),
                StartupLibraryRecoveryStatus::Failed => return Err(()),
                StartupLibraryRecoveryStatus::Pending => {}
            }
            status.changed().await.map_err(|_| ())?;
        }
    }
}

struct InteractiveShellSignal {
    started_at: Instant,
    setup_complete: Mutex<Option<Duration>>,
    emitted: Mutex<bool>,
}

impl Default for InteractiveShellSignal {
    fn default() -> Self {
        Self {
            started_at: Instant::now(),
            setup_complete: Mutex::new(None),
            emitted: Mutex::new(false),
        }
    }
}

impl InteractiveShellSignal {
    fn record_setup_complete(&self) -> io::Result<()> {
        let mut setup_complete = self
            .setup_complete
            .lock()
            .map_err(|_| io::Error::other("interactive shell setup timing is unavailable"))?;
        *setup_complete = Some(self.started_at.elapsed());
        Ok(())
    }
}

#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RendererStartupMilliseconds {
    locale_ready: f64,
    signal: f64,
}

impl RendererStartupMilliseconds {
    fn is_valid(self) -> bool {
        self.locale_ready.is_finite()
            && self.signal.is_finite()
            && self.locale_ready >= 0.0
            && self.signal >= self.locale_ready
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HostStartupMilliseconds {
    setup_complete: f64,
    signal: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InteractiveShellPayload<'a> {
    format: &'static str,
    schema_version: u8,
    event: &'static str,
    application_version: &'a str,
    source_revision: &'a str,
    source_tree_clean: bool,
    host_startup_milliseconds: HostStartupMilliseconds,
    renderer_startup_milliseconds: RendererStartupMilliseconds,
}

fn write_interactive_shell_signal(
    signal: &InteractiveShellSignal,
    renderer_startup_milliseconds: RendererStartupMilliseconds,
    writer: &mut impl Write,
) -> io::Result<bool> {
    if !renderer_startup_milliseconds.is_valid() {
        return Err(io::Error::other(
            "interactive shell renderer timing is invalid",
        ));
    }
    let mut emitted = signal
        .emitted
        .lock()
        .map_err(|_| io::Error::other("interactive shell signal is unavailable"))?;
    if *emitted {
        return Ok(false);
    }
    let setup_complete = signal
        .setup_complete
        .lock()
        .map_err(|_| io::Error::other("interactive shell setup timing is unavailable"))?
        .ok_or_else(|| io::Error::other("interactive shell setup timing was not recorded"))?;
    let host_signal = signal.started_at.elapsed();
    serde_json::to_writer(
        &mut *writer,
        &InteractiveShellPayload {
            format: "org.fitfreed.startup-signal",
            schema_version: 2,
            event: "interactive-shell",
            application_version: env!("CARGO_PKG_VERSION"),
            source_revision: env!("FITFREED_SOURCE_REVISION"),
            source_tree_clean: env!("FITFREED_SOURCE_TREE_CLEAN") == "true",
            host_startup_milliseconds: HostStartupMilliseconds {
                setup_complete: setup_complete.as_secs_f64() * 1_000.0,
                signal: host_signal.as_secs_f64() * 1_000.0,
            },
            renderer_startup_milliseconds,
        },
    )
    .map_err(io::Error::other)?;
    writer.write_all(b"\n")?;
    writer.flush()?;
    *emitted = true;
    Ok(true)
}

#[tauri::command]
fn report_interactive_shell(
    signal: State<'_, InteractiveShellSignal>,
    renderer_startup_milliseconds: RendererStartupMilliseconds,
) -> Result<(), CommandErrorDto> {
    write_interactive_shell_signal(
        signal.inner(),
        renderer_startup_milliseconds,
        &mut io::stdout().lock(),
    )
    .map(|_| ())
    .map_err(|_| CommandErrorDto::new("interactive-shell-signal-unavailable"))
}

#[derive(Default)]
struct UpdateOperationCoordinator {
    operation: AsyncMutex<()>,
}

impl UpdateOperationCoordinator {
    async fn reserve(&self) -> AsyncMutexGuard<'_, ()> {
        self.operation.lock().await
    }

    fn try_reserve(&self) -> Option<AsyncMutexGuard<'_, ()>> {
        self.operation.try_lock().ok()
    }
}

#[derive(Clone, Default)]
struct ReportExportCoordinator {
    active: Arc<Mutex<Option<Arc<ReportExportCancellation>>>>,
}

impl ReportExportCoordinator {
    fn begin(&self) -> Result<ReportExportOperation, ()> {
        let mut active = self.active.lock().map_err(|_| ())?;
        if active.is_some() {
            return Err(());
        }
        let cancellation = Arc::new(ReportExportCancellation::new());
        *active = Some(Arc::clone(&cancellation));
        Ok(ReportExportOperation {
            active: Arc::clone(&self.active),
            cancellation,
        })
    }

    fn cancel(&self) -> Result<bool, ()> {
        let active = self.active.lock().map_err(|_| ())?;
        let Some(cancellation) = active.as_ref() else {
            return Ok(false);
        };
        cancellation.cancel();
        Ok(true)
    }
}

struct ReportExportOperation {
    active: Arc<Mutex<Option<Arc<ReportExportCancellation>>>>,
    cancellation: Arc<ReportExportCancellation>,
}

impl Drop for ReportExportOperation {
    fn drop(&mut self) {
        if let Ok(mut active) = self.active.lock() {
            if active
                .as_ref()
                .is_some_and(|current| Arc::ptr_eq(current, &self.cancellation))
            {
                *active = None;
            }
        }
    }
}

#[tauri::command]
async fn import_archive(
    app: AppHandle,
    coordinator: State<'_, ImportCoordinator>,
    startup_recovery: State<'_, Arc<StartupLibraryRecovery>>,
    archive_path: String,
    on_progress: Channel<ImportProgressDto>,
) -> Result<ImportReportDto, CommandErrorDto> {
    startup_recovery
        .await_ready()
        .await
        .map_err(|_| CommandErrorDto::new("library-unavailable"))?;
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
fn query_training_sessions(
    app: AppHandle,
    request: TrainingSessionSearchRequestDto,
) -> Result<TrainingSessionSearchPageDto, CommandErrorDto> {
    let request = request.try_into().map_err(CommandErrorDto::from)?;
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let library = SqliteTrainingLibrary::new(path);
    fitfreed_application::query_training_sessions(&library, request)
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_training_session_calendar(
    app: AppHandle,
    request: TrainingSessionCalendarRequestDto,
) -> Result<TrainingSessionCalendarDto, CommandErrorDto> {
    let request = request.try_into().map_err(CommandErrorDto::from)?;
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let library = SqliteTrainingLibrary::new(path);
    fitfreed_application::query_training_session_calendar(&library, request)
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_training_session_selection(
    app: AppHandle,
    request: TrainingSessionSelectionRequestDto,
) -> Result<TrainingSessionSelectionDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let library = SqliteTrainingLibrary::new(path);
    fitfreed_application::query_training_session_selection(&library, request.into())
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_training_session_structure(
    app: AppHandle,
    query: TrainingSessionStructureQueryDto,
) -> Result<TrainingSessionStructureResultDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    build_training_session_structure(&SqliteTrainingLibrary::new(path), query.into())
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_training_session_routes(
    app: AppHandle,
    query: TrainingSessionRouteQueryDto,
) -> Result<TrainingSessionRoutesResultDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    build_training_session_routes(&SqliteTrainingLibrary::new(path), query.into())
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_training_route_points(
    app: AppHandle,
    query: TrainingRoutePointsQueryDto,
) -> Result<TrainingRoutePointsResultDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    build_training_route_points(&SqliteTrainingLibrary::new(path), query.into())
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_training_session_signals(
    app: AppHandle,
    query: TrainingSessionSignalsQueryDto,
) -> Result<TrainingSessionSignalsResultDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    build_training_session_signals(&SqliteTrainingLibrary::new(path), query.into())
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_training_session_zones(
    app: AppHandle,
    query: TrainingSessionZonesQueryDto,
) -> Result<TrainingSessionZonesResultDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    build_training_session_zones(&SqliteTrainingLibrary::new(path), query.into())
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_training_session_provenance(
    app: AppHandle,
    query: TrainingSessionProvenanceQueryDto,
) -> Result<TrainingSessionProvenanceResultDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    build_training_session_provenance(&SqliteTrainingLibrary::new(path), query.into())
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_training_signal_samples(
    app: AppHandle,
    query: TrainingSignalSamplesQueryDto,
) -> Result<TrainingSignalSamplesResultDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    build_training_signal_samples(&SqliteTrainingLibrary::new(path), query.into())
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_training_session_segmentation(
    app: AppHandle,
    query: TrainingSessionSegmentationQueryDto,
) -> Result<TrainingSessionSegmentationResultDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    build_training_session_segmentation(&SqliteTrainingLibrary::new(path), query.into())
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn create_training_segment_criterion(
    app: AppHandle,
    request: CreateTrainingSegmentCriterionRequestDto,
) -> Result<TrainingSessionSegmentationResultDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    create_segment_criterion_through_port(&SqliteTrainingLibrary::new(path), request.try_into()?)
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn update_training_segment_criterion(
    app: AppHandle,
    request: UpdateTrainingSegmentCriterionRequestDto,
) -> Result<TrainingSessionSegmentationResultDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    update_segment_criterion_through_port(&SqliteTrainingLibrary::new(path), request.try_into()?)
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn apply_training_segment_criterion(
    app: AppHandle,
    request: TrainingSegmentCriterionMutationRequestDto,
) -> Result<TrainingSessionSegmentationResultDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    apply_segment_criterion_through_port(&SqliteTrainingLibrary::new(path), request.into())
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn remove_training_segment_criterion(
    app: AppHandle,
    request: TrainingSegmentCriterionMutationRequestDto,
) -> Result<TrainingSessionSegmentationResultDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    remove_segment_criterion_through_port(&SqliteTrainingLibrary::new(path), request.into())
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn move_training_segment_criterion(
    app: AppHandle,
    request: MoveTrainingSegmentCriterionRequestDto,
) -> Result<TrainingSessionSegmentationResultDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    move_segment_criterion_through_port(&SqliteTrainingLibrary::new(path), request.into())
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn load_training_discovery_workspace(
    app: AppHandle,
) -> Result<Option<TrainingDiscoveryWorkspaceDto>, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    fitfreed_application::load_training_discovery_workspace(&SqliteTrainingLibrary::new(path))
        .map(|workspace| workspace.map(Into::into))
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn save_training_discovery_workspace(
    app: AppHandle,
    workspace: TrainingDiscoveryWorkspaceDto,
) -> Result<TrainingDiscoveryWorkspaceDto, CommandErrorDto> {
    let workspace = workspace.try_into().map_err(CommandErrorDto::from)?;
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    fitfreed_application::save_training_discovery_workspace(
        &SqliteTrainingLibrary::new(path),
        workspace,
    )
    .map(Into::into)
    .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn clear_training_discovery_workspace(app: AppHandle) -> Result<(), CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    fitfreed_application::clear_training_discovery_workspace(&SqliteTrainingLibrary::new(path))
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn query_training_sports(app: AppHandle) -> Result<TrainingSportsOverviewDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    build_training_sports(&SqliteTrainingSports::new(path))
        .map(TrainingSportsOverviewDto::from)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn save_training_sport_classification(
    app: AppHandle,
    request: SaveSportClassificationRequestDto,
) -> Result<SavedTrainingSportClassificationDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    persist_training_sport_classification(&SqliteTrainingSports::new(path), request.into())
        .map(SavedTrainingSportClassificationDto::from)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn create_session_report(
    app: AppHandle,
    request: CreateSessionReportRequestDto,
) -> Result<ReportDefinitionDto, CommandErrorDto> {
    let request = request.try_into()?;
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    create_session_report_through_port(
        &SqliteReportLibrary::new(path.clone()),
        &SqliteTrainingLibrary::new(path),
        request,
    )
    .map(Into::into)
    .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn update_session_report(
    app: AppHandle,
    request: UpdateSessionReportRequestDto,
) -> Result<ReportDefinitionDto, CommandErrorDto> {
    let request = request.try_into()?;
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    update_session_report_through_port(&SqliteReportLibrary::new(path), request)
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn list_reports(app: AppHandle) -> Result<ReportListDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    list_reports_through_port(&SqliteReportLibrary::new(path))
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn load_report_definition(
    app: AppHandle,
    report_ref: String,
) -> Result<ReportDefinitionDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    load_report_definition_through_port(&SqliteReportLibrary::new(path), &report_ref)
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn resolve_session_report(
    app: AppHandle,
    report_ref: String,
) -> Result<ResolvedSessionReportDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    resolve_session_report_through_port(
        &SqliteReportLibrary::new(path.clone()),
        &SqliteTrainingLibrary::new(path.clone()),
        &SqliteTrainingLibrary::new(path),
        &report_ref,
    )
    .map(Into::into)
    .map_err(CommandErrorDto::from)
}

#[tauri::command]
async fn export_session_report(
    app: AppHandle,
    coordinator: State<'_, ReportExportCoordinator>,
    request: SessionReportExportRequestDto,
) -> Result<ReportExportReceiptDto, CommandErrorDto> {
    let request = request.try_into()?;
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let operation = coordinator
        .begin()
        .map_err(|_| CommandErrorDto::new("report-export-active"))?;
    tauri::async_runtime::spawn_blocking(move || {
        let cancellation = Arc::clone(&operation.cancellation);
        let result = export_session_report_through_port(
            &SqliteReportLibrary::new(path.clone()),
            &SqliteTrainingLibrary::new(path.clone()),
            &SqliteTrainingLibrary::new(path),
            &SelfContainedHtmlReportExporter,
            request,
            &cancellation,
        )
        .map(Into::into)
        .map_err(CommandErrorDto::from);
        drop(operation);
        result
    })
    .await
    .map_err(|_| CommandErrorDto::new("desktop-task-failed"))?
}

#[tauri::command]
fn cancel_report_export(
    coordinator: State<'_, ReportExportCoordinator>,
) -> Result<bool, CommandErrorDto> {
    coordinator
        .cancel()
        .map_err(|_| CommandErrorDto::new("report-export-state-unavailable"))
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
fn query_library_home(
    app: AppHandle,
    request: LibraryHomeRequestDto,
) -> Result<LibraryHomeDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let library = SqliteLibraryHome::new(path);
    build_library_home(&library, request.into())
        .map(LibraryHomeDto::from)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn save_exploration_workspace(
    app: AppHandle,
    destination: ExploreDestinationInputDto,
) -> Result<ExplorationWorkspaceDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let library = SqliteLibraryHome::new(path);
    save_workspace(&library, destination.into())
        .map(ExplorationWorkspaceDto::from)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
fn clear_exploration_workspace(app: AppHandle) -> Result<(), CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    clear_workspace(&SqliteLibraryHome::new(path)).map_err(CommandErrorDto::from)
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
fn query_source_acquisition_guides() -> Result<Vec<SourceAcquisitionGuideDto>, CommandErrorDto> {
    build_source_acquisition_guides(&PolarFlowSourceAcquisitionGuides)
        .map(|guides| guides.into_iter().map(Into::into).collect())
        .map_err(CommandErrorDto::from)
}

fn supported_locale(code: &str) -> Result<LocalePreference, CommandErrorDto> {
    LocalePreference::from_code(code).ok_or_else(|| CommandErrorDto::new("invalid-locale"))
}

fn map_invalid_application_preferences(error: InvalidApplicationPreferences) -> CommandErrorDto {
    CommandErrorDto::new(match error {
        InvalidApplicationPreferences::Version => "invalid-preference-version",
        InvalidApplicationPreferences::Locale => "invalid-locale",
        InvalidApplicationPreferences::Appearance => "invalid-appearance",
        InvalidApplicationPreferences::ContentZoom => "invalid-content-zoom",
    })
}

#[tauri::command]
async fn load_preferences(
    app: AppHandle,
    startup_recovery: State<'_, Arc<StartupLibraryRecovery>>,
    default_locale: String,
) -> Result<ApplicationPreferencesLoadDto, CommandErrorDto> {
    let default_locale = supported_locale(&default_locale)?;
    startup_recovery
        .await_ready()
        .await
        .map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    load_preferences_from_port(&SqliteApplicationPreferences::new(path), default_locale)
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
async fn save_preferences(
    app: AppHandle,
    startup_recovery: State<'_, Arc<StartupLibraryRecovery>>,
    preferences: ApplicationPreferencesInputDto,
) -> Result<ApplicationPreferencesDto, CommandErrorDto> {
    let preferences = ApplicationPreferences::try_from(preferences)
        .map_err(map_invalid_application_preferences)?;
    startup_recovery
        .await_ready()
        .await
        .map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    save_preferences_through_port(&SqliteApplicationPreferences::new(path), &preferences)
        .map_err(CommandErrorDto::from)?;
    Ok(preferences.into())
}

#[tauri::command]
async fn reset_preferences(
    app: AppHandle,
    startup_recovery: State<'_, Arc<StartupLibraryRecovery>>,
    default_locale: String,
) -> Result<ApplicationPreferencesLoadDto, CommandErrorDto> {
    let default_locale = supported_locale(&default_locale)?;
    startup_recovery
        .await_ready()
        .await
        .map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    reset_preferences_through_port(&SqliteApplicationPreferences::new(path), default_locale)
        .map(Into::into)
        .map_err(CommandErrorDto::from)
}

#[tauri::command]
async fn check_for_updates_on_launch(
    app: AppHandle,
    channel: State<'_, Arc<HttpsUpdateChannel>>,
    coordinator: State<'_, Arc<UpdateOperationCoordinator>>,
) -> Result<UpdateCheckOutcomeDto, CommandErrorDto> {
    let _operation = coordinator.reserve().await;
    check_updates(
        app,
        Arc::clone(channel.inner()),
        UpdateCheckTrigger::Scheduled,
    )
    .await
}

#[tauri::command]
async fn check_for_updates(
    app: AppHandle,
    channel: State<'_, Arc<HttpsUpdateChannel>>,
    coordinator: State<'_, Arc<UpdateOperationCoordinator>>,
) -> Result<UpdateCheckOutcomeDto, CommandErrorDto> {
    let _operation = coordinator.reserve().await;
    check_updates(app, Arc::clone(channel.inner()), UpdateCheckTrigger::Manual).await
}

async fn check_updates(
    app: AppHandle,
    channel: Arc<HttpsUpdateChannel>,
    trigger: UpdateCheckTrigger,
) -> Result<UpdateCheckOutcomeDto, CommandErrorDto> {
    let path = database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let installed_version = app.package_info().version.to_string();
    let checked_at = current_utc_datetime();
    tauri::async_runtime::spawn_blocking(move || {
        perform_update_check(
            channel.as_ref(),
            path,
            installed_version,
            checked_at,
            trigger,
        )
    })
    .await
    .map_err(|_| CommandErrorDto::new("desktop-task-failed"))?
}

async fn run_periodic_update_schedule<Task, TaskFuture>(interval: Duration, mut task: Task)
where
    Task: FnMut() -> TaskFuture,
    TaskFuture: Future<Output = ()>,
{
    loop {
        sleep(interval).await;
        task().await;
    }
}

fn start_periodic_update_checks(
    app: AppHandle,
    channel: Arc<HttpsUpdateChannel>,
    coordinator: Arc<UpdateOperationCoordinator>,
) {
    tauri::async_runtime::spawn(run_periodic_update_schedule(
        PERIODIC_UPDATE_CHECK_INTERVAL,
        move || {
            let app = app.clone();
            let channel = Arc::clone(&channel);
            let coordinator = Arc::clone(&coordinator);
            async move {
                let Some(_operation) = coordinator.try_reserve() else {
                    return;
                };
                if let Ok(outcome) =
                    check_updates(app.clone(), channel, UpdateCheckTrigger::Scheduled).await
                {
                    let _ = app.emit_to("main", UPDATE_CHECK_COMPLETED_EVENT, outcome);
                }
            }
        },
    ));
}

fn perform_update_check(
    channel: &impl UpdateChannelPort,
    database_path: PathBuf,
    installed_version: String,
    checked_at: String,
    trigger: UpdateCheckTrigger,
) -> Result<UpdateCheckOutcomeDto, CommandErrorDto> {
    let locale = load_update_locale(database_path.clone())?;
    let state = SqliteUpdateState::new(database_path);
    evaluate_updates(
        channel,
        &state,
        UpdateCheckContext {
            installed_version,
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
    coordinator: State<'_, Arc<UpdateOperationCoordinator>>,
    candidate_version: String,
) -> Result<(), CommandErrorDto> {
    let _operation = coordinator.reserve().await;
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
    coordinator: State<'_, Arc<UpdateOperationCoordinator>>,
    candidate_version: String,
) -> Result<String, CommandErrorDto> {
    let _operation = coordinator.reserve().await;
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

#[tauri::command]
async fn install_available_update(
    app: AppHandle,
    channel: State<'_, Arc<HttpsUpdateChannel>>,
    update_coordinator: State<'_, Arc<UpdateOperationCoordinator>>,
    import_coordinator: State<'_, ImportCoordinator>,
    candidate_version: String,
) -> Result<(), CommandErrorDto> {
    let _update_operation = update_coordinator.reserve().await;
    let _import_operation = import_coordinator
        .reserve_exclusive_operation()
        .map_err(map_exclusive_operation_error)?;
    let library_path =
        database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let executable =
        env::current_exe().map_err(|_| CommandErrorDto::new("update-installation-unavailable"))?;
    let current_application_path = resolve_update_application_path(&executable)
        .map_err(|_| CommandErrorDto::new("update-installation-unavailable"))?;
    let recovery_root = library_path
        .parent()
        .map(|parent| parent.join("update-recovery"))
        .ok_or_else(|| CommandErrorDto::new("library-unavailable"))?;
    let channel = Arc::clone(channel.inner());
    let authorization_path = library_path.clone();
    let installed_version = app.package_info().version.to_string();
    let authorization_installed_version = installed_version.clone();
    let authorization_channel = Arc::clone(&channel);
    let checked_at = current_utc_datetime();
    let authorization = tauri::async_runtime::spawn_blocking(move || {
        perform_update_authorization(
            authorization_channel.as_ref(),
            authorization_path,
            authorization_installed_version,
            checked_at,
            &candidate_version,
        )
    })
    .await
    .map_err(|_| CommandErrorDto::new("desktop-task-failed"))??;
    let package = download_verified_update(&app, channel.as_ref(), authorization)
        .await
        .map_err(map_update_package_error)?;
    let request = UpdateInstallationRequest {
        recovery_root,
        current_application_path,
        library_path,
        installed_version,
        prepared_at: current_utc_datetime(),
    };
    tauri::async_runtime::spawn_blocking(move || install_verified_update(&package, request))
        .await
        .map_err(|_| CommandErrorDto::new("desktop-task-failed"))?
        .map_err(map_update_installation_error)?;
    app.exit(0);
    Ok(())
}

fn perform_update_authorization(
    channel: &impl UpdateChannelPort,
    database_path: PathBuf,
    installed_version: String,
    checked_at: String,
    candidate_version: &str,
) -> Result<UpdateInstallationAuthorization, CommandErrorDto> {
    let locale = load_update_locale(database_path.clone())?;
    authorize_update(
        channel,
        &SqliteUpdateState::new(database_path),
        UpdateCheckContext {
            installed_version,
            library_schema_version: library_schema_version(),
            locale,
            checked_at,
            trigger: UpdateCheckTrigger::Manual,
        },
        candidate_version,
    )
    .map_err(CommandErrorDto::from)
}

fn load_update_locale(database_path: PathBuf) -> Result<LocalePreference, CommandErrorDto> {
    load_preferences_from_port(
        &SqliteApplicationPreferences::new(database_path),
        LocalePreference::EnUs,
    )
    .map(|loaded| loaded.preferences.locale)
    .map_err(|_| CommandErrorDto::new("update-state-unavailable"))
}

fn map_exclusive_operation_error(error: ApplicationError) -> CommandErrorDto {
    match error {
        ApplicationError::ExclusiveOperationAlreadyActive => {
            CommandErrorDto::new("desktop-operation-active")
        }
        _ => CommandErrorDto::new("desktop-operation-coordination-failed"),
    }
}

fn map_update_package_error(error: UpdatePackageError) -> CommandErrorDto {
    let code = match error {
        UpdatePackageError::TrustUnavailable => "update-package-trust-unavailable",
        UpdatePackageError::InvalidAuthorization => "update-package-authorization-invalid",
        UpdatePackageError::NativeUpdater => "update-native-installer-failed",
        UpdatePackageError::DownloadUnavailable => "update-download-unavailable",
        UpdatePackageError::PackageUntrusted | UpdatePackageError::DigestMismatch => {
            "update-package-untrusted"
        }
    };
    CommandErrorDto::new(code)
}

fn map_update_installation_error(error: UpdateInstallationError) -> CommandErrorDto {
    match error {
        UpdateInstallationError::Package(error) => map_update_package_error(error),
        UpdateInstallationError::Watchdog(_) => CommandErrorDto::new("update-watchdog-failed"),
        UpdateInstallationError::Recovery(_) => CommandErrorDto::new("update-recovery-failed"),
    }
}

#[tauri::command]
async fn confirm_update_recovery_startup(
    app: AppHandle,
    pending: State<'_, PendingUpdateRecoveryConfirmation>,
) -> Result<Option<UpdateRecoveryOutcomeDto>, CommandErrorDto> {
    let candidate = pending
        .take()
        .map_err(|_| CommandErrorDto::new("update-recovery-confirmation-failed"))?;
    let library_path = database_path(&app).map_err(|_| {
        if let Some(candidate) = candidate.clone() {
            pending.restore(candidate);
        }
        CommandErrorDto::new("library-unavailable")
    })?;
    let recovery_root = library_path
        .parent()
        .map(|parent| parent.join("update-recovery"))
        .ok_or_else(|| {
            if let Some(candidate) = candidate.clone() {
                pending.restore(candidate);
            }
            CommandErrorDto::new("library-unavailable")
        })?;
    if !recovery_root.exists() {
        return if let Some(candidate) = candidate {
            pending.restore(candidate);
            Err(CommandErrorDto::new("update-recovery-confirmation-failed"))
        } else {
            Ok(None)
        };
    }
    let executable = env::current_exe().map_err(|_| {
        if let Some(candidate) = candidate.clone() {
            pending.restore(candidate);
        }
        CommandErrorDto::new("update-recovery-outcome-failed")
    })?;
    let current_application_path = resolve_update_application_path(&executable).map_err(|_| {
        if let Some(candidate) = candidate.clone() {
            pending.restore(candidate);
        }
        CommandErrorDto::new("update-recovery-outcome-failed")
    })?;

    if let Some(candidate) = candidate.as_ref() {
        if !pending
            .has_matching_lease(candidate)
            .map_err(|_| CommandErrorDto::new("update-recovery-confirmation-failed"))?
        {
            pending.restore(candidate.clone());
            return Err(CommandErrorDto::new("update-recovery-confirmation-failed"));
        }
        let recovery_root_for_confirmation = recovery_root.clone();
        let executable_for_confirmation = executable.clone();
        let library_path_for_confirmation = library_path.clone();
        let candidate_for_confirmation = candidate.clone();
        let app_version = app.package_info().version.to_string();
        match tauri::async_runtime::spawn_blocking(move || {
            confirm_active_update_recovery(
                &recovery_root_for_confirmation,
                &candidate_for_confirmation.recovery_id,
                &executable_for_confirmation,
                &app_version,
                &library_path_for_confirmation,
                library_schema_version(),
                &candidate_for_confirmation.launch_nonce,
            )
        })
        .await
        {
            Ok(Ok(())) => pending
                .release_lease(candidate)
                .map_err(|_| CommandErrorDto::new("update-recovery-confirmation-failed"))?,
            Ok(Err(_)) => {
                pending.restore(candidate.clone());
                return Err(CommandErrorDto::new("update-recovery-confirmation-failed"));
            }
            Err(_) => {
                pending.restore(candidate.clone());
                return Err(CommandErrorDto::new("desktop-task-failed"));
            }
        }
    }

    let wait_for_terminal_outcome = candidate.is_some();
    tauri::async_runtime::spawn_blocking(move || {
        retain_update_recovery_outcome_after_startup(
            &recovery_root,
            &current_application_path,
            &library_path,
            wait_for_terminal_outcome,
        )
    })
    .await
    .map_err(|_| CommandErrorDto::new("desktop-task-failed"))?
    .map(|outcome| outcome.map(UpdateRecoveryOutcomeDto::from))
    .map_err(|_| CommandErrorDto::new("update-recovery-outcome-failed"))
}

fn retain_update_recovery_outcome_after_startup(
    recovery_root: &Path,
    application_path: &Path,
    library_path: &Path,
    wait_for_terminal_outcome: bool,
) -> Result<Option<UpdateRecoveryOutcome>, UpdateRecoveryError> {
    let deadline = Instant::now() + UPDATE_RECOVERY_STARTUP_MAINTENANCE_TIMEOUT;
    loop {
        match maintain_update_recovery(recovery_root, application_path, library_path)? {
            UpdateRecoveryMaintenance::OutcomeRetained(outcome) => return Ok(Some(outcome)),
            UpdateRecoveryMaintenance::NoTerminalOutcome => return Ok(None),
            UpdateRecoveryMaintenance::Deferred
                if wait_for_terminal_outcome && Instant::now() < deadline =>
            {
                thread::sleep(UPDATE_RECOVERY_STARTUP_MAINTENANCE_POLL_INTERVAL);
            }
            UpdateRecoveryMaintenance::Deferred => return Ok(None),
        }
    }
}

#[tauri::command]
async fn acknowledge_update_recovery_notice(app: AppHandle) -> Result<bool, CommandErrorDto> {
    let library_path =
        database_path(&app).map_err(|_| CommandErrorDto::new("library-unavailable"))?;
    let recovery_root = library_path
        .parent()
        .map(|parent| parent.join("update-recovery"))
        .ok_or_else(|| CommandErrorDto::new("library-unavailable"))?;
    if !recovery_root.exists() {
        return Ok(false);
    }
    tauri::async_runtime::spawn_blocking(move || {
        acknowledge_retained_update_recovery_outcome(&recovery_root)
    })
    .await
    .map_err(|_| CommandErrorDto::new("desktop-task-failed"))?
    .map_err(|_| CommandErrorDto::new("update-recovery-outcome-failed"))
}

fn current_utc_datetime() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

fn application_update_channel() -> HttpsUpdateChannel {
    let public_channel = public_update_channel_from_build_configuration(
        option_env!("FITFREED_PUBLIC_UPDATE_CONTRACT"),
        option_env!("FITFREED_PUBLIC_UPDATE_ENDPOINT"),
        option_env!("FITFREED_PUBLIC_UPDATE_TRUST"),
    )
    .expect("invalid public update channel configuration");

    #[cfg(feature = "e2e")]
    if let Some(channel) = instrumented_update_channel_from_environment()
        .expect("invalid instrumented update channel configuration")
    {
        assert!(
            public_channel.is_none(),
            "instrumented and public update channels cannot coexist"
        );
        return channel;
    }

    public_channel.unwrap_or_else(HttpsUpdateChannel::unconfigured)
}

fn public_update_channel_from_build_configuration(
    contract: Option<&str>,
    endpoint: Option<&str>,
    trust: Option<&str>,
) -> Result<Option<HttpsUpdateChannel>, ()> {
    let values = [contract, endpoint, trust];
    let configured_values = values.iter().filter(|value| value.is_some()).count();
    if configured_values == 0 {
        return Ok(None);
    }
    if configured_values != values.len() || contract != Some("stable-v2") {
        return Err(());
    }
    let trusted_public_keys: BTreeMap<String, String> =
        serde_json::from_str(trust.ok_or(())?).map_err(|_| ())?;
    HttpsUpdateChannel::configured_stable(
        endpoint.ok_or(())?,
        trusted_public_keys,
        current_update_target().map_err(|_| ())?,
    )
    .map(Some)
    .map_err(|_| ())
}

#[cfg(feature = "e2e")]
fn instrumented_update_channel_from_environment() -> Result<Option<HttpsUpdateChannel>, ()> {
    const CONTRACT: &str = "FITFREED_E2E_UPDATE_CONTRACT";
    const ENDPOINT: &str = "FITFREED_E2E_UPDATE_ENDPOINT";
    const KEY_ID: &str = "FITFREED_E2E_UPDATE_KEY_ID";
    const PUBLIC_KEY: &str = "FITFREED_E2E_UPDATE_PUBLIC_KEY";
    const ROOT_CERTIFICATE_PATH: &str = "FITFREED_E2E_UPDATE_ROOT_CERTIFICATE_PATH";
    let names = [
        CONTRACT,
        ENDPOINT,
        KEY_ID,
        PUBLIC_KEY,
        ROOT_CERTIFICATE_PATH,
    ];
    let configured_values = names
        .iter()
        .filter(|name| env::var_os(name).is_some())
        .count();
    if configured_values == 0 {
        return Ok(None);
    }
    if configured_values != names.len() {
        return Err(());
    }
    let contract = env::var(CONTRACT).map_err(|_| ())?;
    let endpoint = env::var(ENDPOINT).map_err(|_| ())?;
    let key_id = env::var(KEY_ID).map_err(|_| ())?;
    let public_key = env::var(PUBLIC_KEY).map_err(|_| ())?;
    let root_certificate_path = env::var(ROOT_CERTIFICATE_PATH).map_err(|_| ())?;
    let root_certificate = fs::read(root_certificate_path).map_err(|_| ())?;
    let target = current_update_target().map_err(|_| ())?;
    let trust = BTreeMap::from([(key_id, public_key)]);
    match contract.as_str() {
        "private-alpha-v1" => HttpsUpdateChannel::configured_for_instrumented_e2e(
            &endpoint,
            trust,
            target,
            root_certificate,
        ),
        "stable-v2" => HttpsUpdateChannel::configured_stable_for_instrumented_e2e(
            &endpoint,
            trust,
            target,
            root_certificate,
        ),
        _ => return Err(()),
    }
    .map(Some)
    .map_err(|_| ())
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
    UpdateRecoveryCandidate(CandidateStartup),
    UpdateRecoveryWatchdog { installed_application: PathBuf },
    InvalidPrivateMode,
}

fn startup_mode(arguments: &[OsString]) -> StartupMode {
    match arguments.get(1).and_then(|argument| argument.to_str()) {
        Some(UPDATE_RECOVERY_WATCHDOG_ARGUMENT) => match arguments {
            [_, _, installed_application] if Path::new(installed_application).is_absolute() => {
                StartupMode::UpdateRecoveryWatchdog {
                    installed_application: PathBuf::from(installed_application),
                }
            }
            _ => StartupMode::InvalidPrivateMode,
        },
        Some(UPDATE_RECOVERY_CANDIDATE_ARGUMENT) => match arguments {
            [_, _, recovery_id, launch_nonce]
                if recovery_id.to_str().is_some_and(valid_recovery_id)
                    && launch_nonce.to_str().is_some_and(valid_recovery_id) =>
            {
                StartupMode::UpdateRecoveryCandidate(CandidateStartup {
                    recovery_id: recovery_id.to_string_lossy().into_owned(),
                    launch_nonce: launch_nonce.to_string_lossy().into_owned(),
                })
            }
            _ => StartupMode::InvalidPrivateMode,
        },
        _ => StartupMode::Desktop,
    }
}

fn valid_recovery_id(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

#[derive(Default)]
struct PendingUpdateRecoveryConfirmation {
    candidate: Mutex<Option<CandidateStartup>>,
    lease: Mutex<Option<UpdateRecoveryCandidateLease>>,
}

impl PendingUpdateRecoveryConfirmation {
    fn new(candidate: Option<CandidateStartup>) -> Self {
        Self {
            candidate: Mutex::new(candidate),
            lease: Mutex::new(None),
        }
    }

    fn candidate(&self) -> Result<Option<CandidateStartup>, ()> {
        self.candidate
            .lock()
            .map(|candidate| candidate.clone())
            .map_err(|_| ())
    }

    fn hold_lease(&self, lease: UpdateRecoveryCandidateLease) -> Result<(), ()> {
        let mut held = self.lease.lock().map_err(|_| ())?;
        if held.is_some() {
            return Err(());
        }
        *held = Some(lease);
        Ok(())
    }

    fn take(&self) -> Result<Option<CandidateStartup>, ()> {
        self.candidate
            .lock()
            .map(|mut candidate| candidate.take())
            .map_err(|_| ())
    }

    fn has_matching_lease(&self, candidate: &CandidateStartup) -> Result<bool, ()> {
        self.lease.lock().map_err(|_| ()).map(|lease| {
            lease.as_ref().is_some_and(|lease| {
                lease.recovery_id() == candidate.recovery_id
                    && lease.launch_nonce() == candidate.launch_nonce
            })
        })
    }

    fn restore(&self, candidate: CandidateStartup) {
        if let Ok(mut pending) = self.candidate.lock() {
            *pending = Some(candidate);
        }
    }

    fn release_lease(&self, candidate: &CandidateStartup) -> Result<(), ()> {
        let mut held = self.lease.lock().map_err(|_| ())?;
        if !held.as_ref().is_some_and(|lease| {
            lease.recovery_id() == candidate.recovery_id
                && lease.launch_nonce() == candidate.launch_nonce
        }) {
            return Err(());
        }
        held.take();
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct CandidateStartup {
    recovery_id: String,
    launch_nonce: String,
}

fn start_library_recovery(library_path: PathBuf, startup_recovery: Arc<StartupLibraryRecovery>) {
    tauri::async_runtime::spawn(async move {
        let succeeded = tauri::async_runtime::spawn_blocking(move || {
            recover_interrupted_imports(&library_path)
        })
        .await
        .is_ok_and(|result| result.is_ok());
        startup_recovery.complete(succeeded);
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let interactive_shell_signal = InteractiveShellSignal::default();
    let startup_recovery = Arc::new(StartupLibraryRecovery::default());
    let pending_recovery_confirmation = match startup_mode(&env::args_os().collect::<Vec<_>>()) {
        StartupMode::Desktop => None,
        StartupMode::UpdateRecoveryCandidate(candidate) => {
            let succeeded = await_update_recovery_candidate_go(
                &candidate.recovery_id,
                &candidate.launch_nonce,
                io::stdin(),
            )
            .is_ok();
            if !succeeded {
                process::exit(1);
            }
            #[cfg(feature = "e2e")]
            if env::var_os("FITFREED_E2E_REJECT_UPDATE_CANDIDATE").is_some() {
                process::exit(1);
            }
            Some(candidate)
        }
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
    };
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build());
    #[cfg(feature = "e2e")]
    let builder = builder
        .plugin(tauri_plugin_wdio_webdriver::init())
        .plugin(tauri_plugin_wdio::init());
    let update_channel = Arc::new(application_update_channel());
    let update_coordinator = Arc::new(UpdateOperationCoordinator::default());
    builder
        .manage(ImportCoordinator::default())
        .manage(ReportExportCoordinator::default())
        .manage(interactive_shell_signal)
        .manage(Arc::clone(&startup_recovery))
        .manage(PendingUpdateRecoveryConfirmation::new(
            pending_recovery_confirmation,
        ))
        .manage(Arc::clone(&update_channel))
        .manage(Arc::clone(&update_coordinator))
        .setup(move |app| {
            let library_path = database_path(app.handle()).map_err(std::io::Error::other)?;
            let pending = app.state::<PendingUpdateRecoveryConfirmation>();
            if let Some(candidate) = pending
                .candidate()
                .map_err(|_| std::io::Error::other("candidate recovery state is unavailable"))?
            {
                let recovery_root = library_path
                    .parent()
                    .ok_or_else(|| std::io::Error::other("candidate library path is invalid"))?
                    .join("update-recovery");
                let executable = env::current_exe()?;
                let lease = acquire_update_recovery_candidate_lease(
                    &recovery_root,
                    &candidate.recovery_id,
                    &candidate.launch_nonce,
                    &executable,
                )
                .map_err(|_| std::io::Error::other("candidate recovery validation failed"))?;
                pending.hold_lease(lease).map_err(|_| {
                    std::io::Error::other("candidate recovery state is unavailable")
                })?;
            }
            start_library_recovery(library_path, Arc::clone(&startup_recovery));
            start_periodic_update_checks(
                app.handle().clone(),
                Arc::clone(&update_channel),
                Arc::clone(&update_coordinator),
            );
            app.state::<InteractiveShellSignal>()
                .record_setup_complete()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            import_archive,
            cancel_import,
            query_activity_overview,
            query_activity_comparison,
            query_training_overview,
            query_training_comparison,
            query_training_sessions,
            query_training_session_calendar,
            query_training_session_selection,
            query_training_session_structure,
            query_training_session_routes,
            query_training_route_points,
            query_training_session_signals,
            query_training_session_zones,
            query_training_session_provenance,
            query_training_signal_samples,
            query_training_session_segmentation,
            create_training_segment_criterion,
            update_training_segment_criterion,
            apply_training_segment_criterion,
            remove_training_segment_criterion,
            move_training_segment_criterion,
            load_training_discovery_workspace,
            save_training_discovery_workspace,
            clear_training_discovery_workspace,
            query_training_sports,
            save_training_sport_classification,
            create_session_report,
            update_session_report,
            list_reports,
            load_report_definition,
            resolve_session_report,
            export_session_report,
            cancel_report_export,
            query_sleep_overview,
            query_sleep_comparison,
            query_sleep_detail,
            query_recovery_overview,
            query_recovery_comparison,
            query_recovery_detail,
            query_longitudinal_overview,
            query_longitudinal_comparison,
            query_library_home,
            save_exploration_workspace,
            clear_exploration_workspace,
            query_latest_import_outcome,
            query_source_acquisition_guides,
            load_preferences,
            save_preferences,
            reset_preferences,
            check_for_updates_on_launch,
            check_for_updates,
            dismiss_available_update,
            postpone_available_update,
            install_available_update,
            confirm_update_recovery_startup,
            acknowledge_update_recovery_notice,
            report_interactive_shell
        ])
        .run(tauri::generate_context!())
        .expect("failed to run FitFreed");
}

#[cfg(test)]
mod tests {
    use std::{
        collections::BTreeMap,
        fs::File,
        sync::atomic::{AtomicUsize, Ordering},
    };

    use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
    use fitfreed_application::{
        AuthenticatedUpdateSnapshot, LocalizedUpdateText, UpdateArtifact, UpdateChannelRead,
        UpdateRelease,
    };
    use minisign::KeyPair;
    use tempfile::TempDir;
    use tokio::sync::Notify;

    use super::*;

    struct FixedUpdateChannel(UpdateChannelRead);

    impl UpdateChannelPort for FixedUpdateChannel {
        fn fetch_update_snapshot(&self) -> Result<UpdateChannelRead, String> {
            Ok(self.0.clone())
        }
    }

    fn synthetic_public_update_key() -> String {
        let key_pair = KeyPair::generate_unencrypted_keypair().expect("synthetic key pair");
        let public_key = key_pair
            .pk
            .to_box()
            .expect("synthetic public key box")
            .to_string();
        BASE64.encode(public_key)
    }

    #[test]
    fn public_update_channel_is_absent_or_complete_and_never_partial() {
        assert!(
            public_update_channel_from_build_configuration(None, None, None)
                .expect("absent configuration")
                .is_none()
        );

        let public_key = synthetic_public_update_key();
        let trust =
            serde_json::to_string(&BTreeMap::from([("stable.2026-01".to_owned(), public_key)]))
                .expect("synthetic trust JSON");
        assert!(public_update_channel_from_build_configuration(
            Some("stable-v2"),
            Some("https://fitfreed.org/updates/stable.json"),
            Some(&trust),
        )
        .expect("complete public configuration")
        .is_some());

        for incomplete in [
            (Some("stable-v2"), None, None),
            (
                Some("stable-v2"),
                Some("https://updates.invalid/stable.json"),
                None,
            ),
        ] {
            assert!(public_update_channel_from_build_configuration(
                incomplete.0,
                incomplete.1,
                incomplete.2,
            )
            .is_err());
        }
    }

    #[test]
    fn public_update_channel_rejects_an_unknown_contract_or_invalid_trust() {
        let public_key = synthetic_public_update_key();
        let trust =
            serde_json::to_string(&BTreeMap::from([("stable.2026-01".to_owned(), public_key)]))
                .expect("synthetic trust JSON");
        assert!(public_update_channel_from_build_configuration(
            Some("private-alpha-v1"),
            Some("https://updates.invalid/stable.json"),
            Some(&trust),
        )
        .is_err());
        assert!(public_update_channel_from_build_configuration(
            Some("stable-v2"),
            Some("http://updates.invalid/stable.json"),
            Some(&trust),
        )
        .is_err());
        assert!(public_update_channel_from_build_configuration(
            Some("stable-v2"),
            Some("https://updates.invalid/stable.json"),
            Some(r#"{"STABLE":"invalid"}"#),
        )
        .is_err());
    }

    #[test]
    fn host_update_check_uses_the_installed_build_schema_and_persisted_locale() {
        let directory = TempDir::new().expect("temporary directory");
        let database_path = directory.path().join("library.sqlite");
        save_preferences_through_port(
            &SqliteApplicationPreferences::new(database_path.clone()),
            &ApplicationPreferences::defaults(LocalePreference::EsEs),
        )
        .expect("Spanish preferences");
        let channel = FixedUpdateChannel(UpdateChannelRead::Authenticated(Box::new(
            authenticated_update_snapshot(),
        )));

        let outcome = perform_update_check(
            &channel,
            database_path,
            env!("CARGO_PKG_VERSION").to_owned(),
            "2026-08-16T12:00:00Z".to_owned(),
            UpdateCheckTrigger::Manual,
        )
        .expect("update outcome");
        let json = serde_json::to_value(outcome).expect("update outcome JSON");

        assert_eq!(json["installedVersion"], env!("CARGO_PKG_VERSION"));
        assert_eq!(json["status"], "available");
        assert_eq!(
            json["release"]["targetLibrarySchemaVersion"],
            library_schema_version()
        );
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
            env!("CARGO_PKG_VERSION").to_owned(),
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
    fn host_maps_each_invalid_application_preference_to_a_stable_code() {
        for (error, code) in [
            (
                InvalidApplicationPreferences::Version,
                "invalid-preference-version",
            ),
            (InvalidApplicationPreferences::Locale, "invalid-locale"),
            (
                InvalidApplicationPreferences::Appearance,
                "invalid-appearance",
            ),
            (
                InvalidApplicationPreferences::ContentZoom,
                "invalid-content-zoom",
            ),
        ] {
            assert_eq!(
                serde_json::to_value(map_invalid_application_preferences(error))
                    .expect("command error JSON")["code"],
                code
            );
        }
    }

    #[tokio::test(start_paused = true)]
    async fn periodic_update_schedule_waits_a_full_day_and_then_repeats() {
        let expected_interval = Duration::from_secs(24 * 60 * 60);
        assert_eq!(PERIODIC_UPDATE_CHECK_INTERVAL, expected_interval);
        let executions = Arc::new(AtomicUsize::new(0));
        let observed_executions = Arc::clone(&executions);
        let schedule = tokio::spawn(run_periodic_update_schedule(
            PERIODIC_UPDATE_CHECK_INTERVAL,
            move || {
                let executions = Arc::clone(&executions);
                async move {
                    executions.fetch_add(1, Ordering::SeqCst);
                }
            },
        ));
        tokio::task::yield_now().await;

        tokio::time::advance(expected_interval - Duration::from_secs(1)).await;
        tokio::task::yield_now().await;
        assert_eq!(observed_executions.load(Ordering::SeqCst), 0);

        tokio::time::advance(Duration::from_secs(1)).await;
        tokio::task::yield_now().await;
        assert_eq!(observed_executions.load(Ordering::SeqCst), 1);

        tokio::time::advance(expected_interval).await;
        tokio::task::yield_now().await;
        assert_eq!(observed_executions.load(Ordering::SeqCst), 2);

        schedule.abort();
    }

    #[tokio::test(start_paused = true)]
    async fn periodic_update_schedule_never_catches_up_with_a_request_burst() {
        let executions = Arc::new(AtomicUsize::new(0));
        let task_started = Arc::new(Notify::new());
        let release_task = Arc::new(Notify::new());
        let observed_executions = Arc::clone(&executions);
        let observed_start = Arc::clone(&task_started);
        let observed_release = Arc::clone(&release_task);
        let schedule = tokio::spawn(run_periodic_update_schedule(
            PERIODIC_UPDATE_CHECK_INTERVAL,
            move || {
                let executions = Arc::clone(&executions);
                let task_started = Arc::clone(&task_started);
                let release_task = Arc::clone(&release_task);
                async move {
                    executions.fetch_add(1, Ordering::SeqCst);
                    task_started.notify_one();
                    release_task.notified().await;
                }
            },
        ));
        tokio::task::yield_now().await;

        tokio::time::advance(PERIODIC_UPDATE_CHECK_INTERVAL).await;
        observed_start.notified().await;
        tokio::time::advance(Duration::from_secs(3 * 24 * 60 * 60)).await;
        tokio::task::yield_now().await;
        assert_eq!(observed_executions.load(Ordering::SeqCst), 1);

        observed_release.notify_one();
        tokio::task::yield_now().await;
        tokio::time::advance(PERIODIC_UPDATE_CHECK_INTERVAL - Duration::from_secs(1)).await;
        tokio::task::yield_now().await;
        assert_eq!(observed_executions.load(Ordering::SeqCst), 1);

        tokio::time::advance(Duration::from_secs(1)).await;
        tokio::task::yield_now().await;
        assert_eq!(observed_executions.load(Ordering::SeqCst), 2);

        schedule.abort();
    }

    #[tokio::test]
    async fn periodic_update_operation_is_skipped_while_another_update_operation_is_active() {
        let coordinator = UpdateOperationCoordinator::default();
        let active_operation = coordinator.reserve().await;

        assert!(coordinator.try_reserve().is_none());

        drop(active_operation);
        assert!(coordinator.try_reserve().is_some());
    }

    #[tokio::test]
    async fn startup_library_recovery_releases_waiters_only_after_success() {
        let recovery = Arc::new(StartupLibraryRecovery::default());
        let waiting_recovery = Arc::clone(&recovery);
        let waiter = tokio::spawn(async move { waiting_recovery.await_ready().await });

        tokio::task::yield_now().await;
        assert!(!waiter.is_finished());
        recovery.complete(true);
        assert!(waiter.await.expect("recovery waiter should finish").is_ok());
        assert!(recovery.await_ready().await.is_ok());

        let failed_recovery = StartupLibraryRecovery::default();
        failed_recovery.complete(false);
        assert!(failed_recovery.await_ready().await.is_err());
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

    #[test]
    fn interactive_shell_signal_is_privacy_safe_and_emitted_once() {
        let signal = InteractiveShellSignal::default();
        signal
            .record_setup_complete()
            .expect("setup timing should be recorded");
        let renderer_startup_milliseconds = RendererStartupMilliseconds {
            locale_ready: 1.0,
            signal: 2.0,
        };
        let mut output = Vec::new();

        assert!(write_interactive_shell_signal(
            &signal,
            renderer_startup_milliseconds,
            &mut output
        )
        .expect("first signal"));
        assert!(!write_interactive_shell_signal(
            &signal,
            renderer_startup_milliseconds,
            &mut output
        )
        .expect("repeat signal"));

        let line = String::from_utf8(output).expect("UTF-8 signal");
        let payload: serde_json::Value = serde_json::from_str(line.trim()).expect("JSON signal");
        assert_eq!(payload["format"], "org.fitfreed.startup-signal");
        assert_eq!(payload["schemaVersion"], 2);
        assert_eq!(payload["event"], "interactive-shell");
        assert_eq!(payload["applicationVersion"], env!("CARGO_PKG_VERSION"));
        assert!(payload["sourceRevision"].is_string());
        assert!(payload["sourceTreeClean"].is_boolean());
        assert_eq!(payload.as_object().map(|object| object.len()), Some(8));
        assert!(payload["hostStartupMilliseconds"]["setupComplete"].is_number());
        assert!(payload["hostStartupMilliseconds"]["signal"].is_number());
        assert!(payload["hostStartupMilliseconds"]["signal"]
            .as_f64()
            .zip(payload["hostStartupMilliseconds"]["setupComplete"].as_f64())
            .is_some_and(|(host_signal, setup_complete)| host_signal >= setup_complete));
        assert_eq!(
            payload["hostStartupMilliseconds"]
                .as_object()
                .map(|object| object.len()),
            Some(2)
        );
        assert_eq!(payload["rendererStartupMilliseconds"]["localeReady"], 1.0);
        assert_eq!(payload["rendererStartupMilliseconds"]["signal"], 2.0);
        assert_eq!(
            payload["rendererStartupMilliseconds"]
                .as_object()
                .map(|object| object.len()),
            Some(2)
        );
        assert_eq!(line.lines().count(), 1);
        assert!(!line.contains("/Users/"));
    }

    #[test]
    fn interactive_shell_signal_rejects_missing_or_invalid_timings() {
        let signal = InteractiveShellSignal::default();
        let valid_renderer_timings = RendererStartupMilliseconds {
            locale_ready: 1.0,
            signal: 2.0,
        };
        let mut output = Vec::new();

        assert!(
            write_interactive_shell_signal(&signal, valid_renderer_timings, &mut output).is_err()
        );
        signal
            .record_setup_complete()
            .expect("setup timing should be recorded");
        assert!(write_interactive_shell_signal(
            &signal,
            RendererStartupMilliseconds {
                locale_ready: f64::NAN,
                signal: 2.0,
            },
            &mut output,
        )
        .is_err());
        assert!(output.is_empty());
        assert!(
            write_interactive_shell_signal(&signal, valid_renderer_timings, &mut output)
                .expect("valid timing should remain reportable")
        );
    }

    #[test]
    fn routes_only_an_exact_candidate_recovery_identifier_into_desktop_startup() {
        let executable = OsString::from("fitfreed");
        let argument = OsString::from(UPDATE_RECOVERY_CANDIDATE_ARGUMENT);
        let recovery_id = OsString::from("a".repeat(64));
        let launch_nonce = OsString::from("b".repeat(64));

        assert!(matches!(
            startup_mode(&[
                executable.clone(),
                argument.clone(),
                recovery_id,
                launch_nonce
            ]),
            StartupMode::UpdateRecoveryCandidate(_)
        ));
        assert!(matches!(
            startup_mode(&[
                executable.clone(),
                argument.clone(),
                OsString::from("a".repeat(64)),
                OsString::from("A".repeat(64))
            ]),
            StartupMode::InvalidPrivateMode
        ));
        assert!(matches!(
            startup_mode(&[
                executable,
                argument,
                OsString::from("too-short"),
                OsString::from("b".repeat(64))
            ]),
            StartupMode::InvalidPrivateMode
        ));
    }

    #[test]
    fn serializes_candidate_confirmation_claims_and_restores_failed_attempts() {
        let recovery_id = "a".repeat(64);
        let candidate = CandidateStartup {
            recovery_id,
            launch_nonce: "b".repeat(64),
        };
        let pending = PendingUpdateRecoveryConfirmation::new(Some(candidate.clone()));

        assert_eq!(pending.has_matching_lease(&candidate), Ok(false));
        assert_eq!(pending.take(), Ok(Some(candidate.clone())));
        assert_eq!(pending.take(), Ok(None));

        pending.restore(candidate.clone());
        assert_eq!(pending.take(), Ok(Some(candidate)));
    }

    #[test]
    fn releases_only_the_candidate_lease_bound_to_the_confirmed_claim() {
        let directory = TempDir::new().expect("temporary directory");
        let candidate = CandidateStartup {
            recovery_id: "a".repeat(64),
            launch_nonce: "b".repeat(64),
        };
        let pending = PendingUpdateRecoveryConfirmation::new(Some(candidate.clone()));
        pending
            .hold_lease(UpdateRecoveryCandidateLease::for_test(
                File::create(directory.path().join("candidate.lock")).expect("candidate lock"),
                candidate.recovery_id.clone(),
                candidate.launch_nonce.clone(),
            ))
            .expect("held candidate lease");
        let different = CandidateStartup {
            recovery_id: "c".repeat(64),
            launch_nonce: "d".repeat(64),
        };

        assert_eq!(pending.release_lease(&different), Err(()));
        assert_eq!(pending.has_matching_lease(&candidate), Ok(true));
        assert_eq!(pending.release_lease(&candidate), Ok(()));
        assert_eq!(pending.has_matching_lease(&candidate), Ok(false));
    }

    #[test]
    fn coordinates_cancellation_and_releases_each_report_export_operation() {
        let coordinator = ReportExportCoordinator::default();
        assert_eq!(coordinator.cancel(), Ok(false));

        let operation = coordinator.begin().expect("first report export");
        assert!(coordinator.begin().is_err());
        assert_eq!(coordinator.cancel(), Ok(true));
        assert!(operation.cancellation.is_cancelled());

        drop(operation);
        let next = coordinator.begin().expect("next report export");
        assert!(!next.cancellation.is_cancelled());
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
