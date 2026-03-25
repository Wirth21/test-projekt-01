"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { createClient } from "@/lib/supabase";

const resetSchema = z.object({
  email: z
    .string()
    .min(1, "E-Mail ist erforderlich")
    .email("Ungültige E-Mail-Adresse"),
});

type ResetFormValues = z.infer<typeof resetSchema>;

export function ResetPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations("auth");

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ResetFormValues) {
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.resetPasswordForEmail(
      values.email,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      }
    );

    if (authError) {
      setError(t("errors.resetEmailFailed"));
      setIsLoading(false);
      return;
    }

    setSuccess(true);
    setIsLoading(false);
  }

  if (success) {
    return (
      <Alert>
        <AlertDescription>
          {t("resetEmailSent")}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("email")}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? t("sendResetLinkLoading") : t("sendResetLink")}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            {t("backToLogin")}
          </Link>
        </p>
      </form>
    </Form>
  );
}
