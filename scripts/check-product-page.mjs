import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import axe from "axe-core";
import { JSDOM } from "jsdom";

import {
  loadProductPageLocalization,
  renderLocalizedProductPages,
} from "./product-page-localization.mjs";
import { createProductReleaseDownloads } from "./product-release-downloads.mjs";
import { publicOrigin } from "./public-origin.mjs";

const repositoryRoot = resolve(new URL("..", import.meta.url).pathname);
const pagePath = "site/index.html";
const pageDirectory = dirname(pagePath);
const source = readFileSync(pagePath, "utf8");
const sourceDocument = new JSDOM(source, {
  runScripts: "outside-only",
  url: "https://example.invalid/fitfreed/site/",
}).window.document;

assert.equal(sourceDocument.documentElement.lang, "en-US", "product page must declare its source locale");
assert.equal(sourceDocument.title, "FitFreed — Explore the fitness history you own");
assert.equal(sourceDocument.querySelector('link[rel="canonical"]')?.href, publicOrigin);
assert.ok(sourceDocument.querySelector('meta[name="description"]')?.content.includes("local fitness history"));
assert.equal(sourceDocument.querySelectorAll("script").length, 0, "canonical source must not contain generated runtime code");
assert.doesNotMatch(
  sourceDocument.body.textContent,
  /Ambitious, without pretending|Freedom needs architecture|Own the result, too|The average is only the beginning|A project without collaborators has an expiry date/u,
  "product-page copy must inform rather than advertise",
);
assert.doesNotMatch(sourceDocument.body.textContent, /!/u, "product-page copy must not manufacture excitement");
assert.match(sourceDocument.querySelector("h1")?.textContent ?? "", /fitness history.*platform that recorded it/isu);
assert.match(
  sourceDocument.querySelector(".product-demonstration-label")?.textContent ?? "",
  /Current source experience.*illustrative data/isu,
);
assert.doesNotMatch(
  sourceDocument.body.textContent,
  /not yet the current production presentation|accepted design work.*not yet/iu,
  "implemented presentation must not be described as a future direction",
);
assert.deepEqual(
  [...sourceDocument.querySelectorAll(".product-shell-navigation span")].map(({ textContent }) => textContent.trim()),
  ["Home", "History", "Reports", "Sources", "Settings"],
  "the product illustration must use visible workspace labels",
);
assert.equal(sourceDocument.querySelectorAll("[data-product-story]").length, 3);
assert.deepEqual(
  [...sourceDocument.querySelectorAll("[data-product-story]")].map(({ dataset }) => dataset.productStory),
  ["find", "understand", "keep"],
);
assert.ok(sourceDocument.querySelector("figure.route-evidence figcaption"));
assert.match(sourceDocument.querySelector("figure.route-evidence figcaption")?.textContent ?? "", /recorded route.*local/isu);
assert.match(sourceDocument.querySelector(".route-selection-summary")?.textContent ?? "", /Point.*Elapsed time.*Recorded distance.*Altitude/isu);
assert.doesNotMatch(
  sourceDocument.querySelector(".route-selection-summary")?.textContent ?? "",
  /Pace|Heart rate/iu,
  "the product illustration must not invent route-to-signal synchronization",
);
assert.doesNotMatch(
  sourceDocument.querySelector('[data-i18n="status.available.items.routeTraces"]')?.textContent ?? "",
  /synchronized/iu,
  "the route capability claim must not imply unsupported route-to-signal synchronization",
);
assert.equal(sourceDocument.querySelectorAll("details[data-status]").length, 3);
assert.ok(sourceDocument.querySelector('details[data-status="active"][open]'));
assert.equal(
  sourceDocument.querySelectorAll('picture source[media="(prefers-color-scheme: dark)"][srcset="../assets/brand/fitfreed-logo-dark.svg"]').length,
  2,
  "header and footer brands must remain visible in dark mode",
);
assert.doesNotMatch(
  sourceDocument.body.textContent,
  /revolutionary|effortless|unleash|game-changing|ultimate|best-in-class|transform your life/iu,
  "product-page copy must stay factual",
);

for (const localAsset of sourceDocument.querySelectorAll('img[src], link[rel="stylesheet"], link[rel="icon"]')) {
  const reference = localAsset.getAttribute("src") || localAsset.getAttribute("href");
  assert.doesNotMatch(reference, /^https?:/u);
  assert.ok(existsSync(resolve(pageDirectory, reference)), `missing local product-page asset: ${reference}`);
}

for (const sourceAsset of sourceDocument.querySelectorAll("source[srcset]")) {
  const reference = sourceAsset.getAttribute("srcset");
  assert.doesNotMatch(reference, /^https?:/u);
  assert.ok(existsSync(resolve(pageDirectory, reference)), `missing local product-page source asset: ${reference}`);
}

for (const link of sourceDocument.querySelectorAll("a[href]")) {
  const reference = link.getAttribute("href");
  if (reference.startsWith("#")) {
    assert.ok(sourceDocument.querySelector(reference), `missing product-page anchor: ${reference}`);
  } else if (!reference.startsWith("https://")) {
    const [fileReference] = reference.split("#", 1);
    assert.ok(existsSync(resolve(pageDirectory, fileReference)), `missing local product-page link: ${reference}`);
  }
}

const localization = loadProductPageLocalization(repositoryRoot);
const pages = renderLocalizedProductPages(localization);

async function validateLocalizedPage(output, expected) {
  const dom = new JSDOM(output, {
    runScripts: "outside-only",
    url: expected.canonical,
  });
  const { document } = dom.window;
  assert.equal(document.documentElement.lang, expected.locale);
  assert.equal(document.querySelector('link[rel="canonical"]')?.href, expected.canonical);
  assert.equal(document.querySelectorAll('link[rel="alternate"][hreflang]').length, 3);
  assert.equal(document.querySelectorAll("h1").length, 1, "product page must have exactly one h1");
  assert.match(document.querySelector("h1").textContent, expected.heading);
  assert.ok(document.querySelector('.skip-link[href="#main"]'));
  assert.ok(document.querySelector("main#main"));
  assert.deepEqual(
    [...document.querySelectorAll("[data-status]")].map(({ dataset }) => dataset.status),
    ["available", "active", "later"],
  );
  assert.equal(document.querySelectorAll("details[data-status]").length, 3);
  assert.ok(document.querySelector('details[data-status="active"][open]'));
  assert.match(document.querySelector('[data-status="available"]').textContent, expected.available);
  assert.match(document.querySelector('[data-status="active"]').textContent, expected.active);
  assert.match(document.querySelector('[data-status="later"]').textContent, expected.later);
  assert.equal(document.querySelectorAll("[download]").length, 0, "no download action is allowed before release");
  assert.equal(document.querySelectorAll("script[src]").length, 1, "only the local locale runtime is allowed");
  assert.doesNotMatch(document.querySelector("script[src]").getAttribute("src"), /^(?:https?:)?\/\//u);
  assert.equal(document.querySelectorAll("[data-locale-choice]").length, 2);

  dom.window.eval(axe.source);
  const result = await dom.window.axe.run(document, {
    rules: {
      "color-contrast": { enabled: false },
    },
  });
  const violations = result.violations.map(({ id, nodes }) => ({
    id,
    targets: nodes.map(({ target }) => [...target]),
  }));
  assert.equal(violations.length, 0, `${expected.locale}: ${JSON.stringify(violations, null, 2)}`);
}

await validateLocalizedPage(pages["index.html"], {
  active: /Work in progress/u,
  available: /Implemented in source/u,
  canonical: publicOrigin,
  heading: /fitness history/iu,
  later: /Later scope/u,
  locale: "en-US",
});
await validateLocalizedPage(pages["es/index.html"], {
  active: /Trabajo en curso/u,
  available: /Implementado en el código/u,
  canonical: new URL("es/", publicOrigin).toString(),
  heading: /historial deportivo/iu,
  later: /Alcance posterior/u,
  locale: "es-ES",
});

const completeRelease = createProductReleaseDownloads({
  schemaVersion: 7,
  release: { channel: "public-stable", version: "0.3.0" },
  update: {
    targets: [
      "darwin-aarch64",
      "linux-x86_64-deb",
      "windows-x86_64-nsis",
    ],
  },
  artifacts: [
    { kind: "macos-disk-image", path: "FitFreed_0.3.0_aarch64.dmg" },
    { kind: "linux-x86_64-deb", path: "FitFreed_0.3.0_amd64.deb" },
    { kind: "windows-x86_64-nsis", path: "FitFreed_0.3.0_x64-setup.exe" },
  ],
});
const releasePages = renderLocalizedProductPages(localization, { release: completeRelease });
for (const [outputFile, expected] of [
  ["index.html", /Download FitFreed 0\.3\.0/u],
  ["es/index.html", /Descarga FitFreed 0\.3\.0/u],
]) {
  const dom = new JSDOM(releasePages[outputFile], {
    runScripts: "outside-only",
    url: new URL(outputFile, publicOrigin),
  });
  const { document } = dom.window;
  assert.match(document.querySelector(".release-downloads").textContent, expected);
  assert.equal(document.querySelectorAll("[data-release-download]").length, 3);
  assert.equal(
    document.querySelector('[data-release-download="windows-x86_64-nsis"]')?.href,
    "https://github.com/purnalica/fitfreed/releases/download/v0.3.0/FitFreed_0.3.0_x64-setup.exe",
  );
  assert.doesNotMatch(
    document.body.textContent,
    /No supported download yet|no public Windows binary|before release-candidate acceptance|Todavía no hay una descarga con soporte|no existe ningún binario público para Windows/u,
  );
  assert.match(document.querySelector('details[data-status="active"]').textContent, /FitFreed 0\.3\.0/u);

  dom.window.eval(axe.source);
  const result = await dom.window.axe.run(document, {
    rules: { "color-contrast": { enabled: false } },
  });
  assert.equal(
    result.violations.length,
    0,
    `${outputFile} release surface: ${JSON.stringify(result.violations, null, 2)}`,
  );
}

assert.doesNotMatch(source, /download (fitfreed|for macos)|get fitfreed/iu);
assert.match(source, /No supported download yet/u);
assert.match(sourceDocument.querySelector("#status .section-heading").textContent, /There is no supported public download yet/u);

const styles = readFileSync(resolve(pageDirectory, "styles.css"), "utf8");
assert.doesNotMatch(styles, /url\(\s*["']?https?:/u, "product-page styles must not load remote assets");
assert.doesNotMatch(styles, /font-size:\s*(?:[0-9]|10|11)px/u, "product-page text must not use sub-12px fixed sizes");
assert.match(styles, /\.product-shell-navigation[\s\S]*grid-template-columns:\s*repeat\(5,/u);
assert.match(styles, /\.route-evidence-map[\s\S]*min-height:\s*clamp\(/u);
assert.match(styles, /\.release-download-grid[\s\S]*grid-template-columns:\s*repeat\(auto-fit,/u);

console.log("Localized product page contracts passed");
