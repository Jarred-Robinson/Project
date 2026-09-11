import type { Shift, Staff } from "@rotation/shared";
import { C, Panel } from "../components/ui";

export function Dashboard({
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
