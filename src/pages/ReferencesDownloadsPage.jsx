import { useState, useEffect } from "react";
import { auth } from "../config/firebase";
import { getUserById } from "../services/userService";
import { getOrganizationById } from "../services/organizationService";
import Navbar from "../components/Navbar";
import DashboardLayout from "../components/DashboardLayout";
import LoadingScreen from "../components/LoadingScreen";
import "../styles/colors.css";
import "./ReferencesDownloadsPage.css";

const ReferencesDownloadsPage = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [organizationData, setOrganizationData] = useState(null);

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
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const references = [
    {
      category: "Student Handbook",
      items: [
        { name: "EARIST Student Handbook 2024", type: "PDF", size: "2.5 MB", url: "#" }
      ]
    },
    {
      category: "SAS Forms",
      items: [
        { name: "Activity Proposal Form", type: "PDF", size: "150 KB", url: "#" },
        { name: "Equipment Borrowing Request Form", type: "PDF", size: "120 KB", url: "#" },
        { name: "Accomplishment Report Template", type: "DOCX", size: "85 KB", url: "#" },
        { name: "Financial Report Template", type: "XLSX", size: "95 KB", url: "#" }
      ]
    },
    {
      category: "Guidelines",
      items: [
        { name: "Document Submission Guidelines", type: "PDF", size: "1.2 MB", url: "#" },
        { name: "Equipment Borrowing Guidelines", type: "PDF", size: "980 KB", url: "#" },
        { name: "Organization Registration Guidelines", type: "PDF", size: "750 KB", url: "#" },
        { name: "Event Planning Guidelines", type: "PDF", size: "1.5 MB", url: "#" }
      ]
    }
  ];

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
      
      <DashboardLayout currentPage="references">
        {loading ? (
          <LoadingScreen compact={true} />
        ) : (
        <div className="references-downloads-page">
          <div className="page-header">
            <h1 className="page-title">References & Downloads</h1>
            <p className="page-subtitle">Access official documents, forms, and guidelines</p>
          </div>

          <div className="references-content">
            {references.map((category, index) => (
              <div key={index} className="reference-category">
                <h2 className="category-title">{category.category}</h2>
                <div className="reference-items">
                  {category.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="reference-item">
                      <div className="item-icon">
                        {item.type === "PDF" ? "📄" : item.type === "DOCX" ? "📝" : item.type === "XLSX" ? "📊" : "📎"}
                      </div>
                      <div className="item-info">
                        <h3 className="item-name">{item.name}</h3>
                        <div className="item-meta">
                          <span className="item-type">{item.type}</span>
                          <span className="item-size">{item.size}</span>
                        </div>
                      </div>
                      <button className="item-download-btn" onClick={() => {
                        // TODO: Implement actual download functionality
                        alert(`Downloading ${item.name}...`);
                      }}>
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
      </DashboardLayout>
    </div>
  );
};

export default ReferencesDownloadsPage;

