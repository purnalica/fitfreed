import assert from "node:assert/strict";
import test from "node:test";

import { repositoryRootFromScriptUrl } from "./module-path.mjs";

test("resolves a repository root from a Windows script URL without duplicating the drive", () => {
  assert.equal(
    repositoryRootFromScriptUrl(
      "file:///D:/a/fitfreed/fitfreed/scripts/check-product-page.mjs",
      { windows: true },
    ),
    "D:\\a\\fitfreed\\fitfreed\\",
  );
});

test("resolves a repository root from a POSIX script URL", () => {
  assert.equal(
    repositoryRootFromScriptUrl(
      "file:///srv/ci/fitfreed/fitfreed/scripts/check-product-page.mjs",
      { windows: false },
    ),
    "/srv/ci/fitfreed/fitfreed/",
  );
});
