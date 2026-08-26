import { describe, expect, it } from "vitest";

import {
  describeLocalRouteZoom,
  deriveLocalRouteZoomBounds,
} from "./route-zoom";

describe("local route zoom", () => {
  it("keeps useful context below the fitted route without allowing planetary scale", () => {
    expect(deriveLocalRouteZoomBounds(12)).toEqual({
      fittedZoom: 12,
      minimumZoom: 10,
      maximumZoom: 19,
    });
    expect(deriveLocalRouteZoomBounds(1)).toEqual({
      fittedZoom: 1,
      minimumZoom: 0,
      maximumZoom: 19,
    });
    expect(deriveLocalRouteZoomBounds(19)).toEqual({
      fittedZoom: 19,
      minimumZoom: 17,
      maximumZoom: 19,
    });
  });

  it("gives single-point and degenerate routes a stable useful range", () => {
    const expected = {
      fittedZoom: 16,
      minimumZoom: 14,
      maximumZoom: 19,
    };

    expect(deriveLocalRouteZoomBounds(null)).toEqual(expected);
    expect(deriveLocalRouteZoomBounds(Number.POSITIVE_INFINITY)).toEqual(expected);
    expect(deriveLocalRouteZoomBounds(Number.NaN)).toEqual(expected);
  });

  it("describes the bounded zoom without exposing renderer-specific levels", () => {
    const bounds = deriveLocalRouteZoomBounds(12);

    expect(describeLocalRouteZoom(10, bounds)).toEqual({
      level: 1,
      levelCount: 10,
      canZoomIn: true,
      canZoomOut: false,
    });
    expect(describeLocalRouteZoom(12, bounds)).toEqual({
      level: 3,
      levelCount: 10,
      canZoomIn: true,
      canZoomOut: true,
    });
    expect(describeLocalRouteZoom(99, bounds)).toEqual({
      level: 10,
      levelCount: 10,
      canZoomIn: false,
      canZoomOut: true,
    });
  });
});
