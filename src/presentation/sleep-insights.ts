export interface SleepDateRange {
  from: string;
  through: string;
}

export interface SleepPhaseSummary {
  wakeMilliseconds: string;
  remMilliseconds: string;
  lightMilliseconds: string;
  deepMilliseconds: string;
  unrecognizedMilliseconds: string;
}

export interface SleepPeriodInsight {
  startedAt: string;
  endedAt: string;
  spanMilliseconds: string;
  asleepMilliseconds: string;
  interruptionMilliseconds: string;
  longInterruptionMilliseconds: string;
  shortInterruptionMilliseconds: string;
  interruptionCount: string;
  longInterruptionCount: string;
  shortInterruptionCount: string;
  efficiencyPercent: number;
  continuityIndex: number;
  continuityClass: number;
  sleepGoalMilliseconds: string | null;
  selfReportedRating: number | null;
  cycleCount: string | null;
  recordingEndedByPowerLoss: boolean | null;
  phaseSummary: SleepPhaseSummary | null;
  stageTimelineAvailable: boolean;
  scoreOverall: number | null;
  scoreRelativeRating: number | null;
}

export type SleepDayInsight =
  | { sleepDate: string; availability: "available"; period: SleepPeriodInsight }
  | { sleepDate: string; availability: "missing"; period: null };

export interface SleepSeriesSummary {
  calendarDays: number;
  observedNights: number;
  missingNights: number;
  totalAsleepMilliseconds: string | null;
  averageAsleepMilliseconds: string | null;
  totalInterruptionMilliseconds: string | null;
  averageInterruptionMilliseconds: string | null;
  averageEfficiencyPercent: number | null;
  phaseNightCount: number;
  phaseTotals: SleepPhaseSummary | null;
  stageTimelineNightCount: number;
  scoreNightCount: number;
  averageOverallScore: number | null;
  goalNightCount: number;
  goalMetNightCount: number;
  powerStatusNightCount: number;
  powerLossNightCount: number;
}

export interface SleepSeriesOverview {
  seriesRef: string;
  summary: SleepSeriesSummary;
  days: SleepDayInsight[];
}

export interface SleepOverview {
  availableRange: SleepDateRange | null;
  selectedRange: SleepDateRange | null;
  series: SleepSeriesOverview[];
}

export interface SleepSeriesComparison {
  seriesRef: string;
  baseline: SleepSeriesSummary;
  comparison: SleepSeriesSummary;
  observedNightChange: string;
  missingNightChange: string;
  averageAsleepMillisecondsChange: string | null;
  averageInterruptionMillisecondsChange: string | null;
  averageEfficiencyPercentagePointChange: number | null;
  averageOverallScoreChange: number | null;
  goalMetPercentagePointChange: number | null;
}

export interface SleepComparison {
  availableRange: SleepDateRange | null;
  baselineRange: SleepDateRange | null;
  comparisonRange: SleepDateRange | null;
  series: SleepSeriesComparison[];
}

export type SleepStage = "wake" | "rem" | "light" | "deep" | "unrecognized";

export interface SleepStageTransition {
  offsetMilliseconds: string;
  stage: SleepStage;
}

export interface SleepScore {
  overall: number;
  ownTargetDuration: number;
  recommendedDuration: number;
  continuity: number;
  efficiency: number;
  rem: number;
  deep: number;
  longInterruptions: number;
  duration: number;
  solidity: number;
  regeneration: number;
  relativeRating: number | null;
}

export interface SleepPeriodDetail {
  sleepDate: string;
  startedAt: string;
  endedAt: string;
  spanMilliseconds: string;
  asleepMilliseconds: string;
  interruptionMilliseconds: string;
  longInterruptionMilliseconds: string;
  shortInterruptionMilliseconds: string;
  interruptionCount: string;
  longInterruptionCount: string;
  shortInterruptionCount: string;
  efficiencyPercent: number;
  continuityIndex: number;
  continuityClass: number;
  sleepGoalMilliseconds: string | null;
  selfReportedRating: number | null;
  cycleCount: string | null;
  recordingEndedByPowerLoss: boolean | null;
  phaseSummary: SleepPhaseSummary | null;
  stageTransitions: SleepStageTransition[] | null;
  score: SleepScore | null;
}
