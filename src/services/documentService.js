import { 
  collection, 
  doc, 
  addDoc,
  getDoc, 
  getDocs, 
  updateDoc,
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  Timestamp,
  writeBatch,
  limit as queryLimit
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../config/firebase";
import { getUserById } from "./userService";

/**
 * Document Service
 * 
 * Handles all document management operations including:
 * - Document submission by organization officers
 * - Document retrieval and filtering
 * - Admin document management (status updates, assignment)
 * - Status history tracking
 * - File uploads to Firebase Storage
 */

/**
 * Submit a new document (Organization Officer)
 * @param {Object} documentData - Document data
 * @param {string} documentData.organizationId - Organization ID
 * @param {string} documentData.documentType - Document type code
 * @param {string} documentData.direction - "incoming" | "outgoing"
 * @param {string} documentData.title - Document title
 * @param {string} documentData.description - Optional description
 * @param {File} file - File to upload
 * @param {string} userId - User ID of the submitter
 * @returns {Promise<Object>} Created document with documentId
 */
export const submitDocument = async (documentData, file, userId) => {
  try {
    // Validate user is verified officer
    const user = await getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    if (user.verificationStatus !== "verified") {
      throw new Error("You must be a verified officer to submit documents");
    }
    
    if (user.organizationId !== documentData.organizationId) {
      throw new Error("You can only submit documents for your organization");
    }

    // Validate file
    if (!file) {
      throw new Error("File is required");
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Invalid file type. Please upload a PDF or Word document (.pdf, .doc, .docx)");
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new Error("File size exceeds 50MB limit. Please upload a smaller file.");
    }

    // Validate required fields
    if (!documentData.title || documentData.title.trim().length === 0) {
      throw new Error("Document title is required");
    }
    
    if (documentData.title.length > 200) {
      throw new Error("Document title must be 200 characters or less");
    }

    if (documentData.description && documentData.description.length > 1000) {
      throw new Error("Description must be 1000 characters or less");
    }

    // Create document record first (to get documentId)
    const documentsRef = collection(db, "documents");
    const documentRef = doc(documentsRef);
    const documentId = documentRef.id;

    // Upload file to Firebase Storage
    const timestamp = Date.now();
    const fileName = `${documentId}_${timestamp}_${file.name}`;
    const storageRef = ref(storage, `documents/${documentId}/${fileName}`);
    
    const metadata = {
      contentType: file.type,
      customMetadata: {
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
        originalFileName: file.name,
        documentId: documentId
      }
    };

    const uploadSnapshot = await uploadBytes(storageRef, file, metadata);
    const fileUrl = await getDownloadURL(uploadSnapshot.ref);

    // Create document with batch write (document + status history)
    const batch = writeBatch(db);

    // Create document
    batch.set(documentRef, {
      documentId: documentId,
      documentNumber: null, // Will be assigned by admin
      organizationId: documentData.organizationId,
      submittedBy: userId,
      documentType: documentData.documentType,
      direction: documentData.direction || "incoming",
      title: documentData.title.trim(),
      description: documentData.description?.trim() || "",
      fileUrl: fileUrl,
      fileName: file.name,
      fileSize: file.size,
      status: "pending",
      remarks: "",
      assignedTo: null,
      dateSubmitted: serverTimestamp(),
      dateAssigned: null,
      dateReviewed: null,
      dateReleased: null,
      lastUpdated: serverTimestamp(),
      createdBy: userId,
      updatedBy: userId
    });

    // Create initial status history entry
    const historyRef = doc(collection(db, "documentStatusHistory"));
    batch.set(historyRef, {
      documentId: documentId,
      status: "pending",
      previousStatus: null,
      changedBy: userId,
      remarks: "Document submitted",
      timestamp: serverTimestamp()
    });

    await batch.commit();

    console.log(`Document ${documentId} submitted successfully`);
    
    return {
      documentId: documentId,
      documentNumber: null,
      status: "pending"
    };
  } catch (error) {
    console.error("Error submitting document:", error);
    throw error;
  }
};

/**
 * Get documents by organization
 * @param {string} organizationId - Organization ID
 * @param {Object} filters - Optional filters
 * @param {string} filters.status - Filter by status
 * @param {string} filters.documentType - Filter by document type
 * @param {Date} filters.dateFrom - Filter from date
 * @param {Date} filters.dateTo - Filter to date
 * @param {string} filters.direction - Filter by direction
 * @returns {Promise<Array>} Array of documents
 */
export const getDocumentsByOrganization = async (organizationId, filters = {}) => {
  try {
    const documentsRef = collection(db, "documents");
    let q = query(documentsRef, where("organizationId", "==", organizationId));

    // Apply filters
    if (filters.status) {
      q = query(q, where("status", "==", filters.status));
    }
    
    if (filters.documentType) {
      q = query(q, where("documentType", "==", filters.documentType));
    }
    
    if (filters.direction) {
      q = query(q, where("direction", "==", filters.direction));
    }
    
    if (filters.dateFrom) {
      const fromTimestamp = Timestamp.fromDate(filters.dateFrom);
      q = query(q, where("dateSubmitted", ">=", fromTimestamp));
    }
    
    if (filters.dateTo) {
      const toTimestamp = Timestamp.fromDate(filters.dateTo);
      q = query(q, where("dateSubmitted", "<=", toTimestamp));
    }

    // Order by date submitted (newest first)
    q = query(q, orderBy("dateSubmitted", "desc"));

    const querySnapshot = await getDocs(q);
    const documents = [];
    
    querySnapshot.forEach((docSnapshot) => {
      documents.push({
        documentId: docSnapshot.id,
        ...docSnapshot.data()
      });
    });

    return documents;
  } catch (error) {
    console.error("Error fetching documents:", error);
    throw error;
  }
};

/**
 * Get document by ID
 * @param {string} documentId - Document ID
 * @returns {Promise<Object|null>} Document object or null
 */
export const getDocumentById = async (documentId) => {
  try {
    const documentRef = doc(db, "documents", documentId);
    const documentSnapshot = await getDoc(documentRef);
    
    if (documentSnapshot.exists()) {
      return {
        documentId: documentSnapshot.id,
        ...documentSnapshot.data()
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching document:", error);
    throw error;
  }
};

/**
 * Assign document number (Admin only)
 * @param {string} documentId - Document ID
 * @param {string} documentNumber - Document number to assign (e.g., "DOC-2024-001")
 * @param {string} adminId - Admin user ID
 * @returns {Promise<void>}
 */
export const assignDocumentNumber = async (documentId, documentNumber, adminId) => {
  try {
    const documentRef = doc(db, "documents", documentId);
    const documentSnapshot = await getDoc(documentRef);
    
    if (!documentSnapshot.exists()) {
      throw new Error("Document not found");
    }

    const documentData = documentSnapshot.data();
    
    // Check if document number already assigned
    if (documentData.documentNumber) {
      throw new Error("Document number already assigned");
    }

    // Check if document is in pending status
    if (documentData.status !== "pending") {
      throw new Error(`Cannot assign document number. Document status is: ${documentData.status}`);
    }

    // Check for duplicate document number
    const documentsRef = collection(db, "documents");
    const duplicateQuery = query(
      documentsRef,
      where("documentNumber", "==", documentNumber),
      queryLimit(1)
    );
    const duplicateSnapshot = await getDocs(duplicateQuery);
    
    if (!duplicateSnapshot.empty) {
      throw new Error("Document number already exists. Please use a different number.");
    }

    // Use batch to update document and create history
    const batch = writeBatch(db);

    // Update document
    batch.update(documentRef, {
      documentNumber: documentNumber,
      status: "under_review",
      assignedTo: adminId,
      dateAssigned: serverTimestamp(),
      lastUpdated: serverTimestamp(),
      updatedBy: adminId
    });

    // Create status history entry
    const historyRef = doc(collection(db, "documentStatusHistory"));
    batch.set(historyRef, {
      documentId: documentId,
      status: "under_review",
      previousStatus: "pending",
      changedBy: adminId,
      remarks: `Document number assigned: ${documentNumber}`,
      timestamp: serverTimestamp()
    });

    await batch.commit();
    
    console.log(`Document number ${documentNumber} assigned to document ${documentId}`);
  } catch (error) {
    console.error("Error assigning document number:", error);
    throw error;
  }
};

/**
 * Update document status (Admin only)
 * @param {string} documentId - Document ID
 * @param {string} newStatus - New status
 * @param {string} remarks - Optional remarks
 * @param {string} adminId - Admin user ID
 * @returns {Promise<void>}
 */
export const updateDocumentStatus = async (documentId, newStatus, remarks, adminId) => {
  try {
    // Validate status
    const validStatuses = ["pending", "under_review", "approved", "returned", "rejected", "released"];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    const documentRef = doc(db, "documents", documentId);
    const documentSnapshot = await getDoc(documentRef);
    
    if (!documentSnapshot.exists()) {
      throw new Error("Document not found");
    }

    const documentData = documentSnapshot.data();
    const previousStatus = documentData.status;

    // Validate status transition
    if (newStatus === previousStatus) {
      throw new Error("Document is already in this status");
    }

    // Cannot change status if document is released
    if (documentData.status === "released") {
      throw new Error("Cannot change status of a released document");
    }

    // Use batch to update document and create history
    const batch = writeBatch(db);

    const updateData = {
      status: newStatus,
      remarks: remarks || "",
      lastUpdated: serverTimestamp(),
      updatedBy: adminId
    };

    // Set dateReviewed if transitioning to approved/rejected/returned
    if (newStatus === "approved" || newStatus === "rejected" || newStatus === "returned") {
      if (!documentData.dateReviewed) {
        updateData.dateReviewed = serverTimestamp();
      }
    }

    batch.update(documentRef, updateData);

    // Create status history entry
    const historyRef = doc(collection(db, "documentStatusHistory"));
    batch.set(historyRef, {
      documentId: documentId,
      status: newStatus,
      previousStatus: previousStatus,
      changedBy: adminId,
      remarks: remarks || "",
      timestamp: serverTimestamp()
    });

    await batch.commit();
    
    console.log(`Document ${documentId} status updated from ${previousStatus} to ${newStatus}`);
  } catch (error) {
    console.error("Error updating document status:", error);
    throw error;
  }
};

/**
 * Release document (Admin only)
 * Marks document as released and makes it read-only
 * @param {string} documentId - Document ID
 * @param {string} adminId - Admin user ID
 * @returns {Promise<void>}
 */
export const releaseDocument = async (documentId, adminId) => {
  try {
    const documentRef = doc(db, "documents", documentId);
    const documentSnapshot = await getDoc(documentRef);
    
    if (!documentSnapshot.exists()) {
      throw new Error("Document not found");
    }

    const documentData = documentSnapshot.data();
    
    // Can only release documents that are approved
    if (documentData.status !== "approved") {
      throw new Error(`Cannot release document. Current status is: ${documentData.status}. Document must be approved first.`);
    }

    // Use batch to update document and create history
    const batch = writeBatch(db);

    // Update document
    batch.update(documentRef, {
      status: "released",
      dateReleased: serverTimestamp(),
      lastUpdated: serverTimestamp(),
      updatedBy: adminId
    });

    // Create status history entry
    const historyRef = doc(collection(db, "documentStatusHistory"));
    batch.set(historyRef, {
      documentId: documentId,
      status: "released",
      previousStatus: documentData.status,
      changedBy: adminId,
      remarks: "Document released",
      timestamp: serverTimestamp()
    });

    await batch.commit();
    
    console.log(`Document ${documentId} released successfully`);
  } catch (error) {
    console.error("Error releasing document:", error);
    throw error;
  }
};

/**
 * Search documents with filters
 * @param {Object} filters - Search filters
 * @param {string} filters.organizationId - Optional organization ID
 * @param {string} filters.documentType - Optional document type
 * @param {string} filters.status - Optional status
 * @param {Date} filters.dateFrom - Optional from date
 * @param {Date} filters.dateTo - Optional to date
 * @param {string} filters.direction - Optional direction
 * @param {string} filters.searchTerm - Optional search term (searches title and description)
 * @returns {Promise<Array>} Array of matching documents
 */
export const searchDocuments = async (filters = {}) => {
  try {
    const documentsRef = collection(db, "documents");
    let q = query(documentsRef);

    // Apply filters
    if (filters.organizationId) {
      q = query(q, where("organizationId", "==", filters.organizationId));
    }
    
    if (filters.status) {
      q = query(q, where("status", "==", filters.status));
    }
    
    if (filters.documentType) {
      q = query(q, where("documentType", "==", filters.documentType));
    }
    
    if (filters.direction) {
      q = query(q, where("direction", "==", filters.direction));
    }
    
    if (filters.dateFrom) {
      const fromTimestamp = Timestamp.fromDate(filters.dateFrom);
      q = query(q, where("dateSubmitted", ">=", fromTimestamp));
    }
    
    if (filters.dateTo) {
      const toTimestamp = Timestamp.fromDate(filters.dateTo);
      q = query(q, where("dateSubmitted", "<=", toTimestamp));
    }

    // Order by date submitted (newest first)
    q = query(q, orderBy("dateSubmitted", "desc"));

    const querySnapshot = await getDocs(q);
    const documents = [];
    
    querySnapshot.forEach((docSnapshot) => {
      const docData = {
        documentId: docSnapshot.id,
        ...docSnapshot.data()
      };

      // Filter by search term if provided (client-side filtering)
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const titleMatch = docData.title?.toLowerCase().includes(searchLower);
        const descMatch = docData.description?.toLowerCase().includes(searchLower);
        const docNumMatch = docData.documentNumber?.toLowerCase().includes(searchLower);
        
        if (titleMatch || descMatch || docNumMatch) {
          documents.push(docData);
        }
      } else {
        documents.push(docData);
      }
    });

    return documents;
  } catch (error) {
    console.error("Error searching documents:", error);
    throw error;
  }
};

/**
 * Get document status history
 * @param {string} documentId - Document ID
 * @returns {Promise<Array>} Array of status history entries
 */
export const getDocumentStatusHistory = async (documentId) => {
  try {
    const historyRef = collection(db, "documentStatusHistory");
    const q = query(
      historyRef,
      where("documentId", "==", documentId),
      orderBy("timestamp", "asc")
    );

    const querySnapshot = await getDocs(q);
    const history = [];
    
    querySnapshot.forEach((docSnapshot) => {
      history.push({
        historyId: docSnapshot.id,
        ...docSnapshot.data()
      });
    });

    return history;
  } catch (error) {
    console.error("Error fetching document status history:", error);
    throw error;
  }
};

/**
 * Get all pending documents (Admin)
 * @returns {Promise<Array>} Array of pending documents
 */
export const getPendingDocuments = async () => {
  try {
    return await searchDocuments({ status: "pending" });
  } catch (error) {
    console.error("Error fetching pending documents:", error);
    throw error;
  }
};

/**
 * Get documents by status (Admin)
 * @param {string} status - Document status
 * @returns {Promise<Array>} Array of documents with the specified status
 */
export const getDocumentsByStatus = async (status) => {
  try {
    return await searchDocuments({ status });
  } catch (error) {
    console.error("Error fetching documents by status:", error);
    throw error;
  }
};

/**
 * Get released outgoing documents (Memorandums and Announcements)
 * @param {number} limit - Optional limit on number of documents to return
 * @returns {Promise<Array>} Array of released outgoing documents
 */
export const getReleasedOutgoingDocuments = async (limit = null) => {
  try {
    // Fetch all outgoing documents with approved or released status
    // Then filter for Memorandum and Announcement types
    const documentsRef = collection(db, "documents");
    
    // Try to query with status filter first
    let documents = [];
    
    try {
      // Query for approved outgoing documents
      let qApproved = query(
        documentsRef,
        where("direction", "==", "outgoing"),
        where("status", "==", "approved"),
        orderBy("dateSubmitted", "desc")
      );
      
      const approvedSnapshot = await getDocs(qApproved);
      approvedSnapshot.forEach((docSnapshot) => {
        const docData = {
          documentId: docSnapshot.id,
          ...docSnapshot.data()
        };
        if (docData.documentType === "Memorandum" || docData.documentType === "Announcement") {
          documents.push(docData);
        }
      });
    } catch (error) {
      console.warn("Could not query approved documents:", error);
    }
    
    try {
      // Query for released outgoing documents
      let qReleased = query(
        documentsRef,
        where("direction", "==", "outgoing"),
        where("status", "==", "released"),
        orderBy("dateSubmitted", "desc")
      );
      
      const releasedSnapshot = await getDocs(qReleased);
      releasedSnapshot.forEach((docSnapshot) => {
        const docData = {
          documentId: docSnapshot.id,
          ...docSnapshot.data()
        };
        if (docData.documentType === "Memorandum" || docData.documentType === "Announcement") {
          // Avoid duplicates
          if (!documents.find(doc => doc.documentId === docData.documentId)) {
            documents.push(docData);
          }
        }
      });
    } catch (error) {
      console.warn("Could not query released documents:", error);
    }
    
    // Sort by dateSubmitted descending
    documents.sort((a, b) => {
      const dateA = a.dateSubmitted?.toDate?.() || new Date(0);
      const dateB = b.dateSubmitted?.toDate?.() || new Date(0);
      return dateB - dateA;
    });
    
    // Apply limit if specified
    if (limit && documents.length > limit) {
      return documents.slice(0, limit);
    }
    
    return documents;
  } catch (error) {
    console.error("Error fetching released outgoing documents:", error);
    return [];
  }
};

/**
 * Create outgoing document (Admin only)
 * @param {Object} documentData - Document data
 * @param {string} documentData.documentType - Document type ("Memorandum", "Announcement", "Other")
 * @param {string} documentData.title - Document title/subject
 * @param {string} documentData.description - Document description
 * @param {string} documentData.orderNumber - Order number (required for Memorandum)
 * @param {File|null} file - Optional file to upload
 * @param {string} adminId - Admin user ID
 * @returns {Promise<Object>} Created document with documentId
 */
export const createOutgoingDocument = async (documentData, file, adminId) => {
  try {
    // Validate required fields
    if (!documentData.documentType) {
      throw new Error("Document type is required");
    }

    if (!documentData.title || documentData.title.trim().length === 0) {
      throw new Error("Subject/Title is required");
    }

    if (documentData.title.length > 200) {
      throw new Error("Subject/Title must be 200 characters or less");
    }

    if (!documentData.description || documentData.description.trim().length === 0) {
      throw new Error("Description is required");
    }

    if (documentData.description.length > 1000) {
      throw new Error("Description must be 1000 characters or less");
    }

    // Validate Memorandum-specific fields
    if (documentData.documentType === "Memorandum") {
      if (!documentData.orderNumber || documentData.orderNumber.trim().length === 0) {
        throw new Error("Order Number is required for Memorandum");
      }
      if (!file) {
        throw new Error("File upload is required for Memorandum");
      }
    }

    // Create document record first (to get documentId for file upload)
    const documentsRef = collection(db, "documents");
    const documentRef = doc(documentsRef);
    const documentId = documentRef.id;

    // Validate file if provided
    let fileUrl = null;
    let fileName = null;
    let fileSize = null;

    if (file) {
      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp"
      ];
      
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Invalid file type. Please upload a PDF, Word document, or image file");
      }

      // Validate file size (max 50MB)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        throw new Error("File size exceeds 50MB limit. Please upload a smaller file.");
      }

      // Upload file to Firebase Storage
      const timestamp = Date.now();
      fileName = `${documentId}_${timestamp}_${file.name}`;
      const storageRef = ref(storage, `documents/${documentId}/${fileName}`);
      
      const metadata = {
        contentType: file.type,
        customMetadata: {
          uploadedBy: adminId,
          uploadedAt: new Date().toISOString(),
          originalFileName: file.name,
          documentId: documentId
        }
      };

      const uploadSnapshot = await uploadBytes(storageRef, file, metadata);
      fileUrl = await getDownloadURL(uploadSnapshot.ref);
      fileSize = file.size;
    }

    // Use batch to create document and status history
    const batch = writeBatch(db);

    // Create document
    const docData = {
      documentId: documentId,
      documentNumber: documentData.orderNumber || null,
      organizationId: null, // Admin-created documents don't belong to an organization
      submittedBy: adminId,
      documentType: documentData.documentType,
      direction: "outgoing",
      title: documentData.title.trim(),
      description: documentData.description.trim(),
      status: "approved", // Admin-created documents are automatically approved
      remarks: "",
      assignedTo: adminId,
      dateSubmitted: serverTimestamp(),
      dateAssigned: serverTimestamp(),
      dateReviewed: serverTimestamp(),
      dateReleased: null,
      lastUpdated: serverTimestamp(),
      createdBy: adminId,
      updatedBy: adminId
    };

    if (fileUrl) {
      docData.fileUrl = fileUrl;
      docData.fileName = fileName;
      docData.fileSize = fileSize;
    }

    batch.set(documentRef, docData);

    // Create status history entry
    const historyRef = doc(collection(db, "documentStatusHistory"));
    batch.set(historyRef, {
      documentId: documentId,
      status: "approved",
      previousStatus: null,
      changedBy: adminId,
      remarks: "Document created by admin",
      timestamp: serverTimestamp()
    });

    await batch.commit();

    console.log(`Outgoing document ${documentId} created successfully`);
    
    return {
      documentId: documentId,
      documentNumber: documentData.orderNumber || null,
      status: "approved"
    };
  } catch (error) {
    console.error("Error creating outgoing document:", error);
    throw error;
  }
};

