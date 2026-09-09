import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// @ts-expect-error process is a Node.js global
const host = process.env.TAURI_DEV_HOST;
const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));
const startupCatalogModuleId = "virtual:fitfreed-startup-catalogs";
const resolvedStartupCatalogModuleId = `\0${startupCatalogModuleId}`;
const deferredStartupModules = [
  "/src/App.tsx",
  "/src/App.css",
  "/src/ReactApplicationRoot.tsx",
  "/src/presentation/ApplicationShell.tsx",
  "/src/locales/en-US.json",
  "/src/locales/es-ES.json",
];
const deferredStartupModuleSegments = [
  "/node_modules/react/",
  "/node_modules/react-dom/",
  "/node_modules/scheduler/",
];

function startupCatalogPlugin() {
  return {
    name: "fitfreed-startup-catalogs",
    resolveId(id: string) {
      return id === startupCatalogModuleId ? resolvedStartupCatalogModuleId : null;
    },
    load(id: string) {
      if (id !== resolvedStartupCatalogModuleId) return null;
      const catalogs = Object.fromEntries(["en-US", "es-ES"].map((locale) => {
        const source = JSON.parse(readFileSync(
          path.join(repositoryRoot, "src", "locales", `${locale}.json`),
          "utf8",
        ));
        return [locale, source.shell];
      }));
      return `export const startupShellCatalogs = ${JSON.stringify(catalogs)};`;
    },
  };
}

function startupBoundaryPlugin() {
  return {
    name: "fitfreed-startup-boundary",
    generateBundle(_options: unknown, bundle: Record<string, {
      type: string;
      isEntry?: boolean;
      imports?: string[];
      modules?: Record<string, unknown>;
    }>) {
      const entries = Object.entries(bundle).filter(([, output]) =>
        output.type === "chunk" && output.isEntry);
      if (entries.length !== 1) {
        throw new Error("FitFreed requires one production renderer entry");
      }
      const eagerFiles = new Set<string>();
      function visit(file: string) {
        if (eagerFiles.has(file)) return;
        eagerFiles.add(file);
        const output = bundle[file];
        if (output?.type !== "chunk") return;
        for (const imported of output.imports ?? []) visit(imported);
      }
      visit(entries[0][0]);
      const eagerModules = [...eagerFiles].flatMap((file) =>
        Object.keys(bundle[file]?.modules ?? {}).map((module) => module.replaceAll("\\", "/")));
      for (const deferredModule of deferredStartupModules) {
        if (eagerModules.some((module) => module.endsWith(deferredModule))) {
          throw new Error(`${deferredModule} must remain outside the interactive startup graph`);
        }
      }
      for (const deferredSegment of deferredStartupModuleSegments) {
        if (eagerModules.some((module) => module.includes(deferredSegment))) {
          throw new Error(`${deferredSegment} must remain outside the interactive startup graph`);
        }
      }
      if (!eagerModules.some((module) => module.endsWith("/src/startup-bootstrap.ts"))) {
        throw new Error("the interactive startup graph must contain the startup bootstrap");
      }
      if (!eagerModules.some((module) => module.endsWith("/src/startup-shell.ts"))) {
        throw new Error("the interactive startup graph must contain the startup shell adapter");
      }
      if (!eagerModules.includes(resolvedStartupCatalogModuleId)) {
        throw new Error("the interactive startup graph must use the generated locale projection");
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [startupCatalogPlugin(), startupBoundaryPlugin(), react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test-setup.ts"],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
