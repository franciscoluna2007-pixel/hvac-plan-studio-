# HVAC Plan Studio

HVAC Plan Studio is an approval-first plan-markup, airflow-coordination, review, takeoff, and field-release workspace built first for HVAC superintendents and one-person businesses.

It keeps editable HVAC geometry over a source-plan PDF, traces reviewed airflow through connected equipment networks, explains plan findings, prepares controlled repair batches, shows purchasing impact, and preserves project-scoped review records. Manual geometry and professional judgment remain authoritative.

## Current release — v128

v128 gives the superintendent one place to understand and fix plan issues. Fix Plan presents one current issue, its location and evidence, the proposed change, and a clear Yes or No decision. An optional transparent plan layer can show evidence-linked supply and return review zones on the current PDF sheet when the source contains enough verified information.

### v128 — Fix Plan & Contextual Markup

- Consolidates problem review, proposed repairs, and connection repair into one **Fix Plan** queue instead of sending the user through separate Problems and Fixes areas.
- Presents one issue at a time with what is wrong, where it is, the proposed fix, the expected result, source evidence, affected objects, and the exact approval boundary.
- Uses **Yes** to approve only the current eligible action and **No** to skip it during the current review.
- Prioritizes connection fixes before dependent airflow and sizing work. A ready connection repair can move only the reviewed existing run endpoint; it creates no route, branch stub, fitting, terminal, or other drawing object.
- Keeps ambiguous connection matches in the same queue but requires the user to choose the correct existing run. Blocked conditions remain manual.
- Adds a toggleable **Transparent Plan Layer** for the selected PDF sheet. It shows source-linked supply and return **review zones** only when the current source fingerprint, exact room location, scale, and equipment/system context are sufficiently verified.
- Treats every overlay suggestion as **Confirm location**, not exact engineered placement. The user still reviews walls, glass, ceiling pattern, throw, load, diffuser type, return strategy, door condition, transfer path, grille size, noise, pressure, and field conditions.
- Adds nearby object-specific action wheels. Icons receive presentation actions, runs receive duct-label and route actions, and fittings receive connection/property actions without exposing unrelated controls.
- Lets the run wheel make a duct-size label smaller or larger, or restore its default presentation. Label resizing does not change duct size, route geometry, CFM, connection, or system assignment.
- Keeps source details, My HVAC Rules, and History & Undo available under a quieter **More** section.
- Preserves evidence-fingerprint revalidation, exact object scope, one-Undo repair batches, and the rule that an assistant preview or overlay never silently changes the plan.

### v127 — Compact Symbol Workflow

- Reduces the minimum icon scale from 40 percent to 20 percent and the minimum label scale from 65 percent to 30 percent.
- Gives newly placed supply and return terminals a genuinely compact icon and label default.
- Adds **Compact** to the selected-symbol wheel without removing rotate, mirror, duplicate, delete, or close; the wheel stays nearby at maximum zoom.
- Adds Smaller and Larger controls for both icon and label sizing while preserving direct corner and round-handle editing.
- Adds one undoable **Compact all supply & return symbols on this sheet** action for existing work.
- Keeps small symbols selectable with fixed screen-space hit targets at every supported zoom.
- Removes the provisional size placeholder from the canvas. An unconfirmed supply or return run stays unlabeled until its size is deliberately confirmed.
- Preserves legacy saved scale values until the user resizes or explicitly compacts those symbols, and Compact never enlarges an icon or label that is already smaller.

### v126 — Direct Symbol Editing

- Moves a selected icon's label independently without moving the icon or plan geometry.
- Resizes the label from its round on-plan handle and keeps it visually associated with the icon.
- Resizes icons from larger, zoom-aware corner targets that also work with touch and pen.
- Uses smaller explicit defaults for newly placed supply, return, equipment, and control symbols while preserving legacy saved-symbol scale.
- Replaces the selected-symbol top bar with a nearby wheel for rotate, mirror, duplicate, delete, and close actions.
- Defaults new supply and return runs to the 0.10 mm Fine line setting; older saved runs keep their existing appearance.
- Removes generated promotional mockups and image metadata. Future social previews must use an approved real product capture or remain image-free.

### v125 — Setup When You Need It

- Keeps direct and guided entry visible together instead of forcing one workflow.
- Remembers whether this device prefers direct opening or guided setup.
- Defaults safely to direct opening when the preference is missing, malformed, or unavailable.
- Captures each opening request as an explicit direct or guided transaction so a canceled wizard cannot leak settings into the next PDF.
- Prevents an older, slower PDF request from replacing a newer selection.
- Keeps Plan Setup and Plan Helper available after direct entry while plan reading continues in the background.
- Moves the file input outside inactive modal content and gives it an accessible name.
- Improves guided-setup keyboard and selected-choice semantics.

### v124 — Open PDF & Draw

- Adds a first-screen **Open PDF and start drawing** action for local plans.
- Keeps **Use guided setup** as a clear optional action.
- Supports direct Google Drive opening and direct drag-and-drop from Jobs Home.
- Accepts PDF files whose browser omits the MIME type when the filename ends in `.pdf`.
- Opens the canvas immediately and reports that scale, rooms, ceiling heights, and equipment are being checked in the background.
- Stores local work by PDF fingerprint as well as job name.
- Opens a same-named but different PDF as a new job instead of silently placing old markups over new source content.
- Keeps matching saved markups recoverable and separated from different plan contents.

### v123 — Markup Assistant Fixes 2.0

- Replaces the audit-like problem queue with Do first, Can fix, Needs answer, and All views.
- Explains why each problem is ordered where it is and maps it to its exact repair action instead of every action in the same category.
- Groups the fix list into Ready now, Needs information, and Fix on plan.
- Shows exact Before and After values, affected objects, the safety boundary, and whether route movement is possible.
- Adds safe blank-field numbering for proven terminal-linked supply and return legs. Existing numbers are never overwritten or silently resequenced, and trunks or unknown-role segments are not called flex runs.
- Separates connection, airflow, and size stages. Metadata-only labels may accompany a safe stage, but incompatible engineering stages cannot be applied together.
- Can promote a numerically matching planning-seed CFM to the current reviewed room target without pretending the number changed.
- Uses field-level mutation checks in addition to object-scope checks. A label fix can change only `runNumber`; a CFM fix can change only terminal airflow fields; a size fix cannot move route points.
- Requires a verified per-sheet scale before any endpoint movement and requires an explicit choice for every unsaved can, grille, or equipment match.
- Makes size-review state explicit. Unknown is not treated as reviewed, and changing a size makes it provisional again.
- Omits already-correct sizes instead of turning them into no-op repairs.
- Holds size application and purchasing quantities until the affected sheet scale is confirmed.
- Keeps return strategies, new routes, trunk changes, T/Y placement, equipment moves, and professional judgment manual or confirm-on-plan.
- Derives the receipt's exact before-and-after fields from the applied result, including CFM source and fitting-port metadata, while keeping historical receipts readable.

### v122 — Smart Scale & Draw-First Workflow

- Applies any valid numeric scale found on the plan directly, including metric and uncommon architectural scales, instead of sending a recognized scale through manual calibration.
- Stores scale confirmation per PDF sheet, so mixed-scale plan sets keep the right measurements and an unverified sheet cannot borrow another sheet's scale.
- Shows each detected choice when a sheet contains conflicting scales; not-to-scale or missing numeric evidence still requires calibration.
- Returns to Plan Helper after a manual two-point calibration so setup continues where the user left off.
- Guides the drafting order used in the field: draw supply routes first, then number the flex runs and confirm their sizes, add return runs and grilles, and finally connect and repair loose endpoints.
- Keeps unconfirmed supply and return runs unlabeled until the post-draw detail pass confirms their size.
- Adds post-draw run numbers and reviewed sizes without snapping or moving the routes already drawn.
- Preserves manual geometry, approval, evidence-fingerprint, repair-scope, and one-Undo protections.

### v121 — Simple Job Workflow

- Simplifies Project Home around resume, open PDF, saved jobs, and recent work.
- Uses one canonical five-step job guide across the top rail, current-step panel, command search, and Plan Helper.
- Hides duplicate progress strips, conflicting next actions, and future job cards.
- Combines Plan Setup, Problems, and Fixes into one Plan Helper while retaining rules, history, source evidence, approval, and Undo.
- Keeps the plan visible while reviewing setup sources and problems.
- Raises field-working text and touch targets and restores a large mobile Continue action.
- Does not change plan geometry, repair eligibility, fingerprint checks, or approval boundaries.

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

1. **Plan Setup** — open a local or Google Drive PDF, read its source information, and confirm the drawing scale.
2. **Draw & Detail** — draw supply routes first, number the flex runs and confirm their sizes, add returns, then connect and repair loose endpoints.
3. **Airflow & Sizes** — save reviewed room or terminal airflow and inspect connected-network size candidates.
4. **Fix Problems** — use one Fix Plan queue to see what is wrong, where it is, and what will change; approve or skip one evidence-bound fix at a time and toggle review zones when the source is sufficient.
5. **Materials & Print** — review the takeoff, remaining release blockers, named revision, and field package.

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
- One-place Fix Plan decisions with connection repair integrated ahead of dependent airflow and sizing work.
- Current-sheet transparent supply and return review zones linked to exact source regions and hidden whenever required evidence is incomplete.
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
- `app/MarkupAssistantStudio.tsx` — Plan Setup, one-place Fix Plan, repair approval, receipt, and evidence workspace
- `app/assistantSuggestionLayer.ts` — evidence-gated current-sheet supply and return review-zone planner
- `app/contextActionWheel.ts` — object-specific icon, run, and fitting wheel contracts and keyboard navigation
- `app/ductLabelEditing.ts` — bounded duct-label presentation sizing
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
