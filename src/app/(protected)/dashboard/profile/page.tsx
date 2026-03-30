"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Profile {
  id: string;
  display_name: string | null;
  email: string;
  created_at: string;
  updated_at: string;
}

export default function ProfilePage() {
  const t = useTranslations("profile");
  const tc = useTranslations("common");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) throw new Error("Failed to load profile");
        const data = await res.json();
        setProfile(data.profile);
        setDisplayName(data.profile.display_name ?? "");
      } catch {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfile(data.profile);
      toast.success(t("saved"));
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 space-y-6">
          <Skeleton className="h-9 w-32" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">{error ?? "Profile not found"}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            {tc("retry")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tc("back")}
          </Link>
        </Button>

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="display-name" className="text-sm font-medium">
                {t("displayName")}
              </label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("displayNamePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                {t("email")}
              </label>
              <Input
                id="email"
                value={profile.email}
                disabled
                readOnly
                aria-describedby="email-readonly-hint"
              />
              <p id="email-readonly-hint" className="text-xs text-muted-foreground">
                {t("emailReadonly")}
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || displayName === (profile.display_name ?? "")}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("save")}
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* DSGVO Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              {t("dataSection")}
            </CardTitle>
            <CardDescription>{t("dataSectionDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{t("dataAdminHint")}</p>
            <p>
              {t("dataPrivacyLink")}{" "}
              <Link href="/datenschutz" className="text-primary hover:underline">
                {t("dataPrivacyLinkText")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
