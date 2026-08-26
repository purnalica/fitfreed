import type { Locale } from "../locales/catalogs";

export type AnalyticalChartRenderer = "canvas" | "svg";
export type AnalyticalChartAxisDirection = "higher-at-top" | "lower-at-top";
export type AnalyticalChartLayout = "overlay" | "stacked-lanes";

export type AnalyticalChartValueFormat =
  | { kind: "duration-milliseconds" }
  | { kind: "local-date" }
  | { kind: "number"; maximumFractionDigits: number };

export interface AnalyticalChartDomain {
  minimum: number;
  maximum: number;
}

export interface AnalyticalChartCoordinate {
  ref: string;
  label: string;
  unit: string;
  domain: AnalyticalChartDomain;
  format: AnalyticalChartValueFormat;
}

export interface AnalyticalChartAxis {
  id: string;
  label: string;
  unit: string;
  domain: AnalyticalChartDomain;
  direction: AnalyticalChartAxisDirection;
  format: AnalyticalChartValueFormat;
}

export interface AnalyticalChartPoint {
  id: string;
  coordinate: number;
  value: number | null;
  gapBefore: boolean;
}

export interface AnalyticalChartSeries {
  id: string;
  label: string;
  coordinateRef: string;
  axisId: string;
  points: AnalyticalChartPoint[];
}

export interface AnalyticalChartRangeAnnotation {
  startCoordinate?: number;
  endCoordinate?: number;
}

export interface AnalyticalChartAnnotations {
  selectedCoordinate?: number;
  range?: AnalyticalChartRangeAnnotation;
}

export interface AnalyticalChartInteraction {
  zoom: boolean;
  pointSelection: boolean;
}

export interface AnalyticalChartModel {
  accessibleName: string;
  accessibleDescription: string;
  locale: Locale;
  renderer: AnalyticalChartRenderer;
  layout: { kind: AnalyticalChartLayout };
  coordinate: AnalyticalChartCoordinate;
  axes: AnalyticalChartAxis[];
  series: AnalyticalChartSeries[];
  annotations?: AnalyticalChartAnnotations;
  interaction: AnalyticalChartInteraction;
}

export interface AnalyticalChartSelection {
  seriesId: string;
  pointId: string;
  coordinate: number;
}

export type AnalyticalChartValidationIssue =
  | "empty-accessible-name"
  | "empty-coordinate-ref"
  | "invalid-coordinate-domain"
  | "missing-axis"
  | "duplicate-axis-id"
  | "invalid-axis-domain"
  | "missing-series"
  | "duplicate-series-id"
  | "mixed-coordinate-ref"
  | "unknown-axis"
  | "empty-series"
  | "duplicate-point-id"
  | "unordered-points"
  | "non-finite-point"
  | "point-outside-domain"
  | "selected-coordinate-outside-domain"
  | "invalid-range"
  | "range-outside-domain";

function validDomain(domain: AnalyticalChartDomain): boolean {
  return Number.isFinite(domain.minimum)
    && Number.isFinite(domain.maximum)
    && domain.minimum <= domain.maximum;
}

function insideDomain(value: number, domain: AnalyticalChartDomain): boolean {
  return value >= domain.minimum && value <= domain.maximum;
}

export function analyticalCoordinateFromDecimal(value: string): number | null {
  try {
    const coordinate = BigInt(value);
    if (coordinate < 0n || coordinate > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(coordinate);
  } catch {
    return null;
  }
}

export function analyticalCoordinateFromLocalDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const coordinate = Date.UTC(year, month - 1, day);
  const date = new Date(coordinate);
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? coordinate
    : null;
}

function addIssue(
  issues: AnalyticalChartValidationIssue[],
  issue: AnalyticalChartValidationIssue,
) {
  if (!issues.includes(issue)) issues.push(issue);
}

export function validateAnalyticalChartModel(
  model: AnalyticalChartModel,
): AnalyticalChartValidationIssue[] {
  const issues: AnalyticalChartValidationIssue[] = [];
  if (model.accessibleName.trim() === "") addIssue(issues, "empty-accessible-name");
  if (model.coordinate.ref.trim() === "") addIssue(issues, "empty-coordinate-ref");
  if (!validDomain(model.coordinate.domain)) addIssue(issues, "invalid-coordinate-domain");

  if (model.axes.length === 0) addIssue(issues, "missing-axis");
  const axisIds = new Set<string>();
  for (const axis of model.axes) {
    if (axisIds.has(axis.id)) addIssue(issues, "duplicate-axis-id");
    axisIds.add(axis.id);
    if (!validDomain(axis.domain)) addIssue(issues, "invalid-axis-domain");
  }

  if (model.series.length === 0) addIssue(issues, "missing-series");
  const seriesIds = new Set<string>();
  const pointIds = new Set<string>();
  for (const series of model.series) {
    if (seriesIds.has(series.id)) addIssue(issues, "duplicate-series-id");
    seriesIds.add(series.id);
    if (series.coordinateRef !== model.coordinate.ref) {
      addIssue(issues, "mixed-coordinate-ref");
    }
    if (!axisIds.has(series.axisId)) addIssue(issues, "unknown-axis");
    if (series.points.length === 0) addIssue(issues, "empty-series");

    let previousCoordinate: number | undefined;
    for (const point of series.points) {
      if (pointIds.has(point.id)) addIssue(issues, "duplicate-point-id");
      pointIds.add(point.id);
      if (!Number.isFinite(point.coordinate)
        || (point.value !== null && !Number.isFinite(point.value))) {
        addIssue(issues, "non-finite-point");
      }
      if (previousCoordinate !== undefined && point.coordinate < previousCoordinate) {
        addIssue(issues, "unordered-points");
      }
      previousCoordinate = point.coordinate;
      if (validDomain(model.coordinate.domain)
        && !insideDomain(point.coordinate, model.coordinate.domain)) {
        addIssue(issues, "point-outside-domain");
      }
    }
  }

  const selected = model.annotations?.selectedCoordinate;
  if (selected !== undefined && (!Number.isFinite(selected)
    || !validDomain(model.coordinate.domain)
    || !insideDomain(selected, model.coordinate.domain))) {
    addIssue(issues, "selected-coordinate-outside-domain");
  }

  const range = model.annotations?.range;
  if (range) {
    const start = range.startCoordinate;
    const end = range.endCoordinate;
    if ((start !== undefined && !Number.isFinite(start))
      || (end !== undefined && !Number.isFinite(end))
      || (start !== undefined && end !== undefined && start > end)) {
      addIssue(issues, "invalid-range");
    }
    if (!validDomain(model.coordinate.domain)
      || (start !== undefined && !insideDomain(start, model.coordinate.domain))
      || (end !== undefined && !insideDomain(end, model.coordinate.domain))) {
      addIssue(issues, "range-outside-domain");
    }
  }

  return issues;
}
