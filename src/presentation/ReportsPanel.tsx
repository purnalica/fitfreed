import { type FormEvent, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { chooseReportDestination } from "../infrastructure/report-destination";
import { type catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import type {
  ReportDefinition,
  ReportExportReceipt,
  ReportList,
  ReportSummary,
  ResolvedSessionReport,
  SessionReportOrigin,
} from "./session-report";
import { narrativeReportBlock, sessionReportBlock } from "./session-report";
import {
  formatDistance,
  formatDuration,
  formatExactMetric,
  formatTrainingDateTime,
} from "./training-format";
import type { TrainingSessionSport } from "./training-session-search";

interface ReportsPanelProps {
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  origin?: SessionReportOrigin;
  originRequestId: number;
  disabled: boolean;
  onReturnToOrigin: () => void;
  onError: (code: string | undefined) => void;
}

interface EditorState {
  reportRef?: string;
  revision?: string;
  sourceSnapshotRef: string;
  sessionRef: string;
  title: string;
  narrative: string;
  includePhysiologicalContext: boolean;
}

function editorFromDefinition(definition: ReportDefinition): EditorState {
  return {
    reportRef: definition.reportRef,
    revision: definition.revision,
    sourceSnapshotRef: definition.sourceSnapshotRef,
    sessionRef: definition.origin.sessionRef,
    title: definition.title,
    narrative: narrativeReportBlock(definition).body,
    includePhysiologicalContext:
      sessionReportBlock(definition).includePhysiologicalContext,
  };
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

export function ReportsPanel({
  locale,
  messages,
  origin,
  originRequestId,
  disabled,
  onReturnToOrigin,
  onError,
}: ReportsPanelProps) {
  const copy = messages.reports;
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listFailed, setListFailed] = useState(false);
  const [editor, setEditor] = useState<EditorState>();
  const [resolved, setResolved] = useState<ResolvedSessionReport>();
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [localError, setLocalError] = useState<string>();
  const [savedNotice, setSavedNotice] = useState(false);
  const [privacyReviewOpen, setPrivacyReviewOpen] = useState(false);
  const [exportPhysiology, setExportPhysiology] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportedBytes, setExportedBytes] = useState<string>();
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  async function refreshList() {
    setListLoading(true);
    setListFailed(false);
    try {
      const result = await invoke<ReportList>("list_reports");
      setReports(result.reports);
    } catch (reason) {
      const code = commandErrorCode(reason);
      setListFailed(true);
      onError(code);
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    void refreshList();
  }, []);

  useEffect(() => {
    if (!origin || originRequestId === 0) return;
    setEditor({
      sourceSnapshotRef: origin.snapshotRef,
      sessionRef: origin.session.sessionRef,
      title: interpolate(copy.defaultTitle, {
        date: formatTrainingDateTime(origin.session.startedAtLocal, locale),
      }),
      narrative: "",
      includePhysiologicalContext:
        origin.session.averageHeartRateBpm !== null
        || origin.session.maximumHeartRateBpm !== null,
    });
    setResolved(undefined);
    setLocalError(undefined);
    setSavedNotice(false);
    setPrivacyReviewOpen(false);
    setExportedBytes(undefined);
  }, [originRequestId]);

  async function resolveReport(reportRef: string) {
    setResolving(true);
    setLocalError(undefined);
    try {
      const result = await invoke<ResolvedSessionReport>("resolve_session_report", {
        reportRef,
      });
      setResolved(result);
      setEditor(editorFromDefinition(result.definition));
      setExportPhysiology(
        sessionReportBlock(result.definition).includePhysiologicalContext,
      );
      setPrivacyReviewOpen(false);
      setExportedBytes(undefined);
      return result;
    } catch (reason) {
      const code = commandErrorCode(reason);
      setLocalError(code);
      onError(code);
      return undefined;
    } finally {
      setResolving(false);
    }
  }

  async function openReport(reportRef: string) {
    setSavedNotice(false);
    await resolveReport(reportRef);
  }

  async function saveReport(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;
    const title = editor.title.trim();
    const narrative = editor.narrative.trim();
    if (!title || !narrative) {
      setLocalError("invalid-report-definition");
      return;
    }
    setSaving(true);
    setLocalError(undefined);
    setSavedNotice(false);
    try {
      let definition: ReportDefinition;
      if (editor.reportRef && editor.revision) {
        definition = await invoke<ReportDefinition>("update_session_report", {
          request: {
            reportRef: editor.reportRef,
            expectedRevision: editor.revision,
            title,
            locale,
            includePhysiologicalContext: editor.includePhysiologicalContext,
            narrative,
          },
        });
      } else {
        definition = await invoke<ReportDefinition>("create_session_report", {
          request: {
            title,
            locale,
            sessionRef: editor.sessionRef,
            sourceSnapshotRef: editor.sourceSnapshotRef,
            includePhysiologicalContext: editor.includePhysiologicalContext,
            narrative,
          },
        });
      }
      setEditor(editorFromDefinition(definition));
      setSavedNotice(true);
      await refreshList();
      await resolveReport(definition.reportRef);
      setSavedNotice(true);
    } catch (reason) {
      const code = commandErrorCode(reason);
      setLocalError(code);
      onError(code);
    } finally {
      setSaving(false);
    }
  }

  function beginPrivacyReview() {
    if (!resolved || resolved.status !== "current") return;
    setExportPhysiology(
      sessionReportBlock(resolved.definition).includePhysiologicalContext,
    );
    setPrivacyReviewOpen(true);
    setExportedBytes(undefined);
  }

  async function exportReport() {
    if (!resolved || resolved.status !== "current") return;
    const destination = await chooseReportDestination(resolved.definition.title);
    if (!destination) return;
    setExporting(true);
    setLocalError(undefined);
    setExportedBytes(undefined);
    try {
      const receipt = await invoke<ReportExportReceipt>("export_session_report", {
        request: {
          reportRef: resolved.definition.reportRef,
          expectedRevision: resolved.definition.revision,
          expectedSourceSnapshotRef: resolved.definition.sourceSnapshotRef,
          includePhysiologicalContext: exportPhysiology,
          destinationPath: destination,
        },
      });
      setExportedBytes(receipt.byteCount);
      setPrivacyReviewOpen(false);
    } catch (reason) {
      const code = commandErrorCode(reason);
      setLocalError(code);
      onError(code);
    } finally {
      setExporting(false);
    }
  }

  async function cancelExport() {
    await invoke<boolean>("cancel_report_export");
  }

  function sportLabel(sport: TrainingSessionSport): string {
    if (sport.classification?.displayLabel) return sport.classification.displayLabel;
    if (sport.classification?.canonicalFamily) {
      return messages.training.sports.families[sport.classification.canonicalFamily];
    }
    return sport.state === "unknown" ? copy.sportUnclassified : copy.sportUnavailable;
  }

  const physiologyAvailable = resolved
    ? resolved.sensitiveContents.some((content) => content.kind === "heart-rate")
    : origin?.session.averageHeartRateBpm !== null
      || origin?.session.maximumHeartRateBpm !== null;
  const savedPhysiologyAllowed = resolved
    ? sessionReportBlock(resolved.definition).includePhysiologicalContext
    : editor?.includePhysiologicalContext ?? false;

  return (
    <section className="reports-panel" aria-labelledby="reports-heading">
      <header className="reports-hero">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 id="reports-heading">{copy.heading}</h1>
        <p>{copy.intro}</p>
      </header>

      {origin && (
        <button type="button" className="secondary" onClick={onReturnToOrigin}>
          <span aria-hidden="true">← </span>{copy.backToSession}
        </button>
      )}

      <div className="reports-layout">
        <aside className="report-library" aria-labelledby="saved-reports-heading">
          <div className="report-section-heading">
            <h2 id="saved-reports-heading">{copy.savedHeading}</h2>
            <button
              type="button"
              className="secondary"
              onClick={() => void refreshList()}
              disabled={listLoading}
            >
              {copy.reload}
            </button>
          </div>
          {listLoading && <p role="status">{copy.loading}</p>}
          {listFailed && (
            <p role="alert">
              {copy.errors["report-definition-query-failed"]}
            </p>
          )}
          {!listLoading && !listFailed && reports.length === 0 && <p>{copy.empty}</p>}
          {reports.length > 0 && (
            <ul className="report-list">
              {reports.map((report) => (
                <li key={report.reportRef}>
                  <button
                    type="button"
                    aria-current={resolved?.definition.reportRef === report.reportRef
                      ? "page"
                      : undefined}
                    onClick={() => void openReport(report.reportRef)}
                    disabled={resolving}
                  >
                    <strong>{report.title}</strong>
                    <span>{interpolate(copy.savedMetadata, {
                      locale: report.locale,
                      revision: report.revision,
                    })}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="report-workspace">
          {!editor && !resolving && (
            <section className="report-empty-editor">
              <h2>{copy.chooseHeading}</h2>
              <p>{copy.chooseBody}</p>
            </section>
          )}
          {resolving && <p role="status">{copy.resolving}</p>}
          {editor && (
            <form className="report-editor" onSubmit={(event) => void saveReport(event)}>
              <div className="report-section-heading">
                <div>
                  <p className="eyebrow">
                    {editor.reportRef ? copy.editingEyebrow : copy.creatingEyebrow}
                  </p>
                  <h2>{editor.reportRef ? copy.editHeading : copy.createHeading}</h2>
                </div>
                {editor.revision && (
                  <span className="report-revision">
                    {interpolate(copy.revision, { revision: editor.revision })}
                  </span>
                )}
              </div>
              <label className="report-field">
                <span>{copy.titleLabel}</span>
                <input
                  value={editor.title}
                  maxLength={120}
                  required
                  disabled={disabled || saving}
                  onChange={(event) => setEditor({ ...editor, title: event.target.value })}
                />
              </label>
              <div className="report-field">
                <label htmlFor="report-narrative">{copy.narrativeLabel}</label>
                <textarea
                  id="report-narrative"
                  aria-describedby="report-narrative-help"
                  value={editor.narrative}
                  maxLength={10_000}
                  rows={8}
                  required
                  disabled={disabled || saving}
                  onChange={(event) => setEditor({ ...editor, narrative: event.target.value })}
                />
                <small id="report-narrative-help">{copy.narrativeHelp}</small>
              </div>
              <label className="report-sensitive-choice">
                <input
                  type="checkbox"
                  checked={editor.includePhysiologicalContext}
                  disabled={disabled || saving || !physiologyAvailable}
                  onChange={(event) => setEditor({
                    ...editor,
                    includePhysiologicalContext: event.target.checked,
                  })}
                />
                <span>
                  <strong>{copy.includeHeartRate}</strong>
                  <small>{physiologyAvailable
                    ? copy.includeHeartRateHelp
                    : copy.heartRateUnavailable}</small>
                </span>
              </label>
              <div className="report-actions">
                <button type="submit" disabled={disabled || saving}>
                  {saving ? copy.saving : editor.reportRef ? copy.save : copy.create}
                </button>
                {resolved && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={disabled || saving || resolved.status !== "current"}
                    onClick={beginPrivacyReview}
                  >
                    {copy.reviewExport}
                  </button>
                )}
              </div>
            </form>
          )}

          {savedNotice && <p className="notice" role="status">{copy.saved}</p>}
          {localError && (
            <p className="error" role="alert">
              {copy.errors[localError as keyof typeof copy.errors] ?? copy.errors.unexpected}
            </p>
          )}
          {exportedBytes && (
            <p className="notice" role="status">
              {interpolate(copy.exported, { bytes: number.format(BigInt(exportedBytes)) })}
            </p>
          )}

          {resolved && (
            <section className="report-preview" aria-labelledby="report-preview-heading">
              <div className="report-section-heading">
                <div>
                  <p className="eyebrow">{copy.previewEyebrow}</p>
                  <h2 id="report-preview-heading">{copy.previewHeading}</h2>
                </div>
                <span className={`report-status report-status-${resolved.status}`}>
                  {copy.status[resolved.status]}
                </span>
              </div>
              {resolved.status === "stale" && (
                <p className="report-stale" role="status">{copy.stale}</p>
              )}
              <article>
                <h3>{resolved.definition.title}</h3>
                <p className="report-attribution">{copy.recordedAttribution}</p>
                <dl className="report-evidence-summary">
                  <div><dt>{copy.started}</dt><dd>{formatTrainingDateTime(resolved.session.startedAtLocal, locale)}</dd></div>
                  <div><dt>{messages.training.duration}</dt><dd>{formatDuration(resolved.session.durationMilliseconds, locale, messages.training.durationUnits)}</dd></div>
                  <div><dt>{messages.training.distance}</dt><dd>{formatDistance(resolved.session.distanceMeters, locale, copy.unavailable, messages.training.units.meters)}</dd></div>
                  <div><dt>{messages.training.energy}</dt><dd>{formatExactMetric(resolved.session.energyKilocalories, locale, copy.unavailable, messages.training.units.kilocalories)}</dd></div>
                  {resolved.session.averageHeartRateBpm !== null && (
                    <div><dt>{messages.training.averageHeartRate}</dt><dd>{formatExactMetric(resolved.session.averageHeartRateBpm, locale, copy.unavailable, messages.training.units.beatsPerMinute)}</dd></div>
                  )}
                  {resolved.session.maximumHeartRateBpm !== null && (
                    <div><dt>{messages.training.maximumHeartRate}</dt><dd>{formatExactMetric(resolved.session.maximumHeartRateBpm, locale, copy.unavailable, messages.training.units.beatsPerMinute)}</dd></div>
                  )}
                  <div><dt>{messages.training.trainingType}</dt><dd>{sportLabel(resolved.session.sport)}</dd></div>
                </dl>
              </article>
              <article>
                <h3>{copy.interpretationHeading}</h3>
                <p className="report-attribution">{copy.authoredAttribution}</p>
                <p className="report-narrative">
                  {narrativeReportBlock(resolved.definition).body}
                </p>
              </article>
              <article>
                <h3>{copy.coverageHeading}</h3>
                {resolved.limitations.length === 0
                  ? <p>{copy.noLimitations}</p>
                  : (
                    <ul>{resolved.limitations.map((limitation) => (
                      <li key={limitation}>{copy.limitations[limitation]}</li>
                    ))}</ul>
                  )}
              </article>
              <details>
                <summary>{copy.provenanceHeading}</summary>
                <dl>
                  <div><dt>{copy.source}</dt><dd>{resolved.provenance.provider === "polar-flow" ? "Polar Flow" : resolved.provenance.provider}</dd></div>
                  <div><dt>{copy.mapping}</dt><dd><code>{resolved.provenance.mappingVersion}</code></dd></div>
                  <div><dt>{copy.definitionVersion}</dt><dd>{resolved.definition.definitionVersion}</dd></div>
                  <div><dt>{copy.definitionRevision}</dt><dd>{resolved.definition.revision}</dd></div>
                </dl>
              </details>
            </section>
          )}

          {privacyReviewOpen && resolved && (
            <section
              className="report-privacy-review"
              role="region"
              aria-labelledby="report-privacy-heading"
            >
              <h2 id="report-privacy-heading">{copy.privacyHeading}</h2>
              <p>{copy.privacyIntro}</p>
              <ul>
                <li>{copy.sessionSummaryIncluded}</li>
                <li>{copy.narrativeIncluded}</li>
                <li>{copy.provenanceIncluded}</li>
                <li>{copy.routeExcluded}</li>
              </ul>
              {physiologyAvailable && (
                <label className="report-sensitive-choice">
                  <input
                    type="checkbox"
                    checked={exportPhysiology}
                    disabled={exporting || !savedPhysiologyAllowed}
                    onChange={(event) => setExportPhysiology(event.target.checked)}
                  />
                  <span>
                    <strong>{copy.exportHeartRate}</strong>
                    <small>{savedPhysiologyAllowed
                      ? copy.exportHeartRateHelp
                      : copy.exportHeartRateNotAllowed}</small>
                  </span>
                </label>
              )}
              <p className="report-local-output">{copy.localOutput}</p>
              <div className="report-actions">
                <button
                  type="button"
                  onClick={() => void exportReport()}
                  disabled={exporting}
                >
                  {exporting ? copy.exporting : copy.chooseDestination}
                </button>
                {exporting ? (
                  <button type="button" className="secondary" onClick={() => void cancelExport()}>
                    {copy.cancelExport}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setPrivacyReviewOpen(false)}
                  >
                    {copy.closeReview}
                  </button>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
