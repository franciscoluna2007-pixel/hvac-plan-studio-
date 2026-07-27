# HVAC Plan Studio — Product Overview and Roadmap

Last revised: July 25, 2026

## Product overview

HVAC Plan Studio is a plan-markup, airflow-coordination, review, takeoff, and field-release workspace for HVAC contractors, estimators, reviewers, and field teams.

The product keeps the source PDF and editable HVAC overlay together. A user can trace supply, return, and fresh-air systems; place equipment and air devices; connect T/Y fittings; coordinate room CFM; review connected-network sizing; prepare purchasing quantities; and release a controlled field package.

The product is not an autonomous HVAC designer. It makes evidence, calculations, assumptions, object changes, and human decisions visible. Manual geometry remains authoritative, and every physical assistant change is previewed, fingerprint-bound, revalidated at commit time, and undoable.

## Core product workflow

1. Open a local or Google Drive plan PDF.
2. Confirm the source revision, working system, and scale.
3. Draw or edit HVAC runs, fittings, devices, rooms, and notes.
4. Assign reviewed room or terminal airflow.
5. Trace airflow through physically connected equipment-rooted networks.
6. Inspect findings and build an evidence-bound repair plan.
7. Apply only the selected eligible planning changes in one Undo.
8. Review the actual takeoff delta and durable repair receipt.
9. Resolve RFIs, punch items, connections, approvals, and field checks.
10. Save a named cloud revision and issue the field package.

## Permanent operating principles

- Manual plan geometry is authoritative.
- The assistant may inspect, prepare, or guided-apply; it never silently mutates a plan.
- Diameter never creates CFM. Reviewed airflow flows into the network; the network can then produce size candidates.
- Terminal CFM changes and network-size changes are separate stages. New CFM invalidates old size candidates.
- Equipment, walls, rooms, new routes, intermediate route vertices, and cross-zone changes remain manual. Listed attached endpoints may align to resized fitting ports inside an approved batch.
- T/Y topology changes require confirmation on the live plan.
- A changed evidence fingerprint applies zero stale actions.
- A guided batch changes only the reviewed object set and creates one Undo entry.
- Planning calculations never become a Manual J, S, D, or T result by changing a label.
- Warning, evidence, and consequence text is workstation-readable: 15 px working copy, 13 px metadata, 12 px labels, 44 px controls.

## Release status

| Release | Product outcome | Status |
|---|---|---|
| v98–v110 | Drafting, cloud projects, Plan Intelligence, balance, takeoff, field release, tablet/4K foundation | Shipped |
| v111 | Evidence-backed Intelligent HVAC Markup Assistant | Shipped |
| v112 | Versioned transparent duct-sizing engine | Shipped |
| v113 | Guided Repair Plan and controlled network resizing | Shipped |
| v114 | Repair receipts and before/after takeoff intelligence | Shipped |
| v115 | Advanced Plan Intelligence, source regions, and coverage | Shipped |
| v116 | Studio Standard | Shipped |
| v117 | Multi-company commercial operations | Planned |

## Shipped foundation — v98 through v110

- PDF viewing, sheet navigation, calibration, and bounded ultra-HD rendering.
- Editable supply, return, fresh-air, measurement, symbol, and fitting geometry.
- Run-first T/Y placement, snapping, connection repair, copy, sizing, and undo/redo.
- Project Home, guided setup, system workflow, and command navigation.
- Supabase projects, members, named immutable revisions, approvals, RLS, and release integrity.
- Google Drive source-plan import and verified package export.
- Source-linked Plan Intelligence findings, RFIs, punch items, and stale-decision detection.
- System Balance Studio with room CFM, connected-network review, and named checkpoints.
- Takeoff packages, field-release gates, tablet/stylus interaction, and 4K controls.

## v111 — Intelligent HVAC Markup Assistant

### Outcome

A single review workspace organizes connection, airflow, return-path, coordination, branch, and sizing evidence without changing the drawing merely because a recommendation exists.

### Shipped capabilities

- Open, critical, and full recommendation queues.
- Observed condition, consequence, proposed repair, evidence, and deterministic extraction score.
- Live-object focus and ghost T/Y previews.
- Revalidation before a T/Y is armed on the live plan.
- Links to Plan Intelligence decisions and System Balance Studio.
- Explicit protected boundaries for walls, units, routes, zones, and releases.

## v112 — Transparent Duct Sizing Engine

### Outcome

Sizing math is versioned, independently testable, and explicit about airflow provenance, velocity limits, rough pressure assumptions, and blocked conditions.

### Shipped capabilities

- Pure round-area, velocity, capacity, rough flex-friction, equivalent-length, segment-loss, pressure-basis, airflow-allocation, and transition functions.
- Provenance for manual, reviewed-room-target, terminal-linked, planning-seed, and missing airflow.
- Current/proposed diameter, velocity, rough friction, capacity, reason codes, and parallel-path alternatives.
- User-controlled velocity limits and a 16-inch maximum residential-flex company policy.
- No diameter-derived CFM and no manual CFM below known connected downstream demand.
- Equipment-rooted connected-path requirements for assistant network sizing.

### Boundary

The current automatic size proposal remains a velocity-screened planning change unless OEM external static pressure, component losses, critical-path total effective length, fitting losses, and installed-flex condition are supplied and reviewed. Guided apply therefore requires a separate recorded velocity-only planning override. It is not described as a pressure-qualified or “safe” design result.

## v113 — Guided Repair Plan

### Outcome

The assistant is more helpful without becoming uncontrolled: it can gather eligible CFM, network-size, fitting-port, and branch work into one readable repair plan.

### Shipped capabilities

- Three autonomy modes:
  - **Inspect only** — highlight and explain; change nothing.
  - **Build repair plan** — gather eligible actions, blockers, provenance, object scope, and purchasing impact.
  - **Guided apply** — revalidate and apply selected eligible actions in one Undo.
- Reviewed room targets can update connected terminal CFM.
- Physically connected, equipment-rooted supply/return networks can generate coordinated run-size actions.
- Every governing network contributor is traced; planning-seed or stale room-target provenance blocks resizing even when the path is physically connected.
- All legacy size-apply controls now hand off to Guided Repair instead of mutating the drawing directly.
- Fresh-air resizing remains manual until an actual equipment/control-rooted OA network exists.
- Selected run sizes synchronize affected fitting-port sizes and disclose every connected endpoint that will realign.
- CFM changes apply first; sizing remains blocked until the plan is rebuilt against the new airflow.
- T/Y opportunities remain confirm-on-plan topology changes.
- Reviewer identity, final confirmation, and a stronger velocity-only override are required at apply time.

### Commit-time gates

- Prepared and live evidence fingerprints match.
- Every selected action is still eligible and has the same current/proposed value.
- No CFM and size stage is mixed in one calculation.
- No changed object falls outside the reviewed active-system object set.
- No planning-seed, disconnected, over-capacity, cross-system, or stale action can apply.
- A rejected commit returns `false`, changes zero drawings, and does not show a success receipt.

## v114 — Repair Receipts and Takeoff Intelligence

### Outcome

Every guided batch explains what changed, who reviewed it, what it did to material quantities, and whether its cloud receipt saved.

### Shipped capabilities

- Numeric before/after measured length, order length, 25-foot box count, waste allowance, affected fitting count, hold reasons, and row deltas.
- Preview and commit use the same fitting-synchronization path and actual before/after geometry.
- Full calculation version, allowance, box length, rows, and holds remain in the receipt.
- Local receipts survive project save/restore.
- Supabase `project_repair_batches` is append-only for normal clients:
  - project members can read;
  - project editors can insert;
  - authenticated clients cannot update, delete, or truncate;
  - reviewer identity and non-empty action payload are database-enforced;
  - revision/project ownership is qualified;
  - client receipt IDs make retries idempotent.
- Cloud failure never rolls back an already-applied local drawing change; the receipt remains visibly pending.

### Audit wording

Repair receipts are durable, append-only application records for authorized clients. They are not advertised as cryptographically tamper-evident records: project owners/service roles remain administrative authorities, and the client supplies the reviewed action payload and drawing fingerprints.

## v115 — Advanced Plan Intelligence

### Outcome

The plan reader explains what searchable evidence exists, where it appears, what coverage is missing, and which exact shared identifiers may relate across sheets.

### Shipped capabilities

- PDF text-item coordinates composed through the PDF.js viewport transform, including rotated/cropped pages.
- Source-region highlighting on the live plan.
- Repeated identical evidence occurrences remain distinct.
- Wider round-duct text extraction; the 16-inch ceiling applies only to the residential-flex sizing policy.
- CFM values are labeled as text references unless a schedule-row relationship is actually proven.
- Takeoff extraction reports text-reference counts, never installed quantities; every row requires visual reconciliation.
- Sheet-role-specific evidence requirements and a non-gating readiness heuristic.
- OCR/visual-review blockers only for classified HVAC sheets.
- Cross-sheet relationships only for the same non-generic normalized equipment identifier on multiple sheets.
- Source comparison uses occurrence counts plus page/region identity, so duplicate removal or movement is visible.
- Supabase analysis records retain advanced summaries and source regions.

### Honest boundary

v115 detects searchable PDF text. It does not claim that OCR ran, that a nearby tonnage belongs to a nearby CFM value, that a regex score is a calibrated probability, or that a text count equals purchasing quantity. Extracted evidence remains draft until a person confirms it.

## v116 — Studio Standard

### Goal

Turn proven HVAC drafting preferences into visible, evidence-linked QA rules and review actions under **HVAC Plan Studio Standard · v1.0**.

### Shipped profile

- Flex-heavy residential routing with minimal hard duct.
- Main trunk deep first, then branch backward.
- Blue supply, yellow T/Y branches, red return, and green fresh air.
- Square diffuser symbols and field-readable run-size labels.
- 16-inch residential-flex maximum.
- Gradual size progression and frequent reviewed T/Y use.
- Separate systems and zones.
- Original unit locations and floor-plan geometry preserved.
- Bedroom return-path review.
- Extra review for west glass, sliders, high ceilings, and door-closed rooms.

The Markup Assistant now includes a dedicated Studio Standard workspace. It separates locked safeguards, calculated checks, studio recommendations, and project-only exceptions; scores the current system; links affected objects back to the plan; and keeps engineering evidence and approval gates independent.

Project numbers remain source examples and are not used as the name of the reusable standard.

Standard rules create findings and review actions; they do not silently redraw the plan or infer airflow from diameter.

## v117 — Commercial Product Operations

### Goal

Prepare HVAC Plan Studio for dependable multi-company production use.

### Planned capabilities

- Organization workspaces, role administration, and company policy profiles.
- Subscription, entitlement, and usage controls.
- Customer onboarding and guided sample projects.
- Administrative analytics and controlled audit exports.
- Backup, retention, recovery, and incident procedures.
- Large-plan-set performance budgets and regression fixtures.
- Accessibility, tablet, stylus, and outdoor-readability acceptance testing.
- Security review, observability, support workflows, and customer-facing non-claims.

## Cross-release field-release gates

A field release remains blocked until applicable gates are clear:

- Runs exist.
- Critical drawing conditions are corrected or professionally documented.
- Warnings are reviewed.
- Device and fitting connections are physically aligned.
- Elevations are coordinated.
- Terminal rooms are assigned.
- Scale is verified for length-dependent results.
- Field checklist is complete.
- RFIs are approved or closed.
- Critical punch items are closed.
- The current named cloud revision is unchanged and approved.

A release becomes stale when signed drawing geometry, room targets, calculation rules, review decisions, RFI/punch state, or cloud approval evidence changes.

## Engineering basis and non-claims

The product follows the sequence “verified airflow → connected network accumulation → planning size proposal,” never “diameter → invented airflow.” Final duct design still depends on equipment blower data, available static pressure, component losses, fitting losses, total effective length, installation quality, sound, and field verification.

Primary references:

- [ACCA Manual D overview](https://www.acca.org/standards/technical-manuals/manual-d)
- [ACCA Manual D design procedure](https://hvac-blog.acca.org/definitive-design-accas-manual-d-revised/)
- [ACCA Manuals J, S, and D sequence](https://hvac-blog.acca.org/when-to-consider-j-d-and-s/)
- [DOE/PNNL flex support intervals](https://basc.pnnl.gov/resource-guides/support-intervals-flex-ducts)
- [DOE/PNNL flex bends and kinks](https://basc.pnnl.gov/resource-guides/no-kinks-or-sharp-bends-flex-duct-installation)
- [Berkeley Lab flex-compression study](https://eta.lbl.gov/publications/compression-effects-pressure-loss)
- [DOE/PNNL transfer grilles](https://basc.pnnl.gov/resource-guides/transfer-grilles)
- [ASHRAE Duct Fitting Database](https://www.ashrae.org/technical-resources/bookstore/duct-fitting-database)

HVAC Plan Studio is a drafting, coordination, estimating, and review aid. It is not a Manual J, S, D, or T replacement; a permit calculation; an engineering approval; a TAB report; a manufacturer equipment selection; an automatic code-compliance determination; or a substitute for approved plans, OEM data, an AHJ, field measurements, or a responsible licensed professional.
