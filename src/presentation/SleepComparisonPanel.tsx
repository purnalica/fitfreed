import { type FormEvent, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import { ComparisonPeriodPresets } from "./ComparisonPeriodPresets";
import {
  DataTable,
  NumericTableCell,
  NumericTableHeader,
} from "./DataTable";
import {
  initialComparisonRanges,
  type ComparisonPeriodSelection,
} from "./comparison-period-preset";
import { ProgressSubmitButton } from "./ProgressSubmitButton";
import { submissionOrigin } from "./submission-origin";
import { useInvalidForm } from "./useInvalidForm";
import { useResultFocus } from "./useResultFocus";
import {
  formatDecimal,
  formatSleepDuration,
  sleepLocalDate,
  sleepRangeIsValid,
} from "./sleep-format";
import type {
  SleepComparison,
  SleepDateRange,
  SleepSeriesSummary,
} from "./sleep-insights";
import {
  integerCountFormatter,
  mediumDateFormatter,
  signedSummaryDecimalFormatter,
} from "./presentation-format";

interface SleepComparisonPanelProps {
  availableRange: SleepDateRange;
  initialRange: SleepDateRange;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  onError: (code: string | undefined) => void;
}

function goalPercentage(summary: SleepSeriesSummary): number | null {
  return summary.goalNightCount === 0
    ? null
    : (summary.goalMetNightCount / summary.goalNightCount) * 100;
}

export function SleepComparisonPanel({
  availableRange,
  initialRange,
  locale,
  messages,
  onError,
}: SleepComparisonPanelProps) {
  const initialPeriods = initialComparisonRanges(availableRange, initialRange);
  const [baselineRange, setBaselineRange] = useState(initialPeriods.baseline);
  const [comparisonRange, setComparisonRange] = useState(initialPeriods.comparison);
  const [comparison, setComparison] = useState<SleepComparison>();
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(true);
  const validation = useInvalidForm(onError);
  const { resultHeadingRef, requestResultFocus } = useResultFocus<HTMLHeadingElement>(
    comparison !== undefined,
  );
  const number = useMemo(() => integerCountFormatter(locale), [locale]);
  const signedNumber = useMemo(
    () => signedSummaryDecimalFormatter(locale),
    [locale],
  );
  const date = useMemo(
    () => mediumDateFormatter(locale),
    [locale],
  );
  const copy = messages.sleep.comparison;

  function updateBaseline(field: keyof SleepDateRange, value: string) {
    validation.edit();
    setLoadFailed(false);
    setBaselineRange((current) => ({ ...current, [field]: value }));
  }

  function updateComparison(field: keyof SleepDateRange, value: string) {
    validation.edit();
    setLoadFailed(false);
    setComparisonRange((current) => ({ ...current, [field]: value }));
  }

  function applyPreset(selection: ComparisonPeriodSelection) {
    validation.edit();
    setLoadFailed(false);
    setBaselineRange(selection.baseline);
    setComparisonRange(selection.comparison);
  }

  function humanDuration(value: string): string {
    const exact = BigInt(value);
    const absolute = exact < 0n ? -exact : exact;
    if (absolute === 0n) return copy.zeroDuration;
    if (absolute < 60_000n) return copy.lessThanMinute;
    const totalMinutes = (absolute + 30_000n) / 60_000n;
    const hours = totalMinutes / 60n;
    const minutes = totalMinutes % 60n;
    const parts: string[] = [];
    if (hours > 0n) parts.push(`${number.format(hours)} ${messages.sleep.durationUnits.hours}`);
    if (minutes > 0n) {
      parts.push(`${number.format(minutes)} ${messages.sleep.durationUnits.minutes}`);
    }
    return parts.join(" ");
  }

  function durationConclusion(series: SleepComparison["series"][number]): string {
    if (series.baseline.observedNights === 0 && series.comparison.observedNights === 0) {
      return copy.answerNoNights;
    }
    if (series.averageAsleepMillisecondsChange === null) return copy.answerUnavailable;
    const change = BigInt(series.averageAsleepMillisecondsChange);
    if (change === 0n) return copy.answerUnchanged;
    const value = humanDuration(change.toString());
    return (change > 0n ? copy.answerHigher : copy.answerLower).replace("{value}", value);
  }

  function observedEvidence(series: SleepComparison["series"][number]): string {
    const count = (value: number) => copy.recordedNights[value === 1 ? "one" : "other"]
      .replace("{count}", number.format(value));
    return copy.observedEvidence
      .replace("{baseline}", count(series.baseline.observedNights))
      .replace("{comparison}", count(series.comparison.observedNights));
  }

  function missingEvidence(series: SleepComparison["series"][number]): string {
    return copy.missingEvidence
      .replace("{baseline}", number.format(series.baseline.missingNights))
      .replace("{comparison}", number.format(series.comparison.missingNights));
  }

  async function loadComparison(initiatingElement: HTMLElement | null) {
    validation.accept();
    setLoading(true);
    setLoadFailed(false);
    onError(undefined);
    try {
      const result = await invoke<SleepComparison>("query_sleep_comparison", {
        baselineRange,
        comparisonRange,
      });
      setComparison(result);
      setControlsOpen(false);
      requestResultFocus(initiatingElement);
    } catch (reason) {
      const code = commandErrorCode(reason);
      if (code === "invalid-sleep-range") {
        validation.reject("invalid-sleep-comparison");
        setControlsOpen(true);
      } else {
        setLoadFailed(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function runComparison(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !sleepRangeIsValid(baselineRange, availableRange)
      || !sleepRangeIsValid(comparisonRange, availableRange)
    ) {
      validation.reject("invalid-sleep-comparison");
      return;
    }
    const initiatingElement = submissionOrigin(event.nativeEvent);
    await loadComparison(initiatingElement);
  }

  function rangeLabel(range: SleepDateRange | null): string {
    if (!range) return messages.unavailable;
    return `${date.format(sleepLocalDate(range.from))} ${messages.sleep.rangeSeparator} ${date.format(sleepLocalDate(range.through))}`;
  }

  function rows(
    baseline: SleepSeriesSummary,
    current: SleepSeriesSummary,
    changes: SleepComparison["series"][number],
  ) {
    return [
      [
        messages.sleep.observedNights,
        number.format(baseline.observedNights),
        number.format(current.observedNights),
        signedNumber.format(BigInt(changes.observedNightChange)),
      ],
      [
        messages.sleep.missingNights,
        number.format(baseline.missingNights),
        number.format(current.missingNights),
        signedNumber.format(BigInt(changes.missingNightChange)),
      ],
      [
        messages.sleep.averageAsleep,
        formatSleepDuration(baseline.averageAsleepMilliseconds, locale, messages.sleep.durationUnits, messages.unavailable),
        formatSleepDuration(current.averageAsleepMilliseconds, locale, messages.sleep.durationUnits, messages.unavailable),
        formatSleepDuration(changes.averageAsleepMillisecondsChange, locale, messages.sleep.durationUnits, messages.unavailable, true),
      ],
      [
        messages.sleep.averageInterruption,
        formatSleepDuration(baseline.averageInterruptionMilliseconds, locale, messages.sleep.durationUnits, messages.unavailable),
        formatSleepDuration(current.averageInterruptionMilliseconds, locale, messages.sleep.durationUnits, messages.unavailable),
        formatSleepDuration(changes.averageInterruptionMillisecondsChange, locale, messages.sleep.durationUnits, messages.unavailable, true),
      ],
      [
        messages.sleep.averageEfficiency,
        formatDecimal(baseline.averageEfficiencyPercent, locale, messages.unavailable, "%"),
        formatDecimal(current.averageEfficiencyPercent, locale, messages.unavailable, "%"),
        formatDecimal(changes.averageEfficiencyPercentagePointChange, locale, messages.unavailable, ` ${copy.percentagePoints}`, true),
      ],
      [
        messages.sleep.averageScore,
        formatDecimal(baseline.averageOverallScore, locale, messages.unavailable),
        formatDecimal(current.averageOverallScore, locale, messages.unavailable),
        formatDecimal(changes.averageOverallScoreChange, locale, messages.unavailable, "", true),
      ],
      [
        messages.sleep.goalMet,
        formatDecimal(goalPercentage(baseline), locale, messages.unavailable, "%"),
        formatDecimal(goalPercentage(current), locale, messages.unavailable, "%"),
        formatDecimal(changes.goalMetPercentagePointChange, locale, messages.unavailable, ` ${copy.percentagePoints}`, true),
      ],
    ];
  }

  const inputs = [
    [copy.baselineFrom, baselineRange.from, (value: string) => updateBaseline("from", value)],
    [copy.baselineThrough, baselineRange.through, (value: string) => updateBaseline("through", value)],
    [copy.comparisonFrom, comparisonRange.from, (value: string) => updateComparison("from", value)],
    [copy.comparisonThrough, comparisonRange.through, (value: string) => updateComparison("through", value)],
  ] as const;

  return (
    <div className="sleep-comparison">
      {loading && !comparison && (
        <p className="answer-loading" role="status" aria-live="polite">{copy.comparing}</p>
      )}
      {loadFailed && (
        <section className="answer-retry" aria-label={copy.retryLabel}>
          <p>{copy.loadFailed}</p>
          <button
            type="button"
            className="secondary"
            disabled={loading}
            onClick={(event) => void loadComparison(event.currentTarget)}
          >
            {copy.retry}
          </button>
        </section>
      )}
      {comparison && (
        <section
          className="sleep-comparison-result answer-canvas"
          aria-label={copy.answerLabel}
        >
          <div className="sleep-comparison-result-heading">
            <div>
              <h2 ref={resultHeadingRef} id="sleep-comparison-heading" tabIndex={-1}>
                {comparison.series.length === 0
                  ? copy.empty
                  : comparison.series.length === 1
                    ? durationConclusion(comparison.series[0])
                    : copy.answerMultiple.replace(
                      "{count}",
                      number.format(comparison.series.length),
                    )}
              </h2>
              <p>
                {rangeLabel(comparison.baselineRange)} · {rangeLabel(comparison.comparisonRange)}
              </p>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setComparison(undefined);
                setControlsOpen(true);
              }}
            >
              {copy.clear}
            </button>
          </div>
          {comparison.series.map((series, index) => {
            const durations = [
              BigInt(series.baseline.averageAsleepMilliseconds ?? "0"),
              BigInt(series.comparison.averageAsleepMilliseconds ?? "0"),
            ];
            const maximum = durations.reduce((current, value) => value > current ? value : current, 1n);
            return (
              <section className="sleep-comparison-series" key={series.seriesRef}>
                {comparison.series.length > 1 && (
                  <div className="answer-series-heading">
                    <p>{messages.sleep.series} {number.format(index + 1)}</p>
                    <h3>{durationConclusion(series)}</h3>
                  </div>
                )}
                <div className="comparison-bars" aria-hidden="true">
                  {[
                    [copy.baseline, series.baseline.averageAsleepMilliseconds],
                    [copy.comparison, series.comparison.averageAsleepMilliseconds],
                  ].map(([label, value]) => {
                    const width = (BigInt(value ?? "0") * 10_000n) / maximum;
                    return (
                      <div key={label}>
                        <span>{label}</span>
                        <span className="track"><span className="bar sleep-bar" style={{ width: `${Number(width) / 100}%` }} /></span>
                        <strong>{formatSleepDuration(value, locale, messages.sleep.durationUnits, messages.unavailable)}</strong>
                      </div>
                    );
                  })}
                </div>
                <p className="answer-evidence">{observedEvidence(series)}</p>
                <p className="answer-coverage">{missingEvidence(series)}</p>
                <details className="answer-exact-values">
                  <summary>{copy.exactValues}</summary>
                  <p>{copy.coverageCaution}</p>
                  <DataTable
                    accessibleName={copy.resultHeading}
                    scrollAccessibleName={`${copy.exactValues} · ${messages.sleep.series} ${number.format(index + 1)}`}
                    scrollClassName="sleep-table-scroll"
                  >
                      <thead>
                        <tr>
                          <th scope="col">{copy.metric}</th>
                          <NumericTableHeader scope="col">{copy.baseline}<span>{rangeLabel(comparison.baselineRange)}</span></NumericTableHeader>
                          <NumericTableHeader scope="col">{copy.comparison}<span>{rangeLabel(comparison.comparisonRange)}</span></NumericTableHeader>
                          <NumericTableHeader scope="col">{copy.change}</NumericTableHeader>
                        </tr>
                      </thead>
                      <tbody>
                        {rows(series.baseline, series.comparison, series).map(([metric, baseline, current, change]) => (
                          <tr key={metric}>
                            <th scope="row">{metric}</th>
                            <NumericTableCell>{baseline}</NumericTableCell>
                            <NumericTableCell>{current}</NumericTableCell>
                            <NumericTableCell>{change}</NumericTableCell>
                          </tr>
                        ))}
                      </tbody>
                  </DataTable>
                </details>
              </section>
            );
          })}
        </section>
      )}
      <details
        className="answer-controls"
        open={controlsOpen}
        onToggle={(event) => setControlsOpen(event.currentTarget.open)}
      >
        <summary>{comparison ? copy.changePeriods : copy.heading}</summary>
        <div>
          <h2 id="sleep-comparison-form-heading">{copy.heading}</h2>
          <p>{copy.intro}</p>
        </div>
        <form
          className="sleep-comparison-form"
          aria-labelledby="sleep-comparison-form-heading"
          aria-busy={loading}
          onSubmit={(event) => void runComparison(event)}
        >
          <ComparisonPeriodPresets
            availableRange={availableRange}
            baselineRange={baselineRange}
            comparisonRange={comparisonRange}
            locale={locale}
            messages={messages.comparisonPeriods}
            disabled={loading}
            onSelect={applyPreset}
          />
          {inputs.map(([label, value, update]) => (
            <label key={label}>
              <span>{label}</span>
              <input
                type="date"
                min={availableRange.from}
                max={availableRange.through}
                value={value}
                aria-invalid={validation.invalid || undefined}
                aria-describedby={validation.errorElementId}
                onChange={(event) => update(event.target.value)}
                disabled={loading}
                required
              />
            </label>
          ))}
          <ProgressSubmitButton
            loading={loading}
            actionLabel={copy.compare}
            progressLabel={copy.comparing}
          />
        </form>
      </details>
    </div>
  );
}
