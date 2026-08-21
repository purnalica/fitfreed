import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { JSDOM } from "jsdom";

import {
  loadProductPageLocalization,
  productLocaleRedirect,
  renderLocaleRuntime,
  renderLocalizedProductPages,
  resolveProductLocale,
  validateProductPageTranslationContract,
} from "./product-page-localization.mjs";

const repositoryRoot = path.resolve(new URL("..", import.meta.url).pathname);

test("resolves a persisted choice before ordered browser preferences", () => {
  assert.equal(resolveProductLocale({
    storedLocale: "en-US",
    browserLanguages: ["es-ES", "en-US"],
  }), "en-US");
  assert.equal(resolveProductLocale({
    storedLocale: "es-ES",
    browserLanguages: ["en-US"],
  }), "es-ES");
  assert.equal(resolveProductLocale({
    storedLocale: "unsupported",
    browserLanguages: ["fr-FR", "es-MX", "en-US"],
  }), "es-ES");
  assert.equal(resolveProductLocale({
    storedLocale: null,
    browserLanguages: ["fr-FR", "en-GB", "es-ES"],
  }), "en-US");
  assert.equal(resolveProductLocale({
    storedLocale: null,
    browserLanguages: ["fr-FR", "de-DE"],
  }), "en-US");
});

test("negotiates only the neutral root and keeps direct localized routes stable", () => {
  const { config } = loadProductPageLocalization(repositoryRoot);
  assert.equal(productLocaleRedirect({
    browserLanguages: ["es-MX"],
    currentLocale: "en-US",
    isRoot: true,
    storedLocale: null,
  }, config), "/es/");
  assert.equal(productLocaleRedirect({
    browserLanguages: ["en-US"],
    currentLocale: "es-ES",
    isRoot: false,
    storedLocale: null,
  }, config), null);
  assert.equal(productLocaleRedirect({
    browserLanguages: ["es-ES"],
    currentLocale: "en-US",
    isRoot: true,
    storedLocale: "en-US",
  }, config), null);
});

test("validates exact catalog parity with the canonical English source", () => {
  const localization = loadProductPageLocalization(repositoryRoot);
  const result = validateProductPageTranslationContract({
    localization,
    source: localization.source,
  });

  assert.equal(result.sourceLocale, "en-US");
  assert.equal(result.localizedLocales, 1);
  assert.ok(result.messageCount > 80, "the complete product proposition must be localized");

  const [key] = result.keys;
  const missing = structuredClone(localization);
  delete missing.catalogs["es-ES"].messages[key];
  assert.throws(
    () => validateProductPageTranslationContract({ localization: missing, source: missing.source }),
    new RegExp(`missing.*${key}`, "iu"),
  );

  const extra = structuredClone(localization);
  extra.catalogs["es-ES"].messages.unused = "Sin uso";
  assert.throws(
    () => validateProductPageTranslationContract({ localization: extra, source: extra.source }),
    /extra.*unused/iu,
  );
});

test("renders deterministic, accessible-language static routes", () => {
  const localization = loadProductPageLocalization(repositoryRoot);
  const pages = renderLocalizedProductPages(localization);

  assert.deepEqual(Object.keys(pages), ["index.html", "es/index.html"]);
  const english = new JSDOM(pages["index.html"]).window.document;
  const spanish = new JSDOM(pages["es/index.html"]).window.document;

  assert.equal(english.documentElement.lang, "en-US");
  assert.equal(spanish.documentElement.lang, "es-ES");
  assert.equal(english.querySelector("link[rel=canonical]").href, "https://fitfreed.org/");
  assert.equal(spanish.querySelector("link[rel=canonical]").href, "https://fitfreed.org/es/");
  assert.match(english.querySelector("h1").textContent, /fitness export/iu);
  assert.match(spanish.querySelector("h1").textContent, /exportación de actividad física/iu);
  assert.match(spanish.querySelector('[data-status="available"]').textContent, /Implementado en el código/iu);
  assert.equal(spanish.querySelectorAll("[data-i18n]").length, 0, "build output must not expose source localization markers");

  for (const document of [english, spanish]) {
    assert.equal(document.querySelectorAll('link[rel="alternate"][hreflang]').length, 3);
    assert.deepEqual(
      [...document.querySelectorAll("[data-locale-choice]")].map((link) => ({
        href: link.getAttribute("href"),
        locale: link.dataset.localeChoice,
      })),
      [
        { href: "/", locale: "en-US" },
        { href: "/es/", locale: "es-ES" },
      ],
    );
    assert.equal(document.querySelectorAll("script[src]").length, 1);
  }
});

test("generates a fail-safe locale runtime without network behavior", () => {
  const localization = loadProductPageLocalization(repositoryRoot);
  const runtime = renderLocaleRuntime(localization.config);

  assert.match(runtime, /localStorage/u);
  assert.match(runtime, /location\.replace/u);
  assert.doesNotMatch(runtime, /fetch\s*\(/u);
  assert.doesNotMatch(runtime, /XMLHttpRequest/u);
  assert.doesNotThrow(() => new Function(runtime));
});

test("persists an explicit choice and survives unavailable browser storage", () => {
  const localization = loadProductPageLocalization(repositoryRoot);
  const runtime = renderLocaleRuntime(localization.config);
  const markup = `<!doctype html><html data-product-locale="es-ES" data-product-locale-root="false"><body>
    <button data-locale-choice="en-US">English</button>
    <button data-locale-choice="es-ES">Español</button>
  </body></html>`;
  const working = new JSDOM(markup, { runScripts: "outside-only", url: "https://fitfreed.org/es/" });
  working.window.eval(runtime);
  working.window.document.dispatchEvent(new working.window.Event("DOMContentLoaded"));
  working.window.document.querySelector('[data-locale-choice="en-US"]').dispatchEvent(
    new working.window.MouseEvent("click", { bubbles: true, cancelable: true }),
  );
  assert.equal(working.window.localStorage.getItem(localization.config.storageKey), "en-US");

  const unavailable = new JSDOM(markup, { runScripts: "outside-only", url: "https://fitfreed.org/es/" });
  Object.defineProperty(unavailable.window, "localStorage", {
    configurable: true,
    get: () => { throw new Error("storage unavailable"); },
  });
  assert.doesNotThrow(() => unavailable.window.eval(runtime));
  unavailable.window.document.dispatchEvent(new unavailable.window.Event("DOMContentLoaded"));
  assert.doesNotThrow(() => unavailable.window.document.querySelector('[data-locale-choice="en-US"]').dispatchEvent(
    new unavailable.window.MouseEvent("click", { bubbles: true, cancelable: true }),
  ));

  const unreadable = new JSDOM(markup.replace('data-product-locale-root="false"', 'data-product-locale-root="true"'), {
    runScripts: "outside-only",
    url: "https://fitfreed.org/",
  });
  for (const property of ["language", "languages"]) {
    Object.defineProperty(unreadable.window.navigator, property, {
      configurable: true,
      get: () => { throw new Error("browser preference unavailable"); },
    });
  }
  assert.doesNotThrow(() => unreadable.window.eval(runtime));
});
