import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { relativeFiles } from "./pages-artifact.mjs";
import { publicOrigin } from "./public-origin.mjs";

const canonicalPagesUrl = publicOrigin;
const semanticVersion =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

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

function stableIdentity(bytes, boundary) {
  try {
    const envelope = JSON.parse(bytes.toString("utf8"));
    const payloadBase64 = envelope?.fitfreed?.payloadBase64;
    if (typeof payloadBase64 !== "string" || Buffer.from(payloadBase64, "base64").toString("base64") !== payloadBase64) {
      throw new Error("invalid payload");
    }
    const payload = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8"));
    if (!Number.isSafeInteger(payload?.sequence) || payload.sequence < 1) {
      throw new Error("invalid sequence");
    }
    if (!semanticVersion.test(payload?.release?.version ?? "")) {
      throw new Error("invalid version");
    }
    return { sequence: payload.sequence, version: payload.release.version };
  } catch {
    throw new Error(`${boundary} stable update identity is invalid`);
  }
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

  const localStableBytes = readFileSync(localStablePath);
  const remoteStableBytes = Buffer.from(await remoteStable.arrayBuffer());
  if (!remoteStableBytes.equals(localStableBytes)) {
    const local = stableIdentity(localStableBytes, "local");
    const remote = stableIdentity(remoteStableBytes, "remote");
    if (local.sequence <= remote.sequence) {
      throw new Error("product publication would replace or replay the active update snapshot");
    }
    return {
      localUpdateSnapshot: true,
      remoteUpdateSnapshot: true,
      updateAction: "advance",
      localSequence: local.sequence,
      remoteSequence: remote.sequence,
    };
  }

  const localUpdateFiles = updateFiles(pagesDirectory);
  for (const relativePath of localUpdateFiles) {
    const url = publicUrl(baseUrl, relativePath);
    const expectedBytes = readFileSync(path.join(pagesDirectory, relativePath));
    if (relativePath.endsWith(path.join("updates", "stable.json"))) {
      if (!remoteStableBytes.equals(expectedBytes)) throw new Error("active update snapshot changed during preflight");
    } else {
      await exactRemoteBytes(fetchImpl, url, expectedBytes);
    }
  }
  return {
    localUpdateSnapshot: true,
    remoteUpdateSnapshot: true,
    updateAction: "preserve",
  };
}

async function verifyPublishedPagesOnce({ baseUrl, pagesDirectory, fetchImpl }) {
  const files = relativeFiles(pagesDirectory).filter((file) => file !== ".nojekyll");
  for (const relativePath of files) {
    const remotePath = relativePath === "index.html"
      ? ""
      : relativePath.endsWith(`${path.sep}index.html`)
        ? `${path.dirname(relativePath).split(path.sep).join("/")}/`
        : relativePath;
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
