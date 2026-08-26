import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { restoreFocusAfterReveal } from "./focus-restoration";
import {
  formatSummaryDuration,
  integerCountFormatter,
  mediumDateFormatter,
  signedIntegerCountFormatter,
} from "./presentation-format";
import { formatDistance, formatExactMetric } from "./training-format";
import type {
  TrainingComparison,
  TrainingDateRange,
  TrainingSeriesSummary,
} from "./training-insights";
import type { ReportTrainingComparisonQuery } from "./session-report";
import { submissionOrigin } from "./submission-origin";
import { useInvalidForm } from "./useInvalidForm";
import { useResultFocus } from "./useResultFocus";

interface TrainingComparisonPanelProps {
  availableRange: TrainingDateRange;
  initialRange: TrainingDateRange;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  initialQuery?: ReportTrainingComparisonQuery;
  navigationRequestId?: number;
  createReportFocusRequestId?: number;
  onCreateReport: (query: ReportTrainingComparisonQuery) => void;
  onError: (code: string | undefined) => void;
}

function localDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function rangeShapeIsValid(range: TrainingDateRange): boolean {
  if (!range.from || !range.through || range.from > range.through) return false;
  const inclusiveDays = Math.floor(
    (localDate(range.through).getTime() - localDate(range.from).getTime()) / 86_400_000,
  ) + 1;
  return inclusiveDays <= 366;
}

function rangeIsValid(range: TrainingDateRange, available: TrainingDateRange): boolean {
  return rangeShapeIsValid(range)
    && range.from >= available.from
    && range.through <= available.through;
}

export function TrainingComparisonPanel({
  availableRange,
  initialRange,
  locale,
  messages,
  initialQuery,
  navigationRequestId,
  createReportFocusRequestId,
  onCreateReport,
  onError,
}: TrainingComparisonPanelProps) {
  const initialPeriods = initialQuery
    ? {
        baseline: initialQuery.baselineRange,
        comparison: initialQuery.comparisonRange,
      }
    : initialComparisonRanges(availableRange, initialRange);
  const [baselineRange, setBaselineRange] = useState(initialPeriods.baseline);
  const [comparisonRange, setComparisonRange] = useState(initialPeriods.comparison);
  const [comparison, setComparison] = useState<TrainingComparison>();
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(initialQuery === undefined);
  const validation = useInvalidForm(onError);
  const { resultHeadingRef, requestResultFocus } = useResultFocus<HTMLHeadingElement>(
    comparison !== undefined,
  );
  const createReportButtonRef = useRef<HTMLButtonElement>(null);
  const handledCreateReportFocusRequest = useRef<number | undefined>(undefined);
  const number = useMemo(() => integerCountFormatter(locale), [locale]);
  const signedNumber = useMemo(
    () => signedIntegerCountFormatter(locale),
    [locale],
  );
  const date = useMemo(
    () => mediumDateFormatter(locale),
    [locale],
  );
  const selectableRange = useMemo(() => ({
    from: [
      availableRange.from,
      initialQuery?.baselineRange.from,
      initialQuery?.comparisonRange.from,
    ].filter((value): value is string => value !== undefined).sort()[0],
    through: [
      availableRange.through,
      initialQuery?.baselineRange.through,
      initialQuery?.comparisonRange.through,
    ].filter((value): value is string => value !== undefined).sort().at(-1) as string,
  }), [
    availableRange.from,
    availableRange.through,
    initialQuery?.baselineRange.from,
    initialQuery?.baselineRange.through,
    initialQuery?.comparisonRange.from,
    initialQuery?.comparisonRange.through,
  ]);
  const copy = messages.training.comparison;

  async function loadComparison(
    baseline: TrainingDateRange,
    current: TrainingDateRange,
    initiatingElement: HTMLElement | null,
  ) {
    validation.accept();
    setLoading(true);
    setLoadFailed(false);
    onError(undefined);
    try {
      const result = await invoke<TrainingComparison>("query_training_comparison", {
        baselineRange: baseline,
        comparisonRange: current,
      });
      setComparison(result);
      setControlsOpen(false);
      requestResultFocus(initiatingElement);
    } catch (reason) {
      const code = commandErrorCode(reason);
      if (code === "invalid-training-range") {
        validation.reject("invalid-training-comparison");
        setControlsOpen(true);
      } else {
        setLoadFailed(true);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!initialQuery || navigationRequestId === undefined) return;
    const baseline = initialQuery.baselineRange;
    const compared = initialQuery.comparisonRange;
    setBaselineRange(baseline);
    setComparisonRange(compared);
    setLoadFailed(false);
    if (!rangeShapeIsValid(baseline) || !rangeShapeIsValid(compared)) {
      setComparison(undefined);
      setControlsOpen(true);
      validation.reject("invalid-training-comparison");
      return;
    }
    let active = true;
    const initiatingElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    validation.accept();
    setLoading(true);
    setLoadFailed(false);
    onError(undefined);
    void invoke<TrainingComparison>("query_training_comparison", {
      baselineRange: baseline,
      comparisonRange: compared,
    }).then((result) => {
      if (!active) return;
      setComparison(result);
      setControlsOpen(false);
      requestResultFocus(initiatingElement);
    }).catch((reason) => {
      if (!active) return;
      const code = commandErrorCode(reason);
      if (code === "invalid-training-range") {
        validation.reject("invalid-training-comparison");
        setControlsOpen(true);
      } else {
        setLoadFailed(true);
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [
    availableRange,
    initialQuery?.baselineRange.from,
    initialQuery?.baselineRange.through,
    initialQuery?.comparisonRange.from,
    initialQuery?.comparisonRange.through,
    navigationRequestId,
    onError,
    requestResultFocus,
    validation.accept,
    validation.reject,
  ]);

  useEffect(() => {
    if (
      createReportFocusRequestId === undefined
      || handledCreateReportFocusRequest.current === createReportFocusRequestId
      || !comparison
    ) return;
    handledCreateReportFocusRequest.current = createReportFocusRequestId;
    return restoreFocusAfterReveal(createReportButtonRef.current, null, {
      forceInitialFocus: true,
    });
  }, [comparison, createReportFocusRequestId]);

  async function runComparison(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !rangeIsValid(baselineRange, selectableRange)
      || !rangeIsValid(comparisonRange, selectableRange)
    ) {
      validation.reject("invalid-training-comparison");
      return;
    }
    const initiatingElement = submissionOrigin(event.nativeEvent);
    await loadComparison(baselineRange, comparisonRange, initiatingElement);
  }

  function updateBaseline(field: keyof TrainingDateRange, value: string) {
    validation.edit();
    setLoadFailed(false);
    setBaselineRange((current) => ({ ...current, [field]: value }));
  }

  function updateComparison(field: keyof TrainingDateRange, value: string) {
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

  function rangeLabel(range: TrainingDateRange | null): string {
    if (!range) return messages.unavailable;
    return `${date.format(localDate(range.from))} ${messages.training.rangeSeparator} ${date.format(localDate(range.through))}`;
  }

  function durationBarWidth(value: string, maximum: bigint): string {
    if (maximum === 0n) return "0%";
    const basisPoints = (BigInt(value) * 10_000n) / maximum;
    return `${Number(basisPoints) / 100}%`;
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
    if (hours > 0n) parts.push(`${number.format(hours)} ${messages.training.durationUnits.hours}`);
    if (minutes > 0n) {
      parts.push(`${number.format(minutes)} ${messages.training.durationUnits.minutes}`);
    }
    return parts.join(" ");
  }

  function durationConclusion(series: TrainingComparison["series"][number]): string {
    const change = BigInt(series.durationMillisecondsChange);
    if (series.baseline.sessionCount === 0 && series.comparison.sessionCount === 0) {
      return copy.answerNoSessions;
    }
    if (change === 0n) return copy.answerUnchanged;
    const value = humanDuration((change < 0n ? -change : change).toString());
    return (change > 0n ? copy.answerHigher : copy.answerLower).replace("{value}", value);
  }

  function sessionEvidence(series: TrainingComparison["series"][number]): string {
    const count = (value: number) => copy.sessionCount[value === 1 ? "one" : "other"]
      .replace("{count}", number.format(value));
    return copy.sessionEvidence
      .replace("{baseline}", count(series.baseline.sessionCount))
      .replace("{comparison}", count(series.comparison.sessionCount));
  }

  function coverageEvidence(series: TrainingComparison["series"][number]): string {
    const summaries = [series.baseline, series.comparison];
    const sessions = summaries.reduce((total, summary) => total + summary.sessionCount, 0);
    const distance = summaries.reduce(
      (total, summary) => total + summary.distanceSessionCount,
      0,
    );
    const energy = summaries.reduce(
      (total, summary) => total + summary.energySessionCount,
      0,
    );
    if (distance === 0 && energy === 0) return copy.coverageNone;
    if (distance === sessions && energy === sessions) return copy.coverageComplete;
    return copy.coveragePartial;
  }

  function summaryRows(
    baseline: TrainingSeriesSummary,
    current: TrainingSeriesSummary,
    changes: {
      sessionCount: string;
      trainingDays: string;
      duration: string;
      distance: number | null;
      energy: string | null;
    },
  ) {
    return [
      [
        messages.training.sessionCount,
        number.format(baseline.sessionCount),
        number.format(current.sessionCount),
        signedNumber.format(BigInt(changes.sessionCount)),
      ],
      [
        messages.training.trainingDays,
        number.format(baseline.trainingDays),
        number.format(current.trainingDays),
        signedNumber.format(BigInt(changes.trainingDays)),
      ],
      [
        messages.training.totalDuration,
        formatSummaryDuration(
          baseline.totalDurationMilliseconds,
          locale,
          messages.training.durationUnits,
        ),
        formatSummaryDuration(
          current.totalDurationMilliseconds,
          locale,
          messages.training.durationUnits,
        ),
        formatSummaryDuration(changes.duration, locale, messages.training.durationUnits, true),
      ],
      [
        messages.training.totalDistance,
        formatDistance(
          baseline.totalDistanceMeters,
          locale,
          messages.unavailable,
          messages.training.units.meters,
        ),
        formatDistance(
          current.totalDistanceMeters,
          locale,
          messages.unavailable,
          messages.training.units.meters,
        ),
        formatDistance(
          changes.distance,
          locale,
          messages.unavailable,
          messages.training.units.meters,
          true,
        ),
      ],
      [
        messages.training.totalEnergy,
        formatExactMetric(
          baseline.totalEnergyKilocalories,
          locale,
          messages.unavailable,
          messages.training.units.kilocalories,
        ),
        formatExactMetric(
          current.totalEnergyKilocalories,
          locale,
          messages.unavailable,
          messages.training.units.kilocalories,
        ),
        formatExactMetric(
          changes.energy,
          locale,
          messages.unavailable,
          messages.training.units.kilocalories,
          true,
        ),
      ],
      [
        messages.training.distanceCoverage,
        number.format(baseline.distanceSessionCount),
        number.format(current.distanceSessionCount),
        signedNumber.format(current.distanceSessionCount - baseline.distanceSessionCount),
      ],
      [
        messages.training.energyCoverage,
        number.format(baseline.energySessionCount),
        number.format(current.energySessionCount),
        signedNumber.format(current.energySessionCount - baseline.energySessionCount),
      ],
      [
        messages.training.heartRateCoverage,
        number.format(baseline.heartRateSessionCount),
        number.format(current.heartRateSessionCount),
        signedNumber.format(current.heartRateSessionCount - baseline.heartRateSessionCount),
      ],
    ];
  }

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
    <div className="training-comparison">
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
      {comparison && (
        <section
          className="training-comparison-result answer-canvas"
          aria-label={copy.answerLabel}
        >
          <div className="training-comparison-result-heading">
            <div>
              <h2
                id="training-comparison-heading"
                ref={resultHeadingRef}
                tabIndex={-1}
              >
                {comparison.series.length === 0
                  ? copy.answerEmpty
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
            <div className="answer-actions">
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
              {comparison.baselineRange && comparison.comparisonRange && (
                <button
                  type="button"
                  ref={createReportButtonRef}
                  onClick={() => onCreateReport({
                    question: "training-period-comparison",
                    questionVersion: 1,
                    baselineRange: comparison.baselineRange as TrainingDateRange,
                    comparisonRange: comparison.comparisonRange as TrainingDateRange,
                  })}
                >
                  {copy.createReport}
                </button>
              )}
            </div>
          </div>
          {comparison.series.map((series, index) => {
            const maximum = [
              BigInt(series.baseline.totalDurationMilliseconds),
              BigInt(series.comparison.totalDurationMilliseconds),
            ].reduce((current, value) => value > current ? value : current, 0n);
            const rows = summaryRows(series.baseline, series.comparison, {
              sessionCount: series.sessionCountChange,
              trainingDays: series.trainingDayChange,
              duration: series.durationMillisecondsChange,
              distance: series.distanceMetersChange,
              energy: series.energyKilocaloriesChange,
            });
            return (
              <section className="training-comparison-series" key={series.seriesRef}>
                {comparison.series.length > 1 && (
                  <div className="answer-series-heading">
                    <p>{messages.training.series} {number.format(index + 1)}</p>
                    <h3>{durationConclusion(series)}</h3>
                  </div>
                )}
                <div className="comparison-bars" aria-hidden="true">
                  {[
                    [copy.baseline, series.baseline.totalDurationMilliseconds],
                    [copy.comparison, series.comparison.totalDurationMilliseconds],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <span className="track">
                        <span className="bar" style={{ width: durationBarWidth(value, maximum) }} />
                      </span>
                      <strong>
                        {humanDuration(value)}
                      </strong>
                    </div>
                  ))}
                </div>
                <p className="answer-evidence">{sessionEvidence(series)}</p>
                <p className="answer-coverage">{coverageEvidence(series)}</p>
                <details className="answer-exact-values">
                  <summary>{copy.exactValues}</summary>
                  <p>{copy.coverageCaution}</p>
                  <DataTable
                    accessibleName={copy.resultHeading}
                    scrollAccessibleName={`${copy.exactValues} · ${messages.training.series} ${number.format(index + 1)}`}
                    scrollClassName="training-table-scroll"
                  >
                      <thead>
                        <tr>
                          <th scope="col">{copy.metric}</th>
                          <NumericTableHeader scope="col">
                            {copy.baseline}<span>{rangeLabel(comparison.baselineRange)}</span>
                          </NumericTableHeader>
                          <NumericTableHeader scope="col">
                            {copy.comparison}<span>{rangeLabel(comparison.comparisonRange)}</span>
                          </NumericTableHeader>
                          <NumericTableHeader scope="col">{copy.change}</NumericTableHeader>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(([metric, baseline, current, change]) => (
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
          <h2 id="training-comparison-form-heading">{copy.heading}</h2>
          <p>{copy.intro}</p>
        </div>
        <form
          className="training-comparison-form"
          aria-labelledby="training-comparison-form-heading"
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
                min={selectableRange.from}
                max={selectableRange.through}
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
