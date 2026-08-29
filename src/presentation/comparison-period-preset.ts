export type ComparisonPeriodPresetKind = "week" | "month" | "quarter" | "year";

export interface ComparisonDateRange {
  from: string;
  through: string;
}

export interface ComparisonPeriodSelection {
  kind: ComparisonPeriodPresetKind | null;
  baseline: ComparisonDateRange;
  comparison: ComparisonDateRange;
  anchorDate: string;
  anchor: "today" | "latest-recorded";
}

const DAY_MILLISECONDS = 86_400_000;
const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseLocalDate(value: string): Date | null {
  if (!LOCAL_DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return formatLocalDate(parsed) === value ? parsed : null;
}

function formatLocalDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MILLISECONDS);
}

function daysBetween(from: Date, through: Date): number {
  return Math.floor((through.getTime() - from.getTime()) / DAY_MILLISECONDS);
}

function monthEnd(year: number, month: number): Date {
  return new Date(Date.UTC(year, month + 1, 0));
}

function periodBounds(
  kind: ComparisonPeriodPresetKind,
  anchor: Date,
): { currentFrom: Date; previousFrom: Date; previousThrough: Date } {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  if (kind === "week") {
    const daysFromMonday = (anchor.getUTCDay() + 6) % 7;
    const currentFrom = addDays(anchor, -daysFromMonday);
    const previousFrom = addDays(currentFrom, -7);
    return {
      currentFrom,
      previousFrom,
      previousThrough: addDays(previousFrom, daysFromMonday),
    };
  }
  if (kind === "month") {
    const currentFrom = new Date(Date.UTC(year, month, 1));
    const previousMonth = month === 0 ? 11 : month - 1;
    const previousYear = month === 0 ? year - 1 : year;
    const previousFrom = new Date(Date.UTC(previousYear, previousMonth, 1));
    const previousLastDay = monthEnd(previousYear, previousMonth).getUTCDate();
    return {
      currentFrom,
      previousFrom,
      previousThrough: new Date(Date.UTC(
        previousYear,
        previousMonth,
        Math.min(anchor.getUTCDate(), previousLastDay),
      )),
    };
  }
  if (kind === "quarter") {
    const currentQuarterMonth = Math.floor(month / 3) * 3;
    const currentFrom = new Date(Date.UTC(year, currentQuarterMonth, 1));
    const previousFrom = new Date(Date.UTC(year, currentQuarterMonth - 3, 1));
    const previousQuarterEnd = new Date(Date.UTC(
      previousFrom.getUTCFullYear(),
      previousFrom.getUTCMonth() + 3,
      0,
    ));
    const matchingThrough = addDays(previousFrom, daysBetween(currentFrom, anchor));
    return {
      currentFrom,
      previousFrom,
      previousThrough: matchingThrough < previousQuarterEnd
        ? matchingThrough
        : previousQuarterEnd,
    };
  }
  const currentFrom = new Date(Date.UTC(year, 0, 1));
  const previousYear = year - 1;
  const previousMonth = anchor.getUTCMonth();
  const previousLastDay = monthEnd(previousYear, previousMonth).getUTCDate();
  return {
    currentFrom,
    previousFrom: new Date(Date.UTC(previousYear, 0, 1)),
    previousThrough: new Date(Date.UTC(
      previousYear,
      previousMonth,
      Math.min(anchor.getUTCDate(), previousLastDay),
    )),
  };
}

function validAvailableRange(
  available: ComparisonDateRange,
  today: string,
): { from: Date; through: Date; today: Date } | null {
  const from = parseLocalDate(available.from);
  const through = parseLocalDate(available.through);
  const parsedToday = parseLocalDate(today);
  if (!from || !through || !parsedToday || from > through) return null;
  return { from, through, today: parsedToday };
}

export function comparisonPeriodPreset(
  kind: ComparisonPeriodPresetKind,
  available: ComparisonDateRange,
  today: string,
): ComparisonPeriodSelection | null {
  const parsed = validAvailableRange(available, today);
  if (!parsed) return null;
  const bounds = periodBounds(kind, parsed.through);
  if (bounds.previousFrom < parsed.from || bounds.currentFrom < parsed.from) return null;
  return {
    kind,
    baseline: {
      from: formatLocalDate(bounds.previousFrom),
      through: formatLocalDate(bounds.previousThrough),
    },
    comparison: {
      from: formatLocalDate(bounds.currentFrom),
      through: available.through,
    },
    anchorDate: available.through,
    anchor: parsed.through.getTime() === parsed.today.getTime()
      ? "today"
      : "latest-recorded",
  };
}

export function defaultComparisonPeriods(
  available: ComparisonDateRange,
  today: string,
): ComparisonPeriodSelection | null {
  for (const kind of ["week", "month", "quarter", "year"] as const) {
    const preset = comparisonPeriodPreset(kind, available, today);
    if (preset) return preset;
  }
  const parsed = validAvailableRange(available, today);
  if (!parsed) return null;
  const periodDays = Math.min(30, Math.floor((daysBetween(parsed.from, parsed.through) + 1) / 2));
  if (periodDays < 1) return null;
  const comparisonFrom = addDays(parsed.through, -(periodDays - 1));
  const baselineThrough = addDays(comparisonFrom, -1);
  const baselineFrom = addDays(baselineThrough, -(periodDays - 1));
  if (baselineFrom < parsed.from) return null;
  return {
    kind: null,
    baseline: {
      from: formatLocalDate(baselineFrom),
      through: formatLocalDate(baselineThrough),
    },
    comparison: {
      from: formatLocalDate(comparisonFrom),
      through: available.through,
    },
    anchorDate: available.through,
    anchor: parsed.through.getTime() === parsed.today.getTime()
      ? "today"
      : "latest-recorded",
  };
}

export function initialComparisonRanges(
  available: ComparisonDateRange,
  fallback: ComparisonDateRange,
  today = currentLocalDate(),
): Pick<ComparisonPeriodSelection, "baseline" | "comparison"> {
  const selection = defaultComparisonPeriods(available, today);
  return selection ?? {
    baseline: { from: "", through: "" },
    comparison: { ...fallback },
  };
}

export function currentLocalDate(): string {
  const now = new Date();
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
