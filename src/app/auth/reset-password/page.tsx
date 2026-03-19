import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Passwort zurücksetzen"
      description="Wir senden dir einen Link per E-Mail"
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
