import { describe, expect, it } from "vitest";

import type { AnalyticalChartModel } from "./analytical-chart";
import {
  analyticalChartPalette,
  compileEChartsAnalyticalChart,
} from "./echarts-analytical-chart-adapter";

function model(): AnalyticalChartModel {
  return {
    accessibleName: "Recorded pace",
    accessibleDescription: "Recorded pace with missing values shown as gaps.",
    locale: "en-US",
    renderer: "canvas",
    coordinate: {
      ref: "exercise-1:primary:elapsed",
      label: "Elapsed time",
      unit: "ms",
      domain: { minimum: 0, maximum: 3_000 },
      format: { kind: "duration-milliseconds" },
    },
    axes: [{
      id: "pace",
      label: "Pace",
      unit: "min/km",
      domain: { minimum: 4, maximum: 6 },
      direction: "lower-at-top",
      format: { kind: "number", maximumFractionDigits: 1 },
    }],
    series: [{
      id: "signal-1",
      label: "Pace",
      coordinateRef: "exercise-1:primary:elapsed",
      axisId: "pace",
      points: [
        { id: "sample-1", coordinate: 0, value: 6, gapBefore: false },
        { id: "sample-2", coordinate: 1_000, value: null, gapBefore: false },
        { id: "sample-3", coordinate: 2_000, value: 5, gapBefore: true },
        { id: "sample-4", coordinate: 3_000, value: 4, gapBefore: false },
      ],
    }],
    annotations: {
      selectedCoordinate: 2_000,
      range: { startCoordinate: 1_000, endCoordinate: 3_000 },
    },
    interaction: { zoom: true, pointSelection: true },
  };
}

describe("compileEChartsAnalyticalChart", () => {
  it("preserves source gaps, inverse pace direction, exact annotations, and native zoom", () => {
    const compiled = compileEChartsAnalyticalChart(model(), {
      accent: "#336655",
      accentSoft: "rgba(51, 102, 85, 0.18)",
      ink: "#17211b",
      muted: "#657068",
      line: "#d1d8d2",
      surface: "#ffffff",
      baseFontSize: 16,
      fontFamily: "Inter",
    });

    expect(compiled.option.animation).toBe(false);
    expect(compiled.option.aria).toMatchObject({
      enabled: true,
      description: "Recorded pace with missing values shown as gaps.",
    });
    expect(compiled.option.xAxis).toMatchObject({
      name: "Elapsed time (ms)",
      min: 0,
      max: 3_000,
    });
    expect(compiled.option.yAxis).toEqual([
      expect.objectContaining({
        name: "Pace (min/km)",
        inverse: true,
        min: 4,
        max: 6,
      }),
    ]);
    expect(compiled.option.dataZoom).toHaveLength(2);
    expect(compiled.option.series).toEqual([
      expect.objectContaining({
        connectNulls: false,
        data: [
          { name: "sample-1", value: [0, 6] },
          { name: "sample-2", value: [1_000, null] },
          { value: [2_000, null], silent: true },
          { name: "sample-3", value: [2_000, 5] },
          { name: "sample-4", value: [3_000, 4] },
        ],
        markArea: expect.objectContaining({
          data: [[{ xAxis: 1_000 }, { xAxis: 3_000 }]],
        }),
        markLine: expect.objectContaining({
          data: [
            { xAxis: 1_000, lineStyle: expect.objectContaining({ type: "dashed" }) },
            { xAxis: 3_000, lineStyle: expect.objectContaining({ type: "solid" }) },
            { xAxis: 2_000, lineStyle: expect.objectContaining({ type: "dotted" }) },
          ],
        }),
      }),
    ]);
    expect(compiled.selectionByDataIndex.get("0:3")).toEqual({
      seriesId: "signal-1",
      pointId: "sample-3",
      coordinate: 2_000,
    });
    expect(compiled.selectionByDataIndex.has("0:2")).toBe(false);
  });

  it("assigns independent labeled axes without normalizing values", () => {
    const multiple = model();
    multiple.axes.push({
      id: "temperature",
      label: "Temperature",
      unit: "°C",
      domain: { minimum: 10, maximum: 20 },
      direction: "higher-at-top",
      format: { kind: "number", maximumFractionDigits: 1 },
    });
    multiple.series.push({
      id: "signal-2",
      label: "Temperature",
      coordinateRef: multiple.coordinate.ref,
      axisId: "temperature",
      points: [
        { id: "temperature-1", coordinate: 0, value: 10, gapBefore: false },
        { id: "temperature-2", coordinate: 3_000, value: 20, gapBefore: false },
      ],
    });

    const compiled = compileEChartsAnalyticalChart(multiple, {
      accent: "#336655",
      accentSoft: "rgba(51, 102, 85, 0.18)",
      ink: "#17211b",
      muted: "#657068",
      line: "#d1d8d2",
      surface: "#ffffff",
      baseFontSize: 16,
      fontFamily: "Inter",
    });

    expect(compiled.option.yAxis).toEqual([
      expect.objectContaining({ name: "Pace (min/km)", position: "left" }),
      expect.objectContaining({ name: "Temperature (°C)", position: "right" }),
    ]);
    expect(compiled.option.series[1]).toMatchObject({
      yAxisIndex: 1,
      data: [
        { name: "temperature-1", value: [0, 10] },
        { name: "temperature-2", value: [3_000, 20] },
      ],
    });
  });

  it("inherits zoomed application typography and reserves matching label space", () => {
    const element = document.createElement("div");
    element.style.fontFamily = "Inter";
    element.style.fontSize = "32px";
    element.style.setProperty("--accent-deep", "#336655");
    document.body.append(element);

    const palette = analyticalChartPalette(element);
    const compiled = compileEChartsAnalyticalChart(model(), palette);

    expect(palette).toMatchObject({
      baseFontSize: 32,
      fontFamily: "Inter",
    });
    expect(compiled.option.grid.left).toBeGreaterThanOrEqual(128);
    expect(compiled.option.xAxis.axisLabel).toMatchObject({
      fontFamily: "Inter",
      fontSize: 26,
    });
    expect(compiled.option.xAxis.nameTextStyle).toMatchObject({
      fontFamily: "Inter",
      fontSize: 26,
    });
    expect(compiled.option.tooltip).toMatchObject({
      textStyle: { fontFamily: "Inter", fontSize: 26 },
    });
    expect(compiled.option.dataZoom[1]).toMatchObject({
      height: 44,
      bottom: 16,
      textStyle: { fontFamily: "Inter", fontSize: 26 },
    });

    element.remove();
  });
});
