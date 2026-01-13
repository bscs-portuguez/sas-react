import { useState } from "react";
import { seedAllReferenceData } from "../utils/seedReferenceData";

const SeedReferenceDataButton = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSeed = async () => {
    setLoading(true);
    setMessage("");
    
    try {
      const result = await seedAllReferenceData();
      const docTypesMsg = result.documentTypes.skipped 
        ? `Document types: Already exist (${result.documentTypes.count})`
        : `Document types: Seeded ${result.documentTypes.count}`;
      const categoriesMsg = result.equipmentCategories.skipped
        ? `Equipment categories: Already exist (${result.equipmentCategories.count})`
        : `Equipment categories: Seeded ${result.equipmentCategories.count}`;
      
      setMessage(`✅ Success!\n${docTypesMsg}\n${categoriesMsg}`);
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
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1
        }}
      >
        {loading ? "Seeding..." : "Seed Reference Data"}
      </button>
      {message && (
        <div style={{ 
          marginTop: "1rem", 
          color: message.includes("✅") ? "green" : "red",
          whiteSpace: "pre-line"
        }}>
          {message}
        </div>
      )}
    </div>
  );
};

export default SeedReferenceDataButton;

