import type { Locale } from "../locales/catalogs";
import type { RuntimeCatalog } from "../locales/runtime-catalogs";
import type { ApplicationHome } from "./application-shell-model";
import {
  defaultApplicationPreferences,
  type ApplicationPreferences,
  type ApplicationPreferencesLoad,
} from "./application-preferences";
import { commandErrorCode } from "./command-error";

export interface ApplicationPreferenceStartup {
  locale: Locale;
  defaultPreferences: ApplicationPreferences;
  savedPreferences: ApplicationPreferences;
  preferencesRecovered: boolean;
  libraryReady: boolean;
  errorCode?: string;
}

export interface ApplicationStartup extends ApplicationPreferenceStartup {
  messages: RuntimeCatalog;
  initialHome: ApplicationHome;
  interactiveShellReported: boolean;
}

interface ResolveApplicationPreferenceStartupOptions<Catalog> {
  defaultLocale: Locale;
  defaultCatalog: Catalog;
  loadPreferences: (defaultLocale: Locale) => Promise<ApplicationPreferencesLoad>;
  loadCatalog: (locale: Locale) => Promise<Catalog>;
}

export interface ResolvedApplicationPreferenceStartup<Catalog>
  extends ApplicationPreferenceStartup {
  messages: Catalog;
}

export async function resolveApplicationPreferenceStartup<Catalog>({
  defaultLocale,
  defaultCatalog,
  loadPreferences,
  loadCatalog,
}: ResolveApplicationPreferenceStartupOptions<Catalog>): Promise<
  ResolvedApplicationPreferenceStartup<Catalog>
> {
  const defaultPreferences = defaultApplicationPreferences(defaultLocale);
  try {
    const loaded = await loadPreferences(defaultLocale);
    const messages = await loadCatalog(loaded.preferences.locale);
    return {
      locale: loaded.preferences.locale,
      defaultPreferences,
      savedPreferences: loaded.preferences,
      preferencesRecovered: loaded.status === "recovered",
      libraryReady: true,
      messages,
    };
  } catch (reason) {
    const code = commandErrorCode(reason);
    let fallbackLocale = defaultLocale;
    let messages: Catalog;
    try {
      messages = await loadCatalog(fallbackLocale);
    } catch {
      fallbackLocale = "en-US";
      messages = defaultCatalog;
    }
    const fallbackPreferences = defaultApplicationPreferences(fallbackLocale);
    return {
      locale: fallbackLocale,
      defaultPreferences: fallbackPreferences,
      savedPreferences: fallbackPreferences,
      preferencesRecovered: false,
      libraryReady: code === "preference-update-failed",
      errorCode: code === "preference-update-failed"
        ? "preference-initialization-failed"
        : code,
      messages,
    };
  }
}

export function failedRuntimeCatalogStartup(
  messages: RuntimeCatalog,
  initialHome: ApplicationHome,
): ApplicationStartup {
  const preferences = defaultApplicationPreferences("en-US");
  return {
    locale: "en-US",
    defaultPreferences: preferences,
    savedPreferences: preferences,
    preferencesRecovered: false,
    libraryReady: false,
    errorCode: "unexpected",
    messages,
    initialHome,
    interactiveShellReported: true,
  };
}
