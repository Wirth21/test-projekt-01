"use client";

import { useEffect, useState, useCallback } from "react";
import { Palette, Plus, Pencil, Trash2, Star, Info, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface DrawingStatus {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
}

export default function AdminStatusesPage() {
  const t = useTranslations("admin.statuses");
  const tc = useTranslations("common");

  const [statuses, setStatuses] = useState<DrawingStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createColor, setCreateColor] = useState("#3b82f6");
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchStatuses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/statuses");
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = await res.json();
      setStatuses(data.statuses);
    } catch {
      setError("Fehler beim Laden der Status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  async function handleCreate() {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim(), color: createColor }),
      });
      if (!res.ok) {
        toast.error(t("createFailed"));
        return;
      }
      toast.success(t("created"));
      setCreateName("");
      setCreateColor("#3b82f6");
      setShowCreate(false);
      fetchStatuses();
    } catch {
      toast.error(t("createFailed"));
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/statuses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), color: editColor }),
      });
      if (!res.ok) {
        toast.error(t("updateFailed"));
        return;
      }
      toast.success(t("updated"));
      setEditingId(null);
      fetchStatuses();
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/statuses/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(t("deleteFailed"));
        return;
      }
      toast.success(t("deleted"));
      setDeletingId(null);
      fetchStatuses();
    } catch {
      toast.error(t("deleteFailed"));
    }
  }

  async function handleToggleDefault(id: string, currentDefault: boolean) {
    try {
      const res = await fetch(`/api/admin/statuses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: !currentDefault }),
      });
      if (!res.ok) {
        toast.error(t("updateFailed"));
        return;
      }
      toast.success(t("updated"));
      fetchStatuses();
    } catch {
      toast.error(t("updateFailed"));
    }
  }

  async function handleMove(index: number, direction: "up" | "down") {
    const newStatuses = [...statuses];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newStatuses.length) return;

    [newStatuses[index], newStatuses[swapIndex]] = [newStatuses[swapIndex], newStatuses[index]];

    // Optimistic update
    setStatuses(newStatuses);

    try {
      const res = await fetch("/api/admin/statuses/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: newStatuses.map((s) => s.id) }),
      });
      if (!res.ok) {
        toast.error(t("updateFailed"));
        fetchStatuses();
      }
    } catch {
      toast.error(t("updateFailed"));
      fetchStatuses();
    }
  }

  function startEdit(status: DrawingStatus) {
    setEditingId(status.id);
    setEditName(status.name);
    setEditColor(status.color);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("subtitle")}
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="w-full sm:w-auto shrink-0"
          disabled={showCreate}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t("add")}
        </Button>
      </div>

      <div className="mb-6 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{t("hint")}</span>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="text-sm font-medium mb-1.5 block">
                  {t("name")}
                </label>
                <Input
                  placeholder={t("namePlaceholder")}
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                  autoFocus
                />
              </div>
              <div className="w-full sm:w-auto">
                <label className="text-sm font-medium mb-1.5 block">
                  {t("color")}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={createColor}
                    onChange={(e) => setCreateColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-input bg-background"
                  />
                  <span className="text-sm text-muted-foreground font-mono">
                    {createColor}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  onClick={handleCreate}
                  disabled={creating || !createName.trim()}
                  className="flex-1 sm:flex-none"
                >
                  {tc("create")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreate(false);
                    setCreateName("");
                    setCreateColor("#3b82f6");
                  }}
                  className="flex-1 sm:flex-none"
                >
                  {tc("cancel")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-16 ml-auto" />
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
            onClick={fetchStatuses}
          >
            {tc("retry")}
          </Button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && statuses.length === 0 && !showCreate && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Palette className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium mb-1">{t("empty")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("emptyDescription")}
          </p>
        </div>
      )}

      {/* Status list */}
      {!loading && !error && statuses.length > 0 && (
        <div className="space-y-2">
          {statuses.map((status, index) => (
            <Card key={status.id}>
              <CardContent className="py-3 px-4">
                {editingId === status.id ? (
                  /* Edit mode */
                  <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1 w-full">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdate(status.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="h-9 w-12 cursor-pointer rounded border border-input bg-background"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleUpdate(status.id)}
                        disabled={saving || !editName.trim()}
                      >
                        {tc("save")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                      >
                        {tc("cancel")}
                      </Button>
                    </div>
                  </div>
                ) : deletingId === status.id ? (
                  /* Delete confirmation */
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {t("deleteConfirm")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("deleteDescription")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(status.id)}
                      >
                        {tc("delete")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeletingId(null)}
                      >
                        {tc("cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Display mode */
                  <div className="flex items-center gap-3">
                    <div
                      className="h-5 w-5 rounded-full shrink-0 border border-border"
                      style={{ backgroundColor: status.color }}
                    />
                    <span className="font-medium text-sm">{status.name}</span>
                    {status.is_default && (
                      <Badge variant="secondary" className="text-xs">
                        {t("default")}
                      </Badge>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleMove(index, "up")}
                        disabled={index === 0}
                        title="Nach oben"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleMove(index, "down")}
                        disabled={index === statuses.length - 1}
                        title="Nach unten"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          handleToggleDefault(status.id, status.is_default)
                        }
                        title={t("setDefault")}
                      >
                        <Star
                          className={`h-4 w-4 ${
                            status.is_default
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground"
                          }`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => startEdit(status)}
                        title={tc("edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeletingId(status.id)}
                        title={tc("delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
