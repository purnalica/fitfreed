# MVP Experience Specification

## Status and authority

**X3 review candidate as of 2026-08-21.** This document is the single source of truth for the
proposed screen, interaction, navigation, state, responsive, localization, and accessibility
contract of the systemic MVP experience redesign. It does not describe the current production
presentation and does not authorize claims that missing application contracts already exist.

The [requirements](../requirements.md#product-experience-contract) own normative product behavior.
The [redesign plan](../plans/ui-redesign.md) owns rationale, journeys, feasibility analysis, and
delivery gates. This specification makes the accepted X2 direction concrete for X3 review without
repeating either source. Production migration begins only after the X3 human gate accepts or amends
this candidate.

## Stable workspace

FitFreed uses one persistent desktop shell around five workspaces:

| Workspace | Primary outcome | Default entry |
|---|---|---|
| Home | Recognize the library and find one worthwhile next step | Populated orientation or an honest historical fallback |
| History | Find and understand sports and sessions | Results first, refinements second |
| Reports | Read and reuse deliberately authored analytical documents | Result library, never a generic editor |
| Sources | Obtain, import, and account for provider archives | Source status and the next relevant action |
| Settings | Control lasting application behavior | Language, appearance, and content zoom |

The rail remains visible during ordinary browsing, reading, and focused detail. A compact shell
keeps an icon and a text label for every workspace; icon-only primary navigation is not acceptable.
The current workspace has semantic and visual indication independent of color. Settings is a stable
rail destination; a contextual Settings shortcut may also appear in the wide workspace header but
must not compete with content in compact layouts.

**History Desk** is the stable architecture. **Answer Canvas** is a bounded result composition used
for a supported Home observation, a comparison, or a report result. It never replaces the shell or
hides the recognizable sports history.

## Presentation grammar

Every answer-bearing screen applies the disclosure order defined by the redesign plan:

1. a recognizable fact, result, or consequence;
2. a visual explanation that makes the relationship intelligible;
3. the minimum evidence needed to trust it;
4. a small set of relevant next questions; and
5. exact detail, provenance, diagnostics, or editing on deliberate request.

The default view must not become a numeric inventory. Dates, durations, quantities, and precision
use the person's locale and a human scale. Exact source values remain reachable. Sport identity uses
text plus a coherent provider-neutral family icon across every surface; placeholder glyphs and color
alone are not accepted final identifiers. Missing evidence changes the composition instead of leaving
empty charts or inventing zero values.

Severity follows consequence. A failed or rejected operation first states what happened to the
existing library or saved document, then offers one safe next action. Technical detail is optional,
contains no personal path, and never leads ordinary workflow copy.

## Screen and state contract

### First run

The first view states that an owned export becomes an explorable local history, that processing
stays on the current device, and that no account is required. It shows an explicitly illustrative
multi-sport preview rather than pretending to know the person's data. Two starts are equally clear:
choose an existing ZIP, or learn how to obtain the supported provider export.

The acquisition guide explains the provider-controlled steps, expected archive, possible delivery
delay, offline next step, official-link boundary, and verification date. Opening the official page
does not start an import. Returning with an archive resumes the same source journey.

### Home

The populated state leads with the imported span, number of sessions, and recognizable sport
families. Recent sessions remain visible alongside one bounded, evidence-backed comparison. The
comparison has a named period, plain result, visual relationship, supporting counts, and a direct
route to evidence; it is not promotional copy or an unexplained score.

When recent imported evidence is too old for a meaningful current comparison, Home does not force
one. It says why no recent comparison is shown, confirms that the complete history remains usable,
shows the latest available sessions, and links to them. An honest fallback is preferable to a
misleading personalized claim.

### History

History opens with sports and visible sessions. Refinements are secondary and can be disclosed
without hiding the results. Sport, date range, and applicable measurement availability use structured
selectors populated from supported domain values; date controls also provide calendar interaction and
an explicit unbounded state. Free text searches session names or helps with imprecise recall, but does
not replace those selectors. All refinements update a single result set, expose their active state,
and can be removed individually or cleared together to restore the default set.

An empty result belongs to the current refinements, not to the library. It names the active query,
confirms that imported sessions remain unchanged, and offers a clear-refinements action.

An unresolved provider sport never blocks its sessions. The affected sessions appear in context
with one classification task. The person chooses a canonical family and an authored display label;
the family supplies the matching provider-neutral icon. Blank labels fail locally with a precise
message. Save updates all affected history views; cancel restores the last saved classification.
Source evidence remains unchanged and the classification survives navigation and restart.

### Session

A session opens as a focused workout story, not an appendix beneath a list. Its heading gives sport,
date, duration, distance where applicable, and evidence availability at a glance. A complete outdoor
session aligns source structure, a geographically recognizable map of the recorded GPS track, pace
or equivalent sport-specific signal, heart rate, zones, and relevant annotations on one
understandable elapsed-time context. The map is evidence rather than decoration: it distinguishes
recorded and missing geometry, relates route position to elapsed evidence when supported, performs no
hidden external request, and has a structured distance/coordinate alternative. Exact samples and
provenance remain closed until requested.

The map supports pan and zoom without losing the complete-track reset. Track traversal and the
aligned signal lanes share one selected elapsed instant. Pointer hover, click, keyboard traversal, or
an exact-evidence row highlights the corresponding map position and every available signal value;
moving through a signal highlights the mapped point when geometry exists for that instant. The
selection names elapsed time and recorded values, never inferred replacements. Missing route or signal
samples break the applicable link visibly. A keyboard-operable elapsed-position control and the exact
table provide equivalent non-map exploration.

Tracking exploration is not reduced to a thumbnail beside generic metrics. It receives enough
workspace to inspect geography and time together and retains sport-specific meaning: pace for
running, speed and stroke-related evidence for paddling when recorded, speed and cadence or power for
cycling when recorded, and the applicable elevation, heart-rate, temperature, or other supported
signals. The interaction grammar remains stable across sports while labels, units, lanes, sections,
and useful defaults change with the canonical sport family and available evidence.

The composition is evidence-dependent:

- no route produces a calm absence explanation and no map;
- no provider laps or phases leaves the unmodified timeline available and offers supported personal
  segmentation;
- no heart-rate series removes heart-rate visuals and disables criteria that require it; and
- missing samples remain visible as gaps in exact evidence rather than being interpolated silently.

A personal segmentation criterion has a name, supported rule, and positive span. The MVP candidate
supports the already implemented equal elapsed-time, equal recorded-distance, recorded heart-rate
range, and manual-boundary concepts when their required evidence exists. Save and apply is explicit;
edit and cancel preserve the last saved criterion. Derived sections are attributed to the person and
never replace provider structure or modify imported samples.

### Reports

A report is a named, deliberately created, durable analytical document about one supported session,
comparison, or question. It contains selected canonical evidence and may contain an attributed
personal interpretation. Authorship also resides in the selected subject, evidence blocks, order,
criteria, and privacy choices, so narrative is optional. A report is not a bookmark, saved screen,
library backup, normalized-data export, or synonym for every FitFreed view.

Exploration already has a restorable workspace contract. Therefore the MVP does not add separate
saved-view or saved-answer libraries and does not offer a generic blank report. Contextual creation
uses an exact consequence—such as **Create report from this session** or **Create report from this
comparison**—and opens an unsaved definition with compatible evidence selected. Cancel returns to
the source and creates nothing. Explicit save requires a title and sufficient canonical evidence,
but not narrative.

Reports opens on a visual library. Each item communicates subject, one meaningful result, evidence
state, period or date, and sensitive-content indication where relevant. An empty library defines the
object and offers supported session or comparison starts. Selecting an item opens its resolved result.

The result leads with the finding and visual evidence. Source navigation, evidence state, export,
deliberate edit, and deletion are visible but secondary. Editing uses three coordinated regions: an
ordered document outline, a substantial result preview, and a focused inspector. Blocks can be
added only when compatible, removed when optional, and moved explicitly. Save returns to the result;
cancel restores the saved definition.

When source evidence changes, the saved report remains on its reviewed revision until the person
reviews a current candidate. Title, authored interpretation, chosen subject, and order do not change
silently. Edit and export remain unavailable while a required evidence review is unresolved. Keeping
the old revision changes nothing; accepting the reviewed candidate records the new evidence revision.

Export has a dedicated review that states its scope: one deterministic, self-contained HTML report,
not the fitness library. The preview identifies the content leaving FitFreed. Location and physiology
choices appear only when selected report blocks contain those data; export choices do not rewrite the
saved report. A write failure confirms that the saved report is unchanged and offers another local
destination or a return to the result. Deletion names exactly what is removed and confirms that
imported history and other reports remain unchanged.

### Sources and import

Sources owns provider guidance, archive selection, active processing, source history, incorporation
coverage, compatibility, and technical provenance. Import is a task state that temporarily dominates
the content region; source choices do not compete with an active operation.

| State | Leading consequence | Required next behavior |
|---|---|---|
| Guide | No import has started | Continue with the ZIP or open clearly attributed official instructions |
| Active | Existing history is still protected by the transaction | Show meaningful progress and a deliberate cancel action |
| Cancelled | Existing history did not change | Select again or leave safely |
| Completed | State what became usable in the library | Continue to Home or inspect one canonical coverage account |
| Invalid archive | The local library did not change | Choose another archive or reopen acquisition guidance |
| Unexpected failure | The local library did not change | Retry; reveal privacy-safe technical detail only on request |
| Repeated archive | Nothing new was found under the current mapping version | Explain that future mapping versions may reassess the same source bytes |
| Extended archive | Separate added, enriched, and unchanged records | Preserve classifications, criteria, and authored report content; expose exact coverage on request |

The completed result reports incorporated information explicitly. Uninterpreted or unsupported source
families appear in this account and only reappear elsewhere when they affect the current answer. The
ordinary application must not repeat a general “missing data” warning across unrelated screens.

### Settings

Settings is a dedicated space for lasting preferences. The initial groups contain interface language
(`en-US`, `es-ES`), appearance (system, light, dark), and content zoom from 100% through 200%.
Changes have a representative preview and save explicitly. Current-task controls and data-library
operations do not migrate into Settings merely because they are configurable.

Invalid or obsolete saved values recover to a documented safe default while preserving valid
preferences. Recovery is announced without blocking the application. Locale changes translate the
interface but never rewrite user-authored sport labels, criterion names, report titles, or report
interpretations.

## Navigation and task continuity

Opening detail records an origin descriptor containing the originating workspace, result/query
identity, refinements, view mode, selection, meaningful scroll position, and keyboard focus target.
The detail view names its return destination. Returning restores that state rather than rerunning an
unrelated default query.

Direct entry, restart restoration without a valid origin, or an origin removed by later library
change uses the canonical hierarchy and names the actual destination—for example, **Back to all
running sessions**. Breadcrumbs communicate hierarchy; they do not pretend to be transient history.
Unsaved control states always offer explicit save and cancel semantics before navigation.

An action that expands detail below a table, list, or long result must not change content silently
outside the viewport. If the revealed region is not already substantially visible, the interface
scrolls its heading into a stable reading position and moves programmatic focus to that heading or
region. The movement is restrained, uses smooth scrolling only when reduced motion is not requested,
and keeps enough originating context visible to explain the relationship. Collapsing returns focus to
the control that disclosed the region; it does not force the viewport to jump when the control remains
visible. A side-by-side inspector or in-place row expansion may avoid scrolling only when its
association and new content are immediately perceivable.

## Adaptive and accessible behavior

The contract applies to wide macOS desktop and compact windows, not only a single showcase size.

- At 100% content zoom, the wide shell uses its full horizontal workspace and may use coordinated
  side-by-side regions where they improve comparison or editing.
- At 175% and 200%, the rail becomes narrow while retaining unambiguous destinations; multi-region
  workspaces, classification, criteria, settings, and change summaries stack before text or controls
  collide.
- Components also adapt to their allocated inline size. A map, chart, inspector, or detail column can
  be narrow inside an otherwise wide window, so its metric summaries, legends, labels, and controls
  change columns through component-level breakpoints before text wraps into isolated words or units.
- Compact windows keep labeled navigation, stack primary regions, and preserve the explicit return
  path. Horizontal scrolling is reserved for evidence that cannot be truthfully reflowed and has an
  accessible alternative.
- Light, dark, and system appearance preserve at least WCAG 2.2 AA text contrast. Focus indication,
  current state, errors, selection, gaps, and chart meaning never depend on color alone.
- Reduced motion removes nonessential animation without hiding state changes. Zoom is content zoom,
  not browser or evaluator chrome scaling.
- Every visual explanation has a programmatic title, textual conclusion, units, coverage, and an
  exact tabular or structured alternative appropriate to its evidence.
- Keyboard order follows the task hierarchy. Focus moves to the new primary heading after workspace
  or detail navigation and returns to the invoking control when a focused task closes.
- Status messages use live regions without stealing focus. Errors are associated with their fields;
  disabled choices state the missing prerequisite.

## Presentation and lower-layer responsibilities

Presentation may arrange application results, keep ephemeral inspection state, format typed values,
and own unsaved drafts until a command is invoked. It must not join repositories, infer business
conclusions, classify provider evidence, calculate report staleness, mutate imported samples, or
pretend persistence by retaining a mounted component.

Production migration therefore requires these lower-layer changes before their dependent UI:

1. a bounded Home result or recognizable-fallback read model;
2. an application-owned composed session-story read model over existing attributed queries;
3. a report-library projection with subject, meaningful result, evidence state, date or period, and
   sensitivity summary;
4. report deletion through domain, application, and persistence boundaries; and
5. a report invariant that permits an empty narrative when a title and sufficient supported evidence
   form a factual document.

Existing sport classification, user segmentation, source evidence, report resolution, deliberate
refresh, privacy authorization, and deterministic HTML export contracts remain authoritative. The
production UI must consume them through their application ports rather than reproducing their rules.

The current application contracts already expose exact route points with coordinates, altitude, and
optional elapsed time, plus separate elapsed signal series for heart rate, speed, distance, altitude,
cadence, temperature, and power. The canonical sport model also provides a provider-neutral water
sport family suitable for an authored paddling label. These are necessary evidence, but separate route
and signal queries are not a presentation join contract. The composed session-story read model must
align compatible evidence revisions and elapsed timestamps, retain gaps, and project the
sport-specific labels and units before the production interface offers synchronized tracking. No
component may correlate repository results independently.

## X3 review evidence

The ignored local prototype at `.local/ui-redesign-v2/` realizes every state in this specification
with independently invented multi-sport data. Its automated checks exercise meaningful field input,
validation, save/cancel behavior, multiple items, ordering, removal, persistence across navigation,
locale switching, recovery, synchronized running and paddling track inspection, exact evidence, all
import outcomes, report lifecycle, structural accessibility, and light/dark contrast tokens.

The review must still supply human observations. X3 is not accepted until the product owner confirms
that the candidate:

1. makes the product purpose and first useful action understandable without explanation;
2. makes sports and sessions recognizable and a remembered session findable;
3. makes a route-bearing session genuinely investigable through a navigable map, synchronized
   sport-specific signals, sections, exact points, and an equivalent keyboard path, while explaining
   a partial session without hiding depth or inventing evidence;
4. gives reports a predictable identity and lifecycle distinct from exploration and data exit;
5. handles invalid, repeated, extended, and failed imports without alarm or ambiguity;
6. remains coherent in both locales, appearances, window widths, and at 200% content zoom; and
7. preserves a clear route from concise meaning to exact evidence and user control.

Acceptance observations and amendments update this specification first. X4 then derives production
vertical increments from the accepted version; screenshots or prototype code never become a parallel
implementation source.
