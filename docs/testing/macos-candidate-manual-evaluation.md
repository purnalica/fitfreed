# macOS Product-Owner Experience Evaluation

## Status and boundary

This is the canonical human product-owner gate for the FitFreed macOS experience. It is deliberately short and
subjective. Its purpose is to decide whether the product is understandable, trustworthy, useful, natural to
navigate, and worth using again.

Functional correctness belongs to automated unit, integration, contract, packaged end-to-end (E2E), restart,
installation, update, recovery, accessibility, and performance verification. The product owner is not a manual QA
operator and is not asked to execute a control matrix, prove persistence, exercise validation branches, collect
timings, reproduce defects, or certify technical conformance.

A functional failure encountered incidentally during this review is a test-gap defect. Record it once, stop the
affected journey, diagnose it outside the review, add automated regression evidence, and provide a corrected native
build. Do not ask the product owner to characterize or repeatedly reproduce it.

## X6 product-experience profile

An X6 review is eligible only after the exact clean source has passed the complete local verification lane, native
bundle inspection, repository-safety workflow, and hosted continuous-integration campaign. Build and inspect the
revision-isolated native review application with:

```sh
npm run build:x6-review
npm run check:x6-review-bundle
```

The resulting application must have its own revision-derived application-data location and must contain no E2E
feature, frontend test routing, WebDriver capability, dialog mock, opener mock, or database-path override. Archive
selection and external links therefore use the production native adapters. Never hand the product owner an E2E
build.

The native application is launched only when the product owner chooses to begin the review. It may use independently
generated synthetic packages or an explicitly authorized personal export. A personal export never changes the
privacy-safe recording boundary below.

## Exact-candidate profile

The same bounded experience review may be repeated against an exact private or public macOS candidate after all
applicable automated candidate gates pass. The evaluated bytes and trust behavior must match the selected
[private alpha candidate guide](../user/private-alpha-candidate.md) or
[public macOS guide](../user/public-macos-0.1.0.md). A public candidate must be the sealed Actions artifact awaiting
promotion.

This review does not prove signing, notarization, Gatekeeper, installation, update, recovery, data preservation,
keyboard mechanics, or assistive-technology conformance. Those remain automated release evidence or, where
automation cannot establish a subjective accessibility property responsibly, a separately scheduled specialist
evaluation. They are never implicit product-owner work.

## Product-owner experience review

The review is one short, uncoached exploration rather than an exhaustive script. The product owner may follow the
journeys that best expose value and may stop as soon as a material problem invalidates the experience. The useful
questions are what the person understood, expected, trusted, found valuable, found confusing, or wanted to do next.

## Experience tasks

1. Start without coaching. Judge whether the first screen explains what FitFreed is, why it is useful, what remains
   local, and how to begin without sounding promotional or making unsupported promises.
2. Use a recognizable library to answer one personally relevant question. Judge whether Home reveals useful facts
   and creates a natural path into evidence instead of exposing a wall of data.
3. Inspect one training session and, when route data exists, its route, ranges, signals, structure, and exact detail.
   Judge whether progressive disclosure preserves both clarity and analytical depth.
4. Find or create one relevant report, inspect its result, and locate its local export. Judge whether reports have a
   clear identity and whether data freedom is visible without turning the product into an editor by default.
5. Move between Home, History, Reports, Sources, Settings, and one deep detail. Judge navigation, return paths,
   status feedback, information density, typography, alignment, localization, and overall visual quality.

These are prompts for experience judgment, not proof that every named control works. Automation must have exercised
the complete functional journeys before handoff.

## Recording boundary

Record only:

- the source-revision or candidate label;
- accepted or rejected product-experience outcome; and
- concise privacy-safe findings needed to explain that outcome.

Do not ask for a completed control checklist, technical diagnosis, reproduction recipe, hardware inventory, timing
sheet, screenshots of personal history, or raw logs. Never record names, account claims, archive or library names,
filesystem paths, dates, fitness or health values, routes, identifiers, package fingerprints, private endpoints, or
database contents. The product owner owns any real export and may stop the review at any time.

## Acceptance rule

Accept the experience only when the product communicates its purpose and privacy boundary honestly, exposes useful
answers quickly, retains credible analytical depth, makes navigation and long operations understandable, presents
data with exceptional care, and gives the user visible control over data and exit paths.

Any critical or major experience finding reopens its owning redesign increment. A passing experience review does not
make a release candidate technically acceptable and cannot override failed or missing automation, specialist
accessibility evidence, distribution authority, or public-release approval.
