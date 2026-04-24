"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Users, Crown, User, Loader2, FileText, Archive, RotateCcw, Plus, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useProjects, useProjectMembers } from "@/hooks/use-projects";
import { useDrawings } from "@/hooks/use-drawings";
import { useDrawingGroups } from "@/hooks/use-drawing-groups";
import { useDrawingStatuses } from "@/hooks/use-drawing-statuses";
import { InviteMemberDialog } from "@/components/projects/InviteMemberDialog";
import { ActivityLog } from "@/components/projects/ActivityLog";
import { GroupedDrawingList } from "@/components/drawings/GroupedDrawingList";
import { Logo } from "@/components/Logo";
import { CreateGroupDialog } from "@/components/drawings/CreateGroupDialog";
import dynamic from "next/dynamic";
const ProjectSyncButton = dynamic(
  () => import("@/components/sync/ProjectSyncButton").then((m) => m.ProjectSyncButton),
  { ssr: false }
);
const SyncStatusBadge = dynamic(
  () => import("@/components/sync/SyncStatusBadge").then((m) => m.SyncStatusBadge),
  { ssr: false }
);
import type { ProjectWithRole } from "@/lib/types/project";
import { useTranslations } from "next-intl";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations("drawings");
  const tp = useTranslations("projects");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const { projects, loading: projectsLoading, leaveProject } = useProjects();
  const { members, loading: membersLoading, inviteMember, removeMember, changeRole, refetch: refetchMembers } = useProjectMembers(id);

  const {
    drawings,
    loading: drawingsLoading,
    uploadDrawing,
    renameDrawing,
    archiveDrawing,
    restoreDrawing,
    getSignedUrl,
    updateDrawingVersionStatus,
    refetch: refetchDrawings,
  } = useDrawings(id);

  const {
    groups,
    loading: groupsLoading,
    createGroup,
    renameGroup,
    archiveGroup,
    assignDrawingToGroup,
  } = useDrawingGroups(id);

  const { statuses, defaultStatus } = useDrawingStatuses();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [removeMemberTarget, setRemoveMemberTarget] = useState<{ id: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [drawingTab, setDrawingTab] = useState("active");
  const [restoringDrawing, setRestoringDrawing] = useState<string | null>(null);
  // Pre-signed thumbnail JPEG URLs for modern uploads come straight from
  // /api/projects/[id]/drawings as drawing.thumbnail_url. We only need to
  // fetch PDF URLs on demand for legacy drawings (no thumbnail yet).
  const [legacyPdfUrls, setLegacyPdfUrls] = useState<Map<string, string>>(
    new Map()
  );

  const fetchLegacyPdfUrls = useCallback(async (signal: AbortSignal) => {
    const legacyDrawings = drawings.filter(
      (d) => !d.is_archived && !d.thumbnail_url
    );
    if (legacyDrawings.length === 0) {
      if (!signal.aborted) setLegacyPdfUrls(new Map());
      return;
    }

    const urls = new Map<string, string>();
    await Promise.allSettled(
      legacyDrawings.map(async (d) => {
        try {
          const url = await getSignedUrl(d.id);
          if (!signal.aborted) urls.set(d.id, url);
        } catch {
          // Fallback SVG will be shown
        }
      })
    );

    if (!signal.aborted) setLegacyPdfUrls(urls);
  }, [drawings, getSignedUrl]);

  useEffect(() => {
    if (drawings.length > 0) {
      const controller = new AbortController();
      fetchLegacyPdfUrls(controller.signal);
      return () => controller.abort();
    }
  }, [drawings, fetchLegacyPdfUrls]);

  // DrawingCard reads drawing.thumbnail_url directly for modern uploads;
  // legacyPdfUrls feeds the PDF fallback for drawings without a server-side
  // thumbnail yet.

  async function handleUploadToGroup(groupId: string | null, file: File) {
    setUploading(true);
    setUploadProgress(0);
    try {
      await uploadDrawing(file, (pct) => setUploadProgress(pct), {
        status_id: defaultStatus?.id ?? null,
        group_id: groupId,
      });
      toast.success(t("toasts.uploaded"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("toasts.uploadFailed")
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function handleUploadMultipleToGroup(groupId: string | null, files: File[]) {
    setUploading(true);
    let uploaded = 0;
    for (const file of files) {
      setUploadProgress(Math.round((uploaded / files.length) * 100));
      try {
        await uploadDrawing(file, () => {}, {
          status_id: defaultStatus?.id ?? null,
          group_id: groupId,
        });
        uploaded++;
      } catch (err) {
        toast.error(
          `${file.name}: ${err instanceof Error ? err.message : t("toasts.uploadFailed")}`
        );
      }
    }
    setUploading(false);
    setUploadProgress(0);
    if (uploaded > 0) {
      toast.success(t("toasts.uploaded") + ` (${uploaded}/${files.length})`);
    }
  }

  async function handleRename(drawingId: string, displayName: string) {
    try {
      await renameDrawing(drawingId, displayName);
      toast.success(t("toasts.renamed"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("toasts.renameFailed")
      );
      throw err;
    }
  }

  async function handleArchive(drawingId: string) {
    try {
      await archiveDrawing(drawingId);
      toast.success(t("toasts.archived"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("toasts.archiveFailed")
      );
      throw err;
    }
  }

  async function handleRestoreDrawing(drawingId: string) {
    setRestoringDrawing(drawingId);
    try {
      await restoreDrawing(drawingId);
      toast.success(t("toasts.restored"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("toasts.restoreFailed")
      );
    } finally {
      setRestoringDrawing(null);
    }
  }

  async function handleStatusChange(drawingId: string, versionId: string, statusId: string | null) {
    // Optimistic update
    updateDrawingVersionStatus(drawingId, versionId, statusId, statuses);

    try {
      const res = await fetch(
        `/api/projects/${id}/drawings/${drawingId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status_id: statusId, version_id: versionId }),
        }
      );
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Status konnte nicht geändert werden");
      }
      toast.success("Status aktualisiert");
    } catch (err) {
      // Revert on error
      await refetchDrawings();
      toast.error(
        err instanceof Error ? err.message : "Status konnte nicht geändert werden"
      );
    }
  }

  async function handleCreateGroup(name: string) {
    try {
      await createGroup(name);
      toast.success(t("toasts.groupCreated"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("toasts.groupCreateFailed")
      );
      throw err;
    }
  }

  async function handleRenameGroup(groupId: string, name: string) {
    try {
      await renameGroup(groupId, name);
      toast.success(t("toasts.groupRenamed"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("toasts.groupRenameFailed")
      );
      throw err;
    }
  }

  async function handleArchiveGroup(groupId: string) {
    try {
      await archiveGroup(groupId);
      await refetchDrawings();
      toast.success(t("toasts.groupArchived"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("toasts.groupArchiveFailed")
      );
      throw err;
    }
  }

  async function handleAssignGroup(drawingId: string, groupId: string | null) {
    try {
      await assignDrawingToGroup(drawingId, groupId);
      await refetchDrawings();
      toast.success(t("toasts.groupAssigned"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("toasts.groupAssignFailed")
      );
      throw err;
    }
  }

  // Build version count map from drawing data (populated by backend when available)
  const versionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of drawings) {
      if (d.version_count != null && d.version_count > 1) {
        map.set(d.id, d.version_count);
      }
    }
    return map;
  }, [drawings]);

  const project = projects.find((p) => p.id === id) as ProjectWithRole | undefined;
  const isOwner = project?.role === "owner";
  const isMember = project?.role === "owner" || project?.role === "member";
  const isViewer = project?.role === "viewer";

  async function handleInvite(email: string) {
    await inviteMember(email);
    toast.success(tp("toasts.invited", { email }));
  }

  async function handleLeaveProject() {
    if (!project) return;
    setLeaving(true);
    try {
      await leaveProject(project.id);
      toast.success(tp("toasts.left", { name: project.name }));
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tp("toasts.leaveFailed"));
    } finally {
      setLeaving(false);
      setLeaveOpen(false);
    }
  }

  async function handleRemoveMemberConfirmed() {
    if (!removeMemberTarget) return;
    const { id: memberId, name: memberName } = removeMemberTarget;
    setRemovingId(memberId);
    try {
      await removeMember(memberId);
      toast.success(tp("toasts.memberRemoved", { name: memberName }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tp("toasts.memberRemoveFailed"));
    } finally {
      setRemovingId(null);
      setRemoveMemberTarget(null);
    }
  }

  async function handleRemoveMember(memberId: string, memberEmail: string) {
    setRemovingId(memberId);
    try {
      await removeMember(memberId);
      toast.success(`${memberEmail} wurde entfernt`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("memberRemoveFailed"));
    } finally {
      setRemovingId(null);
    }
  }

  if (projectsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b sticky top-0 bg-background z-10">
          <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-5 w-40" />
          </div>
        </header>
        <main className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-9 w-32 rounded" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-lg border bg-card overflow-hidden">
                <Skeleton className="aspect-[4/3] w-full" />
                <div className="p-2.5 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-4">
        <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-lg font-semibold mb-2">{t("notFound")}</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {t("notFoundDescription")}
        </p>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          {t("backToOverview")}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center gap-2 sm:gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="-ml-2 h-9 w-9 p-0 sm:h-auto sm:w-auto sm:px-3 sm:py-1.5">
              <ArrowLeft className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">{t("overview")}</span>
            </Button>
          </Link>
          <Logo size="sm" className="hidden sm:inline-flex" />
          <Separator orientation="vertical" className="h-5 hidden sm:block" />
          <span className="text-sm font-medium truncate flex-1">{project.name}</span>
          <SyncStatusBadge />
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Project info */}
        <section>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold">{project.name}</h2>
              {project.description && (
                <p className="text-muted-foreground mt-1">{project.description}</p>
              )}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Badge variant="secondary">
                  {isViewer ? tp("viewer") : isOwner ? tp("owner") : tp("member")}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {t("lastModified")}{" "}
                  {new Date(project.updated_at).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </span>
                <ProjectSyncButton
                  projectId={id}
                  fetchDrawings={async () => {
                    const res = await fetch(`/api/projects/${id}/drawings`);
                    const json = await res.json();
                    return json.drawings ?? [];
                  }}
                  fetchVersions={async (drawingId: string) => {
                    const res = await fetch(`/api/projects/${id}/drawings/${drawingId}/versions?includeArchived=true`);
                    const json = await res.json();
                    return json.versions ?? [];
                  }}
                  fetchMarkers={async (drawingId: string) => {
                    const res = await fetch(`/api/projects/${id}/drawings/${drawingId}/markers`);
                    const json = await res.json();
                    return json.markers ?? [];
                  }}
                  fetchGroups={async () => {
                    const res = await fetch(`/api/projects/${id}/groups`);
                    const json = await res.json();
                    return json.groups ?? [];
                  }}
                  getVersionSignedUrl={async (versionId: string, drawingId: string) => {
                    const res = await fetch(`/api/projects/${id}/drawings/${drawingId}/versions/${versionId}/url`);
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error ?? "URL failed");
                    return json.url;
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Drawings (PROJ-3) + Groups (PROJ-8) */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h3 className="text-base font-semibold">{t("title")}</h3>
            {!isViewer && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateGroupOpen(true)}
                className="shrink-0"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                <span className="hidden min-[480px]:inline">{t("addGroup")}</span>
                <span className="min-[480px]:hidden">Gruppe</span>
              </Button>
            )}
          </div>
          <Tabs value={drawingTab} onValueChange={setDrawingTab}>
            <TabsList className="mb-3">
              <TabsTrigger value="active" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" />
                {tn("active")}
              </TabsTrigger>
              <TabsTrigger value="archived" className="gap-1.5 text-xs">
                <Archive className="h-3.5 w-3.5" />
                {tn("archive")}
                {drawings.filter((d) => d.is_archived).length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 min-w-[16px] px-1 text-[10px]">
                    {drawings.filter((d) => d.is_archived).length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              <div className="space-y-4">
                {drawingsLoading || groupsLoading ? (
                  <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="rounded-lg border overflow-hidden">
                        <Skeleton className="aspect-[3/4]" />
                        <div className="p-3 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <GroupedDrawingList
                    drawings={drawings.filter((d) => !d.is_archived)}
                    groups={groups}
                    projectId={id}
                    legacyPdfUrls={legacyPdfUrls}
                    onRenameDrawing={handleRename}
                    onArchiveDrawing={handleArchive}
                    onRenameGroup={handleRenameGroup}
                    onArchiveGroup={handleArchiveGroup}
                    onAssignGroup={handleAssignGroup}
                    versionCounts={versionCounts}
                    statuses={statuses}
                    onStatusChange={handleStatusChange}
                    onUploadToGroup={isViewer ? undefined : handleUploadToGroup}
                    onUploadMultipleToGroup={isViewer ? undefined : handleUploadMultipleToGroup}
                    uploading={uploading}
                    uploadProgress={uploadProgress}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="archived">
              {drawings.filter((d) => d.is_archived).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Archive className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {t("noArchivedDrawings")}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {drawings
                    .filter((d) => d.is_archived)
                    .map((drawing) => (
                      <div
                        key={drawing.id}
                        className="rounded-lg border bg-card overflow-hidden"
                      >
                        <div className="aspect-[3/4] bg-muted flex items-center justify-center">
                          <Archive className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                        <div className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium truncate">
                              {drawing.display_name}
                            </p>
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              {tp("archived")}
                            </Badge>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            disabled={restoringDrawing === drawing.id}
                            onClick={() => handleRestoreDrawing(drawing.id)}
                          >
                            {restoringDrawing === drawing.id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            {tp("restore")}
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </section>

        {/* Members */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t("members")}
            </h3>
            {isMember && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  {t("invite")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setLeaveOpen(true)}
                >
                  <LogOut className="mr-1.5 h-4 w-4" />
                  {tp("leave")}
                </Button>
              </div>
            )}
          </div>

          {membersLoading ? (
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-28 rounded-full" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Mitglieder</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {members.map((member) => {
                const displayName = member.profile?.display_name || member.profile?.email || t("unknown");
                const isThisOwner = member.role === "owner";

                return (
                  <div
                    key={member.id}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 pl-1.5 pr-2.5 py-1 text-xs"
                  >
                    {isOwner ? (
                      <button
                        className="h-5 w-5 rounded-full bg-background flex items-center justify-center shrink-0 hover:bg-accent transition-colors"
                        title={isThisOwner ? "Zum Mitglied machen" : "Zum Eigentümer machen"}
                        onClick={async () => {
                          const newRole = isThisOwner ? "member" : "owner";
                          try {
                            await changeRole(member.id, newRole);
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Fehler");
                          }
                        }}
                      >
                        {isThisOwner
                          ? <Crown className="h-3 w-3 text-amber-500" />
                          : <User className="h-3 w-3 text-muted-foreground" />
                        }
                      </button>
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-background flex items-center justify-center shrink-0">
                        {isThisOwner
                          ? <Crown className="h-3 w-3 text-amber-500" />
                          : <User className="h-3 w-3 text-muted-foreground" />
                        }
                      </div>
                    )}
                    <span className="font-medium truncate max-w-[120px]">{displayName}</span>
                    {isMember && !isThisOwner && (
                      <button
                        className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                        disabled={removingId === member.id}
                        onClick={() => setRemoveMemberTarget({ id: member.id, name: displayName })}
                        aria-label={t("remove")}
                      >
                        {removingId === member.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <X className="h-3 w-3" />
                        }
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Activity Log (PROJ-15) */}
        <ActivityLog projectId={id} members={members} />
      </main>

      <InviteMemberDialog
        project={project}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSubmit={handleInvite}
      />

      <CreateGroupDialog
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
        onSubmit={handleCreateGroup}
        existingNames={groups.filter((g) => !g.is_archived).map((g) => g.name)}
      />

      {/* Leave project confirmation */}
      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tp("leaveConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tp("leaveConfirm.description", { name: project?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveProject}
              disabled={leaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {leaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tp("leaveConfirm.submit")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove member confirmation */}
      <AlertDialog open={removeMemberTarget !== null} onOpenChange={(open) => { if (!open) setRemoveMemberTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tp("removeConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tp("removeConfirm.description", { name: removeMemberTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingId !== null}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMemberConfirmed}
              disabled={removingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removingId !== null && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tp("removeConfirm.submit")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
