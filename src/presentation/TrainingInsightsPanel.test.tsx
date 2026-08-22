import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import { TrainingInsightsPanel } from "./TrainingInsightsPanel";

vi.mock("./TrainingSessionLibraryPanel", () => ({
  TrainingSessionLibraryPanel: (properties: {
    classificationChange?: {
      requestId: number;
      result: { overview: { sports: Array<{ classification: { displayLabel: string } }> } };
    };
    onSportClassificationChange: (result: unknown) => void;
  }) => (
    <section aria-label="Session child">
      <button
        type="button"
        onClick={() => properties.onSportClassificationChange({
          outcome: "changed",
          overview: {
            originCount: 1,
            sessionCount: 1,
            sports: [{ classification: { displayLabel: "River paddling" } }],
          },
        })}
      >
        Save in sessions
      </button>
      <output data-testid="session-change">
        {properties.classificationChange
          ? `${properties.classificationChange.requestId}:${properties.classificationChange.result.overview.sports[0].classification.displayLabel}`
          : "none"}
      </output>
    </section>
  ),
}));

vi.mock("./TrainingSportsPanel", () => ({
  TrainingSportsPanel: (properties: {
    classificationChange?: {
      requestId: number;
      result: { overview: { sports: Array<{ classification: { displayLabel: string } }> } };
    };
    onChange: (result: unknown) => void;
  }) => (
    <section aria-label="Sports child">
      <button
        type="button"
        onClick={() => properties.onChange({
          outcome: "changed",
          overview: {
            originCount: 1,
            sessionCount: 1,
            sports: [{ classification: { displayLabel: "Trail running" } }],
          },
        })}
      >
        Save in sports
      </button>
      <output data-testid="sports-change">
        {properties.classificationChange
          ? `${properties.classificationChange.requestId}:${properties.classificationChange.result.overview.sports[0].classification.displayLabel}`
          : "none"}
      </output>
    </section>
  ),
}));

vi.mock("./TrainingComparisonPanel", () => ({
  TrainingComparisonPanel: () => null,
}));

afterEach(cleanup);

describe("TrainingInsightsPanel", () => {
  it("broadcasts each classification to both workspaces and the application owner", async () => {
    const onSportClassificationChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TrainingInsightsPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        onCreateReport={vi.fn()}
        onError={vi.fn()}
        onSportClassificationChange={onSportClassificationChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save in sessions" }));
    expect(screen.getByTestId("session-change")).toHaveTextContent("1:River paddling");
    expect(screen.getByTestId("sports-change")).toHaveTextContent("1:River paddling");

    await user.click(screen.getByRole("button", { name: "Sports" }));
    await user.click(screen.getByRole("button", { name: "Save in sports" }));
    expect(screen.getByTestId("session-change")).toHaveTextContent("2:Trail running");
    expect(screen.getByTestId("sports-change")).toHaveTextContent("2:Trail running");
    expect(onSportClassificationChange).toHaveBeenCalledTimes(2);
  });
});
