import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  ArrowLeft,
  FileText,
  Calendar,
  Tag,
  Shield,
  Save,
  X,
  ExternalLink,
  Database,
  Link as LinkIcon,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { motion } from "motion/react";
import { getRbiCircularById, type CircularDetailData } from "@/data/rbiMasterDirectionsIndexed";
import { getSebiCircularById } from "@/data/sebiMasterCirculars";

function getCircularData(id: string): CircularDetailData | null {
  const rbi = getRbiCircularById(id);
  if (rbi) return rbi;
  const sebi = getSebiCircularById(id);
  if (sebi) return sebi;
  return null;
}

const bodyColors: Record<string, string> = {
  RBI: "bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  SEBI: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  Other: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20",
};

const STATUS_OPTIONS = ["Active", "Superseded", "Draft"];

const EditCircular = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const raw = getCircularData(id || "");

  const [form, setForm] = useState({
    name: raw?.name ?? "",
    description: raw?.description ?? "",
    dateOfIssue: raw?.dateOfIssue ?? "",
    status: raw?.status ?? "Active",
    version: raw?.version ?? "1.0",
    link: raw?.link ?? "",
    tags: raw ? [...raw.tags] : [],
  });
  const [newTag, setNewTag] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({
        title: "Required",
        description: "Circular name cannot be empty.",
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
      navigate(`/regulations/${id}`);
    }, 700);
  };

  if (!raw) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-muted-foreground">Circular not found.</p>
        <Button
          variant="link"
          className="ml-2"
          onClick={() => navigate("/regulations")}
        >
          Back to Library
        </Button>
      </div>
    );
  }

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
          onClick={() => navigate(`/regulations/${id}`)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Circular
        </Button>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="default"
            className="h-10 px-5 rounded-lg font-medium"
            onClick={() => navigate("/regulations/upload")}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
          <Button
            variant="outline"
            size="default"
            className="h-10 px-5 rounded-lg font-medium"
            onClick={() => navigate(`/regulations/${id}`)}
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
                    placeholder="Circular / framework name…"
                  />
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono font-bold tracking-tight bg-muted/30"
                    >
                      {raw.circularId}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize text-[11px] px-2 py-0.5 border font-medium",
                        bodyColors[raw.body] ?? bodyColors.Other,
                      )}
                    >
                      {raw.body}
                    </Badge>
                    <span className="flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" /> v{form.version}
                    </span>
                    <Badge
                      variant="outline"
                      className="capitalize text-[11px] px-2 py-0.5 border font-medium bg-muted/30"
                    >
                      {form.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-8 bg-card/50" role="region" aria-label="Edit circular">
              <section className="space-y-2" aria-labelledby="edit-about">
                <h2 id="edit-about" className="text-base font-semibold text-foreground">
                  About this circular
                </h2>
                <Textarea
                  value={form.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  rows={4}
                  className="resize-none text-sm leading-relaxed border-border/60 max-w-3xl"
                  placeholder="Description of this circular or framework…"
                />
              </section>

              <section className="space-y-2" aria-labelledby="edit-topics">
                <h2 id="edit-topics" className="text-sm font-medium text-muted-foreground">
                  Topics
                </h2>
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
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {form.tags.map((t) => (
                    <Badge
                      key={t}
                      variant="secondary"
                      className="text-[11px] font-normal bg-muted/60 text-muted-foreground border-0 gap-1 pr-1"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        className="hover:bg-muted/80 rounded-full p-0.5 transition-colors"
                        aria-label={`Remove ${t}`}
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </section>

              <section className="space-y-4" aria-labelledby="edit-details">
                <h2 id="edit-details" className="text-base font-semibold text-foreground">
                  Details
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
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
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Version
                    </Label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={form.version}
                        onChange={(e) => patch({ version: e.target.value })}
                        className="pl-9 border-border/60"
                        placeholder="e.g. 1.0"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Date of Issue
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={form.dateOfIssue}
                        onChange={(e) => patch({ dateOfIssue: e.target.value })}
                        className="pl-9 border-border/60"
                        placeholder="e.g. Jun 08, 2017"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Original / Source URL
                    </Label>
                    <div className="relative">
                      <ExternalLink className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={form.link}
                        onChange={(e) => patch({ link: e.target.value })}
                        className="pl-9 border-border/60"
                        placeholder="https://…"
                      />
                    </div>
                  </div>
                </div>
              </section>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/40 shadow-sm" role="region" aria-label="Key details">
            <CardHeader className="p-4 border-b border-border/40">
              <CardTitle className="text-base font-semibold text-foreground">
                Key details
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Read-only. Edit metadata in the form.</p>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {[
                { label: "ID", value: raw.id, icon: FileText },
                { label: "Circular / Code", value: raw.circularId, icon: FileText },
                { label: "Body", value: raw.body, icon: Shield },
                { label: "Category", value: raw.category, icon: Tag },
                { label: "Link ref", value: raw.linkRef || "—", icon: LinkIcon },
                { label: "Applicable to", value: raw.applicableTo || "—", icon: FileText },
                { label: "Last updated", value: raw.lastUpdated || "—", icon: Calendar },
                { label: "Controls", value: raw.existingControls?.length?.toString() ?? "0", icon: Shield },
                { label: "AI recommendations", value: raw.aiRecommendations?.length?.toString() ?? "0", icon: Database },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-2 shrink-0">
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </span>
                  <span className="text-xs font-medium text-foreground truncate text-right" title={String(item.value)}>
                    {item.value}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {form.link && (
            <Card className="border-border/40 shadow-sm">
              <CardContent className="p-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => window.open(form.link, "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-2" />
                  Open Original
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default EditCircular;
