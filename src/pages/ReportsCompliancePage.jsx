import { useState, useEffect } from "react";
import { auth } from "../config/firebase";
import { getUserById } from "../services/userService";
import { getOrganizationById } from "../services/organizationService";
import { getDocumentsByOrganization, getDocumentById, getDocumentStatusHistory } from "../services/documentService";
import Navbar from "../components/Navbar";
import DashboardLayout from "../components/DashboardLayout";
import LoadingScreen from "../components/LoadingScreen";
import "../styles/colors.css";
import "./ReportsCompliancePage.css";

const ReportsCompliancePage = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [organizationData, setOrganizationData] = useState(null);
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedReportHistory, setSelectedReportHistory] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const reportTypes = [
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

        if (userDoc?.organizationId) {
          const orgDoc = await getOrganizationById(userDoc.organizationId);
          setOrganizationData(orgDoc);

          // Fetch all reports
          const docs = await getDocumentsByOrganization(userDoc.organizationId);
          const reportDocs = docs.filter(doc => 
            reportTypes.some(type => type.code === doc.documentType)
          );
          setReports(reportDocs);
          setFilteredReports(reportDocs);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (filterType === "all") {
      setFilteredReports(reports);
    } else {
      setFilteredReports(reports.filter(r => r.documentType === filterType));
    }
  }, [filterType, reports]);

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

  const getReportTypeName = (code) => {
    const type = reportTypes.find(t => t.code === code);
    return type ? type.name : code;
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

  const isOverdue = (report) => {
    if (!report.dateSubmitted || report.status === "approved" || report.status === "released") {
      return false;
    }
    const submittedDate = report.dateSubmitted.toDate ? report.dateSubmitted.toDate() : new Date(report.dateSubmitted);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return submittedDate < thirtyDaysAgo;
  };

  const handleSubmitSuccess = async () => {
    setShowSubmitForm(false);
    setSelectedReportType("");
    // Reload reports
    const user = auth.currentUser;
    if (user && userData?.organizationId) {
      const docs = await getDocumentsByOrganization(userData.organizationId);
      const reportDocs = docs.filter(doc => 
        reportTypes.some(type => type.code === doc.documentType)
      );
      setReports(reportDocs);
    }
  };

  const handleViewReport = async (reportId) => {
    try {
      setLoadingDetail(true);
      const doc = await getDocumentById(reportId);
      setSelectedReport(doc);
      
      // Fetch status history
      const history = await getDocumentStatusHistory(reportId);
      setSelectedReportHistory(history);
    } catch (error) {
      console.error("Error loading report details:", error);
    } finally {
      setLoadingDetail(false);
    }
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
      
      <DashboardLayout currentPage="reports">
        {loading ? (
          <LoadingScreen compact={true} />
        ) : (
        <div className="reports-compliance-page">
          <div className="page-header">
            <h1 className="page-title">Reports & Compliance</h1>
            <div className="header-actions">
              <select
                className="filter-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Reports</option>
                {reportTypes.map(type => (
                  <option key={type.code} value={type.code}>{type.name}</option>
                ))}
              </select>
              <button 
                className="btn-primary"
                onClick={() => setShowSubmitForm(true)}
                disabled={verificationStatus !== "verified"}
              >
                + Upload Report
              </button>
            </div>
          </div>

          {reports.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <p className="empty-message">No reports submitted yet</p>
              <p className="empty-hint">Upload your first report to get started</p>
            </div>
          ) : (
            <div className="reports-table-container">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Report Type</th>
                    <th>Covered Period</th>
                    <th>Deadline</th>
                    <th>Date Submitted</th>
                    <th>Status</th>
                    <th>Remarks</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => (
                    <tr key={report.documentId} className={isOverdue(report) ? "row-overdue" : ""}>
                      <td className="table-type">{getReportTypeName(report.documentType)}</td>
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
                      <td className="table-remarks">
                        {report.remarks ? (
                          <span title={report.remarks}>
                            {report.remarks.length > 50 
                              ? `${report.remarks.substring(0, 50)}...` 
                              : report.remarks}
                          </span>
                        ) : "—"}
                      </td>
                      <td>
                        <button
                          className="btn-view"
                          onClick={() => handleViewReport(report.documentId)}
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

          {/* Submit Form Modal */}
          {showSubmitForm && (
            <div className="modal-overlay" onClick={() => setShowSubmitForm(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <ReportSubmissionForm
                  reportTypes={reportTypes}
                  selectedType={selectedReportType}
                  onTypeSelect={setSelectedReportType}
                  onSuccess={handleSubmitSuccess}
                  onCancel={() => {
                    setShowSubmitForm(false);
                    setSelectedReportType("");
                  }}
                />
              </div>
            </div>
          )}

          {/* Detail View Modal */}
          {selectedReport && (
            <div className="modal-overlay" onClick={() => setSelectedReport(null)}>
              <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>{selectedReport.title}</h3>
                  <button className="modal-close" onClick={() => setSelectedReport(null)}>×</button>
                </div>
                <div className="modal-body">
                  {loadingDetail ? (
                    <div className="loading-state">Loading...</div>
                  ) : (
                    <>
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

// Report Submission Form Component
const ReportSubmissionForm = ({ reportTypes, selectedType, onTypeSelect, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    reportType: selectedType || "",
    title: "",
    description: "",
    coveredPeriod: "",
    deadline: "",
    file: null
  });
  const [error, setError] = useState("");
  const [filePreview, setFilePreview] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ];
      
      if (!allowedTypes.includes(file.type)) {
        setError("Invalid file type. Please upload a PDF or Word document.");
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        setError("File size exceeds 50MB limit.");
        return;
      }

      setFormData({ ...formData, file });
      setFilePreview(file.name);
      setError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!formData.reportType) {
        throw new Error("Please select a report type");
      }
      if (!formData.title.trim()) {
        throw new Error("Please enter a report title");
      }
      if (!formData.description.trim()) {
        throw new Error("Please enter a description");
      }
      if (!formData.file) {
        throw new Error("Please upload a report file");
      }

      const user = auth.currentUser;
      if (!user) {
        throw new Error("User not found");
      }

      const { getUserById } = await import("../services/userService");
      const userDoc = await getUserById(user.uid);
      if (!userDoc?.organizationId) {
        throw new Error("Organization information not found");
      }

      const documentData = {
        documentType: formData.reportType,
        title: formData.title.trim(),
        description: formData.description.trim(),
        direction: "incoming",
        coveredPeriod: formData.coveredPeriod.trim() || undefined,
        deadline: formData.deadline ? new Date(formData.deadline) : undefined
      };

      const { submitDocument } = await import("../services/documentService");
      await submitDocument(documentData, formData.file, user.uid);

      setFormData({
        reportType: "",
        title: "",
        description: "",
        coveredPeriod: "",
        deadline: "",
        file: null
      });
      setFilePreview(null);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error submitting report:", error);
      setError(error.message || "Failed to submit report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="report-submission-form">
      <div className="form-header">
        <h2>Upload Report</h2>
        {onCancel && (
          <button className="close-button" onClick={onCancel}>×</button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="report-form">
        {error && <div className="form-error">{error}</div>}

        <div className="form-group">
          <label htmlFor="reportType" className="form-label">
            Report Type <span className="required">*</span>
          </label>
          <select
            id="reportType"
            className="form-select"
            value={formData.reportType}
            onChange={(e) => {
              setFormData({ ...formData, reportType: e.target.value });
              onTypeSelect(e.target.value);
            }}
            required
          >
            <option value="">Select report type</option>
            {reportTypes.map(type => (
              <option key={type.code} value={type.code}>{type.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="title" className="form-label">
            Report Title <span className="required">*</span>
          </label>
          <input
            type="text"
            id="title"
            className="form-input"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter report title"
            maxLength={200}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="coveredPeriod" className="form-label">
            Covered Period
          </label>
          <input
            type="text"
            id="coveredPeriod"
            className="form-input"
            value={formData.coveredPeriod}
            onChange={(e) => setFormData({ ...formData, coveredPeriod: e.target.value })}
            placeholder="e.g., January 2024 - March 2024"
          />
        </div>

        <div className="form-group">
          <label htmlFor="deadline" className="form-label">
            Deadline
          </label>
          <input
            type="date"
            id="deadline"
            className="form-input"
            value={formData.deadline}
            onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="description" className="form-label">
            Description <span className="required">*</span>
          </label>
          <textarea
            id="description"
            className="form-textarea"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the report..."
            rows={4}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="file" className="form-label">
            Report File <span className="required">*</span>
          </label>
          <div className="file-upload-area">
            <input
              type="file"
              id="file"
              className="file-input"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              required
            />
            <label htmlFor="file" className="file-label">
              {filePreview ? (
                <span className="file-preview">📄 {filePreview}</span>
              ) : (
                <span className="file-placeholder">
                  <span className="file-icon">📎</span>
                  <span>Click to upload or drag and drop</span>
                  <span className="file-hint">PDF, DOC, DOCX (Max 50MB)</span>
                </span>
              )}
            </label>
            {filePreview && (
              <button
                type="button"
                className="file-remove"
                onClick={() => {
                  setFormData({ ...formData, file: null });
                  setFilePreview(null);
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="form-actions">
          {onCancel && (
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Uploading..." : "Upload Report"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReportsCompliancePage;

