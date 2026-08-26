import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnalyticalChartModel } from "./analytical-chart";
import {
  buildTrainingSignalChartModel,
  TrainingSignalPlot,
} from "./TrainingSignalPlot";

vi.mock("./AnalyticalChart", () => ({
  AnalyticalChart: ({ model }: { model: AnalyticalChartModel }) => (
    <div role="img" aria-label={model.accessibleName} />
  ),
}));

afterEach(cleanup);

describe("TrainingSignalPlot", () => {
  it("splits source gaps and places lower pace values higher", () => {
    const samples = [
      { ordinal: 0, elapsedMilliseconds: "0", value: 6, gapBefore: false },
      { ordinal: 1, elapsedMilliseconds: "1000", value: null, gapBefore: false },
      { ordinal: 2, elapsedMilliseconds: "2000", value: 5, gapBefore: true },
      { ordinal: 3, elapsedMilliseconds: "3000", value: 4, gapBefore: false },
    ];
    const model = buildTrainingSignalChartModel({
      samples,
      summary: "Recorded pace",
      coordinateRef: "exercise-1:primary:elapsed",
      seriesId: "pace-signal",
      xAxisLabel: "Elapsed time",
      yAxisLabel: "Pace",
      unit: "min/km",
      locale: "en-US",
      lowerValuesAtTop: true,
      pointSelection: false,
      selectedSampleOrdinal: null,
      rangeSelection: null,
    });

    expect(model).not.toBeNull();
    expect(model?.axes[0].direction).toBe("lower-at-top");
    expect(model?.interaction.pointSelection).toBe(false);
    expect(model?.series[0].points).toEqual([
      { id: "sample-0", coordinate: 0, value: 6, gapBefore: false },
      { id: "sample-1", coordinate: 1_000, value: null, gapBefore: false },
      { id: "sample-2", coordinate: 2_000, value: 5, gapBefore: true },
      { id: "sample-3", coordinate: 3_000, value: 4, gapBefore: false },
    ]);

    render(<TrainingSignalPlot
      samples={samples}
      summary="Recorded pace"
      coordinateRef="exercise-1:primary:elapsed"
      seriesId="pace-signal"
      xAxisLabel="Elapsed time"
      yAxisLabel="Pace"
      unit="min/km"
      locale="en-US"
      sampleCount={4}
      emptyMessage="Empty"
      noRecordedValuesMessage="Unavailable"
      loadingMessage="Drawing chart…"
      chartUnavailableMessage="Chart unavailable"
      lowerValuesAtTop
    />);

    expect(screen.getByRole("img", { name: "Recorded pace" })).toBeInTheDocument();
  });

  it("projects only exact selected and range sample ordinals", () => {
    const samples = [0, 1, 2, 3].map((ordinal) => ({
      ordinal,
      elapsedMilliseconds: String(ordinal * 1000),
      value: 140 + ordinal,
      gapBefore: false,
    }));
    const model = buildTrainingSignalChartModel({
      samples,
      summary: "Recorded heart rate",
      coordinateRef: "exercise-1:primary:elapsed",
      seriesId: "heart-rate-signal",
      xAxisLabel: "Elapsed time",
      yAxisLabel: "Heart rate",
      unit: "bpm",
      locale: "en-US",
      lowerValuesAtTop: false,
      pointSelection: true,
      selectedSampleOrdinal: 2,
      rangeSelection: {
        startedAtSampleOrdinal: 1,
        endedAtSampleOrdinal: 3,
      },
    });

    expect(model?.annotations).toEqual({
      selectedCoordinate: 2_000,
      range: { startCoordinate: 1_000, endCoordinate: 3_000 },
    });
    expect(model?.interaction.pointSelection).toBe(true);
  });
});
