# ADR 0023: Use fitfreed.org as the public origin

- **Status:** Accepted
- **Date:** 2026-08-18
- **Decision owners:** FitFreed maintainers and product owner
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Release delivery](../release-delivery.md), [ADR 0020](0020-compose-product-and-update-pages.md)

## Context

ADR 0020 established one GitHub Pages deployment for the product site and authenticated update channel, initially at the repository's generated `purnalica.github.io` project URL. FitFreed now owns `fitfreed.org`. A product-owned origin is shorter, memorable, independent of the current GitHub organization path, and suitable for durable product, documentation, and update links.

Changing a Pages custom domain also changes transport behavior at the generated project URL. GitHub redirects that URL to the configured custom domain. FitFreed's update client deliberately refuses redirects, so the application update endpoint and remote publication checks must use the custom origin directly before the update channel is activated.

## Decision

`https://fitfreed.org/` is the canonical public origin for FitFreed.

- The root hosts the product and adoption site. `/updates/` remains the direct authenticated update channel owned by the single Pages artifact defined by ADR 0020.
- `fitfreed.org` is the configured GitHub Pages custom domain. `www.fitfreed.org` points directly to `purnalica.github.io` in DNS and redirects to the canonical apex through GitHub Pages.
- The apex uses only GitHub's documented Pages address records. Wildcard DNS records are forbidden.
- The domain is verified for the `purnalica` organization before production use, and its GitHub Pages verification TXT record remains present to reduce domain-takeover risk.
- HTTPS is enforced after GitHub provisions the certificate. HTTP is never an application update transport.
- The generated `https://purnalica.github.io/fitfreed/` address is a platform-owned compatibility entry point, not a canonical URL or an updater endpoint.
- Public-origin configuration is versioned once and consumed by product links, Pages publication checks, update configuration, release verification, and documentation validation. Human-readable documents describe responsibilities and link to that source instead of defining competing URL values.
- Configuring the product domain does not activate downloads, publish a binary release, or activate the update channel.

## Consequences

- Product links remain stable if the repository later moves between GitHub accounts or organizations.
- DNS ownership, organization verification, certificate state, Pages configuration, and exact remote bytes become observable publication gates.
- A Pages domain change cannot be treated as cosmetic because a stale updater URL would fail closed on GitHub's redirect.
- DNS administration remains an external human authority boundary; repository and GitHub Pages automation can verify but cannot invent or bypass those records.

## Verification

Acceptance requires:

1. GitHub Pages domain verification for `purnalica` remains valid.
2. Apex `A` and `AAAA` answers equal GitHub's documented Pages addresses, and `www` resolves by `CNAME` directly to `purnalica.github.io`.
3. GitHub reports `fitfreed.org` as the repository Pages custom domain with HTTPS enforced and a healthy certificate.
4. `https://fitfreed.org/` serves the exact composed Pages artifact, while `https://www.fitfreed.org/` and the generated project URL redirect only to the canonical HTTPS origin.
5. The inactive and future active update configuration names `https://fitfreed.org/updates/stable.json` directly, and publication verification rejects redirects for update objects.

The DNS and security requirements follow GitHub's official [custom-domain configuration](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) and [Pages domain-verification](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages) guidance.
