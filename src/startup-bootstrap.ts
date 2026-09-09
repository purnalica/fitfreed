import { invoke } from "@tauri-apps/api/core";

import type { Locale } from "./locales/catalogs";
import type { RuntimeCatalog } from "./locales/runtime-catalogs";
import { startupShellCatalogs } from "./locales/startup-catalogs";
import {
  type ApplicationStartup,
  failedRuntimeCatalogStartup,
  resolveApplicationPreferenceStartup,
} from "./presentation/application-startup";
import { applyApplicationPreferences } from "./presentation/application-preferences";
import { systemLocale } from "./presentation/system-locale";
import { renderStartupMark, renderStartupShell } from "./startup-shell";

const rendererStartedAt = performance.now();
const INTERACTIVE_SHELL_FRAME_TIMEOUT_MILLISECONDS = 1_000;

export interface ApplicationRuntime {
  mount: (startup: ApplicationStartup) => void;
  messages: RuntimeCatalog;
  catalogFallback?: true;
}

export type ApplicationRuntimeLoader = (locale: Locale) => Promise<ApplicationRuntime>;

interface StartupBootstrapOptions {
  loadApplicationRuntime?: ApplicationRuntimeLoader;
}

async function loadApplicationRuntime(
  root: HTMLElement,
  locale: Locale,
): Promise<ApplicationRuntime> {
  const [{ mountReactApplication }, catalogs] = await Promise.all([
    import("./ReactApplicationRoot"),
    import("./locales/runtime-catalogs"),
  ]);
  try {
    return {
      mount: (startup) => mountReactApplication(root, startup),
      messages: await catalogs.loadRuntimeCatalog(locale),
    };
  } catch {
    return {
      mount: (startup) => mountReactApplication(root, startup),
      messages: catalogs.defaultCatalog,
      catalogFallback: true,
    };
  }
}

export async function bootstrapApplication(
  root: HTMLElement,
  { loadApplicationRuntime: suppliedRuntimeLoader }: StartupBootstrapOptions = {},
) {
  renderStartupMark(root);
  const defaultLocale = systemLocale();
  const preferenceStartup = await resolveApplicationPreferenceStartup({
    defaultLocale,
    defaultCatalog: startupShellCatalogs["en-US"],
    loadPreferences: (locale) => invoke("load_preferences", { defaultLocale: locale }),
    loadCatalog: (locale) => Promise.resolve(startupShellCatalogs[locale]),
  });
  applyApplicationPreferences(preferenceStartup.savedPreferences);
  const shell = renderStartupShell(root, preferenceStartup.messages);
  const localeReady = performance.now() - rendererStartedAt;
  const loadRuntime = suppliedRuntimeLoader ?? ((locale) => loadApplicationRuntime(root, locale));
  let runtimeLoadStarted = false;

  function reportPaintedShell() {
    void invoke("report_interactive_shell", {
      rendererStartupMilliseconds: {
        localeReady,
        signal: performance.now() - rendererStartedAt,
      },
    }).catch(() => undefined);
  }

  function continueStartup() {
    if (runtimeLoadStarted) return;
    runtimeLoadStarted = true;
    void loadRuntime(preferenceStartup.locale).then((runtime) => {
      const initialHome = shell.selectedHome();
      const startup: ApplicationStartup = runtime.catalogFallback
        ? failedRuntimeCatalogStartup(runtime.messages, initialHome)
        : {
            ...preferenceStartup,
            messages: runtime.messages,
            initialHome,
            interactiveShellReported: true,
          };
      if (runtime.catalogFallback) {
        applyApplicationPreferences(startup.savedPreferences);
      }
      runtime.mount(startup);
    });
  }

  let frameTimeout = 0;
  requestAnimationFrame(() => {
    window.clearTimeout(frameTimeout);
    reportPaintedShell();
    continueStartup();
  });
  frameTimeout = window.setTimeout(
    continueStartup,
    INTERACTIVE_SHELL_FRAME_TIMEOUT_MILLISECONDS,
  );
}
