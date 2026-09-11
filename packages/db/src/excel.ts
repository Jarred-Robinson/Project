import * as XLSX from "xlsx";
import type { Assignment, Shift, Staff } from "@rotation/shared";

function aName(catalog: Assignment[], id: string) {
  if (id === "WILDCARD") return "WILDCARD";
  return catalog.find((a) => a.id === id)?.name || id;
}

export function rosterToWorkbook(roster: Staff[]): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      roster.map((w) => ({
        ID: w.id,
        Name: w.name,
        Role: w.role,
        Competency: w.competency,
        "Tech Specialty": w.tech_specialty || "",
        Agency: w.agency ? "YES" : "",
        "Avoids Nights": w.avoidNight ? "YES" : "",
        Active: w.active === false ? "NO" : "YES",
      })),
    ),
    "Roster",
  );
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function parseRosterWorkbook(buf: Buffer): Array<Partial<Staff> & { id?: string }> {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets.Roster || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows.map((row) => ({
    id: String(row.ID || "").trim() || undefined,
    name: String(row.Name || "").trim() || "Unnamed",
    role: ["nurse", "tech", "paramedic"].includes(String(row.Role)) ? (row.Role as Staff["role"]) : "nurse",
    competency: ["untrained", "trained", "proficient"].includes(String(row.Competency))
      ? (row.Competency as Staff["competency"])
      : "trained",
    tech_specialty: row["Tech Specialty"] ? (String(row["Tech Specialty"]) as Staff["tech_specialty"]) : null,
    agency: String(row.Agency).toUpperCase() === "YES",
    avoidNight: String(row["Avoids Nights"]).toUpperCase() === "YES",
    active: String(row.Active).toUpperCase() !== "NO",
  }));
}

export function shiftToWorkbook(s: Shift, catalog: Assignment[]): Buffer {
  const wb = XLSX.utils.book_new();
  const board = s.entries.map((e) => {
    const o = s.eod?.outcomes?.[e.staff_id];
    return {
      Date: s.date,
      Shift: s.side.toUpperCase(),
      Start: e.start,
      Staff: e.staff_name,
      Role: e.role,
      Competency: e.competency,
      Agency: e.agency ? "YES" : "",
      "Picked Up": e.pickedUp ? "YES" : "",
      Assignment: e.assignment_name + (e.partial ? " (P)" : ""),
      Combined: e.combined_name || "",
      "Runtime Combined": e.runtimeCombinedName || "",
      Boarder: e.boarder ? "YES" : "",
      "Boarder Comment": e.boarderComment || "",
      Held: e.held ? "YES" : "",
      Category: e.category,
      "Original Assignment": e.previous_assignment_name || "",
      Status: o?.status || "as_assigned",
      "Actual Assignment":
        o?.status === "reassigned"
          ? aName(catalog, o.reassigned_to)
          : o?.status === "sent_home"
            ? "SENT HOME"
            : e.assignment_name,
      "Held Over (next shift)": o?.heldOver ? "YES" : "",
      Note: o?.note || "",
      Override: e.override_type,
      "Fairness Score": e.fairness_score ?? "",
      "Rotation Compliant": e.rotation_compliant ? "YES" : "NO",
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(board), "Board");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet((s.deficiencies || []).map((d) => ({ Severity: d.severity.toUpperCase(), Type: d.kind, Finding: d.text }))),
    "Deficiencies",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet((s.redistributions || []).map((r) => ({ Time: r.timestamp, By: r.by, Staff: r.staff_name, From: r.from, To: r.to }))),
    "Redistributions",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Date: s.date,
        Shift: s.side,
        GeneratedBy: s.generated_by,
        GeneratedAt: s.generated_at,
        ClosedBy: s.eod?.closed_by || "",
        Notes: s.eod?.notes || "",
        ClosedAssignments: (s.closed_assignments || []).join("; "),
        CombinedPairs: (s.combined_pairs || []).map((p) => `${aName(catalog, p.primary_id)} + ${aName(catalog, p.secondary_id)}`).join("; "),
        StaffCount: s.entries.length,
      },
    ]),
    "Summary",
  );
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function historyToWorkbook(shifts: Shift[], catalog: Assignment[]): Buffer {
  const wb = XLSX.utils.book_new();
  const allBoards: Record<string, unknown>[] = [];
  const allDeficiencies: Record<string, unknown>[] = [];
  const allRedistributions: Record<string, unknown>[] = [];
  const shiftSummaries: Record<string, unknown>[] = [];
  for (const s of shifts) {
    for (const e of s.entries) {
      const o = s.eod?.outcomes?.[e.staff_id];
      allBoards.push({
        Date: s.date,
        Side: s.side.toUpperCase(),
        Start: e.start,
        Staff: e.staff_name,
        Role: e.role,
        Competency: e.competency,
        Agency: e.agency ? "YES" : "",
        "Picked Up": e.pickedUp ? "YES" : "",
        Assignment: e.assignment_name + (e.partial ? " (P)" : ""),
        Combined: e.combined_name || "",
        "Runtime Combined": e.runtimeCombinedName || "",
        Boarder: e.boarder ? "YES" : "",
        "Boarder Comment": e.boarderComment || "",
        Held: e.held ? "YES" : "",
        Category: e.category,
        "Original Assignment": e.previous_assignment_name || "",
        Status: o?.status || "as_assigned",
        "Actual Assignment":
          o?.status === "reassigned"
            ? aName(catalog, o.reassigned_to)
            : o?.status === "sent_home"
              ? "SENT HOME"
              : e.assignment_name,
        "Held Over (next shift)": o?.heldOver ? "YES" : "",
        "Excluded From Memory": o?.excludeFromMemory ? "YES" : "",
        Note: o?.note || "",
        Override: e.override_type,
        "Fairness Score": e.fairness_score ?? "",
        "Rotation Compliant": e.rotation_compliant ? "YES" : "NO",
      });
    }
    for (const d of s.deficiencies || []) {
      allDeficiencies.push({
        Date: s.date,
        Side: s.side.toUpperCase(),
        Severity: d.severity.toUpperCase(),
        Type: d.kind,
        Finding: d.text,
      });
    }
    for (const r of s.redistributions || []) {
      allRedistributions.push({
        Date: s.date,
        Side: s.side.toUpperCase(),
        Time: r.timestamp,
        By: r.by,
        Staff: r.staff_name,
        From: r.from,
        To: r.to,
      });
    }
    shiftSummaries.push({
      Date: s.date,
      Side: s.side,
      GeneratedBy: s.generated_by,
      GeneratedAt: s.generated_at,
      ClosedBy: s.eod?.closed_by || "",
      ClosedAt: s.eod?.closed_at || "",
      Notes: s.eod?.notes || "",
      ManualEntry: s.manual_entry ? "YES" : "",
      Justification: s.justification || "",
      FuturePending: s.futurePending && !s.eod?.closed ? "YES" : "",
      ClosedAssignments: (s.closed_assignments || []).join("; "),
      CombinedPairs: (s.combined_pairs || []).map((p) => `${aName(catalog, p.primary_id)} + ${aName(catalog, p.secondary_id)}`).join("; "),
      StaffCount: s.entries.length,
      ComplianceChecks: (s.complianceChecks || []).length,
    });
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allBoards), "All Boards");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allDeficiencies), "All Deficiencies");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allRedistributions), "All Redistributions");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(shiftSummaries), "Shift Summary");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function parseCsvRoster(text: string): Array<Partial<Staff> & { id?: string }> {
  const wb = XLSX.read(text, { type: "string" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows.map((row) => ({
    id: String(row.ID || row.id || "").trim() || undefined,
    name: String(row.Name || row.name || "").trim() || "Unnamed",
    role: ["nurse", "tech", "paramedic"].includes(String(row.Role || row.role))
      ? ((row.Role || row.role) as Staff["role"])
      : "nurse",
    competency: ["untrained", "trained", "proficient"].includes(String(row.Competency || row.competency))
      ? ((row.Competency || row.competency) as Staff["competency"])
      : "trained",
    tech_specialty: (row["Tech Specialty"] || row.tech_specialty)
      ? (String(row["Tech Specialty"] || row.tech_specialty) as Staff["tech_specialty"])
      : null,
    agency: String(row.Agency || row.agency).toUpperCase() === "YES",
    avoidNight: String(row["Avoids Nights"] || row.avoidNight).toUpperCase() === "YES",
    active: String(row.Active || row.active).toUpperCase() !== "NO",
  }));
}
