import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type { LibraryHome } from "./library-home";
import { LibraryHomePanel } from "./LibraryHomePanel";

const messages = catalogs["en-US"].home;
const presentationUnits = {
  durationUnits: catalogs["en-US"].training.durationUnits,
  distanceUnits: catalogs["en-US"].training.units,
};

function populatedHome(overrides: Partial<LibraryHome> = {}): LibraryHome {
  return {
    version: 9,
    libraryRevisionRef: "library-home-revision-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    recordedRange: { from: "2024-01-02", through: "2026-08-17" },
    usableRange: { from: "2024-01-02", through: "2026-08-17" },
    primaryRange: {
      scope: "training",
      range: { from: "2024-01-02", through: "2026-08-17" },
    },
    domains: [
      {
        domain: "training",
        recordedRange: { from: "2024-01-02", through: "2026-08-17" },
        usableRange: { from: "2024-01-02", through: "2026-08-17" },
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
        recordedRange: { from: "2024-01-02", through: "2026-08-17" },
        usableRange: { from: "2024-01-02", through: "2026-08-17" },
        selectedRange: { from: "2026-07-19", through: "2026-08-17" },
        originCount: 1,
        observedRecordCount: 30,
        measurements: [
          { measurement: "activity-steps", availableRecords: 29, observedRecords: 30 },
        ],
      },
      {
        domain: "sleep",
        recordedRange: { from: "2025-01-01", through: "2026-08-16" },
        usableRange: { from: "2025-01-01", through: "2026-08-16" },
        selectedRange: { from: "2026-07-18", through: "2026-08-16" },
        originCount: 1,
        observedRecordCount: 28,
        measurements: [
          { measurement: "sleep-duration", availableRecords: 28, observedRecords: 28 },
        ],
      },
      {
        domain: "recovery",
        recordedRange: { from: "2025-01-01", through: "2026-08-16" },
        usableRange: { from: "2025-01-01", through: "2026-08-16" },
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
      sportCollectionCount: 4,
      omittedSportCollectionCount: 0,
      sports: [
        {
          sessionFilterRefs: [`sport-${"1".repeat(64)}`],
          sportRef: "sport-local-running",
          state: "personally-overridden",
          canonicalFamily: "running",
          displayLabel: "Road running",
          localizedNames: {},
          recognitionCandidateCount: 0,
          representedCollectionCount: 1,
          sessionCount: 22,
        },
        {
          sessionFilterRefs: [`sport-${"2".repeat(64)}`],
          sportRef: "sport-local-kayaking",
          state: "personally-overridden",
          canonicalFamily: "water-sport",
          displayLabel: "Kayaking",
          localizedNames: {},
          recognitionCandidateCount: 0,
          representedCollectionCount: 1,
          sessionCount: 12,
        },
        {
          sessionFilterRefs: [`sport-${"3".repeat(64)}`],
          sportRef: "sport-local-unknown-a",
          state: "unknown",
          canonicalFamily: null,
          displayLabel: null,
          localizedNames: {},
          recognitionCandidateCount: 0,
          representedCollectionCount: 1,
          sessionCount: 5,
        },
        {
          sessionFilterRefs: [`sport-${"4".repeat(64)}`],
          sportRef: "sport-local-unknown-b",
          state: "unknown",
          canonicalFamily: null,
          displayLabel: null,
          localizedNames: {},
          recognitionCandidateCount: 0,
          representedCollectionCount: 1,
          sessionCount: 3,
        },
      ],
      recentSessions: [
        {
          sessionRef: "training-session-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          sportRef: "sport-local-running",
          startedAtLocal: "2026-08-17T18:30:00.000",
          durationMilliseconds: "3723000",
          distanceMeters: 12340,
          sportState: "personally-overridden",
          canonicalFamily: "running",
          displayLabel: "Road running",
          localizedNames: {},
          recognitionCandidateCount: 0,
        },
        {
          sessionRef: "training-session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          sportRef: "sport-local-unknown-b",
          startedAtLocal: "2026-08-16T07:00:00.000",
          durationMilliseconds: "2700000",
          distanceMeters: null,
          sportState: "unknown",
          canonicalFamily: null,
          displayLabel: null,
          localizedNames: {},
          recognitionCandidateCount: 0,
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
  it("uses localized provider recognition on Home and recent sessions", () => {
    const home = populatedHome();
    home.training = {
      ...home.training!,
      sportCollectionCount: 1,
      sports: [{
        sessionFilterRefs: [`sport-${"2".repeat(64)}`],
        sportRef: "sport-local-kayaking",
        state: "recognized",
        canonicalFamily: "water-sport",
        displayLabel: null,
        localizedNames: { en: "Kayaking", "es-ES": "Piragüismo" },
        recognitionCandidateCount: 1,
        representedCollectionCount: 1,
        sessionCount: 12,
      }],
      recentSessions: [{
        sessionRef: "training-session-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        sportRef: "sport-local-kayaking",
        startedAtLocal: "2026-08-17T18:30:00.000",
        durationMilliseconds: "3723000",
        distanceMeters: 12340,
        sportState: "recognized",
        canonicalFamily: "water-sport",
        displayLabel: null,
        localizedNames: { en: "Kayaking", "es-ES": "Piragüismo" },
        recognitionCandidateCount: 1,
      }],
    };

    render(
      <LibraryHomePanel
        {...presentationUnits}
        home={home}
        locale="es-ES"
        messages={catalogs["es-ES"].home}
        onExplore={vi.fn()}
        onOpenComparison={vi.fn()}
        onOpenSession={vi.fn()}
        onOpenSources={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Piragüismo")).toHaveLength(2);
    const icons = screen.getAllByTestId("sport-family-icon");
    expect(icons.every((icon) => icon.getAttribute("data-sport-icon") === "water-sport"))
      .toBe(true);
    expect(screen.queryByRole("button", { name: /Nombrar Piragüismo/ }))
      .not.toBeInTheDocument();
  });

  it("leads with recognizable sports, a bounded recent comparison, and exact sessions", async () => {
    const user = userEvent.setup();
    const onOpenComparison = vi.fn();
    const onOpenSession = vi.fn();
    const onOpenTrainingSessions = vi.fn();
    const onOpenSports = vi.fn();
    const onOpenSportSessions = vi.fn();
    render(
      <LibraryHomePanel
        {...presentationUnits}
        home={populatedHome()}
        locale="en-US"
        messages={messages}
        onExplore={vi.fn()}
        onOpenComparison={onOpenComparison}
        onOpenSession={onOpenSession}
        onOpenTrainingSessions={onOpenTrainingSessions}
        onOpenSports={onOpenSports}
        onOpenSportSessions={onOpenSportSessions}
        onOpenSources={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Your fitness history" })).toBeVisible();
    const sessionSummary = screen.getByRole("button", { name: "42 training sessions" });
    const sportSummary = screen.getByRole("button", { name: "4 recorded sport types" });
    await user.click(sessionSummary);
    await user.click(sportSummary);
    expect(onOpenTrainingSessions).toHaveBeenCalledOnce();
    expect(onOpenSports).toHaveBeenCalledOnce();
    expect(screen.getByText("Training history")).toBeVisible();
    expect(screen.getByLabelText(/Training history: Jan 2, 2024/)).toBeVisible();
    const sports = screen.getByRole("region", { name: "Your sports" });
    expect(within(sports).getByText("Road running")).toBeVisible();
    expect(within(sports).getByText("Kayaking")).toBeVisible();
    expect(within(sports).getByText("Unknown sport 1")).toBeVisible();
    expect(within(sports).getByText("Unknown sport 2")).toBeVisible();
    expect(within(sports).getAllByTestId("sport-family-icon")).toHaveLength(4);
    await user.click(within(sports).getByRole("button", {
      name: "View sessions for Road running",
    }));
    expect(onOpenSportSessions).toHaveBeenCalledWith(populatedHome().training!.sports[0]);

    const comparison = screen.getByRole("region", { name: "Last 7 days" });
    expect(comparison).toHaveTextContent("4 sessions");
    expect(comparison).toHaveTextContent("3 h");
    expect(comparison).toHaveTextContent("Previous 7 days");
    await user.click(within(comparison).getByRole("button", { name: "Explore these 7 days" }));
    expect(onOpenComparison).toHaveBeenCalledWith(populatedHome().highlight);

    const recent = screen.getByRole("region", { name: "Recent sessions" });
    const roadRun = within(recent).getByRole("button", { name: /Open Road running/ });
    expect(roadRun).toHaveTextContent("Aug 17, 2026");
    expect(roadRun).toHaveTextContent("1 h 2 min");
    expect(roadRun).toHaveTextContent("12.3 km");
    const unknown = within(recent).getByRole("button", { name: /Open Unknown sport 2/ });
    expect(unknown).toHaveTextContent("45 min");
    expect(unknown).not.toHaveTextContent("km");
    await user.click(roadRun);
    expect(onOpenSession).toHaveBeenCalledWith(populatedHome().training?.recentSessions[0]);
  });

  it("does not style empty training summaries as destinations", () => {
    const home = populatedHome();
    home.training = {
      ...home.training!,
      sessionCount: 0,
      sportCollectionCount: 0,
      sports: [],
      recentSessions: [],
    };

    render(
      <LibraryHomePanel
        {...presentationUnits}
        home={home}
        locale="en-US"
        messages={messages}
        onExplore={vi.fn()}
        onOpenComparison={vi.fn()}
        onOpenSession={vi.fn()}
        onOpenTrainingSessions={vi.fn()}
        onOpenSports={vi.fn()}
        onOpenSources={vi.fn()}
      />,
    );

    expect(screen.getByText("0 training sessions")).toBeVisible();
    expect(screen.getByText("0 recorded sport types")).toBeVisible();
    expect(screen.queryByRole("button", { name: "0 training sessions" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "0 recorded sport types" }))
      .not.toBeInTheDocument();
  });

  it("opens the complete sport collection from the bounded omitted count", async () => {
    const home = populatedHome();
    home.training = {
      ...home.training!,
      sportCollectionCount: 7,
      omittedSportCollectionCount: 3,
    };
    const onOpenSports = vi.fn();
    const user = userEvent.setup();
    render(
      <LibraryHomePanel
        {...presentationUnits}
        home={home}
        locale="en-US"
        messages={messages}
        onExplore={vi.fn()}
        onOpenComparison={vi.fn()}
        onOpenSession={vi.fn()}
        onOpenSports={onOpenSports}
        onOpenSources={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "View 3 more sport types" }));

    expect(onOpenSports).toHaveBeenCalledWith("sports:omitted");
  });

  it("keeps unresolved profiles distinct and opens the existing classification task exactly", async () => {
    const user = userEvent.setup();
    const onOpenSportClassification = vi.fn();
    render(
      <LibraryHomePanel
        {...presentationUnits}
        home={populatedHome()}
        locale="en-US"
        messages={messages}
        onExplore={vi.fn()}
        onOpenComparison={vi.fn()}
        onOpenSession={vi.fn()}
        onOpenSources={vi.fn()}
        onOpenSportClassification={onOpenSportClassification}
      />,
    );

    const sports = screen.getByRole("region", { name: "Your sports" });
    const first = within(sports).getByRole("button", { name: "Name Unknown sport 1" });
    const second = within(sports).getByRole("button", { name: "Name Unknown sport 2" });
    expect(first).toHaveTextContent("Name this sport");
    expect(second).toHaveTextContent("Name this sport");

    await user.click(second);
    expect(onOpenSportClassification).toHaveBeenCalledWith("sport-local-unknown-b");
  });

  it("uses the same concise identity when a session does not record a sport", () => {
    const home = populatedHome();
    const unavailableSession = {
      ...home.training!.recentSessions[0],
      sportRef: null,
      sportState: "unavailable" as const,
      canonicalFamily: null,
      displayLabel: null,
    };
    render(
      <LibraryHomePanel
        {...presentationUnits}
        home={{
          ...home,
          training: {
            ...home.training!,
            recentSessions: [unavailableSession],
          },
        }}
        locale="en-US"
        messages={messages}
        onExplore={vi.fn()}
        onOpenComparison={vi.fn()}
        onOpenSession={vi.fn()}
        onOpenSources={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Open Sport not recorded/ })).toBeVisible();
  });

  it("offers every evidence-backed question and opens its exact destination", async () => {
    const user = userEvent.setup();
    const onExplore = vi.fn();
    render(
      <LibraryHomePanel
        {...presentationUnits}
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
    expect(screen.getByText(
      "Choose a question to open an answer based on your recorded data.",
    )).toBeVisible();
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
    const onExplore = vi.fn();
    const home = populatedHome({
      domains: [
        populatedHome().domains[0],
        {
          domain: "activity",
          recordedRange: null,
          usableRange: null,
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
        {...presentationUnits}
        home={home}
        locale="en-US"
        messages={messages}
        onExplore={onExplore}
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
    expect(within(coverage).queryByRole("button", { name: "Explore Activity" }))
      .not.toBeInTheDocument();
    await user.click(within(coverage).getByRole("button", { name: "Explore Training" }));
    expect(onExplore).toHaveBeenCalledWith("training", "coverage:training");

    await user.click(within(coverage).getByRole("button", { name: "Review source coverage" }));
    expect(onOpenSources).toHaveBeenCalledOnce();
  });

  it("presents old, future-dated, and library-only history without implying recent performance", () => {
    const { rerender } = render(
      <LibraryHomePanel
        {...presentationUnits}
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
        {...presentationUnits}
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
      .toHaveTextContent("Latest recorded date: Aug 16, 2026");
  });

  it("makes a valid saved exploration resumable", async () => {
    const user = userEvent.setup();
    const onExplore = vi.fn();
    render(
      <LibraryHomePanel
        {...presentationUnits}
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
        {...presentationUnits}
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

  it("keeps import accounting after personal value and source detail one deliberate action away", async () => {
    const user = userEvent.setup();
    const onOpenSources = vi.fn();
    render(
      <LibraryHomePanel
        {...presentationUnits}
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

    const reveal = screen.getByRole("status", { name: "Import complete" });
    const personalResults = [
      screen.getByRole("region", { name: "Your sports" }),
      screen.getByRole("region", { name: "Last 7 days" }),
      screen.getByRole("region", { name: "Recent sessions" }),
    ];
    for (const result of personalResults) {
      expect(result.compareDocumentPosition(reveal) & Node.DOCUMENT_POSITION_FOLLOWING)
        .toBeTruthy();
    }
    expect(reveal).toHaveTextContent("Your imported history is ready to explore");
    expect(reveal).not.toHaveTextContent("observations");
    expect(within(reveal).queryByRole("button", { name: "Review source coverage" }))
      .not.toBeInTheDocument();

    const coverageDisclosure = screen.getByRole("group", { name: "Review usable history" });
    await user.click(within(coverageDisclosure).getByText("Review usable history"));
    await user.click(within(coverageDisclosure).getByRole("button", {
      name: "Review source coverage",
    }));
    expect(onOpenSources).toHaveBeenCalledOnce();
  });

  it("describes unchanged and repeated imports without implying new usable history", () => {
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
        {...presentationUnits}
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
      .toHaveTextContent("No new usable history was found");
    expect(screen.getByRole("status", { name: "Import complete" }))
      .not.toHaveTextContent("ready to explore");

    rerender(
      <LibraryHomePanel
        {...presentationUnits}
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
        {...presentationUnits}
        home={{
          version: 9,
          libraryRevisionRef: "library-home-revision-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          recordedRange: null,
          usableRange: null,
          primaryRange: null,
          domains: ["training", "activity", "sleep", "recovery"].map((domain) => ({
            domain: domain as "training" | "activity" | "sleep" | "recovery",
            recordedRange: null,
            usableRange: null,
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
    expect(preview).toHaveTextContent(
      "The available views adapt to the data recorded in your export.",
    );
    expect(within(preview).getAllByRole("listitem")).toHaveLength(4);
    expect(within(preview).getByRole("listitem", { name: /Running/ }))
      .toHaveAttribute("data-sport-family", "running");
    expect(within(preview).getByRole("listitem", { name: /Water sport/ }))
      .toHaveAttribute("data-sport-family", "water-sport");
    expect(within(preview).getByRole("listitem", { name: /Water sport/ }))
      .toHaveTextContent("Recorded tracks and point-by-point data");
    expect(within(preview).getAllByTestId("sport-family-icon")).toHaveLength(4);

    await user.click(screen.getByRole("button", { name: "Choose an export ZIP" }));
    await user.click(screen.getByRole("button", { name: "How to obtain one" }));
    expect(onChooseArchive).toHaveBeenCalledOnce();
    expect(onOpenSourceGuide).toHaveBeenCalledOnce();
  });

  it("prevents a second archive selection while an import owns the operation", async () => {
    const user = userEvent.setup();
    const onChooseArchive = vi.fn();
    render(
      <LibraryHomePanel
        {...presentationUnits}
        home={{
          ...populatedHome(),
          recordedRange: null,
          usableRange: null,
          primaryRange: null,
          training: null,
          highlight: null,
          questions: [],
        }}
        locale="en-US"
        messages={messages}
        acquisitionActionsDisabled
        onExplore={vi.fn()}
        onOpenComparison={vi.fn()}
        onOpenSession={vi.fn()}
        onOpenSources={vi.fn()}
        onChooseArchive={onChooseArchive}
      />,
    );

    const chooseArchive = screen.getByRole("button", { name: "Choose an export ZIP" });
    const openGuide = screen.getByRole("button", { name: "How to obtain one" });
    expect(chooseArchive).toBeDisabled();
    expect(openGuide).toBeDisabled();
    await user.click(chooseArchive);
    await user.click(openGuide);
    expect(onChooseArchive).not.toHaveBeenCalled();
  });

  it("distinguishes retained source evidence from a usable first-run library", async () => {
    const user = userEvent.setup();
    const onOpenSources = vi.fn();
    const onChooseArchive = vi.fn();
    render(
      <LibraryHomePanel
        {...presentationUnits}
        home={{
          ...populatedHome(),
          usableRange: null,
          primaryRange: null,
          training: null,
          highlight: null,
          questions: [],
          domains: populatedHome().domains.map((domain) => ({
            ...domain,
            usableRange: null,
            selectedRange: null,
            measurements: domain.measurements.map((measurement) => ({
              ...measurement,
              availableRecords: 0,
            })),
          })),
        }}
        locale="en-US"
        messages={messages}
        onExplore={vi.fn()}
        onOpenComparison={vi.fn()}
        onOpenSession={vi.fn()}
        onOpenSources={onOpenSources}
        onChooseArchive={onChooseArchive}
      />,
    );

    expect(screen.getByRole("heading", { name: "Imported records need source review" }))
      .toBeVisible();
    expect(screen.queryByRole("heading", { name: "Explore your fitness export on this device" }))
      .not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review import coverage" }));
    await user.click(screen.getByRole("button", { name: "Choose an export ZIP" }));
    expect(onOpenSources).toHaveBeenCalledOnce();
    expect(onChooseArchive).toHaveBeenCalledOnce();
  });
});
