# Rigid Duct Phase 2C: Connect Existing Review

Status: implementation and release contract for the independently verified Phase 2C scope.

## Interaction contract

An open rigid-elbow outlet can connect to an already drawn rigid straight only through an explicit review. The selected inspector lists safe open endpoints, previews the proposed endpoint movement on the plan, states which geometry owns the connection, and requires a separate **Connect existing** action. Cancel or Escape closes the review without changing geometry or topology.

The elbow owns the theoretical centerline vertex, outbound axis, network kind, construction, size, system, sheet, and explicit outlet takeout. Applying the review:

- moves only the chosen open straight endpoint to the elbow vertex;
- projects the far endpoint onto the elbow outlet axis only when it is inside the small reviewed alignment tolerance;
- preserves the straight's construction, size, system, sheet, opposite port, and existing far-end connection;
- writes reciprocal stable references between elbow `outlet` and the chosen straight `start` or `end` port;
- copies the explicit elbow outlet takeout to the connected straight port; and
- updates both objects in one history entry, so one Undo restores the prior topology and both original endpoints.

No new straight, fitting, bend, size, takeout, or route is inferred. The existing saved-project schema remains v11 because the connection uses the stable port records already introduced in Phase 2A.

## Candidate safety rules

The review offers an endpoint only when all of these conditions hold:

- the elbow outlet and the proposed straight endpoint are both open;
- both objects are on the active source sheet and in the same HVAC system;
- network kind, construction, and exact size match;
- the straight is unlocked and is not the elbow's existing inlet straight;
- the plan scale is verified;
- the endpoint is within the outlet takeout plus a bounded screen-space review distance;
- the far endpoint lies beyond the elbow outlet and inside a narrow screen-space alignment tolerance; and
- an already connected far endpoint would not need to move.

If any relevant source geometry or topology changes while the review is open, the stored review fingerprint becomes stale and Apply rejects it with zero mutation. Uncertain or incompatible geometry remains visibly disconnected.

## Accessibility and output

- The review is available through the Selected inspector with plain-language ownership, movement values, labels, and 44 px actions.
- The active candidate receives a restrained cobalt highlight and a non-interactive plan preview.
- Keyboard Escape cancels even when focus is inside a review control.
- The preview and candidate highlight do not print or export.
- Existing direct outlet continuation, pointer/keyboard selection, Material Cobalt presentation, and HVAC semantic colors remain unchanged.

## Drafting presentation and continuation refinements

- **Compact drafting** is the default rigid-duct display. It leaves actual widths at or below 12 inches unchanged, then applies a bounded monotonic display curve to larger sizes so a 30×10 or 40×10 straight remains readable over the source plan. **True width** is an explicit toolbar and Display-settings option for checking the calibrated footprint.
- Compact mode changes only the SVG body, edges, seams, and fitting footprint. Stored dimensions, dimension labels, calibrated centerline and finished lengths, takeouts, topology, airflow metadata, Materials grouping, and ordering quantities continue to use the exact saved values.
- Connected source selection strongly marks only the active object. Other source objects retain their normal plan identity with a thin cobalt cue and no network-wide translucent flood.
- The selected-elbow inspector labels inlet and outlet values as **fitting centerline takeouts**, explicitly distinguishes them from rectangular width/height, and keeps the open red outlet visible on hover, keyboard focus, or selection.
- The red outlet has a 60 px screen-space pointer target without enlarging printed geometry. A simple click keeps the elbow selected and does not mutate the plan. Press-hold-drag-release creates one reciprocal continuation in one Undo entry; a finished-length action provides the equivalent keyboard/touch path.
- A development hot reload can clear the browser's temporary PDF file handle and return the UI to Open Plan. The saved drawing is fingerprint-bound in local storage; re-uploading the same PDF restores the exact schema-v11 drawing, geometry, topology, and Materials state. Active local review sessions should be warned before a rebuild refreshes the page.

## Verification boundary

Focused topology tests cover start/end ownership, reciprocal references, exact takeout transfer, network-kind parity, drafting-only width compression, and rejection of incompatible, distant, misaligned, occupied, or connection-breaking candidates. Real loaded-plan browser regressions cover review, Escape cancellation, explicit apply, no surprise object, one Undo/Redo, reciprocal IDs, compact/True-width switching at 139% zoom, active-versus-connected selection, 45/90-degree click-versus-drag continuation, the keyboard/touch alternative, schema-v11 save/reload after re-uploading the matching PDF, Materials integrity, responsive viewport bounds, and print chrome removal.

## Still deferred

Phase 2C does not connect two existing straight ends without an elbow, remap copied connected rigid assemblies, or introduce reducers, transitions, rectangular-to-round fittings, branches, takeoffs, offsets, collars/dampers, elevations, automatic CFM distribution/resizing, fabrication schedules, or CNC output. Those remain separate architecture and review decisions.
