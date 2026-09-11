import type { EngineConfig, LoadLevel, Competency } from "./types.js";

export const WILDCARD = "WILDCARD";

export const START_TIMES = [
  "03:00",
  "05:00",
  "07:00",
  "09:00",
  "11:00",
  "15:00",
  "17:00",
  "19:00",
  "21:00",
] as const;

export const COMP_RANK: Record<Competency, number> = {
  untrained: 0,
  trained: 1,
  proficient: 2,
};

export const LOAD_PTS: Record<LoadLevel, number> = {
  light: 1,
  medium: 2,
  heavy: 3,
};

export const TECH_SPECIALTIES = [
  "general",
  "huc",
  "both",
  "ekg",
  "sitter",
  "triage",
  "obs_sitter",
  "edt",
] as const;

export const ROLES = ["nurse", "tech", "paramedic"] as const;

export const DEFAULT_CONFIG: EngineConfig = {
  rotation_window_days: 42,
  max_assignment_frequency: 4,
  min_staff_day: 8,
  min_staff_night: 6,
};

export const PALETTE = {
  bg: "#F0F2F1",
  panel: "#FFFFFF",
  ink: "#14202A",
  sub: "#566570",
  line: "#D6DCDB",
  teal: "#0C4F54",
  tealMid: "#1A7A82",
  tealSoft: "#DFF0F1",
  amber: "#A06B00",
  amberSoft: "#F5EDDA",
  red: "#963529",
  redSoft: "#F2E0DC",
  green: "#346644",
  greenSoft: "#DFF0E5",
  slate: "#E5E9E8",
  plum: "#6B4162",
  rose: "#8C4A56",
  ochre: "#8A6A1E",
  steel: "#3C5A73",
  moss: "#5B6E3A",
  clay: "#7A5138",
} as const;

export const ZONE_COLORS: Record<string, string> = {
  Gold: PALETTE.amber,
  "Gold A": PALETTE.ochre,
  "Green A": PALETTE.green,
  "Green B": PALETTE.moss,
  Flow: PALETTE.teal,
  Triage: PALETTE.tealMid,
  Trauma: PALETTE.red,
  Observation: PALETTE.steel,
  "Tech Zone": PALETTE.plum,
  HUC: PALETTE.clay,
  Special: PALETTE.sub,
  "B-Bed": PALETTE.rose,
};

export const BADGES: Record<string, { bg: string; fg: string; label: string }> = {
  none: { bg: PALETTE.greenSoft, fg: PALETTE.green, label: "COMPLIANT" },
  fallback_override: { bg: PALETTE.tealSoft, fg: PALETTE.teal, label: "FALLBACK" },
  special_assignment: { bg: PALETTE.slate, fg: PALETTE.sub, label: "SPECIAL" },
  wildcard_override: { bg: PALETTE.amberSoft, fg: PALETTE.amber, label: "WILDCARD" },
  staffing_override: { bg: PALETTE.redSoft, fg: PALETTE.red, label: "STAFFING" },
  redistributed: { bg: PALETTE.tealSoft, fg: PALETTE.tealMid, label: "REDISTRIBUTED" },
  predetermined: { bg: PALETTE.tealSoft, fg: PALETTE.teal, label: "PREDETERMINED" },
  deficiency_assignment: { bg: PALETTE.tealSoft, fg: PALETTE.tealMid, label: "DEFICIENCY ASSIGN" },
  manual_historical: { bg: PALETTE.slate, fg: PALETTE.sub, label: "MANUAL/HISTORICAL" },
};

export const DEMO_CREDENTIALS = {
  admin: { username: "admin", password: "rotation", name: "Administrator", role: "admin" as const },
  charge: { username: "charge", password: "rotation", name: "Charge Nurse", role: "charge-nurse" as const },
};
