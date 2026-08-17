import type {
  ActivityDayAvailability,
  ActivitySeriesSummary,
} from "./activity-insights";
import type { RecoverySeriesSummary } from "./recovery-insights";
import type { SleepSeriesSummary } from "./sleep-insights";
import type { TrainingSeriesSummary } from "./training-insights";

export interface LongitudinalDateRange {
  from: string;
  through: string;
}

export interface LongitudinalDayInsight {
  localDate: string;
  activity: {
    availability: ActivityDayAvailability;
    stepCount: string | null;
  };
  training: {
    sessionCount: number;
    totalDurationMilliseconds: string;
  };
  sleep: {
    availability: "available" | "missing";
    asleepMilliseconds: string | null;
  };
  recovery: {
    availability: "available" | "missing";
    beatToBeatIntervalMilliseconds: string | null;
    heartRateVariabilityRmssdMilliseconds: string | null;
    breathingIntervalMilliseconds: string | null;
  };
}

export interface LongitudinalSeriesOverview {
  seriesRef: string;
  activity: ActivitySeriesSummary;
  training: TrainingSeriesSummary;
  sleep: SleepSeriesSummary;
  recovery: RecoverySeriesSummary;
  days: LongitudinalDayInsight[];
}

export interface LongitudinalOverview {
  availableRange: LongitudinalDateRange | null;
  selectedRange: LongitudinalDateRange | null;
  series: LongitudinalSeriesOverview[];
}

export interface LongitudinalSeriesComparison {
  seriesRef: string;
  activity: {
    baseline: ActivitySeriesSummary;
    comparison: ActivitySeriesSummary;
    totalStepChange: string | null;
    averageStepChange: string | null;
  };
  training: {
    baseline: TrainingSeriesSummary;
    comparison: TrainingSeriesSummary;
    sessionCountChange: string;
    trainingDayChange: string;
    durationMillisecondsChange: string;
    distanceMetersChange: number | null;
    energyKilocaloriesChange: string | null;
  };
  sleep: {
    baseline: SleepSeriesSummary;
    comparison: SleepSeriesSummary;
    observedNightChange: string;
    missingNightChange: string;
    averageAsleepMillisecondsChange: string | null;
    averageInterruptionMillisecondsChange: string | null;
    averageEfficiencyPercentagePointChange: number | null;
    averageOverallScoreChange: number | null;
    goalMetPercentagePointChange: number | null;
  };
  recovery: {
    baseline: RecoverySeriesSummary;
    comparison: RecoverySeriesSummary;
    observedNightChange: string;
    missingNightChange: string;
    averageBeatToBeatIntervalMillisecondsChange: string | null;
    averageHeartRateVariabilityRmssdMillisecondsChange: string | null;
    averageBreathingIntervalMillisecondsChange: string | null;
    assessmentNightChange: string;
    baselineNightChange: string;
    guidanceNightChange: string;
  };
}

export interface LongitudinalComparison {
  availableRange: LongitudinalDateRange | null;
  baselineRange: LongitudinalDateRange | null;
  comparisonRange: LongitudinalDateRange | null;
  series: LongitudinalSeriesComparison[];
}
