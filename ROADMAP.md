# HVAC Plan Studio Product Roadmap

## Product direction

Build the most practical approval-first HVAC plan-markup platform for contractors, estimators, reviewers, and field teams.

The product should combine fast manual drafting, explainable plan intelligence, transparent calculations, source-backed takeoff, and controlled releases without pretending that software has replaced engineering judgment or field verification.

## Guiding principles

1. Manual geometry remains authoritative.
2. AI proposes; a person approves.
3. Every recommendation exposes its evidence and assumptions.
4. Geometry, CFM, sizing, and release changes remain undoable and reviewable.
5. Systems and zones never connect across boundaries automatically.
6. Changed evidence invalidates stale decisions.
7. Planning calculations are never presented as professional design approval.
8. Field readability matters as much as desktop capability.

## Status legend

- **Shipped** — deployed and verified on the production site.
- **Release candidate** — implemented in the working tree; verification and deployment remain.
- **Planned** — approved product direction; implementation has not shipped.

## Shipped foundation — v98 through v110

**Status: Shipped**

The foundation includes:

- PDF plan viewing, zooming, navigation, calibration, and bounded ultra-HD rendering.
- Editable supply, return, fresh-air, measurement, symbol, and fitting geometry.
- Run-first T/Y placement, snapping, connection repair, copy, sizing, and undo/redo.
- Project Home, guided setup, system workflow, and command navigation.
- Supabase projects, members, immutable revisions, approvals, RLS, and release integrity.
- Google Drive plan import and verified package export.
- AI Plan Reader with source-linked PDF-text evidence.
- Evidence-bound Plan Intelligence findings, RFIs, punch items, and stale-decision detection.
- System Balance Studio with room CFM, connected-network review, sizing candidates, and named checkpoints.
- Source-backed takeoff packages and field-release gates.
- Tablet and stylus interaction, 4K rendering controls, and workspace-wide readability improvements.
- Public local-project access with optional authenticated cloud features.

## v111 — Intelligent HVAC Markup Assistant

**Status: Shipped**

### Goal

Turn current drawing findings, branch opportunities, and sizing candidates into one evidence-backed recommendation workspace without surrendering manual control.

### Implemented scope

- Prioritized recommendation queue with open, critical, and all views.
- Observed condition, why-it-matters explanation, safe proposed action, evidence, and confidence.
- Live-plan previews for linked drawing objects.
- Live-plan ghost previews for T/Y opportunities derived from existing runs.
- Revalidation of T/Y evidence before arming the existing placement workflow.
- Links into Plan Intelligence decisions and System Balance Studio.
- Explicit approval-first and manual-geometry policy throughout the UI.

### Release gates

- Recommendation output is deterministic for identical evidence.
- No recommendation mutates drawing geometry when generated or previewed.
- A T/Y can be armed only after approval and must still be confirmed on the plan.
- Changed geometry invalidates the old recommendation and session decision.
- Open and critical counts reflect the current review session.
- Keyboard behavior, status announcements, and focus restoration remain accessible.
- No safety, warning, or evidence text is smaller than 13 px on desktop; workflow body text is at least 12 px; mobile text is at least 12 px.
- All interactive targets are at least 44 px.
- Production build, lint, automated tests, and the interaction QA matrix pass.
- Product documentation and roadmap describe boundaries accurately.

### Current boundary

The assistant’s lightweight Approve/Reject state is session-level. Durable decisions must be recorded through the existing Plan Intelligence decision workflow until a future revision adds persistent assistant-session records.

The assistant does not infer walls, room polygons, obstructions, loads, or exact equipment locations from graphical plan content.

## v112 — Transparent Duct Sizing Engine

**Status: Shipped**

### Goal

Extract and harden the current sizing calculations into a versioned, independently testable engine that explains every input, formula, limit, and blocked recommendation.

### Implemented scope

- Pure calculation module for round area, velocity, capacity, rough flex friction, equivalent length, segment loss, explicit pressure basis, airflow allocation, and transition checks.
- Explicit calculation version and sizing-policy snapshot.
- Airflow provenance for every result: user-entered, reviewed room target, terminal-linked, or planning seed.
- Current-versus-proposed diameter, velocity, friction, rough pressure drop, and capacity status.
- User-controlled supply, return, and fresh-air limits.
- Residential flex maximum with 16 inches as the supported company ceiling.
- Parallel-path alternatives when one supported flex run is over capacity.
- One reviewed apply transaction and one-step Undo.
- Sizing evidence included in System Balance checkpoints and release fingerprints.
- No diameter-derived CFM fallback and no automatic branch-network resize path.
- Manual CFM cannot undercut known connected downstream demand.

### Safety gates

- Planning-seed terminal CFM cannot drive an applied size change.
- Disconnected paths cannot masquerade as calculated networks.
- Over-capacity recommendations cannot be applied.
- Scale-dependent pressure results require verified scale.
- The engine cannot reroute ductwork, add parallel paths, or select equipment automatically.
- Results remain planning screens, not Manual D or manufacturer selection.

### Required verification

- Unit tests for round-duct area and velocity.
- Boundary tests for every supported diameter and velocity limit.
- Manual-CFM precedence and disconnected-path tests.
- Explicit available-static-pressure and total-effective-length tests.
- Over-capacity, parallel-path, and 16-inch maximum tests.
- Pressure-loss monotonicity tests.
- Evidence-fingerprint and stale-review tests.
- Golden tests for representative residential systems.

## v113 — Takeoff Intelligence

**Status: Planned**

### Goal

Convert reviewed geometry and sizing evidence into more accurate purchasing and fabrication packages.

### Planned deliverables

- Material-aware runs: flex, round metal, rectangular metal, lined duct, and fresh-air duct.
- Verified 25-foot flex-box purchasing logic by diameter.
- Waste, fitting, reducer, damper, can, grille, insulation, hanger, sealant, and accessory rules.
- Separate measured quantity, order quantity, and field-verification allowance.
- Fabrication holds tied to unresolved geometry or sizing evidence.
- Revision comparison for changed quantities.
- Vendor-ready CSV and Drive packages.

## v114 — Professional Plan Review

**Status: Planned**

### Goal

Make plan review and revision coordination suitable for repeatable internal and external QA.

### Planned deliverables

- Revision-to-revision drawing and finding comparison.
- New, changed, resolved, and reopened issue states.
- Evidence history for RFIs, punch items, decisions, and approvals.
- Reviewer assignments and due dates.
- Controlled plan-audit package with source references.
- Release-impact summary when geometry, CFM, rules, or approvals change.

## v115 — Advanced Plan Intelligence

**Status: Planned**

### Goal

Improve source-plan understanding beyond page-level text extraction.

### Planned deliverables

- PDF text coordinates and source-region highlighting.
- OCR workflow for scanned sheets.
- Cross-sheet equipment, schedule, legend, and air-device relationships.
- Source-revision change detection.
- Confidence and coverage reporting by sheet and evidence type.
- Human confirmation before extracted objects influence markup or sizing.

This milestone will not claim complete computer vision, automatic code compliance, or autonomous HVAC design.

## v116 — Company Design Style Engine

**Status: Planned**

### Goal

Encode company drafting preferences as visible, editable, approval-first standards.

### Initial standard profile

- Flex-heavy residential routing with minimal hard duct.
- Main trunk deep first, then branch backward.
- Blue supply, yellow T/Y branches, red return, and green fresh air.
- Square diffuser symbols and field-readable run-size labels.
- 16-inch residential flex maximum.
- More T/Y use and gradual duct-size reduction.
- Separate systems and zones.
- Original unit locations and floor-plan geometry preserved.
- Bedroom return-path review.
- Additional review for west glass, sliders, high ceilings, and door-closed rooms.

Style rules will generate recommendations and QA findings; they will not automatically redraw a plan.

## v117 — Commercial Product Release

**Status: Planned**

### Goal

Prepare HVAC Plan Studio for dependable multi-company production use.

### Planned deliverables

- Organization workspaces and role administration.
- Subscription, entitlement, and usage controls.
- Customer onboarding and guided sample projects.
- Audit exports and administrative analytics.
- Backup, retention, recovery, and incident procedures.
- Performance budgets for large plan sets.
- Accessibility and tablet acceptance testing.
- Security review, operational monitoring, and support workflows.
- Production documentation and customer-facing non-claims.

## Cross-release field-release gates

A release remains blocked until applicable gates are clear:

- Runs exist.
- Critical findings are corrected.
- Warnings are reviewed.
- Device and fitting connections are physically aligned.
- Elevations are coordinated.
- Terminal rooms are assigned.
- Scale is verified.
- Field checklist is complete.
- RFIs are approved or closed.
- Critical punch items are closed.
- The current cloud revision is named, unchanged, and approved.

A prior release becomes stale when signed drawing geometry, room targets, calculation rules, review decisions, RFI or punch state, or cloud approval evidence changes.

## Permanent product boundaries

HVAC Plan Studio is a drafting, coordination, estimating, and review aid. No roadmap milestone should market it as:

- A Manual J, S, D, or T replacement.
- A permit calculation.
- A professional engineering approval.
- A TAB report.
- A manufacturer equipment selection.
- An automatic code-compliance determination.
- A substitute for field measurements, approved plans, OEM data, an AHJ, or a responsible licensed professional.

The product succeeds when it makes evidence, assumptions, decisions, quantities, and changes easier to inspect—not when it hides uncertainty behind automation.
