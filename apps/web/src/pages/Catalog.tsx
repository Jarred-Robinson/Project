import { useState } from "react";
import type { Assignment } from "@rotation/shared";
import { api } from "../api";
import { Btn, C, Field, Panel, SearchBox, iCls, iSty, match } from "../components/ui";

export function CatalogPage({ catalog, setCatalog }: { catalog: Assignment[]; setCatalog: (c: Assignment[]) => void }) {
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
