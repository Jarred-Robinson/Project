import { describe, expect, it } from "vitest";
import { seedCatalog, seedRoster } from "@rotation/shared";
import { parseCsvRoster, rosterToWorkbook, parseRosterWorkbook, historyToWorkbook } from "../excel.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("excel roster round-trip", () => {
  it("exports and re-imports the seed roster", () => {
    const buf = rosterToWorkbook(seedRoster());
    const rows = parseRosterWorkbook(buf);
    expect(rows.length).toBe(143);
    expect(rows[0]?.name).toBe("Achs, Marlena");
    expect(rows.find((r) => r.id === "S014")?.agency).toBe(true);
  });

  it("parses samples/roster.csv", () => {
    const text = readFileSync(resolve(process.cwd(), "../../samples/roster.csv"), "utf8");
    const rows = parseCsvRoster(text);
    expect(rows.length).toBe(143);
    expect(rows[2]?.name).toBe("Alston, Amia");
  });

  it("builds a four-sheet history workbook even with no shifts", () => {
    const buf = historyToWorkbook([], seedCatalog());
    expect(buf.length).toBeGreaterThan(100);
  });
});
