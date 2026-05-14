import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Equipment Request Service
 *
 * Borrowing requests are stored alongside other documents in the `documents`
 * collection with `documentType: "equipment_request"`. This keeps status history,
 * file storage paths, and querying consistent with activity proposals.
 *
 * Lifecycle (status field):
 *   pending → approved → released → returned
 *   pending → returned_for_revision (requester resubmits → pending again)
 *   pending | approved → rejected
 *
 * Pipeline tracking lives on `pipeline.currentStage` and a `pipeline.stages[]`
 * array mirroring activity proposals, but with simpler stage keys:
 *   sas_review → approved → released → returned
 */

const COLLECTION = "documents";

const PIPELINE_STAGES = {
  SAS_REVIEW: "sas_review",
  PICKUP: "pickup",
  RETURN: "return",
  CLOSED: "closed",
};

const STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  RELEASED: "released",
  RETURNED: "returned",
  RETURNED_FOR_REVISION: "returned_for_revision",
  REJECTED: "rejected",
};

const sanitizeText = (s, max = 500) => {
  const v = (s || "").toString().trim();
  return v.length > max ? v.slice(0, max) : v;
};

const sanitizeItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .filter((it) => it && it.equipmentId && Number(it.quantity) > 0)
    .map((it) => ({
      equipmentId: it.equipmentId,
      name: sanitizeText(it.name, 200),
      quantity: Math.floor(Number(it.quantity)),
      conditionBefore: sanitizeText(it.conditionBefore || "", 200),
      remarks: sanitizeText(it.remarks || "", 500),
    }));
};

const dateOrNull = (raw) => {
  if (!raw) return null;
  if (raw instanceof Timestamp) return raw;
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return Timestamp.fromDate(d);
};

/**
 * Submit a new borrowing request.
 *
 * @param {Object} args
 * @param {Object} args.requesting           Section A fields
 * @param {Object} args.borrowing            Section B fields
 * @param {Array}  args.items                Section C wishlist
 * @param {string} [args.linkedProposalId]   Optional Activity Proposal link
 * @param {string} args.userId               Submitting user uid
 * @param {string} args.organizationId
 * @param {string} [args.submitterRole]
 * @param {string} [args.submittedByName]
 */
export const submitEquipmentRequest = async ({
  requesting,
  borrowing,
  items,
  linkedProposalId = null,
  userId,
  organizationId,
  submitterRole = null,
  submittedByName = "",
}) => {
  if (!userId) throw new Error("Not signed in");
  if (!organizationId) throw new Error("Organization not found");

  const safeItems = sanitizeItems(items);
  if (safeItems.length === 0) throw new Error("Select at least one item to borrow");

  if (!requesting?.name?.trim()) throw new Error("Requester name is required");
  if (!requesting?.email?.trim()) throw new Error("Requester email is required");
  if (!borrowing?.purpose?.trim()) throw new Error("Purpose is required");
  if (!borrowing?.activityTitle?.trim()) throw new Error("Activity title is required");

  const dtBorrowed = dateOrNull(borrowing?.dateTimeBorrowed);
  const dtReturn = dateOrNull(borrowing?.expectedDateTimeReturn);
  if (!dtBorrowed) throw new Error("Date & time of borrowing is required");
  if (!dtReturn) throw new Error("Expected return date & time is required");
  if (dtReturn.toMillis() <= dtBorrowed.toMillis()) {
    throw new Error("Expected return must be after borrow time");
  }

  const docRef = doc(collection(db, COLLECTION));
  const documentId = docRef.id;

  const batch = writeBatch(db);

  batch.set(docRef, {
    documentId,
    documentNumber: null,
    organizationId,
    submittedBy: userId,
    submittedByName: submittedByName || requesting.name.trim(),
    submitterRole: submitterRole || null,
    documentType: "equipment_request",
    direction: "incoming",
    title: borrowing.activityTitle.trim(),
    description: borrowing.purpose.trim(),

    requesting: {
      collegeOrDepartment: sanitizeText(requesting.collegeOrDepartment, 200),
      name: sanitizeText(requesting.name, 200),
      designation: sanitizeText(requesting.designation, 200),
      contactNumber: sanitizeText(requesting.contactNumber, 50),
      email: sanitizeText(requesting.email, 200),
      adviser: sanitizeText(requesting.adviser, 200),
    },
    borrowing: {
      purpose: sanitizeText(borrowing.purpose, 1000),
      activityTitle: sanitizeText(borrowing.activityTitle, 200),
      activityDateFrom: dateOrNull(borrowing.activityDateFrom),
      activityDateTo: dateOrNull(borrowing.activityDateTo),
      locationOfUse: sanitizeText(borrowing.locationOfUse, 300),
      dateTimeBorrowed: dtBorrowed,
      expectedDateTimeReturn: dtReturn,
    },
    items: safeItems,
    linkedProposalId: linkedProposalId || null,

    officeUse: {
      dateBorrowed: null,
      dateReturned: null,
      receivedByBorrower: null,
      receivedByOfficePersonnel: null,
      conditionUponReturn: "",
    },
    pdfPath: null,
    pdfFileName: null,

    status: STATUS.PENDING,
    remarks: "",
    pipeline: {
      currentStage: PIPELINE_STAGES.SAS_REVIEW,
      stages: [],
    },

    dateSubmitted: serverTimestamp(),
    dateReviewed: null,
    dateReleased: null,
    lastUpdated: serverTimestamp(),
    createdBy: userId,
    updatedBy: userId,
  });

  const historyRef = doc(collection(db, "documentStatusHistory"));
  batch.set(historyRef, {
    documentId,
    status: STATUS.PENDING,
    previousStatus: null,
    changedBy: userId,
    remarks: "Equipment borrowing request submitted",
    timestamp: serverTimestamp(),
  });

  await batch.commit();

  return { documentId, status: STATUS.PENDING };
};

/**
 * List a user's borrowing requests (org-scoped).
 */
export const listRequestsForOrganization = async (organizationId) => {
  if (!organizationId) return [];
  const q = query(
    collection(db, COLLECTION),
    where("organizationId", "==", organizationId),
    where("documentType", "==", "equipment_request"),
    orderBy("dateSubmitted", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ documentId: d.id, ...d.data() }));
};

/**
 * List all borrowing requests (admin), optionally filtered by status.
 */
export const listRequestsForAdmin = async ({ status = null } = {}) => {
  let q;
  if (status) {
    q = query(
      collection(db, COLLECTION),
      where("documentType", "==", "equipment_request"),
      where("status", "==", status),
      orderBy("dateSubmitted", "desc")
    );
  } else {
    q = query(
      collection(db, COLLECTION),
      where("documentType", "==", "equipment_request"),
      orderBy("dateSubmitted", "desc")
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ documentId: d.id, ...d.data() }));
};

export const getRequestById = async (documentId) => {
  const ref = doc(db, COLLECTION, documentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.documentType !== "equipment_request") return null;
  return { documentId: snap.id, ...data };
};

const requireStatus = (data, expected, action) => {
  if (data.status !== expected) {
    throw new Error(
      `Cannot ${action} — request is "${data.status}", expected "${expected}"`
    );
  }
};

const appendStage = (data, entry) => {
  const stages = Array.isArray(data.pipeline?.stages) ? [...data.pipeline.stages] : [];
  stages.push(entry);
  return stages;
};

/**
 * Admin approves a pending request. The admin may optionally edit the items
 * list before approving (e.g. finalize quantity, set condition-before).
 */
export const approveRequest = async (documentId, adminId, { items, remarks = "" } = {}) => {
  const ref = doc(db, COLLECTION, documentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Request not found");
  const data = snap.data();
  requireStatus(data, STATUS.PENDING, "approve");

  const now = Timestamp.fromDate(new Date());
  const stageEntry = {
    stage: PIPELINE_STAGES.SAS_REVIEW,
    action: "approved",
    completedAt: now,
    completedBy: adminId,
    remarks: sanitizeText(remarks, 1000),
  };

  const patch = {
    status: STATUS.APPROVED,
    remarks: sanitizeText(remarks, 1000),
    "pipeline.currentStage": PIPELINE_STAGES.PICKUP,
    "pipeline.stages": appendStage(data, stageEntry),
    dateReviewed: serverTimestamp(),
    lastUpdated: serverTimestamp(),
    updatedBy: adminId,
  };

  if (Array.isArray(items)) {
    patch.items = sanitizeItems(items);
  }

  const batch = writeBatch(db);
  batch.update(ref, patch);

  const historyRef = doc(collection(db, "documentStatusHistory"));
  batch.set(historyRef, {
    documentId,
    status: STATUS.APPROVED,
    previousStatus: data.status,
    changedBy: adminId,
    remarks: remarks ? `Approved — ${remarks}` : "Approved",
    timestamp: serverTimestamp(),
  });

  await batch.commit();
};

/**
 * Admin returns a pending request to the requester for revision.
 */
export const returnRequestForRevision = async (documentId, adminId, remarks) => {
  const trimmed = sanitizeText(remarks, 1000);
  if (!trimmed) throw new Error("A reason is required when returning a request");

  const ref = doc(db, COLLECTION, documentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Request not found");
  const data = snap.data();
  requireStatus(data, STATUS.PENDING, "return for revision");

  const now = Timestamp.fromDate(new Date());
  const stageEntry = {
    stage: PIPELINE_STAGES.SAS_REVIEW,
    action: "returned",
    completedAt: now,
    completedBy: adminId,
    remarks: trimmed,
  };

  const batch = writeBatch(db);
  batch.update(ref, {
    status: STATUS.RETURNED_FOR_REVISION,
    remarks: trimmed,
    "pipeline.currentStage": null,
    "pipeline.stages": appendStage(data, stageEntry),
    lastUpdated: serverTimestamp(),
    updatedBy: adminId,
  });

  const historyRef = doc(collection(db, "documentStatusHistory"));
  batch.set(historyRef, {
    documentId,
    status: STATUS.RETURNED_FOR_REVISION,
    previousStatus: data.status,
    changedBy: adminId,
    remarks: `Returned for revision — ${trimmed}`,
    timestamp: serverTimestamp(),
  });

  await batch.commit();
};

/**
 * Admin rejects a request outright (cannot be resubmitted).
 */
export const rejectRequest = async (documentId, adminId, remarks) => {
  const trimmed = sanitizeText(remarks, 1000);
  if (!trimmed) throw new Error("A reason is required when rejecting a request");

  const ref = doc(db, COLLECTION, documentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Request not found");
  const data = snap.data();
  if (data.status === STATUS.RELEASED || data.status === STATUS.RETURNED) {
    throw new Error(`Cannot reject — request is already ${data.status}`);
  }

  const now = Timestamp.fromDate(new Date());
  const stageEntry = {
    stage: data.pipeline?.currentStage || PIPELINE_STAGES.SAS_REVIEW,
    action: "rejected",
    completedAt: now,
    completedBy: adminId,
    remarks: trimmed,
  };

  const batch = writeBatch(db);
  batch.update(ref, {
    status: STATUS.REJECTED,
    remarks: trimmed,
    "pipeline.currentStage": null,
    "pipeline.stages": appendStage(data, stageEntry),
    lastUpdated: serverTimestamp(),
    updatedBy: adminId,
  });

  const historyRef = doc(collection(db, "documentStatusHistory"));
  batch.set(historyRef, {
    documentId,
    status: STATUS.REJECTED,
    previousStatus: data.status,
    changedBy: adminId,
    remarks: `Rejected — ${trimmed}`,
    timestamp: serverTimestamp(),
  });

  await batch.commit();
};

/**
 * Resubmit a returned-for-revision request after editing.
 * @param {Object} updates  Fields the requester may revise: requesting, borrowing, items.
 */
export const resubmitRequest = async (documentId, userId, updates = {}) => {
  const ref = doc(db, COLLECTION, documentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Request not found");
  const data = snap.data();
  requireStatus(data, STATUS.RETURNED_FOR_REVISION, "resubmit");
  if (data.submittedBy !== userId) {
    throw new Error("Only the original requester may resubmit this request");
  }

  const patch = {
    status: STATUS.PENDING,
    "pipeline.currentStage": PIPELINE_STAGES.SAS_REVIEW,
    lastUpdated: serverTimestamp(),
    updatedBy: userId,
  };

  if (updates.requesting) {
    patch.requesting = {
      collegeOrDepartment: sanitizeText(updates.requesting.collegeOrDepartment, 200),
      name: sanitizeText(updates.requesting.name, 200),
      designation: sanitizeText(updates.requesting.designation, 200),
      contactNumber: sanitizeText(updates.requesting.contactNumber, 50),
      email: sanitizeText(updates.requesting.email, 200),
      adviser: sanitizeText(updates.requesting.adviser, 200),
    };
  }
  if (updates.borrowing) {
    patch.borrowing = {
      purpose: sanitizeText(updates.borrowing.purpose, 1000),
      activityTitle: sanitizeText(updates.borrowing.activityTitle, 200),
      activityDateFrom: dateOrNull(updates.borrowing.activityDateFrom),
      activityDateTo: dateOrNull(updates.borrowing.activityDateTo),
      locationOfUse: sanitizeText(updates.borrowing.locationOfUse, 300),
      dateTimeBorrowed: dateOrNull(updates.borrowing.dateTimeBorrowed),
      expectedDateTimeReturn: dateOrNull(updates.borrowing.expectedDateTimeReturn),
    };
    if (patch.borrowing.activityTitle) patch.title = patch.borrowing.activityTitle;
    if (patch.borrowing.purpose) patch.description = patch.borrowing.purpose;
  }
  if (Array.isArray(updates.items)) {
    patch.items = sanitizeItems(updates.items);
    if (patch.items.length === 0) throw new Error("Select at least one item to borrow");
  }

  const batch = writeBatch(db);
  batch.update(ref, patch);

  const historyRef = doc(collection(db, "documentStatusHistory"));
  batch.set(historyRef, {
    documentId,
    status: STATUS.PENDING,
    previousStatus: data.status,
    changedBy: userId,
    remarks: "Resubmitted after revision",
    timestamp: serverTimestamp(),
  });

  await batch.commit();
};

/**
 * Admin records physical pickup — captures Section F top half.
 */
export const markReleased = async (
  documentId,
  adminId,
  { borrowerName, dateBorrowed }
) => {
  const name = sanitizeText(borrowerName, 200);
  if (!name) throw new Error("Borrower name is required");
  const ts = dateOrNull(dateBorrowed) || Timestamp.fromDate(new Date());

  const ref = doc(db, COLLECTION, documentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Request not found");
  const data = snap.data();
  requireStatus(data, STATUS.APPROVED, "release");

  const now = Timestamp.fromDate(new Date());
  const stageEntry = {
    stage: PIPELINE_STAGES.PICKUP,
    action: "released",
    completedAt: now,
    completedBy: adminId,
  };

  const batch = writeBatch(db);
  batch.update(ref, {
    status: STATUS.RELEASED,
    "officeUse.dateBorrowed": ts,
    "officeUse.receivedByBorrower": { name, signedAt: ts },
    "pipeline.currentStage": PIPELINE_STAGES.RETURN,
    "pipeline.stages": appendStage(data, stageEntry),
    dateReleased: serverTimestamp(),
    lastUpdated: serverTimestamp(),
    updatedBy: adminId,
  });

  const historyRef = doc(collection(db, "documentStatusHistory"));
  batch.set(historyRef, {
    documentId,
    status: STATUS.RELEASED,
    previousStatus: data.status,
    changedBy: adminId,
    remarks: `Released to ${name} for pickup`,
    timestamp: serverTimestamp(),
  });

  await batch.commit();
};

/**
 * Admin records physical return — captures Section F bottom half.
 */
export const markReturned = async (
  documentId,
  adminId,
  { officePersonnelName, dateReturned, conditionUponReturn = "" }
) => {
  const name = sanitizeText(officePersonnelName, 200);
  if (!name) throw new Error("Office personnel name is required");
  const ts = dateOrNull(dateReturned) || Timestamp.fromDate(new Date());
  const condition = sanitizeText(conditionUponReturn, 1000);

  const ref = doc(db, COLLECTION, documentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Request not found");
  const data = snap.data();
  requireStatus(data, STATUS.RELEASED, "mark returned");

  const now = Timestamp.fromDate(new Date());
  const stageEntry = {
    stage: PIPELINE_STAGES.RETURN,
    action: "returned",
    completedAt: now,
    completedBy: adminId,
    remarks: condition,
  };

  const batch = writeBatch(db);
  batch.update(ref, {
    status: STATUS.RETURNED,
    "officeUse.dateReturned": ts,
    "officeUse.receivedByOfficePersonnel": { name, signedAt: ts },
    "officeUse.conditionUponReturn": condition,
    "pipeline.currentStage": PIPELINE_STAGES.CLOSED,
    "pipeline.stages": appendStage(data, stageEntry),
    lastUpdated: serverTimestamp(),
    updatedBy: adminId,
  });

  const historyRef = doc(collection(db, "documentStatusHistory"));
  batch.set(historyRef, {
    documentId,
    status: STATUS.RETURNED,
    previousStatus: data.status,
    changedBy: adminId,
    remarks: condition
      ? `Returned by ${name} — ${condition}`
      : `Returned by ${name}`,
    timestamp: serverTimestamp(),
  });

  await batch.commit();
};

/**
 * Persist the generated PDF path on the document.
 */
export const setRequestPdf = async (documentId, { pdfPath, pdfFileName }) => {
  if (!pdfPath || !pdfFileName) throw new Error("pdfPath and pdfFileName required");
  const ref = doc(db, COLLECTION, documentId);
  const batch = writeBatch(db);
  batch.update(ref, {
    pdfPath,
    pdfFileName,
    lastUpdated: serverTimestamp(),
  });
  await batch.commit();
};

export const EQUIPMENT_REQUEST_STATUS = STATUS;
export const EQUIPMENT_REQUEST_PIPELINE_STAGES = PIPELINE_STAGES;

export const STATUS_LABELS = {
  [STATUS.PENDING]: "Pending Review",
  [STATUS.APPROVED]: "Approved — Awaiting Pickup",
  [STATUS.RELEASED]: "Released — In Use",
  [STATUS.RETURNED]: "Returned — Closed",
  [STATUS.RETURNED_FOR_REVISION]: "Returned for Revision",
  [STATUS.REJECTED]: "Rejected",
};

export const STATUS_BADGE_CLASS = {
  [STATUS.PENDING]: "status-badge-pending",
  [STATUS.APPROVED]: "status-badge-approved",
  [STATUS.RELEASED]: "status-badge-review",
  [STATUS.RETURNED]: "status-badge-approved",
  [STATUS.RETURNED_FOR_REVISION]: "status-badge-returned",
  [STATUS.REJECTED]: "status-badge-returned",
};
