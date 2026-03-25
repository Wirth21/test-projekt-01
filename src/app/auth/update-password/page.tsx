"use client";

import { useTranslations } from "next-intl";
import { AuthCard } from "@/components/auth/AuthCard";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";

export default function UpdatePasswordPage() {
  const t = useTranslations("auth");

  return (
    <AuthCard
      title={t("setNewPassword")}
      description={t("setNewPasswordDescription")}
    >
      <UpdatePasswordForm />
    </AuthCard>
  );
}
