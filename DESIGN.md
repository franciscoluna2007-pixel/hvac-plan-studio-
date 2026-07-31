---
name: HVAC Plan Studio Field Command Console
description: A precise, calm, and operational interface for professional HVAC planning over source PDFs.
colors:
  Plan Navy: "#07111f"
  Control Navy: "#0d1b2d"
  Raised Navy: "#12243a"
  Structural Line: "#203752"
  Working Ink: "#dbe6f5"
  Muted Steel: "#708198"
  Signal Cyan: "#2ccce4"
  Branch Gold: "#f7b733"
  Critical Coral: "#f0525a"
  Approval Green: "#35c98b"
  Attention Orange: "#ff8a3d"
typography:
  primary: Geist Sans
  technical: Geist Mono
rounded:
  compact: 5px
  control: 6px
  card: 8px
  workspace: 16px
  pill: 999px
spacing:
  unit: 4px
  compact: 8px
  control: 12px
  panel: 16px
  section: 24px
components:
  Primary Action:
    backgroundColor: Signal Cyan
    textColor: Plan Navy
    typography: Geist Sans 700
    rounded: 6px
    padding: 8px 12px
    height: 32px
  Branch Action:
    backgroundColor: Branch Gold
    textColor: Plan Navy
    typography: Geist Sans 800
    rounded: 5px
    padding: 8px 12px
    height: 32px
  Tool Row:
    backgroundColor: Raised Navy
    textColor: Working Ink
    typography: Geist Sans 600
    rounded: 6px
    padding: 8px 10px
    height: 41px
  Property Input:
    backgroundColor: Control Navy
    textColor: Working Ink
    typography: Geist Sans 500
    rounded: 5px
    padding: 6px 8px
    height: 31px
  Status Chip:
    backgroundColor: Raised Navy
    textColor: Working Ink
    typography: Geist Sans 800
    rounded: 999px
    padding: 4px 8px
---

# HVAC Plan Studio — Field Command Console

## Overview

HVAC Plan Studio is a **Field Command Console**: precise, calm, and operational. It should feel like dependable professional equipment placed beside the source plan—not a dashboard competing for attention and never gaming software or generic office software.

The visual system combines **Layered Control Surfaces** with selective **Raised Instrument Panels**. Everyday structure comes from deep navy tonal layers and crisp borders. Depth, glow, and tactile highlights are reserved for the active tool, the current decision, and temporary workspaces that sit above the plan. Components are compact and confident so experienced users can move quickly without losing clarity.

The source PDF remains the visual authority. Interface chrome frames the work, HVAC geometry remains legible above Redline, and color communicates purpose rather than decoration. Signal Cyan identifies primary interaction, Branch Gold belongs to T/Y work, Critical Coral marks blockers, and Approval Green confirms safe completion.

## Colors

### Core surfaces

| Token | Value | Use |
| --- | --- | --- |
| **Plan Navy** | `#07111f` | App background, deepest canvas-adjacent surface |
| **Control Navy** | `#0d1b2d` | Side panels and standard control surfaces |
| **Raised Navy** | `#12243a` | Active rows, elevated controls, selected regions |
| **Structural Line** | `#203752` | Panel divisions, control borders, quiet structure |
| **Working Ink** | `#dbe6f5` | Primary text and high-value labels |
| **Muted Steel** | `#708198` | Secondary text, metadata, inactive tools |

### Operational signals

| Token | Value | Meaning |
| --- | --- | --- |
| **Signal Cyan** | `#2ccce4` | Primary action, active tool, keyboard focus |
| **Branch Gold** | `#f7b733` | T/Y branch creation and branch-specific decisions |
| **Critical Coral** | `#f0525a` | Errors, release blockers, destructive warnings |
| **Approval Green** | `#35c98b` | Confirmed, connected, reviewed, or ready |
| **Attention Orange** | `#ff8a3d` | Caution or unresolved attention that is not yet a blocker |

Signal colors must carry a label, icon, pattern, or state change as well as hue. Never use Signal Cyan and Branch Gold interchangeably: cyan means general control; gold means branch work. Keep the source PDF neutral and readable beneath overlays.

## Typography

Use **Geist Sans** for the interface and **Geist Mono** for measurements, identifiers, coordinates, calculated values, and other data that benefits from fixed-width alignment.

- Page and workspace titles: 17–25px, 700–800 weight, compact line height.
- Panel headings: 10–12px, 700 weight.
- Working labels and controls: 10–13px, 500–700 weight.
- Metadata and dense technical labels: 8–10px, 600–800 weight, uppercase only when the label is short.
- Hero or first-run messaging: may scale from 28–46px, but does not belong in daily plan controls.

Uppercase labels use deliberate tracking around `0.5px–1.25px`. Avoid long uppercase sentences. Favor plain field language: “Place branch,” “Needs review,” and “Ready to issue” over abstract product terminology.

## Layout

The desktop shell is an operating console around a plan-first center:

- A 68px top bar holds project identity and global actions.
- A 228px left panel holds tools and symbol choices.
- The plan canvas occupies the flexible center and never shrinks below a practical working width when space allows.
- A 252px right panel holds properties; focused review work may expand it to 360px.
- A 28px status area communicates source, scale, save, and readiness state without obscuring the plan.

Use a 4px base spacing unit. Dense controls typically use 8–12px internal spacing, panels use 16px, and major sections use 24px. Keep related action and evidence close together. Preserve clear separation between choosing a tool, placing work, editing properties, and approving consequential changes.

At narrower widths, panels collapse before the plan becomes unusable. Field mode prioritizes a single canvas column, touch-safe targets, and the current action. Design for desktop, tablet, touch, and stylus; do not treat mobile as a shrunken desktop console.

## Elevation & Depth

Default surfaces use **Layered Control Surfaces**: tonal navy steps, one-pixel structural borders, and subtle inset highlights. This keeps long work sessions calm and leaves the plan visually dominant.

Use **Raised Instrument Panels** selectively for active workflows, dialogs, command surfaces, and decisions that temporarily sit above the plan. Raised surfaces may use brighter edge highlights, a controlled gradient, and a shadow such as `0 24px 80px #0009`. Small active controls may use a restrained cyan or gold glow. Normal panels must not float unnecessarily.

Motion reinforces depth without spectacle. Use 160–250ms ease-out transitions for panel entry, selection, and progress. Continuous animation is reserved for genuine processing or a temporary placement preview. Respect `prefers-reduced-motion`; never make animation necessary to understand state.

## Shapes

The shape language is technical and tactile, not soft or playful.

- Compact inputs and utility controls: 5px radius.
- Buttons, tool rows, and toggles: 6px radius.
- Cards and grouped instruments: 8px radius.
- Major modal workspaces: 12–18px radius.
- Status chips only: full pill radius.

Borders are structural, typically one pixel. Active states may add a two-pixel inset marker rather than increasing the whole control’s size. Icons are clear line symbols with consistent optical weight. Plan symbols, supply runs, T/Y fittings, and tool icons must render above Redline so operational geometry never disappears into markup.

## Components

### Primary action

A compact cyan control for the single preferred next action. Use dark navy text, 700 weight, a 6px radius, and a subtle downward gradient. Hover brightens the surface; keyboard focus uses a two-pixel Signal Cyan outline with a two-pixel offset. Only one primary action should dominate a local decision area.

### Secondary and toolbar action

A dark navy control with a structural border and Working Ink or muted text. Hover lifts it one tonal step. Use for reversible utilities, view controls, and adjacent alternatives. Disabled state reduces contrast but retains a readable label.

### Branch action

A Branch Gold control reserved for T/Y creation, branch orientation, and branch confirmation. It uses dark ink, strong weight, and a restrained gold highlight so users recognize branch mode instantly. Never use gold for unrelated promotion or decoration.

### Property input

A 31px high Control Navy field with a Structural Line border, 5px radius, and Working Ink. Labels sit above the control in compact, direct language. Measurements and calculated values use Geist Mono. Invalid values include a text explanation and Critical Coral border; reviewable cautions use Attention Orange.

### Tool row

A 41px high full-width row with icon, label, and optional shortcut. Hover introduces a quiet navy fill. The active row uses Raised Navy, brighter text, and a two-pixel Signal Cyan inset marker on the leading edge. Tool identity must remain visible without relying on color alone.

### Status chip

A small pill for short states such as “Saved,” “Needs review,” or “Ready.” Pair the status color with text and, when useful, an icon. Chips report state; they do not replace an action or a full explanation of a blocker.

### Panel card

An 8px radius Control Navy or Raised Navy group with a one-pixel border and subtle inset top highlight. Cards organize one task and its evidence. Avoid card-on-card nesting beyond one level; use dividers and spacing inside a card instead.

### Branch workflow panel

A selectively raised instrument panel with a dark gold-tinted surface, Branch Gold edge, clear placement instruction, and one confident action. It should make the safe next step obvious while keeping ambiguous connection choices visible and user-controlled.

## Do’s and Don’ts

### Do

- Keep the source plan central and preserve strong contrast for HVAC geometry above Redline.
- Make the current tool, current placement state, and safe next action unmistakable.
- Use Signal Cyan for general control and Branch Gold only for T/Y branch work.
- Show evidence, uncertainty, blockers, and approval state in direct field language.
- Use compact controls with generous hit areas and visible keyboard focus.
- Reserve pronounced depth for active instruments and temporary workspaces.

### Don’t

- Don’t resemble gaming software: avoid neon overload, decorative glow, dramatic animation, and trophy-like feedback.
- Don’t resemble generic office software: avoid blank white forms, oversized empty cards, ribbon-style toolbars, and vague corporate copy.
- Don’t hide plan geometry beneath Redline or use decoration that competes with the source PDF.
- Don’t imply that color alone proves safety, connection, approval, or readiness.
- Don’t silently move, connect, resize, or redraw uncertain geometry.
- Don’t add new visual treatments when an established token or component already communicates the state.
