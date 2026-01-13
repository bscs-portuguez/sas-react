/**
 * Migration Script: Update lastLogin for users with null values
 * 
 * This script updates all user documents in Firestore that have a null lastLogin field.
 * It sets lastLogin to the current server timestamp for those users.
 * 
 * Usage:
 * 1. Import and run this script in your browser console or as a one-time migration
 * 2. Make sure you're authenticated as an admin user
 * 
 * Example:
 * import { migrateLastLogin } from './utils/migrateLastLogin';
 * migrateLastLogin();
 */

import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc,
  serverTimestamp,
  query,
  where
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Migrate lastLogin field for all users with null values
 * @returns {Promise<Object>} Migration result with count of updated users
 */
export const migrateLastLogin = async () => {
  try {
    console.log("Starting lastLogin migration...");
    
    const usersRef = collection(db, "users");
    
    // Get all users
    const usersSnapshot = await getDocs(usersRef);
    
    if (usersSnapshot.empty) {
      console.log("No users found in database");
      return { success: true, updated: 0, total: 0 };
    }

    let updatedCount = 0;
    let skippedCount = 0;
    const updatePromises = [];

    usersSnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      
      // Check if lastLogin is null or doesn't exist
      if (!userData.lastLogin) {
        const userRef = doc(db, "users", userDoc.id);
        updatePromises.push(
          updateDoc(userRef, {
            lastLogin: serverTimestamp()
          }).then(() => {
            updatedCount++;
            console.log(`✓ Updated lastLogin for user: ${userData.email || userDoc.id}`);
          }).catch((error) => {
            console.error(`✗ Error updating user ${userDoc.id}:`, error);
          })
        );
      } else {
        skippedCount++;
        console.log(`⊘ Skipped user ${userData.email || userDoc.id} (already has lastLogin)`);
      }
    });

    // Wait for all updates to complete
    await Promise.all(updatePromises);

    console.log("\n=== Migration Complete ===");
    console.log(`Total users: ${usersSnapshot.size}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped: ${skippedCount}`);

    return {
      success: true,
      updated: updatedCount,
      skipped: skippedCount,
      total: usersSnapshot.size
    };
  } catch (error) {
    console.error("Error during lastLogin migration:", error);
    throw error;
  }
};

// Allow running directly if imported in a script context
if (typeof window !== 'undefined') {
  window.migrateLastLogin = migrateLastLogin;
}


