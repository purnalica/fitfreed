import {
  lazy,
  type FormEvent,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Channel, invoke } from "@tauri-apps/api/core";
import "./App.css";
import { chooseZipArchive } from "./infrastructure/archive-picker";
import { openOfficialSourceLink } from "./infrastructure/official-source-link";
import { catalogs, type Locale } from "./locales/catalogs";
import type {
  ActivityDateRange,
  ActivityDayAvailability,
  ActivityOverview,
} from "./presentation/activity-insights";
import { commandErrorCode } from "./presentation/command-error";
import type {
  ExplorerNavigationRequest,
  TrainingNavigationRequest,
} from "./presentation/explorer-navigation";
import { WorkspaceNavigation } from "./presentation/WorkspaceNavigation";
import {
  applyApplicationPreferences,
  type ApplicationPreferences,
  type ApplicationPreferencesLoad,
} from "./presentation/application-preferences";
import {
  SettingsPanel,
  type SettingsWorkspace,
} from "./presentation/SettingsPanel";
import {
  ApplicationShell,
  type ApplicationHome,
} from "./presentation/ApplicationShell";
import type {
  ExploreDestination,
  LibraryHome,
} from "./presentation/library-home";
import { LibraryHomePanel } from "./presentation/LibraryHomePanel";
import type { SourceAcquisitionGuide } from "./presentation/source-acquisition";
import { SourcesPanel } from "./presentation/SourcesPanel";
import type { ReportSourceTarget } from "./presentation/report-navigation";
import type { ReportStartOrigin } from "./presentation/session-report";
import { LoadingSurface } from "./presentation/LoadingSurface";
import {
  RangeFilterActions,
  type RangeOperation,
} from "./presentation/RangeFilterActions";
import { restoreFocusAfterReveal } from "./presentation/focus-restoration";
import { APPLICATION_ERROR_ID, useInvalidForm } from "./presentation/useInvalidForm";

const rendererStartedAt = performance.now();
const INTERACTIVE_SHELL_FRAME_TIMEOUT_MILLISECONDS = 1_000;

const ActivityComparisonPanel = lazy(() =>
  import("./presentation/ActivityComparisonPanel").then((module) => ({
    default: module.ActivityComparisonPanel,
  }))
);
const TrainingInsightsPanel = lazy(() =>
  import("./presentation/TrainingInsightsPanel").then((module) => ({
    default: module.TrainingInsightsPanel,
  }))
);
const ReportsPanel = lazy(() =>
  import("./presentation/ReportsPanel").then((module) => ({
    default: module.ReportsPanel,
  }))
);
const LongitudinalInsightsPanel = lazy(() =>
  import("./presentation/LongitudinalInsightsPanel").then((module) => ({
    default: module.LongitudinalInsightsPanel,
  }))
);
const RecoveryInsightsPanel = lazy(() =>
  import("./presentation/RecoveryInsightsPanel").then((module) => ({
    default: module.RecoveryInsightsPanel,
  }))
);
const SleepInsightsPanel = lazy(() =>
  import("./presentation/SleepInsightsPanel").then((module) => ({
    default: module.SleepInsightsPanel,
  }))
);
const UpdatePanel = lazy(() =>
  import("./presentation/UpdatePanel").then((module) => ({
    default: module.UpdatePanel,
  }))
);

type CountMessageKey = keyof (typeof catalogs)["en-US"]["counts"];
type ActivityWorkspace = "history" | "comparison";

interface ImportReport {
  exactRepeat: boolean;
  recognizedArtifacts: number;
  newObservations: number;
  equivalentObservations: number;
  enrichedObservations: number;
  amendedObservations: number;
  preservedObservations: number;
  conflicts: number;
}

type ImportOutcomeState = "completed" | "rejected" | "cancelled" | "failed";

interface ArtifactCoverageSummary {
  total: number;
  supported: number;
  unsupported: number;
  deliberatelyIgnored: number;
  unrecognized: number;
  invalid: number;
}

type ArtifactClassification =
  | "supported"
  | "unsupported"
  | "deliberately-ignored"
  | "unrecognized"
  | "invalid";

interface ArtifactFamilyCoverage {
  familyCode: string | null;
  classification: ArtifactClassification;
  reasonCode: string;
  artifactCount: number;
}

interface ImportOutcome {
  operationRef: string;
  state: ImportOutcomeState;
  sourceProvider: string;
  sourceAdapterVersion: string;
  mappingVersion: string;
  exactRepeat: boolean;
  coverageComplete: boolean;
  coverage: ArtifactCoverageSummary;
  artifactFamilies: ArtifactFamilyCoverage[];
  report: ImportReport;
  canonicalHistoryChanged: boolean;
  terminalCode: string | null;
  recoveryNote: string | null;
}

type ImportPhase =
  | "fingerprinting"
  | "validating"
  | "importing"
  | "committing"
  | "completed"
  | "cancelled";

interface ImportProgress {
  phase: ImportPhase;
  completedArtifacts: number;
  totalArtifacts: number | null;
  completedBytes: number;
  totalBytes: number | null;
  cancellable: boolean;
}

interface UpdateRecoveryOutcome {
  outcome: "updated" | "recovered";
  sourceVersion: string;
  targetVersion: string;
}

function systemLocale(): Locale {
  const preferredLanguages = navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language];
  for (const language of preferredLanguages) {
    const baseLanguage = language.toLowerCase().split("-")[0];
    if (baseLanguage === "es") return "es-ES";
    if (baseLanguage === "en") return "en-US";
  }
  return "en-US";
}

function localDate(localDateValue: string): Date {
  const [year, month, day] = localDateValue.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

type HomeNavigationOperation =
  | { kind: "open"; destination: ExploreDestination }
  | { kind: "return" };

function App() {
  const [locale, setLocale] = useState<Locale>(systemLocale);
  const [localeReady, setLocaleReady] = useState(false);
  const [libraryReady, setLibraryReady] = useState(false);
  const localeReadyMilliseconds = useRef(0);
  const [applicationReady, setApplicationReady] = useState(false);
  const [savedPreferences, setSavedPreferences] = useState<ApplicationPreferences>(() => ({
    version: 1,
    locale: systemLocale(),
    appearance: "system",
    contentZoomPercent: 100,
  }));
  const [preferencesOperation, setPreferencesOperation] = useState<"save" | "reset">();
  const [preferencesSavedNotice, setPreferencesSavedNotice] = useState(false);
  const [preferencesRecovered, setPreferencesRecovered] = useState(false);
  const [preferencesEditorRevision, setPreferencesEditorRevision] = useState(0);
  const [settingsWorkspace, setSettingsWorkspace] = useState<SettingsWorkspace>("appearance");
  const [activeHome, setActiveHome] = useState<ApplicationHome>("home");
  const homeNavigationRevision = useRef(0);
  const startupHomeNavigationRevision = useRef(homeNavigationRevision.current);
  const [libraryHome, setLibraryHome] = useState<LibraryHome>();
  const [libraryHomeFocusRequestId, setLibraryHomeFocusRequestId] = useState(0);
  const [homeNavigationOperation, setHomeNavigationOperation]
    = useState<HomeNavigationOperation>();
  const [exploreDestination, setExploreDestination] = useState<ExploreDestination>();
  const [updateLocaleRefreshToken, setUpdateLocaleRefreshToken] = useState(0);
  const [archivePath, setArchivePath] = useState<string>();
  const [sourceGuides, setSourceGuides] = useState<SourceAcquisitionGuide[]>();
  const [activityOverview, setActivityOverview] = useState<ActivityOverview>();
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityFailed, setActivityFailed] = useState(false);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeThrough, setRangeThrough] = useState("");
  const [rangeOperation, setRangeOperation] = useState<RangeOperation>();
  const [selectedActivityDate, setSelectedActivityDate] = useState<string>();
  const [activityWorkspace, setActivityWorkspace] = useState<ActivityWorkspace>("history");
  const activityHeadingRef = useRef<HTMLHeadingElement>(null);
  const activityDetailHeadingRef = useRef<HTMLHeadingElement>(null);
  const activityDetailOriginRef = useRef<HTMLButtonElement | null>(null);
  const [trainingRefreshToken, setTrainingRefreshToken] = useState(0);
  const [reportOrigin, setReportOrigin] = useState<ReportStartOrigin>();
  const [reportOriginRequestId, setReportOriginRequestId] = useState(0);
  const [reportReturnFocusRequest, setReportReturnFocusRequest] = useState<{
    kind: "session" | "comparison";
    requestId: number;
  }>();
  const reportReturnFocusSequence = useRef(0);
  const [reportReturnRef, setReportReturnRef] = useState<string>();
  const reportSourceReturnDestination = useRef<ExploreDestination | undefined>(undefined);
  const [reportOpenRequest, setReportOpenRequest] = useState<{
    reportRef: string;
    requestId: number;
  }>();
  const [sleepRefreshToken, setSleepRefreshToken] = useState(0);
  const [recoveryRefreshToken, setRecoveryRefreshToken] = useState(0);
  const [longitudinalRefreshToken, setLongitudinalRefreshToken] = useState(0);
  const [explorerNavigation, setExplorerNavigation] = useState<
    | (ExplorerNavigationRequest & { domain: "training" | "sleep" | "recovery" })
    | (TrainingNavigationRequest & { domain: "training"; reportRef: string })
  >();
  const navigationSequence = useRef(0);
  const [outcome, setOutcome] = useState<ImportOutcome>();
  const [progress, setProgress] = useState<ImportProgress>();
  const [busy, setBusy] = useState(false);
  const [updateInstalling, setUpdateInstalling] = useState(false);
  const [updateRecoveryOutcome, setUpdateRecoveryOutcome] = useState<UpdateRecoveryOutcome>();
  const [updateRecoveryAcknowledging, setUpdateRecoveryAcknowledging] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [errorCode, setErrorCode] = useState<string>();
  const activityRangeValidation = useInvalidForm(setErrorCode);
  const messages = catalogs[locale];
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const plural = useMemo(() => new Intl.PluralRules(locale), [locale]);
  const date = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }),
    [locale],
  );
  const maxSteps = activityOverview?.series
    .flatMap((series) => series.days)
    .reduce((maximum, day) => {
      const value = day.stepCount === null ? 0n : BigInt(day.stepCount);
      return value > maximum ? value : maximum;
    }, 1n) ?? 1n;

  useEffect(() => {
    if (!selectedActivityDate) return;
    return restoreFocusAfterReveal(
      activityDetailHeadingRef.current,
      activityDetailOriginRef.current,
    );
  }, [selectedActivityDate]);

  async function refresh(requestedRange: ActivityDateRange | null = null) {
    const overview = await invoke<ActivityOverview>("query_activity_overview", {
      requestedRange,
    });
    setActivityOverview(overview);
    setActivityFailed(false);
    setRangeFrom(overview.selectedRange?.from ?? "");
    setRangeThrough(overview.selectedRange?.through ?? "");
    setSelectedActivityDate(undefined);
    activityDetailOriginRef.current = null;
  }

  async function refreshOutcome() {
    const latest = await invoke<ImportOutcome | null>("query_latest_import_outcome");
    setOutcome(latest ?? undefined);
    return latest ?? undefined;
  }

  async function refreshLibraryHome(
    afterImportOperationRef: string | null,
    restoreWorkspace: boolean,
    navigationRevision = homeNavigationRevision.current,
  ) {
    const home = await invoke<LibraryHome>("query_library_home", {
      request: { afterImportOperationRef },
    });
    setLibraryHome(home);
    if (home.availableRange === null) {
      setExploreDestination(undefined);
      if (homeNavigationRevision.current === navigationRevision) {
        setActiveHome("home");
      }
    } else {
      const restoredDestination = restoreWorkspace
        ? home.resumableExploration?.destination
        : undefined;
      setExploreDestination(restoredDestination);
      if (homeNavigationRevision.current === navigationRevision) {
        setActiveHome(restoredDestination ? "explore" : "home");
      }
    }
    return home;
  }

  useEffect(() => {
    let active = true;
    async function initializePreferences() {
      const defaultLocale = systemLocale();
      try {
        const loaded = await invoke<ApplicationPreferencesLoad>("load_preferences", {
          defaultLocale,
        });
        if (active) {
          applyApplicationPreferences(loaded.preferences);
          setSavedPreferences(loaded.preferences);
          setLocale(loaded.preferences.locale);
          setPreferencesRecovered(loaded.status === "recovered");
          setLibraryReady(true);
        }
      } catch (reason) {
        if (active) {
          const code = commandErrorCode(reason);
          const defaults: ApplicationPreferences = {
            version: 1,
            locale: defaultLocale,
            appearance: "system",
            contentZoomPercent: 100,
          };
          applyApplicationPreferences(defaults);
          setSavedPreferences(defaults);
          setLocale(defaultLocale);
          if (code === "preference-update-failed") setLibraryReady(true);
          setErrorCode(
            code === "preference-update-failed"
              ? "preference-initialization-failed"
              : code,
          );
        }
      } finally {
        if (active) {
          localeReadyMilliseconds.current = performance.now() - rendererStartedAt;
          setLocaleReady(true);
        }
      }
    }

    initializePreferences();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!localeReady || !libraryReady) return;
    let active = true;
    let startupContinued = false;
    function continueStartup(reportPaintedShell: boolean) {
      if (!active || startupContinued) return;
      startupContinued = true;
      if (reportPaintedShell) {
        void invoke("report_interactive_shell", {
          rendererStartupMilliseconds: {
            localeReady: localeReadyMilliseconds.current,
            signal: performance.now() - rendererStartedAt,
          },
        }).catch(() => undefined);
      }
      setApplicationReady(true);
    }
    let frameTimeout = 0;
    const frame = requestAnimationFrame(() => {
      window.clearTimeout(frameTimeout);
      continueStartup(true);
    });
    frameTimeout = window.setTimeout(() => {
      cancelAnimationFrame(frame);
      continueStartup(false);
    }, INTERACTIVE_SHELL_FRAME_TIMEOUT_MILLISECONDS);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      window.clearTimeout(frameTimeout);
    };
  }, [libraryReady, localeReady]);

  useEffect(() => {
    if (!applicationReady) return;
    refreshLibraryHome(null, true, startupHomeNavigationRevision.current)
      .catch((reason) => setErrorCode(commandErrorCode(reason)));
    refreshOutcome().catch((reason) => setErrorCode(commandErrorCode(reason)));
    invoke<SourceAcquisitionGuide[]>("query_source_acquisition_guides")
      .then(setSourceGuides)
      .catch((reason) => {
        setSourceGuides([]);
        setErrorCode(commandErrorCode(reason));
      });
  }, [applicationReady]);

  useEffect(() => {
    if (!applicationReady || exploreDestination !== "activity" || activityOverview) return;
    setActivityLoading(true);
    setActivityFailed(false);
    refresh()
      .catch((reason) => {
        setActivityFailed(true);
        setErrorCode(commandErrorCode(reason));
      })
      .finally(() => setActivityLoading(false));
  }, [applicationReady, exploreDestination]);

  useEffect(() => {
    if (!applicationReady) return;
    let active = true;
    invoke<UpdateRecoveryOutcome | null>("confirm_update_recovery_startup")
      .then((recoveryOutcome) => {
        if (active && recoveryOutcome) setUpdateRecoveryOutcome(recoveryOutcome);
      })
      .catch((reason) => {
        if (active) setErrorCode(commandErrorCode(reason));
      });
    return () => {
      active = false;
    };
  }, [applicationReady]);

  async function acknowledgeUpdateRecoveryOutcome() {
    setUpdateRecoveryAcknowledging(true);
    setErrorCode(undefined);
    try {
      const acknowledged = await invoke<boolean>("acknowledge_update_recovery_notice");
      if (!acknowledged) {
        setErrorCode("update-recovery-outcome-failed");
        return;
      }
      setUpdateRecoveryOutcome(undefined);
    } catch (reason) {
      setErrorCode(commandErrorCode(reason));
    } finally {
      setUpdateRecoveryAcknowledging(false);
    }
  }

  function previewPreferences(preferences: ApplicationPreferences) {
    applyApplicationPreferences(preferences);
    setLocale(preferences.locale);
    setPreferencesSavedNotice(false);
  }

  function beginHomeNavigation() {
    homeNavigationRevision.current += 1;
    return homeNavigationRevision.current;
  }

  function navigateHome(destination: ApplicationHome) {
    beginHomeNavigation();
    setActiveHome(destination);
  }

  async function returnToLibraryHome() {
    if (homeNavigationOperation) return;
    setHomeNavigationOperation({ kind: "return" });
    const navigationRevision = beginHomeNavigation();
    setErrorCode(undefined);
    try {
      await invoke("clear_training_discovery_workspace");
      await invoke("clear_exploration_workspace");
      setExploreDestination(undefined);
      setExplorerNavigation(undefined);
      setReportReturnRef(undefined);
      setReportReturnFocusRequest(undefined);
      setLibraryHome((current) => current
        ? { ...current, resumableExploration: null }
        : current);
      if (homeNavigationRevision.current === navigationRevision) {
        setActiveHome("home");
        setLibraryHomeFocusRequestId((current) => current + 1);
      }
    } catch (reason) {
      setErrorCode(commandErrorCode(reason));
    } finally {
      setHomeNavigationOperation(undefined);
    }
  }

  function openExplore() {
    applyApplicationPreferences(savedPreferences);
    setLocale(savedPreferences.locale);
    setPreferencesSavedNotice(false);
    setPreferencesEditorRevision((current) => current + 1);
    if (exploreDestination) {
      navigateHome("explore");
      return;
    }
    const destination = libraryHome?.resumableExploration?.destination
      ?? libraryHome?.questions[0]?.destination;
    if (destination) {
      void openHomeExploration(destination);
      return;
    }
    navigateHome("home");
  }

  function openLibraryHome() {
    applyApplicationPreferences(savedPreferences);
    setLocale(savedPreferences.locale);
    setPreferencesSavedNotice(false);
    setPreferencesEditorRevision((current) => current + 1);
    navigateHome("home");
  }

  function navigateApplication(destination: ApplicationHome) {
    if (destination === "home") {
      openLibraryHome();
      return;
    }
    if (destination === "explore") {
      openExplore();
      return;
    }
    if (destination === "sources") {
      openSources();
      return;
    }
    if (destination === "reports") {
      openReports();
      return;
    }
    navigateHome("settings");
  }

  function openSources() {
    applyApplicationPreferences(savedPreferences);
    setLocale(savedPreferences.locale);
    setPreferencesSavedNotice(false);
    setPreferencesEditorRevision((current) => current + 1);
    navigateHome("sources");
  }

  function openReports() {
    applyApplicationPreferences(savedPreferences);
    setLocale(savedPreferences.locale);
    setPreferencesSavedNotice(false);
    setPreferencesEditorRevision((current) => current + 1);
    setReportOrigin(undefined);
    setReportReturnRef(undefined);
    setReportOpenRequest(undefined);
    setReportReturnFocusRequest(undefined);
    navigateHome("reports");
  }

  function createReport(origin: ReportStartOrigin) {
    setErrorCode(undefined);
    setReportReturnFocusRequest(undefined);
    setReportOrigin(origin);
    setReportOriginRequestId((current) => current + 1);
    navigateHome("reports");
  }

  async function openSourceLink(url: string) {
    await openOfficialSourceLink(url);
  }

  async function openExploration(destination: ExploreDestination): Promise<boolean> {
    const navigationRevision = beginHomeNavigation();
    setErrorCode(undefined);
    try {
      await invoke("save_exploration_workspace", { destination });
      setExploreDestination(destination);
      setLibraryHome((current) => current
        ? {
            ...current,
            resumableExploration: { version: 1, destination },
          }
        : current);
      if (homeNavigationRevision.current === navigationRevision) {
        setActiveHome("explore");
      }
      return true;
    } catch (reason) {
      setErrorCode(commandErrorCode(reason));
      return false;
    }
  }

  async function openHomeExploration(destination: ExploreDestination) {
    if (homeNavigationOperation) return;
    setHomeNavigationOperation({ kind: "open", destination });
    setExplorerNavigation(undefined);
    setReportReturnRef(undefined);
    setReportReturnFocusRequest(undefined);
    try {
      await openExploration(destination);
    } finally {
      setHomeNavigationOperation(undefined);
    }
  }

  function navigateFromReport(target: ReportSourceTarget | null) {
    setReportOrigin(undefined);
    if (!target) {
      reportReturnFocusSequence.current += 1;
      setReportReturnFocusRequest({
        kind: reportOrigin?.kind === "session" ? "session" : "comparison",
        requestId: reportReturnFocusSequence.current,
      });
      navigateHome("explore");
      return;
    }
    navigationSequence.current += 1;
    reportSourceReturnDestination.current = exploreDestination;
    setExplorerNavigation({
      ...target,
      domain: "training",
      requestId: navigationSequence.current,
    });
    setExploreDestination("training");
    setReportReturnFocusRequest(undefined);
    setReportReturnRef(target.reportRef);
    navigateHome("explore");
  }

  function returnToReport() {
    if (!reportReturnRef) return;
    setReportOpenRequest({
      reportRef: reportReturnRef,
      requestId: reportOriginRequestId + navigationSequence.current + 1,
    });
    setExploreDestination(reportSourceReturnDestination.current);
    reportSourceReturnDestination.current = undefined;
    setExplorerNavigation(undefined);
    setReportReturnRef(undefined);
    setReportOrigin(undefined);
    setReportReturnFocusRequest(undefined);
    navigateHome("reports");
  }

  async function savePreferences(preferences: ApplicationPreferences) {
    const previous = savedPreferences;
    setPreferencesOperation("save");
    setErrorCode(undefined);
    try {
      const saved = await invoke<ApplicationPreferences>("save_preferences", {
        preferences: {
          locale: preferences.locale,
          appearance: preferences.appearance,
          contentZoomPercent: preferences.contentZoomPercent,
        },
      });
      applyApplicationPreferences(saved);
      setSavedPreferences(saved);
      setLocale(saved.locale);
      setPreferencesSavedNotice(true);
      setPreferencesRecovered(false);
      setPreferencesEditorRevision((current) => current + 1);
      setUpdateLocaleRefreshToken((current) => current + 1);
    } catch (reason) {
      applyApplicationPreferences(previous);
      setLocale(previous.locale);
      setPreferencesEditorRevision((current) => current + 1);
      setErrorCode(commandErrorCode(reason));
    } finally {
      setPreferencesOperation(undefined);
    }
  }

  async function resetPreferences() {
    const previous = savedPreferences;
    setPreferencesOperation("reset");
    setErrorCode(undefined);
    try {
      const reset = await invoke<ApplicationPreferencesLoad>("reset_preferences", {
        defaultLocale: systemLocale(),
      });
      applyApplicationPreferences(reset.preferences);
      setSavedPreferences(reset.preferences);
      setLocale(reset.preferences.locale);
      setPreferencesSavedNotice(true);
      setPreferencesRecovered(false);
      setPreferencesEditorRevision((current) => current + 1);
      setUpdateLocaleRefreshToken((current) => current + 1);
    } catch (reason) {
      applyApplicationPreferences(previous);
      setLocale(previous.locale);
      setPreferencesEditorRevision((current) => current + 1);
      setErrorCode(commandErrorCode(reason));
    } finally {
      setPreferencesOperation(undefined);
    }
  }

  async function chooseArchive() {
    const selected = await chooseZipArchive();
    if (typeof selected === "string") {
      setArchivePath(selected);
      setErrorCode(undefined);
    }
  }

  async function runImport() {
    if (!archivePath) return;
    setBusy(true);
    setCancelRequested(false);
    setProgress(undefined);
    setErrorCode(undefined);
    setOutcome(undefined);
    try {
      const onProgress = new Channel<ImportProgress>();
      onProgress.onmessage = setProgress;
      await invoke<ImportReport>("import_archive", { archivePath, onProgress });
      setActivityOverview(undefined);
      setTrainingRefreshToken((current) => current + 1);
      setSleepRefreshToken((current) => current + 1);
      setRecoveryRefreshToken((current) => current + 1);
      setLongitudinalRefreshToken((current) => current + 1);
      const latest = await refreshOutcome();
      await refreshLibraryHome(latest?.operationRef ?? null, false);
    } catch (reason) {
      const code = commandErrorCode(reason);
      if (code === "import-failed") {
        try {
          const latest = await refreshOutcome();
          if (latest && (latest.state === "rejected" || latest.state === "failed")) {
            setErrorCode(latest.terminalCode ?? code);
          }
        } catch (outcomeReason) {
          setErrorCode(commandErrorCode(outcomeReason));
        }
      } else {
        setErrorCode(code);
      }
    } finally {
      setBusy(false);
      setCancelRequested(false);
    }
  }

  async function cancelImport() {
    setCancelRequested(true);
    try {
      const accepted = await invoke<boolean>("cancel_import");
      if (!accepted) setCancelRequested(false);
    } catch (reason) {
      setCancelRequested(false);
      setErrorCode(commandErrorCode(reason));
    }
  }

  function rangeIsValid(): boolean {
    const available = activityOverview?.availableRange;
    if (!available || !rangeFrom || !rangeThrough || rangeFrom > rangeThrough) return false;
    if (rangeFrom < available.from || rangeThrough > available.through) return false;
    const inclusiveDays = Math.floor(
      (localDate(rangeThrough).getTime() - localDate(rangeFrom).getTime()) / 86_400_000,
    ) + 1;
    return inclusiveDays <= 366;
  }

  async function applyActivityRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rangeIsValid()) {
      activityRangeValidation.reject("invalid-activity-range");
      return;
    }
    activityRangeValidation.accept();
    setRangeOperation("apply");
    setErrorCode(undefined);
    try {
      await refresh({ from: rangeFrom, through: rangeThrough });
    } catch (reason) {
      setErrorCode(commandErrorCode(reason));
    } finally {
      setRangeOperation((current) => current === "apply" ? undefined : current);
    }
  }

  async function resetActivityRange() {
    activityRangeValidation.accept();
    setRangeOperation("reset");
    setErrorCode(undefined);
    try {
      await refresh();
    } catch (reason) {
      setErrorCode(commandErrorCode(reason));
    } finally {
      setRangeOperation((current) => current === "reset" ? undefined : current);
    }
  }

  const artifactProgress = progress?.totalArtifacts
    ? (progress.completedArtifacts / progress.totalArtifacts) * 100
    : undefined;
  const byteProgress = progress?.totalBytes
    ? (progress.completedBytes / progress.totalBytes) * 100
    : undefined;
  const progressValue = artifactProgress ?? byteProgress;
  const rangeLoading = rangeOperation !== undefined;
  const classifiedArtifacts = outcome
    ? outcome.coverage.supported +
      outcome.coverage.unsupported +
      outcome.coverage.deliberatelyIgnored +
      outcome.coverage.unrecognized +
      outcome.coverage.invalid
    : 0;
  const visibleErrorCode =
    errorCode ??
    (outcome && (outcome.state === "rejected" || outcome.state === "failed")
      ? outcome.terminalCode ?? "unexpected"
      : undefined);
  const errorMessages = messages.errors as Record<string, string>;

  function outcomeSummary(latest: ImportOutcome): string {
    if (latest.state === "cancelled") return messages.cancelled;
    if (latest.state === "rejected") return messages.outcome.rejectedSummary;
    if (latest.state === "failed") return messages.outcome.failedSummary;
    if (latest.exactRepeat) return messages.exactRepeat;
    const count = (value: number, key: CountMessageKey) => {
      const form = plural.select(value) === "one" ? "one" : "other";
      return `${number.format(value)} ${messages.counts[key][form]}`;
    };
    return `${messages.completed}: ${count(latest.report.recognizedArtifacts, "recognized")}, ${count(latest.report.newObservations, "created")}, ${count(latest.report.enrichedObservations, "enriched")}, ${count(latest.report.amendedObservations, "amended")}, ${count(latest.report.equivalentObservations, "equivalent")}, ${count(latest.report.preservedObservations, "preserved")}, ${count(latest.report.conflicts, "conflicts")}.`;
  }

  function providerName(provider: string): string {
    return provider === "polar-flow" ? messages.outcome.polarFlow : provider;
  }

  function classificationName(classification: ArtifactClassification): string {
    return messages.outcome.familyClassifications[classification];
  }

  function familyName(familyCode: string | null): string {
    if (familyCode === null) return messages.outcome.unrecognizedFamily;
    const familyNames = messages.outcome.familyNames as Record<string, string>;
    return familyNames[familyCode] ?? familyCode;
  }

  function coverageExplanation(reasonCode: string) {
    const explanations = messages.outcome.coverageExplanations as Record<
      string,
      { reason: string; action: string }
    >;
    return explanations[reasonCode] ?? explanations.unknown;
  }

  function formatStepCount(value: string | null): string {
    return value === null ? messages.unavailable : number.format(BigInt(value));
  }

  function stepBarWidth(value: string | null): string {
    if (value === null) return "0%";
    const basisPoints = (BigInt(value) * 10_000n) / maxSteps;
    return `${Number(basisPoints) / 100}%`;
  }

  function activityAvailability(availability: ActivityDayAvailability): string {
    return messages.activity[availability];
  }

  function detailButtonLabel(localDateValue: string): string {
    return `${messages.activity.viewDetails} ${date.format(localDate(localDateValue))}`;
  }

  function openActivityDetail(
    localDateValue: string,
    origin: HTMLButtonElement | null,
  ) {
    activityDetailOriginRef.current = origin;
    setActivityWorkspace("history");
    setSelectedActivityDate(localDateValue);
  }

  function closeActivityDetail(initiatingElement: HTMLButtonElement) {
    const target = activityDetailOriginRef.current?.isConnected
      ? activityDetailOriginRef.current
      : activityHeadingRef.current;
    setSelectedActivityDate(undefined);
    activityDetailOriginRef.current = null;
    restoreFocusAfterReveal(target, initiatingElement);
  }

  async function navigateFromLongitudinal(
    domain: "activity" | "training" | "sleep" | "recovery",
    localDateValue: string,
    seriesRef: string,
  ) {
    setErrorCode(undefined);
    setReportReturnRef(undefined);
    setReportReturnFocusRequest(undefined);
    if (domain === "activity") {
      try {
        await invoke("save_exploration_workspace", { destination: "activity" });
        await refresh({ from: localDateValue, through: localDateValue });
        setExploreDestination("activity");
        openActivityDetail(localDateValue, null);
      } catch (reason) {
        setErrorCode(commandErrorCode(reason));
      }
      return;
    }
    navigationSequence.current += 1;
    const navigation = {
      domain,
      seriesRef,
      localDate: localDateValue,
      requestId: navigationSequence.current,
    };
    setExplorerNavigation(navigation);
    if (!(await openExploration(domain))) {
      setExplorerNavigation((current) => current?.requestId === navigation.requestId
        ? undefined
        : current);
    }
  }

  if (!localeReady) {
    return (
      <main className="startup-surface" aria-busy="true" aria-label="FitFreed">
        <div className="startup-mark">
          <strong>FitFreed</strong>
          <progress aria-label="FitFreed" />
        </div>
      </main>
    );
  }

  return (
    <ApplicationShell
      activeHome={activeHome}
      messages={messages.shell}
      exploreDisabled={!libraryHome || libraryHome.availableRange === null}
      onNavigate={navigateApplication}
    >
        {preferencesRecovered && (
          <p className="notice" role="status" aria-live="polite">
            {messages.settings.recovered}
          </p>
        )}
        {visibleErrorCode && (
          <p id={APPLICATION_ERROR_ID} className="error" role="alert">
            {errorMessages[visibleErrorCode] ?? messages.errors.unexpected}
          </p>
        )}
        {updateRecoveryOutcome && (
          <section
            className="update-panel update-recovery-notice"
            aria-labelledby="update-recovery-heading"
            aria-busy={updateRecoveryAcknowledging}
          >
            <div
              className={`update-result update-result-${updateRecoveryOutcome.outcome}`}
              role="status"
              aria-labelledby="update-recovery-heading"
              aria-live="polite"
            >
              <h2 id="update-recovery-heading">
                {updateRecoveryOutcome.outcome === "updated"
                  ? messages.updates.recovery.updatedHeading
                  : messages.updates.recovery.recoveredHeading}
              </h2>
              <p>
                {(updateRecoveryOutcome.outcome === "updated"
                  ? messages.updates.recovery.updated
                  : messages.updates.recovery.recovered)
                  .replace("{sourceVersion}", updateRecoveryOutcome.sourceVersion)
                  .replace("{targetVersion}", updateRecoveryOutcome.targetVersion)}
              </p>
              <button
                type="button"
                className="secondary"
                onClick={() => void acknowledgeUpdateRecoveryOutcome()}
                disabled={updateRecoveryAcknowledging}
              >
                {messages.updates.recovery.acknowledge}
              </button>
            </div>
            {updateRecoveryAcknowledging && (
              <p className="update-progress" role="status" aria-live="polite">
                {messages.updates.recovery.acknowledging}
              </p>
            )}
          </section>
        )}
        {activeHome === "settings" && (
          <SettingsPanel
            key={preferencesEditorRevision}
            savedPreferences={savedPreferences}
            messages={messages.settings}
            workspace={settingsWorkspace}
            disabled={!libraryReady || updateInstalling}
            operation={preferencesOperation}
            savedNotice={preferencesSavedNotice}
            onWorkspaceChange={setSettingsWorkspace}
            onPreview={previewPreferences}
            onSave={savePreferences}
            onReset={resetPreferences}
          />
        )}
        <div
          className="settings-updates-workspace"
          hidden={activeHome !== "settings" || settingsWorkspace !== "updates"}
        >
          {applicationReady && (
            <Suspense fallback={<LoadingSurface message={messages.shell.loading} />}>
              <UpdatePanel
                locale={locale}
                messages={messages.updates}
                errors={errorMessages}
                ready
                refreshToken={updateLocaleRefreshToken}
                installationBlocked={busy}
                onInstallationStateChange={setUpdateInstalling}
              />
            </Suspense>
          )}
        </div>
        <div className="sources-home" hidden={activeHome !== "sources"}>
          <SourcesPanel
            locale={locale}
            messages={messages.sources}
            importMessages={{
              choose: messages.choose,
              choosing: messages.choosing,
              import: messages.import,
              noPackage: messages.noPackage,
              importing: messages.importing,
              cancel: messages.cancel,
              cancelling: messages.cancelling,
            }}
            guide={sourceGuides?.find((guide) => guide.sourceId === "polar-flow")}
            guideLoading={sourceGuides === undefined}
            archivePath={archivePath}
            importReady={libraryReady}
            busy={busy}
            cancellable={progress?.cancellable ?? false}
            updateInstalling={updateInstalling}
            cancelRequested={cancelRequested}
            onChooseArchive={chooseArchive}
            onArchiveError={() => setErrorCode("archive-picker-failed")}
            onImport={runImport}
            onCancel={cancelImport}
            onOpenOfficialLink={openSourceLink}
            onLinkError={() => setErrorCode("official-source-link-failed")}
          >
            {progress && busy && (
              <section
                className="progress-panel"
                aria-labelledby="progress-heading"
                aria-live="polite"
              >
                <h2 id="progress-heading">{messages.phases[progress.phase]}</h2>
                {progressValue === undefined ? (
                  <p>{messages.phases[progress.phase]}</p>
                ) : (
                  <progress
                    max="100"
                    value={progressValue}
                    aria-label={messages.phases[progress.phase]}
                  />
                )}
              </section>
            )}
            {progress?.phase === "cancelled" && !busy && outcome?.state !== "cancelled" && (
              <p className="notice" role="status" aria-live="polite">{messages.cancelled}</p>
            )}
            {outcome && (
              <section className="outcome-panel" aria-labelledby="outcome-heading">
                <h2 id="outcome-heading">{messages.outcome.heading}</h2>
                <p className="notice" role="status" aria-live="polite">
                  {outcomeSummary(outcome)}
                </p>
                <dl className="outcome-metadata">
                  <div>
                    <dt>{messages.outcome.status}</dt>
                    <dd>{messages.outcome.states[outcome.state]}</dd>
                  </div>
                  <div>
                    <dt>{messages.outcome.provider}</dt>
                    <dd>{providerName(outcome.sourceProvider)}</dd>
                  </div>
                  <div>
                    <dt>{messages.outcome.historyEffect}</dt>
                    <dd>
                      {outcome.canonicalHistoryChanged
                        ? messages.outcome.historyChanged
                        : messages.outcome.historyUnchanged}
                    </dd>
                  </div>
                </dl>
                <h3 id="coverage-heading">{messages.outcome.coverageHeading}</h3>
                <p>
                  <strong>
                    {number.format(classifiedArtifacts)} / {number.format(outcome.coverage.total)}
                  </strong>{" "}
                  <span>
                    {messages.outcome.artifactsClassified[
                      plural.select(classifiedArtifacts) === "one" ? "one" : "other"
                    ]}.
                  </span>{" "}
                  <span>
                    {outcome.coverageComplete
                      ? messages.outcome.coverageComplete
                      : messages.outcome.coverageIncomplete}
                  </span>
                </p>
                <ul className="coverage-summary" aria-labelledby="coverage-heading">
                  <li><strong>{number.format(outcome.coverage.supported)}</strong><span>{messages.outcome.supported}</span></li>
                  <li><strong>{number.format(outcome.coverage.unsupported)}</strong><span>{messages.outcome.unsupported}</span></li>
                  <li><strong>{number.format(outcome.coverage.deliberatelyIgnored)}</strong><span>{messages.outcome.ignored}</span></li>
                  <li><strong>{number.format(outcome.coverage.unrecognized)}</strong><span>{messages.outcome.unrecognized}</span></li>
                  <li><strong>{number.format(outcome.coverage.invalid)}</strong><span>{messages.outcome.invalid}</span></li>
                </ul>
                {outcome.artifactFamilies.length > 0 && (
                  <>
                    <h3 id="family-coverage-heading">{messages.outcome.familyCoverageHeading}</h3>
                    <table className="family-coverage-table">
                      <caption className="sr-only">{messages.outcome.familyCoverageHeading}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{messages.outcome.familyColumn}</th>
                          <th scope="col">{messages.outcome.classificationColumn}</th>
                          <th scope="col">{messages.outcome.artifactCountColumn}</th>
                          <th scope="col">{messages.outcome.explanationColumn}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {outcome.artifactFamilies.map((family) => {
                          const explanation = coverageExplanation(family.reasonCode);
                          return (
                            <tr key={`${family.familyCode ?? "unrecognized"}:${family.classification}:${family.reasonCode}`}>
                              <th scope="row" data-label={messages.outcome.familyColumn}>
                                {familyName(family.familyCode)}
                              </th>
                              <td data-label={messages.outcome.classificationColumn}>
                                {classificationName(family.classification)}
                              </td>
                              <td data-label={messages.outcome.artifactCountColumn}>
                                {number.format(family.artifactCount)}
                              </td>
                              <td data-label={messages.outcome.explanationColumn}>
                                <p>
                                  <strong>{messages.outcome.reasonLabel}:</strong>{" "}
                                  {explanation.reason}
                                </p>
                                <p>
                                  <strong>{messages.outcome.nextActionLabel}:</strong>{" "}
                                  {explanation.action}
                                </p>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}
              </section>
            )}
          </SourcesPanel>
        </div>
        <div className="reports-home" hidden={activeHome !== "reports"}>
          {applicationReady && activeHome === "reports" && (
            <Suspense fallback={<LoadingSurface message={messages.shell.loading} />}>
              <ReportsPanel
                locale={locale}
                messages={messages}
                origin={reportOrigin}
                originRequestId={reportOriginRequestId}
                openReportRef={reportOpenRequest?.reportRef}
                openReportRequestId={reportOpenRequest?.requestId}
                disabled={!libraryReady || busy || updateInstalling}
                onReturnToOrigin={navigateFromReport}
              />
            </Suspense>
          )}
        </div>
        <div className="library-home-root" hidden={activeHome !== "home"}>
      {libraryHome && (
        <LibraryHomePanel
          home={libraryHome}
          locale={locale}
          messages={messages.home}
          focusRequestId={libraryHomeFocusRequestId}
          pendingDestination={homeNavigationOperation?.kind === "open"
            ? homeNavigationOperation.destination
            : undefined}
          onExplore={(destination) => void openHomeExploration(destination)}
          onOpenSources={openSources}
        />
      )}
        </div>

        <div className="explore-home" hidden={activeHome !== "explore"}>

      {exploreDestination && (
        <nav
          className="explorer-return"
          aria-label={messages.home.backHome}
          aria-busy={homeNavigationOperation?.kind === "return"}
        >
          {reportReturnRef && (
            <button
              type="button"
              className="secondary"
              disabled={homeNavigationOperation?.kind === "return"}
              onClick={returnToReport}
            >
              <span aria-hidden="true">← </span>{messages.reports.backToReport}
            </button>
          )}
          <button
            type="button"
            className="secondary"
            aria-label={messages.home.backHome}
            disabled={homeNavigationOperation?.kind === "return"}
            onClick={() => void returnToLibraryHome()}
          >
            <span aria-hidden="true">← </span>{messages.home.backHome}
          </button>
          {homeNavigationOperation?.kind === "return" && (
            <span className="progress-submit-status" role="status" aria-live="polite">
              {messages.home.returning}
            </span>
          )}
        </nav>
      )}

      {applicationReady && exploreDestination === "longitudinal" && (
        <Suspense fallback={<LoadingSurface message={messages.shell.loading} />}>
          <LongitudinalInsightsPanel
            locale={locale}
            messages={messages}
            refreshToken={longitudinalRefreshToken}
            onError={setErrorCode}
            onNavigate={navigateFromLongitudinal}
          />
        </Suspense>
      )}

      {exploreDestination === "activity" && (
      <section
        aria-labelledby="activity-heading"
        aria-busy={activityLoading || (!activityOverview && !activityFailed)}
      >
        <header className="explorer-workspace-heading">
          <p className="eyebrow">{messages.activity.workspaceEyebrow}</p>
          <h1 id="activity-heading" ref={activityHeadingRef} tabIndex={-1}>
            {messages.activity.heading}
          </h1>
          <p>{messages.activity.workspaceIntro}</p>
        </header>
        <WorkspaceNavigation
          label={messages.activity.workspaceNavigation}
          current={activityWorkspace}
          options={[
            { workspace: "history", label: messages.activity.workspaces.history },
            {
              workspace: "comparison",
              label: messages.activity.workspaces.comparison,
              disabled: !activityOverview?.availableRange,
            },
          ]}
          onSelect={setActivityWorkspace}
        />
        {!activityOverview && !activityFailed ? (
          <p role="status">{messages.activity.loading}</p>
        ) : activityFailed && !activityOverview ? (
          <p>{messages.activity.unavailableHistory}</p>
        ) : !activityOverview || activityOverview.series.length === 0 ? (
          <p>{messages.activity.empty}</p>
        ) : (
          <>
            <div
              className="explorer-history-workspace"
              hidden={activityWorkspace !== "history" || selectedActivityDate !== undefined}
            >
            {activityOverview.availableRange && activityOverview.selectedRange && (
              <form
                className="activity-filter"
                aria-labelledby="activity-filter-heading"
                aria-busy={rangeLoading}
                onSubmit={(event) => void applyActivityRange(event)}
              >
                <div>
                  <h2 id="activity-filter-heading">{messages.activity.filterHeading}</h2>
                  <p>{messages.activity.rangeHelp}</p>
                </div>
                <label>
                  <span>{messages.activity.from}</span>
                  <input
                    type="date"
                    min={activityOverview.availableRange.from}
                    max={activityOverview.availableRange.through}
                    value={rangeFrom}
                    aria-invalid={activityRangeValidation.invalid || undefined}
                    aria-describedby={activityRangeValidation.errorElementId}
                    onChange={(event) => {
                      activityRangeValidation.edit();
                      setRangeFrom(event.target.value);
                    }}
                    disabled={rangeLoading}
                    required
                  />
                </label>
                <label>
                  <span>{messages.activity.through}</span>
                  <input
                    type="date"
                    min={activityOverview.availableRange.from}
                    max={activityOverview.availableRange.through}
                    value={rangeThrough}
                    aria-invalid={activityRangeValidation.invalid || undefined}
                    aria-describedby={activityRangeValidation.errorElementId}
                    onChange={(event) => {
                      activityRangeValidation.edit();
                      setRangeThrough(event.target.value);
                    }}
                    disabled={rangeLoading}
                    required
                  />
                </label>
                <RangeFilterActions
                  className="activity-filter-actions"
                  operation={rangeOperation}
                  applyLabel={messages.activity.applyRange}
                  applyingLabel={messages.activity.applyingRange}
                  resetLabel={messages.activity.latestWindow}
                  resettingLabel={messages.activity.loadingLatestWindow}
                  onReset={() => void resetActivityRange()}
                />
              </form>
            )}
            {activityOverview.selectedRange && (
              <p className="activity-range">
                <strong>{messages.activity.selectedRange}:</strong>{" "}
                <time dateTime={activityOverview.selectedRange.from}>
                  {date.format(localDate(activityOverview.selectedRange.from))}
                </time>{" "}
                {messages.activity.rangeSeparator}{" "}
                <time dateTime={activityOverview.selectedRange.through}>
                  {date.format(localDate(activityOverview.selectedRange.through))}
                </time>
                {activityOverview.availableRange && (
                  <span>
                    {" · "}<strong>{messages.activity.availableRange}:</strong>{" "}
                    <time dateTime={activityOverview.availableRange.from}>
                      {date.format(localDate(activityOverview.availableRange.from))}
                    </time>{" "}
                    {messages.activity.rangeSeparator}{" "}
                    <time dateTime={activityOverview.availableRange.through}>
                      {date.format(localDate(activityOverview.availableRange.through))}
                    </time>
                  </span>
                )}
              </p>
            )}
            {activityOverview.series.map((series, seriesIndex) => (
              <section className="activity-series" key={series.seriesRef}>
                {activityOverview.series.length > 1 && (
                  <h2>{messages.activity.series} {number.format(seriesIndex + 1)}</h2>
                )}
                <ul className="activity-summary" aria-label={messages.activity.heading}>
                  <li>
                    <strong>{formatStepCount(series.summary.totalStepCount)}</strong>
                    <span>{messages.activity.totalSteps}</span>
                  </li>
                  <li>
                    <strong>{formatStepCount(series.summary.averageStepCount)}</strong>
                    <span>{messages.activity.averageSteps}</span>
                  </li>
                  <li>
                    <strong>{number.format(series.summary.availableStepDays)}</strong>
                    <span>{messages.activity.availableDays}</span>
                  </li>
                  <li>
                    <strong>{number.format(series.summary.unavailableStepDays)}</strong>
                    <span>{messages.activity.unavailableDays}</span>
                  </li>
                  <li>
                    <strong>{number.format(series.summary.missingDays)}</strong>
                    <span>{messages.activity.missingDays}</span>
                  </li>
                </ul>
                <div className="history-grid">
                  <figure>
                    <figcaption>{messages.activity.visual}</figcaption>
                    <ol className="chart">
                      {series.days.map((day) => (
                        <li key={day.localDate}>
                          <button
                            type="button"
                            className="detail-button"
                            aria-label={detailButtonLabel(day.localDate)}
                            onClick={(event) => openActivityDetail(
                              day.localDate,
                              event.currentTarget,
                            )}
                          >
                            <time dateTime={day.localDate}>{date.format(localDate(day.localDate))}</time>
                          </button>
                          <span className="track" aria-hidden="true">
                            {day.stepCount !== null && (
                              <span className="bar" style={{ width: stepBarWidth(day.stepCount) }} />
                            )}
                          </span>
                          <strong>{day.stepCount === null ? "—" : formatStepCount(day.stepCount)}</strong>
                          <span className="day-status">{activityAvailability(day.availability)}</span>
                        </li>
                      ))}
                    </ol>
                  </figure>
                  <table>
                    <caption className="sr-only">{messages.activity.heading}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{messages.date}</th>
                        <th scope="col">{messages.steps}</th>
                        <th scope="col">{messages.activity.availability}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {series.days.map((day) => (
                        <tr key={day.localDate}>
                          <td>
                            <button
                              type="button"
                              className="detail-button"
                              aria-label={detailButtonLabel(day.localDate)}
                              onClick={(event) => openActivityDetail(
                                day.localDate,
                                event.currentTarget,
                              )}
                            >
                              <time dateTime={day.localDate}>{date.format(localDate(day.localDate))}</time>
                            </button>
                          </td>
                          <td>{formatStepCount(day.stepCount)}</td>
                          <td>{activityAvailability(day.availability)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
            </div>
            <div
              className="explorer-detail-workspace"
              hidden={activityWorkspace !== "history"}
            >
            {selectedActivityDate && (
              <section className="activity-detail" aria-labelledby="activity-detail-heading">
                <div className="activity-detail-heading">
                  <div>
                    <h2
                      id="activity-detail-heading"
                      ref={activityDetailHeadingRef}
                      tabIndex={-1}
                    >
                      {messages.activity.detailHeading}
                    </h2>
                    <time dateTime={selectedActivityDate}>
                      {date.format(localDate(selectedActivityDate))}
                    </time>
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={(event) => closeActivityDetail(event.currentTarget)}
                  >
                    {messages.activity.closeDetail}
                  </button>
                </div>
                <ul>
                  {activityOverview.series.map((series, seriesIndex) => {
                    const day = series.days.find(
                      (candidate) => candidate.localDate === selectedActivityDate,
                    );
                    if (!day) return null;
                    return (
                      <li key={series.seriesRef}>
                        <h3>{messages.activity.series} {number.format(seriesIndex + 1)}</h3>
                        <dl>
                          <div>
                            <dt>{messages.steps}</dt>
                            <dd>{formatStepCount(day.stepCount)}</dd>
                          </div>
                          <div>
                            <dt>{messages.activity.availability}</dt>
                            <dd>{activityAvailability(day.availability)}</dd>
                          </div>
                        </dl>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            </div>
            <div
              className="explorer-comparison-workspace"
              hidden={activityWorkspace !== "comparison"}
            >
            {activityOverview.availableRange && activityOverview.selectedRange && (
              <Suspense fallback={<LoadingSurface message={messages.shell.loading} />}>
                <ActivityComparisonPanel
                  key={`${activityOverview.selectedRange.from}:${activityOverview.selectedRange.through}`}
                  availableRange={activityOverview.availableRange}
                  initialRange={activityOverview.selectedRange}
                  locale={locale}
                  messages={messages}
                  onError={setErrorCode}
                />
              </Suspense>
            )}
            </div>
          </>
        )}
      </section>
      )}
      {applicationReady && exploreDestination && (
        <Suspense fallback={<LoadingSurface message={messages.shell.loading} />}>
          {exploreDestination === "training" && (
          <TrainingInsightsPanel
            locale={locale}
            messages={messages}
            refreshToken={trainingRefreshToken}
            navigationRequest={explorerNavigation?.domain === "training" ? explorerNavigation : undefined}
            reportReturnFocusRequest={reportReturnFocusRequest}
            onCreateReport={createReport}
            onError={setErrorCode}
          />
          )}
          {exploreDestination === "sleep" && (
          <SleepInsightsPanel
            locale={locale}
            messages={messages}
            refreshToken={sleepRefreshToken}
            navigationRequest={explorerNavigation?.domain === "sleep" ? explorerNavigation : undefined}
            onError={setErrorCode}
          />
          )}
          {exploreDestination === "recovery" && (
          <RecoveryInsightsPanel
            locale={locale}
            messages={messages}
            refreshToken={recoveryRefreshToken}
            navigationRequest={explorerNavigation?.domain === "recovery" ? explorerNavigation : undefined}
            onError={setErrorCode}
          />
          )}
        </Suspense>
      )}
        </div>
    </ApplicationShell>
  );
}

export default App;
