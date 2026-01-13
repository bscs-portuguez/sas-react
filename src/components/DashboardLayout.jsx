import { useState } from "react";
import Icon from "./Icon";
import "../styles/colors.css";
import "./DashboardLayout.css";

const DashboardLayout = ({ children, currentPage = "dashboard" }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard", path: "/dashboard" },
    { id: "activity-proposals", label: "Activity Proposals", icon: "activity-proposals", path: "/activity-proposals" },
    { id: "reports", label: "Reports & Compliance", icon: "reports", path: "/reports" },
    { id: "documents", label: "Document Submissions", icon: "documents", path: "/documents" },
    { id: "equipment", label: "Equipment Borrowing", icon: "equipment", path: "/equipment" },
    { id: "references", label: "References & Downloads", icon: "references", path: "/references" },
    { id: "profile", label: "Profile", icon: "profile", path: "/profile" },
  ];

  const handleMenuClick = (item) => {
    // Map menu item IDs to page identifiers
    const pageMap = {
      dashboard: "home",  // Dashboard maps to home page
      "activity-proposals": "activity-proposals",
      reports: "reports",
      documents: "documents",
      equipment: "equipment",
      references: "references",
      profile: "profile"
    };
    
    const pageId = pageMap[item.id] || item.id;
    
    // Dispatch navigation event that App.jsx listens to
    window.dispatchEvent(new CustomEvent("pageNavigate", { detail: pageId }));
  };

  return (
    <div className="dashboard-layout">
      <aside className={`dashboard-sidebar ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
        <button 
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle sidebar"
        >
          <Icon name={sidebarOpen ? "chevron-left" : "chevron-right"} size={16} className="sidebar-toggle-icon" />
        </button>
        
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`sidebar-nav-item ${currentPage === item.id ? "active" : ""}`}
              onClick={() => handleMenuClick(item)}
              title={sidebarOpen ? "" : item.label}
            >
              <span className="sidebar-nav-icon">
                <Icon name={item.icon} size={24} />
              </span>
              {sidebarOpen && <span className="sidebar-nav-label">{item.label}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="dashboard-main">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;

