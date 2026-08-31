# MVP Experience Specification

## Status and authority

**Accepted X3 contract as of 2026-08-21; X7-R8 reopened after human rejection.** This
document is the single source of truth for the screen, interaction, navigation, state, responsive, localization, and
accessibility contract of the systemic MVP experience redesign. The production application implements X5-R1 through
X5-R10 and the corrective X7-R1 through X7-R8 vertical slices.
The first human session was invalidated by an instrumented native boundary, and the restarted valid human gate later
rejected its reviewed X6 sources. Corrective X7-R1 through X7-R7 in the [production migration
plan](../plans/mvp-redesign-production-migration.md) passed their independent audit, exact local and hosted
campaigns, immutable marker, and production-native bundle scan, but the resulting candidate was rejected after the
product-owner review exposed material lower-layer and experience defects. X7-R8 corrected those contracts, repeated
the audit and exact automated campaign, and produced one scanned production-native review application. The bounded
product-owner gate rejected that correction on 2026-08-30 after sport identity remained unusable, late reconciliation
lost fluidity, and compact sport cards became unreadable. Those causal boundaries must be corrected and independently
verified before another human gate or release preparation resumes. X7-R8.9 through X7-R8.11 now retain machine evidence
for the reusable sport-correlation, documented provider-normalization, and responsive changed-package reconciliation
boundaries plus complete compact sport-card composition. The later source `3e280ca` review nevertheless rejected the
application because most represented sports and sessions remained unknown. X7-R8.13 now owns the missing bundled
compatibility catalogue. Exact source `a447910` retains automatic-recognition evidence and passes the corrected local
packaged campaign, complete hosted campaign, immutable evidence, and revision-isolated native inspection, so the
bounded product-owner experience review is now eligible. Implementation and machine evidence do not accept that
experience or authorize a release claim.

The [requirements](../requirements.md#product-experience-contract) own normative product behavior.
The [redesign plan](../plans/ui-redesign.md) owns rationale, journeys, feasibility analysis, and
delivery gates. This specification makes the accepted X2 direction concrete without repeating either
source. The X3 human gate accepted this contract on 2026-08-21, including the recorded Alpha status
of reports and personal range definition and the requirement that compact primary navigation retain
visible text labels.

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
empty charts or inventing zero values. A result heading may wrap around a complete localized
measurement, but it never isolates the unit from its value on another line.

Duration precision follows the information role. A summary rounds sub-minute values to seconds,
ordinary values to minutes, and totals of at least 100 hours to whole hours. Detail may retain seconds
but not sub-second residue. Exact evidence retains every recorded millisecond when present. The same
role distinction applies to decimal quantities: summaries use magnitude-aware everyday precision,
comparisons add an explicit sign without exposing floating-point residue, detail may add only useful
precision, and exact evidence preserves the recorded value. None of these roles rewrites the underlying
value or the exact export. Counts always use locale grouping, including both sides of one ratio, and values
plus units remain one reading unit. A screen chooses a named shared policy rather than constructing an
independent number or date formatter. An ordinary same-day session appears as one localized date, one
start-to-end time range, and one duration; complete timestamps and UTC offset remain deliberate evidence.
Every ordinary period whose two boundaries are the same calendar date likewise shows that date once across
Home, sport collections, comparisons, and reports. A real multi-day period keeps both boundaries.

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

The calendar is another session-discovery view, not a count heatmap. Every activity shown in a day
uses the same recognizable sport identity as session discovery, includes its human-scale duration,
and opens that exact session. Multiple activities follow local start order. The calendar exposes the
years represented in the current query and one direct return to the current month; month-by-month
stepping is never the only way to reach a long history.

An empty result belongs to the current refinements, not to the library. It names the active query,
confirms that imported sessions remain unchanged, and offers a clear-refinements action.

An unresolved provider sport never blocks its sessions. The affected sessions appear in context
with one classification task. The person chooses a canonical family and an authored display label;
the family supplies the matching provider-neutral icon. Blank labels fail locally with a precise
message. Save updates all affected history views; cancel restores the last saved classification.
Source evidence remains unchanged and the classification survives navigation and restart. The task
names its exact scope before save. Classifying an unresolved remainder does not silently absorb
sessions that already carry stronger exact recognition; deliberately unifying identities is a
separate explicit operation with a visible affected-session account.

### Session

A session opens as a focused workout story, not an appendix beneath a list. Its heading gives sport,
date, duration, distance where applicable, and evidence availability at a glance. A complete outdoor
session composes source structure, a geographically proportioned local map of the recorded GPS track, pace
or equivalent sport-specific signal, heart rate, zones, and relevant annotations. It places them on one
elapsed-time context only when recorded evidence establishes that relationship; otherwise their clocks remain
independent. The map is evidence rather than decoration: it distinguishes
recorded and missing geometry, relates route position to elapsed evidence when supported, performs no
hidden external request, and has a structured distance/coordinate alternative. Exact samples and
provenance remain closed until requested.

The map supports pan and zoom without losing the complete-track reset. Its minimum scale is derived from the
complete recorded-track fit, so the route cannot shrink into meaningless continental or planetary context;
its maximum does not imply detail beyond ordinary recorded GPS evidence. One relative level indicator and
the enabled state of the named controls expose the same limits used by pointer, touch, wheel, keyboard, and
programmatic navigation. When the evidence contract certifies
an exact recorded relationship, track traversal and attached signal lanes share one selected elapsed instant.
Pointer hover, click, keyboard traversal, or an exact-evidence row then highlights the corresponding map
position and every related signal value; moving through a signal highlights the mapped point when geometry
exists for that recorded instant. Without that authority the route and regular signals remain independently
explorable. The
selection names elapsed time and recorded values, never inferred replacements. Missing route or signal
samples break the applicable link visibly. A keyboard-operable elapsed-position control and the exact
table provide equivalent non-map exploration.

The accepted structural candidate is a map-led workbench, not a map card beside a chart. After a
compact session identity and summary band, a route-bearing session gives the complete full-width map
the majority of the primary exploration viewport. It is the largest page region and keeps route
shape, direction, endpoints, selected position, gaps, orientation, scale, and local coordinate context legible. The map
can enter a focused or full-screen state and return without losing its selection, overlay, range, or
origin context.

The workbench can project supported sport-specific evidence directly onto the recorded track only through an
explicit recorded relationship, with a legend and an accessible non-color alternative. Pace is primary for running; speed and
stroke-related evidence are primary for paddling when recorded; speed, cadence, or power apply to
cycling when recorded; and elevation, heart rate, temperature, or other supported signals remain
available according to the session. An attached selection strip reports the current elapsed time or
distance and recorded values without covering important geometry. Conditionally available full-width signal lanes,
sections, and exact evidence follow the map and share its cursor and selected range; they deepen the
geographic story rather than competing with it. Labels, units, lanes, sections, and useful defaults
change with the canonical sport family and available evidence while the interaction grammar remains
stable.

The map also owns contiguous range investigation. Attributed source ranges appear as selectable route
and timeline extents with their original names and boundaries. A person can create a range by choosing
its start and end on the route, a signal lane, a structure row, or exact evidence; both handles remain
adjustable only across representations whose shared coordinate is explicitly proven. Before save, the workbench shows a
clearly temporary selection and its supported summary. Save requires a non-blank name and creates a
user-authored session range without changing source structure. Saved ranges can be reopened, renamed,
adjusted, or removed; source and user ranges use visible authorship independent of color. Each range
reports its direction, elapsed or moving time, distance, sport-specific measurements, coverage, and
gaps, and provides a direct route to its exact boundary evidence.

On a wide screen, range creation and editing uses an in-workbench inspector while the map retains
approximately three quarters of the available width. The selected route extent and both boundaries
therefore remain visible throughout naming and adjustment. At compact width or high content zoom the
inspector stacks without placing a chart beside the map or shrinking the map into a card.

A saved session range is not a reusable segmentation criterion. It belongs to one contiguous portion
of one session and retains exact boundary references. A criterion remains a reusable rule capable of
deriving several sections from compatible recorded evidence. The workbench may present them together
when useful, but never merges their identity, authorship, persistence, or source effect.

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

Independent recorded signals use a mature analytical chart with one through four deliberately chosen
series. A single series remains a valid inspection state. When both are recorded, speed and heart rate
are the initial pair; otherwise defaults follow a documented sport-aware relevance order rather than
source enumeration. Cumulative distance remains available when its monotonic progression answers the
current question, but it is not selected merely because it appears early in source order. Each lane
has an unambiguous horizontal label, scale, and unit that cannot collide with adjacent lanes at any
supported locale, allocation, or content zoom.

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

A report example or contextual start that requires a bounded subject keeps the person inside the
report task. It presents only eligible candidates, preserves the initiating example and destination,
and requires an explicit **Use this session**, **Use this comparison**, or equivalent choice. A route
example never delegates to an unfiltered session list that includes sessions without route evidence.

The result leads with the finding and visual evidence. Source navigation, evidence state, export,
deliberate edit, and deletion are visible but secondary. Editing uses three coordinated regions: an
ordered document outline, a substantial result preview, and a focused inspector. Blocks can be
added only when compatible, removed when optional, and moved explicitly. Save returns to the result;
cancel restores the saved definition.

The result also owns the effective parameters of its current run. Date periods and every other
supported frequently changed filter appear beside the result, use the same semantic paired presets
as ordinary comparisons, and retain manual selection. Changing a run parameter resolves a new result
without mutating the saved report. The definition editor changes durable structure and saved defaults;
it is not required for ordinary month-to-month or quarter-to-quarter exploration. The result and
export review identify the effective values and whether they came from saved defaults or a transient
run.

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
the content region; source choices do not compete with an active operation. Each task state owns no more
than one archive-selection action. A terminal result can start another choice without also exposing the
ready-state chooser or placing a newly selected archive below the current viewport.

The general acquisition explanation appears only while Sources is ready for a decision. During an
operation and when presenting its result, the page identity becomes compact so that progress or the
leading consequence begins in the initial viewport. A selected archive is identified by filename,
never by its local directory. Recoverable chooser and official-link failures stay beside the source
task and use a restrained warning treatment; they do not become an application-wide emergency or
replace the last import outcome.

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
The visible result leads with whether usable history changed, followed only by non-zero added,
enriched, or amended counts and a useful next action. Exact reconciliation counts, status, provider,
history effect, package coverage, and family-level reasons remain in one collapsed disclosure. A
rejected or failed import gets a separate collapsed reason disclosure; cancellation does not masquerade
as a failure.

### Settings

Settings is a dedicated space for lasting preferences. The initial groups contain interface language
(`en-US`, `es-ES`), appearance (system, light, dark), and content zoom from 100% through 200%.
Changes immediately affect one concrete fictional session preview and save explicitly. The preview
must expose the actual effects of locale, appearance, and zoom rather than decorate the form. An
unsaved draft is named and survives movement between Settings categories. **Restore defaults** changes
only that draft and its preview, appears in the affected preference group only while useful, and disappears
once the draft already contains the defaults. **Cancel changes** restores the complete persisted preference
set without writing, and **Save changes** is the sole durable Settings write. Cancel and save appear only
for a dirty or completing transaction. Navigation away from an unsaved draft
requires an explicit choice to keep editing or discard and continue. Appearance choices use recognizable
visual samples in addition to names.

Update discovery and maintenance form a second Settings category. They remain mounted so a scheduled
or launch check is not repeated when the person switches categories, always identify the installed
version once update state is available, and never compete visually with the preference form. Current-task
controls and data-library operations do not migrate into Settings merely because they are configurable.

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

Inline measure follows the role of the content rather than one blanket character limit:

| Content role | Composition contract |
|---|---|
| Reading prose | Introductory prose uses the shared `72ch` reading measure, bounded again by its allocated region. |
| Display heading | A deliberate character measure may shape a short heading; it is not inherited by adjacent explanation or controls. |
| Task instruction, status, result, control help, and exact evidence | Uses the complete allocated region. A smaller bound requires a reviewed role-specific reason rather than a generic readability rule. |
| Navigation and exact tabular geometry | Uses its component allocation; horizontal continuation is allowed only under the explicit evidence and alternative-access rules below. |
| Structural region | Width bounds may control the geometry of a page section, map overlay, dialog, inspector, or table viewport, but do not impose a second text measure on its descendants. |

Forms align semantic regions, not independent field boxes. At a supported side-by-side allocation,
labels share a row, controls share a row and control height, help and validation occupy reserved rows,
and actions span the form after every field. At 150% through 200% content zoom, or when the allocated
width cannot preserve that rhythm, the classification task becomes one column without creating an
implicit grid track. The existing application command, local validation, optimistic revision conflict,
save, mark-as-unknown, cancel, multi-item, reimport, and reload contracts remain unchanged by this
presentation rule.

- At 100% content zoom, the wide shell uses its full horizontal workspace and may use coordinated
  side-by-side regions where they improve comparison or editing.
- At 175% and 200%, primary navigation becomes a labelled horizontal region so every icon and text
  label remains visible without consuming the enlarged content width; multi-region workspaces,
  classification, criteria, settings, and change summaries stack before text or controls collide.
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
  or detail navigation and returns to the invoking control when a focused task closes. Choosing a
  session-detail section reveals and focuses that section below persistent application navigation;
  changing sections must never leave the newly selected content outside the viewport.
- Status messages use live regions without stealing focus. Errors are associated with their fields;
  disabled choices state the missing prerequisite.

## Presentation and lower-layer responsibilities

Presentation may arrange application results, keep ephemeral inspection state, format typed values,
and own unsaved drafts until a command is invoked. It must not join repositories, infer business
conclusions, classify provider evidence, calculate report staleness, mutate imported samples, or
pretend persistence by retaining a mounted component.

The production migration introduced these lower-layer contracts before their dependent UI:

1. a bounded Home result or recognizable-fallback read model;
2. an application-owned composed session-story read model over existing attributed queries;
3. a report-library projection with subject, meaningful result, evidence state, date or period, and
   sensitivity summary;
4. report deletion through domain, application, and persistence boundaries; and
5. a report invariant that permits an empty narrative when a title and sufficient supported evidence
   form a factual document;
6. a session-owned user-range aggregate with stable identity, ordered elapsed boundaries, title,
   revision, commands, persistence, and overlap support; and
7. an application-owned range-summary query that resolves the selected exact exercise, route, or signal
   coordinate with its gaps, source attribution, and boundary evidence under one evidence revision while
   keeping independent clocks unaligned.

Existing sport classification, user segmentation, source evidence, report resolution, deliberate
refresh, privacy authorization, and deterministic HTML export contracts remain authoritative. The
production UI must consume them through their application ports rather than reproducing their rules.

The application contracts expose exact route points with coordinates, altitude, and
optional elapsed time, plus separate elapsed signal series for heart rate, speed, distance, altitude,
cadence, temperature, and power. The canonical sport model also provides a provider-neutral water
sport family suitable for an authored paddling label. These are necessary evidence, but separate route
and signal queries are not a presentation join contract. The current production composition therefore
keeps route traversal and regular signal inspection independent. A future composed session-story read
model may align only explicitly compatible recorded evidence revisions and elapsed timestamps, retain
gaps, and project the sport-specific labels and units before the interface offers synchronized
tracking. No component may correlate repository results independently.

## X3 acceptance evidence

The ignored local prototype at `.local/ui-redesign-v2/` realizes every state in this specification
with independently invented multi-sport data. Its automated checks exercise meaningful field input,
validation, save/cancel behavior, multiple items, ordering, removal, persistence across navigation,
locale switching, recovery, synchronized running and paddling track inspection, exact evidence, all
import outcomes, report lifecycle, structural accessibility, and light/dark contrast tokens.

The product owner accepted X3 on 2026-08-21 after reviewing the candidate against these outcomes:

1. makes the product purpose and first useful action understandable without explanation;
2. makes sports and sessions recognizable and a remembered session findable;
3. makes the map unmistakably dominant in a route-bearing session and genuinely investigable through
   full-track and focused states, conditional sport-specific overlays and synchronized signals, attributed source
   ranges, saved user-named ranges, sections, exact points, and an equivalent keyboard path, while
   explaining a partial session without hiding depth or inventing evidence;
4. gives reports a predictable identity and lifecycle distinct from exploration and data exit;
5. handles invalid, repeated, extended, and failed imports without alarm or ambiguity;
6. remains coherent in both locales, appearances, window widths, and at 200% content zoom; and
7. preserves a clear route from concise meaning to exact evidence and user control.

Reports and personal range definition remain Alpha experiences: their end-to-end purposes and
integrity contracts are accepted, while their interaction hierarchy, density, and composition remain
open to substantial revision. Compact navigation always retains a visible text label beside every
workspace icon; tooltips or accessible names alone do not satisfy the contract.

X4 derived production vertical increments from this accepted version. X5-R1 through X5-R10 implement
those increments in the production application. The renewed X6 machine-assisted audit and exact hosted
campaign challenge the complete result before final human acceptance. Screenshots and prototype code never
become a parallel implementation source.
