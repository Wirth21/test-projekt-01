"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut, LayoutDashboard, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { createClient } from "@/lib/supabase";

const navItems = [
  { key: "dashboard", href: "/superadmin", icon: LayoutDashboard },
  { key: "tenants", href: "/superadmin/tenants", icon: Building2 },
] as const;

export default function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("superadmin");

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-primary">
              Link2Plan
              <span className="text-muted-foreground font-normal ml-2 text-sm">
                {t("nav.title")}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground"
              aria-label={t("nav.logout")}
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              {t("nav.logout")}
            </Button>
          </div>
        </div>
        <nav
          className="max-w-7xl mx-auto px-4"
          aria-label={t("nav.title")}
        >
          <div className="flex gap-1 -mb-px">
            {navItems.map((item) => {
              const isActive =
                item.href === "/superadmin"
                  ? pathname === "/superadmin"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t(`nav.${item.key}`)}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
