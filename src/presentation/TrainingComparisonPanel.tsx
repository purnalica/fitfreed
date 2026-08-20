import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import { ProgressSubmitButton } from "./ProgressSubmitButton";
import { restoreFocusAfterReveal } from "./focus-restoration";
import { formatDistance, formatDuration, formatExactMetric } from "./training-format";
import type {
  TrainingComparison,
  TrainingDateRange,
  TrainingSeriesSummary,
} from "./training-insights";
import type { ReportTrainingComparisonQuery } from "./session-report";
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

function rangeIsValid(range: TrainingDateRange, available: TrainingDateRange): boolean {
  if (!range.from || !range.through || range.from > range.through) return false;
  if (range.from < available.from || range.through > available.through) return false;
  const inclusiveDays = Math.floor(
    (localDate(range.through).getTime() - localDate(range.from).getTime()) / 86_400_000,
  ) + 1;
  return inclusiveDays <= 366;
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
  const [baselineRange, setBaselineRange] = useState(initialRange);
  const [comparisonRange, setComparisonRange] = useState(initialRange);
  const [comparison, setComparison] = useState<TrainingComparison>();
  const [loading, setLoading] = useState(false);
  const validation = useInvalidForm(onError);
  const { resultHeadingRef, requestResultFocus } = useResultFocus<HTMLHeadingElement>(
    comparison !== undefined,
  );
  const createReportButtonRef = useRef<HTMLButtonElement>(null);
  const handledCreateReportFocusRequest = useRef<number | undefined>(undefined);
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const signedNumber = useMemo(
    () => new Intl.NumberFormat(locale, { signDisplay: "exceptZero" }),
    [locale],
  );
  const date = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }),
    [locale],
  );
  const copy = messages.training.comparison;

  useEffect(() => {
    if (!initialQuery || navigationRequestId === undefined) return;
    const baseline = initialQuery.baselineRange;
    const compared = initialQuery.comparisonRange;
    setBaselineRange(baseline);
    setComparisonRange(compared);
    if (!rangeIsValid(baseline, availableRange) || !rangeIsValid(compared, availableRange)) {
      setComparison(undefined);
      validation.reject("invalid-training-comparison");
      return;
    }
    let active = true;
    validation.accept();
    setLoading(true);
    onError(undefined);
    void invoke<TrainingComparison>("query_training_comparison", {
      baselineRange: baseline,
      comparisonRange: compared,
    }).then((result) => {
      if (!active) return;
      setComparison(result);
      requestResultFocus();
    }).catch((reason) => {
      if (!active) return;
      const code = commandErrorCode(reason);
      if (code === "invalid-training-range") {
        validation.reject("invalid-training-comparison");
      } else {
        onError(code);
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
    return restoreFocusAfterReveal(createReportButtonRef.current);
  }, [comparison, createReportFocusRequestId]);

  async function runComparison(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !rangeIsValid(baselineRange, availableRange)
      || !rangeIsValid(comparisonRange, availableRange)
    ) {
      validation.reject("invalid-training-comparison");
      return;
    }
    validation.accept();
    setLoading(true);
    onError(undefined);
    const initiatingElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    try {
      const result = await invoke<TrainingComparison>("query_training_comparison", {
        baselineRange,
        comparisonRange,
      });
      setComparison(result);
      requestResultFocus(initiatingElement);
    } catch (reason) {
      const code = commandErrorCode(reason);
      if (code === "invalid-training-range") {
        validation.reject("invalid-training-comparison");
      } else {
        onError(code);
      }
    } finally {
      setLoading(false);
    }
  }

  function updateBaseline(field: keyof TrainingDateRange, value: string) {
    validation.edit();
    setBaselineRange((current) => ({ ...current, [field]: value }));
  }

  function updateComparison(field: keyof TrainingDateRange, value: string) {
    validation.edit();
    setComparisonRange((current) => ({ ...current, [field]: value }));
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
        formatDuration(
          baseline.totalDurationMilliseconds,
          locale,
          messages.training.durationUnits,
        ),
        formatDuration(
          current.totalDurationMilliseconds,
          locale,
          messages.training.durationUnits,
        ),
        formatDuration(changes.duration, locale, messages.training.durationUnits, true),
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
      <div>
        <h2 id="training-comparison-form-heading">{copy.heading}</h2>
        <p>{copy.intro}</p>
      </div>
      <form
        aria-labelledby="training-comparison-form-heading"
        aria-busy={loading}
        onSubmit={(event) => void runComparison(event)}
      >
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

      {comparison && (
        <section
          className="training-comparison-result"
          aria-labelledby="training-comparison-heading"
        >
          <div className="training-comparison-result-heading">
            <div>
              <h3
                id="training-comparison-heading"
                ref={resultHeadingRef}
                tabIndex={-1}
              >
                {copy.resultHeading}
              </h3>
              <p>{copy.coverageCaution}</p>
            </div>
            <button type="button" className="secondary" onClick={() => setComparison(undefined)}>
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
                  <h4>{messages.training.series} {number.format(index + 1)}</h4>
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
                        {formatDuration(value, locale, messages.training.durationUnits)}
                      </strong>
                    </div>
                  ))}
                </div>
                <div
                  className="training-table-scroll"
                  tabIndex={0}
                  aria-label={copy.resultHeading}
                >
                  <table>
                    <caption className="sr-only">{copy.resultHeading}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{copy.metric}</th>
                        <th scope="col">
                          {copy.baseline}<span>{rangeLabel(comparison.baselineRange)}</span>
                        </th>
                        <th scope="col">
                          {copy.comparison}<span>{rangeLabel(comparison.comparisonRange)}</span>
                        </th>
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
                </div>
              </section>
            );
          })}
        </section>
      )}
    </div>
  );
}
