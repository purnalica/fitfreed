# Polar AccessLink Dynamic API v4 Reference

## Status and boundary

Descriptive design reference verified against Polar's official public documentation on 2026-08-30. It documents the
external evidence needed to plan [FR-024](../../requirements.md#fr-024--incremental-connected-provider-synchronization);
it is not an implemented FitFreed connector, a normative source-to-canonical mapping, or evidence that the current API
licence permits a GPL desktop client.

This API is not the Polar Flow personal-data ZIP. Similar objects can establish field correspondence, but the API does
not specify archive layout, filename grammar, takeout delivery, or availability in a particular export. The archive
contract remains [Polar Flow personal data export](polar-flow.md).

Primary sources:

- [Polar AccessLink Dynamic API v4](https://www.polar.com/polar-api-v4/)
- [Polar API Limited License Agreement](https://www.polar.com/en/legal/polar-api-agreement)
- [Polar AccessLink v3](https://www.polar.com/accesslink-api/), used only where this reference explicitly says v3

## Authorization contract

**Official.** Polar documents OAuth 2 authorization-code flow. A registered API client has a client identifier and
client secret. The authorization endpoint accepts `client_id`, the only documented `response_type` value `code`, one
or more scopes, an exact registered redirect URI when required, and optional `state`. The token endpoint is
`https://auth.polar.com/oauth/token`; it requires HTTP Basic authentication with `client_id:client_secret` for both
authorization-code and refresh-token exchanges. An access token is valid for approximately 12 hours and the returned
refresh token obtains another access token.

The public v4 documentation reviewed on 2026-08-30 does not document PKCE, a device-authorization grant, or another
public native-client flow. A secret embedded in an open desktop binary is not confidential. FitFreed therefore cannot
ship the documented token exchange directly until Polar documents or approves a public-client mechanism; the proposed
secret-isolating boundary is described in [ADR 0038](../../architecture/decisions/0038-isolate-confidential-provider-oauth.md).

The least-privilege initial scopes are:

- `sports:read` for the sports catalogue; and
- `training_sessions:read` for training-session acquisition.

`training_targets:read` is required only when connected planned-training acquisition enters an accepted increment.
`profile:read` includes broad profile information such as email and is not required merely to correlate a connection
with an archive origin.

## Sports catalogue

**Official.** `GET https://www.polaraccesslink.com/v4/data/sports/list` requires `sports:read` and returns the Polar
catalogue used for sport profiles. The documented sport entry includes an identifier, modification instant, provider
name key, localized long names, optional parent reference, sport type, defaults, and supported features.

The exact identifier is the semantic reference for takeout `sport.id`, as established by the privacy-bounded
diagnostic recorded in the [archive reference](polar-flow.md#sport-catalogue-acquisition-boundary). The API response is
authorized user data under Polar's terms, not automatically a redistributable FitFreed asset. Bundled acquisition is
governed by [connected-provider synchronization architecture](../../architecture/connected-provider-synchronization.md#bundled-compatibility-catalogue).

## Training-session listing

**Official.** `GET https://www.polaraccesslink.com/v4/data/training-sessions/list` requires
`training_sessions:read` and accepts:

- `from`: ISO 8601 date, inclusive;
- `to`: ISO 8601 date, exclusive; and
- optional `features`.

Without `features`, one request may cover at most 90 days. With any feature, only one day may be requested. The
documented features are `samples`, `test-results`, `training-load-report`, `laps`, `hill-splits`, `routes`,
`statistics`, `zones`, `pause-times`, `strength-training-results`, `comments`, and `physical-info`.

The response contains stable training-session `identifier.id`, `created`, and `modified` evidence plus the base
training session and any requested supported feature objects. A FitFreed connector uses no-feature windows only for
discovery. A record selected for incorporation is retrieved again in its one-day window with the exact feature set
supported by the current mapping, because a summary response cannot prove absence or delete richer local components.

## Incremental and deletion limitations

**Official absence in the reviewed specification.** The v4 training contract documents date windows and record
`modified` values. It does not document a global modification cursor, pagination cursor, tombstone feed, or deletion
event for training sessions. FitFreed therefore uses overlapping date windows plus rotating historical audits and
never interprets absence as deletion.

The legacy v3 API documents webhooks, but that does not establish a v4 training-session webhook contract. A webhook
would also require hosted state and a public receiver. The current local-first direction uses bounded desktop pulls
instead of treating the v3 facility as an undocumented v4 guarantee.

## Rate and availability

**Official.** Polar documents per-client v4 limits of 3,000 requests per 15 minutes and 100,000 requests per 24 hours;
excess requests return HTTP 429. The provider makes no availability or continued-update guarantee in the API
agreement. FitFreed must apply bounded concurrency, backoff, visible freshness, and an unchanged local-library result
on transport or rate failure.

## Terms requiring explicit clearance

The Polar API Limited License Agreement reviewed on 2026-08-30:

- describes the granted use in terms of proprietary application or service development;
- restricts automated collection outside the authorized application;
- requires explicit member authorization and disclosure of what data is retrieved and stored;
- requires attribution of Polar as the data source;
- requires token revocation and deletion when the member relationship ends; and
- states that application-level agreement termination ends use and requires deletion of Licensed Materials and API
  Data.

This reference does not interpret those clauses as permission for, or a definitive prohibition of, FitFreed's GPL
connector. Implementation eligibility will be decided from dated published evidence, project-side legal and security
analysis, and explicit product risk acceptance without depending on a provider response. Source-channel provenance is
mandatory so any required removal of API-derived evidence cannot delete independent archive evidence.

## Mapping obligations before support

Before the connector becomes supported, FitFreed must publish and test a normative mapping that covers every requested
field and feature, including identity, revision, time, units, optionality, unknown fields, source-channel provenance,
component completeness, loss, conflict, and portable-exit behavior. The mapping must use the same provider-neutral
canonical contracts as archive import; the similarity of API and takeout objects is evidence, not permission to
bypass validation or reconciliation.
