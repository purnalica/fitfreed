# ADR 0050: Retire SignPath as the Windows signing authority

- **Status:** Accepted
- **Date:** 2026-09-16
- **Decision owners:** FitFreed project owner
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Release delivery](../release-delivery.md), [ADR 0045](0045-separate-windows-native-and-updater-signing-authority.md), [Milestone 5 plan](../../plans/milestone-5.md)
- **Supersedes:** [ADR 0049](0049-use-signpath-for-windows-authenticode.md)

## Context

ADR 0049 selected the SignPath Foundation open-source service as FitFreed's prospective Windows Authenticode
authority. The service remained an external gate: no SignPath organization, certificate, signing policy, API token,
or production signature ever entered the admitted release path.

SignPath Foundation declined FitFreed's application on 2026-09-16 because the project did not yet demonstrate the
external adoption and public visibility required by the program. The project owner subsequently closed both a new
Foundation application and a paid SignPath subscription as delivery options. Retaining SignPath as the selected
authority would therefore make the current architecture contradict the only available external evidence and the
owner's explicit operational decision.

This decision retires one unavailable provider. It does not select another certificate authority, authorize an
unsigned release, change the updater or release-integrity keys, or authorize publication.

## Decision drivers

- Keep current architecture and operational guidance truthful about available signing authority.
- Avoid further time or money on a provider the project owner has explicitly closed.
- Preserve already accepted Windows product and packaging evidence while the native-trust route is reconsidered.
- Prevent an unavailable external gate from being mistaken for an active release procedure.
- Evaluate European individual-validation certificates and a transparent unsigned preview without weakening either
  path by implication.

## Considered alternatives

### Reapply to SignPath Foundation after further project growth

The rejection explicitly permits a later application, but the project owner has closed that route. Public adoption
may still be useful evidence for another authority decision; it is not a reason to keep SignPath selected.

### Purchase a paid SignPath subscription

This would preserve most of the implemented connector topology, but it retains a provider the owner has rejected and
adds a recurring cost before any Windows demand exists.

### Retire SignPath without selecting its replacement

This leaves Windows promotion blocked temporarily but records the real state, preserves valid platform-engineering
evidence, and permits a separate evidence-based decision between European certificate custody and a deliberately
unsigned preview. This is the selected alternative.

## Decision

SignPath is no longer a FitFreed signing or delivery option. ADR 0049 is superseded and its GitHub connector topology
is inactive.

The existing SignPath-specific implementation and documentation are retained temporarily as historical engineering
material. Before any of them are removed, archived, or repurposed, the project will inventory every artifact and
incoming dependency, relocate any provider-neutral release behavior, and prove that no live release path still
depends on the retired integration.

Windows public distribution remains unselected. The active evaluation compares:

1. an Authenticode certificate available to an individual from a European certificate authority; and
2. an explicitly labelled unsigned Windows preview whose integrity remains protected by FitFreed's independent
   updater signatures, release checksums, provenance, and immutable official download origin.

Either selection requires a later ADR and matching release contracts before it can produce or publish a Windows
candidate.

## Consequences

### Positive

- Current documentation no longer presents a declined service as an attainable production gate.
- The accepted Windows engineering, package, update-recovery, and performance evidence remains reusable.
- Provider selection and the separate decision to accept or reject unsigned installation friction remain explicit.
- No unavailable SignPath credential or portal configuration blocks useful evaluation work.

### Negative

- The implemented Windows release workflow cannot currently create a publishable candidate.
- SignPath-specific code and tests remain temporarily present while their dependencies are inventoried.
- Selecting a different authority or unsigned trust profile requires release-contract and automation changes.

### Risks and mitigations

- Retained SignPath material could be mistaken for current procedure. Current policy, architecture, milestone, and
  readiness documents identify it as inactive and link to this decision.
- Removing the integration prematurely could discard provider-neutral NSIS packaging work. The repository archival
  policy requires a complete content and incoming-dependency inventory before removal.
- An unsigned package could be presented as equivalent to a signed stable release. No such package is authorized by
  this decision; a later decision must define its channel, warnings, supported installation boundary, and evidence.

## Verification

Current architecture and status documents must identify SignPath as retired, must not claim active sponsorship or
production authority, and must keep Windows publication blocked until a later decision is accepted. Existing
SignPath-specific tests remain historical integration evidence until the required dependency inventory determines
their disposition. No public Windows workflow may submit a signing request to SignPath or publish an unsigned package
under this decision.
