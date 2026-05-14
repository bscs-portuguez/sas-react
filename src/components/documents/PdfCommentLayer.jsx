import { useRef, useState } from "react";

const MIN_DRAG_PX = 6;

export default function PdfCommentLayer({
  pageNum,
  pageWidth,
  pageHeight,
  comments,
  activeCommentId,
  onSelectComment,
  onCreateBox,
  drawingEnabled,
}) {
  const layerRef = useRef(null);
  const [drag, setDrag] = useState(null); // { x0, y0, x1, y1 }

  if (!pageWidth || !pageHeight) return null;

  const handlePointerDown = (e) => {
    if (!drawingEnabled) return;
    const rect = layerRef.current.getBoundingClientRect();
    const x0 = (e.clientX - rect.left) / rect.width;
    const y0 = (e.clientY - rect.top) / rect.height;
    setDrag({ x0, y0, x1: x0, y1: y0, startX: e.clientX, startY: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!drag) return;
    const rect = layerRef.current.getBoundingClientRect();
    const x1 = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y1 = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setDrag((d) => ({ ...d, x1, y1 }));
  };

  const handlePointerUp = (e) => {
    if (!drag) return;
    const dx = Math.abs(e.clientX - drag.startX);
    const dy = Math.abs(e.clientY - drag.startY);
    if (dx >= MIN_DRAG_PX && dy >= MIN_DRAG_PX) {
      const x = Math.min(drag.x0, drag.x1);
      const y = Math.min(drag.y0, drag.y1);
      const w = Math.abs(drag.x1 - drag.x0);
      const h = Math.abs(drag.y1 - drag.y0);
      onCreateBox?.({ page: pageNum, x, y, w, h });
    }
    setDrag(null);
  };

  const pageComments = (comments || []).filter((c) => c.page === pageNum);

  return (
    <div
      ref={layerRef}
      className={`pdf-comment-layer${drawingEnabled ? " is-drawing" : ""}`}
      style={{ width: pageWidth, height: pageHeight }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setDrag(null)}
    >
      {pageComments.map((c) => {
        const b = c.bbox || {};
        return (
          <button
            key={c.id}
            type="button"
            className={`pdf-comment-box${c.resolved ? " is-resolved" : ""}${activeCommentId === c.id ? " is-active" : ""}`}
            style={{
              left: `${b.x * 100}%`,
              top: `${b.y * 100}%`,
              width: `${b.w * 100}%`,
              height: `${b.h * 100}%`,
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onSelectComment?.(c.id);
            }}
            title={c.text}
          />
        );
      })}

      {drag && (() => {
        const x = Math.min(drag.x0, drag.x1);
        const y = Math.min(drag.y0, drag.y1);
        const w = Math.abs(drag.x1 - drag.x0);
        const h = Math.abs(drag.y1 - drag.y0);
        return (
          <div
            className="pdf-comment-draft"
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              width: `${w * 100}%`,
              height: `${h * 100}%`,
            }}
          />
        );
      })()}
    </div>
  );
}
