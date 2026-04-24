"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Inbox, Layers, Layers3, FolderTree, Trash2, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DeleteProjectDialog } from "@/components/admin/DeleteProjectDialog";
import { useAdminTenantProjects } from "@/hooks/use-admin-projects";
import { formatBytes } from "@/lib/plan-limits";
import type { AdminTenantProject } from "@/lib/types/admin";

function formatDate(dateStr: string, locale: string) {
  try {
    return new Date(dateStr).toLocaleDateString(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function AdminProjectsPage() {
  const t = useTranslations("admin.projects");
  const tc = useTranslations("common");

  const { projects, loading, error, refetch, deleteProject, deleting } =
    useAdminTenantProjects();

  const [showArchived, setShowArchived] = useState(false);
  const [targetProject, setTargetProject] =
    useState<AdminTenantProject | null>(null);

  // Sort alphabetically by name, then filter by archive flag if hidden.
  const visibleProjects = useMemo(() => {
    const sorted = [...projects].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    return showArchived
      ? sorted
      : sorted.filter((p) => !p.is_archived);
  }, [projects, showArchived]);

  const archivedCount = useMemo(
    () => projects.filter((p) => p.is_archived).length,
    [projects]
  );

  async function handleDelete(projectId: string) {
    const name = projects.find((p) => p.id === projectId)?.name ?? "";
    try {
      await deleteProject(projectId);
      toast.success(t("toasts.deleted", { name }));
      setTargetProject(null);
    } catch (err) {
      // Surface the error inside the dialog; re-throw so the dialog
      // can keep itself open and show the message.
      throw err;
    }
  }

  const dateLocale =
    typeof navigator !== "undefined" ? navigator.language : "de-DE";

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("subtitle")}
          </p>
        </div>

        {/* Archive toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <Switch
            id="admin-projects-show-archived"
            checked={showArchived}
            onCheckedChange={setShowArchived}
            aria-label={t("showArchivedAria")}
          />
          <Label
            htmlFor="admin-projects-show-archived"
            className="text-sm cursor-pointer"
          >
            {t("showArchived")}
            {archivedCount > 0 && (
              <span className="ml-1.5 text-muted-foreground">
                ({archivedCount})
              </span>
            )}
          </Label>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-2 min-w-0 flex-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                  <Skeleton className="h-9 w-24 shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={refetch}
          >
            {tc("retry")}
          </Button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && visibleProjects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Inbox
            className="h-12 w-12 text-muted-foreground/40 mb-4"
            aria-hidden="true"
          />
          <h3 className="text-lg font-medium mb-1">{t("empty.title")}</h3>
          <p className="text-sm text-muted-foreground">
            {showArchived
              ? t("empty.descriptionWithArchived")
              : t("empty.description")}
          </p>
        </div>
      )}

      {/* Project list */}
      {!loading && !error && visibleProjects.length > 0 && (
        <ul className="space-y-3" aria-label={t("listAria")}>
          {visibleProjects.map((project) => (
            <li key={project.id}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Name + archived badge */}
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold truncate">
                          {project.name}
                        </h3>
                        {project.is_archived && (
                          <Badge variant="secondary" className="shrink-0">
                            {t("archivedBadge")}
                          </Badge>
                        )}
                      </div>

                      {/* Meta */}
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          {t("meta.createdAt", {
                            date: formatDate(project.created_at, dateLocale),
                          })}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("meta.drawings", {
                            count: project.drawings_count,
                          })}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Layers3 className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("meta.versions", {
                            count: project.versions_count,
                          })}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <UsersIcon
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          {t("meta.members", { count: project.members_count })}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <FolderTree
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          {t("meta.groups", { count: project.groups_count })}
                        </span>
                        <span>
                          {t("meta.storage", {
                            size: formatBytes(project.storage_bytes),
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setTargetProject(project)}
                        disabled={deleting && targetProject?.id === project.id}
                        aria-label={t("deleteAria", { name: project.name })}
                        className="w-full sm:w-auto"
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        {t("deleteButton")}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Confirm dialog */}
      <DeleteProjectDialog
        project={targetProject}
        open={targetProject !== null}
        onOpenChange={(open) => {
          if (!open) setTargetProject(null);
        }}
        onConfirm={handleDelete}
      />

    </div>
  );
}
