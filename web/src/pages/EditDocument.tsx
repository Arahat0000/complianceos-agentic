import { useParams, useNavigate } from "react-router-dom";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  FileText,
  Calendar,
  Tag,
  Shield,
  Save,
  X,
  History,
  Info,
  ExternalLink,
  Database,
  Upload,
  CheckCircle2,
  Users,
  AlertCircle,
  Building2,
  Lock,
  Clock,
  Link,
  Plus,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { motion } from "motion/react";

import { getDocumentData, AVAILABLE_CONTROLS } from "@/data/documentLibrary";

const STATUS_STYLES: Record<string, string> = {
  active:
    "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  draft:
    "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  "under-review":
    "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  archived:
    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20",
};

// ─── Component ────────────────────────────────────────────────────────────────
const EditDocument = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const raw = getDocumentData(id || "1");

  const [form, setForm] = useState({
    name: raw.name,
    description: raw.description,
    type: raw.type,
    status: raw.status,
    owner: raw.owner,
    version: raw.version,
    department: raw.department,
    classification: raw.classification,
    expiryDate: raw.expiryDate,
    effectiveDate: raw.effectiveDate,
    lastRenewalDate: raw.lastRenewalDate,
    tags: [...raw.tags],
  });
  const [newTag, setNewTag] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [linkedControls, setLinkedControls] = useState([...raw.linkedControls]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customControl, setCustomControl] = useState({ id: "", name: "" });

  const removeControl = (id: string) => {
    setLinkedControls((prev) => prev.filter((c) => c.id !== id));
  };

  const addControl = (control: (typeof linkedControls)[number]) => {
    setLinkedControls((prev) => [...prev, control]);
    setIsMapModalOpen(false);
    setSearchQuery("");
    setIsCreatingCustom(false);
    toast({
      title: "Control Mapped",
      description: `${control.id} is now linked to this document.`,
    });
  };

  const unmappedControls = AVAILABLE_CONTROLS.filter(
    (c) =>
      !linkedControls.find((lc) => lc.id === c.id) &&
      (c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const patch = (partial: Partial<typeof form>) =>
    setForm((prev) => ({ ...prev, ...partial }));

  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newTag.trim()) {
      e.preventDefault();
      if (!form.tags.includes(newTag.trim()))
        patch({ tags: [...form.tags, newTag.trim()] });
      setNewTag("");
    }
  };

  const removeTag = (t: string) =>
    patch({ tags: form.tags.filter((tag) => tag !== t) });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setNewFile(f);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({
        title: "Required",
        description: "Document name cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast({
        title: "Changes Saved",
        description: `"${form.name}" has been updated.`,
      });
      navigate(`/library/${id}`);
    }, 700);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex-1 overflow-auto bg-background antialiased p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/library/${id}`)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Document
        </Button>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="default"
            className="h-10 px-5 rounded-lg font-medium"
            onClick={() => navigate(`/library/${id}`)}
          >
            <X className="h-4 w-4 mr-2" />
            Discard
          </Button>
          <Button
            size="default"
            className="h-10 px-5 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all active:scale-[0.98] min-w-32"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/40 shadow-sm overflow-hidden">
            <CardHeader className="bg-card border-b border-border/40 p-6">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 space-y-2.5">
                  <Input
                    value={form.name}
                    onChange={(e) => patch({ name: e.target.value })}
                    className="h-10 text-xl font-bold border-border/60 focus-visible:ring-primary/30"
                    placeholder="Document name…"
                  />
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {raw.lastUpdated}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" />v{form.version}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize",
                        STATUS_STYLES[form.status] ?? STATUS_STYLES.active,
                      )}
                    >
                      {form.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-8 bg-card/50">
              <section className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Overview
                </h3>
                <Textarea
                  value={form.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  rows={4}
                  className="resize-none text-sm leading-relaxed border-border/60"
                  placeholder="What does this document cover?"
                />
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Keywords &amp; Tags
                </h3>
                <div className="relative">
                  <Tag className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={addTag}
                    className="pl-9 border-border/60"
                    placeholder="Type a tag and press Enter…"
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {form.tags.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="bg-muted/50 border-border text-foreground dark:bg-muted/30 dark:border-border/80"
                    >
                      {t}
                      <button
                        onClick={() => removeTag(t)}
                        className="hover:bg-muted rounded-full p-0.5 transition-colors"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </section>

              <Separator className="bg-border/40" />

              <section className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Classification
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold">
                      Document Type
                    </Label>
                    <Select
                      value={form.type}
                      onValueChange={(val) => patch({ type: val })}
                    >
                      <SelectTrigger className="border-border/60">
                        <SelectValue placeholder="Select type…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="policy">Policy</SelectItem>
                        <SelectItem value="procedure">Procedure</SelectItem>
                        <SelectItem value="framework">Framework</SelectItem>
                        <SelectItem value="questionnaire">
                          Questionnaire
                        </SelectItem>
                        <SelectItem value="evidence">
                          Evidence / Attachment
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold">
                      Status
                    </Label>
                    <Select
                      value={form.status}
                      onValueChange={(val) => patch({ status: val })}
                    >
                      <SelectTrigger className="border-border/60">
                        <SelectValue placeholder="Select status…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="under-review">
                          Under Review
                        </SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold">
                      Owner
                    </Label>
                    <div className="relative">
                      <Users className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={form.owner}
                        onChange={(e) => patch({ owner: e.target.value })}
                        className="pl-9 border-border/60"
                        placeholder="e.g. Chief Security Officer"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold">
                      Version
                    </Label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={form.version}
                        onChange={(e) => patch({ version: e.target.value })}
                        className="pl-9 border-border/60"
                        placeholder="e.g. 4.2"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold">
                      Department
                    </Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={form.department}
                        onChange={(e) => patch({ department: e.target.value })}
                        className="pl-9 border-border/60"
                        placeholder="e.g. IT, Security, HR"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold">
                      Classification
                    </Label>
                    <Select
                      value={form.classification}
                      onValueChange={(val) => patch({ classification: val })}
                    >
                      <SelectTrigger className="border-border/60">
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4 text-muted-foreground" />
                          <SelectValue placeholder="Select classification" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Public">Public</SelectItem>
                        <SelectItem value="Internal">Internal</SelectItem>
                        <SelectItem value="Confidential">
                          Confidential
                        </SelectItem>
                        <SelectItem value="Restricted">Restricted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold">
                      Effective Date
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={form.effectiveDate || ""}
                        onChange={(e) =>
                          patch({ effectiveDate: e.target.value })
                        }
                        className="pl-9 border-border/60"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold">
                      Last Renewed On
                    </Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={form.lastRenewalDate || ""}
                        onChange={(e) =>
                          patch({ lastRenewalDate: e.target.value })
                        }
                        className="pl-9 border-border/60"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold">
                      Expiry Date
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={form.expiryDate || ""}
                        onChange={(e) => patch({ expiryDate: e.target.value })}
                        className="pl-9 border-border/60"
                      />
                    </div>
                  </div>
                </div>
              </section>
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-sm overflow-hidden">
            <CardHeader className="bg-card border-b border-border/40 p-4">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base font-bold">
                  Revision History
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/40">
                {raw.history.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-sm font-bold text-foreground w-10">
                        v{h.version}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {h.change}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {h.user} • {h.date}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/5"
                    >
                      Restore
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/40 shadow-sm overflow-hidden">
            <CardHeader className="p-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base font-bold">
                  Upload New Version
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <label
                htmlFor="version-upload"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  "block border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-2.5 cursor-pointer transition-all duration-200 text-center group",
                  isDragging
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : newFile
                      ? "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/20"
                      : "border-border/60 hover:border-foreground/30 hover:bg-muted/20",
                )}
              >
                {newFile ? (
                  <>
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 truncate max-w-[170px]">
                        {newFile.name}
                      </p>
                      <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/80">
                        {(newFile.size / 1024 / 1024).toFixed(2)} MB · click to
                        replace
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center group-hover:bg-foreground group-hover:text-background transition-all duration-200">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {isDragging
                          ? "Drop it here!"
                          : "Drop or click to browse"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        PDF, DOCX, XLSX · Max 25 MB
                      </p>
                    </div>
                  </>
                )}
                <input
                  id="version-upload"
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.xlsx,.pptx,.csv,.txt"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setNewFile(f);
                  }}
                />
              </label>

              {newFile && (
                <>
                  <div className="flex items-start gap-2 p-2.5 rounded-lg border bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-90" />
                    <p className="text-[11px] leading-relaxed opacity-95">
                      This will replace the current file and archive the old
                      version in history.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      toast({
                        title: "New Version Attached",
                        description: `"${newFile.name}" will be saved with this document.`,
                      });
                      setNewFile(null);
                    }}
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Attach as New Version
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-sm">
            <CardHeader className="p-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base font-bold">
                  Document Info
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {[
                { label: "Department", value: form.department, icon: Users },
                {
                  label: "Classification",
                  value: form.classification,
                  icon: Shield,
                },
                {
                  label: "Effective Date",
                  value: form.effectiveDate || "—",
                  icon: Calendar,
                },
                {
                  label: "Last Renewed",
                  value: form.lastRenewalDate || "—",
                  icon: Clock,
                },
                {
                  label: "Expiry Date",
                  value: form.expiryDate || "—",
                  icon: Calendar,
                },
                { label: "File Format", value: ".PDF", icon: FileText },
                {
                  label: "Storage Path",
                  value: "/compliance/policies/sec-4.1.pdf",
                  icon: ExternalLink,
                },
                {
                  label: "Page Count",
                  value: raw.pageCount.toString(),
                  icon: FileText,
                },
                { label: "File Size", value: raw.fileSize, icon: ExternalLink },
                { label: "AI Indexed", value: "Fully Indexed", icon: Database },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-2">
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </span>
                  <span className="text-xs font-bold text-foreground">
                    {item.value}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-sm">
            <CardHeader className="p-4 border-b border-border/40 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Link className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base font-bold">
                  Linked Controls
                </CardTitle>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:border-primary/30">
                {linkedControls.length} Active
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/40 max-h-[300px] overflow-y-auto">
                {linkedControls.map((control, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      <div className="h-8 w-8 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                        <Shield
                          className={cn(
                            "h-4 w-4",
                            control.status === "review-needed"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-primary",
                          )}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground">
                            {control.id}
                          </p>
                          {control.status === "review-needed" && (
                            <span
                              className="h-2 w-2 rounded-full bg-amber-500 dark:bg-amber-400"
                              title="Review Suggested"
                            />
                          )}
                        </div>
                        <p
                          className="text-[11px] text-muted-foreground mt-0.5 truncate"
                          title={control.name}
                        >
                          {control.name}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 opacity-0 group-hover:opacity-100 transition-all"
                      onClick={() => removeControl(control.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {linkedControls.length === 0 && (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No controls mapped.
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-border/40 bg-muted/30 dark:bg-muted/20">
                <Dialog open={isMapModalOpen} onOpenChange={setIsMapModalOpen}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs font-bold gap-2 text-primary hover:bg-primary/5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Map New Control
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {isCreatingCustom
                          ? "Create Custom Control"
                          : "Map New Control"}
                      </DialogTitle>
                      <DialogDescription>
                        {isCreatingCustom
                          ? "Define a new custom control to map to this document."
                          : "Search framework controls to link them back to this evidence artifact."}
                      </DialogDescription>
                    </DialogHeader>
                    {isCreatingCustom ? (
                      <div className="space-y-4 py-3">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            Control ID
                          </Label>
                          <Input
                            placeholder="e.g. CUST-01"
                            value={customControl.id}
                            onChange={(e) =>
                              setCustomControl({
                                ...customControl,
                                id: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            Control Name
                          </Label>
                          <Textarea
                            placeholder="Describe the control requirement..."
                            value={customControl.name}
                            onChange={(e) =>
                              setCustomControl({
                                ...customControl,
                                name: e.target.value,
                              })
                            }
                            className="resize-none h-20"
                          />
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsCreatingCustom(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (
                                !customControl.id.trim() ||
                                !customControl.name.trim()
                              ) {
                                toast({
                                  title: "Incomplete",
                                  description:
                                    "Please provide both an ID and a Name.",
                                  variant: "destructive",
                                });
                                return;
                              }
                              addControl({
                                ...customControl,
                                status: "active",
                              });
                              setCustomControl({ id: "", name: "" });
                            }}
                          >
                            Create & Map
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 py-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search controls..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        <div className="border rounded-md divide-y max-h-[250px] overflow-y-auto">
                          {unmappedControls.map((c) => (
                            <div
                              key={c.id}
                              className="p-3 hover:bg-muted/50 cursor-pointer flex items-center justify-between group"
                              onClick={() => addControl(c)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-background border border-border flex items-center justify-center shrink-0 group-hover:bg-primary/5 group-hover:border-primary/20 transition-all">
                                  <Shield className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-all" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-foreground">
                                    {c.id}
                                  </p>
                                  <p
                                    className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1"
                                    title={c.name}
                                  >
                                    {c.name}
                                  </p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[10px] uppercase font-bold text-primary opacity-0 group-hover:opacity-100 transition-all"
                              >
                                Add
                              </Button>
                            </div>
                          ))}
                          {unmappedControls.length === 0 &&
                            searchQuery.trim() === "" && (
                              <div className="p-6 text-center text-xs text-muted-foreground">
                                No controls mapped.
                              </div>
                            )}
                          <div
                            className="p-3 hover:bg-muted/50 cursor-pointer flex items-center justify-between group border-t border-border/30 bg-muted/10 mt-auto"
                            onClick={() => {
                              setCustomControl({
                                id: "",
                                name: searchQuery.trim(),
                              });
                              setIsCreatingCustom(true);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-background border border-dashed border-primary/50 flex items-center justify-center shrink-0 group-hover:bg-primary/5 transition-all">
                                <Plus className="h-4 w-4 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground">
                                  Add Custom Control
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                  {searchQuery.trim()
                                    ? `"${searchQuery.trim()}"`
                                    : "Type a name in search to create"}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[10px] uppercase font-bold text-primary opacity-0 group-hover:opacity-100 transition-all"
                            >
                              Create
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
};

export default EditDocument;
