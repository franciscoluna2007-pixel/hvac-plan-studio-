---
name: "HVAC Plan Studio - Patternmaker's Layout Table"
description: A plan-first drafting workspace shaped by a patternmaker's measured table, ledger sheets, kraft references, and aged metal tools.
colors:
  Kraft: "#D8C49A"
  Ledger Paper: "#F7F4EA"
  Plan White: "#FFFFFF"
  Graphite: "#2B2B28"
  Prussian Blue: "#28527A"
  Brick Red: "#A84537"
  Aged Zinc: "#AEB1AA"
  Success: "#536B50"
  Warning: "#8A5E23"
typography:
  display: Barlow Condensed 600/700/800
  body: Geist Sans
  technical: Geist Mono
materials:
  kraft: /materials/pattern-kraft-fiber.webp
  zinc: /materials/pattern-aged-zinc.webp
  ledger: /materials/pattern-ledger-paper.webp
rounded:
  control: 2px
  panel: 3px
  sheet: 2px
spacing:
  unit: 4px
  compact: 8px
  control: 12px
  panel: 16px
  section: 24px
motion:
  standard: 170ms
---

# HVAC Plan Studio - Patternmaker's Layout Table

## North star

HVAC Plan Studio should feel like a patternmaker's working layout table: measured, physical, quiet, and ready for exact drafting. Kraft references, ledger sheets, worn zinc edges, ruled marks, and graphite type create the surrounding instrument. They frame the work without becoming decoration.

The source plan is the authority. It stays pure white and visually untouched. Tool chrome may carry restrained material texture; the plan/PDF never receives a texture, paper grain, tint, blend mode, or warm color cast.

This is a visual-system change only. It does not change a workflow, gesture, placement rule, layer rule, or data model.

## Product and workspace truth

- The product name is HVAC Plan Studio.
- The drafting workspace is Draw & Detail.
- Redline is an internal workspace within HVAC Plan Studio, not the product title.
- The source plan/PDF is the authoritative base layer and always renders on Plan White.
- Redline markup renders above the source plan.
- HVAC runs, symbols, and T/Y tools render above Redline.
- Styling must not silently move, connect, resize, place, redraw, or reinterpret plan geometry.
- Existing tool, selection, drawing, press-drag-release, placement, editing, save, layer, and review behavior stays unchanged.

## Colors

### Semantic palette

| Token | Value | Use |
| --- | --- | --- |
| Kraft | #D8C49A | Product identity bar, reference tabs, warm structural fields |
| Ledger Paper | #F7F4EA | Tool tray, inspector sheets, traveler, menus, and readable chrome |
| Plan White | #FFFFFF | Source plan/PDF surface only; never tint or texture it |
| Graphite | #2B2B28 | Primary text, rules, icons, and working marks |
| Prussian Blue | #28527A | Active tool, current workspace, primary action, links, and keyboard focus |
| Brick Red | #A84537 | Redline identity, correction marks, and destructive emphasis |
| Aged Zinc | #AEB1AA | Command rail, metal edges, dividers, inactive hardware |
| Success | #536B50 | Saved, checked, connected, or ready states |
| Warning | #8A5E23 | Needs-review and caution states |

Kraft, ledger, and zinc establish material. Graphite carries information. Prussian Blue identifies the current working control. Brick Red belongs to markup and correction. Success and Warning report state.

Color is never the only state cue. Every active, selected, warning, error, saved, or ready state also needs plain text plus a structural change such as an icon, label, border, underline, check, or position marker.

## Typography

Self-host **Barlow Condensed** at weights 600, 700, and 800. Use it for the HVAC Plan Studio wordmark, workspace names, section headings, tool names, workflow labels, buttons, tabs, and short status stamps. Its condensed construction should make the interface feel labeled like physical drafting equipment.

Use **Geist Sans** for instructions, help text, descriptions, form labels, notes, and other body copy. Use **Geist Mono** for dimensions, scale, coordinates, identifiers, counts, airflow values, and other technical data.

- Product identity: Barlow Condensed 800, 18-22px.
- Workspace and panel headings: Barlow Condensed 700, 13-17px.
- Tool, workflow, tab, and button labels: Barlow Condensed 600/700, 11-14px.
- Body and field guidance: Geist Sans 400-600, 11-14px.
- Measurements and technical metadata: Geist Mono 500-700, 10-13px.
- Short equipment labels may use uppercase with 0.04em-0.08em tracking. Do not set instructions or sentences in uppercase.

Use direct field language: "Draw supply run," "Place T/Y," "Check scale," "Needs review," and "Saved." Avoid abstract dashboard language.

## Materials

Use the supplied material assets only on interface chrome:

| Material | Asset | Approved surfaces |
| --- | --- | --- |
| Kraft fiber | /materials/pattern-kraft-fiber.webp | 52px identity bar, reference tabs, small label fields |
| Aged zinc | /materials/pattern-aged-zinc.webp | Command rail, hardware edges, separators |
| Ledger paper | /materials/pattern-ledger-paper.webp | Tool tray, inspector, bottom traveler, menus |

Material texture must stay quiet enough that labels and rules remain crisp. Pair it with an opaque token color rather than relying on the image for contrast. Avoid material-on-material nesting; a ledger sheet can sit against a zinc edge, but it should not contain more floating faux-paper cards.

Never apply a material image, warm overlay, opacity wash, blend mode, filter, or off-white background to the source plan/PDF. Plan White is exact #FFFFFF.

## Desktop layout

The desktop shell is a measured table around one flexible plan surface:

- A 52px kraft identity bar holds HVAC Plan Studio, Draw & Detail, current job context, and existing global actions.
- The workspace row contains a 58px command rail, a 224px tool tray, the flexible plan, and a 304px inspector.
- A 76px bottom traveler holds the existing workflow position and relevant next-step controls.
- A 34px status strip reports source, scale, save, and readiness.

The desktop grid is therefore:

    rows: 52px minmax(0, 1fr) 76px 34px
    workspace columns: 58px 224px minmax(0, 1fr) 304px

The plan remains the largest region. The rail chooses a workspace destination; the tray contains its tools; the inspector shows the current selection or task. The traveler communicates existing workflow progress without adding a new workflow.

At compact desktop widths, reduce internal gaps and label density, then narrow supporting chrome before constraining the usable plan. A tray or inspector may become an on-demand drawer when both no longer fit. Opening or closing a drawer must not alter the current tool, selection, placement state, or plan viewport.

On tablet and mobile:

- Keep the plan first and full-height whenever possible.
- Put the tool tray and inspector in dismissible drawers.
- Turn the command rail into a horizontal control with 49px minimum targets.
- Preserve the same destinations, labels, order, active state, and workflow meaning.
- Do not turn the mobile layout into a new or simplified data model.

## Layer order and plan treatment

The visible stack is explicit:

1. Source plan/PDF on pure Plan White.
2. Redline markup.
3. HVAC runs, symbols, fitting previews, and T/Y tools.
4. Selection handles and temporary interaction affordances already provided by the product.

The Patternmaker material system belongs outside that stack. No texture or tint crosses the plan boundary. Raised chrome may overlap the plan only where the current responsive layout already uses drawers or temporary panels, and it must not obscure the active placement area without a clear dismiss action.

## Edges, rules, and depth

The shape language is squared and workmanlike:

- Controls and tabs use a 2px radius.
- Panels, drawers, and sheets use a 3px radius.
- Avoid pills, soft cards, large bubbles, and rounded dashboard containers.
- Use one-pixel graphite or zinc rules for structure.
- Use a two-pixel inset Prussian Blue rule for the active item.

Physical depth comes from inset and raised edges, not soft floating shadows. Good patterns include a light inset top edge, a graphite lower edge, a one-pixel zinc seam, and a short 1-2px raised offset. Large blurred shadows are reserved for modal or drawer separation and should remain restrained.

Measured rules and ticks may appear on the identity bar, tray edge, traveler, or inspector header. They are orientation devices, not decoration. Keep marks regular, low contrast, and outside the source plan.

## Motion and focus

Use a restrained **170ms** transition for hover, press, selection, drawer entry, and state changes. Prefer opacity, color, border, and 1px translation. Do not use bounce, spring, sweeping light, ambient motion, or animation that suggests a geometry change.

Every interactive control needs a visible keyboard focus treatment: a two-pixel Prussian Blue outline with a two-pixel offset, supplemented by a text label and control shape. Focus must remain visible on kraft, ledger, zinc, and white surfaces.

Honor prefers-reduced-motion by removing nonessential transition and animation. State must remain fully legible when motion is removed.

## Components

### Kraft identity bar

A 52px product bar with the restrained kraft-fiber material, a graphite lower rule, HVAC Plan Studio identity, Draw & Detail workspace label, job context, and existing global actions. The product and workspace names remain distinct. The bar is not a marketing header.

### Command rail

A 58px aged-zinc navigation rail for existing workspace destinations. Each control carries an icon and a short Barlow Condensed label. The active destination includes aria-pressed or aria-current, a text label, a Prussian Blue inset rule, and stronger graphite contrast. On tablet/mobile it becomes horizontal with 49px minimum targets.

### Tool tray

A 224px ledger-paper sheet holding the current destination's tools. Tool rows are compact, squared, and separated by measured rules. The selected tool retains its icon and label and gains a Prussian Blue inset edge; selection never relies on a blue fill alone.

### Plan frame

The flexible center surface. Its outer zinc edge may carry an inset seam, but the inner source-plan surface is exact Plan White with no image, tint, or paper effect. The frame must preserve the established plan layer order.

### Inspector sheet

A 304px ledger sheet for the current selection, layer visibility, or task guidance already supported by the product. Use direct headings, field labels, and mono values. Validation pairs Warning or Brick Red with an icon and an explanation.

### Technical input

A squared ledger or Plan White field with a graphite rule, direct label, and Geist Mono value. Focus uses Prussian Blue. Invalid or reviewable values add a written message and state icon; color alone is insufficient.

### Primary and tool actions

Primary actions use Prussian Blue with a clear verb. Redline controls may use Brick Red only when their label and icon make the markup purpose explicit. Success and Warning are status colors, not general action colors. T/Y controls retain their existing behavior and use the same visual hierarchy as other active drafting tools.

### Bottom traveler

A 76px ledger-paper strip with a measured top rule. It shows the existing workflow position, completed/current labels, and relevant next action. It does not invent, reorder, or merge workflow steps.

### Status strip

A 34px zinc strip for source, scale, save, and readiness. State combines plain text with an icon or stamp. Technical values use Geist Mono.

## Do

- Keep the source plan pure white, visually dominant, and authoritative.
- Keep HVAC runs, symbols, and T/Y tools above Redline.
- Use the Patternmaker materials on chrome only.
- Keep labels short, direct, and grounded in field work.
- Use squared controls, measured rules, and restrained physical edges.
- Pair every color state with text and a non-color cue.
- Preserve visible focus, 49px mobile rail targets, and reduced-motion behavior.

## Do not

- Do not rename HVAC Plan Studio or promote Redline to the product title.
- Do not call the workspace anything other than Draw & Detail.
- Do not tint, texture, warm, fade, or distress the plan/PDF.
- Do not move HVAC geometry below Redline.
- Do not add or change workflows, gestures, placement, layers, or the data model.
- Do not use soft rounded cards, glossy gradients, decorative shadows, or ornamental workshop props.
- Do not use color alone to communicate selection, warning, success, or readiness.
