"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

/**
 * Hook to manage the Browser Fullscreen API on a specific element.
 * Returns the current fullscreen state, toggle/exit functions,
 * and whether the browser supports the Fullscreen API.
 */
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSupported] = useState(
    () => typeof document !== "undefined" && !!document.fullscreenEnabled
  );

  // Listen for fullscreenchange events to keep state in sync
  useEffect(() => {
    function handleChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }

    document.addEventListener("fullscreenchange", handleChange);
    // Vendor prefixes for Safari
    document.addEventListener("webkitfullscreenchange", handleChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
      document.removeEventListener("webkitfullscreenchange", handleChange);
    };
  }, []);

  const enterFullscreen = useCallback(async () => {
    const el = ref.current;
    if (!el) return;

    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as unknown as Record<string, () => Promise<void>>).webkitRequestFullscreen) {
        // Safari
        await (el as unknown as Record<string, () => Promise<void>>).webkitRequestFullscreen();
      }
    } catch (err) {
      console.error("Failed to enter fullscreen:", err);
    }
  }, [ref]);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as unknown as Record<string, () => Promise<void>>).webkitExitFullscreen) {
        await (document as unknown as Record<string, () => Promise<void>>).webkitExitFullscreen();
      }
    } catch (err) {
      console.error("Failed to exit fullscreen:", err);
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  return {
    isFullscreen,
    isSupported,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
  };
}
