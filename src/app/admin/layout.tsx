"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const tabs = [
  { label: "Nutzerverwaltung", href: "/admin/users" },
  { label: "Freigaben", href: "/admin" },
  { label: "Status", href: "/admin/statuses" },
] as const;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard")}
              aria-label="Zurück zum Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Logo size="sm" />
              <span className="text-sm text-muted-foreground font-normal">Admin</span>
            </div>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-4" aria-label="Admin-Navigation">
          <div className="flex gap-1 -mb-px">
            {tabs.map((tab) => {
              const isActive =
                tab.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(tab.href);
              return (
                <button
                  key={tab.href}
                  onClick={() => router.push(tab.href)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
