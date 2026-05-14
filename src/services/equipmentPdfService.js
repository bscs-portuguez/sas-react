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
const FOOTER_RESERVE = 30; // space reserved at the bottom for "Page X of Y"
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
    this.italic = null;
    this.y = 0;
  }

  async init() {
    this.doc = await PDFDocument.create();
    this.font = await this.doc.embedFont(StandardFonts.Helvetica);
    this.bold = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.italic = await this.doc.embedFont(StandardFonts.HelveticaOblique);
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  ensureSpace(height) {
    if (this.y - height < MARGIN + FOOTER_RESERVE) {
      this.newPage();
    }
  }

  drawCenteredText(text, { size = 10, font = this.font, color = BLACK } = {}) {
    const w = font.widthOfTextAtSize(text, size);
    this.page.drawText(text, {
      x: (PAGE_WIDTH - w) / 2,
      y: this.y,
      size,
      font,
      color,
    });
  }

  drawHeader(title) {
    this.ensureSpace(96);
    this.drawCenteredText("EULOGIO \"AMANG\" RODRIGUEZ", {
      size: 14,
      font: this.bold,
      color: MAROON,
    });
    this.y -= 16;
    this.drawCenteredText("INSTITUTE OF SCIENCE AND TECHNOLOGY", {
      size: 12,
      font: this.bold,
      color: MAROON,
    });
    this.y -= 13;
    this.drawCenteredText("Nagtahan, Sampaloc, Manila", {
      size: 9,
      font: this.font,
      color: GRAY,
    });
    this.y -= 22;
    this.drawCenteredText("STUDENT AFFAIRS AND SERVICES", {
      size: 14,
      font: this.bold,
      color: BLACK,
    });
    this.y -= 16;
    this.drawCenteredText(title, {
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
    this.ensureSpace(24);
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

  drawItemsTable(items) {
    const cols = [
      { label: "Item Description", x: MARGIN, width: 230 },
      { label: "Quantity", x: MARGIN + 230, width: 60 },
      { label: "Condition", x: MARGIN + 290, width: 100 },
      { label: "Remarks", x: MARGIN + 390, width: CONTENT_WIDTH - 390 },
    ];

    const HEADER_HEIGHT = 14;
    const LINE_HEIGHT = 11;
    const ROW_VPAD = 6; // total vertical padding inside a row

    // need at least header + separator + one row
    this.ensureSpace(HEADER_HEIGHT + LINE_HEIGHT + ROW_VPAD + 4);

    // header row baseline (text drawn below current y)
    const headerBaseline = this.y - HEADER_HEIGHT + 3;
    cols.forEach((c) => {
      this.page.drawText(c.label, {
        x: c.x + 4,
        y: headerBaseline,
        size: 8,
        font: this.bold,
        color: GRAY,
      });
    });
    this.y -= HEADER_HEIGHT;

    // separator under headers
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.5,
      color: GRAY,
    });

    if (!items || items.length === 0) {
      this.y -= LINE_HEIGHT + 4;
      this.page.drawText("(no items)", {
        x: MARGIN + 4,
        y: this.y,
        size: 9,
        font: this.font,
        color: GRAY,
      });
      this.y -= 8;
      return;
    }

    for (const it of items) {
      const rowLines = Math.max(
        wrapText(it.name || "", this.font, 9, cols[0].width - 6).length,
        wrapText(String(it.quantity ?? ""), this.font, 9, cols[1].width - 6).length,
        wrapText(it.conditionBefore || "", this.font, 9, cols[2].width - 6).length,
        wrapText(it.remarks || "", this.font, 9, cols[3].width - 6).length,
        1
      );
      const rowHeight = rowLines * LINE_HEIGHT + ROW_VPAD;
      this.ensureSpace(rowHeight);

      // first text baseline sits ROW_VPAD/2 + 2 below the top of the row
      const firstBaseline = this.y - (ROW_VPAD / 2) - 8;

      const drawCell = (col, text) => {
        const lines = wrapText(text || "", this.font, 9, col.width - 6);
        lines.forEach((line, i) => {
          this.page.drawText(line, {
            x: col.x + 4,
            y: firstBaseline - i * LINE_HEIGHT,
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

      // row separator at the bottom of the row, fully clear of the text
      this.page.drawLine({
        start: { x: MARGIN, y: this.y },
        end: { x: PAGE_WIDTH - MARGIN, y: this.y },
        thickness: 0.3,
        color: GRAY,
      });
    }
    this.y -= 6;
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

  drawCenteredAcknowledgement(text) {
    const size = 9;
    const lines = wrapText(text, this.italic, size, CONTENT_WIDTH - 40);
    const lineHeight = 12;
    this.ensureSpace(lines.length * lineHeight + 6);
    lines.forEach((line) => {
      const w = this.italic.widthOfTextAtSize(line, size);
      this.page.drawText(line, {
        x: (PAGE_WIDTH - w) / 2,
        y: this.y,
        size,
        font: this.italic,
        color: BLACK,
      });
      this.y -= lineHeight;
    });
    this.y -= 6;
  }

  drawAcknowledgementSignature(requestorName) {
    this.ensureSpace(50);
    this.y -= 6;

    const sigLabel = "Signature of Requestor over printed name:";
    const sigLabelWidth = this.font.widthOfTextAtSize(sigLabel, 9);
    this.page.drawText(sigLabel, {
      x: MARGIN,
      y: this.y,
      size: 9,
      font: this.font,
      color: BLACK,
    });
    const sigLineStart = MARGIN + sigLabelWidth + 6;
    this.page.drawLine({
      start: { x: sigLineStart, y: this.y - 2 },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y - 2 },
      thickness: 0.5,
      color: BLACK,
    });
    if (requestorName) {
      this.page.drawText(requestorName, {
        x: sigLineStart + 4,
        y: this.y,
        size: 9,
        font: this.font,
        color: BLACK,
      });
    }
    this.y -= 20;

    const dateLabel = "Date:";
    const dateLabelW = this.font.widthOfTextAtSize(dateLabel, 9);
    this.page.drawText(dateLabel, {
      x: MARGIN,
      y: this.y,
      size: 9,
      font: this.font,
      color: BLACK,
    });
    this.page.drawLine({
      start: { x: MARGIN + dateLabelW + 6, y: this.y - 2 },
      end: { x: MARGIN + 220, y: this.y - 2 },
      thickness: 0.5,
      color: BLACK,
    });
    this.y -= 18;
  }

  drawSignatureRow(label, name, date) {
    this.ensureSpace(44);
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
    this.y -= 16;
  }

  drawPageFooters() {
    const pages = this.doc.getPages();
    const total = pages.length;
    pages.forEach((p, i) => {
      const text = `Page ${i + 1} of ${total}`;
      const size = 9;
      const w = this.font.widthOfTextAtSize(text, size);
      p.drawText(text, {
        x: (PAGE_WIDTH - w) / 2,
        y: 24,
        size,
        font: this.font,
        color: GRAY,
      });
    });
  }

  async save() {
    this.drawPageFooters();
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

const ACK_TEXT =
  "I hereby acknowledge that I am responsible for the borrowed items and shall ensure their proper use and timely return in good condition. I agree to be held accountable for any loss or damage.";

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
  b.y -= 6;
  b.drawCenteredAcknowledgement(ACK_TEXT);
  b.drawAcknowledgementSignature(request.requesting?.name || "");

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
