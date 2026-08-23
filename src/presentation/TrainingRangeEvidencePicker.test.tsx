import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type { SessionStory } from "./session-story";
import type {
  TrainingSessionCurrentRangeCoordinate,
  TrainingSessionRangesResult,
} from "./training-session-range";
import { TrainingRangeEvidenceEditor } from "./TrainingRangeEvidenceEditor";
import { TrainingRangeEvidencePicker } from "./TrainingRangeEvidencePicker";
import { TrainingRangeInteractionProvider } from "./TrainingRangeInteractionProvider";

const commands = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: commands.invoke }));

const exerciseRef = `exercise-${"a".repeat(64)}`;
const signalRef = `signal-${"b".repeat(64)}`;
const snapshotRef = `training-snapshot-${"c".repeat(64)}`;
const sessionRef = `session-${"d".repeat(64)}`;
const evidenceRevision = `range-evidence-${"e".repeat(64)}`;
const signalCoordinate = { scope: "signal-elapsed" as const, signalRef };
const exerciseCoordinate = { scope: "exercise-elapsed" as const };

function rangeContext(): TrainingSessionRangesResult {
  return {
    snapshotRef,
    sessionRef,
    sessionDurationMilliseconds: "6000",
    evidenceRevision,
    exercises: [{
      exerciseRef,
      ordinal: 0,
      coordinates: [{
        coordinate: exerciseCoordinate,
        maximumElapsedMilliseconds: "6000",
      }, {
        coordinate: signalCoordinate,
        maximumElapsedMilliseconds: "5000",
      }],
    }],
    ranges: [],
  };
}

const story = {
  snapshotRef,
  exercises: [{
    exerciseRef,
    ordinal: 0,
    sport: null,
    primary: {
      exactRoute: null,
      exactSignals: [{
        signalRef,
        kind: "heart-rate",
        unit: "beats-per-minute",
        sampleCount: 3,
      }],
    },
    transition: { exactRoute: null, exactSignals: [] },
  }],
} as unknown as SessionStory;

function renderPicker(
  surface: "exact" | "structure",
  coordinate: TrainingSessionCurrentRangeCoordinate = signalCoordinate,
) {
  render(
    <TrainingRangeInteractionProvider
      sessionRef={sessionRef}
      snapshotRef={snapshotRef}
      story={story}
      locale="en-US"
      messages={catalogs["en-US"]}
      onError={vi.fn()}
    >
      <p data-testid="selected-evidence" tabIndex={-1}>Selected recorded evidence</p>
      <TrainingRangeEvidencePicker
        surface={surface}
        exerciseRef={exerciseRef}
        coordinate={coordinate}
        entries={surface === "exact" ? [{
          key: "sample-0",
          label: "Sample 1",
          startedAtElapsedMilliseconds: "0",
          endedAtElapsedMilliseconds: "0",
        }, {
          key: "sample-1",
          label: "Sample 2",
          startedAtElapsedMilliseconds: "1000",
          endedAtElapsedMilliseconds: "1000",
        }, {
          key: "sample-2",
          label: "Sample 3",
          startedAtElapsedMilliseconds: "2000",
          endedAtElapsedMilliseconds: "2000",
        }] : [{
          key: "source-lap-0",
          label: "Source lap 1",
          startedAtElapsedMilliseconds: "1000",
          endedAtElapsedMilliseconds: "4000",
        }]}
        selectedEntryKey={surface === "exact" ? "sample-1" : undefined}
        selectionLabel={surface === "exact" ? "Exact sample" : "Recorded interval"}
        meaning="Recorded evidence stays separate from the personal range."
        locale="en-US"
        messages={catalogs["en-US"]}
      />
      <TrainingRangeEvidenceEditor surface={surface} messages={catalogs["en-US"]} />
    </TrainingRangeInteractionProvider>,
  );
}

beforeEach(() => {
  commands.invoke.mockReset();
  commands.invoke.mockImplementation((command) => {
    if (command === "query_training_session_ranges") return Promise.resolve(rangeContext());
    if (command === "create_training_session_range") return Promise.resolve(rangeContext());
    throw new Error(`Unexpected command: ${command}`);
  });
});

afterEach(cleanup);

describe("TrainingRangeEvidencePicker", () => {
  it("opens one exact-coordinate draft and reuses point evidence for either boundary", async () => {
    const user = userEvent.setup();
    renderPicker("exact");

    const evidence = await screen.findByRole("combobox", { name: "Exact sample" });
    expect(evidence).toHaveValue("sample-1");
    screen.getByTestId("selected-evidence").focus();
    fireEvent.click(screen.getByRole("button", { name: "Create a personal range" }));

    const editorHeading = screen.getByRole("heading", { name: "Create a personal range" });
    await waitFor(() => expect(editorHeading).toHaveFocus());
    expect(screen.queryByRole("combobox", { name: "Timeline" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Start")).toHaveValue("0:00:01");
    expect(screen.getByLabelText("End")).toHaveValue("0:00:02");

    await user.selectOptions(evidence, "sample-0");
    await user.click(screen.getByRole("button", { name: "Use as range start" }));
    expect(screen.getByLabelText("Start")).toHaveValue("0:00:00");
    await user.selectOptions(evidence, "sample-2");
    await user.click(screen.getByRole("button", { name: "Use as range end" }));
    expect(screen.getByLabelText("End")).toHaveValue("0:00:02");
  });

  it("copies source-lap boundaries into a distinct unnamed personal draft", async () => {
    const user = userEvent.setup();
    renderPicker("structure", exerciseCoordinate);

    expect(await screen.findByText(
      "Recorded evidence stays separate from the personal range.",
    )).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Create a personal range" }));

    expect(screen.getByLabelText("Range name")).toHaveValue("");
    expect(screen.getByLabelText("Start")).toHaveValue("0:00:01");
    expect(screen.getByLabelText("End")).toHaveValue("0:00:04");
    await user.type(screen.getByLabelText("Range name"), "My first lap");
    await user.click(screen.getByRole("button", { name: "Save range" }));

    expect(commands.invoke).toHaveBeenCalledWith("create_training_session_range", {
      request: {
        sessionRef,
        snapshotRef,
        exerciseRef,
        coordinate: exerciseCoordinate,
        title: "My first lap",
        startedAtElapsedMilliseconds: "1000",
        endedAtElapsedMilliseconds: "4000",
      },
    });
  });
});
