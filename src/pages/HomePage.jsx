import { useState, useEffect } from "react";
import { auth } from "../config/firebase";
import { getUserById } from "../services/userService";
import { getOrganizationById } from "../services/organizationService";
import { getReleasedOutgoingDocuments } from "../services/documentService";
import Navbar from "../components/Navbar";
import DashboardLayout from "../components/DashboardLayout";
import StatusBanner from "../components/StatusBanner";
import LoadingScreen from "../components/LoadingScreen";
import "../styles/colors.css";
import "../styles/home.css";
import "./HomePage.css";

const HomePage = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [organizationData, setOrganizationData] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState("pending");
  const [outgoingDocuments, setOutgoingDocuments] = useState([]);
  const [activeTab, setActiveTab] = useState("memorandums"); // "memorandums" | "announcements"
  const [selectedDocument, setSelectedDocument] = useState(null);

  const fetchUserData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Fetch user document from Firestore
      const userDoc = await getUserById(user.uid);
      if (userDoc) {
        setUserData(userDoc);
        
        // Get verification status (default to "unverified" if not set)
        const status = userDoc.verificationStatus || "unverified";
        setVerificationStatus(status);

        // Fetch organization data
        if (userDoc.organizationId) {
          const orgDoc = await getOrganizationById(userDoc.organizationId);
          if (orgDoc) {
            setOrganizationData(orgDoc);
          }
        }

        // Fetch released outgoing documents (memorandums and announcements)
        const documents = await getReleasedOutgoingDocuments();
        setOutgoingDocuments(documents);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

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

  // Filter documents by active tab
  const filteredDocuments = outgoingDocuments.filter((doc) => {
    if (activeTab === "memorandums") {
      return doc.documentType === "Memorandum";
    } else {
      return doc.documentType === "Announcement";
    }
  });

  const memorandumsCount = outgoingDocuments.filter(doc => doc.documentType === "Memorandum").length;
  const announcementsCount = outgoingDocuments.filter(doc => doc.documentType === "Announcement").length;

  const organizationName = organizationData?.name || "Organization";
  const role = userData?.role || "ISG";
  const userRole = userData?.userRole || "";
  const userName = userData?.fullName || auth.currentUser?.email || "User";
  const isVerified = verificationStatus === "verified";

  return (
    <div className="home-container">
      <Navbar
        organizationName={organizationName}
        role={role}
        userRole={userRole}
        verificationStatus={verificationStatus}
        userName={userName}
      />
      
      <DashboardLayout currentPage="dashboard">
        {loading ? (
          <LoadingScreen compact={true} />
        ) : (
        <div className="dashboard-content">
          {/* Status Banner */}
          <StatusBanner verificationStatus={verificationStatus} />

          {/* Welcome Section */}
          <section className="welcome-section">
            <div className="welcome-header">
              <h1 className="welcome-title">
                Welcome, {userName}
              </h1>
              <div className="welcome-org-info">
                <span className="welcome-org-label">Representing:</span>
                <span className="welcome-org-name">{organizationName}</span>
              </div>
            </div>
            {verificationStatus === "unverified" && (
              <div className="welcome-status-message welcome-status-message--unverified">
                <span className="status-icon">⚪</span>
                <span>You are an Unverified User.</span>
                <a 
                  href="#"
                  className="verify-account-link"
                  onClick={(e) => {
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent("pageNavigate", { detail: "profile" }));
                  }}
                >
                  Verify Account
                </a>
              </div>
            )}
            {verificationStatus === "pending" && (
              <div className="welcome-status-message">
                <span className="status-icon">🟡</span>
                <span>Your account is under review by SAS.</span>
              </div>
            )}
            {verificationStatus === "verified" && (
              <div className="welcome-status-message welcome-status-message--verified">
                <span className="status-icon">🟢</span>
                <span>Your account is verified. You have full access to all features.</span>
              </div>
            )}
            {verificationStatus === "rejected" && (
              <div className="welcome-status-message welcome-status-message--rejected">
                <span className="status-icon">🔴</span>
                <span>Please update your information or contact SAS for assistance.</span>
              </div>
            )}
          </section>

          {/* Posts from SAS Section */}
          <section className="outgoing-documents-section">
            <div className="section-header-with-tabs">
              <h2 className="section-title">Posts from SAS</h2>
              <div className="document-tabs">
                <button
                  className={`tab-btn ${activeTab === "memorandums" ? "active" : ""}`}
                  onClick={() => setActiveTab("memorandums")}
                >
                  Memorandums ({memorandumsCount})
                </button>
                <button
                  className={`tab-btn ${activeTab === "announcements" ? "active" : ""}`}
                  onClick={() => setActiveTab("announcements")}
                >
                  Announcements ({announcementsCount})
                </button>
              </div>
            </div>
            {filteredDocuments.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📄</div>
                <p className="empty-message">
                  {outgoingDocuments.length === 0 
                    ? "No posts available" 
                    : `No ${activeTab === "memorandums" ? "memorandums" : "announcements"} available`}
                </p>
              </div>
            ) : (
              <div className="documents-list">
                {filteredDocuments.map((document) => (
                  <div 
                    key={document.documentId} 
                    className="document-card"
                    onClick={() => setSelectedDocument(document)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="document-card-header">
                      <div className="document-type-badge">
                        {document.documentType}
                      </div>
                      {document.documentNumber && (
                        <span className="document-number">{document.documentNumber}</span>
                      )}
                    </div>
                    <h3 className="document-title">{document.title}</h3>
                    {document.description && (
                      <p className="document-description">
                        {document.description.length > 200
                          ? `${document.description.substring(0, 200)}...`
                          : document.description}
                      </p>
                    )}
                    <div className="document-card-footer">
                      <div className="document-meta">
                        <span className="document-date">
                          Released: {formatDate(document.dateReleased || document.dateSubmitted)}
                        </span>
                      </div>
                      {document.fileUrl && (
                        <a
                          href={document.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="document-download-btn"
                          onClick={(e) => e.stopPropagation()}
                        >
                          📥 Download
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
        )}

        {/* Document Detail Modal */}
        {selectedDocument && (
          <div className="modal-overlay" onClick={() => setSelectedDocument(null)}>
            <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{selectedDocument.title}</h3>
                <button className="modal-close" onClick={() => setSelectedDocument(null)}>×</button>
              </div>
              <div className="modal-body">
                <div className="document-detail-info">
                  <div className="info-row">
                    <span className="info-label">Document Type:</span>
                    <span className="info-value">
                      <span className="document-type-badge-small">{selectedDocument.documentType}</span>
                    </span>
                  </div>
                  {selectedDocument.documentNumber && (
                    <div className="info-row">
                      <span className="info-label">Document Number:</span>
                      <span className="info-value">{selectedDocument.documentNumber}</span>
                    </div>
                  )}
                  <div className="info-row">
                    <span className="info-label">Date Submitted:</span>
                    <span className="info-value">{formatDateTime(selectedDocument.dateSubmitted)}</span>
                  </div>
                  {selectedDocument.dateReleased && (
                    <div className="info-row">
                      <span className="info-label">Date Released:</span>
                      <span className="info-value">{formatDateTime(selectedDocument.dateReleased)}</span>
                    </div>
                  )}
                  {selectedDocument.dateReviewed && (
                    <div className="info-row">
                      <span className="info-label">Date Reviewed:</span>
                      <span className="info-value">{formatDateTime(selectedDocument.dateReviewed)}</span>
                    </div>
                  )}
                  {selectedDocument.description && (
                    <div className="info-row-full">
                      <span className="info-label">Description:</span>
                      <p className="info-description">{selectedDocument.description}</p>
                    </div>
                  )}
                  {selectedDocument.fileUrl && (
                    <div className="info-row-full">
                      <span className="info-label">Attached File:</span>
                      <a
                        href={selectedDocument.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="file-download-link"
                        title={selectedDocument.fileName || "Download File"}
                      >
                        <span className="file-name-text">
                          📄 {(() => {
                            const fileName = selectedDocument.fileName || "Download File";
                            if (fileName.length <= 40) return fileName;
                            const extension = fileName.substring(fileName.lastIndexOf('.'));
                            const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
                            const maxLength = 40 - extension.length - 3; // 3 for "..."
                            return nameWithoutExt.substring(0, maxLength) + "..." + extension;
                          })()}
                        </span>
                        {selectedDocument.fileSize && (
                          <span className="file-size">
                            {" "}({(selectedDocument.fileSize / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        )}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </div>
  );
};

export default HomePage;

