import { z } from "zod";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const createMarkerSchema = z.object({
  target_drawing_id: z
    .string()
    .regex(uuidRegex, "Ungueltige Ziel-Zeichnungs-ID"),
  name: z
    .string()
    .min(1, "Marker-Name darf nicht leer sein")
    .max(50, "Marker-Name darf maximal 50 Zeichen lang sein")
    .trim(),
  page_number: z
    .number()
    .int("Seitennummer muss eine ganze Zahl sein")
    .min(1, "Seitennummer muss mindestens 1 sein"),
  x_percent: z
    .number()
    .min(0, "X-Position muss zwischen 0 und 100 liegen")
    .max(100, "X-Position muss zwischen 0 und 100 liegen"),
  y_percent: z
    .number()
    .min(0, "Y-Position muss zwischen 0 und 100 liegen")
    .max(100, "Y-Position muss zwischen 0 und 100 liegen"),
});

export type CreateMarkerInput = z.infer<typeof createMarkerSchema>;

export const updateMarkerSchema = z.object({
  name: z
    .string()
    .min(1, "Marker-Name darf nicht leer sein")
    .max(50, "Marker-Name darf maximal 50 Zeichen lang sein")
    .trim()
    .optional(),
  target_drawing_id: z
    .string()
    .regex(uuidRegex, "Ungueltige Ziel-Zeichnungs-ID")
    .optional(),
  page_number: z
    .number()
    .int("Seitennummer muss eine ganze Zahl sein")
    .min(1, "Seitennummer muss mindestens 1 sein")
    .optional(),
  x_percent: z
    .number()
    .min(0, "X-Position muss zwischen 0 und 100 liegen")
    .max(100, "X-Position muss zwischen 0 und 100 liegen")
    .optional(),
  y_percent: z
    .number()
    .min(0, "Y-Position muss zwischen 0 und 100 liegen")
    .max(100, "Y-Position muss zwischen 0 und 100 liegen")
    .optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: "Mindestens ein Feld muss angegeben werden" }
);

export type UpdateMarkerInput = z.infer<typeof updateMarkerSchema>;
