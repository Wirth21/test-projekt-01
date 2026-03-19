import { z } from "zod";

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, "Projektname darf nicht leer sein")
    .max(100, "Projektname darf maximal 100 Zeichen lang sein")
    .trim(),
  description: z
    .string()
    .max(500, "Beschreibung darf maximal 500 Zeichen lang sein")
    .trim()
    .optional()
    .or(z.literal("")),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const editProjectSchema = createProjectSchema;
export type EditProjectInput = z.infer<typeof editProjectSchema>;

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .min(1, "E-Mail darf nicht leer sein")
    .email("Bitte eine gueltige E-Mail-Adresse eingeben")
    .trim(),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
