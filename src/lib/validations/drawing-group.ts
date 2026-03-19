import { z } from "zod";

export const createGroupSchema = z.object({
  name: z
    .string()
    .min(1, "Gruppenname darf nicht leer sein")
    .max(100, "Gruppenname darf maximal 100 Zeichen lang sein")
    .trim()
    .refine((val) => val.trim().length > 0, "Gruppenname darf nicht nur aus Leerzeichen bestehen"),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const renameGroupSchema = z.object({
  name: z
    .string()
    .min(1, "Gruppenname darf nicht leer sein")
    .max(100, "Gruppenname darf maximal 100 Zeichen lang sein")
    .trim()
    .refine((val) => val.trim().length > 0, "Gruppenname darf nicht nur aus Leerzeichen bestehen"),
});

export type RenameGroupInput = z.infer<typeof renameGroupSchema>;
