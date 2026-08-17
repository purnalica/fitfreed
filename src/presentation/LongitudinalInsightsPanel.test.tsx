import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import { LongitudinalInsightsPanel } from "./LongitudinalInsightsPanel";
import type {
  LongitudinalComparison,
  LongitudinalDayInsight,
  LongitudinalOverview,
} from "./longitudinal-insights";
import type { ActivitySeriesSummary } from "./activity-insights";
import type { RecoverySeriesSummary } from "./recovery-insights";
import type { SleepSeriesSummary } from "./sleep-insights";
import type { TrainingSeriesSummary } from "./training-insights";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

afterEach(() => {
  cleanup();
  mocks.invoke.mockReset();
});

function activitySummary(
  overrides: Partial<ActivitySeriesSummary> = {},
): ActivitySeriesSummary {
  return {
    calendarDays: 3,
    observedDays: 2,
    availableStepDays: 1,
    unavailableStepDays: 1,
    missingDays: 1,
    totalStepCount: "12000",
    averageStepCount: "12000",
    ...overrides,
  };
}

function trainingSummary(
  overrides: Partial<TrainingSeriesSummary> = {},
): TrainingSeriesSummary {
  return {
    calendarDays: 3,
    trainingDays: 2,
    sessionCount: 3,
    totalDurationMilliseconds: "5400000",
    distanceSessionCount: 0,
    totalDistanceMeters: null,
    energySessionCount: 0,
    totalEnergyKilocalories: null,
    heartRateSessionCount: 0,
    ...overrides,
  };
}

function sleepSummary(overrides: Partial<SleepSeriesSummary> = {}): SleepSeriesSummary {
  return {
    calendarDays: 3,
    observedNights: 2,
    missingNights: 1,
    totalAsleepMilliseconds: "52200000",
    averageAsleepMilliseconds: "26100000",
    totalInterruptionMilliseconds: "2400000",
    averageInterruptionMilliseconds: "1200000",
    averageEfficiencyPercent: 91.5,
    phaseNightCount: 0,
    phaseTotals: null,
    stageTimelineNightCount: 0,
    scoreNightCount: 0,
    averageOverallScore: null,
    goalNightCount: 0,
    goalMetNightCount: 0,
    powerStatusNightCount: 0,
    powerLossNightCount: 0,
    ...overrides,
  };
}

function recoverySummary(
  overrides: Partial<RecoverySeriesSummary> = {},
): RecoverySeriesSummary {
  return {
    calendarDays: 3,
    observedNights: 2,
    missingNights: 1,
    averageBeatToBeatIntervalMilliseconds: "905",
    rmssdNightCount: 2,
    averageHeartRateVariabilityRmssdMilliseconds: "43",
    averageBreathingIntervalMilliseconds: "4150",
    assessmentNightCount: 0,
    baselineNightCount: 0,
    guidanceNightCount: 0,
    ...overrides,
  };
}

function day(overrides: Partial<LongitudinalDayInsight> = {}): LongitudinalDayInsight {
  return {
    localDate: "2026-03-28",
    activity: { availability: "available", stepCount: "12000" },
    training: { sessionCount: 2, totalDurationMilliseconds: "3600000" },
    sleep: { availability: "available", asleepMilliseconds: "27000000" },
    recovery: {
      availability: "available",
      beatToBeatIntervalMilliseconds: "900",
      heartRateVariabilityRmssdMilliseconds: "42",
      breathingIntervalMilliseconds: "4100",
    },
    ...overrides,
  };
}

function overview(
  selectedRange = { from: "2026-03-28", through: "2026-03-30" },
): LongitudinalOverview {
  return {
    availableRange: { from: "2026-03-01", through: "2026-03-30" },
    selectedRange,
    series: [{
      seriesRef: "opaque-origin-alpha",
      activity: activitySummary(),
      training: trainingSummary(),
      sleep: sleepSummary(),
      recovery: recoverySummary(),
      days: [
        day(),
        day({
          localDate: "2026-03-29",
          activity: { availability: "unavailable", stepCount: null },
          training: { sessionCount: 0, totalDurationMilliseconds: "0" },
          sleep: { availability: "missing", asleepMilliseconds: null },
          recovery: {
            availability: "missing",
            beatToBeatIntervalMilliseconds: null,
            heartRateVariabilityRmssdMilliseconds: null,
            breathingIntervalMilliseconds: null,
          },
        }),
        day({
          localDate: "2026-03-30",
          activity: { availability: "missing", stepCount: null },
          training: { sessionCount: 1, totalDurationMilliseconds: "1800000" },
          sleep: { availability: "available", asleepMilliseconds: "25200000" },
          recovery: {
            availability: "available",
            beatToBeatIntervalMilliseconds: "910",
            heartRateVariabilityRmssdMilliseconds: "44",
            breathingIntervalMilliseconds: "4200",
          },
        }),
      ],
    }],
  };
}

function comparison(): LongitudinalComparison {
  return {
    availableRange: { from: "2026-03-01", through: "2026-03-30" },
    baselineRange: { from: "2026-03-01", through: "2026-03-03" },
    comparisonRange: { from: "2026-03-28", through: "2026-03-30" },
    series: [{
      seriesRef: "opaque-origin-alpha",
      activity: {
        baseline: activitySummary({ totalStepCount: "10000" }),
        comparison: activitySummary(),
        totalStepChange: "2000",
        averageStepChange: "2000",
      },
      training: {
        baseline: trainingSummary({ totalDurationMilliseconds: "3600000" }),
        comparison: trainingSummary(),
        sessionCountChange: "1",
        trainingDayChange: "1",
        durationMillisecondsChange: "1800000",
        distanceMetersChange: null,
        energyKilocaloriesChange: null,
      },
      sleep: {
        baseline: sleepSummary({ averageAsleepMilliseconds: "25200000" }),
        comparison: sleepSummary(),
        observedNightChange: "0",
        missingNightChange: "0",
        averageAsleepMillisecondsChange: "900000",
        averageInterruptionMillisecondsChange: null,
        averageEfficiencyPercentagePointChange: null,
        averageOverallScoreChange: null,
        goalMetPercentagePointChange: null,
      },
      recovery: {
        baseline: recoverySummary({ averageBeatToBeatIntervalMilliseconds: "880" }),
        comparison: recoverySummary(),
        observedNightChange: "0",
        missingNightChange: "0",
        averageBeatToBeatIntervalMillisecondsChange: "25",
        averageHeartRateVariabilityRmssdMillisecondsChange: null,
        averageBreathingIntervalMillisecondsChange: null,
        assessmentNightChange: "0",
        baselineNightChange: "0",
        guidanceNightChange: "0",
      },
    }],
  };
}

function renderPanel(overrides: {
  locale?: "en-US" | "es-ES";
  refreshToken?: number;
  onError?: (code: string | undefined) => void;
  onNavigate?: (
    domain: "activity" | "training" | "sleep" | "recovery",
    localDate: string,
    seriesRef: string,
  ) => void;
} = {}) {
  const locale = overrides.locale ?? "en-US";
  return render(
    <LongitudinalInsightsPanel
      locale={locale}
      messages={catalogs[locale]}
      refreshToken={overrides.refreshToken ?? 0}
      onError={overrides.onError ?? vi.fn()}
      onNavigate={overrides.onNavigate ?? vi.fn()}
    />,
  );
}

describe("LongitudinalInsightsPanel", () => {
  it("distinguishes loading, empty, and unavailable history", async () => {
    let resolveOverview: (value: LongitudinalOverview) => void = () => undefined;
    mocks.invoke.mockImplementation(() => new Promise<LongitudinalOverview>((resolve) => {
      resolveOverview = resolve;
    }));
    const view = renderPanel();
    const region = screen.getByRole("region", { name: "Longitudinal dashboard" });
    expect(within(region).getByText("Loading the longitudinal dashboard…")).toBeVisible();
    resolveOverview({ availableRange: null, selectedRange: null, series: [] });
    expect(await within(region).findByText(
      "No imported activity, training, sleep, or recovery history yet.",
    )).toBeVisible();

    view.unmount();
    mocks.invoke.mockRejectedValue({ code: "library-query-failed" });
    renderPanel();
    expect(await screen.findByText("The longitudinal dashboard could not be loaded.")).toBeVisible();
  });

  it("explores aligned exact values and links to every authoritative explorer", async () => {
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_longitudinal_overview") return Promise.resolve(overview());
      throw new Error(`Unexpected command: ${command}`);
    });
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderPanel({ onNavigate });

    const region = screen.getByRole("region", { name: "Longitudinal dashboard" });
    expect((await within(region).findAllByText("12,000"))[0]).toBeVisible();
    expect(within(region).getByText("7 h 15 min")).toBeVisible();
    expect(within(region).getByText("905 ms")).toBeVisible();
    expect(within(region).queryByText("opaque-origin-alpha")).not.toBeInTheDocument();
    expect(within(region).getByText(
      "Observation available; step total unavailable",
    )).toBeVisible();
    expect(within(region).getAllByText("Missing").length).toBeGreaterThan(0);

    await user.click(within(region).getByRole("button", {
      name: "View aligned details for Mar 28, 2026",
    }));
    const detail = within(region).getByRole("region", { name: "Aligned day detail" });
    expect(within(detail).getByText("1 h")).toBeVisible();
    expect(within(detail).getByText("7 h 30 min")).toBeVisible();
    expect(within(detail).getByText("4,100 ms")).toBeVisible();
    expect(within(detail).getByText(/does not establish cause, diagnosis, readiness, or advice/)).toBeVisible();

    for (const [name, domain] of [
      ["Open activity explorer for this date", "activity"],
      ["Open training explorer for this date", "training"],
      ["Open sleep explorer for this date", "sleep"],
      ["Open recovery explorer for this date", "recovery"],
    ] as const) {
      await user.click(within(detail).getByRole("link", { name }));
      expect(onNavigate).toHaveBeenCalledWith(domain, "2026-03-28", "opaque-origin-alpha");
    }
    await user.click(within(detail).getByRole("button", { name: "Close aligned day detail" }));
    expect(within(region).queryByRole("region", { name: "Aligned day detail" })).not.toBeInTheDocument();
  });

  it("validates, applies, and resets the shared date range without losing the current view", async () => {
    const filtered = overview({ from: "2026-03-30", through: "2026-03-30" });
    filtered.series[0].days = [filtered.series[0].days[2]];
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command !== "query_longitudinal_overview") {
        throw new Error(`Unexpected command: ${command}`);
      }
      return Promise.resolve(arguments_.requestedRange ? filtered : overview());
    });
    const onError = vi.fn();
    const user = userEvent.setup();
    renderPanel({ onError });
    const region = screen.getByRole("region", { name: "Longitudinal dashboard" });
    await within(region).findByText("Explore one shared period");

    const from = within(region).getByLabelText("From");
    const through = within(region).getByLabelText("Through");
    await user.clear(from);
    await user.type(from, "2026-03-30");
    await user.clear(through);
    await user.type(through, "2026-03-28");
    await user.click(within(region).getByRole("button", { name: "Apply shared period" }));
    expect(onError).toHaveBeenLastCalledWith("invalid-longitudinal-range");
    expect(within(region).getByRole("button", {
      name: "View aligned details for Mar 28, 2026",
    })).toBeVisible();

    await user.clear(through);
    await user.type(through, "2026-03-30");
    await user.click(within(region).getByRole("button", { name: "Apply shared period" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "query_longitudinal_overview",
      { requestedRange: { from: "2026-03-30", through: "2026-03-30" } },
    ));
    const selectedRange = await within(region).findByText(/Selected period:/);
    expect(selectedRange.closest("p")).toHaveTextContent(
      "Mar 30, 2026 to Mar 30, 2026",
    );

    await user.click(within(region).getByRole("button", { name: "Latest 30-day window" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenLastCalledWith(
      "query_longitudinal_overview",
      { requestedRange: null },
    ));
  });

  it("runs all four comparisons, preserves a valid result after invalid input, and clears it", async () => {
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_longitudinal_overview") return Promise.resolve(overview());
      if (command === "query_longitudinal_comparison") return Promise.resolve(comparison());
      throw new Error(`Unexpected command: ${command}`);
    });
    const onError = vi.fn();
    const user = userEvent.setup();
    renderPanel({ onError });
    const region = screen.getByRole("region", { name: "Longitudinal dashboard" });
    await within(region).findByRole("heading", { name: "Compare shared periods" });

    const baselineFrom = within(region).getByLabelText("Baseline period start");
    const baselineThrough = within(region).getByLabelText("Baseline period end");
    await user.clear(baselineFrom);
    await user.type(baselineFrom, "2026-03-01");
    await user.clear(baselineThrough);
    await user.type(baselineThrough, "2026-03-03");
    await user.click(within(region).getByRole("button", { name: "Compare shared periods" }));

    const result = await within(region).findByRole("region", {
      name: "Longitudinal period comparison",
    });
    expect(within(result).getByText("+2,000")).toBeVisible();
    expect(within(result).getByText("+30 min")).toBeVisible();
    expect(within(result).getByText("+15 min")).toBeVisible();
    expect(within(result).getByText("+25 ms")).toBeVisible();
    expect(within(result).getByText(/missing measurements remain explicit/)).toBeVisible();

    await user.clear(baselineFrom);
    await user.type(baselineFrom, "2026-03-30");
    await user.click(within(region).getByRole("button", { name: "Compare shared periods" }));
    expect(onError).toHaveBeenLastCalledWith("invalid-longitudinal-comparison");
    expect(within(region).getByRole("region", {
      name: "Longitudinal period comparison",
    })).toBeVisible();

    await user.click(within(result).getByRole("button", {
      name: "Clear longitudinal comparison",
    }));
    expect(within(region).queryByRole("region", {
      name: "Longitudinal period comparison",
    })).not.toBeInTheDocument();
  });

  it("localizes the complete experience and refreshes after a new import token", async () => {
    mocks.invoke.mockResolvedValue(overview());
    const onError = vi.fn();
    const onNavigate = vi.fn();
    const view = renderPanel({ locale: "es-ES", onError, onNavigate });
    const region = screen.getByRole("region", { name: "Panel longitudinal" });
    expect(await within(region).findByText("Explorar un periodo compartido")).toBeVisible();
    expect(within(region).queryByText(
      /No establece causas, diagnósticos/,
    )).not.toBeInTheDocument();
    await userEvent.setup().click(within(region).getByRole("button", {
      name: "Ver detalles alineados del 28 mar 2026",
    }));
    expect(within(region).getByText(
      "Esta vista muestra coincidencias registradas y cobertura. No establece causas, diagnósticos, preparación ni consejos.",
    )).toBeVisible();

    view.rerender(
      <LongitudinalInsightsPanel
        locale="es-ES"
        messages={catalogs["es-ES"]}
        refreshToken={1}
        onError={onError}
        onNavigate={onNavigate}
      />,
    );
    await waitFor(() => {
      const overviewCalls = mocks.invoke.mock.calls.filter(
        ([command]) => command === "query_longitudinal_overview",
      );
      expect(overviewCalls.length).toBe(2);
    });
    expect(within(region).queryByRole("region", {
      name: "Detalle del día alineado",
    })).not.toBeInTheDocument();
  });
});
