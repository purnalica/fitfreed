import {
  type FormEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";

import { catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import { restoreFocusAfterReveal } from "./focus-restoration";
import { WorkspaceNavigation } from "./WorkspaceNavigation";
import { LongitudinalComparisonPanel } from "./LongitudinalComparisonPanel";
import { RangeFilterActions, type RangeOperation } from "./RangeFilterActions";
import { submissionOrigin } from "./submission-origin";
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
import {
  formatSummaryDuration,
  integerCountFormatter,
  mediumDateFormatter,
  pluralRules,
} from "./presentation-format";
import { useInvalidForm } from "./useInvalidForm";
import { useResultFocus } from "./useResultFocus";

type LongitudinalDomain = "activity" | "training" | "sleep" | "recovery";
type LongitudinalWorkspace = "history" | "comparison";

interface LongitudinalInsightsPanelProps {
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  refreshToken: number;
  onError: (code: string | undefined) => void;
  onNavigate: (
    domain: LongitudinalDomain,
    localDate: string,
    seriesRef: string,
  ) => void | Promise<void>;
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
  const [rangeOperation, setRangeOperation] = useState<RangeOperation>();
  const [selectedDay, setSelectedDay] = useState<SelectedDay>();
  const [navigationDomain, setNavigationDomain] = useState<LongitudinalDomain>();
  const [workspace, setWorkspace] = useState<LongitudinalWorkspace>("history");
  const [historyControlsOpen, setHistoryControlsOpen] = useState(false);
  const rangeValidation = useInvalidForm(onError);
  const initialAnswerPending = useRef(true);
  const overviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const detailOriginRef = useRef<HTMLButtonElement | null>(null);
  const number = useMemo(() => integerCountFormatter(locale), [locale]);
  const plural = useMemo(() => pluralRules(locale), [locale]);
  const date = useMemo(
    () => mediumDateFormatter(locale),
    [locale],
  );
  const copy = messages.longitudinal;
  const { resultHeadingRef: answerHeadingRef, requestResultFocus } =
    useResultFocus<HTMLHeadingElement>(
      overview !== undefined && workspace === "history" && selectedDay === undefined,
    );

  function answerDates(count: number): string {
    return copy.answerDates[plural.select(count) === "one" ? "one" : "other"]
      .replace("{count}", number.format(count));
  }

  function clearSelectedDay() {
    setSelectedDay(undefined);
    detailOriginRef.current = null;
  }

  function closeSelectedDay(initiatingElement: HTMLElement | null) {
    const target = detailOriginRef.current?.isConnected
      ? detailOriginRef.current
      : overviewHeadingRef.current;
    clearSelectedDay();
    restoreFocusAfterReveal(target, initiatingElement);
  }

  function acceptOverview(result: LongitudinalOverview) {
    const focusInitialAnswer =
      initialAnswerPending.current && result.series.length > 0 && result.selectedRange !== null;
    initialAnswerPending.current = false;
    setOverview(result);
    setRangeFrom(result.selectedRange?.from ?? "");
    setRangeThrough(result.selectedRange?.through ?? "");
    setHistoryControlsOpen(false);
    clearSelectedDay();
    if (focusInitialAnswer) requestResultFocus();
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

  async function openDomain(
    event: MouseEvent<HTMLAnchorElement>,
    domain: LongitudinalDomain,
    localDate: string,
    seriesRef: string,
  ) {
    event.preventDefault();
    if (navigationDomain) return;
    setNavigationDomain(domain);
    try {
      await onNavigate(domain, localDate, seriesRef);
    } catch (reason) {
      onError(commandErrorCode(reason));
    } finally {
      setNavigationDomain(undefined);
    }
  }

  function selected(): { series: LongitudinalSeriesOverview; day: LongitudinalDayInsight; index: number } | undefined {
    if (!selectedDay || !overview) return undefined;
    const index = overview.series.findIndex((series) => series.seriesRef === selectedDay.seriesRef);
    const series = overview.series[index];
    const day = series?.days.find((candidate) => candidate.localDate === selectedDay.localDate);
    return series && day ? { series, day, index } : undefined;
  }

  const selectedInsight = selected();
  const loadingRange = rangeOperation !== undefined;

  useEffect(() => {
    if (!selectedDay) return;
    return restoreFocusAfterReveal(detailHeadingRef.current, detailOriginRef.current, {
      align: "start",
    });
  }, [selectedDay]);

  function selectDay(
    seriesRef: string,
    localDate: string,
    origin: HTMLButtonElement,
  ) {
    detailOriginRef.current = origin;
    setWorkspace("history");
    setSelectedDay({ seriesRef, localDate });
  }

  return (
    <section
      className="longitudinal-insights"
      aria-labelledby="longitudinal-heading"
      aria-busy={loadingOverview}
    >
      <header className="explorer-workspace-heading">
        <p className="eyebrow">{copy.workspaceEyebrow}</p>
        <h1 id="longitudinal-heading" ref={overviewHeadingRef} tabIndex={-1}>
          {copy.heading}
        </h1>
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
            hidden={workspace !== "history" || selectedInsight !== undefined}
          >
          {overview.selectedRange && (
            <section
              className="longitudinal-answer answer-canvas"
              aria-label={copy.answerLabel}
            >
              <header className="longitudinal-answer-heading">
                <h2 ref={answerHeadingRef} tabIndex={-1}>
                  {overview.series.length === 1
                    ? answerDates(overview.series[0].days.length)
                    : copy.answerMultiple.replace(
                      "{count}",
                      number.format(overview.series.length),
                    )}
                </h2>
                <p>
                  <strong>{copy.selectedRange}:</strong>{" "}
                  {rangeLabel(overview.selectedRange)}
                </p>
              </header>
              <p className="notice longitudinal-association-notice">
                {copy.associationNotice}
              </p>
              {overview.series.map((series, seriesIndex) => (
                <LongitudinalSeries
                  key={series.seriesRef}
                  series={series}
                  seriesIndex={seriesIndex}
                  seriesCount={overview.series.length}
                  answerHeading={answerDates(series.days.length)}
                  locale={locale}
                  messages={messages}
                  date={date}
                  number={number}
                  coverage={coverage}
                  formatSteps={formatSteps}
                  activityStatus={activityStatus}
                  onSelect={(localDate, origin) => selectDay(
                    series.seriesRef,
                    localDate,
                    origin,
                  )}
                />
              ))}
            </section>
          )}
          {overview.availableRange && overview.selectedRange && (
            <details
              className="answer-controls"
              open={historyControlsOpen}
              onToggle={(event) => setHistoryControlsOpen(event.currentTarget.open)}
            >
              <summary>{copy.changePeriod}</summary>
              {historyControlsOpen && <form
                className="longitudinal-filter"
                aria-labelledby="longitudinal-filter-heading"
                aria-busy={loadingRange}
                onSubmit={(event) => void applyRange(event)}
              >
                <div>
                  <h2 id="longitudinal-filter-heading">{copy.filterHeading}</h2>
                  <p>{copy.rangeHelp}</p>
                  <p>
                    <strong>{copy.availableRange}:</strong>{" "}
                    {rangeLabel(overview.availableRange)}
                  </p>
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
                  className="longitudinal-filter-actions"
                  operation={rangeOperation}
                  applyLabel={copy.applyRange}
                  applyingLabel={copy.applyingRange}
                  resetLabel={copy.latestWindow}
                  resettingLabel={copy.loadingLatestWindow}
                  onReset={(initiatingElement) => void resetRange(initiatingElement)}
                />
              </form>
              }
            </details>
          )}
          </div>
          <div className="explorer-detail-workspace" hidden={workspace !== "history"}>
          {selectedInsight && (
            <section
              className="longitudinal-detail"
              aria-labelledby="longitudinal-detail-heading"
              aria-busy={navigationDomain !== undefined}
            >
              <div className="longitudinal-detail-heading">
                <div>
                  <h2
                    id="longitudinal-detail-heading"
                    ref={detailHeadingRef}
                    tabIndex={-1}
                  >
                    {copy.detailHeading}
                  </h2>
                  <time dateTime={selectedInsight.day.localDate}>
                    {date.format(recoveryLocalDate(selectedInsight.day.localDate))}
                  </time>
                  {overview.series.length > 1 && (
                    <span> · {copy.series} {number.format(selectedInsight.index + 1)}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="secondary"
                  disabled={navigationDomain !== undefined}
                  onClick={(event) => closeSelectedDay(event.currentTarget)}
                >
                  {copy.closeDetail}
                </button>
              </div>
              <dl className="longitudinal-detail-grid">
                <div><dt>{copy.activityAvailability}</dt><dd>{activityStatus(selectedInsight.day)}</dd></div>
                <div><dt>{copy.steps}</dt><dd>{formatSteps(selectedInsight.day.activity.stepCount)}</dd></div>
                <div><dt>{copy.trainingSessions}</dt><dd>{number.format(selectedInsight.day.training.sessionCount)}</dd></div>
                <div><dt>{copy.trainingDuration}</dt><dd>{formatSummaryDuration(selectedInsight.day.training.totalDurationMilliseconds, locale, messages.training.durationUnits)}</dd></div>
                <div><dt>{copy.sleepAvailability}</dt><dd>{selectedInsight.day.sleep.availability === "available" ? copy.available : copy.missing}</dd></div>
                <div><dt>{copy.sleepDuration}</dt><dd>{formatSleepDuration(selectedInsight.day.sleep.asleepMilliseconds, locale, messages.training.durationUnits, messages.unavailable)}</dd></div>
                <div><dt>{copy.recoveryAvailability}</dt><dd>{selectedInsight.day.recovery.availability === "available" ? copy.available : copy.missing}</dd></div>
                <div><dt>{copy.recoveryInterval}</dt><dd>{formatRecoveryMilliseconds(selectedInsight.day.recovery.beatToBeatIntervalMilliseconds, locale, messages.unavailable)}</dd></div>
                <div><dt>{copy.rmssd}</dt><dd>{formatRecoveryMilliseconds(selectedInsight.day.recovery.heartRateVariabilityRmssdMilliseconds, locale, messages.unavailable)}</dd></div>
                <div><dt>{copy.breathingInterval}</dt><dd>{formatRecoveryMilliseconds(selectedInsight.day.recovery.breathingIntervalMilliseconds, locale, messages.unavailable)}</dd></div>
              </dl>
              <nav
                className="longitudinal-detail-links"
                aria-label={copy.detailHeading}
                aria-busy={navigationDomain !== undefined}
              >
                {selectedInsight.day.activity.availability !== "missing" && (
                  <a href="#activity-heading" aria-disabled={navigationDomain !== undefined} onClick={(event) => void openDomain(event, "activity", selectedInsight.day.localDate, selectedInsight.series.seriesRef)}>{copy.openActivity}</a>
                )}
                {selectedInsight.day.training.sessionCount > 0 && (
                  <a href="#training-heading" aria-disabled={navigationDomain !== undefined} onClick={(event) => void openDomain(event, "training", selectedInsight.day.localDate, selectedInsight.series.seriesRef)}>{copy.openTraining}</a>
                )}
                {selectedInsight.day.sleep.availability === "available" && (
                  <a href="#sleep-heading" aria-disabled={navigationDomain !== undefined} onClick={(event) => void openDomain(event, "sleep", selectedInsight.day.localDate, selectedInsight.series.seriesRef)}>{copy.openSleep}</a>
                )}
                {selectedInsight.day.recovery.availability === "available" && (
                  <a href="#recovery-heading" aria-disabled={navigationDomain !== undefined} onClick={(event) => void openDomain(event, "recovery", selectedInsight.day.localDate, selectedInsight.series.seriesRef)}>{copy.openRecovery}</a>
                )}
                {navigationDomain && (
                  <span className="progress-submit-status" role="status" aria-live="polite">
                    {messages.home.opening[navigationDomain]}
                  </span>
                )}
              </nav>
              <p className="notice">{copy.associationNotice}</p>
            </section>
          )}
          </div>
          <div className="explorer-comparison-workspace" hidden={workspace !== "comparison"}>
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
          </div>
        </>
      )}
    </section>
  );
}

function LongitudinalSeries({
  series,
  seriesIndex,
  seriesCount,
  answerHeading,
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
  answerHeading: string;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  date: Intl.DateTimeFormat;
  number: Intl.NumberFormat;
  coverage: (observed: number, calendarDays: number) => string;
  formatSteps: (value: string | null) => string;
  activityStatus: (day: LongitudinalDayInsight) => string;
  onSelect: (localDate: string, origin: HTMLButtonElement) => void;
}) {
  const copy = messages.longitudinal;
  const [exactOpen, setExactOpen] = useState(false);
  const maxima = {
    activity: maximum(series.days.map((day) => day.activity.stepCount)),
    training: maximum(series.days.map((day) => day.training.totalDurationMilliseconds)),
    sleep: maximum(series.days.map((day) => day.sleep.asleepMilliseconds)),
    recovery: maximum(series.days.map((day) => day.recovery.beatToBeatIntervalMilliseconds)),
  };

  return (
    <section className="longitudinal-series">
      {seriesCount > 1 && (
        <div className="answer-series-heading">
          <p>{copy.series} {number.format(seriesIndex + 1)}</p>
          <h3>{answerHeading}</h3>
        </div>
      )}
      <figure className="longitudinal-answer-visual">
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
      <details
        className="answer-exact-values longitudinal-exact-evidence"
        open={exactOpen}
        onToggle={(event) => setExactOpen(event.currentTarget.open)}
      >
        <summary>{copy.answerExact}</summary>
        {exactOpen && (
          <>
            <ul className="longitudinal-summary" aria-label={copy.summaryLabel}>
              <li><span>{copy.activity}</span><strong>{formatSteps(series.activity.totalStepCount)}</strong><small>{copy.totalSteps} · {coverage(series.activity.observedDays, series.activity.calendarDays)}</small></li>
              <li><span>{copy.training}</span><strong>{number.format(series.training.sessionCount)}</strong><small>{copy.sessions} · {number.format(series.training.trainingDays)} · {copy.trainingDays}</small></li>
              <li><span>{copy.sleep}</span><strong>{formatSleepDuration(series.sleep.averageAsleepMilliseconds, locale, messages.training.durationUnits, messages.unavailable)}</strong><small>{copy.averageSleep} · {coverage(series.sleep.observedNights, series.sleep.calendarDays)}</small></li>
              <li><span>{copy.recovery}</span><strong>{formatRecoveryMilliseconds(series.recovery.averageBeatToBeatIntervalMilliseconds, locale, messages.unavailable)}</strong><small>{copy.averageRecovery} · {coverage(series.recovery.observedNights, series.recovery.calendarDays)}</small></li>
            </ul>
            <div className="longitudinal-table-scroll" tabIndex={0}>
              <table aria-label={copy.exactTable}>
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
                      <td>{formatSummaryDuration(day.training.totalDurationMilliseconds, locale, messages.training.durationUnits)}</td>
                      <td>{formatSleepDuration(day.sleep.asleepMilliseconds, locale, messages.training.durationUnits, copy.missing)}</td>
                      <td>{formatRecoveryMilliseconds(day.recovery.beatToBeatIntervalMilliseconds, locale, copy.missing)}</td>
                      <td>
                        <button
                          type="button"
                          className="detail-button"
                          aria-label={`${copy.viewDay} ${date.format(recoveryLocalDate(day.localDate))}`}
                          onClick={(event) => onSelect(day.localDate, event.currentTarget)}
                        >
                          {copy.details}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </details>
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
    <span className={`longitudinal-lane${value === null ? " missing" : ""}`}>
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
