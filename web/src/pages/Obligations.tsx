import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fetchCirculars, type BackendCircular } from "@/lib/circulars";
import { fetchObligationSummaries, type ObligationSummary } from "@/lib/obligations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Sparkles, ArrowRight, ShieldCheck, CalendarClock, Search, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { pageContainer, pageItem } from "@/lib/animations";
import { DEMO_CIRCULAR_LIST, buildDemoObligationSummaries } from "@/demo/complianceScenario";

// isDemo mode never calls the backend — summaries and circular options both
// come from the shared demo scenario so they can't drift out of sync with
// what /obligations/:circularId actually shows for the same circular.
const DEMO_SUMMARIES: ObligationSummary[] = buildDemoObligationSummaries();
const DEMO_CIRCULAR_OPTIONS: Pick<BackendCircular, "id" | "name" | "circularId">[] = DEMO_CIRCULAR_LIST;

function verifiedColor(pct: number) {
    if (pct === 100) return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20";
    if (pct >= 60) return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-100 dark:border-amber-500/20";
    return "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-100 dark:border-red-500/20";
}

const Obligations = () => {
    const navigate = useNavigate();
    const { isDemo } = useAuth();
    const [summaries, setSummaries] = useState<ObligationSummary[]>(isDemo ? DEMO_SUMMARIES : []);
    const [isLoading, setIsLoading] = useState(!isDemo);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const [showNewExtraction, setShowNewExtraction] = useState(false);
    const [circularOptions, setCircularOptions] = useState<Pick<BackendCircular, "id" | "name" | "circularId">[]>(isDemo ? DEMO_CIRCULAR_OPTIONS : []);
    const [selectedNewCircularId, setSelectedNewCircularId] = useState("");

    useEffect(() => {
        if (isDemo) return;
        fetchObligationSummaries()
            .then(setSummaries)
            .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load obligations"))
            .finally(() => setIsLoading(false));
    }, [isDemo]);

    useEffect(() => {
        if (isDemo || !showNewExtraction || circularOptions.length > 0) return;
        fetchCirculars().then(setCircularOptions).catch(() => setCircularOptions([]));
    }, [isDemo, showNewExtraction, circularOptions.length]);

    const filteredSummaries = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return summaries;
        return summaries.filter(
            (s) => s.circularName.toLowerCase().includes(q) || s.circularCode.toLowerCase().includes(q),
        );
    }, [summaries, search]);

    const handleStartExtraction = () => {
        if (!selectedNewCircularId) return;
        setShowNewExtraction(false);
        navigate(`/obligations/${selectedNewCircularId}`);
    };

    return (
        <motion.div variants={pageContainer} initial="hidden" animate="show" className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
            <motion.div variants={pageItem} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Obligation Extraction</h1>
                    <p className="text-xs md:text-sm text-muted-foreground mt-0.5">Run the extraction agent over circulars to pull out atomic, citable obligations.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 sm:flex-initial">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search circulars..."
                            className="pl-9 h-10 w-full sm:w-64 text-sm rounded-lg"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Button
                        size="default"
                        onClick={() => setShowNewExtraction(true)}
                        className="h-10 px-5 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all active:scale-[0.98] whitespace-nowrap"
                    >
                        <Sparkles className="h-4 w-4 mr-2" />
                        <span>New Extraction</span>
                    </Button>
                </div>
            </motion.div>

            {loadError && (
                <motion.div variants={pageItem} className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {loadError}
                </motion.div>
            )}

            {isLoading ? (
                <motion.div variants={pageItem} className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Loading…
                </motion.div>
            ) : (
                <motion.div variants={pageItem} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                    {filteredSummaries.map((s, i) => {
                        const pct = s.total > 0 ? Math.round((s.verified / s.total) * 100) : 0;
                        return (
                            <Card
                                key={s.circularId}
                                className="group cursor-pointer transition-all duration-200 border-border/50 hover:-translate-y-1 hover:shadow-md active:scale-[0.98]"
                                onClick={() => navigate(`/obligations/${s.circularId}`)}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="font-mono text-[10px] text-muted-foreground/60">#{i + 1}</span>
                                            <Badge variant="outline" className="uppercase tracking-wider">
                                                {s.category ?? "Circular"}
                                            </Badge>
                                        </div>
                                        <Badge variant="outline" className={cn(verifiedColor(pct))}>
                                            {pct}% verified
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-2">{s.circularName}</CardTitle>
                                    <CardDescription className="mt-1 font-mono text-xs">{s.circularCode}</CardDescription>
                                </CardHeader>
                                <CardContent className="pb-4">
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground font-medium">Citations verified</span>
                                                <span className="text-foreground font-semibold">{s.verified}/{s.total}</span>
                                            </div>
                                            <Progress value={pct} className="h-2" />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className="text-xs text-foreground truncate">{s.confirmed} confirmed</span>
                                            </div>
                                            <div className="flex items-center gap-2 justify-end">
                                                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className="text-xs text-foreground">{new Date(s.lastExtractedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="pt-3 border-t border-border/50 bg-muted/30 py-3 px-6 flex justify-between items-center">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Sparkles className="h-3.5 w-3.5" />
                                        <span>{s.total} obligation{s.total === 1 ? "" : "s"}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                                        Open Extraction
                                        <ArrowRight className="h-3 w-3" />
                                    </div>
                                </CardFooter>
                            </Card>
                        );
                    })}

                    {/* CTA: Start a new extraction */}
                    <button
                        onClick={() => setShowNewExtraction(true)}
                        className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl hover:border-foreground/40 hover:bg-muted/20 transition-all h-full min-h-[250px] group"
                    >
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4 group-hover:bg-foreground group-hover:text-background transition-colors duration-200">
                            <Plus className="h-6 w-6" />
                        </div>
                        <span className="text-sm font-semibold text-foreground">New Extraction</span>
                        <p className="text-xs text-muted-foreground mt-1 px-4 text-center">
                            Pick a circular — the agent extracts and cites the obligations.
                        </p>
                        <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                            Get started <ArrowRight className="h-3.5 w-3.5" />
                        </div>
                    </button>
                </motion.div>
            )}

            {!isLoading && filteredSummaries.length === 0 && summaries.length === 0 && (
                <motion.div variants={pageItem} className="text-center text-sm text-muted-foreground py-6">
                    No extractions yet — start one from a circular in Regulations.
                </motion.div>
            )}

            <Dialog open={showNewExtraction} onOpenChange={setShowNewExtraction}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Start a new extraction</DialogTitle>
                        <DialogDescription>Pick a circular to run the Obligation Extraction Agent over.</DialogDescription>
                    </DialogHeader>
                    <Select value={selectedNewCircularId} onValueChange={setSelectedNewCircularId}>
                        <SelectTrigger className="w-full h-10">
                            <SelectValue placeholder="Select a circular..." />
                        </SelectTrigger>
                        <SelectContent>
                            {circularOptions.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={handleStartExtraction} disabled={!selectedNewCircularId} className="w-full">
                        Continue
                    </Button>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
};

export default Obligations;
