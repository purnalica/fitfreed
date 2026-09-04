import assert from "node:assert/strict";
import test from "node:test";

import { createProductReleaseDownloads } from "./product-release-downloads.mjs";

function manifest(schemaVersion = 7) {
  const configurations = {
    3: {
      artifacts: [
        ["macos-disk-image", "FitFreed_0.3.0_aarch64.dmg"],
      ],
      targets: ["darwin-aarch64"],
    },
    6: {
      artifacts: [
        ["macos-disk-image", "FitFreed_0.3.0_aarch64.dmg"],
        ["linux-x86_64-deb", "FitFreed_0.3.0_amd64.deb"],
      ],
      targets: ["darwin-aarch64", "linux-x86_64-deb"],
    },
    7: {
      artifacts: [
        ["macos-disk-image", "FitFreed_0.3.0_aarch64.dmg"],
        ["linux-x86_64-deb", "FitFreed_0.3.0_amd64.deb"],
        ["windows-x86_64-nsis", "FitFreed_0.3.0_x64-setup.exe"],
      ],
      targets: [
        "darwin-aarch64",
        "linux-x86_64-deb",
        "windows-x86_64-nsis",
      ],
    },
  };
  const configuration = configurations[schemaVersion];
  return {
    schemaVersion,
    release: { channel: "public-stable", version: "0.3.0" },
    update: schemaVersion === 3 ? {} : { targets: configuration.targets },
    artifacts: configuration.artifacts.map(([kind, artifactPath]) => ({
      kind,
      path: artifactPath,
    })),
  };
}

test("derives immutable human downloads from each supported public manifest", () => {
  for (const [schemaVersion, expectedTargets] of [
    [3, ["darwin-aarch64"]],
    [6, ["darwin-aarch64", "linux-x86_64-deb"]],
    [7, ["darwin-aarch64", "linux-x86_64-deb", "windows-x86_64-nsis"]],
  ]) {
    const result = createProductReleaseDownloads(manifest(schemaVersion));
    assert.equal(result.version, "0.3.0");
    assert.equal(
      result.releaseUrl,
      "https://github.com/purnalica/fitfreed/releases/tag/v0.3.0",
    );
    assert.deepEqual(result.platforms.map(({ target }) => target), expectedTargets);
    for (const platform of result.platforms) {
      assert.match(
        platform.url,
        /^https:\/\/github\.com\/purnalica\/fitfreed\/releases\/download\/v0\.3\.0\/FitFreed_0\.3\.0_/u,
      );
    }
  }
});

test("rejects unsupported, incomplete, and misleading download evidence", () => {
  const unsupported = manifest();
  unsupported.schemaVersion = 8;
  const wrongChannel = manifest();
  wrongChannel.release.channel = "development";
  const missingWindows = manifest();
  missingWindows.artifacts.pop();
  const duplicateWindows = manifest();
  duplicateWindows.artifacts.push({ ...duplicateWindows.artifacts.at(-1) });
  const unsafePath = manifest();
  unsafePath.artifacts.at(-1).path = "nested/FitFreed_0.3.0_x64-setup.exe";
  const incompleteTargets = manifest();
  incompleteTargets.update.targets.pop();

  for (const [candidate, expected] of [
    [unsupported, /unsupported public release manifest/u],
    [wrongChannel, /public stable release/u],
    [missingWindows, /exactly one windows-x86_64-nsis/u],
    [duplicateWindows, /exactly one windows-x86_64-nsis/u],
    [unsafePath, /flat safe filename/u],
    [incompleteTargets, /target set/u],
  ]) assert.throws(() => createProductReleaseDownloads(candidate), expected);
});
