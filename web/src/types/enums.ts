import type {
  RiskLevel as SharedRiskLevel,
  GapStatus as SharedGapStatus,
  ObligationType as SharedObligationType,
  ObligationStatus as SharedObligationStatus,
} from "@complianceos/shared";

export const RiskLevel = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const satisfies Record<SharedRiskLevel, SharedRiskLevel>;
export type RiskLevel = SharedRiskLevel;

export const GapStatus = {
  OPEN: "OPEN",
  REMEDIATING: "REMEDIATING",
  RISK_ACCEPTED: "RISK_ACCEPTED",
  RESOLVED: "RESOLVED",
} as const satisfies Record<SharedGapStatus, SharedGapStatus>;
export type GapStatus = SharedGapStatus;

export const ObligationType = {
  REPORTING: "REPORTING",
  GOVERNANCE: "GOVERNANCE",
  CONTROL: "CONTROL",
  DISCLOSURE: "DISCLOSURE",
  RECORD_KEEPING: "RECORD_KEEPING",
  OPERATIONAL: "OPERATIONAL",
  AUDIT: "AUDIT",
  OTHER: "OTHER",
} as const satisfies Record<SharedObligationType, SharedObligationType>;
export type ObligationType = SharedObligationType;

export const ObligationStatus = {
  EXTRACTED: "EXTRACTED",
  CONFIRMED: "CONFIRMED",
  DISMISSED: "DISMISSED",
} as const satisfies Record<SharedObligationStatus, SharedObligationStatus>;
export type ObligationStatus = SharedObligationStatus;

// UI Display Mappings
export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: "Low",
  [RiskLevel.MEDIUM]: "Medium",
  [RiskLevel.HIGH]: "High",
  [RiskLevel.CRITICAL]: "Critical",
};

export const GAP_STATUS_LABELS: Record<GapStatus, string> = {
  [GapStatus.OPEN]: "Open",
  [GapStatus.REMEDIATING]: "In Remediation",
  [GapStatus.RISK_ACCEPTED]: "Risk Accepted",
  [GapStatus.RESOLVED]: "Resolved",
};

export const OBLIGATION_TYPE_LABELS: Record<ObligationType, string> = {
  [ObligationType.REPORTING]: "Reporting",
  [ObligationType.GOVERNANCE]: "Governance",
  [ObligationType.CONTROL]: "Control",
  [ObligationType.DISCLOSURE]: "Disclosure",
  [ObligationType.RECORD_KEEPING]: "Record-keeping",
  [ObligationType.OPERATIONAL]: "Operational",
  [ObligationType.AUDIT]: "Audit",
  [ObligationType.OTHER]: "Other",
};

export const OBLIGATION_STATUS_LABELS: Record<ObligationStatus, string> = {
  [ObligationStatus.EXTRACTED]: "Extracted",
  [ObligationStatus.CONFIRMED]: "Confirmed",
  [ObligationStatus.DISMISSED]: "Dismissed",
};
