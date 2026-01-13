import { useState } from "react";
import { seedOrganizations } from "../utils/seedOrganizations";

const SeedButton = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSeed = async () => {
    setLoading(true);
    setMessage("");
    
    try {
      const result = await seedOrganizations();
      setMessage(`✅ Successfully seeded ${result.count} organizations!`);
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <button
        onClick={handleSeed}
        disabled={loading}
        style={{
          padding: "1rem 2rem",
          fontSize: "1rem",
          backgroundColor: "#800020",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: loading ? "not-allowed" : "pointer"
        }}
      >
        {loading ? "Seeding..." : "Seed Organizations"}
      </button>
      {message && (
        <p style={{ marginTop: "1rem", color: message.includes("✅") ? "green" : "red" }}>
          {message}
        </p>
      )}
    </div>
  );
};

export default SeedButton;