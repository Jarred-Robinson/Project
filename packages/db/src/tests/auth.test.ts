import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "rotation-db-"));
process.env.ROTATION_DB = join(dir, "rotation.db");

const { closeDb, getUserByUsername, listUsers, publicUser, resetAll } = await import("../store.js");
const { verifyPassword } = await import("../password.js");

describe("seeded local accounts", () => {
  beforeEach(() => {
    resetAll();
  });

  afterEach(() => {
    closeDb();
    rmSync(dir, { recursive: true, force: true });
  });

  it("seeds admin and charge-nurse with demo password", () => {
    const users = listUsers();
    expect(users.map((u) => u.username).sort()).toEqual(["admin", "charge"]);
    const admin = getUserByUsername("admin")!;
    const charge = getUserByUsername("charge")!;
    expect(admin.role).toBe("admin");
    expect(charge.role).toBe("charge-nurse");
    expect(verifyPassword("rotation", admin.password_hash)).toBe(true);
    expect(verifyPassword("rotation", charge.password_hash)).toBe(true);
    expect(publicUser(admin)).not.toHaveProperty("password_hash");
  });
});
