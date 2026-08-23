import type { TrainingSessionSport } from "./training-session-search";
import type { TrainingSignalKind, TrainingSignalRole, TrainingSignalUnit } from "./training-session-signal";
import type { TrainingRouteKind } from "./training-session-route";

export type TrainingSessionCurrentRangeCoordinate =
  | { scope: "exercise-elapsed" }
  | { scope: "route-elapsed"; routeRef: string }
  | { scope: "signal-elapsed"; signalRef: string };

export type TrainingSessionRangeCoordinate = TrainingSessionCurrentRangeCoordinate
  | { scope: "legacy-session-elapsed" };

export interface TrainingSessionRangeCoordinateContext {
  coordinate: TrainingSessionCurrentRangeCoordinate;
  maximumElapsedMilliseconds: string;
}

export interface TrainingSessionRangeExerciseContext {
  exerciseRef: string;
  ordinal: number;
  coordinates: TrainingSessionRangeCoordinateContext[];
}

export interface TrainingSessionRange {
  rangeRef: string;
  exerciseRef: string | null;
  coordinate: TrainingSessionRangeCoordinate;
  title: string;
  startedAtElapsedMilliseconds: string;
  endedAtElapsedMilliseconds: string;
  evidenceRevision: string;
  authorship: "user";
  state: "current" | "review-required";
  revision: number;
}

export interface TrainingSessionRangesResult {
  snapshotRef: string;
  sessionRef: string;
  sessionDurationMilliseconds: string;
  evidenceRevision: string;
  exercises: TrainingSessionRangeExerciseContext[];
  ranges: TrainingSessionRange[];
}

export interface TrainingSessionRangeSummaryExercise {
  exerciseRef: string;
  ordinal: number;
  durationMilliseconds: string;
  distanceMeters: number | null;
  sport: TrainingSessionSport;
}

export type TrainingRangeCoordinateEvidence =
  | { scope: "exercise-elapsed"; maximumElapsedMilliseconds: string }
  | { scope: "route-elapsed"; routeRef: string; kind: TrainingRouteKind }
  | {
    scope: "signal-elapsed";
    signalRef: string;
    ordinal: number;
    role: TrainingSignalRole;
    kind: TrainingSignalKind;
    unit: TrainingSignalUnit;
    intervalMilliseconds: string;
  }
  | { scope: "unavailable" };

export type TrainingRangeBoundaryState =
  | "exact"
  | "between-evidence"
  | "outside-recorded-evidence"
  | "no-evidence";

export interface TrainingRangeEvidenceLocation {
  kind: "exercise" | "manual-lap" | "automatic-lap" | "route-point" | "signal-sample";
  evidenceRef: string;
  ordinal: number | null;
  elapsedMilliseconds: string;
}

export interface TrainingRangeBoundaryEvidence {
  elapsedMilliseconds: string;
  state: TrainingRangeBoundaryState;
  exactMatchCount: number;
  exactMatches: TrainingRangeEvidenceLocation[];
  preceding: TrainingRangeEvidenceLocation | null;
  following: TrainingRangeEvidenceLocation | null;
}

export interface TrainingRangeEvidenceCoverage {
  state: "complete" | "partial" | "empty" | "unavailable";
  recordedEvidenceCount: number;
  selectedEvidenceCount: number;
  availableEvidenceCount: number;
  missingEvidenceCount: number;
  missingElapsedEvidenceCount: number;
  missingIntervals: Array<{
    startedAtElapsedMilliseconds: string;
    endedAtElapsedMilliseconds: string;
  }>;
  omittedMissingIntervalCount: number;
}

export interface TrainingRangeMeasurementSummary {
  kind: TrainingSignalKind;
  unit: TrainingSignalUnit;
  minimum: number;
  maximum: number;
  average: number;
  availableEvidenceCount: number;
  missingEvidenceCount: number;
  startBoundaryValue: number | null;
  endBoundaryValue: number | null;
}

export type TrainingRangeSummaryLimitation =
  | "coordinate-unavailable"
  | "boundary-not-exact"
  | "missing-elapsed-route-evidence"
  | "missing-signal-evidence"
  | "insufficient-route-geometry"
  | "ambiguous-source-distance"
  | "distance-unavailable"
  | "moving-time-unavailable"
  | "paused-time-unavailable"
  | "unaligned-source-range-evidence"
  | "unaligned-route-evidence"
  | "unaligned-signal-evidence";

export interface TrainingSessionRangeSummary {
  snapshotRef: string;
  sessionRef: string;
  evidenceRevision: string;
  sourceProvider: string;
  range: TrainingSessionRange;
  exercise: TrainingSessionRangeSummaryExercise | null;
  coordinateEvidence: TrainingRangeCoordinateEvidence;
  elapsedDurationMilliseconds: string;
  movingDurationMilliseconds: string | null;
  pausedDurationMilliseconds: string | null;
  distance: { meters: number; coverage: "complete" | "partial" } | null;
  direction: {
    initialBearingDegrees: number;
    cardinal: "north" | "north-east" | "east" | "south-east" | "south"
      | "south-west" | "west" | "north-west";
  } | null;
  measurements: TrainingRangeMeasurementSummary[];
  boundaries: {
    start: TrainingRangeBoundaryEvidence;
    end: TrainingRangeBoundaryEvidence;
  };
  coverage: TrainingRangeEvidenceCoverage;
  sourceRanges: Array<{
    sourceRangeRef: string;
    kind: "manual-lap" | "automatic-lap";
    ordinal: number;
    startedAtElapsedMilliseconds: string;
    endedAtElapsedMilliseconds: string;
    distanceMeters: number | null;
    relation: "exact" | "source-contains-range" | "range-contains-source" | "overlap";
  }>;
  independentEvidence: {
    sourceRangeCount: number;
    routeCoordinateCount: number;
    signalCoordinateCount: number;
  };
  limitations: TrainingRangeSummaryLimitation[];
}
