import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { type catalogs, type Locale } from "../locales/catalogs";
import type {
  TrainingProvenanceEvent,
  TrainingSessionProvenanceResult,
} from "./training-session-provenance";
import { integerCountFormatter, mediumDateTimeFormatter } from "./presentation-format";

const PROVENANCE_PAGE_SIZE = 10;

interface TrainingSessionProvenancePanelProps {
  sessionRef: string;
  snapshotRef: string;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

export function TrainingSessionProvenancePanel({
  sessionRef,
  snapshotRef,
  locale,
  messages,
}: TrainingSessionProvenancePanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<TrainingSessionProvenanceResult>();
  const requestSequence = useRef(0);
  const copy = messages.training.sessionLibrary;
  const number = useMemo(() => integerCountFormatter(locale), [locale]);
  const dateTime = useMemo(() => mediumDateTimeFormatter(locale), [locale]);

  useEffect(() => {
    requestSequence.current += 1;
    setOpen(false);
    setLoading(false);
    setFailed(false);
    setResult(undefined);
  }, [sessionRef, snapshotRef]);

  function formatUtc(value: string): string {
    return dateTime.format(new Date(value));
  }

  async function load(offset: number) {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    setLoading(true);
    setFailed(false);
    setResult(undefined);
    try {
      const loaded = await invoke<TrainingSessionProvenanceResult>(
        "query_training_session_provenance",
        {
          query: {
            sessionRef,
            snapshotRef,
            offset,
            limit: PROVENANCE_PAGE_SIZE,
          },
        },
      );
      if (requestSequence.current === sequence) setResult(loaded);
    } catch {
      if (requestSequence.current !== sequence) return;
      setFailed(true);
    } finally {
      if (requestSequence.current === sequence) setLoading(false);
    }
  }

  function toggle() {
    if (open) {
      requestSequence.current += 1;
      setOpen(false);
      setLoading(false);
      return;
    }
    setOpen(true);
    if (!result) void load(0);
  }

  function eventEffect(event: TrainingProvenanceEvent): string {
    return event.contributesToVisibleState
      ? copy.provenanceEffects.contributing
      : copy.provenanceEffects.nonContributing;
  }

  const pageFrom = result && result.events.length > 0 ? result.offset + 1 : 0;
  const pageThrough = result ? result.offset + result.events.length : 0;

  return (
    <section className="training-provenance-disclosure">
      <div>
        <h4>{copy.provenanceAction}</h4>
        <p>{copy.provenanceIntro}</p>
      </div>
      <button
        type="button"
        className="secondary"
        aria-expanded={open}
        aria-controls="training-session-provenance"
        onClick={toggle}
      >
        {open ? copy.provenanceHide : copy.provenanceAction}
      </button>
      {open && (
        <section
          id="training-session-provenance"
          className="training-provenance"
          role="region"
          aria-label={copy.provenanceHeading}
          aria-busy={loading}
        >
          <h4>{copy.provenanceHeading}</h4>
          {loading && <p role="status">{copy.provenanceLoading}</p>}
          {failed && (
            <div className="training-provenance-failure error">
              <p role="alert">{copy.provenanceFailed}</p>
              <button type="button" className="secondary" onClick={() => void load(0)}>
                {copy.provenanceRetry}
              </button>
            </div>
          )}
          {result && (
            <>
              <section className="training-provenance-current">
                <h5>{copy.provenanceCurrentHeading}</h5>
                <p>{copy.provenanceCurrentIntro}</p>
                <dl>
                  <div>
                    <dt>{copy.provenanceProvider}</dt>
                    <dd>{copy.provenanceProviders[result.current.provider]}</dd>
                  </div>
                  <div>
                    <dt>{copy.provenanceSourceRevision}</dt>
                    <dd>
                      <time dateTime={result.current.sourceModifiedAtUtc}>
                        {formatUtc(result.current.sourceModifiedAtUtc)}
                      </time>
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.provenanceEvidenceCount}</dt>
                    <dd>{interpolate(copy.provenanceEvidenceCountValue, {
                      contributing: number.format(result.current.contributingEventCount),
                      nonContributing: number.format(result.current.nonContributingEventCount),
                    })}</dd>
                  </div>
                </dl>
                <details className="training-provenance-technical">
                  <summary>{copy.provenanceTechnicalHeading}</summary>
                  <dl>
                    <div>
                      <dt>{copy.provenanceSourceAdapter}</dt>
                      <dd><code>{result.current.sourceAdapterVersion}</code></dd>
                    </div>
                    <div>
                      <dt>{copy.provenanceMapping}</dt>
                      <dd><code>{result.current.mappingVersion}</code></dd>
                    </div>
                  </dl>
                </details>
              </section>
              <section className="training-provenance-history">
                <h5>{copy.provenanceHistoryHeading}</h5>
                <p>{copy.provenanceHistoryIntro}</p>
                <div className="training-table-scroll" tabIndex={0}>
                  <table>
                    <thead><tr>
                      <th scope="col">{copy.provenanceEvent}</th>
                      <th scope="col">{copy.provenanceObservedAt}</th>
                      <th scope="col">{copy.provenanceSourceRevision}</th>
                      <th scope="col">{copy.provenanceOutcome}</th>
                      <th scope="col">{copy.provenanceEffect}</th>
                      <th scope="col">{copy.provenanceInterpretation}</th>
                    </tr></thead>
                    <tbody>{result.events.map((event) => (
                      <tr key={event.ordinal}>
                        <th scope="row">{number.format(event.ordinal + 1)}</th>
                        <td><time dateTime={event.observedAtUtc}>{formatUtc(event.observedAtUtc)}</time></td>
                        <td><time dateTime={event.sourceModifiedAtUtc}>{formatUtc(event.sourceModifiedAtUtc)}</time></td>
                        <td>{copy.provenanceDecisions[event.decision]}</td>
                        <td>{eventEffect(event)}</td>
                        <td>
                          <code>{event.sourceAdapterVersion}</code>
                          <span aria-hidden="true"> · </span>
                          <code>{event.mappingVersion}</code>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <p className="training-provenance-page" aria-live="polite">
                  {interpolate(copy.provenancePage, {
                    from: number.format(pageFrom),
                    through: number.format(pageThrough),
                    total: number.format(result.totalEventCount),
                  })}
                </p>
                <div className="training-provenance-pagination">
                  <button
                    type="button"
                    className="secondary"
                    disabled={loading || result.offset === 0}
                    onClick={() => void load(Math.max(0, result.offset - PROVENANCE_PAGE_SIZE))}
                  >{copy.provenancePrevious}</button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={loading || result.nextOffset === null}
                    onClick={() => void load(result.nextOffset ?? result.offset)}
                  >{copy.provenanceNext}</button>
                </div>
              </section>
            </>
          )}
        </section>
      )}
    </section>
  );
}
