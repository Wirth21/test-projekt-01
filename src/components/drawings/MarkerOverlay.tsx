"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { KeepScale } from "react-zoom-pan-pinch";
import { MarkerPin } from "./MarkerPin";
import { MarkerTooltip } from "./MarkerTooltip";
import { MarkerContextMenu } from "./MarkerContextMenu";
import type { MarkerWithTarget } from "@/lib/types/marker";
import type { Drawing } from "@/lib/types/drawing";

interface MarkerOverlayProps {
  markers: MarkerWithTarget[];
  currentPage: number;
  editMode: boolean;
  drawings: Drawing[];
  currentDrawingId: string;
  getSignedUrl: (drawingId: string) => Promise<string>;
  onMarkerClick: (marker: MarkerWithTarget) => void;
  onMarkerRename: (markerId: string, name: string) => Promise<void>;
  onMarkerRetarget: (markerId: string, targetId: string) => Promise<void>;
  onMarkerColorChange: (markerId: string, color: string) => Promise<void>;
  onMarkerDelete: (markerId: string) => Promise<void>;
  onMarkerDrag: (
    markerId: string,
    xPercent: number,
    yPercent: number
  ) => Promise<void>;
  onPageClick: (xPercent: number, yPercent: number) => void;
}

function getClientPos(e: MouseEvent | TouchEvent) {
  if ("touches" in e) {
    const touch = e.touches[0] ?? (e as TouchEvent).changedTouches[0];
    return { x: touch.clientX, y: touch.clientY };
  }
  return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
}

export function MarkerOverlay({
  markers,
  currentPage,
  editMode,
  drawings,
  currentDrawingId,
  getSignedUrl,
  onMarkerClick,
  onMarkerRename,
  onMarkerRetarget,
  onMarkerColorChange,
  onMarkerDelete,
  onMarkerDrag,
  onPageClick,
}: MarkerOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [selectedMarker, setSelectedMarker] = useState<MarkerWithTarget | null>(null);
  const [selectedAnchorEl, setSelectedAnchorEl] = useState<HTMLElement | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    marker: MarkerWithTarget;
    position: { x: number; y: number };
  } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const justDraggedRef = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pageMarkers = markers.filter((m) => m.page_number === currentPage);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!editMode || dragging) return;
      if (justDraggedRef.current) {
        justDraggedRef.current = false;
        return;
      }
      if (e.target !== overlayRef.current) return;

      const rect = overlayRef.current!.getBoundingClientRect();
      const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
      onPageClick(xPercent, yPercent);
    },
    [editMode, dragging, onPageClick]
  );

  const startDrag = useCallback(
    (marker: MarkerWithTarget, startEvent: React.MouseEvent | React.TouchEvent) => {
      if (!editMode) return;
      startEvent.preventDefault();
      startEvent.stopPropagation();

      setDragging(marker.id);
      setSelectedMarker(null);

      const overlay = overlayRef.current;
      if (!overlay) return;

      const isTouch = "touches" in startEvent.nativeEvent;

      function handleMove(moveEvent: MouseEvent | TouchEvent) {
        if (!overlay) return;
        const { x, y } = getClientPos(moveEvent);
        const rect = overlay.getBoundingClientRect();
        const xPercent = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
        const yPercent = Math.max(0, Math.min(100, ((y - rect.top) / rect.height) * 100));

        const pinEl = overlay.querySelector(
          `[data-marker-id="${marker.id}"]`
        ) as HTMLElement | null;
        if (pinEl) {
          pinEl.style.left = `${xPercent}%`;
          pinEl.style.top = `${yPercent}%`;
        }
      }

      function handleEnd(upEvent: MouseEvent | TouchEvent) {
        if (!overlay) return;
        const { x, y } = getClientPos(upEvent);
        const rect = overlay.getBoundingClientRect();
        const xPercent = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
        const yPercent = Math.max(0, Math.min(100, ((y - rect.top) / rect.height) * 100));

        onMarkerDrag(marker.id, xPercent, yPercent);
        setDragging(null);
        justDraggedRef.current = true;
        // Reset after the click event has fired
        setTimeout(() => { justDraggedRef.current = false; }, 0);

        if (isTouch) {
          document.removeEventListener("touchmove", handleMove);
          document.removeEventListener("touchend", handleEnd);
        } else {
          document.removeEventListener("mousemove", handleMove);
          document.removeEventListener("mouseup", handleEnd);
        }
      }

      if (isTouch) {
        document.addEventListener("touchmove", handleMove, { passive: false });
        document.addEventListener("touchend", handleEnd);
      } else {
        document.addEventListener("mousemove", handleMove);
        document.addEventListener("mouseup", handleEnd);
      }
    },
    [editMode, onMarkerDrag]
  );

  const handleTouchStart = useCallback(
    (marker: MarkerWithTarget, e: React.TouchEvent) => {
      if (!editMode) return;

      const touch = e.touches[0];
      const pos = { x: touch.clientX, y: touch.clientY };

      longPressTimer.current = setTimeout(() => {
        setContextMenu({ marker, position: pos });
        longPressTimer.current = null;
      }, 500);
    },
    [editMode]
  );

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(
    (marker: MarkerWithTarget, e: React.TouchEvent) => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
        startDrag(marker, e);
      }
    },
    [startDrag]
  );

  return (
    <>
      <div
        ref={overlayRef}
        className="absolute inset-0"
        onClick={handleOverlayClick}
        style={{ pointerEvents: editMode ? "auto" : "none" }}
      >
        {pageMarkers.map((marker) => (
          <div
            key={marker.id}
            data-marker-id={marker.id}
            className="absolute"
            style={{
              left: `${marker.x_percent}%`,
              top: `${marker.y_percent}%`,
              pointerEvents: "auto",
            }}
          >
            <KeepScale>
              <MarkerPin
                marker={marker}
                editMode={editMode}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!editMode) {
                    if (selectedMarker?.id === marker.id) {
                      setSelectedMarker(null);
                      setSelectedAnchorEl(null);
                    } else {
                      setSelectedMarker(marker);
                      setSelectedAnchorEl(e.currentTarget as HTMLElement);
                    }
                  }
                }}
                onContextMenu={(e) => {
                  if (editMode) {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenu({
                      marker,
                      position: { x: e.clientX, y: e.clientY },
                    });
                  }
                }}
                onDragStart={(e) => startDrag(marker, e)}
                onTouchStart={(e) => handleTouchStart(marker, e)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={(e) => handleTouchMove(marker, e)}
              />
            </KeepScale>
          </div>
        ))}
      </div>

      {/* Preview tooltip — MarkerTooltip uses Portal internally */}
      {selectedMarker && !contextMenu && (
        <MarkerTooltip
          marker={selectedMarker}
          anchorEl={selectedAnchorEl}
          getSignedUrl={getSignedUrl}
          onNavigate={onMarkerClick}
          onClose={() => {
            setSelectedMarker(null);
            setSelectedAnchorEl(null);
          }}
        />
      )}

      {/* Context menu — also via Portal */}
      {contextMenu && typeof document !== "undefined" &&
        createPortal(
          <MarkerContextMenu
            marker={contextMenu.marker}
            position={contextMenu.position}
            drawings={drawings}
            currentDrawingId={currentDrawingId}
            onRename={onMarkerRename}
            onChangeTarget={onMarkerRetarget}
            onChangeColor={onMarkerColorChange}
            onDelete={onMarkerDelete}
            onClose={() => setContextMenu(null)}
          />,
          document.body
        )
      }
    </>
  );
}
