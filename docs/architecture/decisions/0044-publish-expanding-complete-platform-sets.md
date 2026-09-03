# ADR 0044: Publish expanding complete platform sets

- **Status:** Accepted
- **Date:** 2026-09-03
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Release delivery](../release-delivery.md), [product roadmap](../../roadmap.md)

## Context

FitFreed must become publicly available in the order macOS, Linux, then Windows while the first-MVP capability set
remains frozen. Every GitHub Release becomes immutable before its corresponding Pages update snapshot is promoted.
Consequently, a macOS-only public Release cannot receive Linux or Windows assets later, and publishing an unaccepted
later-platform asset early would violate the independent platform gate.

The authenticated stable update contract identifies one application version across every target in its platform map.
Keeping an already supported platform at an older application version inside a newer common envelope would therefore
misrepresent the offered update. Independent platform-specific version streams would require separate endpoints,
sequence policies, withdrawal state, Pages trees, installed configuration, support ledgers, and recovery rules.

This decision defines release-set composition only. It does not authorize a tag, release, candidate acceptance,
signing credential, or publication, and it does not change platform support boundaries or product functionality.

## Decision drivers

- Preserve the confirmed macOS, Linux, then Windows public-availability order.
- Keep every published Release immutable and every downloadable asset independently accepted before exposure.
- Retain one authenticated stable update policy and one current application version across supported platforms.
- Keep GitHub Release, Pages, checksums, signatures, provenance, notes, support, and withdrawal state convergent.
- Avoid rebuilding an old immutable artifact or copying it under a new version identity.

## Considered alternatives

### Add later-platform assets to the first public Release

This would require changing an immutable Release or leaving the first Release mutable until every platform is ready.
The first path is impossible by contract; the second weakens the accepted trust and rollback boundary and prevents an
independently complete macOS publication.

### Publish every platform from the first Release but reveal links serially

A public GitHub Release exposes its assets independently of the product-site links. An unaccepted Linux or Windows
package would already be publicly downloadable and therefore published, even if the site did not advertise it.

### Maintain independent platform versions and stable endpoints

This avoids rebuilding an already supported platform when another enters support. It fragments application version,
channel sequence, withdrawal, recovery, support, and Pages state across three feeds. That long-lived complexity is not
justified by the two bounded platform-expansion releases required for the frozen MVP baseline.

### Publish a new complete platform set at each expansion

Each later platform enters through a new semantic version and immutable Release. The release also contains newly
built, currently versioned candidates for every previously supported platform. All targets share the same stable
version and evidence set, while the new platform remains absent until its own expansion Release is accepted.

## Decision

Every public platform expansion uses a new semantic version and publishes the complete set of platforms supported by
that version.

- The first public Release contains the accepted macOS target only.
- The Linux expansion Release uses a later version and contains newly built and accepted macOS and Linux targets.
- The Windows expansion Release uses a later version and contains newly built and accepted macOS, Linux, and Windows
  targets.
- The exact later version is assigned only after the preceding platform Release is immutable. A repository development
  version or draft guide does not reserve that version for a platform.
- Every included target is built from the same tagged source and reports the same application and library-schema
  version. An earlier package is never renamed, copied, or represented as the new version.
- Every included target repeats its applicable build, native trust, installation, update, recovery, removal,
  accessibility, localization, performance, and package-content gates. Evidence from the preceding version establishes
  a supported predecessor but does not admit the newly built bytes.
- The immutable GitHub Release, signed checksum set, manifest, provenance subjects, release notes, support matrix, and
  Pages update snapshot contain every target in that expansion. A platform package cannot exist only in Pages or only
  in signed metadata.
- Product-site download links advance atomically to the accepted expansion version. A new platform link appears only
  when that platform's candidate and the complete expanding release set pass.

## Consequences

### Positive

- Ordered platform publication and immutable releases remain compatible.
- Installed applications share one current version, update sequence, withdrawal policy, and support statement.
- A person reaching the latest Release finds installers for every currently supported platform.
- Every update package has a human-facing immutable Release record, checksum, signature, provenance, and support path.

### Negative

- A Linux expansion rebuilds and revalidates macOS, and a Windows expansion rebuilds and revalidates both earlier
  platforms even when product behavior is unchanged.
- Later expansion candidates require the protected native signing authority of every included platform.
- A failure in an earlier-platform rebuild blocks the complete expansion Release.

### Risks and mitigations

- A platform expansion could be mistaken for functional growth. Release notes identify platform parity and fixes only,
  and the frozen capability gate remains in force through the Windows expansion.
- Cross-platform builds could produce divergent versions or revisions. Candidate composition rejects any target whose
  application version, source revision, schema, stable sequence, or artifact identity differs.
- One platform could be omitted from checksums, provenance, or Pages. The release manifest owns the exact expanding
  target set and every verifier derives all downstream subjects from it.
- Rebuilding prior targets adds cost. Impact-aware development CI remains reusable, while exact release candidates
  deliberately repeat native package and trust evidence because their bytes and version changed.

## Verification

Release-contract tests must reject a Linux expansion without macOS and a Windows expansion without both macOS and
Linux. They must also reject mixed versions, revisions, schemas, incomplete checksum or provenance sets, Pages-only
packages, and artifacts from an earlier immutable version. Exact candidate workflows must seal, reopen, evaluate, and
promote one complete target set. Remote verification must prove every downloadable and updater artifact against the
same immutable tag and source revision before the new platform is described as supported.

Reconsider this decision only if repeated platform-expansion releases demonstrate that independent platform channels
would materially reduce total operational risk rather than merely build time.
