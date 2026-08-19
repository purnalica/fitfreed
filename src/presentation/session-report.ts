import type { TrainingSessionSearchItem } from "./training-session-search";
import type { TrainingProvenanceCurrent } from "./training-session-provenance";
import type { TrainingRouteKind, TrainingRoutePoint } from "./training-session-route";
import type { TrainingComparison, TrainingDateRange } from "./training-insights";

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
  | AnalyticalReportBlock;

export interface ReportDefinition {
  reportRef: string;
  title: string;
  locale: "en-US" | "es-ES";
  sourceSnapshotRef: string;
  origin: ReportOrigin;
  provenancePolicy: "current-attribution";
  authorship: "user";
  definitionVersion: 1 | 2 | 3 | 4;
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
  | { kind: "blank" };

export type ReportStartOrigin =
  | SessionReportOrigin
  | { kind: "question" }
  | { kind: "exploration"; query: ReportTrainingComparisonQuery };

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
  provenance: ReportEvidenceProvenance;
  sensitiveContents: ReportSensitiveContent[];
  limitations: ReportLimitation[];
}

export type ReportEvidenceProvenance =
  | { kind: "session"; current: TrainingProvenanceCurrent }
  | { kind: "library-snapshot" }
  | { kind: "authored-only" };

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
