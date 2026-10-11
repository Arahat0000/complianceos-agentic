import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export function ReportIssueModal({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, etc.)");
      return;
    }
    setScreenshot(file);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error("Please describe the issue.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("description", description);
      if (screenshot) formData.append("screenshot", screenshot);

      await apiFetch<unknown>("/support/report", {
        method: "POST",
        body: formData,
      });

      toast.success("Report submitted! We'll look into it.");
      setIsOpen(false);
      setDescription("");
      setScreenshot(null);
    } catch (err) {
      toast.error((err instanceof Error && err.message) || "Failed to submit report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report an Issue</DialogTitle>
          <DialogDescription>
            Found a bug? Tell us what went wrong.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea 
              placeholder="What happened? What did you expect?" 
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
            />
          </div>

          <div
            className={`
              relative border-2 border-dashed rounded-xl p-6 transition-all duration-200
              flex flex-col items-center justify-center gap-2
              ${dragActive ? "border-primary bg-primary/5 scale-[1.01]" : "border-muted-foreground/20 bg-muted/30"}
              ${isSubmitting ? "opacity-50 pointer-events-none" : "cursor-pointer hover:border-primary/50 hover:bg-primary/5"}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />

            {screenshot ? (
              <div className="relative group w-full flex flex-col items-center">
                <div className="relative h-24 max-w-full overflow-hidden rounded-lg border bg-background flex items-center justify-center">
                  <img src={URL.createObjectURL(screenshot)} className="h-full object-contain" alt="Preview" />
                  <button 
                    onClick={(e) => { e.stopPropagation(); setScreenshot(null); }}
                    className="absolute top-1 right-1 p-1 bg-background/80 hover:bg-destructive hover:text-white rounded-full transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground truncate max-w-full italic">{screenshot.name}</p>
              </div>
            ) : (
              <>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Add a screenshot</p>
                  <p className="text-xs text-muted-foreground">Click to upload or drag and drop</p>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between items-center bg-muted/30 -mx-6 -mb-6 px-6 py-4 mt-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
             <AlertCircle className="h-3.5 w-3.5" />
             <span className="text-[10px] uppercase font-semibold tracking-wider">ComplianceOS Support</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</> : "Submit Report"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
