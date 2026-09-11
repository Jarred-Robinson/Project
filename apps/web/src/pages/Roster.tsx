import { useState } from "react";
import { TECH_SPECIALTIES, type Staff } from "@rotation/shared";
import { api, downloadUrl } from "../api";
import { Btn, C, Field, Panel, SearchBox, iCls, iSty, match } from "../components/ui";

export function RosterPage({
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
