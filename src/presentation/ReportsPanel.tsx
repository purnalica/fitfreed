import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { chooseReportDestination } from "../infrastructure/report-destination";
import { type catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import {
  DataTable,
  NumericTableCell,
  NumericTableHeader,
} from "./DataTable";
import { WorkspaceNavigation } from "./WorkspaceNavigation";
import { ComparisonPeriodPresets } from "./ComparisonPeriodPresets";
import type { ComparisonPeriodSelection } from "./comparison-period-preset";
import { restoreFocusAfterReveal } from "./focus-restoration";
import { ProgressSubmitButton } from "./ProgressSubmitButton";
import { PlannedTrainingEvidence } from "./PlannedTrainingPanel";
import {
  formatExactDuration,
  formatMediumDateRange,
  formatSummaryDuration,
  measurementDecimalFormatter,
} from "./presentation-format";
import { SportFamilyIcon } from "./SportFamilyIcon";
import { reportSourceTarget, type ReportSourceTarget } from "./report-navigation";
import { routeSvgPoints } from "./route-svg";
import type {
  AnalyticalReportBlock,
  DuplicateReportRequest,
  ReportBlock,
  ReportDefinition,
  ReportExampleBlockRecipe,
  ReportExampleCatalog,
  ReportExampleDescriptor,
  ReportExamplePlannedTrainingSubject,
  ReportExamplePlannedTrainingSubjectPage,
  ReportExampleTrainingSessionSubject,
  ReportExampleTrainingSessionSubjectPage,
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
import type { PlannedTrainingTargetDetail } from "./planned-training";
import {
  formatDistance,
  formatExactMetric,
  formatSessionCardDate,
  formatSessionCardDistance,
  formatSessionCardDuration,
  formatSessionTimeSpan,
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
import { resolvedSportName, sportCanonicalFamily } from "./training-sports";

const REPORT_ROUTE_VISUAL_POINT_LIMIT = 400;
const REPORT_LIBRARY_PAGE_SIZE = 12;
const REPORT_SUBJECT_PAGE_SIZE = 12;
const DEFAULT_ROUTE_REDACTION_METERS = 200;
const MAX_ROUTE_REDACTION_METERS = 5000;

type AnalyticalBlockKind =
  | "training-finding"
  | "training-comparison"
  | "training-chart"
  | "training-exact-table"
  | "training-coverage";

type ReportWorkspace = "library" | "subject" | "compose" | "preview";
type NewReportReturn = "library" | "contextual-origin";

type TrainingSessionReportExample = ReportExampleDescriptor & {
  id: "session-visual-story" | "outdoor-route";
};

type PlannedTrainingReportExample = ReportExampleDescriptor & {
  id: "structured-training-plan";
};

interface TrainingSessionSubjectPicker {
  kind: "training-session";
  example: TrainingSessionReportExample;
  snapshotRef: string | null;
  totalCount: number;
  nextOffset: number | null;
  subjects: ReportExampleTrainingSessionSubject[];
}

interface PlannedTrainingSubjectPicker {
  kind: "planned-training";
  example: PlannedTrainingReportExample;
  snapshotRef: string | null;
  totalCount: number;
  nextOffset: number | null;
  subjects: ReportExamplePlannedTrainingSubject[];
}

type ReportSubjectPicker = TrainingSessionSubjectPicker | PlannedTrainingSubjectPicker;

function PlannedTrainingSubjectIcon() {
  return (
    <svg
      className="report-plan-icon"
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="6" y="7" width="20" height="19" rx="3" />
      <path d="M11 4v6M21 4v6M6 13h20M11 18h3M18 18h3M11 22h3M18 22h3" />
    </svg>
  );
}

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
  plannedTarget?: PlannedTrainingTargetDetail;
  physiologyAvailable?: boolean;
  title: string;
  blocks: SessionReportBlockDraft[];
}

interface RouteExportChoice {
  includeGeometry: boolean;
  endpointRedactionInput: string;
}

interface DuplicateDraft {
  sourceReportRef: string;
  expectedSourceRevision: string;
  sourceTitle: string;
  title: string;
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
    case "planned-training":
      return {
        blockRef: block.blockRef,
        kind: block.kind,
        targetRef: block.targetRef,
      };
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
  if (origin.kind === "planned-training") {
    return blocks.some((block) => (
      block.kind === "planned-training" && block.targetRef === origin.targetRef
    ));
  }
  return blocks.some(isAnalyticalBlock);
}

function formatReportRange(range: TrainingDateRange, locale: Locale): string {
  return formatMediumDateRange(range.from, range.through, locale, "–");
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

function comparisonQueriesMatch(
  left: ReportTrainingComparisonQuery,
  right: ReportTrainingComparisonQuery,
): boolean {
  return left.question === right.question
    && left.questionVersion === right.questionVersion
    && left.baselineRange.from === right.baselineRange.from
    && left.baselineRange.through === right.baselineRange.through
    && left.comparisonRange.from === right.comparisonRange.from
    && left.comparisonRange.through === right.comparisonRange.through;
}

function editorFromDefinition(
  definition: ReportDefinition,
  plannedTarget?: PlannedTrainingTargetDetail,
): EditorState {
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
    plannedTarget,
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

function exampleAnalyticalDrafts(
  query: ReportTrainingComparisonQuery,
  recipe: ReportExampleBlockRecipe[],
): SessionReportBlockDraft[] {
  return recipe.map((item): SessionReportBlockDraft => {
    switch (item) {
      case "training-finding-session-count":
        return { kind: "training-finding", query, metric: "session-count" };
      case "training-chart-duration":
        return { kind: "training-chart", query, metric: "duration" };
      case "training-coverage":
        return { kind: "training-coverage", query };
      default:
        throw new Error("invalid-report-definition");
    }
  });
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
  const [examples, setExamples] = useState<ReportExampleDescriptor[]>([]);
  const [examplesLoading, setExamplesLoading] = useState(true);
  const [examplesFailed, setExamplesFailed] = useState(false);
  const [workspace, setWorkspace] = useState<ReportWorkspace>("library");
  const [contextualOrigin, setContextualOrigin] = useState<ReportStartOrigin>();
  const [subjectPicker, setSubjectPicker] = useState<ReportSubjectPicker>();
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsLoadingMore, setSubjectsLoadingMore] = useState(false);
  const [subjectsFailure, setSubjectsFailure] = useState<string>();
  const [selectingSubjectRef, setSelectingSubjectRef] = useState<string>();
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
  const [runParameterDraft, setRunParameterDraft] = useState<ReportTrainingComparisonQuery>();
  const [localError, setLocalError] = useState<string>();
  const [savedNotice, setSavedNotice] = useState(false);
  const [refreshedNotice, setRefreshedNotice] = useState(false);
  const [refreshReviewOpen, setRefreshReviewOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteReviewOpen, setDeleteReviewOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removedNotice, setRemovedNotice] = useState<string>();
  const [duplicateDraft, setDuplicateDraft] = useState<DuplicateDraft>();
  const [duplicating, setDuplicating] = useState(false);
  const [duplicatedNotice, setDuplicatedNotice] = useState<string>();
  const libraryHeadingRef = useRef<HTMLHeadingElement>(null);
  const subjectHeadingRef = useRef<HTMLHeadingElement>(null);
  const subjectPickerRef = useRef<HTMLElement>(null);
  const subjectPickerOriginRef = useRef<HTMLElement>(null);
  const subjectPickerReturnPendingRef = useRef(false);
  const subjectRequestRef = useRef(0);
  const deleteReviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const deleteReviewOriginRef = useRef<HTMLElement>(null);
  const duplicateHeadingRef = useRef<HTMLHeadingElement>(null);
  const duplicateOriginRef = useRef<HTMLElement>(null);
  const duplicateOutcomeOriginRef = useRef<HTMLElement>(null);
  const duplicateCancelFocusPendingRef = useRef(false);
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
  const number = useMemo(() => measurementDecimalFormatter(locale), [locale]);
  const capabilityList = useMemo(
    () => new Intl.ListFormat(locale, { style: "long", type: "conjunction" }),
    [locale],
  );
  const commentaryPresent = editor?.blocks.some((block) => block.kind === "narrative") ?? false;
  const subjectCopy = subjectPicker?.kind === "planned-training"
    ? copy.examples.plannedSubjects
    : copy.examples.subjects;

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

  useEffect(() => {
    if (workspace !== "subject") return;
    return restoreFocusAfterReveal(subjectHeadingRef.current, subjectPickerOriginRef.current, {
      align: "start",
      forceInitialFocus: true,
      revealElement: subjectPickerRef.current,
    });
  }, [workspace]);

  useEffect(() => {
    if (workspace !== "library" || !subjectPickerReturnPendingRef.current) return;
    subjectPickerReturnPendingRef.current = false;
    return restoreFocusAfterReveal(subjectPickerOriginRef.current, null, { align: "start" });
  }, [workspace]);

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

  async function refreshExamples() {
    setExamplesLoading(true);
    setExamplesFailed(false);
    try {
      const catalog = await invoke<ReportExampleCatalog>("list_report_examples");
      setExamples(catalog.examples);
    } catch {
      setExamples([]);
      setExamplesFailed(true);
    } finally {
      setExamplesLoading(false);
    }
  }

  function isTrainingSessionExample(
    example: ReportExampleDescriptor,
  ): example is TrainingSessionReportExample {
    return example.id === "session-visual-story" || example.id === "outdoor-route";
  }

  function isPlannedTrainingExample(
    example: ReportExampleDescriptor,
  ): example is PlannedTrainingReportExample {
    return example.id === "structured-training-plan";
  }

  async function loadReportSubjects(
    example: TrainingSessionReportExample | PlannedTrainingReportExample,
    offset: number,
    append: boolean,
    snapshotRef: string | null,
  ) {
    const requestId = subjectRequestRef.current + 1;
    subjectRequestRef.current = requestId;
    if (append) setSubjectsLoadingMore(true);
    else setSubjectsLoading(true);
    setSubjectsFailure(undefined);
    try {
      if (requestId !== subjectRequestRef.current) return;
      if (isTrainingSessionExample(example)) {
        const page = await invoke<ReportExampleTrainingSessionSubjectPage>(
          "query_report_example_training_session_subjects",
          {
            query: {
              exampleId: example.id,
              exampleVersion: example.version,
              offset,
              limit: REPORT_SUBJECT_PAGE_SIZE,
              snapshotRef,
            },
          },
        );
        if (page.exampleId !== example.id || page.exampleVersion !== example.version) {
          throw new Error("invalid-report-definition");
        }
        if (requestId !== subjectRequestRef.current) return;
        setSubjectPicker((current) => ({
          kind: "training-session",
          example,
          snapshotRef: page.snapshotRef,
          totalCount: page.totalCount,
          nextOffset: page.nextOffset,
          subjects: append && current?.kind === "training-session"
            && current.example.id === example.id
            ? [...current.subjects, ...page.subjects]
            : page.subjects,
        }));
      } else {
        const page = await invoke<ReportExamplePlannedTrainingSubjectPage>(
          "query_report_example_planned_training_subjects",
          {
            query: {
              exampleId: example.id,
              exampleVersion: example.version,
              offset,
              limit: REPORT_SUBJECT_PAGE_SIZE,
              snapshotRef,
            },
          },
        );
        if (page.exampleId !== example.id || page.exampleVersion !== example.version) {
          throw new Error("invalid-report-definition");
        }
        if (requestId !== subjectRequestRef.current) return;
        setSubjectPicker((current) => ({
          kind: "planned-training",
          example,
          snapshotRef: page.snapshotRef,
          totalCount: page.totalCount,
          nextOffset: page.nextOffset,
          subjects: append && current?.kind === "planned-training"
            ? [...current.subjects, ...page.subjects]
            : page.subjects,
        }));
      }
    } catch (reason) {
      if (requestId !== subjectRequestRef.current) return;
      setSubjectsFailure(commandErrorCode(reason));
    } finally {
      if (requestId === subjectRequestRef.current) {
        if (append) setSubjectsLoadingMore(false);
        else setSubjectsLoading(false);
      }
    }
  }

  function openReportSubjectPicker(
    example: TrainingSessionReportExample | PlannedTrainingReportExample,
    initiatingElement: HTMLElement,
  ) {
    subjectPickerOriginRef.current = initiatingElement;
    setSubjectPicker(isTrainingSessionExample(example)
      ? {
          kind: "training-session",
          example,
          snapshotRef: null,
          totalCount: 0,
          nextOffset: null,
          subjects: [],
        }
      : {
          kind: "planned-training",
          example,
          snapshotRef: null,
          totalCount: 0,
          nextOffset: null,
          subjects: [],
        });
    setWorkspace("subject");
    void loadReportSubjects(example, 0, false, null);
  }

  function closeReportSubjectPicker() {
    subjectRequestRef.current += 1;
    subjectPickerReturnPendingRef.current = true;
    setSubjectPicker(undefined);
    setSubjectsFailure(undefined);
    setSubjectsLoading(false);
    setSubjectsLoadingMore(false);
    setWorkspace("library");
  }

  async function loadMoreReportSubjects() {
    if (!subjectPicker || subjectPicker.nextOffset === null || subjectsLoadingMore) return;
    await loadReportSubjects(
      subjectPicker.example,
      subjectPicker.nextOffset,
      true,
      subjectPicker.snapshotRef,
    );
  }

  async function refreshLibrary() {
    await Promise.all([refreshList(), refreshExamples()]);
  }

  async function loadMoreReports() {
    if (nextReportOffset === null || listLoadingMore) return;
    await loadReportPage(nextReportOffset, true);
  }

  useEffect(() => {
    void refreshLibrary();
  }, []);

  function resetTransientReportState() {
    setResolved(undefined);
    setRunParameterDraft(undefined);
    setLocalError(undefined);
    setSavedNotice(false);
    setRefreshedNotice(false);
    setRefreshReviewOpen(false);
    setDeleteReviewOpen(false);
    setPrivacyReviewOpen(false);
    setExportedBytes(undefined);
    setRemovedNotice(undefined);
    setDuplicateDraft(undefined);
    setDuplicatedNotice(undefined);
  }

  async function beginPreparedReport(
    start: ReportStart,
    title: string,
    recipe: ReportExampleBlockRecipe[] | undefined,
    returnDestination: NewReportReturn,
  ) {
    setWorkspace("compose");
    setResolving(true);
    setLocalError(undefined);
    try {
      const prepared = await invoke<PreparedReportStart>("prepare_report_start", { start });
      let blocks: SessionReportBlockDraft[];
      if (prepared.origin.kind === "blank") {
        blocks = [{ kind: "narrative", body: "" }];
      } else if (prepared.suggestedQuery) {
        blocks = recipe
          ? exampleAnalyticalDrafts(prepared.suggestedQuery, recipe)
          : analyticalDrafts(prepared.suggestedQuery);
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
      if (returnDestination === "library") setContextualOrigin(undefined);
      resetTransientReportState();
    } catch (reason) {
      const code = commandErrorCode(reason);
      setLocalError(code);
      setWorkspace("library");
    } finally {
      setResolving(false);
    }
  }

  function beginReportExample(example: ReportExampleDescriptor, initiatingElement: HTMLElement) {
    if (example.availability.kind === "ready") {
      const itemCopy = copy.examples.items[example.id];
      void beginPreparedReport(
        {
          kind: "question",
          question: "training-period-comparison",
          questionVersion: 1,
        },
        itemCopy.defaultTitle,
        example.blockRecipe,
        "library",
      );
      return;
    }
    if (example.availability.kind === "selection-required") {
      if (isTrainingSessionExample(example) || isPlannedTrainingExample(example)) {
        openReportSubjectPicker(example, initiatingElement);
        return;
      }
      setLocalError("invalid-report-definition");
    }
  }

  async function useReportSubject(subject: ReportExampleTrainingSessionSubject) {
    if (!subjectPicker || subjectPicker.kind !== "training-session") return;
    setSelectingSubjectRef(subject.session.sessionRef);
    setLocalError(undefined);
    try {
      if (!subjectPicker.snapshotRef) {
        setLocalError("report-source-changed");
        return;
      }
      const sourceSnapshotRef = subjectPicker.snapshotRef;
      const itemCopy = copy.examples.items[subjectPicker.example.id];
      let routes: TrainingRouteOverview[] = [];
      if (subjectPicker.example.id === "outdoor-route") {
        const result = await invoke<TrainingSessionRoutesResult>("query_training_session_routes", {
          query: {
            sessionRef: subject.session.sessionRef,
            snapshotRef: sourceSnapshotRef,
            maxVisualPoints: REPORT_ROUTE_VISUAL_POINT_LIMIT,
          },
        });
        routes = flattenRoutes(result);
        if (routes.length === 0) {
          setLocalError("report-evidence-unavailable");
          return;
        }
      }
      const blocks = subjectPicker.example.blockRecipe.flatMap(
        (recipe): SessionReportBlockDraft[] => {
          if (recipe === "session-evidence") {
            return [{
              kind: "session-evidence",
              includePhysiologicalContext:
                subject.session.averageHeartRateBpm !== null
                || subject.session.maximumHeartRateBpm !== null,
            }];
          }
          if (recipe === "route" && routes[0]) {
            return [{
              kind: "route",
              routeRef: routes[0].routeRef,
              endpointRedactionMeters: DEFAULT_ROUTE_REDACTION_METERS,
            }];
          }
          return [];
        },
      );
      setAvailableRoutes(routes);
      setEditor({
        sourceSnapshotRef,
        origin: { kind: "session", sessionRef: subject.session.sessionRef },
        sessionRef: subject.session.sessionRef,
        suggestedQuery: defaultComparisonQuery(subject.session.startedAtLocal),
        physiologyAvailable:
          subject.session.averageHeartRateBpm !== null
          || subject.session.maximumHeartRateBpm !== null,
        title: itemCopy.defaultTitle,
        blocks,
      });
      setContextualOrigin(undefined);
      setSubjectPicker(undefined);
      resetTransientReportState();
      setWorkspace("compose");
    } catch (reason) {
      setLocalError(commandErrorCode(reason));
    } finally {
      setSelectingSubjectRef(undefined);
    }
  }

  async function usePlannedReportSubject(subject: ReportExamplePlannedTrainingSubject) {
    if (!subjectPicker || subjectPicker.kind !== "planned-training") return;
    setSelectingSubjectRef(subject.targetRef);
    setLocalError(undefined);
    try {
      if (!subjectPicker.snapshotRef) {
        setLocalError("report-source-changed");
        return;
      }
      const target = await invoke<PlannedTrainingTargetDetail>("query_planned_training_target", {
        query: {
          targetRef: subject.targetRef,
          snapshotRef: subjectPicker.snapshotRef,
        },
      });
      if (
        target.snapshotRef !== subjectPicker.snapshotRef
        || target.target.summary.targetRef !== subject.targetRef
      ) {
        setLocalError("report-source-changed");
        return;
      }
      const itemCopy = copy.examples.items[subjectPicker.example.id];
      setAvailableRoutes([]);
      setEditor({
        sourceSnapshotRef: target.snapshotRef,
        origin: { kind: "planned-training", targetRef: subject.targetRef },
        plannedTarget: target,
        title: itemCopy.defaultTitle,
        blocks: [{ kind: "planned-training", targetRef: subject.targetRef }],
      });
      setContextualOrigin(undefined);
      setSubjectPicker(undefined);
      resetTransientReportState();
      setWorkspace("compose");
    } catch (reason) {
      const code = commandErrorCode(reason);
      setLocalError(code === "planned-training-changed" ? "report-source-changed" : code);
    } finally {
      setSelectingSubjectRef(undefined);
    }
  }

  useEffect(() => {
    if (!origin || originRequestId === 0) return;
    setContextualOrigin(origin);
    if (origin.kind === "session") {
      setWorkspace("compose");
      setEditor({
        sourceSnapshotRef: origin.snapshotRef,
        origin: { kind: "session", sessionRef: origin.session.sessionRef },
        sessionRef: origin.session.sessionRef,
        suggestedQuery: defaultComparisonQuery(origin.session.startedAtLocal),
        physiologyAvailable:
          origin.session.averageHeartRateBpm !== null
          || origin.session.maximumHeartRateBpm !== null,
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
    if (origin.kind === "planned-training") {
      const targetRef = origin.target.target.summary.targetRef;
      setWorkspace("compose");
      setEditor({
        sourceSnapshotRef: origin.snapshotRef,
        origin: { kind: "planned-training", targetRef },
        plannedTarget: origin.target,
        title: interpolate(copy.plannedDefaultTitle, {
          name: origin.target.target.summary.name,
        }),
        blocks: [{ kind: "planned-training", targetRef }],
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
        undefined,
        "contextual-origin",
      );
      return;
    }
    void beginPreparedReport(
      { kind: "exploration", query: origin.query },
      copy.explorationDefaultTitle,
      undefined,
      "contextual-origin",
    );
  }, [originRequestId]);

  useEffect(() => {
    if (!openReportRef || openReportRequestId === undefined) return;
    void openReport(openReportRef);
  }, [openReportRef, openReportRequestId]);

  useEffect(() => {
    if (resolved?.definition.reportRef !== openReportRef) return;
    return restoreFocusAfterReveal(
      requestedReportHeadingRef.current,
      null,
      { align: "start" },
    );
  }, [openReportRef, openReportRequestId, resolved?.definition.reportRef]);

  useEffect(() => {
    if (!refreshReviewOpen) return;
    return restoreFocusAfterReveal(
      refreshReviewHeadingRef.current,
      refreshReviewOriginRef.current,
      { align: "start" },
    );
  }, [refreshReviewOpen]);

  useEffect(() => {
    if (!privacyReviewOpen) return;
    return restoreFocusAfterReveal(
      privacyReviewHeadingRef.current,
      privacyReviewOriginRef.current,
      { align: "start" },
    );
  }, [privacyReviewOpen]);

  useEffect(() => {
    if (!deleteReviewOpen) return;
    return restoreFocusAfterReveal(
      deleteReviewHeadingRef.current,
      deleteReviewOriginRef.current,
      { align: "start" },
    );
  }, [deleteReviewOpen]);

  useEffect(() => {
    if (!duplicateDraft) return;
    return restoreFocusAfterReveal(
      duplicateHeadingRef.current,
      duplicateOriginRef.current,
      { align: "start", forceInitialFocus: true },
    );
  }, [duplicateDraft?.sourceReportRef]);

  useEffect(() => {
    if (duplicateDraft || !duplicateCancelFocusPendingRef.current) return;
    duplicateCancelFocusPendingRef.current = false;
    return restoreFocusAfterReveal(
      duplicateOriginRef.current,
      null,
      { forceInitialFocus: true },
    );
  }, [duplicateDraft]);

  useEffect(() => {
    if (!duplicatedNotice) return;
    return restoreFocusAfterReveal(
      requestedReportHeadingRef.current ?? libraryHeadingRef.current,
      duplicateOutcomeOriginRef.current,
      { align: "start" },
    );
  }, [duplicatedNotice]);

  useEffect(() => {
    if (!removedNotice) return;
    return restoreFocusAfterReveal(
      libraryHeadingRef.current,
      null,
      { align: "start" },
    );
  }, [removedNotice]);

  useEffect(() => {
    const target = compositionCancelTargetRef.current;
    if (!target || workspace !== target) return;
    compositionCancelTargetRef.current = undefined;
    return restoreFocusAfterReveal(
      target === "preview" ? requestedReportHeadingRef.current : libraryHeadingRef.current,
      compositionCancelOriginRef.current,
      { align: "start" },
    );
  }, [workspace]);

  useEffect(() => {
    if (!refreshedNotice) return;
    return restoreFocusAfterReveal(
      refreshedNoticeRef.current,
      refreshOutcomeOriginRef.current,
      { align: "start" },
    );
  }, [refreshedNotice]);

  useEffect(() => {
    if (!exportedBytes) return;
    return restoreFocusAfterReveal(
      exportedNoticeRef.current,
      exportOutcomeOriginRef.current,
      { align: "start" },
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

  async function resolveReport(
    reportRef: string,
    trainingComparison?: ReportTrainingComparisonQuery,
  ) {
    setResolving(true);
    setLocalError(undefined);
    try {
      const result = await invoke<ResolvedReport>("resolve_report", {
        request: {
          reportRef,
          runParameters: trainingComparison ? { trainingComparison } : {},
        },
      });
      const nextEditor = editorFromDefinition(
        result.definition,
        result.plannedTraining?.target,
      );
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
      setRunParameterDraft(
        result.runParameters.trainingComparison?.effectiveValue,
      );
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
    setContextualOrigin(undefined);
    setWorkspace("preview");
    setRemovedNotice(undefined);
    setSavedNotice(false);
    setRefreshedNotice(false);
    setDuplicatedNotice(undefined);
    setEditor(undefined);
    setResolved(undefined);
    setRunParameterDraft(undefined);
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
      setEditor(editorFromDefinition(
        resolved.definition,
        resolved.plannedTraining?.target,
      ));
      compositionCancelTargetRef.current = "preview";
      setWorkspace("preview");
      return;
    }
    setEditor(undefined);
    if (contextualOrigin) {
      setContextualOrigin(undefined);
      onReturnToOrigin(null);
      return;
    }
    compositionCancelTargetRef.current = "library";
    setWorkspace("library");
  }

  function beginDuplicate(
    source: Pick<ReportDefinition, "reportRef" | "revision" | "title">,
    originElement: HTMLElement,
  ) {
    duplicateOriginRef.current = originElement;
    duplicateCancelFocusPendingRef.current = false;
    setLocalError(undefined);
    setDuplicatedNotice(undefined);
    setDuplicateDraft({
      sourceReportRef: source.reportRef,
      expectedSourceRevision: source.revision,
      sourceTitle: source.title,
      title: interpolate(copy.duplicate.defaultTitle, { title: source.title }),
    });
  }

  function closeDuplicate(initiatingElement: HTMLElement) {
    duplicateCancelFocusPendingRef.current = true;
    setDuplicateDraft(undefined);
    setLocalError(undefined);
    initiatingElement.blur();
  }

  async function submitDuplicate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!duplicateDraft) return;
    const title = duplicateDraft.title.trim();
    if (!title) {
      setLocalError("invalid-report-duplicate-title");
      return;
    }
    const request: DuplicateReportRequest = {
      sourceReportRef: duplicateDraft.sourceReportRef,
      expectedSourceRevision: duplicateDraft.expectedSourceRevision,
      title,
    };
    duplicateOutcomeOriginRef.current = duplicateOriginRef.current;
    setDuplicating(true);
    setLocalError(undefined);
    try {
      const definition = await invoke<ReportDefinition>("duplicate_report", { request });
      setDuplicateDraft(undefined);
      await refreshList();
      await openReport(definition.reportRef);
      setDuplicatedNotice(interpolate(copy.duplicate.completed, {
        title: definition.title,
      }));
    } catch (reason) {
      setLocalError(commandErrorCode(reason));
    } finally {
      setDuplicating(false);
    }
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
      setRunParameterDraft(undefined);
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
    const transientRun = resolved.runParameters.trainingComparison?.origin === "transient-override"
      ? resolved.runParameters.trainingComparison.effectiveValue
      : undefined;
    try {
      const definition = await invoke<ReportDefinition>("refresh_report", { request });
      setEditor(editorFromDefinition(definition));
      setResolved(undefined);
      setRunParameterDraft(undefined);
      setRefreshReviewOpen(false);
      await refreshList();
      const current = await resolveReport(definition.reportRef, transientRun);
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

  function updateRunParameterRange(
    range: "baselineRange" | "comparisonRange",
    boundary: "from" | "through",
    value: string,
  ) {
    setRunParameterDraft((current) => current ? {
      ...current,
      [range]: { ...current[range], [boundary]: value },
    } : current);
    if (localError === "invalid-report-run-parameters") setLocalError(undefined);
  }

  function applyRunParameterPreset(selection: ComparisonPeriodSelection) {
    setRunParameterDraft((current) => current ? {
      ...current,
      baselineRange: selection.baseline,
      comparisonRange: selection.comparison,
    } : current);
    if (localError === "invalid-report-run-parameters") setLocalError(undefined);
  }

  async function rerunReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parameters = resolved?.runParameters.trainingComparison;
    if (!resolved || !parameters || !runParameterDraft) return;
    if (
      !validReportRange(runParameterDraft.baselineRange)
      || !validReportRange(runParameterDraft.comparisonRange)
    ) {
      setLocalError("invalid-report-run-parameters");
      return;
    }
    const override = comparisonQueriesMatch(runParameterDraft, parameters.savedDefault)
      ? undefined
      : runParameterDraft;
    await resolveReport(resolved.definition.reportRef, override);
  }

  async function restoreSavedRunParameters() {
    const parameters = resolved?.runParameters.trainingComparison;
    if (!resolved || !parameters) return;
    setRunParameterDraft(parameters.savedDefault);
    await resolveReport(resolved.definition.reportRef);
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
          runParameters:
            resolved.runParameters.trainingComparison?.origin === "transient-override"
              ? {
                  trainingComparison:
                    resolved.runParameters.trainingComparison.effectiveValue,
                }
              : {},
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
    return resolvedSportName(sport, locale, messages.training.sports.families)
      ?? (sport.state === "unavailable" ? copy.sportUnavailable : copy.sportUnclassified);
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
    if (report.period?.kind === "planned-training") {
      return formatTrainingDateTime(report.period.scheduledAtLocal, locale);
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
    if (report.result?.kind === "planned-training") {
      const values = [
        report.result.exerciseCount === null
          ? null
          : countWithUnit(
              report.result.exerciseCount.toString(),
              copy.library.plannedUnits.exercises,
            ),
        report.result.phaseCount === null
          ? null
          : countWithUnit(
              report.result.phaseCount.toString(),
              copy.library.plannedUnits.phases,
            ),
        report.result.expandedPhaseCount === null
          ? null
          : countWithUnit(
              report.result.expandedPhaseCount.toString(),
              copy.library.plannedUnits.passes,
            ),
        report.result.repeatBlockCount === null || report.result.repeatBlockCount === 0
          ? null
          : countWithUnit(
              report.result.repeatBlockCount.toString(),
              copy.library.plannedUnits.repeats,
            ),
      ].filter((value): value is string => value !== null);
      return values.length > 0 ? (
        <p className="report-library-planned-result">{values.join(" · ")}</p>
      ) : (
        <p className="report-library-result-unavailable">
          {copy.library.plannedStructureUnavailable}
        </p>
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
    role: "summary" | "exact-evidence" = "summary",
  ): string {
    switch (metric) {
      case "session-count":
        return number.format(summary.sessionCount);
      case "training-days":
        return number.format(summary.trainingDays);
      case "duration":
        return role === "exact-evidence"
          ? formatExactDuration(
            summary.totalDurationMilliseconds,
            locale,
            messages.training.durationUnits,
          )
          : formatSummaryDuration(
            summary.totalDurationMilliseconds,
            locale,
            messages.training.durationUnits,
          );
      case "distance":
        return formatDistance(
          summary.totalDistanceMeters,
          locale,
          copy.unavailable,
          messages.training.units,
          role,
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
        return formatSummaryDuration(
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
          messages.training.units,
          "comparison",
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

  function decimalDirection(
    value: string | null,
  ): "increased" | "decreased" | "unchanged" | "unavailable" {
    if (value === null || !/^[+-]?\d+(?:\.\d+)?$/.test(value)) return "unavailable";
    const magnitude = value.replace(/^[+-]/, "").replace(/[0.]/g, "");
    if (magnitude.length === 0) return "unchanged";
    return value.startsWith("-") ? "decreased" : "increased";
  }

  function trainingMetricDirection(
    series: TrainingSeriesComparison,
    metric: ReportTrainingMetric,
  ): "increased" | "decreased" | "unchanged" | "unavailable" {
    if (metric === "distance") {
      if (series.distanceMetersChange === null || !Number.isFinite(series.distanceMetersChange)) {
        return "unavailable";
      }
      if (series.distanceMetersChange === 0) return "unchanged";
      return series.distanceMetersChange < 0 ? "decreased" : "increased";
    }
    const change = metric === "session-count"
      ? series.sessionCountChange
      : metric === "training-days"
        ? series.trainingDayChange
        : metric === "duration"
          ? series.durationMillisecondsChange
          : series.energyKilocaloriesChange;
    return decimalDirection(change);
  }

  function trainingFinding(
    series: TrainingSeriesComparison,
    metric: ReportTrainingMetric,
  ): string {
    const direction = trainingMetricDirection(series, metric);
    if (direction === "unavailable") return copy.analysis.unavailable;
    return interpolate(copy.analysis.findings[direction], {
      metric: copy.analysis.metrics[metric],
      baseline: trainingMetricValue(series.baseline, metric),
      comparison: trainingMetricValue(series.comparison, metric),
      change: trainingMetricChange(series, metric),
    });
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
    sourceIndex: number,
    blockHeading: string,
    compact = false,
  ) {
    const sourceLabel = interpolate(copy.analysis.sourceLabel, {
      number: number.format(sourceIndex + 1),
    });
    const exactHeading = copy.analysis.blocks["training-exact-table"].heading;
    const tableHeading = blockHeading === exactHeading
      ? exactHeading
      : `${blockHeading} · ${exactHeading}`;
    const accessibleName = `${tableHeading} · ${sourceLabel}`;
    return (
      <DataTable
        accessibleName={accessibleName}
        className={compact ? "report-analysis-table compact" : "report-analysis-table"}
        scrollAccessibleName={accessibleName}
        scrollClassName="table-scroll"
      >
          <thead>
            <tr>
              <th scope="col">{copy.analysis.metric}</th>
              <NumericTableHeader scope="col">{copy.analysis.baseline}</NumericTableHeader>
              <NumericTableHeader scope="col">{copy.analysis.comparison}</NumericTableHeader>
              <NumericTableHeader scope="col">{copy.analysis.change}</NumericTableHeader>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => (
                <tr key={metric}>
                  <th scope="row">{copy.analysis.metrics[metric]}</th>
                  <NumericTableCell>{trainingMetricValue(series.baseline, metric, "exact-evidence")}</NumericTableCell>
                  <NumericTableCell>{trainingMetricValue(series.comparison, metric, "exact-evidence")}</NumericTableCell>
                  <NumericTableCell>{trainingMetricChange(series, metric)}</NumericTableCell>
                </tr>
            ))}
          </tbody>
      </DataTable>
    );
  }

  function renderComparisonTable(
    series: TrainingSeriesComparison,
    metrics: ReportTrainingMetric[],
    sourceIndex: number,
    blockHeading: string,
  ) {
    return (
      <div className="report-analysis-series" key={series.seriesRef}>
        <h4>{interpolate(copy.analysis.sourceLabel, {
          number: number.format(sourceIndex + 1),
        })}</h4>
        {renderExactComparisonTable(series, metrics, sourceIndex, blockHeading)}
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
      const multipleSources = comparison.series.length > 1;
      return (
        <article key={block.blockRef}>
          <h3>{labels.heading}</h3>
          {ranges}
          {comparison.series.map((series, index) => (
            <div
              className={multipleSources ? "report-analysis-series" : undefined}
              key={series.seriesRef}
            >
              {multipleSources && <h4>{interpolate(copy.analysis.sourceLabel, {
                  number: number.format(index + 1),
              })}</h4>}
              <p className="report-analysis-finding">
                {trainingFinding(series, block.metric)}
              </p>
            </div>
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
                {renderExactComparisonTable(
                  series,
                  [block.metric],
                  index,
                  labels.heading,
                  true,
                )}
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
          labels.heading,
        ))}
      </article>
    );
  }

  function editorBlockLabel(block: SessionReportBlockDraft): string {
    if (block.kind === "session-evidence") return copy.sessionBlockHeading;
    if (block.kind === "narrative") return copy.interpretationHeading;
    if (block.kind === "planned-training") return copy.plannedBlockHeading;
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
      const timing = formatSessionTimeSpan(
        resolved.session.startedAtLocal,
        resolved.session.stoppedAtLocal,
        resolved.session.durationMilliseconds,
        locale,
        messages.training.durationUnits,
      );
      return (
        <article key={block.blockRef}>
          <h3>{copy.sessionBlockHeading}</h3>
          <p className="report-attribution">{copy.recordedAttribution}</p>
          <dl className="report-evidence-summary">
            <div>
              <dt>{messages.training.timing}</dt>
              <dd className="session-time-summary">
                <span>{timing.date}</span>
                {timing.time && <span>{timing.time}</span>}
                <span>{timing.duration}</span>
              </dd>
            </div>
            <div><dt>{messages.training.distance}</dt><dd>{formatDistance(resolved.session.distanceMeters, locale, copy.unavailable, messages.training.units)}</dd></div>
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
                  family={sportCanonicalFamily(resolved.session.sport)}
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
    if (block.kind === "planned-training") {
      const evidence = resolved.plannedTraining;
      if (!evidence || evidence.blockRef !== block.blockRef) {
        return (
          <article key={block.blockRef}>
            <h3>{copy.plannedBlockHeading}</h3>
            <p>{copy.plannedEvidenceUnavailable}</p>
          </article>
        );
      }
      const summary = evidence.target.target.summary;
      return (
        <article className="report-planned-training" key={block.blockRef}>
          <p className="report-attribution">{copy.plannedAttribution}</p>
          <h3>{summary.name}</h3>
          {summary.targetKind.kind === "scheduled" && (
            <time dateTime={summary.targetKind.scheduledAtLocal}>
              {formatTrainingDateTime(summary.targetKind.scheduledAtLocal, locale)}
            </time>
          )}
          {summary.description && <p>{summary.description}</p>}
          <PlannedTrainingEvidence
            detail={evidence.target}
            locale={locale}
            messages={messages}
          />
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
    : editor?.physiologyAvailable ?? false;
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
  const returnLabel = contextualOrigin
    ? contextualOrigin.kind === "session"
      ? copy.backToSession
      : contextualOrigin.kind === "planned-training"
        ? copy.backToPlannedTraining
        : copy.backToComparison
    : canonicalSourceTarget?.kind === "session"
      ? copy.viewSourceSession
      : canonicalSourceTarget?.kind === "comparison"
        ? copy.viewSourceComparison
        : canonicalSourceTarget?.kind === "planned-training"
          ? copy.viewSourcePlannedTraining
          : undefined;

  return (
    <section className="reports-panel" aria-labelledby="reports-heading">
      <header className="reports-hero">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 id="reports-heading">{copy.heading}</h1>
        <p>{copy.intro}</p>
      </header>

      {returnLabel && workspace !== "subject" && (
        <button
          type="button"
          className="secondary"
          disabled={duplicateDraft !== undefined}
          onClick={() => onReturnToOrigin(contextualOrigin ? null : canonicalSourceTarget)}
        >
          <span aria-hidden="true">← </span>
          {returnLabel}
        </button>
      )}

      {workspace !== "subject" && (
        <WorkspaceNavigation
          label={copy.workspaceNavigation}
          current={workspace}
          options={[
            {
              workspace: "library",
              label: copy.workspaces.library,
              disabled: duplicateDraft !== undefined,
            },
            {
              workspace: "compose",
              label: copy.workspaces.compose,
              disabled: duplicateDraft !== undefined || !editor || resolved?.status === "stale",
            },
            {
              workspace: "preview",
              label: copy.workspaces.preview,
              disabled: duplicateDraft !== undefined || !resolved,
            },
          ]}
          onSelect={setWorkspace}
        />
      )}

      {duplicateDraft && (
        <form
          className="report-duplicate-task"
          role="dialog"
          aria-labelledby="report-duplicate-heading"
          aria-busy={duplicating}
          onSubmit={(event) => void submitDuplicate(event)}
        >
          <p className="eyebrow">{copy.duplicate.eyebrow}</p>
          <h2 id="report-duplicate-heading" ref={duplicateHeadingRef} tabIndex={-1}>
            {interpolate(copy.duplicate.heading, { title: duplicateDraft.sourceTitle })}
          </h2>
          <p>{copy.duplicate.intro}</p>
          <label className="report-field">
            <span>{copy.duplicate.titleLabel}</span>
            <input
              value={duplicateDraft.title}
              maxLength={120}
              required
              disabled={duplicating}
              aria-invalid={localError === "invalid-report-duplicate-title" || undefined}
              aria-describedby={localError ? "report-duplicate-error" : undefined}
              onChange={(event) => {
                setLocalError(undefined);
                setDuplicateDraft({ ...duplicateDraft, title: event.target.value });
              }}
            />
          </label>
          {localError && (
            <p id="report-duplicate-error" className="error" role="alert">
              {copy.errors[localError as keyof typeof copy.errors] ?? copy.errors.unexpected}
            </p>
          )}
          <div className="report-actions">
            <button type="submit" disabled={duplicating || disabled}>
              {copy.duplicate.submit}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={duplicating}
              onClick={(event) => closeDuplicate(event.currentTarget)}
            >
              {copy.duplicate.cancel}
            </button>
            {duplicating && (
              <span className="progress-submit-status" role="status" aria-live="polite">
                {copy.duplicate.creating}
              </span>
            )}
          </div>
        </form>
      )}

      <div
        className={`reports-layout reports-layout-${workspace}`}
        hidden={duplicateDraft !== undefined}
      >
        <section
          className="report-library"
          aria-label={copy.libraryWorkspace}
          hidden={workspace !== "library"}
        >
          <section className="report-examples" aria-labelledby="report-examples-heading">
            <div className="report-examples-heading">
              <h2 id="report-examples-heading">{copy.examples.heading}</h2>
              <p>{copy.examples.intro}</p>
            </div>
            {examplesLoading && <p role="status">{copy.examples.loading}</p>}
            {examplesFailed && (
              <div className="report-examples-failure">
                <p className="error" role="alert">{copy.examples.failed}</p>
                <button
                  type="button"
                  className="secondary"
                  disabled={disabled}
                  onClick={() => void refreshExamples()}
                >
                  {copy.examples.retry}
                </button>
              </div>
            )}
            {!examplesLoading && !examplesFailed && (
              <ul className="report-example-list">
                {examples.map((example) => {
                  const itemCopy = copy.examples.items[example.id];
                  return (
                    <li key={`${example.id}:${example.version}`}>
                      <article className="report-example-card">
                        <div>
                          <h3>{itemCopy.title}</h3>
                          <p className="report-example-question">{itemCopy.question}</p>
                          <p>{itemCopy.purpose}</p>
                          <p className="report-example-recipe">{itemCopy.recipe}</p>
                        </div>
                        {example.availability.kind === "unavailable" ? (
                          <p className="report-example-unavailable">
                            {interpolate(copy.examples.unavailable, {
                              capabilities: capabilityList.format(
                                example.availability.missingCapabilities.map(
                                  (capability) => copy.examples.capabilities[capability],
                                ),
                              ),
                            })}
                          </p>
                        ) : (
                          <div className="report-example-action">
                            {example.availability.kind === "selection-required" && (
                              <p>{copy.examples.selectionRequired}</p>
                            )}
                            <button
                              type="button"
                              className="secondary"
                              disabled={disabled || resolving}
                              onClick={(event) => beginReportExample(example, event.currentTarget)}
                            >
                              {itemCopy.action}
                            </button>
                          </div>
                        )}
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
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
              <button
                type="button"
                className="secondary"
                onClick={() => void refreshLibrary()}
                disabled={listLoading || examplesLoading}
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
            <p className="report-library-empty">{copy.empty}</p>
          )}
          {removedNotice && <p className="notice" role="status">{removedNotice}</p>}
          {reports.length > 0 && (
            <ul className="report-list">
              {reports.map((report) => (
                <li key={report.reportRef}>
                  <article className="report-library-card">
                    <button
                      type="button"
                      className="report-library-open"
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
                              family={sportCanonicalFamily(report.subject.sport)}
                              state={report.subject.sport.state}
                            />
                            <span>{sportLabel(report.subject.sport)}</span>
                          </>
                        )}
                        {report.subject.kind === "training-comparison"
                          && <span>{copy.library.trainingComparison}</span>}
                        {report.subject.kind === "planned-training"
                          && <span>{report.subject.name ?? copy.library.plannedTraining}</span>}
                        {report.subject.kind === "authored-note"
                          && <span>{copy.library.authoredNote}</span>}
                      </span>
                      {report.period?.kind === "session" || report.period?.kind === "planned-training"
                        ? (
                          <time
                            className="report-library-period"
                            dateTime={report.period.kind === "session"
                              ? report.period.startedAtLocal
                              : report.period.scheduledAtLocal}
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
                    <div className="report-library-card-actions">
                      <button
                        type="button"
                        className="secondary"
                        aria-label={interpolate(copy.duplicate.libraryAction, {
                          title: report.title,
                        })}
                        disabled={disabled || resolving}
                        onClick={(event) => beginDuplicate(report, event.currentTarget)}
                      >
                        {copy.duplicate.action}
                      </button>
                    </div>
                  </article>
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

        {subjectPicker && (
          <section
            ref={subjectPickerRef}
            className="report-subject-picker"
            aria-labelledby="report-subject-heading"
            hidden={workspace !== "subject"}
          >
            <div className="report-section-heading">
              <div>
                <p className="eyebrow">
                  {copy.examples.items[subjectPicker.example.id].question}
                </p>
                <h2 id="report-subject-heading" ref={subjectHeadingRef} tabIndex={-1}>
                  {subjectCopy.heading}
                </h2>
                <p>{subjectCopy.intro}</p>
              </div>
              <button
                type="button"
                className="secondary"
                disabled={selectingSubjectRef !== undefined}
                onClick={closeReportSubjectPicker}
              >
                <span aria-hidden="true">← </span>
                {subjectCopy.cancel}
              </button>
            </div>
            {subjectsLoading && <p role="status">{subjectCopy.loading}</p>}
            {subjectsFailure && (
              <div className="report-subject-failure">
                <p className="error" role="alert">
                  {subjectsFailure === "report-source-changed"
                    ? subjectCopy.sourceChanged
                    : subjectCopy.failed}
                </p>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void loadReportSubjects(subjectPicker.example, 0, false, null)}
                >
                  {subjectCopy.retry}
                </button>
              </div>
            )}
            {!subjectsLoading && !subjectsFailure && subjectPicker.subjects.length === 0 && (
              <p>{subjectCopy.empty}</p>
            )}
            {!subjectsLoading && !subjectsFailure && subjectPicker.subjects.length > 0 && (
              <>
                <p className="report-subject-count" aria-live="polite">
                  {interpolate(subjectCopy.count, {
                    shown: number.format(subjectPicker.subjects.length),
                    total: number.format(subjectPicker.totalCount),
                  })}
                </p>
                <ul className="report-subject-list">
                  {subjectPicker.kind === "training-session"
                    ? subjectPicker.subjects.map((subject) => {
                        const session = subject.session;
                        return (
                          <li key={session.sessionRef}>
                            <article className="report-subject-card">
                              <div className="report-subject-identity">
                                <SportFamilyIcon
                                  family={sportCanonicalFamily(session.sport)}
                                  state={session.sport.state}
                                />
                                <div>
                                  <h3>{sportLabel(session.sport)}</h3>
                                  <time dateTime={session.startedAtLocal}>
                                    {formatTrainingDateTime(session.startedAtLocal, locale)}
                                  </time>
                                </div>
                              </div>
                              <dl className="report-subject-facts">
                                <div>
                                  <dt>{messages.training.duration}</dt>
                                  <dd>{formatSessionCardDuration(
                                    session.durationMilliseconds,
                                    locale,
                                    messages.training.durationUnits,
                                  )}</dd>
                                </div>
                                {session.distanceMeters !== null && (
                                  <div>
                                    <dt>{messages.training.distance}</dt>
                                    <dd>{formatSessionCardDistance(
                                      session.distanceMeters,
                                      locale,
                                      messages.training.units,
                                    )}</dd>
                                  </div>
                                )}
                              </dl>
                              {subject.hasRouteEvidence && (
                                <p className="report-subject-route">
                                  {copy.examples.subjects.routeEvidence}
                                </p>
                              )}
                              <button
                                type="button"
                                disabled={selectingSubjectRef !== undefined || disabled}
                                onClick={() => void useReportSubject(subject)}
                              >
                                {selectingSubjectRef === session.sessionRef
                                  ? copy.examples.subjects.using
                                  : copy.examples.subjects.use}
                              </button>
                            </article>
                          </li>
                        );
                      })
                    : subjectPicker.subjects.map((subject) => (
                        <li key={subject.targetRef}>
                          <article className="report-subject-card report-planned-subject-card">
                            <div className="report-subject-identity">
                              <PlannedTrainingSubjectIcon />
                              <div>
                                <h3>{subject.name}</h3>
                                {subject.kind === "scheduled" && subject.scheduledAtLocal ? (
                                  <p>
                                    {copy.examples.plannedSubjects.scheduled}
                                    {" · "}
                                    <time dateTime={subject.scheduledAtLocal}>
                                      {formatTrainingDateTime(subject.scheduledAtLocal, locale)}
                                    </time>
                                    {subject.completion && (
                                      <>{" · "}{copy.examples.plannedSubjects[subject.completion]}</>
                                    )}
                                  </p>
                                ) : (
                                  <p>{copy.examples.plannedSubjects.favorite}</p>
                                )}
                              </div>
                            </div>
                            <p className="report-planned-subject-shape">
                              {[
                                countWithUnit(
                                  subject.exerciseCount.toString(),
                                  copy.library.plannedUnits.exercises,
                                ),
                                countWithUnit(
                                  subject.phaseCount.toString(),
                                  copy.library.plannedUnits.phases,
                                ),
                                countWithUnit(
                                  subject.repeatBlockCount.toString(),
                                  copy.library.plannedUnits.repeats,
                                ),
                              ].join(" · ")}
                            </p>
                            {subject.containsIntensityEvidence && (
                              <p className="report-subject-route">
                                {copy.examples.plannedSubjects.intensityEvidence}
                              </p>
                            )}
                            <button
                              type="button"
                              disabled={selectingSubjectRef !== undefined || disabled}
                              onClick={() => void usePlannedReportSubject(subject)}
                            >
                              {selectingSubjectRef === subject.targetRef
                                ? copy.examples.plannedSubjects.using
                                : copy.examples.plannedSubjects.use}
                            </button>
                          </article>
                        </li>
                      ))}
                </ul>
                {subjectPicker.nextOffset !== null && (
                  <button
                    type="button"
                    className="secondary report-subject-more"
                    disabled={subjectsLoadingMore || selectingSubjectRef !== undefined}
                    onClick={() => void loadMoreReportSubjects()}
                  >
                    {subjectsLoadingMore
                      ? subjectCopy.loading
                      : subjectCopy.loadMore}
                  </button>
                )}
              </>
            )}
            {localError && selectingSubjectRef === undefined && (
              <p className="error" role="alert">
                {localError === "report-source-changed"
                  ? subjectCopy.sourceChanged
                  : copy.errors[localError as keyof typeof copy.errors] ?? copy.errors.unexpected}
              </p>
            )}
          </section>
        )}

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
                        {block.kind === "planned-training" && editor.plannedTarget && (
                          <div className="report-planned-training-source">
                            <strong>{editor.plannedTarget.target.summary.name}</strong>
                            <p>{copy.plannedAttribution}</p>
                          </div>
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

                {editor.origin.kind !== "planned-training" && (
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
                )}
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
          {duplicatedNotice && (
            <p className="notice" role="status">
              {duplicatedNotice}
            </p>
          )}
          {refreshedNotice && (
            <p ref={refreshedNoticeRef} className="notice" role="status" tabIndex={-1}>
              {copy.refresh.completed}
            </p>
          )}
          {localError
            && localError !== "invalid-report-run-parameters"
            && workspace !== "subject" && (
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
              {resolved.runParameters.trainingComparison
                && runParameterDraft
                && resolved.trainingComparison?.availableRange && (
                <details
                  className="report-run-parameters"
                >
                  <summary>
                    <span
                      id="report-run-parameters-heading"
                      className="report-run-parameter-heading"
                    >
                      {copy.runParameters.heading}
                    </span>
                    <span className="report-run-parameter-status" aria-live="polite">
                      {resolved.runParameters.trainingComparison.origin === "transient-override"
                        ? copy.runParameters.transient
                        : copy.runParameters.savedDefault}
                    </span>
                  </summary>
                  <div className="report-run-parameter-body">
                    <p>{copy.runParameters.intro}</p>
                    <form onSubmit={(event) => void rerunReport(event)}>
                      <ComparisonPeriodPresets
                        availableRange={resolved.trainingComparison.availableRange}
                        baselineRange={runParameterDraft.baselineRange}
                        comparisonRange={runParameterDraft.comparisonRange}
                        locale={locale}
                        messages={messages.comparisonPeriods}
                        disabled={disabled || resolving}
                        onSelect={applyRunParameterPreset}
                      />
                      <div className="report-run-parameter-dates">
                        <label>
                          <span>{copy.analysis.baselineFrom}</span>
                          <input
                            type="date"
                            value={runParameterDraft.baselineRange.from}
                            disabled={disabled || resolving}
                            required
                            aria-invalid={localError === "invalid-report-run-parameters" || undefined}
                            onChange={(event) => updateRunParameterRange(
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
                            value={runParameterDraft.baselineRange.through}
                            disabled={disabled || resolving}
                            required
                            aria-invalid={localError === "invalid-report-run-parameters" || undefined}
                            onChange={(event) => updateRunParameterRange(
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
                            value={runParameterDraft.comparisonRange.from}
                            disabled={disabled || resolving}
                            required
                            aria-invalid={localError === "invalid-report-run-parameters" || undefined}
                            onChange={(event) => updateRunParameterRange(
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
                            value={runParameterDraft.comparisonRange.through}
                            disabled={disabled || resolving}
                            required
                            aria-invalid={localError === "invalid-report-run-parameters" || undefined}
                            onChange={(event) => updateRunParameterRange(
                              "comparisonRange",
                              "through",
                              event.target.value,
                            )}
                          />
                        </label>
                      </div>
                      {localError === "invalid-report-run-parameters" && (
                        <p className="error" role="alert">{copy.runParameters.invalid}</p>
                      )}
                      <div className="report-actions">
                        <ProgressSubmitButton
                          loading={resolving}
                          disabled={disabled}
                          actionLabel={copy.runParameters.apply}
                          progressLabel={copy.runParameters.applying}
                        />
                        {(resolved.runParameters.trainingComparison.origin === "transient-override"
                          || !comparisonQueriesMatch(
                            runParameterDraft,
                            resolved.runParameters.trainingComparison.savedDefault,
                          )) && (
                          <button
                            type="button"
                            className="secondary"
                            disabled={disabled || resolving}
                            onClick={() => void restoreSavedRunParameters()}
                          >
                            {copy.runParameters.restore}
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </details>
              )}
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
                  className="secondary"
                  disabled={disabled || duplicating}
                  onClick={(event) => beginDuplicate(
                    resolved.definition,
                    event.currentTarget,
                  )}
                >
                  {copy.duplicate.action}
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
                        : resolved.provenance.kind === "planned-training-snapshot"
                          ? copy.plannedSnapshotProvenance
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
                {resolved.runParameters.trainingComparison && (
                  <li>
                    {interpolate(copy.runParameters.exportIncluded, {
                      baseline: formatReportRange(
                        resolved.runParameters.trainingComparison.effectiveValue.baselineRange,
                        locale,
                      ),
                      comparison: formatReportRange(
                        resolved.runParameters.trainingComparison.effectiveValue.comparisonRange,
                        locale,
                      ),
                      origin:
                        resolved.runParameters.trainingComparison.origin === "transient-override"
                          ? copy.runParameters.exportTransient
                          : copy.runParameters.exportSaved,
                    })}
                  </li>
                )}
                {resolved.plannedTraining && <li>{copy.plannedTrainingIncluded}</li>}
                <li>{copy.titleIncluded}</li>
                {resolved.definition.blocks.some((block) => block.kind === "narrative")
                  && <li>{copy.narrativeIncluded}</li>}
                <li>{copy.provenanceIncluded}</li>
                {(resolved.session || resolved.trainingComparison)
                  && <li>{copy.exactSamplesExcluded}</li>}
                {resolved.routes.length > 0 && <li>{copy.routeShapeRestricted}</li>}
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
