"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Loader2, FileWarning, Archive } from "lucide-react";
import type { MarkerWithTarget } from "@/lib/types/marker";

interface MarkerTooltipProps {
  marker: MarkerWithTarget;
  anchorRect: DOMRect | null;
  getSignedUrl: (drawingId: string) => Promise<string>;
}

export function MarkerTooltip({
  marker,
  anchorRect,
  getSignedUrl,
}: MarkerTooltipProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const target = marker.target_drawing;
  const isDeleted = !target;
  const isArchived = target?.is_archived;

  useEffect(() => {
    if (!target || target.is_archived) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getSignedUrl(target.id)
      .then((url) => {
        if (!cancelled) setThumbnailUrl(url);
      })
      .catch(() => {
        // Failed to load thumbnail — tooltip will show without it
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [target, getSignedUrl]);

  if (!anchorRect) return null;

  // Position tooltip above the marker
  const style: React.CSSProperties = {
    position: "fixed",
    left: anchorRect.left + anchorRect.width / 2,
    top: anchorRect.top - 8,
    transform: "translate(-50%, -100%)",
    zIndex: 50,
  };

  return (
    <div ref={ref} style={style} className="pointer-events-none">
      <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg p-3 max-w-[220px]">
        <p className="text-sm font-medium mb-1 truncate">{marker.name}</p>

        {isDeleted ? (
          <div className="flex items-center gap-1.5 text-destructive text-xs">
            <FileWarning className="h-3.5 w-3.5 shrink-0" />
            <span>Zieldokument gelöscht</span>
          </div>
        ) : isArchived ? (
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Archive className="h-3.5 w-3.5 shrink-0" />
            <span>Zeichnung archiviert</span>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-2 truncate">
              → {target.display_name}
            </p>
            {loading ? (
              <div className="w-full h-24 bg-muted rounded flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : thumbnailUrl ? (
              <div className="w-full h-24 bg-muted rounded overflow-hidden flex items-center justify-center">
                <Document file={thumbnailUrl} loading={null} error={null}>
                  <Page
                    pageNumber={1}
                    width={180}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </Document>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
