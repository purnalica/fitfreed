import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const expectedPins = Object.freeze([
  "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
  "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
  "actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9",
  "actions/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128",
]);

function requirePattern(errors, source, pattern, message) {
  if (!pattern.test(source)) errors.push(message);
}

function workflowConcurrency(source) {
  return source.match(/concurrency:\n  group: ([a-z0-9-]+)\n  cancel-in-progress: false/u)?.[1];
}

export function validatePagesWorkflows({ pages, release }) {
  const errors = [];
  const concurrencyGroup = workflowConcurrency(pages);
  if (!concurrencyGroup) errors.push("product Pages concurrency must preserve active publication");
  if (workflowConcurrency(release) !== concurrencyGroup) {
    errors.push("product and release Pages must use the same concurrency boundary");
  }

  requirePattern(errors, pages, /push:\n    branches:\n      - main/u, "Pages publication must follow main");
  requirePattern(errors, pages, /  workflow_dispatch:/u, "Pages publication must support accountable dispatch");
  requirePattern(errors, pages, /permissions:\n  contents: read/u, "Pages default permissions must be read-only");
  requirePattern(
    errors,
    pages,
    /permissions:\n      contents: read\n      id-token: write\n      pages: write/u,
    "Pages job permissions must be minimal",
  );
  requirePattern(errors, pages, /environment:\n      name: github-pages/u, "Pages must use the github-pages environment");
  requirePattern(errors, pages, /npm run check:product-surfaces/u, "Pages must verify product claims");
  requirePattern(errors, pages, /npm run check:site/u, "Pages must verify the source page");
  requirePattern(errors, pages, /npm run test:product-site/u, "Pages must test publication automation");
  requirePattern(errors, pages, /npm run build:pages/u, "Pages must use the canonical compositor");
  requirePattern(errors, pages, /npm run verify:pages:preflight/u, "Pages must run the update-preservation preflight");
  requirePattern(errors, pages, /npm run verify:pages:remote/u, "Pages must verify exact remote bytes");

  for (const pin of expectedPins) {
    if (!pages.includes(pin)) errors.push(`Pages action is missing its exact pin: ${pin}`);
  }
  if (/uses:\s+[^\s@]+@(?![0-9a-f]{40}(?:\s|$))/u.test(pages)) {
    errors.push("Pages actions must use immutable commit pins");
  }
  if (/\b(?:gh release|git tag|TAURI_SIGNING_PRIVATE_KEY|APPLE_|secrets\.)/u.test(pages)) {
    errors.push("product Pages publication must not receive release authority");
  }

  const orderedSteps = [
    "npm run check:product-surfaces",
    "npm run check:site",
    "npm run test:product-site",
    "npm run build:pages",
    "npm run verify:pages:preflight",
    "actions/upload-pages-artifact@",
    "actions/deploy-pages@",
    "npm run verify:pages:remote",
  ].map((step) => pages.indexOf(step));
  if (orderedSteps.some((index) => index < 0)
    || orderedSteps.some((index, position) => position > 0 && index <= orderedSteps[position - 1])) {
    errors.push("Pages evidence, composition, deployment, and remote verification order is invalid");
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return { concurrencyGroup, deploymentEnvironment: "github-pages" };
}

function run() {
  const pages = readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
  const release = readFileSync(
    new URL("../.github/workflows/public-release.yml", import.meta.url),
    "utf8",
  );
  process.stdout.write(`${JSON.stringify(validatePagesWorkflows({ pages, release }))}\n`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) run();
