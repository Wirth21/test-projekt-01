"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Fragment } from "react";
import { useTranslations } from "next-intl";

export interface NavHistoryEntry {
  drawingId: string;
  drawingName: string;
}

interface NavigationBreadcrumbProps {
  history: NavHistoryEntry[];
  currentDrawingName: string;
  onNavigate: (index: number) => void;
  onClear: () => void;
}

export function NavigationBreadcrumb({
  history,
  currentDrawingName,
  onNavigate,
  onClear,
}: NavigationBreadcrumbProps) {
  const t = useTranslations("markers");

  if (history.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/50 border-b text-sm">
      <Breadcrumb>
        <BreadcrumbList>
          {history.map((entry, index) => (
            <Fragment key={`${entry.drawingId}-${index}`}>
              <BreadcrumbItem>
                <BreadcrumbLink
                  className="cursor-pointer hover:underline text-xs"
                  onClick={() => onNavigate(index)}
                >
                  {entry.drawingName}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </Fragment>
          ))}
          <BreadcrumbItem>
            <span className="text-xs font-medium">{currentDrawingName}</span>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-5 p-0 ml-auto shrink-0"
        onClick={onClear}
        aria-label={t("resetNavigation")}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
