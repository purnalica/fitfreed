export interface RecoveryDateRange {
  from: string;
  through: string;
}

export interface SourceSpecificRecoveryAssessment {
  scheme: string;
  autonomicCharge: number;
  autonomicStatus: number;
  overallStatus: number;
  overallSublevel: string;
}

export interface SourceSpecificRecoveryBaseline {
  scheme: string;
  meanBeatToBeatIntervalMilliseconds: string;
  standardDeviationBeatToBeatIntervalMilliseconds: string;
  meanHeartRateVariabilityRmssdMilliseconds: string | null;
  standardDeviationHeartRateVariabilityRmssdMilliseconds: string | null;
  meanBreathingIntervalMilliseconds: string;
  standardDeviationBreathingIntervalMilliseconds: string;
}

export interface SourceSpecificRecoveryGuidance {
  scheme: string;
  exercise: string;
  sleep: string;
  vitality: string;
}

export interface RecoveryNightInsight {
  beatToBeatIntervalMilliseconds: string;
  heartRateVariabilityRmssdMilliseconds: string | null;
  breathingIntervalMilliseconds: string;
  sourceAssessment: SourceSpecificRecoveryAssessment | null;
  sourceBaselineAvailable: boolean;
  sourceGuidanceAvailable: boolean;
}

export type RecoveryDayInsight =
  | { recoveryDate: string; availability: "available"; recovery: RecoveryNightInsight }
  | { recoveryDate: string; availability: "missing"; recovery: null };

export interface RecoverySeriesSummary {
  calendarDays: number;
  observedNights: number;
  missingNights: number;
  averageBeatToBeatIntervalMilliseconds: string | null;
  rmssdNightCount: number;
  averageHeartRateVariabilityRmssdMilliseconds: string | null;
  averageBreathingIntervalMilliseconds: string | null;
  assessmentNightCount: number;
  baselineNightCount: number;
  guidanceNightCount: number;
}

export interface RecoverySeriesOverview {
  seriesRef: string;
  summary: RecoverySeriesSummary;
  days: RecoveryDayInsight[];
}

export interface RecoveryOverview {
  availableRange: RecoveryDateRange | null;
  selectedRange: RecoveryDateRange | null;
  series: RecoverySeriesOverview[];
}

export interface RecoverySeriesComparison {
  seriesRef: string;
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
}

export interface RecoveryComparison {
  availableRange: RecoveryDateRange | null;
  baselineRange: RecoveryDateRange | null;
  comparisonRange: RecoveryDateRange | null;
  series: RecoverySeriesComparison[];
}

export interface RecoveryNightDetail {
  recoveryDate: string;
  beatToBeatIntervalMilliseconds: string;
  heartRateVariabilityRmssdMilliseconds: string | null;
  breathingIntervalMilliseconds: string;
  sourceAssessment: SourceSpecificRecoveryAssessment | null;
  sourceBaseline: SourceSpecificRecoveryBaseline | null;
  sourceGuidance: SourceSpecificRecoveryGuidance | null;
}
