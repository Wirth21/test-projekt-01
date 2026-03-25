"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/[ß]/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export default function CreateTenantPage() {
  const t = useTranslations("superadmin");
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [plan, setPlan] = useState("free");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminName, setAdminName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugManuallyEdited) {
      setSlug(slugify(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlugManuallyEdited(true);
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/superadmin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          plan,
          admin_email: adminEmail,
          admin_password: adminPassword,
          admin_name: adminName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || t("toasts.createFailed"));
        return;
      }

      toast.success(t("toasts.tenantCreated"));
      router.push("/superadmin/tenants");
    } catch {
      toast.error(t("toasts.createFailed"));
    } finally {
      setSubmitting(false);
    }
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
            {t("createTenant.title")}
          </h2>
          <p className="text-muted-foreground">
            {t("createTenant.description")}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tenant details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("createTenant.tenantSection")}
            </CardTitle>
            <CardDescription>
              {t("createTenant.tenantSectionDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("createTenant.nameLabel")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t("createTenant.namePlaceholder")}
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">{t("createTenant.slugLabel")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder={t("createTenant.slugPlaceholder")}
                  required
                  maxLength={50}
                  className="font-mono"
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  .link2plan.app
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
          </CardContent>
        </Card>

        {/* Admin user */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("createTenant.adminSection")}
            </CardTitle>
            <CardDescription>
              {t("createTenant.adminSectionDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminName">
                {t("createTenant.adminNameLabel")}
              </Label>
              <Input
                id="adminName"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder={t("createTenant.adminNamePlaceholder")}
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminEmail">
                {t("createTenant.adminEmailLabel")}
              </Label>
              <Input
                id="adminEmail"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder={t("createTenant.adminEmailPlaceholder")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminPassword">
                {t("createTenant.adminPasswordLabel")}
              </Label>
              <Input
                id="adminPassword"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder={t("createTenant.adminPasswordPlaceholder")}
                required
                minLength={8}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/superadmin/tenants")}
          >
            {t("nav.cancel")}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            )}
            {t("createTenant.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
