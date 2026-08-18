import type { TrainingSportClassification, TrainingSportState } from "./training-sports";

export type TrainingMeasurementFilter = "distance" | "energy" | "heart-rate";

export type TrainingSessionSort =
  | "started-desc"
  | "started-asc"
  | "duration-desc"
  | "distance-desc";

export interface TrainingSessionSearchRequest {
  from: string | null;
  through: string | null;
  sportRefs: string[];
  requiredMeasurements: TrainingMeasurementFilter[];
  text: string | null;
  sort: TrainingSessionSort;
  offset: number;
  limit: number;
  snapshotRef: string | null;
}

export interface TrainingSessionSport {
  sportRef: string | null;
  state: TrainingSportState;
  classification: TrainingSportClassification | null;
}

export interface TrainingSessionSearchItem {
  sessionRef: string;
  sourceIndex: number;
  startedAtLocal: string;
  stoppedAtLocal: string;
  utcOffsetMinutes: number | null;
  durationMilliseconds: string;
  distanceMeters: number | null;
  energyKilocalories: string | null;
  averageHeartRateBpm: string | null;
  maximumHeartRateBpm: string | null;
  exerciseCount: number | null;
  sport: TrainingSessionSport;
}

export interface TrainingSessionSearchSummary {
  sourceIndex: number;
  trainingDays: number;
  sessionCount: number;
  totalDurationMilliseconds: string;
  distanceSessionCount: number;
  totalDistanceMeters: number | null;
  energySessionCount: number;
  totalEnergyKilocalories: string | null;
  heartRateSessionCount: number;
}

export interface TrainingSessionSearchPage {
  availableRange: { from: string; through: string } | null;
  snapshotRef: string;
  totalCount: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
  summaries: TrainingSessionSearchSummary[];
  sessions: TrainingSessionSearchItem[];
}
