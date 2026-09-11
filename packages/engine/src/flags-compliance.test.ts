import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, LOAD_PTS, seedCatalog, type BoardEntry, type Shift } from "@rotation/shared";
import { runComplianceCheck } from "./compliance.js";
import { applyBoarder, applyCombine, combinedLoadPoints, isGoldCategory } from "./flags.js";
import { recomputeDeficiencies } from "./deficiencies.js";

const catalog = seedCatalog();

function entry(partial: Partial<BoardEntry> = {}): BoardEntry {
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
    assignment_id: "GA1",
    assignment_name: "Gold A 1",
    category: "Gold A",
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
    ...partial,
  };
}

describe("BOARDER / COMBINE flags", () => {
  it("BOARDER is Gold-only in the UI helper", () => {
    expect(isGoldCategory("Gold")).toBe(true);
    expect(isGoldCategory("Gold A")).toBe(true);
    expect(isGoldCategory("Green A")).toBe(false);
  });

  it("applyBoarder requires a comment when on", () => {
    const flagged = applyBoarder(entry(), true, "overflow hallway");
    expect(flagged.boarder).toBe(true);
    expect(flagged.boarderComment).toBe("overflow hallway");
    expect(applyBoarder(flagged, false, "").boarder).toBe(false);
  });

  it("COMBINE load points >= 5 become a REVIEW deficiency", () => {
    const partner = entry({
      staff_id: "N2",
      staff_name: "Alexander, Rachel",
      assignment_id: "TA1",
      assignment_name: "Trauma 1",
      category: "Trauma",
    });
    const combined = applyCombine(entry(), partner, "covering trauma overflow", catalog);
    expect(combinedLoadPoints(combined)).toBeGreaterThanOrEqual(5);
    expect((LOAD_PTS[combined._runtimeLoadA || "light"] || 0) + (LOAD_PTS[combined._runtimeLoadB || "light"] || 0)).toBeGreaterThanOrEqual(5);
    const defs = recomputeDeficiencies({
      entries: [combined],
      catalog,
      closedIds: new Set(catalog.map((a) => a.id)),
      combinedPairs: [],
      staffCount: 8,
      config: DEFAULT_CONFIG,
      side: "day",
    });
    expect(defs.some((d) => d.kind === "combined_load")).toBe(true);
  });
});

describe("compliance recheck", () => {
  it("runComplianceCheck uses the same deficiency helper as generate", () => {
    const shift: Shift = {
      id: "SH-1",
      date: "2026-09-11",
      side: "day",
      generated_by: "test",
      generated_at: "2026-09-11T12:00:00.000Z",
      entries: [entry({ assignment_id: "RTS", assignment_name: "RTS", category: "Flow" })],
      logs: [],
      deficiencies: [],
      closed_assignments: [],
      closed_assignments_ids: [],
      combined_pairs: [],
      redistributions: [],
      eod: null,
      complianceChecks: [],
    };
    const rec = runComplianceCheck({
      shift,
      catalog,
      closedIds: [],
      config: DEFAULT_CONFIG,
    });
    const recomputed = recomputeDeficiencies({
      entries: shift.entries,
      catalog,
      closedIds: new Set(),
      combinedPairs: [],
      staffCount: 1,
      config: DEFAULT_CONFIG,
      side: "day",
    });
    expect(rec.issueCount).toBe(recomputed.length);
    expect(rec.result).toBe(recomputed.length ? "issues" : "good_to_go");
  });
});
