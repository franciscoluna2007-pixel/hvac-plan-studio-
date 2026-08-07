# HVAC Plan Studio Project Memory

This file contains concise, verified product context for future repository work. Current user instructions and the checked-in source of truth take precedence if this summary becomes stale.

## Product and workflow

- HVAC Plan Studio is a plan-first 2D drafting tool for HVAC contractors and superintendents working over calibrated source-plan PDFs.
- The core workflow stays in this order: **Open Plan -> Draw HVAC -> Materials -> Export**.
- Connection Check / Plan Check is compact and optional. It may explain issues, but it must not block Materials or Export.
- The source PDF, sheet, scale, saved geometry, and user judgment remain authoritative. Ambiguous or consequential changes require explicit review and remain undoable.

## Material Cobalt direction

- The accepted interface is Material Cobalt: calm premium-modern neutrals, precise typography, readable spacing, shallow functional depth, and one disciplined interface accent around `#002FA7`.
- Cobalt is for the logo, primary actions, active navigation, selection, and focus. The desktop composition is the visual north star; tablet and mobile use responsive drawers and the same hierarchy.
- Preserve HVAC domain colors: supply blue, return red, fresh-air green, yellow T Branch body, green connected/properly sized ports, red disconnected or undersized T Branch legs/ports, red Redline, amber warning, and red critical/error.
- Status cannot rely on color alone. Keep readable text, accessible names, keyboard focus, and at least 44 px coarse-pointer targets.

## Protected drawing behavior

- Preserve supply, return, and fresh-air runs; equipment; supply/return terminals and diffusers; fittings; T Branches; Range Hood; and Dryer Vent.
- T Branch placement uses press-drag-release on the selected eligible trunk, splits that trunk exactly once, preserves topology through free rotation and repair, and restores the prior topology with one Undo. Supply and return share the same network-kind-agnostic behavior.
- Preserve direct object and run dragging, cursor-centered ordinary wheel zoom, pan, right-click connected-assembly Copy, repeated paste, Escape exit, delete, Undo/Redo, keyboard selection, saved-plan persistence, reload, and compatible serialization.
- Normal selection uses a subtle cobalt highlight without an automatic bounding box, resize handles, or circular guide. Editing remains available in the Selected inspector. The single adaptive action control set stays viewport-bounded through 1200% zoom.
- T Branch bodies are modestly heavier than ordinary runs. Warning legs remain visible in passive viewing; exact port dots appear only on fitting hover, focus, or selection and never print or export.
- Do not change interaction reducers, controllers, geometry, snap points, connection rules, saved data, or drawing semantics during presentation-only work.

## Materials and export

- Materials must be derived from plan objects, use simple order quantities, and retain click-to-source traceability.
- Group identical order items by real type and size. Same-size supply and return flexible duct may share an order row when the purchased item is identical; fresh-air duct remains separate. Range Hood and Dryer Vent remain separate counted items.
- Do not fabricate duct lengths, airflow, engineering data, or readiness. Preserve exact measured values separately from ordering allowances or package rounding.
- Export and print must omit interactive selection, action controls, guides, hover dots, and other editing chrome.

## Airflow and sizing provenance

- System airflow is live and editable. The default `400 CFM/ton` value is a coordination seed, not verified design airflow, a room-load calculation, or permission to resize silently.
- The versioned `field-chart-v1` flexible, round-metal, and rectangular capacities came from the provided field airflow chart. They remain editable project inputs and must not be presented as universal engineering limits or substituted for approved plans, OEM data, applicable procedures, field measurements, or licensed review.
- Flexible-duct chart values currently drive flex sizing suggestions. Round-metal and rectangular tables are preserved for future rigid-duct work. The default long-run threshold is 25 ft; a recommendation may move up one available chart size, but the application does not silently apply it.
- Network totals, assigned CFM, remaining CFM, connection state, and undersized/disconnected warnings must stay explicit. Duct diameter alone never establishes airflow.

## 2D rigid-duct roadmap

- The reviewed architecture, schema-versioning, migration, phase boundaries, and decision register are in `docs/rigid-duct-architecture-and-migration.md`.
- Phase 1 is released: saved-project schema v10 with backward migration and invalid-object quarantine; true-width horizontal straight rectangular, round-metal, and spiral segments; calibrated lengths; editable sizes; selection/history/copy/persistence; and initial source-linked Materials aggregation.
- Phase 1 deliberately excludes rigid fittings, elevations/vertical length, automatic CFM distribution or resizing, and fabrication schedules. Keep those for later independently reviewed phases.
- Add first-class rectangular sheet-metal duct, round metal pipe, and spiral pipe while keeping existing flex unchanged. Round and spiral may share geometry but remain distinct render and material/order types.
- Rigid duct renders at true calibrated width while an editable centerline remains the geometry source of truth. The system stays 2D; rises, drops, and elevations are explicit fields.
- Planned fittings include straight sections, 45/90 elbows, rectangular radius/square elbows, reducers, transitions, rectangular-to-round connections, takeoffs, T/Y fittings, offsets, collars/dampers, and equipment/box/terminal connections.
- Finished straight length is measured between fitting takeouts so fittings are not double-counted. Preserve exact measured length separately from configurable 5-ft/10-ft stock quantities and allowance.
- Preserve configurable airflow networks and explicit warnings without silent resizing. Add traceable grouped Materials plus a shop-review-ready rectangular fabrication schedule with plan-matching piece IDs and 2D orientation thumbnails. Do not initially claim CNC flat-pattern output.
- Require backward-compatible migrations, save/reload, Undo, selection, copy/paste, print/export without chrome, Materials traceability, supply/return parity, unit tests, and real loaded-plan browser tests at multiple scales and zooms.

## Release and mixed-worktree safety

- Do not weaken strict TypeScript. Release gates are zero TypeScript errors, zero ESLint errors, the full unit suite, real loaded-plan browser coverage for protected interactions, an exact production build, packaged Worker/client HTTP verification, and production smoke when deploying.
- Stage explicit reviewed paths only. Preserve unrelated tracked/untracked work, caches, skills, `.qa-temp`, and `tsconfig.tsbuildinfo`; never use broad destructive cleanup in a mixed worktree.
- For Sites, reuse `.openai/hosting.json`, push and package the exact merged SHA, save one version, require verified owner-only access for private deployment, poll to `succeeded`, verify the canonical URL in a fresh browser, and remove only the temporary deployment archive.
- Do not commit, push, merge, deploy, modify external accounts, or add subscription work without current authorization.

## Current verified state and next step

- Rigid-duct Phase 1 PR [#66](https://github.com/franciscoluna2007-pixel/hvac-plan-studio-/pull/66) merged as `37cc9346d057f0ac5a243904f7ac4a5306d59fef` after zero TypeScript/ESLint errors, 485 unit/source tests, 25 loaded-plan browser tests, repository security/quality checks, and an exact merged-SHA production build/package validation.
- Sites version 173 was built from that exact merge, privately deployed and production-verified with one owner, zero groups, and zero external visitors. A fresh authenticated loaded-plan smoke covered rectangular, round-metal, and spiral placement, sizing, movement Undo, repeated copy, schema v10 save/reload, and separate Materials rows.
- Existing flex, supply/return/fresh-air, T Branch, symbol, selection/action-control, domain-color, persistence, Materials, and export behaviors remain protected.
- Rigid-duct Phase 2A/2B is implemented and verified on the isolated `feature/rigid-duct-phase2` branch for its approved GitHub merge. Schema v11 adds stable rigid straight/elbow ports, explicit 45/90-degree elbows, explicit takeouts, takeout-aware finished straight lengths, separate elbow Materials counts, and press-drag-release continuation from an open elbow outlet. See `docs/rigid-duct-phase2a.md` and `docs/rigid-duct-phase2b.md`.
- The combined Phase 2 gates passed with zero TypeScript errors, zero ESLint errors, 496/496 unit/source tests, 26/26 loaded-plan browser tests, the exact five-stage production build, validated existing-project hosting manifest, and packaged Worker/client HTTP 200. The pre-existing 38 ESLint warnings and `tsconfig.tsbuildinfo` hash remained unchanged. This approval covers GitHub merge only; no Sites deployment is included.
- Next product decision: design the explicit Connect existing review flow with deterministic endpoint ownership and one atomic Undo. Do not infer radius/takeout fabrication values or begin elevations, automatic CFM, wider fitting families, or fabrication schedules until their independently bounded contracts are approved.
