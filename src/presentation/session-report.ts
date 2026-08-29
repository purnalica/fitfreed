import type { TrainingSessionSearchItem, TrainingSessionSport } from "./training-session-search";
import type { TrainingProvenanceCurrent } from "./training-session-provenance";
import type { TrainingRouteKind, TrainingRoutePoint } from "./training-session-route";
import type { TrainingComparison, TrainingDateRange } from "./training-insights";
import type { PlannedTrainingTargetDetail } from "./planned-training";

export interface SessionReportOrigin {
  kind: "session";
  snapshotRef: string;
  session: TrainingSessionSearchItem;
}

export interface SessionEvidenceReportBlock {
  kind: "session-evidence";
  blockRef: string;
  sessionRef: string;
  includePhysiologicalContext: boolean;
}

export interface NarrativeReportBlock {
  kind: "narrative";
  blockRef: string;
  body: string;
}

export interface PlannedTrainingReportOrigin {
  kind: "planned-training";
  snapshotRef: string;
  target: PlannedTrainingTargetDetail;
}

export interface PlannedTrainingReportBlock {
  kind: "planned-training";
  blockRef: string;
  targetRef: string;
}

export interface RouteReportBlock {
  kind: "route";
  blockRef: string;
  sessionRef: string;
  routeRef: string;
  endpointRedactionMeters: number;
}

export type ReportTrainingMetric =
  | "session-count"
  | "training-days"
  | "duration"
  | "distance"
  | "energy";

export interface ReportTrainingComparisonQuery {
  question: "training-period-comparison";
  questionVersion: 1;
  baselineRange: TrainingDateRange;
  comparisonRange: TrainingDateRange;
}

export interface TrainingFindingReportBlock {
  kind: "training-finding";
  blockRef: string;
  query: ReportTrainingComparisonQuery;
  metric: ReportTrainingMetric;
}

export interface TrainingComparisonReportBlock {
  kind: "training-comparison";
  blockRef: string;
  query: ReportTrainingComparisonQuery;
}

export interface TrainingChartReportBlock {
  kind: "training-chart";
  blockRef: string;
  query: ReportTrainingComparisonQuery;
  metric: ReportTrainingMetric;
}

export interface TrainingExactTableReportBlock {
  kind: "training-exact-table";
  blockRef: string;
  query: ReportTrainingComparisonQuery;
}

export interface TrainingCoverageReportBlock {
  kind: "training-coverage";
  blockRef: string;
  query: ReportTrainingComparisonQuery;
}

export type AnalyticalReportBlock =
  | TrainingFindingReportBlock
  | TrainingComparisonReportBlock
  | TrainingChartReportBlock
  | TrainingExactTableReportBlock
  | TrainingCoverageReportBlock;

export type ReportBlock =
  | SessionEvidenceReportBlock
  | RouteReportBlock
  | NarrativeReportBlock
  | AnalyticalReportBlock
  | PlannedTrainingReportBlock;

export interface ReportDefinition {
  reportRef: string;
  title: string;
  locale: "en-US" | "es-ES";
  sourceSnapshotRef: string;
  origin: ReportOrigin;
  provenancePolicy: "current-attribution";
  authorship: "user";
  definitionVersion: 1 | 2 | 3 | 4 | 5;
  revision: string;
  blocks: ReportBlock[];
}

export type ReportOrigin =
  | { kind: "session"; sessionRef: string }
  | {
      kind: "question";
      question: "training-period-comparison";
      questionVersion: 1;
    }
  | { kind: "exploration"; query: ReportTrainingComparisonQuery }
  | { kind: "planned-training"; targetRef: string }
  | { kind: "blank" };

export type ReportStartOrigin =
  | SessionReportOrigin
  | { kind: "question" }
  | { kind: "exploration"; query: ReportTrainingComparisonQuery }
  | PlannedTrainingReportOrigin;

export type ReportStart =
  | {
      kind: "question";
      question: "training-period-comparison";
      questionVersion: 1;
    }
  | { kind: "exploration"; query: ReportTrainingComparisonQuery }
  | { kind: "blank" };

export interface PreparedReportStart {
  sourceSnapshotRef: string;
  origin: Exclude<ReportOrigin, { kind: "session" }>;
  suggestedQuery: ReportTrainingComparisonQuery | null;
}

export interface ReportSummary {
  reportRef: string;
  title: string;
  locale: "en-US" | "es-ES";
  sourceSnapshotRef: string;
  revision: string;
}

export interface ReportList {
  reports: ReportSummary[];
}

export type ReportLibraryEvidenceState =
  | "current"
  | "stale"
  | "unavailable"
  | "authored-only";

export type ReportLibraryMetricValue =
  | { kind: "integer"; value: string }
  | { kind: "decimal"; value: number };

export type ReportLibrarySubject =
  | { kind: "session"; sport: TrainingSessionSport }
  | { kind: "training-comparison" }
  | { kind: "planned-training"; name: string | null }
  | { kind: "authored-note" };

export type ReportLibraryPeriod =
  | { kind: "session"; startedAtLocal: string }
  | {
      kind: "training-comparison";
      baselineRange: TrainingDateRange;
      comparisonRange: TrainingDateRange;
    }
  | { kind: "planned-training"; scheduledAtLocal: string };

export interface ReportLibraryComparisonSeries {
  sourceIndex: number;
  baselineValue: ReportLibraryMetricValue | null;
  comparisonValue: ReportLibraryMetricValue | null;
  change: ReportLibraryMetricValue | null;
}

export type ReportLibraryResult =
  | {
      kind: "session";
      metric: "duration" | "distance";
      value: ReportLibraryMetricValue;
    }
  | {
      kind: "training-comparison";
      metric: ReportTrainingMetric;
      series: ReportLibraryComparisonSeries[];
      omittedSourceCount: number;
    }
  | {
      kind: "planned-training";
      exerciseCount: number | null;
      phaseCount: number | null;
      expandedPhaseCount: number | null;
      repeatBlockCount: number | null;
    };

export interface ReportLibrarySensitivity {
  includesPhysiologicalContext: boolean;
  preciseLocationBlockCount: number;
  minimumEndpointRedactionMeters: number | null;
}

export interface ReportLibraryItem extends ReportSummary {
  evidenceState: ReportLibraryEvidenceState;
  subject: ReportLibrarySubject;
  period: ReportLibraryPeriod | null;
  result: ReportLibraryResult | null;
  sensitivity: ReportLibrarySensitivity;
}

export interface ReportLibraryPage {
  items: ReportLibraryItem[];
  totalCount: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
}

export interface RemovedReport {
  reportRef: string;
  title: string;
  revision: string;
}

export interface RefreshReportRequest {
  reportRef: string;
  expectedRevision: string;
  expectedSourceSnapshotRef: string;
  expectedResolvedSnapshotRef: string;
}

export interface DuplicateReportRequest {
  sourceReportRef: string;
  expectedSourceRevision: string;
  title: string;
}

export type ReportExampleId =
  | "adjacent-period-volume"
  | "session-visual-story"
  | "outdoor-route"
  | "structured-training-plan";

export type ReportExamplePurpose =
  | "compare-training-volume"
  | "understand-one-session"
  | "investigate-outdoor-route"
  | "review-structured-training";

export type ReportExampleQuestion =
  | "how-has-training-changed"
  | "what-happened-in-this-session"
  | "where-did-this-session-change"
  | "how-was-this-training-structured";

export type ReportExampleCapability =
  | "training-history"
  | "training-session"
  | "route-evidence"
  | "structured-training";

export type ReportExampleParameter =
  | "none"
  | "training-session"
  | "routed-training-session"
  | "planned-training-target";

export type ReportExampleBlockRecipe =
  | "training-finding-session-count"
  | "training-chart-duration"
  | "training-coverage"
  | "session-evidence"
  | "route"
  | "planned-training";

export type ReportExampleDestination = "training-sessions" | "planned-training";

export type ReportExampleAvailability =
  | { kind: "ready" }
  | { kind: "selection-required"; destination: ReportExampleDestination }
  | { kind: "unavailable"; missingCapabilities: ReportExampleCapability[] };

export interface ReportExampleDescriptor {
  id: ReportExampleId;
  version: 1;
  purpose: ReportExamplePurpose;
  question: ReportExampleQuestion;
  requiredCapabilities: ReportExampleCapability[];
  parameter: ReportExampleParameter;
  blockRecipe: ReportExampleBlockRecipe[];
  availability: ReportExampleAvailability;
}

export interface ReportExampleCatalog {
  examples: ReportExampleDescriptor[];
}

export interface ReportExampleTrainingSessionSubject {
  session: TrainingSessionSearchItem;
  hasRouteEvidence: boolean;
}

export interface ReportExampleTrainingSessionSubjectPage {
  exampleId: Extract<ReportExampleId, "session-visual-story" | "outdoor-route">;
  exampleVersion: 1;
  snapshotRef: string;
  totalCount: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
  subjects: ReportExampleTrainingSessionSubject[];
}

export interface ReportExamplePlannedTrainingSubject {
  targetRef: string;
  kind: "scheduled" | "favorite-template";
  scheduledAtLocal: string | null;
  completion: "pending" | "completed" | null;
  name: string;
  exerciseCount: number;
  phaseCount: number;
  repeatBlockCount: number;
  containsIntensityEvidence: boolean;
}

export interface ReportExamplePlannedTrainingSubjectPage {
  exampleId: Extract<ReportExampleId, "structured-training-plan">;
  exampleVersion: 1;
  snapshotRef: string;
  totalCount: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
  subjects: ReportExamplePlannedTrainingSubject[];
}

export type ReportLimitation =
  | "distance-unavailable"
  | "energy-unavailable"
  | "heart-rate-unavailable"
  | "sport-unclassified"
  | "sport-unavailable";

export interface ResolvedReport {
  definition: ReportDefinition;
  resolvedSnapshotRef: string;
  status: "current" | "stale";
  session: TrainingSessionSearchItem | null;
  routes: ReportRouteEvidence[];
  trainingComparison: TrainingComparison | null;
  plannedTraining: ReportPlannedTrainingEvidence | null;
  provenance: ReportEvidenceProvenance;
  sensitiveContents: ReportSensitiveContent[];
  limitations: ReportLimitation[];
  runParameters: ResolvedReportRunParameters;
}

export interface ResolvedReportRunParameters {
  trainingComparison: ResolvedTrainingComparisonRunParameters | null;
}

export interface ResolvedTrainingComparisonRunParameters {
  savedDefault: ReportTrainingComparisonQuery;
  effectiveValue: ReportTrainingComparisonQuery;
  origin: "saved-default" | "transient-override";
}

export type ReportEvidenceProvenance =
  | { kind: "session"; current: TrainingProvenanceCurrent }
  | { kind: "library-snapshot" }
  | { kind: "planned-training-snapshot" }
  | { kind: "authored-only" };

export interface ReportPlannedTrainingEvidence {
  blockRef: string;
  target: PlannedTrainingTargetDetail;
}

export type ResolvedSessionReport = ResolvedReport & {
  session: TrainingSessionSearchItem;
  provenance: { kind: "session"; current: TrainingProvenanceCurrent };
};

export interface ReportRouteEvidence {
  blockRef: string;
  routeRef: string;
  kind: TrainingRouteKind;
  startedAtLocal: string;
  sourcePointCount: number;
  visualPoints: TrainingRoutePoint[];
  endpointRedactionMeters: number;
  included: boolean;
}

export type ReportSensitiveContent =
  | {
      kind: "heart-rate";
      blockRef: null;
      included: boolean;
      endpointRedactionMeters: null;
    }
  | {
      kind: "precise-location";
      blockRef: string;
      included: boolean;
      endpointRedactionMeters: number;
    };

export type SessionReportBlockDraft =
  | {
      kind: "session-evidence";
      blockRef?: string;
      includePhysiologicalContext: boolean;
    }
  | {
      kind: "route";
      blockRef?: string;
      routeRef: string;
      endpointRedactionMeters: number;
    }
  | {
      kind: "narrative";
      blockRef?: string;
      body: string;
    }
  | {
      kind: "planned-training";
      blockRef?: string;
      targetRef: string;
    }
  | {
      kind: "training-finding";
      blockRef?: string;
      query: ReportTrainingComparisonQuery;
      metric: ReportTrainingMetric;
    }
  | {
      kind: "training-comparison";
      blockRef?: string;
      query: ReportTrainingComparisonQuery;
    }
  | {
      kind: "training-chart";
      blockRef?: string;
      query: ReportTrainingComparisonQuery;
      metric: ReportTrainingMetric;
    }
  | {
      kind: "training-exact-table";
      blockRef?: string;
      query: ReportTrainingComparisonQuery;
    }
  | {
      kind: "training-coverage";
      blockRef?: string;
      query: ReportTrainingComparisonQuery;
    };

export interface ReportExportReceipt {
  byteCount: string;
}

export function sessionReportBlock(definition: ReportDefinition): SessionEvidenceReportBlock {
  const block = definition.blocks.find(
    (candidate): candidate is SessionEvidenceReportBlock => candidate.kind === "session-evidence",
  );
  if (!block) throw new Error("A report definition has no session evidence block");
  return block;
}

export function narrativeReportBlock(definition: ReportDefinition): NarrativeReportBlock {
  const block = definition.blocks.find(
    (candidate): candidate is NarrativeReportBlock => candidate.kind === "narrative",
  );
  if (!block) throw new Error("A report definition has no narrative block");
  return block;
}
