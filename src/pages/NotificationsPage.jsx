import { useState, useEffect } from "react";
import { auth } from "../config/firebase";
import { getUserById } from "../services/userService";
import { getOrganizationById } from "../services/organizationService";
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "../services/notificationService";
import Navbar from "../components/Navbar";
import DashboardLayout from "../components/DashboardLayout";
import "../styles/colors.css";
import "./NotificationsPage.css";

const NotificationsPage = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [organizationData, setOrganizationData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState("all"); // "all" | "unread"

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

        await loadNotifications();
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const loadNotifications = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const allNotifications = await getNotifications(user.uid);
      setNotifications(allNotifications);
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      await loadNotifications();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      await markAllNotificationsAsRead(user.uid);
      await loadNotifications();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
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

  const getNotificationIcon = (type) => {
    const icons = {
      deadline: "⏰",
      approval: "✅",
      rejection: "❌",
      returned: "📄",
      overdue: "⚠️",
      info: "ℹ️"
    };
    return icons[type] || "🔔";
  };

  const filteredNotifications = filter === "unread" 
    ? notifications.filter(n => !n.read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="notifications-loading">Loading...</div>
    );
  }

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
      
      <DashboardLayout currentPage="notifications">
        <div className="notifications-page">
          <div className="page-header">
            <div>
              <h1 className="page-title">Notifications</h1>
              <p className="page-subtitle">Stay updated with important updates and deadlines</p>
            </div>
            <div className="header-actions">
              <select
                className="filter-select"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All Notifications</option>
                <option value="unread">Unread ({unreadCount})</option>
              </select>
              {unreadCount > 0 && (
                <button className="btn-mark-all-read" onClick={handleMarkAllAsRead}>
                  Mark All as Read
                </button>
              )}
            </div>
          </div>

          {filteredNotifications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔔</div>
              <p className="empty-message">
                {filter === "unread" ? "No unread notifications" : "No notifications yet"}
              </p>
            </div>
          ) : (
            <div className="notifications-list">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.notificationId}
                  className={`notification-item ${!notification.read ? "unread" : ""}`}
                  onClick={() => {
                    if (!notification.read) {
                      handleMarkAsRead(notification.notificationId);
                    }
                    if (notification.link) {
                      window.dispatchEvent(new CustomEvent("pageNavigate", { detail: notification.link }));
                    }
                  }}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <div className="notification-header">
                      <h3 className="notification-title">{notification.title}</h3>
                      {!notification.read && <span className="unread-dot"></span>}
                    </div>
                    <p className="notification-message">{notification.message}</p>
                    <span className="notification-date">{formatDateTime(notification.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </div>
  );
};

export default NotificationsPage;

