"use client";

import { useEffect, useState } from "react";
import { CloudOff, Cloud, CloudDownload } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslations } from "next-intl";

interface OfflineIndicatorProps {
  /** Total number of PDF versions in the project */
  totalPdfs: number;
  /** Number of PDFs currently cached */
  cachedPdfs: number;
}

export function OfflineIndicator({
  totalPdfs,
  cachedPdfs,
}: OfflineIndicatorProps) {
  const t = useTranslations("sync");

  if (cachedPdfs === 0) return null;

  const isFullyCached = cachedPdfs >= totalPdfs;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {isFullyCached ? (
              <Cloud className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <CloudDownload className="h-3.5 w-3.5 text-blue-500" />
            )}
            <span>
              {isFullyCached
                ? t("offlineReady")
                : t("offlinePartial", { cached: cachedPdfs, total: totalPdfs })}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {isFullyCached
            ? t("offlineReadyTooltip")
            : t("offlinePartialTooltip", {
                cached: cachedPdfs,
                total: totalPdfs,
              })}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
