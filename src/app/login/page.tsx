"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  const t = useTranslations("auth");

  return (
    <AuthCard
      title={t("welcomeBack")}
      description={t("loginDescription")}
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
