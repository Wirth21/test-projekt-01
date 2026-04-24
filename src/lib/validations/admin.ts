import { z } from "zod";

// Schema for approving or rejecting a pending user
export const approveUserSchema = z.object({
  userId: z.string().uuid("Ungueltige Nutzer-ID"),
});
export type ApproveUserInput = z.infer<typeof approveUserSchema>;

export const rejectUserSchema = z.object({
  userId: z.string().uuid("Ungueltige Nutzer-ID"),
});
export type RejectUserInput = z.infer<typeof rejectUserSchema>;

// Schema for changing user status (activate, disable, mark as deleted)
export const updateUserStatusSchema = z.object({
  userId: z.string().uuid("Ungueltige Nutzer-ID"),
  status: z.enum(["active", "disabled", "deleted"], {
    error: "Ungueltiger Status",
  }),
});
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

// Schema for managing project access
export const addUserToProjectSchema = z.object({
  userId: z.string().uuid("Ungueltige Nutzer-ID"),
  projectId: z.string().uuid("Ungueltige Projekt-ID"),
});
export type AddUserToProjectInput = z.infer<typeof addUserToProjectSchema>;

export const removeUserFromProjectSchema = z.object({
  userId: z.string().uuid("Ungueltige Nutzer-ID"),
  projectId: z.string().uuid("Ungueltige Projekt-ID"),
});
export type RemoveUserFromProjectInput = z.infer<typeof removeUserFromProjectSchema>;

// Schema for creating a user manually (admin)
export const createUserSchema = z.object({
  email: z.string().email("Ungueltige E-Mail-Adresse"),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen lang sein"),
  display_name: z.string().min(1, "Name ist erforderlich").max(100).trim(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

// Schema for creating a drawing status
export const createDrawingStatusSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(50, "Name darf maximal 50 Zeichen lang sein").trim(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ungueltige Farbe (Hex-Format erwartet)"),
  is_default: z.boolean().optional().default(false),
});
export type CreateDrawingStatusInput = z.infer<typeof createDrawingStatusSchema>;

// Schema for the URL param of the admin project hard-delete endpoint
export const adminProjectIdParamSchema = z.object({
  projectId: z.string().uuid("Ungueltige Projekt-ID"),
});
export type AdminProjectIdParamInput = z.infer<typeof adminProjectIdParamSchema>;

// Schema for updating a drawing status
export const updateDrawingStatusSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(50, "Name darf maximal 50 Zeichen lang sein").trim().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ungueltige Farbe (Hex-Format erwartet)").optional(),
  sort_order: z.number().int().min(0).optional(),
  is_default: z.boolean().optional(),
});
export type UpdateDrawingStatusInput = z.infer<typeof updateDrawingStatusSchema>;
