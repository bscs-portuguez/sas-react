import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../config/firebase";
import { seedAllDatabase } from "../utils/seedAllDatabase";

const SeedAllDatabaseButton = () => {
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (!user) {
      setMessage("⚠️ Please log in to seed the database");
    }
  }, [user]);

  const handleSeed = async () => {
    if (!user) {
      setMessage("❌ Error: You must be logged in to seed the database");
      return;
    }

    setLoading(true);
    setMessage("");
    setDetails("");
    
    try {
      const result = await seedAllDatabase(user.uid);
      
      const docTypesMsg = result.results.documentTypes.skipped 
        ? "Document types: Already exist"
        : `Document types: Seeded ${result.results.documentTypes.count}`;
      
      const categoriesMsg = result.results.equipmentCategories.skipped
        ? "Equipment categories: Already exist"
        : `Equipment categories: Seeded ${result.results.equipmentCategories.count}`;
      
      const equipmentMsg = result.results.equipment.skipped
        ? "Equipment: Already exists"
        : result.results.equipment.reason
        ? `Equipment: ${result.results.equipment.reason}`
        : `Equipment: Seeded ${result.results.equipment.count}`;
      
      setMessage("✅ Database seeding completed successfully!");
      setDetails(`${docTypesMsg}\n${categoriesMsg}\n${equipmentMsg}`);
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
      setDetails("Check console for details");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", textAlign: "center", maxWidth: "600px", margin: "0 auto" }}>
      <h2 style={{ marginBottom: "1rem", color: "#800020" }}>Database Seeder</h2>
      <p style={{ marginBottom: "1.5rem", color: "#666" }}>
        This will seed all reference data and sample equipment items.
        Make sure you're logged in as an admin and have temporary permissive security rules enabled.
      </p>
      
      <button
        onClick={handleSeed}
        disabled={loading || !user}
        style={{
          padding: "1rem 2rem",
          fontSize: "1rem",
          backgroundColor: user ? "#800020" : "#ccc",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: loading || !user ? "not-allowed" : "pointer",
          opacity: loading || !user ? 0.6 : 1,
          marginBottom: "1rem"
        }}
      >
        {loading ? "Seeding..." : "Seed All Database"}
      </button>
      
      {message && (
        <div style={{ 
          marginTop: "1rem",
          padding: "1rem",
          backgroundColor: message.includes("✅") ? "#d4edda" : "#f8d7da",
          border: `1px solid ${message.includes("✅") ? "#c3e6cb" : "#f5c6cb"}`,
          borderRadius: "4px",
          color: message.includes("✅") ? "#155724" : "#721c24"
        }}>
          <div style={{ fontWeight: "bold", marginBottom: details ? "0.5rem" : "0" }}>
            {message}
          </div>
          {details && (
            <div style={{ 
              whiteSpace: "pre-line", 
              fontSize: "0.9rem",
              marginTop: "0.5rem",
              textAlign: "left"
            }}>
              {details}
            </div>
          )}
        </div>
      )}
      
      {!user && (
        <p style={{ marginTop: "1rem", color: "#856404", fontSize: "0.9rem" }}>
          ⚠️ You must be logged in to seed the database
        </p>
      )}
    </div>
  );
};

export default SeedAllDatabaseButton;

