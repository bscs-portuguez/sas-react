import { useState } from "react";
import AdminNavbar from "./AdminNavbar";
import AdminSidebar from "./AdminSidebar";
import "../../styles/colors.css";
import "./AdminLayout.css";

const AdminLayout = ({ children, currentPage = "dashboard", userData = null }) => {
  const [currentAdminPage, setCurrentAdminPage] = useState(currentPage);

  const handleNavigate = (pageId) => {
    setCurrentAdminPage(pageId);
    // Dispatch custom event for App.jsx to handle navigation
    window.dispatchEvent(new CustomEvent("adminNavigate", { detail: pageId }));
  };

  return (
    <div className="admin-layout">
      <AdminNavbar userData={userData} />
      <div className="admin-layout-content">
        <AdminSidebar 
          currentPage={currentAdminPage} 
          onNavigate={handleNavigate}
        />
        <main className="admin-main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;

