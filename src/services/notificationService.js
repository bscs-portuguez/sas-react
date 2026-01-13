import { 
  collection, 
  doc, 
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Get notifications for a user
 * @param {string} userId - User ID
 * @param {Object} options - Options
 * @param {boolean} options.unreadOnly - Only get unread notifications
 * @param {number} options.limit - Limit number of results
 * @returns {Promise<Array>} Array of notifications
 */
export const getNotifications = async (userId, options = {}) => {
  try {
    const notificationsRef = collection(db, "notifications");
    let q = query(
      notificationsRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    
    if (options.unreadOnly) {
      q = query(q, where("read", "==", false));
    }
    
    if (options.limit) {
      q = query(q, orderBy("createdAt", "desc"));
    }
    
    const querySnapshot = await getDocs(q);
    const notifications = [];
    
    querySnapshot.forEach((doc) => {
      notifications.push({
        notificationId: doc.id,
        ...doc.data()
      });
    });
    
    // Apply limit client-side if needed (since Firestore limit() requires index)
    if (options.limit && notifications.length > options.limit) {
      return notifications.slice(0, options.limit);
    }
    
    return notifications;
  } catch (error) {
    console.error("Error fetching notifications:", error);
    // Return empty array if collection doesn't exist yet
    return [];
  }
};

/**
 * Get unread notification count
 * @param {string} userId - User ID
 * @returns {Promise<number>} Count of unread notifications
 */
export const getUnreadNotificationCount = async (userId) => {
  try {
    const notifications = await getNotifications(userId, { unreadOnly: true });
    return notifications.length;
  } catch (error) {
    console.error("Error getting unread count:", error);
    return 0;
  }
};

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @returns {Promise<void>}
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    const notificationRef = doc(db, "notifications", notificationId);
    await updateDoc(notificationRef, {
      read: true,
      readAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export const markAllNotificationsAsRead = async (userId) => {
  try {
    const notifications = await getNotifications(userId, { unreadOnly: true });
    const updatePromises = notifications.map(notif => 
      markNotificationAsRead(notif.notificationId)
    );
    await Promise.all(updatePromises);
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    throw error;
  }
};

/**
 * Create a notification
 * @param {Object} notificationData - Notification data
 * @param {string} notificationData.userId - User ID to notify
 * @param {string} notificationData.type - Notification type
 * @param {string} notificationData.title - Notification title
 * @param {string} notificationData.message - Notification message
 * @param {string} notificationData.link - Optional link
 * @returns {Promise<Object>} Created notification
 */
export const createNotification = async (notificationData) => {
  try {
    const notificationsRef = collection(db, "notifications");
    
    const notification = {
      userId: notificationData.userId,
      type: notificationData.type || "info",
      title: notificationData.title,
      message: notificationData.message,
      link: notificationData.link || null,
      read: false,
      createdAt: serverTimestamp()
    };
    
    const docRef = await addDoc(notificationsRef, notification);
    
    return {
      notificationId: docRef.id,
      ...notification
    };
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

