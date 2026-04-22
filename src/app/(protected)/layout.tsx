import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { SyncProvider } from "@/components/sync/SyncProvider";
import { UserProvider } from "@/components/providers/UserProvider";
import type { TenantRole } from "@/lib/types/admin";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware already validated auth + loaded the profile, and stuffed the
  // relevant fields into request headers. Reading them here avoids a second
  // round-trip to Supabase Auth + profiles on every protected page load.
  const h = await headers();
  const userId = h.get("x-user-id");
  const tenantId = h.get("x-tenant-id");

  if (!userId || !tenantId) {
    redirect("/login");
  }

  const tenantRole = (h.get("x-tenant-role") ?? "user") as TenantRole;
  const isAdmin = h.get("x-is-admin") === "1";
  const isReadOnly = tenantRole === "viewer" || tenantRole === "guest";

  return (
    <QueryProvider>
      <UserProvider value={{ userId, tenantId, tenantRole, isAdmin, isReadOnly }}>
        <SyncProvider>{children}</SyncProvider>
      </UserProvider>
    </QueryProvider>
  );
}
