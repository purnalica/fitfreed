# Polar Interoperability Evidence

## Status

Active, non-personal research record verified on 2026-08-31. This document establishes reproducible inputs and the
acquisition procedure for the bundled Polar sport compatibility catalogue and the later connected adapter. It does
not contain a participant identifier, account response, credential, training value, source path, or private catalogue
value.

Provider assistance is not a dependency. Public official contracts are primary evidence; independently maintained
open-source implementations corroborate practical protocol behavior. Ordinary source-licence and attribution review
applies, but a hypothetical concern is not treated as a blocker without a concrete conflict.

## Official API evidence

Polar publishes the complete Dynamic API v4 Swagger contract at
[`https://www.polar.com/polar-api-v4/swagger.yaml`](https://www.polar.com/polar-api-v4/swagger.yaml). The version
retrieved on 2026-08-30 has SHA-256
`e69062ab64994e1ea1d279c8aa906cb6c13ec06d084edaf0e71f17bc889a5098`.

The contract establishes:

- `GET /v4/data/sports/list` is the reference catalogue for sport identifiers and requires `sports:read`;
- each sport supplies an opaque identifier, modification instant, stable string name, localized-name map, parent
  identifier, type, defaults, and supported features;
- `GET /v4/data/training-sessions/list` supplies exact session identifiers and revisions over bounded date windows;
  and
- the OAuth token exchange uses a registered client identifier and secret.

The public Swagger example is schematic and does not contain the live identifier-to-name catalogue. The richer
authenticated endpoint remains relevant to later connected synchronization, but it is not required to build the
archive compatibility snapshot because Polar Flow publishes the required identifier mapping separately.

## Public sport-identifier evidence

Polar Flow publishes the global numeric identifier-to-stable-name-key mapping without authentication at
[`https://flow.polar.com/api/sports/sports`](https://flow.polar.com/api/sports/sports). The response retrieved on
2026-08-31 has SHA-256 `f795b9f12a030abd2ae8d17cae220fddb94bdb02c8722f70831e2ceb975e942` and contains
165 distinct numeric identifiers mapped to 165 distinct stable keys. A request made without browser state, cookies,
credentials, or an account returns the same semantic mapping as the authenticated Flow application.

Every stable key in that mapping has a non-empty long name in both supported public localization namespaces. The
numeric mapping and localization responses contain no account, profile, session, device, route, or other participant
data. The public mapping does not publish provider hierarchy, defaults, descriptions, or feature settings; the
compatibility snapshot must therefore omit those facts rather than infer them.

## Public localization evidence

The current Flow web application publishes its localization base URL in the unauthenticated runtime configuration.
The versioned language index is available at
[`https://localizations.flow.polar.com/v2/json-namespaced/index.json`](https://localizations.flow.polar.com/v2/json-namespaced/index.json).
The retrieved index reports version `2.437.0` and has SHA-256
`0a1e97353ad063655c123852c0e6a07d20ce277951d8c2cc8567f29ff4cc6871`.

The public `en/sport.json` and `es/sport.json` namespaces each contain the same 186 sport-shaped stable keys with
human-readable long names. Their retrieved SHA-256 values are respectively
`e1395ca52a8157c3e1a6dcb82fe34f8750b18e4309213f1bb369808c89b6b845` and
`15f0db314cda4373db1e19741a73e1c2e0966a6b0b9c653a51a597fd2b73741b`.

These public assets establish the provider vocabulary and translation-key semantics. The generator retains only the
ordinary human sport names needed for `en-US` and `es-ES`; provider descriptions, abbreviated device labels, icons,
defaults, and settings are outside the compatibility snapshot.

## Open-source implementation evidence

The following repositories were inspected at fixed revisions:

| Source | Revision | Licence | Evidence |
|---|---|---|---|
| [Polar official AccessLink Python example](https://github.com/polarofficial/accesslink-example-python) | `1bc8b890ce3d86dc9310939323dbef156cff5617` | MIT | Ordinary client registration, authorization-code callback, client-secret token exchange, and authenticated API requests |
| [polar-mcp](https://github.com/davidmosiah/polar-mcp) | `90c37ce939af43366b1e27140af9bbc3e5a5b280` | MIT | Local-first v4 calls, `sports:read`, sport and training-session endpoints, refresh-token handling, date-window contracts, and privacy filtering |
| [polarfetch](https://github.com/jcaneiro/polarfetch) | `4c4e5373fd369eb5d22f7444b0d3ce4558ac83d9` | MIT | Complete-history v4 acquisition, registered client credentials, token refresh, and bounded training-session listing |
| [rwPolarSync](https://github.com/rowe182/rwPolarSync) | current repository licence verified 2026-08-30 | GPL-3.0 | Public GPL AccessLink client precedent; its older API surface is not a v4 mapping source |

The repositories confirm that AccessLink is routinely consumed from public open-source software. None of the
inspected repositories is used as the numeric sport-mapping source; FitFreed acquires that mapping directly from the
public Flow endpoint and uses the repositories only as protocol evidence for later optional synchronization.

## Catalogue acquisition procedure

1. Fetch the public numeric sport mapping and the public localization index plus `en/sport.json` and `es/sport.json`
   namespaces into an ignored local evidence directory. No authorization or account state is involved.
2. Record every raw response digest, the retrieval instant, the localization revision, and the pinned official API
   contract digest.
3. Generate only the compatibility facts required by the provider-catalogue contract: numeric identifier, stable name
   key, reviewed `en-US` and `es-ES` human names, and an optional provider-neutral family suggestion. Parent evidence
   remains absent because the public source does not provide it.
4. Require exact digest verification and complete agreement between the mapping's stable keys and both localization
   namespaces. Unknown identifiers, missing keys, duplicate identifiers, changed source shape, or untranslated
   supported entries fail generation.
5. Verify complete coverage with synthetic fixtures and the fixed privacy-bounded real-reference predicate before
   activating the snapshot or constructing another application candidate.

The deterministic generator, generated minimal snapshot, and provenance manifest are versioned product artifacts.
The public raw responses remain replaceable local build evidence and are not shipped verbatim.

## User connection consequence

Existing public implementations require each operator to supply a client secret locally. That is acceptable for a
developer tool but not for FitFreed's consumer experience and cannot protect one shared secret in a public desktop
binary. FitFreed therefore registers one project client and keeps its secret in the minimal OAuth broker proposed by
[ADR 0038](../architecture/decisions/0038-isolate-confidential-provider-oauth.md). Users authorize normally in their
system browser; API data travels directly to the desktop and tokens remain in operating-system protected storage.

This conclusion comes from the documented protocol and observable open-source implementations. It does not depend on
a private provider arrangement.

## Remaining connected-adapter evidence

- Determine the ordinary project-client registration and deployment details for the OAuth broker before accepting ADR
  0038.
- Continue monitoring the official Swagger and public localization version so catalogue drift becomes a normal
  compatibility update rather than another user-reported recognition failure.
