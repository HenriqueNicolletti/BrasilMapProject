---
name: Brasil em Mapas
description: Interactive atlas of the 5,570 Brazilian municipalities, printed as a nautical chart sheet.
colors:
  sea: "#e8f1f4"
  shoal: "#bfdde8"
  deep: "#1b3f7a"
  land: "#f0de9a"
  magenta: "#c4155a"
  ink: "#14171c"
  note: "#3a4a66"
  line: "color-mix(in srgb, #1b3f7a 28%, transparent)"
  sea-night: "#0c1521"
  shoal-night: "#1f3550"
  deep-night: "#7fb0e8"
  land-night: "#3b3418"
  magenta-night: "#ff72a6"
  ink-night: "#dbe6ef"
  note-night: "#9db3cb"
  on-magenta-night: "#1a0510"
  scale-seq-1: "#c9e0ec"
  scale-seq-2: "#a3cde0"
  scale-seq-3: "#7bb4d2"
  scale-seq-4: "#4f8bb8"
  scale-seq-5: "#2c5f9a"
  scale-seq-6: "#1b3f7a"
  scale-seq-7: "#0f2552"
  scale-seq-1-night: "#1c3856"
  scale-seq-2-night: "#27557f"
  scale-seq-3-night: "#3573ad"
  scale-seq-4-night: "#5593cf"
  scale-seq-5-night: "#7eb3e6"
  scale-seq-6-night: "#aed0f3"
  scale-seq-7-night: "#dcecfb"
typography:
  display:
    fontFamily: "'Source Serif 4 Variable', 'Source Serif 4', Georgia, 'Times New Roman', serif"
    fontSize: "clamp(2rem, 1rem + 4vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Source Serif 4 Variable', 'Source Serif 4', Georgia, 'Times New Roman', serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.05
  title:
    fontFamily: "'Source Serif 4 Variable', 'Source Serif 4', Georgia, 'Times New Roman', serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.05
  lede:
    fontFamily: "'Source Serif 4 Variable', 'Source Serif 4', Georgia, 'Times New Roman', serif"
    fontSize: "1.375rem"
    fontWeight: 400
    lineHeight: 1.3
  body:
    fontFamily: "'Source Serif 4 Variable', 'Source Serif 4', Georgia, 'Times New Roman', serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "lnum"
  body-sm:
    fontFamily: "'Source Serif 4 Variable', 'Source Serif 4', Georgia, 'Times New Roman', serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  sounding:
    fontFamily: "'Source Serif 4 Variable', 'Source Serif 4', Georgia, 'Times New Roman', serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    fontFeature: "tnum, lnum"
  label:
    fontFamily: "'Barlow Semi Condensed', 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    letterSpacing: "0.06em"
  caption:
    fontFamily: "'Source Serif 4 Variable', 'Source Serif 4', Georgia, 'Times New Roman', serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
  map-label:
    fontFamily: "'Barlow Semi Condensed', 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    letterSpacing: "0.06em"
  map-sounding:
    fontFamily: "'Source Serif 4 Variable', 'Source Serif 4', Georgia, 'Times New Roman', serif"
    fontSize: "11px"
    fontWeight: 400
    fontFeature: "tnum, lnum"
rounded:
  none: "0"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.5rem"
  "6": "2.5rem"
  gutter: "clamp(1rem, 0.4rem + 2.6vw, 2.5rem)"
  graticule: "72px"
components:
  button-chart:
    backgroundColor: "{colors.sea}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.5rem 1rem"
    height: "2.75rem"
  button-chart-hover:
    backgroundColor: "{colors.shoal}"
  theme-toggle-hover:
    backgroundColor: "{colors.deep}"
    textColor: "{colors.sea}"
  action-magenta:
    backgroundColor: "{colors.magenta}"
    textColor: "{colors.sea}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.5rem 1rem"
    height: "2.75rem"
  action-magenta-hover:
    backgroundColor: "{colors.deep}"
    textColor: "{colors.sea}"
  input-position:
    backgroundColor: "{colors.sea}"
    textColor: "{colors.ink}"
    typography: "{typography.lede}"
    rounded: "{rounded.none}"
    padding: "0.75rem 1rem"
  select-field:
    backgroundColor: "{colors.sea}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0.5rem 0.75rem"
  notes-block:
    backgroundColor: "{colors.sea}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: "0.75rem 1rem"
  lead-block:
    backgroundColor: "{colors.sea}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "1rem"
  result-row-active:
    backgroundColor: "{colors.shoal}"
    textColor: "{colors.ink}"
  tooltip:
    backgroundColor: "{colors.sea}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: "0.5rem 0.75rem"
    width: "16rem"
  share-card:
    backgroundColor: "{colors.sea}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    width: "1200px"
    height: "630px"
    padding: "64px"
---

# Design System: Brasil em Mapas

Written in English, following the project rule that code, comments and repo docs outside `docs/` are in English; interface copy quoted below stays in pt-BR. Derived from the shipped build (`src/styles/tokens.css`, `global.css`, `atlas.css`, the layouts, components, `src/lib/og.ts` and `src/scripts/brasil.ts`), not from the plan. `src/styles/tokens.css` remains the only token source; this file describes it and must follow it if they ever disagree.

## Overview

**Creative North Star: "Carta Náutica"**

Brazil is printed as a sea chart sheet. Every route is one sheet: a double neatline (a 2px rule with a 1px rule inset inside it) framing a pale sea with a fine graticule drawn in faint chart blue. The map is the plate on that sheet, and everything else is chart furniture: a magenta compass rose in the corner, a margin of notes and legend, soundings printed on the land. A municipality is a position, an indicator is a sounding, a twin is a cross bearing. The vocabulary reaches into the interface copy ("Posição", "Outras cartas", "Carta de noite") and into the drawing: measured twins are dashed magenta bearings with the distance set on the line like a sounding on a course.

The system is a closed set of printing inks. Day chart: pale sea, shoal tint, deep chart blue, straw-buff land, black ink, a blue-grey note ink, and magenta overprint for whatever is active. Night chart re-inks the same hues dimmed for low light; it is the same sheet, not a different theme. Depth is print, not light: things are ruled, tinted and overprinted, and almost nothing floats. Density is that of a reference chart: generous margins on the sheet, compact type in the notes, tabular numbers wherever figures line up. Share images are the same sheet at 1200 by 630, in the day inks.

Confirmed rejections (from the direction contract): the government-site look, the BI dashboard look of a choropleth beside a KPI-card panel, the green-and-yellow flag cliche, and a decorative map. The map is always a working instrument with a legend, a source line and a table alternative.

**Key Characteristics:**
- One sheet per page: double neatline, sea ground, graticule.
- Closed ink set; the night chart re-inks the same hues.
- Magenta is the only accent and marks what is active or actionable.
- Two typographic hands: a serif for everything read, a condensed sans for everything named.
- Square corners and ruled lines everywhere; two rule weights only.
- Figures printed as soundings: serif italic, tabular lining numerals.

## Colors

A closed set of seven printing inks per chart (day and night), plus one sequential blue scale for the choropleth; no component adds a colour of its own.

### Primary
- **Overprint Magenta** (`magenta`; night `magenta-night`): the ink of the active thing. Links, the keyboard focus ring, the compass rose, the hover/focus highlight on the plate (18% tint plus 2.5px stroke), the locator fix on municipality pages, the twin bearings and their distances, the callout rule, checkbox accent, the single solid action of the home's twin entry, and the place a share card is about. On the night chart text on a magenta fill uses `on-magenta-night`.

### Secondary
- **Chart Deep Blue** (`deep`; night `deep-night`): the structural ink. Neatlines, every strong rule (`--color-line-strong`), shape outlines on the plate, input and button borders, the darkest-but-one choropleth step, the selection background, the hover fill of quiet controls (theme toggle, the twin action), and the figure values on share cards.
- **Graticule Line** (`line`, deep blue at 28% over transparent): the hairline ink. Graticule, table row dividers, list separators. It is the only translucent colour, and it is always derived from deep blue.

### Tertiary
- **Straw Buff Land** (`land`; night `land-night`): land where no indicator colours it. Locator and share-card outlines and the ground of the "sem dado" hatch. A strong buff, not cream.

### Neutral
- **Chart Sea** (`sea`; night `sea-night`): the paper. Page ground, sheet, every panel, input, button and table head background. Panels are sea-on-sea, separated by rules, never by a lighter or darker fill.
- **Shoal Tint** (`shoal`; night `shoal-night`): the one state fill. Hovered search results, hovered chart buttons, the table row matching the highlighted shape.
- **Black Ink** (`ink`; night `ink-night`): all running text, headings, numerals on the plate.
- **Note Ink** (`note`; night `note-night`): secondary text: ledes, captions, source lines, UF codes, meta lines, placeholder, the share-card sign-off, and the hatch strokes of "sem dado".

### Choropleth scale
- **Sequential chart blue** (`scale-seq-1` to `scale-seq-7`, night `-night` variants): seven steps light to dark by day, dark to light by night, so "more" is always the step furthest from the sea. Steps stay distinct in greyscale.

### Named Rules
**The Closed Ink Set Rule.** Every colour on a surface is one of the seven inks of the current chart, the line tint, or a choropleth step. Components read the semantic `--color-*` tokens only; raw `--ink-*` values exist to feed them. Code that draws outside CSS reads the tokens too: the canvas national map reads every ink from the computed tokens and fails loudly if one is missing rather than falling back to a colour of its own; share images repeat the day inks in `OG_INKS`, held equal to `tokens.css` by a test. A new surface that needs a "new colour" needs a different ink role, not a new hex.

**The Magenta Overprint Rule.** Magenta marks what is active or actionable and nothing else. Over the plate it overprints: `mix-blend-mode: multiply` on the day chart, `normal` on the night chart (`--overprint-blend`). Solid magenta fills are reserved for one primary action per surface.

**The Absent Is Hatched Rule.** Missing data is land ink with a 45° note-ink hatch, on the plate and in the legend swatch alike. It is never a step on the scale and never zero.

## Typography

**Display Font:** Source Serif 4 Variable (with Georgia, Times New Roman, serif)
**Body Font:** Source Serif 4 Variable (same stack)
**Label Font:** Barlow Semi Condensed 400/600 (with Arial Narrow, Helvetica Neue, Arial, sans-serif)

**Character:** A chart is lettered by two hands. The serif carries everything you read, including all figures; the condensed sans carries everything that names or controls, the way a chart letters place names and notes.

### Hierarchy
- **Display** (600, `--text-display`, 1.05, -0.02em, max 14ch): the sheet title, one per page.
- **Headline** (600, 1.875rem, 1.05): section heads such as "Município gêmeo", "Gêmeos medidos", fact groups, prose sections.
- **Title** (600, 1.375rem, 1.05): list item heads on the twin page; the bearing pair names at 400.
- **Lede** (400 italic, 1.375rem, 1.3, note ink): the line under the sheet title; also the size of the Position input.
- **Body** (400, 1.0625rem, 1.55, lining numerals, max 68ch): running text.
- **Body small** (400, 0.9375rem): notes, legend, tables, margin copy.
- **Sounding** (400 italic, tabular lining numerals): every figure printed on the chart, in the legend, on bearings and in tooltips.
- **Label** (600, 0.9375rem, +0.06em tracking, sentence case): field labels, notes and table headings, the theme toggle, buttons, the back link, UF codes (400, note ink).
- **Caption** (400, 0.8125rem, note ink): source and reference-year lines, status, meta.
- **Map lettering** (in SVG plate units, so it scales with the map): abbreviations in the label face at `--text-map-label`, soundings in serif italic at `--text-map-sounding`, both with a sea halo of `--map-halo` painted under the stroke. Hidden below 40rem, where it would print too small; the table carries the names.

### Named Rules
**The Two Hands Rule.** Serif for what is read, condensed sans for what is named or pressed. Labels are tracked 0.06em and stay in sentence case; nothing in the system is set in capitals.

**The Sounding Rule.** A figure on the chart is a sounding: serif italic with tabular lining numerals, so columns of numbers align and values read as measured, not decorated.

## Layout

The page is a single sheet inset from the viewport by a fluid gutter (`clamp(1rem, 0.4rem + 2.6vw, 2.5rem)`) and at least the viewport tall, its sea ground ruled by the graticule (`--graticule`). Inside it, a head row carries the back link and the theme toggle, then the content.

Atlas pages use a two-column grid from 60rem: the plate column (`minmax(0, 1fr)`) and a margin column (`minmax(17rem, 23rem)`), gap 2.5rem. Above the plate, the title row holds the sheet title and lede on the left and, on the home, the Position field to their right; the field never covers the land. The margin stacks the compass rose (`--rose-size`), an optional lead block, the indicator field, and the notes (legend, source, scope note). On the home, a second row places the measured bearings under the plate and "Outras cartas" under the margin. Below 60rem the grid becomes one column, the compass moves into the plate's top-right corner (`--rose-size-small`), and the legend stays directly under the map before any lead block. Below 40rem the plate drops its SVG lettering, fact tables restack into labelled blocks, and bearings turn vertical.

The plate is sized to fit the first screen: SVG height capped at `max(24rem, 100dvh - 15rem)`. Every map is followed by its table alternative (32rem scroll cap, sticky header, or uncapped where the table is the content). Prose and reading pages cap at 52rem with a 68ch measure.

Spacing is a 4px-based scale with visibly different steps (0.25, 0.5, 0.75, 1, 1.5, 2.5rem). Panel padding is 0.75rem by 1rem; lead blocks 1rem; list rows 1rem block padding. Controls are at least 2.75rem tall. Breakpoints: 40rem (phone) and 60rem (two-column chart).

## Elevation & Depth

The sheet is flat print. Depth comes from rules, tint and overprint: panels are the sea ink framed by a rule, the active row takes the shoal tint, the active shape takes a magenta overprint. A single shadow exists, and only for things that float over the plate while you use them.

### Shadow Vocabulary
- **Sheet lift** (`box-shadow: 0 1px 0 var(--color-line), 0 10px 24px -12px color-mix(in srgb, var(--ink-black) 35%, transparent)`): the map tooltip and the Position search results, which lie over the plate without shifting layout.

### Named Rules
**The Printed Sheet Rule.** Nothing at rest casts a shadow. A shadow means "this is lying on top of the map right now"; panels, cards and buttons are ruled, not lifted.

## Shapes

Every corner is square (`--radius: 0`); inputs, selects and buttons set it explicitly. Form is drawn with two rule weights: a hairline (1px) for panels, tables, tooltips and separators, and a neat rule (2px) for the sheet neatline, the Position field, chart buttons, the lead block and the bearings. The sheet's frame is a double neatline: 2px outer, 1px inner inset 0.5rem. Dashed strokes belong to the bearing (2px dashed magenta). Map strokes use non-scaling strokes with round joins. Interface glyphs (sort arrows, back chevron) are drawn as single-stroke 1.4px SVG paths in `currentColor` at 0.7em.

## Components

### Buttons
Quiet chart controls; magenta is spent on the one action that matters.
- **Shape:** square (0), 2.75rem minimum height and width.
- **Chart button:** sea ground, black ink, 2px deep-blue rule, label type, 0.5rem by 1rem. Hover: shoal tint. Used for the national map's load, zoom and reset.
- **Theme toggle:** same type and ground with a 1px rule; hover inverts to deep blue with sea text over 160ms. Labelled "Carta de noite" / "Carta de dia"; hidden until its script runs.
- **Primary action:** solid magenta with sea text (night: `on-magenta-night`), label type, no border, 0.5rem by 1rem. Hover: deep blue. One per surface (the home twin entry).
- **Focus:** a 2px magenta outline offset 3px on every focusable element; inset (-3px) on list rows.

### Inputs / Fields
- **Position search:** the first-class field. Sea ground, 2px deep-blue rule, square, lede-size serif text, italic note-ink placeholder, a condensed label above. Results drop as a floating list (hairline rule, sheet lift) over the map; each row is name plus UF code, with a magenta "gêmeos" shortcut set off by a hairline divider. Hover/focus row: shoal tint.
- **Select (indicator):** sea ground, 1px rule, square, body serif, label above.
- **Checkboxes (twin axes):** native, 1.25rem, magenta accent, 2.75rem row height.

### Cards / Containers
- **Corner Style:** square.
- **Background:** sea, the same as the sheet.
- **Shadow Strategy:** none (see Elevation).
- **Border:** notes and tables 1px deep blue; callouts 1px magenta; the home lead block 2px deep blue.
- **Internal Padding:** 0.75rem by 1rem for notes and callouts; 1rem for the lead block.
- **Lead block content:** a headline, one sentence in body small, and the magenta action. No icon or pictogram above the heading.

### Navigation
The back link (label type, drawn chevron) sits top left of the sheet head, the theme toggle top right. On the home, "Outras cartas" is a list of magenta links, each followed by one note-ink line. Other atlas pages keep a plain row of links separated by middots inside the notes block.

### Map Plate (signature)
Server-drawn SVG, readable without JavaScript. Shapes are filled by scale class with deep-blue non-scaling outlines; colour changes ease over 480ms. Small shapes carry only the abbreviation; larger ones add a sounding. Hover, focus or the matching table row raise a magenta overprint outline drawn on top. A floating tooltip names the shape and its sounding. The compass rose, the chart's one magenta ornament, sits in the margin or the plate corner. The canvas national map draws the same inks, read from the tokens at draw time.

### Legend and Notes (signature)
A ruled notes block headed "Legenda": seven swatches (1.5rem by 0.9rem, hairline framed) with italic sounding ranges, the hatched "sem dado" swatch when needed, then the source and reference year in caption type, and the scope note.

### Bearing (signature)
A measured twin pair: two names with their UF codes joined by a 2px dashed magenta line (overprinted), the distance set on the line as an italic magenta sounding cut out of the dash by a sea ground. The whole pair links to the comparison; hover underlines the names in magenta. A note-ink line under it states one resemblance. Below 40rem the bearing runs vertically down a gutter between the two names.

### Share Card
The sheet as a 1200 by 630 raster, day inks only. Sea ground, a 2px deep-blue neatline inset 24px, content inside a 64px margin. Left column: the place name as the title in the serif at 600 (110px, stepping down to 56px for long names so it holds two lines), a serif subtitle in note ink, then figures (label-face caption in note ink over a serif 600 italic value in deep blue, a sounding as on the site), and at the foot a sign-off "Brasil em Mapas · Fonte: IBGE" in the label face at 600 in note ink. Right column: the shape on land ink with deep-blue outlines, the place itself in magenta. Brand and source sign off at the foot; nothing sits above the title.

### Motion
Navigation pastes the next sheet over the current one: a cross-document view transition revealing the new page left to right by clip-path over 480ms with `cubic-bezier(0.16, 1, 0.3, 1)`. Content that appears after an action (twin results, comparisons, the chosen municipality) rises 10px and fades in with GSAP, within 600ms. Content present at load is never animated. All motion is off under `prefers-reduced-motion: reduce`.

## Do's and Don'ts

### Do:
- **Do** put every page on the sheet: double neatline, sea ground, graticule, back link and theme toggle in the head.
- **Do** take colour, type and space only from `src/styles/tokens.css` semantic tokens, and define both day and night values for anything new.
- **Do** read inks from the tokens in canvas or raster code too, and fail loudly when one is missing.
- **Do** reserve magenta for what is active or actionable, and overprint it (`--overprint-blend`) when it lies on the plate.
- **Do** set every figure as a sounding: serif italic, tabular lining numerals, formatted with `Intl` in pt-BR.
- **Do** follow every map with a legend, a "Fonte: IBGE" line with the reference year, and a table alternative.
- **Do** draw missing data as the hatched land ink and label it "sem dado".
- **Do** keep corners square and choose between the 1px hairline and the 2px neat rule.
- **Do** keep controls at least 2.75rem tall with the 2px magenta focus ring visible.

### Don't:
- **Don't** add a hex, grey or tint outside the ink set in a component or a script fallback; ask which ink role it is.
- **Don't** lay out a choropleth beside a panel of KPI cards, or use government-portal or flag green-and-yellow styling.
- **Don't** round corners or lift panels with shadows; the sheet lift is only for things floating over the plate.
- **Don't** fill a shape with magenta to mean "high"; magenta is state, the blue scale is value.
- **Don't** fill surfaces with gradients; in this system gradients only draw rules (the graticule and the hatch).
- **Don't** set labels in capitals or add small tracked kickers above headings, on pages or share cards; labels are sentence-case condensed sans.
- **Don't** put an icon or pictogram above a block heading; a block is a heading, its text and its action.
- **Don't** animate content that is present at load, or exceed 600ms.
