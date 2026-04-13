import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SyncProvider } from "@/components/sync/SyncProvider";
import { OfflineDebug } from "@/components/sync/OfflineDebug";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <SyncProvider>
      {children}
      <OfflineDebug />
    </SyncProvider>
  );
}
