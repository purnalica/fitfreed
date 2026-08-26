import type { Locale } from "../locales/catalogs";
import {
  analyticalCoordinateFromDecimal,
  type AnalyticalChartModel,
} from "./analytical-chart";
import { AnalyticalChart } from "./AnalyticalChart";
import type { TrainingSignalVisualSample } from "./training-session-signal";

interface TrainingSignalPlotProps {
  samples: TrainingSignalVisualSample[];
  summary: string;
  accessibleDescription?: string;
  coordinateRef: string;
  seriesId: string;
  xAxisLabel: string;
  yAxisLabel: string;
  unit: string;
  locale: Locale;
  emptyMessage: string;
  noRecordedValuesMessage: string;
  loadingMessage: string;
  chartUnavailableMessage: string;
  sampleCount: number;
  lowerValuesAtTop?: boolean;
  selectedSampleOrdinal?: number | null;
  rangeSelection?: TrainingSignalPlotRangeSelection | null;
  onSelectSampleOrdinal?: (ordinal: number) => void;
}

export interface TrainingSignalPlotRangeSelection {
  startedAtSampleOrdinal: number | null;
  endedAtSampleOrdinal: number | null;
}

export interface TrainingSignalChartModelInput {
  samples: TrainingSignalVisualSample[];
  summary: string;
  accessibleDescription: string;
  coordinateRef: string;
  seriesId: string;
  xAxisLabel: string;
  yAxisLabel: string;
  unit: string;
  locale: Locale;
  lowerValuesAtTop: boolean;
  pointSelection: boolean;
  selectedSampleOrdinal: number | null;
  rangeSelection: TrainingSignalPlotRangeSelection | null;
}

function coordinateForOrdinal(
  samples: TrainingSignalVisualSample[],
  ordinal: number | null,
): number | undefined {
  if (ordinal === null) return undefined;
  const sample = samples.find((candidate) => candidate.ordinal === ordinal);
  if (!sample) return undefined;
  return analyticalCoordinateFromDecimal(sample.elapsedMilliseconds) ?? undefined;
}

export function buildTrainingSignalChartModel({
  samples,
  summary,
  accessibleDescription,
  coordinateRef,
  seriesId,
  xAxisLabel,
  yAxisLabel,
  unit,
  locale,
  lowerValuesAtTop,
  pointSelection,
  selectedSampleOrdinal,
  rangeSelection,
}: TrainingSignalChartModelInput): AnalyticalChartModel | null {
  const points = samples.map((sample) => {
    const coordinate = analyticalCoordinateFromDecimal(sample.elapsedMilliseconds);
    return coordinate === null ? null : {
      id: `sample-${sample.ordinal}`,
      coordinate,
      value: sample.value,
      gapBefore: sample.gapBefore,
    };
  });
  if (points.some((point) => point === null)) return null;
  const validPoints = points.filter((point): point is NonNullable<typeof point> => point !== null);
  const values = validPoints.flatMap((point) => point.value === null ? [] : [point.value]);
  if (validPoints.length === 0 || values.length === 0) return null;
  const coordinates = validPoints.map((point) => point.coordinate);
  const rangeStart = coordinateForOrdinal(
    samples,
    rangeSelection?.startedAtSampleOrdinal ?? null,
  );
  const rangeEnd = coordinateForOrdinal(
    samples,
    rangeSelection?.endedAtSampleOrdinal ?? null,
  );
  const selectedCoordinate = coordinateForOrdinal(samples, selectedSampleOrdinal);

  return {
    accessibleName: summary,
    accessibleDescription,
    locale,
    renderer: samples.length > 1_000 ? "canvas" : "svg",
    layout: { kind: "overlay" },
    coordinate: {
      ref: coordinateRef,
      label: xAxisLabel,
      unit: "",
      domain: {
        minimum: Math.min(...coordinates),
        maximum: Math.max(...coordinates),
      },
      format: { kind: "duration-milliseconds" },
    },
    axes: [{
      id: `${seriesId}:axis`,
      label: yAxisLabel,
      unit,
      domain: {
        minimum: Math.min(...values),
        maximum: Math.max(...values),
      },
      direction: lowerValuesAtTop ? "lower-at-top" : "higher-at-top",
      format: { kind: "number", maximumFractionDigits: 1 },
    }],
    series: [{
      id: seriesId,
      label: yAxisLabel,
      coordinateRef,
      axisId: `${seriesId}:axis`,
      points: validPoints,
    }],
    annotations: selectedCoordinate === undefined && rangeStart === undefined && rangeEnd === undefined
      ? undefined
      : {
          ...(selectedCoordinate === undefined ? {} : { selectedCoordinate }),
          ...(rangeStart === undefined && rangeEnd === undefined ? {} : {
            range: {
              ...(rangeStart === undefined ? {} : { startCoordinate: rangeStart }),
              ...(rangeEnd === undefined ? {} : { endCoordinate: rangeEnd }),
            },
          }),
        },
    interaction: {
      zoom: samples.length > 80,
      pointSelection,
    },
  };
}

export function TrainingSignalPlot({
  samples,
  summary,
  accessibleDescription = summary,
  coordinateRef,
  seriesId,
  xAxisLabel,
  yAxisLabel,
  unit,
  locale,
  emptyMessage,
  noRecordedValuesMessage,
  loadingMessage,
  chartUnavailableMessage,
  sampleCount,
  lowerValuesAtTop = false,
  selectedSampleOrdinal = null,
  rangeSelection = null,
  onSelectSampleOrdinal,
}: TrainingSignalPlotProps) {
  if (samples.length === 0) return <p>{sampleCount === 0 ? emptyMessage : noRecordedValuesMessage}</p>;
  if (!samples.some((sample) => sample.value !== null)) return <p>{noRecordedValuesMessage}</p>;

  const model = buildTrainingSignalChartModel({
    samples,
    summary,
    accessibleDescription,
    coordinateRef,
    seriesId,
    xAxisLabel,
    yAxisLabel,
    unit,
    locale,
    lowerValuesAtTop,
    pointSelection: onSelectSampleOrdinal !== undefined,
    selectedSampleOrdinal,
    rangeSelection,
  });
  if (!model) return <p role="status">{chartUnavailableMessage}</p>;

  return (
    <AnalyticalChart
      model={model}
      loadingMessage={loadingMessage}
      unavailableMessage={chartUnavailableMessage}
      onSelection={onSelectSampleOrdinal ? (selection) => {
        const point = model.series[0].points.find((candidate) => candidate.id === selection.pointId);
        if (!point) return;
        const sample = samples.find((candidate) => `sample-${candidate.ordinal}` === point.id);
        if (sample) onSelectSampleOrdinal(sample.ordinal);
      } : undefined}
    />
  );
}
