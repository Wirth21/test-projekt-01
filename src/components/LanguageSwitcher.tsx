"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("language");
  const router = useRouter();

  async function switchLocale() {
    const newLocale = locale === "de" ? "en" : "de";
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: newLocale }),
    });
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={switchLocale}
      title={t("switchLanguage")}
      className="text-xs font-medium px-2"
    >
      {locale === "de" ? "EN" : "DE"}
    </Button>
  );
}
