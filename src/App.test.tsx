import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { catalogs } from "./locales/catalogs";

const spanish = catalogs["es-ES"];

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  open: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class Channel<T> {
    onmessage?: (message: T) => void;
  },
  invoke: mocks.invoke,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: mocks.open,
}));

afterEach(() => {
  cleanup();
  mocks.invoke.mockReset();
  mocks.open.mockReset();
});

function emptyLibrary() {
  mocks.invoke.mockImplementation((command) => {
    if (command === "query_activity") return Promise.resolve([]);
    throw new Error(`Unexpected command: ${command}`);
  });
}

async function chooseArchive(user: ReturnType<typeof userEvent.setup>, path: string) {
  mocks.open.mockResolvedValue(path);
  await user.click(screen.getByRole("button", { name: "Choose ZIP package" }));
  expect(screen.getByText(path)).toBeVisible();
}

describe("FitFreed import interface", () => {
  it("switches every visible message between the supported locales", async () => {
    emptyLibrary();
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Your fitness history belongs to you" })).toBeVisible();
    await user.selectOptions(screen.getByRole("combobox", { name: "Language" }), "es-ES");

    expect(screen.getByRole("heading", { name: spanish.title })).toBeVisible();
    expect(screen.getByRole("heading", { name: spanish.importHeading })).toBeVisible();
    expect(screen.getByRole("button", { name: spanish.choose })).toBeEnabled();
    expect(screen.getByText(spanish.empty)).toBeVisible();
  });

  it("keeps import disabled after a cancelled picker and enables it for a selected ZIP", async () => {
    emptyLibrary();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("No imported daily activity yet.");

    mocks.open.mockResolvedValue(null);
    await user.click(screen.getByRole("button", { name: "Choose ZIP package" }));
    await waitFor(() => expect(mocks.open).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Import selected package" })).toBeDisabled();

    await chooseArchive(user, "/synthetic/valid.zip");
    expect(screen.getByRole("button", { name: "Import selected package" })).toBeEnabled();
  });

  it("shows progress, remains interactive, and cancels without exposing history", async () => {
    let rejectImport: ((reason: string) => void) | undefined;
    let onProgress: { onmessage?: (message: unknown) => void } | undefined;
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_activity") return Promise.resolve([]);
      if (command === "import_archive") {
        onProgress = arguments_.onProgress;
        onProgress?.onmessage?.({
          phase: "importing",
          completedArtifacts: 1,
          totalArtifacts: 10_000,
          completedBytes: 0,
          totalBytes: null,
          cancellable: true,
        });
        return new Promise((_, reject) => {
          rejectImport = reject;
        });
      }
      if (command === "cancel_import") {
        onProgress?.onmessage?.({
          phase: "cancelled",
          completedArtifacts: 0,
          totalArtifacts: null,
          completedBytes: 0,
          totalBytes: null,
          cancellable: false,
        });
        rejectImport?.("import cancelled");
        return Promise.resolve(true);
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("No imported daily activity yet.");
    await chooseArchive(user, "/synthetic/large.zip");

    await user.click(screen.getByRole("button", { name: "Import selected package" }));
    expect(await screen.findByRole("progressbar", { name: "Importing and reconciling artifacts" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Choose ZIP package" })).toBeDisabled();

    await user.selectOptions(screen.getByRole("combobox", { name: "Language" }), "es-ES");
    expect(screen.getByRole("heading", { name: spanish.title })).toBeVisible();
    await user.click(screen.getByRole("button", { name: spanish.cancel }));

    expect(await screen.findByText(spanish.cancelled)).toBeVisible();
    expect(screen.queryAllByRole("row")).toHaveLength(0);
  });

  it("renders validation errors, complete reports, multiple records, exact repeats, and restored history", async () => {
    const history = [
      { originId: "polar:synthetic", localDate: "2026-01-01", stepCount: 3100 },
      { originId: "polar:synthetic", localDate: "2026-01-02", stepCount: 4200 },
      { originId: "polar:synthetic", localDate: "2026-01-03", stepCount: null },
    ];
    let storedHistory: typeof history = [];
    let importAttempt = 0;
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_activity") return Promise.resolve(storedHistory);
      if (command === "import_archive") {
        importAttempt += 1;
        if (importAttempt === 1) return Promise.reject("stepCount cannot be negative");
        arguments_.onProgress.onmessage({
          phase: "completed",
          completedArtifacts: 3,
          totalArtifacts: 3,
          completedBytes: 0,
          totalBytes: null,
          cancellable: false,
        });
        if (importAttempt === 2) {
          storedHistory = history;
          return Promise.resolve({
            exactRepeat: false,
            recognizedArtifacts: 3,
            newObservations: 3,
            equivalentObservations: 0,
            enrichedObservations: 0,
            preservedObservations: 0,
            conflicts: 0,
          });
        }
        return Promise.resolve({
          exactRepeat: true,
          recognizedArtifacts: 0,
          newObservations: 0,
          equivalentObservations: 0,
          enrichedObservations: 0,
          preservedObservations: 0,
          conflicts: 0,
        });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    const view = render(<App />);
    await screen.findByText("No imported daily activity yet.");

    await chooseArchive(user, "/synthetic/invalid.zip");
    await user.click(screen.getByRole("button", { name: "Import selected package" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("stepCount cannot be negative");

    await chooseArchive(user, "/synthetic/valid.zip");
    await user.click(screen.getByRole("button", { name: "Import selected package" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Import completed: 3 recognized, 3 new");
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(within(rows[1]).getByText("2026-01-01")).toBeVisible();
    expect(within(rows[1]).getByText("3,100")).toBeVisible();
    expect(within(rows[3]).getByText("Not available")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Import selected package" }));
    expect(await screen.findByText("Exact package repeat; history was not duplicated.")).toBeVisible();
    expect(screen.getAllByRole("row")).toHaveLength(4);

    view.unmount();
    render(<App />);
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(4));
    expect(screen.queryByText("5,300")).not.toBeInTheDocument();
  });
});
