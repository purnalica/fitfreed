import { describe, expect, it } from "vitest";

import {
  buildRouteWorkbenchModel,
  routePointIndexAtTimelineFraction,
  routeTimelineKeyboardSelection,
  routeTimelinePosition,
  routeOverlaySegments,
  selectRoutePoint,
} from "./route-workbench-model";
import type { SessionStoryRole } from "./session-story";
import type { TrainingRoutePoint } from "./training-session-route";

function point(
  ordinal: number,
  longitudeDegrees: number,
  elapsedMilliseconds: string | null,
): TrainingRoutePoint {
  return {
    ordinal,
    latitudeDegrees: 40 + ordinal / 100,
    longitudeDegrees,
    altitudeMeters: ordinal === 1 ? null : 100 + ordinal,
    elapsedMilliseconds,
  };
}

function role(points: TrainingRoutePoint[]): SessionStoryRole {
  const signalRef = `signal-${"b".repeat(64)}`;
  return {
    route: {
      routeRef: `route-${"a".repeat(64)}`,
      kind: "primary",
      startedAtLocal: "2026-08-17T18:30:00",
      pointCount: points.length,
      altitudePointCount: points.filter((candidate) => candidate.altitudeMeters !== null).length,
      elapsedPointCount: points.filter(
        (candidate) => candidate.elapsedMilliseconds !== null,
      ).length,
      projection: "source-ordinal-v1",
      visualPoints: points,
    },
    signals: [{
      signalRef,
      ordinal: 0,
      role: "primary",
      kind: "speed",
      unit: "kilometers-per-hour",
      intervalMilliseconds: "1000",
      sampleCount: 3,
      availableSampleCount: 2,
      projection: "source-ordinal-v1",
      visualSamples: [{
        ordinal: 0,
        elapsedMilliseconds: "0",
        value: 12,
        gapBefore: false,
      }, {
        ordinal: 1,
        elapsedMilliseconds: "1000",
        value: 10,
        gapBefore: true,
      }, {
        ordinal: 2,
        elapsedMilliseconds: "2000",
        value: null,
        gapBefore: false,
      }],
    }],
    evidence: {
      routePointCount: points.length,
      signalSeriesCount: 1,
      signalSeriesWithValuesCount: 1,
      partialSignalSeriesCount: 1,
      unavailableSignalSeriesCount: 0,
      emptySignalSeriesCount: 0,
      unsupportedSignalSeriesCount: 0,
      signalSampleCount: 3,
      availableSignalSampleCount: 2,
      unavailableSignalSampleCount: 1,
    },
    primaryMetric: "pace",
    eligibleOverlays: [{
      signalRef,
      metric: "pace",
      sourceKind: "speed",
      sourceUnit: "kilometers-per-hour",
      valueTransform: "kilometers-per-hour-to-minutes-per-kilometer",
      alignedSamples: [{
        routePointOrdinal: 0,
        signalSampleOrdinal: 0,
        elapsedMilliseconds: "0",
        value: 12,
        gapBefore: false,
      }, {
        routePointOrdinal: 1,
        signalSampleOrdinal: 1,
        elapsedMilliseconds: "1000",
        value: 10,
        gapBefore: true,
      }, {
        routePointOrdinal: 2,
        signalSampleOrdinal: 2,
        elapsedMilliseconds: "2000",
        value: null,
        gapBefore: false,
      }],
    }],
    exactRoute: {
      routeRef: `route-${"a".repeat(64)}`,
      pointCount: points.length,
    },
    exactSignals: [{
      signalRef,
      kind: "speed",
      unit: "kilometers-per-hour",
      sampleCount: 3,
    }],
  };
}

describe("route workbench model", () => {
  it("keeps source evidence exact while unwrapping an anti-meridian route for the viewport", () => {
    const source = [
      point(0, 179.8, "0"),
      point(1, -179.9, null),
      point(2, -179.7, "2000"),
    ];

    const model = buildRouteWorkbenchModel(role(source));

    expect(model).not.toBeNull();
    expect(model!.points.map((candidate) => candidate.viewportLongitudeDegrees))
      .toEqual([179.8, 180.1, 180.3]);
    expect(model!.points.map((candidate) => candidate.source.longitudeDegrees))
      .toEqual([179.8, -179.9, -179.7]);
    expect(model!.elapsedPointIndexes).toEqual([0, 2]);
    expect(model!.directionMarkers.length).toBeGreaterThan(0);
    expect(model!.directionMarkers.every(
      (marker) => Number.isFinite(marker.bearingDegrees),
    )).toBe(true);
  });

  it("aligns transformed overlay values by source ordinal without bridging a recorded signal gap", () => {
    const model = buildRouteWorkbenchModel(role([
      point(0, -3.7, "0"),
      point(1, -3.69, "1000"),
      point(2, -3.68, "2000"),
    ]))!;
    const overlay = model.overlays[0];

    expect(selectRoutePoint(model, 0).overlayValues[0]).toMatchObject({
      metric: "pace",
      signalSampleOrdinal: 0,
      elapsedMilliseconds: "0",
      value: 5,
      gapBefore: false,
    });
    expect(selectRoutePoint(model, 1).overlayValues[0]).toMatchObject({
      signalSampleOrdinal: 1,
      elapsedMilliseconds: "1000",
      value: 6,
      gapBefore: true,
    });
    expect(selectRoutePoint(model, 2).overlayValues[0]).toMatchObject({
      value: null,
    });
    expect(routeOverlaySegments(model, overlay.signalRef)).toEqual([
      { fromPointIndex: 0, throughPointIndex: 1, level: null },
      { fromPointIndex: 1, throughPointIndex: 2, level: null },
    ]);
  });

  it("normalizes available overlay segments and bounds invalid point selection", () => {
    const evidence = role([
      point(0, -3.7, "0"),
      point(1, -3.69, "1000"),
      point(2, -3.68, "2000"),
    ]);
    evidence.eligibleOverlays[0].alignedSamples[1].gapBefore = false;
    evidence.eligibleOverlays[0].alignedSamples[2].value = 8;
    const model = buildRouteWorkbenchModel(evidence)!;

    expect(routeOverlaySegments(model, model.overlays[0].signalRef)).toEqual([
      { fromPointIndex: 0, throughPointIndex: 1, level: 2 },
      { fromPointIndex: 1, throughPointIndex: 2, level: 4 },
    ]);
    expect(selectRoutePoint(model, -10).pointIndex).toBe(0);
    expect(selectRoutePoint(model, 99).pointIndex).toBe(2);
  });

  it("moves a shared timeline through recorded route positions without inventing missing time", () => {
    const model = buildRouteWorkbenchModel(role([
      point(0, -3.7, "0"),
      point(1, -3.69, null),
      point(2, -3.68, "2000"),
      point(3, -3.67, "6000"),
    ]))!;

    expect(routeTimelinePosition(model, 0)).toBe(0);
    expect(routeTimelinePosition(model, 1)).toBeNull();
    expect(routeTimelinePosition(model, 2)).toBeCloseTo(1 / 3);
    expect(routeTimelinePosition(model, 3)).toBe(1);
    expect(routePointIndexAtTimelineFraction(model, 0.32)).toBe(2);
    expect(routePointIndexAtTimelineFraction(model, 0.9)).toBe(3);
    expect(routeTimelineKeyboardSelection(model, 0, "ArrowRight")).toBe(2);
    expect(routeTimelineKeyboardSelection(model, 2, "ArrowLeft")).toBe(0);
    expect(routeTimelineKeyboardSelection(model, 1, "ArrowRight")).toBe(2);
    expect(routeTimelineKeyboardSelection(model, 2, "Home")).toBe(0);
    expect(routeTimelineKeyboardSelection(model, 2, "End")).toBe(3);
    expect(routeTimelineKeyboardSelection(model, 2, "\uE011")).toBe(0);
    expect(routeTimelineKeyboardSelection(model, 2, "\uE010")).toBe(3);
    expect(routeTimelineKeyboardSelection(model, 2, "PageDown")).toBeNull();
  });

  it("keeps the complete bounded signal lane when only some samples align with route points", () => {
    const evidence = role([
      point(0, -3.7, "0"),
      point(1, -3.69, "3000"),
    ]);
    evidence.eligibleOverlays[0].alignedSamples = evidence.eligibleOverlays[0]
      .alignedSamples.slice(0, 1);

    const overlay = buildRouteWorkbenchModel(evidence)!.overlays[0];

    expect(overlay.samples).toHaveLength(1);
    expect(overlay.laneSamples.map((sample) => sample.signalSampleOrdinal))
      .toEqual([0, 1, 2]);
    expect(overlay.laneSamples.map((sample) => sample.value)).toEqual([5, 6, null]);
    expect(overlay.laneSamples[1].gapBefore).toBe(true);
  });

  it("does not create a workbench for absent or empty route geometry", () => {
    const withoutRoute = role([]);
    withoutRoute.route = null;

    expect(buildRouteWorkbenchModel(withoutRoute)).toBeNull();
    expect(buildRouteWorkbenchModel(role([]))).toBeNull();
  });
});
