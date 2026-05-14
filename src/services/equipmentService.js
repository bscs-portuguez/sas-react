import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Equipment Service
 *
 * Admin-managed catalog of borrowable equipment/items.
 * Used by:
 *   - AdminEquipmentInventory page (CRUD)
 *   - EquipmentItemPicker subcomponent (requester picks active items)
 */

const VALID_CATEGORIES = ["sound", "venue", "av", "furniture", "other"];

const sanitizeQuantity = (raw) => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
};

const sanitizeText = (raw, max = 200) => {
  const s = (raw || "").toString().trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
};

/**
 * List equipment items.
 * @param {Object} options
 * @param {boolean} [options.activeOnly=false] - only return active items
 */
export const listEquipment = async ({ activeOnly = false } = {}) => {
  const equipRef = collection(db, "equipment");
  const q = activeOnly
    ? query(equipRef, where("isActive", "==", true), orderBy("name", "asc"))
    : query(equipRef, orderBy("name", "asc"));

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ equipmentId: d.id, ...d.data() }));
};

export const getEquipmentById = async (equipmentId) => {
  const ref = doc(db, "equipment", equipmentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { equipmentId: snap.id, ...snap.data() };
};

/**
 * Create a new equipment item. Admin only.
 */
export const createEquipment = async (payload, adminId) => {
  const name = sanitizeText(payload.name, 120);
  if (!name) throw new Error("Equipment name is required");

  const category = VALID_CATEGORIES.includes(payload.category)
    ? payload.category
    : "other";
  const totalQuantity = sanitizeQuantity(payload.totalQuantity);
  const description = sanitizeText(payload.description, 1000);
  const condition = sanitizeText(payload.condition, 200);

  const equipRef = doc(collection(db, "equipment"));
  const batch = writeBatch(db);
  batch.set(equipRef, {
    equipmentId: equipRef.id,
    name,
    description,
    category,
    totalQuantity,
    condition,
    isActive: true,
    createdAt: serverTimestamp(),
    createdBy: adminId,
    updatedAt: serverTimestamp(),
    updatedBy: adminId,
  });
  await batch.commit();
  return { equipmentId: equipRef.id };
};

/**
 * Update an existing equipment item. Pass only the fields to change.
 */
export const updateEquipment = async (equipmentId, updates, adminId) => {
  if (!equipmentId) throw new Error("equipmentId is required");
  const ref = doc(db, "equipment", equipmentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Equipment not found");

  const patch = {
    updatedAt: serverTimestamp(),
    updatedBy: adminId,
  };

  if (updates.name !== undefined) {
    const name = sanitizeText(updates.name, 120);
    if (!name) throw new Error("Equipment name cannot be empty");
    patch.name = name;
  }
  if (updates.description !== undefined) {
    patch.description = sanitizeText(updates.description, 1000);
  }
  if (updates.category !== undefined) {
    patch.category = VALID_CATEGORIES.includes(updates.category)
      ? updates.category
      : "other";
  }
  if (updates.totalQuantity !== undefined) {
    patch.totalQuantity = sanitizeQuantity(updates.totalQuantity);
  }
  if (updates.condition !== undefined) {
    patch.condition = sanitizeText(updates.condition, 200);
  }
  if (updates.isActive !== undefined) {
    patch.isActive = Boolean(updates.isActive);
  }

  const batch = writeBatch(db);
  batch.update(ref, patch);
  await batch.commit();
};

/**
 * Toggle the active flag — preferred over deletion so historical requests
 * retain their item references.
 */
export const setEquipmentActive = async (equipmentId, isActive, adminId) => {
  return updateEquipment(equipmentId, { isActive }, adminId);
};

export const EQUIPMENT_CATEGORIES = VALID_CATEGORIES;

export const EQUIPMENT_CATEGORY_LABELS = {
  sound: "Sound System",
  venue: "Venue",
  av: "Audio/Visual",
  furniture: "Furniture",
  other: "Other",
};
