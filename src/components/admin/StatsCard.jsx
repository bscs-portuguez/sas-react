import "../../styles/colors.css";
import "./StatsCard.css";

const StatsCard = ({ title, value, icon, color = "maroon", trend = null, onClick }) => {
  const colorClass = `stats-card--${color}`;

  return (
    <div 
      className={`stats-card ${colorClass}`}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div className="stats-card-icon">{icon}</div>
      <div className="stats-card-content">
        <h3 className="stats-card-title">{title}</h3>
        <p className="stats-card-value">{value}</p>
        {trend && (
          <span className={`stats-card-trend ${trend.type}`}>
            {trend.icon} {trend.text}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatsCard;

