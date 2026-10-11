import type { ExtractedItem, Region } from "@complianceos/shared";
import { Loader2 } from "lucide-react";
import { statusTone } from "@/lib/ingestion";
import { usePageImage } from "./usePageImage";

interface Props {
  fileId: string;
  page: number;
  isDemo: boolean;
  items?: ExtractedItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  highlight?: Region | null;
}

export function PageViewer({ fileId, page, isDemo, items = [], selectedId, onSelect, highlight }: Props) {
  const { url, loading, error } = usePageImage(fileId, page, isDemo);
  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (error || !url) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Page image unavailable.</div>;
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-border/60 bg-white shadow-sm">
      <img src={url} alt={`Page ${page}`} className="block w-full select-none" draggable={false} />
      {items.filter((i) => i.region && i.pageNumber === page).map((i) => {
        const r = i.region as Region;
        const tone = statusTone(i.reviewStatus);
        const sel = i.id === selectedId;
        return (
          <button
            key={i.id}
            type="button"
            title={`${i.label ?? i.kind} - ${tone.label}`}
            onClick={() => onSelect?.(i.id)}
            className="absolute rounded-sm transition-shadow"
            style={{
              left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%`,
              border: `${sel ? 3 : 1.5}px solid ${tone.stroke}`, background: sel ? tone.fill.replace(/[\d.]+\)$/, "0.25)") : tone.fill,
              boxShadow: sel ? `0 0 0 3px ${tone.stroke}33` : undefined,
            }}
          />
        );
      })}
      {highlight && (
        <div
          className="pointer-events-none absolute rounded-sm border-2 border-primary bg-primary/15"
          style={{ left: `${highlight.x * 100}%`, top: `${highlight.y * 100}%`, width: `${highlight.w * 100}%`, height: `${highlight.h * 100}%` }}
        />
      )}
    </div>
  );
}
