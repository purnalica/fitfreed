import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type { TrainingComparison } from "./training-insights";
import { TrainingComparisonPanel } from "./TrainingComparisonPanel";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

const summary = {
  calendarDays: 7,
  trainingDays: 2,
  sessionCount: 2,
  totalDurationMilliseconds: "5400000",
  distanceSessionCount: 0,
  totalDistanceMeters: null,
  energySessionCount: 0,
  totalEnergyKilocalories: null,
  heartRateSessionCount: 1,
};

const result: TrainingComparison = {
  availableRange: { from: "2025-01-01", through: "2026-08-18" },
  baselineRange: { from: "2026-01-01", through: "2026-01-31" },
  comparisonRange: { from: "2026-07-01", through: "2026-07-31" },
  series: [{
    seriesRef: "source-a",
    baseline: summary,
    comparison: {
      ...summary,
      trainingDays: 3,
      sessionCount: 4,
      totalDurationMilliseconds: "10800000",
      distanceSessionCount: 4,
      totalDistanceMeters: 42000,
    },
    sessionCountChange: "2",
    trainingDayChange: "1",
    durationMillisecondsChange: "5400000",
    distanceMetersChange: null,
    energyKilocaloriesChange: null,
  }],
};

afterEach(cleanup);

beforeEach(() => {
  mocks.invoke.mockReset();
});

describe("TrainingComparisonPanel", () => {
  it("announces pending work without renaming the action or hiding the previous result", async () => {
    let resolveComparison!: (value: TrainingComparison) => void;
    mocks.invoke
      .mockResolvedValueOnce(result)
      .mockImplementationOnce(() => new Promise<TrainingComparison>((resolve) => {
        resolveComparison = resolve;
      }));
    const user = userEvent.setup();
    render(
      <TrainingComparisonPanel
        availableRange={{ from: "2025-01-01", through: "2026-08-18" }}
        initialRange={{ from: "2026-07-20", through: "2026-08-18" }}
        locale="en-US"
        messages={catalogs["en-US"]}
        onCreateReport={vi.fn()}
        onError={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Compare periods" }));
    const resultHeading = await screen.findByRole("heading", {
      name: "Recorded training time was 1 h 30 min longer",
    });

    await user.click(screen.getByText("Change periods"));
    await user.click(screen.getByRole("button", { name: "Compare periods" }));

    const form = screen.getByRole("form", { name: "Compare training periods" });
    expect(form).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Compare periods" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Comparing periods…");
    expect(resultHeading).toBeVisible();

    act(() => resolveComparison(result));
    await waitFor(() => expect(form).toHaveAttribute("aria-busy", "false"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("associates an invalid comparison with every period input", async () => {
    const onError = vi.fn();
    const user = userEvent.setup();
    render(
      <TrainingComparisonPanel
        availableRange={{ from: "2025-01-01", through: "2026-08-18" }}
        initialRange={{ from: "2026-07-20", through: "2026-08-18" }}
        locale="en-US"
        messages={catalogs["en-US"]}
        onCreateReport={vi.fn()}
        onError={onError}
      />,
    );

    const baselineFrom = screen.getByLabelText("Baseline period start");
    await user.clear(baselineFrom);
    await user.type(baselineFrom, "2026-08-18");
    const baselineThrough = screen.getByLabelText("Baseline period end");
    await user.clear(baselineThrough);
    await user.type(baselineThrough, "2026-07-20");
    await user.click(screen.getByRole("button", { name: "Compare periods" }));

    expect(onError).toHaveBeenLastCalledWith("invalid-training-comparison");
    expect(mocks.invoke).not.toHaveBeenCalled();
    for (const label of [
      "Baseline period start",
      "Baseline period end",
      "Comparison period start",
      "Comparison period end",
    ]) {
      const input = screen.getByLabelText(label);
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAttribute("aria-describedby", "application-error");
    }
  });

  it("runs and focuses the exact comparison reached from a report", async () => {
    mocks.invoke.mockResolvedValue(result);

    render(
      <TrainingComparisonPanel
        availableRange={{ from: "2025-01-01", through: "2026-08-18" }}
        initialRange={{ from: "2026-07-20", through: "2026-08-18" }}
        initialQuery={{
          question: "training-period-comparison",
          questionVersion: 1,
          baselineRange: { from: "2026-01-01", through: "2026-01-31" },
          comparisonRange: { from: "2026-07-01", through: "2026-07-31" },
        }}
        navigationRequestId={4}
        locale="en-US"
        messages={catalogs["en-US"]}
        onCreateReport={vi.fn()}
        onError={vi.fn()}
      />,
    );

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "query_training_comparison",
      {
        baselineRange: { from: "2026-01-01", through: "2026-01-31" },
        comparisonRange: { from: "2026-07-01", through: "2026-07-31" },
      },
    ));
    expect(screen.getByLabelText("Baseline period start")).toHaveValue("2026-01-01");
    expect(screen.getByLabelText("Comparison period end")).toHaveValue("2026-07-31");
    const answer = await screen.findByRole("region", {
      name: "Training period answer",
    });
    const heading = within(answer).getByRole("heading", {
      name: "Recorded training time was 1 h 30 min longer",
    });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText("Change periods").closest("details")).not.toHaveAttribute("open");
    expect(within(answer).getByText("Review exact values").closest("details"))
      .not.toHaveAttribute("open");
    expect(within(answer).getByRole("table", { name: "Training period comparison" }))
      .not.toBeVisible();
  });

  it("leads with the answer while preserving optional-measurement evidence and report creation", async () => {
    const onCreateReport = vi.fn();
    mocks.invoke.mockResolvedValue(result);
    const user = userEvent.setup();

    render(
      <TrainingComparisonPanel
        availableRange={{ from: "2025-01-01", through: "2026-08-18" }}
        initialRange={{ from: "2026-07-20", through: "2026-08-18" }}
        initialQuery={{
          question: "training-period-comparison",
          questionVersion: 1,
          baselineRange: { from: "2026-01-01", through: "2026-01-31" },
          comparisonRange: { from: "2026-07-01", through: "2026-07-31" },
        }}
        navigationRequestId={7}
        locale="en-US"
        messages={catalogs["en-US"]}
        onCreateReport={onCreateReport}
        onError={vi.fn()}
      />,
    );

    const answer = await screen.findByRole("region", { name: "Training period answer" });
    expect(within(answer).getByText("2 sessions in baseline · 4 sessions in comparison"))
      .toBeVisible();
    expect(within(answer).getByText(
      "Distance or energy is not recorded for every session; exact coverage is available below.",
    )).toBeVisible();
    for (const value of within(answer).getAllByText("Not available")) {
      expect(value).not.toBeVisible();
    }

    await user.click(within(answer).getByText("Review exact values"));
    expect(within(answer).getAllByText("Not available").length).toBeGreaterThan(0);
    expect(within(answer).getByText("42,000 m")).toBeVisible();

    await user.click(within(answer).getByRole("button", {
      name: "Turn this comparison into a report",
    }));
    expect(onCreateReport).toHaveBeenCalledWith({
      question: "training-period-comparison",
      questionVersion: 1,
      baselineRange: { from: "2026-01-01", through: "2026-01-31" },
      comparisonRange: { from: "2026-07-01", through: "2026-07-31" },
    });
  });

  it("keeps source histories separate and states their different duration changes", async () => {
    mocks.invoke.mockResolvedValue({
      ...result,
      series: [
        result.series[0],
        {
          seriesRef: "source-b",
          baseline: { ...summary, sessionCount: 1, totalDurationMilliseconds: "7200000" },
          comparison: { ...summary, sessionCount: 1, totalDurationMilliseconds: "3600000" },
          sessionCountChange: "0",
          trainingDayChange: "0",
          durationMillisecondsChange: "-3600000",
          distanceMetersChange: null,
          energyKilocaloriesChange: null,
        },
      ],
    } satisfies TrainingComparison);

    render(
      <TrainingComparisonPanel
        availableRange={{ from: "2025-01-01", through: "2026-08-18" }}
        initialRange={{ from: "2026-07-20", through: "2026-08-18" }}
        initialQuery={{
          question: "training-period-comparison",
          questionVersion: 1,
          baselineRange: { from: "2026-01-01", through: "2026-01-31" },
          comparisonRange: { from: "2026-07-01", through: "2026-07-31" },
        }}
        navigationRequestId={8}
        locale="en-US"
        messages={catalogs["en-US"]}
        onCreateReport={vi.fn()}
        onError={vi.fn()}
      />,
    );

    const answer = await screen.findByRole("region", { name: "Training period answer" });
    expect(within(answer).getByRole("heading", { name: "2 source histories compared" }))
      .toBeVisible();
    expect(within(answer).getByRole("heading", {
      name: "Recorded training time was 1 h 30 min longer",
    })).toBeVisible();
    expect(within(answer).getByRole("heading", {
      name: "Recorded training time was 1 h shorter",
    })).toBeVisible();
    expect(within(answer).getAllByText("Training origin", { exact: false })).toHaveLength(2);
    expect(within(answer).getByText(
      "These sessions contain no recorded distance or energy.",
    )).toBeVisible();
    expect(within(answer).getAllByText("Review exact values")).toHaveLength(2);
  });

  it("keeps the exact periods available when a direct comparison fails and retries locally", async () => {
    mocks.invoke.mockRejectedValueOnce(new Error("library unavailable")).mockResolvedValueOnce(result);
    const user = userEvent.setup();

    render(
      <TrainingComparisonPanel
        availableRange={{ from: "2025-01-01", through: "2026-08-18" }}
        initialRange={{ from: "2026-07-20", through: "2026-08-18" }}
        initialQuery={{
          question: "training-period-comparison",
          questionVersion: 1,
          baselineRange: { from: "2026-01-01", through: "2026-01-31" },
          comparisonRange: { from: "2026-07-01", through: "2026-07-31" },
        }}
        navigationRequestId={9}
        locale="en-US"
        messages={catalogs["en-US"]}
        onCreateReport={vi.fn()}
        onError={vi.fn()}
      />,
    );

    const unavailable = await screen.findByRole("region", {
      name: "Training comparison unavailable",
    });
    expect(unavailable).toHaveTextContent(
      "The selected periods and any previous answer are unchanged.",
    );
    await user.click(within(unavailable).getByRole("button", {
      name: "Try this comparison again",
    }));

    expect(await screen.findByRole("region", { name: "Training period answer" }))
      .toBeVisible();
    expect(mocks.invoke).toHaveBeenLastCalledWith("query_training_comparison", {
      baselineRange: { from: "2026-01-01", through: "2026-01-31" },
      comparisonRange: { from: "2026-07-01", through: "2026-07-31" },
    });
  });

  it("removes a failed-query notice when the user changes its periods", async () => {
    mocks.invoke.mockRejectedValue(new Error("library unavailable"));
    const user = userEvent.setup();

    render(
      <TrainingComparisonPanel
        availableRange={{ from: "2025-01-01", through: "2026-08-18" }}
        initialRange={{ from: "2026-07-20", through: "2026-08-18" }}
        initialQuery={{
          question: "training-period-comparison",
          questionVersion: 1,
          baselineRange: { from: "2026-01-01", through: "2026-01-31" },
          comparisonRange: { from: "2026-07-01", through: "2026-07-31" },
        }}
        navigationRequestId={10}
        locale="en-US"
        messages={catalogs["en-US"]}
        onCreateReport={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(await screen.findByRole("region", {
      name: "Training comparison unavailable",
    })).toBeVisible();
    await user.click(screen.getByText("Compare training periods", { selector: "summary" }));
    await user.clear(screen.getByLabelText("Baseline period start"));
    await user.type(screen.getByLabelText("Baseline period start"), "2026-02-01");

    expect(screen.queryByRole("region", {
      name: "Training comparison unavailable",
    })).not.toBeInTheDocument();
  });
});
