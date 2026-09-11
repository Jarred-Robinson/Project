import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, seedCatalog, type BoardEntry, type BoardStaffInput, type Shift, type Staff } from "@rotation/shared";
import { runEngine } from "./engine.js";
import { regenerateBoard } from "./regenerate.js";

const catalog = seedCatalog();

function staff(partial: Partial<Staff> & { id: string; name: string }): Staff {
  return {
    role: "nurse",
    competency: "proficient",
    tech_specialty: null,
    avoidNight: false,
    agency: false,
    active: true,
    pickedUp: false,
    predetermined: null,
    ...partial,
  };
}

const roster: Staff[] = [
  staff({ id: "N1", name: "Achs, Marlena" }),
  staff({ id: "N2", name: "Alexander, Rachel" }),
  staff({ id: "N3", name: "Alston, Amia" }),
  staff({ id: "N4", name: "Delamater, Michelle" }),
  staff({ id: "N5", name: "Robinson, Jarred" }),
  staff({ id: "N6", name: "Barker, Brad" }),
  staff({ id: "N7", name: "Beckman, Sara" }),
  staff({ id: "N8", name: "Brooks, Amber" }),
];

function board(ids: string[]): BoardStaffInput[] {
  return ids.map((staff_id) => ({
    staff_id,
    start: "07:00",
    leavingEarly: false,
    pickedUp: false,
    predetermined: null,
  }));
}

describe("regenerateBoard", () => {
  it("keeps HELD rooms on the same staff and marks others partial when they move", () => {
    const first = runEngine({
      date: "2026-09-11",
      side: "day",
      boardStaff: board(roster.map((w) => w.id)),
      closedIds: new Set(),
      combinedPairs: [],
      roster,
      catalog,
      config: DEFAULT_CONFIG,
      shifts: [],
    });
    const heldId = first.entries[0].staff_id;
    const heldAssignment = first.entries[0].assignment_id;
    const shift: Shift = {
      id: "SH-live",
      date: "2026-09-11",
      side: "day",
      generated_by: "test",
      generated_at: "2026-09-11T12:00:00.000Z",
      entries: first.entries.map((e) => (e.staff_id === heldId ? { ...e, held: true } : e)) as BoardEntry[],
      logs: [],
      deficiencies: first.deficiencies,
      closed_assignments: first.closedAssignments,
      closed_assignments_ids: [],
      combined_pairs: [],
      redistributions: [],
      eod: null,
      complianceChecks: [],
    };
    const regen = regenerateBoard({
      shift,
      roster,
      catalog,
      config: DEFAULT_CONFIG,
      shifts: [],
    });
    const held = regen.entries.find((e) => e.staff_id === heldId)!;
    expect(held.held).toBe(true);
    expect(held.assignment_id).toBe(heldAssignment);
    expect(regen.held).toBe(1);
    expect(regen.entries.filter((e) => e.held).every((e) => e.assignment_id === heldAssignment || e.staff_id !== heldId || e.held)).toBe(true);
    expect(regen.entries.some((e) => !e.held && e.assignment_id === heldAssignment)).toBe(false);
  });
});
