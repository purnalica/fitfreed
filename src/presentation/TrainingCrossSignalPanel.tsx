import { useEffect, useMemo, useState } from "react";

import { type catalogs, type Locale } from "../locales/catalogs";
import { formatDuration } from "./training-format";
import type {
  TrainingSignalSeriesOverview,
  TrainingSignalVisualSample,
} from "./training-session-signal";

const MIN_SELECTED_SERIES = 2;
const MAX_SELECTED_SERIES = 4;

interface TrainingCrossSignalPanelProps {
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
  segments: string[];
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

function maximumElapsedMilliseconds(series: TrainingSignalSeriesOverview[]): bigint {
  return series.reduce((maximum, signal) => signal.visualSamples.reduce(
    (signalMaximum, sample) => {
      const elapsed = BigInt(sample.elapsedMilliseconds);
      return elapsed > signalMaximum ? elapsed : signalMaximum;
    }, maximum,
  ), 0n);
}

function elapsedX(value: string, maximum: bigint): number {
  if (maximum === 0n) return 36;
  const hundredths = BigInt(value) * 56_800n / maximum;
  return 36 + Number(hundredths) / 100;
}

function laneSegments(
  samples: TrainingSignalVisualSample[],
  minimum: number,
  maximum: number,
  maximumElapsed: bigint,
): string[] {
  const valueSpan = maximum - minimum;
  const segments: string[] = [];
  let current: string[] = [];
  samples.forEach((sample) => {
    if (sample.value === null || sample.gapBefore) {
      if (current.length > 0) segments.push(current.join(" "));
      current = [];
    }
    if (sample.value === null) return;
    const x = elapsedX(sample.elapsedMilliseconds, maximumElapsed);
    const y = valueSpan === 0 ? 50 : 12 + (maximum - sample.value) / valueSpan * 76;
    current.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  });
  if (current.length > 0) segments.push(current.join(" "));
  return segments;
}

export function TrainingCrossSignalPanel({
  series,
  locale,
  messages,
  onOpenExact,
}: TrainingCrossSignalPanelProps) {
  const candidates = useMemo(() => eligibleSeries(series), [series]);
  const candidateSignature = candidates.map((signal) => signal.signalRef).join("|");
  const [selectedRefs, setSelectedRefs] = useState(() => initialSelection(series));
  const copy = messages.training.sessionLibrary;
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const coordinate = useMemo(() => new Intl.NumberFormat(locale, {
    useGrouping: false,
    maximumSignificantDigits: 17,
  }), [locale]);
  const maximumElapsed = useMemo(() => maximumElapsedMilliseconds(candidates), [candidates]);

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

  const lanes: SignalLane[] = candidates.flatMap((signal) => {
    if (!selectedRefs.includes(signal.signalRef)) return [];
    const values = signal.visualSamples
      .map((sample) => sample.value)
      .filter((value): value is number => value !== null);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    return [{
      signal,
      label: signalLabel(signal),
      unit: copy.signalUnits[signal.unit],
      minimum,
      maximum,
      segments: laneSegments(
        signal.visualSamples,
        minimum,
        maximum,
        maximumElapsed,
      ),
    }];
  });
  const introduction = candidates[0].role === "transition"
    ? copy.crossSignalTransitionIntro
    : copy.crossSignalPrimaryIntro;
  const elapsedThrough = formatDuration(
    maximumElapsed.toString(),
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
      <div className="training-cross-signal-lanes">
        {lanes.map((lane) => {
          const minimum = coordinate.format(lane.minimum);
          const maximum = coordinate.format(lane.maximum);
          const range = interpolate(copy.crossSignalRange, {
            minimum,
            maximum,
            unit: lane.unit,
          });
          const summary = interpolate(copy.crossSignalChartSummary, {
            series: lane.label,
            minimum,
            maximum,
            unit: lane.unit,
          });
          return (
            <article key={lane.signal.signalRef} data-signal-ref={lane.signal.signalRef}>
              <div className="training-cross-signal-lane-heading">
                <div>
                  <strong>{lane.label}</strong>
                  <span>{range}</span>
                </div>
                <span>{interpolate(copy.crossSignalCoverage, {
                  available: number.format(lane.signal.availableSampleCount),
                  total: number.format(lane.signal.sampleCount),
                })}</span>
              </div>
              <svg viewBox="0 0 640 100" role="img" aria-label={summary}>
                <title>{summary}</title>
                <rect x="1" y="1" width="638" height="98" rx="12" />
                {lane.segments.map((points, index) => points.includes(" ")
                  ? <polyline key={`${lane.signal.signalRef}-${index}`} points={points} />
                  : (() => {
                    const [cx, cy] = points.split(",");
                    return <circle
                      key={`${lane.signal.signalRef}-${index}`}
                      cx={cx}
                      cy={cy}
                      r="4"
                    />;
                  })())}
              </svg>
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
        through: elapsedThrough,
      })}</p>
      <p className="training-cross-signal-meaning">{copy.crossSignalMeaning}</p>
    </section>
  );
}
