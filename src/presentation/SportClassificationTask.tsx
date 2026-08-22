import { type FormEvent, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { type catalogs } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import { ProgressSubmitButton } from "./ProgressSubmitButton";
import { SportFamilyIcon } from "./SportFamilyIcon";
import {
  sportFamilies,
  type SavedTrainingSportClassification,
  type SportFamily,
  type TrainingSport,
  type TrainingSportsOverview,
} from "./training-sports";

type TrainingSportsMessages = (typeof catalogs)["en-US"]["training"]["sports"];

interface SportClassificationTaskProps {
  editorId: string;
  sport: TrainingSport;
  title: string;
  messages: TrainingSportsMessages;
  onCancel: () => void;
  onBusyChange?: (busy: boolean) => void;
  onError: (code: string | undefined) => void;
  onOverviewChange: (overview: TrainingSportsOverview) => void;
  onSaved: (result: SavedTrainingSportClassification) => void;
}

interface ClassificationDraft {
  family: SportFamily | "";
  label: string;
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

export function SportClassificationTask({
  editorId,
  sport,
  title,
  messages,
  onCancel,
  onBusyChange = () => undefined,
  onError,
  onOverviewChange,
  onSaved,
}: SportClassificationTaskProps) {
  const [draft, setDraft] = useState<ClassificationDraft>(() => ({
    family: sport.classification?.canonicalFamily ?? "",
    label: sport.classification?.displayLabel ?? "",
  }));
  const [operation, setOperation] = useState<"save" | "reset">();
  const [conflict, setConflict] = useState(false);
  const observedRevision = useRef(sport.classification?.revision);
  const busy = operation !== undefined;
  const labelTooLong = [...draft.label.trim()].length > 80;
  const familyId = `${editorId}-family`;
  const labelId = `${editorId}-label`;
  const labelHelpId = `${editorId}-label-help`;
  const labelErrorId = `${editorId}-label-error`;

  useEffect(() => {
    const nextRevision = sport.classification?.revision;
    if (observedRevision.current !== nextRevision) setConflict(true);
    observedRevision.current = nextRevision;
  }, [sport.classification?.revision]);

  async function persist(
    canonicalFamily: SportFamily | null,
    displayLabel: string | null,
    nextOperation: "save" | "reset",
  ) {
    if (!sport.sportRef || !sport.classification) return;
    setOperation(nextOperation);
    onBusyChange(true);
    setConflict(false);
    onError(undefined);
    try {
      const result = await invoke<SavedTrainingSportClassification>(
        "save_training_sport_classification",
        {
          request: {
            sportRef: sport.sportRef,
            expectedRevision: sport.classification.revision,
            canonicalFamily,
            displayLabel,
          },
        },
      );
      onOverviewChange(result.overview);
      onSaved(result);
    } catch (reason) {
      const code = commandErrorCode(reason);
      onError(code);
      if (code === "sport-classification-conflict") {
        try {
          const overview = await invoke<TrainingSportsOverview>("query_training_sports");
          onOverviewChange(overview);
          setConflict(true);
        } catch (reloadReason) {
          onError(commandErrorCode(reloadReason));
        }
      }
    } finally {
      setOperation(undefined);
      onBusyChange(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = draft.label.trim();
    void persist(draft.family || null, label || null, "save");
  }

  const previewLabel = draft.label.trim()
    || (draft.family ? messages.families[draft.family] : title);

  return (
    <form
      className="training-sport-editor"
      aria-label={interpolate(messages.editorHeading, { sport: title })}
      aria-busy={busy}
      onSubmit={submit}
    >
      <div className="training-sport-editor-preview" aria-live="polite">
        <SportFamilyIcon family={draft.family || null} state={sport.state} />
        <strong>{previewLabel}</strong>
      </div>
      {conflict && (
        <div className="training-sport-editor-conflict" role="alert">
          <p>{messages.conflict}</p>
          <strong>{interpolate(messages.currentSaved, {
            sport: title,
          })}</strong>
        </div>
      )}
      <div className="training-sport-editor-field">
        <label htmlFor={familyId}>{messages.family}</label>
        <select
          id={familyId}
          value={draft.family}
          disabled={busy}
          onChange={(event) => setDraft((current) => ({
            ...current,
            family: event.target.value as SportFamily | "",
          }))}
        >
          <option value="">{messages.noFamily}</option>
          {sportFamilies.map((family) => (
            <option key={family} value={family}>{messages.families[family]}</option>
          ))}
        </select>
      </div>
      <div className="training-sport-editor-field">
        <label htmlFor={labelId}>{messages.displayLabel}</label>
        <input
          id={labelId}
          value={draft.label}
          aria-invalid={labelTooLong}
          aria-describedby={labelTooLong
            ? `${labelHelpId} ${labelErrorId}`
            : labelHelpId}
          disabled={busy}
          onChange={(event) => setDraft((current) => ({
            ...current,
            label: event.target.value,
          }))}
        />
        <small id={labelHelpId}>{messages.displayLabelHelp}</small>
        {labelTooLong && (
          <small id={labelErrorId} className="field-error" role="alert">
            {messages.displayLabelTooLong}
          </small>
        )}
      </div>
      <div className="training-sport-editor-actions">
        <button type="button" className="secondary" disabled={busy} onClick={onCancel}>
          {messages.cancel}
        </button>
        {sport.state === "classified" && (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => void persist(null, null, "reset")}
          >
            {messages.reset}
          </button>
        )}
        <ProgressSubmitButton
          loading={operation === "save"}
          disabled={busy || labelTooLong || (!draft.family && !draft.label.trim())}
          actionLabel={messages.save}
          progressLabel={messages.saving}
        />
        {operation === "reset" && (
          <span className="progress-submit-status" role="status" aria-live="polite">
            {messages.resetting}
          </span>
        )}
      </div>
    </form>
  );
}
