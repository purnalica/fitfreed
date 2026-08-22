import "leaflet/dist/leaflet.css";
import * as L from "leaflet";

import {
  localRouteViewportKeyboardAction,
  type LocalRouteViewport,
  type LocalRouteViewportOptions,
  type LocalRouteViewportOverlay,
} from "./route-viewport";

const SINGLE_POINT_ZOOM = 16;

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
  const map = L.map(element, {
    attributionControl: false,
    boxZoom: true,
    doubleClickZoom: true,
    dragging: true,
    keyboard: false,
    preferCanvas: false,
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

  function fitTrack() {
    if (latLngs.length === 1) {
      map.setView(latLngs[0], SINGLE_POINT_ZOOM, { animate: false });
      return;
    }
    map.fitBounds(L.latLngBounds(latLngs), {
      animate: false,
      padding: [28, 28],
    });
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
  fitTrack();
  updateOverlay(options.overlay);

  return {
    updateSelection(pointIndex) {
      const point = options.points[Math.max(0, Math.min(options.points.length - 1, pointIndex))];
      selection.setLatLng(routeLatLng(point)).bringToFront();
    },
    updateOverlay,
    zoomIn() {
      map.zoomIn(1, { animate: false });
    },
    zoomOut() {
      map.zoomOut(1, { animate: false });
    },
    fitTrack,
    invalidateSize() {
      map.invalidateSize({ animate: false, pan: false });
    },
    destroy() {
      track.off("click", selectNearest);
      element.removeEventListener("focus", enableDeliberateWheelZoom);
      element.removeEventListener("blur", disableIncidentalWheelZoom);
      element.removeEventListener("keydown", navigateByKeyboard);
      map.remove();
    },
  };
}
