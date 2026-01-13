import { useState, useEffect } from "react";
import { auth } from "../../config/firebase";
import { getUserById } from "../../services/userService";
import { submitDocument } from "../../services/documentService";
import "../../styles/colors.css";
import "./ProposalSubmission.css";

const ProposalSubmission = ({ onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    file: null
  });
  const [error, setError] = useState("");
  const [filePreview, setFilePreview] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getUserById(user.uid);
        setUserData(userDoc);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load form data");
      }
    };

    fetchData();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ];
      
      if (!allowedTypes.includes(file.type)) {
        setError("Invalid file type. Please upload a PDF or Word document (.pdf, .doc, .docx)");
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        setError("File size exceeds 50MB limit. Please upload a smaller file.");
        return;
      }

      setFormData({ ...formData, file });
      setFilePreview(file.name);
      setError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!formData.title.trim()) {
        throw new Error("Please enter a proposal title");
      }
      if (formData.title.length > 200) {
        throw new Error("Title must be 200 characters or less");
      }
      if (!formData.description.trim()) {
        throw new Error("Please enter a proposal description");
      }
      if (formData.description.length > 1000) {
        throw new Error("Description must be 1000 characters or less");
      }
      if (!formData.file) {
        throw new Error("Please upload a proposal file");
      }

      const user = auth.currentUser;
      if (!user || !userData?.organizationId) {
        throw new Error("User or organization information not found");
      }

      const documentData = {
        documentType: "activity_proposal",
        title: formData.title.trim(),
        description: formData.description.trim(),
        direction: "incoming"
      };

      await submitDocument(documentData, formData.file, user.uid);

      // Reset form
      setFormData({
        title: "",
        description: "",
        file: null
      });
      setFilePreview(null);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error submitting proposal:", error);
      setError(error.message || "Failed to submit proposal. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="proposal-submission">
      <div className="proposal-submission-header">
        <h2>Submit New Activity Proposal</h2>
        {onCancel && (
          <button className="close-button" onClick={onCancel}>×</button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="proposal-submission-form">
        {error && (
          <div className="form-error">{error}</div>
        )}

        <div className="form-group">
          <label htmlFor="title" className="form-label">
            Proposal Title <span className="required">*</span>
          </label>
          <input
            type="text"
            id="title"
            className="form-input"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter proposal title"
            maxLength={200}
            required
          />
          <span className="form-hint">{formData.title.length}/200 characters</span>
        </div>

        <div className="form-group">
          <label htmlFor="description" className="form-label">
            Description <span className="required">*</span>
          </label>
          <textarea
            id="description"
            className="form-textarea"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe your activity proposal in detail..."
            rows={6}
            maxLength={1000}
            required
          />
          <span className="form-hint">{formData.description.length}/1000 characters</span>
        </div>

        <div className="form-group">
          <label htmlFor="file" className="form-label">
            Proposal File <span className="required">*</span>
          </label>
          <div className="file-upload-area">
            <input
              type="file"
              id="file"
              className="file-input"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              required
            />
            <label htmlFor="file" className="file-label">
              {filePreview ? (
                <span className="file-preview">📄 {filePreview}</span>
              ) : (
                <span className="file-placeholder">
                  <span className="file-icon">📎</span>
                  <span>Click to upload or drag and drop</span>
                  <span className="file-hint">PDF, DOC, DOCX (Max 50MB)</span>
                </span>
              )}
            </label>
            {filePreview && (
              <button
                type="button"
                className="file-remove"
                onClick={() => {
                  setFormData({ ...formData, file: null });
                  setFilePreview(null);
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="form-actions">
          {onCancel && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? "Submitting..." : "Submit Proposal"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProposalSubmission;

