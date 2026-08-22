import { useMemo } from "react";

import { type catalogs, type Locale } from "../locales/catalogs";
import type { SessionStory } from "./session-story";

interface TrainingSessionEvidenceSummaryProps {
  story: SessionStory;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

export function TrainingSessionEvidenceSummary({
  story,
  locale,
  messages,
}: TrainingSessionEvidenceSummaryProps) {
  const copy = messages.training.sessionLibrary.evidenceSummary;
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const roleEvidence = story.exercises.flatMap(
    (exercise) => [exercise.primary.evidence, exercise.transition.evidence],
  );
  const sumRoles = (value: (evidence: (typeof roleEvidence)[number]) => number) => (
    roleEvidence.reduce((total, evidence) => total + value(evidence), 0)
  );
  const sumExercises = (
    value: (exercise: (typeof story.exercises)[number]) => number,
  ) => story.exercises.reduce((total, exercise) => total + value(exercise), 0);
  const values = {
    exercises: story.composition.exerciseCount,
    structuredExercises: sumExercises((exercise) => exercise.evidence.hasStructure ? 1 : 0),
    routePoints: sumRoles((evidence) => evidence.routePointCount),
    signalSeries: sumRoles((evidence) => evidence.signalSeriesCount),
    missingSignalSamples: sumRoles((evidence) => evidence.unavailableSignalSampleCount),
    laps: sumExercises(
      (exercise) => exercise.evidence.manualLapCount + exercise.evidence.automaticLapCount,
    ),
    pauses: sumExercises((exercise) => exercise.evidence.pauseCount),
    zones: sumExercises((exercise) => exercise.evidence.zoneCount),
    unsupportedSignalSeries: sumRoles((evidence) => evidence.unsupportedSignalSeriesCount),
    unsupportedZoneGroups: sumExercises(
      (exercise) => exercise.evidence.unsupportedZoneGroupCount,
    ),
  };
  const statement = (
    key: keyof typeof values,
    templates: { one: string; other: string },
  ) => interpolate(values[key] === 1 ? templates.one : templates.other, {
    count: number.format(values[key]),
  });
  const items = [
    statement("exercises", copy.exercises),
    values.structuredExercises > 0
      ? statement("structuredExercises", copy.structuredExercises)
      : null,
    values.routePoints > 0 ? statement("routePoints", copy.routePoints) : null,
    values.signalSeries > 0 ? statement("signalSeries", copy.signalSeries) : null,
    values.missingSignalSamples > 0
      ? statement("missingSignalSamples", copy.missingSignalSamples)
      : null,
    values.laps > 0 ? statement("laps", copy.laps) : null,
    values.pauses > 0 ? statement("pauses", copy.pauses) : null,
    values.zones > 0 ? statement("zones", copy.zones) : null,
    values.unsupportedSignalSeries > 0
      ? statement("unsupportedSignalSeries", copy.unsupportedSignalSeries)
      : null,
    values.unsupportedZoneGroups > 0
      ? statement("unsupportedZoneGroups", copy.unsupportedZoneGroups)
      : null,
  ].filter((item): item is string => item !== null);
  const hasDetailedEvidence = values.structuredExercises > 0
    || values.routePoints > 0
    || values.signalSeries > 0
    || values.laps > 0
    || values.pauses > 0
    || values.zones > 0
    || values.unsupportedSignalSeries > 0
    || values.unsupportedZoneGroups > 0;

  return (
    <section
      className="training-session-evidence-summary"
      role="region"
      aria-label={copy.regionLabel}
    >
      <div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h4>{copy.heading}</h4>
        <p>{copy.introduction}</p>
      </div>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
      {!hasDetailedEvidence && <p className="training-session-evidence-empty">
        {copy.noDetailedEvidence}
      </p>}
    </section>
  );
}
