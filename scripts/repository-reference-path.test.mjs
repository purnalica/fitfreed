import assert from "node:assert/strict";
import { win32 } from "node:path";
import test from "node:test";

import { repositoryReferencePath } from "./repository-reference-path.mjs";

test("uses forward slashes for repository references derived from Windows paths", () => {
  assert.equal(
    repositoryReferencePath(
      "D:\\repository\\docs\\data-formats",
      "D:\\repository\\docs\\data-formats\\canonical\\daily-activity.md",
      win32,
    ),
    "canonical/daily-activity.md",
  );
});
