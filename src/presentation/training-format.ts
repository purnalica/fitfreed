import type { Locale } from "../locales/catalogs";
import {
  type DistanceUnitLabels,
  type DurationUnitLabels,
  formatDistance as formatPresentedDistance,
  formatSummaryDuration,
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
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: hasSecondPrecision ? "medium" : "short",
    timeZone: "UTC",
  });
  if (!hasFractionalPrecision) return dateTime.format(trainingLocalDateTime(value));
  const decimal = new Intl.NumberFormat(locale)
    .formatToParts(1.1)
    .find((part) => part.type === "decimal")?.value ?? ".";
  return dateTime
    .formatToParts(trainingLocalDateTime(value))
    .map((part) => part.type === "second" ? `${part.value}${decimal}${fractional}` : part.value)
    .join("");
}

export function formatSessionCardDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(trainingLocalDateTime(value));
}

export function formatSessionCardTime(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    timeStyle: "short",
    timeZone: "UTC",
  }).format(trainingLocalDateTime(value));
}

export function formatSessionCardDateTime(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(trainingLocalDateTime(value));
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
  return formatPresentedDistance(value, locale, units);
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
  const number = new Intl.NumberFormat(locale, showSign ? { signDisplay: "exceptZero" } : {});
  return `${number.format(exact)} ${unit}`;
}

export function formatDistance(
  value: number | null,
  locale: Locale,
  unavailable: string,
  unit: string,
  showSign = false,
): string {
  if (value === null) return unavailable;
  const number = new Intl.NumberFormat(locale, {
    maximumSignificantDigits: 17,
    signDisplay: showSign ? "exceptZero" : "auto",
  });
  return `${number.format(value)} ${unit}`;
}

export function formatUtcOffset(value: number | null, unavailable: string): string {
  if (value === null) return unavailable;
  const sign = value < 0 ? "−" : "+";
  const absolute = Math.abs(value);
  const hours = Math.floor(absolute / 60).toString().padStart(2, "0");
  const minutes = (absolute % 60).toString().padStart(2, "0");
  return `UTC${sign}${hours}:${minutes}`;
}
