"use client";

import { Download, Loader2, FileDown, Layers, Files, FolderArchive } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { DownloadScope } from "@/lib/download/download-drawings";

interface DownloadMenuProps {
  onSelect: (scope: DownloadScope) => void;
  downloading?: boolean;
  disabled?: boolean;
  /** Render only the icon (mobile / fullscreen toolbars). */
  iconOnly?: boolean;
  variant?: "outline" | "ghost";
  triggerClassName?: string;
  align?: "start" | "center" | "end";
}

/**
 * PROJ-29 — Download menu shared by the desktop header, the mobile control bar
 * and the fullscreen FloatingToolbar. Four scopes: current drawing, current
 * incl. all versions, all current drawings, all incl. versions.
 */
export function DownloadMenu({
  onSelect,
  downloading = false,
  disabled = false,
  iconOnly = false,
  variant = "outline",
  triggerClassName,
  align = "end",
}: DownloadMenuProps) {
  const t = useTranslations("drawings");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size="sm"
          disabled={disabled || downloading}
          className={triggerClassName ?? "gap-1.5"}
          aria-label={t("download.label")}
          title={t("download.label")}
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {!iconOnly && <span className="hidden lg:inline">{t("download.label")}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-72">
        <DropdownMenuLabel>{t("download.label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onSelect={() => onSelect("current")}>
          <FileDown className="h-4 w-4 shrink-0" />
          <span>{t("download.current")}</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onSelect={() => onSelect("current-versions")}>
          <Layers className="h-4 w-4 shrink-0" />
          <span>{t("download.currentVersions")}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onSelect={() => onSelect("all-current")}>
          <Files className="h-4 w-4 shrink-0" />
          <span>{t("download.allCurrent")}</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onSelect={() => onSelect("all-versions")}>
          <FolderArchive className="h-4 w-4 shrink-0" />
          <span>{t("download.allVersions")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
