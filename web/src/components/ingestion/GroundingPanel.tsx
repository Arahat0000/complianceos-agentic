import type { Region } from "@complianceos/shared";
import { ScanSearch } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PageViewer } from "./PageViewer";

/** Shows the source page image with the obligation's region highlighted. */
export function GroundingPanel({ fileId, page, region }: { fileId: string; page: number; region: Region | null }) {
  const { isDemo } = useAuth();
  return (
    <div className="space-y-2 rounded-lg border border-dashed bg-muted/20 p-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><ScanSearch className="h-3.5 w-3.5" />Grounded in source page {page}</span>
      </div>
      <div className="max-w-sm"><PageViewer fileId={fileId} page={page} isDemo={isDemo} highlight={region} /></div>
    </div>
  );
}
