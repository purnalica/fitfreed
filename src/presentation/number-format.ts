import type { Locale } from "../locales/catalogs";

export function integerCountFormatter(locale: Locale): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    useGrouping: true,
  });
}
