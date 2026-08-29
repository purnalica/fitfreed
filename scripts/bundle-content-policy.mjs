import {
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testRoutingMarkers = [
  "__wdio_mocks__",
  "instrumented archive picker",
  "instrumented official-link adapter",
  "open-instrumented-archive-picker",
  "open-instrumented-official-source-link",
  "TAURI_WEBDRIVER_PORT",
  "tauri-plugin-wdio",
  "wdio-webdriver",
];
const machineLocalPathMarkers = [
  ["macOS user-home path", "/Users/"],
  ["Linux user-home path", "/home/"],
  ["Linux root-home path", "/root/"],
  ["POSIX temporary path", "/tmp/"],
  ["macOS temporary path", "/private/var/folders/"],
  ["macOS temporary path", "/var/folders/"],
  ["Windows user-home path", ":\\Users\\"],
  ["Windows user-home path", ":/Users/"],
];

export function bundleFiles(root) {
  return readdirSync(root, { recursive: true })
    .map((relativePath) => path.join(root, relativePath))
    .filter((candidate) => statSync(candidate).isFile());
}

export function inspectBundleBuffers(buffers) {
  const machinePaths = new Set();
  const testRouting = new Set();
  for (const content of buffers) {
    for (const marker of testRoutingMarkers) {
      if (content.includes(Buffer.from(marker))) testRouting.add(marker);
    }
    for (const [label, marker] of machineLocalPathMarkers) {
      if (content.includes(Buffer.from(marker))) machinePaths.add(label);
    }
  }
  return {
    machineLocalPathMarkers: [...machinePaths].sort(),
    testRoutingMarkers: [...testRouting].sort(),
  };
}

export function inspectBundleFiles(files) {
  function* contents() {
    for (const file of files) yield readFileSync(file);
  }
  return inspectBundleBuffers(contents());
}

export function validateBundleContentFindings(findings) {
  if (findings.machineLocalPathMarkers.length !== 0) {
    throw new Error(
      `bundle contains machine-local paths: ${findings.machineLocalPathMarkers.join(", ")}`,
    );
  }
  if (findings.testRoutingMarkers.length !== 0) {
    throw new Error(
      `bundle contains test-only routing: ${findings.testRoutingMarkers.join(", ")}`,
    );
  }
  return true;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const bundle = process.argv[2];
    if (typeof bundle !== "string" || bundle.length === 0) {
      throw new Error("bundle path is required");
    }
    validateBundleContentFindings(inspectBundleFiles(bundleFiles(bundle)));
    process.stdout.write("Bundle content policy passed.\n");
  } catch (error) {
    process.stderr.write(`Bundle content policy failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
