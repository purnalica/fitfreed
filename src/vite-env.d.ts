/// <reference types="vite/client" />

declare module "virtual:fitfreed-startup-catalogs" {
  interface StartupShellCatalog {
    navigation: string;
    sidebar: string;
    home: string;
    explore: string;
    sources: string;
    reports: string;
    settings: string;
    exploreGroup: string;
    libraryGroup: string;
    localTitle: string;
    localDetail: string;
    historyLoading: string;
    loading: string;
  }

  export const startupShellCatalogs: Record<"en-US" | "es-ES", StartupShellCatalog>;
}
