import { useState } from "react";
import "./RevisionUploadModal.css";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export default function RevisionUploadModal({
  currentFileName,
  selectedComments,
  onCancel,
  onSubmit,
}) {
  const initialReason = (selectedComments || [])
    .map((c, i) => `${i + 1}. ${c.text}`)
    .join("\n");

  const [file, setFile] = useState(null);
  const [reason, setReason] = useState(initialReason);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    setError("");
    if (!f) {
      setFile(null);
      return;
    }
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError("Invalid file type. Please upload PDF, Word, JPG, PNG, or WEBP.");
      setFile(null);
      return;
    }
    if (f.size > MAX_SIZE) {
      setError("File size exceeds 50MB limit.");
      setFile(null);
      return;
    }
    setFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Choose a revised file to upload.");
      return;
    }
    if (!reason.trim()) {
      setError("Reason for revision is required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({ file, reason: reason.trim() });
    } catch (err) {
      console.error("Revision upload failed:", err);
      setError(err?.message || "Failed to upload revision.");
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay revision-overlay" onClick={submitting ? undefined : onCancel}>
      <div
        className="modal-content revision-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Upload Revised Version</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onCancel}
            disabled={submitting}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="revision-form">
          <div className="revision-field">
            <label className="revision-label">Replacing</label>
            <div className="revision-current">{currentFileName}</div>
          </div>

          <div className="revision-field">
            <label className="revision-label">
              Resolving {selectedComments?.length || 0} comment{(selectedComments?.length || 0) === 1 ? "" : "s"}
            </label>
            <ul className="revision-comment-list">
              {(selectedComments || []).map((c) => (
                <li key={c.id}>
                  <span className="revision-comment-author">{c.authorName}:</span> {c.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="revision-field">
            <label className="revision-label" htmlFor="revision-file">New file</label>
            <input
              id="revision-file"
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
              disabled={submitting}
            />
            {file && (
              <div className="revision-file-meta">
                {file.name} • {(file.size / 1024).toFixed(1)} KB
              </div>
            )}
          </div>

          <div className="revision-field">
            <label className="revision-label" htmlFor="revision-reason">Reason for revision</label>
            <textarea
              id="revision-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={5}
              disabled={submitting}
              placeholder="Describe what was changed in this revision."
            />
            <div className="revision-hint">
              Pre-filled with the selected comment text — edit it to summarize what you actually changed.
            </div>
          </div>

          {error && <div className="revision-error">{error}</div>}

          <div className="revision-actions">
            <button type="button" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" disabled={submitting || !file || !reason.trim()}>
              {submitting ? "Uploading…" : "Upload & Resolve"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
