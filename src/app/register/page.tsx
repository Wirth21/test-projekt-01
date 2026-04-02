"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  const t = useTranslations("auth");

  return (
    <AuthCard
      title={t("createAccount")}
      description="Die Registrierung ist derzeit deaktiviert."
    >
      <div className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          Neue Registrierungen sind momentan nicht möglich. Bitte wenden Sie sich an den Administrator.
        </p>
        <Button variant="outline" asChild className="w-full">
          <Link href="/login">{t("backToLogin")}</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
