# Windows Product-Owner Experience Supplement

## Status and boundary

This supplement defines only the Windows-specific entry and recording boundary for the canonical
[product-owner experience evaluation](macos-candidate-manual-evaluation.md). The canonical experience questions,
tasks, recording restrictions, and acceptance rule are not duplicated here. Functional conformance remains automated;
the product owner is not a manual QA operator.

The supplement applies only to the exact sealed complete-platform candidate after every automated macOS, Linux, and
Windows admission job has passed. It does not activate the workflow, authorize publication, or substitute a rebuilt
or instrumented application for the exact candidate.

## Windows entry conditions

Before the protected publication gate is requested, automation must establish that:

- the candidate archive and manifest version 8 identity match the workflow's recorded digest, version, revision, and
  storage schema;
- the GitHub-hosted `windows-2025` runner installs, cold-launches, removes, and preserves application data for the
  exact setup while explicitly recording that this does not establish exact Windows 11 client admission;
- the setup, manifest, and public guidance consistently declare the absent Authenticode publisher identity; and
- the accepted source-matched product evidence remains applicable because the executable behavior did not change.

The production package intentionally contains no WebDriver instrumentation. Exact-package native evidence and the
accepted source-matched automated behavior evidence have different purposes and cannot substitute for one another.

## Product-owner handoff

The Windows preview changes distribution trust and package availability, not the accepted application experience. It
therefore does not require a second product-owner evaluation. A future Windows-specific product change reopens the
canonical five experience tasks; a functional failure encountered incidentally remains a test-gap defect and must not
be turned into repeated manual QA.

The later `public-macos-release` approval remains the irreversible publication decision. It approves only the exact
candidate after all native admission jobs pass and does not reinterpret hosted Windows evidence as exact Windows 11,
Smart App Control, enterprise-policy, or Authenticode compatibility.
