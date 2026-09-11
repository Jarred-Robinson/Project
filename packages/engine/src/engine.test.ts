import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  LOAD_PTS,
  seedCatalog,
  WILDCARD,
  type Assignment,
  type BoardStaffInput,
  type EngineConfig,
  type Shift,
  type Staff,
} from "@rotation/shared";
import { eligible } from "./eligible.js";
import { actualEntries, rotationMonthKey, sameRotationPeriod } from "./memory.js";
import { computeDeficiencies, recomputeDeficiencies } from "./deficiencies.js";
import { heldOverWarnings, runEngine } from "./engine.js";

const catalog = seedCatalog();
const config: EngineConfig = { ...DEFAULT_CONFIG };

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

function board(ids: string[], extra: Partial<BoardStaffInput> = {}): BoardStaffInput[] {
  return ids.map((staff_id) => ({
    staff_id,
    start: "07:00",
    leavingEarly: false,
    pickedUp: false,
    predetermined: null,
    ...extra,
  }));
}

function emptyShift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: "SH-1",
    date: "2026-09-01",
    side: "day",
    generated_by: "test",
    generated_at: "2026-09-01T12:00:00.000Z",
    entries: [],
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

const roster: Staff[] = [
  staff({ id: "N1", name: "Achs, Marlena" }),
  staff({ id: "N2", name: "Alexander, Rachel" }),
  staff({ id: "N3", name: "Alston, Amia" }),
  staff({ id: "N4", name: "Delamater, Michelle" }),
  staff({ id: "N5", name: "Robinson, Jarred" }),
  staff({ id: "N6", name: "Barker, Brad" }),
  staff({ id: "N7", name: "Beckman, Sara" }),
  staff({ id: "N8", name: "Brooks, Amber" }),
  staff({ id: "N9", name: "Trainee, Pat", competency: "trained" }),
  staff({ id: "N10", name: "Untrained, Lee", competency: "untrained" }),
  staff({ id: "T1", name: "Tech, General", role: "tech", tech_specialty: "general" }),
  staff({ id: "T2", name: "Tech, EKG", role: "tech", tech_specialty: "ekg" }),
  staff({ id: "P1", name: "Owens, Blake", role: "paramedic" }),
];

describe("eligible", () => {
  it("rejects role mismatch", () => {
    expect(eligible(roster.find((w) => w.id === "T1")!, catalog.find((a) => a.id === "G1")!)).toBe(false);
    expect(eligible(roster.find((w) => w.id === "N1")!, catalog.find((a) => a.id === "G1")!)).toBe(true);
  });

  it("enforces competency rank", () => {
    const triage = catalog.find((a) => a.id === "TR1")!;
    expect(eligible(roster.find((w) => w.id === "N10")!, triage)).toBe(false);
    expect(eligible(roster.find((w) => w.id === "N9")!, triage)).toBe(false);
    expect(eligible(roster.find((w) => w.id === "N1")!, triage)).toBe(true);
  });

  it("enforces tech specialty unless both", () => {
    const ekg = catalog.find((a) => a.id === "EKG1")!;
    const green = catalog.find((a) => a.id === "TG1")!;
    expect(eligible(roster.find((w) => w.id === "T2")!, ekg)).toBe(true);
    expect(eligible(roster.find((w) => w.id === "T1")!, ekg)).toBe(false);
    expect(eligible(roster.find((w) => w.id === "T1")!, green)).toBe(true);
  });
});

describe("calendar-month rotation window", () => {
  it("keys by YYYY-MM of the shift start date", () => {
    expect(rotationMonthKey("2026-09-11", "day")).toBe("2026-09");
    expect(rotationMonthKey("2026-09-30", "night")).toBe("2026-09");
  });

  it("does not treat a 42-day lookback as in-window across months", () => {
    expect(sameRotationPeriod("2026-09-11", "day", "2026-08-15", "day")).toBe(false);
    expect(sameRotationPeriod("2026-09-11", "day", "2026-09-01", "night")).toBe(true);
  });
});

describe("runEngine precedence", () => {
  it("places predetermined staff first with justification", () => {
    const result = runEngine({
      date: "2026-09-11",
      side: "day",
      boardStaff: [
        { staff_id: "N1", start: "07:00", leavingEarly: false, pickedUp: true, predetermined: { assignmentId: "RTS", comment: "training purposes" } },
        ...board(["N2", "N3", "N4", "N5", "N6", "N7", "N8"]),
      ],
      closedIds: new Set(),
      combinedPairs: [],
      roster,
      catalog,
      config,
      shifts: [],
    });
    const pred = result.entries.find((e) => e.staff_id === "N1")!;
    expect(pred.assignment_id).toBe("RTS");
    expect(pred.override_type).toBe("predetermined");
    expect(pred.reason).toBe("training purposes");
    expect(pred.pickedUp).toBe(true);
    expect(pred.rotation_compliant).toBe(true);
  });

  it("covers critical assignments before remaining eligible staff", () => {
    const result = runEngine({
      date: "2026-09-11",
      side: "day",
      boardStaff: board(["N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8"]),
      closedIds: new Set(),
      combinedPairs: [],
      roster,
      catalog,
      config,
      shifts: [],
    });
    const coveredCritical = catalog
      .filter((a) => a.critical && a.roles.includes("nurse") && !a.special)
      .filter((a) => result.entries.some((e) => e.assignment_id === a.id));
    expect(coveredCritical.length).toBeGreaterThan(0);
    expect(result.entries.every((e) => e.staff_id)).toBe(true);
  });

  it("respects frequency cap unless critical coverage requires an override", () => {
    const prior: Shift = emptyShift({
      date: "2026-09-02",
      entries: [
        {
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
          fairness_score: 80,
          rotation_compliant: true,
          wildcard_used: false,
          boarder: false,
          boarderComment: "",
          runtimeCombinedWith: null,
          runtimeCombineComment: "",
          held: false,
          partial: false,
        },
      ],
    });
    // Repeat RTS four times in-month so frequency cap is hit.
    const shifts = [1, 2, 3, 4].map((d) =>
      emptyShift({
        id: `SH-${d}`,
        date: `2026-09-0${d}`,
        entries: prior.entries,
      }),
    );
    const result = runEngine({
      date: "2026-09-11",
      side: "day",
      boardStaff: [
        { staff_id: "N1", start: "07:00", leavingEarly: false, pickedUp: false, predetermined: null },
      ],
      closedIds: new Set(catalog.filter((a) => a.id !== "RTS").map((a) => a.id)),
      combinedPairs: [],
      roster,
      catalog,
      config: { ...config, max_assignment_frequency: 4 },
      shifts,
    });
    const n1 = result.entries.find((e) => e.staff_id === "N1")!;
    expect(["staffing_override", "fallback_override", "wildcard_override", "special_assignment"]).toContain(
      n1.override_type,
    );
  });

  it("skips partial rows when accumulating frequency memory", () => {
    const shifts = [1, 2, 3, 4].map((d) =>
      emptyShift({
        id: `SH-P${d}`,
        date: `2026-09-0${d}`,
        entries: [
          {
            staff_id: "N2",
            staff_name: "Alexander, Rachel",
            role: "nurse",
            competency: "proficient",
            tech_specialty: null,
            agency: false,
            start: "07:00",
            leavingEarly: false,
            pickedUp: false,
            assignment_id: "PIT",
            assignment_name: "PIT",
            category: "Flow",
            combined_with: null,
            combined_name: null,
            combined_load_pts: null,
            override_type: "redistributed",
            reason: "Board regenerated",
            violated_rule: "none",
            fairness_score: null,
            rotation_compliant: true,
            wildcard_used: false,
            boarder: false,
            boarderComment: "",
            runtimeCombinedWith: null,
            runtimeCombineComment: "",
            held: false,
            partial: true,
          },
        ],
      }),
    );
    const memRows = actualEntries(shifts, catalog);
    expect(memRows.every((r) => r.partial)).toBe(true);
    const result = runEngine({
      date: "2026-09-11",
      side: "day",
      boardStaff: board(["N2"]),
      closedIds: new Set(catalog.filter((a) => a.id !== "PIT").map((a) => a.id)),
      combinedPairs: [],
      roster,
      catalog,
      config,
      shifts,
    });
    const n2 = result.entries.find((e) => e.staff_id === "N2")!;
    expect(n2.assignment_id).toBe("PIT");
    expect(n2.rotation_compliant).toBe(true);
  });
});

describe("deficiencies", () => {
  it("flags day min ~8 and night min ~6 as CRITICAL headcount", () => {
    const day = runEngine({
      date: "2026-09-11",
      side: "day",
      boardStaff: board(["N1", "N2"]),
      closedIds: new Set(),
      combinedPairs: [],
      roster,
      catalog,
      config,
      shifts: [],
    });
    expect(day.deficiencies.some((d) => d.kind === "headcount" && d.severity === "red")).toBe(true);

    const nightOk = runEngine({
      date: "2026-09-11",
      side: "night",
      boardStaff: board(["N1", "N2", "N3", "N4", "N5", "N6"]),
      closedIds: new Set(catalog.filter((a) => a.critical).map((a) => a.id)),
      combinedPairs: [],
      roster,
      catalog,
      config,
      shifts: [],
    });
    expect(nightOk.deficiencies.some((d) => d.kind === "headcount")).toBe(false);
  });

  it("marks uncovered critical rooms CRITICAL and non-critical REVIEW", () => {
    const result = runEngine({
      date: "2026-09-11",
      side: "day",
      boardStaff: board(["N1"]),
      closedIds: new Set(),
      combinedPairs: [],
      roster,
      catalog,
      config,
      shifts: [],
    });
    const crit = result.deficiencies.filter((d) => d.kind === "unfilled" && d.severity === "red");
    const review = result.deficiencies.filter((d) => d.kind === "unfilled" && d.severity === "amber");
    expect(crit.length).toBeGreaterThan(0);
    expect(review.length).toBeGreaterThan(0);
  });

  it("flags runtime COMBINE at combined load points >= 5", () => {
    const gold = catalog.find((a) => a.id === "GA1")!; // heavy = 3
    const trauma = catalog.find((a) => a.id === "TA1")!; // heavy = 3
    expect((LOAD_PTS[gold.load_level] || 0) + (LOAD_PTS[trauma.load_level] || 0)).toBeGreaterThanOrEqual(5);
    const entries = [
      {
        staff_id: "N1",
        staff_name: "Achs, Marlena",
        role: "nurse" as const,
        competency: "proficient" as const,
        tech_specialty: null,
        agency: false,
        start: "07:00",
        leavingEarly: false,
        pickedUp: false,
        assignment_id: "GA1",
        assignment_name: gold.name,
        category: "Gold A",
        combined_with: null,
        combined_name: null,
        combined_load_pts: null,
        override_type: "none" as const,
        reason: "",
        violated_rule: "none",
        fairness_score: 50,
        rotation_compliant: true,
        wildcard_used: false,
        boarder: false,
        boarderComment: "",
        runtimeCombinedWith: "N2",
        runtimeCombineComment: "covering trauma overflow",
        runtimeCombinedName: trauma.name,
        _runtimeLoadA: gold.load_level,
        _runtimeLoadB: trauma.load_level,
        held: false,
        partial: false,
      },
    ];
    const defs = recomputeDeficiencies({
      entries,
      catalog,
      closedIds: new Set(catalog.map((a) => a.id)),
      combinedPairs: [],
      staffCount: 8,
      config,
      side: "day",
    });
    expect(defs.some((d) => d.kind === "combined_load")).toBe(true);
  });
});

describe("sent-home memory + held-over warnings", () => {
  it("includes sent_home in memory unless excludeFromMemory is true", () => {
    const baseEntry = {
      staff_id: "N1",
      staff_name: "Achs, Marlena",
      role: "nurse" as const,
      competency: "proficient" as const,
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
      override_type: "none" as const,
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
    const included = actualEntries(
      [
        emptyShift({
          eod: {
            closed: true,
            outcomes: {
              N1: { status: "sent_home", reassigned_to: "", note: "", heldOver: false, excludeFromMemory: false },
            },
          },
          entries: [baseEntry],
        }),
      ],
      catalog,
    );
    expect(included.some((r) => r.staff_id === "N1" && r.assignment_id === "RTS")).toBe(true);

    const excluded = actualEntries(
      [
        emptyShift({
          eod: {
            closed: true,
            outcomes: {
              N1: { status: "sent_home", reassigned_to: "", note: "", heldOver: false, excludeFromMemory: true },
            },
          },
          entries: [baseEntry],
        }),
      ],
      catalog,
    );
    expect(excluded.some((r) => r.staff_id === "N1")).toBe(false);
  });

  it("emits held-over generate warnings from the last closed shift", () => {
    const warnings = heldOverWarnings([
      emptyShift({
        date: "2026-09-10",
        entries: [
          {
            staff_id: "N1",
            staff_name: "Achs, Marlena",
            role: "nurse",
            competency: "proficient",
            tech_specialty: null,
            agency: false,
            start: "19:00",
            leavingEarly: false,
            pickedUp: false,
            assignment_id: "G1",
            assignment_name: "4 Bed Gold B 1",
            category: "Gold",
            combined_with: null,
            combined_name: null,
            combined_load_pts: null,
            override_type: "none",
            reason: "",
            violated_rule: "none",
            fairness_score: 40,
            rotation_compliant: true,
            wildcard_used: false,
            boarder: false,
            boarderComment: "",
            runtimeCombinedWith: null,
            runtimeCombineComment: "",
            held: false,
            partial: false,
          },
        ],
        eod: {
          closed: true,
          closed_at: "2026-09-11T07:00:00.000Z",
          outcomes: {
            N1: { status: "as_assigned", reassigned_to: "", note: "", heldOver: true, excludeFromMemory: false },
          },
        },
      }),
    ]);
    expect(warnings[0]).toMatch(/Achs, Marlena/);
    expect(warnings[0]).toMatch(/held on previous close-out/);
  });
});

describe("regenerate hold semantics", () => {
  it("can keep held rooms out of the rerun by treating them as closed", () => {
    const first = runEngine({
      date: "2026-09-11",
      side: "day",
      boardStaff: board(["N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8"]),
      closedIds: new Set(),
      combinedPairs: [],
      roster,
      catalog,
      config,
      shifts: [],
    });
    const held = first.entries[0];
    const rerun = runEngine({
      date: "2026-09-11",
      side: "day",
      boardStaff: first.entries.filter((e) => e.staff_id !== held.staff_id).map((e) => ({
        staff_id: e.staff_id,
        start: e.start,
        leavingEarly: e.leavingEarly,
        pickedUp: e.pickedUp,
        predetermined: null,
      })),
      closedIds: new Set([held.assignment_id]),
      combinedPairs: [],
      roster,
      catalog,
      config,
      shifts: [],
    });
    expect(rerun.entries.some((e) => e.assignment_id === held.assignment_id)).toBe(false);
    expect(rerun.closedAssignments).toContain(held.assignment_name);
  });
});

describe("compliance recheck parity", () => {
  it("recomputeDeficiencies matches runEngine findings for the same placement", () => {
    const result = runEngine({
      date: "2026-09-11",
      side: "day",
      boardStaff: board(["N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8"]),
      closedIds: new Set(),
      combinedPairs: [],
      roster,
      catalog,
      config,
      shifts: [],
    });
    const recomputed = recomputeDeficiencies({
      entries: result.entries,
      catalog,
      closedIds: new Set(),
      combinedPairs: [],
      staffCount: result.staffCount,
      config,
      side: "day",
    });
    const key = (d: { kind: string; text: string }) => `${d.kind}|${d.text}`;
    expect(recomputed.map(key).sort()).toEqual(result.deficiencies.map(key).sort());
  });
});
