import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type {
  SavedTrainingSportClassification,
  SavedUnifiedSportRelationship,
  TrainingSport,
  TrainingSportsOverview,
} from "./training-sports";
import { TrainingSportsPanel } from "./TrainingSportsPanel";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

const unknownSport: TrainingSport = {
  sessionFilterRef: `sport-${"1".repeat(64)}`,
  memberSessionFilterRefs: [`sport-${"1".repeat(64)}`],
  sportRef: "sport-local-unknown",
  sourceIndex: 2,
  state: "unknown",
  classification: {
    scope: "unresolved-source-profile" as const,
    canonicalFamily: null,
    displayLabel: null,
    authorship: null,
    revision: 0,
  },
  recognition: null,
  recognitionCandidateCount: 0,
  unification: null,
  firstLocalDate: "2024-01-02",
  lastLocalDate: "2026-08-17",
  coverage: {
    sessionCount: 18,
    totalDurationMilliseconds: "64800000",
    distanceSessionCount: 12,
    heartRateSessionCount: 16,
  },
};

const classifiedSport: TrainingSport = {
  sessionFilterRef: `sport-${"2".repeat(64)}`,
  memberSessionFilterRefs: [`sport-${"2".repeat(64)}`],
  sportRef: "sport-local-running",
  sourceIndex: 1,
  state: "personally-overridden",
  classification: {
    scope: "unresolved-source-profile" as const,
    canonicalFamily: "running",
    displayLabel: "Trail running",
    authorship: "user",
    revision: 3,
  },
  recognition: null,
  recognitionCandidateCount: 0,
  unification: null,
  firstLocalDate: "2025-02-03",
  lastLocalDate: "2026-08-12",
  coverage: {
    sessionCount: 9,
    totalDurationMilliseconds: "32400000",
    distanceSessionCount: 9,
    heartRateSessionCount: 8,
  },
};

const unavailableSport: TrainingSport = {
  sessionFilterRef: `sport-${"3".repeat(64)}`,
  memberSessionFilterRefs: [`sport-${"3".repeat(64)}`],
  sportRef: null,
  sourceIndex: 1,
  state: "unavailable",
  classification: null,
  recognition: null,
  recognitionCandidateCount: 0,
  unification: null,
  firstLocalDate: "2026-03-04",
  lastLocalDate: "2026-03-04",
  coverage: {
    sessionCount: 1,
    totalDurationMilliseconds: "1800000",
    distanceSessionCount: 0,
    heartRateSessionCount: 0,
  },
};

const recognizedSport: TrainingSport = {
  ...unknownSport,
  sessionFilterRef: `sport-${"4".repeat(64)}`,
  memberSessionFilterRefs: [`sport-${"4".repeat(64)}`],
  sportRef: "sport-local-kayaking",
  sourceIndex: 1,
  state: "recognized",
  recognition: {
    canonicalFamily: "water-sport",
    localizedNames: { en: "Kayaking", "es-ES": "Piragüismo" },
    catalogueRevision: "catalogue-2026-08-01",
    retrievedAtUtc: "2026-08-01T10:00:00Z",
    mappingVersion: "polar-flow-sports-v1",
    evidenceRef: `sport-evidence-${"a".repeat(64)}`,
  },
  recognitionCandidateCount: 1,
};

const ambiguousSport: TrainingSport = {
  ...unknownSport,
  sessionFilterRef: `sport-${"5".repeat(64)}`,
  memberSessionFilterRefs: [`sport-${"5".repeat(64)}`],
  sportRef: "sport-local-ambiguous",
  sourceIndex: 1,
  state: "ambiguous",
  recognitionCandidateCount: 2,
};

function overview(sports: TrainingSport[] = [classifiedSport, unknownSport, unavailableSport]): TrainingSportsOverview {
  return {
    snapshotRef: `training-snapshot-${"a".repeat(64)}`,
    originCount: 2,
    sessionCount: sports.reduce((total, sport) => total + sport.coverage.sessionCount, 0),
    sports,
    sportCollections: sports,
    unificationReviews: [],
  };
}

afterEach(cleanup);

beforeEach(() => {
  mocks.invoke.mockReset();
});

describe("TrainingSportsPanel", () => {
  it.each([
    { locale: "en-US" as const, date: "Mar 4, 2026", sessions: "Sessions" },
    { locale: "es-ES" as const, date: "4 mar 2026", sessions: "Sesiones" },
  ])("shows a one-day sport period once in $locale", async ({ locale, date, sessions }) => {
    mocks.invoke.mockResolvedValueOnce(overview([unavailableSport]));

    render(
      <TrainingSportsPanel
        locale={locale}
        messages={catalogs[locale]}
        refreshToken={0}
        onError={vi.fn()}
      />,
    );

    const card = (await screen.findByRole("heading", {
      name: catalogs[locale].training.sports.notRecorded,
    })).closest("li");
    expect(card).not.toBeNull();
    expect(card!.textContent?.match(new RegExp(date, "g"))).toHaveLength(1);
    expect(within(card!).getByText(sessions)).toBeVisible();
    expect(within(card!).getByText("1", { selector: "dd" })).toBeVisible();
  });

  it("opens the exact represented session collection independently from classification", async () => {
    mocks.invoke.mockResolvedValueOnce(overview([recognizedSport, unavailableSport]));
    const onOpenSessions = vi.fn();
    const user = userEvent.setup();

    render(
      <TrainingSportsPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        onError={vi.fn()}
        onOpenSessions={onOpenSessions}
      />,
    );

    const kayaking = (await screen.findByRole("heading", { name: "Kayaking" })).closest("li");
    expect(kayaking).not.toBeNull();
    await user.click(within(kayaking!).getByRole("button", { name: "View sessions" }));
    expect(onOpenSessions).toHaveBeenCalledWith(recognizedSport);
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });

  it("distinguishes localized catalogue recognition from ambiguous evidence", async () => {
    mocks.invoke.mockResolvedValueOnce(overview([recognizedSport, ambiguousSport]));

    render(
      <TrainingSportsPanel
        locale="es-ES"
        messages={catalogs["es-ES"]}
        refreshToken={0}
        onError={vi.fn()}
      />,
    );

    const recognizedCard = (await screen.findByRole("heading", { name: "Piragüismo" }))
      .closest("li");
    expect(recognizedCard).not.toBeNull();
    expect(within(recognizedCard!).getByTestId("sport-family-icon"))
      .toHaveAttribute("data-sport-icon", "water-sport");
    expect(within(recognizedCard!).getByText(
      "Reconocido a partir de evidencias documentadas del catálogo del proveedor.",
    )).toBeVisible();

    const ambiguousCard = screen.getByRole("heading", {
      name: "Deporte pendiente de revisión 1",
    }).closest("li");
    expect(ambiguousCard).not.toBeNull();
    expect(within(ambiguousCard!).getByTestId("sport-family-icon"))
      .toHaveAttribute("data-sport-icon", "unknown");
    expect(within(ambiguousCard!).getByRole("button", { name: "Nombrar este deporte" }))
      .toBeEnabled();
  });

  it("reveals and focuses the shared editor for an exact contextual sport request", async () => {
    mocks.invoke.mockResolvedValueOnce(overview());

    render(
      <TrainingSportsPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        openSportRef="sport-local-unknown"
        navigationRequestId={7}
        onError={vi.fn()}
      />,
    );

    const editor = await screen.findByRole("form", { name: "Classify Unknown sport 1" });
    expect(editor).toBeVisible();
    await waitFor(() => expect(editor).toHaveFocus());
  });

  it("uses one explicit sport identity system for classified, unknown, and unavailable evidence", async () => {
    mocks.invoke.mockResolvedValueOnce(overview());

    render(
      <TrainingSportsPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        onError={vi.fn()}
      />,
    );

    const list = await screen.findByRole("list");
    const cards = within(list).getAllByRole("listitem");
    expect(cards).toHaveLength(3);
    cards.forEach((card) => {
      expect(within(card).getByTestId("sport-family-icon")).toBeVisible();
    });
    expect(cards[0]).toHaveAttribute("data-sport-family", "running");
    expect(cards[1]).toHaveAttribute("data-sport-family", "unknown");
    expect(cards[2]).toHaveAttribute("data-sport-family", "unavailable");
    expect(cards[1]).toHaveTextContent(
      "The source says these sessions belong to a sport, but does not provide a trustworthy name.",
    );
    expect(cards[2]).toHaveTextContent(
      "These sessions do not name a sport in the source, so FitFreed cannot classify them.",
    );
  });

  it("explores every detected state and authors, amends, and resets a classification", async () => {
    let current = overview();
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_training_sports") return Promise.resolve(current);
      if (command === "save_training_sport_classification") {
        const request = arguments_.request;
        const existing = current.sports.find((sport) => sport.sportRef === request.sportRef)!;
        const changed: TrainingSport = {
          ...existing,
          state: request.canonicalFamily === null && request.displayLabel === null
            ? "unknown"
            : "personally-overridden",
          classification: {
            scope: "unresolved-source-profile" as const,
            canonicalFamily: request.canonicalFamily,
            displayLabel: request.displayLabel,
            authorship: "user",
            revision: request.expectedRevision + 1,
          },
        };
        const updatedSports = current.sports.map((sport) => (
          sport.sportRef === changed.sportRef ? changed : sport
        ));
        current = overview(changed.state === "personally-overridden"
          ? [changed, ...updatedSports.filter((sport) => sport.sportRef !== changed.sportRef)]
          : [
              ...updatedSports.filter((sport) => sport.state === "personally-overridden"),
              changed,
              ...updatedSports.filter((sport) => sport.state === "unavailable"),
            ]);
        return Promise.resolve(({
          outcome: "changed",
          overview: current,
        }) satisfies SavedTrainingSportClassification);
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TrainingSportsPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        onError={vi.fn()}
        onChange={onChange}
      />,
    );

    const region = await screen.findByRole("region", { name: "Your sports" });
    expect(within(region).getByText("3 sport groups across 28 sessions")).toBeVisible();
    expect(within(region).getByRole("heading", { name: "Trail running" })).toBeVisible();
    expect(within(region).getByRole("heading", { name: "Unknown sport 1" })).toBeVisible();
    expect(within(region).getByRole("heading", { name: "Sport not recorded" })).toBeVisible();
    expect(region).toHaveTextContent("Source 1");
    expect(region).toHaveTextContent("Source 2");
    expect(region).toHaveTextContent("Distance in 12 of 18 sessions");
    expect(region).toHaveTextContent("Heart rate in 16 of 18 sessions");
    expect(region).not.toHaveTextContent("sport-local");
    expect(region).not.toHaveTextContent("opaque-source");

    const unknownCard = within(region)
      .getByRole("heading", { name: "Unknown sport 1" })
      .closest("li");
    expect(unknownCard).not.toBeNull();
    const classifyAction = within(unknownCard!).getByRole("button", {
      name: "Name this sport",
    });
    await user.click(classifyAction);
    expect(unknownCard).toHaveAttribute("data-editor-open", "true");
    let editor = within(unknownCard!).getByRole("form", { name: "Classify Unknown sport 1" });
    expect(within(editor).getByRole("button", { name: "Save sport classification" }))
      .toBeDisabled();
    await user.type(within(editor).getByLabelText("Your sport name"), "Discarded draft");
    await user.click(within(editor).getByRole("button", { name: "Cancel editing" }));
    expect(unknownCard).not.toHaveAttribute("data-editor-open");
    expect(within(unknownCard!).queryByRole("form")).not.toBeInTheDocument();
    await waitFor(() => expect(within(unknownCard!).getByRole("button", {
      name: "Name this sport",
    })).toHaveFocus());
    expect(mocks.invoke).toHaveBeenCalledTimes(1);

    await user.click(within(unknownCard!).getByRole("button", { name: "Name this sport" }));
    editor = within(unknownCard!).getByRole("form", { name: "Classify Unknown sport 1" });
    const labelInput = within(editor).getByLabelText("Your sport name");
    await user.type(labelInput, "🏃".repeat(80));
    expect(within(editor).getByRole("button", { name: "Save sport classification" }))
      .toBeEnabled();
    await user.type(labelInput, "x");
    expect(labelInput).toHaveAttribute("aria-invalid", "true");
    expect(within(editor).getByRole("alert")).toHaveTextContent("Use 80 characters or fewer.");
    expect(within(editor).getByRole("alert")).toHaveClass("field-error");
    expect(within(editor).getByRole("button", { name: "Save sport classification" }))
      .toBeDisabled();
    await user.clear(labelInput);
    await user.selectOptions(within(editor).getByLabelText("Broad sport family"), "cycling");
    await user.type(labelInput, "Gravel cycling");
    await user.click(screen.getByRole("button", { name: "Save sport classification" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "save_training_sport_classification",
      {
        request: {
          sportRef: "sport-local-unknown",
          expectedRevision: 0,
          canonicalFamily: "cycling",
          displayLabel: "Gravel cycling",
        },
      },
    ));
    expect(await within(region).findByRole("heading", { name: "Gravel cycling" })).toBeVisible();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(within(region).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent))
      .toEqual(["Gravel cycling", "Trail running", "Sport not recorded"]);
    expect(within(region).getByRole("status")).toHaveTextContent(
      "Sport classification saved.",
    );

    const changedCard = within(region)
      .getByRole("heading", { name: "Gravel cycling" })
      .closest("li");
    expect(changedCard).not.toBeNull();
    await user.click(within(changedCard!).getByRole("button", { name: "Edit sport name" }));
    await user.click(within(changedCard!).getByRole("button", { name: "Mark as unknown" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenLastCalledWith(
      "save_training_sport_classification",
      {
        request: {
          sportRef: "sport-local-unknown",
          expectedRevision: 1,
          canonicalFamily: null,
          displayLabel: null,
        },
      },
    ));
    expect(await within(region).findByRole("heading", { name: "Unknown sport 1" })).toBeVisible();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(within(region).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent))
      .toEqual(["Trail running", "Unknown sport 1", "Sport not recorded"]);
  });

  it("reloads a concurrent classification without overwriting it and retains the draft for review", async () => {
    let current = overview([unknownSport]);
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_training_sports") return Promise.resolve(current);
      if (command === "save_training_sport_classification") {
        current = overview([{
          ...unknownSport,
          state: "personally-overridden",
          classification: {
            scope: "unresolved-source-profile" as const,
            canonicalFamily: "running",
            displayLabel: "Concurrent running",
            authorship: "user",
            revision: 1,
          },
        }]);
        return Promise.reject({ code: "sport-classification-conflict" });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const onError = vi.fn();
    const user = userEvent.setup();
    render(
      <TrainingSportsPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        onError={onError}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Name this sport" }));
    await user.type(screen.getByLabelText("Your sport name"), "Stale running");
    await user.click(screen.getByRole("button", { name: "Save sport classification" }));

    expect(await screen.findByRole("heading", { name: "Concurrent running" })).toBeVisible();
    expect(screen.getByLabelText("Your sport name")).toHaveValue("Stale running");
    expect(screen.getByText("Current saved identity: Concurrent running")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Your edits are still here");
    expect(onError).toHaveBeenCalledWith("sport-classification-conflict");
    expect(mocks.invoke).toHaveBeenCalledTimes(3);
  });

  it("applies a classification from Sessions while preserving an open Sports draft", async () => {
    mocks.invoke.mockResolvedValueOnce(overview([unknownSport]));
    const concurrent = {
      ...unknownSport,
      state: "personally-overridden" as const,
      classification: {
        scope: "unresolved-source-profile" as const,
        canonicalFamily: "water-sport" as const,
        displayLabel: "River paddling",
        authorship: "user" as const,
        revision: 1,
      },
    };
    const onError = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <TrainingSportsPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        onError={onError}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Name this sport" }));
    await user.type(screen.getByLabelText("Your sport name"), "Unfinished local draft");
    view.rerender(
      <TrainingSportsPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        classificationChange={{
          requestId: 1,
          source: "sessions",
          result: {
            outcome: "changed",
            overview: overview([concurrent]),
          },
        }}
        onError={onError}
      />,
    );

    expect(await screen.findByRole("heading", { name: "River paddling" })).toBeVisible();
    expect(screen.getByLabelText("Your sport name")).toHaveValue("Unfinished local draft");
    expect(screen.getByText("Current saved identity: River paddling")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Your edits are still here");
    expect(onError).not.toHaveBeenCalledWith("sport-classification-conflict");
  });

  it("keeps the classification action stable and the current sport visible while saving", async () => {
    let resolveSave: (value: SavedTrainingSportClassification) => void = () => undefined;
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_training_sports") return Promise.resolve(overview([unknownSport]));
      if (command === "save_training_sport_classification") {
        return new Promise((resolve) => {
          resolveSave = resolve;
        });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(
      <TrainingSportsPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        onError={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Name this sport" }));
    await user.type(screen.getByLabelText("Your sport name"), "Gravel cycling");
    await user.click(screen.getByRole("button", { name: "Save sport classification" }));

    const editor = screen.getByRole("form", { name: "Classify Unknown sport 1" });
    await waitFor(() => expect(editor).toHaveAttribute("aria-busy", "true"));
    expect(screen.getByRole("button", { name: "Save sport classification" })).toBeDisabled();
    expect(within(editor).getByRole("status")).toHaveTextContent(
      "Saving sport classification…",
    );
    expect(screen.getByRole("heading", { name: "Unknown sport 1" })).toBeVisible();

    const classified = {
      ...unknownSport,
      sessionFilterRef: `sport-${"9".repeat(64)}`,
      memberSessionFilterRefs: [`sport-${"9".repeat(64)}`],
      state: "personally-overridden" as const,
      classification: {
        scope: "unresolved-source-profile" as const,
        canonicalFamily: null,
        displayLabel: "Gravel cycling",
        authorship: "user" as const,
        revision: 1,
      },
    };
    resolveSave({ outcome: "changed", overview: overview([classified]) });

    expect(await screen.findByRole("heading", { name: "Gravel cycling" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Sport classification saved.");
    await waitFor(() => expect(
      screen.getByRole("button", { name: "Edit sport name" }),
    ).toHaveFocus());
  });

  it("keeps classification actions stable and announces marking a sport as unknown", async () => {
    let completeReset: (value: SavedTrainingSportClassification) => void = () => undefined;
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_training_sports") {
        return Promise.resolve(overview([classifiedSport]));
      }
      if (command === "save_training_sport_classification") {
        return new Promise((resolve) => {
          completeReset = resolve;
        });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(
      <TrainingSportsPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        onError={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Edit sport name" }));
    await user.click(screen.getByRole("button", { name: "Mark as unknown" }));

    const editor = screen.getByRole("form", { name: "Classify Trail running" });
    expect(editor).toHaveAttribute("aria-busy", "true");
    expect(within(editor).getByRole("button", { name: "Mark as unknown" })).toBeDisabled();
    expect(within(editor).getByRole("button", { name: "Save sport classification" }))
      .toBeDisabled();
    expect(within(editor).getByRole("status")).toHaveTextContent(
      "Marking sport as unknown…",
    );
    expect(within(editor).queryByText("Saving sport classification…"))
      .not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Trail running" })).toBeVisible();

    const resetSport: TrainingSport = {
      ...classifiedSport,
      state: "unknown",
      classification: {
        scope: "unresolved-source-profile" as const,
        canonicalFamily: null,
        displayLabel: null,
        authorship: "user",
        revision: 4,
      },
    };
    act(() => completeReset({ outcome: "changed", overview: overview([resetSport]) }));

    expect(await screen.findByRole("heading", { name: "Unknown sport 1" })).toBeVisible();
  });

  it("combines represented groups only after an affected-session preview and keeps navigation actionable", async () => {
    const initial = overview([recognizedSport, unknownSport]);
    const relationshipRef = `unified:${recognizedSport.sessionFilterRef}`;
    const combinedSport: TrainingSport = {
      ...recognizedSport,
      sessionFilterRef: relationshipRef,
      memberSessionFilterRefs: [recognizedSport.sessionFilterRef, unknownSport.sessionFilterRef],
      unification: {
        relationshipRef,
        primarySessionFilterRef: recognizedSport.sessionFilterRef,
        memberSessionFilterRefs: [recognizedSport.sessionFilterRef, unknownSport.sessionFilterRef],
        authorship: "user",
        revision: 1,
      },
      coverage: {
        sessionCount: 36,
        totalDurationMilliseconds: "129600000",
        distanceSessionCount: 24,
        heartRateSessionCount: 32,
      },
    };
    const savedOverview = {
      ...overview([combinedSport]),
      sportCollections: [recognizedSport, unknownSport],
    };
    const saved: SavedUnifiedSportRelationship = {
      outcome: "changed",
      overview: savedOverview,
    };
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_training_sports") return Promise.resolve(initial);
      if (command === "save_unified_sport_relationship") return Promise.resolve(saved);
      throw new Error(`Unexpected command: ${command}`);
    });
    const onUnificationChange = vi.fn();
    const onOpenSessions = vi.fn();
    const user = userEvent.setup();
    render(
      <TrainingSportsPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        onError={vi.fn()}
        onUnificationChange={onUnificationChange}
        onOpenSessions={onOpenSessions}
      />,
    );

    const recognizedCard = (await screen.findByRole("heading", { name: "Kayaking" }))
      .closest("li")!;
    await user.click(within(recognizedCard).getByRole("button", {
      name: "Combine sport groups",
    }));
    expect(recognizedCard).toHaveAttribute("data-editor-open", "true");
    await user.click(screen.getByRole("checkbox", { name: "Unknown sport 1 · 18 sessions" }));
    expect(screen.getByText("2 groups will appear as one sport across 36 sessions.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save combined sport" }));

    expect(await screen.findByText("Combined by you from 2 groups")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Kayaking" }).closest("li"))
      .not.toHaveAttribute("data-editor-open");
    expect(screen.getByRole("status")).toHaveTextContent("Combined sport saved.");
    expect(onUnificationChange).toHaveBeenCalledWith(saved);
    await user.click(screen.getByRole("button", { name: "View sessions" }));
    expect(onOpenSessions).toHaveBeenCalledWith(combinedSport);
  });

  it("distinguishes loading, empty, and failed discovery without inventing sports", async () => {
    let resolveOverview: (value: TrainingSportsOverview) => void = () => undefined;
    mocks.invoke.mockReturnValue(new Promise((resolve) => {
      resolveOverview = resolve;
    }));
    const onError = vi.fn();
    const view = render(
      <TrainingSportsPanel
        locale="es-ES"
        messages={catalogs["es-ES"]}
        refreshToken={0}
        onError={onError}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Buscando deportes en todo tu historial…",
    );
    resolveOverview(overview([]));
    expect(await screen.findByText(
      "Todavía no hay sesiones de entrenamiento disponibles para descubrir deportes.",
    )).toBeVisible();

    view.unmount();
    mocks.invoke.mockRejectedValue({ code: "sport-classification-failed" });
    render(
      <TrainingSportsPanel
        locale="es-ES"
        messages={catalogs["es-ES"]}
        refreshToken={0}
        onError={onError}
      />,
    );
    expect(await screen.findByText(
      "No se han podido cargar los deportes desde la biblioteca local.",
    )).toBeVisible();
    expect(onError).toHaveBeenCalledWith("sport-classification-failed");
  });
});
