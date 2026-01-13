import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../config/firebase";
import { auth } from "../config/firebase";

/**
 * Upload a verification document to Firebase Storage
 * @param {File} file - The file to upload
 * @param {string} userId - User's Firebase Auth UID
 * @returns {Promise<string>} Download URL of the uploaded file
 */
export const uploadVerificationDocument = async (file, userId) => {
  try {
    // Ensure user is authenticated
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== userId) {
      throw new Error("You must be authenticated to upload documents.");
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/pdf",
      "image/webp"
    ];
    
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Invalid file type. Please upload a PDF, JPG, PNG, or WEBP file.");
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      throw new Error("File size exceeds 10MB limit. Please upload a smaller file.");
    }

    // Create storage reference
    const timestamp = Date.now();
    const fileName = `verification_${userId}_${timestamp}_${file.name}`;
    const storageRef = ref(storage, `verification-documents/${userId}/${fileName}`);

    // Upload file with metadata
    const metadata = {
      contentType: file.type,
      customMetadata: {
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
        originalFileName: file.name
      }
    };

    // Upload file
    const snapshot = await uploadBytes(storageRef, file, metadata);
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log("Verification document uploaded successfully:", downloadURL);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading verification document:", error);
    
    // Provide more helpful error messages
    if (error.code === "storage/unauthorized") {
      throw new Error("You don't have permission to upload files. Please contact support.");
    } else if (error.code === "storage/canceled") {
      throw new Error("Upload was canceled. Please try again.");
    } else if (error.code === "storage/unknown") {
      throw new Error("An unknown error occurred. Please check your Firebase Storage rules or try again.");
    } else if (error.message.includes("CORS") || error.message.includes("preflight")) {
      throw new Error("Storage upload failed. Please ensure Firebase Storage rules are configured correctly. See console for details.");
    }
    
    throw error;
  }
};

/**
 * Delete a verification document from Firebase Storage
 * @param {string} fileUrl - The download URL of the file to delete
 * @returns {Promise<void>}
 */
export const deleteVerificationDocument = async (fileUrl) => {
  try {
    // Extract the file path from the URL
    const urlParts = fileUrl.split("/");
    const fileName = urlParts[urlParts.length - 1].split("?")[0];
    const userId = urlParts[urlParts.length - 2];
    
    const storageRef = ref(storage, `verification-documents/${userId}/${fileName}`);
    await deleteObject(storageRef);
    
    console.log("Verification document deleted successfully");
  } catch (error) {
    console.error("Error deleting verification document:", error);
    throw error;
  }
};

