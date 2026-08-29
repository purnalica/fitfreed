import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type { AnalyticalChartModel } from "./analytical-chart";
import {
  buildLongitudinalChartModel,
  LongitudinalInsightsPanel,
} from "./LongitudinalInsightsPanel";
import type {
  LongitudinalComparison,
  LongitudinalDayInsight,
  LongitudinalOverview,
} from "./longitudinal-insights";
import type { ActivitySeriesSummary } from "./activity-insights";
import type { RecoverySeriesSummary } from "./recovery-insights";
import type { SleepSeriesSummary } from "./sleep-insights";
import type { TrainingSeriesSummary } from "./training-insights";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  chartModels: [] as AnalyticalChartModel[],
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("./AnalyticalChart", () => ({
  AnalyticalChart: ({ model }: { model: AnalyticalChartModel }) => {
    mocks.chartModels.push(model);
    return <div role="img" aria-label={model.accessibleName} />;
  },
}));

afterEach(() => {
  cleanup();
  mocks.invoke.mockReset();
  mocks.chartModels.length = 0;
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
  it("uses a zoomable canvas for the maximum supported history and rejects invalid dates", () => {
    const denseSeries = structuredClone(overview().series[0]);
    denseSeries.days = Array.from({ length: 366 }, (_, index) => day({
      localDate: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10),
    }));
    const labels = {
      accessibleName: "Aligned four-domain history",
      accessibleDescription: "Four histories aligned without causal interpretation.",
      date: "Date",
      activity: "Activity",
      steps: "Steps",
      training: "Training",
      trainingDuration: "Training duration",
      sleep: "Sleep",
      sleepDuration: "Asleep duration",
      recovery: "Recovery",
      recoveryInterval: "Beat-to-beat interval",
    };

    const model = buildLongitudinalChartModel(denseSeries, "en-US", labels);

    expect(model).toMatchObject({
      renderer: "canvas",
      interaction: { pointSelection: false, zoom: true },
      coordinate: {
        domain: {
          minimum: Date.UTC(2025, 0, 1),
          maximum: Date.UTC(2026, 0, 1),
        },
      },
    });
    expect(model?.series).toHaveLength(4);
    expect(model?.series.every((series) => series.points.length === 366)).toBe(true);

    denseSeries.days[365] = day({ localDate: "2026-02-30" });
    expect(buildLongitudinalChartModel(denseSeries, "en-US", labels)).toBeNull();
  });

  it("leads with the aligned visual and discloses controls and exact days on request", async () => {
    mocks.invoke.mockResolvedValue(overview());
    const user = userEvent.setup();
    renderPanel();
    const region = screen.getByRole("region", { name: "Longitudinal dashboard" });

    const answer = await within(region).findByRole("region", {
      name: "Aligned-history answer",
    });
    const heading = within(answer).getByRole("heading", {
      name: "Four histories aligned across 3 dates",
    });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(within(answer).getByText("Aligned four-domain history")).toBeVisible();
    expect(within(answer).getByRole("img", {
      name: "Aligned four-domain history",
    })).toBeVisible();
    const chart = mocks.chartModels.at(-1);
    expect(chart).toMatchObject({
      layout: { kind: "stacked-lanes" },
      coordinate: {
        ref: "opaque-origin-alpha:local-date",
        label: "Date",
        domain: {
          minimum: Date.UTC(2026, 2, 28),
          maximum: Date.UTC(2026, 2, 30),
        },
        format: { kind: "local-date" },
      },
      axes: [
        { label: "Steps", unit: "" },
        { label: "Training duration", unit: "" },
        { label: "Asleep duration", unit: "" },
        { label: "Beat-to-beat interval", unit: "ms" },
      ],
      interaction: { pointSelection: false, zoom: false },
    });
    expect(chart?.series[0].points).toEqual([
      expect.objectContaining({ value: 12_000, gapBefore: false }),
      expect.objectContaining({ value: null, gapBefore: false }),
      expect.objectContaining({ value: null, gapBefore: false }),
    ]);
    expect(chart?.series[1].points.map((point) => point.value)).toEqual([
      3_600_000,
      0,
      1_800_000,
    ]);
    expect(within(answer).getByText(
      /does not establish cause, diagnosis, readiness, or advice/,
    )).toBeVisible();
    expect(within(answer).queryByRole("table", {
      name: "Exact longitudinal history",
    })).not.toBeInTheDocument();
    expect(within(region).queryByRole("form", {
      name: "Explore one shared period",
    })).not.toBeInTheDocument();

    await user.click(within(answer).getByText("Review exact days and measurements"));
    expect(within(answer).getByRole("table", {
      name: "Exact longitudinal history",
    })).toBeVisible();
    await user.click(within(region).getByText("Change shared period"));
    expect(within(region).getByRole("form", {
      name: "Explore one shared period",
    })).toBeVisible();
  });

  it("keeps partial histories and multiple origins separate in the answer", async () => {
    const multiple = overview();
    const second = structuredClone(multiple.series[0]);
    second.seriesRef = "opaque-origin-beta";
    second.activity = activitySummary({
      observedDays: 0,
      availableStepDays: 0,
      unavailableStepDays: 0,
      missingDays: 3,
      totalStepCount: null,
      averageStepCount: null,
    });
    second.training = trainingSummary({
      trainingDays: 0,
      sessionCount: 0,
      totalDurationMilliseconds: "0",
    });
    second.sleep = sleepSummary({
      observedNights: 0,
      missingNights: 3,
      totalAsleepMilliseconds: "0",
      averageAsleepMilliseconds: null,
    });
    second.days = second.days.map((entry) => ({
      ...entry,
      activity: { availability: "missing", stepCount: null },
      training: { sessionCount: 0, totalDurationMilliseconds: "0" },
      sleep: { availability: "missing", asleepMilliseconds: null },
    }));
    multiple.series.push(second);
    mocks.invoke.mockResolvedValue(multiple);
    renderPanel();
    const answer = await screen.findByRole("region", { name: "Aligned-history answer" });

    expect(within(answer).getByRole("heading", {
      name: "2 separate history sources aligned",
    })).toBeVisible();
    expect(within(answer).getAllByText("Four histories aligned across 3 dates"))
      .toHaveLength(2);
    expect(within(answer).queryByText("opaque-origin-alpha")).not.toBeInTheDocument();
    expect(within(answer).queryByText("opaque-origin-beta")).not.toBeInTheDocument();
  });

  it("announces the exact latest-window operation without replacing the current history", async () => {
    let requestCount = 0;
    let completeReset: (value: LongitudinalOverview) => void = () => undefined;
    const pendingReset = new Promise<LongitudinalOverview>((resolve) => {
      completeReset = resolve;
    });
    mocks.invoke.mockImplementation((command) => {
      if (command !== "query_longitudinal_overview") {
        throw new Error(`Unexpected command: ${command}`);
      }
      requestCount += 1;
      return requestCount === 1 ? Promise.resolve(overview()) : pendingReset;
    });
    const user = userEvent.setup();
    renderPanel();
    const region = screen.getByRole("region", { name: "Longitudinal dashboard" });
    await user.click(await within(region).findByText("Change shared period"));
    const form = await within(region).findByRole("form", {
      name: "Explore one shared period",
    });

    await user.click(within(form).getByRole("button", { name: "Latest 30-day window" }));

    expect(form).toHaveAttribute("aria-busy", "true");
    expect(within(form).getByRole("button", { name: "Apply shared period" })).toBeDisabled();
    expect(within(form).getByRole("button", { name: "Latest 30-day window" }))
      .toBeDisabled();
    expect(within(form).getByRole("status")).toHaveTextContent(
      "Loading latest shared 30-day window…",
    );
    expect(within(region).getByText("Aligned four-domain history")).toBeVisible();

    act(() => completeReset(overview()));
    await waitFor(() => expect(within(region).queryByRole("form", {
      name: "Explore one shared period",
    })).not.toBeInTheDocument());
    await waitFor(() => expect(within(region).getByRole("heading", {
      name: "Four histories aligned across 3 dates",
    })).toHaveFocus());
  });

  it("distinguishes loading, empty, and unavailable history", async () => {
    let resolveOverview: (value: LongitudinalOverview) => void = () => undefined;
    mocks.invoke.mockImplementation(() => new Promise<LongitudinalOverview>((resolve) => {
      resolveOverview = resolve;
    }));
    const view = renderPanel();
    const region = screen.getByRole("region", { name: "Longitudinal dashboard" });
    expect(within(region).getByRole("status")).toHaveTextContent(
      "Loading the longitudinal dashboard…",
    );
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
    await user.click(await within(region).findByText("Review exact days and measurements"));
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

  it("announces the exact explorer while preserving the aligned day and stable links", async () => {
    mocks.invoke.mockResolvedValue(overview());
    let completeNavigation: () => void = () => undefined;
    const onNavigate = vi.fn(() => new Promise<void>((resolve) => {
      completeNavigation = resolve;
    }));
    const user = userEvent.setup();
    renderPanel({ onNavigate });
    const region = screen.getByRole("region", { name: "Longitudinal dashboard" });
    await user.click(await within(region).findByText("Review exact days and measurements"));
    await user.click(await within(region).findByRole("button", {
      name: "View aligned details for Mar 28, 2026",
    }));
    const detail = within(region).getByRole("region", { name: "Aligned day detail" });
    const links = within(detail).getByRole("navigation", { name: "Aligned day detail" });
    const training = within(links).getByRole("link", {
      name: "Open training explorer for this date",
    });

    await user.click(training);

    await waitFor(() => expect(links).toHaveAttribute("aria-busy", "true"));
    expect(training).toHaveAttribute("aria-disabled", "true");
    expect(within(detail).getByRole("button", { name: "Close aligned day detail" }))
      .toBeDisabled();
    expect(within(links).getByRole("status")).toHaveTextContent(
      "Opening training exploration…",
    );
    expect(within(detail).getByText("7 h 30 min")).toBeVisible();
    await user.click(training);
    expect(onNavigate).toHaveBeenCalledTimes(1);

    act(() => completeNavigation());
    await waitFor(() => expect(links).toHaveAttribute("aria-busy", "false"));
    expect(within(links).queryByRole("status")).not.toBeInTheDocument();
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
    await user.click(await within(region).findByText("Change shared period"));
    await within(region).findByText("Explore one shared period");

    const from = within(region).getByLabelText("From");
    const through = within(region).getByLabelText("Through");
    await user.clear(from);
    await user.type(from, "2026-03-30");
    await user.clear(through);
    await user.type(through, "2026-03-28");
    await user.click(within(region).getByRole("button", { name: "Apply shared period" }));
    expect(onError).toHaveBeenLastCalledWith("invalid-longitudinal-range");
    expect(from).toHaveAttribute("aria-invalid", "true");
    expect(from).toHaveAttribute("aria-describedby", "application-error");
    expect(through).toHaveAttribute("aria-invalid", "true");
    expect(within(region).getByRole("heading", {
      name: "Four histories aligned across 3 dates",
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
      "Selected period: Mar 30, 2026",
    );

    await user.click(within(region).getByText("Change shared period"));
    await user.click(within(region).getByRole("button", { name: "Latest 30-day window" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenLastCalledWith(
      "query_longitudinal_overview",
      { requestedRange: null },
    ));
  });

  it("announces a shared-range query without renaming its action or hiding the current view", async () => {
    const filtered = overview({ from: "2026-03-30", through: "2026-03-30" });
    filtered.series[0].days = [filtered.series[0].days[2]];
    let resolveRange!: (value: LongitudinalOverview) => void;
    const pendingRange = new Promise<LongitudinalOverview>((resolve) => {
      resolveRange = resolve;
    });
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command !== "query_longitudinal_overview") {
        throw new Error(`Unexpected command: ${command}`);
      }
      return arguments_.requestedRange ? pendingRange : Promise.resolve(overview());
    });
    const user = userEvent.setup();
    renderPanel({ onError: vi.fn() });
    const region = screen.getByRole("region", { name: "Longitudinal dashboard" });
    await user.click(await within(region).findByText("Change shared period"));
    const form = await within(region).findByRole("form", {
      name: "Explore one shared period",
    });
    const from = within(form).getByLabelText("From");
    const through = within(form).getByLabelText("Through");
    await user.clear(from);
    await user.type(from, "2026-03-30");
    await user.clear(through);
    await user.type(through, "2026-03-30");

    await user.click(within(form).getByRole("button", { name: "Apply shared period" }));

    expect(form).toHaveAttribute("aria-busy", "true");
    expect(within(form).getByRole("button", { name: "Apply shared period" })).toBeDisabled();
    expect(within(form).getByRole("status")).toHaveTextContent("Applying shared period…");
    expect(within(region).getByRole("heading", {
      name: "Four histories aligned across 3 dates",
    })).toBeVisible();

    act(() => resolveRange(filtered));
    await waitFor(() => expect(within(region).queryByRole("form", {
      name: "Explore one shared period",
    })).not.toBeInTheDocument());
    await waitFor(() => expect(within(region).getByRole("heading", {
      name: "Four histories aligned across 1 date",
    })).toHaveFocus());
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
    const workspaceNavigation = within(region).getByRole("navigation", {
      name: "Aligned-history workspace",
    });
    const comparisonWorkspace = within(workspaceNavigation).getByRole("button", {
      name: "Compare periods",
    });
    await user.click(comparisonWorkspace);
    expect(comparisonWorkspace).toHaveAttribute("aria-current", "page");
    await within(region).findByRole("heading", { name: "Compare shared periods" });

    const baselineFrom = within(region).getByLabelText("Baseline period start");
    const baselineThrough = within(region).getByLabelText("Baseline period end");
    await user.clear(baselineFrom);
    await user.type(baselineFrom, "2026-03-01");
    await user.clear(baselineThrough);
    await user.type(baselineThrough, "2026-03-03");
    await user.click(within(region).getByRole("button", { name: "Compare shared periods" }));

    const result = await within(region).findByRole("region", {
      name: "Compared-history answer",
    });
    await waitFor(() => expect(within(result).getByRole("heading", {
      name: "Four histories compared side by side",
      level: 2,
    })).toHaveFocus());
    expect(within(result).getByRole("heading", {
      name: "Total steps",
      level: 3,
    })).toBeVisible();
    expect(within(result).getByText("Four-domain period comparison")).toBeVisible();
    expect(within(result).getByText(/missing measurements are not filled in/)).toBeVisible();
    expect(within(result).queryByText("+2,000")).not.toBeVisible();

    await user.click(within(result).getByText("Review exact values"));
    expect(within(result).getByText("+2,000")).toBeVisible();
    expect(within(result).getByText("+30 min")).toBeVisible();
    expect(within(result).getByText("+15 min")).toBeVisible();
    expect(within(result).getByText("+25 ms")).toBeVisible();
    const controls = within(region).getByText("Change the compared shared periods")
      .closest("details");
    expect(result.compareDocumentPosition(controls as Node) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(controls).not.toHaveAttribute("open");

    await user.click(within(workspaceNavigation).getByRole("button", {
      name: "Aligned history",
    }));
    expect(within(region).queryByRole("region", {
      name: "Compared-history answer",
    })).not.toBeInTheDocument();
    await user.click(comparisonWorkspace);
    expect(within(region).getByRole("region", {
      name: "Compared-history answer",
    })).toBeVisible();

    await user.click(within(region).getByText("Change the compared shared periods"));
    await user.clear(baselineFrom);
    await user.type(baselineFrom, "2026-03-30");
    await user.click(within(region).getByRole("button", { name: "Compare shared periods" }));
    expect(onError).toHaveBeenLastCalledWith("invalid-longitudinal-comparison");
    expect(baselineFrom).toHaveAttribute("aria-invalid", "true");
    expect(baselineFrom).toHaveAttribute("aria-describedby", "application-error");
    expect(baselineThrough).toHaveAttribute("aria-invalid", "true");
    expect(within(region).getByRole("region", {
      name: "Compared-history answer",
    })).toBeVisible();

    await user.click(within(result).getByRole("button", {
      name: "Clear longitudinal comparison",
    }));
    expect(within(region).queryByRole("region", {
      name: "Compared-history answer",
    })).not.toBeInTheDocument();
  });

  it("opens shared comparison with distinct evidence-anchored periods and manual control", async () => {
    mocks.invoke.mockResolvedValue(overview());
    const user = userEvent.setup();
    renderPanel();
    const region = screen.getByRole("region", { name: "Longitudinal dashboard" });
    await within(region).findByRole("region", { name: "Aligned-history answer" });

    await user.click(within(region).getByRole("button", { name: "Compare periods" }));

    expect(within(region).getByRole("button", { name: "Week to date" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(within(region).getByLabelText("Baseline period start"))
      .toHaveValue("2026-03-23");
    expect(within(region).getByLabelText("Baseline period end"))
      .toHaveValue("2026-03-23");
    expect(within(region).getByLabelText("Comparison period start"))
      .toHaveValue("2026-03-30");
    expect(within(region).getByLabelText("Comparison period end"))
      .toHaveValue("2026-03-30");
    expect(within(region).getByText("The four dates below remain editable."))
      .toBeVisible();
  });

  it("nests metric headings under each independent comparison origin", async () => {
    const multiple = comparison();
    multiple.series.push({
      ...multiple.series[0],
      seriesRef: "opaque-origin-beta",
    });
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_longitudinal_overview") return Promise.resolve(overview());
      if (command === "query_longitudinal_comparison") return Promise.resolve(multiple);
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();
    const region = screen.getByRole("region", { name: "Longitudinal dashboard" });

    await user.click(within(region).getByRole("button", { name: "Compare periods" }));
    await user.click(within(region).getByRole("button", { name: "Compare shared periods" }));

    const result = await within(region).findByRole("region", {
      name: "Compared-history answer",
    });
    expect(within(result).getAllByRole("heading", {
      name: "Four histories compared side by side",
      level: 3,
    })).toHaveLength(2);
    expect(within(result).getAllByRole("heading", {
      name: "Total steps",
      level: 4,
    })).toHaveLength(2);
  });

  it("preserves the last aligned comparison through a contextual failure and retry", async () => {
    let comparisonRequests = 0;
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_longitudinal_overview") return Promise.resolve(overview());
      if (command === "query_longitudinal_comparison") {
        comparisonRequests += 1;
        if (comparisonRequests === 2) return Promise.reject(new Error("library unavailable"));
        return Promise.resolve(comparison());
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel({ onError: vi.fn() });
    const region = screen.getByRole("region", { name: "Longitudinal dashboard" });
    await user.click(within(region).getByRole("button", { name: "Compare periods" }));
    const baselineStart = within(region)
      .getByLabelText("Baseline period start")
      .getAttribute("value");
    await user.click(within(region).getByRole("button", { name: "Compare shared periods" }));
    await within(region).findByRole("region", { name: "Compared-history answer" });
    await user.click(within(region).getByText("Change the compared shared periods"));
    await user.click(within(region).getByRole("button", { name: "Compare shared periods" }));

    const unavailable = await within(region).findByRole("region", {
      name: "Longitudinal comparison unavailable",
    });
    expect(within(region).getByRole("region", { name: "Compared-history answer" }))
      .toBeVisible();
    expect(within(region).getByLabelText("Baseline period start"))
      .toHaveValue(baselineStart);
    await user.click(within(unavailable).getByRole("button", {
      name: "Try this comparison again",
    }));

    await waitFor(() => expect(comparisonRequests).toBe(3));
    expect(within(region).queryByRole("region", {
      name: "Longitudinal comparison unavailable",
    })).not.toBeInTheDocument();
    expect(within(region).getByRole("region", { name: "Compared-history answer" }))
      .toBeVisible();
  });

  it("keeps every history source separate in a longitudinal comparison", async () => {
    const multiple = comparison();
    const second = structuredClone(multiple.series[0]);
    second.seriesRef = "opaque-origin-beta";
    second.activity.totalStepChange = null;
    second.sleep.averageAsleepMillisecondsChange = null;
    multiple.series.push(second);
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_longitudinal_overview") return Promise.resolve(overview());
      if (command === "query_longitudinal_comparison") return Promise.resolve(multiple);
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();
    const region = screen.getByRole("region", { name: "Longitudinal dashboard" });
    await user.click(within(region).getByRole("button", { name: "Compare periods" }));
    await user.click(within(region).getByRole("button", { name: "Compare shared periods" }));

    const answer = await within(region).findByRole("region", {
      name: "Compared-history answer",
    });
    expect(within(answer).getByRole("heading", {
      name: "2 separate history sources compared",
    })).toBeVisible();
    expect(within(answer).getAllByText("Four-domain period comparison")).toHaveLength(2);
    expect(within(answer).queryByText("opaque-origin-alpha")).not.toBeInTheDocument();
    expect(within(answer).queryByText("opaque-origin-beta")).not.toBeInTheDocument();
  });

  it("localizes the complete experience and refreshes after a new import token", async () => {
    mocks.invoke.mockResolvedValue(overview());
    const onError = vi.fn();
    const onNavigate = vi.fn();
    const view = renderPanel({ locale: "es-ES", onError, onNavigate });
    const region = screen.getByRole("region", { name: "Panel longitudinal" });
    const user = userEvent.setup();
    expect(await within(region).findByRole("heading", {
      name: "Cuatro historiales alineados en 3 fechas",
    })).toBeVisible();
    expect(within(region).getByText(
      /No establece causas, diagnósticos/,
    )).toBeVisible();
    await user.click(within(region).getByText("Cambiar el periodo compartido"));
    expect(within(region).getByText("Explorar un periodo compartido")).toBeVisible();
    await user.click(within(region).getByText("Revisar días y mediciones exactos"));
    await user.click(within(region).getByRole("button", {
      name: "Ver detalles alineados del 28 mar 2026",
    }));
    const detail = within(region).getByRole("region", { name: "Detalle del día alineado" });
    expect(within(detail).getByText(
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
