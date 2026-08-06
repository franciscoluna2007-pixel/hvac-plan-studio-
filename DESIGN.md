---
name: "HVAC Plan Studio - Material Cobalt"
description: A calm, premium-modern plan-first drafting workspace with dimensional neutral surfaces and one disciplined cobalt interface accent.
colors:
  Plan White: "#FFFFFF"
  Material Shell: "#EDF0EE"
  Material Panel: "#FBFCFB"
  Material Muted: "#E3E7E4"
  Graphite Ink: "#202421"
  Muted Ink: "#667069"
  Cobalt: "#002FA7"
  Cobalt Hover: "#00288F"
  Cobalt Pressed: "#001F73"
  Cobalt Soft: "#E9EFFF"
  Confirmation: "#39705D"
  Warning: "#A77A28"
  Critical: "#A63E32"
typography:
  interface: Geist Sans 400/500/600/700
  technical: Geist Mono 500/600/700
rounded:
  control: 7-8px
  panel: 12px
  dialog: 16px
spacing:
  unit: 4px
  compact: 8px
  control: 12px
  panel: 16px
  section: 24px
motion:
  feedback: 100-140ms
---

# HVAC Plan Studio - Material Cobalt

## Accepted production direction

The selected **Material** Traverse variant is the production visual specification. The desktop composition is the north star; tablet and mobile continue the same hierarchy with progressive drawers and touch-sized controls.

The product remains a daily-use HVAC drafting tool for one-person contractors and superintendents. It should feel premium-modern, calm, direct, and legible rather than decorative or promotional.

## Product thesis

The source plan is the work. Application chrome should make the plan easier to operate without competing with it.

The core workflow remains:

1. Open Plan
2. Draw HVAC
3. Materials
4. Export

Plan Check remains compact, optional, and advisory. No helper may block Materials or Export.

## Frozen behavior boundary

This is a presentation integration only. The following must not change:

- Supply, return, and fresh-air run behavior.
- Supply and return diffusers, terminals, equipment, fittings, and T Branches.
- Press-drag-release placement and selected-trunk splitting.
- Direct object drag and one-Undo restoration.
- Fitting rotation, connection repair, snap, and completion rules.
- Cursor-centered ordinary wheel zoom.
- Right-click connected-assembly Copy, repeated paste, and Escape exit.
- Redline order, behavior, and pen-like square/circle trails.
- Canvas geometry, paint order, pointer lifecycle, reducers, and controllers.
- Saved-plan data, serialization, reload persistence, and existing labels.

## Material palette

| Token | Value | Use |
| --- | --- | --- |
| `--material-plan` | `#FFFFFF` | Source PDF and plan sheet only |
| `--material-shell` | `#EDF0EE` | Application field |
| `--material-panel` | `#FBFCFB` | Tool, inspector, dialog, and command surfaces |
| `--material-panel-muted` | `#E3E7E4` | Recessed chrome and canvas surround |
| `--material-line` | `#D7DDD8` | Default divider and control border |
| `--material-line-strong` | `#AAB3AC` | Strong structural divider |
| `--material-ink` | `#202421` | Primary interface text |
| `--material-muted` | `#667069` | Supporting labels and metadata |

Surfaces are refined neutrals with shallow functional depth. There are no gradients, glows, fake metal textures, oversized rounded cards, or glassmorphism.

## Interface accent

| Token | Value | Use |
| --- | --- | --- |
| `--material-blue` | `#002FA7` | Logo mark, primary actions, active navigation, selection, focus |
| `--material-blue-hover` | `#00288F` | Primary hover |
| `--material-blue-pressed` | `#001F73` | Primary pressed |
| `--material-blue-soft` | `#E9EFFF` | Selected row and secondary active state |
| `--material-blue-line` | `#A9BCEE` | Quiet active/hover border |

White text on Cobalt is the primary filled action treatment. Cobalt text on Plan White or Cobalt Soft is used for selected secondary controls. Disabled controls reduce contrast and retain their disabled semantics rather than appearing active.

Focus uses a three-pixel Cobalt outline with a two-pixel offset. Focus is never indicated by color alone; native focus placement, text, icon, and selected structure remain visible.

## Domain color boundary

Cobalt is the interface accent, not a blanket recolor. These established meanings remain separate:

- Supply remains the existing supply blue.
- Return remains the existing return red.
- Fresh air remains the existing green.
- T Branch/fitting and caution indicators retain their existing domain colors.
- Redline retains its red identity and canvas paint order.
- Connected/saved/ready remains confirmation green.
- Warning remains mustard/amber.
- Error and critical remain red.

The Material layer must not change saved drawing color values, SVG strokes/fills, the source PDF, or any semantic data.

## Typography

Use the self-hosted Geist Sans for interface text and Geist Mono for technical measurements and tabular values.

| Role | Treatment |
| --- | --- |
| Product identity | 16px, 760, tight tracking, Cobalt |
| Workflow destination | 12px, 680, sentence case |
| Panel heading | 12-14px, 650-700 |
| Tool label | 13px, 600-680 |
| Body and guidance | 12-15px, 1.45-1.6 line height |
| Technical value | Geist Mono, tabular numerals |

Controls must never fall back to browser-default typography. Copy stays direct and uses existing product labels.

## Composition

### Desktop

- A 72px premium job bar holds identity, job context, save state, search, saved jobs, Undo, and Save.
- A 52px segmented Traverse workflow sits above the working row.
- The workflow starts with Open Plan, Draw HVAC, Materials, and Export in that exact order.
- Secondary Symbols, Selected, Layers, Redline, and Display controls follow without displacing the core four.
- Tool and detail surfaces flank the source plan only while open.
- The plan remains the largest region.
- Tool and inspector panels use 12px structural rounding and shallow shadows.
- The source plan remains exact white with slightly stronger elevation than the surrounding chrome.

### Tablet

- The 64px job bar and horizontal workflow remain visible.
- The canvas occupies the full working width.
- Tool and inspector surfaces become left/right drawers above the canvas.
- Drawers use a quiet scrim and preserve all controls and keyboard semantics.
- Touch controls are at least 48px where coarse input is detected.

### Mobile

- The job bar reduces to 58px without changing the logo or wording.
- The core workflow remains first in a horizontally scrollable 58px strip.
- Secondary workflow icons remain reachable after the core actions.
- Tool and inspector drawers use the full viewport width.
- The source plan stays in bounds and visually dominant when drawers are closed.
- Materials, Export, and Plan Check remain reachable without helper gating.

## Component treatments

### Logo and job bar

Keep the existing DraftingCompass shape and HVAC Plan Studio / Draw & Detail wording. The mark uses Cobalt with a white icon; the product name uses Cobalt on the light job bar. This is a color treatment only, not a logo redesign.

### Workflow navigation

Core destinations use numbered labels and sentence-case text. The active destination uses a Cobalt fill with white text. Hover uses Cobalt Soft. Redline active uses its established red, not Cobalt.

### Tool dock

Tool rows use neutral panels and eight-pixel control rounding. Selected tools use Cobalt Soft plus a Cobalt structural edge. Supply, return, fresh-air, fitting, and other domain icons retain their existing semantic colors.

### Canvas and toolbar

Toolbar controls use neutral surfaces and shallow borders. Active interface controls use Cobalt Soft and a Cobalt rule. The canvas surround is neutral gray-green; the source PDF remains exact white and unfiltered.

### Materials

Materials remain an operational inspector and Finish-the-Job step using real plan-derived rows. Grouping comes from open rows, fine dividers, technical values, and restrained neutral surfaces—not a wall of cards.

### Export / Finish the Job

The existing Finish-the-Job flow remains intact. The studio uses a white Material surface, clear step rail, Cobalt progress/primary actions, confirmation green for current review, and established warning/critical colors for holds.

### Plan Check

Plan Check remains a compact strip and optional sidecar. It uses the same Material surfaces and Cobalt primary review action. Status counts, warnings, issue markers, and source-backed content retain their established meaning.

### Project Home

Project Home uses the real Open Plan workflow and saved-job content. The hero is spacious but operational. Existing plan choices, recent jobs, current-job context, and workflow preview remain intact. No fake jobs or marketing-only content may be introduced.

## State and motion rules

- Default: neutral panel, readable ink, clear border.
- Hover: Cobalt Soft or stronger neutral border, never layout movement.
- Active/selected: Cobalt fill for primary navigation or Cobalt Soft with a structural rule for secondary selection.
- Focus: three-pixel Cobalt outline, two-pixel offset.
- Pressed: one-pixel downward feedback and darker Cobalt for filled primary controls.
- Disabled: reduced opacity and disabled cursor; no active blue treatment.
- Saved/connected: confirmation green with label/icon.
- Warning: mustard with label/icon.
- Error/critical/Redline: established red with label/icon.

Motion is limited to 100-140ms interaction feedback. There is no ambient animation. Reduced-motion mode removes nonessential transition duration.

## Craft floor

- Keep icon sizes and strokes optically aligned.
- Keep spacing on the four-pixel system.
- Avoid excessive cards, excessive rounding, decorative textures, and marketing-page styling.
- Keep all default, hover, active, focus, disabled, and selected states legible.
- Preserve the exact plan-white boundary at every viewport.
- Preserve desktop composition quality when adapting to tablet and mobile.
- Never trade canvas area for nonessential helper chrome.
