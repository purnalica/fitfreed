# ADR 0040: Support Ubuntu LTS with Debian packages

- **Status:** Accepted
- **Date:** 2026-09-02
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Release delivery](../release-delivery.md), [Milestone 4 plan](../../plans/milestone-4.md)

## Context

The frozen first-MVP capability baseline must become installable, updateable, recoverable, and supportable on Linux.
"Linux" is not one executable environment: distribution families, desktop integration, package managers, system
libraries, architectures, and trust conventions differ. Claiming generic Linux support before choosing and verifying a
concrete boundary would make installation and recovery quality unverifiable.

Tauri can produce Debian, RPM, AppImage, Flatpak, Snap, and AUR-oriented artifacts. AppImage provides a convenient
single-file replacement model, but a direct download commonly requires an executable-permission step and does not
provide a familiar installed application or removal path by itself. Flatpak and Snap own updates outside FitFreed's
authenticated in-application update lifecycle. Supporting several package families at once would multiply native
installation and recovery matrices before one Linux path had complete evidence.

Ubuntu 24.04 LTS and Ubuntu 26.04 LTS are maintained desktop bases. Tauri's WebKitGTK 4.1 prerequisite is available
from their package repositories. GitHub provides a stable Ubuntu 24.04 x86-64 runner; its Ubuntu 26.04 runner is a
public preview at the time of this decision and is not sufficient by itself for a release claim.

## Decision drivers

- Give the initial Linux audience a familiar graphical installation and removal path.
- Retain FitFreed's authenticated in-application update policy and independent recovery guarantees.
- Define a support claim that can be reproduced in clean desktop environments.
- Minimize package-family and architecture breadth until one Linux path reaches release quality.
- Preserve a later additive path for other distributions, package formats, and architectures.

## Considered alternatives

### Support a standalone AppImage first

An AppImage is portable across compatible distributions and allows unprivileged file replacement and rollback. Its
first-run permission and desktop-integration experience is not consistently installation-like, however, and its
embedded signature is not automatically verified when launched. It remains a credible later portable artifact, but
not the first supported installation contract.

### Support Debian and AppImage artifacts together

This improves reach but creates two installed-layout, update, recovery, removal, documentation, and release-evidence
contracts. Neither artifact may inherit evidence from the other, so the additional surface would delay the first
complete Linux path.

### Support maintained Ubuntu LTS releases with one Debian package

A Debian package follows Ubuntu's native installation and removal conventions. Tauri's updater can install a verified
Debian update through operating-system authorization. The platform boundary is narrower than generic Linux but can be
stated and tested honestly.

## Decision

The first public Linux FitFreed release will support x86-64 Ubuntu Desktop 24.04 LTS and 26.04 LTS through one Debian
package.

- The release build runs on Ubuntu 24.04 x86-64, the oldest supported base.
- The package target is `linux-x86_64-deb` and is the only Linux updater target in the first parity release.
- Installation and removal follow the Ubuntu graphical package-management path; neither requires a development
  toolchain or project-authored terminal command.
- In-application replacement uses FitFreed's authenticated update envelope and Tauri's Debian installer boundary. An
  operating-system authorization prompt is part of that native operation.
- Public artifacts carry SHA-256 inventories, a detached FitFreed release signature, source-bound GitHub provenance,
  and the mandatory updater signature. Linux does not require an Apple- or Authenticode-equivalent platform identity;
  the documentation will state this trust boundary rather than imply one.
- AppImage, RPM, Flatpak, Snap, AUR, ARM64, other distribution families, and unmaintained Ubuntu releases are not
  supported by this first Linux release. Their addition requires their own installation, update, recovery, and removal
  evidence.
- Support for Ubuntu 26.04 is not claimed until a clean Ubuntu 26.04 Desktop candidate passes the complete native
  matrix. A preview hosted runner may provide earlier diagnostic evidence but cannot replace that gate.

## Consequences

### Positive

- The initial Linux support statement is concrete and independently testable.
- Ubuntu users receive familiar installation and removal behavior.
- One package identity keeps update, recovery, documentation, and support evidence coherent.
- Later package families can be added without changing the provider-neutral product model.

### Negative

- Users of other Linux distributions and ARM64 systems remain unsupported initially.
- Debian update and rollback operations may require operating-system authorization.
- Ubuntu 24.04 and 26.04 each require release-candidate evidence despite sharing one package.

### Risks and mitigations

- A package built on a newer base may acquire incompatible glibc or WebKitGTK requirements. The release build is fixed
  to Ubuntu 24.04 and both supported LTS versions receive clean-environment verification.
- A failed replacement could leave package-manager state newer than the runnable application. ADR 0042 requires an
  authenticated predecessor package plus a preserved runnable predecessor before replacement begins.
- A direct Debian package has no universally enforced platform-signature ceremony. The public release binds it through
  authenticated hosting, checksums, detached release signing, mandatory updater signing, and GitHub provenance.

## Verification

Normal CI must compile and test the complete desktop host on Ubuntu 24.04. Platform CI must build the Debian package and
run packaged capability, localization, accessibility, update, and failure-boundary E2E under a virtual display. An
exact public candidate must additionally pass clean graphical installation, first launch, update, failed-update
recovery, migration, removal, offline launch, and retained-library checks on Ubuntu Desktop 24.04 and 26.04 x86-64.
Reconsider the boundary when another package family or architecture can fund an independent complete matrix, or when
either selected Ubuntu release leaves its maintained lifecycle.
