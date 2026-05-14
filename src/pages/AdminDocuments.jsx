import { useState, useEffect } from "react";
import { auth } from "../config/firebase";
import { getUserById } from "../services/userService";
import { getOrganizationById, getOrganizationsByType } from "../services/organizationService";
import { 
  searchDocuments,
  assignDocumentNumber,
  updateDocumentStatus,
  releaseDocument,
  getDocumentById,
  getDocumentStatusHistory,
  getResponseTypeForIncoming,
  getOutgoingDocumentsForIncoming
} from "../services/documentService";
import AdminLayout from "../components/admin/AdminLayout";
import LoadingScreen from "../components/LoadingScreen";
import ResponseDocumentModal from "../components/documents/ResponseDocumentModal";
import { formatDate, formatDateTime, getStatusBadgeClass, getStatusLabel } from "../utils/formatters";
import "../styles/colors.css";
import "./AdminDocuments.css";

const AdminDocuments = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [enrichedDocuments, setEnrichedDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedDocumentHistory, setSelectedDocumentHistory] = useState([]);
  const currentDirection = "incoming";
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filter states (for incoming documents)
  const [searchTitle, setSearchTitle] = useState("");
  const [filterDocumentType, setFilterDocumentType] = useState("");
  const [filterOrgType, setFilterOrgType] = useState("");
  const [filterOrgName, setFilterOrgName] = useState("");
  const [availableOrgs, setAvailableOrgs] = useState([]);

  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [documentNumber, setDocumentNumber] = useState("");
  const [statusRemarks, setStatusRemarks] = useState("");
  const [newStatus, setNewStatus] = useState("");

  // Response document modal states
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [generateResponse, setGenerateResponse] = useState(false);
  const [linkedOutgoingDocs, setLinkedOutgoingDocs] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getUserById(user.uid);
        setUserData(userDoc);

        await loadDocuments("incoming");
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load organizations when org type filter changes
  useEffect(() => {
    const loadOrganizations = async () => {
      if (filterOrgType) {
        try {
          const orgs = await getOrganizationsByType(filterOrgType);
          setAvailableOrgs(orgs);
          // Reset org name filter if current selection is not in new list
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

  // Reload documents when filters change (for incoming documents) - with debounce for search
  useEffect(() => {
    if (currentDirection !== "incoming") return;

    const timeoutId = setTimeout(() => {
      loadDocuments("incoming");
    }, searchTitle ? 500 : 0); // Debounce search input by 500ms

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTitle, filterDocumentType, filterOrgType, filterOrgName, currentDirection]);

  const loadDocuments = async (direction) => {
    try {
      setLoading(true);
      
      const filters = {
        direction: direction
      };

      // Apply filters for incoming documents
      if (direction === "incoming") {
        if (filterDocumentType) {
          filters.documentType = filterDocumentType;
        }
        if (filterOrgName) {
          filters.organizationId = filterOrgName;
        }
        if (searchTitle) {
          filters.searchTerm = searchTitle;
        }
      }

      const docs = await searchDocuments(filters);
      setDocuments(docs);
      
      // Enrich documents with user and organization data
      const enriched = await enrichDocumentsWithDetails(docs);
      setEnrichedDocuments(enriched);
    } catch (error) {
      console.error("Error loading documents:", error);
      setError("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  // Enrich documents with submitter and organization information
  const enrichDocumentsWithDetails = async (docs) => {
    const enriched = await Promise.all(
      docs.map(async (doc) => {
        const enrichedDoc = { ...doc };
        
        // Fetch submitter information
        if (doc.submittedBy) {
          try {
            const submitter = await getUserById(doc.submittedBy);
            enrichedDoc.submitterName = submitter?.fullName || submitter?.email || "Unknown";
            enrichedDoc.submitterEmail = submitter?.email || "";
          } catch (error) {
            console.error(`Error fetching submitter for document ${doc.documentId}:`, error);
            enrichedDoc.submitterName = "Unknown";
            enrichedDoc.submitterEmail = "";
          }
        }
        
        // Fetch organization information
        if (doc.organizationId) {
          try {
            const organization = await getOrganizationById(doc.organizationId);
            enrichedDoc.organizationName = organization?.name || doc.organizationId;
          } catch (error) {
            console.error(`Error fetching organization for document ${doc.documentId}:`, error);
            enrichedDoc.organizationName = doc.organizationId;
          }
        }
        
        return enrichedDoc;
      })
    );
    
    return enriched;
  };

  const handleAssignNumber = async () => {
    if (!selectedDocument || !documentNumber.trim()) {
      setError("Please enter a document number");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await assignDocumentNumber(
        selectedDocument.documentId,
        documentNumber.trim(),
        auth.currentUser.uid
      );
      setSuccess(`Document number ${documentNumber} assigned successfully`);
      setShowAssignModal(false);
      setDocumentNumber("");
      await loadDocuments(currentDirection);
    } catch (error) {
      setError(error.message || "Failed to assign document number");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedDocument || !newStatus) {
      setError("Please select a status");
      return;
    }

    // If approving an incoming document and generateResponse is checked, show response modal
    if (newStatus === "approved" && generateResponse && currentDirection === "incoming") {
      setShowStatusModal(false);
      setShowResponseModal(true);
      return;
    }

    try {
      setLoading(true);
      setError("");
      await updateDocumentStatus(
        selectedDocument.documentId,
        newStatus,
        statusRemarks,
        auth.currentUser.uid,
        false,
        null
      );
      setSuccess(`Document status updated to ${newStatus}`);
      setShowStatusModal(false);
      setNewStatus("");
      setStatusRemarks("");
      setGenerateResponse(false);
      await loadDocuments(currentDirection);
    } catch (error) {
      setError(error.message || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const handleResponseSubmit = async (responseData) => {
    try {
      setLoading(true);
      setError("");
      
      await updateDocumentStatus(
        selectedDocument.documentId,
        "approved",
        statusRemarks,
        auth.currentUser.uid,
        true,
        responseData
      );
      
      setSuccess(`Document approved and ${getResponseTypeForIncoming(selectedDocument.documentType).label} created successfully`);
      setShowResponseModal(false);
      setNewStatus("");
      setStatusRemarks("");
      setGenerateResponse(false);
      await loadDocuments(currentDirection);
    } catch (error) {
      setError(error.message || "Failed to create response document");
      setLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!selectedDocument) return;

    if (!window.confirm("Are you sure you want to release this document? This action cannot be undone.")) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      await releaseDocument(selectedDocument.documentId, auth.currentUser.uid);
      setSuccess("Document released successfully");
      await loadDocuments(currentDirection);
    } catch (error) {
      setError(error.message || "Failed to release document");
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (documentId) => {
    try {
      setLoading(true);
      const doc = await getDocumentById(documentId);
      
      // Enrich with submitter and organization info
      const enriched = await enrichDocumentsWithDetails([doc]);
      setSelectedDocument(enriched[0]);
      
      // Fetch status history and enrich with user names
      const history = await getDocumentStatusHistory(documentId);
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
              console.error("Error fetching history user:", error);
              return { ...entry, changedByName: "Unknown" };
            }
          }
          return { ...entry, changedByName: "Unknown" };
        })
      );
      setSelectedDocumentHistory(enrichedHistory);
      
      // Fetch linked outgoing documents if this is an incoming document
      if (doc.direction === "incoming") {
        const outgoingDocs = await getOutgoingDocumentsForIncoming(documentId);
        setLinkedOutgoingDocs(outgoingDocs);
      } else {
        setLinkedOutgoingDocs([]);
      }
      
      setShowDetailModal(true);
    } catch (error) {
      console.error("Error loading document details:", error);
      setError("Failed to load document details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout userData={userData} currentPage="documents">
      {loading && !documents.length ? (
        <LoadingScreen compact={true} />
      ) : (
        <div className="admin-documents">
        <div className="admin-documents-header">
          <h1 className="admin-documents-title">Incoming Documents</h1>
        </div>

        {error && (
          <div className="admin-documents-alert admin-documents-alert-error">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        {success && (
          <div className="admin-documents-alert admin-documents-alert-success">
            {success}
            <button onClick={() => setSuccess("")}>×</button>
          </div>
        )}

        {/* Filters for Incoming Documents */}
        <div className="admin-documents-filters">
            <div className="filter-group">
              <label htmlFor="search-title" className="filter-label">Search Title</label>
              <input
                id="search-title"
                type="text"
                className="filter-input"
                placeholder="Search by document title..."
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label htmlFor="filter-doc-type" className="filter-label">Document Type</label>
              <select
                id="filter-doc-type"
                className="filter-select"
                value={filterDocumentType}
                onChange={(e) => setFilterDocumentType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="activity_proposal">Activity Proposal</option>
                <option value="accomplishment_report">Accomplishment Report</option>
                <option value="financial_report">Financial Report</option>
                <option value="financial_statement">Financial Statement</option>
                <option value="compliance">Compliance Document</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="filter-org-type" className="filter-label">Organization Type</label>
              <select
                id="filter-org-type"
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
              <label htmlFor="filter-org-name" className="filter-label">Organization Name</label>
              <select
                id="filter-org-name"
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

        <div className="admin-documents-list">
          {documents.length === 0 ? (
            <div className="admin-documents-empty">
              <p>No documents found</p>
            </div>
          ) : (
            <table className="documents-table">
              <thead>
                <tr>
                  <th>Document #</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Direction</th>
                  <th>Organization</th>
                  <th>Submitted By</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {enrichedDocuments.map((doc) => (
                  <tr key={doc.documentId}>
                    <td>{doc.documentNumber || "—"}</td>
                    <td className="table-title">{doc.title}</td>
                    <td>{doc.documentType}</td>
                    <td>
                      <span className="capitalize">{doc.direction || "—"}</span>
                    </td>
                    <td>{doc.organizationName || doc.organizationId}</td>
                    <td>{doc.submitterName || "Unknown"}</td>
                    <td>{formatDate(doc.dateSubmitted)}</td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(doc.status)}`}>
                        {getStatusLabel(doc.status)}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="action-button action-button-view"
                          onClick={() => handleViewDetails(doc.documentId)}
                        >
                          View
                        </button>
                        {doc.status === "pending" && !doc.documentNumber && (
                          <button
                            className="action-button action-button-assign"
                            onClick={() => {
                              setSelectedDocument(doc);
                              setShowAssignModal(true);
                            }}
                          >
                            Assign #
                          </button>
                        )}
                        {doc.status !== "released" && doc.status !== "pending" && (
                          <>
                            <button
                              className="action-button action-button-status"
                              onClick={() => {
                                setSelectedDocument(doc);
                                setNewStatus("");
                                setStatusRemarks("");
                                setShowStatusModal(true);
                              }}
                            >
                              Update Status
                            </button>
                            {doc.status === "approved" && (
                              <button
                                className="action-button action-button-release"
                                onClick={() => {
                                  setSelectedDocument(doc);
                                  handleRelease();
                                }}
                              >
                                Release
                              </button>
                            )}
                          </>
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
        {showAssignModal && (
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
                  placeholder="e.g., DOC-2024-001"
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
        {showStatusModal && (
          <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Update Document Status</h3>
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
              
              {/* Generate Response Document Option - Only for incoming documents when approving */}
              {currentDirection === "incoming" && newStatus === "approved" && selectedDocument && (
                <div className="form-group generate-response-section">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={generateResponse}
                      onChange={(e) => setGenerateResponse(e.target.checked)}
                    />
                    <span className="checkbox-text">
                      Generate {getResponseTypeForIncoming(selectedDocument.documentType).label}
                    </span>
                  </label>
                  <span className="form-hint">
                    Create an outgoing response document linked to this approval
                  </span>
                </div>
              )}
              
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
        {showDetailModal && selectedDocument && (
          <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
            <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{selectedDocument.title}</h3>
                <button className="modal-close" onClick={() => setShowDetailModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="detail-info">
                  <div className="info-row">
                    <span className="info-label">Document Number:</span>
                    <span className="info-value">{selectedDocument.documentNumber || "Not assigned"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Status:</span>
                    <span className={`status-badge ${getStatusBadgeClass(selectedDocument.status)}`}>
                      {getStatusLabel(selectedDocument.status)}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Type:</span>
                    <span className="info-value">{selectedDocument.documentType}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Organization:</span>
                    <span className="info-value">{selectedDocument.organizationName || selectedDocument.organizationId}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Submitted By:</span>
                    <span className="info-value">
                      {selectedDocument.submitterName || "Unknown"}
                      {selectedDocument.submitterEmail && (
                        <span className="info-email"> ({selectedDocument.submitterEmail})</span>
                      )}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Direction:</span>
                    <span className="info-value capitalize">{selectedDocument.direction}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Submitted:</span>
                    <span className="info-value">{formatDate(selectedDocument.dateSubmitted)}</span>
                  </div>
                  {selectedDocument.description && (
                    <div className="info-row-full">
                      <span className="info-label">Description:</span>
                      <p className="info-description">{selectedDocument.description}</p>
                    </div>
                  )}
                  {selectedDocument.remarks && (
                    <div className="info-row-full">
                      <span className="info-label">Remarks:</span>
                      <p className="info-remarks">{selectedDocument.remarks}</p>
                    </div>
                  )}
                  {selectedDocument.fileUrl && (
                    <div className="info-row-full">
                      <a
                        href={selectedDocument.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="file-download-link"
                      >
                        📄 Download File: {selectedDocument.fileName}
                      </a>
                    </div>
                  )}
                </div>

                {/* Linked Outgoing Documents Section */}
                {selectedDocument.direction === "incoming" && (
                  <div className="detail-linked-documents-section">
                    <h4 className="linked-documents-title">Response Documents</h4>
                    {linkedOutgoingDocs.length === 0 ? (
                      <div className="linked-documents-empty">
                        {selectedDocument.status === "approved" ? (
                          <span className="hint">No response document created yet</span>
                        ) : (
                          <span className="hint">Will be available after approval</span>
                        )}
                      </div>
                    ) : (
                      <div className="linked-documents-list">
                        {linkedOutgoingDocs.map((doc) => (
                          <div key={doc.documentId} className="linked-document-card">
                            <div className="linked-doc-header">
                              <span className={`status-badge ${getStatusBadgeClass(doc.status)}`}>
                                {getStatusLabel(doc.status)}
                              </span>
                              <span className="linked-doc-type">{doc.documentType.replace(/_/g, " ")}</span>
                            </div>
                            <div className="linked-doc-title">{doc.title}</div>
                            {doc.documentNumber && (
                              <div className="linked-doc-number">{doc.documentNumber}</div>
                            )}
                            {doc.fileUrl && (
                              <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="linked-doc-download"
                              >
                                📄 Download Response
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Status History Section */}
                <div className="detail-history-section">
                  <h4 className="history-section-title">Status History</h4>
                  {selectedDocumentHistory.length === 0 ? (
                    <div className="history-empty">No history available</div>
                  ) : (
                    <div className="history-timeline">
                      {selectedDocumentHistory.map((entry, index) => (
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

        {/* Response Document Modal */}
        {showResponseModal && selectedDocument && (
          <ResponseDocumentModal
            incomingDocument={selectedDocument}
            onSubmit={handleResponseSubmit}
            onCancel={() => {
              setShowResponseModal(false);
              setGenerateResponse(false);
            }}
            isProcessing={loading}
          />
        )}
      </div>
      )}
    </AdminLayout>
  );
};

export default AdminDocuments;

