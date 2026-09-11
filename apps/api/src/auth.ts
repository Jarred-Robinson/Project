import { randomBytes } from "node:crypto";
import type { Context, Next } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { UserAccount, UserRole } from "@rotation/shared";
import {
  createSession,
  deleteSession,
  getSession,
  getUserById,
  getUserByUsername,
  publicUser,
} from "./db.js";
import { verifyPassword } from "./password.js";

export const COOKIE = "re_session";
const TTL_MS = 12 * 60 * 60 * 1000;

export type AppEnv = {
  Variables: {
    user: UserAccount;
  };
};

export function login(username: string, password: string): UserAccount | null {
  const user = getUserByUsername(username);
  if (!user || !verifyPassword(password, user.password_hash)) return null;
  return publicUser(user);
}

export function issueSession(c: Context, user: UserAccount) {
  const id = randomBytes(24).toString("hex");
  createSession(id, user.id, Date.now() + TTL_MS);
  setCookie(c, COOKIE, id, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export function clearSession(c: Context) {
  const id = getCookie(c, COOKIE);
  if (id) deleteSession(id);
  deleteCookie(c, COOKIE, { path: "/" });
}

export async function optionalAuth(c: Context<AppEnv>, next: Next) {
  const id = getCookie(c, COOKIE);
  if (id) {
    const sess = getSession(id);
    if (sess && sess.expires_at > Date.now()) {
      const user = getUserById(sess.user_id);
      if (user) c.set("user", publicUser(user));
    }
  }
  await next();
}

export async function requireAuth(c: Context<AppEnv>, next: Next) {
  const id = getCookie(c, COOKIE);
  if (!id) return c.json({ error: "Unauthorized" }, 401);
  const sess = getSession(id);
  if (!sess || sess.expires_at <= Date.now()) return c.json({ error: "Unauthorized" }, 401);
  const user = getUserById(sess.user_id);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  c.set("user", publicUser(user));
  await next();
}

export function requireRole(...roles: UserRole[]) {
  return async (c: Context<AppEnv>, next: Next) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    if (!roles.includes(user.role)) return c.json({ error: "Forbidden" }, 403);
    await next();
  };
}
