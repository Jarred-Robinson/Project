import { LOAD_PTS, WILDCARD } from "@rotation/shared";
import type {
  Assignment,
  BoardEntry,
  BoardStaffInput,
  CombinedPair,
  EngineConfig,
  EngineResult,
  OverrideType,
  Shift,
  ShiftSide,
  Staff,
} from "@rotation/shared";
import { eligible, earlyOk } from "./eligible.js";
import { applyWindowToMemory, daysBetween, windowRows, type StaffMemory } from "./memory.js";
import { computeDeficiencies } from "./deficiencies.js";

export interface RunEngineInput {
  date: string;
  side: ShiftSide;
  boardStaff: BoardStaffInput[];
  closedIds: Set<string>;
  combinedPairs: CombinedPair[];
  roster: Staff[];
  catalog: Assignment[];
  config: EngineConfig;
  shifts: Shift[];
}

interface WorkingStaff extends Staff {
  start: string;
  leavingEarly: boolean;
}

export function runEngine(input: RunEngineInput): EngineResult {
  const { date, side, boardStaff, closedIds, combinedPairs, roster, catalog, config, shifts } = input;
  const entries: BoardEntry[] = [];
  const logs: Array<BoardEntry & { timestamp: string }> = [];

  const staff = boardStaff
    .map((b) => {
      const found = roster.find((w) => w.id === b.staff_id);
      if (!found) return null;
      return {
        ...found,
        start: b.start,
        leavingEarly: b.leavingEarly,
        pickedUp: !!b.pickedUp,
        predetermined: b.predetermined || null,
      } as WorkingStaff;
    })
    .filter((w): w is WorkingStaff => !!w && !!w.id);

  const activeCatalog = catalog.filter((a) => !closedIds.has(a.id));
  const core = activeCatalog.filter((a) => !a.special);
  const specials = activeCatalog.filter((a) => a.special);
  const secondaryIds = new Set(combinedPairs.map((p) => p.secondary_id));
  const combinedMap: Record<string, string> = {};
  for (const p of combinedPairs) combinedMap[p.primary_id] = p.secondary_id;

  const win = windowRows(shifts, catalog, date, side);
  const mem: Record<string, StaffMemory> = {};
  for (const w of staff) mem[w.id] = { freq: {}, lastDone: {}, loadPts: 0, dayCt: 0, nightCt: 0, recent7: 0 };
  applyWindowToMemory(mem, win, catalog, date);
  const avgLoad = staff.length ? staff.reduce((s, w) => s + mem[w.id].loadPts, 0) / staff.length : 0;

  function fairness(w: WorkingStaff, a: Assignment): number {
    const m = mem[w.id];
    let variety = 100;
    if (m.lastDone[a.id]) variety = Math.min(100, daysBetween(date, m.lastDone[a.id]) * 3);
    const load = Math.max(0, Math.min(100, 50 + (avgLoad - m.loadPts) * 8));
    const tot = m.dayCt + m.nightCt;
    const share = tot === 0 ? 0.5 : (side === "day" ? m.dayCt : m.nightCt) / tot;
    const dn = Math.max(0, Math.min(100, 100 * (1 - share)));
    const weekly = Math.max(0, 100 - m.recent7 * 20);
    const pref = w.avoidNight && side === "night" ? 0 : 50;
    return Math.round(variety * 0.3 + load * 0.25 + dn * 0.2 + weekly * 0.15 + pref * 0.1);
  }

  const compliant = (w: WorkingStaff, a: Assignment): boolean => {
    if (a.non_repeatable && (mem[w.id].freq[a.id] || 0) > 0) return false;
    if ((mem[w.id].freq[a.id] || 0) >= config.max_assignment_frequency) return false;
    return true;
  };

  const used = new Set<string>();
  const placed = new Set<string>();
  for (const p of combinedPairs) used.add(p.secondary_id);

  function record(w: WorkingStaff, pa: Assignment, meta: Partial<BoardEntry> = {}, sa: Assignment | null = null) {
    used.add(pa.id);
    if (sa) used.add(sa.id);
    placed.add(w.id);
    const cl = sa ? (LOAD_PTS[pa.load_level] || 2) + (LOAD_PTS[sa.load_level] || 2) : null;
    const e: BoardEntry = {
      staff_id: w.id,
      staff_name: w.name,
      role: w.role,
      competency: w.competency,
      tech_specialty: w.tech_specialty || null,
      agency: !!w.agency,
      start: w.start,
      leavingEarly: !!w.leavingEarly,
      pickedUp: !!w.pickedUp,
      assignment_id: pa.id,
      assignment_name: pa.name || WILDCARD,
      category: pa.category || "—",
      combined_with: sa?.id || null,
      combined_name: sa?.name || null,
      combined_load_pts: cl,
      override_type: (meta.override_type as OverrideType) || "none",
      reason: meta.reason || "Selected by fairness score",
      violated_rule: meta.violated_rule || "none",
      fairness_score: meta.fairness_score ?? null,
      rotation_compliant: meta.rotation_compliant !== false,
      wildcard_used: pa.id === WILDCARD,
      boarder: false,
      boarderComment: "",
      runtimeCombinedWith: null,
      runtimeCombineComment: "",
      held: false,
      partial: false,
    };
    entries.push(e);
    logs.push({ ...e, timestamp: new Date().toISOString() });
    const m = mem[w.id];
    m.freq[pa.id] = (m.freq[pa.id] || 0) + 1;
    if (sa) m.freq[sa.id] = (m.freq[sa.id] || 0) + 1;
    m.loadPts += LOAD_PTS[pa.load_level] || 2;
    if (sa) m.loadPts += LOAD_PTS[sa.load_level] || 2;
    if (side === "night") m.nightCt++;
    else m.dayCt++;
  }

  /* Predetermined first — exempt from frequency-cap checks. */
  for (const w of staff.filter((x) => x.predetermined && x.predetermined.assignmentId)) {
    if (placed.has(w.id)) continue;
    const pa = catalog.find((x) => x.id === w.predetermined!.assignmentId);
    if (!pa || used.has(pa.id)) continue;
    const sa = combinedMap[pa.id] ? catalog.find((x) => x.id === combinedMap[pa.id]) || null : null;
    record(
      w,
      pa,
      {
        override_type: "predetermined",
        reason: w.predetermined!.comment || "Predetermined assignment",
        rotation_compliant: true,
      },
      sa,
    );
  }

  const criticals = core
    .filter((a) => a.critical && !secondaryIds.has(a.id))
    .sort((x, y) => (LOAD_PTS[y.load_level] || 2) - (LOAD_PTS[x.load_level] || 2));

  for (const a of criticals) {
    if (used.has(a.id)) continue;
    const sa = combinedMap[a.id] ? catalog.find((x) => x.id === combinedMap[a.id]) || null : null;
    const pool = staff.filter(
      (w) => !placed.has(w.id) && eligible(w, a) && earlyOk(w, a) && (!sa || eligible(w, sa)),
    );
    if (!pool.length) continue;
    const ok = pool.filter((w) => compliant(w, a) && (!sa || compliant(w, sa)));
    const from = ok.length ? ok : pool;
    const ranked = from.map((w) => ({ w, s: fairness(w, a) })).sort((x, y) => y.s - x.s);
    const { w, s } = ranked[0];
    if (ok.length) record(w, a, { fairness_score: s }, sa);
    else {
      record(
        w,
        a,
        {
          override_type: "staffing_override",
          violated_rule: "frequency_limit",
          reason: `Critical "${a.name}" had no rotation-compliant candidate; coverage takes precedence`,
          fairness_score: s,
          rotation_compliant: false,
        },
        sa,
      );
    }
  }

  for (const w of staff.filter((x) => !placed.has(x.id))) {
    const open = core.filter(
      (a) => !used.has(a.id) && !secondaryIds.has(a.id) && eligible(w, a) && earlyOk(w, a),
    );
    const ok = open.filter((a) => compliant(w, a));
    if (ok.length) {
      const p = ok.map((a) => ({ a, s: fairness(w, a) })).sort((x, y) => y.s - x.s)[0];
      record(w, p.a, { fairness_score: p.s });
      continue;
    }
    if (open.length) {
      const p = open.map((a) => ({ a, s: fairness(w, a) })).sort((x, y) => y.s - x.s)[0];
      record(w, p.a, {
        override_type: "fallback_override",
        violated_rule: "frequency_limit",
        reason: "Rotation limits exhausted; frequency cap relaxed to preserve real assignment",
        fairness_score: p.s,
        rotation_compliant: false,
      });
      continue;
    }
    const sp = specials.filter((a) => !used.has(a.id) && eligible(w, a) && earlyOk(w, a));
    if (sp.length) {
      const p = sp.map((a) => ({ a, s: fairness(w, a) })).sort((x, y) => y.s - x.s)[0];
      record(w, p.a, {
        override_type: "special_assignment",
        reason: "All standard assignments covered; issued from special tier",
        fairness_score: p.s,
      });
      continue;
    }
    record(
      w,
      { id: WILDCARD, name: WILDCARD, category: "—", load_level: "light", min_competency: "untrained", roles: ["nurse"], tech_specialty: null, critical: false, special: false, non_repeatable: false, closeable: false },
      {
        override_type: "wildcard_override",
        violated_rule: "qualification",
        reason: w.leavingEarly
          ? "Early departure + no light/special slots remaining"
          : "No eligible assignment for this role/competency/specialty",
      },
    );
  }

  const deficiencies = computeDeficiencies({
    entries,
    core,
    secondaryIds,
    used,
    staffCount: staff.length,
    config,
    side,
  });

  return {
    entries,
    logs,
    deficiencies,
    staffCount: staff.length,
    closedAssignments: catalog.filter((a) => closedIds.has(a.id)).map((a) => a.name),
  };
}

export function heldOverWarnings(shifts: Shift[]): string[] {
  const lastClosed = [...shifts]
    .filter((s) => s.eod?.closed)
    .sort((a, b) => new Date(b.eod!.closed_at || b.date).getTime() - new Date(a.eod!.closed_at || a.date).getTime())[0];
  if (!lastClosed) return [];
  const held = Object.entries(lastClosed.eod?.outcomes || {}).filter(([, o]) => o.heldOver);
  return held.map(([stid]) => {
    const nm = lastClosed.entries.find((e) => e.staff_id === stid)?.staff_name || stid;
    return `${nm} - employee may still be working; held on previous close-out`;
  });
}
