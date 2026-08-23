import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import { WorkspaceNavigation } from "./WorkspaceNavigation";
import type { ExplorerNavigationRequest } from "./explorer-navigation";
import { restoreFocusAfterReveal } from "./focus-restoration";
import { RangeFilterActions, type RangeOperation } from "./RangeFilterActions";
import { RecoveryComparisonPanel } from "./RecoveryComparisonPanel";
import { submissionOrigin } from "./submission-origin";
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
  RecoverySeriesSummary,
  SourceSpecificRecoveryAssessment,
} from "./recovery-insights";
import { useInvalidForm } from "./useInvalidForm";
import { useResultFocus } from "./useResultFocus";

interface RecoveryInsightsPanelProps {
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  refreshToken: number;
  navigationRequest?: ExplorerNavigationRequest;
  onError: (code: string | undefined) => void;
}

interface SelectedNight {
  seriesRef: string;
  recoveryDate: string;
}

type RecoveryWorkspace = "history" | "comparison";

export function RecoveryInsightsPanel({
  locale,
  messages,
  refreshToken,
  navigationRequest,
  onError,
}: RecoveryInsightsPanelProps) {
  const [overview, setOverview] = useState<RecoveryOverview>();
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeThrough, setRangeThrough] = useState("");
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [rangeOperation, setRangeOperation] = useState<RangeOperation>();
  const [selectedNight, setSelectedNight] = useState<SelectedNight>();
  const [detail, setDetail] = useState<RecoveryNightDetail>();
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [workspace, setWorkspace] = useState<RecoveryWorkspace>("history");
  const [historyControlsOpen, setHistoryControlsOpen] = useState(false);
  const rangeValidation = useInvalidForm(onError);
  const detailRequest = useRef(0);
  const initialAnswerPending = useRef(true);
  const overviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const detailOriginRef = useRef<HTMLButtonElement | null>(null);
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const decimal = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
    [locale],
  );
  const date = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }),
    [locale],
  );
  const { resultHeadingRef: answerHeadingRef, requestResultFocus } = useResultFocus<HTMLHeadingElement>(
    overview !== undefined && workspace === "history" && selectedNight === undefined,
  );
  const copy = messages.recovery;

  function clearDetail() {
    detailRequest.current += 1;
    setSelectedNight(undefined);
    setDetail(undefined);
    setLoadingDetail(false);
    detailOriginRef.current = null;
  }

  function closeDetail(initiatingElement: HTMLElement | null) {
    const target = detailOriginRef.current?.isConnected
      ? detailOriginRef.current
      : overviewHeadingRef.current;
    clearDetail();
    restoreFocusAfterReveal(target, initiatingElement);
  }

  function acceptOverview(result: RecoveryOverview) {
    const focusInitialAnswer =
      initialAnswerPending.current && result.series.length > 0 && result.selectedRange !== null;
    initialAnswerPending.current = false;
    setOverview(result);
    setRangeFrom(result.selectedRange?.from ?? "");
    setRangeThrough(result.selectedRange?.through ?? "");
    setHistoryControlsOpen(false);
    clearDetail();
    if (focusInitialAnswer) requestResultFocus();
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

  useEffect(() => {
    if (!navigationRequest) return;
    setWorkspace("history");
    setRangeOperation("navigation");
    onError(undefined);
    void refresh({
      from: navigationRequest.localDate,
      through: navigationRequest.localDate,
    })
      .then(() => {
        setRangeOperation((current) => current === "navigation" ? undefined : current);
        return openDetail({
          seriesRef: navigationRequest.seriesRef,
          recoveryDate: navigationRequest.localDate,
        });
      })
      .catch((reason) => onError(commandErrorCode(reason)))
      .finally(() => setRangeOperation(
        (current) => current === "navigation" ? undefined : current,
      ));
  }, [navigationRequest, onError]);

  async function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !overview?.availableRange
      || !recoveryRangeIsValid(
        { from: rangeFrom, through: rangeThrough },
        overview.availableRange,
      )
    ) {
      rangeValidation.reject("invalid-recovery-range");
      return;
    }
    rangeValidation.accept();
    setRangeOperation("apply");
    onError(undefined);
    const initiatingElement = submissionOrigin(event.nativeEvent);
    try {
      await refresh({ from: rangeFrom, through: rangeThrough });
      requestResultFocus(initiatingElement);
    } catch (reason) {
      onError(commandErrorCode(reason));
    } finally {
      setRangeOperation((current) => current === "apply" ? undefined : current);
    }
  }

  async function resetRange(initiatingElement: HTMLButtonElement) {
    rangeValidation.accept();
    setRangeOperation("reset");
    onError(undefined);
    try {
      await refresh();
      requestResultFocus(initiatingElement);
    } catch (reason) {
      onError(commandErrorCode(reason));
    } finally {
      setRangeOperation((current) => current === "reset" ? undefined : current);
    }
  }

  async function openDetail(
    selection: SelectedNight,
    origin: HTMLButtonElement | null = null,
  ) {
    const request = detailRequest.current + 1;
    detailRequest.current = request;
    detailOriginRef.current = origin;
    setWorkspace("history");
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
        closeDetail(detailHeadingRef.current);
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

  useEffect(() => {
    if (!selectedNight) return;
    return restoreFocusAfterReveal(detailHeadingRef.current, detailOriginRef.current);
  }, [selectedNight]);

  function rangeLabel(range: RecoveryDateRange): string {
    return `${date.format(recoveryLocalDate(range.from))} ${copy.rangeSeparator} ${date.format(recoveryLocalDate(range.through))}`;
  }

  function coverage(available: number, total: number): string {
    return `${number.format(available)} ${copy.of} ${number.format(total)} ${copy.nights}`;
  }

  function observationConclusion(observed: number, total: number): string {
    if (observed === 0) return copy.answerNone;
    return copy.answerObserved
      .replace("{observed}", number.format(observed))
      .replace("{total}", number.format(total));
  }

  function averageEvidence(value: string | null): string {
    return copy.answerAverage.replace(
      "{value}",
      formatRecoveryMilliseconds(value, locale, messages.unavailable),
    );
  }

  function resultConclusion(summary: RecoverySeriesSummary): string {
    return summary.averageBeatToBeatIntervalMilliseconds === null
      ? observationConclusion(summary.observedNights, summary.calendarDays)
      : averageEvidence(summary.averageBeatToBeatIntervalMilliseconds);
  }

  function missingEvidence(count: number): string {
    return copy.answerMissing.replace("{count}", number.format(count));
  }

  function exactNightsLabel(seriesIndex: number): string {
    return copy.exactNightsLabel.replace(
      "{origin}",
      `${copy.series} ${number.format(seriesIndex + 1)}`,
    );
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
  const loadingRange = rangeOperation !== undefined;

  return (
    <section
      className="recovery-insights"
      aria-labelledby="recovery-heading"
      aria-busy={loadingOverview}
    >
      <header className="explorer-workspace-heading">
        <p className="eyebrow">{copy.workspaceEyebrow}</p>
        <h1 id="recovery-heading" ref={overviewHeadingRef} tabIndex={-1}>{copy.heading}</h1>
        <p>{copy.intro}</p>
      </header>
      <WorkspaceNavigation
        label={copy.workspaceNavigation}
        current={workspace}
        options={[
          { workspace: "history", label: copy.workspaces.history },
          {
            workspace: "comparison",
            label: copy.workspaces.comparison,
            disabled: !overview?.availableRange,
          },
        ]}
        onSelect={setWorkspace}
      />
      {!overview && loadingOverview ? (
        <p role="status">{copy.loading}</p>
      ) : !overview ? (
        <p>{copy.unavailable}</p>
      ) : overview.series.length === 0 ? (
        <p>{copy.empty}</p>
      ) : (
        <>
          <div
            className="explorer-history-workspace"
            hidden={workspace !== "history" || selectedNight !== undefined}
          >
          {overview.selectedRange && (
            <section className="recovery-answer answer-canvas" aria-label={copy.answerLabel}>
              <header className="recovery-answer-heading">
                <div>
                  <h2 ref={answerHeadingRef} tabIndex={-1}>
                    {overview.series.length === 1
                      ? resultConclusion(overview.series[0].summary)
                      : copy.answerMultiple.replace(
                        "{count}",
                        number.format(overview.series.length),
                      )}
                  </h2>
                  <p>{rangeLabel(overview.selectedRange)}</p>
                </div>
              </header>
              {overview.series.map((series, seriesIndex) => {
                const originLabel = `${copy.series} ${number.format(seriesIndex + 1)}`;
                return (
                  <section className="recovery-series" key={series.seriesRef}>
                    {overview.series.length > 1 && (
                      <div className="answer-series-heading">
                        <p>{originLabel}</p>
                        <h3>{resultConclusion(series.summary)}</h3>
                      </div>
                    )}
                    {series.summary.averageBeatToBeatIntervalMilliseconds !== null && (
                      <p className="answer-evidence">
                        {observationConclusion(
                          series.summary.observedNights,
                          series.summary.calendarDays,
                        )}
                      </p>
                    )}
                    <p className="answer-coverage">
                      {missingEvidence(series.summary.missingNights)}
                    </p>
                    {series.summary.observedNights === 0 ? (
                      <p className="notice">{copy.emptyRange}</p>
                    ) : (
                      <figure className="recovery-answer-visual">
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
                    )}
                    <details className="answer-exact-values recovery-exact-evidence">
                      <summary>{copy.answerExact}</summary>
                      <p>{copy.answerExactIntro}</p>
                      <ul className="recovery-summary" aria-label={copy.summaryLabel}>
                        <li><strong>{number.format(series.summary.observedNights)}</strong><span>{copy.observedNights} · {coverage(series.summary.observedNights, series.summary.calendarDays)}</span></li>
                        <li><strong>{formatRecoveryMilliseconds(series.summary.averageBeatToBeatIntervalMilliseconds, locale, messages.unavailable)}</strong><span>{copy.averageBeatToBeat} · {coverage(series.summary.observedNights, series.summary.calendarDays)}</span></li>
                        <li><strong>{formatRecoveryMilliseconds(series.summary.averageHeartRateVariabilityRmssdMilliseconds, locale, messages.unavailable)}</strong><span>{copy.averageRmssd} · {coverage(series.summary.rmssdNightCount, series.summary.observedNights)}</span></li>
                        <li><strong>{formatRecoveryMilliseconds(series.summary.averageBreathingIntervalMilliseconds, locale, messages.unavailable)}</strong><span>{copy.averageBreathing} · {coverage(series.summary.observedNights, series.summary.calendarDays)}</span></li>
                        <li><strong>{coverage(series.summary.assessmentNightCount, series.summary.observedNights)}</strong><span>{copy.assessmentCoverage}</span></li>
                        <li><strong>{coverage(series.summary.baselineNightCount, series.summary.observedNights)}</strong><span>{copy.baselineCoverage}</span></li>
                        <li><strong>{coverage(series.summary.guidanceNightCount, series.summary.observedNights)}</strong><span>{copy.guidanceCoverage}</span></li>
                        <li><strong>{number.format(series.summary.missingNights)}</strong><span>{copy.missingNights}</span></li>
                      </ul>
                      <div className="recovery-table-scroll" tabIndex={0}>
                        <table aria-label={exactNightsLabel(seriesIndex)}>
                      <caption className="sr-only">{exactNightsLabel(seriesIndex)}</caption>
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
                            onOpen={(origin) => void openDetail({
                              seriesRef: series.seriesRef,
                              recoveryDate: day.recoveryDate,
                            }, origin)}
                          />
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
          {overview.availableRange && overview.selectedRange && (
            <details
              className="answer-controls"
              open={historyControlsOpen}
              onToggle={(event) => setHistoryControlsOpen(event.currentTarget.open)}
            >
              <summary>{copy.changePeriod}</summary>
              <form
                className="recovery-filter"
                aria-labelledby="recovery-filter-heading"
                aria-busy={loadingRange}
                onSubmit={(event) => void applyRange(event)}
              >
                <div>
                  <h2 id="recovery-filter-heading">{copy.filterHeading}</h2>
                  <p>{copy.rangeHelp}</p>
                  <p><strong>{copy.availableRange}:</strong> {rangeLabel(overview.availableRange)}</p>
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
                <RangeFilterActions
                  className="recovery-filter-actions"
                  operation={rangeOperation}
                  applyLabel={copy.applyRange}
                  applyingLabel={copy.applyingRange}
                  resetLabel={copy.latestWindow}
                  resettingLabel={copy.loadingLatestWindow}
                  navigationLabel={copy.loadingDetail}
                  onReset={(initiatingElement) => void resetRange(initiatingElement)}
                />
              </form>
            </details>
          )}
          </div>
          <div className="explorer-detail-workspace" hidden={workspace !== "history"}>
          {selectedNight && (
            <section
              className="recovery-detail"
              aria-labelledby="recovery-detail-heading"
              aria-busy={loadingDetail}
            >
              <div className="recovery-detail-heading">
                <div>
                  <h2 id="recovery-detail-heading" ref={detailHeadingRef} tabIndex={-1}>
                    {copy.detailHeading}
                  </h2>
                  <time dateTime={selectedNight.recoveryDate}>
                    {date.format(recoveryLocalDate(selectedNight.recoveryDate))}
                  </time>
                </div>
                <button type="button" className="secondary" onClick={(event) => closeDetail(event.currentTarget)}>
                  {copy.closeDetail}
                </button>
              </div>
              {loadingDetail ? <p role="status">{copy.loadingDetail}</p> : detail ? (
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
                    <h3 id="recovery-assessment-heading">{copy.assessmentHeading}</h3>
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
                    <h3 id="recovery-baseline-heading">{copy.baselineHeading}</h3>
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
                    <h3 id="recovery-guidance-heading">{copy.guidanceHeading}</h3>
                    {detail.sourceGuidance === null ? <p>{copy.guidanceUnavailable}</p> : (
                      <>
                        <p className="recovery-source-scheme">
                          <strong>{copy.sourceScheme}:</strong> {detail.sourceGuidance.scheme}
                        </p>
                        <div className="recovery-guidance">
                          <article><h4>{copy.exerciseGuidance}</h4><p>{detail.sourceGuidance.exercise}</p></article>
                          <article><h4>{copy.sleepGuidance}</h4><p>{detail.sourceGuidance.sleep}</p></article>
                          <article><h4>{copy.vitalityGuidance}</h4><p>{detail.sourceGuidance.vitality}</p></article>
                        </div>
                        <p className="recovery-source-notice">{copy.sourceNotice}</p>
                      </>
                    )}
                  </section>
                </>
              ) : <p>{copy.detailUnavailable}</p>}
            </section>
          )}
          </div>
          <div className="explorer-comparison-workspace" hidden={workspace !== "comparison"}>
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
          </div>
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
  onOpen: (origin: HTMLButtonElement) => void;
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
              onClick={(event) => onOpen(event.currentTarget)}
            >
              {copy.details}
            </button>
          </td>
        </>
      )}
    </tr>
  );
}
