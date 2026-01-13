import { useState, useEffect, useMemo } from "react";
import { auth } from "../config/firebase";
import { getUserById } from "../services/userService";
import { getOrganizationById } from "../services/organizationService";
import { getDocumentsByOrganization, getDocumentById, getDocumentStatusHistory } from "../services/documentService";
import Navbar from "../components/Navbar";
import DashboardLayout from "../components/DashboardLayout";
import ProposalSubmission from "../components/proposals/ProposalSubmission";
import LoadingScreen from "../components/LoadingScreen";
import "../styles/colors.css";
import "./ActivityProposalsPage.css";

const ActivityProposalsPage = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [organizationData, setOrganizationData] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [selectedProposalHistory, setSelectedProposalHistory] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getUserById(user.uid);
        setUserData(userDoc);

        if (userDoc?.organizationId) {
          const orgDoc = await getOrganizationById(userDoc.organizationId);
          setOrganizationData(orgDoc);

          // Fetch activity proposals
          const docs = await getDocumentsByOrganization(userDoc.organizationId, {
            documentType: "activity_proposal"
          });
          setProposals(docs);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSubmitSuccess = async () => {
    setShowSubmitForm(false);
    // Reload proposals
    const user = auth.currentUser;
    if (user && userData?.organizationId) {
      const docs = await getDocumentsByOrganization(userData.organizationId, {
        documentType: "activity_proposal"
      });
      setProposals(docs);
    }
  };

  const handleViewProposal = async (proposalId) => {
    try {
      setLoadingDetail(true);
      const doc = await getDocumentById(proposalId);
      setSelectedProposal(doc);
      
      // Fetch status history
      const history = await getDocumentStatusHistory(proposalId);
      setSelectedProposalHistory(history);
    } catch (error) {
      console.error("Error loading proposal details:", error);
    } finally {
      setLoadingDetail(false);
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

  // Filter proposals based on search, status, and date range
  const filteredProposals = useMemo(() => {
    return proposals.filter((proposal) => {
      // Search filter (title, document number, remarks)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          proposal.title?.toLowerCase().includes(searchLower) ||
          proposal.documentNumber?.toLowerCase().includes(searchLower) ||
          proposal.remarks?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter !== "all" && proposal.status !== statusFilter) {
        return false;
      }

      // Date range filter
      if (proposal.dateSubmitted) {
        const proposalDate = proposal.dateSubmitted.toDate 
          ? proposal.dateSubmitted.toDate() 
          : new Date(proposal.dateSubmitted);
        
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (proposalDate < fromDate) return false;
        }

        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (proposalDate > toDate) return false;
        }
      }

      return true;
    });
  }, [proposals, searchTerm, statusFilter, dateFrom, dateTo]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const organizationName = organizationData?.name || "Organization";
  const userRole = userData?.role || "ISG";
  const userName = userData?.fullName || auth.currentUser?.email || "User";
  const verificationStatus = userData?.verificationStatus || "unverified";

  return (
    <div className="home-container">
      <Navbar
        organizationName={organizationName}
        role={userRole}
        verificationStatus={verificationStatus}
        userName={userName}
      />
      
      <DashboardLayout currentPage="activity-proposals">
        {loading ? (
          <LoadingScreen compact={true} />
        ) : (
        <div className="activity-proposals-page">
          <div className="page-header">
            <h1 className="page-title">Activity Proposals</h1>
            <button 
              className="btn-primary"
              onClick={() => setShowSubmitForm(true)}
              disabled={verificationStatus !== "verified"}
            >
              + Submit New Proposal
            </button>
          </div>

          {/* Filters Section */}
          {proposals.length > 0 && (
            <div className="filters-section">
              <div className="filters-row">
                <div className="filter-group">
                  <label htmlFor="search-input" className="filter-label">Search</label>
                  <input
                    id="search-input"
                    type="text"
                    className="filter-input"
                    placeholder="Search by title, document number, or remarks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="status-filter" className="filter-label">Status</label>
                  <select
                    id="status-filter"
                    className="filter-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="under_review">Under Review</option>
                    <option value="approved">Approved</option>
                    <option value="returned">Returned</option>
                    <option value="rejected">Rejected</option>
                    <option value="released">Released</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label htmlFor="date-from" className="filter-label">Date From</label>
                  <input
                    id="date-from"
                    type="date"
                    className="filter-input"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="date-to" className="filter-label">Date To</label>
                  <input
                    id="date-to"
                    type="date"
                    className="filter-input"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
                {(searchTerm || statusFilter !== "all" || dateFrom || dateTo) && (
                  <button
                    className="btn-clear-filters"
                    onClick={handleClearFilters}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          )}

          {proposals.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📝</div>
              <p className="empty-message">No activity proposals submitted yet</p>
              <p className="empty-hint">Submit your first activity proposal to get started</p>
            </div>
          ) : (
            <>
              {filteredProposals.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🔍</div>
                  <p className="empty-message">No proposals match your filters</p>
                  <p className="empty-hint">Try adjusting your search criteria</p>
                </div>
              ) : (
                <div className="proposals-table-container">
                  <table className="proposals-table">
                    <thead>
                      <tr>
                        <th>Proposal Title</th>
                        <th>Date Submitted</th>
                        <th>Status</th>
                        <th>Remarks</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProposals.map((proposal) => (
                    <tr key={proposal.documentId}>
                      <td className="table-title">{proposal.title}</td>
                      <td>{formatDate(proposal.dateSubmitted)}</td>
                      <td>
                        <span className={`status-badge ${getStatusBadgeClass(proposal.status)}`}>
                          {getStatusLabel(proposal.status)}
                        </span>
                      </td>
                      <td className="table-remarks">
                        {proposal.remarks ? (
                          <span title={proposal.remarks}>
                            {proposal.remarks.length > 50 
                              ? `${proposal.remarks.substring(0, 50)}...` 
                              : proposal.remarks}
                          </span>
                        ) : "—"}
                      </td>
                      <td>
                        <button
                          className="btn-view"
                          onClick={() => handleViewProposal(proposal.documentId)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Submit Form Modal */}
          {showSubmitForm && (
            <div className="modal-overlay" onClick={() => setShowSubmitForm(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <ProposalSubmission
                  onSuccess={handleSubmitSuccess}
                  onCancel={() => setShowSubmitForm(false)}
                />
              </div>
            </div>
          )}

          {/* Detail View Modal */}
          {selectedProposal && (
            <div className="modal-overlay" onClick={() => setSelectedProposal(null)}>
              <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>{selectedProposal.title}</h3>
                  <button className="modal-close" onClick={() => setSelectedProposal(null)}>×</button>
                </div>
                <div className="modal-body">
                  {loadingDetail ? (
                    <div className="loading-state">Loading...</div>
                  ) : (
                    <>
                      <div className="detail-info">
                        <div className="info-row">
                          <span className="info-label">Status:</span>
                          <span className={`status-badge ${getStatusBadgeClass(selectedProposal.status)}`}>
                            {getStatusLabel(selectedProposal.status)}
                          </span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Document Number:</span>
                          <span className="info-value">
                            {selectedProposal.documentNumber || "Not assigned"}
                          </span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Date Submitted:</span>
                          <span className="info-value">
                            {formatDate(selectedProposal.dateSubmitted)}
                          </span>
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
                                    <span className="history-item-date">
                                      {formatDateTime(entry.timestamp)}
                                    </span>
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
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        )}
      </DashboardLayout>
    </div>
  );
};

export default ActivityProposalsPage;

