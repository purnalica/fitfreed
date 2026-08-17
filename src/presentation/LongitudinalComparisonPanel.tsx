import { type FormEvent, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import type {
  LongitudinalComparison,
  LongitudinalDateRange,
  LongitudinalSeriesComparison,
} from "./longitudinal-insights";
import { formatRecoveryMilliseconds, recoveryRangeIsValid } from "./recovery-format";
import { recoveryLocalDate } from "./recovery-format";
import { formatSleepDuration } from "./sleep-format";
import { formatDuration } from "./training-format";

interface LongitudinalComparisonPanelProps {
  availableRange: LongitudinalDateRange;
  initialRange: LongitudinalDateRange;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  onError: (code: string | undefined) => void;
}

export function LongitudinalComparisonPanel({
  availableRange,
  initialRange,
  locale,
  messages,
  onError,
}: LongitudinalComparisonPanelProps) {
  const [baselineRange, setBaselineRange] = useState(initialRange);
  const [comparisonRange, setComparisonRange] = useState(initialRange);
  const [comparison, setComparison] = useState<LongitudinalComparison>();
  const [loading, setLoading] = useState(false);
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const signedNumber = useMemo(
    () => new Intl.NumberFormat(locale, { signDisplay: "exceptZero" }),
    [locale],
  );
  const date = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }),
    [locale],
  );
  const copy = messages.longitudinal.comparison;

  function updateBaseline(field: keyof LongitudinalDateRange, value: string) {
    setBaselineRange((current) => ({ ...current, [field]: value }));
  }

  function updateComparison(field: keyof LongitudinalDateRange, value: string) {
    setComparisonRange((current) => ({ ...current, [field]: value }));
  }

  async function runComparison(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !recoveryRangeIsValid(baselineRange, availableRange)
      || !recoveryRangeIsValid(comparisonRange, availableRange)
    ) {
      onError("invalid-longitudinal-comparison");
      return;
    }
    setLoading(true);
    onError(undefined);
    try {
      const result = await invoke<LongitudinalComparison>("query_longitudinal_comparison", {
        baselineRange,
        comparisonRange,
      });
      setComparison(result);
    } catch (reason) {
      const code = commandErrorCode(reason);
      onError(code === "invalid-longitudinal-range" ? "invalid-longitudinal-comparison" : code);
    } finally {
      setLoading(false);
    }
  }

  function rangeLabel(range: LongitudinalDateRange | null): string {
    if (!range) return messages.unavailable;
    return `${date.format(recoveryLocalDate(range.from))} ${messages.longitudinal.rangeSeparator} ${date.format(recoveryLocalDate(range.through))}`;
  }

  function exact(value: string | null, signed = false): string {
    if (value === null) return messages.unavailable;
    return (signed ? signedNumber : number).format(BigInt(value));
  }

  function rows(series: LongitudinalSeriesComparison) {
    return [
      [
        copy.totalSteps,
        exact(series.activity.baseline.totalStepCount),
        exact(series.activity.comparison.totalStepCount),
        exact(series.activity.totalStepChange, true),
      ],
      [
        copy.trainingDuration,
        formatDuration(series.training.baseline.totalDurationMilliseconds, locale, messages.training.durationUnits),
        formatDuration(series.training.comparison.totalDurationMilliseconds, locale, messages.training.durationUnits),
        formatDuration(series.training.durationMillisecondsChange, locale, messages.training.durationUnits, true),
      ],
      [
        copy.averageSleep,
        formatSleepDuration(series.sleep.baseline.averageAsleepMilliseconds, locale, messages.training.durationUnits, messages.unavailable),
        formatSleepDuration(series.sleep.comparison.averageAsleepMilliseconds, locale, messages.training.durationUnits, messages.unavailable),
        formatSleepDuration(series.sleep.averageAsleepMillisecondsChange, locale, messages.training.durationUnits, messages.unavailable, true),
      ],
      [
        copy.averageRecovery,
        formatRecoveryMilliseconds(series.recovery.baseline.averageBeatToBeatIntervalMilliseconds, locale, messages.unavailable),
        formatRecoveryMilliseconds(series.recovery.comparison.averageBeatToBeatIntervalMilliseconds, locale, messages.unavailable),
        formatRecoveryMilliseconds(series.recovery.averageBeatToBeatIntervalMillisecondsChange, locale, messages.unavailable, true),
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
    <div className="longitudinal-comparison">
      <div>
        <h3 id="longitudinal-comparison-form-heading">{copy.heading}</h3>
        <p>{copy.intro}</p>
      </div>
      <form
        aria-labelledby="longitudinal-comparison-form-heading"
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
              onChange={(event) => update(event.target.value)}
              disabled={loading}
              required
            />
          </label>
        ))}
        <button type="submit" disabled={loading}>
          {loading ? copy.comparing : copy.compare}
        </button>
      </form>

      {comparison && (
        <section
          className="longitudinal-comparison-result"
          aria-labelledby="longitudinal-comparison-heading"
        >
          <div className="longitudinal-comparison-result-heading">
            <div>
              <h4 id="longitudinal-comparison-heading">{copy.resultHeading}</h4>
              <p>{copy.coverageCaution}</p>
            </div>
            <button type="button" className="secondary" onClick={() => setComparison(undefined)}>
              {copy.clear}
            </button>
          </div>
          {comparison.series.length === 0 ? <p>{copy.empty}</p> : comparison.series.map((series, index) => (
            <section className="longitudinal-comparison-series" key={series.seriesRef}>
              {comparison.series.length > 1 && (
                <h5>{messages.longitudinal.series} {number.format(index + 1)}</h5>
              )}
              <div className="longitudinal-table-scroll" tabIndex={0} aria-label={copy.resultHeading}>
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
                    {rows(series).map(([metric, baseline, current, change]) => (
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
          ))}
        </section>
      )}
    </div>
  );
}
