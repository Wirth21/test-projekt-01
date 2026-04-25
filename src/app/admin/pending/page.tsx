"use client";

import { useState } from "react";
import { Check, X, Clock, Loader2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { usePendingUsers } from "@/hooks/use-admin";
import { useTranslations } from "next-intl";

export default function AdminPendingPage() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const { users, loading, error, approveUser, rejectUser, refetch } =
    usePendingUsers();

  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const targetUser = users.find((u) => u.id === actionUserId);

  async function handleConfirm() {
    if (!actionUserId || !actionType) return;
    setSubmitting(true);
    try {
      if (actionType === "approve") {
        await approveUser(actionUserId);
        toast.success(t("toasts.approved"));
      } else {
        await rejectUser(actionUserId);
        toast.success(t("toasts.rejected"));
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("toasts.actionFailed")
      );
    } finally {
      setSubmitting(false);
      setActionUserId(null);
      setActionType(null);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{t("pending.title")}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("pending.subtitle")}
        </p>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4 rounded-lg border bg-card"
            >
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>
          ))}
        </div>
      )}

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

      {!loading && !error && users.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Inbox className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium mb-1">
            {t("pending.empty")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("pending.emptyDescription")}
          </p>
        </div>
      )}

      {!loading && !error && users.length > 0 && (
        <div className="space-y-3">
          <Badge variant="secondary" className="mb-2">
            {users.length === 1
              ? t("pending.requestCount", { count: users.length })
              : t("pending.requestCountPlural", { count: users.length })}
          </Badge>
          {users.map((user) => (
            <div
              key={user.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border bg-card"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">
                    {user.display_name || t("users.noName")}
                  </p>
                  <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {user.email}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("pending.registeredAt", { date: formatDate(user.created_at) })}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() => {
                    setActionUserId(user.id);
                    setActionType("approve");
                  }}
                >
                  <Check className="mr-1.5 h-4 w-4" />
                  {t("pending.approve")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setActionUserId(user.id);
                    setActionType("reject");
                  }}
                >
                  <X className="mr-1.5 h-4 w-4" />
                  {t("pending.reject")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={actionUserId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActionUserId(null);
            setActionType(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "approve"
                ? t("pending.approveConfirm")
                : t("pending.rejectConfirm")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "approve"
                ? t.rich("pending.approveDescription", {
                    name: targetUser?.display_name || targetUser?.email || "",
                  })
                : t.rich("pending.rejectDescription", {
                    name: targetUser?.display_name || targetUser?.email || "",
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>
              {tc("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={submitting}
              className={
                actionType === "reject"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {actionType === "approve" ? t("pending.approve") : t("pending.reject")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
