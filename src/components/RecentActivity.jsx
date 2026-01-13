import "../styles/colors.css";
import "./RecentActivity.css";

const RecentActivity = ({ activities = [] }) => {
  // Mock data if no activities provided
  const mockActivities = activities.length > 0 ? activities : [
    {
      id: 1,
      type: "submission",
      title: "Request submitted",
      description: "Your request #REQ-001 has been submitted",
      date: "2 hours ago",
      status: "pending"
    },
    {
      id: 2,
      type: "update",
      title: "Status update",
      description: "Your request #REQ-002 is under review",
      date: "1 day ago",
      status: "in_review"
    },
    {
      id: 3,
      type: "feedback",
      title: "Admin feedback",
      description: "New feedback on your submission",
      date: "3 days ago",
      status: "reviewed"
    }
  ];

  const getStatusIcon = (status) => {
    switch (status) {
      case "pending":
        return "⏳";
      case "in_review":
        return "👀";
      case "reviewed":
        return "✅";
      case "approved":
        return "✓";
      case "rejected":
        return "✗";
      default:
        return "•";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "var(--warning)";
      case "in_review":
        return "var(--info)";
      case "reviewed":
      case "approved":
        return "var(--success)";
      case "rejected":
        return "var(--error)";
      default:
        return "var(--gray)";
    }
  };

  return (
    <div className="recent-activity">
      <h3 className="recent-activity-title">Recent Activity</h3>
      {mockActivities.length === 0 ? (
        <div className="recent-activity-empty">
          <p>No recent activity to display.</p>
        </div>
      ) : (
        <div className="recent-activity-list">
          {mockActivities.map((activity) => (
            <div key={activity.id} className="activity-item">
              <div 
                className="activity-status-indicator"
                style={{ backgroundColor: getStatusColor(activity.status) }}
              >
                {getStatusIcon(activity.status)}
              </div>
              <div className="activity-content">
                <div className="activity-header">
                  <span className="activity-title">{activity.title}</span>
                  <span className="activity-date">{activity.date}</span>
                </div>
                <p className="activity-description">{activity.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentActivity;


