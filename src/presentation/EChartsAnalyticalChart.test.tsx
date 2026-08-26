import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalyticalChartModel, AnalyticalChartSelection } from "./analytical-chart";
import EChartsAnalyticalChart from "./EChartsAnalyticalChart";

const adapter = vi.hoisted(() => ({
  mount: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock("./echarts-analytical-chart-adapter", () => ({
  mountEChartsAnalyticalChart: adapter.mount,
}));

let observedResize: ResizeObserverCallback | undefined;

class TestResizeObserver implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    observedResize = callback;
  }

  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

function model(): AnalyticalChartModel {
  return {
    accessibleName: "Recorded heart rate",
    accessibleDescription: "Recorded heart rate with source gaps preserved.",
    locale: "en-US",
    renderer: "svg",
    coordinate: {
      ref: "exercise-1:primary:elapsed",
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
      coordinateRef: "exercise-1:primary:elapsed",
      axisId: "heart-rate",
      points: [
        { id: "sample-1", coordinate: 0, value: 120, gapBefore: false },
        { id: "sample-2", coordinate: 1_000, value: 130, gapBefore: false },
      ],
    }],
    interaction: { zoom: false, pointSelection: true },
  };
}

beforeEach(() => {
  adapter.mount.mockReset();
  adapter.resize.mockReset();
  adapter.dispose.mockReset();
  adapter.mount.mockReturnValue({
    resize: adapter.resize,
    dispose: adapter.dispose,
  });
  observedResize = undefined;
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EChartsAnalyticalChart", () => {
  it("owns one disposable renderer and resizes it with its host", () => {
    const onSelection = vi.fn<(selection: AnalyticalChartSelection) => void>();
    const { unmount } = render(
      <EChartsAnalyticalChart model={model()} onSelection={onSelection} />,
    );

    const host = screen.getByRole("img", { name: "Recorded heart rate" });
    expect(host).toHaveAttribute("data-chart-renderer", "svg");
    expect(adapter.mount).toHaveBeenCalledWith(host, expect.any(Object), onSelection);

    act(() => observedResize?.([], {} as ResizeObserver));
    expect(adapter.resize).toHaveBeenCalledTimes(1);

    act(() => window.dispatchEvent(new Event("resize")));
    expect(adapter.resize).toHaveBeenCalledTimes(2);

    unmount();
    expect(adapter.dispose).toHaveBeenCalledTimes(1);
  });
});
