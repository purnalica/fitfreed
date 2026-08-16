import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const excludedDirectories = new Set([".git", ".local", ".tools", "node_modules", "target"]);
const failures = [];
let checkedLinks = 0;

function markdownFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...markdownFiles(entryPath));
    if (entry.isFile() && entry.name.endsWith(".md")) files.push(entryPath);
  }
  return files;
}

for (const markdownPath of markdownFiles(repositoryRoot)) {
  if (markdownPath.startsWith(path.join(repositoryRoot, "docs", "reports"))) continue;
  const content = readFileSync(markdownPath, "utf8");
  const links = content.matchAll(/!?(?:\[[^\]]*\])\(([^)]+)\)/g);
  for (const match of links) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, "").split(/\s+['\"]/)[0];
    if (
      rawTarget.length === 0 ||
      rawTarget.startsWith("#") ||
      /^[a-z][a-z0-9+.-]*:/i.test(rawTarget)
    ) {
      continue;
    }
    const fileTarget = decodeURIComponent(rawTarget.split("#")[0]);
    const resolvedTarget = path.resolve(path.dirname(markdownPath), fileTarget);
    checkedLinks += 1;
    if (!existsSync(resolvedTarget)) {
      failures.push(
        `${path.relative(repositoryRoot, markdownPath)} -> ${rawTarget}`,
      );
    }
  }
}

if (failures.length > 0) {
  throw new Error(`Broken local Markdown links:\n${failures.join("\n")}`);
}

process.stdout.write(`${JSON.stringify({ checkedLocalLinks: checkedLinks })}\n`);
