import { useState, useEffect } from "react";
import { auth } from "../config/firebase";
import { getUserById } from "../services/userService";
import { getOrganizationById, getAllOrganizationsForAdmin } from "../services/organizationService";
import { 
  searchDocuments, 
  getDocumentById, 
  getDocumentStatusHistory,
  updateDocumentStatus,
  assignDocumentNumber
} from "../services/documentService";
import AdminLayout from "../components/admin/AdminLayout";
import LoadingScreen from "../components/LoadingScreen";
import "../styles/colors.css";
import "./AdminActivityProposals.css";

const AdminActivityProposals = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [enrichedProposals, setEnrichedProposals] = useState([]);
  const [filteredProposals, setFilteredProposals] = useState([]);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [selectedProposalHistory, setSelectedProposalHistory] = useState([]);
  const [activeStatusTab, setActiveStatusTab] = useState("pending");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [orgTypeFilter, setOrgTypeFilter] = useState("all");
  const [orgNameFilter, setOrgNameFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  // Organization list for filters
  const [organizations, setOrganizations] = useState([]);

  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [documentNumber, setDocumentNumber] = useState("");
  const [statusRemarks, setStatusRemarks] = useState("");
  const [newStatus, setNewStatus] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getUserById(user.uid);
        setUserData(userDoc);

        // Load organizations for filters
        const orgs = await getAllOrganizationsForAdmin();
        setOrganizations(orgs);

        await loadProposals();
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [enrichedProposals, activeStatusTab, searchQuery, orgTypeFilter, orgNameFilter, dateFrom, dateTo]);

  const loadProposals = async () => {
    try {
      setLoading(true);
      const filters = {
        documentType: "activity_proposal"
      };

      const docs = await searchDocuments(filters);
      setProposals(docs);
      
      // Enrich proposals with organization and submitter info
      const enriched = await enrichProposalsWithDetails(docs);
      setEnrichedProposals(enriched);
    } catch (error) {
      console.error("Error loading proposals:", error);
      setError("Failed to load proposals");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...enrichedProposals];

    // Filter by status tab
    if (activeStatusTab !== "all") {
      filtered = filtered.filter((proposal) => proposal.status === activeStatusTab);
    }

    // Filter by search query (Proposal Title or Name of Proposer)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((proposal) => {
        const title = (proposal.title || "").toLowerCase();
        const proposerName = (proposal.submitterName || "").toLowerCase();
        return title.includes(query) || proposerName.includes(query);
      });
    }

    // Filter by organization type
    if (orgTypeFilter !== "all") {
      filtered = filtered.filter((proposal) => {
        // Use enriched organizationType if available, otherwise look it up
        if (proposal.organizationType) {
          return proposal.organizationType === orgTypeFilter;
        }
        const org = organizations.find((o) => o.organizationId === proposal.organizationId);
        return org && org.type === orgTypeFilter;
      });
    }

    // Filter by organization name
    if (orgNameFilter !== "all") {
      filtered = filtered.filter((proposal) => proposal.organizationId === orgNameFilter);
    }

    // Filter by date range
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((proposal) => {
        if (!proposal.dateSubmitted) return false;
        const proposalDate = proposal.dateSubmitted.toDate ? proposal.dateSubmitted.toDate() : new Date(proposal.dateSubmitted);
        proposalDate.setHours(0, 0, 0, 0);
        return proposalDate >= fromDate;
      });
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((proposal) => {
        if (!proposal.dateSubmitted) return false;
        const proposalDate = proposal.dateSubmitted.toDate ? proposal.dateSubmitted.toDate() : new Date(proposal.dateSubmitted);
        return proposalDate <= toDate;
      });
    }

    setFilteredProposals(filtered);
  };

  const enrichProposalsWithDetails = async (proposals) => {
    const enriched = await Promise.all(
      proposals.map(async (proposal) => {
        const enrichedProposal = { ...proposal };
        
        if (proposal.organizationId) {
          try {
            const organization = await getOrganizationById(proposal.organizationId);
            enrichedProposal.organizationName = organization?.name || proposal.organizationId;
            enrichedProposal.organizationType = organization?.type || null;
          } catch (error) {
            console.error("Error fetching organization:", error);
            enrichedProposal.organizationName = proposal.organizationId;
            enrichedProposal.organizationType = null;
          }
        }
        
        if (proposal.submittedBy) {
          try {
            const submitter = await getUserById(proposal.submittedBy);
            enrichedProposal.submitterName = submitter?.fullName || submitter?.email || "Unknown";
          } catch (error) {
            console.error("Error fetching submitter:", error);
            enrichedProposal.submitterName = "Unknown";
          }
        }
        
        return enrichedProposal;
      })
    );
    
    return enriched;
  };

  const handleViewDetails = async (proposalId) => {
    try {
      setLoading(true);
      const proposal = await getDocumentById(proposalId);
      
      const enriched = await enrichProposalsWithDetails([proposal]);
      setSelectedProposal(enriched[0]);
      
      const history = await getDocumentStatusHistory(proposalId);
      const enrichedHistory = await Promise.all(
        history.map(async (entry) => {
          if (entry.changedBy) {
            try {
              const user = await getUserById(entry.changedBy);
              return {
                ...entry,
                changedByName: user?.fullName || user?.email || "Unknown"
              };
            } catch (error) {
              return { ...entry, changedByName: "Unknown" };
            }
          }
          return { ...entry, changedByName: "Unknown" };
        })
      );
      setSelectedProposalHistory(enrichedHistory);
      
      setShowDetailModal(true);
    } catch (error) {
      console.error("Error loading proposal details:", error);
      setError("Failed to load proposal details");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignNumber = async () => {
    if (!selectedProposal || !documentNumber.trim()) {
      setError("Please enter a document number");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await assignDocumentNumber(
        selectedProposal.documentId,
        documentNumber.trim(),
        auth.currentUser.uid
      );
      setSuccess(`Document number ${documentNumber} assigned successfully`);
      setShowAssignModal(false);
      setDocumentNumber("");
      await loadProposals();
    } catch (error) {
      setError(error.message || "Failed to assign document number");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedProposal || !newStatus) {
      setError("Please select a status");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await updateDocumentStatus(
        selectedProposal.documentId,
        newStatus,
        statusRemarks,
        auth.currentUser.uid
      );
      setSuccess(`Proposal status updated to ${newStatus}`);
      setShowStatusModal(false);
      setNewStatus("");
      setStatusRemarks("");
      await loadProposals();
    } catch (error) {
      setError(error.message || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    const statusClasses = {
      pending: "status-badge-pending",
      under_review: "status-badge-review",
      approved: "status-badge-approved",
      returned: "status-badge-returned",
      rejected: "status-badge-rejected",
      released: "status-badge-released"
    };
    return statusClasses[status] || "status-badge-default";
  };

  const getStatusLabel = (status) => {
    const statusLabels = {
      pending: "Pending",
      under_review: "Under Review",
      approved: "Approved",
      returned: "Returned",
      rejected: "Rejected",
      released: "Released"
    };
    return statusLabels[status] || status;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    }
    return "N/A";
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return "N/A";
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    }
    return "N/A";
  };

  // Removed early return - loading will be shown inside AdminLayout

  // Get unique organization types
  const orgTypes = ["all", ...new Set(organizations.map((org) => org.type).filter(Boolean))];

  // Get organizations filtered by type for the organization name dropdown
  const filteredOrgsForDropdown = orgTypeFilter === "all" 
    ? organizations 
    : organizations.filter((org) => org.type === orgTypeFilter);

  return (
    <AdminLayout userData={userData} currentPage="activity-proposals">
      {loading && !proposals.length ? (
        <LoadingScreen compact={true} />
      ) : (
        <div className="admin-activity-proposals">
        <div className="admin-proposals-header">
          <h1 className="admin-proposals-title">Activity Proposal Management</h1>
        </div>

        {/* Search and Filters Section */}
        <div className="admin-proposals-filters">
          <div className="filters-row">
            <div className="filter-group">
              <label htmlFor="search-input" className="filter-label">Search</label>
              <input
                id="search-input"
                type="text"
                className="filter-input"
                placeholder="Search by Proposal Title or Name of Proposer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="filter-group filter-group-small">
              <label htmlFor="org-type-filter" className="filter-label">Org. Type</label>
              <select
                id="org-type-filter"
                className="filter-select"
                value={orgTypeFilter}
                onChange={(e) => {
                  setOrgTypeFilter(e.target.value);
                  setOrgNameFilter("all"); // Reset organization name when type changes
                }}
              >
                <option value="all">All Types</option>
                {orgTypes.filter((type) => type !== "all").map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="filter-group filter-group-org-name">
              <label htmlFor="org-name-filter" className="filter-label">Org. Name</label>
              <select
                id="org-name-filter"
                className="filter-select"
                value={orgNameFilter}
                onChange={(e) => setOrgNameFilter(e.target.value)}
              >
                <option value="all">All Organizations</option>
                {filteredOrgsForDropdown.map((org) => (
                  <option key={org.organizationId} value={org.organizationId}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group filter-group-date">
              <label htmlFor="date-from" className="filter-label">Date From</label>
              <input
                id="date-from"
                type="date"
                className="filter-input"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="filter-group filter-group-date">
              <label htmlFor="date-to" className="filter-label">Date To</label>
              <input
                id="date-to"
                type="date"
                className="filter-input"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="filters-actions">
            <button
              className="filter-clear-button"
              onClick={() => {
                setSearchQuery("");
                setOrgTypeFilter("all");
                setOrgNameFilter("all");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="status-tabs">
          <button
            className={`status-tab ${activeStatusTab === "pending" ? "active" : ""}`}
            onClick={() => setActiveStatusTab("pending")}
          >
            Pending
          </button>
          <button
            className={`status-tab ${activeStatusTab === "under_review" ? "active" : ""}`}
            onClick={() => setActiveStatusTab("under_review")}
          >
            Under Review
          </button>
          <button
            className={`status-tab ${activeStatusTab === "approved" ? "active" : ""}`}
            onClick={() => setActiveStatusTab("approved")}
          >
            Approved
          </button>
          <button
            className={`status-tab ${activeStatusTab === "returned" ? "active" : ""}`}
            onClick={() => setActiveStatusTab("returned")}
          >
            Returned
          </button>
          <button
            className={`status-tab ${activeStatusTab === "rejected" ? "active" : ""}`}
            onClick={() => setActiveStatusTab("rejected")}
          >
            Rejected
          </button>
        </div>

        {error && (
          <div className="admin-proposals-alert admin-proposals-alert-error">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        {success && (
          <div className="admin-proposals-alert admin-proposals-alert-success">
            {success}
            <button onClick={() => setSuccess("")}>×</button>
          </div>
        )}

        <div className="admin-proposals-list">
          {filteredProposals.length === 0 ? (
            <div className="admin-proposals-empty">
              <p>No proposals found</p>
            </div>
          ) : (
            <table className="proposals-table">
              <thead>
                <tr>
                  <th>Document #</th>
                  <th>Proposal Title</th>
                  <th>Organization</th>
                  <th>Submitted By</th>
                  <th>Date Submitted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProposals.map((proposal) => (
                  <tr key={proposal.documentId}>
                    <td>{proposal.documentNumber || "—"}</td>
                    <td className="table-title">{proposal.title}</td>
                    <td>{proposal.organizationName || proposal.organizationId}</td>
                    <td>{proposal.submitterName || "Unknown"}</td>
                    <td>{formatDate(proposal.dateSubmitted)}</td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(proposal.status)}`}>
                        {getStatusLabel(proposal.status)}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="action-button action-button-view"
                          onClick={() => handleViewDetails(proposal.documentId)}
                        >
                          View
                        </button>
                        {proposal.status === "pending" && !proposal.documentNumber && (
                          <button
                            className="action-button action-button-assign"
                            onClick={() => {
                              setSelectedProposal(proposal);
                              setShowAssignModal(true);
                            }}
                          >
                            Assign #
                          </button>
                        )}
                        {proposal.status !== "released" && proposal.status !== "pending" && (
                          <button
                            className="action-button action-button-status"
                            onClick={() => {
                              setSelectedProposal(proposal);
                              setNewStatus("");
                              setStatusRemarks("");
                              setShowStatusModal(true);
                            }}
                          >
                            Update Status
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Assign Number Modal */}
        {showAssignModal && selectedProposal && (
          <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Assign Document Number</h3>
              <div className="form-group">
                <label>Document Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="e.g., PROP-2024-001"
                />
              </div>
              <div className="modal-actions">
                <button className="form-button form-button-secondary" onClick={() => setShowAssignModal(false)}>
                  Cancel
                </button>
                <button className="form-button form-button-primary" onClick={handleAssignNumber}>
                  Assign
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Update Status Modal */}
        {showStatusModal && selectedProposal && (
          <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Update Proposal Status</h3>
              <div className="form-group">
                <label>New Status</label>
                <select
                  className="form-input form-select"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                >
                  <option value="">Select status</option>
                  <option value="approved">Approved</option>
                  <option value="returned">Returned</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="form-group">
                <label>Remarks</label>
                <textarea
                  className="form-input form-textarea"
                  value={statusRemarks}
                  onChange={(e) => setStatusRemarks(e.target.value)}
                  rows={4}
                  placeholder="Enter remarks (optional)"
                />
              </div>
              <div className="modal-actions">
                <button className="form-button form-button-secondary" onClick={() => setShowStatusModal(false)}>
                  Cancel
                </button>
                <button className="form-button form-button-primary" onClick={handleUpdateStatus}>
                  Update
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedProposal && (
          <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
            <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{selectedProposal.title}</h3>
                <button className="modal-close" onClick={() => setShowDetailModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="detail-info">
                  <div className="info-row">
                    <span className="info-label">Status:</span>
                    <span className={`status-badge ${getStatusBadgeClass(selectedProposal.status)}`}>
                      {getStatusLabel(selectedProposal.status)}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Document Number:</span>
                    <span className="info-value">{selectedProposal.documentNumber || "Not assigned"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Organization:</span>
                    <span className="info-value">{selectedProposal.organizationName || selectedProposal.organizationId}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Submitted By:</span>
                    <span className="info-value">{selectedProposal.submitterName || "Unknown"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Date Submitted:</span>
                    <span className="info-value">{formatDate(selectedProposal.dateSubmitted)}</span>
                  </div>
                  {selectedProposal.description && (
                    <div className="info-row-full">
                      <span className="info-label">Description:</span>
                      <p className="info-description">{selectedProposal.description}</p>
                    </div>
                  )}
                  {selectedProposal.remarks && (
                    <div className="info-row-full">
                      <span className="info-label">Remarks:</span>
                      <p className="info-remarks">{selectedProposal.remarks}</p>
                    </div>
                  )}
                  {selectedProposal.fileUrl && (
                    <div className="info-row-full">
                      <a
                        href={selectedProposal.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="file-download-link"
                      >
                        📄 Download File: {selectedProposal.fileName}
                      </a>
                    </div>
                  )}
                </div>

                {/* Status History */}
                <div className="detail-history-section">
                  <h4 className="history-section-title">Status History</h4>
                  {selectedProposalHistory.length === 0 ? (
                    <div className="history-empty">No history available</div>
                  ) : (
                    <div className="history-timeline">
                      {selectedProposalHistory.map((entry, index) => (
                        <div key={entry.historyId || index} className="history-item">
                          <div className="history-item-dot"></div>
                          <div className="history-item-content">
                            <div className="history-item-header">
                              <span className={`status-badge ${getStatusBadgeClass(entry.status)}`}>
                                {getStatusLabel(entry.status)}
                              </span>
                              <span className="history-item-date">{formatDateTime(entry.timestamp)}</span>
                            </div>
                            <div className="history-item-meta">
                              <span className="history-item-user">
                                Changed by: {entry.changedByName || "Unknown"}
                              </span>
                              {entry.previousStatus && (
                                <span className="history-item-transition">
                                  (from {getStatusLabel(entry.previousStatus)})
                                </span>
                              )}
                            </div>
                            {entry.remarks && (
                              <p className="history-item-remarks">{entry.remarks}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </AdminLayout>
  );
};

export default AdminActivityProposals;

