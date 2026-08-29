import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import { TrainingInsightsPanel } from "./TrainingInsightsPanel";

vi.mock("./TrainingSessionLibraryPanel", () => ({
  TrainingSessionLibraryPanel: (properties: {
    classificationChange?: {
      requestId: number;
      result: { overview: { sports: Array<{ classification: { displayLabel: string } }> } };
    };
    onSportClassificationChange: (result: unknown) => void;
    sportSessionsNavigation?: {
      sessionFilterRefs: string[];
      returnSessionFilterRef?: string;
      returnWorkspace: "home" | "sports";
    };
    resetWorkspaceRequestId?: number;
    onReturnToSports: (sessionFilterRef: string) => void;
    onOpenPlannedTraining: (targetRef: string) => void;
  }) => (
    <section aria-label="Session child">
      <button
        type="button"
        onClick={() => properties.onSportClassificationChange({
          outcome: "changed",
          overview: {
            originCount: 1,
            sessionCount: 1,
            sports: [{ classification: { displayLabel: "River paddling" } }],
          },
        })}
      >
        Save in sessions
      </button>
      <output data-testid="session-change">
        {properties.classificationChange
          ? `${properties.classificationChange.requestId}:${properties.classificationChange.result.overview.sports[0].classification.displayLabel}`
          : "none"}
      </output>
      <output data-testid="session-filter">
        {properties.sportSessionsNavigation?.sessionFilterRefs.join(",") ?? "none"}
      </output>
      <output data-testid="session-reset-request">
        {properties.resetWorkspaceRequestId ?? "none"}
      </output>
      <button
        type="button"
        onClick={() => properties.onReturnToSports(
          properties.sportSessionsNavigation?.returnSessionFilterRef ?? "missing",
        )}
      >
        Return to sports child
      </button>
      <button
        type="button"
        onClick={() => properties.onOpenPlannedTraining(
          `planned-target-${"b".repeat(64)}`,
        )}
      >
        Open linked plan
      </button>
    </section>
  ),
}));

vi.mock("./PlannedTrainingPanel", () => ({
  PlannedTrainingPanel: (properties: {
    openTargetRef?: string;
    createReportFocusRequestId?: number;
    onOpenSession: (sessionRef: string) => void;
    onCreateReport: (target: unknown) => void;
  }) => (
    <section aria-label="Plans child">
      <output data-testid="open-plan-ref">{properties.openTargetRef ?? "none"}</output>
      <output data-testid="plan-report-focus">
        {properties.createReportFocusRequestId ?? "none"}
      </output>
      <button
        type="button"
        onClick={() => properties.onOpenSession(`session-${"c".repeat(64)}`)}
      >
        Open linked session
      </button>
      <button
        type="button"
        onClick={() => properties.onCreateReport({
          snapshotRef: `planned-snapshot-${"d".repeat(64)}`,
          target: { summary: { targetRef: `planned-target-${"b".repeat(64)}` } },
        })}
      >
        Create plan report
      </button>
    </section>
  ),
}));

vi.mock("./TrainingSportsPanel", () => ({
  TrainingSportsPanel: (properties: {
    openSportRef?: string;
    classificationChange?: {
      requestId: number;
      result: { overview: { sports: Array<{ classification: { displayLabel: string } }> } };
    };
    onChange: (result: unknown) => void;
    onOpenSessions: (sport: {
      sessionFilterRef: string;
      memberSessionFilterRefs: string[];
    }) => void;
    sessionReturnFocus?: { sessionFilterRef: string; requestId: number };
  }) => (
    <section aria-label="Sports child">
      <output data-testid="open-sport-ref">{properties.openSportRef ?? "none"}</output>
      <button
        type="button"
        onClick={() => properties.onChange({
          outcome: "changed",
          overview: {
            originCount: 1,
            sessionCount: 1,
            sports: [{ classification: { displayLabel: "Trail running" } }],
          },
        })}
      >
        Save in sports
      </button>
      <output data-testid="sports-change">
        {properties.classificationChange
          ? `${properties.classificationChange.requestId}:${properties.classificationChange.result.overview.sports[0].classification.displayLabel}`
          : "none"}
      </output>
      <output data-testid="sport-return-focus">
        {properties.sessionReturnFocus?.sessionFilterRef ?? "none"}
      </output>
      <button
        type="button"
        onClick={() => properties.onOpenSessions({
          sessionFilterRef: `sport-${"a".repeat(64)}`,
          memberSessionFilterRefs: [
            `sport-${"b".repeat(64)}`,
            `sport-${"c".repeat(64)}`,
          ],
        })}
      >
        Open sport sessions
      </button>
    </section>
  ),
}));

vi.mock("./TrainingComparisonPanel", () => ({
  TrainingComparisonPanel: () => null,
}));

afterEach(cleanup);

describe("TrainingInsightsPanel", () => {
  it("opens every collection in a unified sport and returns to its projected Sports origin", async () => {
    const user = userEvent.setup();
    render(
      <TrainingInsightsPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        navigationRequest={{ kind: "sports", requestId: 1 }}
        onCreateReport={vi.fn()}
        onError={vi.fn()}
        onSportClassificationChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open sport sessions" }));
    expect(screen.getByRole("button", { name: "Sessions" }))
      .toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("session-filter"))
      .toHaveTextContent([
        `sport-${"b".repeat(64)}`,
        `sport-${"c".repeat(64)}`,
      ].join(","));

    await user.click(screen.getByRole("button", { name: "Return to sports child" }));
    expect(screen.getByRole("button", { name: "Sports" }))
      .toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("sport-return-focus"))
      .toHaveTextContent(`sport-${"a".repeat(64)}`);
  });

  it("opens the Sports workspace for an exact contextual classification request", () => {
    render(
      <TrainingInsightsPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        navigationRequest={{
          kind: "sport",
          sportRef: "sport-local-unknown",
          requestId: 7,
        }}
        onCreateReport={vi.fn()}
        onError={vi.fn()}
        onSportClassificationChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Sports" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("open-sport-ref")).toHaveTextContent("sport-local-unknown");
  });

  it("honors explicit complete-session, sport, and plan workspace requests", () => {
    const common = {
      locale: "en-US" as const,
      messages: catalogs["en-US"],
      refreshToken: 0,
      onCreateReport: vi.fn(),
      onError: vi.fn(),
      onSportClassificationChange: vi.fn(),
    };
    const view = render(
      <TrainingInsightsPanel
        {...common}
        navigationRequest={{ kind: "sports", requestId: 8 }}
      />,
    );

    expect(screen.getByRole("button", { name: "Sports" }))
      .toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("open-sport-ref")).toHaveTextContent("none");

    view.rerender(
      <TrainingInsightsPanel
        {...common}
        navigationRequest={{ kind: "sessions", requestId: 9 }}
      />,
    );
    expect(screen.getByRole("button", { name: "Sessions" }))
      .toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("session-reset-request")).toHaveTextContent("9");

    view.rerender(
      <TrainingInsightsPanel
        {...common}
        navigationRequest={{ kind: "plans", requestId: 10 }}
      />,
    );
    expect(screen.getByRole("button", { name: "Plans" }))
      .toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("region", { name: "Plans child" })).toBeVisible();
  });

  it("broadcasts each classification to both workspaces and the application owner", async () => {
    const onSportClassificationChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TrainingInsightsPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        onCreateReport={vi.fn()}
        onError={vi.fn()}
        onSportClassificationChange={onSportClassificationChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save in sessions" }));
    expect(screen.getByTestId("session-change")).toHaveTextContent("1:River paddling");
    expect(screen.getByTestId("sports-change")).toHaveTextContent("1:River paddling");

    await user.click(screen.getByRole("button", { name: "Sports" }));
    await user.click(screen.getByRole("button", { name: "Save in sports" }));
    expect(screen.getByTestId("session-change")).toHaveTextContent("2:Trail running");
    expect(screen.getByTestId("sports-change")).toHaveTextContent("2:Trail running");
    expect(onSportClassificationChange).toHaveBeenCalledTimes(2);
  });

  it("moves naturally between an exact recorded session and its imported plan", async () => {
    const user = userEvent.setup();
    render(
      <TrainingInsightsPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        onCreateReport={vi.fn()}
        onError={vi.fn()}
        onSportClassificationChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open linked plan" }));
    expect(screen.getByRole("button", { name: "Plans" }))
      .toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("open-plan-ref"))
      .toHaveTextContent(`planned-target-${"b".repeat(64)}`);

    await user.click(screen.getByRole("button", { name: "Open linked session" }));
    expect(screen.getByRole("button", { name: "Sessions" }))
      .toHaveAttribute("aria-current", "page");
  });

  it("starts a report from the exact planned target and restores its report action", async () => {
    const onCreateReport = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <TrainingInsightsPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        navigationRequest={{
          kind: "planned-training",
          targetRef: `planned-target-${"b".repeat(64)}`,
          requestId: 11,
        }}
        onCreateReport={onCreateReport}
        onError={vi.fn()}
        onSportClassificationChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Plans" }))
      .toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("button", { name: "Create plan report" }));
    expect(onCreateReport).toHaveBeenCalledWith({
      kind: "planned-training",
      snapshotRef: `planned-snapshot-${"d".repeat(64)}`,
      target: {
        snapshotRef: `planned-snapshot-${"d".repeat(64)}`,
        target: { summary: { targetRef: `planned-target-${"b".repeat(64)}` } },
      },
    });

    view.rerender(
      <TrainingInsightsPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        reportReturnFocusRequest={{ kind: "planned-training", requestId: 12 }}
        onCreateReport={onCreateReport}
        onError={vi.fn()}
        onSportClassificationChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("plan-report-focus")).toHaveTextContent("12");
  });
});
