import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { prepareCurrentPublicPages } from "./public-release-remote.mjs";

const semanticVersion =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export function productPagesDeploymentDecision({ publicVersion, sourceVersion }) {
  if (!semanticVersion.test(sourceVersion ?? "")) {
    throw new Error("product Pages source version is invalid");
  }
  if (!semanticVersion.test(publicVersion ?? "")) {
    throw new Error("product Pages public version is invalid");
  }
  return sourceVersion === publicVersion
    ? { deploy: true, reason: "source-version-is-public" }
    : { deploy: false, reason: "source-version-is-unreleased" };
}

async function main() {
  const repositoryRoot = path.resolve(import.meta.dirname, "..");
  const [output = ".artifacts/pages"] = process.argv.slice(2);
  const result = await prepareCurrentPublicPages({
    pagesDirectory: path.resolve(repositoryRoot, output),
  });
  const { version: sourceVersion } = JSON.parse(
    readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
  );
  const deployment = productPagesDeploymentDecision({
    publicVersion: result.version,
    sourceVersion,
  });
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `deploy=${deployment.deploy}\n`, "utf8");
  }
  process.stdout.write(`${JSON.stringify({ ...result, deployment })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`Public Pages preparation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
