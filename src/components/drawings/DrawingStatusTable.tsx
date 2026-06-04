"use client";

import { useMemo, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useVersions } from "@/hooks/use-versions";
import { useTranslations } from "next-intl";
import type { Drawing, DrawingGroup } from "@/lib/types/drawing";

interface DrawingStatusTableProps {
  drawings: Drawing[];
  groups: DrawingGroup[];
  projectId: string;
}

interface StatusLike {
  name: string;
  color: string;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function StatusPill({ status }: { status?: StatusLike | null }) {
  if (!status) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium leading-none rounded-full border px-1.5 py-0.5"
      style={{ borderColor: status.color }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: status.color }}
        aria-hidden="true"
      />
      {status.name}
    </span>
  );
}

// Lazily loaded version history — only mounted once the row is expanded, so
// the per-drawing versions query (Free-plan IO) fires on demand, not for every
// row up front.
function VersionHistory({ projectId, drawingId }: { projectId: string; drawingId: string }) {
  const t = useTranslations("drawings");
  const { versions, loading } = useVersions(projectId, drawingId);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("overview.loadingVersions")}
      </div>
    );
  }

  const active = versions
    .filter((v) => !v.is_archived)
    .sort((a, b) => b.version_number - a.version_number);

  if (active.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">
        {t("overview.noVersions")}
      </p>
    );
  }

  return (
    <ul className="divide-y border-t bg-muted/20">
      {active.map((v) => (
        <li key={v.id} className="flex items-center gap-3 px-3 py-1.5 text-xs">
          <Badge variant="outline" className="font-mono text-[10px] h-5 shrink-0">
            v{v.version_number}
          </Badge>
          <span className="flex-1 truncate text-muted-foreground">{v.label}</span>
          <span className="w-20 sm:w-24 shrink-0 tabular-nums text-muted-foreground">
            {formatDate(v.created_at)}
          </span>
          <span className="w-28 sm:w-32 shrink-0">
            <StatusPill status={v.status} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * PROJ-31 — Stand overview: drawings as a list with date + status, with an
 * expandable version history per row. Grouped + alphabetical (shares the sort
 * with PROJ-27). Read-only display; status editing stays in the grid/viewer.
 */
export function DrawingStatusTable({ drawings, groups, projectId }: DrawingStatusTableProps) {
  const t = useTranslations("drawings");
  const [open, setOpen] = useState<string[]>([]);

  const activeGroups = useMemo(
    () =>
      groups
        .filter((g) => !g.is_archived)
        .sort((a, b) => {
          const byName = a.name.localeCompare(b.name, "de", {
            numeric: true,
            sensitivity: "base",
          });
          if (byName !== 0) return byName;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }),
    [groups]
  );

  const byGroup = useMemo(() => {
    const map = new Map<string | null, Drawing[]>();
    for (const g of activeGroups) map.set(g.id, []);
    map.set(null, []);
    for (const d of drawings) {
      const key = d.group_id && map.has(d.group_id) ? d.group_id : null;
      map.get(key)!.push(d);
    }
    for (const [, list] of map) {
      list.sort((a, b) =>
        a.display_name.localeCompare(b.display_name, "de", {
          numeric: true,
          sensitivity: "base",
        })
      );
    }
    return map;
  }, [drawings, activeGroups]);

  // Sections in render order. Named groups first (even when empty, for parity
  // with the grid), "Ohne Gruppe" last and only when it has drawings.
  const sections: { id: string | null; name: string; items: Drawing[] }[] = [
    ...activeGroups.map((g) => ({ id: g.id, name: g.name, items: byGroup.get(g.id) ?? [] })),
  ];
  const ungrouped = byGroup.get(null) ?? [];
  if (ungrouped.length > 0) {
    sections.push({ id: null, name: t("overview.ungrouped"), items: ungrouped });
  }
  const showGroupHeaders = activeGroups.length > 0;

  if (drawings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 flex flex-col items-center justify-center py-16 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium">{t("overview.empty")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.id ?? "__ungrouped__"} className="rounded-lg border overflow-hidden">
          {showGroupHeaders && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/50 border-b">
              <span className="text-sm font-medium truncate">{section.name}</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">
                {section.items.length}
              </Badge>
            </div>
          )}

          {/* Column header */}
          <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground bg-muted/20 border-b">
            <span className="flex-1">{t("overview.colName")}</span>
            <span className="w-20 sm:w-24 shrink-0">{t("overview.colDate")}</span>
            <span className="w-28 sm:w-32 shrink-0">{t("overview.colStatus")}</span>
            <span className="w-4 shrink-0" aria-hidden="true" />
          </div>

          {section.items.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">{t("overview.groupEmpty")}</p>
          ) : (
            <Accordion type="multiple" value={open} onValueChange={setOpen}>
              {section.items.map((d) => (
                <AccordionItem key={d.id} value={d.id} className="border-b last:border-b-0">
                  <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/40">
                    <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <span className="flex-1 truncate text-sm font-medium">{d.display_name}</span>
                      <span className="w-20 sm:w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatDate(d.latest_version?.created_at)}
                      </span>
                      <span className="w-28 sm:w-32 shrink-0">
                        <StatusPill status={d.latest_version?.status} />
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0">
                    {open.includes(d.id) && (
                      <VersionHistory projectId={projectId} drawingId={d.id} />
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      ))}
    </div>
  );
}
