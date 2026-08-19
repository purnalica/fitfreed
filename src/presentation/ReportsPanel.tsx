import { type FormEvent, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { chooseReportDestination } from "../infrastructure/report-destination";
import { type catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import { routeSvgPoints } from "./route-svg";
import type {
  ReportBlock,
  ReportDefinition,
  ReportExportReceipt,
  ReportList,
  ReportRouteEvidence,
  ReportSummary,
  ResolvedSessionReport,
  RouteReportBlock,
  SessionReportBlockDraft,
  SessionReportOrigin,
} from "./session-report";
import { sessionReportBlock } from "./session-report";
import {
  formatDistance,
  formatDuration,
  formatExactMetric,
  formatTrainingDateTime,
} from "./training-format";
import type {
  TrainingRouteOverview,
  TrainingSessionRoutesResult,
} from "./training-session-route";
import type { TrainingSessionSport } from "./training-session-search";

const REPORT_ROUTE_VISUAL_POINT_LIMIT = 400;
const DEFAULT_ROUTE_REDACTION_METERS = 200;
const MAX_ROUTE_REDACTION_METERS = 5000;

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
  blocks: SessionReportBlockDraft[];
}

interface RouteExportChoice {
  includeGeometry: boolean;
  endpointRedactionInput: string;
}

function draftFromBlock(block: ReportBlock): SessionReportBlockDraft {
  switch (block.kind) {
    case "session-evidence":
      return {
        blockRef: block.blockRef,
        kind: block.kind,
        includePhysiologicalContext: block.includePhysiologicalContext,
      };
    case "route":
      return {
        blockRef: block.blockRef,
        kind: block.kind,
        routeRef: block.routeRef,
        endpointRedactionMeters: block.endpointRedactionMeters,
      };
    case "narrative":
      return { blockRef: block.blockRef, kind: block.kind, body: block.body };
  }
}

function editorFromDefinition(definition: ReportDefinition): EditorState {
  return {
    reportRef: definition.reportRef,
    revision: definition.revision,
    sourceSnapshotRef: definition.sourceSnapshotRef,
    sessionRef: definition.origin.sessionRef,
    title: definition.title,
    blocks: definition.blocks.map(draftFromBlock),
  };
}

function flattenRoutes(result: TrainingSessionRoutesResult): TrainingRouteOverview[] {
  const routes: TrainingRouteOverview[] = [];
  for (const exercise of result.routes?.exercises ?? []) {
    if (exercise.routes?.primary) routes.push(exercise.routes.primary);
    if (exercise.routes?.transition) routes.push(exercise.routes.transition);
  }
  return routes;
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

function blockKey(block: SessionReportBlockDraft, index: number): string {
  if (block.blockRef) return block.blockRef;
  if (block.kind === "route") return `new-route-${block.routeRef}`;
  return `new-${block.kind}-${index}`;
}

function routeBlock(
  definition: ReportDefinition,
  blockRef: string,
): RouteReportBlock | undefined {
  return definition.blocks.find(
    (block): block is RouteReportBlock => block.kind === "route" && block.blockRef === blockRef,
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
  const [availableRoutes, setAvailableRoutes] = useState<TrainingRouteOverview[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesFailed, setRoutesFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [localError, setLocalError] = useState<string>();
  const [savedNotice, setSavedNotice] = useState(false);
  const [privacyReviewOpen, setPrivacyReviewOpen] = useState(false);
  const [exportPhysiology, setExportPhysiology] = useState(false);
  const [exportRoutes, setExportRoutes] = useState<Record<string, RouteExportChoice>>({});
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
      blocks: [
        {
          kind: "session-evidence",
          includePhysiologicalContext:
            origin.session.averageHeartRateBpm !== null
            || origin.session.maximumHeartRateBpm !== null,
        },
        { kind: "narrative", body: "" },
      ],
    });
    setResolved(undefined);
    setLocalError(undefined);
    setSavedNotice(false);
    setPrivacyReviewOpen(false);
    setExportedBytes(undefined);
  }, [originRequestId]);

  useEffect(() => {
    let active = true;
    if (!editor) {
      setAvailableRoutes([]);
      setRoutesLoading(false);
      setRoutesFailed(false);
      return () => { active = false; };
    }
    setAvailableRoutes([]);
    setRoutesLoading(true);
    setRoutesFailed(false);
    void invoke<TrainingSessionRoutesResult>("query_training_session_routes", {
      query: {
        sessionRef: editor.sessionRef,
        snapshotRef: editor.sourceSnapshotRef,
        maxVisualPoints: REPORT_ROUTE_VISUAL_POINT_LIMIT,
      },
    }).then((result) => {
      if (active) setAvailableRoutes(flattenRoutes(result));
    }).catch((reason) => {
      if (!active) return;
      setRoutesFailed(true);
      onError(commandErrorCode(reason));
    }).finally(() => {
      if (active) setRoutesLoading(false);
    });
    return () => { active = false; };
  }, [editor?.sessionRef, editor?.sourceSnapshotRef, onError]);

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

  function updateBlock(index: number, block: SessionReportBlockDraft) {
    setEditor((current) => {
      if (!current) return current;
      const blocks = [...current.blocks];
      blocks[index] = block;
      return { ...current, blocks };
    });
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setEditor((current) => {
      if (!current) return current;
      const destination = index + direction;
      if (destination < 0 || destination >= current.blocks.length) return current;
      const blocks = [...current.blocks];
      [blocks[index], blocks[destination]] = [blocks[destination], blocks[index]];
      return { ...current, blocks };
    });
  }

  function removeRoute(index: number) {
    setEditor((current) => current
      ? { ...current, blocks: current.blocks.filter((_block, blockIndex) => blockIndex !== index) }
      : current);
  }

  function addRoute(route: TrainingRouteOverview) {
    setEditor((current) => current
      ? {
          ...current,
          blocks: [
            ...current.blocks,
            {
              kind: "route",
              routeRef: route.routeRef,
              endpointRedactionMeters: DEFAULT_ROUTE_REDACTION_METERS,
            },
          ],
        }
      : current);
  }

  async function saveReport(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;
    const title = editor.title.trim();
    const blocks = editor.blocks.map((block) => block.kind === "narrative"
      ? { ...block, body: block.body.trim() }
      : block);
    if (!title || !blocks.some((block) => block.kind === "narrative" && block.body)) {
      setLocalError("invalid-report-definition");
      return;
    }
    setSaving(true);
    setLocalError(undefined);
    setSavedNotice(false);
    try {
      let definition: ReportDefinition;
      if (editor.reportRef && editor.revision) {
        definition = await invoke<ReportDefinition>("update_composed_session_report", {
          request: {
            reportRef: editor.reportRef,
            expectedRevision: editor.revision,
            title,
            locale,
            blocks,
          },
        });
      } else {
        definition = await invoke<ReportDefinition>("create_composed_session_report", {
          request: {
            title,
            locale,
            sessionRef: editor.sessionRef,
            sourceSnapshotRef: editor.sourceSnapshotRef,
            blocks,
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
    setExportRoutes(Object.fromEntries(resolved.routes.map((route) => [
      route.blockRef,
      {
        includeGeometry: route.included,
        endpointRedactionInput: route.endpointRedactionMeters.toString(),
      },
    ])));
    setPrivacyReviewOpen(true);
    setExportedBytes(undefined);
  }

  async function exportReport() {
    if (!resolved || resolved.status !== "current") return;
    const routeChoices = resolved.routes.map((route) => {
      const choice = exportRoutes[route.blockRef] ?? {
        includeGeometry: false,
        endpointRedactionInput: route.endpointRedactionMeters.toString(),
      };
      const endpointRedactionMeters = Number(choice.endpointRedactionInput);
      if (
        !Number.isInteger(endpointRedactionMeters)
        || endpointRedactionMeters < route.endpointRedactionMeters
        || endpointRedactionMeters > MAX_ROUTE_REDACTION_METERS
      ) {
        return undefined;
      }
      return {
        blockRef: route.blockRef,
        includeGeometry: choice.includeGeometry,
        endpointRedactionMeters,
      };
    });
    if (routeChoices.some((choice) => choice === undefined)) {
      setLocalError("invalid-report-definition");
      return;
    }
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
          routeChoices,
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

  function routeLabel(route: Pick<TrainingRouteOverview, "kind" | "startedAtLocal">): string {
    return interpolate(copy.routeLabel, {
      kind: copy.routeKinds[route.kind],
      time: formatTrainingDateTime(route.startedAtLocal, locale),
    });
  }

  function editorBlockLabel(block: SessionReportBlockDraft): string {
    if (block.kind === "session-evidence") return copy.sessionBlockHeading;
    if (block.kind === "narrative") return copy.interpretationHeading;
    const route = availableRoutes.find((candidate) => candidate.routeRef === block.routeRef)
      ?? resolved?.routes.find((candidate) => candidate.routeRef === block.routeRef);
    return route ? routeLabel(route) : copy.routeBlockHeading;
  }

  function renderRoutePreview(evidence: ReportRouteEvidence) {
    const points = routeSvgPoints(evidence.visualPoints);
    const coordinates = points.split(" ").filter(Boolean);
    return (
      <article className="report-route-preview" key={evidence.blockRef}>
        <h3>{routeLabel(evidence)}</h3>
        <p className="report-attribution">{copy.locationAttribution}</p>
        {!evidence.included
          ? <p>{copy.routeOmitted}</p>
          : evidence.visualPoints.length === 0
            ? <p>{copy.routeFullyRedacted}</p>
            : (
              <svg
                className="report-route-visual"
                viewBox="0 0 640 320"
                role="img"
                aria-label={interpolate(copy.routeVisualSummary, {
                  kind: copy.routeKinds[evidence.kind],
                  count: number.format(evidence.sourcePointCount),
                })}
              >
                <rect width="640" height="320" rx="20" />
                {evidence.visualPoints.length === 1
                  ? <circle cx="320" cy="160" r="7" />
                  : (
                    <>
                      <polyline points={points} />
                      <circle
                        className="report-route-start"
                        cx={coordinates[0]?.split(",")[0]}
                        cy={coordinates[0]?.split(",")[1]}
                        r="6"
                      />
                      <circle
                        className="report-route-end"
                        cx={coordinates.at(-1)?.split(",")[0]}
                        cy={coordinates.at(-1)?.split(",")[1]}
                        r="6"
                      />
                    </>
                  )}
              </svg>
            )}
        <dl className="report-evidence-summary">
          <div>
            <dt>{copy.routeSourcePoints}</dt>
            <dd>{number.format(evidence.sourcePointCount)}</dd>
          </div>
          <div>
            <dt>{copy.endpointRedaction}</dt>
            <dd>{interpolate(copy.redactionMeters, {
              meters: number.format(evidence.endpointRedactionMeters),
            })}</dd>
          </div>
        </dl>
      </article>
    );
  }

  function renderPreviewBlock(block: ReportBlock) {
    if (!resolved) return null;
    if (block.kind === "session-evidence") {
      return (
        <article key={block.blockRef}>
          <h3>{copy.sessionBlockHeading}</h3>
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
      );
    }
    if (block.kind === "narrative") {
      return (
        <article key={block.blockRef}>
          <h3>{copy.interpretationHeading}</h3>
          <p className="report-attribution">{copy.authoredAttribution}</p>
          <p className="report-narrative">{block.body}</p>
        </article>
      );
    }
    const evidence = resolved.routes.find((route) => route.blockRef === block.blockRef);
    return evidence ? renderRoutePreview(evidence) : (
      <article key={block.blockRef}>
        <h3>{copy.routeBlockHeading}</h3>
        <p>{copy.routeEvidenceUnavailable}</p>
      </article>
    );
  }

  const physiologyAvailable = resolved
    ? resolved.sensitiveContents.some((content) => content.kind === "heart-rate")
    : origin?.session.averageHeartRateBpm !== null
      || origin?.session.maximumHeartRateBpm !== null;
  const savedPhysiologyAllowed = resolved
    ? sessionReportBlock(resolved.definition).includePhysiologicalContext
    : editor?.blocks.some(
      (block) => block.kind === "session-evidence" && block.includePhysiologicalContext,
    ) ?? false;
  const selectedRouteRefs = new Set(editor?.blocks.flatMap(
    (block) => block.kind === "route" ? [block.routeRef] : [],
  ) ?? []);
  const unselectedRoutes = availableRoutes.filter(
    (route) => !selectedRouteRefs.has(route.routeRef),
  );

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
          {listFailed && <p role="alert">{copy.errors["report-definition-query-failed"]}</p>}
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

              <section className="report-composer" aria-labelledby="report-blocks-heading">
                <div>
                  <h3 id="report-blocks-heading">{copy.blocksHeading}</h3>
                  <p>{copy.blocksIntro}</p>
                </div>
                <ol className="report-block-list">
                  {editor.blocks.map((block, index) => {
                    const label = editorBlockLabel(block);
                    return (
                      <li className="report-block-editor" key={blockKey(block, index)}>
                        <div className="report-block-heading">
                          <div>
                            <span className="report-block-order">{index + 1}</span>
                            <h4>{label}</h4>
                          </div>
                          <div className="report-block-controls">
                            <button
                              type="button"
                              className="secondary"
                              aria-label={interpolate(copy.moveEarlier, { block: label })}
                              disabled={disabled || saving || index === 0}
                              onClick={() => moveBlock(index, -1)}
                            >
                              <span aria-hidden="true">↑</span>
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              aria-label={interpolate(copy.moveLater, { block: label })}
                              disabled={disabled || saving || index === editor.blocks.length - 1}
                              onClick={() => moveBlock(index, 1)}
                            >
                              <span aria-hidden="true">↓</span>
                            </button>
                            {block.kind === "route" && (
                              <button
                                type="button"
                                className="secondary danger-action"
                                onClick={() => removeRoute(index)}
                                disabled={disabled || saving}
                              >
                                {copy.removeRoute}
                              </button>
                            )}
                          </div>
                        </div>
                        {block.kind === "session-evidence" && (
                          <label className="report-sensitive-choice">
                            <input
                              type="checkbox"
                              checked={block.includePhysiologicalContext}
                              disabled={disabled || saving || !physiologyAvailable}
                              onChange={(event) => updateBlock(index, {
                                ...block,
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
                        )}
                        {block.kind === "narrative" && (
                          <div className="report-field">
                            <label htmlFor={`report-narrative-${index}`}>{copy.narrativeLabel}</label>
                            <textarea
                              id={`report-narrative-${index}`}
                              aria-describedby={`report-narrative-help-${index}`}
                              value={block.body}
                              maxLength={10_000}
                              rows={8}
                              required
                              disabled={disabled || saving}
                              onChange={(event) => updateBlock(index, {
                                ...block,
                                body: event.target.value,
                              })}
                            />
                            <small id={`report-narrative-help-${index}`}>{copy.narrativeHelp}</small>
                          </div>
                        )}
                        {block.kind === "route" && (
                          <div className="report-route-settings">
                            <label>
                              <span>{copy.endpointRedactionLabel}</span>
                              <input
                                type="number"
                                min={0}
                                max={MAX_ROUTE_REDACTION_METERS}
                                step={50}
                                value={block.endpointRedactionMeters}
                                disabled={disabled || saving}
                                onChange={(event) => updateBlock(index, {
                                  ...block,
                                  endpointRedactionMeters: Number(event.target.value),
                                })}
                              />
                            </label>
                            <p>{block.endpointRedactionMeters === 0
                              ? copy.zeroRedactionWarning
                              : copy.endpointRedactionHelp}</p>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>

              <section className="report-route-picker" aria-labelledby="report-add-route-heading">
                <h3 id="report-add-route-heading">{copy.addRouteHeading}</h3>
                <p>{copy.addRouteIntro}</p>
                {routesLoading && <p role="status">{copy.routesLoading}</p>}
                {routesFailed && <p role="alert">{copy.routesFailed}</p>}
                {!routesLoading && !routesFailed && availableRoutes.length === 0 && (
                  <p>{copy.noRoutes}</p>
                )}
                {!routesLoading && unselectedRoutes.length > 0 && (
                  <ul>
                    {unselectedRoutes.map((route) => (
                      <li key={route.routeRef}>
                        <button
                          type="button"
                          className="secondary"
                          disabled={disabled || saving}
                          onClick={() => addRoute(route)}
                        >
                          {interpolate(copy.addRoute, {
                            route: routeLabel(route),
                            count: number.format(route.pointCount),
                          })}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!routesLoading
                  && availableRoutes.length > 0
                  && unselectedRoutes.length === 0
                  && <p>{copy.allRoutesAdded}</p>}
              </section>

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
              <h3 className="report-preview-title">{resolved.definition.title}</h3>
              {resolved.definition.blocks.map(renderPreviewBlock)}
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
                <li>{copy.exactSamplesExcluded}</li>
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
              {resolved.routes.length > 0 && (
                <section className="report-route-review" aria-labelledby="report-route-review-heading">
                  <h3 id="report-route-review-heading">{copy.routeReviewHeading}</h3>
                  <p>{copy.routeReviewIntro}</p>
                  {resolved.routes.map((route) => {
                    const choice = exportRoutes[route.blockRef] ?? {
                      includeGeometry: false,
                      endpointRedactionInput: route.endpointRedactionMeters.toString(),
                    };
                    const minimum = routeBlock(resolved.definition, route.blockRef)
                      ?.endpointRedactionMeters ?? route.endpointRedactionMeters;
                    return (
                      <div className="report-route-choice" key={route.blockRef}>
                        <label className="report-sensitive-choice">
                          <input
                            type="checkbox"
                            checked={choice.includeGeometry}
                            disabled={exporting}
                            onChange={(event) => setExportRoutes({
                              ...exportRoutes,
                              [route.blockRef]: {
                                ...choice,
                                includeGeometry: event.target.checked,
                              },
                            })}
                          />
                          <span>
                            <strong>{interpolate(copy.exportRoute, {
                              route: routeLabel(route),
                            })}</strong>
                            <small>{copy.exportRouteHelp}</small>
                          </span>
                        </label>
                        <label>
                          <span>{copy.exportEndpointRedaction}</span>
                          <input
                            type="number"
                            min={minimum}
                            max={MAX_ROUTE_REDACTION_METERS}
                            step={50}
                            value={choice.endpointRedactionInput}
                            disabled={exporting || !choice.includeGeometry}
                            onChange={(event) => setExportRoutes({
                              ...exportRoutes,
                              [route.blockRef]: {
                                ...choice,
                                endpointRedactionInput: event.target.value,
                              },
                            })}
                          />
                        </label>
                      </div>
                    );
                  })}
                </section>
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
