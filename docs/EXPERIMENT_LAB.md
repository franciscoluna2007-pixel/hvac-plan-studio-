# HVAC Plan Studio Experiment Lab

The Experiment Lab is an isolated, opt-in route at `/experiment-lab` for differential geometry checks. It runs the current Plan Studio geometry and one pinned candidate adapter from the same editable plain-data input, then redraws both outputs and records their differences.

## Availability boundary

- The lab does not appear in production navigation.
- The route returns Not Found unless `NEXT_PUBLIC_EXPERIMENT_LAB_ENABLED=1` is set for that build.
- A default build therefore returns 404 at the direct route.
- An owner-only private Sites release may enable the route only when access is independently verified after deployment.
- Enabling the route does not grant access to projects, storage, uploads, network calls, or deployment controls.

## Current live comparisons

### Elbow tangent trim

Editable inputs include the vertex, plan scale, rectangular size, angle, turn, style, inbound axis, and both fitting takeouts. The product baseline is `rigidElbowGeometry`; the candidate is a bounded adapter over `@flatten-js/core` 1.6.12.

### Rectangular reducer outline

Editable inputs include the inlet, plan scale, inlet and outlet dimensions, reducer length, axis, and alignment. The product baseline is `rigidTransitionPolygon`; the candidate is a bounded adapter over `@flatten-js/core` 1.6.12.

Every input change redraws both live previews immediately. A live preview is not an evidence receipt. Changing any input, experiment, or reset state invalidates the previous completed receipt and disables copy/export.

## Evidence lifecycle

1. Edit live geometry inputs.
2. Inspect the product and candidate redraws.
3. Select **Run comparison** to create a completed receipt from those exact inputs.
4. Review the side-by-side redraws, difference overlay, coordinate/scalar deltas, finite-value checks, status, and provenance.
5. Copy or export only that completed receipt.

Only `status: "match"` is positive differential evidence. `mismatch`, `rejected`, and `candidate-error` never authorize adoption. A match is still not permission to commit, merge, deploy, make an engineering claim, or issue fabrication data.

Each receipt records:

- contract and adapter versions;
- fixture and comparison kind;
- baseline source and immutable baseline revision;
- candidate package and exact package version;
- coordinate and scalar deltas;
- finite-value checks;
- run status and rejection reason when present;
- actual run timestamps added by the route.

## Safety boundary

- The adapter accepts only an immutable plain-data geometry envelope.
- The lab has no localStorage, IndexedDB, project-store, upload, fetch, cloud-client, or production-workspace import.
- It cannot change HVAC runs, fittings, topology, CFM, Materials, saved projects, private-site access, or release state.
- No performance claim is made by the interactive comparison. Performance adoption requires controlled warm-up, repeated samples, median and p95, and representative loaded-plan browser traces.
- The lab does not establish Manual D or code compliance, pressure or friction loss, measured airflow, automatic balancing, or fabrication approval.
- The product geometry remains authoritative until a separately reviewed and authorized production change replaces it.

## Adding another adapter

1. Define a versioned product-owned input and receipt contract.
2. Keep the production implementation authoritative.
3. Pass the candidate an immutable plain-data payload only.
4. Redraw baseline and candidate outputs from the returned receipt rather than from illustrative markup.
5. Fail closed on malformed input, non-finite output, adapter exceptions, or a protected mismatch.
6. Invalidate receipts whenever an input changes.
7. Require deterministic unit/property tests, a real browser interaction test, full loaded-plan regression coverage, an exact build, and separate release authorization.
