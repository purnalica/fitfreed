import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { catalogs } from "./locales/catalogs";

const spanish = catalogs["es-ES"];

function importOutcome(overrides: Record<string, unknown> = {}) {
  return {
    operationRef: "synthetic-operation",
    state: "completed",
    sourceProvider: "polar-flow",
    sourceAdapterVersion: "polar-flow-archive@2",
    mappingVersion: "polar-flow-daily-activity@1",
    exactRepeat: false,
    coverageComplete: true,
    coverage: {
      total: 3,
      supported: 3,
      unsupported: 0,
      deliberatelyIgnored: 0,
      unrecognized: 0,
      invalid: 0,
    },
    artifactFamilies: [],
    report: {
      exactRepeat: false,
      recognizedArtifacts: 3,
      newObservations: 3,
      equivalentObservations: 0,
      enrichedObservations: 0,
      preservedObservations: 0,
      conflicts: 0,
    },
    canonicalHistoryChanged: true,
    terminalCode: null,
    recoveryNote: null,
    ...overrides,
  };
}

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
  vi.restoreAllMocks();
  mocks.invoke.mockReset();
  mocks.open.mockReset();
});

function emptyLibrary(initialLocale: "en-US" | "es-ES" | null = "en-US") {
  let storedLocale = initialLocale;
  mocks.invoke.mockImplementation((command, arguments_) => {
    if (command === "query_activity") return Promise.resolve([]);
    if (command === "query_latest_import_outcome") return Promise.resolve(null);
    if (command === "load_locale") return Promise.resolve(storedLocale);
    if (command === "save_locale") {
      storedLocale = arguments_.locale;
      return Promise.resolve();
    }
    throw new Error(`Unexpected command: ${command}`);
  });
  return {
    locale: () => storedLocale,
  };
}

async function chooseArchive(user: ReturnType<typeof userEvent.setup>, path: string) {
  mocks.open.mockResolvedValue(path);
  await user.click(screen.getByRole("button", { name: "Choose ZIP package" }));
  expect(screen.getByText(path)).toBeVisible();
}

describe("FitFreed import interface", () => {
  it("explains family coverage with localized reasons and next actions without source locators", async () => {
    const latestOutcome = importOutcome({
      coverage: {
        total: 7,
        supported: 3,
        unsupported: 1,
        deliberatelyIgnored: 1,
        unrecognized: 1,
        invalid: 1,
      },
      artifactFamilies: [
        {
          familyCode: "polar-flow-daily-activity",
          classification: "invalid",
          reasonCode: "invalid-supported-artifact",
          artifactCount: 1,
        },
        {
          familyCode: null,
          classification: "unrecognized",
          reasonCode: "unrecognized-artifact-family",
          artifactCount: 1,
        },
        {
          familyCode: "polar-flow-sleep-result",
          classification: "unsupported",
          reasonCode: "known-family-not-yet-supported",
          artifactCount: 1,
        },
        {
          familyCode: "polar-flow-profile-picture",
          classification: "deliberately-ignored",
          reasonCode: "mvp-excludes-profile-picture",
          artifactCount: 1,
        },
        {
          familyCode: "polar-flow-daily-activity",
          classification: "supported",
          reasonCode: "mapped",
          artifactCount: 3,
        },
      ],
    });
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity") return Promise.resolve([]);
      if (command === "query_latest_import_outcome") return Promise.resolve(latestOutcome);
      if (command === "load_locale") return Promise.resolve("en-US");
      if (command === "save_locale") return Promise.resolve();
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);

    const coverage = await screen.findByRole("table", { name: "Coverage by data family" });
    expect(within(coverage).getAllByRole("row")).toHaveLength(6);
    expect(within(coverage).getByRole("row", {
      name: /Daily activity Invalid 1 Reason: Recognized content failed validation\. Next action: Keep the original ZIP and report the compatibility problem/,
    })).toBeVisible();
    expect(within(coverage).getByRole("row", {
      name: /Unrecognized data Unrecognized 1 Reason: The file does not match a known data family\. Next action: Keep the original ZIP and report the compatibility problem/,
    })).toBeVisible();
    expect(screen.queryByText(/activity-2026-01-01/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Language" }), "es-ES");
    const spanishCoverage = screen.getByRole("table", { name: "Cobertura por familia de datos" });
    expect(within(spanishCoverage).getByRole("row", {
      name: /Actividad diaria No válido 1 Motivo: El contenido reconocido no ha superado la validación\. Siguiente acción: Conserva el ZIP original y comunica el problema de compatibilidad/,
    })).toBeVisible();
  });

  it("explains a changed source-subject claim without exposing identity evidence", async () => {
    let latestOutcome: ReturnType<typeof importOutcome> | null = null;
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity") return Promise.resolve([]);
      if (command === "query_latest_import_outcome") return Promise.resolve(latestOutcome);
      if (command === "load_locale") return Promise.resolve("en-US");
      if (command === "save_locale") return Promise.resolve();
      if (command === "import_archive") {
        latestOutcome = importOutcome({
          state: "rejected",
          coverageComplete: false,
          coverage: {
            total: 2,
            supported: 1,
            unsupported: 0,
            deliberatelyIgnored: 0,
            unrecognized: 0,
            invalid: 0,
          },
          report: {
            exactRepeat: false,
            recognizedArtifacts: 1,
            newObservations: 0,
            equivalentObservations: 0,
            enrichedObservations: 0,
            preservedObservations: 0,
            conflicts: 0,
          },
          canonicalHistoryChanged: false,
          terminalCode: "source-subject-confirmation-required",
        });
        return Promise.reject({ code: "import-failed" });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("No imported daily activity yet.");
    await chooseArchive(user, "/synthetic/different-subject.zip");

    await user.click(screen.getByRole("button", { name: "Import selected package" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "FitFreed will not merge it with the existing history automatically",
    );
    expect(screen.getByText("Import rejected; no history was changed.")).toBeVisible();
    expect(screen.queryByText(/fixture-(?:primary|other)-claim/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Language" }), "es-ES");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "FitFreed no lo combinará automáticamente con el historial existente",
    );
  });

  it("persists an explicit locale and restores every visible message after remount", async () => {
    const preferences = emptyLibrary();
    const user = userEvent.setup();
    const view = render(<App />);

    expect(await screen.findByRole("heading", { name: "Your fitness history belongs to you" })).toBeVisible();
    const language = screen.getByRole("combobox", { name: "Language" });
    await waitFor(() => expect(language).toBeEnabled());
    await user.selectOptions(language, "es-ES");

    expect(screen.getByRole("heading", { name: spanish.title })).toBeVisible();
    expect(screen.getByRole("heading", { name: spanish.importHeading })).toBeVisible();
    expect(screen.getByRole("button", { name: spanish.choose })).toBeEnabled();
    expect(screen.getByText(spanish.empty)).toBeVisible();
    await waitFor(() => expect(preferences.locale()).toBe("es-ES"));

    view.unmount();
    render(<App />);
    expect(await screen.findByRole("heading", { name: spanish.title })).toBeVisible();
  });

  it("initializes the first supported operating-system language on first run", async () => {
    vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["fr-FR", "es-MX"]);
    const preferences = emptyLibrary(null);

    render(<App />);

    expect(await screen.findByRole("heading", { name: spanish.title })).toBeVisible();
    await waitFor(() => expect(preferences.locale()).toBe("es-ES"));
  });

  it("falls back to English when the operating system has no supported language", async () => {
    vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["fr-FR", "de-DE"]);
    const preferences = emptyLibrary(null);

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Your fitness history belongs to you" }),
    ).toBeVisible();
    await waitFor(() => expect(preferences.locale()).toBe("en-US"));
  });

  it("keeps the operating-system locale for the session when first-run persistence fails", async () => {
    vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["es-ES"]);
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity") return Promise.resolve([]);
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      if (command === "load_locale") return Promise.resolve(null);
      if (command === "save_locale") {
        return Promise.reject({ code: "preference-update-failed" });
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: spanish.title })).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      spanish.errors["preference-initialization-failed"],
    );
    expect(screen.getByRole("combobox", { name: spanish.language })).toBeEnabled();
  });

  it("restores the previous locale when persistence fails", async () => {
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity") return Promise.resolve([]);
      if (command === "query_latest_import_outcome") return Promise.resolve(null);
      if (command === "load_locale") return Promise.resolve("en-US");
      if (command === "save_locale") {
        return Promise.reject({ code: "preference-update-failed" });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(<App />);
    const language = await screen.findByRole("combobox", { name: "Language" });
    await waitFor(() => expect(language).toBeEnabled());

    await user.selectOptions(language, "es-ES");

    await waitFor(() => expect(screen.getByRole("combobox", { name: "Language" })).toHaveValue("en-US"));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "could not save the selected language",
    );
  });

  it("uses locale plural rules for import and coverage counts", async () => {
    const singularOutcome = importOutcome({
      coverage: {
        total: 1,
        supported: 1,
        unsupported: 0,
        deliberatelyIgnored: 0,
        unrecognized: 0,
        invalid: 0,
      },
      report: {
        exactRepeat: false,
        recognizedArtifacts: 1,
        newObservations: 1,
        equivalentObservations: 1,
        enrichedObservations: 1,
        preservedObservations: 1,
        conflicts: 1,
      },
    });
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_activity") return Promise.resolve([]);
      if (command === "query_latest_import_outcome") return Promise.resolve(singularOutcome);
      if (command === "load_locale") return Promise.resolve("es-ES");
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      `${spanish.completed}: 1 ${spanish.counts.recognized.one}, 1 ${spanish.counts.created.one}, 1 ${spanish.counts.enriched.one}, 1 ${spanish.counts.equivalent.one}, 1 ${spanish.counts.preserved.one}, 1 ${spanish.counts.conflicts.one}.`,
    );
    expect(screen.getByText(`${spanish.outcome.artifactsClassified.one}.`)).toBeVisible();
  });

  it("keeps import disabled after a cancelled picker and enables it for a selected ZIP", async () => {
    emptyLibrary();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("No imported daily activity yet.");

    mocks.open.mockResolvedValue(null);
    const choose = screen.getByRole("button", { name: "Choose ZIP package" });
    choose.focus();
    await user.keyboard("[Enter]");
    await waitFor(() => expect(mocks.open).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Import selected package" })).toBeDisabled();

    await chooseArchive(user, "/synthetic/valid.zip");
    expect(screen.getByRole("button", { name: "Import selected package" })).toBeEnabled();
  });

  it("shows progress, remains interactive, and cancels without exposing history", async () => {
    let rejectImport: ((reason?: unknown) => void) | undefined;
    let onProgress: { onmessage?: (message: unknown) => void } | undefined;
    let latestOutcome: ReturnType<typeof importOutcome> | null = null;
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_activity") return Promise.resolve([]);
      if (command === "query_latest_import_outcome") return Promise.resolve(latestOutcome);
      if (command === "load_locale") return Promise.resolve("en-US");
      if (command === "save_locale") return Promise.resolve();
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
        latestOutcome = importOutcome({
          state: "cancelled",
          coverageComplete: false,
          canonicalHistoryChanged: false,
          terminalCode: "user-cancelled",
        });
        onProgress?.onmessage?.({
          phase: "cancelled",
          completedArtifacts: 0,
          totalArtifacts: null,
          completedBytes: 0,
          totalBytes: null,
          cancellable: false,
        });
        rejectImport?.({ code: "import-failed" });
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
    let latestOutcome: ReturnType<typeof importOutcome> | null = null;
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_activity") return Promise.resolve(storedHistory);
      if (command === "query_latest_import_outcome") return Promise.resolve(latestOutcome);
      if (command === "load_locale") return Promise.resolve("en-US");
      if (command === "save_locale") return Promise.resolve();
      if (command === "import_archive") {
        importAttempt += 1;
        if (importAttempt === 1) {
          latestOutcome = importOutcome({
            state: "rejected",
            coverage: {
              total: 2,
              supported: 1,
              unsupported: 0,
              deliberatelyIgnored: 0,
              unrecognized: 0,
              invalid: 1,
            },
            report: {
              exactRepeat: false,
              recognizedArtifacts: 2,
              newObservations: 0,
              equivalentObservations: 0,
              enrichedObservations: 0,
              preservedObservations: 0,
              conflicts: 0,
            },
            canonicalHistoryChanged: false,
            terminalCode: "invalid-supported-artifact",
          });
          return Promise.reject({ code: "import-failed" });
        }
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
          latestOutcome = importOutcome();
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
        latestOutcome = importOutcome({
          exactRepeat: true,
          canonicalHistoryChanged: false,
          report: {
            exactRepeat: true,
            recognizedArtifacts: 3,
            newObservations: 0,
            equivalentObservations: 0,
            enrichedObservations: 0,
            preservedObservations: 0,
            conflicts: 0,
          },
        });
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
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This package contains daily activity that FitFreed cannot validate",
    );
    expect(screen.getByRole("heading", { name: "Package coverage" })).toBeVisible();
    expect(screen.getByText("2 / 2")).toBeVisible();
    const rejectedCoverage = screen.getByRole("list", { name: "Package coverage" });
    const invalidCoverage = within(rejectedCoverage).getByText("Invalid").closest("li");
    expect(invalidCoverage).not.toBeNull();
    expect(within(invalidCoverage!).getByText("1")).toBeVisible();

    await chooseArchive(user, "/synthetic/valid.zip");
    await user.click(screen.getByRole("button", { name: "Import selected package" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Import completed: 3 recognized, 3 new");
    expect(screen.getByText("Every package artifact was classified.")).toBeVisible();
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(within(rows[1]).getByText("Jan 1, 2026")).toBeVisible();
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
