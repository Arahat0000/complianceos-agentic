import type { ItemReviewStatus } from "@complianceos/shared";

/** Fetch a page image with the bearer token and return a blob (or absolute) URL. */
export async function fetchPageImageUrl(fileId: string, page: number): Promise<string> {
  const token = window.localStorage.getItem("auth_token");
  const res = await fetch(`${import.meta.env.VITE_API_URL}/ingestion/files/${fileId}/pages/${page}/image`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Page image request failed (${res.status})`);
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = (await res.json()) as { url?: string };
    if (!body.url) throw new Error("No image URL returned");
    return body.url;
  }
  return URL.createObjectURL(await res.blob());
}

 export function statusTone(s: ItemReviewStatus): { label: string; badge: string; stroke: string; fill: string } {
  switch (s) {
    case "AGREED":
      return { label: "Agreed", badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", stroke: "#10b981", fill: "rgba(16,185,129,0.10)" };
    case "ACCEPTED":
    case "CORRECTED":
      return { label: s === "ACCEPTED" ? "Accepted" : "Corrected", badge: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400", stroke: "#3b82f6", fill: "rgba(59,130,246,0.10)" };
    case "REJECTED":
      return { label: "Rejected", badge: "border-zinc-400/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400", stroke: "#71717a", fill: "rgba(113,113,122,0.10)" };
    case "DISPUTED":
      return { label: "Disputed", badge: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400", stroke: "#ef4444", fill: "rgba(239,68,68,0.12)" };
    default:
      return { label: "Needs review", badge: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400", stroke: "#f59e0b", fill: "rgba(245,158,11,0.12)" };
  }
}

