import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export default function PdfViewer({ fileUrl, renderOverlay, onPageChange }) {
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const pdfRef = useRef(null);

  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pageDims, setPageDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let cancelled = false;
    const loadingTask = pdfjsLib.getDocument({ url: fileUrl });
    loadingTask.promise
      .then((pdf) => {
        if (cancelled) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("PDF load failed:", err);
        setLoadError(err?.message || "Failed to load PDF");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      try { loadingTask.destroy(); } catch { /* noop */ }
      if (pdfRef.current) {
        try { pdfRef.current.destroy(); } catch { /* noop */ }
        pdfRef.current = null;
      }
    };
  }, [fileUrl]);

  useEffect(() => {
    onPageChange?.(pageNum);
  }, [pageNum, onPageChange]);

  useEffect(() => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || numPages === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const page = await pdf.getPage(pageNum);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: zoom });
        const dpr = window.devicePixelRatio || 1;
        const cssWidth = Math.floor(viewport.width);
        const cssHeight = Math.floor(viewport.height);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;

        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel(); } catch { /* noop */ }
        }
        const ctx = canvas.getContext("2d");
        const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null;
        const task = page.render({ canvasContext: ctx, viewport, transform });
        renderTaskRef.current = task;
        await task.promise;
        if (!cancelled) setPageDims({ width: cssWidth, height: cssHeight });
      } catch (err) {
        if (err?.name === "RenderingCancelledException") return;
        console.error("PDF render failed:", err);
      }
    })();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch { /* noop */ }
      }
    };
  }, [pageNum, zoom, numPages]);

  const goPrev = () => setPageNum((n) => Math.max(1, n - 1));
  const goNext = () => setPageNum((n) => Math.min(numPages, n + 1));
  const zoomOut = () => {
    const idx = ZOOM_LEVELS.findIndex((z) => z >= zoom);
    setZoom(ZOOM_LEVELS[Math.max(0, idx - 1)]);
  };
  const zoomIn = () => {
    const idx = ZOOM_LEVELS.findIndex((z) => z >= zoom);
    setZoom(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, idx + 1)]);
  };

  if (loadError) {
    return (
      <div className="pdf-viewer-error">
        <p>Couldn't load this PDF: {loadError}</p>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <div className="pdf-viewer-toolbar">
        <button type="button" onClick={goPrev} disabled={pageNum <= 1 || loading}>
          ◀ Prev
        </button>
        <span className="pdf-viewer-pageinfo">
          {loading ? "Loading…" : `Page ${pageNum} / ${numPages}`}
        </span>
        <button type="button" onClick={goNext} disabled={pageNum >= numPages || loading}>
          Next ▶
        </button>
        <span className="pdf-viewer-divider" />
        <button type="button" onClick={zoomOut} disabled={loading}>−</button>
        <span className="pdf-viewer-zoominfo">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={zoomIn} disabled={loading}>+</button>
      </div>
      <div className="pdf-viewer-canvas-wrap">
        {loading && <div className="pdf-viewer-loading">Loading PDF…</div>}
        <div className="pdf-viewer-canvas-stack">
          <canvas ref={canvasRef} className="pdf-viewer-canvas" />
          {renderOverlay?.({ pageNum, pageWidth: pageDims.width, pageHeight: pageDims.height })}
        </div>
      </div>
    </div>
  );
}
