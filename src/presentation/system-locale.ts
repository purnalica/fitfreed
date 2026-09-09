import type { Locale } from "../locales/catalogs";

export function systemLocale(languages: readonly string[] = navigator.languages): Locale {
  const preferredLanguages = languages.length > 0 ? languages : [navigator.language];
  for (const language of preferredLanguages) {
    const baseLanguage = language.toLowerCase().split("-")[0];
    if (baseLanguage === "es") return "es-ES";
    if (baseLanguage === "en") return "en-US";
  }
  return "en-US";
}
