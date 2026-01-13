import { useState, useEffect } from "react";
import { auth } from "../config/firebase";
import { getUserById } from "../services/userService";
import { getAllOrganizationsForAdmin, updateOrganizationStatus } from "../services/organizationService";
import AdminLayout from "../components/admin/AdminLayout";
import LoadingScreen from "../components/LoadingScreen";
import "../styles/colors.css";
import "./AdminOrganizations.css";

const AdminOrganizations = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [filteredOrganizations, setFilteredOrganizations] = useState([]);
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [processing, setProcessing] = useState(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // "all" | "ISG" | "CSG" | "AO"

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getUserById(user.uid);
        if (userDoc) {
          setUserData(userDoc);
        }

        await loadOrganizations();
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
  }, [organizations, searchQuery, typeFilter]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const orgs = await getAllOrganizationsForAdmin();
      setOrganizations(orgs);
    } catch (error) {
      console.error("Error loading organizations:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...organizations];

    // Filter by search query (name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((org) => {
        const name = (org.name || "").toLowerCase();
        return name.includes(query);
      });
    }

    // Filter by organization type
    if (typeFilter !== "all") {
      filtered = filtered.filter((org) => org.type === typeFilter);
    }

    setFilteredOrganizations(filtered);
  };

  const handleViewOrganization = (org) => {
    setSelectedOrganization(org);
    setShowOrgModal(true);
  };

  const handleCloseModal = () => {
    setShowOrgModal(false);
    setSelectedOrganization(null);
  };

  const handleToggleStatus = async () => {
    if (!selectedOrganization) return;

    const newStatus = selectedOrganization.status === "active" ? "inactive" : "active";
    const action = newStatus === "active" ? "activate" : "deactivate";

    if (!window.confirm(`Are you sure you want to ${action} this organization?`)) {
      return;
    }

    try {
      setProcessing("status");
      await updateOrganizationStatus(selectedOrganization.organizationId, newStatus);
      await loadOrganizations(); // Reload organizations to reflect changes
      
      // Update selected organization in modal
      setSelectedOrganization({
        ...selectedOrganization,
        status: newStatus
      });
      
      alert(`Organization ${action}d successfully!`);
    } catch (error) {
      console.error("Error updating organization status:", error);
      alert(`Failed to ${action} organization. Please try again.`);
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status) => {
    if (status === "active") {
      return { text: "Active", color: "var(--success)", icon: "🟢" };
    }
    return { text: "Inactive", color: "var(--gray)", icon: "⚫" };
  };

  const getTypeBadge = (type) => {
    const colors = {
      ISG: "var(--earist-maroon)",
      CSG: "var(--earist-yellow)",
      AO: "var(--info)"
    };
    return colors[type] || "var(--gray)";
  };

  // Removed early return - loading will be shown inside AdminLayout

  return (
    <AdminLayout userData={userData} currentPage="organizations">
      <div className="admin-organizations">
        <div className="admin-organizations-header">
          <div>
            <h1 className="admin-organizations-title">Organizations Management</h1>
            <p className="admin-organizations-subtitle">Manage all organizations in the system</p>
          </div>
          <button className="refresh-button" onClick={loadOrganizations} disabled={loading}>
            🔄 Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="admin-organizations-filters">
          <div className="filter-group filter-group-search">
            <label className="filter-label">Search by Name:</label>
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search organizations by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Organization Type:</label>
            <select
              className="filter-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="ISG">ISG</option>
              <option value="CSG">CSG</option>
              <option value="AO">AO</option>
            </select>
          </div>

          <div className="filter-results">
            Showing {filteredOrganizations.length} of {organizations.length} organizations
          </div>
        </div>

        {/* Organizations List */}
        {filteredOrganizations.length === 0 ? (
          <div className="admin-organizations-empty">
            <p>No organizations found matching the selected filters.</p>
          </div>
        ) : (
          <div className="organizations-list">
            {filteredOrganizations.map((org) => {
              const statusBadge = getStatusBadge(org.status);
              const typeColor = getTypeBadge(org.type);
              
              return (
                <div key={org.organizationId} className="organization-card">
                  <div className="organization-card-main">
                    <div className="organization-card-info">
                      <div className="organization-header">
                        <h3 className="organization-name">{org.name || "N/A"}</h3>
                        <div className="organization-badges">
                          <div
                            className="organization-type-badge"
                            style={{ backgroundColor: typeColor }}
                          >
                            {org.type || "N/A"}
                          </div>
                          <div
                            className="organization-status-badge"
                            style={{ backgroundColor: statusBadge.color }}
                          >
                            <span>{statusBadge.icon}</span>
                            <span>{statusBadge.text}</span>
                          </div>
                        </div>
                      </div>
                      <div className="organization-details">
                        <div className="organization-detail-item">
                          <span className="detail-label">Subtype:</span>
                          <span className="detail-value">{org.subType || "N/A"}</span>
                        </div>
                        <div className="organization-detail-item">
                          <span className="detail-label">Date Created:</span>
                          <span className="detail-value">
                            {org.dateCreated?.toDate?.()?.toLocaleDateString() || "N/A"}
                          </span>
                        </div>
                        <div className="organization-detail-item">
                          <span className="detail-label">Organization ID:</span>
                          <span className="detail-value">{org.organizationId}</span>
                        </div>
                      </div>
                    </div>
                    <div className="organization-card-actions">
                      <button
                        className="view-details-button"
                        onClick={() => handleViewOrganization(org)}
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

        {/* Organization Detail Modal */}
        {showOrgModal && selectedOrganization && (
          <div className="organization-modal-overlay" onClick={handleCloseModal}>
            <div className="organization-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="organization-modal-header">
                <h2 className="organization-modal-title">Organization Details</h2>
                <button className="modal-close-button" onClick={handleCloseModal}>
                  ×
                </button>
              </div>

              <div className="organization-modal-body">
                <div className="organization-detail-section">
                  <h3 className="detail-section-title">Organization Information</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Organization Name:</span>
                      <span className="detail-value">{selectedOrganization.name || "N/A"}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Type:</span>
                      <span className="detail-value">{selectedOrganization.type || "N/A"}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Subtype:</span>
                      <span className="detail-value">{selectedOrganization.subType || "N/A"}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Organization ID:</span>
                      <span className="detail-value">{selectedOrganization.organizationId || "N/A"}</span>
                    </div>
                  </div>
                </div>

                <div className="organization-detail-section">
                  <h3 className="detail-section-title">Status Information</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Status:</span>
                      <span className="detail-value">{selectedOrganization.status || "active"}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Date Created:</span>
                      <span className="detail-value">
                        {selectedOrganization.dateCreated?.toDate?.()?.toLocaleString() || "N/A"}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Last Updated:</span>
                      <span className="detail-value">
                        {selectedOrganization.lastUpdated?.toDate?.()?.toLocaleString() || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="organization-modal-footer">
                <button
                  className={`status-toggle-button ${
                    selectedOrganization.status === "active" ? "deactivate" : "activate"
                  }`}
                  onClick={handleToggleStatus}
                  disabled={processing === "status"}
                >
                  {processing === "status"
                    ? "Processing..."
                    : selectedOrganization.status === "active"
                    ? "⏸️ Deactivate"
                    : "▶️ Activate"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </AdminLayout>
  );
};

export default AdminOrganizations;

