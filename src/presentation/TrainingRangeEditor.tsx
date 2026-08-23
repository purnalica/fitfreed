import { type FormEvent, type Ref } from "react";

import { type catalogs } from "../locales/catalogs";
import {
  coordinateKey,
  elapsedEditorValue,
  MAX_ELAPSED_EDITOR_CHARACTERS,
  MAX_RANGE_TITLE_CHARACTERS,
} from "./training-range-editor-model";
import {
  type TrainingRangeEditorSurface,
  useTrainingRangeInteraction,
} from "./TrainingRangeInteractionProvider";

const MAX_RANGE_TITLE_INPUT_CODE_UNITS = MAX_RANGE_TITLE_CHARACTERS * 2;

interface TrainingRangeEditorProps {
  surface: TrainingRangeEditorSurface;
  messages: (typeof catalogs)["en-US"];
  lockCoordinate?: boolean;
  headingRef?: Ref<HTMLHeadingElement>;
  onSaved?: () => void;
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

export function TrainingRangeEditor({
  surface,
  messages,
  lockCoordinate = false,
  headingRef,
  onSaved,
}: TrainingRangeEditorProps) {
  const {
    editor,
    editorRange,
    editorExercise,
    editorMaximum,
    editorValidation,
    choices,
    editableChoices,
    busy,
    updateEditor,
    cancelEditor,
    submitEditor,
    rangeCoordinateLabel,
  } = useTrainingRangeInteraction();
  if (!editor || editor.surface !== surface) return null;

  const copy = messages.training.sessionLibrary.ranges;
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
  const headingId = `training-range-editor-heading-${surface}`;
  const helpId = `training-range-elapsed-help-${surface}`;
  const errorId = `training-range-editor-error-${surface}`;
  const showCoordinateChoice = !lockCoordinate && (editor.mode === "create" || isLegacyAdjustment);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitEditor().then((outcome) => {
      if (outcome === "success") onSaved?.();
    });
  }

  return (
    <form
      className="training-range-editor"
      aria-labelledby={headingId}
      aria-busy={busy}
      onSubmit={submit}
    >
      {editor.mode === "create"
        ? <h4 ref={headingRef} id={headingId} tabIndex={-1}>{heading}</h4>
        : <h5 ref={headingRef} id={headingId} tabIndex={-1}>{heading}</h5>}
      {showCoordinateChoice && (
        <div className="training-range-editor-coordinate">
          <label>
            <span>{copy.exercise}</span>
            <select
              aria-label={copy.exercise}
              value={editor.exerciseRef}
              disabled={busy || choices.length === 0}
              onChange={(event) => {
                const exercise = editableChoices.find(
                  (choice) => choice.exerciseRef === event.target.value,
                );
                updateEditor({
                  exerciseRef: event.target.value,
                  coordinate: exercise?.coordinates[0]?.coordinate ?? null,
                });
              }}
            >
              {editableChoices.map((choice) => (
                <option value={choice.exerciseRef} key={choice.id}>{choice.exerciseLabel}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy.timeline}</span>
            <select
              aria-label={copy.timeline}
              value={editor.coordinate === null ? "" : coordinateKey(editor.coordinate)}
              disabled={busy || !editorExercise}
              onChange={(event) => updateEditor({
                coordinate: editorExercise?.coordinates.find(
                  (choice) => coordinateKey(choice.coordinate) === event.target.value,
                )?.coordinate ?? null,
              })}
            >
              {editorExercise?.coordinates.map((choice) => (
                <option value={coordinateKey(choice.coordinate)} key={choice.id}>{choice.label}</option>
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
            aria-describedby={editor.dirty && titleInvalid ? errorId : undefined}
            disabled={busy}
            onChange={(event) => updateEditor({ title: event.target.value })}
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
                aria-describedby={editor.dirty && boundsInvalid ? `${helpId} ${errorId}` : helpId}
                disabled={busy}
                onChange={(event) => updateEditor({ startedAt: event.target.value })}
              />
            </label>
            <label>
              <span>{copy.end}</span>
              <input
                value={editor.endedAt}
                inputMode="decimal"
                maxLength={MAX_ELAPSED_EDITOR_CHARACTERS}
                aria-invalid={editor.dirty && boundsInvalid}
                aria-describedby={editor.dirty && boundsInvalid ? `${helpId} ${errorId}` : helpId}
                disabled={busy}
                onChange={(event) => updateEditor({ endedAt: event.target.value })}
              />
            </label>
          </div>
          <p id={helpId} className="training-range-editor-help">
            {copy.elapsedHelp}
            {editorMaximum && ` ${interpolate(copy.availableThrough, {
              time: elapsedEditorValue(editorMaximum),
            })}`}
          </p>
        </>
      )}
      {editor.dirty && invalid && (
        <p id={errorId} className="field-error" role="alert">
          {isRename ? copy.nameInvalid : copy.editorInvalid}
        </p>
      )}
      <div className="training-range-editor-actions">
        <button type="button" className="secondary" disabled={busy} onClick={cancelEditor}>
          {copy.cancel}
        </button>
        <button type="submit" disabled={busy || invalid}>{action}</button>
        {busy && <span role="status" aria-live="polite">{progress}</span>}
      </div>
    </form>
  );
}
