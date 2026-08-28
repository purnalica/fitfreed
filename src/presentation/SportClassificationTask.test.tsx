import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import { SportClassificationTask } from "./SportClassificationTask";
import type {
  SavedTrainingSportClassification,
  TrainingSport,
  TrainingSportsOverview,
} from "./training-sports";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

const unknownSport: TrainingSport = {
  sessionFilterRef: `sport-${"b".repeat(64)}`,
  sportRef: `sport-${"a".repeat(64)}`,
  sourceIndex: 1,
  state: "unknown",
  classification: {
    scope: "unresolved-source-profile" as const,
    canonicalFamily: null,
    displayLabel: null,
    authorship: null,
    revision: 0,
  },
  recognition: null,
  recognitionCandidateCount: 0,
  firstLocalDate: "2025-01-01",
  lastLocalDate: "2026-08-18",
  coverage: {
    sessionCount: 4,
    totalDurationMilliseconds: "14400000",
    distanceSessionCount: 4,
    heartRateSessionCount: 3,
  },
};

function overview(sport: TrainingSport): TrainingSportsOverview {
  return { originCount: 1, sessionCount: 4, sports: [sport] };
}

afterEach(cleanup);

beforeEach(() => {
  mocks.invoke.mockReset();
});

describe("SportClassificationTask", () => {
  it("keeps the semantic field and action order available to keyboard navigation", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <SportClassificationTask
        editorId="keyboard-sport"
        sport={unknownSport}
        title="Unknown sport 1"
        messages={catalogs["en-US"].training.sports}
        onCancel={onCancel}
        onError={vi.fn()}
        onOverviewChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    const family = screen.getByLabelText("Broad sport family");
    const label = screen.getByLabelText("Your sport name");
    const cancel = screen.getByRole("button", { name: "Cancel editing" });
    family.focus();
    expect(family).toHaveFocus();
    await user.tab();
    expect(label).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("preserves the authored draft when a conflict reloads newer evidence and retries its revision", async () => {
    const concurrentSport: TrainingSport = {
      ...unknownSport,
      state: "personally-overridden",
      classification: {
        scope: "unresolved-source-profile" as const,
        canonicalFamily: "running",
        displayLabel: "Concurrent running",
        authorship: "user",
        revision: 1,
      },
    };
    const savedSport: TrainingSport = {
      ...concurrentSport,
      classification: {
        scope: "unresolved-source-profile" as const,
        canonicalFamily: "water-sport",
        displayLabel: "River paddling",
        authorship: "user",
        revision: 2,
      },
    };
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_training_sports") {
        return Promise.resolve(overview(concurrentSport));
      }
      if (command === "save_training_sport_classification") {
        const expectedRevision = arguments_.request.expectedRevision;
        return expectedRevision === 0
          ? Promise.reject({ code: "sport-classification-conflict" })
          : Promise.resolve(({
              outcome: "changed",
              overview: overview(savedSport),
            }) satisfies SavedTrainingSportClassification);
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const onSaved = vi.fn();
    const onError = vi.fn();

    function Harness() {
      const [sport, setSport] = useState(unknownSport);
      return (
        <SportClassificationTask
          editorId="test-sport"
          sport={sport}
          title={sport.classification?.displayLabel ?? "Unknown sport 1"}
          messages={catalogs["en-US"].training.sports}
          onCancel={vi.fn()}
          onError={onError}
          onOverviewChange={(nextOverview) => setSport(nextOverview.sports[0])}
          onSaved={onSaved}
        />
      );
    }

    const user = userEvent.setup();
    render(<Harness />);
    await user.selectOptions(screen.getByLabelText("Broad sport family"), "water-sport");
    await user.type(screen.getByLabelText("Your sport name"), "River paddling");
    await user.click(screen.getByRole("button", { name: "Save sport classification" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The saved identity changed elsewhere. Your edits are still here.",
    );
    expect(screen.getByLabelText("Your sport name")).toHaveValue("River paddling");
    expect(screen.getByLabelText("Broad sport family")).toHaveValue("water-sport");
    expect(screen.getByText("Current saved identity: Concurrent running")).toBeVisible();
    expect(onError).toHaveBeenCalledWith("sport-classification-conflict");

    await user.click(screen.getByRole("button", { name: "Save sport classification" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenLastCalledWith(
      "save_training_sport_classification",
      {
        request: {
          sportRef: unknownSport.sportRef,
          expectedRevision: 1,
          canonicalFamily: "water-sport",
          displayLabel: "River paddling",
        },
      },
    ));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ outcome: "changed" }));
  });
});
