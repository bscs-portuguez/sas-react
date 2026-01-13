import { useState, useEffect } from "react";
import { auth } from "../config/firebase";
import { getUserById } from "../services/userService";
import { getOrganizationById } from "../services/organizationService";
import Navbar from "../components/Navbar";
import DashboardLayout from "../components/DashboardLayout";
import DocumentSubmission from "../components/documents/DocumentSubmission";
import DocumentList from "../components/documents/DocumentList";
import LoadingScreen from "../components/LoadingScreen";
import "../styles/colors.css";
import "../styles/home.css";
import "./DocumentsPage.css";

const DocumentsPage = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [organizationData, setOrganizationData] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState("pending");
  const [view, setView] = useState("list"); // "list" or "submit"
  const [refreshKey, setRefreshKey] = useState(0);
  const [filterType, setFilterType] = useState("all");
  
  // Document types for filtering (excluding activity proposals and reports which have their own pages)
  const documentTypes = [
    { code: "all", name: "All Documents" },
    { code: "compliance_document", name: "Compliance Document" },
    { code: "other", name: "Other" }
  ];

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

  const handleSubmissionSuccess = () => {
    setView("list");
    setRefreshKey(prev => prev + 1); // Force refresh of document list
  };

  const organizationName = organizationData?.name || "Organization";
  const userRole = userData?.role || "ISG";
  const userName = userData?.fullName || auth.currentUser?.email || "User";
  const isUnverified = verificationStatus === "unverified";

  return (
    <div className="documents-page">
      <Navbar
        organizationName={organizationName}
        role={userRole}
        verificationStatus={verificationStatus}
        userName={userName}
      />
      <DashboardLayout currentPage="documents">
        {loading ? (
          <LoadingScreen compact={true} />
        ) : (
          <div className="documents-page-content">
          <div className="documents-page-header">
            <h1 className="documents-page-title">Document Submissions</h1>
            <div className="documents-page-actions">
              {view === "list" ? (
                <>
                  <select
                    className="documents-filter-select"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    {documentTypes.map(type => (
                      <option key={type.code} value={type.code}>{type.name}</option>
                    ))}
                  </select>
                  <button
                    className="documents-page-button"
                    onClick={() => {
                      if (!isUnverified) {
                        setView("submit");
                      }
                    }}
                    disabled={isUnverified}
                    title={isUnverified ? "Please verify your account to submit documents" : ""}
                  >
                    + Submit New Document
                  </button>
                </>
              ) : (
                <button
                  className="documents-page-button documents-page-button-secondary"
                  onClick={() => setView("list")}
                >
                  ← Back to List
                </button>
              )}
            </div>
          </div>

          {view === "submit" ? (
            <div className="documents-page-submit">
              <DocumentSubmission
                onSuccess={handleSubmissionSuccess}
                onCancel={() => setView("list")}
              />
            </div>
          ) : (
            <div className="documents-page-list">
              <DocumentList 
                key={refreshKey} 
                filters={filterType !== "all" ? { documentType: filterType } : {}} 
              />
            </div>
          )}
        </div>
        )}
      </DashboardLayout>
    </div>
  );
};

export default DocumentsPage;

