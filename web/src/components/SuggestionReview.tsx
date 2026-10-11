import { useCallback, useEffect, useState } from "react";
import { Check, ClipboardCheck, Link2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  assessApplicability,
  fetchApplicability,
  reviewApplicability,
  type ObligationApplicability,
} from "@/lib/applicability";
import { fetchMappings, reviewMapping, suggestMappings, type ObligationControl } from "@/lib/mapping";
import { fetchControls } from "@/lib/controls";

type Review = "CONFIRMED" | "REJECTED";

// Curated demo suggestions, derived deterministically from the obligation id.
function demoApplicability(obligationId: string): ObligationApplicability {
  const n = [...obligationId].reduce((a, c) => a + c.charCodeAt(0), 0);
  const statuses = ["APPLICABLE", "APPLICABLE", "CONDITIONAL", "EXEMPT"] as const;
  const status = statuses[n % statuses.length];
  const why = {
    APPLICABLE: 'Profile: entityType "NBFC-Upper Layer"; the clause applies to all NBFCs.',
    CONDITIONAL: "Applies only above the asset-size threshold; the profile does not state the threshold band.",
    EXEMPT: 'Profile: regulators ["RBI"]; this clause is addressed to SEBI-registered intermediaries.',
  }[status];
  return {
    obligationId,
    entities: null,
    criteria: null,
    status,
    rationale: why,
    source: "AI",
    confidence: status === "CONDITIONAL" ? 0.62 : 0.9,
    reviewStatus: "SUGGESTED",
  };
}

function AiBadge() {
  return (
    <Badge variant="outline" className="gap-1 border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-400">
      <Sparkles className="h-3 w-3" /> AI
    </Badge>
  );
}

function ReviewButtons({ onReview }: { onReview: (s: Review) => void }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" onClick={() => onReview("CONFIRMED")} aria-label="Accept">
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:bg-muted" onClick={() => onReview("REJECTED")} aria-label="Reject">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

const pct = (c: number | null) => (c === null ? "" : `${Math.round(c * 100)}% confidence`);

/** Per-circular action buttons: run the mapping / applicability agents. */
export function SuggestionBar({
  circularId,
  isDemo,
  onDone,
}: {
  circularId: string;
  isDemo: boolean;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState<"map" | "app" | null>(null);
  const [gaps, setGaps] = useState<string[]>([]);

  const run = async (kind: "map" | "app") => {
    setBusy(kind);
    try {
      if (isDemo) {
        await new Promise((r) => setTimeout(r, 900));
        toast.success(kind === "map" ? "Proposed mappings (demo)." : "Assessed applicability (demo).");
      } else if (kind === "map") {
        const s = await suggestMappings({ circularId });
        setGaps(s.coverageGaps.map((g) => g.identifier ?? g.obligationId));
        toast.success(`${s.proposed} mapping(s) proposed, ${s.coverageGaps.length} coverage gap(s), ${s.failed} failed.`);
      } else {
        const s = await assessApplicability({ circularId });
        toast.success(`${s.proposed} assessed, ${s.skipped} skipped, ${s.failed} failed.`);
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-10 gap-1.5" disabled={busy !== null} onClick={() => run("app")}>
          <ClipboardCheck className="h-4 w-4" />
          {busy === "app" ? "Assessing…" : "Assess applicability"}
        </Button>
        <Button variant="outline" className="h-10 gap-1.5" disabled={busy !== null} onClick={() => run("map")}>
          <Link2 className="h-4 w-4" />
          {busy === "map" ? "Suggesting…" : "Suggest mappings"}
        </Button>
      </div>
      {gaps.length > 0 && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          Coverage gap (no plausible control): {gaps.join(", ")}
        </p>
      )}
    </div>
  );
}

/** Suggested applicability + control mappings for one obligation, with accept/reject. */
export function ObligationSuggestions({
  obligationId,
  isDemo,
  refreshKey,
}: {
  obligationId: string;
  isDemo: boolean;
  refreshKey: number;
}) {
  const [app, setApp] = useState<ObligationApplicability | null>(null);
  const [maps, setMaps] = useState<ObligationControl[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (isDemo) {
      setApp(refreshKey > 0 ? demoApplicability(obligationId) : null);
      return;
    }
    try {
      const [a, m, c] = await Promise.all([
        fetchApplicability({ obligationId }),
        fetchMappings({ obligationId }),
        fetchControls(),
      ]);
      setApp(a[0] ?? null);
      setMaps(m.filter((x) => x.mappingSource === "AI" && x.reviewStatus !== "REJECTED"));
      setTitles(Object.fromEntries(c.map((x) => [x.id, x.title])));
    } catch {
      /* suggestions are optional; the page works without them */
    }
  }, [isDemo, obligationId, refreshKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const reviewApp = async (s: Review) => {
    try {
      if (!isDemo) await reviewApplicability(obligationId, s);
      setApp((prev) => (prev ? (s === "REJECTED" ? null : { ...prev, reviewStatus: s }) : prev));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Review failed");
    }
  };

  const reviewMap = async (controlId: string, s: Review) => {
    try {
      await reviewMapping(obligationId, controlId, s);
      setMaps((prev) =>
        s === "REJECTED"
          ? prev.filter((m) => m.controlId !== controlId)
          : prev.map((m) => (m.controlId === controlId ? { ...m, reviewStatus: s } : m)),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Review failed");
    }
  };

  if (!app && maps.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border bg-violet-50/30 p-3 dark:bg-violet-500/5">
      {app && (
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <AiBadge />
              <span className="font-medium">Applicability: {app.status}</span>
              <span className="text-muted-foreground">{pct(app.confidence)}</span>
              {app.reviewStatus === "CONFIRMED" && <Badge variant="secondary">Confirmed</Badge>}
            </div>
            {app.rationale && <p className="text-muted-foreground">{app.rationale}</p>}
          </div>
          {app.reviewStatus === "SUGGESTED" && <ReviewButtons onReview={reviewApp} />}
        </div>
      )}
      {maps.map((m) => (
        <div key={m.controlId} className="flex items-start justify-between gap-3">
          <div className="space-y-0.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <AiBadge />
              <span className="font-medium">Maps to: {titles[m.controlId] ?? m.controlId}</span>
              <span className="text-muted-foreground">{pct(m.confidence)}</span>
              {m.reviewStatus === "CONFIRMED" && <Badge variant="secondary">Accepted</Badge>}
            </div>
            {m.rationale && <p className="text-muted-foreground">{m.rationale}</p>}
          </div>
          {m.reviewStatus === "SUGGESTED" && <ReviewButtons onReview={(s) => reviewMap(m.controlId, s)} />}
        </div>
      ))}
    </div>
  );
}
