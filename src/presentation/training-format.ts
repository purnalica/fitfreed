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

export function trainingLocalDateTime(value: string): Date {
  return new Date(`${value}Z`);
}

export function formatTrainingDateTime(value: string, locale: string): string {
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC",
  });
  const fractional = value.split(".")[1];
  if (!fractional) return dateTime.format(trainingLocalDateTime(value));
  const decimal = new Intl.NumberFormat(locale)
    .formatToParts(1.1)
    .find((part) => part.type === "decimal")?.value ?? ".";
  return dateTime
    .formatToParts(trainingLocalDateTime(value))
    .map((part) => part.type === "second" ? `${part.value}${decimal}${fractional}` : part.value)
    .join("");
}

export function formatSessionCardDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(trainingLocalDateTime(value));
}

export function formatSessionCardTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeStyle: "short",
    timeZone: "UTC",
  }).format(trainingLocalDateTime(value));
}

export function formatSessionCardDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(trainingLocalDateTime(value));
}

export function formatSessionCardDuration(
  value: string,
  locale: string,
  units: DurationUnitLabels,
): string {
  const number = new Intl.NumberFormat(locale);
  const exact = BigInt(value);
  const negative = exact < 0n;
  const absolute = negative ? -exact : exact;
  const sign = negative ? "−" : "";
  if (absolute < 59_500n) {
    const seconds = (absolute + 500n) / 1_000n;
    return `${sign}${number.format(seconds)} ${units.seconds}`;
  }

  const roundedMinutes = (absolute + 30_000n) / 60_000n;
  const hours = roundedMinutes / 60n;
  const minutes = roundedMinutes % 60n;
  const parts: string[] = [];
  if (hours > 0n) parts.push(`${number.format(hours)} ${units.hours}`);
  if (minutes > 0n) parts.push(`${number.format(minutes)} ${units.minutes}`);
  return `${sign}${parts.join(" ")}`;
}

export function formatSessionCardDistance(
  value: number,
  locale: string,
  units: DistanceUnitLabels,
): string {
  if (value >= 1_000) {
    const kilometers = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    return `${kilometers.format(value / 1_000)} ${units.kilometers}`;
  }
  const meters = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return `${meters.format(value)} ${units.meters}`;
}

export function formatDuration(
  value: string,
  locale: string,
  units: DurationUnitLabels,
  showSign = false,
): string {
  const number = new Intl.NumberFormat(locale);
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
  if (milliseconds > 0n || parts.length === 0) {
    parts.push(`${number.format(milliseconds)} ${units.milliseconds}`);
  }
  const sign = negative ? "−" : showSign && exact > 0n ? "+" : "";
  return `${sign}${parts.join(" ")}`;
}

export function formatExactMetric(
  value: string | null,
  locale: string,
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
  locale: string,
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
