"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Loader2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_active: boolean;
  created_at: string;
  user_count: number;
  project_count: number;
}

export default function SuperadminTenantsPage() {
  const t = useTranslations("superadmin");
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTenants() {
      try {
        const res = await fetch("/api/superadmin/tenants");
        if (!res.ok) throw new Error("Failed to load tenants");
        const data = await res.json();
        setTenants(data.tenants);
      } catch {
        setError(t("errors.loadFailed"));
      } finally {
        setLoading(false);
      }
    }
    fetchTenants();
  }, [t]);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function getPlanVariant(plan: string) {
    switch (plan) {
      case "business":
        return "default" as const;
      case "team":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t("tenants.title")}
          </h2>
          <p className="text-muted-foreground">{t("tenants.subtitle")}</p>
        </div>
        <Button onClick={() => router.push("/superadmin/tenants/create")}>
          <Plus className="h-4 w-4 mr-1.5" />
          {t("tenants.create")}
        </Button>
      </div>

      {tenants.length === 0 ? (
        <div className="text-center py-20 border rounded-lg">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t("tenants.empty")}</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tenants.table.name")}</TableHead>
                <TableHead>{t("tenants.table.slug")}</TableHead>
                <TableHead>{t("tenants.table.plan")}</TableHead>
                <TableHead>{t("tenants.table.status")}</TableHead>
                <TableHead className="text-right">
                  {t("tenants.table.users")}
                </TableHead>
                <TableHead className="text-right">
                  {t("tenants.table.projects")}
                </TableHead>
                <TableHead>{t("tenants.table.created")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow
                  key={tenant.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/superadmin/tenants/${tenant.id}`)
                  }
                >
                  <TableCell className="font-medium">
                    {tenant.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {tenant.slug}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getPlanVariant(tenant.plan)}>
                      {t(`tenants.plans.${tenant.plan}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={tenant.is_active ? "default" : "destructive"}
                    >
                      {tenant.is_active
                        ? t("tenants.statusActive")
                        : t("tenants.statusInactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {tenant.user_count}
                  </TableCell>
                  <TableCell className="text-right">
                    {tenant.project_count}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(tenant.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
