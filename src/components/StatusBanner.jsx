import "../styles/colors.css";
import "./StatusBanner.css";

const StatusBanner = ({ verificationStatus }) => {
  if (verificationStatus === "verified") {
    return null; // Don't show banner if verified
  }
  
  // Always show banner for unverified, pending, or rejected status

  const getStatusConfig = () => {
    switch (verificationStatus) {
      case "unverified":
        return {
          icon: "⚪",
          message: "You are an Unverified User. Please upload a verification document to proceed.",
          bgColor: "var(--gray-light)",
          textColor: "var(--gray-dark)",
        };
      case "pending":
        return {
          icon: "🟡",
          message: "Your account is under review by SAS.",
          bgColor: "var(--warning)",
          textColor: "var(--gray-dark)",
        };
      case "rejected":
        return {
          icon: "🔴",
          message: "Please update your information or contact SAS.",
          bgColor: "var(--error)",
          textColor: "var(--white)",
        };
      default:
        return {
          icon: "🟡",
          message: "Your account verification is pending.",
          bgColor: "var(--warning)",
          textColor: "var(--gray-dark)",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div 
      className="status-banner"
      style={{
        backgroundColor: config.bgColor,
        color: config.textColor,
      }}
    >
      <div className="status-banner-content">
        <span className="status-banner-icon">{config.icon}</span>
        <span className="status-banner-text">
          <strong>Verification Status:</strong> {config.message}
        </span>
      </div>
    </div>
  );
};

export default StatusBanner;

