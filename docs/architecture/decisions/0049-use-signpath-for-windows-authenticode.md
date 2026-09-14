# ADR 0049: Use SignPath for Windows Authenticode

- **Status:** Accepted
- **Date:** 2026-09-14
- **Decision owners:** FitFreed project owner
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Release delivery](../release-delivery.md), [ADR 0045](0045-separate-windows-native-and-updater-signing-authority.md), [Milestone 5 plan](../../plans/milestone-5.md)

## Context

FitFreed requires the public Windows setup, installed application, and installed uninstaller to carry trusted,
timestamped Authenticode signatures. The previous delivery design placed a password-protected certificate bundle on
a disposable self-hosted Windows builder, imported its non-exportable private key for one job, and removed it after
packaging. Current public certificate issuance instead requires hardware-backed custody, and a physical token cannot
be attached reliably to a GitHub-hosted release job. Depending on another person or service operator to sign each
release locally would create an operational bottleneck and weaken source-to-binary provenance.

SignPath Foundation offers qualifying open-source projects a public code-signing certificate held in SignPath's HSM.
Its GitHub connector verifies repository and workflow origin before signing uploaded workflow artifacts. The
certificate is issued to SignPath Foundation, every release request requires manual approval, and acceptance into the
program is an external gate rather than an entitlement.

NSIS packages add a structural constraint. Signing only the final setup leaves the installed application unsigned,
and the generated uninstaller does not exist as an ordinary build artifact after packaging. NSIS documents an
external-signing procedure that exports the generated uninstaller, signs it outside the compiler, and imports the
signed file during final compilation.

This decision selects the production Authenticode service and build topology. It does not activate signing before
SignPath accepts the project, authorize a release, change updater trust, or weaken exact Windows 11 admission.

## Decision drivers

- Keep the Authenticode private key in managed hardware-backed custody without exporting it to GitHub or a maintainer.
- Bind signed binaries to the public source revision and reviewed GitHub workflow.
- Avoid a physical-token or third-party-person dependency for every Windows release.
- Preserve trusted signatures on the setup, installed application, and installed uninstaller.
- Keep Authenticode, updater signing, release checksums, and publication as separate authorities.
- Remain economically viable for an early GPL open-source project.

## Considered alternatives

### Maintain a certificate bundle on a self-hosted Windows builder

This supports Tauri's synchronous signing command and can sign all NSIS stages, but it requires certificate purchase,
hardware-backed private-key custody, bespoke runner provisioning, and protected import and cleanup. It also provides
weaker public source-to-binary linkage than SignPath's GitHub origin verification.

### Attach a physical certificate token to release infrastructure

This preserves direct certificate ownership but makes unattended hosted builds impractical and ties release
availability to one physical device, its middleware, and an interactive custodian.

### Sign only the final NSIS setup through SignPath

This is operationally simple but fails the existing package contract: the main executable and generated uninstaller
would not independently identify their publisher after installation.

### Replace NSIS with MSI or MSIX

SignPath can deeply inspect and sign those composite formats. Replacing the accepted current-user NSIS package would,
however, change installation, removal, update recovery, user documentation, and already accepted native evidence.
The required NSIS external-signing sequence is available, so that broader packaging change is not justified.

## Decision

SignPath is the production Authenticode service for FitFreed Windows releases, using the certificate provided through
the SignPath Foundation open-source program.

- GitHub.com is the trusted build system. Every job contributing bytes to a signing request runs on a GitHub-hosted
  runner, and every input is uploaded as a GitHub workflow artifact before the pinned official SignPath action submits
  it.
- The release workflow first builds the unsigned application and exports the NSIS uninstaller through a versioned
  authority-free bridge connected to Tauri's standard uninstaller-signing hook. One exact archive containing only
  those two PE files is submitted to an artifact configuration
  that enforces their names, FitFreed product metadata, and common version.
- The returned archive is independently reopened. Both signed files must have the admitted certificate, RFC 3161
  timestamp, unchanged product identity, expected architecture where applicable, and exact requested version.
- Final NSIS compilation imports the signed application and signed uninstaller without rebuilding either. The exact
  resulting setup is uploaded and submitted through a second, setup-specific artifact configuration.
- The returned setup is independently inspected, installed, inventoried, and removed on the GitHub-hosted Windows
  builder before the native input can be sealed. The setup, installed application, and installed uninstaller must all
  match their pre-install digests and the same admitted certificate. The later complete candidate repeats native trust,
  installation, removal, and launch admission on the separate supported Windows 11 host.
- Each production SignPath request requires manual approval. The SignPath API token and organization identifier are
  protected environment inputs; stable project, policy, and artifact-configuration slugs are versioned workflow
  configuration and cannot be selected through dispatch.
- SignPath's certificate private key never enters GitHub. The former PFX import, certificate-store selector, local
  SignTool signing adapter, and self-hosted signing-builder requirement are removed from the production path.
- [ADR 0045](0045-separate-windows-native-and-updater-signing-authority.md) continues to govern the separation between
  Authenticode and updater authority. This decision supersedes [ADR 0046](0046-separate-windows-candidate-build-and-admission-hosts.md)
  because the signing build moves to GitHub-hosted Windows while exact candidate admission remains on a distinct,
  authority-free, disposable Windows 11 x86-64 host.

## Consequences

### Positive

- No exportable Authenticode private key, PFX password, certificate token, or SignTool selector is stored by the
  project or exposed to a runner.
- Signatures carry verifiable GitHub repository and build origin in addition to ordinary Authenticode trust.
- Hosted Windows construction can remain repeatable while consumer Windows 11 admission stays independent.
- All three executable trust surfaces retain the same strict signature contract.
- The selected OSS service does not impose per-release certificate or signing fees while the project qualifies.

### Negative

- The Windows publisher shown by the operating system is SignPath Foundation rather than FitFreed or the project
  owner.
- SignPath Foundation approval is external and may be delayed or refused.
- The circular NSIS uninstaller dependency requires two signing requests and a versioned packaging bridge.
- Every production request needs manual approval, so a Windows release requires at least two SignPath approvals before
  FitFreed's separate candidate and publication approvals.
- The existing Windows production workflow and PFX-oriented automation must be replaced rather than adapted in place.

### Risks and mitigations

- SignPath acceptance could be unavailable. Windows publication remains blocked without publishing an unsigned
  substitute; macOS and Linux support continue independently.
- A workflow could submit unrelated bytes. Origin verification, GitHub-hosted runner restrictions, exact artifact
  configurations, immutable action pins, protected identifiers, and independent digest inspection reject that path.
- The exported and imported uninstallers could differ. The inner signing archive, returned-file digests, standard
  NSIS signing hook, packaging bridge, installed layout inventory, and post-install comparison bind the same exact file
  across both stages.
- A signed setup could hide unsigned inner code. Exact clean installation and independent signature inspection remain
  release blockers.
- SignPath configuration could drift outside the repository. The workflow records only stable non-secret identifiers;
  focused preflight and one real signing request must prove the effective portal configuration before acceptance.

## Verification

Static contracts must reject automatic or untrusted triggers, self-hosted jobs leading to a SignPath request, mutable
actions, dispatch-selectable SignPath identifiers, missing manual approval, unexpected archive members, and any path
that can publish before admission. Package tests must prove deterministic external uninstaller export and import,
unchanged signed inner bytes, and exact final setup identity without product E2E repetition.

The integration becomes operational only when an approved SignPath project returns both signed artifacts and the
existing independent Windows inspector accepts the final setup, installed executable, and installed uninstaller on
the exact supported Windows 11 admission host.
