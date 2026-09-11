import type { UserRole } from "./types.js";

export const DEMO_USERS: Array<{ username: string; password: string; name: string; role: UserRole }> = [
  { username: "admin", password: "rotation", name: "Administrator", role: "admin" },
  { username: "charge", password: "rotation", name: "Charge Nurse", role: "charge-nurse" },
];

export function isAdmin(role: UserRole) {
  return role === "admin";
}

export function canWriteRoster(role: UserRole) {
  return role === "admin";
}

export function canManageUsers(role: UserRole) {
  return role === "admin";
}
