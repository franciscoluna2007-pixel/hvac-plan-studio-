# HVAC Plan Studio

HVAC Plan Studio is an approval-first plan-markup, airflow-coordination, review, takeoff, and field-release workspace built first for HVAC superintendents and one-person businesses.

It keeps editable HVAC geometry over a source-plan PDF, traces reviewed airflow through connected equipment networks, explains plan findings, prepares controlled repair batches, shows purchasing impact, and preserves project-scoped review records. Manual geometry and professional judgment remain authoritative.

## Current release — v120

v120 adds Smart Plan Setup & Repair. The primary workspace now starts with an unnumbered Plan setup preflight, then leads through Connect → Airflow → Check → Finish.

### v120 — Smart Plan Setup & Repair

- Reads each new PDF automatically while the drawing stays usable.
- Finds plan scales, room names, ceiling heights, equipment, systems, zones, and source-linked HVAC information.
- Separates Confirmed, Found on plan, Suggested, and Not found facts.
- Asks only for missing or conflicting information that controls the next operation.
- Keeps Show source beside setup facts and problems.
- Lets open T/Y ports match nearby unused existing run endpoints without creating branch stubs or rerouting ductwork.
- Uses confirmed scale for physical Step 1 snap distances and explains every candidate match.
- Keeps saved T/Y connections bound to the saved run.
- Applies only an approved, current repair batch; placed objects never move and one Undo restores the batch.

### v116.1 — Solo Operator Workflow

- Jobs home: Continue current job, Start a new job, Open a PDF plan, Open from Drive, and Saved jobs.
- Persistent five-step guide with one recommended next action.
- Draw, Symbols, and Selected plan-tool groups.
- Plan Helper, Airflow & Duct Sizes, Materials, Check, Print & Share, and My HVAC Rules.
- Find a tool starts with common actions and searches the full toolset as the user types.
- Plan Helper now turns each finding into a clear problem, proposed fix, expected result, and complete affected-object list.
- Builder Step 1 previews each loose equipment, can, grille, and saved T/Y connection; users choose exact fixes before one-Undo apply.
- Step 1 keeps placed objects fixed, reserves run endpoints against reuse, and sends ambiguous or out-of-scope matches to manual review instead of guessing.
- No repair is selected automatically; the user adds individual fixes or explicitly selects the current eligible set.
- Prepared fixes are bound to both the evidence fingerprint and the exact repair-plan ID. Unchanged CFM proposals are omitted.
- Repair-history Undo is enabled only when the latest plan state matches the recorded batch; Redo restores the receipt state.
- Enterprise analytics, commercial promotion, and review dashboards stay out of the first view.
- Cloud projects, Google Drive, Supabase security, calculations, and approval gates remain intact.

### v116 — My HVAC Rules

Plan Helper evaluates the current system against **My HVAC Rules**. A dedicated workspace keeps locked safeguards, calculated checks, preferred drafting practices, and project-only exceptions visibly separate. It reviews flex limits, terminal connections, airflow-based sizing, run labels, bedroom return paths, T/Y strategy, and fresh-air controls, with evidence and plan links for each result.

Project numbers and internal release labels are not used as the user-facing rules name.

### v113 — Guided Repair Plan

- **Inspect only** highlights and explains without changing the plan.
- **Build repair plan** gathers eligible CFM, connected-network size, fitting-port, and branch actions with blockers and provenance.
- **Guided apply** revalidates the exact reviewed fingerprint and applies selected eligible actions in one Undo.
- Reviewed terminal CFM applies before sizing; the repair plan must be rebuilt against the new airflow.
- Network provenance follows every contributing terminal; planning-seed or stale room-target contributors block resizing.
- Every size-apply entry point hands off to Guided Repair rather than mutating the drawing directly.
- Diameter never generates CFM.
- Supply/return sizing requires an equipment-rooted connected path.
- Fresh-air sizing remains manual until a real OA equipment/control-rooted path exists.
- T/Y topology remains confirm-on-plan.
- Velocity-only size changes require a separate recorded planning-override acknowledgment.

### v114 — Repair Receipts and Takeoff Intelligence

- Reviewer-required local and cloud receipts retain action scope, calculation versions, evidence and drawing fingerprints, planning-override acknowledgment, and cloud-sync status.
- Numeric before/after takeoff includes measured length, order allowance, 25-foot flex boxes, changed rows, fitting-port impact, and holds.
- Preview and commit use the same scoped fitting-synchronization path and actual geometry.
- Supabase repair receipts are member-readable, editor-insertable, retry-idempotent, and append-only for normal authenticated clients.
- Cloud-sync failure leaves the applied plan and a visible pending local receipt; it never reports a false cloud save.

### v115 — Advanced Plan Intelligence

- PDF text regions use the composed PDF.js viewport transform and highlight the exact extracted region on the live plan.
- Repeated text occurrences remain distinct.
- Sheet-role-specific coverage and OCR/visual-review gaps are presented as a non-gating review heuristic.
- Cross-sheet relationships require the same non-generic equipment identifier on multiple sheets.
- CFM is a text reference unless a real schedule-row relationship is known.
- AI takeoff rows are text-reference counts, not installed quantities, and always require visual reconciliation.
- Supabase plan-analysis records retain source regions and the advanced coverage summary.

## Product workflow

1. Open a local or Google Drive PDF.
2. Confirm the source revision, system, and scale.
3. Draw or edit supply, return, fresh-air, equipment, device, fitting, room, and note objects.
4. Save reviewed room or terminal airflow.
5. Trace airflow through physically connected networks.
6. Inspect findings and build a repair plan.
7. Review affected objects, CFM provenance, velocity screen, pressure limitations, and takeoff delta.
8. Apply selected eligible planning changes in one Undo.
9. Resolve RFIs, punch items, connections, approvals, and field checks.
10. Save a named cloud revision and prepare the field package.

## Core capabilities

### Source plans and markup

- Local and Google Drive PDF input.
- Sheet navigation, calibration, zoom, tablet/stylus input, and bounded 4K rendering.
- Editable supply, return, fresh-air, measurements, symbols, equipment, devices, and notes.
- Run-first T/Y placement, fitting ports, snapping, connection repair, copy, resize, and undo/redo.
- Separate systems and zones.

### Airflow and sizing

- Reviewed terminal CFM propagation through physically connected runs.
- Equipment, supply, return, room, and network balance review.
- Versioned round-area, velocity, capacity, rough flex-friction, equivalent-length, segment-loss, pressure-basis, allocation, and transition calculations.
- User-controlled velocity limits.
- A 16-inch maximum residential-flex company policy.
- Parallel-path alternatives when one supported flex run is over capacity.
- No diameter-derived airflow.

### Intelligence and review

- Searchable-PDF sheet classification and source-linked HVAC evidence.
- Exact text-region highlighting.
- Evidence-bound findings, decisions, RFIs, and punch items.
- Stale-decision detection after source, geometry, airflow, or rule changes.
- Repair plans grouped into eligible planning changes, missing inputs, plan confirmations, and manual follow-up.

### Takeoff and release

- Geometry-based duct length and material allowance.
- 25-foot flex-box ordering logic.
- Before/after repair impact.
- Devices, cans, fittings, accessories, and equipment.
- Named takeoff packages and field-release gates.

### Cloud collaboration

- Supabase Auth, PostgreSQL, RLS, members, work items, comments, approvals, files, plan analysis, repair receipts, takeoff packages, and field releases.
- Named immutable project revision snapshots.
- Google Drive source plans and package export.
- Local guest work until a user chooses authenticated cloud features.

## Approval model

“Approved” in HVAC Plan Studio means a named person accepted a specific planning action against a specific evidence fingerprint. It does not mean professionally engineered, code approved, permit approved, TAB verified, manufacturer selected, or ready for installation by itself.

Guided apply requires:

- current and prepared evidence fingerprints to match;
- unchanged current/proposed object values;
- one calculation stage at a time;
- only eligible active-system objects;
- explicit reviewer identity;
- final object-diff confirmation;
- an exact prepared repair-plan ID, not only a shared evidence fingerprint;
- a separate velocity-only override when pressure evidence is missing.

## Engineering boundary

The automatic sequence is:

`reviewed airflow → connected network accumulation → planning size proposal`

It is never:

`existing diameter → invented CFM`

Final duct design still depends on OEM external static pressure, component losses, filter/coil/grille losses, critical-path total effective length, fitting losses, flex support/compression/bends, sound, installation quality, and field verification.

HVAC Plan Studio is not:

- a Manual J load calculation;
- a Manual S equipment selection;
- a Manual D or Manual T design;
- a permit calculation or engineering stamp;
- a TAB report;
- a manufacturer blower-performance selection;
- automatic code compliance;
- a substitute for approved plans, OEM data, applicable codes, an AHJ, field measurements, or a responsible licensed professional.

## Architecture

| Layer | Implementation |
|---|---|
| Application | React 19, TypeScript, Next-compatible vinext runtime |
| PDF workspace | PDF.js canvas plus SVG markup in composed viewport coordinates |
| Drawing model | Runs, symbols, fittings, rooms, systems, CFM, elevations, and saved connections |
| Intelligence | Deterministic Plan Intelligence, repair plans, advanced coverage, and versioned sizing/takeoff modules |
| Cloud | Supabase Auth/PostgreSQL/RLS with projects, revisions, analyses, receipts, takeoff, and releases |
| Files | Local PDF input and Google Drive import/package export |
| Hosting | OpenAI Sites / Cloudflare-compatible worker deployment |
| Verification | ESLint, production build validation, Node behavior tests, and browser QA |

## Repository map

- `app/page.tsx` — workspace orchestration, geometry, airflow, repair apply, takeoff, and release integration
- `app/MarkupAssistantStudio.tsx` — v113–v115 repair-plan, receipt, and evidence workspace
- `app/repairPlan.ts` — deterministic evidence-bound repair planner
- `app/connectionRepair.ts` — deterministic preview-first endpoint and saved T/Y connection planner
- `app/ductSizing.ts` — versioned sizing and pressure-screening calculations
- `app/takeoffIntelligence.ts` — numeric before/after purchasing impact
- `app/planReader.ts` — searchable-PDF evidence and viewport regions
- `app/advancedPlanIntelligence.ts` — coverage, exact-identifier relationships, and source comparison
- `app/cloudProjects.ts` — Supabase project, analysis, receipt, takeoff, and release operations
- `supabase/migrations/` — PostgreSQL schema and RLS controls
- `tests/` — product-behavior and calculation verification

## Development

Requirements:

- Node.js `>=22.13.0`
- Linux shell environment for the provided build scripts

```bash
npm ci
npm run dev
npm run lint
node --test tests/rendered-html.test.mjs
npm run build
```

See [ROADMAP.md](./ROADMAP.md) for the complete product overview, release outcomes, safety gates, evidence basis, and later multi-company work.
