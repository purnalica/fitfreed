import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type { SessionStory } from "./session-story";
import type {
  TrainingSessionRange,
  TrainingSessionRangesResult,
  TrainingSessionRangeSummary,
} from "./training-session-range";
import { TrainingRangeInteractionProvider } from "./TrainingRangeInteractionProvider";
import { TrainingRangesPanel } from "./TrainingRangesPanel";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

const snapshotRef = `training-snapshot-${"a".repeat(64)}`;
const sessionRef = `session-${"b".repeat(64)}`;
const exerciseRef = `exercise-${"c".repeat(64)}`;
const routeRef = `route-${"d".repeat(64)}`;
const routeCoordinateKey = `route-elapsed:${routeRef}`;
const signalRef = `signal-${"e".repeat(64)}`;
const evidenceRevision = `range-evidence-${"f".repeat(64)}`;
const firstRangeRef = `range-${"1".repeat(64)}`;
const secondRangeRef = `range-${"2".repeat(64)}`;
const sourceRangeRef = `lap-${"4".repeat(64)}`;

function range(overrides: Partial<TrainingSessionRange> = {}): TrainingSessionRange {
  return {
    rangeRef: firstRangeRef,
    exerciseRef,
    coordinate: { scope: "route-elapsed", routeRef },
    title: "Bridge effort",
    startedAtElapsedMilliseconds: "60000",
    endedAtElapsedMilliseconds: "180000",
    evidenceRevision,
    authorship: "user",
    state: "current",
    revision: 2,
    ...overrides,
  };
}

function result(ranges: TrainingSessionRange[] = []): TrainingSessionRangesResult {
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
      }, {
        coordinate: { scope: "route-elapsed", routeRef },
        maximumElapsedMilliseconds: "540000",
      }, {
        coordinate: { scope: "signal-elapsed", signalRef },
        maximumElapsedMilliseconds: "599000",
      }],
    }],
    ranges,
  };
}

const story = {
  exercises: [{
    exerciseRef,
    ordinal: 0,
    sport: {
      sportRef: `sport-${"3".repeat(64)}`,
      state: "classified",
      classification: {
        canonicalFamily: "running",
        displayLabel: "Canal run",
        authorship: "user",
        revision: 1,
      },
    },
    primary: {
      exactRoute: { routeRef, pointCount: 20 },
      exactSignals: [{
        signalRef,
        kind: "heart-rate",
        unit: "beats-per-minute",
        sampleCount: 600,
      }],
    },
    transition: { exactRoute: null, exactSignals: [] },
  }],
} as unknown as SessionStory;

function summary(selectedRange = range()): TrainingSessionRangeSummary {
  return {
    snapshotRef,
    sessionRef,
    evidenceRevision,
    sourceProvider: "polar-flow",
    range: selectedRange,
    exercise: {
      exerciseRef,
      ordinal: 0,
      durationMilliseconds: "600000",
      distanceMeters: 2100,
      sport: story.exercises[0].sport!,
    },
    coordinateEvidence: { scope: "route-elapsed", routeRef, kind: "primary" },
    elapsedDurationMilliseconds: "120000",
    movingDurationMilliseconds: null,
    pausedDurationMilliseconds: null,
    distance: { meters: 820.4, coverage: "complete" },
    direction: { initialBearingDegrees: 45.4, cardinal: "north-east" },
    measurements: [{
      kind: "altitude",
      unit: "meters",
      minimum: 41,
      maximum: 57,
      average: 49.25,
      availableEvidenceCount: 8,
      missingEvidenceCount: 1,
      startBoundaryValue: 42,
      endBoundaryValue: 55,
    }, {
      kind: "speed",
      unit: "kilometers-per-hour",
      minimum: 8.2,
      maximum: 8.2,
      average: 8.2,
      availableEvidenceCount: 1,
      missingEvidenceCount: 0,
      startBoundaryValue: 8.2,
      endBoundaryValue: null,
    }],
    boundaries: {
      start: {
        elapsedMilliseconds: "60000",
        state: "exact",
        exactMatchCount: 1,
        exactMatches: [],
        preceding: null,
        following: null,
      },
      end: {
        elapsedMilliseconds: "180000",
        state: "between-evidence",
        exactMatchCount: 0,
        exactMatches: [],
        preceding: null,
        following: null,
      },
    },
    coverage: {
      state: "partial",
      recordedEvidenceCount: 20,
      selectedEvidenceCount: 9,
      availableEvidenceCount: 8,
      missingEvidenceCount: 1,
      missingElapsedEvidenceCount: 0,
      missingIntervals: [{
        startedAtElapsedMilliseconds: "119000",
        endedAtElapsedMilliseconds: "120000",
      }],
      omittedMissingIntervalCount: 0,
    },
    sourceRanges: [{
      sourceRangeRef,
      kind: "manual-lap",
      ordinal: 0,
      startedAtElapsedMilliseconds: "0",
      endedAtElapsedMilliseconds: "300000",
      distanceMeters: 1200,
      relation: "source-contains-range",
    }],
    independentEvidence: {
      sourceRangeCount: 2,
      routeCoordinateCount: 1,
      signalCoordinateCount: 1,
    },
    limitations: ["boundary-not-exact", "moving-time-unavailable"],
  };
}

function renderPanel(
  onError = vi.fn(),
  locale: "en-US" | "es-ES" = "en-US",
) {
  return {
    onError,
    ...render(
      <TrainingRangeInteractionProvider
        sessionRef={sessionRef}
        snapshotRef={snapshotRef}
        story={story}
        locale={locale}
        messages={catalogs[locale]}
        onError={onError}
      >
        <TrainingRangesPanel
          locale={locale}
          messages={catalogs[locale]}
        />
      </TrainingRangeInteractionProvider>,
    ),
  };
}

afterEach(cleanup);

beforeEach(() => {
  mocks.invoke.mockReset();
});

describe("TrainingRangesPanel", () => {
  it("creates a range from real exact inputs and rejects invalid or outside bounds", async () => {
    const empty = result();
    const savedRange = range({ title: "Canal bridge", startedAtElapsedMilliseconds: "30000" });
    const saved = result([savedRange]);
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_training_session_ranges") return Promise.resolve(empty);
      if (command === "create_training_session_range") return Promise.resolve(saved);
      if (command === "query_training_session_range_summary") {
        return Promise.resolve(summary(savedRange));
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
    const user = userEvent.setup();

    renderPanel();
    expect(await screen.findByText("No personal ranges yet.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Create a range" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("No personal ranges yet.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Create a range" }));
    expect(screen.getByLabelText("Exercise")).toHaveDisplayValue("Canal run · exercise 1");
    await user.selectOptions(screen.getByLabelText("Timeline"), routeCoordinateKey);
    await user.type(screen.getByLabelText("Range name"), "Canal bridge");
    await user.clear(screen.getByLabelText("Start"));
    await user.type(screen.getByLabelText("Start"), "0:00:30");
    await user.clear(screen.getByLabelText("End"));
    await user.type(screen.getByLabelText("End"), "0:00:30");
    expect(screen.getByRole("button", { name: "Save range" })).toBeDisabled();
    await user.clear(screen.getByLabelText("End"));
    await user.type(screen.getByLabelText("End"), "0:00:29");
    expect(screen.getByRole("button", { name: "Save range" })).toBeDisabled();
    await user.clear(screen.getByLabelText("End"));
    await user.type(screen.getByLabelText("End"), "0:09:00.001");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Use a name and ordered times inside the selected timeline.",
    );
    expect(screen.getByRole("button", { name: "Save range" })).toBeDisabled();
    await user.clear(screen.getByLabelText("End"));
    await user.type(screen.getByLabelText("End"), "0:03:00");
    await user.click(screen.getByRole("button", { name: "Save range" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "create_training_session_range",
      { request: {
        sessionRef,
        snapshotRef,
        exerciseRef,
        coordinate: { scope: "route-elapsed", routeRef },
        title: "Canal bridge",
        startedAtElapsedMilliseconds: "30000",
        endedAtElapsedMilliseconds: "180000",
      } },
    ));
    expect(await screen.findByRole("heading", { name: "Canal bridge" })).toBeVisible();
    expect(screen.getByText("Range saved.")).toBeVisible();
    expect(document.body).not.toHaveTextContent(routeRef);
    expect(document.body).not.toHaveTextContent(exerciseRef);
  });

  it("opens a concise result first and reveals exact evidence only on request", async () => {
    const current = range();
    const review = range({
      rangeRef: secondRangeRef,
      title: "Old finish",
      state: "review-required",
      revision: 4,
    });
    mocks.invoke.mockImplementation((command, input) => {
      if (command === "query_training_session_ranges") return Promise.resolve(result([current, review]));
      if (command === "query_training_session_range_summary") {
        const selected = input.query.rangeRef === firstRangeRef ? current : review;
        return Promise.resolve(summary(selected));
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
    const user = userEvent.setup();

    renderPanel();

    const heading = await screen.findByRole("heading", { name: "Bridge effort" });
    heading.scrollIntoView = vi.fn();
    expect(heading).toBeVisible();
    expect(mocks.invoke).toHaveBeenCalledWith("query_training_session_range_summary", {
      query: { sessionRef, snapshotRef, rangeRef: firstRangeRef, expectedRangeRevision: 2 },
    });
    expect(await screen.findByText("2 min")).toBeVisible();
    expect(screen.getByText("820 m")).toBeVisible();
    expect(screen.getByText("Northeast · 45°")).toBeVisible();
    expect(screen.getByText("49 m")).toBeVisible();
    expect(screen.getByText("Partial recorded coverage")).toBeVisible();
    expect(screen.getByText("Source lap 1")).not.toBeVisible();
    await user.click(screen.getByText("Evidence and limits"));
    expect(screen.getByText("Source lap 1")).toBeVisible();
    expect(screen.getByText("Recorded evidence inside the range: 8 of 9.")).toBeVisible();
    expect(screen.getByText("No recorded evidence from 0:01:59 to 0:02:00.")).toBeVisible();
    expect(screen.getByText(
      "contains this range · 0:00:00–0:05:00 · source distance 1.2 km",
    )).toBeVisible();
    expect(screen.getByText("The end is between recorded evidence points.")).toBeVisible();
    expect(screen.getByText("8 recorded values; 1 missing value.")).toBeVisible();
    expect(screen.getByText("1 recorded value; 0 missing values.")).toBeVisible();
    expect(screen.getByText("Moving time cannot be calculated from this evidence.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Open Old finish" }));
    const reopenedHeading = await screen.findByRole("heading", { name: "Old finish" });
    expect(reopenedHeading).toBeVisible();
    expect(reopenedHeading).toHaveClass("training-result-focus-target");
    await waitFor(() => expect(reopenedHeading).toHaveFocus());
    expect(reopenedHeading.scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      inline: "nearest",
    });
    expect(screen.getByText("Review this saved range")).toBeVisible();
    expect(document.body).not.toHaveTextContent("range-");
    expect(document.body).not.toHaveTextContent("route-");
  });

  it("distinguishes duplicate titles and overlapping ranges by their exact boundaries", async () => {
    const first = range({ title: "Repeated effort" });
    const second = range({
      rangeRef: secondRangeRef,
      title: "Repeated effort",
      startedAtElapsedMilliseconds: "120000",
      endedAtElapsedMilliseconds: "240000",
      revision: 1,
    });
    mocks.invoke.mockImplementation((command, input) => {
      if (command === "query_training_session_ranges") {
        return Promise.resolve(result([first, second]));
      }
      if (command === "query_training_session_range_summary") {
        return Promise.resolve(summary(
          input.query.rangeRef === firstRangeRef ? first : second,
        ));
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
    const user = userEvent.setup();

    renderPanel();

    const firstChoice = await screen.findByRole("button", {
      name: "Open Repeated effort, 0:01:00 to 0:03:00",
    });
    const secondChoice = screen.getByRole("button", {
      name: "Open Repeated effort, 0:02:00 to 0:04:00",
    });
    expect(within(firstChoice).getByText("0:01:00–0:03:00")).toBeVisible();
    expect(within(secondChoice).getByText("0:02:00–0:04:00")).toBeVisible();

    await user.click(secondChoice);

    expect(secondChoice).toHaveAttribute("aria-current", "page");
    await waitFor(() => expect(mocks.invoke).toHaveBeenLastCalledWith(
      "query_training_session_range_summary",
      {
        query: {
          sessionRef,
          snapshotRef,
          rangeRef: secondRangeRef,
          expectedRangeRevision: 1,
        },
      },
    ));
  });

  it("renames and adjusts an established range without offering silent reassignment", async () => {
    let current = range();
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_training_session_ranges") return Promise.resolve(result([current]));
      if (command === "query_training_session_range_summary") return Promise.resolve(summary(current));
      if (command === "rename_training_session_range") {
        current = { ...current, title: "Bridge to lock", revision: 3 };
        return Promise.resolve(result([current]));
      }
      if (command === "adjust_training_session_range") {
        current = {
          ...current,
          startedAtElapsedMilliseconds: "90000",
          endedAtElapsedMilliseconds: "210000",
          revision: 4,
        };
        return Promise.resolve(result([current]));
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
    const user = userEvent.setup();

    renderPanel();
    await screen.findByRole("heading", { name: "Bridge effort" });
    await user.click(screen.getByRole("button", { name: "Rename" }));
    const name = screen.getByLabelText("Range name");
    await user.clear(name);
    await user.type(name, "Bridge to lock");
    await user.click(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "rename_training_session_range",
      { request: {
        sessionRef,
        snapshotRef,
        rangeRef: firstRangeRef,
        expectedRevision: 2,
        title: "Bridge to lock",
      } },
    ));

    await user.click(screen.getByRole("button", { name: "Adjust boundaries" }));
    expect(screen.queryByRole("combobox", { name: "Exercise" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("form", { name: "Adjust this range" }))
      .getByText("Primary route timeline")).toBeVisible();
    await user.clear(screen.getByLabelText("Start"));
    await user.type(screen.getByLabelText("Start"), "0:01:30");
    await user.clear(screen.getByLabelText("End"));
    await user.type(screen.getByLabelText("End"), "0:03:30");
    await user.click(screen.getByRole("button", { name: "Save boundaries" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "adjust_training_session_range",
      { request: {
        sessionRef,
        snapshotRef,
        rangeRef: firstRangeRef,
        expectedRevision: 3,
        exerciseRef,
        coordinate: { scope: "route-elapsed", routeRef },
        startedAtElapsedMilliseconds: "90000",
        endedAtElapsedMilliseconds: "210000",
      } },
    ));
    expect(screen.getByText("Boundaries saved.")).toBeVisible();
  });

  it("anchors a preserved legacy range deliberately and blocks missing established evidence", async () => {
    const legacy = range({
      exerciseRef: null,
      coordinate: { scope: "legacy-session-elapsed" },
      title: "Preserved finish",
      state: "review-required",
    });
    const missing = range({
      rangeRef: secondRangeRef,
      title: "Missing route",
      state: "review-required",
      coordinate: { scope: "route-elapsed", routeRef: `route-${"9".repeat(64)}` },
    });
    let context = result([legacy, missing]);
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_training_session_ranges") return Promise.resolve(context);
      if (command === "query_training_session_range_summary") {
        return Promise.resolve(summary(legacy));
      }
      if (command === "adjust_training_session_range") {
        const anchored = range({
          title: legacy.title,
          startedAtElapsedMilliseconds: "60000",
          endedAtElapsedMilliseconds: "180000",
          revision: 3,
        });
        context = result([anchored, missing]);
        return Promise.resolve(context);
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
    const user = userEvent.setup();

    renderPanel();
    await screen.findByRole("heading", { name: "Preserved finish" });
    await user.click(screen.getByRole("button", { name: "Review boundaries" }));
    expect(screen.getByLabelText("Exercise")).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Timeline"), routeCoordinateKey);
    await user.clear(screen.getByLabelText("Start"));
    await user.type(screen.getByLabelText("Start"), "0:01:00");
    await user.clear(screen.getByLabelText("End"));
    await user.type(screen.getByLabelText("End"), "0:03:00");
    await user.click(screen.getByRole("button", { name: "Confirm reviewed range" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "adjust_training_session_range",
      expect.objectContaining({ request: expect.objectContaining({
        exerciseRef,
        coordinate: { scope: "route-elapsed", routeRef },
      }) }),
    ));

    await user.click(screen.getByRole("button", { name: "Open Missing route" }));
    expect(screen.getByText("Its recorded timeline is not available in this session version.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Review boundaries" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
  });

  it("uses guarded removal and preserves the range when cancelled", async () => {
    const current = range();
    const removed = result();
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_training_session_ranges") return Promise.resolve(result([current]));
      if (command === "query_training_session_range_summary") return Promise.resolve(summary(current));
      if (command === "remove_training_session_range") return Promise.resolve(removed);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
    const user = userEvent.setup();

    renderPanel();
    await screen.findByRole("heading", { name: "Bridge effort" });
    await user.click(screen.getByRole("button", { name: "Remove" }));
    const confirmation = screen.getByRole("group", { name: "Remove Bridge effort?" });
    expect(confirmation).toHaveTextContent("Your imported session stays unchanged");
    await user.click(within(confirmation).getByRole("button", { name: "Keep range" }));
    expect(screen.queryByRole("group", { name: "Remove Bridge effort?" })).not.toBeInTheDocument();
    expect(mocks.invoke).not.toHaveBeenCalledWith("remove_training_session_range", expect.anything());
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Remove range" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "remove_training_session_range",
      { request: {
        sessionRef,
        snapshotRef,
        rangeRef: firstRangeRef,
        expectedRevision: 2,
      } },
    ));
    expect(await screen.findByText("No personal ranges yet.")).toBeVisible();
    expect(screen.getByText("Range removed.")).toBeVisible();
  });

  it("keeps an edit draft through a stale conflict and reloads the exact revision", async () => {
    const current = range();
    const refreshed = range({ revision: 5, title: "Bridge effort elsewhere" });
    let queries = 0;
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_training_session_ranges") {
        queries += 1;
        return Promise.resolve(queries === 1 ? result([current]) : result([refreshed]));
      }
      if (command === "query_training_session_range_summary") {
        return Promise.resolve(summary(queries === 1 ? current : refreshed));
      }
      if (command === "rename_training_session_range") {
        return Promise.reject({ code: "training-session-range-conflict" });
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
    const user = userEvent.setup();

    renderPanel();
    await screen.findByRole("heading", { name: "Bridge effort" });
    await user.click(screen.getByRole("button", { name: "Rename" }));
    const input = screen.getByLabelText("Range name");
    await user.clear(input);
    await user.type(input, "My retained draft");
    await user.click(screen.getByRole("button", { name: "Save name" }));

    expect(await screen.findByText(
      "This range changed. The latest revision is loaded and your draft is still here.",
    )).toBeVisible();
    expect(screen.getByLabelText("Range name")).toHaveValue("My retained draft");
    expect(mocks.invoke).toHaveBeenLastCalledWith("query_training_session_range_summary", {
      query: { sessionRef, snapshotRef, rangeRef: firstRangeRef, expectedRangeRevision: 5 },
    });
  });

  it("offers calm retry after a local query failure", async () => {
    mocks.invoke
      .mockRejectedValueOnce({ code: "training-session-range-failed" })
      .mockResolvedValueOnce(result());
    const user = userEvent.setup();
    const onError = vi.fn();

    renderPanel(onError);
    expect(await screen.findByText("Personal ranges could not be loaded.")).toBeVisible();
    expect(onError).not.toHaveBeenCalledWith("training-session-range-failed");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No personal ranges yet.")).toBeVisible();
  });

  it("restores the saved range by querying durable state after remount", async () => {
    const saved = range();
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_training_session_ranges") return Promise.resolve(result([saved]));
      if (command === "query_training_session_range_summary") return Promise.resolve(summary(saved));
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    const first = renderPanel();
    expect(await screen.findByRole("heading", { name: "Bridge effort" })).toBeVisible();
    first.unmount();
    renderPanel();

    expect(await screen.findByRole("heading", { name: "Bridge effort" })).toBeVisible();
    expect(await screen.findByText("820 m")).toBeVisible();
    expect(mocks.invoke.mock.calls.filter(
      ([command]) => command === "query_training_session_ranges",
    )).toHaveLength(2);
  });

  it("renders the complete result and actions in Spanish without leaking capabilities", async () => {
    const saved = range();
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_training_session_ranges") return Promise.resolve(result([saved]));
      if (command === "query_training_session_range_summary") return Promise.resolve(summary(saved));
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    renderPanel(vi.fn(), "es-ES");

    expect(await screen.findByRole("heading", { name: "Tus rangos" })).toBeVisible();
    expect(screen.getByText("Creado por ti")).toBeVisible();
    expect(await screen.findByText("Cobertura registrada parcial")).toBeVisible();
    expect(screen.getByRole("button", { name: "Cambiar nombre" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Ajustar límites" })).toBeVisible();
    expect(document.body).not.toHaveTextContent("route-");
    expect(document.body).not.toHaveTextContent("exercise-");
  });

  it("accepts the same 80 Unicode characters as the domain title contract", async () => {
    mocks.invoke.mockResolvedValue(result());
    const user = userEvent.setup();

    renderPanel();
    await screen.findByText("No personal ranges yet.");
    await user.click(screen.getByRole("button", { name: "Create a range" }));
    const name = screen.getByLabelText("Range name");
    const validDomainTitle = "🛶".repeat(80);
    await user.type(name, validDomainTitle);

    expect(name).toHaveValue(validDomainTitle);
    expect(screen.getByRole("button", { name: "Save range" })).toBeEnabled();
  });

  it("does not offer an impossible zero-length timeline", async () => {
    const zero = result();
    zero.exercises[0].coordinates = [{
      coordinate: { scope: "exercise-elapsed" },
      maximumElapsedMilliseconds: "0",
    }];
    mocks.invoke.mockResolvedValue(zero);

    renderPanel();

    expect(await screen.findByText(
      "This session has no recorded timeline long enough to contain a range.",
    )).toBeVisible();
    expect(screen.getByRole("button", { name: "Create a range" })).toBeDisabled();
  });
});
