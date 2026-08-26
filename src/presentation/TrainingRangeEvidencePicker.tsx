import { useEffect, useMemo, useState } from "react";

import { type catalogs, type Locale } from "../locales/catalogs";
import { coordinateKey, elapsedEditorValue } from "./training-range-editor-model";
import {
  type TrainingRangeEditorSurface,
  useOptionalTrainingRangeInteraction,
} from "./TrainingRangeInteractionProvider";
import { formatExactDuration } from "./presentation-format";
import type { TrainingSessionCurrentRangeCoordinate } from "./training-session-range";

export interface TrainingRangeEvidenceEntry {
  key: string;
  label: string;
  startedAtElapsedMilliseconds: string;
  endedAtElapsedMilliseconds: string;
}

interface TrainingRangeEvidencePickerProps {
  surface: TrainingRangeEditorSurface;
  exerciseRef: string;
  coordinate: TrainingSessionCurrentRangeCoordinate;
  entries: TrainingRangeEvidenceEntry[];
  selectedEntryKey?: string;
  selectionLabel: string;
  meaning: string;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
}

interface RangeBounds {
  startedAtElapsedMilliseconds: string;
  endedAtElapsedMilliseconds: string;
}

function createBounds(
  entries: TrainingRangeEvidenceEntry[],
  selectedIndex: number,
): RangeBounds | null {
  const selected = entries[selectedIndex];
  if (!selected) return null;
  const startedAt = BigInt(selected.startedAtElapsedMilliseconds);
  const endedAt = BigInt(selected.endedAtElapsedMilliseconds);
  if (startedAt < endedAt) {
    return {
      startedAtElapsedMilliseconds: selected.startedAtElapsedMilliseconds,
      endedAtElapsedMilliseconds: selected.endedAtElapsedMilliseconds,
    };
  }
  const following = entries.slice(selectedIndex + 1).find(
    (entry) => BigInt(entry.startedAtElapsedMilliseconds) > startedAt,
  );
  if (following) {
    return {
      startedAtElapsedMilliseconds: selected.startedAtElapsedMilliseconds,
      endedAtElapsedMilliseconds: following.startedAtElapsedMilliseconds,
    };
  }
  const preceding = entries.slice(0, selectedIndex).reverse().find(
    (entry) => BigInt(entry.startedAtElapsedMilliseconds) < startedAt,
  );
  return preceding ? {
    startedAtElapsedMilliseconds: preceding.startedAtElapsedMilliseconds,
    endedAtElapsedMilliseconds: selected.startedAtElapsedMilliseconds,
  } : null;
}

export function TrainingRangeEvidencePicker({
  surface,
  exerciseRef,
  coordinate,
  entries,
  selectedEntryKey,
  selectionLabel,
  meaning,
  locale,
  messages,
}: TrainingRangeEvidencePickerProps) {
  const interaction = useOptionalTrainingRangeInteraction();
  const signature = entries.map((entry) => entry.key).join("|");
  const initialKey = entries.some((entry) => entry.key === selectedEntryKey)
    ? selectedEntryKey!
    : entries[0]?.key ?? "";
  const [entryKey, setEntryKey] = useState(initialKey);
  const entryIndex = Math.max(0, entries.findIndex((entry) => entry.key === entryKey));
  const entry = entries[entryIndex];
  const copy = messages.training.sessionLibrary.ranges;
  const bounds = useMemo(() => createBounds(entries, entryIndex), [entries, entryIndex]);
  const coordinateId = coordinateKey(coordinate);
  const coordinateAvailable = interaction?.editableChoices.some((exercise) => (
    exercise.exerciseRef === exerciseRef
    && exercise.coordinates.some((candidate) => coordinateKey(candidate.coordinate) === coordinateId)
  )) ?? false;
  const editorMatches = interaction?.editor?.exerciseRef === exerciseRef
    && interaction.editor.coordinate !== null
    && coordinateKey(interaction.editor.coordinate) === coordinateId;
  const editorElsewhere = interaction?.editor !== undefined && !editorMatches;

  useEffect(() => {
    setEntryKey(initialKey);
  }, [initialKey, signature]);

  if (entries.length === 0 || !interaction) return null;

  function entryTiming(selected: TrainingRangeEvidenceEntry): string {
    const start = formatExactDuration(
      selected.startedAtElapsedMilliseconds,
      locale,
      messages.training.durationUnits,
    );
    if (selected.startedAtElapsedMilliseconds === selected.endedAtElapsedMilliseconds) return start;
    return `${start}–${formatExactDuration(
      selected.endedAtElapsedMilliseconds,
      locale,
      messages.training.durationUnits,
    )}`;
  }

  return (
    <section className="training-range-evidence-picker" aria-label={selectionLabel}>
      <label>
        <span>{selectionLabel}</span>
        <select
          value={entry?.key ?? ""}
          disabled={interaction.loading || interaction.failed || interaction.busy || editorElsewhere}
          onChange={(event) => setEntryKey(event.target.value)}
        >
          {entries.map((candidate) => (
            <option key={candidate.key} value={candidate.key}>{candidate.label}</option>
          ))}
        </select>
      </label>
      {entry && (
        <p className="training-range-evidence-picker-selection">
          <strong>{entry.label}</strong>
          <span>{entryTiming(entry)}</span>
        </p>
      )}
      <p className="training-range-evidence-picker-meaning">{meaning}</p>
      {editorMatches && entry ? (
        <div className="training-range-evidence-picker-actions">
          <button
            type="button"
            className="secondary"
            disabled={interaction.busy}
            onClick={() => interaction.updateEditor({
              startedAt: elapsedEditorValue(entry.startedAtElapsedMilliseconds),
            })}
          >{copy.useEvidenceStart}</button>
          <button
            type="button"
            className="secondary"
            disabled={interaction.busy}
            onClick={() => interaction.updateEditor({
              endedAt: elapsedEditorValue(entry.endedAtElapsedMilliseconds),
            })}
          >{copy.useEvidenceEnd}</button>
        </div>
      ) : !editorElsewhere && bounds ? (
        <button
          type="button"
          disabled={interaction.loading || interaction.failed || interaction.busy
            || !coordinateAvailable}
          onClick={() => interaction.openCreateEditor(surface, {
            exerciseRef,
            coordinate,
            ...bounds,
          })}
        >{copy.createFromEvidence}</button>
      ) : (
        <p className="training-range-evidence-picker-note">
          {editorElsewhere ? copy.finishEvidenceEdit : copy.evidenceRangeUnavailable}
        </p>
      )}
    </section>
  );
}
