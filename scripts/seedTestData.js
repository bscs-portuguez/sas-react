/**
 * Seed test data for the SAS Portal.
 *
 * Creates:
 *   - organizations (ISG + CSG)
 *   - users documents for SAS admin, ISG officer, and your own account
 *   - officeProfiles for OP and VPAA (they do NOT get users entries — they
 *     interact via tokenized email links, not portal login)
 *   - systemCounters with initial values
 *
 * Requires all four Firebase Auth accounts to already exist.
 * Safe to re-run (uses set/merge so nothing is duplicated).
 *
 * Usage:
 *   node scripts/seedTestData.js
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
});

const db = admin.firestore();
const authAdmin = admin.auth();

// ── Configuration ──────────────────────────────────────────────────────────

const TEST_ACCOUNTS = {
  sas:         "samplemail.sas@gmail.com",
  isg:         "samplemail.isg@gmail.com",
  user:        "portuguez.23407875m.bscs@gmail.com",
  op:          "samplemail.op@gmail.com",
  vpaa:        "samplemail.vpaa@gmail.com",
  fms:         "samplemail.fms@gmail.com",
  procurement: "samplemail.procurement@gmail.com",
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function lookupUid(email) {
  try {
    const record = await authAdmin.getUserByEmail(email);
    return record.uid;
  } catch (err) {
    if (err.code === "auth/user-not-found") return null;
    throw err;
  }
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== SAS Portal — Test Data Seed ===\n");

  // 1. Look up Auth UIDs ────────────────────────────────────────────────────
  console.log("Looking up Firebase Auth accounts…");

  const uids = {};
  for (const [key, email] of Object.entries(TEST_ACCOUNTS)) {
    const uid = await lookupUid(email);
    if (uid) {
      uids[key] = uid;
      console.log(`  ✓ ${email} → ${uid}`);
    } else {
      console.log(`  ✗ ${email} — not found in Firebase Auth (skipping)`);
    }
  }

  const sasUid  = uids.sas;
  const isgUid  = uids.isg;
  const userUid = uids.user;

  // OP and VPAA UIDs are intentionally NOT used for user documents
  // They go into officeProfiles only.

  // 2. Create organizations ─────────────────────────────────────────────────
  console.log("\nCreating organizations…");

  const isgOrgRef = db.collection("organizations").doc("org-isg");
  const csgOrgRef = db.collection("organizations").doc("org-csg");

  await isgOrgRef.set({
    organizationId:     "org-isg",
    organizationNumber: pad3(1),
    name:               "Institute Student Government",
    type:               "ISG",
    status:             "active",
    dateCreated:        admin.firestore.FieldValue.serverTimestamp(),
    lastUpdated:        admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`  ✓ ISG org (id: org-isg, number: 001)`);

  await csgOrgRef.set({
    organizationId:     "org-csg",
    organizationNumber: pad3(2),
    name:               "College Student Government",
    type:               "CSG",
    status:             "active",
    dateCreated:        admin.firestore.FieldValue.serverTimestamp(),
    lastUpdated:        admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`  ✓ CSG org (id: org-csg, number: 002)`);

  // 3. Create user documents ─────────────────────────────────────────────────
  console.log("\nCreating user documents…");

  if (sasUid) {
    await db.collection("users").doc(sasUid).set({
      userId:         sasUid,
      fullName:       "SAS Admin",
      email:          TEST_ACCOUNTS.sas,
      role:           "Admin",
      userRole:       null,
      organizationId: null,
      status:         "active",
      dateCreated:    admin.firestore.FieldValue.serverTimestamp(),
      lastLogin:      null,
      lastUpdated:    admin.firestore.FieldValue.serverTimestamp(),
      deletedAt:      null,
    }, { merge: true });
    console.log(`  ✓ SAS admin user (${TEST_ACCOUNTS.sas})`);
  } else {
    console.log(`  ✗ SAS admin skipped — no Auth account`);
  }

  if (isgUid) {
    await db.collection("users").doc(isgUid).set({
      userId:         isgUid,
      fullName:       "ISG Officer",
      email:          TEST_ACCOUNTS.isg,
      role:           "Organization",
      userRole:       "President",
      organizationId: "org-isg",
      status:         "active",
      dateCreated:    admin.firestore.FieldValue.serverTimestamp(),
      lastLogin:      null,
      lastUpdated:    admin.firestore.FieldValue.serverTimestamp(),
      deletedAt:      null,
    }, { merge: true });
    console.log(`  ✓ ISG officer user (${TEST_ACCOUNTS.isg})`);
  } else {
    console.log(`  ✗ ISG officer skipped — no Auth account`);
  }

  if (userUid) {
    await db.collection("users").doc(userUid).set({
      userId:         userUid,
      fullName:       "John Michael P. Portuguez",
      email:          TEST_ACCOUNTS.user,
      role:           "Organization",
      userRole:       "President",
      organizationId: "org-csg",
      status:         "active",
      dateCreated:    admin.firestore.FieldValue.serverTimestamp(),
      lastLogin:      null,
      lastUpdated:    admin.firestore.FieldValue.serverTimestamp(),
      deletedAt:      null,
    }, { merge: true });
    console.log(`  ✓ CSG officer user (${TEST_ACCOUNTS.user})`);
  } else {
    console.log(`  ✗ Your account skipped — register it in Firebase Auth first, then re-run this script`);
  }

  // 4. Office profiles (OP and VPAA — no portal login) ─────────────────────
  console.log("\nCreating office profiles (VPAA + OP)…");

  await db.collection("officeProfiles").doc("VPAA").set({
    officeId:     "VPAA",
    officeName:   "Office of the Vice President for Academic Affairs",
    abbreviation: "VPAA",
    contactEmail: TEST_ACCOUNTS.vpaa,
    updatedBy:    sasUid || "system",
    lastUpdated:  admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`  ✓ VPAA (${TEST_ACCOUNTS.vpaa})`);

  await db.collection("officeProfiles").doc("OP").set({
    officeId:     "OP",
    officeName:   "Office of the President",
    abbreviation: "OP",
    contactEmail: TEST_ACCOUNTS.op,
    updatedBy:    sasUid || "system",
    lastUpdated:  admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`  ✓ OP (${TEST_ACCOUNTS.op})`);

  await db.collection("officeProfiles").doc("fms").set({
    officeId:     "fms",
    officeName:   "Financial Management Services",
    abbreviation: "FMS",
    contactEmail: TEST_ACCOUNTS.fms,
    updatedBy:    sasUid || "system",
    lastUpdated:  admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`  ✓ FMS (${TEST_ACCOUNTS.fms})`);

  await db.collection("officeProfiles").doc("procurement").set({
    officeId:     "procurement",
    officeName:   "Procurement Office",
    abbreviation: "Procurement",
    contactEmail: TEST_ACCOUNTS.procurement,
    updatedBy:    sasUid || "system",
    lastUpdated:  admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`  ✓ Procurement (${TEST_ACCOUNTS.procurement})`);

  console.log(
    "\n  NOTE: samplemail.op and samplemail.vpaa are stored in officeProfiles,\n" +
    "  not in the users collection. Per the system design, OP and VPAA do not\n" +
    "  log into the portal — they review proposals via tokenized email links.\n" +
    "  If you created Firebase Auth accounts for those emails, they will not\n" +
    "  be able to access any portal page (which is intentional)."
  );

  // 5. System counters ───────────────────────────────────────────────────────
  console.log("\nInitializing system counters…");

  const currentYear = new Date().getFullYear();

  await db.collection("systemCounters").doc("organizationNumber").set({
    count: 2,
  }, { merge: true });
  console.log(`  ✓ systemCounters/organizationNumber → 2 (two orgs created)`);

  await db.collection("systemCounters").doc(`outgoing_${currentYear}`).set({
    count: 0,
    year:  currentYear,
  }, { merge: true });
  console.log(`  ✓ systemCounters/outgoing_${currentYear} → 0`);

  // 6. Summary ───────────────────────────────────────────────────────────────
  console.log("\n=== Done ===");
  console.log("\nTest accounts:");
  console.log(`  SAS Admin    → ${TEST_ACCOUNTS.sas}`);
  console.log(`  ISG Officer  → ${TEST_ACCOUNTS.isg}  (org: Institute Student Government)`);
  console.log(`  Your account → ${TEST_ACCOUNTS.user}  (org: College Student Government)`);
  console.log(`  VPAA review  → ${TEST_ACCOUNTS.vpaa}  (officeProfile — no portal login)`);
  console.log(`  OP review    → ${TEST_ACCOUNTS.op}  (officeProfile — no portal login)`);
  console.log(`  FMS review   → ${TEST_ACCOUNTS.fms}  (officeProfile — no portal login, ISG-submitted only)`);
  console.log(`  Procurement  → ${TEST_ACCOUNTS.procurement}  (officeProfile — no portal login, ISG-submitted only)`);
  console.log(
    "\nNext: Log in as the SAS admin first, then as ISG or your own account to test."
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
