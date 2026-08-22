import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import { RecoveryComparisonPanel } from "./RecoveryComparisonPanel";
import type { RecoveryComparison, RecoverySeriesSummary } from "./recovery-insights";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

function summary(overrides: Partial<RecoverySeriesSummary> = {}): RecoverySeriesSummary {
  return {
    calendarDays: 3,
    observedNights: 3,
    missingNights: 0,
    averageBeatToBeatIntervalMilliseconds: "880",
    rmssdNightCount: 2,
    averageHeartRateVariabilityRmssdMilliseconds: "42",
    averageBreathingIntervalMilliseconds: "4200",
    assessmentNightCount: 2,
    baselineNightCount: 2,
    guidanceNightCount: 1,
    ...overrides,
  };
}

const comparison: RecoveryComparison = {
  availableRange: { from: "2026-03-01", through: "2026-03-30" },
  baselineRange: { from: "2026-03-01", through: "2026-03-03" },
  comparisonRange: { from: "2026-03-28", through: "2026-03-30" },
  series: [{
    seriesRef: "source-a",
    baseline: summary(),
    comparison: summary({
      observedNights: 2,
      missingNights: 1,
      averageBeatToBeatIntervalMilliseconds: "905",
    }),
    observedNightChange: "-1",
    missingNightChange: "1",
    averageBeatToBeatIntervalMillisecondsChange: "25",
    averageHeartRateVariabilityRmssdMillisecondsChange: null,
    averageBreathingIntervalMillisecondsChange: "-50",
    assessmentNightChange: "-1",
    baselineNightChange: "-1",
    guidanceNightChange: "0",
  }],
};

afterEach(cleanup);

beforeEach(() => {
  mocks.invoke.mockReset();
});

describe("RecoveryComparisonPanel", () => {
  it("leads with a factual interval answer and keeps controls and exact values secondary", async () => {
    mocks.invoke.mockResolvedValue(comparison);
    const user = userEvent.setup();
    render(
      <RecoveryComparisonPanel
        availableRange={{ from: "2026-03-01", through: "2026-03-30" }}
        initialRange={{ from: "2026-03-28", through: "2026-03-30" }}
        locale="en-US"
        messages={catalogs["en-US"]}
        onError={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Compare recovery periods" }));

    const answer = await screen.findByRole("region", { name: "Recovery period answer" });
    const heading = within(answer).getByRole("heading", {
      name: "Average recorded beat-to-beat interval was 25 ms longer",
    });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(within(answer).getByText(
      "3 recorded nights in baseline · 2 recorded nights in comparison",
    )).toBeVisible();
    const controls = screen.getByText("Change the compared recovery periods")
      .closest("details");
    expect(answer.compareDocumentPosition(controls as Node) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(controls).not.toHaveAttribute("open");

    const exact = within(answer).getByText("Review exact values").closest("details");
    expect(exact).not.toHaveAttribute("open");
    expect(within(answer).getByRole("table", { name: "Recovery period comparison" }))
      .not.toBeVisible();
    await user.click(within(answer).getByText("Review exact values"));
    expect(within(answer).getByText("+25 ms")).toBeVisible();
    expect(within(answer).getByText("-50 ms")).toBeVisible();
  });

  it("preserves the last answer and periods through a contextual failure and retry", async () => {
    mocks.invoke
      .mockResolvedValueOnce(comparison)
      .mockRejectedValueOnce(new Error("library unavailable"))
      .mockResolvedValueOnce(comparison);
    const user = userEvent.setup();
    render(
      <RecoveryComparisonPanel
        availableRange={{ from: "2026-03-01", through: "2026-03-30" }}
        initialRange={{ from: "2026-03-28", through: "2026-03-30" }}
        locale="en-US"
        messages={catalogs["en-US"]}
        onError={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Compare recovery periods" }));
    await screen.findByRole("region", { name: "Recovery period answer" });
    await user.click(screen.getByText("Change the compared recovery periods"));
    await user.click(screen.getByRole("button", { name: "Compare recovery periods" }));

    const unavailable = await screen.findByRole("region", {
      name: "Recovery comparison unavailable",
    });
    expect(screen.getByRole("region", { name: "Recovery period answer" })).toBeVisible();
    expect(screen.getByLabelText("Baseline period start")).toHaveValue("2026-03-28");
    await user.click(within(unavailable).getByRole("button", {
      name: "Try this recovery comparison again",
    }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(3));
    expect(screen.queryByRole("region", { name: "Recovery comparison unavailable" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Recovery period answer" })).toBeVisible();
  });

  it("keeps origins separate and gives each one a factual interval conclusion", async () => {
    mocks.invoke.mockResolvedValue({
      ...comparison,
      series: [
        comparison.series[0],
        {
          ...comparison.series[0],
          seriesRef: "source-b",
          baseline: summary({ averageBeatToBeatIntervalMilliseconds: "920" }),
          comparison: summary({ averageBeatToBeatIntervalMilliseconds: "900" }),
          averageBeatToBeatIntervalMillisecondsChange: "-20",
        },
      ],
    });
    const user = userEvent.setup();
    render(
      <RecoveryComparisonPanel
        availableRange={{ from: "2026-03-01", through: "2026-03-30" }}
        initialRange={{ from: "2026-03-28", through: "2026-03-30" }}
        locale="en-US"
        messages={catalogs["en-US"]}
        onError={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Compare recovery periods" }));

    const answer = await screen.findByRole("region", { name: "Recovery period answer" });
    expect(within(answer).getByRole("heading", { name: "2 recovery histories compared" }))
      .toBeVisible();
    expect(within(answer).getByRole("heading", {
      name: "Average recorded beat-to-beat interval was 25 ms longer",
    })).toBeVisible();
    expect(within(answer).getByRole("heading", {
      name: "Average recorded beat-to-beat interval was 20 ms shorter",
    })).toBeVisible();
  });

  it("states when neither period contains a recorded interval without inventing a value", async () => {
    mocks.invoke.mockResolvedValue({
      ...comparison,
      series: [{
        ...comparison.series[0],
        baseline: summary({
          observedNights: 0,
          missingNights: 3,
          averageBeatToBeatIntervalMilliseconds: null,
        }),
        comparison: summary({
          observedNights: 0,
          missingNights: 3,
          averageBeatToBeatIntervalMilliseconds: null,
        }),
        averageBeatToBeatIntervalMillisecondsChange: null,
      }],
    });
    const user = userEvent.setup();
    render(
      <RecoveryComparisonPanel
        availableRange={{ from: "2026-03-01", through: "2026-03-30" }}
        initialRange={{ from: "2026-03-28", through: "2026-03-30" }}
        locale="en-US"
        messages={catalogs["en-US"]}
        onError={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Compare recovery periods" }));

    const answer = await screen.findByRole("region", { name: "Recovery period answer" });
    expect(within(answer).getByRole("heading", {
      name: "Neither period contains recorded recovery intervals",
    })).toBeVisible();
    expect(within(answer).getByText(
      "0 recorded nights in baseline · 0 recorded nights in comparison",
    )).toBeVisible();
    expect(within(answer).queryByText("0 ms")).not.toBeInTheDocument();
  });
});
