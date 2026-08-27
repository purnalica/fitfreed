import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { type catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import {
  formatSummaryDistance,
  formatSummaryDuration,
  integerCountFormatter,
  pluralRules,
} from "./presentation-format";
import { restoreFocusAfterReveal } from "./focus-restoration";
import { formatTrainingDateTime } from "./training-format";
import type {
  PlannedTrainingChronologyPage,
  PlannedTrainingChronologyQuery,
  PlannedTrainingCollection,
  PlannedTrainingCompletion,
  PlannedTrainingExercise,
  PlannedTrainingIntensity,
  PlannedTrainingPhase,
  PlannedTrainingSessionRelationResult,
  PlannedTrainingTargetDetail,
  PlannedTrainingTargetSummary,
} from "./planned-training";
import { plannedTrainingSportName } from "./planned-training";
import { SportFamilyIcon } from "./SportFamilyIcon";

const PAGE_SIZE = 25;
const PRIMARY_PHASE_LIMIT = 6;

type Messages = (typeof catalogs)["en-US"];

interface PlannedTrainingPanelProps {
  locale: Locale;
  messages: Messages;
  refreshToken: number;
  openTargetRef?: string;
  navigationRequestId?: number;
  createReportFocusRequestId?: number;
  onError: (code: string | undefined) => void;
  onOpenSession: (sessionRef: string) => void;
  onCreateReport: (target: PlannedTrainingTargetDetail) => void;
}

interface SessionPlannedTrainingPanelProps {
  sessionRef: string;
  trainingSnapshotRef: string;
  locale: Locale;
  messages: Messages;
  onError: (code: string | undefined) => void;
  onOpenTarget: (targetRef: string) => void;
}

interface ScheduleFilters {
  completion: PlannedTrainingCompletion | "";
  from: string;
  through: string;
}

const EMPTY_FILTERS: ScheduleFilters = { completion: "", from: "", through: "" };

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

function countCopy(
  messages: { one: string; other: string },
  count: number,
  locale: Locale,
): string {
  return interpolate(messages[pluralRules(locale).select(count) === "one" ? "one" : "other"], {
    count: integerCountFormatter(locale).format(count),
  });
}

function chronologyQuery(
  collection: PlannedTrainingCollection,
  filters: ScheduleFilters,
  offset: number,
  snapshotRef: string | null,
): PlannedTrainingChronologyQuery {
  return {
    collection,
    completion: collection === "scheduled" ? filters.completion || null : null,
    from: collection === "scheduled" ? filters.from || null : null,
    through: collection === "scheduled" ? filters.through || null : null,
    offset,
    limit: PAGE_SIZE,
    snapshotRef,
  };
}

function planShape(
  summary: PlannedTrainingTargetSummary,
  locale: Locale,
  messages: Messages["training"]["planned"],
): string {
  const number = integerCountFormatter(locale);
  const { shape } = summary;
  if (shape.phaseCount !== null && shape.expandedPhaseCount !== null) {
    if (shape.expandedPhaseCount !== shape.phaseCount) {
      return interpolate(messages.shape.phasesPasses, {
        phases: number.format(shape.phaseCount),
        passes: number.format(shape.expandedPhaseCount),
      });
    }
    return countCopy(messages.shape.phases, shape.phaseCount, locale);
  }
  if (shape.exerciseCount !== null) {
    return countCopy(messages.shape.exercises, shape.exerciseCount, locale);
  }
  return messages.shape.structureUnavailable;
}

function targetDate(summary: PlannedTrainingTargetSummary, locale: Locale): string | null {
  return summary.targetKind.kind === "scheduled"
    ? formatTrainingDateTime(summary.targetKind.scheduledAtLocal, locale)
    : null;
}

function phaseGoal(
  phase: PlannedTrainingPhase,
  locale: Locale,
  messages: Messages,
): string {
  switch (phase.goal.kind) {
    case "duration":
      return formatSummaryDuration(
        phase.goal.durationMilliseconds,
        locale,
        messages.training.durationUnits,
      );
    case "distance":
      return formatSummaryDistance(
        phase.goal.distanceMeters,
        locale,
        messages.training.units,
      );
    case "unmapped":
      return messages.training.planned.goalUnavailable;
  }
}

function phaseIntensity(
  intensity: PlannedTrainingIntensity,
  locale: Locale,
  messages: Messages["training"]["planned"],
): string {
  if (intensity.kind === "none") return messages.intensityNone;
  if (intensity.kind === "unmapped") return messages.intensityUnmapped;
  return interpolate(messages.intensityZone, {
    metric: messages.intensityMetrics[intensity.metric],
    lower: integerCountFormatter(locale).format(intensity.lowerZone),
    upper: integerCountFormatter(locale).format(intensity.upperZone),
  });
}

function repeatLabel(
  phase: PlannedTrainingPhase,
  locale: Locale,
  messages: Messages["training"]["planned"],
): string | null {
  const repeat = phase.transition.repeat;
  if (!repeat) return null;
  const number = integerCountFormatter(locale);
  return interpolate(messages.repeat, {
    count: number.format(repeat.totalIterations),
    from: number.format(repeat.returnToPhaseOrdinal + 1),
    through: number.format(phase.ordinal + 1),
  });
}

function ExercisePlan({
  exercise,
  locale,
  messages,
}: {
  exercise: PlannedTrainingExercise;
  locale: Locale;
  messages: Messages;
}) {
  const copy = messages.training.planned;
  const number = integerCountFormatter(locale);
  const sportName = plannedTrainingSportName(exercise.sport, locale)
    ?? (exercise.sport.state === "unavailable"
      ? copy.sportUnavailable
      : copy.sportUnmapped);
  const family = exercise.sport.state === "recognized"
    ? exercise.sport.recognition.canonicalFamily
    : null;
  const phases = exercise.phases;
  const previewPhases = phases?.slice(0, PRIMARY_PHASE_LIMIT) ?? [];
  const remainingPhaseCount = Math.max(0, (phases?.length ?? 0) - previewPhases.length);
  return (
    <article className="planned-training-exercise">
      <header>
        <div className="planned-training-exercise-identity">
          <SportFamilyIcon
            family={family}
            state={exercise.sport.state === "recognized"
              ? "recognized"
              : exercise.sport.state === "unavailable" ? "unavailable" : "unknown"}
          />
          <div>
            <p className="eyebrow">
              {interpolate(copy.exercise, { number: number.format(exercise.ordinal + 1) })}
            </p>
            <h3>{sportName}</h3>
          </div>
        </div>
        {(exercise.durationGoalMilliseconds !== null || exercise.distanceGoalMeters !== null) && (
          <dl className="planned-training-exercise-goals">
            {exercise.durationGoalMilliseconds !== null && (
              <div>
                <dt>{copy.durationGoal}</dt>
                <dd>{formatSummaryDuration(
                  exercise.durationGoalMilliseconds,
                  locale,
                  messages.training.durationUnits,
                )}</dd>
              </div>
            )}
            {exercise.distanceGoalMeters !== null && (
              <div>
                <dt>{copy.distanceGoal}</dt>
                <dd>{formatSummaryDistance(
                  exercise.distanceGoalMeters,
                  locale,
                  messages.training.units,
                )}</dd>
              </div>
            )}
          </dl>
        )}
      </header>
      {phases === null ? <p>{copy.exercisesUnavailable}</p>
        : phases.length === 0 ? <p>{copy.noExercises}</p>
        : (
          <>
            <section className="planned-training-sequence" aria-labelledby={`plan-sequence-${exercise.exerciseRef}`}>
              <h4 id={`plan-sequence-${exercise.exerciseRef}`}>{copy.phasePreview}</h4>
              <ol>
                {previewPhases.map((phase) => {
                  const repeat = repeatLabel(phase, locale, copy);
                  return (
                    <li key={phase.phaseRef}>
                      <span className="planned-training-phase-number">
                        {number.format(phase.ordinal + 1)}
                      </span>
                      <strong>{phase.name}</strong>
                      <span>{phaseGoal(phase, locale, messages)}</span>
                      {repeat && <em>{repeat}</em>}
                    </li>
                  );
                })}
              </ol>
              {remainingPhaseCount > 0 && (
                <p className="planned-training-sequence-more">
                  {countCopy(copy.morePhaseDefinitions, remainingPhaseCount, locale)}
                </p>
              )}
            </section>
            <details className="planned-training-exact-phases">
              <summary>{copy.exactPhaseDefinitions}</summary>
              <ol>
                {phases.map((phase) => {
                  const repeat = repeatLabel(phase, locale, copy);
                  return (
                    <li key={phase.phaseRef}>
                      <header>
                        <span>{interpolate(copy.phase, {
                          number: number.format(phase.ordinal + 1),
                        })}</span>
                        <strong>{phase.name}</strong>
                      </header>
                      <dl>
                        <div><dt>{copy.summary}</dt><dd>{phaseGoal(phase, locale, messages)}</dd></div>
                        <div><dt>{copy.shape.intensity}</dt><dd>{phaseIntensity(
                          phase.intensity,
                          locale,
                          copy,
                        )}</dd></div>
                        <div><dt>{copy.transition[phase.transition.change]}</dt><dd>{repeat ?? "—"}</dd></div>
                      </dl>
                    </li>
                  );
                })}
              </ol>
            </details>
          </>
        )}
    </article>
  );
}

export function PlannedTrainingEvidence({
  detail,
  locale,
  messages,
}: {
  detail: PlannedTrainingTargetDetail;
  locale: Locale;
  messages: Messages;
}) {
  const copy = messages.training.planned;
  const number = integerCountFormatter(locale);
  const summary = detail.target.summary;
  return (
    <div className="planned-training-evidence">
      <p className="planned-training-boundary">{copy.intentBoundary}</p>
      <ul className="planned-training-shape" aria-label={copy.summary}>
        <li><strong>{planShape(summary, locale, copy)}</strong></li>
        {summary.shape.repeatBlockCount !== null && summary.shape.repeatBlockCount > 0 && (
          <li>{interpolate(copy.shape.repeats, {
            count: number.format(summary.shape.repeatBlockCount),
          })}</li>
        )}
        {summary.shape.containsIntensityEvidence && <li>{copy.shape.intensity}</li>}
      </ul>
      {summary.reconciliationState === "conflicted" && (
        <p className="notice" role="status">{copy.conflicted}</p>
      )}
      {summary.relation.state === "absent" && <p>{copy.noRecordedSession}</p>}
      {summary.relation.state === "ambiguous" && <p>{copy.ambiguousRecordedSession}</p>}
      {detail.target.exercises === null ? <p>{copy.exercisesUnavailable}</p>
        : detail.target.exercises.length === 0 ? <p>{copy.noExercises}</p>
        : (
          <div className="planned-training-exercises">
            {detail.target.exercises.map((exercise) => (
              <ExercisePlan
                key={exercise.exerciseRef}
                exercise={exercise}
                locale={locale}
                messages={messages}
              />
            ))}
          </div>
        )}
      {summary.mappingCoverage.state === "partial" && (
        <details className="planned-training-mapping">
          <summary>{copy.mappingDetails}</summary>
          <p>{copy.mappingPartial}</p>
          <p>{interpolate(copy.mappingUnmappedCount, {
            count: number.format(summary.mappingCoverage.unmappedFieldCount),
          })}</p>
        </details>
      )}
    </div>
  );
}

export function PlannedTrainingPanel({
  locale,
  messages,
  refreshToken,
  openTargetRef,
  navigationRequestId,
  createReportFocusRequestId,
  onError,
  onOpenSession,
  onCreateReport,
}: PlannedTrainingPanelProps) {
  const copy = messages.training.planned;
  const [collection, setCollection] = useState<PlannedTrainingCollection>("scheduled");
  const [draftFilters, setDraftFilters] = useState<ScheduleFilters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<ScheduleFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState<PlannedTrainingChronologyPage>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retryRevision, setRetryRevision] = useState(0);
  const [detail, setDetail] = useState<PlannedTrainingTargetDetail>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailFailed, setDetailFailed] = useState(false);
  const [detailRetryRevision, setDetailRetryRevision] = useState(0);
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const createReportRef = useRef<HTMLButtonElement>(null);
  const handledNavigationRequest = useRef<number | undefined>(undefined);
  const number = useMemo(() => integerCountFormatter(locale), [locale]);

  async function loadPage(offset: number, snapshotRef: string | null) {
    return invoke<PlannedTrainingChronologyPage>("query_planned_training_chronology", {
      query: chronologyQuery(collection, filters, offset, snapshotRef),
    });
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    setDetail(undefined);
    void loadPage(0, null).then((result) => {
      if (!active) return;
      setPage(result);
      onError(undefined);
    }).catch((reason) => {
      if (!active) return;
      setPage(undefined);
      setFailed(true);
      onError(commandErrorCode(reason));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [collection, filters, refreshToken, retryRevision]);

  async function openTarget(targetRef: string, trigger: HTMLButtonElement | null) {
    detailTriggerRef.current = trigger;
    setDetailLoading(true);
    setDetailFailed(false);
    try {
      let result: PlannedTrainingTargetDetail;
      try {
        result = await invoke("query_planned_training_target", {
          query: { targetRef, snapshotRef: page?.snapshotRef ?? null },
        });
      } catch (reason) {
        if (commandErrorCode(reason) !== "planned-training-changed") throw reason;
        result = await invoke("query_planned_training_target", {
          query: { targetRef, snapshotRef: null },
        });
      }
      setDetail(result);
      onError(undefined);
      requestAnimationFrame(() => restoreFocusAfterReveal(
        detailHeadingRef.current,
        detailTriggerRef.current,
        {
          align: "start",
          forceInitialFocus: trigger === null,
        },
      ));
    } catch (reason) {
      setDetail(undefined);
      setDetailFailed(true);
      onError(commandErrorCode(reason));
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    if (
      !openTargetRef
      || navigationRequestId === undefined
      || handledNavigationRequest.current === navigationRequestId
    ) return;
    handledNavigationRequest.current = navigationRequestId;
    void openTarget(openTargetRef, null);
  }, [navigationRequestId, openTargetRef]);

  useEffect(() => {
    if (!detailFailed || !openTargetRef) return;
    void openTarget(openTargetRef, detailTriggerRef.current);
  }, [detailRetryRevision]);

  useEffect(() => {
    if (!createReportFocusRequestId || !detail) return;
    return restoreFocusAfterReveal(createReportRef.current, null, {
      align: "start",
      forceInitialFocus: true,
    });
  }, [createReportFocusRequestId, detail]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draftFilters.from && draftFilters.through && draftFilters.from > draftFilters.through) {
      onError("invalid-planned-training-query");
      return;
    }
    setFilters({ ...draftFilters });
  }

  async function changePage(offset: number) {
    setLoading(true);
    setFailed(false);
    try {
      let result: PlannedTrainingChronologyPage;
      try {
        result = await loadPage(offset, page?.snapshotRef ?? null);
      } catch (reason) {
        if (commandErrorCode(reason) !== "planned-training-changed") throw reason;
        result = await loadPage(0, null);
      }
      setPage(result);
      onError(undefined);
    } catch (reason) {
      setFailed(true);
      onError(commandErrorCode(reason));
    } finally {
      setLoading(false);
    }
  }

  function closeDetail() {
    const trigger = detailTriggerRef.current;
    setDetail(undefined);
    setDetailFailed(false);
    requestAnimationFrame(() => restoreFocusAfterReveal(trigger));
  }

  if (detail) {
    const summary = detail.target.summary;
    const scheduledDate = targetDate(summary, locale);
    const linkedSessionRef = summary.relation.state === "exact"
      ? summary.relation.sessionRef
      : null;
    return (
      <section className="planned-training planned-training-detail" aria-labelledby="planned-training-detail-heading">
        <button type="button" className="secondary" onClick={closeDetail}>
          <span aria-hidden="true">← </span>{copy.back}
        </button>
        <header className="planned-training-detail-heading">
          <div>
            <p className="eyebrow">{copy.detailEyebrow}</p>
            <h2 id="planned-training-detail-heading" ref={detailHeadingRef} tabIndex={-1}>
              {summary.name}
            </h2>
            {scheduledDate && <p>{interpolate(copy.scheduledFor, { date: scheduledDate })}</p>}
            {summary.description && <p>{summary.description}</p>}
          </div>
          <div className="planned-training-detail-actions">
            {linkedSessionRef && (
              <button type="button" className="secondary" onClick={() => onOpenSession(linkedSessionRef)}>
                {copy.openRecordedSession}
              </button>
            )}
            <button
              ref={createReportRef}
              type="button"
              onClick={() => onCreateReport(detail)}
            >
              {copy.createReport}
            </button>
          </div>
        </header>
        <PlannedTrainingEvidence detail={detail} locale={locale} messages={messages} />
      </section>
    );
  }

  return (
    <section className="planned-training" aria-labelledby="planned-training-heading" aria-busy={loading}>
      <header className="planned-training-heading">
        <div>
          <h2 id="planned-training-heading">{copy.heading}</h2>
          <p>{copy.intro}</p>
        </div>
        {page && <strong>{countCopy(copy.count, page.totalCount, locale)}</strong>}
      </header>
      <nav className="planned-training-collections" aria-label={copy.collectionNavigation}>
        <button
          type="button"
          aria-current={collection === "scheduled" ? "page" : undefined}
          onClick={() => setCollection("scheduled")}
        >{copy.schedule}</button>
        <button
          type="button"
          aria-current={collection === "favorite-templates" ? "page" : undefined}
          onClick={() => setCollection("favorite-templates")}
        >{copy.favorites}</button>
      </nav>
      <div className="planned-training-collection-heading">
        <h3>{collection === "scheduled" ? copy.scheduleHeading : copy.favoritesHeading}</h3>
        <p>{collection === "scheduled" ? copy.scheduleIntro : copy.favoritesIntro}</p>
      </div>
      {collection === "scheduled" && (
        <form className="planned-training-filters" onSubmit={applyFilters}>
          <label>
            <span>{copy.status}</span>
            <select
              value={draftFilters.completion}
              onChange={(event) => setDraftFilters((current) => ({
                ...current,
                completion: event.target.value as ScheduleFilters["completion"],
              }))}
            >
              <option value="">{copy.allStatuses}</option>
              <option value="pending">{copy.pending}</option>
              <option value="completed">{copy.completed}</option>
            </select>
          </label>
          <label>
            <span>{copy.from}</span>
            <input
              type="date"
              value={draftFilters.from}
              onChange={(event) => setDraftFilters((current) => ({
                ...current,
                from: event.target.value,
              }))}
            />
          </label>
          <label>
            <span>{copy.through}</span>
            <input
              type="date"
              value={draftFilters.through}
              onChange={(event) => setDraftFilters((current) => ({
                ...current,
                through: event.target.value,
              }))}
            />
          </label>
          <div className="planned-training-filter-actions">
            <button type="submit">{copy.apply}</button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setDraftFilters(EMPTY_FILTERS);
                setFilters(EMPTY_FILTERS);
              }}
            >{copy.clear}</button>
          </div>
        </form>
      )}
      {loading && <p role="status">{copy.loading}</p>}
      {failed && (
        <div className="planned-training-failure" role="alert">
          <p>{copy.unavailable}</p>
          <button type="button" className="secondary" onClick={() => setRetryRevision((value) => value + 1)}>
            {copy.retry}
          </button>
        </div>
      )}
      {detailLoading && <p role="status">{copy.loading}</p>}
      {detailFailed && (
        <div className="planned-training-failure" role="alert">
          <p>{copy.unavailable}</p>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              const targetRef = openTargetRef ?? detailTriggerRef.current?.dataset.targetRef;
              if (targetRef) void openTarget(targetRef, detailTriggerRef.current);
              else setDetailRetryRevision((value) => value + 1);
            }}
          >{copy.retry}</button>
        </div>
      )}
      {!loading && !failed && page?.targets.length === 0 && (
        <p>{collection === "scheduled" ? copy.emptySchedule : copy.emptyFavorites}</p>
      )}
      {!loading && page && page.targets.length > 0 && (
        <ul className="planned-training-list">
          {page.targets.map((target) => {
            const date = targetDate(target, locale);
            return (
              <li key={target.targetRef}>
                <button
                  type="button"
                  data-target-ref={target.targetRef}
                  onClick={(event) => void openTarget(target.targetRef, event.currentTarget)}
                  aria-label={interpolate(copy.review, { name: target.name })}
                >
                  <span className="planned-training-card-heading">
                    <span>
                      <small>{target.targetKind.kind === "favorite-template"
                        ? copy.template
                        : target.targetKind.completion === "pending" ? copy.pending : copy.completed}</small>
                      <strong role="heading" aria-level={4}>{target.name}</strong>
                    </span>
                    {date && <time dateTime={target.targetKind.kind === "scheduled"
                      ? target.targetKind.scheduledAtLocal
                      : undefined}>{date}</time>}
                  </span>
                  {target.description && <span>{target.description}</span>}
                  <span className="planned-training-card-facts">
                    <span>{planShape(target, locale, copy)}</span>
                    {target.relation.state === "exact" && <span>{copy.recordingLinked}</span>}
                    {target.relation.state === "ambiguous" && <span>{copy.recordingAmbiguous}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {page && (page.offset > 0 || page.nextOffset !== null) && (
        <nav className="pagination planned-training-pagination" aria-label={copy.paginationNavigation}>
          <button
            type="button"
            className="secondary"
            disabled={page.offset === 0 || loading}
            onClick={() => void changePage(Math.max(0, page.offset - page.limit))}
          ><span aria-hidden="true">← </span>{copy.previousPage}</button>
          <span>{interpolate(copy.pageRange, {
            from: number.format(page.offset + 1),
            through: number.format(page.offset + page.targets.length),
            total: number.format(page.totalCount),
          })}</span>
          <button
            type="button"
            className="secondary"
            disabled={page.nextOffset === null || loading}
            onClick={() => page.nextOffset !== null && void changePage(page.nextOffset)}
          >{copy.nextPage}<span aria-hidden="true"> →</span></button>
        </nav>
      )}
    </section>
  );
}

export function SessionPlannedTrainingPanel({
  sessionRef,
  trainingSnapshotRef,
  locale,
  messages,
  onError,
  onOpenTarget,
}: SessionPlannedTrainingPanelProps) {
  const copy = messages.training.planned.sessionRelation;
  const [result, setResult] = useState<PlannedTrainingSessionRelationResult>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retryRevision, setRetryRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    void invoke<PlannedTrainingSessionRelationResult>(
      "query_session_planned_training_relation",
      {
        query: {
          sessionRef,
          trainingSnapshotRef,
          snapshotRef: null,
        },
      },
    ).then((next) => {
      if (!active) return;
      setResult(next);
      onError(undefined);
    }).catch((reason) => {
      if (!active) return;
      setResult(undefined);
      setFailed(true);
      onError(commandErrorCode(reason));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [sessionRef, trainingSnapshotRef, retryRevision]);

  if (loading) return <p role="status">{copy.loading}</p>;
  if (failed) {
    return (
      <div className="session-planned-training-failure" role="alert">
        <p>{copy.unavailable}</p>
        <button type="button" className="secondary" onClick={() => setRetryRevision((value) => value + 1)}>
          {copy.retry}
        </button>
      </div>
    );
  }
  if (!result) return null;
  if (result.relation.state === "absent") {
    return <p className="session-planned-training-absent">{copy.absent}</p>;
  }
  return (
    <section className="session-planned-training" aria-labelledby="session-planned-training-heading">
      <header>
        <div>
          <p className="eyebrow">{copy.heading}</p>
          <h3 id="session-planned-training-heading">
            {result.relation.state === "exact" ? result.candidates[0]?.name : copy.heading}
          </h3>
        </div>
        {result.relation.state === "exact" && result.candidates[0] && (
          <button type="button" onClick={() => onOpenTarget(result.candidates[0].targetRef)}>
            {copy.review}
          </button>
        )}
      </header>
      <p>{copy.boundary}</p>
      {result.relation.state === "exact" ? <p>{copy.exact}</p> : (
        <>
          <p>{result.candidates.length === 2
            ? copy.ambiguous
            : interpolate(copy.ambiguousMany, {
              count: integerCountFormatter(locale).format(result.candidates.length),
            })}</p>
          <ul>
            {result.candidates.map((candidate) => (
              <li key={candidate.targetRef}>
                <button type="button" className="secondary" onClick={() => onOpenTarget(candidate.targetRef)}>
                  {interpolate(copy.reviewNamed, { name: candidate.name })}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
