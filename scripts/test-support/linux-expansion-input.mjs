import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createLinuxPackageInventory } from "../linux-package-inventory.mjs";

export function createLinuxExpansionInputFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-linux-expansion-input-"));
  const buildDirectory = path.join(root, "build");
  const outputDirectory = path.join(root, "input");
  mkdirSync(buildDirectory);
  const version = "0.2.0";
  const revision = "a".repeat(40);
  const packageName = `FitFreed_${version}_amd64.deb`;
  const packagePath = path.join(buildDirectory, packageName);
  writeFileSync(packagePath, "exact unsigned Debian package bytes");
  const extractedRoot = path.join(root, "extracted");
  for (const directory of [
    "usr/bin",
    "usr/share/applications",
    "usr/share/doc/fitfreed",
    "usr/share/icons/hicolor/32x32/apps",
    "usr/share/icons/hicolor/128x128/apps",
  ]) mkdirSync(path.join(extractedRoot, directory), { recursive: true });
  writeFileSync(path.join(extractedRoot, "usr/bin/fitfreed"), "executable");
  chmodSync(path.join(extractedRoot, "usr/bin/fitfreed"), 0o755);
  for (const file of [
    "usr/share/applications/fitfreed.desktop",
    "usr/share/doc/fitfreed/copyright",
    "usr/share/icons/hicolor/32x32/apps/fitfreed.png",
    "usr/share/icons/hicolor/128x128/apps/fitfreed.png",
  ]) writeFileSync(path.join(extractedRoot, file), file);
  const inventory = createLinuxPackageInventory({
    control: {
      Architecture: "amd64",
      Depends: "libgtk-3-0, libwebkit2gtk-4.1-0",
      Description: "Explore fitness history",
      Homepage: "https://fitfreed.org/",
      Maintainer: "FitFreed contributors",
      Package: "fitfreed",
      Priority: "optional",
      Section: "utils",
      Version: version,
    },
    extractedRoot,
    packagePath,
  });
  const inventoryPath = path.join(buildDirectory, `${packageName}.inventory.json`);
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
  return {
    inventoryPath,
    outputDirectory,
    packageName,
    packagePath,
    revision,
    root,
    version,
  };
}
