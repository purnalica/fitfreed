import { useEffect, useMemo, useState, type KeyboardEvent } from "react";

import { type catalogs, type Locale } from "../locales/catalogs";
import {
  analyticalCoordinateFromDecimal,
  type AnalyticalChartAxis,
  type AnalyticalChartModel,
  type AnalyticalChartPoint,
} from "./analytical-chart";
import { AnalyticalChart } from "./AnalyticalChart";
import { formatDetailDuration, integerCountFormatter } from "./presentation-format";
import {
  routePointIndexAtTimelineFraction,
  routeTimelineKeyboardSelection,
  type RouteWorkbenchModel,
  type RouteWorkbenchOverlay,
  type RouteWorkbenchOverlayValue,
} from "./route-workbench-model";
import type { SessionStoryMetric, SessionStoryRole } from "./session-story";

const MAX_VISIBLE_LANES = 4;
const DEFAULT_VISIBLE_LANES = 3;
const ZOOM_SAMPLE_THRESHOLD = 80;

interface TrainingRouteSignalLanesProps {
  model: RouteWorkbenchModel;
  role: SessionStoryRole;
  selectedPointIndex: number;
  selectedPointPosition: string;
  selectedElapsed: string;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  metricLabel: (metric: SessionStoryMetric) => string;
  metricUnit: (metric: SessionStoryMetric) => string;
  formatMetricValue: (metric: SessionStoryMetric, value: number) => string;
  onSelectPoint: (pointIndex: number) => void;
  onOpenExactSignal: (
    signalRef: string,
    sampleOrdinal: number | null,
    initiatingElement: HTMLButtonElement,
  ) => void;
}

export interface TrainingRouteSignalChartLane {
  overlay: RouteWorkbenchOverlay;
  label: string;
  unit: string;
  sourceLabel: string;
  exactSampleCount: number;
  rangeSummary: string;
}

export interface TrainingRouteSignalChartInput {
  routeModel: RouteWorkbenchModel;
  lanes: TrainingRouteSignalChartLane[];
  selectedPointIndex: number;
  locale: Locale;
  coordinateLabel: string;
  accessibleName: string;
  introduction: string;
  meaning: string;
}

export interface TrainingRouteSignalChartProjection {
  model: AnalyticalChartModel;
  maximumElapsedMilliseconds: number;
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

function visibleCandidates(model: RouteWorkbenchModel): RouteWorkbenchOverlay[] {
  return model.overlays.filter((overlay) => overlay.laneSamples.some(
    (sample) => sample.value !== null,
  ));
}

function initialLaneRefs(overlays: RouteWorkbenchOverlay[]): string[] {
  return overlays.slice(0, Math.min(DEFAULT_VISIBLE_LANES, MAX_VISIBLE_LANES))
    .map((overlay) => overlay.signalRef);
}

function exactSignalAction(
  overlay: RouteWorkbenchOverlay,
  sourceLabel: string,
  copy: (typeof catalogs)["en-US"]["training"]["sessionLibrary"]["routeWorkbench"],
  metricLabel: (metric: SessionStoryMetric) => string,
): string {
  const metric = metricLabel(overlay.metric);
  if (metric === sourceLabel) {
    return interpolate(copy.exactSignal, { signal: sourceLabel });
  }
  return interpolate(copy.exactOverlaySignal, {
    metric,
    signal: sourceLabel,
  });
}

function selectedValue(
  overlay: RouteWorkbenchOverlay,
  model: RouteWorkbenchModel,
  selectedPointIndex: number,
): RouteWorkbenchOverlayValue | undefined {
  return overlay.valuesByRouteOrdinal.get(
    model.points[selectedPointIndex].source.ordinal,
  );
}

function axisFormat(metric: SessionStoryMetric): AnalyticalChartAxis["format"] {
  if (metric === "pace") return { kind: "pace-minutes" };
  if (metric === "heart-rate" || metric === "cadence"
    || metric === "stroke-rate" || metric === "power") {
    return { kind: "number", maximumFractionDigits: 0 };
  }
  return { kind: "number", maximumFractionDigits: 1 };
}

function analyticalPoints(
  lane: TrainingRouteSignalChartLane,
): AnalyticalChartPoint[] | null {
  const points = lane.overlay.laneSamples.map((sample) => {
    const coordinate = analyticalCoordinateFromDecimal(sample.elapsedMilliseconds);
    return coordinate === null ? null : {
      id: `${lane.overlay.signalRef}:sample-${sample.signalSampleOrdinal}`,
      coordinate,
      value: sample.value,
      gapBefore: sample.gapBefore,
    };
  });
  return points.some((point) => point === null)
    ? null
    : points.filter((point): point is AnalyticalChartPoint => point !== null);
}

export function buildTrainingRouteSignalChartProjection({
  routeModel,
  lanes,
  selectedPointIndex,
  locale,
  coordinateLabel,
  accessibleName,
  introduction,
  meaning,
}: TrainingRouteSignalChartInput): TrainingRouteSignalChartProjection | null {
  if (lanes.length < 1 || lanes.length > MAX_VISIBLE_LANES
    || routeModel.maximumElapsedMilliseconds === null) return null;
  const maximumElapsedMilliseconds = analyticalCoordinateFromDecimal(
    routeModel.maximumElapsedMilliseconds,
  );
  if (maximumElapsedMilliseconds === null) return null;
  const points = lanes.map(analyticalPoints);
  if (points.some((lanePoints) => lanePoints === null)) return null;
  const selectedElapsed = routeModel.points[selectedPointIndex]?.source.elapsedMilliseconds;
  const selectedCoordinate = selectedElapsed === null || selectedElapsed === undefined
    ? undefined
    : analyticalCoordinateFromDecimal(selectedElapsed) ?? undefined;
  const coordinateRef = `${routeModel.routeRef}:elapsed`;
  const axes: AnalyticalChartAxis[] = lanes.flatMap((lane) => (
    lane.overlay.laneMinimum === null || lane.overlay.laneMaximum === null
      ? []
      : [{
          id: `${lane.overlay.signalRef}:axis`,
          label: lane.label,
          unit: lane.unit,
          domain: {
            minimum: lane.overlay.laneMinimum,
            maximum: lane.overlay.laneMaximum,
          },
          direction: lane.overlay.metric === "pace" ? "lower-at-top" : "higher-at-top",
          format: axisFormat(lane.overlay.metric),
        }]
  ));
  if (axes.length !== lanes.length) return null;
  const pointCount = points.reduce(
    (total, lanePoints) => total + (lanePoints?.length ?? 0),
    0,
  );

  return {
    maximumElapsedMilliseconds,
    model: {
      accessibleName,
      accessibleDescription: [
        introduction,
        ...lanes.map((lane) => `${lane.label}. ${lane.rangeSummary}`),
        meaning,
      ].join(" "),
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
      series: lanes.map((lane, index) => ({
        id: lane.overlay.signalRef,
        label: lane.label,
        coordinateRef,
        axisId: axes[index].id,
        points: points[index] ?? [],
      })),
      ...(selectedCoordinate === undefined
        ? {}
        : { annotations: { selectedCoordinate } }),
      interaction: {
        zoom: lanes.some(
          (lane) => lane.overlay.laneSamples.length > ZOOM_SAMPLE_THRESHOLD,
        ),
        pointSelection: true,
      },
    },
  };
}

export function TrainingRouteSignalLanes({
  model,
  role,
  selectedPointIndex,
  selectedPointPosition,
  selectedElapsed,
  locale,
  messages,
  metricLabel,
  metricUnit,
  formatMetricValue,
  onSelectPoint,
  onOpenExactSignal,
}: TrainingRouteSignalLanesProps) {
  const candidates = useMemo(() => visibleCandidates(model), [model]);
  const candidateSignature = candidates.map((overlay) => overlay.signalRef).join("|");
  const [selectedRefs, setSelectedRefs] = useState(() => initialLaneRefs(candidates));
  const copy = messages.training.sessionLibrary.routeWorkbench;
  const sessionCopy = messages.training.sessionLibrary;
  const signalCopy = sessionCopy.signalKinds;
  const number = useMemo(() => integerCountFormatter(locale), [locale]);

  useEffect(() => {
    setSelectedRefs(initialLaneRefs(candidates));
  }, [candidateSignature]);

  if (candidates.length === 0
    || model.elapsedPointIndexes.length === 0
    || model.maximumElapsedMilliseconds === null) return null;

  function sourceSeries(overlay: RouteWorkbenchOverlay) {
    return role.signals.find((signal) => signal.signalRef === overlay.signalRef);
  }

  function laneLabel(overlay: RouteWorkbenchOverlay): string {
    const sameMetricCount = candidates.filter(
      (candidate) => candidate.metric === overlay.metric,
    ).length;
    const signal = sourceSeries(overlay);
    if (sameMetricCount < 2 || !signal) return metricLabel(overlay.metric);
    return interpolate(copy.signalLaneIdentity, {
      metric: metricLabel(overlay.metric),
      signal: signalCopy[signal.kind],
      number: number.format(signal.ordinal + 1),
    });
  }

  function toggleLane(signalRef: string) {
    setSelectedRefs((current) => current.includes(signalRef)
      ? current.length === 1 ? current : current.filter((candidate) => candidate !== signalRef)
      : current.length >= MAX_VISIBLE_LANES ? current : [...current, signalRef]);
  }

  function selectFromKeyboard(event: KeyboardEvent<HTMLInputElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = routeTimelineKeyboardSelection(model, selectedPointIndex, event.key);
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectPoint(next);
  }

  const lanes: TrainingRouteSignalChartLane[] = candidates.flatMap((overlay) => {
    if (!selectedRefs.includes(overlay.signalRef)) return [];
    const exactSignal = role.exactSignals.find(
      (signal) => signal.signalRef === overlay.signalRef,
    );
    if (!exactSignal) return [];
    const rangeSummary = overlay.laneMinimum === null || overlay.laneMaximum === null
      ? copy.overlayUnavailable
      : interpolate(copy.overlayRange, {
          minimum: formatMetricValue(overlay.metric, overlay.laneMinimum),
          maximum: formatMetricValue(overlay.metric, overlay.laneMaximum),
        });
    return [{
      overlay,
      label: laneLabel(overlay),
      unit: metricUnit(overlay.metric),
      sourceLabel: signalCopy[exactSignal.kind],
      exactSampleCount: exactSignal.sampleCount,
      rangeSummary,
    }];
  });
  if (lanes.length === 0) return null;

  const projection = buildTrainingRouteSignalChartProjection({
    routeModel: model,
    lanes,
    selectedPointIndex,
    locale,
    coordinateLabel: sessionCopy.signalElapsed,
    accessibleName: copy.signalLanesHeading,
    introduction: copy.signalLanesIntroduction,
    meaning: copy.signalLanesMeaning,
  });
  const selectedLaneValues = lanes.map((lane) => {
    const value = selectedValue(lane.overlay, model, selectedPointIndex);
    const formatted = value?.value === null || value === undefined
      ? interpolate(copy.noMetricAtPosition, {
          metric: metricLabel(lane.overlay.metric).toLocaleLowerCase(locale),
        })
      : formatMetricValue(lane.overlay.metric, value.value);
    return { lane, value, formatted };
  });
  const positionValueText = [
    selectedPointPosition,
    selectedElapsed,
    ...selectedLaneValues.map(({ lane, formatted }) => `${lane.label}: ${formatted}`),
  ].join(" · ");

  return (
    <section
      className="training-route-signal-lanes"
      role="region"
      aria-label={copy.signalLanesRegion}
    >
      <header>
        <div>
          <h5>{copy.signalLanesHeading}</h5>
          <p>{copy.signalLanesIntroduction}</p>
        </div>
        <span>{interpolate(copy.signalLanesAxis, {
          through: formatDetailDuration(
            model.maximumElapsedMilliseconds,
            locale,
            messages.training.durationUnits,
          ),
        })}</span>
      </header>
      {candidates.length > DEFAULT_VISIBLE_LANES && (
        <fieldset className="training-route-signal-lane-selection">
          <legend>{copy.visibleMeasurements}</legend>
          <div>{candidates.map((overlay) => {
            const checked = selectedRefs.includes(overlay.signalRef);
            return (
              <label key={overlay.signalRef}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={(checked && selectedRefs.length === 1)
                    || (!checked && selectedRefs.length >= MAX_VISIBLE_LANES)}
                  onChange={() => toggleLane(overlay.signalRef)}
                />
                <span>{laneLabel(overlay)}</span>
              </label>
            );
          })}</div>
        </fieldset>
      )}
      {projection === null ? (
        <p className="analytical-chart-status" role="status">
          {sessionCopy.analyticalChartUnavailable}
        </p>
      ) : (
        <div
          className="training-route-signal-chart"
          data-lane-count={lanes.length}
        >
          <AnalyticalChart
            model={projection.model}
            loadingMessage={sessionCopy.analyticalChartLoading}
            unavailableMessage={sessionCopy.analyticalChartUnavailable}
            onSelection={(selection) => onSelectPoint(routePointIndexAtTimelineFraction(
              model,
              projection.maximumElapsedMilliseconds === 0
                ? 0
                : selection.coordinate / projection.maximumElapsedMilliseconds,
            ))}
          />
        </div>
      )}
      <label className="training-route-signal-position-control">
        <span>{copy.signalChartPosition}</span>
        <input
          type="range"
          min="1"
          max={model.points.length}
          step="1"
          value={selectedPointIndex + 1}
          aria-valuemin={1}
          aria-valuemax={model.points.length}
          aria-valuenow={selectedPointIndex + 1}
          aria-valuetext={positionValueText}
          aria-describedby="training-route-signal-position-instructions"
          onKeyDown={selectFromKeyboard}
          onChange={(event) => onSelectPoint(Number(event.target.value) - 1)}
        />
      </label>
      <p id="training-route-signal-position-instructions" className="sr-only">
        {copy.signalLaneInstructions}
      </p>
      <div className="training-route-signal-lane-list">
        {selectedLaneValues.map(({ lane, value, formatted }) => (
          <article key={lane.overlay.signalRef} data-signal-ref={lane.overlay.signalRef}>
            <div className="training-route-signal-lane-heading">
              <div>
                <h6>{lane.label}</h6>
                <span>{lane.rangeSummary}</span>
              </div>
              <div>
                <span>{interpolate(copy.signalLaneAlignment, {
                  count: number.format(lane.overlay.samples.length),
                })}</span>
                <span>{interpolate(copy.signalLaneSource, {
                  signal: lane.sourceLabel,
                  count: number.format(lane.exactSampleCount),
                })}</span>
              </div>
            </div>
            <footer>
              <strong aria-live="polite">{formatted}</strong>
              <button
                type="button"
                className="secondary"
                onClick={(event) => onOpenExactSignal(
                  lane.overlay.signalRef,
                  value?.signalSampleOrdinal ?? null,
                  event.currentTarget,
                )}
              >{exactSignalAction(lane.overlay, lane.sourceLabel, copy, metricLabel)}</button>
            </footer>
          </article>
        ))}
      </div>
      <p className="training-route-signal-lanes-meaning">{copy.signalLanesMeaning}</p>
    </section>
  );
}
