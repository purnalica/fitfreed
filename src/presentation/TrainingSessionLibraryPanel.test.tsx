import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type {
  TrainingDiscoveryWorkspace,
  TrainingSessionCalendar,
  TrainingSessionSearchItem,
  TrainingSessionSearchPage,
  TrainingSessionSearchRequest,
} from "./training-session-search";
import { TrainingSessionLibraryPanel } from "./TrainingSessionLibraryPanel";
import type { TrainingSportsOverview } from "./training-sports";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

const snapshotRef = `training-snapshot-${"a".repeat(64)}`;

function emptyWorkspaceCommand(command: string, arguments_: unknown) {
  if (command === "load_training_discovery_workspace") return Promise.resolve(null);
  if (command === "save_training_discovery_workspace") {
    return Promise.resolve((arguments_ as { workspace: TrainingDiscoveryWorkspace }).workspace);
  }
  return undefined;
}

const sports: TrainingSportsOverview = {
  originCount: 2,
  sessionCount: 26,
  sports: [
    {
      sportRef: `sport-${"c".repeat(64)}`,
      sourceIndex: 1,
      state: "classified",
      classification: {
        canonicalFamily: "running",
        displayLabel: "Trail running",
        authorship: "user",
        revision: 1,
      },
      firstLocalDate: "2024-01-01",
      lastLocalDate: "2026-08-18",
      coverage: {
        sessionCount: 25,
        totalDurationMilliseconds: "90000000",
        distanceSessionCount: 24,
        heartRateSessionCount: 23,
      },
    },
    {
      sportRef: `sport-${"d".repeat(64)}`,
      sourceIndex: 2,
      state: "unknown",
      classification: {
        canonicalFamily: null,
        displayLabel: null,
        authorship: null,
        revision: 0,
      },
      firstLocalDate: "2025-01-01",
      lastLocalDate: "2026-01-01",
      coverage: {
        sessionCount: 1,
        totalDurationMilliseconds: "1800000",
        distanceSessionCount: 0,
        heartRateSessionCount: 0,
      },
    },
  ],
};

function session(
  token: string,
  startedAtLocal: string,
  sourceIndex = 1,
): TrainingSessionSearchItem {
  return {
    sessionRef: `session-${token.repeat(64)}`,
    sourceIndex,
    startedAtLocal,
    stoppedAtLocal: `${startedAtLocal.slice(0, 11)}08:30:00`,
    utcOffsetMinutes: 120,
    durationMilliseconds: "3600000",
    distanceMeters: 10000.5,
    energyKilocalories: "650",
    averageHeartRateBpm: "145",
    maximumHeartRateBpm: "175",
    exerciseCount: 1,
    sport: {
      sportRef: sports.sports[0].sportRef,
      state: "classified",
      classification: sports.sports[0].classification,
    },
  };
}

const newest = session("b", "2026-08-18T07:30:00");
const second = session("e", "2026-08-17T07:30:00");
const oldest = session("f", "2024-01-01T07:30:00");

const calendar: TrainingSessionCalendar = {
  availableRange: { from: "2024-01-01", through: "2026-08-18" },
  snapshotRef,
  month: "2026-08",
  days: [
    {
      localDate: "2026-08-17",
      sourceIndex: 1,
      sessionCount: 1,
      totalDurationMilliseconds: "3600000",
      distanceSessionCount: 1,
      totalDistanceMeters: 10000.5,
      heartRateSessionCount: 1,
    },
    {
      localDate: "2026-08-18",
      sourceIndex: 1,
      sessionCount: 1,
      totalDurationMilliseconds: "3600000",
      distanceSessionCount: 1,
      totalDistanceMeters: 10000.5,
      heartRateSessionCount: 1,
    },
  ],
};

function page(
  sessions: TrainingSessionSearchItem[],
  offset: number,
  totalCount: number,
  nextOffset: number | null,
): TrainingSessionSearchPage {
  return {
    availableRange: { from: "2024-01-01", through: "2026-08-18" },
    snapshotRef,
    totalCount,
    offset,
    limit: 25,
    nextOffset,
    summaries: totalCount === 0 ? [] : [{
      sourceIndex: 1,
      trainingDays: totalCount === 1 ? 1 : 25,
      sessionCount: totalCount,
      totalDurationMilliseconds: totalCount === 1 ? "3600000" : "91800000",
      distanceSessionCount: totalCount === 1 ? 1 : 25,
      totalDistanceMeters: totalCount === 1 ? 10000.5 : 250012.5,
      energySessionCount: totalCount === 1 ? 1 : 24,
      totalEnergyKilocalories: totalCount === 1 ? "650" : "15600",
      heartRateSessionCount: totalCount === 1 ? 1 : 23,
    }],
    sessions,
  };
}

function renderPanel(onError = vi.fn()) {
  const onAvailableRange = vi.fn();
  render(
    <TrainingSessionLibraryPanel
      locale="en-US"
      messages={catalogs["en-US"]}
      refreshToken={0}
      onAvailableRange={onAvailableRange}
      onError={onError}
    />,
  );
  return { onAvailableRange, onError };
}

afterEach(cleanup);

beforeEach(() => {
  mocks.invoke.mockReset();
});

describe("TrainingSessionLibraryPanel", () => {
  it("switches chronology and calendar, selects comparisons, and returns to the exact calendar origin", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_session_calendar") {
        const month = arguments_.request.month as string;
        return Promise.resolve({
          ...calendar,
          month,
          days: month === "2026-08" ? calendar.days : [],
        });
      }
      if (command === "query_training_sessions") {
        const request = arguments_.request as TrainingSessionSearchRequest;
        if (request.from === "2026-08-18" && request.through === "2026-08-18") {
          return Promise.resolve(page([newest], 0, 1, null));
        }
        return Promise.resolve(page([newest, second], 0, 26, 25));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();
    const region = await screen.findByRole("region", { name: "Find a training session" });

    await user.click(within(region).getByRole("checkbox", {
      name: /Add .*18.*comparison/,
    }));
    await user.click(within(region).getByRole("checkbox", {
      name: /Add .*17.*comparison/,
    }));
    const comparison = within(region).getByRole("region", { name: "Session comparison" });
    expect(comparison).toHaveTextContent("2 sessions selected");
    expect(within(comparison).getByRole("table")).toHaveTextContent("10,000.5 m");
    await user.click(within(comparison).getByRole("button", { name: "Clear comparison" }));
    expect(within(region).queryByRole("region", { name: "Session comparison" }))
      .not.toBeInTheDocument();

    await user.click(within(region).getByRole("radio", { name: "Calendar" }));
    expect(await within(region).findByRole("heading", { name: "August 2026" })).toBeVisible();
    expect(within(region).getByRole("button", {
      name: /August 18, 2026.*1 session/,
    })).toHaveTextContent("Source 1");
    expect(mocks.invoke).toHaveBeenCalledWith("query_training_session_calendar", {
      request: {
        month: "2026-08",
        from: null,
        through: null,
        sportRefs: [],
        requiredMeasurements: [],
        text: null,
        snapshotRef,
      },
    });
    await user.click(within(region).getByRole("button", { name: "Previous month" }));
    expect(await within(region).findByRole("heading", { name: "July 2026" })).toBeVisible();
    await user.click(within(region).getByRole("button", { name: "Next month" }));
    await user.click(await within(region).findByRole("button", {
      name: /August 18, 2026.*1 session/,
    }));
    expect(await within(region).findByText("1–1 of 1 matching sessions")).toBeVisible();
    expect(mocks.invoke).toHaveBeenCalledWith("query_training_sessions", {
      request: expect.objectContaining({
        from: "2026-08-18",
        through: "2026-08-18",
        offset: 0,
      }),
    });
    await user.click(within(region).getByRole("button", { name: /View session details for/ }));
    expect(within(region).getByRole("heading", { name: "Session summary" })).toBeVisible();
    await user.click(within(region).getByRole("button", { name: "Back to calendar" }));
    expect(within(region).getByRole("heading", { name: "August 2026" })).toBeVisible();
    expect(within(region).queryByRole("heading", { name: "Session summary" }))
      .not.toBeInTheDocument();
    await user.click(within(region).getByRole("radio", { name: "Chronology" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("query_training_sessions", {
      request: expect.objectContaining({
        from: null,
        through: null,
        offset: 0,
        snapshotRef,
      }),
    }));
    expect(await within(region).findByText("1–2 of 26 matching sessions")).toBeVisible();
  });

  it("opens the calendar inside the applied search window", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        return Promise.resolve(page([oldest], 0, 1, null));
      }
      if (command === "query_training_session_calendar") {
        const month = arguments_.request.month as string;
        return Promise.resolve({ ...calendar, month, days: [] });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();
    const region = await screen.findByRole("region", { name: "Find a training session" });

    await user.type(within(region).getByLabelText("From date"), "2024-01-01");
    await user.type(within(region).getByLabelText("Through date"), "2024-01-31");
    await user.click(within(region).getByRole("button", { name: "Apply filters" }));
    await user.click(within(region).getByRole("radio", { name: "Calendar" }));

    expect(await within(region).findByRole("heading", { name: "January 2024" })).toBeVisible();
    expect(mocks.invoke).toHaveBeenCalledWith("query_training_session_calendar", {
      request: expect.objectContaining({
        month: "2024-01",
        from: "2024-01-01",
        through: "2024-01-31",
      }),
    });
  });

  it("keeps an open calendar inside a newly applied search window", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        return Promise.resolve(page([oldest], 0, 1, null));
      }
      if (command === "query_training_session_calendar") {
        const month = arguments_.request.month as string;
        return Promise.resolve({ ...calendar, month, days: [] });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();
    const region = await screen.findByRole("region", { name: "Find a training session" });

    await user.click(within(region).getByRole("radio", { name: "Calendar" }));
    expect(await within(region).findByRole("heading", { name: "August 2026" })).toBeVisible();
    await user.type(within(region).getByLabelText("From date"), "2024-01-01");
    await user.type(within(region).getByLabelText("Through date"), "2024-01-31");
    await user.click(within(region).getByRole("button", { name: "Apply filters" }));

    expect(await within(region).findByRole("heading", { name: "January 2024" })).toBeVisible();
    expect(mocks.invoke).toHaveBeenCalledWith("query_training_session_calendar", {
      request: expect.objectContaining({
        month: "2024-01",
        from: "2024-01-01",
        through: "2024-01-31",
      }),
    });
  });

  it("filters real fields, paginates a stable snapshot, and opens and closes exact summary detail", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        const request = arguments_.request as TrainingSessionSearchRequest;
        if (request.offset === 25) return Promise.resolve(page([oldest], 25, 26, null));
        if (request.text === "Trail") return Promise.resolve(page([newest], 0, 1, null));
        return Promise.resolve(page([newest, second], 0, 26, 25));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    const { onAvailableRange, onError } = renderPanel();

    const region = await screen.findByRole("region", { name: "Find a training session" });
    expect(within(region).getByText("1–2 of 26 matching sessions")).toBeVisible();
    const completeSummary = within(region).getByRole("list", { name: "Training summary" });
    expect(completeSummary).toHaveTextContent("26 sessions");
    expect(completeSummary).toHaveTextContent("25 training days");
    expect(completeSummary).toHaveTextContent("25 h 30 min");
    expect(completeSummary).toHaveTextContent("Recorded distance · 25 of 26");
    expect(completeSummary).toHaveTextContent("Recorded energy · 24 of 26");
    expect(completeSummary).toHaveTextContent("23 of 26");
    expect(within(region).getAllByText("Trail running")).not.toHaveLength(0);
    expect(region).not.toHaveTextContent("sport-");
    expect(region).not.toHaveTextContent("session-");
    expect(onAvailableRange).toHaveBeenCalledWith({
      from: "2024-01-01",
      through: "2026-08-18",
    });

    await user.type(within(region).getByLabelText("From date"), "2025-01-01");
    await user.type(within(region).getByLabelText("Through date"), "2026-08-18");
    await user.type(
      within(region).getByRole("textbox", {
        name: /^Your sport name contains/,
      }),
      " Trail ",
    );
    await user.click(within(region).getByRole("checkbox", { name: "Trail running" }));
    await user.click(within(region).getByRole("checkbox", { name: "Distance" }));
    await user.click(within(region).getByRole("checkbox", { name: "Energy" }));
    await user.click(within(region).getByRole("checkbox", { name: "Heart rate" }));
    await user.selectOptions(within(region).getByLabelText("Order"), "distance-desc");
    await user.click(within(region).getByRole("button", { name: "Apply filters" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "query_training_sessions",
      {
        request: {
          from: "2025-01-01",
          through: "2026-08-18",
          sportRefs: [sports.sports[0].sportRef],
          requiredMeasurements: ["distance", "energy", "heart-rate"],
          text: "Trail",
          sort: "distance-desc",
          offset: 0,
          limit: 25,
          snapshotRef: null,
        },
      },
    ));
    expect(await within(region).findByText("1–1 of 1 matching sessions")).toBeVisible();
    const filteredSummary = within(region).getByRole("list", { name: "Training summary" });
    expect(filteredSummary).toHaveTextContent("1 session");
    expect(filteredSummary).toHaveTextContent("1 training day");
    expect(filteredSummary).toHaveTextContent("1 h");

    await user.click(within(region).getByRole("button", { name: /View session details for/ }));
    const detail = within(region).getByRole("heading", { name: "Session summary" })
      .closest("section");
    expect(detail).not.toBeNull();
    expect(detail).toHaveTextContent("10,000.5 m");
    expect(detail).toHaveTextContent("650 kcal");
    expect(detail).toHaveTextContent("145 bpm");
    expect(detail).toHaveTextContent("175 bpm");
    expect(detail).toHaveTextContent("UTC+02:00");
    await user.click(within(detail!).getByRole("button", { name: "Back to session results" }));
    expect(within(region).queryByRole("heading", { name: "Session summary" }))
      .not.toBeInTheDocument();

    await user.click(within(region).getByRole("button", { name: "Clear filters" }));
    expect(await within(region).findByText("1–2 of 26 matching sessions")).toBeVisible();
    await user.click(within(region).getByRole("button", { name: "Next page" }));
    expect(await within(region).findByText("26–26 of 26 matching sessions")).toBeVisible();
    expect(mocks.invoke).toHaveBeenCalledWith("query_training_sessions", {
      request: {
        from: null,
        through: null,
        sportRefs: [],
        requiredMeasurements: [],
        text: null,
        sort: "started-desc",
        offset: 25,
        limit: 25,
        snapshotRef,
      },
    });
    await user.click(within(region).getByRole("button", { name: "Previous page" }));
    expect(await within(region).findByText("1–2 of 26 matching sessions")).toBeVisible();
    expect(onError).toHaveBeenCalledWith(undefined);
  });

  it("rejects invalid draft values without querying and exercises empty and failed states", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") return Promise.resolve(page([], 0, 0, null));
      throw new Error(`Unexpected command: ${command}`);
    });
    const onError = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(
      <TrainingSessionLibraryPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        onAvailableRange={vi.fn()}
        onError={onError}
      />,
    );
    expect(await screen.findByText("No sessions match these filters.")).toBeVisible();
    const callsAfterLoad = mocks.invoke.mock.calls.length;
    await user.type(screen.getByLabelText("From date"), "2026-08-18");
    await user.type(screen.getByLabelText("Through date"), "2025-01-01");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(onError).toHaveBeenCalledWith("invalid-training-session-search");
    expect(mocks.invoke).toHaveBeenCalledTimes(callsAfterLoad);
    await user.type(
      screen.getByRole("textbox", { name: /^Your sport name contains/ }),
      "🏃".repeat(81),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Use 80 characters or fewer.");
    expect(screen.getByRole("button", { name: "Apply filters" })).toBeDisabled();

    unmount();
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      return Promise.reject({ code: "training-session-search-failed" });
    });
    renderPanel(onError);
    expect(await screen.findByText(
      "Training sessions could not be loaded from the local library.",
    )).toBeVisible();
    expect(onError).toHaveBeenCalledWith("training-session-search-failed");
  });

  it("keeps an empty filtered month navigable instead of replacing the calendar", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") return Promise.resolve(page([], 0, 0, null));
      if (command === "query_training_session_calendar") {
        return Promise.resolve({ ...calendar, days: [] });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();
    const region = await screen.findByRole("region", { name: "Find a training session" });
    expect(within(region).getByText("No sessions match these filters.")).toBeVisible();

    await user.click(within(region).getByRole("radio", { name: "Calendar" }));

    expect(await within(region).findByRole("heading", { name: "August 2026" })).toBeVisible();
    expect(within(region).getByText("No matching sessions in this month.")).toBeVisible();
    expect(within(region).queryByText("No sessions match these filters.")).not.toBeInTheDocument();
  });

  it("restarts from the first page when the library snapshot changes", async () => {
    let stale = true;
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      const request = arguments_.request as TrainingSessionSearchRequest;
      if (request.offset === 25 && stale) {
        stale = false;
        return Promise.reject({ code: "training-session-search-changed" });
      }
      return Promise.resolve(page([newest, second], 0, 26, 25));
    });
    const user = userEvent.setup();
    const { onError } = renderPanel();
    await user.click(await screen.findByRole("checkbox", { name: /Add .*18.*comparison/ }));
    expect(screen.getByRole("region", { name: "Session comparison" })).toBeVisible();
    await user.click(await screen.findByRole("button", { name: "Next page" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your library changed, so results restarted from the first page.",
    );
    expect(screen.getByText("1–2 of 26 matching sessions")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Session comparison" })).not.toBeInTheDocument();
    expect(mocks.invoke).toHaveBeenLastCalledWith("query_training_sessions", {
      request: {
        from: null,
        through: null,
        sportRefs: [],
        requiredMeasurements: [],
        text: null,
        sort: "started-desc",
        offset: 0,
        limit: 25,
        snapshotRef: null,
      },
    });
    expect(onError).toHaveBeenCalledWith(undefined);
  });

  it("restores filters, calendar origin, comparison, open detail, and the exact snapshot", async () => {
    const restoredWorkspace: TrainingDiscoveryWorkspace = {
      version: 1,
      snapshotRef,
      from: "2026-01-01",
      through: "2026-08-18",
      sportRefs: [sports.sports[0].sportRef!],
      requiredMeasurements: ["distance", "heart-rate"],
      text: "Trail",
      sort: "distance-desc",
      offset: 0,
      limit: 25,
      view: "calendar",
      calendarMonth: "2026-08",
      calendarDay: "2026-08-18",
      selectedSessionRefs: [second.sessionRef, newest.sessionRef],
      openSessionRef: newest.sessionRef,
    };
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "load_training_discovery_workspace") {
        return Promise.resolve(restoredWorkspace);
      }
      if (command === "save_training_discovery_workspace") {
        return Promise.resolve(arguments_.workspace);
      }
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        const request = arguments_.request as TrainingSessionSearchRequest;
        expect(request).toEqual({
          from: "2026-08-18",
          through: "2026-08-18",
          sportRefs: [sports.sports[0].sportRef],
          requiredMeasurements: ["distance", "heart-rate"],
          text: "Trail",
          sort: "distance-desc",
          offset: 0,
          limit: 25,
          snapshotRef,
        });
        return Promise.resolve(page([newest], 0, 1, null));
      }
      if (command === "query_training_session_calendar") {
        return Promise.resolve(calendar);
      }
      if (command === "query_training_session_selection") {
        expect(arguments_).toEqual({
          request: {
            sessionRefs: [second.sessionRef, newest.sessionRef],
            snapshotRef,
          },
        });
        return Promise.resolve({ snapshotRef, sessions: [second, newest] });
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    renderPanel();
    const region = await screen.findByRole("region", { name: "Find a training session" });
    expect(within(region).getByLabelText("From date")).toHaveValue("2026-01-01");
    expect(within(region).getByLabelText("Through date")).toHaveValue("2026-08-18");
    expect(within(region).getByRole("textbox", { name: /^Your sport name contains/ }))
      .toHaveValue("Trail");
    expect(within(region).getByRole("radio", { name: "Calendar" })).toBeChecked();
    expect(within(region).getByRole("button", {
      name: /August 18, 2026.*1 session/,
    })).toHaveAttribute("aria-pressed", "true");
    expect(within(region).getByRole("region", { name: "Session comparison" }))
      .toHaveTextContent("2 sessions selected");
    expect(within(region).getByRole("heading", { name: "Session summary" })).toBeVisible();
    expect(within(region).getByRole("button", { name: "Back to calendar" })).toBeVisible();

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "save_training_discovery_workspace",
      { workspace: restoredWorkspace },
    ));
  });
});
