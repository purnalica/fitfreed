# Windows Candidate Admission Policy Version 1

## Purpose and authority

The Windows candidate admission policy is the reviewed, source-controlled boundary between a clean native host and
the Windows 11 support promise. It prevents a hosted Windows Server result, an unsupported Windows release, an
unreviewed edition, or stale lifecycle knowledge from being presented as Windows 11 product acceptance.

[`windows-candidate-admission-policy-v1.schema.json`](../../../schemas/windows-candidate-admission-policy-v1.schema.json)
is the normative machine-readable JSON Schema. `release/windows-candidate-admission.json` is the current policy
instance. This document describes its semantic checks.

The policy does not authorize a release, select a runner, contain signing authority, or prove that a candidate passed.
It is an input to exact-candidate admission and must be combined with the native facts from the admission host and the
sealed candidate's authenticated evidence.

## Location and encoding

- Path: `release/windows-candidate-admission.json`.
- Media type: `application/json`.
- Encoding: UTF-8 with a final newline.
- Format identifier: `org.fitfreed.windows-candidate-admission-policy`.
- Schema selector: `schemaVersion`; this contract requires `1`.
- Unknown properties are invalid.

The current instance and every synthetic example are free of hostname, account, device identifier, network address,
local path, credential, user library, and participant data.

## Review identity

| Field | Type | Meaning |
|---|---|---|
| `reviewedAt` | ISO 8601 calendar date | Date on which the release and edition rows were reconciled with every listed official source. |
| `sources` | Unique array of HTTPS URLs | Microsoft Learn documents used to establish current Windows client servicing, release builds, and edition identity. |

Every source must use `https://learn.microsoft.com/` without credentials, query parameters, or fragments. Candidate
issuance rejects a policy reviewed more than 45 days earlier, a future review date beyond the permitted same-day time
boundary, or a release row whose support already ended. A candidate prepared later therefore cannot silently inherit
today's time-sensitive support assumptions.

## Supported release rows

Each entry in `releases` contains:

| Field | Type | Meaning |
|---|---|---|
| `displayVersion` | Windows release identifier | The native `DisplayVersion`, such as `25H2`. |
| `build` | Integer | The native base `CurrentBuildNumber`; the update build revision remains host evidence rather than policy. |
| `supportEndsOn` | ISO 8601 calendar date | End of servicing for the edition family represented by this row. |
| `editionIds` | Unique array of strings | Native Windows edition identifiers admitted under that servicing date. |

Rows and their edition identifiers are byte ordered. The same release and build may have multiple rows because
consumer and enterprise edition families have different servicing dates. An exact host must match one and only one
row by `displayVersion`, `build`, and `EditionID`. The host must also independently report x86-64 architecture,
`Client` installation type, and workstation product type; a policy row alone cannot admit Windows Server or Windows
on ARM.

The source list establishes Windows lifecycle and the mechanism used to read native edition identity. The checked-in
edition-family mapping is a reviewed FitFreed admission decision, not a claim that Microsoft publishes this JSON
representation. Editions outside the closed list require a policy change and review before they can carry product
support evidence.

## Native evidence and privacy

The host inspector reads only the architecture, installation type, workstation product type, display version, base
build, update build revision, edition identifier, and the local SignTool executable needed during verification. The
validator rejects any additional field. The SignTool path is used inside the native verification process and is
discarded before retained output is written.

Retained admission output contains only public product facts: Windows 11, x86-64, edition identifier, full build,
matched support end, policy review date, candidate version and source revision, and Boolean or closed-enumeration gate
results. It never records the machine or account identity.

## Failure and evolution

Malformed dates, stale review, non-Microsoft sources, unsupported releases or editions, duplicate or unordered values,
unknown fields, and ended servicing block candidate admission. They do not degrade to generic Windows evidence.

Refreshing dates or supported rows changes the current policy instance and requires source review plus automated valid
and invalid evidence. Changing field meaning, host matching semantics, identity, or privacy boundaries requires a new
schema version. Previously retained candidate evidence remains bound to the policy review date used at its issuance;
it is not reinterpreted through a later policy.
