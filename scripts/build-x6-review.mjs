import { buildX6ReviewPackage } from "./x6-human-review-profile.mjs";

try {
  buildX6ReviewPackage();
} catch (error) {
  process.stderr.write(`X6 human-review build failed: ${error.message}\n`);
  process.exitCode = 1;
}
