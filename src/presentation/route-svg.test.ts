import { describe, expect, it } from "vitest";

import { routeSvgPoints } from "./route-svg";
import type { TrainingRoutePoint } from "./training-session-route";

function point(ordinal: number, latitude: number, longitude: number): TrainingRoutePoint {
  return {
    ordinal,
    latitudeDegrees: latitude,
    longitudeDegrees: longitude,
    altitudeMeters: null,
    elapsedMilliseconds: null,
  };
}

describe("routeSvgPoints", () => {
  it("normalizes a route without returning any recorded coordinate", () => {
    const result = routeSvgPoints([
      point(0, 40.123456, -3.654321),
      point(1, 40.124456, -3.653321),
    ]);

    expect(result).toBe("24.00,296.00 616.00,24.00");
    expect(result).not.toContain("40.123456");
    expect(result).not.toContain("-3.654321");
  });

  it("keeps antimeridian crossings local and centers single-axis routes", () => {
    expect(routeSvgPoints([
      point(0, 10, 179.9),
      point(1, 10, -179.9),
    ])).toBe("24.00,160.00 616.00,160.00");
    expect(routeSvgPoints([])).toBe("");
  });
});
