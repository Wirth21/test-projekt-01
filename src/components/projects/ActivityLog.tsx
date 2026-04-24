"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Loader2, AlertCircle, Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActivity, type ActivityFilters } from "@/hooks/use-activity";
import { ACTIVITY_FILTER_MAP } from "@/lib/types/activity";
import type { ActivityFilterGroup } from "@/lib/types/activity";
import type { ProjectMember } from "@/lib/types/project";
import { ActivityLogEntryComponent } from "./ActivityLogEntry";
import { useTranslations } from "next-intl";

interface ActivityLogProps {
  projectId: string;
  members: ProjectMember[];
}

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

  const [filterGroup, setFilterGroup] = useState<ActivityFilterGroup>("all");
  const [filterUserId, setFilterUserId] = useState<string>("all");
  const [searchText, setSearchText] = useState("");

  // Initial load
  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  function handleFilterGroupChange(value: string) {
    const group = value as ActivityFilterGroup;
    setFilterGroup(group);
    const actionTypes = ACTIVITY_FILTER_MAP[group];
    const filters: ActivityFilters = {
      actionTypes: actionTypes ?? null,
      userId: filterUserId === "all" ? null : filterUserId,
    };
    fetchActivity(filters);
  }

  function handleFilterUserChange(value: string) {
    setFilterUserId(value);
    const actionTypes = ACTIVITY_FILTER_MAP[filterGroup];
    const filters: ActivityFilters = {
      actionTypes: actionTypes ?? null,
      userId: value === "all" ? null : value,
    };
    fetchActivity(filters);
  }

  // Client-side full-text filter. We match against user_name + action_type +
  // every string value in metadata (display_name, drawing_name, old_status,
  // new_status, marker_name, ...). Case-insensitive. Runs on the already-
  // loaded page; users click "Load more" to pull additional entries into the
  // filter scope.
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

        <Select value={filterGroup} onValueChange={handleFilterGroupChange}>
          <SelectTrigger className="w-full min-[480px]:w-[180px] h-8 text-xs">
            <SelectValue placeholder={t("filterGroups.all")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterGroups.all")}</SelectItem>
            <SelectItem value="drawings">{t("filterGroups.drawings")}</SelectItem>
            <SelectItem value="versions">{t("filterGroups.versions")}</SelectItem>
            <SelectItem value="status">{t("filterGroups.status")}</SelectItem>
            <SelectItem value="members">{t("filterGroups.members")}</SelectItem>
            <SelectItem value="markers">{t("filterGroups.markers")}</SelectItem>
            <SelectItem value="project">{t("filterGroups.project")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterUserId} onValueChange={handleFilterUserChange}>
          <SelectTrigger className="w-full min-[480px]:w-[200px] h-8 text-xs">
            <SelectValue placeholder={t("allUsers")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allUsers")}</SelectItem>
            {members.map((member) => {
              const displayName =
                member.profile?.display_name ||
                member.profile?.email ||
                t("unknownUser");
              return (
                <SelectItem key={member.id} value={member.user_id}>
                  {displayName}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

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
            <div className="divide-y" role="list" aria-label={t("title")}>
              {filteredEntries.map((entry) => (
                <ActivityLogEntryComponent key={entry.id} entry={entry} />
              ))}
            </div>

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
