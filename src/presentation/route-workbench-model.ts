import { normalizeKeyboardKey } from "./keyboard-key";
import type {
  SessionStoryMetric,
  SessionStoryOverlay,
  SessionStoryRole,
} from "./session-story";
import { transformSessionStoryValue } from "./session-story-metric";
import type { TrainingRoutePoint } from "./training-session-route";

const MAX_DIRECTION_MARKERS = 6;
const OVERLAY_LEVEL_COUNT = 5;

export interface RouteWorkbenchPoint {
  source: TrainingRoutePoint;
  viewportLatitudeDegrees: number;
  viewportLongitudeDegrees: number;
}

export interface RouteDirectionMarker {
  pointIndex: number;
  bearingDegrees: number;
}

export interface RouteWorkbenchOverlayValue {
  signalRef: string;
  metric: SessionStoryMetric;
  signalSampleOrdinal: number | null;
  elapsedMilliseconds: string | null;
  sourceValue: number | null;
  value: number | null;
  gapBefore: boolean;
}

export interface RouteWorkbenchOverlaySample extends RouteWorkbenchOverlayValue {
  routePointOrdinal: number;
  routePointIndex: number;
  signalSampleOrdinal: number;
  elapsedMilliseconds: string;
}

export interface RouteWorkbenchLaneSample {
  signalSampleOrdinal: number;
  elapsedMilliseconds: string;
  sourceValue: number | null;
  value: number | null;
  gapBefore: boolean;
}

export interface RouteWorkbenchOverlay {
  signalRef: string;
  metric: SessionStoryMetric;
  minimum: number | null;
  maximum: number | null;
  samples: RouteWorkbenchOverlaySample[];
  laneMinimum: number | null;
  laneMaximum: number | null;
  laneSamples: RouteWorkbenchLaneSample[];
  valuesByRouteOrdinal: ReadonlyMap<number, RouteWorkbenchOverlayValue>;
}

export interface RouteWorkbenchModel {
  routeRef: string;
  routeKind: "primary" | "transition";
  sourcePointCount: number;
  points: RouteWorkbenchPoint[];
  elapsedPointIndexes: number[];
  maximumElapsedMilliseconds: string | null;
  directionMarkers: RouteDirectionMarker[];
  overlays: RouteWorkbenchOverlay[];
}

export interface RouteOverlaySegment {
  fromPointIndex: number;
  throughPointIndex: number;
  level: number | null;
}

export interface RouteWorkbenchSelection {
  pointIndex: number;
  point: RouteWorkbenchPoint;
  overlayValues: RouteWorkbenchOverlayValue[];
}

function workbenchOverlay(
  overlay: SessionStoryOverlay,
  role: SessionStoryRole,
  pointIndexesByOrdinal: ReadonlyMap<number, number>,
): RouteWorkbenchOverlay {
  const valuesByRouteOrdinal = new Map<number, RouteWorkbenchOverlayValue>();
  const samples: RouteWorkbenchOverlaySample[] = [];
  overlay.alignedSamples.forEach((sample) => {
    const routePointIndex = pointIndexesByOrdinal.get(sample.routePointOrdinal);
    if (routePointIndex === undefined) return;
    const value = {
      signalRef: overlay.signalRef,
      metric: overlay.metric,
      routePointOrdinal: sample.routePointOrdinal,
      routePointIndex,
      signalSampleOrdinal: sample.signalSampleOrdinal,
      elapsedMilliseconds: sample.elapsedMilliseconds,
      sourceValue: sample.value,
      value: transformSessionStoryValue(overlay.valueTransform, sample.value),
      gapBefore: sample.gapBefore,
    };
    valuesByRouteOrdinal.set(sample.routePointOrdinal, value);
    samples.push(value);
  });
  const available = [...valuesByRouteOrdinal.values()]
    .flatMap((sample) => sample.value === null ? [] : [sample.value]);
  const signal = role.signals.find((candidate) => candidate.signalRef === overlay.signalRef);
  const laneSamples = signal?.visualSamples.map((sample) => ({
    signalSampleOrdinal: sample.ordinal,
    elapsedMilliseconds: sample.elapsedMilliseconds,
    sourceValue: sample.value,
    value: transformSessionStoryValue(overlay.valueTransform, sample.value),
    gapBefore: sample.gapBefore,
  })) ?? [];
  const laneAvailable = laneSamples.flatMap(
    (sample) => sample.value === null ? [] : [sample.value],
  );
  return {
    signalRef: overlay.signalRef,
    metric: overlay.metric,
    minimum: available.length === 0 ? null : Math.min(...available),
    maximum: available.length === 0 ? null : Math.max(...available),
    samples,
    laneMinimum: laneAvailable.length === 0 ? null : Math.min(...laneAvailable),
    laneMaximum: laneAvailable.length === 0 ? null : Math.max(...laneAvailable),
    laneSamples,
    valuesByRouteOrdinal,
  };
}

function unwrapPoints(points: TrainingRoutePoint[]): RouteWorkbenchPoint[] {
  const result: RouteWorkbenchPoint[] = [];
  points.forEach((source) => {
    let longitude = source.longitudeDegrees;
    const previous = result.at(-1)?.viewportLongitudeDegrees;
    if (previous !== undefined) {
      while (longitude - previous > 180) longitude -= 360;
      while (longitude - previous < -180) longitude += 360;
    }
    result.push({
      source,
      viewportLatitudeDegrees: source.latitudeDegrees,
      viewportLongitudeDegrees: longitude,
    });
  });
  return result;
}

function bearing(from: RouteWorkbenchPoint, through: RouteWorkbenchPoint): number {
  const latitude = (from.viewportLatitudeDegrees + through.viewportLatitudeDegrees) / 2;
  const north = through.viewportLatitudeDegrees - from.viewportLatitudeDegrees;
  const east = (through.viewportLongitudeDegrees - from.viewportLongitudeDegrees)
    * Math.cos(latitude * Math.PI / 180);
  const degrees = Math.atan2(east, north) * 180 / Math.PI;
  return (degrees + 360) % 360;
}

function directionMarkers(points: RouteWorkbenchPoint[]): RouteDirectionMarker[] {
  if (points.length < 2) return [];
  const segmentCount = points.length - 1;
  const markerCount = Math.min(segmentCount, MAX_DIRECTION_MARKERS);
  const indexes = new Set<number>();
  for (let marker = 0; marker < markerCount; marker += 1) {
    indexes.add(Math.min(
      segmentCount - 1,
      Math.floor((marker + 0.5) * segmentCount / markerCount),
    ));
  }
  return [...indexes].map((pointIndex) => ({
    pointIndex,
    bearingDegrees: bearing(points[pointIndex], points[pointIndex + 1]),
  }));
}

export function buildRouteWorkbenchModel(
  role: SessionStoryRole,
): RouteWorkbenchModel | null {
  if (!role.route || role.route.visualPoints.length === 0) return null;
  const points = unwrapPoints(role.route.visualPoints);
  const pointIndexesByOrdinal = new Map(points.map(
    (point, pointIndex) => [point.source.ordinal, pointIndex],
  ));
  const elapsedPointIndexes = points.flatMap((point, pointIndex) => (
    point.source.elapsedMilliseconds === null ? [] : [pointIndex]
  ));
  const overlays = role.eligibleOverlays.map(
    (overlay) => workbenchOverlay(overlay, role, pointIndexesByOrdinal),
  );
  const elapsedValues = [
    ...elapsedPointIndexes.map(
      (pointIndex) => points[pointIndex].source.elapsedMilliseconds!,
    ),
    ...overlays.flatMap((overlay) => overlay.laneSamples.map(
      (sample) => sample.elapsedMilliseconds,
    )),
  ];
  const maximumElapsedMilliseconds = elapsedValues.reduce<string | null>(
    (maximum, elapsed) => maximum === null || BigInt(elapsed) > BigInt(maximum)
      ? elapsed
      : maximum,
    null,
  );
  return {
    routeRef: role.route.routeRef,
    routeKind: role.route.kind,
    sourcePointCount: role.route.pointCount,
    points,
    elapsedPointIndexes,
    maximumElapsedMilliseconds,
    directionMarkers: directionMarkers(points),
    overlays,
  };
}

export function selectRoutePoint(
  model: RouteWorkbenchModel,
  requestedPointIndex: number,
): RouteWorkbenchSelection {
  const pointIndex = Math.max(0, Math.min(
    model.points.length - 1,
    Math.trunc(requestedPointIndex),
  ));
  const point = model.points[pointIndex];
  return {
    pointIndex,
    point,
    overlayValues: model.overlays.map((overlay) => (
      overlay.valuesByRouteOrdinal.get(point.source.ordinal) ?? {
        signalRef: overlay.signalRef,
        metric: overlay.metric,
        signalSampleOrdinal: null,
        elapsedMilliseconds: null,
        sourceValue: null,
        value: null,
        gapBefore: false,
      }
    )),
  };
}

const TIMELINE_SCALE = 1_000_000n;

export function routeTimelinePosition(
  model: RouteWorkbenchModel,
  pointIndex: number,
): number | null {
  const elapsed = model.points[pointIndex]?.source.elapsedMilliseconds;
  const maximum = model.maximumElapsedMilliseconds;
  if (elapsed === null || elapsed === undefined || maximum === null) return null;
  if (BigInt(maximum) === 0n) return 0;
  return Number(BigInt(elapsed) * TIMELINE_SCALE / BigInt(maximum))
    / Number(TIMELINE_SCALE);
}

export function routeTimelinePositionForElapsed(
  model: RouteWorkbenchModel,
  elapsedMilliseconds: string,
): number | null {
  const maximum = model.maximumElapsedMilliseconds;
  if (maximum === null) return null;
  if (BigInt(maximum) === 0n) return 0;
  return Number(BigInt(elapsedMilliseconds) * TIMELINE_SCALE / BigInt(maximum))
    / Number(TIMELINE_SCALE);
}

export function routePointIndexAtTimelineFraction(
  model: RouteWorkbenchModel,
  requestedFraction: number,
): number {
  if (model.elapsedPointIndexes.length === 0 || model.maximumElapsedMilliseconds === null) {
    return 0;
  }
  const fraction = Number.isFinite(requestedFraction)
    ? Math.max(0, Math.min(1, requestedFraction))
    : 0;
  const scaledFraction = BigInt(Math.round(fraction * Number(TIMELINE_SCALE)));
  const target = BigInt(model.maximumElapsedMilliseconds) * scaledFraction / TIMELINE_SCALE;
  return model.elapsedPointIndexes.reduce((nearestIndex, pointIndex) => {
    const nearestElapsed = BigInt(
      model.points[nearestIndex].source.elapsedMilliseconds!,
    );
    const candidateElapsed = BigInt(
      model.points[pointIndex].source.elapsedMilliseconds!,
    );
    const nearestDistance = nearestElapsed >= target
      ? nearestElapsed - target
      : target - nearestElapsed;
    const candidateDistance = candidateElapsed >= target
      ? candidateElapsed - target
      : target - candidateElapsed;
    return candidateDistance < nearestDistance ? pointIndex : nearestIndex;
  }, model.elapsedPointIndexes[0]);
}

export function routeTimelineKeyboardSelection(
  model: RouteWorkbenchModel,
  selectedPointIndex: number,
  key: string,
): number | null {
  if (model.elapsedPointIndexes.length === 0) return null;
  const normalizedKey = normalizeKeyboardKey(key);
  if (normalizedKey === "Home") return model.elapsedPointIndexes[0];
  if (normalizedKey === "End") return model.elapsedPointIndexes.at(-1)!;
  if (normalizedKey === "ArrowRight") {
    return model.elapsedPointIndexes.find((pointIndex) => pointIndex > selectedPointIndex)
      ?? selectedPointIndex;
  }
  if (normalizedKey === "ArrowLeft") {
    return model.elapsedPointIndexes.filter(
      (pointIndex) => pointIndex < selectedPointIndex,
    ).at(-1)
      ?? selectedPointIndex;
  }
  return null;
}

export function routeOverlaySegments(
  model: RouteWorkbenchModel,
  signalRef: string | null,
): RouteOverlaySegment[] {
  const overlay = signalRef === null
    ? undefined
    : model.overlays.find((candidate) => candidate.signalRef === signalRef);
  return model.points.slice(1).map((through, pointIndex) => {
    if (!overlay || overlay.minimum === null || overlay.maximum === null) {
      return { fromPointIndex: pointIndex, throughPointIndex: pointIndex + 1, level: null };
    }
    const fromValue = overlay.valuesByRouteOrdinal.get(
      model.points[pointIndex].source.ordinal,
    );
    const throughValue = overlay.valuesByRouteOrdinal.get(through.source.ordinal);
    if (fromValue?.value === null || fromValue === undefined
      || throughValue?.value === null || throughValue === undefined
      || throughValue.gapBefore) {
      return { fromPointIndex: pointIndex, throughPointIndex: pointIndex + 1, level: null };
    }
    const span = overlay.maximum - overlay.minimum;
    const normalized = span === 0 ? 0.5 : (throughValue.value - overlay.minimum) / span;
    return {
      fromPointIndex: pointIndex,
      throughPointIndex: pointIndex + 1,
      level: Math.max(0, Math.min(
        OVERLAY_LEVEL_COUNT - 1,
        Math.round(normalized * (OVERLAY_LEVEL_COUNT - 1)),
      )),
    };
  });
}
