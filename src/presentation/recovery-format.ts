import type { RecoveryDateRange } from "./recovery-insights";

export function recoveryLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function recoveryRangeIsValid(
  range: RecoveryDateRange,
  available: RecoveryDateRange,
): boolean {
  if (!range.from || !range.through || range.from > range.through) return false;
  if (range.from < available.from || range.through > available.through) return false;
  const milliseconds = recoveryLocalDate(range.through).getTime()
    - recoveryLocalDate(range.from).getTime();
  return Math.floor(milliseconds / 86_400_000) + 1 <= 366;
}

export function formatRecoveryMilliseconds(
  value: string | null,
  locale: string,
  unavailable: string,
  signed = false,
): string {
  if (value === null) return unavailable;
  return `${new Intl.NumberFormat(locale, {
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(BigInt(value))} ms`;
}

export function recoveryBarWidth(value: string | null, maximum: bigint): string {
  if (value === null) return "0%";
  return `${Number((BigInt(value) * 10_000n) / maximum) / 100}%`;
}
