"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, LogOut, FolderOpen, Loader2, ShieldAlert, Archive, RotateCcw } from "lucide-react";
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
import { ProjectCard } from "@/components/projects/ProjectCard";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { EditProjectDialog } from "@/components/projects/EditProjectDialog";
import { InviteMemberDialog } from "@/components/projects/InviteMemberDialog";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import type { ProjectWithRole } from "@/lib/types/project";
import type { CreateProjectInput, EditProjectInput } from "@/lib/validations/project";

export default function DashboardPage() {
  const router = useRouter();
  const tc = useTranslations("common");
  const tp = useTranslations("projects");
  const tn = useTranslations("nav");
  const ta = useTranslations("auth");
  const {
    projects,
    loading,
    error,
    archivedProjects,
    archivedLoading,
    createProject,
    updateProject,
    archiveProject,
    restoreProject,
    fetchArchivedProjects,
  } = useProjects();
  const [activeTab, setActiveTab] = useState("active");
  const [restoring, setRestoring] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();
      if (profile?.is_admin) setIsAdmin(true);
    }
    checkAdmin();
  }, []);

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

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    if (tab === "archived") {
      fetchArchivedProjects();
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-primary">{tc("appName")}</h1>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/admin")}
              >
                <ShieldAlert className="mr-2 h-4 w-4" />
                {tn("admin")}
              </Button>
            )}
            <LanguageSwitcher />
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              {ta("logout")}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">{tp("title")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{tp("subtitle")}</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {tp("newProject")}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-4">
            <TabsTrigger value="active" className="gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              {tn("active")}
            </TabsTrigger>
            <TabsTrigger value="archived" className="gap-1.5">
              <Archive className="h-3.5 w-3.5" />
              {tn("archive")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-lg border bg-card p-6 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-4 w-1/2" />
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

            {!loading && !error && projects.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-medium mb-1">{tp("empty.title")}</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  {tp("empty.description")}
                </p>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {tp("firstProject")}
                </Button>
              </div>
            )}

            {!loading && !error && projects.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project) => (
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
          </TabsContent>

          <TabsContent value="archived">
            {archivedLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="rounded-lg border bg-card p-6 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/3" />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {archivedProjects.map((project) => (
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
                  </div>
                ))}
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
