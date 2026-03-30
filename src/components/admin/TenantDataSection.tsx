"use client";

import { useState } from "react";
import { Download, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useTranslations } from "next-intl";

export function TenantDataSection() {
  const t = useTranslations("admin.tenant");
  const tc = useTranslations("common");

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteFinal, setShowDeleteFinal] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      toast.info(t("exportStarted"));
      const res = await fetch("/api/admin/tenant/export");
      if (!res.ok) {
        throw new Error("Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tenant-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("exportFailed"));
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/tenant/delete", {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Delete failed");
      }
      toast.success(t("deleteSuccess"));
      window.location.href = "/login";
    } catch {
      toast.error(t("deleteFailed"));
    } finally {
      setDeleting(false);
      setShowDeleteFinal(false);
    }
  }

  return (
    <>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{t("gdprSection")}</CardTitle>
          <CardDescription>{t("gdprDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Export */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium">{t("exportAll")}</p>
              <p className="text-sm text-muted-foreground">
                {t("exportAllDescription")}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
              className="w-full sm:w-auto shrink-0"
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {t("exportAll")}
            </Button>
          </div>

          {/* Delete tenant */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-4 border-t">
            <div className="flex-1">
              <p className="text-sm font-medium">{t("deleteTenant")}</p>
              <p className="text-sm text-muted-foreground">
                {t("deleteTenantDescription")}
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="w-full sm:w-auto shrink-0"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("deleteTenant")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* First confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setShowDeleteConfirm(false);
                setShowDeleteFinal(true);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("deleteConfirmFinal")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Second (final) confirmation dialog */}
      <AlertDialog open={showDeleteFinal} onOpenChange={setShowDeleteFinal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmDescription")}
              {" "}
              <span className="font-semibold text-destructive">
                {t("deleteConfirmFinal")}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("deleteConfirmFinal")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
