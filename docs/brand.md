# FitFreed — brand assets (v1, draft)

Vector identity for **FitFreed**, an open-source fitness data explorer.
Working tagline: *Your fitness data, freed.*

> **Status: draft.** These assets have not passed the public-branding gate defined in the
> product identity document. See [Before public release](#before-public-release).

---

## Concept

The symbol is the letter **F** — the shared initial of *Fit* and *Freed* — built on a modular
grid. The outer segment of the top arm has **detached and is drifting up and to the right**:
data leaving the platform that generated it, still intact and still readable.

The letter stays in ink; only the freed modules take the accent colour. That is the whole idea
of the product in one gesture — the record is yours, and it travels.

The mark is provider-neutral: no heart, no pulse line, no silhouette, no medical cue, nothing
that resembles a Polar, Garmin, Strava or Fitbit asset, and nothing that suggests a regulator,
a certification or a legal service.

---

## Files

| File | Use |
|---|---|
| `fitfreed-brand-sheet.svg` | Overview of the whole system |
| `fitfreed-logo.svg` | **Primary lockup**, light backgrounds |
| `fitfreed-logo-dark.svg` | Primary lockup, dark backgrounds |
| `fitfreed-logo-mono.svg` | Single colour, uses `currentColor` — inherits CSS text colour |
| `fitfreed-logo-stacked.svg` | Vertical lockup with descriptor, for narrow or centred layouts |
| `fitfreed-mark.svg` | Symbol alone (both freed modules) |
| `fitfreed-mark-compact.svg` | Symbol alone, near-square, for tight or square frames |
| `fitfreed-icon.svg` | App icon / GitHub organisation avatar, 512 grid |
| `fitfreed-favicon.svg` | Favicon, auto-adapts to light/dark via `prefers-color-scheme` |

All SVGs are plain geometry: rectangles plus outlined text. No fonts, no rasters, no external
references, no filters. They render identically everywhere and diff cleanly in git.

Platform-specific raster and container icons are generated from `assets/brand/fitfreed-icon.svg`
by the pinned Tauri toolchain. Generated icon files are build output and are not versioned.

## Colour

| Token | Hex | Use |
|---|---|---|
| `--ff-ink` | `#151D2C` | Letterforms, wordmark, icon background |
| `--ff-freed` | `#6C4DF6` | Freed modules, accents on light backgrounds |
| `--ff-freed-dark` | `#8E7BFF` | Freed modules on dark backgrounds (raises contrast) |
| `--ff-muted` | `#5C6779` | Descriptor, secondary copy |
| `--ff-paper` | `#FFFFFF` | Light background |

Contrast: ink on white is 15.2:1, freed on white is 5.6:1, freed-dark on ink is 6.4:1 — all
above WCAG AA for non-text and for large text.

## Typography

Wordmark and descriptor are set in **Space Grotesk** (SIL Open Font License 1.1) and converted
to outlines, so nothing depends on a font being installed. For interface and documentation,
Space Grotesk pairs well with any neutral body face; a mono face for data tables completes the
set. If you prefer a different typeface later, only the outline paths in the lockups need
regenerating — the symbol is independent.

## Clear space and minimum sizes

* **Clear space:** the width of the vertical stem — `0.19 × symbol height` — on all four sides.
* **Primary lockup:** 18 px symbol height (≈ 92 px total width) is the floor. Below that, use
  the symbol alone.
* **Symbol:** 16 px. Below 16 px, use `fitfreed-mark-compact.svg` or the favicon.
* Never rebuild the lockup by placing the symbol next to typed text; use the supplied files so
  the proportions stay fixed.

## Don't

* Recolour the freed modules to match the letterform — the two-tone split *is* the concept.
* Rotate, skew, outline, add gradients, shadows or glows.
* Place the colour lockup on a mid-tone or busy background; use the mono version instead.
* Enclose the primary lockup in a box or badge that is not one of the supplied icon files.
* Pair it with a provider logo in a way that implies partnership or endorsement.

## Usage in code

```html
<!-- The logo inherits the text color, which is useful for README files and dark mode. -->
<img src="fitfreed-logo-mono.svg" alt="FitFreed" height="32">

<!-- The favicon adapts to the operating-system theme. -->
<link rel="icon" href="/fitfreed-favicon.svg" type="image/svg+xml">
```

```css
:root {
  --ff-ink: #151D2C;
  --ff-freed: #6C4DF6;
  --ff-muted: #5C6779;
}
/* The monochrome version uses currentColor, so setting the container color is sufficient. */
.logo { color: var(--ff-ink); }
@media (prefers-color-scheme: dark) { .logo { color: #F5F7FB; } }
```

---

## Authorship and reuse

The project owner created this original identity with the assistance of an AI agent. The assets are project-owned source material and may be used and modified under the repository license. They contain no third-party provider mark or copied artwork.

## Before public release

The identity document already defines a public-branding gate for the name. The logo inherits it,
plus two checks of its own:

1. **Design search**, not just word search. A detached-module `F` is a common construction; run
   an image and design-mark search alongside the exact and confusingly-similar name searches.
2. **Figurative trademark screening** in the intended distribution regions, kept clearly
   distinct from legal clearance. The proximity of *Freed* in health software applies to the
   combined mark as well as to the name.
3. **Font licence**: Space Grotesk is OFL 1.1. Using its outlines in a logo is permitted, and
   the outlines here are no longer font software, so no licence file ships with the artwork. If
   the mark is ever registered, note the source typeface in the filing record.
4. **Rendering check** at 16 px, in greyscale, and printed in one colour, before anything is
   published.

None of the above is legal advice, and none of it is trademark clearance.
