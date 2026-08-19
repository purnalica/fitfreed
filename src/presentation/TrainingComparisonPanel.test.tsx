import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
