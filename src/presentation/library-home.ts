import type { SportFamily, TrainingSportState } from "./training-sports";

export type LibraryDomain = "training" | "activity" | "sleep" | "recovery";

export type ExploreDestination = LibraryDomain | "longitudinal";

export type IllustratedSportFamily = "running" | "cycling" | "water-sport" | "strength";

export type LibraryQuestionKind =
  | "explore-training-sessions"
  | "align-history"
  | "review-activity-steps"
  | "review-sleep-patterns"
  | "review-recovery-patterns";

export interface LibraryHomeDateRange {
  from: string;
  through: string;
}

export interface LibraryMeasurementCoverage {
  measurement: string;
  availableRecords: number;
  observedRecords: number;
}

export interface LibraryDomainCoverage {
  domain: LibraryDomain;
  recordedRange: LibraryHomeDateRange | null;
  usableRange: LibraryHomeDateRange | null;
  selectedRange: LibraryHomeDateRange | null;
  originCount: number;
  observedRecordCount: number;
  measurements: LibraryMeasurementCoverage[];
}

export type LibraryHomeRangeScope = LibraryDomain | "combined";

export interface LibraryHomePrimaryRange {
  scope: LibraryHomeRangeScope;
  range: LibraryHomeDateRange;
}

export interface LibraryQuestion {
  kind: LibraryQuestionKind;
  destination: ExploreDestination;
}

export interface LibraryPostImportReveal {
  exactRepeat: boolean;
  canonicalHistoryChanged: boolean;
  newObservations: number;
  enrichedObservations: number;
  amendedObservations: number;
  unchangedObservations: number;
  sourceReviewRecommended: boolean;
}

export interface LibraryHomeSportSummary {
  sessionFilterRefs: string[];
  sportRef: string | null;
  state: TrainingSportState;
  canonicalFamily: SportFamily | null;
  displayLabel: string | null;
  localizedNames: Record<string, string>;
  recognitionCandidateCount: number;
  representedCollectionCount: number;
  sessionCount: number;
}

export interface LibraryHomeRecentSession {
  sessionRef: string;
  sportRef: string | null;
  startedAtLocal: string;
  durationMilliseconds: string;
  distanceMeters: number | null;
  sportState: TrainingSportState;
  canonicalFamily: SportFamily | null;
  displayLabel: string | null;
  localizedNames: Record<string, string>;
  recognitionCandidateCount: number;
}

export interface LibraryHomeTraining {
  trainingSnapshotRef: string;
  sessionCount: number;
  sportCollectionCount: number;
  omittedSportCollectionCount: number;
  sports: LibraryHomeSportSummary[];
  recentSessions: LibraryHomeRecentSession[];
}

export interface LibraryHomeTrainingPeriod {
  range: LibraryHomeDateRange;
  sessionCount: number;
  totalDurationMilliseconds: string;
}

export interface RecentTrainingComparisonHighlight {
  kind: "recent-training-comparison";
  referenceDate: string;
  baseline: LibraryHomeTrainingPeriod;
  comparison: LibraryHomeTrainingPeriod;
  sessionCountChange: string;
  durationChangeMilliseconds: string;
}

export interface HistoricalTrainingHighlight {
  kind: "historical-training";
  referenceDate: string;
  currentRange: LibraryHomeDateRange;
  latestSessionDate: string;
  reason: "no-current-training" | "history-after-reference-date";
}

export interface LibraryHistoryHighlight {
  kind: "library-history";
  latestEvidenceDate: string;
}

export type LibraryHomeHighlight =
  | RecentTrainingComparisonHighlight
  | HistoricalTrainingHighlight
  | LibraryHistoryHighlight;

export interface ExplorationWorkspace {
  version: 1;
  destination: ExploreDestination;
}

export interface LibraryHome {
  version: 6;
  libraryRevisionRef: string;
  recordedRange: LibraryHomeDateRange | null;
  usableRange: LibraryHomeDateRange | null;
  primaryRange: LibraryHomePrimaryRange | null;
  domains: LibraryDomainCoverage[];
  questions: LibraryQuestion[];
  training: LibraryHomeTraining | null;
  highlight: LibraryHomeHighlight | null;
  postImport: LibraryPostImportReveal | null;
  resumableExploration: ExplorationWorkspace | null;
}

export interface LibraryHomeMessages {
  eyebrow: string;
  title: string;
  intro: string;
  availablePeriod: string;
  primaryRanges: Record<LibraryHomeRangeScope, string>;
  rangeSeparator: string;
  questionsHeading: string;
  questionsIntro: string;
  questions: Record<LibraryQuestionKind, string>;
  opening: Record<ExploreDestination, string>;
  resumeHeading: string;
  resume: Record<ExploreDestination, string>;
  coverageHeading: string;
  coverageSummary: string;
  coverageIntro: string;
  domains: Record<LibraryDomain, string>;
  records: { one: string; other: string };
  measurements: { one: string; other: string };
  unavailable: string;
  sources: string;
  summarySessions: { one: string; other: string };
  summarySports: { one: string; other: string };
  sportsHeading: string;
  sportsIntro: string;
  sportFamilies: Record<SportFamily, string>;
  sportUnknown: string;
  sportUnknownIndexed: string;
  sportAmbiguous: string;
  sportAmbiguousIndexed: string;
  sportUnavailable: string;
  classifySport: string;
  classifySportAccessible: string;
  openSportSessions: string;
  sportSessions: { one: string; other: string };
  sportCollections: { one: string; other: string };
  omittedSports: { one: string; other: string };
  recentHeading: string;
  recentIntro: string;
  recentOpen: string;
  durationHoursMinutes: string;
  durationHours: string;
  durationMinutes: string;
  durationLessThanMinute: string;
  recentDistance: string;
  comparisonEyebrow: string;
  comparisonHeading: string;
  comparisonIntro: string;
  comparisonCurrent: string;
  comparisonPrevious: string;
  comparisonOpen: string;
  comparisonSessions: { one: string; other: string };
  historicalEyebrow: string;
  historicalHeading: string;
  historicalNoCurrentTraining: string;
  historicalFutureHistory: string;
  historicalOpen: string;
  libraryHistoryEyebrow: string;
  libraryHistoryHeading: string;
  libraryHistoryIntro: string;
  emptyHeading: string;
  emptyIntro: string;
  emptyLocalBoundary: string;
  emptyAction: string;
  emptyGuideAction: string;
  partialHeading: string;
  partialIntro: string;
  partialAction: string;
  emptyPreviewEyebrow: string;
  emptyPreviewHeading: string;
  emptyPreviewNote: string;
  emptyPreviewSports: Record<IllustratedSportFamily, { label: string; detail: string }>;
  postImportHeadingChanged: string;
  postImportHeadingUnchanged: string;
  postImportHeadingExactRepeat: string;
  postImportChanged: string;
  postImportUnchanged: string;
  postImportExactRepeat: string;
  backHome: string;
  returning: string;
}
