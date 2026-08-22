import type {
  SessionStoryMetric,
  SessionStoryOverlay,
  SessionStoryRole,
} from "./session-story";
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
  sourceValue: number | null;
  value: number | null;
  gapBefore: boolean;
}

export interface RouteWorkbenchOverlay {
  signalRef: string;
  metric: SessionStoryMetric;
  minimum: number | null;
  maximum: number | null;
  valuesByRouteOrdinal: ReadonlyMap<number, RouteWorkbenchOverlayValue>;
}

export interface RouteWorkbenchModel {
  routeRef: string;
  routeKind: "primary" | "transition";
  points: RouteWorkbenchPoint[];
  elapsedPointIndexes: number[];
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

function transformedValue(overlay: SessionStoryOverlay, value: number | null): number | null {
  if (value === null) return null;
  if (overlay.valueTransform === "identity") return value;
  return value > 0 ? 60 / value : null;
}

function workbenchOverlay(overlay: SessionStoryOverlay): RouteWorkbenchOverlay {
  const valuesByRouteOrdinal = new Map<number, RouteWorkbenchOverlayValue>();
  overlay.alignedSamples.forEach((sample) => {
    valuesByRouteOrdinal.set(sample.routePointOrdinal, {
      signalRef: overlay.signalRef,
      metric: overlay.metric,
      sourceValue: sample.value,
      value: transformedValue(overlay, sample.value),
      gapBefore: sample.gapBefore,
    });
  });
  const available = [...valuesByRouteOrdinal.values()]
    .flatMap((sample) => sample.value === null ? [] : [sample.value]);
  return {
    signalRef: overlay.signalRef,
    metric: overlay.metric,
    minimum: available.length === 0 ? null : Math.min(...available),
    maximum: available.length === 0 ? null : Math.max(...available),
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
  return {
    routeRef: role.route.routeRef,
    routeKind: role.route.kind,
    points,
    elapsedPointIndexes: points.flatMap((point, pointIndex) => (
      point.source.elapsedMilliseconds === null ? [] : [pointIndex]
    )),
    directionMarkers: directionMarkers(points),
    overlays: role.eligibleOverlays.map(workbenchOverlay),
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
        sourceValue: null,
        value: null,
        gapBefore: false,
      }
    )),
  };
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
