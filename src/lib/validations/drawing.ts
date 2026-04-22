import { z } from "zod";

export const createDrawingSchema = z.object({
  display_name: z
    .string()
    .min(1, "Anzeigename darf nicht leer sein")
    .max(200, "Anzeigename darf maximal 200 Zeichen lang sein")
    .trim(),
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
  status_id: z
    .string()
    .uuid("Ungültige Status-ID")
    .nullable()
    .optional(),
  thumbnail_path: z
    .string()
    .min(1)
    .nullable()
    .optional(),
});

export type CreateDrawingInput = z.infer<typeof createDrawingSchema>;

export const renameDrawingSchema = z.object({
  display_name: z
    .string()
    .min(1, "Anzeigename darf nicht leer sein")
    .max(200, "Anzeigename darf maximal 200 Zeichen lang sein")
    .trim(),
});

export type RenameDrawingInput = z.infer<typeof renameDrawingSchema>;

// Flexible update schema: supports rename, group assignment, or both
export const updateDrawingSchema = z.object({
  display_name: z
    .string()
    .min(1, "Anzeigename darf nicht leer sein")
    .max(200, "Anzeigename darf maximal 200 Zeichen lang sein")
    .trim()
    .optional(),
  group_id: z
    .string()
    .uuid("Ungültige Gruppen-ID")
    .nullable()
    .optional(),
}).refine(
  (data) => data.display_name !== undefined || data.group_id !== undefined,
  { message: "Mindestens ein Feld muss angegeben werden" }
);

export type UpdateDrawingInput = z.infer<typeof updateDrawingSchema>;
