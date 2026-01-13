import { getDocumentsByOrganization } from "./documentService";
import { getUserById } from "./userService";

/**
 * Get dashboard statistics for a student officer
 * @param {string} organizationId - Organization ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Dashboard statistics
 */
export const getStudentDashboardStats = async (organizationId, userId) => {
  try {
    if (!organizationId) {
      return {
        pendingProposals: 0,
        reportsDue: 0,
        reportsOverdue: 0,
        activeBorrowedEquipment: 0,
        notifications: 0
      };
    }

    // Get all documents for the organization
    const allDocuments = await getDocumentsByOrganization(organizationId);
    
    // Filter pending activity proposals
    const pendingProposals = allDocuments.filter(
      doc => doc.documentType === "activity_proposal" && 
      (doc.status === "pending" || doc.status === "under_review")
    ).length;

    // Filter reports (accomplishment, financial)
    const reports = allDocuments.filter(
      doc => ["accomplishment_report", "financial_report", "financial_statement"].includes(doc.documentType)
    );

    // Calculate reports due/overdue (this would need deadline data - placeholder for now)
    const today = new Date();
    const reportsDue = reports.filter(
      doc => doc.status !== "approved" && doc.status !== "released"
    ).length;

    // For now, we'll use a simple heuristic: reports pending for >30 days are overdue
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const reportsOverdue = reports.filter(doc => {
      if (!doc.dateSubmitted) return false;
      const submittedDate = doc.dateSubmitted.toDate ? doc.dateSubmitted.toDate() : new Date(doc.dateSubmitted);
      return submittedDate < thirtyDaysAgo && doc.status !== "approved" && doc.status !== "released";
    }).length;

    // Equipment borrowing - placeholder (would need equipment service)
    const activeBorrowedEquipment = 0; // TODO: Implement when equipment service is ready

    // Notifications - placeholder (would need notification service)
    const notifications = 0; // TODO: Implement when notification service is ready

    return {
      pendingProposals,
      reportsDue,
      reportsOverdue,
      activeBorrowedEquipment,
      notifications
    };
  } catch (error) {
    console.error("Error fetching student dashboard stats:", error);
    return {
      pendingProposals: 0,
      reportsDue: 0,
      reportsOverdue: 0,
      activeBorrowedEquipment: 0,
      notifications: 0
    };
  }
};

/**
 * Get recent submissions for a student officer
 * @param {string} organizationId - Organization ID
 * @param {number} limit - Number of recent submissions to return
 * @returns {Promise<Array>} Array of recent documents
 */
export const getRecentSubmissions = async (organizationId, limit = 5) => {
  try {
    if (!organizationId) return [];

    const documents = await getDocumentsByOrganization(organizationId);
    
    // Sort by date submitted (newest first) and limit
    return documents
      .sort((a, b) => {
        const aDate = a.dateSubmitted?.toDate ? a.dateSubmitted.toDate() : new Date(0);
        const bDate = b.dateSubmitted?.toDate ? b.dateSubmitted.toDate() : new Date(0);
        return bDate - aDate;
      })
      .slice(0, limit);
  } catch (error) {
    console.error("Error fetching recent submissions:", error);
    return [];
  }
};

