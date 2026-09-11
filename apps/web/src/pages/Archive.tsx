import { useState } from "react";
import type { Assignment, Shift, Staff, UserAccount } from "@rotation/shared";
import { api, downloadUrl } from "../api";
import { ShiftDetail } from "../components/BoardWidgets";
import { Btn, C, Field, Panel, SearchBox, iCls, iSty, match, zoneColor } from "../components/ui";

export function ArchivePage(props: {
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
