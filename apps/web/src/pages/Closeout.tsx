import { useState } from "react";
import type { Assignment, Shift } from "@rotation/shared";
import { api } from "../api";
import { Btn, C, Field, Panel, Toggle, iCls, iSty } from "../components/ui";

export function EodPage({
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
