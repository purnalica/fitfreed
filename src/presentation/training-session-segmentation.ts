export type SegmentCriterionDefinition =
  | { kind: "equal-elapsed-time"; spanMilliseconds: string }
  | { kind: "equal-distance"; spanMeters: number }
  | {
    kind: "heart-rate-zone";
    minimumBeatsPerMinute: number;
    maximumBeatsPerMinute: number;
  }
  | { kind: "manual-boundaries"; elapsedMilliseconds: string[] };

export interface SegmentCriterion {
  criterionRef: string;
  title: string;
  definition: SegmentCriterionDefinition;
  authorship: "user";
  evaluationVersion: number;
  revision: number;
}

export type SegmentApplicability =
  | "applicable"
  | "missing-prerequisite"
  | "ambiguous-prerequisite"
  | "incomplete-evidence"
  | "outside-session"
  | "too-many-segments";

export interface TrainingDerivedSegment {
  ordinal: number;
  startedAtElapsedMilliseconds: string;
  endedAtElapsedMilliseconds: string;
  attribution: "fitfreed-derived";
}

export interface AppliedTrainingSegmentCriterion {
  criterion: SegmentCriterion;
  ordinal: number;
  applicability: SegmentApplicability;
  requiredMeasurement: "distance" | "heart-rate" | null;
  hasEvidenceGaps: boolean;
  segments: TrainingDerivedSegment[];
}

export interface TrainingExerciseSegmentation {
  exerciseRef: string;
  ordinal: number;
  durationMilliseconds: string;
  appliedCriteria: AppliedTrainingSegmentCriterion[];
}

export interface TrainingSessionSegmentationResult {
  snapshotRef: string;
  sessionRef: string;
  availableCriteria: SegmentCriterion[];
  exercises: TrainingExerciseSegmentation[] | null;
}
