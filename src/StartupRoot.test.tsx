import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "./locales/catalogs";
import type { ApplicationStartup } from "./presentation/application-startup";
import { StartupRoot, type ApplicationRuntimeLoader } from "./StartupRoot";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  mocks.invoke.mockReset();
  document.documentElement.removeAttribute("data-appearance");
  document.documentElement.removeAttribute("data-content-zoom");
  document.documentElement.removeAttribute("style");
  document.documentElement.lang = "en";
});

function preferenceLoad(locale: "en-US" | "es-ES") {
  return {
    preferences: {
      version: 1,
      locale,
      appearance: "dark" as const,
      contentZoomPercent: 175,
    },
    status: "current" as const,
  };
}

describe("StartupRoot", () => {
  it("paints the persisted localized shell before loading the full application", async () => {
    let paintShell!: FrameRequestCallback;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      paintShell = callback;
      return 1;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    mocks.invoke.mockImplementation((command) => {
      if (command === "load_preferences") return Promise.resolve(preferenceLoad("es-ES"));
      if (command === "report_interactive_shell") return new Promise(() => undefined);
      throw new Error(`Unexpected command: ${command}`);
    });
    let resolveRuntime!: (runtime: Awaited<ReturnType<ApplicationRuntimeLoader>>) => void;
    const loadRuntime = vi.fn<ApplicationRuntimeLoader>(() => new Promise((resolve) => {
      resolveRuntime = resolve;
    }));

    render(<StartupRoot loadApplicationRuntime={loadRuntime} />);

    expect(await screen.findByRole("button", { name: "Ajustes" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Historial" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando esta vista…");
    expect(document.documentElement).toHaveAttribute("lang", "es-ES");
    expect(document.documentElement).toHaveAttribute("data-appearance", "dark");
    expect(document.documentElement.style.getPropertyValue("--content-zoom")).toBe("1.75");
    expect(loadRuntime).not.toHaveBeenCalled();

    await act(async () => paintShell(performance.now()));

    expect(mocks.invoke).toHaveBeenCalledWith("report_interactive_shell", {
      rendererStartupMilliseconds: {
        localeReady: expect.any(Number),
        signal: expect.any(Number),
      },
    });
    expect(loadRuntime).toHaveBeenCalledWith("es-ES");
    expect(mocks.invoke.mock.invocationCallOrder.find((_, index) =>
      mocks.invoke.mock.calls[index]?.[0] === "report_interactive_shell"))
      .toBeLessThan(loadRuntime.mock.invocationCallOrder[0]);

    let receivedStartup: ApplicationStartup | undefined;
    function TestApplication({ startup }: { startup?: ApplicationStartup }) {
      receivedStartup = startup;
      return <h1>Loaded application</h1>;
    }
    await act(async () => resolveRuntime({
      Application: TestApplication,
      messages: catalogs["es-ES"],
    }));

    expect(await screen.findByRole("heading", { name: "Loaded application" })).toBeVisible();
    expect(receivedStartup).toMatchObject({
      locale: "es-ES",
      messages: catalogs["es-ES"],
      savedPreferences: preferenceLoad("es-ES").preferences,
      preferencesRecovered: false,
      libraryReady: true,
      initialHome: "home",
      interactiveShellReported: true,
    });
  });

  it("preserves navigation performed while the full application is loading", async () => {
    let paintShell!: FrameRequestCallback;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      paintShell = callback;
      return 1;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    mocks.invoke.mockImplementation((command) => {
      if (command === "load_preferences") return Promise.resolve(preferenceLoad("en-US"));
      if (command === "report_interactive_shell") return Promise.resolve();
      throw new Error(`Unexpected command: ${command}`);
    });
    let resolveRuntime!: (runtime: Awaited<ReturnType<ApplicationRuntimeLoader>>) => void;
    const loadRuntime = vi.fn<ApplicationRuntimeLoader>(() => new Promise((resolve) => {
      resolveRuntime = resolve;
    }));
    let receivedStartup: ApplicationStartup | undefined;
    function TestApplication({ startup }: { startup?: ApplicationStartup }) {
      receivedStartup = startup;
      return <h1>Loaded application</h1>;
    }
    const user = userEvent.setup();
    render(<StartupRoot loadApplicationRuntime={loadRuntime} />);

    await screen.findByRole("button", { name: "Settings" });
    await act(async () => paintShell(performance.now()));
    await user.click(screen.getByRole("button", { name: "Sources" }));
    expect(screen.getByRole("button", { name: "Sources" }))
      .toHaveAttribute("aria-current", "page");
    await act(async () => resolveRuntime({
      Application: TestApplication,
      messages: catalogs["en-US"],
    }));

    await screen.findByRole("heading", { name: "Loaded application" });
    expect(receivedStartup?.initialHome).toBe("sources");
  });

  it("retains a destination selected as the deferred runtime settles", async () => {
    let paintShell!: FrameRequestCallback;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      paintShell = callback;
      return 1;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    mocks.invoke.mockImplementation((command) => {
      if (command === "load_preferences") return Promise.resolve(preferenceLoad("en-US"));
      if (command === "report_interactive_shell") return Promise.resolve();
      throw new Error(`Unexpected command: ${command}`);
    });
    let resolveRuntime!: (runtime: Awaited<ReturnType<ApplicationRuntimeLoader>>) => void;
    const loadRuntime = vi.fn<ApplicationRuntimeLoader>(() => new Promise((resolve) => {
      resolveRuntime = resolve;
    }));
    let receivedStartup: ApplicationStartup | undefined;
    function TestApplication({ startup }: { startup?: ApplicationStartup }) {
      receivedStartup = startup;
      return <h1>Loaded application</h1>;
    }

    render(<StartupRoot loadApplicationRuntime={loadRuntime} />);
    await screen.findByRole("button", { name: "Settings" });
    await act(async () => paintShell(performance.now()));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reports" }));
      resolveRuntime({
        Application: TestApplication,
        messages: catalogs["en-US"],
      });
    });

    await screen.findByRole("heading", { name: "Loaded application" });
    expect(receivedStartup?.initialHome).toBe("reports");
  });

  it("continues without claiming painted-shell evidence when no frame arrives", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    mocks.invoke.mockImplementation((command) => {
      if (command === "load_preferences") return Promise.resolve(preferenceLoad("en-US"));
      throw new Error(`Unexpected command: ${command}`);
    });
    const loadRuntime = vi.fn<ApplicationRuntimeLoader>(() => new Promise(() => undefined));

    render(<StartupRoot loadApplicationRuntime={loadRuntime} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(loadRuntime).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTimeAsync(1_000));

    expect(mocks.invoke).not.toHaveBeenCalledWith(
      "report_interactive_shell",
      expect.anything(),
    );
    expect(loadRuntime).toHaveBeenCalledWith("en-US");
  });

  it("keeps a supported system locale usable when first-run persistence fails", async () => {
    vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["es-ES"]);
    let paintShell!: FrameRequestCallback;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      paintShell = callback;
      return 1;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    mocks.invoke.mockImplementation((command) => {
      if (command === "load_preferences") {
        return Promise.reject({ code: "preference-update-failed" });
      }
      if (command === "report_interactive_shell") return Promise.resolve();
      throw new Error(`Unexpected command: ${command}`);
    });
    let receivedStartup: ApplicationStartup | undefined;
    function TestApplication({ startup }: { startup?: ApplicationStartup }) {
      receivedStartup = startup;
      return <h1>Loaded application</h1>;
    }
    const loadRuntime = vi.fn<ApplicationRuntimeLoader>(() => Promise.resolve({
      Application: TestApplication,
      messages: catalogs["es-ES"],
    }));

    render(<StartupRoot loadApplicationRuntime={loadRuntime} />);
    expect(await screen.findByRole("button", { name: "Ajustes" })).toBeVisible();
    await act(async () => paintShell(performance.now()));
    await waitFor(() => expect(receivedStartup).toBeDefined());

    expect(receivedStartup).toMatchObject({
      locale: "es-ES",
      libraryReady: true,
      errorCode: "preference-initialization-failed",
    });
  });
});
