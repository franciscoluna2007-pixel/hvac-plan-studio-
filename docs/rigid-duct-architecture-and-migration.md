# 2D Rigid Duct Architecture and Migration Plan

Status: reviewed implementation plan. Phase 1 is approved as a separately verified product increment. This document does not add production drawing behavior.

## Product boundary

HVAC Plan Studio remains a plan-first 2D drafting tool over calibrated PDFs. The core workflow remains **Open Plan -> Draw HVAC -> Materials -> Export**, with compact optional Plan Check. Existing flexible supply, return, and fresh-air runs and every protected T Branch, drag, copy, zoom, Undo, Redline, persistence, and export behavior remain unchanged.

Rigid duct is a separate first-class drawing family:

- rectangular sheet-metal duct;
- round metal pipe;
- spiral pipe.

Round metal and spiral may share centerline math, but they have different persisted construction values, render treatments, Materials rows, and future fabrication rules. Flexible duct remains the existing run model and does not migrate into the rigid model.

The system stays 2D. Phase 1 covers straight horizontal segments only. It must not infer fittings, vertical distance, elevation, airflow distribution, automatic sizing, or fabrication details.

## Verified current seams

The current implementation has these relevant boundaries:

- `app/page.tsx` stores plan objects in one `Drawing[]` and saves `SavedProject` version 9.
- Existing run network types are `supply`, `return`, and `fresh`; T Branch algorithms explicitly operate on those network kinds.
- Per-sheet `feetPerUnit` and `verified` scale evidence already drive measured run length.
- `setHistory` and drawing-array snapshots provide one-step Undo/Redo for geometry changes.
- plan copy templates remap IDs and support repeated placement.
- `app/materialOrder.ts` is the shared source-linked Materials/CSV aggregation engine.
- print/export already excludes interactive layers by role and CSS.

Those seams are reused, but rigid objects stay out of flex network and fitting predicates until a later topology phase deliberately supports them.

## Domain model

### Discriminant

Add a new top-level drawing type, `rigid`, rather than overloading `supply`, `return`, or `fresh`. Network semantics live in rigid metadata. This prevents existing flex/T Branch filters from accidentally resizing, splitting, repairing, or counting rigid objects.

```ts
type RigidNetworkKind = "supply" | "return" | "fresh";
type RigidConstruction = "rectangular" | "round-metal" | "spiral";

type RigidSize =
  | {
      shape: "rectangular";
      widthInches: number;
      heightInches: number;
    }
  | {
      shape: "round";
      diameterInches: number;
    };

type RigidStraightMetaV1 = {
  version: 1;
  kind: "straight";
  networkKind: RigidNetworkKind;
  construction: RigidConstruction;
  size: RigidSize;
};
```

Phase 1 rigid drawings use the existing stable envelope fields (`id`, `points`, `page`, `systemId`) plus `type: "rigid"` and `rigid: RigidStraightMetaV1`. `points` contains exactly two centerline points. The centerline is the geometry source of truth.

The legacy flat `size` string may remain temporarily for shared labels, but it is derived on normalization from numeric rigid size fields and is never an independent source of truth. Numeric inches avoid parsing ambiguity and support future fabrication calculations.

### Invariants

- Rectangular construction requires rectangular size.
- Round-metal and spiral require round size.
- Both points must be finite and distinct.
- Page and system IDs follow current drawing rules.
- Width, height, and diameter are finite positive inches within one shared policy module.
- Phase 1 geometry is a single straight segment. A bend requires a later explicit fitting or offset model.
- Network kind selects existing HVAC semantic color. Construction changes texture/edge treatment, not the supply/return/fresh meaning.
- No diameter or section size creates or changes CFM.

## Saved-project schema v10

Introduce a project-local schema module instead of adding more ad hoc restore logic to `page.tsx`.

Recommended module responsibilities:

- `CURRENT_PROJECT_SCHEMA_VERSION = 10`;
- versioned input types for v9 and v10;
- `migrateSavedProject(input: unknown): MigrationResult`;
- `normalizeRigidStraight(input: unknown): RigidStraightMetaV1 | null`;
- deterministic v10 serialization helpers;
- migration warnings that are safe to show without exposing plan content.

### Migration behavior

1. Parse the outer object defensively; malformed input remains a new-job recovery, matching current behavior.
2. For versions 1-9, preserve every existing field and drawing byte-for-byte where current normalization allows, set version 10, and add no rigid objects.
3. For version 10, normalize rigid objects and preserve all existing non-rigid drawings through the current fitting-size synchronization path.
4. Reject only an invalid rigid object, not the entire legacy project. Return a count/reason warning and retain the original raw item in a bounded local quarantine field if a recovery surface is added.
5. Never infer rigid construction from legacy flex runs, labels, sizes, colors, or nearby symbols.
6. Keep the exact PDF fingerprint and page-count binding. A schema migration never bypasses source-plan identity checks.
7. Saving always emits canonical v10. Loading the same canonical v10 and saving again must be idempotent.

The compatibility contract is forward-reader compatibility: the new application reads all existing v1-v9 saves without loss. It does not promise that an older application understands new v10 rigid objects.

### Migration tests

- representative v1, v5, and v9 fixtures migrate to v10 without drawing changes;
- the current v9 full project fixture round-trips through v10;
- empty, malformed, unknown-version, and partially invalid rigid inputs fail safely;
- rectangular, round-metal, and spiral objects round-trip exactly;
- repeated migration is deterministic and non-mutating;
- PDF fingerprint and per-sheet scales remain unchanged;
- legacy Range Hood, Dryer Vent, T Branch, Redline quarantine, and workflow records survive.

## Calibrated geometry

### True width

For a verified sheet scale:

```text
planWidthUnits = physicalWidthInches / 12 / feetPerUnit
```

The rigid body must use plan-space width so it scales with the PDF and remains truthful at every workspace zoom. Do not use a non-scaling stroke for the physical body.

- Rectangular duct renders as a filled/bounded plan-width strip.
- Round metal renders as a plan-width pipe with a restrained metal edge treatment.
- Spiral renders with the same physical diameter plus sparse diagonal seam marks, sufficiently distinct at normal and zoomed-out scales.
- The editable centerline is a separate interaction overlay. It appears on hover/focus/selection, stays screen-readable, and is omitted from print/export.
- A transparent screen-space hit path provides practical mouse/touch targeting without changing physical width.

Network colors retain their existing meanings. Construction distinction uses line pattern, boundary, and accessible text, not a new semantic color.

### Length

Phase 1 horizontal length is:

```text
hypot(end.x - start.x, end.y - start.y) * sheet.feetPerUnit
```

Rules:

- calculate from the exact drawing page's scale;
- show measured length only when that sheet scale is verified;
- otherwise show `Scale required` and do not fabricate Materials length;
- preserve full numeric precision in state and round only for display/order output;
- include no vertical/elevation distance in Phase 1;
- include no fitting takeout deduction until fittings exist.

Future finished length will subtract explicit fitting takeouts from the centerline span. It must not retroactively reinterpret Phase 1 straight length without a versioned migration.

## Phase 1 interaction model

### Placement

Add a compact `Rigid duct` tool group using the established press-drag-release gesture:

1. choose network kind;
2. choose Rectangular, Round metal, or Spiral;
3. enter the applicable size;
4. press at the first point, drag, and release at the second point;
5. commit one straight segment and one Undo entry.

Snapping and Shift direction locking may reuse current coordinate helpers. The commit path is separate from flex finish/right-click and T Branch placement reducers.

Recommended starting values, editable before placement:

- rectangular: 12 x 8 in;
- round metal: 8 in diameter;
- spiral: 8 in diameter.

These are UI seeds only, not engineering recommendations.

### Selection and editing

- Reuse normal subtle cobalt object selection, ARIA selected status, keyboard selection, and the viewport-bounded action controls.
- Direct body drag moves both centerline points as one Undo step.
- The Selected inspector edits width/height or diameter and exposes exact measured horizontal length plus scale status.
- Endpoint editing remains explicit and screen-sized; it must not create a bend in Phase 1.
- Copy/place duplicates one standalone straight rigid segment, remaps its ID, follows the cursor, supports repeated placement, and leaves each placement undoable.
- Delete, Undo/Redo, save/reload, Escape, layer visibility/lock, and keyboard access follow existing drawing conventions.
- Rotate/mirror may be implemented through endpoint transformation only if they preserve a two-point straight and one Undo step. They are not required to invent a fitting.

Rigid objects must not enter `isBranchNetworkKind`, T Branch selected-trunk resolution, fitting repair, flex airflow sizing, or connected-assembly traversal in Phase 1.

## Materials Phase 1

Extend the shared Materials input with a separate rigid-run shape:

```ts
type MaterialRigidRunInput = {
  id: string;
  networkKind: RigidNetworkKind;
  construction: RigidConstruction;
  size: RigidSize;
  measuredLengthFeet: number | null;
};
```

Aggregation keys are construction plus canonical size:

- rectangular: `width x height`;
- round metal: diameter;
- spiral: diameter.

Round metal and spiral never merge. Identical supply and return pieces may share an order row only when construction and size are identical, with both network sources preserved in the breakdown. Fresh-air provenance remains explicit.

Each row retains click-to-source drawing IDs and shows:

- exact measured LF when the scale is verified;
- the existing configurable allowance as a separate value;
- configurable 5-ft or 10-ft stock length;
- rounded stock quantity separately from exact/order LF.

An unverified sheet contributes a named `Scale required` issue and source count, not zero LF and not an invented quantity. Phase 1 adds no elbows, transitions, reducers, takeoffs, fittings, gauge, seam, pressure class, or fabrication schedule rows.

## Airflow boundary

Rigid network kind participates only in identity and visual semantics during Phase 1. Existing editable CFM may be displayed if explicitly entered, but Phase 1 must not:

- distribute CFM;
- subtract terminal demand;
- resize a segment;
- infer CFM from duct size;
- balance a branch;
- connect rigid and flex topology automatically.

The later airflow phase will use explicit graph ports and reviewed inputs. T/Y defaults may split equally, but any applied split remains editable and visible. Warnings never silently resize geometry.

## Later topology and fabrication phases

### Phase 2: explicit fittings and topology

- 90 and 45 elbows;
- rectangular radius and square elbows;
- reducers and transitions;
- rectangular-to-round connections;
- takeoffs, T/Y fittings, offsets, collars, and dampers;
- equipment, box, diffuser, grille, and register ports;
- explicit rises, drops, and elevations;
- fitting takeouts and finished straight lengths.

Connections use stable piece/port IDs. Existing flex T Branch geometry and reducers remain untouched unless a separately reviewed adapter connects the two families.

### Phase 3: reviewed airflow network

- equipment-rooted configurable design CFM;
- remaining trunk CFM after reviewed terminal assignments;
- editable branch split ratios;
- disconnected and undersized warnings with text reasons;
- no automatic route or size mutation.

### Phase 4: fabrication and shop review

- stable plan-matching piece IDs;
- rectangular straight and fitting schedules;
- full dimensions, material, gauge, pressure class, seam, end connection, liner/insulation, elevation, connected IDs, and notes;
- small 2D orientation thumbnails;
- configurable shop allowances/connectors/reinforcement;
- explicit shop approval status.

The first schedule is shop-review-ready only. It must not claim CNC flat-pattern output.

## Decision register

The following safe defaults are adopted for Phase 1 so implementation can proceed without changing the protected engine:

| Decision | Phase 1 choice | Reason |
| --- | --- | --- |
| Drawing discriminant | `type: "rigid"` | Keeps rigid objects out of existing flex/T Branch predicates. |
| Geometry source | exactly two centerline points | Supports truthful straight width/length and stable editing. |
| Size storage | numeric inches in tagged union | Avoids parsing and rectangular/round ambiguity. |
| Project schema | v10 with explicit migration module | Makes compatibility testable and removes restore guesswork. |
| Length | verified per-sheet horizontal centerline length | No inferred elevation or fitting takeout. |
| Render identity | network color plus construction pattern/boundary | Preserves semantic colors and remains accessible. |
| Copy scope | standalone rigid straight only | No unfinished topology or surprise connected assembly. |
| Materials | group by exact construction and size | Keeps round metal and spiral separate and traceable. |
| Stock choices | configurable 5 ft / 10 ft, default 5 ft | Matches the approved ordering model without changing exact LF. |
| Airflow | display explicit values only | Prevents silent engineering decisions. |

Deferred decisions requiring a later phase review include fitting parameter conventions, rectangular elbow radius defaults, connector/takeout libraries, elevation datum, gauge and pressure-class tables, piece-ID format, and shop-specific fabrication allowances.

## Phase 1 file boundaries

Expected production surfaces, subject to exact implementation review:

- one new rigid domain/schema module;
- one new rigid geometry/material helper module;
- narrow `page.tsx` integration for state, tool, rendering, inspector, persistence, copy, and history;
- narrow `materialOrder.ts` extension;
- Material Cobalt styles for the tool, physical body, centerline interaction, and print exclusion;
- focused schema, geometry, materials, source/presentation, and loaded-plan browser tests.

Do not alter direct branch placement, branch topology, fitting geometry, connection repair, flex copy traversal, airflow sizing, Redline reducers, or existing semantic color constants.

## Verification and release boundary

Phase 1 is independently releasable only when all of these pass on the exact diff:

- strict TypeScript with zero errors;
- schema migration and v1/v5/v9/v10 round-trip tests;
- rigid geometry/true-width/length tests at multiple verified scales;
- selection, direct drag/edit, one-step Undo/Redo, repeated copy/place, save/reload tests;
- separate rectangular, round-metal, and spiral Materials counts/lengths and click-to-source tests;
- real loaded-plan browser coverage at low, 100%, mid, high, and maximum zoom;
- protected 4/4 canvas interactions plus supply/return T Branch parity;
- print/export contains physical rigid geometry but no selection centerlines or action chrome;
- full unit and browser suites;
- ESLint zero errors;
- exact production build and packaged Worker/client HTTP checks;
- scoped PR with GitHub checks green;
- exact merged-commit private Sites deployment only after owner-only access is verified before and after;
- fresh authenticated production smoke.

Fittings, elevations, automatic CFM behavior, and fabrication schedules are explicit non-goals for the Phase 1 release.
