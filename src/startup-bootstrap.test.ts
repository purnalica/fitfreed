import { fireEvent, screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "./locales/catalogs";
import { startupShellCatalogs } from "./locales/startup-catalogs";
import type { ApplicationStartup } from "./presentation/application-startup";
import {
  bootstrapApplication,
  type ApplicationRuntimeLoader,
} from "./startup-bootstrap";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  mocks.invoke.mockReset();
  document.documentElement.removeAttribute("data-appearance");
  document.documentElement.removeAttribute("data-content-zoom");
  document.documentElement.removeAttribute("style");
  document.documentElement.lang = "en";
});

function rootElement() {
  const root = document.createElement("div");
  root.id = "root";
  document.body.append(root);
  return root;
}

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

describe("startup bootstrap", () => {
  it("paints the persisted localized shell before loading React", async () => {
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
    const mount = vi.fn();

    await bootstrapApplication(rootElement(), { loadApplicationRuntime: loadRuntime });

    const shellMessages = startupShellCatalogs["es-ES"];
    expect(screen.getByRole("navigation", { name: shellMessages.navigation })).toBeVisible();
    for (const label of [
      shellMessages.home,
      shellMessages.explore,
      shellMessages.reports,
      shellMessages.sources,
      shellMessages.settings,
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeVisible();
    }
    expect(screen.getByRole("button", { name: shellMessages.explore })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(shellMessages.loading);
    expect(document.documentElement).toHaveAttribute("lang", "es-ES");
    expect(document.documentElement).toHaveAttribute("data-appearance", "dark");
    expect(document.documentElement.style.getPropertyValue("--content-zoom")).toBe("1.75");
    expect(loadRuntime).not.toHaveBeenCalled();

    paintShell(performance.now());

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

    resolveRuntime({ mount, messages: catalogs["es-ES"] });
    await vi.waitFor(() => expect(mount).toHaveBeenCalled());

    expect(mount).toHaveBeenCalledWith(expect.objectContaining({
      locale: "es-ES",
      messages: catalogs["es-ES"],
      savedPreferences: preferenceLoad("es-ES").preferences,
      preferencesRecovered: false,
      libraryReady: true,
      initialHome: "home",
      interactiveShellReported: true,
    }));
  });

  it("preserves navigation performed while React is loading", async () => {
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
    const mount = vi.fn();

    await bootstrapApplication(rootElement(), { loadApplicationRuntime: loadRuntime });
    paintShell(performance.now());
    fireEvent.click(screen.getByRole("button", { name: "Sources" }));
    expect(screen.getByRole("button", { name: "Sources" }))
      .toHaveAttribute("aria-current", "page");
    resolveRuntime({ mount, messages: catalogs["en-US"] });
    await vi.waitFor(() => expect(mount).toHaveBeenCalled());

    expect(mount.mock.calls[0][0].initialHome).toBe("sources");
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
    const mount = vi.fn();

    await bootstrapApplication(rootElement(), { loadApplicationRuntime: loadRuntime });
    paintShell(performance.now());
    fireEvent.click(screen.getByRole("button", { name: "Reports" }));
    resolveRuntime({ mount, messages: catalogs["en-US"] });
    await vi.waitFor(() => expect(mount).toHaveBeenCalled());

    expect(mount.mock.calls[0][0].initialHome).toBe("reports");
  });

  it("continues before a late frame and reports that frame exactly once", async () => {
    vi.useFakeTimers();
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
    const loadRuntime = vi.fn<ApplicationRuntimeLoader>(() => new Promise(() => undefined));

    await bootstrapApplication(rootElement(), { loadApplicationRuntime: loadRuntime });
    expect(loadRuntime).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);

    expect(mocks.invoke).not.toHaveBeenCalledWith(
      "report_interactive_shell",
      expect.anything(),
    );
    expect(loadRuntime).toHaveBeenCalledWith("en-US");

    paintShell(performance.now());

    expect(mocks.invoke.mock.calls.filter(([command]) => command === "report_interactive_shell"))
      .toHaveLength(1);
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
    const mount = vi.fn<(startup: ApplicationStartup) => void>();
    const loadRuntime = vi.fn<ApplicationRuntimeLoader>(() => Promise.resolve({
      mount,
      messages: catalogs["es-ES"],
    }));

    await bootstrapApplication(rootElement(), { loadApplicationRuntime: loadRuntime });
    expect(screen.getByRole("button", {
      name: startupShellCatalogs["es-ES"].settings,
    })).toBeVisible();
    paintShell(performance.now());
    await vi.waitFor(() => expect(mount).toHaveBeenCalled());

    expect(mount.mock.calls[0][0]).toMatchObject({
      locale: "es-ES",
      libraryReady: true,
      errorCode: "preference-initialization-failed",
    });
  });
});
