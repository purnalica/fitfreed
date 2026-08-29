import { execFileSync } from "node:child_process";
import {
  readFileSync,
} from "node:fs";
import path from "node:path";

import {
  bundleFiles,
  inspectBundleFiles,
} from "./bundle-content-policy.mjs";
import {
  validateX6ReviewBundleFacts,
  x6ReviewApplicationBundle,
  x6ReviewIdentifier,
} from "./x6-human-review-profile.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
function command(program, arguments_) {
  return execFileSync(program, arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function minimumMacos(binary) {
  const lines = command("otool", ["-l", binary]).split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const commandName = lines[index].trim();
    if (commandName !== "cmd LC_BUILD_VERSION" && commandName !== "cmd LC_VERSION_MIN_MACOSX") {
      continue;
    }
    for (let detail = index + 1; detail < Math.min(index + 8, lines.length); detail += 1) {
      const match = lines[detail].trim().match(/^(?:minos|version) ([0-9.]+)/);
      if (match) return match[1];
    }
  }
  return "";
}

if (process.platform !== "darwin") {
  throw new Error("X6 human-review bundle inspection requires macOS");
}

const revision = command("git", ["rev-parse", "HEAD"]);
const status = command("git", ["status", "--porcelain=v1", "--untracked-files=all"]);
if (status.length !== 0) throw new Error("X6 human-review inspection requires a clean source tree");

const informationPlist = path.join(x6ReviewApplicationBundle, "Contents/Info.plist");
const binary = path.join(x6ReviewApplicationBundle, "Contents/MacOS/fitfreed");
const files = bundleFiles(x6ReviewApplicationBundle);
const binaryContent = readFileSync(binary);
const contentFindings = inspectBundleFiles(files);
const facts = {
  bundleIdentifier: command("plutil", ["-extract", "CFBundleIdentifier", "raw", "-o", "-", informationPlist]),
  bundleExecutable: command("plutil", ["-extract", "CFBundleExecutable", "raw", "-o", "-", informationPlist]),
  bundleMinimumMacos: command("plutil", ["-extract", "LSMinimumSystemVersion", "raw", "-o", "-", informationPlist]),
  binaryMinimumMacos: minimumMacos(binary),
  embeddedSourceRevision: binaryContent.includes(Buffer.from(revision)),
  ...contentFindings,
};

validateX6ReviewBundleFacts(facts, revision);
process.stdout.write(`${JSON.stringify({
  bundleIdentifier: x6ReviewIdentifier(revision),
  sourceRevision: revision,
  nativeProductionAdapters: true,
})}\n`);
