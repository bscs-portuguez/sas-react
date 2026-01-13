import { useState } from "react";
import { auth } from "../config/firebase";
import { uploadVerificationDocument } from "../services/storageService";
import { submitVerificationDocument } from "../services/userService";
import "../styles/colors.css";
import "./VerificationUpload.css";

const VerificationUpload = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setError("");
    setFile(selectedFile);

    // Create preview for images
    if (selectedFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setError("You must be logged in to upload documents.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // Upload file to Firebase Storage
      const documentUrl = await uploadVerificationDocument(file, user.uid);
      
      // Update user document with verification status
      await submitVerificationDocument(user.uid, documentUrl);
      
      // Success - notify parent component
      if (onUploadSuccess) {
        onUploadSuccess();
      }
      
      // Reset form
      setFile(null);
      setPreview(null);
      const fileInput = document.getElementById("verification-file-input");
      if (fileInput) {
        fileInput.value = "";
      }
      
      alert("Verification document uploaded successfully! Your account is now under review by SAS.");
    } catch (err) {
      console.error("Error uploading verification document:", err);
      
      // Provide user-friendly error messages
      let errorMessage = err.message || "Failed to upload document. Please try again.";
      
      if (err.message.includes("CORS") || err.message.includes("preflight") || err.message.includes("Storage rules")) {
        errorMessage = "Upload failed due to storage configuration. Please ensure Firebase Storage rules are set up correctly. See FIREBASE_STORAGE_SETUP.md for instructions.";
      }
      
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="verification-upload">
      <div className="verification-upload-header">
        <h3 className="verification-upload-title">Upload Verification Document</h3>
        <p className="verification-upload-description">
          Please upload a document that proves your affiliation with your organization. 
          This could be an ID card, membership certificate, authorization letter, or any official document.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="verification-upload-form">
        <div className="verification-upload-input-group">
          <label htmlFor="verification-file-input" className="verification-upload-label">
            <span className="verification-upload-label-text">Select Document</span>
            <span className="verification-upload-label-hint">
              (PDF, JPG, PNG, or WEBP - Max 10MB)
            </span>
          </label>
          <input
            id="verification-file-input"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleFileChange}
            className="verification-upload-input"
            disabled={uploading}
          />
        </div>

        {file && (
          <div className="verification-upload-file-info">
            <div className="verification-upload-file-details">
              <span className="verification-upload-file-name">📄 {file.name}</span>
              <span className="verification-upload-file-size">{formatFileSize(file.size)}</span>
            </div>
            {preview && (
              <div className="verification-upload-preview">
                <img src={preview} alt="Preview" />
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="verification-upload-error">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          className="verification-upload-submit"
          disabled={!file || uploading}
        >
          {uploading ? "Uploading..." : "Submit for Verification"}
        </button>
      </form>
    </div>
  );
};

export default VerificationUpload;

