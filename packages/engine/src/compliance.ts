import type { Assignment, CombinedPair, EngineConfig, Shift, ShiftSide } from "@rotation/shared";
import { recomputeDeficiencies } from "./deficiencies.js";

/** Compliance recheck against live entries — same helper as generate. */
export function runComplianceCheck(input: {
  shift: Shift;
  catalog: Assignment[];
  closedIds: string[];
  config: EngineConfig;
}) {
  const closedIds = new Set([
    ...input.closedIds,
    ...(input.shift.closed_assignments_ids || []),
    ...(input.shift.mid_shift_closed_ids || []),
  ]);
  const deficiencies = recomputeDeficiencies({
    entries: input.shift.entries,
    catalog: input.catalog,
    closedIds,
    combinedPairs: input.shift.combined_pairs || [],
    staffCount: input.shift.entries.length,
    config: input.config,
    side: input.shift.side as ShiftSide,
  });
  return {
    deficiencies,
    result: deficiencies.length === 0 ? ("good_to_go" as const) : ("issues" as const),
    issueCount: deficiencies.length,
  };
}

export function intentionallyClosedIds(shift: Shift, extra: string[] = []): Set<string> {
  return new Set([...(shift.closed_assignments_ids || []), ...(shift.mid_shift_closed_ids || []), ...extra]);
}

export type { CombinedPair };
