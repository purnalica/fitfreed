import { type FormEvent, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { type catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import {
  elapsedEditorValue,
  findEstablishedCoordinate,
  MAX_ELAPSED_EDITOR_CHARACTERS,
  MAX_RANGE_TITLE_CHARACTERS,
  rangeEditorValidation,
  rangeMayBeAdjusted,
  selectableRangeCoordinates,
  type SelectableRangeCoordinate,
  type SelectableRangeExercise,
} from "./training-range-editor-model";
import { formatDuration, formatSessionCardDistance } from "./training-format";
import type { SessionStory } from "./session-story";
import type {
  TrainingRangeBoundaryState,
  TrainingRangeSummaryLimitation,
  TrainingSessionRange,
  TrainingSessionRangesResult,
  TrainingSessionRangeSummary,
} from "./training-session-range";
import { useResultFocus } from "./useResultFocus";

type RangeMutationCommand =
  | "create_training_session_range"
  | "rename_training_session_range"
  | "adjust_training_session_range"
  | "remove_training_session_range";

const MAX_RANGE_TITLE_INPUT_CODE_UNITS = MAX_RANGE_TITLE_CHARACTERS * 2;

interface TrainingRangesPanelProps {
  sessionRef: string;
  snapshotRef: string;
  story: SessionStory;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  onError: (code: string | undefined) => void;
}

interface RangeEditorState {
  mode: "create" | "rename" | "adjust";
  rangeRef?: string;
  title: string;
  startedAt: string;
  endedAt: string;
  exerciseChoiceId: string;
  coordinateChoiceId: string;
  dirty: boolean;
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

function defaultRangeEnd(maximum: string | undefined): string {
  if (maximum === undefined) return "0:00:01";
  const exact = BigInt(maximum);
  return elapsedEditorValue(exact < 60_000n ? exact.toString() : "60000");
}

function normalizedTitle(title: string): string | undefined {
  const value = title.trim();
  return value.length > 0 && [...value].length <= MAX_RANGE_TITLE_CHARACTERS
    ? value
    : undefined;
}

export function TrainingRangesPanel({
  sessionRef,
  snapshotRef,
  story,
  locale,
  messages,
  onError,
}: TrainingRangesPanelProps) {
  const [result, setResult] = useState<TrainingSessionRangesResult>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selectedRangeRef, setSelectedRangeRef] = useState<string>();
  const [summary, setSummary] = useState<TrainingSessionRangeSummary>();
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [summaryRetry, setSummaryRetry] = useState(0);
  const [editor, setEditor] = useState<RangeEditorState>();
  const [mutationCommand, setMutationCommand] = useState<RangeMutationCommand>();
  const [removeConfirmation, setRemoveConfirmation] = useState(false);
  const [status, setStatus] = useState<string>();
  const {
    resultHeadingRef: selectedHeadingRef,
    requestResultFocus: requestSelectedRangeFocus,
  } = useResultFocus<HTMLHeadingElement>(selectedRangeRef !== undefined);
  const copy = messages.training.sessionLibrary.ranges;
  const number = useMemo(() => new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }), [locale]);
  const summaryNumber = useMemo(() => new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }), [locale]);
  const integer = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const busy = mutationCommand !== undefined;

  const choices = useMemo(() => selectableRangeCoordinates(result ?? {
    snapshotRef,
    sessionRef,
    sessionDurationMilliseconds: "0",
    evidenceRevision: "",
    exercises: [],
    ranges: [],
  }, story, {
    exercise: (ordinal, sport) => sport
      ? interpolate(copy.exerciseChoice, {
        sport,
        number: integer.format(ordinal + 1),
      })
      : interpolate(copy.exerciseFallback, { number: integer.format(ordinal + 1) }),
    exerciseTimeline: copy.exerciseTimeline,
    primaryRoute: copy.primaryRouteTimeline,
    transitionRoute: copy.transitionRouteTimeline,
    recordedRoute: copy.recordedRouteTimeline,
    signal: (kind, role) => interpolate(copy.signalTimeline, {
      signal: messages.training.sessionLibrary.signalKinds[kind],
      role: role === "primary" ? copy.primarySignalTimeline : copy.transitionSignalTimeline,
    }),
    recordedSignal: copy.recordedSignalTimeline,
  }), [copy, integer, messages, result, sessionRef, snapshotRef, story]);
  const editableChoices = useMemo(() => choices.flatMap((exercise) => {
    const coordinates = exercise.coordinates.filter(
      (coordinate) => BigInt(coordinate.maximumElapsedMilliseconds) > 0n,
    );
    return coordinates.length > 0 ? [{ ...exercise, coordinates }] : [];
  }), [choices]);

  const selectedRange = result?.ranges.find((range) => range.rangeRef === selectedRangeRef);
  const editorRange = editor?.rangeRef
    ? result?.ranges.find((range) => range.rangeRef === editor.rangeRef)
    : undefined;
  const editorExercise = editableChoices.find(
    (choice) => choice.id === editor?.exerciseChoiceId,
  );
  const editorCoordinate = editorExercise?.coordinates.find(
    (choice) => choice.id === editor?.coordinateChoiceId,
  );
  const establishedContext = editorRange && result
    ? findEstablishedCoordinate(result, editorRange)
    : undefined;
  const editorMaximum = editor?.mode === "rename"
    ? undefined
    : establishedContext?.maximumElapsedMilliseconds
      ?? editorCoordinate?.maximumElapsedMilliseconds;
  const editorValidation = editor ? rangeEditorValidation({
    title: editor.title,
    startedAt: editor.startedAt,
    endedAt: editor.endedAt,
    maximumElapsedMilliseconds: editorMaximum,
    requireTitle: editor.mode !== "adjust" || editorRange === undefined,
  }) : undefined;

  async function queryContext(querySnapshotRef: string | null): Promise<TrainingSessionRangesResult> {
    return invoke<TrainingSessionRangesResult>("query_training_session_ranges", {
      query: { sessionRef, snapshotRef: querySnapshotRef },
    });
  }

  function applyContext(updated: TrainingSessionRangesResult, preferredRangeRef?: string) {
    setResult(updated);
    setFailed(false);
    setSelectedRangeRef((current) => {
      const preferred = preferredRangeRef
        && updated.ranges.some((range) => range.rangeRef === preferredRangeRef)
        ? preferredRangeRef
        : undefined;
      if (preferred) return preferred;
      if (current && updated.ranges.some((range) => range.rangeRef === current)) return current;
      return updated.ranges[0]?.rangeRef;
    });
  }

  async function loadContext(querySnapshotRef: string | null = snapshotRef) {
    setLoading(true);
    setFailed(false);
    try {
      applyContext(await queryContext(querySnapshotRef));
    } catch {
      setFailed(true);
      setResult(undefined);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    setResult(undefined);
    setSelectedRangeRef(undefined);
    setEditor(undefined);
    setStatus(undefined);
    void queryContext(snapshotRef).then((value) => {
      if (!active) return;
      setResult(value);
      setSelectedRangeRef(value.ranges[0]?.rangeRef);
    }).catch(() => {
      if (active) setFailed(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [sessionRef, snapshotRef]);

  useEffect(() => {
    if (!selectedRange || !result) {
      setSummary(undefined);
      setSummaryLoading(false);
      setSummaryFailed(false);
      return;
    }
    let active = true;
    setSummary(undefined);
    setSummaryLoading(true);
    setSummaryFailed(false);
    void invoke<TrainingSessionRangeSummary>("query_training_session_range_summary", {
      query: {
        sessionRef,
        snapshotRef: result.snapshotRef,
        rangeRef: selectedRange.rangeRef,
        expectedRangeRevision: selectedRange.revision,
      },
    }).then((value) => {
      if (active) setSummary(value);
    }).catch((reason) => {
      if (!active) return;
      setSummaryFailed(true);
      const code = commandErrorCode(reason);
      if (code === "training-session-range-summary-changed") {
        void queryContext(result.snapshotRef).then((updated) => {
          if (active) applyContext(updated, selectedRange.rangeRef);
        });
      }
    }).finally(() => {
      if (active) setSummaryLoading(false);
    });
    return () => { active = false; };
  }, [result?.snapshotRef, selectedRange?.rangeRef, selectedRange?.revision, sessionRef, summaryRetry]);

  function choiceForRange(range: TrainingSessionRange): {
    exercise?: SelectableRangeExercise;
    coordinate?: SelectableRangeCoordinate;
  } {
    const exercise = choices.find((choice) => choice.exerciseRef === range.exerciseRef);
    const coordinate = exercise?.coordinates.find((choice) => {
      if (range.coordinate.scope !== choice.coordinate.scope) return false;
      if (range.coordinate.scope === "route-elapsed" && choice.coordinate.scope === "route-elapsed") {
        return range.coordinate.routeRef === choice.coordinate.routeRef;
      }
      if (range.coordinate.scope === "signal-elapsed" && choice.coordinate.scope === "signal-elapsed") {
        return range.coordinate.signalRef === choice.coordinate.signalRef;
      }
      return range.coordinate.scope === "exercise-elapsed";
    });
    return { exercise, coordinate };
  }

  function rangeCoordinateLabel(range: TrainingSessionRange): string {
    if (range.coordinate.scope === "legacy-session-elapsed") return copy.legacyTimeline;
    const choice = choiceForRange(range).coordinate;
    if (choice) return choice.label;
    if (range.coordinate.scope === "exercise-elapsed") return copy.exerciseTimeline;
    if (range.coordinate.scope === "route-elapsed") return copy.recordedRouteTimeline;
    return copy.recordedSignalTimeline;
  }

  function openCreateEditor() {
    const exercise = editableChoices[0];
    const coordinate = exercise?.coordinates[0];
    setEditor({
      mode: "create",
      title: "",
      startedAt: "0:00:00",
      endedAt: defaultRangeEnd(coordinate?.maximumElapsedMilliseconds),
      exerciseChoiceId: exercise?.id ?? "",
      coordinateChoiceId: coordinate?.id ?? "",
      dirty: false,
    });
    setRemoveConfirmation(false);
    setStatus(undefined);
  }

  function openRenameEditor(range: TrainingSessionRange) {
    setEditor({
      mode: "rename",
      rangeRef: range.rangeRef,
      title: range.title,
      startedAt: elapsedEditorValue(range.startedAtElapsedMilliseconds),
      endedAt: elapsedEditorValue(range.endedAtElapsedMilliseconds),
      exerciseChoiceId: "",
      coordinateChoiceId: "",
      dirty: false,
    });
    setRemoveConfirmation(false);
    setStatus(undefined);
  }

  function openAdjustEditor(range: TrainingSessionRange) {
    const established = choiceForRange(range);
    const exercise = established.exercise ?? editableChoices[0];
    const coordinate = established.coordinate ?? exercise?.coordinates[0];
    setEditor({
      mode: "adjust",
      rangeRef: range.rangeRef,
      title: range.title,
      startedAt: elapsedEditorValue(range.startedAtElapsedMilliseconds),
      endedAt: elapsedEditorValue(range.endedAtElapsedMilliseconds),
      exerciseChoiceId: exercise?.id ?? "",
      coordinateChoiceId: coordinate?.id ?? "",
      dirty: false,
    });
    setRemoveConfirmation(false);
    setStatus(undefined);
  }

  async function refreshAfterConflict(rangeRef: string | undefined, snapshotChanged: boolean) {
    try {
      const updated = await queryContext(snapshotChanged ? null : result?.snapshotRef ?? snapshotRef);
      applyContext(updated, rangeRef);
      setStatus(copy.conflict);
    } catch {
      setStatus(copy.mutationFailed);
    }
  }

  async function mutate(
    command: RangeMutationCommand,
    request: Record<string, unknown>,
    success: string,
    preferredRangeRef?: string,
  ) {
    setMutationCommand(command);
    setStatus(undefined);
    onError(undefined);
    const priorRangeRefs = new Set(result?.ranges.map((range) => range.rangeRef) ?? []);
    try {
      const updated = await invoke<TrainingSessionRangesResult>(command, { request });
      const createdRangeRef = command === "create_training_session_range"
        ? updated.ranges.find((range) => !priorRangeRefs.has(range.rangeRef))?.rangeRef
        : undefined;
      applyContext(updated, preferredRangeRef ?? createdRangeRef);
      setEditor(undefined);
      setRemoveConfirmation(false);
      setStatus(success);
      requestSelectedRangeFocus();
    } catch (reason) {
      const code = commandErrorCode(reason);
      if (code === "training-session-range-conflict"
        || code === "training-session-ranges-changed"
        || code === "training-session-range-summary-changed") {
        await refreshAfterConflict(preferredRangeRef ?? editor?.rangeRef, code === "training-session-ranges-changed");
      } else {
        setStatus(copy.mutationFailed);
      }
    } finally {
      setMutationCommand(undefined);
    }
  }

  function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || !result) return;
    if (editor.mode === "rename") {
      const title = normalizedTitle(editor.title);
      const current = editorRange;
      if (!title || !current) return;
      void mutate("rename_training_session_range", {
        sessionRef,
        snapshotRef: result.snapshotRef,
        rangeRef: current.rangeRef,
        expectedRevision: current.revision,
        title,
      }, copy.nameSaved, current.rangeRef);
      return;
    }
    if (!editorValidation?.valid) return;
    if (editor.mode === "create") {
      if (!editorExercise || !editorCoordinate) return;
      void mutate("create_training_session_range", {
        sessionRef,
        snapshotRef: result.snapshotRef,
        exerciseRef: editorExercise.exerciseRef,
        coordinate: editorCoordinate.coordinate,
        title: editorValidation.title,
        startedAtElapsedMilliseconds: editorValidation.startedAtElapsedMilliseconds,
        endedAtElapsedMilliseconds: editorValidation.endedAtElapsedMilliseconds,
      }, copy.saved);
      return;
    }
    if (!editorRange) return;
    const legacy = editorRange.exerciseRef === null
      && editorRange.coordinate.scope === "legacy-session-elapsed";
    const owner = legacy ? editorExercise?.exerciseRef : editorRange.exerciseRef;
    const coordinate = legacy ? editorCoordinate?.coordinate
      : editorRange.coordinate.scope === "legacy-session-elapsed" ? undefined
        : editorRange.coordinate;
    if (!owner || !coordinate) return;
    void mutate("adjust_training_session_range", {
      sessionRef,
      snapshotRef: result.snapshotRef,
      rangeRef: editorRange.rangeRef,
      expectedRevision: editorRange.revision,
      exerciseRef: owner,
      coordinate,
      startedAtElapsedMilliseconds: editorValidation.startedAtElapsedMilliseconds,
      endedAtElapsedMilliseconds: editorValidation.endedAtElapsedMilliseconds,
    }, editorRange.state === "review-required" ? copy.reviewed : copy.boundariesSaved, editorRange.rangeRef);
  }

  function editorForm() {
    if (!editor) return null;
    const isRename = editor.mode === "rename";
    const isLegacyAdjustment = editor.mode === "adjust"
      && editorRange?.coordinate.scope === "legacy-session-elapsed";
    const titleInvalid = editor.title.trim().length === 0
      || [...editor.title.trim()].length > MAX_RANGE_TITLE_CHARACTERS;
    const boundsInvalid = !isRename && editorValidation?.valid === false
      && editorValidation.boundsInvalid;
    const invalid = isRename ? titleInvalid : editorValidation?.valid === false;
    const heading = editor.mode === "create" ? copy.newHeading
      : editor.mode === "rename" ? copy.renameHeading
        : editorRange?.state === "review-required" ? copy.reviewEditorHeading
          : copy.adjustHeading;
    const action = editor.mode === "create" ? copy.save
      : editor.mode === "rename" ? copy.saveName
        : editorRange?.state === "review-required" ? copy.confirmReviewed
          : copy.saveBoundaries;
    const progress = editor.mode === "create" ? copy.saving
      : editor.mode === "rename" ? copy.renaming : copy.adjusting;
    return (
      <form
        className="training-range-editor"
        aria-labelledby="training-range-editor-heading"
        aria-busy={busy}
        onSubmit={submitEditor}
      >
        {editor.mode === "create"
          ? <h4 id="training-range-editor-heading">{heading}</h4>
          : <h5 id="training-range-editor-heading">{heading}</h5>}
        {(editor.mode === "create" || isLegacyAdjustment) && (
          <div className="training-range-editor-coordinate">
            <label>
              <span>{copy.exercise}</span>
              <select
                aria-label={copy.exercise}
                value={editor.exerciseChoiceId}
                disabled={busy || choices.length === 0}
                onChange={(event) => {
                  const exercise = editableChoices.find(
                    (choice) => choice.id === event.target.value,
                  );
                  setEditor({
                    ...editor,
                    exerciseChoiceId: event.target.value,
                    coordinateChoiceId: exercise?.coordinates[0]?.id ?? "",
                    dirty: true,
                  });
                }}
              >
                {editableChoices.map((choice) => (
                  <option value={choice.id} key={choice.id}>{choice.exerciseLabel}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{copy.timeline}</span>
              <select
                aria-label={copy.timeline}
                value={editor.coordinateChoiceId}
                disabled={busy || !editorExercise}
                onChange={(event) => setEditor({
                  ...editor,
                  coordinateChoiceId: event.target.value,
                  dirty: true,
                })}
              >
                {editorExercise?.coordinates.map((choice) => (
                  <option value={choice.id} key={choice.id}>{choice.label}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        {editor.mode === "adjust" && !isLegacyAdjustment && editorRange && (
          <p className="training-range-locked-coordinate">{rangeCoordinateLabel(editorRange)}</p>
        )}
        {editor.mode !== "adjust" && (
          <label className="training-range-editor-name">
            <span>{copy.rangeName}</span>
            <input
              value={editor.title}
              maxLength={MAX_RANGE_TITLE_INPUT_CODE_UNITS}
              aria-invalid={editor.dirty && titleInvalid}
              aria-describedby={editor.dirty && titleInvalid ? "training-range-editor-error" : undefined}
              disabled={busy}
              onChange={(event) => setEditor({
                ...editor,
                title: event.target.value,
                dirty: true,
              })}
            />
          </label>
        )}
        {!isRename && (
          <>
            <div className="training-range-editor-boundaries">
              <label>
                <span>{copy.start}</span>
                <input
                  value={editor.startedAt}
                  inputMode="decimal"
                  maxLength={MAX_ELAPSED_EDITOR_CHARACTERS}
                  aria-invalid={editor.dirty && boundsInvalid}
                  aria-describedby={editor.dirty && boundsInvalid
                    ? "training-range-elapsed-help training-range-editor-error"
                    : "training-range-elapsed-help"}
                  disabled={busy}
                  onChange={(event) => setEditor({
                    ...editor,
                    startedAt: event.target.value,
                    dirty: true,
                  })}
                />
              </label>
              <label>
                <span>{copy.end}</span>
                <input
                  value={editor.endedAt}
                  inputMode="decimal"
                  maxLength={MAX_ELAPSED_EDITOR_CHARACTERS}
                  aria-invalid={editor.dirty && boundsInvalid}
                  aria-describedby={editor.dirty && boundsInvalid
                    ? "training-range-elapsed-help training-range-editor-error"
                    : "training-range-elapsed-help"}
                  disabled={busy}
                  onChange={(event) => setEditor({
                    ...editor,
                    endedAt: event.target.value,
                    dirty: true,
                  })}
                />
              </label>
            </div>
            <p id="training-range-elapsed-help" className="training-range-editor-help">
              {copy.elapsedHelp}
              {editorMaximum && ` ${interpolate(copy.availableThrough, {
                time: elapsedEditorValue(editorMaximum),
              })}`}
            </p>
          </>
        )}
        {editor.dirty && invalid && (
          <p id="training-range-editor-error" className="field-error" role="alert">
            {isRename ? copy.nameInvalid : copy.editorInvalid}
          </p>
        )}
        <div className="training-range-editor-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => setEditor(undefined)}
          >{copy.cancel}</button>
          <button type="submit" disabled={busy || invalid}>{action}</button>
          {busy && <span role="status" aria-live="polite">{progress}</span>}
        </div>
      </form>
    );
  }

  function boundaryStatement(position: "start" | "end", state: TrainingRangeBoundaryState) {
    if (position === "start") {
      if (state === "exact") return copy.startExact;
      if (state === "between-evidence") return copy.startBetween;
      if (state === "outside-recorded-evidence") return copy.startOutside;
      return copy.startWithoutEvidence;
    }
    if (state === "exact") return copy.endExact;
    if (state === "between-evidence") return copy.endBetween;
    if (state === "outside-recorded-evidence") return copy.endOutside;
    return copy.endWithoutEvidence;
  }

  function limitationText(limitation: TrainingRangeSummaryLimitation): string {
    return copy.limitations[limitation];
  }

  function rangeSummary() {
    if (summaryLoading) return <p role="status">{copy.summaryLoading}</p>;
    if (summaryFailed) return (
      <div className="training-range-summary-failed">
        <p>{copy.summaryFailed}</p>
        <button type="button" className="secondary" onClick={() => setSummaryRetry((value) => value + 1)}>
          {copy.summaryRetry}
        </button>
      </div>
    );
    if (!summary) return null;
    const metric = summary.measurements[0];
    const boundaryLimitations = new Set<TrainingRangeSummaryLimitation>(["boundary-not-exact"]);
    return (
      <div className="training-range-result">
        <dl className="training-range-result-summary">
          <div>
            <dt>{copy.duration}</dt>
            <dd>{formatDuration(
              summary.elapsedDurationMilliseconds,
              locale,
              messages.training.durationUnits,
            )}</dd>
          </div>
          {summary.distance && (
            <div>
              <dt>{copy.distance}</dt>
              <dd>{formatSessionCardDistance(
                summary.distance.meters,
                locale,
                messages.training.units,
              )}</dd>
            </div>
          )}
          {summary.direction && (
            <div>
              <dt>{copy.direction}</dt>
              <dd>{interpolate(copy.directionValue, {
                cardinal: copy.directions[summary.direction.cardinal],
                degrees: summaryNumber.format(summary.direction.initialBearingDegrees),
              })}</dd>
            </div>
          )}
          {metric && (
            <div>
              <dt>{interpolate(copy.measurementName, {
                signal: messages.training.sessionLibrary.signalKinds[metric.kind],
              })}</dt>
              <dd>{interpolate(copy.measurementAverage, {
                value: summaryNumber.format(metric.average),
                unit: messages.training.sessionLibrary.signalUnits[metric.unit],
              })}</dd>
            </div>
          )}
          <div>
            <dt>{copy.coverage}</dt>
            <dd>{copy.coverageStates[summary.coverage.state]}</dd>
          </div>
        </dl>
        <details className="training-range-evidence-details">
          <summary>{copy.evidenceDetails}</summary>
          <section>
            <h5>{copy.coverageHeading}</h5>
            <p>{interpolate(copy.coverageCounts, {
              available: integer.format(summary.coverage.availableEvidenceCount),
              selected: integer.format(summary.coverage.selectedEvidenceCount),
            })}</p>
            {summary.coverage.missingIntervals.length > 0 && (
              <ul>{summary.coverage.missingIntervals.map((gap) => (
                <li key={`${gap.startedAtElapsedMilliseconds}-${gap.endedAtElapsedMilliseconds}`}>
                  {interpolate(copy.coverageGap, {
                    start: elapsedEditorValue(gap.startedAtElapsedMilliseconds),
                    end: elapsedEditorValue(gap.endedAtElapsedMilliseconds),
                  })}
                </li>
              ))}</ul>
            )}
            {summary.coverage.missingElapsedEvidenceCount > 0 && (
              <p>{interpolate(copy.coverageMissingElapsed, {
                count: integer.format(summary.coverage.missingElapsedEvidenceCount),
              })}</p>
            )}
            {summary.coverage.omittedMissingIntervalCount > 0 && (
              <p>{interpolate(copy.coverageOmittedGaps, {
                count: integer.format(summary.coverage.omittedMissingIntervalCount),
              })}</p>
            )}
          </section>
          <section>
            <h5>{copy.boundariesHeading}</h5>
            <ul>
              <li>{boundaryStatement("start", summary.boundaries.start.state)}</li>
              <li>{boundaryStatement("end", summary.boundaries.end.state)}</li>
            </ul>
          </section>
          {summary.measurements.length > 0 && (
            <section>
              <h5>{copy.measurementsHeading}</h5>
              {summary.measurements.map((measurement) => {
                const signal = messages.training.sessionLibrary.signalKinds[measurement.kind];
                const unit = messages.training.sessionLibrary.signalUnits[measurement.unit];
                return (
                  <div key={`${measurement.kind}-${measurement.unit}`}>
                    <p>{interpolate(copy.measurementDetail, {
                      signal,
                      minimum: number.format(measurement.minimum),
                      average: number.format(measurement.average),
                      maximum: number.format(measurement.maximum),
                      unit,
                    })}</p>
                    <p>{interpolate(copy.measurementCoverage, {
                      available: interpolate(
                        measurement.availableEvidenceCount === 1
                          ? copy.measurementAvailable.one
                          : copy.measurementAvailable.other,
                        { count: integer.format(measurement.availableEvidenceCount) },
                      ),
                      missing: interpolate(
                        measurement.missingEvidenceCount === 1
                          ? copy.measurementMissing.one
                          : copy.measurementMissing.other,
                        { count: integer.format(measurement.missingEvidenceCount) },
                      ),
                    })}</p>
                  </div>
                );
              })}
            </section>
          )}
          <section>
            <h5>{copy.sourceRangesHeading}</h5>
            {summary.sourceRanges.length === 0 ? <p>{copy.noSourceRanges}</p> : (
              <ul>{summary.sourceRanges.map((source) => {
                const timing = interpolate(copy.sourceRangeTiming, {
                  relation: copy.sourceRangeRelations[source.relation],
                  start: elapsedEditorValue(source.startedAtElapsedMilliseconds),
                  end: elapsedEditorValue(source.endedAtElapsedMilliseconds),
                });
                const distance = source.distanceMeters === null ? undefined
                  : interpolate(copy.sourceDistance, {
                    distance: formatSessionCardDistance(
                      source.distanceMeters,
                      locale,
                      messages.training.units,
                    ),
                  });
                return (
                  <li key={`${source.kind}-${source.ordinal}`}>
                    <strong>{interpolate(
                      source.kind === "manual-lap" ? copy.sourceLap : copy.automaticLap,
                      { number: integer.format(source.ordinal + 1) },
                    )}</strong>
                    <span>{distance ? `${timing} · ${distance}` : timing}</span>
                  </li>
                );
              })}</ul>
            )}
          </section>
          {summary.limitations.some((limitation) => !boundaryLimitations.has(limitation)) && (
            <section>
              <h5>{copy.limitsHeading}</h5>
              <ul>{summary.limitations
                .filter((limitation) => !boundaryLimitations.has(limitation))
                .map((limitation) => <li key={limitation}>{limitationText(limitation)}</li>)}</ul>
            </section>
          )}
        </details>
      </div>
    );
  }

  function selectedRangePanel(range: TrainingSessionRange) {
    const canAdjust = result ? rangeMayBeAdjusted(result, range) : false;
    const duration = (BigInt(range.endedAtElapsedMilliseconds)
      - BigInt(range.startedAtElapsedMilliseconds)).toString();
    return (
      <article className="training-range-inspector">
        <header>
          <div>
            <p>{copy.createdByYou}</p>
            <h4
              ref={selectedHeadingRef}
              className="training-result-focus-target"
              tabIndex={-1}
            >{range.title}</h4>
            <span>{rangeCoordinateLabel(range)} · {formatDuration(
              duration,
              locale,
              messages.training.durationUnits,
            )}</span>
          </div>
          <span className={range.state === "current" ? "current" : "review-required"}>
            {range.state === "current" ? copy.current : copy.reviewRequired}
          </span>
        </header>
        {range.state === "review-required" && (
          <aside className="training-range-review">
            <strong>{copy.reviewHeading}</strong>
            <p>{canAdjust ? copy.reviewHelp : copy.missingCoordinate}</p>
            {!canAdjust && <p>{copy.missingCoordinateHelp}</p>}
          </aside>
        )}
        {editor?.rangeRef === range.rangeRef ? editorForm() : (
          <>
            {rangeSummary()}
            <div className="training-range-actions">
              <button type="button" className="secondary" disabled={busy} onClick={() => openRenameEditor(range)}>
                {copy.rename}
              </button>
              {canAdjust && (
                <button type="button" className="secondary" disabled={busy} onClick={() => openAdjustEditor(range)}>
                  {range.state === "review-required" ? copy.review : copy.adjust}
                </button>
              )}
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setRemoveConfirmation(true)}
              >{copy.remove}</button>
            </div>
          </>
        )}
        {removeConfirmation && (
          <div
            className="training-range-remove-confirmation"
            role="group"
            aria-label={interpolate(copy.removeQuestion, { title: range.title })}
          >
            <strong>{interpolate(copy.removeQuestion, { title: range.title })}</strong>
            <p>{copy.removeHelp}</p>
            <div>
              <button type="button" className="secondary" disabled={busy} onClick={() => setRemoveConfirmation(false)}>
                {copy.keep}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void mutate("remove_training_session_range", {
                  sessionRef,
                  snapshotRef: result?.snapshotRef ?? snapshotRef,
                  rangeRef: range.rangeRef,
                  expectedRevision: range.revision,
                }, copy.removed, range.rangeRef)}
              >{copy.removeRange}</button>
              {mutationCommand === "remove_training_session_range" && (
                <span role="status" aria-live="polite">{copy.removing}</span>
              )}
            </div>
          </div>
        )}
      </article>
    );
  }

  return (
    <section
      className="training-ranges"
      aria-labelledby="training-ranges-heading"
      aria-busy={loading || busy}
    >
      <header className="training-ranges-heading">
        <div>
          <h3 id="training-ranges-heading">{copy.heading}</h3>
          <p>{copy.introduction}</p>
        </div>
        <button type="button" disabled={busy || editableChoices.length === 0} onClick={openCreateEditor}>
          {copy.create}
        </button>
      </header>
      {loading && <p role="status">{copy.loading}</p>}
      {failed && !loading && (
        <div className="training-ranges-failed">
          <p>{copy.failed}</p>
          <button type="button" className="secondary" onClick={() => void loadContext()}>
            {copy.retry}
          </button>
        </div>
      )}
      {status && <p className="training-ranges-status" role="status">{status}</p>}
      {editor?.mode === "create" && editorForm()}
      {!loading && !failed && result?.ranges.length === 0 && editor?.mode !== "create" && (
        <div className="training-ranges-empty">
          <strong>{copy.empty}</strong>
          <p>{editableChoices.length > 0 ? copy.emptyHelp : copy.noEditableTimeline}</p>
        </div>
      )}
      {!loading && !failed && result && result.ranges.length > 0 && (
        <div className="training-range-workspace">
          <nav aria-label={copy.listLabel}>
            <ul>{result.ranges.map((range) => (
              <li key={range.rangeRef}>
                <button
                  type="button"
                  aria-label={interpolate(copy.open, { title: range.title })}
                  aria-current={range.rangeRef === selectedRangeRef ? "page" : undefined}
                  onClick={(event) => {
                    setSelectedRangeRef(range.rangeRef);
                    setEditor(undefined);
                    setRemoveConfirmation(false);
                    setStatus(undefined);
                    requestSelectedRangeFocus(event.currentTarget);
                  }}
                >
                  <strong>{range.title}</strong>
                  <span>{rangeCoordinateLabel(range)}</span>
                  <small>{range.state === "current" ? copy.current : copy.reviewRequired}</small>
                </button>
              </li>
            ))}</ul>
          </nav>
          {selectedRange && selectedRangePanel(selectedRange)}
        </div>
      )}
    </section>
  );
}
