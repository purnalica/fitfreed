import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import { WorkspaceNavigation } from "./WorkspaceNavigation";
import type { ExplorerNavigationRequest } from "./explorer-navigation";
import { restoreFocusAfterReveal } from "./focus-restoration";
import { RangeFilterActions, type RangeOperation } from "./RangeFilterActions";
import { SleepComparisonPanel } from "./SleepComparisonPanel";
import { submissionOrigin } from "./submission-origin";
import {
  formatDecimal,
  formatSleepDateTime,
  formatSleepDuration,
  percentageWidth,
  phaseTotal,
  sleepLocalDate,
  sleepRangeIsValid,
  timelineSegments,
} from "./sleep-format";
import type {
  SleepDateRange,
  SleepDayInsight,
  SleepOverview,
  SleepPeriodDetail,
  SleepPhaseSummary,
} from "./sleep-insights";
import { useInvalidForm } from "./useInvalidForm";
import { useResultFocus } from "./useResultFocus";

interface SleepInsightsPanelProps {
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  refreshToken: number;
  navigationRequest?: ExplorerNavigationRequest;
  onError: (code: string | undefined) => void;
}

interface SelectedNight {
  seriesRef: string;
  sleepDate: string;
}

type SleepWorkspace = "history" | "comparison";

export function SleepInsightsPanel({
  locale,
  messages,
  refreshToken,
  navigationRequest,
  onError,
}: SleepInsightsPanelProps) {
  const [overview, setOverview] = useState<SleepOverview>();
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeThrough, setRangeThrough] = useState("");
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [rangeOperation, setRangeOperation] = useState<RangeOperation>();
  const [selectedNight, setSelectedNight] = useState<SelectedNight>();
  const [detail, setDetail] = useState<SleepPeriodDetail>();
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [workspace, setWorkspace] = useState<SleepWorkspace>("history");
  const [historyControlsOpen, setHistoryControlsOpen] = useState(false);
  const rangeValidation = useInvalidForm(onError);
  const detailRequest = useRef(0);
  const initialAnswerPending = useRef(true);
  const overviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const detailOriginRef = useRef<HTMLButtonElement | null>(null);
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const date = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }),
    [locale],
  );
  const { resultHeadingRef: answerHeadingRef, requestResultFocus } = useResultFocus<HTMLHeadingElement>(
    overview !== undefined && workspace === "history" && selectedNight === undefined,
  );
  const copy = messages.sleep;

  function acceptOverview(result: SleepOverview) {
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

  async function refresh(requestedRange: SleepDateRange | null = null) {
    const result = await invoke<SleepOverview>("query_sleep_overview", { requestedRange });
    acceptOverview(result);
  }

  useEffect(() => {
    let active = true;
    setLoadingOverview(true);
    invoke<SleepOverview>("query_sleep_overview", { requestedRange: null })
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
          sleepDate: navigationRequest.localDate,
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
      || !sleepRangeIsValid({ from: rangeFrom, through: rangeThrough }, overview.availableRange)
    ) {
      rangeValidation.reject("invalid-sleep-range");
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
      const result = await invoke<SleepPeriodDetail | null>("query_sleep_detail", {
        seriesRef: selection.seriesRef,
        sleepDate: selection.sleepDate,
      });
      if (request !== detailRequest.current) return;
      if (result === null) {
        closeDetail(detailHeadingRef.current);
        onError("invalid-sleep-reference");
        return;
      }
      setDetail(result);
    } catch (reason) {
      if (request === detailRequest.current) onError(commandErrorCode(reason));
    } finally {
      if (request === detailRequest.current) setLoadingDetail(false);
    }
  }

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

  useEffect(() => {
    if (!selectedNight) return;
    return restoreFocusAfterReveal(detailHeadingRef.current, detailOriginRef.current);
  }, [selectedNight]);

  function rangeLabel(range: SleepDateRange): string {
    return `${date.format(sleepLocalDate(range.from))} ${copy.rangeSeparator} ${date.format(sleepLocalDate(range.through))}`;
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
      formatSleepDuration(value, locale, copy.durationUnits, messages.unavailable),
    );
  }

  function exactNightsLabel(seriesIndex: number): string {
    return copy.exactNightsLabel.replace(
      "{origin}",
      `${copy.series} ${number.format(seriesIndex + 1)}`,
    );
  }

  function goalMet(asleep: string, goal: string | null): string {
    if (goal === null) return messages.unavailable;
    return BigInt(asleep) >= BigInt(goal) ? copy.yes : copy.no;
  }

  const maximumSpan = overview?.series
    .flatMap((series) => series.days)
    .reduce((maximum, day) => {
      const span = day.period === null ? 0n : BigInt(day.period.spanMilliseconds);
      return span > maximum ? span : maximum;
    }, 1n) ?? 1n;
  const loadingRange = rangeOperation !== undefined;

  return (
    <section className="sleep-insights" aria-labelledby="sleep-heading" aria-busy={loadingOverview}>
      <header className="explorer-workspace-heading">
        <p className="eyebrow">{copy.workspaceEyebrow}</p>
        <h1 id="sleep-heading" ref={overviewHeadingRef} tabIndex={-1}>{copy.heading}</h1>
        <p>{copy.workspaceIntro}</p>
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
            <section className="sleep-answer answer-canvas" aria-label={copy.answerLabel}>
              <header className="sleep-answer-heading">
                <div>
                  <h2 ref={answerHeadingRef} tabIndex={-1}>
                    {overview.series.length === 1
                      ? observationConclusion(
                        overview.series[0].summary.observedNights,
                        overview.series[0].summary.calendarDays,
                      )
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
                  <section className="sleep-series" key={series.seriesRef}>
                    {overview.series.length > 1 && (
                      <div className="answer-series-heading">
                        <p>{originLabel}</p>
                        <h3>
                          {observationConclusion(
                            series.summary.observedNights,
                            series.summary.calendarDays,
                          )}
                        </h3>
                      </div>
                    )}
                    <p className="answer-evidence">
                      {averageEvidence(series.summary.averageAsleepMilliseconds)}
                    </p>
                    {series.summary.observedNights === 0 ? (
                      <p className="notice">{copy.emptyRange}</p>
                    ) : (
                      <figure className="sleep-answer-visual">
                        <figcaption>{copy.visual}</figcaption>
                        <ol className="sleep-chart" aria-hidden="true">
                          {series.days.map((day) => (
                            <li
                              key={day.sleepDate}
                              className={day.availability === "missing" ? "missing" : undefined}
                            >
                              <time dateTime={day.sleepDate}>
                                {date.format(sleepLocalDate(day.sleepDate))}
                              </time>
                              {day.period === null ? (
                                <>
                                  <span className="sleep-track missing-track" />
                                  <strong>{copy.missing}</strong>
                                </>
                              ) : (
                                <>
                                  <span
                                    className="sleep-track"
                                    style={{
                                      width: percentageWidth(
                                        day.period.spanMilliseconds,
                                        maximumSpan,
                                      ),
                                    }}
                                  >
                                    <span
                                      className="sleep-asleep"
                                      style={{
                                        width: percentageWidth(
                                          day.period.asleepMilliseconds,
                                          BigInt(day.period.spanMilliseconds),
                                        ),
                                      }}
                                    />
                                    <span
                                      className="sleep-interruption"
                                      style={{
                                        width: percentageWidth(
                                          day.period.interruptionMilliseconds,
                                          BigInt(day.period.spanMilliseconds),
                                        ),
                                      }}
                                    />
                                  </span>
                                  <strong>
                                    {formatSleepDuration(
                                      day.period.asleepMilliseconds,
                                      locale,
                                      copy.durationUnits,
                                      messages.unavailable,
                                    )}
                                  </strong>
                                </>
                              )}
                            </li>
                          ))}
                        </ol>
                        <ul className="sleep-legend" aria-hidden="true">
                          <li><span className="sleep-asleep" />{copy.asleep}</li>
                          <li><span className="sleep-interruption" />{copy.interruptions}</li>
                          <li><span className="missing-swatch" />{copy.missing}</li>
                        </ul>
                      </figure>
                    )}
                    <details className="answer-exact-values sleep-exact-evidence">
                      <summary>{copy.answerExact}</summary>
                      <p>{copy.answerExactIntro}</p>
                      <ul className="sleep-summary" aria-label={copy.summaryLabel}>
                        <li><strong>{number.format(series.summary.observedNights)}</strong><span>{copy.observedNights} · {coverage(series.summary.observedNights, series.summary.calendarDays)}</span></li>
                        <li><strong>{formatSleepDuration(series.summary.averageAsleepMilliseconds, locale, copy.durationUnits, messages.unavailable)}</strong><span>{copy.averageAsleep} · {coverage(series.summary.observedNights, series.summary.calendarDays)}</span></li>
                        <li><strong>{formatDecimal(series.summary.averageEfficiencyPercent, locale, messages.unavailable, "%")}</strong><span>{copy.averageEfficiency} · {coverage(series.summary.observedNights, series.summary.calendarDays)}</span></li>
                        <li><strong>{formatDecimal(series.summary.averageOverallScore, locale, messages.unavailable)}</strong><span>{copy.averageScore} · {coverage(series.summary.scoreNightCount, series.summary.observedNights)}</span></li>
                        <li><strong>{series.summary.goalNightCount === 0 ? messages.unavailable : `${number.format(series.summary.goalMetNightCount)} / ${number.format(series.summary.goalNightCount)}`}</strong><span>{copy.goalMet}</span></li>
                        <li><strong>{coverage(series.summary.phaseNightCount, series.summary.observedNights)}</strong><span>{copy.phaseCoverage}</span></li>
                        <li><strong>{coverage(series.summary.stageTimelineNightCount, series.summary.observedNights)}</strong><span>{copy.timelineCoverage}</span></li>
                        <li><strong>{coverage(series.summary.powerStatusNightCount, series.summary.observedNights)}</strong><span>{copy.powerCoverage} · {number.format(series.summary.powerLossNightCount)} {copy.powerLoss}</span></li>
                      </ul>
                      <div className="sleep-table-scroll" tabIndex={0}>
                        <table aria-label={exactNightsLabel(seriesIndex)}>
                          <caption className="sr-only">{exactNightsLabel(seriesIndex)}</caption>
                          <thead><tr><th scope="col">{copy.sleepDate}</th><th scope="col">{copy.asleep}</th><th scope="col">{copy.efficiency}</th><th scope="col">{copy.score}</th><th scope="col"><span className="sr-only">{copy.details}</span></th></tr></thead>
                          <tbody>
                            {series.days.map((day) => <SleepDayRow
                              key={day.sleepDate}
                              day={day}
                              locale={locale}
                              messages={messages}
                              dateLabel={date.format(sleepLocalDate(day.sleepDate))}
                              onOpen={(origin) => void openDetail(
                                { seriesRef: series.seriesRef, sleepDate: day.sleepDate },
                                origin,
                              )}
                            />)}
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
                className="sleep-filter"
                aria-labelledby="sleep-filter-heading"
                aria-busy={loadingRange}
                onSubmit={(event) => void applyRange(event)}
              >
                <div>
                  <h2 id="sleep-filter-heading">{copy.filterHeading}</h2>
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
                  className="sleep-filter-actions"
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
            <section className="sleep-detail" aria-labelledby="sleep-detail-heading" aria-busy={loadingDetail}>
              <div className="sleep-detail-heading">
                <div><h2 id="sleep-detail-heading" ref={detailHeadingRef} tabIndex={-1}>{copy.detailHeading}</h2><time dateTime={selectedNight.sleepDate}>{date.format(sleepLocalDate(selectedNight.sleepDate))}</time></div>
                <button type="button" className="secondary" onClick={(event) => closeDetail(event.currentTarget)}>{copy.closeDetail}</button>
              </div>
              {loadingDetail ? <p role="status">{copy.loadingDetail}</p> : detail ? (
                <>
                  <dl className="sleep-detail-metrics">
                    {[
                      [copy.startedAt, formatSleepDateTime(detail.startedAt, locale)],
                      [copy.endedAt, formatSleepDateTime(detail.endedAt, locale)],
                      [copy.span, formatSleepDuration(detail.spanMilliseconds, locale, copy.durationUnits, messages.unavailable)],
                      [copy.asleep, formatSleepDuration(detail.asleepMilliseconds, locale, copy.durationUnits, messages.unavailable)],
                      [copy.interruptions, formatSleepDuration(detail.interruptionMilliseconds, locale, copy.durationUnits, messages.unavailable)],
                      [copy.longInterruptions, `${formatSleepDuration(detail.longInterruptionMilliseconds, locale, copy.durationUnits, messages.unavailable)} · ${number.format(BigInt(detail.longInterruptionCount))}`],
                      [copy.shortInterruptions, `${formatSleepDuration(detail.shortInterruptionMilliseconds, locale, copy.durationUnits, messages.unavailable)} · ${number.format(BigInt(detail.shortInterruptionCount))}`],
                      [copy.interruptionCount, number.format(BigInt(detail.interruptionCount))],
                      [copy.efficiency, formatDecimal(detail.efficiencyPercent, locale, messages.unavailable, "%")],
                      [copy.continuity, `${formatDecimal(detail.continuityIndex, locale, messages.unavailable)} · ${copy.continuityClass} ${number.format(detail.continuityClass)}`],
                      [copy.sleepGoal, formatSleepDuration(detail.sleepGoalMilliseconds, locale, copy.durationUnits, messages.unavailable)],
                      [copy.goalMet, goalMet(detail.asleepMilliseconds, detail.sleepGoalMilliseconds)],
                      [copy.selfRating, detail.selfReportedRating === null ? messages.unavailable : `${number.format(detail.selfReportedRating)} / 5`],
                      [copy.cycles, detail.cycleCount === null ? messages.unavailable : number.format(BigInt(detail.cycleCount))],
                      [copy.powerLossStatus, detail.recordingEndedByPowerLoss === null ? messages.unavailable : detail.recordingEndedByPowerLoss ? copy.yes : copy.no],
                    ].map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}
                  </dl>
                  <SleepPhaseComposition summary={detail.phaseSummary} locale={locale} messages={messages} />
                  <SleepTimeline detail={detail} locale={locale} messages={messages} />
                  <SleepScoreDetails detail={detail} locale={locale} messages={messages} />
                </>
              ) : <p>{copy.detailUnavailable}</p>}
            </section>
          )}
          </div>
          <div className="explorer-comparison-workspace" hidden={workspace !== "comparison"}>
          {overview.availableRange && overview.selectedRange && (
            <SleepComparisonPanel
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

function SleepDayRow({
  day,
  locale,
  messages,
  dateLabel,
  onOpen,
}: {
  day: SleepDayInsight;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  dateLabel: string;
  onOpen: (origin: HTMLButtonElement) => void;
}) {
  const copy = messages.sleep;
  return (
    <tr>
      <td><time dateTime={day.sleepDate}>{dateLabel}</time></td>
      {day.period === null ? (
        <><td>{copy.missing}</td><td>{messages.unavailable}</td><td>{messages.unavailable}</td><td /></>
      ) : (
        <>
          <td>{formatSleepDuration(day.period.asleepMilliseconds, locale, copy.durationUnits, messages.unavailable)}</td>
          <td>{formatDecimal(day.period.efficiencyPercent, locale, messages.unavailable, "%")}</td>
          <td>{formatDecimal(day.period.scoreOverall, locale, messages.unavailable)}</td>
          <td><button type="button" className="detail-button" aria-label={`${copy.viewDetails} ${dateLabel}`} onClick={(event) => onOpen(event.currentTarget)}>{copy.details}</button></td>
        </>
      )}
    </tr>
  );
}

function SleepPhaseComposition({ summary, locale, messages }: { summary: SleepPhaseSummary | null; locale: Locale; messages: (typeof catalogs)["en-US"] }) {
  const copy = messages.sleep;
  if (summary === null) return <section className="sleep-subdetail"><h3>{copy.phaseHeading}</h3><p>{copy.phaseUnavailable}</p></section>;
  const entries = [
    ["wake", copy.stages.wake, summary.wakeMilliseconds],
    ["rem", copy.stages.rem, summary.remMilliseconds],
    ["light", copy.stages.light, summary.lightMilliseconds],
    ["deep", copy.stages.deep, summary.deepMilliseconds],
    ["unrecognized", copy.stages.unrecognized, summary.unrecognizedMilliseconds],
  ] as const;
  const total = phaseTotal(summary);
  return (
    <section className="sleep-subdetail" aria-labelledby="sleep-phase-heading">
      <h3 id="sleep-phase-heading">{copy.phaseHeading}</h3>
      <div className="sleep-phase-bar" aria-hidden="true">{entries.map(([stage, , value]) => <span key={stage} className={`stage-${stage}`} style={{ width: percentageWidth(value, total) }} />)}</div>
      <dl className="sleep-phase-values">{entries.map(([stage, label, value]) => <div key={stage}><dt><span className={`stage-${stage}`} />{label}</dt><dd>{formatSleepDuration(value, locale, copy.durationUnits, messages.unavailable)}</dd></div>)}</dl>
    </section>
  );
}

function SleepTimeline({ detail, locale, messages }: { detail: SleepPeriodDetail; locale: Locale; messages: (typeof catalogs)["en-US"] }) {
  const copy = messages.sleep;
  if (detail.stageTransitions === null) return <section className="sleep-subdetail"><h3>{copy.timelineHeading}</h3><p>{copy.timelineUnavailable}</p></section>;
  const segments = timelineSegments(detail.stageTransitions, detail.spanMilliseconds);
  return (
    <section className="sleep-subdetail" aria-labelledby="sleep-timeline-heading">
      <h3 id="sleep-timeline-heading">{copy.timelineHeading}</h3>
      <div className="sleep-timeline" aria-hidden="true">{segments.map((transition, index) => <span key={`${transition.offsetMilliseconds}:${index}`} className={`stage-${transition.stage}`} style={{ width: transition.width }} />)}</div>
      <div className="sleep-table-scroll" tabIndex={0} aria-label={copy.timelineTable}>
        <table><caption className="sr-only">{copy.timelineTable}</caption><thead><tr><th scope="col">{copy.stageOffset}</th><th scope="col">{copy.stage}</th></tr></thead><tbody>{detail.stageTransitions.map((transition, index) => <tr key={`${transition.offsetMilliseconds}:${index}`}><td>{formatSleepDuration(transition.offsetMilliseconds, locale, copy.durationUnits, messages.unavailable)}</td><td>{copy.stages[transition.stage]}</td></tr>)}</tbody></table>
      </div>
    </section>
  );
}

function SleepScoreDetails({ detail, locale, messages }: { detail: SleepPeriodDetail; locale: Locale; messages: (typeof catalogs)["en-US"] }) {
  const copy = messages.sleep;
  if (detail.score === null) return <section className="sleep-subdetail"><h3>{copy.scoreHeading}</h3><p>{copy.scoreUnavailable}</p></section>;
  const score = detail.score;
  const values = [
    [copy.scoreComponents.overall, score.overall], [copy.scoreComponents.ownTargetDuration, score.ownTargetDuration],
    [copy.scoreComponents.recommendedDuration, score.recommendedDuration], [copy.scoreComponents.continuity, score.continuity],
    [copy.scoreComponents.efficiency, score.efficiency], [copy.scoreComponents.rem, score.rem],
    [copy.scoreComponents.deep, score.deep], [copy.scoreComponents.longInterruptions, score.longInterruptions],
    [copy.scoreComponents.duration, score.duration], [copy.scoreComponents.solidity, score.solidity],
    [copy.scoreComponents.regeneration, score.regeneration],
  ] as const;
  return (
    <section className="sleep-subdetail" aria-labelledby="sleep-score-heading">
      <h3 id="sleep-score-heading">{copy.scoreHeading}</h3>
      <dl className="sleep-score-grid">{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{formatDecimal(value, locale, messages.unavailable)}</dd></div>)}<div><dt>{copy.relativeRating}</dt><dd>{score.relativeRating === null ? messages.unavailable : `${new Intl.NumberFormat(locale).format(score.relativeRating)} / 5`}</dd></div></dl>
    </section>
  );
}
