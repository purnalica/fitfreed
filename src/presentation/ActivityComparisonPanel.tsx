import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { catalogs, type Locale } from "../locales/catalogs";
import type {
  ActivityComparison,
  ActivityDateRange,
  ActivitySeriesSummary,
} from "./activity-insights";
import { commandErrorCode } from "./command-error";
import { ComparisonPeriodPresets } from "./ComparisonPeriodPresets";
import {
  currentLocalDate,
  defaultComparisonPeriods,
  initialComparisonRanges,
  type ComparisonPeriodSelection,
} from "./comparison-period-preset";
import { ProgressSubmitButton } from "./ProgressSubmitButton";
import { submissionOrigin } from "./submission-origin";
import { useInvalidForm } from "./useInvalidForm";
import { useResultFocus } from "./useResultFocus";

interface ActivityComparisonPanelProps {
  availableRange: ActivityDateRange;
  initialRange: ActivityDateRange;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  onError: (code: string | undefined) => void;
  answerRequestId?: number;
}

function localDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function rangeIsValid(range: ActivityDateRange, available: ActivityDateRange): boolean {
  if (!range.from || !range.through || range.from > range.through) return false;
  if (range.from < available.from || range.through > available.through) return false;
  const inclusiveDays = Math.floor(
    (localDate(range.through).getTime() - localDate(range.from).getTime()) / 86_400_000,
  ) + 1;
  return inclusiveDays <= 366;
}

export function ActivityComparisonPanel({
  availableRange,
  initialRange,
  locale,
  messages,
  onError,
  answerRequestId,
}: ActivityComparisonPanelProps) {
  const initialPeriods = initialComparisonRanges(availableRange, initialRange);
  const [baselineRange, setBaselineRange] = useState(initialPeriods.baseline);
  const [comparisonRange, setComparisonRange] = useState(initialPeriods.comparison);
  const [comparison, setComparison] = useState<ActivityComparison>();
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [insufficientHistory, setInsufficientHistory] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(answerRequestId === undefined);
  const handledAnswerRequestId = useRef<number | undefined>(undefined);
  const validation = useInvalidForm(onError);
  const { resultHeadingRef, requestResultFocus } = useResultFocus<HTMLHeadingElement>(
    comparison !== undefined,
  );
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const signedNumber = useMemo(
    () => new Intl.NumberFormat(locale, { signDisplay: "always" }),
    [locale],
  );
  const plural = useMemo(() => new Intl.PluralRules(locale), [locale]);
  const date = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }),
    [locale],
  );

  async function loadComparison(
    baseline: ActivityDateRange,
    current: ActivityDateRange,
    initiatingElement: HTMLElement | null,
  ) {
    setLoading(true);
    setLoadFailed(false);
    onError(undefined);
    try {
      const result = await invoke<ActivityComparison>("query_activity_comparison", {
        baselineRange: baseline,
        comparisonRange: current,
      });
      setComparison(result);
      requestResultFocus(initiatingElement);
    } catch (reason) {
      const code = commandErrorCode(reason);
      if (code === "invalid-activity-range") {
        validation.reject("invalid-activity-comparison");
      } else {
        setLoadFailed(true);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (
      answerRequestId === undefined
      || handledAnswerRequestId.current === answerRequestId
    ) return;
    handledAnswerRequestId.current = answerRequestId;
    const periods = defaultComparisonPeriods(availableRange, currentLocalDate());
    if (!periods) {
      setInsufficientHistory(true);
      setControlsOpen(true);
      return;
    }
    setInsufficientHistory(false);
    setBaselineRange(periods.baseline);
    setComparisonRange(periods.comparison);
    setControlsOpen(false);
    const initiatingElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    void loadComparison(periods.baseline, periods.comparison, initiatingElement);
  }, [answerRequestId, availableRange.from, availableRange.through]);

  async function runComparison(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !rangeIsValid(baselineRange, availableRange) ||
      !rangeIsValid(comparisonRange, availableRange)
    ) {
      validation.reject("invalid-activity-comparison");
      return;
    }
    validation.accept();
    const initiatingElement = submissionOrigin(event.nativeEvent);
    await loadComparison(baselineRange, comparisonRange, initiatingElement);
  }

  function updateBaseline(field: keyof ActivityDateRange, value: string) {
    validation.edit();
    setBaselineRange((current) => ({ ...current, [field]: value }));
  }

  function updateComparison(field: keyof ActivityDateRange, value: string) {
    validation.edit();
    setComparisonRange((current) => ({ ...current, [field]: value }));
  }

  function applyPreset(selection: ComparisonPeriodSelection) {
    validation.edit();
    setLoadFailed(false);
    setInsufficientHistory(false);
    setBaselineRange(selection.baseline);
    setComparisonRange(selection.comparison);
  }

  function formatCount(value: string | null): string {
    return value === null ? messages.unavailable : number.format(BigInt(value));
  }

  function formatChange(value: string | null): string {
    if (value === null) return messages.unavailable;
    const exact = BigInt(value);
    return exact === 0n ? number.format(exact) : signedNumber.format(exact);
  }

  function formatIntegerChange(from: number, through: number): string {
    const change = through - from;
    return change === 0 ? number.format(change) : signedNumber.format(change);
  }

  function rangeLabel(range: ActivityDateRange | null): string {
    if (!range) return messages.unavailable;
    return `${date.format(localDate(range.from))} ${messages.activity.rangeSeparator} ${date.format(localDate(range.through))}`;
  }

  function comparisonBarWidth(value: string | null, maximum: bigint): string {
    if (value === null || maximum === 0n) return "0%";
    const basisPoints = (BigInt(value) * 10_000n) / maximum;
    return `${Number(basisPoints) / 100}%`;
  }

  function conclusion(series: ActivityComparison["series"][number]): string {
    if (series.averageStepChange === null) return copy.answerUnavailable;
    const change = BigInt(series.averageStepChange);
    if (change === 0n) return copy.answerUnchanged;
    const value = number.format(change < 0n ? -change : change);
    return (change > 0n ? copy.answerHigher : copy.answerLower).replace("{value}", value);
  }

  function coverageStatement(series: ActivityComparison["series"][number]): string {
    const baseline = series.baseline.availableStepDays;
    const current = series.comparison.availableStepDays;
    if (baseline === current) {
      return copy.coverageEqual[plural.select(baseline) === "one" ? "one" : "other"]
        .replace("{count}", number.format(baseline));
    }
    return copy.coverageDifferent
      .replace("{baseline}", number.format(baseline))
      .replace("{baselineUnit}", copy.coverageDay[plural.select(baseline) === "one" ? "one" : "other"])
      .replace("{comparison}", number.format(current))
      .replace("{comparisonUnit}", copy.coverageDay[plural.select(current) === "one" ? "one" : "other"]);
  }

  function summaryRows(
    baseline: ActivitySeriesSummary,
    current: ActivitySeriesSummary,
    totalStepChange: string | null,
    averageStepChange: string | null,
  ) {
    return [
      [
        messages.activity.totalSteps,
        formatCount(baseline.totalStepCount),
        formatCount(current.totalStepCount),
        formatChange(totalStepChange),
      ],
      [
        messages.activity.averageSteps,
        formatCount(baseline.averageStepCount),
        formatCount(current.averageStepCount),
        formatChange(averageStepChange),
      ],
      [
        messages.activity.availableDays,
        number.format(baseline.availableStepDays),
        number.format(current.availableStepDays),
        formatIntegerChange(baseline.availableStepDays, current.availableStepDays),
      ],
      [
        messages.activity.unavailableDays,
        number.format(baseline.unavailableStepDays),
        number.format(current.unavailableStepDays),
        formatIntegerChange(baseline.unavailableStepDays, current.unavailableStepDays),
      ],
      [
        messages.activity.missingDays,
        number.format(baseline.missingDays),
        number.format(current.missingDays),
        formatIntegerChange(baseline.missingDays, current.missingDays),
      ],
    ];
  }

  const copy = messages.activity.comparison;
  const rangeInputs = [
    {
      label: copy.baselineFrom,
      value: baselineRange.from,
      update: (value: string) => updateBaseline("from", value),
    },
    {
      label: copy.baselineThrough,
      value: baselineRange.through,
      update: (value: string) => updateBaseline("through", value),
    },
    {
      label: copy.comparisonFrom,
      value: comparisonRange.from,
      update: (value: string) => updateComparison("from", value),
    },
    {
      label: copy.comparisonThrough,
      value: comparisonRange.through,
      update: (value: string) => updateComparison("through", value),
    },
  ];

  return (
    <div className="activity-comparison">
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
            onClick={(event) => void loadComparison(
              baselineRange,
              comparisonRange,
              event.currentTarget,
            )}
          >
            {copy.retry}
          </button>
        </section>
      )}
      {insufficientHistory && (
        <section className="answer-insufficient" aria-label={copy.insufficientLabel}>
          <h2>{copy.insufficientHeading}</h2>
          <p>{copy.insufficientBody}</p>
        </section>
      )}
      {comparison && (
        <section
          className="activity-comparison-result answer-canvas"
          aria-label={copy.answerLabel}
        >
          <div className="activity-comparison-result-heading">
            <div>
              <h2 ref={resultHeadingRef} id="activity-comparison-heading" tabIndex={-1}>
                {comparison.series.length === 1
                  ? conclusion(comparison.series[0])
                  : copy.answerMultiple.replace(
                    "{count}",
                    number.format(comparison.series.length),
                  )}
              </h2>
              <p>{rangeLabel(comparison.baselineRange)} · {rangeLabel(comparison.comparisonRange)}</p>
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
            const totals = [series.baseline.totalStepCount, series.comparison.totalStepCount]
              .filter((value): value is string => value !== null)
              .map(BigInt);
            const maximum = totals.reduce((current, value) => value > current ? value : current, 0n);
            const rows = summaryRows(
              series.baseline,
              series.comparison,
              series.totalStepChange,
              series.averageStepChange,
            );
            return (
              <section className="activity-comparison-series" key={series.seriesRef}>
                {comparison.series.length > 1 && (
                  <div className="answer-series-heading">
                    <p>{messages.activity.series} {number.format(index + 1)}</p>
                    <h3>{conclusion(series)}</h3>
                  </div>
                )}
                <div className="comparison-bars" aria-hidden="true">
                  {[
                    [copy.baseline, series.baseline.totalStepCount],
                    [copy.comparison, series.comparison.totalStepCount],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <span className="track">
                        {value !== null && (
                          <span
                            className="bar"
                            style={{ width: comparisonBarWidth(value, maximum) }}
                          />
                        )}
                      </span>
                      <strong>{formatCount(value)}</strong>
                    </div>
                  ))}
                </div>
                <p className="answer-evidence">{coverageStatement(series)}</p>
                <details className="answer-exact-values">
                  <summary>{copy.exactValues}</summary>
                  <p>{copy.coverageCaution}</p>
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
                      {rows.map(([metric, baseline, current, change]) => (
                        <tr key={metric}>
                          <th scope="row">{metric}</th>
                          <td>{baseline}</td>
                          <td>{current}</td>
                          <td>{change}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
          <h2 id="activity-comparison-form-heading">{copy.heading}</h2>
          <p>{copy.intro}</p>
        </div>
        <form
          className="activity-comparison-form"
          aria-labelledby="activity-comparison-form-heading"
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
          {rangeInputs.map(({ label, value, update }) => (
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
