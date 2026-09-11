import { LOAD_PTS, WILDCARD } from "@rotation/shared";
import type { Assignment, Shift, ShiftSide, Staff } from "@rotation/shared";

export function daysBetween(d1: string, d2: string): number {
  return Math.round((new Date(d1).getTime() - new Date(d2).getTime()) / 86400000);
}

/**
 * Calendar-month rotation window (§20). A night shift that starts on the last
 * calendar day of a month stays attributed to that start-date month.
 */
export function rotationMonthKey(dateStr: string, _side: ShiftSide): string {
  const d = new Date(dateStr + "T00:00:00");
  const y = d.getFullYear();
  const m = d.getMonth();
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function sameRotationPeriod(
  refDate: string,
  refSide: ShiftSide,
  rowDate: string,
  rowSide: ShiftSide,
): boolean {
  return rotationMonthKey(refDate, refSide) === rotationMonthKey(rowDate, rowSide);
}

export interface MemoryRow {
  date: string;
  side: ShiftSide;
  staff_id: string;
  assignment_id: string;
  sentHome: boolean;
  partial: boolean;
}

/**
 * Flatten closed/open shift entries into rotation-memory rows.
 * Sent-home rows are included unless excludeFromMemory === true (default OFF).
 * Combined-pair secondaries are also counted.
 */
export function actualEntries(shifts: Shift[], catalog: Assignment[]): MemoryRow[] {
  const rows: MemoryRow[] = [];
  for (const s of shifts) {
    for (const e of s.entries || []) {
      const out = (s.eod?.outcomes || {})[e.staff_id];
      let aid = e.assignment_id;
      let sentHome = false;
      let excluded = false;
      if (out?.status === "reassigned" && out.reassigned_to) aid = out.reassigned_to;
      if (out?.status === "sent_home") {
        sentHome = true;
        excluded = out.excludeFromMemory === true;
      }
      if (excluded) continue;
      if (e.combined_with && catalog.some((a) => a.id === e.combined_with)) {
        rows.push({
          date: s.date,
          side: s.side,
          staff_id: e.staff_id,
          assignment_id: e.combined_with,
          sentHome,
          partial: !!e.partial,
        });
      }
      rows.push({
        date: s.date,
        side: s.side,
        staff_id: e.staff_id,
        assignment_id: aid,
        sentHome,
        partial: !!e.partial,
      });
    }
  }
  return rows;
}

export interface StaffMemory {
  freq: Record<string, number>;
  lastDone: Record<string, string>;
  loadPts: number;
  dayCt: number;
  nightCt: number;
  recent7: number;
}

export function buildMemory(
  staff: Staff[],
  win: MemoryRow[],
  catalog: Assignment[],
): Record<string, StaffMemory> {
  const mem: Record<string, StaffMemory> = {};
  for (const w of staff) {
    mem[w.id] = { freq: {}, lastDone: {}, loadPts: 0, dayCt: 0, nightCt: 0, recent7: 0 };
  }
  return mem;
}

export function applyWindowToMemory(
  mem: Record<string, StaffMemory>,
  win: MemoryRow[],
  catalog: Assignment[],
  date: string,
): void {
  for (const r of win) {
    const m = mem[r.staff_id];
    if (!m) continue;
    if (!r.partial) m.freq[r.assignment_id] = (m.freq[r.assignment_id] || 0) + 1;
    if (!m.lastDone[r.assignment_id] || r.date > m.lastDone[r.assignment_id]) {
      m.lastDone[r.assignment_id] = r.date;
    }
    const a = catalog.find((x) => x.id === r.assignment_id);
    if (a) m.loadPts += LOAD_PTS[a.load_level] || 2;
    if (r.side === "night") m.nightCt++;
    else m.dayCt++;
    if (daysBetween(date, r.date) <= 7) m.recent7++;
  }
}

export function windowRows(
  shifts: Shift[],
  catalog: Assignment[],
  date: string,
  side: ShiftSide,
): MemoryRow[] {
  return actualEntries(shifts, catalog).filter(
    (r) =>
      r.assignment_id !== WILDCARD &&
      daysBetween(date, r.date) >= 0 &&
      sameRotationPeriod(date, side, r.date, r.side),
  );
}
