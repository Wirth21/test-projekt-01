"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileWarning, Archive, ExternalLink, FileText } from "lucide-react";
import type { MarkerWithTarget } from "@/lib/types/marker";
import { useTranslations } from "next-intl";

interface MarkerTooltipProps {
  marker: MarkerWithTarget;
  anchorEl: HTMLElement | null;
  /** Kept on the prop interface for back-compat with callers that already
   *  pass it; no longer used internally — the tooltip displays the cached
   *  JPEG thumbnail URL the markers API ships with each marker. */
  getSignedUrl?: (drawingId: string) => Promise<string>;
  onNavigate: (marker: MarkerWithTarget) => void;
  onClose: () => void;
}

export function MarkerTooltip({
  marker,
  anchorEl,
  onNavigate,
  onClose,
}: MarkerTooltipProps) {
  const t = useTranslations("markers");
  const target = marker.target_drawing;
  const isDeleted = !target;
  const isArchived = target?.is_archived;

  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const rafRef = useRef<number>(0);

  // Track anchor element position every frame
  useEffect(() => {
    if (!anchorEl) return;

    function tick() {
      const rect = anchorEl!.getBoundingClientRect();
      setPos({
        left: rect.left + rect.width / 2,
        top: rect.top - 8,
      });
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [anchorEl]);

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
            {target.thumbnail_url ? (
              <div className="w-full h-28 bg-muted rounded overflow-hidden flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not a static asset */}
                <img
                  src={target.thumbnail_url}
                  alt=""
                  className="max-w-full max-h-full object-contain"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ) : (
              <div className="w-full h-28 bg-muted rounded flex items-center justify-center">
                <FileText className="h-6 w-6 text-muted-foreground/40" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(tooltip, document.body);
}
