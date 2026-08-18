import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import axe from "axe-core";
import { JSDOM } from "jsdom";

const pagePath = "site/index.html";
const pageDirectory = dirname(pagePath);
const source = readFileSync(pagePath, "utf8");
const dom = new JSDOM(source, {
  runScripts: "outside-only",
  url: "https://example.invalid/fitfreed/site/",
});
const { document } = dom.window;

assert.equal(document.documentElement.lang, "en", "product page must declare its source locale");
assert.equal(document.title, "FitFreed — Your fitness data, freed");
assert.ok(document.querySelector('meta[name="description"]')?.content.includes("fitness exports"));
assert.equal(document.querySelectorAll("h1").length, 1, "product page must have exactly one h1");
assert.match(document.querySelector("h1").textContent, /fitness history/i);
assert.ok(document.querySelector('.skip-link[href="#main"]'));
assert.ok(document.querySelector("main#main"));

const statusValues = [...document.querySelectorAll("[data-status]")].map(({ dataset }) => dataset.status);
assert.deepEqual(statusValues, ["available", "active", "later"]);
assert.match(document.querySelector('[data-status="available"]').textContent, /Available in source/);
assert.match(document.querySelector('[data-status="active"]').textContent, /Active experience work/);
assert.match(document.querySelector('[data-status="later"]').textContent, /Deliberately later/);

assert.equal(document.querySelectorAll("[download]").length, 0, "no download action is allowed before release");
assert.doesNotMatch(source, /download (fitfreed|for macos)|get fitfreed/i);
assert.match(source, /No supported download yet/);
assert.match(document.querySelector("#status .section-heading").textContent, /No roadmap capability is marketed as a released feature/);

for (const localAsset of document.querySelectorAll('img[src], link[rel="stylesheet"], link[rel="icon"]')) {
  const reference = localAsset.getAttribute("src") || localAsset.getAttribute("href");
  assert.doesNotMatch(reference, /^https?:/u);
  assert.ok(existsSync(resolve(pageDirectory, reference)), `missing local product-page asset: ${reference}`);
}

for (const link of document.querySelectorAll("a[href]")) {
  const reference = link.getAttribute("href");
  if (reference.startsWith("#")) {
    assert.ok(document.querySelector(reference), `missing product-page anchor: ${reference}`);
  } else if (!reference.startsWith("https://")) {
    const [fileReference] = reference.split("#", 1);
    assert.ok(existsSync(resolve(pageDirectory, fileReference)), `missing local product-page link: ${reference}`);
  }
}
assert.equal(document.querySelectorAll("script").length, 0, "static product page must not execute scripts");

const styles = readFileSync(resolve(pageDirectory, "styles.css"), "utf8");
assert.doesNotMatch(styles, /url\(\s*["']?https?:/u, "product-page styles must not load remote assets");

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
assert.equal(violations.length, 0, JSON.stringify(violations, null, 2));

console.log("Product page contracts passed");
