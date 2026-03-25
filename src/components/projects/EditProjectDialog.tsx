"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { editProjectSchema, type EditProjectInput } from "@/lib/validations/project";
import type { ProjectWithRole } from "@/lib/types/project";

interface EditProjectDialogProps {
  project: ProjectWithRole | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, data: EditProjectInput) => Promise<void>;
}

export function EditProjectDialog({ project, open, onOpenChange, onSubmit }: EditProjectDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const tc = useTranslations("common");
  const tp = useTranslations("projects");

  const form = useForm<EditProjectInput>({
    resolver: zodResolver(editProjectSchema),
    defaultValues: { name: "", description: "" },
  });

  useEffect(() => {
    if (project) {
      form.reset({
        name: project.name,
        description: project.description ?? "",
      });
    }
  }, [project, form]);

  async function handleSubmit(data: EditProjectInput) {
    if (!project) return;
    setSubmitting(true);
    try {
      await onSubmit(project.id, data);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tp("edit.title")}</DialogTitle>
          <DialogDescription>
            {tp("edit.description")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tp("create.nameLabel")}</FormLabel>
                  <FormControl>
                    <Input autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tp("create.descriptionLabel")}</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
