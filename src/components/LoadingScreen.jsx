import "./LoadingScreen.css";

const LoadingScreen = ({ message = "Loading...", compact = false }) => {
  return (
    <div className={`loading-screen ${compact ? 'loading-screen-compact' : ''}`}>
      <div className="loading-content">
        <div className="loading-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        <div className="loading-text">
          <span className="loading-message">{message}</span>
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
      {!compact && (
        <div className="loading-particles">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="particle" style={{ '--delay': i * 0.1 + 's' }}></div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LoadingScreen;

