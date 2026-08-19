export type TrainingSignalRole = "primary" | "transition";

export type TrainingSignalKind =
  | "heart-rate"
  | "speed"
  | "distance"
  | "altitude"
  | "cadence"
  | "temperature"
  | "left-crank-power";

export type TrainingSignalUnit =
  | "beats-per-minute"
  | "kilometers-per-hour"
  | "meters"
  | "rotations-per-minute"
  | "degrees-celsius"
  | "watts";

export interface TrainingSignalSample {
  ordinal: number;
  elapsedMilliseconds: string;
  value: number | null;
}

export interface TrainingSignalVisualSample extends TrainingSignalSample {
  gapBefore: boolean;
}

export interface TrainingSignalSeriesOverview {
  signalRef: string;
  ordinal: number;
  role: TrainingSignalRole;
  kind: TrainingSignalKind;
  unit: TrainingSignalUnit;
  intervalMilliseconds: string;
  sampleCount: number;
  availableSampleCount: number;
  projection: "source-ordinal-v1";
  visualSamples: TrainingSignalVisualSample[];
}

export interface TrainingSignalCollection {
  primary: TrainingSignalSeriesOverview[] | null;
  transition: TrainingSignalSeriesOverview[] | null;
  unsupportedPrimarySeriesCount: number;
  unsupportedTransitionSeriesCount: number;
}

export interface TrainingExerciseSignals {
  exerciseRef: string;
  ordinal: number;
  signals: TrainingSignalCollection | null;
}

export interface TrainingSessionSignals {
  exercises: TrainingExerciseSignals[] | null;
}

export interface TrainingSessionSignalsResult {
  snapshotRef: string;
  sessionRef: string;
  signals: TrainingSessionSignals | null;
}

export interface TrainingSignalSamplesResult {
  snapshotRef: string;
  sessionRef: string;
  signalRef: string;
  exerciseRef: string;
  ordinal: number;
  role: TrainingSignalRole;
  kind: TrainingSignalKind;
  unit: TrainingSignalUnit;
  intervalMilliseconds: string;
  sampleCount: number;
  offset: number;
  samples: TrainingSignalSample[];
  nextOffset: number | null;
}
