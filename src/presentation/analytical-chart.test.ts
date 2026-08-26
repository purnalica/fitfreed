import { describe, expect, it } from "vitest";

import {
  type AnalyticalChartModel,
  validateAnalyticalChartModel,
} from "./analytical-chart";

function model(): AnalyticalChartModel {
  return {
    accessibleName: "Recorded heart rate",
    accessibleDescription: "Recorded heart rate with source gaps preserved.",
    locale: "en-US",
    renderer: "canvas",
    coordinate: {
      ref: "exercise-1:primary:elapsed",
      label: "Elapsed time",
      unit: "ms",
      domain: { minimum: 0, maximum: 2_000 },
      format: { kind: "duration-milliseconds" },
    },
    axes: [{
      id: "heart-rate",
      label: "Heart rate",
      unit: "bpm",
      domain: { minimum: 120, maximum: 140 },
      direction: "higher-at-top",
      format: { kind: "number", maximumFractionDigits: 0 },
    }],
    series: [{
      id: "signal-1",
      label: "Heart rate",
      coordinateRef: "exercise-1:primary:elapsed",
      axisId: "heart-rate",
      points: [
        { id: "sample-1", coordinate: 0, value: 120, gapBefore: false },
        { id: "sample-2", coordinate: 1_000, value: null, gapBefore: false },
        { id: "sample-3", coordinate: 2_000, value: 140, gapBefore: true },
      ],
    }],
    annotations: {
      selectedCoordinate: 2_000,
      range: { startCoordinate: 0, endCoordinate: 2_000 },
    },
    interaction: { zoom: true, pointSelection: true },
  };
}

describe("validateAnalyticalChartModel", () => {
  it("accepts ordered finite evidence with explicit gaps and annotations", () => {
    expect(validateAnalyticalChartModel(model())).toEqual([]);
  });

  it("rejects mixed coordinates, unknown axes, duplicate identities, and unordered points", () => {
    const invalid = model();
    invalid.series.push({
      id: "signal-1",
      label: "Speed",
      coordinateRef: "another-clock",
      axisId: "missing-axis",
      points: [
        { id: "sample-4", coordinate: 2_000, value: 12, gapBefore: false },
        { id: "sample-5", coordinate: 1_000, value: 11, gapBefore: false },
      ],
    });

    expect(validateAnalyticalChartModel(invalid)).toEqual(expect.arrayContaining([
      "duplicate-series-id",
      "mixed-coordinate-ref",
      "unknown-axis",
      "unordered-points",
    ]));
  });

  it("rejects non-finite values and annotations outside the exact coordinate domain", () => {
    const invalid = model();
    invalid.axes[0].domain.maximum = Number.POSITIVE_INFINITY;
    invalid.series[0].points[0].value = Number.NaN;
    invalid.annotations = {
      selectedCoordinate: 3_000,
      range: { startCoordinate: -1, endCoordinate: 2_000 },
    };

    expect(validateAnalyticalChartModel(invalid)).toEqual(expect.arrayContaining([
      "invalid-axis-domain",
      "non-finite-point",
      "selected-coordinate-outside-domain",
      "range-outside-domain",
    ]));
  });
});
