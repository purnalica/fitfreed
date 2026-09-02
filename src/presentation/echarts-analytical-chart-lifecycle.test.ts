import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalyticalChartModel } from "./analytical-chart";

const renderer = vi.hoisted(() => {
  type Listener = (event: unknown) => void;

  const listeners = new Map<string, Listener>();
  const flush = vi.fn();
  const chart = {
    dispose: vi.fn(),
    getZr: vi.fn(() => ({ flush })),
    on: vi.fn((eventName: string, listener: Listener) => {
      listeners.set(eventName, listener);
    }),
    resize: vi.fn(),
    setOption: vi.fn(),
  };
  return {
    chart,
    flush,
    init: vi.fn(() => chart),
    listeners,
    use: vi.fn(),
  };
});

vi.mock("echarts/core", () => ({
  init: renderer.init,
  use: renderer.use,
}));

import { mountEChartsAnalyticalChart } from "./echarts-analytical-chart-adapter";

function chartModel(): AnalyticalChartModel {
  return {
    accessibleName: "Recorded heart rate",
    accessibleDescription: "Recorded heart rate over elapsed time.",
    locale: "en-US",
    renderer: "svg",
    layout: { kind: "overlay" },
    coordinate: {
      ref: "exercise-1:elapsed",
      label: "Elapsed time",
      unit: "",
      domain: { minimum: 0, maximum: 1_000 },
      format: { kind: "duration-milliseconds" },
    },
    axes: [{
      id: "heart-rate",
      label: "Heart rate",
      unit: "bpm",
      domain: { minimum: 120, maximum: 130 },
      direction: "higher-at-top",
      format: { kind: "number", maximumFractionDigits: 0 },
    }],
    series: [{
      id: "signal-1",
      label: "Heart rate",
      coordinateRef: "exercise-1:elapsed",
      axisId: "heart-rate",
      points: [
        { id: "sample-1", coordinate: 0, value: 120, gapBefore: false },
        { id: "sample-2", coordinate: 1_000, value: 130, gapBefore: false },
      ],
    }],
    interaction: { zoom: true, pointSelection: false },
  };
}

beforeEach(() => {
  renderer.chart.dispose.mockClear();
  renderer.chart.getZr.mockClear();
  renderer.chart.on.mockClear();
  renderer.chart.resize.mockClear();
  renderer.chart.setOption.mockClear();
  renderer.flush.mockClear();
  renderer.init.mockClear();
  renderer.listeners.clear();
});

describe("ECharts analytical chart lifecycle", () => {
  it("flushes the completed zoom paint without waiting for an animation frame", () => {
    const element = document.createElement("div");
    document.body.append(element);

    const mounted = mountEChartsAnalyticalChart(element, chartModel());
    const completedZoom = renderer.listeners.get("datazoom");

    expect(completedZoom).toBeTypeOf("function");
    expect(renderer.flush).not.toHaveBeenCalled();

    completedZoom?.({ type: "datazoom", start: 20, end: 100 });

    expect(renderer.chart.getZr).toHaveBeenCalledOnce();
    expect(renderer.flush).toHaveBeenCalledOnce();

    mounted.dispose();
    element.remove();
  });
});
