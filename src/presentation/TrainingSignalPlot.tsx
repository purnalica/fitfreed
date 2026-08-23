import type { TrainingSignalVisualSample } from "./training-session-signal";

interface TrainingSignalPlotProps {
  samples: TrainingSignalVisualSample[];
  summary: string;
  emptyMessage: string;
  noRecordedValuesMessage: string;
  sampleCount: number;
  lowerValuesAtTop?: boolean;
  selectedSampleOrdinal?: number | null;
  rangeSelection?: TrainingSignalPlotRangeSelection | null;
}

export interface TrainingSignalPlotRangeSelection {
  startedAtSampleOrdinal: number | null;
  endedAtSampleOrdinal: number | null;
}

function sampleX(samples: TrainingSignalVisualSample[], ordinal: number | null): number | null {
  if (ordinal === null || !samples.some((sample) => sample.ordinal === ordinal)) return null;
  const ordinals = samples.map((sample) => sample.ordinal);
  const minimumOrdinal = Math.min(...ordinals);
  const maximumOrdinal = Math.max(...ordinals);
  const ordinalSpan = maximumOrdinal - minimumOrdinal;
  return ordinalSpan === 0 ? 320 : 36 + (ordinal - minimumOrdinal) / ordinalSpan * 568;
}

function signalSvgSegments(
  samples: TrainingSignalVisualSample[],
  lowerValuesAtTop: boolean,
): string[] {
  const available = samples.filter(
    (sample): sample is TrainingSignalVisualSample & { value: number } => sample.value !== null,
  );
  if (available.length === 0) return [];
  const ordinals = samples.map((sample) => sample.ordinal);
  const values = available.map((sample) => sample.value);
  const minimumOrdinal = Math.min(...ordinals);
  const maximumOrdinal = Math.max(...ordinals);
  const minimumValue = Math.min(...values);
  const maximumValue = Math.max(...values);
  const ordinalSpan = maximumOrdinal - minimumOrdinal;
  const valueSpan = maximumValue - minimumValue;
  const segments: string[] = [];
  let current: string[] = [];
  samples.forEach((sample) => {
    if (sample.value === null || sample.gapBefore) {
      if (current.length > 0) segments.push(current.join(" "));
      current = [];
    }
    if (sample.value === null) return;
    const x = ordinalSpan === 0
      ? 320
      : 36 + (sample.ordinal - minimumOrdinal) / ordinalSpan * 568;
    const y = valueSpan === 0 ? 140 : lowerValuesAtTop
      ? 20 + (sample.value - minimumValue) / valueSpan * 240
      : 20 + (maximumValue - sample.value) / valueSpan * 240;
    current.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  });
  if (current.length > 0) segments.push(current.join(" "));
  return segments;
}

export function TrainingSignalPlot({
  samples,
  summary,
  emptyMessage,
  noRecordedValuesMessage,
  sampleCount,
  lowerValuesAtTop = false,
  selectedSampleOrdinal = null,
  rangeSelection = null,
}: TrainingSignalPlotProps) {
  const segments = signalSvgSegments(samples, lowerValuesAtTop);

  if (samples.length === 0 || segments.length === 0) {
    return <p>{sampleCount === 0 ? emptyMessage : noRecordedValuesMessage}</p>;
  }

  const selectedX = sampleX(samples, selectedSampleOrdinal);
  const rangeStartX = sampleX(samples, rangeSelection?.startedAtSampleOrdinal ?? null);
  const rangeEndX = sampleX(samples, rangeSelection?.endedAtSampleOrdinal ?? null);
  const rangeLeft = rangeStartX !== null && rangeEndX !== null
    ? Math.min(rangeStartX, rangeEndX)
    : null;
  const rangeWidth = rangeStartX !== null && rangeEndX !== null
    ? Math.abs(rangeEndX - rangeStartX)
    : null;

  return (
    <svg viewBox="0 0 640 280" role="img" aria-label={summary}>
      <title>{summary}</title>
      <rect x="1" y="1" width="638" height="278" rx="18" />
      {rangeLeft !== null && rangeWidth !== null && (
        <rect
          className="training-signal-range-band"
          x={rangeLeft}
          y="2"
          width={Math.max(rangeWidth, 2)}
          height="276"
        />
      )}
      {segments.map((points, index) => points.includes(" ")
        ? <polyline key={index} points={points} />
        : (() => {
          const [cx, cy] = points.split(",");
          return <circle key={index} cx={cx} cy={cy} r="4" />;
        })())}
      {rangeStartX !== null && (
        <line
          className="training-signal-range-start"
          x1={rangeStartX}
          x2={rangeStartX}
          y1="2"
          y2="278"
        />
      )}
      {rangeEndX !== null && (
        <line
          className="training-signal-range-end"
          x1={rangeEndX}
          x2={rangeEndX}
          y1="2"
          y2="278"
        />
      )}
      {selectedX !== null && (
        <line
          className="training-signal-selected-sample"
          x1={selectedX}
          x2={selectedX}
          y1="2"
          y2="278"
        />
      )}
    </svg>
  );
}
