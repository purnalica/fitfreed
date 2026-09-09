import { invoke } from "@tauri-apps/api/core";
import {
  type ComponentType,
  useEffect,
  useRef,
  useState,
} from "react";

import type { Locale } from "./locales/catalogs";
import type { RuntimeCatalog } from "./locales/runtime-catalogs";
import { startupShellCatalogs } from "./locales/startup-catalogs";
import {
  type ApplicationStartup,
  failedRuntimeCatalogStartup,
  resolveApplicationPreferenceStartup,
  type ResolvedApplicationPreferenceStartup,
} from "./presentation/application-startup";
import {
  ApplicationShell,
  type ApplicationHome,
} from "./presentation/ApplicationShell";
import { applyApplicationPreferences } from "./presentation/application-preferences";
import { systemLocale } from "./presentation/system-locale";

const rendererStartedAt = performance.now();
const INTERACTIVE_SHELL_FRAME_TIMEOUT_MILLISECONDS = 1_000;

interface RuntimeApplicationProps {
  startup?: ApplicationStartup;
}

interface ApplicationRuntime {
  Application: ComponentType<RuntimeApplicationProps>;
  messages: RuntimeCatalog;
  catalogFallback?: true;
}

export type ApplicationRuntimeLoader = (locale: Locale) => Promise<ApplicationRuntime>;

interface StartupRootProps {
  loadApplicationRuntime?: ApplicationRuntimeLoader;
}

async function loadApplicationRuntime(locale: Locale): Promise<ApplicationRuntime> {
  const [{ default: Application }, catalogs] = await Promise.all([
    import("./App"),
    import("./locales/runtime-catalogs"),
  ]);
  try {
    return {
      Application,
      messages: await catalogs.loadRuntimeCatalog(locale),
    };
  } catch {
    return {
      Application,
      messages: catalogs.defaultCatalog,
      catalogFallback: true,
    };
  }
}

export function StartupRoot({
  loadApplicationRuntime: loadRuntime = loadApplicationRuntime,
}: StartupRootProps) {
  const [preferenceStartup, setPreferenceStartup] = useState<
    ResolvedApplicationPreferenceStartup<typeof startupShellCatalogs["en-US"]>
  >();
  const [activeHome, setActiveHome] = useState<ApplicationHome>("home");
  const activeHomeRef = useRef(activeHome);
  const [runtime, setRuntime] = useState<ApplicationRuntime>();
  const [applicationStartup, setApplicationStartup] = useState<ApplicationStartup>();

  useEffect(() => {
    let active = true;
    const defaultLocale = systemLocale();
    void resolveApplicationPreferenceStartup({
      defaultLocale,
      defaultCatalog: startupShellCatalogs["en-US"],
      loadPreferences: (locale) => invoke("load_preferences", { defaultLocale: locale }),
      loadCatalog: (locale) => Promise.resolve(startupShellCatalogs[locale]),
    }).then((startup) => {
      if (!active) return;
      applyApplicationPreferences(startup.savedPreferences);
      setPreferenceStartup(startup);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    activeHomeRef.current = activeHome;
  }, [activeHome]);

  useEffect(() => {
    if (!preferenceStartup) return;
    const initializedPreferences = preferenceStartup;
    let active = true;
    let startupContinued = false;
    const localeReady = performance.now() - rendererStartedAt;
    function continueStartup(reportPaintedShell: boolean) {
      if (!active || startupContinued) return;
      startupContinued = true;
      if (reportPaintedShell) {
        void invoke("report_interactive_shell", {
          rendererStartupMilliseconds: {
            localeReady,
            signal: performance.now() - rendererStartedAt,
          },
        }).catch(() => undefined);
      }
      void loadRuntime(initializedPreferences.locale).then((loadedRuntime) => {
        if (!active) return;
        const initialHome = activeHomeRef.current;
        const startup: ApplicationStartup = loadedRuntime.catalogFallback
          ? failedRuntimeCatalogStartup(loadedRuntime.messages, initialHome)
          : {
              ...initializedPreferences,
              messages: loadedRuntime.messages,
              initialHome,
              interactiveShellReported: true,
            };
        if (loadedRuntime.catalogFallback) {
          applyApplicationPreferences(startup.savedPreferences);
        }
        setApplicationStartup(startup);
        setRuntime(loadedRuntime);
      });
    }
    let frameTimeout = 0;
    const frame = requestAnimationFrame(() => {
      window.clearTimeout(frameTimeout);
      continueStartup(true);
    });
    frameTimeout = window.setTimeout(() => {
      cancelAnimationFrame(frame);
      continueStartup(false);
    }, INTERACTIVE_SHELL_FRAME_TIMEOUT_MILLISECONDS);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      window.clearTimeout(frameTimeout);
    };
  }, [loadRuntime, preferenceStartup]);

  if (runtime && applicationStartup) {
    const Application = runtime.Application;
    return <Application startup={applicationStartup} />;
  }

  if (!preferenceStartup) {
    return (
      <main className="startup-surface" aria-busy="true" aria-label="FitFreed">
        <div className="startup-mark">
          <strong>FitFreed</strong>
          <progress aria-label="FitFreed" />
        </div>
      </main>
    );
  }

  const messages = preferenceStartup.messages;
  return (
    <ApplicationShell
      activeHome={activeHome}
      messages={messages}
      exploreDisabled
      exploreRestriction={{ message: messages.historyLoading }}
      onNavigate={setActiveHome}
    >
      <p className="loading-surface" role="status" aria-live="polite">
        {messages.loading}
      </p>
    </ApplicationShell>
  );
}
