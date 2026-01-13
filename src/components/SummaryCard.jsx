import "../styles/colors.css";
import "./SummaryCard.css";

const SummaryCard = ({ icon, title, value, subtitle, onClick, variant = "default" }) => {
  return (
    <div 
      className={`summary-card summary-card--${variant}`}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div className="summary-card-icon">{icon}</div>
      <div className="summary-card-content">
        <div className="summary-card-value">{value}</div>
        <div className="summary-card-title">{title}</div>
        {subtitle && <div className="summary-card-subtitle">{subtitle}</div>}
      </div>
    </div>
  );
};

export default SummaryCard;

