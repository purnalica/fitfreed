import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type { LibraryHome } from "./library-home";
import { LibraryHomePanel } from "./LibraryHomePanel";

const messages = catalogs["en-US"].home;

function populatedHome(overrides: Partial<LibraryHome> = {}): LibraryHome {
  return {
    availableRange: { from: "2024-01-02", through: "2026-08-17" },
    domains: [
      {
        domain: "training",
        availableRange: { from: "2024-01-02", through: "2026-08-17" },
        selectedRange: { from: "2026-07-19", through: "2026-08-17" },
        originCount: 1,
        observedRecordCount: 42,
        measurements: [
          { measurement: "training-duration", availableRecords: 42, observedRecords: 42 },
          { measurement: "training-distance", availableRecords: 31, observedRecords: 42 },
        ],
      },
      {
        domain: "activity",
        availableRange: { from: "2024-01-02", through: "2026-08-17" },
        selectedRange: { from: "2026-07-19", through: "2026-08-17" },
        originCount: 1,
        observedRecordCount: 30,
        measurements: [
          { measurement: "activity-steps", availableRecords: 29, observedRecords: 30 },
        ],
      },
      {
        domain: "sleep",
        availableRange: { from: "2025-01-01", through: "2026-08-16" },
        selectedRange: { from: "2026-07-18", through: "2026-08-16" },
        originCount: 1,
        observedRecordCount: 28,
        measurements: [
          { measurement: "sleep-duration", availableRecords: 28, observedRecords: 28 },
        ],
      },
      {
        domain: "recovery",
        availableRange: { from: "2025-01-01", through: "2026-08-16" },
        selectedRange: { from: "2026-07-18", through: "2026-08-16" },
        originCount: 1,
        observedRecordCount: 12,
        measurements: [
          {
            measurement: "recovery-beat-to-beat-interval",
            availableRecords: 12,
            observedRecords: 12,
          },
        ],
      },
    ],
    questions: [
      { kind: "explore-training-sessions", destination: "training" },
      { kind: "align-history", destination: "longitudinal" },
      { kind: "review-activity-steps", destination: "activity" },
      { kind: "review-sleep-patterns", destination: "sleep" },
      { kind: "review-recovery-patterns", destination: "recovery" },
    ],
    postImport: null,
    resumableExploration: null,
    ...overrides,
  };
}

afterEach(cleanup);

describe("LibraryHomePanel", () => {
  it("offers every evidence-backed question and opens its exact destination", async () => {
    const user = userEvent.setup();
    const onExplore = vi.fn();
    render(
      <LibraryHomePanel
        home={populatedHome()}
        locale="en-US"
        messages={messages}
        onExplore={onExplore}
        onOpenSources={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "What do you want to understand?" }))
      .toBeVisible();
    const firstAnswer = screen.getByRole("region", { name: "42 recent training sessions are ready to inspect" });
    expect(firstAnswer).toHaveTextContent("Jan 2, 2024 – Aug 17, 2026");
    await user.click(within(firstAnswer).getByRole("button", { name: "Explore this answer" }));
    for (const question of populatedHome().questions) {
      await user.click(screen.getByRole("button", { name: messages.questions[question.kind] }));
    }
    expect(onExplore.mock.calls.map(([destination]) => destination)).toEqual([
      "training",
      "training",
      "longitudinal",
      "activity",
      "sleep",
      "recovery",
    ]);
  });

  it("summarizes coverage without turning unavailable evidence into zero", async () => {
    const user = userEvent.setup();
    const onOpenSources = vi.fn();
    const home = populatedHome({
      domains: [
        populatedHome().domains[0],
        {
          domain: "activity",
          availableRange: null,
          selectedRange: null,
          originCount: 0,
          observedRecordCount: 0,
          measurements: [],
        },
        ...populatedHome().domains.slice(2),
      ],
    });
    render(
      <LibraryHomePanel
        home={home}
        locale="en-US"
        messages={messages}
        onExplore={vi.fn()}
        onOpenSources={onOpenSources}
      />,
    );

    const coverage = screen.getByRole("region", { name: "Your usable history" });
    expect(within(coverage).getByText("Jan 2, 2024 – Aug 17, 2026")).toBeVisible();
    expect(within(coverage).getByRole("listitem", { name: /Training/ }))
      .toHaveTextContent("42 records");
    expect(within(coverage).getByRole("listitem", { name: /Activity/ }))
      .toHaveTextContent("Not available");
    expect(within(coverage).getByRole("listitem", { name: /Activity/ }))
      .not.toHaveTextContent("0 records");

    await user.click(within(coverage).getByRole("button", { name: "Review source coverage" }));
    expect(onOpenSources).toHaveBeenCalledOnce();
  });

  it("makes a valid saved exploration resumable", async () => {
    const user = userEvent.setup();
    const onExplore = vi.fn();
    render(
      <LibraryHomePanel
        home={populatedHome({
          resumableExploration: { version: 1, destination: "training" },
        })}
        locale="en-US"
        messages={messages}
        onExplore={onExplore}
        onOpenSources={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Resume training exploration" }));
    expect(onExplore).toHaveBeenCalledWith("training");
  });

  it("keeps Home and stable actions visible while the exact destination opens", () => {
    render(
      <LibraryHomePanel
        home={populatedHome({
          resumableExploration: { version: 1, destination: "training" },
        })}
        locale="en-US"
        messages={messages}
        pendingDestination="training"
        onExplore={vi.fn()}
        onOpenSources={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "What do you want to understand?" }))
      .toBeVisible();
    expect(screen.getByRole("button", { name: "Explore my training sessions" }))
      .toBeDisabled();
    expect(screen.getByRole("button", { name: "Resume training exploration" }))
      .toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Opening training exploration…");
  });

  it("reveals canonical import value and keeps limitations reachable", async () => {
    const user = userEvent.setup();
    const onOpenSources = vi.fn();
    render(
      <LibraryHomePanel
        home={populatedHome({
          postImport: {
            exactRepeat: false,
            canonicalHistoryChanged: true,
            newObservations: 37,
            enrichedObservations: 4,
            amendedObservations: 2,
            sourceReviewRecommended: true,
          },
        })}
        locale="en-US"
        messages={messages}
        onExplore={vi.fn()}
        onOpenSources={onOpenSources}
      />,
    );

    const reveal = screen.getByRole("status", { name: "Your library grew" });
    expect(reveal).toHaveTextContent("37 new observations");
    expect(reveal).toHaveTextContent("4 enriched observations");
    expect(reveal).toHaveTextContent("2 amended observations");
    expect(reveal).toHaveTextContent("Some source coverage needs your attention");
    await user.click(within(reveal).getByRole("button", { name: "Review source coverage" }));
    expect(onOpenSources).toHaveBeenCalledOnce();
  });

  it("presents truthful first-run value and sends both acquisition paths to Sources", async () => {
    const user = userEvent.setup();
    const onOpenSources = vi.fn();
    render(
      <LibraryHomePanel
        home={{
          availableRange: null,
          domains: ["training", "activity", "sleep", "recovery"].map((domain) => ({
            domain: domain as "training" | "activity" | "sleep" | "recovery",
            availableRange: null,
            selectedRange: null,
            originCount: 0,
            observedRecordCount: 0,
            measurements: [],
          })),
          questions: [],
          postImport: null,
          resumableExploration: null,
        }}
        locale="en-US"
        messages={messages}
        onExplore={vi.fn()}
        onOpenSources={onOpenSources}
      />,
    );

    expect(screen.queryByRole("heading", { name: "What do you want to understand?" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Start with your own history" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Turn an export into something useful" }))
      .toBeVisible();
    expect(screen.getByText(/Find remembered sessions, sports, routes, intervals/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add a fitness export" }));
    await user.click(screen.getByRole("button", { name: "Learn how to get an export" }));
    expect(onOpenSources).toHaveBeenCalledTimes(2);
  });
});
