import { useState, useEffect } from "react";
import { getPendingVerifications, updateVerificationStatus } from "../../services/adminService";
import { getOrganizationById } from "../../services/organizationService";
import "../../styles/colors.css";
import "./VerificationQueue.css";

const VerificationQueue = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(null);

  useEffect(() => {
    loadPendingVerifications();
  }, []);

  const loadPendingVerifications = async () => {
    try {
      setLoading(true);
      const users = await getPendingVerifications();
      
      // Fetch organization data for each user
      const usersWithOrgs = await Promise.all(
        users.map(async (user) => {
          if (user.organizationId) {
            try {
              const org = await getOrganizationById(user.organizationId);
              return { ...user, organization: org };
            } catch (error) {
              console.error(`Error fetching org for user ${user.userId}:`, error);
              return { ...user, organization: null };
            }
          }
          return { ...user, organization: null };
        })
      );
      
      setPendingUsers(usersWithOrgs);
    } catch (error) {
      console.error("Error loading pending verifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    try {
      setProcessing(userId);
      await updateVerificationStatus(userId, "verified");
      await loadPendingVerifications();
      alert("User verification approved successfully!");
    } catch (error) {
      console.error("Error approving verification:", error);
      alert("Failed to approve verification. Please try again.");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (userId) => {
    if (!rejectionReason.trim()) {
      alert("Please provide a reason for rejection.");
      return;
    }

    try {
      setProcessing(userId);
      await updateVerificationStatus(userId, "rejected", rejectionReason);
      setShowRejectModal(null);
      setRejectionReason("");
      await loadPendingVerifications();
      alert("User verification rejected.");
    } catch (error) {
      console.error("Error rejecting verification:", error);
      alert("Failed to reject verification. Please try again.");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="verification-queue-loading">
        <p>Loading pending verifications...</p>
      </div>
    );
  }

  return (
    <div className="verification-queue">
      <div className="verification-queue-header">
        <h2 className="verification-queue-title">User Verification Queue</h2>
        <button 
          className="refresh-button"
          onClick={loadPendingVerifications}
          disabled={loading}
        >
          🔄 Refresh
        </button>
      </div>

      {pendingUsers.length === 0 ? (
        <div className="verification-queue-empty">
          <p>✅ No pending verifications. All users are verified!</p>
        </div>
      ) : (
        <div className="verification-queue-list">
          {pendingUsers.map((user) => (
            <div key={user.userId} className="verification-card">
              <div className="verification-card-header">
                <div className="verification-user-info">
                  <h3 className="verification-user-name">{user.fullName}</h3>
                  <p className="verification-user-email">{user.email}</p>
                </div>
                <div className="verification-status-badge pending">
                  🟡 Pending
                </div>
              </div>

              <div className="verification-card-body">
                <div className="verification-details-grid">
                  <div className="verification-detail-item">
                    <span className="detail-label">Role:</span>
                    <span className="detail-value">{user.role || "N/A"}</span>
                  </div>
                  <div className="verification-detail-item">
                    <span className="detail-label">Position:</span>
                    <span className="detail-value">{user.userRole || "N/A"}</span>
                  </div>
                  <div className="verification-detail-item">
                    <span className="detail-label">Organization:</span>
                    <span className="detail-value">
                      {user.organization?.name || user.organizationId || "N/A"}
                    </span>
                  </div>
                  <div className="verification-detail-item">
                    <span className="detail-label">Date Created:</span>
                    <span className="detail-value">
                      {user.dateCreated?.toDate?.()?.toLocaleDateString() || "N/A"}
                    </span>
                  </div>
                  {user.verificationDocumentUrl && (
                    <div className="verification-detail-item verification-document-link">
                      <span className="detail-label">Verification Document:</span>
                      <a 
                        href={user.verificationDocumentUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="document-link"
                      >
                        📄 View Document
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="verification-card-actions">
                <button
                  className="approve-button"
                  onClick={() => handleApprove(user.userId)}
                  disabled={processing === user.userId}
                >
                  {processing === user.userId ? "Processing..." : "✅ Approve"}
                </button>
                <button
                  className="reject-button"
                  onClick={() => setShowRejectModal(user.userId)}
                  disabled={processing === user.userId}
                >
                  ❌ Reject
                </button>
              </div>

              {showRejectModal === user.userId && (
                <div className="rejection-modal">
                  <div className="rejection-modal-content">
                    <h4>Reject Verification</h4>
                    <p>Please provide a reason for rejection:</p>
                    <textarea
                      className="rejection-reason-input"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter rejection reason..."
                      rows="3"
                    />
                    <div className="rejection-modal-actions">
                      <button
                        className="cancel-button"
                        onClick={() => {
                          setShowRejectModal(null);
                          setRejectionReason("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="confirm-reject-button"
                        onClick={() => handleReject(user.userId)}
                      >
                        Confirm Rejection
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VerificationQueue;

