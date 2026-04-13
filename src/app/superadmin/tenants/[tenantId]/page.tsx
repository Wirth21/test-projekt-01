"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_active: boolean;
  created_at: string;
  user_count: number;
  project_count: number;
}

export default function TenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = use(params);
  const t = useTranslations("superadmin");
  const router = useRouter();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState("free");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    async function fetchTenant() {
      try {
        const res = await fetch("/api/superadmin/tenants");
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        const found = data.tenants.find(
          (t: Tenant) => t.id === tenantId
        );
        if (!found) {
          setError(t("errors.notFound"));
          return;
        }
        setTenant(found);
        setName(found.name);
        setSlug(found.slug);
        setPlan(found.plan);
        setIsActive(found.is_active);
      } catch {
        setError(t("errors.loadFailed"));
      } finally {
        setLoading(false);
      }
    }
    fetchTenant();
  }, [tenantId, t]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, plan, is_active: isActive }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || t("toasts.updateFailed"));
        return;
      }

      toast.success(t("toasts.tenantUpdated"));
      router.push("/superadmin/tenants");
    } catch {
      toast.error(t("toasts.updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenantId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        toast.error(t("toasts.deactivateFailed"));
        return;
      }

      toast.success(t("toasts.tenantDeactivated"));
      router.push("/superadmin/tenants");
    } catch {
      toast.error(t("toasts.deactivateFailed"));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="text-center py-20">
        <p className="text-destructive">
          {error || t("errors.notFound")}
        </p>
        <Button
          variant="link"
          onClick={() => router.push("/superadmin/tenants")}
          className="mt-4"
        >
          {t("nav.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/superadmin/tenants")}
          aria-label={t("nav.back")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {tenant.name}
          </h2>
          <p className="text-muted-foreground font-mono text-sm">
            {tenant.slug} (Kennung)
          </p>
        </div>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{tenant.user_count}</p>
            <p className="text-xs text-muted-foreground">
              {t("tenants.table.users")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{tenant.project_count}</p>
            <p className="text-xs text-muted-foreground">
              {t("tenants.table.projects")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Badge
              variant={tenant.is_active ? "default" : "destructive"}
            >
              {tenant.is_active
                ? t("tenants.statusActive")
                : t("tenants.statusInactive")}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">
              {t("tenants.table.status")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Edit form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("tenantDetail.editTitle")}
          </CardTitle>
          <CardDescription>
            {t("tenantDetail.editDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("createTenant.nameLabel")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">{t("createTenant.slugLabel")}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="slug"
                value={slug}
                onChange={(e) =>
                  setSlug(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                  )
                }
                maxLength={50}
                className="font-mono"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                (Kennung)
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan">{t("createTenant.planLabel")}</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger id="plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">
                  {t("tenants.plans.free")}
                </SelectItem>
                <SelectItem value="team">
                  {t("tenants.plans.team")}
                </SelectItem>
                <SelectItem value="business">
                  {t("tenants.plans.business")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="is_active">
              {t("tenantDetail.activeLabel")}
            </Label>
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={!tenant.is_active}>
              {t("tenantDetail.deactivate")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("tenantDetail.deactivateConfirm")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("tenantDetail.deactivateDescription", {
                  name: tenant.name,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("nav.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeactivate}>
                {t("tenantDetail.deactivate")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          {t("nav.save")}
        </Button>
      </div>
    </div>
  );
}
