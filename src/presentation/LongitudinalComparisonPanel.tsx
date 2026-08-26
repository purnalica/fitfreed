import { type FormEvent, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import { ComparisonPeriodPresets } from "./ComparisonPeriodPresets";
import {
  initialComparisonRanges,
  type ComparisonPeriodSelection,
} from "./comparison-period-preset";
import { ProgressSubmitButton } from "./ProgressSubmitButton";
import { submissionOrigin } from "./submission-origin";
import { useInvalidForm } from "./useInvalidForm";
import { useResultFocus } from "./useResultFocus";
import type {
  LongitudinalComparison,
  LongitudinalDateRange,
  LongitudinalSeriesComparison,
} from "./longitudinal-insights";
import {
  formatRecoveryMilliseconds,
  recoveryBarWidth,
  recoveryLocalDate,
  recoveryRangeIsValid,
} from "./recovery-format";
import { formatSleepDuration } from "./sleep-format";
import { formatSummaryDuration } from "./presentation-format";

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
  const initialPeriods = initialComparisonRanges(availableRange, initialRange);
  const [baselineRange, setBaselineRange] = useState(initialPeriods.baseline);
  const [comparisonRange, setComparisonRange] = useState(initialPeriods.comparison);
  const [comparison, setComparison] = useState<LongitudinalComparison>();
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
  const copy = messages.longitudinal.comparison;

  function updateBaseline(field: keyof LongitudinalDateRange, value: string) {
    validation.edit();
    setLoadFailed(false);
    setBaselineRange((current) => ({ ...current, [field]: value }));
  }

  function updateComparison(field: keyof LongitudinalDateRange, value: string) {
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

  async function loadComparison(initiatingElement: HTMLElement | null) {
    validation.accept();
    setLoading(true);
    setLoadFailed(false);
    onError(undefined);
    try {
      const result = await invoke<LongitudinalComparison>("query_longitudinal_comparison", {
        baselineRange,
        comparisonRange,
      });
      setComparison(result);
      setControlsOpen(false);
      requestResultFocus(initiatingElement);
    } catch (reason) {
      const code = commandErrorCode(reason);
      if (code === "invalid-longitudinal-range") {
        validation.reject("invalid-longitudinal-comparison");
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
      validation.reject("invalid-longitudinal-comparison");
      return;
    }
    const initiatingElement = submissionOrigin(event.nativeEvent);
    await loadComparison(initiatingElement);
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
        formatSummaryDuration(series.training.baseline.totalDurationMilliseconds, locale, messages.training.durationUnits),
        formatSummaryDuration(series.training.comparison.totalDurationMilliseconds, locale, messages.training.durationUnits),
        formatSummaryDuration(series.training.durationMillisecondsChange, locale, messages.training.durationUnits, true),
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
      {loading && !comparison && (
        <p className="answer-loading" role="status" aria-live="polite">
          {copy.comparing}
        </p>
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
          className="longitudinal-comparison-result answer-canvas"
          aria-label={copy.answerLabel}
        >
          <div className="longitudinal-comparison-result-heading">
            <div>
              <h2 ref={resultHeadingRef} id="longitudinal-comparison-heading" tabIndex={-1}>
                {comparison.series.length === 0
                  ? copy.empty
                  : comparison.series.length === 1
                    ? copy.answerSingle
                    : copy.answerMultiple.replace(
                      "{count}",
                      number.format(comparison.series.length),
                    )}
              </h2>
              <p>
                {rangeLabel(comparison.baselineRange)} ·{" "}
                {rangeLabel(comparison.comparisonRange)}
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
          <p className="notice longitudinal-comparison-caution">
            {copy.coverageCaution} {messages.longitudinal.associationNotice}
          </p>
          {comparison.series.map((series, index) => {
            const metrics = [
              {
                label: copy.totalSteps,
                baseline: series.activity.baseline.totalStepCount,
                current: series.activity.comparison.totalStepCount,
                format: (value: string | null) => exact(value),
              },
              {
                label: copy.trainingDuration,
                baseline: series.training.baseline.totalDurationMilliseconds,
                current: series.training.comparison.totalDurationMilliseconds,
                format: (value: string | null) => value === null
                  ? messages.unavailable
                  : formatSummaryDuration(value, locale, messages.training.durationUnits),
              },
              {
                label: copy.averageSleep,
                baseline: series.sleep.baseline.averageAsleepMilliseconds,
                current: series.sleep.comparison.averageAsleepMilliseconds,
                format: (value: string | null) => formatSleepDuration(
                  value,
                  locale,
                  messages.training.durationUnits,
                  messages.unavailable,
                ),
              },
              {
                label: copy.averageRecovery,
                baseline: series.recovery.baseline.averageBeatToBeatIntervalMilliseconds,
                current: series.recovery.comparison.averageBeatToBeatIntervalMilliseconds,
                format: (value: string | null) => formatRecoveryMilliseconds(
                  value,
                  locale,
                  messages.unavailable,
                ),
              },
            ];
            const MetricHeading = comparison.series.length > 1 ? "h4" : "h3";
            return (
              <section className="longitudinal-comparison-series" key={series.seriesRef}>
                {comparison.series.length > 1 && (
                  <div className="answer-series-heading">
                    <p>{messages.longitudinal.series} {number.format(index + 1)}</p>
                    <h3>{copy.answerSingle}</h3>
                  </div>
                )}
                <figure className="longitudinal-comparison-visual">
                  <figcaption>{copy.visual}</figcaption>
                  <div className="longitudinal-comparison-metrics">
                    {metrics.map((metric) => {
                      const metricMaximum = maximumValue([
                        metric.baseline,
                        metric.current,
                      ]);
                      return (
                        <section key={metric.label}>
                          <MetricHeading>{metric.label}</MetricHeading>
                          <div className="comparison-bars">
                            {[
                              [copy.baseline, metric.baseline],
                              [copy.comparison, metric.current],
                            ].map(([label, value]) => (
                              <div key={label}>
                                <span>{label}</span>
                                <span className="track">
                                  <span
                                    className="bar"
                                    style={{ width: recoveryBarWidth(value, metricMaximum) }}
                                  />
                                </span>
                                <strong>{metric.format(value)}</strong>
                              </div>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </figure>
                <details className="answer-exact-values longitudinal-comparison-exact">
                  <summary>{copy.exactValues}</summary>
                  <div className="longitudinal-table-scroll" tabIndex={0}>
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
          <h2 id="longitudinal-comparison-form-heading">{copy.heading}</h2>
          <p>{copy.intro}</p>
        </div>
        <form
          aria-labelledby="longitudinal-comparison-form-heading"
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

function maximumValue(values: Array<string | null>): bigint {
  return values.reduce<bigint>((current, value) => {
    const candidate = value === null ? 0n : BigInt(value);
    return candidate > current ? candidate : current;
  }, 1n);
}
