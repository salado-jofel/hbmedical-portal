"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders page 1 of a PDF to a <canvas> at the given scale.
 * Default scale = 1275/612 ≈ 2.0833 so the canvas is exactly 1275×1650 px —
 * matching the IMG_W/IMG_H constants used for overlay positioning.
 *
 * pdfjs-dist is imported dynamically inside useEffect to avoid SSR crashes
 * caused by browser-only APIs (DOMMatrix) running in Node.js.
 */
export function PdfBackground({
  pdfUrl,
  scale = 1275 / 612,
  onDimensionsReady,
  onReady,
}: {
  pdfUrl: string;
  scale?: number;
  onDimensionsReady?: (width: number, height: number) => void;
  onReady?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (cancelled) return;

      await page.render({ canvas, viewport }).promise;

      if (!cancelled) {
        setLoaded(true);
        onDimensionsReady?.(viewport.width, viewport.height);
        onReady?.();
      }
    }

    render().catch((err) => {
      if (!cancelled) console.error("[PdfBackground] render error:", err);
    });

    return () => {
      cancelled = true;
    };
  }, [pdfUrl, scale]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-auto block"
      style={{
        opacity: loaded ? 1 : 0,
        transition: "opacity 0.2s ease",
        zIndex: 1,
      }}
    />
  );
}
