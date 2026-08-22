import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { type catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import { restoreFocusAfterReveal } from "./focus-restoration";
import { SportClassificationTask } from "./SportClassificationTask";
import { SportFamilyIcon } from "./SportFamilyIcon";
import { formatDuration } from "./training-format";
import {
  type SavedTrainingSportClassification,
  type TrainingSport,
  type TrainingSportsOverview,
} from "./training-sports";

type TrainingSportsMessages = (typeof catalogs)["en-US"]["training"]["sports"];

interface TrainingSportsPanelProps {
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  refreshToken: number;
  onError: (code: string | undefined) => void;
  onChange?: (result: SavedTrainingSportClassification) => void;
}

function localDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
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
): string {
  if (sport.state === "unavailable") return messages.notRecorded;
  if (sport.classification?.displayLabel) return sport.classification.displayLabel;
  if (sport.classification?.canonicalFamily) {
    return messages.families[sport.classification.canonicalFamily];
  }
  return interpolate(messages.unknown, { index: String(unknownIndex) });
}

export function TrainingSportsPanel({
  locale,
  messages,
  refreshToken,
  onError,
  onChange,
}: TrainingSportsPanelProps) {
  const [overview, setOverview] = useState<TrainingSportsOverview>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [editingSportRef, setEditingSportRef] = useState<string>();
  const [taskBusy, setTaskBusy] = useState(false);
  const [status, setStatus] = useState<string>();
  const actionRefs = useRef(new Map<string, HTMLButtonElement>());
  const returnFocusSportRef = useRef<string | undefined>(undefined);
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const plural = useMemo(() => new Intl.PluralRules(locale), [locale]);
  const date = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }),
    [locale],
  );
  const copy = messages.training.sports;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    setEditingSportRef(undefined);
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

  function titleFor(sport: TrainingSport): string {
    const unknownSports = overview?.sports.filter((candidate) => candidate.state === "unknown") ?? [];
    const unknownIndex = Math.max(unknownSports.indexOf(sport) + 1, 1);
    return sportTitle(sport, unknownIndex, copy);
  }

  function beginEditing(sport: TrainingSport) {
    if (!sport.sportRef) return;
    setEditingSportRef(sport.sportRef);
    setStatus(undefined);
  }

  function finishEditing(sportRef: string) {
    returnFocusSportRef.current = sportRef;
    setEditingSportRef(undefined);
  }

  function classificationSaved(
    sportRef: string,
    result: SavedTrainingSportClassification,
  ) {
    setStatus(result.outcome === "changed" ? copy.saved : copy.unchanged);
    finishEditing(sportRef);
    if (result.outcome === "changed") onChange?.(result);
  }

  useEffect(() => {
    if (editingSportRef !== undefined || returnFocusSportRef.current === undefined) return;
    const sportRef = returnFocusSportRef.current;
    returnFocusSportRef.current = undefined;
    return restoreFocusAfterReveal(actionRefs.current.get(sportRef) ?? null);
  }, [editingSportRef]);

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
        <ul className="training-sport-list">
          {overview.sports.map((sport, index) => {
            const title = titleFor(sport);
            const editing = editingSportRef === sport.sportRef;
            const sessionTemplate = copy.sessions[
              plural.select(sport.coverage.sessionCount) === "one" ? "one" : "other"
            ];
            return (
              <li
                key={sport.sportRef ?? `unavailable-${index}`}
                data-state={sport.state}
                data-sport-family={sport.classification?.canonicalFamily ?? sport.state}
              >
                <div className="training-sport-card-heading">
                  <div className="training-sport-identity">
                    <SportFamilyIcon
                      family={sport.classification?.canonicalFamily ?? null}
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
                        {interpolate(copy.period, {
                          from: date.format(localDate(sport.firstLocalDate)),
                          through: date.format(localDate(sport.lastLocalDate)),
                        })}
                      </p>
                    </div>
                  </div>
                  {sport.state !== "unavailable" && !editing && (
                    <button
                      type="button"
                      className="secondary"
                      ref={(element) => {
                        if (!sport.sportRef) return;
                        if (element) actionRefs.current.set(sport.sportRef, element);
                        else actionRefs.current.delete(sport.sportRef);
                      }}
                      disabled={taskBusy}
                      onClick={() => beginEditing(sport)}
                    >
                      {sport.state === "classified" ? copy.editNamed : copy.edit}
                    </button>
                  )}
                </div>

                {sport.state === "classified" && (
                  <p className="training-sport-authorship">{copy.classifiedByYou}</p>
                )}
                {sport.state === "unknown" && <p>{copy.unknownExplanation}</p>}
                {sport.state === "unavailable" && <p>{copy.notRecordedExplanation}</p>}

                <dl className="training-sport-coverage">
                  <div>
                    <dt>{interpolate(sessionTemplate, {
                      count: number.format(sport.coverage.sessionCount),
                    })}</dt>
                    <dd>{interpolate(copy.period, {
                      from: date.format(localDate(sport.firstLocalDate)),
                      through: date.format(localDate(sport.lastLocalDate)),
                    })}</dd>
                  </div>
                  <div>
                    <dt>{copy.duration}</dt>
                    <dd>{formatDuration(
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
                    onCancel={() => finishEditing(sport.sportRef!)}
                    onBusyChange={setTaskBusy}
                    onError={onError}
                    onOverviewChange={(nextOverview) => {
                      setOverview(nextOverview);
                      setFailed(false);
                    }}
                    onSaved={(result) => classificationSaved(sport.sportRef!, result)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {status && <p className="training-sports-status" role="status">{status}</p>}
    </section>
  );
}
