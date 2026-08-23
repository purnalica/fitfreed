import type { SessionStory } from "./session-story";
import type {
  TrainingSessionCurrentRangeCoordinate,
  TrainingSessionRange,
  TrainingSessionRangeCoordinate,
  TrainingSessionRangeCoordinateContext,
  TrainingSessionRangesResult,
} from "./training-session-range";
import type { TrainingSignalKind, TrainingSignalRole } from "./training-session-signal";

interface CoordinateLabels {
  exercise: (ordinal: number, sport: string | null) => string;
  exerciseTimeline: string;
  primaryRoute: string;
  transitionRoute: string;
  recordedRoute: string;
  signal: (kind: TrainingSignalKind, role: TrainingSignalRole) => string;
  recordedSignal: string;
}

export interface SelectableRangeCoordinate {
  id: string;
  coordinate: TrainingSessionCurrentRangeCoordinate;
  maximumElapsedMilliseconds: string;
  label: string;
}

export interface SelectableRangeExercise {
  id: string;
  exerciseRef: string;
  exerciseOrdinal: number;
  exerciseLabel: string;
  coordinates: SelectableRangeCoordinate[];
}

export type RangeEditorValidation = {
  valid: false;
  titleInvalid: boolean;
  boundsInvalid: boolean;
} | {
  valid: true;
  title: string;
  startedAtElapsedMilliseconds: string;
  endedAtElapsedMilliseconds: string;
};

export const MAX_ELAPSED_EDITOR_CHARACTERS = 32;
export const MAX_RANGE_TITLE_CHARACTERS = 80;

function sportLabel(story: SessionStory | undefined, exerciseRef: string): string | null {
  const sport = story?.exercises.find((exercise) => exercise.exerciseRef === exerciseRef)?.sport;
  return sport?.classification?.displayLabel?.trim() || null;
}

function coordinateLabel(
  story: SessionStory | undefined,
  exerciseRef: string,
  coordinate: TrainingSessionCurrentRangeCoordinate,
  labels: CoordinateLabels,
): string {
  if (coordinate.scope === "exercise-elapsed") return labels.exerciseTimeline;
  const exercise = story?.exercises.find((candidate) => candidate.exerciseRef === exerciseRef);
  if (coordinate.scope === "route-elapsed") {
    if (exercise?.primary.exactRoute?.routeRef === coordinate.routeRef) return labels.primaryRoute;
    if (exercise?.transition.exactRoute?.routeRef === coordinate.routeRef) {
      return labels.transitionRoute;
    }
    return labels.recordedRoute;
  }
  for (const role of ["primary", "transition"] as const) {
    const signal = exercise?.[role].exactSignals.find(
      (candidate) => candidate.signalRef === coordinate.signalRef,
    );
    if (signal) return labels.signal(signal.kind, role);
  }
  return labels.recordedSignal;
}

export function coordinateKey(coordinate: TrainingSessionRangeCoordinate): string {
  switch (coordinate.scope) {
    case "exercise-elapsed":
    case "legacy-session-elapsed":
      return coordinate.scope;
    case "route-elapsed":
      return `${coordinate.scope}:${coordinate.routeRef}`;
    case "signal-elapsed":
      return `${coordinate.scope}:${coordinate.signalRef}`;
  }
}

export function selectableRangeCoordinates(
  result: TrainingSessionRangesResult,
  story: SessionStory | undefined,
  labels: CoordinateLabels,
): SelectableRangeExercise[] {
  return result.exercises.map((exercise, exerciseIndex) => ({
    id: `exercise-${exerciseIndex}`,
    exerciseRef: exercise.exerciseRef,
    exerciseOrdinal: exercise.ordinal,
    exerciseLabel: labels.exercise(
      exercise.ordinal,
      sportLabel(story, exercise.exerciseRef),
    ),
    coordinates: exercise.coordinates.map((context, coordinateIndex) => ({
      id: `coordinate-${coordinateIndex}`,
      coordinate: context.coordinate,
      maximumElapsedMilliseconds: context.maximumElapsedMilliseconds,
      label: coordinateLabel(story, exercise.exerciseRef, context.coordinate, labels),
    })),
  }));
}

export function findEstablishedCoordinate(
  result: TrainingSessionRangesResult,
  range: TrainingSessionRange,
): TrainingSessionRangeCoordinateContext | undefined {
  if (range.exerciseRef === null || range.coordinate.scope === "legacy-session-elapsed") {
    return undefined;
  }
  return result.exercises
    .find((exercise) => exercise.exerciseRef === range.exerciseRef)
    ?.coordinates.find((context) => (
      coordinateKey(context.coordinate) === coordinateKey(range.coordinate)
    ));
}

export function rangeMayBeAdjusted(
  result: TrainingSessionRangesResult,
  range: TrainingSessionRange,
): boolean {
  if (range.exerciseRef === null && range.coordinate.scope === "legacy-session-elapsed") {
    return result.exercises.some((exercise) => exercise.coordinates.some(
      (coordinate) => BigInt(coordinate.maximumElapsedMilliseconds) > 0n,
    ));
  }
  const established = findEstablishedCoordinate(result, range);
  return established !== undefined && BigInt(established.maximumElapsedMilliseconds) > 0n;
}

export function parseElapsedEditorValue(value: string): string | undefined {
  if (value.length > MAX_ELAPSED_EDITOR_CHARACTERS) return undefined;
  const parts = value.trim().match(/^(?:(\d+):)?(\d+):([0-5]\d)(?:[.,](\d{1,3}))?$/);
  if (!parts) return undefined;
  const hours = parts[1] === undefined ? 0n : BigInt(parts[1]);
  const minutes = BigInt(parts[2]);
  if (parts[1] !== undefined && minutes > 59n) return undefined;
  const seconds = BigInt(parts[3]);
  const milliseconds = BigInt((parts[4] ?? "").padEnd(3, "0") || "0");
  return (((hours * 60n + minutes) * 60n + seconds) * 1_000n + milliseconds).toString();
}

export function elapsedEditorValue(value: string): string {
  let remainder = BigInt(value);
  const hours = remainder / 3_600_000n;
  remainder %= 3_600_000n;
  const minutes = remainder / 60_000n;
  remainder %= 60_000n;
  const seconds = remainder / 1_000n;
  const milliseconds = remainder % 1_000n;
  const base = `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString().padStart(2, "0")}`;
  return milliseconds === 0n ? base : `${base}.${milliseconds.toString().padStart(3, "0")}`;
}

export function rangeEditorValidation(input: {
  title: string;
  startedAt: string;
  endedAt: string;
  maximumElapsedMilliseconds: string | undefined;
  requireTitle: boolean;
}): RangeEditorValidation {
  const title = input.title.trim();
  const titleInvalid = input.requireTitle
    && (title.length === 0 || [...title].length > MAX_RANGE_TITLE_CHARACTERS);
  const started = parseElapsedEditorValue(input.startedAt);
  const ended = parseElapsedEditorValue(input.endedAt);
  const boundsInvalid = started === undefined || ended === undefined
    || input.maximumElapsedMilliseconds === undefined
    || BigInt(started) >= BigInt(ended)
    || BigInt(ended) > BigInt(input.maximumElapsedMilliseconds);
  if (titleInvalid || boundsInvalid) return { valid: false, titleInvalid, boundsInvalid };
  return {
    valid: true,
    title,
    startedAtElapsedMilliseconds: started,
    endedAtElapsedMilliseconds: ended,
  };
}
