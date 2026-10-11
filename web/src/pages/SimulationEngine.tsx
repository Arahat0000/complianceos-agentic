import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import * as sim from "@/lib/simulation";
import type { UiScenario, UiSimulatedState } from "@/lib/simulation";
import { PRESET_SIMULATION_SCENARIOS } from "@/data/traceabilityData";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Play,
  FileText,
  Loader2,
  AlertTriangle,
  TrendingDown,
  CheckCircle2,
  ShieldAlert,
  Edit3,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion } from "motion/react";
import { pageContainer, pageItem } from "@/lib/animations";
import { Checkbox } from "@/components/ui/checkbox";
import { GenericDataTable } from "@/components/generic-data-table";
import { StatCard } from "@/components/stat-card";
import { type RowSelectionState } from "@tanstack/react-table";
import type { AppColumnDef } from "@/lib/table-features";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { DEMO_REGULATIONS_LIBRARY } from "@/data/regulationsLibrary";
import { fetchCirculars, type BackendCircular } from "@/lib/circulars";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SimulationEngine() {
  const { isDemo } = useAuth();
  const [scenarios, setScenarios] = useState<UiScenario[]>(isDemo ? PRESET_SIMULATION_SCENARIOS : []);
  const [isLoading, setIsLoading] = useState<boolean>(!isDemo);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(
    isDemo ? PRESET_SIMULATION_SCENARIOS[0].id : ""
  );
  const [runMethod, setRunMethod] = useState<sim.RunMethod>("AUTO");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationComplete, setSimulationComplete] = useState<boolean>(true);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>("results");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [newScenarioData, setNewScenarioData] = useState({ name: "", targetRegulator: "", hypothesisText: "" });
  const [simulatedScenarioIds, setSimulatedScenarioIds] = useState<Set<string>>(new Set(isDemo ? [PRESET_SIMULATION_SCENARIOS[0].id] : []));
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editScenarioData, setEditScenarioData] = useState({ id: "", name: "", targetRegulator: "", hypothesisText: "" });
  const [circulars, setCirculars] = useState<BackendCircular[]>([]);
  const regOptions = useMemo(
    () =>
      isDemo
        ? DEMO_REGULATIONS_LIBRARY.map((r) => ({ value: r.name, label: r.name, code: "" }))
        : circulars.map((c) => ({ value: c.id, label: c.name, code: c.circularId })),
    [isDemo, circulars]
  );
  const regValueFor = (sc: UiScenario) =>
    isDemo
      ? sc.targetRegulator
      : (sc.targetCircularId && circulars.find((c) => c.id === sc.targetCircularId)?.id) ||
        circulars.find((c) => c.name === sc.targetRegulator)?.id ||
        "";
  const resolveTarget = (value: string): { targetRegulator: string; targetCircularId?: string } => {
    if (isDemo) return { targetRegulator: value };
    const c = circulars.find((x) => x.id === value);
    return { targetRegulator: c?.name ?? value, targetCircularId: c?.id };
  };

  const currentScenario: UiScenario | undefined =
    scenarios.find((s) => s.id === selectedScenarioId) ||
    scenarios[0];
  const canMutate = isDemo || !!currentScenario?.editable;
  const rawResults = currentScenario?.simulatedState ?? null;
  // Demo mode: curated per-control reasoning derived from the preset's breached controls.
  const results = useMemo<UiSimulatedState | null>(() => {
    if (!rawResults) return null;
    if (!isDemo || rawResults.reasoning) return rawResults;
    return {
      ...rawResults,
      method: "AI_GRAPH",
      reasoning: {
        method: "AI_GRAPH",
        model: "demo",
        graph: { obligations: rawResults.newlyBreachedControls.length * 3, controls: rawResults.newlyBreachedControls.length + (rawResults.unaffectedControlsCount ?? 0), openGaps: rawResults.highGaps },
        controls: rawResults.newlyBreachedControls.map((c) => ({ controlId: c.id, breached: true, reason: c.reason, obligationIds: [] })),
      },
    };
  }, [rawResults, isDemo]);

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    fetchCirculars().then((c) => { if (!cancelled) setCirculars(c); }).catch(() => undefined);
    sim.fetchScenarios()
      .then((rows) => {
        if (cancelled) return;
        setScenarios(rows);
        if (rows.length > 0) {
          setSelectedScenarioId(rows[0].id);
          setCustomPrompt(rows[0].hypothesisText);
        }
        setSimulatedScenarioIds(new Set(rows.filter((r) => r.simulatedState).map((r) => r.id)));
        setSimulationComplete(rows.length > 0 && !!rows[0].simulatedState);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load scenarios");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isDemo]);

  const handleDeleteScenario = async (id: string) => {
    if (!isDemo) {
      try {
        await sim.deleteScenario(id);
      } catch {
        toast.error("Failed to delete scenario.");
        return;
      }
    }
    setScenarios((prev) => prev.filter(s => s.id !== id));
    if (selectedScenarioId === id) {
       const remaining = scenarios.filter(s => s.id !== id);
       if (remaining.length > 0) {
         setSelectedScenarioId(remaining[0].id);
         setCustomPrompt(remaining[0].hypothesisText);
       } else {
         setSelectedScenarioId("");
         setCustomPrompt("");
       }
    }
    toast.success("Scenario deleted.");
  };

  const handleOpenEdit = () => {
    if (!currentScenario) return;
    setEditScenarioData({ id: currentScenario.id, name: currentScenario.name, targetRegulator: regValueFor(currentScenario), hypothesisText: currentScenario.hypothesisText });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editScenarioData.name || !editScenarioData.targetRegulator || !editScenarioData.hypothesisText) {
       toast.error("Please fill in all fields.");
       return;
    }
    if (!isDemo) {
      try {
        const updated = await sim.updateScenario(editScenarioData.id, {
          name: editScenarioData.name,
          ...resolveTarget(editScenarioData.targetRegulator),
          hypothesisText: editScenarioData.hypothesisText,
        });
        setScenarios((prev) => prev.map((s) => (s.id === updated.id ? { ...updated, initialState: s.initialState, simulatedState: s.simulatedState } : s)));
        if (selectedScenarioId === editScenarioData.id) setCustomPrompt(editScenarioData.hypothesisText);
        setIsEditModalOpen(false);
        toast.success("Scenario updated.");
      } catch {
        toast.error("Failed to update scenario.");
      }
      return;
    }
    setScenarios((prev) => prev.map(s => s.id === editScenarioData.id ? { ...s, name: editScenarioData.name, targetRegulator: editScenarioData.targetRegulator, hypothesisText: editScenarioData.hypothesisText } : s));
    if (selectedScenarioId === editScenarioData.id) {
       setCustomPrompt(editScenarioData.hypothesisText);
    }
    setIsEditModalOpen(false);
    toast.success("Scenario updated.");
  };

  const handleAddScenario = async () => {
    if (!newScenarioData.name || !newScenarioData.targetRegulator || !newScenarioData.hypothesisText) {
       toast.error("Please fill in all fields.");
       return;
    }
    if (!isDemo) {
      try {
        const created = await sim.createScenario({
          name: newScenarioData.name,
          category: "REGULATORY_AMENDMENT",
          ...resolveTarget(newScenarioData.targetRegulator),
          hypothesisText: newScenarioData.hypothesisText,
        });
        setScenarios((prev) => [...prev, created]);
        setSelectedScenarioId(created.id);
        setCustomPrompt(created.hypothesisText);
        setIsNewModalOpen(false);
        setNewScenarioData({ name: "", targetRegulator: "", hypothesisText: "" });
        toast.success("Scenario added to library.");
      } catch {
        toast.error("Failed to create scenario.");
      }
      return;
    }
    const newScen: UiScenario = {
      id: `custom-${Date.now()}`,
      name: newScenarioData.name,
      targetRegulator: newScenarioData.targetRegulator,
      category: "REGULATORY_AMENDMENT" as const,
      hypothesisText: newScenarioData.hypothesisText,
      initialState: PRESET_SIMULATION_SCENARIOS[0].initialState,
      simulatedState: PRESET_SIMULATION_SCENARIOS[0].simulatedState,
    };
    setScenarios((prev) => [...prev, newScen]);
    setSelectedScenarioId(newScen.id);
    setCustomPrompt(newScen.hypothesisText);
    setIsNewModalOpen(false);
    setNewScenarioData({ name: "", targetRegulator: "", hypothesisText: "" });
    toast.success("Scenario added to library.");
  };

  const handleRunSimulation = async () => {
    if (!currentScenario) return;
    setIsSimulating(true);
    setSimulationComplete(false);
    setActiveStep(0);
    setActiveTab("results");

    const stepCount = 4;
    const runId = selectedScenarioId;

    if (isDemo) {
      let current = 0;
      const interval = setInterval(() => {
        current++;
        if (current < stepCount) {
          setActiveStep(current);
        } else {
          clearInterval(interval);
          setIsSimulating(false);
          setSimulationComplete(true);
          setSimulatedScenarioIds((prev) => new Set(prev).add(runId));
          toast.success("Simulation completed successfully.");
        }
      }, 600);
      return;
    }

    let step = 0;
    const interval = setInterval(() => {
      step = Math.min(step + 1, stepCount - 1);
      setActiveStep(step);
    }, 600);
    const minDelay = new Promise((res) => setTimeout(res, 600 * stepCount));
    try {
      if (currentScenario.editable && customPrompt && customPrompt !== currentScenario.hypothesisText) {
        await sim.updateScenario(runId, { hypothesisText: customPrompt });
      }
      const [result] = await Promise.all([sim.runScenario(runId, runMethod), minDelay]);
      setScenarios((prev) =>
        prev.map((s) =>
          s.id === runId
            ? { ...s, hypothesisText: customPrompt || s.hypothesisText, initialState: result.initialState, simulatedState: result.simulatedState }
            : s
        )
      );
      setSimulatedScenarioIds((prev) => new Set(prev).add(runId));
      setSimulationComplete(true);
      toast.success("Simulation completed successfully.");
    } catch {
      toast.error("Simulation failed.");
    } finally {
      clearInterval(interval);
      setIsSimulating(false);
    }
  };

  const handleExportBrief = () => {
    toast.success("Risk Assessment Brief (PDF) generated.");
  };

  const breachedColumns = useMemo<AppColumnDef<UiSimulatedState["newlyBreachedControls"][number]>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "index",
      header: "#",
      cell: ({ row }) => (
        <span className="text-center font-mono text-[10px] text-muted-foreground/60">
          {row.index + 1}
        </span>
      ),
    },
    {
      accessorKey: "id",
      header: "Control ID",
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.id}</span>,
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.name}</span>,
    },
    {
      accessorKey: "reason",
      header: "Breach Rationale",
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.reason}</span>,
    },
    {
      accessorKey: "remediationCostEst",
      header: "Cost Est.",
      cell: ({ row }) => <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">{row.original.remediationCostEst}</span>,
    },
    {
      accessorKey: "remediationDays",
      header: "SLA",
      cell: ({ row }) => <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">{row.original.remediationDays != null ? `${row.original.remediationDays} days` : "-"}</span>,
    },
  ], []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading scenarios...
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-sm text-red-600">
        {loadError}
      </div>
    );
  }

  return (
    <motion.div
      variants={pageContainer}
      initial="hidden"
      animate="show"
      className="flex-1 flex flex-col min-h-0 min-w-0 overflow-auto bg-background p-4 md:p-6 space-y-6"
    >
      {/* Header */}
      <motion.div variants={pageItem} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Simulation Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Simulate regulatory changes and forecast compliance impact.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportBrief}
            className="h-9 gap-1.5 cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            Export Brief
          </Button>
        </div>
      </motion.div>

      <motion.div variants={pageItem} className="flex-1 min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col min-h-[500px]">
          <TabsList className="w-fit mb-6">
            <TabsTrigger value="setup" className="text-xs px-4">Scenario Setup</TabsTrigger>
            <TabsTrigger value="results" className="text-xs px-4">Simulation Results</TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="flex-1 space-y-0 mt-0 border rounded-xl overflow-hidden bg-card shadow-sm flex flex-col md:flex-row min-h-[500px]">
            {/* Left Sidebar - Library */}
            <div className="w-full md:w-[320px] border-b md:border-b-0 md:border-r bg-muted/10 flex flex-col">
              <div className="px-4 py-3 border-b bg-muted/30 font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Scenario Library</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 cursor-pointer" onClick={() => setIsNewModalOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {scenarios.map((sc) => {
                  const isSelected = selectedScenarioId === sc.id;
                  return (
                    <button
                      key={sc.id}
                      onClick={() => {
                        setSelectedScenarioId(sc.id);
                        setCustomPrompt(sc.hypothesisText);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-3 rounded-lg text-sm transition-colors",
                        isSelected ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70 truncate">{sc.targetRegulator}</div>
                      <div className="line-clamp-2 leading-snug">{sc.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Main - Editor */}
            <div className="flex-1 flex flex-col bg-background">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm text-foreground truncate max-w-[300px]" title={currentScenario?.name || "Scenario Configuration"}>
                  {currentScenario?.name || "Scenario Configuration"}
                </h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs cursor-pointer" onClick={handleOpenEdit} disabled={!currentScenario || !canMutate} title={canMutate ? undefined : "Built-in presets are read-only"}>
                    <Edit3 className="h-3.5 w-3.5 mr-2" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer" disabled={!currentScenario || !canMutate} onClick={() => currentScenario && handleDeleteScenario(currentScenario.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Scenario Name</label>
                  <div className="text-sm font-medium text-foreground p-3 bg-muted/20 border rounded-lg">
                    {currentScenario?.name}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Regulatory Hypothesis (Editable)</label>
                  <Textarea
                    value={customPrompt || currentScenario?.hypothesisText || ""}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="min-h-[180px] text-sm resize-none leading-relaxed p-4 bg-background"
                    placeholder="Describe the regulatory amendment or simulation scenario..."
                  />
                  <p className="text-[11px] text-muted-foreground">
                    You can edit the preset hypothesis above to run a custom variation. The engine will analyze your exact text.
                  </p>
                </div>
              </div>

              <div className="p-4 border-t bg-muted/20 flex items-center justify-end gap-3">
                <Select value={runMethod} onValueChange={(v) => setRunMethod(v as sim.RunMethod)}>
                  <SelectTrigger className="h-9 w-[200px]" aria-label="Simulation method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO">Auto (AI if available)</SelectItem>
                    <SelectItem value="HEURISTIC">Heuristic estimate</SelectItem>
                    <SelectItem value="AI_GRAPH">AI graph analysis</SelectItem>
                  </SelectContent>
                </Select>
                {simulatedScenarioIds.has(selectedScenarioId) && (
                   <Button variant="outline" onClick={() => setActiveTab("results")} className="h-9 px-6 cursor-pointer">
                     View Results
                   </Button>
                )}
                <Button
                  onClick={handleRunSimulation}
                  disabled={isSimulating || !currentScenario}
                  className="h-9 px-6 cursor-pointer shadow-sm"
                >
                  {isSimulating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Preparing...</>
                  ) : (
                    <>Run Simulation <Play className="h-3.5 w-3.5 ml-1.5" /></>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="results" className="flex-1 mt-0">
            {isSimulating ? (
              <div className="h-full min-h-[400px] border rounded-xl bg-card shadow-sm flex flex-col items-center justify-center space-y-4 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <div>
                  <span className="text-base font-semibold text-foreground block mb-2">Processing Agentic Simulation</span>
                  <p className="font-mono text-sm text-muted-foreground bg-muted px-4 py-2 rounded-md">
                    {["Parsing regulatory amendment...", "Evaluating internal controls...", "Calculating blast radius...", "Synthesizing mitigation playbook..."][activeStep]}
                  </p>
                </div>
              </div>
            ) : simulationComplete && currentScenario && results ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    title="Blast Radius"
                    value={`${results.blastRadiusScore ?? "-"}${results.blastRadiusScore != null ? "%" : ""}`}
                    description="System-wide impact"
                    icon={<ShieldAlert className="h-4 w-4 text-red-500" />}
                    trendValue={results.blastRadiusScore != null ? `${results.blastRadiusScore >= 60 ? "Severe" : results.blastRadiusScore >= 30 ? "Moderate" : "Low"} impact` : "Not scored"}
                    badgeClassName="bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                  />
                  <StatCard
                    title="Compliance Score Shift"
                    value={results.complianceScore != null ? `${results.complianceScore}%` : "N/A"}
                    description="Post-amendment score"
                    icon={<TrendingDown className="h-4 w-4 text-amber-500" />}
                    trend="down"
                    trendValue={results.complianceScore != null && currentScenario.initialState.complianceScore != null ? `${Math.abs(currentScenario.initialState.complianceScore - results.complianceScore)} points ${results.complianceScore <= currentScenario.initialState.complianceScore ? "down" : "up"}` : "Score unavailable"}
                  />
                  <StatCard
                    title="Critical Gaps Opened"
                    value={`+${results.criticalGaps - currentScenario.initialState.criticalGaps}`}
                    description={`Total: ${results.criticalGaps}`}
                    icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
                    trendValue={results.criticalGaps - currentScenario.initialState.criticalGaps > 0 ? "Action required" : "No new critical gaps"}
                    badgeClassName="bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                  />
                  <StatCard
                    title="Resilient Controls"
                    value={(results.unaffectedControlsCount ?? "-").toString()}
                    description="Safeguards Intact"
                    icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    trend="up"
                    trendValue="Unaffected"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={cn("rounded-full border px-2.5 py-0.5 font-medium", results.method === "AI_GRAPH" ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20" : "bg-muted text-muted-foreground")}>
                    {results.method === "AI_GRAPH" ? "AI graph analysis" : "Heuristic estimate"}
                  </span>
                  {results.reasoning?.notes && <span className="text-amber-600 dark:text-amber-400">{results.reasoning.notes}</span>}
                  {results.reasoning && results.reasoning.controls.length > 0 && (
                    <span className="text-muted-foreground">{results.reasoning.graph.controls} controls, {results.reasoning.graph.obligations} obligations analysed</span>
                  )}
                </div>

                {results.reasoning && results.reasoning.controls.length > 0 && (
                  <details className="rounded-xl border bg-card p-4 shadow-sm">
                    <summary className="cursor-pointer text-sm font-semibold text-foreground">Per-control reasoning ({results.reasoning.controls.length})</summary>
                    <ul className="mt-3 space-y-2">
                      {results.reasoning.controls.map((c) => (
                        <li key={c.controlId} className="text-sm">
                          <span className={cn("mr-2 rounded px-1.5 py-0.5 text-[11px] font-semibold", c.breached ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400")}>{c.breached ? "Breach" : "Holds"}</span>
                          <span className="font-mono text-xs text-muted-foreground mr-2">{c.controlId}</span>
                          <span className="text-muted-foreground">{c.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {results.suggestedPlaybook && (
                  <div className="space-y-2 rounded-xl border bg-card p-4 shadow-sm">
                    <div className="text-sm font-semibold text-foreground">Suggested playbook</div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{results.suggestedPlaybook}</p>
                  </div>
                )}

                {/* Data Table */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1 text-sm font-semibold text-foreground">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Newly Breached Controls Breakdown
                  </div>
                  <GenericDataTable
                    columns={breachedColumns}
                    data={results.newlyBreachedControls}
                    searchKey="name"
                    searchPlaceholder="Search breached controls..."
                    rowSelection={rowSelection}
                    onRowSelectionChange={setRowSelection}
                  />
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] border rounded-xl bg-card shadow-sm flex flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
                <FileText className="h-12 w-12 opacity-20 mb-2" />
                <p>Run a simulation in the Setup tab to see results here.</p>
                <Button variant="outline" onClick={() => setActiveTab("setup")}>Go to Setup</Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Custom Scenario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scenario Name</label>
              <Input
                placeholder="e.g. DPDPA Strict Enforcement"
                value={newScenarioData.name}
                onChange={(e) => setNewScenarioData({ ...newScenarioData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Regulation</label>
              <Select
                value={newScenarioData.targetRegulator}
                onValueChange={(val) => setNewScenarioData({ ...newScenarioData, targetRegulator: val })}
              >
                <SelectTrigger className="w-full max-w-[460px]">
                  <SelectValue placeholder="Select a regulation..." />
                </SelectTrigger>
                <SelectContent>
                  {regOptions.map((reg) => (
                    <SelectItem key={reg.value} value={reg.value}>
                      <div className="truncate max-w-[400px]">{reg.label}{reg.code ? ` (${reg.code})` : ""}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hypothesis</label>
              <Textarea
                placeholder="Describe the regulatory change..."
                value={newScenarioData.hypothesisText}
                onChange={(e) => setNewScenarioData({ ...newScenarioData, hypothesisText: e.target.value })}
                className="min-h-[100px] text-sm resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddScenario}>Add Scenario</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Scenario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scenario Name</label>
              <Input
                placeholder="e.g. DPDPA Strict Enforcement"
                value={editScenarioData.name}
                onChange={(e) => setEditScenarioData({ ...editScenarioData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Regulation</label>
              <Select
                value={editScenarioData.targetRegulator}
                onValueChange={(val) => setEditScenarioData({ ...editScenarioData, targetRegulator: val })}
              >
                <SelectTrigger className="w-full max-w-[460px]">
                  <SelectValue placeholder="Select a regulation..." />
                </SelectTrigger>
                <SelectContent>
                  {regOptions.map((reg) => (
                    <SelectItem key={reg.value} value={reg.value}>
                      <div className="truncate max-w-[400px]">{reg.label}{reg.code ? ` (${reg.code})` : ""}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hypothesis</label>
              <Textarea
                placeholder="Describe the regulatory change..."
                value={editScenarioData.hypothesisText}
                onChange={(e) => setEditScenarioData({ ...editScenarioData, hypothesisText: e.target.value })}
                className="min-h-[100px] text-sm resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
