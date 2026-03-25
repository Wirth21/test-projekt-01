"use client";

import { useTranslations } from "next-intl";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  const t = useTranslations("auth");

  return (
    <AuthCard
      title={t("resetPassword")}
      description={t("resetPasswordDescription")}
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
