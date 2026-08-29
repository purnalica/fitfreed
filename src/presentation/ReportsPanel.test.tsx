import type { ComponentProps } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import { ReportsPanel } from "./ReportsPanel";
import type { PlannedTrainingTargetDetail } from "./planned-training";
import type {
  ReportDefinition,
  ReportExampleCatalog,
  ReportLibraryItem,
  ReportLibraryPage,
  ResolvedReport,
  ResolvedSessionReport,
  SessionReportOrigin,
} from "./session-report";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  reportExamples: vi.fn(),
  save: vi.fn(),
}));
const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (command: string, arguments_?: unknown) => command === "list_report_examples"
    ? mocks.reportExamples(command, arguments_)
    : mocks.invoke(command, arguments_),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: mocks.save }));

const digest = (character: string) => character.repeat(64);
const sessionRef = `session-${digest("1")}`;
const snapshotRef = `training-snapshot-${digest("2")}`;
const changedSnapshotRef = `training-snapshot-${digest("a")}`;
const reportRef = `report-${digest("3")}`;
const duplicateReportRef = `report-${digest("4")}`;
const routeRef = `route-${digest("7")}`;
const routeBlockRef = `report-block-${digest("8")}`;
const plannedSnapshotRef = `planned-snapshot-${digest("d")}`;
const plannedTargetRef = `planned-target-${digest("e")}`;
const comparisonQuery = {
  question: "training-period-comparison" as const,
  questionVersion: 1 as const,
  baselineRange: { from: "2026-01-01", through: "2026-01-31" },
  comparisonRange: { from: "2026-02-01", through: "2026-02-28" },
};

const origin: SessionReportOrigin = {
  kind: "session",
  snapshotRef,
  session: {
    sessionRef,
    sourceIndex: 1,
    startedAtLocal: "2026-08-16T08:30:00.000",
    stoppedAtLocal: "2026-08-16T09:35:00.000",
    utcOffsetMinutes: 120,
    durationMilliseconds: "3900000",
    distanceMeters: 10250.5,
    energyKilocalories: "642",
    averageHeartRateBpm: "148",
    maximumHeartRateBpm: "171",
    exerciseCount: 1,
    sport: {
      sportRef: `sport-${digest("4")}`,
      state: "personally-overridden",
      classification: {
        scope: "unresolved-source-profile" as const,
        canonicalFamily: "running",
        displayLabel: "Trail running",
        authorship: "user",
        revision: 1,
      },
      recognition: null,
      recognitionCandidateCount: 0,
    },
  },
};

function definition(revision = "1", title = "Ridge progression"): ReportDefinition {
  return {
    reportRef,
    title,
    locale: "en-US",
    sourceSnapshotRef: snapshotRef,
    origin: { kind: "session", sessionRef },
    provenancePolicy: "current-attribution",
    authorship: "user",
    definitionVersion: 2,
    revision,
    blocks: [
      {
        blockRef: `report-block-${digest("5")}`,
        kind: "session-evidence",
        sessionRef,
        includePhysiologicalContext: true,
      },
      {
        blockRef: `report-block-${digest("6")}`,
        kind: "narrative",
        body: revision === "1"
          ? "Held the intended effort on every climb."
          : "Held the intended effort and finished with control.",
      },
    ],
  };
}

function resolution(value = definition()): ResolvedSessionReport {
  return {
    definition: value,
    resolvedSnapshotRef: snapshotRef,
    status: "current",
    session: origin.session,
    provenance: {
      kind: "session",
      current: {
        provider: "polar-flow",
        sourceModifiedAtUtc: "2026-08-16T11:00:00Z",
        sourceAdapterVersion: "polar-flow-takeout-v1",
        mappingVersion: "polar-flow-to-canonical-v1",
        contributingEventCount: 1,
        nonContributingEventCount: 0,
      },
    },
    routes: [],
    trainingComparison: null,
    plannedTraining: null,
    sensitiveContents: [{
      kind: "heart-rate",
      blockRef: null,
      included: true,
      endpointRedactionMeters: null,
    }],
    limitations: [],
  };
}

function factualSessionDefinition(): ReportDefinition {
  return {
    ...definition(),
    definitionVersion: 4,
    title: "Recorded ridge evidence",
    blocks: definition().blocks.filter((block) => block.kind !== "narrative"),
  };
}

function factualSessionResolution(): ResolvedSessionReport {
  return resolution(factualSessionDefinition());
}

const recordedRoute = {
  routeRef,
  kind: "primary" as const,
  startedAtLocal: "2026-08-16T08:30:00.000",
  pointCount: 4,
  altitudePointCount: 4,
  elapsedPointCount: 4,
  projection: "source-ordinal-v1" as const,
  visualPoints: [
    {
      ordinal: 0,
      latitudeDegrees: 40.123456,
      longitudeDegrees: -3.654321,
      altitudeMeters: 650,
      elapsedMilliseconds: "0",
    },
    {
      ordinal: 3,
      latitudeDegrees: 40.126456,
      longitudeDegrees: -3.651321,
      altitudeMeters: 670,
      elapsedMilliseconds: "3600000",
    },
  ],
};

function routeQueryResult() {
  return {
    snapshotRef,
    sessionRef,
    routes: {
      exercises: [{
        exerciseRef: `exercise-${digest("9")}`,
        ordinal: 0,
        routes: { primary: recordedRoute, transition: null },
      }],
    },
  };
}

function routedDefinition(endpointRedactionMeters = 0): ReportDefinition {
  return {
    ...definition(),
    blocks: [
      {
        blockRef: routeBlockRef,
        kind: "route",
        sessionRef,
        routeRef,
        endpointRedactionMeters,
      },
      definition().blocks[1],
      definition().blocks[0],
    ],
  };
}

function routedResolution(value = routedDefinition()): ResolvedSessionReport {
  return {
    ...resolution(value),
    routes: [{
      blockRef: routeBlockRef,
      routeRef,
      kind: "primary",
      startedAtLocal: recordedRoute.startedAtLocal,
      sourcePointCount: recordedRoute.pointCount,
      visualPoints: recordedRoute.visualPoints,
      endpointRedactionMeters: (value.blocks[0]?.kind === "route"
        ? value.blocks[0].endpointRedactionMeters
        : 0),
      included: true,
    }],
    sensitiveContents: [
      ...resolution(value).sensitiveContents,
      {
        kind: "precise-location",
        blockRef: routeBlockRef,
        included: true,
        endpointRedactionMeters: 0,
      },
    ],
  };
}

function analyticalDefinition(): ReportDefinition {
  return {
    ...definition(),
    definitionVersion: 3,
    title: "Winter training comparison",
    blocks: [
      definition().blocks[0],
      definition().blocks[1],
      {
        blockRef: `report-block-${digest("a")}`,
        kind: "training-finding",
        query: comparisonQuery,
        metric: "energy",
      },
      {
        blockRef: `report-block-${digest("b")}`,
        kind: "training-comparison",
        query: comparisonQuery,
      },
      {
        blockRef: `report-block-${digest("c")}`,
        kind: "training-chart",
        query: comparisonQuery,
        metric: "distance",
      },
      {
        blockRef: `report-block-${digest("d")}`,
        kind: "training-exact-table",
        query: comparisonQuery,
      },
      {
        blockRef: `report-block-${digest("e")}`,
        kind: "training-coverage",
        query: comparisonQuery,
      },
    ],
  };
}

function analyticalResolution(): ResolvedSessionReport {
  return {
    ...resolution(analyticalDefinition()),
    trainingComparison: {
      availableRange: { from: "2026-01-01", through: "2026-02-28" },
      baselineRange: comparisonQuery.baselineRange,
      comparisonRange: comparisonQuery.comparisonRange,
      series: [{
        seriesRef: "opaque-origin-that-must-not-be-rendered",
        baseline: {
          calendarDays: 31,
          trainingDays: 4,
          sessionCount: 5,
          totalDurationMilliseconds: "18000000",
          distanceSessionCount: 4,
          totalDistanceMeters: 42000.25,
          energySessionCount: 5,
          totalEnergyKilocalories: "2500",
          heartRateSessionCount: 3,
        },
        comparison: {
          calendarDays: 28,
          trainingDays: 7,
          sessionCount: 8,
          totalDurationMilliseconds: "28800000",
          distanceSessionCount: 7,
          totalDistanceMeters: 68500.75,
          energySessionCount: 8,
          totalEnergyKilocalories: "4200",
          heartRateSessionCount: 6,
        },
        sessionCountChange: "3",
        trainingDayChange: "3",
        durationMillisecondsChange: "10800000",
        distanceMetersChange: 26500.5,
        energyKilocaloriesChange: "1700",
      }],
    },
  };
}

function questionDefinition(): ReportDefinition {
  return {
    ...analyticalDefinition(),
    definitionVersion: 4,
    title: "How has my recent training changed?",
    origin: {
      kind: "question",
      question: "training-period-comparison",
      questionVersion: 1,
    },
    blocks: [
      {
        blockRef: `report-block-${digest("a")}`,
        kind: "training-finding",
        query: comparisonQuery,
        metric: "session-count",
      },
      {
        blockRef: `report-block-${digest("c")}`,
        kind: "training-chart",
        query: comparisonQuery,
        metric: "duration",
      },
      {
        blockRef: `report-block-${digest("e")}`,
        kind: "training-coverage",
        query: comparisonQuery,
      },
      definition().blocks[1],
    ],
  };
}

function questionResolution(): ResolvedReport {
  return {
    ...analyticalResolution(),
    definition: questionDefinition(),
    session: null,
    routes: [],
    provenance: { kind: "library-snapshot" },
    sensitiveContents: [],
    limitations: [],
  };
}

function factualQuestionDefinition(revision = "1"): ReportDefinition {
  return {
    ...questionDefinition(),
    revision,
    blocks: questionDefinition().blocks.filter((block) => block.kind !== "narrative"),
  };
}

function factualQuestionResolution(revision = "1"): ResolvedReport {
  return {
    ...questionResolution(),
    definition: factualQuestionDefinition(revision),
  };
}

function blankDefinition(revision = "1", analytical = false): ReportDefinition {
  return {
    reportRef,
    title: "My training notes",
    locale: "en-US",
    sourceSnapshotRef: snapshotRef,
    origin: { kind: "blank" },
    provenancePolicy: "current-attribution",
    authorship: "user",
    definitionVersion: 4,
    revision,
    blocks: [
      {
        blockRef: `report-block-${digest("6")}`,
        kind: "narrative",
        body: "A note that starts with my own interpretation.",
      },
      ...(analytical
        ? [{
            blockRef: `report-block-${digest("a")}`,
            kind: "training-finding" as const,
            query: comparisonQuery,
            metric: "session-count" as const,
          }]
        : []),
    ],
  };
}

function blankResolution(revision = "1", analytical = false): ResolvedReport {
  return {
    definition: blankDefinition(revision, analytical),
    resolvedSnapshotRef: snapshotRef,
    status: "current",
    session: null,
    routes: [],
    trainingComparison: analytical ? analyticalResolution().trainingComparison : null,
    plannedTraining: null,
    provenance: analytical ? { kind: "library-snapshot" } : { kind: "authored-only" },
    sensitiveContents: [],
    limitations: [],
  };
}

const plannedTarget: PlannedTrainingTargetDetail = {
  snapshotRef: plannedSnapshotRef,
  target: {
    summary: {
      targetRef: plannedTargetRef,
      sourceIndex: 1,
      reconciliationState: "current",
      targetKind: {
        kind: "scheduled",
        scheduledAtLocal: "2026-08-18T07:30:00",
        completion: "completed",
      },
      name: "River intervals",
      description: "Four controlled work intervals with recovery.",
      editability: "editable",
      mappingCoverage: { state: "complete", unmappedFieldCount: 0 },
      shape: {
        exerciseCount: 1,
        phaseCount: 2,
        expandedPhaseCount: 8,
        repeatBlockCount: 1,
        containsIntensityEvidence: true,
      },
      relation: { state: "exact", sessionRef, candidateCount: null },
    },
    exercises: [{
      exerciseRef: `planned-exercise-${digest("1")}`,
      ordinal: 0,
      kind: "phased",
      durationGoalMilliseconds: "1680000",
      distanceGoalMeters: null,
      sport: { state: "unmapped", recognition: null },
      phases: [{
        phaseRef: `planned-phase-${digest("2")}`,
        ordinal: 0,
        name: "Work",
        goal: { kind: "duration", durationMilliseconds: "300000", distanceMeters: null },
        intensity: {
          kind: "zone-range",
          metric: "heart-rate",
          lowerZone: 3,
          upperZone: 4,
        },
        transition: {
          transitionRef: `planned-transition-${digest("3")}`,
          change: "automatic",
          repeat: null,
        },
      }],
    }],
  },
};

function plannedDefinition(revision = "1"): ReportDefinition {
  return {
    reportRef,
    title: "Training plan · River intervals",
    locale: "en-US",
    sourceSnapshotRef: plannedSnapshotRef,
    origin: { kind: "planned-training", targetRef: plannedTargetRef },
    provenancePolicy: "current-attribution",
    authorship: "user",
    definitionVersion: 5,
    revision,
    blocks: [{
      blockRef: `report-block-${digest("4")}`,
      kind: "planned-training",
      targetRef: plannedTargetRef,
    }],
  };
}

function plannedResolution(value = plannedDefinition()): ResolvedReport {
  return {
    definition: value,
    resolvedSnapshotRef: plannedSnapshotRef,
    status: "current",
    session: null,
    routes: [],
    trainingComparison: null,
    plannedTraining: {
      blockRef: `report-block-${digest("4")}`,
      target: plannedTarget,
    },
    provenance: { kind: "planned-training-snapshot" },
    sensitiveContents: [],
    limitations: [],
  };
}

function sessionLibraryItem(overrides: Partial<ReportLibraryItem> = {}): ReportLibraryItem {
  return {
    reportRef,
    title: "Ridge progression",
    locale: "en-US",
    sourceSnapshotRef: snapshotRef,
    revision: "1",
    evidenceState: "current",
    subject: { kind: "session", sport: origin.session.sport },
    period: {
      kind: "session",
      startedAtLocal: origin.session.startedAtLocal,
    },
    result: {
      kind: "session",
      metric: "distance",
      value: { kind: "decimal", value: 10250.5 },
    },
    sensitivity: {
      includesPhysiologicalContext: true,
      preciseLocationBlockCount: 1,
      minimumEndpointRedactionMeters: 200,
    },
    ...overrides,
  };
}

function reportLibraryPage(
  items: ReportLibraryItem[],
  nextOffset: number | null = null,
): ReportLibraryPage {
  return {
    items,
    totalCount: nextOffset === null ? items.length : items.length + 1,
    offset: 0,
    limit: 12,
    nextOffset,
  };
}

function libraryItemFromDefinition(value: ReportDefinition): ReportLibraryItem {
  if (value.origin.kind === "session") {
    return sessionLibraryItem({
      reportRef: value.reportRef,
      title: value.title,
      locale: value.locale,
      sourceSnapshotRef: value.sourceSnapshotRef,
      revision: value.revision,
    });
  }
  const analytical = value.blocks.find(isAnalyticalTestBlock);
  if (analytical) {
    return sessionLibraryItem({
      reportRef: value.reportRef,
      title: value.title,
      locale: value.locale,
      sourceSnapshotRef: value.sourceSnapshotRef,
      revision: value.revision,
      subject: { kind: "training-comparison" },
      period: {
        kind: "training-comparison",
        baselineRange: analytical.query.baselineRange,
        comparisonRange: analytical.query.comparisonRange,
      },
      result: {
        kind: "training-comparison",
        metric: "session-count",
        series: [{
          sourceIndex: 1,
          baselineValue: { kind: "integer", value: "5" },
          comparisonValue: { kind: "integer", value: "8" },
          change: { kind: "integer", value: "3" },
        }],
        omittedSourceCount: 0,
      },
      sensitivity: {
        includesPhysiologicalContext: false,
        preciseLocationBlockCount: 0,
        minimumEndpointRedactionMeters: null,
      },
    });
  }
  return sessionLibraryItem({
    reportRef: value.reportRef,
    title: value.title,
    locale: value.locale,
    sourceSnapshotRef: value.sourceSnapshotRef,
    revision: value.revision,
    evidenceState: "authored-only",
    subject: { kind: "authored-note" },
    period: null,
    result: null,
    sensitivity: {
      includesPhysiologicalContext: false,
      preciseLocationBlockCount: 0,
      minimumEndpointRedactionMeters: null,
    },
  });
}

function isAnalyticalTestBlock(
  block: ReportDefinition["blocks"][number],
): block is Extract<ReportDefinition["blocks"][number], { query: unknown }> {
  return "query" in block;
}

function reportExampleCatalog(): ReportExampleCatalog {
  return {
    examples: [
      {
        id: "adjacent-period-volume",
        version: 1,
        purpose: "compare-training-volume",
        question: "how-has-training-changed",
        requiredCapabilities: ["training-history"],
        parameter: "none",
        blockRecipe: [
          "training-finding-session-count",
          "training-chart-duration",
          "training-coverage",
        ],
        availability: { kind: "ready" },
      },
      {
        id: "session-visual-story",
        version: 1,
        purpose: "understand-one-session",
        question: "what-happened-in-this-session",
        requiredCapabilities: ["training-session"],
        parameter: "training-session",
        blockRecipe: ["session-evidence"],
        availability: {
          kind: "selection-required",
          destination: "training-sessions",
        },
      },
      {
        id: "outdoor-route",
        version: 1,
        purpose: "investigate-outdoor-route",
        question: "where-did-this-session-change",
        requiredCapabilities: ["training-session", "route-evidence"],
        parameter: "routed-training-session",
        blockRecipe: ["session-evidence", "route"],
        availability: {
          kind: "unavailable",
          missingCapabilities: ["route-evidence"],
        },
      },
      {
        id: "structured-training-plan",
        version: 1,
        purpose: "review-structured-training",
        question: "how-was-this-training-structured",
        requiredCapabilities: ["structured-training"],
        parameter: "planned-training-target",
        blockRecipe: ["planned-training"],
        availability: {
          kind: "selection-required",
          destination: "planned-training",
        },
      },
    ],
  };
}

function reportSubjectPage(hasRouteEvidence = false) {
  return {
    exampleId: hasRouteEvidence ? "outdoor-route" : "session-visual-story",
    exampleVersion: 1,
    snapshotRef,
    totalCount: 1,
    offset: 0,
    limit: 12,
    nextOffset: null,
    subjects: [{ session: origin.session, hasRouteEvidence }],
  };
}

function secondReportSubject() {
  return {
    session: {
      ...origin.session,
      sessionRef: `session-${digest("f")}`,
      sourceIndex: 2,
      startedAtLocal: "2026-08-15T17:15:00.000",
      stoppedAtLocal: "2026-08-15T18:00:00.000",
      durationMilliseconds: "2700000",
      sport: {
        ...origin.session.sport,
        sportRef: `sport-${digest("e")}`,
        classification: {
          ...origin.session.sport.classification!,
          canonicalFamily: "cycling" as const,
          displayLabel: "Road cycling",
        },
      },
    },
    hasRouteEvidence: false,
  };
}

function renderPanel(properties: Partial<ComponentProps<typeof ReportsPanel>> = {}) {
  const onReturnToOrigin = vi.fn();
  const onOpenExampleDestination = properties.onOpenExampleDestination ?? vi.fn();
  render(
    <ReportsPanel
      locale="en-US"
      messages={catalogs["en-US"]}
      origin={origin}
      originRequestId={1}
      disabled={false}
      {...properties}
      onReturnToOrigin={properties.onReturnToOrigin ?? onReturnToOrigin}
      onOpenExampleDestination={onOpenExampleDestination}
    />,
  );
  return { onReturnToOrigin, onOpenExampleDestination };
}

beforeEach(() => {
  mocks.invoke.mockReset();
  mocks.reportExamples.mockReset();
  mocks.reportExamples.mockResolvedValue(reportExampleCatalog());
  mocks.save.mockReset();
});

afterEach(() => {
  cleanup();
  if (originalScrollIntoViewDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      originalScrollIntoViewDescriptor,
    );
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  }
});

describe("ReportsPanel", () => {
  it("presents reusable structures honestly and routes parameterized examples to exact evidence", async () => {
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([]));
      if (command === "query_report_example_training_session_subjects") {
        return Promise.resolve(reportSubjectPage());
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    const callbacks = renderPanel({ origin: undefined, originRequestId: 0 });

    expect(await screen.findByRole("heading", { name: "Start from a useful question" }))
      .toBeVisible();
    expect(screen.getByRole("heading", { name: "Recent training, side by side" }))
      .toBeVisible();
    expect(screen.getByRole("heading", { name: "One session, clearly explained" }))
      .toBeVisible();
    const routeCard = screen.getByRole("heading", {
      name: "Investigate an outdoor route",
    }).closest("article")!;
    expect(within(routeCard).getByText("Needs: a recorded route with enough points."))
      .toBeVisible();
    expect(within(routeCard).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Understand a training plan" }))
      .toBeVisible();
    expect(screen.queryByText("Polar Flow")).not.toBeInTheDocument();

    const chooseSession = screen.getByRole("button", { name: "Choose a session" });
    await user.click(chooseSession);
    expect(await screen.findByRole("heading", { name: "Choose the session for this report" }))
      .toBeVisible();
    expect(screen.getByRole("heading", { name: "Trail running" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Use this session" })).toBeVisible();
    expect(callbacks.onOpenExampleDestination).not.toHaveBeenCalledWith("training-sessions");
    expect(mocks.invoke).toHaveBeenCalledWith(
      "query_report_example_training_session_subjects",
      {
        query: {
          exampleId: "session-visual-story",
          exampleVersion: 1,
          offset: 0,
          limit: 12,
          snapshotRef: null,
        },
      },
    );
    await user.click(screen.getByRole("button", { name: "Back to report examples" }));
    await waitFor(() => expect(chooseSession).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Choose a training plan" }));
    expect(callbacks.onOpenExampleDestination).toHaveBeenLastCalledWith("planned-training");
    expect(mocks.invoke).not.toHaveBeenCalledWith("prepare_report_start", expect.anything());
    expect(mocks.invoke).not.toHaveBeenCalledWith("create_report", expect.anything());
  });

  it("pages eligible sessions against one coherent report-subject snapshot", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([]));
      if (command === "query_report_example_training_session_subjects") {
        const query = arguments_.query;
        if (query.offset === 0) {
          return Promise.resolve({
            ...reportSubjectPage(),
            totalCount: 2,
            nextOffset: 1,
          });
        }
        return Promise.resolve({
          ...reportSubjectPage(),
          totalCount: 2,
          offset: 1,
          nextOffset: null,
          subjects: [secondReportSubject()],
        });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    renderPanel({ origin: undefined, originRequestId: 0 });

    await user.click(await screen.findByRole("button", { name: "Choose a session" }));
    expect(await screen.findByRole("heading", { name: "Trail running" })).toBeVisible();
    expect(screen.getByText("Showing 1 of 2 eligible sessions")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Show more sessions" }));

    expect(await screen.findByRole("heading", { name: "Road cycling" })).toBeVisible();
    expect(screen.getByText("Showing 2 of 2 eligible sessions")).toBeVisible();
    expect(mocks.invoke).toHaveBeenCalledWith(
      "query_report_example_training_session_subjects",
      {
        query: {
          exampleId: "session-visual-story",
          exampleVersion: 1,
          offset: 1,
          limit: 12,
          snapshotRef,
        },
      },
    );
  });

  it("recovers a failed report-subject query without leaving Reports", async () => {
    let subjectAttempt = 0;
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([]));
      if (command === "query_report_example_training_session_subjects") {
        subjectAttempt += 1;
        return subjectAttempt === 1
          ? Promise.reject({ code: "report-definition-query-failed" })
          : Promise.resolve(reportSubjectPage());
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    renderPanel({ origin: undefined, originRequestId: 0 });

    await user.click(await screen.findByRole("button", { name: "Choose a session" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "FitFreed could not load the eligible sessions.",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Trail running" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Use this session" })).toBeVisible();
    expect(subjectAttempt).toBe(2);
  });

  it("does not restore a cancelled subject picker when its request completes later", async () => {
    let resolveSubjects!: (page: ReturnType<typeof reportSubjectPage>) => void;
    const pendingSubjects = new Promise<ReturnType<typeof reportSubjectPage>>((resolve) => {
      resolveSubjects = resolve;
    });
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([]));
      if (command === "query_report_example_training_session_subjects") return pendingSubjects;
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    renderPanel({ origin: undefined, originRequestId: 0 });

    const chooseSession = await screen.findByRole("button", { name: "Choose a session" });
    await user.click(chooseSession);
    expect(await screen.findByText("Loading eligible sessions…")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back to report examples" }));
    resolveSubjects(reportSubjectPage());

    await waitFor(() => expect(chooseSession).toHaveFocus());
    expect(screen.queryByRole("heading", { name: "Choose the session for this report" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Start from a useful question" })).toBeVisible();
  });

  it("explains a stale subject page and restarts from a fresh snapshot", async () => {
    let subjectAttempt = 0;
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([]));
      if (command === "query_report_example_training_session_subjects") {
        subjectAttempt += 1;
        if (subjectAttempt === 1) {
          return Promise.resolve({
            ...reportSubjectPage(),
            totalCount: 2,
            nextOffset: 1,
          });
        }
        if (subjectAttempt === 2) return Promise.reject({ code: "report-source-changed" });
        return Promise.resolve(reportSubjectPage());
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    renderPanel({ origin: undefined, originRequestId: 0 });

    await user.click(await screen.findByRole("button", { name: "Choose a session" }));
    await user.click(await screen.findByRole("button", { name: "Show more sessions" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The training library changed while these sessions were being reviewed.",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Trail running" })).toBeVisible();
    expect(subjectAttempt).toBe(3);
    expect(mocks.invoke).toHaveBeenLastCalledWith(
      "query_report_example_training_session_subjects",
      expect.objectContaining({ query: expect.objectContaining({ snapshotRef: null }) }),
    );
  });

  it("recovers a failed example-catalog check without losing the saved-report library", async () => {
    mocks.reportExamples
      .mockRejectedValueOnce({ code: "report-definition-query-failed" })
      .mockResolvedValueOnce(reportExampleCatalog());
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") {
        return Promise.resolve(reportLibraryPage([sessionLibraryItem()]));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    renderPanel({ origin: undefined, originRequestId: 0 });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "FitFreed could not check the report examples in this library.",
    );
    expect(screen.getByRole("button", { name: "Open Ridge progression" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Check examples again" }));
    expect(await screen.findByRole("heading", { name: "Recent training, side by side" }))
      .toBeVisible();
    expect(mocks.reportExamples).toHaveBeenCalledTimes(2);
  });

  it("keeps the initiating route recipe when the user explicitly chooses a session", async () => {
    const catalog = reportExampleCatalog();
    catalog.examples[2].availability = {
      kind: "selection-required",
      destination: "training-sessions",
    };
    mocks.reportExamples.mockResolvedValue(catalog);
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([]));
      if (command === "query_report_example_training_session_subjects") {
        return Promise.resolve(reportSubjectPage(true));
      }
      if (command === "query_training_session_routes") return Promise.resolve(routeQueryResult());
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    const callbacks = renderPanel({ origin: undefined, originRequestId: 0 });

    await user.click(await screen.findByRole("button", {
      name: "Choose a session with a route",
    }));
    expect(await screen.findByText("Recorded route available")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Use this session" }));

    expect(await screen.findByRole("heading", { name: "Compose report" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Report title" }))
      .toHaveValue("Outdoor route investigation");
    expect(screen.getByText("Session summary")).toBeVisible();
    expect(screen.getByText(/Primary route/)).toBeVisible();
    expect(callbacks.onOpenExampleDestination).not.toHaveBeenCalledWith("training-sessions");
  });

  it("returns a library example to Reports instead of reusing an older contextual origin", async () => {
    const olderOrigin: SessionReportOrigin = {
      ...origin,
      session: {
        ...origin.session,
        averageHeartRateBpm: null,
        maximumHeartRateBpm: null,
      },
    };
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([]));
      if (command === "query_report_example_training_session_subjects") {
        return Promise.resolve(reportSubjectPage());
      }
      if (command === "query_training_session_routes") return Promise.resolve(routeQueryResult());
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    const callbacks = renderPanel({ origin: olderOrigin, originRequestId: 7 });

    expect(await screen.findByLabelText("Report title")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.click(await screen.findByRole("button", { name: "Choose a session" }));
    expect(screen.queryByRole("button", { name: "Back to the session" }))
      .not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Use this session" }));

    const physiology = await screen.findByRole("checkbox", {
      name: /Include recorded heart-rate summary/,
    });
    expect(physiology).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Back to the session" }))
      .not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel composition" }));

    const libraryHeading = screen.getByRole("heading", { name: "Saved reports" });
    await waitFor(() => expect(libraryHeading).toHaveFocus());
    expect(callbacks.onReturnToOrigin).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Start from a useful question" })).toBeVisible();
  });

  it("keeps a route report unsaved when route evidence disappears after selection", async () => {
    const catalog = reportExampleCatalog();
    catalog.examples[2].availability = {
      kind: "selection-required",
      destination: "training-sessions",
    };
    mocks.reportExamples.mockResolvedValue(catalog);
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([]));
      if (command === "query_report_example_training_session_subjects") {
        return Promise.resolve(reportSubjectPage(true));
      }
      if (command === "query_training_session_routes") {
        return Promise.resolve({
          snapshotRef,
          sessionRef,
          routes: { exercises: [] },
        });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    renderPanel({ origin: undefined, originRequestId: 0 });

    await user.click(await screen.findByRole("button", {
      name: "Choose a session with a route",
    }));
    await user.click(await screen.findByRole("button", { name: "Use this session" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The evidence needed by this report is not available in the local library.",
    );
    expect(screen.getByRole("heading", { name: "Choose the session for this report" }))
      .toBeVisible();
    expect(mocks.invoke).not.toHaveBeenCalledWith("create_report", expect.anything());
  });

  it("localizes report examples independently from their provider-neutral descriptors", async () => {
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([]));
      throw new Error(`Unexpected command: ${command}`);
    });

    renderPanel({
      locale: "es-ES",
      messages: catalogs["es-ES"],
      origin: undefined,
      originRequestId: 0,
    });

    expect(await screen.findByRole("heading", { name: "Empieza por una pregunta útil" }))
      .toBeVisible();
    const routeCard = screen.getByRole("heading", {
      name: "Investiga una ruta al aire libre",
    }).closest("article")!;
    expect(within(routeCard).getByText(
      "Necesita: una ruta registrada con suficientes puntos.",
    )).toBeVisible();
    expect(screen.queryByText("Polar Flow")).not.toBeInTheDocument();
  });

  it("creates a result-first report from one exact planned-training snapshot", async () => {
    const created = plannedDefinition();
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([]));
      if (command === "create_report") return Promise.resolve(created);
      if (command === "resolve_report") return Promise.resolve(plannedResolution(created));
      if (command === "export_report") return Promise.resolve({ byteCount: "3072" });
      throw new Error(`Unexpected command: ${command} ${JSON.stringify(arguments_)}`);
    });
    mocks.save.mockResolvedValue("/tmp/river-intervals.html");
    const user = userEvent.setup();

    renderPanel({
      origin: {
        kind: "planned-training",
        snapshotRef: plannedSnapshotRef,
        target: plannedTarget,
      },
      originRequestId: 9,
    });

    expect(screen.getByDisplayValue("Training plan · River intervals")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Imported training plan" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save report" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("create_report", {
      request: {
        title: "Training plan · River intervals",
        locale: "en-US",
        sourceSnapshotRef: plannedSnapshotRef,
        origin: { kind: "planned-training", targetRef: plannedTargetRef },
        blocks: [{ kind: "planned-training", targetRef: plannedTargetRef }],
      },
    }));
    expect(await screen.findByRole("heading", { name: "River intervals" })).toBeVisible();
    expect(within(screen.getByRole("heading", { name: "Plan sequence" }).parentElement!)
      .getByText("Work")).toBeVisible();
    expect(screen.getByText("This is imported intent. Recorded measurements remain separate."))
      .toBeVisible();

    await user.click(screen.getByRole("button", { name: "Review and export" }));
    expect(screen.getByText(/Imported objectives, exercises, phases/)).toBeVisible();
    expect(screen.queryByText(/Exact training samples are excluded/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Selected routes use only/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Choose destination and export" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("export_report", {
      request: {
        reportRef,
        expectedRevision: "1",
        expectedSourceSnapshotRef: plannedSnapshotRef,
        includePhysiologicalContext: false,
        routeChoices: [],
        destinationPath: "/tmp/river-intervals.html",
      },
    }));
  });

  it("presents planned-training reports as useful library results", async () => {
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") {
        return Promise.resolve(reportLibraryPage([sessionLibraryItem({
          title: "Training plan · River intervals",
          sourceSnapshotRef: plannedSnapshotRef,
          subject: { kind: "planned-training", name: "River intervals" },
          period: {
            kind: "planned-training",
            scheduledAtLocal: "2026-08-18T07:30:00",
          },
          result: {
            kind: "planned-training",
            exerciseCount: 1,
            phaseCount: 2,
            expandedPhaseCount: 8,
            repeatBlockCount: 1,
          },
          sensitivity: {
            includesPhysiologicalContext: false,
            preciseLocationBlockCount: 0,
            minimumEndpointRedactionMeters: null,
          },
        })]));
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    renderPanel({ origin: undefined, originRequestId: 0 });

    const card = await screen.findByRole("button", {
      name: "Open Training plan · River intervals",
    });
    expect(within(card).getByText("River intervals")).toBeVisible();
    expect(within(card).getByText("Aug 18, 2026, 7:30 AM")).toBeVisible();
    expect(within(card).getByText(
      "1 exercise · 2 phases · 8 planned passes · 1 repeat block",
    )).toBeVisible();
    expect(card).not.toHaveTextContent("planned-target-");
  });

  it("uses localized provider recognition in the report library", async () => {
    const recognizedSport = {
      sportRef: `sport-${digest("9")}`,
      state: "recognized" as const,
      classification: {
        scope: "unresolved-source-profile" as const,
        canonicalFamily: null,
        displayLabel: null,
        authorship: null,
        revision: 0,
      },
      recognition: {
        canonicalFamily: "water-sport" as const,
        localizedNames: { en: "Kayaking", "es-ES": "Piragüismo" },
        catalogueRevision: "catalogue-2026-08-01",
        retrievedAtUtc: "2026-08-01T10:00:00Z",
        mappingVersion: "polar-flow-sports-v1",
        evidenceRef: `sport-evidence-${digest("a")}`,
      },
      recognitionCandidateCount: 1,
    };
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") {
        return Promise.resolve(reportLibraryPage([
          sessionLibraryItem({ subject: { kind: "session", sport: recognizedSport } }),
        ]));
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    renderPanel({
      locale: "es-ES",
      messages: catalogs["es-ES"],
      origin: undefined,
      originRequestId: 0,
    });

    const reportCard = await screen.findByRole("button", { name: /Abrir Ridge progression/ });
    expect(within(reportCard).getByText("Piragüismo")).toBeVisible();
    expect(within(reportCard).getByTestId("sport-family-icon"))
      .toHaveAttribute("data-sport-icon", "water-sport");
  });

  it("opens factual result cards without exposing technical report metadata", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "list_report_library") {
        expect(arguments_).toEqual({ request: { offset: 0, limit: 12 } });
        return Promise.resolve(reportLibraryPage([sessionLibraryItem()]));
      }
      if (command === "resolve_report") return Promise.resolve(resolution());
      if (command === "query_training_session_routes") {
        return Promise.resolve(routeQueryResult());
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    renderPanel({ origin: undefined, originRequestId: 0 });

    const reportCard = await screen.findByRole("button", { name: /Open Ridge progression/ });
    expect(within(reportCard).getByText("Trail running")).toBeVisible();
    expect(within(reportCard).getByText("Aug 16, 2026")).toBeVisible();
    expect(within(reportCard).getByText("10.25 km")).toBeVisible();
    expect(within(reportCard).getByText("Current evidence")).toBeVisible();
    expect(within(reportCard).getByText("Heart rate included")).toBeVisible();
    expect(within(reportCard).getByText("Recorded route · 200 m endpoint privacy")).toBeVisible();
    expect(reportCard).not.toHaveTextContent("training-snapshot-");
    expect(reportCard).not.toHaveTextContent("revision 1");
    expect(screen.queryByRole("button", { name: "Start a blank report" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use as basis" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Start from a useful question" }))
      .toBeVisible();
    expect(document.querySelector(".report-library-start")).not.toBeInTheDocument();

    await user.click(reportCard);
    const title = await screen.findByRole("heading", { name: "Ridge progression", level: 3 });
    expect(title).toBeVisible();
    const primaryEvidence = screen.getByRole("heading", { name: "Session summary" });
    const edit = screen.getByRole("button", { name: "Edit composition" });
    expect(title.compareDocumentPosition(primaryEvidence) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(primaryEvidence.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(document.querySelector("form.report-editor")).not.toBeVisible();
  });

  it("keeps comparison sources separate and pages every evidence state", async () => {
    const comparisonItem = sessionLibraryItem({
      reportRef: `report-${digest("a")}`,
      title: "Winter volume",
      subject: { kind: "training-comparison" },
      period: {
        kind: "training-comparison",
        baselineRange: comparisonQuery.baselineRange,
        comparisonRange: comparisonQuery.comparisonRange,
      },
      result: {
        kind: "training-comparison",
        metric: "duration",
        series: [
          {
            sourceIndex: 1,
            baselineValue: { kind: "integer", value: "18000000" },
            comparisonValue: { kind: "integer", value: "28800000" },
            change: { kind: "integer", value: "10800000" },
          },
          {
            sourceIndex: 2,
            baselineValue: { kind: "integer", value: "3600000" },
            comparisonValue: null,
            change: null,
          },
        ],
        omittedSourceCount: 1,
      },
      sensitivity: {
        includesPhysiologicalContext: false,
        preciseLocationBlockCount: 0,
        minimumEndpointRedactionMeters: null,
      },
    });
    const staleItem = sessionLibraryItem({
      reportRef: `report-${digest("b")}`,
      title: "Earlier session",
      evidenceState: "stale",
    });
    const unavailableItem = sessionLibraryItem({
      reportRef: `report-${digest("c")}`,
      title: "Missing session",
      evidenceState: "unavailable",
      result: null,
    });
    const authoredItem = libraryItemFromDefinition({
      ...blankDefinition(),
      reportRef: `report-${digest("d")}`,
      title: "Coach notes",
    });
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command !== "list_report_library") throw new Error(`Unexpected command: ${command}`);
      if (arguments_.request.offset === 0) {
        return Promise.resolve({
          items: [comparisonItem, staleItem, unavailableItem],
          totalCount: 4,
          offset: 0,
          limit: 12,
          nextOffset: 3,
        });
      }
      expect(arguments_).toEqual({ request: { offset: 3, limit: 12 } });
      return Promise.resolve({
        items: [authoredItem],
        totalCount: 4,
        offset: 3,
        limit: 12,
        nextOffset: null,
      });
    });
    const user = userEvent.setup();

    renderPanel({ origin: undefined, originRequestId: 0 });

    const comparisonCard = await screen.findByRole("button", { name: "Open Winter volume" });
    expect(within(comparisonCard).getByText("Imported source 1")).toBeVisible();
    expect(within(comparisonCard).getByText("Imported source 2")).toBeVisible();
    expect(within(comparisonCard).getByText("5 h → 8 h · change 3 h")).toBeVisible();
    expect(within(comparisonCard).getByText(/1 additional source is/)).toBeVisible();
    expect(within(comparisonCard).getByText(/Jan 1, 2026/)).toBeVisible();
    expect(screen.getByText("Source changed")).toBeVisible();
    expect(screen.getByText("Evidence unavailable")).toBeVisible();
    expect(screen.getByText("Showing 3 of 4")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Show more reports" }));

    expect(await screen.findByRole("button", { name: "Open Coach notes" })).toBeVisible();
    expect(screen.getByText("Authored only")).toBeVisible();
    expect(screen.getByText("Showing 4 of 4")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Show more reports" })).not.toBeInTheDocument();
  });

  it("requires confirmation before removing the exact report and returns focus to the library", async () => {
    let removed = false;
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "list_report_library") {
        return Promise.resolve(reportLibraryPage(removed ? [] : [sessionLibraryItem()]));
      }
      if (command === "resolve_report") return Promise.resolve(resolution());
      if (command === "query_training_session_routes") {
        return Promise.resolve(routeQueryResult());
      }
      if (command === "remove_report") {
        expect(arguments_).toEqual({
          request: { reportRef, expectedRevision: "1" },
        });
        removed = true;
        return Promise.resolve({ reportRef, title: "Ridge progression", revision: "1" });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    renderPanel({ origin: undefined, originRequestId: 0 });
    await user.click(await screen.findByRole("button", { name: /Open Ridge progression/ }));
    const removeAction = await screen.findByRole("button", { name: "Remove report" });

    await user.click(removeAction);
    const review = screen.getByRole("dialog", { name: "Remove Ridge progression?" });
    expect(within(review).getByText(/imported history and other reports stay unchanged/i))
      .toBeVisible();
    await user.click(within(review).getByRole("button", { name: "Keep report" }));
    expect(mocks.invoke).not.toHaveBeenCalledWith("remove_report", expect.anything());
    expect(removeAction).toHaveFocus();

    await user.click(removeAction);
    await user.click(within(screen.getByRole("dialog", { name: "Remove Ridge progression?" }))
      .getByRole("button", { name: "Remove Ridge progression" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Ridge progression was removed. Imported history was not changed.",
    );
    expect(screen.queryByRole("button", { name: /Open Ridge progression/ }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Saved reports" })).toHaveFocus();
  });

  it("duplicates a library report under an editable title and opens the independent result", async () => {
    let duplicated = false;
    const duplicateDefinition: ReportDefinition = {
      ...definition(),
      reportRef: duplicateReportRef,
      title: "My independent copy",
      definitionVersion: 5,
      blocks: definition().blocks.map((block, index) => ({
        ...block,
        blockRef: `report-block-${digest(index === 0 ? "d" : "e")}`,
      })),
    };
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "list_report_library") {
        return Promise.resolve(reportLibraryPage([
          sessionLibraryItem(),
          ...(duplicated ? [sessionLibraryItem({
            reportRef: duplicateReportRef,
            title: duplicateDefinition.title,
          })] : []),
        ]));
      }
      if (command === "duplicate_report") {
        expect(arguments_).toEqual({
          request: {
            sourceReportRef: reportRef,
            expectedSourceRevision: "1",
            title: "My independent copy",
          },
        });
        duplicated = true;
        return Promise.resolve(duplicateDefinition);
      }
      if (command === "resolve_report") {
        expect(arguments_).toEqual({ reportRef: duplicateReportRef });
        return Promise.resolve(resolution(duplicateDefinition));
      }
      if (command === "query_training_session_routes") {
        return Promise.resolve(routeQueryResult());
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    renderPanel({ origin: undefined, originRequestId: 0 });
    await user.click(await screen.findByRole("button", { name: "Duplicate Ridge progression" }));
    const duplicateTitle = screen.getByLabelText("Duplicate title");
    expect(duplicateTitle).toHaveValue("Ridge progression copy");
    await user.clear(duplicateTitle);
    await user.type(duplicateTitle, "My independent copy");
    await user.click(screen.getByRole("button", { name: "Create duplicate" }));

    expect(await screen.findByRole("heading", {
      name: "My independent copy",
      level: 3,
    })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "My independent copy was created as an independent report.",
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "Report preview" }))
      .toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Library" }));
    expect(screen.getByRole("button", { name: "Open Ridge progression" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Open My independent copy" })).toBeVisible();
  });

  it("offers duplication from a saved result and restores focus when the title task is cancelled", async () => {
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") {
        return Promise.resolve(reportLibraryPage([sessionLibraryItem()]));
      }
      if (command === "resolve_report") return Promise.resolve(resolution());
      if (command === "query_training_session_routes") {
        return Promise.resolve(routeQueryResult());
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    renderPanel({ origin: undefined, originRequestId: 0 });
    await user.click(await screen.findByRole("button", { name: "Open Ridge progression" }));
    const duplicateAction = await screen.findByRole("button", { name: "Duplicate report" });
    duplicateAction.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("dialog", { name: "Duplicate Ridge progression" })).toBeVisible();
    const cancel = screen.getByRole("button", { name: "Cancel duplication" });
    cancel.focus();
    await user.keyboard("{Enter}");

    expect(screen.queryByRole("dialog", { name: "Duplicate Ridge progression" }))
      .not.toBeInTheDocument();
    expect(duplicateAction).toHaveFocus();
    expect(mocks.invoke).not.toHaveBeenCalledWith("duplicate_report", expect.anything());
  });

  it("keeps a concurrently changed report and reloads it after removal conflicts", async () => {
    let revision = "1";
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") {
        return Promise.resolve(reportLibraryPage([
          sessionLibraryItem({ revision }),
        ]));
      }
      if (command === "resolve_report") return Promise.resolve(resolution(definition(revision)));
      if (command === "query_training_session_routes") {
        return Promise.resolve(routeQueryResult());
      }
      if (command === "remove_report") {
        revision = "2";
        return Promise.reject({ code: "report-definition-conflict" });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    renderPanel({ origin: undefined, originRequestId: 0 });
    await user.click(await screen.findByRole("button", { name: "Open Ridge progression" }));
    await user.click(await screen.findByRole("button", { name: "Remove report" }));
    await user.click(screen.getByRole("button", { name: "Remove Ridge progression" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This report changed while it was open",
    );
    expect(screen.getByRole("heading", { name: "Ridge progression", level: 3 })).toBeVisible();
    expect(screen.getByText("Definition revision").nextElementSibling).toHaveTextContent("2");
    expect(screen.queryByText(/was removed/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove report" })).toHaveFocus();
  });

  it("separates the report library, composition, and preview without discarding a draft", async () => {
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([]));
      if (command === "prepare_report_start") return Promise.resolve({
        sourceSnapshotRef: snapshotRef,
        origin: {
          kind: "question",
          question: "training-period-comparison",
          questionVersion: 1,
        },
        suggestedQuery: comparisonQuery,
      });
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    renderPanel({ origin: undefined, originRequestId: 0 });
    const navigation = screen.getByRole("navigation", { name: "Report workspace" });
    expect(within(navigation).getByRole("button", { name: "Library" }))
      .toHaveAttribute("aria-current", "page");
    expect(within(navigation).getByRole("button", { name: "Compose" })).toBeDisabled();
    expect(within(navigation).getByRole("button", { name: "Preview" })).toBeDisabled();
    expect(await screen.findByRole("heading", { name: "Start from a useful question" }))
      .toBeVisible();
    expect(screen.getByRole("button", { name: "Use as basis" })).toBeVisible();

    await user.click(await screen.findByRole("button", { name: "Use as basis" }));
    expect(within(navigation).getByRole("button", { name: "Compose" }))
      .toHaveAttribute("aria-current", "page");
    await user.clear(screen.getByLabelText("Report title"));
    await user.type(screen.getByLabelText("Report title"), "A preserved draft");
    await user.click(screen.getByRole("button", { name: "Add commentary" }));
    await user.type(
      screen.getByLabelText(/^Your commentary/),
      "This remains local while the workspace changes.",
    );

    await user.click(within(navigation).getByRole("button", { name: "Library" }));
    expect(screen.getByRole("heading", { name: "Saved reports" })).toBeVisible();
    expect(document.querySelector("form.report-editor")).not.toBeVisible();

    await user.click(within(navigation).getByRole("button", { name: "Compose" }));
    expect(screen.getByLabelText("Report title")).toHaveValue("A preserved draft");
    expect(screen.getByLabelText(/^Your commentary/)).toHaveValue(
      "This remains local while the workspace changes.",
    );
  });

  it("cancels a saved edit from the keyboard and restores the reviewed definition", async () => {
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") {
        return Promise.resolve(reportLibraryPage([sessionLibraryItem()]));
      }
      if (command === "resolve_report") return Promise.resolve(resolution());
      if (command === "query_training_session_routes") {
        return Promise.resolve(routeQueryResult());
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    renderPanel({ origin: undefined, originRequestId: 0 });
    const card = await screen.findByRole("button", { name: "Open Ridge progression" });
    card.focus();
    await user.keyboard("{Enter}");
    const edit = await screen.findByRole("button", { name: "Edit composition" });
    edit.focus();
    await user.keyboard("{Enter}");
    await user.clear(screen.getByLabelText("Report title"));
    await user.type(screen.getByLabelText("Report title"), "Unsaved replacement");
    const cancel = screen.getByRole("button", { name: "Cancel composition" });
    cancel.focus();
    await user.keyboard("{Enter}");

    const previewHeading = screen.getByRole("heading", { name: "Report preview" });
    await waitFor(() => expect(previewHeading).toHaveFocus());
    expect(screen.getByRole("heading", { name: "Ridge progression", level: 3 })).toBeVisible();
    expect(screen.queryByText("Unsaved replacement")).not.toBeInTheDocument();
    expect(mocks.invoke).not.toHaveBeenCalledWith("update_report", expect.anything());

    edit.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("Report title")).toHaveValue("Ridge progression");
  });

  it("cancels a new contextual composition and returns to its exact source", async () => {
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([]));
      if (command === "query_training_session_routes") return Promise.resolve(routeQueryResult());
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    const callbacks = renderPanel();
    const title = await screen.findByLabelText("Report title");
    await user.clear(title);
    await user.type(title, "Unsaved contextual report");
    const cancel = screen.getByRole("button", { name: "Cancel composition" });
    cancel.focus();
    await user.keyboard("{Enter}");

    expect(callbacks.onReturnToOrigin).toHaveBeenCalledOnce();
    expect(callbacks.onReturnToOrigin).toHaveBeenCalledWith(null);
    expect(mocks.invoke).not.toHaveBeenCalledWith("create_report", expect.anything());
  });

  it("cancels a new library composition without creating a report", async () => {
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([]));
      if (command === "prepare_report_start") return Promise.resolve({
        sourceSnapshotRef: snapshotRef,
        origin: {
          kind: "question",
          question: "training-period-comparison",
          questionVersion: 1,
        },
        suggestedQuery: comparisonQuery,
      });
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    renderPanel({ origin: undefined, originRequestId: 0 });
    await user.click(await screen.findByRole("button", { name: "Use as basis" }));
    await user.clear(screen.getByLabelText("Report title"));
    await user.type(screen.getByLabelText("Report title"), "Unsaved library report");
    const cancel = screen.getByRole("button", { name: "Cancel composition" });
    cancel.focus();
    await user.keyboard("{Enter}");

    const libraryHeading = screen.getByRole("heading", { name: "Saved reports" });
    await waitFor(() => expect(libraryHeading).toHaveFocus());
    expect(screen.getByText("No reports have been saved yet.")).toBeVisible();
    expect(screen.queryByText("Unsaved library report")).not.toBeInTheDocument();
    expect(mocks.invoke).not.toHaveBeenCalledWith("create_report", expect.anything());
  });

  it("returns to the library without exposing a prior report when selection fails", async () => {
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([
        sessionLibraryItem({ title: "Unavailable report", evidenceState: "unavailable" }),
      ]));
      if (command === "resolve_report") {
        return Promise.reject({ code: "report-definition-query-failed" });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    renderPanel({ origin: undefined, originRequestId: 0 });
    await user.click(await screen.findByRole("button", { name: "Open Unavailable report" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "FitFreed could not read saved reports",
    );
    const navigation = screen.getByRole("navigation", { name: "Report workspace" });
    expect(within(navigation).getByRole("button", { name: "Library" }))
      .toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Open Unavailable report" })).toBeVisible();
    expect(within(navigation).getByRole("button", { name: "Compose" })).toBeDisabled();
    expect(within(navigation).getByRole("button", { name: "Preview" })).toBeDisabled();
  });

  it("keeps the create action and draft visible while the saved report is resolved", async () => {
    let resolveSavedReport: (value: ResolvedReport) => void = () => undefined;
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([]));
      if (command === "query_training_session_routes") return Promise.resolve(routeQueryResult());
      if (command === "create_report") return Promise.resolve(definition());
      if (command === "resolve_report") {
        return new Promise((resolve) => {
          resolveSavedReport = resolve;
        });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    renderPanel();
    await user.click(await screen.findByRole("button", { name: "Add commentary" }));
    await user.type(
      await screen.findByLabelText(/^Your commentary/),
      "Held the intended effort on every climb.",
    );
    await user.click(screen.getByRole("button", { name: "Save report" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "resolve_report",
      { reportRef },
    ));
    const editor = screen.getByRole("form", { name: "Edit report" });
    expect(editor).toHaveAttribute("aria-busy", "true");
    expect(within(editor).getByRole("button", { name: "Save report" })).toBeDisabled();
    expect(within(editor).getByRole("status")).toHaveTextContent("Saving…");
    expect(within(editor).getByLabelText(/^Your commentary/)).toHaveValue(
      "Held the intended effort on every climb.",
    );

    resolveSavedReport(resolution());
    expect(await screen.findByRole("heading", { name: "Ridge progression", level: 3 }))
      .toBeVisible();
  });

  it("uses a built-in question as an unsaved basis and exports only reviewed evidence", async () => {
    const user = userEvent.setup();
    let saved = false;
    mocks.save.mockResolvedValue("/private/output/question-report.html");
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage(
        saved ? [libraryItemFromDefinition(questionDefinition())] : [],
      ));
      if (command === "prepare_report_start") return Promise.resolve({
        sourceSnapshotRef: snapshotRef,
        origin: {
          kind: "question",
          question: "training-period-comparison",
          questionVersion: 1,
        },
        suggestedQuery: comparisonQuery,
      });
      if (command === "create_report") {
        saved = true;
        return Promise.resolve(questionDefinition());
      }
      if (command === "resolve_report") return Promise.resolve(questionResolution());
      if (command === "export_report") return Promise.resolve({ byteCount: "2048" });
      throw new Error(`Unexpected command: ${command} ${JSON.stringify(arguments_)}`);
    });

    renderPanel({ origin: undefined, originRequestId: 0 });
    await user.click(await screen.findByRole("button", { name: "Use as basis" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "prepare_report_start",
      {
        start: {
          kind: "question",
          question: "training-period-comparison",
          questionVersion: 1,
        },
      },
    ));
    expect(screen.getByLabelText("Report title")).toHaveValue(
      "How has my recent training changed?",
    );
    expect(screen.getByLabelText("Baseline starts")).toHaveValue("2026-01-01");
    expect(screen.getAllByRole("button", { name: "Remove block" })).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Add commentary" }));
    await user.type(
      screen.getByLabelText(/^Your commentary/),
      "Volume rose while the recorded evidence became more complete.",
    );
    await user.click(screen.getByRole("button", { name: "Save report" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("create_report", {
      request: {
        title: "How has my recent training changed?",
        locale: "en-US",
        sourceSnapshotRef: snapshotRef,
        origin: {
          kind: "question",
          question: "training-period-comparison",
          questionVersion: 1,
        },
        blocks: [
          { kind: "training-finding", query: comparisonQuery, metric: "session-count" },
          { kind: "training-chart", query: comparisonQuery, metric: "duration" },
          { kind: "training-coverage", query: comparisonQuery },
          {
            kind: "narrative",
            body: "Volume rose while the recorded evidence became more complete.",
          },
        ],
      },
    }));
    expect(await screen.findByText(
      "Calculated from the identified revision of the local training library",
    )).toBeInTheDocument();
    expect(screen.queryByText("Polar Flow")).not.toBeInTheDocument();
    const navigation = screen.getByRole("navigation", { name: "Report workspace" });
    expect(within(navigation).getByRole("button", { name: "Preview" }))
      .toHaveAttribute("aria-current", "page");
    expect(document.querySelector("form.report-editor")).not.toBeVisible();

    await user.click(screen.getByRole("button", { name: "Review and export" }));
    const review = screen.getByRole("region", { name: "Review the export" });
    expect(document.querySelector("section.report-preview")).not.toBeVisible();
    expect(within(review).getByText(/Selected period-comparison values/)).toBeVisible();
    expect(within(review).queryByRole("checkbox")).not.toBeInTheDocument();
    await user.click(within(review).getByRole("button", {
      name: "Choose destination and export",
    }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("export_report", {
      request: {
        reportRef,
        expectedRevision: "1",
        expectedSourceSnapshotRef: snapshotRef,
        includePhysiologicalContext: false,
        routeChoices: [],
        destinationPath: "/private/output/question-report.html",
      },
    }));
  });

  it("saves factual evidence without commentary and omits an empty commentary edit", async () => {
    const user = userEvent.setup();
    let revision = "1";
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage(
        revision === "1" ? [] : [libraryItemFromDefinition(factualQuestionDefinition(revision))],
      ));
      if (command === "prepare_report_start") return Promise.resolve({
        sourceSnapshotRef: snapshotRef,
        origin: {
          kind: "question",
          question: "training-period-comparison",
          questionVersion: 1,
        },
        suggestedQuery: comparisonQuery,
      });
      if (command === "create_report") {
        return Promise.resolve(factualQuestionDefinition());
      }
      if (command === "update_report") {
        revision = "2";
        return Promise.resolve(factualQuestionDefinition(revision));
      }
      if (command === "resolve_report") {
        return Promise.resolve(factualQuestionResolution(revision));
      }
      throw new Error(`Unexpected command: ${command} ${JSON.stringify(arguments_)}`);
    });

    renderPanel({ origin: undefined, originRequestId: 0 });
    await user.click(await screen.findByRole("button", { name: "Use as basis" }));

    expect(screen.getByRole("heading", { name: "Compose report" })).toBeVisible();
    expect(screen.queryByLabelText(/^Your commentary/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add commentary" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save report" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("create_report", {
      request: {
        title: "How has my recent training changed?",
        locale: "en-US",
        sourceSnapshotRef: snapshotRef,
        origin: {
          kind: "question",
          question: "training-period-comparison",
          questionVersion: 1,
        },
        blocks: [
          { kind: "training-finding", query: comparisonQuery, metric: "session-count" },
          { kind: "training-chart", query: comparisonQuery, metric: "duration" },
          { kind: "training-coverage", query: comparisonQuery },
        ],
      },
    }));
    const preview = await screen.findByRole("region", { name: "Report preview" });
    expect(within(preview).queryByRole("heading", { name: "Your commentary" }))
      .not.toBeInTheDocument();

    await user.click(within(preview).getByRole("button", { name: "Review and export" }));
    const privacyReview = screen.getByRole("region", { name: "Review the export" });
    expect(within(privacyReview).getByText("Your report title")).toBeVisible();
    expect(within(privacyReview).queryByText("Your optional commentary")).not.toBeInTheDocument();
    await user.click(within(privacyReview).getByRole("button", { name: "Back to report" }));

    await user.click(screen.getByRole("button", { name: "Compose" }));
    const addCommentary = screen.getByRole("button", { name: "Add commentary" });
    await user.click(addCommentary);
    let commentary = screen.getByLabelText(/^Your commentary/);
    await waitFor(() => expect(commentary).toHaveFocus());
    await user.type(commentary, "Temporary explanation");
    await user.click(screen.getByRole("button", { name: "Move Your commentary earlier" }));
    await user.click(screen.getByRole("button", { name: "Remove commentary" }));
    const restoredAddCommentary = screen.getByRole("button", { name: "Add commentary" });
    await waitFor(() => expect(restoredAddCommentary).toHaveFocus());
    expect(screen.queryByLabelText(/^Your commentary/)).not.toBeInTheDocument();

    await user.click(restoredAddCommentary);
    commentary = screen.getByLabelText(/^Your commentary/);
    await waitFor(() => expect(commentary).toHaveFocus());
    await user.type(commentary, "   ");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("update_report", {
      request: {
        reportRef,
        expectedRevision: "1",
        title: "How has my recent training changed?",
        locale: "en-US",
        blocks: factualQuestionDefinition().blocks,
      },
    }));
  });

  it("creates a factual session report without manufacturing authored commentary", async () => {
    const user = userEvent.setup();
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([]));
      if (command === "query_training_session_routes") {
        return Promise.resolve({ snapshotRef, sessionRef, routes: { exercises: [] } });
      }
      if (command === "create_report") return Promise.resolve(factualSessionDefinition());
      if (command === "resolve_report") return Promise.resolve(factualSessionResolution());
      throw new Error(`Unexpected command: ${command}`);
    });

    renderPanel();
    expect(await screen.findByRole("button", { name: "Add commentary" })).toBeVisible();
    expect(screen.queryByLabelText(/^Your commentary/)).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("Report title"));
    await user.type(screen.getByLabelText("Report title"), "Recorded ridge evidence");
    await user.click(screen.getByRole("button", { name: "Save report" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("create_report", {
      request: {
        title: "Recorded ridge evidence",
        locale: "en-US",
        sourceSnapshotRef: snapshotRef,
        origin: { kind: "session", sessionRef },
        blocks: [{
          kind: "session-evidence",
          includePhysiologicalContext: true,
        }],
      },
    }));
    const preview = await screen.findByRole("region", { name: "Report preview" });
    expect(within(preview).getByRole("heading", { name: "Recorded ridge evidence" }))
      .toBeVisible();
    expect(within(preview).queryByRole("heading", { name: "Your commentary" }))
      .not.toBeInTheDocument();
  });

  it("opens an older authored report and adds evidence without changing its blank origin", async () => {
    const user = userEvent.setup();
    let revision = "1";
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([
        libraryItemFromDefinition(blankDefinition(revision, revision === "2")),
      ]));
      if (command === "prepare_report_start") return Promise.resolve({
        sourceSnapshotRef: snapshotRef,
        origin: { kind: "blank" },
        suggestedQuery: comparisonQuery,
      });
      if (command === "update_report") {
        revision = "2";
        return Promise.resolve(blankDefinition("2", true));
      }
      if (command === "resolve_report") {
        return Promise.resolve(blankResolution(revision, revision === "2"));
      }
      throw new Error(`Unexpected command: ${command} ${JSON.stringify(arguments_)}`);
    });

    renderPanel({ origin: undefined, originRequestId: 0 });
    await user.click(await screen.findByRole("button", { name: "Open My training notes" }));
    expect(await screen.findByText(
      "User-authored content; no imported evidence selected",
    )).toBeInTheDocument();
    expect(mocks.invoke).not.toHaveBeenCalledWith("create_report", expect.anything());
    await user.click(screen.getByRole("button", { name: "Compose" }));
    expect(screen.getByLabelText("Report title")).toHaveValue("My training notes");
    expect(screen.getByLabelText(/^Your commentary/)).toHaveValue(
      "A note that starts with my own interpretation.",
    );
    expect(screen.getByLabelText(/^Your commentary/)).toBeRequired();
    expect(screen.queryByRole("button", { name: "Remove commentary" }))
      .not.toBeInTheDocument();
    expect(screen.getByText(/needs commentary until supported evidence is added/)).toBeVisible();
    expect(screen.queryByLabelText("Baseline starts")).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText(/^Your commentary/));
    await user.type(screen.getByLabelText(/^Your commentary/), " ");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    const legacyDefinitionError = await screen.findByRole("alert");
    expect(legacyDefinitionError).toHaveTextContent(
      "Add a title and keep supported evidence or commentary before saving the report.",
    );
    expect(screen.getByLabelText(/^Your commentary/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/^Your commentary/)).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining("report-editor-error"),
    );
    expect(mocks.invoke).not.toHaveBeenCalledWith("update_report", expect.anything());
    await user.clear(screen.getByLabelText(/^Your commentary/));
    await user.type(
      screen.getByLabelText(/^Your commentary/),
      "A note that starts with my own interpretation.",
    );
    await user.click(screen.getByRole("button", { name: "Add Key finding" }));
    expect(screen.getByLabelText("Baseline starts")).toHaveValue("2026-01-01");
    expect(screen.getByLabelText(/^Your commentary/)).not.toBeRequired();
    expect(screen.getByRole("button", { name: "Remove commentary" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("update_report", {
      request: {
        reportRef,
        expectedRevision: "1",
        title: "My training notes",
        locale: "en-US",
        blocks: [
          {
            blockRef: `report-block-${digest("6")}`,
            kind: "narrative",
            body: "A note that starts with my own interpretation.",
          },
          { kind: "training-finding", query: comparisonQuery, metric: "session-count" },
        ],
      },
    }));
    expect((await screen.findAllByText(
      "Calculated from the identified revision of the local training library",
    )).length).toBeGreaterThan(0);
  });

  it("carries an exact exploration query into a report and returns to that comparison", async () => {
    const user = userEvent.setup();
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([]));
      if (command === "prepare_report_start") return Promise.resolve({
        sourceSnapshotRef: snapshotRef,
        origin: { kind: "exploration", query: comparisonQuery },
        suggestedQuery: comparisonQuery,
      });
      throw new Error(`Unexpected command: ${command}`);
    });

    const callbacks = renderPanel({
      origin: { kind: "exploration", query: comparisonQuery },
      originRequestId: 2,
    });
    expect(await screen.findByLabelText("Baseline starts")).toHaveValue("2026-01-01");
    expect(mocks.invoke).toHaveBeenCalledWith("prepare_report_start", {
      start: { kind: "exploration", query: comparisonQuery },
    });
    await user.click(screen.getByRole("button", { name: "Back to the comparison" }));
    expect(callbacks.onReturnToOrigin).toHaveBeenCalledOnce();
    expect(callbacks.onReturnToOrigin).toHaveBeenCalledWith(null);
  });

  it("opens canonical sources for saved reports without inventing one for a blank report", async () => {
    const user = userEvent.setup();
    const sessionReportRef = `report-${digest("b")}`;
    const explorationReportRef = `report-${digest("c")}`;
    const blankReportRef = `report-${digest("d")}`;
    const sessionResolution = {
      ...resolution(),
      definition: { ...resolution().definition, reportRef: sessionReportRef },
    };
    const explorationResolution = {
      ...analyticalResolution(),
      definition: {
        ...analyticalResolution().definition,
        reportRef: explorationReportRef,
        origin: { kind: "exploration" as const, query: comparisonQuery },
      },
    };
    const authoredResolution = {
      ...blankResolution(),
      definition: { ...blankResolution().definition, reportRef: blankReportRef },
    };
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([
        libraryItemFromDefinition({
          ...sessionResolution.definition,
          title: "Session report",
        }),
        libraryItemFromDefinition({
          ...explorationResolution.definition,
          title: "Comparison report",
        }),
        libraryItemFromDefinition({
          ...authoredResolution.definition,
          title: "Blank report",
        }),
      ]));
      if (command === "resolve_report") {
        const selected = arguments_.reportRef;
        if (selected === sessionReportRef) return Promise.resolve(sessionResolution);
        if (selected === explorationReportRef) return Promise.resolve(explorationResolution);
        if (selected === blankReportRef) return Promise.resolve(authoredResolution);
      }
      if (command === "query_training_session_routes") {
        return Promise.resolve({ snapshotRef, sessionRef, routes: { exercises: [] } });
      }
      if (command === "prepare_report_start") return Promise.resolve({
        sourceSnapshotRef: snapshotRef,
        origin: { kind: "blank" },
        suggestedQuery: comparisonQuery,
      });
      throw new Error(`Unexpected command: ${command}`);
    });

    const callbacks = renderPanel({ origin: undefined, originRequestId: 0 });
    await user.click(await screen.findByRole("button", { name: "Open Session report" }));
    await user.click(screen.getByRole("button", { name: "View source session" }));
    expect(callbacks.onReturnToOrigin).toHaveBeenLastCalledWith({
      kind: "session",
      reportRef: sessionReportRef,
      sessionRef,
      localDate: "2026-08-16",
    });

    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.click(screen.getByRole("button", { name: "Open Comparison report" }));
    await user.click(screen.getByRole("button", { name: "View source comparison" }));
    expect(callbacks.onReturnToOrigin).toHaveBeenLastCalledWith({
      kind: "comparison",
      reportRef: explorationReportRef,
      query: comparisonQuery,
    });

    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.click(screen.getByRole("button", { name: "Open Blank report" }));
    await waitFor(() => expect(screen.getByLabelText("Report title")).toHaveValue(
      "My training notes",
    ));
    expect(screen.queryByRole("button", { name: /source/ })).not.toBeInTheDocument();
  });

  it("validates, saves, resolves, edits, and reopens a durable session report", async () => {
    const user = userEvent.setup();
    let saved: ReportDefinition | undefined;
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "list_report_library") {
        return Promise.resolve(reportLibraryPage(
          saved ? [libraryItemFromDefinition(saved)] : [],
        ));
      }
      if (command === "query_training_session_routes") {
        return Promise.resolve({ snapshotRef, sessionRef, routes: { exercises: [] } });
      }
      if (command === "create_report") {
        saved = definition();
        return Promise.resolve(saved);
      }
      if (command === "update_report") {
        saved = definition("2", "Ridge progression review");
        return Promise.resolve(saved);
      }
      if (command === "resolve_report") {
        return Promise.resolve(resolution(saved));
      }
      throw new Error(`Unexpected command: ${command} ${JSON.stringify(arguments_)}`);
    });

    const callbacks = renderPanel();
    expect(await screen.findByLabelText("Report title")).toHaveValue(
      "Training session · Aug 16, 2026, 8:30 AM",
    );
    await user.click(screen.getByRole("button", { name: "Library" }));
    expect(screen.getByText(
      "No reports have been saved yet.",
    )).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Compose" }));

    await user.clear(screen.getByLabelText("Report title"));
    await user.click(screen.getByRole("button", { name: "Save report" }));
    expect(screen.getByLabelText("Report title")).toBeInvalid();
    expect(screen.queryByLabelText(/^Your commentary/)).not.toBeInTheDocument();
    expect(mocks.invoke).not.toHaveBeenCalledWith(
      "create_report",
      expect.anything(),
    );

    await user.type(screen.getByLabelText("Report title"), " ");
    await user.click(screen.getByRole("button", { name: "Save report" }));
    const definitionError = await screen.findByRole("alert");
    expect(definitionError).toHaveTextContent(
      "Add a title and keep supported evidence or commentary before saving the report.",
    );
    expect(definitionError).toHaveAttribute("id", "report-editor-error");
    expect(screen.getByLabelText("Report title")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Report title")).toHaveAttribute(
      "aria-describedby",
      "report-editor-error",
    );

    await user.type(screen.getByLabelText("Report title"), "Ridge progression");
    await user.click(screen.getByRole("button", { name: "Add commentary" }));
    await user.type(
      screen.getByLabelText(/^Your commentary/),
      "Held the intended effort on every climb.",
    );
    await user.click(screen.getByRole("button", { name: "Save report" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "create_report",
      {
        request: {
          title: "Ridge progression",
          locale: "en-US",
          sourceSnapshotRef: snapshotRef,
          origin: { kind: "session", sessionRef },
          blocks: [
            {
              kind: "session-evidence",
              includePhysiologicalContext: true,
            },
            {
              kind: "narrative",
              body: "Held the intended effort on every climb.",
            },
          ],
        },
      },
    ));
    expect(await screen.findByText("Report saved in your local library.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Ridge progression", level: 3 })).toBeVisible();
    const preview = screen.getByRole("region", { name: "Report preview" });
    const sportIdentity = within(preview).getByText("Trail running").closest("dd");
    expect(sportIdentity).not.toBeNull();
    expect(within(sportIdentity!).getByTestId("sport-family-icon")).toBeVisible();
    expect(screen.getByText("148 bpm")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Compose" }));
    await user.clear(screen.getByLabelText("Report title"));
    await user.type(screen.getByLabelText("Report title"), "Ridge progression review");
    await user.clear(screen.getByLabelText(/^Your commentary/));
    await user.type(
      screen.getByLabelText(/^Your commentary/),
      "Held the intended effort and finished with control.",
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "update_report",
      {
        request: {
          reportRef,
          expectedRevision: "1",
          title: "Ridge progression review",
          locale: "en-US",
          blocks: [
            {
              blockRef: `report-block-${digest("5")}`,
              kind: "session-evidence",
              includePhysiologicalContext: true,
            },
            {
              blockRef: `report-block-${digest("6")}`,
              kind: "narrative",
              body: "Held the intended effort and finished with control.",
            },
          ],
        },
      },
    ));
    await user.click(screen.getByRole("button", { name: "Compose" }));
    expect(await screen.findByText("Revision 2")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Library" }));
    const savedReports = screen.getByRole("heading", { name: "Saved reports" })
      .closest(".report-library") as HTMLElement | null;
    expect(savedReports).not.toBeNull();
    const priorResolutions = mocks.invoke.mock.calls.filter(
      ([command]) => command === "resolve_report",
    ).length;
    await user.click(within(savedReports!).getByRole("button", {
      name: "Open Ridge progression review",
    }));
    await waitFor(() => expect(mocks.invoke.mock.calls.filter(
      ([command]) => command === "resolve_report",
    )).toHaveLength(priorResolutions + 1));
    expect(mocks.invoke.mock.calls.filter(
      ([command]) => command === "resolve_report",
    ).at(-1)).toEqual(["resolve_report", { reportRef }]);
    await user.click(screen.getByRole("button", { name: "View source session" }));
    expect(callbacks.onReturnToOrigin).toHaveBeenCalledOnce();
    expect(callbacks.onReturnToOrigin).toHaveBeenCalledWith({
      kind: "session",
      reportRef,
      sessionRef,
      localDate: "2026-08-16",
    });
  });

  it("reviews the complete privacy boundary and exports a reduced self-contained report", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    const saved = definition();
    mocks.save.mockResolvedValue("/private/output/ridge-progression.html");
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") {
        return Promise.resolve(reportLibraryPage([libraryItemFromDefinition(saved)]));
      }
      if (command === "resolve_report") return Promise.resolve(resolution(saved));
      if (command === "query_training_session_routes") {
        return Promise.resolve({ snapshotRef, sessionRef, routes: { exercises: [] } });
      }
      if (command === "export_report") return Promise.resolve({ byteCount: "4096" });
      throw new Error(`Unexpected command: ${command}`);
    });

    renderPanel({ origin: undefined, originRequestId: 0 });
    await user.click(await screen.findByRole("button", { name: "Open Ridge progression" }));
    await screen.findByRole("region", { name: "Report preview" });
    scrollIntoView.mockClear();
    await user.click(await screen.findByRole("button", { name: "Review and export" }));

    const review = screen.getByRole("region", { name: "Review the export" });
    await waitFor(() => expect(within(review).getByRole("heading", {
      name: "Review the export",
    })).toHaveFocus());
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      inline: "nearest",
    });
    expect(within(review).getByText(/Exact training samples are excluded/)).toBeVisible();
    expect(within(review).getByText(/written only to the location you choose/)).toBeVisible();
    await user.click(within(review).getByRole("checkbox", {
      name: /Include heart-rate summary in this export/,
    }));
    await user.click(within(review).getByRole("button", {
      name: "Choose destination and export",
    }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "export_report",
      {
        request: {
          reportRef,
          expectedRevision: "1",
          expectedSourceSnapshotRef: snapshotRef,
          includePhysiologicalContext: false,
          routeChoices: [],
          destinationPath: "/private/output/ridge-progression.html",
        },
      },
    ));
    const exportedNotice = await screen.findByText(
      "Self-contained HTML exported (4,096 bytes).",
    );
    expect(exportedNotice).toBeVisible();
    await waitFor(() => expect(exportedNotice).toHaveFocus());
    expect(screen.queryByRole("region", { name: "Review the export" })).not.toBeInTheDocument();
  });

  it("adds, configures, reorders, previews, privacy-reviews, exports, and removes a route block", async () => {
    const user = userEvent.setup();
    let saved: ReportDefinition | undefined;
    mocks.save.mockResolvedValue("/private/output/routed-report.html");
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage(
        saved ? [libraryItemFromDefinition(saved)] : [],
      ));
      if (command === "query_training_session_routes") return Promise.resolve(routeQueryResult());
      if (command === "create_report") {
        saved = routedDefinition(0);
        return Promise.resolve(saved);
      }
      if (command === "update_report") {
        saved = definition("2");
        return Promise.resolve(saved);
      }
      if (command === "resolve_report") {
        return Promise.resolve(saved?.blocks.some((block) => block.kind === "route")
          ? routedResolution(saved)
          : resolution(saved));
      }
      if (command === "export_report") return Promise.resolve({ byteCount: "8192" });
      throw new Error(`Unexpected command: ${command}`);
    });

    renderPanel();
    expect(await screen.findByText(
      "Routes stay local. A report remembers which recorded route to use and how much to hide at its endpoints.",
    )).toBeVisible();
    await user.click(await screen.findByRole("button", { name: /Add Primary route/ }));
    const redaction = screen.getByLabelText("Remove from each route endpoint (metres)");
    expect(redaction).toHaveValue(200);
    await user.clear(redaction);
    await user.type(redaction, "5001");
    expect(redaction).toBeInvalid();
    await user.clear(redaction);
    await user.type(redaction, "0");
    expect(redaction).toBeValid();
    expect(screen.getByText(/Zero removes no distance from the recorded start or finish/)).toBeVisible();

    const moveRouteEarlier = screen.getByRole("button", {
      name: /Move Primary route .* earlier/,
    });
    await user.click(moveRouteEarlier);
    await user.click(screen.getByRole("button", { name: /Move Primary route .* earlier/ }));
    await user.clear(screen.getByLabelText("Report title"));
    await user.type(screen.getByLabelText("Report title"), "Ridge progression");
    await user.click(screen.getByRole("button", { name: "Add commentary" }));
    await user.type(
      screen.getByLabelText(/^Your commentary/),
      "Held the intended effort on every climb.",
    );
    await user.click(screen.getByRole("button", { name: "Save report" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "create_report",
      {
        request: {
          title: "Ridge progression",
          locale: "en-US",
          sourceSnapshotRef: snapshotRef,
          origin: { kind: "session", sessionRef },
          blocks: [
            { kind: "route", routeRef, endpointRedactionMeters: 0 },
            { kind: "session-evidence", includePhysiologicalContext: true },
            {
              kind: "narrative",
              body: "Held the intended effort on every climb.",
            },
          ],
        },
      },
    ));
    const visual = await screen.findByRole("img", { name: /Primary route, local shape/ });
    expect(visual.querySelector("polyline")).not.toBeNull();
    expect(document.body.innerHTML).not.toContain("40.123456");
    expect(document.body.innerHTML).not.toContain("-3.654321");

    await user.click(screen.getByRole("button", { name: "Review and export" }));
    const review = screen.getByRole("region", { name: "Review the export" });
    const routeChoice = within(review).getByRole("checkbox", { name: /Include Primary route/ });
    expect(routeChoice).toBeChecked();
    const exportRedaction = within(review).getByLabelText(
      "Export endpoint redaction (metres)",
    );
    await user.clear(exportRedaction);
    await user.type(exportRedaction, "500");
    await user.click(routeChoice);
    await user.click(within(review).getByRole("button", {
      name: "Choose destination and export",
    }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "export_report",
      {
        request: {
          reportRef,
          expectedRevision: "1",
          expectedSourceSnapshotRef: snapshotRef,
          includePhysiologicalContext: true,
          routeChoices: [{
            blockRef: routeBlockRef,
            includeGeometry: false,
            endpointRedactionMeters: 500,
          }],
          destinationPath: "/private/output/routed-report.html",
        },
      },
    ));

    await user.click(screen.getByRole("button", { name: "Compose" }));
    await user.click(screen.getByRole("button", { name: "Remove route" }));
    expect(screen.queryByLabelText("Remove from each route endpoint (metres)")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "update_report",
      expect.objectContaining({
        request: expect.objectContaining({
          blocks: expect.not.arrayContaining([expect.objectContaining({ kind: "route" })]),
        }),
      }),
    ));
  });

  it("builds, validates, saves, previews, removes, and reopens every training comparison view", async () => {
    const user = userEvent.setup();
    let saved: ReportDefinition | undefined;
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage(
        saved ? [libraryItemFromDefinition(saved)] : [],
      ));
      if (command === "query_training_session_routes") {
        return Promise.resolve({ snapshotRef, sessionRef, routes: { exercises: [] } });
      }
      if (command === "create_report") {
        saved = analyticalDefinition();
        return Promise.resolve(saved);
      }
      if (command === "resolve_report") return Promise.resolve(analyticalResolution());
      throw new Error(`Unexpected command: ${command}`);
    });

    renderPanel();
    for (const block of [
      "Key finding",
      "Period comparison",
      "Comparison chart",
      "Exact values",
      "Coverage and missing data",
    ]) {
      await user.click(await screen.findByRole("button", { name: `Add ${block}` }));
    }
    expect(screen.getByText("All available comparison views are in this report.")).toBeVisible();
    const removeButtons = screen.getAllByRole("button", { name: "Remove block" });
    await user.click(removeButtons.at(-1)!);
    expect(screen.getByRole("button", { name: "Add Coverage and missing data" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add Coverage and missing data" }));

    const setDate = async (label: string, value: string) => {
      const input = screen.getByLabelText(label);
      await user.clear(input);
      await user.type(input, value);
      expect(input).toHaveValue(value);
    };
    await setDate("Baseline starts", "2026-03-01");
    await setDate("Baseline ends", "2026-01-31");
    await setDate("Comparison starts", "2026-02-01");
    await setDate("Comparison ends", "2026-02-28");
    const metrics = screen.getAllByLabelText("Measurement");
    await user.selectOptions(metrics[0], "energy");
    await user.selectOptions(metrics[1], "distance");
    expect(metrics[0]).toHaveValue("energy");
    expect(metrics[1]).toHaveValue("distance");
    await user.clear(screen.getByLabelText("Report title"));
    await user.type(screen.getByLabelText("Report title"), "Winter training comparison");
    await user.click(screen.getByRole("button", { name: "Add commentary" }));
    await user.type(
      screen.getByLabelText(/^Your commentary/),
      "Volume increased while measurement coverage also improved.",
    );

    await user.click(screen.getByRole("button", { name: "Save report" }));
    const comparisonError = await screen.findByRole("alert");
    expect(comparisonError).toHaveTextContent(
      "Choose real, ordered dates of no more than 366 days",
    );
    expect(comparisonError).toHaveAttribute("id", "report-editor-error");
    for (const label of [
      "Baseline starts",
      "Baseline ends",
      "Comparison starts",
      "Comparison ends",
    ]) {
      const input = screen.getByLabelText(label);
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAttribute("aria-describedby", "report-editor-error");
    }
    expect(mocks.invoke).not.toHaveBeenCalledWith(
      "create_report",
      expect.anything(),
    );
    await setDate("Baseline starts", "2026-01-01");
    await user.click(screen.getByRole("button", { name: "Save report" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "create_report",
      {
        request: {
          title: "Winter training comparison",
          locale: "en-US",
          sourceSnapshotRef: snapshotRef,
          origin: { kind: "session", sessionRef },
          blocks: [
            { kind: "session-evidence", includePhysiologicalContext: true },
            { kind: "training-finding", query: comparisonQuery, metric: "energy" },
            { kind: "training-comparison", query: comparisonQuery },
            { kind: "training-chart", query: comparisonQuery, metric: "distance" },
            { kind: "training-exact-table", query: comparisonQuery },
            { kind: "training-coverage", query: comparisonQuery },
            {
              kind: "narrative",
              body: "Volume increased while measurement coverage also improved.",
            },
          ],
        },
      },
    ));
    expect(await screen.findByText(/Recorded energy moved from 2,500 kcal to 4,200 kcal/)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Period comparison", level: 3 })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Comparison chart", level: 3 })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Exact values", level: 3 })).toBeVisible();
    expect(screen.getByRole("heading", {
      name: "Coverage and missing data",
      level: 3,
    })).toBeVisible();
    expect(screen.getByRole("region", {
      name: "Period comparison · Exact values · Imported source 1",
    })).toBeVisible();
    expect(screen.getByRole("region", {
      name: "Comparison chart · Exact values · Imported source 1",
    })).toBeVisible();
    expect(screen.getByRole("region", {
      name: "Exact values · Imported source 1",
    })).toBeVisible();
    expect(screen.getAllByText("68,500.75 m").length).toBeGreaterThan(0);
    expect(document.body.innerHTML).not.toContain("opaque-origin-that-must-not-be-rendered");
    const reviewOrigin = screen.getByRole("button", { name: "Review and export" });
    await user.click(reviewOrigin);
    const privacyReview = screen.getByRole("region", { name: "Review the export" });
    await waitFor(() => expect(within(privacyReview).getByRole("heading", {
      name: "Review the export",
    })).toHaveFocus());
    expect(within(privacyReview).getByText(/Selected period-comparison values/)).toBeVisible();
    await user.click(within(privacyReview).getByRole("button", { name: "Back to report" }));
    await waitFor(() => expect(reviewOrigin).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "Library" }));
    const savedReports = screen.getByRole("heading", { name: "Saved reports" })
      .closest(".report-library") as HTMLElement | null;
    await user.click(within(savedReports!).getByRole("button", {
      name: "Open Winter training comparison",
    }));
    expect(await screen.findByLabelText("Baseline starts")).toHaveValue("2026-01-01");
    const reopenedMetrics = screen.getAllByLabelText("Measurement");
    expect(reopenedMetrics[0]).toHaveValue("energy");
    expect(reopenedMetrics[1]).toHaveValue("distance");
  });

  it("lists multiple reports and cancels an active export without reporting success", async () => {
    const user = userEvent.setup();
    let rejectExport: ((reason: unknown) => void) | undefined;
    mocks.save.mockResolvedValue("/private/output/cancelled.html");
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([
        sessionLibraryItem(),
        sessionLibraryItem({
          reportRef: `report-${digest("7")}`,
          title: "Recovery run",
          revision: "3",
        }),
      ]));
      if (command === "resolve_report") return Promise.resolve(resolution());
      if (command === "query_training_session_routes") {
        return Promise.resolve({ snapshotRef, sessionRef, routes: { exercises: [] } });
      }
      if (command === "export_report") {
        return new Promise((_resolve, reject) => {
          rejectExport = reject;
        });
      }
      if (command === "cancel_report_export") {
        rejectExport?.({ code: "report-export-cancelled" });
        return Promise.resolve(true);
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    renderPanel({ origin: undefined, originRequestId: 0 });
    expect(await screen.findByRole("button", { name: "Open Ridge progression" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Open Recovery run" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Open Ridge progression" }));
    await user.click(await screen.findByRole("button", { name: "Review and export" }));
    const exportAction = screen.getByRole("button", {
      name: "Choose destination and export",
    });
    await user.click(exportAction);
    const review = screen.getByRole("region", { name: "Review the export" });
    await waitFor(() => expect(review).toHaveAttribute("aria-busy", "true"));
    expect(exportAction).toBeDisabled();
    expect(exportAction).toHaveAccessibleName("Choose destination and export");
    expect(within(review).getByRole("status")).toHaveTextContent("Exporting…");
    await user.click(await screen.findByRole("button", { name: "Cancel export" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The export was cancelled. No partial file was left behind.",
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByText(/Self-contained HTML exported/)).not.toBeInTheDocument();
    await waitFor(() => expect(exportAction).toHaveFocus());
  });

  it("blocks stale exports, reports failures, and presents the workflow in Spanish", async () => {
    const user = userEvent.setup();
    const stale = {
      ...resolution(),
      resolvedSnapshotRef: changedSnapshotRef,
      status: "stale" as const,
    };
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([]));
      if (command === "resolve_report") return Promise.resolve(stale);
      if (command === "query_training_session_routes") {
        return Promise.resolve({ snapshotRef, sessionRef, routes: { exercises: [] } });
      }
      if (command === "create_report") {
        return Promise.reject({ code: "report-definition-update-failed" });
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    renderPanel({
      locale: "es-ES",
      messages: catalogs["es-ES"],
    });
    expect(await screen.findByRole("heading", {
      name: "Crea y exporta informes",
    })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Añadir Hallazgo principal" }));
    expect(screen.getByLabelText("Inicio del periodo de referencia")).toHaveValue("2026-08-16");
    expect(screen.getByLabelText("Medición")).toHaveValue("session-count");
    expect(screen.getByText(/una única comparación versionada y compartida/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Añadir comentarios" }));
    await user.type(screen.getByLabelText(/^Tus comentarios/), "Una sesión sostenida y controlada.");
    await user.click(screen.getByRole("button", { name: "Guardar informe" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "FitFreed no ha podido guardar el informe",
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);

    cleanup();
    let refreshed = false;
    const spanishDefinition = {
      ...stale.definition,
      title: "Sesión sostenida",
      locale: "es-ES" as const,
    };
    const refreshedDefinition = {
      ...spanishDefinition,
      sourceSnapshotRef: changedSnapshotRef,
      revision: "2",
    };
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([
        sessionLibraryItem({
          title: "Sesión sostenida",
          locale: "es-ES",
          sourceSnapshotRef: refreshed ? changedSnapshotRef : snapshotRef,
          revision: refreshed ? "2" : "1",
          evidenceState: refreshed ? "current" : "stale",
        }),
      ]));
      if (command === "resolve_report") return Promise.resolve(refreshed
        ? {
            ...stale,
            definition: refreshedDefinition,
            status: "current",
          }
        : { ...stale, definition: spanishDefinition });
      if (command === "query_training_session_routes") {
        return Promise.resolve({
          snapshotRef: refreshed ? changedSnapshotRef : snapshotRef,
          sessionRef,
          routes: { exercises: [] },
        });
      }
      if (command === "refresh_report") {
        refreshed = true;
        return Promise.resolve(refreshedDefinition);
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    renderPanel({ locale: "es-ES", messages: catalogs["es-ES"], origin: undefined, originRequestId: 0 });
    await user.click(await screen.findByRole("button", { name: "Abrir Sesión sostenida" }));
    expect(await screen.findByText(/La biblioteca de entrenamientos cambió/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Revisar y exportar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Componer" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Editar composición" })).toBeDisabled();
    expect(document.querySelector("form.report-editor")).not.toBeVisible();
    expect(screen.getByLabelText("Título del informe")).toBeDisabled();
    expect(mocks.save).not.toHaveBeenCalled();

    const refreshOrigin = screen.getByRole("button", {
      name: "Revisar actualización de evidencias",
    });
    await user.click(refreshOrigin);
    let refreshReview = screen.getByRole("region", {
      name: "Revisa las evidencias actuales de la biblioteca",
    });
    await waitFor(() => expect(within(refreshReview).getByRole("heading", {
      name: "Revisa las evidencias actuales de la biblioteca",
    })).toHaveFocus());
    expect(within(refreshReview).getByText(
      /no conserva versiones anteriores del historial importado/,
    )).toBeVisible();
    expect(within(refreshReview).getByText(
      "El título, los comentarios opcionales y el idioma del informe",
    )).toBeVisible();
    expect(within(refreshReview).getByText(
      "Las evidencias registradas y calculadas de la vista previa",
    )).toBeVisible();
    await user.click(within(refreshReview).getByRole("button", {
      name: "Conservar la versión guardada",
    }));
    expect(screen.queryByRole("region", {
      name: "Revisa las evidencias actuales de la biblioteca",
    })).not.toBeInTheDocument();
    await waitFor(() => expect(refreshOrigin).toHaveFocus());
    expect(screen.getByRole("button", { name: "Revisar y exportar" })).toBeDisabled();

    await user.click(refreshOrigin);
    refreshReview = screen.getByRole("region", {
      name: "Revisa las evidencias actuales de la biblioteca",
    });
    await waitFor(() => expect(within(refreshReview).getByRole("heading", {
      name: "Revisa las evidencias actuales de la biblioteca",
    })).toHaveFocus());
    await user.click(within(refreshReview).getByRole("button", {
      name: "Utilizar esta revisión de evidencias",
    }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("refresh_report", {
      request: {
        reportRef,
        expectedRevision: "1",
        expectedSourceSnapshotRef: snapshotRef,
        expectedResolvedSnapshotRef: changedSnapshotRef,
      },
    }));
    const refreshedNotice = await screen.findByText(/utiliza ahora la revisión de evidencias/);
    expect(refreshedNotice).toBeVisible();
    await waitFor(() => expect(refreshedNotice).toHaveFocus());
    const spanishPreview = screen.getByRole("region", { name: "Vista previa del informe" });
    expect(within(spanishPreview).getByText("Evidencias actuales")).toBeVisible();
    expect(screen.getByRole("button", { name: "Revisar y exportar" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Componer" }));
    expect(screen.getByText("Revisión 2")).toBeVisible();
    expect(screen.getByLabelText("Título del informe")).toHaveValue("Sesión sostenida");
    expect(screen.getByLabelText(/^Tus comentarios/)).toHaveValue(
      "Held the intended effort on every climb.",
    );
  });

  it("keeps the stale report recoverable when the reviewed candidate changes", async () => {
    const user = userEvent.setup();
    let rejectRefresh: (reason: unknown) => void = () => undefined;
    const stale = {
      ...resolution(),
      resolvedSnapshotRef: changedSnapshotRef,
      status: "stale" as const,
    };
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_report_library") return Promise.resolve(reportLibraryPage([
        sessionLibraryItem({ evidenceState: "stale" }),
      ]));
      if (command === "resolve_report") return Promise.resolve(stale);
      if (command === "query_training_session_routes") {
        return Promise.resolve({ snapshotRef, sessionRef, routes: { exercises: [] } });
      }
      if (command === "refresh_report") {
        return new Promise((_resolve, reject) => {
          rejectRefresh = reject;
        });
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    renderPanel({ origin: undefined, originRequestId: 0 });
    await user.click(await screen.findByRole("button", { name: "Open Ridge progression" }));
    await user.click(screen.getByRole("button", { name: "Review evidence refresh" }));
    const review = screen.getByRole("region", { name: "Review the current library evidence" });
    await user.click(within(review).getByRole("button", { name: "Use this evidence revision" }));

    await waitFor(() => expect(review).toHaveAttribute("aria-busy", "true"));
    expect(within(review).getByRole("button", { name: "Use this evidence revision" }))
      .toBeDisabled();
    expect(within(review).getByRole("status")).toHaveTextContent("Refreshing evidence…");

    rejectRefresh({ code: "report-source-changed" });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The source history changed after this report was resolved",
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("region", {
      name: "Review the current library evidence",
    })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Choose destination and export" }))
      .not.toBeInTheDocument();
    expect(screen.getByLabelText("Report title")).toHaveValue("Ridge progression");
    await user.click(within(review).getByRole("button", { name: "Keep saved version" }));
    const preview = screen.getByRole("region", { name: "Report preview" });
    expect(within(preview).getByText("Source changed")).toBeVisible();
    expect(screen.getByRole("button", { name: "Review and export" })).toBeDisabled();
  });
});
