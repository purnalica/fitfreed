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
  TrainingDiscoveryWorkspace,
  TrainingMeasurementFilter,
  TrainingSessionCalendar,
  TrainingSessionCalendarRequest,
  TrainingSessionSearchItem,
  TrainingSessionSearchPage,
  TrainingSessionSearchRequest,
  TrainingSessionSelection,
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

type SessionView = "chronology" | "calendar";

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

function draftFromWorkspace(workspace: TrainingDiscoveryWorkspace): SearchDraft {
  return {
    from: workspace.from ?? "",
    through: workspace.through ?? "",
    sportRefs: workspace.sportRefs,
    requiredMeasurements: workspace.requiredMeasurements,
    text: workspace.text ?? "",
    sort: workspace.sort,
  };
}

function criteriaForCalendarDay(draft: SearchDraft, localDate: string | null): SearchDraft {
  return localDate ? { ...draft, from: localDate, through: localDate } : draft;
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

function calendarRequestFor(
  draft: SearchDraft,
  month: string,
  snapshotRef: string | null,
): TrainingSessionCalendarRequest {
  return {
    month,
    from: draft.from || null,
    through: draft.through || null,
    sportRefs: draft.sportRefs,
    requiredMeasurements: draft.requiredMeasurements,
    text: draft.text.trim() || null,
    snapshotRef,
  };
}

function shiftMonth(month: string, delta: number): string {
  const value = new Date(`${month}-01T00:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + delta);
  return value.toISOString().slice(0, 7);
}

function monthInsideCriteria(
  month: string,
  draft: SearchDraft,
  availableRange: { from: string; through: string },
): string {
  const earliestMonth = (draft.from || availableRange.from).slice(0, 7);
  const latestMonth = (draft.through || availableRange.through).slice(0, 7);
  const requestedMonth = month || latestMonth;
  return requestedMonth < earliestMonth
    ? earliestMonth
    : requestedMonth > latestMonth ? latestMonth : requestedMonth;
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
  const [pageCriteria, setPageCriteria] = useState<SearchDraft>(() => emptyDraft(initialDate));
  const [page, setPage] = useState<TrainingSessionSearchPage>();
  const [view, setView] = useState<SessionView>("chronology");
  const [calendarMonth, setCalendarMonth] = useState(() => (initialDate ?? "").slice(0, 7));
  const [calendar, setCalendar] = useState<TrainingSessionCalendar>();
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string>();
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [sports, setSports] = useState<TrainingSportsOverview>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<string>();
  const [selected, setSelected] = useState<TrainingSessionSearchItem>();
  const [detailOrigin, setDetailOrigin] = useState<SessionView>("chronology");
  const [comparison, setComparison] = useState<TrainingSessionSearchItem[]>([]);
  const copy = messages.training.sessionLibrary;
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const calendarDate = useMemo(() => new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }), [locale]);
  const monthName = useMemo(() => new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }), [locale]);
  const weekdayName = useMemo(() => new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  }), [locale]);
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
    setWorkspaceReady(false);
    setLoading(true);
    setFailed(false);
    setStatus(undefined);
    onError(undefined);

    void (async () => {
      const [sportsResult, workspaceResult] = await Promise.allSettled([
        invoke<TrainingSportsOverview>("query_training_sports"),
        initialDate
          ? Promise.resolve(null)
          : invoke<TrainingDiscoveryWorkspace | null>("load_training_discovery_workspace"),
      ]);
      if (!active) return;
      if (sportsResult.status === "fulfilled") {
        setSports(sportsResult.value);
      } else {
        setSports(undefined);
        onError(commandErrorCode(sportsResult.reason));
      }
      const restored = workspaceResult.status === "fulfilled" ? workspaceResult.value : null;
      if (workspaceResult.status === "rejected") {
        onError(commandErrorCode(workspaceResult.reason));
      }
      const nextDraft = restored ? draftFromWorkspace(restored) : emptyDraft(initialDate);
      const nextView = restored?.view ?? "chronology";
      let nextCalendarDay = restored?.calendarDay ?? null;
      let nextPageCriteria = criteriaForCalendarDay(nextDraft, nextCalendarDay);
      let snapshotRef = restored?.snapshotRef ?? null;
      let offset = restored?.offset ?? 0;
      let snapshotChanged = false;
      let nextPage: TrainingSessionSearchPage;
      try {
        nextPage = await query(nextPageCriteria, offset, snapshotRef);
      } catch (reason) {
        if (commandErrorCode(reason) !== "training-session-search-changed" || snapshotRef === null) {
          throw reason;
        }
        snapshotChanged = true;
        snapshotRef = null;
        offset = 0;
        nextPage = await query(nextPageCriteria, offset, null);
      }
      if (!active) return;

      let nextMonth = restored?.calendarMonth
        ?? (initialDate ?? nextPage.availableRange?.through ?? "").slice(0, 7);
      if (nextView === "calendar" && nextPage.availableRange) {
        nextMonth = monthInsideCriteria(nextMonth, nextDraft, nextPage.availableRange);
        if (nextCalendarDay && !nextCalendarDay.startsWith(`${nextMonth}-`)) {
          nextCalendarDay = null;
          nextPageCriteria = nextDraft;
          offset = 0;
          nextPage = await query(nextDraft, 0, nextPage.snapshotRef);
        }
      }

      let nextCalendar: TrainingSessionCalendar | undefined;
      if (nextView === "calendar" && nextMonth) {
        try {
          nextCalendar = await invoke<TrainingSessionCalendar>("query_training_session_calendar", {
            request: calendarRequestFor(nextDraft, nextMonth, nextPage.snapshotRef),
          });
        } catch (reason) {
          if (commandErrorCode(reason) !== "training-session-search-changed") throw reason;
          snapshotChanged = true;
          offset = 0;
          nextPage = await query(nextPageCriteria, 0, null);
          nextCalendar = await invoke<TrainingSessionCalendar>(
            "query_training_session_calendar",
            { request: calendarRequestFor(nextDraft, nextMonth, nextPage.snapshotRef) },
          );
        }
      }

      let nextComparison: TrainingSessionSearchItem[] = [];
      let nextSelected: TrainingSessionSearchItem | undefined;
      if (restored && !snapshotChanged) {
        const sessionRefs = [...restored.selectedSessionRefs];
        if (restored.openSessionRef && !sessionRefs.includes(restored.openSessionRef)) {
          sessionRefs.push(restored.openSessionRef);
        }
        if (sessionRefs.length > 0) {
          try {
            const selection = await invoke<TrainingSessionSelection>(
              "query_training_session_selection",
              { request: { sessionRefs, snapshotRef: nextPage.snapshotRef } },
            );
            const sessionsByRef = new Map(selection.sessions.map(
              (session) => [session.sessionRef, session],
            ));
            nextComparison = restored.selectedSessionRefs.flatMap(
              (sessionRef) => sessionsByRef.get(sessionRef) ?? [],
            );
            nextSelected = restored.openSessionRef
              ? sessionsByRef.get(restored.openSessionRef)
              : undefined;
          } catch (reason) {
            if (commandErrorCode(reason) === "training-session-search-changed") {
              snapshotChanged = true;
            } else {
              onError(commandErrorCode(reason));
            }
          }
        }
      }
      if (!active) return;
      setDraft(nextDraft);
      setApplied(nextDraft);
      setPageCriteria(nextPageCriteria);
      setPage(nextPage);
      setView(nextView);
      setCalendarMonth(nextMonth);
      setCalendar(nextCalendar);
      setSelectedCalendarDay(nextCalendarDay ?? undefined);
      setSelected(nextSelected);
      setDetailOrigin(nextView);
      setComparison(nextComparison);
      setFailed(false);
      setStatus(snapshotChanged ? copy.libraryChanged : undefined);
      onAvailableRange(nextPage.availableRange);
    })().catch((reason) => {
      if (!active) return;
      setPage(undefined);
      setCalendar(undefined);
      setSelected(undefined);
      setComparison([]);
      setFailed(true);
      onError(commandErrorCode(reason));
    }).finally(() => {
      if (!active) return;
      setLoading(false);
      setWorkspaceReady(true);
    });
    return () => {
      active = false;
    };
  }, [refreshToken, initialDate, onAvailableRange, onError]);

  useEffect(() => {
    if (!workspaceReady || !page || failed || loading || calendarLoading) return;
    const workspace: TrainingDiscoveryWorkspace = {
      version: 1,
      snapshotRef: page.snapshotRef,
      from: applied.from || null,
      through: applied.through || null,
      sportRefs: applied.sportRefs,
      requiredMeasurements: applied.requiredMeasurements,
      text: applied.text.trim() || null,
      sort: applied.sort,
      offset: page.offset,
      limit: page.limit,
      view,
      calendarMonth: view === "calendar" ? calendarMonth : null,
      calendarDay: view === "calendar" ? selectedCalendarDay ?? null : null,
      selectedSessionRefs: comparison.map((session) => session.sessionRef),
      openSessionRef: selected?.sessionRef ?? null,
    };
    const timer = window.setTimeout(() => {
      void invoke("save_training_discovery_workspace", { workspace })
        .catch((reason) => onError(commandErrorCode(reason)));
    }, 150);
    return () => window.clearTimeout(timer);
  }, [
    applied,
    calendarLoading,
    calendarMonth,
    comparison,
    failed,
    loading,
    onError,
    page,
    selected,
    selectedCalendarDay,
    view,
    workspaceReady,
  ]);

  async function loadPage(
    criteria: SearchDraft,
    offset: number,
    snapshotRef: string | null,
  ): Promise<TrainingSessionSearchPage | undefined> {
    setLoading(true);
    setStatus(undefined);
    setSelected(undefined);
    onError(undefined);
    try {
      const result = await query(criteria, offset, snapshotRef);
      setPage(result);
      setPageCriteria(criteria);
      setFailed(false);
      onAvailableRange(result.availableRange);
      return result;
    } catch (reason) {
      const code = commandErrorCode(reason);
      if (code === "training-session-search-changed" && snapshotRef !== null) {
        try {
          const restarted = await query(criteria, 0, null);
          setPage(restarted);
          setPageCriteria(criteria);
          setComparison([]);
          setFailed(false);
          setStatus(copy.libraryChanged);
          onAvailableRange(restarted.availableRange);
          return restarted;
        } catch (restartReason) {
          setFailed(true);
          onError(commandErrorCode(restartReason));
          return undefined;
        }
      }
      setFailed(true);
      onError(code);
      return undefined;
    } finally {
      setLoading(false);
    }
  }

  async function loadCalendar(
    criteria: SearchDraft,
    month: string,
    snapshotRef: string | null,
  ): Promise<TrainingSessionCalendar | undefined> {
    setCalendarLoading(true);
    setStatus(undefined);
    onError(undefined);
    try {
      const result = await invoke<TrainingSessionCalendar>("query_training_session_calendar", {
        request: calendarRequestFor(criteria, month, snapshotRef),
      });
      setCalendar(result);
      setCalendarMonth(result.month);
      return result;
    } catch (reason) {
      const code = commandErrorCode(reason);
      if (code === "training-session-search-changed" && snapshotRef !== null) {
        const restarted = await loadPage(criteria, 0, null);
        if (!restarted) return undefined;
        try {
          const result = await invoke<TrainingSessionCalendar>(
            "query_training_session_calendar",
            { request: calendarRequestFor(criteria, month, restarted.snapshotRef) },
          );
          setCalendar(result);
          setCalendarMonth(result.month);
          setStatus(copy.libraryChanged);
          return result;
        } catch (restartReason) {
          onError(commandErrorCode(restartReason));
          return undefined;
        }
      }
      onError(code);
      return undefined;
    } finally {
      setCalendarLoading(false);
    }
  }

  async function loadAppliedCriteria(criteria: SearchDraft) {
    const result = await loadPage(criteria, 0, null);
    if (view === "calendar" && result?.availableRange) {
      const month = monthInsideCriteria(calendarMonth, criteria, result.availableRange);
      await loadCalendar(criteria, month, result.snapshotRef);
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
    setSelectedCalendarDay(undefined);
    void loadAppliedCriteria(canonical);
  }

  function clearFilters() {
    const cleared = emptyDraft();
    setDraft(cleared);
    setApplied(cleared);
    setSelectedCalendarDay(undefined);
    void loadAppliedCriteria(cleared);
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

  function selectView(next: SessionView) {
    setView(next);
    setSelected(undefined);
    const previousDay = selectedCalendarDay;
    setSelectedCalendarDay(undefined);
    if (next === "calendar" && page?.availableRange) {
      const month = monthInsideCriteria(calendarMonth, applied, page.availableRange);
      void loadCalendar(applied, month, page.snapshotRef);
    } else if (next === "chronology" && previousDay && page) {
      void loadPage(applied, 0, page.snapshotRef);
    }
  }

  function navigateMonth(delta: number) {
    const next = shiftMonth(calendarMonth, delta);
    const previousDay = selectedCalendarDay;
    setSelectedCalendarDay(undefined);
    const snapshotRef = calendar?.snapshotRef ?? page?.snapshotRef ?? null;
    void (async () => {
      const restoredPage = previousDay ? await loadPage(applied, 0, snapshotRef) : page;
      await loadCalendar(applied, next, restoredPage?.snapshotRef ?? snapshotRef);
    })();
  }

  function openCalendarDay(localDate: string) {
    const criteria = { ...applied, from: localDate, through: localDate };
    setSelectedCalendarDay(localDate);
    void loadPage(criteria, 0, null);
  }

  function toggleComparison(session: TrainingSessionSearchItem) {
    setComparison((current) => current.some(
      (candidate) => candidate.sessionRef === session.sessionRef,
    )
      ? current.filter((candidate) => candidate.sessionRef !== session.sessionRef)
      : current.length < 4 ? [...current, session] : current);
  }

  function openDetail(session: TrainingSessionSearchItem) {
    setDetailOrigin(view);
    setSelected(session);
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

  function sessionUnit(count: number): string {
    return count === 1
      ? messages.training.sessionUnit.one
      : messages.training.sessionUnit.other;
  }

  const resultFrom = page && page.totalCount > 0 ? page.offset + 1 : 0;
  const resultThrough = page ? page.offset + page.sessions.length : 0;
  const calendarBounds = page?.availableRange ? {
    from: applied.from || page.availableRange.from,
    through: applied.through || page.availableRange.through,
  } : undefined;
  const monthStart = calendarMonth ? new Date(`${calendarMonth}-01T00:00:00Z`) : undefined;
  const calendarDayCount = monthStart
    ? new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate()
    : 0;
  const calendarLeadingDays = monthStart ? (monthStart.getUTCDay() + 6) % 7 : 0;
  const calendarCells = Array.from(
    { length: calendarLeadingDays + calendarDayCount },
    (_, index) => index < calendarLeadingDays ? null : index - calendarLeadingDays + 1,
  );
  const weekdays = Array.from({ length: 7 }, (_, index) => weekdayName.format(
    new Date(Date.UTC(2026, 7, 17 + index)),
  ));

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

      {page?.availableRange && (
        <fieldset className="training-session-view-switch">
          <legend>{copy.viewLabel}</legend>
          <label>
            <input
              type="radio"
              name="training-session-view"
              checked={view === "chronology"}
              onChange={() => selectView("chronology")}
            />
            <span>{copy.chronology}</span>
          </label>
          <label>
            <input
              type="radio"
              name="training-session-view"
              checked={view === "calendar"}
              onChange={() => selectView("calendar")}
            />
            <span>{copy.calendar}</span>
          </label>
        </fieldset>
      )}

      {status && <p className="notice" role="status">{status}</p>}
      {loading && !page ? (
        <p>{copy.loading}</p>
      ) : failed && !page ? (
        <p className="training-sessions-unavailable">{copy.unavailable}</p>
      ) : !page?.availableRange ? (
        <p>{copy.emptyLibrary}</p>
      ) : page.sessions.length === 0 && view === "chronology" ? (
        <p>{copy.emptyResults}</p>
      ) : (
        <>
          {view === "calendar" && calendarMonth && (
            <section className="training-calendar" aria-busy={calendarLoading}>
              <header>
                <button
                  type="button"
                  className="secondary"
                  aria-label={copy.previousMonth}
                  disabled={calendarLoading
                    || !calendarBounds
                    || calendarMonth <= calendarBounds.from.slice(0, 7)}
                  onClick={() => navigateMonth(-1)}
                >
                  <span aria-hidden="true">←</span>
                </button>
                <h3>{monthName.format(new Date(`${calendarMonth}-01T00:00:00Z`))}</h3>
                <button
                  type="button"
                  className="secondary"
                  aria-label={copy.nextMonth}
                  disabled={calendarLoading
                    || !calendarBounds
                    || calendarMonth >= calendarBounds.through.slice(0, 7)}
                  onClick={() => navigateMonth(1)}
                >
                  <span aria-hidden="true">→</span>
                </button>
              </header>
              <ol className="training-calendar-grid">
                {weekdays.map((weekday, index) => (
                  <li className="training-calendar-weekday" aria-hidden="true" key={`${weekday}-${index}`}>
                    {weekday}
                  </li>
                ))}
                {calendarCells.map((day, index) => {
                  if (day === null) {
                    return <li className="training-calendar-empty-cell" aria-hidden="true" key={`empty-${index}`} />;
                  }
                  const localDate = `${calendarMonth}-${String(day).padStart(2, "0")}`;
                  const entries = calendar?.days.filter(
                    (candidate) => candidate.localDate === localDate,
                  ) ?? [];
                  const count = entries.reduce((total, entry) => total + entry.sessionCount, 0);
                  const formattedDate = calendarDate.format(new Date(`${localDate}T00:00:00Z`));
                  return (
                    <li key={localDate}>
                      {count === 0 ? (
                        <span><span>{number.format(day)}</span></span>
                      ) : (
                        <button
                          type="button"
                          className={selectedCalendarDay === localDate ? "selected" : undefined}
                          aria-label={interpolate(copy.calendarDay, {
                            date: formattedDate,
                            count: number.format(count),
                            unit: sessionUnit(count),
                          })}
                          aria-pressed={selectedCalendarDay === localDate}
                          onClick={() => openCalendarDay(localDate)}
                        >
                          <span>{number.format(day)}</span>
                          <strong>{number.format(count)}</strong>
                          <small>{entries.map((entry) => interpolate(copy.source, {
                            index: number.format(entry.sourceIndex),
                          })).join(" · ")}</small>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
              {!calendarLoading && calendar?.days.length === 0 && <p>{copy.calendarEmpty}</p>}
            </section>
          )}
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
                  <div className="training-session-result-actions">
                    <label>
                      <input
                        type="checkbox"
                        checked={comparison.some(
                          (candidate) => candidate.sessionRef === session.sessionRef,
                        )}
                        disabled={comparison.length >= 4 && !comparison.some(
                          (candidate) => candidate.sessionRef === session.sessionRef,
                        )}
                        aria-label={interpolate(
                          comparison.some(
                            (candidate) => candidate.sessionRef === session.sessionRef,
                          ) ? copy.removeFromComparison : copy.addToComparison,
                          { date: formatTrainingDateTime(session.startedAtLocal, locale) },
                        )}
                        onChange={() => toggleComparison(session)}
                      />
                      <span>{copy.comparisonHeading}</span>
                    </label>
                    <button
                      type="button"
                      className="secondary"
                      aria-label={interpolate(copy.viewDetails, {
                        date: formatTrainingDateTime(session.startedAtLocal, locale),
                      })}
                      onClick={() => openDetail(session)}
                    >
                      {copy.details}
                    </button>
                  </div>
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
                pageCriteria,
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
                pageCriteria,
                page.nextOffset,
                page.snapshotRef,
              )}
            >
              {copy.next}
            </button>
          </nav>
          {comparison.length > 0 && (
            <section
              className="training-session-comparison"
              role="region"
              aria-labelledby="training-session-comparison-heading"
            >
              <header>
                <div>
                  <h3 id="training-session-comparison-heading">{copy.comparisonHeading}</h3>
                  <p>{copy.comparisonIntro}</p>
                </div>
                <button type="button" className="secondary" onClick={() => setComparison([])}>
                  {copy.clearComparison}
                </button>
              </header>
              <p>{interpolate(copy.comparisonSelected, {
                count: number.format(comparison.length),
                unit: sessionUnit(comparison.length),
              })}</p>
              {comparison.length >= 2 && (
                <div className="training-session-comparison-table">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{copy.comparisonSession}</th>
                        {comparison.map((session) => (
                          <th scope="col" key={session.sessionRef}>
                            {formatTrainingDateTime(session.startedAtLocal, locale)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row">{messages.training.duration}</th>
                        {comparison.map((session) => <td key={session.sessionRef}>{formatDuration(
                          session.durationMilliseconds,
                          locale,
                          messages.training.durationUnits,
                        )}</td>)}
                      </tr>
                      <tr>
                        <th scope="row">{messages.training.distance}</th>
                        {comparison.map((session) => <td key={session.sessionRef}>{formatDistance(
                          session.distanceMeters,
                          locale,
                          copy.metricUnavailable,
                          messages.training.units.meters,
                        )}</td>)}
                      </tr>
                      <tr>
                        <th scope="row">{messages.training.energy}</th>
                        {comparison.map((session) => <td key={session.sessionRef}>{formatExactMetric(
                          session.energyKilocalories,
                          locale,
                          copy.metricUnavailable,
                          messages.training.units.kilocalories,
                        )}</td>)}
                      </tr>
                      <tr>
                        <th scope="row">{messages.training.averageHeartRate}</th>
                        {comparison.map((session) => <td key={session.sessionRef}>{formatExactMetric(
                          session.averageHeartRateBpm,
                          locale,
                          copy.metricUnavailable,
                          messages.training.units.beatsPerMinute,
                        )}</td>)}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
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
              {detailOrigin === "calendar" ? copy.backToCalendar : copy.closeDetail}
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
