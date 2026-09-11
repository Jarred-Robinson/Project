import { isAdmin } from "@rotation/shared";
import { api } from "./api";
import { Layout } from "./components/Layout";
import { C } from "./components/ui";
import { ArchivePage } from "./pages/Archive";
import { CatalogPage } from "./pages/Catalog";
import { EodPage } from "./pages/Closeout";
import { ConfigPage } from "./pages/Config";
import { CurrentShiftPage } from "./pages/CurrentShift";
import { Dashboard } from "./pages/Dashboard";
import { GenerateBoard } from "./pages/Generate";
import { Login } from "./pages/Login";
import { RosterPage } from "./pages/Roster";
import { UsersPage } from "./pages/Users";
import { useAppState } from "./state";

export function App() {
  const s = useAppState();

  if (s.boot) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
        <div className="font-mono text-sm" style={{ color: C.sub }}>
          Loading board data…
        </div>
      </div>
    );
  }

  if (!s.user) {
    return (
      <Login
        err={s.err}
        onSubmit={async (username, password) => {
          try {
            await api.login(username, password);
            s.setErr("");
            s.setBoot(true);
            await s.load();
          } catch (e) {
            s.setErr((e as Error).message || "Incorrect credentials.");
          }
        }}
      />
    );
  }

  const admin = isAdmin(s.user.role);

  return (
    <Layout
      user={s.user}
      staffCount={s.roster.filter((w) => w.active !== false).length}
      tab={s.tab}
      setTab={s.setTab}
      notes={s.notes}
      dismissNote={(id) => s.setNotes((p) => p.filter((x) => x.id !== id))}
      onSignOut={async () => {
        await api.logout();
        s.setUser(null);
      }}
    >
      {s.tab === "dash" && (
        <Dashboard
          shifts={s.shifts}
          roster={s.roster}
          onOpen={(id, t) => {
            s.setOpenId(id);
            s.setTab(t as typeof s.tab);
          }}
        />
      )}
      {s.tab === "board" && s.config && (
        <GenerateBoard
          roster={s.roster}
          catalog={s.catalog}
          config={s.config}
          onNotify={s.push}
          onSaved={(shift, dest) => {
            s.setShifts((p) => [shift, ...p]);
            s.setOpenId(shift.id);
            s.setTab(dest as typeof s.tab);
          }}
        />
      )}
      {s.tab === "shifts" && (
        <CurrentShiftPage
          shifts={s.shifts.filter((x) => !x.eod?.closed && !x.futurePending)}
          catalog={s.catalog}
          roster={s.roster}
          me={s.user}
          openId={s.openId}
          setOpenId={s.setOpenId}
          replaceShift={s.replaceShift}
          onNotify={s.push}
          onCloseout={(id) => {
            s.setEodId(id);
            s.setTab("eod");
          }}
        />
      )}
      {s.tab === "archive" && (
        <ArchivePage
          shifts={s.shifts}
          catalog={s.catalog}
          roster={s.roster}
          me={s.user}
          openId={s.openId}
          setOpenId={s.setOpenId}
          replaceShift={s.replaceShift}
          onNotify={s.push}
          onAdded={(shift) => s.setShifts((p) => [shift, ...p])}
          onCloseout={(id) => {
            s.setEodId(id);
            s.setTab("eod");
          }}
        />
      )}
      {s.tab === "eod" && s.eodId && (
        <EodPage
          shift={s.shifts.find((x) => x.id === s.eodId)}
          catalog={s.catalog}
          replaceShift={s.replaceShift}
          onBack={() => s.setTab("shifts")}
        />
      )}
      {s.tab === "roster" && (
        <RosterPage roster={s.roster} setRoster={s.setRoster} isAdmin={admin} onNotify={s.push} />
      )}
      {s.tab === "catalog" && admin && <CatalogPage catalog={s.catalog} setCatalog={s.setCatalog} />}
      {s.tab === "config" && admin && s.config && (
        <ConfigPage
          config={s.config}
          setConfig={s.setConfig}
          onReset={async () => {
            await api.reset();
            location.reload();
          }}
        />
      )}
      {s.tab === "users" && admin && <UsersPage users={s.users} setUsers={s.setUsers} me={s.user} />}
    </Layout>
  );
}
