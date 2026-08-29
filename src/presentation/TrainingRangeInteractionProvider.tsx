import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";

import { type catalogs, type Locale } from "../locales/catalogs";
import { commandErrorCode } from "./command-error";
import { integerCountFormatter } from "./presentation-format";
import {
  coordinateKey,
  elapsedEditorValue,
  findEstablishedCoordinate,
  MAX_RANGE_TITLE_CHARACTERS,
  parseElapsedEditorValue,
  rangeEditorValidation,
  rangeMayBeAdjusted,
  selectableRangeCoordinates,
  type RangeEditorValidation,
  type SelectableRangeCoordinate,
  type SelectableRangeExercise,
} from "./training-range-editor-model";
import type { SessionStory } from "./session-story";
import type {
  TrainingSessionCurrentRangeCoordinate,
  TrainingSessionRange,
  TrainingSessionRangeCoordinateContext,
  TrainingSessionRangeDraftSummary,
  TrainingSessionRangesResult,
  TrainingSessionRangeSummary,
} from "./training-session-range";

export type TrainingRangeEditorSurface = "library" | "route" | "signal" | "structure" | "exact";

export interface TrainingRangeEditorState {
  mode: "create" | "rename" | "adjust";
  surface: TrainingRangeEditorSurface;
  rangeRef?: string;
  title: string;
  startedAt: string;
  endedAt: string;
  exerciseRef: string;
  coordinate: TrainingSessionCurrentRangeCoordinate | null;
  dirty: boolean;
}

interface RangeEditorPreset {
  exerciseRef: string;
  coordinate: TrainingSessionCurrentRangeCoordinate;
  startedAtElapsedMilliseconds?: string;
  endedAtElapsedMilliseconds?: string;
}

type RangeMutationCommand =
  | "create_training_session_range"
  | "rename_training_session_range"
  | "adjust_training_session_range"
  | "remove_training_session_range";

export type TrainingRangeMutationOutcome = "success" | "conflict" | "failed" | "invalid";

interface TrainingRangeInteraction {
  result: TrainingSessionRangesResult | undefined;
  loading: boolean;
  failed: boolean;
  selectedRange: TrainingSessionRange | undefined;
  summary: TrainingSessionRangeSummary | undefined;
  summaryLoading: boolean;
  summaryFailed: boolean;
  draftSummary: TrainingSessionRangeDraftSummary | undefined;
  draftSummaryLoading: boolean;
  draftSummaryFailed: boolean;
  editor: TrainingRangeEditorState | undefined;
  editorRange: TrainingSessionRange | undefined;
  editorExercise: SelectableRangeExercise | undefined;
  editorCoordinate: SelectableRangeCoordinate | undefined;
  establishedContext: TrainingSessionRangeCoordinateContext | undefined;
  editorMaximum: string | undefined;
  editorValidation: RangeEditorValidation | undefined;
  choices: SelectableRangeExercise[];
  editableChoices: SelectableRangeExercise[];
  mutationCommand: RangeMutationCommand | undefined;
  busy: boolean;
  removeConfirmation: boolean;
  status: string | undefined;
  selectRange: (rangeRef: string) => void;
  openCreateEditor: (
    surface?: TrainingRangeEditorSurface,
    preset?: RangeEditorPreset,
  ) => void;
  openRenameEditor: (range: TrainingSessionRange, surface?: TrainingRangeEditorSurface) => void;
  openAdjustEditor: (range: TrainingSessionRange, surface?: TrainingRangeEditorSurface) => void;
  updateEditor: (update: Partial<Omit<TrainingRangeEditorState, "mode" | "surface">>) => void;
  cancelEditor: () => void;
  submitEditor: () => Promise<TrainingRangeMutationOutcome>;
  requestRemoveConfirmation: () => void;
  cancelRemoveConfirmation: () => void;
  removeRange: (range: TrainingSessionRange) => Promise<TrainingRangeMutationOutcome>;
  reload: () => Promise<void>;
  retrySummary: () => void;
  retryDraftSummary: () => void;
  rangeCoordinateLabel: (range: TrainingSessionRange) => string;
  mayAdjust: (range: TrainingSessionRange) => boolean;
}

interface TrainingRangeInteractionProviderProps {
  sessionRef: string;
  snapshotRef: string;
  story: SessionStory | undefined;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  onError: (code: string | undefined) => void;
  children: ReactNode;
}

const TrainingRangeInteractionContext = createContext<TrainingRangeInteraction | undefined>(
  undefined,
);

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

function defaultRangeEnd(maximum: string | undefined): string {
  if (maximum === undefined) return "0:00:01";
  const exact = BigInt(maximum);
  return elapsedEditorValue(exact < 60_000n ? exact.toString() : "60000");
}

function normalizedTitle(title: string): string | undefined {
  const value = title.trim();
  return value.length > 0 && [...value].length <= MAX_RANGE_TITLE_CHARACTERS
    ? value
    : undefined;
}

export function TrainingRangeInteractionProvider({
  sessionRef,
  snapshotRef,
  story,
  locale,
  messages,
  onError,
  children,
}: TrainingRangeInteractionProviderProps) {
  const [result, setResult] = useState<TrainingSessionRangesResult>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selectedRangeRef, setSelectedRangeRef] = useState<string>();
  const [summary, setSummary] = useState<TrainingSessionRangeSummary>();
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [summaryRetry, setSummaryRetry] = useState(0);
  const [draftSummary, setDraftSummary] = useState<TrainingSessionRangeDraftSummary>();
  const [draftSummaryLoading, setDraftSummaryLoading] = useState(false);
  const [draftSummaryFailed, setDraftSummaryFailed] = useState(false);
  const [draftSummaryRetry, setDraftSummaryRetry] = useState(0);
  const [editor, setEditor] = useState<TrainingRangeEditorState>();
  const [mutationCommand, setMutationCommand] = useState<RangeMutationCommand>();
  const [removeConfirmation, setRemoveConfirmation] = useState(false);
  const [status, setStatus] = useState<string>();
  const copy = messages.training.sessionLibrary.ranges;
  const integer = useMemo(() => integerCountFormatter(locale), [locale]);
  const busy = mutationCommand !== undefined;

  const choices = useMemo(() => selectableRangeCoordinates(result ?? {
    snapshotRef,
    sessionRef,
    sessionDurationMilliseconds: "0",
    evidenceRevision: "",
    exercises: [],
    ranges: [],
  }, story, {
    exercise: (ordinal, sport) => sport
      ? interpolate(copy.exerciseChoice, {
        sport,
        number: integer.format(ordinal + 1),
      })
      : interpolate(copy.exerciseFallback, { number: integer.format(ordinal + 1) }),
    exerciseTimeline: copy.exerciseTimeline,
    primaryRoute: copy.primaryRouteTimeline,
    transitionRoute: copy.transitionRouteTimeline,
    recordedRoute: copy.recordedRouteTimeline,
    signal: (kind, role) => interpolate(copy.signalTimeline, {
      signal: messages.training.sessionLibrary.signalKinds[kind],
      role: role === "primary" ? copy.primarySignalTimeline : copy.transitionSignalTimeline,
    }),
    recordedSignal: copy.recordedSignalTimeline,
  }), [copy, integer, messages, result, sessionRef, snapshotRef, story]);
  const editableChoices = useMemo(() => choices.flatMap((exercise) => {
    const coordinates = exercise.coordinates.filter(
      (coordinate) => BigInt(coordinate.maximumElapsedMilliseconds) > 0n,
    );
    return coordinates.length > 0 ? [{ ...exercise, coordinates }] : [];
  }), [choices]);

  const selectedRange = result?.ranges.find((range) => range.rangeRef === selectedRangeRef);
  const editorRange = editor?.rangeRef
    ? result?.ranges.find((range) => range.rangeRef === editor.rangeRef)
    : undefined;
  const editorExercise = editableChoices.find(
    (choice) => choice.exerciseRef === editor?.exerciseRef,
  );
  const editorCoordinateState = editor?.coordinate;
  const editorCoordinate = editorExercise?.coordinates.find(
    (choice) => editorCoordinateState !== undefined && editorCoordinateState !== null
      && coordinateKey(choice.coordinate) === coordinateKey(editorCoordinateState),
  );
  const establishedContext = editorRange && result
    ? findEstablishedCoordinate(result, editorRange)
    : undefined;
  const editorMaximum = editor?.mode === "rename"
    ? undefined
    : establishedContext?.maximumElapsedMilliseconds
      ?? editorCoordinate?.maximumElapsedMilliseconds;
  const editorValidation = editor ? rangeEditorValidation({
    title: editor.title,
    startedAt: editor.startedAt,
    endedAt: editor.endedAt,
    maximumElapsedMilliseconds: editorMaximum,
    requireTitle: editor.mode !== "adjust" || editorRange === undefined,
  }) : undefined;
  const draftStartedAtCandidate = editor?.mode === "rename"
    ? undefined
    : parseElapsedEditorValue(editor?.startedAt ?? "");
  const draftEndedAtCandidate = editor?.mode === "rename"
    ? undefined
    : parseElapsedEditorValue(editor?.endedAt ?? "");
  const draftBoundsValid = draftStartedAtCandidate !== undefined
    && draftEndedAtCandidate !== undefined
    && editorMaximum !== undefined
    && BigInt(draftStartedAtCandidate) < BigInt(draftEndedAtCandidate)
    && BigInt(draftEndedAtCandidate) <= BigInt(editorMaximum);
  const draftStartedAt = draftBoundsValid ? draftStartedAtCandidate : undefined;
  const draftEndedAt = draftBoundsValid ? draftEndedAtCandidate : undefined;
  const draftCoordinate = editor?.surface === "route"
    && editorCoordinate?.coordinate.scope === "route-elapsed"
    ? editorCoordinate.coordinate
    : undefined;

  async function queryContext(querySnapshotRef: string | null): Promise<TrainingSessionRangesResult> {
    return invoke<TrainingSessionRangesResult>("query_training_session_ranges", {
      query: { sessionRef, snapshotRef: querySnapshotRef },
    });
  }

  function applyContext(updated: TrainingSessionRangesResult, preferredRangeRef?: string) {
    setResult(updated);
    setFailed(false);
    setSelectedRangeRef((current) => {
      const preferred = preferredRangeRef
        && updated.ranges.some((range) => range.rangeRef === preferredRangeRef)
        ? preferredRangeRef
        : undefined;
      if (preferred) return preferred;
      if (current && updated.ranges.some((range) => range.rangeRef === current)) return current;
      return updated.ranges[0]?.rangeRef;
    });
  }

  async function reload(querySnapshotRef: string | null = snapshotRef) {
    setLoading(true);
    setFailed(false);
    try {
      applyContext(await queryContext(querySnapshotRef));
    } catch {
      setFailed(true);
      setResult(undefined);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    setResult(undefined);
    setSelectedRangeRef(undefined);
    setEditor(undefined);
    setStatus(undefined);
    if (!story || snapshotRef.length === 0) {
      setLoading(false);
      return () => { active = false; };
    }
    void queryContext(snapshotRef).then((value) => {
      if (!active) return;
      setResult(value);
      setSelectedRangeRef(value.ranges[0]?.rangeRef);
    }).catch(() => {
      if (active) setFailed(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [sessionRef, snapshotRef, story]);

  useEffect(() => {
    if (!selectedRange || !result) {
      setSummary(undefined);
      setSummaryLoading(false);
      setSummaryFailed(false);
      return;
    }
    let active = true;
    setSummary(undefined);
    setSummaryLoading(true);
    setSummaryFailed(false);
    void invoke<TrainingSessionRangeSummary>("query_training_session_range_summary", {
      query: {
        sessionRef,
        snapshotRef: result.snapshotRef,
        rangeRef: selectedRange.rangeRef,
        expectedRangeRevision: selectedRange.revision,
      },
    }).then((value) => {
      if (active) setSummary(value);
    }).catch((reason) => {
      if (!active) return;
      setSummaryFailed(true);
      if (commandErrorCode(reason) === "training-session-range-summary-changed") {
        void queryContext(result.snapshotRef).then((updated) => {
          if (active) applyContext(updated, selectedRange.rangeRef);
        });
      }
    }).finally(() => {
      if (active) setSummaryLoading(false);
    });
    return () => { active = false; };
  }, [result?.snapshotRef, selectedRange?.rangeRef, selectedRange?.revision, sessionRef, summaryRetry]);

  useEffect(() => {
    if (draftStartedAt === undefined || draftEndedAt === undefined || draftCoordinate === undefined
      || !result || !editorExercise) {
      setDraftSummary(undefined);
      setDraftSummaryLoading(false);
      setDraftSummaryFailed(false);
      return;
    }

    let active = true;
    setDraftSummary(undefined);
    setDraftSummaryLoading(true);
    setDraftSummaryFailed(false);
    void invoke<TrainingSessionRangeDraftSummary>("query_training_session_range_draft_summary", {
      query: {
        sessionRef,
        snapshotRef: result.snapshotRef,
        exerciseRef: editorExercise.exerciseRef,
        coordinate: draftCoordinate,
        startedAtElapsedMilliseconds: draftStartedAt,
        endedAtElapsedMilliseconds: draftEndedAt,
      },
    }).then((value) => {
      if (active) setDraftSummary(value);
    }).catch(() => {
      if (active) setDraftSummaryFailed(true);
    }).finally(() => {
      if (active) setDraftSummaryLoading(false);
    });
    return () => { active = false; };
  }, [
    draftSummaryRetry,
    draftCoordinate?.routeRef,
    draftEndedAt,
    draftStartedAt,
    editorExercise?.exerciseRef,
    result?.snapshotRef,
    sessionRef,
  ]);

  function choiceForRange(range: TrainingSessionRange): {
    exercise?: SelectableRangeExercise;
    coordinate?: SelectableRangeCoordinate;
  } {
    const exercise = choices.find((choice) => choice.exerciseRef === range.exerciseRef);
    const coordinate = exercise?.coordinates.find(
      (choice) => coordinateKey(choice.coordinate) === coordinateKey(range.coordinate),
    );
    return { exercise, coordinate };
  }

  function rangeCoordinateLabel(range: TrainingSessionRange): string {
    if (range.coordinate.scope === "legacy-session-elapsed") return copy.legacyTimeline;
    const choice = choiceForRange(range).coordinate;
    if (choice) return choice.label;
    if (range.coordinate.scope === "exercise-elapsed") return copy.exerciseTimeline;
    if (range.coordinate.scope === "route-elapsed") return copy.recordedRouteTimeline;
    return copy.recordedSignalTimeline;
  }

  function resolvePreset(preset: RangeEditorPreset | undefined): {
    exercise: SelectableRangeExercise | undefined;
    coordinate: SelectableRangeCoordinate | undefined;
  } {
    const exercise = preset
      ? editableChoices.find((choice) => choice.exerciseRef === preset.exerciseRef)
      : editableChoices[0];
    const coordinate = preset && exercise
      ? exercise.coordinates.find(
        (choice) => coordinateKey(choice.coordinate) === coordinateKey(preset.coordinate),
      )
      : exercise?.coordinates[0];
    return { exercise, coordinate };
  }

  function openCreateEditor(
    surface: TrainingRangeEditorSurface = "library",
    preset?: RangeEditorPreset,
  ) {
    const { exercise, coordinate } = resolvePreset(preset);
    setEditor({
      mode: "create",
      surface,
      title: "",
      startedAt: elapsedEditorValue(preset?.startedAtElapsedMilliseconds ?? "0"),
      endedAt: preset?.endedAtElapsedMilliseconds === undefined
        ? defaultRangeEnd(coordinate?.maximumElapsedMilliseconds)
        : elapsedEditorValue(preset.endedAtElapsedMilliseconds),
      exerciseRef: exercise?.exerciseRef ?? "",
      coordinate: coordinate?.coordinate ?? null,
      dirty: false,
    });
    setRemoveConfirmation(false);
    setStatus(undefined);
  }

  function openRenameEditor(
    range: TrainingSessionRange,
    surface: TrainingRangeEditorSurface = "library",
  ) {
    setEditor({
      mode: "rename",
      surface,
      rangeRef: range.rangeRef,
      title: range.title,
      startedAt: elapsedEditorValue(range.startedAtElapsedMilliseconds),
      endedAt: elapsedEditorValue(range.endedAtElapsedMilliseconds),
      exerciseRef: range.exerciseRef ?? "",
      coordinate: range.coordinate.scope === "legacy-session-elapsed" ? null : range.coordinate,
      dirty: false,
    });
    setRemoveConfirmation(false);
    setStatus(undefined);
  }

  function openAdjustEditor(
    range: TrainingSessionRange,
    surface: TrainingRangeEditorSurface = "library",
  ) {
    const established = choiceForRange(range);
    const exercise = established.exercise ?? editableChoices[0];
    const coordinate = established.coordinate ?? exercise?.coordinates[0];
    setEditor({
      mode: "adjust",
      surface,
      rangeRef: range.rangeRef,
      title: range.title,
      startedAt: elapsedEditorValue(range.startedAtElapsedMilliseconds),
      endedAt: elapsedEditorValue(range.endedAtElapsedMilliseconds),
      exerciseRef: exercise?.exerciseRef ?? "",
      coordinate: coordinate?.coordinate ?? null,
      dirty: false,
    });
    setRemoveConfirmation(false);
    setStatus(undefined);
  }

  async function refreshAfterConflict(rangeRef: string | undefined, snapshotChanged: boolean) {
    try {
      const updated = await queryContext(snapshotChanged ? null : result?.snapshotRef ?? snapshotRef);
      applyContext(updated, rangeRef);
      setStatus(copy.conflict);
    } catch {
      setStatus(copy.mutationFailed);
    }
  }

  async function mutate(
    command: RangeMutationCommand,
    request: Record<string, unknown>,
    success: string,
    preferredRangeRef?: string,
  ): Promise<TrainingRangeMutationOutcome> {
    setMutationCommand(command);
    setStatus(undefined);
    onError(undefined);
    const priorRangeRefs = new Set(result?.ranges.map((range) => range.rangeRef) ?? []);
    try {
      const updated = await invoke<TrainingSessionRangesResult>(command, { request });
      const createdRangeRef = command === "create_training_session_range"
        ? updated.ranges.find((range) => !priorRangeRefs.has(range.rangeRef))?.rangeRef
        : undefined;
      applyContext(updated, preferredRangeRef ?? createdRangeRef);
      setEditor(undefined);
      setRemoveConfirmation(false);
      setStatus(success);
      return "success";
    } catch (reason) {
      const code = commandErrorCode(reason);
      if (code === "training-session-range-conflict"
        || code === "training-session-ranges-changed"
        || code === "training-session-range-summary-changed") {
        await refreshAfterConflict(
          preferredRangeRef ?? editor?.rangeRef,
          code === "training-session-ranges-changed",
        );
        return "conflict";
      }
      setStatus(copy.mutationFailed);
      return "failed";
    } finally {
      setMutationCommand(undefined);
    }
  }

  async function submitEditor(): Promise<TrainingRangeMutationOutcome> {
    if (!editor || !result) return "invalid";
    if (editor.mode === "rename") {
      const title = normalizedTitle(editor.title);
      if (!title || !editorRange) return "invalid";
      return mutate("rename_training_session_range", {
        sessionRef,
        snapshotRef: result.snapshotRef,
        rangeRef: editorRange.rangeRef,
        expectedRevision: editorRange.revision,
        title,
      }, copy.nameSaved, editorRange.rangeRef);
    }
    if (!editorValidation?.valid) return "invalid";
    if (editor.mode === "create") {
      if (!editorExercise || !editorCoordinate) return "invalid";
      return mutate("create_training_session_range", {
        sessionRef,
        snapshotRef: result.snapshotRef,
        exerciseRef: editorExercise.exerciseRef,
        coordinate: editorCoordinate.coordinate,
        title: editorValidation.title,
        startedAtElapsedMilliseconds: editorValidation.startedAtElapsedMilliseconds,
        endedAtElapsedMilliseconds: editorValidation.endedAtElapsedMilliseconds,
      }, copy.saved);
    }
    if (!editorRange) return "invalid";
    const legacy = editorRange.exerciseRef === null
      && editorRange.coordinate.scope === "legacy-session-elapsed";
    const owner = legacy ? editorExercise?.exerciseRef : editorRange.exerciseRef;
    const coordinate = legacy ? editorCoordinate?.coordinate
      : editorRange.coordinate.scope === "legacy-session-elapsed" ? undefined
        : editorRange.coordinate;
    if (!owner || !coordinate) return "invalid";
    return mutate("adjust_training_session_range", {
      sessionRef,
      snapshotRef: result.snapshotRef,
      rangeRef: editorRange.rangeRef,
      expectedRevision: editorRange.revision,
      exerciseRef: owner,
      coordinate,
      startedAtElapsedMilliseconds: editorValidation.startedAtElapsedMilliseconds,
      endedAtElapsedMilliseconds: editorValidation.endedAtElapsedMilliseconds,
    }, editorRange.state === "review-required" ? copy.reviewed : copy.boundariesSaved, editorRange.rangeRef);
  }

  const value: TrainingRangeInteraction = {
    result,
    loading,
    failed,
    selectedRange,
    summary,
    summaryLoading,
    summaryFailed,
    draftSummary,
    draftSummaryLoading,
    draftSummaryFailed,
    editor,
    editorRange,
    editorExercise,
    editorCoordinate,
    establishedContext,
    editorMaximum,
    editorValidation,
    choices,
    editableChoices,
    mutationCommand,
    busy,
    removeConfirmation,
    status,
    selectRange(rangeRef) {
      setSelectedRangeRef(rangeRef);
      setEditor(undefined);
      setRemoveConfirmation(false);
      setStatus(undefined);
    },
    openCreateEditor,
    openRenameEditor,
    openAdjustEditor,
    updateEditor(update) {
      setEditor((current) => current ? { ...current, ...update, dirty: true } : current);
    },
    cancelEditor() {
      setEditor(undefined);
    },
    submitEditor,
    requestRemoveConfirmation() {
      setRemoveConfirmation(true);
    },
    cancelRemoveConfirmation() {
      setRemoveConfirmation(false);
    },
    removeRange(range) {
      return mutate("remove_training_session_range", {
        sessionRef,
        snapshotRef: result?.snapshotRef ?? snapshotRef,
        rangeRef: range.rangeRef,
        expectedRevision: range.revision,
      }, copy.removed, range.rangeRef);
    },
    reload,
    retrySummary() {
      setSummaryRetry((current) => current + 1);
    },
    retryDraftSummary() {
      setDraftSummaryRetry((current) => current + 1);
    },
    rangeCoordinateLabel,
    mayAdjust(range) {
      return result ? rangeMayBeAdjusted(result, range) : false;
    },
  };

  return (
    <TrainingRangeInteractionContext.Provider value={value}>
      {children}
    </TrainingRangeInteractionContext.Provider>
  );
}

export function useTrainingRangeInteraction(): TrainingRangeInteraction {
  const interaction = useContext(TrainingRangeInteractionContext);
  if (!interaction) {
    throw new Error("Training range interaction requires its session provider");
  }
  return interaction;
}

export function useOptionalTrainingRangeInteraction(): TrainingRangeInteraction | undefined {
  return useContext(TrainingRangeInteractionContext);
}
