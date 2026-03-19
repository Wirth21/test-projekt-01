import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <AuthCard
      title="Konto erstellen"
      description="Registriere dich, um Zugang zu erhalten"
    >
      <RegisterForm />
    </AuthCard>
  );
}
