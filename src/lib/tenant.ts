import { headers } from "next/headers";

/** Tenant info passed through middleware via headers */
export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
}

const ROOT_DOMAINS = ["link2plan.de", "localhost", "localhost:3000"];

/**
 * Extracts the subdomain from a hostname.
 * Returns null if on root domain (no subdomain).
 */
export function extractSubdomain(hostname: string): string | null {
  // Remove port for comparison
  const hostWithoutPort = hostname.split(":")[0];

  // localhost: subdomain.localhost or subdomain.localhost:3000
  if (hostWithoutPort === "localhost") return null;
  if (hostWithoutPort.endsWith(".localhost")) {
    return hostWithoutPort.replace(".localhost", "");
  }

  // Production: subdomain.link2plan.de
  for (const root of ROOT_DOMAINS) {
    const rootWithoutPort = root.split(":")[0];
    if (hostWithoutPort === rootWithoutPort) return null;
    if (hostWithoutPort.endsWith(`.${rootWithoutPort}`)) {
      return hostWithoutPort.replace(`.${rootWithoutPort}`, "");
    }
  }

  return null;
}

/**
 * Get tenant context from request headers (set by middleware).
 * Use in Server Components and Route Handlers.
 */
export async function getTenantContext(): Promise<TenantContext> {
  const headerStore = await headers();
  const tenantId = headerStore.get("x-tenant-id");
  const tenantSlug = headerStore.get("x-tenant-slug");

  if (!tenantId || !tenantSlug) {
    throw new Error("Tenant context not available — middleware may not have resolved tenant");
  }

  return { tenantId, tenantSlug };
}

/** Reserved slugs that cannot be used as tenant subdomains */
export const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "mail", "support", "help",
  "status", "blog", "login", "auth", "dashboard", "register",
  "billing", "docs", "static", "assets", "cdn", "img",
  "ftp", "smtp", "pop", "imap", "ns1", "ns2",
]);
