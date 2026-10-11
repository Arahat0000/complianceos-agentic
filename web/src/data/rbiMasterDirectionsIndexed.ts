/**
 * RBI Master Directions (AI-Indexed)
 * A copy of rbiMasterDirections.ts filtered to include ONLY the regulations where AI indexing is complete.
 * Format: [applicableTo, categoryCode, topic, dateOfIssue, lastUpdated, linkRef]
 */
type RbiMasterDirectionRow = readonly [string, string, string, string, string, string];

// =============================================================================
// CATEGORY CODES
// =============================================================================
// cb   → Commercial Banks (incl. Foreign Banks, Universal Banks)
// nbfc → Non-Banking Financial Companies

// =============================================================================
// AI-INDEXED RBI MASTER DIRECTIONS ROWS
// =============================================================================

const RBI_MASTER_DIRECTIONS_ROWS: RbiMasterDirectionRow[] = [
  // Commercial Banking (rbi.org.in id=12562) · Master Direction on IT Governance, Risk, Controls and Assurance Practices
  ["Commercial Banking", "cb", "Master Direction on Information Technology Governance, Risk, Controls and Assurance Practices", "Nov 07, 2023", "", "12562"],

  // Non-Banking Financial Companies (rbi.org.in id=10999) · Master Direction - IT Framework for the NBFC Sector
  ["Non-Banking", "nbfc", "Master Direction - Information Technology Framework for the NBFC Sector", "Jun 08, 2017", "", "10999"],
];

import type { AssessmentQuestion } from "@/data/circularControlsAndQuestions";
import {
  getAiRecommendationsFor,
  getExistingControlsFor,
  getQuestionsWithControlLinks,
  isIndexComplete,
} from "@/data/circularControlsAndQuestions";

export interface CircularDetailData {
  id: string;
  circularId: string;
  name: string;
  body: string;
  category: string;
  description: string;
  tags: string[];
  dateOfIssue: string;
  status: string;
  version: string;
  link: string;
  /** Unique ref for this circular's URL (used in link query params, not the same as id). */
  linkRef: string;
  applicableTo?: string;
  lastUpdated?: string;
  aiRecommendations: { id: string; title: string; description: string; relevance: string; category: string }[];
  existingControls: { id: string; name: string; framework: string; status: string }[];
  /** Assessment questions linked to this circular (from data). Shown on Control Questions tab. */
  questions?: AssessmentQuestion[];
  /** True once this circular has hand-curated (not generic placeholder) AI recommendations/controls. */
  aiIndexComplete: boolean;
}

function getCategoryLabel(topic: string): string {
  const t = topic.toLowerCase();
  if (t.includes("it ") || t.includes("digital payment") || t.includes("cyber")) return "Cybersecurity";
  if (t.includes("governance") || t.includes("fraud")) return "Compliance";
  if (t.includes("reporting") || t.includes("returns") || t.includes("financial statements")) return "Reporting";
  if (t.includes("branch") || t.includes("outsourcing") || t.includes("authorisation")) return "Operations";
  return "Compliance";
}

function buildRbiCircularsList(): CircularDetailData[] {
  return RBI_MASTER_DIRECTIONS_ROWS.map((row, index) => {
    const id = String(index + 1);
    const [applicableTo, categoryCode, topic, dateOfIssue, lastUpdated, linkRef] = row;
    const name = topic;
    const circularId = `RBI/MD/${categoryCode}/${id}`;
    const category = getCategoryLabel(topic);
    const description = `RBI Master Direction applicable to ${applicableTo}: ${topic}. Issued by the Reserve Bank of India.${lastUpdated ? ` Last updated: ${lastUpdated}.` : ""}`;
    const tags = [applicableTo, "RBI", category];
    return {
      id,
      circularId,
      name,
      body: "RBI",
      category,
      description,
      tags,
      dateOfIssue,
      status: "Active",
      version: "1.0",
      link: `https://rbi.org.in/scripts/bs_viewmasterdirections.aspx?id=${linkRef}`,
      linkRef,
      applicableTo,
      lastUpdated: lastUpdated || undefined,
      aiRecommendations: getAiRecommendationsFor("RBI", categoryCode, linkRef),
      existingControls: getExistingControlsFor("RBI", categoryCode, linkRef),
      questions: getQuestionsWithControlLinks("RBI", categoryCode, linkRef),
      aiIndexComplete: isIndexComplete(linkRef),
    };
  });
}

const RBI_CIRCULARS_LIST = buildRbiCircularsList();

export function getRbiCircularById(id: string): CircularDetailData | undefined {
  if (id.startsWith("sebi-") || id.startsWith("sebi")) {
    return undefined;
  }
  // Support legacy id "211" which corresponds to NBFC IT Framework (linkRef 10999)
  if (id === "211") {
    return (
      RBI_CIRCULARS_LIST.find((c) => c.linkRef === "10999") ??
      RBI_CIRCULARS_LIST[0]
    );
  }
  return (
    RBI_CIRCULARS_LIST.find((c) => c.id === id || c.linkRef === id) ??
    RBI_CIRCULARS_LIST[0]
  );
}

export function getAllRbiCircularsForList(): CircularDetailData[] {
  return RBI_CIRCULARS_LIST;
}
