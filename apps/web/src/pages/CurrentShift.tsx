import type { Assignment, Shift, Staff, UserAccount } from "@rotation/shared";
import { C, Panel } from "../components/ui";
import { ShiftDetail } from "../components/BoardWidgets";

export function CurrentShiftPage(props: {
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
