import { LOAD_PTS } from "@rotation/shared";
import type {
  Assignment,
  BoardEntry,
  CombinedPair,
  Deficiency,
  EngineConfig,
  ShiftSide,
} from "@rotation/shared";

export interface ComputeDeficienciesInput {
  entries: BoardEntry[];
  core: Assignment[];
  secondaryIds: Set<string>;
  used: Set<string>;
  staffCount: number;
  config: EngineConfig;
  side: ShiftSide;
  intentionallyClosedIds?: Set<string>;
}

export function computeDeficiencies(input: ComputeDeficienciesInput): Deficiency[] {
  const {
    entries,
    core,
    secondaryIds,
    used,
    staffCount,
    config,
    side,
    intentionallyClosedIds,
  } = input;
  const deficiencies: Deficiency[] = [];
  const minStaff = side === "day" ? config.min_staff_day : config.min_staff_night;
  if (staffCount < minStaff) {
    deficiencies.push({
      severity: "red",
      kind: "headcount",
      text: `Headcount ${staffCount} is below the ${side}-shift minimum of ${minStaff}`,
    });
  }
  for (const a of core.filter((x) => x.critical && !used.has(x.id) && !secondaryIds.has(x.id))) {
    if (intentionallyClosedIds?.has(a.id)) continue;
    deficiencies.push({
      severity: "red",
      kind: "unfilled",
      text: `${a.name} (${a.category}) UNCOVERED — critical assignment`,
      assignment_id: a.id,
    });
  }
  for (const a of core.filter((x) => !x.critical && !used.has(x.id) && !secondaryIds.has(x.id))) {
    if (intentionallyClosedIds?.has(a.id)) continue;
    deficiencies.push({
      severity: "amber",
      kind: "unfilled",
      text: `${a.name} (${a.category}) uncovered (non-critical)`,
      assignment_id: a.id,
    });
  }
  for (const e of entries) {
    if (e.wildcard_used) {
      deficiencies.push({
        severity: "amber",
        kind: "wildcard",
        text: `${e.staff_name} holds a WILDCARD — no real assignment issued`,
        staff_id: e.staff_id,
      });
    }
    if (!e.rotation_compliant) {
      deficiencies.push({
        severity: "amber",
        kind: "override",
        text: `${e.staff_name} → ${e.assignment_name}: ${e.violated_rule} overridden`,
        staff_id: e.staff_id,
      });
    }
    if (e.competency === "untrained" && !e.wildcard_used) {
      deficiencies.push({
        severity: "amber",
        kind: "competency",
        text: `${e.staff_name} is UNTRAINED holding ${e.assignment_name} — verify supervision`,
        staff_id: e.staff_id,
      });
    }
    if (e.combined_with && (e.combined_load_pts || 0) >= 5) {
      deficiencies.push({
        severity: "amber",
        kind: "combined_load",
        text: `${e.staff_name} carries combined ${e.assignment_name} + ${e.combined_name} (${e.combined_load_pts} pts) — monitor`,
        staff_id: e.staff_id,
      });
    }
    if (e.runtimeCombinedWith) {
      const pts = (LOAD_PTS[e._runtimeLoadA || "light"] || 0) + (LOAD_PTS[e._runtimeLoadB || "light"] || 0);
      if (pts >= 5) {
        deficiencies.push({
          severity: "amber",
          kind: "combined_load",
          text: `${e.staff_name} carries runtime-combined ${e.assignment_name} + ${e.runtimeCombinedName || "—"} (${pts} pts) — monitor`,
          staff_id: e.staff_id,
        });
      }
    }
  }
  return deficiencies;
}

export function recomputeDeficiencies(input: {
  entries: BoardEntry[];
  catalog: Assignment[];
  closedIds: Set<string>;
  combinedPairs: CombinedPair[];
  staffCount?: number;
  config: EngineConfig;
  side: ShiftSide;
}): Deficiency[] {
  const { entries, catalog, closedIds, combinedPairs, config, side } = input;
  const activeCatalog = catalog.filter((a) => !closedIds.has(a.id));
  const core = activeCatalog.filter((a) => !a.special);
  const secondaryIds = new Set((combinedPairs || []).map((p) => p.secondary_id));
  const used = new Set(entries.map((e) => e.assignment_id));
  for (const p of combinedPairs || []) used.add(p.secondary_id);
  for (const e of entries) {
    if (e.combined_with) used.add(e.combined_with);
  }
  return computeDeficiencies({
    entries,
    core,
    secondaryIds,
    used,
    staffCount: input.staffCount ?? entries.length,
    config,
    side,
    intentionallyClosedIds: closedIds,
  });
}
