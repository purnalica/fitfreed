import { relative, sep } from "node:path";

const currentPlatformPath = Object.freeze({ relative, sep });

export function repositoryReferencePath(from, to, pathApi = currentPlatformPath) {
  return pathApi.relative(from, to).split(pathApi.sep).join("/");
}
