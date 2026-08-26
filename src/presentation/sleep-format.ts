import type { Locale } from "../locales/catalogs";
import type { SleepDateRange, SleepPhaseSummary, SleepStageTransition } from "./sleep-insights";
import { type DurationUnitLabels, formatDetailDuration } from "./presentation-format";

export function sleepLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function sleepRangeIsValid(range: SleepDateRange, available: SleepDateRange): boolean {
  if (!range.from || !range.through || range.from > range.through) return false;
  if (range.from < available.from || range.through > available.through) return false;
  const inclusiveDays = Math.floor(
    (sleepLocalDate(range.through).getTime() - sleepLocalDate(range.from).getTime()) / 86_400_000,
  ) + 1;
  return inclusiveDays <= 366;
}

export function formatSleepDateTime(value: string, locale: Locale): string {
  const offset = value.slice(-6);
  const wallClock = value.slice(0, -6);
  const formatted = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(`${wallClock}Z`));
  return `${formatted} (UTC${offset})`;
}

export function formatSleepDuration(
  value: string | null,
  locale: Locale,
  units: DurationUnitLabels,
  unavailable: string,
  showSign = false,
): string {
  return value === null ? unavailable : formatDetailDuration(value, locale, units, showSign);
}

export function formatDecimal(
  value: number | null,
  locale: Locale,
  unavailable: string,
  suffix = "",
  showSign = false,
): string {
  if (value === null) return unavailable;
  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    signDisplay: showSign ? "exceptZero" : "auto",
  });
  return `${number.format(value)}${suffix}`;
}

export function phaseTotal(summary: SleepPhaseSummary): bigint {
  return BigInt(summary.wakeMilliseconds)
    + BigInt(summary.remMilliseconds)
    + BigInt(summary.lightMilliseconds)
    + BigInt(summary.deepMilliseconds)
    + BigInt(summary.unrecognizedMilliseconds);
}

export function percentageWidth(value: string, total: bigint): string {
  if (total === 0n) return "0%";
  const basisPoints = (BigInt(value) * 10_000n) / total;
  return `${Number(basisPoints) / 100}%`;
}

export function timelineSegments(
  transitions: SleepStageTransition[],
  spanMilliseconds: string,
): Array<SleepStageTransition & { width: string }> {
  const span = BigInt(spanMilliseconds);
  return transitions.map((transition, index) => {
    const start = BigInt(transition.offsetMilliseconds);
    const end = index + 1 < transitions.length
      ? BigInt(transitions[index + 1].offsetMilliseconds)
      : span;
    return {
      ...transition,
      width: percentageWidth((end - start).toString(), span),
    };
  });
}
