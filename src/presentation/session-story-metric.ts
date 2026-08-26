import type { Locale } from "../locales/catalogs";
import type { SessionStoryMetric, SessionStoryValueTransform } from "./session-story";
import { integerCountFormatter, summaryDecimalFormatter } from "./presentation-format";

export function formatSessionStoryMetricValue(
  metric: SessionStoryMetric,
  value: number,
  locale: Locale,
  unit: string,
): string {
  if (metric === "pace") {
    const minutes = Math.floor(value);
    const seconds = Math.round((value - minutes) * 60);
    const normalizedMinutes = seconds === 60 ? minutes + 1 : minutes;
    const normalizedSeconds = seconds === 60 ? 0 : seconds;
    return `${integerCountFormatter(locale).format(normalizedMinutes)}:${normalizedSeconds
      .toString().padStart(2, "0")} ${unit}`;
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
