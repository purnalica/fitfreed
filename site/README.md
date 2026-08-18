# Product page source

## Status

Reviewable static product-page source. It is not deployed and contains no release download action.
Its statements derive from the product thesis, current capability boundary, active experience plan,
and roadmap; those documents remain authoritative.

The available, active, and later capability block is generated from
[`docs/product-status.json`](../docs/product-status.json). Change that source and run
`npm run render:product-surfaces`; `npm run check:product-surfaces` rejects a divergent README or
page.

The interface illustrations use independently invented labels and values. They contain no private
export, route, report, screenshot, or derived personal-data fingerprint.

## Local review

From the repository root:

```sh
python3 -m http.server 4175 --bind 127.0.0.1
```

Open <http://127.0.0.1:4175/site/>. Review at narrow and wide widths, 200% browser zoom, dark system
appearance, reduced motion, keyboard-only navigation, and automated accessibility analysis before
any deployment.

Publication requires a separate decision about the canonical URL, deployment workflow, analytics
boundary, localization, release calls to action, and rollback. The page must never claim a supported
download before the readiness ledger permits one.
