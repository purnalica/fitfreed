import { type FormEvent, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import { ProgressSubmitButton } from "./ProgressSubmitButton";
import { useInvalidForm } from "./useInvalidForm";
import { useResultFocus } from "./useResultFocus";
import {
  formatRecoveryMilliseconds,
  recoveryBarWidth,
  recoveryLocalDate,
  recoveryRangeIsValid,
} from "./recovery-format";
import type {
  RecoveryComparison,
  RecoveryDateRange,
  RecoverySeriesSummary,
} from "./recovery-insights";

interface RecoveryComparisonPanelProps {
  availableRange: RecoveryDateRange;
  initialRange: RecoveryDateRange;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  onError: (code: string | undefined) => void;
}

export function RecoveryComparisonPanel({
  availableRange,
  initialRange,
  locale,
  messages,
  onError,
}: RecoveryComparisonPanelProps) {
  const [baselineRange, setBaselineRange] = useState(initialRange);
  const [comparisonRange, setComparisonRange] = useState(initialRange);
  const [comparison, setComparison] = useState<RecoveryComparison>();
  const [loading, setLoading] = useState(false);
  const validation = useInvalidForm(onError);
  const { resultHeadingRef, requestResultFocus } = useResultFocus<HTMLHeadingElement>(
    comparison !== undefined,
  );
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const signedNumber = useMemo(
    () => new Intl.NumberFormat(locale, { signDisplay: "exceptZero" }),
    [locale],
  );
  const date = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }),
    [locale],
  );
  const copy = messages.recovery.comparison;

  function updateBaseline(field: keyof RecoveryDateRange, value: string) {
    validation.edit();
    setBaselineRange((current) => ({ ...current, [field]: value }));
  }

  function updateComparison(field: keyof RecoveryDateRange, value: string) {
    validation.edit();
    setComparisonRange((current) => ({ ...current, [field]: value }));
  }

  async function runComparison(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !recoveryRangeIsValid(baselineRange, availableRange)
      || !recoveryRangeIsValid(comparisonRange, availableRange)
    ) {
      validation.reject("invalid-recovery-comparison");
      return;
    }
    validation.accept();
    setLoading(true);
    onError(undefined);
    const initiatingElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    try {
      const result = await invoke<RecoveryComparison>("query_recovery_comparison", {
        baselineRange,
        comparisonRange,
      });
      setComparison(result);
      requestResultFocus(initiatingElement);
    } catch (reason) {
      const code = commandErrorCode(reason);
      if (code === "invalid-recovery-range") {
        validation.reject("invalid-recovery-comparison");
      } else {
        onError(code);
      }
    } finally {
      setLoading(false);
    }
  }

  function rangeLabel(range: RecoveryDateRange | null): string {
    if (!range) return messages.unavailable;
    return `${date.format(recoveryLocalDate(range.from))} ${messages.recovery.rangeSeparator} ${date.format(recoveryLocalDate(range.through))}`;
  }

  function rows(
    baseline: RecoverySeriesSummary,
    current: RecoverySeriesSummary,
    changes: RecoveryComparison["series"][number],
  ) {
    return [
      [
        messages.recovery.observedNights,
        number.format(baseline.observedNights),
        number.format(current.observedNights),
        signedNumber.format(BigInt(changes.observedNightChange)),
      ],
      [
        messages.recovery.missingNights,
        number.format(baseline.missingNights),
        number.format(current.missingNights),
        signedNumber.format(BigInt(changes.missingNightChange)),
      ],
      [
        messages.recovery.averageBeatToBeat,
        formatRecoveryMilliseconds(baseline.averageBeatToBeatIntervalMilliseconds, locale, messages.unavailable),
        formatRecoveryMilliseconds(current.averageBeatToBeatIntervalMilliseconds, locale, messages.unavailable),
        formatRecoveryMilliseconds(changes.averageBeatToBeatIntervalMillisecondsChange, locale, messages.unavailable, true),
      ],
      [
        messages.recovery.averageRmssd,
        formatRecoveryMilliseconds(baseline.averageHeartRateVariabilityRmssdMilliseconds, locale, messages.unavailable),
        formatRecoveryMilliseconds(current.averageHeartRateVariabilityRmssdMilliseconds, locale, messages.unavailable),
        formatRecoveryMilliseconds(changes.averageHeartRateVariabilityRmssdMillisecondsChange, locale, messages.unavailable, true),
      ],
      [
        messages.recovery.averageBreathing,
        formatRecoveryMilliseconds(baseline.averageBreathingIntervalMilliseconds, locale, messages.unavailable),
        formatRecoveryMilliseconds(current.averageBreathingIntervalMilliseconds, locale, messages.unavailable),
        formatRecoveryMilliseconds(changes.averageBreathingIntervalMillisecondsChange, locale, messages.unavailable, true),
      ],
      [
        messages.recovery.assessmentCoverage,
        number.format(baseline.assessmentNightCount),
        number.format(current.assessmentNightCount),
        signedNumber.format(BigInt(changes.assessmentNightChange)),
      ],
      [
        messages.recovery.baselineCoverage,
        number.format(baseline.baselineNightCount),
        number.format(current.baselineNightCount),
        signedNumber.format(BigInt(changes.baselineNightChange)),
      ],
      [
        messages.recovery.guidanceCoverage,
        number.format(baseline.guidanceNightCount),
        number.format(current.guidanceNightCount),
        signedNumber.format(BigInt(changes.guidanceNightChange)),
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
    <div className="recovery-comparison">
      <div>
        <h2 id="recovery-comparison-form-heading">{copy.heading}</h2>
        <p>{copy.intro}</p>
      </div>
      <form
        aria-labelledby="recovery-comparison-form-heading"
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
        <section
          className="recovery-comparison-result"
          aria-labelledby="recovery-comparison-heading"
        >
          <div className="recovery-comparison-result-heading">
            <div>
              <h3 ref={resultHeadingRef} id="recovery-comparison-heading" tabIndex={-1}>
                {copy.resultHeading}
              </h3>
              <p>{copy.coverageCaution}</p>
            </div>
            <button type="button" className="secondary" onClick={() => setComparison(undefined)}>
              {copy.clear}
            </button>
          </div>
          {comparison.series.length === 0 ? <p>{copy.empty}</p> : comparison.series.map((series, index) => {
            const intervals = [
              BigInt(series.baseline.averageBeatToBeatIntervalMilliseconds ?? "0"),
              BigInt(series.comparison.averageBeatToBeatIntervalMilliseconds ?? "0"),
            ];
            const maximum = intervals.reduce(
              (current, value) => value > current ? value : current,
              1n,
            );
            return (
              <section className="recovery-comparison-series" key={series.seriesRef}>
                {comparison.series.length > 1 && (
                  <h4>{messages.recovery.series} {number.format(index + 1)}</h4>
                )}
                <div className="comparison-bars" aria-hidden="true">
                  {[
                    [copy.baseline, series.baseline.averageBeatToBeatIntervalMilliseconds],
                    [copy.comparison, series.comparison.averageBeatToBeatIntervalMilliseconds],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <span className="track">
                        <span
                          className="bar recovery-bar"
                          style={{ width: recoveryBarWidth(value, maximum) }}
                        />
                      </span>
                      <strong>
                        {formatRecoveryMilliseconds(value, locale, messages.unavailable)}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="recovery-table-scroll" tabIndex={0} aria-label={copy.resultHeading}>
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
                      {rows(series.baseline, series.comparison, series).map(
                        ([metric, baseline, current, change]) => (
                          <tr key={metric}>
                            <th scope="row">{metric}</th>
                            <td>{baseline}</td>
                            <td>{current}</td>
                            <td>{change}</td>
                          </tr>
                        ),
                      )}
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
