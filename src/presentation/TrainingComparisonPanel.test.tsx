import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type { TrainingComparison } from "./training-insights";
import { TrainingComparisonPanel } from "./TrainingComparisonPanel";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

const result: TrainingComparison = {
  availableRange: { from: "2025-01-01", through: "2026-08-18" },
  baselineRange: { from: "2026-01-01", through: "2026-01-31" },
  comparisonRange: { from: "2026-07-01", through: "2026-07-31" },
  series: [],
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
      name: "Training period comparison",
    });

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
    const heading = await screen.findByRole("heading", {
      name: "Training period comparison",
    });
    await waitFor(() => expect(heading).toHaveFocus());
  });
});
