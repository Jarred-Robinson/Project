import { LOAD_PTS } from "@rotation/shared";
import type { Assignment, BoardEntry } from "@rotation/shared";

export function applyBoarder(entry: BoardEntry, on: boolean, comment: string): BoardEntry {
  return { ...entry, boarder: on, boarderComment: on ? comment : "" };
}

export function applyCombine(
  entry: BoardEntry,
  partner: BoardEntry | null,
  comment: string,
  catalog: Assignment[],
): BoardEntry {
  if (!partner) {
    return {
      ...entry,
      runtimeCombinedWith: null,
      runtimeCombineComment: "",
      runtimeCombinedName: null,
      _runtimeLoadA: null,
      _runtimeLoadB: null,
    };
  }
  return {
    ...entry,
    runtimeCombinedWith: partner.staff_id,
    runtimeCombineComment: comment,
    runtimeCombinedName: partner.assignment_name,
    _runtimeLoadA: catalog.find((a) => a.id === entry.assignment_id)?.load_level,
    _runtimeLoadB: catalog.find((a) => a.id === partner.assignment_id)?.load_level,
  };
}

export function combinedLoadPoints(entry: BoardEntry): number {
  if (entry.combined_with) return entry.combined_load_pts || 0;
  if (entry.runtimeCombinedWith) {
    return (LOAD_PTS[entry._runtimeLoadA || "light"] || 0) + (LOAD_PTS[entry._runtimeLoadB || "light"] || 0);
  }
  return 0;
}

export function isGoldCategory(category: string) {
  return (category || "").startsWith("Gold");
}
