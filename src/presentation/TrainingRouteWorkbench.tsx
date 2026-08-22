import { useEffect, useMemo, useRef, useState } from "react";

import { type catalogs, type Locale } from "../locales/catalogs";
import {
  buildRouteWorkbenchModel,
  routeOverlaySegments,
  selectRoutePoint,
  type RouteWorkbenchModel,
  type RouteWorkbenchOverlay,
  type RouteWorkbenchOverlayValue,
} from "./route-workbench-model";
import type { LocalRouteViewport } from "./route-viewport";
import type { SessionStory, SessionStoryMetric, SessionStoryRole } from "./session-story";
import { TrainingRouteSignalLanes } from "./TrainingRouteSignalLanes";
import { formatDuration } from "./training-format";

type StoryRole = "primary" | "transition";

interface TrainingRouteWorkbenchProps {
  story: SessionStory;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  onOpenExactRoute: (
    routeRef: string,
    pointOrdinal: number,
    initiatingElement: HTMLButtonElement,
  ) => void;
  onOpenExactSignal: (
    signalRef: string,
    sampleOrdinal: number | null,
    initiatingElement: HTMLButtonElement,
  ) => void;
}

interface RouteChoice {
  key: string;
  exerciseOrdinal: number;
  roleName: StoryRole;
  role: SessionStoryRole;
  model: RouteWorkbenchModel;
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

function routeChoices(story: SessionStory): RouteChoice[] {
  return story.exercises.flatMap((exercise) => (["primary", "transition"] as const).flatMap(
    (roleName) => {
      const role = exercise[roleName];
      const model = buildRouteWorkbenchModel(role);
      return model ? [{
        key: `${exercise.ordinal}:${roleName}`,
        exerciseOrdinal: exercise.ordinal,
        roleName,
        role,
        model,
      }] : [];
    },
  ));
}

function defaultOverlayRef(choice: RouteChoice): string | null {
  return choice.role.eligibleOverlays.find(
    (overlay) => overlay.metric === choice.role.primaryMetric,
  )?.signalRef ?? null;
}

function pace(value: number, locale: Locale): string {
  const minutes = Math.floor(value);
  const seconds = Math.round((value - minutes) * 60);
  const normalizedMinutes = seconds === 60 ? minutes + 1 : minutes;
  const normalizedSeconds = seconds === 60 ? 0 : seconds;
  return `${new Intl.NumberFormat(locale).format(normalizedMinutes)}:${normalizedSeconds
    .toString().padStart(2, "0")} min/km`;
}

function metricValue(
  metric: SessionStoryMetric,
  value: number,
  locale: Locale,
  units: Record<SessionStoryMetric, string>,
): string {
  if (metric === "pace") return pace(value, locale);
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: metric === "heart-rate" || metric === "cadence"
      || metric === "stroke-rate" || metric === "power" ? 0 : 1,
  }).format(value);
  return `${formatted} ${units[metric]}`;
}

function routeChoiceLabel(
  choice: RouteChoice,
  singleExercise: boolean,
  number: Intl.NumberFormat,
  copy: (typeof catalogs)["en-US"]["training"]["sessionLibrary"]["routeWorkbench"],
): string {
  const role = choice.roleName === "primary" ? copy.primaryRoute : copy.transitionRoute;
  return singleExercise ? role : interpolate(copy.exerciseRoute, {
    exercise: number.format(choice.exerciseOrdinal + 1),
    route: role,
  });
}

function overlayForViewport(model: RouteWorkbenchModel, signalRef: string | null) {
  return signalRef === null ? null : {
    signalRef,
    segments: routeOverlaySegments(model, signalRef),
  };
}

export function TrainingRouteWorkbench({
  story,
  locale,
  messages,
  onOpenExactRoute,
  onOpenExactSignal,
}: TrainingRouteWorkbenchProps) {
  const choices = useMemo(() => routeChoices(story), [story]);
  const choiceSignature = choices.map((choice) => choice.key).join("|");
  const [choiceKey, setChoiceKey] = useState(() => choices[0]?.key ?? "");
  const choice = choices.find((candidate) => candidate.key === choiceKey) ?? choices[0];
  const [selectedPointIndex, setSelectedPointIndex] = useState(0);
  const [selectedOverlayRef, setSelectedOverlayRef] = useState<string | null>(
    () => choice ? defaultOverlayRef(choice) : null,
  );
  const latestSelectedPointIndex = useRef(selectedPointIndex);
  const latestSelectedOverlayRef = useRef(selectedOverlayRef);
  latestSelectedPointIndex.current = selectedPointIndex;
  latestSelectedOverlayRef.current = selectedOverlayRef;
  const [viewportState, setViewportState] = useState<"loading" | "ready" | "failed">("loading");
  const [focused, setFocused] = useState(false);
  const workbenchRef = useRef<HTMLElement>(null);
  const mapElementRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<LocalRouteViewport | null>(null);
  const focusButtonRef = useRef<HTMLButtonElement>(null);
  const returnButtonRef = useRef<HTMLButtonElement>(null);
  const focusTransitionRequested = useRef(false);
  const copy = messages.training.sessionLibrary.routeWorkbench;
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const singleExercise = choices.every(
    (candidate) => candidate.exerciseOrdinal === choices[0]?.exerciseOrdinal,
  );

  useEffect(() => {
    const first = choices[0];
    setChoiceKey(first?.key ?? "");
    setSelectedPointIndex(0);
    setSelectedOverlayRef(first ? defaultOverlayRef(first) : null);
  }, [choiceSignature]);

  useEffect(() => {
    if (!choice) return;
    setSelectedPointIndex((current) => Math.max(
      0,
      Math.min(choice.model.points.length - 1, current),
    ));
    setSelectedOverlayRef((current) => {
      if (current === null) return null;
      return choice.model.overlays.some((overlay) => overlay.signalRef === current)
        ? current
        : defaultOverlayRef(choice);
    });
  }, [choice?.key, story.snapshotRef]);

  useEffect(() => {
    if (!choice || !mapElementRef.current) return;
    let active = true;
    setViewportState("loading");
    const element = mapElementRef.current;
    void import("./leaflet-route-adapter")
      .then(({ createLocalRouteViewport }) => createLocalRouteViewport(element, {
        points: choice.model.points,
        directionMarkers: choice.model.directionMarkers,
        selectedPointIndex: Math.max(
          0,
          Math.min(choice.model.points.length - 1, selectedPointIndex),
        ),
        overlay: overlayForViewport(choice.model, selectedOverlayRef),
        onSelectPoint: (pointIndex) => setSelectedPointIndex(pointIndex),
      }))
      .then((viewport) => {
        if (!active) {
          viewport.destroy();
          return;
        }
        viewportRef.current = viewport;
        viewport.updateSelection(Math.max(
          0,
          Math.min(choice.model.points.length - 1, latestSelectedPointIndex.current),
        ));
        viewport.updateOverlay(overlayForViewport(
          choice.model,
          latestSelectedOverlayRef.current,
        ));
        setViewportState("ready");
      })
      .catch(() => {
        if (active) setViewportState("failed");
      });
    return () => {
      active = false;
      viewportRef.current?.destroy();
      viewportRef.current = null;
      element.replaceChildren();
    };
  }, [choice?.key, story.snapshotRef]);

  useEffect(() => {
    viewportRef.current?.updateSelection(selectedPointIndex);
  }, [selectedPointIndex]);

  useEffect(() => {
    if (!choice) return;
    viewportRef.current?.updateOverlay(overlayForViewport(choice.model, selectedOverlayRef));
  }, [choice?.key, selectedOverlayRef, story.snapshotRef]);

  useEffect(() => {
    if (!focused || !workbenchRef.current) return;

    const isolatedSiblings: HTMLElement[] = [];
    let branch = workbenchRef.current;
    while (branch.parentElement) {
      const parent = branch.parentElement;
      for (const sibling of parent.children) {
        if (sibling === branch || !(sibling instanceof HTMLElement)
          || sibling.hasAttribute("inert")) continue;
        sibling.setAttribute("inert", "");
        isolatedSiblings.push(sibling);
      }
      if (parent === document.body) break;
      branch = parent;
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      for (const sibling of isolatedSiblings) sibling.removeAttribute("inert");
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [focused]);

  useEffect(() => {
    if (!choice) return;
    viewportRef.current?.invalidateSize();
    if (!focusTransitionRequested.current) return;
    focusTransitionRequested.current = false;
    const target = focused ? returnButtonRef.current : focusButtonRef.current;
    target?.focus();
  }, [focused, choice?.key]);

  useEffect(() => {
    if (!focused) return;
    function leaveFocusedMap(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      focusTransitionRequested.current = true;
      setFocused(false);
    }
    document.addEventListener("keydown", leaveFocusedMap);
    return () => document.removeEventListener("keydown", leaveFocusedMap);
  }, [focused]);

  if (!choice) return null;

  const selection = selectRoutePoint(choice.model, selectedPointIndex);
  const selectedPointPosition = interpolate(copy.pointPosition, {
    point: number.format(selection.pointIndex + 1),
    total: number.format(choice.model.points.length),
  });
  const selectedElapsed = selection.point.source.elapsedMilliseconds === null
    ? copy.elapsedUnavailable
    : formatDuration(
      selection.point.source.elapsedMilliseconds,
      locale,
      messages.training.durationUnits,
    );
  const selectedOverlay = choice.model.overlays.find(
    (overlay) => overlay.signalRef === selectedOverlayRef,
  );

  function selectChoice(nextKey: string) {
    const next = choices.find((candidate) => candidate.key === nextKey);
    if (!next) return;
    setChoiceKey(next.key);
    setSelectedPointIndex(0);
    setSelectedOverlayRef(defaultOverlayRef(next));
  }

  function overlayLabel(overlay: RouteWorkbenchOverlay): string {
    return copy.metrics[overlay.metric];
  }

  function selectedValue(value: RouteWorkbenchOverlayValue) {
    const label = copy.metrics[value.metric];
    return value.value === null
      ? interpolate(copy.noMetricAtPosition, { metric: label.toLocaleLowerCase(locale) })
      : metricValue(value.metric, value.value, locale, copy.metricUnits);
  }

  return (
    <section
      ref={workbenchRef}
      className="training-route-workbench"
      role={focused ? "dialog" : "region"}
      aria-modal={focused ? true : undefined}
      aria-label={copy.regionLabel}
      data-focused={focused ? "true" : "false"}
    >
      <header className="training-route-workbench-heading">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h4>{copy.heading}</h4>
          <p>{copy.introduction}</p>
        </div>
        <div className="training-route-workbench-controls">
          <label>
            <span>{copy.visibleRoute}</span>
            <select value={choice.key} onChange={(event) => selectChoice(event.target.value)}>
              {choices.map((candidate) => (
                <option key={candidate.key} value={candidate.key}>{routeChoiceLabel(
                  candidate,
                  singleExercise,
                  number,
                  copy,
                )}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy.trackDisplay}</span>
            <select
              value={selectedOverlayRef ?? ""}
              onChange={(event) => setSelectedOverlayRef(event.target.value || null)}
            >
              <option value="">{copy.recordedTrack}</option>
              {choice.model.overlays.map((overlay) => (
                <option key={overlay.signalRef} value={overlay.signalRef}>
                  {overlayLabel(overlay)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <div className="training-route-map-frame">
        <div className="training-route-map-tools" aria-label={copy.mapControls}>
          <button type="button" onClick={() => viewportRef.current?.zoomIn()}>{copy.zoomIn}</button>
          <button type="button" onClick={() => viewportRef.current?.zoomOut()}>{copy.zoomOut}</button>
          <button type="button" onClick={() => viewportRef.current?.fitTrack()}>{copy.completeTrack}</button>
          <button
            ref={focused ? returnButtonRef : focusButtonRef}
            type="button"
            onClick={() => {
              focusTransitionRequested.current = true;
              setFocused((current) => !current);
            }}
          >{focused ? copy.returnToSession : copy.focusMap}</button>
        </div>
        <div className="training-route-north" aria-hidden="true">N ↑</div>
        <div
          ref={mapElementRef}
          className="training-route-map"
          role="region"
          aria-label={copy.mapLabel}
          aria-describedby="training-route-map-instructions"
          tabIndex={0}
        />
        <p id="training-route-map-instructions" className="sr-only">
          {copy.mapInstructions}
        </p>
        {viewportState === "loading" && <p className="training-route-map-status" role="status">
          {copy.loading}
        </p>}
        {viewportState === "failed" && <p className="training-route-map-status error" role="alert">
          {copy.failed}
        </p>}
      </div>
      <div className="training-route-selection" aria-live="polite">
        <div>
          <strong>{selectedPointPosition}</strong>
          <span>{selectedElapsed}</span>
        </div>
        <dl>
          <div>
            <dt>{copy.altitude}</dt>
            <dd>{selection.point.source.altitudeMeters === null
              ? copy.notRecorded
              : `${number.format(selection.point.source.altitudeMeters)} ${messages.training.units.meters}`}</dd>
          </div>
          {selection.overlayValues.map((value) => (
            <div key={value.signalRef}>
              <dt>{copy.metrics[value.metric]}</dt>
              <dd>{selectedValue(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
      {choice.model.elapsedPointIndexes.length > 0 && (
        <label className="training-route-position-control">
          <span>{copy.recordedPosition}</span>
          <input
            type="range"
            min="0"
            max={choice.model.points.length - 1}
            step="1"
            value={selectedPointIndex}
            aria-valuetext={`${selectedPointPosition} · ${selectedElapsed}`}
            onChange={(event) => setSelectedPointIndex(Number(event.target.value))}
          />
        </label>
      )}
      {selectedOverlay && (
        <section className="training-route-overlay-legend" aria-label={copy.overlayLegend}>
          <div>
            <strong>{interpolate(copy.overlayHeading, {
              metric: overlayLabel(selectedOverlay),
            })}</strong>
            <span>{selectedOverlay.minimum === null || selectedOverlay.maximum === null
              ? copy.overlayUnavailable
              : interpolate(copy.overlayRange, {
                minimum: metricValue(
                  selectedOverlay.metric,
                  selectedOverlay.minimum,
                  locale,
                  copy.metricUnits,
                ),
                maximum: metricValue(
                  selectedOverlay.metric,
                  selectedOverlay.maximum,
                  locale,
                  copy.metricUnits,
                ),
              })}</span>
          </div>
          <span className="training-route-overlay-scale" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((level) => <i key={level} data-level={level} />)}
          </span>
        </section>
      )}
      <TrainingRouteSignalLanes
        model={choice.model}
        role={choice.role}
        selectedPointIndex={selectedPointIndex}
        selectedPointPosition={selectedPointPosition}
        selectedElapsed={selectedElapsed}
        locale={locale}
        messages={messages}
        metricLabel={(metric) => copy.metrics[metric]}
        formatMetricValue={(metric, value) => metricValue(
          metric,
          value,
          locale,
          copy.metricUnits,
        )}
        onSelectPoint={setSelectedPointIndex}
        onOpenExactSignal={(signalRef, sampleOrdinal, initiatingElement) => {
          if (focused) setFocused(false);
          onOpenExactSignal(signalRef, sampleOrdinal, initiatingElement);
        }}
      />
      <div className="training-route-exact-actions">
        {choice.role.exactRoute && <button
          type="button"
          className="secondary"
          onClick={(event) => {
            if (focused) setFocused(false);
            onOpenExactRoute(
              choice.role.exactRoute!.routeRef,
              selection.point.source.ordinal,
              event.currentTarget,
            );
          }}
        >{copy.exactRoute}</button>}
      </div>
      <p className="training-route-locality">{copy.locality}</p>
    </section>
  );
}
