import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  findLinuxDebianPackage,
  parseDebianControl,
  validateLinuxDebianPackageFacts,
} from "./verify-linux-debian-package.mjs";

const expectedVersion = "0.1.0";

function validFacts() {
  return {
    packagePath: "/release/FitFreed_0.1.0_amd64.deb",
    control: parseDebianControl(`Package: fitfreed
Version: 0.1.0
Architecture: amd64
Maintainer: FitFreed contributors
Section: utils
Priority: optional
Homepage: https://fitfreed.org/
Depends: libwebkit2gtk-4.1-0, libgtk-3-0
Description: Explore your fitness history on your own computer.
 FitFreed keeps its library local.
`),
    entries: [
      "usr/bin/fitfreed",
      "usr/share/applications/FitFreed.desktop",
      "usr/share/doc/fitfreed/copyright",
      "usr/share/icons/hicolor/32x32/apps/fitfreed.png",
      "usr/share/icons/hicolor/128x128/apps/fitfreed.png",
      "usr/share/icons/hicolor/256x256@2/apps/fitfreed.png",
    ],
    executableMode: 0o755,
    desktopEntry: `[Desktop Entry]
Type=Application
Name=FitFreed
Exec=fitfreed
Icon=fitfreed
Terminal=false
Categories=Utility;
`,
    licenseText: "GNU GENERAL PUBLIC LICENSE\nVersion 3",
  };
}

test("parses Debian control continuation fields without losing their meaning", () => {
  const control = parseDebianControl(`Package: fitfreed
Description: First line
 second line
 .
 fourth line
Depends: one (>= 1), two | three
`);

  assert.deepEqual(control, {
    Package: "fitfreed",
    Description: "First line\nsecond line\n\nfourth line",
    Depends: "one (>= 1), two | three",
  });
});

test("accepts the exact first Linux package identity and installed layout", () => {
  assert.deepEqual(validateLinuxDebianPackageFacts(validFacts(), expectedVersion), {
    architecture: "amd64",
    dependencyNames: ["libgtk-3-0", "libwebkit2gtk-4.1-0"],
    packageName: "fitfreed",
    version: expectedVersion,
  });
});

test("rejects identity, dependency, layout, executable, desktop, and license drift together", () => {
  const facts = validFacts();
  facts.packagePath = "/release/another_1.2.3_arm64.deb";
  facts.control = {
    ...facts.control,
    Package: "another",
    Version: "1.2.3",
    Architecture: "arm64",
    Maintainer: "",
    Section: "games",
    Priority: "required",
    Homepage: "https://example.invalid/",
    Depends: "libgtk-3-0",
    Description: "Another application",
  };
  facts.entries = ["usr/bin/another", "usr/share/applications/another.desktop"];
  facts.executableMode = 0o644;
  facts.desktopEntry = "[Desktop Entry]\nType=Application\nName=Another\nTerminal=true\n";
  facts.licenseText = "All rights reserved";

  assert.throws(
    () => validateLinuxDebianPackageFacts(facts, expectedVersion),
    (error) => {
      for (const fragment of [
        "Debian artifact name",
        "package name",
        "package version",
        "package architecture",
        "package maintainer",
        "package section",
        "package priority",
        "package homepage",
        "package description",
        "libwebkit2gtk-4.1-0",
        "production executable",
        "desktop entry",
        "application icons",
        "GPL-3.0 license text",
      ]) {
        assert.match(error.message, new RegExp(fragment));
      }
      return true;
    },
  );
});

test("finds one exact Debian artifact and rejects missing or ambiguous output", (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), "fitfreed-linux-package-test-"));
  context.after(() => rmSync(directory, { force: true, recursive: true }));
  const expected = path.join(directory, "FitFreed_0.1.0_amd64.deb");
  writeFileSync(expected, "synthetic package");
  assert.equal(findLinuxDebianPackage(directory, expectedVersion), expected);

  writeFileSync(path.join(directory, "unexpected.deb"), "synthetic package");
  assert.throws(
    () => findLinuxDebianPackage(directory, expectedVersion),
    /exactly one Debian artifact/,
  );

  const emptyDirectory = path.join(directory, "empty");
  mkdirSync(emptyDirectory);
  assert.throws(
    () => findLinuxDebianPackage(emptyDirectory, expectedVersion),
    /exactly one Debian artifact/,
  );
});
