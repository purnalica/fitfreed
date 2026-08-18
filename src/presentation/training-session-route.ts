export interface TrainingSessionRouteQuery {
  sessionRef: string;
  snapshotRef: string | null;
  maxVisualPoints: number;
}

export type TrainingRouteKind = "primary" | "transition";

export interface TrainingRoutePoint {
  ordinal: number;
  latitudeDegrees: number;
  longitudeDegrees: number;
  altitudeMeters: number | null;
  elapsedMilliseconds: string | null;
}

export interface TrainingRouteOverview {
  routeRef: string;
  kind: TrainingRouteKind;
  startedAtLocal: string;
  pointCount: number;
  altitudePointCount: number;
  elapsedPointCount: number;
  projection: "source-ordinal-v1";
  visualPoints: TrainingRoutePoint[];
}

export interface TrainingRouteCollection {
  primary: TrainingRouteOverview | null;
  transition: TrainingRouteOverview | null;
}

export interface TrainingExerciseRoutes {
  exerciseRef: string;
  ordinal: number;
  routes: TrainingRouteCollection | null;
}

export interface TrainingSessionRoutes {
  exercises: TrainingExerciseRoutes[] | null;
}

export interface TrainingSessionRoutesResult {
  snapshotRef: string;
  sessionRef: string;
  routes: TrainingSessionRoutes | null;
}

export interface TrainingRoutePointsQuery {
  sessionRef: string;
  routeRef: string;
  snapshotRef: string | null;
  offset: number;
  limit: number;
}

export interface TrainingRoutePointsResult {
  snapshotRef: string;
  sessionRef: string;
  routeRef: string;
  pointCount: number;
  offset: number;
  points: TrainingRoutePoint[];
  nextOffset: number | null;
}
