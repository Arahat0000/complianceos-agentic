import type {
  Evidence,
  MonitoringKpi,
  TraceabilityLink,
  TraceabilitySignoff,
} from "@complianceos/shared";
import { apiFetch } from "@/lib/api";
import type { TraceabilityNode } from "@/data/traceabilityData";

// Enriched chain as returned by GET /traceability (see server traceabilityService).
interface BackendTraceTest {
  id: string;
  controlId: string;
  testType: string;
  frequency: string | null;
  lastTestedAt: string | null;
  lastResult: string | null;
  lastNotes: string | null;
  lastTestedByName: string | null;
}

export type BackendTraceabilityChain = TraceabilityLink & {
  evidence: Evidence[];
  tests: BackendTraceTest[];
  kpis: MonitoringKpi[];
  latestSignoff: TraceabilitySignoff | null;
};

/** A UI node plus the backend signoff state for the chain. */
type TraceEvidenceItem = TraceabilityNode["evidence"];
type TraceTestItem = TraceabilityNode["testing"];
type TraceKpiItem = TraceabilityNode["monitoring"];

export type MappedTraceabilityNode = TraceabilityNode & {
  /** All one-to-many items (real mode only); the singular fields hold the summary entry. */
  evidenceItems?: TraceEvidenceItem[];
  testItems?: TraceTestItem[];
  kpiItems?: TraceKpiItem[];
  signoff: { signedAt: string; contentHash: string | null; signedRole: string | null } | null;
};

const chainKey = (obligationId: string, controlId: string) =>
  `${obligationId}__${controlId}`;

export function parseChainKey(id: string): { obligationId: string; controlId: string } | null {
  const i = id.indexOf("__");
  if (i <= 0 || i >= id.length - 2) return null;
  return { obligationId: id.slice(0, i), controlId: id.slice(i + 2) };
}

export function fetchTraceability(opts: { regulator?: string; gapOnly?: boolean } = {}) {
  const q = new URLSearchParams();
  if (opts.regulator) q.set("regulator", opts.regulator);
  if (opts.gapOnly) q.set("gapOnly", "true");
  const qs = q.toString();
  return apiFetch<BackendTraceabilityChain[]>(`/traceability${qs ? `?${qs}` : ""}`);
}

export function fetchTraceabilityChain(obligationId: string, controlId: string) {
  return apiFetch<BackendTraceabilityChain>(
    `/traceability/${encodeURIComponent(obligationId)}/${encodeURIComponent(controlId)}`,
  );
}

export function signoffTraceability(obligationId: string, controlId: string, signedRole = "CCO") {
  return apiFetch<TraceabilitySignoff>(
    `/traceability/${encodeURIComponent(obligationId)}/${encodeURIComponent(controlId)}/signoff`,
    { method: "POST", body: JSON.stringify({ signedRole }) },
  );
}

export interface TraceabilityVerification {
  signed: boolean;
  verified: boolean;
  signedAt: string | null;
  signedRole: string | null;
  signedByName: string | null;
  storedHash: string | null;
  currentHash: string;
}

export function fetchTraceabilityVerification(obligationId: string, controlId: string) {
  return apiFetch<TraceabilityVerification>(
    `/traceability/${encodeURIComponent(obligationId)}/${encodeURIComponent(controlId)}/verify`,
  );
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "N/A";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

const HEALTH_RANK = { BREACHED: 2, WARNING: 1, HEALTHY: 0 } as const;
const TEST_RANK: Record<string, number> = { FAILED: 2, DEFICIENT: 1, PASSED: 0 };

type Regulator = TraceabilityNode["regulation"]["regulator"];
function mapRegulator(r: string): Regulator {
  if (r === "CERT_IN") return "CERT-In";
  if (r === "RBI" || r === "SEBI" || r === "DPDP") return r;
  return "RBI"; // "OTHER" has no UI equivalent
}

type ObType = TraceabilityNode["obligation"]["type"];
function mapObType(t: string): ObType {
  if (t === "REPORTING" || t === "CONTROL" || t === "GOVERNANCE" || t === "OPERATIONAL" || t === "AUDIT") return t;
  return "CONTROL"; // DISCLOSURE / RECORD_KEEPING / OTHER have no UI equivalent
}

/**
 * Backend chain -> page TraceabilityNode.
 * Fields with no backing column (placeholders): regulation.reference (uses circularCode),
 * testing.id when no test exists, monitoring when no KPI exists.
 * The singular evidence/testing/monitoring fields hold the worst/most relevant entry;
 * evidenceItems/testItems/kpiItems carry every item.
 */
export function mapChain(c: BackendTraceabilityChain): MappedTraceabilityNode {
  const ev = c.evidence.find((e) => e.status !== "VERIFIED") ?? c.evidence[0];
  const test = [...c.tests].sort(
    (a, b) => (TEST_RANK[b.lastResult ?? ""] ?? -1) - (TEST_RANK[a.lastResult ?? ""] ?? -1),
  )[0];
  const kpi = [...c.kpis].sort((a, b) => HEALTH_RANK[b.health] - HEALTH_RANK[a.health])[0];
  const hasGap = !!c.gapId;
  const mapEv = (e: Evidence): TraceEvidenceItem => ({
    id: e.id,
    name: e.name,
    documentType: e.documentType ?? "Document",
    status: e.status,
    lastAuditDate: fmtDate(e.lastAuditDate),
    fileUrl: e.fileUrl ?? undefined,
  });
  const mapTest = (t: BackendTraceTest): TraceTestItem => ({
    id: t.id,
    testType: t.testType as TraceTestItem["testType"],
    frequency: t.frequency ?? "Ad hoc",
    lastTested: fmtDate(t.lastTestedAt),
    result: (t.lastResult ?? "DEFICIENT") as TraceTestItem["result"],
  });
  const mapKpi = (k: MonitoringKpi): TraceKpiItem => ({
    kpi: k.kpi,
    currentValue: k.currentValue ?? "N/A",
    threshold: k.threshold ?? "N/A",
    health: k.health,
    telemetrySource: k.telemetrySource ?? "N/A",
  });
  const openedMs = c.gapOpenedAt ? new Date(c.gapOpenedAt).getTime() : NaN;

  const remStatus = c.remediationStatus;
  return {
    id: chainKey(c.obligationId, c.controlId),
    regulation: {
      id: c.circularRowId,
      title: c.circularName,
      regulator: mapRegulator(c.regulator),
      reference: c.circularCode,
      date: fmtDate(c.dateOfIssue),
      sourceSection: c.sourceSection ?? "N/A",
      sourceQuote: c.sourceQuote,
    },
    obligation: {
      id: c.obligationIdentifier ?? c.obligationId,
      type: mapObType(c.obligationType),
      text: c.requirementText,
      deadline: c.deadline ?? undefined,
      penalty: c.penalty ?? undefined,
      confidence: c.confidence ?? 0,
    },
    applicability: {
      entities: c.applicableEntities ?? [],
      criteria: c.applicabilityCriteria ?? "Not specified",
      status: c.applicabilityStatus ?? "APPLICABLE",
    },
    control: {
      id: c.controlId,
      name: c.controlTitle,
      framework: c.framework ?? "N/A",
      owner: c.controlOwner ?? "Unassigned",
      implementationStatus: c.implementationStatus ?? "NOT_IMPLEMENTED",
    },
    evidenceItems: c.evidence.map(mapEv),
    testItems: c.tests.map(mapTest),
    kpiItems: c.kpis.map(mapKpi),
    evidence: ev
      ? mapEv(ev)
      : { id: "N/A", name: "No evidence on file", documentType: "N/A", status: "MISSING", lastAuditDate: "N/A" },
    testing: test
      ? mapTest(test)
      : { id: "N/A", testType: "MANUAL_INSPECTION", frequency: "Not scheduled", lastTested: "Never", result: "DEFICIENT" },
    gap: hasGap
      ? {
          id: c.gapIdentifier ?? c.gapId!,
          title: c.gapTitle ?? `Gap ${c.gapIdentifier ?? ""} on ${c.controlTitle}`.replace("  ", " "),
          riskLevel: c.gapRiskLevel ?? undefined,
          status: c.gapStatus === "REMEDIATING" ? "IN_PROGRESS" : (c.gapStatus ?? "OPEN"),
          openedDaysAgo: Number.isNaN(openedMs) ? undefined : Math.max(0, Math.floor((Date.now() - openedMs) / 86_400_000)),
        }
      : {},
    remediation: c.workOrderId || remStatus
      ? {
          workOrderId: c.workOrderId ?? undefined,
          leadTeam: c.remediationLeadTeam ?? undefined,
          slaDays: c.remediationSlaDays ?? undefined,
          actionSummary: c.remediationActionSummary ?? undefined,
          status: remStatus ?? "NONE",
        }
      : { status: "NONE" },
    monitoring: kpi
      ? mapKpi(kpi)
      : { kpi: "No KPI configured", currentValue: "N/A", threshold: "N/A", health: "HEALTHY", telemetrySource: "N/A" },
    signoff: c.latestSignoff
      ? {
          signedAt: c.latestSignoff.signedAt,
          contentHash: c.latestSignoff.contentHash,
          signedRole: c.latestSignoff.signedRole,
        }
      : null,
  };
}
