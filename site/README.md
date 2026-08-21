# Product page source

## Status

Reviewable static source for the canonical product site at <https://fitfreed.org/>. The source
contains no release download action. Its
statements derive from the product thesis, current capability boundary, active experience plan, and
roadmap; those documents remain authoritative.

The available, active, and later capability block is generated from
[`docs/product-status.json`](../docs/product-status.json). Change that source and run
`npm run render:product-surfaces`; `npm run check:product-surfaces` rejects a divergent README or
page.

`site/index.html` is the only structural page source and contains the canonical `en-US` text.
Translatable text and accessible labels use stable `data-i18n` keys. The complete Spanish catalog is
[`site/locales/es-ES.json`](locales/es-ES.json); its flat `messages` object can be exchanged with
collaborative translation tools without giving translators generated HTML to maintain.

When changing product copy:

1. edit the English source and give each new translatable leaf or attribute a stable semantic key;
2. add the same key to every non-source catalog;
3. run `npm run check:site` to reject missing, extra, empty, unmarked, or duplicated source keys; and
4. review both generated routes at narrow and wide widths because translated text changes layout.

The page informs rather than advertises. Every capability claim must be traceable to the current
status source, active work and later scope must remain visibly distinct, and a limitation that would
change a visitor's expectation must be stated in context. Visual personality is welcome, but
billboard-scale promises, manufactured urgency, promotional superlatives and calls to action that
suggest an unavailable release are not. Progressive disclosure keeps the full account accessible
without turning the first viewport into either a campaign or a warning ledger.

Do not edit generated localized HTML. Adding a locale also requires one entry in
`site/locales/config.json`, a complete catalog, route metadata, and acceptance coverage under
[ADR 0024](../docs/architecture/decisions/0024-generate-localized-product-pages.md).

The interface illustrations use independently invented labels and values. They contain no private
export, route, report, screenshot, or derived personal-data fingerprint.

## Local review

From the repository root:

```sh
npm run build:pages
python3 -m http.server 4175 --bind 127.0.0.1 --directory .artifacts/pages
```

Open <http://127.0.0.1:4175/> for English and <http://127.0.0.1:4175/es/> for Spanish. Review at
narrow and wide widths, 200% browser zoom, dark system appearance, reduced motion, keyboard-only
navigation, and automated accessibility analysis before any deployment. Serving the composed
artifact is mandatory because localized routes and the preference runtime do not exist in the source
directory.

`npm run build:pages` creates the ignored, deployable `.artifacts/pages/` tree. The compositor copies
only the required product assets, converts repository-document links to canonical GitHub links, and
can carry one complete digest-bound `/updates/` snapshot without changing its bytes. The product
workflow runs the source checks, compositor, update-preservation preflight, atomic Pages deployment,
and exact remote-byte verification. It fails before deployment if a product-only artifact would
erase an active update channel.

The English root is the deterministic fallback. On its first visit, the local locale runtime follows
the browser's ordered language preferences and selects Spanish only when it is the first supported
language. An explicit English or Spanish choice is persisted locally when browser storage is
available. Direct `/es/` visits remain Spanish, ordinary links keep switching functional without
JavaScript, and localization never reads or changes `/updates/`.

## Publication boundary

`release/public-origin.json` is the canonical origin source. Publishing and remote acceptance are
automated repository workflows rather than prerequisites for contributing a page improvement.

[ADR 0020](../docs/architecture/decisions/0020-compose-product-and-update-pages.md) defines the
one-artifact deployment topology, privacy boundary, release-link ownership, and rollback constraint.
The page must never claim a supported download before the readiness ledger permits one.
