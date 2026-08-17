import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import { RecoveryComparisonPanel } from "./RecoveryComparisonPanel";
import {
  formatRecoveryMilliseconds,
  recoveryBarWidth,
  recoveryLocalDate,
  recoveryRangeIsValid,
} from "./recovery-format";
import type {
  RecoveryDateRange,
  RecoveryDayInsight,
  RecoveryNightDetail,
  RecoveryOverview,
  SourceSpecificRecoveryAssessment,
} from "./recovery-insights";

interface RecoveryInsightsPanelProps {
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  refreshToken: number;
  onError: (code: string | undefined) => void;
}

interface SelectedNight {
  seriesRef: string;
  recoveryDate: string;
}

export function RecoveryInsightsPanel({
  locale,
  messages,
  refreshToken,
  onError,
}: RecoveryInsightsPanelProps) {
  const [overview, setOverview] = useState<RecoveryOverview>();
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeThrough, setRangeThrough] = useState("");
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingRange, setLoadingRange] = useState(false);
  const [selectedNight, setSelectedNight] = useState<SelectedNight>();
  const [detail, setDetail] = useState<RecoveryNightDetail>();
  const [loadingDetail, setLoadingDetail] = useState(false);
  const detailRequest = useRef(0);
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const decimal = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
    [locale],
  );
  const date = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }),
    [locale],
  );
  const copy = messages.recovery;

  function closeDetail() {
    detailRequest.current += 1;
    setSelectedNight(undefined);
    setDetail(undefined);
    setLoadingDetail(false);
  }

  function acceptOverview(result: RecoveryOverview) {
    setOverview(result);
    setRangeFrom(result.selectedRange?.from ?? "");
    setRangeThrough(result.selectedRange?.through ?? "");
    closeDetail();
  }

  async function refresh(requestedRange: RecoveryDateRange | null = null) {
    const result = await invoke<RecoveryOverview>("query_recovery_overview", { requestedRange });
    acceptOverview(result);
  }

  useEffect(() => {
    let active = true;
    setLoadingOverview(true);
    invoke<RecoveryOverview>("query_recovery_overview", { requestedRange: null })
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
      detailRequest.current += 1;
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
      onError("invalid-recovery-range");
      return;
    }
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

  async function openDetail(selection: SelectedNight) {
    const request = detailRequest.current + 1;
    detailRequest.current = request;
    setSelectedNight(selection);
    setDetail(undefined);
    setLoadingDetail(true);
    onError(undefined);
    try {
      const result = await invoke<RecoveryNightDetail | null>("query_recovery_detail", {
        seriesRef: selection.seriesRef,
        recoveryDate: selection.recoveryDate,
      });
      if (request !== detailRequest.current) return;
      if (result === null) {
        setSelectedNight(undefined);
        onError("invalid-recovery-reference");
        return;
      }
      setDetail(result);
    } catch (reason) {
      if (request === detailRequest.current) onError(commandErrorCode(reason));
    } finally {
      if (request === detailRequest.current) setLoadingDetail(false);
    }
  }

  function rangeLabel(range: RecoveryDateRange): string {
    return `${date.format(recoveryLocalDate(range.from))} ${copy.rangeSeparator} ${date.format(recoveryLocalDate(range.through))}`;
  }

  function coverage(available: number, total: number): string {
    return `${number.format(available)} ${copy.of} ${number.format(total)} ${copy.nights}`;
  }

  function sourceStatus(assessment: SourceSpecificRecoveryAssessment | null): string {
    if (assessment === null) return messages.unavailable;
    return `${copy.overallStatus} ${number.format(assessment.overallStatus)} / 6`;
  }

  const maximumBeatToBeat = overview?.series
    .flatMap((series) => series.days)
    .reduce((maximum, day) => {
      const value = day.recovery === null
        ? 0n
        : BigInt(day.recovery.beatToBeatIntervalMilliseconds);
      return value > maximum ? value : maximum;
    }, 1n) ?? 1n;

  return (
    <section
      className="recovery-insights"
      aria-labelledby="recovery-heading"
      aria-busy={loadingOverview}
    >
      <h2 id="recovery-heading">{copy.heading}</h2>
      <p className="recovery-intro">{copy.intro}</p>
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
              className="recovery-filter"
              aria-labelledby="recovery-filter-heading"
              aria-busy={loadingRange}
              onSubmit={(event) => void applyRange(event)}
            >
              <div>
                <h3 id="recovery-filter-heading">{copy.filterHeading}</h3>
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
                  onChange={(event) => setRangeThrough(event.target.value)}
                  disabled={loadingRange}
                  required
                />
              </label>
              <div className="recovery-filter-actions">
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
            <p className="recovery-range">
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
            <section className="recovery-series" key={series.seriesRef}>
              {overview.series.length > 1 && (
                <h3>{copy.series} {number.format(seriesIndex + 1)}</h3>
              )}
              <ul className="recovery-summary" aria-label={copy.summaryLabel}>
                <li>
                  <strong>{number.format(series.summary.observedNights)}</strong>
                  <span>{copy.observedNights} · {coverage(series.summary.observedNights, series.summary.calendarDays)}</span>
                </li>
                <li>
                  <strong>{formatRecoveryMilliseconds(series.summary.averageBeatToBeatIntervalMilliseconds, locale, messages.unavailable)}</strong>
                  <span>{copy.averageBeatToBeat} · {coverage(series.summary.observedNights, series.summary.calendarDays)}</span>
                </li>
                <li>
                  <strong>{formatRecoveryMilliseconds(series.summary.averageHeartRateVariabilityRmssdMilliseconds, locale, messages.unavailable)}</strong>
                  <span>{copy.averageRmssd} · {coverage(series.summary.rmssdNightCount, series.summary.observedNights)}</span>
                </li>
                <li>
                  <strong>{formatRecoveryMilliseconds(series.summary.averageBreathingIntervalMilliseconds, locale, messages.unavailable)}</strong>
                  <span>{copy.averageBreathing} · {coverage(series.summary.observedNights, series.summary.calendarDays)}</span>
                </li>
                <li>
                  <strong>{coverage(series.summary.assessmentNightCount, series.summary.observedNights)}</strong>
                  <span>{copy.assessmentCoverage}</span>
                </li>
                <li>
                  <strong>{coverage(series.summary.baselineNightCount, series.summary.observedNights)}</strong>
                  <span>{copy.baselineCoverage}</span>
                </li>
                <li>
                  <strong>{coverage(series.summary.guidanceNightCount, series.summary.observedNights)}</strong>
                  <span>{copy.guidanceCoverage}</span>
                </li>
                <li>
                  <strong>{number.format(series.summary.missingNights)}</strong>
                  <span>{copy.missingNights}</span>
                </li>
              </ul>
              {series.summary.observedNights === 0 ? (
                <p className="notice">{copy.emptyRange}</p>
              ) : (
                <div className="recovery-history-grid">
                  <figure>
                    <figcaption>{copy.visual}</figcaption>
                    <ol className="recovery-chart" aria-hidden="true">
                      {series.days.map((day) => (
                        <li
                          key={day.recoveryDate}
                          className={day.availability === "missing" ? "missing" : undefined}
                        >
                          <time dateTime={day.recoveryDate}>
                            {date.format(recoveryLocalDate(day.recoveryDate))}
                          </time>
                          {day.recovery === null ? (
                            <>
                              <span className="recovery-track missing-track" />
                              <strong>{copy.missing}</strong>
                            </>
                          ) : (
                            <>
                              <span className="recovery-track">
                                <span
                                  className="recovery-beat-to-beat"
                                  style={{
                                    width: recoveryBarWidth(
                                      day.recovery.beatToBeatIntervalMilliseconds,
                                      maximumBeatToBeat,
                                    ),
                                  }}
                                />
                              </span>
                              <strong>
                                {formatRecoveryMilliseconds(
                                  day.recovery.beatToBeatIntervalMilliseconds,
                                  locale,
                                  messages.unavailable,
                                )}
                              </strong>
                            </>
                          )}
                        </li>
                      ))}
                    </ol>
                    <ul className="recovery-legend" aria-hidden="true">
                      <li><span className="recovery-beat-to-beat" />{copy.beatToBeat}</li>
                      <li><span className="missing-swatch" />{copy.missing}</li>
                    </ul>
                  </figure>
                  <div
                    className="recovery-table-scroll"
                    tabIndex={0}
                    aria-label={copy.nightsTable}
                  >
                    <table>
                      <caption className="sr-only">{copy.nightsTable}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{copy.recoveryDate}</th>
                          <th scope="col">{copy.beatToBeat}</th>
                          <th scope="col">{copy.rmssd}</th>
                          <th scope="col">{copy.sourceAssessment}</th>
                          <th scope="col"><span className="sr-only">{copy.details}</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {series.days.map((day) => (
                          <RecoveryDayRow
                            key={day.recoveryDate}
                            day={day}
                            locale={locale}
                            messages={messages}
                            dateLabel={date.format(recoveryLocalDate(day.recoveryDate))}
                            statusLabel={sourceStatus(day.recovery?.sourceAssessment ?? null)}
                            onOpen={() => void openDetail({
                              seriesRef: series.seriesRef,
                              recoveryDate: day.recoveryDate,
                            })}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          ))}
          {selectedNight && (
            <section
              className="recovery-detail"
              aria-labelledby="recovery-detail-heading"
              aria-busy={loadingDetail}
            >
              <div className="recovery-detail-heading">
                <div>
                  <h3 id="recovery-detail-heading">{copy.detailHeading}</h3>
                  <time dateTime={selectedNight.recoveryDate}>
                    {date.format(recoveryLocalDate(selectedNight.recoveryDate))}
                  </time>
                </div>
                <button type="button" className="secondary" onClick={closeDetail}>
                  {copy.closeDetail}
                </button>
              </div>
              {loadingDetail ? <p>{copy.loadingDetail}</p> : detail ? (
                <>
                  <dl className="recovery-detail-metrics">
                    <div>
                      <dt>{copy.beatToBeat}</dt>
                      <dd>{formatRecoveryMilliseconds(detail.beatToBeatIntervalMilliseconds, locale, messages.unavailable)}</dd>
                    </div>
                    <div>
                      <dt>{copy.rmssd}</dt>
                      <dd>{formatRecoveryMilliseconds(detail.heartRateVariabilityRmssdMilliseconds, locale, messages.unavailable)}</dd>
                    </div>
                    <div>
                      <dt>{copy.breathingInterval}</dt>
                      <dd>{formatRecoveryMilliseconds(detail.breathingIntervalMilliseconds, locale, messages.unavailable)}</dd>
                    </div>
                  </dl>
                  <section className="recovery-subdetail" aria-labelledby="recovery-assessment-heading">
                    <h4 id="recovery-assessment-heading">{copy.assessmentHeading}</h4>
                    {detail.sourceAssessment === null ? <p>{copy.assessmentUnavailable}</p> : (
                      <dl className="recovery-detail-metrics">
                        <div><dt>{copy.sourceScheme}</dt><dd>{detail.sourceAssessment.scheme}</dd></div>
                        <div><dt>{copy.autonomicCharge}</dt><dd>{decimal.format(detail.sourceAssessment.autonomicCharge)}</dd></div>
                        <div><dt>{copy.autonomicStatus}</dt><dd>{number.format(detail.sourceAssessment.autonomicStatus)} / 5</dd></div>
                        <div><dt>{copy.overallStatus}</dt><dd>{number.format(detail.sourceAssessment.overallStatus)} / 6</dd></div>
                        <div><dt>{copy.overallSublevel}</dt><dd>{number.format(BigInt(detail.sourceAssessment.overallSublevel))}</dd></div>
                      </dl>
                    )}
                  </section>
                  <section className="recovery-subdetail" aria-labelledby="recovery-baseline-heading">
                    <h4 id="recovery-baseline-heading">{copy.baselineHeading}</h4>
                    {detail.sourceBaseline === null ? <p>{copy.baselineUnavailable}</p> : (
                      <dl className="recovery-detail-metrics">
                        <div><dt>{copy.sourceScheme}</dt><dd>{detail.sourceBaseline.scheme}</dd></div>
                        <div><dt>{copy.baselineBeatToBeat}</dt><dd>{formatRecoveryMilliseconds(detail.sourceBaseline.meanBeatToBeatIntervalMilliseconds, locale, messages.unavailable)}</dd></div>
                        <div><dt>{copy.baselineBeatToBeatDeviation}</dt><dd>{formatRecoveryMilliseconds(detail.sourceBaseline.standardDeviationBeatToBeatIntervalMilliseconds, locale, messages.unavailable)}</dd></div>
                        <div><dt>{copy.baselineRmssd}</dt><dd>{formatRecoveryMilliseconds(detail.sourceBaseline.meanHeartRateVariabilityRmssdMilliseconds, locale, messages.unavailable)}</dd></div>
                        <div><dt>{copy.baselineRmssdDeviation}</dt><dd>{formatRecoveryMilliseconds(detail.sourceBaseline.standardDeviationHeartRateVariabilityRmssdMilliseconds, locale, messages.unavailable)}</dd></div>
                        <div><dt>{copy.baselineBreathing}</dt><dd>{formatRecoveryMilliseconds(detail.sourceBaseline.meanBreathingIntervalMilliseconds, locale, messages.unavailable)}</dd></div>
                        <div><dt>{copy.baselineBreathingDeviation}</dt><dd>{formatRecoveryMilliseconds(detail.sourceBaseline.standardDeviationBreathingIntervalMilliseconds, locale, messages.unavailable)}</dd></div>
                      </dl>
                    )}
                  </section>
                  <section className="recovery-subdetail" aria-labelledby="recovery-guidance-heading">
                    <h4 id="recovery-guidance-heading">{copy.guidanceHeading}</h4>
                    {detail.sourceGuidance === null ? <p>{copy.guidanceUnavailable}</p> : (
                      <>
                        <p className="recovery-source-scheme">
                          <strong>{copy.sourceScheme}:</strong> {detail.sourceGuidance.scheme}
                        </p>
                        <div className="recovery-guidance">
                          <article><h5>{copy.exerciseGuidance}</h5><p>{detail.sourceGuidance.exercise}</p></article>
                          <article><h5>{copy.sleepGuidance}</h5><p>{detail.sourceGuidance.sleep}</p></article>
                          <article><h5>{copy.vitalityGuidance}</h5><p>{detail.sourceGuidance.vitality}</p></article>
                        </div>
                        <p className="recovery-source-notice">{copy.sourceNotice}</p>
                      </>
                    )}
                  </section>
                </>
              ) : <p>{copy.detailUnavailable}</p>}
            </section>
          )}
          {overview.availableRange && overview.selectedRange && (
            <RecoveryComparisonPanel
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

function RecoveryDayRow({
  day,
  locale,
  messages,
  dateLabel,
  statusLabel,
  onOpen,
}: {
  day: RecoveryDayInsight;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  dateLabel: string;
  statusLabel: string;
  onOpen: () => void;
}) {
  const copy = messages.recovery;
  return (
    <tr>
      <td><time dateTime={day.recoveryDate}>{dateLabel}</time></td>
      {day.recovery === null ? (
        <>
          <td>{copy.missing}</td>
          <td>{messages.unavailable}</td>
          <td>{messages.unavailable}</td>
          <td />
        </>
      ) : (
        <>
          <td>{formatRecoveryMilliseconds(day.recovery.beatToBeatIntervalMilliseconds, locale, messages.unavailable)}</td>
          <td>{formatRecoveryMilliseconds(day.recovery.heartRateVariabilityRmssdMilliseconds, locale, messages.unavailable)}</td>
          <td>{statusLabel}</td>
          <td>
            <button
              type="button"
              className="detail-button"
              aria-label={`${copy.viewDetails} ${dateLabel}`}
              onClick={onOpen}
            >
              {copy.details}
            </button>
          </td>
        </>
      )}
    </tr>
  );
}
