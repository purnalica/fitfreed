import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { chooseReportDestination } from "../infrastructure/report-destination";
import { type catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import { WorkspaceNavigation } from "./WorkspaceNavigation";
import { restoreFocusAfterReveal } from "./focus-restoration";
import { ProgressSubmitButton } from "./ProgressSubmitButton";
import { SportFamilyIcon } from "./SportFamilyIcon";
import { reportSourceTarget, type ReportSourceTarget } from "./report-navigation";
import { routeSvgPoints } from "./route-svg";
import type {
  AnalyticalReportBlock,
  ReportBlock,
  ReportDefinition,
  ReportExportReceipt,
  ReportLibraryItem,
  ReportLibraryMetricValue,
  ReportLibraryPage,
  ReportOrigin,
  RemovedReport,
  RefreshReportRequest,
  ReportRouteEvidence,
  ReportStart,
  ReportStartOrigin,
  ReportTrainingComparisonQuery,
  ReportTrainingMetric,
  ResolvedReport,
  RouteReportBlock,
  PreparedReportStart,
  SessionReportBlockDraft,
} from "./session-report";
import {
  formatDistance,
  formatDuration,
  formatExactMetric,
  formatSessionCardDate,
  formatSessionCardDistance,
  formatSessionCardDuration,
  formatTrainingDateTime,
} from "./training-format";
import type {
  TrainingDateRange,
  TrainingSeriesComparison,
  TrainingSeriesSummary,
} from "./training-insights";
import type {
  TrainingRouteOverview,
  TrainingSessionRoutesResult,
} from "./training-session-route";
import type { TrainingSessionSport } from "./training-session-search";

const REPORT_ROUTE_VISUAL_POINT_LIMIT = 400;
const REPORT_LIBRARY_PAGE_SIZE = 12;
const DEFAULT_ROUTE_REDACTION_METERS = 200;
const MAX_ROUTE_REDACTION_METERS = 5000;

type AnalyticalBlockKind =
  | "training-finding"
  | "training-comparison"
  | "training-chart"
  | "training-exact-table"
  | "training-coverage";

type ReportWorkspace = "library" | "compose" | "preview";

const ANALYTICAL_BLOCK_KINDS: AnalyticalBlockKind[] = [
  "training-finding",
  "training-comparison",
  "training-chart",
  "training-exact-table",
  "training-coverage",
];

const REPORT_TRAINING_METRICS: ReportTrainingMetric[] = [
  "session-count",
  "training-days",
  "duration",
  "distance",
  "energy",
];

interface ReportsPanelProps {
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  origin?: ReportStartOrigin;
  originRequestId: number;
  openReportRef?: string;
  openReportRequestId?: number;
  disabled: boolean;
  onReturnToOrigin: (target: ReportSourceTarget | null) => void;
}

interface EditorState {
  reportRef?: string;
  revision?: string;
  sourceSnapshotRef: string;
  origin: ReportOrigin;
  sessionRef?: string;
  suggestedQuery?: ReportTrainingComparisonQuery;
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
    case "training-finding":
    case "training-chart":
      return {
        blockRef: block.blockRef,
        kind: block.kind,
        query: block.query,
        metric: block.metric,
      };
    case "training-comparison":
    case "training-exact-table":
    case "training-coverage":
      return { blockRef: block.blockRef, kind: block.kind, query: block.query };
  }
}

function isAnalyticalBlock(
  block: SessionReportBlockDraft,
): block is Extract<SessionReportBlockDraft, { kind: AnalyticalBlockKind }> {
  return ANALYTICAL_BLOCK_KINDS.includes(block.kind as AnalyticalBlockKind);
}

function isAnalyticalReportBlock(block: ReportBlock): block is AnalyticalReportBlock {
  return ANALYTICAL_BLOCK_KINDS.includes(block.kind as AnalyticalBlockKind);
}

function defaultComparisonQuery(startedAtLocal: string): ReportTrainingComparisonQuery {
  const sessionDate = startedAtLocal.slice(0, 10);
  return {
    question: "training-period-comparison",
    questionVersion: 1,
    baselineRange: { from: sessionDate, through: sessionDate },
    comparisonRange: { from: sessionDate, through: sessionDate },
  };
}

function comparisonQuery(blocks: SessionReportBlockDraft[]): ReportTrainingComparisonQuery | undefined {
  return blocks.find(isAnalyticalBlock)?.query;
}

function hasSupportedEvidence(
  origin: ReportOrigin,
  blocks: SessionReportBlockDraft[],
): boolean {
  if (origin.kind === "session") {
    return blocks.some((block) => block.kind === "session-evidence");
  }
  return blocks.some(isAnalyticalBlock);
}

function formatReportRange(range: TrainingDateRange, locale: Locale): string {
  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  const format = (value: string) => formatter.format(new Date(`${value}T00:00:00Z`));
  return `${format(range.from)} – ${format(range.through)}`;
}

function validReportRange(range: TrainingDateRange): boolean {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    const milliseconds = Date.parse(`${value}T00:00:00Z`);
    if (!Number.isFinite(milliseconds)) return undefined;
    return new Date(milliseconds).toISOString().slice(0, 10) === value
      ? milliseconds
      : undefined;
  };
  const from = parse(range.from);
  const through = parse(range.through);
  if (from === undefined || through === undefined || from > through) return false;
  return (through - from) / 86_400_000 < 366;
}

function editorFromDefinition(definition: ReportDefinition): EditorState {
  return {
    reportRef: definition.reportRef,
    revision: definition.revision,
    sourceSnapshotRef: definition.sourceSnapshotRef,
    origin: definition.origin,
    sessionRef: definition.origin.kind === "session"
      ? definition.origin.sessionRef
      : undefined,
    suggestedQuery: definition.origin.kind === "exploration"
      ? definition.origin.query
      : definition.blocks.find(isAnalyticalReportBlock)?.query,
    title: definition.title,
    blocks: definition.blocks.map(draftFromBlock),
  };
}

function analyticalDrafts(
  query: ReportTrainingComparisonQuery,
): SessionReportBlockDraft[] {
  return [
    { kind: "training-finding", query, metric: "session-count" },
    { kind: "training-comparison", query },
    { kind: "training-chart", query, metric: "duration" },
    { kind: "training-exact-table", query },
    { kind: "training-coverage", query },
  ];
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
  openReportRef,
  openReportRequestId,
  disabled,
  onReturnToOrigin,
}: ReportsPanelProps) {
  const copy = messages.reports;
  const [reports, setReports] = useState<ReportLibraryItem[]>([]);
  const [reportCount, setReportCount] = useState(0);
  const [nextReportOffset, setNextReportOffset] = useState<number | null>(null);
  const [workspace, setWorkspace] = useState<ReportWorkspace>("library");
  const [listLoading, setListLoading] = useState(true);
  const [listLoadingMore, setListLoadingMore] = useState(false);
  const [listFailed, setListFailed] = useState(false);
  const [editor, setEditor] = useState<EditorState>();
  const [resolved, setResolved] = useState<ResolvedReport>();
  const [availableRoutes, setAvailableRoutes] = useState<TrainingRouteOverview[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesFailed, setRoutesFailed] = useState(false);
  const [saveOperation, setSaveOperation] = useState<"create" | "update">();
  const saving = saveOperation !== undefined;
  const [resolving, setResolving] = useState(false);
  const [localError, setLocalError] = useState<string>();
  const [savedNotice, setSavedNotice] = useState(false);
  const [refreshedNotice, setRefreshedNotice] = useState(false);
  const [refreshReviewOpen, setRefreshReviewOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteReviewOpen, setDeleteReviewOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removedNotice, setRemovedNotice] = useState<string>();
  const libraryHeadingRef = useRef<HTMLHeadingElement>(null);
  const deleteReviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const deleteReviewOriginRef = useRef<HTMLElement>(null);
  const requestedReportHeadingRef = useRef<HTMLHeadingElement>(null);
  const refreshReviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const refreshReviewOriginRef = useRef<HTMLElement>(null);
  const refreshOutcomeOriginRef = useRef<HTMLElement>(null);
  const refreshedNoticeRef = useRef<HTMLParagraphElement>(null);
  const [privacyReviewOpen, setPrivacyReviewOpen] = useState(false);
  const privacyReviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const privacyReviewOriginRef = useRef<HTMLElement>(null);
  const [exportPhysiology, setExportPhysiology] = useState(false);
  const [exportRoutes, setExportRoutes] = useState<Record<string, RouteExportChoice>>({});
  const [exporting, setExporting] = useState(false);
  const [exportedBytes, setExportedBytes] = useState<string>();
  const exportActionRef = useRef<HTMLButtonElement>(null);
  const exportOutcomeOriginRef = useRef<HTMLElement>(null);
  const interruptedExportControlRef = useRef<HTMLElement>(null);
  const exportedNoticeRef = useRef<HTMLParagraphElement>(null);
  const commentaryFieldRef = useRef<HTMLTextAreaElement>(null);
  const addCommentaryRef = useRef<HTMLButtonElement>(null);
  const commentaryFocusRequestRef = useRef<"field" | "add" | undefined>(undefined);
  const compositionCancelTargetRef = useRef<"library" | "preview" | undefined>(undefined);
  const compositionCancelOriginRef = useRef<HTMLElement>(null);
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const commentaryPresent = editor?.blocks.some((block) => block.kind === "narrative") ?? false;

  useEffect(() => {
    const target = commentaryFocusRequestRef.current;
    if (!target) return;
    commentaryFocusRequestRef.current = undefined;
    return restoreFocusAfterReveal(
      target === "field" ? commentaryFieldRef.current : addCommentaryRef.current,
      undefined,
      { align: "start", forceInitialFocus: true },
    );
  }, [commentaryPresent]);

  async function loadReportPage(offset: number, append: boolean) {
    if (append) setListLoadingMore(true);
    else setListLoading(true);
    setListFailed(false);
    try {
      const result = await invoke<ReportLibraryPage>("list_report_library", {
        request: { offset, limit: REPORT_LIBRARY_PAGE_SIZE },
      });
      setReports((current) => append ? [...current, ...result.items] : result.items);
      setReportCount(result.totalCount);
      setNextReportOffset(result.nextOffset);
    } catch {
      setListFailed(true);
    } finally {
      if (append) setListLoadingMore(false);
      else setListLoading(false);
    }
  }

  async function refreshList() {
    await loadReportPage(0, false);
  }

  async function loadMoreReports() {
    if (nextReportOffset === null || listLoadingMore) return;
    await loadReportPage(nextReportOffset, true);
  }

  useEffect(() => {
    void refreshList();
  }, []);

  function resetTransientReportState() {
    setResolved(undefined);
    setLocalError(undefined);
    setSavedNotice(false);
    setRefreshedNotice(false);
    setRefreshReviewOpen(false);
    setDeleteReviewOpen(false);
    setPrivacyReviewOpen(false);
    setExportedBytes(undefined);
    setRemovedNotice(undefined);
  }

  async function beginPreparedReport(start: ReportStart, title: string) {
    setWorkspace("compose");
    setResolving(true);
    setLocalError(undefined);
    try {
      const prepared = await invoke<PreparedReportStart>("prepare_report_start", { start });
      let blocks: SessionReportBlockDraft[];
      if (prepared.origin.kind === "blank") {
        blocks = [{ kind: "narrative", body: "" }];
      } else if (prepared.suggestedQuery) {
        blocks = analyticalDrafts(prepared.suggestedQuery);
      } else {
        throw new Error("invalid-report-definition");
      }
      setEditor({
        sourceSnapshotRef: prepared.sourceSnapshotRef,
        origin: prepared.origin,
        suggestedQuery: prepared.suggestedQuery ?? undefined,
        title,
        blocks,
      });
      resetTransientReportState();
    } catch (reason) {
      const code = commandErrorCode(reason);
      setLocalError(code);
      setWorkspace("library");
    } finally {
      setResolving(false);
    }
  }

  function beginTrainingComparisonReport() {
    void beginPreparedReport(
      {
        kind: "question",
        question: "training-period-comparison",
        questionVersion: 1,
      },
      copy.questionDefaultTitle,
    );
  }

  useEffect(() => {
    if (!origin || originRequestId === 0) return;
    if (origin.kind === "session") {
      setWorkspace("compose");
      setEditor({
        sourceSnapshotRef: origin.snapshotRef,
        origin: { kind: "session", sessionRef: origin.session.sessionRef },
        sessionRef: origin.session.sessionRef,
        suggestedQuery: defaultComparisonQuery(origin.session.startedAtLocal),
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
        ],
      });
      resetTransientReportState();
      return;
    }
    if (origin.kind === "question") {
      void beginPreparedReport(
        {
          kind: "question",
          question: "training-period-comparison",
          questionVersion: 1,
        },
        copy.questionDefaultTitle,
      );
      return;
    }
    void beginPreparedReport(
      { kind: "exploration", query: origin.query },
      copy.explorationDefaultTitle,
    );
  }, [originRequestId]);

  useEffect(() => {
    if (!openReportRef || openReportRequestId === undefined) return;
    void openReport(openReportRef);
  }, [openReportRef, openReportRequestId]);

  useEffect(() => {
    if (resolved?.definition.reportRef !== openReportRef) return;
    return restoreFocusAfterReveal(requestedReportHeadingRef.current);
  }, [openReportRef, openReportRequestId, resolved?.definition.reportRef]);

  useEffect(() => {
    if (!refreshReviewOpen) return;
    return restoreFocusAfterReveal(
      refreshReviewHeadingRef.current,
      refreshReviewOriginRef.current,
    );
  }, [refreshReviewOpen]);

  useEffect(() => {
    if (!privacyReviewOpen) return;
    return restoreFocusAfterReveal(
      privacyReviewHeadingRef.current,
      privacyReviewOriginRef.current,
    );
  }, [privacyReviewOpen]);

  useEffect(() => {
    if (!deleteReviewOpen) return;
    return restoreFocusAfterReveal(
      deleteReviewHeadingRef.current,
      deleteReviewOriginRef.current,
    );
  }, [deleteReviewOpen]);

  useEffect(() => {
    if (!removedNotice) return;
    return restoreFocusAfterReveal(libraryHeadingRef.current);
  }, [removedNotice]);

  useEffect(() => {
    const target = compositionCancelTargetRef.current;
    if (!target || workspace !== target) return;
    compositionCancelTargetRef.current = undefined;
    return restoreFocusAfterReveal(
      target === "preview" ? requestedReportHeadingRef.current : libraryHeadingRef.current,
      compositionCancelOriginRef.current,
    );
  }, [workspace]);

  useEffect(() => {
    if (!refreshedNotice) return;
    return restoreFocusAfterReveal(
      refreshedNoticeRef.current,
      refreshOutcomeOriginRef.current,
    );
  }, [refreshedNotice]);

  useEffect(() => {
    if (!exportedBytes) return;
    return restoreFocusAfterReveal(
      exportedNoticeRef.current,
      exportOutcomeOriginRef.current,
    );
  }, [exportedBytes]);

  useEffect(() => {
    let active = true;
    if (!editor?.sessionRef) {
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
    }).catch(() => {
      if (!active) return;
      setRoutesFailed(true);
    }).finally(() => {
      if (active) setRoutesLoading(false);
    });
    return () => { active = false; };
  }, [editor?.sessionRef, editor?.sourceSnapshotRef]);

  async function resolveReport(reportRef: string) {
    setResolving(true);
    setLocalError(undefined);
    try {
      const result = await invoke<ResolvedReport>("resolve_report", {
        reportRef,
      });
      const nextEditor = editorFromDefinition(result.definition);
      if (
        nextEditor.origin.kind === "blank"
        && !nextEditor.suggestedQuery
        && result.status === "current"
      ) {
        const prepared = await invoke<PreparedReportStart>("prepare_report_start", {
          start: { kind: "blank" },
        });
        if (prepared.sourceSnapshotRef === nextEditor.sourceSnapshotRef) {
          nextEditor.suggestedQuery = prepared.suggestedQuery ?? undefined;
        }
      }
      setResolved(result);
      setEditor(nextEditor);
      setExportPhysiology(result.definition.blocks.some(
        (block) => block.kind === "session-evidence" && block.includePhysiologicalContext,
      ));
      setRefreshReviewOpen(false);
      setPrivacyReviewOpen(false);
      setExportedBytes(undefined);
      return result;
    } catch (reason) {
      const code = commandErrorCode(reason);
      setLocalError(code);
      return undefined;
    } finally {
      setResolving(false);
    }
  }

  async function openReport(reportRef: string) {
    setWorkspace("preview");
    setRemovedNotice(undefined);
    setSavedNotice(false);
    setRefreshedNotice(false);
    setEditor(undefined);
    setResolved(undefined);
    const report = await resolveReport(reportRef);
    if (!report) setWorkspace("library");
    return report;
  }

  function cancelComposition(initiatingElement: HTMLElement) {
    compositionCancelOriginRef.current = initiatingElement;
    setLocalError(undefined);
    setSavedNotice(false);
    setRefreshedNotice(false);
    if (resolved) {
      setEditor(editorFromDefinition(resolved.definition));
      compositionCancelTargetRef.current = "preview";
      setWorkspace("preview");
      return;
    }
    setEditor(undefined);
    if (origin) {
      onReturnToOrigin(null);
      return;
    }
    compositionCancelTargetRef.current = "library";
    setWorkspace("library");
  }

  function beginDeleteReview(originElement: HTMLElement) {
    if (!resolved) return;
    deleteReviewOriginRef.current = originElement;
    setLocalError(undefined);
    setDeleteReviewOpen(true);
  }

  function closeDeleteReview(initiatingElement: HTMLElement) {
    setDeleteReviewOpen(false);
    restoreFocusAfterReveal(deleteReviewOriginRef.current, initiatingElement);
  }

  async function confirmDeleteReport() {
    if (!resolved) return;
    const { reportRef, revision } = resolved.definition;
    setDeleting(true);
    setLocalError(undefined);
    try {
      const removed = await invoke<RemovedReport>("remove_report", {
        request: { reportRef, expectedRevision: revision },
      });
      setDeleteReviewOpen(false);
      setResolved(undefined);
      setEditor(undefined);
      setWorkspace("library");
      await refreshList();
      setRemovedNotice(interpolate(copy.delete.removed, { title: removed.title }));
    } catch (reason) {
      const code = commandErrorCode(reason);
      setDeleteReviewOpen(false);
      if (code === "report-definition-conflict") {
        await refreshList();
        const current = await resolveReport(reportRef);
        setWorkspace(current ? "preview" : "library");
      }
      setLocalError(code);
      restoreFocusAfterReveal(deleteReviewOriginRef.current);
    } finally {
      setDeleting(false);
    }
  }

  function beginRefreshReview(origin: HTMLElement) {
    if (!resolved || resolved.status !== "stale") return;
    refreshReviewOriginRef.current = origin;
    setLocalError(undefined);
    setRefreshReviewOpen(true);
  }

  function closeRefreshReview(initiatingElement: HTMLElement) {
    setRefreshReviewOpen(false);
    restoreFocusAfterReveal(refreshReviewOriginRef.current, initiatingElement);
  }

  async function confirmRefresh(initiatingElement: HTMLElement) {
    if (!resolved || resolved.status !== "stale") return;
    refreshOutcomeOriginRef.current = initiatingElement;
    const request: RefreshReportRequest = {
      reportRef: resolved.definition.reportRef,
      expectedRevision: resolved.definition.revision,
      expectedSourceSnapshotRef: resolved.definition.sourceSnapshotRef,
      expectedResolvedSnapshotRef: resolved.resolvedSnapshotRef,
    };
    setRefreshing(true);
    setLocalError(undefined);
    setRefreshedNotice(false);
    try {
      const definition = await invoke<ReportDefinition>("refresh_report", { request });
      setEditor(editorFromDefinition(definition));
      setResolved(undefined);
      setRefreshReviewOpen(false);
      await refreshList();
      const current = await resolveReport(definition.reportRef);
      if (current) setRefreshedNotice(true);
    } catch (reason) {
      const code = commandErrorCode(reason);
      setLocalError(code);
    } finally {
      setRefreshing(false);
    }
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

  function removeAnalyticalBlock(index: number) {
    setEditor((current) => current
      ? { ...current, blocks: current.blocks.filter((_block, blockIndex) => blockIndex !== index) }
      : current);
  }

  function addCommentary() {
    commentaryFocusRequestRef.current = "field";
    setEditor((current) => {
      if (!current || current.blocks.some((block) => block.kind === "narrative")) {
        return current;
      }
      return {
        ...current,
        blocks: [...current.blocks, { kind: "narrative", body: "" }],
      };
    });
  }

  function removeCommentary(index: number) {
    commentaryFocusRequestRef.current = "add";
    setEditor((current) => current
      ? { ...current, blocks: current.blocks.filter((_block, blockIndex) => blockIndex !== index) }
      : current);
  }

  function updateComparisonQuery(query: ReportTrainingComparisonQuery) {
    setEditor((current) => current
      ? {
          ...current,
          blocks: current.blocks.map((block) => isAnalyticalBlock(block)
            ? { ...block, query }
            : block),
        }
      : current);
  }

  function updateComparisonRange(
    range: "baselineRange" | "comparisonRange",
    boundary: "from" | "through",
    value: string,
  ) {
    const query = editor ? comparisonQuery(editor.blocks) : undefined;
    if (!query) return;
    if (localError === "invalid-report-comparison-range") setLocalError(undefined);
    updateComparisonQuery({
      ...query,
      [range]: { ...query[range], [boundary]: value },
    });
  }

  function addAnalyticalBlock(kind: AnalyticalBlockKind) {
    setEditor((current) => {
      if (!current || current.blocks.some((block) => block.kind === kind)) return current;
      const query = comparisonQuery(current.blocks) ?? current.suggestedQuery;
      if (!query) return current;
      const block: SessionReportBlockDraft = kind === "training-finding"
        ? { kind, query, metric: "session-count" }
        : kind === "training-chart"
          ? { kind, query, metric: "duration" }
          : { kind, query };
      return { ...current, blocks: [...current.blocks, block] };
    });
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
    const blocks = editor.blocks.flatMap((block): SessionReportBlockDraft[] => {
      if (block.kind !== "narrative") return [block];
      const body = block.body.trim();
      return body ? [{ ...block, body }] : [];
    });
    const hasCommentary = blocks.some((block) => block.kind === "narrative");
    if (!title || (!hasSupportedEvidence(editor.origin, blocks) && !hasCommentary)) {
      setLocalError("invalid-report-definition");
      return;
    }
    const query = comparisonQuery(blocks);
    if (query && (
      !validReportRange(query.baselineRange)
      || !validReportRange(query.comparisonRange)
    )) {
      setLocalError("invalid-report-comparison-range");
      return;
    }
    const operation = editor.reportRef && editor.revision ? "update" : "create";
    setSaveOperation(operation);
    setLocalError(undefined);
    setSavedNotice(false);
    try {
      let definition: ReportDefinition;
      if (operation === "update" && editor.reportRef && editor.revision) {
        definition = await invoke<ReportDefinition>("update_report", {
          request: {
            reportRef: editor.reportRef,
            expectedRevision: editor.revision,
            title,
            locale,
            blocks,
          },
        });
      } else {
        definition = await invoke<ReportDefinition>("create_report", {
          request: {
            title,
            locale,
            sourceSnapshotRef: editor.sourceSnapshotRef,
            origin: editor.origin,
            blocks,
          },
        });
      }
      setEditor(editorFromDefinition(definition));
      await refreshList();
      await resolveReport(definition.reportRef);
      setSavedNotice(true);
      setWorkspace("preview");
    } catch (reason) {
      const code = commandErrorCode(reason);
      setLocalError(code);
    } finally {
      setSaveOperation(undefined);
    }
  }

  function beginPrivacyReview(origin: HTMLElement) {
    if (!resolved || resolved.status !== "current") return;
    privacyReviewOriginRef.current = origin;
    setExportPhysiology(resolved.definition.blocks.some(
      (block) => block.kind === "session-evidence" && block.includePhysiologicalContext,
    ));
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

  function closePrivacyReview(initiatingElement: HTMLElement) {
    setPrivacyReviewOpen(false);
    restoreFocusAfterReveal(privacyReviewOriginRef.current, initiatingElement);
  }

  async function exportReport(initiatingElement: HTMLElement) {
    if (!resolved || resolved.status !== "current") return;
    exportOutcomeOriginRef.current = initiatingElement;
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
    interruptedExportControlRef.current = null;
    let completed = false;
    try {
      const receipt = await invoke<ReportExportReceipt>("export_report", {
        request: {
          reportRef: resolved.definition.reportRef,
          expectedRevision: resolved.definition.revision,
          expectedSourceSnapshotRef: resolved.definition.sourceSnapshotRef,
          includePhysiologicalContext: exportPhysiology,
          routeChoices,
          destinationPath: destination,
        },
      });
      completed = true;
      setExportedBytes(receipt.byteCount);
      setPrivacyReviewOpen(false);
    } catch (reason) {
      const code = commandErrorCode(reason);
      setLocalError(code);
    } finally {
      setExporting(false);
      if (!completed) {
        restoreFocusAfterReveal(
          exportActionRef.current,
          interruptedExportControlRef.current,
        );
      }
    }
  }

  async function cancelExport(initiatingElement: HTMLElement) {
    interruptedExportControlRef.current = initiatingElement;
    await invoke<boolean>("cancel_report_export");
  }

  function sportLabel(sport: TrainingSessionSport): string {
    if (sport.classification?.displayLabel) return sport.classification.displayLabel;
    if (sport.classification?.canonicalFamily) {
      return messages.training.sports.families[sport.classification.canonicalFamily];
    }
    return sport.state === "unknown" ? copy.sportUnclassified : copy.sportUnavailable;
  }

  function countWithUnit(
    value: string,
    units: { one: string; other: string },
  ): string {
    const exact = BigInt(value);
    return `${number.format(exact)} ${exact === 1n || exact === -1n ? units.one : units.other}`;
  }

  function formatLibraryMetric(
    value: ReportLibraryMetricValue | null,
    metric: ReportTrainingMetric,
  ): string {
    if (value === null) return copy.library.valueUnavailable;
    const numeric = value.kind === "integer" ? Number(value.value) : value.value;
    switch (metric) {
      case "session-count":
        return value.kind === "integer"
          ? countWithUnit(value.value, copy.library.metricUnits.sessions)
          : `${number.format(numeric)} ${copy.library.metricUnits.sessions.other}`;
      case "training-days":
        return value.kind === "integer"
          ? countWithUnit(value.value, copy.library.metricUnits.days)
          : `${number.format(numeric)} ${copy.library.metricUnits.days.other}`;
      case "duration":
        return formatSessionCardDuration(
          Math.round(numeric).toString(),
          locale,
          messages.training.durationUnits,
        );
      case "distance":
        return numeric < 0
          ? `−${formatSessionCardDistance(-numeric, locale, messages.training.units)}`
          : formatSessionCardDistance(numeric, locale, messages.training.units);
      case "energy":
        return `${number.format(numeric)} ${messages.training.units.kilocalories}`;
    }
  }

  function libraryPeriod(report: ReportLibraryItem): string | null {
    if (report.period?.kind === "session") {
      return formatSessionCardDate(report.period.startedAtLocal, locale);
    }
    if (report.period?.kind === "training-comparison") {
      return interpolate(copy.library.comparisonPeriod, {
        baseline: formatReportRange(report.period.baselineRange, locale),
        comparison: formatReportRange(report.period.comparisonRange, locale),
      });
    }
    return null;
  }

  function renderLibraryResult(report: ReportLibraryItem) {
    if (report.result?.kind === "session") {
      return (
        <div className="report-library-primary-result">
          <span>{copy.analysis.metrics[report.result.metric]}</span>
          <strong>{formatLibraryMetric(report.result.value, report.result.metric)}</strong>
        </div>
      );
    }
    if (report.result?.kind === "training-comparison") {
      const result = report.result;
      return (
        <div className="report-library-comparison-result">
          <p>{copy.analysis.metrics[result.metric]}</p>
          <dl>
            {result.series.map((series) => (
              <div key={series.sourceIndex}>
                <dt>{interpolate(copy.library.source, {
                  number: number.format(series.sourceIndex),
                })}</dt>
                <dd>
                  <strong>{formatLibraryMetric(
                    series.comparisonValue,
                    result.metric,
                  )}</strong>
                  <span>{interpolate(copy.library.comparisonValues, {
                    baseline: formatLibraryMetric(
                      series.baselineValue,
                      result.metric,
                    ),
                    comparison: formatLibraryMetric(
                      series.comparisonValue,
                      result.metric,
                    ),
                    change: formatLibraryMetric(series.change, result.metric),
                  })}</span>
                </dd>
              </div>
            ))}
          </dl>
          {result.omittedSourceCount > 0 && (
            <small>{interpolate(
              result.omittedSourceCount === 1
                ? copy.library.omittedSourceOne
                : copy.library.omittedSourceMany,
              {
                count: number.format(result.omittedSourceCount),
              },
            )}</small>
          )}
        </div>
      );
    }
    return (
      <p className="report-library-result-unavailable">
        {report.evidenceState === "authored-only"
          ? copy.library.authoredOnlyResult
          : copy.library.resultUnavailable}
      </p>
    );
  }

  function renderLibrarySensitivity(report: ReportLibraryItem) {
    const labels: string[] = [];
    if (report.sensitivity.includesPhysiologicalContext) {
      labels.push(copy.library.physiologyIncluded);
    }
    if (report.sensitivity.preciseLocationBlockCount > 0) {
      const count = report.sensitivity.preciseLocationBlockCount;
      const meters = report.sensitivity.minimumEndpointRedactionMeters;
      labels.push(meters === null
        ? interpolate(copy.library.locationIncluded, { count: number.format(count) })
        : interpolate(
            count === 1
              ? copy.library.locationPrivacyOne
              : copy.library.locationPrivacyMany,
            { count: number.format(count), meters: number.format(meters) },
          ));
    }
    return labels.length === 0 ? null : (
      <ul className="report-library-sensitivity" aria-label={copy.library.sensitivity}>
        {labels.map((label) => <li key={label}>{label}</li>)}
      </ul>
    );
  }

  function routeLabel(route: Pick<TrainingRouteOverview, "kind" | "startedAtLocal">): string {
    return interpolate(copy.routeLabel, {
      kind: copy.routeKinds[route.kind],
      time: formatTrainingDateTime(route.startedAtLocal, locale),
    });
  }

  function trainingMetricValue(
    summary: TrainingSeriesSummary,
    metric: ReportTrainingMetric,
  ): string {
    switch (metric) {
      case "session-count":
        return number.format(summary.sessionCount);
      case "training-days":
        return number.format(summary.trainingDays);
      case "duration":
        return formatDuration(
          summary.totalDurationMilliseconds,
          locale,
          messages.training.durationUnits,
        );
      case "distance":
        return formatDistance(
          summary.totalDistanceMeters,
          locale,
          copy.unavailable,
          messages.training.units.meters,
        );
      case "energy":
        return formatExactMetric(
          summary.totalEnergyKilocalories,
          locale,
          copy.unavailable,
          messages.training.units.kilocalories,
        );
    }
  }

  function trainingMetricChange(
    series: TrainingSeriesComparison,
    metric: ReportTrainingMetric,
  ): string {
    switch (metric) {
      case "session-count":
        return formatExactMetric(
          series.sessionCountChange,
          locale,
          copy.unavailable,
          copy.analysis.metricUnits.sessions,
          true,
        );
      case "training-days":
        return formatExactMetric(
          series.trainingDayChange,
          locale,
          copy.unavailable,
          copy.analysis.metricUnits.days,
          true,
        );
      case "duration":
        return formatDuration(
          series.durationMillisecondsChange,
          locale,
          messages.training.durationUnits,
          true,
        );
      case "distance":
        return formatDistance(
          series.distanceMetersChange,
          locale,
          copy.unavailable,
          messages.training.units.meters,
          true,
        );
      case "energy":
        return formatExactMetric(
          series.energyKilocaloriesChange,
          locale,
          copy.unavailable,
          messages.training.units.kilocalories,
          true,
        );
    }
  }

  function trainingMetricMagnitude(
    summary: TrainingSeriesSummary,
    metric: ReportTrainingMetric,
  ): number {
    const value = metric === "session-count"
      ? summary.sessionCount
      : metric === "training-days"
        ? summary.trainingDays
        : metric === "duration"
          ? Number(summary.totalDurationMilliseconds)
          : metric === "distance"
            ? summary.totalDistanceMeters ?? 0
            : Number(summary.totalEnergyKilocalories ?? 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function renderExactComparisonTable(
    series: TrainingSeriesComparison,
    metrics: ReportTrainingMetric[],
    compact = false,
  ) {
    return (
      <div className="table-scroll">
        <table className={compact ? "report-analysis-table compact" : "report-analysis-table"}>
          <thead>
            <tr>
              <th scope="col">{copy.analysis.metric}</th>
              <th scope="col">{copy.analysis.baseline}</th>
              <th scope="col">{copy.analysis.comparison}</th>
              <th scope="col">{copy.analysis.change}</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => (
              <tr key={metric}>
                <th scope="row">{copy.analysis.metrics[metric]}</th>
                <td>{trainingMetricValue(series.baseline, metric)}</td>
                <td>{trainingMetricValue(series.comparison, metric)}</td>
                <td>{trainingMetricChange(series, metric)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderComparisonTable(
    series: TrainingSeriesComparison,
    metrics: ReportTrainingMetric[],
    sourceIndex: number,
  ) {
    return (
      <div className="report-analysis-series" key={series.seriesRef}>
        <h4>{interpolate(copy.analysis.sourceLabel, {
          number: number.format(sourceIndex + 1),
        })}</h4>
        {renderExactComparisonTable(series, metrics)}
      </div>
    );
  }

  function renderAnalyticalPreview(block: AnalyticalReportBlock) {
    const comparison = resolved?.trainingComparison;
    const labels = copy.analysis.blocks[block.kind];
    if (!comparison) {
      return (
        <article key={block.blockRef}>
          <h3>{labels.heading}</h3>
          <p>{copy.analysis.unavailable}</p>
        </article>
      );
    }
    const ranges = (
      <p className="report-attribution">
        {interpolate(copy.analysis.rangeAttribution, {
          baseline: comparison.baselineRange
            ? formatReportRange(comparison.baselineRange, locale)
            : copy.unavailable,
          comparison: comparison.comparisonRange
            ? formatReportRange(comparison.comparisonRange, locale)
            : copy.unavailable,
        })}
      </p>
    );
    if (block.kind === "training-finding") {
      return (
        <article key={block.blockRef}>
          <h3>{labels.heading}</h3>
          {ranges}
          {comparison.series.map((series, index) => (
            <p className="report-analysis-finding" key={series.seriesRef}>
              {interpolate(copy.analysis.finding, {
                source: interpolate(copy.analysis.sourceLabel, {
                  number: number.format(index + 1),
                }),
                metric: copy.analysis.metrics[block.metric],
                baseline: trainingMetricValue(series.baseline, block.metric),
                comparison: trainingMetricValue(series.comparison, block.metric),
                change: trainingMetricChange(series, block.metric),
              })}
            </p>
          ))}
          <p className="report-analysis-limitation">{copy.analysis.descriptiveOnly}</p>
        </article>
      );
    }
    if (block.kind === "training-chart") {
      return (
        <article key={block.blockRef}>
          <h3>{labels.heading}</h3>
          {ranges}
          {comparison.series.map((series, index) => {
            const baseline = trainingMetricMagnitude(series.baseline, block.metric);
            const current = trainingMetricMagnitude(series.comparison, block.metric);
            const maximum = Math.max(baseline, current, 1);
            return (
              <div className="report-analysis-series" key={series.seriesRef}>
                <h4>{interpolate(copy.analysis.sourceLabel, {
                  number: number.format(index + 1),
                })}</h4>
                <div
                  className="report-analysis-bars"
                  role="img"
                  aria-label={copy.analysis.chartSummary}
                >
                  {([
                    [copy.analysis.baseline, baseline, series.baseline],
                    [copy.analysis.comparison, current, series.comparison],
                  ] as const).map(([label, magnitude, summary]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <i style={{ width: `${(magnitude / maximum) * 100}%` }} />
                      <strong>{trainingMetricValue(summary, block.metric)}</strong>
                    </div>
                  ))}
                </div>
                {renderExactComparisonTable(series, [block.metric], true)}
              </div>
            );
          })}
        </article>
      );
    }
    if (block.kind === "training-coverage") {
      return (
        <article key={block.blockRef}>
          <h3>{labels.heading}</h3>
          {ranges}
          {comparison.series.map((series, index) => (
            <div className="report-analysis-series" key={series.seriesRef}>
              <h4>{interpolate(copy.analysis.sourceLabel, {
                number: number.format(index + 1),
              })}</h4>
              <dl className="report-evidence-summary">
                {([
                  [copy.analysis.trainingDaysCoverage, series.baseline.trainingDays, series.comparison.trainingDays, series.baseline.calendarDays, series.comparison.calendarDays],
                  [copy.analysis.distanceCoverage, series.baseline.distanceSessionCount, series.comparison.distanceSessionCount, series.baseline.sessionCount, series.comparison.sessionCount],
                  [copy.analysis.energyCoverage, series.baseline.energySessionCount, series.comparison.energySessionCount, series.baseline.sessionCount, series.comparison.sessionCount],
                  [copy.analysis.heartRateCoverage, series.baseline.heartRateSessionCount, series.comparison.heartRateSessionCount, series.baseline.sessionCount, series.comparison.sessionCount],
                ] as const).map(([label, baseline, current, baselineTotal, currentTotal]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{interpolate(copy.analysis.coverageValue, {
                      baseline: `${number.format(baseline)} / ${number.format(baselineTotal)}`,
                      comparison: `${number.format(current)} / ${number.format(currentTotal)}`,
                    })}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </article>
      );
    }
    const metrics = block.kind === "training-comparison"
      ? (["session-count", "training-days", "duration"] as ReportTrainingMetric[])
      : REPORT_TRAINING_METRICS;
    return (
      <article key={block.blockRef}>
        <h3>{labels.heading}</h3>
        {ranges}
        {comparison.series.map((series, index) => renderComparisonTable(
          series,
          metrics,
          index,
        ))}
      </article>
    );
  }

  function editorBlockLabel(block: SessionReportBlockDraft): string {
    if (block.kind === "session-evidence") return copy.sessionBlockHeading;
    if (block.kind === "narrative") return copy.interpretationHeading;
    if (isAnalyticalBlock(block)) return copy.analysis.blocks[block.kind].heading;
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
    if (isAnalyticalReportBlock(block)) return renderAnalyticalPreview(block);
    if (block.kind === "session-evidence") {
      if (!resolved.session) return null;
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
            <div>
              <dt>{messages.training.trainingType}</dt>
              <dd className="report-sport-identity">
                <SportFamilyIcon
                  family={resolved.session.sport.classification?.canonicalFamily ?? null}
                  state={resolved.session.sport.state}
                />
                <span>{sportLabel(resolved.session.sport)}</span>
              </dd>
            </div>
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
    : origin?.kind === "session" && (
      origin.session.averageHeartRateBpm !== null
      || origin.session.maximumHeartRateBpm !== null
    );
  const savedPhysiologyAllowed = resolved
    ? resolved.definition.blocks.some(
      (block) => block.kind === "session-evidence" && block.includePhysiologicalContext,
    )
    : editor?.blocks.some(
      (block) => block.kind === "session-evidence" && block.includePhysiologicalContext,
    ) ?? false;
  const selectedRouteRefs = new Set(editor?.blocks.flatMap(
    (block) => block.kind === "route" ? [block.routeRef] : [],
  ) ?? []);
  const unselectedRoutes = availableRoutes.filter(
    (route) => !selectedRouteRefs.has(route.routeRef),
  );
  const analyticalQuery = editor ? comparisonQuery(editor.blocks) : undefined;
  const unselectedAnalyticalKinds = ANALYTICAL_BLOCK_KINDS.filter(
    (kind) => !editor?.blocks.some((block) => block.kind === kind),
  );
  const definitionInvalid = localError === "invalid-report-definition";
  const comparisonRangeInvalid = localError === "invalid-report-comparison-range";
  const editingLocked = disabled || saving || refreshing || resolved?.status === "stale";
  const commentaryCanBeRemoved = editor
    ? hasSupportedEvidence(editor.origin, editor.blocks)
    : false;
  const creating = saveOperation === "create"
    || (saveOperation === undefined && !editor?.reportRef);
  const saveActionLabel = creating ? copy.create : copy.save;
  const canonicalSourceTarget = resolved ? reportSourceTarget(resolved) : null;
  const returnLabel = origin
    ? origin.kind === "session" ? copy.backToSession : copy.backToComparison
    : canonicalSourceTarget?.kind === "session"
      ? copy.viewSourceSession
      : canonicalSourceTarget?.kind === "comparison" ? copy.viewSourceComparison : undefined;

  return (
    <section className="reports-panel" aria-labelledby="reports-heading">
      <header className="reports-hero">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 id="reports-heading">{copy.heading}</h1>
        <p>{copy.intro}</p>
      </header>

      {returnLabel && (
        <button
          type="button"
          className="secondary"
          onClick={() => onReturnToOrigin(origin ? null : canonicalSourceTarget)}
        >
          <span aria-hidden="true">← </span>
          {returnLabel}
        </button>
      )}

      <WorkspaceNavigation
        label={copy.workspaceNavigation}
        current={workspace}
        options={[
          { workspace: "library", label: copy.workspaces.library },
          {
            workspace: "compose",
            label: copy.workspaces.compose,
            disabled: !editor || resolved?.status === "stale",
          },
          {
            workspace: "preview",
            label: copy.workspaces.preview,
            disabled: !resolved,
          },
        ]}
        onSelect={setWorkspace}
      />

      <div className={`reports-layout reports-layout-${workspace}`}>
        <section
          className="report-library"
          aria-labelledby="saved-reports-heading"
          hidden={workspace !== "library"}
        >
          <div className="report-section-heading">
            <div>
              <h2 id="saved-reports-heading" ref={libraryHeadingRef} tabIndex={-1}>
                {copy.savedHeading}
              </h2>
              {!listLoading && !listFailed && reportCount > 0 && (
                <p className="report-library-count" aria-live="polite">
                  {interpolate(copy.library.count, {
                    shown: number.format(reports.length),
                    total: number.format(reportCount),
                  })}
                </p>
              )}
            </div>
            <div className="report-library-heading-actions">
              {!listLoading && !listFailed && reports.length > 0 && (
                <button
                  type="button"
                  className="secondary report-library-new-comparison"
                  disabled={disabled}
                  onClick={beginTrainingComparisonReport}
                >
                  {copy.library.newComparison}
                </button>
              )}
              <button
                type="button"
                className="secondary"
                onClick={() => void refreshList()}
                disabled={listLoading}
              >
                {copy.reload}
              </button>
            </div>
          </div>
          {listLoading && <p role="status">{copy.loading}</p>}
          {listFailed && (
            <p className="error" role="alert">
              {copy.errors["report-definition-query-failed"]}
            </p>
          )}
          {!listLoading && !listFailed && reports.length === 0 && (
            <section className="report-empty-editor report-library-start">
              <div>
                <h2>{copy.chooseHeading}</h2>
                <p>{copy.empty}</p>
                <p>{copy.chooseBody}</p>
              </div>
              <div className="report-start-actions">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={beginTrainingComparisonReport}
                >
                  {copy.startQuestion}
                </button>
              </div>
            </section>
          )}
          {removedNotice && <p className="notice" role="status">{removedNotice}</p>}
          {reports.length > 0 && (
            <ul className="report-list">
              {reports.map((report) => (
                <li key={report.reportRef}>
                  <button
                    type="button"
                    aria-label={interpolate(copy.library.open, { title: report.title })}
                    aria-current={resolved?.definition.reportRef === report.reportRef
                      ? "page"
                      : undefined}
                    onClick={() => void openReport(report.reportRef)}
                    disabled={resolving}
                  >
                    <span className="report-library-card-heading">
                      <strong>{report.title}</strong>
                      <span className={`report-status report-status-${report.evidenceState}`}>
                        {copy.status[report.evidenceState]}
                      </span>
                    </span>
                    <span className="report-library-subject">
                      {report.subject.kind === "session" && (
                        <>
                          <SportFamilyIcon
                            family={report.subject.sport.classification?.canonicalFamily ?? null}
                            state={report.subject.sport.state}
                          />
                          <span>{sportLabel(report.subject.sport)}</span>
                        </>
                      )}
                      {report.subject.kind === "training-comparison"
                        && <span>{copy.library.trainingComparison}</span>}
                      {report.subject.kind === "authored-note"
                        && <span>{copy.library.authoredNote}</span>}
                    </span>
                    {report.period?.kind === "session"
                      ? (
                        <time
                          className="report-library-period"
                          dateTime={report.period.startedAtLocal}
                        >
                          {libraryPeriod(report)}
                        </time>
                      )
                      : libraryPeriod(report) && (
                        <span className="report-library-period">{libraryPeriod(report)}</span>
                      )}
                    {renderLibraryResult(report)}
                    {renderLibrarySensitivity(report)}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {nextReportOffset !== null && (
            <button
              type="button"
              className="secondary report-library-more"
              disabled={listLoadingMore}
              onClick={() => void loadMoreReports()}
            >
              {listLoadingMore ? copy.library.loadingMore : copy.library.showMore}
            </button>
          )}
        </section>

        <div className="report-workspace">
          {resolving && !saving && <p role="status">{copy.resolving}</p>}
          {editor && (
            <form
              className="report-editor"
              aria-labelledby="report-editor-heading"
              aria-busy={saving}
              hidden={workspace !== "compose"}
              onSubmit={(event) => void saveReport(event)}
            >
              <div className="report-section-heading">
                <div>
                  <p className="eyebrow">
                    {editor.reportRef ? copy.editingEyebrow : copy.creatingEyebrow}
                  </p>
                  <h2
                    id="report-editor-heading"
                  >
                    {editor.reportRef ? copy.editHeading : copy.createHeading}
                  </h2>
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
                  disabled={editingLocked}
                  aria-invalid={(definitionInvalid && !editor.title.trim()) || undefined}
                  aria-describedby={definitionInvalid && !editor.title.trim()
                    ? "report-editor-error"
                    : undefined}
                  onChange={(event) => {
                    if (definitionInvalid) setLocalError(undefined);
                    setEditor({ ...editor, title: event.target.value });
                  }}
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
                              disabled={editingLocked || index === 0}
                              onClick={() => moveBlock(index, -1)}
                            >
                              <span aria-hidden="true">↑</span>
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              aria-label={interpolate(copy.moveLater, { block: label })}
                              disabled={editingLocked || index === editor.blocks.length - 1}
                              onClick={() => moveBlock(index, 1)}
                            >
                              <span aria-hidden="true">↓</span>
                            </button>
                            {block.kind === "route" && (
                              <button
                                type="button"
                                className="secondary danger-action"
                                onClick={() => removeRoute(index)}
                                disabled={editingLocked}
                              >
                                {copy.removeRoute}
                              </button>
                            )}
                            {isAnalyticalBlock(block) && (
                              <button
                                type="button"
                                className="secondary danger-action"
                                onClick={() => removeAnalyticalBlock(index)}
                                disabled={editingLocked}
                              >
                                {copy.analysis.removeBlock}
                              </button>
                            )}
                            {block.kind === "narrative" && commentaryCanBeRemoved && (
                              <button
                                type="button"
                                className="secondary danger-action"
                                onClick={() => removeCommentary(index)}
                                disabled={editingLocked}
                              >
                                {copy.commentary.remove}
                              </button>
                            )}
                          </div>
                        </div>
                        {block.kind === "session-evidence" && (
                          <label className="report-sensitive-choice">
                            <input
                              type="checkbox"
                              checked={block.includePhysiologicalContext}
                              disabled={editingLocked || !physiologyAvailable}
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
                              ref={commentaryFieldRef}
                              id={`report-narrative-${index}`}
                              aria-invalid={(definitionInvalid
                                && !commentaryCanBeRemoved
                                && !block.body.trim()) || undefined}
                              aria-describedby={definitionInvalid
                                && !commentaryCanBeRemoved
                                && !block.body.trim()
                                ? `report-narrative-help-${index} report-editor-error`
                                : `report-narrative-help-${index}`}
                              value={block.body}
                              maxLength={10_000}
                              rows={8}
                              required={!commentaryCanBeRemoved}
                              disabled={editingLocked}
                              onChange={(event) => {
                                if (definitionInvalid) setLocalError(undefined);
                                updateBlock(index, {
                                  ...block,
                                  body: event.target.value,
                                });
                              }}
                            />
                            <small id={`report-narrative-help-${index}`}>
                              {commentaryCanBeRemoved
                                ? copy.narrativeHelp
                                : copy.narrativeRequiredHelp}
                            </small>
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
                                disabled={editingLocked}
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
                        {(block.kind === "training-finding"
                          || block.kind === "training-chart") && (
                          <label className="report-analysis-metric">
                            <span>{copy.analysis.metricLabel}</span>
                            <select
                              value={block.metric}
                              disabled={editingLocked}
                              onChange={(event) => updateBlock(index, {
                                ...block,
                                metric: event.target.value as ReportTrainingMetric,
                              })}
                            >
                              {REPORT_TRAINING_METRICS.map((metric) => (
                                <option key={metric} value={metric}>
                                  {copy.analysis.metrics[metric]}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        {isAnalyticalBlock(block) && (
                          <p className="report-analysis-block-help">
                            {copy.analysis.blocks[block.kind].description}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>

              <div className="report-composer-tools">
                {!commentaryPresent && (
                  <section
                    className="report-commentary-picker"
                    aria-labelledby="report-add-commentary-heading"
                  >
                    <div>
                      <h3 id="report-add-commentary-heading">{copy.commentary.heading}</h3>
                      <p>{copy.commentary.intro}</p>
                    </div>
                    <button
                      ref={addCommentaryRef}
                      type="button"
                      className="secondary"
                      disabled={editingLocked}
                      onClick={addCommentary}
                    >
                      {copy.commentary.add}
                    </button>
                  </section>
                )}
                {editor.sessionRef && (
                  <section className="report-route-picker" aria-labelledby="report-add-route-heading">
                    <h3 id="report-add-route-heading">{copy.addRouteHeading}</h3>
                    <p>{copy.addRouteIntro}</p>
                    {routesLoading && <p role="status">{copy.routesLoading}</p>}
                {routesFailed && <p className="error" role="alert">{copy.routesFailed}</p>}
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
                          disabled={editingLocked}
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
                )}

                <section className="report-analysis-picker" aria-labelledby="report-analysis-heading">
                  <div>
                    <h3 id="report-analysis-heading">{copy.analysis.addHeading}</h3>
                    <p>{copy.analysis.addIntro}</p>
                  </div>
                {analyticalQuery && (
                  <fieldset className="report-analysis-ranges">
                    <legend>{copy.analysis.periodsHeading}</legend>
                    <p>{copy.analysis.periodsHelp}</p>
                    <div>
                      <label>
                        <span>{copy.analysis.baselineFrom}</span>
                        <input
                          type="date"
                          value={analyticalQuery.baselineRange.from}
                          aria-invalid={comparisonRangeInvalid || undefined}
                          aria-describedby={comparisonRangeInvalid ? "report-editor-error" : undefined}
                          required
                          disabled={editingLocked}
                          onChange={(event) => updateComparisonRange(
                            "baselineRange",
                            "from",
                            event.target.value,
                          )}
                        />
                      </label>
                      <label>
                        <span>{copy.analysis.baselineThrough}</span>
                        <input
                          type="date"
                          value={analyticalQuery.baselineRange.through}
                          aria-invalid={comparisonRangeInvalid || undefined}
                          aria-describedby={comparisonRangeInvalid ? "report-editor-error" : undefined}
                          required
                          disabled={editingLocked}
                          onChange={(event) => updateComparisonRange(
                            "baselineRange",
                            "through",
                            event.target.value,
                          )}
                        />
                      </label>
                      <label>
                        <span>{copy.analysis.comparisonFrom}</span>
                        <input
                          type="date"
                          value={analyticalQuery.comparisonRange.from}
                          aria-invalid={comparisonRangeInvalid || undefined}
                          aria-describedby={comparisonRangeInvalid ? "report-editor-error" : undefined}
                          required
                          disabled={editingLocked}
                          onChange={(event) => updateComparisonRange(
                            "comparisonRange",
                            "from",
                            event.target.value,
                          )}
                        />
                      </label>
                      <label>
                        <span>{copy.analysis.comparisonThrough}</span>
                        <input
                          type="date"
                          value={analyticalQuery.comparisonRange.through}
                          aria-invalid={comparisonRangeInvalid || undefined}
                          aria-describedby={comparisonRangeInvalid ? "report-editor-error" : undefined}
                          required
                          disabled={editingLocked}
                          onChange={(event) => updateComparisonRange(
                            "comparisonRange",
                            "through",
                            event.target.value,
                          )}
                        />
                      </label>
                    </div>
                  </fieldset>
                )}
                {unselectedAnalyticalKinds.length > 0
                  ? (
                    <ul>
                      {unselectedAnalyticalKinds.map((kind) => (
                        <li key={kind}>
                          <strong>{copy.analysis.blocks[kind].heading}</strong>
                          <span>{copy.analysis.blocks[kind].description}</span>
                          <button
                            type="button"
                            className="secondary"
                            disabled={editingLocked}
                            onClick={() => addAnalyticalBlock(kind)}
                          >
                            {interpolate(copy.analysis.addBlock, {
                              block: copy.analysis.blocks[kind].heading,
                            })}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                  : <p>{copy.analysis.allAdded}</p>}
                </section>
              </div>

              <div className="report-actions">
                <ProgressSubmitButton
                  loading={saving}
                  disabled={editingLocked}
                  actionLabel={saveActionLabel}
                  progressLabel={copy.saving}
                />
                <button
                  type="button"
                  className="secondary"
                  disabled={editingLocked}
                  onClick={(event) => cancelComposition(event.currentTarget)}
                >
                  {copy.cancelComposition}
                </button>
              </div>
            </form>
          )}

          {savedNotice && <p className="notice" role="status">{copy.saved}</p>}
          {refreshedNotice && (
            <p ref={refreshedNoticeRef} className="notice" role="status" tabIndex={-1}>
              {copy.refresh.completed}
            </p>
          )}
          {localError && (
            <p id="report-editor-error" className="error" role="alert">
              {copy.errors[localError as keyof typeof copy.errors] ?? copy.errors.unexpected}
            </p>
          )}
          {exportedBytes && (
            <p ref={exportedNoticeRef} className="notice" role="status" tabIndex={-1}>
              {interpolate(copy.exported, { bytes: number.format(BigInt(exportedBytes)) })}
            </p>
          )}

          {resolved && (
            <section
              className="report-preview"
              aria-labelledby="report-preview-heading"
              hidden={workspace !== "preview"
                || refreshReviewOpen
                || privacyReviewOpen
                || deleteReviewOpen}
            >
              <div className="report-section-heading">
                <div>
                  <p className="eyebrow">{copy.previewEyebrow}</p>
                  <h2
                    id="report-preview-heading"
                    ref={requestedReportHeadingRef}
                    tabIndex={-1}
                  >
                    {copy.previewHeading}
                  </h2>
                </div>
                <span className={`report-status report-status-${resolved.status}`}>
                  {copy.status[resolved.status]}
                </span>
              </div>
              {resolved.status === "stale" && (
                <div className="report-stale">
                  <p role="status">{copy.stale}</p>
                  <button
                    type="button"
                    onClick={(event) => beginRefreshReview(event.currentTarget)}
                    disabled={disabled || refreshing}
                  >
                    {copy.refresh.review}
                  </button>
                </div>
              )}
              <h3 className="report-preview-title">{resolved.definition.title}</h3>
              {resolved.definition.blocks.slice(0, 1).map(renderPreviewBlock)}
              <div className="report-preview-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={disabled || resolved.status !== "current"}
                  onClick={() => setWorkspace("compose")}
                >
                  {copy.editComposition}
                </button>
                <button
                  type="button"
                  disabled={disabled || resolved.status !== "current"}
                  onClick={(event) => beginPrivacyReview(event.currentTarget)}
                >
                  {copy.reviewExport}
                </button>
                <button
                  type="button"
                  className="secondary danger-action"
                  disabled={disabled || deleting}
                  onClick={(event) => beginDeleteReview(event.currentTarget)}
                >
                  {copy.delete.action}
                </button>
              </div>
              {resolved.definition.blocks.slice(1).map(renderPreviewBlock)}
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
                  {resolved.provenance.kind === "session" && (
                    <>
                      <div><dt>{copy.source}</dt><dd>{resolved.provenance.current.provider === "polar-flow" ? "Polar Flow" : resolved.provenance.current.provider}</dd></div>
                      <div><dt>{copy.mapping}</dt><dd><code>{resolved.provenance.current.mappingVersion}</code></dd></div>
                    </>
                  )}
                  {resolved.provenance.kind !== "session" && (
                    <div>
                      <dt>{copy.source}</dt>
                      <dd>{resolved.provenance.kind === "library-snapshot"
                        ? copy.librarySnapshotProvenance
                        : copy.authoredOnlyProvenance}</dd>
                    </div>
                  )}
                  <div><dt>{copy.definitionVersion}</dt><dd>{resolved.definition.definitionVersion}</dd></div>
                  <div><dt>{copy.definitionRevision}</dt><dd>{resolved.definition.revision}</dd></div>
                </dl>
              </details>
            </section>
          )}

          {workspace === "preview" && deleteReviewOpen && resolved && (
            <section
              className="report-delete-review"
              role="dialog"
              aria-labelledby="report-delete-heading"
              aria-busy={deleting}
            >
              <p className="eyebrow">{copy.delete.eyebrow}</p>
              <h2
                id="report-delete-heading"
                ref={deleteReviewHeadingRef}
                tabIndex={-1}
              >
                {interpolate(copy.delete.heading, { title: resolved.definition.title })}
              </h2>
              <p>{copy.delete.intro}</p>
              <p className="report-delete-boundary">{copy.delete.boundary}</p>
              <div className="report-actions">
                <button
                  type="button"
                  className="danger-action"
                  disabled={deleting}
                  onClick={() => void confirmDeleteReport()}
                >
                  {interpolate(copy.delete.confirm, { title: resolved.definition.title })}
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={deleting}
                  onClick={(event) => closeDeleteReview(event.currentTarget)}
                >
                  {copy.delete.cancel}
                </button>
                {deleting && (
                  <span className="progress-submit-status" role="status" aria-live="polite">
                    {copy.delete.removing}
                  </span>
                )}
              </div>
            </section>
          )}

          {workspace === "preview" && refreshReviewOpen && resolved?.status === "stale" && (
            <section
              className="report-refresh-review"
              role="region"
              aria-labelledby="report-refresh-heading"
              aria-busy={refreshing}
            >
              <p className="eyebrow">{copy.refresh.eyebrow}</p>
              <h2 ref={refreshReviewHeadingRef} id="report-refresh-heading" tabIndex={-1}>
                {copy.refresh.heading}
              </h2>
              <p>{copy.refresh.intro}</p>
              <div className="report-refresh-revisions">
                <article>
                  <h3>{copy.refresh.savedHeading}</h3>
                  <p>{copy.refresh.savedBody}</p>
                </article>
                <article>
                  <h3>{copy.refresh.candidateHeading}</h3>
                  <p>{copy.refresh.candidateBody}</p>
                </article>
              </div>
              <p className="report-refresh-boundary">{copy.refresh.historicalBoundary}</p>
              <div className="report-refresh-effects">
                <section aria-labelledby="report-refresh-preserved-heading">
                  <h3 id="report-refresh-preserved-heading">{copy.refresh.preservedHeading}</h3>
                  <ul>{Object.values(copy.refresh.preserved).map((item) => (
                    <li key={item}>{item}</li>
                  ))}</ul>
                </section>
                <section aria-labelledby="report-refresh-updated-heading">
                  <h3 id="report-refresh-updated-heading">{copy.refresh.updatedHeading}</h3>
                  <ul>{Object.values(copy.refresh.updated).map((item) => (
                    <li key={item}>{item}</li>
                  ))}</ul>
                </section>
              </div>
              <p>{copy.refresh.confirmation}</p>
              <div className="report-actions">
                <button
                  type="button"
                  onClick={(event) => void confirmRefresh(event.currentTarget)}
                  disabled={refreshing}
                >
                  {copy.refresh.confirm}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={(event) => closeRefreshReview(event.currentTarget)}
                  disabled={refreshing}
                >
                  {copy.refresh.keepSaved}
                </button>
                {refreshing && (
                  <span className="progress-submit-status" role="status" aria-live="polite">
                    {copy.refresh.refreshing}
                  </span>
                )}
              </div>
            </section>
          )}

          {workspace === "preview" && privacyReviewOpen && resolved && (
            <section
              className="report-privacy-review"
              role="region"
              aria-labelledby="report-privacy-heading"
              aria-busy={exporting}
            >
              <h2 ref={privacyReviewHeadingRef} id="report-privacy-heading" tabIndex={-1}>
                {copy.privacyHeading}
              </h2>
              <p>{copy.privacyIntro}</p>
              <ul>
                {resolved.session && <li>{copy.sessionSummaryIncluded}</li>}
                {resolved.trainingComparison && <li>{copy.analysisExportIncluded}</li>}
                <li>{copy.titleIncluded}</li>
                {resolved.definition.blocks.some((block) => block.kind === "narrative")
                  && <li>{copy.narrativeIncluded}</li>}
                <li>{copy.provenanceIncluded}</li>
                <li>{copy.exactSamplesExcluded}</li>
              </ul>
              {resolved.session && physiologyAvailable && (
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
                  ref={exportActionRef}
                  type="button"
                  onClick={(event) => void exportReport(event.currentTarget)}
                  disabled={exporting}
                >
                  {copy.chooseDestination}
                </button>
                {exporting ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={(event) => void cancelExport(event.currentTarget)}
                  >
                    {copy.cancelExport}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="secondary"
                    onClick={(event) => closePrivacyReview(event.currentTarget)}
                  >
                    {copy.closeReview}
                  </button>
                )}
                {exporting && (
                  <span className="progress-submit-status" role="status" aria-live="polite">
                    {copy.exporting}
                  </span>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
