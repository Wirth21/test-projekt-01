import { AuthCard } from "@/components/auth/AuthCard";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";

export default function UpdatePasswordPage() {
  return (
    <AuthCard
      title="Neues Passwort setzen"
      description="Gib dein neues Passwort ein."
    >
      <UpdatePasswordForm />
    </AuthCard>
  );
}
