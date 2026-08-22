import type {
  RouteDirectionMarker,
  RouteOverlaySegment,
  RouteWorkbenchPoint,
} from "./route-workbench-model";

export interface LocalRouteViewportOverlay {
  signalRef: string;
  segments: RouteOverlaySegment[];
}

export interface LocalRouteViewportOptions {
  points: RouteWorkbenchPoint[];
  directionMarkers: RouteDirectionMarker[];
  selectedPointIndex: number;
  overlay: LocalRouteViewportOverlay | null;
  onSelectPoint: (pointIndex: number) => void;
}

export interface LocalRouteViewport {
  updateSelection: (pointIndex: number) => void;
  updateOverlay: (overlay: LocalRouteViewportOverlay | null) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitTrack: () => void;
  invalidateSize: () => void;
  destroy: () => void;
}
