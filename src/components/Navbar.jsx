import { useState, useRef, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../config/firebase";
import { getUnreadNotificationCount } from "../services/notificationService";
import Icon from "./Icon";
import sasLogo from "../assets/images/logos/sas-logo.png";
import "../styles/colors.css";
import "./Navbar.css";

const Navbar = ({ 
  organizationName = "Organization",
  role = "ISG",
  userRole = "",
  verificationStatus = "pending",
  userName = "User"
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef(null);
  const notificationsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const loadNotificationCount = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const count = await getUnreadNotificationCount(user.uid);
          setUnreadCount(count);
        }
      } catch (error) {
        console.error("Error loading notification count:", error);
      }
    };

    loadNotificationCount();
    // Refresh notification count every 30 seconds
    const interval = setInterval(loadNotificationCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const getVerificationStatus = () => {
    switch (verificationStatus) {
      case "verified":
        return "Verified";
      case "rejected":
        return "Rejected";
      case "pending":
        return "Pending";
      default:
        return "Unverified";
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <div className="navbar-logo-container">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <img src={sasLogo} alt="SAS Logo" className="navbar-logo-img" />
            <div className="navbar-logo">SAS</div>
          </div>
          <div className="navbar-app-name">Student Affairs and Services</div>
        </div>
      </div>
      
      <div className="navbar-center">
        <div className="navbar-info-badge">
          <span className="navbar-info-text">
            {organizationName}: {userRole || role} ({getVerificationStatus()})
          </span>
        </div>
        <div className="navbar-notifications" ref={notificationsRef}>
          <button
            className="navbar-notification-button"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            aria-label="Notifications"
          >
            <Icon name="bell" size={20} />
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
            )}
          </button>
          {showNotifications && (
            <div className="notifications-dropdown">
              <div className="notifications-dropdown-header">
                <h3>Notifications</h3>
                <button
                  className="notifications-view-all"
                  onClick={() => {
                    setShowNotifications(false);
                    window.dispatchEvent(new CustomEvent("pageNavigate", { detail: "notifications" }));
                  }}
                >
                  View All
                </button>
              </div>
              <div className="notifications-dropdown-content">
                {unreadCount === 0 ? (
                  <div className="notifications-empty">No new notifications</div>
                ) : (
                  <div className="notifications-preview">
                    <p>You have {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}</p>
                    <button
                      className="notifications-go-to-page"
                      onClick={() => {
                        setShowNotifications(false);
                        window.dispatchEvent(new CustomEvent("pageNavigate", { detail: "notifications" }));
                      }}
                    >
                      View Notifications
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="navbar-right">

        <div className="navbar-user-menu" ref={menuRef}>
          <button 
            className="navbar-user-button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-label="User menu"
          >
            <Icon name="profile" size={20} className="user-avatar navbar-icon-white" />
            <span className="user-name">{userName}</span>
            <Icon name={showUserMenu ? "chevron-up" : "chevron-down"} size={14} className="menu-arrow navbar-icon-white" />
          </button>
          
          {showUserMenu && (
            <div className="user-menu-dropdown">
              <button className="user-menu-item" onClick={() => {
                setShowUserMenu(false);
                window.dispatchEvent(new CustomEvent("pageNavigate", { detail: "profile" }));
              }}>
                <Icon name="profile" size={18} />
                <span>Profile</span>
              </button>
              <div className="user-menu-divider"></div>
              <button className="user-menu-item user-menu-item--danger" onClick={handleLogout}>
                <Icon name="lock" size={18} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

