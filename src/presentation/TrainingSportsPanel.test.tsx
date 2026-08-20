import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type {
  SavedTrainingSportClassification,
  TrainingSport,
  TrainingSportsOverview,
} from "./training-sports";
import { TrainingSportsPanel } from "./TrainingSportsPanel";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

const unknownSport: TrainingSport = {
  sportRef: "sport-local-unknown",
  sourceIndex: 2,
  state: "unknown",
  classification: {
    canonicalFamily: null,
    displayLabel: null,
    authorship: null,
    revision: 0,
  },
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
  sportRef: "sport-local-running",
  sourceIndex: 1,
  state: "classified",
  classification: {
    canonicalFamily: "running",
    displayLabel: "Trail running",
    authorship: "user",
    revision: 3,
  },
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
  sportRef: null,
  sourceIndex: 1,
  state: "unavailable",
  classification: null,
  firstLocalDate: "2026-03-04",
  lastLocalDate: "2026-03-04",
  coverage: {
    sessionCount: 1,
    totalDurationMilliseconds: "1800000",
    distanceSessionCount: 0,
    heartRateSessionCount: 0,
  },
};

function overview(sports: TrainingSport[] = [classifiedSport, unknownSport, unavailableSport]): TrainingSportsOverview {
  return {
    originCount: 2,
    sessionCount: sports.reduce((total, sport) => total + sport.coverage.sessionCount, 0),
    sports,
  };
}

afterEach(cleanup);

beforeEach(() => {
  mocks.invoke.mockReset();
});

describe("TrainingSportsPanel", () => {
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
            : "classified",
          classification: {
            canonicalFamily: request.canonicalFamily,
            displayLabel: request.displayLabel,
            authorship: "user",
            revision: request.expectedRevision + 1,
          },
        };
        const updatedSports = current.sports.map((sport) => (
          sport.sportRef === changed.sportRef ? changed : sport
        ));
        current = overview(changed.state === "classified"
          ? [changed, ...updatedSports.filter((sport) => sport.sportRef !== changed.sportRef)]
          : [
              ...updatedSports.filter((sport) => sport.state === "classified"),
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
    await user.click(within(unknownCard!).getByRole("button", { name: "Name this sport" }));
    let editor = within(unknownCard!).getByRole("form", { name: "Classify Unknown sport 1" });
    expect(within(editor).getByRole("button", { name: "Save sport classification" }))
      .toBeDisabled();
    await user.type(within(editor).getByLabelText("Your sport name"), "Discarded draft");
    await user.click(within(editor).getByRole("button", { name: "Cancel editing" }));
    expect(within(unknownCard!).queryByRole("form")).not.toBeInTheDocument();
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
    await user.click(within(changedCard!).getByRole("button", { name: "Return to unknown" }));
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

  it("reloads a concurrent classification without overwriting the newer authored value", async () => {
    let current = overview([unknownSport]);
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_training_sports") return Promise.resolve(current);
      if (command === "save_training_sport_classification") {
        current = overview([{
          ...unknownSport,
          state: "classified",
          classification: {
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
    expect(screen.queryByText("Stale running")).not.toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith("sport-classification-conflict");
    expect(mocks.invoke).toHaveBeenCalledTimes(3);
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
      state: "classified" as const,
      classification: {
        canonicalFamily: null,
        displayLabel: "Gravel cycling",
        authorship: "user" as const,
        revision: 1,
      },
    };
    resolveSave({ outcome: "changed", overview: overview([classified]) });

    expect(await screen.findByRole("heading", { name: "Gravel cycling" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Sport classification saved.");
  });

  it("keeps classification actions stable and announces returning a sport to unknown", async () => {
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
    await user.click(screen.getByRole("button", { name: "Return to unknown" }));

    const editor = screen.getByRole("form", { name: "Classify Trail running" });
    expect(editor).toHaveAttribute("aria-busy", "true");
    expect(within(editor).getByRole("button", { name: "Return to unknown" })).toBeDisabled();
    expect(within(editor).getByRole("button", { name: "Save sport classification" }))
      .toBeDisabled();
    expect(within(editor).getByRole("status")).toHaveTextContent(
      "Returning sport to unknown…",
    );
    expect(within(editor).queryByText("Saving sport classification…"))
      .not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Trail running" })).toBeVisible();

    const resetSport: TrainingSport = {
      ...classifiedSport,
      state: "unknown",
      classification: {
        canonicalFamily: null,
        displayLabel: null,
        authorship: "user",
        revision: 4,
      },
    };
    act(() => completeReset({ outcome: "changed", overview: overview([resetSport]) }));

    expect(await screen.findByRole("heading", { name: "Unknown sport 1" })).toBeVisible();
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
