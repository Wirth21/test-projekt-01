import { headers } from "next/headers";

/** Tenant info passed through middleware via headers */
export interface TenantContext {
  tenantId: string;
}

/**
 * Get tenant context from request headers (set by middleware from user profile).
 * Use in Server Components and Route Handlers.
 */
export async function getTenantContext(): Promise<TenantContext> {
  const headerStore = await headers();
  const tenantId = headerStore.get("x-tenant-id");

  if (!tenantId) {
    throw new Error("Tenant context not available — user may not be authenticated");
  }

  return { tenantId };
}

/** Reserved slugs that cannot be used as tenant names */
export const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "mail", "support", "help",
  "status", "blog", "login", "auth", "dashboard", "register",
  "billing", "docs", "static", "assets", "cdn", "img",
  "ftp", "smtp", "pop", "imap", "ns1", "ns2",
]);
