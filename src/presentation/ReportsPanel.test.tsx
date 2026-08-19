import type { ComponentProps } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import { ReportsPanel } from "./ReportsPanel";
import type {
  ReportDefinition,
  ResolvedSessionReport,
  SessionReportOrigin,
} from "./session-report";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: mocks.save }));

const digest = (character: string) => character.repeat(64);
const sessionRef = `session-${digest("1")}`;
const snapshotRef = `training-snapshot-${digest("2")}`;
const reportRef = `report-${digest("3")}`;
const routeRef = `route-${digest("7")}`;
const routeBlockRef = `report-block-${digest("8")}`;
const comparisonQuery = {
  question: "training-period-comparison" as const,
  questionVersion: 1 as const,
  baselineRange: { from: "2026-01-01", through: "2026-01-31" },
  comparisonRange: { from: "2026-02-01", through: "2026-02-28" },
};

const origin: SessionReportOrigin = {
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
      state: "classified",
      classification: {
        canonicalFamily: "running",
        displayLabel: "Trail running",
        authorship: "user",
        revision: 1,
      },
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
      provider: "polar-flow",
      sourceModifiedAtUtc: "2026-08-16T11:00:00Z",
      sourceAdapterVersion: "polar-flow-takeout-v1",
      mappingVersion: "polar-flow-to-canonical-v1",
      contributingEventCount: 1,
      nonContributingEventCount: 0,
    },
    routes: [],
    trainingComparison: null,
    sensitiveContents: [{
      kind: "heart-rate",
      blockRef: null,
      included: true,
      endpointRedactionMeters: null,
    }],
    limitations: [],
  };
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

function renderPanel(properties: Partial<ComponentProps<typeof ReportsPanel>> = {}) {
  const onError = vi.fn();
  const onReturnToOrigin = vi.fn();
  render(
    <ReportsPanel
      locale="en-US"
      messages={catalogs["en-US"]}
      origin={origin}
      originRequestId={1}
      disabled={false}
      onReturnToOrigin={onReturnToOrigin}
      onError={onError}
      {...properties}
    />,
  );
  return { onError, onReturnToOrigin };
}

beforeEach(() => {
  mocks.invoke.mockReset();
  mocks.save.mockReset();
});

afterEach(cleanup);

describe("ReportsPanel", () => {
  it("validates, saves, resolves, edits, and reopens a durable session report", async () => {
    const user = userEvent.setup();
    let saved: ReportDefinition | undefined;
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "list_reports") {
        return Promise.resolve({
          reports: saved
            ? [{
                reportRef: saved.reportRef,
                title: saved.title,
                locale: saved.locale,
                sourceSnapshotRef: saved.sourceSnapshotRef,
                revision: saved.revision,
              }]
            : [],
        });
      }
      if (command === "query_training_session_routes") {
        return Promise.resolve({ snapshotRef, sessionRef, routes: { exercises: [] } });
      }
      if (command === "create_composed_session_report") {
        saved = definition();
        return Promise.resolve(saved);
      }
      if (command === "update_composed_session_report") {
        saved = definition("2", "Ridge progression review");
        return Promise.resolve(saved);
      }
      if (command === "resolve_session_report") {
        return Promise.resolve(resolution(saved));
      }
      throw new Error(`Unexpected command: ${command} ${JSON.stringify(arguments_)}`);
    });

    const callbacks = renderPanel();
    expect(await screen.findByText("No reports have been saved yet. Open a training session to create the first one.")).toBeVisible();
    expect(screen.getByLabelText("Report title")).toHaveValue(
      "Training session · Aug 16, 2026, 8:30:00.000 AM",
    );

    await user.clear(screen.getByLabelText("Report title"));
    await user.click(screen.getByRole("button", { name: "Save report" }));
    expect(screen.getByLabelText("Report title")).toBeInvalid();
    expect(screen.getByLabelText(/^Your interpretation/)).toBeInvalid();
    expect(mocks.invoke).not.toHaveBeenCalledWith(
      "create_composed_session_report",
      expect.anything(),
    );

    await user.type(screen.getByLabelText("Report title"), "Ridge progression");
    await user.type(
      screen.getByLabelText(/^Your interpretation/),
      "Held the intended effort on every climb.",
    );
    await user.click(screen.getByRole("button", { name: "Save report" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "create_composed_session_report",
      {
        request: {
          title: "Ridge progression",
          locale: "en-US",
          sessionRef,
          sourceSnapshotRef: snapshotRef,
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
    expect(screen.getByText("Trail running")).toBeVisible();
    expect(screen.getByText("148 bpm")).toBeVisible();

    await user.clear(screen.getByLabelText("Report title"));
    await user.type(screen.getByLabelText("Report title"), "Ridge progression review");
    await user.clear(screen.getByLabelText(/^Your interpretation/));
    await user.type(
      screen.getByLabelText(/^Your interpretation/),
      "Held the intended effort and finished with control.",
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "update_composed_session_report",
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
    expect(await screen.findByText("Revision 2")).toBeVisible();

    const savedReports = screen.getByRole("heading", { name: "Saved reports" }).closest("aside");
    expect(savedReports).not.toBeNull();
    await user.click(within(savedReports!).getByRole("button", {
      name: /Ridge progression review/,
    }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenLastCalledWith(
      "resolve_session_report",
      { reportRef },
    ));
    await user.click(screen.getByRole("button", { name: "Back to the session" }));
    expect(callbacks.onReturnToOrigin).toHaveBeenCalledOnce();
  });

  it("reviews the complete privacy boundary and exports a reduced self-contained report", async () => {
    const user = userEvent.setup();
    const saved = definition();
    mocks.save.mockResolvedValue("/private/output/ridge-progression.html");
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_reports") {
        return Promise.resolve({ reports: [{
          reportRef,
          title: saved.title,
          locale: saved.locale,
          sourceSnapshotRef: snapshotRef,
          revision: saved.revision,
        }] });
      }
      if (command === "resolve_session_report") return Promise.resolve(resolution(saved));
      if (command === "query_training_session_routes") {
        return Promise.resolve({ snapshotRef, sessionRef, routes: { exercises: [] } });
      }
      if (command === "export_session_report") return Promise.resolve({ byteCount: "4096" });
      throw new Error(`Unexpected command: ${command}`);
    });

    renderPanel({ origin: undefined, originRequestId: 0 });
    await user.click(await screen.findByRole("button", { name: /Ridge progression/ }));
    await user.click(await screen.findByRole("button", { name: "Review and export" }));

    const review = screen.getByRole("region", { name: "Review the export" });
    expect(within(review).getByText(/Exact training samples are excluded/)).toBeVisible();
    expect(within(review).getByText(/written only to the location you choose/)).toBeVisible();
    await user.click(within(review).getByRole("checkbox", {
      name: /Include heart-rate summary in this export/,
    }));
    await user.click(within(review).getByRole("button", {
      name: "Choose destination and export",
    }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "export_session_report",
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
    expect(await screen.findByText("Self-contained HTML exported (4,096 bytes).")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Review the export" })).not.toBeInTheDocument();
  });

  it("adds, configures, reorders, previews, privacy-reviews, exports, and removes a route block", async () => {
    const user = userEvent.setup();
    let saved: ReportDefinition | undefined;
    mocks.save.mockResolvedValue("/private/output/routed-report.html");
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_reports") return Promise.resolve({ reports: saved
        ? [{
            reportRef,
            title: saved.title,
            locale: saved.locale,
            sourceSnapshotRef: snapshotRef,
            revision: saved.revision,
          }]
        : [] });
      if (command === "query_training_session_routes") return Promise.resolve(routeQueryResult());
      if (command === "create_composed_session_report") {
        saved = routedDefinition(0);
        return Promise.resolve(saved);
      }
      if (command === "update_composed_session_report") {
        saved = definition("2");
        return Promise.resolve(saved);
      }
      if (command === "resolve_session_report") {
        return Promise.resolve(saved?.blocks.some((block) => block.kind === "route")
          ? routedResolution(saved)
          : resolution(saved));
      }
      if (command === "export_session_report") return Promise.resolve({ byteCount: "8192" });
      throw new Error(`Unexpected command: ${command}`);
    });

    renderPanel();
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
    await user.type(
      screen.getByLabelText(/^Your interpretation/),
      "Held the intended effort on every climb.",
    );
    await user.click(screen.getByRole("button", { name: "Save report" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "create_composed_session_report",
      {
        request: {
          title: "Ridge progression",
          locale: "en-US",
          sessionRef,
          sourceSnapshotRef: snapshotRef,
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
      "export_session_report",
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

    await user.click(screen.getByRole("button", { name: "Remove route" }));
    expect(screen.queryByLabelText("Remove from each route endpoint (metres)")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "update_composed_session_report",
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
      if (command === "list_reports") return Promise.resolve({ reports: saved
        ? [{
            reportRef,
            title: saved.title,
            locale: saved.locale,
            sourceSnapshotRef: snapshotRef,
            revision: saved.revision,
          }]
        : [] });
      if (command === "query_training_session_routes") {
        return Promise.resolve({ snapshotRef, sessionRef, routes: { exercises: [] } });
      }
      if (command === "create_composed_session_report") {
        saved = analyticalDefinition();
        return Promise.resolve(saved);
      }
      if (command === "resolve_session_report") return Promise.resolve(analyticalResolution());
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
    await user.type(
      screen.getByLabelText(/^Your interpretation/),
      "Volume increased while measurement coverage also improved.",
    );

    await user.click(screen.getByRole("button", { name: "Save report" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose real, ordered dates of no more than 366 days",
    );
    expect(mocks.invoke).not.toHaveBeenCalledWith(
      "create_composed_session_report",
      expect.anything(),
    );
    await setDate("Baseline starts", "2026-01-01");
    await user.click(screen.getByRole("button", { name: "Save report" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "create_composed_session_report",
      {
        request: {
          title: "Winter training comparison",
          locale: "en-US",
          sessionRef,
          sourceSnapshotRef: snapshotRef,
          blocks: [
            { kind: "session-evidence", includePhysiologicalContext: true },
            {
              kind: "narrative",
              body: "Volume increased while measurement coverage also improved.",
            },
            { kind: "training-finding", query: comparisonQuery, metric: "energy" },
            { kind: "training-comparison", query: comparisonQuery },
            { kind: "training-chart", query: comparisonQuery, metric: "distance" },
            { kind: "training-exact-table", query: comparisonQuery },
            { kind: "training-coverage", query: comparisonQuery },
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
    expect(screen.getAllByText("68,500.75 m").length).toBeGreaterThan(0);
    expect(document.body.innerHTML).not.toContain("opaque-origin-that-must-not-be-rendered");
    await user.click(screen.getByRole("button", { name: "Review and export" }));
    const privacyReview = screen.getByRole("region", { name: "Review the export" });
    expect(within(privacyReview).getByText(/Selected period-comparison values/)).toBeVisible();
    await user.click(within(privacyReview).getByRole("button", { name: "Back to report" }));

    const savedReports = screen.getByRole("heading", { name: "Saved reports" }).closest("aside");
    await user.click(within(savedReports!).getByRole("button", {
      name: /Winter training comparison/,
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
      if (command === "list_reports") return Promise.resolve({ reports: [
        {
          reportRef,
          title: "Ridge progression",
          locale: "en-US",
          sourceSnapshotRef: snapshotRef,
          revision: "1",
        },
        {
          reportRef: `report-${digest("7")}`,
          title: "Recovery run",
          locale: "en-US",
          sourceSnapshotRef: snapshotRef,
          revision: "3",
        },
      ] });
      if (command === "resolve_session_report") return Promise.resolve(resolution());
      if (command === "query_training_session_routes") {
        return Promise.resolve({ snapshotRef, sessionRef, routes: { exercises: [] } });
      }
      if (command === "export_session_report") {
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

    const callbacks = renderPanel({ origin: undefined, originRequestId: 0 });
    expect(await screen.findByRole("button", { name: /Ridge progression/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Recovery run/ })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Ridge progression/ }));
    await user.click(await screen.findByRole("button", { name: "Review and export" }));
    await user.click(screen.getByRole("button", { name: "Choose destination and export" }));
    await user.click(await screen.findByRole("button", { name: "Cancel export" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The export was cancelled. No partial file was left behind.",
    );
    expect(callbacks.onError).toHaveBeenCalledWith("report-export-cancelled");
    expect(screen.queryByText(/Self-contained HTML exported/)).not.toBeInTheDocument();
  });

  it("blocks stale exports, reports failures, and presents the workflow in Spanish", async () => {
    const user = userEvent.setup();
    const stale = { ...resolution(), status: "stale" as const };
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_reports") return Promise.resolve({ reports: [] });
      if (command === "resolve_session_report") return Promise.resolve(stale);
      if (command === "query_training_session_routes") {
        return Promise.resolve({ snapshotRef, sessionRef, routes: { exercises: [] } });
      }
      if (command === "create_composed_session_report") {
        return Promise.reject({ code: "report-definition-update-failed" });
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const callbacks = renderPanel({
      locale: "es-ES",
      messages: catalogs["es-ES"],
    });
    expect(await screen.findByRole("heading", {
      name: "Convierte los datos registrados en algo que puedas utilizar",
    })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Añadir Hallazgo principal" }));
    expect(screen.getByLabelText("Inicio del periodo de referencia")).toHaveValue("2026-08-16");
    expect(screen.getByLabelText("Medición")).toHaveValue("session-count");
    expect(screen.getByText(/una única comparación versionada y compartida/)).toBeVisible();
    await user.type(screen.getByLabelText(/^Tu interpretación/), "Una sesión sostenida y controlada.");
    await user.click(screen.getByRole("button", { name: "Guardar informe" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "FitFreed no ha podido guardar el informe",
    );
    expect(callbacks.onError).toHaveBeenCalledWith("report-definition-update-failed");

    cleanup();
    mocks.invoke.mockImplementation((command) => {
      if (command === "list_reports") return Promise.resolve({ reports: [{
        reportRef,
        title: "Sesión sostenida",
        locale: "es-ES",
        sourceSnapshotRef: snapshotRef,
        revision: "1",
      }] });
      if (command === "resolve_session_report") return Promise.resolve({
        ...stale,
        definition: { ...stale.definition, title: "Sesión sostenida", locale: "es-ES" },
      });
      if (command === "query_training_session_routes") {
        return Promise.resolve({ snapshotRef, sessionRef, routes: { exercises: [] } });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    renderPanel({ locale: "es-ES", messages: catalogs["es-ES"], origin: undefined, originRequestId: 0 });
    await user.click(await screen.findByRole("button", { name: /Sesión sostenida/ }));
    expect(await screen.findByText(/La biblioteca de entrenamientos cambió/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Revisar y exportar" })).toBeDisabled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
