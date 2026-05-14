import { useEffect, useState } from "react";
import PdfViewer from "./PdfViewer";
import PdfCommentLayer from "./PdfCommentLayer";
import CommentThreadPanel from "./CommentThreadPanel";
import RevisionUploadModal from "./RevisionUploadModal";
import {
  subscribeToComments,
  createComment,
  resolveComment,
  deleteComment,
  addReply,
} from "../../services/commentService";
import { uploadRevision } from "../../services/documentService";
import "./DocumentPreviewModal.css";

const PDF_EXT = ["pdf"];
const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif"];

function detectKind(fileName, fileUrl) {
  const source = (fileName || fileUrl || "").toLowerCase();
  const match = source.match(/\.([a-z0-9]+)(?:\?|#|$)/);
  const ext = match ? match[1] : "";
  if (PDF_EXT.includes(ext)) return "pdf";
  if (IMAGE_EXT.includes(ext)) return "image";
  return "other";
}

export default function DocumentPreviewModal({
  fileUrl,
  fileName,
  title,
  onClose,
  // Optional commenting context — only PDFs with all four are commentable
  documentId,
  requirementKey,
  currentUser,
  viewerRole, // "reviewer" | "org"
  fileVersion,
  previousVersion,
  onRevisionUploaded,
}) {
  const [comments, setComments] = useState([]);
  const [activeCommentId, setActiveCommentId] = useState(null);
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [draftBox, setDraftBox] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [revisionDraft, setRevisionDraft] = useState(null); // selected comments awaiting upload

  const kind = fileUrl ? detectKind(fileName, fileUrl) : "other";
  const commentingEnabled =
    kind === "pdf" && !!documentId && !!requirementKey && !!currentUser?.uid;

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (!commentingEnabled) return;
    const unsub = subscribeToComments(documentId, requirementKey, setComments);
    return () => unsub?.();
  }, [commentingEnabled, documentId, requirementKey]);

  if (!fileUrl) return null;

  const displayTitle = title || fileName || "Document";

  const handleCreateBox = (box) => {
    setDraftBox(box);
    setDrawingEnabled(false);
  };

  const handleSubmitDraft = async (text) => {
    if (!draftBox) return;
    await createComment({
      documentId,
      requirementKey,
      page: draftBox.page,
      bbox: { x: draftBox.x, y: draftBox.y, w: draftBox.w, h: draftBox.h },
      text,
      authorUid: currentUser.uid,
      authorName: currentUser.name || currentUser.displayName || "User",
      authorRole: currentUser.role || "",
      authorSide: viewerRole || "reviewer",
    });
    setDraftBox(null);
  };

  const handleResolveToggle = async (c) => {
    await resolveComment(documentId, c.id, !c.resolved);
  };

  const handleDeleteComment = async (c) => {
    await deleteComment(documentId, c.id);
    if (activeCommentId === c.id) setActiveCommentId(null);
  };

  const handleAddReply = async (c, text) => {
    await addReply({
      documentId,
      commentId: c.id,
      text,
      authorUid: currentUser.uid,
      authorName: currentUser.name || currentUser.displayName || "User",
      authorRole: currentUser.role || "",
      authorSide: viewerRole || "reviewer",
    });
  };

  const handleStartRevision = (selectedComments) => {
    setRevisionDraft(selectedComments);
  };

  const handleSubmitRevision = async ({ file, reason }) => {
    await uploadRevision({
      documentId,
      requirementKey,
      file,
      reason,
      commentIds: revisionDraft.map((c) => c.id),
      userId: currentUser.uid,
    });
    setRevisionDraft(null);
    onRevisionUploaded?.();
    onClose?.();
  };

  return (
    <div className="modal-overlay doc-preview-overlay" onClick={onClose}>
      <div
        className={`modal-content doc-preview-content${commentingEnabled ? " has-comments" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header doc-preview-header">
          <h3 title={displayTitle}>
            {displayTitle}
            {fileVersion && fileVersion > 1 && (
              <span className="doc-preview-version-badge" title="This file has been revised">
                Revised v{fileVersion}
              </span>
            )}
          </h3>
          <div className="doc-preview-header-actions">
            {previousVersion?.fileUrl && (
              <a
                href={previousVersion.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="doc-preview-popout"
                title="Open the previous version in a new tab"
              >
                ↺ View previous (v{previousVersion.version || 1})
              </a>
            )}
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="doc-preview-popout"
              title="Open in new tab"
            >
              ↗ Open in new tab
            </a>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label="Close preview"
            >
              ×
            </button>
          </div>
        </div>

        <div className="doc-preview-body">
          {kind === "pdf" && (
            <PdfViewer
              key={fileUrl}
              fileUrl={fileUrl}
              onPageChange={setCurrentPage}
              renderOverlay={
                commentingEnabled
                  ? ({ pageNum, pageWidth, pageHeight }) => (
                      <PdfCommentLayer
                        pageNum={pageNum}
                        pageWidth={pageWidth}
                        pageHeight={pageHeight}
                        comments={comments}
                        activeCommentId={activeCommentId}
                        onSelectComment={setActiveCommentId}
                        drawingEnabled={drawingEnabled && !draftBox}
                        onCreateBox={handleCreateBox}
                      />
                    )
                  : undefined
              }
            />
          )}

          {kind === "image" && (
            <div className="doc-preview-image-wrap">
              <img
                src={fileUrl}
                alt={displayTitle}
                className="doc-preview-image"
              />
            </div>
          )}

          {kind === "other" && (
            <div className="doc-preview-fallback">
              <p>
                In-browser preview isn't available for this file type
                {fileName ? ` (${fileName})` : ""}.
              </p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="doc-preview-fallback-btn"
              >
                Open in new tab
              </a>
            </div>
          )}
        </div>

        {commentingEnabled && (
          <CommentThreadPanel
            comments={comments}
            pageNum={currentPage}
            drafting={draftBox}
            onCancelDraft={() => setDraftBox(null)}
            onSubmitDraft={handleSubmitDraft}
            onResolveToggle={handleResolveToggle}
            onDeleteComment={handleDeleteComment}
            onAddReply={handleAddReply}
            onUploadRevision={handleStartRevision}
            onStartDrawing={() => {
              setDraftBox(null);
              setDrawingEnabled((d) => !d);
            }}
            drawingEnabled={drawingEnabled}
            activeCommentId={activeCommentId}
            onSelectComment={setActiveCommentId}
            currentUser={currentUser}
            viewerRole={viewerRole}
          />
        )}
      </div>

      {revisionDraft && (
        <RevisionUploadModal
          currentFileName={fileName || "current file"}
          selectedComments={revisionDraft}
          onCancel={() => setRevisionDraft(null)}
          onSubmit={handleSubmitRevision}
        />
      )}
    </div>
  );
}
