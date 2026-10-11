import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    ArrowLeft,
    FileText,
    Calendar,
    Tag,
    Shield,
    Download,
    Share2,
    MoreVertical,
    History,
    Info,
    ExternalLink,
    Database,
    Users,
    AlertCircle,
    Clock,
    Link
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

// Mock data (in a real app, you'd fetch this based on the ID)
const getDocumentData = (id: string) => ({
    id,
    name: id === "1" ? "Information Security Policy v4.1" : "Documentation Detail",
    type: "policy",
    description: "Core organizational policy outlining security responsibilities, data protection standards, and incident response protocols. This document is a primary evidence source for SOC 2 and ISO 27001 audits.",
    tags: ["SOC2", "ISO27001", "Compliance", "Security"],
    lastUpdated: "Feb 18, 2026",
    owner: "Chief Security Officer",
    status: "active",
    version: "4.1",
    fileSize: "2.4 MB",
    pageCount: 18,
    expiryDate: "2026-03-05", // Example YYYY-MM-DD
    department: "Security",
    classification: "Internal",
    effectiveDate: "2024-01-15",
    lastRenewalDate: "2025-01-15",
    aiInsights: [
        "Covers all 5 Trust Services Criteria for SOC 2 Type II.",
        "Strong encryption standards defined for data at rest (AES-256).",
        "Missing explicit mention of biometric physical access controls.",
    ],
    linkedControls: [
        { id: "CC6.1", name: "Logical Access Security", framework: "SOC 2", status: "mapped" },
        { id: "CC6.2", name: "User Registration", framework: "SOC 2", status: "mapped" },
        { id: "A.9.1.1", name: "Access Control Policy", framework: "ISO 27001", status: "mapped" },
        { id: "A.9.2.2", name: "User Access Provisioning", framework: "ISO 27001", status: "mapped" },
        { id: "SC-7", name: "Boundary Protection", framework: "NIST CSF", status: "review-needed" }
    ],
    history: [
        { version: "4.1", date: "Feb 18, 2026", user: "Michael Chen", change: "Updated encryption standards" },
        { version: "4.0", date: "Jan 12, 2026", user: "Sarah Jenkins", change: "Major revision for 2026 compliance" },
        { version: "3.2", date: "Nov 02, 2025", user: "Michael Chen", change: "Minor fixes to HR section" },
    ]
});

const getExpiryInfo = (dateStr?: string) => {
    if (!dateStr) return null;
    const days = Math.ceil((new Date(dateStr).getTime() - new Date("Feb 26, 2026").getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { label: "Expired", desc: "This document has passed its renewal date. Action is immediately required.", class: "bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20", textClass: "", icon: AlertCircle, urgent: true };
    if (days <= 30) return { label: "Expiring Soon", desc: `This document will expire in ${days} days. Please review and renew it.`, class: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20", textClass: "", icon: Clock, urgent: true };
    return { label: "Active", class: "", textClass: "", icon: Calendar, urgent: false };
};

const DocumentDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const doc = getDocumentData(id || "1");

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex-1 overflow-auto bg-background antialiased p-6 space-y-6"
        >
            {/* Breadcrumbs & Actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/library")}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Library
                    </Button>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="default" className="h-10 px-5 rounded-lg font-medium">
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
                    </Button>
                    <Button variant="outline" size="default" className="h-10 px-5 rounded-lg font-medium">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                    </Button>
                    <Button size="default" className="h-10 px-5 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all active:scale-[0.98]" onClick={() => navigate(`/library/${id}/edit`)}>
                        Edit
                    </Button>
                </div>
            </div>

            {/* Expiry Banner */}
            {(() => {
                const info = getExpiryInfo(doc.expiryDate);
                if (info?.urgent) {
                    const Icon = info.icon;
                    return (
                        <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border", info.class)}>
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5">
                                    <Icon className="h-5 w-5 opacity-90" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold">{info.label}</h3>
                                    <p className="text-xs opacity-90 mt-0.5">{info.desc}</p>
                                </div>
                            </div>
                            <Button size="sm" variant="outline" className={cn("shrink-0", info.label === "Expiring Soon" ? "border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20" : "border-red-500/30 bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20")} onClick={() => navigate(`/library/${id}/edit`)}>
                                Renew Document
                            </Button>
                        </div>
                    );
                }
                return null;
            })()}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-border/40 shadow-sm overflow-hidden">
                        <CardHeader className="bg-card border-b border-border/40 p-6">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-14 w-14 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center">
                                        <FileText className="h-7 w-7 text-primary" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h1 className="text-2xl font-bold tracking-tight text-foreground">{doc.name}</h1>
                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 capitalize">
                                                {doc.status}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Modified {doc.lastUpdated}</span>
                                            <span className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> v{doc.version}</span>
                                            <span className="flex items-center gap-1.5 font-medium underline decoration-primary/30 cursor-pointer"><Shield className="h-3.5 w-3.5" /> {doc.owner}</span>
                                        </div>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-8 bg-card/50">
                            <section>
                                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Overview</h3>
                                <p className="text-sm text-foreground/80 leading-relaxed font-medium capitalize-first">
                                    {doc.description}
                                </p>
                            </section>

                            <section>
                                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Keywords & Tags</h3>
                                <div className="flex flex-wrap gap-2">
                                    {doc.tags.map(tag => (
                                        <Badge key={tag} variant="outline" className="bg-muted/50 border-border text-foreground dark:bg-muted/30 dark:border-border/80">
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            </section>

                            <Separator className="bg-border/40" />

                            <section>
<div className="flex items-center gap-2 mb-4">
                                        <div className="h-6 w-6 rounded-md bg-blue-50 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
                                            <Database className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">AI Knowledge Insights</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {doc.aiInsights.map((insight) => (
                                            <div key={insight} className="p-4 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 flex flex-col gap-2">
                                                <p className="text-xs font-medium leading-snug opacity-95">{insight}</p>
                                            </div>
                                        ))}
                                    </div>
                            </section>
                        </CardContent>
                    </Card>

                    {/* Version History Table */}
                    <Card className="border-border/40 shadow-sm overflow-hidden">
                        <CardHeader className="bg-card border-b border-border/40 p-4">
                            <div className="flex items-center gap-2">
                                <History className="h-4 w-4 text-muted-foreground" />
                                <CardTitle className="text-base font-bold">Revision History</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border/40">
                                {doc.history.map((h, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="text-sm font-bold text-foreground w-10">v{h.version}</div>
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{h.change}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{h.user} • {h.date}</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/5">
                                            Restore
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <Card className="border-border/40 shadow-sm">
                        <CardHeader className="p-4 border-b border-border/40">
                            <div className="flex items-center gap-2">
                                <Info className="h-4 w-4 text-muted-foreground" />
                                <CardTitle className="text-base font-bold">Document Info</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            {[
                                { label: "Department", value: doc.department, icon: Users },
                                { label: "Classification", value: doc.classification, icon: Shield },
                                { label: "Effective Date", value: doc.effectiveDate || "—", icon: Calendar },
                                { label: "Last Renewed", value: doc.lastRenewalDate || "—", icon: Clock },
                                { label: "Expiry Date", value: doc.expiryDate || "—", icon: Calendar },
                                { label: "File Format", value: ".PDF", icon: FileText },
                                { label: "Storage Path", value: "/compliance/policies/sec-4.1.pdf", icon: ExternalLink },
                                { label: "Page Count", value: doc.pageCount.toString(), icon: FileText },
                                { label: "File Size", value: doc.fileSize, icon: ExternalLink },
                                { label: "AI Indexed", value: "Fully Indexed", icon: Database },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between py-1">
                                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                                        <item.icon className="h-3.5 w-3.5" />
                                        {item.label}
                                    </span>
                                    <span className="text-xs font-bold text-foreground">{item.value}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="border-border/40 shadow-sm">
                        <CardHeader className="p-4 border-b border-border/40 flex flex-row items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Link className="h-4 w-4 text-muted-foreground" />
                                <CardTitle className="text-base font-bold">Linked Controls</CardTitle>
                            </div>
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:border-primary/30">
                                {doc.linkedControls.length} Active
                            </Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border/40">
                                {doc.linkedControls.map((control, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                                                <Shield className={cn("h-4 w-4", control.status === "review-needed" ? "text-amber-600 dark:text-amber-400" : "text-primary")} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-foreground">{control.id}</p>
                                                    {control.status === "review-needed" && (
                                                        <span className="h-2 w-2 rounded-full bg-amber-500 dark:bg-amber-400" title="Review Suggested" />
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{control.name}</p>
                                            </div>
                                        </div>
<Badge variant="outline" className="text-[10px] shrink-0 border-border bg-muted/50 text-foreground dark:bg-muted/30 dark:border-border/80">
                                                        {control.framework}
                                                    </Badge>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 border-t border-border/40 bg-muted/30 dark:bg-muted/20">
                                <Button size="sm" variant="outline" className="w-full text-xs font-bold border-border/60 hover:bg-muted" onClick={() => navigate(`/library/${doc.id}/edit`)}>
                                    Manage Mappings
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </motion.div>
    );
};

export default DocumentDetail;
