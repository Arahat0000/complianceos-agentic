import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
    fetchComplianceGaps,
    createComplianceGap,
    updateComplianceGap,
    deleteComplianceGap,
    generateRemediationPlan,
    type BackendComplianceGap,
} from "@/lib/complianceGaps";
import { fetchOrgMembers, type BackendMember } from "@/lib/organizations";
import { useNavigate } from "react-router-dom";
import {
    FileSearch,
    UploadCloud,
    CalendarDays,
    Info,
    BadgeAlert,
    Filter,
    Plus,
    ChevronRight,
    Flag,
    Edit2,
    Trash2,
    Sparkles,
    ListChecks,
    Loader2,
} from "lucide-react";
import {
    IconCircleFilled,
    IconCircleCheckFilled,
    IconLoader,
    IconShieldFilled,
    IconClock
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
    RiskLevel,
    GapStatus,
    RISK_LEVEL_LABELS,
    GAP_STATUS_LABELS,
} from "@/types/enums";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { motion } from "motion/react";
import { pageContainer, pageItem } from "@/lib/animations";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { GenericDataTable } from "@/components/generic-data-table";
import { StatCard } from "@/components/stat-card";
import { type RowSelectionState } from "@tanstack/react-table";
import type { AppColumnDef } from "@/lib/table-features";
import { DEMO_GAPS, DEMO_REMEDIATION_PLAN } from "@/demo/complianceScenario";

// ── Types (Mapped to Schema) ──────────────────────────────────────────────────

type Issue = {
    id: string;
    title: string;
    organizationId: string;
    questionId?: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
    riskLevel: RiskLevel;
    status: GapStatus;
    assignee: { id: string; name: string; role: string; email: string };
    assigneeInitials: string;
    openedDaysAgo: number;
    evidenceNeeded: string;
    question: string; // UI alias for title
    assessment: string; // UI alias for assessment text
    section: string;
    // Human-readable code (e.g. "GAP-00001") for real backend gaps — `id`
    // itself is the real UUID needed for update/delete calls, so the ID
    // column prefers this when present instead of showing a raw UUID.
    identifier?: string;
};

// isDemo mode never calls the backend — pulled from the shared demo
// scenario (structurally an Issue[]) so it stays consistent with the
// obligations/controls this same story references elsewhere in the pipeline.
const INITIAL_ISSUES: Issue[] = DEMO_GAPS;

// engagementName/assigneeName are joined in server-side (see
// gapService.ts ComplianceGapWithRelations) — "Unlinked"/"Unassigned" is
// now only shown for gaps that genuinely have no questionId/assigneeId,
// not as a stand-in for missing data.
function mapBackendGap(g: BackendComplianceGap): Issue {
    const createdAt = new Date(g.createdAt);
    const openedDaysAgo = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)));
    const assigneeName = g.assigneeName ?? (g.assigneeId ? "Assigned" : "Unassigned");
    const initials = g.assigneeName
        ? g.assigneeName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
        : "—";
    return {
        id: g.id,
        identifier: g.identifier ?? undefined,
        title: g.title,
        question: g.title,
        assessment: g.engagementName ?? "Unlinked",
        section: g.section ?? "General",
        riskLevel: g.riskLevel,
        status: g.status,
        assignee: { id: g.assigneeId ?? "", name: assigneeName, role: "", email: "" },
        assigneeInitials: initials,
        openedDaysAgo,
        evidenceNeeded: g.evidenceNeeded ?? "",
        organizationId: g.organizationId,
        questionId: g.questionId ?? undefined,
        description: g.description ?? undefined,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
    };
}

// ── Config helpers ─────────────────────────────────────────────────────────────

const riskConfig: Record<RiskLevel, { color: string; dot: string; barColor: string }> = {
    [RiskLevel.CRITICAL]: { color: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-100 dark:border-red-500/20", dot: "bg-red-500", barColor: "bg-red-500" },
    [RiskLevel.HIGH]: { color: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-100 dark:border-red-500/20", dot: "bg-red-500", barColor: "bg-red-500" },
    [RiskLevel.MEDIUM]: { color: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-100 dark:border-amber-500/20", dot: "bg-amber-500", barColor: "bg-amber-500" },
    [RiskLevel.LOW]: { color: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground", barColor: "bg-muted" },
};

const statusConfig: Record<GapStatus, { color: string; icon: React.ReactNode }> = {
    [GapStatus.OPEN]: { color: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-100 dark:border-red-500/20", icon: <IconCircleFilled className="h-2 w-2" /> },
    [GapStatus.REMEDIATING]: { color: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-100 dark:border-blue-500/20", icon: <IconLoader className="h-3.5 w-3.5 animate-spin" /> },
    [GapStatus.RISK_ACCEPTED]: { color: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-100 dark:border-amber-500/20", icon: <IconShieldFilled className="h-3.5 w-3.5" /> },
    [GapStatus.RESOLVED]: { color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20", icon: <IconCircleCheckFilled className="h-3.5 w-3.5" /> },
};

const agingTextColor = (days: number) => days >= 14 ? "text-red-500 font-bold" : days >= 7 ? "text-amber-500 font-semibold" : "text-muted-foreground";
const agingBarColor = (days: number) => days >= 14 ? "bg-red-500" : days >= 7 ? "bg-amber-500" : "bg-emerald-500";
const agingBarWidth = (days: number) => Math.min((days / 21) * 100, 100);

/** Mock previous month counts for comparison */
const prevMonthGap = { critical: 0, high: 2, open: 5, resolved: 3 };

// ── Issue Detail Modal ─────────────────────────────────────────────────────────

function IssueDetailModal({
    issue,
    open,
    onClose,
    onUpdate,
    onDelete,
    isDemo,
    members,
    plan,
    isGeneratingPlan,
    onGeneratePlan,
}: {
    issue: Issue | null;
    open: boolean;
    onClose: () => void;
    onUpdate: (updated: Issue) => void;
    onDelete: (id: string) => void;
    isDemo: boolean;
    members: BackendMember[];
    plan: string | undefined;
    isGeneratingPlan: boolean;
    onGeneratePlan: (issue: Issue) => void;
}) {
    const [localStatus, setLocalStatus] = useState<GapStatus | "">("");
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        question: "",
        assessment: "",
        section: "",
        riskLevel: RiskLevel.HIGH as RiskLevel,
        assigneeId: "",
        assigneeName: "",
        evidenceNeeded: "",
    });
    const { toast } = useToast();
    const navigate = useNavigate();

    // sync status when modal opens
    const currentStatus = localStatus || issue?.status || GapStatus.OPEN;

    const handleSave = () => {
        if (!issue) return;
        if (isEditing) {
            const updatedIssue: Issue = {
                ...issue,
                question: editForm.question,
                assessment: editForm.assessment,
                section: editForm.section,
                riskLevel: editForm.riskLevel,
                evidenceNeeded: editForm.evidenceNeeded,
                status: currentStatus as GapStatus,
                assignee: { ...issue.assignee, id: editForm.assigneeId, name: editForm.assigneeName },
                assigneeInitials: editForm.assigneeName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?"
            };
            onUpdate(updatedIssue);
            toast({ title: "Issue updated", description: `${issue.id} has been modified.` });
            setIsEditing(false);
        } else {
            onUpdate({ ...issue, status: currentStatus as GapStatus });
            toast({ title: "Status updated", description: `${issue.id} status set to "${currentStatus}".` });
        }
        onClose();
    };

    const handleDelete = () => {
        if (!issue) return;
        onDelete(issue.id);
        toast({ title: "Issue deleted", description: `${issue.id} has been removed from the tracker.` });
        onClose();
    };

    const handleStatusAction = (status: GapStatus) => {
        setLocalStatus(status);
    };

    const startEdit = () => {
        if (!issue) return;
        setEditForm({
            question: issue.question,
            assessment: issue.assessment,
            section: issue.section,
            riskLevel: issue.riskLevel,
            assigneeId: issue.assignee?.id || "",
            assigneeName: issue.assignee?.name || "",
            evidenceNeeded: issue.evidenceNeeded,
        });
        setIsEditing(true);
    };

    if (!issue) return null;
    const rCfg = riskConfig[issue.riskLevel];

    return (
        <Dialog open={open} onOpenChange={(v) => {
            if (!v) {
                setLocalStatus("");
                setIsEditing(false);
                onClose();
            }
        }}>
            <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden rounded-2xl">
                <form onSubmit={(e) => {
                    e.preventDefault();
                    handleSave();
                }}>
                    <div className="px-6 pt-5 pb-4 pr-12">
                        <DialogHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5 mb-1">
                                    <div className={cn(
                                        "h-5 w-1 rounded-full shrink-0",
                                        issue.riskLevel === RiskLevel.CRITICAL || issue.riskLevel === RiskLevel.HIGH ? "bg-red-500" :
                                            issue.riskLevel === RiskLevel.MEDIUM ? "bg-amber-500" : "bg-muted-foreground"
                                    )} />
                                    <span className="font-mono text-xs text-muted-foreground">{issue.id}</span>
                                    {!isEditing && (
                                        <>
                                            <Badge variant="outline" className={cn("capitalize bg-background", rCfg.color)}>
                                                <span className={cn("h-1.5 w-1.5 rounded-full", rCfg.dot)} />
                                                {RISK_LEVEL_LABELS[issue.riskLevel]}
                                            </Badge>
                                            <Badge variant="outline" className={cn("capitalize bg-background", statusConfig[issue.status].color)}>
                                                {statusConfig[issue.status].icon}
                                                {GAP_STATUS_LABELS[issue.status]}
                                            </Badge>
                                        </>
                                    )}
                                </div>
                            </div>

                            {isEditing ? (
                                <div className="pt-2">
                                    <FieldGroup>
                                        <Field>
                                            <FieldLabel>Gap Description</FieldLabel>
                                            <Textarea
                                                value={editForm.question}
                                                onChange={(e) => setEditForm(f => ({ ...f, question: e.target.value }))}
                                                className="text-base font-semibold resize-none h-24"
                                                placeholder="Describe the compliance gap..."
                                            />
                                        </Field>
                                    </FieldGroup>
                                </div>
                            ) : (
                                <div className="mt-1">
                                    <DialogTitle className="text-base font-semibold leading-snug text-left">
                                        {issue.question}
                                    </DialogTitle>
                                    <DialogDescription className="text-left pt-1">
                                        <span className="font-medium text-foreground/70">{issue.assessment}</span>
                                        <span className="mx-1.5 text-muted-foreground/40">·</span>
                                        <span>{issue.section}</span>
                                    </DialogDescription>
                                </div>
                            )}
                        </DialogHeader>
                    </div>

                    <Separator />

                    <ScrollArea className="max-h-[55vh]">
                        <div className="px-6 py-5 space-y-6">
                            {isEditing ? (
                                <FieldGroup>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Field>
                                            <FieldLabel>Assessment</FieldLabel>
                                            <Input
                                                value={editForm.assessment}
                                                onChange={(e) => setEditForm(f => ({ ...f, assessment: e.target.value }))}
                                                placeholder="Assessment name"
                                            />
                                        </Field>
                                        <Field>
                                            <FieldLabel>Section</FieldLabel>
                                            <Input
                                                value={editForm.section}
                                                onChange={(e) => setEditForm(f => ({ ...f, section: e.target.value }))}
                                                placeholder="Section / Control"
                                            />
                                        </Field>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <Field>
                                            <FieldLabel>Owner</FieldLabel>
                                            {isDemo ? (
                                                <Input
                                                    value={editForm.assigneeName}
                                                    onChange={(e) => setEditForm(f => ({ ...f, assigneeName: e.target.value }))}
                                                    placeholder="Owner name"
                                                />
                                            ) : (
                                                <Select
                                                    value={editForm.assigneeId}
                                                    onValueChange={(id) => {
                                                        const member = members.find((m) => m.userId === id);
                                                        setEditForm(f => ({ ...f, assigneeId: id, assigneeName: member?.name ?? "" }));
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select owner..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {members.map((m) => (
                                                            <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </Field>
                                        <Field>
                                            <FieldLabel>Risk Level</FieldLabel>
                                            <Select value={editForm.riskLevel} onValueChange={(v) => setEditForm(f => ({ ...f, riskLevel: v as RiskLevel }))}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value={RiskLevel.CRITICAL}>🔴 Critical</SelectItem>
                                                    <SelectItem value={RiskLevel.HIGH}>🔴 High</SelectItem>
                                                    <SelectItem value={RiskLevel.MEDIUM}>🟡 Medium</SelectItem>
                                                    <SelectItem value={RiskLevel.LOW}>⚪ Low</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </Field>
                                    </div>

                                    <Field>
                                        <FieldLabel>Evidence Required to Close</FieldLabel>
                                        <Input
                                            value={editForm.evidenceNeeded}
                                            onChange={(e) => setEditForm(f => ({ ...f, evidenceNeeded: e.target.value }))}
                                            placeholder="What doc is needed?"
                                        />
                                    </Field>
                                </FieldGroup>
                            ) : (
                                <>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Assigned To</p>
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-bold">
                                                    {issue.assigneeInitials}
                                                </div>
                                                <span className="text-sm font-medium">{issue.assignee?.name || "Unassigned"}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Days Open</p>
                                            <div className="flex items-center gap-1.5">
                                                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className={cn("text-sm font-bold", agingTextColor(issue.openedDaysAgo))}>
                                                    {issue.openedDaysAgo} days
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Update Status</p>
                                            <Select value={currentStatus} onValueChange={(v) => setLocalStatus(v as GapStatus)}>
                                                <SelectTrigger className="h-7 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value={GapStatus.OPEN}>Open</SelectItem>
                                                    <SelectItem value={GapStatus.REMEDIATING}>In Remediation</SelectItem>
                                                    <SelectItem value={GapStatus.RISK_ACCEPTED}>Risk Accepted</SelectItem>
                                                    <SelectItem value={GapStatus.RESOLVED}>Resolved</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Evidence Required to Close</p>
                                        <div className="flex items-start gap-3 rounded-xl border border-dashed bg-muted/30 p-3.5">
                                            <FileSearch className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                            <p className="text-sm leading-snug text-foreground">{issue.evidenceNeeded}</p>
                                        </div>
                                    </div>

                                    {plan && (
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Remediation Plan</p>
                                            <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10 p-3.5">
                                                <ListChecks className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                                <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed whitespace-pre-line">{plan}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Quick Actions</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="gap-1.5 h-9 border-dashed text-xs"
                                                onClick={() => navigate("/library/upload")}
                                            >
                                                <UploadCloud className="h-3.5 w-3.5" />
                                                Upload Evidence
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="gap-1.5 h-9 text-xs"
                                                onClick={() => onGeneratePlan(issue)}
                                                disabled={isGeneratingPlan}
                                            >
                                                {isGeneratingPlan ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <Sparkles className="h-3.5 w-3.5" />
                                                )}
                                                {plan ? "Regenerate Plan" : "Generate Plan"}
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className={cn(
                                                    "gap-1.5 h-9 text-xs font-semibold col-span-1",
                                                    "border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-600"
                                                )}
                                                onClick={() => handleStatusAction(GapStatus.RESOLVED)}
                                            >
                                                <IconCircleCheckFilled className="h-3.5 w-3.5" />
                                                Mark Resolved
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </ScrollArea>

                    <Separator />

                    <DialogFooter className="p-6 border-t bg-muted/30 flex flex-row items-center justify-between sm:justify-between">
                        {!isEditing ? (
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-foreground h-9 px-3"
                                    onClick={startEdit}
                                >
                                    <Edit2 className="h-3.5 w-3.5 mr-2" />
                                    Edit Details
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-9 px-3"
                                        >
                                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                                            Delete
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete this issue?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Are you sure you want to delete this issue? This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction variant="destructive" onClick={handleDelete}>
                                                Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        ) : (
                            <div />
                        )}
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={() => isEditing ? setIsEditing(false) : onClose()}>
                                Cancel
                            </Button>
                            <Button size="sm" className="px-6" type="submit">
                                {isEditing ? "Save Edits" : "Save Changes"}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── New Gap Modal ──────────────────────────────────────────────────────────────

function NewGapModal({
    open,
    onClose,
    onCreated,
    nextId,
    isDemo,
    members,
}: {
    open: boolean;
    onClose: () => void;
    onCreated: (issue: Issue) => void;
    nextId: string;
    isDemo: boolean;
    members: BackendMember[];
}) {
    const { toast } = useToast();
    const [form, setForm] = useState({
        question: "",
        assessment: "",
        section: "",
        riskLevel: RiskLevel.HIGH as RiskLevel,
        assigneeId: "",
        assigneeName: "",
        evidenceNeeded: "",
    });

    const reset = () => setForm({ question: "", assessment: "", section: "", riskLevel: RiskLevel.HIGH, assigneeId: "", assigneeName: "", evidenceNeeded: "" });

    const handleCreate = () => {
        if (!form.question.trim() || !form.assessment.trim()) return;
        const initials = form.assigneeName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

        const newIssue: Issue = {
            id: nextId,
            title: form.question.trim(), // title is required by ComplianceGap
            question: form.question.trim(),
            assessment: form.assessment.trim(),
            section: form.section.trim() || "General",
            riskLevel: form.riskLevel,
            status: GapStatus.OPEN,
            assignee: { id: form.assigneeId || `u-${Date.now()}`, name: form.assigneeName.trim() || "Unassigned", role: "Owner", email: "" },
            assigneeInitials: initials || "?",
            openedDaysAgo: 0,
            evidenceNeeded: form.evidenceNeeded.trim() || "Evidence document required",
            organizationId: "org1",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        onCreated(newIssue);
        toast({ title: `🚩 Gap created — ${nextId}`, description: `"${form.question.slice(0, 60)}..." has been added to the tracker.` });
        reset();
        onClose();
    };

    const isValid = form.question.trim() && form.assessment.trim();

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
            <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden rounded-2xl">
                <form onSubmit={(e) => {
                    e.preventDefault();
                    handleCreate();
                }}>
                    <div className="px-6 pt-5 pb-4">
                        <DialogHeader>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-5 w-1 rounded-full bg-red-500 shrink-0" />
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10">
                                    <Flag className="h-3.5 w-3.5 text-red-500" />
                                </div>
                                <DialogTitle className="text-base">Create New Gap</DialogTitle>
                            </div>
                            <DialogDescription>
                                Manually flag a compliance gap that needs remediation. It will appear in the tracker immediately.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <Separator />

                    <div className="px-6 py-5">
                        <FieldGroup>
                            <Field>
                                <FieldLabel>Gap Description <span className="text-red-500">*</span></FieldLabel>
                                <Textarea
                                    placeholder="e.g. No policy exists for remote access MFA enforcement."
                                    className="resize-none min-h-[80px] text-sm"
                                    value={form.question}
                                    onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                                    required
                                />
                            </Field>

                            <div className="grid grid-cols-2 gap-4">
                                <Field>
                                    <FieldLabel>Assessment<span className="text-red-500">*</span></FieldLabel>
                                    <Select value={form.assessment} onValueChange={(v) => setForm((f) => ({ ...f, assessment: v }))}>
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue placeholder="Select assessment ..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="RBI Information Security Audit">RBI Information Security Audit</SelectItem>
                                            <SelectItem value="ISO 27001 Assessment">ISO 27001 Assessment</SelectItem>
                                            <SelectItem value="2026 ESG Reporting">2026 ESG Reporting</SelectItem>
                                            <SelectItem value="Vendor Risk Assessment Q1">Vendor Risk Assessment Q1</SelectItem>
                                            <SelectItem value="HR Privacy & Compliance Audit">HR Privacy & Compliance Audit</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field>
                                    <FieldLabel>Section / Domain</FieldLabel>
                                    <Input
                                        placeholder="e.g. Access Control"
                                        className="h-9 text-sm"
                                        value={form.section}
                                        onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
                                    />
                                </Field>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Field>
                                    <FieldLabel>Risk Level</FieldLabel>
                                    <Select value={form.riskLevel} onValueChange={(v) => setForm((f) => ({ ...f, riskLevel: v as RiskLevel }))}>
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={RiskLevel.CRITICAL}>🔴 Critical</SelectItem>
                                            <SelectItem value={RiskLevel.HIGH}>🔴 High</SelectItem>
                                            <SelectItem value={RiskLevel.MEDIUM}>🟡 Medium</SelectItem>
                                            <SelectItem value={RiskLevel.LOW}>⚪ Low</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field>
                                    <FieldLabel>Assign To</FieldLabel>
                                    {isDemo ? (
                                        <Select value={form.assigneeName} onValueChange={(v) => setForm((f) => ({ ...f, assigneeName: v }))}>
                                            <SelectTrigger className="h-9 text-sm">
                                                <SelectValue placeholder="Select assignee..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Sarah Chen">Sarah Chen</SelectItem>
                                                <SelectItem value="Mike Johnson">Mike Johnson</SelectItem>
                                                <SelectItem value="Lisa Park">Lisa Park</SelectItem>
                                                <SelectItem value="Tom Hayes">Tom Hayes</SelectItem>
                                                <SelectItem value="Elena Rodriguez">Elena Rodriguez</SelectItem>
                                                <SelectItem value="David Smith">David Smith</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Select
                                            value={form.assigneeId}
                                            onValueChange={(id) => {
                                                const member = members.find((m) => m.userId === id);
                                                setForm((f) => ({ ...f, assigneeId: id, assigneeName: member?.name ?? "" }));
                                            }}
                                        >
                                            <SelectTrigger className="h-9 text-sm">
                                                <SelectValue placeholder="Select assignee..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {members.map((m) => (
                                                    <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </Field>
                            </div>

                            <Field>
                                <FieldLabel>Evidence Needed</FieldLabel>
                                <Input
                                    placeholder="e.g. Password Policy Doc"
                                    className="h-9 text-sm"
                                    value={form.evidenceNeeded}
                                    onChange={(e) => setForm((f) => ({ ...f, evidenceNeeded: e.target.value }))}
                                />
                            </Field>
                        </FieldGroup>
                    </div>

                    <DialogFooter className="px-6 py-4 border-t bg-muted/30">
                        <DialogClose asChild>
                            <Button type="button" variant="ghost">Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={!isValid} className="px-8">
                            Create Issue
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

const Gaps = () => {
    const navigate = useNavigate();
    const { isDemo } = useAuth();
    const { toast } = useToast();
    const [issues, setIssues] = useState<Issue[]>(isDemo ? INITIAL_ISSUES : []);
    const [isLoading, setIsLoading] = useState(!isDemo);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
    const [showNewGap, setShowNewGap] = useState(false);
    const [filterRisk, setFilterRisk] = useState<string>("all");
    const [members, setMembers] = useState<BackendMember[]>([]);
    const [openRowSelection, setOpenRowSelection] = useState<RowSelectionState>({});
    const [agingRowSelection, setAgingRowSelection] = useState<RowSelectionState>({});
    const [plans, setPlans] = useState<Record<string, string>>({});
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

    const handleGeneratePlan = async (issue: Issue) => {
        setIsGeneratingPlan(true);
        try {
            let plan: string;
            if (isDemo) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                plan = DEMO_REMEDIATION_PLAN;
            } else {
                const result = await generateRemediationPlan(issue.id);
                plan = result.plan;
            }
            setPlans((prev) => ({ ...prev, [issue.id]: plan }));
        } catch (err) {
            toast({ title: "Failed to generate remediation plan", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
        } finally {
            setIsGeneratingPlan(false);
        }
    };

    useEffect(() => {
        if (isDemo) return;
        fetchComplianceGaps()
            .then((data) => {
                setLoadError(null);
                setIssues(data.map(mapBackendGap));
            })
            .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load compliance gaps"))
            .finally(() => setIsLoading(false));
    }, [isDemo]);

    // Powers the real assignee picker in both modals (see NewGapModal /
    // IssueDetailModal) — demo mode keeps its own hardcoded name list.
    useEffect(() => {
        if (isDemo) return;
        fetchOrgMembers().then(setMembers).catch(() => setMembers([]));
    }, [isDemo]);

    const criticalCount = issues.filter((i) => i.riskLevel === RiskLevel.CRITICAL && i.status === GapStatus.OPEN).length;
    const highCount = issues.filter((i) => i.riskLevel === RiskLevel.HIGH && i.status === GapStatus.OPEN).length;
    const openCount = issues.filter((i) => i.status === GapStatus.OPEN || i.status === GapStatus.REMEDIATING).length;
    const resolvedCount = issues.filter((i) => i.status === GapStatus.RESOLVED).length;

    const nextId = `GAP-${String(issues.length + 1).padStart(3, "0")}`;

    const filteredIssues = useMemo(() => {
        return issues.filter((issue) => {
            const matchesRisk = filterRisk === "all" || issue.riskLevel === filterRisk;
            return matchesRisk;
        });
    }, [issues, filterRisk]);

    // The detail/edit modal always builds a fully-formed local Issue
    // (whether it was just a status change or a full field edit) — for
    // real sessions we PATCH the same field set every time and then trust
    // the server's response rather than the locally-fabricated object
    // (which has a made-up assignee name the backend has no matching id for).
    const handleUpdate = async (updated: Issue) => {
        if (isDemo) {
            setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
            return;
        }
        try {
            const saved = await updateComplianceGap(updated.id, {
                title: updated.question,
                description: updated.description,
                riskLevel: updated.riskLevel,
                status: updated.status,
                evidenceNeeded: updated.evidenceNeeded,
                section: updated.section,
                assigneeId: updated.assignee?.id || undefined,
            });
            setIssues((prev) => prev.map((i) => (i.id === saved.id ? mapBackendGap(saved) : i)));
        } catch (err) {
            toast({ title: "Failed to update gap", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
        }
    };

    const handleDelete = async (id: string) => {
        if (isDemo) {
            setIssues(prev => prev.filter(i => i.id !== id));
            setSelectedIssue(null);
            return;
        }
        try {
            await deleteComplianceGap(id);
            setIssues(prev => prev.filter(i => i.id !== id));
            setSelectedIssue(null);
        } catch (err) {
            toast({ title: "Failed to delete gap", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
        }
    };

    // NewGapModal always builds a complete local Issue for the demo path;
    // for real sessions we forward the fields the backend actually models,
    // including assigneeId when the real member picker set one, and use
    // its response.
    const handleCreated = async (issue: Issue) => {
        if (isDemo) {
            setIssues((prev) => [issue, ...prev]);
            return;
        }
        try {
            const saved = await createComplianceGap({
                title: issue.question,
                riskLevel: issue.riskLevel,
                evidenceNeeded: issue.evidenceNeeded,
                section: issue.section,
                assigneeId: issue.assignee?.id || undefined,
            });
            setIssues((prev) => [mapBackendGap(saved), ...prev]);
        } catch (err) {
            toast({ title: "Failed to create gap", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
        }
    };

    const evidenceRequests = issues.filter(
        (i) => i.status !== GapStatus.RESOLVED && i.status !== GapStatus.RISK_ACCEPTED
    );

    const openColumns = useMemo<AppColumnDef<Issue>[]>(() => [
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
            accessorKey: "id",
            header: "ID",
            cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.identifier ?? row.original.id}</span>,
        },
        {
            accessorKey: "question",
            header: "Question / Gap",
            cell: ({ row }) => {
                const item = row.original;
                const rCfg = riskConfig[item.riskLevel];
                return (
                    <div className="flex items-start gap-2.5">
                        <span className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", rCfg.dot)} />
                        <div>
                            <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                {item.question}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{item.section}</p>
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: "assessment",
            header: "Assessment",
            cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.assessment}</span>,
        },
        {
            accessorKey: "riskLevel",
            header: "Risk",
            cell: ({ row }) => {
                const rCfg = riskConfig[row.original.riskLevel];
                return (
                    <Badge variant="outline" className={cn("capitalize shrink-0 bg-background", rCfg.color)}>
                        {RISK_LEVEL_LABELS[row.original.riskLevel]}
                    </Badge>
                );
            },
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const sCfg = statusConfig[row.original.status];
                return (
                    <Badge variant="outline" className={cn("capitalize shrink-0", sCfg.color)}>
                        {sCfg.icon}
                        <span className="ml-1">{GAP_STATUS_LABELS[row.original.status]}</span>
                    </Badge>
                );
            },
        },
        {
            accessorKey: "assignee",
            header: "Assigned To",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-bold shrink-0">
                        {row.original.assigneeInitials}
                    </div>
                    <span className="text-xs text-muted-foreground">{row.original.assignee?.name || "Unassigned"}</span>
                </div>
            ),
        },
        {
            accessorKey: "openedDaysAgo",
            header: () => <div className="text-right pr-4">Days</div>,
            cell: ({ row }) => (
                <div className="flex items-center justify-end gap-2 pr-4">
                    <span className={cn("text-xs font-medium", agingTextColor(row.original.openedDaysAgo))}>
                        {row.original.openedDaysAgo}d
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
            ),
        },
    ], []);

    const agingColumns = useMemo<AppColumnDef<Issue>[]>(() => [
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
            accessorKey: "id",
            header: "Gap ID",
            cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.identifier ?? row.original.id}</span>,
        },
        {
            accessorKey: "question",
            header: "Question",
            cell: ({ row }) => (
                <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
                    {row.original.question}
                </p>
            ),
        },
        {
            accessorKey: "riskLevel",
            header: "Risk",
            cell: ({ row }) => {
                const rCfg = riskConfig[row.original.riskLevel];
                return (
                    <Badge variant="outline" className={cn("capitalize shrink-0 bg-background", rCfg.color)}>
                        {RISK_LEVEL_LABELS[row.original.riskLevel]}
                    </Badge>
                );
            },
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const sCfg = statusConfig[row.original.status];
                return (
                    <Badge variant="outline" className={cn("capitalize shrink-0", sCfg.color)}>
                        {sCfg.icon}
                        <span className="ml-1">{GAP_STATUS_LABELS[row.original.status]}</span>
                    </Badge>
                );
            },
        },
        {
            accessorKey: "openedDaysAgo",
            header: () => <div className="text-right pr-4">Aging</div>,
            cell: ({ row }) => {
                const days = row.original.openedDaysAgo;
                return (
                    <div className="flex items-center gap-3 justify-end pr-4">
                        <div className="w-20 sm:w-28">
                            <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden border border-border">
                                <div
                                    className={cn("h-full rounded-full transition-all", agingBarColor(days))}
                                    style={{ width: `${agingBarWidth(days)}%` }}
                                />
                            </div>
                        </div>
                        <span className={cn("text-xs w-8 sm:w-10 text-right tabular-nums font-medium", agingTextColor(days))}>
                            {days}d
                        </span>
                    </div>
                );
            },
        },
    ], []);

    return (
        <motion.div
            variants={pageContainer}
            initial="hidden"
            animate="show"
            className="flex-1 overflow-auto p-4 md:p-6 space-y-6 min-w-0"
        >
            <motion.div variants={pageItem} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Gaps & Remediation</h1>
                    <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                        Track every compliance gap and generate a remediation plan for it.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        size="default"
                        className="h-10 px-5 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all active:scale-[0.98] gap-1.5 flex-1 sm:flex-none"
                        onClick={() => setShowNewGap(true)}
                    >
                        <Plus className="h-4 w-4 stroke-[3px]" />
                        New Gap
                    </Button>
                </div>
            </motion.div>

            {loadError && (
                <motion.div
                    variants={pageItem}
                    className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                >
                    Failed to load compliance gaps: {loadError}
                </motion.div>
            )}

            {isLoading ? (
                <motion.div variants={pageItem} className="flex items-center justify-center py-24 text-sm text-muted-foreground">
                    Loading compliance gaps…
                </motion.div>
            ) : (
            <>
            {criticalCount > 0 && (
                <motion.div
                    variants={pageItem}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 font-bold"
                >
                    <div className="flex items-start gap-3">
                        <div>
                            <h3 className="text-sm font-bold">
                                Export is blocked — {criticalCount} critical gap{criticalCount > 1 ? "s" : ""} must be resolved or formally Risk Accepted.
                            </h3>
                            <p className="text-xs opacity-90 mt-0.5">
                                Auditors require every Critical issue to be addressed before compliance can be signed off.
                            </p>
                        </div>
                    </div>
                    <Badge variant="outline" className="w-fit shrink-0 bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20">
                        {criticalCount} Blocker{criticalCount > 1 ? "s" : ""}
                    </Badge>
                </motion.div>
            )}

            <motion.div variants={pageItem} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Critical Gaps"
                    value={criticalCount}
                    trend={criticalCount > 0 ? "up" : undefined}
                    trendValue={issues.length ? `${Math.round((criticalCount / issues.length) * 100)}% of total` : criticalCount}
                    trendLabel={criticalCount > 0 ? "Must resolve or risk accept" : undefined}
                    description="Export blocked until addressed"
                    badgeClassName="bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                />
                <StatCard
                    title="High Risk Open"
                    value={highCount}
                    trend={highCount <= prevMonthGap.high ? "down" : "up"}
                    trendValue={openCount ? `${Math.round((highCount / openCount) * 100)}% of open` : `${highCount}`}
                    trendLabel="High priority remediation"
                    description="Open high-risk issues"
                    badgeClassName="bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                />
                <StatCard
                    title="Total Open / In Progress"
                    value={openCount}
                    trend={openCount >= prevMonthGap.open ? "up" : "down"}
                    trendValue={prevMonthGap.open ? `${openCount > prevMonthGap.open ? "+" : ""}${Math.round(((openCount - prevMonthGap.open) / prevMonthGap.open) * 100)}% vs last month` : `${openCount}`}
                    trendLabel="Open or in remediation"
                    description="Gaps not yet closed"
                    badgeClassName="bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
                />
                <StatCard
                    title="Resolved Today"
                    value={resolvedCount}
                    trend="up"
                    trendValue={issues.length ? `${Math.round((resolvedCount / issues.length) * 100)}% closure` : resolvedCount}
                    trendLabel="Closed this session"
                    description="Successfully remediated gaps"
                    badgeClassName="bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                />
            </motion.div>

            <motion.div variants={pageItem}>
                <Tabs defaultValue="open-issues" className="space-y-4">
                    <TabsList className="h-auto w-full sm:w-fit justify-start overflow-x-auto rounded-lg bg-muted p-1 flex flex-nowrap [&::-webkit-scrollbar]:hidden border border-border/50">
                        <TabsTrigger value="open-issues" className="flex-1 sm:flex-none min-w-max sm:min-w-0 rounded-md gap-2 text-[11px] sm:text-xs font-semibold py-2 px-3 sm:px-4">
                            <BadgeAlert className="h-3.5 w-3.5 shrink-0" />
                            <span className="whitespace-nowrap">Open Issues</span>
                            {openCount > 0 && (
                                <span className="ml-1 flex h-5 min-w-5 px-2 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold shrink-0">
                                    {openCount}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="evidence-requests" className="flex-1 sm:flex-none min-w-max sm:min-w-0 rounded-md gap-2 text-[11px] sm:text-xs font-semibold py-2 px-3 sm:px-4">
                            <FileSearch className="h-3.5 w-3.5 shrink-0" />
                            <span className="whitespace-nowrap">Evidence</span>
                        </TabsTrigger>
                        <TabsTrigger value="aging-report" className="flex-1 sm:flex-none min-w-max sm:min-w-0 rounded-md gap-2 text-[11px] sm:text-xs font-semibold py-2 px-3 sm:px-4">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            <span className="whitespace-nowrap">Aging</span>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="open-issues" className="mt-0">
                        <GenericDataTable
                            columns={openColumns}
                            data={filteredIssues}
                            searchKey="question"
                            searchPlaceholder="Search by question, assessment, or ID..."
                            onRowClick={(row) => setSelectedIssue(row)}
                            rowSelection={openRowSelection}
                            onRowSelectionChange={setOpenRowSelection}
                            actions={
                                <div className="flex gap-2">
                                    <Select value={filterRisk} onValueChange={setFilterRisk}>
                                        <SelectTrigger className="h-8 w-32 text-xs">
                                            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                                            <SelectValue placeholder="Risk" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Risks</SelectItem>
                                            <SelectItem value={RiskLevel.CRITICAL}>Critical</SelectItem>
                                            <SelectItem value={RiskLevel.HIGH}>High</SelectItem>
                                            <SelectItem value={RiskLevel.MEDIUM}>Medium</SelectItem>
                                            <SelectItem value={RiskLevel.LOW}>Low</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            }
                        />
                    </TabsContent>

                    <TabsContent value="evidence-requests" className="space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-xl px-4 py-3 border border-border/50">
                            <Info className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0" />
                            <span>
                                This is the AI's <strong>"Shopping List"</strong> — specific documents it needs to close these gaps. Upload them to the Knowledge Library to auto-resolve.
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {evidenceRequests.map((req) => {
                                const rCfg = riskConfig[req.riskLevel];
                                return (
                                    <Card
                                        key={req.id}
                                        className={cn(
                                            "border transition-all hover:shadow-md cursor-pointer group bg-card",
                                            "border-border/60"
                                        )}
                                        onClick={() => setSelectedIssue(req)}
                                    >
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center justify-between mb-1">
                                                <Badge variant="outline" className={cn("capitalize shrink-0 bg-background", rCfg.color)}>
                                                    {RISK_LEVEL_LABELS[req.riskLevel]} Risk
                                                </Badge>
                                                <span className="font-mono text-[10px] text-muted-foreground">{req.id}</span>
                                            </div>
                                            <CardTitle className="text-sm leading-snug group-hover:text-primary transition-colors">
                                                {req.evidenceNeeded}
                                            </CardTitle>
                                            <CardDescription className="text-[11px]">{req.assessment}</CardDescription>
                                        </CardHeader>
                                        <CardContent className="pt-0 space-y-3">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span>Assigned to {req.assignee?.name || "Unassigned"}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-9 text-xs gap-1.5 border-dashed"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate("/library/upload");
                                                    }}
                                                >
                                                    Upload
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-9 text-xs gap-1.5 text-primary hover:bg-primary/5"
                                                    onClick={(e) => { e.stopPropagation(); navigate("/library"); }}
                                                >
                                                    Browse Library
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </TabsContent>

                    <TabsContent value="aging-report" className="mt-0">
                        <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-xl px-4 py-3 border border-border/50">
                            <IconClock className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0" />
                            <span>
                                Auditors use aging data to assess remediation speed. <strong>Gaps open for 14+ days</strong> attract scrutiny.
                            </span>
                        </div>
                        <GenericDataTable
                            columns={agingColumns}
                            data={[...issues].sort((a, b) => b.openedDaysAgo - a.openedDaysAgo)}
                            searchKey="question"
                            searchPlaceholder="Search gaps..."
                            onRowClick={(row) => setSelectedIssue(row)}
                            rowSelection={agingRowSelection}
                            onRowSelectionChange={setAgingRowSelection}
                        />
                    </TabsContent>
                </Tabs>
            </motion.div>
            </>
            )}

            <IssueDetailModal
                issue={selectedIssue}
                open={!!selectedIssue}
                onClose={() => setSelectedIssue(null)}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                isDemo={isDemo}
                members={members}
                plan={selectedIssue ? plans[selectedIssue.id] : undefined}
                isGeneratingPlan={isGeneratingPlan}
                onGeneratePlan={handleGeneratePlan}
            />
            <NewGapModal
                open={showNewGap}
                onClose={() => setShowNewGap(false)}
                onCreated={handleCreated}
                nextId={nextId}
                isDemo={isDemo}
                members={members}
            />
        </motion.div>
    );
};

export default Gaps;
