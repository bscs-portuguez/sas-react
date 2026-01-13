import { useState, useEffect } from "react";
import { auth } from "../config/firebase";
import { getUserById } from "../services/userService";
import { getDashboardStats, getRecentActivity } from "../services/adminService";
import AdminLayout from "../components/admin/AdminLayout";
import StatsCard from "../components/admin/StatsCard";
import VerificationQueue from "../components/admin/VerificationQueue";
import LoadingScreen from "../components/LoadingScreen";
import "../styles/colors.css";
import "./AdminDashboard.css";

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [currentView, setCurrentView] = useState("overview");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;

        if (!user) return;

        // Fetch admin user data
        const userDoc = await getUserById(user.uid);
        if (userDoc) {
          setUserData(userDoc);
          
          // Check if user is actually an admin
          if (userDoc.role !== "Admin") {
            // Redirect to user dashboard - this shouldn't happen due to App.jsx routing
            // but adding as safety check
            console.warn("Non-admin user accessed admin dashboard");
            return;
          }

          // Check if admin account is active
          if (userDoc.status !== "active") {
            // Show blocked message
            setLoading(false);
            return;
          }
        }

        // Fetch dashboard statistics
        const dashboardStats = await getDashboardStats();
        setStats(dashboardStats);

        // Fetch recent activity
        const activity = await getRecentActivity();
        setRecentActivity(activity);
      } catch (error) {
        console.error("Error fetching admin data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Check if admin account is inactive
  if (userData && userData.status !== "active") {
    return (
      <div className="admin-dashboard-blocked">
        <div className="blocked-message">
          <h2>Access Blocked</h2>
          <p>Your administrator account is inactive. Please contact system administrator.</p>
        </div>
      </div>
    );
  }

  // Check if user is not admin (safety check)
  if (userData && userData.role !== "Admin") {
    return (
      <div className="admin-dashboard-blocked">
        <div className="blocked-message">
          <h2>Access Denied</h2>
          <p>You do not have permission to access the admin dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout userData={userData} currentPage="dashboard">
      {loading ? (
        <LoadingScreen compact={true} />
      ) : (
      <div className="admin-dashboard">
        {currentView === "overview" && (
          <>
            {/* Dashboard Header */}
            <div className="admin-dashboard-header">
              <h1 className="admin-dashboard-title">Admin Dashboard</h1>
              <p className="admin-dashboard-subtitle">System Overview & Management</p>
            </div>

            {/* Statistics Cards */}
            {stats && (
              <>
                <section className="admin-stats-section">
                  <h2 className="section-title">Overview</h2>
                  <div className="stats-grid">
                    <StatsCard
                      title="Pending Proposals"
                      value={stats.pendingProposals || 0}
                      icon="📝"
                      color="warning"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("adminNavigate", { detail: "activity-proposals" }));
                      }}
                    />
                    <StatsCard
                      title="Late Reports"
                      value={stats.lateReports || 0}
                      icon="📊"
                      color="error"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("adminNavigate", { detail: "reports-compliance" }));
                      }}
                    />
                    <StatsCard
                      title="Overdue Equipment"
                      value={stats.overdueEquipment || 0}
                      icon="🔧"
                      color="error"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("adminNavigate", { detail: "equipment" }));
                      }}
                    />
                    <StatsCard
                      title="Incoming Documents"
                      value={stats.incomingDocuments || 0}
                      icon="📥"
                      color="info"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("adminNavigate", { detail: "documents" }));
                      }}
                    />
                  </div>
                </section>

                <section className="admin-stats-section">
                  <h2 className="section-title">System Statistics</h2>
                  <div className="stats-grid">
                    <StatsCard
                      title="Total Users"
                      value={stats.totalUsers}
                      icon="👥"
                      color="maroon"
                    />
                    <StatsCard
                      title="Pending Verifications"
                      value={stats.pendingVerifications}
                      icon="⏳"
                      color="warning"
                    />
                    <StatsCard
                      title="Verified Users"
                      value={stats.verifiedUsers}
                      icon="✅"
                      color="success"
                    />
                    <StatsCard
                      title="Active Organizations"
                      value={stats.activeOrganizations}
                      icon="🏢"
                      color="info"
                    />
                  </div>
                </section>
              </>
            )}

            {/* Quick Actions */}
            <section className="admin-quick-actions">
              <h2 className="section-title">Quick Actions</h2>
              <div className="quick-actions-grid">
                <button
                  className="quick-action-button"
                  onClick={() => setCurrentView("verification")}
                >
                  <span className="quick-action-icon">✅</span>
                  <span className="quick-action-label">Review Verifications</span>
                  {stats?.pendingVerifications > 0 && (
                    <span className="quick-action-badge">{stats.pendingVerifications}</span>
                  )}
                </button>
                <button
                  className="quick-action-button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("adminNavigate", { detail: "users" }));
                  }}
                >
                  <span className="quick-action-icon">👥</span>
                  <span className="quick-action-label">Manage Users</span>
                </button>
                <button
                  className="quick-action-button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("adminNavigate", { detail: "organizations" }));
                  }}
                >
                  <span className="quick-action-icon">🏢</span>
                  <span className="quick-action-label">Manage Organizations</span>
                </button>
                <button
                  className="quick-action-button"
                  onClick={() => console.log("Navigate to announcements")}
                >
                  <span className="quick-action-icon">📢</span>
                  <span className="quick-action-label">Manage Announcements</span>
                </button>
              </div>
            </section>

            {/* Recent Activity */}
            <section className="admin-recent-activity">
              <h2 className="section-title">Recent Activity</h2>
              {recentActivity.length === 0 ? (
                <div className="activity-empty">
                  <p>No recent activity to display.</p>
                </div>
              ) : (
                <div className="activity-list">
                  {recentActivity.slice(0, 10).map((activity, index) => (
                    <div key={index} className="activity-item">
                      <div className="activity-icon">📋</div>
                      <div className="activity-content">
                        <p className="activity-description">{activity.description}</p>
                        <span className="activity-time">
                          {activity.timestamp?.toDate?.()?.toLocaleString() || "Recently"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {currentView === "verification" && (
          <div className="admin-verification-view">
            <div className="verification-view-header">
              <button
                className="back-button"
                onClick={() => setCurrentView("overview")}
              >
                ← Back to Dashboard
              </button>
            </div>
            <VerificationQueue />
          </div>
        )}
      </div>
      )}
    </AdminLayout>
  );
  
};

export default AdminDashboard;

