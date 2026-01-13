import { useState, useEffect } from "react";
import { auth } from "../config/firebase";
import { getUserById } from "../services/userService";
import AdminLayout from "../components/admin/AdminLayout";
import LoadingScreen from "../components/LoadingScreen";
import "../styles/colors.css";
import "./AdminSystemSettings.css";

const AdminSystemSettings = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("templates");

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

  return (
    <AdminLayout userData={userData} currentPage="settings">
      {loading ? (
        <LoadingScreen compact={true} />
      ) : (
        <div className="admin-system-settings">
        <div className="admin-settings-header">
          <h1 className="admin-settings-title">System Settings</h1>
        </div>

        {error && (
          <div className="admin-settings-alert admin-settings-alert-error">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        {success && (
          <div className="admin-settings-alert admin-settings-alert-success">
            {success}
            <button onClick={() => setSuccess("")}>×</button>
          </div>
        )}

        <div className="admin-settings-content">
          <div className="settings-tabs">
            <button
              className={`settings-tab ${activeTab === "templates" ? "active" : ""}`}
              onClick={() => setActiveTab("templates")}
            >
              Form Templates
            </button>
            <button
              className={`settings-tab ${activeTab === "report-types" ? "active" : ""}`}
              onClick={() => setActiveTab("report-types")}
            >
              Report Types
            </button>
            <button
              className={`settings-tab ${activeTab === "equipment-categories" ? "active" : ""}`}
              onClick={() => setActiveTab("equipment-categories")}
            >
              Equipment Categories
            </button>
            <button
              className={`settings-tab ${activeTab === "audit-logs" ? "active" : ""}`}
              onClick={() => setActiveTab("audit-logs")}
            >
              Audit Logs
            </button>
          </div>

          <div className="settings-panel">
            {activeTab === "templates" && (
              <div className="settings-section">
                <h2>Form Templates</h2>
                <div className="empty-state">
                  <p>No form templates configured</p>
                  <button className="btn-add-item">+ Add Template</button>
                </div>
              </div>
            )}

            {activeTab === "report-types" && (
              <div className="settings-section">
                <h2>Report Types</h2>
                <div className="empty-state">
                  <p>No report types configured</p>
                  <button className="btn-add-item">+ Add Report Type</button>
                </div>
              </div>
            )}

            {activeTab === "equipment-categories" && (
              <div className="settings-section">
                <h2>Equipment Categories</h2>
                <div className="empty-state">
                  <p>No equipment categories configured</p>
                  <button className="btn-add-item">+ Add Category</button>
                </div>
              </div>
            )}

            {activeTab === "audit-logs" && (
              <div className="settings-section">
                <h2>Audit Logs</h2>
                <div className="empty-state">
                  <p>No audit logs available</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </AdminLayout>
  );
};

export default AdminSystemSettings;

