import { useCallback, useEffect, useState } from "react";
import type { Assignment, EngineConfig, Shift, Staff, UserAccount } from "@rotation/shared";
import { api } from "./api";

export type AppNote = { id: string; text: string; severity: string; ts: string };
export type AppTab = "dash" | "board" | "shifts" | "archive" | "eod" | "roster" | "catalog" | "config" | "users";

export function useAppState() {
  const [boot, setBoot] = useState(true);
  const [user, setUser] = useState<UserAccount | null>(null);
  const [roster, setRoster] = useState<Staff[]>([]);
  const [catalog, setCatalog] = useState<Assignment[]>([]);
  const [config, setConfig] = useState<EngineConfig | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [tab, setTab] = useState<AppTab>("dash");
  const [err, setErr] = useState("");
  const [notes, setNotes] = useState<AppNote[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [eodId, setEodId] = useState<string | null>(null);

  const push = useCallback((text: string, severity = "info") => {
    setNotes((p) => [
      ...p,
      { id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text, severity, ts: new Date().toISOString() },
    ]);
  }, []);

  const load = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const replaceShift = useCallback((s: Shift) => {
    setShifts((prev) => prev.map((x) => (x.id === s.id ? s : x)));
  }, []);

  return {
    boot,
    setBoot,
    user,
    setUser,
    roster,
    setRoster,
    catalog,
    setCatalog,
    config,
    setConfig,
    shifts,
    setShifts,
    users,
    setUsers,
    tab,
    setTab,
    err,
    setErr,
    notes,
    setNotes,
    openId,
    setOpenId,
    eodId,
    setEodId,
    push,
    load,
    replaceShift,
  };
}

export type AppState = ReturnType<typeof useAppState>;
