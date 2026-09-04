import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";

import { publicOrigin } from "./public-origin.mjs";

const translationAttributes = Object.freeze(["aria-label", "alt", "content"]);

function normalizedText(value) {
  return value.trim().replaceAll(/\s+/gu, " ");
}

function formatMessage(message, parameters = {}) {
  return message.replaceAll(/\{([a-z][A-Za-z0-9]*)\}/gu, (_match, name) => {
    assert.ok(Object.hasOwn(parameters, name), `missing product-page message parameter: ${name}`);
    return parameters[name];
  });
}

function markerFor(attribute) {
  return `data-i18n-${attribute}`;
}

function validateConfig(config) {
  assert.equal(config?.schemaVersion, 1, "unsupported product-page locale config schema");
  assert.match(config?.storageKey ?? "", /^fitfreed\.[a-z.-]+$/u, "invalid locale storage key");
  assert.ok(Array.isArray(config?.locales) && config.locales.length >= 2, "at least two product-page locales are required");
  assert.equal(new Set(config.locales.map(({ id }) => id)).size, config.locales.length, "duplicate product-page locale");
  assert.equal(new Set(config.locales.map(({ route }) => route)).size, config.locales.length, "duplicate product-page locale route");
  assert.equal(new Set(config.locales.map(({ output }) => output)).size, config.locales.length, "duplicate product-page locale output");
  assert.ok(config.locales.some(({ id }) => id === config.sourceLocale), "source product-page locale is missing");
  assert.ok(config.locales.some(({ id }) => id === config.fallbackLocale), "fallback product-page locale is missing");
  for (const locale of config.locales) {
    assert.match(locale.id ?? "", /^[a-z]{2}-[A-Z]{2}$/u, "invalid product-page locale identifier");
    assert.match(locale.label ?? "", /\S/u, `${locale.id} locale label is required`);
    assert.match(locale.route ?? "", /^\/(?:[a-z]{2}\/)?$/u, `${locale.id} locale route is invalid`);
    assert.match(locale.output ?? "", /^(?:[a-z]{2}\/)?index\.html$/u, `${locale.id} locale output is invalid`);
    if (locale.id === config.sourceLocale) assert.equal(locale.catalog, undefined, "source locale must use the canonical HTML text");
    else assert.match(locale.catalog ?? "", /^site\/locales\/[a-z]{2}-[A-Z]{2}\.json$/u, `${locale.id} catalog path is invalid`);
  }
}

export function loadProductPageLocalization(repositoryRoot) {
  const configPath = path.join(repositoryRoot, "site", "locales", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  validateConfig(config);
  const source = readFileSync(path.join(repositoryRoot, "site", "index.html"), "utf8");
  const releaseSource = JSON.parse(readFileSync(
    path.join(repositoryRoot, "site", "release-downloads.json"),
    "utf8",
  ));
  assert.equal(releaseSource?.schemaVersion, 1, "unsupported release-download copy schema");
  assert.ok(
    releaseSource.messages
      && typeof releaseSource.messages === "object"
      && !Array.isArray(releaseSource.messages),
    "release-download source messages must be an object",
  );
  const catalogs = {};
  for (const locale of config.locales) {
    if (!locale.catalog) continue;
    const catalog = JSON.parse(readFileSync(path.join(repositoryRoot, locale.catalog), "utf8"));
    assert.equal(catalog?.schemaVersion, 1, `${locale.id} catalog schema is unsupported`);
    assert.equal(catalog?.locale, locale.id, `${locale.id} catalog locale does not match its config`);
    assert.ok(catalog.messages && typeof catalog.messages === "object" && !Array.isArray(catalog.messages), `${locale.id} messages must be an object`);
    catalogs[locale.id] = catalog;
  }
  const localization = { catalogs, config, releaseSource, source };
  validateProductPageTranslationContract({ localization, source });
  return localization;
}

function collectTranslationContract(source, releaseSource) {
  const document = new JSDOM(source).window.document;
  const keys = [];
  const record = (key, description) => {
    assert.match(key ?? "", /^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+$/u, `invalid translation key on ${description}`);
    assert.ok(!keys.includes(key), `duplicate product-page translation key: ${key}`);
    keys.push(key);
  };

  for (const element of document.querySelectorAll("[data-i18n]")) {
    assert.equal(element.childElementCount, 0, `data-i18n element must be a leaf: ${element.dataset.i18n}`);
    assert.match(normalizedText(element.textContent), /\S/u, `empty English source message: ${element.dataset.i18n}`);
    record(element.dataset.i18n, element.tagName.toLowerCase());
  }
  for (const attribute of translationAttributes) {
    const marker = markerFor(attribute);
    for (const element of document.querySelectorAll(`[${marker}]`)) {
      assert.match(element.getAttribute(attribute) ?? "", /\S/u, `empty English ${attribute} source`);
      record(element.getAttribute(marker), `${element.tagName.toLowerCase()} ${attribute}`);
    }
  }

  const walker = document.createTreeWalker(document.documentElement, 4);
  const unmarked = [];
  while (walker.nextNode()) {
    const text = normalizedText(walker.currentNode.nodeValue ?? "");
    if (!text) continue;
    const parent = walker.currentNode.parentElement;
    if (!parent || parent.closest("[data-i18n-static]") || parent.hasAttribute("data-i18n")) continue;
    if (["SCRIPT", "STYLE"].includes(parent.tagName)) continue;
    unmarked.push(`${parent.tagName.toLowerCase()}: ${text}`);
  }
  assert.deepEqual(unmarked, [], `visible English text lacks a translation contract:\n${unmarked.join("\n")}`);

  for (const attribute of translationAttributes) {
    for (const element of document.querySelectorAll(`[${attribute}]`)) {
      if (element.closest("[data-i18n-static]") || element.hasAttribute(markerFor(attribute))) continue;
      if (attribute === "content" && element.getAttribute("name") !== "description") continue;
      assert.fail(`${element.tagName.toLowerCase()} ${attribute} lacks a translation contract`);
    }
  }

  for (const [key, message] of Object.entries(releaseSource.messages)) {
    assert.match(message, /\S/u, `empty English generated message: ${key}`);
    record(key, "release-download source");
  }
  return keys.sort();
}

export function validateProductPageTranslationContract({ localization, source }) {
  const keys = collectTranslationContract(source, localization.releaseSource);
  for (const [locale, catalog] of Object.entries(localization.catalogs)) {
    const catalogKeys = Object.keys(catalog.messages).sort();
    const missing = keys.filter((key) => !catalogKeys.includes(key));
    const extra = catalogKeys.filter((key) => !keys.includes(key));
    assert.deepEqual(missing, [], `${locale} catalog has missing keys: ${missing.join(", ")}`);
    assert.deepEqual(extra, [], `${locale} catalog has extra keys: ${extra.join(", ")}`);
    for (const key of keys) assert.match(catalog.messages[key], /\S/u, `${locale} translation is empty: ${key}`);
  }
  return {
    keys,
    localizedLocales: Object.keys(localization.catalogs).length,
    messageCount: keys.length,
    sourceLocale: localization.config.sourceLocale,
  };
}

function localeByLanguage(config, language) {
  if (typeof language !== "string") return null;
  const normalized = language.toLowerCase();
  return config.locales.find(({ id }) => {
    const locale = id.toLowerCase();
    return normalized === locale || normalized.split("-")[0] === locale.split("-")[0];
  }) ?? null;
}

const defaultResolverConfig = Object.freeze({
  fallbackLocale: "en-US",
  locales: Object.freeze([{ id: "en-US" }, { id: "es-ES" }]),
});

export function resolveProductLocale({ storedLocale, browserLanguages }, config = defaultResolverConfig) {
  const stored = config.locales.find(({ id }) => id === storedLocale);
  if (stored) return stored.id;
  for (const language of Array.isArray(browserLanguages) ? browserLanguages : []) {
    const locale = localeByLanguage(config, language);
    if (locale) return locale.id;
  }
  return config.fallbackLocale;
}

export function productLocaleRedirect({ browserLanguages, currentLocale, isRoot, storedLocale }, config) {
  if (!isRoot) return null;
  const desired = resolveProductLocale({ browserLanguages, storedLocale }, config);
  if (desired === currentLocale) return null;
  return config.locales.find(({ id }) => id === desired)?.route ?? null;
}

function localizedUrl(route) {
  return new URL(route.slice(1), publicOrigin).toString();
}

function renderLocaleSwitcher(document, config, currentLocale, messages) {
  const switcher = document.querySelector("[data-locale-switcher]");
  assert.ok(switcher, "product page locale-switcher placeholder is missing");
  switcher.setAttribute("aria-label", messages?.[switcher.getAttribute("data-i18n-aria-label")] ?? switcher.getAttribute("aria-label"));
  switcher.replaceChildren(...config.locales.map((locale) => {
    const link = document.createElement("a");
    link.href = locale.route;
    link.hreflang = locale.id;
    link.lang = locale.id;
    link.dataset.localeChoice = locale.id;
    link.textContent = locale.label;
    if (locale.id === currentLocale) link.setAttribute("aria-current", "page");
    return link;
  }));
}

function applyMessages(document, messages) {
  if (!messages) return;
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = messages[element.dataset.i18n];
  }
  for (const attribute of translationAttributes) {
    const marker = markerFor(attribute);
    for (const element of document.querySelectorAll(`[${marker}]`)) {
      element.setAttribute(attribute, messages[element.getAttribute(marker)]);
    }
  }
}

function appendTextElement(document, parent, elementName, text, className) {
  const element = document.createElement(elementName);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function releaseMessages(localization, locale) {
  const sourceMessages = localization.releaseSource.messages;
  if (locale.id === localization.config.sourceLocale) return sourceMessages;
  const catalog = localization.catalogs[locale.id].messages;
  return Object.fromEntries(
    Object.keys(sourceMessages).map((key) => [key, catalog[key]]),
  );
}

function renderReleaseDownloads(document, release, messages) {
  const parameters = { version: release.version };
  const message = (key) => formatMessage(messages[key], parameters);
  const slot = document.querySelector("[data-release-slot]");
  assert.ok(slot, "product page release-download slot is missing");

  const section = document.createElement("section");
  section.className = "release-downloads";
  section.dataset.releaseVersion = release.version;
  section.setAttribute("aria-labelledby", "release-downloads-title");
  const introduction = document.createElement("div");
  introduction.className = "release-download-introduction";
  appendTextElement(document, introduction, "p", message("release.eyebrow"), "eyebrow");
  const title = appendTextElement(
    document,
    introduction,
    "strong",
    message("release.title"),
  );
  title.id = "release-downloads-title";
  appendTextElement(document, introduction, "p", message("release.body"));
  section.append(introduction);

  const grid = document.createElement("div");
  grid.className = "release-download-grid";
  for (const platform of release.platforms) {
    const link = document.createElement("a");
    link.className = "release-download-card";
    link.dataset.releaseDownload = platform.target;
    link.href = platform.url;
    appendTextElement(
      document,
      link,
      "strong",
      message(`release.platform.${platform.key}.action`),
    );
    appendTextElement(
      document,
      link,
      "span",
      message(`release.platform.${platform.key}.detail`),
    );
    grid.append(link);
  }
  section.append(grid);

  const evidence = document.createElement("div");
  evidence.className = "release-download-evidence";
  const evidenceLink = document.createElement("a");
  evidenceLink.href = release.releaseUrl;
  evidenceLink.textContent = message("release.evidence");
  evidence.append(evidenceLink);
  appendTextElement(document, evidence, "span", message("release.trust"));
  section.append(evidence);
  slot.replaceChildren(section);

  document.querySelector('[data-i18n="hero.demonstrationLabel"]').textContent =
    message("release.demonstration.label");
  document.querySelector('[data-i18n="hero.demonstrationStatus"]').textContent =
    message("release.demonstration.status");
  document.querySelector('[data-i18n="product.intro"]').textContent =
    message("release.product.intro");
  for (const state of document.querySelectorAll(".product-stories .story-state")) {
    state.textContent = message(
      state.classList.contains("alpha")
        ? "release.product.stateAlpha"
        : "release.product.state",
    );
  }
  document.querySelector("#status-heading").textContent = message("release.status.heading");
  document.querySelector('[data-i18n="status.disclaimer"]').textContent =
    message("release.status.disclaimer");
  document.querySelector('[data-i18n="status.footnote"]').textContent =
    message("release.status.footnote");
  const releaseStatus = document.querySelector('details[data-status="active"]');
  const availableStatus = document.querySelector('details[data-status="available"]');
  availableStatus.querySelector("summary span").textContent =
    message("release.status.availableLabel");
  availableStatus.querySelector("summary h3").textContent =
    message("release.status.availableTitle");
  releaseStatus.querySelector("summary span").textContent = message("release.status.label");
  releaseStatus.querySelector("summary h3").textContent = message("release.status.title");
  const items = releaseStatus.querySelector("ul");
  items.replaceChildren(...release.platforms.map((platform) => {
    const item = document.createElement("li");
    item.textContent = message(`release.status.item.${platform.key}`);
    return item;
  }));
  const source = releaseStatus.querySelector("a");
  source.href = release.releaseUrl;
  source.textContent = message("release.status.source");
  const readiness = document.querySelector('[data-i18n="status.readiness"]');
  readiness.href = release.releaseUrl;
  readiness.textContent = message("release.evidence");
}

function renderLocalizedProductPage(localization, locale, release) {
  const dom = new JSDOM(localization.source);
  const { document } = dom.window;
  const messages = localization.catalogs[locale.id]?.messages;
  applyMessages(document, messages);
  if (release) renderReleaseDownloads(
    document,
    release,
    releaseMessages(localization, locale),
  );
  document.documentElement.lang = locale.id;
  document.documentElement.dataset.productLocale = locale.id;
  document.documentElement.dataset.productLocaleRoot = String(locale.route === "/");

  const canonical = document.querySelector('link[rel="canonical"]');
  assert.ok(canonical, "product page canonical link is missing");
  canonical.href = localizedUrl(locale.route);
  for (const alternate of document.querySelectorAll('link[rel="alternate"][hreflang]')) alternate.remove();
  for (const alternateLocale of localization.config.locales) {
    const alternate = document.createElement("link");
    alternate.rel = "alternate";
    alternate.hreflang = alternateLocale.id;
    alternate.href = localizedUrl(alternateLocale.route);
    document.head.append(alternate);
  }
  const fallback = document.createElement("link");
  fallback.rel = "alternate";
  fallback.hreflang = "x-default";
  fallback.href = localizedUrl(localization.config.locales.find(({ id }) => id === localization.config.fallbackLocale).route);
  document.head.append(fallback);

  renderLocaleSwitcher(document, localization.config, locale.id, messages);
  const runtime = document.createElement("script");
  const pageDirectory = path.posix.dirname(locale.output);
  runtime.src = path.posix.relative(pageDirectory, "locale.js") || "locale.js";
  runtime.dataset.productLocaleRuntime = "";
  document.head.append(runtime);

  for (const element of document.querySelectorAll("[data-i18n], [data-i18n-static]")) {
    element.removeAttribute("data-i18n");
    element.removeAttribute("data-i18n-static");
  }
  for (const attribute of translationAttributes) {
    for (const element of document.querySelectorAll(`[${markerFor(attribute)}]`)) {
      element.removeAttribute(markerFor(attribute));
    }
  }
  return dom.serialize();
}

export function renderLocalizedProductPages(localization, { release } = {}) {
  validateProductPageTranslationContract({ localization, source: localization.source });
  return Object.fromEntries(localization.config.locales.map((locale) => [
    locale.output,
    renderLocalizedProductPage(localization, locale, release),
  ]));
}

export function renderLocaleRuntime(config) {
  validateConfig(config);
  const runtimeConfig = JSON.stringify({
    fallbackLocale: config.fallbackLocale,
    locales: config.locales.map(({ id, route }) => ({ id, route })),
    storageKey: config.storageKey,
  });
  return `(() => {
  "use strict";
  const config = ${runtimeConfig};
  const byLanguage = (language) => {
    if (typeof language !== "string") return null;
    const normalized = language.toLowerCase();
    return config.locales.find(({ id }) => {
      const locale = id.toLowerCase();
      return normalized === locale || normalized.split("-")[0] === locale.split("-")[0];
    }) || null;
  };
  const storedLocale = () => {
    try { return window.localStorage.getItem(config.storageKey); }
    catch { return null; }
  };
  const persist = (locale) => {
    try { window.localStorage.setItem(config.storageKey, locale); }
    catch { /* The ordinary locale link remains functional. */ }
  };
  const browserLanguages = () => {
    try {
      if (Array.isArray(navigator.languages) && navigator.languages.length > 0) return navigator.languages;
      return typeof navigator.language === "string" ? [navigator.language] : [];
    } catch { return []; }
  };
  const resolve = () => {
    const stored = config.locales.find(({ id }) => id === storedLocale());
    if (stored) return stored.id;
    for (const language of browserLanguages()) {
      const locale = byLanguage(language);
      if (locale) return locale.id;
    }
    return config.fallbackLocale;
  };
  const root = document.documentElement.dataset.productLocaleRoot === "true";
  const current = document.documentElement.dataset.productLocale;
  if (root) {
    const desired = resolve();
    const target = config.locales.find(({ id }) => id === desired);
    if (target && target.id !== current) window.location.replace(target.route);
  }
  const bind = () => document.querySelectorAll("[data-locale-choice]").forEach((link) => {
    link.addEventListener("click", () => persist(link.dataset.localeChoice));
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
})();\n`;
}
