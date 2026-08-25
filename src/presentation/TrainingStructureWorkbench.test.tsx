import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type { SessionStory } from "./session-story";
import type { TrainingSessionRangesResult } from "./training-session-range";
import { TrainingRangeInteractionProvider } from "./TrainingRangeInteractionProvider";
import { TrainingStructureWorkbench } from "./TrainingStructureWorkbench";

const commands = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: commands.invoke }));

const exerciseRef = `exercise-${"a".repeat(64)}`;
const sessionRef = `session-${"b".repeat(64)}`;
const snapshotRef = `training-snapshot-${"c".repeat(64)}`;
const evidenceRevision = `range-evidence-${"d".repeat(64)}`;

function structureStory(): SessionStory {
  const structure = {
    exerciseRef,
    ordinal: 0,
    startedAtLocal: "2026-08-23T06:00:00",
    stoppedAtLocal: "2026-08-23T06:10:00",
    utcOffsetMinutes: 120,
    durationMilliseconds: "600000",
    distanceMeters: 2000,
    energyKilocalories: null,
    sport: {
      sportRef: `sport-${"e".repeat(64)}`,
      state: "personally-overridden" as const,
      classification: {
        canonicalFamily: "running" as const,
        displayLabel: "Intervals",
        authorship: "user" as const,
        revision: 1,
      },
    },
    manualLaps: [{
      lapRef: `lap-${"f".repeat(64)}`,
      ordinal: 0,
      splitTimeMilliseconds: "60000",
      durationMilliseconds: "180000",
      distanceMeters: 700,
    }],
    automaticLaps: [{
      lapRef: `lap-${"1".repeat(64)}`,
      ordinal: 0,
      splitTimeMilliseconds: "300000",
      durationMilliseconds: "120000",
      distanceMeters: 500,
    }],
    pauses: [],
  };
  return {
    snapshotRef,
    session: { sessionRef, durationMilliseconds: structure.durationMilliseconds },
    exercises: [{
      exerciseRef,
      ordinal: 0,
      sport: structure.sport,
      structure,
      primary: { exactRoute: null, exactSignals: [] },
      transition: { exactRoute: null, exactSignals: [] },
    }],
  } as unknown as SessionStory;
}

function context(): TrainingSessionRangesResult {
  return {
    snapshotRef,
    sessionRef,
    sessionDurationMilliseconds: "600000",
    evidenceRevision,
    exercises: [{
      exerciseRef,
      ordinal: 0,
      coordinates: [{
        coordinate: { scope: "exercise-elapsed" },
        maximumElapsedMilliseconds: "600000",
      }],
    }],
    ranges: [],
  };
}

beforeEach(() => {
  commands.invoke.mockReset();
  commands.invoke.mockImplementation((command) => {
    if (command === "query_training_session_ranges") return Promise.resolve(context());
    if (command === "create_training_session_range") return Promise.resolve(context());
    throw new Error(`Unexpected command: ${command}`);
  });
});

afterEach(cleanup);

describe("TrainingStructureWorkbench", () => {
  it("presents overview distance at a human scale", () => {
    render(
      <TrainingStructureWorkbench
        story={structureStory()}
        locale="en-US"
        messages={catalogs["en-US"]}
        exerciseLabel={() => "Intervals"}
        onOpenStructure={vi.fn()}
      />,
    );

    expect(screen.getByText("2 km")).toBeVisible();
    expect(screen.queryByText("2000 m")).not.toBeInTheDocument();
  });

  it("starts a distinct personal range from exact source-lap boundaries", async () => {
    const story = structureStory();
    const user = userEvent.setup();
    render(
      <TrainingRangeInteractionProvider
        sessionRef={sessionRef}
        snapshotRef={snapshotRef}
        story={story}
        locale="en-US"
        messages={catalogs["en-US"]}
        onError={vi.fn()}
      >
        <TrainingStructureWorkbench
          story={story}
          locale="en-US"
          messages={catalogs["en-US"]}
          exerciseLabel={() => "Intervals"}
          onOpenStructure={vi.fn()}
        />
      </TrainingRangeInteractionProvider>,
    );

    const interval = await screen.findByRole("combobox", { name: "Recorded interval" });
    expect(interval).toHaveDisplayValue("Complete exercise");
    expect(screen.getByRole("option", { name: "Source lap 1" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Automatic lap 1" })).toBeVisible();
    await user.selectOptions(interval, "source-lap-0");
    await user.click(screen.getByRole("button", { name: "Create a personal range" }));

    expect(screen.getByLabelText("Start")).toHaveValue("0:01:00");
    expect(screen.getByLabelText("End")).toHaveValue("0:04:00");
    expect(document.querySelectorAll(".training-structure-personal-range")).toHaveLength(1);
    expect(document.querySelectorAll(".training-structure-workbench-source i")).toHaveLength(1);
    expect(screen.getByText(
      "The recorded interval stays attributed source evidence; the personal range is a separate object.",
    )).toBeVisible();
  });
});
