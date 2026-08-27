import type { Locale } from "../locales/catalogs";
import type { SportFamily } from "./training-sports";

export type PlannedTrainingCollection = "scheduled" | "favorite-templates";
export type PlannedTrainingCompletion = "pending" | "completed";

export interface PlannedTrainingChronologyQuery {
  collection: PlannedTrainingCollection;
  completion: PlannedTrainingCompletion | null;
  from: string | null;
  through: string | null;
  offset: number;
  limit: number;
  snapshotRef: string | null;
}

export type PlannedTrainingTargetKind =
  | {
      kind: "scheduled";
      scheduledAtLocal: string;
      completion: PlannedTrainingCompletion;
    }
  | {
      kind: "favorite-template";
      scheduledAtLocal: null;
      completion: null;
    };

export interface PlannedTrainingMappingCoverage {
  state: "complete" | "partial";
  unmappedFieldCount: number;
}

export interface PlannedTrainingPlanShape {
  exerciseCount: number | null;
  phaseCount: number | null;
  expandedPhaseCount: number | null;
  repeatBlockCount: number | null;
  containsIntensityEvidence: boolean;
}

export type PlannedTrainingRelation =
  | { state: "not-applicable"; sessionRef: null; candidateCount: null }
  | { state: "absent"; sessionRef: null; candidateCount: null }
  | { state: "exact"; sessionRef: string; candidateCount: null }
  | { state: "ambiguous"; sessionRef: null; candidateCount: number };

export interface PlannedTrainingTargetSummary {
  targetRef: string;
  sourceIndex: number;
  reconciliationState: "current" | "conflicted";
  targetKind: PlannedTrainingTargetKind;
  name: string;
  description: string | null;
  editability: "editable" | "non-editable" | "unspecified";
  mappingCoverage: PlannedTrainingMappingCoverage;
  shape: PlannedTrainingPlanShape;
  relation: PlannedTrainingRelation;
}

export interface PlannedTrainingChronologyPage {
  snapshotRef: string;
  totalCount: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
  targets: PlannedTrainingTargetSummary[];
}

export interface PlannedTrainingRecognition {
  canonicalFamily: SportFamily | null;
  localizedNames: Record<string, string>;
  catalogueRevision: string;
  retrievedAtUtc: string;
  mappingVersion: string;
  evidenceRef: string;
}

export type PlannedTrainingSport =
  | { state: "unavailable" | "unmapped"; recognition: null }
  | { state: "recognized"; recognition: PlannedTrainingRecognition };

export type PlannedTrainingPhaseGoal =
  | { kind: "duration"; durationMilliseconds: string; distanceMeters: null }
  | { kind: "distance"; durationMilliseconds: null; distanceMeters: number }
  | { kind: "unmapped"; durationMilliseconds: null; distanceMeters: null };

export type PlannedTrainingIntensity =
  | {
      kind: "none";
      metric: null;
      lowerZone: null;
      upperZone: null;
    }
  | {
      kind: "unmapped";
      metric: null;
      lowerZone: null;
      upperZone: null;
    }
  | {
      kind: "zone-range";
      metric: "heart-rate" | "speed" | "power";
      lowerZone: number;
      upperZone: number;
    };

export interface PlannedTrainingRepeat {
  repeatRef: string;
  returnToPhaseOrdinal: number;
  totalIterations: number;
}

export interface PlannedTrainingTransition {
  transitionRef: string;
  change: "manual" | "automatic" | "unmapped";
  repeat: PlannedTrainingRepeat | null;
}

export interface PlannedTrainingPhase {
  phaseRef: string;
  ordinal: number;
  name: string | null;
  goal: PlannedTrainingPhaseGoal;
  intensity: PlannedTrainingIntensity;
  transition: PlannedTrainingTransition;
}

export interface PlannedTrainingExercise {
  exerciseRef: string;
  ordinal: number;
  kind: "open" | "phased" | "volume" | "strength" | "unmapped";
  durationGoalMilliseconds: string | null;
  distanceGoalMeters: number | null;
  sport: PlannedTrainingSport;
  phases: PlannedTrainingPhase[] | null;
}

export interface PlannedTrainingTargetDetail {
  snapshotRef: string;
  target: {
    summary: PlannedTrainingTargetSummary;
    exercises: PlannedTrainingExercise[] | null;
  };
}

export type CompletedSessionPlannedTrainingRelation =
  | {
      state: "absent";
      targetRef: null;
      candidateTargetCount: null;
      candidateSessionCount: null;
    }
  | {
      state: "exact";
      targetRef: string;
      candidateTargetCount: null;
      candidateSessionCount: null;
    }
  | {
      state: "ambiguous";
      targetRef: null;
      candidateTargetCount: number;
      candidateSessionCount: number;
    };

export interface PlannedTrainingSessionRelationResult {
  snapshotRef: string;
  trainingSnapshotRef: string;
  sessionRef: string;
  relation: CompletedSessionPlannedTrainingRelation;
  candidates: PlannedTrainingTargetSummary[];
}

export function plannedTrainingSportName(
  sport: PlannedTrainingSport,
  locale: Locale,
): string | null {
  if (sport.state !== "recognized") return null;
  const language = locale.split("-")[0];
  return sport.recognition.localizedNames[locale]
    ?? sport.recognition.localizedNames[language]
    ?? sport.recognition.localizedNames["en-US"]
    ?? sport.recognition.localizedNames.en
    ?? Object.values(sport.recognition.localizedNames)[0]
    ?? null;
}
