import { COMP_RANK } from "@rotation/shared";
import type { Assignment, Staff } from "@rotation/shared";

/** Role + competency + tech-specialty gate from Rotation Engine v5. */
export function eligible(w: Pick<Staff, "role" | "competency" | "tech_specialty">, a: Assignment): boolean {
  if (!a.roles.includes(w.role)) return false;
  if (COMP_RANK[w.competency] < COMP_RANK[a.min_competency]) return false;
  if (w.role === "tech" && a.tech_specialty && a.tech_specialty !== "both") {
    if (w.tech_specialty !== a.tech_specialty && w.tech_specialty !== "both") return false;
  }
  return true;
}

export function earlyOk(
  w: { leavingEarly?: boolean },
  a: Pick<Assignment, "load_level" | "special">,
): boolean {
  return !w.leavingEarly || a.load_level === "light" || a.special;
}
