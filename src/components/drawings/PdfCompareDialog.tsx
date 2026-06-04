"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, FileWarning } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TransformWrapper,
  TransformComponent,
} from "react-zoom-pan-pinch";
import { useTranslations } from "next-intl";
import { fetchPdfBlob } from "@/lib/print/print-pdf";
import { renderPageToCanvas } from "@/lib/compare/render-page";
import type { DrawingVersion } from "@/lib/types/drawing";

type CompareMode = "overlay" | "swipe" | "redblue" | "difference";

const RENDER_WIDTH = 1400;
// Tint colours for the red-blue / difference compositing.
const RED = [214, 33, 38] as const; // removed (only in old)
const BLUE = [37, 99, 235] as const; // added (only in new)
const GREY = [96, 96, 96] as const; // unchanged (in both)
const DIFF = [200, 16, 46] as const; // difference highlight

interface PdfCompareDialogProps {
  open: boolean;
  onClose: () => void;
  versions: DrawingVersion[];
  drawingName: string;
  getVersionSignedUrl: (versionId: string) => Promise<string>;
}

export function PdfCompareDialog({
  open,
  onClose,
  versions,
  drawingName,
  getVersionSignedUrl,
}: PdfCompareDialogProps) {
  const t = useTranslations("drawings");

  // Active versions, newest first. B (new) defaults to newest, A (old) to the
  // one below it.
  const active = versions
    .filter((v) => !v.is_archived)
    .sort((a, b) => b.version_number - a.version_number);

  const [aId, setAId] = useState<string>(() => active[1]?.id ?? active[0]?.id ?? "");
  const [bId, setBId] = useState<string>(() => active[0]?.id ?? "");
  const [mode, setMode] = useState<CompareMode>("redblue");
  const [opacity, setOpacity] = useState(0.5);
  const [wipe, setWipe] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [aspectWarning, setAspectWarning] = useState(false);

  const canvasARef = useRef<HTMLCanvasElement | null>(null);
  const canvasBRef = useRef<HTMLCanvasElement | null>(null);
  const pixelsARef = useRef<Uint8ClampedArray | null>(null);
  const pixelsBRef = useRef<Uint8ClampedArray | null>(null);
  const dimsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const displayRef = useRef<HTMLCanvasElement | null>(null);

  const composite = useCallback(() => {
    const disp = displayRef.current;
    const cA = canvasARef.current;
    const cB = canvasBRef.current;
    const { w, h } = dimsRef.current;
    if (!disp || !cA || !cB || !w || !h) return;
    disp.width = w;
    disp.height = h;
    const ctx = disp.getContext("2d");
    if (!ctx) return;

    if (mode === "overlay") {
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(cA, 0, 0, w, h);
      ctx.globalAlpha = opacity;
      ctx.drawImage(cB, 0, 0, w, h);
      ctx.globalAlpha = 1;
      return;
    }

    if (mode === "swipe") {
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(cA, 0, 0, w, h);
      const x = Math.round(w * wipe);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, 0, w - x, h);
      ctx.clip();
      ctx.drawImage(cB, 0, 0, w, h);
      ctx.restore();
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      return;
    }

    // redblue / difference — per-pixel compositing from the cached samples.
    const dataA = pixelsARef.current;
    const dataB = pixelsBRef.current;
    if (!dataA || !dataB) return;
    const out = ctx.createImageData(w, h);
    const o = out.data;
    for (let i = 0; i < o.length; i += 4) {
      const lumA = dataA[i] * 0.299 + dataA[i + 1] * 0.587 + dataA[i + 2] * 0.114;
      const lumB = dataB[i] * 0.299 + dataB[i + 1] * 0.587 + dataB[i + 2] * 0.114;
      const a = 1 - lumA / 255; // ink strength in old
      const b = 1 - lumB / 255; // ink strength in new

      if (mode === "difference") {
        const d = Math.abs(a - b);
        o[i] = Math.round(255 * (1 - d) + DIFF[0] * d);
        o[i + 1] = Math.round(255 * (1 - d) + DIFF[1] * d);
        o[i + 2] = Math.round(255 * (1 - d) + DIFF[2] * d);
        o[i + 3] = 255;
        continue;
      }

      const both = Math.min(a, b); // unchanged ink → grey
      const onlyA = Math.max(0, a - b); // removed → red
      const onlyB = Math.max(0, b - a); // added → blue
      let r = 255;
      let g = 255;
      let bl = 255;
      r = r * (1 - both) + GREY[0] * both;
      g = g * (1 - both) + GREY[1] * both;
      bl = bl * (1 - both) + GREY[2] * both;
      r = r * (1 - onlyA) + RED[0] * onlyA;
      g = g * (1 - onlyA) + RED[1] * onlyA;
      bl = bl * (1 - onlyA) + RED[2] * onlyA;
      r = r * (1 - onlyB) + BLUE[0] * onlyB;
      g = g * (1 - onlyB) + BLUE[1] * onlyB;
      bl = bl * (1 - onlyB) + BLUE[2] * onlyB;
      o[i] = r;
      o[i + 1] = g;
      o[i + 2] = bl;
      o[i + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
  }, [mode, opacity, wipe]);

  // Load + render both versions whenever the dialog opens or the chosen
  // versions change. Sequential render keeps the single mobile pdfjs worker
  // from thrashing.
  useEffect(() => {
    if (!open || !aId || !bId) return;
    let cancelled = false;
    setReady(false);
    setError(null);
    setAspectWarning(false);
    setLoading(true);

    (async () => {
      try {
        const [urlA, urlB] = await Promise.all([
          getVersionSignedUrl(aId),
          getVersionSignedUrl(bId),
        ]);
        const [blobA, blobB] = await Promise.all([fetchPdfBlob(urlA), fetchPdfBlob(urlB)]);
        const [bufA, bufB] = await Promise.all([blobA.arrayBuffer(), blobB.arrayBuffer()]);
        const cA = await renderPageToCanvas(bufA, { width: RENDER_WIDTH });
        const cB = await renderPageToCanvas(bufB, { width: RENDER_WIDTH });
        if (cancelled) return;
        if (!cA || !cB) throw new Error("render failed");

        const aspA = cA.width / cA.height;
        const aspB = cB.width / cB.height;
        setAspectWarning(Math.abs(aspA - aspB) / aspA > 0.02);

        // Base everything on A's pixel dimensions; sample B aligned to them so
        // the per-pixel modes line up even if B's intrinsic size differs.
        const w = cA.width;
        const h = cA.height;
        const ctxA = cA.getContext("2d");
        if (!ctxA) throw new Error("no ctx");
        pixelsARef.current = ctxA.getImageData(0, 0, w, h).data;

        const tmp = document.createElement("canvas");
        tmp.width = w;
        tmp.height = h;
        const tctx = tmp.getContext("2d");
        if (!tctx) throw new Error("no ctx");
        tctx.fillStyle = "#ffffff";
        tctx.fillRect(0, 0, w, h);
        tctx.drawImage(cB, 0, 0, w, h);
        pixelsBRef.current = tctx.getImageData(0, 0, w, h).data;

        canvasARef.current = cA;
        canvasBRef.current = cB;
        dimsRef.current = { w, h };
        setReady(true);
      } catch {
        if (!cancelled) setError(t("compare.error"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, aId, bId, getVersionSignedUrl, t]);

  // Re-composite whenever the mode or a slider changes (cheap for
  // overlay/swipe; the pixel loop only runs for the red-blue/difference modes).
  useEffect(() => {
    if (ready) composite();
  }, [ready, composite]);

  const modes: { key: CompareMode; label: string }[] = [
    { key: "overlay", label: t("compare.mode.overlay") },
    { key: "swipe", label: t("compare.mode.swipe") },
    { key: "redblue", label: t("compare.mode.redblue") },
    { key: "difference", label: t("compare.mode.difference") },
  ];

  const sameVersion = aId === bId;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[96vw] w-[96vw] h-[92vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="text-base">
            {t("compare.title")} — {drawingName}
          </DialogTitle>
        </DialogHeader>

        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3 px-4 py-2.5 border-b shrink-0">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              {t("compare.versionA")}
            </label>
            <Select value={aId} onValueChange={setAId}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {active.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">
                    v{v.version_number} · {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              {t("compare.versionB")}
            </label>
            <Select value={bId} onValueChange={setBId}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {active.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">
                    v{v.version_number} · {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="inline-flex rounded-md border p-0.5">
            {modes.map((m) => (
              <Button
                key={m.key}
                variant={mode === m.key ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setMode(m.key)}
                aria-pressed={mode === m.key}
              >
                {m.label}
              </Button>
            ))}
          </div>

          {mode === "overlay" && (
            <div className="flex flex-col gap-1 min-w-[160px] flex-1 max-w-[240px]">
              <label className="text-[11px] font-medium text-muted-foreground">
                {t("compare.opacity")}
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="accent-primary"
                aria-label={t("compare.opacity")}
              />
            </div>
          )}
          {mode === "swipe" && (
            <div className="flex flex-col gap-1 min-w-[160px] flex-1 max-w-[240px]">
              <label className="text-[11px] font-medium text-muted-foreground">
                {t("compare.wipe")}
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={wipe}
                onChange={(e) => setWipe(Number(e.target.value))}
                className="accent-primary"
                aria-label={t("compare.wipe")}
              />
            </div>
          )}

          {mode === "redblue" && (
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground ml-auto">
              <LegendDot color={`rgb(${RED.join(",")})`} label={t("compare.legend.removed")} />
              <LegendDot color={`rgb(${BLUE.join(",")})`} label={t("compare.legend.added")} />
              <LegendDot color={`rgb(${GREY.join(",")})`} label={t("compare.legend.unchanged")} />
            </div>
          )}
          {mode === "difference" && (
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground ml-auto">
              <LegendDot color={`rgb(${DIFF.join(",")})`} label={t("compare.legend.changed")} />
            </div>
          )}
        </div>

        {aspectWarning && (
          <div className="px-4 py-1.5 bg-amber-50 text-amber-800 text-xs border-b shrink-0">
            {t("compare.aspectWarning")}
          </div>
        )}

        {/* Canvas area */}
        <div className="flex-1 min-h-0 relative bg-neutral-100">
          {sameVersion ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
              {t("compare.sameVersion")}
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
              <FileWarning className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : (
            <>
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-sm text-muted-foreground bg-neutral-100/70">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t("compare.loading")}
                </div>
              )}
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={8}
                limitToBounds={false}
                centerOnInit
                wheel={{ step: 0.1 }}
              >
                <TransformComponent
                  wrapperClass="!w-full !h-full"
                  contentClass="!w-full !h-full !flex !items-center !justify-center"
                >
                  <canvas
                    ref={displayRef}
                    className="max-w-full max-h-full object-contain shadow-lg bg-white"
                    style={{ height: "auto" }}
                  />
                </TransformComponent>
              </TransformWrapper>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
