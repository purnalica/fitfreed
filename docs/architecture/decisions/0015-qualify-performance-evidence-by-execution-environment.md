# ADR 0015: Qualify performance evidence by execution environment

- **Status:** Accepted
- **Date:** 2026-08-17
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Quality targets](../../quality-targets.md), [performance benchmarks](../../development/performance-benchmarks.md)

## Context

The initial quality model made an Apple Silicon Mac with 8 GB of memory a mandatory performance reference profile. No such machine is available to the project and obtaining one is not a viable release activity. Keeping that profile as an acceptance gate would make the private alpha permanently unverifiable. Simulating the profile by limiting a materially different workstation or using a virtual machine would not reproduce its processor, storage, memory pressure, operating-system scheduling, or WebView behavior and would create false evidence.

FitFreed still needs enforceable performance budgets, reproducible regression detection, bounded memory use, and an honest statement of the environments on which a candidate has been exercised.

## Decision drivers

- Keep every existing latency, throughput, cancellation, and memory budget enforceable.
- Base acceptance on environments the project can actually execute and reproduce.
- Avoid claiming universal device performance from one hardware configuration.
- Keep exact workstation details private while preserving auditable aggregate evidence.
- Separate functional platform support from observed performance.

## Considered alternatives

### Retain the unavailable 8 GB acceptance machine

This provides a concrete hardware floor but makes acceptance impossible and leaves the project dependent on equipment outside its control.

### Emulate an 8 GB machine

A virtual machine or process memory limit can test specific resource behavior, but it cannot establish physical-device launch, rendering, storage, or memory-pressure performance. Treating it as equivalent would misrepresent the evidence.

### Qualify performance evidence by reproducible execution environment

The unchanged product budgets can run on every available local and hosted macOS environment. Each result is valid for its recorded environment, while cross-run regressions remain enforceable through source-bound commands and stable hosted automation. Peak application memory remains an independent hard budget.

## Decision

FitFreed will qualify performance evidence by the environment that produced it instead of requiring one fixed memory-size reference machine.

- Apple Silicon and the separately selected minimum macOS version define the private-alpha functional support boundary.
- The versioned latency, throughput, cancellation, and memory budgets remain unchanged.
- Executable changes must pass the complete hosted macOS performance campaign. A clean local production campaign complements hosted evidence before candidate handoff.
- Versioned evidence records privacy-safe aggregate results and identifies the environment only as hosted macOS or local Apple Silicon. Exact host details remain local or provider-controlled.
- A passing result proves the candidate on that execution environment. It does not promise identical performance on every supported Mac.
- Peak application memory below 1.5 GB in the full-scale synthetic import remains a release gate independent of installed system memory.
- Material regressions on either maintained environment block acceptance until explained and resolved. A retry does not convert a failure into a pass.

## Consequences

### Positive

- Every acceptance gate is executable with infrastructure available to the project.
- Existing budgets remain objective and automated.
- Candidate documentation can distinguish verified configurations from the broader functional support boundary.
- The project does not publish fabricated minimum-hardware evidence.

### Negative

- The private alpha provides no device-wide latency guarantee based on installed memory.
- Performance on an untested supported Mac may differ from the recorded environments.
- Hosted-runner changes require a new baseline review before their results can be compared historically.

### Risks and mitigations

- A high-capacity machine could hide excessive application memory. The independent 1.5 GB peak-resident-memory gate and large synthetic import prevent that failure from being accepted.
- Hosted infrastructure can change without source changes. Evidence remains source- and environment-qualified, and discontinuities trigger a baseline investigation rather than silent comparison.
- Functional support could be mistaken for a performance guarantee. User and release documentation must list verified environments and state the boundary explicitly.

## Verification

The cold-launch, full-scale import, read-model, packaged-WebView, installation, and update campaigns retain their existing commands, scales, percentile estimators, and budgets. The complete hosted campaign must pass for executable or release-input changes, and a clean local campaign must pass for the exact handoff candidate. Repository checks prevent an unavailable fixed-memory profile from reappearing as a release gate.
