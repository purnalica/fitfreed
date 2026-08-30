import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type { ExplorerNavigationRequest } from "./explorer-navigation";
import { SleepInsightsPanel } from "./SleepInsightsPanel";
import type {
  SleepComparison,
  SleepOverview,
  SleepPeriodDetail,
  SleepPeriodInsight,
  SleepSeriesSummary,
} from "./sleep-insights";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

afterEach(() => {
  cleanup();
  mocks.invoke.mockReset();
});

function period(overrides: Partial<SleepPeriodInsight> = {}): SleepPeriodInsight {
  return {
    startedAt: "2026-03-27T22:30:00+01:00",
    endedAt: "2026-03-28T06:30:00+01:00",
    spanMilliseconds: "28800000",
    asleepMilliseconds: "27000000",
    interruptionMilliseconds: "1800000",
    longInterruptionMilliseconds: "1200000",
    shortInterruptionMilliseconds: "600000",
    interruptionCount: "7",
    longInterruptionCount: "2",
    shortInterruptionCount: "5",
    efficiencyPercent: 93.75,
    continuityIndex: 4.2,
    continuityClass: 4,
    sleepGoalMilliseconds: "28800000",
    selfReportedRating: 4,
    cycleCount: "5",
    recordingEndedByPowerLoss: false,
    phaseSummary: {
      wakeMilliseconds: "1800000",
      remMilliseconds: "5400000",
      lightMilliseconds: "14400000",
      deepMilliseconds: "7200000",
      unrecognizedMilliseconds: "0",
    },
    stageTimelineAvailable: true,
    scoreOverall: 87.5,
    scoreRelativeRating: 4,
    ...overrides,
  };
}

function summary(overrides: Partial<SleepSeriesSummary> = {}): SleepSeriesSummary {
  return {
    calendarDays: 3,
    observedNights: 2,
    missingNights: 1,
    totalAsleepMilliseconds: "52200000",
    averageAsleepMilliseconds: "26100000",
    totalInterruptionMilliseconds: "3600000",
    averageInterruptionMilliseconds: "1800000",
    averageEfficiencyPercent: 91.25,
    phaseNightCount: 1,
    phaseTotals: {
      wakeMilliseconds: "1800000",
      remMilliseconds: "5400000",
      lightMilliseconds: "14400000",
      deepMilliseconds: "7200000",
      unrecognizedMilliseconds: "0",
    },
    stageTimelineNightCount: 1,
    scoreNightCount: 1,
    averageOverallScore: 87.5,
    goalNightCount: 1,
    goalMetNightCount: 0,
    powerStatusNightCount: 1,
    powerLossNightCount: 0,
    ...overrides,
  };
}

function overview(
  selectedRange = { from: "2026-03-28", through: "2026-03-30" },
): SleepOverview {
  return {
    availableRange: { from: "2026-03-01", through: "2026-03-30" },
    selectedRange,
    series: [
      {
        seriesRef: "opaque-origin-alpha",
        summary: summary(),
        days: [
          { sleepDate: "2026-03-28", availability: "available", period: period() },
          { sleepDate: "2026-03-29", availability: "missing", period: null },
          {
            sleepDate: "2026-03-30",
            availability: "available",
            period: period({
              startedAt: "2026-03-29T23:00:00+02:00",
              endedAt: "2026-03-30T06:30:00+02:00",
              spanMilliseconds: "27000000",
              asleepMilliseconds: "25200000",
              phaseSummary: null,
              stageTimelineAvailable: false,
              scoreOverall: null,
              scoreRelativeRating: null,
              sleepGoalMilliseconds: null,
              selfReportedRating: null,
              cycleCount: null,
              recordingEndedByPowerLoss: null,
            }),
          },
        ],
      },
      {
        seriesRef: "opaque-origin-beta",
        summary: summary({
          observedNights: 1,
          missingNights: 2,
          scoreNightCount: 0,
          averageOverallScore: null,
          phaseNightCount: 0,
          phaseTotals: null,
          stageTimelineNightCount: 0,
          goalNightCount: 0,
          goalMetNightCount: 0,
          powerStatusNightCount: 0,
          powerLossNightCount: 0,
        }),
        days: [
          { sleepDate: "2026-03-28", availability: "available", period: period({ phaseSummary: null, stageTimelineAvailable: false, scoreOverall: null }) },
          { sleepDate: "2026-03-29", availability: "missing", period: null },
          { sleepDate: "2026-03-30", availability: "missing", period: null },
        ],
      },
    ],
  };
}

function detail(sleepDate = "2026-03-28"): SleepPeriodDetail {
  return {
    sleepDate,
    startedAt: "2026-03-27T22:30:00+01:00",
    endedAt: "2026-03-28T06:30:00+01:00",
    spanMilliseconds: "28800000",
    asleepMilliseconds: "27000000",
    interruptionMilliseconds: "1800000",
    longInterruptionMilliseconds: "1200000",
    shortInterruptionMilliseconds: "600000",
    interruptionCount: "7",
    longInterruptionCount: "2",
    shortInterruptionCount: "5",
    efficiencyPercent: 93.75,
    continuityIndex: 4.2,
    continuityClass: 4,
    sleepGoalMilliseconds: "28800000",
    selfReportedRating: 4,
    cycleCount: "5",
    recordingEndedByPowerLoss: false,
    phaseSummary: {
      wakeMilliseconds: "1800000",
      remMilliseconds: "5400000",
      lightMilliseconds: "14400000",
      deepMilliseconds: "7200000",
      unrecognizedMilliseconds: "0",
    },
    stageTransitions: [
      { offsetMilliseconds: "0", stage: "wake" },
      { offsetMilliseconds: "600000", stage: "light" },
      { offsetMilliseconds: "7200000", stage: "deep" },
      { offsetMilliseconds: "14400000", stage: "rem" },
    ],
    score: {
      overall: 87.5,
      ownTargetDuration: 86,
      recommendedDuration: 84,
      continuity: 90,
      efficiency: 94,
      rem: 82,
      deep: 91,
      longInterruptions: 78,
      duration: 88,
      solidity: 85,
      regeneration: 89,
      relativeRating: 4,
    },
  };
}

function comparison(): SleepComparison {
  return {
    availableRange: { from: "2026-03-01", through: "2026-03-30" },
    baselineRange: { from: "2026-03-01", through: "2026-03-03" },
    comparisonRange: { from: "2026-03-28", through: "2026-03-30" },
    series: [{
      seriesRef: "opaque-origin-alpha",
      baseline: summary({ averageAsleepMilliseconds: "25200000", observedNights: 3, missingNights: 0, averageEfficiencyPercent: 89, averageOverallScore: 82, goalNightCount: 2, goalMetNightCount: 1 }),
      comparison: summary(),
      observedNightChange: "-1",
      missingNightChange: "1",
      averageAsleepMillisecondsChange: "900000",
      averageInterruptionMillisecondsChange: "-300000",
      averageEfficiencyPercentagePointChange: 2.25,
      averageOverallScoreChange: 5.5,
      goalMetPercentagePointChange: -50,
    }],
  };
}

function renderPanel(overrides: {
  locale?: "en-US" | "es-ES";
  refreshToken?: number;
  navigationRequest?: ExplorerNavigationRequest;
  onError?: (code: string | undefined) => void;
} = {}) {
  const locale = overrides.locale ?? "en-US";
  return render(
    <SleepInsightsPanel
      locale={locale}
      messages={catalogs[locale]}
      refreshToken={overrides.refreshToken ?? 0}
      navigationRequest={overrides.navigationRequest}
      onError={overrides.onError ?? vi.fn()}
    />,
  );
}

describe("SleepInsightsPanel", () => {
  it("leads with a human sleep answer before period controls and exact nights", async () => {
    mocks.invoke.mockResolvedValue(overview());
    const user = userEvent.setup();
    renderPanel();

    const answer = await screen.findByRole("region", { name: "Sleep pattern answer" });
    const heading = within(answer).getByRole("heading", { name: "2 sleep histories shown" });
    expect(heading).toBeVisible();
    await waitFor(() => expect(heading).toHaveFocus());
    const resultHeadings = within(answer).getAllByRole("heading", {
      name: "Average recorded sleep: 7 h 15 min",
    });
    expect(resultHeadings).toHaveLength(2);
    for (const resultHeading of resultHeadings) {
      expect(within(resultHeading).getByText("7 h 15 min"))
        .toHaveClass("answer-measurement");
    }
    expect(within(answer).getByText("Recorded sleep is available for 2 of 3 nights"))
      .toBeVisible();
    expect(within(answer).getByText("Recorded sleep is available for 1 of 3 nights"))
      .toBeVisible();

    const controls = screen.getByText("Change sleep period").closest("details");
    expect(controls).not.toHaveAttribute("open");
    expect(answer.compareDocumentPosition(controls as Node) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();

    const exact = within(answer).getAllByText("Review measurements and exact nights");
    expect(exact).toHaveLength(2);
    expect(within(answer).getByRole("table", { name: "Sleep origin 1 exact nights" }))
      .not.toBeVisible();
    await user.click(exact[0]);
    expect(within(answer).getByRole("table", { name: "Sleep origin 1 exact nights" }))
      .toBeVisible();
    const detailButtons = within(answer).getAllByRole("button", {
      name: /View sleep details for/,
    });
    expect(detailButtons.slice(0, 2).every((button) => button.closest("details")?.open))
      .toBe(true);
    expect(detailButtons[2].closest("details")).not.toHaveAttribute("open");
  });

  it("makes the recorded sleep result primary when one history is present", async () => {
    const result = overview();
    result.series = result.series.slice(0, 1);
    mocks.invoke.mockResolvedValue(result);
    renderPanel();

    const answer = await screen.findByRole("region", { name: "Sleep pattern answer" });
    expect(within(answer).getByRole("heading", {
      name: "Average recorded sleep: 7 h 15 min",
    })).toBeVisible();
    expect(within(answer).getByText("Recorded sleep is available for 2 of 3 nights"))
      .toBeVisible();
  });

  it.each([
    ["en-US", "Recorded sleep is available for 1 of 1 night", "Observed nights · 1 of 1 night"],
    ["es-ES", "Hay sueño registrado en 1 de 1 noche", "Noches observadas · 1 de 1 noche"],
  ] as const)("pluralizes one-night sleep coverage in %s", async (
    locale,
    expectedAnswer,
    expectedCoverage,
  ) => {
    const result = overview({ from: "2026-03-28", through: "2026-03-28" });
    result.availableRange = { from: "2026-03-28", through: "2026-03-28" };
    result.series = [{
      ...result.series[0],
      summary: summary({ calendarDays: 1, observedNights: 1, missingNights: 0 }),
      days: result.series[0].days.slice(0, 1),
    }];
    mocks.invoke.mockResolvedValue(result);
    const user = userEvent.setup();
    renderPanel({ locale });

    const answer = await screen.findByRole("region", {
      name: catalogs[locale].sleep.answerLabel,
    });
    expect(within(answer).getByText(expectedAnswer)).toBeVisible();
    await user.click(within(answer).getByText(catalogs[locale].sleep.answerExact));
    expect(within(answer).getByText(expectedCoverage)).toBeVisible();
  });

  it("announces the exact latest-window operation without replacing the current history", async () => {
    let requestCount = 0;
    let completeReset: (value: SleepOverview) => void = () => undefined;
    const pendingReset = new Promise<SleepOverview>((resolve) => {
      completeReset = resolve;
    });
    mocks.invoke.mockImplementation((command) => {
      if (command !== "query_sleep_overview") {
        throw new Error(`Unexpected command: ${command}`);
      }
      requestCount += 1;
      return requestCount === 1 ? Promise.resolve(overview()) : pendingReset;
    });
    const user = userEvent.setup();
    renderPanel();
    const region = screen.getByRole("region", { name: "Sleep history" });
    expect(within(region).getByText(
      "Explore recorded nights, open their sleep details, or compare two periods without treating missing nights as zero sleep.",
    )).toBeVisible();
    const form = await within(region).findByRole("form", { name: "Explore a sleep period" });

    await user.click(within(form).getByRole("button", { name: "Latest 30-day window" }));

    expect(form).toHaveAttribute("aria-busy", "true");
    expect(within(form).getByRole("button", { name: "Apply sleep period" })).toBeDisabled();
    expect(within(form).getByRole("button", { name: "Latest 30-day window" })).toBeDisabled();
    expect(within(form).getByRole("status")).toHaveTextContent(
      "Loading latest 30-day window…",
    );
    expect(within(region).getAllByRole("button", { name: /View sleep details for/ }))
      .toHaveLength(3);

    act(() => completeReset(overview()));
    await waitFor(() => expect(form).toHaveAttribute("aria-busy", "false"));
  });

  it("distinguishes loading, empty, and unavailable history", async () => {
    let resolveOverview: (value: SleepOverview) => void = () => undefined;
    mocks.invoke.mockImplementation(() => new Promise<SleepOverview>((resolve) => {
      resolveOverview = resolve;
    }));
    const view = renderPanel();
    const region = screen.getByRole("region", { name: "Sleep history" });
    expect(within(region).getByRole("status")).toHaveTextContent("Loading sleep history…");
    resolveOverview({ availableRange: null, selectedRange: null, series: [] });
    expect(await within(region).findByText("No imported sleep periods yet.")).toBeVisible();

    view.unmount();
    mocks.invoke.mockRejectedValue({ code: "library-query-failed" });
    renderPanel();
    expect(await screen.findByText("Sleep history could not be loaded.")).toBeVisible();
  });

  it("announces a pending exact sleep detail", async () => {
    let resolveDetail: (value: ReturnType<typeof detail>) => void = () => undefined;
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_sleep_overview") return Promise.resolve(overview());
      if (command === "query_sleep_detail") {
        return new Promise<ReturnType<typeof detail>>((resolve) => {
          resolveDetail = resolve;
        });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();
    const sleep = await screen.findByRole("region", { name: "Sleep history" });

    await user.click((await within(sleep).findAllByRole("button", {
      name: /View sleep details for/,
    }))[0]);

    const detailRegion = within(sleep).getByRole("region", { name: "Sleep detail" });
    expect(within(detailRegion).getByRole("status")).toHaveTextContent(
      "Loading the exact sleep detail…",
    );
    resolveDetail(detail("2026-03-28"));
    expect(await within(detailRegion).findByText("7 h 30 min")).toBeVisible();
  });

  it("explores every visible measurement without exposing origin references", async () => {
    const complete = overview();
    const filtered = overview({ from: "2026-03-30", through: "2026-03-30" });
    filtered.series = filtered.series.map((series) => ({
      ...series,
      summary: summary({ calendarDays: 1, observedNights: series.days[2].period ? 1 : 0, missingNights: series.days[2].period ? 0 : 1 }),
      days: [series.days[2]],
    }));
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_sleep_overview") {
        return Promise.resolve(arguments_.requestedRange ? filtered : complete);
      }
      if (command === "query_sleep_detail") return Promise.resolve(detail(arguments_.sleepDate));
      if (command === "query_sleep_comparison") return Promise.resolve(comparison());
      throw new Error(`Unexpected command: ${command}`);
    });
    const onError = vi.fn();
    const user = userEvent.setup();
    renderPanel({ onError });
    const sleep = await screen.findByRole("region", { name: "Sleep history" });

    const detailButtons = await within(sleep).findAllByRole("button", {
      name: /View sleep details for/,
    });
    expect(within(sleep).getByText("Sleep origin 1")).toBeVisible();
    expect(within(sleep).getByText("Sleep origin 2")).toBeVisible();
    expect(within(sleep).getAllByText("7 h 15 min").length).toBeGreaterThan(0);
    expect(within(sleep).getAllByText("87.5").length).toBeGreaterThan(0);
    expect(within(sleep).getAllByText("1 of 2 nights", { exact: false }).length)
      .toBeGreaterThanOrEqual(4);
    expect(within(sleep).queryByText("opaque-origin-alpha")).not.toBeInTheDocument();
    expect(within(sleep).queryByText("opaque-origin-beta")).not.toBeInTheDocument();

    const detailOrigin = detailButtons[0];
    await user.click(detailOrigin);
    expect(mocks.invoke).toHaveBeenCalledWith("query_sleep_detail", {
      seriesRef: "opaque-origin-alpha",
      sleepDate: "2026-03-28",
    });
    const detailRegion = await within(sleep).findByRole("region", { name: "Sleep detail" });
    await waitFor(() => expect(within(detailRegion).getByRole("heading", {
      name: "Sleep detail",
    })).toHaveFocus());
    expect(within(detailRegion).getByText(/Mar 27, 2026.*UTC\+01:00/)).toBeVisible();
    expect(within(detailRegion).getByText("7 h 30 min")).toBeVisible();
    expect(within(detailRegion).getAllByText("No")).toHaveLength(2);
    expect(within(detailRegion).getByRole("region", { name: "Sleep phase composition" })).toBeVisible();
    const timeline = within(detailRegion).getByRole("table", { name: "Exact sleep stage transitions" });
    expect(within(timeline).getAllByRole("row")).toHaveLength(5);
    expect(within(timeline).getByRole("row", { name: /2 h Deep/ })).toBeVisible();
    expect(within(detailRegion).getByRole("region", { name: "Sleep score components" })).toBeVisible();
    expect(within(detailRegion).getByText("Regeneration")).toBeVisible();
    await user.click(within(detailRegion).getByRole("button", { name: "Close sleep detail" }));
    expect(within(sleep).queryByRole("region", { name: "Sleep detail" })).not.toBeInTheDocument();
    await waitFor(() => expect(detailOrigin).toHaveFocus());

    const filter = within(sleep).getByRole("form", { name: "Explore a sleep period" });
    await user.clear(within(filter).getByLabelText("From"));
    await user.type(within(filter).getByLabelText("From"), "2026-03-30");
    await user.clear(within(filter).getByLabelText("Through"));
    await user.type(within(filter).getByLabelText("Through"), "2026-03-30");
    await user.click(within(filter).getByRole("button", { name: "Apply sleep period" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("query_sleep_overview", {
      requestedRange: { from: "2026-03-30", through: "2026-03-30" },
    }));
    expect(within(sleep).getAllByRole("button", { name: /View sleep details for/ })).toHaveLength(1);
    await user.click(within(filter).getByRole("button", { name: "Latest 30-day window" }));
    await waitFor(() => expect(within(sleep).getAllByRole("button", { name: /View sleep details for/ })).toHaveLength(3));

    const workspaceNavigation = within(sleep).getByRole("navigation", {
      name: "Sleep workspace",
    });
    const comparisonWorkspace = within(workspaceNavigation).getByRole("button", {
      name: "Compare periods",
    });
    await user.click(comparisonWorkspace);
    expect(comparisonWorkspace).toHaveAttribute("aria-current", "page");
    const comparisonForm = within(sleep).getByRole("form", { name: "Compare sleep periods" });
    const ranges = [
      ["Baseline period start", "2026-03-01"], ["Baseline period end", "2026-03-03"],
      ["Comparison period start", "2026-03-28"], ["Comparison period end", "2026-03-30"],
    ] as const;
    for (const [label, value] of ranges) {
      await user.clear(within(comparisonForm).getByLabelText(label));
      await user.type(within(comparisonForm).getByLabelText(label), value);
    }
    await user.click(within(comparisonForm).getByRole("button", { name: "Compare sleep periods" }));
    expect(mocks.invoke).toHaveBeenCalledWith("query_sleep_comparison", {
      baselineRange: { from: "2026-03-01", through: "2026-03-03" },
      comparisonRange: { from: "2026-03-28", through: "2026-03-30" },
    });
    const result = await within(sleep).findByRole("region", { name: "Sleep period answer" });
    await waitFor(() => expect(within(result).getByRole("heading", {
      name: "Average recorded sleep was 15 min longer",
    })).toHaveFocus());
    await user.click(within(result).getByText("Review exact values"));
    expect(within(result).getByText("+15 min")).toBeVisible();
    expect(within(result).getByText("−5 min")).toBeVisible();
    expect(within(result).getByText("-50 pp")).toBeVisible();
    await user.click(within(workspaceNavigation).getByRole("button", { name: "Nights" }));
    expect(within(sleep).queryByRole("region", {
      name: "Sleep period answer",
    })).not.toBeInTheDocument();
    await user.click(comparisonWorkspace);
    expect(within(sleep).getByRole("region", { name: "Sleep period answer" })).toBeVisible();
    await user.click(within(result).getByRole("button", { name: "Clear sleep comparison" }));
    expect(within(sleep).queryByRole("region", { name: "Sleep period answer" }))
      .not.toBeInTheDocument();
  });

  it("opens the exact authoritative night requested by the longitudinal dashboard", async () => {
    const exact = overview({ from: "2026-03-28", through: "2026-03-28" });
    exact.series = exact.series.map((series) => ({ ...series, days: [series.days[0]] }));
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_sleep_overview") {
        return Promise.resolve(arguments_.requestedRange ? exact : overview());
      }
      if (command === "query_sleep_detail") return Promise.resolve(detail(arguments_.sleepDate));
      throw new Error(`Unexpected command: ${command}`);
    });
    const onError = vi.fn();
    const view = renderPanel({ onError });
    await screen.findByRole("region", { name: "Sleep history" });

    view.rerender(
      <SleepInsightsPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        navigationRequest={{
          seriesRef: "opaque-origin-alpha",
          localDate: "2026-03-28",
          requestId: 1,
        }}
        onError={onError}
      />,
    );

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("query_sleep_overview", {
      requestedRange: { from: "2026-03-28", through: "2026-03-28" },
    }));
    expect(mocks.invoke).toHaveBeenCalledWith("query_sleep_detail", {
      seriesRef: "opaque-origin-alpha",
      sleepDate: "2026-03-28",
    });
    expect(await screen.findByRole("region", { name: "Sleep detail" })).toBeVisible();
  });

  it("keeps direct longitudinal navigation authoritative over a late default overview", async () => {
    const exact = overview({ from: "2026-03-28", through: "2026-03-28" });
    exact.series = exact.series.map((series) => ({ ...series, days: [series.days[0]] }));
    let resolveDefault: (value: SleepOverview) => void = () => undefined;
    const defaultOverview = new Promise<SleepOverview>((resolve) => {
      resolveDefault = resolve;
    });
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_sleep_overview") {
        return arguments_.requestedRange ? Promise.resolve(exact) : defaultOverview;
      }
      if (command === "query_sleep_detail") return Promise.resolve(detail(arguments_.sleepDate));
      throw new Error(`Unexpected command: ${command}`);
    });

    renderPanel({
      navigationRequest: {
        seriesRef: "opaque-origin-alpha",
        localDate: "2026-03-28",
        requestId: 1,
      },
    });

    expect(await screen.findByRole("region", { name: "Sleep detail" })).toBeVisible();
    await act(async () => resolveDefault(overview()));
    expect(screen.getByRole("region", { name: "Sleep detail" })).toBeVisible();
  });

  it("preserves valid results on invalid input and ignores stale detail responses", async () => {
    let resolveFirst: (value: SleepPeriodDetail) => void = () => undefined;
    const firstDetail = new Promise<SleepPeriodDetail>((resolve) => { resolveFirst = resolve; });
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_sleep_overview") return Promise.resolve(overview());
      if (command === "query_sleep_comparison") return Promise.resolve(comparison());
      if (command === "query_sleep_detail" && arguments_.sleepDate === "2026-03-28") return firstDetail;
      if (command === "query_sleep_detail") return Promise.resolve(detail("2026-03-30"));
      throw new Error(`Unexpected command: ${command}`);
    });
    const onError = vi.fn();
    const user = userEvent.setup();
    const view = renderPanel({ onError });
    const sleep = await screen.findByRole("region", { name: "Sleep history" });
    const buttons = await within(sleep).findAllByRole("button", {
      name: /View sleep details for/,
    });
    await user.click(buttons[0]);
    view.rerender(
      <SleepInsightsPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        navigationRequest={{
          seriesRef: "opaque-origin-alpha",
          localDate: "2026-03-30",
          requestId: 1,
        }}
        onError={onError}
      />,
    );
    const detailRegion = await within(sleep).findByRole("region", { name: "Sleep detail" });
    expect(within(detailRegion).getByText("Mar 30, 2026")).toBeVisible();
    resolveFirst(detail("2026-03-28"));
    await waitFor(() => expect(within(detailRegion).getByText("Mar 30, 2026")).toBeVisible());

    await user.click(within(detailRegion).getByRole("button", { name: "Close sleep detail" }));
    const filter = within(sleep).getByRole("form", { name: "Explore a sleep period" });
    await user.clear(within(filter).getByLabelText("From"));
    await user.type(within(filter).getByLabelText("From"), "2026-03-30");
    await user.clear(within(filter).getByLabelText("Through"));
    await user.type(within(filter).getByLabelText("Through"), "2026-03-01");
    await user.click(within(filter).getByRole("button", { name: "Apply sleep period" }));
    expect(onError).toHaveBeenCalledWith("invalid-sleep-range");
    expect(within(filter).getByLabelText("From")).toHaveAttribute("aria-invalid", "true");
    expect(within(filter).getByLabelText("From")).toHaveAttribute(
      "aria-describedby",
      "application-error",
    );
    expect(within(filter).getByLabelText("Through")).toHaveAttribute("aria-invalid", "true");
    expect(within(sleep).getAllByRole("button", { name: /View sleep details for/ })).toHaveLength(3);

    const workspaceNavigation = within(sleep).getByRole("navigation", {
      name: "Sleep workspace",
    });
    await user.click(within(workspaceNavigation).getByRole("button", {
      name: "Compare periods",
    }));
    const comparisonForm = within(sleep).getByRole("form", { name: "Compare sleep periods" });
    await user.click(within(comparisonForm).getByRole("button", { name: "Compare sleep periods" }));
    const comparisonRegion = await within(sleep).findByRole("region", {
      name: "Sleep period answer",
    });
    await user.clear(within(comparisonForm).getByLabelText("Baseline period start"));
    await user.type(within(comparisonForm).getByLabelText("Baseline period start"), "2026-03-30");
    await user.clear(within(comparisonForm).getByLabelText("Baseline period end"));
    await user.type(within(comparisonForm).getByLabelText("Baseline period end"), "2026-03-01");
    await user.click(within(comparisonForm).getByRole("button", { name: "Compare sleep periods" }));
    expect(onError).toHaveBeenCalledWith("invalid-sleep-comparison");
    for (const label of [
      "Baseline period start",
      "Baseline period end",
      "Comparison period start",
      "Comparison period end",
    ]) {
      const input = within(comparisonForm).getByLabelText(label);
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAttribute("aria-describedby", "application-error");
    }
    expect(comparisonRegion).toBeVisible();
  });

  it("returns focus when an exact sleep detail has disappeared", async () => {
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_sleep_overview") return Promise.resolve(overview());
      if (command === "query_sleep_detail") return Promise.resolve(null);
      throw new Error(`Unexpected command: ${command}`);
    });
    const onError = vi.fn();
    const user = userEvent.setup();
    renderPanel({ onError });
    const sleep = await screen.findByRole("region", { name: "Sleep history" });
    const detailOrigin = (await within(sleep).findAllByRole("button", {
      name: "View sleep details for Mar 28, 2026",
    }))[0];

    await user.click(detailOrigin);

    await waitFor(() => expect(onError).toHaveBeenLastCalledWith("invalid-sleep-reference"));
    expect(within(sleep).queryByRole("region", { name: "Sleep detail" }))
      .not.toBeInTheDocument();
    await waitFor(() => expect(detailOrigin).toHaveFocus());
  });

  it("localizes existing state and reloads after the refresh token changes", async () => {
    mocks.invoke.mockResolvedValue(overview());
    const onError = vi.fn();
    const view = renderPanel({ onError });
    await screen.findByRole("heading", { name: "Sleep history" });
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    view.rerender(
      <SleepInsightsPanel
        locale="es-ES"
        messages={catalogs["es-ES"]}
        refreshToken={1}
        onError={onError}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Historial del sueño" })).toBeVisible();
    expect(screen.getByText("Origen del sueño 1")).toBeVisible();
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2));
    expect(mocks.invoke).toHaveBeenLastCalledWith("query_sleep_overview", { requestedRange: null });
  });
});
