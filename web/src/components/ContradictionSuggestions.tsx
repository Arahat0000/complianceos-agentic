import { useEffect, useState } from "react";
import { Sparkles, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DEMO_AI_SUGGESTIONS,
  detectContradictionsWithAI,
  fetchContradictions,
  reviewContradiction,
  type ContradictionDto,
} from "@/lib/contradictions";

const isDemo = () => !import.meta.env.VITE_API_URL || !window.localStorage.getItem("auth_token");

export function ContradictionSuggestions() {
  const [items, setItems] = useState<ContradictionDto[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (isDemo()) return;
    try {
      const all = await fetchContradictions();
      setItems(all.filter((c) => c.source === "AI" && c.reviewStatus === "SUGGESTED"));
    } catch {
      /* backend unavailable: leave list as is */
    }
  };
  useEffect(() => {
    if (isDemo()) return;
    let live = true;
    fetchContradictions()
      .then((all) => {
        if (live) setItems(all.filter((c) => c.source === "AI" && c.reviewStatus === "SUGGESTED"));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const detect = async () => {
    setBusy(true);
    try {
      if (isDemo()) {
        setItems(DEMO_AI_SUGGESTIONS);
        toast.success("Demo: 1 AI suggestion found");
        return;
      }
      const s = await detectContradictionsWithAI();
      toast.success(`${s.pairsExamined} pairs examined, ${s.proposed} proposed, ${s.dropped} dropped`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Detection failed");
    } finally {
      setBusy(false);
    }
  };

  const review = async (c: ContradictionDto, decision: "CONFIRMED" | "REJECTED") => {
    if (!isDemo()) {
      try {
        await reviewContradiction(c.id, decision, decision === "CONFIRMED");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Review failed");
        return;
      }
    }
    setItems((prev) => prev.filter((x) => x.id !== c.id));
    toast.success(decision === "CONFIRMED" ? "Contradiction confirmed" : "Suggestion rejected");
  };

  return (
    <div className="mt-3 rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">AI-detected contradictions</span>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={detect} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-2" />}
          Detect with AI
        </Button>
      </div>
      {items.map((c) => (
        <div key={c.id} className="rounded-md border border-border p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px] gap-1"><Sparkles className="h-3 w-3" />AI</Badge>
            <span className="text-xs font-semibold">{c.title}</span>
            {c.confidence != null && (
              <Badge variant="outline" className="text-[10px]">{Math.round(c.confidence * 100)}% confidence</Badge>
            )}
          </div>
          {c.description && <p className="text-[11px] text-muted-foreground">{c.description}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {c.parties.map((p) => (
              <blockquote key={p.id} className="text-[11px] border-l-2 border-border pl-2">
                <div className="font-semibold">{p.regulator}{p.clause ? ` - ${p.clause}` : ""}</div>
                {p.sourceQuote ?? <em className="text-muted-foreground">Quote could not be verified</em>}
              </blockquote>
            ))}
          </div>
          {c.strictestCommonDenominator && (
            <p className="text-[11px]"><strong>Strictest rule:</strong> {c.strictestCommonDenominator}</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={() => review(c, "CONFIRMED")}>
              <Check className="h-3 w-3 mr-1" />Confirm
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => review(c, "REJECTED")}>
              <X className="h-3 w-3 mr-1" />Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
