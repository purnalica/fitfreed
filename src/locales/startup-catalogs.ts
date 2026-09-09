import { startupShellCatalogs as generatedStartupShellCatalogs } from "virtual:fitfreed-startup-catalogs";

import type { Locale } from "./catalogs";
import type { ApplicationShellMessages } from "../presentation/application-shell-model";

export interface StartupShellCatalog extends ApplicationShellMessages {
  historyLoading: string;
  loading: string;
}

export const startupShellCatalogs: Record<Locale, StartupShellCatalog>
  = generatedStartupShellCatalogs;
