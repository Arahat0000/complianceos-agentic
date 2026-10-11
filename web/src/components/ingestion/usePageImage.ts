import { useEffect, useState } from "react";
import { fetchPageImageUrl } from "@/lib/ingestion";
import { DEMO_PAGE_IMAGE } from "@/demo/ingestion";

/** Loads a page image (demo: inline SVG; real: authenticated fetch -> blob URL). */
export function usePageImage(fileId: string, page: number, isDemo: boolean) {
  const [state, setState] = useState<{ key: string; url: string | null; error: boolean }>({ key: "", url: null, error: false });
  const key = `${fileId}|${page}`;
  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    let made: string | null = null;
    fetchPageImageUrl(fileId, page)
      .then((u) => {
        made = u;
        if (!cancelled) setState({ key, url: u, error: false });
      })
      .catch(() => !cancelled && setState({ key, url: null, error: true }));
    return () => {
      cancelled = true;
      if (made?.startsWith("blob:")) URL.revokeObjectURL(made);
    };
  }, [fileId, page, isDemo, key]);
  if (isDemo) return { url: DEMO_PAGE_IMAGE, loading: false, error: false };
  const fresh = state.key === key;
  return { url: fresh ? state.url : null, loading: !fresh, error: fresh && state.error };
}

