import { useState, useEffect } from "react";
import { auth } from "../config/firebase";
import { getUserById } from "../services/userService";
import { getOrganizationById } from "../services/organizationService";
import { 
  searchDocuments, 
  getDocumentById, 
  getDocumentStatusHistory,
  updateDocumentStatus
} from "../services/documentService";
import AdminLayout from "../components/admin/AdminLayout";
import LoadingScreen from "../components/LoadingScreen";
import "../styles/colors.css";
import "./AdminReportsCompliance.css";

const AdminReportsCompliance = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [reports, setReports] = useState([]);
  const [enrichedReports, setEnrichedReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedReportHistory, setSelectedReportHistory] = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterOrgType, setFilterOrgType] = useState("");
  const [filterOrgName, setFilterOrgName] = useState("");
  const [availableOrgs, setAvailableOrgs] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal states
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [statusRemarks, setStatusRemarks] = useState("");
  const [newStatus, setNewStatus] = useState("");

  const reportTypes = [
    { code: "all", name: "All Types" },
    { code: "accomplishment_report", name: "Accomplishment Report" },
    { code: "financial_report", name: "Financial Report" },
    { code: "financial_statement", name: "Financial Statement" }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getUserById(user.uid);
        setUserData(userDoc);

        await loadReports();
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
    loadReports();
  }, [filterType, filterStatus, filterOrgType, filterOrgName]);

  useEffect(() => {
    const loadOrganizations = async () => {
      if (filterOrgType) {
        try {
          const { getOrganizationsByType } = await import("../services/organizationService");
          const orgs = await getOrganizationsByType(filterOrgType);
          setAvailableOrgs(orgs);
          if (filterOrgName && !orgs.find(org => org.organizationId === filterOrgName)) {
            setFilterOrgName("");
          }
        } catch (error) {
          console.error("Error loading organizations:", error);
        }
      } else {
        setAvailableOrgs([]);
        setFilterOrgName("");
      }
    };

    loadOrganizations();
  }, [filterOrgType, filterOrgName]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const filters = {};

      // Filter by report type
      if (filterType !== "all") {
        filters.documentType = filterType;
      } else {
        // If "all", filter to only report types
        filters.documentType = ["accomplishment_report", "financial_report", "financial_statement"];
      }

      if (filterStatus !== "all") {
        filters.status = filterStatus;
      }

      if (filterOrgName) {
        filters.organizationId = filterOrgName;
      }

      const docs = await searchDocuments(filters);
      // If filterType is "all", filter client-side
      const reportDocs = filterType === "all" 
        ? docs.filter(d => ["accomplishment_report", "financial_report", "financial_statement"].includes(d.documentType))
        : docs;
      
      setReports(reportDocs);
      
      const enriched = await enrichReportsWithDetails(reportDocs);
      setEnrichedReports(enriched);
    } catch (error) {
      console.error("Error loading reports:", error);
      setError("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const enrichReportsWithDetails = async (reports) => {
    const enriched = await Promise.all(
      reports.map(async (report) => {
        const enrichedReport = { ...report };
        
        if (report.organizationId) {
          try {
            const organization = await getOrganizationById(report.organizationId);
            enrichedReport.organizationName = organization?.name || report.organizationId;
          } catch (error) {
            enrichedReport.organizationName = report.organizationId;
          }
        }
        
        if (report.submittedBy) {
          try {
            const submitter = await getUserById(report.submittedBy);
            enrichedReport.submitterName = submitter?.fullName || submitter?.email || "Unknown";
          } catch (error) {
            enrichedReport.submitterName = "Unknown";
          }
        }
        
        return enrichedReport;
      })
    );
    
    return enriched;
  };

  const getReportTypeName = (code) => {
    const type = reportTypes.find(t => t.code === code);
    return type ? type.name : code;
  };

  const isOverdue = (report) => {
    if (!report.dateSubmitted || report.status === "approved" || report.status === "released") {
      return false;
    }
    const submittedDate = report.dateSubmitted.toDate ? report.dateSubmitted.toDate() : new Date(report.dateSubmitted);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return submittedDate < thirtyDaysAgo;
  };

  const handleViewDetails = async (reportId) => {
    try {
      setLoading(true);
      const report = await getDocumentById(reportId);
      
      const enriched = await enrichReportsWithDetails([report]);
      setSelectedReport(enriched[0]);
      
      const history = await getDocumentStatusHistory(reportId);
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
      setSelectedReportHistory(enrichedHistory);
      
      setShowDetailModal(true);
    } catch (error) {
      console.error("Error loading report details:", error);
      setError("Failed to load report details");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedReport || !newStatus) {
      setError("Please select a status");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await updateDocumentStatus(
        selectedReport.documentId,
        newStatus,
        statusRemarks,
        auth.currentUser.uid
      );
      setSuccess(`Report status updated to ${newStatus}`);
      setShowStatusModal(false);
      setNewStatus("");
      setStatusRemarks("");
      await loadReports();
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

  return (
    <AdminLayout userData={userData} currentPage="reports-compliance">
      {loading && !reports.length ? (
        <LoadingScreen compact={true} />
      ) : (
        <div className="admin-reports-compliance">
        <div className="admin-reports-header">
          <h1 className="admin-reports-title">Reports & Compliance Monitoring</h1>
        </div>

        {/* Filters */}
        <div className="admin-reports-filters">
          <div className="filter-group">
            <label className="filter-label">Report Type</label>
            <select
              className="filter-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              {reportTypes.map(type => (
                <option key={type.code} value={type.code}>{type.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Status</label>
            <select
              className="filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="returned">Returned</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Organization Type</label>
            <select
              className="filter-select"
              value={filterOrgType}
              onChange={(e) => setFilterOrgType(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="ISG">ISG</option>
              <option value="CSG">CSG</option>
              <option value="AO">AO</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Organization Name</label>
            <select
              className="filter-select"
              value={filterOrgName}
              onChange={(e) => setFilterOrgName(e.target.value)}
              disabled={!filterOrgType}
            >
              <option value="">All Organizations</option>
              {availableOrgs.map((org) => (
                <option key={org.organizationId} value={org.organizationId}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="admin-reports-alert admin-reports-alert-error">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        {success && (
          <div className="admin-reports-alert admin-reports-alert-success">
            {success}
            <button onClick={() => setSuccess("")}>×</button>
          </div>
        )}

        <div className="admin-reports-list">
          {enrichedReports.length === 0 ? (
            <div className="admin-reports-empty">
              <p>No reports found</p>
            </div>
          ) : (
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Report Type</th>
                  <th>Organization</th>
                  <th>Submitted By</th>
                  <th>Covered Period</th>
                  <th>Deadline</th>
                  <th>Date Submitted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {enrichedReports.map((report) => (
                  <tr key={report.documentId} className={isOverdue(report) ? "row-overdue" : ""}>
                    <td>{getReportTypeName(report.documentType)}</td>
                    <td>{report.organizationName || report.organizationId}</td>
                    <td>{report.submitterName || "Unknown"}</td>
                    <td>{report.coveredPeriod || "—"}</td>
                    <td>
                      {report.deadline ? formatDate(report.deadline) : "—"}
                      {isOverdue(report) && <span className="overdue-badge">Overdue</span>}
                    </td>
                    <td>{formatDate(report.dateSubmitted)}</td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(report.status)}`}>
                        {getStatusLabel(report.status)}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="action-button action-button-view"
                          onClick={() => handleViewDetails(report.documentId)}
                        >
                          View
                        </button>
                        {report.status !== "released" && report.status !== "pending" && (
                          <button
                            className="action-button action-button-status"
                            onClick={() => {
                              setSelectedReport(report);
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

        {/* Update Status Modal */}
        {showStatusModal && selectedReport && (
          <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Update Report Status</h3>
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
        {showDetailModal && selectedReport && (
          <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
            <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{selectedReport.title}</h3>
                <button className="modal-close" onClick={() => setShowDetailModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="detail-info">
                  <div className="info-row">
                    <span className="info-label">Report Type:</span>
                    <span className="info-value">{getReportTypeName(selectedReport.documentType)}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Status:</span>
                    <span className={`status-badge ${getStatusBadgeClass(selectedReport.status)}`}>
                      {getStatusLabel(selectedReport.status)}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Organization:</span>
                    <span className="info-value">{selectedReport.organizationName || selectedReport.organizationId}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Submitted By:</span>
                    <span className="info-value">{selectedReport.submitterName || "Unknown"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Date Submitted:</span>
                    <span className="info-value">{formatDate(selectedReport.dateSubmitted)}</span>
                  </div>
                  {selectedReport.coveredPeriod && (
                    <div className="info-row">
                      <span className="info-label">Covered Period:</span>
                      <span className="info-value">{selectedReport.coveredPeriod}</span>
                    </div>
                  )}
                  {selectedReport.deadline && (
                    <div className="info-row">
                      <span className="info-label">Deadline:</span>
                      <span className="info-value">{formatDate(selectedReport.deadline)}</span>
                    </div>
                  )}
                  {selectedReport.description && (
                    <div className="info-row-full">
                      <span className="info-label">Description:</span>
                      <p className="info-description">{selectedReport.description}</p>
                    </div>
                  )}
                  {selectedReport.remarks && (
                    <div className="info-row-full">
                      <span className="info-label">Remarks:</span>
                      <p className="info-remarks">{selectedReport.remarks}</p>
                    </div>
                  )}
                  {selectedReport.fileUrl && (
                    <div className="info-row-full">
                      <a
                        href={selectedReport.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="file-download-link"
                      >
                        📄 Download File: {selectedReport.fileName}
                      </a>
                    </div>
                  )}
                </div>

                {/* Status History */}
                <div className="detail-history-section">
                  <h4 className="history-section-title">Status History</h4>
                  {selectedReportHistory.length === 0 ? (
                    <div className="history-empty">No history available</div>
                  ) : (
                    <div className="history-timeline">
                      {selectedReportHistory.map((entry, index) => (
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

export default AdminReportsCompliance;

