"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  renameDrawingSchema,
  type RenameDrawingInput,
} from "@/lib/validations/drawing";
import { useTranslations } from "next-intl";

interface RenameDrawingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onSubmit: (displayName: string) => Promise<void>;
}

export function RenameDrawingDialog({
  open,
  onOpenChange,
  currentName,
  onSubmit,
}: RenameDrawingDialogProps) {
  const t = useTranslations("drawings");
  const tc = useTranslations("common");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<RenameDrawingInput>({
    resolver: zodResolver(renameDrawingSchema),
    defaultValues: { display_name: currentName },
    values: { display_name: currentName },
  });

  async function handleSubmit(data: RenameDrawingInput) {
    setSubmitting(true);
    setServerError(null);
    try {
      await onSubmit(data.display_name);
      onOpenChange(false);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : t("toasts.renameFailed")
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      form.reset({ display_name: currentName });
      setServerError(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("rename.title")}</DialogTitle>
          <DialogDescription>
            {t("rename.description")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}
            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("rename.label")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("rename.placeholder")}
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("rename.submit")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
