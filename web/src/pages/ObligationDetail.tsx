import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fetchCircular, type BackendCircular } from "@/lib/circulars";
import {
    fetchObligations,
    extractObligations,
    updateObligation,
    type BackendObligation,
} from "@/lib/obligations";
import {
    OBLIGATION_TYPE_LABELS,
    OBLIGATION_STATUS_LABELS,
} from "@/types/enums";
import {
    ArrowLeft,
    Sparkles,
    Quote,
    CalendarClock,
    Gavel,
    ListChecks,
    CheckCircle2,
    XCircle,
    ShieldCheck,
    ShieldQuestion,
    Check,
    X,
} from "lucide-react";
import { GroundingPanel } from "@/components/ingestion/GroundingPanel";
import { DEMO_GROUNDING } from "@/demo/ingestion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "motion/react";
import { pageContainer, pageItem } from "@/lib/animations";
import { useToast } from "@/hooks/use-toast";
import {
    DEMO_CIRCULARS,
    DEMO_OBLIGATIONS_PRELOADED,
    DEMO_OBLIGATIONS_BY_CIRCULAR,
    DEMO_EXTRACTION_RESULT_BY_CIRCULAR,
} from "@/demo/complianceScenario";
import { SuggestionBar, ObligationSuggestions } from "@/components/SuggestionReview";

// ── Config helpers ───────────────────────────────────────────────────────────

const typeColor: Record<string, string> = {
    REPORTING: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-100 dark:border-blue-500/20",
    GOVERNANCE: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 border-violet-100 dark:border-violet-500/20",
    CONTROL: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20",
    DISCLOSURE: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-100 dark:border-amber-500/20",
    RECORD_KEEPING: "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400 border-slate-200 dark:border-slate-500/20",
    AUDIT: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border-rose-100 dark:border-rose-500/20",
    OPERATIONAL: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400 border-cyan-100 dark:border-cyan-500/20",
    OTHER: "bg-muted text-muted-foreground border-border",
};

const statusColor: Record<string, string> = {
    EXTRACTED: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-100 dark:border-amber-500/20",
    CONFIRMED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20",
    DISMISSED: "bg-muted text-muted-foreground border-border",
};

function ObligationCard({
    obligation,
    onUpdate,
    isDemo,
    suggestionKey,
}: {
    isDemo: boolean;
    suggestionKey: number;
    obligation: BackendObligation;
    onUpdate: (id: string, status: BackendObligation["status"]) => void;
}) {
    return (
        <Card className="border-border/60">
            <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">{obligation.identifier}</span>
                        <Badge variant="outline" className={cn("shrink-0", typeColor[obligation.obligationType])}>
                            {OBLIGATION_TYPE_LABELS[obligation.obligationType]}
                        </Badge>
                        <Badge variant="outline" className={cn("shrink-0", statusColor[obligation.status])}>
                            {OBLIGATION_STATUS_LABELS[obligation.status]}
                        </Badge>
                        {obligation.citationVerified ? (
                            <Badge variant="outline" className="gap-1 border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                                <ShieldCheck className="h-3 w-3" /> Citation verified
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="gap-1 border-red-100 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
                                <ShieldQuestion className="h-3 w-3" /> Citation unverified
                            </Badge>
                        )}
                        {obligation.confidence !== null && (
                            <span className="text-[11px] text-muted-foreground">
                                {Math.round(obligation.confidence * 100)}% confidence
                            </span>
                        )}
                    </div>
                    {obligation.status !== "DISMISSED" && obligation.status !== "CONFIRMED" && (
                        <div className="flex items-center gap-1 shrink-0">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" onClick={() => onUpdate(obligation.id, "CONFIRMED")}>
                                <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:bg-muted" onClick={() => onUpdate(obligation.id, "DISMISSED")}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    )}
                </div>

                <p className="text-sm font-medium leading-snug text-foreground">{obligation.requirementText}</p>

                <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {obligation.deadline ?? "No stated deadline"}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Gavel className="h-3.5 w-3.5" />
                        {obligation.penalty ?? "No stated penalty"}
                    </span>
                    {obligation.applicabilityConditions && obligation.applicabilityConditions.length > 0 && (
                        <span className="flex items-center gap-1.5">
                            <ListChecks className="h-3.5 w-3.5" />
                            {obligation.applicabilityConditions.join(", ")}
                        </span>
                    )}
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 p-3">
                    <Quote className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                        <p className="text-xs italic text-foreground/80">&ldquo;{obligation.sourceQuote}&rdquo;</p>
                        {obligation.sourceSection && (
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{obligation.sourceSection}</p>
                        )}
                    </div>
                </div>
                <ObligationSuggestions obligationId={obligation.id} isDemo={isDemo} refreshKey={suggestionKey} />
                {(() => {
                    const g = isDemo && obligation.id === DEMO_GROUNDING.obligationId
                        ? DEMO_GROUNDING
                        : obligation.sourceFileId && obligation.sourcePage
                            ? { sourceFileId: obligation.sourceFileId, sourcePage: obligation.sourcePage, sourceRegion: obligation.sourceRegion }
                            : null;
                    return g ? <GroundingPanel fileId={g.sourceFileId} page={g.sourcePage} region={g.sourceRegion} /> : null;
                })()}
            </CardContent>
        </Card>
    );
}

const ObligationDetail = () => {
    const { circularId } = useParams();
    const navigate = useNavigate();
    const { isDemo } = useAuth();
    const { toast } = useToast();

    const [circular, setCircular] = useState<Pick<BackendCircular, "id" | "name" | "circularId"> | null>(
        isDemo ? (DEMO_CIRCULARS[circularId ?? ""] ?? DEMO_CIRCULARS["211"]) : null,
    );
    const [obligations, setObligations] = useState<BackendObligation[]>(
        isDemo ? (DEMO_OBLIGATIONS_BY_CIRCULAR[circularId ?? ""] ?? []) : [],
    );
    const [isLoading, setIsLoading] = useState(!isDemo);
    const [isExtracting, setIsExtracting] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [suggestionKey, setSuggestionKey] = useState(0);

    // Reset loading/error state during render when the load inputs change
    // (the initial state above already covers the first load).
    const loadKey = `${isDemo}|${circularId ?? ""}`;
    const [prevLoadKey, setPrevLoadKey] = useState(loadKey);
    if (prevLoadKey !== loadKey) {
        setPrevLoadKey(loadKey);
        if (!isDemo && circularId) {
            setIsLoading(true);
            setLoadError(null);
        }
    }

    const load = useCallback(() => {
        if (isDemo || !circularId) return;
        Promise.all([fetchCircular(circularId), fetchObligations(circularId)])
            .then(([c, obls]) => {
                setCircular(c);
                setObligations(obls);
            })
            .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load"))
            .finally(() => setIsLoading(false));
    }, [isDemo, circularId]);

    useEffect(() => {
        load();
    }, [load]);

    const handleExtract = async () => {
        if (!circularId) return;
        setIsExtracting(true);
        setLoadError(null);
        try {
            if (isDemo) {
                await new Promise((resolve) => setTimeout(resolve, 1200));
                const result = DEMO_EXTRACTION_RESULT_BY_CIRCULAR[circularId] ?? DEMO_OBLIGATIONS_PRELOADED;
                setObligations(result);
                toast({ title: "Extraction complete", description: `${result.length} obligations extracted from 1 chunk.` });
            } else {
                const summary = await extractObligations(circularId);
                setObligations(summary.obligations);
                toast({
                    title: "Extraction complete",
                    description: `${summary.extractedCount} obligations extracted across ${summary.chunkCount} chunk(s)${summary.ungroundedCount > 0 ? ` — ${summary.ungroundedCount} flagged as unverified citations` : ""}.`,
                });
            }
        } catch (err) {
            toast({ title: "Extraction failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
        } finally {
            setIsExtracting(false);
        }
    };

    const handleUpdateStatus = async (id: string, status: BackendObligation["status"]) => {
        if (isDemo) {
            setObligations((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
            return;
        }
        try {
            const saved = await updateObligation(id, { status });
            setObligations((prev) => prev.map((o) => (o.id === id ? saved : o)));
        } catch (err) {
            toast({ title: "Failed to update obligation", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
        }
    };

    const verifiedCount = useMemo(() => obligations.filter((o) => o.citationVerified).length, [obligations]);

    return (
        <motion.div variants={pageContainer} initial="hidden" animate="show" className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
            <motion.div variants={pageItem}>
                <Button variant="ghost" size="sm" className="-ml-2 h-8 text-muted-foreground hover:text-foreground rounded-lg px-3" onClick={() => navigate("/obligations")}>
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Obligations
                </Button>
            </motion.div>

            {loadError && (
                <motion.div variants={pageItem} className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {loadError}
                </motion.div>
            )}

            {isLoading ? (
                <motion.div variants={pageItem} className="flex items-center justify-center py-24 text-sm text-muted-foreground">
                    Loading…
                </motion.div>
            ) : !circular ? (
                <motion.div variants={pageItem} className="flex items-center justify-center py-24 text-sm text-muted-foreground">
                    Circular not found.
                </motion.div>
            ) : (
                <>
                    <motion.div variants={pageItem} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">{circular.name}</h1>
                            <p className="text-xs md:text-sm text-muted-foreground mt-0.5 font-mono">{circular.circularId}</p>
                        </div>
                        {obligations.length > 0 && circularId && (
                            <SuggestionBar circularId={circularId} isDemo={isDemo} onDone={() => setSuggestionKey((k) => k + 1)} />
                        )}
                        <Button
                            onClick={handleExtract}
                            disabled={isExtracting}
                            className="h-10 px-5 rounded-lg font-medium gap-1.5 shrink-0"
                        >
                            <Sparkles className="h-4 w-4" />
                            {isExtracting ? "Extracting…" : obligations.length > 0 ? "Re-run Extraction" : "Extract Obligations"}
                        </Button>
                    </motion.div>

                    {obligations.length > 0 && (
                        <motion.div variants={pageItem} className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> {verifiedCount} of {obligations.length} citations verified against source text</span>
                            {verifiedCount < obligations.length && (
                                <span className="flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-red-500" /> {obligations.length - verifiedCount} need review</span>
                            )}
                        </motion.div>
                    )}

                    {obligations.length === 0 ? (
                        <motion.div variants={pageItem} className="flex flex-col items-center justify-center py-24 text-center gap-2">
                            <Sparkles className="h-8 w-8 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">No obligations extracted yet for this circular.</p>
                        </motion.div>
                    ) : (
                        <motion.div variants={pageItem} className="space-y-3">
                            {obligations.map((o) => (
                                <ObligationCard key={o.id} obligation={o} onUpdate={handleUpdateStatus} isDemo={isDemo} suggestionKey={suggestionKey} />
                            ))}
                        </motion.div>
                    )}
                </>
            )}
        </motion.div>
    );
};

export default ObligationDetail;
