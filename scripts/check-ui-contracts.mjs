import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stylesheetPath = path.join(repositoryRoot, "src", "App.css");
const stylesheet = readFileSync(stylesheetPath, "utf8");
const reducedMotionQuery = "@media (prefers-reduced-motion: no-preference)";
const queryStart = stylesheet.indexOf(reducedMotionQuery);
if (queryStart < 0) {
  throw new Error("App.css must define the reduced-motion animation boundary");
}

const blockStart = stylesheet.indexOf("{", queryStart);
let depth = 0;
let blockEnd = -1;
for (let index = blockStart; index < stylesheet.length; index += 1) {
  if (stylesheet[index] === "{") depth += 1;
  if (stylesheet[index] === "}") {
    depth -= 1;
    if (depth === 0) {
      blockEnd = index;
      break;
    }
  }
}
if (blockEnd < 0) throw new Error("reduced-motion media block is not balanced");

const motionDeclarations = [
  ...stylesheet.matchAll(/\b(?:animation(?:-[a-z-]+)?|transition(?:-[a-z-]+)?):/g),
];
for (const declaration of motionDeclarations) {
  if (declaration.index < blockStart || declaration.index > blockEnd) {
    throw new Error(
      `motion declaration outside ${reducedMotionQuery} at offset ${declaration.index}`,
    );
  }
}

const darkQuery = "@media (prefers-color-scheme: dark)";
const darkStart = stylesheet.indexOf(darkQuery);
if (darkStart < 0) throw new Error("App.css must define the dark appearance boundary");
const nextMediaStart = stylesheet.indexOf("@media", darkStart + darkQuery.length);
const darkBlock = stylesheet.slice(
  darkStart,
  nextMediaStart < 0 ? stylesheet.length : nextMediaStart,
);
const contrastContracts = new Map([
  [".eyebrow", "--accent-deep"],
  [".source-path > span", "--muted"],
  [".notice", "--ink"],
  [".error", "--danger-ink"],
  [".recovery-summary span", "--ink-soft"],
]);
const explicitDarkStart = stylesheet.indexOf(':root[data-appearance="dark"]');
if (explicitDarkStart < 0) throw new Error("App.css must define explicit dark appearance tokens");
const explicitDarkEnd = stylesheet.indexOf("}", explicitDarkStart);
const explicitDarkBlock = stylesheet.slice(explicitDarkStart, explicitDarkEnd);
for (const [selector, token] of contrastContracts) {
  const escapedSelector = selector.replace(".", "\\.");
  const foregroundRule = new RegExp(
    `${escapedSelector}\\s*\\{[^}]*\\bcolor:\\s*var\\(${token}\\)`,
  );
  if (!foregroundRule.test(stylesheet)) {
    throw new Error(`${selector} must use its contrast foreground token ${token}`);
  }
  if (!explicitDarkBlock.includes(`${token}:`) || !darkBlock.includes(`${token}:`)) {
    throw new Error(`${token} must exist for explicit and system dark appearance`);
  }
}

process.stdout.write(
  `${JSON.stringify({ motionDeclarations: motionDeclarations.length, reducedMotionBoundary: true, darkContrastOverrides: contrastContracts.size })}\n`,
);
