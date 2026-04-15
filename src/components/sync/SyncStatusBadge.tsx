"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSyncContext, type SyncState } from "./SyncProvider";
import { SyncDetailPopover } from "./SyncDetailPopover";

const stateConfig: Record<
  SyncState,
  { icon: typeof Cloud; colorClass: string }
> = {
  synced: { icon: CheckCircle2, colorClass: "text-green-500" },
  syncing: { icon: RefreshCw, colorClass: "text-blue-500" },
  stale: { icon: Clock, colorClass: "text-muted-foreground" },
  offline: { icon: CloudOff, colorClass: "text-orange-500" },
};

export function SyncStatusBadge() {
  const t = useTranslations("sync");
  const { state, lastSynced, isOnline } = useSyncContext();
  const [open, setOpen] = useState(false);

  const config = stateConfig[state];
  const Icon = config.icon;

  function getLabel(): string {
    switch (state) {
      case "synced":
        return t("synced");
      case "syncing":
        return t("syncing");
      case "offline":
        return t("offline");
      case "stale": {
        if (!lastSynced) return t("neverSynced");
        // eslint-disable-next-line react-hooks/purity -- intentional: recalculate relative time on each render
        const diff = Date.now() - lastSynced;
        const minutes = Math.floor(diff / 60_000);
        const hours = Math.floor(minutes / 60);
        if (minutes < 1) return t("synced");
        if (minutes < 60) return t("syncedMinAgo", { minutes });
        return t("syncedHoursAgo", { hours });
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs h-8 px-2"
        >
          <Icon
            className={`h-3.5 w-3.5 ${config.colorClass} ${
              state === "syncing" ? "animate-spin" : ""
            }`}
          />
          <span className="hidden sm:inline">{getLabel()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <SyncDetailPopover
          state={state}
          lastSynced={lastSynced}
          isOnline={isOnline}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
