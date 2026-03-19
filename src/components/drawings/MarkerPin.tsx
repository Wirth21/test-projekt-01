"use client";

import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarkerWithTarget } from "@/lib/types/marker";

interface MarkerPinProps {
  marker: MarkerWithTarget;
  editMode: boolean;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchEnd?: () => void;
  onTouchMove?: (e: React.TouchEvent) => void;
}

export function MarkerPin({
  marker,
  editMode,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onContextMenu,
  onDragStart,
  onTouchStart,
  onTouchEnd,
  onTouchMove,
}: MarkerPinProps) {
  const isArchived = marker.target_drawing?.is_archived;
  const isDeleted = !marker.target_drawing;

  const truncatedName =
    marker.name.length > 30 ? marker.name.slice(0, 30) + "\u2026" : marker.name;

  return (
    <div
      className={cn(
        "absolute -translate-x-1/2 -translate-y-full group/pin select-none touch-none",
        editMode && "cursor-grab active:cursor-grabbing",
        !editMode && "cursor-pointer",
      )}
      style={{
        left: `${marker.x_percent}%`,
        top: `${marker.y_percent}%`,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseDown={editMode ? onDragStart : undefined}
      onTouchStart={editMode ? onTouchStart : undefined}
      onTouchEnd={editMode ? onTouchEnd : undefined}
      onTouchMove={editMode ? onTouchMove : undefined}
    >
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight whitespace-nowrap mb-0.5",
            "bg-background/90 border shadow-sm backdrop-blur-sm",
            "opacity-0 group-hover/pin:opacity-100 transition-opacity",
            // Always show name on touch devices (no hover available)
            "sm:opacity-0 sm:group-hover/pin:opacity-100",
            isDeleted && "text-destructive",
            isArchived && "text-muted-foreground",
          )}
        >
          {truncatedName}
        </div>
        <MapPin
          className={cn(
            "h-6 w-6 drop-shadow-md sm:h-6 sm:w-6",
            // Larger tap target on touch devices
            "h-7 w-7",
            isDeleted
              ? "text-destructive"
              : isArchived
                ? "text-muted-foreground"
                : "text-primary",
            !editMode && "hover:scale-110 transition-transform",
          )}
          fill="currentColor"
          strokeWidth={1.5}
          stroke="white"
        />
      </div>
    </div>
  );
}
