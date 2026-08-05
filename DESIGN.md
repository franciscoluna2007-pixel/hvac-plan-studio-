---
name: "HVAC Plan Studio - Galvanized Daylight"
description: A plan-first HVAC drafting workspace framed like a clean, sunlit duct-fabrication bench.
colors:
  Plan White: "#FFFFFF"
  Daylight Shell: "#F3F5F2"
  Galvanized Plate: "#B8C0BC"
  Galvanized Light: "#DCE1DE"
  Graphite Ink: "#202522"
  Deep Graphite: "#343A37"
  Safety Orange: "#D85B27"
  Forest Confirmation: "#39705D"
  Oxide Critical: "#A63E32"
  Muted Mustard: "#A77A28"
typography:
  chrome: Barlow Condensed 600/700/800
  body: Geist Sans 400/500/600
  technical: Geist Mono 500/600/700
rounded:
  control: 2px
  panel: 3px
  dialog: 4px
spacing:
  unit: 4px
  compact: 8px
  control: 12px
  panel: 16px
  section: 24px
motion:
  standard: 150ms
---

# HVAC Plan Studio - Galvanized Daylight

## Accepted visual direction

Concept A, **Galvanized Daylight**, is the production visual specification. This document records the durable tokens, component families, and responsive rules extracted from the approved concept board.

The board defines one coherent family across the desktop workspace, tablet continuation, mobile continuation, job-opening dialog, selected T Branch state, inspector, and active Redline pen-tip state. Implementation must read as the same product at every viewport, not as a desktop theme followed by generic responsive fallbacks.

## North star

HVAC Plan Studio should feel like a clean duct-fabrication bench in clear daylight. The source plan is the white workpiece. Graphite framing holds the job context and high-frequency tool dock. Galvanized plate organizes commands and inspection. Safety Orange marks the active operation and primary forward action.

Industrial character comes from precise seams, etched dividers, shallow pressed controls, compact labels, and low-glare surfaces. It does not come from fake screws, glossy metal, decorative gauges, distressed textures, or workshop props.

The source plan remains the visual authority. It is exact white, visually dominant, and untouched by the interface material system.

## Frozen acceptance criteria

This is a presentation-only visual replacement. The following are frozen and must not change:

- Drawing handlers and pointer lifecycle.
- Canvas geometry, zoom, pan, and drawing preview geometry.
- Reducers, state transitions, undo behavior, and redo behavior.
- Save and reload persistence.
- Redline pen-tip behavior, including continuous square/circle stamp trails.
- Redline remaining below HVAC runs, symbols, fitting previews, and T Branch tools.
- HVAC paint order and plan layer order.
- Placement, connection, snap, and completion rules.
- T Branch size, rotation, fitting, preview, and connection behavior.
- Data model, serialized project shape, and saved user data.
- Existing workflow destinations, workflow order, labels, and meaning.

The product remains **HVAC Plan Studio**. The drafting workspace remains **Draw & Detail**. Redline remains an internal workspace.

## Color tokens

### Structural palette

| CSS token | Value | Use |
| --- | --- | --- |
| `--galv-plan` | `#FFFFFF` | Source plan/PDF only; never tint or texture |
| `--galv-daylight` | `#F3F5F2` | Application field, dialog body, neutral light controls |
| `--galv-plate` | `#B8C0BC` | Galvanized workspace frame, inspector shell, structural bands |
| `--galv-plate-light` | `#DCE1DE` | Toolbar faces, raised secondary controls, ledger rows |
| `--galv-plate-dark` | `#929C97` | Recessed edges, inactive hardware, stronger seams |
| `--galv-ink` | `#202522` | Primary text, rules, dark icon strokes |
| `--galv-graphite` | `#343A37` | Job bar, tool dock, dark structural rails |
| `--galv-graphite-deep` | `#171B19` | Deepest header/tool contrast and pressed states |
| `--galv-muted` | `#5D6863` | Secondary labels and metadata on light surfaces |
| `--galv-on-dark` | `#F7F8F5` | Text and icon color on graphite surfaces |

### Interaction and semantic palette

| CSS token | Value | Use |
| --- | --- | --- |
| `--galv-orange` | `#D85B27` | Active destination, active tool, primary action, current workflow index |
| `--galv-orange-deep` | `#A94018` | Orange border, pressed active state, strong contrast edge |
| `--galv-orange-soft` | `#F7D8C8` | Selected row wash and non-obscuring active cue |
| `--galv-forest` | `#39705D` | Saved, ready, connected, approved |
| `--galv-oxide` | `#A63E32` | Error, destructive action, Redline identity edge |
| `--galv-mustard` | `#A77A28` | Needs review, caution, unresolved state |
| `--galv-focus` | `#0E5A75` | Keyboard focus where orange would not provide enough distinction |

Safety Orange is the dominant interaction accent. Forest, Oxide, and Mustard report state; they are not alternate navigation colors. Color is never the only state cue. Active, saved, warning, selected, and blocked states also use text, an icon, a border/notch, or a structural position marker.

### Plan-color boundary

The visual theme does not rewrite saved drawing colors or canvas semantics. Existing supply, return, fresh-air, Redline, and selection rendering remains data- and canvas-controlled. Chrome colors may frame those states, but CSS must not recolor the source PDF or alter the SVG layer order.

## Typography

Use the already self-hosted **Barlow Condensed** family for compact operational chrome. Use **Geist Sans** for explanatory copy and forms. Use **Geist Mono** for measurements and technical values.

| Role | Family | Weight | Size / line height | Treatment |
| --- | --- | --- | --- | --- |
| Product identity | Barlow Condensed | 800 | 20px / 18px | Uppercase, `0.015em` tracking |
| Workspace identity | Barlow Condensed | 600 | 11px / 12px | Uppercase, muted on dark |
| Destination tab | Barlow Condensed | 700 | 12px / 14px | Uppercase, `0.035em` tracking |
| Tool label | Barlow Condensed | 700 | 11px / 13px | Uppercase on the compact dock |
| Panel heading | Barlow Condensed | 700 | 13px / 16px | Uppercase, `0.04em` tracking |
| Workflow label | Barlow Condensed | 700 | 13px / 15px | Uppercase, direct field language |
| Body / guidance | Geist Sans | 400-600 | 12-14px / 17-20px | Sentence case |
| Form label | Geist Sans | 600 | 11-12px / 15px | Sentence case or short uppercase label |
| Technical value | Geist Mono | 500-700 | 10-13px / 15-18px | Tabular numerals |
| Status metadata | Geist Mono | 500 | 10-11px / 14px | Compact, never below 10px desktop |

Buttons, tabs, inputs, inspector rows, status bars, toolbars, and dialog actions receive explicit typography. No control may fall back to browser-default button or input type.

## Spacing and dimensions

The base spacing unit is **4px**. Approved steps are `4, 8, 12, 16, 20, 24, 32`.

- Desktop job bar: `52px`.
- Desktop destination rail: `34px` below the job bar and above the working row.
- Desktop workflow traveler: `76px`.
- Desktop status strip: `30px`.
- Desktop tool dock: `168px` target, `152px` compact minimum.
- Desktop inspector: `304px` target, `272px` compact minimum.
- Desktop canvas toolbar: `46px` minimum, wrapping or horizontal scrolling only when required by existing controls.
- Tablet destination rail: `44px` with touch-sized hit areas.
- Mobile job bar: `48px`.
- Mobile destination/workflow controls: `48px` minimum target.
- Mobile bottom command bar: `56px` plus safe-area inset.

Panels use `8px` internal compact gaps, `12px` control padding, and `16px` section padding. Dense tool and inspector rows use one full-height separator rather than multiple nested containers.

## Surfaces and materials

### Graphite surfaces

The job bar and high-frequency desktop tool dock use matte Deep Graphite/Graphite. They may use an extremely low-contrast linear seam pattern, but no image texture, gloss, glow, or color gradient. Labels remain sharp white or light gray.

### Galvanized surfaces

Destination navigation, canvas command surfaces, inspector shells, traveler, status frame, dialogs, and drawers use Galvanized Plate and Galvanized Light. The material is expressed with:

- One-pixel structural seams.
- A light inset top edge.
- A slightly darker lower edge.
- Sparse, regular etched ticks only at structural boundaries.
- Flat color fields rather than photographed metal.

### Plan surface

The source plan/PDF is exact `#FFFFFF`. No grain, opacity wash, blend mode, filter, off-white background, or galvanized pattern may cross the plan boundary.

## Borders, radii, and elevation

| Token | Value | Use |
| --- | --- | --- |
| `--galv-line` | `1px solid rgba(32,37,34,.55)` | Primary structural seam |
| `--galv-line-soft` | `1px solid rgba(32,37,34,.22)` | Internal row and toolbar divider |
| `--galv-line-dark` | `1px solid #171B19` | Graphite surface boundary |
| `--galv-radius-control` | `2px` | Buttons, tabs, inputs |
| `--galv-radius-panel` | `3px` | Dock, inspector, canvas frame, drawer |
| `--galv-radius-dialog` | `4px` | Dialog shell only |
| `--galv-raised` | `inset 0 1px rgba(255,255,255,.72), 0 1px 0 rgba(32,37,34,.24)` | Raised membrane control |
| `--galv-pressed` | `inset 0 2px 3px rgba(23,27,25,.28)` | Pressed or active control |
| `--galv-panel-shadow` | `0 8px 22px rgba(23,27,25,.22)` | Drawer or dialog separation only |

Avoid pills, floating dashboard cards, large soft shadows, bevel stacks, and large rounded containers. Depth is shallow and mechanical.

## Icon treatment

- Reuse the existing Lucide icon components and their established metaphors.
- Desktop chrome icons: `15-18px`, `1.8-2.2px` stroke.
- Mobile/touch icons: `18-20px`, never smaller than the existing accessible target permits.
- Default dark-surface icon: `--galv-on-dark`.
- Default light-surface icon: `--galv-ink`.
- Active icon: white on Safety Orange or Safety Orange with a structural left/top notch.
- Redline icon: Oxide only when paired with the written Redline label.
- Saved/connected: Forest plus a check/dot and written status.
- Warning: Mustard plus warning icon and written explanation.
- Disabled: lower contrast plus disabled cursor and existing disabled semantics.

Icons remain optically centered with consistent stroke weight. Do not replace the current product metaphors with generic text glyphs or decorative pictograms.

## Component families

### Graphite job bar

A 52px matte Graphite bar containing the existing HVAC Plan Studio identity, Draw & Detail identity, current job context, save state, Find a tool, and saved-job actions. The brand mark and primary save/action emphasis use Safety Orange. It is operational chrome, not a marketing header.

### Horizontal destination rail

The existing destinations remain in their exact order: Job, Draw, Symbols, Selected, Review, Layers, Redline, Display. On desktop they form one compact Galvanized horizontal rail below the job bar. The active destination uses an Orange fill or top rule plus stronger type and existing pressed/current semantics.

### Graphite tool dock

The existing plan-tool panel becomes a compact Graphite dock. Tool rows retain their icons, labels, active state, disabled state, and click behavior. Active tools receive Orange structure; Redline retains an Oxide identity cue. Complex tool sections remain scrollable and readable rather than being removed or simplified.

### Galvanized canvas command surface

The existing canvas toolbar uses light galvanized membrane controls, one-pixel separators, explicit condensed labels, and Mono values. Undo, redo, save, select/grab, zoom, fit, width, rendering quality, grid, snap, CFM, length, T Branch text, sheets, Redline, page, scale, and calibrate retain their existing functions and order.

### Plan frame

The canvas frame uses a narrow Galvanized seam around the exact-white plan. The plan remains the largest region at every viewport. Existing interaction overlays stay in their current stack and geometry.

### Inspector ledger

The right inspector uses Galvanized Light rows on a Plate shell, open section dividers, dark headings, and Mono technical values. Selected state uses an Orange rule/notch plus written selection context. Validation remains paired with text and icons.

### Workflow traveler

The existing five stages remain Plan Setup, Draw & Detail, Airflow & Sizes, Fix Plan, and Finish the Job. The current stage uses an Orange numbered block and Orange top/border cue. Complete stages combine their existing completion meaning with Forest/check structure. Continue remains the primary Orange forward action.

### Status strip

A compact Galvanized strip reports readiness, source, scale, snap, CFM, length, save, and other existing metadata. Ready/Saved uses Forest plus plain text. Technical values use Geist Mono.

### Dialogs and command surfaces

Job opening, Guided Setup, command search, Redline surfaces, drawers, and other existing modal/sheet experiences use Plate headers, Daylight bodies, squared rows, and restrained dialog shadow. Primary actions use Orange. Redline dialogs add an Oxide identity edge without changing Redline behavior.

### Fields and controls

Inputs and selects use Daylight or Plan White, a Graphite rule, `2px` radius, explicit Geist/Mono typography, and a visible focus outline. Active segmented controls use Orange plus a position/border cue. Destructive controls use Oxide only with their existing label/icon.

## Responsive rules

### Desktop: 1360px and wider

- Job bar above a horizontal destination rail.
- Working row contains Graphite tool dock, flexible plan, and Galvanized inspector.
- Workflow traveler and status strip remain full width below the workspace.
- Narrow tool/inspector chrome before reducing the usable plan.
- The plan remains the largest region.

### Compact desktop: 1100-1359px

- Retain the horizontal destination rail.
- Keep one supporting panel visible and convert the other to the existing drawer behavior when space requires it.
- Preserve current tool, selection, placement state, and plan viewport when a panel opens or closes.
- Toolbar may scroll horizontally; it must not clip primary controls.

### Tablet

- Keep a compact dark job bar and a horizontal destination strip.
- Make tools a left opaque drawer and inspector a right opaque drawer.
- Preserve the same destinations, labels, order, active state, and workflow meaning.
- Keep Undo, Redo, Save, active tool, zoom, sheet, and scale reachable with at least `48px` touch targets.
- Drawers do not clear selection, active tool, branch preview, placement state, or viewport.

### Mobile

- Use a 48px Graphite job bar.
- Preserve the plan as the dominant full-height surface.
- Use a compact workflow strip near the top and the existing horizontal/bottom command treatment near the safe area.
- Tools and inspector use opaque full-height or high bottom sheets with sticky headers/actions.
- Keep Undo and the current workflow stage visible or immediately reachable.
- Minimum interactive target is `48px`; labels remain present for primary tools.
- Never simplify or rename the data model or workflow for mobile.

## Motion and focus

Use `150ms` for color, border, opacity, drawer entry, and a maximum `1px` press translation. No bounce, spring, ambient motion, sweeping highlights, or animation that implies geometry movement.

Keyboard focus uses a `2px` `--galv-focus` outline with `2px` offset. On the Graphite bar/dock, add a light inner keyline when needed. Honor `prefers-reduced-motion` by removing nonessential transitions while preserving all state cues.

## Implementation boundary

Approved presentation files may change: theme data attributes, layout metadata, `DESIGN.md`, CSS, and presentation-only JSX needed to place existing controls into the approved visual hierarchy.

Do not change drawing/controller/domain files, pointer handlers, reducers, persistence modules, Redline domain behavior, drawing serialization, HVAC SVG order, branch math, placement rules, or data types. Existing handlers may remain attached to their existing controls; visual repositioning must not create a second behavior path.

## Do

- Keep the source plan exact white and visually dominant.
- Use Orange as the single dominant action/selection accent.
- Keep the job bar and tool dock Graphite.
- Keep navigation, toolbar, inspector, traveler, dialogs, and drawers galvanized and low-glare.
- Use compact condensed chrome typography and Mono measurements.
- Use squared controls, hard seams, and restrained shallow depth.
- Pair every semantic color with text and a structural cue.
- Preserve layer order and all frozen interaction behavior.

## Do not

- Do not tint, texture, warm, fade, or distress the plan/PDF.
- Do not reintroduce kraft paper, Prussian-blue identity, or the Patternmaker material world.
- Do not use neon, glow, purple, glass, gaming HUD styling, decorative dashboards, or excessive cards.
- Do not use glossy metal, fake screws, ornamental gauges, or workshop props.
- Do not rename, add, remove, or reorder workflows or destinations.
- Do not alter geometry, persistence, Redline behavior, HVAC paint order, placement, T Branch behavior, undo, or the data model.
