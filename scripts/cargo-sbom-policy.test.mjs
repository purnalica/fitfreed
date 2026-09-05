import assert from "node:assert/strict";
import test from "node:test";

import {
  cargoCycloneDxArguments,
  productionCargoDependenciesFromMetadata,
} from "./prepare-development-release.mjs";

test("generates a release inventory for every Cargo target", () => {
  assert.deepEqual(
    cargoCycloneDxArguments(".fitfreed-release-test"),
    [
      "cyclonedx",
      "--manifest-path",
      "src-tauri/Cargo.toml",
      "--format",
      "json",
      "--no-build-deps",
      "--spec-version",
      "1.5",
      "--target",
      "all",
      "--override-filename",
      ".fitfreed-release-test",
    ],
  );
});

test("requires direct production dependencies from every Cargo target", () => {
  const metadata = {
    workspace_members: ["fitfreed 0.1.0"],
    packages: [
      {
        id: "fitfreed 0.1.0",
        name: "fitfreed",
        dependencies: [
          { kind: null, name: "serde", optional: false, target: null },
          {
            kind: null,
            name: "windows-sys",
            optional: false,
            target: "cfg(target_os = \"windows\")",
          },
          { kind: "dev", name: "tempfile", optional: false, target: null },
        ],
      },
    ],
  };

  assert.deepEqual(
    productionCargoDependenciesFromMetadata(metadata),
    new Map([["fitfreed", ["serde", "windows-sys"]]]),
  );
});
