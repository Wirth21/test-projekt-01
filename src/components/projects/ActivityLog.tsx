"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Loader2,
  AlertCircle,
  Filter,
  Search,
  X,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActivity, type ActivityFilters } from "@/hooks/use-activity";
import {
  ACTIVITY_FILTER_MAP,
  type ActivityActionType,
  type ActivityFilterGroup,
} from "@/lib/types/activity";
import type { ProjectMember } from "@/lib/types/project";
import { ActivityLogEntryComponent } from "./ActivityLogEntry";
import { useTranslations } from "next-intl";

interface ActivityLogProps {
  projectId: string;
  members: ProjectMember[];
}

// Groups offered in the multi-select (no "all" — empty selection = all).
const GROUP_OPTIONS: ActivityFilterGroup[] = [
  "drawings",
  "versions",
  "status",
  "members",
  "markers",
  "project",
];

export function ActivityLog({ projectId, members }: ActivityLogProps) {
  const t = useTranslations("activity");
  const {
    entries,
    loading,
    loadingMore,
    error,
    hasMore,
    fetchActivity,
    loadMore,
  } = useActivity({ projectId });

  const [selectedGroups, setSelectedGroups] = useState<Set<ActivityFilterGroup>>(
    new Set()
  );
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState("");

  // Initial load
  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  function applyFilters(
    groups: Set<ActivityFilterGroup>,
    userIds: Set<string>
  ) {
    // Union of all action types from the selected groups. Empty set = no
    // group filter (show all action types).
    let actionTypes: ActivityActionType[] | null = null;
    if (groups.size > 0) {
      const union = new Set<ActivityActionType>();
      for (const g of groups) {
        const mapped = ACTIVITY_FILTER_MAP[g];
        if (mapped) mapped.forEach((t) => union.add(t));
      }
      actionTypes = [...union];
    }
    const filters: ActivityFilters = {
      actionTypes,
      userId: userIds.size === 0 ? null : [...userIds],
    };
    fetchActivity(filters);
  }

  function toggleGroup(group: ActivityFilterGroup, checked: boolean) {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (checked) next.add(group);
      else next.delete(group);
      applyFilters(next, selectedUserIds);
      return next;
    });
  }

  function toggleUser(userId: string, checked: boolean) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(userId);
      else next.delete(userId);
      applyFilters(selectedGroups, next);
      return next;
    });
  }

  function clearGroups() {
    setSelectedGroups(new Set());
    applyFilters(new Set(), selectedUserIds);
  }

  function clearUsers() {
    setSelectedUserIds(new Set());
    applyFilters(selectedGroups, new Set());
  }

  // Client-side full-text filter. Matches case-insensitively against
  // action_type + every string value in metadata.
  const filteredEntries = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) => {
      const meta = entry.metadata as Record<string, unknown>;
      const haystack: string[] = [entry.action_type];
      for (const value of Object.values(meta)) {
        if (typeof value === "string") haystack.push(value);
      }
      return haystack.some((s) => s.toLowerCase().includes(needle));
    });
  }, [entries, searchText]);

  const groupLabel =
    selectedGroups.size === 0
      ? t("filterGroups.all")
      : selectedGroups.size === 1
        ? t(`filterGroups.${[...selectedGroups][0]}` as const)
        : t("groupsSelected", { count: selectedGroups.size });

  const userLabel =
    selectedUserIds.size === 0
      ? t("allUsers")
      : selectedUserIds.size === 1
        ? (members.find((m) => m.user_id === [...selectedUserIds][0])?.profile
            ?.display_name ??
          members.find((m) => m.user_id === [...selectedUserIds][0])?.profile
            ?.email ??
          t("unknownUser"))
        : t("usersSelected", { count: selectedUserIds.size });

  return (
    <section aria-label={t("title")}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          {t("title")}
        </h3>
      </div>

      {/* Filters */}
      <div className="flex flex-col min-[480px]:flex-row items-start min-[480px]:items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span>{t("filter")}:</span>
        </div>

        {/* Group multi-select */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full min-[480px]:w-[180px] h-8 text-xs justify-between font-normal"
            >
              <span className="truncate">{groupLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 ml-1 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[220px]" align="start">
            <DropdownMenuLabel className="text-xs">{t("filter")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {GROUP_OPTIONS.map((g) => (
              <DropdownMenuCheckboxItem
                key={g}
                checked={selectedGroups.has(g)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(v) => toggleGroup(g, v)}
                className="text-xs"
              >
                {t(`filterGroups.${g}` as const)}
              </DropdownMenuCheckboxItem>
            ))}
            {selectedGroups.size > 0 && (
              <>
                <DropdownMenuSeparator />
                <button
                  type="button"
                  onClick={clearGroups}
                  className="w-full text-xs px-2 py-1.5 hover:bg-accent rounded-sm text-left"
                >
                  {t("clearFilter")}
                </button>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User multi-select */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full min-[480px]:w-[200px] h-8 text-xs justify-between font-normal"
            >
              <span className="truncate">{userLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 ml-1 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[240px] max-h-[300px] overflow-y-auto" align="start">
            <DropdownMenuLabel className="text-xs">{t("allUsers")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {members.map((member) => {
              const displayName =
                member.profile?.display_name ||
                member.profile?.email ||
                t("unknownUser");
              return (
                <DropdownMenuCheckboxItem
                  key={member.id}
                  checked={selectedUserIds.has(member.user_id)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(v) => toggleUser(member.user_id, v)}
                  className="text-xs"
                >
                  {displayName}
                </DropdownMenuCheckboxItem>
              );
            })}
            {selectedUserIds.size > 0 && (
              <>
                <DropdownMenuSeparator />
                <button
                  type="button"
                  onClick={clearUsers}
                  className="w-full text-xs px-2 py-1.5 hover:bg-accent rounded-sm text-left"
                >
                  {t("clearFilter")}
                </button>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="relative w-full min-[480px]:w-[220px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-8 pl-7 pr-7 text-xs"
            aria-label={t("searchPlaceholder")}
          />
          {searchText && (
            <button
              type="button"
              aria-label={t("clearSearch")}
              onClick={() => setSearchText("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-5 w-5 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="rounded-lg border">
        {loading ? (
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 py-3 px-4">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <AlertCircle className="h-8 w-8 text-destructive/60 mb-3" />
            <p className="text-sm text-muted-foreground mb-3">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchActivity()}
            >
              {t("retry")}
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <ClipboardList className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("empty")}
            </p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Search className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("noMatch")}
            </p>
          </div>
        ) : (
          <>
            {/* ~10 rows visible; scroll for the rest. Each row is ~60px
                (py-3 + avatar + two lines of text). */}
            <ScrollArea className="max-h-[600px]">
              <div className="divide-y" role="list" aria-label={t("title")}>
                {filteredEntries.map((entry) => (
                  <ActivityLogEntryComponent key={entry.id} entry={entry} />
                ))}
              </div>
            </ScrollArea>

            {hasMore && (
              <div className="border-t px-4 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      {t("loadingMore")}
                    </>
                  ) : (
                    t("loadMore")
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
