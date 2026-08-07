# Rigid Duct Phase 2B: Direct Outlet Continuation

Status: merged through PR [#68](https://github.com/franciscoluna2007-pixel/hvac-plan-studio-/pull/68) in `57c5d7d9c5fcbc17f361adf8b0de840fc498a742`. No Sites deployment was performed for this GitHub-only release.

## Interaction contract

When a rigid elbow is selected and its outlet is open, the outlet exposes one screen-sized red continuation handle. The user presses that handle, drags along the elbow's explicit outbound direction, and releases to place the next rigid straight.

The gesture:

- starts from the elbow's theoretical centerline vertex while the handle remains at the true outlet tip;
- projects onto the elbow's already-defined outbound ray rather than inventing another bend;
- preserves the elbow's network kind, construction, size, system, sheet, and explicit outlet takeout;
- creates reciprocal stable port references between the elbow `outlet` and new straight `start`;
- commits the elbow update and new straight as one history entry;
- cancels without topology changes when the drag is too short or interrupted; and
- removes the straight and reopens the elbow outlet with one Undo.

The new straight remains directly editable. Its connected endpoint stays at the elbow vertex and its free endpoint remains constrained to the elbow's outbound ray. Moving the incoming straight keeps the elbow and continuation aligned. No additional fitting, takeout, size, or route is inferred.

## Measurement contract

The new straight's calibrated centerline begins at the elbow's theoretical vertex. Its explicit start takeout equals the elbow outlet takeout. Materials therefore subtracts that takeout exactly once when deriving finished straight length. The opposite end remains open with a zero takeout until another explicit fitting connection is created.

## Accessibility and output

- The selected inspector explains the open outlet and direct gesture in text, so the red state is not the only signal.
- The continuation target maintains a 44 px screen-space pointer target through supported zoom levels.
- The handle and port status remain interactive editing chrome and do not print or export.
- Existing elbow selection, keyboard focus, domain colors, and viewport-bounded action controls remain unchanged.

## Still deferred

Phase 2B does not connect an elbow to an already existing straight, choose which existing endpoint may move, or remap copied connected rigid assemblies. It also does not add reducers, transitions, rectangular-to-round fittings, rigid branches, elevations, automatic CFM distribution/resizing, fabrication schedules, or CNC output.

The next rigid-topology decision is an explicit **Connect existing** review flow with deterministic endpoint ownership and one atomic Undo. It must not silently move or connect uncertain geometry.
