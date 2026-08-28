import type { Locale } from "../locales/catalogs";
import {
  type DistanceUnitLabels,
  type DurationUnitLabels,
  type PresentationRole,
  decimalSeparator,
  formatPresentationDistance,
  formatSummaryDuration,
  formatDetailDuration,
  integerCountFormatter,
  mediumDateFormatter,
  mediumDateTimeFormatter,
  shortTimeFormatter,
  signedIntegerCountFormatter,
  sourcePrecisionDateTimeFormatter,
} from "./presentation-format";

export type { DistanceUnitLabels, DurationUnitLabels } from "./presentation-format";

export function trainingLocalDateTime(value: string): Date {
  return new Date(`${value}Z`);
}

export function formatTrainingDateTime(value: string, locale: Locale): string {
  const time = value.match(/T\d{2}:\d{2}:(\d{2})(?:\.(\d+))?/);
  const fractional = time?.[2];
  const hasFractionalPrecision = fractional !== undefined && /[1-9]/.test(fractional);
  const hasSecondPrecision = time === null || time[1] !== "00" || hasFractionalPrecision;
  const dateTime = sourcePrecisionDateTimeFormatter(locale, hasSecondPrecision);
  if (!hasFractionalPrecision) return dateTime.format(trainingLocalDateTime(value));
  const decimal = decimalSeparator(locale);
  return dateTime
    .formatToParts(trainingLocalDateTime(value))
    .map((part) => part.type === "second" ? `${part.value}${decimal}${fractional}` : part.value)
    .join("");
}

export function formatSessionCardDate(value: string, locale: Locale): string {
  return mediumDateFormatter(locale).format(trainingLocalDateTime(value));
}

export function formatSessionCardTime(value: string, locale: Locale): string {
  return shortTimeFormatter(locale).format(trainingLocalDateTime(value));
}

export function formatSessionCardDateTime(value: string, locale: Locale): string {
  return mediumDateTimeFormatter(locale).format(trainingLocalDateTime(value));
}

export interface SessionTimeSpan {
  date: string;
  time: string | null;
  duration: string;
}

export function formatSessionTimeSpan(
  startedAtLocal: string,
  stoppedAtLocal: string,
  durationMilliseconds: string,
  locale: Locale,
  units: DurationUnitLabels,
): SessionTimeSpan {
  const startedAt = trainingLocalDateTime(startedAtLocal);
  const stoppedAt = trainingLocalDateTime(stoppedAtLocal);
  const duration = formatDetailDuration(durationMilliseconds, locale, units);
  const sameDay = startedAtLocal.slice(0, 10) === stoppedAtLocal.slice(0, 10);
  if (sameDay) {
    return {
      date: mediumDateFormatter(locale).format(startedAt),
      time: shortTimeFormatter(locale).formatRange(startedAt, stoppedAt),
      duration,
    };
  }
  return {
    date: mediumDateTimeFormatter(locale).formatRange(startedAt, stoppedAt),
    time: null,
    duration,
  };
}

export function formatSessionCardDuration(
  value: string,
  locale: Locale,
  units: DurationUnitLabels,
): string {
  return formatSummaryDuration(value, locale, units);
}

export function formatSessionCardDistance(
  value: number,
  locale: Locale,
  units: DistanceUnitLabels,
): string {
  return formatPresentationDistance(value, locale, units, "detail");
}

export function formatExactMetric(
  value: string | null,
  locale: Locale,
  unavailable: string,
  unit: string,
  showSign = false,
): string {
  if (value === null) return unavailable;
  const exact = BigInt(value);
  const number = showSign
    ? signedIntegerCountFormatter(locale)
    : integerCountFormatter(locale);
  return `${number.format(exact)} ${unit}`;
}

export function formatDistance(
  value: number | null,
  locale: Locale,
  unavailable: string,
  units: DistanceUnitLabels,
  role: PresentationRole = "detail",
): string {
  if (value === null) return unavailable;
  return formatPresentationDistance(value, locale, units, role);
}

export function formatUtcOffset(value: number | null, unavailable: string): string {
  if (value === null) return unavailable;
  const sign = value < 0 ? "−" : "+";
  const absolute = Math.abs(value);
  const hours = Math.floor(absolute / 60).toString().padStart(2, "0");
  const minutes = (absolute % 60).toString().padStart(2, "0");
  return `UTC${sign}${hours}:${minutes}`;
}
