import { z } from "zod";

export const updateProfileSchema = z.object({
  display_name: z
    .string()
    .min(1, "Anzeigename darf nicht leer sein")
    .max(100, "Anzeigename darf maximal 100 Zeichen lang sein")
    .trim(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
      .max(128, "Passwort darf maximal 128 Zeichen lang sein"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwörter stimmen nicht überein",
    path: ["confirmPassword"],
  });

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
