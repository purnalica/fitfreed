import assert from "node:assert/strict";
import test from "node:test";

import {
  findUnreferencedCssClasses,
  findUnreachableFiles,
  findUnusedLocalePaths,
} from "./presentation-inventory.mjs";

test("findUnreachableFiles follows every live import from the production entry", () => {
  const modules = new Map([
    ["src/main.tsx", ["src/App.tsx", "src/App.css"]],
    ["src/App.tsx", ["src/presentation/Home.tsx"]],
    ["src/App.css", []],
    ["src/presentation/Home.tsx", []],
    ["src/presentation/Legacy.tsx", []],
  ]);

  assert.deepEqual(
    findUnreachableFiles("src/main.tsx", modules),
    ["src/presentation/Legacy.tsx"],
  );
});

test("findUnreferencedCssClasses preserves direct, dynamic, asset, and external contracts", () => {
  assert.deepEqual(
    findUnreferencedCssClasses({
      selectors: [
        "direct",
        "state-ready",
        "sport-icon-sprite",
        "leaflet-container",
        "retired-grid",
      ],
      references: new Set(["direct", "sport-icon-sprite"]),
      dynamicPrefixes: new Set(["state-"]),
      externalClasses: new Set(["leaflet-container"]),
    }),
    ["retired-grid"],
  );
});

test("findUnusedLocalePaths distinguishes exact and dictionary consumers", () => {
  const locale = {
    title: "Title",
    shell: { home: "Home", reports: "Reports" },
    errors: { failed: "Failed", unexpected: "Unexpected" },
  };

  assert.deepEqual(
    findUnusedLocalePaths(locale, new Set(["shell.home"]), new Set(["errors"])),
    ["shell.reports", "title"],
  );
});
