"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Users, Crown, User, Loader2, FileText, Archive, RotateCcw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useProjects, useProjectMembers } from "@/hooks/use-projects";
import { useDrawings } from "@/hooks/use-drawings";
import { useDrawingGroups } from "@/hooks/use-drawing-groups";
import { InviteMemberDialog } from "@/components/projects/InviteMemberDialog";
import { PdfUploadZone } from "@/components/drawings/PdfUploadZone";
import { GroupedDrawingList } from "@/components/drawings/GroupedDrawingList";
import { CreateGroupDialog } from "@/components/drawings/CreateGroupDialog";
import type { ProjectWithRole } from "@/lib/types/project";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { projects, loading: projectsLoading } = useProjects();
  const { members, loading: membersLoading, inviteMember, removeMember } = useProjectMembers(id);

  const {
    drawings,
    loading: drawingsLoading,
    uploadDrawing,
    renameDrawing,
    archiveDrawing,
    restoreDrawing,
    getSignedUrl,
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

  const [inviteOpen, setInviteOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [drawingTab, setDrawingTab] = useState("active");
  const [restoringDrawing, setRestoringDrawing] = useState<string | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<Map<string, string>>(
    new Map()
  );

  // Fetch signed URLs for thumbnails when drawings change
  const fetchThumbnailUrls = useCallback(async () => {
    const activeDrawings = drawings.filter((d) => !d.is_archived);
    const urls = new Map<string, string>();

    await Promise.allSettled(
      activeDrawings.map(async (d) => {
        try {
          const url = await getSignedUrl(d.id);
          urls.set(d.id, url);
        } catch {
          // Thumbnail URL failed — card will show fallback
        }
      })
    );

    setThumbnailUrls(urls);
  }, [drawings, getSignedUrl]);

  useEffect(() => {
    if (drawings.length > 0) {
      fetchThumbnailUrls();
    }
  }, [drawings, fetchThumbnailUrls]);

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadProgress(0);
    try {
      await uploadDrawing(file, (pct) => setUploadProgress(pct));
      toast.success("Zeichnung wurde hochgeladen");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Upload fehlgeschlagen"
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function handleRename(drawingId: string, displayName: string) {
    try {
      await renameDrawing(drawingId, displayName);
      toast.success("Zeichnung wurde umbenannt");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Umbenennung fehlgeschlagen"
      );
      throw err;
    }
  }

  async function handleArchive(drawingId: string) {
    try {
      await archiveDrawing(drawingId);
      toast.success("Zeichnung wurde archiviert");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Archivierung fehlgeschlagen"
      );
      throw err;
    }
  }

  async function handleRestoreDrawing(drawingId: string) {
    setRestoringDrawing(drawingId);
    try {
      await restoreDrawing(drawingId);
      toast.success("Zeichnung wurde wiederhergestellt");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Wiederherstellung fehlgeschlagen"
      );
    } finally {
      setRestoringDrawing(null);
    }
  }

  async function handleCreateGroup(name: string) {
    try {
      await createGroup(name);
      toast.success("Gruppe wurde erstellt");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gruppe konnte nicht erstellt werden"
      );
      throw err;
    }
  }

  async function handleRenameGroup(groupId: string, name: string) {
    try {
      await renameGroup(groupId, name);
      toast.success("Gruppe wurde umbenannt");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Umbenennung fehlgeschlagen"
      );
      throw err;
    }
  }

  async function handleArchiveGroup(groupId: string) {
    try {
      await archiveGroup(groupId);
      await refetchDrawings();
      toast.success("Gruppe wurde archiviert");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Archivierung fehlgeschlagen"
      );
      throw err;
    }
  }

  async function handleAssignGroup(drawingId: string, groupId: string | null) {
    try {
      await assignDrawingToGroup(drawingId, groupId);
      await refetchDrawings();
      toast.success("Gruppe wurde zugewiesen");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Zuweisung fehlgeschlagen"
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

  async function handleInvite(email: string) {
    await inviteMember(email);
    toast.success(`${email} wurde eingeladen`);
  }

  async function handleRemoveMember(memberId: string, memberEmail: string) {
    setRemovingId(memberId);
    try {
      await removeMember(memberId);
      toast.success(`${memberEmail} wurde entfernt`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mitglied konnte nicht entfernt werden");
    } finally {
      setRemovingId(null);
    }
  }

  if (projectsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b sticky top-0 bg-background z-10">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <Skeleton className="h-5 w-32" />
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-48 w-full" />
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-4">
        <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-lg font-semibold mb-2">Projekt nicht gefunden</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Dieses Projekt existiert nicht oder du hast keinen Zugriff.
        </p>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Zurück zur Übersicht
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="-ml-2">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Übersicht
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm font-medium truncate">{project.name}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Project info */}
        <section>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold">{project.name}</h2>
              {project.description && (
                <p className="text-muted-foreground mt-1">{project.description}</p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="secondary">
                  {isOwner ? "Eigentümer" : "Mitglied"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Zuletzt geändert:{" "}
                  {new Date(project.updated_at).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Drawings (PROJ-3) + Groups (PROJ-8) */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold">Zeichnungen</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateGroupOpen(true)}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Gruppe hinzufuegen
              </Button>
              <PdfUploadZone
                onUpload={handleUpload}
                uploading={uploading}
                progress={uploadProgress}
                compact
              />
            </div>
          </div>
          <Tabs value={drawingTab} onValueChange={setDrawingTab}>
            <TabsList className="mb-3">
              <TabsTrigger value="active" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" />
                Aktiv
              </TabsTrigger>
              <TabsTrigger value="archived" className="gap-1.5 text-xs">
                <Archive className="h-3.5 w-3.5" />
                Archiv
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
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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
                    thumbnailUrls={thumbnailUrls}
                    onRenameDrawing={handleRename}
                    onArchiveDrawing={handleArchive}
                    onRenameGroup={handleRenameGroup}
                    onArchiveGroup={handleArchiveGroup}
                    onAssignGroup={handleAssignGroup}
                    versionCounts={versionCounts}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="archived">
              {drawings.filter((d) => d.is_archived).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Archive className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Keine archivierten Zeichnungen
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
                              Archiviert
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
                            Wiederherstellen
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
              Mitglieder
            </h3>
            {isOwner && (
              <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
                <UserPlus className="mr-1.5 h-4 w-4" />
                Einladen
              </Button>
            )}
          </div>

          {membersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {members.map((member) => {
                const displayName = member.profile?.display_name || member.profile?.email || "Unbekannt";
                const email = member.profile?.email || "";
                const isThisOwner = member.role === "owner";

                return (
                  <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {isThisOwner
                        ? <Crown className="h-4 w-4 text-amber-500" />
                        : <User className="h-4 w-4 text-muted-foreground" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      {email && displayName !== email && (
                        <p className="text-xs text-muted-foreground truncate">{email}</p>
                      )}
                    </div>
                    <Badge variant={isThisOwner ? "default" : "secondary"} className="text-xs">
                      {isThisOwner ? "Eigentümer" : "Mitglied"}
                    </Badge>
                    {isOwner && !isThisOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-8 px-2"
                        disabled={removingId === member.id}
                        onClick={() => handleRemoveMember(member.id, email || displayName)}
                      >
                        {removingId === member.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : "Entfernen"
                        }
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
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
    </div>
  );
}
