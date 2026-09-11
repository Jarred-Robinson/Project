# Rotation Engine — Phase 1 Implementation Notes

Scope: spec sections **0–9** of `rotation_engine_spec.md`, plus the "Cross-cutting notes" section. Sections 10–20 are explicitly deferred to a second pass.

All work was done in place in `/home/user/workspace/rotation-engine/app.html` (single-file React 18 UMD + Babel + Tailwind CDN + SheetJS app, no build step). `index.html` is kept byte-identical to `app.html` for `deploy_website` preview purposes — keep them in sync on future edits.

## What was implemented

**§0 — Terminology renames**
- All rendered "mid-shift" strings → "current shift" (panel titles, helper copy, button/action labels).
- `competent` → `proficient` everywhere: `COMP_RANK` enum, `seedCatalog()` min-competency values, `seedRoster()`/roster records, every `<select>` (roster tab, catalog tab), badge/label text, and the on-duty staff competency color logic.
- Tab structure reorganized: **Current Shift** (only in-progress/open shifts), **Archive** (closed/historical shifts, read-only detail view), and a dependent **EOD Closeout** tab that only appears in the nav once an EOD-in-progress record exists (`eodShiftId` state), exactly as specced.

**§1 — Renamed Gold assignments**
Applied the exact renames from the spec (`G1`→"4 Bed Gold B 1", `G2`→"4 Bed Gold B 2", `G4`→"4 Bed Gold B 4", `GA3`→"4 Bed Gold A 3", `GA1`→"4 Bed Gold A 1", `GA2`→"4 Bed Gold A 2"). `G3` ("4 Bed Gold 3") intentionally left unchanged per the literal spec instruction. IDs and `load_level` untouched.

**§2 — New catalog positions**
- Extended `tech_specialty` enum to `general|huc|both|ekg|sitter|triage|obs_sitter|edt` (`TECH_SPECIALTIES` constant), and added catalog entries: EKG Tech, Sitter, Triage Tech, Obs Sitter, EDT — with the categories/loads/min-competencies specified.
- Added `paramedic` as a third role (`ROLES` constant) alongside nurse/tech, wired into: roster role `<select>`, catalog roles `<select>` (now nurse / tech / paramedic / nurse+tech), on-duty staff badge text, and a new "Paramedic" catalog assignment (`roles:["paramedic"]`, category Flow).
- Added Triage 3, PFC, and B-Bed nurse assignments with the specified load/competency/critical flags. `eligible()` needed no changes — its tech-specialty check already generalizes to the new enum values.

**§3 — Board-generation-time staff toggles**
- **PU (Picked Up)** toggle per selected staff row → `picked[id].pickedUp`, carried through `runEngine`/`record()` onto the generated entry (`e.pickedUp`), rendered as a small "(PU)" chip on the Generated Board, Current Shift, and Archive detail views.
- **PREDETERMINED** toggle reveals an eligibility-filtered assignment dropdown + a required justification textarea. Stored as `picked[id].predetermined:{assignmentId, comment}`. `generate()` blocks (with a red inline warning banner and a `pushNotification` danger toast) if any selected, predetermined-toggled staff member is missing the assignment or the comment.
- In `runEngine`, predetermined staff are processed in a dedicated loop **before** the criticals loop, assigned directly (respecting a combined-pair secondary if configured), tagged `override_type:"predetermined"` with `reason` = the operator's comment, and are exempt from the `compliant()`/frequency-cap check (matches the spec's stated precedence change, also reflected in the updated footer text).
- On-Duty Staff panel and Catalog tab are now grouped into Nurse / Tech / Paramedic sub-sections with their own sub-headers; search/filter still applies across all groups.

**§4 — Combine & Boarder toggles on entries**
- **BOARDER**: shown only for entries whose `category` starts with "Gold". Toggling on requires a comment; persists `boarder`/`boarderComment` on the entry; renders an amber "BOARDER" chip + note, on the Generated Board preview, Current Shift, and Archive detail.
- **COMBINE** (ad-hoc/runtime, distinct from the generation-time admin-defined pairs): available on every entry, lets the operator pick another current entry on the same board/shift + a required comment. Persists `runtimeCombinedWith` / `runtimeCombineComment` / `runtimeCombinedName` (+ internal `_runtimeLoadA/_runtimeLoadB` for the load-points check). A shared `EntryFlagsEditor` component drives both toggles and is reused by the Generated Board (`PendingEntryRow`) and Current Shift (`CurrentShiftEntries`).
- Factored deficiency generation into a standalone `computeDeficiencies()` helper (used by `runEngine` and ready for reuse by §12/§13 in the next pass) so the high-combined-load rule (`combined_load_pts>=5`) treats `runtimeCombinedWith` the same as generation-time `combined_with`.

**§5 — EOD Closeout as its own dependent page**
- Removed the old inline "EOD CLOSE-OUT" panel from the combined Archive/EOD/Redistribute tab. **CLOSEOUT** now lives as a button on the Current Shift detail header.
- Clicking CLOSEOUT snapshots the shift's live state into `shift.eod` (creating the record only if one doesn't already exist — re-clicking resumes the same in-progress record rather than duplicating it) and routes to the dependent `tab==="eod"` view (only shown in nav while `eodShiftId` is set).
- The EOD Closeout page has: an editable `datetime-local` **closeout timestamp** (`eod.closeout_timestamp`, defaults to "now"), a **HOLD** toggle per staff row (`heldOver`), the outcome status/reassign/note controls (moved verbatim from the old panel), the handoff-note field, and the CLOSE SHIFT button, all at the end as specced.

**§6 — Held-over staff notification**
- `generate()` looks at the most recently closed shift (by `eod.closed_at`) and, for every outcome with `heldOver:true`, pushes one `pushNotification` warning: `"{name} - employee may still be working; held on previous close-out"`. Verified end-to-end in QA (held Achs, Marlena on shift 1 → generating shift 2 produced the banner entry).

**§7 — Notification banner**
- `notifications` state + `pushNotification(text, severity)` + `dismissNotification(id)`, rendered by a new `<NotificationBanner>` under the header, above the tab nav. Supports multiple simultaneous, individually-dismissible rows, using `tealSoft`/`amberSoft`/`redSoft`-style tokens keyed by `info`/`warn`/`danger` severity. Used by §6 (held-over), §8 (shift-nearing-end), §3 (blocked generation), and §9 (regenerate-board summary).

**§8 — Live clock + shift-nearing-end highlighting**
- `now` state refreshed via `setInterval` every hour, per the spec's literal instruction (`60*60*1000`ms) — note this means the highlighting/notification check only *recomputes* on an hourly tick or on other state changes that re-render the Current Shift list (e.g., a redistribution), not on a smooth per-minute clock. This is intentional per the spec, but worth flagging: it means "within 30 minutes of shift end" can be discovered up to an hour late in a completely idle UI. Documented inline in `CurrentShiftEntries`.
- Effective end estimate: `start + 8h`, minus 2h if `leavingEarly` (documented inline as a simple heuristic, not a real timeclock integration). Rows within 30 minutes of (or past) that estimate get an amber left border + a "SHIFT ENDING" chip, and fire one `pushNotification` the first time each staff id crosses the threshold per shift (tracked in a `shiftEndNotifiedRef` Set to avoid re-spamming on every render).

**§9 — Regenerate board / Hold assignment**
- Removed the copy/behavior implying redistribution is one-shot; `redistribute()` is freely repeatable pre-closeout.
- Every Current Shift redistribution now sets `partial:true` in addition to `override_type:"redistributed"`. Anywhere an assignment name renders for a `partial:true` entry, " (P)" is appended. In `actualEntries()`/`runEngine`'s memory-window accumulation, partial rows skip incrementing `m.freq[assignment_id]`, so `compliant()`/the frequency cap ignores them — letting the same person be reassigned the same role again later in the window.
- **HOLD** toggle per Current Shift entry (`held:boolean`), independent of the release/reassign flow.
- **REGENERATE BOARD** button re-runs `runEngine` against the shift's current staff set, excluding held staff (their assignment — and the room they occupy — is protected via `closedIds`) and treating the assignments they occupy as closed for the rerun so nobody else gets shuffled into them. Entries whose assignment actually changes get `partial:true` + `override_type:"redistributed"` + reason `"Board regenerated"`; unchanged entries are left byte-identical (no spurious redistribution flag). A summary notification reports how many changed / how many held.

## Assumptions made
1. **PU / predetermined data model**: added `pickedUp` and `predetermined` fields to the roster seed records and to the `picked[id]` board-selection state, even though the spec only explicitly mentions them as picked-entry/board-generation concepts — this keeps the shape consistent if a later pass wants to persist a "usually picked up" flag on the roster itself. They default to `false`/`null` and have no roster-tab UI in this pass.
2. **Predetermined + combine interplay**: predetermined assignments respect an admin-defined combined pair if one exists for the chosen assignment (mirrors how the criticals loop already treats pairs), but predetermined entries are not automatically exempted from being picked as a runtime-combine partner later — that's an ad-hoc operator action on Current Shift/Generated Board and is allowed.
3. **REGENERATE BOARD room protection**: excluded held staff's *rooms*, not just the staff themselves, from the rerun pool (via `closedIds`) so the algorithm can't put someone new into a bed a held nurse is actively occupying. The spec says "respecting any assignments closed mid-shift" — §13's dedicated mid-shift room-closure control is deferred to Phase 2, so for this pass "closed mid-shift" is approximated as "occupied by a held staff member."
4. **EOD Closeout "back" navigation**: added a "BACK TO CURRENT SHIFT" button on the EOD Closeout page (visible only pre-close) since the spec removes EOD from being a permanent tab; without an explicit way back, an operator who clicked CLOSEOUT by mistake would be stuck. This doesn't delete or alter the in-progress EOD record — re-clicking CLOSEOUT resumes it.
5. **Hourly clock tick**: implemented exactly as specified (`setInterval(...,60*60*1000)`), which means shift-ending highlighting is technically only guaranteed to refresh once an hour absent other re-renders (documented as a known limitation above, not silently "fixed" to a shorter interval, since the spec was explicit about the hourly cadence).
6. **`min_competency` for RTS/PIT/Triage 1&2/Trauma 1&2**: left as `proficient` (was `competent`) — only the label changed, not the actual staffing requirement, per §0's instruction to treat this as a pure rename.
7. Zone-color visualization (`ZONE_COLORS`), sortable Current Shift columns, editable generated-board dropdown-before-save, and Excel import/full-history export are §14–20 features and were **not** touched in this pass, other than adding a few forward-compatible export columns (Picked Up, Boarder, Runtime Combined, Held, Held Over) to `exportExcel` so Phase 2's history export has the data available.

## QA performed
Full click-through via Playwright (`js_repl`) against a `deploy_website` preview at 1280px:
first-run admin creation → sign in → select 2 staff → toggled **PU** and **PREDETERMINED** (with eligibility-filtered dropdown + required comment, verified the block-on-incomplete banner) → **GENERATE BOARD** → confirmed role-grouped On-Duty Staff list, renamed Gold catalog entries, new Tech-specialty/Paramedic/Triage 3/PFC/B-Bed catalog entries all present → tested **BOARDER** toggle (comment required, chip + note render) and **COMBINE** toggle (partner picker + comment, ⟷ pairing render, combined chip) on the Generated Board → **SAVE AS CURRENT SHIFT** → landed on Current Shift tab → verified notification banner rendered §8 shift-ending alerts → tested **RELEASE + reassign** (repeatable, "(P)" tag, redistribution log) → tested **HOLD** toggle → tested **REGENERATE BOARD** (held staff untouched, changed-count notification) → clicked **CLOSEOUT** → landed on the dependent **EOD Closeout** page (own nav tab, only visible now) → set editable closeout timestamp, toggled **HOLD** (heldOver) on one staff row, exercised `sent_home` status to confirm the **Exclude from memory** toggle appears (default off) → **CLOSE SHIFT** → confirmed the shift disappeared from Current Shift and now appears in **Archive** as CLOSED with a detail view showing PU/partial/boarder/held-over indicators → generated a second board and confirmed the held-over staff member produced the expected notification banner entry (`"Achs, Marlena - employee may still be working; held on previous close-out"`).

No console/page errors were observed during the run. Fixed one real bug found during QA: an accidental Babel identifier collision was avoided by keeping all new helpers (`computeDeficiencies`, `EntryFlagsEditor`, `PendingEntryRow`, `CurrentShiftEntries`, `Toggle`, `Chip`, `NotificationBanner`) uniquely named and outside the main component; the full embedded script was also validated with a standalone Babel parse pass (`@babel/standalone`, `presets:['react']`) with no syntax errors before and after all edits.

Screenshots from the QA pass are saved alongside this file (`qa_01_boot.png` … `qa_41_dismiss.png`) for reference.
