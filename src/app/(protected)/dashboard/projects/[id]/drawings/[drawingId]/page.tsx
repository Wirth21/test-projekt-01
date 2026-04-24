"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// react-pdf / pdfjs-dist uses `DOMMatrix` at module-eval time, which does not
// exist in Node. Even though the viewer is a client component, Next.js App
// Router still evaluates its module graph on the server to produce the
// initial HTML shell — and under Next 16 + Turbopack that SSR evaluation
// crashes with `ReferenceError: DOMMatrix is not defined`.
//
// Wrapping the viewer in `next/dynamic` with `ssr: false` keeps the pdfjs
// chunk out of the server bundle entirely. The server still renders this
// tiny page module; the PDF viewer loads only in the browser.
const DrawingViewerClient = dynamic(
  () => import("./DrawingViewerClient").then((m) => m.DrawingViewerClient),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface PageProps {
  params: Promise<{ id: string; drawingId: string }>;
}

export default function DrawingViewerPage(props: PageProps) {
  return <DrawingViewerClient {...props} />;
}
