export type TrainingSourceProvider = "polar-flow";

export type TrainingProvenanceDecision =
  | "create"
  | "equivalent"
  | "enrich"
  | "amend"
  | "preserve"
  | "conflict";

export interface TrainingProvenanceCurrent {
  provider: TrainingSourceProvider;
  sourceModifiedAtUtc: string;
  sourceAdapterVersion: string;
  mappingVersion: string;
  contributingEventCount: number;
  nonContributingEventCount: number;
}

export interface TrainingProvenanceEvent {
  ordinal: number;
  observedAtUtc: string;
  sourceModifiedAtUtc: string;
  provider: TrainingSourceProvider;
  sourceAdapterVersion: string;
  mappingVersion: string;
  decision: TrainingProvenanceDecision;
  contributesToVisibleState: boolean;
}

export interface TrainingSessionProvenanceResult {
  snapshotRef: string;
  sessionRef: string;
  totalEventCount: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
  current: TrainingProvenanceCurrent;
  events: TrainingProvenanceEvent[];
}
