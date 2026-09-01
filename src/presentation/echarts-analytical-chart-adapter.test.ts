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
    layout: { kind: "overlay" },
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
      format: { kind: "pace-minutes" },
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
    expect(compiled.option.yAxis[0].axisLabel.formatter(4.999)).toBe("5:00");
    expect(compiled.option.dataZoom).toHaveLength(2);
    expect(compiled.option.dataZoom[1]).toMatchObject({
      type: "slider",
      realtime: false,
    });
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

  it("keeps exact markers on readable series and removes marker noise from dense series", () => {
    const readable = compileEChartsAnalyticalChart(model(), {
      accent: "#336655",
      accentSoft: "rgba(51, 102, 85, 0.18)",
      ink: "#17211b",
      muted: "#657068",
      line: "#d1d8d2",
      surface: "#ffffff",
      baseFontSize: 16,
      fontFamily: "Inter",
    });
    const dense = model();
    dense.coordinate.domain.maximum = 80_000;
    dense.series[0].points = Array.from({ length: 81 }, (_, index) => ({
      id: `sample-${index}`,
      coordinate: index * 1_000,
      value: 4 + (index % 3),
      gapBefore: false,
    }));
    const compiledDense = compileEChartsAnalyticalChart(dense, {
      accent: "#336655",
      accentSoft: "rgba(51, 102, 85, 0.18)",
      ink: "#17211b",
      muted: "#657068",
      line: "#d1d8d2",
      surface: "#ffffff",
      baseFontSize: 16,
      fontFamily: "Inter",
    });

    expect(readable.option.series[0].showSymbol).toBe(true);
    expect(compiledDense.option.series[0].showSymbol).toBe(false);
  });

  it("stacks independent lanes on linked elapsed axes without changing their values", () => {
    const stacked = Object.assign(model(), {
      layout: { kind: "stacked-lanes" as const },
    });
    stacked.axes.push({
      id: "temperature",
      label: "Temperature",
      unit: "°C",
      domain: { minimum: 10, maximum: 20 },
      direction: "higher-at-top",
      format: { kind: "number", maximumFractionDigits: 1 },
    });
    stacked.series.push({
      id: "signal-2",
      label: "Temperature",
      coordinateRef: stacked.coordinate.ref,
      axisId: "temperature",
      points: [
        { id: "temperature-1", coordinate: 0, value: 10, gapBefore: false },
        { id: "temperature-2", coordinate: 3_000, value: 20, gapBefore: false },
      ],
    });

    const compiled = compileEChartsAnalyticalChart(stacked, {
      accent: "#336655",
      accentSoft: "rgba(51, 102, 85, 0.18)",
      ink: "#17211b",
      muted: "#657068",
      line: "#d1d8d2",
      surface: "#ffffff",
      baseFontSize: 16,
      fontFamily: "Inter",
    });

    expect(compiled.option.grid).toEqual([
      expect.objectContaining({
        outerBoundsMode: "same",
        outerBoundsContain: "axisLabel",
      }),
      expect.objectContaining({
        outerBoundsMode: "same",
        outerBoundsContain: "axisLabel",
      }),
    ]);
    expect(compiled.option.xAxis).toEqual([
      expect.objectContaining({ gridIndex: 0, min: 0, max: 3_000 }),
      expect.objectContaining({ gridIndex: 1, min: 0, max: 3_000 }),
    ]);
    expect(compiled.option.yAxis).toEqual([
      expect.objectContaining({
        gridIndex: 0,
        name: "Pace (min/km)",
        nameLocation: "end",
        nameRotate: 0,
      }),
      expect.objectContaining({
        gridIndex: 1,
        name: "Temperature (°C)",
        nameLocation: "end",
        nameRotate: 0,
      }),
    ]);
    expect(compiled.option.series).toEqual([
      expect.objectContaining({
        xAxisIndex: 0,
        yAxisIndex: 0,
        symbol: "circle",
        lineStyle: expect.objectContaining({ type: "solid" }),
      }),
      expect.objectContaining({
        xAxisIndex: 1,
        yAxisIndex: 1,
        symbol: "rect",
        lineStyle: expect.objectContaining({ type: "dashed" }),
      }),
    ]);
    expect(compiled.option.legend.show).toBe(false);
    expect(compiled.option.axisPointer).toEqual({
      link: [{ xAxisIndex: [0, 1] }],
    });
    expect(compiled.option.dataZoom).toEqual([
      expect.objectContaining({ xAxisIndex: [0, 1] }),
      expect.objectContaining({ xAxisIndex: [0, 1] }),
    ]);
  });

  it("formats a longitudinal coordinate as a localized calendar date", () => {
    const longitudinal = model();
    longitudinal.locale = "es-ES";
    longitudinal.coordinate = {
      ref: "history-1:local-date",
      label: "Fecha",
      unit: "",
      domain: {
        minimum: Date.UTC(2026, 2, 28),
        maximum: Date.UTC(2026, 2, 30),
      },
      format: { kind: "local-date" },
    };
    longitudinal.series[0].coordinateRef = longitudinal.coordinate.ref;
    longitudinal.series[0].points = [
      {
        id: "activity:2026-03-28",
        coordinate: Date.UTC(2026, 2, 28),
        value: 12_000,
        gapBefore: false,
      },
    ];

    const compiled = compileEChartsAnalyticalChart(longitudinal, {
      accent: "#336655",
      accentSoft: "rgba(51, 102, 85, 0.18)",
      ink: "#17211b",
      muted: "#657068",
      line: "#d1d8d2",
      surface: "#ffffff",
      baseFontSize: 16,
      fontFamily: "Inter",
    });
    expect(Array.isArray(compiled.option.xAxis)).toBe(false);
    if (Array.isArray(compiled.option.xAxis)) {
      throw new Error("overlay charts must compile one calendar axis");
    }
    expect(compiled.option.xAxis.axisLabel.formatter(Date.UTC(2026, 2, 28)))
      .toBe("28 mar 2026");
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
    expect(Array.isArray(compiled.option.grid)).toBe(false);
    expect(Array.isArray(compiled.option.xAxis)).toBe(false);
    if (Array.isArray(compiled.option.grid) || Array.isArray(compiled.option.xAxis)) {
      throw new Error("overlay charts must compile one coordinate grid and axis");
    }
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

  it("scales stacked lane and corner-label separation with application zoom", () => {
    const stacked = Object.assign(model(), {
      layout: { kind: "stacked-lanes" as const },
    });
    stacked.axes.push({
      id: "heart-rate",
      label: "Frecuencia cardíaca",
      unit: "ppm",
      domain: { minimum: 120, maximum: 180 },
      direction: "higher-at-top",
      format: { kind: "number", maximumFractionDigits: 0 },
    });
    stacked.series.push({
      id: "signal-2",
      label: "Frecuencia cardíaca",
      coordinateRef: stacked.coordinate.ref,
      axisId: "heart-rate",
      points: [
        { id: "heart-rate-1", coordinate: 0, value: 120, gapBefore: false },
        { id: "heart-rate-2", coordinate: 3_000, value: 180, gapBefore: false },
      ],
    });

    const compiled = compileEChartsAnalyticalChart(stacked, {
      accent: "#336655",
      accentSoft: "rgba(51, 102, 85, 0.18)",
      ink: "#17211b",
      muted: "#657068",
      line: "#d1d8d2",
      surface: "#ffffff",
      baseFontSize: 32,
      fontFamily: "Inter",
    });
    if (!Array.isArray(compiled.option.grid)) {
      throw new Error("stacked charts must compile independent grids");
    }
    const firstTop = Number.parseFloat(String(compiled.option.grid[0].top));
    const firstHeight = Number.parseFloat(String(compiled.option.grid[0].height));
    const secondTop = Number.parseFloat(String(compiled.option.grid[1].top));
    expect(secondTop - firstTop - firstHeight).toBe(9);
    expect(compiled.option.yAxis.map((axis) => ({
      splitNumber: axis.splitNumber,
      interval: axis.interval,
      margin: axis.axisLabel.margin,
      hideOverlap: axis.axisLabel.hideOverlap,
    }))).toEqual([
      { splitNumber: 1, interval: 2, margin: 32, hideOverlap: true },
      { splitNumber: 1, interval: 60, margin: 32, hideOverlap: true },
    ]);
    expect(Array.isArray(compiled.option.xAxis)).toBe(true);
    if (!Array.isArray(compiled.option.xAxis)) {
      throw new Error("stacked charts must compile independent coordinate axes");
    }
    expect(compiled.option.xAxis.every((axis) => axis.axisLabel.hideOverlap)).toBe(true);
    expect(compiled.option.xAxis.every((axis) => axis.nameGap === 64)).toBe(true);
  });
});
