import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type { AnalyticalChartModel } from "./analytical-chart";
import type { SessionStory } from "./session-story";
import type { TrainingSessionRange, TrainingSessionRangesResult } from "./training-session-range";
import { TrainingRangeInteractionProvider } from "./TrainingRangeInteractionProvider";
import { TrainingSignalWorkbench } from "./TrainingSignalWorkbench";

const commands = vi.hoisted(() => ({ invoke: vi.fn() }));
const analyticalChartProbe = vi.hoisted(() => ({ models: [] as unknown[] }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: commands.invoke }));
vi.mock("./AnalyticalChart", () => ({
  AnalyticalChart: ({ model }: { model: AnalyticalChartModel }) => {
    analyticalChartProbe.models.push(model);
    return <div role="img" aria-label={model.accessibleName} />;
  },
}));

function latestChartModel(seriesId: string): AnalyticalChartModel {
  const model = analyticalChartProbe.models
    .slice()
    .reverse()
    .find((candidate) => (
      (candidate as AnalyticalChartModel).series.some((series) => series.id === seriesId)
    )) as AnalyticalChartModel | undefined;
  expect(model).toBeDefined();
  return model!;
}

function signalStory(): SessionStory {
  const signalRef = `signal-${"b".repeat(64)}`;
  const signal = {
    signalRef,
    ordinal: 0,
    role: "primary" as const,
    kind: "heart-rate" as const,
    unit: "beats-per-minute" as const,
    intervalMilliseconds: "1000",
    sampleCount: 4,
    availableSampleCount: 3,
    projection: "source-ordinal-v1" as const,
    visualSamples: [140, null, 150, 160].map((value, ordinal) => ({
      ordinal,
      elapsedMilliseconds: String(ordinal * 1000),
      value,
      gapBefore: ordinal === 2,
    })),
  };
  const overlay = {
    signalRef,
    metric: "heart-rate" as const,
    sourceKind: "heart-rate" as const,
    sourceUnit: "beats-per-minute" as const,
    valueTransform: "identity" as const,
    alignmentState: "unavailable" as const,
    alignedSamples: [],
  };
  const emptyRole = {
    route: null,
    signals: [],
    evidence: {
      routePointCount: 0,
      signalSeriesCount: 0,
      signalSeriesWithValuesCount: 0,
      partialSignalSeriesCount: 0,
      unavailableSignalSeriesCount: 0,
      emptySignalSeriesCount: 0,
      unsupportedSignalSeriesCount: 0,
      signalSampleCount: 0,
      availableSignalSampleCount: 0,
      unavailableSignalSampleCount: 0,
    },
    primaryMetric: null,
    eligibleOverlays: [],
    exactRoute: null,
    exactSignals: [],
  };
  return {
    schemaVersion: 4,
    snapshotRef: "snapshot-current",
    session: {
      sessionRef: `session-${"d".repeat(64)}`,
      sourceIndex: 1,
      startedAtLocal: "2026-08-17T18:30:00",
      stoppedAtLocal: "2026-08-17T19:30:00",
      utcOffsetMinutes: 120,
      durationMilliseconds: "3600000",
      distanceMeters: null,
      energyKilocalories: null,
      averageHeartRateBpm: "150",
      maximumHeartRateBpm: "170",
      exerciseCount: 1,
      sport: {
        sportRef: `sport-${"e".repeat(64)}`,
        state: "personally-overridden",
        classification: {
          canonicalFamily: "running",
          displayLabel: "Trail running",
          authorship: "user",
          revision: 1,
        },
        recognition: null,
        recognitionCandidateCount: 0,
      },
    },
    structure: null,
    routes: null,
    signals: null,
    zones: null,
    provenance: {
      totalEventCount: 1,
      current: {
        provider: "polar-flow",
        sourceModifiedAtUtc: "2026-08-17T19:31:00Z",
        sourceAdapterVersion: "polar-flow-archive@11",
        mappingVersion: "polar-flow-training-session@6",
        contributingEventCount: 1,
        nonContributingEventCount: 0,
      },
    },
    composition: {
      structureState: "source-absent",
      routeState: "source-absent",
      signalState: "source-present",
      zoneState: "source-absent",
      exerciseCount: 1,
    },
    exercises: [{
      exerciseRef: `exercise-${"f".repeat(64)}`,
      ordinal: 0,
      sport: null,
      structure: null,
      zones: null,
      evidence: {
        hasStructure: false,
        manualLapCount: 0,
        automaticLapCount: 0,
        pauseCount: 0,
        zoneGroupCount: 0,
        zoneCount: 0,
        timedZoneCount: 0,
        unsupportedZoneGroupCount: 0,
      },
      primary: {
        route: null,
        signals: [signal],
        evidence: {
          routePointCount: 0,
          signalSeriesCount: 1,
          signalSeriesWithValuesCount: 1,
          partialSignalSeriesCount: 1,
          unavailableSignalSeriesCount: 0,
          emptySignalSeriesCount: 0,
          unsupportedSignalSeriesCount: 0,
          signalSampleCount: 4,
          availableSignalSampleCount: 3,
          unavailableSignalSampleCount: 1,
        },
        primaryMetric: "heart-rate",
        eligibleOverlays: [overlay],
        exactRoute: null,
        exactSignals: [{
          signalRef,
          kind: signal.kind,
          unit: signal.unit,
          sampleCount: signal.sampleCount,
        }],
      },
      transition: emptyRole,
    }],
  };
}

beforeEach(() => {
  commands.invoke.mockReset();
  analyticalChartProbe.models.length = 0;
});
afterEach(cleanup);

describe("TrainingSignalWorkbench", () => {
  it("authors a range on exact regular-signal samples without aligning another clock", async () => {
    const story = signalStory();
    const exerciseRef = story.exercises[0].exerciseRef;
    const signalRef = story.exercises[0].primary.signals[0].signalRef;
    const alternateSignalRef = `signal-${"c".repeat(64)}`;
    story.exercises[0].primary.signals.push({
      ...story.exercises[0].primary.signals[0],
      signalRef: alternateSignalRef,
      ordinal: 1,
    });
    story.exercises[0].primary.eligibleOverlays.push({
      ...story.exercises[0].primary.eligibleOverlays[0],
      signalRef: alternateSignalRef,
    });
    const savedRange: TrainingSessionRange = {
      rangeRef: `range-${"7".repeat(64)}`,
      exerciseRef,
      coordinate: { scope: "signal-elapsed", signalRef },
      title: "Steady pulse",
      startedAtElapsedMilliseconds: "1000",
      endedAtElapsedMilliseconds: "3000",
      evidenceRevision: `range-evidence-${"8".repeat(64)}`,
      authorship: "user",
      state: "current",
      revision: 1,
    };
    const context = (ranges: TrainingSessionRange[]): TrainingSessionRangesResult => ({
      snapshotRef: story.snapshotRef,
      sessionRef: story.session.sessionRef,
      sessionDurationMilliseconds: story.session.durationMilliseconds,
      evidenceRevision: savedRange.evidenceRevision,
      exercises: [{
        exerciseRef,
        ordinal: 0,
        coordinates: [{
          coordinate: { scope: "signal-elapsed", signalRef },
          maximumElapsedMilliseconds: "3000",
        }],
      }],
      ranges,
    });
    commands.invoke.mockImplementation((command) => {
      if (command === "query_training_session_ranges") return Promise.resolve(context([]));
      if (command === "create_training_session_range") return Promise.resolve(context([savedRange]));
      if (command === "query_training_session_range_summary") return new Promise(() => undefined);
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    render(
      <TrainingRangeInteractionProvider
        sessionRef={story.session.sessionRef}
        snapshotRef={story.snapshotRef}
        story={story}
        locale="en-US"
        messages={catalogs["en-US"]}
        onError={vi.fn()}
      >
        <TrainingSignalWorkbench
          story={story}
          locale="en-US"
          messages={catalogs["en-US"]}
          onOpenExactSignal={vi.fn()}
        />
      </TrainingRangeInteractionProvider>,
    );

    const position = await screen.findByRole("slider", { name: "Recorded sample position" });
    const visibleSignal = screen.getByRole("combobox", { name: "Visible measurement" });
    expect(visibleSignal).toBeEnabled();
    fireEvent.change(position, { target: { value: "1" } });
    await user.click(screen.getByRole("button", { name: "Create a range from this sample" }));

    expect(visibleSignal).toBeDisabled();
    expect(screen.queryByRole("combobox", { name: "Timeline" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Start")).toHaveValue("0:00:01");
    expect(screen.getByLabelText("End")).toHaveValue("0:00:02");
    const startHandle = screen.getByRole("slider", { name: "Range start on signal" });
    const endHandle = screen.getByRole("slider", { name: "Range end on signal" });
    expect(startHandle).toHaveAttribute("aria-valuetext", "Sample 2 of 4 · 1 s");
    endHandle.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByLabelText("End")).toHaveValue("0:00:03");
    expect(latestChartModel(signalRef).annotations?.range).toEqual({
      startCoordinate: 1_000,
      endCoordinate: 3_000,
    });

    await user.type(screen.getByLabelText("Range name"), "Steady pulse");
    await user.click(screen.getByRole("button", { name: "Save range" }));

    expect(commands.invoke).toHaveBeenCalledWith("create_training_session_range", {
      request: {
        sessionRef: story.session.sessionRef,
        snapshotRef: story.snapshotRef,
        exerciseRef,
        coordinate: { scope: "signal-elapsed", signalRef },
        title: "Steady pulse",
        startedAtElapsedMilliseconds: "1000",
        endedAtElapsedMilliseconds: "3000",
      },
    });
    expect(await screen.findByText("Range saved.")).toBeVisible();
    expect(visibleSignal).toBeEnabled();
    expect(document.querySelector(".training-signal-saved-range strong"))
      .toHaveTextContent("Steady pulse");

    fireEvent.change(position, { target: { value: "3" } });
    await user.click(screen.getByRole("button", { name: "Create a range from this sample" }));
    expect(screen.getByLabelText("Start")).toHaveValue("0:00:02");
    expect(screen.getByLabelText("End")).toHaveValue("0:00:03");
  });

  it("selects, adjusts, cancels, and preserves a typed boundary outside the bounded projection", async () => {
    const story = signalStory();
    const exerciseRef = story.exercises[0].exerciseRef;
    const signalRef = story.exercises[0].primary.signals[0].signalRef;
    const firstRange: TrainingSessionRange = {
      rangeRef: `range-${"1".repeat(64)}`,
      exerciseRef,
      coordinate: { scope: "signal-elapsed", signalRef },
      title: "Warm-up pulse",
      startedAtElapsedMilliseconds: "0",
      endedAtElapsedMilliseconds: "2000",
      evidenceRevision: `range-evidence-${"8".repeat(64)}`,
      authorship: "user",
      state: "current",
      revision: 1,
    };
    const secondRange: TrainingSessionRange = {
      ...firstRange,
      rangeRef: `range-${"2".repeat(64)}`,
      title: "Steady pulse",
      startedAtElapsedMilliseconds: "1000",
      endedAtElapsedMilliseconds: "3000",
    };
    const adjustedRange: TrainingSessionRange = {
      ...secondRange,
      endedAtElapsedMilliseconds: "2000",
      revision: 2,
    };
    const context = (ranges: TrainingSessionRange[]): TrainingSessionRangesResult => ({
      snapshotRef: story.snapshotRef,
      sessionRef: story.session.sessionRef,
      sessionDurationMilliseconds: story.session.durationMilliseconds,
      evidenceRevision: firstRange.evidenceRevision,
      exercises: [{
        exerciseRef,
        ordinal: 0,
        coordinates: [{
          coordinate: { scope: "signal-elapsed", signalRef },
          maximumElapsedMilliseconds: "3000",
        }],
      }],
      ranges,
    });
    commands.invoke.mockImplementation((command) => {
      if (command === "query_training_session_ranges") {
        return Promise.resolve(context([firstRange, secondRange]));
      }
      if (command === "adjust_training_session_range") {
        return Promise.resolve(context([firstRange, adjustedRange]));
      }
      if (command === "query_training_session_range_summary") return new Promise(() => undefined);
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    render(
      <TrainingRangeInteractionProvider
        sessionRef={story.session.sessionRef}
        snapshotRef={story.snapshotRef}
        story={story}
        locale="en-US"
        messages={catalogs["en-US"]}
        onError={vi.fn()}
      >
        <TrainingSignalWorkbench
          story={story}
          locale="en-US"
          messages={catalogs["en-US"]}
          onOpenExactSignal={vi.fn()}
        />
      </TrainingRangeInteractionProvider>,
    );

    const savedRange = await screen.findByRole("combobox", { name: "Saved range" });
    expect(screen.getByRole("option", {
      name: "Warm-up pulse · 0:00:00–0:00:02",
    })).toBeVisible();
    expect(screen.getByRole("option", {
      name: "Steady pulse · 0:00:01–0:00:03",
    })).toBeVisible();
    await user.selectOptions(savedRange, secondRange.rangeRef);
    expect(document.querySelector(".training-signal-saved-range strong"))
      .toHaveTextContent("Steady pulse");
    await user.click(screen.getByRole("button", { name: "Adjust on the chart" }));

    expect(savedRange).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "0:00:01.500" } });
    expect(latestChartModel(signalRef).annotations?.range).toEqual({
      endCoordinate: 3_000,
    });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(savedRange).toBeEnabled();
    expect(document.querySelector(".training-signal-saved-range strong"))
      .toHaveTextContent("Steady pulse");
    expect(latestChartModel(signalRef).annotations?.range).toEqual({
      startCoordinate: 1_000,
      endCoordinate: 3_000,
    });

    await user.click(screen.getByRole("button", { name: "Adjust on the chart" }));
    fireEvent.change(screen.getByRole("slider", { name: "Range end on signal" }), {
      target: { value: "2" },
    });
    await user.click(screen.getByRole("button", { name: "Save boundaries" }));

    expect(commands.invoke).toHaveBeenCalledWith("adjust_training_session_range", {
      request: {
        sessionRef: story.session.sessionRef,
        snapshotRef: story.snapshotRef,
        rangeRef: secondRange.rangeRef,
        expectedRevision: 1,
        exerciseRef,
        coordinate: { scope: "signal-elapsed", signalRef },
        startedAtElapsedMilliseconds: "1000",
        endedAtElapsedMilliseconds: "2000",
      },
    });
    expect(await screen.findByText("Boundaries saved.")).toBeVisible();
  });
});
