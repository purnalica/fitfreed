import { type FormEvent, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { type catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import { ProgressSubmitButton } from "./ProgressSubmitButton";
import { formatDuration } from "./training-format";
import {
  sportFamilies,
  type SavedTrainingSportClassification,
  type SportFamily,
  type TrainingSport,
  type TrainingSportsOverview,
} from "./training-sports";

type TrainingSportsMessages = (typeof catalogs)["en-US"]["training"]["sports"];

interface TrainingSportsPanelProps {
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  refreshToken: number;
  onError: (code: string | undefined) => void;
  onChange?: () => void;
}

interface ClassificationDraft {
  sportRef: string;
  family: SportFamily | "";
  label: string;
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
  const [draft, setDraft] = useState<ClassificationDraft>();
  const [operation, setOperation] = useState<"save" | "reset">();
  const [status, setStatus] = useState<string>();
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const plural = useMemo(() => new Intl.PluralRules(locale), [locale]);
  const date = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }),
    [locale],
  );
  const copy = messages.training.sports;
  const busy = operation !== undefined;
  const draftLabelTooLong = draft !== undefined && [...draft.label.trim()].length > 80;

  async function loadOverview(): Promise<TrainingSportsOverview> {
    const result = await invoke<TrainingSportsOverview>("query_training_sports");
    setOverview(result);
    setFailed(false);
    return result;
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    setDraft(undefined);
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
    setDraft({
      sportRef: sport.sportRef,
      family: sport.classification?.canonicalFamily ?? "",
      label: sport.classification?.displayLabel ?? "",
    });
    setStatus(undefined);
  }

  async function persist(
    sport: TrainingSport,
    canonicalFamily: SportFamily | null,
    displayLabel: string | null,
    nextOperation: "save" | "reset",
  ) {
    if (!sport.sportRef || !sport.classification) return;
    setOperation(nextOperation);
    onError(undefined);
    try {
      const result = await invoke<SavedTrainingSportClassification>(
        "save_training_sport_classification",
        {
          request: {
            sportRef: sport.sportRef,
            expectedRevision: sport.classification.revision,
            canonicalFamily,
            displayLabel,
          },
        },
      );
      setOverview(result.overview);
      setDraft(undefined);
      setStatus(result.outcome === "changed" ? copy.saved : copy.unchanged);
      if (result.outcome === "changed") onChange?.();
    } catch (reason) {
      const code = commandErrorCode(reason);
      onError(code);
      if (code === "sport-classification-conflict") {
        try {
          await loadOverview();
          setDraft(undefined);
        } catch (reloadReason) {
          setFailed(true);
          onError(commandErrorCode(reloadReason));
        }
      }
    } finally {
      setOperation(undefined);
    }
  }

  function saveClassification(event: FormEvent<HTMLFormElement>, sport: TrainingSport) {
    event.preventDefault();
    if (!draft || draft.sportRef !== sport.sportRef) return;
    const label = draft.label.trim();
    void persist(sport, draft.family || null, label || null, "save");
  }

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
      aria-busy={loading || busy}
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
            const editing = draft?.sportRef === sport.sportRef;
            const sessionTemplate = copy.sessions[
              plural.select(sport.coverage.sessionCount) === "one" ? "one" : "other"
            ];
            return (
              <li key={sport.sportRef ?? `unavailable-${index}`} data-state={sport.state}>
                <div className="training-sport-card-heading">
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
                  {sport.state !== "unavailable" && !editing && (
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
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
                  <form
                    className="training-sport-editor"
                    aria-label={interpolate(copy.editorHeading, { sport: title })}
                    aria-busy={busy}
                    onSubmit={(event) => saveClassification(event, sport)}
                  >
                    <div className="training-sport-editor-field">
                      <label htmlFor={`sport-family-${index}`}>{copy.family}</label>
                      <select
                        id={`sport-family-${index}`}
                        value={draft.family}
                        disabled={busy}
                        onChange={(event) => setDraft({
                          ...draft,
                          family: event.target.value as SportFamily | "",
                        })}
                      >
                        <option value="">{copy.noFamily}</option>
                        {sportFamilies.map((family) => (
                          <option key={family} value={family}>{copy.families[family]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="training-sport-editor-field">
                      <label htmlFor={`sport-label-${index}`}>{copy.displayLabel}</label>
                      <input
                        id={`sport-label-${index}`}
                        value={draft.label}
                        aria-invalid={draftLabelTooLong}
                        aria-describedby={draftLabelTooLong
                          ? `sport-label-help-${index} sport-label-error-${index}`
                          : `sport-label-help-${index}`}
                        disabled={busy}
                        onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                      />
                      <small id={`sport-label-help-${index}`}>{copy.displayLabelHelp}</small>
                      {draftLabelTooLong && (
                        <small
                          id={`sport-label-error-${index}`}
                          className="field-error"
                          role="alert"
                        >
                          {copy.displayLabelTooLong}
                        </small>
                      )}
                    </div>
                    <div className="training-sport-editor-actions">
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={() => setDraft(undefined)}
                      >
                        {copy.cancel}
                      </button>
                      {sport.state === "classified" && (
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy}
                          onClick={() => void persist(sport, null, null, "reset")}
                        >
                          {copy.reset}
                        </button>
                      )}
                      <ProgressSubmitButton
                        loading={operation === "save"}
                        disabled={
                          busy || draftLabelTooLong
                          || (!draft.family && !draft.label.trim())
                        }
                        actionLabel={copy.save}
                        progressLabel={copy.saving}
                      />
                      {operation === "reset" && (
                        <span className="progress-submit-status" role="status" aria-live="polite">
                          {copy.resetting}
                        </span>
                      )}
                    </div>
                  </form>
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
