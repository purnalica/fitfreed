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

`npm run build:pages` creates the ignored, deployable `.artifacts/pages/` tree. The compositor copies
only the required product assets, converts repository-document links to canonical GitHub links, and
can carry one complete digest-bound `/updates/` snapshot without changing its bytes. The product
workflow runs the source checks, compositor, update-preservation preflight, atomic Pages deployment,
and exact remote-byte verification. It fails before deployment if a product-only artifact would
erase an active update channel.

## Domain operations

`release/public-origin.json` is the canonical origin source. The repository Pages setting uses
`fitfreed.org`, the `purnalica` organization must retain its Pages verification TXT record, and HTTPS
remains enforced. DNS contains the four GitHub Pages `A` records and four `AAAA` records at the apex.
`www` has one `CNAME` to `purnalica.github.io`; it exists only to redirect mistyped visits to the
canonical apex and is never used in product or update links. Wildcard records are forbidden.

Inspect the externally observed state with:

```sh
dig fitfreed.org A +noall +answer
dig fitfreed.org AAAA +noall +answer
dig www.fitfreed.org CNAME +noall +answer
dig _github-pages-challenge-purnalica.fitfreed.org TXT +noall +answer
gh api repos/purnalica/fitfreed/pages
gh api repos/purnalica/fitfreed/pages/health
```

The Pages API must report the exact custom domain, Actions build type, and enforced HTTPS. Both
health domains must be valid and respond over HTTPS before remote artifact acceptance. DNS changes
can temporarily leave recursive resolvers behind the authoritative IONOS state; never weaken the
checks or publish an alternate origin to bypass propagation.

[ADR 0020](../docs/architecture/decisions/0020-compose-product-and-update-pages.md) defines the
one-artifact deployment topology, privacy boundary, release-link ownership, and rollback constraint.
[ADR 0023](../docs/architecture/decisions/0023-use-fitfreed-org-as-the-public-origin.md) defines the
canonical origin and DNS boundary. The page must never claim a supported download before the
readiness ledger permits one.
