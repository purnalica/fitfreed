export type TrainingZoneKind = "heart-rate" | "speed" | "power";

export type TrainingZoneUnit = "beats-per-minute" | "kilometers-per-hour" | "watts";

export interface TrainingZone {
  zoneRef: string;
  ordinal: number;
  lowerLimit: number;
  higherLimit: number;
  timeInZoneMilliseconds: string | null;
  distanceMeters: number | null;
  muscleLoad: number | null;
}

export interface TrainingZoneGroup {
  zoneGroupRef: string;
  ordinal: number;
  kind: TrainingZoneKind;
  unit: TrainingZoneUnit;
  zones: TrainingZone[] | null;
}

export interface TrainingZoneCollection {
  groups: TrainingZoneGroup[];
  unsupportedGroupCount: number;
}

export interface TrainingExerciseZones {
  exerciseRef: string;
  ordinal: number;
  zones: TrainingZoneCollection | null;
}

export interface TrainingSessionZones {
  exercises: TrainingExerciseZones[] | null;
}

export interface TrainingSessionZonesResult {
  snapshotRef: string;
  sessionRef: string;
  zones: TrainingSessionZones | null;
}
