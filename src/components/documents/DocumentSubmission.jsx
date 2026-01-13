import { useState, useEffect } from "react";
import { auth } from "../../config/firebase";
import { getUserById } from "../../services/userService";
import { submitDocument } from "../../services/documentService";
import "../../styles/colors.css";
import "./DocumentSubmission.css";

const DocumentSubmission = ({ onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  // Student Officer document types (hardcoded as per requirements)
  const documentTypes = [
    { code: "activity_proposal", name: "Activity Proposal" },
    { code: "accomplishment_report", name: "Accomplishment Report" },
    { code: "financial_report", name: "Financial Report" },
    { code: "financial_statement", name: "Financial Statement" },
    { code: "compliance_document", name: "Compliance Document" },
    { code: "other", name: "Other" }
  ];
  const [formData, setFormData] = useState({
    documentType: "",
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
      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ];
      
      if (!allowedTypes.includes(file.type)) {
        setError("Invalid file type. Please upload a PDF or Word document (.pdf, .doc, .docx)");
        return;
      }

      // Validate file size (50MB)
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
      // Validate form
      if (!formData.documentType) {
        throw new Error("Please select a document type");
      }
      if (!formData.title.trim()) {
        throw new Error("Please enter a document title");
      }
      if (formData.title.length > 200) {
        throw new Error("Title must be 200 characters or less");
      }
      // Description is now required
      if (!formData.description.trim()) {
        throw new Error("Please enter a document description");
      }
      if (formData.description.length > 1000) {
        throw new Error("Description must be 1000 characters or less");
      }
      // If "Other" is selected, require more detailed description
      if (formData.documentType === "other" && formData.description.trim().length < 20) {
        throw new Error("Please provide a detailed description (at least 20 characters) when selecting 'Other'");
      }
      if (!formData.file) {
        throw new Error("Please select a file to upload");
      }

      if (!userData || !userData.organizationId) {
        throw new Error("User organization not found");
      }

      // Submit document - direction is always "incoming" for student officers
      const result = await submitDocument(
        {
          organizationId: userData.organizationId,
          documentType: formData.documentType,
          direction: "incoming", // Always incoming for student submissions
          title: formData.title.trim(),
          description: formData.description.trim()
        },
        formData.file,
        auth.currentUser.uid
      );

      // Success
      if (onSuccess) {
        onSuccess(result);
      }

      // Reset form
      setFormData({
        documentType: "",
        title: "",
        description: "",
        file: null
      });
      setFilePreview(null);
    } catch (error) {
      console.error("Error submitting document:", error);
      setError(error.message || "Failed to submit document. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!userData) {
    return <div className="document-submission-loading">Loading...</div>;
  }

  return (
    <div className="document-submission">
      <div className="document-submission-header">
        <div>
          <h2 className="document-submission-title">Submit Document</h2>
          <p className="document-submission-subtitle">
            Submit documents for SAS review and processing. All submissions are automatically marked as incoming documents.
          </p>
        </div>
        {onCancel && (
          <button className="document-submission-cancel" onClick={onCancel}>
            ×
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="document-submission-form">
        <div className="form-group">
          <label htmlFor="documentType" className="form-label">
            Document Type <span className="required">*</span>
          </label>
          <select
            id="documentType"
            className="form-input form-select"
            value={formData.documentType}
            onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
            required
            disabled={loading}
          >
            <option value="">Select document type</option>
            {documentTypes.map((type) => (
              <option key={type.code} value={type.code}>
                {type.name}
              </option>
            ))}
          </select>
          {formData.documentType === "other" && (
            <span className="form-hint form-hint-warning">
              ⚠️ Please provide a detailed description when selecting "Other"
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="title" className="form-label">
            Document Title <span className="required">*</span>
          </label>
          <input
            id="title"
            type="text"
            className="form-input"
            placeholder="Enter document title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            maxLength={200}
            required
            disabled={loading}
          />
          <span className="form-hint">{formData.title.length}/200 characters</span>
        </div>

        <div className="form-group">
          <label htmlFor="description" className="form-label">
            Description <span className="required">*</span>
          </label>
          <textarea
            id="description"
            className="form-input form-textarea"
            placeholder={formData.documentType === "other" 
              ? "Please provide a detailed description of this document (minimum 20 characters required)"
              : "Enter document description"}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            maxLength={1000}
            rows={4}
            required
            disabled={loading}
          />
          <span className="form-hint">
            {formData.description.length}/1000 characters
            {formData.documentType === "other" && formData.description.length < 20 && (
              <span className="form-hint-warning"> (Minimum 20 characters required for "Other")</span>
            )}
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="file" className="form-label">
            File <span className="required">*</span>
          </label>
          <div className="file-upload-wrapper">
            <input
              id="file"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              disabled={loading}
              className="file-input"
            />
            <label htmlFor="file" className="file-label">
              {filePreview || "Choose file (PDF, DOC, DOCX - Max 50MB)"}
            </label>
          </div>
          {filePreview && (
            <div className="file-preview">
              <span className="file-preview-icon">📄</span>
              <span className="file-preview-name">{filePreview}</span>
              <button
                type="button"
                className="file-preview-remove"
                onClick={() => {
                  setFormData({ ...formData, file: null });
                  setFilePreview(null);
                }}
              >
                ×
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="form-actions">
          {onCancel && (
            <button
              type="button"
              className="form-button form-button-secondary"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="form-button form-button-primary"
            disabled={loading}
          >
            {loading ? "Submitting..." : "Submit Document"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DocumentSubmission;

