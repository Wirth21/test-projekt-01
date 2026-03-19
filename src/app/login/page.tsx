import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthCard
      title="Willkommen zurück"
      description="Melde dich mit deiner E-Mail-Adresse an"
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
