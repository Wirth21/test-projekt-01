"use client";

import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/Logo";

interface AuthCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function AuthCard({ title, description, children }: AuthCardProps) {
  const t = useTranslations("common");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <Logo size="lg" className="justify-center" />
          <p className="text-sm text-muted-foreground mt-1">
            {t("tagline")}
          </p>
        </div>

        <Card className="shadow-md">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">{title}</CardTitle>
            {description && (
              <CardDescription>{description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
