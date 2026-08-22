import type { TrainingExerciseStructure, TrainingStructure } from "./training-session-detail";
import type { TrainingProvenanceCurrent } from "./training-session-provenance";
import type {
  TrainingRouteOverview,
  TrainingSessionRoutes,
} from "./training-session-route";
import type { TrainingSessionSearchItem, TrainingSessionSport } from "./training-session-search";
import type {
  TrainingSessionSignals,
  TrainingSignalKind,
  TrainingSignalSeriesOverview,
  TrainingSignalUnit,
} from "./training-session-signal";
import type { TrainingSessionZones, TrainingZoneCollection } from "./training-session-zone";

export interface SessionStoryQuery {
  sessionRef: string;
  snapshotRef: string | null;
  maxVisualPoints: number;
  maxVisualSamples: number;
}

export type SessionStoryMetric =
  | "pace"
  | "speed"
  | "heart-rate"
  | "elevation"
  | "cadence"
  | "stroke-rate"
  | "temperature"
  | "power";

export type SessionStoryValueTransform =
  | "identity"
  | "kilometers-per-hour-to-minutes-per-kilometer";

export interface SessionStoryAlignedSample {
  routePointOrdinal: number;
  signalSampleOrdinal: number;
  elapsedMilliseconds: string;
  value: number | null;
  gapBefore: boolean;
}

export interface SessionStoryOverlay {
  signalRef: string;
  metric: SessionStoryMetric;
  sourceKind: TrainingSignalKind;
  sourceUnit: TrainingSignalUnit;
  valueTransform: SessionStoryValueTransform;
  alignedSamples: SessionStoryAlignedSample[];
}

export interface SessionStoryExactRoute {
  routeRef: string;
  pointCount: number;
}

export interface SessionStoryExactSignal {
  signalRef: string;
  kind: TrainingSignalKind;
  unit: TrainingSignalUnit;
  sampleCount: number;
}

export interface SessionStoryRole {
  route: TrainingRouteOverview | null;
  signals: TrainingSignalSeriesOverview[];
  primaryMetric: SessionStoryMetric | null;
  eligibleOverlays: SessionStoryOverlay[];
  exactRoute: SessionStoryExactRoute | null;
  exactSignals: SessionStoryExactSignal[];
}

export interface SessionStoryExercise {
  exerciseRef: string;
  ordinal: number;
  sport: TrainingSessionSport | null;
  structure: TrainingExerciseStructure | null;
  zones: TrainingZoneCollection | null;
  primary: SessionStoryRole;
  transition: SessionStoryRole;
}

export interface SessionStoryProvenance {
  totalEventCount: number;
  current: TrainingProvenanceCurrent;
}

export interface SessionStory {
  schemaVersion: 1;
  snapshotRef: string;
  session: TrainingSessionSearchItem;
  structure: TrainingStructure | null;
  routes: TrainingSessionRoutes | null;
  signals: TrainingSessionSignals | null;
  zones: TrainingSessionZones | null;
  provenance: SessionStoryProvenance;
  exercises: SessionStoryExercise[];
}
