# HVAC Plan Studio

HVAC Plan Studio is an approval-first HVAC plan-markup and coordination workspace for contractors, estimators, reviewers, and field teams.

It places editable HVAC geometry over source-plan PDFs, traces scheduled airflow through connected duct networks, produces evidence-backed review queues, and prepares controlled takeoff and field-release packages. Human judgment remains authoritative: recommendations are previews until a person reviews and confirms the next action.

## Current milestone

### v112 — Transparent Duct Sizing Engine

v112 makes the sizing review independently testable and explicit about what is known, assumed, and blocked.

It adds:

- A versioned pure calculation module for round-duct area, velocity, capacity, rough flex friction, equivalent length, segment-loss estimates, and explicit available-static-pressure math.
- Airflow provenance, velocity limits, planning classifications, reason codes, and apply eligibility on each candidate.
- A hard 16-inch supported residential-flex ceiling and parallel-path alternatives when one flex run cannot meet the configured velocity screen.
- Protection against circular size-derived CFM and manual CFM values that undercut known downstream terminal demand.
- Readable 13 px safety guidance that separates a velocity preview from a pressure-screened result.

The engine never claims a pressure pass without explicit external static pressure, component losses, and total effective length. Rough flex loss remains a disclosed planning estimate.

### v111 — Intelligent HVAC Markup Assistant

The v111 assistant converts current drawing evidence into a prioritized recommendation queue.

It can:

- Explain connection, airflow, return-path, coordination, and duct-sizing findings.
- Highlight the affected drawing object or a reviewable T/Y junction over the live plan.
- Show the evidence fingerprint, confidence, observed condition, why it matters, and a safe proposed action.
- Route approved work into the existing run-first branch pass, System Balance Studio, or Plan Intelligence decision record.
- Revalidate a proposed T/Y against current geometry before arming placement.

The assistant does not move walls, invent rooms, connect systems, reroute ductwork, or change diameters automatically. Manual geometry and existing undoable editing tools remain authoritative.

## Core workflows

### Source plans and projects

- Open local or Google Drive PDFs.
- Calibrate or select plan scale.
- Save browser autosaves and immutable named cloud revisions.
- Restore the source PDF and its saved HVAC overlay together.

### HVAC markup

- Draw supply, return, fresh-air, and measurement geometry.
- Place equipment, diffusers, return grilles, controls, dampers, notes, and fittings.
- Use run-first T/Y placement with fitting ports, snapping, repair, copy, resize, and undo/redo.
- Keep systems and zones separated.

### Plan Intelligence

- Classify HVAC-related sheets from the PDF text layer.
- Extract source-linked equipment, airflow, duct, device, control, schedule, and note evidence.
- Generate explainable drawing findings.
- Record accepted conditions, RFIs, and punch items with evidence fingerprints that become stale when the underlying condition changes.

### Airflow and sizing review

- Propagate reviewed terminal CFM through physically connected runs.
- Compare equipment, supply, return, room, and network airflow.
- Screen current and proposed diameters against user-controlled velocity limits.
- Estimate flex friction and current-segment pressure loss when scale is verified.
- Apply only checked, eligible changes in one undoable transaction.

### Takeoff and release

- Measure duct length from saved geometry.
- Apply the 25-foot flex-box purchasing rule and material allowance.
- Count devices, cans, fittings, accessories, and equipment.
- Create immutable takeoff packages tied to a named cloud revision.
- Block field release until required drawing, review, connection, scale, checklist, coordination, and cloud-approval gates are clear.

## Approval-first operating model

1. Read the source plan and current marked geometry.
2. Produce evidence and deterministic recommendations.
3. Preview the affected object or proposed junction.
4. Require a person to review the evidence.
5. Continue through an existing manual tool or checked apply workflow.
6. Record the resulting revision and invalidate stale reviews when evidence changes.

“Approved” never means professionally engineered, code approved, permit approved, or ready for installation by itself.

## Architecture

| Layer | Implementation |
|---|---|
| Application | React 19, TypeScript, Next-compatible vinext runtime |
| PDF workspace | PDF.js canvas rendering with SVG markup in PDF coordinates |
| Drawing model | Runs, symbols, fittings, rooms, systems, CFM, elevations, and saved connections |
| Intelligence | Deterministic Plan Intelligence, v111 markup recommendations, and the v112 sizing engine |
| Cloud projects | Supabase Auth, PostgreSQL, RLS, members, immutable revisions, approvals, analysis, takeoff, and release records |
| File workflow | Local PDF input and Google Drive import/package export |
| Hosting | OpenAI Sites / Cloudflare-compatible deployment |
| Verification | ESLint, production build validation, and Node test suite |

The main workspace is currently orchestrated in `app/page.tsx`. New calculation and recommendation capabilities are being extracted into small pure modules so their inputs, outputs, and tests remain inspectable.

## Release gates

A field release can require:

- At least one duct run.
- No unresolved critical drawing findings.
- Every warning reviewed or resolved.
- Saved device and fitting connections physically aligned.
- Run elevations coordinated.
- Terminal rooms assigned.
- Drawing scale verified.
- Field checklist complete.
- RFIs approved or closed.
- Critical punch items closed.
- If cloud-connected, the latest named revision opened, unchanged, and approved.

Any geometry, rules, review evidence, or cloud status change can make an earlier release stale.

## Product boundaries and non-claims

HVAC Plan Studio is a drafting, coordination, review, and estimating aid. It is not:

- A Manual J load calculation.
- A Manual S equipment selection.
- A Manual D or Manual T design.
- A permit calculation or engineering stamp.
- A TAB report.
- A manufacturer blower-performance selection.
- A substitute for approved plans, OEM data, applicable codes, an AHJ, field measurements, or a responsible licensed professional.

PDF text extraction does not understand every graphical symbol or unlabeled condition. The current workspace has no complete wall, room-polygon, obstruction, or building-load model, so recommendations must be visually confirmed.

Velocity and pressure results are transparent planning screens based on entered data and current assumptions. They do not prove final airflow, sound, static pressure, comfort, ventilation, or equipment operation.

## Data and security

- Supabase Row Level Security limits project data to authorized members.
- Drawing geometry is stored in immutable named revision snapshots.
- Plan-analysis evidence and human decisions are project scoped.
- Takeoff and release records retain revision and evidence signatures.
- Public guest use remains local until a user chooses cloud-project features.

## Development

Requirements:

- Node.js `>=22.13.0`
- Linux shell environment for the provided build scripts

Common commands:

```bash
npm ci
npm run dev
npm run lint
node --test tests/rendered-html.test.mjs
npm run build
```

## Repository map

- `app/page.tsx` — workspace orchestration, drawing tools, geometry, airflow, takeoff, and release integration
- `app/markupAssistant.ts` — v111 evidence-to-recommendation engine
- `app/MarkupAssistantStudio.tsx` — v111 recommendation and preview workspace
- `app/planReader.ts` — source-plan text analysis
- `app/planIntelligence.ts` — finding identities, summaries, and explanations
- `app/systemBalance.ts` — deterministic System Balance model and scoring
- `app/SystemBalanceStudio.tsx` — airflow and sizing review workspace
- `app/ductSizing.ts` — v112 versioned, deterministic sizing calculations
- `app/cloudProjects.ts` — Supabase project and revision operations
- `supabase/migrations/` — PostgreSQL schema, RLS, and release-integrity controls
- `tests/` — build and product-behavior verification

See [ROADMAP.md](./ROADMAP.md) for release status, acceptance gates, and planned v113–v117 work.
