"use client";

import { AlertTriangle, FileText, Files } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export type BatchChoice = "keep" | "split";

interface MultiPageBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Only the multi-page items — single-page files don't need to be listed. */
  multiPageFiles: { name: string; pageCount: number }[];
  totalFiles: number;
  onChoice: (choice: BatchChoice) => void;
}

export function MultiPageBatchDialog({
  open,
  onOpenChange,
  multiPageFiles,
  totalFiles,
  onChoice,
}: MultiPageBatchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Mehrseitige PDFs im Upload
          </DialogTitle>
          <DialogDescription>
            Von {totalFiles} Dateien haben {multiPageFiles.length} mehr als eine
            Seite. Moechtest du die mehrseitigen PDFs jeweils als eine
            Zeichnung hochladen oder in einzelne Seiten aufteilen? Dateien mit
            nur einer Seite werden in beiden Faellen unveraendert uebernommen.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-48 border rounded-md">
          <ul className="text-xs py-1">
            {multiPageFiles.map((f) => (
              <li
                key={f.name}
                className="flex items-center gap-2 px-3 py-1.5 border-b last:border-b-0"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-muted-foreground shrink-0">
                  {f.pageCount} Seiten
                </span>
              </li>
            ))}
          </ul>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onChoice("keep")}
          >
            <FileText className="mr-2 h-4 w-4" />
            Je eine Datei
          </Button>
          <Button type="button" onClick={() => onChoice("split")}>
            <Files className="mr-2 h-4 w-4" />
            Seiten aufteilen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
