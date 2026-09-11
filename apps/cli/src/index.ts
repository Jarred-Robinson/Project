import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";
import { DEFAULT_CONFIG, seedCatalog, seedRoster, type ShiftSide } from "@rotation/shared";
import { runEngine } from "@rotation/engine";
import {
  getConfig,
  getDb,
  listCatalog,
  listShifts,
  listStaff,
  replaceStaff,
  upsertShift,
} from "../../api/src/db.js";
import { historyToWorkbook, parseCsvRoster, parseRosterWorkbook } from "../../api/src/excel.js";

getDb();

const program = new Command();
program.name("rotation").description("ED Assignment Rotation Engine CLI").version("1.0.0");

program
  .command("generate")
  .requiredOption("--date <YYYY-MM-DD>", "shift start date")
  .requiredOption("--side <day|night>", "board side")
  .option("--staff <ids>", "comma-separated staff IDs (default: first 12 active nurses)")
  .action((opts: { date: string; side: string; staff?: string }) => {
    const side = opts.side as ShiftSide;
    if (side !== "day" && side !== "night") {
      console.error("side must be day or night");
      process.exit(1);
    }
    const roster = listStaff();
    const ids = opts.staff
      ? opts.staff.split(",").map((s) => s.trim())
      : roster.filter((w) => w.active !== false && w.role === "nurse").slice(0, 12).map((w) => w.id);
    const result = runEngine({
      date: opts.date,
      side,
      boardStaff: ids.map((staff_id) => ({
        staff_id,
        start: side === "day" ? "07:00" : "19:00",
        leavingEarly: false,
        pickedUp: false,
        predetermined: null,
      })),
      closedIds: new Set(),
      combinedPairs: [],
      roster,
      catalog: listCatalog().length ? listCatalog() : seedCatalog(),
      config: getConfig() || DEFAULT_CONFIG,
      shifts: listShifts(),
    });
    const rec = {
      id: `SH-${Date.now()}`,
      date: opts.date,
      side,
      generated_by: "cli",
      generated_at: new Date().toISOString(),
      entries: result.entries,
      logs: result.logs,
      deficiencies: result.deficiencies,
      closed_assignments: result.closedAssignments,
      closed_assignments_ids: [],
      combined_pairs: [],
      redistributions: [],
      eod: null,
      futurePending: false,
      complianceChecks: [],
    };
    upsertShift(rec);
    console.log(`Saved ${rec.id} — ${result.entries.length} assignments, ${result.deficiencies.length} deficiencies`);
    for (const e of result.entries) {
      console.log(`  ${e.start}  ${e.staff_name.padEnd(24)} → ${e.assignment_name}${e.partial ? " (P)" : ""}`);
    }
    if (result.deficiencies.length) {
      console.log("Deficiencies:");
      for (const d of result.deficiencies) console.log(`  [${d.severity === "red" ? "CRITICAL" : "REVIEW"}] ${d.text}`);
    }
  });

program
  .command("roster")
  .command("import")
  .argument("<file>", "CSV or XLSX roster export")
  .action((file: string) => {
    const abs = resolve(process.cwd(), file);
    const buf = readFileSync(abs);
    const rows = file.endsWith(".csv")
      ? parseCsvRoster(buf.toString("utf8"))
      : parseRosterWorkbook(buf);
    let roster = listStaff();
    if (!roster.length) roster = seedRoster();
    let added = 0;
    let updated = 0;
    for (const patch of rows) {
      const idx = patch.id ? roster.findIndex((w) => w.id === patch.id) : -1;
      if (idx >= 0) {
        roster[idx] = { ...roster[idx], ...patch, id: roster[idx].id };
        updated++;
      } else {
        roster.push({
          id: patch.id || `S${Date.now()}${Math.floor(Math.random() * 1000)}`,
          name: patch.name || "Unnamed",
          role: patch.role || "nurse",
          competency: patch.competency || "trained",
          tech_specialty: patch.tech_specialty ?? null,
          avoidNight: !!patch.avoidNight,
          agency: !!patch.agency,
          active: patch.active !== false,
          pickedUp: false,
          predetermined: null,
        });
        added++;
      }
    }
    replaceStaff(roster);
    console.log(`Roster import: ${added} added, ${updated} updated (${rows.length} rows)`);
  });

program
  .command("export")
  .command("history")
  .option("--out <file>", "output xlsx path", "./rotation-history.xlsx")
  .action((opts: { out: string }) => {
    const buf = historyToWorkbook(listShifts(), listCatalog().length ? listCatalog() : seedCatalog());
    const abs = resolve(process.cwd(), opts.out);
    writeFileSync(abs, buf);
    console.log(`Wrote ${abs}`);
  });

program.parse();
