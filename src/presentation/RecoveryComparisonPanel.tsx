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
  const [loadFailed, setLoadFailed] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(true);
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
    setLoadFailed(false);
    setBaselineRange((current) => ({ ...current, [field]: value }));
  }

  function updateComparison(field: keyof RecoveryDateRange, value: string) {
    validation.edit();
    setLoadFailed(false);
    setComparisonRange((current) => ({ ...current, [field]: value }));
  }

  function intervalConclusion(series: RecoveryComparison["series"][number]): string {
    if (series.baseline.observedNights === 0 && series.comparison.observedNights === 0) {
      return copy.answerNoNights;
    }
    if (series.averageBeatToBeatIntervalMillisecondsChange === null) {
      return copy.answerUnavailable;
    }
    const change = BigInt(series.averageBeatToBeatIntervalMillisecondsChange);
    if (change === 0n) return copy.answerUnchanged;
    const absolute = change < 0n ? -change : change;
    const value = formatRecoveryMilliseconds(
      absolute.toString(),
      locale,
      messages.unavailable,
    );
    return (change > 0n ? copy.answerHigher : copy.answerLower).replace("{value}", value);
  }

  function observedEvidence(series: RecoveryComparison["series"][number]): string {
    const count = (value: number) => copy.recordedNights[value === 1 ? "one" : "other"]
      .replace("{count}", number.format(value));
    return copy.observedEvidence
      .replace("{baseline}", count(series.baseline.observedNights))
      .replace("{comparison}", count(series.comparison.observedNights));
  }

  function missingEvidence(series: RecoveryComparison["series"][number]): string {
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
      const result = await invoke<RecoveryComparison>("query_recovery_comparison", {
        baselineRange,
        comparisonRange,
      });
      setComparison(result);
      setControlsOpen(false);
      requestResultFocus(initiatingElement);
    } catch (reason) {
      const code = commandErrorCode(reason);
      if (code === "invalid-recovery-range") {
        validation.reject("invalid-recovery-comparison");
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
      !recoveryRangeIsValid(baselineRange, availableRange)
      || !recoveryRangeIsValid(comparisonRange, availableRange)
    ) {
      validation.reject("invalid-recovery-comparison");
      return;
    }
    validation.accept();
    const initiatingElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    await loadComparison(initiatingElement);
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
          className="recovery-comparison-result answer-canvas"
          aria-label={copy.answerLabel}
        >
          <div className="recovery-comparison-result-heading">
            <div>
              <h3 ref={resultHeadingRef} id="recovery-comparison-heading" tabIndex={-1}>
                {comparison.series.length === 0
                  ? copy.empty
                  : comparison.series.length === 1
                    ? intervalConclusion(comparison.series[0])
                    : copy.answerMultiple.replace(
                      "{count}",
                      number.format(comparison.series.length),
                    )}
              </h3>
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
                  <div className="answer-series-heading">
                    <p>{messages.recovery.series} {number.format(index + 1)}</p>
                    <h4>{intervalConclusion(series)}</h4>
                  </div>
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
                <p className="answer-evidence">{observedEvidence(series)}</p>
                <p className="answer-coverage">{missingEvidence(series)}</p>
                <details className="answer-exact-values">
                  <summary>{copy.exactValues}</summary>
                  <p>{copy.coverageCaution}</p>
                  <div className="recovery-table-scroll" tabIndex={0}>
                    <table aria-label={copy.resultHeading}>
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
          <h2 id="recovery-comparison-form-heading">{copy.heading}</h2>
          <p>{copy.intro}</p>
        </div>
        <form
          className="recovery-comparison-form"
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
      </details>
    </div>
  );
}
