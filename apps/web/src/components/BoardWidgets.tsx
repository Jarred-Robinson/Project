import { useState } from "react";
import { eligible } from "@rotation/engine";
import { WILDCARD, type Assignment, type BoardEntry, type Deficiency, type Shift, type Staff, type UserAccount } from "@rotation/shared";
import { api, downloadUrl } from "../api";
import { Badge, Btn, C, Chip, Panel, Toggle, ZoneLegend, iCls, iSty, zoneColor } from "./ui";

export function DeficiencyAssign({
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

export function EntryRow({
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

export function ShiftDetail({
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
