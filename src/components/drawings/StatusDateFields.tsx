"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "next-intl";
import type { DrawingStatus } from "@/lib/types/drawing";

const NO_STATUS = "__none__";

interface StatusDateFieldsProps {
  statuses: DrawingStatus[];
  statusId: string | null;
  /** `yyyy-mm-dd` */
  date: string;
  onStatusChange: (id: string | null) => void;
  onDateChange: (date: string) => void;
  disabled?: boolean;
}

/**
 * PROJ-30 — Status select + date picker shared by the new-version dialog and
 * the new-drawing upload dialog.
 */
export function StatusDateFields({
  statuses,
  statusId,
  date,
  onStatusChange,
  onDateChange,
  disabled = false,
}: StatusDateFieldsProps) {
  const t = useTranslations("drawings");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="upload-status">{t("status")}</Label>
        <Select
          value={statusId ?? NO_STATUS}
          onValueChange={(v) => onStatusChange(v === NO_STATUS ? null : v)}
          disabled={disabled}
        >
          <SelectTrigger id="upload-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_STATUS}>{t("noStatus")}</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                    aria-hidden="true"
                  />
                  {s.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="upload-date">{t("uploadDate")}</Label>
        <Input
          id="upload-date"
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
