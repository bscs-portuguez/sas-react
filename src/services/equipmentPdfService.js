import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../config/firebase";
import { setRequestPdf } from "./equipmentRequestService";

/**
 * Equipment Request PDF generator.
 *
 * Lays out the approved request in a clean format mirroring the official
 * paper template (Sections A–F). This is the readable, signable version
 * that SAS prints, signs in person, and files.
 */

const MAROON = rgb(0x80 / 255, 0x00 / 255, 0x20 / 255);
const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.4, 0.4, 0.4);

const PAGE_WIDTH = 612; // US Letter
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const formatDateForPdf = (raw) => {
  if (!raw) return "";
  const d = raw?.toDate ? raw.toDate() : raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatDateTimeForPdf = (raw) => {
  if (!raw) return "";
  const d = raw?.toDate ? raw.toDate() : raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const wrapText = (text, font, fontSize, maxWidth) => {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
};

class PdfBuilder {
  constructor() {
    this.doc = null;
    this.page = null;
    this.font = null;
    this.bold = null;
    this.y = 0;
  }

  async init() {
    this.doc = await PDFDocument.create();
    this.font = await this.doc.embedFont(StandardFonts.Helvetica);
    this.bold = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  ensureSpace(height) {
    if (this.y - height < MARGIN) {
      this.newPage();
    }
  }

  drawHeader(title) {
    this.ensureSpace(80);
    this.page.drawText("EULOGIO \"AMANG\" RODRIGUEZ", {
      x: MARGIN,
      y: this.y,
      size: 14,
      font: this.bold,
      color: MAROON,
    });
    this.y -= 16;
    this.page.drawText("INSTITUTE OF SCIENCE AND TECHNOLOGY", {
      x: MARGIN,
      y: this.y,
      size: 12,
      font: this.bold,
      color: MAROON,
    });
    this.y -= 13;
    this.page.drawText("Nagtahan, Sampaloc, Manila", {
      x: MARGIN,
      y: this.y,
      size: 9,
      font: this.font,
      color: GRAY,
    });
    this.y -= 22;
    this.page.drawText("STUDENT AFFAIRS AND SERVICES", {
      x: MARGIN,
      y: this.y,
      size: 14,
      font: this.bold,
      color: BLACK,
    });
    this.y -= 16;
    this.page.drawText(title, {
      x: MARGIN,
      y: this.y,
      size: 11,
      font: this.bold,
      color: BLACK,
    });
    this.y -= 18;
    this.drawHr();
  }

  drawHr() {
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 1,
      color: MAROON,
    });
    this.y -= 12;
  }

  drawSectionTitle(label) {
    this.ensureSpace(20);
    this.page.drawText(label, {
      x: MARGIN,
      y: this.y,
      size: 11,
      font: this.bold,
      color: MAROON,
    });
    this.y -= 14;
  }

  drawField(label, value, { width = CONTENT_WIDTH, indent = 0 } = {}) {
    const labelText = `${label}:`;
    const labelWidth = this.bold.widthOfTextAtSize(labelText, 9) + 6;
    const valueLines = wrapText(
      value || "",
      this.font,
      10,
      width - labelWidth - indent
    );
    const lineHeight = 13;
    const blockHeight = Math.max(1, valueLines.length) * lineHeight;
    this.ensureSpace(blockHeight + 2);

    this.page.drawText(labelText, {
      x: MARGIN + indent,
      y: this.y,
      size: 9,
      font: this.bold,
      color: GRAY,
    });

    valueLines.forEach((line, i) => {
      this.page.drawText(line, {
        x: MARGIN + indent + labelWidth,
        y: this.y - i * lineHeight,
        size: 10,
        font: this.font,
        color: BLACK,
      });
    });

    this.y -= blockHeight + 2;
  }

  drawTwoColumn(rows) {
    const colW = CONTENT_WIDTH / 2 - 8;
    for (const [left, right] of rows) {
      this.ensureSpace(16);
      const startY = this.y;
      if (left) {
        this.drawField(left.label, left.value, { width: colW });
      }
      const leftEndY = this.y;
      this.y = startY;
      if (right) {
        const savedYBefore = this.y;
        this.page.drawText(`${right.label}:`, {
          x: MARGIN + CONTENT_WIDTH / 2 + 8,
          y: savedYBefore,
          size: 9,
          font: this.bold,
          color: GRAY,
        });
        const rLabelW =
          this.bold.widthOfTextAtSize(`${right.label}:`, 9) + 6;
        const rLines = wrapText(
          right.value || "",
          this.font,
          10,
          colW - rLabelW
        );
        rLines.forEach((line, i) => {
          this.page.drawText(line, {
            x: MARGIN + CONTENT_WIDTH / 2 + 8 + rLabelW,
            y: savedYBefore - i * 13,
            size: 10,
            font: this.font,
            color: BLACK,
          });
        });
        const rightEndY = savedYBefore - rLines.length * 13 - 2;
        this.y = Math.min(leftEndY, rightEndY);
      } else {
        this.y = leftEndY;
      }
    }
  }

  drawItemsTable(items) {
    const cols = [
      { label: "Item Description", x: MARGIN, width: 230 },
      { label: "Quantity", x: MARGIN + 230, width: 60 },
      { label: "Condition", x: MARGIN + 290, width: 100 },
      { label: "Remarks", x: MARGIN + 390, width: CONTENT_WIDTH - 390 },
    ];

    this.ensureSpace(22);
    cols.forEach((c) => {
      this.page.drawText(c.label, {
        x: c.x + 4,
        y: this.y,
        size: 8,
        font: this.bold,
        color: GRAY,
      });
    });
    this.y -= 10;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.5,
      color: GRAY,
    });
    this.y -= 4;

    if (!items || items.length === 0) {
      this.page.drawText("(no items)", {
        x: MARGIN + 4,
        y: this.y,
        size: 9,
        font: this.font,
        color: GRAY,
      });
      this.y -= 14;
      return;
    }

    for (const it of items) {
      const rowLines = Math.max(
        wrapText(it.name || "", this.font, 9, cols[0].width - 6).length,
        wrapText(String(it.quantity ?? ""), this.font, 9, cols[1].width - 6).length,
        wrapText(it.conditionBefore || "", this.font, 9, cols[2].width - 6).length,
        wrapText(it.remarks || "", this.font, 9, cols[3].width - 6).length
      );
      const rowHeight = rowLines * 11 + 6;
      this.ensureSpace(rowHeight);

      const drawCell = (col, text) => {
        const lines = wrapText(text || "", this.font, 9, col.width - 6);
        lines.forEach((line, i) => {
          this.page.drawText(line, {
            x: col.x + 4,
            y: this.y - i * 11,
            size: 9,
            font: this.font,
            color: BLACK,
          });
        });
      };

      drawCell(cols[0], it.name);
      drawCell(cols[1], String(it.quantity ?? ""));
      drawCell(cols[2], it.conditionBefore || "");
      drawCell(cols[3], it.remarks || "");

      this.y -= rowHeight;
      this.page.drawLine({
        start: { x: MARGIN, y: this.y + 2 },
        end: { x: PAGE_WIDTH - MARGIN, y: this.y + 2 },
        thickness: 0.3,
        color: GRAY,
      });
    }
    this.y -= 4;
  }

  drawTerms(terms) {
    terms.forEach((t, i) => {
      const lines = wrapText(`${i + 1}. ${t}`, this.font, 9, CONTENT_WIDTH - 8);
      const blockHeight = lines.length * 11 + 2;
      this.ensureSpace(blockHeight);
      lines.forEach((line, j) => {
        this.page.drawText(line, {
          x: MARGIN + 8,
          y: this.y - j * 11,
          size: 9,
          font: this.font,
          color: BLACK,
        });
      });
      this.y -= blockHeight;
    });
  }

  drawSignatureRow(label, name, date) {
    this.ensureSpace(40);
    const colWidth = CONTENT_WIDTH / 2 - 10;

    this.page.drawText(label, {
      x: MARGIN,
      y: this.y,
      size: 9,
      font: this.bold,
      color: GRAY,
    });
    this.y -= 18;

    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: MARGIN + colWidth, y: this.y },
      thickness: 0.5,
      color: BLACK,
    });
    this.page.drawLine({
      start: { x: MARGIN + colWidth + 20, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.5,
      color: BLACK,
    });

    if (name) {
      this.page.drawText(name, {
        x: MARGIN + 2,
        y: this.y + 4,
        size: 9,
        font: this.font,
        color: BLACK,
      });
    }
    if (date) {
      this.page.drawText(date, {
        x: MARGIN + colWidth + 22,
        y: this.y + 4,
        size: 9,
        font: this.font,
        color: BLACK,
      });
    }

    this.y -= 10;
    this.page.drawText("Name / Signature", {
      x: MARGIN,
      y: this.y,
      size: 7,
      font: this.font,
      color: GRAY,
    });
    this.page.drawText("Date", {
      x: MARGIN + colWidth + 20,
      y: this.y,
      size: 7,
      font: this.font,
      color: GRAY,
    });
    this.y -= 14;
  }

  async save() {
    return this.doc.save();
  }
}

const TERMS = [
  "The requester shall be responsible for the safekeeping and proper use of the borrowed items.",
  "Items must be returned in good condition by the agreed-upon return date and time.",
  "Any damage, loss, or malfunction shall be reported immediately and may be subject to replacement or repair costs.",
  "Borrowed items shall be used only for the stated purpose and within the approved venue.",
  "The requesting party agrees to comply with all institutional guidelines on equipment use.",
];

/**
 * Build a PDF for an approved (or further-progressed) equipment request.
 * Returns Uint8Array of bytes.
 */
export const buildEquipmentRequestPdfBytes = async (request) => {
  const b = new PdfBuilder();
  await b.init();

  b.drawHeader("REQUEST FORM FOR BORROWING EQUIPMENT/ITEMS");

  // Section A
  b.drawSectionTitle("SECTION A: REQUESTING PARTY INFORMATION");
  b.drawField("College/Department/Office", request.requesting?.collegeOrDepartment);
  b.drawField("Name", request.requesting?.name);
  b.drawField("Designation / Position", request.requesting?.designation);
  b.drawField("Contact Number", request.requesting?.contactNumber);
  b.drawField("Email Address", request.requesting?.email);
  b.drawField("Adviser / Supervisor", request.requesting?.adviser);
  b.y -= 6;

  // Section B
  b.drawSectionTitle("SECTION B: BORROWING DETAILS");
  b.drawField("Purpose", request.borrowing?.purpose);
  b.drawField("Activity Title", request.borrowing?.activityTitle);
  b.drawField(
    "Activity Date(s) (From-To)",
    `${formatDateForPdf(request.borrowing?.activityDateFrom)}  —  ${formatDateForPdf(request.borrowing?.activityDateTo)}`
  );
  b.drawField("Location of Use", request.borrowing?.locationOfUse);
  b.drawField(
    "Date & Time of Borrowing",
    formatDateTimeForPdf(request.borrowing?.dateTimeBorrowed)
  );
  b.drawField(
    "Expected Date & Time of Return",
    formatDateTimeForPdf(request.borrowing?.expectedDateTimeReturn)
  );
  b.y -= 6;

  // Section C
  b.drawSectionTitle("SECTION C: LIST OF EQUIPMENT/ITEMS TO BE BORROWED");
  b.drawItemsTable(request.items);
  b.y -= 4;

  // Section D
  b.drawSectionTitle("SECTION D: TERMS & CONDITIONS");
  b.drawTerms(TERMS);
  b.ensureSpace(28);
  const ackLines = wrapText(
    "I hereby acknowledge that I am responsible for the borrowed items and shall ensure their proper use and timely return in good condition. I agree to be held accountable for any loss or damage.",
    b.font,
    9,
    CONTENT_WIDTH - 8
  );
  ackLines.forEach((line, i) => {
    b.page.drawText(line, {
      x: MARGIN + 8,
      y: b.y - i * 11,
      size: 9,
      font: b.bold,
      color: BLACK,
    });
  });
  b.y -= ackLines.length * 11 + 8;

  // Section E
  b.drawSectionTitle("SECTION E: SIGNATURES AND APPROVAL");
  b.drawSignatureRow("Signature of Requester", request.requesting?.name || "", "");
  b.drawSignatureRow("Approved by (SAS/Office-In-Charge)", "", "");

  // Section F
  b.drawSectionTitle("SECTION F: FOR OFFICE USE ONLY");
  b.drawSignatureRow(
    "Received By (Borrowing-Requester)",
    request.officeUse?.receivedByBorrower?.name || "",
    formatDateTimeForPdf(request.officeUse?.dateBorrowed)
  );
  b.drawSignatureRow(
    "Received By (Returning-Office Personnel)",
    request.officeUse?.receivedByOfficePersonnel?.name || "",
    formatDateTimeForPdf(request.officeUse?.dateReturned)
  );
  b.drawField(
    "Condition Upon Return",
    request.officeUse?.conditionUponReturn || ""
  );

  return b.save();
};

/**
 * Generate, upload to Storage, and persist `pdfPath` on the request document.
 * Returns { storagePath, fileName, downloadUrl }.
 */
export const generateAndStoreEquipmentRequestPdf = async (request, adminId) => {
  const bytes = await buildEquipmentRequestPdfBytes(request);
  const fileName = "equipment_request_form.pdf";
  const storagePath = `documents/${request.documentId}/${fileName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, bytes, {
    contentType: "application/pdf",
    customMetadata: {
      uploadedBy: adminId || "",
      documentId: request.documentId,
      generatedAt: new Date().toISOString(),
    },
  });

  const downloadUrl = await getDownloadURL(storageRef);
  await setRequestPdf(request.documentId, { pdfPath: storagePath, pdfFileName: fileName });

  return { storagePath, fileName, downloadUrl };
};

/**
 * Resolve a download URL for a request's stored PDF.
 */
export const getEquipmentRequestPdfUrl = async (request) => {
  if (!request?.pdfPath) return null;
  const storageRef = ref(storage, request.pdfPath);
  return getDownloadURL(storageRef);
};
