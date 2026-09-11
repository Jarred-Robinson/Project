import type { UserAccount } from "@rotation/shared";
import { api } from "../api";
import { Btn, C, Field, Panel, iCls, iSty } from "../components/ui";

export function UsersPage({ users, setUsers, me }: { users: UserAccount[]; setUsers: (u: UserAccount[]) => void; me: UserAccount }) {
  return (
    <Panel title="USER ACCOUNTS" right={<Btn tone="ghost" onClick={async () => setUsers((await api.saveUser({ username: `user${Date.now() % 1000}`, name: "New user", role: "charge-nurse", password: "rotation" })).users)}>+ ADD</Btn>}>
      {users.map((u) => (
        <div key={u.id} className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end rounded p-2 mb-1" style={{ background: "#F5F7F6" }}>
          <Field label="Name"><input className={iCls} style={iSty} value={u.name} onChange={async (e) => setUsers((await api.saveUser({ ...u, name: e.target.value })).users)} /></Field>
          <Field label="Username"><input className={iCls} style={iSty} value={u.username} onChange={async (e) => setUsers((await api.saveUser({ ...u, username: e.target.value })).users)} /></Field>
          <Field label="Role">
            <select className={iCls} style={iSty} value={u.role} onChange={async (e) => setUsers((await api.saveUser({ ...u, role: e.target.value as UserAccount["role"] })).users)}>
              <option value="charge-nurse">charge-nurse</option>
              <option value="admin">administrator</option>
            </select>
          </Field>
          <Btn tone="red" disabled={u.id === me.id} onClick={async () => setUsers((await api.deleteUser(u.id)).users)}>{u.id === me.id ? "YOU" : "REMOVE"}</Btn>
        </div>
      ))}
      <div className="text-xs font-mono mt-2" style={{ color: C.sub }}>New users default to password <span className="font-semibold">rotation</span> unless changed via API.</div>
    </Panel>
  );
}
