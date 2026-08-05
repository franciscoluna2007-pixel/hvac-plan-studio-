# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

HVAC Plan Studio is built first for HVAC superintendents and one-person HVAC contractors. They work from construction-plan PDFs in office and field settings, and they need to mark systems, coordinate airflow, prepare takeoffs, resolve plan issues, and produce controlled field information without handing geometry decisions to an automated designer.

## Product Purpose

HVAC Plan Studio keeps the source plan and editable HVAC work together. It helps users draw and connect HVAC systems, coordinate reviewed airflow, inspect plan findings, prepare material quantities, capture field redlines, and issue a controlled field package.

Success means a user can move from an exact source PDF to clear, editable, reviewable HVAC information while retaining professional judgment and direct control over every consequential plan change.

## Positioning

The defining promise is professional HVAC work directly over the source PDF, with important changes always visible, reviewable, undoable, and controlled by the user. The product exposes evidence, assumptions, calculations, proposed changes, and approval state instead of behaving like an autonomous HVAC designer.

## Operating Context

- Users open local or Google Drive plan PDFs, work sheet by sheet, and preserve the exact source fingerprint and drawing scale.
- The normal job spans plan setup, supply and return routing, T Branch placement, equipment and terminal connections, airflow and size review, takeoff, field checks, and release.
- Work happens on desktop, tablet, and mobile web interfaces, including touch and stylus use in field conditions.
- Local guest work remains available until a user chooses authenticated cloud collaboration.
- Field Redline Studio is a source-bound annotation workspace within HVAC Plan Studio, not a separate product or engineering repair engine.

## Capabilities and Constraints

- The product maintains editable HVAC geometry over a source-plan PDF.
- It supports supply, return, and fresh-air runs; equipment and terminals; T Branch fittings; measurements; notes; field redlines; connected-network review; takeoff; revisions; and controlled release.
- Reviewed airflow, velocity, capacity, pressure evidence, and system connectivity govern engineering checks. Duct diameter alone never implies airflow.
- Manual geometry and professional judgment remain authoritative.
- Proposed physical changes must be previewed, source-bound, revalidated when applied, and undoable.
- Ambiguous connections require a user choice. The product must not silently connect, move, resize, or redraw uncertain geometry.
- Field Redline Studio cannot change HVAC runs, sizes, CFM, fittings, equipment, connections, material quantities, approvals, or release state.
- Residential flex recommendations remain at 16 inches or below unless the project uses an explicitly reviewed alternative such as hard duct or parallel paths.
- Existing saved-plan geometry must remain stable when interaction behavior or fitting presentation improves.

## Brand Commitments

- The product name is **HVAC Plan Studio**.
- **Redline** is shorthand for the drawing and field-markup experience inside HVAC Plan Studio; it is not the main product name.
- The user-facing rules profile is **HVAC Plan Studio Standard** or **Studio Standard**.
- Product language should be direct, practical, field-aware, and honest about evidence and uncertainty.
- Internal release numbers and engineering implementation labels are not product-facing brand names.

## Evidence on Hand

- The working application and its interaction behavior are implemented under `app/`.
- `README.md` documents shipped capabilities, safety boundaries, and the product workflow.
- `ROADMAP.md` records product outcomes, permanent operating principles, and release history.
- Automated checks under `tests/` cover plan interaction, saved topology, approval boundaries, calculations, accessibility-related controls, and release behavior.
- The repository contains no approved customer testimonials, customer logos, market-share claims, or performance benchmarks; future work must not fabricate them.

## Product Principles

1. **The source plan stays authoritative.** Every drawing, review, and redline remains tied to the correct PDF, sheet, scale, and source state.
2. **The user controls consequential change.** Important geometry and engineering changes are visible, deliberate, reviewable, and undoable.
3. **Complex field work should feel obvious.** Common drafting actions should require minimal explanation while refusing ambiguous or unsafe outcomes.
4. **Evidence outranks confidence.** The product shows what is known, inferred, missing, stale, or awaiting review instead of disguising uncertainty.
5. **Field output must remain trustworthy.** Takeoffs, marked plans, approvals, and releases clearly communicate readiness, draft state, and unresolved blockers.

## Accessibility & Inclusion

The web interface must support keyboard navigation, touch-sized controls, stylus and palm-safe drawing, readable working text, responsive mobile and tablet layouts, and interaction states that do not depend on color alone. Field workflows must remain usable on large plan canvases and compact screens.
