import "leaflet/dist/leaflet.css";
import * as L from "leaflet";

import {
  localRouteViewportKeyboardAction,
  type LocalRouteViewport,
  type LocalRouteViewportOptions,
  type LocalRouteViewportOverlay,
  type LocalRouteViewportRangeSelection,
} from "./route-viewport";
import {
  describeLocalRouteZoom,
  deriveLocalRouteZoomBounds,
  type LocalRouteZoomBounds,
} from "./route-zoom";

const COMPLETE_TRACK_PADDING = L.point(56, 56);
const VIEWPORT_ZOOM_CEILING = deriveLocalRouteZoomBounds(null).maximumZoom;

function routeLatLng(
  point: LocalRouteViewportOptions["points"][number],
): L.LatLngExpression {
  return [point.viewportLatitudeDegrees, point.viewportLongitudeDegrees];
}

export async function createLocalRouteViewport(
  element: HTMLElement,
  options: LocalRouteViewportOptions,
): Promise<LocalRouteViewport> {
  const latLngs = options.points.map(routeLatLng);
  const trackBounds = L.latLngBounds(latLngs);
  const firstPoint = options.points[0];
  const hasSpatialExtent = options.points.some((point) => (
    point.viewportLatitudeDegrees !== firstPoint.viewportLatitudeDegrees
    || point.viewportLongitudeDegrees !== firstPoint.viewportLongitudeDegrees
  ));
  const map = L.map(element, {
    attributionControl: false,
    boxZoom: true,
    doubleClickZoom: true,
    dragging: true,
    keyboard: false,
    preferCanvas: false,
    minZoom: 0,
    maxZoom: VIEWPORT_ZOOM_CEILING,
    scrollWheelZoom: false,
    touchZoom: true,
    zoomControl: false,
  });
  const track = L.polyline(latLngs, {
    className: "fitfreed-route-track",
    interactive: true,
  }).addTo(map);
  const enableDeliberateWheelZoom = () => map.scrollWheelZoom.enable();
  const disableIncidentalWheelZoom = () => map.scrollWheelZoom.disable();
  element.addEventListener("focus", enableDeliberateWheelZoom);
  element.addEventListener("blur", disableIncidentalWheelZoom);
  const navigateByKeyboard = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const action = localRouteViewportKeyboardAction(event.key);
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    if (action.kind === "pan") {
      map.panBy([action.xPixels, action.yPixels], { animate: false });
    } else if (action.delta > 0) {
      map.zoomIn(1, { animate: false });
    } else {
      map.zoomOut(1, { animate: false });
    }
  };
  element.addEventListener("keydown", navigateByKeyboard);
  L.control.scale({ imperial: false, maxWidth: 140, position: "bottomleft" }).addTo(map);

  const start = options.points[0];
  const finish = options.points.at(-1)!;
  L.circleMarker(routeLatLng(start), {
    className: "fitfreed-route-start",
    interactive: false,
    radius: 7,
  }).addTo(map);
  L.circleMarker(routeLatLng(finish), {
    className: options.points.length === 1
      ? "fitfreed-route-single"
      : "fitfreed-route-finish",
    interactive: false,
    radius: 7,
  }).addTo(map);

  options.directionMarkers.forEach((direction) => {
    const arrow = document.createElement("span");
    arrow.textContent = "↑";
    arrow.setAttribute("aria-hidden", "true");
    arrow.style.setProperty(
      "--fitfreed-route-bearing",
      `${direction.bearingDegrees}deg`,
    );
    L.marker(routeLatLng(options.points[direction.pointIndex]), {
      icon: L.divIcon({
        className: "fitfreed-route-direction",
        html: arrow,
        iconAnchor: [10, 10],
        iconSize: [20, 20],
      }),
      interactive: false,
      keyboard: false,
    }).addTo(map);
  });

  const selection = L.circleMarker(routeLatLng(options.points[options.selectedPointIndex]), {
    className: "fitfreed-route-selection",
    interactive: false,
    radius: 9,
  }).addTo(map);
  let overlayLayer: L.LayerGroup | undefined;
  let rangeLayer: L.LayerGroup | undefined;
  let zoomBounds: LocalRouteZoomBounds = deriveLocalRouteZoomBounds(null);
  let publishedZoomState = "";

  function publishZoomState() {
    const currentZoom = map.getZoom();
    if (!Number.isFinite(currentZoom)) return;
    const state = describeLocalRouteZoom(currentZoom, zoomBounds);
    const identity = `${state.level}:${state.levelCount}:${state.canZoomIn}:${state.canZoomOut}`;
    if (identity === publishedZoomState) return;
    publishedZoomState = identity;
    options.onZoomStateChange(state);
  }

  function fittedZoomForCurrentSize(): number | null {
    if (!hasSpatialExtent) return null;
    map.setMinZoom(0);
    map.setMaxZoom(VIEWPORT_ZOOM_CEILING);
    return map.getBoundsZoom(trackBounds, false, COMPLETE_TRACK_PADDING);
  }

  function applyZoomBounds(bounds: LocalRouteZoomBounds) {
    zoomBounds = bounds;
    map.setMaxZoom(bounds.maximumZoom);
    map.setMinZoom(bounds.minimumZoom);
    publishZoomState();
  }

  function fitTrack() {
    const bounds = deriveLocalRouteZoomBounds(fittedZoomForCurrentSize());
    applyZoomBounds(bounds);
    if (!hasSpatialExtent) {
      map.setView(latLngs[0], bounds.fittedZoom, { animate: false });
      publishZoomState();
      return;
    }
    map.fitBounds(trackBounds, {
      animate: false,
      padding: [28, 28],
      maxZoom: bounds.maximumZoom,
    });
    publishZoomState();
  }

  function reconcileZoomBoundsAfterResize() {
    applyZoomBounds(deriveLocalRouteZoomBounds(fittedZoomForCurrentSize()));
  }

  function updateOverlay(overlay: LocalRouteViewportOverlay | null) {
    if (overlayLayer) {
      overlayLayer.removeFrom(map);
      overlayLayer = undefined;
    }
    if (!overlay) return;
    const lines = overlay.segments.flatMap((segment) => segment.level === null ? [] : [
      L.polyline([
        routeLatLng(options.points[segment.fromPointIndex]),
        routeLatLng(options.points[segment.throughPointIndex]),
      ], {
        className: `fitfreed-route-overlay fitfreed-route-overlay-${segment.level}`,
        interactive: false,
      }),
    ]);
    if (lines.length > 0) overlayLayer = L.layerGroup(lines).addTo(map);
    selection.bringToFront();
  }

  function updateRangeSelection(rangeSelection: LocalRouteViewportRangeSelection | null) {
    if (rangeLayer) {
      rangeLayer.removeFrom(map);
      rangeLayer = undefined;
    }
    if (!rangeSelection) return;
    const layers: L.Layer[] = [];
    const startedAt = rangeSelection.startedAtPointIndex;
    const endedAt = rangeSelection.endedAtPointIndex;
    if (startedAt !== null && endedAt !== null) {
      const from = Math.min(startedAt, endedAt);
      const through = Math.max(startedAt, endedAt);
      layers.push(L.polyline(latLngs.slice(from, through + 1), {
        className: "fitfreed-route-range-track",
        interactive: false,
      }));
    }
    if (startedAt !== null) {
      layers.push(L.circleMarker(latLngs[startedAt], {
        className: "fitfreed-route-range-start",
        interactive: false,
        radius: 10,
      }));
    }
    if (endedAt !== null) {
      layers.push(L.circleMarker(latLngs[endedAt], {
        className: "fitfreed-route-range-end",
        interactive: false,
        radius: 10,
      }));
    }
    if (layers.length > 0) rangeLayer = L.layerGroup(layers).addTo(map);
    selection.bringToFront();
  }

  function selectNearest(event: L.LeafletMouseEvent) {
    const eventPoint = map.latLngToLayerPoint(event.latlng);
    let selectedIndex = 0;
    let selectedDistance = Number.POSITIVE_INFINITY;
    options.points.forEach((point, pointIndex) => {
      const distance = eventPoint.distanceTo(map.latLngToLayerPoint(L.latLng(routeLatLng(point))));
      if (distance < selectedDistance) {
        selectedDistance = distance;
        selectedIndex = pointIndex;
      }
    });
    options.onSelectPoint(selectedIndex);
  }

  track.on("click", selectNearest);
  map.on("zoomend", publishZoomState);
  fitTrack();
  updateOverlay(options.overlay);
  updateRangeSelection(options.rangeSelection);

  return {
    updateSelection(pointIndex) {
      const point = options.points[Math.max(0, Math.min(options.points.length - 1, pointIndex))];
      selection.setLatLng(routeLatLng(point)).bringToFront();
    },
    updateOverlay,
    updateRangeSelection,
    zoomIn() {
      map.zoomIn(1, { animate: false });
    },
    zoomOut() {
      map.zoomOut(1, { animate: false });
    },
    fitTrack,
    invalidateSize() {
      map.invalidateSize({ animate: false, pan: false });
      reconcileZoomBoundsAfterResize();
    },
    destroy() {
      track.off("click", selectNearest);
      map.off("zoomend", publishZoomState);
      element.removeEventListener("focus", enableDeliberateWheelZoom);
      element.removeEventListener("blur", disableIncidentalWheelZoom);
      element.removeEventListener("keydown", navigateByKeyboard);
      map.remove();
    },
  };
}
