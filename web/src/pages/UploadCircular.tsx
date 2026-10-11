import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  Tag,
  FileText,
  Database,
  X,
  Info,
  File,
  CheckCircle2,
  AlertCircle,
  Shield,
  Calendar,
  ExternalLink,
  BookOpen,
  Link as LinkIcon,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import { createCircular } from "@/lib/circulars";

const BODY_OPTIONS = [
  { value: "RBI", label: "RBI" },
  { value: "SEBI", label: "SEBI" },
  { value: "CERT-In", label: "CERT-In" },
  { value: "DPDP", label: "DPDP" },
  { value: "Other", label: "Other" },
];

const STATUS_OPTIONS = ["Active", "Superseded", "Draft"];

interface UploadCircularData {
  body: string;
  link: string;
  name: string;
  circularId: string;
  description: string;
  status: string;
  version: string;
  dateOfIssue: string;
  tags: string[];
  file: File | null;
}

interface StepProps {
  data: UploadCircularData;
  setData: (d: Partial<UploadCircularData>) => void;
}

const STEPS = [
  {
    id: 1,
    label: "Source & Link",
    icon: LinkIcon,
    description: "Type and official link",
    hint: "Choose the regulatory body or framework type and optionally add a link to the official circular or attach a supporting document.",
  },
  {
    id: 2,
    label: "Classify",
    icon: Tag,
    description: "Basic information",
    hint: "Enter the circular or framework name, ID/code, and a short description so it can be found and used consistently across the compliance library.",
  },
  {
    id: 3,
    label: "Enrich",
    icon: Calendar,
    description: "Dates & tags",
    hint: "Add date of issue, status, version, and tags. Optional: attach a PDF for local reference.",
  },
  {
    id: 4,
    label: "Extracted Obligations",
    icon: CheckCircle2,
    description: "Review compliance directives",
    hint: "Review the compliance obligations and requirements automatically extracted from this circular before adding it to your library.",
  },
  {
    id: 5,
    label: "Review & Submit",
    icon: Upload,
    description: "Confirm and add",
    hint: "Review all details. On submit, the item will be added to your Regulations and available for mapping and assessments.",
  },
];

const Step1 = ({ data, setData }: StepProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleFile = (file: File) => {
    setData({ file });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") handleFile(file);
  };

  const handleLoadSample = () => {
    setData({
      body: "RBI",
      name: "Master Direction on Information Technology Governance, Risk, Controls and Assurance",
      circularId: "RBI/2023-24/108",
      description: "Mandates IT governance, cybersecurity incident escalation within 2 hours, continuous VAPT, and cyber resilience frameworks.",
      status: "Active",
      version: "2.1",
      dateOfIssue: "Nov 07, 2023",
      tags: ["Cyber Resilience", "Incident Reporting", "VAPT", "IT Governance"],
      link: "https://rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12562",
      file: { name: "RBI_Cyber_Resilience_Master_Direction_2024.pdf", size: 2450000, type: "application/pdf" } as unknown as File,
    });
    toast({
      title: "Loaded Official Gazette",
      description: "RBI Master Direction (RBI/2023-24/108) loaded with extracted obligations ready for review.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Demo helper */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/20 bg-primary/5">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>Quick Demo: Load Scanned Indian Regulatory Gazette</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleLoadSample}
          className="h-8 text-xs font-medium cursor-pointer shrink-0 border-primary/30 text-primary hover:bg-primary/10"
        >
          Pre-fill RBI Gazette
        </Button>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        Select the <strong className="text-foreground">source type</strong> and optionally link to the official circular or attach a supporting document.
      </p>

      <div className="space-y-2">
        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Type / Body <span className="text-destructive">*</span>
        </Label>
        <Select value={data.body} onValueChange={(val) => setData({ body: val })}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Select type…" />
          </SelectTrigger>
          <SelectContent>
            {BODY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Official / Source URL
        </Label>
        <div className="relative">
          <ExternalLink className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={data.link}
            onChange={(e) => setData({ link: e.target.value })}
            className="h-11 pl-10 text-sm"
            placeholder="https://… (e.g. RBI, SEBI, CERT-In, ISO page)"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Attach PDF (optional)
        </Label>
        <label
          htmlFor="circular-file-upload"
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "block border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer transition-all duration-200 group",
            isDragging ? "border-primary bg-primary/5" : data.file ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/10" : "border-border hover:border-foreground/30 hover:bg-muted/20"
          )}
        >
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center transition-all",
            data.file ? "bg-emerald-100 dark:bg-emerald-500/20" : "bg-muted group-hover:bg-foreground group-hover:text-background"
          )}>
            {data.file ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <File className="h-6 w-6" />}
          </div>
          {data.file ? (
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 truncate max-w-[220px]">{data.file.name}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Drop PDF or click to browse</p>
          )}
          <input
            id="circular-file-upload"
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </label>
      </div>

      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
        <Database className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5 text-blue-600" />
        <div>
          <p className="text-xs font-bold text-blue-900 dark:text-blue-200 uppercase tracking-widest">Regulations</p>
          <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 mt-0.5 leading-relaxed">
            Added items appear in the library and can be linked to controls and assessment questions.
          </p>
        </div>
      </div>
    </div>
  );
};

const Step2 = ({ data, setData }: StepProps) => (
  <div className="space-y-6">
    <p className="text-sm text-muted-foreground leading-relaxed">
      Enter the <strong className="text-foreground">name and identifier</strong> so this item can be found and referenced consistently.
    </p>

    <div className="space-y-2">
      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Name / Title <span className="text-destructive">*</span>
      </Label>
      <div className="relative">
        <FileText className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={data.name}
          onChange={(e) => setData({ name: e.target.value })}
          className="h-11 pl-10 text-sm font-medium"
          placeholder="e.g. Master Direction - IT Framework for NBFC Sector"
          autoFocus
        />
      </div>
    </div>

    <div className="space-y-2">
      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Circular ID / Code
      </Label>
      <div className="relative">
        <BookOpen className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={data.circularId}
          onChange={(e) => setData({ circularId: e.target.value })}
          className="h-11 pl-10 text-sm font-mono"
          placeholder="e.g. RBI/2023-24/108 or SEBI/HO/MIRSD/2024/72"
        />
      </div>
    </div>

    <div className="space-y-2">
      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Description
      </Label>
      <Textarea
        value={data.description}
        onChange={(e) => setData({ description: e.target.value })}
        className="resize-none text-sm min-h-[80px]"
        placeholder="Short description for the compliance library…"
      />
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</Label>
        <Select value={data.status} onValueChange={(val) => setData({ status: val })}>
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Version</Label>
        <Input
          value={data.version}
          onChange={(e) => setData({ version: e.target.value })}
          className="h-11 text-sm"
          placeholder="e.g. 1.0"
        />
      </div>
    </div>
  </div>
);

const Step3 = ({ data, setData }: StepProps) => {
  const [newTag, setNewTag] = useState("");

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newTag.trim()) {
      e.preventDefault();
      if (!data.tags.includes(newTag.trim())) setData({ tags: [...data.tags, newTag.trim()] });
      setNewTag("");
    }
  };

  const removeTag = (t: string) => setData({ tags: data.tags.filter((tag) => tag !== t) });

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Add <strong className="text-foreground">date of issue</strong> and <strong className="text-foreground">tags</strong> for filtering and context.
      </p>

      <div className="space-y-2">
        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date of Issue</Label>
        <div className="relative">
          <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={data.dateOfIssue}
            onChange={(e) => setData({ dateOfIssue: e.target.value })}
            className="h-11 pl-10 text-sm"
            placeholder="e.g. Nov 07, 2023 or leave blank"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tags</Label>
        <div className="relative">
          <Tag className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={addTag}
            className="h-11 pl-10 text-sm"
            placeholder="Type a tag and press Enter…"
          />
        </div>
        {data.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.tags.map((t) => (
              <Badge key={t} className="bg-primary/5 text-primary border-primary/20">
                {t}
                <button type="button" onClick={() => removeTag(t)} className="hover:bg-primary/20 rounded-full p-0.5 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Step 4: Obligation extraction ────────────────────────────────────────────
const Step4 = () => {
  return (
    <div className="space-y-4">
      <div className="pb-1 border-b border-border/40">
        <h3 className="text-sm font-bold text-foreground">Obligation Extraction</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Obligations are extracted from the circular text after it is added, each with a verbatim source quote that is verified against the document.
        </p>
      </div>

      <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-2">
        <p>
          After you add this circular, open it under <span className="font-medium text-foreground">Obligations</span> and run extraction. Proposed obligations wait for a reviewer to confirm or dismiss them.
        </p>
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

// ─── Step 5: Review & Submit ─────────────────────────────────────────────────
const Step5 = ({ data }: StepProps) => {
  const checks = [!!data.body, !!data.name.trim(), data.tags.length > 0];
  const done = checks.filter(Boolean).length;
  const score = checks.length ? Math.round((done / checks.length) * 100) : 0;
  const scoreBarColor = score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500";
  const scoreTextColor = score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-rose-600";
  const scoreLabel = score >= 80 ? "Ready to submit" : score >= 50 ? "Could be better" : "Needs more info";

  return (
    <div className="space-y-5">
      <div className="p-3.5 rounded-xl border border-border bg-muted/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-foreground">Readiness</span>
          <span className={cn("text-xs font-bold", scoreTextColor)}>{score}% — {scoreLabel}</span>
        </div>
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-700", scoreBarColor)} style={{ width: `${score}%` }} />
        </div>
      </div>

      {!data.name.trim() && (
        <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-lg p-2.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Name is required. Go back and enter a title.
        </div>
      )}

      <div>
        <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground mb-2">Details</p>
        <div className="grid grid-cols-2 gap-2">
          <InfoCell icon={Shield} label="Type" value={data.body} missing={!data.body} />
          <InfoCell icon={FileText} label="Name" value={data.name} missing={!data.name} />
          <InfoCell icon={BookOpen} label="ID / Code" value={data.circularId} />
          <InfoCell icon={Calendar} label="Date of issue" value={data.dateOfIssue} />
          <InfoCell icon={Tag} label="Status" value={data.status} />
          <InfoCell icon={FileText} label="Version" value={data.version} />
          <InfoCell icon={ExternalLink} label="Link" value={data.link ? "Set" : "—"} />
          {data.file && (
            <InfoCell icon={File} label="Attachment" value={data.file.name} />
          )}
        </div>
      </div>

      {data.tags.length > 0 && (
        <div>
          <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground mb-2">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {data.tags.map((t) => (
              <Badge key={t} variant="outline" className="border-border/40 text-muted-foreground">{t}</Badge>
            ))}
          </div>
        </div>
      )}

      {data.description && (
        <div>
          <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground mb-2">Description</p>
          <div className="p-3 bg-muted/30 rounded-lg border border-border/50 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
            {data.description}
          </div>
        </div>
      )}

      <div className="flex items-start gap-2.5 p-3 rounded-xl border border-blue-100 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/10">
        <Database className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-800/80 dark:text-blue-200/80 leading-relaxed">
          <strong className="text-blue-900 dark:text-blue-100">On submit:</strong> this circular and its extracted compliance obligations will be added to your Regulations library and mapped to controls and assessment questions.
        </p>
      </div>
    </div>
  );
};

const validateStep = (step: number, data: UploadCircularData): string | null => {
  if (step === 1 && !data.body) return "Please select a type (Body).";
  if (step === 2 && !data.name.trim()) return "Name / title is required.";
  return null;
};

const UploadCircular = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isDemo } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<UploadCircularData>({
    body: "",
    link: "",
    name: "",
    circularId: "",
    description: "",
    status: "Active",
    version: "1.0",
    dateOfIssue: "",
    tags: [],
    file: null,
  });

  const updateData = (partial: Partial<UploadCircularData>) => setData((prev) => ({ ...prev, ...partial }));

  const next = () => {
    const err = validateStep(step, data);
    if (err) {
      toast({ title: "Required", description: err, variant: "destructive" });
      return;
    }
    setStep((s) => Math.min(s + 1, 5));
  };

  const back = () => setStep((s) => Math.max(s - 1, 1));

  const submit = async () => {
    if (!data.name.trim()) {
      toast({ title: "Name required", description: "Enter a name for this item.", variant: "destructive" });
      return;
    }

    if (isDemo) {
      toast({
        title: "Added to Regulations",
        description: `"${data.name}" has been added. It will appear in your library.`,
      });
      setTimeout(() => navigate("/regulations"), 1200);
      return;
    }

    setIsSubmitting(true);
    try {
      const circularId =
        data.circularId.trim() ||
        `${data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;

      await createCircular({
        circularId,
        name: data.name.trim(),
        body: data.body || "Other",
        description: data.description || undefined,
        tags: data.tags.length > 0 ? data.tags : undefined,
        dateOfIssue: data.dateOfIssue || undefined,
        status: data.status || undefined,
        version: data.version || undefined,
        link: data.link.trim() || undefined,
      });
      toast({
        title: "Added to Regulations",
        description: `"${data.name}" has been added. Open it under Obligations to run extraction.`,
      });
      navigate("/regulations");
    } catch (err) {
      toast({ title: "Failed to add", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const StepContent = [Step1, Step2, Step3, Step4, Step5][step - 1];
  const currentStepMeta = STEPS[step - 1];
  const isLast = step === 5;

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
          className="-ml-2 mb-8 h-8 text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg px-3 cursor-pointer"
          onClick={() => navigate("/regulations")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Regulations
        </Button>

        <div className="flex gap-10">
          <div className="w-56 shrink-0 hidden lg:flex flex-col">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground tracking-tight leading-tight">Add to Library</h1>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Add a circular, framework, or standard in a few steps.
              </p>
            </div>

            <div className="relative space-y-1">
              <div className="absolute left-[17px] top-9 w-0.5 h-[calc(100%-72px)] bg-border" />
              {STEPS.map((s) => {
                const done = step > s.id;
                const active = step === s.id;
                return (
                  <div key={s.id} className="flex items-start gap-3 relative z-10">
                    <div
                      className={cn(
                        "h-9 w-9 rounded-full flex items-center justify-center border-2 shrink-0 transition-all duration-300",
                        done ? "bg-foreground border-foreground text-background" : active ? "bg-background border-foreground text-foreground shadow-sm" : "bg-background border-border text-muted-foreground"
                      )}
                    >
                      {done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                    </div>
                    <div className="pt-1.5 pb-5">
                      <p className={cn("text-xs font-bold leading-tight", active ? "text-foreground" : done ? "text-foreground" : "text-muted-foreground")}>
                        {s.label}
                      </p>
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
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Add to Library</h1>
              <p className="text-xs text-muted-foreground mt-1">Add a circular or framework in a few steps.</p>
            </div>

            <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
              <div className="px-7 py-5 border-b border-border/50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Step {step} of {STEPS.length}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {currentStepMeta.description}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-foreground mt-0.5">{currentStepMeta.label}</h2>
                </div>
              </div>

              <div className="px-7 py-7">
                <StepContent data={data} setData={updateData} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={back} disabled={step === 1} className="text-muted-foreground h-10 px-4 cursor-pointer">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>

              {isLast ? (
                <Button onClick={submit} disabled={isSubmitting} className="h-10 px-8 rounded-full font-semibold text-sm cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  {isSubmitting ? "Adding…" : "Add to Library"}
                </Button>
              ) : (
                <Button onClick={next} className="h-10 px-8 rounded-full font-semibold text-sm cursor-pointer">
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

export default UploadCircular;
