import type { ReactNode } from "react";
import type { UserAccount } from "@rotation/shared";
import { isAdmin } from "@rotation/shared";
import type { AppNote, AppTab } from "../state";
import { Btn, C } from "./ui";

function rotationMonth(date: string) {
  return date.slice(0, 7);
}

export function Layout({
  user,
  staffCount,
  tab,
  setTab,
  notes,
  dismissNote,
  onSignOut,
  children,
}: {
  user: UserAccount;
  staffCount: number;
  tab: AppTab;
  setTab: (t: AppTab) => void;
  notes: AppNote[];
  dismissNote: (id: string) => void;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const admin = isAdmin(user.role);
  const tabs: Array<[AppTab, string]> = [
    ["dash", "Dashboard"],
    ["board", "Generate Board"],
    ["shifts", "Current Shift"],
    ["archive", "Archive"],
    ...(tab === "eod" ? ([["eod", "EOD Closeout"]] as Array<[AppTab, string]>) : []),
    ["roster", "Roster"],
    ...(admin
      ? ([
          ["catalog", "Catalog"],
          ["config", "Config"],
          ["users", "Users"],
        ] as Array<[AppTab, string]>)
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
              {staffCount} staff · monthly rotation window ({rotationMonth(new Date().toISOString())}) · sqlite
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs font-mono text-right" style={{ color: "#8FA4A8" }}>
              {user.name}
              <br />
              <span style={{ color: admin ? "#D4B96A" : "#8FA4A8" }}>{user.role.toUpperCase()}</span>
            </div>
            <Btn tone="slate" onClick={onSignOut}>
              SIGN OUT
            </Btn>
          </div>
        </div>
      </header>

      {notes.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 pt-3 space-y-1.5">
          {notes.map((n) => {
            const s =
              n.severity === "danger"
                ? { bg: C.redSoft, fg: C.red }
                : n.severity === "warn"
                  ? { bg: C.amberSoft, fg: C.amber }
                  : { bg: C.tealSoft, fg: C.teal };
            return (
              <div key={n.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm" style={{ background: s.bg, color: s.fg }}>
                <span className="flex-1">{n.text}</span>
                <button className="font-mono" onClick={() => dismissNote(n.id)}>
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

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-4">{children}</main>

      <footer className="max-w-6xl mx-auto px-4 pb-6 text-xs font-mono" style={{ color: C.sub }}>
        Precedence: predetermined assignment → role → tech specialty → competency → early-out → close → critical coverage → calendar-month rotation window → frequency cap → fairness → fallback → special → wildcard.
        Deficiency-review assignments and manual/historical entries sit outside this automated chain.
      </footer>
    </div>
  );
}
