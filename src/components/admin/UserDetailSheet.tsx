"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Trash2,
  UserX,
  UserCheck,
  Plus,
  FolderOpen,
  ShieldAlert,
  Pencil,
  Check,
  X,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useUserProjects, useAdminProjects } from "@/hooks/use-admin";
import type { AdminProfile, UserStatus } from "@/lib/types/admin";
import { useTranslations } from "next-intl";

interface UserDetailSheetProps {
  user: AdminProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (userId: string, status: UserStatus) => Promise<unknown>;
  onProfileUpdate?: (userId: string, data: { display_name?: string; email?: string }) => Promise<unknown>;
  isSelf: boolean;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function UserDetailSheet({
  user,
  open,
  onOpenChange,
  onStatusChange,
  onProfileUpdate,
  isSelf,
}: UserDetailSheetProps) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const { projects, loading: projectsLoading, error: projectsError, addToProject, removeFromProject } =
    useUserProjects(user?.id ?? null);
  const { projects: allProjects, loading: allProjectsLoading } = useAdminProjects();

  const [confirmAction, setConfirmAction] = useState<{
    type: "disable" | "delete" | "removeProject" | "deleteAccount";
    projectId?: string;
    projectName?: string;
  } | null>(null);
  const [deleteStep2, setDeleteStep2] = useState(false);
  const [deleteAccountStep2, setDeleteAccountStep2] = useState(false);
  const [deleteAccountOwnerError, setDeleteAccountOwnerError] = useState<string[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [addProjectId, setAddProjectId] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  if (!user) return null;

  const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active: { label: t("status.active"), variant: "default" },
    pending: { label: t("status.pending"), variant: "secondary" },
    disabled: { label: t("status.disabled"), variant: "destructive" },
    deleted: { label: t("status.deleted"), variant: "destructive" },
  };

  const statusInfo = statusLabels[user.status] ?? {
    label: user.status,
    variant: "outline" as const,
  };

  // Projects user is NOT a member of (for add-dropdown)
  const memberProjectIds = new Set(projects.map((p) => p.project_id));
  const availableProjects = allProjects.filter(
    (p) => !memberProjectIds.has(p.id)
  );

  async function handleStatusAction(status: UserStatus) {
    if (!user) return;
    setSubmitting(true);
    try {
      await onStatusChange(user.id, status);
      const actionLabel =
        status === "active"
          ? t("toasts.activated")
          : status === "disabled"
          ? t("toasts.deactivated")
          : t("toasts.deleted");
      toast.success(actionLabel);
      setConfirmAction(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toasts.actionFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddToProject() {
    if (!addProjectId) return;
    setSubmitting(true);
    try {
      await addToProject(addProjectId);
      const projName =
        allProjects.find((p) => p.id === addProjectId)?.name ?? "Projekt";
      toast.success(t("toasts.addedToProject", { project: projName }));
      setAddProjectId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toasts.addToProjectFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveFromProject() {
    if (!confirmAction?.projectId) return;
    setSubmitting(true);
    try {
      await removeFromProject(confirmAction.projectId);
      toast.success(
        t("toasts.removedFromProject", { project: confirmAction.projectName ?? "" })
      );
      setConfirmAction(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toasts.removeFromProjectFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  function startEditing() {
    if (!user) return;
    setEditName(user.display_name || "");
    setEditEmail(user.email);
    setEditing(true);
  }

  async function handleSaveProfile() {
    if (!onProfileUpdate || !user) return;
    setSubmitting(true);
    try {
      const changes: { display_name?: string; email?: string } = {};
      if (editName.trim() !== (user.display_name || "")) changes.display_name = editName.trim();
      if (editEmail.trim().toLowerCase() !== user.email.toLowerCase()) changes.email = editEmail.trim().toLowerCase();
      if (Object.keys(changes).length === 0) {
        setEditing(false);
        return;
      }
      await onProfileUpdate(user.id, changes);
      toast.success(t("toasts.profileUpdated"));
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toasts.actionFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExportData() {
    if (!user) return;
    setExporting(true);
    toast.info(t("detail.exportStarted"));
    try {
      const res = await fetch(`/api/admin/users/${user.id}/export`);
      if (!res.ok) throw new Error(t("detail.exportFailed"));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `user-export-${user.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("detail.exportFailed"));
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    if (!user) return;
    setSubmitting(true);
    setDeleteAccountOwnerError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/delete`, { method: "DELETE" });
      if (res.status === 409) {
        const data = await res.json();
        setDeleteAccountOwnerError(data.projects ?? []);
        return;
      }
      if (!res.ok) throw new Error(t("toasts.actionFailed"));
      toast.success(t("detail.accountDeleted"));
      setConfirmAction(null);
      setDeleteAccountStep2(false);
      await onStatusChange(user.id, "deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toasts.actionFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) setEditing(false); onOpenChange(o); }}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {editing ? (
                <span className="text-base">{t("detail.editProfile")}</span>
              ) : (
                <>
                  {user.display_name || t("users.noName")}
                  {user.is_admin && (
                    <Badge variant="outline" className="text-xs">
                      <ShieldAlert className="mr-1 h-3 w-3" />
                      {t("users.badge")}
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-1" onClick={startEditing}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </SheetTitle>
            <SheetDescription>{editing ? t("detail.editProfileDescription") : user.email}</SheetDescription>
          </SheetHeader>

          {editing ? (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">{t("users.name")}</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={t("createUser.namePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">{t("users.email")}</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder={t("createUser.emailPlaceholder")}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveProfile} disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  {tc("save")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={submitting}>
                  <X className="mr-2 h-4 w-4" />
                  {tc("cancel")}
                </Button>
              </div>
            </div>
          ) : (

          <div className="mt-6 space-y-6">
            {/* User info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">{t("detail.status")}</p>
                <Badge variant={statusInfo.variant} className="mt-1">
                  {statusInfo.label}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">{t("detail.registered")}</p>
                <p className="mt-1 font-medium">{formatDate(user.created_at)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("detail.projects")}</p>
                <p className="mt-1 font-medium">{user.project_count ?? 0}</p>
              </div>
            </div>

            {/* Status actions */}
            {!isSelf && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-3">{t("detail.actions")}</h4>
                  <div className="flex flex-wrap gap-2">
                    {user.status === "active" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setConfirmAction({ type: "disable" })
                        }
                      >
                        <UserX className="mr-1.5 h-4 w-4" />
                        {t("detail.disable")}
                      </Button>
                    )}
                    {user.status === "disabled" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusAction("active")}
                      >
                        <UserCheck className="mr-1.5 h-4 w-4" />
                        {t("detail.reactivate")}
                      </Button>
                    )}
                    {(user.status === "active" || user.status === "disabled") && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirmAction({ type: "delete" })}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        {t("detail.deleteUser")}
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}

            {isSelf && (
              <>
                <Separator />
                <p className="text-xs text-muted-foreground">
                  {t("detail.selfProtection")}
                </p>
              </>
            )}

            {/* Projects section */}
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-3">{t("detail.projectAccess")}</h4>

              {/* Add to project */}
              <div className="flex gap-2 mb-4">
                <Select
                  value={addProjectId}
                  onValueChange={setAddProjectId}
                  disabled={allProjectsLoading || availableProjects.length === 0}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue
                      placeholder={
                        allProjectsLoading
                          ? t("detail.loadingProjects")
                          : availableProjects.length === 0
                          ? t("detail.allProjectsAssigned")
                          : t("detail.selectProject")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleAddToProject}
                  disabled={!addProjectId || submitting}
                  aria-label={t("detail.addToProject")}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Projects loading */}
              {projectsLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  ))}
                </div>
              )}

              {/* Projects error */}
              {!projectsLoading && projectsError && (
                <p className="text-sm text-destructive">{projectsError}</p>
              )}

              {/* Projects empty */}
              {!projectsLoading && !projectsError && projects.length === 0 && (
                <div className="flex flex-col items-center py-8 text-center">
                  <FolderOpen className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t("detail.noProjectAccess")}
                  </p>
                </div>
              )}

              {/* Projects list */}
              {!projectsLoading && !projectsError && projects.length > 0 && (
                <div className="space-y-2">
                  {projects.map((proj) => (
                    <div
                      key={proj.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {proj.project_name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-xs">
                            {proj.role === "owner" ? t("detail.creator") : t("detail.memberRole")}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {t("detail.joinedAt", { date: formatDate(proj.joined_at) })}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setConfirmAction({
                            type: "removeProject",
                            projectId: proj.project_id,
                            projectName: proj.project_name,
                          })
                        }
                        aria-label={t("detail.removeFromProject", { project: proj.project_name })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* GDPR section */}
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-3">{t("detail.gdprSection")}</h4>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {t("detail.exportDataDescription")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportData}
                    disabled={exporting}
                  >
                    {exporting ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-1.5 h-4 w-4" />
                    )}
                    {t("detail.exportData")}
                  </Button>
                </div>
                {!isSelf && (
                  <div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmAction({ type: "deleteAccount" })}
                      disabled={user.status === "deleted"}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      {t("detail.deleteAccountTitle")}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirmation dialog -- disable / removeProject */}
      <AlertDialog
        open={confirmAction !== null && confirmAction.type !== "delete" && confirmAction.type !== "deleteAccount"}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "disable" && t("detail.disableConfirm")}
              {confirmAction?.type === "removeProject" && t("detail.removeProjectConfirm")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "disable" &&
                t("detail.disableDescription", { name: user.display_name || user.email })}
              {confirmAction?.type === "removeProject" && (
                <>
                  {t("detail.removeProjectDescription", {
                    name: user.display_name || user.email,
                    project: confirmAction.projectName ?? "",
                  })}
                  {projects.find(
                    (p) => p.project_id === confirmAction.projectId
                  )?.role === "owner" && (
                    <span className="block mt-2 text-amber-600 font-medium">
                      {t("detail.ownerWarning")}
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmAction?.type === "disable") {
                  handleStatusAction("disabled");
                } else if (confirmAction?.type === "removeProject") {
                  handleRemoveFromProject();
                }
              }}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmAction?.type === "disable" && t("detail.disable")}
              {confirmAction?.type === "removeProject" && t("drawings.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete: step 1 -- initial warning */}
      <AlertDialog
        open={confirmAction?.type === "delete" && !deleteStep2}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("detail.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("detail.deleteDescription", { name: user.display_name || user.email })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmAction(null)}>
              {tc("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => setDeleteStep2(true)}
            >
              {t("detail.continue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete: step 2 -- final confirmation */}
      <AlertDialog
        open={confirmAction?.type === "delete" && deleteStep2}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteStep2(false);
            setConfirmAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("detail.deleteFinalConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("detail.deleteFinalDescription", { name: user.display_name || user.email })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={submitting}
              onClick={() => {
                setDeleteStep2(false);
                setConfirmAction(null);
              }}
            >
              {tc("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setDeleteStep2(false);
                handleStatusAction("deleted");
              }}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("detail.deleteFinal")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* GDPR Delete Account: step 1 -- initial warning */}
      <AlertDialog
        open={confirmAction?.type === "deleteAccount" && !deleteAccountStep2}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null);
            setDeleteAccountOwnerError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("detail.deleteAccountTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("detail.deleteAccountDescription", { name: user.display_name || user.email })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmAction(null)}>
              {tc("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => setDeleteAccountStep2(true)}
            >
              {t("detail.continue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* GDPR Delete Account: step 2 -- final confirmation */}
      <AlertDialog
        open={confirmAction?.type === "deleteAccount" && deleteAccountStep2}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteAccountStep2(false);
            setDeleteAccountOwnerError(null);
            setConfirmAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("detail.deleteFinalConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("detail.deleteFinalDescription", { name: user.display_name || user.email })}
              {deleteAccountOwnerError && deleteAccountOwnerError.length > 0 && (
                <span className="block mt-3 text-amber-600 font-medium">
                  {t("detail.deleteAccountOwnerError")}
                  <ul className="list-disc list-inside mt-1">
                    {deleteAccountOwnerError.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={submitting}
              onClick={() => {
                setDeleteAccountStep2(false);
                setDeleteAccountOwnerError(null);
                setConfirmAction(null);
              }}
            >
              {tc("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting || (deleteAccountOwnerError !== null && deleteAccountOwnerError.length > 0)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                handleDeleteAccount();
              }}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("detail.deleteFinal")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
