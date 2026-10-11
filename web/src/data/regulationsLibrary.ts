import { getAllRbiCircularsForList } from "@/data/rbiMasterDirectionsIndexed";
import { getAllSebiCircularsForList } from "@/data/sebiMasterCirculars";
import { getAllPendingCircularsForList } from "@/data/pendingCirculars";

export interface LibraryItem {
  id: string;
  circularId: string;
  name: string;
  body: "RBI" | "SEBI" | "Other";
  category: "Cybersecurity" | "Compliance" | "Audit" | "Reporting" | "Operations";
  dateOfIssue: string;
  status: "Active" | "Superseded" | "Draft";
  tags: string[];
  link?: string;
  /** True once this circular has controls extracted from it (AI indexing complete). */
  aiIndexComplete: boolean;
}

function buildRegulationsLibrary(): LibraryItem[] {
  const rbiCirculars: LibraryItem[] = getAllRbiCircularsForList().map((c) => ({
    id: c.id,
    circularId: c.circularId,
    name: c.name,
    body: c.body as "RBI",
    category: c.category as LibraryItem["category"],
    dateOfIssue: c.dateOfIssue,
    status: c.status as LibraryItem["status"],
    tags: c.tags,
    link: c.link,
    aiIndexComplete: c.aiIndexComplete,
  }));

  const sebiCirculars: LibraryItem[] = getAllSebiCircularsForList().map((c) => ({
    id: c.id,
    circularId: c.circularId,
    name: c.name,
    body: "SEBI",
    category: c.category as LibraryItem["category"],
    dateOfIssue: c.dateOfIssue,
    status: c.status as LibraryItem["status"],
    tags: c.tags,
    link: c.link,
    aiIndexComplete: c.aiIndexComplete,
  }));

  const pendingCirculars: LibraryItem[] = getAllPendingCircularsForList().map((c) => ({
    id: c.id,
    circularId: c.circularId,
    name: c.name,
    body: c.body as "RBI" | "SEBI",
    category: c.category as LibraryItem["category"],
    dateOfIssue: c.dateOfIssue,
    status: c.status as LibraryItem["status"],
    tags: c.tags,
    link: c.link,
    aiIndexComplete: c.aiIndexComplete,
  }));

  return [...rbiCirculars, ...sebiCirculars, ...pendingCirculars];
}

export const DEMO_REGULATIONS_LIBRARY: LibraryItem[] = buildRegulationsLibrary();
