import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./config/firebase";
import { getUserById, updateLastLogin } from "./services/userService";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminOrganizations from "./pages/AdminOrganizations";
import AdminDocuments from "./pages/AdminDocuments";
import AdminActivityProposals from "./pages/AdminActivityProposals";
import AdminReportsCompliance from "./pages/AdminReportsCompliance";
import AdminOutgoingDocuments from "./pages/AdminOutgoingDocuments";
import AdminEquipmentManagement from "./pages/AdminEquipmentManagement";
import AdminNotificationsDeadlines from "./pages/AdminNotificationsDeadlines";
import AdminReportsAnalytics from "./pages/AdminReportsAnalytics";
import AdminSystemSettings from "./pages/AdminSystemSettings";
import AdminProfilePage from "./pages/AdminProfilePage";
import DocumentsPage from "./pages/DocumentsPage";
import ActivityProposalsPage from "./pages/ActivityProposalsPage";
import ReportsCompliancePage from "./pages/ReportsCompliancePage";
import ReferencesDownloadsPage from "./pages/ReferencesDownloadsPage";
import ProfilePage from "./pages/ProfilePage";
import EquipmentBorrowingPage from "./pages/EquipmentBorrowingPage";
import NotificationsPage from "./pages/NotificationsPage";
import LoadingScreen from "./components/LoadingScreen";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [checkingRole, setCheckingRole] = useState(false);
  const [adminPage, setAdminPage] = useState("dashboard");
  const [currentPage, setCurrentPage] = useState("home");
  const lastLoginUpdatedRef = useRef(new Set());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Update lastLogin timestamp for this user (only once per session)
        if (!lastLoginUpdatedRef.current.has(currentUser.uid)) {
          lastLoginUpdatedRef.current.add(currentUser.uid);
          updateLastLogin(currentUser.uid).catch(error => {
            console.error("Error updating last login:", error);
          });
        }

        // Fetch user document to determine role and check organization info
        setCheckingRole(true);
        try {
          const userDoc = await getUserById(currentUser.uid);
          if (userDoc) {
            setUserRole(userDoc.role || null);
          } else {
            setUserRole(null);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUserRole(null);
        } finally {
          setCheckingRole(false);
          setLoading(false);
        }
      } else {
        // Clear the lastLoginUpdated set when user logs out
        lastLoginUpdatedRef.current.clear();
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Check if user has organization info
  const [hasOrgInfo, setHasOrgInfo] = useState(false);
  const [checkingOrgInfo, setCheckingOrgInfo] = useState(false);

  useEffect(() => {
    const checkOrgInfo = async () => {
      if (user) {
        setCheckingOrgInfo(true);
        try {
          const userDoc = await getUserById(user.uid);
          // All three fields must exist and not be empty
          const hasOrgId = userDoc?.organizationId && userDoc.organizationId.trim() !== "";
          const hasRole = userDoc?.role && userDoc.role.trim() !== "";
          const hasUserRole = userDoc?.userRole && userDoc.userRole.trim() !== "";
          
          if (userDoc && hasOrgId && hasRole && hasUserRole) {
            setHasOrgInfo(true);
          } else {
            setHasOrgInfo(false);
          }
        } catch (error) {
          console.error("Error checking user org info:", error);
          setHasOrgInfo(false);
        } finally {
          setCheckingOrgInfo(false);
        }
      } else {
        setHasOrgInfo(false);
      }
    };
    
    checkOrgInfo();
  }, [user]);

  // Handle admin page navigation via window events
  useEffect(() => {
    const handleAdminNavigate = (event) => {
      if (event.detail && typeof event.detail === "string") {
        setAdminPage(event.detail);
      }
    };

    window.addEventListener("adminNavigate", handleAdminNavigate);
    return () => window.removeEventListener("adminNavigate", handleAdminNavigate);
  }, []);

  // Handle regular user page navigation via window events
  useEffect(() => {
    const handlePageNavigate = (event) => {
      if (event.detail && typeof event.detail === "string") {
        setCurrentPage(event.detail);
      }
    };

    window.addEventListener("pageNavigate", handlePageNavigate);
    return () => window.removeEventListener("pageNavigate", handlePageNavigate);
  }, []);

  // Check if OTP verification is in progress
  // If so, stay on AuthPage even if user is briefly authenticated (brief sign-in for validation)
  // This includes both login and registration OTP flows
  const otpInProgress = sessionStorage.getItem("pendingAuth") !== null;

  if (loading || checkingRole || checkingOrgInfo) {
    return <LoadingScreen />;
  }

  // Determine which page to show based on authentication and role
  // For admins, skip organization info check
  // For regular users, show AuthPage if: no user, OTP in progress, or user doesn't have organization info
  if (!user || otpInProgress) {
    return (
      <div className="App">
        <AuthPage />
      </div>
    );
  }

  // Role-based routing: Admin goes to Admin pages, others go to HomePage
  if (userRole === "Admin") {
    // Render appropriate admin page based on adminPage state
    switch (adminPage) {
      case "users":
        return (
          <div className="App">
            <AdminUsers />
          </div>
        );
      case "organizations":
        return (
          <div className="App">
            <AdminOrganizations />
          </div>
        );
      case "documents":
        return (
          <div className="App">
            <AdminDocuments />
          </div>
        );
      case "activity-proposals":
        return (
          <div className="App">
            <AdminActivityProposals />
          </div>
        );
      case "reports-compliance":
        return (
          <div className="App">
            <AdminReportsCompliance />
          </div>
        );
      case "outgoing-documents":
        return (
          <div className="App">
            <AdminOutgoingDocuments />
          </div>
        );
      case "equipment":
        return (
          <div className="App">
            <AdminEquipmentManagement />
          </div>
        );
      case "notifications-deadlines":
        return (
          <div className="App">
            <AdminNotificationsDeadlines />
          </div>
        );
      case "reports-analytics":
        return (
          <div className="App">
            <AdminReportsAnalytics />
          </div>
        );
      case "settings":
        return (
          <div className="App">
            <AdminSystemSettings />
          </div>
        );
      case "profile":
        return (
          <div className="App">
            <AdminProfilePage />
          </div>
        );
      case "dashboard":
      default:
        return (
          <div className="App">
            <AdminDashboard />
          </div>
        );
    }
  }

  // Regular users need organization info
  if (!hasOrgInfo) {
    return (
      <div className="App">
        <AuthPage />
      </div>
    );
  }

  // Regular users - render appropriate page
  switch (currentPage) {
    case "documents":
      return (
        <div className="App">
          <DocumentsPage />
        </div>
      );
    case "activity-proposals":
      return (
        <div className="App">
          <ActivityProposalsPage />
        </div>
      );
    case "reports":
      return (
        <div className="App">
          <ReportsCompliancePage />
        </div>
      );
    case "references":
      return (
        <div className="App">
          <ReferencesDownloadsPage />
        </div>
      );
    case "profile":
      return (
        <div className="App">
          <ProfilePage />
        </div>
      );
    case "equipment":
      return (
        <div className="App">
          <EquipmentBorrowingPage />
        </div>
      );
    case "notifications":
      return (
        <div className="App">
          <NotificationsPage />
        </div>
      );
    case "home":
    default:
      return (
        <div className="App">
          <HomePage />
        </div>
      );
  }
}

export default App;
