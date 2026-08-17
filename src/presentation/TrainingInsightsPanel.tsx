import { type FormEvent, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import type { ExplorerNavigationRequest } from "./explorer-navigation";
import { TrainingComparisonPanel } from "./TrainingComparisonPanel";
import {
  formatDistance,
  formatDuration,
  formatExactMetric,
  formatTrainingDateTime,
  formatUtcOffset,
} from "./training-format";
import type {
  TrainingDateRange,
  TrainingOverview,
  TrainingSessionInsight,
} from "./training-insights";

interface TrainingInsightsPanelProps {
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  refreshToken: number;
  navigationRequest?: ExplorerNavigationRequest;
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

export function TrainingInsightsPanel({
  locale,
  messages,
  refreshToken,
  navigationRequest,
  onError,
}: TrainingInsightsPanelProps) {
  const [overview, setOverview] = useState<TrainingOverview>();
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeThrough, setRangeThrough] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [selectedSession, setSelectedSession] = useState<{
    seriesRef: string;
    sessionRef: string;
  }>();
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const date = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }),
    [locale],
  );
  const copy = messages.training;

  async function refresh(requestedRange: TrainingDateRange | null = null) {
    const result = await invoke<TrainingOverview>("query_training_overview", {
      requestedRange,
    });
    setOverview(result);
    setRangeFrom(result.selectedRange?.from ?? "");
    setRangeThrough(result.selectedRange?.through ?? "");
    setSelectedSession(undefined);
  }

  useEffect(() => {
    let active = true;
    setLoadingOverview(true);
    invoke<TrainingOverview>("query_training_overview", { requestedRange: null })
      .then((result) => {
        if (!active) return;
        setOverview(result);
        setRangeFrom(result.selectedRange?.from ?? "");
        setRangeThrough(result.selectedRange?.through ?? "");
        setSelectedSession(undefined);
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

  useEffect(() => {
    if (!navigationRequest) return;
    setLoading(true);
    onError(undefined);
    void refresh({
      from: navigationRequest.localDate,
      through: navigationRequest.localDate,
    })
      .catch((reason) => onError(commandErrorCode(reason)))
      .finally(() => setLoading(false));
  }, [navigationRequest, onError]);

  async function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !overview?.availableRange
      || !rangeIsValid({ from: rangeFrom, through: rangeThrough }, overview.availableRange)
    ) {
      onError("invalid-training-range");
      return;
    }
    setLoading(true);
    onError(undefined);
    try {
      await refresh({ from: rangeFrom, through: rangeThrough });
    } catch (reason) {
      onError(commandErrorCode(reason));
    } finally {
      setLoading(false);
    }
  }

  async function resetRange() {
    setLoading(true);
    onError(undefined);
    try {
      await refresh();
    } catch (reason) {
      onError(commandErrorCode(reason));
    } finally {
      setLoading(false);
    }
  }

  function rangeLabel(range: TrainingDateRange): string {
    return `${date.format(localDate(range.from))} ${copy.rangeSeparator} ${date.format(localDate(range.through))}`;
  }

  function sessionDetailLabel(session: TrainingSessionInsight): string {
    return `${copy.viewDetails} ${formatTrainingDateTime(session.startedAtLocal, locale)}`;
  }

  function durationBarWidth(value: string, maximum: bigint): string {
    if (maximum === 0n) return "0%";
    const basisPoints = (BigInt(value) * 10_000n) / maximum;
    return `${Number(basisPoints) / 100}%`;
  }

  function coverageLabel(available: number, total: number): string {
    return `${number.format(available)} ${copy.of} ${number.format(total)}`;
  }

  const maximumDuration = overview?.series
    .flatMap((series) => series.sessions)
    .reduce((maximum, session) => {
      const duration = BigInt(session.durationMilliseconds);
      return duration > maximum ? duration : maximum;
    }, 1n) ?? 1n;
  const selected = selectedSession
    ? overview?.series
      .find((series) => series.seriesRef === selectedSession.seriesRef)
      ?.sessions.find((session) => session.sessionRef === selectedSession.sessionRef)
    : undefined;

  return (
    <section
      className="training-insights"
      aria-labelledby="training-heading"
      aria-busy={loadingOverview}
    >
      <h2 id="training-heading">{copy.heading}</h2>
      {!overview && loadingOverview ? (
        <p>{copy.loading}</p>
      ) : !overview ? (
        <p>{copy.unavailable}</p>
      ) : overview.series.length === 0 ? (
        <p>{copy.empty}</p>
      ) : (
        <>
          {overview.availableRange && overview.selectedRange && (
            <form
              className="training-filter"
              aria-labelledby="training-filter-heading"
              aria-busy={loading}
              onSubmit={(event) => void applyRange(event)}
            >
              <div>
                <h3 id="training-filter-heading">{copy.filterHeading}</h3>
                <p>{copy.rangeHelp}</p>
              </div>
              <label>
                <span>{copy.from}</span>
                <input
                  type="date"
                  min={overview.availableRange.from}
                  max={overview.availableRange.through}
                  value={rangeFrom}
                  onChange={(event) => setRangeFrom(event.target.value)}
                  disabled={loading}
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
                  onChange={(event) => setRangeThrough(event.target.value)}
                  disabled={loading}
                  required
                />
              </label>
              <div className="training-filter-actions">
                <button type="submit" disabled={loading}>
                  {loading ? copy.applyingRange : copy.applyRange}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void resetRange()}
                  disabled={loading}
                >
                  {copy.latestWindow}
                </button>
              </div>
            </form>
          )}
          {overview.selectedRange && (
            <p className="training-range">
              <strong>{copy.selectedRange}:</strong> {rangeLabel(overview.selectedRange)}
              {overview.availableRange && (
                <span>
                  {" · "}<strong>{copy.availableRange}:</strong> {rangeLabel(overview.availableRange)}
                </span>
              )}
            </p>
          )}
          {overview.series.map((series, seriesIndex) => (
            <section className="training-series" key={series.seriesRef}>
              {overview.series.length > 1 && (
                <h3>{copy.series} {number.format(seriesIndex + 1)}</h3>
              )}
              <ul className="training-summary" aria-label={copy.summaryLabel}>
                <li>
                  <strong>
                    {number.format(series.summary.sessionCount)} {series.summary.sessionCount === 1
                      ? copy.sessionUnit.one
                      : copy.sessionUnit.other}
                  </strong>
                  <span>{copy.sessionCount}</span>
                </li>
                <li>
                  <strong>
                    {number.format(series.summary.trainingDays)} {series.summary.trainingDays === 1
                      ? copy.trainingDayUnit.one
                      : copy.trainingDayUnit.other}
                  </strong>
                  <span>{copy.trainingDays}</span>
                </li>
                <li>
                  <strong>
                    {formatDuration(
                      series.summary.totalDurationMilliseconds,
                      locale,
                      copy.durationUnits,
                    )}
                  </strong>
                  <span>{copy.totalDuration}</span>
                </li>
                <li>
                  <strong>
                    {formatDistance(
                      series.summary.totalDistanceMeters,
                      locale,
                      messages.unavailable,
                      copy.units.meters,
                    )}
                  </strong>
                  <span>
                    {copy.totalDistance} · {coverageLabel(
                      series.summary.distanceSessionCount,
                      series.summary.sessionCount,
                    )}
                  </span>
                </li>
                <li>
                  <strong>
                    {formatExactMetric(
                      series.summary.totalEnergyKilocalories,
                      locale,
                      messages.unavailable,
                      copy.units.kilocalories,
                    )}
                  </strong>
                  <span>
                    {copy.totalEnergy} · {coverageLabel(
                      series.summary.energySessionCount,
                      series.summary.sessionCount,
                    )}
                  </span>
                </li>
                <li>
                  <strong>
                    {coverageLabel(
                      series.summary.heartRateSessionCount,
                      series.summary.sessionCount,
                    )}
                  </strong>
                  <span>{copy.heartRateCoverage}</span>
                </li>
              </ul>
              {series.sessions.length === 0 ? (
                <p className="notice">{copy.emptyRange}</p>
              ) : (
                <div className="training-history-grid">
                  <figure>
                    <figcaption>{copy.visual}</figcaption>
                    <ol className="training-chart" aria-hidden="true">
                      {series.sessions.map((session) => (
                        <li key={session.sessionRef}>
                          <time dateTime={session.startedAtLocal}>
                            {formatTrainingDateTime(session.startedAtLocal, locale)}
                          </time>
                          <span className="track">
                            <span
                              className="bar"
                              style={{
                                width: durationBarWidth(
                                  session.durationMilliseconds,
                                  maximumDuration,
                                ),
                              }}
                            />
                          </span>
                          <strong>
                            {formatDuration(
                              session.durationMilliseconds,
                              locale,
                              copy.durationUnits,
                            )}
                          </strong>
                        </li>
                      ))}
                    </ol>
                  </figure>
                  <div className="training-table-scroll" tabIndex={0} aria-label={copy.sessionsTable}>
                    <table>
                      <caption className="sr-only">{copy.sessionsTable}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{copy.startedAt}</th>
                          <th scope="col">{copy.duration}</th>
                          <th scope="col">{copy.distance}</th>
                          <th scope="col">{copy.energy}</th>
                          <th scope="col"><span className="sr-only">{copy.details}</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {series.sessions.map((session) => (
                          <tr key={session.sessionRef}>
                            <td>
                              <time dateTime={session.startedAtLocal}>
                                {formatTrainingDateTime(session.startedAtLocal, locale)}
                              </time>
                            </td>
                            <td>
                              {formatDuration(
                                session.durationMilliseconds,
                                locale,
                                copy.durationUnits,
                              )}
                            </td>
                            <td>
                              {formatDistance(
                                session.distanceMeters,
                                locale,
                                messages.unavailable,
                                copy.units.meters,
                              )}
                            </td>
                            <td>
                              {formatExactMetric(
                                session.energyKilocalories,
                                locale,
                                messages.unavailable,
                                copy.units.kilocalories,
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="detail-button"
                                aria-label={sessionDetailLabel(session)}
                                onClick={() => setSelectedSession({
                                  seriesRef: series.seriesRef,
                                  sessionRef: session.sessionRef,
                                })}
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
              )}
            </section>
          ))}
          {selected && (
            <section className="training-detail" aria-labelledby="training-detail-heading">
              <div className="training-detail-heading">
                <div>
                  <h3 id="training-detail-heading">{copy.detailHeading}</h3>
                  <time dateTime={selected.startedAtLocal}>
                    {formatTrainingDateTime(selected.startedAtLocal, locale)}
                  </time>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setSelectedSession(undefined)}
                >
                  {copy.closeDetail}
                </button>
              </div>
              <dl>
                <div>
                  <dt>{copy.startedAt}</dt>
                  <dd>{formatTrainingDateTime(selected.startedAtLocal, locale)}</dd>
                </div>
                <div>
                  <dt>{copy.stoppedAt}</dt>
                  <dd>{formatTrainingDateTime(selected.stoppedAtLocal, locale)}</dd>
                </div>
                <div>
                  <dt>{copy.utcOffset}</dt>
                  <dd>{formatUtcOffset(selected.utcOffsetMinutes, messages.unavailable)}</dd>
                </div>
                <div>
                  <dt>{copy.duration}</dt>
                  <dd>{formatDuration(selected.durationMilliseconds, locale, copy.durationUnits)}</dd>
                </div>
                <div>
                  <dt>{copy.distance}</dt>
                  <dd>
                    {formatDistance(
                      selected.distanceMeters,
                      locale,
                      messages.unavailable,
                      copy.units.meters,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{copy.energy}</dt>
                  <dd>
                    {formatExactMetric(
                      selected.energyKilocalories,
                      locale,
                      messages.unavailable,
                      copy.units.kilocalories,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{copy.averageHeartRate}</dt>
                  <dd>
                    {formatExactMetric(
                      selected.averageHeartRateBpm,
                      locale,
                      messages.unavailable,
                      copy.units.beatsPerMinute,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{copy.maximumHeartRate}</dt>
                  <dd>
                    {formatExactMetric(
                      selected.maximumHeartRateBpm,
                      locale,
                      messages.unavailable,
                      copy.units.beatsPerMinute,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{copy.trainingType}</dt>
                  <dd>{selected.sportRef === null ? copy.unknownType : copy.recordedType}</dd>
                </div>
                <div>
                  <dt>{copy.exerciseCount}</dt>
                  <dd>
                    {selected.exerciseCount === null
                      ? messages.unavailable
                      : number.format(selected.exerciseCount)}
                  </dd>
                </div>
              </dl>
            </section>
          )}
          {overview.availableRange && overview.selectedRange && (
            <TrainingComparisonPanel
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
