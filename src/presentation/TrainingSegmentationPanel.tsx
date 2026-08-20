import { type FormEvent, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { type catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import { formatDuration } from "./training-format";
import type {
  AppliedTrainingSegmentCriterion,
  SegmentCriterion,
  SegmentCriterionDefinition,
  TrainingExerciseSegmentation,
  TrainingSessionSegmentationResult,
} from "./training-session-segmentation";

type CriterionKind = SegmentCriterionDefinition["kind"];

const MINIMUM_SEGMENT_MINUTES = 0.001;
const MINIMUM_SEGMENT_KILOMETERS = 0.001;
const MAXIMUM_DISTANCE_METERS_EXCLUSIVE = 9_223_372_036_854_776;
const MAXIMUM_MANUAL_BOUNDARIES = 99;

interface EditorState {
  exerciseRef: string;
  criterionRef?: string;
  expectedRevision?: number;
  title: string;
  kind: CriterionKind;
  timeMinutes: string;
  distanceKilometers: string;
  minimumHeartRate: string;
  maximumHeartRate: string;
  manualMinutes: string;
}

interface TrainingSegmentationPanelProps {
  sessionRef: string;
  snapshotRef: string;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  onError: (code: string | undefined) => void;
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

function emptyEditor(exerciseRef: string): EditorState {
  return {
    exerciseRef,
    title: "",
    kind: "equal-elapsed-time",
    timeMinutes: "5",
    distanceKilometers: "1",
    minimumHeartRate: "140",
    maximumHeartRate: "159",
    manualMinutes: "5, 10",
  };
}

function minutes(milliseconds: string): string {
  return String(Number(milliseconds) / 60_000);
}

function editorFor(exerciseRef: string, criterion: SegmentCriterion): EditorState {
  const base = { ...emptyEditor(exerciseRef), criterionRef: criterion.criterionRef,
    expectedRevision: criterion.revision, title: criterion.title, kind: criterion.definition.kind };
  switch (criterion.definition.kind) {
    case "equal-elapsed-time":
      return { ...base, timeMinutes: minutes(criterion.definition.spanMilliseconds) };
    case "equal-distance":
      return { ...base, distanceKilometers: String(criterion.definition.spanMeters / 1_000) };
    case "heart-rate-zone":
      return {
        ...base,
        minimumHeartRate: String(criterion.definition.minimumBeatsPerMinute),
        maximumHeartRate: String(criterion.definition.maximumBeatsPerMinute),
      };
    case "manual-boundaries":
      return {
        ...base,
        manualMinutes: criterion.definition.elapsedMilliseconds.map(minutes).join(", "),
      };
  }
}

function positiveNumber(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function definitionFor(editor: EditorState): SegmentCriterionDefinition | undefined {
  switch (editor.kind) {
    case "equal-elapsed-time": {
      const value = positiveNumber(editor.timeMinutes);
      const milliseconds = value === undefined ? NaN : value * 60_000;
      return value !== undefined && value >= MINIMUM_SEGMENT_MINUTES
        && Number.isSafeInteger(milliseconds)
        ? { kind: editor.kind, spanMilliseconds: String(milliseconds) }
        : undefined;
    }
    case "equal-distance": {
      const value = positiveNumber(editor.distanceKilometers);
      const meters = value === undefined ? NaN : value * 1_000;
      return value !== undefined && value >= MINIMUM_SEGMENT_KILOMETERS
        && Number.isFinite(meters) && meters < MAXIMUM_DISTANCE_METERS_EXCLUSIVE
        ? { kind: editor.kind, spanMeters: meters }
        : undefined;
    }
    case "heart-rate-zone": {
      const minimum = Number(editor.minimumHeartRate);
      const maximum = Number(editor.maximumHeartRate);
      return Number.isInteger(minimum) && Number.isInteger(maximum)
        && minimum >= 20 && maximum <= 300 && minimum <= maximum
        ? {
          kind: editor.kind,
          minimumBeatsPerMinute: minimum,
          maximumBeatsPerMinute: maximum,
        }
        : undefined;
    }
    case "manual-boundaries": {
      const values = editor.manualMinutes.split(",").map((value) => positiveNumber(value.trim()));
      if (values.length === 0 || values.length > MAXIMUM_MANUAL_BOUNDARIES
        || values.some((value) => value === undefined)) return undefined;
      const elapsedMilliseconds = values.map((value) => (value ?? 0) * 60_000);
      if (elapsedMilliseconds.some((value) => !Number.isSafeInteger(value))
        || elapsedMilliseconds.some((value, index) => index > 0
          && value <= elapsedMilliseconds[index - 1])) return undefined;
      return { kind: editor.kind, elapsedMilliseconds: elapsedMilliseconds.map(String) };
    }
  }
}

function definitionSummary(
  criterion: SegmentCriterion,
  locale: Locale,
  messages: (typeof catalogs)["en-US"],
): string {
  const copy = messages.training.sessionLibrary;
  switch (criterion.definition.kind) {
    case "equal-elapsed-time":
      return interpolate(copy.segmentEqualTimeSummary, {
        value: formatDuration(
          criterion.definition.spanMilliseconds,
          locale,
          messages.training.durationUnits,
        ),
      });
    case "equal-distance":
      return interpolate(copy.segmentEqualDistanceSummary, {
        value: new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(
          criterion.definition.spanMeters / 1_000,
        ),
      });
    case "heart-rate-zone":
      return interpolate(copy.segmentHeartRateSummary, {
        minimum: new Intl.NumberFormat(locale).format(
          criterion.definition.minimumBeatsPerMinute,
        ),
        maximum: new Intl.NumberFormat(locale).format(
          criterion.definition.maximumBeatsPerMinute,
        ),
      });
    case "manual-boundaries":
      return interpolate(copy.segmentManualSummary, {
        count: new Intl.NumberFormat(locale).format(
          criterion.definition.elapsedMilliseconds.length,
        ),
      });
  }
}

export function TrainingSegmentationPanel({
  sessionRef,
  snapshotRef,
  locale,
  messages,
  onError,
}: TrainingSegmentationPanelProps) {
  const [result, setResult] = useState<TrainingSessionSegmentationResult>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<EditorState>();
  const [reuseSelections, setReuseSelections] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string>();
  const copy = messages.training.sessionLibrary;
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    setEditor(undefined);
    setStatus(undefined);
    void invoke<TrainingSessionSegmentationResult>("query_training_session_segmentation", {
      query: { sessionRef, snapshotRef },
    }).then((value) => {
      if (active) setResult(value);
    }).catch(() => {
      if (!active) return;
      setFailed(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [sessionRef, snapshotRef]);

  async function mutate(
    command: string,
    request: Record<string, unknown>,
    success: string,
  ) {
    setBusy(true);
    setStatus(undefined);
    try {
      const updated = await invoke<TrainingSessionSegmentationResult>(command, { request });
      setResult(updated);
      setEditor(undefined);
      setStatus(success);
      onError(undefined);
    } catch (reason) {
      onError(commandErrorCode(reason));
    } finally {
      setBusy(false);
    }
  }

  function submitEditor(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;
    const definition = definitionFor(editor);
    const title = editor.title.trim();
    if (!definition || title.length === 0 || [...title].length > 80) return;
    if (editor.criterionRef && editor.expectedRevision) {
      void mutate("update_training_segment_criterion", {
        sessionRef,
        snapshotRef,
        criterionRef: editor.criterionRef,
        expectedRevision: editor.expectedRevision,
        title,
        definition,
      }, copy.segmentUpdated);
    } else {
      void mutate("create_training_segment_criterion", {
        sessionRef,
        snapshotRef,
        exerciseRef: editor.exerciseRef,
        title,
        definition,
      }, copy.segmentCreated);
    }
  }

  function mutationRequest(exerciseRef: string, criterionRef: string) {
    return { sessionRef, snapshotRef, exerciseRef, criterionRef };
  }

  function timeline(
    applied: AppliedTrainingSegmentCriterion,
    exercise: TrainingExerciseSegmentation,
  ) {
    if (applied.applicability !== "applicable" || applied.segments.length === 0) return null;
    const duration = Number(exercise.durationMilliseconds);
    const label = interpolate(copy.segmentTimelineSummary, {
      title: applied.criterion.title,
      count: number.format(applied.segments.length),
    });
    return (
      <div className="training-segment-timeline" role="img" aria-label={label}>
        {applied.segments.map((segment) => {
          const start = Number(segment.startedAtElapsedMilliseconds);
          const end = Number(segment.endedAtElapsedMilliseconds);
          return (
            <span
              key={segment.ordinal}
              style={{ left: `${start / duration * 100}%`, width: `${(end - start) / duration * 100}%` }}
            >{number.format(segment.ordinal + 1)}</span>
          );
        })}
      </div>
    );
  }

  function criterionCard(
    applied: AppliedTrainingSegmentCriterion,
    exercise: TrainingExerciseSegmentation,
  ) {
    const applicability = copy.segmentApplicability[applied.applicability];
    return (
      <article className="training-segment-criterion" key={applied.criterion.criterionRef}>
        <header>
          <div>
            <p>{copy.segmentAuthoredByYou}</p>
            <h6>{applied.criterion.title}</h6>
            <span>
              {definitionSummary(applied.criterion, locale, messages)}
              {" · "}
              {interpolate(copy.segmentCriterionVersion, {
                evaluation: number.format(applied.criterion.evaluationVersion),
                revision: number.format(applied.criterion.revision),
              })}
            </span>
          </div>
          <span>{copy.segmentCalculatedByFitFreed}</span>
        </header>
        <p className={`training-segment-applicability ${applied.applicability}`}>
          {applicability}
        </p>
        {applied.hasEvidenceGaps && <p className="notice">{copy.segmentEvidenceGaps}</p>}
        {applied.applicability === "applicable" && applied.segments.length === 0
          && <p>{copy.segmentNoMatches}</p>}
        {timeline(applied, exercise)}
        {applied.segments.length > 0 && (
          <div className="training-table-scroll" tabIndex={0}>
            <table>
              <thead><tr>
                <th scope="col">{copy.segmentNumber}</th>
                <th scope="col">{copy.segmentStart}</th>
                <th scope="col">{copy.segmentEnd}</th>
                <th scope="col">{messages.training.duration}</th>
                <th scope="col">{copy.segmentAttribution}</th>
              </tr></thead>
              <tbody>{applied.segments.map((segment) => (
                <tr key={segment.ordinal}>
                  <th scope="row">{number.format(segment.ordinal + 1)}</th>
                  <td>{formatDuration(segment.startedAtElapsedMilliseconds, locale, messages.training.durationUnits)}</td>
                  <td>{formatDuration(segment.endedAtElapsedMilliseconds, locale, messages.training.durationUnits)}</td>
                  <td>{formatDuration(
                    (BigInt(segment.endedAtElapsedMilliseconds)
                      - BigInt(segment.startedAtElapsedMilliseconds)).toString(),
                    locale,
                    messages.training.durationUnits,
                  )}</td>
                  <td>{copy.segmentCalculatedByFitFreed}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <div className="training-segment-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy || applied.ordinal === 0}
            onClick={() => void mutate("move_training_segment_criterion", {
              ...mutationRequest(exercise.exerciseRef, applied.criterion.criterionRef),
              direction: "earlier",
            }, copy.segmentReordered)}
          >{copy.segmentMoveEarlier}</button>
          <button
            type="button"
            className="secondary"
            disabled={busy || applied.ordinal + 1 === exercise.appliedCriteria.length}
            onClick={() => void mutate("move_training_segment_criterion", {
              ...mutationRequest(exercise.exerciseRef, applied.criterion.criterionRef),
              direction: "later",
            }, copy.segmentReordered)}
          >{copy.segmentMoveLater}</button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => setEditor(editorFor(exercise.exerciseRef, applied.criterion))}
          >{copy.segmentConfigure}</button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => void mutate(
              "remove_training_segment_criterion",
              mutationRequest(exercise.exerciseRef, applied.criterion.criterionRef),
              copy.segmentRemoved,
            )}
          >{copy.segmentRemove}</button>
        </div>
      </article>
    );
  }

  function editorForm() {
    if (!editor) return null;
    const definition = definitionFor(editor);
    const titleInvalid = editor.title.trim().length === 0 || [...editor.title.trim()].length > 80;
    const definitionInvalid = !definition;
    return (
      <form className="training-segment-editor" onSubmit={submitEditor}>
        <h6>{editor.criterionRef ? copy.segmentEditHeading : copy.segmentCreateHeading}</h6>
        {editor.criterionRef && <p>{copy.segmentEditReuseWarning}</p>}
        <label>
          <span>{copy.segmentTitle}</span>
          <input
            value={editor.title}
            maxLength={80}
            aria-invalid={titleInvalid}
            aria-describedby={titleInvalid ? "training-segment-editor-error" : undefined}
            disabled={busy}
            onChange={(event) => setEditor({ ...editor, title: event.target.value })}
          />
        </label>
        <label>
          <span>{copy.segmentKind}</span>
          <select
            value={editor.kind}
            disabled={busy}
            onChange={(event) => setEditor({ ...editor, kind: event.target.value as CriterionKind })}
          >
            {Object.entries(copy.segmentKinds).map(([kind, label]) => (
              <option value={kind} key={kind}>{label}</option>
            ))}
          </select>
        </label>
        {editor.kind === "equal-elapsed-time" && (
          <label><span>{copy.segmentMinutes}</span><input type="number" min={MINIMUM_SEGMENT_MINUTES} step="0.001" value={editor.timeMinutes} aria-invalid={definitionInvalid} aria-describedby={definitionInvalid ? "training-segment-editor-error" : undefined} disabled={busy} onChange={(event) => setEditor({ ...editor, timeMinutes: event.target.value })} /></label>
        )}
        {editor.kind === "equal-distance" && (
          <label><span>{copy.segmentKilometers}</span><input type="number" min={MINIMUM_SEGMENT_KILOMETERS} step="0.001" value={editor.distanceKilometers} aria-invalid={definitionInvalid} aria-describedby={definitionInvalid ? "training-segment-editor-error" : undefined} disabled={busy} onChange={(event) => setEditor({ ...editor, distanceKilometers: event.target.value })} /></label>
        )}
        {editor.kind === "heart-rate-zone" && (
          <div className="training-segment-editor-pair">
            <label><span>{copy.segmentMinimumHeartRate}</span><input type="number" min="20" max="300" step="1" value={editor.minimumHeartRate} aria-invalid={definitionInvalid} aria-describedby={definitionInvalid ? "training-segment-editor-error" : undefined} disabled={busy} onChange={(event) => setEditor({ ...editor, minimumHeartRate: event.target.value })} /></label>
            <label><span>{copy.segmentMaximumHeartRate}</span><input type="number" min="20" max="300" step="1" value={editor.maximumHeartRate} aria-invalid={definitionInvalid} aria-describedby={definitionInvalid ? "training-segment-editor-error" : undefined} disabled={busy} onChange={(event) => setEditor({ ...editor, maximumHeartRate: event.target.value })} /></label>
          </div>
        )}
        {editor.kind === "manual-boundaries" && (
          <label><span>{copy.segmentManualMinutes}</span><input value={editor.manualMinutes} disabled={busy} aria-invalid={definitionInvalid} aria-describedby={definitionInvalid ? "training-segment-manual-help training-segment-editor-error" : "training-segment-manual-help"} onChange={(event) => setEditor({ ...editor, manualMinutes: event.target.value })} /><small id="training-segment-manual-help">{copy.segmentManualHelp}</small></label>
        )}
        {(definitionInvalid || titleInvalid) && <p id="training-segment-editor-error" role="alert">{copy.segmentInvalid}</p>}
        <div className="training-segment-actions">
          <button type="button" className="secondary" disabled={busy} onClick={() => setEditor(undefined)}>{copy.segmentCancel}</button>
          <button type="submit" disabled={busy || !definition || titleInvalid}>{busy ? copy.segmentSaving : copy.segmentSave}</button>
        </div>
      </form>
    );
  }

  function exercisePanel(exercise: TrainingExerciseSegmentation) {
    const appliedRefs = new Set(exercise.appliedCriteria.map(
      (applied) => applied.criterion.criterionRef,
    ));
    const reusable = result?.availableCriteria.filter(
      (criterion) => !appliedRefs.has(criterion.criterionRef),
    ) ?? [];
    const selectedReusable = reuseSelections[exercise.exerciseRef] ?? reusable[0]?.criterionRef ?? "";
    return (
      <section className="training-exercise-segmentation" key={exercise.exerciseRef}>
        <h5>{interpolate(copy.segmentExerciseHeading, {
          number: number.format(exercise.ordinal + 1),
        })}</h5>
        {exercise.appliedCriteria.length === 0
          ? <p>{copy.segmentEmpty}</p>
          : exercise.appliedCriteria.map((applied) => criterionCard(applied, exercise))}
        <div className="training-segment-add-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => setEditor(emptyEditor(exercise.exerciseRef))}
          >{copy.segmentCreate}</button>
          <label>
            <span>{copy.segmentReuse}</span>
            <select
              value={selectedReusable}
              disabled={busy || reusable.length === 0}
              onChange={(event) => setReuseSelections({
                ...reuseSelections,
                [exercise.exerciseRef]: event.target.value,
              })}
            >
              {reusable.length === 0 && <option value="">{copy.segmentNoReusable}</option>}
              {reusable.map((criterion) => (
                <option value={criterion.criterionRef} key={criterion.criterionRef}>
                  {criterion.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="secondary"
            disabled={busy || !selectedReusable}
            onClick={() => void mutate(
              "apply_training_segment_criterion",
              mutationRequest(exercise.exerciseRef, selectedReusable),
              copy.segmentApplied,
            )}
          >{copy.segmentApplyReusable}</button>
        </div>
        {editor?.exerciseRef === exercise.exerciseRef && editorForm()}
      </section>
    );
  }

  return (
    <section className="training-segmentation" aria-labelledby="training-segmentation-heading" aria-busy={loading || busy}>
      <h4 id="training-segmentation-heading">{copy.segmentHeading}</h4>
      <p>{copy.segmentIntro}</p>
      <aside className="training-segment-attribution">
        <strong>{copy.segmentAttributionHeading}</strong>
        <p>{copy.segmentAttributionIntro}</p>
      </aside>
      {loading && <p role="status">{copy.segmentLoading}</p>}
      {failed && <p className="error" role="alert">{copy.segmentFailed}</p>}
      {status && <p className="notice" role="status">{status}</p>}
      {!loading && result?.exercises === null && <p>{copy.segmentNotEvaluated}</p>}
      {!loading && result?.exercises?.length === 0 && <p>{copy.segmentNoExercises}</p>}
      {result?.exercises?.map(exercisePanel)}
    </section>
  );
}
