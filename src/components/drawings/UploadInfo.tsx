"use client";

import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useTranslations } from "next-intl";

interface UploadInfoProps {
  projectId: string;
  drawingId: string;
}

interface UploadData {
  userName: string;
  date: string;
}

export function UploadInfo({ projectId, drawingId }: UploadInfoProps) {
  const t = useTranslations("activity");
  const [data, setData] = useState<UploadData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchUploadInfo() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) return;

        const params = new URLSearchParams({
          page: "1",
          limit: "1",
          action_type: "drawing.uploaded",
        });

        const res = await fetch(
          `/api/projects/${projectId}/activity?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (!res.ok) return;

        const result = await res.json();
        const entries = result.entries ?? [];

        // Find the upload entry for this specific drawing
        const uploadEntry = entries.find(
          (e: { target_id: string; action_type: string }) =>
            e.target_id === drawingId && e.action_type === "drawing.uploaded"
        );

        if (uploadEntry && !cancelled) {
          const metadata = uploadEntry.metadata as Record<string, string>;
          const userName = metadata.user_name ?? t("unknownUser");
          const date = new Date(uploadEntry.created_at).toLocaleDateString(
            "de-DE",
            { day: "2-digit", month: "2-digit", year: "numeric" }
          );
          setData({ userName, date });
        }
      } catch {
        // Silently fail - this is optional info
      }
    }

    fetchUploadInfo();
    return () => {
      cancelled = true;
    };
  }, [projectId, drawingId, t]);

  if (!data) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Upload className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {t("uploadedBy", { name: data.userName, date: data.date })}
      </span>
    </div>
  );
}
