import { useState, useEffect } from "react";
import { auth } from "../config/firebase";
import { getUserById } from "../services/userService";
import { getAllUsers, updateVerificationStatus } from "../services/adminService";
import { getOrganizationById } from "../services/organizationService";
import AdminLayout from "../components/admin/AdminLayout";
import LoadingScreen from "../components/LoadingScreen";
import "../styles/colors.css";
import "./AdminUsers.css";

const AdminUsers = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [orgTypeFilter, setOrgTypeFilter] = useState("all"); // "all" | "ISG" | "CSG" | "AO"
  const [verificationFilter, setVerificationFilter] = useState("all"); // "all" | "verified" | "unverified"
  const [documentFilter, setDocumentFilter] = useState("all"); // "all" | "with" | "without"

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getUserById(user.uid);
        if (userDoc) {
          setUserData(userDoc);
        }

        await loadUsers();
      } catch (error) {
        console.error("Error fetching admin data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [users, orgTypeFilter, verificationFilter, documentFilter, searchQuery]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const allUsers = await getAllUsers();

      // Fetch organization data for each user
      const usersWithOrgs = await Promise.all(
        allUsers.map(async (user) => {
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

      // Sort by dateCreated (most recent first)
      usersWithOrgs.sort((a, b) => {
        const aDate = a.dateCreated?.toDate?.() || new Date(0);
        const bDate = b.dateCreated?.toDate?.() || new Date(0);
        return bDate - aDate; // Descending order (newest first)
      });

      setUsers(usersWithOrgs);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...users];

    // Filter by search query (name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((user) => {
        const fullName = (user.fullName || "").toLowerCase();
        const email = (user.email || "").toLowerCase();
        return fullName.includes(query) || email.includes(query);
      });
    }

    // Filter by organization type
    if (orgTypeFilter !== "all") {
      filtered = filtered.filter((user) => user.role === orgTypeFilter);
    }

    // Filter by verification status
    if (verificationFilter === "verified") {
      filtered = filtered.filter((user) => user.verificationStatus === "verified");
    } else if (verificationFilter === "unverified") {
      filtered = filtered.filter(
        (user) => !user.verificationStatus || user.verificationStatus === "pending" || user.verificationStatus === "rejected" || user.verificationStatus === "unverified"
      );
    }

    // Filter by document status
    if (documentFilter === "with") {
      filtered = filtered.filter((user) => user.verificationDocumentUrl);
    } else if (documentFilter === "without") {
      filtered = filtered.filter((user) => !user.verificationDocumentUrl);
    }

    setFilteredUsers(filtered);
  };

  const handleViewUser = (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const handleCloseModal = () => {
    setShowUserModal(false);
    setSelectedUser(null);
    setShowRejectModal(false);
    setRejectionReason("");
  };

  const handleVerify = async () => {
    if (!selectedUser) return;

    try {
      setProcessing("verify");
      await updateVerificationStatus(selectedUser.userId, "verified");
      await loadUsers(); // Reload users to reflect changes
      alert("User verified successfully!");
      handleCloseModal();
    } catch (error) {
      console.error("Error verifying user:", error);
      alert("Failed to verify user. Please try again.");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!selectedUser) return;
    if (!rejectionReason.trim()) {
      alert("Please provide a reason for rejection.");
      return;
    }

    try {
      setProcessing("reject");
      await updateVerificationStatus(selectedUser.userId, "rejected", rejectionReason);
      await loadUsers(); // Reload users to reflect changes
      alert("User verification rejected.");
      handleCloseModal();
    } catch (error) {
      console.error("Error rejecting user:", error);
      alert("Failed to reject user. Please try again.");
    } finally {
      setProcessing(null);
    }
  };

  const getVerificationStatusBadge = (status) => {
    switch (status) {
      case "verified":
        return { text: "Verified", color: "var(--success)", icon: "🟢", textColor: "var(--white)" };
      case "rejected":
        return { text: "Rejected", color: "var(--error)", icon: "🔴", textColor: "var(--white)" };
      case "pending":
        return { text: "Under Review", color: "var(--warning)", icon: "🟡", textColor: "var(--gray-dark)" };
      case "unverified":
        return { text: "Unverified", color: "var(--gray-light)", icon: "⚪", textColor: "var(--gray-dark)" };
      default:
        return { text: "Unverified", color: "var(--gray-light)", icon: "⚪", textColor: "var(--gray-dark)" };
    }
  };

  // Removed early return - loading will be shown inside AdminLayout

  return (
    <AdminLayout userData={userData} currentPage="users">
      <div className="admin-users">
        <div className="admin-users-header">
          <div>
            <h1 className="admin-users-title">User Accounts</h1>
            <p className="admin-users-subtitle">Manage and verify user accounts</p>
          </div>
          <button className="refresh-button" onClick={loadUsers} disabled={loading}>
            🔄 Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="admin-users-filters">
          <div className="filter-group filter-group-search">
            <label className="filter-label">Search by Name:</label>
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Organization Type:</label>
            <select
              className="filter-select"
              value={orgTypeFilter}
              onChange={(e) => setOrgTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="AO">AO</option>
              <option value="ISG">ISG</option>
              <option value="CSG">CSG</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Verification Status:</label>
            <select
              className="filter-select"
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Document Status:</label>
            <select
              className="filter-select"
              value={documentFilter}
              onChange={(e) => setDocumentFilter(e.target.value)}
            >
              <option value="all">All Users</option>
              <option value="with">With Documents</option>
              <option value="without">Without Documents</option>
            </select>
          </div>

          <div className="filter-results">
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </div>

        {/* Users List */}
        {filteredUsers.length === 0 ? (
          <div className="admin-users-empty">
            <p>No users found matching the selected filters.</p>
          </div>
        ) : (
          <div className="admin-users-list">
            {filteredUsers.map((user) => {
              const statusBadge = getVerificationStatusBadge(user.verificationStatus);
              return (
                <div key={user.userId} className="user-card">
                  <div className="user-card-main">
                    <div className="user-card-info">
                      <h3 className="user-name">{user.fullName || "N/A"}</h3>
                      <div className="user-details">
                        <span className="user-detail-item">
                          <strong>Email:</strong> {user.email || "N/A"}
                        </span>
                        <span className="user-detail-item">
                          <strong>Organization Type:</strong> {user.role || "N/A"}
                        </span>
                        <span className="user-detail-item">
                          <strong>Organization:</strong> {user.organization?.name || user.organizationId || "N/A"}
                        </span>
                        <span className="user-detail-item">
                          <strong>Position:</strong> {user.userRole || "N/A"}
                        </span>
                        <span className="user-detail-item">
                          <strong>Account Created:</strong>{" "}
                          {user.dateCreated?.toDate?.()?.toLocaleString() || "N/A"}
                        </span>
                      </div>
                    </div>
                    <div className="user-card-actions">
                      <div className="user-card-status-group">
                        <div
                          className="verification-badge"
                          style={{ 
                            backgroundColor: statusBadge.color,
                            color: statusBadge.textColor || "var(--white)"
                          }}
                        >
                          <span>{statusBadge.icon}</span>
                          <span>{statusBadge.text}</span>
                        </div>
                        {user.verificationDocumentUrl && (
                          <div className="document-indicator" title="Verification document uploaded">
                            📄
                          </div>
                        )}
                      </div>
                      <button
                        className="view-details-button"
                        onClick={() => handleViewUser(user)}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* User Detail Modal */}
        {showUserModal && selectedUser && (
          <div className="user-modal-overlay" onClick={handleCloseModal}>
            <div className="user-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="user-modal-header">
                <h2 className="user-modal-title">User Details</h2>
                <button className="modal-close-button" onClick={handleCloseModal}>
                  ×
                </button>
              </div>

              <div className="user-modal-body">
                <div className="user-detail-section">
                  <h3 className="detail-section-title">Personal Information</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Full Name:</span>
                      <span className="detail-value">{selectedUser.fullName || "N/A"}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Email:</span>
                      <span className="detail-value">{selectedUser.email || "N/A"}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">User ID:</span>
                      <span className="detail-value">{selectedUser.userId || "N/A"}</span>
                    </div>
                  </div>
                </div>

                <div className="user-detail-section">
                  <h3 className="detail-section-title">Organization Information</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Organization Type:</span>
                      <span className="detail-value">{selectedUser.role || "N/A"}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Organization Name:</span>
                      <span className="detail-value">
                        {selectedUser.organization?.name || selectedUser.organizationId || "N/A"}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Position/Role:</span>
                      <span className="detail-value">{selectedUser.userRole || "N/A"}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Organization ID:</span>
                      <span className="detail-value">{selectedUser.organizationId || "N/A"}</span>
                    </div>
                  </div>
                </div>

                <div className="user-detail-section">
                  <h3 className="detail-section-title">Account Status</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Status:</span>
                      <span className="detail-value">{selectedUser.status || "active"}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Verification Status:</span>
                      <span className="detail-value">
                        {selectedUser.verificationStatus || "pending"}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Account Created:</span>
                      <span className="detail-value">
                        {selectedUser.dateCreated?.toDate?.()?.toLocaleString() || "N/A"}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Last Login:</span>
                      <span className="detail-value">
                        {selectedUser.lastLogin?.toDate?.()?.toLocaleString() || "Never"}
                      </span>
                    </div>
                    {selectedUser.rejectionReason && (
                      <div className="detail-item detail-item-full">
                        <span className="detail-label">Rejection Reason:</span>
                        <span className="detail-value">{selectedUser.rejectionReason}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Verification Document Section */}
                {selectedUser.verificationDocumentUrl && (
                  <div className="user-detail-section">
                    <h3 className="detail-section-title">Verification Document</h3>
                    <div className="verification-document-container">
                      <div className="verification-document-info">
                        <div className="detail-item">
                          <span className="detail-label">Document Submitted:</span>
                          <span className="detail-value">
                            {selectedUser.verificationSubmittedAt?.toDate?.()?.toLocaleString() || "N/A"}
                          </span>
                        </div>
                        <div className="verification-document-actions">
                          <a
                            href={selectedUser.verificationDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="view-document-button"
                          >
                            📄 View Document
                          </a>
                        </div>
                      </div>
                      {/* Preview for images */}
                      {selectedUser.verificationDocumentUrl.match(/\.(jpg|jpeg|png|webp)$/i) && (
                        <div className="verification-document-preview">
                          <img
                            src={selectedUser.verificationDocumentUrl}
                            alt="Verification Document Preview"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="user-modal-footer">
                {selectedUser.verificationStatus !== "verified" && (
                  <button
                    className="verify-button"
                    onClick={handleVerify}
                    disabled={processing === "verify"}
                  >
                    {processing === "verify" ? "Processing..." : "✅ Verify"}
                  </button>
                )}
                {selectedUser.verificationStatus !== "rejected" && 
                 selectedUser.role !== "Admin" && (
                  <button
                    className="reject-button"
                    onClick={() => setShowRejectModal(true)}
                    disabled={processing === "reject"}
                  >
                    ❌ Reject
                  </button>
                )}
              </div>

              {/* Rejection Modal */}
              {showRejectModal && (
                <div className="rejection-modal-overlay">
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
                          setShowRejectModal(false);
                          setRejectionReason("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="confirm-reject-button"
                        onClick={handleReject}
                        disabled={!rejectionReason.trim() || processing === "reject"}
                      >
                        {processing === "reject" ? "Processing..." : "Confirm Rejection"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      )}
    </AdminLayout>
  );
};

export default AdminUsers;

