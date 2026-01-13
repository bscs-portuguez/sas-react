import { useState, useEffect } from "react";
import { auth } from "../config/firebase";
import { getUserById } from "../services/userService";
import AdminLayout from "../components/admin/AdminLayout";
import LoadingScreen from "../components/LoadingScreen";
import "../styles/colors.css";
import "./AdminReportsAnalytics.css";

const AdminReportsAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState("");

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
    <AdminLayout userData={userData} currentPage="reports-analytics">
      {loading ? (
        <LoadingScreen compact={true} />
      ) : (
        <div className="admin-reports-analytics">
        <div className="admin-reports-analytics-header">
          <h1 className="admin-reports-analytics-title">Reports & Analytics</h1>
        </div>

        {error && (
          <div className="admin-reports-analytics-alert admin-reports-analytics-alert-error">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        <div className="admin-reports-analytics-content">
          <section className="reports-section">
            <div className="section-header">
              <h2>Generate Reports</h2>
            </div>
            <div className="reports-grid">
              <div className="report-card">
                <h3>Monthly Compliance Report</h3>
                <p>Generate compliance report for selected month</p>
                <button className="btn-generate-report">Generate</button>
              </div>
              <div className="report-card">
                <h3>Equipment Usage Report</h3>
                <p>View equipment borrowing statistics</p>
                <button className="btn-generate-report">Generate</button>
              </div>
              <div className="report-card">
                <h3>Document Flow Report</h3>
                <p>Track document submission and processing</p>
                <button className="btn-generate-report">Generate</button>
              </div>
            </div>
          </section>

          <section className="analytics-section">
            <div className="section-header">
              <h2>Analytics Dashboard</h2>
            </div>
            <div className="analytics-placeholder">
              <p>Analytics charts and visualizations will be displayed here</p>
            </div>
          </section>
        </div>
      </div>
      )}
    </AdminLayout>
  );
};

export default AdminReportsAnalytics;

