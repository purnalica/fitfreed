import type { Locale } from "../locales/catalogs";

export interface DurationUnitLabels {
  hours: string;
  minutes: string;
  seconds: string;
  milliseconds: string;
}

export interface DistanceUnitLabels {
  meters: string;
  kilometers: string;
}

type NumericValue = bigint | number;

export type PresentationRole =
  | "summary"
  | "comparison"
  | "detail"
  | "exact-evidence";

function signPrefix(negative: boolean, hasVisibleValue: boolean, showSign: boolean): string {
  if (negative && hasVisibleValue) return "−";
  return showSign && hasVisibleValue ? "+" : "";
}

export function integerCountFormatter(locale: Locale): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    useGrouping: true,
  });
}

export function signedIntegerCountFormatter(
  locale: Locale,
  signDisplay: "always" | "exceptZero" = "exceptZero",
): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    signDisplay,
    useGrouping: true,
  });
}

export function summaryDecimalFormatter(locale: Locale): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    useGrouping: true,
  });
}

export function signedSummaryDecimalFormatter(locale: Locale): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
    useGrouping: true,
  });
}

export function detailDecimalFormatter(locale: Locale): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    useGrouping: true,
  });
}

export function measurementDecimalFormatter(locale: Locale): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 3,
    useGrouping: true,
  });
}

export function exactDecimalFormatter(locale: Locale): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    maximumSignificantDigits: 17,
    useGrouping: true,
  });
}

export function signedExactDecimalFormatter(locale: Locale): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    maximumSignificantDigits: 17,
    signDisplay: "exceptZero",
    useGrouping: true,
  });
}

export function coordinateDecimalFormatter(locale: Locale): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    maximumSignificantDigits: 17,
    useGrouping: false,
  });
}

export function analyticalAxisNumberFormatter(
  locale: Locale,
  maximumFractionDigits: number,
): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    useGrouping: true,
  });
}

export function pluralRules(locale: Locale): Intl.PluralRules {
  return new Intl.PluralRules(locale);
}

export function mediumDateFormatter(locale: Locale): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}

export function formatMediumDateRange(
  from: string,
  through: string,
  locale: Locale,
  separator: string,
): string {
  const formatter = mediumDateFormatter(locale);
  const format = (value: string) => formatter.format(new Date(`${value}T00:00:00Z`));
  const formattedFrom = format(from);
  return from === through
    ? formattedFrom
    : `${formattedFrom} ${separator} ${format(through)}`;
}

export function longDateFormatter(locale: Locale): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  });
}

export function monthYearFormatter(locale: Locale): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function weekdayFormatter(locale: Locale): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  });
}

export function shortTimeFormatter(locale: Locale): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    timeStyle: "short",
    timeZone: "UTC",
  });
}

export function mediumDateTimeFormatter(locale: Locale): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

export function localMediumDateTimeFormatter(locale: Locale): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function sourcePrecisionDateTimeFormatter(
  locale: Locale,
  includeSeconds: boolean,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: includeSeconds ? "medium" : "short",
    timeZone: "UTC",
  });
}

export function decimalSeparator(locale: Locale): string {
  return summaryDecimalFormatter(locale)
    .formatToParts(1.1)
    .find((part) => part.type === "decimal")?.value ?? ".";
}

export function formatCount(value: NumericValue, locale: Locale): string {
  return integerCountFormatter(locale).format(value);
}

export function formatCountRatio(
  numerator: NumericValue,
  denominator: NumericValue,
  locale: Locale,
  separator: string,
): string {
  const number = integerCountFormatter(locale);
  return `${number.format(numerator)} ${separator} ${number.format(denominator)}`;
}

export function formatSummaryDecimal(value: number, locale: Locale): string {
  return summaryDecimalFormatter(locale).format(value);
}

export function formatDetailDecimal(value: number, locale: Locale): string {
  return detailDecimalFormatter(locale).format(value);
}

export function formatExactDecimal(value: number, locale: Locale): string {
  return exactDecimalFormatter(locale).format(value);
}

export function formatPresentationDecimal(
  value: number,
  locale: Locale,
  role: PresentationRole,
): string {
  switch (role) {
    case "summary":
      return summaryDecimalFormatter(locale).format(value);
    case "comparison":
      return signedSummaryDecimalFormatter(locale).format(value);
    case "detail":
      return detailDecimalFormatter(locale).format(value);
    case "exact-evidence":
      return exactDecimalFormatter(locale).format(value);
  }
}

export function formatLocalDate(value: string, locale: Locale): string {
  return mediumDateFormatter(locale).format(new Date(`${value}T00:00:00Z`));
}

export function formatSummaryDuration(
  value: string,
  locale: Locale,
  units: DurationUnitLabels,
  showSign = false,
): string {
  const number = integerCountFormatter(locale);
  const exact = BigInt(value);
  const negative = exact < 0n;
  const absolute = negative ? -exact : exact;

  if (absolute < 59_500n) {
    const seconds = (absolute + 500n) / 1_000n;
    return `${signPrefix(negative, seconds > 0n, showSign)}${number.format(seconds)} ${units.seconds}`;
  }

  if (absolute < 360_000_000n) {
    const roundedMinutes = (absolute + 30_000n) / 60_000n;
    const hours = roundedMinutes / 60n;
    const minutes = roundedMinutes % 60n;
    const parts: string[] = [];
    if (hours > 0n) parts.push(`${number.format(hours)} ${units.hours}`);
    if (minutes > 0n) parts.push(`${number.format(minutes)} ${units.minutes}`);
    return `${signPrefix(negative, roundedMinutes > 0n, showSign)}${parts.join(" ")}`;
  }

  const roundedHours = (absolute + 1_800_000n) / 3_600_000n;
  return `${signPrefix(negative, roundedHours > 0n, showSign)}${number.format(roundedHours)} ${units.hours}`;
}

export function formatDetailDuration(
  value: string,
  locale: Locale,
  units: DurationUnitLabels,
  showSign = false,
): string {
  const number = integerCountFormatter(locale);
  const exact = BigInt(value);
  const negative = exact < 0n;
  let roundedSeconds = ((negative ? -exact : exact) + 500n) / 1_000n;
  const hasVisibleValue = roundedSeconds > 0n;
  const hours = roundedSeconds / 3_600n;
  roundedSeconds %= 3_600n;
  const minutes = roundedSeconds / 60n;
  const seconds = roundedSeconds % 60n;
  const parts: string[] = [];
  if (hours > 0n) parts.push(`${number.format(hours)} ${units.hours}`);
  if (minutes > 0n) parts.push(`${number.format(minutes)} ${units.minutes}`);
  if (seconds > 0n || parts.length === 0) {
    parts.push(`${number.format(seconds)} ${units.seconds}`);
  }
  return `${signPrefix(negative, hasVisibleValue, showSign)}${parts.join(" ")}`;
}

export function formatExactDuration(
  value: string,
  locale: Locale,
  units: DurationUnitLabels,
  showSign = false,
): string {
  const number = integerCountFormatter(locale);
  const exact = BigInt(value);
  const negative = exact < 0n;
  let remainder = negative ? -exact : exact;
  const hours = remainder / 3_600_000n;
  remainder %= 3_600_000n;
  const minutes = remainder / 60_000n;
  remainder %= 60_000n;
  const seconds = remainder / 1_000n;
  const milliseconds = remainder % 1_000n;
  const parts: string[] = [];
  if (hours > 0n) parts.push(`${number.format(hours)} ${units.hours}`);
  if (minutes > 0n) parts.push(`${number.format(minutes)} ${units.minutes}`);
  if (seconds > 0n) parts.push(`${number.format(seconds)} ${units.seconds}`);
  if (milliseconds > 0n) {
    parts.push(`${number.format(milliseconds)} ${units.milliseconds}`);
  }
  if (parts.length === 0) parts.push(`${number.format(0)} ${units.seconds}`);
  return `${signPrefix(negative, exact !== 0n, showSign)}${parts.join(" ")}`;
}

export function formatPresentationDuration(
  value: string,
  locale: Locale,
  units: DurationUnitLabels,
  role: PresentationRole,
): string {
  switch (role) {
    case "summary":
      return formatSummaryDuration(value, locale, units);
    case "comparison":
      return formatSummaryDuration(value, locale, units, true);
    case "detail":
      return formatDetailDuration(value, locale, units);
    case "exact-evidence":
      return formatExactDuration(value, locale, units);
  }
}

export function formatDistance(
  meters: number,
  locale: Locale,
  units: DistanceUnitLabels,
): string {
  if (Math.abs(meters) >= 1_000) {
    return `${detailDecimalFormatter(locale).format(meters / 1_000)} ${units.kilometers}`;
  }
  return `${integerCountFormatter(locale).format(meters)} ${units.meters}`;
}

export function formatSummaryDistance(
  meters: number,
  locale: Locale,
  units: DistanceUnitLabels,
): string {
  if (Math.abs(meters) >= 1_000) {
    return `${summaryDecimalFormatter(locale).format(meters / 1_000)} ${units.kilometers}`;
  }
  return `${integerCountFormatter(locale).format(meters)} ${units.meters}`;
}

export function formatPresentationDistance(
  meters: number,
  locale: Locale,
  units: DistanceUnitLabels,
  role: PresentationRole,
): string {
  if (role === "exact-evidence") {
    return `${exactDecimalFormatter(locale).format(meters)} ${units.meters}`;
  }

  const useKilometers = Math.abs(meters) >= 1_000;
  const value = useKilometers ? meters / 1_000 : meters;
  const unit = useKilometers ? units.kilometers : units.meters;
  if (role === "comparison") {
    const formatter = useKilometers
      ? signedSummaryDecimalFormatter(locale)
      : signedIntegerCountFormatter(locale);
    return `${formatter.format(value)} ${unit}`;
  }
  if (role === "summary") {
    const formatter = useKilometers
      ? summaryDecimalFormatter(locale)
      : integerCountFormatter(locale);
    return `${formatter.format(value)} ${unit}`;
  }
  const formatter = useKilometers
    ? detailDecimalFormatter(locale)
    : integerCountFormatter(locale);
  return `${formatter.format(value)} ${unit}`;
}

export function formatPace(
  millisecondsPerUnit: number,
  locale: Locale,
  unit: string,
): string {
  const roundedSeconds = Math.max(0, Math.round(millisecondsPerUnit / 1_000));
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;
  return `${integerCountFormatter(locale).format(minutes)}:${seconds.toString().padStart(2, "0")} ${unit}`;
}

export function formatAnalyticalDuration(value: number, locale: Locale): string {
  const rounded = Math.max(0, Math.round(value));
  const totalSeconds = Math.floor(rounded / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor(totalSeconds % 3_600 / 60);
  const seconds = totalSeconds % 60;
  const number = integerCountFormatter(locale);
  const twoDigits = new Intl.NumberFormat(locale, {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  return hours > 0
    ? `${number.format(hours)}:${twoDigits.format(minutes)}:${twoDigits.format(seconds)}`
    : `${number.format(minutes)}:${twoDigits.format(seconds)}`;
}

export function formatAnalyticalPace(value: number, locale: Locale): string {
  const roundedSeconds = Math.max(0, Math.round(value * 60));
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;
  return `${integerCountFormatter(locale).format(minutes)}:${seconds
    .toString().padStart(2, "0")}`;
}

export function formatEnergy(value: number, locale: Locale, unit: string): string {
  return `${integerCountFormatter(locale).format(value)} ${unit}`;
}

export function formatFractionAsPercentage(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
}
