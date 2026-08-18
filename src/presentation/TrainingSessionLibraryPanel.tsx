import { type FormEvent, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { type catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import {
  formatDistance,
  formatDuration,
  formatExactMetric,
  formatTrainingDateTime,
  formatUtcOffset,
} from "./training-format";
import type {
  TrainingMeasurementFilter,
  TrainingSessionSearchItem,
  TrainingSessionSearchPage,
  TrainingSessionSearchRequest,
  TrainingSessionSort,
} from "./training-session-search";
import type { TrainingSport, TrainingSportsOverview } from "./training-sports";

const PAGE_SIZE = 25;

interface TrainingSessionLibraryPanelProps {
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  refreshToken: number;
  initialDate?: string;
  onAvailableRange: (range: { from: string; through: string } | null) => void;
  onError: (code: string | undefined) => void;
}

interface SearchDraft {
  from: string;
  through: string;
  sportRefs: string[];
  requiredMeasurements: TrainingMeasurementFilter[];
  text: string;
  sort: TrainingSessionSort;
}

function emptyDraft(initialDate?: string): SearchDraft {
  return {
    from: initialDate ?? "",
    through: initialDate ?? "",
    sportRefs: [],
    requiredMeasurements: [],
    text: "",
    sort: "started-desc",
  };
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

function requestFor(
  draft: SearchDraft,
  offset: number,
  snapshotRef: string | null,
): TrainingSessionSearchRequest {
  return {
    from: draft.from || null,
    through: draft.through || null,
    sportRefs: draft.sportRefs,
    requiredMeasurements: draft.requiredMeasurements,
    text: draft.text.trim() || null,
    sort: draft.sort,
    offset,
    limit: PAGE_SIZE,
    snapshotRef,
  };
}

export function TrainingSessionLibraryPanel({
  locale,
  messages,
  refreshToken,
  initialDate,
  onAvailableRange,
  onError,
}: TrainingSessionLibraryPanelProps) {
  const [draft, setDraft] = useState<SearchDraft>(() => emptyDraft(initialDate));
  const [applied, setApplied] = useState<SearchDraft>(() => emptyDraft(initialDate));
  const [page, setPage] = useState<TrainingSessionSearchPage>();
  const [sports, setSports] = useState<TrainingSportsOverview>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<string>();
  const [selected, setSelected] = useState<TrainingSessionSearchItem>();
  const copy = messages.training.sessionLibrary;
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const textTooLong = [...draft.text.trim()].length > 80;

  async function query(
    criteria: SearchDraft,
    offset: number,
    snapshotRef: string | null,
  ): Promise<TrainingSessionSearchPage> {
    return invoke<TrainingSessionSearchPage>("query_training_sessions", {
      request: requestFor(criteria, offset, snapshotRef),
    });
  }

  useEffect(() => {
    let active = true;
    const nextDraft = emptyDraft(initialDate);
    setDraft(nextDraft);
    setApplied(nextDraft);
    setLoading(true);
    setFailed(false);
    setSelected(undefined);
    setStatus(undefined);
    Promise.allSettled([
      query(nextDraft, 0, null),
      invoke<TrainingSportsOverview>("query_training_sports"),
    ]).then(([pageResult, sportsResult]) => {
      if (!active) return;
      if (pageResult.status === "fulfilled") {
        setPage(pageResult.value);
        setFailed(false);
        onAvailableRange(pageResult.value.availableRange);
      } else {
        setPage(undefined);
        setFailed(true);
        onError(commandErrorCode(pageResult.reason));
      }
      if (sportsResult.status === "fulfilled") {
        setSports(sportsResult.value);
      } else {
        setSports(undefined);
        onError(commandErrorCode(sportsResult.reason));
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [refreshToken, initialDate, onAvailableRange, onError]);

  async function loadPage(
    criteria: SearchDraft,
    offset: number,
    snapshotRef: string | null,
  ) {
    setLoading(true);
    setStatus(undefined);
    setSelected(undefined);
    onError(undefined);
    try {
      const result = await query(criteria, offset, snapshotRef);
      setPage(result);
      setFailed(false);
      onAvailableRange(result.availableRange);
    } catch (reason) {
      const code = commandErrorCode(reason);
      if (code === "training-session-search-changed" && snapshotRef !== null) {
        try {
          const restarted = await query(criteria, 0, null);
          setPage(restarted);
          setFailed(false);
          setStatus(copy.libraryChanged);
          onAvailableRange(restarted.availableRange);
          return;
        } catch (restartReason) {
          setFailed(true);
          onError(commandErrorCode(restartReason));
          return;
        }
      }
      setFailed(true);
      onError(code);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((draft.from && draft.through && draft.from > draft.through) || textTooLong) {
      onError("invalid-training-session-search");
      return;
    }
    const canonical = { ...draft, text: draft.text.trim() };
    setDraft(canonical);
    setApplied(canonical);
    void loadPage(canonical, 0, null);
  }

  function clearFilters() {
    const cleared = emptyDraft();
    setDraft(cleared);
    setApplied(cleared);
    void loadPage(cleared, 0, null);
  }

  function toggleMeasurement(measurement: TrainingMeasurementFilter) {
    setDraft((current) => ({
      ...current,
      requiredMeasurements: current.requiredMeasurements.includes(measurement)
        ? current.requiredMeasurements.filter((candidate) => candidate !== measurement)
        : [...current.requiredMeasurements, measurement],
    }));
  }

  function toggleSport(sportRef: string) {
    setDraft((current) => ({
      ...current,
      sportRefs: current.sportRefs.includes(sportRef)
        ? current.sportRefs.filter((candidate) => candidate !== sportRef)
        : [...current.sportRefs, sportRef],
    }));
  }

  function sportTitle(sport: TrainingSport): string {
    if (sport.state === "unavailable") return copy.notRecorded;
    if (sport.classification?.displayLabel) return sport.classification.displayLabel;
    if (sport.classification?.canonicalFamily) {
      return messages.training.sports.families[sport.classification.canonicalFamily];
    }
    const unknownSports = sports?.sports.filter((candidate) => candidate.state === "unknown") ?? [];
    return interpolate(copy.unknownSport, {
      index: number.format(Math.max(unknownSports.indexOf(sport) + 1, 1)),
    });
  }

  function sessionSportTitle(session: TrainingSessionSearchItem): string {
    if (session.sport.state === "unavailable") return copy.notRecordedType;
    if (session.sport.classification?.displayLabel) {
      return session.sport.classification.displayLabel;
    }
    if (session.sport.classification?.canonicalFamily) {
      return messages.training.sports.families[session.sport.classification.canonicalFamily];
    }
    return session.sport.state === "unknown" ? copy.unknownType : copy.recordedType;
  }

  function coverageLabel(available: number, total: number): string {
    return `${number.format(available)} ${messages.training.of} ${number.format(total)}`;
  }

  const resultFrom = page && page.totalCount > 0 ? page.offset + 1 : 0;
  const resultThrough = page ? page.offset + page.sessions.length : 0;

  return (
    <section
      className="training-session-library"
      role="region"
      aria-labelledby="training-session-library-heading"
      aria-busy={loading}
    >
      <header>
        <h2 id="training-session-library-heading">{copy.heading}</h2>
        <p>{copy.intro}</p>
      </header>
      <form
        className="training-session-search"
        aria-labelledby="training-session-filter-heading"
        onSubmit={applyFilters}
      >
        <h3 id="training-session-filter-heading">{copy.filterHeading}</h3>
        <div className="training-session-search-fields">
          <label>
            <span>{copy.from}</span>
            <input
              type="date"
              min={page?.availableRange?.from}
              max={page?.availableRange?.through}
              value={draft.from}
              disabled={loading}
              onChange={(event) => setDraft({ ...draft, from: event.target.value })}
            />
          </label>
          <label>
            <span>{copy.through}</span>
            <input
              type="date"
              min={page?.availableRange?.from}
              max={page?.availableRange?.through}
              value={draft.through}
              disabled={loading}
              onChange={(event) => setDraft({ ...draft, through: event.target.value })}
            />
          </label>
          <label className="training-session-text-filter">
            <span>{copy.text}</span>
            <input
              value={draft.text}
              disabled={loading}
              aria-invalid={textTooLong}
              aria-describedby={textTooLong ? "training-search-text-help training-search-text-error" : "training-search-text-help"}
              onChange={(event) => setDraft({ ...draft, text: event.target.value })}
            />
            <small id="training-search-text-help">{copy.textHelp}</small>
            {textTooLong && <small id="training-search-text-error" role="alert">{copy.textTooLong}</small>}
          </label>
          <label>
            <span>{copy.sort}</span>
            <select
              value={draft.sort}
              disabled={loading}
              onChange={(event) => setDraft({
                ...draft,
                sort: event.target.value as TrainingSessionSort,
              })}
            >
              {Object.entries(copy.sortOptions).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
        {sports && sports.sports.some((sport) => sport.sportRef !== null) && (
          <fieldset className="training-session-filter-options">
            <legend>{copy.sports}</legend>
            {sports.sports.filter((sport) => sport.sportRef !== null).map((sport) => (
              <label key={sport.sportRef}>
                <input
                  type="checkbox"
                  checked={draft.sportRefs.includes(sport.sportRef!)}
                  disabled={loading}
                  onChange={() => toggleSport(sport.sportRef!)}
                />
                <span>{sportTitle(sport)}</span>
              </label>
            ))}
          </fieldset>
        )}
        <fieldset className="training-session-filter-options">
          <legend>{copy.measurements}</legend>
          {([
            ["distance", copy.distanceMeasurement],
            ["energy", copy.energyMeasurement],
            ["heart-rate", copy.heartRateMeasurement],
          ] as const).map(([value, label]) => (
            <label key={value}>
              <input
                type="checkbox"
                checked={draft.requiredMeasurements.includes(value)}
                disabled={loading}
                onChange={() => toggleMeasurement(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <div className="training-session-search-actions">
          <button type="button" className="secondary" disabled={loading} onClick={clearFilters}>
            {copy.clear}
          </button>
          <button type="submit" disabled={loading || textTooLong}>
            {loading ? copy.applying : copy.apply}
          </button>
        </div>
      </form>

      {status && <p className="notice" role="status">{status}</p>}
      {loading && !page ? (
        <p>{copy.loading}</p>
      ) : failed && !page ? (
        <p className="training-sessions-unavailable">{copy.unavailable}</p>
      ) : !page?.availableRange ? (
        <p>{copy.emptyLibrary}</p>
      ) : page.sessions.length === 0 ? (
        <p>{copy.emptyResults}</p>
      ) : (
        <>
          <div className="training-session-summaries">
            {page.summaries.map((summary) => {
              const sourceLabel = interpolate(copy.source, {
                index: number.format(summary.sourceIndex),
              });
              const summaryLabel = page.summaries.length === 1
                ? messages.training.summaryLabel
                : `${messages.training.summaryLabel} · ${sourceLabel}`;
              return (
                <section key={summary.sourceIndex}>
                  {page.summaries.length > 1 && <h3>{sourceLabel}</h3>}
                  <ul className="training-summary" aria-label={summaryLabel}>
                    <li>
                      <strong>
                        {number.format(summary.sessionCount)} {summary.sessionCount === 1
                          ? messages.training.sessionUnit.one
                          : messages.training.sessionUnit.other}
                      </strong>
                      <span>{messages.training.sessionCount}</span>
                    </li>
                    <li>
                      <strong>
                        {number.format(summary.trainingDays)} {summary.trainingDays === 1
                          ? messages.training.trainingDayUnit.one
                          : messages.training.trainingDayUnit.other}
                      </strong>
                      <span>{messages.training.trainingDays}</span>
                    </li>
                    <li>
                      <strong>{formatDuration(
                        summary.totalDurationMilliseconds,
                        locale,
                        messages.training.durationUnits,
                      )}</strong>
                      <span>{messages.training.totalDuration}</span>
                    </li>
                    <li>
                      <strong>{formatDistance(
                        summary.totalDistanceMeters,
                        locale,
                        messages.unavailable,
                        messages.training.units.meters,
                      )}</strong>
                      <span>
                        {messages.training.totalDistance} · {coverageLabel(
                          summary.distanceSessionCount,
                          summary.sessionCount,
                        )}
                      </span>
                    </li>
                    <li>
                      <strong>{formatExactMetric(
                        summary.totalEnergyKilocalories,
                        locale,
                        messages.unavailable,
                        messages.training.units.kilocalories,
                      )}</strong>
                      <span>
                        {messages.training.totalEnergy} · {coverageLabel(
                          summary.energySessionCount,
                          summary.sessionCount,
                        )}
                      </span>
                    </li>
                    <li>
                      <strong>{coverageLabel(
                        summary.heartRateSessionCount,
                        summary.sessionCount,
                      )}</strong>
                      <span>{messages.training.heartRateCoverage}</span>
                    </li>
                  </ul>
                </section>
              );
            })}
          </div>
          <p className="training-session-result-count" aria-live="polite">
            {interpolate(copy.results, {
              from: number.format(resultFrom),
              through: number.format(resultThrough),
              total: number.format(page.totalCount),
            })}
          </p>
          <ol className="training-session-results">
            {page.sessions.map((session) => (
              <li key={session.sessionRef}>
                <article>
                  <header>
                    <div>
                      <p className="training-session-sport">{sessionSportTitle(session)}</p>
                      <h3>
                        <time dateTime={session.startedAtLocal}>
                          {formatTrainingDateTime(session.startedAtLocal, locale)}
                        </time>
                      </h3>
                    </div>
                    <span>{interpolate(copy.source, {
                      index: number.format(session.sourceIndex),
                    })}</span>
                  </header>
                  <dl>
                    <div>
                      <dt>{messages.training.duration}</dt>
                      <dd>{formatDuration(
                        session.durationMilliseconds,
                        locale,
                        messages.training.durationUnits,
                      )}</dd>
                    </div>
                    <div>
                      <dt>{messages.training.distance}</dt>
                      <dd>{formatDistance(
                        session.distanceMeters,
                        locale,
                        copy.metricUnavailable,
                        messages.training.units.meters,
                      )}</dd>
                    </div>
                    <div>
                      <dt>{messages.training.energy}</dt>
                      <dd>{formatExactMetric(
                        session.energyKilocalories,
                        locale,
                        copy.metricUnavailable,
                        messages.training.units.kilocalories,
                      )}</dd>
                    </div>
                    <div>
                      <dt>{messages.training.averageHeartRate}</dt>
                      <dd>{formatExactMetric(
                        session.averageHeartRateBpm,
                        locale,
                        copy.metricUnavailable,
                        messages.training.units.beatsPerMinute,
                      )}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className="secondary"
                    aria-label={interpolate(copy.viewDetails, {
                      date: formatTrainingDateTime(session.startedAtLocal, locale),
                    })}
                    onClick={() => setSelected(session)}
                  >
                    {copy.details}
                  </button>
                </article>
              </li>
            ))}
          </ol>
          <nav className="training-session-pagination" aria-label={copy.pageStatus
            .replace("{from}", number.format(resultFrom))
            .replace("{through}", number.format(resultThrough))
            .replace("{total}", number.format(page.totalCount))}
          >
            <button
              type="button"
              className="secondary"
              disabled={loading || page.offset === 0}
              onClick={() => void loadPage(
                applied,
                Math.max(0, page.offset - page.limit),
                page.snapshotRef,
              )}
            >
              {copy.previous}
            </button>
            <span>{interpolate(copy.pageStatus, {
              from: number.format(resultFrom),
              through: number.format(resultThrough),
              total: number.format(page.totalCount),
            })}</span>
            <button
              type="button"
              className="secondary"
              disabled={loading || page.nextOffset === null}
              onClick={() => page.nextOffset !== null && void loadPage(
                applied,
                page.nextOffset,
                page.snapshotRef,
              )}
            >
              {copy.next}
            </button>
          </nav>
        </>
      )}

      {selected && (
        <section className="training-detail" aria-labelledby="training-session-detail-heading">
          <div className="training-detail-heading">
            <div>
              <h3 id="training-session-detail-heading">{copy.detailHeading}</h3>
              <time dateTime={selected.startedAtLocal}>
                {formatTrainingDateTime(selected.startedAtLocal, locale)}
              </time>
            </div>
            <button type="button" className="secondary" onClick={() => setSelected(undefined)}>
              {copy.closeDetail}
            </button>
          </div>
          <dl>
            <div><dt>{messages.training.trainingType}</dt><dd>{sessionSportTitle(selected)}</dd></div>
            <div><dt>{messages.training.startedAt}</dt><dd>{formatTrainingDateTime(selected.startedAtLocal, locale)}</dd></div>
            <div><dt>{messages.training.stoppedAt}</dt><dd>{formatTrainingDateTime(selected.stoppedAtLocal, locale)}</dd></div>
            <div><dt>{messages.training.utcOffset}</dt><dd>{formatUtcOffset(selected.utcOffsetMinutes, copy.metricUnavailable)}</dd></div>
            <div><dt>{messages.training.duration}</dt><dd>{formatDuration(selected.durationMilliseconds, locale, messages.training.durationUnits)}</dd></div>
            <div><dt>{messages.training.distance}</dt><dd>{formatDistance(selected.distanceMeters, locale, copy.metricUnavailable, messages.training.units.meters)}</dd></div>
            <div><dt>{messages.training.energy}</dt><dd>{formatExactMetric(selected.energyKilocalories, locale, copy.metricUnavailable, messages.training.units.kilocalories)}</dd></div>
            <div><dt>{messages.training.averageHeartRate}</dt><dd>{formatExactMetric(selected.averageHeartRateBpm, locale, copy.metricUnavailable, messages.training.units.beatsPerMinute)}</dd></div>
            <div><dt>{messages.training.maximumHeartRate}</dt><dd>{formatExactMetric(selected.maximumHeartRateBpm, locale, copy.metricUnavailable, messages.training.units.beatsPerMinute)}</dd></div>
            <div><dt>{messages.training.exerciseCount}</dt><dd>{selected.exerciseCount === null ? copy.metricUnavailable : number.format(selected.exerciseCount)}</dd></div>
          </dl>
        </section>
      )}
    </section>
  );
}
