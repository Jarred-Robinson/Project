import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "rotation-api-"));
process.env.ROTATION_DB = join(dir, "rotation.db");

const { createApp } = await import("../app.js");
const { closeDb } = await import("@rotation/db");

const app = createApp();

function cookie(res: Response) {
  const raw = res.headers.get("set-cookie") || "";
  return raw.split(";")[0] || "";
}

async function login(username: string, password: string) {
  return app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

describe("admin vs charge-nurse auth", () => {
  afterAll(() => {
    closeDb();
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects bad credentials with 401", async () => {
    const res = await login("admin", "wrong");
    expect(res.status).toBe(401);
  });

  it("sets an HttpOnly session cookie for admin", async () => {
    const res = await login("admin", "rotation");
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toMatch(/re_session=/);
    expect(setCookie.toLowerCase()).toMatch(/httponly/);
    const me = await app.request("/api/auth/me", { headers: { Cookie: cookie(res) } });
    expect(me.status).toBe(200);
    const body = await me.json();
    expect(body.user.role).toBe("admin");
  });

  it("returns 401 on protected routes without a session", async () => {
    const res = await app.request("/api/bootstrap");
    expect(res.status).toBe(401);
  });

  it("returns 403 when charge-nurse hits admin routes", async () => {
    const res = await login("charge", "rotation");
    expect(res.status).toBe(200);
    const hdr = { Cookie: cookie(res) };
    const reset = await app.request("/api/reset", { method: "POST", headers: hdr });
    expect(reset.status).toBe(403);
    const users = await app.request("/api/users", { headers: hdr });
    expect(users.status).toBe(403);
    const dash = await app.request("/api/dashboard", { headers: hdr });
    expect(dash.status).toBe(200);
  });
});
