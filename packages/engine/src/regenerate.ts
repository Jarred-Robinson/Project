import type { Assignment, BoardStaffInput, CombinedPair, EngineConfig, Shift, Staff } from "@rotation/shared";
import { runEngine } from "./engine.js";

export function regenerateBoard(input: {
  shift: Shift;
  roster: Staff[];
  catalog: Assignment[];
  config: EngineConfig;
  shifts: Shift[];
}) {
  const { shift } = input;
  const heldEntries = shift.entries.filter((e) => e.held);
  const freeEntries = shift.entries.filter((e) => !e.held);
  const heldAssignmentIds = new Set(heldEntries.map((e) => e.assignment_id));
  const boardStaff: BoardStaffInput[] = freeEntries.map((e) => ({
    staff_id: e.staff_id,
    start: e.start,
    leavingEarly: e.leavingEarly,
    pickedUp: e.pickedUp,
    predetermined: null,
  }));
  const result = runEngine({
    date: shift.date,
    side: shift.side,
    boardStaff,
    closedIds: new Set([...(shift.closed_assignments_ids || []), ...heldAssignmentIds]),
    combinedPairs: (shift.combined_pairs || []) as CombinedPair[],
    roster: input.roster,
    catalog: input.catalog,
    config: input.config,
    shifts: input.shifts.filter((s) => s.id !== shift.id),
  });
  const byStaff = new Map(result.entries.map((e) => [e.staff_id, e]));
  let changed = 0;
  const merged = shift.entries.map((e) => {
    if (e.held) return e;
    const next = byStaff.get(e.staff_id);
    if (!next || next.assignment_id === e.assignment_id) return e;
    changed++;
    return {
      ...next,
      partial: true,
      override_type: "redistributed" as const,
      reason: "Board regenerated",
      previous_assignment_id: e.assignment_id,
      previous_assignment_name: e.assignment_name,
    };
  });
  return { entries: merged, changed, held: heldEntries.length, deficiencies: result.deficiencies };
}
