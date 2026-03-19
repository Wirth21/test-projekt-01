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
import {
  Loader2,
  Trash2,
  UserX,
  UserCheck,
  Plus,
  FolderOpen,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useUserProjects, useAdminProjects } from "@/hooks/use-admin";
import type { AdminProfile, UserStatus } from "@/lib/types/admin";

interface UserDetailSheetProps {
  user: AdminProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (userId: string, status: UserStatus) => Promise<unknown>;
  isSelf: boolean;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Aktiv", variant: "default" },
  pending: { label: "Ausstehend", variant: "secondary" },
  disabled: { label: "Deaktiviert", variant: "destructive" },
  deleted: { label: "Geloescht", variant: "destructive" },
};

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
  isSelf,
}: UserDetailSheetProps) {
  const { projects, loading: projectsLoading, error: projectsError, addToProject, removeFromProject } =
    useUserProjects(user?.id ?? null);
  const { projects: allProjects, loading: allProjectsLoading } = useAdminProjects();

  const [confirmAction, setConfirmAction] = useState<{
    type: "disable" | "delete" | "removeProject";
    projectId?: string;
    projectName?: string;
  } | null>(null);
  const [deleteStep2, setDeleteStep2] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addProjectId, setAddProjectId] = useState<string>("");

  if (!user) return null;

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
          ? "aktiviert"
          : status === "disabled"
          ? "deaktiviert"
          : "geloescht";
      toast.success(`Nutzer wurde ${actionLabel}`);
      setConfirmAction(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Aktion fehlgeschlagen");
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
      toast.success(`Nutzer wurde zu "${projName}" hinzugefuegt`);
      setAddProjectId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hinzufuegen fehlgeschlagen");
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
        `Nutzer wurde aus "${confirmAction.projectName}" entfernt`
      );
      setConfirmAction(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Entfernen fehlgeschlagen");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {user.display_name || "Kein Name"}
              {user.is_admin && (
                <Badge variant="outline" className="text-xs">
                  <ShieldAlert className="mr-1 h-3 w-3" />
                  Admin
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription>{user.email}</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* User info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge variant={statusInfo.variant} className="mt-1">
                  {statusInfo.label}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Registriert</p>
                <p className="mt-1 font-medium">{formatDate(user.created_at)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Projekte</p>
                <p className="mt-1 font-medium">{user.project_count ?? 0}</p>
              </div>
            </div>

            {/* Status actions */}
            {!isSelf && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-3">Aktionen</h4>
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
                        Deaktivieren
                      </Button>
                    )}
                    {user.status === "disabled" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusAction("active")}
                      >
                        <UserCheck className="mr-1.5 h-4 w-4" />
                        Reaktivieren
                      </Button>
                    )}
                    {(user.status === "active" || user.status === "disabled") && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirmAction({ type: "delete" })}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Loeschen
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
                  Du kannst deinen eigenen Account nicht deaktivieren oder loeschen.
                </p>
              </>
            )}

            {/* Projects section */}
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-3">Projektzugriffe</h4>

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
                          ? "Laden..."
                          : availableProjects.length === 0
                          ? "Alle Projekte zugewiesen"
                          : "Projekt auswaehlen..."
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
                  aria-label="Zum Projekt hinzufuegen"
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
                    Kein Projektzugriff vorhanden
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
                            {proj.role === "owner" ? "Ersteller" : "Mitglied"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            seit {formatDate(proj.joined_at)}
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
                        aria-label={`Aus ${proj.project_name} entfernen`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmation dialog — disable / removeProject */}
      <AlertDialog
        open={confirmAction !== null && confirmAction.type !== "delete"}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "disable" && "Nutzer deaktivieren?"}
              {confirmAction?.type === "removeProject" && "Aus Projekt entfernen?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "disable" && (
                <>
                  <strong>{user.display_name || user.email}</strong> kann sich
                  nach der Deaktivierung nicht mehr einloggen. Die Daten bleiben
                  erhalten.
                </>
              )}
              {confirmAction?.type === "removeProject" && (
                <>
                  <strong>{user.display_name || user.email}</strong> wird aus
                  dem Projekt &quot;{confirmAction.projectName}&quot; entfernt.
                  {projects.find(
                    (p) => p.project_id === confirmAction.projectId
                  )?.role === "owner" && (
                    <span className="block mt-2 text-amber-600 font-medium">
                      Achtung: Dieser Nutzer ist Ersteller des Projekts!
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Abbrechen</AlertDialogCancel>
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
              {confirmAction?.type === "disable" && "Deaktivieren"}
              {confirmAction?.type === "removeProject" && "Entfernen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete: step 1 — initial warning */}
      <AlertDialog
        open={confirmAction?.type === "delete" && !deleteStep2}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nutzer loeschen?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{user.display_name || user.email}</strong> wird dauerhaft
              als geloescht markiert. Der Nutzer kann sich nicht mehr einloggen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmAction(null)}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => setDeleteStep2(true)}
            >
              Weiter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete: step 2 — final confirmation */}
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
            <AlertDialogTitle>Wirklich endgueltig loeschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rueckgaengig gemacht werden.{" "}
              <strong>{user.display_name || user.email}</strong> wird permanent
              gesperrt.
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
              Abbrechen
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
              Endgueltig loeschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
