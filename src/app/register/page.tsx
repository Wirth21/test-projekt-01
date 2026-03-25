"use client";

import { useTranslations } from "next-intl";
import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  const t = useTranslations("auth");

  return (
    <AuthCard
      title={t("createAccount")}
      description={t("createAccountDescription")}
    >
      <RegisterForm />
    </AuthCard>
  );
}
