"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

interface PdfUploadZoneProps {
  onUpload: (file: File) => void;
  uploading: boolean;
  progress: number;
  compact?: boolean;
}

export function PdfUploadZone({
  onUpload,
  uploading,
  progress,
  compact = false,
}: PdfUploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return "Nur PDF-Dateien sind erlaubt";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "Die Datei darf maximal 50 MB gross sein";
    }
    return null;
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        return;
      }
      setValidationError(null);
      onUpload(file);
    },
    [validateFile, onUpload]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!uploading) {
        setDragOver(true);
      }
    },
    [uploading]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      if (uploading) return;

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [uploading, handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      e.target.value = "";
    },
    [handleFile]
  );

  // Compact mode: small inline drop zone
  if (compact) {
    return (
      <div
        className={`rounded-md border-2 border-dashed transition-colors px-4 py-2 ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25"
        } ${uploading ? "pointer-events-none opacity-70" : "cursor-pointer"}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="PDF hochladen"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!uploading) inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleInputChange}
          aria-hidden="true"
        />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>{progress}%</span>
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              <span>PDF hierher ziehen oder klicken</span>
            </>
          )}
        </div>
        {validationError && (
          <p className="text-xs text-destructive mt-1" role="alert">
            {validationError}
          </p>
        )}
      </div>
    );
  }

  // Full drop zone mode
  return (
    <div
      className={`rounded-lg border-2 border-dashed transition-colors ${
        dragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 bg-muted/30"
      } ${uploading ? "pointer-events-none opacity-70" : "cursor-pointer"}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="PDF-Datei hochladen per Drag and Drop oder Klick"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!uploading) inputRef.current?.click();
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleInputChange}
        aria-hidden="true"
      />

      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        {uploading ? (
          <>
            <Upload className="h-8 w-8 text-primary mb-3 animate-pulse" />
            <p className="text-sm font-medium mb-1">Upload laeuft...</p>
            <div className="w-full max-w-xs">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {progress}%
              </p>
            </div>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground/60 mb-3" />
            <p className="text-sm font-medium">
              PDF hierher ziehen oder klicken
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Maximal 50 MB, nur PDF-Dateien
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              Datei auswaehlen
            </Button>
          </>
        )}

        {validationError && (
          <p className="text-sm text-destructive mt-3" role="alert">
            {validationError}
          </p>
        )}
      </div>
    </div>
  );
}
