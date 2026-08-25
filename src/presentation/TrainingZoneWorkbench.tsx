import { useEffect, useMemo, useState } from "react";

import { type catalogs, type Locale } from "../locales/catalogs";
import type { SessionStory, SessionStoryExercise } from "./session-story";
import { SportFamilyIcon } from "./SportFamilyIcon";
import { sportCanonicalFamily } from "./training-sports";
import { formatDistance, formatDuration } from "./training-format";
import type { TrainingZone, TrainingZoneGroup } from "./training-session-zone";

interface TrainingZoneWorkbenchProps {
  story: SessionStory;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  exerciseLabel: (exercise: SessionStoryExercise) => string;
  onOpenZones: (
    exerciseRef: string,
    groupRef: string,
    initiatingElement: HTMLButtonElement,
  ) => void;
}

interface ZoneChoice {
  key: string;
  exercise: SessionStoryExercise;
  group: TrainingZoneGroup;
}

type ZoneMeasure = "time" | "distance" | "muscleLoad";

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

function zoneChoices(story: SessionStory): ZoneChoice[] {
  return story.exercises.flatMap((exercise) => (
    exercise.zones?.groups.flatMap((group) => (
      group.zones && group.zones.length > 0
        ? [{ key: `${exercise.exerciseRef}:${group.zoneGroupRef}`, exercise, group }]
        : []
    )) ?? []
  ));
}

function leadingMeasure(group: TrainingZoneGroup): ZoneMeasure | null {
  const zones = group.zones ?? [];
  if (zones.some((zone) => zone.timeInZoneMilliseconds !== null)) return "time";
  if (group.kind === "speed" && zones.some((zone) => zone.distanceMeters !== null)) {
    return "distance";
  }
  if (group.kind === "power" && zones.some((zone) => zone.muscleLoad !== null)) {
    return "muscleLoad";
  }
  return null;
}

function bigintPercentage(value: bigint, total: bigint): number {
  return total === 0n ? 0 : Number(value * 10_000n / total) / 100;
}

export function TrainingZoneWorkbench({
  story,
  locale,
  messages,
  exerciseLabel,
  onOpenZones,
}: TrainingZoneWorkbenchProps) {
  const choices = useMemo(() => zoneChoices(story), [story]);
  const signature = choices.map((choice) => choice.key).join("|");
  const [choiceKey, setChoiceKey] = useState(() => choices[0]?.key ?? "");
  const choice = choices.find((candidate) => candidate.key === choiceKey) ?? choices[0];
  const copy = messages.training.sessionLibrary.zoneWorkbench;
  const sessionCopy = messages.training.sessionLibrary;
  const number = useMemo(() => new Intl.NumberFormat(locale, {
    maximumSignificantDigits: 17,
  }), [locale]);

  useEffect(() => {
    setChoiceKey(choices[0]?.key ?? "");
  }, [signature]);

  const zones = choice?.group.zones;
  if (!choice || !zones) return null;

  const { exercise, group } = choice;
  const measure = leadingMeasure(group);
  const kind = sessionCopy.zoneKinds[group.kind];
  const unit = sessionCopy.zoneUnits[group.unit];
  const measureLabel = measure === null
    ? copy.aggregateValue
    : copy.measures[measure];
  const hasMeasureValue = (zone: TrainingZone) => (
    measure === "time" ? zone.timeInZoneMilliseconds !== null
      : measure === "distance" ? zone.distanceMeters !== null
        : measure === "muscleLoad" ? zone.muscleLoad !== null
          : false
  );
  const knownZones = zones.filter(hasMeasureValue);
  const totalTime = measure === "time" ? zones.reduce(
    (total, zone) => zone.timeInZoneMilliseconds === null
      ? total
      : total + BigInt(zone.timeInZoneMilliseconds),
    0n,
  ) : 0n;
  const totalNumber = measure === "distance" ? zones.reduce(
    (total, zone) => total + (zone.distanceMeters ?? 0),
    0,
  ) : measure === "muscleLoad" ? zones.reduce(
    (total, zone) => total + (zone.muscleLoad ?? 0),
    0,
  ) : 0;
  const totalLabel = measure === "time"
    ? formatDuration(totalTime.toString(), locale, messages.training.durationUnits)
    : measure === "distance"
      ? formatDistance(
        totalNumber,
        locale,
        sessionCopy.zoneNotRecorded,
        messages.training.units.meters,
      )
      : measure === "muscleLoad"
        ? number.format(totalNumber)
        : sessionCopy.zoneNotRecorded;
  const coverage = interpolate(copy.coverageValue, {
    known: number.format(knownZones.length),
    total: number.format(zones.length),
  });
  const chartSummary = interpolate(
    measure === null ? copy.chartSummaryWithoutAggregate : copy.chartSummary,
    {
      kind,
      exercise: number.format(exercise.ordinal + 1),
      known: number.format(knownZones.length),
      total: number.format(zones.length),
      measure: measureLabel,
      value: totalLabel,
    },
  );

  function zoneValue(zone: TrainingZone): string {
    if (measure === "time") {
      return zone.timeInZoneMilliseconds === null
        ? sessionCopy.zoneNotRecorded
        : formatDuration(
          zone.timeInZoneMilliseconds,
          locale,
          messages.training.durationUnits,
        );
    }
    if (measure === "distance") {
      return formatDistance(
        zone.distanceMeters,
        locale,
        sessionCopy.zoneNotRecorded,
        messages.training.units.meters,
      );
    }
    if (measure === "muscleLoad") {
      return zone.muscleLoad === null
        ? sessionCopy.zoneNotRecorded
        : number.format(zone.muscleLoad);
    }
    return sessionCopy.zoneNotRecorded;
  }

  function zoneWidth(zone: TrainingZone): number {
    if (measure === "time" && zone.timeInZoneMilliseconds !== null) {
      return bigintPercentage(BigInt(zone.timeInZoneMilliseconds), totalTime);
    }
    if (measure === "distance" && zone.distanceMeters !== null) {
      return totalNumber === 0 ? 0 : zone.distanceMeters / totalNumber * 100;
    }
    if (measure === "muscleLoad" && zone.muscleLoad !== null) {
      return totalNumber === 0 ? 0 : zone.muscleLoad / totalNumber * 100;
    }
    return 0;
  }

  return (
    <section className="training-zone-workbench" role="region" aria-label={copy.regionLabel}>
      <header className={`training-zone-workbench-heading${
        choices.length === 1 ? " training-zone-workbench-heading-single" : ""
      }`}>
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h3>{interpolate(copy.heading, { kind: kind.toLocaleLowerCase(locale) })}</h3>
          <p>{copy.introduction}</p>
        </div>
        {choices.length > 1 && (
          <label>
            <span>{copy.visibleGroup}</span>
            <select value={choice.key} onChange={(event) => setChoiceKey(event.target.value)}>
              {choices.map((candidate) => <option
                key={candidate.key}
                value={candidate.key}
              >{interpolate(copy.groupChoice, {
                  kind: sessionCopy.zoneKinds[candidate.group.kind],
                  group: number.format(candidate.group.ordinal + 1),
                  exercise: number.format(candidate.exercise.ordinal + 1),
                  sport: exerciseLabel(candidate.exercise),
                })}</option>)}
            </select>
          </label>
        )}
      </header>
      <div className="training-zone-workbench-identity">
        <SportFamilyIcon
          family={exercise.sport ? sportCanonicalFamily(exercise.sport) : null}
          state={exercise.sport?.state ?? "unavailable"}
        />
        <div>
          <strong>{exerciseLabel(exercise)}</strong>
          <span>{interpolate(copy.groupIdentity, {
            kind,
            group: number.format(group.ordinal + 1),
            exercise: number.format(exercise.ordinal + 1),
          })}</span>
        </div>
      </div>
      <div className="training-zone-workbench-visual" role="img" aria-label={chartSummary}>
        {zones.map((zone) => (
          <div className="training-zone-workbench-row" key={zone.zoneRef}>
            <span>
              <strong>{sessionCopy.zoneNumber} {number.format(zone.ordinal + 1)}</strong>
              <small>{number.format(zone.lowerLimit)}–{number.format(zone.higherLimit)} {unit}</small>
            </span>
            <span
              className="training-zone-workbench-track"
              data-state={hasMeasureValue(zone) ? "recorded" : "missing"}
              aria-hidden="true"
            >
              <i style={hasMeasureValue(zone) ? { width: `${zoneWidth(zone)}%` } : undefined} />
            </span>
            <span>{zoneValue(zone)}</span>
          </div>
        ))}
      </div>
      <div role="group" aria-label={copy.measurements}>
        <dl>
          <div><dt>{copy.bands}</dt><dd>{number.format(zones.length)}</dd></div>
          <div><dt>{copy.coverage}</dt><dd>{coverage}</dd></div>
          <div><dt>{copy.total}</dt><dd>{totalLabel}</dd></div>
        </dl>
      </div>
      <footer>
        <p><strong>{copy.aggregateMeaning}</strong> {copy.meaning}</p>
        <button
          type="button"
          className="secondary"
          onClick={(event) => onOpenZones(
            exercise.exerciseRef,
            group.zoneGroupRef,
            event.currentTarget,
          )}
        >{copy.openZones}</button>
      </footer>
    </section>
  );
}
