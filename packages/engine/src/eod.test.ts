import { describe, expect, it } from "vitest";
import type { BoardEntry, Shift } from "@rotation/shared";
import { closeShift, defaultOutcome, startCloseout } from "./eod.js";

function entry(): BoardEntry {
  return {
    staff_id: "N1",
    staff_name: "Achs, Marlena",
    role: "nurse",
    competency: "proficient",
    tech_specialty: null,
    agency: false,
    start: "07:00",
    leavingEarly: false,
    pickedUp: false,
    assignment_id: "RTS",
    assignment_name: "RTS",
    category: "Flow",
    combined_with: null,
    combined_name: null,
    combined_load_pts: null,
    override_type: "none",
    reason: "",
    violated_rule: "none",
    fairness_score: 50,
    rotation_compliant: true,
    wildcard_used: false,
    boarder: false,
    boarderComment: "",
    runtimeCombinedWith: null,
    runtimeCombineComment: "",
    held: false,
    partial: false,
  };
}

function shift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: "SH-1",
    date: "2026-09-11",
    side: "day",
    generated_by: "test",
    generated_at: "2026-09-11T12:00:00.000Z",
    entries: [entry()],
    logs: [],
    deficiencies: [],
    closed_assignments: [],
    closed_assignments_ids: [],
    combined_pairs: [],
    redistributions: [],
    eod: null,
    complianceChecks: [],
    ...overrides,
  };
}

describe("eod closeout", () => {
  it("defaults sent-home exclude-from-memory to OFF", () => {
    const o = defaultOutcome();
    expect(o.status).toBe("as_assigned");
    expect(o.excludeFromMemory).toBe(false);
    expect(o.heldOver).toBe(false);
  });

  it("starts a resumable snapshot without closing", () => {
    const opened = startCloseout(shift());
    expect(opened.eod?.closed).toBe(false);
    expect(opened.eod?.outcomes.N1?.excludeFromMemory).toBe(false);
    const again = startCloseout(opened);
    expect(again.eod).toBe(opened.eod);
  });

  it("closeShift archives the board", () => {
    const closed = closeShift(startCloseout(shift()), "Administrator", "nights handoff");
    expect(closed.eod?.closed).toBe(true);
    expect(closed.eod?.closed_by).toBe("Administrator");
    expect(closed.eod?.notes).toBe("nights handoff");
  });
});
