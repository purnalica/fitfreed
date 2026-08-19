import type { TrainingSessionSearchItem } from "./training-session-search";
import type { TrainingProvenanceCurrent } from "./training-session-provenance";
import type { TrainingRouteKind, TrainingRoutePoint } from "./training-session-route";

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

export interface RouteReportBlock {
  kind: "route";
  blockRef: string;
  sessionRef: string;
  routeRef: string;
  endpointRedactionMeters: number;
}

export type ReportBlock =
  | SessionEvidenceReportBlock
  | RouteReportBlock
  | NarrativeReportBlock;

export interface ReportDefinition {
  reportRef: string;
  title: string;
  locale: "en-US" | "es-ES";
  sourceSnapshotRef: string;
  origin: { kind: "session"; sessionRef: string };
  provenancePolicy: "current-attribution";
  authorship: "user";
  definitionVersion: 1 | 2;
  revision: string;
  blocks: ReportBlock[];
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
  routes: ReportRouteEvidence[];
  provenance: TrainingProvenanceCurrent;
  sensitiveContents: ReportSensitiveContent[];
  limitations: ReportLimitation[];
}

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
