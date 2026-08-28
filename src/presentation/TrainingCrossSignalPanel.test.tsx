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

const cumulativeDistance = signal(5, "distance", "meters", [0, 50, 110]);
const regionAccessibleName = "Exercise 1 · Exercise signals · Explore signals together";

afterEach(() => {
  cleanup();
  analyticalChartProbe.models.length = 0;
});

describe("TrainingCrossSignalPanel", () => {
  it("aligns separate labelled lanes on one elapsed-time axis without bridging gaps", () => {
    render(
      <TrainingCrossSignalPanel
        exerciseRef={`exercise-${"a".repeat(64)}`}
        regionAccessibleName={regionAccessibleName}
        series={series}
        sportFamily="running"
        locale="en-US"
        messages={catalogs["en-US"]}
        onOpenExact={vi.fn()}
      />,
    );

    const panel = screen.getByRole("region", { name: regionAccessibleName });
    expect(panel).toHaveTextContent("Exercise signals share elapsed time");
    expect(panel).toHaveTextContent("Each lane keeps its own labeled scale");
    expect(panel).toHaveTextContent("Elapsed time 0–2 s");
    expect(within(panel).getAllByRole("checkbox", { checked: true })).toHaveLength(2);
    expect(within(panel).getAllByRole("img")).toHaveLength(1);

    const heartRateLane = panel.querySelector('[data-signal-ref="signal-1111111111111111111111111111111111111111111111111111111111111111"]');
    expect(heartRateLane).toHaveTextContent("Heart rate");
    expect(heartRateLane).toHaveTextContent("120–140 bpm");
    const chart = analyticalChartProbe.models.at(-1) as AnalyticalChartModel;
    expect(chart.layout).toEqual({ kind: "stacked-lanes" });
    expect(chart.coordinate).toMatchObject({
      ref: `exercise-${"a".repeat(64)}:primary:elapsed`,
      domain: { minimum: 0, maximum: 2_000 },
    });
    expect(chart.axes.map((axis) => [axis.label, axis.unit, axis.domain])).toEqual([
      ["Speed", "km/h", { minimum: 10, maximum: 12 }],
      ["Heart rate", "bpm", { minimum: 120, maximum: 140 }],
    ]);
    expect(chart.series[1].points).toEqual([
      expect.objectContaining({ coordinate: 0, value: 120, gapBefore: false }),
      expect.objectContaining({ coordinate: 1_000, value: null, gapBefore: false }),
      expect.objectContaining({ coordinate: 2_000, value: 140, gapBefore: true }),
    ]);
  });

  it("keeps selection between one and four recorded series", async () => {
    const user = userEvent.setup();
    render(
      <TrainingCrossSignalPanel
        exerciseRef={`exercise-${"a".repeat(64)}`}
        regionAccessibleName={regionAccessibleName}
        series={series}
        sportFamily="running"
        locale="en-US"
        messages={catalogs["en-US"]}
        onOpenExact={vi.fn()}
      />,
    );

    const heartRate = screen.getByRole("checkbox", { name: "Heart rate" });
    const speed = screen.getByRole("checkbox", { name: "Speed" });
    const altitude = screen.getByRole("checkbox", { name: "Altitude" });
    const cadence = screen.getByRole("checkbox", { name: "Cadence" });
    const power = screen.getByRole("checkbox", { name: "Left crank power" });

    await user.click(heartRate);
    expect(speed).toBeDisabled();
    expect(heartRate).toBeEnabled();
    await user.click(cadence);
    await user.click(altitude);
    await user.click(power);
    expect(within(screen.getByRole("region", { name: regionAccessibleName }))
      .getAllByRole("checkbox", { checked: true })).toHaveLength(4);
    expect(screen.getByRole("region", { name: regionAccessibleName })
      .querySelector(".training-cross-signal-lanes"))
      .toHaveAttribute("data-lane-count", "4");
    expect(heartRate).toBeDisabled();

    await user.click(altitude);
    expect(heartRate).toBeEnabled();
  });

  it("orders metrics by sport relevance and keeps cumulative distance out of the default", () => {
    render(
      <TrainingCrossSignalPanel
        exerciseRef={`exercise-${"a".repeat(64)}`}
        regionAccessibleName={regionAccessibleName}
        series={[cumulativeDistance, series[2], series[3], series[4], series[0]]}
        sportFamily="cycling"
        locale="en-US"
        messages={catalogs["en-US"]}
        onOpenExact={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("checkbox").map((choice) => choice.getAttribute("aria-label")))
      .toEqual([
        "Heart rate",
        "Left crank power",
        "Cadence",
        "Altitude",
        "Cumulative distance",
      ]);
    expect(screen.getAllByRole("checkbox", { checked: true }).map((choice) =>
      choice.getAttribute("aria-label")))
      .toEqual(["Heart rate", "Left crank power"]);
    expect(screen.getByRole("region", { name: regionAccessibleName }))
      .not.toHaveTextContent("A running total is selected");
  });

  it("opens the exact paginated evidence for a selected lane", async () => {
    const user = userEvent.setup();
    const onOpenExact = vi.fn();
    render(
      <TrainingCrossSignalPanel
        exerciseRef={`exercise-${"a".repeat(64)}`}
        regionAccessibleName={regionAccessibleName}
        series={series}
        sportFamily="running"
        locale="en-US"
        messages={catalogs["en-US"]}
        onOpenExact={onOpenExact}
      />,
    );

    await user.click(screen.getByRole("button", {
      name: "Open exact samples for Speed",
    }));
    expect(onOpenExact).toHaveBeenCalledWith(
      series[1].signalRef,
      expect.any(HTMLButtonElement),
    );
  });

  it("shows one recorded series and resets its relevance order for new evidence", async () => {
    const onOpenExact = vi.fn();
    const rendered = render(
      <TrainingCrossSignalPanel
        exerciseRef={`exercise-${"a".repeat(64)}`}
        regionAccessibleName={regionAccessibleName}
        series={[series[0]]}
        sportFamily={null}
        locale="en-US"
        messages={catalogs["en-US"]}
        onOpenExact={onOpenExact}
      />,
    );
    const singleSeries = screen.getByRole("region", { name: regionAccessibleName });
    expect(within(singleSeries).getAllByRole("checkbox", { checked: true })).toHaveLength(1);
    expect(within(singleSeries).getAllByRole("img")).toHaveLength(1);

    rendered.rerender(
      <TrainingCrossSignalPanel
        exerciseRef={`exercise-${"a".repeat(64)}`}
        regionAccessibleName="Ejercicio 1 · Señales del ejercicio · Explorar señales conjuntamente"
        series={series}
        sportFamily="running"
        locale="es-ES"
        messages={catalogs["es-ES"]}
        onOpenExact={onOpenExact}
      />,
    );
    expect(screen.getByRole("region", {
      name: "Ejercicio 1 · Señales del ejercicio · Explorar señales conjuntamente",
    }))
      .toHaveTextContent("Las señales del ejercicio comparten el tiempo transcurrido");

    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: "Altitud" }));
    rendered.rerender(
      <TrainingCrossSignalPanel
        exerciseRef={`exercise-${"a".repeat(64)}`}
        regionAccessibleName="Ejercicio 1 · Señales del ejercicio · Explorar señales conjuntamente"
        series={[series[3], series[4]]}
        sportFamily="cycling"
        locale="es-ES"
        messages={catalogs["es-ES"]}
        onOpenExact={onOpenExact}
      />,
    );
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(2);
  });

  it("explains cumulative distance only when the person selects it", async () => {
    const user = userEvent.setup();
    render(
      <TrainingCrossSignalPanel
        exerciseRef={`exercise-${"a".repeat(64)}`}
        regionAccessibleName={regionAccessibleName}
        series={[series[1], series[0], cumulativeDistance]}
        sportFamily="running"
        locale="en-US"
        messages={catalogs["en-US"]}
        onOpenExact={vi.fn()}
      />,
    );

    const panel = screen.getByRole("region", { name: regionAccessibleName });
    expect(panel).not.toHaveTextContent("A running total is selected");
    await user.click(screen.getByRole("checkbox", {
      name: "Cumulative distance",
    }));
    expect(panel).toHaveTextContent(
      "A running total is selected: its rising line shows accumulated recorded distance",
    );
  });

  it("uses source ordinals only to distinguish repeated signal kinds", () => {
    render(
      <TrainingCrossSignalPanel
        exerciseRef={`exercise-${"a".repeat(64)}`}
        regionAccessibleName={regionAccessibleName}
        series={[
          signal(1, "speed", "kilometers-per-hour"),
          signal(4, "speed", "kilometers-per-hour"),
          series[0],
        ]}
        sportFamily="running"
        locale="en-US"
        messages={catalogs["en-US"]}
        onOpenExact={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("checkbox").map((choice) => choice.getAttribute("aria-label")))
      .toEqual(["Speed · series 2", "Speed · series 5", "Heart rate"]);
  });
});
