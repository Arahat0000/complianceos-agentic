import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Upload,
    Tag,
    BookOpen,
    Rocket,
    FileText,
    Database,
    X,
    Info,
    File,
    CheckCircle2,
    AlertCircle,
    FolderOpen,
    Users,
    Shield,
    Building2,
    Calendar,
    Lock,
    Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { motion } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";
import { uploadDocument } from "@/lib/documents";

// ─── Types ────────────────────────────────────────────────────────────────────
interface UploadData {
    file: File | null;
    fileName: string;
    name: string;
    description: string;
    type: string;
    status: string;
    owner: string;
    version: string;
    effectiveDate: string;
    lastRenewalDate: string;
    expiryDate: string;
    department: string;
    classification: string;
    tags: string[];
}

interface StepProps {
    data: UploadData;
    setData: (d: Partial<UploadData>) => void;
}

// ─── Step meta ────────────────────────────────────────────────────────────────
const STEPS = [
    {
        id: 1,
        label: "Upload File",
        icon: Upload,
        description: "Select the document",
        hint: "Upload any policy, framework, questionnaire, or evidence file. The system accepts PDF, DOCX, and XLSX. Files are automatically chunked and indexed for the AI knowledge base.",
    },
    {
        id: 2,
        label: "Classify",
        icon: Tag,
        description: "Basic information",
        hint: "Accurate classification ensures the AI can retrieve the most relevant excerpts when drafting answers. Tags help with filtering across multiple projects.",
    },
    {
        id: 3,
        label: "Enrich",
        icon: Calendar,
        description: "Dates & details",
        hint: "Specify key dates for lifecycle tracking, add contextual tags, and provide a description for the AI engine.",
    },
    {
        id: 4,
        label: "Review & Submit",
        icon: Rocket,
        description: "Confirm and upload",
        hint: "Review everything before uploading. Once submitted, the document will be indexed and available to all AI workflows in your workspace within seconds.",
    },
];

// ─── Step 1: File Upload ───────────────────────────────────────────────────────
const Step1 = ({ data, setData }: StepProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFile = (file: File) => {
        setData({ file, fileName: file.name, name: file.name.replace(/\.[^/.]+$/, "") });
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    };

    const ACCEPTED_TYPES = [".pdf", ".docx", ".xlsx", ".csv", ".txt", ".pptx"];
    const FORMAT_INFO = [
        { ext: "PDF", color: "text-red-600 bg-red-50 border-red-100" },
        { ext: "DOCX", color: "text-blue-600 bg-blue-50 border-blue-100" },
        { ext: "XLSX", color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
        { ext: "CSV", color: "text-violet-600 bg-violet-50 border-violet-100" },
        { ext: "PPTX", color: "text-amber-600 bg-amber-50 border-amber-100" },
        { ext: "TXT", color: "text-slate-600 bg-slate-50 border-slate-100" },
    ];

    return (
        <div className="space-y-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
                Select a document from your computer. It will be securely uploaded and <strong className="text-foreground">automatically indexed</strong> for use by the AI compliance engine.
            </p>

            {/* Drop Zone */}
            <label
                htmlFor="file-upload"
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={cn(
                    "block border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-4 cursor-pointer transition-all duration-200 group",
                    isDragging
                        ? "border-primary bg-primary/5 scale-[1.01]"
                        : data.file
                            ? "border-emerald-400 bg-emerald-50/50"
                            : "border-border hover:border-foreground/30 hover:bg-muted/20"
                )}
            >
                <div className={cn(
                    "h-16 w-16 rounded-2xl flex items-center justify-center transition-all duration-200",
                    data.file ? "bg-emerald-100" : "bg-muted group-hover:bg-foreground group-hover:text-background"
                )}>
                    {data.file
                        ? <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                        : <Upload className="h-8 w-8" />
                    }
                </div>

                {data.file ? (
                    <div className="text-center">
                        <p className="text-sm font-bold text-emerald-700">{data.file.name}</p>
                        <p className="text-xs text-emerald-600/70 mt-1">
                            {(data.file.size / 1024 / 1024).toFixed(2)} MB — click to replace
                        </p>
                    </div>
                ) : (
                    <div className="text-center">
                        <p className="text-sm font-semibold text-foreground">
                            {isDragging ? "Drop it here!" : "Click to upload or drag and drop"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Up to 25 MB per file</p>
                    </div>
                )}

                <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                    {FORMAT_INFO.map(f => (
                        <span key={f.ext} className={cn("text-[10px] px-2 py-0.5 rounded-md border", f.color)}>
                            {f.ext}
                        </span>
                    ))}
                </div>

                <input
                    id="file-upload"
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept={ACCEPTED_TYPES.join(",")}
                    onChange={handleChange}
                />
            </label>

            {/* AI Indexing Info */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-50/60 border border-blue-100">
                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Database className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                    <p className="text-xs font-bold text-blue-900 uppercase tracking-widest">AI Auto-Indexing</p>
                    <p className="text-[11px] text-blue-800/80 mt-0.5 leading-relaxed">
                        Uploaded files are automatically split into semantic chunks and embedded into the vector knowledge base — no configuration needed.
                    </p>
                </div>
            </div>
        </div>
    );
};

// ─── Step 2: Classify ─────────────────────────────────────────────────────────
const Step2 = ({ data, setData }: StepProps) => {


    return (
        <div className="space-y-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
                Classify this document so others can <strong className="text-foreground">find it quickly</strong> and so the AI knows how to use it when generating responses.
            </p>

            {/* Document Name */}
            <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Document Name <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                    <FileText className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={data.name}
                        onChange={(e) => setData({ name: e.target.value })}
                        className="h-11 pl-10 text-sm font-medium"
                        placeholder="e.g. Information Security Policy v4.1"
                        autoFocus
                    />
                </div>
            </div>

            {/* Type & Status — side by side */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Document Type <span className="text-destructive">*</span>
                    </Label>
                    <Select value={data.type} onValueChange={(val) => setData({ type: val })}>
                        <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select type…" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="policy">Policy</SelectItem>
                            <SelectItem value="procedure">Procedure</SelectItem>
                            <SelectItem value="framework">Framework</SelectItem>
                            <SelectItem value="questionnaire">Questionnaire</SelectItem>
                            <SelectItem value="evidence">Evidence / Attachment</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</Label>
                    <Select value={data.status} onValueChange={(val) => setData({ status: val })}>
                        <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select status…" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="under-review">Under Review</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Owner & Version — side by side */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Owner</Label>
                    <div className="relative">
                        <Users className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={data.owner}
                            onChange={(e) => setData({ owner: e.target.value })}
                            className="h-11 pl-10 text-sm"
                            placeholder="e.g. Sarah Chen"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Version</Label>
                    <div className="relative">
                        <Shield className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={data.version}
                            onChange={(e) => setData({ version: e.target.value })}
                            className="h-11 pl-10 text-sm"
                            placeholder="e.g. 4.1"
                        />
                    </div>
                </div>
            </div>

            {/* Department & Classification */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Department</Label>
                    <div className="relative">
                        <Building2 className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={data.department}
                            onChange={(e) => setData({ department: e.target.value })}
                            className="h-11 pl-10 text-sm"
                            placeholder="e.g. IT, Security"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Classification</Label>
                    <Select value={data.classification} onValueChange={(val) => setData({ classification: val })}>
                        <SelectTrigger className="h-11">
                            <div className="flex items-center gap-2">
                                <Lock className="h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="Select..." />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Public">Public</SelectItem>
                            <SelectItem value="Internal">Internal</SelectItem>
                            <SelectItem value="Confidential">Confidential</SelectItem>
                            <SelectItem value="Restricted">Restricted</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

        </div>
    );
};

// ─── Step 3: Dates & Details ───────────────────────────────────────────────────
const Step3 = ({ data, setData }: StepProps) => {
    const [newTag, setNewTag] = useState("");

    const addTag = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && newTag.trim()) {
            e.preventDefault();
            if (!data.tags.includes(newTag.trim())) {
                setData({ tags: [...data.tags, newTag.trim()] });
            }
            setNewTag("");
        }
    };

    const removeTag = (t: string) => setData({ tags: data.tags.filter(tag => tag !== t) });

    return (
        <div className="space-y-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
                Add lifecycle dates, tags, and descriptive context so the AI can prioritize this document effectively.
            </p>

            {/* Key Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Effective Date</Label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="date"
                            value={data.effectiveDate}
                            onChange={(e) => setData({ effectiveDate: e.target.value })}
                            className="h-11 pl-10 text-sm"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Last Renewed On</Label>
                    <div className="relative">
                        <Clock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="date"
                            value={data.lastRenewalDate}
                            onChange={(e) => setData({ lastRenewalDate: e.target.value })}
                            className="h-11 pl-10 text-sm"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Expiry Date</Label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="date"
                            value={data.expiryDate}
                            onChange={(e) => setData({ expiryDate: e.target.value })}
                            className="h-11 pl-10 text-sm"
                        />
                    </div>
                </div>
            </div>

            <Separator />

            {/* Tags */}
            <div className="space-y-3">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tags</Label>
                <div className="relative">
                    <Tag className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={addTag}
                        className="h-11 pl-10 text-sm"
                        placeholder="Type a tag and press Enter… (e.g. SOC2, ISO27001)"
                    />
                </div>
                {data.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {data.tags.map(t => (
                            <Badge key={t} className="bg-primary/5 text-primary border-primary/20 animate-in fade-in zoom-in-90 duration-150">
                                {t}
                                <button onClick={() => removeTag(t)} className="hover:bg-primary/20 rounded-full p-0.5 transition-colors">
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                )}
            </div>

            {/* Description */}
            <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description</Label>
                <Textarea
                    value={data.description}
                    onChange={(e) => setData({ description: e.target.value })}
                    className="resize-none text-sm min-h-[80px]"
                    placeholder="What is this document about? Any key scope or context the AI should know?"
                />
            </div>
        </div>
    );
};

const InfoCell = ({ label, value, icon: Icon, missing }: { label: string; value: string; icon: React.ElementType; missing?: boolean }) => (
    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/30 border border-border/50">
        <div className="h-6 w-6 rounded-md bg-background border border-border/60 flex items-center justify-center shrink-0">
            <Icon className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="min-w-0">
            <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">{label}</p>
            <p className={cn("text-xs font-semibold mt-0.5 truncate", missing ? "text-rose-500 italic" : "text-foreground")}>
                {value || "—"}
            </p>
        </div>
    </div>
);

// ─── Step 4: Review & Submit ───────────────────────────────────────────────────
const Step4 = ({ data }: StepProps) => {
    const checks = [
        !!data.file,
        !!data.name.trim(),
        !!data.type,
        !!data.owner.trim(),
        data.tags.length > 0,
        !!data.description.trim(),
    ];
    const done = checks.filter(Boolean).length;
    const score = Math.round((done / checks.length) * 100);
    const scoreBarColor = score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500";
    const scoreTextColor = score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-rose-600";
    const scoreLabel = score >= 80 ? "Ready to submit" : score >= 50 ? "Could be better" : "Needs more info";

    return (
        <div className="space-y-5">
            {/* Readiness bar */}
            <div className="p-3.5 rounded-xl border border-border bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className={cn("h-4 w-4", scoreTextColor)} />
                        <span className="text-xs font-semibold text-foreground">Upload Readiness</span>
                    </div>
                    <span className={cn("text-xs font-bold", scoreTextColor)}>{score}% — {scoreLabel}</span>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-700", scoreBarColor)} style={{ width: `${score}%` }} />
                </div>
            </div>

            {/* File summary card */}
            {data.file && (
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border/60 bg-background">
                    <div className="h-10 w-10 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center">
                        <File className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{data.file.name}</p>
                        <p className="text-[11px] text-muted-foreground">{(data.file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 capitalize shrink-0">
                        Ready
                    </Badge>
                </div>
            )}
            {!data.file && (
                <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    No file selected. Go back and upload a file.
                </div>
            )}

            {/* Metadata review — 2-column grid */}
            <div>
                <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground mb-2">Document Details</p>
                <div className="grid grid-cols-2 gap-2">
                    <InfoCell icon={FolderOpen} label="Document Name" value={data.name} missing={!data.name} />
                    <InfoCell icon={BookOpen} label="Type" value={data.type} missing={!data.type} />
                    <InfoCell icon={Shield} label="Status" value={data.status} />
                    <InfoCell icon={Users} label="Owner" value={data.owner} />
                    <InfoCell icon={Tag} label="Version" value={data.version} />
                    <InfoCell icon={Building2} label="Department" value={data.department} />
                    <InfoCell icon={Lock} label="Classification" value={data.classification} />
                    <InfoCell icon={Calendar} label="Effective Date" value={data.effectiveDate} />
                    <InfoCell icon={Clock} label="Last Renewed" value={data.lastRenewalDate} />
                    <InfoCell icon={Calendar} label="Expiry Date" value={data.expiryDate} />
                </div>
            </div>

            {/* Tags */}
            {data.tags.length > 0 && (
                <div>
                    <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                        {data.tags.map(t => (
                            <Badge key={t} variant="outline" className="border-border/40 text-muted-foreground">{t}</Badge>
                        ))}
                    </div>
                </div>
            )}

            {/* Description */}
            {data.description && (
                <div>
                    <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground mb-2">Description</p>
                    <div className="p-3 bg-muted/30 rounded-lg border border-border/50 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                        {data.description}
                    </div>
                </div>
            )}

            {/* AI notice */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl border border-blue-100 bg-blue-50/50">
                <Database className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-800/80 leading-relaxed">
                    <strong className="text-blue-900">On submit:</strong> the document will be parsed, chunked, and added to your AI knowledge base. It will be available to all compliance projects within seconds.
                </p>
            </div>
        </div>
    );
};

// ─── Validation ───────────────────────────────────────────────────────────────
const validateStep = (step: number, data: UploadData): string | null => {
    if (step === 1 && !data.file) return "Please select a file to upload.";
    if (step === 2 && !data.name.trim()) return "Document name is required.";
    if (step === 2 && !data.type) return "Please select a document type.";
    return null;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const UploadDocument = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { isDemo } = useAuth();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [data, setData] = useState<UploadData>({
        file: null,
        fileName: "",
        name: "",
        description: "",
        type: "",
        status: "active",
        owner: "",
        version: "",
        effectiveDate: "",
        lastRenewalDate: "",
        expiryDate: "",
        department: "",
        classification: "",
        tags: [],
    });

    const updateData = (partial: Partial<UploadData>) => setData(prev => ({ ...prev, ...partial }));

    const next = () => {
        const err = validateStep(step, data);
        if (err) { toast({ title: "Required", description: err, variant: "destructive" }); return; }
        setStep(s => Math.min(s + 1, 4));
    };

    const back = () => setStep(s => Math.max(s - 1, 1));

    const submit = async () => {
        if (!data.file) {
            toast({ title: "No File", description: "Go back and upload a file first.", variant: "destructive" });
            return;
        }

        if (isDemo) {
            toast({ title: "✅ Document Uploaded!", description: `"${data.name}" has been indexed and added to the Knowledge Library.` });
            setTimeout(() => navigate("/library"), 1200);
            return;
        }

        setIsSubmitting(true);
        try {
            await uploadDocument(data.file, {
                name: data.name,
                department: data.department || undefined,
                classification: data.classification || undefined,
                description: data.description || undefined,
                owner: data.owner || undefined,
                tags: data.tags.length > 0 ? data.tags : undefined,
                effectiveDate: data.effectiveDate || undefined,
                expiryDate: data.expiryDate || undefined,
            });
            toast({ title: "Document uploaded", description: `"${data.name}" is being indexed and will appear in the library shortly.` });
            navigate("/library");
        } catch (err) {
            toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const StepContent = [Step1, Step2, Step3, Step4][step - 1];
    const currentStepMeta = STEPS[step - 1];
    const isLast = step === 4;

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex-1 bg-background antialiased overflow-auto relative"
        >
            <div className="max-w-5xl mx-auto px-6 py-10">
                <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-2 mb-8 h-8 text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg px-3"
                    onClick={() => navigate("/library")}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Library
                </Button>

                <div className="flex gap-10">
                    <div className="w-56 shrink-0 hidden lg:flex flex-col">
                        <div className="mb-8">
                            <h1 className="text-2xl font-bold text-foreground tracking-tight leading-tight">Upload Document</h1>
                            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                                Add a file to your AI knowledge base in 3 easy steps.
                            </p>
                        </div>

                        <div className="relative space-y-1">
                            <div className="absolute left-[17px] top-9 w-0.5 h-[calc(100%-72px)] bg-border" />
                            {STEPS.map((s) => {
                                const done = step > s.id;
                                const active = step === s.id;
                                return (
                                    <div key={s.id} className="flex items-start gap-3 relative z-10">
                                        <div className={cn(
                                            "h-9 w-9 rounded-full flex items-center justify-center border-2 shrink-0 transition-all duration-300",
                                            done ? "bg-foreground border-foreground text-background" :
                                                active ? "bg-background border-foreground text-foreground shadow-sm" :
                                                    "bg-background border-border text-muted-foreground"
                                        )}>
                                            {done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                                        </div>
                                        <div className="pt-1.5 pb-5">
                                            <p className={cn(
                                                "text-xs font-bold leading-tight transition-colors",
                                                active ? "text-foreground" : done ? "text-foreground" : "text-muted-foreground"
                                            )}>{s.label}</p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">{s.description}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-6 p-3 rounded-xl bg-muted/40 border border-border/60">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <Info className="h-3 w-3 text-muted-foreground" />
                                <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">Why this step?</p>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{currentStepMeta.hint}</p>
                        </div>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col gap-6">
                        <div className="lg:hidden">
                            <h1 className="text-2xl font-bold text-foreground tracking-tight">Upload Document</h1>
                            <p className="text-xs text-muted-foreground mt-1">3 easy steps to index your file.</p>
                        </div>

                        <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
                            <div className="px-7 py-5 border-b border-border/50 flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Step {step} of {STEPS.length}</span>
                                        <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{currentStepMeta.description}</span>
                                    </div>
                                    <h2 className="text-xl font-bold text-foreground mt-0.5">{currentStepMeta.label}</h2>
                                </div>
                            </div>

                            <div className="px-7 py-7">
                                <StepContent data={data} setData={updateData} />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <Button
                                variant="ghost"
                                onClick={back}
                                disabled={step === 1}
                                className="text-muted-foreground h-10 px-4"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back
                            </Button>

                            {isLast ? (
                                <Button onClick={submit} disabled={isSubmitting} className="h-10 px-8 rounded-full font-semibold text-sm">
                                    <Rocket className="h-4 w-4 mr-2" />
                                    {isSubmitting ? "Uploading…" : "Submit to Library"}
                                </Button>
                            ) : (
                                <Button onClick={next} className="h-10 px-8 rounded-full font-semibold text-sm">
                                    Continue
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default UploadDocument;
