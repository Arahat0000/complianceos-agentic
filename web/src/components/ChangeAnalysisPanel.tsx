import { useEffect, useState } from "react";
import { Loader2, Plus, Minus, Pencil, ShieldAlert, GitCompare } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import {
  analyzeChange,
  DEMO_CHANGE,
  fetchChanges,
  type ChangeAnalysis,
  type ChangeItem,
  type ModifiedItem,
} from "@/lib/changes";

/** "What changed" for a circular that amends/supersedes an earlier one. */
export function ChangeAnalysisPanel({ circularId }: { circularId: string }) {
  const { isDemo } = useAuth();
  const [change, setChange] = useState<ChangeAnalysis | null>(isDemo ? DEMO_CHANGE : null);
  const [loading, setLoading] = useState(!isDemo);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (isDemo) return;
    let live = true;
    fetchChanges(circularId)
      .then((rows) => live && setChange(rows[0] ?? null))
      .catch(() => live && setChange(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [isDemo, circularId]);

  const run = async () => {
    setRunning(true);
    try {
      setChange(await analyzeChange(circularId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Change analysis failed");
    } finally {
      setRunning(false);
    }
  };

  const added = (change?.added ?? []) as ChangeItem[];
  const removed = (change?.removed ?? []) as ChangeItem[];
  const modified = (change?.modified ?? []) as ModifiedItem[];
  const controls = change?.impactedControlIds ?? [];

  return (
    <Card className="border shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <GitCompare className="h-4 w-4 text-muted-foreground" />
          What changed
          {change?.method && (
            <Badge variant="outline" className="text-[10px] font-normal">
              {change.method === "AI" ? "AI analysis" : "Text match only"}
            </Badge>
          )}
        </div>
        {!isDemo && (
          <Button size="sm" variant="outline" onClick={run} disabled={running}>
            {running && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {change ? "Re-analyze" : "Analyze changes"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !change ? (
          <p className="text-muted-foreground">
            No change analysis yet. Analyze this circular against the version it supersedes.
          </p>
        ) : (
          <>
            {change.summary && <p className="text-muted-foreground">{change.summary.replace(/^\[AI\]\s*/, "")}</p>}
            <Section icon={<Plus className="h-3.5 w-3.5 text-emerald-600" />} title="Added" count={added.length}>
              {added.map((a, i) => (
                <li key={i}>
                  {a.requirementText}
                  {a.reason && <span className="block text-xs text-muted-foreground">{a.reason}</span>}
                </li>
              ))}
            </Section>
            <Section icon={<Minus className="h-3.5 w-3.5 text-rose-600" />} title="Removed" count={removed.length}>
              {removed.map((r, i) => (
                <li key={i}>
                  {r.requirementText}
                  {r.reason && <span className="block text-xs text-muted-foreground">{r.reason}</span>}
                </li>
              ))}
            </Section>
            <Section icon={<Pencil className="h-3.5 w-3.5 text-amber-600" />} title="Modified" count={modified.length}>
              {modified.map((m, i) => (
                <li key={i} className="space-y-0.5">
                  <span className="block line-through text-muted-foreground">{m.before}</span>
                  <span className="block">{m.after}</span>
                  <span className="block text-xs text-muted-foreground">{m.change}</span>
                  {m.quote && <span className="block text-xs italic text-muted-foreground">“{m.quote}”</span>}
                </li>
              ))}
            </Section>
            {(controls.length > 0 || (change.reopenableGapIds?.length ?? 0) > 0) && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                <div className="flex items-center gap-1.5 font-medium">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Impacted controls ({controls.length})
                </div>
                {controls.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {controls.map((c) => (
                      <Badge key={c} variant="outline" className="text-xs font-normal">
                        {c}
                      </Badge>
                    ))}
                  </div>
                )}
                {(change.reopenableGapIds?.length ?? 0) > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {change.reopenableGapIds!.length} resolved gap(s) may need to reopen.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 font-medium">
        {icon}
        {title} ({count})
      </div>
      <ul className="list-disc space-y-1.5 pl-5">{children}</ul>
    </div>
  );
}
