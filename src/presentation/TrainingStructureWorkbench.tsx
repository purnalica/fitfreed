import { useEffect, useMemo, useState } from "react";

import { type catalogs, type Locale } from "../locales/catalogs";
import type { SessionStory, SessionStoryExercise } from "./session-story";
import { SportFamilyIcon } from "./SportFamilyIcon";
import { formatDistance, formatDuration } from "./training-format";
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
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  useEffect(() => {
    setExerciseRef(exercises[0]?.exerciseRef ?? "");
  }, [signature]);

  if (!exercise?.structure) return null;

  const structure = exercise.structure;
  const manualLaps = structure.manualLaps ?? [];
  const automaticLaps = structure.automaticLaps ?? [];
  const pauseCount = structure.pauses?.length ?? 0;
  const duration = formatDuration(
    structure.durationMilliseconds,
    locale,
    messages.training.durationUnits,
  );
  const distance = formatDistance(
    structure.distanceMeters,
    locale,
    sessionCopy.metricUnavailable,
    messages.training.units.meters,
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
            <select value={exercise.exerciseRef} onChange={(event) => setExerciseRef(event.target.value)}>
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
          family={exercise.sport?.classification?.canonicalFamily ?? null}
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
          </span>
        </div>
        {timelineRow(sessionCopy.manualLaps, "source", manualLaps)}
        {timelineRow(sessionCopy.automaticLaps, "automatic", automaticLaps)}
      </div>
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
