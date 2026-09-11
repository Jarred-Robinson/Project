import { useState } from "react";
import { eligible } from "@rotation/engine";
import {
  START_TIMES,
  WILDCARD,
  type Assignment,
  type BoardEntry,
  type CombinedPair,
  type EngineConfig,
  type EngineResult,
  type Shift,
  type Staff,
} from "@rotation/shared";
import { api } from "../api";
import { DeficiencyAssign, EntryRow } from "../components/BoardWidgets";
import { Btn, Chip, C, Field, Panel, SearchBox, Toggle, ZoneLegend, iCls, iSty, match } from "../components/ui";

export function GenerateBoard({
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
