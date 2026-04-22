"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus, LogOut, FolderOpen, Loader2, ShieldAlert, Archive, RotateCcw, EyeOff, Users, LogIn, User, FileText, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useProjects, useProjectMembers } from "@/hooks/use-projects";
import { useUser } from "@/components/providers/UserProvider";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { EditProjectDialog } from "@/components/projects/EditProjectDialog";
import { InviteMemberDialog } from "@/components/projects/InviteMemberDialog";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import dynamic from "next/dynamic";
const SyncStatusBadge = dynamic(
  () => import("@/components/sync/SyncStatusBadge").then((m) => m.SyncStatusBadge),
  { ssr: false }
);
import type { ProjectWithRole } from "@/lib/types/project";
import type { CreateProjectInput, EditProjectInput } from "@/lib/validations/project";

export default function DashboardPage() {
  const router = useRouter();
  const tc = useTranslations("common");
  const tp = useTranslations("projects");
  const tn = useTranslations("nav");
  const ta = useTranslations("auth");
  const { isAdmin, isReadOnly } = useUser();
  const {
    projects,
    loading,
    error,
    inactiveProjects,
    inactiveLoading,
    archivedProjects,
    archivedLoading,
    createProject,
    updateProject,
    archiveProject,
    restoreProject,
    joinProject,
    fetchInactiveProjects,
    fetchArchivedProjects,
  } = useProjects();

  const [activeTab, setActiveTab] = useState("active");
  const [restoring, setRestoring] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<ProjectWithRole | null>(null);
  const [inviteProject, setInviteProject] = useState<ProjectWithRole | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ProjectWithRole | null>(null);
  const [archiving, setArchiving] = useState(false);

  const { inviteMember } = useProjectMembers(inviteProject?.id ?? "");

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleCreate(data: CreateProjectInput) {
    try {
      await createProject(data);
      toast.success(tp("toasts.created"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tp("toasts.createFailed"));
      throw err;
    }
  }

  async function handleEdit(id: string, data: EditProjectInput) {
    try {
      await updateProject(id, data);
      toast.success(tp("toasts.updated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tp("toasts.updateFailed"));
      throw err;
    }
  }

  async function handleInvite(email: string) {
    await inviteMember(email);
    toast.success(tp("toasts.invited", { email }));
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await archiveProject(archiveTarget.id);
      toast.success(tp("toasts.archived", { name: archiveTarget.name }));
      setArchiveTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tp("toasts.archiveFailed"));
    } finally {
      setArchiving(false);
    }
  }

  async function handleRestore(project: ProjectWithRole) {
    setRestoring(project.id);
    try {
      await restoreProject(project.id);
      toast.success(tp("toasts.restored", { name: project.name }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tp("toasts.restoreFailed"));
    } finally {
      setRestoring(null);
    }
  }

  async function handleJoin(project: ProjectWithRole) {
    setJoining(project.id);
    try {
      await joinProject(project.id);
      toast.success(tp("toasts.joined", { name: project.name }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tp("toasts.joinFailed"));
    } finally {
      setJoining(null);
    }
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    if (tab === "inactive") {
      fetchInactiveProjects();
    }
    if (tab === "archived") {
      fetchArchivedProjects();
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Logo size="sm" />
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/admin")}
                className="h-9 w-9 p-0 sm:h-auto sm:w-auto sm:px-3 sm:py-1.5"
              >
                <ShieldAlert className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{tn("admin")}</span>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild className="h-9 w-9 p-0">
              <Link href="/dashboard/profile" aria-label={tn("profile")}>
                <User className="h-4 w-4" />
              </Link>
            </Button>
            <SyncStatusBadge />
            <LanguageSwitcher />
            <Button variant="outline" size="sm" onClick={handleLogout} className="h-9 w-9 p-0 sm:h-auto sm:w-auto sm:px-3 sm:py-1.5">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{ta("logout")}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">{tp("title")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{tp("subtitle")}</p>
          </div>
          {!isReadOnly && (
            <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              {tp("newProject")}
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-4 w-full sm:w-auto overflow-x-auto">
            <TabsTrigger value="active" className="gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              {tn("active")}
            </TabsTrigger>
            <TabsTrigger value="inactive" className="gap-1.5">
              <EyeOff className="h-3.5 w-3.5" />
              {tn("inactive")}
            </TabsTrigger>
            <TabsTrigger value="archived" className="gap-1.5">
              <Archive className="h-3.5 w-3.5" />
              {tn("archive")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {(() => {
              const memberProjects = projects.filter((p) => p.role === "owner" || p.role === "member");
              return (
                <>
                  {loading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="rounded-lg border bg-card flex flex-col">
                          <div className="p-4 pb-2 space-y-2">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-16 rounded-full" />
                          </div>
                          <div className="px-4 pb-2">
                            <Skeleton className="h-3 w-full" />
                          </div>
                          <div className="px-4 py-2 border-t flex gap-4">
                            <Skeleton className="h-3 w-8" />
                            <Skeleton className="h-3 w-8" />
                            <Skeleton className="h-3 w-8" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!loading && error && (
                    <div className="text-center py-16 text-muted-foreground">
                      <p className="text-sm">{error}</p>
                      <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>
                        {tc("retry")}
                      </Button>
                    </div>
                  )}

                  {!loading && !error && memberProjects.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
                      <h3 className="text-lg font-medium mb-1">{tp("empty.title")}</h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        {tp("empty.description")}
                      </p>
                      {!isReadOnly && (
                        <Button onClick={() => setCreateOpen(true)}>
                          <Plus className="mr-2 h-4 w-4" />
                          {tp("firstProject")}
                        </Button>
                      )}
                    </div>
                  )}

                  {!loading && !error && memberProjects.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                      {memberProjects.map((project) => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          onEdit={(p) => setEditProject(p)}
                          onInvite={(p) => setInviteProject(p)}
                          onArchive={(p) => setArchiveTarget(p)}
                        />
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </TabsContent>

          <TabsContent value="inactive">
            {(() => {
              const nonMemberProjects = projects.filter((p) => p.role === "viewer");
              return (
                <>
                  {!loading && nonMemberProjects.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <EyeOff className="h-12 w-12 text-muted-foreground/40 mb-4" />
                      <h3 className="text-lg font-medium mb-1">{tp("emptyInactive.title")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {tp("emptyInactive.description")}
                      </p>
                    </div>
                  )}

                  {!loading && nonMemberProjects.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                      {nonMemberProjects.map((project) => {
                        const formattedDate = new Date(project.updated_at).toLocaleDateString("de-DE", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                        });
                        return (
                          <Card key={project.id} className="flex flex-col">
                            <CardHeader className="pb-2">
                              <h3 className="font-semibold text-base leading-tight line-clamp-2">
                                {project.name}
                              </h3>
                              <Badge variant="secondary" className="w-fit text-xs mt-1">
                                {tp("viewer")}
                              </Badge>
                            </CardHeader>
                            <CardContent className="flex-1 pb-2">
                              {project.description ? (
                                <p className="text-sm text-muted-foreground line-clamp-3">{project.description}</p>
                              ) : (
                                <p className="text-sm text-muted-foreground italic">{tp("noDescription")}</p>
                              )}
                            </CardContent>
                            <CardFooter className="flex flex-col gap-2 pt-2 border-t">
                              <div className="flex items-center gap-4 text-xs text-muted-foreground w-full">
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3.5 w-3.5" />
                                  {project.pdf_count ?? 0}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {project.marker_count ?? 0}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3.5 w-3.5" />
                                  {project.member_count ?? 0}
                                </span>
                                <span className="flex items-center gap-1 ml-auto">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {formattedDate}
                                </span>
                              </div>
                              {!isReadOnly && (
                                <Button
                                  className="w-full"
                                  size="sm"
                                  disabled={joining === project.id}
                                  onClick={() => handleJoin(project)}
                                >
                                  {joining === project.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <LogIn className="mr-2 h-4 w-4" />
                                  )}
                                  {tp("join")}
                                </Button>
                              )}
                            </CardFooter>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </TabsContent>

          <TabsContent value="archived">
            {archivedLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="rounded-lg border bg-card flex flex-col">
                    <div className="p-4 pb-2 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-16 rounded-full" />
                    </div>
                    <div className="px-4 py-2 border-t flex gap-4">
                      <Skeleton className="h-3 w-8" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!archivedLoading && archivedProjects.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Archive className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-medium mb-1">{tp("emptyArchive.title")}</h3>
                <p className="text-sm text-muted-foreground">
                  {tp("emptyArchive.description")}
                </p>
              </div>
            )}

            {!archivedLoading && archivedProjects.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {archivedProjects.map((project) => {
                  const formattedDate = new Date(project.updated_at).toLocaleDateString("de-DE", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                  });
                  const isProjectOwner = project.role === "owner";
                  return (
                    <div key={project.id} className="rounded-lg border bg-card p-6 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium truncate">{project.name}</h3>
                          {project.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {project.description}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className="ml-2 shrink-0">
                          {tp("archived")}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" />
                          {project.pdf_count ?? 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {project.marker_count ?? 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {project.member_count ?? 0}
                        </span>
                        <span className="flex items-center gap-1 ml-auto">
                          <Calendar className="h-3.5 w-3.5" />
                          {formattedDate}
                        </span>
                      </div>
                      {!isReadOnly && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          disabled={restoring === project.id}
                          onClick={() => handleRestore(project)}
                        >
                          {restoring === project.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="mr-2 h-4 w-4" />
                          )}
                          {tp("restore")}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Archive confirmation */}
      <AlertDialog open={archiveTarget !== null} onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tp("archiveConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tp("archiveConfirm.description", { name: archiveTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={archiving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {archiving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tp("archiveConfirm.submit")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
      />
      <EditProjectDialog
        project={editProject}
        open={editProject !== null}
        onOpenChange={(open) => { if (!open) setEditProject(null); }}
        onSubmit={handleEdit}
      />
      <InviteMemberDialog
        project={inviteProject}
        open={inviteProject !== null}
        onOpenChange={(open) => { if (!open) setInviteProject(null); }}
        onSubmit={handleInvite}
      />
    </div>
  );
}
