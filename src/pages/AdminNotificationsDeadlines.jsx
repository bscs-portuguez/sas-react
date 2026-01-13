import { useState, useEffect } from "react";
import { auth } from "../config/firebase";
import { getUserById } from "../services/userService";
import AdminLayout from "../components/admin/AdminLayout";
import "../styles/colors.css";
import "./AdminNotificationsDeadlines.css";

const AdminNotificationsDeadlines = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getUserById(user.uid);
        setUserData(userDoc);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <AdminLayout userData={userData} currentPage="notifications-deadlines">
        <div className="admin-notifications-loading">Loading...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout userData={userData} currentPage="notifications-deadlines">
      <div className="admin-notifications-deadlines">
        <div className="admin-notifications-header">
          <h1 className="admin-notifications-title">Notifications & Deadlines Management</h1>
        </div>

        {error && (
          <div className="admin-notifications-alert admin-notifications-alert-error">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        {success && (
          <div className="admin-notifications-alert admin-notifications-alert-success">
            {success}
            <button onClick={() => setSuccess("")}>×</button>
          </div>
        )}

        <div className="admin-notifications-content">
          <section className="deadlines-section">
            <div className="section-header">
              <h2>Submission Deadlines</h2>
              <button className="btn-add-deadline">+ Set Deadline</button>
            </div>
            <div className="deadlines-list">
              <div className="empty-state">
                <p>No deadlines set</p>
              </div>
            </div>
          </section>

          <section className="notifications-section">
            <div className="section-header">
              <h2>Send Notifications</h2>
              <button className="btn-send-notification">+ Send Notification</button>
            </div>
            <div className="notifications-list">
              <div className="empty-state">
                <p>No notifications sent</p>
              </div>
            </div>
          </section>

          <section className="overdue-section">
            <div className="section-header">
              <h2>Overdue Summary</h2>
            </div>
            <div className="overdue-summary">
              <div className="summary-card">
                <h3>Overdue Reports</h3>
                <p className="summary-value">0</p>
              </div>
              <div className="summary-card">
                <h3>Overdue Equipment</h3>
                <p className="summary-value">0</p>
              </div>
              <div className="summary-card">
                <h3>Pending Proposals</h3>
                <p className="summary-value">0</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminNotificationsDeadlines;

