export type TrainingSportState = "unknown" | "classified" | "unavailable";

export type SportFamily =
  | "running"
  | "cycling"
  | "swimming"
  | "walking"
  | "hiking"
  | "strength"
  | "mobility"
  | "racket-sport"
  | "team-sport"
  | "winter-sport"
  | "water-sport"
  | "other";

export const sportFamilies: SportFamily[] = [
  "running",
  "cycling",
  "swimming",
  "walking",
  "hiking",
  "strength",
  "mobility",
  "racket-sport",
  "team-sport",
  "winter-sport",
  "water-sport",
  "other",
];

export interface TrainingSportClassification {
  canonicalFamily: SportFamily | null;
  displayLabel: string | null;
  authorship: "user" | null;
  revision: number;
}

export interface TrainingSportCoverage {
  sessionCount: number;
  totalDurationMilliseconds: string;
  distanceSessionCount: number;
  heartRateSessionCount: number;
}

export interface TrainingSport {
  sportRef: string | null;
  sourceIndex: number;
  state: TrainingSportState;
  classification: TrainingSportClassification | null;
  firstLocalDate: string;
  lastLocalDate: string;
  coverage: TrainingSportCoverage;
}

export interface TrainingSportsOverview {
  originCount: number;
  sessionCount: number;
  sports: TrainingSport[];
}

export interface SavedTrainingSportClassification {
  outcome: "changed" | "unchanged";
  overview: TrainingSportsOverview;
}

export interface TrainingSportClassificationChange {
  requestId: number;
  source: "sessions" | "sports";
  result: SavedTrainingSportClassification;
}
