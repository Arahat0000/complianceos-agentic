import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchTraceability, mapChain, signoffTraceability, parseChainKey, type MappedTraceabilityNode } from "@/lib/traceability";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { pageContainer, pageItem } from "@/lib/animations";
import { StatCard } from "@/components/stat-card";
import { TRACEABILITY_DATA } from "@/data/traceabilityData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ShieldCheck,
  Download,
  Filter,
  Check,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { GenericDataTable } from "@/components/generic-data-table";
import type { RowSelectionState } from "@tanstack/react-table";
import type { AppColumnDef } from "@/lib/table-features";

// Get the type of a node
type TraceabilityNode = MappedTraceabilityNode | (typeof TRACEABILITY_DATA)[0];

export default function TraceabilityMatrix() {
  const { isDemo } = useAuth();
  const [nodes, setNodes] = useState<TraceabilityNode[]>(isDemo ? TRACEABILITY_DATA : []);
  const [isLoading, setIsLoading] = useState(!isDemo);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  const [selectedRegulator, setSelectedRegulator] = useState<string>("all");
  const [isAuditorSigned, setIsAuditorSigned] = useState<boolean>(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");

  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      const matchReg =
        selectedRegulator === "all" ||
        node.regulation.regulator === selectedRegulator;

      const searchLower = searchQuery.toLowerCase();
      const matchQuery =
        !searchQuery ||
        node.regulation.title.toLowerCase().includes(searchLower) ||
        node.obligation.text.toLowerCase().includes(searchLower) ||
        node.control.name.toLowerCase().includes(searchLower) ||
        node.control.id.toLowerCase().includes(searchLower);

      return matchReg && matchQuery;
    });
  }, [nodes, selectedRegulator, searchQuery]);

  const handleExportMatrix = () => {
    toast.success("Regulatory Lineage Matrix export requested");
  };

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    fetchTraceability()
      .then((rows) => {
        if (cancelled) return;
        const mapped = rows.map(mapChain);
        setNodes(mapped);
        setIsAuditorSigned(mapped.length > 0 && mapped.every((n) => !!n.signoff));
        setLoadError(null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load traceability");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isDemo]);

  const handleSignoff = async () => {
    if (isDemo) {
      setIsAuditorSigned(true);
      toast.success("Chief Compliance Officer (CCO) sign-off logged to immutable audit trail");
      return;
    }
    const targets = filteredNodes
      .map((n) => parseChainKey(n.id))
      .filter((k): k is NonNullable<typeof k> => !!k);
    if (targets.length === 0) return;
    setIsSigning(true);
    try {
      const results = await Promise.all(
        targets.map((k) => signoffTraceability(k.obligationId, k.controlId, "CCO")),
      );
      const bySig = new Map(results.map((r) => [`${r.obligationId}__${r.controlId}`, r]));
      setNodes((prev) =>
        prev.map((n) => {
          const r = bySig.get(n.id);
          return r && "signoff" in n
            ? { ...n, signoff: { signedAt: r.signedAt, contentHash: r.contentHash, signedRole: r.signedRole } }
            : n;
        }),
      );
      setIsAuditorSigned(true);
      const last = results[results.length - 1];
      toast.success(
        `CCO sign-off recorded for ${results.length} chain(s) at ${new Date(last.signedAt).toLocaleString()}` +
          (last.contentHash ? ` (hash ${last.contentHash.slice(0, 12)}…)` : ""),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-off failed");
    } finally {
      setIsSigning(false);
    }
  };

  const columns = useMemo<AppColumnDef<TraceabilityNode>[]>(() => [
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
      cell: ({ row }) => <span className="text-center font-mono text-[10px] text-muted-foreground/60">{row.index + 1}</span>,
    },
    {
      id: "regulator",
      header: "Regulator",
      accessorFn: (row) => row.regulation.regulator,
      cell: ({ row }) => (
        <Badge variant="outline" className="font-semibold text-xs">{row.original.regulation.regulator}</Badge>
      ),
    },
    {
      id: "regulation",
      header: "Regulation",
      accessorFn: (row) => row.regulation.title,
      cell: ({ row }) => (
        <div>
          <div className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-1">{row.original.regulation.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Section {row.original.regulation.sourceSection}</div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => !!row.gap.id,
      cell: ({ row }) => {
        const hasGap = !!row.original.gap.id;
        const statusColor = hasGap ? "text-red-600 bg-red-500/10" : "text-emerald-600 bg-emerald-500/10";
        const statusText = hasGap ? "Gap Found" : "Compliant";
        return (
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full inline-block", statusColor)}>
            {statusText}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right pr-4">Action</div>,
      cell: () => (
        <div className="flex justify-end pr-4">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground group-hover:text-primary">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ], []);

  const totalNodes = filteredNodes.length;
  const compliantCount = filteredNodes.filter((n) => !n.gap.id).length;
  const gapCount = filteredNodes.filter((n) => !!n.gap.id).length;
  const criticalCount = filteredNodes.filter((n) => n.gap.riskLevel === "CRITICAL" || n.gap.riskLevel === "HIGH").length;

  return (
    <motion.div
      variants={pageContainer}
      initial="hidden"
      animate="show"
      className="flex-1 flex flex-col min-h-0 min-w-0 overflow-auto bg-background p-4 md:p-6 space-y-6"
    >
      {/* 1. Header Banner */}
      <motion.div variants={pageItem} className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Regulatory Traceability Matrix
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Regulation to remediation, traced end-to-end.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportMatrix}
            className="h-9 gap-1.5 text-xs font-medium cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export Matrix
          </Button>
          <Button
            size="sm"
            onClick={handleSignoff}
            disabled={isAuditorSigned || isSigning || (!isDemo && (isLoading || nodes.length === 0))}
            className={cn(
              "h-9 gap-1.5 text-xs font-medium cursor-pointer",
              isAuditorSigned
                ? "bg-emerald-600 text-white hover:bg-emerald-600 cursor-default"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {isAuditorSigned ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Signed off
              </>
            ) : (
              <>
                <ShieldCheck className="h-3.5 w-3.5" />
                Sign-off Matrix
              </>
            )}
          </Button>
        </div>
      </motion.div>

      <motion.div variants={pageItem} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Mapped Obligations"
          value={totalNodes}
          trend={totalNodes > 0 ? "up" : undefined}
          trendValue={totalNodes}
          trendLabel="Active linkages"
          description="Total regulatory requirements mapped"
          badgeClassName="bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
        />
        <StatCard
          title="Fully Compliant"
          value={compliantCount}
          trend={compliantCount > 0 ? "up" : undefined}
          trendValue={totalNodes ? `${Math.round((compliantCount / totalNodes) * 100)}% compliant` : compliantCount}
          trendLabel="Controls without open gaps"
          description="Requirements fully met"
          badgeClassName="bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
        />
        <StatCard
          title="Identified Gaps"
          value={gapCount}
          trend={gapCount > 0 ? "down" : "up"}
          trendValue={totalNodes ? `${Math.round((gapCount / totalNodes) * 100)}% of total` : gapCount}
          trendLabel="Areas of non-compliance"
          description="Requirements with control gaps"
          badgeClassName="bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20"
        />
        <StatCard
          title="Critical / High Risk"
          value={criticalCount}
          trend={criticalCount > 0 ? "up" : undefined}
          trendValue={gapCount ? `${Math.round((criticalCount / gapCount) * 100)}% of gaps` : criticalCount}
          trendLabel="High priority"
          description="Blockers to sign-off"
          badgeClassName="bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
        />
      </motion.div>

      {/* 2. Generic DataTable */}
      <motion.div variants={pageItem}>
        {loadError && (
          <div className="mb-3 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-600">
            {loadError}
          </div>
        )}
        {isLoading && <div className="mb-3 text-xs text-muted-foreground">Loading traceability...</div>}
        <GenericDataTable
          columns={columns}
          data={filteredNodes}
          searchKey="regulation"
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search circulars, obligations, controls..."
          onRowClick={(row) => navigate(`/traceability/${encodeURIComponent(row.id)}`)}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          actions={
            <div className="flex gap-2">
              <Select value={selectedRegulator} onValueChange={setSelectedRegulator}>
                <SelectTrigger className="h-9 w-[150px] text-xs bg-background">
                  <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Regulator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regulators</SelectItem>
                  <SelectItem value="RBI">Reserve Bank of India (RBI)</SelectItem>
                  <SelectItem value="SEBI">SEBI (CSCRF)</SelectItem>
                  <SelectItem value="CERT-In">CERT-In Directives</SelectItem>
                  <SelectItem value="DPDP">DPDP Act 2023</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />
      </motion.div>
    </motion.div>
  );
}
