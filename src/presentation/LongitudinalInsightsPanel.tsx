import { type FormEvent, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import { LongitudinalComparisonPanel } from "./LongitudinalComparisonPanel";
import type {
  LongitudinalDateRange,
  LongitudinalDayInsight,
  LongitudinalOverview,
  LongitudinalSeriesOverview,
} from "./longitudinal-insights";
import {
  formatRecoveryMilliseconds,
  recoveryBarWidth,
  recoveryLocalDate,
  recoveryRangeIsValid,
} from "./recovery-format";
import { formatSleepDuration } from "./sleep-format";
import { formatDuration } from "./training-format";
import { useInvalidForm } from "./useInvalidForm";

type LongitudinalDomain = "activity" | "training" | "sleep" | "recovery";

interface LongitudinalInsightsPanelProps {
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  refreshToken: number;
  onError: (code: string | undefined) => void;
  onNavigate: (domain: LongitudinalDomain, localDate: string, seriesRef: string) => void;
}

interface SelectedDay {
  seriesRef: string;
  localDate: string;
}

export function LongitudinalInsightsPanel({
  locale,
  messages,
  refreshToken,
  onError,
  onNavigate,
}: LongitudinalInsightsPanelProps) {
  const [overview, setOverview] = useState<LongitudinalOverview>();
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeThrough, setRangeThrough] = useState("");
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingRange, setLoadingRange] = useState(false);
  const [selectedDay, setSelectedDay] = useState<SelectedDay>();
  const rangeValidation = useInvalidForm(onError);
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const date = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }),
    [locale],
  );
  const copy = messages.longitudinal;

  function acceptOverview(result: LongitudinalOverview) {
    setOverview(result);
    setRangeFrom(result.selectedRange?.from ?? "");
    setRangeThrough(result.selectedRange?.through ?? "");
    setSelectedDay(undefined);
  }

  async function refresh(requestedRange: LongitudinalDateRange | null = null) {
    const result = await invoke<LongitudinalOverview>("query_longitudinal_overview", {
      requestedRange,
    });
    acceptOverview(result);
  }

  useEffect(() => {
    let active = true;
    setLoadingOverview(true);
    invoke<LongitudinalOverview>("query_longitudinal_overview", { requestedRange: null })
      .then((result) => {
        if (active) acceptOverview(result);
      })
      .catch((reason) => {
        if (active) onError(commandErrorCode(reason));
      })
      .finally(() => {
        if (active) setLoadingOverview(false);
      });
    return () => {
      active = false;
    };
  }, [refreshToken, onError]);

  async function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !overview?.availableRange
      || !recoveryRangeIsValid(
        { from: rangeFrom, through: rangeThrough },
        overview.availableRange,
      )
    ) {
      rangeValidation.reject("invalid-longitudinal-range");
      return;
    }
    rangeValidation.accept();
    setLoadingRange(true);
    onError(undefined);
    try {
      await refresh({ from: rangeFrom, through: rangeThrough });
    } catch (reason) {
      onError(commandErrorCode(reason));
    } finally {
      setLoadingRange(false);
    }
  }

  async function resetRange() {
    rangeValidation.accept();
    setLoadingRange(true);
    onError(undefined);
    try {
      await refresh();
    } catch (reason) {
      onError(commandErrorCode(reason));
    } finally {
      setLoadingRange(false);
    }
  }

  function rangeLabel(range: LongitudinalDateRange): string {
    return `${date.format(recoveryLocalDate(range.from))} ${copy.rangeSeparator} ${date.format(recoveryLocalDate(range.through))}`;
  }

  function coverage(observed: number, calendarDays: number): string {
    return `${number.format(observed)} ${copy.of} ${number.format(calendarDays)} ${copy.days}`;
  }

  function formatSteps(value: string | null): string {
    return value === null ? messages.unavailable : number.format(BigInt(value));
  }

  function activityStatus(day: LongitudinalDayInsight): string {
    return messages.activity[day.activity.availability];
  }

  function selected(): { series: LongitudinalSeriesOverview; day: LongitudinalDayInsight; index: number } | undefined {
    if (!selectedDay || !overview) return undefined;
    const index = overview.series.findIndex((series) => series.seriesRef === selectedDay.seriesRef);
    const series = overview.series[index];
    const day = series?.days.find((candidate) => candidate.localDate === selectedDay.localDate);
    return series && day ? { series, day, index } : undefined;
  }

  const selectedInsight = selected();

  return (
    <section
      className="longitudinal-insights"
      aria-labelledby="longitudinal-heading"
      aria-busy={loadingOverview}
    >
      <h1 id="longitudinal-heading">{copy.heading}</h1>
      <p className="longitudinal-intro">{copy.intro}</p>
      {!overview && loadingOverview ? (
        <p role="status">{copy.loading}</p>
      ) : !overview ? (
        <p>{copy.unavailable}</p>
      ) : overview.series.length === 0 ? (
        <p>{copy.empty}</p>
      ) : (
        <>
          {overview.availableRange && overview.selectedRange && (
            <form
              className="longitudinal-filter"
              aria-labelledby="longitudinal-filter-heading"
              aria-busy={loadingRange}
              onSubmit={(event) => void applyRange(event)}
            >
              <div>
                <h2 id="longitudinal-filter-heading">{copy.filterHeading}</h2>
                <p>{copy.rangeHelp}</p>
              </div>
              <label>
                <span>{copy.from}</span>
                <input
                  type="date"
                  min={overview.availableRange.from}
                  max={overview.availableRange.through}
                  value={rangeFrom}
                  aria-invalid={rangeValidation.invalid || undefined}
                  aria-describedby={rangeValidation.errorElementId}
                  onChange={(event) => {
                    rangeValidation.edit();
                    setRangeFrom(event.target.value);
                  }}
                  disabled={loadingRange}
                  required
                />
              </label>
              <label>
                <span>{copy.through}</span>
                <input
                  type="date"
                  min={overview.availableRange.from}
                  max={overview.availableRange.through}
                  value={rangeThrough}
                  aria-invalid={rangeValidation.invalid || undefined}
                  aria-describedby={rangeValidation.errorElementId}
                  onChange={(event) => {
                    rangeValidation.edit();
                    setRangeThrough(event.target.value);
                  }}
                  disabled={loadingRange}
                  required
                />
              </label>
              <div className="longitudinal-filter-actions">
                <button type="submit" disabled={loadingRange}>
                  {loadingRange ? copy.applyingRange : copy.applyRange}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void resetRange()}
                  disabled={loadingRange}
                >
                  {copy.latestWindow}
                </button>
              </div>
            </form>
          )}
          {overview.selectedRange && (
            <p className="longitudinal-range">
              <strong>{copy.selectedRange}:</strong> {rangeLabel(overview.selectedRange)}
              {overview.availableRange && (
                <span>
                  {" · "}<strong>{copy.availableRange}:</strong>{" "}
                  {rangeLabel(overview.availableRange)}
                </span>
              )}
            </p>
          )}
          {overview.series.map((series, seriesIndex) => (
            <LongitudinalSeries
              key={series.seriesRef}
              series={series}
              seriesIndex={seriesIndex}
              seriesCount={overview.series.length}
              locale={locale}
              messages={messages}
              date={date}
              number={number}
              coverage={coverage}
              formatSteps={formatSteps}
              activityStatus={activityStatus}
              onSelect={(localDate) => setSelectedDay({ seriesRef: series.seriesRef, localDate })}
            />
          ))}
          {selectedInsight && (
            <section className="longitudinal-detail" aria-labelledby="longitudinal-detail-heading">
              <div className="longitudinal-detail-heading">
                <div>
                  <h2 id="longitudinal-detail-heading">{copy.detailHeading}</h2>
                  <time dateTime={selectedInsight.day.localDate}>
                    {date.format(recoveryLocalDate(selectedInsight.day.localDate))}
                  </time>
                  {overview.series.length > 1 && (
                    <span> · {copy.series} {number.format(selectedInsight.index + 1)}</span>
                  )}
                </div>
                <button type="button" className="secondary" onClick={() => setSelectedDay(undefined)}>
                  {copy.closeDetail}
                </button>
              </div>
              <dl className="longitudinal-detail-grid">
                <div><dt>{copy.activityAvailability}</dt><dd>{activityStatus(selectedInsight.day)}</dd></div>
                <div><dt>{copy.steps}</dt><dd>{formatSteps(selectedInsight.day.activity.stepCount)}</dd></div>
                <div><dt>{copy.trainingSessions}</dt><dd>{number.format(selectedInsight.day.training.sessionCount)}</dd></div>
                <div><dt>{copy.trainingDuration}</dt><dd>{formatDuration(selectedInsight.day.training.totalDurationMilliseconds, locale, messages.training.durationUnits)}</dd></div>
                <div><dt>{copy.sleepAvailability}</dt><dd>{selectedInsight.day.sleep.availability === "available" ? copy.available : copy.missing}</dd></div>
                <div><dt>{copy.sleepDuration}</dt><dd>{formatSleepDuration(selectedInsight.day.sleep.asleepMilliseconds, locale, messages.training.durationUnits, messages.unavailable)}</dd></div>
                <div><dt>{copy.recoveryAvailability}</dt><dd>{selectedInsight.day.recovery.availability === "available" ? copy.available : copy.missing}</dd></div>
                <div><dt>{copy.recoveryInterval}</dt><dd>{formatRecoveryMilliseconds(selectedInsight.day.recovery.beatToBeatIntervalMilliseconds, locale, messages.unavailable)}</dd></div>
                <div><dt>{copy.rmssd}</dt><dd>{formatRecoveryMilliseconds(selectedInsight.day.recovery.heartRateVariabilityRmssdMilliseconds, locale, messages.unavailable)}</dd></div>
                <div><dt>{copy.breathingInterval}</dt><dd>{formatRecoveryMilliseconds(selectedInsight.day.recovery.breathingIntervalMilliseconds, locale, messages.unavailable)}</dd></div>
              </dl>
              <nav className="longitudinal-detail-links" aria-label={copy.detailHeading}>
                {selectedInsight.day.activity.availability !== "missing" && (
                  <a href="#activity-heading" onClick={() => onNavigate("activity", selectedInsight.day.localDate, selectedInsight.series.seriesRef)}>{copy.openActivity}</a>
                )}
                {selectedInsight.day.training.sessionCount > 0 && (
                  <a href="#training-heading" onClick={() => onNavigate("training", selectedInsight.day.localDate, selectedInsight.series.seriesRef)}>{copy.openTraining}</a>
                )}
                {selectedInsight.day.sleep.availability === "available" && (
                  <a href="#sleep-heading" onClick={() => onNavigate("sleep", selectedInsight.day.localDate, selectedInsight.series.seriesRef)}>{copy.openSleep}</a>
                )}
                {selectedInsight.day.recovery.availability === "available" && (
                  <a href="#recovery-heading" onClick={() => onNavigate("recovery", selectedInsight.day.localDate, selectedInsight.series.seriesRef)}>{copy.openRecovery}</a>
                )}
              </nav>
              <p className="notice">{copy.associationNotice}</p>
            </section>
          )}
          {overview.availableRange && overview.selectedRange && (
            <LongitudinalComparisonPanel
              key={`${overview.selectedRange.from}:${overview.selectedRange.through}`}
              availableRange={overview.availableRange}
              initialRange={overview.selectedRange}
              locale={locale}
              messages={messages}
              onError={onError}
            />
          )}
        </>
      )}
    </section>
  );
}

function LongitudinalSeries({
  series,
  seriesIndex,
  seriesCount,
  locale,
  messages,
  date,
  number,
  coverage,
  formatSteps,
  activityStatus,
  onSelect,
}: {
  series: LongitudinalSeriesOverview;
  seriesIndex: number;
  seriesCount: number;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  date: Intl.DateTimeFormat;
  number: Intl.NumberFormat;
  coverage: (observed: number, calendarDays: number) => string;
  formatSteps: (value: string | null) => string;
  activityStatus: (day: LongitudinalDayInsight) => string;
  onSelect: (localDate: string) => void;
}) {
  const copy = messages.longitudinal;
  const maxima = {
    activity: maximum(series.days.map((day) => day.activity.stepCount)),
    training: maximum(series.days.map((day) => day.training.totalDurationMilliseconds)),
    sleep: maximum(series.days.map((day) => day.sleep.asleepMilliseconds)),
    recovery: maximum(series.days.map((day) => day.recovery.beatToBeatIntervalMilliseconds)),
  };

  return (
    <section className="longitudinal-series">
      {seriesCount > 1 && <h2>{copy.series} {number.format(seriesIndex + 1)}</h2>}
      <ul className="longitudinal-summary" aria-label={copy.summaryLabel}>
        <li><span>{copy.activity}</span><strong>{formatSteps(series.activity.totalStepCount)}</strong><small>{copy.totalSteps} · {coverage(series.activity.observedDays, series.activity.calendarDays)}</small></li>
        <li><span>{copy.training}</span><strong>{number.format(series.training.sessionCount)}</strong><small>{copy.sessions} · {number.format(series.training.trainingDays)} · {copy.trainingDays}</small></li>
        <li><span>{copy.sleep}</span><strong>{formatSleepDuration(series.sleep.averageAsleepMilliseconds, locale, messages.training.durationUnits, messages.unavailable)}</strong><small>{copy.averageSleep} · {coverage(series.sleep.observedNights, series.sleep.calendarDays)}</small></li>
        <li><span>{copy.recovery}</span><strong>{formatRecoveryMilliseconds(series.recovery.averageBeatToBeatIntervalMilliseconds, locale, messages.unavailable)}</strong><small>{copy.averageRecovery} · {coverage(series.recovery.observedNights, series.recovery.calendarDays)}</small></li>
      </ul>
      <div className="longitudinal-history-grid">
        <figure>
          <figcaption>{copy.visual}</figcaption>
          <ol className="longitudinal-chart" aria-hidden="true">
            {series.days.map((day) => (
              <li key={day.localDate}>
                <time dateTime={day.localDate}>{date.format(recoveryLocalDate(day.localDate))}</time>
                <div className="longitudinal-lanes">
                  <Lane label={copy.activity} value={day.activity.stepCount} maximum={maxima.activity} className="activity" />
                  <Lane label={copy.training} value={day.training.totalDurationMilliseconds} maximum={maxima.training} className="training" />
                  <Lane label={copy.sleep} value={day.sleep.asleepMilliseconds} maximum={maxima.sleep} className="sleep" />
                  <Lane label={copy.recovery} value={day.recovery.beatToBeatIntervalMilliseconds} maximum={maxima.recovery} className="recovery" />
                </div>
              </li>
            ))}
          </ol>
        </figure>
        <div className="longitudinal-table-scroll" tabIndex={0} aria-label={copy.exactTable}>
          <table>
            <caption className="sr-only">{copy.exactTable}</caption>
            <thead>
              <tr>
                <th scope="col">{copy.date}</th>
                <th scope="col">{copy.steps}</th>
                <th scope="col">{copy.trainingDuration}</th>
                <th scope="col">{copy.sleepDuration}</th>
                <th scope="col">{copy.recoveryInterval}</th>
                <th scope="col"><span className="sr-only">{copy.details}</span></th>
              </tr>
            </thead>
            <tbody>
              {series.days.map((day) => (
                <tr key={day.localDate}>
                  <th scope="row"><time dateTime={day.localDate}>{date.format(recoveryLocalDate(day.localDate))}</time></th>
                  <td>{day.activity.stepCount === null ? activityStatus(day) : formatSteps(day.activity.stepCount)}</td>
                  <td>{formatDuration(day.training.totalDurationMilliseconds, locale, messages.training.durationUnits)}</td>
                  <td>{formatSleepDuration(day.sleep.asleepMilliseconds, locale, messages.training.durationUnits, copy.missing)}</td>
                  <td>{formatRecoveryMilliseconds(day.recovery.beatToBeatIntervalMilliseconds, locale, copy.missing)}</td>
                  <td>
                    <button
                      type="button"
                      className="detail-button"
                      aria-label={`${copy.viewDay} ${date.format(recoveryLocalDate(day.localDate))}`}
                      onClick={() => onSelect(day.localDate)}
                    >
                      {copy.details}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function maximum(values: Array<string | null>): bigint {
  return values.reduce<bigint>((current, value) => {
    const candidate = value === null ? 0n : BigInt(value);
    return candidate > current ? candidate : current;
  }, 1n);
}

function Lane({
  label,
  value,
  maximum,
  className,
}: {
  label: string;
  value: string | null;
  maximum: bigint;
  className: string;
}) {
  return (
    <span className="longitudinal-lane">
      <span>{label}</span>
      <span className="track">
        <span
          className={`bar ${className}`}
          style={{ width: recoveryBarWidth(value, maximum) }}
        />
      </span>
    </span>
  );
}
