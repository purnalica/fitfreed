import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const startMarker = "<!-- product-status:start -->";
const endMarker = "<!-- product-status:end -->";
const expectedKeys = Object.freeze(["available", "active", "later"]);

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function replaceGeneratedSection(source, replacement) {
  const markerStart = source.indexOf(startMarker);
  const markerEnd = source.indexOf(endMarker);
  assert.notEqual(markerStart, -1, `missing generated-section marker: ${startMarker}`);
  assert.notEqual(markerEnd, -1, `missing generated-section marker: ${endMarker}`);
  assert.ok(markerStart < markerEnd, "product-status markers are out of order");
  assert.equal(source.indexOf(startMarker, markerStart + startMarker.length), -1, "duplicate product-status start marker");
  assert.equal(source.indexOf(endMarker, markerEnd + endMarker.length), -1, "duplicate product-status end marker");

  const sectionStart = source.lastIndexOf("\n", markerStart) + 1;
  const sectionEndNewline = source.indexOf("\n", markerEnd + endMarker.length);
  const sectionEnd = sectionEndNewline === -1 ? source.length : sectionEndNewline + 1;
  return `${source.slice(0, sectionStart)}${replacement}\n${source.slice(sectionEnd)}`;
}

export function validateProductStatus(model) {
  assert.equal(model?.schemaVersion, 2, "unsupported product-status schema version");
  assert.match(model?.updated ?? "", /^\d{4}-\d{2}-\d{2}$/u, "product-status date must use YYYY-MM-DD");
  assert.ok(Array.isArray(model?.statuses), "product statuses must be an array");
  assert.deepEqual(model.statuses.map(({ key }) => key), expectedKeys, "product statuses must retain their semantic order");

  for (const status of model.statuses) {
    assert.match(status.label ?? "", /\S/u, `${status.key} label is required`);
    assert.match(status.title ?? "", /\S/u, `${status.key} title is required`);
    assert.ok(Array.isArray(status.items) && status.items.length > 0, `${status.key} items are required`);
    for (const item of status.items) {
      assert.match(item.key ?? "", /^[a-z][A-Za-z0-9]*$/u, `${status.key} item key is invalid`);
      assert.match(item.text ?? "", /\S/u, `${status.key}.${item.key} item text is required`);
    }
    assert.equal(
      new Set(status.items.map(({ key }) => key)).size,
      status.items.length,
      `${status.key} contains duplicate item keys`,
    );
    assert.equal(
      new Set(status.items.map(({ text }) => text)).size,
      status.items.length,
      `${status.key} contains duplicate item text`,
    );
    assert.match(status.source?.label ?? "", /\S/u, `${status.key} source label is required`);
    assert.match(status.source?.path ?? "", /^docs\//u, `${status.key} source must be a repository documentation path`);
  }
}

export function renderReadmeStatus(model) {
  const disclosures = model.statuses.flatMap((status) => [
    `<details data-status="${escapeHtml(status.key)}"${status.key === "active" ? " open" : ""}>`,
    `<summary><strong>${escapeHtml(status.label)} — ${escapeHtml(status.title)}</strong></summary>`,
    "<ul>",
    ...status.items.map((item) => `<li>${escapeHtml(item.text)}</li>`),
    "</ul>",
    `<p><a href="${escapeHtml(status.source.path)}">${escapeHtml(status.source.label)} →</a></p>`,
    "</details>",
    "",
  ]);

  return [
    startMarker,
    ...disclosures,
    endMarker,
  ].join("\n");
}

export function renderProductPageStatus(model) {
  const articles = model.statuses.map((status) => {
    const items = status.items.map((item) =>
      `              <li data-i18n="status.${escapeHtml(status.key)}.items.${escapeHtml(item.key)}">${escapeHtml(item.text)}</li>`,
    ).join("\n");
    const sourcePath = `../${escapeHtml(status.source.path)}`;
    return [
      `          <details data-status="${escapeHtml(status.key)}"${status.key === "active" ? " open" : ""}>`,
      "            <summary>",
      `              <span data-i18n="status.${escapeHtml(status.key)}.label">${escapeHtml(status.label)}</span>`,
      `              <h3 data-i18n="status.${escapeHtml(status.key)}.title">${escapeHtml(status.title)}</h3>`,
      "            </summary>",
      '            <div class="status-detail">',
      "              <ul>",
      items,
      "              </ul>",
      `              <a href="${sourcePath}" data-i18n="status.${escapeHtml(status.key)}.source">${escapeHtml(status.source.label)} →</a>`,
      "            </div>",
      "          </details>",
    ].join("\n");
  });

  return [`        ${startMarker}`, ...articles, `        ${endMarker}`].join("\n");
}

export function renderProductSurfaces(model, readme, productPage) {
  validateProductStatus(model);
  return {
    readme: replaceGeneratedSection(readme, renderReadmeStatus(model)),
    productPage: replaceGeneratedSection(productPage, renderProductPageStatus(model)),
  };
}

function run() {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const paths = {
    model: resolve(repositoryRoot, "docs/product-status.json"),
    readme: resolve(repositoryRoot, "README.md"),
    productPage: resolve(repositoryRoot, "site/index.html"),
  };
  const model = JSON.parse(readFileSync(paths.model, "utf8"));
  const current = {
    readme: readFileSync(paths.readme, "utf8"),
    productPage: readFileSync(paths.productPage, "utf8"),
  };
  const rendered = renderProductSurfaces(model, current.readme, current.productPage);
  const changed = Object.keys(rendered).filter((key) => rendered[key] !== current[key]);

  if (process.argv.includes("--check")) {
    if (changed.length > 0) {
      throw new Error(`product surfaces are stale: ${changed.join(", ")}; run npm run render:product-surfaces`);
    }
    console.log("Product surfaces match their canonical status source");
    return;
  }

  if (changed.includes("readme")) writeFileSync(paths.readme, rendered.readme);
  if (changed.includes("productPage")) writeFileSync(paths.productPage, rendered.productPage);
  console.log(`Rendered product surfaces: ${changed.length === 0 ? "already current" : changed.join(", ")}`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) run();
