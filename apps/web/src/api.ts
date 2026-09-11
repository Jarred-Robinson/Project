import type {
  Assignment,
  BoardEntry,
  CombinedPair,
  DashboardStats,
  EngineConfig,
  EngineResult,
  Shift,
  Staff,
  UserAccount,
} from "@rotation/shared";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init.headers || {}),
    },
  });
  if (res.status === 401) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (res.status === 403) throw Object.assign(new Error("Forbidden"), { status: 403 });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = j.error || msg;
    } catch {
      /* ignore */
    }
    throw Object.assign(new Error(msg), { status: res.status });
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json() as Promise<T>;
  return res as unknown as T;
}

export const api = {
  login: (username: string, password: string) =>
    req<{ user: UserAccount }>("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => req("/api/auth/logout", { method: "POST" }),
  me: () => req<{ user: UserAccount }>("/api/auth/me"),
  bootstrap: () =>
    req<{
      user: UserAccount;
      roster: Staff[];
      catalog: Assignment[];
      config: EngineConfig;
      shifts: Shift[];
      users?: UserAccount[];
    }>("/api/bootstrap"),
  dashboard: () =>
    req<DashboardStats & { open: Shift[]; pending: Shift[] }>("/api/dashboard"),
  generate: (body: {
    date: string;
    side: "day" | "night";
    boardStaff: Array<{
      staff_id: string;
      start: string;
      leavingEarly: boolean;
      pickedUp: boolean;
      predetermined: { assignmentId: string; comment: string } | null;
    }>;
    closedIds: string[];
    combinedPairs: CombinedPair[];
  }) => req<EngineResult & { warnings: string[] }>("/api/generate", { method: "POST", body: JSON.stringify(body) }),
  saveShift: (body: Partial<Shift> & { saveAs?: "current" | "pending" }) =>
    req<{ shift: Shift }>("/api/shifts", { method: "POST", body: JSON.stringify(body) }),
  patchShift: (id: string, patch: Partial<Shift>) =>
    req<{ shift: Shift }>(`/api/shifts/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  patchEntry: (id: string, staffId: string, patch: Partial<BoardEntry>) =>
    req<{ shift: Shift }>(`/api/shifts/${id}/entries/${staffId}`, { method: "POST", body: JSON.stringify(patch) }),
  redistribute: (id: string, staffId: string, newAssignmentId: string, reason?: string) =>
    req<{ shift: Shift }>(`/api/shifts/${id}/redistribute`, {
      method: "POST",
      body: JSON.stringify({ staffId, newAssignmentId, reason }),
    }),
  toggleHold: (id: string, staffId: string) =>
    req<{ shift: Shift }>(`/api/shifts/${id}/hold`, { method: "POST", body: JSON.stringify({ staffId }) }),
  regenerate: (id: string) =>
    req<{ shift: Shift; changed: number; held: number }>(`/api/shifts/${id}/regenerate`, { method: "POST" }),
  compliance: (id: string) =>
    req<{ shift: Shift; deficiencies: Shift["deficiencies"] }>(`/api/shifts/${id}/compliance`, { method: "POST" }),
  assignDeficiency: (id: string, staffId: string, assignmentId: string, comment: string) =>
    req<{ shift: Shift }>(`/api/shifts/${id}/assign-deficiency`, {
      method: "POST",
      body: JSON.stringify({ staffId, assignmentId, comment }),
    }),
  closeRoom: (id: string, assignmentId: string) =>
    req<{ shift: Shift }>(`/api/shifts/${id}/close-room`, { method: "POST", body: JSON.stringify({ assignmentId }) }),
  openEod: (id: string) => req<{ shift: Shift }>(`/api/shifts/${id}/eod`, { method: "POST" }),
  patchEod: (id: string, body: Record<string, unknown>) =>
    req<{ shift: Shift }>(`/api/shifts/${id}/eod`, { method: "PATCH", body: JSON.stringify(body) }),
  saveHistorical: (body: {
    date: string;
    side: "day" | "night";
    rows: Array<{ staff_id: string; assignment_id: string }>;
    justification: string;
  }) => req<{ shift: Shift }>("/api/shifts/historical", { method: "POST", body: JSON.stringify(body) }),
  putRoster: (roster: Staff[]) =>
    req<{ roster: Staff[] }>("/api/roster", { method: "PUT", body: JSON.stringify({ roster }) }),
  addStaff: (row: Partial<Staff>) => req<{ roster: Staff[] }>("/api/roster", { method: "POST", body: JSON.stringify(row) }),
  bulkRoster: (ids: string[], patch?: Partial<Staff>, action?: "delete") =>
    req<{ roster: Staff[] }>("/api/roster/bulk", { method: "POST", body: JSON.stringify({ ids, patch, action }) }),
  importRoster: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return req<{ added: number; updated: number; total: number; roster: Staff[] }>("/api/import/roster", {
      method: "POST",
      body: fd,
    });
  },
  saveCatalog: (row: Partial<Assignment>) =>
    req<{ catalog: Assignment[] }>("/api/catalog", { method: "POST", body: JSON.stringify(row) }),
  deleteCatalog: (id: string) => req<{ catalog: Assignment[] }>(`/api/catalog/${id}`, { method: "DELETE" }),
  saveConfig: (cfg: Partial<EngineConfig>) =>
    req<{ config: EngineConfig }>("/api/config", { method: "PUT", body: JSON.stringify(cfg) }),
  listUsers: () => req<{ users: UserAccount[] }>("/api/users"),
  saveUser: (u: Partial<UserAccount> & { password?: string }) =>
    req<{ users: UserAccount[] }>("/api/users", { method: "POST", body: JSON.stringify(u) }),
  deleteUser: (id: string) => req<{ users: UserAccount[] }>(`/api/users/${id}`, { method: "DELETE" }),
  reset: () => req("/api/reset", { method: "POST" }),
};

export function downloadUrl(path: string) {
  const a = document.createElement("a");
  a.href = path;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
