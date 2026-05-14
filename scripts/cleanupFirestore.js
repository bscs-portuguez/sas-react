/**
 * One-off cleanup: list collections in Firestore and delete the ones tied to
 * features we just removed. Keeps `users`, `organizations`, `documents`,
 * `documentStatusHistory`, plus anything related to OTP/auth.
 *
 * Usage:
 *   node scripts/cleanupFirestore.js --list   # list collections only (safe)
 *   node scripts/cleanupFirestore.js --apply  # actually delete
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
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const KEEP = new Set([
  "users",
  "organizations",
  "documents",
  "documentStatusHistory",
  "otps",
  "otpCodes",
  "passwordResetTokens"
]);

const DROP_HINTS = [
  "equipment",
  "borrow",
  "notification",
  "reference",
  "report",
  "compliance",
  "deadline",
  "announcement",
  "memorandum",
  "documenttype"
];

async function deleteCollection(collectionRef, batchSize = 200) {
  const query = collectionRef.limit(batchSize);
  let total = 0;
  while (true) {
    const snapshot = await query.get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    total += snapshot.size;
    if (snapshot.size < batchSize) break;
  }
  return total;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const listOnly = process.argv.includes("--list") || !apply;

  const collections = await db.listCollections();
  console.log(`Found ${collections.length} top-level collections:\n`);

  const toDrop = [];
  for (const c of collections) {
    const name = c.id;
    const keep = KEEP.has(name);
    const looksDroppable = DROP_HINTS.some((h) => name.toLowerCase().includes(h));
    const status = keep ? "KEEP" : looksDroppable ? "DROP" : "REVIEW";
    console.log(`  [${status}] ${name}`);
    if (!keep && looksDroppable) toDrop.push(c);
  }

  if (listOnly) {
    console.log("\nDry run only. Pass --apply to delete the DROP collections.");
    process.exit(0);
  }

  console.log(`\nDeleting ${toDrop.length} collections...`);
  for (const c of toDrop) {
    process.stdout.write(`  ${c.id} ... `);
    const count = await deleteCollection(c);
    console.log(`deleted ${count} docs`);
  }
  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
