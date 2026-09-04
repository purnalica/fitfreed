# Windows Product-Owner Experience Supplement

## Status and boundary

This supplement defines only the Windows-specific entry and recording boundary for the canonical
[product-owner experience evaluation](macos-candidate-manual-evaluation.md). The canonical experience questions,
tasks, recording restrictions, and acceptance rule are not duplicated here. Functional conformance remains automated;
the product owner is not a manual QA operator.

The supplement applies only to the exact sealed complete-platform candidate after every automated macOS, Linux, and
Windows admission job has passed. It does not activate the workflow, authorize publication, or substitute a rebuilt
or instrumented application for the exact signed candidate.

## Windows entry conditions

Before the protected `public-windows-product-acceptance` gate is requested, automation must establish that:

- the candidate archive and manifest version 7 identity match the workflow's recorded digest, version, revision, and
  storage schema;
- the secret-free admission runner matches the reviewed Windows 11 x86-64 policy at candidate issuance;
- the exact setup and installed application pass Authenticode trust, current-user installation, cold launch, removal,
  and application-data preservation;
- the source-matched isolated instrumented package passes the exhaustive capability, localization, accessibility,
  update, recovery, filesystem, and performance campaign; and
- no unresolved critical or major machine-audit finding remains.

The production package intentionally contains no WebDriver instrumentation. Exact-package native evidence and the
source-matched automated behavior campaign must both pass and cannot substitute for one another.

## Product-owner handoff

Provide the installed exact candidate with no technical checklist or coaching beyond how to start it. Apply the five
canonical experience tasks and acceptance rule. A functional failure encountered incidentally is a test-gap defect:
record it once, stop the affected journey, and return the candidate to engineering without asking for repeated manual
reproduction.

Record only the candidate label, accepted or rejected product-experience outcome, and concise privacy-safe findings.
The environment approval records that verdict; it does not grant signing or publication authority. An independent
later `public-macos-release` approval remains the irreversible publication decision.
