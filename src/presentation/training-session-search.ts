import type {
  TrainingSportClassification,
  TrainingSportRecognition,
  TrainingSportState,
} from "./training-sports";

export type TrainingMeasurementFilter = "distance" | "energy" | "heart-rate";

export type TrainingSessionSort =
  | "started-desc"
  | "started-asc"
  | "duration-desc"
  | "distance-desc";

export type TrainingDiscoveryView = "chronology" | "calendar";

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

export interface TrainingSessionCalendarRequest {
  month: string;
  from: string | null;
  through: string | null;
  sportRefs: string[];
  requiredMeasurements: TrainingMeasurementFilter[];
  text: string | null;
  snapshotRef: string | null;
}

export interface TrainingSessionSport {
  sportRef: string | null;
  state: TrainingSportState;
  classification: TrainingSportClassification | null;
  recognition: TrainingSportRecognition | null;
  recognitionCandidateCount: number;
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

export interface TrainingSessionCalendarActivity {
  sessionRef: string;
  startedAtLocal: string;
  durationMilliseconds: string;
  sport: TrainingSessionSport;
}

export interface TrainingSessionCalendarDay {
  localDate: string;
  sourceIndex: number;
  sessionCount: number;
  totalDurationMilliseconds: string;
  distanceSessionCount: number;
  totalDistanceMeters: number | null;
  heartRateSessionCount: number;
  activities: TrainingSessionCalendarActivity[];
}

export interface TrainingSessionCalendar {
  availableRange: { from: string; through: string } | null;
  snapshotRef: string;
  month: string;
  days: TrainingSessionCalendarDay[];
}

export interface TrainingSessionSelectionRequest {
  sessionRefs: string[];
  snapshotRef: string | null;
}

export interface TrainingSessionSelection {
  snapshotRef: string;
  sessions: TrainingSessionSearchItem[];
}

export interface TrainingDiscoveryWorkspace {
  version: 3;
  snapshotRef: string;
  from: string | null;
  through: string | null;
  sportRefs: string[];
  requiredMeasurements: TrainingMeasurementFilter[];
  text: string | null;
  sort: TrainingSessionSort;
  offset: number;
  limit: number;
  view: TrainingDiscoveryView;
  calendarMonth: string | null;
  calendarDay: string | null;
  selectedSessionRefs: string[];
  openSessionRef: string | null;
}
