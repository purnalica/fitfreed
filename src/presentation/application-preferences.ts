import type { Locale } from "../locales/catalogs";

export type AppearancePreference = "system" | "light" | "dark";

export interface ApplicationPreferences {
  version: number;
  locale: Locale;
  appearance: AppearancePreference;
  contentZoomPercent: number;
}

export type PreferencesLoadStatus = "current" | "initialized" | "recovered";

export interface ApplicationPreferencesLoad {
  preferences: ApplicationPreferences;
  status: PreferencesLoadStatus;
}

export function defaultApplicationPreferences(locale: Locale): ApplicationPreferences {
  return {
    version: 1,
    locale,
    appearance: "system",
    contentZoomPercent: 100,
  };
}

export function applyApplicationPreferences(
  preferences: ApplicationPreferences,
  root: HTMLElement = document.documentElement,
) {
  root.lang = preferences.locale;
  root.dataset.appearance = preferences.appearance;
  root.dataset.contentZoom = preferences.contentZoomPercent.toString();
  root.style.setProperty(
    "--content-zoom",
    (preferences.contentZoomPercent / 100).toString(),
  );
}

export function sameApplicationPreferences(
  left: ApplicationPreferences,
  right: ApplicationPreferences,
): boolean {
  return left.locale === right.locale &&
    left.appearance === right.appearance &&
    left.contentZoomPercent === right.contentZoomPercent;
}
