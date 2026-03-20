"use client";

import { useEffect, useState } from "react";
import { Search, Users, ShieldAlert, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminUsers } from "@/hooks/use-admin";
import { UserDetailSheet } from "@/components/admin/UserDetailSheet";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { createClient } from "@/lib/supabase";
import { toast } from "sonner";
import type { AdminProfile } from "@/lib/types/admin";

const statusLabels: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  active: { label: "Aktiv", variant: "default" },
  pending: { label: "Ausstehend", variant: "secondary" },
  disabled: { label: "Deaktiviert", variant: "destructive" },
};

const STATUS_ALL = "__all__";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [selectedUser, setSelectedUser] = useState<AdminProfile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);

  const { users, loading, error, updateUserStatus, createUser, refetch } = useAdminUsers(
    debouncedSearch,
    statusFilter === STATUS_ALL ? "" : statusFilter
  );

  // Get current user id for self-protection
  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    }
    loadUser();
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Keep selectedUser in sync after refetch
  useEffect(() => {
    if (selectedUser) {
      const updated = users.find((u) => u.id === selectedUser.id);
      if (updated) {
        setSelectedUser(updated);
      } else {
        // User was deleted or filtered out
        setSelectedUser(null);
      }
    }
  }, [users, selectedUser]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Nutzerverwaltung</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Alle registrierten Nutzer verwalten
          </p>
        </div>
        <Button onClick={() => setCreateUserOpen(true)}>
          <UserPlus className="mr-1.5 h-4 w-4" />
          Nutzer hinzufuegen
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Name oder E-Mail suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Alle Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STATUS_ALL}>Alle Status</SelectItem>
            <SelectItem value="active">Aktiv</SelectItem>
            <SelectItem value="pending">Ausstehend</SelectItem>
            <SelectItem value="disabled">Deaktiviert</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">E-Mail</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Registriert</TableHead>
                <TableHead className="hidden md:table-cell text-right">Projekte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right">
                    <Skeleton className="h-4 w-6 ml-auto" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={refetch}
          >
            Erneut versuchen
          </Button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && users.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium mb-1">Keine Nutzer gefunden</h3>
          <p className="text-sm text-muted-foreground">
            {debouncedSearch || statusFilter !== STATUS_ALL
              ? "Passe die Suchkriterien an."
              : "Es sind noch keine Nutzer registriert."}
          </p>
        </div>
      )}

      {/* Users table */}
      {!loading && !error && users.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">E-Mail</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">
                  Registriert
                </TableHead>
                <TableHead className="hidden md:table-cell text-right">
                  Projekte
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const info = statusLabels[user.status] ?? {
                  label: user.status,
                  variant: "outline" as const,
                };
                return (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedUser(user)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate max-w-[200px]">
                          {user.display_name || "Kein Name"}
                        </span>
                        {user.is_admin && (
                          <ShieldAlert className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </div>
                      {/* Show email on mobile below name */}
                      <p className="text-xs text-muted-foreground sm:hidden truncate">
                        {user.email}
                      </p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-sm text-muted-foreground truncate max-w-[240px] inline-block">
                        {user.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={info.variant}>{info.label}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right text-sm">
                      {user.project_count ?? 0}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* User detail sheet */}
      <UserDetailSheet
        user={selectedUser}
        open={selectedUser !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedUser(null);
        }}
        onStatusChange={updateUserStatus}
        isSelf={selectedUser?.id === currentUserId}
      />

      {/* Create user dialog */}
      <CreateUserDialog
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        onSubmit={async (email, password, displayName) => {
          await createUser(email, password, displayName);
          toast.success(`Nutzer ${email} wurde erstellt`);
        }}
      />
    </div>
  );
}
