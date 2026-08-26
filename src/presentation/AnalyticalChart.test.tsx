import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnalyticalChartModel } from "./analytical-chart";
import { AnalyticalChart } from "./AnalyticalChart";

vi.mock("./EChartsAnalyticalChart", () => ({
  default: ({ model }: { model: AnalyticalChartModel }) => (
    <div role="img" aria-label={model.accessibleName} data-renderer={model.renderer} />
  ),
}));

afterEach(cleanup);

function model(): AnalyticalChartModel {
  return {
    accessibleName: "Recorded heart rate",
    accessibleDescription: "Recorded values with gaps preserved.",
    locale: "en-US",
    renderer: "canvas",
    layout: { kind: "overlay" },
    coordinate: {
      ref: "exercise-1:primary:elapsed",
      label: "Elapsed time",
      unit: "ms",
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
    interaction: { zoom: false, pointSelection: false },
  };
}

describe("AnalyticalChart", () => {
  it("loads the renderer behind one accessible analytical boundary", async () => {
    render(<AnalyticalChart
      model={model()}
      loadingMessage="Drawing chart…"
      unavailableMessage="The chart is unavailable."
    />);

    expect(await screen.findByRole("img", { name: "Recorded heart rate" }))
      .toHaveAttribute("data-renderer", "canvas");
  });

  it("fails closed before loading a renderer for invalid evidence", () => {
    const invalid = model();
    invalid.series[0].coordinateRef = "another-clock";

    render(<AnalyticalChart
      model={invalid}
      loadingMessage="Drawing chart…"
      unavailableMessage="The chart is unavailable. Exact values remain below."
    />);

    expect(screen.getByRole("status"))
      .toHaveTextContent("The chart is unavailable. Exact values remain below.");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
