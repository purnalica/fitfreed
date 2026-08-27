import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalyticalChartModel, AnalyticalChartSelection } from "./analytical-chart";
import EChartsAnalyticalChart from "./EChartsAnalyticalChart";

const adapter = vi.hoisted(() => ({
  mount: vi.fn(),
  update: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock("./echarts-analytical-chart-adapter", () => ({
  mountEChartsAnalyticalChart: adapter.mount,
}));

let observedResize: ResizeObserverCallback | undefined;
let hostWidth = 640;
let hostHeight = 320;
let hostDevicePixelRatio = 1;

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
    layout: { kind: "overlay" },
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
  adapter.update.mockReset();
  adapter.resize.mockReset();
  adapter.dispose.mockReset();
  adapter.mount.mockReturnValue({
    update: adapter.update,
    resize: adapter.resize,
    dispose: adapter.dispose,
  });
  observedResize = undefined;
  hostWidth = 640;
  hostHeight = 320;
  hostDevicePixelRatio = 1;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get")
    .mockImplementation(() => hostWidth);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get")
    .mockImplementation(() => hostHeight);
  vi.spyOn(window, "devicePixelRatio", "get")
    .mockImplementation(() => hostDevicePixelRatio);
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("EChartsAnalyticalChart", () => {
  it("owns one disposable renderer and resizes it only when host geometry changes", () => {
    const onSelection = vi.fn<(selection: AnalyticalChartSelection) => void>();
    const { unmount } = render(
      <EChartsAnalyticalChart model={model()} onSelection={onSelection} />,
    );

    const host = screen.getByRole("img", { name: "Recorded heart rate" });
    expect(host).toHaveAttribute("data-chart-renderer", "svg");
    expect(host).toHaveAccessibleDescription("Recorded heart rate with source gaps preserved.");
    const renderer = host.querySelector(".analytical-chart-renderer");
    expect(renderer).toHaveAttribute("aria-hidden", "true");
    expect(adapter.mount).toHaveBeenCalledWith(renderer, expect.any(Object), onSelection);

    act(() => observedResize?.([], {} as ResizeObserver));
    expect(adapter.resize).not.toHaveBeenCalled();

    act(() => window.dispatchEvent(new Event("resize")));
    expect(adapter.resize).not.toHaveBeenCalled();

    hostWidth = 720;
    act(() => observedResize?.([], {} as ResizeObserver));
    expect(adapter.resize).toHaveBeenCalledTimes(1);

    act(() => window.dispatchEvent(new Event("resize")));
    expect(adapter.resize).toHaveBeenCalledTimes(1);

    hostHeight = 360;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(adapter.resize).toHaveBeenCalledTimes(2);

    hostDevicePixelRatio = 2;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(adapter.resize).toHaveBeenCalledTimes(3);

    unmount();
    expect(adapter.dispose).toHaveBeenCalledTimes(1);
  });

  it("updates synchronized evidence without replacing the renderer", () => {
    const initial = model();
    const onSelection = vi.fn<(selection: AnalyticalChartSelection) => void>();
    const rendered = render(
      <EChartsAnalyticalChart model={initial} onSelection={onSelection} />,
    );
    const updated = {
      ...initial,
      annotations: { selectedCoordinate: 1_000 },
    };

    rendered.rerender(
      <EChartsAnalyticalChart model={updated} onSelection={onSelection} />,
    );

    expect(adapter.mount).toHaveBeenCalledTimes(1);
    expect(adapter.dispose).not.toHaveBeenCalled();
    expect(adapter.update).toHaveBeenCalledOnce();
    expect(adapter.update).toHaveBeenCalledWith(updated, onSelection);
  });

  it("waits for visible geometry before mounting the renderer", () => {
    hostWidth = 0;
    hostHeight = 0;
    const initial = model();
    const rendered = render(<EChartsAnalyticalChart model={initial} />);

    expect(adapter.mount).not.toHaveBeenCalled();

    const updated = {
      ...initial,
      annotations: { selectedCoordinate: 1_000 },
    };
    rendered.rerender(<EChartsAnalyticalChart model={updated} />);

    hostWidth = 640;
    hostHeight = 320;
    act(() => observedResize?.([], {} as ResizeObserver));
    expect(adapter.mount).toHaveBeenCalledTimes(1);
    expect(adapter.mount).toHaveBeenCalledWith(expect.any(HTMLElement), updated, undefined);

    act(() => observedResize?.([], {} as ResizeObserver));
    expect(adapter.resize).not.toHaveBeenCalled();

    hostHeight = 360;
    act(() => observedResize?.([], {} as ResizeObserver));
    expect(adapter.resize).toHaveBeenCalledTimes(1);

    rendered.unmount();
    expect(adapter.dispose).toHaveBeenCalledTimes(1);
  });
});
