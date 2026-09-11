export type Role = "nurse" | "tech" | "paramedic";
export type Competency = "untrained" | "trained" | "proficient";
export type LoadLevel = "light" | "medium" | "heavy";
export type ShiftSide = "day" | "night";
export type UserRole = "admin" | "charge-nurse";
export type TechSpecialty =
  | "general"
  | "huc"
  | "both"
  | "ekg"
  | "sitter"
  | "triage"
  | "obs_sitter"
  | "edt";

export type OverrideType =
  | "none"
  | "fallback_override"
  | "special_assignment"
  | "wildcard_override"
  | "staffing_override"
  | "redistributed"
  | "predetermined"
  | "deficiency_assignment"
  | "manual_historical";

export type DeficiencyKind =
  | "headcount"
  | "unfilled"
  | "wildcard"
  | "override"
  | "competency"
  | "combined_load";

export type DeficiencySeverity = "red" | "amber";

export type OutcomeStatus = "as_assigned" | "reassigned" | "sent_home" | "other";

export interface Staff {
  id: string;
  name: string;
  role: Role;
  competency: Competency;
  tech_specialty: TechSpecialty | null;
  avoidNight: boolean;
  agency: boolean;
  active: boolean;
  pickedUp: boolean;
  predetermined: Predetermined | null;
}

export interface Predetermined {
  assignmentId: string;
  comment: string;
}

export interface Assignment {
  id: string;
  name: string;
  category: string;
  load_level: LoadLevel;
  min_competency: Competency;
  roles: Role[];
  tech_specialty: TechSpecialty | null;
  critical: boolean;
  special: boolean;
  non_repeatable: boolean;
  closeable: boolean;
}

export interface EngineConfig {
  rotation_window_days: number;
  max_assignment_frequency: number;
  min_staff_day: number;
  min_staff_night: number;
}

export interface CombinedPair {
  primary_id: string;
  secondary_id: string;
}

export interface BoardStaffInput {
  staff_id: string;
  start: string;
  leavingEarly: boolean;
  pickedUp: boolean;
  predetermined: Predetermined | null;
}

export interface BoardEntry {
  staff_id: string;
  staff_name: string;
  role: Role;
  competency: Competency;
  tech_specialty: TechSpecialty | null;
  agency: boolean;
  start: string;
  leavingEarly: boolean;
  pickedUp: boolean;
  assignment_id: string;
  assignment_name: string;
  category: string;
  combined_with: string | null;
  combined_name: string | null;
  combined_load_pts: number | null;
  override_type: OverrideType;
  reason: string;
  violated_rule: string;
  fairness_score: number | null;
  rotation_compliant: boolean;
  wildcard_used: boolean;
  boarder: boolean;
  boarderComment: string;
  runtimeCombinedWith: string | null;
  runtimeCombineComment: string;
  runtimeCombinedName?: string | null;
  _runtimeLoadA?: LoadLevel | null;
  _runtimeLoadB?: LoadLevel | null;
  held: boolean;
  partial: boolean;
  previous_assignment_id?: string;
  previous_assignment_name?: string;
}

export interface Deficiency {
  severity: DeficiencySeverity;
  kind: DeficiencyKind;
  text: string;
  assignment_id?: string;
  staff_id?: string;
}

export interface EngineResult {
  entries: BoardEntry[];
  logs: Array<BoardEntry & { timestamp: string }>;
  deficiencies: Deficiency[];
  staffCount: number;
  closedAssignments: string[];
}

export interface EodOutcome {
  status: OutcomeStatus;
  reassigned_to: string;
  note: string;
  heldOver: boolean;
  excludeFromMemory: boolean;
}

export interface EodRecord {
  closed: boolean;
  outcomes: Record<string, EodOutcome>;
  notes?: string;
  closed_by?: string;
  closed_at?: string;
  closeout_timestamp?: string;
}

export interface Redistribution {
  timestamp: string;
  by: string;
  staff_id: string;
  staff_name: string;
  from: string;
  to: string;
  reason?: string;
}

export interface ComplianceCheck {
  timestamp: string;
  by: string;
  result: "good_to_go" | "issues";
  issueCount: number;
}

export interface Shift {
  id: string;
  date: string;
  side: ShiftSide;
  generated_by: string;
  generated_at: string;
  entries: BoardEntry[];
  logs: Array<BoardEntry & { timestamp: string }>;
  deficiencies: Deficiency[];
  closed_assignments: string[];
  closed_assignments_ids: string[];
  combined_pairs: CombinedPair[];
  redistributions: Redistribution[];
  eod: EodRecord | null;
  futurePending?: boolean;
  complianceChecks: ComplianceCheck[];
  mid_shift_closed_ids?: string[];
  manual_entry?: boolean;
  justification?: string;
}

export interface UserAccount {
  id: string;
  username: string;
  name: string;
  role: UserRole;
}

export interface SessionUser extends UserAccount {}

export interface GenerateRequest {
  date: string;
  side: ShiftSide;
  boardStaff: BoardStaffInput[];
  closedIds: string[];
  combinedPairs: CombinedPair[];
}

export interface DashboardStats {
  openShifts: number;
  pendingBoards: number;
  criticalCount: number;
  reviewCount: number;
  activeStaff: number;
  rotationMonth: string;
}
