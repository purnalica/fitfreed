import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import { SportUnificationTask } from "./SportUnificationTask";
import type {
  SavedUnifiedSportRelationship,
  TrainingSport,
  TrainingSportsOverview,
} from "./training-sports";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

function sport(
  suffix: string,
  state: TrainingSport["state"],
  name: string,
  sessionCount: number,
): TrainingSport {
  const sessionFilterRef = `sport-${suffix.repeat(64)}`;
  return {
    sessionFilterRef,
    memberSessionFilterRefs: [sessionFilterRef],
    sportRef: state === "unavailable" ? null : `sport-local-${suffix}`,
    sourceIndex: 1,
    state,
    classification: state === "personally-overridden"
      ? {
          scope: "unresolved-source-profile",
          canonicalFamily: "running",
          displayLabel: name,
          authorship: "user",
          revision: 1,
        }
      : state === "unknown"
      ? {
          scope: "unresolved-source-profile",
          canonicalFamily: null,
          displayLabel: null,
          authorship: null,
          revision: 0,
        }
      : null,
    recognition: state === "recognized"
      ? {
          canonicalFamily: "water-sport",
          localizedNames: { en: name },
          catalogueRevision: "synthetic-catalogue-v1",
          retrievedAtUtc: "2026-08-29T10:00:00Z",
          mappingVersion: "synthetic-mapping-v1",
          evidenceRef: `sport-evidence-${suffix.repeat(64)}`,
        }
      : null,
    recognitionCandidateCount: state === "recognized" ? 1 : 0,
    unification: null,
    firstLocalDate: "2026-01-01",
    lastLocalDate: "2026-02-01",
    coverage: {
      sessionCount,
      totalDurationMilliseconds: String(sessionCount * 3_600_000),
      distanceSessionCount: sessionCount,
      heartRateSessionCount: sessionCount,
    },
  };
}

const recognized = sport("a", "recognized", "Kayaking", 4);
const unknown = sport("b", "unknown", "Unknown sport 1", 3);
const named = sport("c", "personally-overridden", "Trail running", 2);

function overview(
  sports: TrainingSport[] = [recognized, unknown, named],
  sportCollections: TrainingSport[] = sports,
): TrainingSportsOverview {
  return {
    snapshotRef: `training-snapshot-${"d".repeat(64)}`,
    originCount: 1,
    sessionCount: sportCollections.reduce(
      (total, candidate) => total + candidate.coverage.sessionCount,
      0,
    ),
    sports,
    sportCollections,
    unificationReviews: [],
  };
}

afterEach(cleanup);

beforeEach(() => {
  mocks.invoke.mockReset();
});

describe("SportUnificationTask", () => {
  it("previews exact affected coverage and saves an explicit relationship", async () => {
    const current = overview();
    const saved: SavedUnifiedSportRelationship = {
      outcome: "changed",
      overview: current,
    };
    mocks.invoke.mockResolvedValueOnce(saved);
    const onSaved = vi.fn();
    const user = userEvent.setup();

    render(
      <SportUnificationTask
        overview={current}
        sport={recognized}
        messages={catalogs["en-US"].training.sports.unification}
        locale="en-US"
        titleFor={(candidate) => candidate === unknown ? "Unknown sport 1" : candidate === named
          ? "Trail running"
          : "Kayaking"}
        onCancel={vi.fn()}
        onBusyChange={vi.fn()}
        onError={vi.fn()}
        onOverviewChange={vi.fn()}
        onSaved={onSaved}
      />,
    );

    expect(screen.getByRole("button", { name: "Save combined sport" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Unknown sport 1 · 3 sessions" }));
    expect(screen.getByText("2 groups will appear as one sport across 7 sessions.")).toBeVisible();
    expect(screen.getByText("The combined sport will use the identity “Kayaking”.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save combined sport" }));

    expect(mocks.invoke).toHaveBeenCalledWith("save_unified_sport_relationship", {
      request: {
        expectedSnapshotRef: current.snapshotRef,
        expectedRevision: 0,
        relationshipRef: null,
        primarySessionFilterRef: recognized.sessionFilterRef,
        members: [{
          sessionFilterRef: recognized.sessionFilterRef,
          sessionCount: 4,
        }, {
          sessionFilterRef: unknown.sessionFilterRef,
          sessionCount: 3,
        }],
      },
    });
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it("revises precedence and removes only the saved relationship after explicit review", async () => {
    const relationshipRef = `unified:${recognized.sessionFilterRef}`;
    const combined: TrainingSport = {
      ...recognized,
      sessionFilterRef: relationshipRef,
      memberSessionFilterRefs: [recognized.sessionFilterRef, named.sessionFilterRef],
      unification: {
        relationshipRef,
        primarySessionFilterRef: recognized.sessionFilterRef,
        memberSessionFilterRefs: [recognized.sessionFilterRef, named.sessionFilterRef],
        authorship: "user",
        revision: 1,
      },
      coverage: {
        ...recognized.coverage,
        sessionCount: 6,
      },
    };
    const current = overview([combined, unknown], [recognized, named, unknown]);
    const revised: SavedUnifiedSportRelationship = {
      outcome: "changed",
      overview: current,
    };
    const removed: SavedUnifiedSportRelationship = {
      outcome: "removed",
      overview: overview(),
    };
    mocks.invoke
      .mockResolvedValueOnce(revised)
      .mockResolvedValueOnce(removed);
    const user = userEvent.setup();

    render(
      <SportUnificationTask
        overview={current}
        sport={combined}
        messages={catalogs["en-US"].training.sports.unification}
        locale="en-US"
        titleFor={(candidate) => candidate.sessionFilterRef === named.sessionFilterRef
          ? "Trail running"
          : candidate.sessionFilterRef === unknown.sessionFilterRef
          ? "Unknown sport 1"
          : "Kayaking"}
        onCancel={vi.fn()}
        onBusyChange={vi.fn()}
        onError={vi.fn()}
        onOverviewChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    const identity = screen.getByRole("group", {
      name: "Identity to show for the combined sport",
    });
    await user.click(within(identity).getByRole("radio", { name: "Trail running" }));
    await user.click(screen.getByRole("button", { name: "Save combined sport" }));
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, "save_unified_sport_relationship", {
      request: expect.objectContaining({
        expectedRevision: 1,
        relationshipRef,
        primarySessionFilterRef: named.sessionFilterRef,
      }),
    });

    await user.click(screen.getByRole("button", { name: "Separate these groups" }));
    expect(screen.getByText(/Only this combination will be removed/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Keep as separate groups" }));
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, "remove_unified_sport_relationship", {
      request: {
        expectedSnapshotRef: current.snapshotRef,
        relationshipRef,
        expectedRevision: 1,
      },
    });
  });

  it("keeps the draft when a concurrent change reloads the current collections", async () => {
    const current = overview();
    const latest = { ...current, snapshotRef: `training-snapshot-${"e".repeat(64)}` };
    mocks.invoke.mockImplementation((command) => {
      if (command === "save_unified_sport_relationship") {
        return Promise.reject({ code: "sport-unification-conflict" });
      }
      if (command === "query_training_sports") return Promise.resolve(latest);
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    render(
      <SportUnificationTask
        overview={current}
        sport={recognized}
        messages={catalogs["en-US"].training.sports.unification}
        locale="en-US"
        titleFor={(candidate) => candidate === unknown ? "Unknown sport 1" : candidate === named
          ? "Trail running"
          : "Kayaking"}
        onCancel={vi.fn()}
        onBusyChange={vi.fn()}
        onError={vi.fn()}
        onOverviewChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Unknown sport 1 · 3 sessions" }));
    await user.click(screen.getByRole("button", { name: "Save combined sport" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The represented sports changed while this draft was open.",
    );
    expect(screen.getByRole("checkbox", { name: "Unknown sport 1 · 3 sessions" })).toBeChecked();
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, "query_training_sports");
  });
});
