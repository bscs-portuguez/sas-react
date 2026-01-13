import { useState, useEffect } from "react";
import { getDocumentStatusHistory } from "../../services/documentService";
import "../../styles/colors.css";
import "./DocumentDetail.css";

const DocumentDetail = ({ document, onBack }) => {
  const [statusHistory, setStatusHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await getDocumentStatusHistory(document.documentId);
        setStatusHistory(history);
      } catch (error) {
        console.error("Error fetching status history:", error);
      } finally {
        setLoadingHistory(false);
      }
    };

    if (document) {
      fetchHistory();
    }
  }, [document]);

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

  const handleDownload = () => {
    if (document.fileUrl) {
      window.open(document.fileUrl, "_blank");
    }
  };

  return (
    <div className="document-detail">
      <div className="document-detail-header">
        <button className="document-detail-back" onClick={onBack}>
          ← Back to List
        </button>
      </div>

      <div className="document-detail-content">
        <div className="document-detail-main">
          <div className="document-detail-title-section">
            <h2 className="document-detail-title">{document.title}</h2>
            <span className={`status-badge ${getStatusBadgeClass(document.status)}`}>
              {getStatusLabel(document.status)}
            </span>
          </div>

          <div className="document-detail-info">
            <div className="info-row">
              <span className="info-label">Document Number:</span>
              <span className="info-value">
                {document.documentNumber || "Not assigned"}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">Type:</span>
              <span className="info-value">{document.documentType}</span>
            </div>

            <div className="info-row">
              <span className="info-label">Submitted:</span>
              <span className="info-value">{formatDate(document.dateSubmitted)}</span>
            </div>

            {document.dateAssigned && (
              <div className="info-row">
                <span className="info-label">Date Assigned:</span>
                <span className="info-value">{formatDate(document.dateAssigned)}</span>
              </div>
            )}

            {document.dateReviewed && (
              <div className="info-row">
                <span className="info-label">Date Reviewed:</span>
                <span className="info-value">{formatDate(document.dateReviewed)}</span>
              </div>
            )}

            {document.dateReleased && (
              <div className="info-row">
                <span className="info-label">Date Released:</span>
                <span className="info-value">{formatDate(document.dateReleased)}</span>
              </div>
            )}

            {document.description && (
              <div className="info-row-full">
                <span className="info-label">Description:</span>
                <p className="info-description">{document.description}</p>
              </div>
            )}

            {document.remarks && (
              <div className="info-row-full">
                <span className="info-label">Remarks:</span>
                <p className="info-remarks">{document.remarks}</p>
              </div>
            )}
          </div>

          {document.fileUrl && (
            <div className="document-detail-file">
              <button className="file-download-button" onClick={handleDownload}>
                <span className="file-download-icon">📄</span>
                <span className="file-download-text">Download File</span>
                <span className="file-download-name">{document.fileName}</span>
              </button>
            </div>
          )}
        </div>

        <div className="document-detail-history">
          <h3 className="history-title">Status History</h3>
          {loadingHistory ? (
            <div className="history-loading">Loading history...</div>
          ) : statusHistory.length === 0 ? (
            <div className="history-empty">No history available</div>
          ) : (
            <div className="history-timeline">
              {statusHistory.map((entry, index) => (
                <div key={entry.historyId || index} className="history-item">
                  <div className="history-item-dot"></div>
                  <div className="history-item-content">
                    <div className="history-item-header">
                      <span className={`status-badge ${getStatusBadgeClass(entry.status)}`}>
                        {getStatusLabel(entry.status)}
                      </span>
                      <span className="history-item-date">{formatDate(entry.timestamp)}</span>
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
  );
};

export default DocumentDetail;

