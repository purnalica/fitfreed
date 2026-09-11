import path from "node:path";
import { fileURLToPath } from "node:url";

import { prepareCurrentPublicPages } from "./public-release-remote.mjs";

async function main() {
  const repositoryRoot = path.resolve(import.meta.dirname, "..");
  const [output = ".artifacts/pages"] = process.argv.slice(2);
  const result = await prepareCurrentPublicPages({
    pagesDirectory: path.resolve(repositoryRoot, output),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`Public Pages preparation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
