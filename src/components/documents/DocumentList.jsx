import { useState, useEffect, useMemo, useRef } from "react";
import { auth } from "../../config/firebase";
import { getUserById } from "../../services/userService";
import { getDocumentsByOrganization, getDocumentById } from "../../services/documentService";
import DocumentDetail from "./DocumentDetail";
import "../../styles/colors.css";
import "./DocumentList.css";

const DocumentList = ({ filters = {}, onDocumentSelect }) => {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [userData, setUserData] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [error, setError] = useState("");
  const isMountedRef = useRef(true);

  // Memoize filters to prevent unnecessary re-renders
  const filtersString = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        setError("");
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }

        const userDoc = await getUserById(user.uid);
        if (!isMountedRef.current) return;
        
        setUserData(userDoc);

        if (!userDoc?.organizationId) {
          setError("Organization not found");
          setLoading(false);
          return;
        }

        const parsedFilters = JSON.parse(filtersString);
        const docs = await getDocumentsByOrganization(userDoc.organizationId, parsedFilters);
        
        if (!isMountedRef.current) return;
        setDocuments(docs);
      } catch (error) {
        console.error("Error fetching documents:", error);
        if (isMountedRef.current) {
          setError("Failed to load documents");
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchDocuments();
  }, [filtersString]);

  const handleDocumentClick = async (documentId) => {
    try {
      const doc = await getDocumentById(documentId);
      setSelectedDocument(doc);
      if (onDocumentSelect) {
        onDocumentSelect(doc);
      }
    } catch (error) {
      console.error("Error fetching document details:", error);
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

  if (selectedDocument) {
    return (
      <DocumentDetail
        document={selectedDocument}
        onBack={() => setSelectedDocument(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="document-list-loading">
        <div className="loading-spinner">Loading documents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="document-list-error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="document-list">
      <div className="document-list-header">
        <h2 className="document-list-title">My Documents</h2>
        <span className="document-list-count">{documents.length} document(s)</span>
      </div>

      {documents.length === 0 ? (
        <div className="document-list-empty">
          <div className="empty-icon">📄</div>
          <p className="empty-message">No documents found</p>
          <p className="empty-hint">Submit your first document to get started</p>
        </div>
      ) : (
        <div className="document-list-grid">
          {documents.map((doc) => (
            <div
              key={doc.documentId}
              className="document-card"
              onClick={() => handleDocumentClick(doc.documentId)}
            >
              <div className="document-card-header">
                <h3 className="document-card-title">{doc.title}</h3>
                <span className={`status-badge ${getStatusBadgeClass(doc.status)}`}>
                  {getStatusLabel(doc.status)}
                </span>
              </div>

              <div className="document-card-body">
                {doc.documentNumber && (
                  <div className="document-card-field">
                    <span className="field-label">Document #:</span>
                    <span className="field-value">{doc.documentNumber}</span>
                  </div>
                )}

                <div className="document-card-field">
                  <span className="field-label">Type:</span>
                  <span className="field-value">{doc.documentType}</span>
                </div>

                <div className="document-card-field">
                  <span className="field-label">Submitted:</span>
                  <span className="field-value">{formatDate(doc.dateSubmitted)}</span>
                </div>

                {doc.description && (
                  <div className="document-card-description">
                    {doc.description.length > 100
                      ? `${doc.description.substring(0, 100)}...`
                      : doc.description}
                  </div>
                )}
              </div>

              <div className="document-card-footer">
                <span className="document-card-action">View Details →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentList;

