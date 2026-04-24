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

// Partial-update schema for the version PATCH endpoint.
// All fields are optional; the handler applies only what is present.
export const updateVersionSchema = z
  .object({
    label: z
      .string()
      .min(1, "Label darf nicht leer sein")
      .max(100, "Label darf maximal 100 Zeichen lang sein")
      .trim()
      .refine((val) => val.trim().length > 0, "Label darf nicht nur aus Leerzeichen bestehen")
      .optional(),
    created_at: z
      .string()
      .datetime({ offset: true, message: "Ungültiges Datum (ISO 8601 erwartet)" })
      .optional(),
    sort_order: z
      .number()
      .int("Reihenfolge muss eine ganze Zahl sein")
      .optional(),
    rotation: z
      .number()
      .int()
      .refine((v) => [0, 90, 180, 270].includes(v), "Rotation muss 0, 90, 180 oder 270 sein")
      .optional(),
  })
  .refine(
    (data) =>
      data.label !== undefined ||
      data.created_at !== undefined ||
      data.sort_order !== undefined ||
      data.rotation !== undefined,
    { message: "Kein Feld zum Aktualisieren angegeben" }
  );

export type UpdateVersionInput = z.infer<typeof updateVersionSchema>;
