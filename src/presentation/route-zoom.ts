import type { LocalRouteViewportZoomState } from "./route-viewport";

const MINIMUM_RENDERER_ZOOM = 0;
const MAXIMUM_MEANINGFUL_GPS_ZOOM = 19;
const COMPLETE_TRACK_CONTEXT_LEVELS = 2;
const SINGLE_POINT_FITTED_ZOOM = 16;

export interface LocalRouteZoomBounds {
  fittedZoom: number;
  minimumZoom: number;
  maximumZoom: number;
}

function boundedIntegerZoom(value: number): number {
  return Math.max(
    MINIMUM_RENDERER_ZOOM,
    Math.min(MAXIMUM_MEANINGFUL_GPS_ZOOM, Math.round(value)),
  );
}

export function deriveLocalRouteZoomBounds(
  fittedZoom: number | null,
): LocalRouteZoomBounds {
  const normalizedFittedZoom = fittedZoom !== null && Number.isFinite(fittedZoom)
    ? boundedIntegerZoom(fittedZoom)
    : SINGLE_POINT_FITTED_ZOOM;
  return {
    fittedZoom: normalizedFittedZoom,
    minimumZoom: Math.max(
      MINIMUM_RENDERER_ZOOM,
      normalizedFittedZoom - COMPLETE_TRACK_CONTEXT_LEVELS,
    ),
    maximumZoom: MAXIMUM_MEANINGFUL_GPS_ZOOM,
  };
}

export function describeLocalRouteZoom(
  currentZoom: number,
  bounds: LocalRouteZoomBounds,
): LocalRouteViewportZoomState {
  const normalizedZoom = Math.max(
    bounds.minimumZoom,
    Math.min(bounds.maximumZoom, Math.round(currentZoom)),
  );
  return {
    level: normalizedZoom - bounds.minimumZoom + 1,
    levelCount: bounds.maximumZoom - bounds.minimumZoom + 1,
    canZoomIn: normalizedZoom < bounds.maximumZoom,
    canZoomOut: normalizedZoom > bounds.minimumZoom,
  };
}
