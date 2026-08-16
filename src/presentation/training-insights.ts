export interface TrainingDateRange {
  from: string;
  through: string;
}

export interface TrainingSessionInsight {
  sessionRef: string;
  startedAtLocal: string;
  stoppedAtLocal: string;
  utcOffsetMinutes: number | null;
  durationMilliseconds: string;
  distanceMeters: number | null;
  energyKilocalories: string | null;
  averageHeartRateBpm: string | null;
  maximumHeartRateBpm: string | null;
  sportRef: string | null;
  exerciseCount: number | null;
}

export interface TrainingSeriesSummary {
  calendarDays: number;
  trainingDays: number;
  sessionCount: number;
  totalDurationMilliseconds: string;
  distanceSessionCount: number;
  totalDistanceMeters: number | null;
  energySessionCount: number;
  totalEnergyKilocalories: string | null;
  heartRateSessionCount: number;
}

export interface TrainingSeriesOverview {
  seriesRef: string;
  summary: TrainingSeriesSummary;
  sessions: TrainingSessionInsight[];
}

export interface TrainingOverview {
  availableRange: TrainingDateRange | null;
  selectedRange: TrainingDateRange | null;
  series: TrainingSeriesOverview[];
}

export interface TrainingSeriesComparison {
  seriesRef: string;
  baseline: TrainingSeriesSummary;
  comparison: TrainingSeriesSummary;
  sessionCountChange: string;
  trainingDayChange: string;
  durationMillisecondsChange: string;
  distanceMetersChange: number | null;
  energyKilocaloriesChange: string | null;
}

export interface TrainingComparison {
  availableRange: TrainingDateRange | null;
  baselineRange: TrainingDateRange | null;
  comparisonRange: TrainingDateRange | null;
  series: TrainingSeriesComparison[];
}
