import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { type catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import { integerCountFormatter, pluralRules } from "./presentation-format";
import type {
  SavedUnifiedSportRelationship,
  TrainingSport,
  TrainingSportsOverview,
} from "./training-sports";

type SportUnificationMessages =
  (typeof catalogs)["en-US"]["training"]["sports"]["unification"];

interface SportUnificationTaskProps {
  overview: TrainingSportsOverview;
  sport: TrainingSport;
  messages: SportUnificationMessages;
  locale: Locale;
  titleFor: (sport: TrainingSport) => string;
  onCancel: () => void;
  onBusyChange?: (busy: boolean) => void;
  onError: (code: string | undefined) => void;
  onOverviewChange: (overview: TrainingSportsOverview) => void;
  onSaved: (result: SavedUnifiedSportRelationship) => void;
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

function canRepresentCombinedSport(sport: TrainingSport): boolean {
  return sport.state === "recognized" || sport.state === "personally-overridden";
}

export function SportUnificationTask({
  overview,
  sport,
  messages,
  locale,
  titleFor,
  onCancel,
  onBusyChange = () => undefined,
  onError,
  onOverviewChange,
  onSaved,
}: SportUnificationTaskProps) {
  const relationship = sport.unification;
  const [selectedRefs, setSelectedRefs] = useState(() => new Set(
    relationship?.memberSessionFilterRefs ?? sport.memberSessionFilterRefs,
  ));
  const [primaryRef, setPrimaryRef] = useState(
    relationship?.primarySessionFilterRef ?? sport.memberSessionFilterRefs[0]
      ?? sport.sessionFilterRef,
  );
  const [busy, setBusy] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [alert, setAlert] = useState<string>();
  const number = useMemo(() => integerCountFormatter(locale), [locale]);
  const plural = useMemo(() => pluralRules(locale), [locale]);

  const relationshipRefs = new Set(relationship?.memberSessionFilterRefs ?? []);
  const claimedElsewhere = new Set(
    overview.sports.flatMap((candidate) =>
      candidate.unification?.relationshipRef !== relationship?.relationshipRef
        ? candidate.unification?.memberSessionFilterRefs ?? []
        : []
    ),
  );
  const candidates = overview.sportCollections.filter(
    (candidate) => !claimedElsewhere.has(candidate.sessionFilterRef)
      || relationshipRefs.has(candidate.sessionFilterRef),
  );
  const selected = candidates.filter((candidate) => selectedRefs.has(candidate.sessionFilterRef));
  const primary = selected.find((candidate) => candidate.sessionFilterRef === primaryRef);
  const primaryIsUsable = primary !== undefined && canRepresentCombinedSport(primary);
  const selectedSessionCount = selected.reduce(
    (total, candidate) => total + candidate.coverage.sessionCount,
    0,
  );
  const canSave = selected.length >= 2 && primaryIsUsable && !busy;

  function toggleMember(candidate: TrainingSport) {
    if (busy) return;
    setAlert(undefined);
    setSelectedRefs((current) => {
      const next = new Set(current);
      if (next.has(candidate.sessionFilterRef)) {
        next.delete(candidate.sessionFilterRef);
      } else {
        next.add(candidate.sessionFilterRef);
      }
      if (!next.has(primaryRef)) {
        const nextPrimary = candidates.find(
          (possible) => next.has(possible.sessionFilterRef)
            && canRepresentCombinedSport(possible),
        );
        setPrimaryRef(nextPrimary?.sessionFilterRef ?? "");
      }
      return next;
    });
  }

  async function reloadAfterConflict(code: string) {
    try {
      const latest = await invoke<TrainingSportsOverview>("query_training_sports");
      onOverviewChange(latest);
    } catch (reason) {
      onError(commandErrorCode(reason));
    }
    setAlert(messages.conflict);
    onError(code);
  }

  async function save() {
    if (!canSave || !primary) return;
    setBusy(true);
    onBusyChange(true);
    setAlert(undefined);
    onError(undefined);
    try {
      const result = await invoke<SavedUnifiedSportRelationship>(
        "save_unified_sport_relationship",
        {
          request: {
            expectedSnapshotRef: overview.snapshotRef,
            expectedRevision: relationship?.revision ?? 0,
            relationshipRef: relationship?.relationshipRef ?? null,
            primarySessionFilterRef: primary.sessionFilterRef,
            members: selected.map((candidate) => ({
              sessionFilterRef: candidate.sessionFilterRef,
              sessionCount: candidate.coverage.sessionCount,
            })),
          },
        },
      );
      onOverviewChange(result.overview);
      onSaved(result);
    } catch (reason) {
      const code = commandErrorCode(reason);
      if (code === "sport-unification-conflict") {
        await reloadAfterConflict(code);
      } else {
        setAlert(messages.failed);
        onError(code);
      }
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  async function remove() {
    if (!relationship || busy) return;
    setBusy(true);
    onBusyChange(true);
    setAlert(undefined);
    onError(undefined);
    try {
      const result = await invoke<SavedUnifiedSportRelationship>(
        "remove_unified_sport_relationship",
        {
          request: {
            expectedSnapshotRef: overview.snapshotRef,
            relationshipRef: relationship.relationshipRef,
            expectedRevision: relationship.revision,
          },
        },
      );
      onOverviewChange(result.overview);
      onSaved(result);
    } catch (reason) {
      const code = commandErrorCode(reason);
      if (code === "sport-unification-conflict") {
        await reloadAfterConflict(code);
      } else {
        setAlert(messages.failed);
        onError(code);
      }
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <section className="sport-unification-task" aria-labelledby="sport-unification-heading">
      <header>
        <h4 id="sport-unification-heading">{messages.heading}</h4>
        <p>{messages.intro}</p>
      </header>

      {alert && <p className="notice" role="alert">{alert}</p>}

      <fieldset disabled={busy}>
        <legend>{messages.members}</legend>
        <div className="sport-unification-options">
          {candidates.map((candidate) => {
            const template = messages.memberSessions[
              plural.select(candidate.coverage.sessionCount) === "one" ? "one" : "other"
            ];
            const label = interpolate(template, {
              sport: titleFor(candidate),
              count: number.format(candidate.coverage.sessionCount),
            });
            return (
              <label key={candidate.sessionFilterRef}>
                <input
                  type="checkbox"
                  checked={selectedRefs.has(candidate.sessionFilterRef)}
                  onChange={() => toggleMember(candidate)}
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset disabled={busy}>
        <legend>{messages.primary}</legend>
        <p>{messages.primaryHelp}</p>
        <div className="sport-unification-primary-options">
          {selected.filter(canRepresentCombinedSport).map((candidate) => (
            <label key={candidate.sessionFilterRef}>
              <input
                type="radio"
                name="unified-sport-primary"
                value={candidate.sessionFilterRef}
                checked={candidate.sessionFilterRef === primaryRef}
                onChange={() => setPrimaryRef(candidate.sessionFilterRef)}
              />
              <span>{titleFor(candidate)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="sport-unification-preview" aria-live="polite">
        <p>{interpolate(messages.preview, {
          groups: number.format(selected.length),
          sessions: number.format(selectedSessionCount),
        })}</p>
        {primaryIsUsable && primary && (
          <p>{interpolate(messages.previewIdentity, { sport: titleFor(primary) })}</p>
        )}
        {selected.length < 2 && <p>{messages.minimum}</p>}
        {selected.length >= 2 && !primaryIsUsable && <p>{messages.identityRequired}</p>}
      </div>

      {confirmingRemoval && relationship && (
        <div className="sport-unification-removal" role="alert">
          <p>{messages.removeConfirm}</p>
          <div className="sport-unification-actions">
            <button
              type="button"
              className="danger-action"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? messages.removing : messages.removeAction}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setConfirmingRemoval(false)}
            >
              {messages.keep}
            </button>
          </div>
        </div>
      )}

      {!confirmingRemoval && (
        <div className="sport-unification-actions">
          <button type="button" disabled={!canSave} onClick={() => void save()}>
            {busy ? messages.saving : messages.save}
          </button>
          <button type="button" className="secondary" disabled={busy} onClick={onCancel}>
            {messages.cancel}
          </button>
          {relationship && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setConfirmingRemoval(true)}
            >
              {messages.remove}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
