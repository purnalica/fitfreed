import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { relativeFiles } from "./pages-artifact.mjs";
import { publicOrigin } from "./public-origin.mjs";

const canonicalPagesUrl = publicOrigin;

function publicUrl(baseUrl, relativePath) {
  return new URL(relativePath.split(path.sep).join("/"), baseUrl).toString();
}

async function fetchResponse(fetchImpl, url) {
  const response = await fetchImpl(url, { redirect: "manual" });
  if (response.redirected || (response.url && response.url !== url)) {
    throw new Error(`Pages response redirected: ${url}`);
  }
  return response;
}

async function exactRemoteBytes(fetchImpl, url, expectedBytes) {
  const response = await fetchResponse(fetchImpl, url);
  if (response.status !== 200) {
    throw new Error(`Pages response status ${response.status}: ${url}`);
  }
  const actualBytes = Buffer.from(await response.arrayBuffer());
  if (!actualBytes.equals(expectedBytes)) {
    throw new Error(`Pages byte mismatch: ${url}`);
  }
}

function updateFiles(pagesDirectory) {
  return relativeFiles(pagesDirectory).filter((file) => file.startsWith(`updates${path.sep}`));
}

export async function preflightPagesPublication({
  baseUrl = canonicalPagesUrl,
  pagesDirectory,
  fetchImpl = fetch,
}) {
  const localStablePath = path.join(pagesDirectory, "updates", "stable.json");
  const localUpdateSnapshot = existsSync(localStablePath);
  const stableUrl = publicUrl(baseUrl, "updates/stable.json");
  const remoteStable = await fetchResponse(fetchImpl, stableUrl);
  if (remoteStable.status === 404) {
    return { localUpdateSnapshot, remoteUpdateSnapshot: false };
  }
  if (remoteStable.status !== 200) {
    throw new Error(`cannot establish current Pages update state: HTTP ${remoteStable.status}`);
  }
  if (!localUpdateSnapshot) {
    throw new Error("product publication would erase the active update snapshot");
  }

  const localUpdateFiles = updateFiles(pagesDirectory);
  for (const relativePath of localUpdateFiles) {
    const url = publicUrl(baseUrl, relativePath);
    const expectedBytes = readFileSync(path.join(pagesDirectory, relativePath));
    if (relativePath.endsWith(path.join("updates", "stable.json"))) {
      const actualBytes = Buffer.from(await remoteStable.arrayBuffer());
      if (!actualBytes.equals(expectedBytes)) {
        throw new Error("product publication would replace the active update snapshot");
      }
    } else {
      await exactRemoteBytes(fetchImpl, url, expectedBytes);
    }
  }
  return { localUpdateSnapshot: true, remoteUpdateSnapshot: true };
}

async function verifyPublishedPagesOnce({ baseUrl, pagesDirectory, fetchImpl }) {
  const files = relativeFiles(pagesDirectory).filter((file) => file !== ".nojekyll");
  for (const relativePath of files) {
    const remotePath = relativePath === "index.html" ? "" : relativePath;
    await exactRemoteBytes(
      fetchImpl,
      publicUrl(baseUrl, remotePath),
      readFileSync(path.join(pagesDirectory, relativePath)),
    );
  }
  const localUpdateSnapshot = existsSync(path.join(pagesDirectory, "updates", "stable.json"));
  if (!localUpdateSnapshot) {
    const stableUrl = publicUrl(baseUrl, "updates/stable.json");
    const response = await fetchResponse(fetchImpl, stableUrl);
    if (response.status !== 404) {
      throw new Error("unexpected public update snapshot is present");
    }
  }
  return { fileCount: files.length, updateSnapshot: localUpdateSnapshot };
}

export async function verifyPublishedPages({
  attempts = 12,
  baseUrl = canonicalPagesUrl,
  pagesDirectory,
  fetchImpl = fetch,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await verifyPublishedPagesOnce({ baseUrl, pagesDirectory, fetchImpl });
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(5_000);
    }
  }
  throw lastError;
}

async function run() {
  const [operation, pagesDirectory = ".artifacts/pages"] = process.argv.slice(2);
  const input = {
    baseUrl: process.env.FITFREED_PAGES_URL ?? canonicalPagesUrl,
    pagesDirectory: path.resolve(pagesDirectory),
  };
  const result = operation === "preflight"
    ? await preflightPagesPublication(input)
    : operation === "verify"
      ? await verifyPublishedPages(input)
      : (() => { throw new Error("usage: pages-publication.mjs <preflight|verify> [pages-directory]"); })();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await run();
}
