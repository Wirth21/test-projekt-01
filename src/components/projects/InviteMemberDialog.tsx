"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Search, UserPlus, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectWithRole } from "@/lib/types/project";

interface AvailableUser {
  id: string;
  display_name: string | null;
  email: string;
}

interface InviteMemberDialogProps {
  project: ProjectWithRole | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (email: string) => Promise<void>;
}

export function InviteMemberDialog({ project, open, onOpenChange, onSubmit }: InviteMemberDialogProps) {
  const [users, setUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [serverError, setServerError] = useState<string | null>(null);
  const tc = useTranslations("common");
  const tp = useTranslations("projects");

  const fetchAvailableUsers = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/users/available?projectId=${project.id}`);
      const json = await res.json();
      if (res.ok) {
        setUsers(json.users ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    if (open && project) {
      fetchAvailableUsers();
      setSearchQuery("");
      setServerError(null);
      setInvitedIds(new Set());
    }
  }, [open, project, fetchAvailableUsers]);

  async function handleInvite(user: AvailableUser) {
    setInvitingId(user.id);
    setServerError(null);
    try {
      await onSubmit(user.email);
      setInvitedIds((prev) => new Set(prev).add(user.id));
    } catch (err) {
      setServerError(err instanceof Error ? err.message : tp("toasts.inviteFailed"));
    } finally {
      setInvitingId(null);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setSearchQuery("");
      setServerError(null);
    }
    onOpenChange(open);
  }

  const filteredUsers = users.filter((user) => {
    if (invitedIds.has(user.id)) return true; // keep invited users visible with checkmark
    const query = searchQuery.toLowerCase();
    if (!query) return true;
    return (
      (user.display_name?.toLowerCase().includes(query)) ||
      user.email.toLowerCase().includes(query)
    );
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tp("invite.title")}</DialogTitle>
          <DialogDescription>
            {project && tp("invite.description", { projectName: project.name })}
          </DialogDescription>
        </DialogHeader>

        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tp("invite.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        {loading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {tp("invite.noUsersAvailable")}
          </div>
        ) : (
          <ScrollArea className="max-h-[300px]">
            <div className="divide-y">
              {filteredUsers.map((user) => {
                const isInvited = invitedIds.has(user.id);
                const isInviting = invitingId === user.id;
                const displayName = user.display_name || user.email;

                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 px-2 py-3"
                  >
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-medium text-muted-foreground">
                      {(user.display_name || user.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      {user.display_name && user.display_name !== user.email && (
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      )}
                    </div>
                    {isInvited ? (
                      <Badge variant="secondary" className="gap-1 shrink-0">
                        <Check className="h-3 w-3" />
                        {tp("alreadyMember")}
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        disabled={isInviting}
                        onClick={() => handleInvite(user)}
                      >
                        {isInviting ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {tp("invite.submit")}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {tc("close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
