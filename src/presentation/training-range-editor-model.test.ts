import { describe, expect, it } from "vitest";

import type { SessionStory } from "./session-story";
import type {
  TrainingSessionRange,
  TrainingSessionRangesResult,
} from "./training-session-range";
import {
  coordinateKey,
  elapsedEditorValue,
  findEstablishedCoordinate,
  parseElapsedEditorValue,
  rangeEditorValidation,
  rangeMayBeAdjusted,
  selectableRangeCoordinates,
} from "./training-range-editor-model";

const exerciseRef = `exercise-${"a".repeat(64)}`;
const routeRef = `route-${"b".repeat(64)}`;
const signalRef = `signal-${"c".repeat(64)}`;

const context: TrainingSessionRangesResult = {
  snapshotRef: `training-snapshot-${"d".repeat(64)}`,
  sessionRef: `session-${"e".repeat(64)}`,
  sessionDurationMilliseconds: "9223372036854775807",
  evidenceRevision: `range-evidence-${"f".repeat(64)}`,
  exercises: [{
    exerciseRef,
    ordinal: 0,
    coordinates: [{
      coordinate: { scope: "exercise-elapsed" },
      maximumElapsedMilliseconds: "9223372036854775807",
    }, {
      coordinate: { scope: "route-elapsed", routeRef },
      maximumElapsedMilliseconds: "420000",
    }, {
      coordinate: { scope: "signal-elapsed", signalRef },
      maximumElapsedMilliseconds: "419000",
    }],
  }],
  ranges: [],
};

const story = {
  exercises: [{
    exerciseRef,
    ordinal: 0,
    sport: {
      sportRef: `sport-${"1".repeat(64)}`,
      state: "personally-overridden",
      classification: {
        scope: "unresolved-source-profile" as const,
        canonicalFamily: "running",
        displayLabel: "Canal run",
        authorship: "user",
        revision: 1,
      },
    },
    primary: {
      exactRoute: { routeRef, pointCount: 10 },
      exactSignals: [{
        signalRef,
        kind: "heart-rate",
        unit: "beats-per-minute",
        sampleCount: 420,
      }],
    },
    transition: { exactRoute: null, exactSignals: [] },
  }],
} as unknown as SessionStory;

const currentRange: TrainingSessionRange = {
  rangeRef: `range-${"2".repeat(64)}`,
  exerciseRef,
  coordinate: { scope: "route-elapsed", routeRef },
  title: "Bridge effort",
  startedAtElapsedMilliseconds: "60000",
  endedAtElapsedMilliseconds: "120000",
  evidenceRevision: context.evidenceRevision,
  authorship: "user",
  state: "current",
  revision: 2,
};

describe("training range editor model", () => {
  it("parses and formats exact elapsed values without safe-integer loss", () => {
    expect(parseElapsedEditorValue("0:01:02.003")).toBe("62003");
    expect(parseElapsedEditorValue("61:02.003")).toBe("3662003");
    expect(parseElapsedEditorValue("1:02:03,004")).toBe("3723004");
    expect(parseElapsedEditorValue("2562047788:00:54.775")).toBe("9223372036854775");
    expect(parseElapsedEditorValue("1:60:00")).toBeUndefined();
    expect(parseElapsedEditorValue("one minute")).toBeUndefined();
    expect(parseElapsedEditorValue(`${"1".repeat(33)}:00:00`)).toBeUndefined();
    const maximum = elapsedEditorValue("9223372036854775807");
    expect(maximum).toBe("2562047788015:12:55.807");
    expect(parseElapsedEditorValue(maximum)).toBe("9223372036854775807");
    expect(elapsedEditorValue("60000")).toBe("0:01:00");
  });

  it("builds human choices from the story while keeping opaque references out of labels", () => {
    const choices = selectableRangeCoordinates(context, story, {
      exercise: (ordinal, sport) => `${sport ?? "Exercise"} ${ordinal + 1}`,
      exerciseTimeline: "Exercise timeline",
      primaryRoute: "Primary route timeline",
      transitionRoute: "Transition route timeline",
      recordedRoute: "Recorded route timeline",
      signal: (kind, role) => `${kind} · ${role}`,
      recordedSignal: "Recorded signal timeline",
    });

    expect(choices).toEqual([{
      id: "exercise-0",
      exerciseRef,
      exerciseOrdinal: 0,
      exerciseLabel: "Canal run 1",
      coordinates: [{
        id: "coordinate-0",
        coordinate: { scope: "exercise-elapsed" },
        maximumElapsedMilliseconds: "9223372036854775807",
        label: "Exercise timeline",
      }, {
        id: "coordinate-1",
        coordinate: { scope: "route-elapsed", routeRef },
        maximumElapsedMilliseconds: "420000",
        label: "Primary route timeline",
      }, {
        id: "coordinate-2",
        coordinate: { scope: "signal-elapsed", signalRef },
        maximumElapsedMilliseconds: "419000",
        label: "heart-rate · primary",
      }],
    }]);
    expect(JSON.stringify(choices.map((choice) => ({
      id: choice.id,
      label: choice.exerciseLabel,
      coordinateLabels: choice.coordinates.map((coordinate) => coordinate.label),
    })))).not.toContain("route-");
  });

  it("locks established ownership, permits legacy anchoring, and refuses silent reassignment", () => {
    expect(coordinateKey(currentRange.coordinate)).toBe(`route-elapsed:${routeRef}`);
    expect(findEstablishedCoordinate(context, currentRange)).toEqual({
      coordinate: currentRange.coordinate,
      maximumElapsedMilliseconds: "420000",
    });
    expect(rangeMayBeAdjusted(context, currentRange)).toBe(true);

    const missing = { ...context, exercises: [] };
    expect(findEstablishedCoordinate(missing, {
      ...currentRange,
      state: "review-required",
    })).toBeUndefined();
    expect(rangeMayBeAdjusted(missing, {
      ...currentRange,
      state: "review-required",
    })).toBe(false);
    expect(rangeMayBeAdjusted(context, {
      ...currentRange,
      exerciseRef: null,
      coordinate: { scope: "legacy-session-elapsed" },
      state: "review-required",
    })).toBe(true);

    const zeroExtent = {
      ...context,
      exercises: context.exercises.map((exercise) => ({
        ...exercise,
        coordinates: exercise.coordinates.map((coordinate) => ({
          ...coordinate,
          maximumElapsedMilliseconds: "0",
        })),
      })),
    };
    expect(rangeMayBeAdjusted(zeroExtent, {
      ...currentRange,
      state: "review-required",
    })).toBe(false);
    expect(rangeMayBeAdjusted(zeroExtent, {
      ...currentRange,
      exerciseRef: null,
      coordinate: { scope: "legacy-session-elapsed" },
      state: "review-required",
    })).toBe(false);
  });

  it("validates normalized titles and exact ordered bounds against the selected coordinate", () => {
    expect(rangeEditorValidation({
      title: "  Bridge effort  ",
      startedAt: "0:01:00",
      endedAt: "0:02:00",
      maximumElapsedMilliseconds: "420000",
      requireTitle: true,
    })).toEqual({
      valid: true,
      title: "Bridge effort",
      startedAtElapsedMilliseconds: "60000",
      endedAtElapsedMilliseconds: "120000",
    });
    expect(rangeEditorValidation({
      title: " ", startedAt: "0:02:00", endedAt: "0:01:00",
      maximumElapsedMilliseconds: "420000", requireTitle: true,
    })).toEqual({ valid: false, titleInvalid: true, boundsInvalid: true });
    expect(rangeEditorValidation({
      title: "Valid", startedAt: "0:07:00", endedAt: "0:07:00.001",
      maximumElapsedMilliseconds: "420000", requireTitle: true,
    })).toEqual({ valid: false, titleInvalid: false, boundsInvalid: true });
    expect(rangeEditorValidation({
      title: "x".repeat(81), startedAt: "0:00:00", endedAt: "0:00:01",
      maximumElapsedMilliseconds: "420000", requireTitle: true,
    })).toEqual({ valid: false, titleInvalid: true, boundsInvalid: false });
  });
});
