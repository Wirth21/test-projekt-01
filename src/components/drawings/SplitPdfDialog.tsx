"use client";

import { Files, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type SplitChoice = "keep" | "split";

interface SplitPdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  pageCount: number;
  onChoice: (choice: SplitChoice) => void;
}

export function SplitPdfDialog({
  open,
  onOpenChange,
  fileName,
  pageCount,
  onChoice,
}: SplitPdfDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mehrseitige PDF erkannt</DialogTitle>
          <DialogDescription>
            &bdquo;{fileName}&ldquo; hat {pageCount} Seiten. Moechtest du die
            Datei als eine Zeichnung hochladen oder in einzelne Seiten aufteilen?
            Beim Aufteilen wird aus jeder Seite eine eigene Zeichnung.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto flex-col gap-1.5 py-4"
            onClick={() => onChoice("keep")}
          >
            <FileText className="h-6 w-6" />
            <span className="font-medium">Als eine Datei</span>
            <span className="text-xs text-muted-foreground text-center">
              Alle {pageCount} Seiten bleiben zusammen
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto flex-col gap-1.5 py-4"
            onClick={() => onChoice("split")}
          >
            <Files className="h-6 w-6" />
            <span className="font-medium">In Seiten aufteilen</span>
            <span className="text-xs text-muted-foreground text-center">
              {pageCount} einzelne Zeichnungen
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
