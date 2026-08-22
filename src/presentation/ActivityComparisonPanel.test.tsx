import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import {
  ActivityComparisonPanel,
  latestEqualActivityPeriods,
} from "./ActivityComparisonPanel";
import type {
  ActivityComparison,
  ActivitySeriesSummary,
} from "./activity-insights";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

function summary(overrides: Partial<ActivitySeriesSummary> = {}): ActivitySeriesSummary {
  return {
    calendarDays: 2,
    observedDays: 2,
    availableStepDays: 2,
    unavailableStepDays: 0,
    missingDays: 0,
    totalStepCount: "2000",
    averageStepCount: "1000",
    ...overrides,
  };
}

function comparison(seriesCount = 1): ActivityComparison {
  return {
    availableRange: { from: "2026-01-01", through: "2026-01-04" },
    baselineRange: { from: "2026-01-01", through: "2026-01-02" },
    comparisonRange: { from: "2026-01-03", through: "2026-01-04" },
    series: Array.from({ length: seriesCount }, (_, index) => ({
      seriesRef: `opaque-origin-${index + 1}`,
      baseline: summary(),
      comparison: index === 0
        ? summary({ totalStepCount: "5000", averageStepCount: "2500" })
        : summary({
          observedDays: 0,
          availableStepDays: 0,
          missingDays: 2,
          totalStepCount: null,
          averageStepCount: null,
        }),
      totalStepChange: index === 0 ? "3000" : null,
      averageStepChange: index === 0 ? "1500" : null,
    })),
  };
}

afterEach(cleanup);

beforeEach(() => {
  mocks.invoke.mockReset();
});

describe("ActivityComparisonPanel", () => {
  it("chooses the latest adjacent equal periods without exceeding thirty days", () => {
    expect(latestEqualActivityPeriods({ from: "2026-01-01", through: "2026-04-30" }))
      .toEqual({
        baseline: { from: "2026-03-02", through: "2026-03-31" },
        comparison: { from: "2026-04-01", through: "2026-04-30" },
      });
    expect(latestEqualActivityPeriods({ from: "2026-01-01", through: "2026-01-05" }))
      .toEqual({
        baseline: { from: "2026-01-02", through: "2026-01-03" },
        comparison: { from: "2026-01-04", through: "2026-01-05" },
      });
    expect(latestEqualActivityPeriods({ from: "2026-01-01", through: "2026-01-01" }))
      .toBeNull();
  });

  it("keeps independent origins separate and reveals exact evidence deliberately", async () => {
    mocks.invoke.mockResolvedValue(comparison(2));
    const user = userEvent.setup();
    render(
      <ActivityComparisonPanel
        availableRange={{ from: "2026-01-01", through: "2026-01-04" }}
        initialRange={{ from: "2026-01-01", through: "2026-01-04" }}
        locale="en-US"
        messages={catalogs["en-US"]}
        onError={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Compare periods" }));
    const answer = await screen.findByRole("region", { name: "Daily activity answer" });
    expect(within(answer).getByRole("heading", {
      name: "Daily activity changed across 2 independent sources",
      level: 2,
    })).toBeVisible();
    expect(within(answer).getByRole("heading", {
      name: "Average daily steps were 1,500 higher",
      level: 3,
    })).toBeVisible();
    expect(within(answer).getByRole("heading", {
      name: "The periods do not have enough comparable step totals",
      level: 3,
    })).toBeVisible();
    expect(within(answer).getByText("Activity source 1")).toBeVisible();
    expect(within(answer).getByText("Activity source 2")).toBeVisible();
    const disclosures = within(answer).getAllByText("Review exact values");
    expect(disclosures).toHaveLength(2);
    expect(within(answer).getAllByRole("table", { name: "Period comparison" })[0])
      .not.toBeVisible();
    await user.click(disclosures[0]);
    expect(within(answer).getAllByRole("table", { name: "Period comparison" })[0])
      .toBeVisible();
  });

  it("explains why an automatic change answer needs more than one recorded day", async () => {
    render(
      <ActivityComparisonPanel
        availableRange={{ from: "2026-01-01", through: "2026-01-01" }}
        initialRange={{ from: "2026-01-01", through: "2026-01-01" }}
        locale="en-US"
        messages={catalogs["en-US"]}
        answerRequestId={1}
        onError={vi.fn()}
      />,
    );

    const explanation = await screen.findByRole("region", {
      name: "Daily activity change unavailable",
    });
    expect(explanation).toHaveTextContent("At least two calendar days are needed");
    expect(explanation).toHaveTextContent("Daily history is still available");
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Compare two periods" })).toBeVisible();
  });

  it("recovers a contextual automatic-answer failure without changing the selected periods", async () => {
    mocks.invoke.mockRejectedValueOnce(new Error("temporary failure"));
    mocks.invoke.mockResolvedValueOnce(comparison());
    const user = userEvent.setup();
    render(
      <ActivityComparisonPanel
        availableRange={{ from: "2026-01-01", through: "2026-01-04" }}
        initialRange={{ from: "2026-01-01", through: "2026-01-04" }}
        locale="en-US"
        messages={catalogs["en-US"]}
        answerRequestId={1}
        onError={vi.fn()}
      />,
    );

    const failure = await screen.findByRole("region", {
      name: "Daily activity comparison unavailable",
    });
    expect(failure).toHaveTextContent(
      "The comparison could not be loaded. Your recorded history did not change.",
    );
    await user.click(within(failure).getByRole("button", {
      name: "Try the comparison again",
    }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenLastCalledWith(
      "query_activity_comparison",
      {
        baselineRange: { from: "2026-01-01", through: "2026-01-02" },
        comparisonRange: { from: "2026-01-03", through: "2026-01-04" },
      },
    ));
    expect(await screen.findByRole("region", { name: "Daily activity answer" }))
      .toBeVisible();
    expect(screen.queryByRole("region", {
      name: "Daily activity comparison unavailable",
    })).not.toBeInTheDocument();
  });
});
