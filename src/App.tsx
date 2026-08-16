import { useEffect, useMemo, useState } from "react";
import { Channel, invoke } from "@tauri-apps/api/core";
import "./App.css";
import { chooseZipArchive } from "./infrastructure/archive-picker";
import { catalogs, type Locale } from "./locales/catalogs";

interface DailyActivity {
  originId: string;
  localDate: string;
  stepCount: number | null;
}

interface ImportReport {
  exactRepeat: boolean;
  recognizedArtifacts: number;
  newObservations: number;
  equivalentObservations: number;
  enrichedObservations: number;
  preservedObservations: number;
  conflicts: number;
}

type ImportOutcomeState = "completed" | "rejected" | "cancelled" | "failed";

interface ArtifactCoverageSummary {
  total: number;
  supported: number;
  unsupported: number;
  deliberatelyIgnored: number;
  unrecognized: number;
  invalid: number;
}

interface ImportOutcome {
  operationRef: string;
  state: ImportOutcomeState;
  sourceProvider: string;
  sourceAdapterVersion: string;
  mappingVersion: string;
  exactRepeat: boolean;
  coverageComplete: boolean;
  coverage: ArtifactCoverageSummary;
  report: ImportReport;
  canonicalHistoryChanged: boolean;
  terminalCode: string | null;
  recoveryNote: string | null;
}

interface CommandError {
  code?: string;
}

type ImportPhase =
  | "fingerprinting"
  | "validating"
  | "importing"
  | "committing"
  | "completed"
  | "cancelled";

interface ImportProgress {
  phase: ImportPhase;
  completedArtifacts: number;
  totalArtifacts: number | null;
  completedBytes: number;
  totalBytes: number | null;
  cancellable: boolean;
}

function commandErrorCode(reason: unknown): string {
  if (reason && typeof reason === "object" && "code" in reason) {
    const code = (reason as CommandError).code;
    if (typeof code === "string") return code;
  }
  return "unexpected";
}

function App() {
  const [locale, setLocale] = useState<Locale>("en-US");
  const [archivePath, setArchivePath] = useState<string>();
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [outcome, setOutcome] = useState<ImportOutcome>();
  const [progress, setProgress] = useState<ImportProgress>();
  const [busy, setBusy] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [errorCode, setErrorCode] = useState<string>();
  const messages = catalogs[locale];
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const maxSteps = Math.max(...activities.map((item) => item.stepCount ?? 0), 1);

  async function refresh() {
    setActivities(await invoke<DailyActivity[]>("query_activity"));
  }

  async function refreshOutcome() {
    const latest = await invoke<ImportOutcome | null>("query_latest_import_outcome");
    setOutcome(latest ?? undefined);
    return latest ?? undefined;
  }

  useEffect(() => {
    refresh().catch((reason) => setErrorCode(commandErrorCode(reason)));
    refreshOutcome().catch((reason) => setErrorCode(commandErrorCode(reason)));
  }, []);

  async function chooseArchive() {
    const selected = await chooseZipArchive();
    if (typeof selected === "string") {
      setArchivePath(selected);
      setErrorCode(undefined);
    }
  }

  async function runImport() {
    if (!archivePath) return;
    setBusy(true);
    setCancelRequested(false);
    setProgress(undefined);
    setErrorCode(undefined);
    setOutcome(undefined);
    try {
      const onProgress = new Channel<ImportProgress>();
      onProgress.onmessage = setProgress;
      await invoke<ImportReport>("import_archive", { archivePath, onProgress });
      await refresh();
      await refreshOutcome();
    } catch (reason) {
      const code = commandErrorCode(reason);
      if (code === "import-failed") {
        try {
          const latest = await refreshOutcome();
          if (latest && (latest.state === "rejected" || latest.state === "failed")) {
            setErrorCode(latest.terminalCode ?? code);
          }
        } catch (outcomeReason) {
          setErrorCode(commandErrorCode(outcomeReason));
        }
      } else {
        setErrorCode(code);
      }
    } finally {
      setBusy(false);
      setCancelRequested(false);
    }
  }

  async function cancelImport() {
    setCancelRequested(true);
    try {
      const accepted = await invoke<boolean>("cancel_import");
      if (!accepted) setCancelRequested(false);
    } catch (reason) {
      setCancelRequested(false);
      setErrorCode(commandErrorCode(reason));
    }
  }

  const artifactProgress = progress?.totalArtifacts
    ? (progress.completedArtifacts / progress.totalArtifacts) * 100
    : undefined;
  const byteProgress = progress?.totalBytes
    ? (progress.completedBytes / progress.totalBytes) * 100
    : undefined;
  const progressValue = artifactProgress ?? byteProgress;
  const classifiedArtifacts = outcome
    ? outcome.coverage.supported +
      outcome.coverage.unsupported +
      outcome.coverage.deliberatelyIgnored +
      outcome.coverage.unrecognized +
      outcome.coverage.invalid
    : 0;
  const visibleErrorCode =
    errorCode ??
    (outcome && (outcome.state === "rejected" || outcome.state === "failed")
      ? outcome.terminalCode ?? "unexpected"
      : undefined);
  const errorMessages = messages.errors as Record<string, string>;

  function outcomeSummary(latest: ImportOutcome): string {
    if (latest.state === "cancelled") return messages.cancelled;
    if (latest.state === "rejected") return messages.outcome.rejectedSummary;
    if (latest.state === "failed") return messages.outcome.failedSummary;
    if (latest.exactRepeat) return messages.exactRepeat;
    return `${messages.completed}: ${latest.report.recognizedArtifacts} ${messages.recognized}, ${latest.report.newObservations} ${messages.created}, ${latest.report.enrichedObservations} ${messages.enriched}, ${latest.report.equivalentObservations} ${messages.equivalent}, ${latest.report.preservedObservations} ${messages.preserved}, ${latest.report.conflicts} ${messages.conflicts}.`;
  }

  function providerName(provider: string): string {
    return provider === "polar-flow" ? messages.outcome.polarFlow : provider;
  }

  return (
    <main>
      <header className="hero">
        <p className="eyebrow">FitFreed</p>
        <h1>{messages.title}</h1>
        <p>{messages.intro}</p>
      </header>

      <section className="controls" aria-labelledby="import-heading">
        <div>
          <h2 id="import-heading">{messages.importHeading}</h2>
          <p className="path">{archivePath ?? messages.noPackage}</p>
        </div>
        <button type="button" className="secondary" onClick={chooseArchive} disabled={busy}>
          {messages.choose}
        </button>
        <button type="button" className="primary" onClick={runImport} disabled={!archivePath || busy}>
          {busy ? messages.importing : messages.import}
        </button>
        {busy && progress?.cancellable && (
          <button
            type="button"
            className="cancel"
            onClick={cancelImport}
            disabled={cancelRequested}
          >
            {cancelRequested ? messages.cancelling : messages.cancel}
          </button>
        )}
        <label>
          <span>{messages.language}</span>
          <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
            <option value="en-US">{messages.localeEnglish}</option>
            <option value="es-ES">{messages.localeSpanish}</option>
          </select>
        </label>
      </section>

      {progress && busy && (
        <section className="progress-panel" aria-labelledby="progress-heading" aria-live="polite">
          <h2 id="progress-heading">{messages.phases[progress.phase]}</h2>
          {progressValue === undefined ? (
            <p>{messages.phases[progress.phase]}</p>
          ) : (
            <progress max="100" value={progressValue} aria-label={messages.phases[progress.phase]} />
          )}
        </section>
      )}
      {progress?.phase === "cancelled" && !busy && outcome?.state !== "cancelled" && (
        <p className="notice" role="status" aria-live="polite">{messages.cancelled}</p>
      )}

      {outcome && (
        <section className="outcome-panel" aria-labelledby="outcome-heading">
          <h2 id="outcome-heading">{messages.outcome.heading}</h2>
          <p className="notice" role="status" aria-live="polite">
            {outcomeSummary(outcome)}
          </p>
          <dl className="outcome-metadata">
            <div>
              <dt>{messages.outcome.status}</dt>
              <dd>{messages.outcome.states[outcome.state]}</dd>
            </div>
            <div>
              <dt>{messages.outcome.provider}</dt>
              <dd>{providerName(outcome.sourceProvider)}</dd>
            </div>
            <div>
              <dt>{messages.outcome.historyEffect}</dt>
              <dd>
                {outcome.canonicalHistoryChanged
                  ? messages.outcome.historyChanged
                  : messages.outcome.historyUnchanged}
              </dd>
            </div>
          </dl>
          <h3 id="coverage-heading">{messages.outcome.coverageHeading}</h3>
          <p>
            <strong>
              {number.format(classifiedArtifacts)} / {number.format(outcome.coverage.total)}
            </strong>{" "}
            <span>{messages.outcome.artifactsClassified}.</span>{" "}
            <span>
              {outcome.coverageComplete
                ? messages.outcome.coverageComplete
                : messages.outcome.coverageIncomplete}
            </span>
          </p>
          <ul className="coverage-summary" aria-labelledby="coverage-heading">
            <li><strong>{number.format(outcome.coverage.supported)}</strong><span>{messages.outcome.supported}</span></li>
            <li><strong>{number.format(outcome.coverage.unsupported)}</strong><span>{messages.outcome.unsupported}</span></li>
            <li><strong>{number.format(outcome.coverage.deliberatelyIgnored)}</strong><span>{messages.outcome.ignored}</span></li>
            <li><strong>{number.format(outcome.coverage.unrecognized)}</strong><span>{messages.outcome.unrecognized}</span></li>
            <li><strong>{number.format(outcome.coverage.invalid)}</strong><span>{messages.outcome.invalid}</span></li>
          </ul>
        </section>
      )}
      {visibleErrorCode && (
        <p className="error" role="alert">
          {errorMessages[visibleErrorCode] ?? messages.errors.unexpected}
        </p>
      )}

      <section aria-labelledby="history-heading">
        <h2 id="history-heading">{messages.history}</h2>
        {activities.length === 0 ? (
          <p>{messages.empty}</p>
        ) : (
          <div className="history-grid">
            <figure aria-labelledby="chart-caption">
              <figcaption id="chart-caption">{messages.visual}</figcaption>
              <ol className="chart">
                {activities.map((activity) => (
                  <li key={`${activity.originId}:${activity.localDate}`}>
                    <time dateTime={activity.localDate}>{activity.localDate}</time>
                    <span className="track" aria-hidden="true">
                      <span
                        className="bar"
                        style={{ width: `${((activity.stepCount ?? 0) / maxSteps) * 100}%` }}
                      />
                    </span>
                    <strong>{activity.stepCount === null ? "—" : number.format(activity.stepCount)}</strong>
                  </li>
                ))}
              </ol>
            </figure>
            <table>
              <caption className="sr-only">{messages.history}</caption>
              <thead><tr><th scope="col">{messages.date}</th><th scope="col">{messages.steps}</th></tr></thead>
              <tbody>
                {activities.map((activity) => (
                  <tr key={`${activity.originId}:${activity.localDate}`}>
                    <td>{activity.localDate}</td>
                    <td>{activity.stepCount === null ? messages.unavailable : number.format(activity.stepCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
