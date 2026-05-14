/**
 * Configure CORS on the Firebase Storage bucket.
 *
 * Firebase Storage requires CORS to allow browser-based uploads.
 * Without it, uploads from localhost fail with 412 Precondition Failed.
 *
 * Usage:
 *   node scripts/setCors.js
 */

import admin from "firebase-admin";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = require(join(__dirname, "..", "serviceAccountKey.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "sas-react-app.firebasestorage.app",
});

const CORS_CONFIG = [
  {
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",
      "https://sas-react-app.web.app",
      "https://sas-react-app.firebaseapp.com",
    ],
    method: ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"],
    responseHeader: [
      "Content-Type",
      "Authorization",
      "Content-Length",
      "User-Agent",
      "x-goog-resumable",
      "x-firebase-storage-version",
    ],
    maxAgeSeconds: 3600,
  },
];

async function main() {
  console.log("Setting CORS configuration on Firebase Storage bucket…");

  const bucket = admin.storage().bucket();
  await bucket.setCorsConfiguration(CORS_CONFIG);

  console.log("✓ CORS configured successfully.");
  console.log("  Allowed origins:", CORS_CONFIG[0].origin.join(", "));

  // Verify
  const [meta] = await bucket.getMetadata();
  console.log("\nCurrent bucket CORS:", JSON.stringify(meta.cors, null, 2));

  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to set CORS:", err.message);
  process.exit(1);
});
