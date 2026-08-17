import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { catalogs } from "./locales/catalogs";

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

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  recoveryInvoke: vi.fn(),
  longitudinalInvoke: vi.fn(),
  sleepInvoke: vi.fn(),
  updateInvoke: vi.fn(),
  open: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class Channel<T> {
    onmessage?: (message: T) => void;
  },
  invoke: (command: string, arguments_: Record<string, unknown>) =>
    command.includes("update")
      ? mocks.updateInvoke(command, arguments_)
      : command.startsWith("query_longitudinal_")
      ? mocks.longitudinalInvoke(command, arguments_)
      : command.startsWith("query_recovery_")
      ? mocks.recoveryInvoke(command, arguments_)
      : command.startsWith("query_sleep_")
      ? mocks.sleepInvoke(command, arguments_)
      : mocks.invoke(command, arguments_),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: mocks.open,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mocks.invoke.mockReset();
  mocks.recoveryInvoke.mockReset();
  mocks.longitudinalInvoke.mockReset();
  mocks.sleepInvoke.mockReset();
  mocks.updateInvoke.mockReset();
  mocks.open.mockReset();
});

beforeEach(() => {
  mocks.recoveryInvoke.mockResolvedValue(emptyRecoveryOverview());
  mocks.longitudinalInvoke.mockResolvedValue(emptyLongitudinalOverview());
  mocks.sleepInvoke.mockResolvedValue(emptySleepOverview());
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

function emptyLibrary(initialLocale: "en-US" | "es-ES" | null = "en-US") {
  let storedLocale = initialLocale;
  mocks.invoke.mockImplementation((command, arguments_) => {
    if (command === "query_activity_overview") return Promise.resolve(emptyActivityOverview());
    if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
    if (command === "query_latest_import_outcome") return Promise.resolve(null);
    if (command === "load_locale") return Promise.resolve(storedLocale);
    if (command === "save_locale") {
      storedLocale = arguments_.locale;
      return Promise.resolve();
    }
    throw new Error(`Unexpected command: ${command}`);
  });
  return {
    locale: () => storedLocale,
  };
}

async function chooseArchive(user: ReturnType<typeof userEvent.setup>, path: string) {
  mocks.open.mockResolvedValue(path);
  await user.click(screen.getByRole("button", { name: "Choose ZIP package" }));
  expect(screen.getByText(path)).toBeVisible();
}

describe("FitFreed import interface", () => {
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
    await screen.findByRole("button", { name: "Install and restart" });
    await chooseArchive(user, "/synthetic/valid.zip");

    await user.click(screen.getByRole("button", { name: "Install and restart" }));

    expect(screen.getByRole("button", { name: "Choose ZIP package" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Import selected package" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Language" })).toBeDisabled();

    await act(async () => rejectInstallation({ code: "update-native-installer-failed" }));
    await waitFor(() => expect(
      screen.getByRole("button", { name: "Choose ZIP package" }),
    ).toBeEnabled());
    expect(screen.getByRole("button", { name: "Import selected package" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Language" })).toBeEnabled();
  });

  it("requests backend-owned update confirmation only after locale startup completes", async () => {
    let completeLocale!: (locale: "en-US") => void;
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity_overview") return Promise.resolve(emptyActivityOverview());
      if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      if (command === "load_locale") {
        return new Promise((resolve) => {
          completeLocale = resolve;
        });
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    await waitFor(() => expect(completeLocale).toBeTypeOf("function"));
    expect(mocks.updateInvoke).not.toHaveBeenCalledWith(
      "confirm_update_recovery_startup",
      undefined,
    );
    await act(async () => completeLocale("en-US"));
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
      if (command === "load_locale") return Promise.resolve("en-US");
      if (command === "save_locale") return Promise.resolve();
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

    await user.selectOptions(screen.getByRole("combobox", { name: "Language" }), "es-ES");
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
      if (command === "load_locale") return Promise.resolve("en-US");
      if (command === "save_locale") return Promise.resolve();
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
    await screen.findByText("No imported daily activity yet.");
    await chooseArchive(user, "/synthetic/different-subject.zip");

    await user.click(screen.getByRole("button", { name: "Import selected package" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "FitFreed will not merge it with the existing history automatically",
    );
    expect(screen.getByText("Import rejected; no history was changed.")).toBeVisible();
    expect(screen.queryByText(/fixture-(?:primary|other)-claim/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Language" }), "es-ES");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "FitFreed no lo combinará automáticamente con el historial existente",
    );
  });

  it("persists an explicit locale and restores every visible message after remount", async () => {
    const preferences = emptyLibrary();
    const user = userEvent.setup();
    const view = render(<App />);

    expect(await screen.findByRole("heading", { name: "Your fitness history belongs to you" })).toBeVisible();
    const language = screen.getByRole("combobox", { name: "Language" });
    await waitFor(() => expect(language).toBeEnabled());
    await user.selectOptions(language, "es-ES");

    expect(screen.getByRole("heading", { name: spanish.title })).toBeVisible();
    expect(screen.getByRole("heading", { name: spanish.importHeading })).toBeVisible();
    expect(screen.getByRole("heading", { name: spanish.updates.heading })).toBeVisible();
    expect(screen.getByRole("button", { name: spanish.updates.checkNow })).toBeEnabled();
    expect(screen.getByRole("button", { name: spanish.choose })).toBeEnabled();
    expect(screen.getByText(spanish.empty)).toBeVisible();
    await waitFor(() => expect(preferences.locale()).toBe("es-ES"));
    await waitFor(() => expect(mocks.updateInvoke.mock.calls.filter(
      ([command]) => command === "check_for_updates_on_launch",
    )).toHaveLength(2));

    view.unmount();
    render(<App />);
    expect(await screen.findByRole("heading", { name: spanish.title })).toBeVisible();
  });

  it("initializes the first supported operating-system language on first run", async () => {
    vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["fr-FR", "es-MX"]);
    const preferences = emptyLibrary(null);

    render(<App />);

    expect(await screen.findByRole("heading", { name: spanish.title })).toBeVisible();
    await waitFor(() => expect(preferences.locale()).toBe("es-ES"));
  });

  it("falls back to English when the operating system has no supported language", async () => {
    vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["fr-FR", "de-DE"]);
    const preferences = emptyLibrary(null);

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Your fitness history belongs to you" }),
    ).toBeVisible();
    await waitFor(() => expect(preferences.locale()).toBe("en-US"));
  });

  it("keeps the operating-system locale for the session when first-run persistence fails", async () => {
    vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["es-ES"]);
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity_overview") return Promise.resolve(emptyActivityOverview());
      if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      if (command === "load_locale") return Promise.resolve(null);
      if (command === "save_locale") {
        return Promise.reject({ code: "preference-update-failed" });
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: spanish.title })).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      spanish.errors["preference-initialization-failed"],
    );
    expect(screen.getByRole("combobox", { name: spanish.language })).toBeEnabled();
  });

  it("restores the previous locale when persistence fails", async () => {
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity_overview") return Promise.resolve(emptyActivityOverview());
      if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      if (command === "load_locale") return Promise.resolve("en-US");
      if (command === "save_locale") {
        return Promise.reject({ code: "preference-update-failed" });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);
    const language = await screen.findByRole("combobox", { name: "Language" });
    await waitFor(() => expect(language).toBeEnabled());

    await user.selectOptions(language, "es-ES");

    await waitFor(() => expect(screen.getByRole("combobox", { name: "Language" })).toHaveValue("en-US"));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "could not save the selected language",
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
      if (command === "load_locale") return Promise.resolve("es-ES");
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      `${spanish.completed}: 1 ${spanish.counts.recognized.one}, 1 ${spanish.counts.created.one}, 1 ${spanish.counts.enriched.one}, 1 ${spanish.counts.amended.one}, 1 ${spanish.counts.equivalent.one}, 1 ${spanish.counts.preserved.one}, 1 ${spanish.counts.conflicts.one}.`,
    );
    expect(screen.getByText(`${spanish.outcome.artifactsClassified.one}.`)).toBeVisible();
  });

  it("renders exact gap-aware activity insight values and localized availability", async () => {
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
      if (command === "load_locale") return Promise.resolve("en-US");
      if (command === "save_locale") return Promise.resolve();
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);

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

    await user.selectOptions(screen.getByRole("combobox", { name: "Language" }), "es-ES");
    const spanishHistory = screen.getByRole("table", { name: spanish.activity.heading });
    const spanishRows = within(spanishHistory).getAllByRole("row");
    expect(within(spanishRows[2]).getByText(spanish.activity.missing)).toBeVisible();
    expect(within(spanishRows[3]).getByText(spanish.activity.unavailable)).toBeVisible();
  });

  it("filters an inclusive range, rejects invalid input, resets it, and opens daily detail", async () => {
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
      if (command === "load_locale") return Promise.resolve("en-US");
      if (command === "save_locale") return Promise.resolve();
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);

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
      if (command === "load_locale") return Promise.resolve("en-US");
      if (command === "save_locale") return Promise.resolve();
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);

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
    await screen.findByText("No imported daily activity yet.");

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
      if (command === "load_locale") return Promise.resolve("en-US");
      if (command === "save_locale") return Promise.resolve();
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
    await screen.findByText("No imported daily activity yet.");
    await chooseArchive(user, "/synthetic/large.zip");

    await user.click(screen.getByRole("button", { name: "Import selected package" }));
    expect(await screen.findByRole("progressbar", { name: "Importing and reconciling artifacts" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Choose ZIP package" })).toBeDisabled();

    await user.selectOptions(screen.getByRole("combobox", { name: "Language" }), "es-ES");
    expect(screen.getByRole("heading", { name: spanish.title })).toBeVisible();
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
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_activity_overview") return Promise.resolve(storedHistory);
      if (command === "query_training_overview") return Promise.resolve(emptyTrainingOverview());
      if (command === "query_latest_import_outcome") return Promise.resolve(latestOutcome);
      if (command === "load_locale") return Promise.resolve("en-US");
      if (command === "save_locale") return Promise.resolve();
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
    await screen.findByText("No imported daily activity yet.");

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
    expect(await screen.findByRole("status")).toHaveTextContent("Import completed: 3 recognized, 3 new");
    await waitFor(() => expect(mocks.sleepInvoke).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Every package artifact was classified.")).toBeVisible();
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(within(rows[1]).getByText("Jan 1, 2026")).toBeVisible();
    expect(within(rows[1]).getByText("3,100")).toBeVisible();
    expect(within(rows[3]).getByText("Not available")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Import selected package" }));
    expect(await screen.findByText("Exact package repeat; history was not duplicated.")).toBeVisible();
    await waitFor(() => expect(mocks.sleepInvoke).toHaveBeenCalledTimes(3));
    expect(screen.getAllByRole("row")).toHaveLength(4);

    view.unmount();
    render(<App />);
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(4));
    expect(screen.queryByText("5,300")).not.toBeInTheDocument();
  });

  it("distinguishes loading, empty, and unavailable training history", async () => {
    let resolveTraining: (overview: TestTrainingOverview) => void = () => undefined;
    const pendingTraining = new Promise<TestTrainingOverview>((resolve) => {
      resolveTraining = resolve;
    });
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity_overview") return Promise.resolve(emptyActivityOverview());
      if (command === "query_training_overview") return pendingTraining;
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      if (command === "load_locale") return Promise.resolve("en-US");
      if (command === "save_locale") return Promise.resolve();
      throw new Error(`Unexpected command: ${command}`);
    });
    const view = render(<App />);
    const training = await screen.findByRole("region", { name: "Training history" });
    expect(within(training).getByText("Loading training history…")).toBeVisible();
    expect(within(training).queryByText("No imported training sessions yet."))
      .not.toBeInTheDocument();

    resolveTraining(emptyTrainingOverview());
    expect(await within(training).findByText("No imported training sessions yet.")).toBeVisible();

    view.unmount();
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity_overview") return Promise.resolve(emptyActivityOverview());
      if (command === "query_training_overview") {
        return Promise.reject({ code: "library-query-failed" });
      }
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      if (command === "load_locale") return Promise.resolve("en-US");
      if (command === "save_locale") return Promise.resolve();
      throw new Error(`Unexpected command: ${command}`);
    });
    render(<App />);
    const unavailable = await screen.findByRole("region", { name: "Training history" });
    expect(await within(unavailable).findByText("Training history could not be loaded."))
      .toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "FitFreed could not read fitness history.",
    );
  });

  it("explores, filters, details, compares, localizes, and reloads training sessions", async () => {
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
      if (command === "load_locale") return Promise.resolve("en-US");
      if (command === "save_locale") return Promise.resolve();
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    const view = render(<App />);
    const training = await screen.findByRole("region", { name: "Training history" });

    expect(within(training).getByText("2 sessions")).toBeVisible();
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

    await user.selectOptions(screen.getByRole("combobox", { name: "Language" }), "es-ES");
    expect(screen.getByRole("region", { name: "Historial de entrenamientos" })).toBeVisible();

    view.unmount();
    render(<App />);
    const restored = await screen.findByRole("region", { name: "Training history" });
    expect(within(restored).getAllByRole("button", { name: /View training details/ }))
      .toHaveLength(2);
  });
});
