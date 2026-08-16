import { useEffect, useMemo, useState } from "react";
import { Channel, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";
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

function App() {
  const [locale, setLocale] = useState<Locale>("en-US");
  const [archivePath, setArchivePath] = useState<string>();
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [report, setReport] = useState<ImportReport>();
  const [progress, setProgress] = useState<ImportProgress>();
  const [busy, setBusy] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [error, setError] = useState<string>();
  const messages = catalogs[locale];
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const maxSteps = Math.max(...activities.map((item) => item.stepCount ?? 0), 1);

  async function refresh() {
    setActivities(await invoke<DailyActivity[]>("query_activity"));
  }

  useEffect(() => {
    refresh().catch((reason) => setError(String(reason)));
  }, []);

  async function chooseArchive() {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "ZIP", extensions: ["zip"] }],
    });
    if (typeof selected === "string") {
      setArchivePath(selected);
      setReport(undefined);
      setError(undefined);
    }
  }

  async function runImport() {
    if (!archivePath) return;
    setBusy(true);
    setCancelRequested(false);
    setProgress(undefined);
    setError(undefined);
    try {
      const onProgress = new Channel<ImportProgress>();
      onProgress.onmessage = setProgress;
      const outcome = await invoke<ImportReport>("import_archive", { archivePath, onProgress });
      setReport(outcome);
      await refresh();
    } catch (reason) {
      if (!String(reason).includes("import cancelled")) {
        setError(String(reason));
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
      setError(String(reason));
    }
  }

  const artifactProgress = progress?.totalArtifacts
    ? (progress.completedArtifacts / progress.totalArtifacts) * 100
    : undefined;
  const byteProgress = progress?.totalBytes
    ? (progress.completedBytes / progress.totalBytes) * 100
    : undefined;
  const progressValue = artifactProgress ?? byteProgress;

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
      {progress?.phase === "cancelled" && !busy && (
        <p className="notice" role="status" aria-live="polite">{messages.cancelled}</p>
      )}

      {report && (
        <p className="notice" role="status" aria-live="polite">
          {report.exactRepeat
            ? messages.exactRepeat
            : `${messages.completed}: ${report.recognizedArtifacts} ${messages.recognized}, ${report.newObservations} ${messages.created}, ${report.enrichedObservations} ${messages.enriched}, ${report.equivalentObservations} ${messages.equivalent}, ${report.preservedObservations} ${messages.preserved}, ${report.conflicts} ${messages.conflicts}.`}
        </p>
      )}
      {error && <p className="error" role="alert">{error}</p>}

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
