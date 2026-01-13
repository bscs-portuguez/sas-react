import "../styles/colors.css";
import "./ActionCard.css";

const ActionCard = ({ 
  icon, 
  title, 
  description, 
  onClick, 
  disabled = false,
  disabledReason = "This action requires account verification."
}) => {
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  return (
    <div 
      className={`action-card ${disabled ? "action-card--disabled" : ""}`}
      onClick={handleClick}
    >
      <div className="action-card-icon">{icon}</div>
      <div className="action-card-content">
        <h3 className="action-card-title">{title}</h3>
        <p className="action-card-description">
          {disabled ? disabledReason : description}
        </p>
      </div>
      {disabled && (
        <div className="action-card-badge">
          <span>Verification Required</span>
        </div>
      )}
    </div>
  );
};

export default ActionCard;


