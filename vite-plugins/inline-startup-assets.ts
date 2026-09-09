import type { OutputBundle } from "rollup";
import type { Plugin } from "vite";

type InlineStartupAsset = {
  fileName: string;
  source: string | Uint8Array;
  type: "asset";
};

type InlineStartupChunk = {
  code: string;
  fileName: string;
  isEntry: boolean;
  map?: unknown;
  sourcemapFileName?: string | null;
  type: "chunk";
};

export type InlineStartupBundle = Record<string, InlineStartupAsset | InlineStartupChunk>;

type HtmlTag = {
  raw: string;
  start: number;
};

const inlineModuleMarker = "data-fitfreed-inline-startup=\"module\"";
const inlineStyleMarker = "data-fitfreed-inline-startup=\"style\"";

function decodeUtf8(source: string | Uint8Array, label: string) {
  if (typeof source === "string") return source;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(source);
  } catch {
    throw new Error(`${label} is not valid UTF-8`);
  }
}

function tags(html: string, name: "link" | "script") {
  const closing = name === "script" ? "(?:>[\\s\\S]*?<\\/script\\s*>)" : "(?:\\s*\/?>)";
  const pattern = new RegExp(`<${name}\\b[^>]*${closing}`, "giu");
  return [...html.matchAll(pattern)].map((match): HtmlTag => ({
    raw: match[0],
    start: match.index,
  }));
}

function attribute(tag: HtmlTag, name: string) {
  const match = new RegExp(
    `\\b${name}\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))`,
    "iu",
  ).exec(tag.raw);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function outputPath(reference: string) {
  return new URL(reference, "https://fitfreed.invalid/").pathname.replace(/^\/+/, "");
}

function replaceTag(html: string, tag: HtmlTag, replacement: string) {
  return `${html.slice(0, tag.start)}${replacement}${html.slice(tag.start + tag.raw.length)}`;
}

function oneOutput<T>(values: T[], label: string) {
  if (values.length !== 1) {
    throw new Error(`FitFreed requires ${label}; found ${values.length}`);
  }
  return values[0];
}

export function inlineStartupAssets(bundle: InlineStartupBundle) {
  const htmlAsset = oneOutput(
    Object.values(bundle).filter((output): output is InlineStartupAsset =>
      output.type === "asset" && output.fileName === "index.html"),
    "one production HTML entry",
  );
  const entry = oneOutput(
    Object.values(bundle).filter((output): output is InlineStartupChunk =>
      output.type === "chunk" && output.isEntry),
    "one production renderer entry",
  );
  let html = decodeUtf8(htmlAsset.source, "Production HTML entry");
  if (html.includes(inlineModuleMarker) || html.includes(inlineStyleMarker)) {
    throw new Error("Production HTML already contains inline startup assets");
  }

  const externalModules = tags(html, "script").filter((tag) =>
    attribute(tag, "type")?.toLowerCase() === "module" && attribute(tag, "src") !== undefined);
  const entryTag = oneOutput(
    externalModules.filter((tag) => outputPath(attribute(tag, "src") ?? "") === entry.fileName),
    "one external production renderer entry tag",
  );
  if (externalModules.length !== 1) {
    throw new Error(`FitFreed requires one external production module; found ${externalModules.length}`);
  }

  const stylesheets = tags(html, "link").filter((tag) =>
    attribute(tag, "rel")?.toLowerCase().split(/\s+/u).includes("stylesheet"));
  const stylesheetTag = oneOutput(stylesheets, "one critical stylesheet");
  const stylesheetFileName = outputPath(attribute(stylesheetTag, "href") ?? "");
  const stylesheetAsset = bundle[stylesheetFileName];
  if (stylesheetAsset?.type !== "asset") {
    throw new Error(`Critical stylesheet asset is missing: ${stylesheetFileName}`);
  }

  const entryCode = entry.code;
  const stylesheet = decodeUtf8(stylesheetAsset.source, "Critical stylesheet");
  if (/<\/script/iu.test(entryCode)) {
    throw new Error("Startup entry contains a closing script tag and cannot be safely inlined");
  }
  if (/<\/style/iu.test(stylesheet)) {
    throw new Error("Critical stylesheet contains a closing style tag and cannot be safely inlined");
  }
  if (
    entry.map != null
    || entry.sourcemapFileName
    || bundle[`${entry.fileName}.map`] !== undefined
    || bundle[`${stylesheetFileName}.map`] !== undefined
    || /sourceMappingURL/iu.test(entryCode)
    || /sourceMappingURL/iu.test(stylesheet)
  ) {
    throw new Error("Inline startup assets must not contain or reference a source map");
  }

  html = replaceTag(
    html,
    entryTag,
    `<script type="module" ${inlineModuleMarker}>${entryCode}</script>`,
  );
  const relocatedStylesheetTag = tags(html, "link").find((tag) =>
    outputPath(attribute(tag, "href") ?? "") === stylesheetFileName);
  if (!relocatedStylesheetTag) {
    throw new Error("Critical stylesheet tag was lost while composing production HTML");
  }
  htmlAsset.source = replaceTag(
    html,
    relocatedStylesheetTag,
    `<style ${inlineStyleMarker}>${stylesheet}</style>`,
  );
}

export function inlineStartupAssetsPlugin(): Plugin {
  return {
    name: "fitfreed-inline-startup-assets",
    apply: "build",
    enforce: "post",
    generateBundle: {
      order: "post",
      handler(_options, bundle: OutputBundle) {
        inlineStartupAssets(bundle);
      },
    },
  };
}
