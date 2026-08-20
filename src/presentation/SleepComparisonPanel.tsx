import { type FormEvent, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import { ProgressSubmitButton } from "./ProgressSubmitButton";
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
  const [baselineRange, setBaselineRange] = useState(initialRange);
  const [comparisonRange, setComparisonRange] = useState(initialRange);
  const [comparison, setComparison] = useState<SleepComparison>();
  const [loading, setLoading] = useState(false);
  const validation = useInvalidForm(onError);
  const { resultHeadingRef, requestResultFocus } = useResultFocus<HTMLHeadingElement>(
    comparison !== undefined,
  );
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const signedNumber = useMemo(
    () => new Intl.NumberFormat(locale, { signDisplay: "exceptZero", maximumFractionDigits: 1 }),
    [locale],
  );
  const date = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }),
    [locale],
  );
  const copy = messages.sleep.comparison;

  function updateBaseline(field: keyof SleepDateRange, value: string) {
    validation.edit();
    setBaselineRange((current) => ({ ...current, [field]: value }));
  }

  function updateComparison(field: keyof SleepDateRange, value: string) {
    validation.edit();
    setComparisonRange((current) => ({ ...current, [field]: value }));
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
    validation.accept();
    setLoading(true);
    onError(undefined);
    const initiatingElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    try {
      const result = await invoke<SleepComparison>("query_sleep_comparison", {
        baselineRange,
        comparisonRange,
      });
      setComparison(result);
      requestResultFocus(initiatingElement);
    } catch (reason) {
      const code = commandErrorCode(reason);
      if (code === "invalid-sleep-range") {
        validation.reject("invalid-sleep-comparison");
      } else {
        onError(code);
      }
    } finally {
      setLoading(false);
    }
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
      <div>
        <h2 id="sleep-comparison-form-heading">{copy.heading}</h2>
        <p>{copy.intro}</p>
      </div>
      <form
        aria-labelledby="sleep-comparison-form-heading"
        aria-busy={loading}
        onSubmit={(event) => void runComparison(event)}
      >
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

      {comparison && (
        <section className="sleep-comparison-result" aria-labelledby="sleep-comparison-heading">
          <div className="sleep-comparison-result-heading">
            <div>
              <h3 ref={resultHeadingRef} id="sleep-comparison-heading" tabIndex={-1}>
                {copy.resultHeading}
              </h3>
              <p>{copy.coverageCaution}</p>
            </div>
            <button type="button" className="secondary" onClick={() => setComparison(undefined)}>
              {copy.clear}
            </button>
          </div>
          {comparison.series.length === 0 ? <p>{copy.empty}</p> : comparison.series.map((series, index) => {
            const durations = [
              BigInt(series.baseline.averageAsleepMilliseconds ?? "0"),
              BigInt(series.comparison.averageAsleepMilliseconds ?? "0"),
            ];
            const maximum = durations.reduce((current, value) => value > current ? value : current, 1n);
            return (
              <section className="sleep-comparison-series" key={series.seriesRef}>
                {comparison.series.length > 1 && (
                  <h4>{messages.sleep.series} {number.format(index + 1)}</h4>
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
                <div className="sleep-table-scroll" tabIndex={0} aria-label={copy.resultHeading}>
                  <table>
                    <caption className="sr-only">{copy.resultHeading}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{copy.metric}</th>
                        <th scope="col">{copy.baseline}<span>{rangeLabel(comparison.baselineRange)}</span></th>
                        <th scope="col">{copy.comparison}<span>{rangeLabel(comparison.comparisonRange)}</span></th>
                        <th scope="col">{copy.change}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows(series.baseline, series.comparison, series).map(([metric, baseline, current, change]) => (
                        <tr key={metric}>
                          <th scope="row">{metric}</th>
                          <td>{baseline}</td>
                          <td>{current}</td>
                          <td>{change}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </section>
      )}
    </div>
  );
}
