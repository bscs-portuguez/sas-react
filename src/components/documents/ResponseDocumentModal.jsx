import { useState, useMemo } from "react";
import { auth } from "../../config/firebase";
import { getResponseTemplate, getResponseTypeForIncoming } from "../../services/documentService";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../config/firebase";
import "../../styles/colors.css";
import "./ResponseDocumentModal.css";

const ResponseDocumentModal = ({
  incomingDocument,
  onSubmit,
  onCancel,
  isProcessing
}) => {
  const responseType = useMemo(
    () => incomingDocument ? getResponseTypeForIncoming(incomingDocument.documentType) : null,
    [incomingDocument]
  );

  const [formData, setFormData] = useState(() => {
    if (!incomingDocument || !responseType) {
      return { subject: "", description: "", orderNumber: "", remarks: "", file: null };
    }
    const template = getResponseTemplate(incomingDocument, responseType.type);
    return { subject: template.subject, description: template.description, orderNumber: "", remarks: "", file: null };
  });
  const [filePreview, setFilePreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
      setErrors(prev => ({ ...prev, file: "Invalid file type. Please upload PDF, Word, JPG, PNG, or WEBP" }));
      return;
    }

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, file: "File size exceeds 50MB limit" }));
      return;
    }

    setFormData(prev => ({ ...prev, file }));
    setFilePreview(file.name);
    setErrors(prev => ({ ...prev, file: null }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.subject.trim()) {
      newErrors.subject = "Subject is required";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }

    if (responseType?.type === "approval_memorandum" && !formData.orderNumber.trim()) {
      newErrors.orderNumber = "Order number is required for approval memorandums";
    }

    if (responseType?.type === "approval_memorandum" && !formData.file) {
      newErrors.file = "File upload is required for approval memorandums";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadFile = async (file, documentId) => {
    const timestamp = Date.now();
    const fileName = `${documentId}_${timestamp}_${file.name}`;
    const storageRef = ref(storage, `documents/${documentId}/${fileName}`);

    const metadata = {
      contentType: file.type,
      customMetadata: {
        uploadedBy: auth.currentUser?.uid || "unknown",
        uploadedAt: new Date().toISOString(),
        originalFileName: file.name,
        documentId: documentId
      }
    };

    const uploadSnapshot = await uploadBytes(storageRef, file, metadata);
    const fileUrl = await getDownloadURL(uploadSnapshot.ref);

    return {
      fileUrl,
      fileName: file.name,
      fileSize: file.size
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setErrors({});
    setUploadProgress(0);

    try {
      let fileData = {};

      // Upload file if provided
      if (formData.file) {
        setUploadProgress(50);
        // Generate a temporary ID for file upload path
        const tempId = `temp_${Date.now()}`;
        fileData = await uploadFile(formData.file, tempId);
        setUploadProgress(100);
      }

      const responseData = {
        responseType: responseType?.type || "generic_response",
        subject: formData.subject.trim(),
        description: formData.description.trim(),
        orderNumber: formData.orderNumber.trim() || null,
        remarks: formData.remarks.trim(),
        ...fileData
      };

      onSubmit(responseData);
    } catch (error) {
      console.error("Error preparing response document:", error);
      setErrors({ submit: error.message || "Failed to prepare document" });
      setUploadProgress(0);
    }
  };

  const formatDocumentType = (type) => {
    if (!type) return "Document";
    return type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="modal-overlay" onClick={!isProcessing ? onCancel : undefined}>
      <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Generate Response Document</h3>
          {!isProcessing && (
            <button className="modal-close" onClick={onCancel}>×</button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Response Type Info */}
            <div className="response-type-banner">
              <div className="response-type-label">
                <span className="label">Response Type:</span>
                <span className="value">{responseType?.label || "Generic Response"}</span>
              </div>
              <div className="incoming-ref">
                <span className="label">In Response To:</span>
                <span className="value">{formatDocumentType(incomingDocument?.documentType)}: {incomingDocument?.title}</span>
              </div>
            </div>

            {errors.submit && (
              <div className="form-error">{errors.submit}</div>
            )}

            {/* Order Number (for approval memorandums) */}
            {responseType?.type === "approval_memorandum" && (
              <div className="form-group">
                <label htmlFor="orderNumber" className="form-label">
                  Order Number <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="orderNumber"
                  className={`form-input ${errors.orderNumber ? "error" : ""}`}
                  value={formData.orderNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, orderNumber: e.target.value }))}
                  placeholder="e.g., MEMO-2024-001"
                  disabled={isProcessing}
                />
                {errors.orderNumber && <span className="field-error">{errors.orderNumber}</span>}
              </div>
            )}

            {/* Subject */}
            <div className="form-group">
              <label htmlFor="subject" className="form-label">
                Subject <span className="required">*</span>
              </label>
              <input
                type="text"
                id="subject"
                className={`form-input ${errors.subject ? "error" : ""}`}
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                maxLength={200}
                disabled={isProcessing}
              />
              <span className="form-hint">{formData.subject.length}/200 characters</span>
              {errors.subject && <span className="field-error">{errors.subject}</span>}
            </div>

            {/* Description */}
            <div className="form-group">
              <label htmlFor="description" className="form-label">
                Description <span className="required">*</span>
              </label>
              <textarea
                id="description"
                className={`form-input form-textarea ${errors.description ? "error" : ""}`}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={6}
                maxLength={1000}
                disabled={isProcessing}
              />
              <span className="form-hint">{formData.description.length}/1000 characters</span>
              {errors.description && <span className="field-error">{errors.description}</span>}
            </div>

            {/* File Upload */}
            <div className="form-group">
              <label htmlFor="file" className="form-label">
                Attach File {responseType?.type === "approval_memorandum" && <span className="required">*</span>}
              </label>
              <input
                type="file"
                id="file"
                className={`file-input ${errors.file ? "error" : ""}`}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                disabled={isProcessing}
              />
              <span className="form-hint">
                Accepted formats: PDF, Word, JPG, PNG, WEBP (Max 50MB)
                {responseType?.type === "approval_memorandum" && " - Required for approval memorandums"}
              </span>
              {filePreview && (
                <div className="file-preview">
                  <span className="file-icon">📄</span>
                  <span className="file-name">{filePreview}</span>
                  {!isProcessing && (
                    <button
                      type="button"
                      className="file-remove"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, file: null }));
                        setFilePreview(null);
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
              {errors.file && <span className="field-error">{errors.file}</span>}
            </div>

            {/* Remarks */}
            <div className="form-group">
              <label htmlFor="remarks" className="form-label">
                Internal Remarks (Optional)
              </label>
              <textarea
                id="remarks"
                className="form-input form-textarea"
                value={formData.remarks}
                onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                rows={2}
                maxLength={500}
                disabled={isProcessing}
                placeholder="Internal notes - not visible to organization"
              />
              <span className="form-hint">{formData.remarks.length}/500 characters</span>
            </div>

            {/* Upload Progress */}
            {isProcessing && uploadProgress > 0 && uploadProgress < 100 && (
              <div className="upload-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="progress-text">Uploading file... {uploadProgress}%</span>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <span className="spinner"></span>
                  Creating & Approving...
                </>
              ) : (
                "Create & Approve"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResponseDocumentModal;
