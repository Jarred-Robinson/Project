import { useEffect, useState } from "react";
import {
  START_TIMES,
  TECH_SPECIALTIES,
  WILDCARD,
  type Assignment,
  type BoardEntry,
  type CombinedPair,
  type Deficiency,
  type EngineConfig,
  type EngineResult,
  type Shift,
  type Staff,
  type UserAccount,
} from "@rotation/shared";
import { eligible } from "@rotation/engine";
import { api, downloadUrl } from "./api";
import {
  Badge,
  Btn,
  C,
  Chip,
  Field,
  Panel,
  SearchBox,
  Toggle,
  ZoneLegend,
  iCls,
  iSty,
  match,
  zoneColor,
} from "./ui";

function rotationMonth(date: string) {
  return date.slice(0, 7);
}

export function App() {
  const [boot, setBoot] = useState(true);
  const [user, setUser] = useState<UserAccount | null>(null);
  const [roster, setRoster] = useState<Staff[]>([]);
  const [catalog, setCatalog] = useState<Assignment[]>([]);
  const [config, setConfig] = useState<EngineConfig | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [tab, setTab] = useState("dash");
  const [err, setErr] = useState("");
  const [notes, setNotes] = useState<Array<{ id: string; text: string; severity: string; ts: string }>>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [eodId, setEodId] = useState<string | null>(null);

  const push = (text: string, severity = "info") =>
    setNotes((p) => [...p, { id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text, severity, ts: new Date().toISOString() }]);

  const load = async () => {
    try {
      const data = await api.bootstrap();
      setUser(data.user);
      setRoster(data.roster);
      setCatalog(data.catalog);
      setConfig(data.config);
      setShifts(data.shifts);
      if (data.users) setUsers(data.users);
    } catch (e: unknown) {
      if ((e as { status?: number }).status === 401) setUser(null);
    } finally {
      setBoot(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const replaceShift = (s: Shift) => setShifts((prev) => prev.map((x) => (x.id === s.id ? s : x)));

  if (boot) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
        <div className="font-mono text-sm" style={{ color: C.sub }}>
          Loading board data…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Login
        err={err}
        onSubmit={async (username, password) => {
          try {
            await api.login(username, password);
            setErr("");
            setBoot(true);
            await load();
          } catch (e) {
            setErr((e as Error).message || "Incorrect credentials.");
          }
        }}
      />
    );
  }

  const isAdmin = user.role === "admin";
  const tabs: Array<[string, string]> = [
    ["dash", "Dashboard"],
    ["board", "Generate Board"],
    ["shifts", "Current Shift"],
    ["archive", "Archive"],
    ...(tab === "eod" ? [["eod", "EOD Closeout"] as [string, string]] : []),
    ["roster", "Roster"],
    ...(isAdmin
      ? [
          ["catalog", "Catalog"] as [string, string],
          ["config", "Config"] as [string, string],
          ["users", "Users"] as [string, string],
        ]
      : []),
  ];

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.ink }}>
      <header style={{ background: C.ink }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="display text-2xl font-bold" style={{ color: "#EEF2F1", letterSpacing: "0.04em" }}>
              ROTATION ENGINE <span style={{ color: C.tealMid, fontSize: "0.8em" }}>v5</span>
            </div>
            <div className="text-xs font-mono mt-0.5" style={{ color: "#8FA4A8" }}>
              {roster.filter((w) => w.active !== false).length} staff · monthly rotation window ({rotationMonth(new Date().toISOString())}) · sqlite
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs font-mono text-right" style={{ color: "#8FA4A8" }}>
              {user.name}
              <br />
              <span style={{ color: isAdmin ? "#D4B96A" : "#8FA4A8" }}>{user.role.toUpperCase()}</span>
            </div>
            <Btn
              tone="slate"
              onClick={async () => {
                await api.logout();
                setUser(null);
              }}
            >
              SIGN OUT
            </Btn>
          </div>
        </div>
      </header>

      {notes.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 pt-3 space-y-1.5">
          {notes.map((n) => {
            const s = n.severity === "danger" ? { bg: C.redSoft, fg: C.red } : n.severity === "warn" ? { bg: C.amberSoft, fg: C.amber } : { bg: C.tealSoft, fg: C.teal };
            return (
              <div key={n.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm" style={{ background: s.bg, color: s.fg }}>
                <span className="flex-1">{n.text}</span>
                <button className="font-mono" onClick={() => setNotes((p) => p.filter((x) => x.id !== n.id))}>
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      <nav className="border-b" style={{ background: C.panel, borderColor: C.line }}>
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap gap-1">
          {tabs.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className="px-3 py-2.5 text-sm font-mono border-b-2"
              style={{ borderColor: tab === k ? C.teal : "transparent", color: tab === k ? C.teal : C.sub, fontWeight: tab === k ? 600 : 400 }}
            >
              {l}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-4">
        {tab === "dash" && <Dashboard shifts={shifts} roster={roster} onOpen={(id, t) => { setOpenId(id); setTab(t); }} />}
        {tab === "board" && (
          <GenerateBoard
            roster={roster}
            catalog={catalog}
            config={config!}
            onNotify={push}
            onSaved={(s, dest) => {
              setShifts((p) => [s, ...p]);
              setOpenId(s.id);
              setTab(dest);
            }}
          />
        )}
        {tab === "shifts" && (
          <CurrentShiftPage
            shifts={shifts.filter((s) => !s.eod?.closed && !s.futurePending)}
            catalog={catalog}
            roster={roster}
            me={user}
            openId={openId}
            setOpenId={setOpenId}
            replaceShift={replaceShift}
            onNotify={push}
            onCloseout={(id) => {
              setEodId(id);
              setTab("eod");
            }}
          />
        )}
        {tab === "archive" && (
          <ArchivePage
            shifts={shifts}
            catalog={catalog}
            roster={roster}
            me={user}
            openId={openId}
            setOpenId={setOpenId}
            replaceShift={replaceShift}
            onNotify={push}
            onAdded={(s) => setShifts((p) => [s, ...p])}
            onCloseout={(id) => {
              setEodId(id);
              setTab("eod");
            }}
          />
        )}
        {tab === "eod" && eodId && (
          <EodPage
            shift={shifts.find((s) => s.id === eodId)}
            catalog={catalog}
            replaceShift={replaceShift}
            onBack={() => setTab("shifts")}
          />
        )}
        {tab === "roster" && <RosterPage roster={roster} setRoster={setRoster} isAdmin={isAdmin} onNotify={push} />}
        {tab === "catalog" && isAdmin && <CatalogPage catalog={catalog} setCatalog={setCatalog} />}
        {tab === "config" && isAdmin && config && <ConfigPage config={config} setConfig={setConfig} onReset={async () => { await api.reset(); location.reload(); }} />}
        {tab === "users" && isAdmin && <UsersPage users={users} setUsers={setUsers} me={user} />}
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-6 text-xs font-mono" style={{ color: C.sub }}>
        Precedence: predetermined assignment → role → tech specialty → competency → early-out → close → critical coverage → calendar-month rotation window → frequency cap → fairness → fallback → special → wildcard.
        Deficiency-review assignments and manual/historical entries sit outside this automated chain.
      </footer>
    </div>
  );

}

function Login({ err, onSubmit }: { err: string; onSubmit: (u: string, p: string) => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("rotation");
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: C.bg }}>
      <form
        className="w-full max-w-sm rounded-xl border p-6 space-y-3"
        style={{ background: C.panel, borderColor: C.line }}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(username, password);
        }}
      >
        <div className="display text-xl font-bold" style={{ color: C.ink }}>
          ROTATION ENGINE
        </div>
        <div className="text-xs font-mono" style={{ color: C.sub }}>
          SIGN IN — ED SHIFT OPS BOARD
        </div>
        <Field label="Username">
          <input className={iCls} style={iSty} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </Field>
        <Field label="Password">
          <input className={iCls + " font-mono"} style={iSty} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </Field>
        {err && (
          <div className="text-xs" style={{ color: C.red }}>
            {err}
          </div>
        )}
        <Btn wide type="submit">
          SIGN IN
        </Btn>
        <p className="text-xs" style={{ color: C.sub }}>
          Demo: <span className="font-mono">admin / rotation</span> or <span className="font-mono">charge / rotation</span>
        </p>
      </form>
    </div>
  );
}

function Dashboard({
  shifts,
  roster,
  onOpen,
}: {
  shifts: Shift[];
  roster: Staff[];
  onOpen: (id: string, tab: string) => void;
}) {
  const open = shifts.filter((s) => !s.eod?.closed && !s.futurePending);
  const pending = shifts.filter((s) => s.futurePending && !s.eod?.closed);
  const defs = open.flatMap((s) => s.deficiencies || []);
  const cards = [
    ["OPEN SHIFTS", String(open.length), C.teal],
    ["CRITICAL", String(defs.filter((d) => d.severity === "red").length), C.red],
    ["REVIEW", String(defs.filter((d) => d.severity === "amber").length), C.amber],
    ["PENDING BOARDS", String(pending.length), C.ochre],
  ];
  return (
    <>
      <Panel title="DASHBOARD">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cards.map(([l, v, col]) => (
            <div key={l} className="rounded-lg p-3" style={{ background: C.slate }}>
              <div className="text-xs font-mono" style={{ color: C.sub }}>
                {l}
              </div>
              <div className="display text-3xl font-bold" style={{ color: col as string }}>
                {v}
              </div>
            </div>
          ))}
        </div>
        <div className="text-xs font-mono mt-3" style={{ color: C.sub }}>
          {roster.filter((w) => w.active !== false).length} active staff on the seeded ED roster
        </div>
      </Panel>
      <Panel title="OPEN SHIFTS">
        {!open.length && <div className="text-sm" style={{ color: C.sub }}>No open shifts. Generate a board to start one.</div>}
        {open.map((s) => (
          <button key={s.id} className="w-full text-left rounded px-3 py-2 mb-1" style={{ background: "#F5F7F6", border: `1px solid ${C.line}` }} onClick={() => onOpen(s.id, "shifts")}>
            <span className="font-mono text-sm font-semibold">{s.date} · {s.side.toUpperCase()}</span>
            <span className="text-xs font-mono ml-2" style={{ color: C.sub }}>{s.entries.length} staff · {s.deficiencies.filter((d) => d.severity === "red").length} critical</span>
          </button>
        ))}
      </Panel>
      {pending.length > 0 && (
        <Panel title="PENDING BOARDS">
          {pending.map((s) => (
            <button key={s.id} className="w-full text-left rounded px-3 py-2 mb-1" style={{ background: C.amberSoft, border: `1px solid ${C.amber}` }} onClick={() => onOpen(s.id, "archive")}>
              {s.date} · {s.side.toUpperCase()} · {s.entries.length} staff
            </button>
          ))}
        </Panel>
      )}
    </>
  );
}

function GenerateBoard({
  roster,
  catalog,
  config,
  onNotify,
  onSaved,
}: {
  roster: Staff[];
  catalog: Assignment[];
  config: EngineConfig;
  onNotify: (t: string, s?: string) => void;
  onSaved: (s: Shift, dest: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [side, setSide] = useState<"day" | "night">("day");
  const [picked, setPicked] = useState<Record<string, { on?: boolean; start?: string; leavingEarly?: boolean; pickedUp?: boolean; predetermined?: { assignmentId: string; comment: string } | null }>>({});
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [pairs, setPairs] = useState<CombinedPair[]>([]);
  const [pairA, setPairA] = useState("");
  const [pairB, setPairB] = useState("");
  const [staffQ, setStaffQ] = useState("");
  const [closeQ, setCloseQ] = useState("");
  const [showSelected, setShowSelected] = useState(false);
  const [pending, setPending] = useState<(EngineResult & { date: string; side: "day" | "night" }) | null>(null);
  const closedSet = new Set(Object.entries(closed).filter(([, v]) => v).map(([k]) => k));
  const sel = Object.values(picked).filter((p) => p?.on).length;
  const visible = roster.filter((w) => w.active !== false && match(w.name, staffQ) && (!showSelected || picked[w.id]?.on));
  const predeterminedIncomplete = Object.entries(picked).some(([, p]) => p?.on && p.predetermined && (!p.predetermined.assignmentId || !p.predetermined.comment?.trim()));

  const generate = async () => {
    if (predeterminedIncomplete) {
      onNotify("Cannot generate: a PREDETERMINED staff member is missing an assignment or justification comment.", "danger");
      return;
    }
    const boardStaff = roster
      .filter((w) => picked[w.id]?.on)
      .map((w) => {
        const p = picked[w.id] || {};
        return {
          staff_id: w.id,
          start: p.start || (side === "day" ? "07:00" : "19:00"),
          leavingEarly: !!p.leavingEarly,
          pickedUp: !!p.pickedUp,
          predetermined: p.predetermined?.assignmentId ? p.predetermined : null,
        };
      });
    if (!boardStaff.length) return;
    const result = await api.generate({ date, side, boardStaff, closedIds: [...closedSet], combinedPairs: pairs });
    setPending({ ...result, date, side });
    for (const w of result.warnings || []) onNotify(w, "warn");
  };

  const save = async (saveAs: "current" | "pending") => {
    if (!pending) return;
    const { shift } = await api.saveShift({
      date: pending.date,
      side: pending.side,
      entries: pending.entries,
      logs: pending.logs,
      deficiencies: pending.deficiencies,
      closed_assignments: pending.closedAssignments,
      closed_assignments_ids: [...closedSet],
      combined_pairs: pairs,
      saveAs,
    });
    setPending(null);
    onSaved(shift, saveAs === "pending" || shift.futurePending ? "archive" : "shifts");
  };

  const reassign = (staffId: string, newAssignmentId: string) => {
    if (!pending) return;
    const entries = pending.entries.map((e) =>
      e.staff_id !== staffId
        ? e
        : {
            ...e,
            previous_assignment_id: e.previous_assignment_id || e.assignment_id,
            previous_assignment_name: e.previous_assignment_name || e.assignment_name,
            assignment_id: newAssignmentId,
            assignment_name: newAssignmentId === WILDCARD ? WILDCARD : catalog.find((a) => a.id === newAssignmentId)?.name || newAssignmentId,
            category: catalog.find((a) => a.id === newAssignmentId)?.category || "—",
            wildcard_used: newAssignmentId === WILDCARD,
            override_type: "redistributed" as const,
            partial: true,
          },
    );
    setPending({ ...pending, entries });
  };

  const setEntry = (staffId: string, patch: Partial<BoardEntry>) => {
    if (!pending) return;
    setPending({ ...pending, entries: pending.entries.map((e) => (e.staff_id === staffId ? { ...e, ...patch } : e)) });
  };

  void config;

  return (
    <>
      <Panel title="SHIFT PARAMETERS">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <Field label="Date">
            <input type="date" className={iCls} style={iSty} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Board side">
            <select className={iCls} style={iSty} value={side} onChange={(e) => setSide(e.target.value as "day" | "night")}>
              <option value="day">Day board</option>
              <option value="night">Night board</option>
            </select>
          </Field>
          <div className="col-span-2 flex gap-2 flex-wrap">
            <Btn onClick={generate} disabled={!sel}>
              GENERATE BOARD ({sel})
            </Btn>
            {pending && (
              <>
                <Btn tone="ghost" onClick={() => save("current")}>
                  SAVE CURRENT
                </Btn>
                <Btn tone="amber" onClick={() => save("pending")}>
                  SAVE PENDING
                </Btn>
              </>
            )}
          </div>
        </div>
      </Panel>

      <Panel title={`CLOSE ASSIGNMENTS (LOW CENSUS) — ${closedSet.size} CLOSED`} right={<div style={{ width: 180 }}><SearchBox value={closeQ} onChange={setCloseQ} placeholder="Filter assignments" /></div>}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
          {catalog
            .filter((a) => !a.special && a.closeable && match(a.name, closeQ))
            .map((a) => (
              <button
                key={a.id}
                onClick={() => setClosed({ ...closed, [a.id]: !closed[a.id] })}
                className="text-left text-xs font-mono px-2 py-1.5 rounded border"
                style={{
                  background: closedSet.has(a.id) ? C.amberSoft : C.slate,
                  color: closedSet.has(a.id) ? C.amber : C.sub,
                  borderColor: closedSet.has(a.id) ? C.amber : C.line,
                  textDecoration: closedSet.has(a.id) ? "line-through" : "none",
                }}
              >
                {closedSet.has(a.id) ? "✕ " : ""}
                {a.name}
              </button>
            ))}
        </div>
      </Panel>

      <Panel title={`COMBINED ASSIGNMENTS — ${pairs.length} PAIRS`}>
        <div className="flex gap-2 flex-wrap items-end mb-3">
          <Field label="Primary">
            <select className="rounded px-2 py-1.5 text-sm" style={{ ...iSty, minWidth: 160 }} value={pairA} onChange={(e) => setPairA(e.target.value)}>
              <option value="">Select…</option>
              {catalog.filter((a) => !a.special && !closedSet.has(a.id)).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Combined with">
            <select className="rounded px-2 py-1.5 text-sm" style={{ ...iSty, minWidth: 160 }} value={pairB} onChange={(e) => setPairB(e.target.value)}>
              <option value="">Select…</option>
              {catalog.filter((a) => !a.special && a.id !== pairA).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </Field>
          <Btn
            tone="ghost"
            onClick={() => {
              if (!pairA || !pairB || pairA === pairB) return;
              setPairs([...pairs, { primary_id: pairA, secondary_id: pairB }]);
              setPairA("");
              setPairB("");
            }}
          >
            + ADD PAIR
          </Btn>
        </div>
        {pairs.map((p, i) => (
          <div key={i} className="flex items-center gap-2 mb-1 text-sm rounded px-2 py-1" style={{ background: C.tealSoft }}>
            <span className="font-mono" style={{ color: C.teal }}>{catalog.find((a) => a.id === p.primary_id)?.name}</span>
            <span>+</span>
            <span className="font-mono" style={{ color: C.teal }}>{catalog.find((a) => a.id === p.secondary_id)?.name}</span>
            <button className="ml-auto text-xs font-mono" style={{ color: C.red }} onClick={() => setPairs(pairs.filter((_, j) => j !== i))}>
              REMOVE
            </button>
          </div>
        ))}
      </Panel>

      <Panel
        title={`ON-DUTY STAFF — ${sel} SELECTED OF ${roster.filter((w) => w.active !== false).length}`}
        right={
          <div className="flex gap-2 items-center flex-wrap">
            <div style={{ width: 200 }}>
              <SearchBox value={staffQ} onChange={setStaffQ} placeholder="Search employee…" />
            </div>
            <Btn tone={showSelected ? "ghost" : "slate"} onClick={() => setShowSelected(!showSelected)}>
              {showSelected ? "SHOWING SELECTED" : "SHOW ALL"}
            </Btn>
            <Btn tone="slate" onClick={() => setPicked({})}>
              CLEAR
            </Btn>
          </div>
        }
      >
        {predeterminedIncomplete && (
          <div className="text-xs font-mono mb-2 rounded px-2 py-1.5" style={{ background: C.redSoft, color: C.red }}>
            A PREDETERMINED staff member is missing an assignment or justification comment.
          </div>
        )}
        {(["nurse", "tech", "paramedic"] as const).map((roleKey) => {
          const rows = visible.filter((w) => w.role === roleKey);
          if (!rows.length) return null;
          return (
            <div key={roleKey} className="mb-3">
              <div className="text-xs font-mono mb-1.5 pb-1 border-b" style={{ color: C.teal, letterSpacing: "0.1em", borderColor: C.line }}>
                {roleKey.toUpperCase()} ({rows.length})
              </div>
              <div className="grid md:grid-cols-2 gap-1.5">
                {rows.map((w) => {
                  const p = picked[w.id] || {};
                  return (
                    <div key={w.id} className="rounded p-2" style={{ background: p.on ? C.tealSoft : "#F5F7F6", border: `1px solid ${p.on ? C.tealMid : C.line}` }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="checkbox"
                          checked={!!p.on}
                          onChange={(e) => setPicked({ ...picked, [w.id]: { ...p, on: e.target.checked, start: p.start || (side === "day" ? "07:00" : "19:00") } })}
                        />
                        <span className="text-sm font-medium" style={{ minWidth: 130 }}>{w.name}</span>
                        <span className="text-xs font-mono" style={{ color: C.sub }}>{w.competency.slice(0, 5).toUpperCase()}</span>
                        {w.agency && <Chip bg={C.amberSoft} fg={C.amber}>AGENCY</Chip>}
                        {p.on && (
                          <>
                            <select className="text-xs font-mono rounded px-1 py-0.5" style={iSty} value={p.start} onChange={(e) => setPicked({ ...picked, [w.id]: { ...p, start: e.target.value } })}>
                              {START_TIMES.map((t) => (
                                <option key={t}>{t}</option>
                              ))}
                            </select>
                            <Toggle on={!!p.leavingEarly} tone="amber" onLabel="LEAVES EARLY" offLabel="FULL" onClick={() => setPicked({ ...picked, [w.id]: { ...p, leavingEarly: !p.leavingEarly } })} />
                            <Toggle on={!!p.pickedUp} tone="teal" onLabel="PU ✓" offLabel="PICKED UP" onClick={() => setPicked({ ...picked, [w.id]: { ...p, pickedUp: !p.pickedUp } })} />
                            <Toggle
                              on={!!p.predetermined}
                              tone="amber"
                              onLabel="PREDETERMINED ✓"
                              offLabel="PREDETERMINED"
                              onClick={() => setPicked({ ...picked, [w.id]: { ...p, predetermined: p.predetermined ? null : { assignmentId: "", comment: "" } } })}
                            />
                          </>
                        )}
                      </div>
                      {p.on && p.predetermined && (
                        <div className="mt-2 pt-2 border-t flex flex-col gap-1.5" style={{ borderColor: C.line }}>
                          <select
                            className="text-xs font-mono rounded px-2 py-1"
                            style={iSty}
                            value={p.predetermined.assignmentId}
                            onChange={(e) => setPicked({ ...picked, [w.id]: { ...p, predetermined: { ...p.predetermined!, assignmentId: e.target.value } } })}
                          >
                            <option value="">Choose predetermined assignment…</option>
                            {catalog.filter((a) => !closedSet.has(a.id) && eligible(w, a)).map((a) => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                          <input
                            className="text-xs rounded px-2 py-1"
                            style={iSty}
                            placeholder="Justification, e.g. training purposes"
                            value={p.predetermined.comment}
                            onChange={(e) => setPicked({ ...picked, [w.id]: { ...p, predetermined: { ...p.predetermined!, comment: e.target.value } } })}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Panel>

      {pending && (
        <>
          <Panel title={`DEFICIENCY REVIEW — ${pending.deficiencies.length} FINDINGS`}>
            {!pending.deficiencies.length ? (
              <div className="text-sm font-mono" style={{ color: C.green }}>All active assignments covered.</div>
            ) : (
              pending.deficiencies.map((d, i) => (
                <div key={i} className="mb-2 text-sm">
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded mr-2" style={{ background: d.severity === "red" ? C.redSoft : C.amberSoft, color: d.severity === "red" ? C.red : C.amber }}>
                    {d.severity === "red" ? "CRITICAL" : "REVIEW"}
                  </span>
                  {d.text}
                  <DeficiencyAssign d={d} roster={roster} catalog={catalog} placed={new Set(pending.entries.map((e) => e.staff_id))} onAssign={(staffId, assignmentId, comment) => {
                    const w = roster.find((x) => x.id === staffId)!;
                    const a = catalog.find((x) => x.id === assignmentId)!;
                    const entry: BoardEntry = {
                      staff_id: w.id,
                      staff_name: w.name,
                      role: w.role,
                      competency: w.competency,
                      tech_specialty: w.tech_specialty,
                      agency: !!w.agency,
                      start: pending.side === "day" ? "07:00" : "19:00",
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
                    setPending({ ...pending, entries: [...pending.entries, entry], deficiencies: pending.deficiencies.filter((x) => x !== d) });
                  }} />
                </div>
              ))
            )}
          </Panel>
          <Panel title={`GENERATED BOARD — ${pending.date} ${pending.side.toUpperCase()} (UNSAVED)`}>
            {pending.entries.map((e) => (
              <EntryRow key={e.staff_id} e={e} catalog={catalog} entries={pending.entries} onReassign={reassign} onPatch={(patch) => setEntry(e.staff_id, patch)} />
            ))}
            <ZoneLegend />
          </Panel>
        </>
      )}
    </>
  );
}

function DeficiencyAssign({
  d,
  roster,
  catalog,
  placed,
  onAssign,
}: {
  d: Deficiency;
  roster: Staff[];
  catalog: Assignment[];
  placed: Set<string>;
  onAssign: (staffId: string, assignmentId: string, comment: string) => void;
}) {
  const [staffId, setStaffId] = useState("");
  const [comment, setComment] = useState("");
  const assignment = catalog.find((a) => a.id === d.assignment_id);
  if (d.kind !== "unfilled" || !assignment) return null;
  const candidates = roster.filter((w) => w.active !== false && !placed.has(w.id) && eligible(w, assignment));
  return (
    <div className="flex gap-1.5 items-center flex-wrap mt-1 ml-1">
      <select className="text-xs font-mono rounded px-1 py-1" style={{ ...iSty, minWidth: 150 }} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
        <option value="">assign staff…</option>
        {candidates.map((w) => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>
      <input className="text-xs rounded px-2 py-1" style={{ ...iSty, minWidth: 160 }} placeholder="Comment (required)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <Btn tone="ghost" disabled={!staffId || !comment.trim()} onClick={() => { onAssign(staffId, assignment.id, comment); setStaffId(""); setComment(""); }}>
        ASSIGN
      </Btn>
    </div>
  );
}

function EntryRow({
  e,
  catalog,
  entries,
  onReassign,
  onPatch,
}: {
  e: BoardEntry;
  catalog: Assignment[];
  entries: BoardEntry[];
  onReassign?: (staffId: string, id: string) => void;
  onPatch: (patch: Partial<BoardEntry>) => void;
}) {
  const zc = zoneColor(e.category);
  const [showB, setShowB] = useState(false);
  const [bText, setBText] = useState(e.boarderComment || "");
  const [showC, setShowC] = useState(false);
  const [cWith, setCWith] = useState("");
  const [cText, setCText] = useState("");
  const isGold = (e.category || "").startsWith("Gold");
  return (
    <div className="rounded px-2 py-1.5 mb-1" style={{ background: e.boarder ? C.amberSoft : "#F5F7F6", borderLeft: `3px solid ${zc}` }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 9999, background: zc }} />
          <span className="font-mono text-xs" style={{ color: C.sub }}>{e.start}</span>
          <span className="text-sm font-medium">{e.staff_name}</span>
          {e.pickedUp && <Chip bg={C.tealSoft} fg={C.tealMid}>(PU)</Chip>}
          <span className="text-sm font-mono" style={{ color: C.teal }}>
            → {e.assignment_name}{e.partial ? " (P)" : ""}
          </span>
          {e.boarder && <Chip bg={C.amberSoft} fg={C.amber}>BOARDER</Chip>}
          {e.held && <Chip bg={C.redSoft} fg={C.red}>HELD</Chip>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge type={e.override_type} />
          {onReassign && (
            <select className="text-xs font-mono rounded px-1 py-1" style={iSty} value={e.assignment_id} onChange={(ev) => onReassign(e.staff_id, ev.target.value)}>
              {catalog.filter((a) => eligible(e, a)).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
              <option value={WILDCARD}>WILDCARD</option>
            </select>
          )}
          {isGold && (
            <Toggle on={!!e.boarder} tone="amber" onLabel="BOARDER ✓" offLabel="BOARDER" onClick={() => (e.boarder ? onPatch({ boarder: false, boarderComment: "" }) : setShowB(!showB))} />
          )}
          <Toggle on={!!e.runtimeCombinedWith} tone="teal" onLabel="COMBINED ✓" offLabel="COMBINE" onClick={() => (e.runtimeCombinedWith ? onPatch({ runtimeCombinedWith: null, runtimeCombineComment: "", runtimeCombinedName: null }) : setShowC(!showC))} />
        </div>
      </div>
      {showB && !e.boarder && (
        <div className="flex gap-1.5 mt-1">
          <input className="text-xs rounded px-2 py-1" style={iSty} placeholder="Boarder comment (required)" value={bText} onChange={(ev) => setBText(ev.target.value)} />
          <Btn tone="ghost" disabled={!bText.trim()} onClick={() => { onPatch({ boarder: true, boarderComment: bText }); setShowB(false); }}>SET</Btn>
        </div>
      )}
      {showC && !e.runtimeCombinedWith && (
        <div className="flex gap-1.5 mt-1 flex-wrap">
          <select className="text-xs font-mono rounded px-1 py-1" style={iSty} value={cWith} onChange={(ev) => setCWith(ev.target.value)}>
            <option value="">combine with…</option>
            {entries.filter((x) => x.staff_id !== e.staff_id).map((o) => (
              <option key={o.staff_id} value={o.staff_id}>{o.staff_name} — {o.assignment_name}</option>
            ))}
          </select>
          <input className="text-xs rounded px-2 py-1" style={iSty} placeholder="Combine comment" value={cText} onChange={(ev) => setCText(ev.target.value)} />
          <Btn
            tone="ghost"
            disabled={!cWith || !cText.trim()}
            onClick={() => {
              const other = entries.find((x) => x.staff_id === cWith)!;
              onPatch({
                runtimeCombinedWith: cWith,
                runtimeCombineComment: cText,
                runtimeCombinedName: other.assignment_name,
                _runtimeLoadA: catalog.find((a) => a.id === e.assignment_id)?.load_level,
                _runtimeLoadB: catalog.find((a) => a.id === other.assignment_id)?.load_level,
              });
              setShowC(false);
            }}
          >
            SET
          </Btn>
        </div>
      )}
    </div>
  );
}

function CurrentShiftPage(props: {
  shifts: Shift[];
  catalog: Assignment[];
  roster: Staff[];
  me: UserAccount;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  replaceShift: (s: Shift) => void;
  onNotify: (t: string, s?: string) => void;
  onCloseout: (id: string) => void;
}) {
  const { shifts, openId, setOpenId } = props;
  const open = shifts.find((s) => s.id === openId);
  return (
    <>
      <Panel title={`CURRENT SHIFTS — ${shifts.length} OPEN`}>
        {!shifts.length && <div className="text-sm" style={{ color: C.sub }}>No open shifts. Generate and save a board to start one.</div>}
        {shifts.map((s) => (
          <button
            key={s.id}
            onClick={() => setOpenId(s.id === openId ? null : s.id)}
            className="w-full text-left rounded px-3 py-2 mb-1"
            style={{ background: s.id === openId ? C.tealSoft : "#F5F7F6", border: `1px solid ${s.id === openId ? C.tealMid : C.line}` }}
          >
            <span className="font-mono text-sm font-semibold">{s.date} · {s.side.toUpperCase()}</span>
            <span className="text-xs font-mono ml-2" style={{ color: C.sub }}>{s.entries.length} staff · {s.generated_by}</span>
          </button>
        ))}
      </Panel>
      {open && <ShiftDetail shift={open} {...props} />}
    </>
  );
}

function ArchivePage(props: {
  shifts: Shift[];
  catalog: Assignment[];
  roster: Staff[];
  me: UserAccount;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  replaceShift: (s: Shift) => void;
  onNotify: (t: string, s?: string) => void;
  onAdded: (s: Shift) => void;
  onCloseout: (id: string) => void;
}) {
  const pending = props.shifts.filter((s) => s.futurePending && !s.eod?.closed);
  const closed = props.shifts.filter((s) => s.eod?.closed);
  const open = props.shifts.find((s) => s.id === props.openId);
  const [show, setShow] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [side, setSide] = useState<"day" | "night">("day");
  const [rows, setRows] = useState<Array<{ staff_id: string; assignment_id: string }>>([]);
  const [just, setJust] = useState("");
  const [q, setQ] = useState("");
  return (
    <>
      <Panel
        title="SHIFT ARCHIVE"
        right={
          <div className="flex gap-2">
            <Btn tone="ghost" onClick={() => setShow(!show)}>+ ADD HISTORICAL BOARD</Btn>
            <Btn tone="slate" onClick={() => downloadUrl("/api/export/history")}>EXPORT FULL HISTORY (EXCEL)</Btn>
          </div>
        }
      >
        <div className="text-xs font-mono" style={{ color: C.sub }}>
          {closed.length} closed · {pending.length} pending · {props.shifts.length} total
        </div>
      </Panel>
      {show && (
        <Panel title="ADD HISTORICAL BOARD (MANUAL)">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Field label="Date"><input type="date" className={iCls} style={iSty} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Side">
              <select className={iCls} style={iSty} value={side} onChange={(e) => setSide(e.target.value as "day" | "night")}>
                <option value="day">Day board</option>
                <option value="night">Night board</option>
              </select>
            </Field>
          </div>
          <SearchBox value={q} onChange={setQ} placeholder="Search staff to add…" />
          <div className="flex flex-wrap gap-1 my-2">
            {props.roster.filter((w) => match(w.name, q) && !rows.some((r) => r.staff_id === w.id)).slice(0, 20).map((w) => (
              <button key={w.id} className="text-xs font-mono px-2 py-1 rounded" style={{ background: C.slate }} onClick={() => setRows([...rows, { staff_id: w.id, assignment_id: "" }])}>
                + {w.name}
              </button>
            ))}
          </div>
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2 mb-1">
              <span className="text-sm" style={{ minWidth: 130 }}>{props.roster.find((w) => w.id === r.staff_id)?.name}</span>
              <select className="text-xs font-mono rounded px-1 py-1" style={iSty} value={r.assignment_id} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, assignment_id: e.target.value } : x)))}>
                <option value="">choose assignment…</option>
                {props.catalog.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          ))}
          <Field label="Justification (required)">
            <input className={iCls} style={iSty} value={just} onChange={(e) => setJust(e.target.value)} />
          </Field>
          <div className="mt-3">
            <Btn
              disabled={!rows.length || rows.some((r) => !r.assignment_id) || !just.trim()}
              onClick={async () => {
                const { shift } = await api.saveHistorical({ date, side, rows, justification: just });
                props.onAdded(shift);
                setShow(false);
                setRows([]);
                setJust("");
                props.onNotify(`Manual historical board saved for ${date} (${side}).`);
              }}
            >
              SAVE HISTORICAL BOARD
            </Btn>
          </div>
        </Panel>
      )}
      {pending.length > 0 && (
        <Panel title={`PENDING — ${pending.length} FUTURE BOARD(S)`}>
          {pending.map((s) => (
            <button key={s.id} onClick={() => props.setOpenId(s.id === props.openId ? null : s.id)} className="w-full text-left rounded px-3 py-2 mb-1" style={{ background: C.amberSoft }}>
              {s.date} · {s.side.toUpperCase()} · {s.entries.length} staff
            </button>
          ))}
        </Panel>
      )}
      {open && open.futurePending && !open.eod?.closed && <ShiftDetail shift={open} {...props} />}
      <Panel title={`CLOSED — ${closed.length}`}>
        {closed.map((s) => (
          <button key={s.id} onClick={() => props.setOpenId(s.id === props.openId ? null : s.id)} className="w-full text-left rounded px-3 py-2 mb-1" style={{ background: "#F5F7F6", border: `1px solid ${C.line}` }}>
            {s.date} · {s.side.toUpperCase()} · {s.entries.length} staff
            {s.manual_entry && <span className="ml-2 text-xs font-mono">MANUAL/HISTORICAL</span>}
          </button>
        ))}
      </Panel>
      {open && open.eod?.closed && (
        <Panel title={`CLOSED SHIFT DETAIL — ${open.date} ${open.side.toUpperCase()}`} right={<Btn tone="slate" onClick={() => downloadUrl(`/api/export/shift/${open.id}`)}>EXPORT EXCEL</Btn>}>
          {open.entries.map((e) => (
            <div key={e.staff_id} className="rounded p-2 mb-1" style={{ background: "#F5F7F6", borderLeft: `3px solid ${zoneColor(e.category)}` }}>
              {e.staff_name} · {e.assignment_name}{e.partial ? " (P)" : ""} {e.boarder ? " · BOARDER" : ""}
            </div>
          ))}
        </Panel>
      )}
    </>
  );
}

function ShiftDetail({
  shift,
  catalog,
  roster,
  replaceShift,
  onNotify,
  onCloseout,
}: {
  shift: Shift;
  catalog: Assignment[];
  roster: Staff[];
  me: UserAccount;
  replaceShift: (s: Shift) => void;
  onNotify: (t: string, s?: string) => void;
  onCloseout: (id: string) => void;
}) {
  const [released, setReleased] = useState<Record<string, boolean>>({});
  const [target, setTarget] = useState<Record<string, string>>({});
  const [comp, setComp] = useState<Deficiency[] | null>(null);
  return (
    <>
      <Panel
        title={`${shift.futurePending ? "PENDING BOARD" : "CURRENT SHIFT"} — ${shift.date} ${shift.side.toUpperCase()}`}
        right={
          <div className="flex gap-2">
            <Btn tone="slate" onClick={() => downloadUrl(`/api/export/shift/${shift.id}`)}>EXPORT EXCEL</Btn>
            <Btn tone="amber" onClick={async () => { const { shift: s } = await api.openEod(shift.id); replaceShift(s); onCloseout(s.id); }}>CLOSEOUT</Btn>
          </div>
        }
      >
        <div className="text-xs font-mono" style={{ color: C.sub }}>{shift.entries.length} staff on this board.</div>
      </Panel>
      <Panel
        title={`CURRENT SHIFT ROSTER — ${shift.entries.length} STAFF`}
        right={<Btn tone="ghost" onClick={async () => { const r = await api.regenerate(shift.id); replaceShift(r.shift); onNotify(`${r.changed} assignments changed, ${r.held} held staff untouched`); }}>REGENERATE BOARD</Btn>}
      >
        {shift.entries.map((e) => {
          const isRel = !!released[e.staff_id];
          return (
            <div key={e.staff_id} className="rounded p-2 mb-1.5 flex items-center gap-2 flex-wrap" style={{ background: isRel ? C.amberSoft : "#F5F7F6", borderLeft: `3px solid ${zoneColor(e.category)}` }}>
              <span className="text-sm font-medium" style={{ minWidth: 130 }}>{e.staff_name}</span>
              {e.pickedUp && <Chip bg={C.tealSoft} fg={C.tealMid}>(PU)</Chip>}
              <span className="text-xs font-mono">{e.start}</span>
              <span className="text-sm font-mono" style={{ color: isRel ? C.amber : C.teal }}>{isRel ? "⌀ RELEASED" : `${e.assignment_name}${e.partial ? " (P)" : ""}`}</span>
              {e.held && <Chip bg={C.redSoft} fg={C.red}>HELD</Chip>}
              {e.boarder && <Chip bg={C.amberSoft} fg={C.amber}>BOARDER</Chip>}
              <div className="ml-auto flex gap-1.5 flex-wrap">
                <Toggle on={!!e.held} tone="red" onLabel="HELD ✓" offLabel="HOLD" onClick={async () => replaceShift((await api.toggleHold(shift.id, e.staff_id)).shift)} />
                {(e.category || "").startsWith("Gold") && (
                  <Toggle
                    on={!!e.boarder}
                    tone="amber"
                    onLabel="BOARDER ✓"
                    offLabel="BOARDER"
                    onClick={async () => {
                      if (e.boarder) replaceShift((await api.patchEntry(shift.id, e.staff_id, { boarder: false, boarderComment: "" })).shift);
                      else {
                        const comment = prompt("Boarder comment (required)") || "";
                        if (comment.trim()) replaceShift((await api.patchEntry(shift.id, e.staff_id, { boarder: true, boarderComment: comment })).shift);
                      }
                    }}
                  />
                )}
                <Toggle
                  on={!!e.runtimeCombinedWith}
                  tone="teal"
                  onLabel="COMBINED ✓"
                  offLabel="COMBINE"
                  onClick={async () => {
                    if (e.runtimeCombinedWith) {
                      replaceShift((await api.patchEntry(shift.id, e.staff_id, { runtimeCombinedWith: null, runtimeCombineComment: "", runtimeCombinedName: null })).shift);
                      return;
                    }
                    const partner = prompt("Partner staff id or name") || "";
                    const comment = prompt("Combine comment (required)") || "";
                    const other = shift.entries.find((x) => x.staff_id === partner || x.staff_name.toLowerCase().includes(partner.toLowerCase()));
                    if (!other || !comment.trim()) return;
                    replaceShift(
                      (
                        await api.patchEntry(shift.id, e.staff_id, {
                          runtimeCombinedWith: other.staff_id,
                          runtimeCombineComment: comment,
                          runtimeCombinedName: other.assignment_name,
                        })
                      ).shift,
                    );
                  }}
                />
                <button className="text-xs font-mono px-2 py-1 rounded" style={{ background: isRel ? C.amber : C.slate, color: isRel ? "#fff" : C.sub }} onClick={() => setReleased({ ...released, [e.staff_id]: !isRel })}>
                  {isRel ? "CANCEL RELEASE" : "RELEASE"}
                </button>
                {e.partial && <Chip bg={C.tealSoft} fg={C.teal}>RELEASE (P)</Chip>}
                {isRel && (
                  <>
                    <select className="text-xs font-mono rounded px-1 py-1" style={iSty} value={target[e.staff_id] || ""} onChange={(ev) => setTarget({ ...target, [e.staff_id]: ev.target.value })}>
                      <option value="">reassign to…</option>
                      {catalog.filter((a) => eligible(e, a)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      <option value={WILDCARD}>WILDCARD</option>
                    </select>
                    <Btn tone="ghost" disabled={!target[e.staff_id]} onClick={async () => { replaceShift((await api.redistribute(shift.id, e.staff_id, target[e.staff_id])).shift); setReleased({ ...released, [e.staff_id]: false }); }}>CONFIRM</Btn>
                  </>
                )}
              </div>
            </div>
          );
        })}
        <ZoneLegend />
      </Panel>
      <Panel title={`CLOSE ASSIGNMENTS (MID-SHIFT) — ${(shift.mid_shift_closed_ids || []).length} CLOSED`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
          {catalog.filter((a) => !a.special && a.closeable).map((a) => {
            const on = (shift.mid_shift_closed_ids || []).includes(a.id);
            return (
              <button key={a.id} onClick={async () => replaceShift((await api.closeRoom(shift.id, a.id)).shift)} className="text-left text-xs font-mono px-2 py-1.5 rounded border" style={{ background: on ? C.amberSoft : C.slate, color: on ? C.amber : C.sub, borderColor: on ? C.amber : C.line }}>
                {on ? "✕ " : ""}{a.name}
              </button>
            );
          })}
        </div>
      </Panel>
      <Panel title="COMPLIANCE RECHECK" right={<Btn onClick={async () => { const r = await api.compliance(shift.id); replaceShift(r.shift); setComp(r.deficiencies); }}>RUN COMPLIANCE CHECK</Btn>}>
        {comp && comp.length === 0 && <div className="text-sm font-mono rounded px-3 py-2" style={{ background: C.greenSoft, color: C.green }}>✓ GOOD TO GO — no deficiencies found.</div>}
        {comp && comp.map((d, i) => (
          <div key={i} className="text-sm mb-1">
            <span className="text-xs font-mono px-1.5 py-0.5 rounded mr-2" style={{ background: d.severity === "red" ? C.redSoft : C.amberSoft, color: d.severity === "red" ? C.red : C.amber }}>{d.severity === "red" ? "CRITICAL" : "REVIEW"}</span>
            {d.text}
            <DeficiencyAssign d={d} roster={roster} catalog={catalog} placed={new Set(shift.entries.map((e) => e.staff_id))} onAssign={async (staffId, assignmentId, comment) => { replaceShift((await api.assignDeficiency(shift.id, staffId, assignmentId, comment)).shift); }} />
          </div>
        ))}
        {(shift.complianceChecks || []).map((c, i) => (
          <div key={i} className="text-xs font-mono" style={{ color: C.sub }}>{new Date(c.timestamp).toLocaleString()} · {c.by} · {c.result === "good_to_go" ? "GOOD TO GO" : `${c.issueCount} issues`}</div>
        ))}
      </Panel>
    </>
  );
}

function EodPage({
  shift,
  catalog,
  replaceShift,
  onBack,
}: {
  shift?: Shift;
  catalog: Assignment[];
  replaceShift: (s: Shift) => void;
  onBack: () => void;
}) {
  const [note, setNote] = useState(shift?.eod?.notes || "");
  if (!shift) return <Panel title="EOD CLOSEOUT"><div>Shift not found.</div></Panel>;
  const locked = !!shift.eod?.closed;
  return (
    <Panel title={`EOD CLOSEOUT — ${shift.date} ${shift.side.toUpperCase()}`} right={<Btn tone="slate" onClick={onBack}>BACK TO CURRENT SHIFT</Btn>}>
      <Field label="Closeout timestamp">
        <input type="datetime-local" disabled={locked} className={iCls} style={iSty} value={(shift.eod?.closeout_timestamp || "").slice(0, 16)} onChange={async (e) => replaceShift((await api.patchEod(shift.id, { closeout_timestamp: e.target.value })).shift)} />
      </Field>
      <div className="space-y-2 mt-3">
        {shift.entries.map((e) => {
          const o = shift.eod?.outcomes?.[e.staff_id] || { status: "as_assigned", reassigned_to: "", note: "", heldOver: false, excludeFromMemory: false };
          return (
            <div key={e.staff_id} className="rounded p-2 flex items-center gap-2 flex-wrap" style={{ background: o.heldOver ? C.amberSoft : "#F5F7F6" }}>
              <span className="text-sm font-medium" style={{ minWidth: 130 }}>{e.staff_name}</span>
              <span className="text-xs font-mono">{e.assignment_name}</span>
              <select disabled={locked} className="text-xs font-mono rounded px-1 py-1" style={iSty} value={o.status} onChange={async (ev) => replaceShift((await api.patchEod(shift.id, { staffId: e.staff_id, patch: { status: ev.target.value } })).shift)}>
                <option value="as_assigned">as assigned</option>
                <option value="reassigned">reassigned</option>
                <option value="sent_home">sent home</option>
                <option value="other">other deviation</option>
              </select>
              {o.status === "reassigned" && (
                <select disabled={locked} className="text-xs font-mono rounded px-1 py-1" style={iSty} value={o.reassigned_to} onChange={async (ev) => replaceShift((await api.patchEod(shift.id, { staffId: e.staff_id, patch: { reassigned_to: ev.target.value } })).shift)}>
                  <option value="">to…</option>
                  {catalog.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
              {o.status === "sent_home" && (
                <Toggle on={!!o.excludeFromMemory} tone="red" onLabel="EXCLUDED FROM MEMORY" offLabel="Exclude from memory" disabled={locked} onClick={async () => replaceShift((await api.patchEod(shift.id, { staffId: e.staff_id, patch: { excludeFromMemory: !o.excludeFromMemory } })).shift)} />
              )}
              <Toggle on={!!o.heldOver} tone="amber" onLabel="HELD OVER" offLabel="HOLD" disabled={locked} onClick={async () => replaceShift((await api.patchEod(shift.id, { staffId: e.staff_id, patch: { heldOver: !o.heldOver } })).shift)} />
            </div>
          );
        })}
      </div>
      {!locked && (
        <div className="mt-3">
          <Field label="Handoff note for next charge nurse">
            <input className={iCls} style={iSty} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="mt-4">
            <Btn onClick={async () => { replaceShift((await api.patchEod(shift.id, { notes: note, close: true })).shift); }}>CLOSE SHIFT → ARCHIVE</Btn>
          </div>
        </div>
      )}
      {locked && <div className="mt-4 text-xs font-mono" style={{ color: C.green }}>Shift closed by {shift.eod?.closed_by}.</div>}
    </Panel>
  );
}

function RosterPage({
  roster,
  setRoster,
  isAdmin,
  onNotify,
}: {
  roster: Staff[];
  setRoster: (r: Staff[]) => void;
  isAdmin: boolean;
  onNotify: (t: string, s?: string) => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const ids = Object.entries(sel).filter(([, v]) => v).map(([k]) => k);
  const upd = async (id: string, patch: Partial<Staff>) => {
    const next = roster.map((w) => (w.id === id ? { ...w, ...patch } : w));
    setRoster(next);
    if (isAdmin) await api.putRoster(next);
  };
  return (
    <Panel
      title={`STAFF ROSTER — ${roster.length} TOTAL · ${roster.filter((w) => w.agency).length} AGENCY`}
      right={
        <div className="flex gap-2 flex-wrap">
          <div style={{ width: 200 }}><SearchBox value={q} onChange={setQ} placeholder="Search employee…" /></div>
          <Btn tone="slate" onClick={() => downloadUrl("/api/export/roster")}>EXPORT EXCEL</Btn>
          {isAdmin && (
            <>
              <input id="imp" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = await api.importRoster(f);
                setRoster(r.roster);
                onNotify(`Roster import: ${r.added} added, ${r.updated} updated.`);
                e.target.value = "";
              }} />
              <Btn tone="ghost" onClick={() => document.getElementById("imp")?.click()}>IMPORT EXCEL</Btn>
              <Btn tone="ghost" onClick={async () => setRoster((await api.addStaff({ name: "New staff", role: "nurse", competency: "trained" })).roster)}>+ ADD</Btn>
            </>
          )}
        </div>
      }
    >
      {isAdmin && ids.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-3 rounded px-2 py-2" style={{ background: C.tealSoft }}>
          <Btn tone="ghost" onClick={async () => { setRoster((await api.bulkRoster(ids, { active: true })).roster); setSel({}); }}>Set Active</Btn>
          <Btn tone="ghost" onClick={async () => { setRoster((await api.bulkRoster(ids, { active: false })).roster); setSel({}); }}>Set Inactive</Btn>
          <Btn tone="ghost" onClick={async () => { setRoster((await api.bulkRoster(ids, { agency: true })).roster); setSel({}); }}>Mark Agency</Btn>
          <Btn tone="ghost" onClick={async () => { setRoster((await api.bulkRoster(ids, { agency: false })).roster); setSel({}); }}>Unmark Agency</Btn>
          <Btn tone="red" onClick={async () => { if (confirm(`Delete ${ids.length} selected?`)) { setRoster((await api.bulkRoster(ids, undefined, "delete")).roster); setSel({}); } }}>Delete Selected</Btn>
        </div>
      )}
      <div className="space-y-1.5" style={{ maxHeight: 600, overflowY: "auto" }}>
        {roster.filter((w) => match(w.name, q)).map((w) => (
          <div key={w.id} className="grid grid-cols-2 md:grid-cols-8 gap-2 items-end rounded p-2" style={{ background: "#F5F7F6", opacity: w.active === false ? 0.6 : 1 }}>
            {isAdmin && <input type="checkbox" checked={!!sel[w.id]} onChange={() => setSel({ ...sel, [w.id]: !sel[w.id] })} />}
            <Field label="Name"><input disabled={!isAdmin} className={iCls} style={iSty} value={w.name} onChange={(e) => upd(w.id, { name: e.target.value })} /></Field>
            <Field label="Role">
              <select disabled={!isAdmin} className={iCls} style={iSty} value={w.role} onChange={(e) => upd(w.id, { role: e.target.value as Staff["role"], tech_specialty: e.target.value === "tech" ? w.tech_specialty || "general" : null })}>
                <option value="nurse">nurse</option>
                <option value="tech">technician</option>
                <option value="paramedic">paramedic</option>
              </select>
            </Field>
            {w.role === "tech" ? (
              <Field label="Tech spec">
                <select disabled={!isAdmin} className={iCls} style={iSty} value={w.tech_specialty || "general"} onChange={(e) => upd(w.id, { tech_specialty: e.target.value as Staff["tech_specialty"] })}>
                  {TECH_SPECIALTIES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            ) : <div />}
            <Field label="Competency">
              <select disabled={!isAdmin} className={iCls} style={iSty} value={w.competency} onChange={(e) => upd(w.id, { competency: e.target.value as Staff["competency"] })}>
                <option value="untrained">untrained</option>
                <option value="trained">trained</option>
                <option value="proficient">proficient</option>
              </select>
            </Field>
            <Field label="Nights">
              <button disabled={!isAdmin} className="text-xs font-mono px-2 py-1.5 rounded w-full" style={{ background: w.avoidNight ? C.amberSoft : C.slate }} onClick={() => upd(w.id, { avoidNight: !w.avoidNight })}>{w.avoidNight ? "AVOIDS" : "NO PREF"}</button>
            </Field>
            <Field label="Agency">
              <button disabled={!isAdmin} className="text-xs font-mono px-2 py-1.5 rounded w-full" style={{ background: w.agency ? C.amberSoft : C.slate }} onClick={() => upd(w.id, { agency: !w.agency })}>{w.agency ? "AGENCY" : "STAFF"}</button>
            </Field>
            <Field label="Status">
              <button disabled={!isAdmin} className="text-xs font-mono px-2 py-1.5 rounded w-full" style={{ background: w.active === false ? C.redSoft : C.greenSoft }} onClick={() => upd(w.id, { active: w.active === false })}>{w.active === false ? "INACTIVE" : "ACTIVE"}</button>
            </Field>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CatalogPage({ catalog, setCatalog }: { catalog: Assignment[]; setCatalog: (c: Assignment[]) => void }) {
  const [q, setQ] = useState("");
  return (
    <Panel
      title={`ASSIGNMENT CATALOG — ${catalog.filter((a) => !a.special).length} CORE + ${catalog.filter((a) => a.special).length} SPECIAL`}
      right={
        <div className="flex gap-2">
          <div style={{ width: 180 }}><SearchBox value={q} onChange={setQ} /></div>
          <Btn tone="ghost" onClick={async () => setCatalog((await api.saveCatalog({ name: "New assignment" })).catalog)}>+ ADD</Btn>
        </div>
      }
    >
      {catalog.filter((a) => match(a.name, q) || match(a.category, q)).map((a) => (
        <div key={a.id} className="grid grid-cols-2 md:grid-cols-8 gap-2 items-end rounded p-2 mb-1" style={{ background: "#F5F7F6" }}>
          <Field label="Name"><input className={iCls} style={iSty} value={a.name} onChange={async (e) => setCatalog((await api.saveCatalog({ ...a, name: e.target.value })).catalog)} /></Field>
          <Field label="Category"><input className={iCls} style={iSty} value={a.category} onChange={async (e) => setCatalog((await api.saveCatalog({ ...a, category: e.target.value })).catalog)} /></Field>
          <Field label="Load">
            <select className={iCls} style={iSty} value={a.load_level} onChange={async (e) => setCatalog((await api.saveCatalog({ ...a, load_level: e.target.value as Assignment["load_level"] })).catalog)}>
              <option>light</option><option>medium</option><option>heavy</option>
            </select>
          </Field>
          <Field label="Critical">
            <button className="text-xs font-mono px-2 py-1.5 rounded w-full" style={{ background: a.critical ? C.redSoft : C.slate }} onClick={async () => setCatalog((await api.saveCatalog({ ...a, critical: !a.critical })).catalog)}>{a.critical ? "CRITICAL" : "STANDARD"}</button>
          </Field>
          <Btn tone="red" onClick={async () => setCatalog((await api.deleteCatalog(a.id)).catalog)}>REMOVE</Btn>
        </div>
      ))}
    </Panel>
  );
}

function ConfigPage({ config, setConfig, onReset }: { config: EngineConfig; setConfig: (c: EngineConfig) => void; onReset: () => void }) {
  return (
    <Panel title="ENGINE CONFIG">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          ["Max frequency per window", "max_assignment_frequency"],
          ["Day headcount min", "min_staff_day"],
          ["Night headcount min", "min_staff_night"],
        ] as const).map(([l, k]) => (
          <Field key={k} label={l}>
            <input type="number" min={1} className={iCls} style={iSty} value={config[k]} onChange={async (e) => setConfig((await api.saveConfig({ [k]: +e.target.value })).config)} />
          </Field>
        ))}
      </div>
      <div className="mt-3 text-xs font-mono" style={{ color: C.sub }}>
        Rotation memory uses a calendar-month window (not a rolling 42-day lookback). Night shifts starting on the last day of a month stay attributed to that month.
      </div>
      <div className="mt-4">
        <Btn tone="red" onClick={onReset}>RESET ALL DATA</Btn>
      </div>
    </Panel>
  );
}

function UsersPage({ users, setUsers, me }: { users: UserAccount[]; setUsers: (u: UserAccount[]) => void; me: UserAccount }) {
  return (
    <Panel title="USER ACCOUNTS" right={<Btn tone="ghost" onClick={async () => setUsers((await api.saveUser({ username: `user${Date.now() % 1000}`, name: "New user", role: "charge-nurse", password: "rotation" })).users)}>+ ADD</Btn>}>
      {users.map((u) => (
        <div key={u.id} className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end rounded p-2 mb-1" style={{ background: "#F5F7F6" }}>
          <Field label="Name"><input className={iCls} style={iSty} value={u.name} onChange={async (e) => setUsers((await api.saveUser({ ...u, name: e.target.value })).users)} /></Field>
          <Field label="Username"><input className={iCls} style={iSty} value={u.username} onChange={async (e) => setUsers((await api.saveUser({ ...u, username: e.target.value })).users)} /></Field>
          <Field label="Role">
            <select className={iCls} style={iSty} value={u.role} onChange={async (e) => setUsers((await api.saveUser({ ...u, role: e.target.value as UserAccount["role"] })).users)}>
              <option value="charge-nurse">charge-nurse</option>
              <option value="admin">administrator</option>
            </select>
          </Field>
          <Btn tone="red" disabled={u.id === me.id} onClick={async () => setUsers((await api.deleteUser(u.id)).users)}>{u.id === me.id ? "YOU" : "REMOVE"}</Btn>
        </div>
      ))}
      <div className="text-xs font-mono mt-2" style={{ color: C.sub }}>New users default to password <span className="font-semibold">rotation</span> unless changed via API.</div>
    </Panel>
  );
}
