import { describe, expect, it } from "vitest";

import {
  inlineStartupAssets,
  type InlineStartupBundle,
} from "./inline-startup-assets";

function productionBundle({
  entryCode = "const product = \"FitFreed\";\n",
  stylesheet = ".application-shell { display: grid; }\n",
  html = [
    "<!doctype html>",
    "<html><head>",
    "<script crossorigin type=\"module\" src=\"/startup-A1.js\"></script>",
    "<link href=\"/assets/index-B2.css\" rel=\"stylesheet\" crossorigin>",
    "</head><body><div id=\"root\"></div></body></html>",
  ].join("\n"),
}: {
  entryCode?: string;
  stylesheet?: string;
  html?: string;
} = {}): InlineStartupBundle {
  return {
    "index.html": {
      type: "asset",
      fileName: "index.html",
      source: html,
    },
    "startup-A1.js": {
      type: "chunk",
      fileName: "startup-A1.js",
      code: entryCode,
      isEntry: true,
      map: null,
    },
    "assets/index-B2.css": {
      type: "asset",
      fileName: "assets/index-B2.css",
      source: stylesheet,
    },
    "assets/deferred-C3.js": {
      type: "chunk",
      fileName: "assets/deferred-C3.js",
      code: "export const deferred = true;\n",
      isEntry: false,
      map: null,
    },
  };
}

function assetSource(bundle: InlineStartupBundle, fileName: string) {
  const output = bundle[fileName];
  if (output.type !== "asset" || typeof output.source !== "string") {
    throw new Error(`Expected text asset: ${fileName}`);
  }
  return output.source;
}

function chunkCode(bundle: InlineStartupBundle, fileName: string) {
  const output = bundle[fileName];
  if (output.type !== "chunk") throw new Error(`Expected chunk: ${fileName}`);
  return output.code;
}

describe("production startup asset inlining", () => {
  it("inlines exact entry and critical-style copies while retaining their versioned assets", () => {
    const bundle = productionBundle();
    const entryCode = chunkCode(bundle, "startup-A1.js");
    const stylesheet = assetSource(bundle, "assets/index-B2.css");

    inlineStartupAssets(bundle);

    const html = assetSource(bundle, "index.html");
    expect(html).toContain(
      `<script type="module" data-fitfreed-inline-startup="module">${entryCode}</script>`,
    );
    expect(html).toContain(
      `<style data-fitfreed-inline-startup="style">${stylesheet}</style>`,
    );
    expect(html).not.toContain("src=\"/startup-A1.js\"");
    expect(html).not.toContain("href=\"/assets/index-B2.css\"");
    expect(bundle["startup-A1.js"]).toBeDefined();
    expect(bundle["assets/index-B2.css"]).toBeDefined();
  });

  it("rejects an ambiguous critical stylesheet boundary", () => {
    const bundle = productionBundle({
      html: [
        "<script type=\"module\" src=\"/startup-A1.js\"></script>",
        "<link rel=\"stylesheet\" href=\"/assets/index-B2.css\">",
        "<link rel=\"stylesheet\" href=\"/assets/other-D4.css\">",
      ].join("\n"),
    });
    bundle["assets/other-D4.css"] = {
      type: "asset",
      fileName: "assets/other-D4.css",
      source: ".other {}",
    };

    expect(() => inlineStartupAssets(bundle)).toThrow(/one critical stylesheet/u);
  });

  it.each([
    ["entry closing tag", { entryCode: "const unsafe = \"</script>\";" }, /closing script/u],
    ["style closing tag", { stylesheet: ".unsafe::after { content: \"</style>\"; }" }, /closing style/u],
  ])("rejects unsafe inline content: %s", (_label, options, expected) => {
    expect(() => inlineStartupAssets(productionBundle(options))).toThrow(expected);
  });

  it("rejects source-mapped startup artifacts", () => {
    const bundle = productionBundle();
    const entry = bundle["startup-A1.js"];
    if (entry.type !== "chunk") throw new Error("Expected startup chunk");
    entry.sourcemapFileName = "startup-A1.js.map";

    expect(() => inlineStartupAssets(bundle)).toThrow(/source map/u);
  });
});
