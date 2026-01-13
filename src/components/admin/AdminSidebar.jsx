import { useState } from "react";
import Icon from "../Icon";
import "../../styles/colors.css";
import "./AdminSidebar.css";

const AdminSidebar = ({ currentPage = "dashboard", onNavigate }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const menuItems = [
    { id: "dashboard", label: "Dashboard Overview", icon: "dashboard" },
    { id: "activity-proposals", label: "Activity Proposals", icon: "activity-proposals" },
    { id: "reports-compliance", label: "Reports & Compliance", icon: "reports" },
    { id: "documents", label: "Incoming Documents", icon: "incoming" },
    { id: "outgoing-documents", label: "Outgoing Documents", icon: "outgoing" },
    { id: "equipment", label: "Equipment Management", icon: "equipment-management" },
    { id: "users", label: "User Accounts", icon: "profile" },
    { id: "organizations", label: "Organizations", icon: "building" },
    { id: "reports-analytics", label: "Reports & Analytics", icon: "analytics" },
    { id: "settings", label: "System Settings", icon: "settings" },
  ];

  const handleMenuClick = (item) => {
    if (onNavigate) {
      onNavigate(item.id);
    } else {
      console.log(`Navigate to ${item.id}`);
    }
  };

  return (
    <aside className={`admin-sidebar ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
      <button 
        className="admin-sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
      >
        <Icon name={sidebarOpen ? "chevron-left" : "chevron-right"} size={16} className="sidebar-toggle-icon" />
      </button>
      
      <nav className="admin-sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`admin-sidebar-nav-item ${currentPage === item.id ? "active" : ""}`}
            onClick={() => handleMenuClick(item)}
            title={sidebarOpen ? "" : item.label}
          >
            <span className="admin-sidebar-nav-icon">
              <Icon name={item.icon} size={24} />
            </span>
            {sidebarOpen && <span className="admin-sidebar-nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
};

export default AdminSidebar;

