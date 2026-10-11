export interface AgentScanStage {
  tool: string;
  args: string;
  target: string;
  title: string;
  detail: string;
}

/**
 * Autonomous 4-stage pipeline for scanning official gazettes & regulatory portals.
 */
export const AGENT_STAGES: AgentScanStage[] = [
  {
    tool: "scan_website",
    args: '{ url: "rbi.org.in/master-directions" }',
    target: "rbi.org.in & sebi.gov.in",
    title: "Scanning official gazettes & regulatory portals for updates",
    detail: "Crawling latest master circulars, directions, and notifications across RBI Banking & SEBI Intermediary gazettes.",
  },
  {
    tool: "diff_gazettes",
    args: '{ index_count: 5, baseline: "indexed" }',
    target: "226 RBI · 132 SEBI",
    title: "Diffing newly detected documents against library index",
    detail: "Comparing regulatory IDs and timestamps against active AI-indexed baseline directions.",
  },
  {
    tool: "extract_obligations",
    args: '{ model: "compliance-extractor-v2" }',
    target: "gemini-1.5-pro",
    title: "Parsing regulatory text & extracting compliance mandates",
    detail: "Classifying operational requirements, mandatory audit cadences, and penalty provisions.",
  },
  {
    tool: "map_controls",
    args: '{ framework: "internal_policy_map" }',
    target: "Controls Engine",
    title: "Correlating obligations to controls & gap remediation tracker",
    detail: "All active circulars mapped and in sync. Zero pending regulatory drift.",
  },
];
