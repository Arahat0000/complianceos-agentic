import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchDocuments, type BackendDocument } from "@/lib/documents";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Upload, 
    X, 
    Archive, 
    Download,
    MoreHorizontal,
    FileText
} from "lucide-react";
import { 
    IconDatabase, 
    IconBook, 
    IconCircleFilled, 
    IconAlertTriangleFilled, 
    IconClockFilled, 
    IconCalendarFilled,
    IconFileTextFilled
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { pageContainer, pageItem } from "@/lib/animations";
import { GenericDataTable } from "@/components/generic-data-table";
import { type RowSelectionState } from "@tanstack/react-table";
import type { AppColumnDef } from "@/lib/table-features";

interface LibraryItem {
  id: string;
  name: string;
  // Backend KBDocument.classification is a free VARCHAR (seed data uses
  // POLICY/LEGAL/REPORT), not this 3-value union — widened from the
  // original mock-only type so real classifications render as-is instead
  // of being forced into a bucket that misrepresents them.
  type: string;
  tags: string[];
  lastUpdated: string;
  status: "active" | "archived" | "draft";
  expiryDate?: string;
  department?: string;
  classification?: string;
  effectiveDate?: string;
  lastRenewalDate?: string;
}

import {
  MOCK_DOCUMENT_ITEMS,
  DEMO_REFERENCE_DATE,
} from "@/data/documentLibrary";

const MOCK_ITEMS: LibraryItem[] = MOCK_DOCUMENT_ITEMS.map((item) => ({
  ...item,
  status: item.status as LibraryItem["status"],
}));

const getExpiryInfo = (dateStr: string | undefined, now: Date) => {
  if (!dateStr) return null;
  const days = Math.ceil((new Date(dateStr).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: "Expired", class: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-100 dark:border-red-500/20", icon: IconCircleFilled, urgent: true, iconClass: "h-2 w-2" };
  if (days <= 30) return { label: `Expiring in ${days}d`, class: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-100 dark:border-amber-500/20", icon: IconClockFilled, urgent: true, iconClass: "h-3 w-3" };
  return { label: dateStr, class: "bg-muted text-muted-foreground border-border", icon: IconCalendarFilled, urgent: false, iconClass: "h-3 w-3" };
};

const typeIcon: Record<string, typeof IconFileTextFilled> = {
  policy: IconFileTextFilled,
  questionnaire: IconDatabase,
  framework: IconBook,
};
const getTypeIcon = (type: string) => typeIcon[type.toLowerCase()] ?? IconFileTextFilled;
const statusIndicator = {
  active: <IconCircleFilled className="h-2 w-2" />,
  archived: <IconCircleFilled className="h-2 w-2 opacity-50" />,
  draft: <IconCircleFilled className="h-2 w-2" />,
};
const statusClass = {
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20",
  archived: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20",
  draft: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-100 dark:border-amber-500/20",
};

/** Mock previous month counts for comparison */
const prevMonthLibrary = { policies: 2, questionnaires: 1, frameworks: 2, expiringSoon: 2 };

// Backend documents don't have a lifecycle status matching "active"/
// "archived"/"draft" — KBDocument.status is set by the ingestion pipeline
// ('PROCESSING' while the worker is still parsing it, 'PROCESSED' once
// done — see worker/src/jobs/documentParse.ts). Bucketed here rather than
// widening the frontend type, since the badge styling genuinely only makes
// sense for these three states.
function mapDocumentStatus(status: string | null): LibraryItem["status"] {
  if (status === "PROCESSED") return "active";
  if (status === "PROCESSING") return "draft";
  return "archived";
}

function mapBackendDocument(d: BackendDocument): LibraryItem {
  return {
    id: d.id,
    name: d.name,
    type: (d.classification ?? "document").toLowerCase(),
    tags: d.tags ?? [],
    lastUpdated: new Date(d.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    status: mapDocumentStatus(d.status),
    expiryDate: d.expiryDate ?? undefined,
    department: d.department ?? undefined,
    classification: d.classification ?? undefined,
    effectiveDate: d.effectiveDate ?? undefined,
    lastRenewalDate: d.lastRenewalDate ?? undefined,
  };
}

const DocumentLibrary = () => {
  const { isDemo } = useAuth();
  const [items, setItems] = useState<LibraryItem[]>(isDemo ? MOCK_ITEMS : []);
  const [isLoading, setIsLoading] = useState(!isDemo);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const navigate = useNavigate();
  const now = useMemo(() => (isDemo ? DEMO_REFERENCE_DATE : new Date()), [isDemo]);

  const [prevIsDemo, setPrevIsDemo] = useState(isDemo);
  if (prevIsDemo !== isDemo) {
    setPrevIsDemo(isDemo);
    if (!isDemo) {
      setIsLoading(true);
      setLoadError(null);
    }
  }

  useEffect(() => {
    if (isDemo) return;
    fetchDocuments()
      .then((data) => setItems(data.map(mapBackendDocument)))
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load document library"))
      .finally(() => setIsLoading(false));
  }, [isDemo]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const isExpiringSearch = search.toLowerCase() === "expire" && getExpiryInfo(i.expiryDate, now)?.urgent;
      const matchesSearch = isExpiringSearch ||
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())) ||
        (i.department && i.department.toLowerCase().includes(search.toLowerCase()));
        
      if (!matchesSearch) return false;

      const expiryInfo = getExpiryInfo(i.expiryDate, now);
      if (activeTab === "all") return true;
      if (activeTab === "expiring" && expiryInfo?.urgent && expiryInfo.label !== "Expired") return true;
      if (activeTab === "expired" && expiryInfo?.label === "Expired") return true;
      
      return false;
    });
  }, [items, search, activeTab, now]);

  const columns = useMemo<AppColumnDef<LibraryItem>[]>(() => [
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
      accessorKey: "name",
      header: "Document Name",
      cell: ({ row }) => {
        const item = row.original;
        const Icon = getTypeIcon(item.type);
        return (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{item.name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="secondary" className="bg-background border-border/50 capitalize whitespace-nowrap">
          {row.original.type}
        </Badge>
      ),
    },
    {
      accessorKey: "department",
      header: "Department",
      cell: ({ row }) => <span className="text-xs font-medium text-muted-foreground">{row.original.department || "—"}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge variant="outline" className={cn("capitalize shrink-0 flex items-center gap-1.5", statusClass[status])}>
            {statusIndicator[status]}
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "expiryDate",
      header: "Review/Expiry",
      cell: ({ row }) => {
        const item = row.original;
        if (!item.expiryDate) return <span className="text-xs text-muted-foreground">—</span>;
        const info = getExpiryInfo(item.expiryDate, now);
        if (!info) return <span className="text-xs text-muted-foreground">—</span>;
        const Icon = info.icon;
        return (
          <Badge variant="outline" className={cn("inline-flex items-center gap-1.5 shrink-0 px-2 py-0.5 whitespace-nowrap", info.class)}>
            <Icon className={info.iconClass} />
            {info.label}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 rounded-xl">
              <DropdownMenuItem onClick={() => navigate(`/library/${row.original.id}`)}>
                <FileText className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/library/${row.original.id}/edit`)}>Edit</DropdownMenuItem>
              <DropdownMenuItem>Download</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], [navigate, now]);

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <motion.div
      variants={pageContainer}
      initial="hidden"
      animate="show"
      className="flex-1 overflow-auto p-4 md:p-6 space-y-6"
    >
      <motion.div variants={pageItem} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Document Library</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">Your central repository for policies, framework controls, and evidence documents.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            size="default"
            className="h-10 px-5 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all active:scale-[0.98] w-full sm:w-auto"
            onClick={() => navigate("/upload-document")}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload New Document
          </Button>
        </div>
      </motion.div>

      {loadError && (
        <motion.div
          variants={pageItem}
          className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          Failed to load document library: {loadError}
        </motion.div>
      )}

      {isLoading ? (
        <motion.div variants={pageItem} className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          Loading document library…
        </motion.div>
      ) : (
      <>
      {/* Stats */}
      <motion.div variants={pageItem} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Policies"
          value={items.filter(i => i.type === "policy").length}
          trend={isDemo ? (items.filter(i => i.type === "policy").length >= prevMonthLibrary.policies ? "up" : "down") : undefined}
          trendValue={isDemo ? (prevMonthLibrary.policies ? `${items.filter(i => i.type === "policy").length > prevMonthLibrary.policies ? "+" : ""}${Math.round(((items.filter(i => i.type === "policy").length - prevMonthLibrary.policies) / prevMonthLibrary.policies) * 100)}% vs last month` : `${items.filter(i => i.type === "policy").length}`) : undefined}
          trendLabel={isDemo ? "Policy documents" : undefined}
          description="Internal and external policy documents"
          badgeClassName={statusClass.active}
        />
        <StatCard
          title="Questionnaires"
          value={items.filter(i => i.type === "questionnaire").length}
          trend={isDemo ? (items.filter(i => i.type === "questionnaire").length >= prevMonthLibrary.questionnaires ? "up" : "down") : undefined}
          trendValue={isDemo ? (prevMonthLibrary.questionnaires ? `${items.filter(i => i.type === "questionnaire").length > prevMonthLibrary.questionnaires ? "+" : ""}${Math.round(((items.filter(i => i.type === "questionnaire").length - prevMonthLibrary.questionnaires) / prevMonthLibrary.questionnaires) * 100)}% vs last month` : `${items.filter(i => i.type === "questionnaire").length}`) : undefined}
          trendLabel={isDemo ? "Assessment questionnaires" : undefined}
          description="Completed vendor and client assessments"
          badgeClassName={statusClass.active}
        />
        <StatCard
          title="Frameworks"
          value={items.filter(i => i.type === "framework").length}
          trend={isDemo ? (items.filter(i => i.type === "framework").length >= prevMonthLibrary.frameworks ? "up" : "down") : undefined}
          trendValue={isDemo ? (prevMonthLibrary.frameworks ? `${items.filter(i => i.type === "framework").length > prevMonthLibrary.frameworks ? "+" : ""}${Math.round(((items.filter(i => i.type === "framework").length - prevMonthLibrary.frameworks) / prevMonthLibrary.frameworks) * 100)}% vs last month` : `${items.filter(i => i.type === "framework").length}`) : undefined}
          trendLabel={isDemo ? "Control frameworks" : undefined}
          description="SOC 2, ISO 27001, RBI frameworks and others"
          badgeClassName={statusClass.active}
        />
        <StatCard
          title="Expiring Soon"
          value={items.filter(i => getExpiryInfo(i.expiryDate, now)?.urgent && getExpiryInfo(i.expiryDate, now)?.label !== "Expired").length}
          trend={isDemo ? "down" : undefined}
          trendValue={isDemo ? (items.length ? `${Math.round((items.filter(i => getExpiryInfo(i.expiryDate, now)?.urgent && getExpiryInfo(i.expiryDate, now)?.label !== "Expired").length / items.length) * 100)}% of library` : "0%") : undefined}
          trendLabel={isDemo ? "Within 30 days" : undefined}
          description="Documents due for review or renewal"
          badgeClassName={statusClass.draft}
        />
      </motion.div>

      {/* Alerts — badge-style (matches DocumentDetail Expiring Soon) */}
      {items.some(i => getExpiryInfo(i.expiryDate, now)?.urgent) && (
        <motion.div variants={pageItem} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 font-bold">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <IconAlertTriangleFilled className="h-6 w-6 opacity-90" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200">Action Required: Document Renewals</h3>
              <p className="text-xs opacity-90 mt-0.5 text-amber-700/80 dark:text-amber-300/80">You have documents that are expired or expiring within 30 days.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 border-amber-500/30 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20" onClick={() => setSearch("expire")}>
            Review Now
          </Button>
        </motion.div>
      )}

      {/* Batch Actions Toolbar */}
      {selectedCount > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="flex items-center justify-between p-3 rounded-xl border border-primary/20 bg-primary/5 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Badge className="bg-primary text-primary-foreground">{selectedCount}</Badge>
            <span className="text-sm font-medium text-foreground">Documents Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 border-foreground/10 hover:bg-background">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Download
            </Button>
            <Button size="sm" variant="outline" className="h-8 border-foreground/10 hover:bg-background">
              <Archive className="h-3.5 w-3.5 mr-1.5" /> Archive
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => setRowSelection({})}>
              <X className="h-4 w-4 mr-1.5" /> Cancel
            </Button>
          </div>
        </motion.div>
      )}

      {/* Main Table Section */}
      <motion.div variants={pageItem} className="w-full">
        <GenericDataTable
          columns={columns}
          data={filtered}
          searchKey="name"
          searchPlaceholder="Search by name..."
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          onRowClick={(row) => navigate(`/library/${row.id}`)}
          onTabChange={setActiveTab}
          tabs={[
            { value: "all", label: "All Documents" },
            { 
              value: "expiring", 
              label: "Expiring Soon", 
              badge: items.filter(i => getExpiryInfo(i.expiryDate, now)?.urgent && getExpiryInfo(i.expiryDate, now)?.label !== "Expired").length,
              badgeClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            },
            { 
              value: "expired", 
              label: "Expired", 
              badge: items.filter(i => getExpiryInfo(i.expiryDate, now)?.label === "Expired").length,
              badgeClassName: "bg-red-500/10 text-red-600 dark:text-red-400"
            },
          ]}
          defaultTab={activeTab}
        />
      </motion.div>
      </>
      )}
    </motion.div>
  );
};

export default DocumentLibrary;
