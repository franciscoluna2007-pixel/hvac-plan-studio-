# Rigid Duct Phase 2A: Explicit Elbow Topology

Status: implemented and verified as the fitting-topology foundation for the approved Phase 2 GitHub merge. Sites deployment is outside this release scope.

## Review boundary

Phase 2A adds the smallest fitting-aware foundation that can preserve shop-relevant measurements without guessing:

- saved-project schema v11 with backward migration from v1-v10;
- stable port IDs and connection references for rigid straights and elbows;
- explicit 45-degree and 90-degree elbows for rectangular, round-metal, and spiral duct;
- rectangular radius and square elbow presentation;
- explicit user-entered inlet and outlet takeouts;
- finished straight length calculated as calibrated centerline length minus connected fitting takeouts;
- separate, source-linked Materials counts for straight rigid duct and elbows; and
- selection, direct connected movement, one-step Undo, deletion repair, save, and reload coverage.

Existing flexible duct, supply/return/fresh-air runs, T Branches, symbols, reducers/controllers, and HVAC semantic colors remain on their established paths.

## Topology contract

A rigid straight owns stable `start` and `end` ports. An elbow owns stable `inlet` and `outlet` ports. Each connection stores the other drawing ID and port ID rather than relying on drawing order or proximity.

The connected straight endpoint is the elbow vertex. Moving the straight keeps the elbow vertex synchronized, and one Undo restores both objects. Deleting the elbow opens the straight port and restores its zero takeout; Undo restores the connection.

Phase 2A connects a newly created elbow inlet to one selected straight endpoint. The elbow outlet remains explicitly open. It does not manufacture a continuation segment or infer a downstream connection.

## Measurement and ordering rules

- Calibrated centerline length remains the geometric source of truth.
- Takeouts are explicit per connected port and are not inferred from elbow angle, radius, construction, or duct size.
- Finished straight length is `centerline - start takeout - end takeout`.
- A connected port with a missing takeout blocks finished length and stock ordering with `Takeout required`.
- An unverified plan scale continues to block measured rigid ordering with `Scale required`.
- Elbows are counted as discrete fittings and are grouped by construction, size, angle, and rectangular elbow style while retaining source drawing IDs and network provenance.

These rules prevent fittings from being double-counted without presenting an assumed shop allowance as a measured value.

## Deliberate non-goals

Phase 2A does not add:

- an outlet-to-new-straight continuation gesture;
- connection of two existing straights through an elbow;
- reducers, transitions, rectangular-to-round fittings, takeoffs, rigid T/Y fittings, offsets, collars, or dampers;
- vertical rises/drops, elevation-derived length, or inferred 3D geometry;
- automatic CFM distribution, sizing, or resizing;
- fabrication schedules, fitting thumbnails, CNC flat patterns, or shop allowances; or
- connected rigid-assembly copy/paste.

## Phase 2B decisions required

1. **Continuation gesture:** choose whether dragging from an open elbow outlet creates a straight, or whether a separate Connect action joins an existing straight. Either path must remain explicit and undo atomically.
2. **Two-existing-segment connection:** define which endpoint moves, or require a reviewed adjustment, when geometry does not already meet the elbow vertex.
3. **Rectangular radius data:** decide whether radius is stored as a centerline radius, throat radius, or radius ratio. Do not derive fabrication dimensions until this is fixed.
4. **Takeout ownership:** retain per-port explicit takeouts as the measurement contract; decide whether later fitting templates may propose values that still require user confirmation.
5. **Deletion and healing:** define whether deleting a fitting ever reconnects two collinear straights. Phase 2A only opens the surviving connected port.
6. **Connected copy:** define new IDs and internal connection remapping for a copied rigid assembly before enabling it.
7. **Next fitting family:** review reducers/transitions separately from branch fittings because their dimensions and topology differ.

No Phase 2B production work should be merged or deployed until its interaction and migration boundary is independently reviewed and verified.
