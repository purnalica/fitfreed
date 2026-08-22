import { normalizeKeyboardKey } from "./keyboard-key";
import type {
  RouteDirectionMarker,
  RouteOverlaySegment,
  RouteWorkbenchPoint,
} from "./route-workbench-model";

const KEYBOARD_PAN_PIXELS = 80;

export type LocalRouteViewportKeyboardAction =
  | { kind: "pan"; xPixels: number; yPixels: number }
  | { kind: "zoom"; delta: -1 | 1 };

export function localRouteViewportKeyboardAction(
  key: string,
): LocalRouteViewportKeyboardAction | null {
  switch (normalizeKeyboardKey(key)) {
    case "ArrowLeft":
      return { kind: "pan", xPixels: -KEYBOARD_PAN_PIXELS, yPixels: 0 };
    case "ArrowRight":
      return { kind: "pan", xPixels: KEYBOARD_PAN_PIXELS, yPixels: 0 };
    case "ArrowUp":
      return { kind: "pan", xPixels: 0, yPixels: -KEYBOARD_PAN_PIXELS };
    case "ArrowDown":
      return { kind: "pan", xPixels: 0, yPixels: KEYBOARD_PAN_PIXELS };
    case "+":
    case "=":
      return { kind: "zoom", delta: 1 };
    case "-":
    case "_":
      return { kind: "zoom", delta: -1 };
    default:
      return null;
  }
}

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
