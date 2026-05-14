import { useState, useEffect } from "react";
import { auth } from "../config/firebase";
import { getUserById } from "../services/userService";
import { getOrganizationById } from "../services/organizationService";
import { 
  searchDocuments, 
  getDocumentById, 
  getDocumentStatusHistory,
  releaseDocument,
  createOutgoingDocument
} from "../services/documentService";
import AdminLayout from "../components/admin/AdminLayout";
import LoadingScreen from "../components/LoadingScreen";
import { formatDate, formatDateTime, getStatusBadgeClass, getStatusLabel } from "../utils/formatters";
import "../styles/colors.css";
import "./AdminOutgoingDocuments.css";

const AdminOutgoingDocuments = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [enrichedDocuments, setEnrichedDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedDocumentHistory, setSelectedDocumentHistory] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [activeTab, setActiveTab] = useState("Memorandums");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add document form state
  const [formData, setFormData] = useState({
    documentType: "",
    orderNumber: "",
    subject: "",
    description: "",
    file: null
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getUserById(user.uid);
        setUserData(userDoc);

        await loadDocuments();
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

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const filters = {
        direction: "outgoing"
      };

      if (filterStatus !== "all") {
        filters.status = filterStatus;
      }

      const docs = await searchDocuments(filters);
      setDocuments(docs);
      
      const enriched = await enrichDocumentsWithDetails(docs);
      setEnrichedDocuments(enriched);
    } catch (error) {
      console.error("Error loading documents:", error);
      setError("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const enrichDocumentsWithDetails = async (docs) => {
    const enriched = await Promise.all(
      docs.map(async (doc) => {
        const enrichedDoc = { ...doc };
        
        if (doc.organizationId) {
          try {
            const organization = await getOrganizationById(doc.organizationId);
            enrichedDoc.organizationName = organization?.name || doc.organizationId;
          } catch {
            enrichedDoc.organizationName = doc.organizationId;
          }
        }
        
        if (doc.releasedTo) {
          try {
            const user = await getUserById(doc.releasedTo);
            enrichedDoc.releasedToName = user?.fullName || user?.email || doc.releasedTo;
          } catch {
            enrichedDoc.releasedToName = doc.releasedTo;
          }
        }

        if (doc.releasedBy) {
          try {
            const user = await getUserById(doc.releasedBy);
            enrichedDoc.releasedByName = user?.fullName || user?.email || "Unknown";
          } catch {
            enrichedDoc.releasedByName = "Unknown";
          }
        }
        
        return enrichedDoc;
      })
    );
    
    return enriched;
  };

  const handleViewDetails = async (documentId) => {
    try {
      setLoading(true);
      const doc = await getDocumentById(documentId);
      
      const enriched = await enrichDocumentsWithDetails([doc]);
      setSelectedDocument(enriched[0]);
      
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
            } catch {
              return { ...entry, changedByName: "Unknown" };
            }
          }
          return { ...entry, changedByName: "Unknown" };
        })
      );
      setSelectedDocumentHistory(enrichedHistory);
      
      setShowDetailModal(true);
    } catch (error) {
      console.error("Error loading document details:", error);
      setError("Failed to load document details");
    } finally {
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
      setShowReleaseModal(false);
      await loadDocuments();
    } catch (error) {
      setError(error.message || "Failed to release document");
    } finally {
      setLoading(false);
    }
  };

  // Filter documents by active tab
  const filteredDocuments = enrichedDocuments.filter((doc) => {
    if (activeTab === "Memorandums") {
      return doc.documentType === "Memorandum";
    } else if (activeTab === "Announcements") {
      return doc.documentType === "Announcement";
    } else if (activeTab === "Others") {
      return doc.documentType !== "Memorandum" && doc.documentType !== "Announcement";
    }
    return true;
  });

  const handleAddDocument = () => {
    setFormData({
      documentType: "",
      orderNumber: "",
      subject: "",
      description: "",
      file: null
    });
    setFormError("");
    setShowAddModal(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, file });
    }
  };

  const handleSubmitDocument = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User not authenticated");
      }

      await createOutgoingDocument(
        {
          documentType: formData.documentType,
          title: formData.subject,
          description: formData.description,
          orderNumber: formData.orderNumber
        },
        formData.file,
        user.uid
      );

      setSuccess("Document created successfully");
      setShowAddModal(false);
      setFormData({
        documentType: "",
        orderNumber: "",
        subject: "",
        description: "",
        file: null
      });
      await loadDocuments();
    } catch (error) {
      console.error("Error creating document:", error);
      setFormError(error.message || "Failed to create document. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout userData={userData} currentPage="outgoing-documents">
      {loading && !documents.length ? (
        <LoadingScreen compact={true} />
      ) : (
        <div className="admin-outgoing-documents">
        <div className="admin-outgoing-header">
          <h1 className="admin-outgoing-title">Outgoing Documents</h1>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <select
              className="filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="released">Released</option>
            </select>
            <button
              className="btn-add-document"
              onClick={handleAddDocument}
            >
              Add Document
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="document-tabs">
          <button
            className={`document-tab ${activeTab === "Memorandums" ? "active" : ""}`}
            onClick={() => setActiveTab("Memorandums")}
          >
            Memorandums
          </button>
          <button
            className={`document-tab ${activeTab === "Announcements" ? "active" : ""}`}
            onClick={() => setActiveTab("Announcements")}
          >
            Announcements
          </button>
          <button
            className={`document-tab ${activeTab === "Others" ? "active" : ""}`}
            onClick={() => setActiveTab("Others")}
          >
            Others
          </button>
        </div>

        {error && (
          <div className="admin-outgoing-alert admin-outgoing-alert-error">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        {success && (
          <div className="admin-outgoing-alert admin-outgoing-alert-success">
            {success}
            <button onClick={() => setSuccess("")}>×</button>
          </div>
        )}

        <div className="admin-outgoing-list">
          {filteredDocuments.length === 0 ? (
            <div className="admin-outgoing-empty">
              <p>No {activeTab.toLowerCase()} found</p>
            </div>
          ) : (
            <table className="outgoing-table">
              <thead>
                <tr>
                  <th>Reference Number</th>
                  <th>Document Type</th>
                  <th>Title</th>
                  <th>In Response To</th>
                  <th>Released To</th>
                  <th>Date Released</th>
                  <th>Released By</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((doc) => (
                  <tr key={doc.documentId}>
                    <td>{doc.documentNumber || doc.referenceNumber || "—"}</td>
                    <td>{doc.documentType}</td>
                    <td className="table-title">{doc.title}</td>
                    <td>
                      {doc.responseTo ? (
                        <span className="response-link" title={`Response to document: ${doc.responseTo}`}>
                          📝 Response
                        </span>
                      ) : (
                        <span className="no-response">—</span>
                      )}
                    </td>
                    <td>{doc.releasedToName || doc.releasedTo || "—"}</td>
                    <td>{doc.dateReleased ? formatDate(doc.dateReleased) : "—"}</td>
                    <td>{doc.releasedByName || "Unknown"}</td>
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
                        {doc.status === "approved" && (
                          <button
                            className="action-button action-button-release"
                            onClick={() => {
                              setSelectedDocument(doc);
                              setShowReleaseModal(true);
                            }}
                          >
                            Release
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

        {/* Release Confirmation Modal */}
        {showReleaseModal && selectedDocument && (
          <div className="modal-overlay" onClick={() => setShowReleaseModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Release Document</h3>
              <p>Are you sure you want to release "{selectedDocument.title}"?</p>
              <p className="modal-warning">This action cannot be undone.</p>
              <div className="modal-actions">
                <button className="form-button form-button-secondary" onClick={() => setShowReleaseModal(false)}>
                  Cancel
                </button>
                <button className="form-button form-button-primary" onClick={handleRelease}>
                  Release Document
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
                    <span className="info-label">Reference Number:</span>
                    <span className="info-value">{selectedDocument.documentNumber || selectedDocument.referenceNumber || "Not assigned"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Status:</span>
                    <span className={`status-badge ${getStatusBadgeClass(selectedDocument.status)}`}>
                      {getStatusLabel(selectedDocument.status)}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Document Type:</span>
                    <span className="info-value">{selectedDocument.documentType}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Released To:</span>
                    <span className="info-value">{selectedDocument.releasedToName || selectedDocument.releasedTo || "—"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Date Released:</span>
                    <span className="info-value">{selectedDocument.dateReleased ? formatDate(selectedDocument.dateReleased) : "—"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Released By:</span>
                    <span className="info-value">{selectedDocument.releasedByName || "Unknown"}</span>
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

                {/* Linked Incoming Document Section */}
                {selectedDocument.responseTo && (
                  <div className="linked-incoming-section">
                    <h4 className="linked-incoming-title">In Response To</h4>
                    <div className="linked-incoming-card">
                      <div className="linked-incoming-header">
                        <span className="linked-incoming-type">Incoming Document</span>
                      </div>
                      <div className="linked-incoming-id">
                        <strong>Document ID:</strong> {selectedDocument.responseTo}
                      </div>
                      <p className="linked-incoming-hint">
                        This outgoing document was generated as a response to the incoming document referenced above.
                      </p>
                    </div>
                  </div>
                )}

                {/* Status History */}
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

        {/* Add Document Modal */}
        {showAddModal && (
          <div className="modal-overlay" onClick={() => {
            if (!submitting) {
              setShowAddModal(false);
              setFormData({
                documentType: "",
                orderNumber: "",
                subject: "",
                description: "",
                file: null
              });
              setFormError("");
            }
          }}>
            <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Add Outgoing Document</h3>
                {!submitting && (
                  <button className="modal-close" onClick={() => {
                    setShowAddModal(false);
                    setFormData({
                      documentType: "",
                      orderNumber: "",
                      subject: "",
                      description: "",
                      file: null
                    });
                    setFormError("");
                  }}>×</button>
                )}
              </div>
              <form onSubmit={handleSubmitDocument}>
                <div className="modal-body">
                  {formError && (
                    <div className="form-error">{formError}</div>
                  )}

                  <div className="form-group">
                    <label htmlFor="documentType" className="form-label">
                      Type <span className="required">*</span>
                    </label>
                    <select
                      id="documentType"
                      className="form-input"
                      value={formData.documentType}
                      onChange={(e) => {
                        setFormData({ ...formData, documentType: e.target.value, orderNumber: "" });
                        setFormError("");
                      }}
                      required
                    >
                      <option value="">Select Type</option>
                      <option value="Memorandum">Memorandum</option>
                      <option value="Announcement">Announcement</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {formData.documentType === "Memorandum" && (
                    <>
                      <div className="form-group">
                        <label htmlFor="orderNumber" className="form-label">
                          Order Number <span className="required">*</span>
                        </label>
                        <input
                          type="text"
                          id="orderNumber"
                          className="form-input"
                          value={formData.orderNumber}
                          onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                          placeholder="e.g., MEMO-2024-001"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="subject" className="form-label">
                          Subject <span className="required">*</span>
                        </label>
                        <input
                          type="text"
                          id="subject"
                          className="form-input"
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="description" className="form-label">
                          Description <span className="required">*</span>
                        </label>
                        <textarea
                          id="description"
                          className="form-input"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={4}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="file" className="form-label">
                          Upload Document/Image <span className="required">*</span>
                        </label>
                        <input
                          type="file"
                          id="file"
                          className="form-input-file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                          onChange={handleFileChange}
                          required
                        />
                        <span className="form-hint">Accepted formats: PDF, Word, JPG, PNG, WEBP (Max 50MB)</span>
                        {formData.file && (
                          <div className="file-selected">
                            <span>Selected: {formData.file.name}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {formData.documentType === "Announcement" && (
                    <>
                      <div className="form-group">
                        <label htmlFor="subject" className="form-label">
                          Subject <span className="required">*</span>
                        </label>
                        <input
                          type="text"
                          id="subject"
                          className="form-input"
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="description" className="form-label">
                          Description <span className="required">*</span>
                        </label>
                        <textarea
                          id="description"
                          className="form-input"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={4}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="file" className="form-label">
                          Upload Document/Image (Optional)
                        </label>
                        <input
                          type="file"
                          id="file"
                          className="form-input-file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                          onChange={handleFileChange}
                        />
                        <span className="form-hint">Accepted formats: PDF, Word, JPG, PNG, WEBP (Max 50MB)</span>
                        {formData.file && (
                          <div className="file-selected">
                            <span>Selected: {formData.file.name}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {formData.documentType === "Other" && (
                    <>
                      <div className="form-group">
                        <label htmlFor="subject" className="form-label">
                          Subject <span className="required">*</span>
                        </label>
                        <input
                          type="text"
                          id="subject"
                          className="form-input"
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="description" className="form-label">
                          Description <span className="required">*</span>
                        </label>
                        <textarea
                          id="description"
                          className="form-input"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={4}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="file" className="form-label">
                          Upload Document/Image (Optional)
                        </label>
                        <input
                          type="file"
                          id="file"
                          className="form-input-file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                          onChange={handleFileChange}
                        />
                        <span className="form-hint">Accepted formats: PDF, Word, JPG, PNG, WEBP (Max 50MB)</span>
                        {formData.file && (
                          <div className="file-selected">
                            <span>Selected: {formData.file.name}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="form-button form-button-secondary"
                      onClick={() => {
                        setShowAddModal(false);
                        setFormError("");
                      }}
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="form-button form-button-primary"
                      disabled={submitting || !formData.documentType}
                    >
                      {submitting ? "Creating..." : "Create Document"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      )}
    </AdminLayout>
  );
};

export default AdminOutgoingDocuments;

