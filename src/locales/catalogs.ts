import enUS from "./en-US.json";
import esES from "./es-ES.json";

export type Locale = "en-US" | "es-ES";

export const catalogs: Record<Locale, typeof enUS> = {
  "en-US": enUS,
  "es-ES": esES,
};
