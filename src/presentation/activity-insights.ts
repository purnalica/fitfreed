export interface ActivityDateRange {
  from: string;
  through: string;
}

export type ActivityDayAvailability = "available" | "unavailable" | "missing";

export interface ActivityDayInsight {
  localDate: string;
  stepCount: string | null;
  availability: ActivityDayAvailability;
}

export interface ActivitySeriesSummary {
  calendarDays: number;
  observedDays: number;
  availableStepDays: number;
  unavailableStepDays: number;
  missingDays: number;
  totalStepCount: string | null;
  averageStepCount: string | null;
}

export interface ActivitySeriesOverview {
  seriesRef: string;
  summary: ActivitySeriesSummary;
  days: ActivityDayInsight[];
}

export interface ActivityOverview {
  availableRange: ActivityDateRange | null;
  selectedRange: ActivityDateRange | null;
  series: ActivitySeriesOverview[];
}

export interface ActivitySeriesComparison {
  seriesRef: string;
  baseline: ActivitySeriesSummary;
  comparison: ActivitySeriesSummary;
  totalStepChange: string | null;
  averageStepChange: string | null;
}

export interface ActivityComparison {
  availableRange: ActivityDateRange | null;
  baselineRange: ActivityDateRange | null;
  comparisonRange: ActivityDateRange | null;
  series: ActivitySeriesComparison[];
}
