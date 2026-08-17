# Security Policy

## Supported versions

FitFreed has no released or supported version yet. The first public version's support and upgrade policy is prepared but remains inactive until every gate in the [public-release readiness ledger](docs/testing/public-release-readiness.md) closes.

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public issue, discussion, pull request, or social channel.

Report it confidentially through [GitHub private vulnerability reporting](https://github.com/purnalica/fitfreed/security/advisories/new). This is the canonical reporting route for the public repository.

Include only the minimum information required to reproduce and assess the problem:

- Affected component and version or revision.
- Preconditions and expected security boundary.
- Reproduction steps using synthetic data.
- Observed impact.
- Any known workaround.

Never submit a real provider export, user library, route, access token, signing material, crash dump, screenshot, or log containing personal data. If sensitive evidence is essential, first request an approved transfer method through the confidential reporting channel.

## Security-sensitive areas

Particular attention is given to:

- Malicious or defective ZIP and JSON input.
- Path traversal, decompression bombs, uncontrolled resource consumption, and parser abuse.
- Personal-data disclosure through logs, diagnostics, screenshots, exports, backups, or update services.
- Import reconciliation, database integrity, migration, backup, and recovery.
- Installer, updater, signature, release, and supply-chain integrity.
- Dependency vulnerabilities and license provenance.

## Disclosure process

Maintainers will acknowledge receipt through the confidential channel, investigate the root cause and affected versions, coordinate a correction and disclosure plan, and credit reporters who request attribution. Concrete response-time commitments will be introduced only when the project has the maintainer capacity to meet them reliably.
