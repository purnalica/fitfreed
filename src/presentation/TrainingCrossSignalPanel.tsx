import { useCallback, useEffect, useMemo, useState } from "react";

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
import type { SportFamily } from "./training-sports";

const MIN_SELECTED_SERIES = 1;
const MAX_SELECTED_SERIES = 4;
const DEFAULT_SELECTED_SERIES = 2;

const genericSignalRelevance: TrainingSignalSeriesOverview["kind"][] = [
  "speed",
  "heart-rate",
  "cadence",
  "left-crank-power",
  "altitude",
  "temperature",
  "distance",
];

const sportSignalRelevance: Partial<Record<
  SportFamily,
  TrainingSignalSeriesOverview["kind"][]
>> = {
  cycling: [
    "speed",
    "heart-rate",
    "left-crank-power",
    "cadence",
    "altitude",
    "temperature",
    "distance",
  ],
  strength: [
    "heart-rate",
    "left-crank-power",
    "cadence",
    "speed",
    "temperature",
    "altitude",
    "distance",
  ],
  mobility: [
    "heart-rate",
    "cadence",
    "temperature",
    "speed",
    "altitude",
    "left-crank-power",
    "distance",
  ],
  swimming: [
    "speed",
    "heart-rate",
    "cadence",
    "temperature",
    "altitude",
    "left-crank-power",
    "distance",
  ],
  "water-sport": [
    "speed",
    "heart-rate",
    "cadence",
    "temperature",
    "altitude",
    "left-crank-power",
    "distance",
  ],
};

const lanePatterns = ["solid", "dashed", "dotted", "dash-dot"] as const;

interface TrainingCrossSignalPanelProps {
  exerciseRef: string;
  regionAccessibleName: string;
  series: TrainingSignalSeriesOverview[];
  sportFamily: SportFamily | null;
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

interface PreparedSignalProjection {
  signal: TrainingSignalSeriesOverview;
  points: AnalyticalChartPoint[];
  minimum: number;
  maximum: number;
  maximumElapsedMilliseconds: number;
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

function eligibleSeries(
  series: TrainingSignalSeriesOverview[],
  sportFamily: SportFamily | null,
) {
  const relevance = sportFamily === null
    ? genericSignalRelevance
    : sportSignalRelevance[sportFamily] ?? genericSignalRelevance;
  return [...series
    .filter((signal) => signal.visualSamples.some((sample) => sample.value !== null))]
    .sort((left, right) => {
      const rank = relevance.indexOf(left.kind) - relevance.indexOf(right.kind);
      return rank === 0 ? left.ordinal - right.ordinal : rank;
    });
}

function initialSelection(series: TrainingSignalSeriesOverview[]): string[] {
  const speed = series.find((signal) => signal.kind === "speed");
  const heartRate = series.find((signal) => signal.kind === "heart-rate");
  if (speed && heartRate) return [speed.signalRef, heartRate.signalRef];
  const nonCumulative = series.filter((signal) => signal.kind !== "distance");
  return (nonCumulative.length === 0 ? series : nonCumulative)
    .slice(0, DEFAULT_SELECTED_SERIES)
    .map((signal) => signal.signalRef);
}

function prepareSignalProjection(
  signal: TrainingSignalSeriesOverview,
): PreparedSignalProjection | null {
  const points: AnalyticalChartPoint[] = [];
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  let maximumElapsedMilliseconds = Number.NEGATIVE_INFINITY;
  for (const sample of signal.visualSamples) {
    const coordinate = analyticalCoordinateFromDecimal(sample.elapsedMilliseconds);
    if (coordinate === null) return null;
    points.push({
      id: `${signal.signalRef}:sample-${sample.ordinal}`,
      coordinate,
      value: sample.value,
      gapBefore: sample.gapBefore,
    });
    maximumElapsedMilliseconds = Math.max(maximumElapsedMilliseconds, coordinate);
    if (sample.value !== null) {
      minimum = Math.min(minimum, sample.value);
      maximum = Math.max(maximum, sample.value);
    }
  }
  return points.length === 0
    || !Number.isFinite(minimum)
    || !Number.isFinite(maximum)
    || !Number.isFinite(maximumElapsedMilliseconds)
    ? null
    : { signal, points, minimum, maximum, maximumElapsedMilliseconds };
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

  const prepared = candidates.map(prepareSignalProjection);
  if (prepared.some((projection) => projection === null)) return null;
  const validPrepared = prepared.filter(
    (projection): projection is PreparedSignalProjection => projection !== null,
  );
  const preparedByRef = new Map(
    validPrepared.map((projection) => [projection.signal.signalRef, projection]),
  );
  const maximumElapsedMilliseconds = Math.max(
    ...validPrepared.map((projection) => projection.maximumElapsedMilliseconds),
  );

  const lanes = selected.map((signal): SignalLane | null => {
    const preparedSignal = preparedByRef.get(signal.signalRef);
    if (!preparedSignal) return null;
    const { minimum, maximum } = preparedSignal;
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
        points: preparedByRef.get(lane.signal.signalRef)?.points ?? [],
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
  regionAccessibleName,
  series,
  sportFamily,
  locale,
  messages,
  onOpenExact,
}: TrainingCrossSignalPanelProps) {
  const candidates = useMemo(
    () => eligibleSeries(series, sportFamily),
    [series, sportFamily],
  );
  const candidateSignature = candidates.map((signal) => signal.signalRef).join("|");
  const [selectedRefs, setSelectedRefs] = useState(() => initialSelection(candidates));
  const copy = messages.training.sessionLibrary;
  const number = useMemo(() => integerCountFormatter(locale), [locale]);
  const coordinate = useMemo(() => coordinateDecimalFormatter(locale), [locale]);
  const candidateKindCounts = useMemo(() => candidates.reduce(
    (counts, signal) => counts.set(signal.kind, (counts.get(signal.kind) ?? 0) + 1),
    new Map<TrainingSignalSeriesOverview["kind"], number>(),
  ), [candidates]);

  useEffect(() => {
    setSelectedRefs(initialSelection(candidates));
  }, [candidateSignature]);

  const signalLabel = useCallback((signal: TrainingSignalSeriesOverview): string => {
    const kind = signal.kind === "distance"
      ? copy.crossSignalCumulativeDistance
      : copy.signalKinds[signal.kind];
    return (candidateKindCounts.get(signal.kind) ?? 0) > 1
      ? interpolate(copy.crossSignalSeries, {
          kind,
          number: number.format(signal.ordinal + 1),
        })
      : kind;
  }, [candidateKindCounts, copy, number]);

  function toggleSignal(signalRef: string) {
    setSelectedRefs((current) => current.includes(signalRef)
      ? current.length > MIN_SELECTED_SERIES
        ? current.filter((candidate) => candidate !== signalRef)
        : current
      : current.length < MAX_SELECTED_SERIES ? [...current, signalRef] : current);
  }

  const introduction = candidates[0]?.role === "transition"
    ? copy.crossSignalTransitionIntro
    : copy.crossSignalPrimaryIntro;
  const projection = useMemo(() => buildTrainingCrossSignalChartProjection({
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
    }), [
      candidates,
      coordinate,
      copy,
      exerciseRef,
      introduction,
      locale,
      selectedRefs,
      signalLabel,
    ]);
  if (candidates.length === 0) return null;
  const elapsedThrough = projection === null ? null : formatExactDuration(
    String(projection.maximumElapsedMilliseconds),
    locale,
    messages.training.durationUnits,
  );

  return (
    <section
      className="training-cross-signal"
      role="region"
      aria-label={regionAccessibleName}
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
                aria-label={signalLabel(signal)}
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
      {selectedRefs.some((selectedRef) => candidates.some(
        (signal) => signal.signalRef === selectedRef && signal.kind === "distance",
      )) && (
        <p className="training-cross-signal-cumulative">
          {copy.crossSignalCumulativeMeaning}
        </p>
      )}
      {projection === null ? (
        <p className="analytical-chart-status" role="status">
          {copy.analyticalChartUnavailable}
        </p>
      ) : (
        <>
          <div
            className="training-cross-signal-lanes"
            data-lane-count={projection.lanes.length}
          >
            {projection.lanes.map((lane, index) => {
              const minimum = coordinate.format(lane.minimum);
              const maximum = coordinate.format(lane.maximum);
              return (
                <article key={lane.signal.signalRef} data-signal-ref={lane.signal.signalRef}>
                  <div className="training-cross-signal-lane-heading">
                    <span
                      className="training-cross-signal-line-key"
                      data-pattern={lanePatterns[index]}
                      aria-hidden="true"
                    />
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
          <p className="training-cross-signal-axis">{interpolate(copy.crossSignalAxis, {
            through: elapsedThrough ?? "",
          })}</p>
        </>
      )}
      <p className="training-cross-signal-meaning">{copy.crossSignalMeaning}</p>
    </section>
  );
}
