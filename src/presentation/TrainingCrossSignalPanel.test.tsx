import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type { AnalyticalChartModel } from "./analytical-chart";
import type {
  TrainingSignalKind,
  TrainingSignalSeriesOverview,
  TrainingSignalUnit,
} from "./training-session-signal";
import { TrainingCrossSignalPanel } from "./TrainingCrossSignalPanel";

const analyticalChartProbe = vi.hoisted(() => ({ models: [] as unknown[] }));

vi.mock("./AnalyticalChart", () => ({
  AnalyticalChart: ({ model }: { model: AnalyticalChartModel }) => {
    analyticalChartProbe.models.push(model);
    return <div role="img" aria-label={model.accessibleName} />;
  },
}));

function signal(
  ordinal: number,
  kind: TrainingSignalKind,
  unit: TrainingSignalUnit,
  values: Array<number | null> = [100, 110, 120],
): TrainingSignalSeriesOverview {
  return {
    signalRef: `signal-${String(ordinal + 1).repeat(64)}`,
    ordinal,
    role: "primary",
    kind,
    unit,
    intervalMilliseconds: "1000",
    sampleCount: values.length,
    availableSampleCount: values.filter((value) => value !== null).length,
    projection: "source-ordinal-v1",
    visualSamples: values.map((value, sampleOrdinal) => ({
      ordinal: sampleOrdinal,
      elapsedMilliseconds: String(sampleOrdinal * 1000),
      value,
      gapBefore: sampleOrdinal === 2 && values[1] === null,
    })),
  };
}

const series = [
  signal(0, "heart-rate", "beats-per-minute", [120, null, 140]),
  signal(1, "speed", "kilometers-per-hour", [10, 11, 12]),
  signal(2, "altitude", "meters", [50, 55, 53]),
  signal(3, "cadence", "rotations-per-minute", [70, 75, 80]),
  signal(4, "left-crank-power", "watts", [180, 200, 190]),
];

afterEach(() => {
  cleanup();
  analyticalChartProbe.models.length = 0;
});

describe("TrainingCrossSignalPanel", () => {
  it("aligns separate labelled lanes on one elapsed-time axis without bridging gaps", () => {
    render(
      <TrainingCrossSignalPanel
        exerciseRef={`exercise-${"a".repeat(64)}`}
        series={series}
        locale="en-US"
        messages={catalogs["en-US"]}
        onOpenExact={vi.fn()}
      />,
    );

    const panel = screen.getByRole("region", { name: "Explore signals together" });
    expect(panel).toHaveTextContent("Exercise signals share elapsed time");
    expect(panel).toHaveTextContent("Each lane keeps its own labeled scale");
    expect(panel).toHaveTextContent("Elapsed time 0–2 s");
    expect(within(panel).getAllByRole("checkbox", { checked: true })).toHaveLength(3);
    expect(within(panel).getAllByRole("img")).toHaveLength(1);

    const heartRateLane = panel.querySelector('[data-signal-ref="signal-1111111111111111111111111111111111111111111111111111111111111111"]');
    expect(heartRateLane).toHaveTextContent("Heart rate · series 1");
    expect(heartRateLane).toHaveTextContent("120–140 bpm");
    const chart = analyticalChartProbe.models.at(-1) as AnalyticalChartModel;
    expect(chart.layout).toEqual({ kind: "stacked-lanes" });
    expect(chart.coordinate).toMatchObject({
      ref: `exercise-${"a".repeat(64)}:primary:elapsed`,
      domain: { minimum: 0, maximum: 2_000 },
    });
    expect(chart.axes.map((axis) => [axis.label, axis.unit, axis.domain])).toEqual([
      ["Heart rate · series 1", "bpm", { minimum: 120, maximum: 140 }],
      ["Speed · series 2", "km/h", { minimum: 10, maximum: 12 }],
      ["Altitude · series 3", "m", { minimum: 50, maximum: 55 }],
    ]);
    expect(chart.series[0].points).toEqual([
      expect.objectContaining({ coordinate: 0, value: 120, gapBefore: false }),
      expect.objectContaining({ coordinate: 1_000, value: null, gapBefore: false }),
      expect.objectContaining({ coordinate: 2_000, value: 140, gapBefore: true }),
    ]);
  });

  it("keeps selection between two and four recorded series", async () => {
    const user = userEvent.setup();
    render(
      <TrainingCrossSignalPanel
        exerciseRef={`exercise-${"a".repeat(64)}`}
        series={series}
        locale="en-US"
        messages={catalogs["en-US"]}
        onOpenExact={vi.fn()}
      />,
    );

    const heartRate = screen.getByRole("checkbox", { name: "Heart rate · series 1" });
    const speed = screen.getByRole("checkbox", { name: "Speed · series 2" });
    const altitude = screen.getByRole("checkbox", { name: "Altitude · series 3" });
    const cadence = screen.getByRole("checkbox", { name: "Cadence · series 4" });
    const power = screen.getByRole("checkbox", { name: "Left crank power · series 5" });

    await user.click(altitude);
    expect(heartRate).toBeDisabled();
    expect(speed).toBeDisabled();
    await user.click(cadence);
    await user.click(altitude);
    expect(within(screen.getByRole("region", { name: "Explore signals together" }))
      .getAllByRole("checkbox", { checked: true })).toHaveLength(4);
    expect(power).toBeDisabled();

    await user.click(altitude);
    expect(power).toBeEnabled();
  });

  it("opens the exact paginated evidence for a selected lane", async () => {
    const user = userEvent.setup();
    const onOpenExact = vi.fn();
    render(
      <TrainingCrossSignalPanel
        exerciseRef={`exercise-${"a".repeat(64)}`}
        series={series}
        locale="en-US"
        messages={catalogs["en-US"]}
        onOpenExact={onOpenExact}
      />,
    );

    await user.click(screen.getByRole("button", {
      name: "Open exact samples for Speed · series 2",
    }));
    expect(onOpenExact).toHaveBeenCalledWith(
      series[1].signalRef,
      expect.any(HTMLButtonElement),
    );
  });

  it("stays absent without two visible series and resets for new evidence", async () => {
    const onOpenExact = vi.fn();
    const rendered = render(
      <TrainingCrossSignalPanel
        exerciseRef={`exercise-${"a".repeat(64)}`}
        series={[series[0]]}
        locale="en-US"
        messages={catalogs["en-US"]}
        onOpenExact={onOpenExact}
      />,
    );
    expect(screen.queryByRole("region", { name: "Explore signals together" }))
      .not.toBeInTheDocument();

    rendered.rerender(
      <TrainingCrossSignalPanel
        exerciseRef={`exercise-${"a".repeat(64)}`}
        series={series}
        locale="es-ES"
        messages={catalogs["es-ES"]}
        onOpenExact={onOpenExact}
      />,
    );
    expect(screen.getByRole("region", { name: "Explorar señales conjuntamente" }))
      .toHaveTextContent("Las señales del ejercicio comparten el tiempo transcurrido");

    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: "Altitud · serie 3" }));
    rendered.rerender(
      <TrainingCrossSignalPanel
        exerciseRef={`exercise-${"a".repeat(64)}`}
        series={[series[3], series[4]]}
        locale="es-ES"
        messages={catalogs["es-ES"]}
        onOpenExact={onOpenExact}
      />,
    );
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(2);
  });
});
