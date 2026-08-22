import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";

import { type catalogs, type Locale } from "../locales/catalogs";
import {
  routePointIndexAtTimelineFraction,
  routeTimelineKeyboardSelection,
  routeTimelinePosition,
  routeTimelinePositionForElapsed,
  type RouteWorkbenchModel,
  type RouteWorkbenchOverlay,
  type RouteWorkbenchOverlayValue,
} from "./route-workbench-model";
import type { SessionStoryMetric, SessionStoryRole } from "./session-story";
import { formatDuration } from "./training-format";

const MAX_VISIBLE_LANES = 4;
const DEFAULT_VISIBLE_LANES = 3;
const SVG_LEFT = 20;
const SVG_WIDTH = 960;
const SVG_TOP = 14;
const SVG_HEIGHT = 76;

interface TrainingRouteSignalLanesProps {
  model: RouteWorkbenchModel;
  role: SessionStoryRole;
  selectedPointIndex: number;
  selectedPointPosition: string;
  selectedElapsed: string;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  metricLabel: (metric: SessionStoryMetric) => string;
  formatMetricValue: (metric: SessionStoryMetric, value: number) => string;
  onSelectPoint: (pointIndex: number) => void;
  onOpenExactSignal: (
    signalRef: string,
    sampleOrdinal: number | null,
    initiatingElement: HTMLButtonElement,
  ) => void;
}

interface LaneView {
  overlay: RouteWorkbenchOverlay;
  label: string;
  sourceLabel: string;
  exactSampleCount: number;
  segments: string[];
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

function laneSegments(
  model: RouteWorkbenchModel,
  overlay: RouteWorkbenchOverlay,
): string[] {
  if (overlay.laneMinimum === null || overlay.laneMaximum === null) return [];
  const laneMaximum = overlay.laneMaximum;
  const valueSpan = laneMaximum - overlay.laneMinimum;
  const segments: string[] = [];
  let current: string[] = [];
  overlay.laneSamples.forEach((sample) => {
    if (sample.value === null || sample.gapBefore) {
      if (current.length > 0) segments.push(current.join(" "));
      current = [];
    }
    if (sample.value === null) return;
    const timelinePosition = routeTimelinePositionForElapsed(
      model,
      sample.elapsedMilliseconds,
    );
    if (timelinePosition === null) return;
    const x = SVG_LEFT + timelinePosition * SVG_WIDTH;
    const y = valueSpan === 0
      ? SVG_TOP + SVG_HEIGHT / 2
      : SVG_TOP + (laneMaximum - sample.value) / valueSpan * SVG_HEIGHT;
    current.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  });
  if (current.length > 0) segments.push(current.join(" "));
  return segments;
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

export function TrainingRouteSignalLanes({
  model,
  role,
  selectedPointIndex,
  selectedPointPosition,
  selectedElapsed,
  locale,
  messages,
  metricLabel,
  formatMetricValue,
  onSelectPoint,
  onOpenExactSignal,
}: TrainingRouteSignalLanesProps) {
  const candidates = useMemo(() => visibleCandidates(model), [model]);
  const candidateSignature = candidates.map((overlay) => overlay.signalRef).join("|");
  const [selectedRefs, setSelectedRefs] = useState(() => initialLaneRefs(candidates));
  const copy = messages.training.sessionLibrary.routeWorkbench;
  const signalCopy = messages.training.sessionLibrary.signalKinds;
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);

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

  function selectFromPointer(event: MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) return;
    onSelectPoint(routePointIndexAtTimelineFraction(
      model,
      (event.clientX - bounds.left) / bounds.width,
    ));
  }

  function selectFromKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = routeTimelineKeyboardSelection(model, selectedPointIndex, event.key);
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectPoint(next);
  }

  const lanes: LaneView[] = candidates.flatMap((overlay) => {
    if (!selectedRefs.includes(overlay.signalRef)) return [];
    const exactSignal = role.exactSignals.find(
      (signal) => signal.signalRef === overlay.signalRef,
    );
    if (!exactSignal) return [];
    return [{
      overlay,
      label: laneLabel(overlay),
      sourceLabel: signalCopy[exactSignal.kind],
      exactSampleCount: exactSignal.sampleCount,
      segments: laneSegments(model, overlay),
    }];
  });
  const selectedTimelinePosition = routeTimelinePosition(model, selectedPointIndex);

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
          through: formatDuration(
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
      <div className="training-route-signal-lane-list">
        {lanes.map((lane) => {
          const value = selectedValue(lane.overlay, model, selectedPointIndex);
          const formattedValue = value?.value === null || value === undefined
            ? interpolate(copy.noMetricAtPosition, {
              metric: metricLabel(lane.overlay.metric).toLocaleLowerCase(locale),
            })
            : formatMetricValue(lane.overlay.metric, value.value);
          const range = lane.overlay.laneMinimum === null || lane.overlay.laneMaximum === null
            ? copy.overlayUnavailable
            : interpolate(copy.overlayRange, {
              minimum: formatMetricValue(lane.overlay.metric, lane.overlay.laneMinimum),
              maximum: formatMetricValue(lane.overlay.metric, lane.overlay.laneMaximum),
            });
          const laneValueText = `${selectedPointPosition} · ${selectedElapsed} · ${formattedValue}`;
          const selectedX = selectedTimelinePosition === null
            ? null
            : SVG_LEFT + selectedTimelinePosition * SVG_WIDTH;
          const selectedY = value?.value === null || value === undefined
            || lane.overlay.laneMinimum === null || lane.overlay.laneMaximum === null
            ? null
            : lane.overlay.laneMinimum === lane.overlay.laneMaximum
              ? SVG_TOP + SVG_HEIGHT / 2
              : SVG_TOP + (lane.overlay.laneMaximum - value.value)
                / (lane.overlay.laneMaximum - lane.overlay.laneMinimum) * SVG_HEIGHT;
          return (
            <article key={lane.overlay.signalRef} data-signal-ref={lane.overlay.signalRef}>
              <div className="training-route-signal-lane-heading">
                <div>
                  <h6>{lane.label}</h6>
                  <span>{range}</span>
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
              <div
                className="training-route-signal-lane-chart"
                role="slider"
                tabIndex={0}
                aria-label={interpolate(copy.signalLanePosition, { metric: lane.label })}
                aria-orientation="horizontal"
                aria-valuemin={1}
                aria-valuemax={model.points.length}
                aria-valuenow={selectedPointIndex + 1}
                aria-valuetext={laneValueText}
                aria-describedby={`training-route-lane-${lane.overlay.signalRef}-instructions`}
                onClick={selectFromPointer}
                onKeyDown={selectFromKeyboard}
              >
                <svg viewBox="0 0 1000 104" aria-hidden="true" focusable="false">
                  <rect x="1" y="1" width="998" height="102" rx="12" />
                  <line className="training-route-signal-lane-grid" x1="20" x2="980" y1="52" y2="52" />
                  {lane.segments.map((points, index) => points.includes(" ")
                    ? <polyline key={`${lane.overlay.signalRef}-${index}`} points={points} />
                    : (() => {
                      const [cx, cy] = points.split(",");
                      return <circle
                        key={`${lane.overlay.signalRef}-${index}`}
                        className="training-route-signal-lane-isolated"
                        cx={cx}
                        cy={cy}
                        r="4"
                      />;
                    })())}
                  {selectedX !== null && <line
                    className="training-route-signal-cursor"
                    x1={selectedX}
                    x2={selectedX}
                    y1="7"
                    y2="97"
                  />}
                  {selectedX !== null && selectedY !== null && <circle
                    className="training-route-signal-selected"
                    cx={selectedX}
                    cy={selectedY}
                    r="6"
                  />}
                </svg>
              </div>
              <p
                id={`training-route-lane-${lane.overlay.signalRef}-instructions`}
                className="sr-only"
              >{copy.signalLaneInstructions}</p>
              <footer>
                <strong aria-live="polite">{formattedValue}</strong>
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
          );
        })}
      </div>
      <p className="training-route-signal-lanes-meaning">{copy.signalLanesMeaning}</p>
    </section>
  );
}
