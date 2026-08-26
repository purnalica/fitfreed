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
import {
  integerCountFormatter,
  mediumDateFormatter,
  signedIntegerCountFormatter,
} from "./presentation-format";

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
  const initialPeriods = initialComparisonRanges(availableRange, initialRange);
  const [baselineRange, setBaselineRange] = useState(initialPeriods.baseline);
  const [comparisonRange, setComparisonRange] = useState(initialPeriods.comparison);
  const [comparison, setComparison] = useState<RecoveryComparison>();
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(true);
  const validation = useInvalidForm(onError);
  const { resultHeadingRef, requestResultFocus } = useResultFocus<HTMLHeadingElement>(
    comparison !== undefined,
  );
  const number = useMemo(() => integerCountFormatter(locale), [locale]);
  const signedNumber = useMemo(
    () => signedIntegerCountFormatter(locale),
    [locale],
  );
  const date = useMemo(
    () => mediumDateFormatter(locale),
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

  function applyPreset(selection: ComparisonPeriodSelection) {
    validation.edit();
    setLoadFailed(false);
    setBaselineRange(selection.baseline);
    setComparisonRange(selection.comparison);
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
    const initiatingElement = submissionOrigin(event.nativeEvent);
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
              <h2 ref={resultHeadingRef} id="recovery-comparison-heading" tabIndex={-1}>
                {comparison.series.length === 0
                  ? copy.empty
                  : comparison.series.length === 1
                    ? intervalConclusion(comparison.series[0])
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
                    <h3>{intervalConclusion(series)}</h3>
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
                  <DataTable
                    accessibleName={copy.resultHeading}
                    scrollAccessibleName={`${copy.exactValues} · ${messages.recovery.series} ${number.format(index + 1)}`}
                    scrollClassName="recovery-table-scroll"
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
                        {rows(series.baseline, series.comparison, series).map(
                          ([metric, baseline, current, change]) => (
                            <tr key={metric}>
                              <th scope="row">{metric}</th>
                              <NumericTableCell>{baseline}</NumericTableCell>
                              <NumericTableCell>{current}</NumericTableCell>
                              <NumericTableCell>{change}</NumericTableCell>
                            </tr>
                          ),
                        )}
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
          <h2 id="recovery-comparison-form-heading">{copy.heading}</h2>
          <p>{copy.intro}</p>
        </div>
        <form
          className="recovery-comparison-form"
          aria-labelledby="recovery-comparison-form-heading"
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
