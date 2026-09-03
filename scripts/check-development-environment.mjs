import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const commonCommands = ["cargo", "node", "npm", "rustc", "rustup"];
const macosCommands = [
  "ditto",
  "hdiutil",
  "openssl",
  "plutil",
  "shasum",
  "sqlite3",
  "strings",
  "xcode-select",
  "xcrun",
];
const linuxCommands = ["dpkg-deb", "pkg-config"];
const linuxModules = ["glib-2.0", "gio-2.0", "gobject-2.0", "gtk+-3.0", "webkit2gtk-4.1"];
const requiredRustComponents = ["clippy", "rustfmt"];

function semanticVersionParts(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? "");
  return match ? match.slice(1).map(Number) : undefined;
}

export function parseEngineRange(range) {
  const match = /^>=(\d+)\.(\d+)\.(\d+) <(\d+)$/.exec(range ?? "");
  if (!match) throw new Error(`unsupported engine range: ${range}`);
  return {
    maximumMajor: Number(match[4]),
    minimum: match.slice(1, 4).map(Number),
  };
}

export function versionInRange(version, range) {
  const actual = semanticVersionParts(version);
  if (!actual) return false;
  const { maximumMajor, minimum } = parseEngineRange(range);
  return actual[0] < maximumMajor && (
    actual[0] > minimum[0]
    || (actual[0] === minimum[0] && actual[1] > minimum[1])
    || (actual[0] === minimum[0] && actual[1] === minimum[1] && actual[2] >= minimum[2])
  );
}

function missingCommand(errors, facts, command) {
  if (!facts.availableCommands.has(command)) {
    errors.push(`${command} is not installed or is not available on PATH`);
  }
}

export function validateDevelopmentEnvironmentFacts(facts) {
  const errors = [];
  for (const command of commonCommands) missingCommand(errors, facts, command);
  if (!versionInRange(facts.nodeVersion, facts.nodeRange)) {
    const recommendation = facts.recommendedNodeVersion
      ? ` (recommended ${facts.recommendedNodeVersion})`
      : "";
    errors.push(
      `Node.js ${facts.nodeRange} is required; found ${facts.nodeVersion || "unavailable"}${recommendation}`,
    );
  }
  if (!versionInRange(facts.npmVersion, facts.npmRange)) {
    errors.push(`npm ${facts.npmRange} is required; found ${facts.npmVersion || "unavailable"}`);
  }
  if (facts.rustVersion !== facts.supportedRustVersion) {
    errors.push(
      `Rust ${facts.supportedRustVersion} is required; found ${facts.rustVersion || "unavailable"}`,
    );
  }
  for (const component of requiredRustComponents) {
    if (!facts.rustComponents.has(component)) {
      errors.push(`Rust component ${component} is required for toolchain ${facts.supportedRustVersion}`);
    }
  }

  if (facts.platform === "darwin") {
    for (const command of macosCommands) missingCommand(errors, facts, command);
    if (!facts.xcodeClangAvailable) {
      errors.push("the active Xcode developer directory does not provide clang");
    }
  } else if (facts.platform === "linux") {
    for (const command of linuxCommands) missingCommand(errors, facts, command);
    for (const module of linuxModules) {
      if (!facts.linuxModules?.has(module)) {
        errors.push(`the Tauri Linux development module ${module} is required`);
      }
    }
  } else if (facts.platform === "win32") {
    if (facts.architecture !== "x64" || facts.rustHost !== "x86_64-pc-windows-msvc") {
      errors.push("an x86-64 Windows MSVC host is required");
    }
  } else {
    errors.push(`unsupported desktop development platform: ${facts.platform}`);
  }

  if (errors.length > 0) {
    throw new Error(
      `Development environment check found ${errors.length} problem(s):\n${errors.join("\n")}`,
    );
  }
  return {
    architecture: facts.architecture,
    nodeVersion: facts.nodeVersion,
    npmVersion: facts.npmVersion,
    platform: facts.platform,
    rustHost: facts.rustHost,
    rustVersion: facts.rustVersion,
  };
}

function executableName(command, platform) {
  if (platform !== "win32") return command;
  if (command === "npm") return "npm.cmd";
  return ["cargo", "node", "rustc", "rustup"].includes(command) ? `${command}.exe` : command;
}

export function developmentCommandInvocation(
  command,
  arguments_,
  platform = process.platform,
  npmCliPath = process.env.npm_execpath,
  nodeExecutable = process.execPath,
) {
  if (platform === "win32" && command === "npm") {
    if (!npmCliPath) {
      throw new Error("the npm CLI path is unavailable; run this check with npm run doctor");
    }
    return {
      arguments: [npmCliPath, ...arguments_],
      program: nodeExecutable,
    };
  }
  return {
    arguments: arguments_,
    program: executableName(command, platform),
  };
}

function execute(program, arguments_) {
  return spawnSync(program, arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function commandAvailable(command, platform) {
  const result = platform === "win32"
    ? execute("where.exe", [executableName(command, platform)])
    : execute("which", [command]);
  return result.status === 0 && !result.error;
}

function commandOutput(command, arguments_, platform) {
  const invocation = developmentCommandInvocation(command, arguments_, platform);
  const result = execute(invocation.program, invocation.arguments);
  return result.status === 0 && !result.error ? result.stdout.trim() : "";
}

function readConfiguration() {
  const packageJson = JSON.parse(readFileSync(path.join(repositoryRoot, "package.json"), "utf8"));
  const rustToolchain = readFileSync(path.join(repositoryRoot, "rust-toolchain.toml"), "utf8");
  const supportedRustVersion = rustToolchain.match(/^channel = "([^"]+)"$/m)?.[1];
  if (!supportedRustVersion) throw new Error("rust-toolchain.toml has no pinned channel");
  return {
    nodeRange: packageJson.engines.node,
    npmRange: packageJson.engines.npm,
    recommendedNodeVersion: readFileSync(path.join(repositoryRoot, ".nvmrc"), "utf8").trim(),
    supportedRustVersion,
  };
}

export function inspectDevelopmentEnvironment(
  platform = process.platform,
  architecture = process.arch,
) {
  const configuration = readConfiguration();
  const platformCommands = platform === "darwin"
    ? macosCommands
    : platform === "linux"
      ? linuxCommands
      : [];
  const availableCommands = new Set(
    [...commonCommands, ...platformCommands].filter((command) => commandAvailable(command, platform)),
  );
  const rustVersionOutput = commandOutput("rustc", ["--version"], platform);
  const rustVersion = rustVersionOutput.match(/^rustc ([^ ]+)/)?.[1] ?? "";
  const rustHost = commandOutput("rustc", ["-vV"], platform).match(/^host: (.+)$/m)?.[1] ?? "";
  const rustComponentsOutput = configuration.supportedRustVersion
    ? commandOutput(
      "rustup",
      ["component", "list", "--toolchain", configuration.supportedRustVersion, "--installed"],
      platform,
    )
    : "";
  const rustComponents = new Set(
    requiredRustComponents.filter((component) => (
      rustComponentsOutput.split("\n").some((line) => line.startsWith(`${component}-`))
    )),
  );
  const installedLinuxModules = platform === "linux"
    ? new Set(linuxModules.filter((module) => (
      execute("pkg-config", ["--exists", module]).status === 0
    )))
    : undefined;
  const facts = {
    ...configuration,
    architecture,
    availableCommands,
    linuxModules: installedLinuxModules,
    nodeVersion: commandOutput("node", ["--version"], platform).replace(/^v/, ""),
    npmVersion: commandOutput("npm", ["--version"], platform),
    platform,
    rustComponents,
    rustHost,
    rustVersion,
    xcodeClangAvailable: platform === "darwin"
      ? execute("xcrun", ["--find", "clang"]).status === 0
      : undefined,
  };
  return validateDevelopmentEnvironmentFacts(facts);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const result = inspectDevelopmentEnvironment();
    process.stdout.write(
      `Development environment check passed for Node.js ${result.nodeVersion}, `
      + `npm ${result.npmVersion}, and Rust ${result.rustVersion} `
      + `on ${result.platform}/${result.architecture}.\n`,
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
