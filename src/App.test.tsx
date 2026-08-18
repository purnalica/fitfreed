import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { catalogs } from "./locales/catalogs";
import type { ApplicationPreferencesLoad } from "./presentation/application-preferences";

const spanish = catalogs["es-ES"];

interface TestActivityDay {
  localDate: string;
  stepCount: string | null;
  availability: "available" | "unavailable" | "missing";
}

interface TestActivityOverview {
  availableRange: { from: string; through: string } | null;
  selectedRange: { from: string; through: string } | null;
  series: Array<{
    seriesRef: string;
    summary: {
      calendarDays: number;
      observedDays: number;
      availableStepDays: number;
      unavailableStepDays: number;
      missingDays: number;
      totalStepCount: string | null;
      averageStepCount: string | null;
    };
    days: TestActivityDay[];
  }>;
}

interface TestActivityComparison {
  availableRange: { from: string; through: string } | null;
  baselineRange: { from: string; through: string } | null;
  comparisonRange: { from: string; through: string } | null;
  series: Array<{
    seriesRef: string;
    baseline: TestActivityOverview["series"][number]["summary"];
    comparison: TestActivityOverview["series"][number]["summary"];
    totalStepChange: string | null;
    averageStepChange: string | null;
  }>;
}

interface TestTrainingSession {
  sessionRef: string;
  startedAtLocal: string;
  stoppedAtLocal: string;
  utcOffsetMinutes: number | null;
  durationMilliseconds: string;
  distanceMeters: number | null;
  energyKilocalories: string | null;
  averageHeartRateBpm: string | null;
  maximumHeartRateBpm: string | null;
  sportRef: string | null;
  exerciseCount: number | null;
}

interface TestTrainingSummary {
  calendarDays: number;
  trainingDays: number;
  sessionCount: number;
  totalDurationMilliseconds: string;
  distanceSessionCount: number;
  totalDistanceMeters: number | null;
  energySessionCount: number;
  totalEnergyKilocalories: string | null;
  heartRateSessionCount: number;
}

interface TestTrainingOverview {
  availableRange: { from: string; through: string } | null;
  selectedRange: { from: string; through: string } | null;
  series: Array<{
    seriesRef: string;
    summary: TestTrainingSummary;
    sessions: TestTrainingSession[];
  }>;
}

interface TestTrainingComparison {
  availableRange: { from: string; through: string } | null;
  baselineRange: { from: string; through: string } | null;
  comparisonRange: { from: string; through: string } | null;
  series: Array<{
    seriesRef: string;
    baseline: TestTrainingSummary;
    comparison: TestTrainingSummary;
    sessionCountChange: string;
    trainingDayChange: string;
    durationMillisecondsChange: string;
    distanceMetersChange: number | null;
    energyKilocaloriesChange: string | null;
  }>;
}

function emptyActivityOverview(): TestActivityOverview {
  return { availableRange: null, selectedRange: null, series: [] };
}

function activityOverview(days: TestActivityDay[]): TestActivityOverview {
  const available = days.filter((day) => day.availability === "available");
  const unavailable = days.filter((day) => day.availability === "unavailable");
  const missing = days.filter((day) => day.availability === "missing");
  const total = available.reduce(
    (sum, day) => sum + BigInt(day.stepCount ?? "0"),
    0n,
  );
  const average = available.length > 0
    ? (total + BigInt(available.length) / 2n) / BigInt(available.length)
    : null;
  const range = { from: days[0].localDate, through: days.at(-1)!.localDate };
  return {
    availableRange: range,
    selectedRange: range,
    series: [{
      seriesRef: "synthetic-origin",
      summary: {
        calendarDays: days.length,
        observedDays: available.length + unavailable.length,
        availableStepDays: available.length,
        unavailableStepDays: unavailable.length,
        missingDays: missing.length,
        totalStepCount: available.length > 0 ? total.toString() : null,
        averageStepCount: average?.toString() ?? null,
      },
      days,
    }],
  };
}

function activityComparison(
  baselineDays: TestActivityDay[],
  comparisonDays: TestActivityDay[],
): TestActivityComparison {
  const baseline = activityOverview(baselineDays);
  const comparison = activityOverview(comparisonDays);
  const baselineSummary = baseline.series[0].summary;
  const comparisonSummary = comparison.series[0].summary;
  const change = (from: string | null, through: string | null) =>
    from === null || through === null ? null : (BigInt(through) - BigInt(from)).toString();
  return {
    availableRange: {
      from: baselineDays[0].localDate,
      through: comparisonDays.at(-1)!.localDate,
    },
    baselineRange: baseline.selectedRange,
    comparisonRange: comparison.selectedRange,
    series: [{
      seriesRef: "synthetic-origin",
      baseline: baselineSummary,
      comparison: comparisonSummary,
      totalStepChange: change(
        baselineSummary.totalStepCount,
        comparisonSummary.totalStepCount,
      ),
      averageStepChange: change(
        baselineSummary.averageStepCount,
        comparisonSummary.averageStepCount,
      ),
    }],
  };
}

function emptyTrainingOverview(): TestTrainingOverview {
  return { availableRange: null, selectedRange: null, series: [] };
}

function emptySleepOverview() {
  return { availableRange: null, selectedRange: null, series: [] };
}

function emptyRecoveryOverview() {
  return { availableRange: null, selectedRange: null, series: [] };
}

function emptyLongitudinalOverview() {
  return { availableRange: null, selectedRange: null, series: [] };
}

function longitudinalOverviewWithTrainingDay() {
  const range = { from: "2026-01-04", through: "2026-01-04" };
  return {
    availableRange: range,
    selectedRange: range,
    series: [{
      seriesRef: "synthetic-origin",
      activity: {
        calendarDays: 1,
        observedDays: 0,
        availableStepDays: 0,
        unavailableStepDays: 0,
        missingDays: 1,
        totalStepCount: null,
        averageStepCount: null,
      },
      training: {
        calendarDays: 1,
        trainingDays: 1,
        sessionCount: 1,
        totalDurationMilliseconds: "3600000",
        distanceSessionCount: 0,
        totalDistanceMeters: null,
        energySessionCount: 0,
        totalEnergyKilocalories: null,
        heartRateSessionCount: 0,
      },
      sleep: {
        calendarDays: 1,
        observedNights: 0,
        missingNights: 1,
        totalAsleepMilliseconds: "0",
        averageAsleepMilliseconds: null,
        totalInterruptionMilliseconds: "0",
        averageInterruptionMilliseconds: null,
        averageEfficiencyPercent: null,
        phaseNightCount: 0,
        phaseTotals: null,
        stageTimelineNightCount: 0,
        scoreNightCount: 0,
        averageOverallScore: null,
        goalNightCount: 0,
        goalMetNightCount: 0,
        powerStatusNightCount: 0,
        powerLossNightCount: 0,
      },
      recovery: {
        calendarDays: 1,
        observedNights: 0,
        missingNights: 1,
        averageBeatToBeatIntervalMilliseconds: null,
        rmssdNightCount: 0,
        averageHeartRateVariabilityRmssdMilliseconds: null,
        averageBreathingIntervalMilliseconds: null,
        assessmentNightCount: 0,
        baselineNightCount: 0,
        guidanceNightCount: 0,
      },
      days: [{
        localDate: "2026-01-04",
        activity: { availability: "missing", stepCount: null },
        training: { sessionCount: 1, totalDurationMilliseconds: "3600000" },
        sleep: { availability: "missing", asleepMilliseconds: null },
        recovery: {
          availability: "missing",
          beatToBeatIntervalMilliseconds: null,
          heartRateVariabilityRmssdMilliseconds: null,
          breathingIntervalMilliseconds: null,
        },
      }],
    }],
  };
}

function emptyLibraryHome() {
  return {
    availableRange: null,
    domains: ["training", "activity", "sleep", "recovery"].map((domain) => ({
      domain,
      availableRange: null,
      selectedRange: null,
      originCount: 0,
      observedRecordCount: 0,
      measurements: [],
    })),
    questions: [],
    postImport: null,
    resumableExploration: null,
  };
}

function populatedLibraryHome(overrides: Record<string, unknown> = {}) {
  const range = { from: "2025-01-01", through: "2026-08-17" };
  return {
    availableRange: range,
    domains: [
      {
        domain: "training",
        availableRange: range,
        selectedRange: { from: "2026-07-19", through: "2026-08-17" },
        originCount: 1,
        observedRecordCount: 24,
        measurements: [
          { measurement: "training-duration", availableRecords: 24, observedRecords: 24 },
          { measurement: "training-distance", availableRecords: 16, observedRecords: 24 },
          { measurement: "training-energy", availableRecords: 20, observedRecords: 24 },
          { measurement: "training-heart-rate", availableRecords: 18, observedRecords: 24 },
        ],
      },
      ...emptyLibraryHome().domains.slice(1),
    ],
    questions: [
      { kind: "explore-training-sessions", destination: "training" },
    ],
    postImport: null,
    resumableExploration: null,
    ...overrides,
  };
}

const questionForDestination = {
  activity: { kind: "review-activity-steps", label: "How has my daily activity changed?" },
  training: { kind: "explore-training-sessions", label: "Explore my training sessions" },
  sleep: { kind: "review-sleep-patterns", label: "What patterns are visible in my sleep?" },
  recovery: {
    kind: "review-recovery-patterns",
    label: "What patterns are visible in my recovery?",
  },
  longitudinal: {
    kind: "align-history",
    label: "How do training, activity, sleep, and recovery align?",
  },
} as const;

function offerExploration(
  destination: keyof typeof questionForDestination,
  resumable = false,
) {
  const question = questionForDestination[destination];
  const home = populatedLibraryHome({
    questions: [{ kind: question.kind, destination }],
    resumableExploration: resumable ? { version: 1, destination } : null,
  });
  let savedDestination = resumable ? destination : null;
  mocks.homeInvoke.mockImplementation((command, arguments_) => {
    if (command === "query_library_home") {
      return Promise.resolve({
        ...home,
        resumableExploration: savedDestination
          ? { version: 1, destination: savedDestination }
          : null,
      });
    }
    if (command === "save_exploration_workspace") {
      savedDestination = arguments_.destination;
      return Promise.resolve({ version: 1, destination: arguments_.destination });
    }
    if (command === "clear_exploration_workspace") {
      savedDestination = null;
      return Promise.resolve(undefined);
    }
    throw new Error(`Unexpected Home command: ${command}`);
  });
  return question.label;
}

async function enterExploration(
  user: ReturnType<typeof userEvent.setup>,
  destination: keyof typeof questionForDestination,
) {
  await user.click(await screen.findByRole("button", {
    name: questionForDestination[destination].label,
  }));
}

function trainingOverview(
  sessions: TestTrainingSession[],
  selectedRange = { from: "2026-01-01", through: "2026-01-31" },
): TestTrainingOverview {
  const calendarDays = Math.floor(
    (Date.parse(`${selectedRange.through}T00:00:00Z`)
      - Date.parse(`${selectedRange.from}T00:00:00Z`)) / 86_400_000,
  ) + 1;
  const trainingDays = new Set(sessions.map((session) => session.startedAtLocal.slice(0, 10))).size;
  const duration = sessions.reduce(
    (total, session) => total + BigInt(session.durationMilliseconds),
    0n,
  );
  const distances = sessions
    .map((session) => session.distanceMeters)
    .filter((value): value is number => value !== null);
  const energies = sessions
    .map((session) => session.energyKilocalories)
    .filter((value): value is string => value !== null);
  return {
    availableRange: { from: "2026-01-01", through: "2026-01-31" },
    selectedRange,
    series: [{
      seriesRef: "synthetic-origin",
      summary: {
        calendarDays,
        trainingDays,
        sessionCount: sessions.length,
        totalDurationMilliseconds: duration.toString(),
        distanceSessionCount: distances.length,
        totalDistanceMeters: distances.length > 0
          ? distances.reduce((total, value) => total + value, 0)
          : null,
        energySessionCount: energies.length,
        totalEnergyKilocalories: energies.length > 0
          ? energies.reduce((total, value) => total + BigInt(value), 0n).toString()
          : null,
        heartRateSessionCount: sessions.filter(
          (session) => session.averageHeartRateBpm !== null || session.maximumHeartRateBpm !== null,
        ).length,
      },
      sessions,
    }],
  };
}

function importOutcome(overrides: Record<string, unknown> = {}) {
  return {
    operationRef: "synthetic-operation",
    state: "completed",
    sourceProvider: "polar-flow",
    sourceAdapterVersion: "polar-flow-archive@4",
    mappingVersion: "polar-flow-mapping-set@1",
    exactRepeat: false,
    coverageComplete: true,
    coverage: {
      total: 3,
      supported: 3,
      unsupported: 0,
      deliberatelyIgnored: 0,
      unrecognized: 0,
      invalid: 0,
    },
    artifactFamilies: [],
    report: {
      exactRepeat: false,
      recognizedArtifacts: 3,
      newObservations: 3,
      equivalentObservations: 0,
      enrichedObservations: 0,
      amendedObservations: 0,
      preservedObservations: 0,
      conflicts: 0,
    },
    canonicalHistoryChanged: true,
    terminalCode: null,
    recoveryNote: null,
    ...overrides,
  };
}

function sourceAcquisitionGuides() {
  return [{
    schemaVersion: 1,
    sourceId: "polar-flow",
    guideVersion: "polar-flow-export-acquisition@1",
    verifiedOn: "2026-08-18",
    expectedArchive: "zip",
    instructionKeys: [
      "sign-in",
      "open-download-data",
      "request-export",
      "wait-for-email",
      "download-zip",
    ],
    constraintKeys: [
      "preparation-time-varies",
      "two-week-download-window",
      "derived-data-excluded",
    ],
    troubleshootingKeys: ["email-delivery", "expired-download", "archive-format"],
    officialLinks: [
      { purpose: "account", locale: null, url: "https://account.polar.com/" },
      {
        purpose: "instructions",
        locale: "en-US",
        url: "https://support.polar.com/en/how-to-download-all-your-data-from-polar-flow",
      },
      {
        purpose: "instructions",
        locale: "es-ES",
        url: "https://support.polar.com/es/how-to-download-all-your-data-from-polar-flow",
      },
    ],
  }];
}

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  homeInvoke: vi.fn(),
  preferencesInvoke: vi.fn(),
  interactiveShellInvoke: vi.fn(),
  recoveryInvoke: vi.fn(),
  longitudinalInvoke: vi.fn(),
  sleepInvoke: vi.fn(),
  updateInvoke: vi.fn(),
  sourceInvoke: vi.fn(),
  sportsInvoke: vi.fn(),
  open: vi.fn(),
  openUrl: vi.fn(),
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class Channel<T> {
    onmessage?: (message: T) => void;
  },
  invoke: (command: string, arguments_: Record<string, unknown>) =>
    command === "report_interactive_shell"
      ? mocks.interactiveShellInvoke(command, arguments_)
      : command === "query_library_home"
        || command === "save_exploration_workspace"
        || command === "clear_exploration_workspace"
      ? mocks.homeInvoke(command, arguments_)
      : command.endsWith("_preferences")
      ? mocks.preferencesInvoke(command, arguments_)
      : command.includes("update")
      ? mocks.updateInvoke(command, arguments_)
      : command === "query_source_acquisition_guides"
      ? mocks.sourceInvoke(command, arguments_)
      : command === "query_training_sports"
        || command === "save_training_sport_classification"
      ? mocks.sportsInvoke(command, arguments_)
      : command.startsWith("query_longitudinal_")
      ? mocks.longitudinalInvoke(command, arguments_)
      : command.startsWith("query_recovery_")
      ? mocks.recoveryInvoke(command, arguments_)
      : command.startsWith("query_sleep_")
      ? mocks.sleepInvoke(command, arguments_)
      : mocks.invoke(command, arguments_),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: mocks.listen,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: mocks.open,
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: mocks.openUrl,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  mocks.invoke.mockReset();
  mocks.homeInvoke.mockReset();
  mocks.preferencesInvoke.mockReset();
  mocks.interactiveShellInvoke.mockReset();
  mocks.recoveryInvoke.mockReset();
  mocks.longitudinalInvoke.mockReset();
  mocks.sleepInvoke.mockReset();
  mocks.updateInvoke.mockReset();
  mocks.sourceInvoke.mockReset();
  mocks.sportsInvoke.mockReset();
  mocks.open.mockReset();
  mocks.openUrl.mockReset();
  mocks.listen.mockReset();
});

beforeEach(() => {
  let storedPreferences = preferencesLoad();
  let nextFrame = 0;
  const scheduledFrames = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
    nextFrame += 1;
    const frame = nextFrame;
    scheduledFrames.set(frame, callback);
    queueMicrotask(() => {
      const scheduled = scheduledFrames.get(frame);
      if (!scheduled) return;
      scheduledFrames.delete(frame);
      scheduled(performance.now());
    });
    return frame;
  }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((frame: number) => {
    scheduledFrames.delete(frame);
  }));
  mocks.interactiveShellInvoke.mockResolvedValue(undefined);
  mocks.homeInvoke.mockImplementation((command) => {
    if (command === "query_library_home") return Promise.resolve(emptyLibraryHome());
    if (command === "clear_exploration_workspace") return Promise.resolve(undefined);
    throw new Error(`Unexpected Home command: ${command}`);
  });
  mocks.preferencesInvoke.mockImplementation((command, arguments_) => {
    if (command === "load_preferences") return Promise.resolve(storedPreferences);
    if (command === "save_preferences") {
      storedPreferences = {
        preferences: {
          version: 1,
          ...(arguments_.preferences as Omit<
            ApplicationPreferencesLoad["preferences"],
            "version"
          >),
        },
        status: "current",
      };
      return Promise.resolve(storedPreferences.preferences);
    }
    if (command === "reset_preferences") {
      storedPreferences = preferencesLoad(
        arguments_.defaultLocale as "en-US" | "es-ES",
      );
      return Promise.resolve(storedPreferences);
    }
    throw new Error(`Unexpected preference command: ${command}`);
  });
  mocks.listen.mockResolvedValue(() => {});
  mocks.recoveryInvoke.mockResolvedValue(emptyRecoveryOverview());
  mocks.longitudinalInvoke.mockResolvedValue(emptyLongitudinalOverview());
  mocks.sleepInvoke.mockResolvedValue(emptySleepOverview());
  mocks.sourceInvoke.mockResolvedValue(sourceAcquisitionGuides());
  mocks.sportsInvoke.mockImplementation((command) => {
    if (command === "query_training_sports") {
      return Promise.resolve({ originCount: 0, sessionCount: 0, sports: [] });
    }
    throw new Error(`Unexpected sports command: ${command}`);
  });
  mocks.openUrl.mockResolvedValue(undefined);
  mocks.invoke.mockImplementation((command) => {
    if (command === "query_activity_overview") {
      return Promise.resolve(emptyActivityOverview());
    }
    if (command === "query_training_overview") {
      return Promise.resolve(emptyTrainingOverview());
    }
    if (command === "query_latest_import_outcome") {
      return Promise.resolve(null);
    }
    throw new Error(`Unexpected command: ${command}`);
  });
  mocks.updateInvoke.mockImplementation((command) => {
    if (command === "confirm_update_recovery_startup") return Promise.resolve(null);
    if (command === "acknowledge_update_recovery_notice") return Promise.resolve(true);
    return Promise.resolve({
      installedVersion: "0.1.0",
      checkedAt: "2026-08-16T12:00:00Z",
      status: "unconfigured",
      release: null,
      installedWithdrawal: null,
      updateActionAvailable: false,
      postponedUntil: null,
      manualRecoveryReason: null,
      trustFailure: null,
    });
  });
});

function preferencesLoad(
  locale: "en-US" | "es-ES" = "en-US",
  status: ApplicationPreferencesLoad["status"] = "current",
): ApplicationPreferencesLoad {
  return {
    preferences: {
      version: 1,
      locale,
      appearance: "system",
      contentZoomPercent: 100,
    },
    status,
  };
}

function emptyLibrary(initialLocale: "en-US" | "es-ES" | null = "en-US") {
  let storedPreferences = preferencesLoad(initialLocale ?? "en-US", initialLocale ? "current" : "initialized");
  mocks.preferencesInvoke.mockImplementation((command, arguments_) => {
    if (command === "load_preferences") {
      if (initialLocale === null) {
        storedPreferences = preferencesLoad(
          arguments_.defaultLocale as "en-US" | "es-ES",
          "initialized",
        );
      }
      return Promise.resolve(storedPreferences);
    }
    if (command === "save_preferences") {
      storedPreferences = {
        preferences: {
          version: 1,
          ...(arguments_.preferences as Omit<
            ApplicationPreferencesLoad["preferences"],
            "version"
          >),
        },
        status: "current",
      };
      return Promise.resolve(storedPreferences.preferences);
    }
    if (command === "reset_preferences") {
      storedPreferences = preferencesLoad(arguments_.defaultLocale as "en-US" | "es-ES");
      return Promise.resolve(storedPreferences);
    }
    throw new Error(`Unexpected preference command: ${command}`);
  });
  mocks.invoke.mockImplementation((command) => {
    if (command === "query_activity_overview") return Promise.resolve(emptyActivityOverview());
    if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
    if (command === "query_latest_import_outcome") return Promise.resolve(null);
    throw new Error(`Unexpected command: ${command}`);
  });
  return {
    locale: () => storedPreferences.preferences.locale,
  };
}

async function chooseArchive(user: ReturnType<typeof userEvent.setup>, path: string) {
  mocks.open.mockResolvedValue(path);
  await user.click(await screen.findByRole("button", { name: "Choose ZIP package" }));
  expect(screen.getByText(path)).toBeVisible();
}

async function changeLanguageToSpanish(
  user: ReturnType<typeof userEvent.setup>,
  destination: "explore" | "sources" = "explore",
) {
  await user.click(screen.getByRole("button", { name: "Settings" }));
  await user.selectOptions(screen.getByLabelText("Interface language"), "es-ES");
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  const destinationName = destination === "explore" ? "Explorar" : "Orígenes";
  await waitFor(() => expect(screen.getByRole("button", { name: destinationName })).toBeVisible());
  await user.click(screen.getByRole("button", { name: destinationName }));
}

describe("FitFreed import interface", () => {
  it("opens a populated library at question-led Home and persists an explicit exploration", async () => {
    const home = populatedLibraryHome();
    mocks.homeInvoke.mockImplementation((command, arguments_) => {
      if (command === "query_library_home") return Promise.resolve(home);
      if (command === "save_exploration_workspace") {
        expect(arguments_).toEqual({ destination: "training" });
        return Promise.resolve({ version: 1, destination: "training" });
      }
      if (command === "clear_exploration_workspace") return Promise.resolve(undefined);
      throw new Error(`Unexpected Home command: ${command}`);
    });
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Your history, ready for your questions" }))
      .toBeVisible();
    expect(mocks.homeInvoke).toHaveBeenCalledWith("query_library_home", {
      request: { afterImportOperationRef: null },
    });
    expect(mocks.invoke).not.toHaveBeenCalledWith("query_training_overview", {
      requestedRange: null,
    });

    await user.click(screen.getByRole("button", { name: "Explore my training sessions" }));
    expect(await screen.findByRole("heading", { name: "Training history" })).toBeVisible();
    expect(mocks.homeInvoke).toHaveBeenCalledWith("save_exploration_workspace", {
      destination: "training",
    });

    await user.click(screen.getByRole("button", { name: "Back to Home" }));
    expect(await screen.findByRole("heading", { name: "Your history, ready for your questions" }))
      .toBeVisible();
    expect(mocks.homeInvoke).toHaveBeenCalledWith("clear_exploration_workspace", undefined);
  });

  it("restores a valid durable exploration without loading unrelated domains", async () => {
    mocks.homeInvoke.mockImplementation((command) => {
      if (command === "query_library_home") {
        return Promise.resolve(populatedLibraryHome({
          resumableExploration: { version: 1, destination: "training" },
        }));
      }
      throw new Error(`Unexpected Home command: ${command}`);
    });
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      throw new Error(`Unexpected command: ${command}`);
    });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Training history" })).toBeVisible();
    expect(mocks.invoke).not.toHaveBeenCalledWith("query_activity_overview", {
      requestedRange: null,
    });
    expect(mocks.longitudinalInvoke).not.toHaveBeenCalled();
    expect(mocks.sleepInvoke).not.toHaveBeenCalled();
    expect(mocks.recoveryInvoke).not.toHaveBeenCalled();
  });

  it("keeps Home usable when saving a question fails and permits an exact retry", async () => {
    const home = populatedLibraryHome();
    let saveFails = true;
    mocks.homeInvoke.mockImplementation((command) => {
      if (command === "query_library_home") return Promise.resolve(home);
      if (command === "save_exploration_workspace") {
        return saveFails
          ? Promise.reject({ code: "exploration-workspace-update-failed" })
          : Promise.resolve({ version: 1, destination: "training" });
      }
      throw new Error(`Unexpected Home command: ${command}`);
    });
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);
    const question = await screen.findByRole("button", {
      name: "Explore my training sessions",
    });

    await user.click(question);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not save the exploration safely",
    );
    expect(screen.getByRole("heading", { name: "What do you want to understand?" }))
      .toBeVisible();

    saveFails = false;
    await user.click(question);
    expect(await screen.findByRole("heading", { name: "Training history" })).toBeVisible();
  });

  it("opens and returns from every question without mounting unrelated explorers", async () => {
    const home = populatedLibraryHome({
      questions: [
        { kind: "explore-training-sessions", destination: "training" },
        { kind: "align-history", destination: "longitudinal" },
        { kind: "review-activity-steps", destination: "activity" },
        { kind: "review-sleep-patterns", destination: "sleep" },
        { kind: "review-recovery-patterns", destination: "recovery" },
      ],
    });
    mocks.homeInvoke.mockImplementation((command, arguments_) => {
      if (command === "query_library_home") return Promise.resolve(home);
      if (command === "save_exploration_workspace") {
        return Promise.resolve({ version: 1, destination: arguments_.destination });
      }
      if (command === "clear_exploration_workspace") return Promise.resolve(undefined);
      throw new Error(`Unexpected Home command: ${command}`);
    });
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity_overview") return Promise.resolve(emptyActivityOverview());
      if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);

    for (const [destination, heading] of [
      ["training", "Training history"],
      ["longitudinal", "Longitudinal dashboard"],
      ["activity", "Daily activity overview"],
      ["sleep", "Sleep history"],
      ["recovery", "Nightly recovery"],
    ] as const) {
      await user.click(await screen.findByRole("button", {
        name: questionForDestination[destination].label,
      }));
      expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeVisible();
      expect(screen.queryByRole("heading", { name: "What do you want to understand?" }))
        .not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Back to Home" }));
      expect(await screen.findByRole("heading", { name: "What do you want to understand?" }))
        .toBeVisible();
    }
  });

  it("drops a longitudinal day target before opening a new Home question", async () => {
    const home = populatedLibraryHome({
      questions: [
        { kind: "align-history", destination: "longitudinal" },
        { kind: "explore-training-sessions", destination: "training" },
      ],
    });
    mocks.homeInvoke.mockImplementation((command, arguments_) => {
      if (command === "query_library_home") return Promise.resolve(home);
      if (command === "save_exploration_workspace") {
        return Promise.resolve({ version: 1, destination: arguments_.destination });
      }
      if (command === "clear_exploration_workspace") return Promise.resolve(undefined);
      throw new Error(`Unexpected Home command: ${command}`);
    });
    mocks.longitudinalInvoke.mockImplementation((command) => {
      if (command === "query_longitudinal_overview") {
        return Promise.resolve(longitudinalOverviewWithTrainingDay());
      }
      throw new Error(`Unexpected longitudinal command: ${command}`);
    });
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_training_overview") {
        return Promise.resolve(trainingOverview([], arguments_.requestedRange ?? {
          from: "2026-01-01",
          through: "2026-01-31",
        }));
      }
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", {
      name: questionForDestination.longitudinal.label,
    }));
    await user.click(await screen.findByRole("button", {
      name: "View aligned details for Jan 4, 2026",
    }));
    await user.click(screen.getByRole("link", {
      name: "Open training explorer for this date",
    }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "query_training_overview",
      { requestedRange: { from: "2026-01-04", through: "2026-01-04" } },
    ));

    await user.click(screen.getByRole("button", { name: "Back to Home" }));
    await user.click(await screen.findByRole("button", {
      name: questionForDestination.training.label,
    }));

    await waitFor(() => {
      const trainingCalls = mocks.invoke.mock.calls.filter(
        ([command]) => command === "query_training_overview",
      );
      expect(trainingCalls.at(-1)?.[1]).toEqual({ requestedRange: null });
    });
  });

  it("guides first-run acquisition offline and opens only the localized official destinations", async () => {
    emptyLibrary();
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("heading", {
      name: "Bring your fitness history home",
    })).toBeVisible();
    expect(screen.getByRole("heading", { name: "I have the ZIP" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "I need the ZIP" })).toBeVisible();
    await waitFor(() => expect(mocks.sourceInvoke).toHaveBeenCalledWith(
      "query_source_acquisition_guides",
      undefined,
    ));

    await user.click(screen.getByRole("button", { name: "Show me how" }));
    const englishGuide = screen.getByRole("region", {
      name: "How to obtain your Polar Flow export",
    });
    expect(within(englishGuide).getByText(/available.*two weeks/i)).toBeVisible();
    await user.click(within(englishGuide).getByRole("button", {
      name: "Open official instructions",
    }));
    expect(mocks.openUrl).toHaveBeenLastCalledWith(
      "https://support.polar.com/en/how-to-download-all-your-data-from-polar-flow",
    );

    await user.click(screen.getByRole("button", { name: "Explore" }));
    expect(screen.getByRole("heading", { name: "Start with your own history" }))
      .toBeVisible();
    await changeLanguageToSpanish(user, "sources");
    const spanishGuide = screen.getByRole("region", {
      name: "Cómo obtener tu exportación de Polar Flow",
    });
    expect(within(spanishGuide).getByText(/disponible.*dos semanas/i)).toBeVisible();
    await user.click(within(spanishGuide).getByRole("button", {
      name: "Abrir las instrucciones oficiales",
    }));
    expect(mocks.openUrl).toHaveBeenLastCalledWith(
      "https://support.polar.com/es/how-to-download-all-your-data-from-polar-flow",
    );
  });

  it("applies the complete saved preference set before revealing the ordinary shell", async () => {
    let completePreferences!: (load: ApplicationPreferencesLoad) => void;
    mocks.preferencesInvoke.mockImplementation((command) => {
      if (command === "load_preferences") {
        return new Promise((resolve) => {
          completePreferences = resolve;
        });
      }
      throw new Error(`Unexpected preference command: ${command}`);
    });

    render(<App />);

    await waitFor(() => expect(completePreferences).toBeTypeOf("function"));
    expect(screen.queryByRole("heading", { name: /fitness history belongs/i }))
      .not.toBeInTheDocument();

    await act(async () => completePreferences({
      preferences: {
        version: 1,
        locale: "es-ES",
        appearance: "dark",
        contentZoomPercent: 175,
      },
      status: "current",
    }));

    expect(await screen.findByRole("heading", { name: spanish.sources.title })).toBeVisible();
    expect(document.documentElement).toHaveAttribute("lang", "es-ES");
    expect(document.documentElement).toHaveAttribute("data-appearance", "dark");
    expect(document.documentElement.style.getPropertyValue("--content-zoom")).toBe("1.75");
    expect(mocks.preferencesInvoke).toHaveBeenCalledWith("load_preferences", {
      defaultLocale: "en-US",
    });
  });

  it("previews, saves, restores, and resets every setting from the Settings home", async () => {
    emptyLibrary();
    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(await screen.findByRole("button", { name: "Settings" }));
    await user.selectOptions(screen.getByLabelText("Interface language"), "es-ES");
    await user.click(screen.getByRole("radio", { name: "Oscuro" }));
    await user.selectOptions(
      screen.getByLabelText("Ampliación predeterminada del contenido"),
      "200",
    );
    expect(document.documentElement).toHaveAttribute("data-appearance", "dark");
    expect(document.documentElement.style.getPropertyValue("--content-zoom")).toBe("2");

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(mocks.preferencesInvoke).toHaveBeenCalledWith(
      "save_preferences",
      {
        preferences: {
          locale: "es-ES",
          appearance: "dark",
          contentZoomPercent: 200,
        },
      },
    ));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Ajustes guardados en este dispositivo.",
    );

    view.unmount();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Ajustes" }));
    expect(screen.getByRole("radio", { name: "Oscuro" })).toBeChecked();
    expect(screen.getByLabelText("Ampliación predeterminada del contenido")).toHaveValue("200");

    await user.click(screen.getByRole("button", { name: "Restaurar valores predeterminados" }));
    await waitFor(() => expect(mocks.preferencesInvoke).toHaveBeenCalledWith(
      "reset_preferences",
      { defaultLocale: "en-US" },
    ));
    expect(document.documentElement).toHaveAttribute("data-appearance", "system");
    expect(document.documentElement.style.getPropertyValue("--content-zoom")).toBe("1");
  });

  it("discards an unsaved appearance preview when leaving Settings", async () => {
    emptyLibrary();
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    await user.selectOptions(screen.getByLabelText("Default content zoom"), "175");
    expect(document.documentElement).toHaveAttribute("data-appearance", "dark");

    await user.click(screen.getByRole("button", { name: "Explore" }));

    expect(document.documentElement).toHaveAttribute("data-appearance", "system");
    expect(document.documentElement.style.getPropertyValue("--content-zoom")).toBe("1");
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
    expect(screen.getByLabelText("Default content zoom")).toHaveValue("100");
  });

  it("preserves the active Explore workspace while Settings is open", async () => {
    offerExploration("training");
    const earlier: TestTrainingSession = {
      sessionRef: "earlier-session",
      startedAtLocal: "2026-01-18T08:00:00",
      stoppedAtLocal: "2026-01-18T08:30:00",
      utcOffsetMinutes: null,
      durationMilliseconds: "1800000",
      distanceMeters: null,
      energyKilocalories: null,
      averageHeartRateBpm: null,
      maximumHeartRateBpm: null,
      sportRef: null,
      exerciseCount: null,
    };
    const later: TestTrainingSession = {
      ...earlier,
      sessionRef: "later-session",
      startedAtLocal: "2026-01-20T09:00:00",
      stoppedAtLocal: "2026-01-20T10:00:00",
      durationMilliseconds: "3600000",
    };
    const fullOverview = trainingOverview([later, earlier]);
    const filteredOverview = trainingOverview(
      [later],
      { from: "2026-01-20", through: "2026-01-20" },
    );
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_activity_overview") return Promise.resolve(emptyActivityOverview());
      if (command === "query_training_overview") {
        return Promise.resolve(
          arguments_.requestedRange?.from === "2026-01-20"
            ? filteredOverview
            : fullOverview,
        );
      }
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);

    await enterExploration(user, "training");
    const training = await screen.findByRole("region", { name: "Training history" });
    expect(await within(training).findAllByRole("button", { name: /View training details/ }))
      .toHaveLength(2);
    const filter = within(training).getByRole("form", { name: "Explore a training period" });
    await user.clear(within(filter).getByLabelText("From"));
    await user.type(within(filter).getByLabelText("From"), "2026-01-20");
    await user.clear(within(filter).getByLabelText("Through"));
    await user.type(within(filter).getByLabelText("Through"), "2026-01-20");
    await user.click(within(filter).getByRole("button", { name: "Apply training period" }));
    await waitFor(() => expect(within(training)
      .getAllByRole("button", { name: /View training details/ })).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("region", { name: "Make FitFreed feel right on this device" }))
      .toBeVisible();
    await user.click(screen.getByRole("button", { name: "Explore" }));

    const restoredTraining = screen.getByRole("region", { name: "Training history" });
    const restoredFilter = within(restoredTraining).getByRole("form", {
      name: "Explore a training period",
    });
    expect(within(restoredFilter).getByLabelText("From")).toHaveValue("2026-01-20");
    expect(within(restoredFilter).getByLabelText("Through")).toHaveValue("2026-01-20");
    expect(within(restoredTraining).getAllByRole("button", { name: /View training details/ }))
      .toHaveLength(1);
  });

  it("discloses when an invalid stored preference set was safely recovered", async () => {
    emptyLibrary();
    mocks.preferencesInvoke.mockResolvedValue(preferencesLoad("en-US", "recovered"));
    render(<App />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "FitFreed restored safe application defaults because the stored settings were not compatible",
    );
  });

  it("reports the painted shell before deferred startup without awaiting diagnostic settlement", async () => {
    const user = userEvent.setup();
    let completePreferences!: (load: ApplicationPreferencesLoad) => void;
    let renderFrame: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      renderFrame = callback;
      return 1;
    }));
    mocks.interactiveShellInvoke.mockImplementation(() => new Promise<void>(() => undefined));
    mocks.preferencesInvoke.mockImplementation((command) => {
      if (command === "load_preferences") {
        return new Promise((resolve) => {
          completePreferences = resolve;
        });
      }
      throw new Error(`Unexpected preference command: ${command}`);
    });
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity_overview") return Promise.resolve(emptyActivityOverview());
      if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    await waitFor(() => expect(completePreferences).toBeTypeOf("function"));
    expect(screen.queryByRole("button", { name: "Choose ZIP package" })).not.toBeInTheDocument();
    expect(mocks.interactiveShellInvoke).not.toHaveBeenCalled();
    await act(async () => completePreferences(preferencesLoad()));
    await waitFor(() => expect(renderFrame).toBeTypeOf("function"));
    await chooseArchive(user, "/synthetic/pending-startup.zip");
    expect(screen.getByRole("button", { name: "Import selected package" })).toBeEnabled();
    expect(mocks.interactiveShellInvoke).not.toHaveBeenCalled();
    await act(async () => renderFrame?.(performance.now()));
    await waitFor(() => expect(mocks.interactiveShellInvoke).toHaveBeenCalledTimes(1));
    const startupArguments = mocks.interactiveShellInvoke.mock.calls[0]?.[1];
    expect(startupArguments).toEqual({
      rendererStartupMilliseconds: {
        localeReady: expect.any(Number),
        signal: expect.any(Number),
      },
    });
    expect(startupArguments.rendererStartupMilliseconds.localeReady).toBeGreaterThanOrEqual(0);
    expect(startupArguments.rendererStartupMilliseconds.signal).toBeGreaterThanOrEqual(
      startupArguments.rendererStartupMilliseconds.localeReady,
    );
    await waitFor(() => {
      expect(mocks.homeInvoke).toHaveBeenCalledWith("query_library_home", {
        request: { afterImportOperationRef: null },
      });
      expect(mocks.invoke).toHaveBeenCalledWith("query_latest_import_outcome", undefined);
      expect(mocks.invoke).not.toHaveBeenCalledWith("query_activity_overview", {
        requestedRange: null,
      });
      expect(mocks.invoke).not.toHaveBeenCalledWith("query_training_overview", {
        requestedRange: null,
      });
      expect(mocks.longitudinalInvoke).not.toHaveBeenCalled();
      expect(mocks.sleepInvoke).not.toHaveBeenCalled();
      expect(mocks.recoveryInvoke).not.toHaveBeenCalled();
      expect(mocks.updateInvoke).toHaveBeenCalledWith(
        "confirm_update_recovery_startup",
        undefined,
      );
      expect(mocks.updateInvoke).toHaveBeenCalledWith(
        "check_for_updates_on_launch",
        undefined,
      );
    });
    expect(mocks.interactiveShellInvoke.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.homeInvoke.mock.invocationCallOrder[0],
    );
    expect(mocks.interactiveShellInvoke.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.sourceInvoke.mock.invocationCallOrder[0],
    );
  });

  it("continues startup without emitting painted-shell evidence when no frame is delivered", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    render(<App />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.sourceInvoke).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(mocks.interactiveShellInvoke).not.toHaveBeenCalled();
    expect(mocks.homeInvoke).toHaveBeenCalledWith("query_library_home", {
      request: { afterImportOperationRef: null },
    });
    expect(mocks.sourceInvoke).toHaveBeenCalledWith(
      "query_source_acquisition_guides",
      undefined,
    );
    expect(mocks.updateInvoke).toHaveBeenCalledWith(
      "check_for_updates_on_launch",
      undefined,
    );
  });

  it("blocks mutable desktop controls while an update installation owns the application", async () => {
    emptyLibrary();
    let rejectInstallation!: (reason: unknown) => void;
    mocks.updateInvoke.mockImplementation((command) => {
      if (command === "confirm_update_recovery_startup") return Promise.resolve(false);
      if (command === "check_for_updates_on_launch") {
        return Promise.resolve({
          installedVersion: "0.1.0",
          checkedAt: "2026-08-17T08:00:00Z",
          status: "available",
          release: {
            version: "0.2.0",
            publishedAt: "2026-08-17T07:00:00Z",
            releaseNotes: "Synthetic update.",
            minimumSupportedVersion: "0.1.0",
            targetLibrarySchemaVersion: 9,
          },
          installedWithdrawal: null,
          updateActionAvailable: true,
          postponedUntil: null,
          manualRecoveryReason: null,
          trustFailure: null,
        });
      }
      if (command === "install_available_update") {
        return new Promise((_, reject) => {
          rejectInstallation = reject;
        });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);
    await chooseArchive(user, "/synthetic/valid.zip");
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await screen.findByRole("button", { name: "Install and restart" });

    await user.click(screen.getByRole("button", { name: "Install and restart" }));

    await user.click(screen.getByRole("button", { name: "Sources" }));
    expect(screen.getByRole("button", { name: "Choose ZIP package" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Import selected package" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByLabelText("Interface language")).toBeDisabled();
    expect(screen.getByLabelText("Default content zoom")).toBeDisabled();

    await act(async () => rejectInstallation({ code: "update-native-installer-failed" }));
    await waitFor(() => expect(screen.getByLabelText("Interface language")).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Sources" }));
    await waitFor(() => expect(
      screen.getByRole("button", { name: "Choose ZIP package" }),
    ).toBeEnabled());
    expect(screen.getByRole("button", { name: "Import selected package" })).toBeEnabled();
  });

  it("keeps library actions unavailable when startup recovery fails", async () => {
    const user = userEvent.setup();
    mocks.preferencesInvoke.mockImplementation((command) => {
      if (command === "load_preferences") {
        return Promise.reject({ code: "library-unavailable" });
      }
      throw new Error(`Unexpected preference command: ${command}`);
    });

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      catalogs["en-US"].errors["library-unavailable"],
    );
    await chooseArchive(user, "/synthetic/unavailable-library.zip");
    expect(screen.getByRole("button", { name: "Import selected package" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByLabelText("Interface language")).toBeDisabled();
    expect(mocks.interactiveShellInvoke).not.toHaveBeenCalled();
    expect(mocks.preferencesInvoke).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.longitudinalInvoke).not.toHaveBeenCalled();
    expect(mocks.sleepInvoke).not.toHaveBeenCalled();
    expect(mocks.recoveryInvoke).not.toHaveBeenCalled();
    expect(mocks.updateInvoke).not.toHaveBeenCalled();
  });

  it("requests backend-owned update confirmation only after locale startup completes", async () => {
    let completePreferences!: (load: ApplicationPreferencesLoad) => void;
    mocks.preferencesInvoke.mockImplementation((command) => {
      if (command === "load_preferences") {
        return new Promise((resolve) => {
          completePreferences = resolve;
        });
      }
      throw new Error(`Unexpected preference command: ${command}`);
    });
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity_overview") return Promise.resolve(emptyActivityOverview());
      if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    await waitFor(() => expect(completePreferences).toBeTypeOf("function"));
    expect(mocks.updateInvoke).not.toHaveBeenCalledWith(
      "confirm_update_recovery_startup",
      undefined,
    );
    await act(async () => completePreferences(preferencesLoad()));
    await waitFor(() => expect(mocks.updateInvoke).toHaveBeenCalledWith(
      "confirm_update_recovery_startup",
      undefined,
    ));
  });

  it("reports candidate confirmation failure without exposing recovery details", async () => {
    emptyLibrary();
    mocks.updateInvoke.mockImplementation((command) => {
      if (command === "confirm_update_recovery_startup") {
        return Promise.reject({
          code: "update-recovery-confirmation-failed",
          detail: "/private/update-recovery/attempts/synthetic",
        });
      }
      if (command === "check_for_updates_on_launch") {
        return Promise.resolve({
          installedVersion: "0.1.0",
          checkedAt: "2026-08-16T12:00:00Z",
          status: "unconfigured",
          release: null,
          installedWithdrawal: null,
          updateActionAvailable: false,
          postponedUntil: null,
          manualRecoveryReason: null,
          trustFailure: null,
        });
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "could not confirm the updated application and library",
    );
    expect(alert).not.toHaveTextContent("/private/update-recovery");
  });

  it("reports and explicitly acknowledges a verified update outcome without exposing its identifier", async () => {
    emptyLibrary();
    mocks.updateInvoke.mockImplementation((command) => {
      if (command === "confirm_update_recovery_startup") {
        return Promise.resolve({
          outcome: "updated",
          sourceVersion: "0.1.0",
          targetVersion: "0.2.0",
          recoveryId: "private-recovery-identifier",
        });
      }
      if (command === "acknowledge_update_recovery_notice") return Promise.resolve(true);
      if (command === "check_for_updates_on_launch") {
        return Promise.resolve({
          installedVersion: "0.2.0",
          checkedAt: "2026-08-17T09:00:00Z",
          status: "unconfigured",
          release: null,
          installedWithdrawal: null,
          updateActionAvailable: false,
          postponedUntil: null,
          manualRecoveryReason: null,
          trustFailure: null,
        });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    render(<App />);

    const status = await screen.findByRole("status", { name: "Update completed" });
    expect(status).toHaveTextContent("FitFreed updated from version 0.1.0 to 0.2.0");
    expect(status).not.toHaveTextContent("private-recovery-identifier");
    await user.click(screen.getByRole("button", { name: "Dismiss update result" }));
    expect(mocks.updateInvoke).toHaveBeenCalledWith(
      "acknowledge_update_recovery_notice",
      undefined,
    );
    await waitFor(() => expect(
      screen.queryByRole("status", { name: "Update completed" }),
    ).not.toBeInTheDocument());
  });

  it("explains automatic recovery in the persisted Spanish locale", async () => {
    emptyLibrary("es-ES");
    mocks.updateInvoke.mockImplementation((command) => {
      if (command === "confirm_update_recovery_startup") {
        return Promise.resolve({
          outcome: "recovered",
          sourceVersion: "0.1.0",
          targetVersion: "0.2.0",
        });
      }
      if (command === "check_for_updates_on_launch") {
        return Promise.resolve({
          installedVersion: "0.1.0",
          checkedAt: "2026-08-17T09:00:00Z",
          status: "unconfigured",
          release: null,
          installedWithdrawal: null,
          updateActionAvailable: false,
          postponedUntil: null,
          manualRecoveryReason: null,
          trustFailure: null,
        });
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    const status = await screen.findByRole("status", {
      name: "Recuperación de actualización completada",
    });
    expect(status).toHaveTextContent(
      "FitFreed ha restaurado automáticamente la versión 0.1.0 después de que la actualización a la versión 0.2.0 no se completara",
    );
  });

  it("retains the update result when acknowledgement fails and permits a retry", async () => {
    emptyLibrary();
    let acknowledgementFails = true;
    mocks.updateInvoke.mockImplementation((command) => {
      if (command === "confirm_update_recovery_startup") {
        return Promise.resolve({
          outcome: "updated",
          sourceVersion: "0.1.0",
          targetVersion: "0.2.0",
        });
      }
      if (command === "acknowledge_update_recovery_notice") {
        if (acknowledgementFails) {
          return Promise.reject({
            code: "update-recovery-outcome-failed",
            detail: "/private/recovery/outcome",
          });
        }
        return Promise.resolve(true);
      }
      if (command === "check_for_updates_on_launch") {
        return Promise.resolve({
          installedVersion: "0.2.0",
          checkedAt: "2026-08-17T09:00:00Z",
          status: "unconfigured",
          release: null,
          installedWithdrawal: null,
          updateActionAvailable: false,
          postponedUntil: null,
          manualRecoveryReason: null,
          trustFailure: null,
        });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);
    const button = await screen.findByRole("button", { name: "Dismiss update result" });

    await user.click(button);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("could not finish or acknowledge update recovery safely");
    expect(alert).not.toHaveTextContent("/private/recovery");
    expect(screen.getByRole("status", { name: "Update completed" })).toBeVisible();

    acknowledgementFails = false;
    await user.click(button);
    await waitFor(() => expect(
      screen.queryByRole("status", { name: "Update completed" }),
    ).not.toBeInTheDocument());
  });

  it("explains family coverage with localized reasons and next actions without source locators", async () => {
    const latestOutcome = importOutcome({
      coverage: {
        total: 13,
        supported: 7,
        unsupported: 0,
        deliberatelyIgnored: 1,
        unrecognized: 1,
        invalid: 4,
      },
      artifactFamilies: [
        {
          familyCode: "polar-flow-daily-activity",
          classification: "invalid",
          reasonCode: "invalid-supported-artifact",
          artifactCount: 1,
        },
        {
          familyCode: null,
          classification: "unrecognized",
          reasonCode: "unrecognized-artifact-family",
          artifactCount: 1,
        },
        {
          familyCode: "polar-flow-daily-activity",
          classification: "invalid",
          reasonCode: "filename-content-date-mismatch",
          artifactCount: 1,
        },
        {
          familyCode: "polar-flow-daily-activity",
          classification: "invalid",
          reasonCode: "duplicate-daily-activity-date",
          artifactCount: 2,
        },
        {
          familyCode: "polar-flow-sleep-result",
          classification: "supported",
          reasonCode: "mapped-sleep-periods",
          artifactCount: 1,
        },
        {
          familyCode: "polar-flow-sleep-score",
          classification: "supported",
          reasonCode: "mapped-sleep-scores",
          artifactCount: 1,
        },
        {
          familyCode: "polar-flow-profile-picture",
          classification: "deliberately-ignored",
          reasonCode: "mvp-excludes-profile-picture",
          artifactCount: 1,
        },
        {
          familyCode: "polar-flow-account-data",
          classification: "supported",
          reasonCode: "source-subject-claim",
          artifactCount: 1,
        },
        {
          familyCode: "polar-flow-daily-activity",
          classification: "supported",
          reasonCode: "mapped",
          artifactCount: 3,
        },
        {
          familyCode: "polar-flow-training-session",
          classification: "supported",
          reasonCode: "mapped-summary",
          artifactCount: 1,
        },
      ],
    });
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity_overview") return Promise.resolve(emptyActivityOverview());
      if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
      if (command === "query_latest_import_outcome") return Promise.resolve(latestOutcome);
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);

    const coverage = await screen.findByRole("table", { name: "Coverage by data family" });
    expect(within(coverage).getAllByRole("row")).toHaveLength(11);
    expect(within(coverage).getByRole("row", {
      name: /Daily activity Invalid 1 Reason: Recognized content failed validation\. Next action: Keep the original ZIP and report the compatibility problem/,
    })).toBeVisible();
    expect(within(coverage).getByRole("row", {
      name: /Unrecognized data Unrecognized 1 Reason: The file does not match a known data family\. Next action: Keep the original ZIP and report the compatibility problem/,
    })).toBeVisible();
    expect(within(coverage).getByRole("row", {
      name: /Daily activity Invalid 1 Reason: The filename date and the date inside the activity record disagree\. Next action: Keep the original ZIP and report the compatibility problem/,
    })).toBeVisible();
    expect(within(coverage).getByRole("row", {
      name: /Daily activity Invalid 2 Reason: The package contains more than one daily activity record for the same date\. Next action: Request a new export or report the compatibility problem/,
    })).toBeVisible();
    expect(within(coverage).getByRole("row", {
      name: /Sleep results Supported 1 Reason: Sleep periods, phases, and interruptions are mapped; alarm behavior and source-only metadata stay only in the original ZIP\. Next action: Keep the original ZIP if you need the excluded sleep details/,
    })).toBeVisible();
    expect(within(coverage).getByRole("row", {
      name: /Sleep scores Supported 1 Reason: Sleep score components are mapped; scoring baselines stay only in the original ZIP\. Next action: Keep the original ZIP if you need the excluded scoring context/,
    })).toBeVisible();
    expect(within(coverage).getByRole("row", {
      name: /Training sessions Supported 1 Reason: The session summary is mapped; routes and full-resolution details stay only in the original ZIP\. Next action: Keep the original ZIP if you need the excluded training details/,
    })).toBeVisible();
    expect(screen.queryByText(/activity-2026-01-01/)).not.toBeInTheDocument();

    await changeLanguageToSpanish(user, "sources");
    const spanishCoverage = screen.getByRole("table", { name: "Cobertura por familia de datos" });
    expect(within(spanishCoverage).getByRole("row", {
      name: /Actividad diaria No válido 1 Motivo: El contenido reconocido no ha superado la validación\. Siguiente acción: Conserva el ZIP original y comunica el problema de compatibilidad/,
    })).toBeVisible();
    expect(within(spanishCoverage).getByRole("row", {
      name: /Actividad diaria No válido 2 Motivo: El paquete contiene más de un registro de actividad diaria para la misma fecha\. Siguiente acción: Solicita una nueva exportación o comunica el problema de compatibilidad/,
    })).toBeVisible();
    expect(within(spanishCoverage).getByRole("row", {
      name: /Resultados del sueño Compatible 1 Motivo: Se incorporan los periodos, las fases y las interrupciones del sueño; el comportamiento de las alarmas y los metadatos exclusivos del origen permanecen únicamente en el ZIP original\. Siguiente acción: Conserva el ZIP original si necesitas los detalles del sueño excluidos/,
    })).toBeVisible();
    expect(within(spanishCoverage).getByRole("row", {
      name: /Puntuaciones del sueño Compatible 1 Motivo: Se incorporan los componentes de la puntuación del sueño; las referencias de puntuación permanecen únicamente en el ZIP original\. Siguiente acción: Conserva el ZIP original si necesitas el contexto de puntuación excluido/,
    })).toBeVisible();
    expect(within(spanishCoverage).getByRole("row", {
      name: /Sesiones de entrenamiento Compatible 1 Motivo: Se incorpora el resumen de la sesión; las rutas y los detalles a resolución completa permanecen únicamente en el ZIP original\. Siguiente acción: Conserva el ZIP original si necesitas los detalles de entrenamiento excluidos/,
    })).toBeVisible();
  });

  it("explains a changed source-subject claim without exposing identity evidence", async () => {
    let latestOutcome: ReturnType<typeof importOutcome> | null = null;
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity_overview") return Promise.resolve(emptyActivityOverview());
      if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
      if (command === "query_latest_import_outcome") return Promise.resolve(latestOutcome);
      if (command === "import_archive") {
        latestOutcome = importOutcome({
          state: "rejected",
          coverageComplete: false,
          coverage: {
            total: 2,
            supported: 1,
            unsupported: 0,
            deliberatelyIgnored: 0,
            unrecognized: 0,
            invalid: 0,
          },
          report: {
            exactRepeat: false,
            recognizedArtifacts: 1,
            newObservations: 0,
            equivalentObservations: 0,
            enrichedObservations: 0,
            amendedObservations: 0,
            preservedObservations: 0,
            conflicts: 0,
          },
          canonicalHistoryChanged: false,
          terminalCode: "source-subject-confirmation-required",
        });
        return Promise.reject({ code: "import-failed" });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);
    await chooseArchive(user, "/synthetic/different-subject.zip");

    await user.click(screen.getByRole("button", { name: "Import selected package" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "FitFreed will not merge it with the existing history automatically",
    );
    expect(screen.getByText("Import rejected; no history was changed.")).toBeVisible();
    expect(screen.queryByText(/fixture-(?:primary|other)-claim/)).not.toBeInTheDocument();

    await changeLanguageToSpanish(user, "sources");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "FitFreed no lo combinará automáticamente con el historial existente",
    );
  });

  it("persists an explicit locale and restores every visible message after remount", async () => {
    const preferences = emptyLibrary();
    const user = userEvent.setup();
    const view = render(<App />);

    expect(await screen.findByRole("heading", { name: "Bring your fitness history home" })).toBeVisible();
    await changeLanguageToSpanish(user);

    expect(screen.getByRole("heading", { name: spanish.home.emptyHeading })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Ajustes" }));
    expect(screen.getByRole("heading", { name: spanish.updates.heading })).toBeVisible();
    expect(screen.getByRole("button", { name: spanish.updates.checkNow })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Orígenes" }));
    expect(screen.getByRole("heading", { name: spanish.sources.title })).toBeVisible();
    expect(screen.getByRole("button", { name: spanish.choose })).toBeEnabled();
    await waitFor(() => expect(preferences.locale()).toBe("es-ES"));
    await waitFor(() => expect(mocks.updateInvoke.mock.calls.filter(
      ([command]) => command === "check_for_updates_on_launch",
    )).toHaveLength(2));

    view.unmount();
    render(<App />);
    expect(await screen.findByRole("heading", { name: spanish.sources.title })).toBeVisible();
  });

  it("initializes the first supported operating-system language on first run", async () => {
    vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["fr-FR", "es-MX"]);
    const preferences = emptyLibrary(null);

    render(<App />);

    expect(await screen.findByRole("heading", { name: spanish.sources.title })).toBeVisible();
    await waitFor(() => expect(preferences.locale()).toBe("es-ES"));
  });

  it("falls back to English when the operating system has no supported language", async () => {
    vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["fr-FR", "de-DE"]);
    const preferences = emptyLibrary(null);

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Bring your fitness history home" }),
    ).toBeVisible();
    await waitFor(() => expect(preferences.locale()).toBe("en-US"));
  });

  it("keeps the operating-system locale for the session when first-run persistence fails", async () => {
    vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["es-ES"]);
    mocks.preferencesInvoke.mockImplementation((command) => {
      if (command === "load_preferences") {
        return Promise.reject({ code: "preference-update-failed" });
      }
      throw new Error(`Unexpected preference command: ${command}`);
    });
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity_overview") return Promise.resolve(emptyActivityOverview());
      if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: spanish.sources.title })).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      spanish.errors["preference-initialization-failed"],
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Ajustes" }));
    expect(screen.getByLabelText("Idioma de la interfaz")).toBeEnabled();
  });

  it("restores the previous locale when persistence fails", async () => {
    mocks.preferencesInvoke.mockImplementation((command) => {
      if (command === "load_preferences") return Promise.resolve(preferencesLoad());
      if (command === "save_preferences") {
        return Promise.reject({ code: "preference-update-failed" });
      }
      throw new Error(`Unexpected preference command: ${command}`);
    });
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity_overview") return Promise.resolve(emptyActivityOverview());
      if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Settings" }));
    await user.selectOptions(screen.getByLabelText("Interface language"), "es-ES");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(screen.getByLabelText("Interface language")).toHaveValue("en-US"));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "could not save the application settings",
    );
  });

  it("uses locale plural rules for import and coverage counts", async () => {
    const singularOutcome = importOutcome({
      coverage: {
        total: 1,
        supported: 1,
        unsupported: 0,
        deliberatelyIgnored: 0,
        unrecognized: 0,
        invalid: 0,
      },
      report: {
        exactRepeat: false,
        recognizedArtifacts: 1,
        newObservations: 1,
        equivalentObservations: 1,
        enrichedObservations: 1,
        amendedObservations: 1,
        preservedObservations: 1,
        conflicts: 1,
      },
    });
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity_overview") return Promise.resolve(emptyActivityOverview());
      if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
      if (command === "query_latest_import_outcome") return Promise.resolve(singularOutcome);
      throw new Error(`Unexpected command: ${command}`);
    });
    mocks.preferencesInvoke.mockResolvedValue(preferencesLoad("es-ES"));

    render(<App />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      `${spanish.completed}: 1 ${spanish.counts.recognized.one}, 1 ${spanish.counts.created.one}, 1 ${spanish.counts.enriched.one}, 1 ${spanish.counts.amended.one}, 1 ${spanish.counts.equivalent.one}, 1 ${spanish.counts.preserved.one}, 1 ${spanish.counts.conflicts.one}.`,
    );
    expect(screen.getByText(`${spanish.outcome.artifactsClassified.one}.`)).toBeVisible();
  });

  it("renders exact gap-aware activity insight values and localized availability", async () => {
    offerExploration("activity");
    const overview = activityOverview([
      {
        localDate: "2026-01-01",
        stepCount: "9007199254740993",
        availability: "available",
      },
      { localDate: "2026-01-02", stepCount: null, availability: "missing" },
      { localDate: "2026-01-03", stepCount: null, availability: "unavailable" },
    ]);
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity_overview") return Promise.resolve(overview);
      if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);

    await enterExploration(user, "activity");
    const summary = await screen.findByRole("list", { name: "Daily activity overview" });
    const total = within(summary).getByText("Total steps").closest("li");
    const average = within(summary).getByText("Average per day with steps").closest("li");
    const missing = within(summary).getByText("Days with no observation").closest("li");
    expect(total).not.toBeNull();
    expect(average).not.toBeNull();
    expect(missing).not.toBeNull();
    expect(within(total!).getByText("9,007,199,254,740,993")).toBeVisible();
    expect(within(average!).getByText("9,007,199,254,740,993")).toBeVisible();
    expect(within(missing!).getByText("1")).toBeVisible();

    const history = screen.getByRole("table", { name: "Daily activity overview" });
    const rows = within(history).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(within(rows[2]).getByText("No observation")).toBeVisible();
    expect(within(rows[3]).getByText("Observation available; step total unavailable")).toBeVisible();

    await changeLanguageToSpanish(user);
    const spanishHistory = screen.getByRole("table", { name: spanish.activity.heading });
    const spanishRows = within(spanishHistory).getAllByRole("row");
    expect(within(spanishRows[2]).getByText(spanish.activity.missing)).toBeVisible();
    expect(within(spanishRows[3]).getByText(spanish.activity.unavailable)).toBeVisible();
  });

  it("filters an inclusive range, rejects invalid input, resets it, and opens daily detail", async () => {
    offerExploration("activity");
    const complete = activityOverview([
      { localDate: "2026-01-01", stepCount: "1000", availability: "available" },
      { localDate: "2026-01-02", stepCount: "2000", availability: "available" },
      { localDate: "2026-01-03", stepCount: null, availability: "unavailable" },
      { localDate: "2026-01-04", stepCount: null, availability: "missing" },
      { localDate: "2026-01-05", stepCount: "5000", availability: "available" },
    ]);
    const filtered = activityOverview([
      { localDate: "2026-01-02", stepCount: "2000", availability: "available" },
      { localDate: "2026-01-03", stepCount: null, availability: "unavailable" },
      { localDate: "2026-01-04", stepCount: null, availability: "missing" },
    ]);
    filtered.availableRange = complete.availableRange;
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_activity_overview") {
        return Promise.resolve(arguments_?.requestedRange ? filtered : complete);
      }
      if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);

    await enterExploration(user, "activity");
    const from = await screen.findByLabelText("From");
    const through = screen.getByLabelText("Through");
    expect(from).toHaveValue("2026-01-01");
    expect(through).toHaveValue("2026-01-05");

    await user.clear(from);
    await user.type(from, "2026-01-02");
    await user.clear(through);
    await user.type(through, "2026-01-04");
    await user.click(screen.getByRole("button", { name: "Apply range" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("query_activity_overview", {
      requestedRange: { from: "2026-01-02", through: "2026-01-04" },
    }));
    expect(within(screen.getByRole("table", { name: "Daily activity overview" }))
      .getAllByRole("row")).toHaveLength(4);

    const detailButtons = screen.getAllByRole("button", {
      name: "View details for Jan 3, 2026",
    });
    await user.click(detailButtons.at(-1)!);
    const detail = screen.getByRole("region", { name: "Daily detail" });
    expect(within(detail).getByText("Jan 3, 2026")).toBeVisible();
    expect(within(detail).getByText("Observation available; step total unavailable")).toBeVisible();
    expect(within(detail).getByText("Not available")).toBeVisible();
    await user.click(within(detail).getByRole("button", { name: "Close detail" }));
    expect(screen.queryByRole("region", { name: "Daily detail" })).not.toBeInTheDocument();

    const rangeQueryCount = mocks.invoke.mock.calls.filter(
      ([command]) => command === "query_activity_overview",
    ).length;
    await user.clear(from);
    await user.type(from, "2026-01-05");
    await user.click(screen.getByRole("button", { name: "Apply range" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose an ordered range inside the available history, up to 366 days.",
    );
    expect(mocks.invoke.mock.calls.filter(
      ([command]) => command === "query_activity_overview",
    )).toHaveLength(rangeQueryCount);

    await user.click(screen.getByRole("button", { name: "Latest 30 days" }));
    await waitFor(() => expect(from).toHaveValue("2026-01-01"));
    expect(through).toHaveValue("2026-01-05");
    expect(within(screen.getByRole("table", { name: "Daily activity overview" }))
      .getAllByRole("row")).toHaveLength(6);
  });

  it("compares two entered periods with exact changes and visible coverage", async () => {
    offerExploration("activity");
    const overview = activityOverview([
      { localDate: "2026-01-01", stepCount: "1000", availability: "available" },
      { localDate: "2026-01-02", stepCount: "2000", availability: "available" },
      { localDate: "2026-01-03", stepCount: null, availability: "missing" },
      { localDate: "2026-01-04", stepCount: "2000", availability: "available" },
      { localDate: "2026-01-05", stepCount: "3000", availability: "available" },
    ]);
    const comparison = activityComparison(
      overview.series[0].days.slice(0, 2),
      overview.series[0].days.slice(3, 5),
    );
    comparison.availableRange = overview.availableRange;
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity_overview") return Promise.resolve(overview);
      if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
      if (command === "query_activity_comparison") return Promise.resolve(comparison);
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);

    await enterExploration(user, "activity");
    const baselineFrom = await screen.findByLabelText("Baseline from");
    const baselineThrough = screen.getByLabelText("Baseline through");
    const comparisonFrom = screen.getByLabelText("Comparison from");
    const comparisonThrough = screen.getByLabelText("Comparison through");
    for (const [input, value] of [
      [baselineFrom, "2026-01-01"],
      [baselineThrough, "2026-01-02"],
      [comparisonFrom, "2026-01-04"],
      [comparisonThrough, "2026-01-05"],
    ] as const) {
      await user.clear(input);
      await user.type(input, value);
    }
    await user.click(screen.getByRole("button", { name: "Compare periods" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "query_activity_comparison",
      {
        baselineRange: { from: "2026-01-01", through: "2026-01-02" },
        comparisonRange: { from: "2026-01-04", through: "2026-01-05" },
      },
    ));
    const result = screen.getByRole("region", { name: "Period comparison" });
    expect(within(result).getByText(
      "Changes use only days with step totals. Review both periods’ coverage.",
    )).toBeVisible();
    const comparisonTable = within(result).getByRole("table", { name: "Period comparison" });
    const rows = within(comparisonTable).getAllByRole("row");
    expect(within(rows[1]).getByText("3,000")).toBeVisible();
    expect(within(rows[1]).getByText("5,000")).toBeVisible();
    expect(within(rows[1]).getByText("+2,000")).toBeVisible();
    expect(within(rows[2]).getByText("+1,000")).toBeVisible();
    expect(within(rows[3]).getAllByText("2")).toHaveLength(2);

    const comparisonQueryCount = mocks.invoke.mock.calls.filter(
      ([command]) => command === "query_activity_comparison",
    ).length;
    await user.clear(baselineFrom);
    await user.type(baselineFrom, "2026-01-03");
    await user.click(screen.getByRole("button", { name: "Compare periods" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose ordered comparison periods inside the available history, up to 366 days each.",
    );
    expect(mocks.invoke.mock.calls.filter(
      ([command]) => command === "query_activity_comparison",
    )).toHaveLength(comparisonQueryCount);
    expect(screen.getByRole("region", { name: "Period comparison" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Clear comparison" }));
    expect(screen.queryByRole("region", { name: "Period comparison" })).not.toBeInTheDocument();
  });

  it("keeps import disabled after a cancelled picker and enables it for a selected ZIP", async () => {
    emptyLibrary();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Bring your fitness history home" });

    mocks.open.mockResolvedValue(null);
    const choose = screen.getByRole("button", { name: "Choose ZIP package" });
    choose.focus();
    await user.keyboard("[Enter]");
    await waitFor(() => expect(mocks.open).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Import selected package" })).toBeDisabled();

    await chooseArchive(user, "/synthetic/valid.zip");
    expect(screen.getByRole("button", { name: "Import selected package" })).toBeEnabled();
  });

  it("shows progress, remains interactive, and cancels without exposing history", async () => {
    let rejectImport: ((reason?: unknown) => void) | undefined;
    let onProgress: { onmessage?: (message: unknown) => void } | undefined;
    let latestOutcome: ReturnType<typeof importOutcome> | null = null;
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_activity_overview") return Promise.resolve(emptyActivityOverview());
      if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
      if (command === "query_latest_import_outcome") return Promise.resolve(latestOutcome);
      if (command === "import_archive") {
        onProgress = arguments_.onProgress;
        onProgress?.onmessage?.({
          phase: "importing",
          completedArtifacts: 1,
          totalArtifacts: 10_000,
          completedBytes: 0,
          totalBytes: null,
          cancellable: true,
        });
        return new Promise((_, reject) => {
          rejectImport = reject;
        });
      }
      if (command === "cancel_import") {
        latestOutcome = importOutcome({
          state: "cancelled",
          coverageComplete: false,
          canonicalHistoryChanged: false,
          terminalCode: "user-cancelled",
        });
        onProgress?.onmessage?.({
          phase: "cancelled",
          completedArtifacts: 0,
          totalArtifacts: null,
          completedBytes: 0,
          totalBytes: null,
          cancellable: false,
        });
        rejectImport?.({ code: "import-failed" });
        return Promise.resolve(true);
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Bring your fitness history home" });
    await chooseArchive(user, "/synthetic/large.zip");

    await user.click(screen.getByRole("button", { name: "Import selected package" }));
    expect(await screen.findByRole("progressbar", { name: "Importing and reconciling artifacts" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Choose ZIP package" })).toBeDisabled();

    await changeLanguageToSpanish(user, "sources");
    expect(screen.getByRole("heading", { name: spanish.sources.title })).toBeVisible();
    await user.click(screen.getByRole("button", { name: spanish.cancel }));

    expect(await screen.findByText(spanish.cancelled)).toBeVisible();
    expect(screen.queryAllByRole("row")).toHaveLength(0);
  });

  it("renders validation errors, complete reports, multiple records, exact repeats, and restored history", async () => {
    const history = activityOverview([
      { localDate: "2026-01-01", stepCount: "3100", availability: "available" },
      { localDate: "2026-01-02", stepCount: "4200", availability: "available" },
      { localDate: "2026-01-03", stepCount: null, availability: "unavailable" },
    ]);
    let storedHistory = emptyActivityOverview();
    let importAttempt = 0;
    let latestOutcome: ReturnType<typeof importOutcome> | null = null;
    let savedDestination: "activity" | null = null;
    mocks.homeInvoke.mockImplementation((command, arguments_) => {
      if (command === "query_library_home") {
        if (storedHistory.series.length === 0) return Promise.resolve(emptyLibraryHome());
        const requestedOperationRef = arguments_.request.afterImportOperationRef;
        const currentOutcome = latestOutcome;
        const postImport = currentOutcome
          && requestedOperationRef === currentOutcome.operationRef
          ? {
              exactRepeat: currentOutcome.exactRepeat,
              canonicalHistoryChanged: currentOutcome.canonicalHistoryChanged,
              newObservations: currentOutcome.report.newObservations,
              enrichedObservations: currentOutcome.report.enrichedObservations,
              amendedObservations: currentOutcome.report.amendedObservations,
              sourceReviewRecommended: false,
            }
          : null;
        return Promise.resolve(populatedLibraryHome({
          questions: [{ kind: "review-activity-steps", destination: "activity" }],
          postImport,
          resumableExploration: savedDestination
            ? { version: 1, destination: savedDestination }
            : null,
        }));
      }
      if (command === "save_exploration_workspace") {
        savedDestination = "activity";
        return Promise.resolve({ version: 1, destination: "activity" });
      }
      if (command === "clear_exploration_workspace") {
        savedDestination = null;
        return Promise.resolve(undefined);
      }
      throw new Error(`Unexpected Home command: ${command}`);
    });
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_activity_overview") return Promise.resolve(storedHistory);
      if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
      if (command === "query_latest_import_outcome") return Promise.resolve(latestOutcome);
      if (command === "import_archive") {
        importAttempt += 1;
        if (importAttempt === 1) {
          latestOutcome = importOutcome({
            state: "rejected",
            coverage: {
              total: 2,
              supported: 1,
              unsupported: 0,
              deliberatelyIgnored: 0,
              unrecognized: 0,
              invalid: 1,
            },
            report: {
              exactRepeat: false,
              recognizedArtifacts: 2,
              newObservations: 0,
              equivalentObservations: 0,
              enrichedObservations: 0,
              amendedObservations: 0,
              preservedObservations: 0,
              conflicts: 0,
            },
            canonicalHistoryChanged: false,
            terminalCode: "invalid-supported-artifact",
          });
          return Promise.reject({ code: "import-failed" });
        }
        arguments_.onProgress.onmessage({
          phase: "completed",
          completedArtifacts: 3,
          totalArtifacts: 3,
          completedBytes: 0,
          totalBytes: null,
          cancellable: false,
        });
        if (importAttempt === 2) {
          storedHistory = history;
          latestOutcome = importOutcome();
          return Promise.resolve({
            exactRepeat: false,
            recognizedArtifacts: 3,
            newObservations: 3,
            equivalentObservations: 0,
            enrichedObservations: 0,
            amendedObservations: 0,
            preservedObservations: 0,
            conflicts: 0,
          });
        }
        latestOutcome = importOutcome({
          exactRepeat: true,
          canonicalHistoryChanged: false,
          report: {
            exactRepeat: true,
            recognizedArtifacts: 3,
            newObservations: 0,
            equivalentObservations: 0,
            enrichedObservations: 0,
            amendedObservations: 0,
            preservedObservations: 0,
            conflicts: 0,
          },
        });
        return Promise.resolve({
          exactRepeat: true,
          recognizedArtifacts: 0,
          newObservations: 0,
          equivalentObservations: 0,
          enrichedObservations: 0,
          amendedObservations: 0,
          preservedObservations: 0,
          conflicts: 0,
        });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    const view = render(<App />);
    await screen.findByRole("heading", { name: "Bring your fitness history home" });

    await chooseArchive(user, "/synthetic/invalid.zip");
    await user.click(screen.getByRole("button", { name: "Import selected package" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This package contains recognized data that FitFreed cannot validate. Keep the original ZIP and report the compatibility problem; no history was changed.",
    );
    expect(screen.getByRole("heading", { name: "Package coverage" })).toBeVisible();
    expect(screen.getByText("2 / 2")).toBeVisible();
    const rejectedCoverage = screen.getByRole("list", { name: "Package coverage" });
    const invalidCoverage = within(rejectedCoverage).getByText("Invalid").closest("li");
    expect(invalidCoverage).not.toBeNull();
    expect(within(invalidCoverage!).getByText("1")).toBeVisible();

    await chooseArchive(user, "/synthetic/valid.zip");
    await user.click(screen.getByRole("button", { name: "Import selected package" }));
    expect(await screen.findByRole("status", { name: "Your library grew" }))
      .toHaveTextContent("3 new observations");
    expect(mocks.sleepInvoke).not.toHaveBeenCalled();
    expect(mocks.homeInvoke).toHaveBeenCalledWith("query_library_home", {
      request: { afterImportOperationRef: "synthetic-operation" },
    });
    await user.click(screen.getByRole("button", { name: "Sources" }));
    expect(screen.getByText("Every package artifact was classified.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Explore" }));
    await enterExploration(user, "activity");
    const rows = await screen.findAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(within(rows[1]).getByText("Jan 1, 2026")).toBeVisible();
    expect(within(rows[1]).getByText("3,100")).toBeVisible();
    expect(within(rows[3]).getByText("Not available")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Sources" }));
    await user.click(screen.getByRole("button", { name: "Import selected package" }));
    expect(await screen.findByText(
      "This package was an exact repeat; your library remains unchanged and duplicate-free.",
    )).toBeVisible();
    expect(mocks.sleepInvoke).not.toHaveBeenCalled();
    await enterExploration(user, "activity");
    expect(await screen.findAllByRole("row")).toHaveLength(4);

    view.unmount();
    render(<App />);
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(4));
    expect(screen.queryByText("5,300")).not.toBeInTheDocument();
  });

  it("distinguishes loading, empty, and unavailable training history", async () => {
    offerExploration("training");
    let resolveTraining: (overview: TestTrainingOverview) => void = () => undefined;
    const pendingTraining = new Promise<TestTrainingOverview>((resolve) => {
      resolveTraining = resolve;
    });
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity_overview") return Promise.resolve(emptyActivityOverview());
      if (command === "query_training_overview") return pendingTraining;
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    const view = render(<App />);
    await enterExploration(user, "training");
    const training = await screen.findByRole("region", { name: "Training history" });
    expect(within(training).getByText("Loading training history…")).toBeVisible();
    expect(within(training).queryByText("No imported training sessions yet."))
      .not.toBeInTheDocument();

    resolveTraining(emptyTrainingOverview());
    expect(await within(training).findByText("No imported training sessions yet.")).toBeVisible();

    view.unmount();
    offerExploration("training");
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity_overview") return Promise.resolve(emptyActivityOverview());
      if (command === "query_training_overview") {
        return Promise.reject({ code: "library-query-failed" });
      }
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      throw new Error(`Unexpected command: ${command}`);
    });
    render(<App />);
    await enterExploration(user, "training");
    const unavailable = await screen.findByRole("region", { name: "Training history" });
    expect(await within(unavailable).findByText("Training history could not be loaded."))
      .toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "FitFreed could not read fitness history.",
    );
  });

  it("explores, filters, details, compares, localizes, and reloads training sessions", async () => {
    offerExploration("training");
    const earlier: TestTrainingSession = {
      sessionRef: "earlier-session",
      startedAtLocal: "2026-01-18T08:00:00",
      stoppedAtLocal: "2026-01-18T08:30:01.001",
      utcOffsetMinutes: null,
      durationMilliseconds: "1801001",
      distanceMeters: null,
      energyKilocalories: "250",
      averageHeartRateBpm: null,
      maximumHeartRateBpm: null,
      sportRef: null,
      exerciseCount: null,
    };
    const later: TestTrainingSession = {
      sessionRef: "later-session",
      startedAtLocal: "2026-01-20T09:00:00",
      stoppedAtLocal: "2026-01-20T10:00:00",
      utcOffsetMinutes: 60,
      durationMilliseconds: "3600000",
      distanceMeters: 5000.25,
      energyKilocalories: "500",
      averageHeartRateBpm: "140",
      maximumHeartRateBpm: "170",
      sportRef: "opaque-sport-a",
      exerciseCount: 1,
    };
    const fullOverview = trainingOverview([later, earlier]);
    const filteredOverview = trainingOverview(
      [later],
      { from: "2026-01-20", through: "2026-01-20" },
    );
    const baseline = trainingOverview(
      [earlier],
      { from: "2026-01-18", through: "2026-01-18" },
    ).series[0].summary;
    const comparison = trainingOverview(
      [later],
      { from: "2026-01-20", through: "2026-01-20" },
    ).series[0].summary;
    const comparisonResult: TestTrainingComparison = {
      availableRange: fullOverview.availableRange,
      baselineRange: { from: "2026-01-18", through: "2026-01-18" },
      comparisonRange: { from: "2026-01-20", through: "2026-01-20" },
      series: [{
        seriesRef: "synthetic-origin",
        baseline,
        comparison,
        sessionCountChange: "0",
        trainingDayChange: "0",
        durationMillisecondsChange: "1798999",
        distanceMetersChange: null,
        energyKilocaloriesChange: "250",
      }],
    };
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_activity_overview") return Promise.resolve(emptyActivityOverview());
      if (command === "query_training_overview") {
        return Promise.resolve(
          arguments_.requestedRange?.from === "2026-01-20"
            ? filteredOverview
            : fullOverview,
        );
      }
      if (command === "query_training_comparison") return Promise.resolve(comparisonResult);
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    const view = render(<App />);
    await enterExploration(user, "training");
    const training = await screen.findByRole("region", { name: "Training history" });

    expect(await within(training).findByText("2 sessions")).toBeVisible();
    expect(within(training).getByText("2 training days")).toBeVisible();
    expect(within(training).getAllByRole("button", { name: /View training details/ }))
      .toHaveLength(2);
    expect(within(training).queryByText("opaque-sport-a")).not.toBeInTheDocument();

    await user.click(
      within(training).getAllByRole("button", { name: /View training details/ })[0],
    );
    const detail = within(training).getByRole("region", { name: "Training detail" });
    expect(within(detail).getByText("5,000.25 m")).toBeVisible();
    expect(within(detail).getByText("140 bpm")).toBeVisible();
    expect(within(detail).getByText("Recorded training type")).toBeVisible();
    await user.click(within(detail).getByRole("button", { name: "Close training detail" }));
    expect(within(training).queryByRole("region", { name: "Training detail" }))
      .not.toBeInTheDocument();

    const filter = within(training).getByRole("form", { name: "Explore a training period" });
    await user.clear(within(filter).getByLabelText("From"));
    await user.type(within(filter).getByLabelText("From"), "2026-01-20");
    await user.clear(within(filter).getByLabelText("Through"));
    await user.type(within(filter).getByLabelText("Through"), "2026-01-20");
    await user.click(within(filter).getByRole("button", { name: "Apply training period" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("query_training_overview", {
      requestedRange: { from: "2026-01-20", through: "2026-01-20" },
    }));
    expect(within(training).getAllByRole("button", { name: /View training details/ }))
      .toHaveLength(1);

    await user.click(within(filter).getByRole("button", { name: "Latest 30-day window" }));
    await waitFor(() => expect(within(training)
      .getAllByRole("button", { name: /View training details/ })).toHaveLength(2));

    const comparisonForm = within(training).getByRole("form", {
      name: "Compare training periods",
    });
    const comparisonInputs = [
      [within(comparisonForm).getByLabelText("Baseline period start"), "2026-01-18"],
      [within(comparisonForm).getByLabelText("Baseline period end"), "2026-01-18"],
      [within(comparisonForm).getByLabelText("Comparison period start"), "2026-01-20"],
      [within(comparisonForm).getByLabelText("Comparison period end"), "2026-01-20"],
    ] as const;
    for (const [input, value] of comparisonInputs) {
      await user.clear(input);
      await user.type(input, value);
    }
    await user.click(within(comparisonForm).getByRole("button", { name: "Compare periods" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "query_training_comparison",
      {
        baselineRange: { from: "2026-01-18", through: "2026-01-18" },
        comparisonRange: { from: "2026-01-20", through: "2026-01-20" },
      },
    ));
    const comparisonRegion = within(training).getByRole("region", {
      name: "Training period comparison",
    });
    expect(within(comparisonRegion).getByText("+250 kcal")).toBeVisible();
    expect(within(comparisonRegion).getAllByText("Not available").length).toBeGreaterThan(0);
    await user.click(within(comparisonRegion).getByRole("button", { name: "Clear comparison" }));
    expect(within(training).queryByRole("region", { name: "Training period comparison" }))
      .not.toBeInTheDocument();

    await user.clear(within(filter).getByLabelText("From"));
    await user.type(within(filter).getByLabelText("From"), "2026-01-21");
    await user.clear(within(filter).getByLabelText("Through"));
    await user.type(within(filter).getByLabelText("Through"), "2026-01-20");
    await user.click(within(filter).getByRole("button", { name: "Apply training period" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose an ordered training range inside the available history, up to 366 days.",
    );
    expect(within(training).getAllByRole("button", { name: /View training details/ }))
      .toHaveLength(2);

    await changeLanguageToSpanish(user);
    expect(screen.getByRole("region", { name: "Historial de entrenamientos" })).toBeVisible();

    view.unmount();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Explorar" }));
    const restored = await screen.findByRole("region", { name: "Historial de entrenamientos" });
    expect(await within(restored).findAllByRole("button", { name: /Ver detalles del entrenamiento/ }))
      .toHaveLength(2);
  });
});
