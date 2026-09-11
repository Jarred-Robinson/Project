import { useState } from "react";
import { Btn, C, Field, iCls, iSty } from "../components/ui";

export function Login({ err, onSubmit }: { err: string; onSubmit: (u: string, p: string) => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("rotation");
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: C.bg }}>
      <form
        className="w-full max-w-sm rounded-xl border p-6 space-y-3"
        style={{ background: C.panel, borderColor: C.line }}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(username, password);
        }}
      >
        <div className="display text-xl font-bold" style={{ color: C.ink }}>
          ROTATION ENGINE
        </div>
        <div className="text-xs font-mono" style={{ color: C.sub }}>
          SIGN IN — ED SHIFT OPS BOARD
        </div>
        <Field label="Username">
          <input className={iCls} style={iSty} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </Field>
        <Field label="Password">
          <input className={iCls + " font-mono"} style={iSty} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </Field>
        {err && (
          <div className="text-xs" style={{ color: C.red }}>
            {err}
          </div>
        )}
        <Btn wide type="submit">
          SIGN IN
        </Btn>
        <p className="text-xs" style={{ color: C.sub }}>
          Demo: <span className="font-mono">admin / rotation</span> or <span className="font-mono">charge / rotation</span>
        </p>
      </form>
    </div>
  );
}
