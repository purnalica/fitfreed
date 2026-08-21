import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import axe from "axe-core";
import { JSDOM } from "jsdom";

import {
  loadProductPageLocalization,
  renderLocalizedProductPages,
} from "./product-page-localization.mjs";
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
assert.equal(sourceDocument.title, "FitFreed — Explore personal fitness exports");
assert.equal(sourceDocument.querySelector('link[rel="canonical"]')?.href, publicOrigin);
assert.ok(sourceDocument.querySelector('meta[name="description"]')?.content.includes("fitness exports"));
assert.equal(sourceDocument.querySelectorAll("script").length, 0, "canonical source must not contain generated runtime code");
assert.doesNotMatch(
  sourceDocument.body.textContent,
  /Ambitious, without pretending|Freedom needs architecture|Own the result, too|The average is only the beginning|A project without collaborators has an expiry date/u,
  "product-page copy must inform rather than advertise",
);
assert.doesNotMatch(sourceDocument.body.textContent, /!/u, "product-page copy must not manufacture excitement");

for (const localAsset of sourceDocument.querySelectorAll('img[src], link[rel="stylesheet"], link[rel="icon"]')) {
  const reference = localAsset.getAttribute("src") || localAsset.getAttribute("href");
  assert.doesNotMatch(reference, /^https?:/u);
  assert.ok(existsSync(resolve(pageDirectory, reference)), `missing local product-page asset: ${reference}`);
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
  heading: /fitness export/iu,
  later: /Later scope/u,
  locale: "en-US",
});
await validateLocalizedPage(pages["es/index.html"], {
  active: /Trabajo en curso/u,
  available: /Implementado en el código/u,
  canonical: new URL("es/", publicOrigin).toString(),
  heading: /exportación de actividad física/iu,
  later: /Alcance posterior/u,
  locale: "es-ES",
});

assert.doesNotMatch(source, /download (fitfreed|for macos)|get fitfreed/iu);
assert.match(source, /No supported download yet/u);
assert.match(sourceDocument.querySelector("#status .section-heading").textContent, /There is no supported public download yet/u);

const styles = readFileSync(resolve(pageDirectory, "styles.css"), "utf8");
assert.doesNotMatch(styles, /url\(\s*["']?https?:/u, "product-page styles must not load remote assets");

console.log("Localized product page contracts passed");
