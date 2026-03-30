"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STORAGE_KEY = "cookie-consent-accepted";

export function CookieConsent() {
  const t = useTranslations("cookie");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const accepted = localStorage.getItem(STORAGE_KEY);
      if (!accepted) {
        setVisible(true);
      }
    } catch {
      // localStorage not available (e.g. SSR, private browsing)
      setVisible(true);
    }
  }, []);

  function handleAccept() {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // silently ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:flex sm:justify-center"
      role="banner"
      aria-label={t("message")}
    >
      <Card className="w-full max-w-2xl border shadow-lg">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="text-sm text-muted-foreground">
            {t("message")}{" "}
            <Link
              href="/datenschutz"
              className="underline underline-offset-4 hover:text-foreground"
            >
              {t("learnMore")}
            </Link>
          </p>
          <Button
            onClick={handleAccept}
            size="sm"
            className="shrink-0 self-end sm:self-auto"
          >
            {t("accept")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
