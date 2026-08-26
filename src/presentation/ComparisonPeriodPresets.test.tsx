import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComparisonPeriodPresets } from "./ComparisonPeriodPresets";

const messages = {
  heading: "Quick comparisons",
  week: "Week to date",
  month: "Month to date",
  year: "Year to date",
  currentHint: "Uses recorded dates through today and the matching part of the previous calendar period.",
  recordedHint: "Uses the latest recorded date, {date}, and the matching part of the preceding calendar period.",
  manualHint: "You can always edit the four dates below.",
  unavailable: "Not enough recorded history for this preset.",
};

afterEach(cleanup);

describe("ComparisonPeriodPresets", () => {
  it("selects a calendar preset and explains a latest-recorded anchor", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <ComparisonPeriodPresets
        availableRange={{ from: "2024-01-01", through: "2026-08-17" }}
        baselineRange={{ from: "2026-08-10", through: "2026-08-10" }}
        comparisonRange={{ from: "2026-08-17", through: "2026-08-17" }}
        locale="en-US"
        messages={messages}
        today="2026-08-26"
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole("group", { name: "Quick comparisons" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Week to date" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(
      "Uses the latest recorded date, Aug 17, 2026, and the matching part of the preceding calendar period.",
    )).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Month to date" }));
    expect(onSelect).toHaveBeenCalledWith({
      kind: "month",
      baseline: { from: "2026-07-01", through: "2026-07-17" },
      comparison: { from: "2026-08-01", through: "2026-08-17" },
      anchorDate: "2026-08-17",
      anchor: "latest-recorded",
    });
  });

  it("keeps manual dates explicit when no calendar preset has enough history", () => {
    render(
      <ComparisonPeriodPresets
        availableRange={{ from: "2026-08-23", through: "2026-08-26" }}
        baselineRange={{ from: "2026-08-23", through: "2026-08-24" }}
        comparisonRange={{ from: "2026-08-25", through: "2026-08-26" }}
        locale="en-US"
        messages={messages}
        today="2026-08-26"
        onSelect={vi.fn()}
      />,
    );

    for (const label of ["Week to date", "Month to date", "Year to date"]) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    }
    expect(screen.getByText("You can always edit the four dates below.")).toBeVisible();
  });

  it("marks no preset as selected after a manual boundary change", () => {
    render(
      <ComparisonPeriodPresets
        availableRange={{ from: "2025-01-01", through: "2026-08-26" }}
        baselineRange={{ from: "2026-07-01", through: "2026-07-12" }}
        comparisonRange={{ from: "2026-08-03", through: "2026-08-20" }}
        locale="en-US"
        messages={messages}
        today="2026-08-26"
        onSelect={vi.fn()}
      />,
    );

    screen.getAllByRole("button").forEach((button) => {
      expect(button).toHaveAttribute("aria-pressed", "false");
    });
    expect(screen.getByText("You can always edit the four dates below.")).toBeVisible();
  });
});
