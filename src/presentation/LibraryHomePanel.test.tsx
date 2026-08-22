import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type { LibraryHome } from "./library-home";
import { LibraryHomePanel } from "./LibraryHomePanel";

const messages = catalogs["en-US"].home;

function populatedHome(overrides: Partial<LibraryHome> = {}): LibraryHome {
  return {
    version: 2,
    libraryRevisionRef: "library-home-revision-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
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
    training: {
      trainingSnapshotRef: "training-snapshot-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      sessionCount: 42,
      sportProfileCount: 4,
      omittedSportProfileCount: 0,
      sports: [
        {
          state: "classified",
          canonicalFamily: "running",
          displayLabel: "Road running",
          profileCount: 1,
          sessionCount: 22,
        },
        {
          state: "classified",
          canonicalFamily: "water-sport",
          displayLabel: "Kayaking",
          profileCount: 1,
          sessionCount: 12,
        },
        {
          state: "unknown",
          canonicalFamily: null,
          displayLabel: null,
          profileCount: 2,
          sessionCount: 8,
        },
      ],
      recentSessions: [
        {
          sessionRef: "training-session-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          startedAtLocal: "2026-08-17T18:30:00.000",
          durationMilliseconds: "3723000",
          distanceMeters: 12340,
          sportState: "classified",
          canonicalFamily: "running",
          displayLabel: "Road running",
        },
        {
          sessionRef: "training-session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          startedAtLocal: "2026-08-16T07:00:00.000",
          durationMilliseconds: "2700000",
          distanceMeters: null,
          sportState: "unknown",
          canonicalFamily: null,
          displayLabel: null,
        },
      ],
    },
    highlight: {
      kind: "recent-training-comparison",
      referenceDate: "2026-08-17",
      baseline: {
        range: { from: "2026-08-04", through: "2026-08-10" },
        sessionCount: 2,
        totalDurationMilliseconds: "5400000",
      },
      comparison: {
        range: { from: "2026-08-11", through: "2026-08-17" },
        sessionCount: 4,
        totalDurationMilliseconds: "10800000",
      },
      sessionCountChange: "2",
      durationChangeMilliseconds: "5400000",
    },
    postImport: null,
    resumableExploration: null,
    ...overrides,
  };
}

afterEach(cleanup);

describe("LibraryHomePanel", () => {
  it("leads with recognizable sports, a bounded recent comparison, and exact sessions", async () => {
    const user = userEvent.setup();
    const onOpenComparison = vi.fn();
    const onOpenSession = vi.fn();
    render(
      <LibraryHomePanel
        home={populatedHome()}
        locale="en-US"
        messages={messages}
        onExplore={vi.fn()}
        onOpenComparison={onOpenComparison}
        onOpenSession={onOpenSession}
        onOpenSources={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Your fitness history" })).toBeVisible();
    expect(screen.getByText("42 training sessions")).toBeVisible();
    expect(screen.getByText("4 sport profiles")).toBeVisible();
    const sports = screen.getByRole("region", { name: "Your sports" });
    expect(within(sports).getByText("Road running")).toBeVisible();
    expect(within(sports).getByText("Kayaking")).toBeVisible();
    expect(within(sports).getByText("Unclassified sport")).toBeVisible();
    expect(within(sports).getAllByTestId("sport-family-icon")).toHaveLength(3);

    const comparison = screen.getByRole("region", { name: "Last 7 days" });
    expect(comparison).toHaveTextContent("4 sessions");
    expect(comparison).toHaveTextContent("3 hr");
    expect(comparison).toHaveTextContent("Previous 7 days");
    await user.click(within(comparison).getByRole("button", { name: "Explore these 7 days" }));
    expect(onOpenComparison).toHaveBeenCalledWith(populatedHome().highlight);

    const recent = screen.getByRole("region", { name: "Recent sessions" });
    const roadRun = within(recent).getByRole("button", { name: /Open Road running/ });
    expect(roadRun).toHaveTextContent("Aug 17, 2026");
    expect(roadRun).toHaveTextContent("1 hr 2 min");
    expect(roadRun).toHaveTextContent("12.3 km");
    const unknown = within(recent).getByRole("button", { name: /Open Unclassified sport/ });
    expect(unknown).toHaveTextContent("45 min");
    expect(unknown).not.toHaveTextContent("km");
    await user.click(roadRun);
    expect(onOpenSession).toHaveBeenCalledWith(populatedHome().training?.recentSessions[0]);
  });

  it("offers every evidence-backed question and opens its exact destination", async () => {
    const user = userEvent.setup();
    const onExplore = vi.fn();
    render(
      <LibraryHomePanel
        home={populatedHome()}
        locale="en-US"
        messages={messages}
        onExplore={onExplore}
        onOpenComparison={vi.fn()}
        onOpenSession={vi.fn()}
        onOpenSources={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "What do you want to understand?" }))
      .toBeVisible();
    for (const question of populatedHome().questions) {
      await user.click(screen.getByRole("button", { name: messages.questions[question.kind] }));
    }
    expect(onExplore.mock.calls.map(([destination]) => destination)).toEqual([
      "training",
      "longitudinal",
      "activity",
      "sleep",
      "recovery",
    ]);
  });

  it("keeps source coverage subordinate and does not turn unavailable evidence into zero", async () => {
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
        onOpenComparison={vi.fn()}
        onOpenSession={vi.fn()}
        onOpenSources={onOpenSources}
      />,
    );

    const coverageDisclosure = screen.getByRole("group", { name: "Review usable history" });
    expect(coverageDisclosure).not.toHaveAttribute("open");
    await user.click(within(coverageDisclosure).getByText("Review usable history"));
    const coverage = within(coverageDisclosure).getByRole("region", { name: "Your usable history" });
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

  it("presents old, future-dated, and library-only history without implying recent performance", () => {
    const { rerender } = render(
      <LibraryHomePanel
        home={populatedHome({
          highlight: {
            kind: "historical-training",
            referenceDate: "2026-08-17",
            currentRange: { from: "2026-08-11", through: "2026-08-17" },
            latestSessionDate: "2024-01-02",
            reason: "no-current-training",
          },
        })}
        locale="en-US"
        messages={messages}
        onExplore={vi.fn()}
        onOpenComparison={vi.fn()}
        onOpenSession={vi.fn()}
        onOpenSources={vi.fn()}
      />,
    );
    expect(screen.getByRole("region", { name: "Training history" }))
      .toHaveTextContent("Latest training session: Jan 2, 2024");
    expect(screen.queryByText("Last 7 days")).not.toBeInTheDocument();

    rerender(
      <LibraryHomePanel
        home={populatedHome({
          training: null,
          highlight: { kind: "library-history", latestEvidenceDate: "2026-08-16" },
        })}
        locale="en-US"
        messages={messages}
        onExplore={vi.fn()}
        onOpenComparison={vi.fn()}
        onOpenSession={vi.fn()}
        onOpenSources={vi.fn()}
      />,
    );
    expect(screen.getByRole("region", { name: "Your local history" }))
      .toHaveTextContent("Latest available evidence: Aug 16, 2026");
  });

  it("makes a valid saved exploration resumable", async () => {
    const user = userEvent.setup();
    const onExplore = vi.fn();
    render(
      <LibraryHomePanel
        home={populatedHome({ resumableExploration: { version: 1, destination: "training" } })}
        locale="en-US"
        messages={messages}
        onExplore={onExplore}
        onOpenComparison={vi.fn()}
        onOpenSession={vi.fn()}
        onOpenSources={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Resume training exploration" }));
    expect(onExplore).toHaveBeenCalledWith("training", "resume:training");
  });

  it("keeps Home and stable actions visible while the exact destination opens", () => {
    render(
      <LibraryHomePanel
        home={populatedHome({ resumableExploration: { version: 1, destination: "training" } })}
        locale="en-US"
        messages={messages}
        pendingDestination="training"
        onExplore={vi.fn()}
        onOpenComparison={vi.fn()}
        onOpenSession={vi.fn()}
        onOpenSources={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "What do you want to understand?" }))
      .toBeVisible();
    expect(screen.getByRole("button", { name: "Explore my training sessions" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Resume training exploration" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Opening training exploration…");
  });

  it("reveals only meaningful canonical import changes and keeps limitations reachable", async () => {
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
            amendedObservations: 0,
            unchangedObservations: 11,
            sourceReviewRecommended: true,
          },
        })}
        locale="en-US"
        messages={messages}
        onExplore={vi.fn()}
        onOpenComparison={vi.fn()}
        onOpenSession={vi.fn()}
        onOpenSources={onOpenSources}
      />,
    );

    const reveal = screen.getByRole("status", { name: "Your library grew" });
    expect(reveal).toHaveTextContent("37 new observations");
    expect(reveal).toHaveTextContent("4 enriched observations");
    expect(reveal).toHaveTextContent("11 unchanged observations");
    expect(reveal).not.toHaveTextContent("amended");
    expect(reveal).toHaveTextContent("Source coverage details are available for review");
    await user.click(within(reveal).getByRole("button", { name: "Review source coverage" }));
    expect(onOpenSources).toHaveBeenCalledOnce();
  });

  it("describes unchanged and repeated imports without claiming that the library grew", () => {
    const unchangedHome = populatedHome({
      postImport: {
        exactRepeat: false,
        canonicalHistoryChanged: false,
        newObservations: 0,
        enrichedObservations: 0,
        amendedObservations: 0,
        unchangedObservations: 42,
        sourceReviewRecommended: false,
      },
    });
    const { rerender } = render(
      <LibraryHomePanel
        home={unchangedHome}
        locale="en-US"
        messages={messages}
        onExplore={vi.fn()}
        onOpenComparison={vi.fn()}
        onOpenSession={vi.fn()}
        onOpenSources={vi.fn()}
      />,
    );

    expect(screen.getByRole("status", { name: "Import complete" }))
      .not.toHaveTextContent("Your library grew");

    rerender(
      <LibraryHomePanel
        home={{
          ...unchangedHome,
          postImport: { ...unchangedHome.postImport!, exactRepeat: true },
        }}
        locale="en-US"
        messages={messages}
        onExplore={vi.fn()}
        onOpenComparison={vi.fn()}
        onOpenSession={vi.fn()}
        onOpenSources={vi.fn()}
      />,
    );

    expect(screen.getByRole("status", { name: "Already in your library" }))
      .toHaveTextContent("exact repeat");
  });

  it("presents truthful first-run value and sends both acquisition paths to Sources", async () => {
    const user = userEvent.setup();
    const onChooseArchive = vi.fn();
    const onOpenSourceGuide = vi.fn();
    render(
      <LibraryHomePanel
        home={{
          version: 2,
          libraryRevisionRef: "library-home-revision-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
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
          training: null,
          highlight: null,
          postImport: null,
          resumableExploration: null,
        }}
        locale="en-US"
        messages={messages}
        onExplore={vi.fn()}
        onOpenComparison={vi.fn()}
        onOpenSession={vi.fn()}
        onOpenSources={vi.fn()}
        onChooseArchive={onChooseArchive}
        onOpenSourceGuide={onOpenSourceGuide}
      />,
    );

    expect(screen.queryByRole("heading", { name: "What do you want to understand?" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Explore your fitness export on this device" }))
      .toBeVisible();
    const preview = screen.getByRole("region", { name: "One local history, across your sports" });
    expect(preview).toHaveTextContent("Illustrative preview — your history appears after import");
    expect(within(preview).getAllByRole("listitem")).toHaveLength(4);
    expect(within(preview).getByRole("listitem", { name: /Running/ }))
      .toHaveAttribute("data-sport-family", "running");
    expect(within(preview).getByRole("listitem", { name: /Water sport/ }))
      .toHaveAttribute("data-sport-family", "water-sport");
    expect(within(preview).getAllByTestId("sport-family-icon")).toHaveLength(4);

    await user.click(screen.getByRole("button", { name: "Choose an export ZIP" }));
    await user.click(screen.getByRole("button", { name: "How to obtain one" }));
    expect(onChooseArchive).toHaveBeenCalledOnce();
    expect(onOpenSourceGuide).toHaveBeenCalledOnce();
  });
});
