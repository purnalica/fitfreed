import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createLinuxPackageInventory,
  generateLinuxPackageInventory,
  validateLinuxPackageInventory,
} from "./linux-package-inventory.mjs";

function writeExtractedPackageTree(extractedRoot) {
  mkdirSync(path.join(extractedRoot, "usr/bin"), { recursive: true });
  mkdirSync(path.join(extractedRoot, "usr/share/applications"), { recursive: true });
  mkdirSync(path.join(extractedRoot, "usr/share/doc/fitfreed"), { recursive: true });
  mkdirSync(path.join(extractedRoot, "usr/share/icons/hicolor/32x32/apps"), {
    recursive: true,
  });
  mkdirSync(path.join(extractedRoot, "usr/share/icons/hicolor/128x128/apps"), {
    recursive: true,
  });
  writeFileSync(path.join(extractedRoot, "usr/bin/fitfreed"), "synthetic executable", {
    mode: 0o755,
  });
  writeFileSync(
    path.join(extractedRoot, "usr/share/applications/fitfreed.desktop"),
    "[Desktop Entry]\nName=FitFreed\n",
  );
  writeFileSync(
    path.join(extractedRoot, "usr/share/doc/fitfreed/copyright"),
    "GNU GENERAL PUBLIC LICENSE\nVersion 3\n",
  );
  writeFileSync(
    path.join(extractedRoot, "usr/share/icons/hicolor/32x32/apps/fitfreed.png"),
    "synthetic 32 pixel icon",
  );
  writeFileSync(
    path.join(extractedRoot, "usr/share/icons/hicolor/128x128/apps/fitfreed.png"),
    "synthetic 128 pixel icon",
  );
  symlinkSync("fitfreed", path.join(extractedRoot, "usr/bin/fitfreed-current"));
}

function fixture(context) {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-linux-inventory-test-"));
  context.after(() => rmSync(root, { force: true, recursive: true }));
  const packagePath = path.join(root, "FitFreed_0.1.0_amd64.deb");
  const extractedRoot = path.join(root, "extracted");
  writeExtractedPackageTree(extractedRoot);
  writeFileSync(packagePath, "synthetic Debian bytes");
  return { extractedRoot, packagePath };
}

function control() {
  return {
    Package: "fitfreed",
    Version: "0.1.0",
    Architecture: "amd64",
    Maintainer: "FitFreed contributors",
    Section: "utils",
    Priority: "optional",
    Homepage: "https://fitfreed.org/",
    Description: "Explore your fitness history on your own computer.\nComplete description.",
    Depends: "libwebkit2gtk-4.1-0 (>= 2.42), libgtk-3-0 | libgtk-3-1",
  };
}

test("creates one deterministic exact Debian package inventory", (context) => {
  const input = fixture(context);
  const inventory = createLinuxPackageInventory({ ...input, control: control() });

  assert.equal(validateLinuxPackageInventory(inventory), inventory);
  assert.equal(inventory.format, "org.fitfreed.linux-package-inventory");
  assert.equal(inventory.schemaVersion, 1);
  assert.deepEqual(inventory.target, {
    architecture: "amd64",
    distributionFamily: "debian",
    packageFormat: "deb",
  });
  assert.equal(inventory.artifact.path, "FitFreed_0.1.0_amd64.deb");
  assert.match(inventory.artifact.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(inventory.control.dependencyNames, [
    "libgtk-3-0",
    "libgtk-3-1",
    "libwebkit2gtk-4.1-0",
  ]);
  assert.deepEqual(
    inventory.entries.map(({ path: entryPath }) => entryPath),
    [...inventory.entries.map(({ path: entryPath }) => entryPath)].sort((left, right) =>
      Buffer.compare(Buffer.from(left), Buffer.from(right))),
  );
  assert.deepEqual(
    inventory.entries.find(({ path: entryPath }) => entryPath === "usr/bin/fitfreed-current"),
    {
      mode: "0777",
      path: "usr/bin/fitfreed-current",
      target: "fitfreed",
      type: "symbolic-link",
    },
  );
  assert.match(
    inventory.entries.find(({ path: entryPath }) => entryPath === "usr/bin/fitfreed").sha256,
    /^[0-9a-f]{64}$/,
  );
});

test("rejects identity drift, unsafe links, unordered entries, and undeclared fields", (context) => {
  const input = fixture(context);
  const inventory = createLinuxPackageInventory({ ...input, control: control() });
  inventory.target.architecture = "arm64";
  inventory.control.packageName = "another";
  inventory.control.dependencyNames.reverse();
  inventory.entries.reverse();
  const symbolicLink = inventory.entries.find(({ type }) => type === "symbolic-link");
  symbolicLink.mode = "0755";
  symbolicLink.target = "../../../outside";
  inventory.localPath = "/private/machine/path";

  assert.throws(
    () => validateLinuxPackageInventory(inventory),
    (error) => {
      for (const fragment of [
        "schema violation",
        "target architecture",
        "package name",
        "dependency names",
        "inventory entries",
        "symbolic link",
      ]) {
        assert.match(error.message, new RegExp(fragment));
      }
      return true;
    },
  );
});

test("extracts the exact Debian artifact and writes one deterministic adjacent inventory", (context) => {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-linux-inventory-command-test-"));
  context.after(() => rmSync(root, { force: true, recursive: true }));
  const packagePath = path.join(root, "FitFreed_0.1.0_amd64.deb");
  writeFileSync(packagePath, "synthetic Debian bytes");
  const commands = [];
  const run = (file, arguments_) => {
    commands.push([file, ...arguments_]);
    if (arguments_[0] === "--field") return `${Object.entries(control())
      .map(([key, value]) => `${key}: ${value.replaceAll("\n", "\n ")}`)
      .join("\n")}\n`;
    writeExtractedPackageTree(arguments_[2]);
    return "";
  };

  const first = generateLinuxPackageInventory({
    platform: "linux",
    releaseDirectory: root,
    run,
    version: "0.1.0",
  });
  const firstBytes = readFileSync(first.inventoryPath, "utf8");
  const second = generateLinuxPackageInventory({
    platform: "linux",
    releaseDirectory: root,
    run,
    version: "0.1.0",
  });

  assert.equal(
    path.basename(first.inventoryPath),
    "FitFreed_0.1.0_amd64.deb.inventory.json",
  );
  assert.equal(readFileSync(second.inventoryPath, "utf8"), firstBytes);
  assert.equal(first.entryCount > 4, true);
  assert.match(first.artifactSha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(commands[0], ["dpkg-deb", "--field", packagePath]);
  assert.deepEqual(commands[1].slice(0, 3), ["dpkg-deb", "--extract", packagePath]);
});

test("preserves prior inventory evidence when extraction fails", (context) => {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-linux-inventory-failure-test-"));
  context.after(() => rmSync(root, { force: true, recursive: true }));
  writeFileSync(path.join(root, "FitFreed_0.1.0_amd64.deb"), "synthetic Debian bytes");
  const inventoryPath = path.join(root, "FitFreed_0.1.0_amd64.deb.inventory.json");
  writeFileSync(inventoryPath, "prior evidence\n");
  let invocation = 0;

  assert.throws(
    () => generateLinuxPackageInventory({
      platform: "linux",
      releaseDirectory: root,
      run: () => {
        invocation += 1;
        if (invocation === 1) return "Package: fitfreed\n";
        throw new Error("private extraction detail");
      },
      version: "0.1.0",
    }),
    /Debian package inventory generation failed during extraction/,
  );
  assert.equal(readFileSync(inventoryPath, "utf8"), "prior evidence\n");
  assert.equal(
    existsSync(path.join(root, "FitFreed_0.1.0_amd64.deb.inventory.json.tmp")),
    false,
  );
});

test("keeps the schema and normative package-inventory documentation discoverable", () => {
  const document = readFileSync(
    new URL("../docs/data-formats/release/linux-package-inventory-v1.md", import.meta.url),
    "utf8",
  );
  const index = readFileSync(new URL("../docs/data-formats/README.md", import.meta.url), "utf8");
  for (const value of [
    "org.fitfreed.linux-package-inventory",
    "schemaVersion",
    "distributionFamily",
    "packageFormat",
    "dependencyExpression",
    "dependencyNames",
    "symbolic-link",
    "FitFreed_0.1.0_amd64.deb.inventory.json",
  ]) {
    assert.match(document, new RegExp(value.replaceAll(".", "\\.")));
  }
  assert.match(index, /release\/linux-package-inventory-v1\.md/);
});
