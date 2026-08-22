import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TrainingSignalPlot } from "./TrainingSignalPlot";

afterEach(cleanup);

describe("TrainingSignalPlot", () => {
  it("splits source gaps and places lower pace values higher", () => {
    render(<TrainingSignalPlot
      samples={[
        { ordinal: 0, elapsedMilliseconds: "0", value: 6, gapBefore: false },
        { ordinal: 1, elapsedMilliseconds: "1000", value: null, gapBefore: false },
        { ordinal: 2, elapsedMilliseconds: "2000", value: 5, gapBefore: true },
        { ordinal: 3, elapsedMilliseconds: "3000", value: 4, gapBefore: false },
      ]}
      summary="Recorded pace"
      sampleCount={4}
      emptyMessage="Empty"
      noRecordedValuesMessage="Unavailable"
      lowerValuesAtTop
    />);

    const chart = screen.getByRole("img", { name: "Recorded pace" });
    expect(chart.querySelectorAll("circle")).toHaveLength(1);
    const segment = chart.querySelector("polyline");
    expect(segment).not.toBeNull();
    const [, firstY] = segment!.getAttribute("points")!.split(" ")[0].split(",").map(Number);
    const [, lastY] = segment!.getAttribute("points")!.split(" ")[1].split(",").map(Number);
    expect(lastY).toBeLessThan(firstY);
  });
});
