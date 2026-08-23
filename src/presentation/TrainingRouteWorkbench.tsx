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
import type {
  LocalRouteViewport,
  LocalRouteViewportRangeSelection,
} from "./route-viewport";
import type { SessionStory, SessionStoryMetric, SessionStoryRole } from "./session-story";
import {
  elapsedEditorValue,
  parseElapsedEditorValue,
} from "./training-range-editor-model";
import { TrainingRangeEditor } from "./TrainingRangeEditor";
import { useOptionalTrainingRangeInteraction } from "./TrainingRangeInteractionProvider";
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
  exerciseRef: string;
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
        exerciseRef: exercise.exerciseRef,
        exerciseOrdinal: exercise.ordinal,
        roleName,
        role,
        model,
      }] : [];
    },
  ));
}

function distinctElapsedPointIndexes(model: RouteWorkbenchModel): number[] {
  const elapsed = new Set<string>();
  return model.elapsedPointIndexes.filter((pointIndex) => {
    const value = model.points[pointIndex].source.elapsedMilliseconds!;
    if (elapsed.has(value)) return false;
    elapsed.add(value);
    return true;
  });
}

function pointIndexAtExactElapsed(
  model: RouteWorkbenchModel,
  elapsedMilliseconds: string | undefined,
): number | null {
  if (elapsedMilliseconds === undefined) return null;
  return model.elapsedPointIndexes.find(
    (pointIndex) => model.points[pointIndex].source.elapsedMilliseconds === elapsedMilliseconds,
  ) ?? null;
}

function routeDraftBounds(
  model: RouteWorkbenchModel,
  selectedPointIndex: number,
): { startedAtElapsedMilliseconds: string; endedAtElapsedMilliseconds: string } | null {
  const selected = model.points[selectedPointIndex]?.source.elapsedMilliseconds;
  if (selected === null || selected === undefined) return null;
  const indexes = distinctElapsedPointIndexes(model);
  const selectedElapsed = BigInt(selected);
  const following = indexes.find((pointIndex) => (
    BigInt(model.points[pointIndex].source.elapsedMilliseconds!) > selectedElapsed
  ));
  if (following !== undefined) {
    return {
      startedAtElapsedMilliseconds: selected,
      endedAtElapsedMilliseconds: model.points[following].source.elapsedMilliseconds!,
    };
  }
  const preceding = [...indexes].reverse().find((pointIndex) => (
    BigInt(model.points[pointIndex].source.elapsedMilliseconds!) < selectedElapsed
  ));
  return preceding === undefined ? null : {
    startedAtElapsedMilliseconds: model.points[preceding].source.elapsedMilliseconds!,
    endedAtElapsedMilliseconds: selected,
  };
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
  const rangeInteraction = useOptionalTrainingRangeInteraction();
  const choices = useMemo(() => routeChoices(story), [story]);
  const choiceSignature = choices.map((choice) => choice.key).join("|");
  const [choiceKey, setChoiceKey] = useState(() => choices[0]?.key ?? "");
  const choice = choices.find((candidate) => candidate.key === choiceKey) ?? choices[0];
  const [selectedPointIndex, setSelectedPointIndex] = useState(0);
  const [activeRangeBoundary, setActiveRangeBoundary] = useState<"start" | "end">("end");
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
  const mapSelectionHandlerRef = useRef<(pointIndex: number) => void>(setSelectedPointIndex);
  const copy = messages.training.sessionLibrary.routeWorkbench;
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const singleExercise = choices.every(
    (candidate) => candidate.exerciseOrdinal === choices[0]?.exerciseOrdinal,
  );
  const routeEditor = choice && rangeInteraction?.editor?.surface === "route"
    && rangeInteraction.editor.exerciseRef === choice.exerciseRef
    && rangeInteraction.editor.coordinate?.scope === "route-elapsed"
    && rangeInteraction.editor.coordinate.routeRef === choice.model.routeRef
    ? rangeInteraction.editor
    : undefined;
  const routeRanges = choice ? rangeInteraction?.result?.ranges.filter((range) => (
    range.exerciseRef === choice.exerciseRef
    && range.coordinate.scope === "route-elapsed"
    && range.coordinate.routeRef === choice.model.routeRef
  )) ?? [] : [];
  const selectedRouteRange = routeRanges.find(
    (range) => range.rangeRef === rangeInteraction?.selectedRange?.rangeRef,
  );
  const rangeStartedAt = routeEditor
    ? parseElapsedEditorValue(routeEditor.startedAt)
    : selectedRouteRange?.startedAtElapsedMilliseconds;
  const rangeEndedAt = routeEditor
    ? parseElapsedEditorValue(routeEditor.endedAt)
    : selectedRouteRange?.endedAtElapsedMilliseconds;
  const rangeSelection: LocalRouteViewportRangeSelection | null = choice
    && (rangeStartedAt !== undefined || rangeEndedAt !== undefined)
    ? {
        startedAtPointIndex: pointIndexAtExactElapsed(choice.model, rangeStartedAt),
        endedAtPointIndex: pointIndexAtExactElapsed(choice.model, rangeEndedAt),
      }
    : null;
  const latestRangeSelection = useRef(rangeSelection);
  latestRangeSelection.current = rangeSelection;

  useEffect(() => {
    const first = choices[0];
    setChoiceKey(first?.key ?? "");
    setSelectedPointIndex(0);
    setActiveRangeBoundary("end");
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
        rangeSelection,
        onSelectPoint: (pointIndex) => mapSelectionHandlerRef.current(pointIndex),
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
        viewport.updateRangeSelection(latestRangeSelection.current);
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
    viewportRef.current?.updateRangeSelection(rangeSelection);
  }, [
    choice?.key,
    rangeSelection?.startedAtPointIndex,
    rangeSelection?.endedAtPointIndex,
    story.snapshotRef,
  ]);

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
    point: number.format(selection.point.source.ordinal + 1),
    total: number.format(choice.model.sourcePointCount),
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
  const elapsedPointIndexes = distinctElapsedPointIndexes(choice.model);
  const draftBounds = routeDraftBounds(choice.model, selectedPointIndex);
  const routeCoordinateAvailable = rangeInteraction?.editableChoices.some((exercise) => (
    exercise.exerciseRef === choice.exerciseRef
    && exercise.coordinates.some((coordinate) => (
      coordinate.coordinate.scope === "route-elapsed"
      && coordinate.coordinate.routeRef === choice.model.routeRef
    ))
  )) ?? false;
  const startedAtHandle = rangeSelection?.startedAtPointIndex === null
    || rangeSelection?.startedAtPointIndex === undefined
    ? -1
    : elapsedPointIndexes.indexOf(rangeSelection.startedAtPointIndex);
  const endedAtHandle = rangeSelection?.endedAtPointIndex === null
    || rangeSelection?.endedAtPointIndex === undefined
    ? -1
    : elapsedPointIndexes.indexOf(rangeSelection.endedAtPointIndex);

  function routePointValue(pointIndex: number): string {
    const point = choice.model.points[pointIndex];
    const position = interpolate(copy.pointPosition, {
      point: number.format(point.source.ordinal + 1),
      total: number.format(choice.model.sourcePointCount),
    });
    const elapsed = point.source.elapsedMilliseconds === null
      ? copy.elapsedUnavailable
      : formatDuration(point.source.elapsedMilliseconds, locale, messages.training.durationUnits);
    return `${position} · ${elapsed}`;
  }

  function updateRouteBoundary(boundary: "start" | "end", pointIndex: number) {
    const elapsed = choice.model.points[pointIndex]?.source.elapsedMilliseconds;
    if (!routeEditor || elapsed === null || elapsed === undefined) return;
    rangeInteraction?.updateEditor(boundary === "start"
      ? { startedAt: elapsedEditorValue(elapsed) }
      : { endedAt: elapsedEditorValue(elapsed) });
  }

  mapSelectionHandlerRef.current = (pointIndex) => {
    setSelectedPointIndex(pointIndex);
    updateRouteBoundary(activeRangeBoundary, pointIndex);
  };

  function openRouteRange() {
    if (!rangeInteraction || !draftBounds) return;
    setActiveRangeBoundary("end");
    rangeInteraction.openCreateEditor("route", {
      exerciseRef: choice.exerciseRef,
      coordinate: { scope: "route-elapsed", routeRef: choice.model.routeRef },
      ...draftBounds,
    });
  }

  function routeRangeWorkspace() {
    if (!rangeInteraction) return null;
    const editorElsewhere = rangeInteraction.editor !== undefined && routeEditor === undefined;
    const currentElapsedMissing = selection.point.source.elapsedMilliseconds === null;
    return (
      <aside className="training-route-range-inspector" aria-label={copy.rangeRegion}>
        <header>
          <p className="eyebrow">{copy.rangeEyebrow}</p>
          <h4>{copy.rangeHeading}</h4>
          <p>{copy.rangeIntroduction}</p>
        </header>
        {rangeInteraction.loading && <p role="status">{copy.rangeLoading}</p>}
        {rangeInteraction.failed && !rangeInteraction.loading && (
          <div className="training-route-range-failed">
            <p>{copy.rangeFailed}</p>
            <button type="button" className="secondary" onClick={() => void rangeInteraction.reload()}>
              {copy.rangeRetry}
            </button>
          </div>
        )}
        {!rangeInteraction.loading && !rangeInteraction.failed
          && (routeRanges.length > 1 || (routeRanges.length === 1 && !selectedRouteRange)) && (
          <label className="training-route-saved-range-choice">
            <span>{copy.savedRange}</span>
            <select
              value={selectedRouteRange?.rangeRef ?? ""}
              onChange={(event) => rangeInteraction.selectRange(event.target.value)}
            >
              <option value="">{copy.chooseSavedRange}</option>
              {routeRanges.map((range) => (
                <option key={range.rangeRef} value={range.rangeRef}>{range.title}</option>
              ))}
            </select>
          </label>
        )}
        {!routeEditor && selectedRouteRange && (
          <div className="training-route-saved-range">
            <span>{copy.visibleSavedRange}</span>
            <strong>{selectedRouteRange.title}</strong>
            <small>{formatDuration(
              (BigInt(selectedRouteRange.endedAtElapsedMilliseconds)
                - BigInt(selectedRouteRange.startedAtElapsedMilliseconds)).toString(),
              locale,
              messages.training.durationUnits,
            )}</small>
            {rangeInteraction.mayAdjust(selectedRouteRange) && (
              <button
                type="button"
                className="secondary"
                disabled={rangeInteraction.busy}
                onClick={() => {
                  setActiveRangeBoundary("end");
                  rangeInteraction.openAdjustEditor(selectedRouteRange, "route");
                }}
              >{copy.adjustRange}</button>
            )}
          </div>
        )}
        {!routeEditor && !rangeInteraction.loading && !rangeInteraction.failed && (
          <>
            <button
              type="button"
              disabled={rangeInteraction.busy || editorElsewhere || !routeCoordinateAvailable
                || draftBounds === null}
              onClick={openRouteRange}
            >{copy.createRangeHere}</button>
            {currentElapsedMissing && <p className="training-route-range-note">
              {copy.pointWithoutElapsed}
            </p>}
            {editorElsewhere && <p className="training-route-range-note">{copy.finishCurrentEdit}</p>}
            {!routeCoordinateAvailable && !rangeInteraction.loading && (
              <p className="training-route-range-note">{copy.rangeUnavailable}</p>
            )}
          </>
        )}
        {routeEditor && (
          <>
            <div className="training-route-range-handles">
              <div role="group" aria-label={copy.movingBoundary}>
                <button
                  type="button"
                  className="secondary"
                  aria-pressed={activeRangeBoundary === "start"}
                  onClick={() => setActiveRangeBoundary("start")}
                >{copy.moveRangeStart}</button>
                <button
                  type="button"
                  className="secondary"
                  aria-pressed={activeRangeBoundary === "end"}
                  onClick={() => setActiveRangeBoundary("end")}
                >{copy.moveRangeEnd}</button>
              </div>
              <p>{copy.rangeHandleInstructions}</p>
              {startedAtHandle >= 0 ? (
                <label>
                  <span>{copy.rangeStartHandle}</span>
                  <input
                    type="range"
                    min="0"
                    max={elapsedPointIndexes.length - 1}
                    step="1"
                    value={startedAtHandle}
                    aria-valuetext={routePointValue(elapsedPointIndexes[startedAtHandle])}
                    onFocus={() => setActiveRangeBoundary("start")}
                    onChange={(event) => updateRouteBoundary(
                      "start",
                      elapsedPointIndexes[Number(event.target.value)],
                    )}
                  />
                </label>
              ) : <p className="training-route-range-note">{copy.startOutsideProjection}</p>}
              {endedAtHandle >= 0 ? (
                <label>
                  <span>{copy.rangeEndHandle}</span>
                  <input
                    type="range"
                    min="0"
                    max={elapsedPointIndexes.length - 1}
                    step="1"
                    value={endedAtHandle}
                    aria-valuetext={routePointValue(elapsedPointIndexes[endedAtHandle])}
                    onFocus={() => setActiveRangeBoundary("end")}
                    onChange={(event) => updateRouteBoundary(
                      "end",
                      elapsedPointIndexes[Number(event.target.value)],
                    )}
                  />
                </label>
              ) : <p className="training-route-range-note">{copy.endOutsideProjection}</p>}
            </div>
            <TrainingRangeEditor surface="route" messages={messages} lockCoordinate />
          </>
        )}
        {rangeInteraction.status && <p className="training-route-range-status" role="status">
          {rangeInteraction.status}
        </p>}
      </aside>
    );
  }

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
          <h3>{copy.heading}</h3>
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
      <div
        className="training-route-range-layout"
        data-has-range={rangeInteraction ? "true" : "false"}
      >
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
        {routeRangeWorkspace()}
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
