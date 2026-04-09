"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, HardDrive, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { SyncState } from "./SyncProvider";
import { clearPdfCache, getPdfCacheStats } from "@/lib/offline/pdf-cache";
import { formatLastSynced } from "@/lib/offline/sync-engine";

interface SyncDetailPopoverProps {
  state: SyncState;
  lastSynced: number | null;
  isOnline: boolean;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function SyncDetailPopover({
  state,
  lastSynced,
  isOnline,
  onClose,
}: SyncDetailPopoverProps) {
  const t = useTranslations("sync");
  const [cacheStats, setCacheStats] = useState<{
    count: number;
    totalSize: number;
  } | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    getPdfCacheStats().then(setCacheStats);
  }, []);

  async function handleClearAll() {
    setClearing(true);
    try {
      await clearPdfCache();
      setCacheStats({ count: 0, totalSize: 0 });
      toast.success(t("cacheCleared"));
    } catch {
      toast.error(t("cacheClearFailed"));
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="font-medium text-sm">{t("syncStatus")}</div>

      {/* Connection status */}
      <div className="flex items-center gap-2 text-sm">
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4 text-green-500" />
            <span>{t("online")}</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-orange-500" />
            <span>{t("offlineStatus")}</span>
          </>
        )}
      </div>

      {/* Last synced */}
      <div className="text-sm text-muted-foreground">
        {t("lastSync")}: {formatLastSynced(lastSynced)}
      </div>

      <Separator />

      {/* Cache stats */}
      <div className="flex items-center gap-2 text-sm">
        <HardDrive className="h-4 w-4 text-muted-foreground" />
        <span>
          {cacheStats
            ? t("cacheSize", {
                count: cacheStats.count,
                size: formatBytes(cacheStats.totalSize),
              })
            : t("cacheLoading")}
        </span>
      </div>

      {/* Clear cache button */}
      {cacheStats && cacheStats.count > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={handleClearAll}
          disabled={clearing}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {clearing ? t("clearing") : t("clearAllCache")}
        </Button>
      )}
    </div>
  );
}
