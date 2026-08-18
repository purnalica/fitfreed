import type { TrainingSessionSport } from "./training-session-search";

export interface TrainingSessionStructureQuery {
  sessionRef: string;
  snapshotRef: string | null;
}

export interface TrainingLapStructure {
  lapRef: string;
  ordinal: number;
  splitTimeMilliseconds: string;
  durationMilliseconds: string;
  distanceMeters: number | null;
}

export interface TrainingPauseStructure {
  pauseRef: string;
  ordinal: number;
  startedAtLocal: string;
  endedAtLocal: string;
}

export interface TrainingExerciseStructure {
  exerciseRef: string;
  ordinal: number;
  startedAtLocal: string;
  stoppedAtLocal: string;
  utcOffsetMinutes: number | null;
  durationMilliseconds: string;
  distanceMeters: number | null;
  energyKilocalories: string | null;
  sport: TrainingSessionSport;
  manualLaps: TrainingLapStructure[] | null;
  automaticLaps: TrainingLapStructure[] | null;
  pauses: TrainingPauseStructure[] | null;
}

export interface TrainingStructure {
  exercises: TrainingExerciseStructure[] | null;
}

export interface TrainingSessionStructureResult {
  snapshotRef: string;
  sessionRef: string;
  structure: TrainingStructure | null;
}
