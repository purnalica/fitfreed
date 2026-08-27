import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type {
  PlannedTrainingChronologyPage,
  PlannedTrainingSessionRelationResult,
  PlannedTrainingTargetDetail,
  PlannedTrainingTargetSummary,
} from "./planned-training";
import {
  PlannedTrainingPanel,
  SessionPlannedTrainingPanel,
} from "./PlannedTrainingPanel";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

const plannedSnapshotRef = `planned-snapshot-${"a".repeat(64)}`;
const trainingSnapshotRef = `training-snapshot-${"b".repeat(64)}`;
const sessionRef = `session-${"c".repeat(64)}`;
const targetRef = `planned-target-${"d".repeat(64)}`;

const completedTarget: PlannedTrainingTargetSummary = {
  targetRef,
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
};

const pendingTarget: PlannedTrainingTargetSummary = {
  ...completedTarget,
  targetRef: `planned-target-${"e".repeat(64)}`,
  targetKind: {
    kind: "scheduled",
    scheduledAtLocal: "2026-08-30T09:00:00",
    completion: "pending",
  },
  name: "Long steady session",
  description: null,
  shape: {
    exerciseCount: 1,
    phaseCount: null,
    expandedPhaseCount: null,
    repeatBlockCount: null,
    containsIntensityEvidence: false,
  },
  relation: { state: "not-applicable", sessionRef: null, candidateCount: null },
};

const scheduledPage: PlannedTrainingChronologyPage = {
  snapshotRef: plannedSnapshotRef,
  totalCount: 2,
  offset: 0,
  limit: 25,
  nextOffset: null,
  targets: [pendingTarget, completedTarget],
};

const favoritePage: PlannedTrainingChronologyPage = {
  snapshotRef: plannedSnapshotRef,
  totalCount: 1,
  offset: 0,
  limit: 25,
  nextOffset: null,
  targets: [{
    ...pendingTarget,
    targetRef: `planned-target-${"f".repeat(64)}`,
    targetKind: {
      kind: "favorite-template",
      scheduledAtLocal: null,
      completion: null,
    },
    name: "Reusable intervals",
  }],
};

const detail: PlannedTrainingTargetDetail = {
  snapshotRef: plannedSnapshotRef,
  target: {
    summary: completedTarget,
    exercises: [{
      exerciseRef: `planned-exercise-${"1".repeat(64)}`,
      ordinal: 0,
      kind: "phased",
      durationGoalMilliseconds: "1680000",
      distanceGoalMeters: null,
      sport: {
        state: "recognized",
        recognition: {
          canonicalFamily: "water-sport",
          localizedNames: { en: "Kayaking", es: "Piragüismo" },
          catalogueRevision: "synthetic-2026-08-27",
          retrievedAtUtc: "2026-08-27T08:00:00Z",
          mappingVersion: "synthetic-sports@1",
          evidenceRef: `sport-evidence-${"2".repeat(64)}`,
        },
      },
      phases: [{
        phaseRef: `planned-phase-${"3".repeat(64)}`,
        ordinal: 0,
        name: "Work",
        goal: {
          kind: "duration",
          durationMilliseconds: "300000",
          distanceMeters: null,
        },
        intensity: {
          kind: "zone-range",
          metric: "heart-rate",
          lowerZone: 3,
          upperZone: 4,
        },
        transition: {
          transitionRef: `planned-transition-${"4".repeat(64)}`,
          change: "automatic",
          repeat: null,
        },
      }, {
        phaseRef: `planned-phase-${"5".repeat(64)}`,
        ordinal: 1,
        name: "Recovery",
        goal: {
          kind: "duration",
          durationMilliseconds: "120000",
          distanceMeters: null,
        },
        intensity: { kind: "none", metric: null, lowerZone: null, upperZone: null },
        transition: {
          transitionRef: `planned-transition-${"6".repeat(64)}`,
          change: "automatic",
          repeat: {
            repeatRef: `planned-repeat-${"7".repeat(64)}`,
            returnToPhaseOrdinal: 0,
            totalIterations: 4,
          },
        },
      }],
    }],
  },
};

afterEach(cleanup);

beforeEach(() => {
  mocks.invoke.mockReset();
});

describe("PlannedTrainingPanel", () => {
  it("focuses an externally requested plan after the previous workspace retained focus", async () => {
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_planned_training_chronology") {
        return Promise.resolve(scheduledPage);
      }
      if (command === "query_planned_training_target") {
        return Promise.resolve(detail);
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const previousWorkspaceControl = document.createElement("button");
    document.body.append(previousWorkspaceControl);
    previousWorkspaceControl.focus();

    render(
      <PlannedTrainingPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        openTargetRef={targetRef}
        navigationRequestId={1}
        onError={vi.fn()}
        onOpenSession={vi.fn()}
        onCreateReport={vi.fn()}
      />,
    );

    const heading = await screen.findByRole("heading", {
      name: "River intervals",
      level: 2,
    });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it("leads with useful plan shape, discloses exact phases, and returns to the linked session", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_planned_training_chronology") {
        expect(arguments_.query).toMatchObject({
          collection: "scheduled",
          completion: null,
          offset: 0,
          limit: 25,
          snapshotRef: null,
        });
        return Promise.resolve(scheduledPage);
      }
      if (command === "query_planned_training_target") {
        expect(arguments_.query).toEqual({ targetRef, snapshotRef: plannedSnapshotRef });
        return Promise.resolve(detail);
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const onOpenSession = vi.fn();
    const onCreateReport = vi.fn();
    const user = userEvent.setup();

    const view = render(
      <PlannedTrainingPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        onError={vi.fn()}
        onOpenSession={onOpenSession}
        onCreateReport={onCreateReport}
      />,
    );

    const card = (await screen.findByRole("heading", { name: "River intervals" }))
      .closest("li");
    expect(card).not.toBeNull();
    expect(within(card!).getByText("2 phases · 8 planned passes")).toBeVisible();
    const singleExerciseCard = screen.getByRole("heading", { name: "Long steady session" })
      .closest("li");
    expect(within(singleExerciseCard!).getByText("1 exercise")).toBeVisible();
    await user.click(within(card!).getByRole("button", { name: "Review River intervals" }));

    expect(await screen.findByRole("heading", { name: "River intervals", level: 2 }))
      .toBeVisible();
    expect(screen.getByText("Kayaking")).toBeVisible();
    expect(screen.getByText("Repeat blocks: 1")).toBeVisible();
    expect(within(screen.getByRole("heading", { name: "Plan sequence" }).parentElement!)
      .getByText("4 × phases 1–2")).toBeVisible();
    const exactDetails = screen.getByText("Exact phase definitions").closest("details");
    expect(exactDetails).not.toBeNull();
    expect(exactDetails).not.toHaveAttribute("open");
    await user.click(within(exactDetails!).getByText("Exact phase definitions"));
    expect(within(exactDetails!).getByText("Heart rate · zones 3–4")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Open recorded session" }));
    expect(onOpenSession).toHaveBeenCalledWith(sessionRef);
    await user.click(screen.getByRole("button", { name: "Create report from this plan" }));
    expect(onCreateReport).toHaveBeenCalledWith(detail);
    view.rerender(
      <PlannedTrainingPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        createReportFocusRequestId={2}
        onError={vi.fn()}
        onOpenSession={onOpenSession}
        onCreateReport={onCreateReport}
      />,
    );
    await waitFor(() => expect(screen.getByRole("button", {
      name: "Create report from this plan",
    })).toHaveFocus());
  });

  it("keeps reusable templates separate and sends only applicable filters", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command !== "query_planned_training_chronology") {
        throw new Error(`Unexpected command: ${command}`);
      }
      return Promise.resolve(
        arguments_.query.collection === "scheduled" ? scheduledPage : favoritePage,
      );
    });
    const user = userEvent.setup();
    render(
      <PlannedTrainingPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        onError={vi.fn()}
        onOpenSession={vi.fn()}
        onCreateReport={vi.fn()}
      />,
    );

    await screen.findByRole("heading", { name: "River intervals" });
    await user.click(screen.getByRole("button", { name: "Favorite templates" }));
    expect(await screen.findByRole("heading", { name: "Reusable intervals" })).toBeVisible();
    expect(mocks.invoke).toHaveBeenLastCalledWith(
      "query_planned_training_chronology",
      {
        query: {
          collection: "favorite-templates",
          completion: null,
          from: null,
          through: null,
          offset: 0,
          limit: 25,
          snapshotRef: null,
        },
      },
    );
  });

  it("keeps a long plan concise until exact phase detail is requested", async () => {
    const phases = Array.from({ length: 8 }, (_, index) => ({
      ...detail.target.exercises![0].phases![0],
      phaseRef: `planned-phase-${String(index + 1).repeat(64)}`,
      ordinal: index,
      name: `Phase ${index + 1}`,
      transition: {
        ...detail.target.exercises![0].phases![0].transition,
        transitionRef: `planned-transition-${String(index + 1).repeat(64)}`,
      },
    }));
    const longDetail: PlannedTrainingTargetDetail = {
      ...detail,
      target: {
        ...detail.target,
        exercises: [{ ...detail.target.exercises![0], phases }],
      },
    };
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_planned_training_chronology") return Promise.resolve(scheduledPage);
      if (command === "query_planned_training_target") return Promise.resolve(longDetail);
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    render(
      <PlannedTrainingPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        onError={vi.fn()}
        onOpenSession={vi.fn()}
        onCreateReport={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Review River intervals" }));
    const preview = screen.getByRole("heading", { name: "Plan sequence" }).parentElement!;
    expect(within(preview).getAllByRole("listitem")).toHaveLength(6);
    expect(within(preview).getByText("2 more phase definitions are available below."))
      .toBeVisible();
    const exactDetails = screen.getByText("Exact phase definitions").closest("details")!;
    expect(within(exactDetails).getAllByRole("listitem", { hidden: true })).toHaveLength(8);
    expect(exactDetails).not.toHaveAttribute("open");
  });

  it("names pagination controls and preserves the chronology snapshot", async () => {
    const firstPage = {
      ...scheduledPage,
      totalCount: 26,
      nextOffset: 25,
    };
    const secondPage = {
      ...scheduledPage,
      totalCount: 26,
      offset: 25,
      nextOffset: null,
      targets: [completedTarget],
    };
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command !== "query_planned_training_chronology") {
        throw new Error(`Unexpected command: ${command}`);
      }
      return Promise.resolve(arguments_.query.offset === 0 ? firstPage : secondPage);
    });
    const user = userEvent.setup();

    render(
      <PlannedTrainingPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        onError={vi.fn()}
        onOpenSession={vi.fn()}
        onCreateReport={vi.fn()}
      />,
    );

    const pagination = await screen.findByRole("navigation", { name: "Training plan pages" });
    expect(within(pagination).getByRole("button", { name: "Previous page" })).toBeDisabled();
    await user.click(within(pagination).getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenLastCalledWith(
      "query_planned_training_chronology",
      {
        query: expect.objectContaining({
          offset: 25,
          snapshotRef: plannedSnapshotRef,
        }),
      },
    ));
    expect(within(pagination).getByRole("button", { name: "Previous page" })).toBeEnabled();
  });
});

describe("SessionPlannedTrainingPanel", () => {
  it("shows an exact imported plan as intent and opens it without claiming compliance", async () => {
    const relation: PlannedTrainingSessionRelationResult = {
      snapshotRef: plannedSnapshotRef,
      trainingSnapshotRef,
      sessionRef,
      relation: {
        state: "exact",
        targetRef,
        candidateTargetCount: null,
        candidateSessionCount: null,
      },
      candidates: [completedTarget],
    };
    mocks.invoke.mockResolvedValueOnce(relation);
    const onOpenTarget = vi.fn();
    const user = userEvent.setup();

    render(
      <SessionPlannedTrainingPanel
        sessionRef={sessionRef}
        trainingSnapshotRef={trainingSnapshotRef}
        locale="en-US"
        messages={catalogs["en-US"]}
        onError={vi.fn()}
        onOpenTarget={onOpenTarget}
      />,
    );

    expect(await screen.findByRole("heading", { name: "River intervals" })).toBeVisible();
    expect(screen.getByText("Imported workout plan")).toBeVisible();
    expect(screen.getByText("Plan and recording are separate evidence.")).toBeVisible();
    expect(screen.queryByText(/followed the plan/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review imported plan" }));
    expect(onOpenTarget).toHaveBeenCalledWith(targetRef);
  });

  it("states ambiguity without selecting a target and offers each candidate", async () => {
    const second = { ...completedTarget, targetRef: `planned-target-${"9".repeat(64)}`, name: "Alternative plan" };
    mocks.invoke.mockResolvedValueOnce({
      snapshotRef: plannedSnapshotRef,
      trainingSnapshotRef,
      sessionRef,
      relation: {
        state: "ambiguous",
        targetRef: null,
        candidateTargetCount: 2,
        candidateSessionCount: 1,
      },
      candidates: [completedTarget, second],
    } satisfies PlannedTrainingSessionRelationResult);

    render(
      <SessionPlannedTrainingPanel
        sessionRef={sessionRef}
        trainingSnapshotRef={trainingSnapshotRef}
        locale="en-US"
        messages={catalogs["en-US"]}
        onError={vi.fn()}
        onOpenTarget={vi.fn()}
      />,
    );

    expect(await screen.findByText("Two imported plans have the same exact source relationship."))
      .toBeVisible();
    expect(screen.getAllByRole("button", { name: /Review/ })).toHaveLength(2);
  });

  it("renders a quiet, explicit absent state", async () => {
    mocks.invoke.mockResolvedValueOnce({
      snapshotRef: plannedSnapshotRef,
      trainingSnapshotRef,
      sessionRef,
      relation: {
        state: "absent",
        targetRef: null,
        candidateTargetCount: null,
        candidateSessionCount: null,
      },
      candidates: [],
    } satisfies PlannedTrainingSessionRelationResult);

    render(
      <SessionPlannedTrainingPanel
        sessionRef={sessionRef}
        trainingSnapshotRef={trainingSnapshotRef}
        locale="es-ES"
        messages={catalogs["es-ES"]}
        onError={vi.fn()}
        onOpenTarget={vi.fn()}
      />,
    );

    expect(await screen.findByText(
      "No hay ningún plan importado relacionado de forma exacta con esta sesión.",
    )).toBeVisible();
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "query_session_planned_training_relation",
      {
        query: {
          sessionRef,
          trainingSnapshotRef,
          snapshotRef: null,
        },
      },
    ));
  });
});
