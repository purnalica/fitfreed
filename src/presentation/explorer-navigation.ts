import type { ReportTrainingComparisonQuery } from "./session-report";

export interface ExplorerNavigationRequest {
  seriesRef: string;
  localDate: string;
  requestId: number;
}

export interface TrainingSessionNavigationRequest {
  kind: "session";
  sessionRef: string;
  localDate: string;
  requestId: number;
}

export interface TrainingComparisonNavigationRequest {
  kind: "comparison";
  query: ReportTrainingComparisonQuery;
  requestId: number;
}

export interface TrainingSportNavigationRequest {
  kind: "sport";
  sportRef: string;
  requestId: number;
}

export interface TrainingWorkspaceNavigationRequest {
  kind: "sessions" | "sports";
  requestId: number;
}

export type TrainingNavigationRequest =
  | ExplorerNavigationRequest
  | TrainingSessionNavigationRequest
  | TrainingComparisonNavigationRequest
  | TrainingSportNavigationRequest
  | TrainingWorkspaceNavigationRequest;
