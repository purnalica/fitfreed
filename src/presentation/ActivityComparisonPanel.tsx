import { type FormEvent, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { catalogs, type Locale } from "../locales/catalogs";
import type {
  ActivityComparison,
  ActivityDateRange,
  ActivitySeriesSummary,
} from "./activity-insights";
import { commandErrorCode } from "./command-error";
import { ProgressSubmitButton } from "./ProgressSubmitButton";
import { useInvalidForm } from "./useInvalidForm";
import { useResultFocus } from "./useResultFocus";

interface ActivityComparisonPanelProps {
  availableRange: ActivityDateRange;
  initialRange: ActivityDateRange;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  onError: (code: string | undefined) => void;
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
}: ActivityComparisonPanelProps) {
  const [baselineRange, setBaselineRange] = useState(initialRange);
  const [comparisonRange, setComparisonRange] = useState(initialRange);
  const [comparison, setComparison] = useState<ActivityComparison>();
  const [loading, setLoading] = useState(false);
  const validation = useInvalidForm(onError);
  const { resultHeadingRef, requestResultFocus } = useResultFocus<HTMLHeadingElement>(
    comparison !== undefined,
  );
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const signedNumber = useMemo(
    () => new Intl.NumberFormat(locale, { signDisplay: "always" }),
    [locale],
  );
  const date = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }),
    [locale],
  );

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
    setLoading(true);
    onError(undefined);
    const initiatingElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    try {
      const result = await invoke<ActivityComparison>("query_activity_comparison", {
        baselineRange,
        comparisonRange,
      });
      setComparison(result);
      requestResultFocus(initiatingElement);
    } catch (reason) {
      const code = commandErrorCode(reason);
      if (code === "invalid-activity-range") {
        validation.reject("invalid-activity-comparison");
      } else {
        onError(code);
      }
    } finally {
      setLoading(false);
    }
  }

  function updateBaseline(field: keyof ActivityDateRange, value: string) {
    validation.edit();
    setBaselineRange((current) => ({ ...current, [field]: value }));
  }

  function updateComparison(field: keyof ActivityDateRange, value: string) {
    validation.edit();
    setComparisonRange((current) => ({ ...current, [field]: value }));
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
      <div>
        <h2 id="activity-comparison-form-heading">{copy.heading}</h2>
        <p>{copy.intro}</p>
      </div>
      <form
        aria-labelledby="activity-comparison-form-heading"
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
        <section className="activity-comparison-result" aria-labelledby="activity-comparison-heading">
          <div className="activity-comparison-result-heading">
            <div>
              <h3 ref={resultHeadingRef} id="activity-comparison-heading" tabIndex={-1}>
                {copy.resultHeading}
              </h3>
              <p>{copy.coverageCaution}</p>
            </div>
            <button type="button" className="secondary" onClick={() => setComparison(undefined)}>
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
                <h4>{messages.activity.series} {number.format(index + 1)}</h4>
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
              </section>
            );
          })}
        </section>
      )}
    </div>
  );
}
