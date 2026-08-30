import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { type catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import { restoreFocusAfterReveal } from "./focus-restoration";
import { SportClassificationTask } from "./SportClassificationTask";
import { SportFamilyIcon } from "./SportFamilyIcon";
import { SportUnificationTask } from "./SportUnificationTask";
import {
  formatMediumDateRange,
  formatSummaryDuration,
  integerCountFormatter,
  pluralRules,
} from "./presentation-format";
import {
  type SavedTrainingSportClassification,
  type SavedUnifiedSportRelationship,
  resolvedSportName,
  sportCanonicalFamily,
  type TrainingSportClassificationChange,
  type TrainingSport,
  type TrainingSportsOverview,
} from "./training-sports";

type TrainingSportsMessages = (typeof catalogs)["en-US"]["training"]["sports"];

interface TrainingSportsPanelProps {
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  refreshToken: number;
  openSportRef?: string;
  navigationRequestId?: number;
  sessionReturnFocus?: { sessionFilterRef: string; requestId: number };
  classificationChange?: TrainingSportClassificationChange;
  onError: (code: string | undefined) => void;
  onChange?: (result: SavedTrainingSportClassification) => void;
  onUnificationChange?: (result: SavedUnifiedSportRelationship) => void;
  onOpenSessions?: (sport: TrainingSport) => void;
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

function sportTitle(
  sport: TrainingSport,
  unknownIndex: number,
  messages: TrainingSportsMessages,
  locale: string,
): string {
  if (sport.state === "unavailable") return messages.notRecorded;
  const resolved = resolvedSportName(sport, locale, messages.families);
  if (resolved) return resolved;
  return interpolate(
    sport.state === "ambiguous" ? messages.ambiguous : messages.unknown,
    { index: String(unknownIndex) },
  );
}

export function TrainingSportsPanel({
  locale,
  messages,
  refreshToken,
  openSportRef,
  navigationRequestId,
  sessionReturnFocus,
  classificationChange,
  onError,
  onChange,
  onUnificationChange,
  onOpenSessions = () => undefined,
}: TrainingSportsPanelProps) {
  const [overview, setOverview] = useState<TrainingSportsOverview>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [editingSessionFilterRef, setEditingSessionFilterRef] = useState<string>();
  const [unifyingSessionFilterRef, setUnifyingSessionFilterRef] = useState<string>();
  const [taskBusy, setTaskBusy] = useState(false);
  const [status, setStatus] = useState<string>();
  const actionRefs = useRef(new Map<string, HTMLButtonElement>());
  const sessionActionRefs = useRef(new Map<string, HTMLButtonElement>());
  const unificationActionRefs = useRef(new Map<string, HTMLButtonElement>());
  const unificationReturnRef = useRef<string | undefined>(undefined);
  const returnFocusIdentity = useRef<{
    sessionFilterRef: string;
    sportRef?: string;
  } | undefined>(undefined);
  const handledNavigationRequest = useRef<number | undefined>(undefined);
  const handledSessionReturnRequest = useRef<number | undefined>(undefined);
  const number = useMemo(() => integerCountFormatter(locale), [locale]);
  const plural = useMemo(() => pluralRules(locale), [locale]);
  const copy = messages.training.sports;

  function formatSportPeriod(sport: TrainingSport): string {
    return formatMediumDateRange(
      sport.firstLocalDate,
      sport.lastLocalDate,
      locale,
      messages.training.rangeSeparator,
    );
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    setEditingSessionFilterRef(undefined);
    setUnifyingSessionFilterRef(undefined);
    setStatus(undefined);
    invoke<TrainingSportsOverview>("query_training_sports")
      .then((result) => {
        if (active) setOverview(result);
      })
      .catch((reason) => {
        if (!active) return;
        setOverview(undefined);
        setFailed(true);
        onError(commandErrorCode(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshToken, onError]);

  useEffect(() => {
    if (!classificationChange || classificationChange.source === "sports") return;
    setOverview(classificationChange.result.overview);
    setFailed(false);
    setStatus(
      classificationChange.result.outcome === "changed" ? copy.saved : copy.unchanged,
    );
  }, [classificationChange?.requestId, copy.saved, copy.unchanged]);

  useEffect(() => {
    if (
      !overview
      || !openSportRef
      || navigationRequestId === undefined
      || handledNavigationRequest.current === navigationRequestId
    ) return;
    handledNavigationRequest.current = navigationRequestId;
    const requested = overview.sports.find((sport) => sport.sportRef === openSportRef);
    if (!requested?.classification) return;
    setEditingSessionFilterRef(requested.sessionFilterRef);
    setStatus(undefined);
  }, [navigationRequestId, openSportRef, overview]);

  useEffect(() => {
    if (
      !sessionReturnFocus
      || handledSessionReturnRequest.current === sessionReturnFocus.requestId
    ) return;
    handledSessionReturnRequest.current = sessionReturnFocus.requestId;
    return restoreFocusAfterReveal(
      sessionActionRefs.current.get(sessionReturnFocus.sessionFilterRef) ?? null,
    );
  }, [sessionReturnFocus]);

  function titleFor(sport: TrainingSport): string {
    const unknownSports = overview?.sportCollections.filter((candidate) =>
      candidate.state === sport.state
    ) ?? [];
    const unknownIndex = Math.max(unknownSports.findIndex(
      (candidate) => candidate.sessionFilterRef === sport.sessionFilterRef,
    ) + 1, 1);
    return sportTitle(sport, unknownIndex, copy, locale);
  }

  function beginEditing(sport: TrainingSport) {
    if (!sport.sportRef) return;
    setUnifyingSessionFilterRef(undefined);
    setEditingSessionFilterRef(sport.sessionFilterRef);
    setStatus(undefined);
  }

  function beginUnification(sport: TrainingSport) {
    setEditingSessionFilterRef(undefined);
    setUnifyingSessionFilterRef(sport.sessionFilterRef);
    setStatus(undefined);
  }

  function finishUnification(sessionFilterRef: string) {
    unificationReturnRef.current = sessionFilterRef;
    setUnifyingSessionFilterRef(undefined);
  }

  function unificationSaved(
    sessionFilterRef: string,
    result: SavedUnifiedSportRelationship,
  ) {
    setOverview(result.overview);
    setFailed(false);
    setStatus(result.outcome === "removed"
      ? copy.unification.removed
      : result.outcome === "changed"
      ? copy.unification.saved
      : copy.unification.unchanged);
    finishUnification(sessionFilterRef);
    onUnificationChange?.(result);
  }

  function finishEditing(sessionFilterRef: string, sportRef?: string) {
    returnFocusIdentity.current = { sessionFilterRef, sportRef };
    setEditingSessionFilterRef(undefined);
  }

  function classificationSaved(
    sessionFilterRef: string,
    sportRef: string,
    result: SavedTrainingSportClassification,
  ) {
    setStatus(result.outcome === "changed" ? copy.saved : copy.unchanged);
    finishEditing(sessionFilterRef, sportRef);
    if (result.outcome === "changed") onChange?.(result);
  }

  useEffect(() => {
    if (
      editingSessionFilterRef !== undefined
      || returnFocusIdentity.current === undefined
    ) return;
    const { sessionFilterRef, sportRef } = returnFocusIdentity.current;
    returnFocusIdentity.current = undefined;
    const currentSessionFilterRef = actionRefs.current.has(sessionFilterRef)
      ? sessionFilterRef
      : overview?.sports.find((sport) => sport.sportRef === sportRef)?.sessionFilterRef;
    return restoreFocusAfterReveal(
      currentSessionFilterRef
        ? actionRefs.current.get(currentSessionFilterRef) ?? null
        : null,
    );
  }, [editingSessionFilterRef, overview]);

  useEffect(() => {
    if (unifyingSessionFilterRef !== undefined || unificationReturnRef.current === undefined) {
      return;
    }
    const previousRef = unificationReturnRef.current;
    unificationReturnRef.current = undefined;
    const current = overview?.sports.find((candidate) =>
      candidate.sessionFilterRef === previousRef
      || candidate.memberSessionFilterRefs.includes(previousRef)
    );
    return restoreFocusAfterReveal(
      current ? unificationActionRefs.current.get(current.sessionFilterRef) ?? null : null,
    );
  }, [overview, unifyingSessionFilterRef]);

  const summary = overview && interpolate(
    copy.summary[plural.select(overview.sports.length) === "one" ? "one" : "other"],
    {
      count: number.format(overview.sports.length),
      sessions: number.format(overview.sessionCount),
    },
  );

  return (
    <section
      className="training-sports"
      role="region"
      aria-labelledby="training-sports-heading"
      aria-busy={loading || taskBusy}
    >
      <header className="training-sports-heading">
        <div>
          <h2 id="training-sports-heading">{copy.heading}</h2>
          <p>{copy.intro}</p>
        </div>
        {summary && <strong>{summary}</strong>}
      </header>

      {loading ? (
        <p role="status">{copy.loading}</p>
      ) : failed || !overview ? (
        <p className="training-sports-unavailable">{copy.unavailable}</p>
      ) : overview.sports.length === 0 ? (
        <p>{copy.empty}</p>
      ) : (
        <>
        {overview.unificationReviews.map((review) => (
          <p
            className="notice training-sport-unification-review"
            role="alert"
            key={review.relationship.relationshipRef}
          >
            {review.reason === "missing-member"
              ? copy.unification.reviewMissing
              : copy.unification.reviewPrimary}
          </p>
        ))}
        <ul className="training-sport-list">
          {overview.sports.map((sport, index) => {
            const title = titleFor(sport);
            const editing = editingSessionFilterRef === sport.sessionFilterRef;
            const unifying = unifyingSessionFilterRef === sport.sessionFilterRef;
            return (
              <li
                key={sport.sessionFilterRef}
                data-state={sport.state}
                data-sport-family={sportCanonicalFamily(sport) ?? sport.state}
                data-editor-open={editing || unifying ? "true" : undefined}
              >
                <div className="training-sport-card-heading">
                  <div className="training-sport-identity">
                    <SportFamilyIcon
                      family={sportCanonicalFamily(sport)}
                      state={sport.state}
                    />
                    <div>
                      <h3>{title}</h3>
                      <p>
                        {overview.originCount > 1 && (
                          <span>{interpolate(copy.source, {
                            index: number.format(sport.sourceIndex),
                          })} · </span>
                        )}
                        {formatSportPeriod(sport)}
                      </p>
                    </div>
                  </div>
                  <div className="training-sport-card-actions">
                    <button
                      type="button"
                      ref={(element) => {
                        if (element) {
                          sessionActionRefs.current.set(sport.sessionFilterRef, element);
                        } else {
                          sessionActionRefs.current.delete(sport.sessionFilterRef);
                        }
                      }}
                      disabled={taskBusy}
                      onClick={() => onOpenSessions(sport)}
                    >
                      {copy.viewSessions}
                    </button>
                    {sport.state !== "unavailable" && sport.sportRef && !editing && !unifying && (
                      <button
                        type="button"
                        className="secondary training-sport-classify"
                        ref={(element) => {
                          if (element) {
                            actionRefs.current.set(sport.sessionFilterRef, element);
                          } else {
                            actionRefs.current.delete(sport.sessionFilterRef);
                          }
                        }}
                        disabled={taskBusy}
                        onClick={() => beginEditing(sport)}
                      >
                        {sport.state === "personally-overridden" ? copy.editNamed : copy.edit}
                      </button>
                    )}
                    {overview.sportCollections.length > 1 && !editing && !unifying && (
                      <button
                        type="button"
                        className="secondary training-sport-unify"
                        ref={(element) => {
                          if (element) {
                            unificationActionRefs.current.set(sport.sessionFilterRef, element);
                          } else {
                            unificationActionRefs.current.delete(sport.sessionFilterRef);
                          }
                        }}
                        disabled={taskBusy}
                        onClick={() => beginUnification(sport)}
                      >
                        {sport.unification ? copy.unification.edit : copy.unification.combine}
                      </button>
                    )}
                  </div>
                </div>

                {sport.state === "personally-overridden" && (
                  <p className="training-sport-authorship">{copy.classifiedByYou}</p>
                )}
                {sport.state === "recognized" && <p>{copy.recognizedExplanation}</p>}
                {sport.state === "ambiguous" && <p>{copy.ambiguousExplanation}</p>}
                {sport.state === "unknown" && <p>{copy.unknownExplanation}</p>}
                {sport.state === "unavailable" && <p>{copy.notRecordedExplanation}</p>}
                {sport.unification && (
                  <p className="training-sport-authorship">
                    {interpolate(copy.unification.label, {
                      count: number.format(sport.memberSessionFilterRefs.length),
                    })}
                  </p>
                )}

                <dl className="training-sport-coverage">
                  <div>
                    <dt>{messages.training.sessionCount}</dt>
                    <dd>{number.format(sport.coverage.sessionCount)}</dd>
                  </div>
                  <div>
                    <dt>{copy.duration}</dt>
                    <dd>{formatSummaryDuration(
                      sport.coverage.totalDurationMilliseconds,
                      locale,
                      messages.training.durationUnits,
                    )}</dd>
                  </div>
                  <div>
                    <dt>{interpolate(copy.distanceCoverage, {
                      available: number.format(sport.coverage.distanceSessionCount),
                      total: number.format(sport.coverage.sessionCount),
                    })}</dt>
                    <dd>{interpolate(copy.heartRateCoverage, {
                      available: number.format(sport.coverage.heartRateSessionCount),
                      total: number.format(sport.coverage.sessionCount),
                    })}</dd>
                  </div>
                </dl>

                {editing && sport.classification && (
                  <SportClassificationTask
                    editorId={`sport-${index}`}
                    sport={sport}
                    title={title}
                    messages={copy}
                    onCancel={() => finishEditing(sport.sessionFilterRef, sport.sportRef ?? undefined)}
                    onBusyChange={setTaskBusy}
                    onError={onError}
                    onOverviewChange={(nextOverview) => {
                      setOverview(nextOverview);
                      setFailed(false);
                    }}
                    onSaved={(result) => classificationSaved(
                      sport.sessionFilterRef,
                      sport.sportRef!,
                      result,
                    )}
                  />
                )}
                {unifying && (
                  <SportUnificationTask
                    overview={overview}
                    sport={sport}
                    messages={copy.unification}
                    locale={locale}
                    titleFor={titleFor}
                    onCancel={() => finishUnification(sport.sessionFilterRef)}
                    onBusyChange={setTaskBusy}
                    onError={onError}
                    onOverviewChange={(nextOverview) => {
                      setOverview(nextOverview);
                      setFailed(false);
                    }}
                    onSaved={(result) => unificationSaved(sport.sessionFilterRef, result)}
                  />
                )}
              </li>
            );
          })}
        </ul>
        </>
      )}
      {status && <p className="training-sports-status" role="status">{status}</p>}
    </section>
  );
}
