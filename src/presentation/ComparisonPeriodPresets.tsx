import { useMemo } from "react";

import type { Locale } from "../locales/catalogs";
import {
  comparisonPeriodPreset,
  currentLocalDate,
  type ComparisonDateRange,
  type ComparisonPeriodPresetKind,
  type ComparisonPeriodSelection,
} from "./comparison-period-preset";
import { mediumDateFormatter } from "./presentation-format";

export interface ComparisonPeriodPresetMessages {
  heading: string;
  week: string;
  month: string;
  quarter: string;
  year: string;
  currentHint: string;
  recordedHint: string;
  manualHint: string;
  unavailable: string;
}

interface ComparisonPeriodPresetsProps {
  availableRange: ComparisonDateRange;
  baselineRange: ComparisonDateRange;
  comparisonRange: ComparisonDateRange;
  locale: Locale;
  messages: ComparisonPeriodPresetMessages;
  disabled?: boolean;
  today?: string;
  onSelect: (selection: ComparisonPeriodSelection) => void;
}

function rangesMatch(left: ComparisonDateRange, right: ComparisonDateRange): boolean {
  return left.from === right.from && left.through === right.through;
}

function localDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function ComparisonPeriodPresets({
  availableRange,
  baselineRange,
  comparisonRange,
  locale,
  messages,
  disabled = false,
  today = currentLocalDate(),
  onSelect,
}: ComparisonPeriodPresetsProps) {
  const date = useMemo(
    () => mediumDateFormatter(locale),
    [locale],
  );
  const options = useMemo(() => (
    (["week", "month", "quarter", "year"] as const).map((kind) => ({
      kind,
      selection: comparisonPeriodPreset(kind, availableRange, today),
    }))
  ), [availableRange.from, availableRange.through, today]);
  const selected = options.find(({ selection }) => selection
    && rangesMatch(selection.baseline, baselineRange)
    && rangesMatch(selection.comparison, comparisonRange))?.selection;
  const label = (kind: ComparisonPeriodPresetKind) => messages[kind];
  const anchorHint = selected?.anchor === "today"
    ? messages.currentHint
    : selected
      ? messages.recordedHint.replace(
        "{date}",
        date.format(localDate(selected.anchorDate)),
      )
      : undefined;

  return (
    <fieldset className="comparison-period-presets">
      <legend>{messages.heading}</legend>
      <div className="comparison-period-preset-actions">
        {options.map(({ kind, selection }) => (
          <button
            key={kind}
            type="button"
            className="secondary"
            aria-pressed={selected?.kind === kind}
            disabled={disabled || selection === null}
            title={selection === null ? messages.unavailable : undefined}
            onClick={() => {
              if (selection) onSelect(selection);
            }}
          >
            {label(kind)}
          </button>
        ))}
      </div>
      <p>
        {anchorHint && <span>{anchorHint} </span>}
        <span>{messages.manualHint}</span>
      </p>
    </fieldset>
  );
}
