import type { TrainingSignalVisualSample } from "./training-session-signal";

interface TrainingSignalPlotProps {
  samples: TrainingSignalVisualSample[];
  summary: string;
  emptyMessage: string;
  noRecordedValuesMessage: string;
  sampleCount: number;
  lowerValuesAtTop?: boolean;
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
}: TrainingSignalPlotProps) {
  const segments = signalSvgSegments(samples, lowerValuesAtTop);

  if (samples.length === 0 || segments.length === 0) {
    return <p>{sampleCount === 0 ? emptyMessage : noRecordedValuesMessage}</p>;
  }

  return (
    <svg viewBox="0 0 640 280" role="img" aria-label={summary}>
      <title>{summary}</title>
      <rect x="1" y="1" width="638" height="278" rx="18" />
      {segments.map((points, index) => points.includes(" ")
        ? <polyline key={index} points={points} />
        : (() => {
          const [cx, cy] = points.split(",");
          return <circle key={index} cx={cx} cy={cy} r="4" />;
        })())}
    </svg>
  );
}
