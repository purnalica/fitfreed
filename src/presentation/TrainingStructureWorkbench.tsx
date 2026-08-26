import { useEffect, useMemo, useState } from "react";

import { type catalogs, type Locale } from "../locales/catalogs";
import type { SessionStory, SessionStoryExercise } from "./session-story";
import { SportFamilyIcon } from "./SportFamilyIcon";
import { sportCanonicalFamily } from "./training-sports";
import { parseElapsedEditorValue } from "./training-range-editor-model";
import { formatDetailDuration, integerCountFormatter } from "./presentation-format";
import { formatSessionCardDistance } from "./training-format";
import { TrainingRangeEvidenceEditor } from "./TrainingRangeEvidenceEditor";
import {
  type TrainingRangeEvidenceEntry,
  TrainingRangeEvidencePicker,
} from "./TrainingRangeEvidencePicker";
import { useOptionalTrainingRangeInteraction } from "./TrainingRangeInteractionProvider";
import type { TrainingLapStructure } from "./training-session-detail";

interface TrainingStructureWorkbenchProps {
  story: SessionStory;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  exerciseLabel: (exercise: SessionStoryExercise) => string;
  onOpenStructure: (initiatingElement: HTMLButtonElement) => void;
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

function percentage(value: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  const clamped = value < 0n ? 0n : value > total ? total : value;
  return Number(clamped * 10_000n / total) / 100;
}

export function TrainingStructureWorkbench({
  story,
  locale,
  messages,
  exerciseLabel,
  onOpenStructure,
}: TrainingStructureWorkbenchProps) {
  const rangeInteraction = useOptionalTrainingRangeInteraction();
  const exercises = useMemo(
    () => story.exercises.filter((exercise) => exercise.structure !== null),
    [story],
  );
  const signature = exercises.map((exercise) => exercise.exerciseRef).join("|");
  const [exerciseRef, setExerciseRef] = useState(() => exercises[0]?.exerciseRef ?? "");
  const exercise = exercises.find((candidate) => candidate.exerciseRef === exerciseRef)
    ?? exercises[0];
  const copy = messages.training.sessionLibrary.structureWorkbench;
  const sessionCopy = messages.training.sessionLibrary;
  const number = useMemo(() => integerCountFormatter(locale), [locale]);

  useEffect(() => {
    setExerciseRef(exercises[0]?.exerciseRef ?? "");
  }, [signature]);

  if (!exercise?.structure) return null;

  const structure = exercise.structure;
  const manualLaps = structure.manualLaps ?? [];
  const automaticLaps = structure.automaticLaps ?? [];
  const pauseCount = structure.pauses?.length ?? 0;
  const duration = formatDetailDuration(
    structure.durationMilliseconds,
    locale,
    messages.training.durationUnits,
  );
  const distance = structure.distanceMeters === null
    ? sessionCopy.metricUnavailable
    : formatSessionCardDistance(
        structure.distanceMeters,
        locale,
        messages.training.units,
      );
  const count = (value: number, unit: { one: string; other: string }) => (
    `${number.format(value)} ${value === 1 ? unit.one : unit.other}`
  );
  const sourceLapCount = count(manualLaps.length, copy.sourceLapUnit);
  const automaticLapCount = count(automaticLaps.length, copy.automaticLapUnit);
  const pauses = count(pauseCount, copy.pauseUnit);
  const chartSummary = interpolate(copy.chartSummary, {
    exercise: number.format(exercise.ordinal + 1),
    sourceLaps: sourceLapCount,
    automaticLaps: automaticLapCount,
    pauses,
    duration,
  });
  const totalDuration = BigInt(structure.durationMilliseconds);
  const exerciseCoordinate = { scope: "exercise-elapsed" as const };
  const rangeEntries: TrainingRangeEvidenceEntry[] = totalDuration > 0n ? [{
    key: "exercise",
    label: copy.completeExercise,
    startedAtElapsedMilliseconds: "0",
    endedAtElapsedMilliseconds: structure.durationMilliseconds,
  }, ...manualLaps.map((lap) => ({
    key: `source-lap-${lap.ordinal}`,
    label: interpolate(copy.sourceLapChoice, { number: number.format(lap.ordinal + 1) }),
    startedAtElapsedMilliseconds: lap.splitTimeMilliseconds,
    endedAtElapsedMilliseconds: (
      BigInt(lap.splitTimeMilliseconds) + BigInt(lap.durationMilliseconds)
    ).toString(),
  })), ...automaticLaps.map((lap) => ({
    key: `automatic-lap-${lap.ordinal}`,
    label: interpolate(copy.automaticLapChoice, { number: number.format(lap.ordinal + 1) }),
    startedAtElapsedMilliseconds: lap.splitTimeMilliseconds,
    endedAtElapsedMilliseconds: (
      BigInt(lap.splitTimeMilliseconds) + BigInt(lap.durationMilliseconds)
    ).toString(),
  }))].filter((entry) => (
    BigInt(entry.startedAtElapsedMilliseconds) >= 0n
    && BigInt(entry.startedAtElapsedMilliseconds) < BigInt(entry.endedAtElapsedMilliseconds)
    && BigInt(entry.endedAtElapsedMilliseconds) <= totalDuration
  )) : [];
  const structureEditor = rangeInteraction?.editor?.exerciseRef === exercise.exerciseRef
    && rangeInteraction.editor.coordinate?.scope === "exercise-elapsed"
    ? rangeInteraction.editor
    : undefined;
  const selectedStructureRange = rangeInteraction?.selectedRange?.exerciseRef === exercise.exerciseRef
    && rangeInteraction.selectedRange.coordinate.scope === "exercise-elapsed"
    ? rangeInteraction.selectedRange
    : undefined;
  const rangeStartedAt = structureEditor
    ? parseElapsedEditorValue(structureEditor.startedAt)
    : selectedStructureRange?.startedAtElapsedMilliseconds;
  const rangeEndedAt = structureEditor
    ? parseElapsedEditorValue(structureEditor.endedAt)
    : selectedStructureRange?.endedAtElapsedMilliseconds;
  const visiblePersonalRange = rangeStartedAt !== undefined && rangeEndedAt !== undefined
    && BigInt(rangeStartedAt) >= 0n && BigInt(rangeStartedAt) < BigInt(rangeEndedAt)
    && BigInt(rangeEndedAt) <= totalDuration;

  function timelineRow(
    label: string,
    kind: "source" | "automatic",
    laps: TrainingLapStructure[],
  ) {
    if (laps.length === 0) return null;
    return (
      <div className={`training-structure-workbench-row training-structure-workbench-${kind}`}>
        <span>{label}</span>
        <span className="training-structure-workbench-track">
          {laps.map((lap) => {
            const start = BigInt(lap.splitTimeMilliseconds);
            const through = start + BigInt(lap.durationMilliseconds);
            return <i
              key={lap.lapRef}
              style={{
                left: `${percentage(start, totalDuration)}%`,
                width: `${percentage(through, totalDuration)
                  - percentage(start, totalDuration)}%`,
              }}
            />;
          })}
        </span>
      </div>
    );
  }

  return (
    <section
      className="training-structure-workbench"
      role="region"
      aria-label={copy.regionLabel}
    >
      <header className={`training-structure-workbench-heading${
        exercises.length === 1 ? " training-structure-workbench-heading-single" : ""
      }`}>
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h3>{copy.heading}</h3>
          <p>{copy.introduction}</p>
        </div>
        {exercises.length > 1 && (
          <label>
            <span>{copy.visibleExercise}</span>
            <select
              value={exercise.exerciseRef}
              disabled={rangeInteraction?.editor !== undefined}
              onChange={(event) => setExerciseRef(event.target.value)}
            >
              {exercises.map((candidate) => <option
                key={candidate.exerciseRef}
                value={candidate.exerciseRef}
              >{interpolate(copy.exerciseChoice, {
                  exercise: number.format(candidate.ordinal + 1),
                  sport: exerciseLabel(candidate),
                })}</option>)}
            </select>
          </label>
        )}
      </header>
      <div className="training-structure-workbench-identity">
        <SportFamilyIcon
          family={exercise.sport ? sportCanonicalFamily(exercise.sport) : null}
          state={exercise.sport?.state ?? "unavailable"}
        />
        <div>
          <strong>{exerciseLabel(exercise)}</strong>
          <span>{interpolate(copy.exerciseNumber, {
            exercise: number.format(exercise.ordinal + 1),
          })}</span>
        </div>
      </div>
      <div
        className="training-structure-workbench-visual"
        role="img"
        aria-label={chartSummary}
      >
        <div className="training-structure-workbench-row">
          <span>{copy.exerciseDuration}</span>
          <span className="training-structure-workbench-track training-structure-workbench-duration">
            <i />
            {visiblePersonalRange && (
              <i
                className="training-structure-personal-range"
                style={{
                  left: `${percentage(BigInt(rangeStartedAt), totalDuration)}%`,
                  width: `${percentage(BigInt(rangeEndedAt), totalDuration)
                    - percentage(BigInt(rangeStartedAt), totalDuration)}%`,
                }}
              />
            )}
          </span>
        </div>
        {timelineRow(sessionCopy.manualLaps, "source", manualLaps)}
        {timelineRow(sessionCopy.automaticLaps, "automatic", automaticLaps)}
      </div>
      <TrainingRangeEvidencePicker
        surface="structure"
        exerciseRef={exercise.exerciseRef}
        coordinate={exerciseCoordinate}
        entries={rangeEntries}
        selectionLabel={copy.rangeSelection}
        meaning={copy.rangeMeaning}
        locale={locale}
        messages={messages}
      />
      <TrainingRangeEvidenceEditor surface="structure" messages={messages} />
      <div role="group" aria-label={copy.measurements}>
        <dl>
          <div><dt>{messages.training.duration}</dt><dd>{duration}</dd></div>
          <div><dt>{messages.training.distance}</dt><dd>{distance}</dd></div>
          <div><dt>{sessionCopy.manualLaps}</dt><dd>{sourceLapCount}</dd></div>
          <div><dt>{sessionCopy.automaticLaps}</dt><dd>{automaticLapCount}</dd></div>
          <div><dt>{sessionCopy.pauses}</dt><dd>{pauses}</dd></div>
        </dl>
      </div>
      <footer>
        <p>{copy.meaning}</p>
        <button
          type="button"
          className="secondary"
          onClick={(event) => onOpenStructure(event.currentTarget)}
        >{copy.openStructure}</button>
      </footer>
    </section>
  );
}
