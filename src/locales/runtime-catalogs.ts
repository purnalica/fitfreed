import enUS from "./en-US.json";

import type { Locale } from "./catalogs";

export type RuntimeCatalog = typeof enUS;

export const defaultCatalog: RuntimeCatalog = enUS;

let spanishCatalog: Promise<RuntimeCatalog> | undefined;
let loadedSpanishCatalog: RuntimeCatalog | undefined;

export function loadedRuntimeCatalog(locale: Locale): RuntimeCatalog | undefined {
  return locale === "en-US" ? defaultCatalog : loadedSpanishCatalog;
}

export function loadRuntimeCatalog(locale: Locale): Promise<RuntimeCatalog> {
  if (locale === "en-US") return Promise.resolve(defaultCatalog);
  spanishCatalog ??= import("./es-ES.json")
    .then((module) => {
      loadedSpanishCatalog = module.default as RuntimeCatalog;
      return loadedSpanishCatalog;
    });
  return spanishCatalog;
}
