# Training Sport Identity Version 2

## Status and boundary

Normative provider-neutral identity fragment for current Home, History, session story, and report read models.
Version 2 retains every state, precedence, locale, provenance, privacy, and reimport rule from
[version 1](training-sport-identity-v1.md). JSON conforms to
[`training-sport-identity-v2.schema.json`](../../../schemas/training-sport-identity-v2.schema.json).

Version 2 makes one source-evidence distinction explicit: exact session evidence can recognize or make
ambiguous a session whose source record did not provide a classifiable sport profile. In that case `state` is
`recognized` or `ambiguous`, while both `sportRef` and `classification` are null. A non-null `sportRef` still
requires the unresolved revision-zero classification. Mixed pairs are invalid.

## Capability meaning

`sportRef` is exclusively the capability for authoring personal meaning for one recorded source profile. It
is not the identity of a represented collection and is never a visible name. A session without a source
profile cannot be classified through an invented profile capability, even when exact target evidence names
the session.

The remaining shapes are unchanged. `unknown` requires a recorded profile and unresolved classification;
`unavailable` represents no profile and no recognition evidence; `personally-overridden` requires a real
profile plus a positive-revision user classification. Recognition still carries provider-neutral localized
names and versioned provenance without exposing raw provider identifiers.

Changing capability meaning, nullable pairing, state resolution, evidence precedence, locale fallback,
provenance, or privacy requires a new identity version and new versions of every embedding response.
