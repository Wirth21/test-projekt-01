"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectSignature } from "@/hooks/use-project-signature";

/**
 * Shows a "new changes available — refresh" banner when the project's
 * server-side signature has moved past the one the user is currently viewing.
 *
 * This is the "load from cache, then tell me when something changed" behaviour:
 * the cached lists keep showing instantly, and the only thing hitting the
 * network on a timer is the tiny signature. The heavy drawings/markers/versions
 * queries are refetched only when the user clicks refresh.
 */
export function ProjectChangesBanner({ projectId }: { projectId: string }) {
  const tp = useTranslations("projects");
  const queryClient = useQueryClient();
  const { data: signature } = useProjectSignature(projectId);

  // The signature the user is currently looking at. null until the first
  // signature arrives, so the banner never flashes on the initial load.
  const [appliedSig, setAppliedSig] = useState<string | null>(null);

  // Establish the baseline on the first signature — adjusting state during
  // render is React's endorsed alternative to a setState-in-effect.
  if (signature && appliedSig === null) {
    setAppliedSig(signature);
  }

  const changesAvailable =
    !!signature && appliedSig !== null && signature !== appliedSig;

  const handleRefresh = useCallback(async () => {
    // Prefix invalidation covers every cached query for this project:
    // ["markers", projectId, ...] and ["versions", projectId, ...] match too.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["drawings", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["drawing-groups", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["markers", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["versions", projectId] }),
    ]);
    setAppliedSig(signature ?? null);
  }, [queryClient, projectId, signature]);

  if (!changesAvailable) return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
      <span>{tp("changesAvailable")}</span>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 shrink-0"
        onClick={handleRefresh}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        {tp("refresh")}
      </Button>
    </div>
  );
}
