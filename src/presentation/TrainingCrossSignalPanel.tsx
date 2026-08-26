import { useEffect, useMemo, useState } from "react";

import { type catalogs, type Locale } from "../locales/catalogs";
import {
  analyticalCoordinateFromDecimal,
  type AnalyticalChartAxis,
  type AnalyticalChartModel,
  type AnalyticalChartPoint,
} from "./analytical-chart";
import { AnalyticalChart } from "./AnalyticalChart";
import {
  coordinateDecimalFormatter,
  formatExactDuration,
  integerCountFormatter,
} from "./presentation-format";
import type { TrainingSignalSeriesOverview } from "./training-session-signal";

const MIN_SELECTED_SERIES = 2;
const MAX_SELECTED_SERIES = 4;

interface TrainingCrossSignalPanelProps {
  exerciseRef: string;
  series: TrainingSignalSeriesOverview[];
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  onOpenExact: (signalRef: string, initiatingElement: HTMLButtonElement) => void;
}

interface SignalLane {
  signal: TrainingSignalSeriesOverview;
  label: string;
  unit: string;
  minimum: number;
  maximum: number;
  summary: string;
}

export interface TrainingCrossSignalChartInput {
  exerciseRef: string;
  candidates: TrainingSignalSeriesOverview[];
  selectedRefs: string[];
  locale: Locale;
  coordinateLabel: string;
  accessibleName: string;
  introduction: string;
  meaning: string;
  labelFor: (signal: TrainingSignalSeriesOverview) => string;
  unitFor: (signal: TrainingSignalSeriesOverview) => string;
  summaryFor: (
    signal: TrainingSignalSeriesOverview,
    minimum: number,
    maximum: number,
  ) => string;
}

interface TrainingCrossSignalChartProjection {
  model: AnalyticalChartModel;
  lanes: SignalLane[];
  maximumElapsedMilliseconds: number;
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

function eligibleSeries(series: TrainingSignalSeriesOverview[]) {
  return series.filter((signal) => signal.visualSamples.some((sample) => sample.value !== null));
}

function initialSelection(series: TrainingSignalSeriesOverview[]): string[] {
  return eligibleSeries(series)
    .slice(0, Math.min(3, MAX_SELECTED_SERIES))
    .map((signal) => signal.signalRef);
}

function chartPoints(signal: TrainingSignalSeriesOverview): AnalyticalChartPoint[] | null {
  const points = signal.visualSamples.map((sample) => {
    const coordinate = analyticalCoordinateFromDecimal(sample.elapsedMilliseconds);
    return coordinate === null ? null : {
      id: `${signal.signalRef}:sample-${sample.ordinal}`,
      coordinate,
      value: sample.value,
      gapBefore: sample.gapBefore,
    };
  });
  return points.some((point) => point === null)
    ? null
    : points.filter((point): point is AnalyticalChartPoint => point !== null);
}

export function buildTrainingCrossSignalChartProjection({
  exerciseRef,
  candidates,
  selectedRefs,
  locale,
  coordinateLabel,
  accessibleName,
  introduction,
  meaning,
  labelFor,
  unitFor,
  summaryFor,
}: TrainingCrossSignalChartInput): TrainingCrossSignalChartProjection | null {
  const selected = candidates.filter((signal) => selectedRefs.includes(signal.signalRef));
  if (selected.length < MIN_SELECTED_SERIES || selected.length > MAX_SELECTED_SERIES) return null;
  const role = selected[0]?.role;
  if (!role || candidates.some((signal) => signal.role !== role)) return null;

  const candidatePoints = candidates.map((signal) => chartPoints(signal));
  if (candidatePoints.some((points) => points === null)) return null;
  const allCoordinates = candidatePoints.flatMap((points) => points?.map((point) => point.coordinate) ?? []);
  if (allCoordinates.length === 0) return null;
  const maximumElapsedMilliseconds = Math.max(...allCoordinates);
  const selectedPoints = new Map(
    selected.map((signal) => [signal.signalRef, chartPoints(signal)]),
  );
  if ([...selectedPoints.values()].some((points) => points === null)) return null;

  const lanes = selected.map((signal): SignalLane | null => {
    const values = signal.visualSamples.flatMap((sample) => sample.value === null ? [] : [sample.value]);
    if (values.length === 0) return null;
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    return {
      signal,
      label: labelFor(signal),
      unit: unitFor(signal),
      minimum,
      maximum,
      summary: summaryFor(signal, minimum, maximum),
    };
  });
  if (lanes.some((lane) => lane === null)) return null;
  const validLanes = lanes.filter((lane): lane is SignalLane => lane !== null);
  const coordinateRef = `${exerciseRef}:${role}:elapsed`;
  const axes: AnalyticalChartAxis[] = validLanes.map((lane) => ({
    id: `${lane.signal.signalRef}:axis`,
    label: lane.label,
    unit: lane.unit,
    domain: { minimum: lane.minimum, maximum: lane.maximum },
    direction: "higher-at-top",
    format: { kind: "number", maximumFractionDigits: 1 },
  }));
  const pointCount = validLanes.reduce(
    (total, lane) => total + lane.signal.visualSamples.length,
    0,
  );

  return {
    lanes: validLanes,
    maximumElapsedMilliseconds,
    model: {
      accessibleName,
      accessibleDescription: [introduction, ...validLanes.map((lane) => lane.summary), meaning]
        .join(" "),
      locale,
      renderer: pointCount > 1_000 ? "canvas" : "svg",
      layout: { kind: "stacked-lanes" },
      coordinate: {
        ref: coordinateRef,
        label: coordinateLabel,
        unit: "",
        domain: { minimum: 0, maximum: maximumElapsedMilliseconds },
        format: { kind: "duration-milliseconds" },
      },
      axes,
      series: validLanes.map((lane, index) => ({
        id: lane.signal.signalRef,
        label: lane.label,
        coordinateRef,
        axisId: axes[index].id,
        points: selectedPoints.get(lane.signal.signalRef) ?? [],
      })),
      interaction: {
        zoom: validLanes.some((lane) => lane.signal.visualSamples.length > 80),
        pointSelection: false,
      },
    },
  };
}

export function TrainingCrossSignalPanel({
  exerciseRef,
  series,
  locale,
  messages,
  onOpenExact,
}: TrainingCrossSignalPanelProps) {
  const candidates = useMemo(() => eligibleSeries(series), [series]);
  const candidateSignature = candidates.map((signal) => signal.signalRef).join("|");
  const [selectedRefs, setSelectedRefs] = useState(() => initialSelection(series));
  const copy = messages.training.sessionLibrary;
  const number = useMemo(() => integerCountFormatter(locale), [locale]);
  const coordinate = useMemo(() => coordinateDecimalFormatter(locale), [locale]);

  useEffect(() => {
    setSelectedRefs(candidateSignature === ""
      ? []
      : candidateSignature.split("|").slice(0, Math.min(3, MAX_SELECTED_SERIES)));
  }, [candidateSignature]);

  if (candidates.length < MIN_SELECTED_SERIES) return null;

  function signalLabel(signal: TrainingSignalSeriesOverview): string {
    return interpolate(copy.crossSignalSeries, {
      kind: copy.signalKinds[signal.kind],
      number: number.format(signal.ordinal + 1),
    });
  }

  function toggleSignal(signalRef: string) {
    setSelectedRefs((current) => current.includes(signalRef)
      ? current.length > MIN_SELECTED_SERIES
        ? current.filter((candidate) => candidate !== signalRef)
        : current
      : current.length < MAX_SELECTED_SERIES ? [...current, signalRef] : current);
  }

  const introduction = candidates[0].role === "transition"
    ? copy.crossSignalTransitionIntro
    : copy.crossSignalPrimaryIntro;
  const projection = buildTrainingCrossSignalChartProjection({
    exerciseRef,
    candidates,
    selectedRefs,
    locale,
    coordinateLabel: copy.signalElapsed,
    accessibleName: copy.crossSignalHeading,
    introduction,
    meaning: copy.crossSignalMeaning,
    labelFor: signalLabel,
    unitFor: (signal) => copy.signalUnits[signal.unit],
    summaryFor: (signal, minimum, maximum) => interpolate(copy.crossSignalChartSummary, {
      series: signalLabel(signal),
      minimum: coordinate.format(minimum),
      maximum: coordinate.format(maximum),
      unit: copy.signalUnits[signal.unit],
    }),
  });
  const elapsedThrough = projection === null ? null : formatExactDuration(
    String(projection.maximumElapsedMilliseconds),
    locale,
    messages.training.durationUnits,
  );

  return (
    <section
      className="training-cross-signal"
      role="region"
      aria-label={copy.crossSignalHeading}
    >
      <header>
        <h6>{copy.crossSignalHeading}</h6>
        <p>{introduction}</p>
      </header>
      <fieldset className="training-cross-signal-selection">
        <legend>{copy.crossSignalSelection}</legend>
        <div>{candidates.map((signal) => {
          const selected = selectedRefs.includes(signal.signalRef);
          return (
            <label key={signal.signalRef}>
              <input
                type="checkbox"
                checked={selected}
                disabled={(selected && selectedRefs.length <= MIN_SELECTED_SERIES)
                  || (!selected && selectedRefs.length >= MAX_SELECTED_SERIES)}
                onChange={() => toggleSignal(signal.signalRef)}
              />
              <span>{signalLabel(signal)}</span>
            </label>
          );
        })}</div>
      </fieldset>
      {projection === null ? (
        <p className="analytical-chart-status" role="status">
          {copy.analyticalChartUnavailable}
        </p>
      ) : (
        <>
          <div
            className="training-cross-signal-chart"
            data-lane-count={projection.lanes.length}
          >
            <AnalyticalChart
              model={projection.model}
              loadingMessage={copy.analyticalChartLoading}
              unavailableMessage={copy.analyticalChartUnavailable}
            />
          </div>
          <div className="training-cross-signal-lanes">
            {projection.lanes.map((lane) => {
              const minimum = coordinate.format(lane.minimum);
              const maximum = coordinate.format(lane.maximum);
              return (
                <article key={lane.signal.signalRef} data-signal-ref={lane.signal.signalRef}>
                  <div className="training-cross-signal-lane-heading">
                    <div>
                      <strong>{lane.label}</strong>
                      <span>{interpolate(copy.crossSignalRange, {
                        minimum,
                        maximum,
                        unit: lane.unit,
                      })}</span>
                    </div>
                    <span>{interpolate(copy.crossSignalCoverage, {
                      available: number.format(lane.signal.availableSampleCount),
                      total: number.format(lane.signal.sampleCount),
                    })}</span>
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={(event) => onOpenExact(lane.signal.signalRef, event.currentTarget)}
                  >{interpolate(copy.crossSignalExact, { series: lane.label })}</button>
                </article>
              );
            })}
          </div>
          <p className="training-cross-signal-axis">{interpolate(copy.crossSignalAxis, {
            through: elapsedThrough ?? "",
          })}</p>
        </>
      )}
      <p className="training-cross-signal-meaning">{copy.crossSignalMeaning}</p>
    </section>
  );
}
