# Public Release Operations

## Status and authority

This is the maintainer runbook for the initial FitFreed public macOS channel and each later complete-platform expansion. The workflows are implemented but deliberately inactive. One becomes operative only after the applicable readiness ledger records its production trust roots, native-platform evidence, predecessor dependency, and GitHub controls, and an accountable release owner authorizes one exact version, tag, and publication.

Normal commit and push authority does not authorize a tag, protected-environment approval, GitHub Release, Pages deployment, release withdrawal, credential change, or external incident communication.

The roles are capabilities, not named people:

- the **release owner** authorizes the version, exact tag, and public promotion;
- a **release builder reviewer** admits the protected build to production signing and notarization authority;
- a **candidate evaluator** completes the versioned manual procedure against the sealed bytes; and
- a **promotion reviewer** independently admits those exact accepted bytes to publication.

GitHub's `prevent_self_review` rule ensures that the workflow initiator cannot approve either protected job. One person may hold more than one maintainer role only when the recorded review still satisfies the project's independent-evaluation requirement.

## Trust and credential inventory

The `public-macos-release` environment owns only the protected inputs listed in the [public release guide](public-release.md). Maintainers record custody, creation, expiry, revocation, and recovery contacts outside the repository without recording secret values in project documentation, issues, Actions artifacts, or logs.

Apply these boundaries:

- Export the Developer ID Application identity as the minimum password-protected certificate bundle needed by the runner. Keep the long-lived source copy outside GitHub and test its recovery procedure independently.
- Scope the App Store Connect API key to notarization work. Never use a personal Apple ID password in the workflow.
- Generate the updater key independently of the Apple identity. Store its private key and password separately where practical; commit only an explicitly reviewed public key and identifier.
- Generate the platform-neutral release-checksum key independently of the updater and Apple identities. It first enters
  the Linux expansion as `FITFREED_RELEASE_PRIVATE_KEY` with
  `FITFREED_RELEASE_PRIVATE_KEY_PASSWORD`; only its reviewed public key and identifier belong in the repository.
- Give `FITFREED_GITHUB_ADMIN_READ_TOKEN` only repository Administration read access. The workflow's short-lived `GITHUB_TOKEN` owns publication writes.
- Never place authority in repository secrets when the protected environment can own it, and never expose a private input to preflight, promotion, Pages, remote verification, caches, or retained artifacts.
- Review access after a maintainer change, suspected compromise, Apple or GitHub policy change, and every planned key rotation.

The ephemeral authority installer writes private material only under the hosted runner's temporary directory with private permissions, imports the exact certificate fingerprint into a temporary keychain, and restores the prior keychain state in an unconditional cleanup step. A cleanup failure blocks acceptance and requires inspection of the affected ephemeral runner execution; it never justifies printing a secret.

## One-time GitHub configuration

An accountable maintainer configures these prerequisites before the first release dispatch:

1. Make `release/public-update-channel.json` active with the reviewed public updater key and keep the metadata endpoint derived from `release/public-origin.json`: `https://fitfreed.org/updates/stable.json`.
2. Enable immutable Releases for the repository.
3. Verify `fitfreed.org` for the `purnalica` organization, configure it as the Actions-backed Pages custom domain with the documented apex and `www` DNS records, and enforce HTTPS.
4. Create `public-macos-release` with at least one required reviewer, prevent self-review, disable administrator bypass, and admit only tags matching the single `v*` tag policy.
5. Add the exact protected secrets and non-secret variables documented in [public release preparation](public-release.md).
6. Confirm private vulnerability reporting, Issues, and the documented support routes are available.

Do not infer successful configuration from a workflow file or environment name. The secret-free preflight reads the GitHub APIs and rejects a missing or weaker control before the first protected job starts.

## Prepare the versioned source

Before creating a release tag:

1. Complete the version's product, compatibility, migration, localization, documentation, release-note, and public-policy changes.
2. Keep `release/notes/<version>.md` distribution-neutral. Generated private and public preambles own signing, notarization, and channel state.
3. Give the public release policy a sequence greater than every previously accepted stable-channel sequence. Never reuse a sequence for different bytes or policy.
4. Declare every supported prior application baseline and library schema in `release/upgrade-matrix.json` from direct evidence.
5. Run the complete local gates and wait for successful `push` runs of both `ci.yml` and `repository-safety.yml` on the exact source revision.
6. Create and push the exact `v<version>` tag only with separate authorization and public-safe Git metadata. Do not move or reuse a published release tag.

The workflow must be dispatched while the selected GitHub ref is that tag. The initial macOS workflow inputs are only
the semantic version and active public updater-key identifier. A complete-platform expansion additionally supplies the
active public release-checksum key identifier; private key material is never a dispatch input.

### Complete-platform expansion input

Do not dispatch `.github/workflows/public-linux-expansion.yml` until the preceding macOS GitHub Release is public and
immutable and the next version has been assigned. The target-aware upgrade matrix must identify that exact baseline
with `darwin-aarch64`; secret-free preflight queries the corresponding GitHub Release and rejects an absent, draft,
prerelease, mutable, or differently tagged record. The same preflight requires active recoverable `stable-v3` updater
trust and active platform-neutral release-checksum trust containing the two selected public key identifiers.

`build-linux-input` runs outside every protected environment on Ubuntu 24.04. It audits dependencies, builds the exact
Debian package with the active public `stable-v3` endpoint and updater trust embedded, creates its complete inventory
and source/schema-bound build evidence, verifies clean-container installation and removal, and permits no other output.
This job receives no updater private key or password and produces no updater signature. It then seals those three files
into `linux-input.tar.gz`, records the archive SHA-256 as a job output, and uploads only that archive for one day. A
successful job means “native input available for composition,” not “Linux candidate signed, accepted, or published.”

The first protected approval admits the Apple Silicon composer. Before installing authority, it downloads only the
same run's named Linux input, verifies the job-bound archive digest, rejects unsafe or additional entries, and reopens
the package, inventory, version, source revision, and storage schema. It then receives distinct Apple, updater, and
release-checksum authority, builds fresh same-version macOS artifacts, signs the exact Linux package, and creates one
manifest version 6 candidate. The complete Release set and the complete stable-v3 Pages set must both contain macOS
and Linux; no per-platform partial snapshot is promotable.

The resulting `public-macos-linux-candidate-<version>-<revision>` archive follows the same independent second-approval,
exact reopening, attestation, immutable Release, Release-before-Pages, and remote-acceptance rules as the initial
macOS candidate. Provenance verification requires the expansion workflow for manifest version 6 and the initial
workflow for manifest version 3; evidence from one cannot satisfy the other.

Before the second approval becomes reachable, `admit-linux-candidate` runs the exact sealed archive on the hosted
x86-64 `ubuntu-24.04` and `ubuntu-26.04` matrix. Both rows use the generic manifest version 6 verifier and install only
its returned Debian path. A passing row requires package-manager identity, installed executable and resources, complete
dynamic linking, graphical first launch into an isolated private library, the production cold-launch budget, package
purge, and retained-library integrity. Neither row receives a protected environment, secret, signing key, nor
publication permission. The unconditional package finalizer is cleanup, not acceptance evidence; a failed preceding
check keeps promotion blocked even when cleanup succeeds.

## Build approval and sealed candidate

The first protected approval admits `build-candidate` to the Apple, updater, and limited administrative read authority. The job repeats preflight, verifies immutable-release configuration, creates an ephemeral keychain, builds and notarizes the application, staples and inspects the application and DMG, generates the update snapshot and evidence, and verifies the complete candidate.

It then creates `candidate.tar.gz`, records its SHA-256 digest as a job output, uploads one Actions artifact named `public-macos-candidate-<version>-<revision>`, and removes all release authority. The artifact contains only the public-shaped `release/` and `pages/` trees. It is retained for seven days and is not a GitHub Release or update-channel deployment.

The build job has read-only repository permission and cannot publish a Release or Pages snapshot. A successful build therefore means “candidate available for evaluation,” not “release accepted.”

## Exact-candidate evaluation

While `publish-candidate` waits at the second `public-macos-release` environment gate:

1. Download the candidate artifact from that exact workflow run.
2. Confirm its name, version, source revision, and recorded transport digest.
3. From the exact tagged source, run `npm run unpack:public-release -- <archive> <sha256> <candidate-directory>`. This validates the transport digest, rejects unsafe archive entries, extracts into a new isolated directory, and reopens the complete candidate. A separate `npm run verify:public-release -- <candidate-directory>` may repeat the evidence check but cannot replace the digest-bound extraction.
4. After the candidate's automated functional, installation, update, recovery, accessibility, and performance evidence passes, perform the public profile of the bounded [product-owner experience evaluation](../testing/macos-candidate-manual-evaluation.md) against the DMG and application inside that sealed candidate.
5. Record only the privacy-safe experience result defined by the procedure and dispose every serious finding before promotion.
6. Confirm that the signed stable envelope is still within its seven-day validity window.

Do not approve promotion when the artifact is unavailable, its digest or evidence fails, evaluation used different bytes, an applicable scenario is blocked, a serious finding remains open, or channel metadata has expired. Cancel the waiting run and prepare a fresh candidate after correcting the cause. Never edit, replace, re-sign, or repackage the sealed candidate.

## Promotion and remote acceptance

The second environment approval is the irreversible publication decision for the evaluated candidate. `publish-candidate` receives no Apple or updater secret. It downloads only the sealed artifact from the same run, verifies its transport digest, extracts it, and reopens the entire candidate before gaining any public effect.

Promotion then:

1. creates source-bound GitHub build-provenance attestations for every regular release asset, `SHA256SUMS`, and the detached platform-expansion checksum signature;
2. uploads the complete localized product-and-update Pages snapshot as a still-private deployment artifact;
3. creates or validates an exact GitHub draft without replacing an asset;
4. verifies tag, title, notes, names, sizes, digests, provenance, and source identity;
5. publishes the draft and requires GitHub to report the Release as immutable;
6. deploys the already uploaded Pages artifact only after immutable Release publication; and
7. downloads and re-verifies the public Release, release-linked assets, source-bound provenance, every exact product-site object, the direct non-redirecting stable envelope, and all required current and recovery updater bytes.

The run is accepted only when `verify-publication` succeeds. Record the immutable workflow URL, version, source revision, Release URL, Pages deployment, product-experience result, and final readiness decision. Never record tokens, private identities, local paths, participant data, or raw notarization credentials.

## Failure and restart matrix

| Failure boundary | Public effect | Safe continuation |
|---|---|---|
| Preflight | None | Correct the versioned source or external prerequisite, obtain any required authority, and dispatch again from the exact tag. |
| Protected build or notarization | None | Inspect privacy-safe diagnostics. Cleanup runs unconditionally. Correct the root cause and create a fresh candidate. |
| Candidate packing or retained-artifact upload | None | Do not evaluate partial local output. Correct the cause and rerun the build. |
| Ubuntu 24.04 or 26.04 exact-candidate admission | None | Preserve the sealed candidate and privacy-safe job diagnostics, let unconditional package cleanup finish, diagnose the failed distribution, package, launch, library, removal, or performance boundary, and create a new candidate only when bytes must change. Never bypass the failed matrix row. |
| Manual evaluation or metadata validity | None | Reject or cancel promotion. Fix the cause and produce a new sealed candidate; do not alter accepted evidence. |
| Candidate download, transport digest, or reopening in promotion | None | Reject the run. Never bypass transport or manifest verification. |
| Draft creation or asset upload | A mutable draft may exist; no public Release or Pages change is accepted | Inspect the draft against the exact manifest. A partial or divergent draft requires explicit authority to delete that unpublished draft before a fresh run; never use `--clobber`. |
| Attestation or draft validation | No accepted public Release; Pages is unchanged | Keep the draft unpublished. Diagnose the source, permission, or GitHub failure. Delete a divergent draft only with explicit authority, then create a fresh candidate. |
| Immutable Release publication succeeds but Pages deployment fails | The download and evidence record is public; installed applications still see the previous complete Pages snapshot | Re-run only the failed Pages and downstream verification jobs from the same workflow run while its exact artifact is retained. Do not rebuild or replace immutable Release assets. |
| Pages deploys but remote verification has not converged | Release and new snapshot may be public, but acceptance is open | Re-run only remote verification after diagnosing service state. Bounded propagation delay is acceptable; mismatched bytes are not. |
| Remote verification finds stable bytes different from the immutable Release | Release and update channel disagree | Stop promotion claims and incident-triage immediately. Preserve evidence. Restore a known deployment only as temporary containment and issue a new higher-sequence corrective release for durable recovery. |

Re-running the entire workflow after immutable publication is not a recovery strategy: Apple timestamps and notarization can make a rebuilt candidate byte-distinct even from the same source. Recovery uses the sealed artifact retained by the original run and re-runs only failed downstream jobs.

## Pages containment and rollback

GitHub Pages deployment history can temporarily restore the last known complete snapshot when a new deployment is unavailable or objectively wrong. This is containment, not a durable rollback of authenticated update policy.

An installed application can persist a higher accepted sequence. Re-serving an older signed envelope cannot make that client forget the high-water mark and may be rejected as replay. After any new sequence was externally observable, durable recovery requires a new reviewed release policy with a greater sequence and a freshly signed stable snapshot. Never edit `stable.json` manually or republish a prior sequence with different content.

If a Release exists but its Pages deployment never became observable, re-run the original run's failed Pages job. If an incorrect snapshot became observable, preserve it as incident evidence, contain it only under accountable authority, and prepare a new corrective release.

## Withdrawal and corrective release

Immutable Releases and their tags remain evidence and are not rewritten. To withdraw a defective installed version:

1. assess affected versions, reason category, safe user action, and whether a replacement is ready;
2. create a new semantic version and a release policy with a strictly greater sequence;
3. add the affected version to `withdrawnVersions` with complete `en-US` and `es-ES` guidance and an optional replacement version;
4. update the compatibility matrix and release notes from tested evidence;
5. execute the complete build, exact-candidate evaluation, promotion, and remote-verification path; and
6. communicate through the immutable corrective Release, signed channel guidance, support route, and a security advisory when confidentiality or coordinated disclosure requires it.

A withdrawn candidate is never offered for installation. An already installed withdrawn version displays persistent authenticated guidance. Do not use deletion of a Release, tag movement, a lower channel sequence, or an unsigned metadata edit as withdrawal.

## Key rotation and compromise

Routine updater-key rotation overlaps trust: release at least one accepted application embedding both old and new public keys before signing a later channel statement with only the new key. Remove the old public key only after every supported upgrade baseline can authenticate the new authority.

If an updater private key may be compromised, stop protected runs, revoke its environment access, preserve audit evidence, and determine which application baselines trust only that key. Clients without a previously embedded recovery key cannot authenticate an automatic trust-root replacement; publish a Developer ID-signed corrective application through the verified download channel with explicit manual-install guidance.

For a Developer ID or App Store Connect compromise, revoke or rotate the affected Apple authority, review notarization history, remove its GitHub access, and create a fresh candidate under the replacement identity. Apple trust rotation does not replace updater-key rotation, and updater trust does not compensate for invalid Apple code signing.

For a GitHub token or environment compromise, revoke access immediately, audit deployments, releases, attestations, environment reviews, and tag state, and keep publication blocked until repository controls are re-established. Immutable evidence that cannot be reconciled with the incident remains unaccepted even if its bytes appear functional.

## Incident communication and closure

Security-sensitive reports begin in [GitHub private vulnerability reporting](https://github.com/purnalica/fitfreed/security/advisories/new). Public issues are suitable only after sanitization and any coordinated disclosure decision. Communication states affected versions, observed impact, safe action, replacement status, and the evidence users can verify; it never requests personal exports or libraries.

An incident closes only after the authoritative release and channel state are consistent, remote verification passes, affected users have actionable guidance, credentials and access have been reviewed, and the root cause plus prevention are documented in the appropriate architecture, operation, or security source. A restored Pages deployment or green rerun alone is not closure.
