# UI and UX Redesign Plan

## Status

Active. The redesign is the next MVP quality intervention before production trust activation or public-candidate preparation.

## Objective

Make FitFreed immediately useful as a personal history explorer. A person should understand within seconds that the application turns an owned fitness export into questions, comparisons, and trustworthy discoveries that remain under their control.

Import, coverage, storage, updates, and provider compatibility remain necessary capabilities, but they must not dominate the ordinary experience. The primary interface begins with the person's history and the questions it can answer.

## Product questions

The redesign must help a person ask and answer at least these classes of question:

1. What does my history contain, over what period, and where are its gaps?
2. What changed recently compared with an earlier period?
3. When was I more active or consistent, and what exact records support that view?
4. How did training, activity, sleep, and recovery measurements coincide over time?
5. What happened on one date, session, or night?
6. How do two periods differ, including measurement coverage and missing data?
7. What can FitFreed not conclude from the available information?

The interface distinguishes recorded facts, calculated comparisons, observed co-occurrence, source-specific assessments, and unavailable conclusions. It does not present correlation as causation, invent a readiness score, provide medical interpretation, or disguise missing data as zero.

## First-run promise

The initial experience has very little time to establish relevance and trust. It must:

- communicate the concrete outcome before explaining the import mechanism;
- show representative questions and visual value without pretending that synthetic examples belong to the person;
- make the first action unambiguous;
- explain local processing and the absence of an account without a legal or technical wall of text;
- set honest expectations about supported information and processing time; and
- turn successful import into a personal reveal rather than an ingestion report.

Evaluation will use three bounded comprehension targets:

- after a five-second view, the person can identify the promised outcome;
- within thirty seconds, a first-time user can identify the first action, the local-data boundary, and examples of questions the application will answer; and
- after import, the first viewport exposes the history period, its useful coverage, at least one supported comparison or observation, and direct paths into exploration.

## Design work

1. Audit the current packaged experience and trace every visible capability to its application read model and persistence support.
2. Study comparable fitness, personal-analytics, and data-exploration products, including both praised patterns and recurring user frustration.
3. Define the information architecture, question model, visual language, disclosure hierarchy, and first-run narrative.
4. Produce multiple high-fidelity interactive directions covering first run, import, populated home, question-led exploration, detail, comparison, gaps, and failure.
5. Review each direction at realistic macOS sizes, 200% text, reduced motion, light and dark appearance, and both initial locales using independently constructed synthetic data.
6. Select and document one direction before changing production presentation code.
7. Derive the implementation sequence from verified lower-layer support, adding or changing application contracts before any dependent production UI.

## Design thesis under evaluation

The primary candidate is a question-first desktop workspace with an editorial, non-judgmental visual language. It is not yet an accepted production direction.

- The default view offers one bounded observation or comparison before presenting supporting metrics.
- A structured question catalogue expresses user intent without implying unsupported natural-language or artificial-intelligence capabilities.
- Every calculated statement provides a direct route to its dates and source-derived records.
- Domain-specific coverage and limitations accompany the conclusion they affect; FitFreed does not collapse unrelated coverage into a single score.
- Provider import, schema coverage, reimport, and local-library controls remain fully inspectable in a secondary data-library surface.
- The first-run experience demonstrates the answer structure with explicitly illustrative data, then offers local archive processing as the primary action.
- The interface remains warm without grading, coaching, diagnosing, or inferring causation.

An alternative chronological direction is also being evaluated for its stronger emotional connection to long personal histories. It is not the leading default because it makes analytical controls less direct and requires full-history aggregates beyond the existing bounded insight queries. Its strongest narrative qualities may be incorporated into the question-first workspace without adopting it as the application structure.

The current application contracts already support the principal training comparison, training-day counts, aligned multi-domain days, domain-specific availability, and date-level inspection used in the leading prototype. Production implementation still requires an application-level home and question-catalogue contract; the presentation layer must not assemble a new business read model from unrelated commands.

## Working-material policy

Exploratory screenshots, external visual references, discarded directions, and temporary prototypes remain under the ignored local research area. Only the accepted direction, original project-owned assets, durable rationale, and implementation-facing specifications enter the repository.

## Acceptance boundary

A visually attractive dashboard is not sufficient. The accepted direction must make consultation and discovery easier than the current document-like sequence, preserve exact accessible alternatives, expose uncertainty and coverage, work without an account or network connection, and remain feasible through the Clean Architecture and DDD boundaries.
