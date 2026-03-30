"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Document, Page } from "react-pdf";
import { Loader2, FileWarning, Archive, ExternalLink } from "lucide-react";
import type { MarkerWithTarget } from "@/lib/types/marker";
import { useTranslations } from "next-intl";

interface MarkerTooltipProps {
  marker: MarkerWithTarget;
  anchorEl: HTMLElement | null;
  getSignedUrl: (drawingId: string) => Promise<string>;
  onNavigate: (marker: MarkerWithTarget) => void;
  onClose: () => void;
}

export function MarkerTooltip({
  marker,
  anchorEl,
  getSignedUrl,
  onNavigate,
  onClose,
}: MarkerTooltipProps) {
  const t = useTranslations("markers");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const rafRef = useRef<number>(0);

  const target = marker.target_drawing;
  const isDeleted = !target;
  const isArchived = target?.is_archived;

  // Track anchor element position every frame
  const updatePosition = useCallback(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    setPos({
      left: rect.left + rect.width / 2,
      top: rect.top - 8,
    });
    rafRef.current = requestAnimationFrame(updatePosition);
  }, [anchorEl]);

  useEffect(() => {
    if (anchorEl) {
      rafRef.current = requestAnimationFrame(updatePosition);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [anchorEl, updatePosition]);

  // Load thumbnail
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
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [target, getSignedUrl]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  if (!pos) return null;

  const canNavigate = target && !target.is_archived;

  const tooltip = (
    <div
      ref={tooltipRef}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        transform: "translate(-50%, -100%)",
        zIndex: 50,
      }}
    >
      <div
        className={`bg-popover text-popover-foreground border rounded-lg shadow-lg p-3 max-w-[240px] ${canNavigate ? "cursor-pointer hover:border-primary/50 transition-colors" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          if (canNavigate) {
            onNavigate(marker);
            onClose();
          }
        }}
      >
        <p className="text-sm font-medium mb-1 truncate">{marker.name}</p>

        {isDeleted ? (
          <div className="flex items-center gap-1.5 text-destructive text-xs">
            <FileWarning className="h-3.5 w-3.5 shrink-0" />
            <span>{t("tooltip.targetDeleted")}</span>
          </div>
        ) : isArchived ? (
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Archive className="h-3.5 w-3.5 shrink-0" />
            <span>{t("tooltip.targetArchived")}</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{target.display_name}</span>
            </div>
            {loading ? (
              <div className="w-full h-28 bg-muted rounded flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : thumbnailUrl ? (
              <div className="w-full h-28 bg-muted rounded overflow-hidden flex items-center justify-center">
                <Document file={thumbnailUrl} loading={null} error={null}>
                  <Page
                    pageNumber={1}
                    width={200}
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

  if (typeof document === "undefined") return null;
  return createPortal(tooltip, document.body);
}
