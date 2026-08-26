import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import { SleepComparisonPanel } from "./SleepComparisonPanel";
import type { SleepComparison, SleepSeriesSummary } from "./sleep-insights";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

function summary(overrides: Partial<SleepSeriesSummary> = {}): SleepSeriesSummary {
  return {
    calendarDays: 3,
    observedNights: 3,
    missingNights: 0,
    totalAsleepMilliseconds: "75600000",
    averageAsleepMilliseconds: "25200000",
    totalInterruptionMilliseconds: "5400000",
    averageInterruptionMilliseconds: "1800000",
    averageEfficiencyPercent: 89,
    phaseNightCount: 2,
    phaseTotals: null,
    stageTimelineNightCount: 2,
    scoreNightCount: 2,
    averageOverallScore: 82,
    goalNightCount: 2,
    goalMetNightCount: 1,
    powerStatusNightCount: 2,
    powerLossNightCount: 0,
    ...overrides,
  };
}

const comparison: SleepComparison = {
  availableRange: { from: "2026-03-01", through: "2026-03-30" },
  baselineRange: { from: "2026-03-01", through: "2026-03-03" },
  comparisonRange: { from: "2026-03-28", through: "2026-03-30" },
  series: [{
    seriesRef: "source-a",
    baseline: summary(),
    comparison: summary({
      observedNights: 2,
      missingNights: 1,
      averageAsleepMilliseconds: "26100000",
    }),
    observedNightChange: "-1",
    missingNightChange: "1",
    averageAsleepMillisecondsChange: "900000",
    averageInterruptionMillisecondsChange: "-300000",
    averageEfficiencyPercentagePointChange: 2.25,
    averageOverallScoreChange: 5.5,
    goalMetPercentagePointChange: -50,
  }],
};

afterEach(cleanup);

beforeEach(() => {
  mocks.invoke.mockReset();
});

describe("SleepComparisonPanel", () => {
  it("offers useful calendar presets while keeping all four dates editable", async () => {
    const user = userEvent.setup();
    render(
      <SleepComparisonPanel
        availableRange={{ from: "2026-01-01", through: "2026-03-30" }}
        initialRange={{ from: "2026-03-28", through: "2026-03-30" }}
        locale="en-US"
        messages={catalogs["en-US"]}
        onError={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Baseline period start")).toHaveValue("2026-03-23");
    expect(screen.getByLabelText("Comparison period start")).toHaveValue("2026-03-30");

    await user.click(screen.getByRole("button", { name: "Month to date" }));

    expect(screen.getByLabelText("Baseline period start")).toHaveValue("2026-02-01");
    expect(screen.getByLabelText("Baseline period end")).toHaveValue("2026-02-28");
    expect(screen.getByLabelText("Comparison period start")).toHaveValue("2026-03-01");
    expect(screen.getByLabelText("Comparison period end")).toHaveValue("2026-03-30");
    expect(screen.getByText("The four dates below remain editable.")).toBeVisible();
  });

  it("leads with the recorded-duration answer and keeps controls and exact values secondary", async () => {
    mocks.invoke.mockResolvedValue(comparison);
    const user = userEvent.setup();
    render(
      <SleepComparisonPanel
        availableRange={{ from: "2026-03-01", through: "2026-03-30" }}
        initialRange={{ from: "2026-03-28", through: "2026-03-30" }}
        locale="en-US"
        messages={catalogs["en-US"]}
        onError={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Compare sleep periods" }));

    const answer = await screen.findByRole("region", { name: "Sleep period answer" });
    const heading = within(answer).getByRole("heading", {
      name: "Average recorded sleep was 15 min longer",
      level: 2,
    });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(within(answer).getByText(
      "3 recorded nights in baseline · 2 recorded nights in comparison",
    )).toBeVisible();
    const controls = screen.getByText("Change the compared sleep periods").closest("details");
    expect(answer.compareDocumentPosition(controls as Node) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(controls).not.toHaveAttribute("open");

    const exact = within(answer).getByText("Review exact values").closest("details");
    expect(exact).not.toHaveAttribute("open");
    expect(within(answer).getByRole("table", { name: "Sleep period comparison" }))
      .not.toBeVisible();
    await user.click(within(answer).getByText("Review exact values"));
    expect(within(answer).getByText("+15 min")).toBeVisible();
    expect(within(answer).getByText("-50 pp")).toBeVisible();
  });

  it("preserves the last answer and periods through a contextual failure and retry", async () => {
    mocks.invoke
      .mockResolvedValueOnce(comparison)
      .mockRejectedValueOnce(new Error("library unavailable"))
      .mockResolvedValueOnce(comparison);
    const user = userEvent.setup();
    render(
      <SleepComparisonPanel
        availableRange={{ from: "2026-03-01", through: "2026-03-30" }}
        initialRange={{ from: "2026-03-28", through: "2026-03-30" }}
        locale="en-US"
        messages={catalogs["en-US"]}
        onError={vi.fn()}
      />,
    );
    const baselineStart = screen.getByLabelText("Baseline period start").getAttribute("value");

    await user.click(screen.getByRole("button", { name: "Compare sleep periods" }));
    await screen.findByRole("region", { name: "Sleep period answer" });
    await user.click(screen.getByText("Change the compared sleep periods"));
    await user.click(screen.getByRole("button", { name: "Compare sleep periods" }));

    const unavailable = await screen.findByRole("region", {
      name: "Sleep comparison unavailable",
    });
    expect(screen.getByRole("region", { name: "Sleep period answer" })).toBeVisible();
    expect(screen.getByLabelText("Baseline period start")).toHaveValue(baselineStart);
    await user.click(within(unavailable).getByRole("button", {
      name: "Try this sleep comparison again",
    }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(3));
    expect(screen.queryByRole("region", { name: "Sleep comparison unavailable" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Sleep period answer" })).toBeVisible();
  });

  it("keeps origins separate and gives each one a factual conclusion", async () => {
    mocks.invoke.mockResolvedValue({
      ...comparison,
      series: [
        comparison.series[0],
        {
          ...comparison.series[0],
          seriesRef: "source-b",
          baseline: summary({ averageAsleepMilliseconds: "27000000" }),
          comparison: summary({ averageAsleepMilliseconds: "25200000" }),
          averageAsleepMillisecondsChange: "-1800000",
        },
      ],
    });
    const user = userEvent.setup();
    render(
      <SleepComparisonPanel
        availableRange={{ from: "2026-03-01", through: "2026-03-30" }}
        initialRange={{ from: "2026-03-28", through: "2026-03-30" }}
        locale="en-US"
        messages={catalogs["en-US"]}
        onError={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Compare sleep periods" }));

    const answer = await screen.findByRole("region", { name: "Sleep period answer" });
    expect(within(answer).getByRole("heading", {
      name: "2 sleep histories compared",
      level: 2,
    }))
      .toBeVisible();
    expect(within(answer).getByRole("heading", {
      name: "Average recorded sleep was 15 min longer",
      level: 3,
    })).toBeVisible();
    expect(within(answer).getByRole("heading", {
      name: "Average recorded sleep was 30 min shorter",
      level: 3,
    })).toBeVisible();
  });

  it("states when neither period contains a recorded night without inventing a value", async () => {
    mocks.invoke.mockResolvedValue({
      ...comparison,
      series: [{
        ...comparison.series[0],
        baseline: summary({
          observedNights: 0,
          missingNights: 3,
          averageAsleepMilliseconds: null,
        }),
        comparison: summary({
          observedNights: 0,
          missingNights: 3,
          averageAsleepMilliseconds: null,
        }),
        averageAsleepMillisecondsChange: null,
      }],
    });
    const user = userEvent.setup();
    render(
      <SleepComparisonPanel
        availableRange={{ from: "2026-03-01", through: "2026-03-30" }}
        initialRange={{ from: "2026-03-28", through: "2026-03-30" }}
        locale="en-US"
        messages={catalogs["en-US"]}
        onError={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Compare sleep periods" }));

    const answer = await screen.findByRole("region", { name: "Sleep period answer" });
    expect(within(answer).getByRole("heading", {
      name: "Neither period contains recorded sleep",
    })).toBeVisible();
    expect(within(answer).getByText(
      "0 recorded nights in baseline · 0 recorded nights in comparison",
    )).toBeVisible();
    expect(within(answer).queryByText(/0 h/)).not.toBeInTheDocument();
  });
});
