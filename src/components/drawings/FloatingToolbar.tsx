"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Minimize,
  Pencil,
  Eye,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FloatingToolbarProps {
  currentPage: number;
  numPages: number | null;
  editMode: boolean;
  activeVersionCount: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onToggleEditMode: () => void;
  onExitFullscreen: () => void;
  onOpenVersionPanel: () => void;
}

const AUTO_HIDE_DELAY = 3000;

export function FloatingToolbar({
  currentPage,
  numPages,
  editMode,
  activeVersionCount,
  onPreviousPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleEditMode,
  onExitFullscreen,
  onOpenVersionPanel,
}: FloatingToolbarProps) {
  const [visible, setVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const resetHideTimer = useCallback(() => {
    setVisible(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
    }, AUTO_HIDE_DELAY);
  }, []);

  // Show toolbar on mouse movement anywhere in the fullscreen container
  useEffect(() => {
    function handleMouseMove() {
      resetHideTimer();
    }

    function handleKeyDown() {
      resetHideTimer();
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("keydown", handleKeyDown);

    // Start the auto-hide timer
    resetHideTimer();

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("keydown", handleKeyDown);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [resetHideTimer]);

  // Keep toolbar visible while hovering over it
  function handleMouseEnter() {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    setVisible(true);
  }

  function handleMouseLeave() {
    resetHideTimer();
  }

  return (
    <div
      ref={toolbarRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-background/95 backdrop-blur-sm border rounded-lg p-1.5 shadow-lg transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      role="toolbar"
      aria-label="Viewer controls"
    >
      <TooltipProvider delayDuration={300}>
        {/* Version panel button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenVersionPanel}
              className="h-9 w-9 p-0"
              aria-label="Versions"
            >
              <History className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Versionen</p>
          </TooltipContent>
        </Tooltip>

        {activeVersionCount > 1 && (
          <Badge
            variant="secondary"
            className="text-[10px] h-4 px-1 -ml-2 mr-1"
          >
            {activeVersionCount}
          </Badge>
        )}

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {/* Edit mode toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={editMode ? "default" : "ghost"}
              size="sm"
              onClick={onToggleEditMode}
              className="h-9 w-9 p-0"
              aria-label={editMode ? "View mode" : "Edit mode"}
            >
              {editMode ? (
                <Pencil className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{editMode ? "Ansichtsmodus" : "Bearbeitungsmodus"}</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {/* Page navigation */}
        {numPages && numPages > 1 && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onPreviousPage}
                  disabled={currentPage <= 1}
                  className="h-9 w-9 p-0"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Vorherige Seite</p>
              </TooltipContent>
            </Tooltip>

            <span className="text-sm tabular-nums px-1.5 min-w-[50px] text-center select-none">
              {currentPage} / {numPages}
            </span>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onNextPage}
                  disabled={currentPage >= numPages}
                  className="h-9 w-9 p-0"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Naechste Seite</p>
              </TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-5 mx-0.5" />
          </>
        )}

        {/* Zoom controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onZoomIn}
              className="h-9 w-9 p-0"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Hineinzoomen</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onZoomOut}
              className="h-9 w-9 p-0"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Herauszoomen</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetZoom}
              className="h-9 w-9 p-0"
              aria-label="Reset zoom"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Zoom zuruecksetzen</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {/* Exit fullscreen */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onExitFullscreen}
              className="h-9 w-9 p-0"
              aria-label="Exit fullscreen"
            >
              <Minimize className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Vollbild verlassen</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
