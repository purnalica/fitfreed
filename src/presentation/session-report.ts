import type { TrainingSessionSearchItem } from "./training-session-search";
import type { TrainingProvenanceCurrent } from "./training-session-provenance";

export interface SessionReportOrigin {
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

export interface ReportDefinition {
  reportRef: string;
  title: string;
  locale: "en-US" | "es-ES";
  sourceSnapshotRef: string;
  origin: { kind: "session"; sessionRef: string };
  provenancePolicy: "current-attribution";
  authorship: "user";
  definitionVersion: 1;
  revision: string;
  blocks: [SessionEvidenceReportBlock, NarrativeReportBlock];
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

export interface ResolvedSessionReport {
  definition: ReportDefinition;
  resolvedSnapshotRef: string;
  status: "current" | "stale";
  session: TrainingSessionSearchItem;
  provenance: TrainingProvenanceCurrent;
  sensitiveContents: Array<{ kind: "heart-rate"; included: boolean }>;
  limitations: ReportLimitation[];
}

export interface ReportExportReceipt {
  byteCount: string;
}

export function sessionReportBlock(definition: ReportDefinition) {
  return definition.blocks[0];
}

export function narrativeReportBlock(definition: ReportDefinition) {
  return definition.blocks[1];
}
