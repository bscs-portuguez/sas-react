import { 
  collection, 
  doc, 
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Get all available equipment
 * @returns {Promise<Array>} Array of equipment items
 */
export const getAllEquipment = async () => {
  try {
    const equipmentRef = collection(db, "equipment");
    const q = query(
      equipmentRef,
      where("isActive", "==", true),
      orderBy("name", "asc")
    );
    
    const querySnapshot = await getDocs(q);
    const equipment = [];
    
    querySnapshot.forEach((doc) => {
      equipment.push({
        equipmentId: doc.id,
        ...doc.data()
      });
    });
    
    return equipment;
  } catch (error) {
    console.error("Error fetching equipment:", error);
    // Return empty array if collection doesn't exist yet
    return [];
  }
};

/**
 * Get equipment by ID
 * @param {string} equipmentId - Equipment ID
 * @returns {Promise<Object|null>} Equipment object or null
 */
export const getEquipmentById = async (equipmentId) => {
  try {
    const equipmentRef = doc(db, "equipment", equipmentId);
    const equipmentSnap = await getDoc(equipmentRef);
    
    if (equipmentSnap.exists()) {
      return {
        equipmentId: equipmentSnap.id,
        ...equipmentSnap.data()
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching equipment:", error);
    throw error;
  }
};

/**
 * Add new equipment (Admin only)
 * @param {Object} equipmentData - Equipment data
 * @param {string} equipmentData.name - Equipment name
 * @param {string} equipmentData.category - Equipment category
 * @param {number} equipmentData.totalQuantity - Total quantity
 * @param {string} equipmentData.condition - Equipment condition
 * @param {string} equipmentData.location - Equipment location
 * @param {string} adminId - Admin user ID
 * @returns {Promise<Object>} Created equipment with equipmentId
 */
export const addEquipment = async (equipmentData, adminId) => {
  try {
    const equipmentRef = collection(db, "equipment");
    
    const totalQty = equipmentData.totalQuantity || 0;
    const equipment = {
      name: equipmentData.name,
      category: equipmentData.category,
      totalQuantity: totalQty,
      availableQuantity: totalQty, // Initialize available quantity to total quantity
      condition: equipmentData.condition || null,
      location: equipmentData.location || null,
      description: equipmentData.description || null,
      specifications: equipmentData.specifications || null,
      isActive: true,
      dateAdded: serverTimestamp(),
      addedBy: adminId,
      lastUpdated: serverTimestamp()
    };
    
    const docRef = await addDoc(equipmentRef, equipment);
    
    return {
      equipmentId: docRef.id,
      ...equipment
    };
  } catch (error) {
    console.error("Error adding equipment:", error);
    throw error;
  }
};

/**
 * Update equipment (Admin only)
 * @param {string} equipmentId - Equipment ID
 * @param {Object} equipmentData - Updated equipment data
 * @param {string} adminId - Admin user ID
 * @returns {Promise<void>}
 */
export const updateEquipment = async (equipmentId, equipmentData, adminId) => {
  try {
    const equipmentRef = doc(db, "equipment", equipmentId);
    const equipmentSnap = await getDoc(equipmentRef);
    
    if (!equipmentSnap.exists()) {
      throw new Error("Equipment not found");
    }
    
    const totalQuantity = equipmentData.totalQuantity || 0;
    
    // If quantity is set to 0, delete the equipment from Firestore
    if (totalQuantity === 0) {
      // Check if equipment is currently borrowed
      const availability = await calculateAvailability(equipmentId);
      if (availability.borrowed > 0) {
        throw new Error(`Cannot delete equipment. There are ${availability.borrowed} items currently borrowed.`);
      }
      
      await deleteDoc(equipmentRef);
      console.log(`Equipment ${equipmentId} deleted (quantity set to 0)`);
      return;
    }
    
    // Calculate current borrowed quantity
    const availability = await calculateAvailability(equipmentId);
    const borrowedQuantity = availability.borrowed || 0;
    const newAvailableQuantity = totalQuantity - borrowedQuantity;
    
    const updateData = {
      name: equipmentData.name,
      category: equipmentData.category,
      totalQuantity: totalQuantity,
      availableQuantity: newAvailableQuantity,
      condition: equipmentData.condition || null,
      location: equipmentData.location || null,
      description: equipmentData.description || null,
      specifications: equipmentData.specifications || null,
      lastUpdated: serverTimestamp(),
      updatedBy: adminId
    };
    
    await updateDoc(equipmentRef, updateData);
    
    console.log(`Equipment ${equipmentId} updated successfully`);
  } catch (error) {
    console.error("Error updating equipment:", error);
    throw error;
  }
};

/**
 * Submit a borrow request
 * @param {Object} requestData - Request data
 * @param {string} requestData.equipmentId - Equipment ID
 * @param {string} requestData.equipmentName - Equipment name (optional, will be fetched if not provided)
 * @param {string} requestData.organizationId - Organization ID
 * @param {number} requestData.quantity - Quantity requested
 * @param {string} requestData.purpose - Purpose of borrowing
 * @param {Date} requestData.borrowDate - Requested borrow date
 * @param {Date} requestData.expectedReturnDate - Expected return date
 * @param {string} userId - User ID making the request
 * @returns {Promise<Object>} Created request with requestId
 */
export const submitBorrowRequest = async (requestData, userId) => {
  try {
    const requestsRef = collection(db, "borrowRequests");
    
    // Fetch equipment name if not provided
    let equipmentName = requestData.equipmentName;
    if (!equipmentName && requestData.equipmentId) {
      const equipment = await getEquipmentById(requestData.equipmentId);
      equipmentName = equipment?.name || "Unknown Equipment";
    }
    
    const request = {
      equipmentId: requestData.equipmentId,
      equipmentName: equipmentName,
      organizationId: requestData.organizationId,
      requestedBy: userId,
      quantity: requestData.quantity,
      purpose: requestData.purpose,
      borrowDate: Timestamp.fromDate(requestData.borrowDate),
      expectedReturnDate: Timestamp.fromDate(requestData.expectedReturnDate),
      status: "pending",
      dateRequested: serverTimestamp(),
      lastUpdated: serverTimestamp()
    };
    
    const docRef = await addDoc(requestsRef, request);
    
    return {
      requestId: docRef.id,
      ...request
    };
  } catch (error) {
    console.error("Error submitting borrow request:", error);
    throw error;
  }
};

/**
 * Get borrow requests for an organization
 * @param {string} organizationId - Organization ID
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} Array of borrow requests
 */
export const getBorrowRequests = async (organizationId, filters = {}) => {
  try {
    const requestsRef = collection(db, "borrowRequests");
    let q = query(
      requestsRef,
      where("organizationId", "==", organizationId),
      orderBy("dateRequested", "desc")
    );
    
    if (filters.status) {
      q = query(q, where("status", "==", filters.status));
    }
    
    const querySnapshot = await getDocs(q);
    const requests = [];
    
    // Fetch equipment names for requests that don't have them (backward compatibility)
    const requestsToEnrich = [];
    
    querySnapshot.forEach((doc) => {
      const requestData = {
        requestId: doc.id,
        ...doc.data()
      };
      
      // If equipment name is missing, fetch it
      if (!requestData.equipmentName && requestData.equipmentId) {
        requestsToEnrich.push(requestData);
      } else {
        requests.push(requestData);
      }
    });
    
    // Fetch equipment names for requests that need them
    if (requestsToEnrich.length > 0) {
      const enrichedRequests = await Promise.all(
        requestsToEnrich.map(async (request) => {
          try {
            const equipment = await getEquipmentById(request.equipmentId);
            return {
              ...request,
              equipmentName: equipment?.name || "Unknown Equipment"
            };
          } catch (error) {
            console.error(`Error fetching equipment for request ${request.requestId}:`, error);
            return {
              ...request,
              equipmentName: "Unknown Equipment"
            };
          }
        })
      );
      requests.push(...enrichedRequests);
    }
    
    // Sort by dateRequested descending
    requests.sort((a, b) => {
      const dateA = a.dateRequested?.toDate?.() || new Date(0);
      const dateB = b.dateRequested?.toDate?.() || new Date(0);
      return dateB - dateA;
    });
    
    return requests;
  } catch (error) {
    console.error("Error fetching borrow requests:", error);
    return [];
  }
};

/**
 * Get active borrow transactions for an organization
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Array>} Array of active transactions
 */
export const getActiveBorrows = async (organizationId) => {
  try {
    const transactionsRef = collection(db, "borrowTransactions");
    const q = query(
      transactionsRef,
      where("organizationId", "==", organizationId),
      where("status", "in", ["borrowed", "overdue"]),
      orderBy("expectedReturnDate", "asc")
    );
    
    const querySnapshot = await getDocs(q);
    const transactions = [];
    
    // Fetch equipment names for transactions that don't have them (backward compatibility)
    const transactionsToEnrich = [];
    
    querySnapshot.forEach((doc) => {
      const transactionData = {
        transactionId: doc.id,
        ...doc.data()
      };
      
      // If equipment name is missing, fetch it
      if (!transactionData.equipmentName && transactionData.equipmentId) {
        transactionsToEnrich.push(transactionData);
      } else {
        transactions.push(transactionData);
      }
    });
    
    // Fetch equipment names for transactions that need them
    if (transactionsToEnrich.length > 0) {
      const enrichedTransactions = await Promise.all(
        transactionsToEnrich.map(async (transaction) => {
          try {
            const equipment = await getEquipmentById(transaction.equipmentId);
            return {
              ...transaction,
              equipmentName: equipment?.name || "Unknown Equipment"
            };
          } catch (error) {
            console.error(`Error fetching equipment for transaction ${transaction.transactionId}:`, error);
            return {
              ...transaction,
              equipmentName: "Unknown Equipment"
            };
          }
        })
      );
      transactions.push(...enrichedTransactions);
    }
    
    // Sort by expectedReturnDate ascending
    transactions.sort((a, b) => {
      const dateA = a.expectedReturnDate?.toDate?.() || new Date(0);
      const dateB = b.expectedReturnDate?.toDate?.() || new Date(0);
      return dateA - dateB;
    });
    
    return transactions;
  } catch (error) {
    console.error("Error fetching active borrows:", error);
    return [];
  }
};

/**
 * Calculate equipment availability
 * @param {string} equipmentId - Equipment ID
 * @returns {Promise<Object>} Object with total, borrowed, and available quantities
 */
export const calculateAvailability = async (equipmentId) => {
  try {
    const equipment = await getEquipmentById(equipmentId);
    if (!equipment) {
      throw new Error("Equipment not found");
    }
    
    const totalQuantity = equipment.totalQuantity || 0;
    
    // Get active borrows for this equipment
    const transactionsRef = collection(db, "borrowTransactions");
    const q = query(
      transactionsRef,
      where("equipmentId", "==", equipmentId),
      where("status", "in", ["borrowed", "overdue"])
    );
    
    const querySnapshot = await getDocs(q);
    let borrowedQuantity = 0;
    
    querySnapshot.forEach((doc) => {
      borrowedQuantity += doc.data().quantity || 0;
    });
    
    return {
      total: totalQuantity,
      borrowed: borrowedQuantity,
      available: totalQuantity - borrowedQuantity
    };
  } catch (error) {
    console.error("Error calculating availability:", error);
    throw error;
  }
};

/**
 * Get all borrow requests (for admin)
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} Array of all borrow requests
 */
export const getAllBorrowRequests = async (filters = {}) => {
  try {
    const requestsRef = collection(db, "borrowRequests");
    let q = query(
      requestsRef,
      orderBy("dateRequested", "desc")
    );
    
    if (filters.status) {
      q = query(q, where("status", "==", filters.status));
    }
    
    const querySnapshot = await getDocs(q);
    const requests = [];
    
    // Fetch equipment names for requests that don't have them (backward compatibility)
    const requestsToEnrich = [];
    
    querySnapshot.forEach((doc) => {
      const requestData = {
        requestId: doc.id,
        ...doc.data()
      };
      
      // If equipment name is missing, fetch it
      if (!requestData.equipmentName && requestData.equipmentId) {
        requestsToEnrich.push(requestData);
      } else {
        requests.push(requestData);
      }
    });
    
    // Fetch equipment names for requests that need them
    if (requestsToEnrich.length > 0) {
      const enrichedRequests = await Promise.all(
        requestsToEnrich.map(async (request) => {
          try {
            const equipment = await getEquipmentById(request.equipmentId);
            return {
              ...request,
              equipmentName: equipment?.name || "Unknown Equipment"
            };
          } catch (error) {
            console.error(`Error fetching equipment for request ${request.requestId}:`, error);
            return {
              ...request,
              equipmentName: "Unknown Equipment"
            };
          }
        })
      );
      requests.push(...enrichedRequests);
    }
    
    // Sort by dateRequested descending
    requests.sort((a, b) => {
      const dateA = a.dateRequested?.toDate?.() || new Date(0);
      const dateB = b.dateRequested?.toDate?.() || new Date(0);
      return dateB - dateA;
    });
    
    return requests;
  } catch (error) {
    console.error("Error fetching all borrow requests:", error);
    return [];
  }
};

/**
 * Get all active borrow transactions (for admin)
 * @returns {Promise<Array>} Array of all active transactions
 */
export const getAllActiveBorrows = async () => {
  try {
    const transactionsRef = collection(db, "borrowTransactions");
    const q = query(
      transactionsRef,
      where("status", "in", ["borrowed", "overdue"]),
      orderBy("expectedReturnDate", "asc")
    );
    
    const querySnapshot = await getDocs(q);
    const transactions = [];
    
    // Fetch equipment names for transactions that don't have them (backward compatibility)
    const transactionsToEnrich = [];
    
    querySnapshot.forEach((doc) => {
      const transactionData = {
        transactionId: doc.id,
        ...doc.data()
      };
      
      // If equipment name is missing, fetch it
      if (!transactionData.equipmentName && transactionData.equipmentId) {
        transactionsToEnrich.push(transactionData);
      } else {
        transactions.push(transactionData);
      }
    });
    
    // Fetch equipment names for transactions that need them
    if (transactionsToEnrich.length > 0) {
      const enrichedTransactions = await Promise.all(
        transactionsToEnrich.map(async (transaction) => {
          try {
            const equipment = await getEquipmentById(transaction.equipmentId);
            return {
              ...transaction,
              equipmentName: equipment?.name || "Unknown Equipment"
            };
          } catch (error) {
            console.error(`Error fetching equipment for transaction ${transaction.transactionId}:`, error);
            return {
              ...transaction,
              equipmentName: "Unknown Equipment"
            };
          }
        })
      );
      transactions.push(...enrichedTransactions);
    }
    
    // Sort by expectedReturnDate ascending
    transactions.sort((a, b) => {
      const dateA = a.expectedReturnDate?.toDate?.() || new Date(0);
      const dateB = b.expectedReturnDate?.toDate?.() || new Date(0);
      return dateA - dateB;
    });
    
    return transactions;
  } catch (error) {
    console.error("Error fetching all active borrows:", error);
    return [];
  }
};

/**
 * Get returned borrow transactions for an organization
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Array>} Array of returned transactions
 */
export const getReturnedBorrows = async (organizationId) => {
  try {
    const transactionsRef = collection(db, "borrowTransactions");
    const q = query(
      transactionsRef,
      where("organizationId", "==", organizationId),
      where("status", "==", "returned"),
      orderBy("dateReturned", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    const transactions = [];
    
    querySnapshot.forEach((doc) => {
      transactions.push({
        transactionId: doc.id,
        ...doc.data()
      });
    });
    
    return transactions;
  } catch (error) {
    console.error("Error fetching returned borrows:", error);
    return [];
  }
};

/**
 * Get all returned borrow transactions (for admin)
 * @returns {Promise<Array>} Array of all returned transactions
 */
export const getAllReturnedBorrows = async () => {
  try {
    const transactionsRef = collection(db, "borrowTransactions");
    const q = query(
      transactionsRef,
      where("status", "==", "returned"),
      orderBy("dateReturned", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    const transactions = [];
    
    // Fetch equipment names for transactions that don't have them (backward compatibility)
    const transactionsToEnrich = [];
    
    querySnapshot.forEach((doc) => {
      const transactionData = {
        transactionId: doc.id,
        ...doc.data()
      };
      
      // If equipment name is missing, fetch it
      if (!transactionData.equipmentName && transactionData.equipmentId) {
        transactionsToEnrich.push(transactionData);
      } else {
        transactions.push(transactionData);
      }
    });
    
    // Fetch equipment names for transactions that need them
    if (transactionsToEnrich.length > 0) {
      const enrichedTransactions = await Promise.all(
        transactionsToEnrich.map(async (transaction) => {
          try {
            const equipment = await getEquipmentById(transaction.equipmentId);
            return {
              ...transaction,
              equipmentName: equipment?.name || "Unknown Equipment"
            };
          } catch (error) {
            console.error(`Error fetching equipment for transaction ${transaction.transactionId}:`, error);
            return {
              ...transaction,
              equipmentName: "Unknown Equipment"
            };
          }
        })
      );
      transactions.push(...enrichedTransactions);
    }
    
    return transactions;
  } catch (error) {
    console.error("Error fetching all returned borrows:", error);
    return [];
  }
};

/**
 * Approve a borrow request (Admin only)
 * @param {string} requestId - Request ID
 * @param {string} adminId - Admin user ID
 * @param {string} remarks - Optional remarks
 * @returns {Promise<void>}
 */
export const approveBorrowRequest = async (requestId, adminId, remarks = "") => {
  try {
    const requestRef = doc(db, "borrowRequests", requestId);
    const requestSnapshot = await getDoc(requestRef);
    
    if (!requestSnapshot.exists()) {
      throw new Error("Borrow request not found");
    }
    
    const requestData = requestSnapshot.data();
    
    if (requestData.status !== "pending") {
      throw new Error(`Cannot approve request with status: ${requestData.status}`);
    }
    
    // Check equipment availability
    const equipment = await getEquipmentById(requestData.equipmentId);
    if (!equipment) {
      throw new Error("Equipment not found");
    }
    
    // Calculate available quantity
    const availability = await calculateAvailability(requestData.equipmentId);
    if (availability.available < requestData.quantity) {
      throw new Error(`Insufficient equipment available. Available: ${availability.available}, Requested: ${requestData.quantity}`);
    }
    
    // Use batch to update request and create transaction
    const batch = writeBatch(db);
    
    // Get equipment name (use from equipment object if not in request)
    const equipmentName = requestData.equipmentName || equipment.name || "Unknown Equipment";
    
    // Update request status
    batch.update(requestRef, {
      status: "approved",
      adminRemarks: remarks || null,
      dateApproved: serverTimestamp(),
      approvedBy: adminId,
      lastUpdated: serverTimestamp()
    });
    
    // Create borrow transaction
    const transactionsRef = collection(db, "borrowTransactions");
    const transactionRef = doc(transactionsRef);
    batch.set(transactionRef, {
      requestId: requestId,
      equipmentId: requestData.equipmentId,
      equipmentName: equipmentName,
      organizationId: requestData.organizationId,
      requestedBy: requestData.requestedBy,
      quantity: requestData.quantity,
      purpose: requestData.purpose || null,
      borrowDate: requestData.borrowDate,
      expectedReturnDate: requestData.expectedReturnDate,
      status: "borrowed",
      dateBorrowed: serverTimestamp(),
      issuedBy: adminId,
      adminRemarks: remarks || null,
      dateCreated: serverTimestamp(),
      lastUpdated: serverTimestamp()
    });
    
    await batch.commit();
    console.log(`Borrow request ${requestId} approved and transaction created`);
  } catch (error) {
    console.error("Error approving borrow request:", error);
    throw error;
  }
};

/**
 * Reject a borrow request (Admin only)
 * @param {string} requestId - Request ID
 * @param {string} adminId - Admin user ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<void>}
 */
export const rejectBorrowRequest = async (requestId, adminId, reason = "") => {
  try {
    const requestRef = doc(db, "borrowRequests", requestId);
    const requestSnapshot = await getDoc(requestRef);
    
    if (!requestSnapshot.exists()) {
      throw new Error("Borrow request not found");
    }
    
    const requestData = requestSnapshot.data();
    
    if (requestData.status !== "pending") {
      throw new Error(`Cannot reject request with status: ${requestData.status}`);
    }
    
    await updateDoc(requestRef, {
      status: "rejected",
      rejectionReason: reason,
      rejectedBy: adminId,
      dateRejected: serverTimestamp(),
      lastUpdated: serverTimestamp()
    });
    
    console.log(`Borrow request ${requestId} rejected`);
  } catch (error) {
    console.error("Error rejecting borrow request:", error);
    throw error;
  }
};

/**
 * Mark equipment as returned (Admin only)
 * @param {string} transactionId - Transaction ID
 * @param {string} adminId - Admin user ID
 * @param {string} conditionNotes - Optional condition notes
 * @returns {Promise<void>}
 */
export const returnEquipment = async (transactionId, adminId, conditionNotes = "") => {
  try {
    const transactionRef = doc(db, "borrowTransactions", transactionId);
    const transactionSnapshot = await getDoc(transactionRef);
    
    if (!transactionSnapshot.exists()) {
      throw new Error("Borrow transaction not found");
    }
    
    const transactionData = transactionSnapshot.data();
    
    if (transactionData.status !== "borrowed" && transactionData.status !== "overdue") {
      throw new Error(`Cannot return equipment with status: ${transactionData.status}`);
    }
    
    await updateDoc(transactionRef, {
      status: "returned",
      conditionNotes: conditionNotes || null,
      dateReturned: serverTimestamp(),
      returnedBy: adminId,
      lastUpdated: serverTimestamp()
    });
    
    console.log(`Equipment transaction ${transactionId} marked as returned`);
  } catch (error) {
    console.error("Error returning equipment:", error);
    throw error;
  }
};

