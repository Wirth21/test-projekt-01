import { z } from "zod";

export const createTenantSchema = z.object({
  name: z
    .string()
    .min(1, "Tenant name is required")
    .max(100, "Name must not exceed 100 characters")
    .trim(),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(50, "Slug must not exceed 50 characters")
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
      "Slug must be lowercase alphanumeric with optional hyphens"
    ),
  plan: z.enum(["free", "team", "business"]).default("free"),
  admin_email: z.string().email("Invalid email address"),
  admin_password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
  admin_name: z
    .string()
    .min(1, "Admin name is required")
    .max(100)
    .trim(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/)
    .optional(),
  plan: z.enum(["free", "team", "business"]).optional(),
  is_active: z.boolean().optional(),
});

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
