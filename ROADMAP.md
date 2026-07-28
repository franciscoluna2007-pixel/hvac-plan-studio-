# HVAC Plan Studio — Product Overview and Roadmap

Last revised: July 28, 2026

## Product overview

HVAC Plan Studio is a plan-markup, airflow-coordination, review, takeoff, and field-release workspace built first for HVAC superintendents and one-person businesses. Larger-company administration remains a later-stage product area.

The product keeps the source PDF and editable HVAC overlay together. A user can trace supply, return, and fresh-air systems; place equipment and air devices; connect T/Y fittings; coordinate room CFM; review connected-network sizing; prepare purchasing quantities; and release a controlled field package.

The product is not an autonomous HVAC designer. It makes evidence, calculations, assumptions, object changes, and human decisions visible. Manual geometry remains authoritative, and every physical assistant change is previewed, fingerprint-bound, revalidated at commit time, and undoable.

## Primary job workflow

Every primary workspace now uses the same five plain-language job steps:

1. **Plan Setup** — read the PDF and review only missing or conflicting plan information.
2. **Draw & Detail** — draw supply routes first, number and confirm flex runs, add returns, then connect and repair.
3. **Airflow & Sizes** — review room airflow, connected paths, and duct sizes.
4. **Fix Plan** — see the issue, its location and evidence, the proposed change, and approve or skip one fix at a time.
5. **Materials & Print** — review materials, blockers, and the field package.

Plan setup reads the PDF in the background for drawing scales, rooms, ceiling heights, equipment, systems, zones, and missing information. It does not block basic drawing; only work that depends on an unconfirmed fact pauses.

Users may open a PDF directly and begin drawing, or choose guided setup first. Both paths use the same source validation and background plan reading, and setup remains available later.

Advanced coordination remains available without crowding the first screen.

## Detailed product workflow

1. Open a local or Google Drive plan PDF.
2. Confirm the source revision, working system, and scale.
3. Draw the supply routes before stopping to enter every run detail.
4. Number the flex runs, confirm their sizes, add return runs and grilles, then connect and repair loose endpoints.
5. Assign reviewed room or terminal airflow.
6. Trace airflow through physically connected equipment-rooted networks.
7. Review one current issue in Fix Plan, including its evidence, affected objects, proposed change, and expected result.
8. Approve or skip the current eligible action; each approved repair remains fingerprint-bound and undoable.
9. Review the actual takeoff delta and durable repair receipt.
10. Resolve RFIs, punch items, connections, approvals, and field checks.
11. Save a named cloud revision and issue the field package.

## Permanent operating principles

- Manual plan geometry is authoritative.
- The assistant may inspect, prepare, or guided-apply; it never silently mutates a plan.
- Diameter never creates CFM. Reviewed airflow flows into the network; the network can then produce size candidates.
- Terminal CFM changes and network-size changes are separate stages. New CFM invalidates old size candidates.
- Equipment, walls, rooms, new routes, route endpoints, intermediate vertices, and cross-zone changes remain manual. Approved size fixes update size metadata without moving route points.
- T/Y topology changes require confirmation on the live plan.
- A changed evidence fingerprint applies zero stale actions.
- A prepared batch is bound to the exact repair-plan ID as well as its evidence fingerprint.
- No safe fix is selected automatically; the user chooses each fix or explicitly selects the compatible fixes in the current step.
- A guided batch changes only the reviewed object set and creates one Undo entry.
- A transparent assistant layer shows review zones only; it does not claim exact engineered device placement and never creates plan objects.
- Overlay review zones require the current source fingerprint, readable exact room regions, verified scale, and sufficiently certain equipment/system context. Multiple unresolved systems or unreadable source areas block the layer.
- Connection repair may move only an approved existing run endpoint to its reviewed target. It creates no route, branch stub, fitting, terminal, or other drawing object.
- Contextual icon, run, and fitting wheels expose only actions appropriate to the selected object.
- Duct-label presentation changes never change duct size, geometry, CFM, connectivity, or system assignment.
- Planning calculations never become a Manual J, S, D, or T result by changing a label.
- Warning, evidence, and consequence text is workstation-readable: 15 px working copy, 13 px metadata, 12 px labels, 44 px controls.
- Generated mock product imagery is not used. Social preview images must be an approved capture of the real built or production interface; otherwise image metadata stays absent.

## Release status

| Release | Product outcome | Status |
|---|---|---|
| v98–v110 | Drafting, cloud projects, Plan Intelligence, balance, takeoff, field release, tablet/4K foundation | Shipped |
| v111 | Evidence-backed Intelligent HVAC Markup Assistant | Shipped |
| v112 | Versioned transparent duct-sizing engine | Shipped |
| v113 | Guided Repair Plan and controlled network resizing | Shipped |
| v114 | Repair receipts and before/after takeoff intelligence | Shipped |
| v115 | Advanced Plan Intelligence, source regions, and coverage | Shipped |
| v116 | My HVAC Rules | Shipped |
| v116.1 | Solo Operator Workflow and usability simplification | Shipped |
| v120 | Smart Plan Setup & Repair | Shipped |
| v121 | Simple Job Workflow | Shipped |
| v122 | Smart Scale & Draw-First Workflow | Shipped |
| v123 | Markup Assistant Fixes 2.0 | Shipped |
| v124 | Open PDF & Draw | Shipped |
| v125 | Setup When You Need It | Shipped |
| v126 | Direct Symbol Editing | Shipped |
| v127 | Compact Symbol Workflow | Shipped |
| v128 | Fix Plan & Contextual Markup | Shipped |
| v129 | One Job Screen | Shipped |
| v130 | Answer & Fix in Place | Shipped |
| v131 | Room-by-Room Markup | Next |
| v132 | Finish the Job | Planned |
| v117 | Multi-company commercial operations | Planned for later |

## v129 — One Job Screen

### Outcome

A superintendent or one-person HVAC business can enter one current job, see one recommended next action, and use one Fix Plan for every plan problem without learning which overlapping panel owns the work.

### Shipped capabilities

- Jobs Home presents one primary job action and keeps device PDF, Google Drive, optional guided setup, drag-and-drop, saved jobs, and recent jobs in a compact supporting layer.
- The old Preferred start control is removed from the visible home screen.
- Recent Jobs sits directly below the start area instead of below competing setup choices.
- Plan checks, audit findings, prepared repairs, and connection-review links converge on the same Fix Plan route and naming.
- The working panel shows only the current workflow card; duplicate current-step summaries, future cards, and duplicate Plan Helper launches remain hidden.
- Show where uses the actual Plan Helper rectangle to place the selected object in the largest uncovered canvas region.
- Same-sheet and cross-sheet focusing share the same viewport-safe behavior. On a small screen where Plan Helper covers the drawing, the helper closes and leaves the exact issue selected.

### Safety boundary

v129 changes entry, navigation, focus, and visual hierarchy only. It does not treat navigation progress as engineering completion, waive missing equipment or return information, clear connection or sizing problems, alter source evidence, change geometry, or relax field-package and release gates.

## v130 — Answer & Fix in Place

### Outcome

A superintendent or one-person HVAC contractor can handle the current supported review issue in one compact Fix Plan card through search, job-condition answer, exact preview, named approval, result, and Undo.

### Shipped capabilities

- Fix Plan searches only current evidence-backed actions and keeps the selected issue, exact change preview, approval, result, and Undo together.
- Existing review issues can be answered as accepted with a note, an RFI, a punch item, or **Handled elsewhere** from the same card.
- Ready connection repairs require a named reviewer and explicit final confirmation before the reviewed endpoint can move.
- Scale, room, airflow, and sizing conditions still use their dedicated source-linked tools when structured evidence is required.
- The exact before-and-after change remains visible before approval instead of being hidden inside evidence details.
- Category-limited **Handled elsewhere** records capture the reviewer, reason, note or reference, plan page or system, time, and the current source and evidence fingerprints.
- A changed source or evidence fingerprint makes the related answer or condition record stale and requires review again.
- An applied fix reports its result in the same card and retains one Undo.

### Safety boundary

Answers are project- and source-bound, not company rules. A detected value still needs confirmation, and a user-entered value stays labeled as such. **Handled elsewhere** records document workflow context only: they do not resolve engineering findings, satisfy airflow or pressure requirements, change geometry, or clear purchasing, field-package, or release gates. Any source or evidence fingerprint change makes the record stale.

## Next solo-operator releases

### v131 — Room-by-Room Markup

Turn sufficient PDF evidence into a room checklist and toggleable ghost supply/return candidates. The user confirms, moves, edits, or rejects each candidate; uncertain rooms, systems, scale, and return strategy remain explicit questions rather than automatic placement.

### v132 — Finish the Job

Guide materials review, unresolved holds, field checklist, revision naming, print, and share as one closeout path for a superintendent or one-person business. Multi-company administration remains postponed until this solo workflow is proven.

## v128 — Fix Plan & Contextual Markup

### Outcome

A superintendent can open one Plan Helper section, understand one current issue, see the proposed repair and its evidence, and answer Yes or No without deciding which of several overlapping problem, repair, and connection tools to use. When the loaded PDF contains enough verified information, the same workspace can display a transparent, toggleable layer of supply and return review zones on the selected sheet.

### Shipped capabilities

- One **Fix Plan** queue combines problem review, prepared repairs, and connection repair.
- Each current action explains what is wrong, where it is, how the assistant proposes to fix it, the expected result, its evidence, the affected objects, and the exact change boundary.
- **Yes** approves only the current eligible action; **No** skips it during the current review and advances to the next issue.
- Connection fixes appear before airflow and sizing work that depends on a complete network.
- Ready connection repairs move only the reviewed existing run endpoint. Ambiguous matches require the user to choose the correct existing run, and blocked cases remain manual.
- A **Transparent Plan Layer** toggle shows supply and return review zones directly over the current PDF sheet.
- Review zones use exact current-page room evidence, remain linked to their source evidence and fingerprint, and disappear when the source becomes stale or insufficient.
- Plan Setup stays alongside Fix Plan, while History & Undo, My HVAC Rules, and source details move into a quieter More section.
- Object-specific nearby wheels provide icon actions, run actions, and fitting actions without mixing unsafe or irrelevant controls.
- The run wheel can reduce, enlarge, or reset the duct-size label presentation and can expose the existing route extend, split, delete, and close actions.
- The fitting wheel exposes connection inspection, property editing, delete, and close; the icon wheel preserves rotate, mirror, compact, duplicate, delete, and close.

### Evidence and placement boundary

The transparent layer is a review aid, not an automatic HVAC layout. It may show **Supply review zone** or **Return review zone** around a readable room label when the PDF has a matching source fingerprint, an exact room-name region on the current sheet, a verified scale, and sufficiently certain equipment/system context. Unreadable or truncated analysis, missing room regions, unverified scale, uncertain equipment, or unresolved multiple systems blocks the layer rather than guessing.

A review zone is intentionally not an exact diffuser, grille, boot, or duct location. The user must still confirm walls, windows and glass exposure, ceiling layout and height, throw, load, diffuser type, return-air strategy, closed-door behavior, transfer path, grille size, noise, available pressure, code requirements, and field conditions. Toggling the layer does not place, move, resize, connect, or delete anything.

### Mutation safety

- Overlay suggestions never mutate the drawing and are not printed as approved field markup.
- A connection action is fingerprint-bound to its reviewed candidate and may change only the allowed existing endpoint.
- No connection approval creates a new run, route, branch stub, fitting, terminal, or device.
- Duct-label resizing changes presentation only; it does not change the confirmed size value or any engineering property.
- Every physical repair retains current-value checks, exact object scope, reviewer approval, and one Undo.

## v127 — Compact Symbol Workflow

### Outcome

A superintendent can keep supply, return, and equipment markup proportional to the construction plan, resize it directly, and route ductwork without provisional size text covering the drawing.

### Shipped capabilities

- Icon resizing extends to 20 percent and label resizing extends to 30 percent.
- Compact defaults for newly placed terminals, controls, and their labels.
- The nearby symbol wheel adds a Compact action while retaining all v126 actions and staying available at maximum zoom.
- Separate Smaller and Larger controls for icons and labels.
- One undoable action compacts every supply and return terminal on the active sheet.
- Zoom-independent selection and resize targets keep compact symbols usable with mouse, touch, and pen.
- The label halo scales down with the label instead of overwhelming small text.
- Unconfirmed supply and return runs remain unlabeled until the post-draw detail pass confirms their size.

### Safety boundary

Compacting changes only icon and label presentation. It does not alter scheduled face dimensions, CFM, duct geometry, run connections, system assignment, or source-plan content. Legacy sizes remain unchanged until a user resizes or explicitly compacts them, and Compact never enlarges a smaller saved value.

## v126 — Direct Symbol Editing

### Outcome

A superintendent can select a placed supply, return, or equipment icon and finish its presentation without leaving the plan or fighting a distant toolbar.

### Shipped capabilities

- Upright labels that drag independently to any nearby clear location.
- A round on-label handle for direct label sizing.
- Larger, zoom-aware icon corner controls for mouse, pen, and intentional touch editing.
- Signed corner resizing that stops at the minimum instead of rebounding after the pointer crosses the icon center.
- Smaller explicit defaults for newly placed icons and labels, with legacy missing-scale values still rendered at 100 percent.
- A viewport-aware action wheel beside a single selected icon, with rotate, mirror, duplicate, delete, and close actions.
- Separate 0.10 mm Fine defaults for newly drawn supply and return runs; historical run weights remain unchanged.
- Removal of generated promotional raster assets and large-image metadata.

### Safety boundary

Icon and label presentation edits do not change scheduled face size, neck size, airflow, duct geometry, connected run identity, or equipment system assignment. Every completed drag creates one Undo entry.

## v125 — Setup When You Need It

### Outcome

A superintendent or one-person HVAC business can choose direct or guided entry without losing either path. The preferred start is remembered on the current device, while Plan Setup remains available after the PDF opens.

### Shipped capabilities

- Direct and guided PDF actions remain visible together on Jobs Home.
- A versioned local preference remembers the preferred opening method and safely defaults to direct.
- Each local or Drive selection captures its own entry mode, source, setup values, origin, and request ID.
- Canceled guided setup cannot leak scale, duct-size, project-name, or collaboration values into a later direct open.
- An older PDF decode cannot replace a newer selection.
- File-picker cancellation returns to Jobs Home or the existing workspace based on where it started.
- Direct entry keeps background plan reading nonblocking and leaves Plan Setup available from the normal job workflow.
- The hidden PDF input remains operable while Jobs Home is active and has an accessible name.
- Guided source, tonnage, and collaboration choices expose their selected state to assistive technology.

## v124 — Open PDF & Draw

### Outcome

A user can open a local or Google Drive PDF, or drop one on Jobs Home, and go straight to the drawing canvas without completing the guided setup.

### Shipped capabilities

- First-screen **Open PDF and start drawing** action.
- Clear optional **Use guided setup** action.
- Direct local, Google Drive, and drag-and-drop entry.
- Empty browser MIME types are accepted when the filename is a PDF; size and PDF.js validation still apply.
- Direct-open status explains that scale, rooms, ceiling heights, and equipment are being checked in the background.
- Matching saved work restores only when the stored and opened PDF fingerprints agree.
- Local save keys include the PDF fingerprint, so same-named source files keep separate work.
- A same-named but changed PDF opens as a new job by default instead of silently receiving old geometry.

### Safety boundary

Direct opening changes only how the source plan enters the workspace. Scale remains unverified until confirmed, source-dependent calculations stay gated, and assistant changes still require current evidence, exact reviewed scope, approval, and one Undo.

## v123 — Markup Assistant Fixes 2.0

### Outcome

A superintendent or one-person HVAC business sees what must be fixed first, what the assistant can safely prepare now, and what still needs a field decision. Every selectable repair includes an exact before-and-after preview and a plain-language boundary before approval.

### Shipped capabilities

- Deterministic Do first, Next, and Later priorities with an explanation for the order.
- Do first, Can fix, Needs answer, and All problem views with open-item counts.
- Exact recommendation-to-action mapping instead of category-wide sizing matches.
- Ready now, Needs information, and Fix on plan repair groups.
- Typed before-and-after change previews, affected-object links, safety scope, stage, and geometry status.
- Terminal-linked F/R numbering that fills blanks only, preserves existing labels, surfaces duplicates, and excludes trunks and unknown-role segments.
- Stage-safe selection: connections, airflow, and sizes recalculate separately; no action is selected automatically.
- Source-only airflow repair promotes a matching planning seed to reviewed room-target provenance before sizing.
- Field-level mutation allowlists and whole-batch rejection for any unreviewed field or object change.
- Size and fitting-size metadata synchronization with endpoint snapping disabled.
- Verified per-sheet scale required before endpoint movement; unsaved device matches always require an explicit choice.
- No-op size candidates are omitted, and unrelated duplicate labels do not block a safe non-colliding blank label.
- Explicit tri-state size review; a changed or unknown size is not presented as reviewed.
- Confirmed-scale requirement for applied size changes and purchasing quantities.
- Return-air choices remain documented human decisions; the assistant never draws a return path or reroutes a trunk.
- Append-only receipts derive exact applied field changes, including CFM source and fitting-port metadata, and carry priority, stage, change scope, and geometry status.

## v122 — Smart Scale & Draw-First Workflow

### Outcome

A superintendent or one-person HVAC business can accept the scale the plan actually provides and move through drafting in a natural order: draw the supply routes first, add their field details, add returns, and only then repair connections.

### Shipped capabilities

- Any valid numeric scale candidate can apply directly, including metric and uncommon architectural scales.
- Each PDF sheet retains its own confirmed scale; mixed-scale sets cannot silently reuse the current sheet's measurements.
- Conflicting scale evidence presents each candidate as an explicit choice instead of silently choosing one.
- Not-to-scale sheets and sheets without usable numeric evidence still use two-point calibration.
- Completing or canceling a Plan Helper calibration returns the user to Plan Helper instead of losing setup context.
- The Draw & Detail step guides four passes: supply routes, flex run numbers and confirmed sizes, returns, then connection repair.
- New supply and return runs remain unlabeled until their size is confirmed during the post-draw detail pass.
- Post-draw number and size edits preserve every route endpoint and intermediate vertex.
- Existing approval, evidence, geometry, repair-scope, and one-Undo protections remain unchanged.

## v121 — Simple Job Workflow

### Outcome

A superintendent or one-person HVAC business sees one current job, one current step, and one primary action instead of coordinating several overlapping workspaces.

### Shipped capabilities

- Operational Project Home centered on resuming work, opening a PDF, and saved jobs.
- One canonical five-step workflow and one source of truth for connection completion.
- One Plan Helper for Setup, Problems, and Fixes, with rules and Undo retained as supporting views.
- Plan Setup and source review stay beside the live drawing instead of opening a competing AI workspace.
- Duplicate workflow strips, metrics, and future-step cards are removed from the current-step panel.
- Workstation-readable text, stronger muted contrast, larger repair controls, and a persistent mobile Continue action.
- Existing approval, stale-evidence, repair scope, Undo, and geometry protections remain unchanged.

## v120 — Smart Plan Setup & Repair

### Outcome

The plan opens with useful setup information already organized, and Step 1 fixes more loose connections without moving placed objects or inventing ductwork.

### Shipped capabilities

- Automatic once-per-PDF plan reading while the drawing stays usable.
- Source-linked scale detection for architectural, metric, and not-to-scale drawings.
- Room names, flat or vaulted ceiling heights, equipment tags, tonnage references, systems, and zones.
- Plain-language fact states: Confirmed, Found on plan, Suggested, and Not found.
- Exact review questions only when missing or conflicting information controls the next operation.
- One Plan setup workspace with direct Show source actions.
- Open T/Y ports can match nearby unused existing run endpoints using distance, direction, alignment, and size signals.
- Confirmed drawing scale converts Step 1 limits to physical distances: 3 feet for terminals, 4 feet for equipment, and 2 feet for T/Y ports.
- Saved T/Y connections remain bound to their saved run and never fall back to a different nearby run.
- Candidate explanations show same sheet/system, duct type, endpoint availability, distance, direction, and size evidence.
- Apply remains fingerprint-bound and approval-first, creates no branch stub or reroute, moves no placed object, and produces one Undo.

### Honest boundary

Searchable PDF text can identify likely plan facts, but it cannot prove that every drawing view shares one scale or that every nearby note belongs to a room or unit. Conflicts and missing information remain visible for confirmation. Scale is confirmed only by agreeing plan evidence, a supported user-selected scale, or manual calibration.

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

## v116 — My HVAC Rules

### Goal

Turn proven HVAC drafting preferences into visible, evidence-linked QA rules and review actions under the plain-language name **My HVAC Rules**.

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

Plan Helper now includes a dedicated My HVAC Rules workspace. It separates locked safeguards, calculated checks, company preferences, and project-only exceptions; scores the current system; links affected objects back to the plan; and keeps engineering evidence and approval gates independent.

Project numbers remain source examples and are not used as the name of the reusable standard.

Standard rules create findings and review actions; they do not silently redraw the plan or infer airflow from diameter.

## v116.1 — Solo Operator Workflow

### Goal

Make the existing power understandable to a superintendent or one-person HVAC business without requiring them to learn the product’s internal release names or enterprise workflow language.

### Shipped capabilities

- One persistent five-step job guide: Setup, Draw, Airflow, Check, and Finish.
- A simplified Jobs home with Resume current job, Start job from PDF, Open saved jobs, and Open from Drive.
- Plain-language navigation: Saved jobs, Plan Helper, Airflow & Duct Sizes, Materials, Check, Print & Share, and My HVAC Rules.
- One side panel at a time so the plan remains the visual center of the workspace.
- Draw, Symbols, and Selected tabs in the plan-tools panel instead of one long mixed list.
- A short list of common actions in Find a tool; typing still searches the complete professional toolset.
- Plan Helper shows the problem, proposed fix, expected result, and every affected plan object before selection.
- Every suggestion now identifies whether a fix is ready, needs an input, needs plan confirmation, or remains manual, with a direct next-step button.
- Step 1 uses a per-connection review queue for equipment supply/return, supply cans, return grilles, and saved T/Y ports.
- Connection fixes preserve placed objects, move only approved run endpoints, reject ambiguous or occupied matches, and never substitute a different run for a saved T/Y connection.
- Unchanged terminal CFM is not presented as a repair and does not unnecessarily block a current sizing review.
- Repair-history Undo can target only the latest matching repair batch; Redo restores that batch receipt state.
- Enterprise analytics, promotional, review-queue, and collaboration detail removed from the first view while the underlying cloud features remain available.
- Readable workflow labels, buttons, helper copy, and phone/tablet behavior.

## v117 — Commercial Product Operations

### Goal

Prepare HVAC Plan Studio for dependable multi-company production use after the solo-operator workflow is proven in real jobs.

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
