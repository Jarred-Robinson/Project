export { heldOverWarnings } from "./engine.js";
import type { EodOutcome, Shift } from "@rotation/shared";

export function defaultOutcome(): EodOutcome {
  return {
    status: "as_assigned",
    reassigned_to: "",
    note: "",
    heldOver: false,
    excludeFromMemory: false,
  };
}

export function startCloseout(shift: Shift): Shift {
  if (shift.eod) return shift;
  const outcomes: Record<string, EodOutcome> = {};
  for (const e of shift.entries) outcomes[e.staff_id] = defaultOutcome();
  return {
    ...shift,
    eod: {
      closed: false,
      outcomes,
      closeout_timestamp: new Date().toISOString().slice(0, 16),
    },
  };
}

export function closeShift(shift: Shift, by: string, notes?: string): Shift {
  return {
    ...shift,
    eod: {
      ...(shift.eod || { outcomes: {} }),
      closed: true,
      closed_by: by,
      closed_at: new Date().toISOString(),
      notes: notes ?? shift.eod?.notes,
    },
  };
}
