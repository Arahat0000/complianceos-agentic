import type { CircularDetailData } from "@/data/rbiMasterDirectionsIndexed";
import {
  getAiRecommendationsFor,
  getExistingControlsFor,
  getQuestionsWithControlLinks,
  isIndexComplete,
} from "@/data/circularControlsAndQuestions";

/** Row format: [dateOfIssue, name, link] */
type SebiCircularRow = readonly [string, string, string];

function getCategoryFromTitle(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("cyber") || t.includes("digital payment") || t.includes("aml") || t.includes("anti-money")) return "Cybersecurity";
  if (t.includes("governance") || t.includes("listing") || t.includes("disclosure") || t.includes("mii")) return "Compliance";
  if (t.includes("mutual fund") || t.includes("reporting") || t.includes("financial")) return "Reporting";
  if (t.includes("broker") || t.includes("depository") || t.includes("exchange")) return "Operations";
  return "Compliance";
}

/**
 * SEBI Master Circulars (AI-Indexed)
 * A copy of sebiMasterCirculars.ts filtered to include ONLY the master circulars where AI indexing is complete.
 */
const SEBI_CIRCULAR_ROWS: SebiCircularRow[] = [
  // sebi-1 (legacy sebi-33) · Master Circular for Stock Brokers
  [
    "May 22, 2024",
    "Master Circular for Stock Brokers",
    "https://www.sebi.gov.in/legal/master-circulars/may-2024/master-circular-for-stock-brokers_83521.html"
  ],
  // sebi-2 (legacy sebi-26) · Master Circular for Mutual Funds
  [
    "Jun 27, 2024",
    "Master Circular for Mutual Funds",
    "https://www.sebi.gov.in/legal/master-circulars/jun-2024/master-circular-for-mutual-funds_84441.html"
  ],
  // sebi-3 (legacy sebi-7) · Strengthening Governance of Market Infrastructure Institutions (MIIs)
  [
    "Dec 12, 2025",
    "Provisions relating to Strengthening Governance of Market Infrastructure Institutions (MIIs)",
    "https://www.sebi.gov.in/legal/circulars/dec-2025/provisions-relating-to-strengthening-governance-of-market-infrastructure-institutions-miis-_98329.html"
  ],
];

function buildSebiCircularsList(): CircularDetailData[] {
  return SEBI_CIRCULAR_ROWS.map((row, index) => {
    const id = `sebi-${index + 1}`;
    const [dateOfIssue, name, link] = row;
    const linkRef = `sebi-${index + 1}`;
    const category = getCategoryFromTitle(name);
    const circularId = `SEBI/HO/MIRSD/${String(index + 1).padStart(3, "0")}`;
    return {
      id,
      circularId,
      name,
      body: "SEBI",
      category,
      description: `SEBI Master Circular: ${name}. Issued by the Securities and Exchange Board of India.`,
      tags: ["SEBI", category, dateOfIssue.split(",")[1]?.trim() || "Master Circular"],
      dateOfIssue,
      status: "Active",
      version: "1.0",
      link,
      linkRef,
      aiRecommendations: getAiRecommendationsFor("SEBI", undefined, id),
      existingControls: getExistingControlsFor("SEBI", undefined, id),
      questions: getQuestionsWithControlLinks("SEBI", undefined, id),
      aiIndexComplete: isIndexComplete(id),
    };
  });
}

const SEBI_CIRCULARS_LIST = buildSebiCircularsList();

export function getSebiCircularById(id: string): CircularDetailData | undefined {
  // If explicitly not a SEBI ID, let other lookups handle it
  if (id && !id.startsWith("sebi")) {
    return undefined;
  }

  // Handle legacy unindexed SEBI indices
  if (id === "sebi-33") return SEBI_CIRCULARS_LIST.find((c) => c.name.includes("Stock Brokers")) ?? SEBI_CIRCULARS_LIST[0];
  if (id === "sebi-26") return SEBI_CIRCULARS_LIST.find((c) => c.name.includes("Mutual Funds")) ?? SEBI_CIRCULARS_LIST[1];
  if (id === "sebi-7") return SEBI_CIRCULARS_LIST.find((c) => c.name.includes("Market Infrastructure")) ?? SEBI_CIRCULARS_LIST[2];

  return (
    SEBI_CIRCULARS_LIST.find((c) => c.id === id || c.linkRef === id) ??
    SEBI_CIRCULARS_LIST[0]
  );
}

export function getAllSebiCircularsForList(): CircularDetailData[] {
  return SEBI_CIRCULARS_LIST;
}
