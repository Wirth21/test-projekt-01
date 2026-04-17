"use client";

import {
  Upload,
  Pencil,
  Archive,
  RotateCcw,
  UserPlus,
  UserMinus,
  MapPin,
  Trash2,
  FolderPlus,
  FolderEdit,
  FileUp,
  CircleDot,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ActivityLogEntry as ActivityLogEntryType } from "@/lib/types/activity";
import { useTranslations } from "next-intl";

interface ActivityLogEntryProps {
  entry: ActivityLogEntryType;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getActionIcon(actionType: string) {
  const iconClass = "h-3.5 w-3.5";
  switch (actionType) {
    case "drawing.uploaded":
      return <Upload className={iconClass} />;
    case "drawing.renamed":
      return <Pencil className={iconClass} />;
    case "drawing.archived":
      return <Archive className={iconClass} />;
    case "drawing.restored":
      return <RotateCcw className={iconClass} />;
    case "version.uploaded":
      return <FileUp className={iconClass} />;
    case "version.archived":
      return <Archive className={iconClass} />;
    case "drawing.status_changed":
      return <CircleDot className={iconClass} />;
    case "project.created":
      return <FolderPlus className={iconClass} />;
    case "project.updated":
      return <FolderEdit className={iconClass} />;
    case "project.archived":
      return <Archive className={iconClass} />;
    case "project.restored":
      return <RotateCcw className={iconClass} />;
    case "member.invited":
      return <UserPlus className={iconClass} />;
    case "member.removed":
      return <UserMinus className={iconClass} />;
    case "marker.created":
      return <MapPin className={iconClass} />;
    case "marker.deleted":
      return <Trash2 className={iconClass} />;
    default:
      return <Pencil className={iconClass} />;
  }
}

function getActionColorClass(actionType: string): string {
  if (actionType.includes("archived") || actionType.includes("deleted") || actionType.includes("removed")) {
    return "text-orange-500 bg-orange-50 dark:bg-orange-950/30";
  }
  if (actionType.includes("restored")) {
    return "text-green-500 bg-green-50 dark:bg-green-950/30";
  }
  if (actionType.includes("uploaded") || actionType.includes("created") || actionType.includes("invited")) {
    return "text-blue-500 bg-blue-50 dark:bg-blue-950/30";
  }
  if (actionType.includes("status_changed")) {
    return "text-purple-500 bg-purple-50 dark:bg-purple-950/30";
  }
  return "text-muted-foreground bg-muted";
}

function formatRelativeTime(dateString: string, locale: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  const isDE = locale === "de";

  if (diffSeconds < 60) {
    return isDE ? "gerade eben" : "just now";
  }
  if (diffMinutes < 60) {
    return isDE
      ? `vor ${diffMinutes} ${diffMinutes === 1 ? "Minute" : "Minuten"}`
      : `${diffMinutes} ${diffMinutes === 1 ? "minute" : "minutes"} ago`;
  }
  if (diffHours < 24) {
    return isDE
      ? `vor ${diffHours} ${diffHours === 1 ? "Stunde" : "Stunden"}`
      : `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  }
  if (diffDays < 7) {
    return isDE
      ? `vor ${diffDays} ${diffDays === 1 ? "Tag" : "Tagen"}`
      : `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
  }
  if (diffWeeks < 4) {
    return isDE
      ? `vor ${diffWeeks} ${diffWeeks === 1 ? "Woche" : "Wochen"}`
      : `${diffWeeks} ${diffWeeks === 1 ? "week" : "weeks"} ago`;
  }

  return date.toLocaleDateString(isDE ? "de-DE" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ActivityLogEntryComponent({ entry }: ActivityLogEntryProps) {
  const t = useTranslations("activity");

  const metadata = entry.metadata as Record<string, string | number | undefined>;
  const userName = (metadata.user_name as string) ?? t("unknownUser");
  const icon = getActionIcon(entry.action_type);
  const colorClass = getActionColorClass(entry.action_type);

  // Determine locale from translation context
  // We use a simple approach: check if a known German word exists
  const locale = t("title") === "Änderungsprotokoll" ? "de" : "en";

  function getDescription(): string {
    switch (entry.action_type) {
      case "drawing.uploaded":
        return t("actions.drawingUploaded", { name: userName, file: metadata.display_name ?? "" });
      case "drawing.renamed":
        return t("actions.drawingRenamed", {
          name: userName,
          oldName: metadata.old_name ?? "",
          newName: metadata.new_name ?? "",
        });
      case "drawing.archived":
        return t("actions.drawingArchived", { name: userName, file: metadata.display_name ?? "" });
      case "drawing.restored":
        return t("actions.drawingRestored", { name: userName, file: metadata.display_name ?? "" });
      case "version.uploaded":
        return t("actions.versionUploaded", {
          name: userName,
          drawing: metadata.drawing_name ?? "",
          version: String(metadata.version_number ?? ""),
        });
      case "version.archived":
        return t("actions.versionArchived", {
          name: userName,
          drawing: metadata.drawing_name ?? "",
          version: String(metadata.version_number ?? ""),
        });
      case "drawing.status_changed":
        return t("actions.statusChanged", {
          name: userName,
          drawing: metadata.drawing_name ?? "",
          oldStatus: metadata.old_status ?? t("noStatus"),
          newStatus: metadata.new_status ?? t("noStatus"),
        });
      case "project.created":
        return t("actions.projectCreated", { name: userName, project: metadata.name ?? "" });
      case "project.updated":
        return t("actions.projectUpdated", {
          name: userName,
          oldName: metadata.old_name ?? "",
          newName: metadata.new_name ?? "",
        });
      case "project.archived":
        return t("actions.projectArchived", { name: userName, project: metadata.name ?? "" });
      case "project.restored":
        return t("actions.projectRestored", { name: userName, project: metadata.name ?? "" });
      case "member.invited":
        return t("actions.memberInvited", {
          name: userName,
          invited: (metadata.invited_name as string) ?? (metadata.invited_email as string) ?? "",
        });
      case "member.removed":
        return t("actions.memberRemoved", {
          name: userName,
          removed: (metadata.removed_name as string) ?? (metadata.removed_email as string) ?? "",
        });
      case "marker.created":
        return t("actions.markerCreated", {
          name: userName,
          marker: metadata.marker_name ?? "",
          drawing: metadata.drawing_name ?? "",
        });
      case "marker.deleted":
        return t("actions.markerDeleted", {
          name: userName,
          marker: metadata.marker_name ?? "",
          drawing: metadata.drawing_name ?? "",
        });
      default:
        return `${userName}: ${entry.action_type}`;
    }
  }

  return (
    <div className="flex items-start gap-3 py-3 px-4" role="listitem">
      <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${colorClass}`}>
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug">{getDescription()}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Avatar className="h-4 w-4">
            <AvatarFallback className="text-[8px] bg-muted">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">{userName}</span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(entry.created_at, locale)}
          </span>
        </div>
      </div>
    </div>
  );
}
