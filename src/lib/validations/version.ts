import { z } from "zod";

export const createVersionSchema = z.object({
  storage_path: z
    .string()
    .min(1, "Storage-Pfad darf nicht leer sein"),
  file_size: z
    .number()
    .int("Dateigröße muss eine ganze Zahl sein")
    .positive("Dateigröße muss positiv sein"),
  page_count: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional(),
  label: z
    .string()
    .min(1, "Label darf nicht leer sein")
    .max(100, "Label darf maximal 100 Zeichen lang sein")
    .trim()
    .refine((val) => val.trim().length > 0, "Label darf nicht nur aus Leerzeichen bestehen")
    .optional(),
  thumbnail_path: z
    .string()
    .min(1)
    .nullable()
    .optional(),
});

export type CreateVersionInput = z.infer<typeof createVersionSchema>;

export const renameVersionSchema = z.object({
  label: z
    .string()
    .min(1, "Label darf nicht leer sein")
    .max(100, "Label darf maximal 100 Zeichen lang sein")
    .trim()
    .refine((val) => val.trim().length > 0, "Label darf nicht nur aus Leerzeichen bestehen"),
});

export type RenameVersionInput = z.infer<typeof renameVersionSchema>;
