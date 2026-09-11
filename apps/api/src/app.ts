import { Hono } from "hono";
import { cors } from "hono/cors";
import { LOAD_PTS, WILDCARD, type BoardEntry, type CombinedPair, type Shift, type Staff } from "@rotation/shared";
import { eligible, heldOverWarnings, recomputeDeficiencies, runEngine } from "@rotation/engine";
import {
  AppEnv,
  clearSession,
  issueSession,
  login,
  requireAuth,
  requireRole,
} from "./auth.js";
import {
  deleteAssignment,
  deleteStaff,
  deleteUser,
  getConfig,
  getShift,
  getUserById,
  listCatalog,
  listShifts,
  listStaff,
  listUsers,
  publicUser,
  replaceStaff,
  resetAll,
  setConfig,
  upsertAssignment,
  upsertShift,
  upsertStaff,
  upsertUser,
} from "./db.js";
import { hashPassword, parseRosterWorkbook, rosterToWorkbook } from "@rotation/db";
import { registerHistoryRoutes } from "./history.js";

const today = () => new Date().toISOString().slice(0, 10);

function assignmentName(id: string) {
  if (id === WILDCARD) return WILDCARD;
  return listCatalog().find((a) => a.id === id)?.name || id;
}

function sid(c: { req: { param: (k: string) => string | undefined } }, key = "id") {
  const v = c.req.param(key);
  if (!v) throw new Error("missing route param");
  return v;
}

function xlsx(buf: Buffer, filename: string) {
  return new Response(Uint8Array.from(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use(
    "*",
    cors({
      origin: (origin) => origin || "http://localhost:5173",
      credentials: true,
    }),
  );

  app.get("/api/health", (c) => c.json({ ok: true }));
  registerHistoryRoutes(app);

  app.post("/api/auth/login", async (c) => {
    const body = await c.req.json<{ username?: string; password?: string }>();
    const user = login(body.username || "", body.password || "");
    if (!user) return c.json({ error: "Invalid credentials" }, 401);
    issueSession(c, user);
    return c.json({ user });
  });

  app.post("/api/auth/logout", requireAuth, async (c) => {
    clearSession(c);
    return c.json({ ok: true });
  });

  app.get("/api/auth/me", requireAuth, (c) => c.json({ user: c.get("user") }));

  app.get("/api/bootstrap", requireAuth, (c) => {
    const roster = listStaff();
    const catalog = listCatalog();
    const config = getConfig();
    const shifts = listShifts();
    const user = c.get("user");
    return c.json({
      user,
      roster,
      catalog,
      config,
      shifts,
      users: user.role === "admin" ? listUsers().map(publicUser) : undefined,
    });
  });

  app.get("/api/dashboard", requireAuth, (c) => {
    const roster = listStaff();
    const shifts = listShifts();
    const open = shifts.filter((s) => !s.eod?.closed && !s.futurePending);
    const pending = shifts.filter((s) => s.futurePending && !s.eod?.closed);
    const defs = open.flatMap((s) => s.deficiencies || []);
    return c.json({
      openShifts: open.length,
      pendingBoards: pending.length,
      criticalCount: defs.filter((d) => d.severity === "red").length,
      reviewCount: defs.filter((d) => d.severity === "amber").length,
      activeStaff: roster.filter((w) => w.active !== false).length,
      rotationMonth: new Date().toISOString().slice(0, 7),
      open,
      pending,
    });
  });

  app.post("/api/generate", requireAuth, async (c) => {
    const body = await c.req.json<{
      date: string;
      side: "day" | "night";
      boardStaff: Array<{
        staff_id: string;
        start: string;
        leavingEarly: boolean;
        pickedUp: boolean;
        predetermined: { assignmentId: string; comment: string } | null;
      }>;
      closedIds: string[];
      combinedPairs: CombinedPair[];
    }>();
    if (!body.boardStaff?.length) return c.json({ error: "Select on-duty staff" }, 400);
    const incomplete = body.boardStaff.some(
      (b) => b.predetermined && (!b.predetermined.assignmentId || !b.predetermined.comment?.trim()),
    );
    if (incomplete) {
      return c.json({ error: "A PREDETERMINED staff member is missing an assignment or justification comment." }, 400);
    }
    const result = runEngine({
      date: body.date,
      side: body.side,
      boardStaff: body.boardStaff,
      closedIds: new Set(body.closedIds || []),
      combinedPairs: body.combinedPairs || [],
      roster: listStaff(),
      catalog: listCatalog(),
      config: getConfig(),
      shifts: listShifts(),
    });
    return c.json({
      ...result,
      warnings: heldOverWarnings(listShifts()),
    });
  });

  app.post("/api/shifts", requireAuth, async (c) => {
    const body = await c.req.json<
      Partial<Shift> & {
        date: string;
        side: "day" | "night";
        entries: BoardEntry[];
        saveAs?: "current" | "pending";
      }
    >();
    if (!body.entries?.length) return c.json({ error: "No entries" }, 400);
    const futurePending = body.saveAs === "pending" || body.date > today();
    const rec: Shift = {
      id: `SH-${Date.now()}`,
      date: body.date,
      side: body.side,
      generated_by: c.get("user").name,
      generated_at: new Date().toISOString(),
      entries: body.entries,
      logs: body.logs || [],
      deficiencies: body.deficiencies || [],
      closed_assignments: body.closed_assignments || [],
      closed_assignments_ids: body.closed_assignments_ids || [],
      combined_pairs: body.combined_pairs || [],
      redistributions: [],
      eod: null,
      futurePending,
      complianceChecks: [],
    };
    upsertShift(rec);
    return c.json({ shift: rec });
  });

  app.get("/api/shifts", requireAuth, (c) => c.json({ shifts: listShifts() }));

  app.get("/api/shifts/:id", requireAuth, (c) => {
    const shift = getShift(sid(c));
    if (!shift) return c.json({ error: "Not found" }, 404);
    return c.json({ shift });
  });

  app.patch("/api/shifts/:id", requireAuth, async (c) => {
    const shift = getShift(sid(c));
    if (!shift) return c.json({ error: "Not found" }, 404);
    const patch = await c.req.json<Partial<Shift>>();
    const next = { ...shift, ...patch, id: shift.id };
    upsertShift(next);
    return c.json({ shift: next });
  });

  app.post("/api/shifts/:id/entries/:staffId", requireAuth, async (c) => {
    const shift = getShift(sid(c));
    if (!shift) return c.json({ error: "Not found" }, 404);
    const staffId = sid(c, "staffId");
    const patch = await c.req.json<Partial<BoardEntry>>();
    shift.entries = shift.entries.map((e) => (e.staff_id === staffId ? { ...e, ...patch } : e));
    upsertShift(shift);
    return c.json({ shift });
  });

  app.post("/api/shifts/:id/redistribute", requireAuth, async (c) => {
    const shift = getShift(sid(c));
    if (!shift) return c.json({ error: "Not found" }, 404);
    const { staffId, newAssignmentId, reason } = await c.req.json<{
      staffId: string;
      newAssignmentId: string;
      reason?: string;
    }>();
    const catalog = listCatalog();
    shift.entries = shift.entries.map((e) => {
      if (e.staff_id !== staffId) return e;
      return {
        ...e,
        previous_assignment_id: e.previous_assignment_id || e.assignment_id,
        previous_assignment_name: e.previous_assignment_name || e.assignment_name,
        assignment_id: newAssignmentId,
        assignment_name: assignmentName(newAssignmentId),
        category: catalog.find((a) => a.id === newAssignmentId)?.category || "—",
        wildcard_used: newAssignmentId === WILDCARD,
        override_type: "redistributed",
        partial: true,
        reason: reason || `Redistributed by ${c.get("user").name}`,
      };
    });
    const e = shift.entries.find((x) => x.staff_id === staffId)!;
    shift.redistributions = [
      ...(shift.redistributions || []),
      {
        timestamp: new Date().toISOString(),
        by: c.get("user").name,
        staff_id: staffId,
        staff_name: e.staff_name,
        from: e.previous_assignment_name || "",
        to: e.assignment_name,
        reason: e.reason,
      },
    ];
    shift.deficiencies = recomputeDeficiencies({
      entries: shift.entries,
      catalog,
      closedIds: new Set([...(shift.closed_assignments_ids || []), ...(shift.mid_shift_closed_ids || [])]),
      combinedPairs: shift.combined_pairs || [],
      staffCount: shift.entries.length,
      config: getConfig(),
      side: shift.side,
    });
    upsertShift(shift);
    return c.json({ shift });
  });

  app.post("/api/shifts/:id/hold", requireAuth, async (c) => {
    const shift = getShift(sid(c));
    if (!shift) return c.json({ error: "Not found" }, 404);
    const { staffId } = await c.req.json<{ staffId: string }>();
    shift.entries = shift.entries.map((e) => (e.staff_id === staffId ? { ...e, held: !e.held } : e));
    upsertShift(shift);
    return c.json({ shift });
  });

  app.post("/api/shifts/:id/regenerate", requireAuth, async (c) => {
    const shift = getShift(sid(c));
    if (!shift) return c.json({ error: "Not found" }, 404);
    const heldEntries = shift.entries.filter((e) => e.held);
    const freeEntries = shift.entries.filter((e) => !e.held);
    const heldAssignmentIds = new Set(heldEntries.map((e) => e.assignment_id));
    const result = runEngine({
      date: shift.date,
      side: shift.side,
      boardStaff: freeEntries.map((e) => ({
        staff_id: e.staff_id,
        start: e.start,
        leavingEarly: e.leavingEarly,
        pickedUp: e.pickedUp,
        predetermined: null,
      })),
      closedIds: new Set([...(shift.closed_assignments_ids || []), ...heldAssignmentIds]),
      combinedPairs: shift.combined_pairs || [],
      roster: listStaff(),
      catalog: listCatalog(),
      config: getConfig(),
      shifts: listShifts().filter((s) => s.id !== shift.id),
    });
    const byStaff = new Map(result.entries.map((e) => [e.staff_id, e]));
    let changed = 0;
    const merged = shift.entries.map((e) => {
      if (e.held) return e;
      const next = byStaff.get(e.staff_id);
      if (!next) return e;
      if (next.assignment_id === e.assignment_id) return e;
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
    shift.entries = merged;
    shift.deficiencies = recomputeDeficiencies({
      entries: merged,
      catalog: listCatalog(),
      closedIds: new Set([...(shift.closed_assignments_ids || []), ...(shift.mid_shift_closed_ids || [])]),
      combinedPairs: shift.combined_pairs || [],
      staffCount: merged.length,
      config: getConfig(),
      side: shift.side,
    });
    shift.redistributions = [
      ...(shift.redistributions || []),
      {
        timestamp: new Date().toISOString(),
        by: c.get("user").name,
        staff_id: "",
        staff_name: "BOARD",
        from: "previous",
        to: "regenerated",
        reason: `${changed} assignments changed, ${heldEntries.length} held staff untouched`,
      },
    ];
    upsertShift(shift);
    return c.json({ shift, changed, held: heldEntries.length });
  });

  app.post("/api/shifts/:id/compliance", requireAuth, async (c) => {
    const shift = getShift(sid(c));
    if (!shift) return c.json({ error: "Not found" }, 404);
    const closed = new Set([...(shift.closed_assignments_ids || []), ...(shift.mid_shift_closed_ids || [])]);
    const deficiencies = recomputeDeficiencies({
      entries: shift.entries,
      catalog: listCatalog(),
      closedIds: closed,
      combinedPairs: shift.combined_pairs || [],
      staffCount: shift.entries.length,
      config: getConfig(),
      side: shift.side,
    });
    const rec = {
      timestamp: new Date().toISOString(),
      by: c.get("user").name,
      result: deficiencies.length === 0 ? ("good_to_go" as const) : ("issues" as const),
      issueCount: deficiencies.length,
    };
    shift.complianceChecks = [...(shift.complianceChecks || []), rec];
    shift.deficiencies = deficiencies;
    upsertShift(shift);
    return c.json({ shift, deficiencies });
  });

  app.post("/api/shifts/:id/assign-deficiency", requireAuth, async (c) => {
    const shift = getShift(sid(c));
    if (!shift) return c.json({ error: "Not found" }, 404);
    const { staffId, assignmentId, comment } = await c.req.json<{
      staffId: string;
      assignmentId: string;
      comment: string;
    }>();
    const w = listStaff().find((x) => x.id === staffId);
    const a = listCatalog().find((x) => x.id === assignmentId);
    if (!w || !a) return c.json({ error: "Invalid staff or assignment" }, 400);
    const entry: BoardEntry = {
      staff_id: w.id,
      staff_name: w.name,
      role: w.role,
      competency: w.competency,
      tech_specialty: w.tech_specialty,
      agency: !!w.agency,
      start: shift.side === "day" ? "07:00" : "19:00",
      leavingEarly: false,
      pickedUp: false,
      assignment_id: a.id,
      assignment_name: a.name,
      category: a.category,
      combined_with: null,
      combined_name: null,
      combined_load_pts: null,
      override_type: "deficiency_assignment",
      reason: comment,
      violated_rule: "none",
      fairness_score: null,
      rotation_compliant: true,
      wildcard_used: false,
      boarder: false,
      boarderComment: "",
      runtimeCombinedWith: null,
      runtimeCombineComment: "",
      held: false,
      partial: false,
    };
    shift.entries = [...shift.entries, entry];
    shift.deficiencies = recomputeDeficiencies({
      entries: shift.entries,
      catalog: listCatalog(),
      closedIds: new Set([...(shift.closed_assignments_ids || []), ...(shift.mid_shift_closed_ids || [])]),
      combinedPairs: shift.combined_pairs || [],
      staffCount: shift.entries.length,
      config: getConfig(),
      side: shift.side,
    });
    upsertShift(shift);
    return c.json({ shift });
  });

  app.post("/api/shifts/:id/close-room", requireAuth, async (c) => {
    const shift = getShift(sid(c));
    if (!shift) return c.json({ error: "Not found" }, 404);
    const { assignmentId } = await c.req.json<{ assignmentId: string }>();
    const set = new Set(shift.mid_shift_closed_ids || []);
    if (set.has(assignmentId)) set.delete(assignmentId);
    else set.add(assignmentId);
    shift.mid_shift_closed_ids = [...set];
    upsertShift(shift);
    return c.json({ shift });
  });

  app.post("/api/shifts/:id/eod", requireAuth, async (c) => {
    const shift = getShift(sid(c));
    if (!shift) return c.json({ error: "Not found" }, 404);
    if (!shift.eod) {
      const outcomes: NonNullable<Shift["eod"]>["outcomes"] = {};
      for (const e of shift.entries) {
        outcomes[e.staff_id] = {
          status: "as_assigned",
          reassigned_to: "",
          note: "",
          heldOver: false,
          excludeFromMemory: false,
        };
      }
      shift.eod = {
        closed: false,
        outcomes,
        closeout_timestamp: new Date().toISOString().slice(0, 16),
      };
    }
    upsertShift(shift);
    return c.json({ shift });
  });

  app.patch("/api/shifts/:id/eod", requireAuth, async (c) => {
    const shift = getShift(sid(c));
    if (!shift) return c.json({ error: "Not found" }, 404);
    const body = await c.req.json<{
      staffId?: string;
      patch?: Record<string, unknown>;
      closeout_timestamp?: string;
      notes?: string;
      close?: boolean;
    }>();
    shift.eod = shift.eod || { closed: false, outcomes: {} };
    if (body.closeout_timestamp) shift.eod.closeout_timestamp = body.closeout_timestamp;
    if (body.notes !== undefined) shift.eod.notes = body.notes;
    if (body.staffId && body.patch) {
      const prev = shift.eod.outcomes[body.staffId] || {
        status: "as_assigned" as const,
        reassigned_to: "",
        note: "",
        heldOver: false,
        excludeFromMemory: false,
      };
      shift.eod.outcomes[body.staffId] = { ...prev, ...body.patch };
    }
    if (body.close) {
      shift.eod.closed = true;
      shift.eod.closed_by = c.get("user").name;
      shift.eod.closed_at = new Date().toISOString();
    }
    upsertShift(shift);
    return c.json({ shift });
  });

  app.post("/api/shifts/historical", requireAuth, async (c) => {
    const body = await c.req.json<{
      date: string;
      side: "day" | "night";
      rows: Array<{ staff_id: string; assignment_id: string }>;
      justification: string;
    }>();
    if (!body.justification?.trim()) return c.json({ error: "Justification required" }, 400);
    const roster = listStaff();
    const catalog = listCatalog();
    const entries = body.rows
      .map((r) => {
        const w = roster.find((x) => x.id === r.staff_id);
        const a = catalog.find((x) => x.id === r.assignment_id);
        if (!w || !a) return null;
        return {
          staff_id: w.id,
          staff_name: w.name,
          role: w.role,
          competency: w.competency,
          tech_specialty: w.tech_specialty,
          agency: !!w.agency,
          start: body.side === "day" ? "07:00" : "19:00",
          leavingEarly: false,
          pickedUp: false,
          assignment_id: a.id,
          assignment_name: a.name,
          category: a.category,
          combined_with: null,
          combined_name: null,
          combined_load_pts: null,
          override_type: "manual_historical" as const,
          reason: body.justification.trim(),
          violated_rule: "none",
          fairness_score: null,
          rotation_compliant: true,
          wildcard_used: false,
          boarder: false,
          boarderComment: "",
          runtimeCombinedWith: null,
          runtimeCombineComment: "",
          held: false,
          partial: false,
        };
      })
      .filter(Boolean) as BoardEntry[];
    const rec: Shift = {
      id: `SH-${Date.now()}`,
      date: body.date,
      side: body.side,
      generated_by: c.get("user").name,
      generated_at: new Date().toISOString(),
      entries,
      logs: [],
      deficiencies: [],
      closed_assignments: [],
      closed_assignments_ids: [],
      combined_pairs: [],
      redistributions: [],
      manual_entry: true,
      justification: body.justification.trim(),
      complianceChecks: [],
      eod: {
        closed: true,
        outcomes: {},
        notes: body.justification.trim(),
        closed_by: c.get("user").name,
        closed_at: new Date().toISOString(),
        closeout_timestamp: new Date().toISOString().slice(0, 16),
      },
    };
    upsertShift(rec);
    return c.json({ shift: rec });
  });

  app.get("/api/roster", requireAuth, (c) => c.json({ roster: listStaff() }));

  app.put("/api/roster", requireAuth, requireRole("admin"), async (c) => {
    const { roster } = await c.req.json<{ roster: Staff[] }>();
    replaceStaff(roster);
    return c.json({ roster: listStaff() });
  });

  app.post("/api/roster", requireAuth, requireRole("admin"), async (c) => {
    const row = await c.req.json<Staff>();
    if (!row.id) row.id = `S${Date.now() % 100000}`;
    const defaults: Staff = {
      id: row.id,
      name: row.name || "New staff",
      role: "nurse",
      competency: "trained",
      tech_specialty: null,
      avoidNight: false,
      agency: false,
      active: true,
      pickedUp: false,
      predetermined: null,
    };
    upsertStaff({ ...defaults, ...row });
    return c.json({ roster: listStaff() });
  });

  app.delete("/api/roster/:id", requireAuth, requireRole("admin"), (c) => {
    deleteStaff(sid(c));
    return c.json({ roster: listStaff() });
  });

  app.post("/api/roster/bulk", requireAuth, requireRole("admin"), async (c) => {
    const { ids, patch, action } = await c.req.json<{
      ids: string[];
      patch?: Partial<Staff>;
      action?: "delete";
    }>();
    const set = new Set(ids || []);
    let roster = listStaff();
    if (action === "delete") roster = roster.filter((w) => !set.has(w.id));
    else roster = roster.map((w) => (set.has(w.id) ? { ...w, ...patch } : w));
    replaceStaff(roster);
    return c.json({ roster });
  });

  app.get("/api/export/roster", requireAuth, (c) => {
    return xlsx(rosterToWorkbook(listStaff()), `ED-Roster-${today()}.xlsx`);
  });

  app.post("/api/import/roster", requireAuth, requireRole("admin"), async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) return c.json({ error: "file required" }, 400);
    const buf = Buffer.from(await file.arrayBuffer());
    const rows = parseRosterWorkbook(buf);
    let roster = listStaff();
    let added = 0;
    let updated = 0;
    for (const patch of rows) {
      const idx = patch.id ? roster.findIndex((w) => w.id === patch.id) : -1;
      if (idx >= 0) {
        roster[idx] = { ...roster[idx], ...patch, id: roster[idx].id };
        updated++;
      } else {
        roster.push({
          id: patch.id || `S${Date.now()}${Math.floor(Math.random() * 1000)}`,
          name: patch.name || "Unnamed",
          role: patch.role || "nurse",
          competency: patch.competency || "trained",
          tech_specialty: patch.tech_specialty ?? null,
          avoidNight: !!patch.avoidNight,
          agency: !!patch.agency,
          active: patch.active !== false,
          pickedUp: false,
          predetermined: null,
        });
        added++;
      }
    }
    replaceStaff(roster);
    return c.json({ added, updated, total: rows.length, roster });
  });

  app.get("/api/catalog", requireAuth, (c) => c.json({ catalog: listCatalog() }));

  app.post("/api/catalog", requireAuth, requireRole("admin"), async (c) => {
    const row = await c.req.json();
    if (!row.id) row.id = `A${Date.now() % 100000}`;
    upsertAssignment({
      category: "Flow",
      load_level: "medium",
      min_competency: "trained",
      roles: ["nurse"],
      tech_specialty: null,
      critical: false,
      special: false,
      non_repeatable: false,
      closeable: true,
      name: "New assignment",
      ...row,
    });
    return c.json({ catalog: listCatalog() });
  });

  app.delete("/api/catalog/:id", requireAuth, requireRole("admin"), (c) => {
    deleteAssignment(sid(c));
    return c.json({ catalog: listCatalog() });
  });

  app.get("/api/config", requireAuth, (c) => c.json({ config: getConfig() }));

  app.put("/api/config", requireAuth, requireRole("admin"), async (c) => {
    const cfg = await c.req.json();
    setConfig({ ...getConfig(), ...cfg });
    return c.json({ config: getConfig() });
  });

  app.get("/api/users", requireAuth, requireRole("admin"), (c) =>
    c.json({ users: listUsers().map(publicUser) }),
  );

  app.post("/api/users", requireAuth, requireRole("admin"), async (c) => {
    const body = await c.req.json<{
      id?: string;
      username: string;
      name: string;
      role: "admin" | "charge-nurse";
      password?: string;
    }>();
    const existing = body.id ? getUserById(body.id) : undefined;
    const id = body.id || `U${Date.now() % 100000}`;
    upsertUser({
      id,
      username: body.username,
      name: body.name,
      role: body.role,
      password_hash: body.password ? hashPassword(body.password) : existing?.password_hash || hashPassword("rotation"),
    });
    return c.json({ users: listUsers().map(publicUser) });
  });

  app.delete("/api/users/:id", requireAuth, requireRole("admin"), (c) => {
    const id = sid(c);
    if (id === c.get("user").id) return c.json({ error: "Cannot delete yourself" }, 400);
    deleteUser(id);
    return c.json({ users: listUsers().map(publicUser) });
  });

  app.post("/api/reset", requireAuth, requireRole("admin"), (c) => {
    resetAll();
    return c.json({ ok: true });
  });

  app.get("/api/eligible", requireAuth, (c) => {
    const staffId = c.req.query("staffId");
    const assignmentId = c.req.query("assignmentId");
    const w = listStaff().find((x) => x.id === staffId);
    const a = listCatalog().find((x) => x.id === assignmentId);
    if (!w || !a) return c.json({ eligible: false });
    return c.json({ eligible: eligible(w, a) });
  });

  /* helper used by combine load calc on the client; also expose LOAD_PTS */
  app.get("/api/meta", requireAuth, (c) => c.json({ wildcard: WILDCARD, loadPts: LOAD_PTS }));

  return app;
}
