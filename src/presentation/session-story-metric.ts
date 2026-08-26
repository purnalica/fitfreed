import type { Locale } from "../locales/catalogs";
import type { SessionStoryMetric, SessionStoryValueTransform } from "./session-story";
import {
  formatAnalyticalPace,
  integerCountFormatter,
  summaryDecimalFormatter,
} from "./presentation-format";

export function formatSessionStoryMetricValue(
  metric: SessionStoryMetric,
  value: number,
  locale: Locale,
  unit: string,
): string {
  if (metric === "pace") {
    return `${formatAnalyticalPace(value, locale)} ${unit}`;
  }
  const wholeNumber = metric === "heart-rate" || metric === "cadence"
    || metric === "stroke-rate" || metric === "power";
  const formatted = (wholeNumber
    ? integerCountFormatter(locale)
    : summaryDecimalFormatter(locale)).format(value);
  return `${formatted} ${unit}`;
}

export function transformSessionStoryValue(
  transform: SessionStoryValueTransform,
  value: number | null,
): number | null {
  if (value === null) return null;
  if (transform === "identity") return value;
  return value > 0 ? 60 / value : null;
}
