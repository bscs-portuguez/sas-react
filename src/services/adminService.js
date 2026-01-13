import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
  orderBy,
  limit
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Get all users with pending verification
 * @returns {Promise<Array>} Array of user objects with pending verification
 */
export const getPendingVerifications = async () => {
  try {
    const usersRef = collection(db, "users");
    // Try query with orderBy first, fallback to simple query if index missing
    let q;
    try {
      q = query(
        usersRef,
        where("verificationStatus", "==", "pending"),
        orderBy("dateCreated", "desc")
      );
    } catch (indexError) {
      // If index doesn't exist, use simple query without orderBy
      console.warn("Firestore index missing, using simple query:", indexError);
      q = query(usersRef, where("verificationStatus", "==", "pending"));
    }
    
    const querySnapshot = await getDocs(q);
    const users = [];
    
    querySnapshot.forEach((doc) => {
      users.push({
        userId: doc.id,
        ...doc.data()
      });
    });
    
    // Sort client-side if orderBy failed
    if (users.length > 0 && users[0].dateCreated) {
      users.sort((a, b) => {
        const aDate = a.dateCreated?.toDate?.() || new Date(0);
        const bDate = b.dateCreated?.toDate?.() || new Date(0);
        return bDate - aDate;
      });
    }
    
    return users;
  } catch (error) {
    console.error("Error fetching pending verifications:", error);
    // Return empty array instead of throwing to prevent UI crash
    return [];
  }
};

/**
 * Get all users (for admin management)
 * @param {number} limitCount - Optional limit for pagination
 * @returns {Promise<Array>} Array of all user objects
 */
export const getAllUsers = async (limitCount = null) => {
  try {
    const usersRef = collection(db, "users");
    let q = query(usersRef, orderBy("dateCreated", "desc"));
    
    if (limitCount) {
      q = query(usersRef, orderBy("dateCreated", "desc"), limit(limitCount));
    }
    
    const querySnapshot = await getDocs(q);
    const users = [];
    
    querySnapshot.forEach((doc) => {
      users.push({
        userId: doc.id,
        ...doc.data()
      });
    });
    
    return users;
  } catch (error) {
    console.error("Error fetching all users:", error);
    throw error;
  }
};

/**
 * Update user verification status
 * @param {string} userId - User document ID
 * @param {string} status - "verified" | "rejected" | "pending"
 * @param {string} rejectionReason - Optional reason for rejection
 * @returns {Promise<void>}
 */
export const updateVerificationStatus = async (userId, status, rejectionReason = null) => {
  try {
    const userRef = doc(db, "users", userId);
    const updateData = {
      verificationStatus: status,
      lastUpdated: serverTimestamp()
    };
    
    if (status === "rejected" && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }
    
    await updateDoc(userRef, updateData);
    console.log(`User ${userId} verification status updated to ${status}`);
  } catch (error) {
    console.error("Error updating verification status:", error);
    throw error;
  }
};

/**
 * Get dashboard statistics
 * @returns {Promise<Object>} Statistics object
 */
export const getDashboardStats = async () => {
  try {
    const usersRef = collection(db, "users");
    
    // Get all users
    const allUsersSnapshot = await getDocs(usersRef);
    const allUsers = [];
    allUsersSnapshot.forEach((doc) => {
      allUsers.push(doc.data());
    });
    
    // Calculate statistics
    const stats = {
      totalUsers: allUsers.length,
      unverifiedUsers: allUsers.filter(u => (u.verificationStatus || "unverified") === "unverified").length,
      pendingVerifications: allUsers.filter(u => u.verificationStatus === "pending").length,
      verifiedUsers: allUsers.filter(u => u.verificationStatus === "verified").length,
      rejectedUsers: allUsers.filter(u => u.verificationStatus === "rejected").length,
      activeUsers: allUsers.filter(u => (u.status || "active") === "active").length,
      inactiveUsers: allUsers.filter(u => u.status === "inactive").length,
      adminUsers: allUsers.filter(u => u.role === "Admin").length,
      isgUsers: allUsers.filter(u => u.role === "ISG").length,
      csgUsers: allUsers.filter(u => u.role === "CSG").length,
      aoUsers: allUsers.filter(u => u.role === "AO").length
    };
    
    // Get organization count
    const orgsRef = collection(db, "organizations");
    const orgsSnapshot = await getDocs(orgsRef);
    stats.totalOrganizations = orgsSnapshot.size;
    stats.activeOrganizations = orgsSnapshot.docs.filter(
      doc => doc.data().status === "active"
    ).length;
    
    // Get document statistics
    try {
      const documentsRef = collection(db, "documents");
      const docsSnapshot = await getDocs(documentsRef);
      const allDocs = [];
      docsSnapshot.forEach((doc) => {
        allDocs.push(doc.data());
      });
      
      stats.pendingProposals = allDocs.filter(
        d => d.documentType === "activity_proposal" && 
        (d.status === "pending" || d.status === "under_review")
      ).length;
      
      stats.lateReports = allDocs.filter(d => {
        if (!["accomplishment_report", "financial_report", "financial_statement"].includes(d.documentType)) {
          return false;
        }
        if (d.status === "approved" || d.status === "released") {
          return false;
        }
        if (!d.dateSubmitted) return false;
        const submittedDate = d.dateSubmitted.toDate ? d.dateSubmitted.toDate() : new Date(d.dateSubmitted);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return submittedDate < thirtyDaysAgo;
      }).length;
      
      stats.incomingDocuments = allDocs.filter(d => d.direction === "incoming").length;
      stats.pendingDocuments = allDocs.filter(d => d.status === "pending").length;
    } catch (error) {
      console.error("Error fetching document stats:", error);
      stats.pendingProposals = 0;
      stats.lateReports = 0;
      stats.incomingDocuments = 0;
      stats.pendingDocuments = 0;
    }
    
    // Get equipment statistics
    try {
      const equipmentRef = collection(db, "equipment");
      const equipSnapshot = await getDocs(equipmentRef);
      stats.totalEquipment = equipSnapshot.size;
      
      const borrowTransactionsRef = collection(db, "borrowTransactions");
      const borrowsSnapshot = await getDocs(borrowTransactionsRef);
      const allBorrows = [];
      borrowsSnapshot.forEach((doc) => {
        allBorrows.push(doc.data());
      });
      
      stats.overdueEquipment = allBorrows.filter(b => {
        if (b.status !== "borrowed" && b.status !== "overdue") return false;
        if (!b.expectedReturnDate) return false;
        const returnDate = b.expectedReturnDate.toDate ? b.expectedReturnDate.toDate() : new Date(b.expectedReturnDate);
        return returnDate < new Date();
      }).length;
    } catch (error) {
      console.error("Error fetching equipment stats:", error);
      stats.totalEquipment = 0;
      stats.overdueEquipment = 0;
    }
    
    return stats;
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    throw error;
  }
};

/**
 * Update user status (activate/deactivate)
 * @param {string} userId - User document ID
 * @param {string} status - "active" | "inactive"
 * @returns {Promise<void>}
 */
export const updateUserStatus = async (userId, status) => {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      status: status,
      lastUpdated: serverTimestamp()
    });
    console.log(`User ${userId} status updated to ${status}`);
  } catch (error) {
    console.error("Error updating user status:", error);
    throw error;
  }
};

/**
 * Get recent activity (placeholder - can be expanded)
 * @returns {Promise<Array>} Array of recent activity items
 */
export const getRecentActivity = async () => {
  try {
    // Placeholder - can be expanded to query actual activity logs
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("lastLogin", "desc"), limit(10));
    const snapshot = await getDocs(q);
    
    const activities = [];
    snapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.lastLogin) {
        activities.push({
          id: doc.id,
          type: "login",
          user: userData.fullName || userData.email,
          timestamp: userData.lastLogin,
          description: `${userData.fullName || userData.email} logged in`
        });
      }
    });
    
    return activities;
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    return [];
  }
};

