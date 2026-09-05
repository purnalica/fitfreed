import { fileURLToPath } from "node:url";

export function repositoryRootFromScriptUrl(moduleUrl, options) {
  return fileURLToPath(new URL("..", moduleUrl), options);
}
