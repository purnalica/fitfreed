export type LibraryDomain = "training" | "activity" | "sleep" | "recovery";

export type ExploreDestination = LibraryDomain | "longitudinal";

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
  availableRange: LibraryHomeDateRange | null;
  selectedRange: LibraryHomeDateRange | null;
  originCount: number;
  observedRecordCount: number;
  measurements: LibraryMeasurementCoverage[];
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
  sourceReviewRecommended: boolean;
}

export interface ExplorationWorkspace {
  version: 1;
  destination: ExploreDestination;
}

export interface LibraryHome {
  availableRange: LibraryHomeDateRange | null;
  domains: LibraryDomainCoverage[];
  questions: LibraryQuestion[];
  postImport: LibraryPostImportReveal | null;
  resumableExploration: ExplorationWorkspace | null;
}

export interface LibraryHomeMessages {
  eyebrow: string;
  title: string;
  intro: string;
  availablePeriod: string;
  rangeSeparator: string;
  questionsHeading: string;
  questionsIntro: string;
  questions: Record<LibraryQuestionKind, string>;
  opening: Record<ExploreDestination, string>;
  resumeHeading: string;
  resume: Record<ExploreDestination, string>;
  coverageHeading: string;
  coverageIntro: string;
  domains: Record<LibraryDomain, string>;
  records: { one: string; other: string };
  measurements: { one: string; other: string };
  unavailable: string;
  sources: string;
  emptyHeading: string;
  emptyIntro: string;
  emptyAction: string;
  postImportHeading: string;
  postImportChanged: string;
  postImportUnchanged: string;
  postImportExactRepeat: string;
  postImportNew: { one: string; other: string };
  postImportEnriched: { one: string; other: string };
  postImportAmended: { one: string; other: string };
  postImportReview: string;
  backHome: string;
  returning: string;
}
