import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validatePagesWorkflows } from "./pages-workflow.mjs";

const pages = readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
const release = readFileSync(
  new URL("../.github/workflows/public-release.yml", import.meta.url),
  "utf8",
);

test("accepts the product and release Pages workflows as one serialized publication surface", () => {
  assert.deepEqual(validatePagesWorkflows({ pages, release }), {
    concurrencyGroup: "fitfreed-pages-publication",
    deploymentEnvironment: "github-pages",
  });
});

test("rejects publication that can erase, race, or bypass verified product evidence", () => {
  const mutations = [
    [(source) => source.replace("cancel-in-progress: false", "cancel-in-progress: true"), /concurrency/u],
    [(source) => source.replace("npm run verify:pages:preflight", "node -e true"), /preflight/u],
    [(source) => source.replace("npm run check:site", "node -e true"), /source page/u],
    [(source) => source.replace("npm run build:pages", "cp -R site .artifacts/pages"), /compositor/u],
    [(source) => source.replace("npm run verify:pages:remote", "node -e true"), /remote/u],
    [(source) => source.replace("contents: read\n      id-token", "contents: write\n      id-token"), /permissions/u],
  ];
  for (const [mutate, expected] of mutations) {
    assert.throws(() => validatePagesWorkflows({ pages: mutate(pages), release }), expected);
  }
  assert.throws(
    () => validatePagesWorkflows({
      pages,
      release: release.replace(
        "group: fitfreed-pages-publication",
        "group: public-macos-release",
      ),
    }),
    /same concurrency/u,
  );
});
