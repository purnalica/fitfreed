import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  linuxPackagedE2eContract,
  resolveLinuxE2eDebianPackage,
  validateLinuxE2eDebianMetadata,
} from "./run-packaged-linux-e2e.mjs";

test("defines an installed E2E package that cannot replace FitFreed", () => {
  assert.deepEqual(linuxPackagedE2eContract, {
    architecture: "amd64",
    executablePath: "/usr/bin/fitfreed-e2e",
    packageName: "fitfreed-e2e",
    platform: "linux",
  });
});

test("resolves exactly one generated Debian package", () => {
  const directory = path.resolve("src-tauri/target/e2e/release/bundle/deb");
  assert.equal(
    resolveLinuxE2eDebianPackage(directory, ["fitfreed-e2e_0.1.0_amd64.deb"]),
    path.join(directory, "fitfreed-e2e_0.1.0_amd64.deb"),
  );
  assert.throws(
    () => resolveLinuxE2eDebianPackage(directory, []),
    /exactly one/,
  );
  assert.throws(
    () => resolveLinuxE2eDebianPackage(directory, ["first.deb", "second.deb"]),
    /exactly one/,
  );
  assert.throws(
    () => resolveLinuxE2eDebianPackage(directory, ["../outside.deb"]),
    /safe file name/,
  );
});

test("accepts only the isolated package metadata and executable", () => {
  assert.deepEqual(validateLinuxE2eDebianMetadata({
    architecture: "amd64",
    fileListing: [
      "drwxr-xr-x root/root         0 2026-09-03 00:00 ./usr/bin/",
      "-rwxr-xr-x root/root   1000000 2026-09-03 00:00 ./usr/bin/fitfreed-e2e",
    ].join("\n"),
    packageName: "fitfreed-e2e",
    version: "0.1.0",
  }), {
    architecture: "amd64",
    executablePath: "/usr/bin/fitfreed-e2e",
    packageName: "fitfreed-e2e",
    version: "0.1.0",
  });

  for (const metadata of [
    {
      architecture: "amd64",
      fileListing: "-rwxr-xr-x root/root 1 2026-09-03 00:00 ./usr/bin/fitfreed-e2e",
      packageName: "fitfreed",
      version: "0.1.0",
    },
    {
      architecture: "arm64",
      fileListing: "-rwxr-xr-x root/root 1 2026-09-03 00:00 ./usr/bin/fitfreed-e2e",
      packageName: "fitfreed-e2e",
      version: "0.1.0",
    },
    {
      architecture: "amd64",
      fileListing: "-rwxr-xr-x root/root 1 2026-09-03 00:00 ./usr/bin/fitfreed",
      packageName: "fitfreed-e2e",
      version: "0.1.0",
    },
  ]) {
    assert.throws(() => validateLinuxE2eDebianMetadata(metadata), /invalid/);
  }
});

test("runs installed Linux capability parity only inside complete hosted verification", () => {
  const packageManifest = JSON.parse(readFileSync(path.resolve("package.json"), "utf8"));
  const workflow = readFileSync(path.resolve(".github/workflows/ci.yml"), "utf8");
  const job = workflow.match(
    /  packaged-linux-e2e:\n(?<body>[\s\S]*?)(?=\n  [a-z][\w-]+:\n)/,
  )?.groups?.body ?? "";

  assert.equal(
    packageManifest.scripts["verify:linux-e2e"],
    "npm run prebuild:e2e && npm run build:e2e:linux-package && npm run test:e2e:linux-package",
  );
  assert.equal(
    packageManifest.scripts["build:e2e:linux-package"],
    "node scripts/build-linux-e2e-package.mjs",
  );
  assert.equal(
    packageManifest.scripts["test:e2e:linux-package"],
    "node scripts/run-packaged-linux-e2e.mjs",
  );
  assert.match(job, /^    needs: quality$/m);
  assert.match(job, /^    if: needs\.quality\.outputs\.full-verification == 'true'$/m);
  assert.match(job, /^    runs-on: ubuntu-24\.04$/m);
  assert.match(job, /webkit2gtk-driver/);
  assert.match(job, /xvfb-run -a npm run verify:linux-e2e/);
  assert.match(job, /\.artifacts\/e2e\/evidence/);
  assert.match(
    workflow,
    /needs: \[quality, packaged-macos-e2e, packaged-linux-e2e, packaged-linux-update-e2e\]/,
  );
  assert.match(workflow, /needs\.packaged-linux-e2e\.result == 'success'/);
});
