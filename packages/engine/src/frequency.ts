import type { Assignment, EngineConfig } from "@rotation/shared";
import type { StaffMemory } from "./memory.js";

export function isFrequencyCompliant(
  mem: StaffMemory,
  assignment: Assignment,
  config: EngineConfig,
): boolean {
  if (assignment.non_repeatable && (mem.freq[assignment.id] || 0) > 0) return false;
  if ((mem.freq[assignment.id] || 0) >= config.max_assignment_frequency) return false;
  return true;
}

export function skipPartialInFrequency(partial: boolean) {
  return partial;
}
