# ADR 0011: Schedule update discovery in the desktop host

- **Status:** Accepted
- **Date:** 2026-08-17
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Update trust](../update-trust.md)

## Context

FitFreed already performs one scheduled-policy update check after locale initialization and offers an explicit manual check. A person can keep the desktop application open for days, so startup checks alone do not satisfy the requirement to discover releases periodically. The recurring mechanism must preserve offline use, avoid repeated intrusive errors, and keep timing, channel access, trust policy, and native update coordination outside the web presentation.

The accepted replay, dismissal, and postponement state is durable. The timing of the next network attempt is operational process state rather than release trust state: every new process already performs a launch check, and a stopped process cannot discover an update.

## Decision drivers

- A long-running desktop process must discover a stable release without user action.
- React must not own a security-relevant background task or channel invocation cadence.
- Startup, manual, periodic, preference, and installation operations must not issue overlapping update-channel requests or race persisted update state.
- Offline, current, dismissed, postponed, and unconfigured scheduled results must remain quiet.
- Suspending the computer or delaying one check must not cause a burst of catch-up requests.
- The ordinary unconfigured build must continue to make no update-network request.

## Considered alternatives

### Schedule from React

A component timer could call the existing command and reuse presentation state directly. It would make a mounted view responsible for application lifecycle policy, permit reloads and remounts to alter cadence, and couple background work to presentation availability. It would also leave native operation coordination split across the web and host boundaries.

### Persist the next due time in the SQLite library

A durable deadline could suppress checks after frequent restarts and coordinate multiple processes. FitFreed currently supports one application process and deliberately checks at every ready startup. Persisting an additional clock value would require a schema and clock-anomaly policy without improving discovery while the process is stopped.

### Schedule from the desktop host for the lifetime of the process

The host already owns the trusted channel adapter, installed version, library path, locale lookup, clock, and update commands. A host task can wait independently of React, serialize update operations, emit only the existing closed outcome DTO, and disappear with the process.

## Decision

FitFreed will schedule recurring update discovery in the desktop host.

- The scheduler starts during desktop setup and waits 24 hours before its first recurring check. The existing ready-startup check remains the immediate check for each process lifetime.
- Each completed recurring check starts the next 24-hour interval. Missed ticks are skipped after suspension or an overlong task; they are not replayed as a burst.
- One host-owned asynchronous coordinator serializes launch, manual, dismissal, postponement, and installation operations. A periodic tick never waits behind an active update operation; it is skipped and the next ordinary interval remains eligible.
- The host supplies the scheduled trigger, current time, installed version, library schema, persisted locale, and channel. React cannot submit or change those values.
- A successful periodic evaluation emits the existing privacy-minimized update outcome through one namespaced desktop event. React applies the same scheduled visibility policy already used for launch outcomes.
- Infrastructure or command-boundary failure during a periodic attempt is not emitted as an intrusive presentation error. Authenticated policy outcomes such as rejected trust or a withdrawn installed release still cross the event boundary and remain attention states.
- No last-check timestamp or next-due deadline is persisted. Restarting resets the 24-hour process timer and the ready-startup check supplies fresh discovery.
- An unconfigured channel continues to return locally without network access. The scheduler does not introduce telemetry, request parameters, cookies, or a background service outside the application process.

## Consequences

### Positive

- Long-running application sessions receive update discovery without presentation-owned timing.
- All update operations share one host coordination boundary.
- Sleep, wake, and long checks cannot create request bursts.
- No persistence migration or additional personal or operational history is introduced.

### Negative

- Frequent application restarts can perform more than one check within 24 hours because startup checks remain immediate.
- A periodic tick that coincides with an active update operation waits until the following interval rather than retrying immediately.
- The process-lifetime schedule does not discover releases while FitFreed is closed.

### Risks and mitigations

- A presentation listener could register after a host event. The first recurring event cannot occur until 24 hours after setup, while the listener registers during ordinary React startup; launch discovery remains command-response based.
- A stale recurring response could replace a newer manual result. Presentation request sequencing advances when either source completes, and the host coordinator prevents concurrent update operations.
- A future multi-process application could duplicate checks. FitFreed currently supports one desktop process; multi-process coordination would require a separate accepted design before that scope is introduced.

## Verification

Host tests must prove there is no immediate recurring tick, the first tick occurs at exactly 24 hours, later intervals repeat, and an occupied coordinator skips rather than queues a periodic operation. Presentation tests must prove that a periodic authenticated release becomes visible, quiet scheduled outcomes stay hidden, and the existing manual result cannot be overwritten by an older source. The full Rust, React, contract, packaged desktop, and hosted CI lanes remain required.
